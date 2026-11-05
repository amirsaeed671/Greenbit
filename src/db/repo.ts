import { type BackupFile } from '../core/backup';
import { minDate } from '../core/dates';
import { encode, newer, receive, tick, type Clock } from '../core/hlc';
import type { Entry, Habit, Settings, SyncMeta } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { db as defaultDb, SYNCED, type GreenbitDB, type SyncedTable } from './db';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const iso = () => new Date().toISOString();
const alive = <T extends SyncMeta>(r: T | undefined): r is T => !!r && !r.deletedAt;

export function makeRepo(db: GreenbitDB = defaultDb) {
  let clock: Clock | null = null;
  const changeListeners = new Set<() => void>();

  async function deviceId(): Promise<string> {
    const row = await db.local.get('device');
    if (row) return row.value as string;
    const id = uid().replace(/-/g, '').slice(0, 10);
    await db.local.put({ key: 'device', value: id });
    return id;
  }

  /** Next local clock stamp, persisted so it never goes backwards across reloads. */
  async function stamp(): Promise<string> {
    if (!clock) {
      const saved = (await db.local.get('clock'))?.value as Clock | undefined;
      clock = saved ?? { ms: 0, counter: 0, device: await deviceId() };
    }
    clock = tick(clock, Date.now());
    await db.local.put({ key: 'clock', value: clock });
    return encode(clock);
  }

  /** Advance the local clock past a stamp received from another device. */
  async function observe(remote: string) {
    if (!clock) await stamp();
    clock = receive(clock!, remote, Date.now());
    await db.local.put({ key: 'clock', value: clock });
  }

  const changed = () => changeListeners.forEach((f) => f());

  async function save<T extends { id: string } & SyncMeta>(table: SyncedTable, record: T): Promise<T> {
    const r = { ...record, hlc: await stamp(), updatedAt: iso() } as T;
    await db.table(table).put(r);
    changed();
    return r;
  }

  async function patch<T extends SyncMeta>(table: SyncedTable, id: string, change: Partial<T>) {
    const cur = await db.table(table).get(id);
    if (!alive(cur)) return;
    await db.table(table).put({ ...cur, ...change, hlc: await stamp(), updatedAt: iso() });
    changed();
  }

  async function remove(table: SyncedTable, id: string) {
    const cur = await db.table(table).get(id);
    if (!cur || cur.deletedAt) return;
    await db.table(table).put({ ...cur, deletedAt: iso(), hlc: await stamp() });
    changed();
  }

  return {
    deviceId,
    stamp,
    observe,
    save,
    patch,
    remove,
    /** Called after any local write (sync uses it to push soon). */
    onChange(fn: () => void) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },

    async getSettings(): Promise<Settings> {
      const row = await db.kv.get('settings');
      return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
    },
    async updateSettings(change: Partial<Settings>) {
      const current = await this.getSettings();
      await db.kv.put({ key: 'settings', value: { ...current, ...change }, hlc: await stamp() });
      changed();
    },

    async addHabit(data: Omit<Habit, 'id' | 'updatedAt'>): Promise<string> {
      const id = uid();
      await save('habits', { ...data, id });
      return id;
    },
    updateHabit: (id: string, change: Partial<Omit<Habit, 'id'>>) => patch<Habit>('habits', id, change),
    archiveHabit: (id: string, date: string) => patch<Habit>('habits', id, { archivedAt: date }),
    async restoreHabit(id: string) {
      const h = await db.habits.get(id);
      if (!alive(h)) return;
      const { archivedAt: _drop, ...rest } = h;
      void _drop;
      await save('habits', rest);
    },
    async deleteHabit(id: string) {
      const [entries, goals] = await Promise.all([db.entries.where('habitId').equals(id).toArray(), db.goals.where('habitId').equals(id).toArray()]);
      for (const e of entries) await remove('entries', e.id);
      for (const g of goals) await remove('goals', g.id);
      await remove('habits', id);
    },

    /**
     * Backfilling before a habit's `createdAt` extends `createdAt` backwards,
     * so the backfilled period counts toward history and streaks.
     */
    async addEntry(data: Omit<Entry, 'id' | 'updatedAt'>): Promise<string> {
      if (!(data.volume > 0)) throw new Error('Volume must be greater than 0');
      const habit = await db.habits.get(data.habitId);
      if (!alive(habit)) throw new Error('Habit not found');
      if (data.date < habit.createdAt) await patch<Habit>('habits', habit.id, { createdAt: minDate(data.date, habit.createdAt) });
      const id = uid();
      await save('entries', { ...data, id });
      return id;
    },
    async updateEntry(id: string, change: Partial<Omit<Entry, 'id' | 'habitId'>>) {
      if (change.volume !== undefined && !(change.volume > 0)) throw new Error('Volume must be greater than 0');
      const e = await db.entries.get(id);
      if (!alive(e)) return;
      if (change.date) {
        const habit = await db.habits.get(e.habitId);
        if (alive(habit) && change.date < habit.createdAt) await patch<Habit>('habits', habit.id, { createdAt: change.date });
      }
      await patch<Entry>('entries', id, change);
    },
    deleteEntry: (id: string) => remove('entries', id),

    /** Live (non-deleted) records of every synced table, plus settings. */
    async snapshot() {
      const [tables, settings] = await Promise.all([
        Promise.all(SYNCED.map(async (t) => [t, (await db.table(t).toArray()).filter((r: SyncMeta) => !r.deletedAt)] as const)),
        this.getSettings(),
      ]);
      return { ...(Object.fromEntries(tables) as unknown as Pick<BackupFile, SyncedTable>), settings };
    },

    /**
     * Applies an already-validated backup. Replace tombstones everything first, so
     * the removal also reaches synced devices. Merge keeps the newer edit of each record.
     */
    async importData(file: BackupFile, mode: 'merge' | 'replace') {
      await db.transaction('rw', [...SYNCED.map((t) => db.table(t)), db.kv, db.local], async () => {
        for (const t of SYNCED) {
          const incoming = file[t] as ({ id: string } & SyncMeta)[];
          if (mode === 'replace') {
            const ids = new Set(incoming.map((r) => r.id));
            for (const cur of await db.table(t).toArray()) if (!cur.deletedAt && !ids.has(cur.id)) await db.table(t).put({ ...cur, deletedAt: iso(), hlc: await stamp() });
            for (const { deletedAt: _d, ...r } of incoming) await db.table(t).put({ ...r, hlc: await stamp() });
          } else {
            for (const r of incoming) {
              const cur = await db.table(t).get(r.id);
              if (!cur || newer(r.hlc, cur.hlc)) await db.table(t).put(r);
            }
          }
        }
        if (mode === 'replace') {
          const keep = await this.getSettings();
          await db.kv.put({ key: 'settings', value: { ...file.settings, lastExportAt: keep.lastExportAt }, hlc: await stamp() });
        }
      });
      changed();
    },

    async resetAll() {
      await db.transaction('rw', [...SYNCED.map((t) => db.table(t)), db.kv, db.local], async () => {
        for (const t of SYNCED) for (const cur of await db.table(t).toArray()) if (!cur.deletedAt) await db.table(t).put({ ...cur, deletedAt: iso(), hlc: await stamp() });
        await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS }, hlc: await stamp() });
      });
      changed();
    },
  };
}

export const repo = makeRepo();
export type Repo = ReturnType<typeof makeRepo>;

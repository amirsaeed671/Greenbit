import { mergeData, type BackupFile } from '../core/backup';
import { minDate } from '../core/dates';
import type { Entry, Habit, Settings } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { db as defaultDb, type GreenbitDB } from './db';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const stamp = () => new Date().toISOString();

export function makeRepo(db: GreenbitDB = defaultDb) {
  return {
    async getSettings(): Promise<Settings> {
      const row = await db.kv.get('settings');
      return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
    },
    async updateSettings(patch: Partial<Settings>) {
      const current = await this.getSettings();
      await db.kv.put({ key: 'settings', value: { ...current, ...patch } });
    },

    async addHabit(data: Omit<Habit, 'id' | 'updatedAt'>): Promise<string> {
      const id = uid();
      await db.habits.add({ ...data, id, updatedAt: stamp() });
      return id;
    },
    async updateHabit(id: string, patch: Partial<Omit<Habit, 'id'>>) {
      await db.habits.update(id, { ...patch, updatedAt: stamp() });
    },
    async archiveHabit(id: string, date: string) {
      await db.habits.update(id, { archivedAt: date, updatedAt: stamp() });
    },
    async restoreHabit(id: string) {
      const h = await db.habits.get(id);
      if (!h) return;
      const { archivedAt: _drop, ...rest } = h;
      void _drop;
      await db.habits.put({ ...rest, updatedAt: stamp() });
    },
    async deleteHabit(id: string) {
      await db.transaction('rw', db.habits, db.entries, async () => {
        await db.entries.where('habitId').equals(id).delete();
        await db.habits.delete(id);
      });
    },

    /**
     * Backfilling before a habit's `createdAt` extends `createdAt` backwards,
     * so the backfilled period counts toward history and streaks.
     */
    async addEntry(data: Omit<Entry, 'id' | 'updatedAt'>): Promise<string> {
      if (!(data.volume > 0)) throw new Error('Volume must be greater than 0');
      const id = uid();
      await db.transaction('rw', db.habits, db.entries, async () => {
        const habit = await db.habits.get(data.habitId);
        if (!habit) throw new Error('Habit not found');
        if (data.date < habit.createdAt) await db.habits.update(habit.id, { createdAt: minDate(data.date, habit.createdAt), updatedAt: stamp() });
        await db.entries.add({ ...data, id, updatedAt: stamp() });
      });
      return id;
    },
    async updateEntry(id: string, patch: Partial<Omit<Entry, 'id' | 'habitId'>>) {
      if (patch.volume !== undefined && !(patch.volume > 0)) throw new Error('Volume must be greater than 0');
      await db.transaction('rw', db.habits, db.entries, async () => {
        const e = await db.entries.get(id);
        if (!e) return;
        if (patch.date) {
          const habit = await db.habits.get(e.habitId);
          if (habit && patch.date < habit.createdAt) await db.habits.update(habit.id, { createdAt: patch.date, updatedAt: stamp() });
        }
        await db.entries.update(id, { ...patch, updatedAt: stamp() });
      });
    },
    async deleteEntry(id: string) {
      await db.entries.delete(id);
    },

    async snapshot() {
      const [habits, entries, settings] = await Promise.all([db.habits.toArray(), db.entries.toArray(), this.getSettings()]);
      return { habits, entries, settings };
    },

    /** Applies an already-validated backup atomically: all or nothing. */
    async importData(file: BackupFile, mode: 'merge' | 'replace') {
      await db.transaction('rw', db.habits, db.entries, db.kv, async () => {
        if (mode === 'replace') {
          await Promise.all([db.habits.clear(), db.entries.clear()]);
          await db.habits.bulkPut(file.habits);
          await db.entries.bulkPut(file.entries);
          const keep = await this.getSettings();
          await db.kv.put({ key: 'settings', value: { ...file.settings, lastExportAt: keep.lastExportAt } });
        } else {
          const local = { habits: await db.habits.toArray(), entries: await db.entries.toArray() };
          const merged = mergeData(local, file);
          await db.habits.bulkPut(merged.habits);
          await db.entries.bulkPut(merged.entries);
        }
      });
    },

    async resetAll() {
      await db.transaction('rw', db.habits, db.entries, db.kv, async () => {
        await Promise.all([db.habits.clear(), db.entries.clear(), db.kv.clear()]);
      });
    },
  };
}

export const repo = makeRepo();
export type Repo = ReturnType<typeof makeRepo>;

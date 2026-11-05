import { describe, expect, it } from 'vitest';
import { buildExport, validateImport } from '../core/backup';
import { GreenbitDB } from './db';
import { makeRepo } from './repo';

const base = { name: 'Read', unit: 'pages', frequency: 'daily' as const, minimum: 1, target: 2, stretch: 3, plant: 'daisy', createdAt: '2024-02-01' };

describe('repo', () => {
  it('extends createdAt backwards when backfilling', async () => {
    const r = makeRepo(new GreenbitDB('t1'));
    const id = await r.addHabit(base);
    await r.addEntry({ habitId: id, date: '2024-01-20', volume: 2 });
    const { habits } = await r.snapshot();
    expect(habits[0].createdAt).toBe('2024-01-20');
  });
  it('rejects non-positive volume', async () => {
    const r = makeRepo(new GreenbitDB('t2'));
    const id = await r.addHabit(base);
    await expect(r.addEntry({ habitId: id, date: '2024-02-02', volume: 0 })).rejects.toThrow();
  });
  it('export then import into a fresh database reproduces identical state', async () => {
    const a = makeRepo(new GreenbitDB('t3a'));
    const id = await a.addHabit(base);
    await a.addEntry({ habitId: id, date: '2024-02-02', volume: 2, note: 'hi' });
    await a.updateSettings({ weekStartsOn: 0, calendarMode: 'combined' });
    const snap = await a.snapshot();
    const text = JSON.stringify(buildExport(snap.settings, snap));
    const parsed = validateImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const b = makeRepo(new GreenbitDB('t3b'));
    await b.importData(parsed.data, 'replace');
    const snapB = await b.snapshot();
    // Replace re-stamps every record (so the restored state wins on synced devices); content is identical.
    const strip = <T extends { hlc?: string }>(xs: T[]) => xs.map(({ hlc: _h, ...x }) => x);
    expect(strip(snapB.habits)).toEqual(strip(snap.habits));
    expect(strip(snapB.entries)).toEqual(strip(snap.entries));
    expect(snapB.settings).toMatchObject({ weekStartsOn: 0, calendarMode: 'combined' });
  });
  it('deletes are tombstones with a newer clock stamp', async () => {
    const db = new GreenbitDB('t5');
    const r = makeRepo(db);
    const id = await r.addHabit(base);
    const before = (await db.habits.get(id))!.hlc!;
    await r.addEntry({ habitId: id, date: '2024-02-02', volume: 1 });
    await r.deleteHabit(id);
    const h = (await db.habits.get(id))!;
    expect(h.deletedAt).toBeTruthy();
    expect(h.hlc! > before).toBe(true);
    expect((await db.entries.toArray()).every((e) => e.deletedAt)).toBe(true);
    expect((await r.snapshot()).habits).toEqual([]);
  });
  it('replace import tombstones records missing from the file', async () => {
    const db = new GreenbitDB('t6');
    const r = makeRepo(db);
    const keep = await r.addHabit(base);
    const drop = await r.addHabit({ ...base, name: 'Drop' });
    const snap = await r.snapshot();
    await r.importData(buildExport(snap.settings, { habits: snap.habits.filter((h) => h.id === keep) }), 'replace');
    expect((await db.habits.get(drop))!.deletedAt).toBeTruthy();
    expect((await db.habits.get(keep))!.deletedAt).toBeUndefined();
  });
  it('upgrades a version 1 database in place', async () => {
    const Dexie = (await import('dexie')).default;
    const old = new Dexie('t7');
    old.version(1).stores({ habits: 'id, frequency, archivedAt', entries: 'id, habitId, date, [habitId+date]', kv: 'key' });
    await old.table('habits').put({ ...base, id: 'old', updatedAt: '2024-01-01T00:00:00Z' });
    old.close();
    const db = new GreenbitDB('t7');
    const h = await db.habits.get('old');
    expect(h?.hlc).toBeTruthy();
    expect(await db.tasks.count()).toBe(0);
  });
  it('merge keeps local records and adds new ones', async () => {
    const r = makeRepo(new GreenbitDB('t4'));
    const id = await r.addHabit(base);
    const snap = await r.snapshot();
    const other = { ...snap.habits[0], id: 'other', name: 'Run' };
    await r.importData(buildExport(snap.settings, { habits: [other] }), 'merge');
    const after = await r.snapshot();
    expect(after.habits.map((h) => h.id).sort()).toEqual([id, 'other'].sort());
  });
});

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
    const text = JSON.stringify(buildExport(snap.settings, snap.habits, snap.entries));
    const parsed = validateImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const b = makeRepo(new GreenbitDB('t3b'));
    await b.importData(parsed.data, 'replace');
    const snapB = await b.snapshot();
    expect(snapB.habits).toEqual(snap.habits);
    expect(snapB.entries).toEqual(snap.entries);
    expect(snapB.settings).toMatchObject({ weekStartsOn: 0, calendarMode: 'combined' });
  });
  it('merge keeps local records and adds new ones', async () => {
    const r = makeRepo(new GreenbitDB('t4'));
    const id = await r.addHabit(base);
    const snap = await r.snapshot();
    const other = { ...snap.habits[0], id: 'other', name: 'Run' };
    await r.importData({ ...buildExport(snap.settings, [other], []) }, 'merge');
    const after = await r.snapshot();
    expect(after.habits.map((h) => h.id).sort()).toEqual([id, 'other'].sort());
  });
});

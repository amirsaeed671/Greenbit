import { describe, expect, it } from 'vitest';
import { buildExport, mergeData, validateImport } from './backup';
import { entry, habit } from './test-utils';
import { DEFAULT_SETTINGS } from './types';

describe('backup', () => {
  const h = habit();
  const es = [entry('2024-01-02', 5)];
  it('round-trips', () => {
    const file = buildExport(DEFAULT_SETTINGS, { habits: [h], entries: es });
    const r = validateImport(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.habits).toEqual([h]);
      expect(r.data.entries).toEqual(es);
    }
  });
  it('rejects empty, malformed, foreign and newer files', () => {
    expect(validateImport('')).toMatchObject({ ok: false, error: 'The file is empty.' });
    expect(validateImport('{nope')).toMatchObject({ ok: false });
    expect(validateImport('[]')).toMatchObject({ ok: false });
    expect(validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, {}), app: 'other' }))).toMatchObject({ ok: false });
    const r = validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, {}), version: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/);
  });
  it('rejects bad thresholds, bad dates and orphan entries', () => {
    const base = buildExport(DEFAULT_SETTINGS, { habits: [h], entries: es });
    expect(validateImport(JSON.stringify({ ...base, habits: [{ ...h, minimum: 50 }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, entries: [{ ...es[0], date: '2024-02-30' }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, entries: [{ ...es[0], habitId: 'ghost' }] })).ok).toBe(false);
  });
  it('accepts files from the habit-garden working name', () => {
    expect(validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, { habits: [h], entries: es }), app: 'habit-garden' })).ok).toBe(true);
  });
  it('upgrades a version 1 file', () => {
    const v1 = { app: 'greenbit', version: 1, exportedAt: '2024-01-01T00:00:00Z', settings: {}, habits: [{ ...h, updatedAt: '2024-01-01T00:00:00Z' }], entries: es };
    const r = validateImport(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(2);
      expect(r.data.tasks).toEqual([]);
      expect(r.data.habits[0].hlc).toBeTruthy();
    }
  });
  it('validates tasks, notes and goals', () => {
    const base = buildExport(DEFAULT_SETTINGS, { habits: [h], entries: es });
    const task = { id: 't', title: 'Pay rent', priority: 1, labels: [], reminders: [{ id: 'r', type: 'relative', minutesBefore: 30 }], dueDate: '2024-02-01', dueTime: '09:00', recurrence: { freq: 'monthly', interval: 1 }, order: 0, createdAt: '2024-01-01' };
    expect(validateImport(JSON.stringify({ ...base, tasks: [task] })).ok).toBe(true);
    expect(validateImport(JSON.stringify({ ...base, tasks: [{ ...task, priority: 7 }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, tasks: [{ ...task, dueTime: '9am' }] })).ok).toBe(false);
    const goal = { id: 'g', habitId: 'h1', title: '1000 pages', kind: 'total', target: 1000, startDate: '2024-01-01', milestones: [250, 500], createdAt: '2024-01-01' };
    expect(validateImport(JSON.stringify({ ...base, goals: [goal] })).ok).toBe(true);
    expect(validateImport(JSON.stringify({ ...base, goals: [{ ...goal, habitId: 'ghost' }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, notes: [{ id: 'n', title: 'T', body: '# hi\n\n| a | b |', pinned: false, labels: [], createdAt: '2024-01-01T00:00:00Z' }] })).ok).toBe(true);
  });
  it('export drops tombstones', () => {
    const f = buildExport(DEFAULT_SETTINGS, { habits: [h, { ...h, id: 'gone', deletedAt: '2024-01-01' }] });
    expect(f.habits.map((x) => x.id)).toEqual(['h1']);
  });
  it('merges by id preferring the newer clock stamp', () => {
    const local = { habits: [{ ...h, name: 'Local', updatedAt: '2024-01-02T00:00:00Z' }], entries: es };
    const inc = { habits: [{ ...h, name: 'Incoming', hlc: 'zzzzzzzzz:0000:dev' }, habit({ id: 'h2' })], entries: [entry('2024-01-03', 1)] };
    const m = mergeData(local, inc);
    expect(m.habits.map((x) => x.name)).toEqual(['Incoming', 'Read']);
    expect(m.entries).toHaveLength(2);
    const m2 = mergeData(local, { habits: [{ ...h, name: 'Old', updatedAt: '2023-01-01T00:00:00Z' }], entries: [] });
    expect(m2.habits[0].name).toBe('Local');
  });
});

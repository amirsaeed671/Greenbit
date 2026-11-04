import { describe, expect, it } from 'vitest';
import { buildExport, mergeData, validateImport } from './backup';
import { entry, habit } from './test-utils';
import { DEFAULT_SETTINGS } from './types';

describe('backup', () => {
  const h = habit();
  const es = [entry('2024-01-02', 5)];
  it('round-trips', () => {
    const file = buildExport(DEFAULT_SETTINGS, [h], es);
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
    expect(validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, [], []), app: 'other' }))).toMatchObject({ ok: false });
    const r = validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, [], []), version: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/);
  });
  it('rejects bad thresholds, bad dates and orphan entries', () => {
    const base = buildExport(DEFAULT_SETTINGS, [h], es);
    expect(validateImport(JSON.stringify({ ...base, habits: [{ ...h, minimum: 50 }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, entries: [{ ...es[0], date: '2024-02-30' }] })).ok).toBe(false);
    expect(validateImport(JSON.stringify({ ...base, entries: [{ ...es[0], habitId: 'ghost' }] })).ok).toBe(false);
  });
  it('accepts files from the habit-garden working name', () => {
    expect(validateImport(JSON.stringify({ ...buildExport(DEFAULT_SETTINGS, [h], es), app: 'habit-garden' })).ok).toBe(true);
  });
  it('merges by id preferring newer updatedAt', () => {
    const local = { habits: [{ ...h, name: 'Local', updatedAt: '2024-01-02T00:00:00Z' }], entries: es };
    const inc = { habits: [{ ...h, name: 'Incoming', updatedAt: '2024-01-03T00:00:00Z' }, habit({ id: 'h2' })], entries: [entry('2024-01-03', 1)] };
    const m = mergeData(local, inc);
    expect(m.habits.map((x) => x.name)).toEqual(['Incoming', 'Read']);
    expect(m.entries).toHaveLength(2);
    const m2 = mergeData(local, { habits: [{ ...h, name: 'Old', updatedAt: '2023-01-01T00:00:00Z' }], entries: [] });
    expect(m2.habits[0].name).toBe('Local');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveKeys, linkToSeed, newSeed, open, seal, seedToLink, seedToWords, wordsToSeed } from './crypto';
import { emptyState, mergeStates, type SyncState } from './merge';
import { AUTO_RETRIES, conflictBackoff, EVENT_GAP_MS, POLL_MS, retryPlan } from './engine';

const st = (tables: Partial<SyncState['tables']>, settings?: SyncState['settings']): SyncState => ({ ...emptyState(), tables: { ...emptyState().tables, ...tables }, settings });
const task = (id: string, hlc: string, extra = {}) => ({ id, hlc, title: id, ...extra }) as never;

describe('sync crypto', () => {
  it('24 words round-trip and catch typos', () => {
    const seed = newSeed();
    const words = seedToWords(seed);
    expect(words).toHaveLength(24);
    expect(wordsToSeed(words.join('  ').toUpperCase())).toEqual(seed);
    const bad = [...words];
    bad[3] = bad[3] === 'abandon' ? 'ability' : 'abandon';
    expect(() => wordsToSeed(bad.join(' '))).toThrow();
  });
  it('links carry the seed in the fragment', () => {
    const seed = newSeed();
    const link = seedToLink(seed, 'https://x.app');
    expect(link.startsWith('https://x.app/sync#k=')).toBe(true);
    expect(linkToSeed(new URL(link).hash)).toEqual(seed);
    expect(linkToSeed('#k=short')).toBeNull();
  });
  it('same seed derives the same keys; data seals and opens, and tampering fails', async () => {
    const seed = newSeed();
    const a = await deriveKeys(seed);
    const b = await deriveKeys(new Uint8Array(seed));
    expect(a.relayKey).toBe(b.relayKey);
    expect(a.relayKey).toMatch(/^[0-9a-f]{64}$/);
    expect(a.fingerprint).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    const payload = { hello: 'world', n: [1, 2, 3], text: 'x'.repeat(5000) };
    const sealed = await seal(a.encKey, payload);
    expect(sealed.length).toBeLessThan(500); // compressed
    expect(await open(b.encKey, sealed)).toEqual(payload);
    const flipped = sealed.slice(0, 40) + (sealed[40] === 'A' ? 'B' : 'A') + sealed.slice(41);
    await expect(open(a.encKey, flipped)).rejects.toThrow();
    const other = await deriveKeys(newSeed());
    await expect(open(other.encKey, sealed)).rejects.toThrow();
    expect(other.relayKey).not.toBe(a.relayKey);
  });
});

describe('sync merge', () => {
  it('per record, the newer stamp wins on either side', () => {
    const local = st({ tasks: [task('a', '2'), task('b', '1')] });
    const remote = st({ tasks: [task('a', '1'), task('b', '3'), task('c', '1')] });
    const m = mergeStates(local, remote);
    expect(m.state.tables.tasks.map((t) => [t.id, t.hlc]).sort()).toEqual([['a', '2'], ['b', '3'], ['c', '1']]);
    expect(m.toLocal.tasks?.map((t) => t.id).sort()).toEqual(['b', 'c']);
    expect(m.remoteChanged).toBe(true); // 'a' is newer locally
    expect(m.maxHlc).toBe('3');
  });
  it('nothing to upload when the relay is already newer or equal', () => {
    const m = mergeStates(st({ tasks: [task('a', '1')] }), st({ tasks: [task('a', '2')] }));
    expect(m.remoteChanged).toBe(false);
    expect(mergeStates(st({ tasks: [task('a', '1')] }), st({ tasks: [task('a', '1')] })).remoteChanged).toBe(false);
  });
  it('a delete on one device beats an older edit on another', () => {
    const local = st({ notes: [task('n', '5', { deletedAt: new Date().toISOString() })] });
    const remote = st({ notes: [task('n', '4', { title: 'edited' })] });
    const m = mergeStates(local, remote);
    expect(m.state.tables.notes[0].deletedAt).toBeTruthy();
    expect(m.remoteChanged).toBe(true);
  });
  it('an edit after a delete brings the record back', () => {
    const m = mergeStates(st({ notes: [task('n', '4', { deletedAt: new Date().toISOString() })] }), st({ notes: [task('n', '6')] }));
    expect(m.toLocal.notes?.[0].deletedAt).toBeUndefined();
  });
  it('old tombstones are purged everywhere', () => {
    const old = new Date(Date.now() - 90 * 86400000).toISOString();
    const m = mergeStates(st({ tasks: [task('x', '1', { deletedAt: old })] }), st({ tasks: [task('x', '1', { deletedAt: old })] }));
    expect(m.state.tables.tasks).toHaveLength(0);
    expect(m.purge.tasks).toEqual(['x']);
    expect(m.remoteChanged).toBe(true);
  });
  it('settings follow the newer stamp; an empty relay needs an upload', () => {
    const m = mergeStates(st({}, { value: { weekStartsOn: 1 }, hlc: '1' }), st({}, { value: { weekStartsOn: 0 }, hlc: '2' }));
    expect(m.settingsToLocal?.value).toEqual({ weekStartsOn: 0 });
    expect(mergeStates(st({}), null).remoteChanged).toBe(true);
  });
});

describe('sync polling', () => {
  it('polls every 5 minutes; event checks at most once a minute', () => {
    expect(POLL_MS).toBe(300000);
    expect(EVENT_GAP_MS).toBe(60000);
  });
  it('conflict retries back off with jitter; failures really retry later', () => {
    expect(conflictBackoff(0, 0)).toBe(150);
    expect(conflictBackoff(0, 1)).toBe(450);
    expect(conflictBackoff(3, 0.5)).toBe(2400);
    expect(conflictBackoff(10, 0.5)).toBe(4000);
  });
  it('retries 3 times (the last two as Repair) before asking the user, once', () => {
    expect(AUTO_RETRIES).toBe(3);
    expect([1, 2, 3].map(retryPlan)).toEqual([
      { delay: 5000, repair: false, alert: false },
      { delay: 15000, repair: true, alert: false },
      { delay: 30000, repair: true, alert: false },
    ]);
    expect(retryPlan(4)).toEqual({ delay: 60000, repair: true, alert: true });
    expect([5, 6, 7, 8].map((n) => retryPlan(n))).toEqual([120000, 240000, 300000, 300000].map((delay) => ({ delay, repair: true, alert: false })));
  });
});

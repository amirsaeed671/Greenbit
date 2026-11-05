import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetWrites, STUCK_MS, trackWrite, useWrites } from './pending';
import { GreenbitDB } from './db';
import { makeRepo } from './repo';

describe('write tracking', () => {
  afterEach(() => {
    vi.useRealTimers();
    _resetWrites();
  });

  it('counts writes until they commit', async () => {
    let done!: () => void;
    const w = trackWrite(new Promise<void>((r) => (done = r)));
    expect(useWrites.getState().pending).toBe(1);
    done();
    await w;
    expect(useWrites.getState()).toMatchObject({ pending: 0, stuck: false });
  });

  it('flags a write that waits too long, and clears it when it lands', async () => {
    vi.useFakeTimers();
    let done!: () => void;
    const w = trackWrite(new Promise<void>((r) => (done = r)));
    const { startWriteWatch } = await import('./pending');
    startWriteWatch();
    vi.advanceTimersByTime(STUCK_MS + 1000);
    expect(useWrites.getState().stuck).toBe(true);
    done();
    await w;
    expect(useWrites.getState()).toMatchObject({ pending: 0, stuck: false });
  });

  it('repo saves resolve only after the record and its clock are stored together', async () => {
    const db = new GreenbitDB('pending-test-' + Math.random());
    const repo = makeRepo(db);
    const id = await repo.addHabit({ name: 'Read', unit: 'pages', frequency: 'daily', minimum: 1, target: 2, stretch: 3, plant: 'daisy', createdAt: '2026-11-01' });
    const [habit, clock] = await Promise.all([db.habits.get(id), db.local.get('clock')]);
    expect(habit?.hlc).toBeTruthy();
    expect(clock).toBeTruthy();
    expect(useWrites.getState().pending).toBe(0);
  });
});

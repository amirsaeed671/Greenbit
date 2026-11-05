import { describe, expect, it } from 'vitest';
import { decode, encode, fromIso, receive, tick } from './hlc';

describe('hlc', () => {
  const c = { ms: 1000, counter: 0, device: 'a' };
  it('round-trips and sorts by time, then counter, then device', () => {
    expect(decode(encode(c))).toEqual(c);
    expect(encode({ ...c, ms: 999 }) < encode(c)).toBe(true);
    expect(encode(c) < encode({ ...c, counter: 1 })).toBe(true);
    expect(encode(c) < encode({ ...c, device: 'b' })).toBe(true);
    expect(encode({ ms: 9, counter: 0, device: 'z' }) < encode({ ms: 10, counter: 0, device: 'a' })).toBe(true);
  });
  it('tick never goes backwards when the wall clock does', () => {
    const t1 = tick(c, 2000);
    const t2 = tick(t1, 1500);
    expect(encode(t2) > encode(t1)).toBe(true);
  });
  it('receive moves past a remote stamp from the future', () => {
    const r = receive(c, encode({ ms: 5000, counter: 3, device: 'b' }), 1000);
    expect(r).toEqual({ ms: 5000, counter: 4, device: 'a' });
    expect(encode(tick(r, 1000)) > encode({ ms: 5000, counter: 3, device: 'b' })).toBe(true);
  });
  it('legacy stamps sort before real edits', () => {
    expect(fromIso('2024-01-01T00:00:00Z') < encode({ ms: Date.parse('2024-01-01T00:00:00Z'), counter: 0, device: 'x' })).toBe(true);
  });
});

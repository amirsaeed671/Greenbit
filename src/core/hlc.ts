/**
 * Hybrid logical clock. Timestamps are strings that sort lexicographically in
 * causal order across devices: `<ms base36, 9 chars>:<counter base36, 4>:<deviceId>`.
 * Used to decide which edit wins when two devices change the same record.
 */
export interface Clock {
  ms: number;
  counter: number;
  device: string;
}

const MS_LEN = 9;
const C_LEN = 4;

export function encode(c: Clock): string {
  return `${c.ms.toString(36).padStart(MS_LEN, '0')}:${c.counter.toString(36).padStart(C_LEN, '0')}:${c.device}`;
}

export function decode(s: string): Clock {
  const [ms, counter, ...rest] = s.split(':');
  return { ms: parseInt(ms, 36), counter: parseInt(counter, 36), device: rest.join(':') };
}

/** Local event: advance past wall clock and the last stamp. */
export function tick(last: Clock, now: number): Clock {
  if (now > last.ms) return { ms: now, counter: 0, device: last.device };
  return { ms: last.ms, counter: last.counter + 1, device: last.device };
}

/** Remote stamp observed: never fall behind it. */
export function receive(last: Clock, remote: string, now: number): Clock {
  const r = decode(remote);
  const ms = Math.max(last.ms, r.ms, now);
  let counter = 0;
  if (ms === last.ms && ms === r.ms) counter = Math.max(last.counter, r.counter) + 1;
  else if (ms === last.ms) counter = last.counter + 1;
  else if (ms === r.ms) counter = r.counter + 1;
  return { ms, counter, device: last.device };
}

/** Stamp for legacy records that only have an ISO time. Sorts before any real edit made at the same ms. */
export const fromIso = (iso: string | undefined, device = 'legacy') => encode({ ms: iso ? Date.parse(iso) || 0 : 0, counter: 0, device });

export const newer = (a: string | undefined, b: string | undefined) => (a ?? '') > (b ?? '');

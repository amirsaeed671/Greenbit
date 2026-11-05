import { create } from 'zustand';

/**
 * Tracks local writes that haven't committed yet. IndexedDB queues a write behind any
 * other transaction on the same tables, so if another Greenbit tab or window is stuck
 * mid-write (for example, a background tab the browser froze), our saves wait forever.
 * Without this, the app would look like it saved while nothing reached the disk,
 * and a reload would throw those changes away.
 */
interface WriteState {
  /** Writes started but not yet committed. */
  pending: number;
  /** A write has been waiting longer than STUCK_MS. */
  stuck: boolean;
}

export const STUCK_MS = 4000;
export const useWrites = create<WriteState>(() => ({ pending: 0, stuck: false }));

const started = new Map<number, number>();
let seq = 0;

function refresh(now = Date.now()) {
  const oldest = started.size ? Math.min(...started.values()) : null;
  const stuck = oldest !== null && now - oldest >= STUCK_MS;
  const s = useWrites.getState();
  if (s.pending !== started.size || s.stuck !== stuck) useWrites.setState({ pending: started.size, stuck });
}

export function trackWrite<T>(work: Promise<T>): Promise<T> {
  const id = ++seq;
  started.set(id, Date.now());
  refresh();
  return work.finally(() => {
    started.delete(id);
    refresh();
  });
}

let watching = false;
/** Re-evaluate "stuck" every second, and warn before leaving while writes are unsaved. */
export function startWriteWatch() {
  if (watching) return;
  watching = true;
  window.setInterval(() => refresh(), 1000);
  window.addEventListener('beforeunload', (e) => {
    if (!started.size) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/** Test helper. */
export function _resetWrites() {
  started.clear();
  useWrites.setState({ pending: 0, stuck: false });
}

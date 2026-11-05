import { create } from 'zustand';
import { db, SYNCED } from '../db/db';
import { repo } from '../db/repo';
import { b64u, deriveKeys, open, seal, type ChainKeys } from './crypto';
import { mergeStates, type SyncState } from './merge';

export interface DeviceInfo {
  name: string;
  lastSeen: string;
}
type RemoteState = SyncState & { devices?: Record<string, DeviceInfo> };

interface SyncConfig {
  seed: string; // base64url, device-local only
  deviceName: string;
  joinedAt: string;
}

interface SyncStatus {
  enabled: boolean;
  phase: 'off' | 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt?: string;
  error?: string;
  fingerprint?: string;
  devices: Record<string, DeviceInfo>;
  activity: SyncEvent[];
}

export const useSync = create<SyncStatus>(() => ({ enabled: false, phase: 'off', devices: {}, activity: [] }));

const CONFIG = 'sync:config';
const STATE = 'sync:state';
const ENDPOINT = '/api/sync';

let keys: ChainKeys | null = null;
let running: Promise<void> | null = null;
let again = false;

/** Highest clock stamp stored locally (each synced table is indexed by stamp). */
async function localMaxHlc(): Promise<string> {
  let max = '';
  for (const t of [...SYNCED, 'kv'] as const) {
    const top = (await db.table(t).orderBy('hlc').last()) as { hlc?: string } | undefined;
    if (top?.hlc && top.hlc > max) max = top.hlc;
  }
  return max;
}

export function defaultDeviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Brave/.test(ua) ? 'Brave' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${os}`;
}

async function getConfig(): Promise<SyncConfig | null> {
  return ((await db.local.get(CONFIG))?.value as SyncConfig | undefined) ?? null;
}

export async function getSeed(): Promise<Uint8Array | null> {
  const c = await getConfig();
  return c ? b64u.dec(c.seed) : null;
}

async function localState(): Promise<{ state: SyncState }> {
  const tables = Object.fromEntries(await Promise.all(SYNCED.map(async (t) => [t, await db.table(t).toArray()] as const))) as unknown as SyncState['tables'];
  const s = await db.kv.get('settings');
  return { state: { v: 1, at: new Date().toISOString(), tables, settings: s ? { value: s.value, hlc: s.hlc } : undefined } };
}

class SyncError extends Error {
  constructor(message: string, readonly retry: boolean) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Recent sync activity on this device (newest last), for Settings and bug reports. Never contains data. */
export interface SyncEvent {
  at: string;
  what: string;
}
const LOG = 'sync:log';
let activity: SyncEvent[] = [];
let logTimer = 0;
export function logSync(what: string) {
  activity = [...activity, { at: new Date().toISOString(), what }].slice(-40);
  useSync.setState({ activity });
  window.clearTimeout(logTimer);
  logTimer = window.setTimeout(() => void db.local.put({ key: LOG, value: activity }), 500);
}
const short = (etag: string | null | undefined) => (etag ? etag.replace(/"/g, '').slice(0, 6) : '-');
/** Randomised, growing wait between conflict retries, so two writers stop colliding. */
export const conflictBackoff = (attempt: number, rand = Math.random()) => Math.round(Math.min(4000, 300 * 2 ** attempt) * (0.5 + rand));

async function request(method: 'GET' | 'PUT' | 'DELETE', body?: unknown, etag?: string): Promise<Response> {
  if (!keys) throw new Error('Sync is not set up');
  const t0 = performance.now();
  const b = body as { ifMatch?: string | null; force?: boolean } | undefined;
  const res = await rawRequest(method, body, etag);
  logSync(`${method} ${res.status} ${Math.round(performance.now() - t0)}ms${etag ? ` if-none-match ${short(etag)}` : ''}${b ? (b.force ? ' force' : ` if-match ${b.ifMatch === null ? 'none' : short(b.ifMatch)}`) : ''}${res.headers.get('etag') ? ` → ${short(res.headers.get('etag'))}` : ''}`);
  return res;
}

function rawRequest(method: 'GET' | 'PUT' | 'DELETE', body?: unknown, etag?: string): Promise<Response> {
  return fetch(ENDPOINT, {
    method,
    headers: {
      authorization: `Bearer ${keys!.relayKey}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(etag && method === 'GET' ? { 'if-none-match': etag } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  }).catch(() => {
    throw new SyncError('Couldn’t reach the sync relay. Retrying automatically.', true);
  });
}

const MAX_ATTEMPTS = 6;

/**
 * One sync: pull, merge per record, push if this device has anything newer.
 * `force` (Repair): always pull the full copy and overwrite the relay with the merge,
 * even if another device wrote a moment ago. Nothing is dropped: the merge keeps the
 * newest version of every record from both sides.
 */
async function syncOnce(force = false): Promise<void> {
  const config = await getConfig();
  if (!config) return;
  keys ??= await deriveKeys(b64u.dec(config.seed));
  const saved = ((await db.local.get(STATE))?.value as { etag?: string; syncedHlc?: string } | undefined) ?? {};
  const me = await repo.deviceId();

  let rejected = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(conflictBackoff(attempt - 1));
    /*
     * After two rejected conditional writes, write the merge of the copy we just downloaded
     * unconditionally (what Repair does). Safe: every sync merges full state per record, so if
     * this overwrote a write that landed in the last instant, that device sees its records
     * missing on its next sync and sends them again. Nothing is lost; it just converges.
     */
    const forceThis = force || rejected >= 2;
    // Pending local changes = anything stamped after the last successful sync. Derived from the data,
    // so it survives reloads and closed tabs.
    const pending = forceThis || (await localMaxHlc()) > (saved.syncedHlc ?? '');
    // Ask "only if changed" when nothing local is pending; otherwise we need the full state to merge.
    const res = await request('GET', undefined, pending ? undefined : saved.etag);
    if (res.status !== 200 && res.status !== 304 && res.status !== 204) throw new SyncError(`The sync relay had a problem (${res.status}). Retrying automatically.`, true);

    let remote: RemoteState | null = null;
    let etag: string | null = null;
    if (res.status === 200) {
      const body = (await res.json()) as { etag: string; data: string };
      etag = body.etag;
      try {
        remote = await open<RemoteState>(keys.encKey, body.data);
      } catch {
        throw new SyncError('Could not decrypt the synced data. Is this the right sync code?', false);
      }
      // Move our clock past every remote stamp before snapshotting, so any edit made from here on sorts after them.
      let rmax = '';
      for (const t of SYNCED) for (const r of remote.tables[t] ?? []) if ((r.hlc ?? '') > rmax) rmax = r.hlc!;
      if (remote.settings?.hlc && remote.settings.hlc > rmax) rmax = remote.settings.hlc;
      if (rmax) await repo.observe(rmax);
    } else if (res.status === 304) {
      // Relay unchanged since our last merge and nothing local is pending.
      useSync.setState({ lastSyncedAt: new Date().toISOString() });
      return;
    }
    if (res.status === 200) logSync(`pulled ${short(etag)}${pending ? ' (local changes pending)' : ''}`);

    const { state: local } = await localState();
    const m = mergeStates(local, remote);

    // Apply what the other devices changed, without re-stamping.
    const touched = Object.keys(m.toLocal).length || Object.keys(m.purge).length || m.settingsToLocal;
    if (touched) {
      await db.transaction('rw', [...SYNCED.map((t) => db.table(t)), db.kv], async () => {
        for (const t of SYNCED) {
          if (m.toLocal[t]?.length) await db.table(t).bulkPut(m.toLocal[t]!);
          if (m.purge[t]?.length) await db.table(t).bulkDelete(m.purge[t]!);
        }
        if (m.settingsToLocal) await db.kv.put({ key: 'settings', value: m.settingsToLocal.value, hlc: m.settingsToLocal.hlc });
      });
    }
    if (m.maxHlc) await repo.observe(m.maxHlc);

    // Keep a small device list so each device can show who else is syncing.
    const devices: Record<string, DeviceInfo> = { ...(remote?.devices ?? {}) };
    const mine = devices[me];
    const stale = !mine || mine.name !== config.deviceName || Date.now() - Date.parse(mine.lastSeen) > 86400000;
    if (stale) devices[me] = { name: config.deviceName, lastSeen: new Date().toISOString() };

    const applied = Object.values(m.toLocal).reduce((n, xs) => n + (xs?.length ?? 0), 0);
    if (applied) logSync(`applied ${applied} change${applied === 1 ? '' : 's'} from other devices`);
    if (m.remoteChanged || stale || res.status === 204 || forceThis) {
      const sealed = await seal(keys.encKey, { ...m.state, devices } satisfies RemoteState);
      const put = await request('PUT', forceThis ? { data: sealed, force: true } : { data: sealed, ifMatch: res.status === 204 ? null : etag });
      if (put.status === 412) {
        rejected++;
        continue; // another device wrote first: wait a moment, pull and merge again
      }
      if (put.status === 413) throw new SyncError('Your data is too large to sync (over 4 MB compressed).', false);
      if (!put.ok) throw new SyncError(`The sync relay had a problem (${put.status}). Retrying automatically.`, true);
      etag = ((await put.json()) as { etag: string }).etag;
    }
    // Everything up to the merged snapshot is now on the relay.
    await db.local.put({ key: STATE, value: { etag, syncedHlc: m.maxHlc > (saved.syncedHlc ?? '') ? m.maxHlc : saved.syncedHlc } });
    useSync.setState({ lastSyncedAt: new Date().toISOString(), devices, error: undefined });
    return;
  }
  throw new SyncError('Couldn’t save to the sync relay. Retrying automatically, or use Repair sync.', true);
}

let retryTimer = 0;
let retryCount = 0;
/** After a transient failure, really retry: 15 s, 30 s, 1 min, 2 min, then every 5 min. */
export const retryDelay = (n: number) => Math.min(300000, 15000 * 2 ** n);

let lastAttempt = 0;

/** Run a sync now (coalesces concurrent calls). */
export function syncNow(force = false): Promise<void> {
  lastAttempt = Date.now();
  if (running) {
    again = true;
    return running;
  }
  if (!navigator.onLine) {
    useSync.setState({ phase: 'offline' });
    return Promise.resolve();
  }
  window.clearTimeout(retryTimer);
  useSync.setState({ phase: 'syncing' });
  // Only one tab or window per device syncs at a time (installed app + browser tab share the data).
  const locked = (fn: () => Promise<void>) => (navigator.locks ? navigator.locks.request('greenbit-sync', fn) : fn());
  running = locked(() => syncOnce(force))
    .then(() => {
      retryCount = 0;
      useSync.setState({ phase: 'idle', error: undefined });
    })
    .catch((e: Error) => {
      logSync(`error: ${e.message}`);
      useSync.setState({ phase: 'error', error: e.message });
      if (!(e instanceof SyncError) || e.retry) retryTimer = window.setTimeout(() => void syncNow(), retryDelay(retryCount++));
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

export async function enableSync(seed: Uint8Array, deviceName = defaultDeviceName()) {
  await db.local.put({ key: CONFIG, value: { seed: b64u.enc(seed), deviceName, joinedAt: new Date().toISOString() } satisfies SyncConfig });
  await db.local.delete(STATE);
  keys = await deriveKeys(seed);
  useSync.setState({ enabled: true, phase: 'idle', fingerprint: keys.fingerprint, error: undefined, devices: {} });
  await syncNow();
}

export async function renameDevice(name: string) {
  const c = await getConfig();
  if (!c) return;
  await db.local.put({ key: CONFIG, value: { ...c, deviceName: name.trim() || defaultDeviceName() } });
  void syncNow();
}

export async function getDeviceName() {
  return (await getConfig())?.deviceName ?? defaultDeviceName();
}

/** Pull the full relay copy, merge everything and overwrite the relay with the result. */
export function repairSync(): Promise<void> {
  return syncNow(true);
}

/** This device stops syncing. Its data stays; the chain and other devices are untouched. */
export async function leaveSync() {
  window.clearTimeout(retryTimer);
  await db.local.bulkDelete([CONFIG, STATE]);
  keys = null;
  useSync.setState({ enabled: false, phase: 'off', lastSyncedAt: undefined, error: undefined, fingerprint: undefined, devices: {} });
}

/** Delete the encrypted copy from the relay, then leave. Devices still in the chain will upload it again. */
export async function deleteRemoteAndLeave() {
  if (keys) await request('DELETE');
  await leaveSync();
}

/**
 * Background check for other devices' changes while the app is visible: every 5 minutes,
 * to keep relay reads (Vercel Blob operations) low. Never while the app is hidden.
 */
export const POLL_MS = 5 * 60000;
/** Event-driven checks (focus, returning to the app) are limited to one per minute. */
export const EVENT_GAP_MS = 60000;

/**
 * Wire up automatic syncing: on start, a few seconds after local edits, when the window
 * regains focus or the user returns after a pause, when back online, and on an adaptive poll.
 */
export function startSyncEngine(): () => void {
  let debounce = 0;
  let poll = 0;
  let lastActivity = Date.now();
  const enabled = () => useSync.getState().enabled;
  const visible = () => document.visibilityState === 'visible';

  void (async () => {
    activity = ((await db.local.get(LOG))?.value as SyncEvent[] | undefined) ?? [];
    useSync.setState({ activity });
    const c = await getConfig();
    if (!c) return;
    keys = await deriveKeys(b64u.dec(c.seed));
    useSync.setState({ enabled: true, phase: 'idle', fingerprint: keys.fingerprint });
    void syncNow();
  })();

  const schedule = () => {
    window.clearTimeout(poll);
    poll = window.setTimeout(() => {
      if (enabled() && visible() && Date.now() - lastAttempt >= 5000) void syncNow();
      schedule();
    }, POLL_MS);
  };
  schedule();

  /** Check now if it's been a while, e.g. on focus or the first tap after a pause. */
  const freshen = (minGap: number) => {
    if (enabled() && visible() && Date.now() - lastAttempt > minGap) void syncNow();
  };

  const off = repo.onChange(() => {
    if (!enabled()) return;
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 3000);
  });
  // Coming back to the app (first tap after a pause, focusing the window, showing the tab) pulls the latest.
  const onActivity = () => {
    const wasIdle = Date.now() - lastActivity > EVENT_GAP_MS;
    lastActivity = Date.now();
    if (wasIdle) freshen(EVENT_GAP_MS);
  };
  const onVisibility = () => {
    if (visible()) {
      lastActivity = Date.now();
      freshen(EVENT_GAP_MS);
    } else if (enabled()) void syncNow(); // flush pending edits when hidden or closing
  };
  const onFocus = () => {
    lastActivity = Date.now();
    freshen(EVENT_GAP_MS);
  };
  const onOnline = () => enabled() && void syncNow();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const) window.addEventListener(ev, onActivity, { passive: true });
  return () => {
    off();
    window.clearTimeout(debounce);
    window.clearTimeout(poll);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const) window.removeEventListener(ev, onActivity);
  };
}

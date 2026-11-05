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
}

export const useSync = create<SyncStatus>(() => ({ enabled: false, phase: 'off', devices: {} }));

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

async function request(method: 'GET' | 'PUT' | 'DELETE', body?: unknown, etag?: string): Promise<Response> {
  if (!keys) throw new Error('Sync is not set up');
  return fetch(ENDPOINT, {
    method,
    headers: {
      authorization: `Bearer ${keys.relayKey}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(etag && method === 'GET' ? { 'if-none-match': etag } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
}

async function syncOnce(): Promise<void> {
  const config = await getConfig();
  if (!config) return;
  keys ??= await deriveKeys(b64u.dec(config.seed));
  const saved = ((await db.local.get(STATE))?.value as { etag?: string; syncedHlc?: string } | undefined) ?? {};
  const me = await repo.deviceId();

  for (let attempt = 0; attempt < 4; attempt++) {
    // Pending local changes = anything stamped after the last successful sync. Derived from the data,
    // so it survives reloads and closed tabs.
    const pending = (await localMaxHlc()) > (saved.syncedHlc ?? '');
    // Ask "only if changed" when nothing local is pending; otherwise we need the full state to merge.
    const res = await request('GET', undefined, pending ? undefined : saved.etag);
    if (res.status !== 200 && res.status !== 304 && res.status !== 204) throw new Error(`Relay error ${res.status}`);

    let remote: RemoteState | null = null;
    let etag: string | null = null;
    if (res.status === 200) {
      const body = (await res.json()) as { etag: string; data: string };
      etag = body.etag;
      try {
        remote = await open<RemoteState>(keys.encKey, body.data);
      } catch {
        throw new Error('Could not decrypt the synced data. Is this the right sync code?');
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

    if (m.remoteChanged || stale || res.status === 204) {
      const sealed = await seal(keys.encKey, { ...m.state, devices } satisfies RemoteState);
      const put = await request('PUT', { data: sealed, ifMatch: res.status === 204 ? null : etag });
      if (put.status === 412) continue; // another device wrote first: pull and merge again
      if (put.status === 413) throw new Error('Your data is too large to sync (over 4 MB compressed).');
      if (!put.ok) throw new Error(`Relay error ${put.status}`);
      etag = ((await put.json()) as { etag: string }).etag;
    }
    // Everything up to the merged snapshot is now on the relay.
    await db.local.put({ key: STATE, value: { etag, syncedHlc: m.maxHlc > (saved.syncedHlc ?? '') ? m.maxHlc : saved.syncedHlc } });
    useSync.setState({ lastSyncedAt: new Date().toISOString(), devices, error: undefined });
    return;
  }
  throw new Error('Too many conflicting writes; will retry shortly');
}

/** Run a sync now (coalesces concurrent calls). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  if (!navigator.onLine) {
    useSync.setState({ phase: 'offline' });
    return Promise.resolve();
  }
  useSync.setState({ phase: 'syncing' });
  running = syncOnce()
    .then(() => useSync.setState({ phase: 'idle' }))
    .catch((e: Error) => useSync.setState({ phase: 'error', error: e.message }))
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

/** This device stops syncing. Its data stays; the chain and other devices are untouched. */
export async function leaveSync() {
  await db.local.bulkDelete([CONFIG, STATE]);
  keys = null;
  useSync.setState({ enabled: false, phase: 'off', lastSyncedAt: undefined, error: undefined, fingerprint: undefined, devices: {} });
}

/** Delete the encrypted copy from the relay, then leave. Devices still in the chain will upload it again. */
export async function deleteRemoteAndLeave() {
  if (keys) await request('DELETE');
  await leaveSync();
}

const FIVE_MIN = 5 * 60000;

/** Wire up automatic syncing: on start, after local edits, on focus, when back online, and every 5 minutes while visible. */
export function startSyncEngine(): () => void {
  let debounce = 0;
  let interval = 0;
  void (async () => {
    const c = await getConfig();
    if (!c) return;
    keys = await deriveKeys(b64u.dec(c.seed));
    useSync.setState({ enabled: true, phase: 'idle', fingerprint: keys.fingerprint });
    void syncNow();
  })();
  const off = repo.onChange(() => {
    if (!useSync.getState().enabled) return;
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 3000);
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible' && useSync.getState().enabled) void syncNow();
  };
  const onOnline = () => useSync.getState().enabled && void syncNow();
  const onHide = () => {
    // Flush pending edits when the tab is hidden or closed.
    if (document.visibilityState === 'hidden' && useSync.getState().enabled) void syncNow();
  };
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('online', onOnline);
  interval = window.setInterval(() => document.visibilityState === 'visible' && useSync.getState().enabled && void syncNow(), FIVE_MIN);
  return () => {
    off();
    window.clearTimeout(debounce);
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('online', onOnline);
  };
}

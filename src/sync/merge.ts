import { newer } from '../core/hlc';
import type { SyncMeta } from '../core/types';
import { SYNCED, type SyncedTable } from '../db/db';

type Rec = { id: string } & SyncMeta;

/** What the relay stores (encrypted): every record, including recent tombstones. */
export interface SyncState {
  v: 1;
  at: string;
  tables: Record<SyncedTable, Rec[]>;
  settings?: { value: unknown; hlc?: string };
}

export const TOMBSTONE_TTL_DAYS = 60;

export interface MergeResult {
  state: SyncState;
  /** Records the local device must store (remote won). */
  toLocal: Partial<Record<SyncedTable, Rec[]>>;
  settingsToLocal?: { value: unknown; hlc?: string };
  /** Tombstones old enough to forget everywhere. */
  purge: Partial<Record<SyncedTable, string[]>>;
  /** True when the merged state differs from what the relay has (needs upload). */
  remoteChanged: boolean;
  /** Highest stamp seen, so the local clock can move past it. */
  maxHlc: string;
}

export function emptyState(): SyncState {
  return { v: 1, at: new Date(0).toISOString(), tables: Object.fromEntries(SYNCED.map((t) => [t, []])) as unknown as SyncState['tables'] };
}

/** Per-record last-writer-wins on clock stamps; equal stamps are the same version. */
export function mergeStates(local: SyncState, remote: SyncState | null, now = Date.now()): MergeResult {
  const r = remote ?? emptyState();
  const cutoff = new Date(now - TOMBSTONE_TTL_DAYS * 86400000).toISOString();
  const out = emptyState();
  const toLocal: MergeResult['toLocal'] = {};
  const purge: MergeResult['purge'] = {};
  let remoteChanged = !remote;
  let maxHlc = '';

  for (const t of SYNCED) {
    const lmap = new Map((local.tables[t] ?? []).map((x) => [x.id, x]));
    const rmap = new Map((r.tables[t] ?? []).map((x) => [x.id, x]));
    for (const id of new Set([...lmap.keys(), ...rmap.keys()])) {
      const l = lmap.get(id);
      const rr = rmap.get(id);
      const win = !l ? rr! : !rr ? l : newer(rr.hlc, l.hlc) ? rr : l;
      if ((win.hlc ?? '') > maxHlc) maxHlc = win.hlc ?? '';
      if (win.deletedAt && win.deletedAt < cutoff) {
        (purge[t] ??= []).push(id);
        if (rr) remoteChanged = true;
        continue;
      }
      out.tables[t].push(win);
      if (win === rr && (!l || newer(rr.hlc, l.hlc))) (toLocal[t] ??= []).push(rr);
      if (win === l && (!rr || newer(l.hlc, rr.hlc))) remoteChanged = true;
    }
  }

  const ls = local.settings;
  const rs = r.settings;
  let settingsToLocal: MergeResult['settingsToLocal'];
  if (rs && (!ls || newer(rs.hlc, ls.hlc))) {
    out.settings = rs;
    settingsToLocal = rs;
  } else if (ls) {
    out.settings = ls;
    if (!rs || newer(ls.hlc, rs.hlc)) remoteChanged = true;
  }
  out.at = new Date(now).toISOString();
  return { state: out, toLocal, settingsToLocal, purge, remoteChanged, maxHlc };
}

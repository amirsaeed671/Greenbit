import { z } from 'zod';
import { isValidDateStr } from './dates';
import type { Entry, Habit, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export const APP_ID = 'greenbit';
/** Files exported by the earlier "habit-garden" working name are accepted too. */
const ACCEPTED_APP_IDS = [APP_ID, 'habit-garden'];
export const BACKUP_VERSION = 1;

const dateStr = z.string().refine(isValidDateStr, 'must be a YYYY-MM-DD date');

const habitSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    unit: z.string(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    minimum: z.number().positive(),
    target: z.number().positive(),
    stretch: z.number().positive(),
    plant: z.string(),
    createdAt: dateStr,
    archivedAt: dateStr.optional(),
    updatedAt: z.string().optional(),
  })
  .refine((h) => h.minimum <= h.target && h.target <= h.stretch, 'thresholds must satisfy minimum <= target <= stretch');

const entrySchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  date: dateStr,
  volume: z.number().positive(),
  note: z.string().optional(),
  updatedAt: z.string().optional(),
});

const settingsSchema = z
  .object({
    weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
    calendarMode: z.enum(['per-habit', 'combined']).optional(),
    lastExportAt: z.string().optional(),
    reminderDismissedAt: z.string().optional(),
  })
  .partial();

const backupSchema = z.object({
  app: z.string().refine((a) => ACCEPTED_APP_IDS.includes(a), 'not a Greenbit backup'),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  settings: settingsSchema,
  habits: z.array(habitSchema),
  entries: z.array(entrySchema),
});

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  settings: Settings;
  habits: Habit[];
  entries: Entry[];
}

export function buildExport(settings: Settings, habits: Habit[], entries: Entry[], now = new Date()): BackupFile {
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings, habits, entries };
}

export const exportFileName = (date: string) => `greenbit-${date}.json`;

/** Upgrade older backup shapes to the current version. Add a case per future schema change. */
export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  const version = Number(data.version);
  // if (version === 1) { data = { ...data, version: 2, ... }; }
  return { ...data, version };
}

export type ImportResult = { ok: true; data: BackupFile } | { ok: false; error: string };

export function validateImport(text: string): ImportResult {
  if (!text.trim()) return { ok: false, error: 'The file is empty.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'The file is not a Greenbit backup.' };
  const version = Number((raw as { version?: unknown }).version);
  if (Number.isFinite(version) && version > BACKUP_VERSION) {
    return { ok: false, error: `This backup is from a newer version of Greenbit (v${version}). Update the app and try again.` };
  }
  const parsed = backupSchema.safeParse(migrate(raw as Record<string, unknown>));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Invalid backup: ${issue.path.join('.') || 'file'} ${issue.message}.` };
  }
  const habitIds = new Set(parsed.data.habits.map((h) => h.id));
  const orphan = parsed.data.entries.find((e) => !habitIds.has(e.habitId));
  if (orphan) return { ok: false, error: `Invalid backup: entry ${orphan.id} refers to a missing habit.` };
  return { ok: true, data: { ...parsed.data, settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings } } as BackupFile };
}

const newer = <T extends { updatedAt?: string }>(local: T, incoming: T) =>
  (incoming.updatedAt ?? '') > (local.updatedAt ?? '') ? incoming : local;

/** Merge by id. On conflict the record with the later `updatedAt` wins; ties keep local. */
export function mergeData(
  local: { habits: Habit[]; entries: Entry[] },
  incoming: { habits: Habit[]; entries: Entry[] },
): { habits: Habit[]; entries: Entry[] } {
  const merge = <T extends { id: string; updatedAt?: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((x) => [x.id, x]));
    for (const x of b) map.set(x.id, map.has(x.id) ? newer(map.get(x.id)!, x) : x);
    return [...map.values()];
  };
  return { habits: merge(local.habits, incoming.habits), entries: merge(local.entries, incoming.entries) };
}

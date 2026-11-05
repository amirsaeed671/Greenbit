import { z } from 'zod';
import { isValidDateStr } from './dates';
import { fromIso, newer as newerHlc } from './hlc';
import type { Entry, Goal, Habit, Label, Note, Project, Settings, Task } from './types';
import { DEFAULT_SETTINGS } from './types';

export const APP_ID = 'greenbit';
/** Files exported by the earlier "habit-garden" working name are accepted too. */
const ACCEPTED_APP_IDS = [APP_ID, 'habit-garden'];
export const BACKUP_VERSION = 2;

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
    hlc: z.string().optional(),
  })
  .refine((h) => h.minimum <= h.target && h.target <= h.stretch, 'thresholds must satisfy minimum <= target <= stretch');

const entrySchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  date: dateStr,
  volume: z.number().positive(),
  note: z.string().optional(),
  updatedAt: z.string().optional(),
  hlc: z.string().optional(),
});

const meta = { updatedAt: z.string().optional(), hlc: z.string().optional() };
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'must be HH:mm');

const projectSchema = z.object({ id: z.string().min(1), name: z.string().min(1), color: z.string(), order: z.number(), archivedAt: z.string().optional(), ...meta });
const labelSchema = z.object({ id: z.string().min(1), name: z.string().min(1), color: z.string(), ...meta });
const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive(),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  fromCompletion: z.boolean().optional(),
  until: dateStr.optional(),
});
const reminderSchema = z.union([
  z.object({ id: z.string(), type: z.literal('absolute'), at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) }),
  z.object({ id: z.string(), type: z.literal('relative'), minutesBefore: z.number().int().min(0) }),
]);
const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  labels: z.array(z.string()),
  dueDate: dateStr.optional(),
  dueTime: timeStr.optional(),
  recurrence: recurrenceSchema.optional(),
  reminders: z.array(reminderSchema),
  completedAt: z.string().optional(),
  completions: z.array(dateStr).optional(),
  order: z.number(),
  createdAt: dateStr,
  ...meta,
});
const noteSchema = z.object({ id: z.string().min(1), title: z.string(), body: z.string(), pinned: z.boolean(), projectId: z.string().optional(), labels: z.array(z.string()), createdAt: z.string(), ...meta });
const goalSchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['total', 'streak', 'met']),
  target: z.number().positive(),
  startDate: dateStr,
  deadline: dateStr.optional(),
  milestones: z.array(z.number().positive()),
  createdAt: z.string(),
  ...meta,
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
  projects: z.array(projectSchema),
  labels: z.array(labelSchema),
  tasks: z.array(taskSchema),
  notes: z.array(noteSchema),
  goals: z.array(goalSchema),
});

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  settings: Settings;
  habits: Habit[];
  entries: Entry[];
  projects: Project[];
  labels: Label[];
  tasks: Task[];
  notes: Note[];
  goals: Goal[];
}

export type BackupData = Pick<BackupFile, 'habits' | 'entries' | 'projects' | 'labels' | 'tasks' | 'notes' | 'goals'>;
export const emptyData = (): BackupData => ({ habits: [], entries: [], projects: [], labels: [], tasks: [], notes: [], goals: [] });

/** Exported files never carry tombstones. */
export function buildExport(settings: Settings, data: Partial<BackupData>, now = new Date()): BackupFile {
  const live = <T extends { deletedAt?: string }>(xs: T[] = []) => xs.filter((x) => !x.deletedAt).map(({ deletedAt: _d, ...x }) => x as T);
  const d = { ...emptyData(), ...data };
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings,
    habits: live(d.habits),
    entries: live(d.entries),
    projects: live(d.projects),
    labels: live(d.labels),
    tasks: live(d.tasks),
    notes: live(d.notes),
    goals: live(d.goals),
  };
}

export const exportFileName = (date: string) => `greenbit-${date}.json`;

/** Upgrade older backup shapes to the current version. Add a case per future schema change. */
export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  let out: Record<string, unknown> = { ...data, version: Number(data.version) };
  if (out.version === 1) {
    // v2 added tasks, notes, goals and clock stamps.
    const stampAll = (xs: unknown) => (Array.isArray(xs) ? xs.map((x: Record<string, string | undefined>) => ({ ...x, hlc: x?.hlc ?? fromIso(x?.updatedAt) })) : xs);
    out = { ...emptyData(), ...out, habits: stampAll(out.habits), entries: stampAll(out.entries), version: 2 };
  }
  return out;
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
  const orphanGoal = parsed.data.goals.find((g) => !habitIds.has(g.habitId));
  if (orphanGoal) return { ok: false, error: `Invalid backup: goal ${orphanGoal.id} refers to a missing habit.` };
  return { ok: true, data: { ...parsed.data, settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings } } as BackupFile };
}

const stampOf = (x: { hlc?: string; updatedAt?: string }) => x.hlc ?? fromIso(x.updatedAt);

/** Merge two record lists by id. The later clock stamp wins; ties keep local. */
export function mergeRecords<T extends { id: string; hlc?: string; updatedAt?: string }>(local: T[], incoming: T[]): T[] {
  const map = new Map(local.map((x) => [x.id, x]));
  for (const x of incoming) {
    const cur = map.get(x.id);
    if (!cur || newerHlc(stampOf(x), stampOf(cur))) map.set(x.id, x);
  }
  return [...map.values()];
}

export function mergeData(local: Partial<BackupData>, incoming: Partial<BackupData>): BackupData {
  const a = { ...emptyData(), ...local };
  const b = { ...emptyData(), ...incoming };
  return {
    habits: mergeRecords(a.habits, b.habits),
    entries: mergeRecords(a.entries, b.entries),
    projects: mergeRecords(a.projects, b.projects),
    labels: mergeRecords(a.labels, b.labels),
    tasks: mergeRecords(a.tasks, b.tasks),
    notes: mergeRecords(a.notes, b.notes),
    goals: mergeRecords(a.goals, b.goals),
  };
}

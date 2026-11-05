export type Frequency = 'daily' | 'weekly' | 'monthly';
export type WeekStart = 0 | 1;
export type Tier = 'none' | 'below' | 'minimum' | 'target' | 'stretch';
export type PeriodStatus = 'met' | 'missed' | 'pending' | 'future' | 'n/a';

/** Every synced record carries a clock stamp and, once deleted, a tombstone. */
export interface SyncMeta {
  hlc?: string;
  deletedAt?: string;
}

export interface Habit extends SyncMeta {
  id: string;
  name: string;
  unit: string;
  frequency: Frequency;
  minimum: number;
  target: number;
  stretch: number;
  plant: string;
  createdAt: string; // YYYY-MM-DD
  archivedAt?: string;
  updatedAt?: string; // ISO timestamp, used only to resolve import conflicts
}

export interface Entry extends SyncMeta {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD, local
  volume: number;
  note?: string;
  updatedAt?: string;
}

export interface Settings {
  weekStartsOn: WeekStart;
  calendarMode: 'per-habit' | 'combined';
  lastExportAt?: string;
  reminderDismissedAt?: string;
}

export interface Period {
  start: string;
  end: string;
  key: string;
}

export const DEFAULT_SETTINGS: Settings = { weekStartsOn: 1, calendarMode: 'per-habit' };

/* ---------------- tasks, notes, goals ---------------- */

/** 1 = highest (red), 4 = none, as in Todoist. */
export type Priority = 1 | 2 | 3 | 4;

export interface Project extends SyncMeta {
  id: string;
  name: string;
  color: string;
  order: number;
  archivedAt?: string;
  updatedAt?: string;
}

export interface Label extends SyncMeta {
  id: string;
  name: string;
  color: string;
  updatedAt?: string;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number; // every N units
  byWeekday?: number[]; // weekly only, 0 = Sunday
  /** Todoist's "every!": next due counts from the completion date, not the old due date. */
  fromCompletion?: boolean;
  until?: string;
}

export type Reminder =
  | { id: string; type: 'absolute'; at: string } // local 'YYYY-MM-DDTHH:mm'
  | { id: string; type: 'relative'; minutesBefore: number }; // needs a due time

export interface Task extends SyncMeta {
  id: string;
  title: string;
  description?: string; // markdown
  projectId?: string; // undefined = Inbox
  priority: Priority;
  labels: string[]; // label ids
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  recurrence?: Recurrence;
  reminders: Reminder[];
  completedAt?: string; // ISO; set only for non-recurring tasks
  completions?: string[]; // YYYY-MM-DD each time a recurring task was completed
  order: number;
  createdAt: string; // YYYY-MM-DD
  updatedAt?: string;
}

export interface Note extends SyncMeta {
  id: string;
  title: string;
  body: string; // markdown
  pinned: boolean;
  projectId?: string;
  labels: string[];
  createdAt: string; // ISO
  updatedAt?: string;
}

export type GoalKind = 'total' | 'streak' | 'met';

export interface Goal extends SyncMeta {
  id: string;
  habitId: string;
  title: string;
  kind: GoalKind; // total volume, a streak length, or number of periods met
  target: number;
  startDate: string; // YYYY-MM-DD; totals and met-counts start here
  deadline?: string;
  milestones: number[]; // ascending values below target
  createdAt: string;
  updatedAt?: string;
}

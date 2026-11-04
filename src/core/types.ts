export type Frequency = 'daily' | 'weekly' | 'monthly';
export type WeekStart = 0 | 1;
export type Tier = 'none' | 'below' | 'minimum' | 'target' | 'stretch';
export type PeriodStatus = 'met' | 'missed' | 'pending' | 'future' | 'n/a';

export interface Habit {
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

export interface Entry {
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

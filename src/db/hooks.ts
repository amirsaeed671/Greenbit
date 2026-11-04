import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry, Habit, Settings } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { db } from './db';
import { repo } from './repo';

const EMPTY_H: Habit[] = [];
const EMPTY_E: Entry[] = [];

export interface GardenData {
  loaded: boolean;
  habits: Habit[]; // all, including archived
  active: Habit[];
  entries: Entry[];
  settings: Settings;
}

export function useGardenData(): GardenData {
  const habits = useLiveQuery(() => db.habits.toArray(), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const all = habits ?? EMPTY_H;
  return {
    loaded: habits !== undefined && entries !== undefined && settings !== undefined,
    habits: all,
    active: all.filter((h) => !h.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)),
    entries: entries ?? EMPTY_E,
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

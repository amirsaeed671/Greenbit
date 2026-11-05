import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { Entry, Goal, Habit, Label, Note, Project, Settings, SyncMeta, Task } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { db, type SyncedTable } from './db';
import { repo } from './repo';

const EMPTY: never[] = [];

/** Live, non-deleted rows of a synced table. */
export function useTable<T extends SyncMeta>(table: SyncedTable): T[] | undefined {
  return useLiveQuery(() => db.table(table).filter((r: SyncMeta) => !r.deletedAt).toArray() as Promise<T[]>, [table]);
}

export function useSettings(): Settings {
  return useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
}

export interface GardenData {
  loaded: boolean;
  habits: Habit[]; // all, including archived
  active: Habit[];
  entries: Entry[];
  goals: Goal[];
  settings: Settings;
}

export function useGardenData(): GardenData {
  const habits = useTable<Habit>('habits');
  const entries = useTable<Entry>('entries');
  const goals = useTable<Goal>('goals');
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const all = habits ?? EMPTY;
  const active = useMemo(() => all.filter((h) => !h.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)), [all]);
  return {
    loaded: habits !== undefined && entries !== undefined && settings !== undefined,
    habits: all,
    active,
    entries: entries ?? EMPTY,
    goals: goals ?? EMPTY,
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

export interface TaskData {
  loaded: boolean;
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  settings: Settings;
}

export function useTaskData(): TaskData {
  const tasks = useTable<Task>('tasks');
  const projects = useTable<Project>('projects');
  const labels = useTable<Label>('labels');
  const settings = useSettings();
  const sortedProjects = useMemo(() => [...(projects ?? EMPTY)].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [projects]);
  const sortedLabels = useMemo(() => [...(labels ?? EMPTY)].sort((a, b) => a.name.localeCompare(b.name)), [labels]);
  return { loaded: tasks !== undefined && projects !== undefined, tasks: tasks ?? EMPTY, projects: sortedProjects, labels: sortedLabels, settings };
}

export function useNotes(): { loaded: boolean; notes: Note[] } {
  const notes = useTable<Note>('notes');
  return { loaded: notes !== undefined, notes: notes ?? EMPTY };
}

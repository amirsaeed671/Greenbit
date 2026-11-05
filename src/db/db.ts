import Dexie, { type Table } from 'dexie';
import { fromIso } from '../core/hlc';
import type { Entry, Goal, Habit, Label, Note, Project, Task } from '../core/types';

export interface KV {
  key: string;
  value: unknown;
  hlc?: string;
}

/** Tables whose records sync between devices. */
export const SYNCED = ['habits', 'entries', 'projects', 'labels', 'tasks', 'notes', 'goals'] as const;
export type SyncedTable = (typeof SYNCED)[number];

export class GreenbitDB extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  projects!: Table<Project, string>;
  labels!: Table<Label, string>;
  tasks!: Table<Task, string>;
  notes!: Table<Note, string>;
  goals!: Table<Goal, string>;
  /** Synced key/value records (settings). */
  kv!: Table<KV, string>;
  /** Device-only state: device id, clock, sync cursors, fired reminders. Never synced or exported. */
  local!: Table<KV, string>;

  constructor(name = 'greenbit') {
    super(name);
    this.version(1).stores({
      habits: 'id, frequency, archivedAt',
      entries: 'id, habitId, date, [habitId+date]',
      kv: 'key',
    });
    this.version(2)
      .stores({
        habits: 'id, frequency, archivedAt, hlc',
        entries: 'id, habitId, date, [habitId+date], hlc',
        projects: 'id, hlc',
        labels: 'id, hlc',
        tasks: 'id, projectId, dueDate, hlc',
        notes: 'id, hlc',
        goals: 'id, habitId, hlc',
        kv: 'key, hlc',
        local: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('habits').toCollection().modify((h: Habit) => { h.hlc ??= fromIso(h.updatedAt); });
        await tx.table('entries').toCollection().modify((e: Entry) => { e.hlc ??= fromIso(e.updatedAt); });
        await tx.table('kv').toCollection().modify((r: KV) => { r.hlc ??= fromIso(undefined); });
      });
  }
}

export const db = new GreenbitDB();

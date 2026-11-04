import Dexie, { type Table } from 'dexie';
import type { Entry, Habit } from '../core/types';

export interface KV {
  key: string;
  value: unknown;
}

export class GreenbitDB extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  kv!: Table<KV, string>;

  constructor(name = 'greenbit') {
    super(name);
    this.version(1).stores({
      habits: 'id, frequency, archivedAt',
      entries: 'id, habitId, date, [habitId+date]',
      kv: 'key',
    });
  }
}

export const db = new GreenbitDB();

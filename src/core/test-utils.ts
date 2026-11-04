import type { Entry, Habit } from './types';

let n = 0;
export function habit(over: Partial<Habit> = {}): Habit {
  return { id: 'h1', name: 'Read', unit: 'pages', frequency: 'daily', minimum: 10, target: 20, stretch: 40, plant: 'fern', createdAt: '2024-01-01', ...over };
}
export function entry(date: string, volume: number, habitId = 'h1'): Entry {
  return { id: `e${++n}`, habitId, date, volume };
}

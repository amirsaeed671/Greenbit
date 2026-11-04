import type { Entry, Habit, Period, Tier } from './types';

export const TIERS: Tier[] = ['none', 'below', 'minimum', 'target', 'stretch'];
export const tierIndex = (t: Tier) => TIERS.indexOf(t);

export function volumeForPeriod(entries: Entry[], habitId: string, period: Period): number {
  let sum = 0;
  for (const e of entries) {
    if (e.habitId === habitId && e.date >= period.start && e.date <= period.end) sum += e.volume;
  }
  return sum;
}

export function volumeForDay(entries: Entry[], habitId: string, date: string): number {
  return volumeForPeriod(entries, habitId, { start: date, end: date, key: date });
}

export function tierForVolume(volume: number, habit: Pick<Habit, 'minimum' | 'target' | 'stretch'>): Tier {
  if (volume <= 0) return 'none';
  if (volume < habit.minimum) return 'below';
  if (volume < habit.target) return 'minimum';
  if (volume < habit.stretch) return 'target';
  return 'stretch';
}

import { maxDate, minDate } from './dates';
import { periodOf, periodsBetween } from './periods';
import { periodStatusFromVolume } from './status';
import type { Entry, Habit, Period, PeriodStatus, Tier, WeekStart } from './types';
import { tierForVolume } from './volume';

export interface PeriodRecord {
  period: Period;
  volume: number;
  status: PeriodStatus;
  tier: Tier;
}

/** Sum of volume per period key, for one habit. */
export function volumeByPeriod(habit: Habit, entries: Entry[], weekStartsOn: WeekStart): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.habitId !== habit.id) continue;
    const k = periodOf(e.date, habit.frequency, weekStartsOn).key;
    map.set(k, (map.get(k) ?? 0) + e.volume);
  }
  return map;
}

/** Every period from the habit's creation through today (or archive date), oldest first. */
export function habitHistory(habit: Habit, entries: Entry[], today: string, weekStartsOn: WeekStart): PeriodRecord[] {
  const vols = volumeByPeriod(habit, entries, weekStartsOn);
  const end = habit.archivedAt ? minDate(habit.archivedAt, today) : today;
  return periodsBetween(habit.createdAt, maxDate(habit.createdAt, end), habit.frequency, weekStartsOn)
    .filter((p) => p.start <= today)
    .map((period) => {
      const volume = vols.get(period.key) ?? 0;
      return { period, volume, status: periodStatusFromVolume(habit, period, volume, today), tier: tierForVolume(volume, habit) };
    });
}

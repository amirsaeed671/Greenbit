import type { Entry, Habit, Period, PeriodStatus } from './types';
import { volumeForPeriod } from './volume';

/** Whether a period falls inside the habit's active lifetime. */
export function periodApplies(habit: Habit, period: Period): boolean {
  if (period.end < habit.createdAt) return false;
  if (habit.archivedAt && period.start > habit.archivedAt) return false;
  return true;
}

/**
 * - `met`     minimum reached (even if the period is still open)
 * - `pending` period still open and minimum not yet reached; never shown as a miss
 * - `missed`  period ended without reaching the minimum
 * - `future`  period hasn't started
 * - `n/a`     outside the habit's lifetime
 */
export function periodStatusFromVolume(habit: Habit, period: Period, volume: number, today: string): PeriodStatus {
  if (!periodApplies(habit, period)) return 'n/a';
  if (period.start > today) return 'future';
  if (volume >= habit.minimum) return 'met';
  return period.end >= today ? 'pending' : 'missed';
}

export function periodStatus(habit: Habit, entries: Entry[], period: Period, today: string): PeriodStatus {
  return periodStatusFromVolume(habit, period, volumeForPeriod(entries, habit.id, period), today);
}

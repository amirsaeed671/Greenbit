import { periodOf } from './periods';
import { periodApplies, periodStatusFromVolume } from './status';
import type { Entry, Habit, Period, PeriodStatus, Tier, WeekStart } from './types';
import { tierForVolume, tierIndex, TIERS, volumeForDay, volumeForPeriod } from './volume';

/** The date the period's running total first reached the minimum, or null. */
export function completionDay(habit: Habit, entries: Entry[], period: Period): string | null {
  const inside = entries
    .filter((e) => e.habitId === habit.id && e.date >= period.start && e.date <= period.end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let sum = 0;
  for (const e of inside) {
    sum += e.volume;
    if (sum >= habit.minimum) return e.date;
  }
  return null;
}

export type Mark = 'tick' | 'cross' | null;

export interface DayCell {
  date: string;
  volume: number;
  /** Tier of this day's own volume (for weekly/monthly) or the day itself (daily). */
  tier: Tier;
  mark: Mark;
  isCompletionDay: boolean;
  period: Period;
  periodVolume: number;
  periodStatus: PeriodStatus;
  /** Weekly/monthly only: soft tint for the whole period. */
  tint: 'met' | 'missed' | 'open' | null;
  applies: boolean;
}

export function dayCell(habit: Habit, entries: Entry[], date: string, today: string, weekStartsOn: WeekStart = 1): DayCell {
  const period = periodOf(date, habit.frequency, weekStartsOn);
  const volume = volumeForDay(entries, habit.id, date);
  const periodVolume = habit.frequency === 'daily' ? volume : volumeForPeriod(entries, habit.id, period);
  const status = periodStatusFromVolume(habit, period, periodVolume, today);
  const applies = periodApplies(habit, period) && date >= habit.createdAt;
  const tier = tierForVolume(volume, habit);

  if (habit.frequency === 'daily') {
    const mark: Mark = status === 'met' ? 'tick' : status === 'missed' && applies ? 'cross' : null;
    return { date, volume, tier, mark, isCompletionDay: status === 'met', period, periodVolume, periodStatus: status, tint: null, applies };
  }

  const done = status === 'met' ? completionDay(habit, entries, period) : null;
  const isCompletionDay = done === date;
  let mark: Mark = null;
  if (isCompletionDay) mark = 'tick';
  else if (status === 'missed' && date === period.end) mark = 'cross';
  const tint = status === 'met' ? 'met' : status === 'missed' ? 'missed' : status === 'pending' ? 'open' : null;
  return { date, volume, tier, mark, isCompletionDay, period, periodVolume, periodStatus: status, tint, applies };
}

export interface CombinedHabitDay {
  habit: Habit;
  cell: DayCell;
  /** true = counts as met today, false = counts as missed, null = not applicable today */
  contribution: boolean | null;
  /** Tier used for the background colour. */
  tier: Tier;
}

export interface CombinedDay {
  date: string;
  met: number;
  total: number;
  ratio: number;
  avgTier: Tier;
  mark: 'tick' | 'partial' | 'cross' | null;
  habits: CombinedHabitDay[];
}

/**
 * Applicable habits on a day: daily habits always (within their lifetime);
 * weekly/monthly only on their completion day (met) or on the last day of an
 * unmet, ended period (missed).
 */
export function combinedDay(habits: Habit[], entries: Entry[], date: string, today: string, weekStartsOn: WeekStart = 1): CombinedDay {
  const rows: CombinedHabitDay[] = habits.map((habit) => {
    const cell = dayCell(habit, entries, date, today, weekStartsOn);
    let contribution: boolean | null = null;
    let tier: Tier = cell.tier;
    if (habit.frequency === 'daily') {
      if (cell.applies && date <= today) {
        if (cell.periodStatus === 'met') contribution = true;
        else if (cell.periodStatus === 'missed') contribution = false;
        else contribution = false; // today, still pending: counts toward total but not as a cross
      }
    } else if (cell.isCompletionDay) {
      contribution = true;
      tier = tierForVolume(cell.periodVolume, habit);
    } else if (cell.mark === 'cross') {
      contribution = false;
      tier = tierForVolume(cell.periodVolume, habit);
    }
    return { habit, cell, contribution, tier };
  });

  const applicable = rows.filter((r) => r.contribution !== null);
  const met = applicable.filter((r) => r.contribution).length;
  const total = applicable.length;
  const ratio = total ? met / total : 0;
  const avg = total ? Math.round(applicable.reduce((s, r) => s + tierIndex(r.tier), 0) / total) : 0;
  let mark: CombinedDay['mark'] = null;
  if (total > 0) {
    if (met === total) mark = 'tick';
    else if (met > 0) mark = 'partial';
    else if (date < today) mark = 'cross';
  }
  return { date, met, total, ratio, avgTier: TIERS[avg], mark, habits: rows };
}

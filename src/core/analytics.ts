import { addDays, addMonths, maxDate, minDate, parseDate } from './dates';
import { habitHistory, type PeriodRecord } from './history';
import { periodOf } from './periods';
import { currentStreak, longestStreak } from './streaks';
import type { Entry, Habit, Tier, WeekStart } from './types';
import { tierForVolume } from './volume';
import { SUNLIGHT } from './xp';

export type RangePreset = '30d' | '90d' | '12m' | 'all';

/** First date (inclusive) of the analysis window. */
export function rangeStart(preset: RangePreset, today: string, habits: Habit[]): string {
  if (preset === '30d') return addDays(today, -29);
  if (preset === '90d') return addDays(today, -89);
  if (preset === '12m') return addDays(addMonths(today, -12), 1);
  const first = habits.reduce((m, h) => minDate(m, h.createdAt), today);
  return first;
}

/** Periods of a habit that overlap [start, today]. */
export function recordsInRange(habit: Habit, entries: Entry[], today: string, w: WeekStart, start: string): PeriodRecord[] {
  return habitHistory(habit, entries, today, w).filter((r) => r.period.end >= start);
}

export type Outcome = 'missed' | 'below' | 'minimum' | 'target' | 'stretch';
export const OUTCOMES: Outcome[] = ['missed', 'below', 'minimum', 'target', 'stretch'];

/** Outcome of a decided period; open, unmet periods are undecided (null). */
export function outcomeOf(r: PeriodRecord): Outcome | null {
  if (r.status === 'met') return r.tier as Outcome;
  if (r.status === 'missed') return r.volume > 0 ? 'below' : 'missed';
  return null;
}

export interface Summary {
  met: number;
  decided: number;
  rate: number | null;
  outcomes: Record<Outcome, number>;
  sunlight: number;
  bestCurrentStreak: { habit: Habit; streak: number } | null;
  longestStreak: number;
  activeDays: number;
  totalDays: number;
}

export function summarize(habits: Habit[], entries: Entry[], today: string, w: WeekStart, start: string): Summary {
  const outcomes: Record<Outcome, number> = { missed: 0, below: 0, minimum: 0, target: 0, stretch: 0 };
  let sunlight = 0;
  let best: Summary['bestCurrentStreak'] = null;
  let longest = 0;
  for (const h of habits) {
    for (const r of recordsInRange(h, entries, today, w, start)) {
      const o = outcomeOf(r);
      if (o) outcomes[o]++;
      sunlight += SUNLIGHT[r.tier];
    }
    const s = currentStreak(h, entries, today, w);
    if (!best || s > best.streak) best = { habit: h, streak: s };
    longest = Math.max(longest, longestStreak(h, entries, today, w));
  }
  const met = outcomes.minimum + outcomes.target + outcomes.stretch;
  const decided = met + outcomes.missed + outcomes.below;
  const ids = new Set(habits.map((h) => h.id));
  const days = new Set(entries.filter((e) => ids.has(e.habitId) && e.date >= start && e.date <= today).map((e) => e.date));
  const firstDay = maxDate(start, habits.reduce((m, h) => minDate(m, h.createdAt), today));
  const totalDays = Math.max(0, Math.round((parseDate(today).getTime() - parseDate(firstDay).getTime()) / 86400000) + 1);
  return { met, decided, rate: decided ? met / decided : null, outcomes, sunlight, bestCurrentStreak: best, longestStreak: longest, activeDays: days.size, totalDays };
}

export interface TrendPoint {
  start: string;
  end: string;
  met: number;
  decided: number;
  rate: number | null;
}

/** Bucket size for trends: weeks for short windows, months for long ones. */
export const trendBucket = (start: string, today: string): 'weekly' | 'monthly' =>
  parseDate(today).getTime() - parseDate(start).getTime() > 120 * 86400000 ? 'monthly' : 'weekly';

/**
 * Share of decided periods that were met, per week or month. A period counts in
 * the bucket where it was decided (its last day, or today if met early).
 */
export function completionTrend(habits: Habit[], entries: Entry[], today: string, w: WeekStart, start: string): TrendPoint[] {
  // Don't plot empty buckets from before any selected habit existed.
  start = maxDate(start, habits.reduce((m, h) => minDate(m, h.createdAt), today));
  const bucket = trendBucket(start, today);
  const buckets = new Map<string, TrendPoint>();
  for (let p = periodOf(start, bucket, w); p.start <= today; p = periodOf(addDays(p.end, 1), bucket, w)) {
    buckets.set(p.key, { start: p.start, end: p.end, met: 0, decided: 0, rate: null });
  }
  for (const h of habits) {
    for (const r of recordsInRange(h, entries, today, w, start)) {
      if (r.status !== 'met' && r.status !== 'missed') continue;
      const decidedOn = minDate(r.period.end, today);
      const b = buckets.get(periodOf(maxDate(decidedOn, start), bucket, w).key);
      if (!b) continue;
      b.decided++;
      if (r.status === 'met') b.met++;
    }
  }
  return [...buckets.values()].map((b) => ({ ...b, rate: b.decided ? b.met / b.decided : null }));
}

export interface VolumePoint {
  start: string;
  end: string;
  volume: number;
  tier: Tier;
  open: boolean;
}

/**
 * Volume per period for one habit. A daily habit over a long window is averaged
 * per day within each week, so it still reads against the daily thresholds.
 */
export function volumeSeries(habit: Habit, entries: Entry[], today: string, w: WeekStart, start: string): { points: VolumePoint[]; averaged: boolean } {
  const recs = recordsInRange(habit, entries, today, w, start);
  if (habit.frequency !== 'daily' || recs.length <= 92) {
    return { averaged: false, points: recs.map((r) => ({ start: r.period.start, end: r.period.end, volume: r.volume, tier: r.tier, open: r.period.end >= today })) };
  }
  const weeks = new Map<string, { start: string; end: string; sum: number; days: number }>();
  for (const r of recs) {
    const wk = periodOf(r.period.start, 'weekly', w);
    const cur = weeks.get(wk.key) ?? { start: wk.start, end: wk.end, sum: 0, days: 0 };
    cur.sum += r.volume;
    cur.days++;
    weeks.set(wk.key, cur);
  }
  return {
    averaged: true,
    points: [...weeks.values()].map((x) => {
      const volume = Math.round((x.sum / x.days) * 10) / 10;
      return { start: x.start, end: x.end, volume, tier: tierForVolume(volume, habit), open: x.end >= today };
    }),
  };
}

export interface WeekdayStat {
  dow: number; // 0 = Sunday
  logged: number;
  days: number;
  rate: number | null;
}

/** For each weekday: share of days (in range, while a habit existed) with at least one entry. */
export function weekdayActivity(habits: Habit[], entries: Entry[], today: string, w: WeekStart, start: string): WeekdayStat[] {
  const ids = new Set(habits.map((h) => h.id));
  const logged = new Set(entries.filter((e) => ids.has(e.habitId)).map((e) => e.date));
  const first = maxDate(start, habits.reduce((m, h) => minDate(m, h.createdAt), today));
  const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, dow) => ({ dow, logged: 0, days: 0, rate: null }));
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const s = stats[parseDate(d).getDay()];
    s.days++;
    if (logged.has(d)) s.logged++;
  }
  const ordered = [...stats.slice(w), ...stats.slice(0, w)];
  return ordered.map((s) => ({ ...s, rate: s.days ? s.logged / s.days : null }));
}

export interface DayActivity {
  date: string;
  /** 0 = nothing logged, 1..4 = ramp step; null = outside every habit's lifetime or in the future. */
  level: number | null;
  tended: number;
  active: number;
  volume: number;
  tier: Tier;
}

/**
 * Daily activity for the heatmap. With one habit, the level is that day's tier
 * (below..stretch = 1..4). With several, it is the share of active habits tended.
 */
export function dailyActivity(habits: Habit[], entries: Entry[], today: string, dates: string[]): DayActivity[] {
  const byHabitDate = new Map<string, number>();
  const ids = new Set(habits.map((h) => h.id));
  for (const e of entries) {
    if (!ids.has(e.habitId)) continue;
    const k = `${e.habitId}|${e.date}`;
    byHabitDate.set(k, (byHabitDate.get(k) ?? 0) + e.volume);
  }
  const single = habits.length === 1 ? habits[0] : null;
  return dates.map((date) => {
    const activeHabits = habits.filter((h) => h.createdAt <= date && (!h.archivedAt || h.archivedAt >= date));
    const active = activeHabits.length;
    const tended = activeHabits.filter((h) => byHabitDate.has(`${h.id}|${date}`)).length;
    const volume = single ? (byHabitDate.get(`${single.id}|${date}`) ?? 0) : 0;
    const tier = single ? tierForVolume(volume, single) : 'none';
    let level: number | null = null;
    if (date <= today && active > 0) {
      if (single) level = ['none', 'below', 'minimum', 'target', 'stretch'].indexOf(tier);
      else level = tended === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((tended / active) * 4)));
    }
    return { date, level, tended, active, volume, tier };
  });
}

export interface HabitRate {
  habit: Habit;
  met: number;
  decided: number;
  rate: number | null;
}

export function habitRates(habits: Habit[], entries: Entry[], today: string, w: WeekStart, start: string): HabitRate[] {
  return habits
    .map((habit) => {
      const s = summarize([habit], entries, today, w, start);
      return { habit, met: s.met, decided: s.decided, rate: s.rate };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.habit.name.localeCompare(b.habit.name));
}

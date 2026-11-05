import { completionDay } from './calendar';
import { addDays, parseDate } from './dates';
import { habitHistory } from './history';
import type { Entry, Goal, Habit, WeekStart } from './types';

export interface MilestoneState {
  value: number;
  achievedAt?: string;
}

export interface GoalProgress {
  goal: Goal;
  /** Total so far, periods met so far, or best streak since the start date. */
  value: number;
  /** For streak goals: the streak running right now. */
  current?: number;
  ratio: number;
  achievedAt?: string;
  milestones: MilestoneState[];
  status: 'achieved' | 'active' | 'missed' | 'upcoming';
  /** With a deadline: where you'd be on a straight line from start to target, and what's left per day. */
  pace?: { expected: number; onTrack: boolean; perDayNeeded: number; daysLeft: number };
  /** Cumulative progress by day (start date to today or deadline), for charts. */
  series: { date: string; value: number }[];
}

const diffDays = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

/** Round a number to a friendly milestone (e.g. 237 → 250). */
function nice(v: number): number {
  if (v <= 10) return Math.max(1, Math.round(v));
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / (5 * p)) * 5 * p;
}

/** Suggested milestones at a quarter, half and three quarters of the target. */
export function suggestMilestones(target: number): number[] {
  return [...new Set([0.25, 0.5, 0.75].map((f) => nice(target * f)))].filter((v) => v > 0 && v < target);
}

/**
 * Daily step function of the goal's measure. Each event is (date, new value):
 * total → running volume; met → running count of met periods (on their completion day);
 * streak → length of the current run of met periods.
 */
function events(goal: Goal, habit: Habit, entries: Entry[], today: string, w: WeekStart): { date: string; value: number }[] {
  const end = goal.deadline && goal.deadline < today ? goal.deadline : today;
  const mine = entries.filter((e) => e.habitId === habit.id && e.date >= goal.startDate && e.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; value: number }[] = [];
  if (goal.kind === 'total') {
    let sum = 0;
    for (const e of mine) {
      sum += e.volume;
      if (out.length && out[out.length - 1].date === e.date) out[out.length - 1].value = sum;
      else out.push({ date: e.date, value: sum });
    }
    return out;
  }
  const hist = habitHistory(habit, entries, today, w).filter((r) => r.period.end >= goal.startDate && r.period.start <= end);
  let count = 0;
  let run = 0;
  for (const r of hist) {
    if (r.status === 'met') {
      const day = completionDay(habit, entries, r.period) ?? r.period.end;
      if (day < goal.startDate || day > end) continue;
      count++;
      run++;
      out.push({ date: day, value: goal.kind === 'met' ? count : run });
    } else if (r.status === 'missed' && goal.kind === 'streak') {
      run = 0;
      const day = addDays(r.period.end, 1);
      if (day <= end) out.push({ date: day, value: 0 });
    }
  }
  return out;
}

export function goalProgress(goal: Goal, habit: Habit, entries: Entry[], today: string, w: WeekStart = 1): GoalProgress {
  const ev = events(goal, habit, entries, today, w);
  const last = ev.length ? ev[ev.length - 1].value : 0;
  const best = ev.reduce((m, e) => Math.max(m, e.value), 0);
  const value = goal.kind === 'streak' ? best : last;
  const firstReach = (v: number) => ev.find((e) => e.value >= v)?.date;
  const achievedAt = firstReach(goal.target);
  const milestones = [...goal.milestones].sort((a, b) => a - b).filter((m) => m < goal.target).map((m) => ({ value: m, achievedAt: firstReach(m) }));

  let status: GoalProgress['status'] = 'active';
  if (achievedAt) status = 'achieved';
  else if (goal.startDate > today) status = 'upcoming';
  else if (goal.deadline && goal.deadline < today) status = 'missed';

  let pace: GoalProgress['pace'];
  if (goal.deadline && status === 'active') {
    const total = Math.max(1, diffDays(goal.startDate, goal.deadline) + 1);
    const elapsed = Math.min(total, Math.max(0, diffDays(goal.startDate, today) + 1));
    const expected = (goal.target * elapsed) / total;
    const daysLeft = Math.max(0, diffDays(today, goal.deadline));
    pace = { expected, onTrack: value >= expected, perDayNeeded: daysLeft ? (goal.target - value) / (daysLeft + 1) : goal.target - value, daysLeft };
  }

  // Daily series for charts.
  const series: { date: string; value: number }[] = [];
  const stop = goal.deadline && goal.deadline < today ? goal.deadline : today;
  let i = 0;
  let v = 0;
  for (let d = goal.startDate; d <= stop && series.length < 1500; d = addDays(d, 1)) {
    while (i < ev.length && ev[i].date <= d) v = ev[i++].value;
    series.push({ date: d, value: v });
  }

  return {
    goal,
    value,
    current: goal.kind === 'streak' ? last : undefined,
    ratio: Math.min(1, value / goal.target),
    achievedAt,
    milestones,
    status,
    pace,
    series,
  };
}

export const GOAL_KIND_LABEL = { total: 'Total', streak: 'Streak', met: 'Periods met' } as const;

export function describeGoal(goal: Goal, habit: Habit): string {
  const per = { daily: 'day', weekly: 'week', monthly: 'month' }[habit.frequency];
  if (goal.kind === 'total') return `${goal.target.toLocaleString()} ${habit.unit} in total`;
  if (goal.kind === 'streak') return `A ${goal.target}-${per} streak`;
  return `Meet the minimum ${goal.target} ${per}${goal.target === 1 ? '' : 's'}`;
}

/** Every reached milestone and goal, newest first. */
export function achievements(progress: { p: GoalProgress; habit: Habit }[]): { date: string; label: string; habit: Habit; goal: Goal; final: boolean }[] {
  const out: { date: string; label: string; habit: Habit; goal: Goal; final: boolean }[] = [];
  for (const { p, habit } of progress) {
    for (const m of p.milestones) if (m.achievedAt) out.push({ date: m.achievedAt, label: `${m.value.toLocaleString()} of ${p.goal.target.toLocaleString()}`, habit, goal: p.goal, final: false });
    if (p.achievedAt) out.push({ date: p.achievedAt, label: 'Goal achieved', habit, goal: p.goal, final: true });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || Number(b.final) - Number(a.final));
}

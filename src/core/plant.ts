import { habitHistory } from './history';
import { currentStreak } from './streaks';
import type { Entry, Frequency, Habit, WeekStart } from './types';

export type PlantStage = 'seed' | 'sprout' | 'bud' | 'bloom';
export const PLANT_STAGES: PlantStage[] = ['seed', 'sprout', 'bud', 'bloom'];

export const WINDOW: Record<Frequency, number> = { daily: 7, weekly: 4, monthly: 3 };

export interface PlantState {
  stage: PlantStage;
  wilting: boolean;
  ratio: number;
  streak: number;
}

/**
 * Stage from the met ratio over the last N periods (7 days / 4 weeks / 3 months),
 * boosted by the current streak. Open, unmet periods are ignored. Wilting is a
 * purely visual state: the latest closed period was missed.
 */
export function plantState(habit: Habit, entries: Entry[], today: string, weekStartsOn: WeekStart = 1): PlantState {
  const hist = habitHistory(habit, entries, today, weekStartsOn).filter((r) => r.status !== 'pending');
  const recent = hist.slice(-WINDOW[habit.frequency]);
  const met = recent.filter((r) => r.status === 'met').length;
  const n = WINDOW[habit.frequency];
  const ratio = met / n;
  const streak = currentStreak(habit, entries, today, weekStartsOn);
  let idx = ratio >= 0.85 ? 3 : ratio >= 0.5 ? 2 : ratio > 0 ? 1 : 0;
  if (streak >= n) idx = 3;
  else if (streak >= Math.ceil(n / 2)) idx = Math.max(idx, 2);
  const lastClosed = [...hist].reverse().find((r) => r.status === 'met' || r.status === 'missed');
  return { stage: PLANT_STAGES[idx], wilting: lastClosed?.status === 'missed', ratio, streak };
}

export const plantStage = (h: Habit, e: Entry[], today: string, w: WeekStart = 1) => plantState(h, e, today, w).stage;

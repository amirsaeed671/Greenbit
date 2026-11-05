import { habitHistory } from './history';
import type { Entry, Habit, Tier, WeekStart } from './types';

export const SUNLIGHT: Record<Tier, number> = { none: 0, below: 1, minimum: 10, target: 15, stretch: 25 };

/** Sunlight is awarded once per period for the highest tier reached. Always recomputed. */
export function habitSunlight(habit: Habit, entries: Entry[], today: string, weekStartsOn: WeekStart = 1): number {
  return habitHistory(habit, entries, today, weekStartsOn).reduce((s, r) => s + SUNLIGHT[r.tier], 0);
}

export function totalSunlight(habits: Habit[], entries: Entry[], today: string, weekStartsOn: WeekStart = 1): number {
  return habits.reduce((s, h) => s + habitSunlight(h, entries, today, weekStartsOn), 0);
}

/** Total sunlight needed to reach level n (n >= 1). Level 0 is free. */
export const levelThreshold = (n: number) => (n <= 0 ? 0 : Math.round(50 * Math.pow(n, 1.5)));

export interface LevelInfo {
  level: number;
  sunlight: number;
  currentAt: number;
  nextAt: number;
  progress: number; // 0..1 toward next level
  stage: string;
}

export const GARDEN_STAGES = ['Patch of soil', 'Seedbed', 'Greenhouse', 'Meadow', 'Orchard', 'Grove'] as const;

export function gardenStage(level: number): string {
  if (level >= 15) return GARDEN_STAGES[5];
  if (level >= 10) return GARDEN_STAGES[4];
  if (level >= 6) return GARDEN_STAGES[3];
  if (level >= 3) return GARDEN_STAGES[2];
  if (level >= 1) return GARDEN_STAGES[1];
  return GARDEN_STAGES[0];
}

export function levelFor(sunlight: number): LevelInfo {
  let level = 0;
  while (sunlight >= levelThreshold(level + 1)) level++;
  const currentAt = levelThreshold(level);
  const nextAt = levelThreshold(level + 1);
  return { level, sunlight, currentAt, nextAt, progress: (sunlight - currentAt) / (nextAt - currentAt), stage: gardenStage(level) };
}

/** Bonus sunlight for goals, derived like everything else: per milestone reached and per goal achieved. */
export const GOAL_SUNLIGHT = { milestone: 40, goal: 100 } as const;

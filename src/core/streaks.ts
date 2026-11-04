import { habitHistory } from './history';
import type { Entry, Habit, WeekStart } from './types';

/**
 * Consecutive met periods ending at the latest closed period, plus the open
 * period if it is already met. An open, unmet period never breaks the streak.
 */
export function currentStreak(habit: Habit, entries: Entry[], today: string, weekStartsOn: WeekStart = 1): number {
  const hist = habitHistory(habit, entries, today, weekStartsOn);
  let count = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    const s = hist[i].status;
    if (s === 'met') count++;
    else if (s === 'pending' && i === hist.length - 1) continue;
    else break;
  }
  return count;
}

export function longestStreak(habit: Habit, entries: Entry[], today: string, weekStartsOn: WeekStart = 1): number {
  let best = 0;
  let run = 0;
  for (const r of habitHistory(habit, entries, today, weekStartsOn)) {
    if (r.status === 'met') {
      run++;
      best = Math.max(best, run);
    } else if (r.status !== 'pending') run = 0;
  }
  return best;
}

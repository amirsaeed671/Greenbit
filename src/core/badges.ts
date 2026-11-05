import { combinedDay } from './calendar';
import { habitHistory } from './history';
import { longestStreak } from './streaks';
import { goalProgress } from './goals';
import type { Entry, Goal, Habit, WeekStart } from './types';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-entry', name: 'First seed', description: 'Log your first entry.', icon: '🌱' },
  { id: 'streak-7', name: 'Taking root', description: 'Reach a 7-period streak.', icon: '🌿' },
  { id: 'streak-30', name: 'Deep roots', description: 'Reach a 30-period streak.', icon: '🌳' },
  { id: 'streak-100', name: 'Ancient oak', description: 'Reach a 100-period streak.', icon: '🏞️' },
  { id: 'first-stretch', name: 'First bloom', description: 'Hit a stretch goal.', icon: '🌼' },
  { id: 'stretch-10', name: 'Golden harvest', description: 'Hit 10 stretch goals.', icon: '🌻' },
  { id: 'all-met-day', name: 'Full bed', description: 'Meet every applicable habit on one day (2+ habits).', icon: '🌷' },
  { id: 'comeback', name: 'Comeback', description: 'Meet a period right after missing one.', icon: '🌦️' },
  { id: 'first-milestone', name: 'Signpost', description: 'Reach a goal milestone.', icon: '🪧' },
  { id: 'goal-achieved', name: 'Harvest', description: 'Achieve a habit goal.', icon: '🏆' },
];

export function earnedBadges(habits: Habit[], entries: Entry[], today: string, weekStartsOn: WeekStart = 1, goals: Goal[] = []): Set<string> {
  const earned = new Set<string>();
  if (entries.length) earned.add('first-entry');

  let best = 0;
  let stretches = 0;
  let comeback = false;
  for (const h of habits) {
    best = Math.max(best, longestStreak(h, entries, today, weekStartsOn));
    const hist = habitHistory(h, entries, today, weekStartsOn);
    hist.forEach((r, i) => {
      if (r.tier === 'stretch') stretches++;
      if (i > 0 && r.status === 'met' && hist[i - 1].status === 'missed') comeback = true;
    });
  }
  if (best >= 7) earned.add('streak-7');
  if (best >= 30) earned.add('streak-30');
  if (best >= 100) earned.add('streak-100');
  if (stretches >= 1) earned.add('first-stretch');
  if (stretches >= 10) earned.add('stretch-10');
  if (comeback) earned.add('comeback');

  if (habits.length >= 2 && entries.length) {
    const dates = [...new Set(entries.map((e) => e.date))].filter((d) => d <= today);
    // A fully met day always has an entry on it (daily ticks and completion days are entry dates).
    for (const d of dates) {
      const c = combinedDay(habits, entries, d, today, weekStartsOn);
      if (c.total >= 2 && c.met === c.total) {
        earned.add('all-met-day');
        break;
      }
    }
  }
  for (const g of goals) {
    const h = habits.find((x) => x.id === g.habitId);
    if (!h) continue;
    const p = goalProgress(g, h, entries, today, weekStartsOn);
    if (p.milestones.some((m) => m.achievedAt) || p.achievedAt) earned.add('first-milestone');
    if (p.achievedAt) earned.add('goal-achieved');
  }
  return earned;
}

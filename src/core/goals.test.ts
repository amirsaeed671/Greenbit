import { describe, expect, it } from 'vitest';
import { achievements, goalProgress, suggestMilestones } from './goals';
import { entry, habit } from './test-utils';
import type { Goal } from './types';

const G = (over: Partial<Goal>): Goal => ({ id: 'g', habitId: 'h1', title: 'Goal', kind: 'total', target: 100, startDate: '2024-01-01', milestones: [25, 50, 75], createdAt: '2024-01-01', ...over });

describe('goals', () => {
  const h = habit({ createdAt: '2024-01-01' }); // daily, min 10
  const es = [entry('2023-12-31', 500), entry('2024-01-01', 20), entry('2024-01-02', 10), entry('2024-01-04', 30), entry('2024-01-05', 50)];

  it('total: sums from the start date and dates each milestone', () => {
    const p = goalProgress(G({}), h, es, '2024-01-10');
    expect(p.value).toBe(110);
    expect(p.status).toBe('achieved');
    expect(p.achievedAt).toBe('2024-01-05');
    expect(p.milestones.map((m) => m.achievedAt)).toEqual(['2024-01-02', '2024-01-04', '2024-01-05']);
    expect(p.series[0]).toEqual({ date: '2024-01-01', value: 20 });
    expect(p.series.at(-1)).toEqual({ date: '2024-01-10', value: 110 });
  });

  it('met: counts met periods on their completion day', () => {
    const p = goalProgress(G({ kind: 'met', target: 4, milestones: [2] }), h, es, '2024-01-10');
    expect(p.value).toBe(4);
    expect(p.milestones[0].achievedAt).toBe('2024-01-02');
    expect(p.achievedAt).toBe('2024-01-05');
  });

  it('streak: best run counts, current run reported separately', () => {
    const p = goalProgress(G({ kind: 'streak', target: 3, milestones: [2] }), h, es, '2024-01-06');
    expect(p.value).toBe(2); // 1–2 Jan, then 4–5 Jan
    expect(p.current).toBe(2);
    expect(p.status).toBe('active');
    expect(p.milestones[0].achievedAt).toBe('2024-01-02');
    const later = goalProgress(G({ kind: 'streak', target: 3 }), h, [...es, entry('2024-01-06', 10)], '2024-01-08');
    expect(later.achievedAt).toBe('2024-01-06');
    expect(later.current).toBe(0); // 7 Jan was missed
  });

  it('weekly met goal', () => {
    const w = habit({ id: 'w', frequency: 'weekly', minimum: 3, target: 5, stretch: 8, createdAt: '2024-01-01' });
    const p = goalProgress(G({ habitId: 'w', kind: 'met', target: 2, milestones: [] }), w, [entry('2024-01-03', 3, 'w'), entry('2024-01-09', 2, 'w'), entry('2024-01-10', 1, 'w')], '2024-01-20');
    expect(p.achievedAt).toBe('2024-01-10');
  });

  it('deadline pace and missed status', () => {
    const goal = G({ target: 310, deadline: '2024-01-31', milestones: [] });
    const p = goalProgress(goal, h, es, '2024-01-10');
    expect(p.status).toBe('active');
    expect(p.pace?.expected).toBeCloseTo(100);
    expect(p.pace?.onTrack).toBe(true);
    expect(p.pace?.daysLeft).toBe(21);
    expect(goalProgress(goal, h, es, '2024-02-02').status).toBe('missed');
    expect(goalProgress({ ...goal, startDate: '2024-03-01' }, h, es, '2024-01-10').status).toBe('upcoming');
  });

  it('entries after the deadline do not count', () => {
    const p = goalProgress(G({ target: 1000, deadline: '2024-01-02', milestones: [] }), h, es, '2024-01-10');
    expect(p.value).toBe(30);
  });

  it('suggested milestones are friendly numbers below the target', () => {
    expect(suggestMilestones(1000)).toEqual([250, 500, 750]);
    expect(suggestMilestones(30)).toEqual([8, 15, 25]);
    expect(suggestMilestones(3)).toEqual([1, 2]);
  });

  it('achievements list is newest first', () => {
    const p = goalProgress(G({}), h, es, '2024-01-10');
    const list = achievements([{ p, habit: h }]);
    expect(list[0]).toMatchObject({ date: '2024-01-05', final: true });
    expect(list).toHaveLength(4);
  });
});

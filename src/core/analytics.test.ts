import { describe, expect, it } from 'vitest';
import { completionTrend, dailyActivity, habitRates, rangeStart, summarize, trendBucket, volumeSeries, weekdayActivity } from './analytics';
import { addDays } from './dates';
import { entry, habit } from './test-utils';

const today = '2024-03-10'; // a Sunday

describe('analytics', () => {
  it('range presets', () => {
    expect(rangeStart('30d', today, [])).toBe('2024-02-10');
    expect(rangeStart('12m', today, [])).toBe('2023-03-11');
    expect(rangeStart('all', today, [habit({ createdAt: '2023-05-01' }), habit({ createdAt: '2022-01-01' })])).toBe('2022-01-01');
    expect(trendBucket('2024-02-10', today)).toBe('weekly');
    expect(trendBucket('2023-03-11', today)).toBe('monthly');
  });

  it('summary counts outcomes, ignores the open unmet period, and computes active days', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const es = [entry('2024-03-01', 10), entry('2024-03-02', 25), entry('2024-03-03', 45), entry('2024-03-04', 3)];
    const s = summarize([h], es, today, 1, '2024-03-01');
    // 3/1 min, 3/2 target, 3/3 stretch, 3/4 below, 3/5..3/9 missed, 3/10 open+unmet (ignored)
    expect(s.outcomes).toEqual({ missed: 5, below: 1, minimum: 1, target: 1, stretch: 1 });
    expect(s.decided).toBe(9);
    expect(s.rate).toBeCloseTo(3 / 9);
    expect(s.activeDays).toBe(4);
    expect(s.totalDays).toBe(10);
    expect(s.sunlight).toBe(10 + 15 + 25 + 1);
  });

  it('an open period already met counts as met', () => {
    const h = habit({ createdAt: '2024-03-10' });
    expect(summarize([h], [entry(today, 10)], today, 1, '2024-03-10').rate).toBe(1);
  });

  it('weekly completion trend buckets periods by the week they were decided', () => {
    const d = habit({ id: 'd', createdAt: '2024-02-26' });
    const es = [entry('2024-02-26', 10, 'd'), entry('2024-02-27', 10, 'd'), entry('2024-03-05', 10, 'd')];
    const t = completionTrend([d], es, today, 1, '2024-02-26');
    expect(t.map((p) => p.start)).toEqual(['2024-02-26', '2024-03-04']);
    expect([t[0].met, t[0].decided]).toEqual([2, 7]);
    expect([t[1].met, t[1].decided]).toEqual([1, 6]); // today (Sun 10th) still open
  });

  it('trend starts when the first selected habit was created', () => {
    const h = habit({ createdAt: '2024-02-20' });
    const t = completionTrend([h], [], today, 1, '2023-03-11');
    expect(t[0].start).toBe('2024-02-19');
  });

  it('volume series averages a long daily window by week', () => {
    const h = habit({ createdAt: '2023-01-02' });
    const es = Array.from({ length: 200 }, (_, i) => entry(addDays('2023-01-02', i), 14));
    const v = volumeSeries(h, es, '2023-12-31', 1, '2023-01-02');
    expect(v.averaged).toBe(true);
    expect(v.points[0].volume).toBe(14);
    expect(v.points[0].tier).toBe('minimum');
    const short = volumeSeries(h, es, '2023-01-20', 1, '2023-01-02');
    expect(short.averaged).toBe(false);
    expect(short.points).toHaveLength(19);
  });

  it('weekday activity starts on the configured week start', () => {
    const h = habit({ createdAt: '2024-03-04' }); // Monday
    const stats = weekdayActivity([h], [entry('2024-03-04', 1), entry('2024-03-06', 1)], today, 1, '2024-01-01');
    expect(stats[0]).toMatchObject({ dow: 1, logged: 1, days: 1, rate: 1 });
    expect(stats[1]).toMatchObject({ dow: 2, logged: 0, rate: 0 });
    expect(weekdayActivity([h], [], today, 0, '2024-01-01')[0].dow).toBe(0);
  });

  it('daily activity levels', () => {
    const a = habit({ id: 'a', createdAt: '2024-03-01' });
    const b = habit({ id: 'b', createdAt: '2024-03-05' });
    const es = [entry('2024-03-04', 1, 'a'), entry('2024-03-06', 1, 'a'), entry('2024-03-06', 1, 'b'), entry('2024-03-07', 1, 'b')];
    const days = dailyActivity([a, b], es, today, ['2024-02-28', '2024-03-04', '2024-03-06', '2024-03-07', '2024-03-08', '2024-03-11']);
    expect(days.map((d) => d.level)).toEqual([null, 4, 4, 2, 0, null]);
    const single = dailyActivity([a], [entry('2024-03-04', 45, 'a')], today, ['2024-03-04', '2024-03-05']);
    expect(single.map((d) => d.level)).toEqual([4, 0]);
  });

  it('habit rates rank best first, undecided last', () => {
    const a = habit({ id: 'a', name: 'A', createdAt: '2024-03-08' });
    const b = habit({ id: 'b', name: 'B', createdAt: '2024-03-08' });
    const c = habit({ id: 'c', name: 'C', createdAt: '2024-03-10' });
    const r = habitRates([a, b, c], [entry('2024-03-08', 10, 'b'), entry('2024-03-09', 10, 'b'), entry('2024-03-08', 10, 'a')], today, 1, '2024-03-01');
    expect(r.map((x) => [x.habit.id, x.rate])).toEqual([['b', 1], ['a', 0.5], ['c', null]]);
  });
});

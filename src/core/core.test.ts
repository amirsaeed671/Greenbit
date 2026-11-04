import { describe, expect, it } from 'vitest';
import { completionDay, combinedDay, dayCell } from './calendar';
import { addDays, addMonths, dayOfYear, isValidDateStr } from './dates';
import { periodOf, periodsBetween } from './periods';
import { periodStatus } from './status';
import { currentStreak, longestStreak } from './streaks';
import { entry, habit } from './test-utils';
import { tierForVolume, volumeForPeriod } from './volume';
import { levelFor, levelThreshold, habitSunlight } from './xp';
import { plantState } from './plant';
import { earnedBadges } from './badges';
import { quoteForDate } from './quotes';
import { validateHabitThresholds } from './validation';

describe('dates', () => {
  it('handles month lengths and leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(isValidDateStr('2023-02-29')).toBe(false);
    expect(isValidDateStr('2024-02-29')).toBe(true);
  });
  it('is unaffected by DST transitions', () => {
    // US and EU spring-forward / fall-back weekends
    expect(addDays('2024-03-09', 1)).toBe('2024-03-10');
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11');
    expect(addDays('2024-10-27', 1)).toBe('2024-10-28');
    expect(addDays('2024-11-03', 1)).toBe('2024-11-04');
  });
  it('computes day of year', () => {
    expect(dayOfYear('2024-01-01')).toBe(0);
    expect(dayOfYear('2024-12-31')).toBe(365);
  });
});

describe('periods', () => {
  // 2024-06-02 is a Sunday, 2024-06-03 a Monday
  it('weekly with Monday start', () => {
    expect(periodOf('2024-06-02', 'weekly', 1)).toEqual({ start: '2024-05-27', end: '2024-06-02', key: 'W2024-05-27' });
    expect(periodOf('2024-06-03', 'weekly', 1).start).toBe('2024-06-03');
  });
  it('weekly with Sunday start', () => {
    expect(periodOf('2024-06-02', 'weekly', 0)).toEqual({ start: '2024-06-02', end: '2024-06-08', key: 'W2024-06-02' });
    expect(periodOf('2024-06-01', 'weekly', 0).end).toBe('2024-06-01');
  });
  it('monthly across lengths', () => {
    expect(periodOf('2024-02-10', 'monthly')).toEqual({ start: '2024-02-01', end: '2024-02-29', key: '2024-02' });
    expect(periodOf('2023-02-10', 'monthly').end).toBe('2023-02-28');
    expect(periodOf('2024-04-30', 'monthly').end).toBe('2024-04-30');
  });
  it('periodsBetween', () => {
    expect(periodsBetween('2024-01-30', '2024-02-02', 'daily')).toHaveLength(4);
    expect(periodsBetween('2024-01-15', '2024-03-01', 'monthly').map((p) => p.key)).toEqual(['2024-01', '2024-02', '2024-03']);
    expect(periodsBetween('2024-06-02', '2024-06-03', 'weekly', 1)).toHaveLength(2);
    expect(periodsBetween('2024-06-02', '2024-06-03', 'weekly', 0)).toHaveLength(1);
  });
});

describe('volume and tiers', () => {
  const h = habit();
  it('tier boundaries', () => {
    expect(tierForVolume(0, h)).toBe('none');
    expect(tierForVolume(9, h)).toBe('below');
    expect(tierForVolume(10, h)).toBe('minimum');
    expect(tierForVolume(19.9, h)).toBe('minimum');
    expect(tierForVolume(20, h)).toBe('target');
    expect(tierForVolume(40, h)).toBe('stretch');
  });
  it('sums multiple entries and ignores other habits', () => {
    const es = [entry('2024-01-02', 4), entry('2024-01-02', 6), entry('2024-01-02', 100, 'other')];
    expect(volumeForPeriod(es, 'h1', periodOf('2024-01-02', 'daily'))).toBe(10);
  });
  it('boundary-day entries belong to the right week', () => {
    const w = habit({ frequency: 'weekly' });
    const es = [entry('2024-06-02', 5), entry('2024-06-03', 7)];
    expect(volumeForPeriod(es, w.id, periodOf('2024-06-02', 'weekly', 1))).toBe(5);
    expect(volumeForPeriod(es, w.id, periodOf('2024-06-03', 'weekly', 0))).toBe(12);
  });
});

describe('status', () => {
  const h = habit({ createdAt: '2024-01-05' });
  it('pending while open, missed only after the end', () => {
    expect(periodStatus(h, [], periodOf('2024-01-10', 'daily'), '2024-01-10')).toBe('pending');
    expect(periodStatus(h, [], periodOf('2024-01-09', 'daily'), '2024-01-10')).toBe('missed');
    expect(periodStatus(h, [entry('2024-01-10', 10)], periodOf('2024-01-10', 'daily'), '2024-01-10')).toBe('met');
  });
  it('n/a before createdAt and future after today', () => {
    expect(periodStatus(h, [], periodOf('2024-01-04', 'daily'), '2024-01-10')).toBe('n/a');
    expect(periodStatus(h, [], periodOf('2024-01-11', 'daily'), '2024-01-10')).toBe('future');
  });
  it('weekly period containing createdAt applies', () => {
    const w = habit({ frequency: 'weekly', createdAt: '2024-06-05' });
    expect(periodStatus(w, [], periodOf('2024-06-03', 'weekly', 1), '2024-06-20')).toBe('missed');
  });
});

describe('streaks', () => {
  const h = habit({ createdAt: '2024-01-01' });
  const es = ['2024-01-01', '2024-01-02', '2024-01-04', '2024-01-05', '2024-01-06'].map((d) => entry(d, 10));
  it('open unmet period does not break the streak', () => {
    expect(currentStreak(h, es, '2024-01-07')).toBe(3);
  });
  it('open met period extends the streak', () => {
    expect(currentStreak(h, [...es, entry('2024-01-07', 12)], '2024-01-07')).toBe(4);
  });
  it('a closed miss breaks it', () => {
    expect(currentStreak(h, es, '2024-01-08')).toBe(0);
  });
  it('longest streak', () => {
    expect(longestStreak(h, es, '2024-01-10')).toBe(3);
  });
  it('weekly streak across week start settings', () => {
    const w = habit({ frequency: 'weekly', minimum: 3, target: 5, stretch: 7 });
    const ws = [entry('2024-01-01', 3), entry('2024-01-08', 3), entry('2024-01-15', 3)];
    expect(currentStreak(w, ws, '2024-01-17', 1)).toBe(3);
    expect(currentStreak(w, ws, '2024-01-23', 1)).toBe(3); // week of 22nd is open
    expect(currentStreak(w, ws, '2024-01-29', 1)).toBe(0);
  });
  it('monthly streak', () => {
    const m = habit({ frequency: 'monthly', minimum: 1, target: 2, stretch: 3 });
    const ms = [entry('2024-01-31', 1), entry('2024-02-29', 1)];
    expect(currentStreak(m, ms, '2024-03-15')).toBe(2);
    expect(longestStreak(m, ms, '2024-05-01')).toBe(2);
  });
});

describe('calendar', () => {
  const w = habit({ frequency: 'weekly', minimum: 3, target: 5, stretch: 8, createdAt: '2024-01-01' });
  it('completion day is where the running total crosses the minimum', () => {
    const es = [entry('2024-01-03', 1), entry('2024-01-01', 1), entry('2024-01-05', 2), entry('2024-01-06', 5)];
    expect(completionDay(w, es, periodOf('2024-01-01', 'weekly', 1))).toBe('2024-01-05');
  });
  it('editing/deleting entries moves the completion day', () => {
    const es = [entry('2024-01-01', 1), entry('2024-01-03', 1), entry('2024-01-05', 2)];
    expect(completionDay(w, es, periodOf('2024-01-01', 'weekly', 1))).toBe('2024-01-05');
    const edited = es.map((e) => (e.date === '2024-01-03' ? { ...e, volume: 2 } : e));
    expect(completionDay(w, edited, periodOf('2024-01-01', 'weekly', 1))).toBe('2024-01-03');
    expect(completionDay(w, es.slice(0, 2), periodOf('2024-01-01', 'weekly', 1))).toBeNull();
  });
  it('weekly ticks and crosses', () => {
    const es = [entry('2024-01-02', 3)];
    expect(dayCell(w, es, '2024-01-02', '2024-01-03').mark).toBe('tick');
    expect(dayCell(w, es, '2024-01-03', '2024-01-03').mark).toBeNull();
    expect(dayCell(w, es, '2024-01-02', '2024-01-03').tint).toBe('met');
    // next week: open, no cross even on last day while open
    expect(dayCell(w, es, '2024-01-14', '2024-01-14').mark).toBeNull();
    expect(dayCell(w, es, '2024-01-14', '2024-01-14').tint).toBe('open');
    // after it ends: cross on the last day only
    expect(dayCell(w, es, '2024-01-14', '2024-01-15').mark).toBe('cross');
    expect(dayCell(w, es, '2024-01-13', '2024-01-15').mark).toBeNull();
    expect(dayCell(w, es, '2024-01-13', '2024-01-15').tint).toBe('missed');
  });
  it('daily ticks and crosses', () => {
    const d = habit({ createdAt: '2024-01-02' });
    expect(dayCell(d, [entry('2024-01-03', 10)], '2024-01-03', '2024-01-05').mark).toBe('tick');
    expect(dayCell(d, [], '2024-01-04', '2024-01-05').mark).toBe('cross');
    expect(dayCell(d, [], '2024-01-05', '2024-01-05').mark).toBeNull();
    expect(dayCell(d, [], '2024-01-01', '2024-01-05').mark).toBeNull();
  });
  it('combined day counts only applicable habits', () => {
    const d = habit({ id: 'd' });
    const wk = habit({ id: 'w', frequency: 'weekly', minimum: 3, target: 5, stretch: 8 });
    const es = [entry('2024-01-02', 10, 'd'), entry('2024-01-03', 3, 'w')];
    const c2 = combinedDay([d, wk], es, '2024-01-02', '2024-01-10');
    expect([c2.met, c2.total, c2.mark]).toEqual([1, 1, 'tick']);
    const c3 = combinedDay([d, wk], es, '2024-01-03', '2024-01-10');
    expect([c3.met, c3.total, c3.mark]).toEqual([1, 2, 'partial']);
    const c4 = combinedDay([d, wk], es, '2024-01-04', '2024-01-10');
    expect([c4.met, c4.total, c4.mark]).toEqual([0, 1, 'cross']);
    // today, nothing yet: no cross
    expect(combinedDay([d, wk], es, '2024-01-10', '2024-01-10').mark).toBeNull();
  });
});

describe('gamification', () => {
  it('sunlight once per period for the highest tier', () => {
    const h = habit({ createdAt: '2024-01-01' });
    const es = [entry('2024-01-01', 5), entry('2024-01-01', 20), entry('2024-01-02', 3), entry('2024-01-03', 45)];
    // day1 25 => target 15, day2 below 1, day3 stretch 25
    expect(habitSunlight(h, es, '2024-01-05')).toBe(41);
  });
  it('levels on a 50*n^1.5 curve', () => {
    expect(levelThreshold(1)).toBe(50);
    expect(levelThreshold(4)).toBe(400);
    expect(levelFor(0).level).toBe(0);
    expect(levelFor(49).level).toBe(0);
    expect(levelFor(50).level).toBe(1);
    expect(levelFor(400).level).toBe(4);
    expect(levelFor(400).stage).toBe('Greenhouse');
  });
  it('plant stages and wilting', () => {
    const h = habit({ createdAt: '2024-01-01' });
    expect(plantState(h, [], '2024-01-01').stage).toBe('seed');
    const week = Array.from({ length: 7 }, (_, i) => entry(addDays('2024-01-01', i), 10));
    expect(plantState(h, week, '2024-01-08').stage).toBe('bloom');
    const s = plantState(h, week, '2024-01-09');
    expect(s.wilting).toBe(true);
    expect(plantState(h, [...week, entry('2024-01-09', 10)], '2024-01-10').wilting).toBe(false);
  });
  it('badges', () => {
    const a = habit({ id: 'a', createdAt: '2024-01-01' });
    const b = habit({ id: 'b', createdAt: '2024-01-01' });
    const es = [entry('2024-01-01', 50, 'a'), entry('2024-01-03', 10, 'a'), entry('2024-01-03', 10, 'b')];
    const got = earnedBadges([a, b], es, '2024-01-04');
    expect(got.has('first-entry')).toBe(true);
    expect(got.has('first-stretch')).toBe(true);
    expect(got.has('comeback')).toBe(true);
    expect(got.has('all-met-day')).toBe(true);
    expect(got.has('streak-7')).toBe(false);
    expect(earnedBadges([], [], '2024-01-04').size).toBe(0);
  });
});

describe('misc', () => {
  it('quote selection is stable per day and wraps', () => {
    const qs = ['a', 'b', 'c'];
    expect(quoteForDate(qs, '2024-01-01')).toBe('a');
    expect(quoteForDate(qs, '2024-01-04')).toBe('a');
    expect(quoteForDate(qs, '2024-01-02')).toBe('b');
  });
  it('threshold validation', () => {
    expect(validateHabitThresholds(1, 2, 3)).toEqual({});
    expect(validateHabitThresholds(0, 2, 3).minimum).toBeTruthy();
    expect(validateHabitThresholds(5, 2, 3).target).toBeTruthy();
    expect(validateHabitThresholds(1, 4, 3).stretch).toBeTruthy();
  });
  it('zero entries', () => {
    const h = habit({ createdAt: '2024-01-01' });
    expect(currentStreak(h, [], '2024-01-01')).toBe(0);
    expect(longestStreak(h, [], '2024-03-01')).toBe(0);
  });
});

import { addDays, daysInMonth, parseDate, toDateStr } from './dates';
import type { Frequency, Period, WeekStart } from './types';

export function periodOf(date: string, frequency: Frequency, weekStartsOn: WeekStart = 1): Period {
  if (frequency === 'daily') return { start: date, end: date, key: date };
  if (frequency === 'weekly') {
    const d = parseDate(date);
    const diff = (d.getDay() - weekStartsOn + 7) % 7;
    const start = addDays(date, -diff);
    return { start, end: addDays(start, 6), key: `W${start}` };
  }
  const [y, m] = date.split('-').map(Number);
  const start = toDateStr(new Date(y, m - 1, 1, 12));
  const end = toDateStr(new Date(y, m - 1, daysInMonth(y, m), 12));
  return { start, end, key: start.slice(0, 7) };
}

export const nextPeriod = (p: Period, f: Frequency, w: WeekStart = 1) => periodOf(addDays(p.end, 1), f, w);
export const prevPeriod = (p: Period, f: Frequency, w: WeekStart = 1) => periodOf(addDays(p.start, -1), f, w);

/** All periods overlapping [start, end], in order. */
export function periodsBetween(start: string, end: string, frequency: Frequency, weekStartsOn: WeekStart = 1): Period[] {
  const out: Period[] = [];
  if (start > end) return out;
  let p = periodOf(start, frequency, weekStartsOn);
  while (p.start <= end) {
    out.push(p);
    p = nextPeriod(p, frequency, weekStartsOn);
  }
  return out;
}

export const inPeriod = (date: string, p: Period) => date >= p.start && date <= p.end;

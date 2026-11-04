import { format } from 'date-fns';
import { parseDate } from '../core/dates';
import type { Frequency } from '../core/types';

export const formatLong = (d: string) => format(parseDate(d), 'EEE, MMM d, yyyy');
export const formatShort = (d: string) => format(parseDate(d), 'MMM d');
export const formatMonth = (d: string) => format(parseDate(d), 'MMMM yyyy');

export const PERIOD_NOUN: Record<Frequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
};
export const plural = (n: number, f: Frequency) => `${n} ${PERIOD_NOUN[f][n === 1 ? 0 : 1]}`;
export const THIS_PERIOD: Record<Frequency, string> = { daily: 'today', weekly: 'this week', monthly: 'this month' };

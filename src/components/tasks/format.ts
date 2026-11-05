import { format } from 'date-fns';
import { addDays, parseDate } from '../../core/dates';

export type DueTone = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export function dueLabel(date: string, today: string, time?: string): { text: string; tone: DueTone } {
  const t = time ? ` ${formatTime(time)}` : '';
  if (date < today) {
    if (date === addDays(today, -1)) return { text: `Yesterday${t}`, tone: 'overdue' };
    return { text: `${format(parseDate(date), date.slice(0, 4) === today.slice(0, 4) ? 'MMM d' : 'MMM d, yyyy')}${t}`, tone: 'overdue' };
  }
  if (date === today) return { text: `Today${t}`, tone: 'today' };
  if (date === addDays(today, 1)) return { text: `Tomorrow${t}`, tone: 'tomorrow' };
  if (date <= addDays(today, 6)) return { text: `${format(parseDate(date), 'EEEE')}${t}`, tone: 'week' };
  return { text: `${format(parseDate(date), date.slice(0, 4) === today.slice(0, 4) ? 'MMM d' : 'MMM d, yyyy')}${t}`, tone: 'later' };
}

/** Stored 24-hour "HH:mm" shown as a 12-hour time with AM/PM (e.g. "18:05" → "6:05 PM"). */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const { hour, period } = to12h(h);
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export const to12h = (h: number): { hour: number; period: 'AM' | 'PM' } => ({ hour: h % 12 === 0 ? 12 : h % 12, period: h < 12 ? 'AM' : 'PM' });
export const to24h = (hour: number, period: 'AM' | 'PM') => (hour % 12) + (period === 'PM' ? 12 : 0);

export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

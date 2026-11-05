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

/** 24h "HH:mm" to the viewer's locale (e.g. 9:00 AM). */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

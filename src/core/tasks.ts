import { addDays, daysInMonth, parseDate, toDateStr } from './dates';
import type { Priority, Recurrence, Reminder, Task } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = (d: string) => parseDate(d).getDay();

function addMonthsAnchored(date: string, months: number, anchorDay: number): string {
  const d = parseDate(date);
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(ty, tm + 1));
  return toDateStr(new Date(ty, tm, day, 12));
}

/** The single next occurrence strictly after `base`. */
export function stepOnce(rec: Recurrence, base: string, anchorDay?: number): string {
  const n = Math.max(1, rec.interval);
  switch (rec.freq) {
    case 'daily':
      return addDays(base, n);
    case 'weekly': {
      const days = rec.byWeekday?.length ? [...rec.byWeekday].sort() : null;
      if (!days) return addDays(base, 7 * n);
      const cur = dow(base);
      const later = days.find((d) => d > cur);
      if (later !== undefined) return addDays(base, later - cur);
      // wrap into the next active week
      return addDays(base, 7 * (n - 1) + (7 - cur) + days[0]);
    }
    case 'monthly':
      return addMonthsAnchored(base, n, rec.byMonthDay ?? anchorDay ?? parseDate(base).getDate());
    case 'yearly':
      return addMonthsAnchored(base, 12 * n, anchorDay ?? parseDate(base).getDate());
  }
}

/** First date on or after `from` that matches the rule (used when a recurring task is created). */
export function firstOccurrence(rec: Recurrence, from: string): string {
  if (rec.freq === 'weekly' && rec.byWeekday?.length && !rec.byWeekday.includes(dow(from))) return stepOnce({ ...rec, interval: 1 }, from);
  if (rec.freq === 'monthly' && rec.byMonthDay) {
    const d = parseDate(from).getDate();
    const thisMonth = addMonthsAnchored(from, 0, rec.byMonthDay);
    return d <= rec.byMonthDay && thisMonth >= from ? thisMonth : addMonthsAnchored(from, 1, rec.byMonthDay);
  }
  return from;
}

/**
 * Next due date after completing a recurring task on `completedOn`.
 * `every`: steps from the old due date until it lands after today, like Todoist.
 * `every!`: steps once from the completion date.
 * Returns null when the series has ended (`until`).
 */
export function nextDue(rec: Recurrence, dueDate: string, completedOn: string): string | null {
  let next: string;
  if (rec.fromCompletion) next = stepOnce(rec, completedOn);
  else {
    const anchor = parseDate(dueDate).getDate();
    next = stepOnce(rec, dueDate, anchor);
    for (let guard = 0; next <= completedOn && guard < 5000; guard++) next = stepOnce(rec, next, anchor);
  }
  return rec.until && next > rec.until ? null : next;
}

/** The change to apply when a task is checked off. */
export function completionPatch(task: Task, today: string, nowIso: string): Partial<Task> {
  if (task.recurrence && task.dueDate) {
    const next = nextDue(task.recurrence, task.dueDate, today);
    if (next) return { dueDate: next, completions: [...(task.completions ?? []), today] };
    return { completedAt: nowIso, completions: [...(task.completions ?? []), today] };
  }
  return { completedAt: nowIso };
}

export const isOpen = (t: Task) => !t.completedAt && !t.deletedAt;
export const isOverdue = (t: Task, today: string, nowTime?: string) =>
  isOpen(t) && !!t.dueDate && (t.dueDate < today || (t.dueDate === today && !!t.dueTime && !!nowTime && t.dueTime < nowTime));

/** Todoist order: time-of-day first (timed before untimed), then priority, then manual order. */
export function compareTasks(a: Task, b: Task): number {
  return (
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') ||
    a.priority - b.priority ||
    a.order - b.order ||
    a.title.localeCompare(b.title)
  );
}

export function describeRecurrence(r: Recurrence): string {
  const every = r.fromCompletion ? 'Every!' : 'Every';
  const n = r.interval;
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
  let s = n === 1 ? `${every} ${unit}` : `${every} ${n} ${unit}s`;
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const days = [...r.byWeekday].sort();
    const label = days.join() === '1,2,3,4,5' ? 'weekday' : days.join() === '0,6' ? 'weekend day' : null;
    s = label && n === 1 ? `${every} ${label}` : `${s} on ${days.map((d) => WEEKDAYS[d]).join(', ')}`;
  }
  if (r.freq === 'monthly' && r.byMonthDay) s += ` on the ${ordinal(r.byMonthDay)}`;
  if (r.until) s += ` until ${r.until}`;
  return s;
}

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;

/** Local datetime 'YYYY-MM-DDTHH:mm' when a reminder should fire, or null if it can't (relative without a due time). */
export function reminderTime(task: Pick<Task, 'dueDate' | 'dueTime'>, r: Reminder): string | null {
  if (r.type === 'absolute') return r.at;
  if (!task.dueDate || !task.dueTime) return null;
  const [h, m] = task.dueTime.split(':').map(Number);
  const d = parseDate(task.dueDate);
  d.setHours(h, m - r.minutesBefore, 0, 0);
  return `${toDateStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Priority 1', 2: 'Priority 2', 3: 'Priority 3', 4: 'Priority 4' };

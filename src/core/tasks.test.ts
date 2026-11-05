import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickadd';
import { compareTasks, completionPatch, describeRecurrence, firstOccurrence, isOverdue, nextDue, reminderTime } from './tasks';
import type { Task } from './types';

const T = (over: Partial<Task> = {}): Task => ({ id: 't', title: 'x', priority: 4, labels: [], reminders: [], order: 0, createdAt: '2026-01-01', ...over });
// 2026-11-05 is a Thursday
const today = '2026-11-05';

describe('recurrence', () => {
  it('every: steps from the due date and skips past occurrences', () => {
    expect(nextDue({ freq: 'daily', interval: 1 }, today, today)).toBe('2026-11-06');
    expect(nextDue({ freq: 'daily', interval: 1 }, '2026-11-01', today)).toBe('2026-11-06');
    expect(nextDue({ freq: 'weekly', interval: 2 }, '2026-11-05', today)).toBe('2026-11-19');
  });
  it('every!: steps from the completion date', () => {
    expect(nextDue({ freq: 'daily', interval: 3, fromCompletion: true }, '2026-11-01', today)).toBe('2026-11-08');
  });
  it('weekly on specific days', () => {
    const r = { freq: 'weekly' as const, interval: 1, byWeekday: [1, 3, 5] };
    expect(nextDue(r, '2026-11-04', '2026-11-04')).toBe('2026-11-06'); // Wed -> Fri
    expect(nextDue(r, '2026-11-06', '2026-11-06')).toBe('2026-11-09'); // Fri -> Mon
    const biweekly = { ...r, interval: 2 };
    expect(nextDue(biweekly, '2026-11-06', '2026-11-06')).toBe('2026-11-16'); // skips a week
  });
  it('monthly keeps the anchor day through short months', () => {
    const r = { freq: 'monthly' as const, interval: 1, byMonthDay: 31 };
    expect(nextDue(r, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextDue(r, '2026-02-28', '2026-02-28')).toBe('2026-03-31');
    expect(nextDue({ freq: 'yearly', interval: 1 }, '2024-02-29', '2024-02-29')).toBe('2025-02-28');
  });
  it('until ends the series', () => {
    expect(nextDue({ freq: 'daily', interval: 1, until: '2026-11-05' }, today, today)).toBeNull();
  });
  it('first occurrence', () => {
    expect(firstOccurrence({ freq: 'weekly', interval: 1, byWeekday: [1] }, today)).toBe('2026-11-09');
    expect(firstOccurrence({ freq: 'weekly', interval: 1, byWeekday: [4] }, today)).toBe(today);
    expect(firstOccurrence({ freq: 'monthly', interval: 1, byMonthDay: 1 }, today)).toBe('2026-12-01');
    expect(firstOccurrence({ freq: 'monthly', interval: 1, byMonthDay: 20 }, today)).toBe('2026-11-20');
  });
  it('completing moves a recurring task and completes a normal one', () => {
    expect(completionPatch(T({ dueDate: today, recurrence: { freq: 'daily', interval: 1 } }), today, 'now')).toEqual({ dueDate: '2026-11-06', completions: [today] });
    expect(completionPatch(T({ dueDate: today }), today, 'now')).toEqual({ completedAt: 'now' });
  });
  it('describes rules', () => {
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describeRecurrence({ freq: 'weekly', interval: 2, byWeekday: [1, 3] })).toBe('Every 2 weeks on Mon, Wed');
    expect(describeRecurrence({ freq: 'monthly', interval: 1, byMonthDay: 22 })).toBe('Every month on the 22nd');
    expect(describeRecurrence({ freq: 'daily', interval: 3, fromCompletion: true })).toBe('Every! 3 days');
  });
});

describe('task helpers', () => {
  it('overdue and ordering', () => {
    expect(isOverdue(T({ dueDate: '2026-11-04' }), today)).toBe(true);
    expect(isOverdue(T({ dueDate: today, dueTime: '09:00' }), today, '10:00')).toBe(true);
    expect(isOverdue(T({ dueDate: today, dueTime: '11:00' }), today, '10:00')).toBe(false);
    const list = [T({ id: 'a', dueDate: today, priority: 3 }), T({ id: 'b', dueDate: today, dueTime: '09:00', priority: 4 }), T({ id: 'c', dueDate: today, priority: 1 })];
    expect(list.sort(compareTasks).map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });
  it('reminder times', () => {
    expect(reminderTime({ dueDate: today, dueTime: '00:15' }, { id: 'r', type: 'relative', minutesBefore: 30 })).toBe('2026-11-04T23:45');
    expect(reminderTime({ dueDate: today }, { id: 'r', type: 'relative', minutesBefore: 30 })).toBeNull();
    expect(reminderTime({}, { id: 'r', type: 'absolute', at: '2026-11-05T08:00' })).toBe('2026-11-05T08:00');
  });
});

describe('quick add', () => {
  const q = (s: string, o = {}) => parseQuickAdd(s, today, o);
  it('the full Todoist sentence', () => {
    const r = q('Pay rent every month on the 1st p1 #Home @bills at 9am !30m');
    expect(r.title).toBe('Pay rent');
    expect(r.priority).toBe(1);
    expect(r.project).toBe('Home');
    expect(r.labels).toEqual(['bills']);
    expect(r.recurrence).toEqual({ freq: 'monthly', interval: 1, byMonthDay: 1 });
    expect(r.dueDate).toBe('2026-12-01');
    expect(r.dueTime).toBe('09:00');
    expect(r.remindMinutesBefore).toBe(30);
    expect(r.tokens.map((t) => t.kind)).toEqual(['recurrence', 'priority', 'project', 'label', 'time', 'reminder']);
  });
  it('dates', () => {
    expect(q('call mum tomorrow').dueDate).toBe('2026-11-06');
    expect(q('call mum tod').dueDate).toBe(today);
    expect(q('x fri').dueDate).toBe('2026-11-06');
    expect(q('x thursday').dueDate).toBe(today);
    expect(q('x next thu').dueDate).toBe('2026-11-12');
    expect(q('x next week').dueDate).toBe('2026-11-09');
    expect(q('x next month').dueDate).toBe('2026-12-01');
    expect(q('x in 3 days').dueDate).toBe('2026-11-08');
    expect(q('x Dec 24').dueDate).toBe('2026-12-24');
    expect(q('x 3 jan').dueDate).toBe('2027-01-03');
    expect(q('x 2027-02-01').dueDate).toBe('2027-02-01');
    expect(q('x Feb 30').dueDate).toBeUndefined();
  });
  it('times', () => {
    expect(q('standup 9:30am').dueTime).toBe('09:30');
    expect(q('gym at 18:00').dueTime).toBe('18:00');
    expect(q('gym at 18:00').dueDate).toBe(today);
    expect(q('lunch 12pm').dueTime).toBe('12:00');
    expect(q('x 12am').dueTime).toBe('00:00');
  });
  it('recurrences', () => {
    expect(q('stretch every day').recurrence).toEqual({ freq: 'daily', interval: 1 });
    expect(q('water plants every! 3 days').recurrence).toEqual({ freq: 'daily', interval: 3, fromCompletion: true });
    expect(q('review every other week').recurrence).toMatchObject({ freq: 'weekly', interval: 2 });
    expect(q('gym every mon, wed and fri').recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] });
    expect(q('gym every mon, wed and fri').dueDate).toBe('2026-11-06');
    expect(q('standup every weekday').recurrence?.byWeekday).toEqual([1, 2, 3, 4, 5]);
    expect(q('report monthly').recurrence).toEqual({ freq: 'monthly', interval: 1, byMonthDay: 5 });
  });
  it('multi-word known projects and labels', () => {
    const r = q('Plan trip #Side project @deep work', { projects: ['Side project'], labels: ['deep work'] });
    expect(r.title).toBe('Plan trip');
    expect(r.project).toBe('Side project');
    expect(r.labels).toEqual(['deep work']);
  });
  it('leaves ordinary text alone', () => {
    const r = q('Email p10 about issue');
    expect(r.title).toBe('Email p10 about issue');
    expect(r.priority).toBeUndefined();
    expect(q('Fix bug#12 in parser').project).toBeUndefined();
    expect(q('Read 3 chapters').dueDate).toBeUndefined();
    expect(q('Buy milk').title).toBe('Buy milk');
  });
});

describe('12-hour time display', () => {
  it('formats stored 24-hour times with AM/PM', async () => {
    const { formatTime, to12h, to24h } = await import('../components/tasks/format');
    expect(['00:00', '00:30', '09:05', '12:00', '12:45', '13:00', '18:05', '23:59'].map(formatTime)).toEqual(['12:00 AM', '12:30 AM', '9:05 AM', '12:00 PM', '12:45 PM', '1:00 PM', '6:05 PM', '11:59 PM']);
    for (let h = 0; h < 24; h++) {
      const { hour, period } = to12h(h);
      expect(to24h(hour, period)).toBe(h);
    }
  });
});

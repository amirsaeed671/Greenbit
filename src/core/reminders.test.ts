import { describe, expect, it } from 'vitest';
import { allReminders, localToMs, nextReminder, remindersInWindow } from './reminders';
import type { Task } from './types';

const T = (over: Partial<Task>): Task => ({ id: 't', title: 'Task', priority: 4, labels: [], reminders: [], order: 0, createdAt: '2026-11-01', ...over });

describe('reminders', () => {
  const tasks = [
    T({ id: 'a', title: 'Pay rent', dueDate: '2026-11-05', dueTime: '09:00', reminders: [{ id: 'r1', type: 'relative', minutesBefore: 30 }] }),
    T({ id: 'b', title: 'Call', reminders: [{ id: 'r2', type: 'absolute', at: '2026-11-05T10:00' }] }),
    T({ id: 'c', title: 'No time', dueDate: '2026-11-05', reminders: [{ id: 'r3', type: 'relative', minutesBefore: 10 }] }),
    T({ id: 'd', title: 'Done', completedAt: 'x', reminders: [{ id: 'r4', type: 'absolute', at: '2026-11-05T08:00' }] }),
  ];
  it('lists fireable reminders in time order, skipping done tasks and untimed relative ones', () => {
    expect(allReminders(tasks).map((r) => [r.taskId, r.atLocal])).toEqual([
      ['a', '2026-11-05T08:30'],
      ['b', '2026-11-05T10:00'],
    ]);
  });
  it('finds what came due in a window, minus what already fired', () => {
    const from = localToMs('2026-11-05T08:00');
    const to = localToMs('2026-11-05T10:00');
    expect(remindersInWindow(tasks, from, to, new Set()).map((r) => r.taskId)).toEqual(['a', 'b']);
    expect(remindersInWindow(tasks, from, to, new Set(['a|r1|2026-11-05T08:30'])).map((r) => r.taskId)).toEqual(['b']);
  });
  it('a recurring task moved to its next date gets a new key, so it fires again', () => {
    const moved = [{ ...tasks[0], dueDate: '2026-12-01' }];
    expect(allReminders(moved)[0].key).toBe('a|r1|2026-12-01T08:30');
  });
  it('next reminder', () => {
    expect(nextReminder(tasks, localToMs('2026-11-05T09:00'))?.taskId).toBe('b');
    expect(nextReminder(tasks, localToMs('2026-11-05T11:00'))).toBeUndefined();
  });
});

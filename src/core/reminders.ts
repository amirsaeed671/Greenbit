import { reminderTime } from './tasks';
import type { Task } from './types';

export interface DueReminder {
  key: string; // unique per task, reminder and fire time, so a moved due date fires again
  taskId: string;
  title: string;
  at: number; // epoch ms
  atLocal: string; // 'YYYY-MM-DDTHH:mm'
}

/** Local 'YYYY-MM-DDTHH:mm' to epoch ms in the device's time zone. */
export function localToMs(s: string): number {
  const [d, t] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0).getTime();
}

/** Every reminder of every open task, with its fire time. */
export function allReminders(tasks: Task[]): DueReminder[] {
  const out: DueReminder[] = [];
  for (const t of tasks) {
    if (t.completedAt || t.deletedAt) continue;
    for (const r of t.reminders) {
      const atLocal = reminderTime(t, r);
      if (!atLocal) continue;
      out.push({ key: `${t.id}|${r.id}|${atLocal}`, taskId: t.id, title: t.title, at: localToMs(atLocal), atLocal });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Reminders that came due in (from, to] and haven't fired on this device. */
export function remindersInWindow(tasks: Task[], from: number, to: number, fired: Set<string>): DueReminder[] {
  return allReminders(tasks).filter((r) => r.at > from && r.at <= to && !fired.has(r.key));
}

export function nextReminder(tasks: Task[], after: number): DueReminder | undefined {
  return allReminders(tasks).find((r) => r.at > after);
}

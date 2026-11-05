import { liveQuery } from 'dexie';
import { nextReminder, remindersInWindow, type DueReminder } from '../core/reminders';
import type { Task } from '../core/types';
import { db } from '../db/db';
import { repo, uid } from '../db/repo';
import { taskRepo } from '../db/taskRepo';
import { useUI } from '../store/ui';

const FIRED = 'reminders:fired';
const LAST = 'reminders:lastCheck';
const KEEP_MS = 14 * 86400000;
/** Reminders missed by more than this while the app was closed are summarised instead of notified one by one. */
const MAX_INDIVIDUAL = 3;

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestNotifications(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'default') await Notification.requestPermission();
  return Notification.permission as PermissionState;
}

async function show(title: string, body: string, tag: string, data: Record<string, unknown>) {
  if (notificationPermission() !== 'granted') return false;
  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body,
    tag,
    data,
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    requireInteraction: true,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      options.actions = data.taskId ? [{ action: 'complete', title: 'Complete' }, { action: 'snooze', title: 'Snooze 10 min' }] : [];
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall back to a page notification */
  }
  new Notification(title, options);
  return true;
}

export function sendTestNotification() {
  return show('Greenbit reminders are on', 'This is how a task reminder will look.', 'greenbit-test', {});
}

async function fire(list: DueReminder[]) {
  const toast = useUI.getState().showToast;
  const individual = list.slice(-MAX_INDIVIDUAL);
  const extra = list.length - individual.length;
  for (const r of individual) {
    const shown = await show(r.title, `Reminder · ${r.atLocal.slice(11)}`, r.key, { taskId: r.taskId });
    if (!shown || document.visibilityState === 'visible') toast(`⏰ ${r.title}`);
  }
  if (extra > 0) await show('Greenbit', `You missed ${extra} more reminder${extra > 1 ? 's' : ''} while away.`, 'greenbit-missed', {});
}

export async function handleReminderAction(action: string, taskId: string) {
  const task = await db.tasks.get(taskId);
  if (!task || task.deletedAt) return;
  const today = useUI.getState().today;
  if (action === 'complete') {
    await taskRepo.completeTask(task, today);
    useUI.getState().showToast(`Completed “${task.title}”`, { label: 'Undo', run: () => void taskRepo.undoComplete(task) });
  } else if (action === 'snooze') {
    const d = new Date(Date.now() + 10 * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    await repo.patch<Task>('tasks', task.id, { reminders: [...task.reminders, { id: uid(), type: 'absolute', at }] });
    useUI.getState().showToast('Snoozed for 10 minutes');
  }
}

/**
 * Runs while the app is open (or in a background tab): fires reminders as they come due,
 * and on start catches up on ones that came due while the app was closed.
 */
export function startReminderScheduler(): () => void {
  let tasks: Task[] = [];
  let timer = 0;
  let checking = false;

  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const now = Date.now();
      const firedRow = (await db.local.get(FIRED))?.value as Record<string, number> | undefined;
      const fired = Object.fromEntries(Object.entries(firedRow ?? {}).filter(([, t]) => now - t < KEEP_MS));
      const last = ((await db.local.get(LAST))?.value as number | undefined) ?? now;
      const due = remindersInWindow(tasks, Math.min(last, now) - 1, now, new Set(Object.keys(fired)));
      for (const r of due) fired[r.key] = now;
      await db.local.bulkPut([{ key: FIRED, value: fired }, { key: LAST, value: now }]);
      if (due.length) await fire(due);
    } finally {
      checking = false;
    }
    schedule();
  };

  const schedule = () => {
    window.clearTimeout(timer);
    const next = nextReminder(tasks, Date.now());
    // Re-check at least every minute: timers drift in background tabs and the clock can jump.
    const wait = next ? Math.min(Math.max(next.at - Date.now() + 250, 250), 60000) : 60000;
    timer = window.setTimeout(() => void check(), wait);
  };

  const sub = liveQuery(() => db.tasks.filter((t) => !t.deletedAt && !t.completedAt && t.reminders.length > 0).toArray()).subscribe((t) => {
    tasks = t;
    void check();
  });

  const onVisible = () => document.visibilityState === 'visible' && void check();
  document.addEventListener('visibilitychange', onVisible);

  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'reminder-action') void handleReminderAction(e.data.action, e.data.taskId);
  };
  navigator.serviceWorker?.addEventListener('message', onMessage);

  // A notification action clicked while no window was open arrives as URL params.
  const params = new URLSearchParams(location.search);
  if (params.get('reminderAction') && params.get('task')) {
    void handleReminderAction(params.get('reminderAction')!, params.get('task')!);
    history.replaceState(null, '', location.pathname);
  }

  return () => {
    sub.unsubscribe();
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.removeEventListener('message', onMessage);
  };
}

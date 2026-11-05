import { useEffect, useState } from 'react';
import { firstOccurrence, describeRecurrence, reminderTime } from '../../core/tasks';
import type { Label, Priority, Project, Recurrence, Reminder, Task } from '../../core/types';
import { colorHex } from '../../data/colors';
import { uid } from '../../db/repo';
import { taskRepo } from '../../db/taskRepo';
import { useUI } from '../../store/ui';
import { notificationPermission, requestNotifications } from '../../reminders/scheduler';
import { formatLong } from '../format';
import { Sheet } from '../Sheet';
import { formatTime } from './format';
import { TimeSelect } from '../TimeSelect';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BEFORE = [
  [0, 'At due time'],
  [5, '5 min before'],
  [10, '10 min before'],
  [15, '15 min before'],
  [30, '30 min before'],
  [60, '1 hour before'],
  [120, '2 hours before'],
  [1440, '1 day before'],
] as const;

function describeReminder(task: Task, r: Reminder): string {
  if (r.type === 'absolute') {
    const [d, t] = r.at.split('T');
    return `${formatLong(d)}, ${formatTime(t)}`;
  }
  const label = BEFORE.find(([m]) => m === r.minutesBefore)?.[1] ?? `${r.minutesBefore} min before`;
  return reminderTime(task, r) ? label : `${label} (needs a due time)`;
}

export function TaskSheet({ task, projects, labels, onClose }: { task: Task | null; projects: Project[]; labels: Label[]; onClose: () => void }) {
  const today = useUI((s) => s.today);
  const showToast = useUI((s) => s.showToast);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [remKind, setRemKind] = useState<'relative' | 'absolute'>('relative');
  const [remBefore, setRemBefore] = useState(15);
  const [remAt, setRemAt] = useState('');

  useEffect(() => {
    setTitle(task?.title ?? '');
    setDesc(task?.description ?? '');
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;
  const set = (change: Partial<Task>) => void taskRepo.updateTask(task.id, change);
  const rec = task.recurrence;
  const setRec = (r: Recurrence | undefined) => set({ recurrence: r, ...(r && !task.dueDate ? { dueDate: firstOccurrence(r, today) } : {}) });

  return (
    <Sheet open title={task.completedAt ? 'Completed task' : 'Task'} onClose={onClose}>
      <div className="stack task-sheet">
        <textarea
          className="ts-title"
          rows={1}
          value={title}
          aria-label="Task name"
          ref={(el) => {
            // Grow with the text so long titles wrap instead of scrolling sideways.
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight + 2}px`;
            }
          }}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={() => title.trim() && title !== task.title && set({ title: title.trim() })}
        />
        <textarea
          className="ts-desc"
          value={desc}
          rows={3}
          placeholder="Description (Markdown)"
          aria-label="Description"
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== (task.description ?? '') && set({ description: desc || undefined })}
        />

        <div className="ts-grid">
          <label className="field">
            <span className="label">Project</span>
            <select value={task.projectId ?? ''} onChange={(e) => set({ projectId: e.target.value || undefined })}>
              <option value="">📥 Inbox</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}># {p.name}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="label" id="prio-label">Priority</span>
            <div className="segmented prio" role="radiogroup" aria-labelledby="prio-label">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <button key={p} role="radio" aria-checked={task.priority === p} aria-pressed={task.priority === p} onClick={() => set({ priority: p })}>
                  <span className={`flag p${p}`} aria-hidden="true">⚑</span> P{p}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="label">Due date</span>
            <span className="row">
              <input type="date" value={task.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || undefined, ...(e.target.value ? {} : { dueTime: undefined, recurrence: undefined }) })} />
              {task.dueDate && <TimeSelect label="Due time" value={task.dueTime} onChange={(v) => set({ dueTime: v })} />}
            </span>
          </label>
        </div>

        <fieldset className="ts-section">
          <legend>Repeat</legend>
          <div className="row">
            <select aria-label="Repeat" value={rec ? rec.freq : ''} onChange={(e) => setRec(e.target.value ? { freq: e.target.value as Recurrence['freq'], interval: rec?.interval ?? 1 } : undefined)}>
              <option value="">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {rec && (
              <>
                <label className="row small">
                  every
                  <input type="number" min={1} max={99} aria-label="Interval" value={rec.interval} onChange={(e) => setRec({ ...rec, interval: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 64 }} />
                  {{ daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[rec.freq]}
                </label>
              </>
            )}
          </div>
          {rec?.freq === 'weekly' && (
            <div className="weekday-picker" role="group" aria-label="Repeat on">
              {WD.map((d, i) => {
                const on = rec.byWeekday?.includes(i) ?? false;
                return (
                  <button
                    key={i}
                    aria-pressed={on}
                    aria-label={WD_FULL[i]}
                    onClick={() => {
                      const days = on ? (rec.byWeekday ?? []).filter((x) => x !== i) : [...(rec.byWeekday ?? []), i].sort();
                      setRec({ ...rec, byWeekday: days.length ? days : undefined });
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {rec?.freq === 'monthly' && (
            <label className="row small">
              on day
              <input type="number" min={1} max={31} value={rec.byMonthDay ?? ''} placeholder={task.dueDate?.slice(8)} onChange={(e) => setRec({ ...rec, byMonthDay: Number(e.target.value) || undefined })} style={{ width: 64 }} aria-label="Day of month" />
            </label>
          )}
          {rec && (
            <div className="row small">
              <label className="row">
                <input type="checkbox" checked={!!rec.fromCompletion} onChange={(e) => setRec({ ...rec, fromCompletion: e.target.checked || undefined })} />
                Count from when I complete it
              </label>
              <label className="row">
                until
                <input type="date" value={rec.until ?? ''} onChange={(e) => setRec({ ...rec, until: e.target.value || undefined })} aria-label="Repeat until" />
              </label>
            </div>
          )}
          {rec && <p className="muted small">{describeRecurrence(rec)}{task.completions?.length ? ` · done ${task.completions.length}×, last ${formatLong(task.completions[task.completions.length - 1])}` : ''}</p>}
        </fieldset>

        <fieldset className="ts-section">
          <legend>Reminders</legend>
          {task.reminders.length > 0 && (
            <ul className="entry-list">
              {task.reminders.map((r) => (
                <li key={r.id}>
                  <span aria-hidden="true">⏰</span> {describeReminder(task, r)}
                  <span className="spacer" />
                  <button className="btn small ghost" onClick={() => set({ reminders: task.reminders.filter((x) => x.id !== r.id) })} aria-label="Remove reminder">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <select aria-label="Reminder type" value={remKind} onChange={(e) => setRemKind(e.target.value as 'relative' | 'absolute')}>
              <option value="relative">Before due time</option>
              <option value="absolute">At a date and time</option>
            </select>
            {remKind === 'relative' ? (
              <select aria-label="How long before" value={remBefore} onChange={(e) => setRemBefore(Number(e.target.value))}>
                {BEFORE.map(([m, l]) => (
                  <option key={m} value={m}>{l}</option>
                ))}
              </select>
            ) : (
              <>
                <input type="date" aria-label="Remind on" value={remAt.slice(0, 10)} onChange={(e) => setRemAt(e.target.value ? `${e.target.value}T${remAt.slice(11) || '09:00'}` : '')} />
                <TimeSelect label="Remind at" allowClear={false} value={remAt.slice(11) || undefined} onChange={(v) => v && setRemAt(`${remAt.slice(0, 10) || today}T${v}`)} />
              </>
            )}
            <button
              className="btn small"
              onClick={() => {
                if (remKind === 'relative' && !task.dueTime) return showToast('Set a due time first, or remind at a specific time');
                if (remKind === 'absolute' && !remAt) return;
                const r: Reminder = remKind === 'relative' ? { id: uid(), type: 'relative', minutesBefore: remBefore } : { id: uid(), type: 'absolute', at: remAt.slice(0, 16) };
                set({ reminders: [...task.reminders, r] });
                setRemAt('');
                if (notificationPermission() === 'default') void requestNotifications();
                else if (notificationPermission() === 'denied') showToast('Notifications are blocked in this browser; reminders will show inside Greenbit only');
              }}
            >
              Add reminder
            </button>
          </div>
        </fieldset>

        <fieldset className="ts-section">
          <legend>Labels</legend>
          <div className="row">
            {labels.map((l) => {
              const on = task.labels.includes(l.id);
              return (
                <button key={l.id} className={`chip${on ? ' set' : ''}`} aria-pressed={on} onClick={() => set({ labels: on ? task.labels.filter((x) => x !== l.id) : [...task.labels, l.id] })}>
                  <i className="dot" style={{ background: colorHex(l.color) }} aria-hidden="true" />@{l.name}
                </button>
              );
            })}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                const name = newLabel.trim().replace(/^@/, '');
                if (!name) return;
                const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
                const id = existing?.id ?? (await taskRepo.addLabel(name)).id;
                if (!task.labels.includes(id)) set({ labels: [...task.labels, id] });
                setNewLabel('');
              }}
            >
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New label" aria-label="New label" style={{ width: 120 }} />
            </form>
          </div>
        </fieldset>

        <div className="row">
          {task.completedAt ? (
            <button className="btn" onClick={() => void taskRepo.reopen(task.id)}>Reopen</button>
          ) : null}
          <span className="spacer" />
          <button
            className="btn danger"
            onClick={() => {
              void taskRepo.deleteTask(task.id);
              onClose();
              showToast('Task deleted', { label: 'Undo', run: () => void taskRepo.restoreTask(task) });
            }}
          >
            Delete task
          </button>
        </div>
      </div>
    </Sheet>
  );
}

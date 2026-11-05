import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQuickAdd, type Token } from '../../core/quickadd';
import { describeRecurrence } from '../../core/tasks';
import type { Label, Priority, Project, Reminder, WeekStart } from '../../core/types';
import { uid } from '../../db/repo';
import { taskRepo } from '../../db/taskRepo';
import { useUI } from '../../store/ui';
import { notificationPermission, requestNotifications } from '../../reminders/scheduler';
import { dueLabel } from './format';

export interface QuickAddDefaults {
  projectId?: string;
  dueDate?: string;
  labelId?: string;
}

interface Props {
  projects: Project[];
  labels: Label[];
  weekStartsOn: WeekStart;
  defaults?: QuickAddDefaults;
  onClose?: () => void;
  autoFocus?: boolean;
  /** Close after adding (the modal). Inline composers stay open for the next task, like Todoist. */
  closeOnAdd?: boolean;
}

/** Input with Todoist-style highlighting: the text is drawn by an overlay; the input above it is transparent. */
function HighlightInput({ value, onChange, tokens, inputRef, onKeyDown }: { value: string; onChange: (v: string) => void; tokens: Token[]; inputRef: React.RefObject<HTMLInputElement>; onKeyDown: (e: React.KeyboardEvent) => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  tokens.forEach((t, i) => {
    parts.push(value.slice(pos, t.start));
    parts.push(<mark key={i} className={`tok tok-${t.kind}`}>{value.slice(t.start, t.end)}</mark>);
    pos = t.end;
  });
  parts.push(value.slice(pos));
  return (
    <div className="hl-wrap">
      <div className="hl-overlay" ref={overlay} aria-hidden="true">
        {parts}
        {'​'}
      </div>
      <input
        ref={inputRef}
        className="hl-input"
        value={value}
        placeholder="e.g. Pay rent every month on the 1st p1 #Home @bills 9am"
        aria-label="Task name. Type dates, times, p1–p4, #project, @label and ! reminders inline."
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => overlay.current && (overlay.current.scrollLeft = e.currentTarget.scrollLeft)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export function QuickAdd({ projects, labels, weekStartsOn, defaults = {}, onClose, autoFocus = true, closeOnAdd = false }: Props) {
  const today = useUI((s) => s.today);
  const showToast = useUI((s) => s.showToast);
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [manualDate, setManualDate] = useState(defaults.dueDate ?? '');
  const [manualTime, setManualTime] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>(4);
  const [manualProject, setManualProject] = useState<string>(defaults.projectId ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(
    () => parseQuickAdd(text, today, { projects: projects.map((p) => p.name), labels: labels.map((l) => l.name), weekStartsOn }),
    [text, today, projects, labels, weekStartsOn],
  );
  const dueDate = parsed.dueDate ?? (manualDate || undefined);
  const dueTime = parsed.dueTime ?? (manualTime || undefined);
  const priority = parsed.priority ?? manualPriority;
  const projectName = parsed.project ?? projects.find((p) => p.id === manualProject)?.name;
  const labelNames = [...new Set([...(defaults.labelId ? [labels.find((l) => l.id === defaults.labelId)?.name ?? ''] : []), ...parsed.labels].filter(Boolean))];

  const submit = async () => {
    if (!parsed.title) return;
    // Capture everything, clear or close right away, then save in the background.
    const snap = { parsed, description: description.trim(), dueDate, dueTime, priority, projectName, labelNames, manualProject };
    setText('');
    setDescription('');
    if (closeOnAdd) onClose?.();
    else inputRef.current?.focus();
    try {
      const { projectId, labelIds } = await taskRepo.resolveNames(snap.projectName, snap.labelNames, projects, labels);
      const reminders: Reminder[] = snap.parsed.remindMinutesBefore !== undefined && snap.dueTime ? [{ id: uid(), type: 'relative', minutesBefore: snap.parsed.remindMinutesBefore }] : [];
      const task = await taskRepo.addTask({
        title: snap.parsed.title,
        description: snap.description || undefined,
        projectId: snap.parsed.project ? projectId : snap.manualProject || undefined,
        priority: snap.priority,
        labels: labelIds,
        dueDate: snap.dueDate,
        dueTime: snap.dueDate ? snap.dueTime : undefined,
        recurrence: snap.parsed.recurrence,
        reminders,
        createdAt: today,
      });
      if (reminders.length && notificationPermission() === 'default') void requestNotifications();
      const where = (snap.parsed.project ? snap.projectName : projects.find((p) => p.id === snap.manualProject)?.name) ?? 'Inbox';
      const note = snap.parsed.remindMinutesBefore !== undefined && !snap.dueTime ? ' (reminder skipped: add a time)' : '';
      showToast(`Task added to ${where}${note}`, { label: 'Undo', run: () => void taskRepo.deleteTask(task.id) });
    } catch (e) {
      showToast(`Couldn’t save “${snap.parsed.title}”: ${(e as Error).message}`);
    }
  };

  const due = dueDate ? dueLabel(dueDate, today) : null;

  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <HighlightInput
        value={text}
        onChange={setText}
        tokens={parsed.tokens}
        inputRef={inputRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
        }}
      />
      <textarea className="qa-desc" placeholder="Description" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
      <div className="qa-chips">
        <label className={`chip${due ? ' set' : ''}`}>
          <span aria-hidden="true">📅</span>
          <span>{due ? due.text : 'Date'}</span>
          <input type="date" value={dueDate ?? ''} onChange={(e) => setManualDate(e.target.value)} aria-label="Due date" disabled={!!parsed.dueDate} />
        </label>
        {dueDate && (
          <label className={`chip${dueTime ? ' set' : ''}`}>
            <span aria-hidden="true">🕘</span>
            <input type="time" value={dueTime ?? ''} onChange={(e) => setManualTime(e.target.value)} aria-label="Due time" disabled={!!parsed.dueTime} className="chip-time" />
          </label>
        )}
        <label className={`chip${priority < 4 ? ' set' : ''}`}>
          <span className={`flag p${priority}`} aria-hidden="true">⚑</span>
          <select value={priority} onChange={(e) => setManualPriority(Number(e.target.value) as Priority)} aria-label="Priority" disabled={!!parsed.priority}>
            {[1, 2, 3, 4].map((p) => (
              <option key={p} value={p}>P{p}</option>
            ))}
          </select>
        </label>
        {parsed.recurrence && <span className="chip set">↻ {describeRecurrence(parsed.recurrence)}</span>}
        {parsed.remindMinutesBefore !== undefined && <span className="chip set">⏰ {parsed.remindMinutesBefore} min before</span>}
        {labelNames.map((l) => (
          <span key={l} className="chip set">@{l}{!labels.some((x) => x.name.toLowerCase() === l.toLowerCase()) && ' (new)'}</span>
        ))}
      </div>
      <div className="qa-foot">
        {parsed.project ? (
          <span className="chip set">
            #{parsed.project}
            {!projects.some((p) => p.name.toLowerCase() === parsed.project!.toLowerCase()) && parsed.project.toLowerCase() !== 'inbox' && ' (new)'}
          </span>
        ) : (
          <select className="chip" value={manualProject} onChange={(e) => setManualProject(e.target.value)} aria-label="Project">
            <option value="">📥 Inbox</option>
            {projects.filter((p) => !p.archivedAt).map((p) => (
              <option key={p.id} value={p.id}># {p.name}</option>
            ))}
          </select>
        )}
        <span className="spacer" />
        {onClose && (
          <button type="button" className="btn small ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn small primary" disabled={!parsed.title}>
          Add task
        </button>
      </div>
    </form>
  );
}

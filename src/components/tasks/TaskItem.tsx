import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { describeRecurrence, isOverdue } from '../../core/tasks';
import type { Label, Project, Task } from '../../core/types';
import { colorHex } from '../../data/colors';
import { dueLabel, formatTime, nowTime } from './format';

interface Props {
  task: Task;
  today: string;
  projects: Project[];
  labels: Label[];
  showProject?: boolean;
  showDue?: boolean;
  onComplete: (t: Task) => void;
  onOpen: (t: Task) => void;
}

export function TaskItem({ task, today, projects, labels, showProject = true, showDue = true, onComplete, onOpen }: Props) {
  const [checking, setChecking] = useState(false);
  const reduce = useReducedMotion();
  const project = projects.find((p) => p.id === task.projectId);
  const due = task.dueDate ? dueLabel(task.dueDate, today, task.dueTime) : null;
  const overdue = isOverdue(task, today, nowTime());
  const done = !!task.completedAt;
  const taskLabels = task.labels.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
  const firstLine = task.description?.split('\n').find((l) => l.trim())?.replace(/[#*_`>[\]]/g, '').trim();

  return (
    <motion.li layout={!reduce} className={`task-item${done ? ' done' : ''}`} initial={false} exit={reduce ? undefined : { opacity: 0, height: 0 }}>
      <button
        className={`task-check p${task.priority}${checking || done ? ' checked' : ''}`}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        aria-pressed={done}
        onClick={() => {
          if (done) return onComplete(task);
          setChecking(true);
          window.setTimeout(() => onComplete(task), reduce ? 0 : 220);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17 9" /></svg>
      </button>
      <button className="task-body" onClick={() => onOpen(task)}>
        <span className="task-title">{task.title}</span>
        {firstLine && <span className="task-desc">{firstLine}</span>}
        <span className="task-meta">
          {!showDue && (task.dueTime || task.recurrence) && (
            <span className="due today">
              {task.dueTime ? formatTime(task.dueTime) : ''}
              {task.recurrence && <span title={describeRecurrence(task.recurrence)} aria-label={describeRecurrence(task.recurrence)}> ↻</span>}
            </span>
          )}
          {showDue && due && (
            <span className={`due ${overdue ? 'overdue' : due.tone}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18" /></svg>
              {due.text}
              {task.recurrence && <span title={describeRecurrence(task.recurrence)} aria-label={describeRecurrence(task.recurrence)}> ↻</span>}
            </span>
          )}
          {task.reminders.length > 0 && <span aria-label={`${task.reminders.length} reminder${task.reminders.length > 1 ? 's' : ''}`}>⏰</span>}
          {taskLabels.map((l) => (
            <span key={l.id} className="label-chip">
              <i style={{ background: colorHex(l.color) }} aria-hidden="true" />@{l.name}
            </span>
          ))}
          {showProject && (
            <span className="task-project">
              {project ? project.name : 'Inbox'}
              <i style={{ background: project ? colorHex(project.color) : 'var(--text-2)' }} aria-hidden="true" />
            </span>
          )}
        </span>
      </button>
    </motion.li>
  );
}

import { AnimatePresence } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import type { Label, Project, Task } from '../../core/types';
import { taskRepo } from '../../db/taskRepo';
import { useUI } from '../../store/ui';
import { QuickAdd, type QuickAddDefaults } from './QuickAdd';
import { TaskItem } from './TaskItem';
import type { WeekStart } from '../../core/types';

export function useTaskActions() {
  const today = useUI((s) => s.today);
  const showToast = useUI((s) => s.showToast);
  const [open, setOpen] = useState<string | null>(null);
  const complete = async (t: Task) => {
    if (t.completedAt) return void taskRepo.reopen(t.id);
    const change = await taskRepo.completeTask(t, today);
    showToast(change.dueDate ? `Done. Next: ${change.dueDate}` : 'Task completed', { label: 'Undo', run: () => void taskRepo.undoComplete(t) });
  };
  return { open, setOpen, complete };
}

interface Props {
  title?: ReactNode;
  action?: ReactNode;
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  today: string;
  weekStartsOn: WeekStart;
  showProject?: boolean;
  showDue?: boolean;
  addDefaults?: QuickAddDefaults;
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
  emptyHint?: ReactNode;
}

export function TaskSection({ title, action, tasks, projects, labels, today, weekStartsOn, showProject, showDue, addDefaults, onOpen, onComplete, emptyHint }: Props) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="task-section">
      {title && (
        <header className="task-section-head">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      <ul className="task-list">
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} today={today} projects={projects} labels={labels} showProject={showProject} showDue={showDue} onComplete={onComplete} onOpen={onOpen} />
          ))}
        </AnimatePresence>
      </ul>
      {tasks.length === 0 && emptyHint}
      {addDefaults &&
        (adding ? (
          <QuickAdd projects={projects} labels={labels} weekStartsOn={weekStartsOn} defaults={addDefaults} onClose={() => setAdding(false)} />
        ) : (
          <button className="add-task-btn" onClick={() => setAdding(true)}>
            <span aria-hidden="true">+</span> Add task
          </button>
        ))}
    </section>
  );
}

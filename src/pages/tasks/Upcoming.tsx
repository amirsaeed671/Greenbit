import { format } from 'date-fns';
import { useMemo } from 'react';
import { addDays, parseDate } from '../../core/dates';
import { compareTasks, isOpen } from '../../core/tasks';
import { useTaskData } from '../../db/hooks';
import { TaskSection, useTaskActions } from '../../components/tasks/TaskSection';
import { TaskSheet } from '../../components/tasks/TaskSheet';
import { useUI } from '../../store/ui';

const DAYS = 14;

export default function Upcoming() {
  const { tasks, projects, labels, settings } = useTaskData();
  const today = useUI((s) => s.today);
  const { open, setOpen, complete } = useTaskActions();
  const w = settings.weekStartsOn;

  const { overdue, byDay, later, someday } = useMemo(() => {
    const live = tasks.filter(isOpen).sort(compareTasks);
    const end = addDays(today, DAYS - 1);
    const byDay = new Map<string, typeof live>();
    for (let i = 0; i < DAYS; i++) byDay.set(addDays(today, i), []);
    for (const t of live) if (t.dueDate && t.dueDate >= today && t.dueDate <= end) byDay.get(t.dueDate)!.push(t);
    return {
      overdue: live.filter((t) => t.dueDate && t.dueDate < today),
      byDay,
      later: live.filter((t) => t.dueDate && t.dueDate > end),
      someday: live.filter((t) => !t.dueDate),
    };
  }, [tasks, today]);

  const common = { projects, labels, today, weekStartsOn: w, onOpen: (t: { id: string }) => setOpen(t.id), onComplete: complete };
  return (
    <div className="page stack">
      <h1>Upcoming</h1>
      {overdue.length > 0 && <TaskSection title="Overdue" tasks={overdue} {...common} />}
      {[...byDay.entries()].map(([d, list], i) => (
        <TaskSection
          key={d}
          title={
            <>
              {format(parseDate(d), 'MMM d')} <span className="muted"> · {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(parseDate(d), 'EEEE')}</span>
            </>
          }
          tasks={list}
          showDue={false}
          addDefaults={{ dueDate: d }}
          {...common}
        />
      ))}
      {later.length > 0 && <TaskSection title="Later" tasks={later} {...common} />}
      {someday.length > 0 && <TaskSection title="No date" tasks={someday} {...common} />}
      <TaskSheet task={tasks.find((t) => t.id === open) ?? null} projects={projects} labels={labels} onClose={() => setOpen(null)} />
    </div>
  );
}

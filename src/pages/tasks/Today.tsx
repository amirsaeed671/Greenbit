import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { compareTasks, isOpen } from '../../core/tasks';
import { periodOf } from '../../core/periods';
import { volumeForPeriod } from '../../core/volume';
import type { Habit } from '../../core/types';
import { useGardenData, useTaskData } from '../../db/hooks';
import { taskRepo } from '../../db/taskRepo';
import { TaskSection, useTaskActions } from '../../components/tasks/TaskSection';
import { TaskSheet } from '../../components/tasks/TaskSheet';
import { Plant } from '../../components/Plant';
import { EntrySheet } from '../../components/EntrySheet';
import { QuoteCard } from '../../components/QuoteCard';
import { BackupBanner } from '../../components/BackupBanner';
import { formatLong, THIS_PERIOD } from '../../components/format';
import { useUI } from '../../store/ui';
import { useState } from 'react';
import { plantState } from '../../core/plant';

export default function Today() {
  const { tasks, projects, labels, settings, loaded } = useTaskData();
  const garden = useGardenData();
  const today = useUI((s) => s.today);
  const { open, setOpen, complete } = useTaskActions();
  const [logHabit, setLogHabit] = useState<Habit | null>(null);
  const w = settings.weekStartsOn;

  const { overdue, due, doneToday } = useMemo(() => {
    const live = tasks.filter(isOpen);
    return {
      overdue: live.filter((t) => t.dueDate && t.dueDate < today).sort(compareTasks),
      due: live.filter((t) => t.dueDate === today).sort(compareTasks),
      doneToday: tasks.filter((t) => (t.completedAt && t.completedAt.slice(0, 10) === today) || t.completions?.includes(today)).length,
    };
  }, [tasks, today]);

  const habitsDue = useMemo(
    () =>
      garden.active
        .map((h) => ({ h, volume: volumeForPeriod(garden.entries, h.id, periodOf(today, h.frequency, w)), plant: plantState(h, garden.entries, today, w) }))
        .filter((x) => x.volume < x.h.minimum),
    [garden.active, garden.entries, today, w],
  );

  const total = overdue.length + due.length;
  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1>Today</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {formatLong(today)} · {total ? `${total} task${total === 1 ? '' : 's'}` : 'all clear'}
            {doneToday ? ` · ${doneToday} done today` : ''}
          </p>
        </div>
      </div>
      <QuoteCard date={today} />
      <BackupBanner settings={settings} hasData={tasks.length + garden.entries.length > 0} today={today} />

      {overdue.length > 0 && (
        <TaskSection
          title="Overdue"
          action={
            <button className="btn small ghost" onClick={() => overdue.forEach((t) => void taskRepo.updateTask(t.id, { dueDate: today }))}>
              Reschedule to today
            </button>
          }
          tasks={overdue}
          {...{ projects, labels, today, weekStartsOn: w }}
          onOpen={(t) => setOpen(t.id)}
          onComplete={complete}
        />
      )}
      <TaskSection
        title={overdue.length ? 'Today' : undefined}
        tasks={due}
        {...{ projects, labels, today, weekStartsOn: w }}
        showDue={false}
        addDefaults={{ dueDate: today }}
        onOpen={(t) => setOpen(t.id)}
        onComplete={complete}
        emptyHint={
          loaded && total === 0 ? (
            <div className="empty small-empty">
              <Plant species="daisy" stage={doneToday ? 'bloom' : 'sprout'} size={88} title="" />
              <p className="muted">{doneToday ? 'Everything for today is done. Enjoy the rest of your day.' : 'Nothing due today. Add a task below, or press Q anywhere.'}</p>
            </div>
          ) : null
        }
      />

      {habitsDue.length > 0 && (
        <section className="task-section">
          <header className="task-section-head">
            <h2>Habits to tend</h2>
            <Link className="btn small ghost" to="/habits">Garden →</Link>
          </header>
          <ul className="habit-strip">
            {habitsDue.map(({ h, volume, plant }) => (
              <li key={h.id}>
                <Plant species={h.plant} stage={plant.stage} wilting={plant.wilting} size={40} title="" />
                <Link to={`/habits/${h.id}`} className="habit-strip-name">{h.name}</Link>
                <span className="muted small">
                  {volume}/{h.minimum} {h.unit} {THIS_PERIOD[h.frequency]}
                </span>
                <span className="spacer" />
                <button className="btn small" onClick={() => setLogHabit(h)} aria-label={`Log ${h.name}`}>+ Log</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaskSheet task={tasks.find((t) => t.id === open) ?? null} projects={projects} labels={labels} onClose={() => setOpen(null)} />
      <EntrySheet habit={logHabit} date={today} entries={garden.entries} weekStartsOn={w} onClose={() => setLogHabit(null)} />
    </div>
  );
}

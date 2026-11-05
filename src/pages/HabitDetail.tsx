import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { habitHistory } from '../core/history';
import { plantState } from '../core/plant';
import { longestStreak } from '../core/streaks';
import { habitSunlight } from '../core/xp';
import { useGardenData } from '../db/hooks';
import { repo } from '../db/repo';
import { EntrySheet } from '../components/EntrySheet';
import { Plant } from '../components/Plant';
import { formatLong, formatShort, plural } from '../components/format';
import { useUI } from '../store/ui';
import { goalProgress } from '../core/goals';
import type { Goal } from '../core/types';
import { GoalCard } from '../components/goals/GoalCard';
import { GoalSheet } from '../components/goals/GoalSheet';

export default function HabitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = useUI((s) => s.today);
  const { habits, entries, settings, loaded, goals } = useGardenData();
  const [goalSheet, setGoalSheet] = useState<{ goal?: Goal } | null>(null);
  const habit = habits.find((h) => h.id === id);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const w = settings.weekStartsOn;

  const data = useMemo(() => {
    if (!habit) return null;
    const hist = habitHistory(habit, entries, today, w);
    return {
      hist,
      plant: plantState(habit, entries, today, w),
      longest: longestStreak(habit, entries, today, w),
      sunlight: habitSunlight(habit, entries, today, w),
      list: entries.filter((e) => e.habitId === habit.id).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [habit, entries, today, w]);

  if (!loaded) return null;
  if (!habit || !data) return <div className="page"><h1>Habit not found</h1><Link to="/habits">Back to garden</Link></div>;

  const last12 = data.hist.slice(-12);
  const max = Math.max(habit.stretch, ...last12.map((r) => r.volume));
  const label = (start: string) => (habit.frequency === 'monthly' ? formatShort(start).split(' ')[0] : formatShort(start));
  const met = data.hist.filter((r) => r.status === 'met').length;
  const closed = data.hist.filter((r) => r.status === 'met' || r.status === 'missed').length;

  return (
    <div className="page stack">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <div className="plant-art card" style={{ padding: 4 }}>
            <Plant species={habit.plant} stage={data.plant.stage} wilting={data.plant.wilting} size={72} />
          </div>
          <div>
            <h1>{habit.name}</h1>
            <div className="muted small" style={{ textTransform: 'capitalize' }}>
              {habit.frequency} · {habit.minimum}/{habit.target}/{habit.stretch} {habit.unit} · since {formatLong(habit.createdAt)}
              {habit.archivedAt && ' · archived'}
            </div>
          </div>
        </div>
        <div className="row">
          {!habit.archivedAt && <button className="btn primary" onClick={() => setEntryDate(today)}>Log</button>}
          <Link className="btn" to={`/habits/${habit.id}/edit`}>Edit</Link>
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><div className="muted small">Current streak</div><div className="value">{plural(data.plant.streak, habit.frequency)}</div></div>
        <div className="card stat"><div className="muted small">Longest streak</div><div className="value">{plural(data.longest, habit.frequency)}</div></div>
        <div className="card stat"><div className="muted small">Met</div><div className="value">{met}/{closed || 0}</div></div>
        <div className="card stat"><div className="muted small">Sunlight earned</div><div className="value">☀️ {data.sunlight}</div></div>
      </div>

      <section className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Goals</h2>
          <span className="spacer" />
          <button className="btn small" onClick={() => setGoalSheet({})}>+ Add goal</button>
        </div>
        {goals.filter((g) => g.habitId === habit.id).length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Set a target to grow toward, like 1,000 {habit.unit}, a 30-{habit.frequency === 'daily' ? 'day' : habit.frequency === 'weekly' ? 'week' : 'month'} streak, or meeting the minimum 50 times, with milestones along the way.</p>
        ) : (
          goals
            .filter((g) => g.habitId === habit.id)
            .map((g) => <GoalCard key={g.id} p={goalProgress(g, habit, entries, today, w)} habit={habit} onEdit={() => setGoalSheet({ goal: g })} />)
        )}
      </section>

      <section className="card">
        <h2>Last {last12.length} {habit.frequency === 'daily' ? 'days' : habit.frequency === 'weekly' ? 'weeks' : 'months'}</h2>
        <div className="bar-chart" role="img" aria-label={`Volume chart: ${last12.map((r) => `${label(r.period.start)} ${r.volume}`).join(', ')}`}>
          {last12.map((r) => (
            <div key={r.period.key} className={`bar tier-${r.tier}`} style={{ height: `${(r.volume / max) * 100}%` }} title={`${r.volume} ${habit.unit}`} />
          ))}
        </div>
        <div className="bar-chart-labels" aria-hidden="true">
          {last12.map((r) => <span key={r.period.key}>{label(r.period.start)}</span>)}
        </div>
      </section>

      <section className="card">
        <h2>Period history</h2>
        <div className="history" aria-label="Every period since you started">
          {data.hist.map((r) => (
            <i key={r.period.key} className={r.status === 'missed' ? '' : `tier-${r.tier}`} style={r.status === 'missed' ? { background: 'var(--tint-missed)', outline: '1px solid var(--danger)' } : undefined} title={`${formatShort(r.period.start)}: ${r.volume} ${habit.unit} (${r.status})`} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Entries</h2>
        {data.list.length === 0 ? (
          <p className="muted">No entries yet. Tap Log to add the first one.</p>
        ) : (
          <ul className="entry-list">
            {data.list.slice(0, 100).map((e) => (
              <li key={e.id}>
                <span>{formatLong(e.date)}</span>
                <strong>{e.volume} {habit.unit}</strong>
                {e.note && <span className="muted small">{e.note}</span>}
                <span className="spacer" />
                <button className="btn small ghost" onClick={() => setEntryDate(e.date)}>Edit</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="row">
        {habit.archivedAt ? (
          <button className="btn" onClick={() => void repo.restoreHabit(habit.id)}>Restore to garden</button>
        ) : (
          <button className="btn" onClick={() => { void repo.archiveHabit(habit.id, today); navigate('/habits'); }}>Archive</button>
        )}
        <button
          className="btn danger"
          onClick={() => {
            if (window.confirm(`Delete “${habit.name}” and all ${data.list.length} entries? This can’t be undone. Consider archiving instead.`)) {
              void repo.deleteHabit(habit.id).then(() => navigate('/habits'));
            }
          }}
        >
          Delete permanently
        </button>
      </section>

      <GoalSheet habit={habit} goal={goalSheet?.goal} open={!!goalSheet} onClose={() => setGoalSheet(null)} />
      <EntrySheet habit={entryDate ? habit : null} date={entryDate ?? today} entries={entries} weekStartsOn={w} onClose={() => setEntryDate(null)} />
    </div>
  );
}

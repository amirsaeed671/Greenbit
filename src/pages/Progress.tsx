import { useMemo } from 'react';
import { BADGES, earnedBadges } from '../core/badges';
import { plantState } from '../core/plant';
import { GARDEN_STAGES, GOAL_SUNLIGHT, levelFor, totalSunlight } from '../core/xp';
import { achievements, goalProgress } from '../core/goals';
import { GoalCard } from '../components/goals/GoalCard';
import { formatLong } from '../components/format';
import { Link } from 'react-router-dom';
import { useGardenData } from '../db/hooks';
import { Plant } from '../components/Plant';
import { useUI } from '../store/ui';

export default function Progress() {
  const { habits, active, entries, settings, goals } = useGardenData();
  const today = useUI((s) => s.today);
  const w = settings.weekStartsOn;
  const { lvl, earned, plants, goalRows, wins, bonus } = useMemo(() => {
    const goalRows = goals
      .map((g) => ({ g, habit: habits.find((h) => h.id === g.habitId) }))
      .filter((x) => x.habit && !x.habit.archivedAt)
      .map(({ g, habit }) => ({ habit: habit!, p: goalProgress(g, habit!, entries, today, w) }));
    const wins = achievements(goalRows);
    const bonus = wins.reduce((s, a) => s + (a.final ? GOAL_SUNLIGHT.goal : GOAL_SUNLIGHT.milestone), 0);
    return {
      lvl: levelFor(totalSunlight(habits, entries, today, w) + bonus),
      earned: earnedBadges(habits, entries, today, w, goals),
      plants: active.map((h) => ({ h, s: plantState(h, entries, today, w) })),
      goalRows,
      wins,
      bonus,
    };
  }, [habits, active, entries, today, w, goals]);
  const activeGoals = goalRows.filter((r) => r.p.status === 'active' || r.p.status === 'upcoming');

  return (
    <div className="page stack">
      <h1>Progress</h1>
      <section className="card stack">
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Level {lvl.level}</h2>
          <span className="muted">{lvl.stage}</span>
          <span className="spacer" />
          <strong>☀️ {lvl.sunlight} sunlight</strong>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={lvl.currentAt} aria-valuemax={lvl.nextAt} aria-valuenow={lvl.sunlight} aria-label="Progress to next level">
          <div className="fill tier-stretch" style={{ width: `${lvl.progress * 100}%` }} />
        </div>
        <p className="muted small">
          {lvl.nextAt - lvl.sunlight} more sunlight to level {lvl.level + 1}. Each period earns sunlight once for the best tier you reach: below 1 · minimum 10 · target 15 · stretch 25. Milestones add {GOAL_SUNLIGHT.milestone} and finished goals {GOAL_SUNLIGHT.goal}
          {bonus ? ` (${bonus} so far)` : ''}.
        </p>
        <ol className="row small muted" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }} aria-label="Garden stages">
          {GARDEN_STAGES.map((s) => (
            <li key={s} className={`btn small${s === lvl.stage ? ' primary' : ''}`} style={{ cursor: 'default' }} aria-current={s === lvl.stage ? 'step' : undefined}>
              {s}
            </li>
          ))}
        </ol>
      </section>

      {plants.length > 0 && (
        <section className="card">
          <h2>Your plants</h2>
          <div className="row" style={{ gap: 16 }}>
            {plants.map(({ h, s }) => (
              <div key={h.id} style={{ textAlign: 'center', width: 88 }}>
                <Plant species={h.plant} stage={s.stage} wilting={s.wilting} size={72} />
                <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                <div className="muted small" style={{ textTransform: 'capitalize' }}>{s.stage}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Goals & milestones</h2>
        {goalRows.length === 0 && (
          <p className="muted small" style={{ margin: 0 }}>
            No goals yet. Open a habit from the <Link to="/habits">garden</Link> and add one, like a total to reach or a streak to build, with milestones on the way.
          </p>
        )}
        {activeGoals.map(({ p, habit }) => (
          <GoalCard key={p.goal.id} p={p} habit={habit} showHabit />
        ))}
        {wins.length > 0 && (
          <>
            <h3 style={{ margin: '8px 0 0' }}>Reached</h3>
            <ol className="timeline">
              {wins.slice(0, 20).map((a, i) => (
                <li key={i} className={a.final ? 'final' : ''}>
                  <span className="tl-dot" aria-hidden="true">{a.final ? '🏆' : '◆'}</span>
                  <div>
                    <strong>{a.final ? `${a.goal.title}` : `${a.label}${a.goal.kind === 'total' ? ` ${a.habit.unit}` : ''}`}</strong>
                    <div className="muted small">
                      {a.final ? 'Goal achieved' : a.goal.title} · {a.habit.name} · {formatLong(a.date)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section>
        <h2>Badges</h2>
        <div className="badges">
          {BADGES.map((b) => {
            const has = earned.has(b.id);
            return (
              <div key={b.id} className={`card badge${has ? '' : ' locked'}`} aria-label={`${b.name}: ${b.description} ${has ? 'Earned' : 'Not yet earned'}`}>
                <div className="icon" aria-hidden="true">{b.icon}</div>
                <strong>{b.name}</strong>
                <div className="muted small">{b.description}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

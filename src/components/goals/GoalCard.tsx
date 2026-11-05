import { describeGoal, type GoalProgress } from '../../core/goals';
import type { Habit } from '../../core/types';
import { formatLong, formatShort } from '../format';

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));

export function GoalCard({ p, habit, onEdit, showHabit = false }: { p: GoalProgress; habit: Habit; onEdit?: () => void; showHabit?: boolean }) {
  const { goal } = p;
  const unit = goal.kind === 'total' ? ` ${habit.unit}` : '';
  let statusText: string;
  let tone: 'good' | 'warn' | 'muted' = 'muted';
  if (p.status === 'achieved') {
    statusText = `Achieved ${formatLong(p.achievedAt!)}`;
    tone = 'good';
  } else if (p.status === 'missed') statusText = `Deadline passed ${formatShort(goal.deadline!)}`;
  else if (p.status === 'upcoming') statusText = `Starts ${formatShort(goal.startDate)}`;
  else if (p.pace) {
    tone = p.pace.onTrack ? 'good' : 'warn';
    const need = goal.kind === 'total' ? `${fmt(Math.ceil(p.pace.perDayNeeded * 10) / 10)}${unit}/day to finish` : `${p.pace.daysLeft} days left`;
    statusText = `${p.pace.onTrack ? 'On track' : 'Behind pace'} · ${need} by ${formatShort(goal.deadline!)}`;
  } else statusText = 'No deadline';

  return (
    <div className={`goal-card${p.status === 'achieved' ? ' achieved' : ''}`}>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <strong className="goal-title">
          {p.status === 'achieved' && <span aria-hidden="true">🏆 </span>}
          {goal.title || describeGoal(goal, habit)}
        </strong>
        {showHabit && <span className="muted small">{habit.name}</span>}
        <span className="spacer" />
        {onEdit && (
          <button className="btn small ghost" onClick={onEdit} aria-label={`Edit goal ${goal.title}`}>
            Edit
          </button>
        )}
      </div>
      <div
        className="goal-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-valuenow={p.value}
        aria-valuetext={`${fmt(p.value)} of ${fmt(goal.target)}${unit}; ${p.milestones.filter((m) => m.achievedAt).length} of ${p.milestones.length} milestones reached`}
      >
        <div className="goal-fill" style={{ width: `${p.ratio * 100}%` }} />
        {p.pace && <span className="goal-pace" style={{ left: `${Math.min(100, (p.pace.expected / goal.target) * 100)}%` }} title="Where you'd be at an even pace" />}
        {p.milestones.map((m) => (
          <span key={m.value} className={`goal-ms${m.achievedAt ? ' hit' : ''}`} style={{ left: `${(m.value / goal.target) * 100}%` }} title={`${fmt(m.value)}${m.achievedAt ? ` reached ${formatShort(m.achievedAt)}` : ''}`} />
        ))}
      </div>
      <div className="row small" style={{ gap: 6 }}>
        <strong>
          {fmt(p.value)} / {fmt(goal.target)}
          {unit}
        </strong>
        {goal.kind === 'streak' && p.current !== undefined && <span className="muted">· current run {p.current}</span>}
        <span className="spacer" />
        <span className={`goal-status ${tone}`}>{statusText}</span>
      </div>
      {p.milestones.length > 0 && (
        <ul className="ms-list" aria-label="Milestones">
          {p.milestones.map((m) => (
            <li key={m.value} className={m.achievedAt ? 'hit' : ''}>
              <span aria-hidden="true">{m.achievedAt ? '◆' : '◇'}</span> {fmt(m.value)}
              {unit}
              {m.achievedAt ? <span className="muted"> · {formatShort(m.achievedAt)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

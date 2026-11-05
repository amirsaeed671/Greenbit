import { useEffect, useState } from 'react';
import { describeGoal, suggestMilestones } from '../../core/goals';
import type { Goal, GoalKind, Habit } from '../../core/types';
import { repo, uid } from '../../db/repo';
import { useUI } from '../../store/ui';
import { Sheet } from '../Sheet';

const KINDS: { id: GoalKind; label: string; help: (h: Habit) => string }[] = [
  { id: 'total', label: 'Total', help: (h) => `Add up ${h.unit} from the start date, e.g. 1,000 ${h.unit}.` },
  { id: 'streak', label: 'Streak', help: (h) => `Meet the minimum this many ${h.frequency === 'daily' ? 'days' : h.frequency === 'weekly' ? 'weeks' : 'months'} in a row.` },
  { id: 'met', label: 'Times met', help: (h) => `Meet the minimum this many ${h.frequency === 'daily' ? 'days' : h.frequency === 'weekly' ? 'weeks' : 'months'} in total (no need to be in a row).` },
];

export function GoalSheet({ habit, goal, open, onClose }: { habit: Habit; goal?: Goal; open: boolean; onClose: () => void }) {
  const today = useUI((s) => s.today);
  const [kind, setKind] = useState<GoalKind>('total');
  const [target, setTarget] = useState('');
  const [start, setStart] = useState(today);
  const [deadline, setDeadline] = useState('');
  const [milestones, setMilestones] = useState('');
  const [touchedMilestones, setTouchedMilestones] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind(goal?.kind ?? 'total');
    setTarget(goal ? String(goal.target) : '');
    setStart(goal?.startDate ?? today);
    setDeadline(goal?.deadline ?? '');
    setMilestones(goal ? goal.milestones.join(', ') : '');
    setTouchedMilestones(!!goal);
    setTitle(goal?.title ?? '');
  }, [open, goal, today]);

  const n = Number(target);
  const valid = n > 0 && (!deadline || deadline >= start);
  const ms = milestones
    .split(/[,\s]+/)
    .map(Number)
    .filter((x) => x > 0 && x < n);
  const draft: Goal = { id: goal?.id ?? '', habitId: habit.id, title: '', kind, target: n || 0, startDate: start, milestones: ms, createdAt: '' };

  const save = async () => {
    if (!valid) return;
    const data: Goal = {
      ...(goal ?? { id: uid(), createdAt: today }),
      habitId: habit.id,
      kind,
      target: n,
      startDate: start,
      deadline: deadline || undefined,
      milestones: [...new Set(ms)].sort((a, b) => a - b),
      title: title.trim() || describeGoal(draft, habit),
    } as Goal;
    await repo.save('goals', data);
    onClose();
  };

  return (
    <Sheet open={open} title={goal ? 'Edit goal' : `New goal for ${habit.name}`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <span className="label" id="goal-kind">Kind of goal</span>
          <div className="segmented" role="radiogroup" aria-labelledby="goal-kind">
            {KINDS.map((k) => (
              <button type="button" key={k.id} role="radio" aria-checked={kind === k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <span className="help">{KINDS.find((k) => k.id === kind)!.help(habit)}</span>
        </div>
        <div className="grid-3">
          <label className="field">
            <span className="label">Target{kind === 'total' ? ` (${habit.unit})` : ''}</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (!touchedMilestones) setMilestones(suggestMilestones(Number(e.target.value) || 0).join(', '));
              }}
              required
            />
          </label>
          <label className="field">
            <span className="label">Counting from</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value || today)} />
          </label>
          <label className="field">
            <span className="label">Deadline (optional)</span>
            <input type="date" value={deadline} min={start} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="label">Milestones</span>
          <input
            value={milestones}
            onChange={(e) => {
              setMilestones(e.target.value);
              setTouchedMilestones(true);
            }}
            placeholder="e.g. 250, 500, 750"
          />
          <span className="help">Checkpoints on the way, separated by commas. They show up in Progress and Insights when you reach them.</span>
        </label>
        <label className="field">
          <span className="label">Name (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={n > 0 ? describeGoal(draft, habit) : 'e.g. Read 20 books this year'} maxLength={80} />
        </label>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!valid}>
            {goal ? 'Save goal' : 'Set goal'}
          </button>
          <span className="spacer" />
          {goal && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                void repo.remove('goals', goal.id);
                onClose();
              }}
            >
              Delete goal
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

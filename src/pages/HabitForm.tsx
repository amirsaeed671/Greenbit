import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Frequency } from '../core/types';
import { validateHabitThresholds } from '../core/validation';
import { PLANTS } from '../data/plants';
import { repo } from '../db/repo';
import { useGardenData } from '../db/hooks';
import { Plant } from '../components/Plant';
import { useUI } from '../store/ui';

const PER: Record<Frequency, string> = { daily: 'per day', weekly: 'per week', monthly: 'per month' };

export default function HabitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = useUI((s) => s.today);
  const { habits, loaded } = useGardenData();
  const existing = id ? habits.find((h) => h.id === id) : undefined;

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [minimum, setMinimum] = useState('1');
  const [target, setTarget] = useState('2');
  const [stretch, setStretch] = useState('3');
  const [plant, setPlant] = useState(PLANTS[0].id);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setUnit(existing.unit);
    setFrequency(existing.frequency);
    setMinimum(String(existing.minimum));
    setTarget(String(existing.target));
    setStretch(String(existing.stretch));
    setPlant(existing.plant);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (id && loaded && !existing) return <div className="page"><h1>Habit not found</h1></div>;

  const nums = { minimum: Number(minimum), target: Number(target), stretch: Number(stretch) };
  const errors: Record<string, string | undefined> = {
    name: name.trim() ? undefined : 'Give your habit a name.',
    unit: unit.trim() ? undefined : 'What do you count? e.g. pages, minutes, sessions.',
    ...validateHabitThresholds(nums.minimum, nums.target, nums.stretch),
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const thresholdsChanged = existing && (existing.minimum !== nums.minimum || existing.target !== nums.target || existing.stretch !== nums.stretch || existing.frequency !== frequency);
  const u = unit.trim() || 'units';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    const data = { name: name.trim(), unit: unit.trim(), frequency, ...nums, plant };
    if (existing) {
      await repo.updateHabit(existing.id, data);
      navigate(`/habits/${existing.id}`);
    } else {
      const newId = await repo.addHabit({ ...data, createdAt: today });
      navigate(`/habits/${newId}`, { replace: true });
    }
  };

  const err = (k: string) =>
    touched && errors[k] ? (
      <span className="error" id={`${k}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const inv = (k: string) => ({ 'aria-invalid': touched && !!errors[k], 'aria-describedby': `${k}-help ${k}-err` });

  return (
    <div className="page">
      <h1>{existing ? 'Edit habit' : 'Plant a new habit'}</h1>
      <form className="card stack" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Read" maxLength={60} {...inv('name')} />
          {err('name')}
        </div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="unit">Unit</label>
            <input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pages" maxLength={24} {...inv('unit')} />
            <span className="help" id="unit-help">What you count.</span>
            {err('unit')}
          </div>
          <div className="field">
            <label htmlFor="frequency">Frequency</label>
            <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="minimum">Minimum</label>
            <input id="minimum" type="number" inputMode="decimal" min="0" step="any" value={minimum} onChange={(e) => setMinimum(e.target.value)} {...inv('minimum')} />
            <span className="help" id="minimum-help">
              The least that still counts. Hit {nums.minimum || '…'} {u} {PER[frequency]} and the {PER[frequency].replace('per ', '')} is ✓ done.
            </span>
            {err('minimum')}
          </div>
          <div className="field">
            <label htmlFor="target">Target</label>
            <input id="target" type="number" inputMode="decimal" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} {...inv('target')} />
            <span className="help" id="target-help">
              What a normal good {PER[frequency].replace('per ', '')} looks like: {nums.target || '…'} {u}.
            </span>
            {err('target')}
          </div>
          <div className="field">
            <label htmlFor="stretch">Stretch</label>
            <input id="stretch" type="number" inputMode="decimal" min="0" step="any" value={stretch} onChange={(e) => setStretch(e.target.value)} {...inv('stretch')} />
            <span className="help" id="stretch-help">
              A great {PER[frequency].replace('per ', '')}, beyond expectations: {nums.stretch || '…'} {u} makes it bloom gold.
            </span>
            {err('stretch')}
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ fontWeight: 700, marginBottom: 6 }}>Plant</legend>
          <div className="row" role="radiogroup">
            {PLANTS.map((p) => (
              <label key={p.id} className="card" style={{ padding: 6, cursor: 'pointer', borderColor: plant === p.id ? 'var(--brand)' : undefined, borderWidth: plant === p.id ? 2 : 1, textAlign: 'center' }}>
                <input type="radio" name="plant" value={p.id} checked={plant === p.id} onChange={() => setPlant(p.id)} className="sr-only" />
                <Plant species={p.id} stage="bloom" size={56} title={p.name} />
                <div className="small">{p.name}</div>
              </label>
            ))}
          </div>
        </fieldset>

        {thresholdsChanged && (
          <p className="banner small" role="note">
            Changing the frequency or thresholds recalculates your whole history: past ticks, streaks and sunlight are re-derived from your entries using the new values.
          </p>
        )}

        <div className="row">
          <button className="btn primary" type="submit">{existing ? 'Save changes' : 'Plant it'}</button>
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

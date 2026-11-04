import { useEffect, useMemo, useState } from 'react';
import { periodOf } from '../core/periods';
import type { Entry, Habit, WeekStart } from '../core/types';
import { tierForVolume, tierIndex, volumeForPeriod } from '../core/volume';
import { repo } from '../db/repo';
import { useUI } from '../store/ui';
import { IconMinus, IconPlus } from './Icons';
import { Sheet } from './Sheet';
import { formatLong } from './format';

interface Props {
  habit: Habit | null;
  date: string;
  entries: Entry[];
  weekStartsOn: WeekStart;
  onClose: () => void;
}

const PRESETS = [1, 5, 10];

export function EntrySheet({ habit, date: initialDate, entries, weekStartsOn, onClose }: Props) {
  const today = useUI((s) => s.today);
  const celebrate = useUI((s) => s.celebrate);
  const showToast = useUI((s) => s.showToast);
  const [amount, setAmount] = useState('1');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [editing, setEditing] = useState<{ id: string; volume: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setAmount('1');
    setNote('');
    setDate(initialDate);
    setEditing(null);
    setError('');
  }, [habit?.id, initialDate]);

  const dayEntries = useMemo(() => (habit ? entries.filter((e) => e.habitId === habit.id && e.date === date) : []), [entries, habit, date]);

  if (!habit) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;

  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && date <= today;
  const period = periodOf(date, habit.frequency, weekStartsOn);

  const save = async () => {
    if (!valid) {
      setError(date > today ? 'You can’t log entries in the future.' : 'Enter an amount greater than 0.');
      return;
    }
    const before = volumeForPeriod(entries, habit.id, period);
    await repo.addEntry({ habitId: habit.id, date, volume: n, note: note.trim() || undefined });
    const tb = tierForVolume(before, habit);
    const ta = tierForVolume(before + n, habit);
    if (tierIndex(ta) > tierIndex(tb) && (ta === 'minimum' || ta === 'target' || ta === 'stretch')) celebrate({ tier: ta, habitName: habit.name });
    else showToast(`Logged ${n} ${habit.unit}`);
    setAmount('1');
    setNote('');
    onClose();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const v = Number(editing.volume);
    if (!(v > 0)) return setError('Enter an amount greater than 0.');
    await repo.updateEntry(editing.id, { volume: v });
    setEditing(null);
  };

  return (
    <Sheet open title={habit.name} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="stack"
      >
        <div className="field">
          <label htmlFor="entry-date">Date</label>
          <input id="entry-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          {date !== today && <span className="help">Backfilling {formatLong(date)}.</span>}
        </div>
        <div>
          <span className="label" id="amount-label" style={{ fontWeight: 700 }}>
            How many {habit.unit}?
          </span>
          <div className="stepper">
            <button type="button" className="btn icon-btn" aria-label="Decrease" onClick={() => setAmount(String(Math.max(1, (Number(amount) || 1) - 1)))}>
              <IconMinus width={20} height={20} />
            </button>
            <input
              aria-labelledby="amount-label"
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
            <button type="button" className="btn icon-btn" aria-label="Increase" onClick={() => setAmount(String((Number(amount) || 0) + 1))}>
              <IconPlus width={20} height={20} />
            </button>
          </div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="btn small" onClick={() => setAmount(String((Number(amount) || 0) + p))}>
                +{p}
              </button>
            ))}
            {[habit.minimum, habit.target, habit.stretch]
              .filter((v, i, a) => a.indexOf(v) === i && !PRESETS.includes(v))
              .map((v) => (
                <button key={`s${v}`} type="button" className="btn small" onClick={() => setAmount(String(v))}>
                  ={v}
                </button>
              ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="entry-note">Note (optional)</label>
          <input id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
        {error && (
          <p className="error" role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {error}
          </p>
        )}
        <button className="btn primary" type="submit">
          Log {Number.isFinite(n) && n > 0 ? n : ''} {habit.unit}
        </button>
      </form>

      {dayEntries.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h3>Entries on {formatLong(date)}</h3>
          <ul className="entry-list">
            {dayEntries.map((e) => (
              <li key={e.id}>
                {editing?.id === e.id ? (
                  <>
                    <input
                      aria-label="Edit amount"
                      type="number"
                      min="0"
                      step="any"
                      value={editing.volume}
                      onChange={(ev) => setEditing({ id: e.id, volume: ev.target.value })}
                      style={{ width: 90, minHeight: 36, borderRadius: 8, border: '1px solid var(--border)', padding: '0 8px' }}
                    />
                    <span className="spacer" />
                    <button className="btn small primary" onClick={() => void saveEdit()}>Save</button>
                    <button className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <strong>
                      {e.volume} {habit.unit}
                    </strong>
                    {e.note && <span className="muted small">{e.note}</span>}
                    <span className="spacer" />
                    <button className="btn small ghost" onClick={() => setEditing({ id: e.id, volume: String(e.volume) })}>Edit</button>
                    <button className="btn small ghost" onClick={() => void repo.deleteEntry(e.id)} aria-label={`Delete entry of ${e.volume} ${habit.unit}`}>
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

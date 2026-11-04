import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { periodOf } from '../core/periods';
import { plantState } from '../core/plant';
import type { Habit } from '../core/types';
import { volumeForPeriod } from '../core/volume';
import { useGardenData } from '../db/hooks';
import { BackupBanner } from '../components/BackupBanner';
import { EntrySheet } from '../components/EntrySheet';
import { IconFlame, IconPlus } from '../components/Icons';
import { Plant } from '../components/Plant';
import { QuoteCard } from '../components/QuoteCard';
import { ThresholdBar } from '../components/ThresholdBar';
import { plural, THIS_PERIOD } from '../components/format';
import { useUI } from '../store/ui';

export default function Garden() {
  const { loaded, active, entries, settings } = useGardenData();
  const today = useUI((s) => s.today);
  const [quickAdd, setQuickAdd] = useState<Habit | null>(null);
  const w = settings.weekStartsOn;

  const cards = useMemo(
    () =>
      active.map((h) => ({
        habit: h,
        plant: plantState(h, entries, today, w),
        volume: volumeForPeriod(entries, h.id, periodOf(today, h.frequency, w)),
      })),
    [active, entries, today, w],
  );

  return (
    <div className="page stack">
      <div className="page-head">
        <h1>Your garden</h1>
        {active.length > 0 && (
          <Link className="btn primary" to="/habits/new">
            <IconPlus width={18} height={18} /> New habit
          </Link>
        )}
      </div>
      <QuoteCard date={today} />
      <BackupBanner settings={settings} hasData={entries.length > 0} today={today} />

      {loaded && active.length === 0 && (
        <div className="card empty">
          <Plant species="daisy" stage="seed" size={120} title="An empty pot, waiting for a seed" />
          <h2>Plant your first habit</h2>
          <p className="muted">Each habit grows into a plant. Log a little, often, and watch it bloom. Everything stays on this device.</p>
          <Link className="btn primary" to="/habits/new">
            <IconPlus width={18} height={18} /> Plant a habit
          </Link>
        </div>
      )}

      <section className="garden" aria-label="Habits">
        {cards.map(({ habit, plant, volume }) => (
          <article key={habit.id} className="card plant-card">
            <div className="plant-top">
              <div className="plant-art">
                <Plant species={habit.plant} stage={plant.stage} wilting={plant.wilting} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3>
                  <Link to={`/habits/${habit.id}`}>{habit.name}</Link>
                </h3>
                <div className="muted small" style={{ textTransform: 'capitalize' }}>
                  {habit.frequency} · {plant.stage}
                </div>
                <div className="streak" aria-label={`Current streak ${plural(plant.streak, habit.frequency)}`}>
                  <IconFlame width={16} height={16} /> {plural(plant.streak, habit.frequency)}
                </div>
              </div>
              <button className="btn primary icon-btn" aria-label={`Log ${habit.name}`} onClick={() => setQuickAdd(habit)}>
                <IconPlus width={22} height={22} />
              </button>
            </div>
            <div>
              <div className="muted small" style={{ marginBottom: 4 }}>
                {THIS_PERIOD[habit.frequency]}
              </div>
              <ThresholdBar habit={habit} volume={volume} />
            </div>
            {plant.wilting && <div className="wilting-note">A little thirsty. One good {habit.frequency === 'daily' ? 'day' : habit.frequency === 'weekly' ? 'week' : 'month'} will perk it up.</div>}
          </article>
        ))}
      </section>

      <EntrySheet habit={quickAdd} date={today} entries={entries} weekStartsOn={w} onClose={() => setQuickAdd(null)} />
    </div>
  );
}

import { useMemo } from 'react';
import { BADGES, earnedBadges } from '../core/badges';
import { plantState } from '../core/plant';
import { GARDEN_STAGES, levelFor, totalSunlight } from '../core/xp';
import { useGardenData } from '../db/hooks';
import { Plant } from '../components/Plant';
import { useUI } from '../store/ui';

export default function Progress() {
  const { habits, active, entries, settings } = useGardenData();
  const today = useUI((s) => s.today);
  const w = settings.weekStartsOn;
  const { lvl, earned, plants } = useMemo(() => {
    const sun = totalSunlight(habits, entries, today, w);
    return {
      lvl: levelFor(sun),
      earned: earnedBadges(habits, entries, today, w),
      plants: active.map((h) => ({ h, s: plantState(h, entries, today, w) })),
    };
  }, [habits, active, entries, today, w]);

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
          {lvl.nextAt - lvl.sunlight} more sunlight to level {lvl.level + 1}. Each period earns sunlight once for the best tier you reach: below 1 · minimum 10 · target 15 · stretch 25.
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

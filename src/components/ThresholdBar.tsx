import type { Habit } from '../core/types';
import { tierForVolume } from '../core/volume';

export function ThresholdBar({ habit, volume }: { habit: Habit; volume: number }) {
  const max = habit.stretch * 1.1;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const tier = tierForVolume(volume, habit);
  return (
    <div>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={habit.stretch}
        aria-valuenow={volume}
        aria-valuetext={`${volume} of ${habit.minimum} minimum, ${habit.target} target, ${habit.stretch} stretch ${habit.unit}`}
      >
        <div className={`fill tier-${tier === 'none' ? 'below' : tier}`} style={{ width: pct(volume) }} />
        <span className="tick" style={{ left: pct(habit.minimum) }} />
        <span className="tick" style={{ left: pct(habit.target) }} />
        <span className="tick" style={{ left: pct(habit.stretch) }} />
      </div>
      <div className="progress-legend" aria-hidden="true">
        <span>
          {volume} {habit.unit}
        </span>
        <span>
          min {habit.minimum} · target {habit.target} · stretch {habit.stretch}
        </span>
      </div>
    </div>
  );
}

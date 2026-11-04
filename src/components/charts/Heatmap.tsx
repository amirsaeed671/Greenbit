import { useState } from 'react';
import { addDays, parseDate } from '../../core/dates';
import { formatLong } from '../format';
import { periodOf } from '../../core/periods';
import type { DayActivity } from '../../core/analytics';
import type { WeekStart } from '../../core/types';
import { Tooltip } from './ChartParts';
import { useWidth } from './useWidth';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weeks as columns, weekdays as rows; one-hue ramp; shows as many recent weeks as fit at >=10px cells. */
export function Heatmap({
  days,
  weekStartsOn,
  label,
  describe,
  levels,
}: {
  days: DayActivity[];
  weekStartsOn: WeekStart;
  label: string;
  describe: (d: DayActivity) => { value: string; label: string };
  levels: string[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<DayActivity | null>(null);
  const byDate = new Map(days.map((d) => [d.date, d]));
  if (!days.length) return null;
  const first = periodOf(days[0].date, 'weekly', weekStartsOn).start;
  const last = days[days.length - 1].date;
  const weeks: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 7)) weeks.push(d);
  const left = 30;
  const gap = 2;
  const cell = Math.max(10, Math.min(20, Math.floor((width - left) / weeks.length) - gap));
  const fit = Math.max(1, Math.floor((width - left) / (cell + gap)));
  const shown = weeks.slice(-fit);
  const top = 16;
  const height = top + 7 * (cell + gap);
  const dow = [...DOW.slice(weekStartsOn), ...DOW.slice(0, weekStartsOn)];
  const pos = (wi: number, di: number) => ({ x: left + wi * (cell + gap), y: top + di * (cell + gap) });

  let lastMonth = '';
  return (
    <div className="chart-wrap" ref={ref}>
      {shown.length < weeks.length && <p className="muted small" style={{ margin: '0 0 6px' }}>Showing the last {shown.length} weeks that fit; the table view has every day.</p>}
      <svg width={Math.min(width, left + shown.length * (cell + gap))} height={height} role="img" aria-label={label} className="chart-svg">
        {dow.map((d, i) =>
          i % 2 === 0 ? (
            <text key={d} x={0} y={pos(0, i).y + cell / 2} dy="0.32em" className="chart-axis">
              {d}
            </text>
          ) : null,
        )}
        {shown.map((wk, wi) => {
          const m = wk.slice(0, 7);
          const label = m !== lastMonth ? parseDate(`${m}-01`).toLocaleString(undefined, { month: 'short' }) : '';
          lastMonth = m;
          return (
            <g key={wk}>
              {label && wi < shown.length - 1 && (
                <text x={pos(wi, 0).x} y={10} className="chart-axis">
                  {label}
                </text>
              )}
              {Array.from({ length: 7 }, (_, di) => {
                const date = addDays(wk, di);
                const d = byDate.get(date);
                if (!d || d.level === null) return null;
                const p = pos(wi, di);
                return (
                  <rect
                    key={date}
                    x={p.x}
                    y={p.y}
                    width={cell}
                    height={cell}
                    rx={3}
                    className={`heat-${d.level}${active?.date === date ? ' heat-active' : ''}`}
                    onPointerEnter={() => setActive(d)}
                    onPointerLeave={() => setActive(null)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="heat-legend" aria-hidden="true">
        <span>{levels[0]}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`heat-${l}`} />
        ))}
        <span>{levels[1]}</span>
      </div>
      {active &&
        (() => {
          const wi = shown.indexOf(periodOf(active.date, 'weekly', weekStartsOn).start);
          const di = dow.indexOf(DOW[parseDate(active.date).getDay()]);
          const p = pos(wi, di);
          const t = describe(active);
          return <Tooltip x={p.x + cell} y={p.y} width={width} title={formatLong(active.date)} rows={[t]} />;
        })()}
    </div>
  );
}

import { useState } from 'react';
import type { GoalProgress } from '../../core/goals';
import { formatLong, formatShort } from '../format';
import { fmtNum, niceMax, stepKeys, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';

const M = { top: 14, right: 76, bottom: 26, left: 44 };

/**
 * One goal over time: the progress line (accent), the target and milestone levels as labelled
 * hairlines, a muted even-pace line when there's a deadline, and a dot where each milestone was hit.
 */
export function GoalChart({ p, unit, height = 200 }: { p: GoalProgress; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const { goal, series } = p;
  if (series.length < 2) return <p className="muted small">The chart appears after the first day of this goal.</p>;
  const w = Math.max(100, width - M.left - M.right);
  const h = height - M.top - M.bottom;
  const max = niceMax(Math.max(goal.target, ...series.map((s) => s.value)));
  const n = series.length;
  const x = (i: number) => M.left + (i / (n - 1)) * w;
  const y = (v: number) => M.top + h - (v / max) * h;
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`).join('');
  const idx = new Map(series.map((s, i) => [s.date, i]));
  const levels = [...p.milestones.map((m) => ({ v: m.value, label: fmtNum(m.value) })), { v: goal.target, label: `goal ${fmtNum(goal.target)}` }];
  for (let i = 1; i < levels.length; i++) if (y(levels[i - 1].v) - y(levels[i].v) < 14) levels[i - 1].label = ''; // avoid label pile-ups
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));
  // Even pace from 0 at the start to the target at the deadline (only drawn over the visible days).
  let pace: string | null = null;
  if (goal.deadline) {
    const total = (new Date(goal.deadline).getTime() - new Date(goal.startDate).getTime()) / 86400000 + 1;
    pace = `M${x(0)} ${y(0)}L${x(n - 1)} ${y(Math.min(goal.target, (goal.target * n) / total))}`;
  }
  const a = active !== null ? series[active] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${goal.title}: ${fmtNum(p.value)} of ${fmtNum(goal.target)} ${unit}.`}
        tabIndex={0}
        className="chart-svg"
        onKeyDown={(e) => stepKeys(e, n, active, setActive)}
        onBlur={() => setActive(null)}
      >
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + w} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{fmtNum(t)}</text>
          </g>
        ))}
        {levels.map((l) => (
          <g key={l.v}>
            <line x1={M.left} x2={M.left + w} y1={y(l.v)} y2={y(l.v)} className="chart-ref" />
            {l.label && <text x={M.left + w + 6} y={y(l.v)} dy="0.32em" className="chart-axis">{l.label}</text>}
          </g>
        ))}
        {pace && <path d={pace} className="chart-pace" />}
        <path d={`${line}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} className="chart-area" />
        <path d={line} className="chart-line" />
        {p.milestones.filter((m) => m.achievedAt && idx.has(m.achievedAt)).map((m) => (
          <circle key={m.value} cx={x(idx.get(m.achievedAt!)!)} cy={y(m.value)} r={4} className="chart-dot ring" />
        ))}
        {p.achievedAt && idx.has(p.achievedAt) && <circle cx={x(idx.get(p.achievedAt)!)} cy={y(goal.target)} r={5} className="chart-dot ring" />}
        {series.map((s, i) => (i % every === 0 ? <text key={s.date} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : 'middle'} className="chart-axis">{formatShort(s.date)}</text> : null))}
        {a && active !== null && <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + h} className="chart-crosshair" pointerEvents="none" />}
        <rect
          x={M.left}
          y={M.top}
          width={w}
          height={h}
          fill="transparent"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setActive(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
          }}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {a && active !== null && <Tooltip x={x(active)} y={y(a.value)} width={width} title={formatLong(a.date)} rows={[{ value: `${fmtNum(a.value)}${goal.kind === 'total' ? ` ${unit}` : ''}`, label: `of ${fmtNum(goal.target)}`, key: true }]} />}
    </div>
  );
}

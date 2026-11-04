import { useState } from 'react';
import { fmtPct, stepKeys, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';

export interface LinePoint {
  label: string; // axis label
  title: string; // tooltip heading
  value: number | null; // 0..1
  detail: string; // secondary tooltip text
}

const M = { top: 16, right: 44, bottom: 26, left: 40 };

/** Single-series percentage line: 2px stroke, 10% wash, end dot with surface ring, crosshair tooltip. */
export function LineChart({ points, label, height = 200 }: { points: LinePoint[]; label: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const w = Math.max(120, width - M.left - M.right);
  const h = height - M.top - M.bottom;
  const n = points.length;
  const x = (i: number) => M.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => M.top + h - v * h;

  // Line segments skip gaps (buckets with nothing decided).
  const segs: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segs.push(cur);
      cur = '';
    } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const areas = segs.map((d) => {
    const xs = [...d.matchAll(/[ML]([\d.]+)/g)].map((m) => m[1]);
    return `${d}L${xs[xs.length - 1]} ${M.top + h}L${xs[0]} ${M.top + h}Z`;
  });
  const lastIdx = points.map((p) => p.value !== null).lastIndexOf(true);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    setActive(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / box.width) * (n - 1)))));
  };
  const a = active !== null ? points[active] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => stepKeys(e, n, active, setActive)}
        onBlur={() => setActive(null)}
        className="chart-svg"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + w} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">
              {fmtPct(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} className="chart-axis">
              {i % every === 0 && i !== n - 1 && n - 1 - i < every / 2 ? '' : p.label}
            </text>
          ) : null,
        )}
        {areas.map((d, i) => <path key={i} d={d} className="chart-area" />)}
        {segs.map((d, i) => <path key={i} d={d} className="chart-line" />)}
        {/* Isolated points (no neighbours) still need a visible mark. */}
        {points.map((p, i) =>
          p.value !== null && (i === 0 || points[i - 1].value === null) && (i === n - 1 || points[i + 1].value === null) && i !== lastIdx ? (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={3} className="chart-dot" />
          ) : null,
        )}
        {lastIdx >= 0 && (
          <g>
            <circle cx={x(lastIdx)} cy={y(points[lastIdx].value!)} r={4} className="chart-dot ring" />
            <text x={x(lastIdx) + 8} y={y(points[lastIdx].value!)} dy="0.32em" className="chart-label">
              {fmtPct(points[lastIdx].value)}
            </text>
          </g>
        )}
        {a && active !== null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + h} className="chart-crosshair" />
            {a.value !== null && <circle cx={x(active)} cy={y(a.value)} r={4} className="chart-dot ring" />}
          </g>
        )}
        <rect x={M.left - 8} y={M.top} width={w + 16} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {a && active !== null && <Tooltip x={x(active)} y={a.value !== null ? y(a.value) : M.top + h / 2} width={width} title={a.title} rows={[{ value: fmtPct(a.value), label: a.detail, key: true }]} />}
    </div>
  );
}

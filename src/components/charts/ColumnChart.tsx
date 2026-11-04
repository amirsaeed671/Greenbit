import { useState } from 'react';
import { fmtNum, niceMax, stepKeys, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';

export interface Column {
  label: string;
  title: string;
  value: number;
  detail: string;
  /** Lighter fill, e.g. a period still in progress. */
  muted?: boolean;
}

export interface RefLine {
  value: number;
  label: string;
}

const M = { top: 14, bottom: 26, left: 40 };

/** Single-hue columns (<=24px, 4px rounded top, square base), optional reference lines, per-column tooltip. */
export function ColumnChart({ columns, label, refLines = [], height = 200, format = fmtNum, max: forcedMax }: { columns: Column[]; label: string; refLines?: RefLine[]; height?: number; format?: (v: number) => string; max?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const right = refLines.length ? 64 : 12;
  const w = Math.max(80, width - M.left - right);
  const h = height - M.top - M.bottom;
  const n = columns.length;
  const max = forcedMax ?? niceMax(Math.max(...columns.map((c) => c.value), ...refLines.map((r) => r.value), 0));
  const slot = w / Math.max(1, n);
  const bw = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => M.top + h - (v / max) * h;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 56))));

  // Avoid overlapping reference labels by nudging each at least 12px apart.
  const refs = [...refLines].sort((a, b) => a.value - b.value).map((r) => ({ ...r, ly: y(r.value) }));
  for (let i = 1; i < refs.length; i++) if (refs[i - 1].ly - refs[i].ly < 12) refs[i].ly = refs[i - 1].ly - 12;

  const bar = (i: number, v: number) => {
    const x0 = M.left + i * slot + (slot - bw) / 2;
    const top = y(v);
    const base = M.top + h;
    const r = Math.min(4, bw / 2, base - top);
    if (v <= 0) return '';
    return `M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${base}Z`;
  };
  const a = active !== null ? columns[active] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label} tabIndex={0} onKeyDown={(e) => stepKeys(e, n, active, setActive)} onBlur={() => setActive(null)} className="chart-svg">
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + w} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">
              {format(t)}
            </text>
          </g>
        ))}
        {columns.map((c, i) => (
          <path key={i} d={bar(i, c.value)} className={`chart-bar${c.muted ? ' muted' : ''}${active === i ? ' active' : ''}`} />
        ))}
        {columns.map((c, i) =>
          i % every === 0 ? (
            <text key={i} x={M.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" className="chart-axis">
              {c.label}
            </text>
          ) : null,
        )}
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={M.left} x2={M.left + w} y1={y(r.value)} y2={y(r.value)} className="chart-ref" />
            <text x={M.left + w + 6} y={r.ly} dy="0.32em" className="chart-axis">
              {r.label}
            </text>
          </g>
        ))}
        {columns.map((_, i) => (
          <rect key={i} x={M.left + i * slot} y={M.top} width={slot} height={h} fill="transparent" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} />
        ))}
      </svg>
      {a && active !== null && <Tooltip x={M.left + active * slot + slot / 2} y={y(a.value)} width={width} title={a.title} rows={[{ value: format(a.value), label: a.detail }]} />}
    </div>
  );
}

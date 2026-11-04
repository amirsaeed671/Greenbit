import type { ReactNode } from 'react';

export interface TipRow {
  value: string;
  label: string;
  /** Draw a short line key in the accent colour. */
  key?: boolean;
}

/** One tooltip: values lead (strong), labels follow. React text nodes keep labels inert. */
export function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TipRow[] }) {
  const left = Math.max(4, Math.min(x + 12, width - 184));
  return (
    <div className="chart-tip" style={{ left, top: Math.max(0, y - 8) }} role="presentation">
      <div className="chart-tip-title">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="chart-tip-row">
          {r.key && <i className="chart-tip-key" aria-hidden="true" />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children, table, legend }: { title: string; subtitle?: ReactNode; children: ReactNode; table?: ReactNode; legend?: ReactNode }) {
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <h2>{title}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </header>
      {legend}
      {children}
      {table && (
        <details className="chart-table">
          <summary>Table view</summary>
          <div className="chart-table-scroll">{table}</div>
        </details>
      )}
    </section>
  );
}

/** Clean y-axis ticks: 0, ~half, max, rounded to 1/2/5 × 10^n. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export const fmtNum = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}K` : Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
export const fmtPct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Keyboard stepping for a focusable chart: ←/→ move, Home/End jump, Esc clears. */
export function stepKeys(e: React.KeyboardEvent, n: number, active: number | null, set: (i: number | null) => void) {
  const map: Record<string, () => number | null> = {
    ArrowRight: () => Math.min(n - 1, (active ?? -1) + 1),
    ArrowLeft: () => Math.max(0, (active ?? n) - 1),
    Home: () => 0,
    End: () => n - 1,
    Escape: () => null,
  };
  if (map[e.key]) {
    e.preventDefault();
    set(map[e.key]());
  }
}

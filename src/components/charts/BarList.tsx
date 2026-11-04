export interface BarRow {
  id: string;
  label: string;
  value: number;
  /** Text printed at the bar end, e.g. "82% · 41 of 50". */
  display: string;
}

/** Horizontal bars in one hue, on a shared baseline, labelled at the tip. */
export function BarList({ rows, max, label }: { rows: BarRow[]; max: number; label: string }) {
  return (
    <ul className="bar-list" aria-label={label}>
      {rows.map((r) => (
        <li key={r.id}>
          <span className="bar-list-label">{r.label}</span>
          <span className="bar-list-track" aria-hidden="true">
            <span className="bar-list-fill" style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} />
          </span>
          <span className="bar-list-value">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

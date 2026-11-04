import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { combinedDay, dayCell } from '../core/calendar';
import { addMonths } from '../core/dates';
import type { Habit, Tier } from '../core/types';
import { repo } from '../db/repo';
import { useGardenData } from '../db/hooks';
import { EntrySheet } from '../components/EntrySheet';
import { IconLeft, IconRight } from '../components/Icons';
import { dayNumber, MonthGrid } from '../components/MonthGrid';
import { Sheet } from '../components/Sheet';
import { formatLong, formatMonth } from '../components/format';
import { useUI } from '../store/ui';

const TIER_LABEL: Record<Tier, string> = { none: 'No entries', below: 'Below minimum', minimum: 'Minimum', target: 'Target', stretch: 'Stretch' };

export function Legend() {
  return (
    <div className="legend" aria-label="Colour legend">
      {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
        <span key={t}>
          <i className={`tier-${t}`} /> {TIER_LABEL[t]}
          {t === 'stretch' ? ' ★' : ''}
        </span>
      ))}
      <span>✓ met</span>
      <span>✗ missed</span>
    </div>
  );
}

export default function CalendarPage() {
  const { loaded, active, entries, settings } = useGardenData();
  const today = useUI((s) => s.today);
  const month = useUI((s) => s.calendarMonth);
  const setMonth = useUI((s) => s.setCalendarMonth);
  const habitId = useUI((s) => s.calendarHabitId);
  const setHabitId = useUI((s) => s.setCalendarHabitId);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [entryFor, setEntryFor] = useState<{ habit: Habit; date: string } | null>(null);
  const mode = settings.calendarMode;
  const w = settings.weekStartsOn;
  const habit = active.find((h) => h.id === habitId) ?? active[0];

  const combined = useMemo(() => new Map<string, ReturnType<typeof combinedDay>>(), [active, entries, today, w]);
  const getCombined = (d: string) => {
    if (!combined.has(d)) combined.set(d, combinedDay(active, entries, d, today, w));
    return combined.get(d)!;
  };

  if (loaded && active.length === 0)
    return (
      <div className="page">
        <h1>Calendar</h1>
        <div className="card empty">
          <p className="muted">No habits yet. Your calendar fills in as you log.</p>
          <Link className="btn primary" to="/habits/new">Plant a habit</Link>
        </div>
      </div>
    );

  return (
    <div className="page stack">
      <div className="page-head">
        <h1>Calendar</h1>
        <div className="segmented" role="group" aria-label="Calendar mode">
          <button aria-pressed={mode === 'per-habit'} onClick={() => void repo.updateSettings({ calendarMode: 'per-habit' })}>Per habit</button>
          <button aria-pressed={mode === 'combined'} onClick={() => void repo.updateSettings({ calendarMode: 'combined' })}>Combined</button>
        </div>
      </div>

      <div className="card">
        <div className="cal-toolbar">
          <button className="btn icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
            <IconLeft width={20} height={20} />
          </button>
          <div className="cal-month" aria-live="polite">{formatMonth(month)}</div>
          <button className="btn icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
            <IconRight width={20} height={20} />
          </button>
          <button className="btn small ghost" onClick={() => setMonth(today)}>Today</button>
          <span className="spacer" />
          {mode === 'per-habit' && habit && (
            <select aria-label="Habit" value={habit.id} onChange={(e) => setHabitId(e.target.value)} className="btn small" style={{ paddingRight: 8 }}>
              {active.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          )}
        </div>

        {habit && (
          <MonthGrid
            month={month}
            weekStartsOn={w}
            renderDay={(d, inMonth) => {
              const future = d > today;
              const cls = ['cal-day', !inMonth && 'outside', d === today && 'today', future && 'future'];
              if (mode === 'per-habit') {
                const c = dayCell(habit, entries, d, today, w);
                if (c.tint) cls.push(`tint-${c.tint}`);
                const showHint = c.tint === 'open' && d === c.period.end;
                const label = `${formatLong(d)}: ${c.volume ? `${c.volume} ${habit.unit}, ${TIER_LABEL[c.tier]}` : 'no entries'}${c.mark === 'tick' ? ', met' : c.mark === 'cross' ? ', missed' : ''}`;
                return (
                  <button className={cls.filter(Boolean).join(' ')} onClick={() => !future && setDaySheet(d)} aria-label={label} aria-disabled={future}>
                    <span className="num">{dayNumber(d)}</span>
                    <span className={`dot ${c.volume ? `tier-${c.tier}` : ''}`}>
                      {c.mark === 'tick' && <span className="mark">✓</span>}
                      {c.mark === 'cross' && <span className="mark cross">✗</span>}
                      {!c.mark && c.tier === 'stretch' && <span className="mark" aria-hidden>★</span>}
                    </span>
                    {showHint && (
                      <span className="hint">
                        {c.periodVolume}/{habit.minimum}
                      </span>
                    )}
                  </button>
                );
              }
              const c = getCombined(d);
              const label = `${formatLong(d)}: ${c.total ? `${c.met} of ${c.total} habits met` : 'nothing due'}`;
              return (
                <button className={cls.filter(Boolean).join(' ')} onClick={() => !future && setDaySheet(d)} aria-label={label} aria-disabled={future}>
                  <span className="num">{dayNumber(d)}</span>
                  <span className={`dot ${c.total && c.habits.some((h) => h.contribution !== null && h.tier !== 'none') ? `tier-${c.avgTier}` : ''}`}>
                    {c.mark === 'tick' && <span className="mark">✓</span>}
                    {c.mark === 'cross' && <span className="mark cross">✗</span>}
                    {c.mark === 'partial' && <span className="partial">{c.met}/{c.total}</span>}
                  </span>
                </button>
              );
            }}
          />
        )}
        <Legend />
        {mode === 'per-habit' && habit && habit.frequency !== 'daily' && (
          <p className="muted small" style={{ marginTop: 8 }}>
            The ✓ lands on the day this {habit.frequency === 'weekly' ? 'week' : 'month'} reached its minimum. The whole period is tinted green when met, and rose only once it ends unmet.
          </p>
        )}
      </div>

      <Sheet open={!!daySheet && !entryFor} title={daySheet ? formatLong(daySheet) : ''} onClose={() => setDaySheet(null)}>
        {daySheet && (
          <ul className="entry-list">
            {(mode === 'per-habit' && habit ? [habit] : active).map((h) => {
              const c = dayCell(h, entries, daySheet, today, w);
              const list = entries.filter((e) => e.habitId === h.id && e.date === daySheet);
              return (
                <li key={h.id}>
                  <span className={`legend`} style={{ margin: 0 }}><i className={`tier-${c.tier}`} /></span>
                  <strong>{h.name}</strong>
                  <span className="muted small">
                    {list.length ? `${c.volume} ${h.unit} (${list.length} ${list.length === 1 ? 'entry' : 'entries'})` : 'nothing logged'}
                    {c.mark === 'tick' ? ' · ✓ met' : c.mark === 'cross' ? ' · ✗ missed' : ''}
                    {h.frequency !== 'daily' && ` · ${h.frequency === 'weekly' ? 'week' : 'month'}: ${c.periodVolume}/${h.minimum}`}
                  </span>
                  <span className="spacer" />
                  <button className="btn small" onClick={() => setEntryFor({ habit: h, date: daySheet })}>
                    {list.length ? 'Add / edit' : 'Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
      <EntrySheet habit={entryFor?.habit ?? null} date={entryFor?.date ?? today} entries={entries} weekStartsOn={w} onClose={() => setEntryFor(null)} />
    </div>
  );
}

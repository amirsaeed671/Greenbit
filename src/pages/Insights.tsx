import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { completionTrend, dailyActivity, habitRates, OUTCOMES, rangeStart, summarize, trendBucket, volumeSeries, weekdayActivity, type DayActivity, type Outcome, type RangePreset } from '../core/analytics';
import { addDays, maxDate } from '../core/dates';
import { useGardenData } from '../db/hooks';
import { BarList } from '../components/charts/BarList';
import { ChartCard, fmtNum, fmtPct } from '../components/charts/ChartParts';
import { ColumnChart } from '../components/charts/ColumnChart';
import { Heatmap } from '../components/charts/Heatmap';
import { LineChart } from '../components/charts/LineChart';
import { formatLong, formatShort, plural } from '../components/format';
import { useUI } from '../store/ui';

const RANGES: { id: RangePreset; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];
const OUTCOME_LABEL: Record<Outcome, string> = { missed: 'Nothing logged', below: 'Below min', minimum: 'Minimum', target: 'Target', stretch: 'Stretch' };
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIER_WORD = ['nothing logged', 'below minimum', 'minimum', 'target', 'stretch'];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

export default function Insights() {
  const { loaded, active, entries, settings } = useGardenData();
  const today = useUI((s) => s.today);
  const [range, setRange] = useState<RangePreset>('90d');
  const [habitId, setHabitId] = useState<string>('all');
  const w = settings.weekStartsOn;
  const selected = useMemo(() => (habitId === 'all' ? active : active.filter((h) => h.id === habitId)), [active, habitId]);
  const single = habitId !== 'all' && selected.length === 1 ? selected[0] : null;

  const data = useMemo(() => {
    if (!selected.length) return null;
    const start = rangeStart(range, today, selected);
    const firstCreated = selected.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), today);
    const heatStart = maxDate(maxDate(start, firstCreated), addDays(today, -370));
    const dates: string[] = [];
    for (let d = heatStart; d <= today; d = addDays(d, 1)) dates.push(d);
    return {
      start,
      summary: summarize(selected, entries, today, w, start),
      trend: completionTrend(selected, entries, today, w, start),
      bucket: trendBucket(maxDate(start, firstCreated), today),
      volume: single ? volumeSeries(single, entries, today, w, start) : null,
      rates: single ? [] : habitRates(selected, entries, today, w, start),
      weekdays: weekdayActivity(selected, entries, today, w, start),
      heat: dailyActivity(selected, entries, today, dates),
    };
  }, [selected, entries, today, w, range, single]);

  if (loaded && active.length === 0)
    return (
      <div className="page">
        <h1>Insights</h1>
        <div className="card empty">
          <p className="muted">Charts appear once you have a habit and a few entries.</p>
          <Link className="btn primary" to="/habits/new">Plant a habit</Link>
        </div>
      </div>
    );
  if (!data) return null;
  const { summary: s } = data;
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase();
  const subject = single ? single.name : 'all habits';
  const bucketWord = data.bucket === 'weekly' ? 'week' : 'month';
  const periodLabel = (start: string) => (data.bucket === 'monthly' ? formatShort(start).split(' ')[0] : formatShort(start));
  const outcomeMax = Math.max(...OUTCOMES.map((o) => s.outcomes[o]), 1);

  const heatDescribe = (d: DayActivity) =>
    single
      ? { value: d.volume ? `${fmtNum(d.volume)} ${single.unit}` : 'Nothing', label: TIER_WORD[d.level ?? 0] }
      : { value: `${d.tended} of ${d.active}`, label: d.active === 1 ? 'habit tended' : 'habits tended' };

  return (
    <div className="page stack">
      <h1>Insights</h1>

      <div className="filter-row" role="group" aria-label="Filters">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <select aria-label="Habit" className="btn small" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
          <option value="all">All habits</option>
          {active.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      <div className="stats">
        <Stat label="Completion rate" value={fmtPct(s.rate)} sub={s.decided ? `${s.met} of ${s.decided} periods met` : 'No finished periods yet'} />
        <Stat label="Days with entries" value={`${s.activeDays}`} sub={`of ${s.totalDays} days`} />
        <Stat
          label={single ? 'Current streak' : 'Best current streak'}
          value={s.bestCurrentStreak ? plural(s.bestCurrentStreak.streak, s.bestCurrentStreak.habit.frequency) : '—'}
          sub={single ? `Longest: ${plural(s.longestStreak, single.frequency)}` : s.bestCurrentStreak?.streak ? s.bestCurrentStreak.habit.name : undefined}
        />
        <Stat label="Sunlight earned" value={`☀️ ${fmtNum(s.sunlight)}`} sub={range === 'all' ? 'all time' : `last ${rangeLabel}`} />
      </div>

      <ChartCard
        title="Completion rate"
        subtitle={`Share of ${subject === 'all habits' ? 'periods across all habits' : 'periods'} met, by ${bucketWord}. Periods still in progress count once they’re met.`}
        table={
          <table>
            <thead><tr><th>{data.bucket === 'weekly' ? 'Week of' : 'Month'}</th><th>Met</th><th>Finished</th><th>Rate</th></tr></thead>
            <tbody>{data.trend.map((p) => <tr key={p.start}><td>{data.bucket === 'weekly' ? formatShort(p.start) : periodLabel(p.start) + ' ' + p.start.slice(0, 4)}</td><td>{p.met}</td><td>{p.decided}</td><td>{fmtPct(p.rate)}</td></tr>)}</tbody>
          </table>
        }
      >
        <LineChart
          label={`Completion rate by ${bucketWord} for ${subject}. Latest: ${fmtPct(data.trend.filter((p) => p.rate !== null).pop()?.rate ?? null)}.`}
          points={data.trend.map((p) => ({
            label: periodLabel(p.start),
            title: data.bucket === 'weekly' ? `Week of ${formatShort(p.start)}` : `${periodLabel(p.start)} ${p.start.slice(0, 4)}`,
            value: p.rate,
            detail: p.decided ? `${p.met} of ${p.decided} met` : 'Nothing finished yet',
          }))}
        />
      </ChartCard>

      <div className="chart-grid-2">
        {single && data.volume ? (
          <ChartCard
            title={data.volume.averaged ? 'Average per day, by week' : `Volume per ${single.frequency === 'daily' ? 'day' : single.frequency === 'weekly' ? 'week' : 'month'}`}
            subtitle={`${single.unit} logged, against your minimum, target and stretch lines. A lighter bar is still in progress.`}
            table={
              <table>
                <thead><tr><th>Period</th><th>{single.unit}</th><th>Tier</th></tr></thead>
                <tbody>{data.volume.points.map((p) => <tr key={p.start}><td>{p.start === p.end ? formatLong(p.start) : `${formatShort(p.start)} – ${formatShort(p.end)}`}</td><td>{fmtNum(p.volume)}</td><td>{p.tier === 'none' ? '—' : p.tier}</td></tr>)}</tbody>
              </table>
            }
          >
            <ColumnChart
              label={`${single.name} volume per period`}
              columns={data.volume.points.map((p) => ({
                label: single.frequency === 'monthly' ? formatShort(p.start).split(' ')[0] : formatShort(p.start),
                title: p.start === p.end ? formatLong(p.start) : `${formatShort(p.start)} – ${formatShort(p.end)}`,
                value: p.volume,
                detail: `${single.unit}${p.tier !== 'none' ? ` · ${p.tier === 'below' ? 'below minimum' : p.tier}` : ''}${p.open ? ' · in progress' : ''}`,
                muted: p.open,
              }))}
              refLines={[
                { value: single.minimum, label: `min ${fmtNum(single.minimum)}` },
                { value: single.target, label: `target ${fmtNum(single.target)}` },
                { value: single.stretch, label: `stretch ${fmtNum(single.stretch)}` },
              ]}
            />
          </ChartCard>
        ) : (
          <ChartCard
            title="Completion by habit"
            subtitle={`Share of finished periods met in the last ${rangeLabel}, best first.`}
            table={
              <table>
                <thead><tr><th>Habit</th><th>Met</th><th>Finished</th><th>Rate</th></tr></thead>
                <tbody>{data.rates.map((r) => <tr key={r.habit.id}><td>{r.habit.name}</td><td>{r.met}</td><td>{r.decided}</td><td>{fmtPct(r.rate)}</td></tr>)}</tbody>
              </table>
            }
          >
            <BarList
              label="Completion rate per habit"
              max={1}
              rows={data.rates.map((r) => ({ id: r.habit.id, label: r.habit.name, value: r.rate ?? 0, display: r.decided ? `${fmtPct(r.rate)} · ${r.met}/${r.decided}` : 'not yet' }))}
            />
          </ChartCard>
        )}

        <ChartCard
          title="How periods turned out"
          subtitle="Every finished period: missed ones (nothing logged, or below the minimum), then met ones by the highest tier reached."
          table={
            <table>
              <thead><tr><th>Outcome</th><th>Periods</th><th>Share</th></tr></thead>
              <tbody>{OUTCOMES.map((o) => <tr key={o}><td>{OUTCOME_LABEL[o]}</td><td>{s.outcomes[o]}</td><td>{fmtPct(s.decided ? s.outcomes[o] / s.decided : null)}</td></tr>)}</tbody>
            </table>
          }
        >
          <BarList
            label="Outcome of finished periods"
            max={outcomeMax}
            rows={OUTCOMES.map((o) => ({ id: o, label: OUTCOME_LABEL[o], value: s.outcomes[o], display: `${s.outcomes[o]}${s.decided ? ` · ${fmtPct(s.outcomes[o] / s.decided)}` : ''}` }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Consistency"
        subtitle={single ? `Each day coloured by how far you got with ${single.name}.` : 'Each day coloured by the share of your habits you logged something for.'}
        table={
          <table>
            <thead><tr><th>Date</th><th>{single ? single.unit : 'Habits tended'}</th></tr></thead>
            <tbody>{[...data.heat].reverse().filter((d) => d.level !== null).map((d) => { const t = heatDescribe(d); return <tr key={d.date}><td>{formatLong(d.date)}</td><td>{t.value} {single ? `(${t.label})` : ''}</td></tr>; })}</tbody>
          </table>
        }
      >
        <Heatmap days={data.heat} weekStartsOn={w} label={`Daily consistency heatmap for ${subject}`} describe={heatDescribe} levels={single ? ['Nothing', 'Stretch'] : ['None', 'All']} />
      </ChartCard>

      <ChartCard
        title="Your days of the week"
        subtitle="How often you logged something on each weekday."
        table={
          <table>
            <thead><tr><th>Weekday</th><th>Days logged</th><th>Days</th><th>Rate</th></tr></thead>
            <tbody>{data.weekdays.map((d) => <tr key={d.dow}><td>{DOW[d.dow]}</td><td>{d.logged}</td><td>{d.days}</td><td>{fmtPct(d.rate)}</td></tr>)}</tbody>
          </table>
        }
      >
        <ColumnChart
          label="Share of days with an entry, by weekday"
          max={1}
          format={(v) => fmtPct(v)}
          height={180}
          columns={data.weekdays.map((d) => ({ label: DOW[d.dow].slice(0, 3), title: DOW[d.dow], value: d.rate ?? 0, detail: `${d.logged} of ${d.days} ${DOW[d.dow]}s` }))}
        />
      </ChartCard>
    </div>
  );
}

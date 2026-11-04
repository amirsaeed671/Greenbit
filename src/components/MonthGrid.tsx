import type { ReactNode } from 'react';
import { addDays, parseDate } from '../core/dates';
import { periodOf } from '../core/periods';
import type { WeekStart } from '../core/types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Lays out a month as full weeks; renderDay receives each date and whether it's inside the month. */
export function MonthGrid({ month, weekStartsOn, renderDay }: { month: string; weekStartsOn: WeekStart; renderDay: (date: string, inMonth: boolean) => ReactNode }) {
  const m = periodOf(month, 'monthly');
  const start = periodOf(m.start, 'weekly', weekStartsOn).start;
  const end = periodOf(m.end, 'weekly', weekStartsOn).end;
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const dow = [...DOW.slice(weekStartsOn), ...DOW.slice(0, weekStartsOn)];
  return (
    <div className="cal-grid" role="grid" aria-label="Month">
      {dow.map((d) => (
        <div key={d} className="cal-dow" role="columnheader">
          {d}
        </div>
      ))}
      {days.map((d) => (
        <div key={d} role="gridcell" style={{ display: 'contents' }}>
          {renderDay(d, d >= m.start && d <= m.end)}
        </div>
      ))}
    </div>
  );
}

export const dayNumber = (d: string) => parseDate(d).getDate();

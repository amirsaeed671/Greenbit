import { useEffect, useState } from 'react';
import { to12h, to24h } from './tasks/format';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/**
 * A 12-hour time picker (hour, minute, AM/PM) that looks the same on every device,
 * unlike <input type="time">, which follows the phone's 24-hour setting.
 * Value in and out is 24-hour "HH:mm" (how times are stored), or undefined for none.
 */
export function TimeSelect({ value: external, onChange: emitChange, label = 'Time', allowClear = true, disabled = false, className = '' }: { value?: string; onChange: (v: string | undefined) => void; label?: string; allowClear?: boolean; disabled?: boolean; className?: string }) {
  // Hold the selection locally so quick successive picks (hour, then minutes, then AM/PM) build on
  // each other instead of on a saved value that hasn't come back from storage yet.
  const [value, setValue] = useState(external);
  useEffect(() => setValue(external), [external]);
  const onChange = (v: string | undefined) => {
    setValue(v);
    emitChange(v);
  };
  const [h, m] = value ? value.split(':').map(Number) : [NaN, NaN];
  const has = Number.isFinite(h);
  const { hour, period } = has ? to12h(h) : { hour: NaN, period: (new Date().getHours() < 12 ? 'AM' : 'PM') as 'AM' | 'PM' };
  // Keep an exact minute (e.g. 9:07 from quick add) selectable even though the list steps by 5.
  const minutes = has && !MINUTES.includes(m) ? [...MINUTES, m].sort((a, b) => a - b) : MINUTES;
  const emit = (nh: number, nm: number, np: 'AM' | 'PM') => onChange(`${pad(to24h(nh, np))}:${pad(nm)}`);

  return (
    <span className={`time-select ${className}`} role="group" aria-label={label}>
      <select aria-label={`${label}: hour`} value={has ? hour : ''} disabled={disabled} onChange={(e) => (e.target.value ? emit(Number(e.target.value), has ? m : 0, period) : onChange(undefined))}>
        <option value="">--</option>
        {HOURS.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label}: minutes`} value={has ? m : ''} disabled={disabled || !has} onChange={(e) => emit(hour, Number(e.target.value), period)}>
        {!has && <option value="">--</option>}
        {minutes.map((x) => (
          <option key={x} value={x}>{pad(x)}</option>
        ))}
      </select>
      <select aria-label={`${label}: AM or PM`} value={period} disabled={disabled || !has} onChange={(e) => emit(hour, m, e.target.value as 'AM' | 'PM')}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {allowClear && has && !disabled && (
        <button type="button" className="time-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(undefined)}>
          ✕
        </button>
      )}
    </span>
  );
}

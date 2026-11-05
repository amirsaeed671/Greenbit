import { addDays, addMonths, isValidDateStr, parseDate } from './dates';
import { periodOf } from './periods';
import { firstOccurrence } from './tasks';
import type { Priority, Recurrence, WeekStart } from './types';

export type TokenKind = 'date' | 'time' | 'recurrence' | 'priority' | 'project' | 'label' | 'reminder';
export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
}

export interface QuickAdd {
  title: string;
  priority?: Priority;
  project?: string; // name as typed or matched
  labels: string[];
  dueDate?: string;
  dueTime?: string;
  recurrence?: Recurrence;
  remindMinutesBefore?: number;
  tokens: Token[];
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = '(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON_RE = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const UNIT: Record<string, Recurrence['freq']> = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };

const dayIndex = (s: string) => DAY_NAMES.findIndex((d) => d.startsWith(s.toLowerCase().slice(0, 3)));
const pad = (n: number) => String(n).padStart(2, '0');

function nextWeekday(today: string, d: number): string {
  const diff = (d - parseDate(today).getDay() + 7) % 7;
  return addDays(today, diff);
}

function monthDate(today: string, month: number, day: number, year?: number): string | undefined {
  const y = year ?? parseDate(today).getFullYear();
  const s = `${y}-${pad(month + 1)}-${pad(day)}`;
  if (!isValidDateStr(s)) return undefined;
  // "Jan 3" typed in December means next year
  return year === undefined && s < today ? `${y + 1}-${pad(month + 1)}-${pad(day)}` : s;
}

interface Rule {
  kind: TokenKind;
  re: RegExp;
  apply: (m: RegExpExecArray, out: QuickAdd) => boolean; // false = not actually a match
}

export function parseQuickAdd(input: string, today: string, opts: { projects?: string[]; labels?: string[]; weekStartsOn?: WeekStart } = {}): QuickAdd {
  const out: QuickAdd = { title: '', labels: [], tokens: [] };
  const w = opts.weekStartsOn ?? 1;
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => taken.every(([a, b]) => e <= a || s >= b);

  // Known multi-word project/label names first, longest first, so "#Side project" works.
  const known = (prefix: '#' | '@', names: string[], kind: TokenKind) => {
    for (const name of [...names].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(^|\\s)(${prefix}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\s|$)`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(input))) {
        const s = m.index + m[1].length;
        const e = s + m[2].length;
        if (!free(s, e)) continue;
        taken.push([s, e]);
        out.tokens.push({ kind, start: s, end: e, text: m[2] });
        if (kind === 'project') out.project ??= name;
        else if (!out.labels.includes(name)) out.labels.push(name);
      }
    }
  };
  known('#', opts.projects ?? [], 'project');
  known('@', opts.labels ?? [], 'label');

  const rules: Rule[] = [
    {
      kind: 'recurrence',
      re: /\bevery(!)?\s+(?:month\s+on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/gi,
      apply: (m, o) => {
        const day = Number(m[2]);
        if (day < 1 || day > 31) return false;
        o.recurrence = { freq: 'monthly', interval: 1, byMonthDay: day, ...(m[1] ? { fromCompletion: true } : {}) };
        return true;
      },
    },
    {
      kind: 'recurrence',
      re: new RegExp(`\\bevery(!)?\\s+(?:(\\d+|other)\\s+)?(day|week|month|year)s?\\b`, 'gi'),
      apply: (m, o) => {
        const interval = m[2] === 'other' ? 2 : m[2] ? Number(m[2]) : 1;
        o.recurrence = { freq: UNIT[m[3].toLowerCase()], interval, ...(m[1] ? { fromCompletion: true } : {}) };
        return true;
      },
    },
    {
      kind: 'recurrence',
      re: /\bevery(!)?\s+(weekday|weekend)s?\b/gi,
      apply: (m, o) => {
        o.recurrence = { freq: 'weekly', interval: 1, byWeekday: m[2].toLowerCase() === 'weekday' ? [1, 2, 3, 4, 5] : [0, 6], ...(m[1] ? { fromCompletion: true } : {}) };
        return true;
      },
    },
    {
      kind: 'recurrence',
      re: new RegExp(`\\bevery(!)?\\s+(${DAY_RE}(?:\\s*(?:,|and|&)\\s*${DAY_RE})*)\\b`, 'gi'),
      apply: (m, o) => {
        const days = [...new Set(m[2].split(/\s*(?:,|and|&)\s*/i).map(dayIndex))].filter((d) => d >= 0);
        o.recurrence = { freq: 'weekly', interval: 1, byWeekday: days, ...(m[1] ? { fromCompletion: true } : {}) };
        return true;
      },
    },
    {
      kind: 'recurrence',
      re: /\b(daily|weekly|monthly|yearly|annually)\b/gi,
      apply: (m, o) => {
        const k = m[1].toLowerCase();
        o.recurrence = { freq: k === 'annually' ? 'yearly' : (k as Recurrence['freq']), interval: 1 };
        return true;
      },
    },
    {
      kind: 'time',
      re: /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi,
      apply: (m, o) => {
        let h = Number(m[1]) % 12;
        if (m[3].toLowerCase() === 'pm') h += 12;
        const min = Number(m[2] ?? 0);
        if (Number(m[1]) > 12 || min > 59) return false;
        o.dueTime = `${pad(h)}:${pad(min)}`;
        return true;
      },
    },
    {
      kind: 'time',
      re: /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/gi,
      apply: (m, o) => {
        o.dueTime = `${pad(Number(m[1]))}:${m[2]}`;
        return true;
      },
    },
    { kind: 'date', re: /\b(?:today|tod)\b/gi, apply: (_m, o) => ((o.dueDate = today), true) },
    { kind: 'date', re: /\b(?:tomorrow|tmrw?|tom)\b/gi, apply: (_m, o) => ((o.dueDate = addDays(today, 1)), true) },
    { kind: 'date', re: /\bnext\s+week\b/gi, apply: (_m, o) => ((o.dueDate = addDays(periodOf(today, 'weekly', w).end, 1)), true) },
    { kind: 'date', re: /\bnext\s+month\b/gi, apply: (_m, o) => ((o.dueDate = `${addMonths(today.slice(0, 8) + '01', 1)}`), true) },
    {
      kind: 'date',
      re: /\bin\s+(\d+)\s+(day|week|month)s?\b/gi,
      apply: (m, o) => {
        const n = Number(m[1]);
        const u = m[2].toLowerCase();
        o.dueDate = u === 'day' ? addDays(today, n) : u === 'week' ? addDays(today, 7 * n) : addMonths(today, n);
        return true;
      },
    },
    {
      kind: 'date',
      re: /\b(\d{4}-\d{2}-\d{2})\b/g,
      apply: (m, o) => (isValidDateStr(m[1]) ? ((o.dueDate = m[1]), true) : false),
    },
    {
      kind: 'date',
      re: new RegExp(`\\b(${MON_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'),
      apply: (m, o) => {
        const d = monthDate(today, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]), m[3] ? Number(m[3]) : undefined);
        return d ? ((o.dueDate = d), true) : false;
      },
    },
    {
      kind: 'date',
      re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MON_RE})(?:\\s+(\\d{4}))?\\b`, 'gi'),
      apply: (m, o) => {
        const d = monthDate(today, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]), m[3] ? Number(m[3]) : undefined);
        return d ? ((o.dueDate = d), true) : false;
      },
    },
    {
      kind: 'date',
      re: new RegExp(`\\b(next\\s+)?(${DAY_RE})\\b`, 'gi'),
      apply: (m, o) => {
        const d = nextWeekday(today, dayIndex(m[2]));
        // "next fri" on a Friday means a week out; plain "fri" means today.
        o.dueDate = m[1] && d === today ? addDays(d, 7) : d;
        return true;
      },
    },
    { kind: 'priority', re: /(?:^|\s)(p([1-4]))(?=\s|$)/gi, apply: (m, o) => ((o.priority = Number(m[2]) as Priority), true) },
    {
      kind: 'reminder',
      re: /(?:^|\s)(!(\d+)\s*(m|min|mins|h|hr|hrs|hours?)\b)/gi,
      apply: (m, o) => ((o.remindMinutesBefore = Number(m[2]) * (m[3].toLowerCase().startsWith('h') ? 60 : 1)), true),
    },
    { kind: 'project', re: /(?:^|\s)(#([\p{L}\p{N}_-]+))/giu, apply: (m, o) => (o.project ? false : ((o.project = m[2]), true)) },
    { kind: 'label', re: /(?:^|\s)(@([\p{L}\p{N}_-]+))/giu, apply: (m, o) => (o.labels.includes(m[2]) ? true : (o.labels.push(m[2]), true)) },
  ];

  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(input))) {
      // Rules with a leading (^|\s) report the token in group 1, without the space.
      const leading = rule.re.source.startsWith('(?:^|\\s)');
      const s = m.index + (leading ? m[0].indexOf(m[1]) : 0);
      const e = s + (leading ? m[1].length : m[0].length);
      if (!free(s, e)) continue;
      // Only one value of each single-valued kind; extra ones stay in the title.
      if ((rule.kind === 'date' && out.dueDate) || (rule.kind === 'time' && out.dueTime) || (rule.kind === 'recurrence' && out.recurrence) || (rule.kind === 'priority' && out.priority)) continue;
      if (!rule.apply(m, out)) continue;
      taken.push([s, e]);
      out.tokens.push({ kind: rule.kind, start: s, end: e, text: input.slice(s, e) });
    }
  }

  if (out.recurrence && !out.dueDate) out.dueDate = firstOccurrence(out.recurrence, today);
  if (out.dueTime && !out.dueDate) out.dueDate = today;
  if (out.recurrence?.freq === 'monthly' && !out.recurrence.byMonthDay && out.dueDate) out.recurrence.byMonthDay = parseDate(out.dueDate).getDate();

  let title = '';
  let pos = 0;
  for (const [s, e] of [...taken].sort((a, b) => a[0] - b[0])) {
    title += input.slice(pos, s);
    pos = e;
  }
  title += input.slice(pos);
  out.title = title.replace(/\s+/g, ' ').trim();
  out.tokens.sort((a, b) => a.start - b.start);
  return out;
}


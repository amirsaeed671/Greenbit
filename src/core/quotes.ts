import { dayOfYear } from './dates';

export interface Quote {
  id: string;
  text: string;
  author: string;
  source: string;
  reference?: string;
  translator?: string;
  year?: number;
}

/** Deterministic quote for a local date; changes at local midnight. */
export function quoteForDate<T>(quotes: T[], date: string): T {
  return quotes[dayOfYear(date) % quotes.length];
}

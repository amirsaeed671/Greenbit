/**
 * Fails (exit 1) if any quote lacks text/author/source, has a malformed id,
 * or duplicates another quote's id or text. Run in CI via `npm run build`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface Q { id?: unknown; text?: unknown; author?: unknown; source?: unknown }
const path = fileURLToPath(new URL('../src/data/quotes.json', import.meta.url));
const quotes = JSON.parse(readFileSync(path, 'utf8')) as Q[];
const errors: string[] = [];
const ids = new Set<string>();
const texts = new Set<string>();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

if (!Array.isArray(quotes) || quotes.length === 0) errors.push('quotes.json must be a non-empty array');
quotes.forEach((q, i) => {
  const where = `#${i} (${String(q.id)})`;
  if (!str(q.id)) errors.push(`${where}: missing id`);
  if (!str(q.text)) errors.push(`${where}: missing text`);
  if (!str(q.author)) errors.push(`${where}: missing author`);
  if (!str(q.source)) errors.push(`${where}: missing source`);
  if (str(q.id)) {
    if (ids.has(q.id as string)) errors.push(`${where}: duplicate id`);
    ids.add(q.id as string);
  }
  if (str(q.text)) {
    const t = norm(q.text as string);
    if (texts.has(t)) errors.push(`${where}: duplicate text`);
    texts.add(t);
  }
});

if (errors.length) {
  console.error(`✗ quotes.json has ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${quotes.length} quotes valid`);

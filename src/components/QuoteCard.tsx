import quotes from '../data/quotes.json';
import { quoteForDate, type Quote } from '../core/quotes';

export function QuoteCard({ date }: { date: string }) {
  const q = quoteForDate(quotes as Quote[], date);
  const src = [q.source, q.reference].filter(Boolean).join(', ');
  return (
    <figure className="quote" aria-label="Quote of the day">
      <blockquote>{q.text}</blockquote>
      <figcaption>
        <strong>{q.author}</strong>, <cite>{src}</cite>
        {q.translator ? ` (trans. ${q.translator}${q.year ? `, ${q.year}` : ''})` : q.year ? ` (${q.year})` : ''}
      </figcaption>
    </figure>
  );
}

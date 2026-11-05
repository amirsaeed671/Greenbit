import { useLiveQuery } from 'dexie-react-hooks';
import quotes from '../data/quotes.json';
import { quoteForDate, type Quote } from '../core/quotes';
import { db } from '../db/db';
import { useUI } from '../store/ui';
import { IconClose } from './Icons';

/** Device-local preference: the quote is a nicety, so hiding it is not synced. */
const HIDDEN = 'quote:hidden';
export const setQuoteHidden = (hidden: boolean) => db.local.put({ key: HIDDEN, value: hidden });
/** undefined while loading, so the card never flashes in before the preference is read. */
export const useQuoteHidden = () => useLiveQuery(async () => (await db.local.get(HIDDEN))?.value === true, []);

export function QuoteCard({ date }: { date: string }) {
  const hidden = useQuoteHidden();
  const showToast = useUI((s) => s.showToast);
  if (hidden !== false) return null;
  const q = quoteForDate(quotes as Quote[], date);
  const src = [q.source, q.reference].filter(Boolean).join(', ');
  return (
    <figure className="quote" aria-label="Quote of the day">
      <button
        className="btn ghost icon-btn quote-close"
        aria-label="Hide the daily quote"
        title="Hide the daily quote"
        onClick={() => {
          void setQuoteHidden(true);
          showToast('Quote hidden. Turn it back on in Settings', { label: 'Undo', run: () => void setQuoteHidden(false) });
        }}
      >
        <IconClose width={18} height={18} />
      </button>
      <blockquote>{q.text}</blockquote>
      <figcaption>
        <strong>{q.author}</strong>, <cite>{src}</cite>
        {q.translator ? ` (trans. ${q.translator}${q.year ? `, ${q.year}` : ''})` : q.year ? ` (${q.year})` : ''}
      </figcaption>
    </figure>
  );
}

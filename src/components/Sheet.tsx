import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('input, button:not(.sheet-close), select, textarea')?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]');
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          <motion.div
            ref={ref}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            initial={reduce ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { y: 24, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="sheet-head">
              <h2 id={id}>{title}</h2>
              <button className="btn ghost icon-btn sheet-close" onClick={onClose} aria-label="Close">
                <IconClose width={22} height={22} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

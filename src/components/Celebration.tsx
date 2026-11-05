import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '../store/ui';

const LABEL = { minimum: 'Minimum met', target: 'Target reached', stretch: 'Stretch bloom!' } as const;
const PETALS = { minimum: ['🌱', '🍃'], target: ['🌸', '🌷', '🍃'], stretch: ['🌼', '✨', '🌻', '🌸'] } as const;

export function Celebration() {
  const c = useUI((s) => s.celebration);
  const clear = useUI((s) => s.clearCelebration);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!c) return;
    const t = window.setTimeout(clear, reduce ? 1800 : 2200);
    return () => window.clearTimeout(t);
  }, [c, clear, reduce]);

  return (
    <div className="celebrate" aria-live="polite">
      <AnimatePresence>
        {c && (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="label" initial={reduce ? false : { y: 12, scale: 0.9 }} animate={{ y: 0, scale: 1 }}>
              {c.label ?? LABEL[c.tier]}: {c.habitName}
            </motion.div>
            {!reduce &&
              Array.from({ length: 18 }, (_, i) => {
                const set = PETALS[c.tier];
                const angle = (i / 18) * Math.PI * 2;
                const dist = 120 + (i % 3) * 50;
                return (
                  <motion.span
                    key={i}
                    className="petal"
                    aria-hidden="true"
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                    animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 80, opacity: 0, rotate: 180 }}
                    transition={{ duration: 1.6, ease: 'easeOut' }}
                  >
                    {set[i % set.length]}
                  </motion.span>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

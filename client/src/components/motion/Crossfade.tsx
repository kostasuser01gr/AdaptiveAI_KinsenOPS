import { motion, AnimatePresence } from '@/lib/animations';

interface CrossfadeProps {
  /** Unique key to trigger crossfade (e.g. 'loading' vs 'content') */
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Crossfade between two states (e.g. skeleton → content).
 * Wraps children with AnimatePresence mode="wait".
 */
export function Crossfade({ activeKey, children, className }: CrossfadeProps) {
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

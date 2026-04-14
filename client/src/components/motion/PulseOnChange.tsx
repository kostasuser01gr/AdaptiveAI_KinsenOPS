import { motion, AnimatePresence } from '@/lib/animations';

interface PulseOnChangeProps {
  value: string | number;
  children: React.ReactNode;
  className?: string;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Brief scale pulse when value changes. Useful for badges, counts, status indicators.
 */
export function PulseOnChange({ value, children, className }: PulseOnChangeProps) {
  if (prefersReducedMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={String(value)}
        initial={{ scale: 1.08, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

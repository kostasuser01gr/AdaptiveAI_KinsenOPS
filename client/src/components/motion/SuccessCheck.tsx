import { motion } from '@/lib/animations';
import { Check } from 'lucide-react';

interface SuccessCheckProps {
  show: boolean;
  className?: string;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Spring-animated checkmark for form success feedback.
 * Renders a green circle with check icon that scales in.
 */
export function SuccessCheck({ show, className }: SuccessCheckProps) {
  if (!show) return null;

  if (prefersReducedMotion) {
    return (
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-500/15 ${className ?? ''}`}>
        <Check className="h-5 w-5 text-green-600" />
      </div>
    );
  }

  return (
    <motion.div
      className={`inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-500/15 ${className ?? ''}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
      >
        <Check className="h-5 w-5 text-green-600" />
      </motion.div>
    </motion.div>
  );
}

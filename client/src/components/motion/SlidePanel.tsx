import { motion, AnimatePresence } from '@/lib/animations';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Which side the panel slides from */
  side?: 'right' | 'left';
  /** Panel width class */
  className?: string;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Slide-in panel overlay with backdrop.
 * Replaces instant-show drawers with smooth enter/exit.
 */
export function SlidePanel({ open, onClose, children, side = 'right', className = 'w-full sm:w-[380px]' }: SlidePanelProps) {
  const x = side === 'right' ? 380 : -380;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            className={`fixed ${side}-0 top-0 z-50 h-full bg-card border-${side === 'right' ? 'l' : 'r'} shadow-2xl flex flex-col ${className}`}
            initial={prefersReducedMotion ? undefined : { x }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? undefined : { x }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

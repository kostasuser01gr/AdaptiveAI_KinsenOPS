import { motion, AnimatePresence, type Variants } from 'framer-motion';

// Respect user's motion preferences — disables all animations when reduced motion is preferred
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const noMotion: Variants = {
  hidden: {},
  visible: {},
  exit: {},
};

// Shared animation variants for consistent motion design

export const fadeIn: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const slideUp: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const slideRight: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

export const staggerContainer: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = prefersReducedMotion ? noMotion : {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// Shared spring config for sidebar/panel layout transitions
export const layoutSpring = { type: 'spring' as const, stiffness: 400, damping: 35 };

// Re-export for convenience
export { motion, AnimatePresence };

// Animated page wrapper
export function AnimatedPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeIn}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Pulse indicator for live data
export function LivePulse({ active = true, className }: { active?: boolean; className?: string }) {
  if (!active) return null;
  if (prefersReducedMotion) {
    return <span className={`inline-block h-2 w-2 rounded-full bg-green-500 ${className || ''}`} />;
  }
  return (
    <motion.span
      className={`inline-block h-2 w-2 rounded-full bg-green-500 ${className || ''}`}
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Number counter animation
export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {value}
    </motion.span>
  );
}

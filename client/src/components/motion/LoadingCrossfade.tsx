import { motion, AnimatePresence } from '@/lib/animations';
import React from 'react';

interface LoadingCrossfadeProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Convenience wrapper: crossfades between a skeleton/spinner and loaded content.
 * Simpler API than raw Crossfade — just pass isLoading.
 */
export function LoadingCrossfade({ isLoading, skeleton, children, className }: LoadingCrossfadeProps) {
  if (prefersReducedMotion) {
    return <div className={className}>{isLoading ? skeleton : children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={className}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

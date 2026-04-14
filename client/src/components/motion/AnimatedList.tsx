import { motion, staggerContainer, staggerItem } from '@/lib/animations';
import React from 'react';

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay between children in seconds */
  stagger?: number;
  /** HTML element to render */
  as?: 'ul' | 'ol' | 'div' | 'tbody';
}

/**
 * Wraps children with stagger-in animation.
 * Each direct child should use <AnimatedListItem> for animation.
 */
export function AnimatedList({ children, className, as = 'div' }: AnimatedListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
      {...(as !== 'div' ? { role: as === 'ul' || as === 'ol' ? 'list' : undefined } : {})}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

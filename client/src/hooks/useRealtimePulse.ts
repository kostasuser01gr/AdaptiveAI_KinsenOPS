import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that tracks when real-time data updates arrive on a given query key.
 * Shows a brief "pulse" indicator each time the data is refreshed.
 */
export function useRealtimePulse(_queryKey: string) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = useCallback(() => {
    setLastUpdate(new Date());
    setIsPulsing(true);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsPulsing(false), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { lastUpdate, isPulsing, trigger };
}

/**
 * Format "X seconds ago" / "X minutes ago" for real-time indicators.
 */
export function formatTimeSince(date: Date | null): string {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

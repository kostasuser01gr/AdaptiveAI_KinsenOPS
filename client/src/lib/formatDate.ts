/** Consistent date/time formatting across the app */

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DATE_OPTS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const DATETIME_OPTS: Intl.DateTimeFormatOptions = { ...DATE_OPTS, ...TIME_OPTS };
const FULL_OPTS: Intl.DateTimeFormatOptions = { ...DATE_OPTS, year: 'numeric', ...TIME_OPTS };

function safe(d: string | number | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

/** "14:30" */
export function formatTime(d: string | number | Date): string {
  return safe(d).toLocaleTimeString([], TIME_OPTS);
}

/** "Apr 20" */
export function formatDate(d: string | number | Date): string {
  return safe(d).toLocaleDateString([], DATE_OPTS);
}

/** "Apr 20, 14:30" */
export function formatDateTime(d: string | number | Date): string {
  return safe(d).toLocaleString([], DATETIME_OPTS);
}

/** "Apr 20, 2026, 14:30" */
export function formatFullDateTime(d: string | number | Date): string {
  return safe(d).toLocaleString([], FULL_OPTS);
}

/** "2 min ago", "3h ago", "Apr 20" — relative for recent, absolute for old */
export function formatRelative(d: string | number | Date): string {
  const now = Date.now();
  const diff = now - safe(d).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return formatDate(d);
}

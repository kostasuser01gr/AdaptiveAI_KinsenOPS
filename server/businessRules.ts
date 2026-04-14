/**
 * Pure business-rule functions extracted from route handlers.
 * Zero side effects — 100% unit-testable.
 */

// ─── SLA Deadline ────────────────────────────────────────────────────────────
export const SLA_HOURS: Record<string, number> = { High: 2, Medium: 4, Low: 8 };

export function calculateSlaDeadline(priority: string | null | undefined, now = Date.now()): Date | null {
  if (!priority || !SLA_HOURS[priority]) return null;
  return new Date(now + SLA_HOURS[priority] * 3600000);
}

// ─── Wash Priority Scoring ───────────────────────────────────────────────────
export interface ScoredWashItem {
  priority?: string | null;
  slaDeadline?: string | Date | null;
  createdAt?: string | Date | null;
  washType?: string | null;
  status?: string | null;
}

export function calculateWashPriorityScore(item: ScoredWashItem, now = Date.now()): number {
  let score = 0;

  // Priority weight
  if (item.priority === 'High') score += 40;
  else if (item.priority === 'Medium') score += 20;
  else score += 5;

  // SLA urgency
  if (item.slaDeadline) {
    const remaining = new Date(item.slaDeadline).getTime() - now;
    const hours = remaining / 3600000;
    if (hours <= 0) score += 50;
    else if (hours <= 1) score += 30;
    else if (hours <= 2) score += 15;
  }

  // Wait time — 1 pt per 30 min, capped at 20
  if (item.createdAt) {
    const waitMs = now - new Date(item.createdAt).getTime();
    score += Math.min(20, Math.floor(waitMs / 1800000));
  }

  // VIP / category bonus
  if (item.washType === 'full_detail') score += 10;

  return score;
}

// ─── Severity Escalation ─────────────────────────────────────────────────────
export const SEVERITY_LADDER = ['low', 'medium', 'high', 'critical'] as const;

export function escalateSeverity(current: string): string {
  const idx = SEVERITY_LADDER.indexOf(current as typeof SEVERITY_LADDER[number]);
  if (idx < 0) return 'medium'; // unknown severity → default to medium
  return idx < SEVERITY_LADDER.length - 1 ? SEVERITY_LADDER[idx + 1] : 'critical';
}

// ─── Reservation Overlap Detection ───────────────────────────────────────────
export function hasDateOverlap(
  existingStart: Date | string,
  existingEnd: Date | string,
  newStart: Date | string,
  newEnd: Date | string,
): boolean {
  const eS = new Date(existingStart).getTime();
  const eE = new Date(existingEnd).getTime();
  const nS = new Date(newStart).getTime();
  const nE = new Date(newEnd).getTime();
  return nS < eE && nE > eS;
}

// ─── State Machine Transition Validator ──────────────────────────────────────
export function isValidTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  const allowed = transitions[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ─── Secret Redaction ────────────────────────────────────────────────────────
const SECRET_KEYS = ['apiKey', 'apiSecret', 'webhookToken', 'password', 'secret', 'token', 'credentials'];

export function redactSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()))) {
      redacted[k] = typeof v === 'string' && v.length > 0 ? '***REDACTED***' : v;
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

/**
 * Wash queue auto-assignment.
 *
 * The wash_queue table stores `assignedTo` as free text (washer display name),
 * not a foreign key — washers are kiosk operators who don't necessarily have
 * platform user accounts. The roster of "known washers" is therefore derived
 * from recent activity in the queue itself.
 *
 * Strategy:
 *   1. Roster = distinct, non-empty assignedTo values seen in wash_queue rows
 *      created within the last ROSTER_WINDOW_DAYS days.
 *   2. Active load = count of pending/in_progress items currently assigned
 *      to that washer.
 *   3. Pick the washer with the lowest load. Tie-break alphabetically so
 *      assignment is deterministic and round-robins fairly across ties.
 *   4. If no roster (cold-start workspace), return null and the caller
 *      leaves assignedTo unset.
 *
 * Optional `stationId` filters the roster to washers seen at that station,
 * so a wash created at station A doesn't get auto-assigned to a washer
 * who only ever works at station B.
 */
import { storage } from "../storage.js";

const ROSTER_WINDOW_DAYS = 30;
const ACTIVE_STATUSES = new Set(["pending", "in_progress"]);

export interface WasherLoad {
  washer: string;
  active: number;
  lastSeenAt: string | null;
}

export async function getWasherLoads(stationId?: number | null): Promise<WasherLoad[]> {
  const items = await storage.getWashQueue();
  const cutoff = Date.now() - ROSTER_WINDOW_DAYS * 86_400_000;

  const lastSeen = new Map<string, number>();
  const active = new Map<string, number>();
  const stations = new Map<string, Set<number | null>>();

  for (const it of items) {
    const name = (it.assignedTo ?? "").trim();
    if (!name) continue;
    const created = new Date(it.createdAt).getTime();
    if (created < cutoff) continue;

    const prev = lastSeen.get(name) ?? 0;
    if (created > prev) lastSeen.set(name, created);

    if (ACTIVE_STATUSES.has(it.status)) {
      active.set(name, (active.get(name) ?? 0) + 1);
    }

    if (!stations.has(name)) stations.set(name, new Set());
    stations.get(name)!.add(it.stationId ?? null);
  }

  return [...lastSeen.entries()]
    .filter(([name]) => stationId == null || stations.get(name)?.has(stationId) || stations.get(name)?.has(null))
    .map(([washer, ts]) => ({
      washer,
      active: active.get(washer) ?? 0,
      lastSeenAt: new Date(ts).toISOString(),
    }))
    .sort((a, b) => a.washer.localeCompare(b.washer));
}

export async function pickAvailableWasher(stationId?: number | null): Promise<string | null> {
  const loads = await getWasherLoads(stationId);
  if (loads.length === 0) return null;
  loads.sort((a, b) => a.active - b.active || a.washer.localeCompare(b.washer));
  return loads[0]!.washer;
}

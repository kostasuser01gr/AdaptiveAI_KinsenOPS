/**
 * Vehicle events storage — append-only telematics/fleet signal log (Phase 4.2B).
 *
 * Hardened: uses ON CONFLICT for concurrent-safe dedupe, returns { row, inserted }
 * so callers can distinguish inserts from dupes without clock heuristics.
 */
import { db, eq, and, desc, gte, lt, sql , wsFilter, wsInsert} from "./base.js";
import {
  vehicleEvents,
  type InsertVehicleEvent,
  type VehicleEvent,
} from "../../shared/schema.js";

export interface CreateVehicleEventResult {
  row: VehicleEvent;
  inserted: boolean;
}

export class VehicleEventStorage {
  /**
   * Insert a vehicle event with conflict-safe dedupe on (source, external_event_id).
   * Uses ON CONFLICT DO NOTHING + fallback SELECT to avoid TOCTOU races.
   * Returns { row, inserted } so callers can distinguish new vs duplicate.
   */
  async createVehicleEvent(data: InsertVehicleEvent): Promise<VehicleEvent> {
    const result = await this.createVehicleEventEx(data);
    return result.row;
  }

  /** Extended create that reports whether the row was freshly inserted. */
  async createVehicleEventEx(data: InsertVehicleEvent): Promise<CreateVehicleEventResult> {
    // If externalEventId is provided, use conflict-safe insert
    if (data.externalEventId) {
      // Attempt insert with ON CONFLICT DO NOTHING
      const inserted = await db
        .insert(vehicleEvents)
        .values(wsInsert(data))
        .onConflictDoNothing({ target: [vehicleEvents.source, vehicleEvents.externalEventId] })
        .returning();

      if (inserted.length > 0) {
        return { row: inserted[0], inserted: true };
      }

      // Row already exists — fetch it
      const [existing] = await db
        .select()
        .from(vehicleEvents)
        .where(
          and(
            eq(vehicleEvents.source, data.source ?? "manual"),
            eq(vehicleEvents.externalEventId, data.externalEventId),
            wsFilter(vehicleEvents),
          ),
        )
        .limit(1);
      return { row: existing, inserted: false };
    }

    // No externalEventId — always insert (no dedupe possible)
    const [row] = await db.insert(vehicleEvents).values(wsInsert(data)).returning();
    return { row, inserted: true };
  }

  /** Get events for a vehicle, ordered by occurredAt desc. */
  async getVehicleEvents(filters?: {
    vehicleId?: number;
    eventType?: string;
    connectorId?: number;
    from?: Date;
    to?: Date;
    processed?: boolean;
    limit?: number;
  }): Promise<VehicleEvent[]> {
    const conditions = [];
    if (filters?.vehicleId !== undefined) conditions.push(eq(vehicleEvents.vehicleId, filters.vehicleId));
    if (filters?.eventType) conditions.push(eq(vehicleEvents.eventType, filters.eventType));
    if (filters?.connectorId !== undefined) conditions.push(eq(vehicleEvents.connectorId, filters.connectorId));
    if (filters?.from) conditions.push(gte(vehicleEvents.occurredAt, filters.from));
    if (filters?.to) conditions.push(lt(vehicleEvents.occurredAt, filters.to));
    if (filters?.processed !== undefined) conditions.push(eq(vehicleEvents.processed, filters.processed));

    const query = db
      .select()
      .from(vehicleEvents)
      .orderBy(desc(vehicleEvents.occurredAt))
      .limit(filters?.limit ?? 200);

    if (conditions.length > 0) {
      return query.where(and(...conditions, wsFilter(vehicleEvents)));
    }
    return query.where(wsFilter(vehicleEvents));
  }

  /** Get a single event by ID. */
  async getVehicleEvent(id: number): Promise<VehicleEvent | undefined> {
    const [row] = await db.select().from(vehicleEvents).where(and(eq(vehicleEvents.id, id), wsFilter(vehicleEvents))).limit(1);
    return row;
  }

  /** Mark event as processed with derived action details. */
  async markVehicleEventProcessed(
    id: number,
    derivation?: { derivedAction?: string; derivedEntityType?: string; derivedEntityId?: string },
  ): Promise<VehicleEvent | undefined> {
    const [row] = await db
      .update(vehicleEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        ...(derivation ?? {}),
      })
      .where(and(eq(vehicleEvents.id, id), wsFilter(vehicleEvents)))
      .returning();
    return row;
  }

  /** Count events for a vehicle by type (summary query). */
  async countVehicleEvents(vehicleId: number, eventType?: string): Promise<number> {
    const conditions = [eq(vehicleEvents.vehicleId, vehicleId)];
    if (eventType) conditions.push(eq(vehicleEvents.eventType, eventType));

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicleEvents)
      .where(and(...conditions, wsFilter(vehicleEvents)));
    return result?.count ?? 0;
  }

  /** Count events for a vehicle grouped by eventType in a single query (avoids N+1). */
  async countVehicleEventsByType(vehicleId: number): Promise<Record<string, number>> {
    const rows = await db
      .select({
        eventType: vehicleEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(vehicleEvents)
      .where(and(eq(vehicleEvents.vehicleId, vehicleId), wsFilter(vehicleEvents)))
      .groupBy(vehicleEvents.eventType);

    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.count > 0) result[row.eventType] = row.count;
    }
    return result;
  }
}

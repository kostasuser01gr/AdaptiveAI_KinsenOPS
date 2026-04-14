/**
 * Vehicle timeline routes.
 * Aggregates events from vehicleEvents, washQueue, repairOrders,
 * vehicleTransfers, and vehicleEvidence into a single chronological timeline.
 */
import type { Express, Request, Response } from "express";
import { requireAuth } from "../auth.js";
import { pool } from "../db.js";

type TimelineEntry = {
  id: string;
  type: "event" | "wash" | "repair" | "transfer" | "evidence";
  title: string;
  description?: string;
  status?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function registerVehicleTimelineRoutes(app: Express) {
  /**
   * GET /api/vehicles/:id/timeline
   * Returns a unified, chronological timeline of all events for a vehicle.
   * :id can be the numeric vehicle ID.
   */
  app.get("/api/vehicles/:id/timeline", requireAuth, async (req: Request, res: Response, next) => {
    try {
      const vehicleId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const entries: TimelineEntry[] = [];

      // 1. Vehicle events (telematics / signals)
      const eventsRes = await pool.query(
        `SELECT id, event_type, payload, occurred_at FROM vehicle_events
         WHERE vehicle_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
        [vehicleId, limit]
      );
      for (const r of eventsRes.rows) {
        entries.push({
          id: `event-${r.id}`,
          type: "event",
          title: formatEventType(r.event_type),
          description: r.payload?.description ?? r.payload?.message,
          timestamp: r.occurred_at,
          metadata: r.payload,
        });
      }

      // 2. Wash queue entries (look up by plate via vehicle table)
      const plateRes = await pool.query(`SELECT plate FROM vehicles WHERE id = $1`, [vehicleId]);
      const plate = plateRes.rows[0]?.plate;
      if (plate) {
        const washRes = await pool.query(
          `SELECT id, status, wash_type, priority, created_at, completed_at FROM wash_queue
           WHERE vehicle_plate = $1 ORDER BY created_at DESC LIMIT $2`,
          [plate, limit]
        );
        for (const r of washRes.rows) {
          entries.push({
            id: `wash-${r.id}`,
            type: "wash",
            title: `Wash: ${r.wash_type || 'standard'}`,
            status: r.status,
            description: `Priority: ${r.priority || 'Normal'}`,
            timestamp: r.created_at,
            metadata: { completedAt: r.completed_at },
          });
        }
      }

      // 3. Repair orders
      const repairRes = await pool.query(
        `SELECT id, type, status, description, estimated_cost, created_at FROM repair_orders
         WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [vehicleId, limit]
      );
      for (const r of repairRes.rows) {
        entries.push({
          id: `repair-${r.id}`,
          type: "repair",
          title: `Repair: ${r.type}`,
          description: r.description,
          status: r.status,
          timestamp: r.created_at,
          metadata: { estimatedCost: r.estimated_cost },
        });
      }

      // 4. Vehicle transfers
      const transferRes = await pool.query(
        `SELECT id, from_station_id, to_station_id, status, reason, initiated_at FROM vehicle_transfers
         WHERE vehicle_id = $1 ORDER BY initiated_at DESC LIMIT $2`,
        [vehicleId, limit]
      );
      for (const r of transferRes.rows) {
        entries.push({
          id: `transfer-${r.id}`,
          type: "transfer",
          title: `Transfer: Station ${r.from_station_id ?? '?'} → ${r.to_station_id ?? '?'}`,
          description: r.reason,
          status: r.status,
          timestamp: r.initiated_at,
        });
      }

      // 5. Evidence (damage photos, check-in/out)
      const evidRes = await pool.query(
        `SELECT id, type, notes, created_at FROM vehicle_evidence
         WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [vehicleId, limit]
      );
      for (const r of evidRes.rows) {
        entries.push({
          id: `evidence-${r.id}`,
          type: "evidence",
          title: `Evidence: ${r.type}`,
          description: r.notes,
          timestamp: r.created_at,
        });
      }

      // Sort all entries chronologically (newest first)
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(entries.slice(0, limit));
    } catch (e) { next(e); }
  });
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

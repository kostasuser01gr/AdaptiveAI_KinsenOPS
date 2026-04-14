import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { RESERVATION_TRANSITIONS } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertReservationSchema } from "../../shared/schema.js";

export function registerReservationRoutes(app: Express) {
  const reservationPatchSchema = z.object({
    vehicleId: z.number().nullable().optional(),
    customerId: z.number().nullable().optional(),
    stationId: z.number().nullable().optional(),
    pickupDate: z.string().optional(),
    returnDate: z.string().optional(),
    status: z.enum(["pending", "confirmed", "checked_out", "returned", "cancelled", "no_show"]).optional(),
    notes: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  app.get("/api/reservations", requireAuth, async (req, res, next) => {
    try {
      const filters: { stationId?: number; vehicleId?: number; status?: string } = {};
      if (req.query.stationId) filters.stationId = Number(req.query.stationId);
      if (req.query.vehicleId) filters.vehicleId = Number(req.query.vehicleId);
      if (req.query.status) filters.status = String(req.query.status);
      res.json(await storage.getReservations(filters));
    } catch (e) { next(e); }
  });

  app.get("/api/reservations/:id", requireAuth, async (req, res, next) => {
    try {
      const r = await storage.getReservation(Number(req.params.id));
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e) { next(e); }
  });

  app.post("/api/reservations", requireAuth, async (req, res, next) => {
    try {
      const data = insertReservationSchema.parse(req.body);
      // Double-booking prevention
      if (data.vehicleId) {
        const existing = await storage.getReservations({ vehicleId: data.vehicleId });
        const overlap = existing.filter(r => {
          if (r.status === 'cancelled' || r.status === 'no_show') return false;
          const rStart = new Date(r.pickupDate);
          const rEnd = new Date(r.returnDate);
          const newStart = new Date(data.pickupDate);
          const newEnd = new Date(data.returnDate);
          return rStart < newEnd && newStart < rEnd;
        });
        if (overlap.length > 0) {
          return res.status(409).json({
            message: "Vehicle has overlapping reservation(s)",
            conflicting: overlap.map(r => ({ id: r.id, pickupDate: r.pickupDate, returnDate: r.returnDate, status: r.status })),
          });
        }
      }
      res.status(201).json(await storage.createReservation(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/reservations/:id", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getReservation(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const parsed = reservationPatchSchema.parse(req.body);

      // Convert date strings to Date objects for storage compatibility
      const data: Record<string, unknown> = { ...parsed };
      if (parsed.pickupDate) data.pickupDate = new Date(parsed.pickupDate);
      if (parsed.returnDate) data.returnDate = new Date(parsed.returnDate);

      if (parsed.status && parsed.status !== existing.status) {
        const allowed = RESERVATION_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(parsed.status)) {
          return res.status(422).json({
            message: `Invalid status transition: ${existing.status} → ${parsed.status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
          });
        }
      }

      // Double-booking check when vehicle or dates change
      const effectiveVehicleId = parsed.vehicleId ?? existing.vehicleId;
      const effectivePickup = parsed.pickupDate ? new Date(parsed.pickupDate) : new Date(existing.pickupDate);
      const effectiveReturn = parsed.returnDate ? new Date(parsed.returnDate) : new Date(existing.returnDate);
      if (effectiveVehicleId && (parsed.vehicleId || parsed.pickupDate || parsed.returnDate)) {
        const others = await storage.getReservations({ vehicleId: effectiveVehicleId });
        const overlap = (others || []).filter((r: any) => {
          if (r.id === id || r.status === 'cancelled' || r.status === 'no_show') return false;
          return new Date(r.pickupDate) < effectiveReturn && effectivePickup < new Date(r.returnDate);
        });
        if (overlap.length > 0) {
          return res.status(409).json({
            message: "Vehicle has overlapping reservation(s)",
            conflicting: overlap.map((r: any) => ({ id: r.id, pickupDate: r.pickupDate, returnDate: r.returnDate })),
          });
        }
      }

      const updated = await storage.updateReservation(id, data as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // SCOPED reservations
  app.get("/api/scoped/reservations", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      if (stationScope === null) {
        res.json(await storage.getReservations());
      } else {
        const all = await storage.getReservations();
        res.json(all.filter(r => r.stationId !== null && stationScope.includes(r.stationId)));
      }
    } catch (e) { next(e); }
  });
}

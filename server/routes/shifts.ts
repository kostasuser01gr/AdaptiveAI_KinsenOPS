import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { wsManager } from "../websocket.js";
import { shiftPatchSchema, shiftRequestReviewSchema, SHIFT_MANAGERS } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertShiftSchema, insertShiftRequestSchema } from "../../shared/schema.js";
import { recordUsage } from "../metering/service.js";

export function registerShiftRoutes(app: Express) {
  // SHIFTS CRUD
  app.get("/api/shifts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const weekStart = req.query.weekStart as string | undefined;
      if (SHIFT_MANAGERS.includes(user.role)) {
        res.json(await storage.getShifts(weekStart));
      } else {
        res.json(await storage.getPublishedShifts(weekStart));
      }
    } catch (e) { next(e); }
  });

  app.post("/api/shifts", requireRole("admin", "coordinator", "supervisor"), async (req, res, next) => {
    try { res.status(201).json(await storage.createShift(insertShiftSchema.parse(req.body))); } catch (e) { next(e); }
  });

  app.patch("/api/shifts/:id", requireRole("admin", "coordinator", "supervisor"), async (req, res, next) => {
    try {
      const s = await storage.updateShift(Number(req.params.id), shiftPatchSchema.parse(req.body));
      if (!s) return res.status(404).json({ message: "Not found" });
      res.json(s);
    } catch (e) { next(e); }
  });

  app.delete("/api/shifts/:id", requireRole("admin", "coordinator"), async (req, res, next) => {
    try { await storage.deleteShift(Number(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
  });

  // Publish shift
  app.post("/api/shifts/:id/publish", requireRole("admin", "coordinator", "supervisor"), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const s = await storage.publishShift(Number(req.params.id), userId);
      if (!s) return res.status(404).json({ message: "Not found" });
      wsManager.broadcast({ type: 'shift:published', data: s });
      res.json(s);
    } catch (e) { next(e); }
  });

  // SHIFT REQUESTS
  app.get("/api/shift-requests", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      if (SHIFT_MANAGERS.includes(user.role)) {
        res.json(await storage.getShiftRequests());
      } else {
        res.json(await storage.getShiftRequests(user.id));
      }
    } catch (e) { next(e); }
  });

  app.post("/api/shift-requests", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createShiftRequest(insertShiftRequestSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });

  app.patch("/api/shift-requests/:id/review", requireRole("admin", "coordinator", "supervisor"), async (req, res, next) => {
    try {
      const { status, note } = shiftRequestReviewSchema.parse(req.body);
      const reviewerId = (req.user as Express.User).id;
      const r = await storage.reviewShiftRequest(Number(req.params.id), reviewerId, status, note ?? undefined);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e) { next(e); }
  });

  // STAFFING RECOMMENDATIONS
  app.get("/api/staffing/recommendations", requireAuth, requireEntitlement("staffing_recommendations"), async (req, res, next) => {
    try {
      const stationId = req.query.stationId ? Number(req.query.stationId) : undefined;
      const weekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;

      const allReservations = await storage.getReservations(stationId ? { stationId } : undefined);
      const allShifts = await storage.getShifts(weekStart);
      const allWash = await storage.getWashQueue();
      const allIncidents = await storage.getIncidents(stationId ? { stationId } : undefined);
      const allRepairOrders = await storage.getRepairOrders(stationId ? { stationId } : undefined);

      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const recommendations: Array<{
        day: string;
        recommendedStaff: number;
        currentStaff: number;
        gap: number;
        drivers: Array<{ factor: string; value: number; impact: string }>;
        confidence: number;
      }> = [];

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayName = daysOfWeek[dayIdx];

        const dayReservations = allReservations.filter(r => {
          const pickup = new Date(r.pickupDate);
          const ret = new Date(r.returnDate);
          return pickup.getDay() === ((dayIdx + 1) % 7) || ret.getDay() === ((dayIdx + 1) % 7);
        });
        const reservationLoad = dayReservations.length;

        const dayShifts = allShifts.filter(s => {
          if (!s.schedule || !Array.isArray(s.schedule)) return false;
          return s.schedule[dayIdx] && s.schedule[dayIdx] !== 'off' && s.schedule[dayIdx] !== '';
        });
        const currentStaff = dayShifts.length;

        const pendingWash = allWash.filter(w => w.status === 'pending' || w.status === 'in_progress').length;
        const washDemandFactor = Math.ceil(pendingWash / 5);

        const activeIncidents = allIncidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
        const activeRepairs = allRepairOrders.filter(r => r.status === 'open' || r.status === 'in_progress' || r.status === 'awaiting_parts').length;
        const incidentDrag = Math.ceil((activeIncidents + activeRepairs) / 3);

        const baseFromReservations = Math.ceil(reservationLoad / 8);
        const recommended = Math.max(2, baseFromReservations + washDemandFactor + incidentDrag);
        const gap = recommended - currentStaff;

        const drivers = [
          { factor: 'Reservation load', value: reservationLoad, impact: `Requires ~${baseFromReservations} staff for ${reservationLoad} pickups/returns` },
          { factor: 'Wash queue backlog', value: pendingWash, impact: `${washDemandFactor} additional washer(s) for ${pendingWash} pending items (current snapshot, applied uniformly)` },
          { factor: 'Active incidents', value: activeIncidents, impact: `${activeIncidents} open incidents creating operational drag (current snapshot)` },
          { factor: 'Active repairs', value: activeRepairs, impact: `${activeRepairs} active repair orders reducing fleet availability (current snapshot)` },
          { factor: 'Scheduled shifts', value: currentStaff, impact: `${currentStaff} staff currently scheduled` },
        ];

        const confidence = Math.min(0.95, 0.5 + (reservationLoad > 0 ? 0.2 : 0) + (currentStaff > 0 ? 0.15 : 0) + (allWash.length > 0 ? 0.1 : 0));

        recommendations.push({
          day: dayName,
          recommendedStaff: recommended,
          currentStaff,
          gap,
          drivers,
          confidence: Math.round(confidence * 100) / 100,
        });
      }

      recordUsage({ action: "staffing_recommendation", userId: (req.user as Express.User)?.id });
      res.json({
        stationId: stationId || null,
        weekStart: weekStart || null,
        generatedAt: new Date().toISOString(),
        recommendations,
        summary: {
          totalGap: recommendations.reduce((sum, r) => sum + Math.max(0, r.gap), 0),
          understaffedDays: recommendations.filter(r => r.gap > 0).map(r => r.day),
          overstaffedDays: recommendations.filter(r => r.gap < -1).map(r => r.day),
        },
      });
    } catch (e) { next(e); }
  });

  // SCOPED shifts
  app.get("/api/scoped/shifts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      const weekStart = req.query.weekStart as string | undefined;
      if (SHIFT_MANAGERS.includes(user.role) && stationScope === null) {
        res.json(await storage.getShifts(weekStart));
      } else {
        const allShifts = await storage.getShifts(weekStart);
        if (stationScope !== null) {
          res.json(allShifts.filter(s => s.stationId === null || stationScope.includes(s.stationId as number)));
        } else {
          res.json(await storage.getPublishedShifts(weekStart));
        }
      }
    } catch (e) { next(e); }
  });
}

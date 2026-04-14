/**
 * Quality inspection routes.
 * Provides endpoints for creating and managing post-wash quality inspections.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod/v4";
import { requireAuth, requireRole } from "../auth.js";
import { db } from "../db.js";
import { qualityInspections, insertQualityInspectionSchema } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { wsManager } from "../websocket.js";

export function registerQualityInspectionRoutes(app: Express) {
  // ─── GET all inspections (optionally filtered by wash_queue_id) ──────
  app.get("/api/quality-inspections", requireAuth, async (req: Request, res: Response, next) => {
    try {
      const washId = req.query.washQueueId ? Number(req.query.washQueueId) : null;
      const query = db.select().from(qualityInspections).orderBy(desc(qualityInspections.createdAt));
      if (washId) {
        const rows = await db.select().from(qualityInspections)
          .where(eq(qualityInspections.washQueueId, washId))
          .orderBy(desc(qualityInspections.createdAt));
        return res.json(rows);
      }
      res.json(await query.limit(100));
    } catch (e) { next(e); }
  });

  // ─── GET single inspection ───────────────────────────────────────────
  app.get("/api/quality-inspections/:id", requireAuth, async (req: Request, res: Response, next) => {
    try {
      const [row] = await db.select().from(qualityInspections).where(eq(qualityInspections.id, Number(req.params.id)));
      if (!row) return res.status(404).json({ message: "Inspection not found" });
      res.json(row);
    } catch (e) { next(e); }
  });

  // ─── CREATE inspection ──────────────────────────────────────────────
  app.post("/api/quality-inspections", requireAuth, async (req: Request, res: Response, next) => {
    try {
      const user = req.user as Express.User;
      const data = insertQualityInspectionSchema.parse({ ...req.body, inspectorId: user.id });
      // Calculate overall score from checklist
      const checklist = data.checklist as Array<{ item: string; passed: boolean; notes?: string }>;
      const overallScore = checklist.length > 0
        ? Math.round((checklist.filter(c => c.passed).length / checklist.length) * 100)
        : null;
      const status = overallScore === null ? "pending" : overallScore >= 80 ? "passed" : overallScore >= 50 ? "partial" : "failed";
      const [row] = await db.insert(qualityInspections).values({
        ...data,
        overallScore,
        status,
        inspectedAt: new Date(),
      }).returning();
      wsManager.broadcast({ type: 'inspection:created', data: row, channel: 'quality' });
      res.status(201).json(row);
    } catch (e) { next(e); }
  });

  // ─── UPDATE inspection ──────────────────────────────────────────────
  const inspectionPatchSchema = z.object({
    checklist: z.array(z.object({ item: z.string(), passed: z.boolean() })).optional(),
    notes: z.string().max(5000).nullable().optional(),
    photos: z.array(z.string().url().max(2000)).max(20).optional(),
    status: z.enum(["passed", "partial", "failed", "pending"]).optional(),
  }).strict();

  app.patch("/api/quality-inspections/:id", requireRole("admin", "supervisor", "coordinator"), async (req: Request, res: Response, next) => {
    try {
      const { checklist, notes, photos, status: statusOverride } = inspectionPatchSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (checklist) {
        updates.checklist = checklist;
        const items = checklist as Array<{ item: string; passed: boolean }>;
        updates.overallScore = items.length > 0
          ? Math.round((items.filter((c: any) => c.passed).length / items.length) * 100)
          : null;
        if (!statusOverride) {
          const score = updates.overallScore as number | null;
          updates.status = score === null ? "pending" : score >= 80 ? "passed" : score >= 50 ? "partial" : "failed";
        }
      }
      if (notes !== undefined) updates.notes = notes;
      if (photos !== undefined) updates.photos = photos;
      if (statusOverride) updates.status = statusOverride;
      const [row] = await db.update(qualityInspections)
        .set(updates)
        .where(eq(qualityInspections.id, Number(req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "Inspection not found" });
      res.json(row);
    } catch (e) { next(e); }
  });

  // ─── DELETE inspection (admin/supervisor only) ──────────────────────
  app.delete("/api/quality-inspections/:id", requireRole("admin", "supervisor"), async (req: Request, res: Response, next) => {
    try {
      const [row] = await db.delete(qualityInspections).where(eq(qualityInspections.id, Number(req.params.id))).returning();
      if (!row) return res.status(404).json({ message: "Inspection not found" });
      res.status(204).end();
    } catch (e) { next(e); }
  });
}

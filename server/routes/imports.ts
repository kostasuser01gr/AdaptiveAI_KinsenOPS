import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { wsManager } from "../websocket.js";
import { insertImportSchema } from "../../shared/schema.js";

export function registerImportRoutes(app: Express) {
  const importPatchSchema = z.object({
    status: z.string().optional(),
    records: z.number().optional(),
    columns: z.number().optional(),
    mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
    diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  }).strict();

  app.get("/api/imports", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const all = await storage.getImports(user.role === 'admin' ? undefined : user.id);
      res.json(all);
    } catch (e) { next(e); }
  });

  app.get("/api/imports/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const imp = await storage.getImport(Number(req.params.id));
      if (!imp) return res.status(404).json({ message: "Not found" });
      if (imp.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.post("/api/imports", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertImportSchema.parse({ ...req.body, uploadedBy: userId });
      res.status(201).json(await storage.createImport(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/imports/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      const imp = await storage.updateImport(Number(req.params.id), importPatchSchema.parse(req.body));
      if (!imp) return res.status(404).json({ message: "Not found" });
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.delete("/api/imports/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      await storage.deleteImport(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post("/api/imports/:id/process", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'uploading') {
        return res.status(409).json({ message: "Import already processed" });
      }
      await storage.updateImport(existing.id, { status: 'mapping' });
      const columnMap: Record<string, Array<{ source: string; target: string; confidence: number }>> = {
        csv: [
          { source: 'plate', target: 'plate', confidence: 0.98 },
          { source: 'model', target: 'model', confidence: 0.95 },
          { source: 'category', target: 'category', confidence: 0.92 },
          { source: 'status', target: 'status', confidence: 0.97 },
        ],
        xlsx: [
          { source: 'License Plate', target: 'plate', confidence: 0.94 },
          { source: 'Vehicle Model', target: 'model', confidence: 0.91 },
          { source: 'Category', target: 'category', confidence: 0.96 },
          { source: 'Current Status', target: 'status', confidence: 0.88 },
          { source: 'Station', target: 'stationId', confidence: 0.85 },
        ],
        json: [
          { source: 'plate', target: 'plate', confidence: 0.99 },
          { source: 'model', target: 'model', confidence: 0.99 },
          { source: 'status', target: 'status', confidence: 0.99 },
        ],
      };
      const mappings = columnMap[existing.fileType] || columnMap['csv'];

      const rawData = Array.isArray(req.body.rawData) ? req.body.rawData : null;
      const records = rawData ? rawData.length : mappings.length * 50;
      const columns = mappings.length;
      const diffs = rawData
        ? { added: rawData.length, updated: 0, deleted: 0, conflicts: 0 }
        : { added: Math.max(records - 10, 0), updated: Math.min(10, records), deleted: 0, conflicts: 0 };
      const imp = await storage.updateImport(existing.id, {
        status: 'reviewing',
        mappings,
        records,
        columns,
        diffs,
        ...(rawData ? { rawData } : {}),
      } as any);
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.post("/api/imports/:id/confirm", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'reviewing') {
        return res.status(409).json({ message: `Cannot confirm import in '${existing.status}' state` });
      }
      const imp = await storage.updateImport(existing.id, {
        status: 'completed',
        completedAt: new Date(),
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.post("/api/imports/:id/fail", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status === 'completed' || existing.status === 'failed') {
        return res.status(409).json({ message: `Cannot fail import in '${existing.status}' state` });
      }
      const { errorMessage } = z.object({ errorMessage: z.string().min(1).max(1000) }).parse(req.body);
      const imp = await storage.updateImport(existing.id, {
        status: 'failed',
        errorMessage,
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.post("/api/imports/:id/retry", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'failed') {
        return res.status(409).json({ message: `Cannot retry import in '${existing.status}' state` });
      }
      const imp = await storage.updateImport(existing.id, {
        status: 'uploading',
        errorMessage: null,
        mappings: null,
        diffs: null,
        records: 0,
        columns: 0,
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  app.post("/api/imports/:id/apply", requireAuth, auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'import_apply' }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'reviewing') {
        return res.status(409).json({ message: `Cannot apply import in '${existing.status}' state` });
      }
      if (!existing.rawData || !Array.isArray(existing.rawData) || existing.rawData.length === 0) {
        return res.status(400).json({ message: "No data to apply. Process the import first." });
      }
      if (!existing.mappings || existing.mappings.length === 0) {
        return res.status(400).json({ message: "No column mappings defined." });
      }

      const targetTable = (existing as { targetTable?: string }).targetTable || 'vehicles';

      let applied = 0;
      let errors: string[] = [];

      if (targetTable === 'vehicles') {
        const mappingMap = new Map(existing.mappings.map(m => [m.source, m.target]));
        const existingVehicles = await storage.getVehicles();
        const vehicleByPlate = new Map(existingVehicles.map(v => [v.plate, v]));
        for (const row of existing.rawData as Array<Record<string, unknown>>) {
          try {
            const mapped: Record<string, unknown> = {};
            for (const [sourceCol, value] of Object.entries(row)) {
              const targetCol = mappingMap.get(sourceCol);
              if (targetCol) mapped[targetCol] = value;
            }
            if (!mapped.plate || !mapped.model) {
              errors.push(`Row missing required fields: plate=${mapped.plate}, model=${mapped.model}`);
              continue;
            }
            const match = vehicleByPlate.get(String(mapped.plate));
            if (match) {
              await storage.updateVehicle(match.id, {
                model: mapped.model ? String(mapped.model) : undefined,
                category: mapped.category ? String(mapped.category) : undefined,
                status: mapped.status ? String(mapped.status) : undefined,
              });
            } else {
              const newVehicle = await storage.createVehicle({
                plate: String(mapped.plate),
                model: String(mapped.model),
                category: mapped.category ? String(mapped.category) : 'B',
                status: mapped.status ? String(mapped.status) : 'ready',
                sla: 'normal',
              });
              vehicleByPlate.set(newVehicle.plate, newVehicle);
            }
            applied++;
          } catch (err) {
            errors.push(`Row error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      } else {
        return res.status(400).json({ message: `Unsupported target table: ${targetTable}` });
      }

      const imp = await storage.updateImport(existing.id, {
        status: errors.length > 0 && applied === 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        errorMessage: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
        appliedCount: applied,
      } as Partial<import("../../shared/schema.js").InsertImport>);

      await storage.createAuditEntry({
        userId: user.id,
        action: 'import_applied',
        entityType: 'import',
        entityId: String(existing.id),
        details: { applied, errors: errors.length, targetTable },
        ipAddress: req.ip || null,
      });

      wsManager.broadcast({ type: 'import:applied', data: { importId: existing.id, applied, errors: errors.length } });
      res.json({ importId: existing.id, applied, errors: errors.slice(0, 10), status: imp?.status });
    } catch (e) { next(e); }
  });
}

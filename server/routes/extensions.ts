import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";

// Extension manifest validation schema
const extensionManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  permissions: z.array(z.string()),
  entryPoint: z.string().optional(),
  hooks: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const ALLOWED_PERMISSIONS = [
  "read:vehicles", "write:vehicles",
  "read:wash_queue", "write:wash_queue",
  "read:shifts", "write:shifts",
  "read:channels", "write:channels",
  "read:analytics",
  "read:notifications", "write:notifications",
  "read:incidents", "write:incidents",
  "read:reservations", "write:reservations",
  "execute:automations",
  "admin:config",
];

export function registerExtensionRoutes(app: Express) {
  app.get("/api/extensions", requireAuth, async (req, res, next) => {
    try {
      const enabledOnly = req.query.enabled === "true";
      res.json(await storage.getInstalledExtensions(enabledOnly));
    } catch (e) { next(e); }
  });

  app.get("/api/extensions/:id", requireAuth, async (req, res, next) => {
    try {
      const e = await storage.getInstalledExtension(Number(req.params.id));
      if (!e) return res.status(404).json({ message: "Extension not found" });
      res.json(e);
    } catch (e) { next(e); }
  });

  app.post("/api/extensions", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "installed_extension" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const manifest = extensionManifestSchema.parse(req.body.manifest || req.body);

        // Validate permissions against allowlist
        const invalidPerms = manifest.permissions.filter(p => !ALLOWED_PERMISSIONS.includes(p));
        if (invalidPerms.length > 0) {
          return res.status(400).json({ message: `Invalid permissions: ${invalidPerms.join(", ")}` });
        }

        // Check for duplicate slug
        const existing = await storage.getInstalledExtensionBySlug(manifest.id);
        if (existing) return res.status(409).json({ message: "Extension already installed" });

        const ext = await storage.installExtension({
          slug: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          manifest: manifest as unknown as Record<string, unknown>,
          permissions: manifest.permissions,
          installedBy: user.id,
          config: manifest.config,
        });
        res.status(201).json(ext);
      } catch (e) { next(e); }
    });

  app.patch("/api/extensions/:id", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "installed_extension" }),
    async (req, res, next) => {
      try {
        const patchSchema = z.object({
          enabled: z.boolean().optional(),
          config: z.record(z.string(), z.unknown()).nullable().optional(),
        }).strict();
        const data = patchSchema.parse(req.body);
        const ext = await storage.updateExtension(Number(req.params.id), data);
        if (!ext) return res.status(404).json({ message: "Extension not found" });
        res.json(ext);
      } catch (e) { next(e); }
    });

  app.delete("/api/extensions/:id", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.DELETE, entityType: "installed_extension" }),
    async (req, res, next) => {
      try {
        await storage.uninstallExtension(Number(req.params.id));
        res.status(204).end();
      } catch (e) { next(e); }
    });

  // List valid permissions
  app.get("/api/extensions/meta/permissions", requireAuth, async (_req, res) => {
    res.json(ALLOWED_PERMISSIONS);
  });
}

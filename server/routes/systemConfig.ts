/**
 * System Configuration API Routes
 * Provides admin endpoints for managing all platform configuration values.
 */
import type { Express } from "express";
import { requireRole } from "../auth.js";
import { storage } from "../storage.js";
import { configResolver } from "../config/resolver.js";
import { CONFIG_CATEGORY_LABELS, CONFIG_MAP } from "../config/registry.js";

export function registerSystemConfigRoutes(app: Express) {
  /**
   * GET /api/system-config/definitions
   * Returns all config definitions with current values and metadata.
   * Requires admin or supervisor role.
   */
  app.get("/api/system-config/definitions", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const definitions = await configResolver.getDefinitionsWithValues();
      res.json({ definitions, categories: CONFIG_CATEGORY_LABELS });
    } catch (e) { next(e); }
  });

  /**
   * GET /api/system-config
   * Returns all current config values as a flat key-value map.
   */
  app.get("/api/system-config", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const values = await configResolver.loadAll();
      res.json(values);
    } catch (e) { next(e); }
  });

  /**
   * PUT /api/system-config/:key
   * Update a single configuration value.
   * Body: { value: <any> }
   */
  app.put("/api/system-config/:key", requireRole("admin"), async (req, res, next) => {
    try {
      const key = String(req.params.key);
      const { value } = req.body as { value: unknown };

      if (value === undefined) {
        return res.status(400).json({ message: "Missing 'value' in request body" });
      }

      const def = CONFIG_MAP.get(key);
      if (!def) {
        return res.status(404).json({ message: `Unknown config key: ${key}` });
      }

      const validation = configResolver.validate(key, value);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }

      const userId = (req.user as Express.User).id;
      const entry = await storage.setWorkspaceConfig({
        key,
        value,
        category: def.category,
        description: def.description ?? null,
        updatedBy: userId,
      });

      configResolver.invalidate(key);

      await storage.createAuditEntry({
        userId,
        action: "config_update",
        entityType: "system_config",
        entityId: key,
        details: { key, value, category: def.category, restartRequired: def.restartRequired },
      });

      res.json({
        ...entry,
        restartRequired: def.restartRequired ?? false,
        label: def.label,
      });
    } catch (e) { next(e); }
  });

  /**
   * DELETE /api/system-config/:key
   * Reset a config value to its default (removes the DB override).
   */
  app.delete("/api/system-config/:key", requireRole("admin"), async (req, res, next) => {
    try {
      const key = String(req.params.key);
      const def = CONFIG_MAP.get(key);
      if (!def) {
        return res.status(404).json({ message: `Unknown config key: ${key}` });
      }

      await storage.deleteWorkspaceConfigByKey(key);
      configResolver.invalidate(key);

      const userId = (req.user as Express.User).id;
      await storage.createAuditEntry({
        userId,
        action: "config_reset",
        entityType: "system_config",
        entityId: key,
        details: { key, resetToDefault: def.defaultValue },
      });

      res.json({ key, value: def.defaultValue, isDefault: true });
    } catch (e) { next(e); }
  });

  /**
   * POST /api/system-config/bulk
   * Update multiple config values at once.
   * Body: { updates: Array<{ key: string; value: unknown }> }
   */
  app.post("/api/system-config/bulk", requireRole("admin"), async (req, res, next) => {
    try {
      const { updates } = req.body as { updates: Array<{ key: string; value: unknown }> };
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "Body must include a non-empty 'updates' array" });
      }

      const userId = (req.user as Express.User).id;
      const results: Array<{ key: string; success: boolean; error?: string; restartRequired?: boolean }> = [];

      for (const { key, value } of updates) {
        const def = CONFIG_MAP.get(key);
        if (!def) {
          results.push({ key, success: false, error: `Unknown config key` });
          continue;
        }
        const validation = configResolver.validate(key, value);
        if (!validation.valid) {
          results.push({ key, success: false, error: validation.error });
          continue;
        }

        await storage.setWorkspaceConfig({
          key,
          value: value as Record<string, unknown>,
          category: def.category,
          description: def.description ?? null,
          updatedBy: userId,
        });
        configResolver.invalidate(key);
        results.push({ key, success: true, restartRequired: def.restartRequired });
      }

      await storage.createAuditEntry({
        userId,
        action: "config_bulk_update",
        entityType: "system_config",
        entityId: "bulk",
        details: { count: results.filter((r) => r.success).length, keys: updates.map((u) => u.key) },
      });

      const needsRestart = results.some((r) => r.success && r.restartRequired);
      res.json({ results, needsRestart });
    } catch (e) { next(e); }
  });
}

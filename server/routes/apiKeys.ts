import type { Express } from "express";
import { requireAuth } from "../auth.js";
import { db } from "../db.js";
import { userApiKeys } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import { validateIdParam } from "../middleware/validation.js";
import { config } from "../config.js";

// AES-256-GCM encryption using a server-side key.
// In production, use a KMS or HSM. Falls back to a derived key from NODE_ENV secret.
const ENCRYPTION_KEY = (() => {
  const raw = process.env.API_KEY_ENCRYPTION_SECRET || config.sessionSecret;
  if (!raw || raw === "dev-secret-not-for-production") {
    if (config.isProduction) {
      throw new Error('API_KEY_ENCRYPTION_SECRET or SESSION_SECRET must be set in production');
    }
    // eslint-disable-next-line no-console
    console.warn('[SECURITY] Using insecure default API key encryption key — set API_KEY_ENCRYPTION_SECRET in production');
    return crypto.scryptSync('dev-only-default-key-change-in-prod', 'driveai-api-key-salt', 32);
  }
  return crypto.scryptSync(raw, 'driveai-api-key-salt', 32);
})();

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export function registerApiKeyRoutes(app: Express) {
  // List user's API keys (never expose full keys)
  app.get("/api/user/api-keys", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const keys = await db.select().from(userApiKeys).where(eq(userApiKeys.userId, userId));
      res.json(keys.map(k => ({
        id: k.id,
        provider: k.provider,
        label: k.label,
        keyPrefix: k.keyPrefix,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })));
    } catch (e) { next(e); }
  });

  // Add a new API key
  app.post("/api/user/api-keys", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const workspaceId = (req.user as Express.User).workspaceId ?? 'default';
      const { provider, label, apiKey } = req.body;

      if (!provider || !apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
        return res.status(400).json({ message: "provider and apiKey (min 8 chars) are required" });
      }

      const allowedProviders = ['openai', 'anthropic', 'google', 'mistral', 'openrouter', 'custom'];
      if (!allowedProviders.includes(provider)) {
        return res.status(400).json({ message: `provider must be one of: ${allowedProviders.join(', ')}` });
      }

      const [row] = await db.insert(userApiKeys).values({
        workspaceId,
        userId,
        provider,
        label: label || `${provider} key`,
        encryptedKey: encrypt(apiKey),
        keyPrefix: maskKey(apiKey),
        isActive: true,
      }).returning();

      res.status(201).json({
        id: row.id,
        provider: row.provider,
        label: row.label,
        keyPrefix: row.keyPrefix,
        isActive: row.isActive,
        createdAt: row.createdAt,
      });
    } catch (e) { next(e); }
  });

  // Toggle active/inactive
  app.patch("/api/user/api-keys/:id", requireAuth, validateIdParam(), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const keyId = Number(req.params.id);
      const { isActive, label } = req.body;

      const updates: Record<string, unknown> = {};
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof label === 'string' && label.trim()) updates.label = label.trim();

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const [row] = await db.update(userApiKeys)
        .set(updates)
        .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
        .returning();

      if (!row) return res.status(404).json({ message: "Key not found" });

      res.json({
        id: row.id,
        provider: row.provider,
        label: row.label,
        keyPrefix: row.keyPrefix,
        isActive: row.isActive,
      });
    } catch (e) { next(e); }
  });

  // Delete a key
  app.delete("/api/user/api-keys/:id", requireAuth, validateIdParam(), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const keyId = Number(req.params.id);

      const [deleted] = await db.delete(userApiKeys)
        .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
        .returning();

      if (!deleted) return res.status(404).json({ message: "Key not found" });
      res.status(204).end();
    } catch (e) { next(e); }
  });
}

// Helper: retrieve a user's active key for a provider (used by chat routes)
export async function getUserApiKey(userId: number, provider: string): Promise<string | null> {
  const [row] = await db.select()
    .from(userApiKeys)
    .where(and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.provider, provider),
      eq(userApiKeys.isActive, true),
    ))
    .limit(1);

  if (!row) return null;

  // Update lastUsedAt
  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, row.id))
    .catch(() => {}); // fire-and-forget

  return decrypt(row.encryptedKey);
}

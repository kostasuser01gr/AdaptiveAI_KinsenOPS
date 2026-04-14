/**
 * Session management & login history routes.
 * Provides endpoints for:
 * - Viewing active sessions
 * - Revoking sessions
 * - Viewing login history
 * - Recording login events (called internally from auth.ts)
 */
import type { Express, Request, Response } from "express";
import { requireAuth } from "../auth.js";
import { pool } from "../db.js";

export function registerSessionRoutes(app: Express) {
  // ─── GET active sessions for current user ────────────────────────────────
  app.get("/api/auth/sessions", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as Express.User).id;
    try {
      const result = await pool.query(
        `SELECT sid, sess->'cookie'->>'expires' AS expires,
                sess->>'ip' AS ip_address,
                sess->>'userAgent' AS user_agent,
                expire AS session_expire
         FROM user_sessions
         WHERE (sess->>'passport')::jsonb->>'user' = $1
         ORDER BY expire DESC`,
        [String(userId)]
      );
      const currentSid = (req.session as any)?.id;
      const sessions = result.rows.map(row => ({
        id: row.sid,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        expiresAt: row.session_expire,
        isCurrent: row.sid === currentSid,
      }));
      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  // ─── DELETE (revoke) a specific session ──────────────────────────────────
  app.delete("/api/auth/sessions/:sid", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as Express.User).id;
    const { sid } = req.params;
    try {
      // Only allow revoking own sessions
      const check = await pool.query(
        `SELECT sid FROM user_sessions WHERE sid = $1 AND (sess->>'passport')::jsonb->>'user' = $2`,
        [sid, String(userId)]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }
      await pool.query(`DELETE FROM user_sessions WHERE sid = $1`, [sid]);
      res.json({ message: "Session revoked" });
    } catch {
      res.status(500).json({ message: "Failed to revoke session" });
    }
  });

  // ─── GET login history for current user ──────────────────────────────────
  app.get("/api/auth/login-history", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as Express.User).id;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
      const result = await pool.query(
        `SELECT id, action, ip_address, user_agent, success, failure_reason, created_at
         FROM login_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      res.json(result.rows);
    } catch {
      res.json([]);
    }
  });
}

/**
 * Record a login event to the login_history table.
 * Called from auth.ts on login/register/failed attempts.
 */
export async function recordLoginEvent(params: {
  userId: number;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  failureReason?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO login_history (user_id, action, ip_address, user_agent, session_id, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [params.userId, params.action, params.ipAddress, params.userAgent, params.sessionId, params.success, params.failureReason]
    );
  } catch {
    // Non-critical — don't break auth flow
  }
}

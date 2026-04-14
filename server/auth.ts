import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Express, Request, Response, NextFunction } from "express";
import ConnectPgSimple from "connect-pg-simple";
import { RedisStore } from "connect-redis";
import { redis } from "./redis.js";
import { storage } from "./storage.js";
import type { User as DbUser } from "../shared/schema.js";
import { recordLoginEvent } from "./routes/sessions.js";
import { eventBus } from "./events/eventBus.js";
import { logger } from "./observability/logger.js";
import { config } from "./config.js";

// ── LRU cache for deserialized user sessions ─────────────────────────────────
const USER_CACHE_TTL_MS = 60_000; // 60 seconds
const USER_CACHE_MAX = 500;
const userCache = new Map<number, { user: Omit<DbUser, "password">; expiresAt: number }>();

function getCachedUser(id: number): Omit<DbUser, "password"> | null {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(id);
    return null;
  }
  // LRU: move to end so it's last to be evicted
  userCache.delete(id);
  userCache.set(id, entry);
  return entry.user;
}

function setCachedUser(id: number, user: Omit<DbUser, "password">): void {
  // Evict oldest entries if cache is full
  if (userCache.size >= USER_CACHE_MAX) {
    const firstKey = userCache.keys().next().value;
    if (firstKey !== undefined) userCache.delete(firstKey);
  }
  userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

/** Invalidate cached user — call on password/role changes */
export function invalidateUserCache(userId: number): void {
  userCache.delete(userId);
}

/** Flush the entire user cache */
export function flushUserCache(): void {
  userCache.clear();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: number;
      username: string;
      displayName: string;
      role: string;
      station: string | null;
      language: string;
      theme: string;
      workspaceId: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// ── Account lockout constants ────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function setupAuth(app: Express) {
  const authConfigured = Boolean(config.sessionSecret !== "dev-secret-not-for-production" && config.databaseUrl);
  if (!authConfigured) {
    console.warn("Auth runtime is missing SESSION_SECRET or DATABASE_URL; using ephemeral preview mode.");
  }

  const PgStore = authConfigured ? ConnectPgSimple(session) : null;

  // Prefer Redis for sessions (scalable across instances), fall back to PG
  const sessionStore = redis
    ? new RedisStore({ client: redis, prefix: "sess:" })
    : PgStore
      ? new PgStore({
          conString: config.databaseUrl,
          tableName: "user_sessions",
          // Production relies on migrations so auth bootstrap never mutates schema at runtime.
          createTableIfMissing: !config.isProduction,
        })
      : undefined;

  app.use(
    session({
      ...(sessionStore ? { store: sessionStore } : {}),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "strict",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  if (authConfigured) {
    passport.use(
      new LocalStrategy(async (username, password, done) => {
        try {
          const user = await storage.getUserByUsernameUnscoped(username);
          if (!user) return done(null, false, { message: "Invalid credentials" });

          // Check account lockout
          if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            return done(null, false, { message: "Account temporarily locked. Try again later." });
          }

          const valid = await comparePasswords(password, user.password);
          if (!valid) {
            // Increment failed attempts; lock if threshold reached
            const attempts = (user.failedLoginAttempts ?? 0) + 1;
            const lockout = attempts >= MAX_FAILED_ATTEMPTS
              ? { failedLoginAttempts: attempts, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
              : { failedLoginAttempts: attempts };
            await storage.updateUserUnscoped(user.id, lockout as any);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
              eventBus.emit("user:locked", { userId: user.id, username: user.username, failedAttempts: attempts });
              return done(null, false, { message: "Account temporarily locked. Try again later." });
            }
            return done(null, false, { message: "Invalid credentials" });
          }

          // Successful login — reset lockout counters
          if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await storage.updateUserUnscoped(user.id, { failedLoginAttempts: 0, lockedUntil: null } as any);
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      })
    );
  }

  passport.serializeUser((user: Express.User, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    if (!authConfigured) {
      return done(null, false);
    }
    try {
      // Check LRU cache first to avoid DB hit on every request
      const cached = getCachedUser(id);
      if (cached) {
        return done(null, cached as Express.User);
      }
      const user = await storage.getUserById(id);
      if (!user) return done(null, false);
      const { password: _pw, ...safeUser } = user;
      setCachedUser(id, safeUser);
      done(null, safeUser as Express.User);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    if (!authConfigured) {
      return res.status(503).json({ message: "Authentication is not configured" });
    }
    try {
      const { username, password, displayName, inviteToken } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Invite token validation (bypass with OPEN_REGISTRATION=true)
      let assignedRole = "agent";
      let tokenRecord: Awaited<ReturnType<typeof storage.getInviteTokenByToken>> | undefined;
      if (!config.openRegistration) {
        if (!inviteToken || typeof inviteToken !== "string") {
          return res.status(403).json({ message: "An invite token is required to register" });
        }
        tokenRecord = await storage.getInviteTokenByToken(inviteToken.trim());
        if (!tokenRecord) {
          return res.status(403).json({ message: "Invalid invite token" });
        }
        if (tokenRecord.usedAt) {
          return res.status(403).json({ message: "This invite token has already been used" });
        }
        if (new Date(tokenRecord.expiresAt) < new Date()) {
          return res.status(403).json({ message: "This invite token has expired" });
        }
        if (tokenRecord.email && tokenRecord.email.toLowerCase() !== username.toLowerCase()) {
          return res.status(403).json({ message: "This invite token is reserved for a different user" });
        }
        assignedRole = tokenRecord.role;
      }

      const existing = await storage.getUserByUsernameUnscoped(username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashed,
        displayName,
        role: assignedRole,
        language: "en",
        theme: "dark",
      });

      // Mark invite token as used
      if (tokenRecord) {
        await storage.markInviteTokenUsed(tokenRecord.id, user.id);
      }

      const { password: _, ...safeUser } = user;
      eventBus.emit("user:registered", { userId: user.id, username: user.username, role: assignedRole });
      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.login(safeUser as Express.User, (err) => {
          if (err) return next(err);
          res.status(201).json(safeUser);
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    if (!authConfigured) {
      return res.status(503).json({ message: "Authentication is not configured" });
    }
    passport.authenticate("local", (err: unknown, user: DbUser | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        recordLoginEvent({ userId: 0, action: "failed_login", ipAddress: req.ip, userAgent: req.headers["user-agent"], success: false, failureReason: info?.message || "Invalid credentials" });
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      const { password: _pw2, ...safeUser } = user;
      // Regenerate session ID to prevent session fixation attacks
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.login(safeUser, (err) => {
          if (err) return next(err);
          recordLoginEvent({ userId: user.id, action: "login", ipAddress: req.ip, userAgent: req.headers["user-agent"], sessionId: req.sessionID, success: true });
          eventBus.emit("user:login", { userId: user.id, username: user.username });
          res.json(safeUser);
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    const userId = req.isAuthenticated() ? (req.user as Express.User).id : 0;
    if (userId) {
      recordLoginEvent({ userId, action: "logout", ipAddress: req.ip, userAgent: req.headers["user-agent"], sessionId: req.sessionID, success: true });
      eventBus.emit("user:logout", { userId });
    }
    req.logout(() => {
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          logger.warn('Failed to destroy session on logout', destroyErr);
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out" });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!authConfigured) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes((req.user as Express.User).role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export { hashPassword };

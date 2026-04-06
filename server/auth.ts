import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Express, Request, Response, NextFunction } from "express";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage.js";
import type { User as DbUser } from "../shared/schema.js";

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

export function setupAuth(app: Express) {
  const authConfigured = Boolean(process.env.SESSION_SECRET && process.env.DATABASE_URL);
  if (!authConfigured) {
    console.warn("Auth runtime is missing SESSION_SECRET or DATABASE_URL; using ephemeral preview mode.");
  }

  const PgStore = authConfigured ? ConnectPgSimple(session) : null;

  app.use(
    session({
      ...(PgStore
        ? {
            store: new PgStore({
              conString: process.env.DATABASE_URL,
              createTableIfMissing: true,
            }),
          }
        : {}),
      secret: process.env.SESSION_SECRET ?? randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
          const user = await storage.getUserByUsername(username);
          if (!user) return done(null, false, { message: "Invalid credentials" });
          const valid = await comparePasswords(password, user.password);
          if (!valid) return done(null, false, { message: "Invalid credentials" });
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
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      const { password: _pw, ...safeUser } = user;
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
      const { username, password, displayName } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashed,
        displayName,
        role: "agent",
        language: "en",
        theme: "dark",
      });

      const { password: _, ...safeUser } = user;
      req.login(safeUser as Express.User, (err) => {
        if (err) return next(err);
        res.status(201).json(safeUser);
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
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      const { password: _pw2, ...safeUser } = user;
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
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

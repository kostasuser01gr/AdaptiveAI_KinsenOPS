import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { insertNotificationSchema, insertAutomationRuleSchema } from "../../shared/schema.js";

// ─── Security-focused schema & validation tests ──────────────────────────────
// These tests verify the PATCH whitelist schemas, AI input guards,
// and other security invariants without hitting the DB.

// ─── Replicate PATCH schemas from routes.ts for isolated testing ─────────────
const vehiclePatchSchema = z.object({
  plate: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  stationId: z.number().nullable().optional(),
  status: z.string().optional(),
  sla: z.string().optional(),
  mileage: z.number().nullable().optional(),
  fuelLevel: z.number().nullable().optional(),
  nextBooking: z.string().nullable().optional(),
  timerInfo: z.string().nullable().optional(),
}).strict();

const conversationPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
}).strict();

const userPatchSchema = z.object({
  displayName: z.string().optional(),
  role: z.string().optional(),
  station: z.string().nullable().optional(),
  language: z.string().optional(),
  theme: z.string().optional(),
  password: z.string().min(8).optional(),
}).strict();

const shiftPatchSchema = z.object({
  employeeName: z.string().optional(),
  employeeRole: z.string().optional(),
  weekStart: z.string().optional(),
  schedule: z.array(z.string()).optional(),
  status: z.string().optional(),
  stationId: z.number().nullable().optional(),
  fairnessScore: z.number().nullable().optional(),
  fatigueScore: z.number().nullable().optional(),
}).strict();

const ALLOWED_AI_ROLES = ['user', 'assistant'] as const;
const AI_MAX_MESSAGES = 20;
const AI_MAX_MESSAGE_CHARS = 4000;
const AI_MAX_TOTAL_CHARS = 40000;
const ALLOWED_CONTEXT_KEYS = ['currentModule', 'selectedVehicle', 'selectedStation', 'currentView', 'locale', 'timezone'] as const;

// ─── PATCH WHITELIST SCHEMA TESTS ────────────────────────────────────────────

describe("vehiclePatchSchema", () => {
  it("accepts valid partial update", () => {
    const result = vehiclePatchSchema.safeParse({ status: "washing", fuelLevel: 80 });
    expect(result.success).toBe(true);
  });

  it("rejects id field", () => {
    const result = vehiclePatchSchema.safeParse({ id: 99, status: "ready" });
    expect(result.success).toBe(false);
  });

  it("rejects deletedAt field", () => {
    const result = vehiclePatchSchema.safeParse({ deletedAt: null });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = vehiclePatchSchema.safeParse({ status: "ready", hackerField: "pwned" });
    expect(result.success).toBe(false);
  });
});

describe("conversationPatchSchema", () => {
  it("accepts title update", () => {
    const result = conversationPatchSchema.safeParse({ title: "New title" });
    expect(result.success).toBe(true);
  });

  it("rejects userId injection", () => {
    const result = conversationPatchSchema.safeParse({ title: "x", userId: 99 });
    expect(result.success).toBe(false);
  });

  it("rejects createdAt injection", () => {
    const result = conversationPatchSchema.safeParse({ createdAt: "2020-01-01" });
    expect(result.success).toBe(false);
  });
});

describe("userPatchSchema", () => {
  it("accepts valid fields", () => {
    const result = userPatchSchema.safeParse({ displayName: "New Name", theme: "light" });
    expect(result.success).toBe(true);
  });

  it("rejects id injection", () => {
    const result = userPatchSchema.safeParse({ id: 1, displayName: "test" });
    expect(result.success).toBe(false);
  });

  it("rejects username change", () => {
    const result = userPatchSchema.safeParse({ username: "hacker" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = userPatchSchema.safeParse({ password: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts valid password (8+ chars)", () => {
    const result = userPatchSchema.safeParse({ password: "securepass123" });
    expect(result.success).toBe(true);
  });
});

describe("shiftPatchSchema", () => {
  it("accepts valid schedule update", () => {
    const result = shiftPatchSchema.safeParse({ schedule: ["08-16", "OFF"] });
    expect(result.success).toBe(true);
  });

  it("rejects publishedBy injection", () => {
    const result = shiftPatchSchema.safeParse({ publishedBy: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects publishedAt injection", () => {
    const result = shiftPatchSchema.safeParse({ publishedAt: "2026-01-01" });
    expect(result.success).toBe(false);
  });
});

// ─── AI INPUT VALIDATION TESTS ───────────────────────────────────────────────

describe("AI chat input guards", () => {
  function validateMessages(messages: unknown[]): { valid: boolean; reason?: string } {
    if (!Array.isArray(messages) || messages.length === 0) {
      return { valid: false, reason: "messages array required" };
    }
    if (messages.length > AI_MAX_MESSAGES) {
      return { valid: false, reason: `exceeds ${AI_MAX_MESSAGES} messages` };
    }
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg !== 'object' || msg === null) {
        return { valid: false, reason: "not an object" };
      }
      const { role, content } = msg as Record<string, unknown>;
      if (!ALLOWED_AI_ROLES.includes(role as typeof ALLOWED_AI_ROLES[number])) {
        return { valid: false, reason: `invalid role: ${String(role)}` };
      }
      if (typeof content !== 'string' || content.length === 0) {
        return { valid: false, reason: "empty content" };
      }
      if (content.length > AI_MAX_MESSAGE_CHARS) {
        return { valid: false, reason: "message too long" };
      }
      totalChars += content.length;
      if (totalChars > AI_MAX_TOTAL_CHARS) {
        return { valid: false, reason: "total content too long" };
      }
    }
    return { valid: true };
  }

  it("accepts valid messages", () => {
    const result = validateMessages([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects empty messages array", () => {
    expect(validateMessages([]).valid).toBe(false);
  });

  it("rejects more than 20 messages", () => {
    const msgs = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "msg",
    }));
    const result = validateMessages(msgs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("20");
  });

  it("rejects invalid role", () => {
    const result = validateMessages([{ role: "system", content: "hack" }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("role");
  });

  it("rejects message exceeding 4000 chars", () => {
    const result = validateMessages([{ role: "user", content: "x".repeat(4001) }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("too long");
  });

  it("rejects total content exceeding 40000 chars", () => {
    const msgs = Array.from({ length: 15 }, () => ({
      role: "user",
      content: "x".repeat(3000),
    }));
    const result = validateMessages(msgs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("total");
  });

  it("rejects empty content", () => {
    const result = validateMessages([{ role: "user", content: "" }]);
    expect(result.valid).toBe(false);
  });
});

describe("AI context sanitization", () => {
  function sanitizeContext(context: unknown): Record<string, string> {
    const safe: Record<string, string> = {};
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      for (const key of ALLOWED_CONTEXT_KEYS) {
        const val = (context as Record<string, unknown>)[key];
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          safe[key] = String(val);
        }
      }
    }
    return safe;
  }

  it("extracts only allowed keys", () => {
    const result = sanitizeContext({
      currentModule: "fleet",
      evilKey: "<script>alert(1)</script>",
      __proto__: { admin: true },
    });
    expect(result).toEqual({ currentModule: "fleet" });
    expect(result).not.toHaveProperty("evilKey");
    expect(result).not.toHaveProperty("__proto__");
  });

  it("ignores nested objects in allowed keys", () => {
    const result = sanitizeContext({
      currentModule: { nested: "injection" },
      selectedVehicle: "ABC-1234",
    });
    expect(result).toEqual({ selectedVehicle: "ABC-1234" });
  });

  it("converts numbers and booleans to strings", () => {
    const result = sanitizeContext({ locale: true, timezone: 3 });
    expect(result).toEqual({ locale: "true", timezone: "3" });
  });

  it("handles null/undefined context", () => {
    expect(sanitizeContext(null)).toEqual({});
    expect(sanitizeContext(undefined)).toEqual({});
  });

  it("handles array context", () => {
    expect(sanitizeContext(["injection"])).toEqual({});
  });
});

// ─── NOTIFICATION SCHEMA TESTS ───────────────────────────────────────────────

describe("notification recipient model", () => {
  it("accepts broadcast notification (default)", () => {
    const result = insertNotificationSchema.safeParse({
      title: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(true);
  });

  it("accepts user-targeted notification", () => {
    const result = insertNotificationSchema.safeParse({
      title: "Test",
      body: "Test body",
      audience: "user",
      recipientUserId: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts role-targeted notification", () => {
    const result = insertNotificationSchema.safeParse({
      title: "Test",
      body: "Test body",
      audience: "role",
      recipientRole: "supervisor",
    });
    expect(result.success).toBe(true);
  });
});

// ─── PASSWORD STRENGTH TESTS ─────────────────────────────────────────────────

describe("password strength validation", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const schema = z.string().min(8);
    expect(schema.safeParse("abc").success).toBe(false);
    expect(schema.safeParse("1234567").success).toBe(false);
  });

  it("accepts passwords of 8+ characters", () => {
    const schema = z.string().min(8);
    expect(schema.safeParse("12345678").success).toBe(true);
    expect(schema.safeParse("a-long-secure-password").success).toBe(true);
  });
});

// ─── CHUNK 2: OWNERSHIP/RBAC VALIDATION SCHEMAS ─────────────────────────────

describe("shiftRequestReviewSchema", () => {
  const shiftRequestReviewSchema = z.object({
    status: z.string(),
    note: z.string().optional(),
  }).strict();

  it("accepts valid review", () => {
    expect(shiftRequestReviewSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(shiftRequestReviewSchema.safeParse({ status: "rejected", note: "Understaffed" }).success).toBe(true);
  });

  it("rejects missing status", () => {
    expect(shiftRequestReviewSchema.safeParse({ note: "test" }).success).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(shiftRequestReviewSchema.safeParse({ status: "approved", reviewedBy: 1 }).success).toBe(false);
  });
});

describe("roomMessageSchema", () => {
  const roomMessageSchema = z.object({
    content: z.string().min(1).max(10000),
    type: z.string().optional(),
  }).strict();

  it("accepts valid message", () => {
    expect(roomMessageSchema.safeParse({ content: "Hello" }).success).toBe(true);
    expect(roomMessageSchema.safeParse({ content: "Hello", type: "message" }).success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(roomMessageSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content exceeding 10000 chars", () => {
    expect(roomMessageSchema.safeParse({ content: "x".repeat(10001) }).success).toBe(false);
  });

  it("rejects userId injection", () => {
    expect(roomMessageSchema.safeParse({ content: "Hello", userId: 99 }).success).toBe(false);
  });

  it("rejects roomId injection", () => {
    expect(roomMessageSchema.safeParse({ content: "Hello", roomId: 1 }).success).toBe(false);
  });
});

describe("activityFeedSchema", () => {
  const activityFeedSchema = z.object({
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable().optional(),
    entityLabel: z.string().nullable().optional(),
    stationId: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  it("accepts valid activity entry", () => {
    expect(activityFeedSchema.safeParse({
      action: "created",
      entityType: "vehicle",
      entityId: "123",
    }).success).toBe(true);
  });

  it("rejects userId injection", () => {
    expect(activityFeedSchema.safeParse({
      action: "created",
      entityType: "vehicle",
      userId: 99,
    }).success).toBe(false);
  });

  it("rejects actorName injection", () => {
    expect(activityFeedSchema.safeParse({
      action: "created",
      entityType: "vehicle",
      actorName: "hacker",
    }).success).toBe(false);
  });
});

describe("digitalTwinSchema", () => {
  const digitalTwinSchema = z.object({
    stationId: z.number().nullable().optional(),
    snapshotType: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  }).strict();

  it("accepts valid snapshot", () => {
    expect(digitalTwinSchema.safeParse({
      data: { vehicles: 10, wash: 3 },
    }).success).toBe(true);
  });

  it("rejects missing data", () => {
    expect(digitalTwinSchema.safeParse({
      stationId: 1,
    }).success).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(digitalTwinSchema.safeParse({
      data: {},
      createdAt: "2026-01-01",
    }).success).toBe(false);
  });
});

describe("automationRulePatchSchema", () => {
  const automationRulePatchSchema = z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    trigger: z.string().optional(),
    conditions: z.record(z.string(), z.unknown()).nullable().optional(),
    actions: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    scope: z.string().optional(),
    active: z.boolean().optional(),
    version: z.number().optional(),
  }).strict();

  it("accepts valid partial update", () => {
    expect(automationRulePatchSchema.safeParse({ active: false }).success).toBe(true);
    expect(automationRulePatchSchema.safeParse({ name: "New name", trigger: "vehicle:status" }).success).toBe(true);
  });

  it("rejects id injection", () => {
    expect(automationRulePatchSchema.safeParse({ id: 1, name: "test" }).success).toBe(false);
  });

  it("rejects createdBy injection", () => {
    expect(automationRulePatchSchema.safeParse({ createdBy: 99 }).success).toBe(false);
  });

  it("rejects createdAt injection", () => {
    expect(automationRulePatchSchema.safeParse({ createdAt: "2020-01-01" }).success).toBe(false);
  });

  it("rejects triggerCount injection", () => {
    expect(automationRulePatchSchema.safeParse({ triggerCount: 999 }).success).toBe(false);
  });
});

describe("automation rule schema validation", () => {
  it("requires createdBy", () => {
    const result = insertAutomationRuleSchema.safeParse({
      name: "Test rule",
      trigger: "vehicle:status",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid rule with createdBy", () => {
    const result = insertAutomationRuleSchema.safeParse({
      name: "Test rule",
      trigger: "vehicle:status",
      createdBy: 1,
    });
    expect(result.success).toBe(true);
  });
});

// ─── PUBLIC ROOM ENTITY TYPE WHITELIST TESTS ─────────────────────────────────
// These tests verify that only whitelisted entity types are accepted by
// the public room resolve endpoint schema, blocking enumeration of internal rooms.

describe("public room entity type whitelist", () => {
  const PUBLIC_ROOM_ENTITY_TYPES = ['reservation', 'washer-ops'] as const;

  const publicResolveSchema = z.object({
    entityType: z.enum(PUBLIC_ROOM_ENTITY_TYPES),
    entityId: z.string().min(1).max(100),
    title: z.string().min(1).max(200).optional(),
  }).strict();

  it("accepts reservation entity type", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "reservation",
      entityId: "RES-001",
    });
    expect(result.success).toBe(true);
  });

  it("accepts washer-ops entity type", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "washer-ops",
      entityId: "default",
    });
    expect(result.success).toBe(true);
  });

  it("rejects notification entity type (war room)", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "notification",
      entityId: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects vehicle entity type (internal room)", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "vehicle",
      entityId: "YHA-1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects shift entity type (internal room)", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "shift",
      entityId: "week-2026-03-09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects operations entity type (internal room)", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "operations",
      entityId: "ops-daily",
    });
    expect(result.success).toBe(false);
  });

  it("rejects arbitrary entity type", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "hacker-room",
      entityId: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty entity type", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "",
      entityId: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = publicResolveSchema.safeParse({
      entityType: "reservation",
      entityId: "RES-001",
      admin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("public room ID enumeration guard", () => {
  const PUBLIC_ROOM_ENTITY_TYPES = ['reservation', 'washer-ops'] as const;

  function isPublicRoomType(entityType: string): boolean {
    return (PUBLIC_ROOM_ENTITY_TYPES as readonly string[]).includes(entityType);
  }

  it("allows access to reservation rooms", () => {
    expect(isPublicRoomType("reservation")).toBe(true);
  });

  it("allows access to washer-ops rooms", () => {
    expect(isPublicRoomType("washer-ops")).toBe(true);
  });

  it("blocks access to notification rooms (war rooms)", () => {
    expect(isPublicRoomType("notification")).toBe(false);
  });

  it("blocks access to vehicle rooms", () => {
    expect(isPublicRoomType("vehicle")).toBe(false);
  });

  it("blocks access to shift rooms", () => {
    expect(isPublicRoomType("shift")).toBe(false);
  });

  it("blocks access to operations rooms", () => {
    expect(isPublicRoomType("operations")).toBe(false);
  });

  it("blocks access to unknown room types", () => {
    expect(isPublicRoomType("admin")).toBe(false);
    expect(isPublicRoomType("")).toBe(false);
    expect(isPublicRoomType("internal")).toBe(false);
  });
});

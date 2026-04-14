import { describe, it, expect } from "vitest";
import {
  calculateSlaDeadline,
  SLA_HOURS,
  calculateWashPriorityScore,
  escalateSeverity,
  SEVERITY_LADDER,
  hasDateOverlap,
  isValidTransition,
  redactSecrets,
} from "../../server/businessRules.js";
import {
  INCIDENT_TRANSITIONS,
  RESERVATION_TRANSITIONS,
  REPAIR_ORDER_TRANSITIONS,
} from "../../server/routes/_helpers.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. SLA DEADLINE CALCULATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("calculateSlaDeadline", () => {
  const NOW = new Date("2026-06-15T12:00:00Z").getTime();

  it("returns null for null/undefined priority", () => {
    expect(calculateSlaDeadline(null, NOW)).toBeNull();
    expect(calculateSlaDeadline(undefined, NOW)).toBeNull();
  });

  it("returns null for unknown priority", () => {
    expect(calculateSlaDeadline("UltraFast", NOW)).toBeNull();
  });

  it("High → 2 hours from now", () => {
    const d = calculateSlaDeadline("High", NOW)!;
    expect(d.getTime()).toBe(NOW + 2 * 3600000);
  });

  it("Medium → 4 hours from now", () => {
    const d = calculateSlaDeadline("Medium", NOW)!;
    expect(d.getTime()).toBe(NOW + 4 * 3600000);
  });

  it("Low → 8 hours from now", () => {
    const d = calculateSlaDeadline("Low", NOW)!;
    expect(d.getTime()).toBe(NOW + 8 * 3600000);
  });

  it("SLA_HOURS map has exactly 3 entries", () => {
    expect(Object.keys(SLA_HOURS)).toEqual(["High", "Medium", "Low"]);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. WASH PRIORITY SCORING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("calculateWashPriorityScore", () => {
  const NOW = new Date("2026-06-15T12:00:00Z").getTime();

  it("High priority base score = 40", () => {
    expect(calculateWashPriorityScore({ priority: "High" }, NOW)).toBe(40);
  });

  it("Medium priority base score = 20", () => {
    expect(calculateWashPriorityScore({ priority: "Medium" }, NOW)).toBe(20);
  });

  it("Low / null priority base score = 5", () => {
    expect(calculateWashPriorityScore({ priority: "Low" }, NOW)).toBe(5);
    expect(calculateWashPriorityScore({ priority: null }, NOW)).toBe(5);
  });

  it("SLA breach (+50) when deadline has passed", () => {
    const item = {
      priority: "High",
      slaDeadline: new Date(NOW - 3600000).toISOString(), // 1h ago
    };
    expect(calculateWashPriorityScore(item, NOW)).toBe(40 + 50);
  });

  it("SLA ≤1h remaining (+30)", () => {
    const item = {
      priority: "Medium",
      slaDeadline: new Date(NOW + 30 * 60000).toISOString(), // 30 min left
    };
    expect(calculateWashPriorityScore(item, NOW)).toBe(20 + 30);
  });

  it("SLA 1-2h remaining (+15)", () => {
    const item = {
      priority: "Medium",
      slaDeadline: new Date(NOW + 90 * 60000).toISOString(), // 1.5h left
    };
    expect(calculateWashPriorityScore(item, NOW)).toBe(20 + 15);
  });

  it("SLA >2h remaining (+0)", () => {
    const item = {
      priority: "Medium",
      slaDeadline: new Date(NOW + 5 * 3600000).toISOString(),
    };
    expect(calculateWashPriorityScore(item, NOW)).toBe(20);
  });

  it("wait time adds 1 point per 30min, capped at 20", () => {
    // 2 hours wait → 4 points
    const item2h = { priority: "Low", createdAt: new Date(NOW - 2 * 3600000).toISOString() };
    expect(calculateWashPriorityScore(item2h, NOW)).toBe(5 + 4);

    // 24 hours wait → capped at 20
    const item24h = { priority: "Low", createdAt: new Date(NOW - 24 * 3600000).toISOString() };
    expect(calculateWashPriorityScore(item24h, NOW)).toBe(5 + 20);
  });

  it("full_detail wash type adds +10", () => {
    const item = { priority: "Low", washType: "full_detail" };
    expect(calculateWashPriorityScore(item, NOW)).toBe(5 + 10);
  });

  it("combined: breached High + 3h wait + full_detail = max realistic", () => {
    const item = {
      priority: "High",
      slaDeadline: new Date(NOW - 1000).toISOString(),
      createdAt: new Date(NOW - 3 * 3600000).toISOString(),
      washType: "full_detail",
    };
    // 40 (high) + 50 (breached) + 6 (3h wait) + 10 (full_detail) = 106
    expect(calculateWashPriorityScore(item, NOW)).toBe(106);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. INCIDENT SEVERITY ESCALATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("escalateSeverity", () => {
  it("low → medium", () => expect(escalateSeverity("low")).toBe("medium"));
  it("medium → high", () => expect(escalateSeverity("medium")).toBe("high"));
  it("high → critical", () => expect(escalateSeverity("high")).toBe("critical"));
  it("critical stays critical (ceiling)", () => expect(escalateSeverity("critical")).toBe("critical"));
  it("unknown severity defaults to medium", () => expect(escalateSeverity("foo")).toBe("medium"));

  it("SEVERITY_LADDER has correct order", () => {
    expect([...SEVERITY_LADDER]).toEqual(["low", "medium", "high", "critical"]);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. INCIDENT STATE MACHINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Incident transitions", () => {
  it("open → investigating is valid", () => {
    expect(isValidTransition(INCIDENT_TRANSITIONS, "open", "investigating")).toBe(true);
  });

  it("open → resolved is NOT valid (must investigate first)", () => {
    expect(isValidTransition(INCIDENT_TRANSITIONS, "open", "resolved")).toBe(false);
  });

  it("investigating → mitigating | resolved are valid", () => {
    expect(isValidTransition(INCIDENT_TRANSITIONS, "investigating", "mitigating")).toBe(true);
    expect(isValidTransition(INCIDENT_TRANSITIONS, "investigating", "resolved")).toBe(true);
  });

  it("resolved → closed | investigating (reopen) are valid", () => {
    expect(isValidTransition(INCIDENT_TRANSITIONS, "resolved", "closed")).toBe(true);
    expect(isValidTransition(INCIDENT_TRANSITIONS, "resolved", "investigating")).toBe(true);
  });

  it("closed is terminal", () => {
    expect(INCIDENT_TRANSITIONS.closed).toEqual([]);
    expect(isValidTransition(INCIDENT_TRANSITIONS, "closed", "open")).toBe(false);
  });

  it("every state in transition map", () => {
    expect(Object.keys(INCIDENT_TRANSITIONS).sort()).toEqual(
      ["closed", "investigating", "mitigating", "open", "resolved"]
    );
  });

  it("all target states exist as keys", () => {
    for (const targets of Object.values(INCIDENT_TRANSITIONS)) {
      for (const t of targets) {
        expect(INCIDENT_TRANSITIONS).toHaveProperty(t);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. RESERVATION STATE MACHINE (Vehicle Checkout/Return)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Reservation transitions", () => {
  it("confirmed → checked_out (vehicle checkout)", () => {
    expect(isValidTransition(RESERVATION_TRANSITIONS, "confirmed", "checked_out")).toBe(true);
  });

  it("confirmed → cancelled | no_show allowed", () => {
    expect(isValidTransition(RESERVATION_TRANSITIONS, "confirmed", "cancelled")).toBe(true);
    expect(isValidTransition(RESERVATION_TRANSITIONS, "confirmed", "no_show")).toBe(true);
  });

  it("checked_out → returned (vehicle return)", () => {
    expect(isValidTransition(RESERVATION_TRANSITIONS, "checked_out", "returned")).toBe(true);
  });

  it("checked_out cannot skip to cancelled directly", () => {
    expect(isValidTransition(RESERVATION_TRANSITIONS, "checked_out", "cancelled")).toBe(false);
  });

  it("returned is terminal", () => {
    expect(RESERVATION_TRANSITIONS.returned).toEqual([]);
  });

  it("cancelled is terminal", () => {
    expect(RESERVATION_TRANSITIONS.cancelled).toEqual([]);
  });

  it("no_show is terminal", () => {
    expect(RESERVATION_TRANSITIONS.no_show).toEqual([]);
  });

  it("complete happy path: confirmed → checked_out → returned", () => {
    expect(isValidTransition(RESERVATION_TRANSITIONS, "confirmed", "checked_out")).toBe(true);
    expect(isValidTransition(RESERVATION_TRANSITIONS, "checked_out", "returned")).toBe(true);
  });

  it("all target states exist as keys", () => {
    for (const targets of Object.values(RESERVATION_TRANSITIONS)) {
      for (const t of targets) {
        expect(RESERVATION_TRANSITIONS).toHaveProperty(t);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. REPAIR ORDER STATE MACHINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Repair order transitions", () => {
  it("open → in_progress | cancelled", () => {
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "open", "in_progress")).toBe(true);
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "open", "cancelled")).toBe(true);
  });

  it("in_progress → awaiting_parts | completed | cancelled", () => {
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "in_progress", "awaiting_parts")).toBe(true);
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "in_progress", "completed")).toBe(true);
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "in_progress", "cancelled")).toBe(true);
  });

  it("awaiting_parts → in_progress (resume) | cancelled", () => {
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "awaiting_parts", "in_progress")).toBe(true);
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "awaiting_parts", "cancelled")).toBe(true);
  });

  it("awaiting_parts CANNOT go directly to completed", () => {
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "awaiting_parts", "completed")).toBe(false);
  });

  it("completed is terminal", () => {
    expect(REPAIR_ORDER_TRANSITIONS.completed).toEqual([]);
  });

  it("cancelled is terminal", () => {
    expect(REPAIR_ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it("happy path: open → in_progress → completed", () => {
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "open", "in_progress")).toBe(true);
    expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, "in_progress", "completed")).toBe(true);
  });

  it("parts-wait path: open → in_progress → awaiting_parts → in_progress → completed", () => {
    const path = ["open", "in_progress", "awaiting_parts", "in_progress", "completed"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValidTransition(REPAIR_ORDER_TRANSITIONS, path[i], path[i + 1])).toBe(true);
    }
  });

  it("all target states exist as keys", () => {
    for (const targets of Object.values(REPAIR_ORDER_TRANSITIONS)) {
      for (const t of targets) {
        expect(REPAIR_ORDER_TRANSITIONS).toHaveProperty(t);
      }
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. RESERVATION DATE OVERLAP DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("hasDateOverlap", () => {
  const JUN15 = "2026-06-15T10:00:00Z";
  const JUN17 = "2026-06-17T10:00:00Z";
  const JUN18 = "2026-06-18T10:00:00Z";
  const JUN20 = "2026-06-20T10:00:00Z";
  const JUN22 = "2026-06-22T10:00:00Z";

  it("no overlap — new booking entirely after existing", () => {
    expect(hasDateOverlap(JUN15, JUN17, JUN18, JUN20)).toBe(false);
  });

  it("no overlap — new booking entirely before existing", () => {
    expect(hasDateOverlap(JUN18, JUN20, JUN15, JUN17)).toBe(false);
  });

  it("overlap — new booking starts during existing", () => {
    // existing: 15-20, new: 17-22
    expect(hasDateOverlap(JUN15, JUN20, JUN17, JUN22)).toBe(true);
  });

  it("overlap — new booking ends during existing", () => {
    // existing: 17-22, new: 15-18
    expect(hasDateOverlap(JUN17, JUN22, JUN15, JUN18)).toBe(true);
  });

  it("overlap — new booking contains existing", () => {
    // existing: 17-18, new: 15-20
    expect(hasDateOverlap(JUN17, JUN18, JUN15, JUN20)).toBe(true);
  });

  it("overlap — existing contains new booking", () => {
    // existing: 15-22, new: 17-20
    expect(hasDateOverlap(JUN15, JUN22, JUN17, JUN20)).toBe(true);
  });

  it("edge — exactly touching (end == start) is NOT overlap", () => {
    // existing ends exactly when new starts
    expect(hasDateOverlap(JUN15, JUN17, JUN17, JUN20)).toBe(false);
  });

  it("accepts Date objects", () => {
    expect(hasDateOverlap(new Date(JUN15), new Date(JUN20), new Date(JUN17), new Date(JUN22))).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. isValidTransition — EDGE CASES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("isValidTransition edge cases", () => {
  const TM = { a: ["b", "c"], b: [], c: ["a"] };

  it("returns false for unknown from-state", () => {
    expect(isValidTransition(TM, "x", "b")).toBe(false);
  });

  it("returns false for same-state transition not in map", () => {
    expect(isValidTransition(TM, "a", "a")).toBe(false);
  });

  it("returns false for empty allowed list (terminal)", () => {
    expect(isValidTransition(TM, "b", "a")).toBe(false);
  });

  it("allows cyclic transition if map permits", () => {
    expect(isValidTransition(TM, "c", "a")).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. SECRET REDACTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("redactSecrets", () => {
  it("redacts known secret keys", () => {
    const result = redactSecrets({ apiKey: "sk_live_123", name: "My Service" });
    expect(result.apiKey).toBe("***REDACTED***");
    expect(result.name).toBe("My Service");
  });

  it("redacts case-insensitively", () => {
    const result = redactSecrets({ APIKEY: "abc", WebhookToken: "xyz" });
    expect(result.APIKEY).toBe("***REDACTED***");
    expect(result.WebhookToken).toBe("***REDACTED***");
  });

  it("does not redact empty strings", () => {
    const result = redactSecrets({ apiKey: "" });
    expect(result.apiKey).toBe("");
  });

  it("does not redact non-string secret values", () => {
    const result = redactSecrets({ apiKey: 12345 as unknown as string });
    expect(result.apiKey).toBe(12345);
  });

  it("passes through non-secret keys untouched", () => {
    const result = redactSecrets({ baseUrl: "https://api.example.com", timeout: 5000 });
    expect(result.baseUrl).toBe("https://api.example.com");
    expect(result.timeout).toBe(5000);
  });

  it("handles empty config", () => {
    expect(redactSecrets({})).toEqual({});
  });

  it("redacts compound key names", () => {
    const result = redactSecrets({ myApiSecretKey: "secret123", dbPassword: "p@ss" });
    expect(result.myApiSecretKey).toBe("***REDACTED***");
    expect(result.dbPassword).toBe("***REDACTED***");
  });
});

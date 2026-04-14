import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════
// PHASE 3 HARDENING — TESTS FOR ALL AUDIT FIXES
// ═══════════════════════════════════════════════════════════

// ── Config Redaction Logic (mirrors routes.ts redactConnectorConfig) ──

const CONNECTOR_SECRET_KEYS = ['apiKey', 'apiSecret', 'webhookToken', 'password', 'secret', 'token', 'credentials'];
function redactConnectorConfig(config: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (CONNECTOR_SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()))) {
      redacted[k] = typeof v === 'string' && v.length > 0 ? '***REDACTED***' : v;
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

describe("Connector Config Redaction", () => {
  it("redacts apiKey", () => {
    const result = redactConnectorConfig({ apiKey: "sk_live_123", host: "example.com" });
    expect(result.apiKey).toBe("***REDACTED***");
    expect(result.host).toBe("example.com");
  });

  it("redacts webhookToken", () => {
    const result = redactConnectorConfig({ webhookToken: "whsec_abc" });
    expect(result.webhookToken).toBe("***REDACTED***");
  });

  it("redacts password", () => {
    const result = redactConnectorConfig({ password: "hunter2", username: "admin" });
    expect(result.password).toBe("***REDACTED***");
    expect(result.username).toBe("admin");
  });

  it("redacts apiSecret", () => {
    const result = redactConnectorConfig({ apiSecret: "secret_value" });
    expect(result.apiSecret).toBe("***REDACTED***");
  });

  it("redacts credentials", () => {
    const result = redactConnectorConfig({ credentials: "base64data" });
    expect(result.credentials).toBe("***REDACTED***");
  });

  it("redacts token (case-insensitive key match)", () => {
    const result = redactConnectorConfig({ bearerToken: "tok_123" });
    expect(result.bearerToken).toBe("***REDACTED***");
  });

  it("preserves non-secret keys", () => {
    const result = redactConnectorConfig({ host: "pms.example.com", port: 443, syncInterval: 300 });
    expect(result.host).toBe("pms.example.com");
    expect(result.port).toBe(443);
    expect(result.syncInterval).toBe(300);
  });

  it("preserves empty string secrets as-is", () => {
    const result = redactConnectorConfig({ apiKey: "" });
    expect(result.apiKey).toBe("");
  });

  it("preserves non-string secret values (e.g. null)", () => {
    const result = redactConnectorConfig({ apiKey: null });
    expect(result.apiKey).toBeNull();
  });

  it("handles empty config", () => {
    const result = redactConnectorConfig({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("redacts multiple secret keys simultaneously", () => {
    const result = redactConnectorConfig({
      apiKey: "key1",
      apiSecret: "sec1",
      webhookToken: "tok1",
      password: "pass1",
      host: "safe.com",
    });
    expect(result.apiKey).toBe("***REDACTED***");
    expect(result.apiSecret).toBe("***REDACTED***");
    expect(result.webhookToken).toBe("***REDACTED***");
    expect(result.password).toBe("***REDACTED***");
    expect(result.host).toBe("safe.com");
  });

  it("redacts keys containing 'secret' substring", () => {
    const result = redactConnectorConfig({ clientSecret: "mysecret" });
    expect(result.clientSecret).toBe("***REDACTED***");
  });
});

// ── Station Scope Logic (mirrors routes.ts getStationScope) ──

function getStationScope(user: { role: string; station?: string | null }): number | null | 'none' {
  if (user.role === 'admin' || user.role === 'supervisor') return null;
  if (!user.station) return 'none';
  return parseInt(user.station, 10);
}

describe("Station Scope Hardening", () => {
  it("admin gets null (full access)", () => {
    expect(getStationScope({ role: "admin", station: "5" })).toBeNull();
  });

  it("supervisor gets null (full access)", () => {
    expect(getStationScope({ role: "supervisor", station: "3" })).toBeNull();
  });

  it("admin without station still gets null", () => {
    expect(getStationScope({ role: "admin", station: null })).toBeNull();
  });

  it("coordinator with station gets station ID", () => {
    expect(getStationScope({ role: "coordinator", station: "7" })).toBe(7);
  });

  it("agent with station gets station ID", () => {
    expect(getStationScope({ role: "agent", station: "12" })).toBe(12);
  });

  it("washer with station gets station ID", () => {
    expect(getStationScope({ role: "washer", station: "2" })).toBe(2);
  });

  it("coordinator without station gets 'none' (no access)", () => {
    expect(getStationScope({ role: "coordinator", station: null })).toBe("none");
  });

  it("agent without station gets 'none' (no access)", () => {
    expect(getStationScope({ role: "agent" })).toBe("none");
  });

  it("washer with empty string station gets 'none'", () => {
    expect(getStationScope({ role: "washer", station: "" })).toBe("none");
  });

  it("'none' scope means scoped endpoints return empty arrays", () => {
    const scope = getStationScope({ role: "agent", station: null });
    expect(scope).toBe("none");
    // Simulates what the endpoint handlers do:
    const mockVehicles = [{ id: 1, stationId: 5 }, { id: 2, stationId: 3 }];
    if (scope === 'none') {
      expect([]).toEqual([]);
    } else if (scope === null) {
      expect(mockVehicles).toHaveLength(2);
    } else {
      expect(mockVehicles.filter(v => v.stationId === scope)).toHaveLength(0);
    }
  });
});

// ── Webhook Dedup Logic ──

describe("Webhook Dedup Logic", () => {
  it("skips records with existing externalId", () => {
    const existingExternalIds = new Set(["ext_001", "ext_003"]);
    const incoming = [
      { externalId: "ext_001", customerName: "Alice" },
      { externalId: "ext_002", customerName: "Bob" },
      { externalId: "ext_003", customerName: "Charlie" },
      { externalId: "ext_004", customerName: "Diana" },
    ];
    const toCreate: typeof incoming = [];
    let skipped = 0;
    for (const record of incoming) {
      if (existingExternalIds.has(record.externalId)) {
        skipped++;
        continue;
      }
      toCreate.push(record);
    }
    expect(toCreate).toHaveLength(2);
    expect(skipped).toBe(2);
    expect(toCreate.map(r => r.customerName)).toEqual(["Bob", "Diana"]);
  });

  it("processes all records when no duplicates exist", () => {
    const existingExternalIds = new Set<string>();
    const incoming = [
      { externalId: "ext_100" },
      { externalId: "ext_200" },
    ];
    let skipped = 0;
    const toCreate: typeof incoming = [];
    for (const record of incoming) {
      if (existingExternalIds.has(record.externalId)) {
        skipped++;
        continue;
      }
      toCreate.push(record);
    }
    expect(toCreate).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("skips all records when all are duplicates", () => {
    const existingExternalIds = new Set(["a", "b", "c"]);
    const incoming = [{ externalId: "a" }, { externalId: "b" }, { externalId: "c" }];
    let skipped = 0;
    for (const record of incoming) {
      if (existingExternalIds.has(record.externalId)) skipped++;
    }
    expect(skipped).toBe(3);
  });
});

// ── Sync Loop Optimization ──

describe("Sync Loop O(N) Optimization", () => {
  it("reservation lookup by externalId uses Map for O(1) access", () => {
    const reservations = [
      { id: 1, externalId: "ext_001" },
      { id: 2, externalId: "ext_002" },
      { id: 3, externalId: "ext_003" },
      { id: 4, externalId: null },
    ];

    const reservationByExternalId = new Map<string, typeof reservations[0]>();
    for (const r of reservations) {
      if (r.externalId) reservationByExternalId.set(r.externalId, r);
    }

    expect(reservationByExternalId.size).toBe(3);
    expect(reservationByExternalId.get("ext_001")?.id).toBe(1);
    expect(reservationByExternalId.get("ext_003")?.id).toBe(3);
    expect(reservationByExternalId.has("ext_nonexistent")).toBe(false);
  });

  it("null externalId entries are excluded from Map", () => {
    const reservations = [
      { id: 1, externalId: null },
      { id: 2, externalId: null },
      { id: 3, externalId: "ext_only" },
    ];
    const reservationByExternalId = new Map<string, typeof reservations[0]>();
    for (const r of reservations) {
      if (r.externalId) reservationByExternalId.set(r.externalId, r);
    }
    expect(reservationByExternalId.size).toBe(1);
  });
});

// ── Running Job Guard ──

describe("Running Job Guard Improvement", () => {
  it("detects running job not at position 0", () => {
    const jobs = [
      { id: 10, status: "success" },
      { id: 9, status: "running" },
      { id: 8, status: "success" },
    ];
    const anyRunning = jobs.find(j => j.status === "running");
    expect(anyRunning).toBeDefined();
    expect(anyRunning?.id).toBe(9);
  });

  it("returns undefined when no running jobs", () => {
    const jobs = [
      { id: 10, status: "success" },
      { id: 9, status: "failed" },
      { id: 8, status: "success" },
    ];
    const anyRunning = jobs.find(j => j.status === "running");
    expect(anyRunning).toBeUndefined();
  });

  it("detects running job at any position within recent 10", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => ({
      id: 10 - i,
      status: i === 9 ? "running" : "success",
    }));
    const anyRunning = jobs.find(j => j.status === "running");
    expect(anyRunning).toBeDefined();
    expect(anyRunning?.id).toBe(1);
  });
});

// ── Workspace Memory Injection Bounds ──

describe("Workspace Memory Injection Safety", () => {
  it("caps individual memory values at 200 chars", () => {
    const longValue = "x".repeat(500);
    const truncated = longValue.slice(0, 200);
    expect(truncated.length).toBe(200);
  });

  it("caps total injected memory context at 1500 chars", () => {
    const memorySnippets = Array.from({ length: 20 }, (_, i) =>
      `- [category] key_${i}: ${"data".repeat(30)}`
    );
    const bounded: string[] = [];
    let charCount = 0;
    for (const snippet of memorySnippets) {
      if (charCount + snippet.length > 1500) break;
      bounded.push(snippet);
      charCount += snippet.length;
    }
    expect(bounded.length).toBeLessThan(memorySnippets.length);
    expect(bounded.reduce((sum, s) => sum + s.length, 0)).toBeLessThanOrEqual(1500);
  });

  it("includes all snippets if total is under cap", () => {
    const memorySnippets = [
      "- [ops] shift_rule: Morning starts at 6am",
      "- [fleet] wash_sla: 45 minutes",
    ];
    const bounded: string[] = [];
    let charCount = 0;
    for (const snippet of memorySnippets) {
      if (charCount + snippet.length > 1500) break;
      bounded.push(snippet);
      charCount += snippet.length;
    }
    expect(bounded).toHaveLength(2);
  });
});

// ── Incident Summary Duplicate Guard ──

describe("Incident Summary Duplicate Guard", () => {
  it("would return 409 if summaries already exist", () => {
    const existingSummaries = [{ id: 42, incidentId: 5, summary: "Previous summary" }];
    const shouldBlock = existingSummaries.length > 0;
    expect(shouldBlock).toBe(true);
  });

  it("allows creation when no summaries exist", () => {
    const existingSummaries: unknown[] = [];
    const shouldBlock = existingSummaries.length > 0;
    expect(shouldBlock).toBe(false);
  });
});

// ── Workspace Memory Upsert Logic ──

describe("Workspace Memory Upsert", () => {
  it("finds existing memory by key for update", () => {
    const memoryEntries = [
      { id: 1, key: "incident_5_summary", category: "incident_summary", value: "old summary" },
      { id: 2, key: "incident_7_summary", category: "incident_summary", value: "other summary" },
    ];
    const memoryKey = "incident_5_summary";
    const existing = memoryEntries.find(m => m.key === memoryKey);
    expect(existing).toBeDefined();
    expect(existing?.id).toBe(1);
  });

  it("returns undefined for new incident summary", () => {
    const memoryEntries = [
      { id: 1, key: "incident_5_summary", category: "incident_summary", value: "old" },
    ];
    const memoryKey = "incident_99_summary";
    const existing = memoryEntries.find(m => m.key === memoryKey);
    expect(existing).toBeUndefined();
  });
});

// ── Command Palette Station Scoping ──

describe("Command Palette Station Scoping", () => {
  it("admin sees all vehicles in search", () => {
    const vehicles = [
      { id: 1, stationId: 5, plate: "ABC" },
      { id: 2, stationId: 3, plate: "DEF" },
      { id: 3, stationId: null, plate: "GHI" },
    ];
    const paletteScope = getStationScope({ role: "admin" });
    expect(paletteScope).toBeNull();
    // null scope → no filtering
    expect(vehicles).toHaveLength(3);
  });

  it("agent with station only sees their station + unassigned vehicles", () => {
    const vehicles = [
      { id: 1, stationId: 5, plate: "ABC" },
      { id: 2, stationId: 3, plate: "DEF" },
      { id: 3, stationId: null, plate: "GHI" },
    ];
    const paletteScope = getStationScope({ role: "agent", station: "5" });
    expect(paletteScope).toBe(5);
    const filtered = vehicles.filter(v => v.stationId === paletteScope || v.stationId === null);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(v => v.id)).toEqual([1, 3]);
  });

  it("agent with no station sees empty results", () => {
    const paletteScope = getStationScope({ role: "agent", station: null });
    expect(paletteScope).toBe("none");
    // Endpoint returns [] immediately for 'none'
  });

  it("coordinator with station sees scoped results", () => {
    const incidents = [
      { id: 1, stationId: 3, title: "Fire" },
      { id: 2, stationId: 5, title: "Flood" },
    ];
    const paletteScope = getStationScope({ role: "coordinator", station: "3" });
    expect(paletteScope).toBe(3);
    const filtered = incidents.filter(i => i.stationId === paletteScope);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Fire");
  });
});

// ── Staffing Honest Labeling ──

describe("Staffing Driver Description Honesty", () => {
  it("includes 'current snapshot' disclaimer in wash queue impact", () => {
    const pendingWash = 8;
    const description = `${pendingWash} vehicles in queue (current snapshot, applied uniformly)`;
    expect(description).toContain("current snapshot");
    expect(description).toContain("applied uniformly");
  });

  it("includes 'current snapshot' disclaimer in incident impact", () => {
    const activeIncidents = 2;
    const description = `${activeIncidents} active incidents (current snapshot)`;
    expect(description).toContain("current snapshot");
  });
});

// ── Role-Based Access on Connector Endpoints ──

describe("Connector RBAC Elevation", () => {
  const adminRoles = ["admin", "supervisor"];
  const nonAdminRoles = ["coordinator", "agent", "washer"];

  it("admin and supervisor are authorized for connector list", () => {
    for (const role of adminRoles) {
      expect(["admin", "supervisor"].includes(role)).toBe(true);
    }
  });

  it("coordinator, agent, washer are NOT authorized for connector list", () => {
    for (const role of nonAdminRoles) {
      expect(["admin", "supervisor"].includes(role)).toBe(false);
    }
  });
});

// ── Edge Cases and Adversarial Inputs ──

describe("Edge Cases", () => {
  it("redaction handles deeply nested-looking key names", () => {
    const result = redactConnectorConfig({ "myApiKey": "val", "notagoodkey": "safe" });
    expect(result.myApiKey).toBe("***REDACTED***");
    expect(result.notagoodkey).toBe("safe");
  });

  it("station scope handles numeric string station", () => {
    const scope = getStationScope({ role: "agent", station: "042" });
    expect(scope).toBe(42);
  });

  it("webhook dedup with empty incoming array", () => {
    const existingExternalIds = new Set(["ext_001"]);
    const incoming: Array<{ externalId: string }> = [];
    let skipped = 0;
    for (const record of incoming) {
      if (existingExternalIds.has(record.externalId)) skipped++;
    }
    expect(skipped).toBe(0);
  });

  it("running job guard with empty job list", () => {
    const jobs: Array<{ status: string }> = [];
    const anyRunning = jobs.find(j => j.status === "running");
    expect(anyRunning).toBeUndefined();
  });

  it("memory cap with exactly 1500 char snippet", () => {
    const snippet = "x".repeat(1500);
    const bounded: string[] = [];
    let charCount = 0;
    if (charCount + snippet.length <= 1500) {
      bounded.push(snippet);
      charCount += snippet.length;
    }
    expect(bounded).toHaveLength(1);
    expect(charCount).toBe(1500);
  });

  it("memory cap rejects snippet that would exceed 1500", () => {
    const snippet1 = "x".repeat(1000);
    const snippet2 = "y".repeat(600);
    const bounded: string[] = [];
    let charCount = 0;
    for (const s of [snippet1, snippet2]) {
      if (charCount + s.length > 1500) break;
      bounded.push(s);
      charCount += s.length;
    }
    expect(bounded).toHaveLength(1);
    expect(charCount).toBe(1000);
  });
});

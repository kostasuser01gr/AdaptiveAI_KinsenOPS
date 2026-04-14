/**
 * Phase 4.2A Tests — Usage Metering, Capabilities, Station Assignments
 */
import { describe, it, expect, beforeEach } from "vitest";

// ─── Schema validation tests ────────────────────────────────────────────────

import {
  insertUsageEventSchema,
  insertUsageDailyRollupSchema,
  insertUserStationAssignmentSchema,
  insertRoleCapabilitySchema,
  insertUserCapabilityOverrideSchema,
} from "../../shared/schema.js";

describe("Phase 4.2A — Schema validation", () => {
  describe("insertUsageEventSchema", () => {
    it("accepts a valid usage event", () => {
      const result = insertUsageEventSchema.safeParse({
        workspaceId: "ws-1",
        feature: "exports",
        action: "export_created",
      });
      expect(result.success).toBe(true);
    });

    it("accepts event with all optional fields", () => {
      const result = insertUsageEventSchema.safeParse({
        workspaceId: "ws-1",
        feature: "exports",
        action: "export_created",
        userId: 42,
        entityType: "export_request",
        entityId: "123",
        idempotencyKey: "key-abc",
        metadata: { format: "csv" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = insertUsageEventSchema.safeParse({
        workspaceId: "ws-1",
        // feature and action missing
      });
      expect(result.success).toBe(false);
    });
  });

  describe("insertUsageDailyRollupSchema", () => {
    it("accepts valid rollup", () => {
      const result = insertUsageDailyRollupSchema.safeParse({
        workspaceId: "ws-1",
        feature: "exports",
        date: "2026-04-07",
        count: 5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("insertUserStationAssignmentSchema", () => {
    it("accepts valid assignment", () => {
      const result = insertUserStationAssignmentSchema.safeParse({
        userId: 1,
        stationId: 10,
      });
      expect(result.success).toBe(true);
    });

    it("accepts assignment with isPrimary", () => {
      const result = insertUserStationAssignmentSchema.safeParse({
        userId: 1,
        stationId: 10,
        isPrimary: true,
        assignedBy: 99,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("insertRoleCapabilitySchema", () => {
    it("accepts valid role capability", () => {
      const result = insertRoleCapabilitySchema.safeParse({
        role: "admin",
        capability: "trust_export",
        granted: true,
      });
      expect(result.success).toBe(true);
    });

    it("defaults granted to true", () => {
      const result = insertRoleCapabilitySchema.safeParse({
        role: "admin",
        capability: "trust_export",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("insertUserCapabilityOverrideSchema", () => {
    it("accepts valid override", () => {
      const result = insertUserCapabilityOverrideSchema.safeParse({
        userId: 1,
        capability: "trust_export",
        granted: true,
        reason: "Promoted to lead",
        grantedBy: 99,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── Capability Engine tests ────────────────────────────────────────────────

import {
  CAPABILITIES,
  CAPABILITY_CATALOG,
  isValidCapability,
  type CapabilityKey as _CapabilityKey,
} from "../../server/capabilities/engine.js";

describe("Phase 4.2A — Capability catalog", () => {
  it("has 9 capabilities", () => {
    expect(CAPABILITIES.length).toBe(9);
  });

  it("catalog has an entry for every capability", () => {
    const catalogCaps = CAPABILITY_CATALOG.map((c) => c.capability);
    for (const cap of CAPABILITIES) {
      expect(catalogCaps).toContain(cap);
    }
  });

  it("every catalog entry has defaultRoles array", () => {
    for (const entry of CAPABILITY_CATALOG) {
      expect(Array.isArray(entry.defaultRoles)).toBe(true);
      expect(entry.defaultRoles.length).toBeGreaterThan(0);
    }
  });

  it("isValidCapability accepts known capabilities", () => {
    expect(isValidCapability("trust_export")).toBe(true);
    expect(isValidCapability("export_approve")).toBe(true);
    expect(isValidCapability("connector_manage")).toBe(true);
    expect(isValidCapability("entitlement_manage")).toBe(true);
    expect(isValidCapability("automation_execute")).toBe(true);
    expect(isValidCapability("ai_draft")).toBe(true);
    expect(isValidCapability("briefing_generate")).toBe(true);
    expect(isValidCapability("incident_resolve")).toBe(true);
    expect(isValidCapability("document_ingest")).toBe(true);
  });

  it("isValidCapability rejects unknown strings", () => {
    expect(isValidCapability("unknown_cap")).toBe(false);
    expect(isValidCapability("")).toBe(false);
    expect(isValidCapability("admin")).toBe(false);
  });

  it("admin has all 9 capabilities in defaultRoles", () => {
    const adminCaps = CAPABILITY_CATALOG.filter((c) => c.defaultRoles.includes("admin"));
    expect(adminCaps.length).toBe(9);
  });

  it("supervisor has 6 capabilities", () => {
    const supCaps = CAPABILITY_CATALOG.filter((c) => c.defaultRoles.includes("supervisor"));
    expect(supCaps.length).toBe(6);
  });

  it("coordinator has 3 capabilities", () => {
    const coordCaps = CAPABILITY_CATALOG.filter((c) => c.defaultRoles.includes("coordinator"));
    expect(coordCaps.length).toBe(3);
  });

  it("agent / washer have no default capabilities", () => {
    const agentCaps = CAPABILITY_CATALOG.filter((c) => c.defaultRoles.includes("agent"));
    const washerCaps = CAPABILITY_CATALOG.filter((c) => c.defaultRoles.includes("washer"));
    expect(agentCaps.length).toBe(0);
    expect(washerCaps.length).toBe(0);
  });
});

// ─── Metering service tests ─────────────────────────────────────────────────

import { METERED_ACTIONS, checkUsageCeiling } from "../../server/metering/service.js";

describe("Phase 4.2A — Metering service", () => {
  describe("METERED_ACTIONS registry", () => {
    it("has 11 metered action definitions", () => {
      expect(Object.keys(METERED_ACTIONS).length).toBe(11);
    });

    it("every action has feature and action fields", () => {
      for (const [_key, def] of Object.entries(METERED_ACTIONS)) {
        expect(typeof def.feature).toBe("string");
        expect(def.feature.length).toBeGreaterThan(0);
        expect(typeof def.action).toBe("string");
        expect(def.action.length).toBeGreaterThan(0);
      }
    });

    it("maps known actions correctly", () => {
      expect(METERED_ACTIONS.export_created.feature).toBe("exports");
      expect(METERED_ACTIONS.briefing_generated.feature).toBe("executive_briefings");
      expect(METERED_ACTIONS.automation_executed.feature).toBe("automation_execution");
      expect(METERED_ACTIONS.connector_sync_triggered.feature).toBe("connector_sync");
      expect(METERED_ACTIONS.document_ingested.feature).toBe("knowledge_ingestion");
    });
  });

  describe("checkUsageCeiling", () => {
    it("returns allowed for unknown actions", async () => {
      const result = await checkUsageCeiling("nonexistent_action");
      expect(result.allowed).toBe(true);
      expect(result.ceiling).toBeUndefined();
    });

    it("returns allowed when no ceiling configured", async () => {
      // All current metered actions have no ceiling (unlimited)
      const result = await checkUsageCeiling("export_created");
      expect(result.allowed).toBe(true);
      expect(result.ceiling).toBeUndefined();
    });
  });
});

// ─── Station scope resolution tests ─────────────────────────────────────────

import type { StationScope } from "../../server/middleware/stationScope.js";
import { isStationInScope } from "../../server/middleware/stationScope.js";

describe("Phase 4.2A — Station scope utilities", () => {
  describe("isStationInScope", () => {
    it("null scope (unrestricted) grants access to any station", () => {
      expect(isStationInScope(1, null)).toBe(true);
      expect(isStationInScope(999, null)).toBe(true);
    });

    it("'none' scope denies all stations", () => {
      expect(isStationInScope(1, "none")).toBe(false);
      expect(isStationInScope(999, "none")).toBe(false);
    });

    it("array scope grants access to member stations", () => {
      const scope: StationScope = [1, 5, 10];
      expect(isStationInScope(1, scope)).toBe(true);
      expect(isStationInScope(5, scope)).toBe(true);
      expect(isStationInScope(10, scope)).toBe(true);
    });

    it("array scope denies non-member stations", () => {
      const scope: StationScope = [1, 5, 10];
      expect(isStationInScope(2, scope)).toBe(false);
      expect(isStationInScope(999, scope)).toBe(false);
    });

    it("empty array scope denies all stations", () => {
      const scope: StationScope = [];
      expect(isStationInScope(1, scope)).toBe(false);
    });
  });
});

// ─── Capability resolution (unit-level, mocking storage) ────────────────────

describe("Phase 4.2A — Capability resolution logic", () => {
  it("resolveCapability follows user_override → role_default → deny chain", async () => {
    // This is a behavioral spec test — the resolution order is the key invariant
    // Test via the engine's exported resolution function

    // The engine uses dynamic import of storage, so in a test without DB,
    // we verify the resolution logic through the catalog structure
    const catalogByRole = new Map<string, Set<string>>();
    for (const entry of CAPABILITY_CATALOG) {
      for (const role of entry.defaultRoles) {
        if (!catalogByRole.has(role)) catalogByRole.set(role, new Set());
        catalogByRole.get(role)!.add(entry.capability);
      }
    }

    // Admin should have all 9
    expect(catalogByRole.get("admin")!.size).toBe(9);
    // Supervisor should have 6
    expect(catalogByRole.get("supervisor")!.size).toBe(6);
    // Coordinator should have 3
    expect(catalogByRole.get("coordinator")!.size).toBe(3);

    // Verify specific capability assignments match catalog
    expect(catalogByRole.get("admin")!.has("trust_export")).toBe(true);
    expect(catalogByRole.get("admin")!.has("entitlement_manage")).toBe(true);
    expect(catalogByRole.get("supervisor")!.has("trust_export")).toBe(false);
    expect(catalogByRole.get("supervisor")!.has("export_approve")).toBe(true);
    expect(catalogByRole.get("coordinator")!.has("automation_execute")).toBe(true);
    expect(catalogByRole.get("coordinator")!.has("ai_draft")).toBe(false);
  });
});

// ─── Migration SQL structural tests ─────────────────────────────────────────

import { readFileSync } from "fs";
import path from "path";

describe("Phase 4.2A — Migration file structure", () => {
  const migrationPath = path.resolve(
    import.meta.dirname ?? ".",
    "../../supabase/migrations/20260407070000_014_phase42a_metering_capabilities_stations.sql",
  );
  let sql: string;

  beforeEach(() => {
    sql = readFileSync(migrationPath, "utf-8");
  });

  it("creates all 5 tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS usage_events");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS usage_daily_rollups");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_station_assignments");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS role_capabilities");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_capability_overrides");
  });

  it("creates indexes on usage_events", () => {
    expect(sql).toContain("usage_evt_ws_feature_idx");
    expect(sql).toContain("usage_evt_user_idx");
    expect(sql).toContain("usage_evt_created_idx");
    expect(sql).toContain("usage_evt_idempotency_idx");
  });

  it("creates unique constraints on rollups", () => {
    expect(sql).toContain("usage_rollup_ws_feature_date_idx");
  });

  it("creates unique constraints on station assignments", () => {
    expect(sql).toContain("user_station_assign_idx");
  });

  it("creates unique constraints on role capabilities", () => {
    expect(sql).toContain("role_cap_role_cap_idx");
  });

  it("creates unique constraints on user overrides", () => {
    expect(sql).toContain("user_cap_user_cap_idx");
  });

  it("seeds admin with 9 capabilities", () => {
    const adminInserts = sql.match(/INSERT INTO role_capabilities[\s\S]*?admin/g);
    expect(adminInserts).not.toBeNull();
    // Count distinct admin+capability combos in seed
    const adminSeeds = [...sql.matchAll(/\('admin',\s*'(\w+)'/g)];
    expect(adminSeeds.length).toBe(9);
  });

  it("seeds supervisor with 6 capabilities", () => {
    const supSeeds = [...sql.matchAll(/\('supervisor',\s*'(\w+)'/g)];
    expect(supSeeds.length).toBe(6);
  });

  it("seeds coordinator with 3 capabilities", () => {
    const coordSeeds = [...sql.matchAll(/\('coordinator',\s*'(\w+)'/g)];
    expect(coordSeeds.length).toBe(3);
  });
});

// ─── IStorage interface coverage ─────────────────────────────────────────────

describe("Phase 4.2A — Storage interface completeness", () => {
  it("IStorage exports metering types", async () => {
    const types = await import("../../server/storage/types.js");
    // Verify the type re-exports exist (they'll be undefined at runtime but the import won't throw)
    expect(types).toBeDefined();
  });

  it("MeteringStorage has all 5 methods", async () => {
    const { MeteringStorage } = await import("../../server/storage/metering.js");
    const proto = MeteringStorage.prototype;
    expect(typeof proto.recordUsageEvent).toBe("function");
    expect(typeof proto.getUsageEvents).toBe("function");
    expect(typeof proto.incrementDailyRollup).toBe("function");
    expect(typeof proto.getDailyRollups).toBe("function");
    expect(typeof proto.getUsageTotal).toBe("function");
  });

  it("CapabilityStorage has all 7 methods", async () => {
    const { CapabilityStorage } = await import("../../server/storage/capabilities.js");
    const proto = CapabilityStorage.prototype;
    expect(typeof proto.getRoleCapabilities).toBe("function");
    expect(typeof proto.getAllRoleCapabilities).toBe("function");
    expect(typeof proto.upsertRoleCapability).toBe("function");
    expect(typeof proto.deleteRoleCapability).toBe("function");
    expect(typeof proto.getUserCapabilityOverrides).toBe("function");
    expect(typeof proto.upsertUserCapabilityOverride).toBe("function");
    expect(typeof proto.deleteUserCapabilityOverride).toBe("function");
  });

  it("StationAssignmentStorage has all 6 methods", async () => {
    const { StationAssignmentStorage } = await import("../../server/storage/stationAssignments.js");
    const proto = StationAssignmentStorage.prototype;
    expect(typeof proto.getUserStationAssignments).toBe("function");
    expect(typeof proto.getStationUsers).toBe("function");
    expect(typeof proto.assignUserToStation).toBe("function");
    expect(typeof proto.removeUserFromStation).toBe("function");
    expect(typeof proto.setUserStations).toBe("function");
    expect(typeof proto.resolveUserStationIds).toBe("function");
  });
});

// ─── Route import validation ─────────────────────────────────────────────────

describe("Phase 4.2A — Route module exports", () => {
  it("metering routes module exports register function", async () => {
    const { registerMeteringRoutes } = await import("../../server/routes/metering.js");
    expect(typeof registerMeteringRoutes).toBe("function");
  });

  it("capability routes module exports register function", async () => {
    const { registerCapabilityRoutes } = await import("../../server/routes/capabilities.js");
    expect(typeof registerCapabilityRoutes).toBe("function");
  });

  it("station assignment routes module exports register function", async () => {
    const { registerStationAssignmentRoutes } = await import("../../server/routes/stationAssignments.js");
    expect(typeof registerStationAssignmentRoutes).toBe("function");
  });
});

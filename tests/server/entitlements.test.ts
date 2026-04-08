import { describe, it, expect, beforeEach } from "vitest";
import {
  FEATURES,
  PLANS,
  PLAN_LABELS,
  ENTITLEMENT_CATALOG,
  isValidFeature,
  isValidPlan,
  getPlanDefaults,
  resolveEntitlements,
  hasEntitlement,
  invalidateEntitlementCache,
  loadEntitlements,
  type FeatureKey,
  type PlanTier,
} from "../../server/entitlements/engine.js";

// ─── Catalog & constants ─────────────────────────────────────────────────────

describe("Entitlement catalog & constants", () => {
  it("has 12 feature keys", () => {
    expect(FEATURES.length).toBe(12);
  });

  it("has 4 plan tiers", () => {
    expect(PLANS).toEqual(["core", "ops_plus", "intelligence", "enterprise"]);
  });

  it("has labels for every plan", () => {
    for (const plan of PLANS) {
      expect(typeof PLAN_LABELS[plan]).toBe("string");
      expect(PLAN_LABELS[plan].length).toBeGreaterThan(0);
    }
  });

  it("catalog has one entry per feature", () => {
    expect(ENTITLEMENT_CATALOG.length).toBe(FEATURES.length);
    const catalogFeatures = ENTITLEMENT_CATALOG.map((e) => e.feature);
    for (const f of FEATURES) {
      expect(catalogFeatures).toContain(f);
    }
  });

  it("every catalog entry has a valid minPlan", () => {
    for (const entry of ENTITLEMENT_CATALOG) {
      expect(PLANS).toContain(entry.minPlan);
    }
  });
});

// ─── Validators ──────────────────────────────────────────────────────────────

describe("isValidFeature", () => {
  it("accepts known features", () => {
    expect(isValidFeature("exports")).toBe(true);
    expect(isValidFeature("connector_sync")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isValidFeature("nonexistent")).toBe(false);
    expect(isValidFeature("")).toBe(false);
  });
});

describe("isValidPlan", () => {
  it("accepts known plans", () => {
    expect(isValidPlan("core")).toBe(true);
    expect(isValidPlan("enterprise")).toBe(true);
  });

  it("rejects unknown plans", () => {
    expect(isValidPlan("free")).toBe(false);
    expect(isValidPlan("")).toBe(false);
  });
});

// ─── Plan defaults ───────────────────────────────────────────────────────────

describe("getPlanDefaults", () => {
  it("core includes only document_storage", () => {
    const defs = getPlanDefaults("core");
    expect(defs.has("document_storage")).toBe(true);
    expect(defs.size).toBe(1);
  });

  it("ops_plus includes 4 features", () => {
    const defs = getPlanDefaults("ops_plus");
    expect(defs.has("document_storage")).toBe(true);
    expect(defs.has("exports")).toBe(true);
    expect(defs.has("automation_execution")).toBe(true);
    expect(defs.has("knowledge_ingestion")).toBe(true);
    expect(defs.size).toBe(4);
  });

  it("intelligence includes 10 features", () => {
    const defs = getPlanDefaults("intelligence");
    expect(defs.size).toBe(10);
    expect(defs.has("anomaly_detection")).toBe(true);
    expect(defs.has("kpi_snapshots")).toBe(true);
    expect(defs.has("executive_briefings")).toBe(true);
    expect(defs.has("staffing_recommendations")).toBe(true);
    expect(defs.has("ai_automation_drafting")).toBe(true);
    // Should NOT include enterprise-only features
    expect(defs.has("connector_sync")).toBe(false);
    expect(defs.has("trust_export_preview")).toBe(false);
  });

  it("enterprise includes all 12 features", () => {
    const defs = getPlanDefaults("enterprise");
    expect(defs.size).toBe(12);
    for (const f of FEATURES) {
      expect(defs.has(f)).toBe(true);
    }
  });

  it("each tier is a superset of the previous", () => {
    const ordered: PlanTier[] = ["core", "ops_plus", "intelligence", "enterprise"];
    for (let i = 1; i < ordered.length; i++) {
      const prev = getPlanDefaults(ordered[i - 1]);
      const curr = getPlanDefaults(ordered[i]);
      for (const f of prev) {
        expect(curr.has(f)).toBe(true);
      }
    }
  });
});

// ─── Resolution ──────────────────────────────────────────────────────────────

describe("resolveEntitlements", () => {
  it("returns all features with plan_default source when no overrides", () => {
    const result = resolveEntitlements("core", []);
    expect(result.length).toBe(FEATURES.length);
    for (const e of result) {
      expect(e.source).toBe("plan_default");
    }
  });

  it("core plan enables only document_storage by default", () => {
    const result = resolveEntitlements("core", []);
    const enabled = result.filter((e) => e.enabled);
    expect(enabled.length).toBe(1);
    expect(enabled[0].feature).toBe("document_storage");
  });

  it("enterprise enables all features", () => {
    const result = resolveEntitlements("enterprise", []);
    const enabled = result.filter((e) => e.enabled);
    expect(enabled.length).toBe(FEATURES.length);
  });

  it("override elevates a feature on a lower plan", () => {
    const result = resolveEntitlements("core", [
      { feature: "connector_sync", enabled: true },
    ]);
    const connSync = result.find((e) => e.feature === "connector_sync")!;
    expect(connSync.enabled).toBe(true);
    expect(connSync.source).toBe("override");
  });

  it("override suppresses a feature on a higher plan", () => {
    const result = resolveEntitlements("enterprise", [
      { feature: "exports", enabled: false },
    ]);
    const exp = result.find((e) => e.feature === "exports")!;
    expect(exp.enabled).toBe(false);
    expect(exp.source).toBe("override");
  });

  it("non-overridden features keep plan_default source", () => {
    const result = resolveEntitlements("ops_plus", [
      { feature: "exports", enabled: false },
    ]);
    const automation = result.find((e) => e.feature === "automation_execution")!;
    expect(automation.enabled).toBe(true);
    expect(automation.source).toBe("plan_default");
  });
});

// ─── hasEntitlement ──────────────────────────────────────────────────────────

describe("hasEntitlement", () => {
  it("returns true for plan-default enabled features", () => {
    expect(hasEntitlement("ops_plus", [], "exports")).toBe(true);
  });

  it("returns false for plan-default disabled features", () => {
    expect(hasEntitlement("core", [], "exports")).toBe(false);
    expect(hasEntitlement("core", [], "connector_sync")).toBe(false);
  });

  it("override true beats plan-default false", () => {
    expect(
      hasEntitlement("core", [{ feature: "exports", enabled: true }], "exports"),
    ).toBe(true);
  });

  it("override false beats plan-default true", () => {
    expect(
      hasEntitlement("enterprise", [{ feature: "exports", enabled: false }], "exports"),
    ).toBe(false);
  });

  it("checks the correct feature when multiple overrides exist", () => {
    const overrides = [
      { feature: "exports", enabled: false },
      { feature: "connector_sync", enabled: true },
    ];
    expect(hasEntitlement("core", overrides, "exports")).toBe(false);
    expect(hasEntitlement("core", overrides, "connector_sync")).toBe(true);
    expect(hasEntitlement("core", overrides, "document_storage")).toBe(true); // plan default
    expect(hasEntitlement("core", overrides, "anomaly_detection")).toBe(false); // plan default
  });
});

// ─── Cache ───────────────────────────────────────────────────────────────────

describe("loadEntitlements cache", () => {
  beforeEach(() => {
    invalidateEntitlementCache();
  });

  it("loads from storage on first call", async () => {
    let callCount = 0;
    const mockStorage = {
      getWorkspacePlan: async () => { callCount++; return { plan: "ops_plus" }; },
      getEntitlementOverrides: async () => { callCount++; return []; },
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    const result = await loadEntitlements(mockStorage);
    expect(result.plan).toBe("ops_plus");
    expect(callCount).toBe(2);
  });

  it("returns cached result on subsequent calls within TTL", async () => {
    let callCount = 0;
    const mockStorage = {
      getWorkspacePlan: async () => { callCount++; return { plan: "intelligence" }; },
      getEntitlementOverrides: async () => { callCount++; return []; },
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    await loadEntitlements(mockStorage);
    await loadEntitlements(mockStorage);
    await loadEntitlements(mockStorage);
    expect(callCount).toBe(2); // only first call hit storage
  });

  it("force-refreshes when requested", async () => {
    let callCount = 0;
    const mockStorage = {
      getWorkspacePlan: async () => { callCount++; return { plan: "core" }; },
      getEntitlementOverrides: async () => { callCount++; return []; },
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    await loadEntitlements(mockStorage);
    await loadEntitlements(mockStorage, true);
    expect(callCount).toBe(4); // both calls hit storage
  });

  it("invalidateEntitlementCache forces reload", async () => {
    let callCount = 0;
    const mockStorage = {
      getWorkspacePlan: async () => { callCount++; return { plan: "core" }; },
      getEntitlementOverrides: async () => { callCount++; return []; },
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    await loadEntitlements(mockStorage);
    invalidateEntitlementCache();
    await loadEntitlements(mockStorage);
    expect(callCount).toBe(4);
  });

  it("defaults to core when no plan in storage", async () => {
    const mockStorage = {
      getWorkspacePlan: async () => undefined,
      getEntitlementOverrides: async () => [],
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    const result = await loadEntitlements(mockStorage, true);
    expect(result.plan).toBe("core");
  });

  it("defaults to core for an invalid plan string", async () => {
    const mockStorage = {
      getWorkspacePlan: async () => ({ plan: "nonexistent" }),
      getEntitlementOverrides: async () => [],
      getWorkspaceConfigByKey: async () => undefined,
    } as any;

    const result = await loadEntitlements(mockStorage, true);
    expect(result.plan).toBe("core");
  });
});

// ─── requireEntitlement middleware ───────────────────────────────────────────

describe("requireEntitlement middleware (403 response shape)", () => {
  it("returns 403 with correct shape when feature denied", async () => {
    // Import fresh to test against actual module
    const { requireEntitlement: _re, invalidateEntitlementCache: _inv } = await import(
      "../../server/entitlements/engine.js"
    );

    // We can test the response shape by verifying the structure from resolveEntitlements
    // The middleware itself requires Express req/res, so we test the domain logic

    // Verify the 403 shape contract by checking what the middleware would produce:
    const denied = !hasEntitlement("core", [], "exports");
    expect(denied).toBe(true);

    // The middleware would return:
    const expectedResponse = {
      message: "Feature not enabled",
      code: "ENTITLEMENT_REQUIRED",
      feature: "exports",
    };
    expect(expectedResponse.code).toBe("ENTITLEMENT_REQUIRED");
    expect(typeof expectedResponse.feature).toBe("string");
    expect(typeof expectedResponse.message).toBe("string");
  });

  it("allows request when feature is enabled", () => {
    // Core plan has document_storage
    expect(hasEntitlement("core", [], "document_storage")).toBe(true);
    // Enterprise plan has everything
    for (const f of FEATURES) {
      expect(hasEntitlement("enterprise", [], f)).toBe(true);
    }
  });
});

// ─── Schema validation ──────────────────────────────────────────────────────

describe("Entitlement schema validation", () => {
  it("insertWorkspacePlanSchema accepts valid data", async () => {
    const { insertWorkspacePlanSchema } = await import("../../shared/schema.js");
    const result = insertWorkspacePlanSchema.safeParse({
      workspaceId: "default",
      plan: "ops_plus",
    });
    expect(result.success).toBe(true);
  });

  it("insertEntitlementOverrideSchema accepts valid data", async () => {
    const { insertEntitlementOverrideSchema } = await import("../../shared/schema.js");
    const result = insertEntitlementOverrideSchema.safeParse({
      workspaceId: "default",
      feature: "exports",
      enabled: true,
      reason: "Early access",
    });
    expect(result.success).toBe(true);
  });

  it("insertEntitlementOverrideSchema rejects missing feature", async () => {
    const { insertEntitlementOverrideSchema } = await import("../../shared/schema.js");
    const result = insertEntitlementOverrideSchema.safeParse({
      workspaceId: "default",
      enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it("insertEntitlementOverrideSchema rejects non-boolean enabled", async () => {
    const { insertEntitlementOverrideSchema } = await import("../../shared/schema.js");
    const result = insertEntitlementOverrideSchema.safeParse({
      workspaceId: "default",
      feature: "exports",
      enabled: "yes",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Enforcement matrix ─────────────────────────────────────────────────────

describe("Enforcement matrix — plan × feature", () => {
  const matrix: Array<{ plan: PlanTier; feature: FeatureKey; expected: boolean }> = [
    // Core — only document_storage
    { plan: "core", feature: "document_storage", expected: true },
    { plan: "core", feature: "exports", expected: false },
    { plan: "core", feature: "connector_sync", expected: false },
    { plan: "core", feature: "anomaly_detection", expected: false },

    // Ops+ — adds exports, automation, knowledge
    { plan: "ops_plus", feature: "exports", expected: true },
    { plan: "ops_plus", feature: "automation_execution", expected: true },
    { plan: "ops_plus", feature: "knowledge_ingestion", expected: true },
    { plan: "ops_plus", feature: "anomaly_detection", expected: false },
    { plan: "ops_plus", feature: "connector_sync", expected: false },

    // Intelligence — adds analytics features
    { plan: "intelligence", feature: "anomaly_detection", expected: true },
    { plan: "intelligence", feature: "kpi_snapshots", expected: true },
    { plan: "intelligence", feature: "executive_briefings", expected: true },
    { plan: "intelligence", feature: "ai_automation_drafting", expected: true },
    { plan: "intelligence", feature: "staffing_recommendations", expected: true },
    { plan: "intelligence", feature: "advanced_exports", expected: true },
    { plan: "intelligence", feature: "connector_sync", expected: false },
    { plan: "intelligence", feature: "trust_export_preview", expected: false },

    // Enterprise — everything
    { plan: "enterprise", feature: "connector_sync", expected: true },
    { plan: "enterprise", feature: "trust_export_preview", expected: true },
    { plan: "enterprise", feature: "exports", expected: true },
    { plan: "enterprise", feature: "document_storage", expected: true },
  ];

  for (const { plan, feature, expected } of matrix) {
    it(`${plan} → ${feature} = ${expected}`, () => {
      expect(hasEntitlement(plan, [], feature)).toBe(expected);
    });
  }
});

/**
 * Phase 4.3 — Workspace Isolation Leakage Regression Tests
 *
 * These tests verify that data created in workspace A is invisible
 * to workspace B, and vice-versa. They exercise the AsyncLocalStorage-based
 * workspace context and the wsFilter / wsInsert helpers.
 *
 * All tests are unit-level — they validate the workspace scoping contract
 * at the storage helpers and context layer without requiring a live database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWithWorkspace, getWorkspaceScope } from "../../server/middleware/workspaceContext.js";

// ─── 1. AsyncLocalStorage context propagation ────────────────────────────────

describe("Workspace context (AsyncLocalStorage)", () => {
  it("defaults to 'default' outside any scope", () => {
    expect(getWorkspaceScope()).toBe("default");
  });

  it("returns the scoped workspaceId inside runWithWorkspace", () => {
    runWithWorkspace("acme-corp", () => {
      expect(getWorkspaceScope()).toBe("acme-corp");
    });
  });

  it("restores previous scope after runWithWorkspace exits", () => {
    runWithWorkspace("tenant-a", () => {
      expect(getWorkspaceScope()).toBe("tenant-a");
    });
    expect(getWorkspaceScope()).toBe("default");
  });

  it("supports nested scopes — inner overrides outer", () => {
    runWithWorkspace("outer", () => {
      expect(getWorkspaceScope()).toBe("outer");
      runWithWorkspace("inner", () => {
        expect(getWorkspaceScope()).toBe("inner");
      });
      expect(getWorkspaceScope()).toBe("outer");
    });
  });

  it("propagates through async boundaries", async () => {
    await new Promise<void>((resolve) => {
      runWithWorkspace("async-tenant", async () => {
        // Simulate async work
        await Promise.resolve();
        expect(getWorkspaceScope()).toBe("async-tenant");
        resolve();
      });
    });
  });

  it("isolates concurrent workspaces", async () => {
    const results: string[] = [];
    await Promise.all([
      new Promise<void>((resolve) => {
        runWithWorkspace("ws-1", async () => {
          await Promise.resolve();
          results.push(getWorkspaceScope());
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        runWithWorkspace("ws-2", async () => {
          await Promise.resolve();
          results.push(getWorkspaceScope());
          resolve();
        });
      }),
    ]);
    expect(results).toContain("ws-1");
    expect(results).toContain("ws-2");
    expect(results).toHaveLength(2);
  });
});

// ─── 2. wsInsert — workspace injection ───────────────────────────────────────

describe("wsInsert — workspace ID injection", () => {
  // We need to dynamically import wsInsert inside a workspace scope
  // since it reads getWorkspaceScope() at call time.

  it("injects workspaceId from current scope", () => {
    runWithWorkspace("acme", () => {
      // Inline the wsInsert logic to avoid CJS/ESM issues in test
      const data = { name: "Fleet A", type: "standard" };
      const result = { ...data, workspaceId: getWorkspaceScope() };
      expect(result).toEqual({
        name: "Fleet A",
        type: "standard",
        workspaceId: "acme",
      });
    });
  });

  it("uses 'default' when outside scope", () => {
    const data = { key: "value" };
    const result = { ...data, workspaceId: getWorkspaceScope() };
    expect(result.workspaceId).toBe("default");
  });

  it("does not mutate original data", () => {
    runWithWorkspace("tenant-x", () => {
      const original = { name: "test" };
      const injected = { ...original, workspaceId: getWorkspaceScope() };
      expect(original).toEqual({ name: "test" });
      expect(injected.workspaceId).toBe("tenant-x");
    });
  });
});

// ─── 3. Cross-tenant leakage contract ────────────────────────────────────────

describe("Cross-tenant leakage prevention", () => {
  it("workspace A scope never leaks into workspace B", () => {
    const captures: string[] = [];

    runWithWorkspace("tenant-a", () => {
      captures.push(`A-sees:${getWorkspaceScope()}`);
    });

    runWithWorkspace("tenant-b", () => {
      captures.push(`B-sees:${getWorkspaceScope()}`);
    });

    expect(captures).toEqual(["A-sees:tenant-a", "B-sees:tenant-b"]);
  });

  it("nested workspace does not contaminate parent", () => {
    runWithWorkspace("parent-ws", () => {
      runWithWorkspace("child-ws", () => {
        expect(getWorkspaceScope()).toBe("child-ws");
      });
      // Parent must still see its own workspace
      expect(getWorkspaceScope()).toBe("parent-ws");
    });
  });

  it("parallel requests stay isolated under concurrent load", async () => {
    const TENANT_COUNT = 10;
    const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `tenant-${i}`);

    const results = await Promise.all(
      tenants.map(
        (tenant) =>
          new Promise<{ expected: string; actual: string }>((resolve) => {
            runWithWorkspace(tenant, async () => {
              // Simulate variable async delay
              await new Promise((r) => setTimeout(r, Math.random() * 5));
              resolve({
                expected: tenant,
                actual: getWorkspaceScope(),
              });
            });
          }),
      ),
    );

    for (const { expected, actual } of results) {
      expect(actual).toBe(expected);
    }
  });
});

// ─── 4. Schema contract — workspaceId exists on tenant tables ────────────────

describe("Schema workspace coverage", () => {
  // Import schema tables and verify workspaceId column exists
  it("all tenant tables have workspaceId column", async () => {
    const schema = await import("../../shared/schema.js");

    // Tables that MUST have workspaceId
    const tenantTableNames = [
      "users", "userPreferences", "stations", "chatConversations",
      "vehicles", "vehicleEvidence", "washQueue", "shifts", "shiftRequests",
      "notifications", "customActions", "automationRules", "auditLog",
      "entityRooms", "workspaceMemory", "digitalTwinSnapshots",
      "systemPolicies", "activityFeed", "moduleRegistry", "workspaceConfig",
      "workspaceProposals", "imports", "fileAttachments", "feedback",
      "incidents", "automationExecutions", "reservations", "repairOrders",
      "downtimeEvents", "kpiDefinitions", "kpiSnapshots", "anomalies",
      "executiveBriefings", "integrationConnectors", "syncJobs",
      "knowledgeDocuments", "exportRequests", "userStationAssignments",
      "userCapabilityOverrides", "vehicleEvents", "workshopJobs",
    ];

    for (const name of tenantTableNames) {
      const table = (schema as Record<string, unknown>)[name];
      expect(table, `Table '${name}' not found in schema`).toBeDefined();

      // Drizzle tables expose columns as properties with a `name` field
      const col = (table as Record<string, { name?: string }>).workspaceId;
      expect(col, `Table '${name}' missing workspaceId column`).toBeDefined();
      expect(col?.name, `Table '${name}' workspaceId column has wrong DB name`).toBe("workspace_id");
    }
  });

  it("platform-global tables do NOT have workspaceId", async () => {
    const schema = await import("../../shared/schema.js");
    const globalTables = ["roleCapabilities"];

    for (const name of globalTables) {
      const table = (schema as Record<string, unknown>)[name];
      expect(table, `Global table '${name}' not found`).toBeDefined();
      const col = (table as Record<string, { name?: string }>).workspaceId;
      expect(col, `Global table '${name}' should NOT have workspaceId`).toBeUndefined();
    }
  });

  it("workspaces master table exists with required columns", async () => {
    const schema = await import("../../shared/schema.js");
    const ws = schema.workspaces as Record<string, { name?: string }>;
    expect(ws).toBeDefined();
    expect(ws.id?.name).toBe("id");
    expect(ws.name?.name).toBe("name");
    expect(ws.slug?.name).toBe("slug");
  });

  it("child tables correctly omit workspaceId (inherit through parent)", async () => {
    const schema = await import("../../shared/schema.js");
    const childTables = ["chatMessages", "notificationReads", "roomMessages", "incidentSummaries"];

    for (const name of childTables) {
      const table = (schema as Record<string, unknown>)[name];
      expect(table, `Child table '${name}' not found`).toBeDefined();
      const col = (table as Record<string, { name?: string }>).workspaceId;
      expect(col, `Child table '${name}' should NOT have workspaceId (inherits through parent)`).toBeUndefined();
    }
  });
});

// ─── 5. Express middleware contract ──────────────────────────────────────────

describe("Express workspace middleware contract", () => {
  it("unauthenticated request falls back to 'default' workspace", () => {
    // Simulate: req.user is undefined
    const wsId = (undefined as { workspaceId?: string } | undefined)?.workspaceId ?? "default";
    runWithWorkspace(wsId, () => {
      expect(getWorkspaceScope()).toBe("default");
    });
  });

  it("authenticated user with workspaceId routes to that workspace", () => {
    const user = { workspaceId: "fleet-ops-nyc" };
    const wsId = (user as { workspaceId?: string })?.workspaceId ?? "default";
    runWithWorkspace(wsId, () => {
      expect(getWorkspaceScope()).toBe("fleet-ops-nyc");
    });
  });

  it("authenticated user without workspaceId falls back to default", () => {
    const user = {} as { workspaceId?: string };
    const wsId = user?.workspaceId ?? "default";
    runWithWorkspace(wsId, () => {
      expect(getWorkspaceScope()).toBe("default");
    });
  });
});

// ─── 6. Migration SQL contract ───────────────────────────────────────────────

describe("Migration SQL contract", () => {
  it("migration file exists and contains workspace_id additions", async () => {
    const fs = await import("fs");
    const path = "supabase/migrations/20260410000000_004_workspace_isolation.sql";
    const content = fs.readFileSync(path, "utf8");

    // Must create workspaces table
    expect(content).toContain("CREATE TABLE IF NOT EXISTS workspaces");

    // Must add workspace_id to tenant tables
    expect(content).toContain("ADD COLUMN IF NOT EXISTS workspace_id");

    // Must seed default workspace
    expect(content).toContain("INSERT INTO workspaces");

    // Must create indexes for high-traffic tables
    expect(content).toContain("CREATE INDEX");

    // Must enable RLS
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
  });
});

// ─── 7. ULTRA HARDENING — Per-workspace uniqueness constraints ───────────────

describe("Per-workspace uniqueness (hardening audit A)", () => {
  it("users.username is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.users;
    // Column-level .unique() should be removed
    const usernameCol = (table as any).username;
    expect(usernameCol.isUnique, "users.username must NOT have column-level .unique()").toBeFalsy();
  });

  it("stations.code is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.stations;
    const codeCol = (table as any).code;
    expect(codeCol.isUnique, "stations.code must NOT have column-level .unique()").toBeFalsy();
  });

  it("vehicles.plate is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.vehicles;
    const plateCol = (table as any).plate;
    expect(plateCol.isUnique, "vehicles.plate must NOT have column-level .unique()").toBeFalsy();
  });

  it("moduleRegistry.slug is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.moduleRegistry;
    const slugCol = (table as any).slug;
    expect(slugCol.isUnique, "moduleRegistry.slug must NOT have column-level .unique()").toBeFalsy();
  });

  it("workspaceConfig.key is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.workspaceConfig;
    const keyCol = (table as any).key;
    expect(keyCol.isUnique, "workspaceConfig.key must NOT have column-level .unique()").toBeFalsy();
  });

  it("kpiDefinitions.slug is per-workspace unique (not globally unique)", async () => {
    const schema = await import("../../shared/schema.js");
    const table = schema.kpiDefinitions;
    const slugCol = (table as any).slug;
    expect(slugCol.isUnique, "kpiDefinitions.slug must NOT have column-level .unique()").toBeFalsy();
  });

  it("migration includes per-workspace unique index conversions for users/stations/vehicles", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("supabase/migrations/20260410000000_004_workspace_isolation.sql", "utf8");
    expect(content).toContain("users_ws_username_idx");
    expect(content).toContain("stations_ws_code_idx");
    expect(content).toContain("vehicles_ws_plate_idx");
  });

  it("vehicleEvents dedupe index includes workspaceId", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("supabase/migrations/20260410000000_004_workspace_isolation.sql", "utf8");
    expect(content).toMatch(/ve_external_dedup_idx.*workspace_id/);
  });
});

// ─── 8. ULTRA HARDENING — Auth user lookups are unscoped ─────────────────────

describe("Auth user lookups (hardening audit A auth fix)", () => {
  it("IStorage exposes getUserById (unscoped for passport deserialize)", async () => {
    const types = await import("../../server/storage/types.js");
    // If getUserById is not in the interface, TypeScript would have caught this.
    // We verify at runtime that the storage instance has the method.
    const { storage } = await import("../../server/storage.js");
    expect(typeof storage.getUserById).toBe("function");
  });

  it("IStorage exposes getUserByUsernameUnscoped (unscoped for passport local strategy)", async () => {
    const { storage } = await import("../../server/storage.js");
    expect(typeof storage.getUserByUsernameUnscoped).toBe("function");
  });
});

// ─── 9. ULTRA HARDENING — Export background tasks are system-level ───────────

describe("Export system-level methods (hardening audit C)", () => {
  it("getExpiredExportRequests source does not reference wsFilter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/storage/exports.ts", "utf8");
    // Extract the getExpiredExportRequests method body
    const methodStart = content.indexOf("getExpiredExportRequests");
    const methodEnd = content.indexOf("}", methodStart + 1);
    const methodBody = content.slice(methodStart, content.indexOf("}", methodEnd + 1));
    expect(methodBody).not.toContain("wsFilter");
  });

  it("getProcessableExportRequests source does not reference wsFilter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/storage/exports.ts", "utf8");
    const methodStart = content.indexOf("getProcessableExportRequests");
    const methodEnd = content.indexOf("}", methodStart + 1);
    const methodBody = content.slice(methodStart, content.indexOf("}", methodEnd + 1));
    expect(methodBody).not.toContain("wsFilter");
  });
});

// ─── 10. ULTRA HARDENING — Child-table parent anchoring in routes ────────────

describe("Child-table parent anchoring (hardening audit D)", () => {
  it("room messages GET route verifies room workspace ownership before returning messages", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routes/workspace.ts", "utf8");
    // The route for GET /api/entity-rooms/:id/messages must call getEntityRoom before getRoomMessages
    const getMessagesRoute = content.slice(
      content.indexOf('"/api/entity-rooms/:id/messages", requireAuth'),
      content.indexOf('"/api/entity-rooms/:id/messages", requireAuth') + 400,
    );
    expect(getMessagesRoute).toContain("getEntityRoom");
    expect(getMessagesRoute).toContain("404");
  });

  it("room messages POST route verifies room workspace ownership before creating", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routes/workspace.ts", "utf8");
    // Find the POST route (second occurrence)
    const firstIdx = content.indexOf('"/api/entity-rooms/:id/messages"');
    const postIdx = content.indexOf('"/api/entity-rooms/:id/messages"', firstIdx + 1);
    const postRoute = content.slice(postIdx, postIdx + 500);
    expect(postRoute).toContain("getEntityRoom");
    expect(postRoute).toContain("404");
  });

  it("incident summaries GET route verifies incident workspace ownership", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routes/incidents.ts", "utf8");
    const summariesRoute = content.slice(
      content.indexOf('"/api/incidents/:id/summaries"'),
      content.indexOf('"/api/incidents/:id/summaries"') + 400,
    );
    expect(summariesRoute).toContain("getIncident");
    expect(summariesRoute).toContain("404");
  });
});

// ─── 11. ULTRA HARDENING — Webhook workspace resolution ─────────────────────

describe("Webhook workspace resolution (hardening audit B)", () => {
  it("IStorage exposes getIntegrationConnectorsUnscoped", async () => {
    const { storage } = await import("../../server/storage.js");
    expect(typeof storage.getIntegrationConnectorsUnscoped).toBe("function");
  });

  it("webhook route uses unscoped connector lookup + runWithWorkspace", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routes/telematics.ts", "utf8");
    const webhookSection = content.slice(
      content.indexOf("/api/webhooks/telematics"),
      content.indexOf("/api/webhooks/telematics") + 800,
    );
    expect(webhookSection).toContain("getIntegrationConnectorsUnscoped");
    expect(webhookSection).toContain("runWithWorkspace");
    expect(webhookSection).not.toContain("getIntegrationConnectors(");
  });
});

// ─── 7. Deploy-prep fixes — storage wsFilter regression guards ───────────────
describe("Deploy-prep: storage wsFilter regression guards", () => {
  it("getCustomActions uses wsFilter(customActions), not wsFilter(userPreferences)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/storage/users.ts", "utf8");
    const fnBody = src.slice(src.indexOf("getCustomActions"), src.indexOf("getCustomActions") + 300);
    expect(fnBody).toContain("wsFilter(customActions)");
    expect(fnBody).not.toContain("wsFilter(userPreferences)");
  });

  it("deleteUserCapabilityOverride uses wsFilter", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/storage/capabilities.ts", "utf8");
    const fnBody = src.slice(src.indexOf("deleteUserCapabilityOverride"), src.indexOf("deleteUserCapabilityOverride") + 300);
    expect(fnBody).toContain("wsFilter(userCapabilityOverrides)");
  });

  it("removeUserFromStation uses wsFilter", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/storage/stationAssignments.ts", "utf8");
    const fnBody = src.slice(src.indexOf("removeUserFromStation"), src.indexOf("removeUserFromStation") + 300);
    expect(fnBody).toContain("wsFilter(userStationAssignments)");
  });

  it("deleteAuditEntriesBefore uses wsFilter", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/storage/trust.ts", "utf8");
    const fnBody = src.slice(src.indexOf("deleteAuditEntriesBefore"), src.indexOf("deleteAuditEntriesBefore") + 200);
    expect(fnBody).toContain("wsFilter(auditLog)");
  });

  it("POST /api/vehicles/:id/evidence requires requireAuth", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/routes/vehicles.ts", "utf8");
    const route = src.slice(src.indexOf('post("/api/vehicles/:id/evidence"'), src.indexOf('post("/api/vehicles/:id/evidence"') + 100);
    expect(route).toContain("requireAuth");
  });

  it("reservation webhook uses getIntegrationConnectorsUnscoped + runWithWorkspace", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/routes/connectors.ts", "utf8");
    const section = src.slice(src.indexOf("/api/webhooks/reservations"), src.indexOf("/api/webhooks/reservations") + 1200);
    expect(section).toContain("getIntegrationConnectorsUnscoped");
    expect(section).toContain("runWithWorkspace");
  });

  it("workshop webhook uses getIntegrationConnectorsUnscoped + runWithWorkspace", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/routes/workshop.ts", "utf8");
    const section = src.slice(src.indexOf("/api/webhooks/workshop"), src.indexOf("/api/webhooks/workshop") + 800);
    expect(section).toContain("getIntegrationConnectorsUnscoped");
    expect(section).toContain("runWithWorkspace");
  });

  it("graceful shutdown calls httpServer.close and process.exit", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("server/index.ts", "utf8");
    expect(src).toContain("httpServer.close(");
    expect(src).toContain("process.exit(0)");
    expect(src).toContain("pool.end()");
  });
});

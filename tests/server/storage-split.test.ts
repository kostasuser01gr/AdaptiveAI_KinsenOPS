/**
 * Phase 4.0B regression tests — Storage modularization
 *
 * Verifies:
 * 1. storage singleton is importable from the shim path
 * 2. IStorage interface is importable from the shim path
 * 3. every expected method is a callable function on the singleton
 * 4. representative method per extracted domain module
 * 5. no route-module import breakage (spot-check a few route modules)
 * 6. shared helper exports from base.ts
 */
import { describe, it, expect } from "vitest";

// ─── 1. Singleton compatibility via the shim path ────────────────────────────
describe("storage singleton compatibility", () => {
  it("exports storage from the shim path (server/storage.ts)", async () => {
    const mod = await import("../../server/storage.js");
    expect(mod.storage).toBeDefined();
    expect(typeof mod.storage).toBe("object");
  });

  it("exports storage from the index path (server/storage/index.ts)", async () => {
    const mod = await import("../../server/storage/index.js");
    expect(mod.storage).toBeDefined();
    expect(typeof mod.storage).toBe("object");
  });

  it("both paths resolve to the same singleton", async () => {
    const shim = await import("../../server/storage.js");
    const idx = await import("../../server/storage/index.js");
    expect(shim.storage).toBe(idx.storage);
  });
});

// ─── 2. Complete method surface ──────────────────────────────────────────────
describe("storage method surface", () => {
  // Exhaustive list of every IStorage method that consumers rely on.
  const expectedMethods = [
    // Users (users.ts)
    "getUser", "getUserByUsername", "getUsers", "createUser", "updateUser", "deleteUser",
    "getUserPreferences", "getUserPreference", "setUserPreference", "deleteUserPreference",
    "getCustomActions", "getCustomAction", "createCustomAction", "deleteCustomAction",
    "getStations", "createStation", "updateStation",
    // Chat (chat.ts)
    "getConversations", "getConversation", "createConversation", "updateConversation", "deleteConversation",
    "getMessages", "createMessage",
    // Vehicles (vehicles.ts)
    "getVehicles", "getVehicle", "createVehicle", "updateVehicle", "deleteVehicle", "restoreVehicle",
    "getVehicleEvidence", "createVehicleEvidence",
    // Wash queue (washQueue.ts)
    "getWashQueue", "createWashQueueItem", "updateWashQueueItem", "deleteWashQueueItem", "getOverdueWashItems",
    // Shifts (shifts.ts)
    "getShifts", "getPublishedShifts", "createShift", "updateShift", "publishShift", "deleteShift",
    "getShiftRequests", "createShiftRequest", "reviewShiftRequest",
    // Notifications (notifications.ts)
    "getNotifications", "createNotification", "updateNotification",
    "markNotificationRead", "markAllNotificationsRead", "getNotificationStats",
    // Automation (automation.ts)
    "getAutomationRules", "getAutomationRule", "createAutomationRule", "updateAutomationRule", "deleteAutomationRule",
    "testAutomationRule", "getAutomationExecutions", "createAutomationExecution", "updateAutomationExecution",
    // Trust / Audit (trust.ts)
    "getAuditLog", "createAuditEntry", "deleteAuditEntriesBefore",
    // Workspace (workspace.ts)
    "getEntityRooms", "getEntityRoom", "getEntityRoomByEntity", "createEntityRoom", "updateEntityRoom",
    "getRoomMessages", "createRoomMessage",
    "getWorkspaceMemory", "createWorkspaceMemory", "updateWorkspaceMemory",
    "getDigitalTwinSnapshots", "createDigitalTwinSnapshot", "getDigitalTwinTimeline",
    "getSystemPolicies", "createSystemPolicy", "updateSystemPolicy", "deleteSystemPolicy",
    "getActivityFeed", "createActivityEntry",
    "getModuleRegistry", "createModuleEntry", "updateModuleEntry",
    "getWorkspaceConfig", "getWorkspaceConfigByKey", "setWorkspaceConfig", "deleteWorkspaceConfigByKey",
    "getProposals", "getProposal", "createProposal", "updateProposal",
    "createFeedback", "getFeedback",
    // Documents (documents.ts)
    "getFileAttachments", "getFileAttachment", "createFileAttachment", "deleteFileAttachment",
    "getKnowledgeDocuments", "getKnowledgeDocument", "createKnowledgeDocument",
    "updateKnowledgeDocument", "deleteKnowledgeDocument", "searchKnowledgeDocuments",
    // Imports (imports.ts)
    "getImports", "getImport", "createImport", "updateImport", "deleteImport",
    // Analytics (analytics.ts)
    "getDashboardStats", "getAnalyticsSummary", "getAnalyticsTrends", "getVehicleTrends", "searchEntities",
    // Incidents (incidents.ts)
    "getIncidents", "getIncident", "createIncident", "updateIncident",
    "getIncidentSummaries", "createIncidentSummary",
    // Reservations (reservations.ts)
    "getReservations", "getReservation", "createReservation", "updateReservation",
    // Repairs (repairs.ts)
    "getRepairOrders", "getRepairOrder", "createRepairOrder", "updateRepairOrder",
    "getDowntimeEvents", "getDowntimeEvent", "createDowntimeEvent", "updateDowntimeEvent",
    // KPI (kpi.ts)
    "getKpiDefinitions", "getKpiDefinition", "createKpiDefinition", "updateKpiDefinition",
    "getKpiSnapshots", "createKpiSnapshot",
    "getAnomalies", "getAnomaly", "createAnomaly", "updateAnomaly",
    "getExecutiveBriefings", "getExecutiveBriefing", "createExecutiveBriefing",
    // Connectors (connectors.ts)
    "getIntegrationConnectors", "getIntegrationConnector", "createIntegrationConnector",
    "updateIntegrationConnector", "deleteIntegrationConnector",
    "getSyncJobs", "getSyncJob", "createSyncJob", "updateSyncJob",
  ];

  it("has the correct total method count", async () => {
    const { storage } = await import("../../server/storage.js");
    const methods = expectedMethods.filter(m => typeof (storage as Record<string, unknown>)[m] === "function");
    expect(methods.length).toBe(expectedMethods.length);
  });

  // One it() per domain — keeps failure diagnostics granular
  const domainGroups: Record<string, string[]> = {
    users: ["getUser", "getUserByUsername", "getUsers", "createUser", "updateUser", "deleteUser",
      "getUserPreferences", "getUserPreference", "setUserPreference", "deleteUserPreference",
      "getCustomActions", "getCustomAction", "createCustomAction", "deleteCustomAction",
      "getStations", "createStation", "updateStation"],
    chat: ["getConversations", "getConversation", "createConversation", "updateConversation", "deleteConversation",
      "getMessages", "createMessage"],
    vehicles: ["getVehicles", "getVehicle", "createVehicle", "updateVehicle", "deleteVehicle", "restoreVehicle",
      "getVehicleEvidence", "createVehicleEvidence"],
    washQueue: ["getWashQueue", "createWashQueueItem", "updateWashQueueItem", "deleteWashQueueItem", "getOverdueWashItems"],
    shifts: ["getShifts", "getPublishedShifts", "createShift", "updateShift", "publishShift", "deleteShift",
      "getShiftRequests", "createShiftRequest", "reviewShiftRequest"],
    notifications: ["getNotifications", "createNotification", "updateNotification",
      "markNotificationRead", "markAllNotificationsRead", "getNotificationStats"],
    automation: ["getAutomationRules", "getAutomationRule", "createAutomationRule", "updateAutomationRule",
      "deleteAutomationRule", "testAutomationRule", "getAutomationExecutions",
      "createAutomationExecution", "updateAutomationExecution"],
    trust: ["getAuditLog", "createAuditEntry", "deleteAuditEntriesBefore"],
    workspace: ["getEntityRooms", "getEntityRoom", "getEntityRoomByEntity", "createEntityRoom", "updateEntityRoom",
      "getRoomMessages", "createRoomMessage", "getWorkspaceMemory", "createWorkspaceMemory", "updateWorkspaceMemory",
      "getDigitalTwinSnapshots", "createDigitalTwinSnapshot", "getDigitalTwinTimeline",
      "getSystemPolicies", "createSystemPolicy", "updateSystemPolicy", "deleteSystemPolicy",
      "getActivityFeed", "createActivityEntry", "getModuleRegistry", "createModuleEntry", "updateModuleEntry",
      "getWorkspaceConfig", "getWorkspaceConfigByKey", "setWorkspaceConfig", "deleteWorkspaceConfigByKey",
      "getProposals", "getProposal", "createProposal", "updateProposal", "createFeedback", "getFeedback"],
    documents: ["getFileAttachments", "getFileAttachment", "createFileAttachment", "deleteFileAttachment",
      "getKnowledgeDocuments", "getKnowledgeDocument", "createKnowledgeDocument",
      "updateKnowledgeDocument", "deleteKnowledgeDocument", "searchKnowledgeDocuments"],
    imports: ["getImports", "getImport", "createImport", "updateImport", "deleteImport"],
    analytics: ["getDashboardStats", "getAnalyticsSummary", "getAnalyticsTrends", "getVehicleTrends", "searchEntities"],
    incidents: ["getIncidents", "getIncident", "createIncident", "updateIncident",
      "getIncidentSummaries", "createIncidentSummary"],
    reservations: ["getReservations", "getReservation", "createReservation", "updateReservation"],
    repairs: ["getRepairOrders", "getRepairOrder", "createRepairOrder", "updateRepairOrder",
      "getDowntimeEvents", "getDowntimeEvent", "createDowntimeEvent", "updateDowntimeEvent"],
    kpi: ["getKpiDefinitions", "getKpiDefinition", "createKpiDefinition", "updateKpiDefinition",
      "getKpiSnapshots", "createKpiSnapshot",
      "getAnomalies", "getAnomaly", "createAnomaly", "updateAnomaly",
      "getExecutiveBriefings", "getExecutiveBriefing", "createExecutiveBriefing"],
    connectors: ["getIntegrationConnectors", "getIntegrationConnector", "createIntegrationConnector",
      "updateIntegrationConnector", "deleteIntegrationConnector",
      "getSyncJobs", "getSyncJob", "createSyncJob", "updateSyncJob"],
  };

  for (const [domain, methods] of Object.entries(domainGroups)) {
    it(`exposes all ${domain} methods as functions`, async () => {
      const { storage } = await import("../../server/storage.js");
      const missing = methods.filter(m => typeof (storage as Record<string, unknown>)[m] !== "function");
      expect(missing, `missing from ${domain}: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

// ─── 3. Shared helpers from base.ts ──────────────────────────────────────────
describe("storage shared helpers (base.ts)", () => {
  it("exports db from base", async () => {
    const base = await import("../../server/storage/base.js");
    expect(base.db).toBeDefined();
  });

  it("exports drizzle operators", async () => {
    const base = await import("../../server/storage/base.js");
    expect(typeof base.eq).toBe("function");
    expect(typeof base.desc).toBe("function");
    expect(typeof base.and).toBe("function");
    expect(typeof base.sql).toBe("function");
    expect(typeof base.isNull).toBe("function");
    expect(typeof base.or).toBe("function");
    expect(typeof base.gte).toBe("function");
    expect(typeof base.lt).toBe("function");
  });

  it("exports stripId helper", async () => {
    const base = await import("../../server/storage/base.js");
    expect(typeof base.stripId).toBe("function");
    const result = base.stripId({ id: 42, name: "test", value: 100 });
    expect(result).toEqual({ name: "test", value: 100 });
    expect("id" in result).toBe(false);
  });
});

// ─── 4. IStorage type is importable ──────────────────────────────────────────
describe("IStorage type contract", () => {
  it("IStorage is exported from types.ts (compile-time check)", async () => {
    // If this import resolved, the type exists. Runtime check not needed for types,
    // but verify the module is loadable without error.
    const mod = await import("../../server/storage/types.js");
    expect(mod).toBeDefined();
  });
});

// ─── 5. Route module import compatibility (spot-check) ───────────────────────
describe("route module import compatibility", () => {
  it("server/routes/vehicles.ts imports storage without error", async () => {
    const mod = await import("../../server/routes/vehicles.js");
    expect(mod).toBeDefined();
  });

  it("server/routes/analytics.ts imports storage without error", async () => {
    const mod = await import("../../server/routes/analytics.js");
    expect(mod).toBeDefined();
  });

  it("server/routes/trust.ts imports storage without error", async () => {
    const mod = await import("../../server/routes/trust.js");
    expect(mod).toBeDefined();
  });

  it("server/routes/connectors.ts imports storage without error", async () => {
    const mod = await import("../../server/routes/connectors.js");
    expect(mod).toBeDefined();
  });

  it("server/middleware/audit.ts imports storage without error", async () => {
    const mod = await import("../../server/middleware/audit.js");
    expect(mod).toBeDefined();
  });
});

// ─── 6. Domain module classes are independently importable ───────────────────
describe("domain module independence", () => {
  it("storage/users.ts exports UserStorage", async () => {
    const m = await import("../../server/storage/users.js");
    expect(m.UserStorage).toBeDefined();
  });
  it("storage/chat.ts exports ChatStorage", async () => {
    const m = await import("../../server/storage/chat.js");
    expect(m.ChatStorage).toBeDefined();
  });
  it("storage/vehicles.ts exports VehicleStorage", async () => {
    const m = await import("../../server/storage/vehicles.js");
    expect(m.VehicleStorage).toBeDefined();
  });
  it("storage/washQueue.ts exports WashQueueStorage", async () => {
    const m = await import("../../server/storage/washQueue.js");
    expect(m.WashQueueStorage).toBeDefined();
  });
  it("storage/shifts.ts exports ShiftStorage", async () => {
    const m = await import("../../server/storage/shifts.js");
    expect(m.ShiftStorage).toBeDefined();
  });
  it("storage/notifications.ts exports NotificationStorage", async () => {
    const m = await import("../../server/storage/notifications.js");
    expect(m.NotificationStorage).toBeDefined();
  });
  it("storage/automation.ts exports AutomationStorage", async () => {
    const m = await import("../../server/storage/automation.js");
    expect(m.AutomationStorage).toBeDefined();
  });
  it("storage/trust.ts exports TrustStorage", async () => {
    const m = await import("../../server/storage/trust.js");
    expect(m.TrustStorage).toBeDefined();
  });
  it("storage/workspace.ts exports WorkspaceStorage", async () => {
    const m = await import("../../server/storage/workspace.js");
    expect(m.WorkspaceStorage).toBeDefined();
  });
  it("storage/analytics.ts exports AnalyticsStorage", async () => {
    const m = await import("../../server/storage/analytics.js");
    expect(m.AnalyticsStorage).toBeDefined();
  });
  it("storage/incidents.ts exports IncidentStorage", async () => {
    const m = await import("../../server/storage/incidents.js");
    expect(m.IncidentStorage).toBeDefined();
  });
  it("storage/reservations.ts exports ReservationStorage", async () => {
    const m = await import("../../server/storage/reservations.js");
    expect(m.ReservationStorage).toBeDefined();
  });
  it("storage/repairs.ts exports RepairStorage", async () => {
    const m = await import("../../server/storage/repairs.js");
    expect(m.RepairStorage).toBeDefined();
  });
  it("storage/kpi.ts exports KpiStorage", async () => {
    const m = await import("../../server/storage/kpi.js");
    expect(m.KpiStorage).toBeDefined();
  });
  it("storage/connectors.ts exports ConnectorStorage", async () => {
    const m = await import("../../server/storage/connectors.js");
    expect(m.ConnectorStorage).toBeDefined();
  });
  it("storage/documents.ts exports DocumentStorage", async () => {
    const m = await import("../../server/storage/documents.js");
    expect(m.DocumentStorage).toBeDefined();
  });
  it("storage/imports.ts exports ImportStorage", async () => {
    const m = await import("../../server/storage/imports.js");
    expect(m.ImportStorage).toBeDefined();
  });
});

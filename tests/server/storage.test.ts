/**
 * Storage-layer integration tests.
 *
 * These require a real PostgreSQL database (DATABASE_URL env var).
 * Tests are auto-skipped when no DATABASE_URL is set (CI without DB).
 *
 * Each test suite runs inside the "default" workspace scope and cleans up after itself.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

// Dynamic imports to avoid pulling DB deps when skipping
let storage: any;
let pool: any;
let runWithWorkspace: any;

describe.skipIf(!hasDb)("Storage Integration Tests", () => {
  beforeAll(async () => {
    const storageModule = await import("../../server/storage.js");
    storage = storageModule.storage;
    const dbModule = await import("../../server/db.js");
    pool = dbModule.pool;
    const wsModule = await import("../../server/middleware/workspaceContext.js");
    runWithWorkspace = wsModule.runWithWorkspace;
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  // Helper to run a callback in "default" workspace scope
  function inWorkspace<T>(fn: () => Promise<T>): Promise<T> {
    return runWithWorkspace("default", fn);
  }

  // ── Users ──────────────────────────────────────────────────
  describe("Users", () => {
    let userId: number;
    const testUsername = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    it("creates a user and returns it with an id", async () => {
      const user = await inWorkspace(() =>
        storage.createUser({
          username: testUsername,
          password: "hashed_placeholder",
          displayName: "Test User",
          role: "agent",
          language: "en",
          theme: "dark",
        }),
      );
      expect(user).toBeDefined();
      expect(user.id).toBeGreaterThan(0);
      expect(user.username).toBe(testUsername);
      expect(user.role).toBe("agent");
      userId = user.id;
    });

    it("retrieves user by id", async () => {
      const user = await inWorkspace(() => storage.getUserById(userId));
      expect(user).toBeDefined();
      expect(user!.username).toBe(testUsername);
    });

    it("retrieves user by username", async () => {
      const user = await inWorkspace(() => storage.getUserByUsername(testUsername));
      expect(user).toBeDefined();
      expect(user!.id).toBe(userId);
    });

    it("updates a user", async () => {
      const updated = await inWorkspace(() =>
        storage.updateUser(userId, { displayName: "Updated Name" }),
      );
      expect(updated).toBeDefined();
      expect(updated!.displayName).toBe("Updated Name");
    });

    it("returns undefined for non-existent user", async () => {
      const user = await inWorkspace(() => storage.getUserById(999999));
      expect(user).toBeUndefined();
    });

    it("deletes a user", async () => {
      await inWorkspace(() => storage.deleteUser(userId));
      const user = await inWorkspace(() => storage.getUserById(userId));
      expect(user).toBeUndefined();
    });
  });

  // ── Vehicles ───────────────────────────────────────────────
  describe("Vehicles", () => {
    let vehicleId: number;
    const testPlate = `TEST-${Date.now().toString(36).toUpperCase()}`;

    it("creates a vehicle", async () => {
      const vehicle = await inWorkspace(() =>
        storage.createVehicle({
          plate: testPlate,
          model: "Test Model",
          category: "B",
          status: "ready",
          sla: "normal",
        }),
      );
      expect(vehicle.id).toBeGreaterThan(0);
      expect(vehicle.plate).toBe(testPlate);
      vehicleId = vehicle.id;
    });

    it("lists vehicles including the new one", async () => {
      const vehicles = await inWorkspace(() => storage.getVehicles());
      const found = vehicles.find((v: any) => v.id === vehicleId);
      expect(found).toBeDefined();
      expect(found!.plate).toBe(testPlate);
    });

    it("retrieves vehicle by id", async () => {
      const vehicle = await inWorkspace(() => storage.getVehicleById(vehicleId));
      expect(vehicle).toBeDefined();
      expect(vehicle!.model).toBe("Test Model");
    });

    it("updates vehicle status", async () => {
      const updated = await inWorkspace(() =>
        storage.updateVehicle(vehicleId, { status: "washing" }),
      );
      expect(updated).toBeDefined();
      expect(updated!.status).toBe("washing");
    });

    it("soft-deletes a vehicle", async () => {
      await inWorkspace(() => storage.deleteVehicle(vehicleId));
      const vehicles = await inWorkspace(() => storage.getVehicles());
      const found = vehicles.find((v: any) => v.id === vehicleId);
      expect(found).toBeUndefined(); // Soft-deleted, filtered from results
    });
  });

  // ── Wash Queue ─────────────────────────────────────────────
  describe("Wash Queue", () => {
    let itemId: number;

    it("creates a wash queue item", async () => {
      const item = await inWorkspace(() =>
        storage.createWashQueueItem({
          vehiclePlate: "WQ-TEST-001",
          washType: "Quick Wash",
          priority: "Normal",
          status: "pending",
        }),
      );
      expect(item.id).toBeGreaterThan(0);
      expect(item.vehiclePlate).toBe("WQ-TEST-001");
      itemId = item.id;
    });

    it("retrieves wash queue", async () => {
      const queue = await inWorkspace(() => storage.getWashQueue());
      const found = queue.find((i: any) => i.id === itemId);
      expect(found).toBeDefined();
      expect(found!.status).toBe("pending");
    });

    it("updates wash queue item", async () => {
      const updated = await inWorkspace(() =>
        storage.updateWashQueueItem(itemId, { status: "in_progress", assignedTo: "Test Washer" }),
      );
      expect(updated).toBeDefined();
      expect(updated!.status).toBe("in_progress");
      expect(updated!.assignedTo).toBe("Test Washer");
    });

    it("deletes a wash queue item", async () => {
      await inWorkspace(() => storage.deleteWashQueueItem(itemId));
      const queue = await inWorkspace(() => storage.getWashQueue());
      const found = queue.find((i: any) => i.id === itemId);
      expect(found).toBeUndefined();
    });
  });

  // ── Notifications ──────────────────────────────────────────
  describe("Notifications", () => {
    let notifId: number;

    it("creates a notification", async () => {
      const notif = await inWorkspace(() =>
        storage.createNotification({
          type: "system",
          severity: "info",
          title: "Test notification",
          body: "Test body",
          read: false,
          metadata: {},
        }),
      );
      expect(notif.id).toBeGreaterThan(0);
      notifId = notif.id;
    });

    it("lists notifications", async () => {
      const all = await inWorkspace(() => storage.getNotifications());
      expect(all.some((n: any) => n.id === notifId)).toBe(true);
    });

    it("marks notification as read", async () => {
      const updated = await inWorkspace(() =>
        storage.updateNotification(notifId, { read: true }),
      );
      expect(updated).toBeDefined();
      expect(updated!.read).toBe(true);
    });
  });

  // ── Incidents ──────────────────────────────────────────────
  describe("Incidents", () => {
    let incidentId: number;

    it("creates an incident", async () => {
      const incident = await inWorkspace(() =>
        storage.createIncident({
          title: "Test Incident",
          description: "Integration test incident",
          severity: "medium",
          status: "open",
          reportedBy: 1,
        }),
      );
      expect(incident.id).toBeGreaterThan(0);
      expect(incident.status).toBe("open");
      incidentId = incident.id;
    });

    it("retrieves incident by id", async () => {
      const incident = await inWorkspace(() => storage.getIncidentById(incidentId));
      expect(incident).toBeDefined();
      expect(incident!.title).toBe("Test Incident");
    });

    it("updates incident status", async () => {
      const updated = await inWorkspace(() =>
        storage.updateIncident(incidentId, { status: "investigating" }),
      );
      expect(updated).toBeDefined();
      expect(updated!.status).toBe("investigating");
    });
  });

  // ── Stations ───────────────────────────────────────────────
  describe("Stations", () => {
    let stationId: number;
    const testCode = `ST-${Date.now().toString(36).toUpperCase()}`;

    it("creates a station", async () => {
      const station = await inWorkspace(() =>
        storage.createStation({
          name: "Test Station",
          code: testCode,
          address: "Test Address",
          timezone: "UTC",
          active: true,
        }),
      );
      expect(station.id).toBeGreaterThan(0);
      stationId = station.id;
    });

    it("lists stations", async () => {
      const stations = await inWorkspace(() => storage.getStations());
      expect(stations.some((s: any) => s.id === stationId)).toBe(true);
    });
  });

  // ── Shifts ────────────────────────────────────────────────
  describe("Shifts", () => {
    let shiftId: number;

    it("creates a shift", async () => {
      const shift = await inWorkspace(() =>
        storage.createShift({
          employeeName: "Test Worker",
          employeeRole: "Agent",
          weekStart: "2026-04-06",
          schedule: ["08-16", "08-16", "OFF", "OFF", "08-16", "OFF", "OFF"],
          status: "draft",
          stationId: 1,
          fairnessScore: 0.9,
          fatigueScore: 0.1,
        }),
      );
      expect(shift.id).toBeGreaterThan(0);
      shiftId = shift.id;
    });

    it("retrieves shifts", async () => {
      const shifts = await inWorkspace(() => storage.getShifts());
      expect(shifts.some((s: any) => s.id === shiftId)).toBe(true);
    });
  });

  // ── Automation Rules ──────────────────────────────────────
  describe("Automation Rules", () => {
    let ruleId: number;

    it("creates an automation rule", async () => {
      const rule = await inWorkspace(() =>
        storage.createAutomationRule({
          name: "Test AutoRule",
          description: "Integration test rule",
          trigger: "test_trigger",
          conditions: {},
          actions: [{ type: "notify", target: "admin" }],
          createdBy: 1,
          scope: "shared",
          active: true,
          version: 1,
        }),
      );
      expect(rule.id).toBeGreaterThan(0);
      ruleId = rule.id;
    });

    it("lists automation rules", async () => {
      const rules = await inWorkspace(() => storage.getAutomationRules());
      expect(rules.some((r: any) => r.id === ruleId)).toBe(true);
    });

    it("updates an automation rule", async () => {
      const updated = await inWorkspace(() =>
        storage.updateAutomationRule(ruleId, { active: false }),
      );
      expect(updated).toBeDefined();
      expect(updated!.active).toBe(false);
    });
  });
});

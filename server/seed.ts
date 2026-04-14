import { storage } from "./storage.js";
import { hashPassword } from "./auth.js";
import { db } from "./db.js";
import { workspaces } from "../shared/schema.js";

export async function seedDatabase() {
  if (process.env.NODE_ENV === "production") {
    console.warn("seedDatabase skipped: refusing to seed in production");
    return;
  }

  // Ensure the "default" workspace exists before creating users
  await db
    .insert(workspaces)
    .values({ id: "default", name: "Default Workspace", slug: "default" })
    .onConflictDoNothing();

  const existing = await storage.getUserByUsername("admin");
  if (existing) return;

  const adminPassword = await hashPassword("admin123");
  const adminUser = await storage.createUser({ username: "admin", password: adminPassword, displayName: "Admin User", role: "admin", language: "en", theme: "dark" });
  const adminId = adminUser.id;

  const pw2 = await hashPassword("maria123");
  await storage.createUser({ username: "maria", password: pw2, displayName: "Maria K.", role: "coordinator", station: "ATH-MAIN", language: "el", theme: "dark" });
  const pw3 = await hashPassword("john123");
  await storage.createUser({ username: "john", password: pw3, displayName: "John D.", role: "agent", station: "ATH-MAIN", language: "en", theme: "dark" });

  const supPw1 = await hashPassword("giorgos123");
  await storage.createUser({ username: "giorgos", password: supPw1, displayName: "Giorgos M.", role: "supervisor", station: "ATH-MAIN", language: "el", theme: "dark" });
  const supPw2 = await hashPassword("elena123");
  await storage.createUser({ username: "elena", password: supPw2, displayName: "Elena P.", role: "supervisor", station: "SKG-01", language: "el", theme: "dark" });

  const washerPw = await hashPassword("nikos123");
  await storage.createUser({ username: "nikos", password: washerPw, displayName: "Nikos T.", role: "agent", station: "ATH-MAIN", language: "el", theme: "dark" });
  const washerPw2 = await hashPassword("costas123");
  await storage.createUser({ username: "costas", password: washerPw2, displayName: "Costas V.", role: "agent", station: "SKG-01", language: "el", theme: "dark" });

  await storage.createStation({ name: "Athens Main", code: "ATH-MAIN", address: "Athens Airport", timezone: "Europe/Athens", active: true });
  await storage.createStation({ name: "Thessaloniki", code: "SKG-01", address: "Thessaloniki Airport", timezone: "Europe/Athens", active: true });
  await storage.createStation({ name: "Heraklion", code: "HER-01", address: "Heraklion Airport", timezone: "Europe/Athens", active: true });

  await storage.createVehicle({ plate: "YHA-1234", model: "Peugeot 208", category: "B", status: "washing", sla: "normal", nextBooking: "14:00 Today", timerInfo: "15m remaining", stationId: 1, mileage: 34200, fuelLevel: 75 });
  await storage.createVehicle({ plate: "ZXC-9876", model: "Nissan Qashqai", category: "C", status: "rented", sla: "high", nextBooking: "12:30 Today (LATE)", timerInfo: "Overdue by 2h", stationId: 1, mileage: 56100, fuelLevel: 30 });
  await storage.createVehicle({ plate: "BAM-4455", model: "VW Golf", category: "B", status: "maintenance", sla: "low", nextBooking: "None", timerInfo: "Est. 2 days", stationId: 2, mileage: 89400, fuelLevel: 50 });
  await storage.createVehicle({ plate: "KLO-1122", model: "Toyota Yaris", category: "A", status: "ready", sla: "normal", nextBooking: "Tomorrow 09:00", timerInfo: "-", stationId: 1, mileage: 12300, fuelLevel: 95 });
  await storage.createVehicle({ plate: "PLM-7788", model: "BMW 320i", category: "D", status: "ready", sla: "premium", nextBooking: "Today 16:00", timerInfo: "-", stationId: 3, mileage: 28700, fuelLevel: 80 });
  await storage.createVehicle({ plate: "NXR-3344", model: "Fiat 500", category: "A", status: "ready", sla: "normal", nextBooking: "None", timerInfo: "-", stationId: 2, mileage: 45600, fuelLevel: 60 });

  await storage.createWashQueueItem({ vehiclePlate: "YHA-1234", washType: "Full Detail", priority: "Urgent", assignedTo: "Nikos", status: "in_progress", slaInfo: "Breach in 5m", stationId: 1 });
  await storage.createWashQueueItem({ vehiclePlate: "ZXC-9876", washType: "Quick Wash", priority: "Normal", assignedTo: null, status: "pending", slaInfo: "OK", stationId: 1 });
  await storage.createWashQueueItem({ vehiclePlate: "BAM-4455", washType: "Interior Only", priority: "Normal", assignedTo: null, status: "pending", slaInfo: "OK", stationId: 2 });

  await storage.createShift({ employeeName: "Maria K.", employeeRole: "Manager", weekStart: "2026-03-09", schedule: ["08-16", "08-16", "08-16", "08-16", "08-16", "OFF", "OFF"], status: "published", stationId: 1, fairnessScore: 0.92, fatigueScore: 0.15 });
  await storage.createShift({ employeeName: "John D.", employeeRole: "Agent", weekStart: "2026-03-09", schedule: ["10-18", "10-18", "OFF", "10-18", "10-18", "10-18", "OFF"], status: "published", stationId: 1, fairnessScore: 0.88, fatigueScore: 0.22 });
  await storage.createShift({ employeeName: "Anna P.", employeeRole: "Agent", weekStart: "2026-03-09", schedule: ["OFF", "14-22", "14-22", "14-22", "OFF", "08-16", "08-16"], status: "published", stationId: 1, fairnessScore: 0.85, fatigueScore: 0.30 });
  await storage.createShift({ employeeName: "Nikos T.", employeeRole: "Washer", weekStart: "2026-03-09", schedule: ["06-14", "06-14", "06-14", "OFF", "06-14", "06-14", "OFF"], status: "published", stationId: 1, fairnessScore: 0.90, fatigueScore: 0.18 });
  await storage.createShift({ employeeName: "Costas V.", employeeRole: "Washer", weekStart: "2026-03-09", schedule: ["14-22", "OFF", "14-22", "14-22", "14-22", "OFF", "10-18"], status: "draft", stationId: 2, fairnessScore: 0.87, fatigueScore: 0.25 });

  await storage.createNotification({ type: "incident", severity: "critical", title: "Vehicle Breakdown reported", body: "Client reporting engine issue on YHA-1234 on Highway 6.", read: false, metadata: { vehiclePlate: "YHA-1234", location: "Highway 6, KM 42" } });
  await storage.createNotification({ type: "approval", severity: "info", title: "Shift Change Request", body: "Anna P. requested to swap Wed 14 shift with Maria K.", read: false, metadata: {} });
  await storage.createNotification({ type: "ai_insight", severity: "warning", title: "Impending Fleet Shortage", body: "Projected shortage of Category B vehicles tomorrow afternoon.", read: false, metadata: {} });
  await storage.createNotification({ type: "system", severity: "info", title: "Data Import Completed", body: "Reservations CSV imported successfully.", read: true, metadata: {} });

  await storage.createAutomationRule({ name: "QC Fail Alert", description: "When a QC inspection fails, alert the station supervisor and create a rework task", trigger: "qc_fail", conditions: { severity: "high" }, actions: [{ type: "notify", target: "supervisor" }, { type: "create_task", taskType: "rework" }], createdBy: adminId, scope: "shared", active: true, version: 1 });
  await storage.createAutomationRule({ name: "Customer Evidence Upload", description: "When a customer uploads damage evidence, notify the station and attach to reservation", trigger: "customer_upload", conditions: {}, actions: [{ type: "notify", target: "station" }, { type: "link_evidence" }], createdBy: adminId, scope: "shared", active: true, version: 1 });
  await storage.createAutomationRule({ name: "SLA Breach Warning", description: "When wash queue SLA is about to breach, escalate to coordinator", trigger: "sla_warning", conditions: { minutesBefore: 10 }, actions: [{ type: "escalate", target: "coordinator" }], createdBy: adminId, scope: "shared", active: false, version: 1 });

  await storage.createEntityRoom({ entityType: "vehicle", entityId: "YHA-1234", title: "YHA-1234 Breakdown Discussion", status: "open", priority: "critical", metadata: { vehiclePlate: "YHA-1234" } });
  await storage.createEntityRoom({ entityType: "shift", entityId: "week-2026-03-09", title: "Week 10 Shift Planning", status: "open", priority: "normal", metadata: {} });
  await storage.createEntityRoom({ entityType: "operations", entityId: "ops-daily-2026-03-24", title: "Daily Ops Standup", status: "open", priority: "normal", metadata: {} });

  // Sample imports (demonstrate the full lifecycle)
  await storage.createImport({ filename: "fleet_q1_2026.xlsx", status: "completed", uploadedBy: 1, records: 42, columns: 8, fileType: "xlsx", mappings: [{ source: "License Plate", target: "plate", confidence: 0.98 }, { source: "Car Model", target: "model", confidence: 0.95 }, { source: "Km", target: "mileage", confidence: 0.88 }], diffs: { added: 35, updated: 7, deleted: 0, conflicts: 0 } });
  await storage.createImport({ filename: "staff_roster_march.csv", status: "reviewing", uploadedBy: 1, records: 12, columns: 6, fileType: "csv", mappings: [{ source: "Full Name", target: "displayName", confidence: 0.97 }, { source: "Position", target: "role", confidence: 0.82 }, { source: "Branch", target: "station", confidence: 0.90 }], diffs: { added: 3, updated: 8, deleted: 1, conflicts: 2 } });
  await storage.createImport({ filename: "reservations_export.pdf", status: "failed", uploadedBy: 2, records: 0, columns: 0, fileType: "pdf", errorMessage: "PDF parsing failed: unsupported table layout on page 3", mappings: null, diffs: null });

  // Sample proposals (adaptive workspace)
  await storage.createProposal({ userId: 1, type: "button", label: "Quick Return Scanner", description: "Add a one-click button to the Fleet page that opens the camera for vehicle return scanning", impact: "medium", scope: "shared", status: "proposed", payload: { placement: "fleet-toolbar", icon: "Camera", action: "openReturnScanner" } });
  await storage.createProposal({ userId: 2, type: "view", label: "Morning Shift Dashboard", description: "Custom dashboard showing vehicles due for return before noon with wash estimates", impact: "low", scope: "personal", status: "approved", payload: { layout: "grid", widgets: ["morning_returns", "wash_queue", "staff_on_duty"], route: "/custom/morning-dash" } });

  // Sample activity feed entries
  await storage.createActivityEntry({ userId: 1, actorName: "Admin User", action: "imported_data", entityType: "import", entityId: "1", entityLabel: "fleet_q1_2026.xlsx", metadata: { records: 42 } });
  await storage.createActivityEntry({ userId: 6, actorName: "Nikos T.", action: "completed_wash", entityType: "vehicle", entityId: "YHA-1234", entityLabel: "Peugeot 208 — Full Detail", stationId: 1, metadata: { washType: "Full Detail", duration: 38 } });
  await storage.createActivityEntry({ userId: 2, actorName: "Maria K.", action: "published_shift", entityType: "shift", entityId: "week-2026-03-09", entityLabel: "Week 10 Schedule", stationId: 1, metadata: { employees: 4 } });
  await storage.createActivityEntry({ userId: 4, actorName: "Giorgos M.", action: "escalated_incident", entityType: "entity_room", entityId: "YHA-1234", entityLabel: "YHA-1234 Breakdown", metadata: { priority: "critical" } });

  await storage.createWorkspaceMemory({ category: "policy", key: "max_shift_hours", value: "10 hours maximum per shift", source: "admin", confidence: 1.0 });
  await storage.createWorkspaceMemory({ category: "policy", key: "wash_sla_standard", value: "45 minutes for standard wash", source: "system", confidence: 0.95 });
  await storage.createWorkspaceMemory({ category: "preference", key: "peak_hours", value: "Airport rush: 06:00-10:00, 16:00-20:00", source: "ai_learned", confidence: 0.8 });
  await storage.createWorkspaceMemory({ category: "sop", key: "damage_inspection", value: "All returns must have 6-photo minimum inspection before release", source: "admin", confidence: 1.0 });
  await storage.createWorkspaceMemory({ category: "policy", key: "shift_publishing", value: "Only Supervisors and Coordinators can create, edit, and publish shifts", source: "admin", confidence: 1.0 });

  await storage.createDigitalTwinSnapshot({ stationId: 1, snapshotType: "current", data: {
    totalVehicles: 42, ready: 28, washing: 5, maintenance: 3, rented: 6,
    activeWashers: 3, queueLength: 5, avgWashTime: 38,
    riskLevel: "medium", nextHourRisk: "high",
    staffOnDuty: 8, staffNeeded: 10,
    forecasts: { nextHour: { returns: 4, pickups: 6 }, tomorrow: { returns: 12, pickups: 15 } }
  }});
  await storage.createDigitalTwinSnapshot({ stationId: 2, snapshotType: "current", data: {
    totalVehicles: 28, ready: 20, washing: 2, maintenance: 1, rented: 5,
    activeWashers: 2, queueLength: 2, avgWashTime: 35,
    riskLevel: "low", nextHourRisk: "low",
    staffOnDuty: 5, staffNeeded: 4,
    forecasts: { nextHour: { returns: 2, pickups: 1 }, tomorrow: { returns: 8, pickups: 7 } }
  }});

  await storage.setUserPreference({ userId: 1, scope: "personal", category: "layout", key: "sidebar_collapsed", value: false });
  await storage.setUserPreference({ userId: 1, scope: "personal", category: "ai", key: "response_language", value: "en" });
  await storage.setUserPreference({ userId: 1, scope: "personal", category: "dashboard", key: "pinned_widgets", value: ["fleet_status", "wash_queue", "notifications"] });

  const existingModules = await storage.getModuleRegistry();
  if (existingModules.length === 0) {
    const modules = [
      { slug: 'chat', name: 'DriveAI Chat', category: 'core', icon: 'Bot', route: '/', requiredRole: 'agent', order: 0 },
      { slug: 'ops-inbox', name: 'Ops Inbox', category: 'core', icon: 'Inbox', route: '/inbox', requiredRole: 'agent', order: 1 },
      { slug: 'fleet', name: 'Fleet Intelligence', category: 'operations', icon: 'Car', route: '/fleet', requiredRole: 'agent', order: 10 },
      { slug: 'washers', name: 'Washer Queue', category: 'operations', icon: 'Droplets', route: '/washers', requiredRole: 'agent', order: 11 },
      { slug: 'shifts', name: 'Shift Management', category: 'operations', icon: 'CalendarDays', route: '/shifts', requiredRole: 'agent', order: 12 },
      { slug: 'calendar', name: 'Master Calendar', category: 'operations', icon: 'Calendar', route: '/calendar', requiredRole: 'agent', order: 13 },
      { slug: 'imports', name: 'Data Imports', category: 'operations', icon: 'FileUp', route: '/imports', requiredRole: 'coordinator', order: 14 },
      { slug: 'vehicle-intel', name: 'Vehicle Intelligence', category: 'operations', icon: 'Eye', route: '/vehicle-intelligence', requiredRole: 'agent', order: 15 },
      { slug: 'digital-twin', name: 'Digital Twin', category: 'intelligence', icon: 'Activity', route: '/digital-twin', requiredRole: 'agent', order: 20 },
      { slug: 'executive', name: 'Executive Intelligence', category: 'intelligence', icon: 'BarChart3', route: '/executive', requiredRole: 'coordinator', order: 21 },
      { slug: 'analytics', name: 'Analytics', category: 'intelligence', icon: 'BarChart3', route: '/analytics', requiredRole: 'agent', order: 22 },
      { slug: 'war-room', name: 'War Room', category: 'intelligence', icon: 'Shield', route: '/war-room', requiredRole: 'agent', order: 23 },
      { slug: 'automations', name: 'Automations', category: 'platform', icon: 'Zap', route: '/automations', requiredRole: 'agent', order: 30 },
      { slug: 'workspace-memory', name: 'AI Memory', category: 'platform', icon: 'Brain', route: '/workspace-memory', requiredRole: 'coordinator', order: 31 },
      { slug: 'knowledge', name: 'Knowledge Base', category: 'platform', icon: 'Database', route: '/knowledge', requiredRole: 'agent', order: 32 },
      { slug: 'trust', name: 'Trust Console', category: 'governance', icon: 'ShieldCheck', route: '/trust', requiredRole: 'supervisor', order: 40 },
      { slug: 'users', name: 'User Management', category: 'governance', icon: 'Users', route: '/users', requiredRole: 'supervisor', order: 41 },
    ];
    for (const m of modules) {
      await storage.createModuleEntry({ ...m, enabled: true, description: `${m.name} module` });
    }
  }

  console.info("Database seeded with comprehensive data including supervisors, preferences, and module registry");
}

/**
 * Fleet domain: vehicles, evidence, wash queue, positions, transfers, quality, downtime, vehicle events.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";
import { incidents, repairOrders } from "./incidents.js";
import { integrationConnectors } from "./integrations.js";

// ─── VEHICLES ───
export const vehicles = pgTable("vehicles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  plate: text("plate").notNull(),
  model: text("model").notNull(),
  category: text("category").notNull().default("B"),
  stationId: integer("station_id").references(() => stations.id),
  status: text("status").notNull().default("ready"),
  sla: text("sla").notNull().default("normal"),
  mileage: integer("mileage"),
  fuelLevel: integer("fuel_level"),
  nextBooking: text("next_booking"),
  timerInfo: text("timer_info"),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("vehicles_status_idx").on(t.status, t.deletedAt),
  index("vehicles_station_idx").on(t.stationId),
  uniqueIndex("vehicles_ws_plate_idx").on(t.workspaceId, t.plate),
]);
export const VEHICLE_STATUSES = ['ready', 'rented', 'maintenance', 'washing', 'transit', 'retired', 'impounded'] as const;
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ deletedAt: true }).extend({
  plate: z.string().min(1).max(20),
  model: z.string().min(1).max(100),
  category: z.string().max(10).default('B'),
  sla: z.string().max(20).default('normal'),
  status: z.enum(VEHICLE_STATUSES).default('ready'),
});
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ─── VEHICLE EVIDENCE (photos, notes, damage) ───
export const vehicleEvidence = pgTable("vehicle_evidence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  type: text("type").notNull(),
  url: text("url"),
  caption: text("caption"),
  severity: text("severity"),
  source: text("source").notNull().default("staff"),
  reservationId: text("reservation_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("evidence_vehicle_idx").on(t.vehicleId),
  index("evidence_type_idx").on(t.type),
  index("evidence_created_idx").on(t.createdAt),
]);
export const insertVehicleEvidenceSchema = createInsertSchema(vehicleEvidence).omit({ createdAt: true });
export type InsertVehicleEvidence = z.infer<typeof insertVehicleEvidenceSchema>;
export type VehicleEvidence = typeof vehicleEvidence.$inferSelect;

// ─── WASH QUEUE ───
export const washQueue = pgTable("wash_queue", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehiclePlate: text("vehicle_plate").notNull(),
  washType: text("wash_type").notNull().default("Quick Wash"),
  priority: text("priority").notNull().default("Normal"),
  assignedTo: text("assigned_to"),
  status: text("status").notNull().default("pending"),
  slaInfo: text("sla_info"),
  stationId: integer("station_id").references(() => stations.id),
  proofPhotoUrl: text("proof_photo_url"),
  slaDeadline: timestamp("sla_deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("wash_queue_status_idx").on(t.status),
  index("wash_queue_station_idx").on(t.stationId),
  index("wash_queue_priority_idx").on(t.priority),
  index("wash_queue_sla_idx").on(t.slaDeadline),
]);
export const insertWashQueueSchema = createInsertSchema(washQueue).omit({ createdAt: true, completedAt: true, slaDeadline: true });
export type InsertWashQueue = z.infer<typeof insertWashQueueSchema>;
export type WashQueueItem = typeof washQueue.$inferSelect;

// ─── STATION POSITIONS (typed parking/staging positions) ───
export const stationPositions = pgTable("station_positions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  stationId: integer("station_id").notNull().references(() => stations.id),
  code: text("code").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull().default("parking"),
  capacity: integer("capacity").notNull().default(1),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("station_pos_ws_station_code_idx").on(t.workspaceId, t.stationId, t.code),
  index("station_pos_station_idx").on(t.stationId),
  index("station_pos_type_idx").on(t.type),
]);
export const insertStationPositionSchema = createInsertSchema(stationPositions).omit({ createdAt: true });
export type InsertStationPosition = z.infer<typeof insertStationPositionSchema>;
export type StationPosition = typeof stationPositions.$inferSelect;

// ─── POSITION ASSIGNMENTS (vehicle-to-position mapping) ───
export const positionAssignments = pgTable("position_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  positionId: integer("position_id").notNull().references(() => stationPositions.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  assignedBy: integer("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
}, (t) => [
  index("pos_assign_position_idx").on(t.positionId),
  index("pos_assign_vehicle_idx").on(t.vehicleId),
  index("pos_assign_active_idx").on(t.positionId, t.releasedAt),
]);
export const insertPositionAssignmentSchema = createInsertSchema(positionAssignments).omit({ assignedAt: true, releasedAt: true });
export type InsertPositionAssignment = z.infer<typeof insertPositionAssignmentSchema>;
export type PositionAssignment = typeof positionAssignments.$inferSelect;

// ─── VEHICLE TRANSFERS (inter-station transfer tracking) ───
export const vehicleTransfers = pgTable("vehicle_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  fromStationId: integer("from_station_id").notNull().references(() => stations.id),
  toStationId: integer("to_station_id").notNull().references(() => stations.id),
  status: text("status").notNull().default("requested"),
  requestedBy: integer("requested_by").notNull().references(() => users.id),
  driverName: text("driver_name"),
  reason: text("reason"),
  notes: text("notes"),
  estimatedArrival: timestamp("estimated_arrival"),
  departedAt: timestamp("departed_at"),
  arrivedAt: timestamp("arrived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("transfers_vehicle_idx").on(t.vehicleId),
  index("transfers_from_idx").on(t.fromStationId),
  index("transfers_to_idx").on(t.toStationId),
  index("transfers_status_idx").on(t.status),
  index("transfers_created_idx").on(t.createdAt),
]);
export const insertVehicleTransferSchema = createInsertSchema(vehicleTransfers).omit({ createdAt: true, updatedAt: true, departedAt: true, arrivedAt: true });
export type InsertVehicleTransfer = z.infer<typeof insertVehicleTransferSchema>;
export type VehicleTransfer = typeof vehicleTransfers.$inferSelect;

// ─── VEHICLE EVENTS (append-only telematics + alerts) ───
export const vehicleEvents = pgTable("vehicle_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  connectorId: integer("connector_id").references(() => integrationConnectors.id),
  source: text("source").notNull().default("manual"),
  externalEventId: text("external_event_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  payload: jsonb("payload"),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  derivedAction: text("derived_action"),
  derivedEntityType: text("derived_entity_type"),
  derivedEntityId: text("derived_entity_id"),
}, (t) => [
  index("ve_vehicle_time_idx").on(t.vehicleId, t.occurredAt),
  index("ve_vehicle_type_idx").on(t.vehicleId, t.eventType),
  index("ve_type_idx").on(t.eventType),
  index("ve_connector_idx").on(t.connectorId),
  index("ve_received_idx").on(t.receivedAt),
  uniqueIndex("ve_external_dedup_idx").on(t.workspaceId, t.source, t.externalEventId),
]);
export const insertVehicleEventSchema = createInsertSchema(vehicleEvents).omit({
  receivedAt: true, processed: true, processedAt: true, derivedAction: true, derivedEntityType: true, derivedEntityId: true,
});
export type InsertVehicleEvent = z.infer<typeof insertVehicleEventSchema>;
export type VehicleEvent = typeof vehicleEvents.$inferSelect;

// ─── DOWNTIME EVENTS ───
export const downtimeEvents = pgTable("downtime_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  reason: text("reason").notNull(),
  incidentId: integer("incident_id").references(() => incidents.id),
  repairOrderId: integer("repair_order_id").references(() => repairOrders.id),
  stationId: integer("station_id").references(() => stations.id),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("downtime_vehicle_idx").on(t.vehicleId),
  index("downtime_reason_idx").on(t.reason),
  index("downtime_started_idx").on(t.startedAt),
]);
export const insertDowntimeEventSchema = createInsertSchema(downtimeEvents).omit({ createdAt: true });
export type InsertDowntimeEvent = z.infer<typeof insertDowntimeEventSchema>;
export type DowntimeEvent = typeof downtimeEvents.$inferSelect;

// ─── QUALITY INSPECTIONS (wash quality checklist) ───
export const qualityInspections = pgTable("quality_inspections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  washQueueId: integer("wash_queue_id").notNull().references(() => washQueue.id),
  vehiclePlate: text("vehicle_plate").notNull(),
  inspectorId: integer("inspector_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  overallScore: real("overall_score"),
  checklist: jsonb("checklist").$type<Array<{ item: string; passed: boolean; notes?: string }>>().notNull(),
  photos: jsonb("photos").$type<string[]>(),
  notes: text("notes"),
  inspectedAt: timestamp("inspected_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("quality_inspections_wash_idx").on(t.washQueueId),
  index("quality_inspections_vehicle_idx").on(t.vehiclePlate),
  index("quality_inspections_inspector_idx").on(t.inspectorId),
  index("quality_inspections_status_idx").on(t.status),
]);
export const insertQualityInspectionSchema = createInsertSchema(qualityInspections).omit({ createdAt: true, inspectedAt: true, overallScore: true });
export type InsertQualityInspection = z.infer<typeof insertQualityInspectionSchema>;
export type QualityInspection = typeof qualityInspections.$inferSelect;

// ─── RESERVATIONS ───
export const reservations = pgTable("reservations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  stationId: integer("station_id").references(() => stations.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("confirmed"),
  source: text("source").notNull().default("manual"),
  pickupDate: timestamp("pickup_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  actualPickup: timestamp("actual_pickup"),
  actualReturn: timestamp("actual_return"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("reservations_vehicle_idx").on(t.vehicleId),
  index("reservations_station_idx").on(t.stationId),
  index("reservations_status_idx").on(t.status),
  index("reservations_pickup_idx").on(t.pickupDate),
  index("reservations_return_idx").on(t.returnDate),
]);
export const insertReservationSchema = createInsertSchema(reservations).omit({ createdAt: true, updatedAt: true, actualPickup: true, actualReturn: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

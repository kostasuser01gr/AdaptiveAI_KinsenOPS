import { db, eq, desc, and , wsFilter, wsInsert} from "./base.js";
import {
  incidents, type Incident, type InsertIncident,
  incidentSummaries, type InsertIncidentSummary,
} from "../../shared/schema.js";

export class IncidentStorage {
  async getIncidents(filters?: { status?: string; severity?: string; stationId?: number; assignedTo?: number }) {
    const conditions = [];
    if (filters?.status) conditions.push(eq(incidents.status, filters.status));
    if (filters?.severity) conditions.push(eq(incidents.severity, filters.severity));
    if (filters?.stationId) conditions.push(eq(incidents.stationId, filters.stationId));
    if (filters?.assignedTo) conditions.push(eq(incidents.assignedTo, filters.assignedTo));
    if (conditions.length === 0) return db.select().from(incidents).where(wsFilter(incidents)).orderBy(desc(incidents.createdAt));
    if (conditions.length === 1) return db.select().from(incidents).where(and(conditions[0], wsFilter(incidents))).orderBy(desc(incidents.createdAt));
    return db.select().from(incidents).where(and(...conditions, wsFilter(incidents))).orderBy(desc(incidents.createdAt));
  }
  async getIncident(id: number) {
    const [i] = await db.select().from(incidents).where(and(eq(incidents.id, id), wsFilter(incidents)));
    return i;
  }
  async createIncident(data: InsertIncident) {
    const [i] = await db.insert(incidents).values(wsInsert(data)).returning();
    return i;
  }
  async updateIncident(id: number, data: Partial<Incident>) {
    const { id: _id, ...rest } = data;
    const [i] = await db.update(incidents).set({ ...rest, updatedAt: new Date() }).where(and(eq(incidents.id, id), wsFilter(incidents))).returning();
    return i;
  }

  async getIncidentSummaries(incidentId: number) {
    return db.select().from(incidentSummaries).where(eq(incidentSummaries.incidentId, incidentId)).orderBy(desc(incidentSummaries.createdAt));
  }
  async createIncidentSummary(data: InsertIncidentSummary) {
    const [s] = await db.insert(incidentSummaries).values(data).returning();
    return s;
  }
}

import { db, eq, desc, isNull , wsFilter, wsInsert, and} from "./base.js";
import {
  vehicles, type InsertVehicle,
  vehicleEvidence, type InsertVehicleEvidence,
} from "../../shared/schema.js";

export class VehicleStorage {
  async getVehicles() {
    return db.select().from(vehicles).where(and(isNull(vehicles.deletedAt), wsFilter(vehicles)));
  }
  async getVehicle(id: number) {
    const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), wsFilter(vehicles)));
    return v;
  }
  async createVehicle(data: InsertVehicle) {
    const [v] = await db.insert(vehicles).values(wsInsert(data)).returning();
    return v;
  }
  async updateVehicle(id: number, data: Partial<InsertVehicle>) {
    const [v] = await db.update(vehicles).set(data).where(and(eq(vehicles.id, id), wsFilter(vehicles))).returning();
    return v;
  }
  async deleteVehicle(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deletedAt is a table column absent from insert schema
    await db.update(vehicles).set({ deletedAt: new Date() } as any).where(and(eq(vehicles.id, id), wsFilter(vehicles)));
  }
  async restoreVehicle(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deletedAt is a table column absent from insert schema
    const [v] = await db.update(vehicles).set({ deletedAt: null } as any).where(and(eq(vehicles.id, id), wsFilter(vehicles))).returning();
    return v;
  }

  async getVehicleEvidence(vehicleId: number) {
    return db.select().from(vehicleEvidence).where(and(eq(vehicleEvidence.vehicleId, vehicleId), wsFilter(vehicleEvidence))).orderBy(desc(vehicleEvidence.createdAt));
  }
  async createVehicleEvidence(data: InsertVehicleEvidence) {
    const [e] = await db.insert(vehicleEvidence).values(wsInsert(data)).returning();
    return e;
  }
}

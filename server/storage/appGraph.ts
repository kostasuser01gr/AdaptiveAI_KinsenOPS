import { db, eq, desc, and, wsFilter, wsInsert } from "./base.js";
import {
  appGraphVersions, type InsertAppGraphVersion,
} from "../../shared/schema.js";

export class AppGraphStorage {
  async getAppGraphVersions(limit = 20) {
    return db.select().from(appGraphVersions)
      .where(wsFilter(appGraphVersions))
      .orderBy(desc(appGraphVersions.version))
      .limit(limit);
  }
  async getAppGraphVersion(version: number) {
    const [v] = await db.select().from(appGraphVersions)
      .where(and(eq(appGraphVersions.version, version), wsFilter(appGraphVersions)));
    return v;
  }
  async getLatestAppGraph() {
    const [v] = await db.select().from(appGraphVersions)
      .where(wsFilter(appGraphVersions))
      .orderBy(desc(appGraphVersions.version))
      .limit(1);
    return v;
  }
  async createAppGraphVersion(data: InsertAppGraphVersion) {
    const [v] = await db.insert(appGraphVersions).values(wsInsert(data)).returning();
    return v;
  }
  async applyAppGraphVersion(version: number) {
    const [v] = await db.update(appGraphVersions)
      .set({ appliedAt: new Date() })
      .where(and(eq(appGraphVersions.version, version), wsFilter(appGraphVersions)))
      .returning();
    return v;
  }
  async rollbackAppGraphVersion(version: number) {
    const [v] = await db.update(appGraphVersions)
      .set({ rolledBackAt: new Date() })
      .where(and(eq(appGraphVersions.version, version), wsFilter(appGraphVersions)))
      .returning();
    return v;
  }
}

import { db, eq, and, wsFilter, wsInsert } from "./base.js";
import {
  installedExtensions, type InsertInstalledExtension,
} from "../../shared/schema.js";

export class ExtensionStorage {
  async getInstalledExtensions(enabledOnly = false) {
    const conditions = [wsFilter(installedExtensions)];
    if (enabledOnly) conditions.push(eq(installedExtensions.enabled, true));
    return db.select().from(installedExtensions).where(and(...conditions)).orderBy(installedExtensions.name);
  }
  async getInstalledExtension(id: number) {
    const [e] = await db.select().from(installedExtensions).where(and(eq(installedExtensions.id, id), wsFilter(installedExtensions)));
    return e;
  }
  async getInstalledExtensionBySlug(slug: string) {
    const [e] = await db.select().from(installedExtensions).where(and(eq(installedExtensions.slug, slug), wsFilter(installedExtensions)));
    return e;
  }
  async installExtension(data: InsertInstalledExtension) {
    const [e] = await db.insert(installedExtensions).values(wsInsert(data)).returning();
    return e;
  }
  async updateExtension(id: number, data: Partial<InsertInstalledExtension>) {
    const [e] = await db.update(installedExtensions).set({ ...data, updatedAt: new Date() }).where(and(eq(installedExtensions.id, id), wsFilter(installedExtensions))).returning();
    return e;
  }
  async uninstallExtension(id: number) {
    await db.delete(installedExtensions).where(and(eq(installedExtensions.id, id), wsFilter(installedExtensions)));
  }
}

/**
 * Capability permissions storage domain module (Phase 4.2A).
 * Role defaults + per-user overrides for fine-grained capability control.
 */
import { db, eq, and , wsFilter, wsInsert} from "./base.js";
import {
  roleCapabilities,
  userCapabilityOverrides,
  type RoleCapability,
  type InsertRoleCapability,
  type UserCapabilityOverride,
  type InsertUserCapabilityOverride,
} from "../../shared/schema.js";

export class CapabilityStorage {
  // ── Role defaults ──

  async getRoleCapabilities(role: string): Promise<RoleCapability[]> {
    return db.select().from(roleCapabilities).where(eq(roleCapabilities.role, role));
  }

  async getAllRoleCapabilities(): Promise<RoleCapability[]> {
    return db.select().from(roleCapabilities);
  }

  async upsertRoleCapability(data: InsertRoleCapability): Promise<RoleCapability> {
    const [existing] = await db
      .select()
      .from(roleCapabilities)
      .where(and(eq(roleCapabilities.role, data.role), eq(roleCapabilities.capability, data.capability)));
    if (existing) {
      const [row] = await db
        .update(roleCapabilities)
        .set({ granted: data.granted, updatedAt: new Date() })
        .where(eq(roleCapabilities.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(roleCapabilities).values(data).returning();
    return row;
  }

  async deleteRoleCapability(role: string, capability: string): Promise<void> {
    await db.delete(roleCapabilities).where(
      and(eq(roleCapabilities.role, role), eq(roleCapabilities.capability, capability))
    );
  }

  // ── User overrides ──

  async getUserCapabilityOverrides(userId: number): Promise<UserCapabilityOverride[]> {
    return db.select().from(userCapabilityOverrides).where(and(eq(userCapabilityOverrides.userId, userId), wsFilter(userCapabilityOverrides)));
  }

  async upsertUserCapabilityOverride(data: InsertUserCapabilityOverride): Promise<UserCapabilityOverride> {
    const [existing] = await db
      .select()
      .from(userCapabilityOverrides)
      .where(and(
        eq(userCapabilityOverrides.userId, data.userId),
        eq(userCapabilityOverrides.capability, data.capability),
        wsFilter(userCapabilityOverrides)));
    if (existing) {
      const [row] = await db
        .update(userCapabilityOverrides)
        .set({ granted: data.granted, reason: data.reason ?? null, grantedBy: data.grantedBy ?? null, updatedAt: new Date() })
        .where(and(eq(userCapabilityOverrides.id, existing.id), wsFilter(userCapabilityOverrides)))
        .returning();
      return row;
    }
    const [row] = await db.insert(userCapabilityOverrides).values(wsInsert(data)).returning();
    return row;
  }

  async deleteUserCapabilityOverride(userId: number, capability: string): Promise<void> {
    await db.delete(userCapabilityOverrides).where(
      and(eq(userCapabilityOverrides.userId, userId), eq(userCapabilityOverrides.capability, capability), wsFilter(userCapabilityOverrides))
    );
  }
}

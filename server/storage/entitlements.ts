/**
 * Entitlement storage domain module (Phase 4.1B).
 */
import { db, eq, and } from "./base.js";
import {
  workspacePlans,
  entitlementOverrides,
  type WorkspacePlan,
  type InsertWorkspacePlan,
  type EntitlementOverride,
  type InsertEntitlementOverride,
} from "../../shared/schema.js";

export class EntitlementStorage {
  // ── Workspace plans ──
  async getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | undefined> {
    const [row] = await db.select().from(workspacePlans).where(eq(workspacePlans.workspaceId, workspaceId));
    return row;
  }

  async upsertWorkspacePlan(data: InsertWorkspacePlan): Promise<WorkspacePlan> {
    const existing = await this.getWorkspacePlan(data.workspaceId ?? "default");
    if (existing) {
      const [row] = await db
        .update(workspacePlans)
        .set({ plan: data.plan, label: data.label, activatedBy: data.activatedBy, updatedAt: new Date() })
        .where(eq(workspacePlans.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(workspacePlans).values(data).returning();
    return row;
  }

  // ── Entitlement overrides ──
  async getEntitlementOverrides(workspaceId: string): Promise<EntitlementOverride[]> {
    return db.select().from(entitlementOverrides).where(eq(entitlementOverrides.workspaceId, workspaceId));
  }

  async getEntitlementOverride(workspaceId: string, feature: string): Promise<EntitlementOverride | undefined> {
    const [row] = await db
      .select()
      .from(entitlementOverrides)
      .where(and(eq(entitlementOverrides.workspaceId, workspaceId), eq(entitlementOverrides.feature, feature)));
    return row;
  }

  async upsertEntitlementOverride(data: InsertEntitlementOverride): Promise<EntitlementOverride> {
    const existing = await this.getEntitlementOverride(data.workspaceId ?? "default", data.feature);
    if (existing) {
      const [row] = await db
        .update(entitlementOverrides)
        .set({ enabled: data.enabled, reason: data.reason ?? null, updatedBy: data.updatedBy ?? null, updatedAt: new Date() })
        .where(eq(entitlementOverrides.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(entitlementOverrides).values(data).returning();
    return row;
  }

  async deleteEntitlementOverride(workspaceId: string, feature: string): Promise<void> {
    await db
      .delete(entitlementOverrides)
      .where(and(eq(entitlementOverrides.workspaceId, workspaceId), eq(entitlementOverrides.feature, feature)));
  }
}

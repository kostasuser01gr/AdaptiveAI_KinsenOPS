import { db, eq, desc, and, or, sql, isNull , wsFilter, wsInsert} from "./base.js";
import {
  automationRules, type InsertAutomationRule,
  automationExecutions, type AutomationExecution, type InsertAutomationExecution,
  washQueue, vehicles, vehicleEvidence,
} from "../../shared/schema.js";

export class AutomationStorage {
  async getAutomationRules(userId?: number) {
    if (userId) {
      return db.select().from(automationRules)
        .where(and(or(eq(automationRules.scope, 'shared'), eq(automationRules.createdBy, userId)), wsFilter(automationRules)))
        .orderBy(desc(automationRules.createdAt));
    }
    return db.select().from(automationRules).where(wsFilter(automationRules)).orderBy(desc(automationRules.createdAt));
  }
  async createAutomationRule(data: InsertAutomationRule) {
    const [r] = await db.insert(automationRules).values(wsInsert(data)).returning();
    return r;
  }
  async getAutomationRule(id: number) {
    const [r] = await db.select().from(automationRules).where(and(eq(automationRules.id, id), wsFilter(automationRules)));
    return r;
  }
  async updateAutomationRule(id: number, data: Partial<InsertAutomationRule>) {
    const [r] = await db.update(automationRules).set(data).where(and(eq(automationRules.id, id), wsFilter(automationRules))).returning();
    return r;
  }
  async deleteAutomationRule(id: number) { await db.delete(automationRules).where(and(eq(automationRules.id, id), wsFilter(automationRules))); }

  async testAutomationRule(id: number) {
    const rule = await this.getAutomationRule(id);
    if (!rule) return { valid: false, errors: ['Rule not found'], matchingEntities: 0 };

    const errors: string[] = [];
    if (!rule.trigger) errors.push('Missing trigger type');
    if (!rule.name?.trim()) errors.push('Missing rule name');

    const validTriggers = ['wash_completed', 'vehicle_status_change', 'evidence_uploaded', 'shift_started', 'queue_threshold', 'timer', 'manual'];
    if (rule.trigger && !validTriggers.includes(rule.trigger)) {
      errors.push(`Unknown trigger type: ${rule.trigger}`);
    }

    if (rule.actions && Array.isArray(rule.actions)) {
      const validActions = ['send_notification', 'update_vehicle_status', 'assign_wash', 'create_room', 'log_event'];
      for (const action of rule.actions) {
        const actionType = (action as Record<string, unknown>).type as string | undefined;
        if (!actionType) errors.push('Action missing type');
        else if (!validActions.includes(actionType)) errors.push(`Unknown action type: ${actionType}`);
      }
    }

    let matchingEntities = 0;
    if (rule.trigger === 'wash_completed' || rule.trigger === 'queue_threshold') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(washQueue).where(wsFilter(washQueue));
      matchingEntities = Number(r.count);
    } else if (rule.trigger === 'vehicle_status_change') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(vehicles).where(and(isNull(vehicles.deletedAt), wsFilter(vehicles)));
      matchingEntities = Number(r.count);
    } else if (rule.trigger === 'evidence_uploaded') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(vehicleEvidence).where(wsFilter(vehicleEvidence));
      matchingEntities = Number(r.count);
    }

    return { valid: errors.length === 0, errors, matchingEntities };
  }

  async getAutomationExecutions(ruleId?: number, limit = 100) {
    if (ruleId) {
      return db.select().from(automationExecutions)
        .where(and(eq(automationExecutions.ruleId, ruleId), wsFilter(automationExecutions)))
        .orderBy(desc(automationExecutions.createdAt))
        .limit(limit);
    }
    return db.select().from(automationExecutions).where(wsFilter(automationExecutions)).orderBy(desc(automationExecutions.createdAt)).limit(limit);
  }
  async createAutomationExecution(data: InsertAutomationExecution) {
    const [e] = await db.insert(automationExecutions).values(wsInsert(data)).returning();
    return e;
  }
  async updateAutomationExecution(id: number, data: Partial<AutomationExecution>) {
    const { id: _id, ...rest } = data;
    const [e] = await db.update(automationExecutions).set(rest).where(and(eq(automationExecutions.id, id), wsFilter(automationExecutions))).returning();
    return e;
  }
}

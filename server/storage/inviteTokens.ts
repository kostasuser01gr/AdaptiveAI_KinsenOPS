import { db, eq, desc } from "./base.js";
import { inviteTokens, type InsertInviteToken } from "../../shared/schema.js";

export class InviteTokenStorage {
  async createInviteToken(data: InsertInviteToken) {
    const [token] = await db.insert(inviteTokens).values(data).returning();
    return token;
  }

  async getInviteTokenByToken(token: string) {
    const [row] = await db.select().from(inviteTokens).where(eq(inviteTokens.token, token));
    return row;
  }

  async markInviteTokenUsed(id: number, usedBy: number) {
    const [row] = await db
      .update(inviteTokens)
      .set({ usedBy, usedAt: new Date() })
      .where(eq(inviteTokens.id, id))
      .returning();
    return row;
  }

  async getInviteTokens(createdBy?: number) {
    if (createdBy !== undefined) {
      return db.select().from(inviteTokens).where(eq(inviteTokens.createdBy, createdBy)).orderBy(desc(inviteTokens.createdAt));
    }
    return db.select().from(inviteTokens).orderBy(desc(inviteTokens.createdAt));
  }

  async deleteInviteToken(id: number) {
    await db.delete(inviteTokens).where(eq(inviteTokens.id, id));
  }
}

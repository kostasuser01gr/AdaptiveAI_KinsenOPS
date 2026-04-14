import { db, eq, and , wsFilter, wsInsert} from "./base.js";
import {
  users, type InsertUser,
  userPreferences, type InsertUserPreference,
  customActions, type InsertCustomAction,
  stations, type InsertStation,
} from "../../shared/schema.js";

export class UserStorage {
  async getUser(id: number) {
    const [user] = await db.select().from(users).where(and(eq(users.id, id), wsFilter(users)));
    return user;
  }
  /** Unscoped user lookup by ID — used exclusively by passport deserializeUser. */
  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(and(eq(users.username, username), wsFilter(users)));
    return user;
  }
  /**
   * Unscoped username lookup — used exclusively by passport LocalStrategy
   * and registration duplicate check (before workspace context exists).
   */
  async getUserByUsernameUnscoped(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async getUsers() { return db.select().from(users).where(wsFilter(users)); }
  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(wsInsert(data)).returning();
    return user;
  }
  async updateUser(id: number, data: Partial<InsertUser>) {
    const [user] = await db.update(users).set(data).where(and(eq(users.id, id), wsFilter(users))).returning();
    return user;
  }
  /** Unscoped update — used for lockout counter updates during auth (before workspace context). */
  async updateUserUnscoped(id: number, data: Partial<InsertUser>) {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id: number) {
    await db.delete(users).where(and(eq(users.id, id), wsFilter(users)));
  }

  async getUserPreferences(userId: number, category?: string) {
    if (category) return db.select().from(userPreferences).where(and(eq(userPreferences.userId, userId), eq(userPreferences.category, category), wsFilter(userPreferences)));
    return db.select().from(userPreferences).where(and(eq(userPreferences.userId, userId), wsFilter(userPreferences)));
  }
  async setUserPreference(data: InsertUserPreference) {
    const existing = await db.select().from(userPreferences)
      .where(and(eq(userPreferences.userId, data.userId), eq(userPreferences.category, data.category), eq(userPreferences.key, data.key), wsFilter(userPreferences)));
    if (existing.length > 0) {
      const [pref] = await db.update(userPreferences).set({ value: data.value, updatedAt: new Date() }).where(and(eq(userPreferences.id, existing[0].id), wsFilter(userPreferences))).returning();
      return pref;
    }
    const [pref] = await db.insert(userPreferences).values(wsInsert(data)).returning();
    return pref;
  }
  async deleteUserPreference(id: number) { await db.delete(userPreferences).where(and(eq(userPreferences.id, id), wsFilter(userPreferences))); }
  async getUserPreference(id: number) {
    const [p] = await db.select().from(userPreferences).where(and(eq(userPreferences.id, id), wsFilter(userPreferences)));
    return p;
  }

  async getCustomActions(userId: number) {
    return db.select().from(customActions).where(and(eq(customActions.userId, userId), eq(customActions.active, true), wsFilter(customActions)));
  }
  async getCustomAction(id: number) {
    const [a] = await db.select().from(customActions).where(and(eq(customActions.id, id), wsFilter(customActions)));
    return a;
  }
  async createCustomAction(data: InsertCustomAction) {
    const [a] = await db.insert(customActions).values(wsInsert(data)).returning();
    return a;
  }
  async deleteCustomAction(id: number) { await db.delete(customActions).where(and(eq(customActions.id, id), wsFilter(customActions))); }

  async getStations() { return db.select().from(stations).where(wsFilter(stations)); }
  async createStation(data: InsertStation) {
    const [s] = await db.insert(stations).values(wsInsert(data)).returning();
    return s;
  }
  async updateStation(id: number, data: Partial<InsertStation>) {
    const [s] = await db.update(stations).set(data).where(and(eq(stations.id, id), wsFilter(stations))).returning();
    return s;
  }
}

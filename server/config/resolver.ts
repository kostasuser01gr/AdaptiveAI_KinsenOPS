/**
 * Configuration Resolver
 * Loads all workspace config values from the database, merges with defaults
 * from the registry, and provides typed getters for server-side code.
 *
 * Usage:
 *   import { configResolver } from "../config/resolver.js";
 *   const val = await configResolver.get("automations.sla_breach_interval_ms");
 */
import { storage } from "../storage.js";
import { CONFIG_MAP, CONFIG_REGISTRY, type ConfigDefinition } from "./registry.js";

interface CacheEntry {
  value: unknown;
  loadedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds

class ConfigResolver {
  private cache = new Map<string, CacheEntry>();
  private bulkLoaded = false;
  private bulkLoadedAt = 0;

  /** Get a single config value. Returns DB override or registry default. */
  async get<T = unknown>(key: string): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value as T;
    }

    const entry = await storage.getWorkspaceConfigByKey(key);
    const def = CONFIG_MAP.get(key);
    const value = entry ? entry.value : def?.defaultValue;

    this.cache.set(key, { value, loadedAt: Date.now() });
    return value as T;
  }

  /** Get a numeric config value with type safety. */
  async getNumber(key: string): Promise<number> {
    const v = await this.get<number>(key);
    return typeof v === "number" ? v : Number(v);
  }

  /** Get a string config value. */
  async getString(key: string): Promise<string> {
    const v = await this.get<string>(key);
    return typeof v === "string" ? v : String(v ?? "");
  }

  /** Get a boolean config value. */
  async getBoolean(key: string): Promise<boolean> {
    const v = await this.get<boolean>(key);
    return typeof v === "boolean" ? v : Boolean(v);
  }

  /** Get a string array config value. */
  async getStringArray(key: string): Promise<string[]> {
    const v = await this.get<string[]>(key);
    return Array.isArray(v) ? v : [];
  }

  /** Bulk-load all config values (useful at startup or for the admin UI). */
  async loadAll(): Promise<Record<string, unknown>> {
    const dbEntries = await storage.getWorkspaceConfig();
    const dbMap = new Map(dbEntries.map((e) => [e.key, e.value]));
    const result: Record<string, unknown> = {};
    const now = Date.now();

    for (const def of CONFIG_REGISTRY) {
      const value = dbMap.has(def.key) ? dbMap.get(def.key) : def.defaultValue;
      result[def.key] = value;
      this.cache.set(def.key, { value, loadedAt: now });
    }

    this.bulkLoaded = true;
    this.bulkLoadedAt = now;
    return result;
  }

  /** Returns all definitions merged with current DB values. */
  async getDefinitionsWithValues(): Promise<
    Array<ConfigDefinition & { currentValue: unknown; isOverridden: boolean }>
  > {
    const dbEntries = await storage.getWorkspaceConfig();
    const dbMap = new Map(dbEntries.map((e) => [e.key, e.value]));

    return CONFIG_REGISTRY.map((def) => ({
      ...def,
      currentValue: dbMap.has(def.key) ? dbMap.get(def.key) : def.defaultValue,
      isOverridden: dbMap.has(def.key),
    }));
  }

  /** Validate a value against a config definition's rules. */
  validate(key: string, value: unknown): { valid: boolean; error?: string } {
    const def = CONFIG_MAP.get(key);
    if (!def) return { valid: false, error: `Unknown config key: ${key}` };

    if (def.type === "number") {
      const num = Number(value);
      if (isNaN(num)) return { valid: false, error: "Value must be a number" };
      if (def.validation?.min !== undefined && num < def.validation.min) {
        return { valid: false, error: `Minimum value is ${def.validation.min}` };
      }
      if (def.validation?.max !== undefined && num > def.validation.max) {
        return { valid: false, error: `Maximum value is ${def.validation.max}` };
      }
    }

    if (def.type === "boolean" && typeof value !== "boolean") {
      return { valid: false, error: "Value must be a boolean" };
    }

    if (def.type === "string" && typeof value !== "string") {
      return { valid: false, error: "Value must be a string" };
    }

    if (def.type === "string" && def.validation?.options) {
      if (!def.validation.options.includes(value as string)) {
        return { valid: false, error: `Value must be one of: ${def.validation.options.join(", ")}` };
      }
    }

    if (def.type === "string[]" && !Array.isArray(value)) {
      return { valid: false, error: "Value must be an array of strings" };
    }

    return { valid: true };
  }

  /** Invalidate cache for a specific key or all keys. */
  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
      this.bulkLoaded = false;
    }
  }
}

export const configResolver = new ConfigResolver();

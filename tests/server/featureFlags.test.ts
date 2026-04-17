import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isFeatureEnabled,
  setFeatureFlag,
  clearFeatureFlag,
  getAllFeatureFlags,
  getFeatureFlagNames,
} from "../../server/featureFlags.js";

describe("Feature Flags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear any runtime overrides between tests
    for (const flag of getFeatureFlagNames()) {
      clearFeatureFlag(flag);
    }
    // Reset env changes
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ─── Default values ───────────────────────────────────────────────────────
  it("returns default=true for standard features", () => {
    expect(isFeatureEnabled("ai_chat")).toBe(true);
    expect(isFeatureEnabled("war_room")).toBe(true);
    expect(isFeatureEnabled("virtual_scrolling")).toBe(true);
  });

  it("returns default=false for god_mode", () => {
    expect(isFeatureEnabled("god_mode")).toBe(false);
  });

  // ─── Runtime overrides ────────────────────────────────────────────────────
  it("setFeatureFlag overrides default", () => {
    expect(isFeatureEnabled("god_mode")).toBe(false);
    setFeatureFlag("god_mode", true);
    expect(isFeatureEnabled("god_mode")).toBe(true);
  });

  it("clearFeatureFlag restores default", () => {
    setFeatureFlag("god_mode", true);
    clearFeatureFlag("god_mode");
    expect(isFeatureEnabled("god_mode")).toBe(false);
  });

  it("runtime override takes precedence over env var", () => {
    process.env.FF_GOD_MODE = "true";
    setFeatureFlag("god_mode", false);
    expect(isFeatureEnabled("god_mode")).toBe(false);
  });

  // ─── Environment variable resolution ──────────────────────────────────────
  it("reads env var FF_<NAME>=true", () => {
    process.env.FF_AI_CHAT = "false";
    expect(isFeatureEnabled("ai_chat")).toBe(false);
  });

  it("reads env var FF_<NAME>=1 as true", () => {
    process.env.FF_GOD_MODE = "1";
    expect(isFeatureEnabled("god_mode")).toBe(true);
  });

  it("env var takes precedence over default", () => {
    process.env.FF_GOD_MODE = "true";
    expect(isFeatureEnabled("god_mode")).toBe(true);
  });

  // ─── getAllFeatureFlags ───────────────────────────────────────────────────
  it("returns all flags with resolved values", () => {
    const all = getAllFeatureFlags();
    expect(all).toHaveProperty("ai_chat");
    expect(all.ai_chat).toMatchObject({ enabled: true, description: expect.any(String) });
    expect(all.god_mode).toMatchObject({ enabled: false });
  });

  it("getAllFeatureFlags reflects runtime overrides", () => {
    setFeatureFlag("god_mode", true);
    const all = getAllFeatureFlags();
    expect(all.god_mode.enabled).toBe(true);
  });

  // ─── getFeatureFlagNames ──────────────────────────────────────────────────
  it("returns all valid flag names", () => {
    const names = getFeatureFlagNames();
    expect(names).toContain("ai_chat");
    expect(names).toContain("god_mode");
    expect(names).toContain("motion_animations");
    expect(names.length).toBeGreaterThan(10);
  });
});

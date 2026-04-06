import { describe, it, expect } from "vitest";
import {
  getBuiltinSlashCommands,
  getModuleCommands,
  getCustomActionCommands,
  filterCommands,
  type CommandEntry,
} from "../../client/src/lib/commandRegistry.js";

// ─── Built-in slash command registry tests ──────────────────────────────────

describe("getBuiltinSlashCommands", () => {
  it("returns an array of slash commands", () => {
    const commands = getBuiltinSlashCommands();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  it("every command has required fields", () => {
    const commands = getBuiltinSlashCommands();
    for (const cmd of commands) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.command).toMatch(/^\//);
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
    }
  });

  it("includes /fleet and /wash commands", () => {
    const commands = getBuiltinSlashCommands();
    const ids = commands.map(c => c.id);
    expect(ids).toContain("fleet");
    expect(ids).toContain("wash");
  });

  it("includes /vehicle and /incident commands", () => {
    const commands = getBuiltinSlashCommands();
    const ids = commands.map(c => c.id);
    expect(ids).toContain("vehicle");
    expect(ids).toContain("incident");
  });

  it("has no duplicate command strings", () => {
    const commands = getBuiltinSlashCommands();
    const cmdStrings = commands.map(c => c.command);
    expect(new Set(cmdStrings).size).toBe(cmdStrings.length);
  });

  it("has no duplicate ids", () => {
    const commands = getBuiltinSlashCommands();
    const ids = commands.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Module commands ────────────────────────────────────────────────────────

describe("getModuleCommands", () => {
  const mockModules = [
    { slug: "fleet", name: "Fleet", route: "/fleet", icon: "Car", requiredRole: null, enabled: true },
    { slug: "analytics", name: "Analytics", route: "/analytics", icon: "BarChart", requiredRole: "supervisor", enabled: true },
    { slug: "disabled", name: "Disabled", route: "/disabled", icon: "X", requiredRole: null, enabled: false },
    { slug: "admin-only", name: "Admin Panel", route: "/admin", icon: "Shield", requiredRole: "admin", enabled: true },
  ];
  const mockNavigate = () => {};

  it("excludes disabled modules", () => {
    const commands = getModuleCommands(mockModules, mockNavigate, "admin");
    const ids = commands.map(c => c.id);
    expect(ids).not.toContain("module-disabled");
  });

  it("includes enabled modules for admin role", () => {
    const commands = getModuleCommands(mockModules, mockNavigate, "admin");
    const ids = commands.map(c => c.id);
    expect(ids).toContain("module-fleet");
    expect(ids).toContain("module-analytics");
    expect(ids).toContain("module-admin-only");
  });

  it("excludes admin-only modules for agent role", () => {
    const commands = getModuleCommands(mockModules, mockNavigate, "agent");
    const ids = commands.map(c => c.id);
    expect(ids).toContain("module-fleet");
    expect(ids).not.toContain("module-admin-only");
    expect(ids).not.toContain("module-analytics");
  });

  it("includes supervisor modules for supervisor role", () => {
    const commands = getModuleCommands(mockModules, mockNavigate, "supervisor");
    const ids = commands.map(c => c.id);
    expect(ids).toContain("module-analytics");
  });

  it("sets category to navigation", () => {
    const commands = getModuleCommands(mockModules, mockNavigate, "admin");
    for (const cmd of commands) {
      expect(cmd.category).toBe("navigation");
    }
  });
});

// ─── Custom action commands ─────────────────────────────────────────────────

describe("getCustomActionCommands", () => {
  const mockNavigate = () => {};

  it("maps custom actions to command entries", () => {
    const actions = [
      { id: 1, label: "Check Returns", icon: "Undo", target: "/fleet", placement: "header", config: null },
    ];
    const commands = getCustomActionCommands(actions, mockNavigate);
    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe("custom-1");
    expect(commands[0].label).toBe("Check Returns");
  });

  it("sets category to slash for slash-placed actions", () => {
    const actions = [
      { id: 2, label: "Quick Wash", icon: "Droplets", target: "/wash", placement: "slash", config: null },
    ];
    const commands = getCustomActionCommands(actions, mockNavigate);
    expect(commands[0].category).toBe("slash");
  });

  it("sets category to custom for non-slash actions", () => {
    const actions = [
      { id: 3, label: "Dashboard", icon: "Layout", target: "/", placement: "header", config: null },
    ];
    const commands = getCustomActionCommands(actions, mockNavigate);
    expect(commands[0].category).toBe("custom");
  });

  it("handles macro actions with steps config", () => {
    const actions = [
      {
        id: 4,
        label: "Morning Routine",
        icon: "List",
        target: "macro",
        placement: "header",
        config: { steps: [{ type: "navigate", target: "/fleet" }, { type: "navigate", target: "/washers" }] },
      },
    ];
    const commands = getCustomActionCommands(actions, mockNavigate);
    expect(commands).toHaveLength(1);
    // Should still produce a valid command entry
    expect(commands[0].label).toBe("Morning Routine");
  });

  it("returns empty array for empty actions", () => {
    const commands = getCustomActionCommands([], mockNavigate);
    expect(commands).toEqual([]);
  });
});

// ─── Filter commands ────────────────────────────────────────────────────────

describe("filterCommands", () => {
  const commands: CommandEntry[] = [
    { id: "1", label: "Fleet Overview", description: "View all vehicles", category: "navigation", action: () => {}, keywords: ["cars", "vehicles"] },
    { id: "2", label: "Wash Queue", description: "Active wash jobs", category: "navigation", action: () => {}, keywords: ["cleaning"] },
    { id: "3", label: "Settings", description: "App configuration", category: "navigation", action: () => {} },
  ];

  it("returns all commands for empty query", () => {
    expect(filterCommands(commands, "")).toEqual(commands);
    expect(filterCommands(commands, "  ")).toEqual(commands);
  });

  it("filters by label", () => {
    const result = filterCommands(commands, "fleet");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by description", () => {
    const result = filterCommands(commands, "vehicles");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by keywords", () => {
    const result = filterCommands(commands, "cleaning");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("is case-insensitive", () => {
    const result = filterCommands(commands, "FLEET");
    expect(result).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const result = filterCommands(commands, "zzzznotfound");
    expect(result).toHaveLength(0);
  });
});

// ─── Macro step validation ──────────────────────────────────────────────────

describe("macro step validation", () => {
  const ALLOWED_STEP_TYPES = ["navigate"] as const;
  const MAX_MACRO_STEPS = 10;

  function validateMacroSteps(steps: Array<{ type: string; target: string }>): { valid: boolean; error?: string } {
    if (!Array.isArray(steps)) return { valid: false, error: "steps must be an array" };
    if (steps.length === 0) return { valid: false, error: "macro must have at least one step" };
    if (steps.length > MAX_MACRO_STEPS) return { valid: false, error: `macro cannot exceed ${MAX_MACRO_STEPS} steps` };
    for (const step of steps) {
      if (!ALLOWED_STEP_TYPES.includes(step.type as typeof ALLOWED_STEP_TYPES[number])) {
        return { valid: false, error: `unsupported step type: ${step.type}` };
      }
      if (!step.target || typeof step.target !== "string") {
        return { valid: false, error: "each step must have a valid target" };
      }
    }
    return { valid: true };
  }

  it("accepts valid navigate steps", () => {
    expect(validateMacroSteps([{ type: "navigate", target: "/fleet" }]).valid).toBe(true);
  });

  it("accepts multiple valid steps", () => {
    expect(validateMacroSteps([
      { type: "navigate", target: "/fleet" },
      { type: "navigate", target: "/washers" },
    ]).valid).toBe(true);
  });

  it("rejects empty steps array", () => {
    expect(validateMacroSteps([]).valid).toBe(false);
  });

  it("rejects unsupported step type", () => {
    const result = validateMacroSteps([{ type: "execute_command", target: "rm -rf /" }]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("unsupported step type");
  });

  it("rejects steps exceeding max limit", () => {
    const steps = Array.from({ length: 11 }, (_, i) => ({ type: "navigate", target: `/page-${i}` }));
    const result = validateMacroSteps(steps);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cannot exceed");
  });

  it("rejects step with empty target", () => {
    const result = validateMacroSteps([{ type: "navigate", target: "" }]);
    expect(result.valid).toBe(false);
  });
});

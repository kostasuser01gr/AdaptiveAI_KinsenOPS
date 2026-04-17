/**
 * Admin Tools — User management, station management, workspace config, automation, audit.
 * These are gated to admin/supervisor roles and give the AI full platform administration capabilities.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult, ToolContext } from "../types.js";

// ─── List Users ───
toolRegistry.register({
  name: "list_users",
  description: "List all users in the workspace. Shows name, role, email, and status. Use for user management, team overview, or finding who to assign tasks to.",
  inputSchema: z.object({}),
  requiredRole: "coordinator",
  async handler(): Promise<ToolResult> {
    const users = await storage.getUsers();
    return {
      content: `${users.length} user(s) in workspace.`,
      data: users.map(u => ({ id: u.id, displayName: u.displayName, username: u.username, role: u.role })),
      uiBlock: {
        type: "data_table", title: "Users",
        columns: [
          { key: "id", label: "ID" },
          { key: "displayName", label: "Name" },
          { key: "username", label: "Username" },
          { key: "role", label: "Role" },
        ],
        rows: users.slice(0, 30).map(u => ({
          id: u.id, displayName: u.displayName, username: u.username, role: u.role,
        })),
      },
    };
  },
});

// ─── Update User Role ───
toolRegistry.register({
  name: "update_user_role",
  description: "Change a user's role. Requires admin privileges. Use when promoting, demoting, or adjusting user permissions.",
  inputSchema: z.object({
    userId: z.number().describe("User ID to update"),
    role: z.enum(["agent", "coordinator", "supervisor", "admin"]).describe("New role"),
  }),
  requiredRole: "admin",
  async handler(input): Promise<ToolResult> {
    const user = await storage.updateUser(input.userId as number, { role: input.role as string });
    if (!user) return { content: "User not found.", isError: true };
    return {
      content: `${user.displayName}'s role changed to ${user.role}.`,
      uiBlock: { type: "alert", severity: "success", title: "Role Updated", message: `${user.displayName} is now ${user.role}.` },
    };
  },
});

// ─── List Stations ───
toolRegistry.register({
  name: "list_stations",
  description: "List all stations/locations. Use for station overview, finding station IDs, or checking station assignments.",
  inputSchema: z.object({}),
  async handler(): Promise<ToolResult> {
    const stations = await storage.getStations();
    return {
      content: `${stations.length} station(s).`,
      data: stations,
      uiBlock: {
        type: "data_table", title: "Stations",
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "location", label: "Location" },
        ],
        rows: stations.map(s => ({
          id: s.id,
          name: (s as any).name ?? "—",
          location: (s as any).location ?? (s as any).address ?? "—",
        })),
      },
    };
  },
});

// ─── Create Station ───
toolRegistry.register({
  name: "create_station",
  description: "Create a new station/location.",
  inputSchema: z.object({
    name: z.string().describe("Station name"),
    code: z.string().optional().describe("Short station code (auto-generated if omitted)"),
    address: z.string().optional().describe("Address or location description"),
  }),
  requiredRole: "admin",
  async handler(input, ctx): Promise<ToolResult> {
    const station = await storage.createStation({
      workspaceId: ctx.workspaceId,
      name: input.name as string,
      code: (input.code as string) || (input.name as string).slice(0, 6).toUpperCase().replace(/\s/g, ''),
      address: input.address as string | undefined,
    });
    return {
      content: `Station "${(station as any).name}" created (ID: ${station.id}).`,
      uiBlock: { type: "alert", severity: "success", title: "Station Created", message: `Station #${station.id} "${(station as any).name}" is live.` },
    };
  },
});

// ─── Assign User to Station ───
toolRegistry.register({
  name: "assign_user_station",
  description: "Assign a user to work at a specific station, or view their current station assignments.",
  inputSchema: z.object({
    userId: z.number().describe("User ID"),
    stationIds: z.array(z.number()).describe("Station IDs to assign (replaces all current assignments)"),
  }),
  requiredRole: "supervisor",
  async handler(input, ctx): Promise<ToolResult> {
    const assignments = await storage.setUserStations(input.userId as number, input.stationIds as number[], ctx.userId);
    const user = await storage.getUser(input.userId as number);
    return {
      content: `${user?.displayName ?? `User #${input.userId}`} assigned to ${assignments.length} station(s): ${(input.stationIds as number[]).join(', ')}.`,
    };
  },
});

// ─── Workspace Config ───
toolRegistry.register({
  name: "get_workspace_config",
  description: "Read workspace configuration settings. Use to check system settings, AI config, integration URLs, or feature flags.",
  inputSchema: z.object({
    category: z.string().optional().describe("Filter by category (e.g. 'ai', 'integrations', 'features')"),
    key: z.string().optional().describe("Get a specific config key"),
  }),
  requiredRole: "supervisor",
  async handler(input): Promise<ToolResult> {
    if (input.key) {
      const entry = await storage.getWorkspaceConfigByKey(input.key as string);
      if (!entry) return { content: `Config key "${input.key}" not found.` };
      return { content: `${entry.key} = ${JSON.stringify(entry.value)}` };
    }
    const config = await storage.getWorkspaceConfig(input.category as string | undefined);
    return {
      content: `${config.length} config entries${input.category ? ` in "${input.category}"` : ""}.`,
      data: config,
      uiBlock: {
        type: "data_table", title: "Workspace Config",
        columns: [
          { key: "key", label: "Key" },
          { key: "value", label: "Value" },
          { key: "category", label: "Category" },
        ],
        rows: config.slice(0, 30).map(c => ({
          key: c.key,
          value: typeof c.value === 'string' ? c.value.slice(0, 100) : JSON.stringify(c.value).slice(0, 100),
          category: (c as any).category ?? "—",
        })),
      },
    };
  },
});

// ─── Set Workspace Config ───
toolRegistry.register({
  name: "set_workspace_config",
  description: "Update a workspace configuration setting. Use to change AI settings, feature flags, or system behavior.",
  inputSchema: z.object({
    key: z.string().describe("Config key (e.g. 'ai.max_messages_per_request')"),
    value: z.string().describe("New value (string)"),
    category: z.string().optional().describe("Category for the config entry"),
  }),
  requiredRole: "admin",
  async handler(input, ctx): Promise<ToolResult> {
    const entry = await storage.setWorkspaceConfig({
      workspaceId: ctx.workspaceId,
      key: input.key as string,
      value: input.value as string,
      category: input.category as string | undefined,
    });
    return {
      content: `Config set: ${entry.key} = ${JSON.stringify(entry.value)}.`,
      uiBlock: { type: "alert", severity: "success", title: "Config Updated", message: `${entry.key} updated.` },
    };
  },
});

// ─── Automation Rules ───
toolRegistry.register({
  name: "list_automations",
  description: "List all automation rules in the workspace. Shows trigger, action, and enabled status.",
  inputSchema: z.object({}),
  requiredRole: "coordinator",
  async handler(): Promise<ToolResult> {
    const rules = await storage.getAutomationRules();
    return {
      content: `${rules.length} automation rule(s).`,
      data: rules,
      uiBlock: {
        type: "data_table", title: "Automation Rules",
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "trigger", label: "Trigger" },
          { key: "enabled", label: "Enabled" },
        ],
        rows: rules.slice(0, 20).map(r => ({
          id: r.id,
          name: (r as any).name ?? `Rule #${r.id}`,
          trigger: (r as any).trigger ?? "—",
          enabled: (r as any).enabled !== false ? "Yes" : "No",
        })),
      },
    };
  },
});

// ─── Toggle Automation ───
toolRegistry.register({
  name: "toggle_automation",
  description: "Enable or disable an automation rule.",
  inputSchema: z.object({
    ruleId: z.number().describe("Automation rule ID"),
    enabled: z.boolean().describe("Enable (true) or disable (false)"),
  }),
  requiredRole: "supervisor",
  async handler(input): Promise<ToolResult> {
    const rule = await storage.updateAutomationRule(input.ruleId as number, { active: input.enabled as boolean });
    if (!rule) return { content: "Automation rule not found.", isError: true };
    return {
      content: `Automation #${rule.id} ${input.enabled ? "enabled" : "disabled"}.`,
      uiBlock: { type: "alert", severity: "success", title: `Automation ${input.enabled ? "Enabled" : "Disabled"}`, message: `Rule #${rule.id} is now ${input.enabled ? "active" : "inactive"}.` },
    };
  },
});

// ─── Audit Log ───
toolRegistry.register({
  name: "view_audit_log",
  description: "View the audit log — recent actions taken in the system. Use for compliance, investigating what happened, or reviewing changes.",
  inputSchema: z.object({
    limit: z.number().optional().describe("Number of entries (default 20, max 100)"),
  }),
  requiredRole: "supervisor",
  async handler(input): Promise<ToolResult> {
    const limit = Math.min((input.limit as number) || 20, 100);
    const log = await storage.getAuditLog(limit);
    return {
      content: `${log.length} recent audit entries.`,
      data: log,
      uiBlock: {
        type: "data_table", title: "Audit Log",
        columns: [
          { key: "action", label: "Action" },
          { key: "userId", label: "User" },
          { key: "entityType", label: "Entity" },
          { key: "createdAt", label: "Time" },
        ],
        rows: log.slice(0, 20).map(e => ({
          action: (e as any).action ?? "—",
          userId: (e as any).userId ?? "—",
          entityType: (e as any).entityType ?? "—",
          createdAt: e.createdAt ? new Date(e.createdAt).toLocaleString() : "—",
        })),
      },
    };
  },
});

// ─── Activity Feed ───
toolRegistry.register({
  name: "get_activity_feed",
  description: "Get the recent activity feed — system-wide event stream showing what happened recently.",
  inputSchema: z.object({
    limit: z.number().optional().describe("Number of entries (default 15)"),
  }),
  async handler(input): Promise<ToolResult> {
    const limit = Math.min((input.limit as number) || 15, 50);
    const feed = await storage.getActivityFeed(limit);
    return {
      content: `${feed.length} recent activities.`,
      data: feed,
      uiBlock: {
        type: "data_table", title: "Activity Feed",
        columns: [
          { key: "type", label: "Type" },
          { key: "message", label: "Activity" },
          { key: "createdAt", label: "Time" },
        ],
        rows: feed.map(e => ({
          type: (e as any).type ?? "—",
          message: (e as any).message?.slice(0, 80) ?? "—",
          createdAt: e.createdAt ? new Date(e.createdAt).toLocaleString() : "—",
        })),
      },
    };
  },
});

// ─── Workspace Memory: Write ───
toolRegistry.register({
  name: "save_workspace_memory",
  description: "Save a fact, preference, or context to workspace memory. The AI can recall this later. Use to remember user preferences, business rules, SOPs, or any persistent information.",
  inputSchema: z.object({
    key: z.string().describe("Short label for the memory entry (e.g. 'sla_policy', 'preferred_wash_type')"),
    value: z.string().describe("The content to remember"),
    category: z.string().optional().describe("Category: preference, policy, sop, context, other"),
    confidence: z.number().optional().describe("Confidence 0-10 (default 5)"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const entry = await storage.createWorkspaceMemory({
      workspaceId: ctx.workspaceId,
      key: input.key as string,
      value: input.value as string,
      category: (input.category as string) || "context",
      confidence: (input.confidence as number) ?? 5,
      source: "ai_chat",
    });
    return {
      content: `Saved to workspace memory: "${entry.key}" = "${entry.value.slice(0, 80)}".`,
      uiBlock: { type: "alert", severity: "success", title: "Memory Saved", message: `"${entry.key}" stored. I'll remember this.` },
    };
  },
});

// ─── Custom Actions: Create ───
toolRegistry.register({
  name: "create_custom_action",
  description: "Create a custom shortcut button in the header or sidebar. Use when the user asks to add quick actions, shortcuts, or navigation buttons.",
  inputSchema: z.object({
    label: z.string().describe("Button label"),
    icon: z.string().optional().describe("Icon name (e.g. 'Zap', 'Car', 'Shield')"),
    target: z.string().describe("Navigation route (e.g. '/fleet', '/analytics')"),
    placement: z.string().optional().describe("Where to show: header, sidebar, slash"),
  }),
  async handler(input, ctx): Promise<ToolResult> {
    const action = await storage.createCustomAction({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      label: input.label as string,
      icon: (input.icon as string) || "Zap",
      target: input.target as string,
      placement: (input.placement as string) || "header",
      active: true,
    });
    return {
      content: `Custom action "${action.label}" created → ${action.target}.`,
      uiBlock: { type: "alert", severity: "success", title: "Shortcut Added", message: `"${action.label}" is now available in the ${(input.placement as string) || "header"}.` },
    };
  },
});

// ─── System Policies ───
toolRegistry.register({
  name: "list_system_policies",
  description: "List system policies — organizational rules, SLA definitions, compliance requirements.",
  inputSchema: z.object({
    category: z.string().optional().describe("Filter by category"),
  }),
  requiredRole: "supervisor",
  async handler(input): Promise<ToolResult> {
    const policies = await storage.getSystemPolicies(input.category as string | undefined);
    return {
      content: `${policies.length} system policies.`,
      data: policies,
      uiBlock: {
        type: "data_table", title: "System Policies",
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Policy" },
          { key: "category", label: "Category" },
          { key: "enabled", label: "Active" },
        ],
        rows: policies.map(p => ({
          id: p.id,
          name: (p as any).name ?? "—",
          category: (p as any).category ?? "—",
          enabled: (p as any).enabled !== false ? "Yes" : "No",
        })),
      },
    };
  },
});

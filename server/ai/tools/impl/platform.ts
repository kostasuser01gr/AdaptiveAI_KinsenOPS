/**
 * Platform Tools — Notifications, users, workspace memory.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── Notifications ───
toolRegistry.register({
  name: "list_notifications",
  description: "List the user's notifications. Use when asked about alerts, unread messages, or what needs attention.",
  inputSchema: z.object({
    limit: z.number().optional().describe("Max to return (default 10)"),
  }),
  async handler(input, ctx): Promise<ToolResult> {
    const notifications = await storage.getNotifications(ctx.userId, ctx.userRole);
    const limited = notifications.slice(0, (input.limit as number) || 10);
    const stats = await storage.getNotificationStats(ctx.userId, ctx.userRole);

    return {
      content: `You have ${(stats as any).unread ?? 0} unread notification(s) out of ${notifications.length} total.`,
      data: { notifications: limited, stats },
      uiBlock: {
        type: "data_table",
        title: "Notifications",
        columns: [
          { key: "type", label: "Type" },
          { key: "title", label: "Title" },
          { key: "createdAt", label: "Time" },
        ],
        rows: limited.map((n) => ({
          id: n.id,
          type: (n as any).type ?? "info",
          title: (n as any).title ?? (n as any).message?.slice(0, 60) ?? "—",
          createdAt: n.createdAt ? new Date(n.createdAt).toLocaleString() : "—",
        })),
      },
    };
  },
});

// ─── Mark Notifications Read ───
toolRegistry.register({
  name: "mark_notifications_read",
  description: "Mark all notifications as read for the current user. Use when asked to clear or dismiss notifications.",
  inputSchema: z.object({}),
  async handler(_input, ctx): Promise<ToolResult> {
    await storage.markAllNotificationsRead(ctx.userId, ctx.userRole);
    return {
      content: "All notifications marked as read.",
      uiBlock: {
        type: "alert",
        severity: "success",
        title: "Done",
        message: "All notifications have been marked as read.",
      },
    };
  },
});

// ─── Workspace Memory ───
toolRegistry.register({
  name: "get_workspace_memory",
  description: "Retrieve workspace memory entries — stored facts and context that persist across conversations. Use when asked about workspace settings, saved context, or recalled information.",
  inputSchema: z.object({
    query: z.string().optional().describe("Search/filter keyword"),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const memory = await storage.getWorkspaceMemory();
    let filtered = memory;
    if (input.query) {
      const q = (input.query as string).toLowerCase();
      filtered = memory.filter(
        (m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)
      );
    }
    return {
      content: `Found ${filtered.length} memory entries${input.query ? ` matching "${input.query}"` : ""}.`,
      data: filtered,
      uiBlock: {
        type: "data_table",
        title: "Workspace Memory",
        columns: [
          { key: "key", label: "Key" },
          { key: "value", label: "Value" },
          { key: "confidence", label: "Confidence", align: "right" },
        ],
        rows: filtered.slice(0, 15).map((m) => ({
          key: m.key,
          value: m.value.slice(0, 100),
          confidence: m.confidence,
        })),
      },
    };
  },
});

// ─── Executive Briefing ───
toolRegistry.register({
  name: "get_latest_briefing",
  description: "Get the most recent executive briefing summary. Use when asked for a high-level situation report or executive overview.",
  inputSchema: z.object({}),
  requiredRole: "supervisor",
  requiredCapability: "briefing_generate",
  async handler(): Promise<ToolResult> {
    const briefings = await storage.getExecutiveBriefings(1);
    if (briefings.length === 0) {
      return { content: "No executive briefings available yet." };
    }
    const brief = briefings[0];
    return {
      content: `Latest briefing (${brief.createdAt ? new Date(brief.createdAt).toLocaleDateString() : "recent"}): ${(brief as any).summary?.slice(0, 200) ?? "Available in full view."}`,
      data: brief,
    };
  },
});

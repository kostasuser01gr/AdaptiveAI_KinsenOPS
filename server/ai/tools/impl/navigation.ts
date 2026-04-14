/**
 * Navigation & UI Tools — Navigate UI, show widgets, create forms.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import type { ToolResult } from "../types.js";

// ─── Navigate ───
toolRegistry.register({
  name: "navigate",
  description: "Navigate the user to a specific page in the application. Use when the user asks to go to a page, view a section, or open a specific part of the UI.",
  inputSchema: z.object({
    path: z.string().describe("The route path (e.g. '/fleet', '/washers', '/analytics', '/calendar', '/incidents', '/settings')"),
    label: z.string().optional().describe("Description of where we're navigating to"),
  }),
  async handler(input): Promise<ToolResult> {
    return {
      content: `Navigating to ${input.label || input.path}.`,
      uiBlock: {
        type: "navigate",
        path: input.path as string,
        label: input.label as string | undefined,
      },
    };
  },
});

// ─── Show Widget ───
toolRegistry.register({
  name: "show_widget",
  description: "Display a dashboard widget inline in the chat. Available widgets: FleetStatus, WashQueue, KpiCard, ActivityFeed, StationPerformance, VehicleTimeline, IncidentTracker, ShiftCalendar, WeatherWidget, QuickActions, RecentAlerts, TeamStatus, MapView, SLATracker, CapacityPlanner, RevenueChart.",
  inputSchema: z.object({
    widget: z.string().describe("Widget slug from the available list"),
    config: z.record(z.string(), z.unknown()).optional().describe("Optional widget configuration"),
  }),
  async handler(input): Promise<ToolResult> {
    return {
      content: `Displaying ${input.widget} widget.`,
      uiBlock: {
        type: "widget",
        slug: input.widget as string,
        name: input.widget as string,
        config: input.config as Record<string, unknown> | undefined,
      },
    };
  },
});

// ─── Show Confirmation ───
toolRegistry.register({
  name: "confirm_action",
  description: "Show a confirmation dialog before performing a destructive or important action. Use before deleting, resetting, or making significant changes.",
  inputSchema: z.object({
    title: z.string().describe("Confirmation dialog title"),
    message: z.string().describe("What the user is confirming"),
    confirmTool: z.string().describe("Tool to call if confirmed"),
    confirmParams: z.record(z.string(), z.unknown()).describe("Parameters for the confirm tool"),
    variant: z.enum(["default", "destructive"]).optional().describe("Visual style"),
  }),
  async handler(input): Promise<ToolResult> {
    return {
      content: `Asking for confirmation: ${input.title}`,
      uiBlock: {
        type: "confirmation",
        title: input.title as string,
        message: input.message as string,
        confirmTool: input.confirmTool as string,
        confirmParams: input.confirmParams as Record<string, unknown>,
        variant: (input.variant as "default" | "destructive") ?? "default",
      },
    };
  },
});

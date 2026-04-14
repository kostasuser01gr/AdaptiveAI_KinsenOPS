/**
 * Analytics & KPI Tools — Dashboard stats, trends, KPIs, anomalies.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── Dashboard Stats ───
toolRegistry.register({
  name: "get_dashboard_stats",
  description: "Get high-level dashboard statistics: vehicle count, active washes, open incidents, and other KPIs. Use when asked for an overview or 'how are things going'.",
  inputSchema: z.object({}),
  async handler(): Promise<ToolResult> {
    const stats = await storage.getDashboardStats();
    const entries = Object.entries(stats as Record<string, unknown>);
    return {
      content: `Dashboard: ${entries.map(([k, v]) => `${k}=${v}`).join(", ")}.`,
      data: stats,
      uiBlock: {
        type: "metric_grid",
        metrics: entries
          .filter(([, v]) => typeof v === "number" || typeof v === "string")
          .slice(0, 8)
          .map(([k, v]) => ({
            label: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            value: v as string | number,
          })),
      },
    };
  },
});

// ─── Analytics Summary ───
toolRegistry.register({
  name: "get_analytics_summary",
  description: "Get a detailed analytics summary with performance metrics. Use for deeper analysis beyond the basic dashboard.",
  inputSchema: z.object({}),
  async handler(): Promise<ToolResult> {
    const summary = await storage.getAnalyticsSummary();
    return {
      content: `Analytics summary retrieved with ${Object.keys(summary as Record<string, unknown>).length} metric categories.`,
      data: summary,
    };
  },
});

// ─── Trends ───
toolRegistry.register({
  name: "get_analytics_trends",
  description: "Get trend data for the past N days. Returns data points suitable for charting. Use when asked about trends, patterns, or historical performance.",
  inputSchema: z.object({
    days: z.number().optional().describe("Number of days to look back (default 7, max 90)"),
  }),
  async handler(input): Promise<ToolResult> {
    const days = Math.min((input.days as number) || 7, 90);
    const trends = await storage.getAnalyticsTrends(days);
    return {
      content: `Retrieved ${trends.length} trend data points for the last ${days} days.`,
      data: trends,
      uiBlock: trends.length > 0
        ? {
            type: "chart",
            chartType: "line",
            title: `Trends (last ${days} days)`,
            data: trends as Record<string, unknown>[],
            xKey: "date",
            yKey: "value",
            yLabel: "Count",
          }
        : undefined,
    };
  },
});

// ─── KPI Snapshots ───
toolRegistry.register({
  name: "get_kpi_snapshots",
  description: "Get KPI snapshot data over time for a specific KPI metric. Use for tracking specific performance indicators.",
  inputSchema: z.object({
    slug: z.string().describe("The KPI slug (e.g. 'fleet_readiness', 'avg_wash_time')"),
    from: z.string().optional().describe("Start date (ISO format)"),
    to: z.string().optional().describe("End date (ISO format)"),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const snapshots = await storage.getKpiSnapshots(
      input.slug as string,
      input.from as string | undefined,
      input.to as string | undefined,
    );
    const definition = await storage.getKpiDefinition(input.slug as string);
    const label = definition ? (definition as any).name ?? input.slug : input.slug;
    return {
      content: `KPI "${label}": ${snapshots.length} data point(s) found.`,
      data: { definition, snapshots },
      uiBlock: snapshots.length > 0
        ? {
            type: "chart",
            chartType: "line",
            title: label as string,
            data: snapshots.map((s) => ({
              date: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
              value: (s as any).value ?? 0,
            })),
            xKey: "date",
            yKey: "value",
          }
        : undefined,
    };
  },
});

// ─── Anomalies ───
toolRegistry.register({
  name: "list_anomalies",
  description: "List detected anomalies, optionally filtered. Use when asked about unusual patterns, alerts, or things that need attention.",
  inputSchema: z.object({
    status: z.string().optional().describe("Filter: new, acknowledged, resolved"),
    type: z.string().optional().describe("Filter by anomaly type"),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const anomalies = await storage.getAnomalies({
      status: input.status as string | undefined,
      type: input.type as string | undefined,
    });
    return {
      content: `Found ${anomalies.length} anomaly(ies).`,
      data: anomalies,
      uiBlock: {
        type: "data_table",
        title: "Anomalies",
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "message", label: "Description" },
        ],
        rows: anomalies.slice(0, 15).map((a) => ({
          id: a.id,
          type: (a as any).type ?? "—",
          status: (a as any).status ?? "—",
          message: (a as any).message?.slice(0, 80) ?? "—",
        })),
      },
    };
  },
});

// ─── Search Entities ───
toolRegistry.register({
  name: "search",
  description: "Search across all entities (vehicles, users, incidents, etc.) by keyword. Use when the user is looking for something specific but doesn't know the exact ID or where it is.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  async handler(input): Promise<ToolResult> {
    const results = await storage.searchEntities(input.query as string);
    return {
      content: `Found ${results.length} result(s) for "${input.query}".`,
      data: results,
      uiBlock: results.length > 0
        ? {
            type: "data_table",
            title: `Search: "${input.query}"`,
            columns: [
              { key: "type", label: "Type" },
              { key: "id", label: "ID" },
              { key: "title", label: "Title" },
              { key: "subtitle", label: "Details" },
            ],
            rows: results.slice(0, 15).map((r) => ({
              type: (r as any).type ?? "—",
              id: (r as any).id ?? "—",
              title: (r as any).title ?? "—",
              subtitle: (r as any).subtitle ?? "—",
            })),
          }
        : {
            type: "alert",
            severity: "info",
            title: "No Results",
            message: `No results found for "${input.query}".`,
          },
    };
  },
});

/**
 * Generative UI Tools — compose_dashboard + drill_down.
 * These tools enable the AI to compose full interactive dashboard views
 * and drill into individual widgets for deeper analysis.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult, ToolContext, UIBlock } from "../types.js";

// Helper to emit pipeline progress events
function pipeline(ctx: ToolContext, step: string, status: "running" | "done" | "error", detail?: string) {
  ctx.emitEvent?.({ type: "pipeline_step", step, status, detail });
}

// ─── Compose Dashboard ───
toolRegistry.register({
  name: "compose_dashboard",
  description: `Compose a full generative dashboard view with multiple widgets, charts, tables, and metrics arranged in a grid layout.
Use this when the user asks for an overview, report, dashboard, analytics summary, or any multi-faceted data view.
You MUST provide the complete widget array with block data already populated from other tool results or your knowledge.
Each widget has a grid position (x,y,w,h on a 12-column grid), a title, and a nested block (metric_grid, recharts, data_table, entity_card, etc).`,
  inputSchema: z.object({
    title: z.string().describe("Dashboard title, e.g. 'Fleet Status Overview'"),
    subtitle: z.string().optional().describe("Short subtitle or context"),
    filters: z.array(z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      options: z.array(z.string()).optional(),
    })).optional().describe("Filter pills shown above the dashboard"),
    widgets: z.array(z.object({
      id: z.string().describe("Unique widget ID"),
      title: z.string().describe("Widget heading"),
      x: z.number().describe("Grid column (0-11)"),
      y: z.number().describe("Grid row"),
      w: z.number().describe("Width in columns (1-12)"),
      h: z.number().describe("Height in row units"),
      blockType: z.string().describe("The UIBlock type for this widget: metric_grid, recharts, data_table, entity_card, alert, status_timeline, heatmap_table"),
      blockData: z.record(z.string(), z.unknown()).describe("The complete block data object (all fields for the chosen blockType)"),
      drillDownPrompt: z.string().optional().describe("Prompt for AI drill-down on this widget"),
    })).describe("Array of widget definitions with grid positions and block data"),
    insights: z.array(z.object({
      text: z.string(),
      severity: z.enum(["info", "warning", "success"]).optional(),
    })).optional().describe("Key insights to highlight above the grid"),
    dataSources: z.array(z.string()).optional().describe("List of tools/data sources used, for pipeline transparency"),
  }),
  requiredRole: "agent",
  async handler(input, ctx): Promise<ToolResult> {
    pipeline(ctx, "Building layout", "running", `Composing ${(input.widgets as any[]).length} widgets`);

    // Construct the dashboard_view UIBlock
    const widgets = (input.widgets as any[]).map((w) => ({
      id: w.id,
      title: w.title,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      block: { type: w.blockType, ...w.blockData } as UIBlock,
      drillDownPrompt: w.drillDownPrompt,
    }));

    pipeline(ctx, "Building layout", "done");
    pipeline(ctx, "Rendering", "running");

    const dashboardView: UIBlock = {
      type: "dashboard_view",
      title: input.title as string,
      subtitle: input.subtitle as string | undefined,
      generatedAt: new Date().toISOString(),
      filters: input.filters as any,
      widgets,
      insights: input.insights as any,
    };

    pipeline(ctx, "Rendering", "done");

    return {
      content: `Generated dashboard "${input.title}" with ${widgets.length} widget(s).`,
      data: { widgetCount: widgets.length },
      uiBlock: dashboardView,
    };
  },
});

// ─── Drill Down ───
toolRegistry.register({
  name: "drill_down",
  description: `Perform a deep drill-down analysis on a specific dataset or widget context.
Use when the user clicks "AI drill down" on a dashboard widget or asks to explore a metric in detail.
Returns a focused analysis with a chart or table.`,
  inputSchema: z.object({
    topic: z.string().describe("What to drill into, e.g. 'overdue washes by station' or 'vehicle utilization trend'"),
    context: z.string().optional().describe("Additional context from the parent widget or dashboard"),
    preferredChartType: z.enum(["line", "bar", "area", "pie", "donut", "stacked_bar", "data_table", "heatmap_table"]).optional()
      .describe("Preferred visualization type for the drill-down result"),
  }),
  requiredRole: "agent",
  async handler(input, ctx): Promise<ToolResult> {
    pipeline(ctx, "Analyzing", "running", input.topic as string);

    // The AI itself will look up data using other tools before calling this.
    // This tool serves as the "present drill-down results" final step.
    // In a real pipeline, we'd fetch data here. For now, this is a pass-through
    // that returns a structured result the AI fills via its tool-use reasoning.

    pipeline(ctx, "Analyzing", "done");

    return {
      content: `Drill-down analysis for: "${input.topic}". Use the appropriate query tools to fetch data, then compose results using recharts or data_table blocks.`,
      data: { topic: input.topic, context: input.context },
    };
  },
});

// ─── Quick Chart ───
// Convenience tool: AI can render a single rich chart without composing a full dashboard
toolRegistry.register({
  name: "render_chart",
  description: `Render a single rich chart (line, bar, area, pie, donut, radial, stacked_bar, scatter, composed).
Use this instead of the old 'chart' block type when you need real Recharts rendering with multiple series, legends, tooltips, and grid.
For multiple charts in a grid layout, use compose_dashboard instead.`,
  inputSchema: z.object({
    chartType: z.enum(["line", "bar", "area", "pie", "donut", "radial", "scatter", "stacked_bar", "composed"]),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    data: z.array(z.record(z.string(), z.unknown())).describe("Array of data points"),
    xKey: z.string().describe("Key for X-axis values"),
    series: z.array(z.object({
      dataKey: z.string(),
      label: z.string(),
      color: z.string(),
      type: z.enum(["line", "bar", "area"]).optional(),
      stackId: z.string().optional(),
    })).describe("Data series to plot"),
    showGrid: z.boolean().optional(),
    showLegend: z.boolean().optional(),
    showTooltip: z.boolean().optional(),
    innerRadius: z.number().optional().describe("Inner radius for donut charts"),
    height: z.number().optional().describe("Chart height in pixels"),
  }),
  requiredRole: "agent",
  async handler(input, _ctx): Promise<ToolResult> {
    const chart: UIBlock = {
      type: "recharts",
      chartType: input.chartType as any,
      title: input.title as string | undefined,
      subtitle: input.subtitle as string | undefined,
      data: input.data as Record<string, unknown>[],
      xKey: input.xKey as string,
      series: input.series as any,
      showGrid: input.showGrid as boolean | undefined,
      showLegend: input.showLegend as boolean | undefined,
      showTooltip: input.showTooltip as boolean | undefined,
      innerRadius: input.innerRadius as number | undefined,
      height: input.height as number | undefined,
    };

    return {
      content: `Rendered ${input.chartType} chart${input.title ? `: "${input.title}"` : ""} with ${(input.series as any[]).length} series and ${(input.data as any[]).length} data points.`,
      uiBlock: chart,
    };
  },
});

// ─── Render Heatmap ───
toolRegistry.register({
  name: "render_heatmap",
  description: `Render a heatmap table visualization. Good for showing patterns across two dimensions (e.g. day-of-week × hour, station × metric, month × category).`,
  inputSchema: z.object({
    title: z.string().optional(),
    rowHeaders: z.array(z.string()).describe("Labels for rows"),
    colHeaders: z.array(z.string()).describe("Labels for columns"),
    data: z.array(z.array(z.number())).describe("2D number array [rows][cols]"),
    minColor: z.string().optional().describe("Hex color for minimum value"),
    maxColor: z.string().optional().describe("Hex color for maximum value"),
    valueFormatter: z.enum(["percent", "currency"]).optional(),
  }),
  requiredRole: "agent",
  async handler(input, _ctx): Promise<ToolResult> {
    const heatmap: UIBlock = {
      type: "heatmap_table",
      title: input.title as string | undefined,
      rowHeaders: input.rowHeaders as string[],
      colHeaders: input.colHeaders as string[],
      data: input.data as number[][],
      minColor: input.minColor as string | undefined,
      maxColor: input.maxColor as string | undefined,
      valueFormatter: input.valueFormatter as string | undefined,
    };

    return {
      content: `Rendered heatmap${input.title ? ` "${input.title}"` : ""}: ${(input.rowHeaders as string[]).length} rows × ${(input.colHeaders as string[]).length} columns.`,
      uiBlock: heatmap,
    };
  },
});

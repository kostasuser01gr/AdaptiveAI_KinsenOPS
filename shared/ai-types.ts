/**
 * Shared AI type definitions — UIBlock protocol, SSE events, and metadata.
 * Single source of truth used by both server and client.
 */

// ─── UIBlock Discriminated Union ─────────────────────────────────────────────

export interface MetricItem {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  changePercent?: number;
  icon?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

export interface TableRowAction {
  label: string;
  toolName: string;
  params: Record<string, unknown>;
  variant?: "default" | "destructive" | "outline";
  icon?: string;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "checkbox" | "date";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string | number | boolean;
}

export type UIBlock =
  | {
      type: "metric_grid";
      metrics: MetricItem[];
    }
  | {
      type: "data_table";
      title?: string;
      columns: TableColumn[];
      rows: Record<string, unknown>[];
      actions?: TableRowAction[];
    }
  | {
      type: "entity_card";
      entityType: string;
      entityId: string | number;
      title: string;
      subtitle?: string;
      status?: string;
      statusColor?: "green" | "yellow" | "red" | "blue" | "gray";
      fields: Array<{ label: string; value: string | number }>;
    }
  | {
      type: "form";
      formId: string;
      title: string;
      description?: string;
      fields: FormField[];
      submitTool: string;
      submitParams?: Record<string, unknown>;
      submitLabel?: string;
    }
  | {
      type: "action_panel";
      title?: string;
      actions: Array<{
        label: string;
        toolName: string;
        params: Record<string, unknown>;
        variant?: "default" | "destructive" | "outline";
        icon?: string;
        requireConfirm?: boolean;
      }>;
    }
  | {
      type: "status_timeline";
      title?: string;
      steps: Array<{
        label: string;
        status: "pending" | "active" | "complete" | "error";
        description?: string;
        timestamp?: string;
      }>;
    }
  | {
      type: "confirmation";
      title: string;
      message: string;
      confirmTool: string;
      confirmParams: Record<string, unknown>;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "default" | "destructive";
    }
  | {
      type: "chart";
      chartType: "line" | "bar" | "pie";
      title?: string;
      data: Record<string, unknown>[];
      xKey: string;
      yKey: string;
      yLabel?: string;
    }
  | {
      type: "alert";
      severity: "info" | "warning" | "error" | "success";
      title: string;
      message: string;
    }
  | {
      type: "navigate";
      path: string;
      label?: string;
    }
  | {
      type: "widget";
      slug: string;
      name: string;
      config?: Record<string, unknown>;
    }
  | {
      type: "recharts";
      chartType: "line" | "bar" | "area" | "pie" | "donut" | "radial" | "scatter" | "stacked_bar" | "composed";
      title?: string;
      subtitle?: string;
      data: Record<string, unknown>[];
      xKey: string;
      series: Array<{
        dataKey: string;
        label: string;
        color: string;
        type?: "line" | "bar" | "area";
        stackId?: string;
      }>;
      showGrid?: boolean;
      showLegend?: boolean;
      showTooltip?: boolean;
      innerRadius?: number;
      height?: number;
    }
  | {
      type: "heatmap_table";
      title?: string;
      rowHeaders: string[];
      colHeaders: string[];
      data: number[][];
      minColor?: string;
      maxColor?: string;
      valueFormatter?: string;
    }
  | {
      type: "dashboard_view";
      title: string;
      subtitle?: string;
      generatedAt: string;
      filters?: Array<{ key: string; label: string; value: string; options?: string[] }>;
      widgets: Array<{
        id: string;
        title: string;
        x: number;
        y: number;
        w: number;
        h: number;
        block: UIBlock;
        drillDownPrompt?: string;
      }>;
      insights?: Array<{ icon?: string; text: string; severity?: "info" | "warning" | "success" }>;
    };

// ─── SSE Event Types ─────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; toolUseId: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; name: string; result: string; uiBlock?: UIBlock; isError?: boolean }
  | { type: "ui_block"; block: UIBlock }
  | { type: "pipeline_step"; step: string; status: "running" | "done" | "error"; detail?: string }
  | { type: "done" }
  | { type: "error"; message: string };

// ─── Message Metadata ────────────────────────────────────────────────────────

export interface MessageMetadata {
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result: string;
    uiBlock?: UIBlock;
    isError?: boolean;
    durationMs?: number;
  }>;
  uiBlocks?: UIBlock[];
  suggestions?: string[];
  model?: string;
}

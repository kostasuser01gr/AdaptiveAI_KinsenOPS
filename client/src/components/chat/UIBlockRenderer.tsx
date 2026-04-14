/**
 * UIBlock Renderer — Renders server-generated UI blocks in the chat conversation.
 * Each block type maps to a shadcn/ui component composition.
 */
import React, { useState } from "react";
import type { UIBlock } from "@shared/ai-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { RenderWidget } from "@/components/widgets";
import { useLocation } from "wouter";
import { RechartsBlock } from "./RechartsBlock";
import { GenerativeViewRenderer } from "./GenerativeViewRenderer";
import { HeatmapTableBlock } from "./HeatmapTableBlock";

interface UIBlockRendererProps {
  block: UIBlock;
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void;
  onDrillDown?: (prompt: string) => void;
}

// ─── Metric Grid ───
function MetricGrid({ block }: { block: Extract<UIBlock, { type: "metric_grid" }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {block.metrics.map((m, i) => (
        <Card key={i} className="p-3">
          <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{m.value}</span>
            {m.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
            {m.trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
            {m.trend === "flat" && <Minus className="w-4 h-4 text-muted-foreground" />}
            {m.changePercent != null && (
              <span className={`text-xs ${m.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                {m.changePercent > 0 ? "+" : ""}{m.changePercent}%
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Data Table ───
function DataTable({ block, onToolCall }: { block: Extract<UIBlock, { type: "data_table" }>; onToolCall?: UIBlockRendererProps["onToolCall"] }) {
  return (
    <div className="rounded-md border overflow-hidden">
      {block.title && (
        <div className="px-4 py-2 bg-muted/50 border-b text-sm font-medium">{block.title}</div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {block.columns.map((col) => (
                <TableHead key={col.key} className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}>
                  {col.label}
                </TableHead>
              ))}
              {block.actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, i) => (
              <TableRow key={i}>
                {block.columns.map((col) => (
                  <TableCell key={col.key} className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}>
                    {String(row[col.key] ?? "—")}
                  </TableCell>
                ))}
                {block.actions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {block.actions.map((action, j) => (
                        <Button
                          key={j}
                          size="sm"
                          variant={(action.variant as "default" | "outline" | "destructive") ?? "outline"}
                          onClick={() => onToolCall?.(action.toolName, { ...action.params, ...row })}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Entity Card ───
function EntityCard({ block }: { block: Extract<UIBlock, { type: "entity_card" }> }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{block.title}</CardTitle>
            {block.subtitle && <CardDescription>{block.subtitle}</CardDescription>}
          </div>
          {block.status && (
            <Badge className={colorMap[block.statusColor ?? "gray"]}>{block.status}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {block.fields.map((f, i) => (
            <div key={i}>
              <div className="text-xs text-muted-foreground">{f.label}</div>
              <div className="text-sm font-medium">{String(f.value)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Form ───
function FormBlock({ block, onToolCall }: { block: Extract<UIBlock, { type: "form" }>; onToolCall?: UIBlockRendererProps["onToolCall"] }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    block.fields.forEach((f) => {
      if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
    });
    return init;
  });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    onToolCall?.(block.submitTool, { ...block.submitParams, ...values });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{block.title}</CardTitle>
        {block.description && <CardDescription>{block.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {block.fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <Label htmlFor={`form-${block.formId}-${field.name}`}>{field.label}</Label>
              {field.type === "text" || field.type === "number" || field.type === "date" ? (
                <Input
                  id={`form-${block.formId}-${field.name}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={String(values[field.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                />
              ) : field.type === "textarea" ? (
                <Textarea
                  id={`form-${block.formId}-${field.name}`}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={String(values[field.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              ) : field.type === "select" ? (
                <Select
                  value={String(values[field.name] ?? "")}
                  onValueChange={(val) => setValues((v) => ({ ...v, [field.name]: val }))}
                >
                  <SelectTrigger id={`form-${block.formId}-${field.name}`}>
                    <SelectValue placeholder={field.placeholder ?? "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`form-${block.formId}-${field.name}`}
                    checked={!!values[field.name]}
                    onCheckedChange={(checked) => setValues((v) => ({ ...v, [field.name]: !!checked }))}
                  />
                </div>
              ) : null}
            </div>
          ))}
          <Button type="submit" disabled={submitted}>
            {submitted && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {block.submitLabel ?? "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Action Panel ───
function ActionPanel({ block, onToolCall }: { block: Extract<UIBlock, { type: "action_panel" }>; onToolCall?: UIBlockRendererProps["onToolCall"] }) {
  return (
    <Card>
      {block.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{block.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-wrap gap-2">
        {block.actions.map((action, i) => (
          <Button
            key={i}
            variant={(action.variant as "default" | "outline" | "destructive") ?? "default"}
            size="sm"
            onClick={() => onToolCall?.(action.toolName, action.params)}
          >
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Status Timeline ───
function StatusTimeline({ block }: { block: Extract<UIBlock, { type: "status_timeline" }> }) {
  const statusIcons: Record<string, React.ReactNode> = {
    pending: <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" />,
    active: <Loader2 className="w-3 h-3 animate-spin text-blue-500" />,
    complete: <CheckCircle2 className="w-3 h-3 text-green-500" />,
    error: <XCircle className="w-3 h-3 text-red-500" />,
  };
  return (
    <Card>
      {block.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{block.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {block.steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="mt-1">{statusIcons[step.status] ?? statusIcons.pending}</div>
              <div>
                <div className="text-sm font-medium">{step.label}</div>
                {step.description && <div className="text-xs text-muted-foreground">{step.description}</div>}
                {step.timestamp && <div className="text-xs text-muted-foreground">{step.timestamp}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Confirmation ───
function Confirmation({ block, onToolCall }: { block: Extract<UIBlock, { type: "confirmation" }>; onToolCall?: UIBlockRendererProps["onToolCall"] }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Card className={block.variant === "destructive" ? "border-red-500/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{block.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{block.message}</p>
        <div className="flex gap-2">
          <Button
            variant={block.variant === "destructive" ? "destructive" : "default"}
            size="sm"
            disabled={confirmed}
            onClick={() => {
              setConfirmed(true);
              onToolCall?.(block.confirmTool, block.confirmParams);
            }}
          >
            {confirmed && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {block.confirmLabel ?? "Confirm"}
          </Button>
          {!confirmed && (
            <Button variant="outline" size="sm">
              {block.cancelLabel ?? "Cancel"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Simple Chart (table-based fallback) ───
function ChartBlock({ block }: { block: Extract<UIBlock, { type: "chart" }> }) {
  // Simple bar representation using CSS widths
  const maxVal = Math.max(...block.data.map((d) => Number(d[block.yKey]) || 0), 1);
  return (
    <Card>
      {block.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{block.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-2">
          {block.data.slice(0, 20).map((d, i) => {
            const val = Number(d[block.yKey]) || 0;
            const pct = (val / maxVal) * 100;
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-20 truncate text-muted-foreground">{String(d[block.xKey] ?? "")}</span>
                <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-sm" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums">{val}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Alert ───
function AlertBlock({ block }: { block: Extract<UIBlock, { type: "alert" }> }) {
  const icons: Record<string, React.ReactNode> = {
    info: <Info className="w-4 h-4 text-blue-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  };
  const bgColors: Record<string, string> = {
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    warning: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    error: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    success: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  };
  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${bgColors[block.severity] ?? bgColors.info}`}>
      <div className="mt-0.5">{icons[block.severity] ?? icons.info}</div>
      <div>
        <div className="text-sm font-medium">{block.title}</div>
        <div className="text-xs text-muted-foreground">{block.message}</div>
      </div>
    </div>
  );
}

// ─── Navigate Block ───
function NavigateBlock({ block }: { block: Extract<UIBlock, { type: "navigate" }> }) {
  const [, setLocation] = useLocation();
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => setLocation(block.path)}
    >
      <ArrowRight className="w-4 h-4" />
      {block.label ?? `Go to ${block.path}`}
    </Button>
  );
}

// ─── Widget Block ───
function WidgetBlock({ block }: { block: Extract<UIBlock, { type: "widget" }> }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <RenderWidget componentKey={block.slug} config={block.config} />
    </div>
  );
}

// ─── Main Renderer ───
export function UIBlockRenderer({ block, onToolCall, onDrillDown }: UIBlockRendererProps) {
  switch (block.type) {
    case "metric_grid":
      return <MetricGrid block={block} />;
    case "data_table":
      return <DataTable block={block} onToolCall={onToolCall} />;
    case "entity_card":
      return <EntityCard block={block} />;
    case "form":
      return <FormBlock block={block} onToolCall={onToolCall} />;
    case "action_panel":
      return <ActionPanel block={block} onToolCall={onToolCall} />;
    case "status_timeline":
      return <StatusTimeline block={block} />;
    case "confirmation":
      return <Confirmation block={block} onToolCall={onToolCall} />;
    case "chart":
      return <ChartBlock block={block} />;
    case "alert":
      return <AlertBlock block={block} />;
    case "navigate":
      return <NavigateBlock block={block} />;
    case "widget":
      return <WidgetBlock block={block} />;
    case "recharts":
      return <RechartsBlock block={block as any} />;
    case "heatmap_table":
      return <HeatmapTableBlock block={block as any} />;
    case "dashboard_view":
      return <GenerativeViewRenderer block={block as any} onToolCall={onToolCall} onDrillDown={onDrillDown} />;
    default:
      return null;
  }
}

/**
 * GenerativeViewRenderer — Renders AI-composed dashboard views.
 * Full layout with filter bar, grid widgets, insights, and drill-down capability.
 */
import React, { useState, useCallback } from "react";
import ReactGridLayout, { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const WidthProvider = (ReactGridLayout as any).WidthProvider || ((c: any) => c);
const ResponsiveGridLayout = WidthProvider(Responsive);
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  X, Sparkles, Info, AlertTriangle, CheckCircle2,
  Pin, Share2, Maximize2, Minimize2,
} from "lucide-react";
import { UIBlockRenderer } from "./UIBlockRenderer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


interface FilterItem {
  key: string;
  label: string;
  value: string;
  options?: string[];
}

interface DashboardWidget {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  block: unknown;
  drillDownPrompt?: string;
}

interface Insight {
  icon?: string;
  text: string;
  severity?: "info" | "warning" | "success";
}

interface DashboardViewData {
  type: "dashboard_view";
  title: string;
  subtitle?: string;
  generatedAt: string;
  filters?: FilterItem[];
  widgets: DashboardWidget[];
  insights?: Insight[];
}

interface GenerativeViewRendererProps {
  block: DashboardViewData;
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void;
  onDrillDown?: (prompt: string) => void;
}

function InsightIcon({ icon, severity }: { icon?: string; severity?: string }) {
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  if (severity === "success") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

export function GenerativeViewRenderer({ block, onToolCall, onDrillDown }: GenerativeViewRendererProps) {
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    block.filters?.forEach(f => { init[f.key] = f.value; });
    return init;
  });
  const [dismissedWidgets, setDismissedWidgets] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const layout = block.widgets
    .filter(w => !dismissedWidgets.has(w.id))
    .map(w => ({
      i: w.id,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: 2,
      minH: 2,
    }));

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // When filters change, we could trigger a re-compose
    onDrillDown?.(`Re-compose the dashboard with filter ${key} changed to "${value}"`);
  }, [onDrillDown]);

  const handleDismissWidget = useCallback((widgetId: string) => {
    setDismissedWidgets(prev => new Set(prev).add(widgetId));
  }, []);

  const visibleWidgets = block.widgets.filter(w => !dismissedWidgets.has(w.id));

  return (
    <div className={`rounded-xl border bg-card shadow-lg overflow-hidden ${expanded ? "fixed inset-4 z-50" : ""}`}>
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-card to-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{block.title}</h2>
            {block.subtitle && <p className="text-xs text-muted-foreground">{block.subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
            AI Generated • {new Date(block.generatedAt).toLocaleTimeString()}
          </Badge>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger><TooltipContent>{expanded ? "Collapse" : "Expand"}</TooltipContent></Tooltip>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      {block.filters && block.filters.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/20 flex-wrap">
          {block.filters.map(f => (
            f.options && f.options.length > 0 ? (
              <Select
                key={f.key}
                value={filters[f.key] || f.value}
                onValueChange={(val) => handleFilterChange(f.key, val)}
              >
                <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                  <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge key={f.key} variant="secondary" className="text-xs">
                {f.label}: {filters[f.key] || f.value}
              </Badge>
            )
          ))}
        </div>
      )}

      {/* ─── Insights Banner ─── */}
      {block.insights && block.insights.length > 0 && (
        <div className="px-5 py-3 border-b bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20">
          <div className="flex flex-wrap gap-3">
            {block.insights.map((insight, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <InsightIcon icon={insight.icon} severity={insight.severity} />
                <span className="text-muted-foreground">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Widget Grid ─── */}
      <div className="p-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          isDraggable={false}
          isResizable={false}
          margin={[12, 12]}
        >
          {visibleWidgets.map(widget => (
            <div key={widget.id}>
              <Card className="h-full flex flex-col overflow-hidden group/widget">
                <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/widget:opacity-100 transition-opacity">
                    {widget.drillDownPrompt && onDrillDown && (
                      <Tooltip><TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => onDrillDown(widget.drillDownPrompt!)}
                        >
                          <Sparkles className="h-3 w-3 text-primary" />
                        </Button>
                      </TooltipTrigger><TooltipContent>AI drill down</TooltipContent></Tooltip>
                    )}
                    <Tooltip><TooltipTrigger asChild>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => handleDismissWidget(widget.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent>Remove widget</TooltipContent></Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-1 pb-3 px-4 overflow-auto">
                  <UIBlockRenderer block={widget.block as any} onToolCall={onToolCall} />
                </CardContent>
              </Card>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

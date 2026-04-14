import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountUp } from "@/components/motion";

export interface StatCardTrend {
  positive: boolean;
  text: string;
}

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  /** Structured trend with direction + text */
  trend?: StatCardTrend;
  /** Raw trend string (auto-detects direction from prefix) */
  trendText?: string;
  className?: string;
}

/**
 * Reusable stat/metric card used across Analytics, DigitalTwin, Dashboard, etc.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "text-primary",
  trend,
  trendText,
  className,
}: StatCardProps) {
  const testId = `stat-${title.toLowerCase().replace(/\s/g, "-")}`;

  return (
    <Card className={`glass-panel ${className ?? ""}`} data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>
              {typeof value === "number" ? <CountUp value={value} /> : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <p
            className={`text-xs mt-2 flex items-center gap-1 ${trend.positive ? "text-green-400" : "text-red-400"}`}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.text}
          </p>
        )}
        {!trend && trendText && (
          <p
            className={`text-xs mt-2 ${trendText.startsWith("+") || trendText.startsWith("↑") ? "text-red-400" : "text-green-400"}`}
          >
            {trendText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

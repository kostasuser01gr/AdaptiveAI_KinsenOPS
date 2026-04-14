/**
 * PipelineProgress — Shows AI execution pipeline steps in a sidebar/inline panel.
 * Displays real-time progress of compose operations (fetching data, processing, building layout, rendering).
 */
import React from "react";
import { CheckCircle2, Loader2, XCircle, Zap } from "lucide-react";

export interface PipelineStep {
  step: string;
  status: "running" | "done" | "error";
  detail?: string;
  timestamp?: number;
}

interface PipelineProgressProps {
  steps: PipelineStep[];
  className?: string;
}

export function PipelineProgress({ steps, className = "" }: PipelineProgressProps) {
  if (steps.length === 0) return null;

  return (
    <div className={`rounded-lg border bg-card/80 backdrop-blur-sm p-3 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        <Zap className="h-3 w-3 text-primary" />
        Pipeline
      </div>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5 text-sm">
          {s.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
          {s.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
          {s.status === "error" && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className={s.status === "running" ? "text-foreground font-medium" : "text-muted-foreground"}>
              {s.step}
            </span>
            {s.detail && (
              <span className="text-xs text-muted-foreground/70 ml-1.5">— {s.detail}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

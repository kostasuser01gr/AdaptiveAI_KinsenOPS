import React from "react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Wraps a premium action (button, card, section) with a locked overlay when disabled.
 *
 * Usage:
 *   <LockedFeature locked={!hasFeature("exports")}>
 *     <Button onClick={handleExport}>Export</Button>
 *   </LockedFeature>
 *
 * When locked:
 * - children rendered with pointer-events-none + reduced opacity
 * - lock icon badge shown
 * - tooltip explains restriction
 */
export function LockedFeature({
  locked,
  children,
  message = "Not enabled for this workspace",
}: {
  locked: boolean;
  children: React.ReactNode;
  message?: string;
}) {
  if (!locked) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative inline-flex items-center">
          <div className="pointer-events-none opacity-50 select-none">{children}</div>
          <Lock className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Full-section locked empty state for premium pages/tabs.
 */
export function LockedSection({
  feature,
  title,
  description,
}: {
  feature: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid={`locked-${feature}`}>
      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm">
        {description || "This feature is not enabled for your workspace. Contact your administrator."}
      </p>
      <Badge variant="outline" className="mt-3 text-[10px] text-muted-foreground">
        Premium Feature
      </Badge>
    </div>
  );
}

import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatedPage } from "@/lib/animations";
import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Skip ScrollArea wrapper when the page manages its own scrolling */
  noScroll?: boolean;
  className?: string;
}

export function PageShell({ title, subtitle, icon, actions, children, noScroll, className }: PageShellProps) {
  const content = (
    <div className={`p-4 md:p-6 space-y-6 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <AnimatedPage>
      {noScroll ? content : <ScrollArea className="h-full">{content}</ScrollArea>}
    </AnimatedPage>
  );
}

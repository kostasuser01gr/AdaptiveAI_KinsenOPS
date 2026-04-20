import { useAuth } from '@/lib/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, LayoutDashboard } from 'lucide-react';

interface RoleAwareGreetingProps {
  stats: Record<string, any>;
  summary: Record<string, any>;
  overdueCount: number;
  pendingRequests: number;
  incidentCount: number;
}

const ROLE_WIDGETS: Record<string, Array<{ label: string; getValue: (p: RoleAwareGreetingProps) => string | number; hint?: (p: RoleAwareGreetingProps) => string | undefined }>> = {
  coordinator: [
    { label: "Shift coverage", getValue: () => "Active", hint: () => "All slots covered" },
    { label: "Pending requests", getValue: (p) => p.pendingRequests, hint: (p) => p.pendingRequests > 0 ? "needs review" : "all clear" },
    { label: "Open incidents", getValue: (p) => p.incidentCount },
    { label: "Queue health", getValue: (p) => p.overdueCount > 2 ? "At risk" : "Healthy" },
  ],
  agent: [
    { label: "Ready for pickup", getValue: (p) => p.summary.vehiclesByStatus?.ready ?? 0 },
    { label: "In QC", getValue: (p) => p.summary.vehiclesByStatus?.qc ?? p.summary.vehiclesByStatus?.quality_check ?? 0, hint: (p) => p.overdueCount > 0 ? `${p.overdueCount} overdue` : undefined },
    { label: "Wash queue", getValue: (p) => p.stats.washQueue ?? 0 },
    { label: "Blocked", getValue: (p) => p.summary.vehiclesByStatus?.out_of_service ?? 0 },
  ],
  supervisor: [
    { label: "Exceptions today", getValue: (p) => p.incidentCount },
    { label: "Pending sign-offs", getValue: (p) => p.pendingRequests, hint: (p) => p.pendingRequests > 0 ? "action needed" : "all clear" },
    { label: "Overdue washes", getValue: (p) => p.overdueCount },
    { label: "Fleet utilization", getValue: (p) => `${Math.round(p.summary.fleetUtilization ?? 0)}%` },
  ],
  admin: [
    { label: "Total fleet", getValue: (p) => p.summary.totalVehicles ?? p.stats.vehicles ?? 0 },
    { label: "Active users", getValue: (p) => p.summary.totalUsers ?? p.stats.users ?? 0 },
    { label: "Open incidents", getValue: (p) => p.incidentCount },
    { label: "Stations", getValue: (p) => p.summary.totalStations ?? p.stats.stations ?? 0 },
  ],
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Admin",
    supervisor: "Supervisor",
    coordinator: "Coordinator",
    agent: "Fleet Agent",
  };
  return map[role] || role;
}

export function RoleAwareGreeting(props: RoleAwareGreetingProps) {
  const { user } = useAuth();
  const role = user?.role || 'agent';
  const displayName = user?.displayName || 'there';
  const widgets = ROLE_WIDGETS[role] || ROLE_WIDGETS.agent;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Here's what matters in your shift.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-mono hidden sm:flex gap-1.5">
          {getRoleLabel(role)} view
        </Badge>
      </div>

      {/* Role-specific quick stats */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {widgets.map((w, i) => {
              const value = w.getValue(props);
              const hint = w.hint?.(props);
              return (
                <div key={i} className="p-3 rounded-lg bg-card border">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{w.label}</div>
                  <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
                  {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 px-3 py-2 rounded-md bg-primary/5 border border-primary/10 flex items-center gap-2 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Curator: Dashboard tailored to your <strong>{getRoleLabel(role)}</strong> role. Pin/unpin widgets from Settings.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

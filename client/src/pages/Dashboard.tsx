import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Car, Droplets, CalendarDays, Users, AlertTriangle, Clock,
  Activity, TrendingUp, ArrowRight, Shield, Gauge, CheckCircle2,
  XCircle, Timer, Wrench, LayoutDashboard
} from 'lucide-react';
import { Empty, EmptyContent, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { AnimatedList, AnimatedListItem, CountUp, AnimatedCard } from '@/components/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { BottleneckRadar } from '@/components/dashboard/BottleneckRadar';
import { RoleAwareGreeting } from '@/components/dashboard/RoleAwareGreeting';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashStats {
  vehicles: number; washQueue: number; shifts: number; users: number;
  stations: number; automations: number; warRooms: number;
  notifications: number; pendingShiftRequests: number; timestamp: string;
}

interface AnalyticsSummary {
  vehiclesByStatus: Record<string, number>;
  totalVehicles: number; readyCount: number;
  washesByStatus: Record<string, number>;
  washesCompletedToday: number; washesCreatedToday: number;
  fleetUtilization: number; totalShifts: number;
  totalStations: number; totalUsers: number;
}

interface WashQueueItem {
  id: number; vehiclePlate?: string; vehicleMake?: string;
  status: string; priorityScore?: number;
  slaDeadline?: string; stationId?: number;
}

interface ActivityEntry {
  id: number; actorName: string; action: string;
  entityType: string; entityLabel?: string; createdAt: string;
}

interface Incident {
  id: number; title: string; severity: string;
  status: string; createdAt: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary", href }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color?: string; href?: string;
}) {
  const inner = (
    <AnimatedCard className="glass-panel hover:border-primary/30 transition-colors group rounded-lg border bg-card" interactive={!!href}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>
              {typeof value === 'number' ? <CountUp value={value} /> : value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {href && (
          <p className="text-xs mt-2 text-primary opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            View details <ArrowRight className="h-3 w-3" />
          </p>
        )}
      </CardContent>
    </AnimatedCard>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return <Badge variant="outline" className={map[severity] || ''}>{severity}</Badge>;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-green-500', available: 'bg-green-500', completed: 'bg-green-500',
    rented: 'bg-blue-500', in_progress: 'bg-blue-500', washing: 'bg-blue-500',
    maintenance: 'bg-orange-500', pending: 'bg-yellow-500', queued: 'bg-yellow-500',
    out_of_service: 'bg-red-500', overdue: 'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || 'bg-muted-foreground'}`} />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  // Fetch all needed data
  const { data: statsRaw, dataUpdatedAt, isLoading: statsLoading } = useQuery<DashStats>({ queryKey: queryKeys.dashboard.stats() });
  const { data: summaryRaw } = useQuery<AnalyticsSummary>({ queryKey: ["/api/analytics/summary"] });
  const { data: scoredWashRaw } = useQuery<WashQueueItem[]>({ queryKey: queryKeys.washQueue.scored() });
  const { data: overdueWashRaw } = useQuery<WashQueueItem[]>({ queryKey: queryKeys.washQueue.overdue() });
  const { data: activityRaw } = useQuery<ActivityEntry[]>({ queryKey: queryKeys.activity.feed(15) });
  const { data: incidentsRaw } = useQuery<Incident[]>({ queryKey: queryKeys.incidents.byStatuses('open', 'investigating') });
  const { data: shiftRequestsRaw } = useQuery<any[]>({ queryKey: queryKeys.shifts.requests() });

  const stats = statsRaw || {} as Partial<DashStats>;
  const summary = summaryRaw || {} as Partial<AnalyticsSummary>;
  const scoredWash = Array.isArray(scoredWashRaw) ? scoredWashRaw : [];
  const overdueWash = Array.isArray(overdueWashRaw) ? overdueWashRaw : [];
  const activity = Array.isArray(activityRaw) ? activityRaw : [];
  const incidents = Array.isArray(incidentsRaw) ? incidentsRaw : [];
  const shiftRequests = Array.isArray(shiftRequestsRaw) ? shiftRequestsRaw : [];
  const pendingRequests = shiftRequests.filter(r => r.status === 'pending');

  const vByStatus = summary.vehiclesByStatus || {};
  const wByStatus = summary.washesByStatus || {};
  const utilization = summary.fleetUtilization ?? 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* U-09: Role-Aware Home — tailored greeting + role-specific quick stats */}
        <RoleAwareGreeting
          stats={stats}
          summary={summary}
          overdueCount={overdueWash.length}
          pendingRequests={pendingRequests.length}
          incidentCount={incidents.length}
        />

        {/* ── KPI Row ─────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
        <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <AnimatedListItem><StatCard title="Total Fleet" value={summary.totalVehicles ?? stats.vehicles ?? 0} subtitle={`${vByStatus.ready ?? 0} ready`} icon={Car} href="/fleet" /></AnimatedListItem>
          <AnimatedListItem><StatCard title="Wash Queue" value={stats.washQueue ?? 0} subtitle={`${overdueWash.length} overdue`} icon={Droplets} color={overdueWash.length > 0 ? 'text-orange-400' : 'text-primary'} href="/washers" /></AnimatedListItem>
          <AnimatedListItem><StatCard title="Active Shifts" value={stats.shifts ?? 0} subtitle={`${pendingRequests.length} pending requests`} icon={CalendarDays} color={pendingRequests.length > 0 ? 'text-yellow-400' : 'text-primary'} href="/shifts" /></AnimatedListItem>
          <AnimatedListItem><StatCard title="Open Incidents" value={incidents.length} subtitle={`${incidents.filter(i => i.severity === 'critical').length} critical`} icon={AlertTriangle} color={incidents.some(i => i.severity === 'critical') ? 'text-red-400' : 'text-primary'} href="/war-room" /></AnimatedListItem>
          <AnimatedListItem><StatCard title="Fleet Utilization" value={`${Math.round(utilization)}%`} subtitle={`${summary.totalStations ?? stats.stations ?? 0} stations`} icon={Gauge} color="text-primary" /></AnimatedListItem>
        </AnimatedList>
        )}

        {/* ── Bottleneck Radar (U-07) ────────────────────────────── */}
        <BottleneckRadar />

        {/* ── Main grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Left column: Fleet + Wash ──────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Fleet Status Distribution */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Fleet Status</CardTitle>
                  <Link href="/fleet">
                    <Button variant="ghost" size="sm" className="text-xs">View All <ArrowRight className="h-3 w-3 ml-1" /></Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    { key: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-green-400' },
                    { key: 'rented', label: 'Rented', icon: Car, color: 'text-blue-400' },
                    { key: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-orange-400' },
                    { key: 'out_of_service', label: 'Out of Service', icon: XCircle, color: 'text-red-400' },
                  ] as const).map(({ key, label, icon: Icon, color }) => (
                    <div key={key} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <div>
                        <p className={`text-lg font-bold ${color}`}>{vByStatus[key] ?? 0}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {(summary.totalVehicles ?? 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Utilization</span>
                      <span>{Math.round(utilization)}%</span>
                    </div>
                    <Progress value={utilization} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Priority Wash Queue */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Priority Wash Queue</CardTitle>
                    <CardDescription>{scoredWash.length} active items &middot; {overdueWash.length} overdue</CardDescription>
                  </div>
                  <Link href="/washers">
                    <Button variant="ghost" size="sm" className="text-xs">View All <ArrowRight className="h-3 w-3 ml-1" /></Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {scoredWash.length === 0 ? (
                  <Empty>
                    <EmptyContent>
                      <EmptyMedia variant="icon"><Droplets className="h-8 w-8" /></EmptyMedia>
                      <EmptyTitle>No wash items in queue</EmptyTitle>
                      <EmptyDescription>New orders will appear here automatically.</EmptyDescription>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {scoredWash.slice(0, 6).map((item) => {
                      const isOverdue = overdueWash.some(o => o.id === item.id);
                      return (
                        <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/20'}`}>
                          <div className="flex items-center gap-3">
                            <StatusDot status={isOverdue ? 'overdue' : item.status} />
                            <div>
                              <p className="text-sm font-medium">{item.vehiclePlate || `#${item.id}`}</p>
                              {item.vehicleMake && <p className="text-xs text-muted-foreground">{item.vehicleMake}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOverdue && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">SLA Breach</Badge>}
                            {item.priorityScore != null && (
                              <Badge variant="secondary" className="text-xs">{Math.round(item.priorityScore)}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wash Status Today */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Today&apos;s Wash Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-primary">{summary.washesCreatedToday ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Created</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-green-400">{summary.washesCompletedToday ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-blue-400">{wByStatus.in_progress ?? wByStatus.washing ?? 0}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-orange-400">{overdueWash.length}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column: Activity + Incidents + Requests ──── */}
          <div className="space-y-4">

            {/* Open Incidents */}
            {incidents.length > 0 && (
              <Card className="glass-panel border-red-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-400" /> Open Incidents
                    </CardTitle>
                    <Link href="/war-room">
                      <Button variant="ghost" size="sm" className="text-xs">War Room <ArrowRight className="h-3 w-3 ml-1" /></Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {incidents.slice(0, 5).map(inc => (
                      <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{inc.title}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(inc.createdAt)}</p>
                        </div>
                        <SeverityBadge severity={inc.severity} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Shift Requests */}
            {pendingRequests.length > 0 && (
              <Card className="glass-panel border-yellow-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-4 w-4 text-yellow-400" /> Pending Requests
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">{pendingRequests.length}</Badge>
                    </CardTitle>
                    <Link href="/shifts">
                      <Button variant="ghost" size="sm" className="text-xs">Review <ArrowRight className="h-3 w-3 ml-1" /></Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingRequests.slice(0, 5).map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                        <div>
                          <p className="text-sm font-medium">{req.userName || `User #${req.userId}`}</p>
                          <p className="text-xs text-muted-foreground">{req.type || 'shift change'} &middot; {timeAgo(req.createdAt)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{req.type || 'request'}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Feed */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Recent Activity
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {activity.slice(0, 15).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Activity className="h-3 w-3 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-tight">
                            <span className="font-medium">{entry.actorName}</span>{' '}
                            <span className="text-muted-foreground">{entry.action.replace(/_/g, ' ')}</span>
                            {entry.entityLabel && (
                              <span className="text-muted-foreground"> &middot; {entry.entityLabel}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Link href="/fleet">
                  <Button variant="outline" className="w-full justify-start text-xs h-9" size="sm">
                    <Car className="h-3.5 w-3.5 mr-1.5" /> Fleet
                  </Button>
                </Link>
                <Link href="/washers">
                  <Button variant="outline" className="w-full justify-start text-xs h-9" size="sm">
                    <Droplets className="h-3.5 w-3.5 mr-1.5" /> Washers
                  </Button>
                </Link>
                <Link href="/shifts">
                  <Button variant="outline" className="w-full justify-start text-xs h-9" size="sm">
                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Shifts
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="outline" className="w-full justify-start text-xs h-9" size="sm">
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Analytics
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

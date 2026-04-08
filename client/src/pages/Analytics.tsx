import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, TrendingDown, Activity, Car, Droplets, Users, Clock, Zap, AlertTriangle, Brain, Download, ArrowRight, Target, Shield } from 'lucide-react';
import { useAuth } from "@/lib/useAuth";
import { useEntitlements } from "@/lib/useEntitlements";
import { LockedFeature } from "@/components/LockedFeature";

function MiniBar({ label, value, max, color = "bg-primary" }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3" data-testid={`bar-${label.toLowerCase().replace(/\s/g,'-')}`}>
      <span className="text-xs text-muted-foreground w-20 truncate">{label}</span>
      <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{value}</span>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary", trend }: any) {
  return (
    <Card className="glass-panel" data-testid={`stat-${title.toLowerCase().replace(/\s/g,'-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <p className={`text-xs mt-2 flex items-center gap-1 ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { hasFeature } = useEntitlements();
  const [trendDays, setTrendDays] = React.useState(30);

  const { data: vehiclesData } = useQuery({ queryKey: ["/api/vehicles"] });
  const { data: washData } = useQuery({ queryKey: ["/api/wash-queue"] });
  const { data: shiftsData } = useQuery({ queryKey: ["/api/shifts"] });
  const { data: notifsData } = useQuery({ queryKey: ["/api/notifications"] });
  const { data: summaryData } = useQuery({ queryKey: ["/api/analytics/summary"] });
  const { data: kpiData } = useQuery<{ kpis: Record<string, { value: number; unit: string }> }>({
    queryKey: ["/api/kpi/compute"],
    queryFn: () => fetch('/api/kpi/compute', { credentials: 'include' }).then(r => r.json()),
    enabled: hasFeature("kpi_snapshots"),
  });
  const { data: trendsData } = useQuery<{ date: string; washes: number; evidence: number; notifications: number }[]>({
    queryKey: ["/api/analytics/trends", { days: trendDays }],
    queryFn: () => fetch(`/api/analytics/trends?days=${trendDays}`, { credentials: 'include' }).then(r => r.json()),
  });

  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
  const washes = Array.isArray(washData) ? washData : [];
  const shifts = Array.isArray(shiftsData) ? shiftsData : [];
  const notifs = Array.isArray(notifsData) ? notifsData : [];
  const summary = (summaryData || {}) as Record<string, any>;
  const kpis = kpiData?.kpis || {};
  const trends = Array.isArray(trendsData) ? trendsData : [];
  const vByStatus = (summary.vehiclesByStatus || {}) as Record<string, number>;
  const wByStatus = (summary.washesByStatus || {}) as Record<string, number>;
  const nBySeverity = (summary.notifsBySeverity || {}) as Record<string, number>;

  const readyCount = vByStatus.ready ?? vehicles.filter(v => v.status === 'ready').length;
  const washingCount = vByStatus.washing ?? vehicles.filter(v => v.status === 'washing').length;
  const maintenanceCount = vByStatus.maintenance ?? vehicles.filter(v => v.status === 'maintenance').length;
  const rentedCount = vByStatus.rented ?? vehicles.filter(v => v.status === 'rented').length;
  const returnedCount = vByStatus.returned ?? vehicles.filter(v => v.status === 'returned').length;
  const totalVehicles = summary.totalVehicles ?? vehicles.length;

  const pendingWashes = wByStatus.pending ?? washes.filter(w => w.status === 'pending').length;
  const inProgressWashes = wByStatus.in_progress ?? washes.filter(w => w.status === 'in_progress').length;
  const completedWashes = wByStatus.completed ?? washes.filter(w => w.status === 'completed').length;
  const washesToday = summary.washesCompletedToday ?? 0;

  const criticalNotifs = nBySeverity.critical ?? notifs.filter((n: any) => n.severity === 'critical').length;
  const unreadNotifs = notifs.filter((n: any) => !n.read).length;

  const fleetUtil = kpis.fleet_utilization?.value ?? summary.fleetUtilization ?? (totalVehicles > 0 ? Math.round(((rentedCount + washingCount) / totalVehicles) * 100) : 0);
  const washSlaAttainment = kpis.wash_sla_attainment?.value ?? 0;
  const avgTurnaround = kpis.avg_wash_turnaround?.value ?? 0;
  const fleetAvailability = kpis.fleet_availability?.value ?? 0;

  // Trend-derived daily max for chart scales
  const maxTrendWashes = Math.max(...trends.map(t => t.washes), 1);
  const maxTrendEvidence = Math.max(...trends.map(t => t.evidence), 1);
  const maxTrendNotifs = Math.max(...trends.map(t => t.notifications), 1);

  // Period comparison: first half vs second half of trend window
  const halfIdx = Math.floor(trends.length / 2);
  const firstHalf = trends.slice(0, halfIdx);
  const secondHalf = trends.slice(halfIdx);
  const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, t) => s + t.washes, 0) / firstHalf.length : 0;
  const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, t) => s + t.washes, 0) / secondHalf.length : 0;
  const washTrend = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;

  const handleExport = () => {
    const url = `/api/analytics/export?days=${trendDays}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-5 w-5 text-primary" /> Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground">Operational performance, fleet health, team productivity, and AI-driven insights</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {[7, 14, 30, 60].map(d => (
              <Button key={d} variant={trendDays === d ? "default" : "outline"} size="sm" className="text-xs h-7 px-2"
                onClick={() => setTrendDays(d)}>{d}d</Button>
            ))}
          </div>
          <LockedFeature locked={!hasFeature("exports")}>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExport} data-testid="button-export-analytics"><Download className="h-3 w-3" /> Export</Button>
          </LockedFeature>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <Card className="glass-card border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1">AI Weekly Summary</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {totalVehicles > 0
                      ? `Fleet of ${totalVehicles} vehicles. ${readyCount} ready (${Math.round(readyCount/totalVehicles*100)}%). ${completedWashes} washes completed, ${washesToday} today. ${washTrend !== 0 ? `Wash volume ${washTrend > 0 ? 'up' : 'down'} ${Math.abs(washTrend)}% vs prior period.` : ''} ${criticalNotifs > 0 ? `${criticalNotifs} critical alerts require attention.` : 'No critical alerts.'}`
                      : 'No fleet data yet. Add vehicles and start operations to see AI-generated insights.'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {maintenanceCount > 2 && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> {maintenanceCount} vehicles in maintenance</Badge>
                    )}
                    {readyCount / Math.max(totalVehicles, 1) > 0.7 && (
                      <Badge className="bg-green-500/20 text-green-400 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" /> Fleet readiness above 70%</Badge>
                    )}
                    {pendingWashes > 5 && (
                      <Badge className="bg-orange-500/20 text-orange-400 text-[10px]"><Clock className="h-3 w-3 mr-1" /> Wash queue pressure high</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Fleet Size" value={totalVehicles} icon={Car} subtitle={`${readyCount} ready · ${fleetAvailability}% available`} trend={{ positive: true, text: `${fleetUtil}% utilized` }} />
            <StatCard title="Active Washes" value={inProgressWashes} icon={Droplets} color="text-blue-400" subtitle={`${pendingWashes} queued · ${washesToday} today`} trend={washSlaAttainment > 0 ? { positive: washSlaAttainment >= 80, text: `${washSlaAttainment}% SLA attainment` } : undefined} />
            <StatCard title="Avg Turnaround" value={avgTurnaround > 0 ? `${avgTurnaround}m` : '—'} icon={Clock} color="text-green-400" subtitle="Wash cycle time" />
            <StatCard title="Open Incidents" value={kpis.open_incidents?.value ?? criticalNotifs} icon={AlertTriangle} color={criticalNotifs > 0 ? "text-red-400" : "text-muted-foreground"} subtitle={`${unreadNotifs} unread`} />
          </div>

          <Tabs defaultValue="operations">
            <TabsList>
              <TabsTrigger value="operations" data-testid="tab-operations">Operations</TabsTrigger>
              <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
              <TabsTrigger value="fleet" data-testid="tab-fleet">Fleet Health</TabsTrigger>
              <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">AI Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="mt-4 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Daily Wash Volume ({trendDays}d)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-[2px] h-40">
                      {trends.slice(-Math.min(trends.length, 30)).map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                          <div className="w-full bg-muted/30 rounded-t relative overflow-hidden" style={{ height: '100%' }}>
                            <div className="absolute bottom-0 w-full bg-primary/80 rounded-t transition-all duration-500" style={{ height: `${(d.washes / maxTrendWashes) * 100}%` }} />
                          </div>
                          <span className="text-[8px] text-muted-foreground rotate-45 origin-left">{d.date.slice(5)}</span>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover border rounded px-1 py-0.5 text-[9px] shadow hidden group-hover:block whitespace-nowrap z-10">
                            {d.date}: {d.washes} washes
                          </div>
                        </div>
                      ))}
                    </div>
                    {washTrend !== 0 && (
                      <p className={`text-xs mt-2 text-center flex items-center justify-center gap-1 ${washTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {washTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(washTrend)}% vs prior period
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Queue Performance</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pending</span><span className="font-bold">{pendingWashes}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">In Progress</span><span className="font-bold">{inProgressWashes}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Completed</span><span className="font-bold text-green-400">{completedWashes}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Completed Today</span><span className="font-bold">{washesToday}</span></div>
                    <div className="h-3 bg-muted/30 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-green-500/80 rounded-full" style={{ width: `${(completedWashes + inProgressWashes) > 0 ? Math.round(completedWashes / (completedWashes + inProgressWashes + pendingWashes) * 100) : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Completion rate: {(completedWashes + inProgressWashes + pendingWashes) > 0 ? Math.round(completedWashes / (completedWashes + inProgressWashes + pendingWashes) * 100) : 0}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Hourly Activity Heatmap</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-1">
                    {Array.from({ length: 12 }, (_, h) => {
                      const hour = h + 6;
                      const washesAtHour = washes.filter((w: any) => w.createdAt && new Date(w.createdAt).getHours() === hour).length;
                      const maxHourly = Math.max(...Array.from({ length: 12 }, (_, i) => washes.filter((w: any) => w.createdAt && new Date(w.createdAt).getHours() === (i + 6)).length), 1);
                      const intensity = washesAtHour / maxHourly;
                      return (
                        <div key={h} className="text-center">
                          <div className="h-8 rounded" style={{ backgroundColor: `hsl(262, 65%, ${30 + intensity * 40}%)`, opacity: 0.3 + intensity * 0.7 }} />
                          <span className="text-[9px] text-muted-foreground">{hour}:00</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="mt-4 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-400" /> Wash Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-[2px] h-32">
                      {trends.map((d, i) => (
                        <div key={i} className="flex-1 relative group">
                          <div className="w-full bg-muted/20 rounded-t overflow-hidden" style={{ height: '100%' }}>
                            <div className="absolute bottom-0 w-full bg-blue-500/70 rounded-t" style={{ height: `${(d.washes / maxTrendWashes) * 100}%` }} />
                          </div>
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-popover border rounded px-1 text-[9px] shadow hidden group-hover:block whitespace-nowrap z-10">
                            {d.date.slice(5)}: {d.washes}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">Total: {trends.reduce((s, t) => s + t.washes, 0)} washes in {trendDays}d</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-orange-400" /> Evidence Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-[2px] h-32">
                      {trends.map((d, i) => (
                        <div key={i} className="flex-1 relative group">
                          <div className="w-full bg-muted/20 rounded-t overflow-hidden" style={{ height: '100%' }}>
                            <div className="absolute bottom-0 w-full bg-orange-500/70 rounded-t" style={{ height: `${(d.evidence / maxTrendEvidence) * 100}%` }} />
                          </div>
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-popover border rounded px-1 text-[9px] shadow hidden group-hover:block whitespace-nowrap z-10">
                            {d.date.slice(5)}: {d.evidence}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">Total: {trends.reduce((s, t) => s + t.evidence, 0)} evidence items</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-purple-400" /> Notification Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-[2px] h-32">
                      {trends.map((d, i) => (
                        <div key={i} className="flex-1 relative group">
                          <div className="w-full bg-muted/20 rounded-t overflow-hidden" style={{ height: '100%' }}>
                            <div className="absolute bottom-0 w-full bg-purple-500/70 rounded-t" style={{ height: `${(d.notifications / maxTrendNotifs) * 100}%` }} />
                          </div>
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-popover border rounded px-1 text-[9px] shadow hidden group-hover:block whitespace-nowrap z-10">
                            {d.date.slice(5)}: {d.notifications}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">Total: {trends.reduce((s, t) => s + t.notifications, 0)} notifications</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Period Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Avg Daily Washes</p><p className="text-xl font-bold">{trends.length > 0 ? (trends.reduce((s, t) => s + t.washes, 0) / trends.length).toFixed(1) : '0'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Peak Day</p><p className="text-xl font-bold">{trends.length > 0 ? trends.reduce((max, t) => t.washes > max.washes ? t : max, trends[0]).date.slice(5) : '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Avg Daily Evidence</p><p className="text-xl font-bold">{trends.length > 0 ? (trends.reduce((s, t) => s + t.evidence, 0) / trends.length).toFixed(1) : '0'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Wash Trend</p><p className={`text-xl font-bold ${washTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>{washTrend > 0 ? '+' : ''}{washTrend}%</p></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fleet" className="mt-4 space-y-6">
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Fleet Status Distribution</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <MiniBar label="Ready" value={readyCount} max={totalVehicles || 1} color="bg-green-500" />
                  <MiniBar label="Washing" value={washingCount} max={totalVehicles || 1} color="bg-blue-500" />
                  <MiniBar label="Returned" value={returnedCount} max={totalVehicles || 1} color="bg-purple-500" />
                  <MiniBar label="Rented" value={rentedCount} max={totalVehicles || 1} color="bg-orange-500" />
                  <MiniBar label="Maintenance" value={maintenanceCount} max={totalVehicles || 1} color="bg-yellow-500" />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {['A', 'B', 'C', 'D', 'E'].map(cat => {
                      const count = vehicles.filter(v => v.category === cat).length;
                      if (count === 0) return null;
                      return <MiniBar key={cat} label={`Cat ${cat}`} value={count} max={totalVehicles || 1} color="bg-primary" />;
                    })}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Fleet Utilization</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-32">
                      <div className="relative h-28 w-28">
                        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5"
                            strokeDasharray={`${fleetUtil} 100`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold">{fleetUtil}%</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">Active utilization (rented + in wash)</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="team" className="mt-4 space-y-6">
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Washer Productivity</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    // Derive washer stats from real wash queue assignments
                    const washerMap: Record<string, number> = {};
                    washes.forEach((w: any) => {
                      if (w.assignedTo && w.status === 'completed') {
                        washerMap[w.assignedTo] = (washerMap[w.assignedTo] || 0) + 1;
                      }
                    });
                    const washerList = Object.entries(washerMap)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10);
                    const maxCount = washerList.length > 0 ? washerList[0][1] : 1;
                    if (washerList.length === 0) return (
                      <p className="text-sm text-muted-foreground text-center py-4">No completed wash assignments yet.</p>
                    );
                    return washerList.map(([name, count], i) => {
                      const score = Math.round((count / maxCount) * 100);
                      return (
                        <div key={i} className="flex items-center gap-3" data-testid={`washer-perf-${i}`}>
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{name[0]}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{name}</span>
                              <span className="text-xs text-muted-foreground">{count} completed</span>
                            </div>
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-yellow-500' : 'bg-orange-500'}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Shift Fairness & Fatigue</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {shifts.length > 0 ? shifts.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3" data-testid={`shift-fairness-${i}`}>
                      <span className="text-sm w-24 truncate">{s.employeeName}</span>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-muted-foreground">Fairness</span>
                            <span className="text-[10px] font-bold">{Math.round((s.fairnessScore || 0.85) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(s.fairnessScore || 0.85) * 100}%` }} /></div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-muted-foreground">Fatigue</span>
                            <span className="text-[10px] font-bold">{Math.round((s.fatigueScore || 0.2) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden"><div className={`h-full rounded-full ${(s.fatigueScore || 0.2) > 0.25 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(s.fatigueScore || 0.2) * 100}%` }} /></div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No shift data available yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Operational Efficiency", text: readyCount / Math.max(totalVehicles, 1) > 0.6 ? `Fleet readiness at ${Math.round(readyCount / Math.max(totalVehicles, 1) * 100)}%. Healthy — maintain current wash throughput.` : `Fleet readiness low (${Math.round(readyCount / Math.max(totalVehicles, 1) * 100)}%). Prioritize wash queue to improve availability.`, icon: Target, color: "text-green-400", confidence: 89 },
                  { title: "Staffing Recommendation", text: shifts.length < 5 ? `Only ${shifts.length} shifts scheduled — may be insufficient for peak demand. Consider adding afternoon coverage.` : `${shifts.length} shifts scheduled — appears adequate for current demand.`, icon: Users, color: "text-blue-400", confidence: 76 },
                  { title: "Fleet Health Alert", text: maintenanceCount > 2 ? `${maintenanceCount} vehicles in maintenance (${Math.round(maintenanceCount / Math.max(totalVehicles, 1) * 100)}% of fleet). Review maintenance scheduling.` : `Fleet health normal — ${maintenanceCount} vehicle(s) in maintenance.`, icon: Shield, color: maintenanceCount > 2 ? "text-yellow-400" : "text-green-400", confidence: 92 },
                  { title: "Queue Pressure", text: pendingWashes > 5 ? `${pendingWashes} washes pending with ${inProgressWashes} in progress. Consider adding capacity.` : `Queue is manageable — ${pendingWashes} pending, ${inProgressWashes} in progress.`, icon: Activity, color: pendingWashes > 5 ? "text-orange-400" : "text-green-400", confidence: 84 },
                ].map((insight, i) => (
                  <Card key={i} className="glass-card" data-testid={`ai-insight-${i}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <insight.icon className={`h-4 w-4 ${insight.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold">{insight.title}</h4>
                            <Badge variant="outline" className="text-[9px]">{insight.confidence}%</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{insight.text}</p>
                          <div className="flex gap-2 mt-2">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" data-testid={`button-insight-action-${i}`}>
                              <ArrowRight className="h-3 w-3 mr-1" /> Act on this
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground">Dismiss</Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

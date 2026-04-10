import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertTriangle, Car, Users, Droplets, TrendingUp, Clock, MapPin, Shield, Zap, RefreshCw, History } from 'lucide-react';

function MetricCard({ title, value, subtitle, icon: Icon, color = "text-primary", trend }: any) {
  return (
    <Card className="glass-panel" data-testid={`metric-${title.toLowerCase().replace(/\s/g,'-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && <p className={`text-xs mt-2 ${trend.startsWith('+') || trend.startsWith('↑') ? 'text-red-400' : 'text-green-400'}`}>{trend}</p>}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { low: "bg-green-500/20 text-green-400", medium: "bg-yellow-500/20 text-yellow-400", high: "bg-red-500/20 text-red-400", critical: "bg-red-600/20 text-red-300" };
  return <Badge className={`${colors[level] || colors.medium} font-medium`}>{level.toUpperCase()}</Badge>;
}

function StationCard({ station, data }: { station: string; data: any }) {
  return (
    <Card className="glass-card" data-testid={`station-card-${station}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{station}</CardTitle>
          </div>
          <RiskBadge level={data.riskLevel || 'low'} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div><p className="text-lg font-bold text-green-400">{data.ready}</p><p className="text-[10px] text-muted-foreground">Ready</p></div>
          <div><p className="text-lg font-bold text-blue-400">{data.washing}</p><p className="text-[10px] text-muted-foreground">Washing</p></div>
          <div><p className="text-lg font-bold text-yellow-400">{data.maintenance}</p><p className="text-[10px] text-muted-foreground">Repair</p></div>
          <div><p className="text-lg font-bold text-purple-400">{data.rented}</p><p className="text-[10px] text-muted-foreground">Rented</p></div>
        </div>
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Staff On Duty</span>
            <span className={data.staffOnDuty < data.staffNeeded ? 'text-red-400 font-medium' : 'text-foreground'}>{data.staffOnDuty}/{data.staffNeeded}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Queue Length</span>
            <span>{data.queueLength} vehicles</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Wash Time</span>
            <span>{data.avgWashTime}m</span>
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Next Hours Forecast</p>
          <div className="flex gap-4">
            <div className="flex-1 bg-muted/30 rounded p-2 text-center">
              <p className="text-xs text-muted-foreground">Returns</p>
              <p className="text-sm font-bold">{data.forecasts?.nextHour?.returns || 0}</p>
            </div>
            <div className="flex-1 bg-muted/30 rounded p-2 text-center">
              <p className="text-xs text-muted-foreground">Pickups</p>
              <p className="text-sm font-bold">{data.forecasts?.nextHour?.pickups || 0}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DigitalTwinPage() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const { data: snapshots, dataUpdatedAt } = useQuery({ queryKey: ["/api/digital-twin"], refetchInterval: autoRefresh ? 30000 : false });
  const { data: vehiclesData } = useQuery({ queryKey: ["/api/vehicles"], refetchInterval: autoRefresh ? 30000 : false });
  const { data: washData } = useQuery({ queryKey: ["/api/wash-queue"], refetchInterval: autoRefresh ? 30000 : false });
  const { data: stationsData } = useQuery({ queryKey: ["/api/stations"] });
  const { data: summaryData } = useQuery({ queryKey: ["/api/analytics/summary"], refetchInterval: autoRefresh ? 30000 : false });
  const { data: timelineData } = useQuery<any[]>({
    queryKey: ["/api/digital-twin/timeline"],
    queryFn: () => fetch('/api/digital-twin/timeline', { credentials: 'include' }).then(r => r.json()),
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/digital-twin"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/digital-twin/timeline"] });
  };

  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
  const washes = Array.isArray(washData) ? washData : [];
  const allStations = Array.isArray(stationsData) ? stationsData : [];
  const allSnapshots = Array.isArray(snapshots) ? snapshots : [];
  const summary = (summaryData || {}) as Record<string, any>;

  const totalVehicles = summary.totalVehicles ?? vehicles.length;
  const readyCount = summary.vehiclesByStatus?.ready ?? vehicles.filter(v => v.status === 'ready').length;
  const washingCount = summary.vehiclesByStatus?.washing ?? vehicles.filter(v => v.status === 'washing').length;
  const pendingWashes = summary.washesByStatus?.pending ?? washes.filter(w => w.status === 'pending').length;
  const washesToday = summary.washesCompletedToday ?? 0;
  const evidenceToday = summary.evidenceToday ?? 0;
  const totalShifts = summary.totalShifts ?? 0;
  const criticalNotifs = summary.notifsBySeverity?.critical ?? 0;

  // Derive risk level from wash queue pressure
  const queuePressure = totalVehicles > 0 ? (pendingWashes + washingCount) / totalVehicles : 0;
  const riskLevel = queuePressure > 0.3 ? 'HIGH' : queuePressure > 0.15 ? 'MEDIUM' : 'LOW';
  const riskColor = riskLevel === 'HIGH' ? 'text-red-400' : riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400';

  const stationSnapshots = allSnapshots.reduce((acc: Record<number, any>, s: any) => {
    if (s.stationId && !acc[s.stationId]) acc[s.stationId] = s.data;
    return acc;
  }, {});

  const timeline = Array.isArray(timelineData) ? timelineData : [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-5 w-5 text-primary" /> Digital Twin — Mission Control
          </h1>
          <p className="text-sm text-muted-foreground">Live operational state, forecasts, and risk intelligence · Updated {lastUpdated}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`gap-1 ${autoRefresh ? 'text-green-400 border-green-400/30' : 'text-muted-foreground'} cursor-pointer`}
            onClick={() => setAutoRefresh(!autoRefresh)}>
            <div className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            {autoRefresh ? 'LIVE' : 'PAUSED'}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh-twin">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="stations" data-testid="tab-stations">Stations</TabsTrigger>
              <TabsTrigger value="forecasts" data-testid="tab-forecasts">Forecasts</TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline">Snapshot History</TabsTrigger>
              <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Total Fleet" value={totalVehicles} icon={Car} subtitle={`${readyCount} ready`} />
                <MetricCard title="Washing Now" value={washingCount} icon={Droplets} color="text-blue-400" subtitle={`${pendingWashes} queued`} />
                <MetricCard title="Staff Shifts" value={totalShifts} icon={Users} color="text-green-400" subtitle={`${allStations.length} station(s)`} />
                <MetricCard title="Risk Level" value={riskLevel} icon={AlertTriangle} color={riskColor} subtitle={criticalNotifs > 0 ? `${criticalNotifs} critical alert(s)` : 'No critical alerts'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Today So Far</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Washes Completed</span><span className="font-bold">{washesToday}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Currently Washing</span><span className="font-bold">{washingCount}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">In Queue</span><span className="font-bold">{pendingWashes}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Evidence Captured</span><span className="font-bold">{evidenceToday}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Critical Alerts</span><span className={`font-bold ${criticalNotifs > 0 ? 'text-red-400' : 'text-green-400'}`}>{criticalNotifs}</span></div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Current Queue State</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pending</span><span className="font-bold">{pendingWashes}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">In Progress</span><span className="font-bold">{washingCount}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Completed Today</span><span className="font-bold text-green-400">{washesToday}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Queue Pressure</span><span className={`font-bold ${queuePressure > 0.3 ? 'text-red-400' : queuePressure > 0.15 ? 'text-yellow-400' : 'text-green-400'}`}>{Math.round(queuePressure * 100)}%</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Fleet Utilization</span><span className="font-bold">{summary.fleetUtilization ?? 0}%</span></div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Fleet Readiness</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Vehicles Ready</span><span className="font-bold text-green-400">{readyCount}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Fleet</span><span className="font-bold">{totalVehicles}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Readiness</span><span className="font-bold">{totalVehicles > 0 ? Math.round(readyCount / totalVehicles * 100) : 0}%</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Stations</span><span className="font-bold">{allStations.length}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Active Shifts</span><span className="font-bold">{totalShifts}</span></div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> AI Operational Insights</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const insights: { icon: any; color: string; text: string }[] = [];
                    if (queuePressure > 0.3) insights.push({ icon: AlertTriangle, color: "text-red-400", text: `Queue pressure at ${Math.round(queuePressure * 100)}% — ${pendingWashes} vehicles waiting. Consider adding wash capacity.` });
                    if (readyCount < totalVehicles * 0.4 && totalVehicles > 0) insights.push({ icon: Car, color: "text-yellow-400", text: `Fleet readiness low at ${Math.round(readyCount / totalVehicles * 100)}%. Only ${readyCount} of ${totalVehicles} vehicles ready.` });
                    if (washesToday > 0) insights.push({ icon: TrendingUp, color: "text-green-400", text: `${washesToday} washes completed today. ${washingCount} currently in progress.` });
                    if (criticalNotifs > 0) insights.push({ icon: AlertTriangle, color: "text-red-400", text: `${criticalNotifs} critical alert(s) require immediate attention.` });
                    if (insights.length === 0) insights.push({ icon: Shield, color: "text-green-400", text: `Operations running smoothly. Fleet readiness at ${totalVehicles > 0 ? Math.round(readyCount / totalVehicles * 100) : 0}%.` });
                    return insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50" data-testid={`insight-card-${i}`}>
                        <insight.icon className={`h-5 w-5 ${insight.color} shrink-0 mt-0.5`} />
                        <p className="text-sm">{insight.text}</p>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stations" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allStations.map((st: any) => (
                  <StationCard
                    key={st.id}
                    station={st.name}
                    data={stationSnapshots[st.id] || { ready: 0, washing: 0, maintenance: 0, rented: 0, staffOnDuty: 0, staffNeeded: 0, queueLength: 0, avgWashTime: 0, riskLevel: 'low', forecasts: { nextHour: { returns: 0, pickups: 0 } } }}
                  />
                ))}
                {allStations.length === 0 && (
                  <Card className="col-span-full glass-panel border-dashed p-8 text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="text-muted-foreground">No stations configured yet. Add stations in Settings.</p>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="forecasts" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Wash Activity by Hour (Today)</CardTitle></CardHeader>
                  <CardContent>
                    {(() => {
                      const hourCounts = Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 6;
                        return washes.filter((w: any) => w.createdAt && new Date(w.createdAt).getHours() === hour).length;
                      });
                      const maxH = Math.max(...hourCounts, 1);
                      return (
                        <div className="flex items-end gap-1.5 h-32">
                          {hourCounts.map((v, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold">{v}</span>
                              <div className="w-full bg-muted/30 rounded-t relative" style={{ height: '100%' }}>
                                <div className="absolute bottom-0 w-full bg-primary/70 rounded-t" style={{ height: `${(v / maxH) * 100}%` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground">{(6 + i)}:00</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Fleet Status Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { label: 'Ready', count: readyCount, color: 'bg-green-500/80' },
                        { label: 'Washing', count: washingCount, color: 'bg-blue-500/80' },
                        { label: 'Rented', count: summary.vehiclesByStatus?.rented ?? 0, color: 'bg-orange-500/80' },
                        { label: 'Returned', count: summary.vehiclesByStatus?.returned ?? 0, color: 'bg-purple-500/80' },
                        { label: 'Maintenance', count: summary.vehiclesByStatus?.maintenance ?? 0, color: 'bg-yellow-500/80' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs w-20 text-muted-foreground">{row.label}</span>
                          <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.color}`} style={{ width: `${totalVehicles > 0 ? (row.count / totalVehicles) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-bold w-6 text-right">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Wash Completions by Hour</CardTitle></CardHeader>
                  <CardContent>
                    {(() => {
                      const compHours = Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 6;
                        return washes.filter((w: any) => w.completedAt && new Date(w.completedAt).getHours() === hour).length;
                      });
                      const maxC = Math.max(...compHours, 1);
                      return (
                        <div className="flex items-end gap-1.5 h-32">
                          {compHours.map((v, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold">{v}</span>
                              <div className="w-full bg-muted/30 rounded-t relative" style={{ height: '100%' }}>
                                <div className={`absolute bottom-0 w-full rounded-t ${v >= maxC * 0.8 ? 'bg-green-500/70' : v >= maxC * 0.4 ? 'bg-blue-500/70' : 'bg-muted/50'}`} style={{ height: `${(v / maxC) * 100}%` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground">{(6 + i)}h</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Fleet Availability Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {['Now', '+2h', '+4h', '+6h', '+8h'].map((label, i) => {
                        const avail = [readyCount, readyCount - 2, readyCount - 4, readyCount - 1, readyCount + 1][i] || 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs w-10 text-muted-foreground">{label}</span>
                            <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${Math.max(0, (avail / Math.max(totalVehicles, 1)) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold w-6 text-right">{Math.max(0, avail)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Snapshot Timeline ({timeline.length} snapshots)</CardTitle></CardHeader>
                <CardContent>
                  {timeline.length > 0 ? (
                    <div className="space-y-3 relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                      {timeline.slice(0, 50).map((snap: any, i: number) => {
                        const snapData = snap.data as Record<string, unknown> || {};
                        const stationName = allStations.find((s: any) => s.id === snap.stationId)?.name || `Station #${snap.stationId}`;
                        return (
                          <div key={i} className="flex gap-3 pl-8 relative" data-testid={`snapshot-${i}`}>
                            <div className="absolute left-[13px] top-2 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                            <div className="flex-1 p-3 rounded-lg border bg-muted/20">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{snap.snapshotType}</Badge>
                                  <span className="text-xs font-medium">{stationName}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{new Date(snap.createdAt).toLocaleString()}</span>
                              </div>
                              {snapData && typeof snapData === 'object' && (
                                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                  {(snapData as any).ready !== undefined && <span>Ready: {(snapData as any).ready}</span>}
                                  {(snapData as any).washing !== undefined && <span>Washing: {(snapData as any).washing}</span>}
                                  {(snapData as any).queueLength !== undefined && <span>Queue: {(snapData as any).queueLength}</span>}
                                  {(snapData as any).riskLevel && <span>Risk: {(snapData as any).riskLevel}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No snapshots recorded yet. Snapshots are created automatically as operations run.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="space-y-4">
              {(() => {
                const risks: { title: string; level: string; desc: string }[] = [];
                if (queuePressure > 0.3) risks.push({ title: "High Queue Pressure", level: "high", desc: `${pendingWashes} vehicles pending wash with ${washingCount} actively washing. Queue pressure at ${Math.round(queuePressure * 100)}%.` });
                if (criticalNotifs > 0) risks.push({ title: "Critical Alerts Active", level: "critical", desc: `${criticalNotifs} critical notification(s) unresolved. Review in Ops Inbox immediately.` });
                const maintenanceCount = summary.vehiclesByStatus?.maintenance ?? 0;
                if (maintenanceCount > 2) risks.push({ title: "Elevated Maintenance", level: "medium", desc: `${maintenanceCount} vehicles in maintenance (${totalVehicles > 0 ? Math.round(maintenanceCount / totalVehicles * 100) : 0}% of fleet).` });
                if (readyCount < totalVehicles * 0.3 && totalVehicles > 0) risks.push({ title: "Low Fleet Readiness", level: "high", desc: `Only ${readyCount} of ${totalVehicles} vehicles ready (${Math.round(readyCount / totalVehicles * 100)}%).` });
                if (risks.length === 0) risks.push({ title: "No Active Risks", level: "low", desc: "All operational metrics within normal ranges." });
                return risks.map((risk, i) => (
                  <Card key={i} className={`glass-card border-l-4 ${risk.level === 'critical' ? 'border-l-red-500' : risk.level === 'high' ? 'border-l-orange-500' : risk.level === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'}`} data-testid={`risk-card-${i}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{risk.title}</h3>
                        <RiskBadge level={risk.level} />
                      </div>
                      <p className="text-sm text-muted-foreground">{risk.desc}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

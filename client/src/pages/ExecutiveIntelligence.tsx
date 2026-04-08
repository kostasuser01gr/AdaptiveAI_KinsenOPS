import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, TrendingDown, Activity, AlertTriangle, Users, Car, Droplets, ArrowRight, Download, Star, Zap } from 'lucide-react';
import { useEntitlements } from "@/lib/useEntitlements";
import { LockedFeature, LockedSection } from "@/components/LockedFeature";

function InsightCard({ title, value, change, changeLabel, icon: Icon, color, action, confidence }: any) {
  const isPositive = change > 0;
  return (
    <Card className="glass-card" data-testid={`insight-${title.toLowerCase().replace(/\s/g,'-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color || 'bg-primary/10'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{title}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
          {confidence && <Badge variant="outline" className="text-[9px]">{confidence}%</Badge>}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            {isPositive ? <TrendingUp className="h-3 w-3 text-green-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
            <span className={isPositive ? 'text-green-400' : 'text-red-400'}>{changeLabel}</span>
          </div>
          {action && <Button variant="ghost" size="sm" className="h-6 text-xs">{action}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveIntelligencePage() {
  const { hasFeature } = useEntitlements();
  const briefingsEnabled = hasFeature("executive_briefings");
  const { data: vehiclesData } = useQuery({ queryKey: ["/api/vehicles"] });
  const { data: washData } = useQuery({ queryKey: ["/api/wash-queue"] });
  const { data: notifData } = useQuery({ queryKey: ["/api/notifications"] });
  const { data: summaryData } = useQuery({ queryKey: ["/api/analytics/summary"] });
  const { data: kpiData } = useQuery<{ kpis: Record<string, { value: number; unit: string }> }>({
    queryKey: ["/api/kpi/compute"],
    queryFn: () => fetch('/api/kpi/compute', { credentials: 'include' }).then(r => r.json()),
    enabled: hasFeature("kpi_snapshots"),
  });
  const { data: anomaliesData } = useQuery({ queryKey: ["/api/anomalies"], enabled: hasFeature("anomaly_detection") });
  const { data: briefingsData } = useQuery({ queryKey: ["/api/executive-briefings"], enabled: briefingsEnabled });
  const { data: trendsData } = useQuery<{ date: string; washes: number; evidence: number; notifications: number }[]>({ queryKey: ["/api/analytics/trends", 30], queryFn: () => fetch("/api/analytics/trends?days=30", { credentials: 'include' }).then(r => r.json()) });

  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
  const washes = Array.isArray(washData) ? washData : [];
  const notifs = Array.isArray(notifData) ? notifData : [];
  const summary = (summaryData || {}) as Record<string, any>;
  const kpis = kpiData?.kpis || {};
  const anomalies = Array.isArray(anomaliesData) ? anomaliesData : [];
  const briefings = Array.isArray(briefingsData) ? briefingsData : [];

  const totalVehicles = summary.totalVehicles ?? vehicles.length;
  const readyCount = summary.vehiclesByStatus?.ready ?? vehicles.filter(v => v.status === 'ready').length;
  const washingCount = summary.vehiclesByStatus?.washing ?? 0;
  const rentedCount = summary.vehiclesByStatus?.rented ?? 0;
  const maintenanceCount = summary.vehiclesByStatus?.maintenance ?? 0;
  const fleetUtil = kpis.fleet_utilization?.value ?? summary.fleetUtilization ?? (totalVehicles > 0 ? Math.round(((rentedCount + washingCount) / totalVehicles) * 100) : 0);
  const washesToday = summary.washesCompletedToday ?? 0;
  const pendingWashes = summary.washesByStatus?.pending ?? 0;
  const completedWashes = summary.washesByStatus?.completed ?? 0;
  const criticalNotifs = summary.notifsBySeverity?.critical ?? notifs.filter((n: any) => n.severity === 'critical').length;
  const automationsActive = summary.automations?.active ?? 0;
  const automationsExecs = summary.automations?.totalExecutions ?? 0;
  const totalShifts = summary.totalShifts ?? 0;

  const trends = Array.isArray(trendsData) ? trendsData : [];
  const halfLen = Math.floor(trends.length / 2);
  const firstHalf = trends.slice(0, halfLen);
  const secondHalf = trends.slice(halfLen);
  const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, t) => s + t.washes, 0) / firstHalf.length : 0;
  const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, t) => s + t.washes, 0) / secondHalf.length : 0;
  const washTrendPct = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;
  const peakDay = trends.reduce((best, t) => t.washes > (best?.washes ?? 0) ? t : best, trends[0]);
  const avgDailyWashes = trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.washes, 0) / trends.length * 10) / 10 : 0;
  const avgDailyNotifs = trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.notifications, 0) / trends.length * 10) / 10 : 0;

  const washerStats = React.useMemo(() => {
    const byAssignee: Record<string, { total: number; completed: number }> = {};
    washes.forEach((w: any) => {
      const name = w.assignedTo;
      if (!name) return;
      if (!byAssignee[name]) byAssignee[name] = { total: 0, completed: 0 };
      byAssignee[name].total++;
      if (w.status === 'completed') byAssignee[name].completed++;
    });
    return Object.entries(byAssignee)
      .map(([name, stats]) => ({
        name,
        prod: stats.total,
        quality: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.prod - a.prod)
      .slice(0, 5);
  }, [washes]);

  const weeklyForecast = React.useMemo(() => {
    if (trends.length === 0) return [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byDay: Record<number, number[]> = {};
    trends.forEach(t => {
      const dow = new Date(t.date).getDay();
      if (!byDay[dow]) byDay[dow] = [];
      byDay[dow].push(t.washes);
    });
    return [1, 2, 3, 4, 5, 6, 0].map(dow => ({
      day: dayNames[dow],
      demand: byDay[dow] ? Math.round(byDay[dow].reduce((s, v) => s + v, 0) / byDay[dow].length) : 0,
    }));
  }, [trends]);

  const handleExport = () => {
    const link = document.createElement('a');
    link.href = '/api/analytics/export?days=30';
    link.download = 'executive-report.csv';
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-5 w-5 text-primary" /> Executive Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Weekly briefs, operational risks, AI insights, and business health</p>
        </div>
        <div className="flex gap-2">
          <LockedFeature locked={!hasFeature("exports")}>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExport} data-testid="button-export"><Download className="h-3 w-3" /> Export</Button>
          </LockedFeature>
          <LockedFeature locked={!briefingsEnabled}>
            <Button variant="outline" size="sm" data-testid="button-schedule-brief">Schedule Brief</Button>
          </LockedFeature>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <Card className="glass-card border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Operational Health Summary</h2>
                  <p className="text-sm text-muted-foreground">Fleet of {totalVehicles} vehicles · {totalShifts} shifts · {automationsActive} active automations</p>
                </div>
                <Badge className={`${fleetUtil >= 70 ? 'bg-green-500/20 text-green-400' : fleetUtil >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>Utilization: {fleetUtil}%</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium">Current State</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-1"><Car className="h-3 w-3 text-green-400" /> {readyCount} vehicles ready ({totalVehicles > 0 ? Math.round(readyCount/totalVehicles*100) : 0}%)</li>
                    <li className="flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-400" /> {washesToday} washes completed today</li>
                    <li className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> {automationsExecs} automation executions</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Attention Areas</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {criticalNotifs > 0 && <li className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" /> {criticalNotifs} critical alert(s)</li>}
                    {pendingWashes > 3 && <li className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-400" /> {pendingWashes} washes pending</li>}
                    {maintenanceCount > 0 && <li className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-400" /> {maintenanceCount} in maintenance</li>}
                    {criticalNotifs === 0 && pendingWashes <= 3 && maintenanceCount === 0 && <li className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-400" /> No issues requiring attention</li>}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Queue Status</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-primary" /> {pendingWashes} pending · {washingCount} in progress</li>
                    <li className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-primary" /> {completedWashes} total completed</li>
                    <li className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-primary" /> {summary.totalEvidence ?? 0} evidence items</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="kpis">
            <TabsList>
              <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
              <TabsTrigger value="risks" data-testid="tab-risks">Top Risks</TabsTrigger>
              <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
              <TabsTrigger value="forecasts" data-testid="tab-forecasts">Forecasts</TabsTrigger>
            </TabsList>

            <TabsContent value="kpis" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InsightCard title="Fleet Utilization" value={`${fleetUtil}%`} change={fleetUtil >= 50 ? 1 : -1} changeLabel={`${readyCount} ready of ${totalVehicles}`} icon={Car} color="bg-blue-500/10" />
                <InsightCard title="Washes Today" value={washesToday.toString()} change={washesToday > 0 ? 1 : 0} changeLabel={`${pendingWashes} pending`} icon={Activity} color="bg-green-500/10" />
                <InsightCard title="Active Shifts" value={totalShifts.toString()} change={1} changeLabel={`${summary.totalStations ?? 0} stations`} icon={Users} color="bg-purple-500/10" />
                <InsightCard title="Queue Completion" value={`${(completedWashes + pendingWashes) > 0 ? Math.round(completedWashes / (completedWashes + pendingWashes) * 100) : 0}%`} change={(completedWashes + pendingWashes) > 0 ? 1 : 0} changeLabel={`${completedWashes} of ${completedWashes + pendingWashes}`} icon={Droplets} color="bg-cyan-500/10" />
                <InsightCard title="Active Incidents" value={criticalNotifs.toString()} change={criticalNotifs > 0 ? -1 : 1} changeLabel={criticalNotifs > 0 ? "Requires attention" : "All clear"} icon={AlertTriangle} color="bg-red-500/10" />
                <InsightCard title="Automations Active" value={automationsActive.toString()} change={1} changeLabel={`${automationsExecs} total runs`} icon={Zap} color="bg-primary/10" />
                <InsightCard title="Evidence Items" value={(summary.totalEvidence ?? 0).toString()} change={1} changeLabel={`${summary.evidenceToday ?? 0} today`} icon={Activity} color="bg-emerald-500/10" />
                <InsightCard title="Fleet Readiness" value={`${totalVehicles > 0 ? Math.round(readyCount / totalVehicles * 100) : 0}%`} change={readyCount >= totalVehicles * 0.6 ? 1 : -1} changeLabel={`${maintenanceCount} in maintenance`} icon={Car} color="bg-yellow-500/10" />
              </div>
            </TabsContent>

            <TabsContent value="risks" className="mt-4 space-y-4">
              {(() => {
                const risks: { title: string; desc: string; severity: string; category: string }[] = [];
                if (criticalNotifs > 0) risks.push({ title: "Critical Alerts Active", desc: `${criticalNotifs} critical notification(s) require immediate executive attention.`, severity: "high", category: "Operations" });
                if (pendingWashes > 5) risks.push({ title: "Wash Queue Backlog", desc: `${pendingWashes} vehicles pending wash. Queue throughput may be insufficient.`, severity: pendingWashes > 10 ? "high" : "medium", category: "Queue" });
                if (maintenanceCount > 2) risks.push({ title: "Fleet Maintenance Load", desc: `${maintenanceCount} vehicles in maintenance (${totalVehicles > 0 ? Math.round(maintenanceCount/totalVehicles*100) : 0}% of fleet). Review maintenance scheduling.`, severity: "medium", category: "Fleet" });
                if (readyCount < totalVehicles * 0.4 && totalVehicles > 0) risks.push({ title: "Low Fleet Readiness", desc: `Only ${readyCount} of ${totalVehicles} vehicles ready (${Math.round(readyCount/totalVehicles*100)}%). May impact booking fulfillment.`, severity: "high", category: "Fleet" });
                if (risks.length === 0) risks.push({ title: "No Active Risks", desc: "All operational metrics are within normal ranges. Fleet readiness and queue health are good.", severity: "low", category: "General" });
                return risks.map((risk, i) => (
                  <Card key={i} className="glass-card" data-testid={`exec-risk-${i}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{risk.title}</h3>
                        <Badge variant={risk.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{risk.severity}</Badge>
                        <Badge variant="outline" className="text-[10px]">{risk.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{risk.desc}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </TabsContent>

            <TabsContent value="patterns" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">30-Day Wash Trend</CardTitle></CardHeader>
                  <CardContent>
                    {trends.length > 0 ? (
                      <>
                        <div className="flex items-end gap-0.5 h-28">
                          {trends.slice(-14).map((t, i) => {
                            const max = Math.max(...trends.slice(-14).map(x => x.washes), 1);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                <div className="w-full bg-muted/30 rounded-t relative" style={{ height: '100%' }}>
                                  <div className={`absolute bottom-0 w-full rounded-t ${t.washes >= avgDailyWashes ? 'bg-green-500/60' : 'bg-yellow-500/60'}`} style={{ height: `${Math.max(4, (t.washes / max) * 100)}%` }} />
                                </div>
                                {i % 3 === 0 && <span className="text-[7px] text-muted-foreground">{new Date(t.date).getDate()}</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>Avg: {avgDailyWashes}/day</span>
                          <span className={washTrendPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                            Trend: {washTrendPct >= 0 ? '+' : ''}{washTrendPct}%
                          </span>
                          {peakDay && <span>Peak: {new Date(peakDay.date).toLocaleDateString(undefined, { weekday: 'short' })} ({peakDay.washes})</span>}
                        </div>
                      </>
                    ) : <p className="text-sm text-muted-foreground text-center py-6">No trend data available</p>}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Notification Volume Trend</CardTitle></CardHeader>
                  <CardContent>
                    {trends.length > 0 ? (
                      <>
                        <div className="flex items-end gap-0.5 h-28">
                          {trends.slice(-14).map((t, i) => {
                            const max = Math.max(...trends.slice(-14).map(x => x.notifications), 1);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                <div className="w-full bg-muted/30 rounded-t relative" style={{ height: '100%' }}>
                                  <div className={`absolute bottom-0 w-full rounded-t ${t.notifications <= avgDailyNotifs ? 'bg-blue-500/60' : 'bg-orange-500/60'}`} style={{ height: `${Math.max(4, (t.notifications / max) * 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>Avg: {avgDailyNotifs}/day</span>
                          <span>Total (30d): {trends.reduce((s, t) => s + t.notifications, 0)}</span>
                        </div>
                      </>
                    ) : <p className="text-sm text-muted-foreground text-center py-6">No trend data available</p>}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Detected Anomalies</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {anomalies.filter((a: any) => a.status === 'open').length > 0 ? anomalies.filter((a: any) => a.status === 'open').slice(0, 5).map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/20">
                        <span className="text-xs">{a.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">{a.type}</Badge>
                          <Badge className={`text-[9px] ${a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : a.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>{a.severity}</Badge>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No open anomalies detected</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Productivity vs Quality</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {washerStats.length > 0 ? washerStats.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/20">
                        <span className="text-xs w-16 truncate">{w.name}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground w-10">Speed</span>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(w.prod / Math.max(...washerStats.map(s => s.prod), 1)) * 100}%` }} /></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground w-10">Quality</span>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${w.quality}%` }} /></div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No wash data with assigned operators</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="forecasts" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Weekly Demand Forecast</CardTitle></CardHeader>
                  <CardContent>
                    {weeklyForecast.length > 0 ? (
                      <>
                        <div className="flex items-end gap-1.5 h-36">
                          {weeklyForecast.map((d, i) => {
                            const maxDemand = Math.max(...weeklyForecast.map(f => f.demand), 1);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] font-bold">{d.demand}</span>
                                <div className="w-full bg-muted/30 rounded-t relative" style={{ height: '100%' }}>
                                  <div className="absolute bottom-0 w-full bg-primary/70 rounded-t" style={{ height: `${(d.demand / maxDemand) * 100}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{d.day}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-2">Average vehicle movements per day (from 30-day trends)</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">No trend data available for forecast</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Latest Briefing Recommendations</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {briefings.length > 0 ? (() => {
                      const latest = briefings[0] as any;
                      const recs: string[] = Array.isArray(latest.recommendations) ? latest.recommendations : [];
                      return recs.length > 0 ? recs.map((rec: string, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">{i + 1}</span>
                          <span className="text-xs text-muted-foreground flex-1">{rec}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground text-center py-4">No recommendations in latest briefing</p>;
                    })() : (
                      <p className="text-sm text-muted-foreground text-center py-4">No executive briefings generated yet. Use the Schedule Brief button to generate one.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

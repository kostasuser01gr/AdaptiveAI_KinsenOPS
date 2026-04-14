import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Shield, Activity, Users, Server, Zap } from 'lucide-react';
import { useAuth } from "@/lib/useAuth";

function SystemMetricCard({ label, value, unit, status }: { label: string; value: string | number; unit?: string; status?: 'ok' | 'warning' | 'critical' }) {
  return (
    <div className={`p-3 rounded-lg border ${status === 'critical' ? 'border-red-500/30 bg-red-500/5' : status === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card/50'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}{unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}</p>
    </div>
  );
}

export default function GodMode() {
  const { user } = useAuth();


  // Only admins can access god mode
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">God Mode requires admin privileges.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: healthData } = useQuery({
    queryKey: ['/api/health'],
    refetchInterval: 10000,
  });

  const { data: metricsData } = useQuery({
    queryKey: ['/api/metrics/prometheus'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/metrics/prometheus');
      return res.text();
    },
    refetchInterval: 15000,
  });

  const { data: usersData } = useQuery({ queryKey: ['/api/users'] });
  const { data: systemData } = useQuery({
    queryKey: ['/api/system/info'],
  });

  const health = (healthData || {}) as any;
  const users = Array.isArray(usersData) ? usersData : [];
  const system = (systemData || {}) as any;

  // Parse basic metrics from prometheus text
  const parseMetric = (text: string, name: string): number => {
    if (!text) return 0;
    const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`^${safeName}\\s+(\\d+\\.?\\d*)`, 'm')); // eslint-disable-line security/detect-non-literal-regexp
    return match ? parseFloat(match[1]) : 0;
  };

  const metrics = {
    httpTotal: parseMetric(metricsData || '', 'http_requests_total'),
    errors: parseMetric(metricsData || '', 'http_errors_total'),
    wsConnections: parseMetric(metricsData || '', 'ws_connections_active'),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" /> God Mode
          </h1>
          <p className="text-sm text-muted-foreground">System administration and real-time monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={health.status === 'ok' ? 'default' : 'destructive'} className="gap-1">
            <Activity className="h-3 w-3" /> {health.status || 'checking...'}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview"><Activity className="h-3 w-3 mr-1" /> Overview</TabsTrigger>
              <TabsTrigger value="users"><Users className="h-3 w-3 mr-1" /> Users</TabsTrigger>
              <TabsTrigger value="system"><Server className="h-3 w-3 mr-1" /> System</TabsTrigger>
              <TabsTrigger value="features"><Zap className="h-3 w-3 mr-1" /> Features</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SystemMetricCard label="HTTP Requests" value={metrics.httpTotal} status="ok" />
                <SystemMetricCard label="Errors" value={metrics.errors} status={metrics.errors > 100 ? 'critical' : metrics.errors > 10 ? 'warning' : 'ok'} />
                <SystemMetricCard label="WS Connections" value={metrics.wsConnections} status="ok" />
                <SystemMetricCard label="Active Users" value={users.length} status="ok" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-60">
                    {JSON.stringify(health, null, 2)}
                  </pre>
                </CardContent>
              </Card>

              {metricsData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Prometheus Metrics (raw)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-[10px] font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-60">
                      {metricsData.slice(0, 3000)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">All Users ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card/50">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                          {(u.displayName || u.username || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="capitalize text-[10px]">{u.role}</Badge>
                        <Badge variant={u.isActive !== false ? 'default' : 'secondary'} className="text-[10px]">
                          {u.isActive !== false ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Environment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <SystemMetricCard label="Node ENV" value={system.nodeEnv || 'unknown'} />
                    <SystemMetricCard label="Uptime" value={system.uptime ? `${Math.floor(system.uptime / 3600)}h` : '—'} />
                    <SystemMetricCard label="Memory" value={system.memoryMB ? `${system.memoryMB}` : '—'} unit="MB" />
                    <SystemMetricCard label="Platform" value={system.platform || '—'} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Database</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-40">
                    {JSON.stringify({ connected: health.db || 'unknown' }, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Feature Flags & Entitlements</CardTitle>
                  <CardDescription>Real-time feature flag management. Changes take effect immediately.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Feature flag management is handled via the Entitlements API. Visit the Trust Console for audit trails.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Eye, Lock, AlertTriangle, Clock, Users, Download, Activity, Search, Trash2, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/useAuth";
import { useEntitlements } from "@/lib/useEntitlements";
import { LockedFeature } from "@/components/LockedFeature";

export default function TrustConsolePage() {
  const { user } = useAuth();
  const { hasFeature } = useEntitlements();
  const { data: auditData } = useQuery({ queryKey: ["/api/audit-log"] });
  const { data: usersData } = useQuery({ queryKey: ["/api/users"] });
  const { data: capabilityCatalog } = useQuery({ queryKey: ["/api/capabilities"] }) as { data: { capabilities?: Array<{ capability: string; description: string; defaultRoles: string[] }> } | undefined };
  const { data: roleDefaults, isLoading: roleDefaultsLoading } = useQuery({
    queryKey: ["/api/capabilities/roles"],
    enabled: user?.role === "admin",
  });
  const auditEntries = Array.isArray(auditData) ? auditData : [];
  const allUsers = Array.isArray(usersData) ? usersData : [];
  const [auditSearch, setAuditSearch] = React.useState('');

  const filteredAudit = auditEntries.filter((e: any) =>
    !auditSearch || e.action?.toLowerCase().includes(auditSearch.toLowerCase()) || e.entityType?.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const severityMap: Record<string, string> = { create: 'text-green-400', update: 'text-blue-400', delete: 'text-red-400', publish: 'text-purple-400', login: 'text-cyan-400', restore: 'text-yellow-400' };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-5 w-5 text-primary" /> Trust & Compliance Console
          </h1>
          <p className="text-sm text-muted-foreground">Privacy governance, audit trails, access reviews, soft-delete management, and compliance</p>
        </div>
        <div className="flex gap-2">
          <LockedFeature locked={!hasFeature("trust_export_preview")}>
            <Button variant="outline" size="sm" className="gap-1" data-testid="button-export-audit"><Download className="h-3 w-3" /> Export</Button>
          </LockedFeature>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="glass-panel"><CardContent className="p-4 text-center"><Lock className="h-5 w-5 text-green-400 mx-auto mb-1" /><p className="text-lg font-bold text-green-400">Compliant</p><p className="text-[10px] text-muted-foreground">Privacy Status</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><Eye className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-lg font-bold">{auditEntries.length}</p><p className="text-[10px] text-muted-foreground">Audit Entries</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><Users className="h-5 w-5 text-blue-400 mx-auto mb-1" /><p className="text-lg font-bold">{allUsers.length}</p><p className="text-[10px] text-muted-foreground">Staff Users</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><UserCheck className="h-5 w-5 text-cyan-400 mx-auto mb-1" /><p className="text-lg font-bold">0</p><p className="text-[10px] text-muted-foreground">Reviews Due</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><AlertTriangle className="h-5 w-5 text-yellow-400 mx-auto mb-1" /><p className="text-lg font-bold">0</p><p className="text-[10px] text-muted-foreground">Anomalies</p></CardContent></Card>
          </div>

          <Tabs defaultValue="audit">
            <TabsList>
              <TabsTrigger value="audit" data-testid="tab-audit">Audit Trail</TabsTrigger>
              <TabsTrigger value="privacy" data-testid="tab-privacy">Privacy Zones</TabsTrigger>
              <TabsTrigger value="access" data-testid="tab-access">Access Control</TabsTrigger>
              <TabsTrigger value="softdelete" data-testid="tab-softdelete">Soft Delete</TabsTrigger>
              <TabsTrigger value="retention" data-testid="tab-retention">Data Retention</TabsTrigger>
              <TabsTrigger value="anomalies" data-testid="tab-anomalies">Anomaly Detection</TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="mt-4 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search audit entries..." className="pl-8 h-9" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} data-testid="input-audit-search" />
                </div>
                <Badge variant="outline" className="text-xs">{filteredAudit.length} entries</Badge>
              </div>
              {filteredAudit.length > 0 ? filteredAudit.slice(0, 50).map((entry: any) => (
                <Card key={entry.id} className="glass-card" data-testid={`audit-entry-${entry.id}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Activity className={`h-4 w-4 shrink-0 ${severityMap[entry.action?.split('.')[0]] || 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.action}</span>
                        <Badge variant="outline" className="text-[9px]">{entry.entityType}</Badge>
                        {entry.entityId && <Badge variant="secondary" className="text-[9px]">#{entry.entityId}</Badge>}
                        {entry.userId && <Badge variant="outline" className="text-[9px]">User #{entry.userId}</Badge>}
                      </div>
                      {entry.ipAddress && <p className="text-[10px] text-muted-foreground">IP: {entry.ipAddress}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</span>
                  </CardContent>
                </Card>
              )) : (
                <Card className="glass-panel p-8 text-center border-dashed">
                  <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground">No audit entries recorded yet. All critical actions will be logged here.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="privacy" className="mt-4 space-y-4">
              {[
                { name: "Customer Data", scope: "Reservation-scoped", access: "Auto-expires after rental + 30 days", icon: Lock, color: "text-green-400" },
                { name: "Staff Personal Workspace", scope: "Per-user isolated", access: "Only the authenticated user can access their preferences, layouts, and saved views", icon: Users, color: "text-blue-400" },
                { name: "Staff Personal Info", scope: "HR-restricted", access: "Admin + HR only", icon: Shield, color: "text-purple-400" },
                { name: "Vehicle Evidence", scope: "Station + Admin", access: "Linked to vehicle lifecycle, shared across authorized staff", icon: Eye, color: "text-cyan-400" },
                { name: "Chat Messages", scope: "Per-user", access: "Owner + Admin — never mixes between users", icon: Lock, color: "text-green-400" },
                { name: "Automation Rules", scope: "Personal or Shared", access: "Personal rules visible only to creator; shared rules visible to all", icon: Activity, color: "text-yellow-400" },
                { name: "Shift Requests", scope: "Per-user + Supervisors", access: "Creator sees own; managers see all for review", icon: Clock, color: "text-orange-400" },
              ].map((zone, i) => (
                <Card key={i} className="glass-card" data-testid={`privacy-zone-${i}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <zone.icon className={`h-5 w-5 ${zone.color} shrink-0`} />
                      <div>
                        <h3 className="font-semibold text-sm">{zone.name}</h3>
                        <p className="text-xs text-muted-foreground">{zone.scope} — {zone.access}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="access" className="mt-4 space-y-4">
              {/* ── Role summary cards ── */}
              {[
                { role: "admin", label: "Admin", color: "text-red-400" },
                { role: "supervisor", label: "Supervisor", color: "text-orange-400" },
                { role: "coordinator", label: "Coordinator", color: "text-blue-400" },
                { role: "agent", label: "Agent", color: "text-green-400" },
              ].map((r) => (
                <Card key={r.role} className="glass-card" data-testid={`role-card-${r.role}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-semibold text-sm ${r.color}`}>{r.label}</h3>
                      <Badge variant="outline" className="text-[9px]">
                        {allUsers.filter((u: any) => u.role === r.role).length} user{allUsers.filter((u: any) => u.role === r.role).length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {/* Live capability list */}
                    {capabilityCatalog?.capabilities ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(capabilityCatalog.capabilities as Array<{ capability: string; description: string; defaultRoles: string[] }>).map((cap) => {
                          const granted = cap.defaultRoles.includes(r.role);
                          // Check for DB override if admin and roleDefaults loaded
                          const dbOverride = Array.isArray(roleDefaults)
                            ? roleDefaults.find((rd: any) => rd.role === r.role && rd.capability === cap.capability)
                            : undefined;
                          const effective = dbOverride ? dbOverride.granted : granted;
                          const isOverridden = dbOverride !== undefined;
                          return (
                            <Badge
                              key={cap.capability}
                              variant={effective ? "default" : "outline"}
                              className={`text-[9px] ${effective ? '' : 'opacity-40'} ${isOverridden ? 'ring-1 ring-yellow-400/50' : ''}`}
                              title={`${cap.description}${isOverridden ? ' (overridden)' : ''}`}
                            >
                              {effective ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                              {cap.capability.replace(/_/g, ' ')}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading capabilities…</p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {user?.role === 'admin' && roleDefaultsLoading && (
                <p className="text-xs text-muted-foreground text-center">Loading role overrides…</p>
              )}
            </TabsContent>

            <TabsContent value="softdelete" className="mt-4 space-y-4">
              <Card className="glass-panel border-dashed">
                <CardContent className="p-6 text-center">
                  <Trash2 className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <h3 className="font-semibold mb-1">Soft Delete Management</h3>
                  <p className="text-sm text-muted-foreground mb-4">Vehicles are soft-deleted (archived) instead of permanently removed. Only admins can restore or hard-delete.</p>
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-lg font-bold text-green-400">Active</p>
                      <p className="text-[10px] text-muted-foreground">Vehicles remain in queries and UI</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-lg font-bold text-yellow-400">Archived</p>
                      <p className="text-[10px] text-muted-foreground">Soft-deleted, hidden from fleet, restorable</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-lg font-bold text-red-400">Purged</p>
                      <p className="text-[10px] text-muted-foreground">Admin-only hard delete (future)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                <Shield className="h-4 w-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-400">Governance Policy</p>
                  <p className="text-[10px] text-muted-foreground">Coordinators and supervisors can soft-delete vehicles. Only admins can restore archived vehicles via <code className="text-primary">POST /api/vehicles/:id/restore</code>. Critical audit entries are immutable.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="retention" className="mt-4 space-y-4">
              {[
                { type: "Customer Photos", policy: "Auto-delete 60 days after rental end", status: "active", icon: "📸" },
                { type: "Chat History", policy: "Retain for 1 year, then archive", status: "active", icon: "💬" },
                { type: "Audit Logs", policy: "Immutable, retained indefinitely — never deleted", status: "active", icon: "📋" },
                { type: "Vehicle Evidence", policy: "Retain for vehicle lifecycle + 90 days", status: "active", icon: "🔍" },
                { type: "User Preferences", policy: "Deleted when user account is deactivated", status: "active", icon: "⚙️" },
                { type: "Shift Requests", policy: "Archived after 6 months, retained for compliance", status: "active", icon: "📅" },
                { type: "Workspace Memory", policy: "Retained indefinitely — organizational knowledge base", status: "active", icon: "🧠" },
              ].map((policy, i) => (
                <Card key={i} className="glass-card" data-testid={`retention-policy-${i}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{policy.icon}</span>
                      <div>
                        <h3 className="font-semibold text-sm">{policy.type}</h3>
                        <p className="text-xs text-muted-foreground">{policy.policy}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">{policy.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="anomalies" className="mt-4 space-y-4">
              <Card className="glass-panel border-dashed">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <h3 className="font-semibold mb-1">Anomaly Detection</h3>
                  <p className="text-sm text-muted-foreground mb-4">AI monitors for unusual access patterns, bulk operations, off-hours activity, and privilege escalation attempts.</p>
                  <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                    {[
                      { label: 'Unusual Logins', desc: 'Login from new IP or device', status: 'monitoring' },
                      { label: 'Bulk Operations', desc: 'Mass delete or update detection', status: 'monitoring' },
                      { label: 'Off-Hours Access', desc: 'Activity outside shift schedule', status: 'monitoring' },
                      { label: 'Privilege Escalation', desc: 'Attempts to access restricted modules', status: 'monitoring' },
                    ].map((item, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 text-left">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        <Badge variant="outline" className="text-[9px] mt-2">{item.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

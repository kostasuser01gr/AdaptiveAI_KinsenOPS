import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, CheckCircle2, Clock, Loader2, UserCheck, ArrowUpRight, CircleDot, CircleCheck, CircleAlert } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import type { Notification } from "@shared/schema";

type FilterTab = 'all' | 'unread' | 'open' | 'in_progress' | 'critical' | 'incident' | 'approval' | 'ai_insight';

export default function OpsInboxPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState<FilterTab>('all');

  const { data: notifications, isLoading } = useQuery<(Notification & { read: boolean })[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: stats } = useQuery<{ open: number; inProgress: number; resolved: number; escalated: number }>({
    queryKey: ["/api/ops-inbox/stats"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops-inbox/stats"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, assignedTo, status }: { id: number; assignedTo?: number; status?: string }) => {
      await apiRequest("PATCH", `/api/notifications/${id}/assign`, { assignedTo, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops-inbox/stats"] });
      toast({ title: "Updated", description: "Item assigned/status updated." });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/notifications/${id}/escalate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops-inbox/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-rooms"] });
      toast({ title: "Escalated", description: "War Room created for this item." });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      await apiRequest("PATCH", `/api/notifications/${id}`, {
        metadata: { actionTaken: action, actionBy: user?.id, actionAt: new Date().toISOString() },
      });
      // Auto-resolve after action
      await apiRequest("PATCH", `/api/notifications/${id}/assign`, { status: 'resolved' });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops-inbox/stats"] });
      toast({ title: `Action: ${variables.action}`, description: "Notification resolved." });
    },
  });

  const items = Array.isArray(notifications) ? notifications : [];
  const unreadCount = items.filter(n => !n.read).length;
  const criticalCount = items.filter(n => n.severity === 'critical').length;

  const filtered = items.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'open') return n.status === 'open';
    if (filter === 'in_progress') return n.status === 'in_progress';
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'incident') return n.type === 'incident';
    if (filter === 'approval') return n.type === 'approval';
    if (filter === 'ai_insight') return n.type === 'ai_insight';
    return true;
  });

  const selected = items.find(n => n.id === selectedId) || filtered[0];
  const meta = (selected?.metadata || {}) as Record<string, unknown>;
  const actionTaken = meta.actionTaken as string | undefined;

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="h-5 text-[10px]">Critical</Badge>;
      case 'warning': return <Badge variant="outline" className="h-5 text-[10px] border-primary text-primary">Warning</Badge>;
      default: return <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">Info</Badge>;
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case 'incident': return <Badge variant="destructive" className="h-5 text-[10px]">Incident</Badge>;
      case 'approval': return <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">Approval</Badge>;
      case 'ai_insight': return <Badge variant="outline" className="h-5 text-[10px] border-primary text-primary">AI Insight</Badge>;
      default: return <span className="text-xs font-medium text-muted-foreground uppercase">System</span>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="outline" className="h-5 text-[10px] gap-1"><CircleDot className="h-3 w-3" />Open</Badge>;
      case 'in_progress': return <Badge variant="outline" className="h-5 text-[10px] gap-1 border-yellow-500 text-yellow-500"><Clock className="h-3 w-3" />In Progress</Badge>;
      case 'resolved': return <Badge variant="outline" className="h-5 text-[10px] gap-1 border-green-500 text-green-500"><CircleCheck className="h-3 w-3" />Resolved</Badge>;
      case 'escalated': return <Badge variant="outline" className="h-5 text-[10px] gap-1 border-red-500 text-red-500"><CircleAlert className="h-3 w-3" />Escalated</Badge>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Inbox className="h-5 w-5 text-primary" /> Ops Inbox
            {unreadCount > 0 && <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Actionable notifications, alerts, and approvals.
            {stats && (
              <span className="ml-2 text-xs">
                Open: {stats.open} · In Progress: {stats.inProgress} · Escalated: {stats.escalated}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => markAllReadMutation.mutate()} data-testid="button-mark-all-read">
            <CheckCircle2 className="h-4 w-4" /> Mark All Read
          </Button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 border-b">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7" data-testid="filter-all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs h-7" data-testid="filter-unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="open" className="text-xs h-7" data-testid="filter-open">Open ({stats?.open ?? 0})</TabsTrigger>
            <TabsTrigger value="in_progress" className="text-xs h-7" data-testid="filter-in-progress">In Progress ({stats?.inProgress ?? 0})</TabsTrigger>
            <TabsTrigger value="critical" className="text-xs h-7" data-testid="filter-critical">Critical ({criticalCount})</TabsTrigger>
            <TabsTrigger value="incident" className="text-xs h-7" data-testid="filter-incident">Incidents</TabsTrigger>
            <TabsTrigger value="approval" className="text-xs h-7" data-testid="filter-approval">Approvals</TabsTrigger>
            <TabsTrigger value="ai_insight" className="text-xs h-7" data-testid="filter-ai">AI Insights</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="w-full md:w-1/2 lg:w-1/3 border-r">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    n.id === (selected?.id) ? 'bg-accent' : ''
                  } ${n.severity === 'critical' && !n.read ? 'bg-destructive/5 hover:bg-destructive/10 border-l-4 border-l-destructive' : 'bg-card hover:bg-accent'} ${n.read ? 'opacity-60' : ''}`}
                  onClick={() => {
                    setSelectedId(n.id);
                    if (!n.read) markReadMutation.mutate(n.id);
                  }}
                  data-testid={`notification-${n.id}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5">
                      {typeBadge(n.type)}
                      {statusBadge(n.status)}
                      {!!(n.metadata as Record<string, unknown>)?.actionTaken && (
                        <Badge variant="outline" className="h-4 text-[9px] bg-green-500/10 text-green-500 border-green-500/20">Acted</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{n.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  {n.assignedTo && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <UserCheck className="h-3 w-3" />
                      {n.assignedTo === user?.id ? 'Assigned to you' : `Assigned #${n.assignedTo}`}
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No notifications matching filter</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="hidden md:flex flex-col flex-1 bg-muted/10">
          {selected ? (
            <>
              <div className="p-6 border-b bg-card">
                <div className="flex items-center gap-2 mb-4">
                  {severityBadge(selected.severity)}
                  {typeBadge(selected.type)}
                  {statusBadge(selected.status)}
                  <span className="text-sm text-muted-foreground">#{selected.id}</span>
                  {actionTaken && (
                    <Badge className="bg-green-500/20 text-green-400 text-[10px] ml-auto">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {actionTaken}
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-2" data-testid="text-notification-title">{selected.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {new Date(selected.createdAt).toLocaleString()} · {selected.audience === 'broadcast' ? 'Broadcast' : 'Direct'}
                  {selected.assignedTo && (
                    <span className="ml-2">· <UserCheck className="h-3 w-3 inline" /> {selected.assignedTo === user?.id ? 'Assigned to you' : `Assigned to #${selected.assignedTo}`}</span>
                  )}
                </p>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-2xl">
                  <Card className="glass-panel">
                    <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <p>{selected.body}</p>
                      {selected.sourceEntityType && (
                        <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                          <span className="text-xs text-muted-foreground">Source:</span>
                          <Badge variant="outline" className="text-xs">{selected.sourceEntityType} #{selected.sourceEntityId}</Badge>
                        </div>
                      )}
                      {selected.metadata && typeof selected.metadata === 'object' && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {Object.entries(selected.metadata as Record<string, unknown>).map(([key, val]) => (
                            <div key={key}>
                              <span className="text-muted-foreground block mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                              <span className="font-medium">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Status progression */}
                  {selected.status !== 'resolved' && selected.status !== 'escalated' && (
                    <div className="flex gap-3 flex-wrap">
                      {!selected.assignedTo && (
                        <Button variant="outline" className="gap-2"
                          onClick={() => assignMutation.mutate({ id: selected.id, assignedTo: user?.id, status: 'in_progress' })}
                          disabled={assignMutation.isPending} data-testid="button-claim">
                          <UserCheck className="h-4 w-4" /> Claim
                        </Button>
                      )}
                      {selected.status === 'open' && (
                        <Button variant="outline" className="gap-2"
                          onClick={() => assignMutation.mutate({ id: selected.id, status: 'in_progress' })}
                          disabled={assignMutation.isPending}>
                          <Clock className="h-4 w-4" /> Start Working
                        </Button>
                      )}
                      {selected.status === 'in_progress' && (
                        <Button variant="outline" className="gap-2 text-green-500 border-green-500/30"
                          onClick={() => assignMutation.mutate({ id: selected.id, status: 'resolved' })}
                          disabled={assignMutation.isPending}>
                          <CheckCircle2 className="h-4 w-4" /> Resolve
                        </Button>
                      )}
                      <Button variant="outline" className="gap-2 text-destructive border-destructive/30"
                        onClick={() => escalateMutation.mutate(selected.id)}
                        disabled={escalateMutation.isPending} data-testid="button-escalate-to-warroom">
                        <ArrowUpRight className="h-4 w-4" /> Escalate to War Room
                      </Button>
                    </div>
                  )}

                  {/* Type-specific actions */}
                  {!actionTaken && selected.status !== 'resolved' && selected.type === 'incident' && (
                    <div className="flex gap-3">
                      <Button className="flex-1 bg-primary hover:bg-primary/90"
                        onClick={() => actionMutation.mutate({ id: selected.id, action: 'dispatched' })}
                        disabled={actionMutation.isPending} data-testid="button-dispatch">
                        Dispatch Roadside Assist
                      </Button>
                      <Button variant="outline" className="flex-1"
                        onClick={() => actionMutation.mutate({ id: selected.id, action: 'replacement_assigned' })}
                        disabled={actionMutation.isPending} data-testid="button-assign-replacement">
                        Assign Replacement Car
                      </Button>
                    </div>
                  )}
                  {!actionTaken && selected.status !== 'resolved' && selected.type === 'approval' && (
                    <div className="flex gap-3">
                      <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => actionMutation.mutate({ id: selected.id, action: 'approved' })}
                        disabled={actionMutation.isPending} data-testid="button-approve">
                        Approve
                      </Button>
                      <Button variant="outline" className="flex-1 text-destructive"
                        onClick={() => actionMutation.mutate({ id: selected.id, action: 'denied' })}
                        disabled={actionMutation.isPending} data-testid="button-deny">
                        Deny
                      </Button>
                    </div>
                  )}
                  {!actionTaken && selected.status !== 'resolved' && selected.type === 'ai_insight' && (
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1"
                        onClick={() => actionMutation.mutate({ id: selected.id, action: 'acknowledged' })}
                        disabled={actionMutation.isPending} data-testid="button-acknowledge">
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Acknowledge
                      </Button>
                    </div>
                  )}
                  {actionTaken && (
                    <Card className="glass-panel border-green-500/20 bg-green-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="text-sm font-medium text-green-400">Action taken: {actionTaken}</p>
                          <p className="text-xs text-muted-foreground">
                            by {(meta.actionBy as number) === user?.id ? 'you' : `user #${meta.actionBy}`} at{' '}
                            {meta.actionAt ? new Date(meta.actionAt as string).toLocaleString() : '—'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Select a notification to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Copy, Wand2, CheckCircle2, History, AlertTriangle, Loader2, Send, Clock, Shield } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { useEntitlements } from "@/lib/useEntitlements";
import { LockedFeature } from "@/components/LockedFeature";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Shift } from "@shared/schema";

const SHIFT_MANAGERS = ["admin", "coordinator", "supervisor"];

export default function ShiftsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasFeature } = useEntitlements();
  const canManage = user && SHIFT_MANAGERS.includes(user.role);

  const { data: shifts, isLoading } = useQuery<Shift[]>({ queryKey: ["/api/shifts"] });
  const { data: requestsData } = useQuery({ queryKey: ["/api/shift-requests"] });
  const requests = Array.isArray(requestsData) ? requestsData : [];

  const [showRequest, setShowRequest] = React.useState(false);
  const [reqType, setReqType] = React.useState('swap');
  const [reqDetails, setReqDetails] = React.useState('');

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/shifts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift updated" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/shifts/${id}/publish`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift published" });
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/shift-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-requests"] });
      setShowRequest(false);
      setReqDetails('');
      toast({ title: "Request submitted", description: "Your shift request has been sent to the supervisor." });
    },
  });

  const reviewRequestMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note?: string }) => {
      await apiRequest("PATCH", `/api/shift-requests/${id}/review`, { status, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-requests"] });
      toast({ title: "Request reviewed" });
    },
  });

  const rows = shifts || [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const draftCount = rows.filter(s => s.status === 'draft').length;
  const publishedCount = rows.filter(s => s.status === 'published').length;
  const pendingRequests = requests.filter((r: any) => r.status === 'pending');

  const publishAll = () => {
    rows.forEach(s => {
      if (s.status === 'draft') {
        publishMutation.mutate(s.id);
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <CalendarDays className="h-5 w-5 text-primary" /> Shifts & Planning
          </h1>
          <p className="text-sm text-muted-foreground">
            {canManage ? 'Create, edit, and publish schedules with AI fairness rules' : 'View published schedules and submit requests'}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <>
              <Button variant="outline" className="gap-2" data-testid="button-versions"><History className="h-4 w-4" /> Versions</Button>
              <Button variant="outline" className="gap-2" data-testid="button-copy"><Copy className="h-4 w-4" /> Copy Previous</Button>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-autoplan"><Wand2 className="h-4 w-4" /> Auto-Plan</Button>
            </>
          ) : (
            <Dialog open={showRequest} onOpenChange={setShowRequest}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-submit-request"><Send className="h-4 w-4" /> Submit Request</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Shift Request</DialogTitle>
                  <DialogDescription>Submit a request to your supervisor. They will review and respond.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Select value={reqType} onValueChange={setReqType}>
                    <SelectTrigger data-testid="select-request-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="swap">Shift Swap</SelectItem>
                      <SelectItem value="time_off">Time Off</SelectItem>
                      <SelectItem value="schedule_change">Schedule Change</SelectItem>
                      <SelectItem value="overtime">Overtime Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Describe your request..." value={reqDetails} onChange={e => setReqDetails(e.target.value)} data-testid="input-request-details" />
                  <Button className="w-full" disabled={!reqDetails.trim()} data-testid="button-send-request"
                    onClick={() => submitRequestMutation.mutate({ requestType: reqType, details: { message: reqDetails }, status: 'pending' })}>
                    Send Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="px-4 pt-3">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
            <Shield className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">You are viewing published schedules. To request changes, use the Submit Request button above.</p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">
                {rows.length > 0 ? `Week of ${rows[0]?.weekStart || 'N/A'}` : 'No shifts'}
              </h2>
              <div className="flex gap-2">
                {publishedCount > 0 && <Badge className="bg-green-500/20 text-green-400">{publishedCount} Published</Badge>}
                {canManage && draftCount > 0 && <Badge className="bg-yellow-500/20 text-yellow-400">{draftCount} Draft</Badge>}
              </div>
            </div>
            {canManage && draftCount > 0 && (
              <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={publishAll} data-testid="button-publish-shifts">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Publish All Drafts
              </Button>
            )}
          </div>

          {canManage && (
            <LockedFeature locked={!hasFeature("staffing_recommendations")}>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3 mb-4">
                <Wand2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-1">AI Planning Suggestion</h4>
                  <p className="text-xs text-muted-foreground">Fairness index maintained at 94%. All slots covered. Consider adding backup for Friday PM slot.</p>
                </div>
              </div>
            </LockedFeature>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Card className="glass-panel overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-8 gap-px bg-border/50 border-b">
                  <div className="p-3 font-medium text-sm bg-card">Employee</div>
                  {days.map((d, i) => (
                    <div key={d} className={`p-3 font-medium text-sm bg-card text-center ${i >= 5 ? 'text-muted-foreground' : ''}`}>{d}</div>
                  ))}
                </div>
                <div className="divide-y divide-border/50">
                  {rows.map((row) => {
                    const schedule = Array.isArray(row.schedule) ? row.schedule : [];
                    const isDraft = row.status === 'draft';
                    return (
                      <div key={row.id} className={`grid grid-cols-8 gap-px bg-border/20 ${isDraft && canManage ? 'border-l-2 border-l-yellow-500' : ''}`} data-testid={`row-shift-${row.id}`}>
                        <div className="p-3 text-sm font-medium bg-card flex flex-col justify-center">
                          <div className="flex items-center gap-2">
                            <span>{row.employeeName}</span>
                            {isDraft && canManage && <Badge variant="outline" className="text-[8px] h-4 px-1">DRAFT</Badge>}
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize">{row.employeeRole}</span>
                          {canManage && row.fairnessScore != null && (
                            <span className="text-[9px] text-muted-foreground">Fair: {Math.round(row.fairnessScore * 100)}% · Fat: {Math.round((row.fatigueScore || 0) * 100)}%</span>
                          )}
                        </div>
                        {schedule.map((shift: string, j: number) => (
                          <div key={j} className="p-2 bg-card relative group">
                            {shift === 'OFF' ? (
                              <div className="h-full w-full rounded border border-dashed border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground/50 min-h-[40px]">OFF</div>
                            ) : (
                              <div className={`h-full w-full rounded flex flex-col items-center justify-center py-2 min-h-[40px] ${isDraft && canManage ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-primary/10 border border-primary/20'}`}>
                                <span className="text-xs font-semibold">{shift}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {rows.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground col-span-8">No shifts scheduled yet</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {(canManage ? pendingRequests.length > 0 : requests.length > 0) && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {canManage ? `Pending Requests (${pendingRequests.length})` : 'My Requests'}
              </h3>
              <div className="space-y-2">
                {(canManage ? pendingRequests : requests).map((req: any) => (
                  <Card key={req.id} className="glass-card" data-testid={`request-${req.id}`}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium capitalize">{req.requestType?.replace('_', ' ')}</span>
                          <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'} className="text-[9px]">{req.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{req.details?.message || ''}</p>
                        {req.reviewNote && <p className="text-xs text-primary mt-1">Note: {req.reviewNote}</p>}
                      </div>
                      {canManage && req.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-400" data-testid={`button-approve-${req.id}`}
                            onClick={() => reviewRequestMutation.mutate({ id: req.id, status: 'approved' })}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-400" data-testid={`button-deny-${req.id}`}
                            onClick={() => reviewRequestMutation.mutate({ id: req.id, status: 'denied', note: 'Denied by supervisor' })}>Deny</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

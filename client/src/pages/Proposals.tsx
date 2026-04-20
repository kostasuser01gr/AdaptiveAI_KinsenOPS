import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/useAuth';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileCheck, Clock, CheckCircle2, XCircle, Undo2, Play,
  Filter, Loader2, ChevronDown, Shield, User, AlertTriangle,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useSearchParam } from '@/hooks/useSearchParam';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';

interface Proposal {
  id: number;
  userId: number;
  type: string;
  label: string;
  description: string | null;
  impact: string;
  scope: string;
  status: string;
  payload: Record<string, unknown>;
  previousValue: Record<string, unknown> | null;
  reviewedBy: number | null;
  reviewNote: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proposed: { label: 'Pending Review', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'Approved', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-600 border-red-500/30', icon: <XCircle className="h-3.5 w-3.5" /> },
  applied: { label: 'Applied', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: <Play className="h-3.5 w-3.5" /> },
  reverted: { label: 'Reverted', color: 'bg-gray-500/15 text-gray-500 border-gray-500/30', icon: <Undo2 className="h-3.5 w-3.5" /> },
};

const IMPACT_COLORS: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600',
  medium: 'bg-amber-500/10 text-amber-600',
  high: 'bg-red-500/10 text-red-600',
};

export default function ProposalsPage() {
  const { sidebarOpen, isMobile } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useSearchParam('status', 'all');
  const [reviewNote, setReviewNote] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'apply' | 'revert'; id: number; title: string } | null>(null);

  const isReviewer = user?.role === 'admin' || user?.role === 'supervisor';

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals', statusFilter !== 'all' ? statusFilter : undefined],
    queryFn: getQueryFn({ on401: 'throw' }),
    select: (data: Proposal[]) => {
      const arr = Array.isArray(data) ? data : [];
      if (statusFilter === 'all') return arr;
      return arr.filter(p => p.status === statusFilter);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note?: string }) => {
      const res = await apiRequest('PATCH', `/api/proposals/${id}/review`, { status, reviewNote: note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      setReviewNote('');
      toast({ title: 'Proposal reviewed' });
    },
    onError: () => toast({ title: 'Review failed', variant: 'destructive' }),
  });

  const applyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/proposals/${id}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-actions'] });
      toast({ title: 'Proposal applied' });
    },
    onError: () => toast({ title: 'Apply failed', variant: 'destructive' }),
  });

  const revertMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/proposals/${id}/revert`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-actions'] });
      toast({ title: 'Proposal reverted' });
    },
    onError: () => toast({ title: 'Revert failed', variant: 'destructive' }),
  });

  const statusCounts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'proposed', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'applied', label: 'Applied' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'reverted', label: 'Reverted' },
  ];

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-sm border-b transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Workspace Proposals</h1>
          {proposals.length > 0 && (
            <Badge variant="secondary" className="ml-2">{proposals.length}</Badge>
          )}
        </div>
      </header>

      <div className="px-4 md:px-6 lg:px-24 py-3 border-b bg-muted/30">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {filterButtons.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? 'default' : 'ghost'}
              className="text-xs h-7 px-3 whitespace-nowrap"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
              {f.key !== 'all' && statusCounts[f.key] ? (
                <span className="ml-1.5 text-[10px] bg-background/50 rounded-full px-1.5">{statusCounts[f.key]}</span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 md:p-6 lg:px-24">
        <div className="max-w-4xl mx-auto space-y-3 pb-12">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : proposals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No proposals {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}</p>
                <p className="text-sm mt-1">Workspace proposals appear here when the AI suggests changes to your workspace layout, shortcuts, or configuration.</p>
              </CardContent>
            </Card>
          ) : (
            proposals.map(p => {
              const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.proposed;
              const isExpanded = expandedId === p.id;
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : p.id); } }}
                  >
                    <div className={`mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>
                      {sc.icon}
                      {sc.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{p.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">{p.type}</Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${IMPACT_COLORS[p.impact] || ''}`}>{p.impact} impact</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {p.scope === 'shared' ? <><Shield className="h-2.5 w-2.5 mr-0.5 inline" />shared</> : <><User className="h-2.5 w-2.5 mr-0.5 inline" />personal</>}
                        </Badge>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                      {/* Payload detail */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payload</label>
                        <pre className="mt-1 text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-40">
                          {JSON.stringify(p.payload, null, 2)}
                        </pre>
                      </div>

                      {p.previousValue && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Previous Value</label>
                          <pre className="mt-1 text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-40">
                            {JSON.stringify(p.previousValue, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Visual preview diff */}
                      {(p.status === 'proposed' || p.status === 'approved') && (
                        <ProposalPreview
                          payload={p.payload}
                          previousValue={p.previousValue}
                          type={p.type}
                          onApply={
                            (p.status === 'approved' || (p.status === 'proposed' && p.scope === 'personal' && p.impact !== 'high'))
                              ? () => setConfirmAction({ type: 'apply', id: p.id, title: p.label })
                              : undefined
                          }
                        />
                      )}

                      {p.reviewNote && (
                        <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-3">
                          <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <span className="font-medium text-xs">Review Note:</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.reviewNote}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Review actions — only for proposed status and reviewers */}
                        {p.status === 'proposed' && isReviewer && (
                          <>
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <Input
                                value={reviewNote}
                                onChange={e => setReviewNote(e.target.value)}
                                placeholder="Optional review note..."
                                className="text-xs h-8"
                              />
                            </div>
                            <Button
                              size="sm"
                              className="gap-1 h-8"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: p.id, status: 'approved', note: reviewNote || undefined })}
                            >
                              {reviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 h-8"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: p.id, status: 'rejected', note: reviewNote || undefined })}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        )}

                        {/* Apply — for approved proposals, or personal+low that skip review */}
                        {(p.status === 'approved' || (p.status === 'proposed' && p.scope === 'personal' && p.impact !== 'high')) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8"
                            disabled={applyMutation.isPending}
                            onClick={() => setConfirmAction({ type: 'apply', id: p.id, title: p.label })}
                          >
                            {applyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            Apply
                          </Button>
                        )}

                        {/* Revert — for applied proposals, reviewers only */}
                        {p.status === 'applied' && isReviewer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-orange-600 hover:text-orange-700"
                            disabled={revertMutation.isPending}
                            onClick={() => setConfirmAction({ type: 'revert', id: p.id, title: p.label })}
                          >
                            {revertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                            Revert
                          </Button>
                        )}

                        {/* Info for non-reviewers on proposed shared/high proposals */}
                        {p.status === 'proposed' && !isReviewer && (p.scope === 'shared' || p.impact === 'high') && (
                          <span className="text-xs text-muted-foreground italic">Awaiting admin/supervisor review</span>
                        )}
                      </div>

                      <div className="text-[10px] text-muted-foreground flex gap-4">
                        <span>Created: {new Date(p.createdAt).toLocaleString()}</span>
                        {p.appliedAt && <span>Applied: {new Date(p.appliedAt).toLocaleString()}</span>}
                        {p.reviewedBy && <span>Reviewed by user #{p.reviewedBy}</span>}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction?.type === 'apply' ? 'Apply this proposal?' : 'Revert this proposal?'}
        description={confirmAction?.type === 'apply'
          ? `"${confirmAction?.title}" will be applied to the system configuration.`
          : `"${confirmAction?.title}" will be reverted to its previous state.`}
        confirmLabel={confirmAction?.type === 'apply' ? 'Apply' : 'Revert'}
        variant={confirmAction?.type === 'revert' ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirmAction) {
            if (confirmAction.type === 'apply') applyMutation.mutate(confirmAction.id);
            else revertMutation.mutate(confirmAction.id);
            setConfirmAction(null);
          }
        }}
      />
    </div>
  );
}

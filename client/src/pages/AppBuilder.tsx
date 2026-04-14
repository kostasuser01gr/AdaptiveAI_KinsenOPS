import React, { useState, useMemo } from 'react';
import { useAuth } from '@/lib/useAuth';
import {
  useAppGraphVersions, useLatestAppGraph,
  useCreateAppGraphVersion, useApplyAppGraph, useRollbackAppGraph,
} from '@/hooks/usePlatformAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MotionDialog } from '@/components/motion/MotionDialog';
import { useToast } from '@/hooks/use-toast';
import {
  Blocks, Plus, Play, Undo2, CheckCircle2, Clock, XCircle,
  ChevronRight, GitBranch, Layers, Box, ArrowRight, Loader2,
  Eye, FileJson, AlertTriangle, Shield, Workflow,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GraphVersion {
  id: number;
  version: number;
  label: string | null;
  graph: Record<string, unknown>;
  diff: Record<string, unknown> | null;
  appliedAt: string | null;
  rolledBackAt: string | null;
  createdBy: number;
  createdAt: string;
}

type PipelineStage = 'draft' | 'validate' | 'preview' | 'publish';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getVersionStatus(v: GraphVersion): 'active' | 'rolled-back' | 'draft' {
  if (v.appliedAt && !v.rolledBackAt) return 'active';
  if (v.rolledBackAt) return 'rolled-back';
  return 'draft';
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  active: { label: 'Active', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  'rolled-back': { label: 'Rolled Back', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  draft: { label: 'Draft', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
};

function extractNodes(graph: Record<string, unknown>): GraphNode[] {
  if (Array.isArray(graph.nodes)) return graph.nodes as GraphNode[];
  return [];
}

function extractEdges(graph: Record<string, unknown>): GraphEdge[] {
  if (Array.isArray(graph.edges)) return graph.edges as GraphEdge[];
  return [];
}

const NODE_COLORS: Record<string, string> = {
  trigger: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  action: 'bg-green-500/20 border-green-500/40 text-green-300',
  condition: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  transform: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
  output: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  default: 'bg-muted border-border text-muted-foreground',
};

// ─── Pipeline Stage Indicator ───────────────────────────────────────────────

function PipelineIndicator({ stage, onStageClick }: { stage: PipelineStage; onStageClick: (s: PipelineStage) => void }) {
  const stages: { key: PipelineStage; label: string; icon: React.ReactNode }[] = [
    { key: 'draft', label: 'Draft', icon: <GitBranch className="h-4 w-4" /> },
    { key: 'validate', label: 'Validate', icon: <Shield className="h-4 w-4" /> },
    { key: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
    { key: 'publish', label: 'Publish', icon: <Play className="h-4 w-4" /> },
  ];
  const stageIdx = stages.findIndex(s => s.key === stage);
  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => (
        <React.Fragment key={s.key}>
          <button
            onClick={() => onStageClick(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              i <= stageIdx
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
          {i < stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Graph Visualizer ───────────────────────────────────────────────────────

function GraphVisualizer({ graph }: { graph: Record<string, unknown> }) {
  const nodes = extractNodes(graph);
  const edges = extractEdges(graph);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Workflow className="h-12 w-12 opacity-30" />
        <p className="text-sm">No nodes in this graph</p>
        <p className="text-xs opacity-60">Create a version with nodes and edges to visualize the flow</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Node grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {nodes.map((node) => {
          const colorClass = NODE_COLORS[node.type] || NODE_COLORS.default;
          const outEdges = edges.filter(e => e.from === node.id);
          return (
            <div key={node.id} className={`rounded-lg border px-3 py-2 ${colorClass}`}>
              <div className="flex items-center gap-2 mb-1">
                <Box className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm font-medium truncate">{node.label}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] opacity-70">
                <Badge variant="outline" className="text-[10px] h-4 px-1">{node.type}</Badge>
                {outEdges.length > 0 && (
                  <span className="flex items-center gap-0.5 ml-auto">
                    <ChevronRight className="h-3 w-3" />
                    {outEdges.map(e => e.to).join(', ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edge list */}
      {edges.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Connections ({edges.length})</p>
          <div className="flex flex-wrap gap-2">
            {edges.map((edge, i) => (
              <div key={i} className="flex items-center gap-1 text-xs bg-muted/50 rounded-md px-2 py-1 border">
                <span className="font-mono">{edge.from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{edge.to}</span>
                {edge.label && <Badge variant="outline" className="text-[10px] h-4 ml-1">{edge.label}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JSON Diff Viewer ───────────────────────────────────────────────────────

function DiffViewer({ diff }: { diff: Record<string, unknown> | null }) {
  if (!diff || Object.keys(diff).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No diff recorded for this version</p>;
  }
  return (
    <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-64 border font-mono">
      {JSON.stringify(diff, null, 2)}
    </pre>
  );
}

// ─── Create Version Dialog ──────────────────────────────────────────────────

function CreateVersionDialog({ latestGraph }: { latestGraph: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [graphJson, setGraphJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const { toast } = useToast();
  const createMutation = useCreateAppGraphVersion();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setGraphJson(latestGraph ? JSON.stringify(latestGraph, null, 2) : '{\n  "nodes": [],\n  "edges": []\n}');
      setLabel('');
      setParseError(null);
    }
    setOpen(isOpen);
  };

  const handleCreate = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(graphJson);
    } catch {
      setParseError('Invalid JSON — please fix syntax errors before saving');
      return;
    }
    setParseError(null);

    // Compute simple diff
    const diff: Record<string, unknown> = {};
    if (latestGraph) {
      const oldNodes = extractNodes(latestGraph);
      const newNodes = extractNodes(parsed);
      diff.nodesAdded = newNodes.filter(n => !oldNodes.find(o => o.id === n.id)).map(n => n.id);
      diff.nodesRemoved = oldNodes.filter(o => !newNodes.find(n => n.id === o.id)).map(o => o.id);
      const oldEdges = extractEdges(latestGraph);
      const newEdges = extractNodes(parsed);
      diff.edgesChanged = oldEdges.length !== newEdges.length;
    }

    createMutation.mutate({ graph: parsed, label: label || undefined, diff }, {
      onSuccess: () => {
        toast({ title: 'Version created', description: `Graph v${label || 'new'} saved as draft` });
        setOpen(false);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to create version', variant: 'destructive' });
      },
    });
  };

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Version
      </Button>
      <MotionDialog open={open} onOpenChange={handleOpen} title="Create Graph Version" description="Define the new app graph. Changes won't take effect until applied by an admin." className="max-w-2xl">
        <div className="space-y-3">
          <Input
            placeholder="Version label (optional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <Textarea
            className="font-mono text-xs min-h-[320px]"
            value={graphJson}
            onChange={e => { setGraphJson(e.target.value); setParseError(null); }}
          />
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              {parseError}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Draft
          </Button>
        </div>
      </MotionDialog>
    </>
  );
}

// ─── Version Timeline ───────────────────────────────────────────────────────

function VersionTimeline({ versions, selected, onSelect }: {
  versions: GraphVersion[];
  selected: number | null;
  onSelect: (v: GraphVersion) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {versions.length === 0 && (
          <div className="text-xs text-muted-foreground p-4 text-center">
            No versions yet. Create your first graph version to get started.
          </div>
        )}
        {versions.map(v => {
          const status = getVersionStatus(v);
          const badge = STATUS_BADGES[status];
          const isActive = selected === v.version;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${
                isActive
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-transparent border-transparent hover:bg-muted/50 hover:border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">v{v.version}</span>
                <Badge variant={badge.variant} className="text-[10px] h-5 gap-1">
                  {badge.icon}
                  {badge.label}
                </Badge>
              </div>
              {v.label && <p className="text-xs text-muted-foreground truncate">{v.label}</p>}
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AppBuilderPage() {
  const { user } = useAuth();
  const { data: versions = [], isLoading } = useAppGraphVersions();
  const { data: latest } = useLatestAppGraph();
  const applyMutation = useApplyAppGraph();
  const rollbackMutation = useRollbackAppGraph();
  const { toast } = useToast();

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('draft');
  const [viewMode, setViewMode] = useState<'graph' | 'json'>('graph');

  const role = (user as any)?.role || 'agent';
  const isAdmin = role === 'admin' || role === 'supervisor';

  const activeVersion = useMemo(() => {
    if (selectedVersion !== null) return versions.find(v => v.version === selectedVersion) || null;
    return latest || (versions.length > 0 ? versions[0] : null);
  }, [selectedVersion, versions, latest]);

  const handleApply = (version: number) => {
    applyMutation.mutate(version, {
      onSuccess: () => {
        toast({ title: 'Version applied', description: `v${version} is now active` });
        setPipelineStage('publish');
      },
      onError: () => toast({ title: 'Error', description: 'Failed to apply version', variant: 'destructive' }),
    });
  };

  const handleRollback = (version: number) => {
    rollbackMutation.mutate(version, {
      onSuccess: () => {
        toast({ title: 'Version rolled back', description: `v${version} has been rolled back` });
      },
      onError: () => toast({ title: 'Error', description: 'Failed to rollback version', variant: 'destructive' }),
    });
  };

  const activeStatus = activeVersion ? getVersionStatus(activeVersion) : null;
  const activeGraph = (activeVersion?.graph ?? {}) as Record<string, unknown>;
  const nodeCount = extractNodes(activeGraph).length;
  const edgeCount = extractEdges(activeGraph).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Blocks className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">App Builder</h1>
            <p className="text-xs text-muted-foreground">Governed graph pipeline — draft → validate → preview → publish</p>
          </div>
        </div>
        <PipelineIndicator stage={pipelineStage} onStageClick={setPipelineStage} />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Version Timeline */}
        <div className="w-64 border-r flex flex-col shrink-0">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Versions</span>
            {isAdmin && <CreateVersionDialog latestGraph={latest?.graph ?? null} />}
          </div>
          <VersionTimeline
            versions={versions}
            selected={activeVersion?.version ?? null}
            onSelect={(v) => { setSelectedVersion(v.version); setPipelineStage('draft'); }}
          />
        </div>

        {/* Center: Graph Display */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !activeVersion ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Blocks className="h-16 w-16 opacity-20" />
              <p className="text-sm">No graph versions found</p>
              {isAdmin && <p className="text-xs">Create your first version to begin building</p>}
            </div>
          ) : (
            <>
              {/* Version info bar */}
              <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">v{activeVersion.version}</span>
                  {activeVersion.label && <span className="text-sm text-muted-foreground">— {activeVersion.label}</span>}
                  {activeStatus && (
                    <Badge variant={STATUS_BADGES[activeStatus].variant} className="gap-1">
                      {STATUS_BADGES[activeStatus].icon}
                      {STATUS_BADGES[activeStatus].label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('graph')}
                    className="gap-1"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Graph
                  </Button>
                  <Button
                    variant={viewMode === 'json' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('json')}
                    className="gap-1"
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    JSON
                  </Button>
                </div>
              </div>

              {/* Pipeline stage content */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {pipelineStage === 'draft' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card>
                          <CardContent className="p-4 flex items-center gap-3">
                            <Box className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-2xl font-bold">{nodeCount}</p>
                              <p className="text-xs text-muted-foreground">Nodes</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 flex items-center gap-3">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-2xl font-bold">{edgeCount}</p>
                              <p className="text-xs text-muted-foreground">Edges</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 flex items-center gap-3">
                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-2xl font-bold">{versions.length}</p>
                              <p className="text-xs text-muted-foreground">Versions</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {viewMode === 'graph' ? (
                        <Card>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Graph Nodes</CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <GraphVisualizer graph={activeGraph} />
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-2"><FileJson className="h-4 w-4" /> Raw Graph JSON</CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-auto max-h-[500px] border">
                              {JSON.stringify(activeGraph, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {pipelineStage === 'validate' && (
                    <ValidationPanel graph={activeGraph} onPass={() => setPipelineStage('preview')} />
                  )}

                  {pipelineStage === 'preview' && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm">Change Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Graph Structure</p>
                              <GraphVisualizer graph={activeGraph} />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Recorded Diff</p>
                              <DiffViewer diff={activeVersion.diff} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      {isAdmin && activeStatus === 'draft' && (
                        <div className="flex justify-end">
                          <Button onClick={() => setPipelineStage('publish')} className="gap-1.5">
                            Proceed to Publish <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {pipelineStage === 'publish' && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Publish Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          {activeStatus === 'active' && (
                            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
                              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-green-400">v{activeVersion.version} is Active</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Applied {activeVersion.appliedAt ? new Date(activeVersion.appliedAt).toLocaleString() : ''}
                                </p>
                                {isAdmin && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="mt-3 gap-1"
                                    onClick={() => handleRollback(activeVersion.version)}
                                    disabled={rollbackMutation.isPending}
                                  >
                                    {rollbackMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                    <Undo2 className="h-3.5 w-3.5" />
                                    Rollback
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {activeStatus === 'draft' && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                              <Play className="h-5 w-5 text-primary mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">Ready to Apply v{activeVersion.version}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  This will make this graph version the active configuration. Only admins can apply versions.
                                </p>
                                {isAdmin ? (
                                  <Button
                                    size="sm"
                                    className="mt-3 gap-1"
                                    onClick={() => handleApply(activeVersion.version)}
                                    disabled={applyMutation.isPending}
                                  >
                                    {applyMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                    <Play className="h-3.5 w-3.5" />
                                    Apply Version
                                  </Button>
                                ) : (
                                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Admin approval required to apply
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {activeStatus === 'rolled-back' && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-destructive">v{activeVersion.version} was Rolled Back</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Rolled back {activeVersion.rolledBackAt ? new Date(activeVersion.rolledBackAt).toLocaleString() : ''}
                                </p>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    className="mt-3 gap-1"
                                    onClick={() => handleApply(activeVersion.version)}
                                    disabled={applyMutation.isPending}
                                  >
                                    {applyMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                    <Play className="h-3.5 w-3.5" />
                                    Re-apply Version
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Validation Panel ───────────────────────────────────────────────────────

function ValidationPanel({ graph, onPass }: { graph: Record<string, unknown>; onPass: () => void }) {
  const nodes = extractNodes(graph);
  const edges = extractEdges(graph);

  const checks = useMemo(() => {
    const results: { label: string; pass: boolean; detail: string }[] = [];

    // Check: graph has nodes
    results.push({
      label: 'Graph contains nodes',
      pass: nodes.length > 0,
      detail: nodes.length > 0 ? `${nodes.length} node(s) found` : 'Graph is empty — add at least one node',
    });

    // Check: all nodes have unique IDs
    const ids = nodes.map(n => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    results.push({
      label: 'Unique node IDs',
      pass: dupes.length === 0,
      detail: dupes.length === 0 ? 'All node IDs are unique' : `Duplicate IDs: ${dupes.join(', ')}`,
    });

    // Check: all nodes have labels
    const unlabeled = nodes.filter(n => !n.label);
    results.push({
      label: 'All nodes labeled',
      pass: unlabeled.length === 0,
      detail: unlabeled.length === 0 ? 'All nodes have labels' : `${unlabeled.length} node(s) missing labels`,
    });

    // Check: edges reference valid nodes
    const nodeIds = new Set(ids);
    const badEdges = edges.filter(e => !nodeIds.has(e.from) || !nodeIds.has(e.to));
    results.push({
      label: 'Edge references valid',
      pass: badEdges.length === 0,
      detail: badEdges.length === 0 ? 'All edges connect to existing nodes' : `${badEdges.length} edge(s) reference missing nodes`,
    });

    // Check: no self-loops
    const selfLoops = edges.filter(e => e.from === e.to);
    results.push({
      label: 'No self-loops',
      pass: selfLoops.length === 0,
      detail: selfLoops.length === 0 ? 'No self-referencing edges' : `${selfLoops.length} self-loop(s) detected`,
    });

    return results;
  }, [nodes, edges]);

  const allPass = checks.every(c => c.pass);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Validation Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {checks.map((check, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-md p-2 border ${
              check.pass ? 'border-green-500/20 bg-green-500/5' : 'border-destructive/20 bg-destructive/5'
            }`}>
              {check.pass
                ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-medium">{check.label}</p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onPass} disabled={!allPass} className="gap-1.5">
          {allPass ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {allPass ? 'Proceed to Preview' : 'Fix issues to continue'}
          {allPass && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

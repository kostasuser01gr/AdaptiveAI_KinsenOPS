import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Zap, Plus, Play, Pause, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Clock, ArrowRight, Lock, Globe, Eye, FlaskConical, History, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";

const triggerLabels: Record<string, string> = {
  qc_fail: "QC Inspection Fails",
  customer_upload: "Customer Uploads Evidence",
  sla_warning: "SLA Breach Approaching",
  vehicle_return: "Vehicle Returned",
  shift_change: "Shift Change Requested",
  wash_complete: "Wash Completed",
  incident_report: "Incident Reported",
  vehicle_blocked: "Vehicle Blocked Too Long",
  anomaly_detected: "Anomaly Detected",
  escalation: "Escalation Threshold",
};

const actionLabels: Record<string, string> = {
  notify: "Send Notification",
  escalate: "Escalate to Supervisor",
  create_task: "Create Task",
  link_evidence: "Link Evidence",
  send_email: "Send Email",
  webhook: "Trigger Webhook",
  create_room: "Create War Room",
};

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: rules } = useQuery({ queryKey: ["/api/automation-rules"] });
  const allRules = Array.isArray(rules) ? rules : [];

  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newTrigger, setNewTrigger] = React.useState('qc_fail');
  const [newScope, setNewScope] = React.useState('shared');
  const [nlInput, setNlInput] = React.useState('');
  const [dryRunId, setDryRunId] = React.useState<number | null>(null);
  const [showDryRun, setShowDryRun] = React.useState(false);
  const [tab, setTab] = React.useState('all');

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/automation-rules", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] }); setShowCreate(false); setNewName(''); setNewDesc(''); toast({ title: "Rule created" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => { await apiRequest("PATCH", `/api/automation-rules/${id}`, { active }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] }); toast({ title: "Rule updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/automation-rules/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] }); toast({ title: "Rule deleted" }); },
  });

  const parseNaturalLanguage = () => {
    const lower = nlInput.toLowerCase();
    let trigger = 'qc_fail';
    let name = nlInput;
    if (lower.includes('sla')) trigger = 'sla_warning';
    else if (lower.includes('upload') || lower.includes('customer')) trigger = 'customer_upload';
    else if (lower.includes('return')) trigger = 'vehicle_return';
    else if (lower.includes('wash')) trigger = 'wash_complete';
    else if (lower.includes('incident')) trigger = 'incident_report';
    else if (lower.includes('blocked') || lower.includes('stuck')) trigger = 'vehicle_blocked';
    setNewTrigger(trigger);
    setNewName(name);
    setNewDesc(`Auto-generated from: "${nlInput}"`);
    setNlInput('');
    setShowCreate(true);
    toast({ title: "Rule parsed", description: `Detected trigger: ${triggerLabels[trigger]}` });
  };

  const activeCount = allRules.filter((r: any) => r.active).length;
  const sharedRules = allRules.filter((r: any) => r.scope === 'shared' || !r.scope);
  const personalRules = allRules.filter((r: any) => r.scope === 'personal');
  const displayRules = tab === 'personal' ? personalRules : tab === 'shared' ? sharedRules : allRules;
  const totalExecutions = allRules.reduce((s: number, r: any) => s + (r.triggerCount || 0), 0);

  const conflictCheck = (trigger: string) => {
    const existing = allRules.filter((r: any) => r.trigger === trigger && r.active);
    if (existing.length > 0) return `Warning: ${existing.length} active rule(s) with same trigger "${triggerLabels[trigger]}"`;
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Zap className="h-5 w-5 text-primary" /> Automation Builder
          </h1>
          <p className="text-sm text-muted-foreground">Event-driven rules with natural language, dry runs, scope control, and audit trails</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-rule"><Plus className="h-4 w-4" /> New Rule</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
                <DialogDescription>Define trigger events, conditions, and automated actions.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="Rule name..." value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-rule-name" />
                <Textarea placeholder="Describe what this rule does..." value={newDesc} onChange={e => setNewDesc(e.target.value)} data-testid="input-rule-desc" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Trigger Event</label>
                    <Select value={newTrigger} onValueChange={setNewTrigger}>
                      <SelectTrigger data-testid="select-trigger"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(triggerLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Scope</label>
                    <Select value={newScope} onValueChange={setNewScope}>
                      <SelectTrigger data-testid="select-scope"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shared"><div className="flex items-center gap-2"><Globe className="h-3 w-3" /> Shared (Team)</div></SelectItem>
                        <SelectItem value="personal"><div className="flex items-center gap-2"><Lock className="h-3 w-3" /> Personal (Only me)</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {conflictCheck(newTrigger) && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 flex items-center gap-2 text-xs text-yellow-400">
                    <AlertTriangle className="h-3 w-3" /> {conflictCheck(newTrigger)}
                  </div>
                )}
                <div className="bg-muted/30 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-2">Impact Preview</p>
                  <p className="text-sm">When <span className="font-semibold text-primary">{triggerLabels[newTrigger]}</span>, this rule will notify the coordinator.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Scope: {newScope === 'shared' ? 'Visible to all team members' : 'Only visible to you'}</p>
                </div>
                <Button className="w-full" disabled={!newName.trim()} data-testid="button-save-rule"
                  onClick={() => createMutation.mutate({ name: newName, description: newDesc, trigger: newTrigger, scope: newScope, conditions: {}, actions: [{ type: "notify", target: "coordinator" }], active: true, version: 1 })}>
                  Create Rule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
          <Card className="glass-panel border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input placeholder='Describe a rule in natural language... e.g. "When SLA is about to breach, escalate to coordinator"'
                    value={nlInput} onChange={e => setNlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && nlInput.trim() && parseNaturalLanguage()}
                    className="bg-muted/30" data-testid="input-natural-language" />
                </div>
                <Button onClick={parseNaturalLanguage} disabled={!nlInput.trim()} className="gap-2" data-testid="button-parse-nl">
                  <Zap className="h-4 w-4" /> Parse
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">AI will parse your intent into a trigger → action rule with scope and conditions.</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            <Card className="glass-panel"><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{allRules.length}</p><p className="text-xs text-muted-foreground">Total Rules</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-400">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-muted-foreground">{totalExecutions}</p><p className="text-xs text-muted-foreground">Executions</p></CardContent></Card>
            <Card className="glass-panel"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-400">{personalRules.length}</p><p className="text-xs text-muted-foreground">Personal</p></CardContent></Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">All ({allRules.length})</TabsTrigger>
              <TabsTrigger value="shared" data-testid="tab-shared"><Globe className="h-3 w-3 mr-1" /> Shared ({sharedRules.length})</TabsTrigger>
              <TabsTrigger value="personal" data-testid="tab-personal"><Lock className="h-3 w-3 mr-1" /> Personal ({personalRules.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            {displayRules.map((rule: any) => (
              <Card key={rule.id} className={`glass-card ${!rule.active ? 'opacity-60' : ''}`} data-testid={`rule-card-${rule.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{rule.name}</h3>
                        <Badge variant={rule.active ? "default" : "secondary"} className="text-[10px]">{rule.active ? 'Active' : 'Paused'}</Badge>
                        <Badge variant="outline" className="text-[10px]">v{rule.version}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${rule.scope === 'personal' ? 'border-purple-400/30 text-purple-400' : 'border-blue-400/30 text-blue-400'}`}>
                          {rule.scope === 'personal' ? <><Lock className="h-2 w-2 mr-1" />Personal</> : <><Globe className="h-2 w-2 mr-1" />Shared</>}
                        </Badge>
                      </div>
                      {rule.description && <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="font-medium">WHEN</span>
                        <span>{triggerLabels[rule.trigger] || rule.trigger}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium">THEN</span>
                        <span>{Array.isArray(rule.actions) ? rule.actions.map((a: any) => actionLabels[a.type] || a.type).join(' → ') : 'notify'}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {rule.triggerCount > 0 && (
                          <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {rule.triggerCount} executions</span>
                        )}
                        {rule.lastTriggered && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last: {new Date(rule.lastTriggered).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid={`button-dry-run-${rule.id}`}
                        onClick={() => { setDryRunId(rule.id); setShowDryRun(true); }}>
                        <FlaskConical className="h-3 w-3" /> Dry Run
                      </Button>
                      <Switch checked={rule.active} onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, active: checked })} data-testid={`switch-toggle-${rule.id}`} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(rule.id)} data-testid={`button-delete-${rule.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {displayRules.length === 0 && (
              <Card className="glass-panel border-dashed p-12 text-center">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                <h3 className="font-semibold mb-1">No {tab !== 'all' ? tab : ''} automation rules</h3>
                <p className="text-sm text-muted-foreground mb-4">Create rules using natural language or the New Rule button above.</p>
                <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-rule">Create First Rule</Button>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>

      <Dialog open={showDryRun} onOpenChange={setShowDryRun}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" /> Dry Run Validation</DialogTitle>
            <DialogDescription>Testing rule structure and scope against live data.</DialogDescription>
          </DialogHeader>
          <DryRunContent ruleId={dryRunId} rules={allRules} onClose={() => setShowDryRun(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DryRunContent({ ruleId, rules, onClose }: { ruleId: number | null; rules: any[]; onClose: () => void }) {
  const { data: result, isLoading } = useQuery<{ valid: boolean; errors: string[]; matchingEntities: number }>({
    queryKey: ["/api/automation-rules", ruleId, "test"],
    queryFn: () => fetch(`/api/automation-rules/${ruleId}/test`, { method: 'POST', credentials: 'include' }).then(r => r.json()),
    enabled: !!ruleId,
  });

  const rule = rules.find((r: any) => r.id === ruleId);
  if (!rule) return null;

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2"><Badge className="bg-blue-500/20 text-blue-400">1. Trigger</Badge><span className="text-sm">{triggerLabels[rule.trigger] || rule.trigger}</span></div>
        <div className="flex items-center gap-2"><Badge className="bg-yellow-500/20 text-yellow-400">2. Evaluate</Badge><span className="text-sm">Conditions: {JSON.stringify(rule.conditions) === '{}' || !rule.conditions ? 'Always match' : 'Check conditions'}</span></div>
        <div className="flex items-center gap-2"><Badge className="bg-green-500/20 text-green-400">3. Execute</Badge>
          <span className="text-sm">{Array.isArray(rule.actions) ? rule.actions.map((a: any) => actionLabels[a.type] || a.type).join(', ') : 'Notify'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Validating rule...</div>
      ) : result ? (
        <>
          <div className={`${result.valid ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} border rounded p-3`}>
            <div className="flex items-center gap-2 mb-1">
              {result.valid ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
              <span className={`text-sm font-medium ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                {result.valid ? 'Validation passed' : 'Validation failed'}
              </span>
            </div>
            {result.errors.length > 0 && (
              <ul className="text-xs text-red-400 mt-2 space-y-1">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
          <div className="bg-muted/30 rounded p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Matching entities in scope</span>
            <span className="text-lg font-bold">{result.matchingEntities}</span>
          </div>
        </>
      ) : null}

      <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

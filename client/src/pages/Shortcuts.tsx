import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useApp } from '@/lib/AppContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Command, Plus, Zap, MessageSquareQuote, Loader2, Trash2, Play, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CustomAction {
  id: number;
  userId: number;
  label: string;
  icon: string;
  target: string;
  placement: string;
  version: number;
  active: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
}

export default function ShortcutsPage() {
  const { t, sidebarOpen, isMobile } = useApp();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [placement, setPlacement] = useState('header');
  const [icon, setIcon] = useState('Zap');
  const [search, setSearch] = useState('');
  const [isMacro, setIsMacro] = useState(false);
  const [macroSteps, setMacroSteps] = useState<Array<{ type: string; target: string }>>([]);

  const { data: actions = [], isLoading } = useQuery<CustomAction[]>({
    queryKey: ['/api/custom-actions'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; target: string; placement: string; icon: string; config?: Record<string, unknown> }) => {
      const res = await apiRequest('POST', '/api/custom-actions', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-actions'] });
      resetForm();
      toast({ title: "Shortcut Created" });
    },
    onError: () => toast({ title: "Failed to create shortcut", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/custom-actions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-actions'] });
      toast({ title: "Shortcut Deleted" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLabel('');
    setTarget('');
    setPlacement('header');
    setIcon('Zap');
    setIsMacro(false);
    setMacroSteps([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || (!isMacro && !target.trim())) return;
    const config = isMacro && macroSteps.length > 0 ? { steps: macroSteps } : undefined;
    createMutation.mutate({
      label: label.trim(),
      target: isMacro ? 'macro' : target.trim(),
      placement,
      icon,
      ...(config ? { config } : {}),
    });
  };

  const executeAction = (action: CustomAction) => {
    if (action.config && Array.isArray((action.config as Record<string, unknown>).steps)) {
      const steps = (action.config as Record<string, unknown>).steps as Array<{ type: string; target: string }>;
      // Log macro execution to server for audit trail
      apiRequest('POST', `/api/custom-actions/${action.id}/execute`).catch(() => {});
      for (const step of steps) {
        if (step.type === 'navigate' && step.target) navigate(step.target);
      }
      toast({ title: "Macro Executed", description: `Ran ${steps.length} steps for "${action.label}"` });
    } else if (action.target.startsWith('/')) {
      navigate(action.target);
    }
  };

  const slashCommands = actions.filter(a => a.placement === 'slash' && a.active);
  const quickActions = actions.filter(a => a.placement === 'header' && a.active);
  const savedPrompts = actions.filter(a => a.placement === 'prompt' && a.active);
  const filteredPrompts = search
    ? savedPrompts.filter(p => p.label.toLowerCase().includes(search.toLowerCase()) || p.target.toLowerCase().includes(search.toLowerCase()))
    : savedPrompts;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-sm border-b transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t('shortcuts')}</h1>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-create-shortcut">
          <Plus className="h-4 w-4" />
          Create New
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6 lg:px-24">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">

          {showForm && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{editingId ? 'Edit' : 'New'} Shortcut</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Label</label>
                      <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Check Returns" required />
                    </div>
                    {!isMacro && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Target / Command</label>
                        <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. /fleet or prompt text" required />
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Placement</label>
                      <select value={placement} onChange={e => setPlacement(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                        <option value="header">Quick Action (Header)</option>
                        <option value="slash">Slash Command</option>
                        <option value="prompt">Saved Prompt</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Icon</label>
                      <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="Zap" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={isMacro} onChange={e => setIsMacro(e.target.checked)} className="rounded" />
                      <List className="h-4 w-4" />
                      Multi-step macro
                    </label>
                  </div>
                  {isMacro && (
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                      <label className="text-sm font-medium">Macro Steps</label>
                      {macroSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select value={step.type} onChange={e => setMacroSteps(prev => prev.map((s, j) => j === i ? { ...s, type: e.target.value } : s))} className="rounded-md border bg-background px-2 py-1 text-sm">
                            <option value="navigate">Navigate</option>
                          </select>
                          <Input value={step.target} onChange={e => setMacroSteps(prev => prev.map((s, j) => j === i ? { ...s, target: e.target.value } : s))} placeholder="/fleet" className="flex-1" />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setMacroSteps(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setMacroSteps(prev => [...prev, { type: 'navigate', target: '' }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add Step
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                      {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {editingId ? 'Update' : 'Create'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Command className="h-5 w-5" />
                  <CardTitle className="text-base">Slash Commands</CardTitle>
                </div>
                <CardDescription>Quick actions available in the chat composer by typing /</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {slashCommands.length > 0 ? slashCommands.map((cmd) => (
                  <div key={cmd.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <code className="text-xs font-bold bg-muted px-2 py-1 rounded">{cmd.target}</code>
                      <span className="text-sm text-muted-foreground">{cmd.label}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(cmd.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No slash commands yet. Create one with placement "Slash Command".</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-orange-500">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-base">Quick Action Buttons</CardTitle>
                </div>
                <CardDescription>Buttons pinned to the header for immediate access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickActions.length > 0 ? quickActions.map((btn) => (
                  <div key={btn.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{btn.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {btn.config && (btn.config as Record<string, unknown>).steps ? `Macro (${(((btn.config as Record<string, unknown>).steps) as unknown[]).length} steps)` : btn.target}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => executeAction(btn)} title="Execute">
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(btn.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No quick actions yet. Create one with placement "Quick Action".</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-blue-500">
                  <MessageSquareQuote className="h-5 w-5" />
                  <CardTitle className="text-base">Saved Prompts</CardTitle>
                </div>
                <CardDescription>Reusable prompt templates for common operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search templates..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredPrompts.length > 0 ? filteredPrompts.map(p => (
                      <div key={p.id} className="p-4 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors group relative">
                        <h4 className="font-semibold text-sm mb-1">{p.label}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.target}</p>
                        <Button variant="ghost" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                        {search ? 'No matching prompts' : 'No saved prompts yet. Create one with placement "Saved Prompt".'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}

// Inline SearchIcon for convenience
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

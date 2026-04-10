import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, BookOpen, Settings, Lightbulb, Database, Shield, Plus, Search, AlertTriangle, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function WorkspaceMemoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: memories } = useQuery({ queryKey: ["/api/workspace-memory"] });
  const allMemories = Array.isArray(memories) ? memories : [];
  const [showCreate, setShowCreate] = React.useState(false);
  const [newCat, setNewCat] = React.useState('policy');
  const [newKey, setNewKey] = React.useState('');
  const [newVal, setNewVal] = React.useState('');
  const [askQuery, setAskQuery] = React.useState('');
  const [askResult, setAskResult] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const canWrite = user && ['admin', 'supervisor'].includes(user.role);

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/workspace-memory", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace-memory"] }); setShowCreate(false); setNewKey(''); setNewVal(''); toast({ title: "Memory saved" }); },
  });

  const categories = ['policy', 'sop', 'preference', 'threshold', 'integration', 'philosophy'];
  const catIcons: Record<string, any> = { policy: Shield, sop: BookOpen, preference: Settings, threshold: Database, integration: Lightbulb, philosophy: Brain };
  const catColors: Record<string, string> = { policy: 'text-blue-400', sop: 'text-green-400', preference: 'text-purple-400', threshold: 'text-yellow-400', integration: 'text-cyan-400', philosophy: 'text-pink-400' };

  const grouped = categories.reduce((acc, cat) => { acc[cat] = allMemories.filter((m: any) => m.category === cat); return acc; }, {} as Record<string, any[]>);

  const filtered = searchTerm ? allMemories.filter((m: any) =>
    m.key.toLowerCase().includes(searchTerm.toLowerCase()) || m.value.toLowerCase().includes(searchTerm.toLowerCase())
  ) : allMemories;

  const staleEntries = allMemories.filter((m: any) => {
    const updated = new Date(m.updatedAt);
    const daysSince = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 90;
  });

  const handleAsk = () => {
    const lower = askQuery.toLowerCase();
    const matches = allMemories.filter((m: any) =>
      m.key.toLowerCase().includes(lower) || m.value.toLowerCase().includes(lower) || m.category.toLowerCase().includes(lower)
    );
    if (matches.length > 0) {
      setAskResult(`Found ${matches.length} relevant entries:\n${matches.map((m: any) => `• [${m.category}] ${m.key}: ${m.value}`).join('\n')}`);
    } else {
      setAskResult(`No matching entries found for "${askQuery}". Consider adding this as a new memory entry.`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-5 w-5 text-primary" /> Workspace Memory & Knowledge
          </h1>
          <p className="text-sm text-muted-foreground">Organizational genome, SOPs, AI learning, ask-document mode, and stale detection</p>
        </div>
        {canWrite && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-memory"><Plus className="h-4 w-4" /> Add Memory</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Workspace Memory</DialogTitle>
                <DialogDescription>Teach the AI a new organizational rule, preference, or operational pattern.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger data-testid="select-memory-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Key (e.g., max_shift_hours)..." value={newKey} onChange={e => setNewKey(e.target.value)} data-testid="input-memory-key" />
                <Textarea placeholder="Value (e.g., 10 hours maximum per shift)..." value={newVal} onChange={e => setNewVal(e.target.value)} data-testid="input-memory-value" />
                <Button className="w-full" disabled={!newKey.trim() || !newVal.trim()} data-testid="button-save-memory"
                  onClick={() => createMutation.mutate({ category: newCat, key: newKey, value: newVal, source: 'admin', confidence: 1.0 })}>
                  Save to Memory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
          <Card className="glass-panel border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Ask the Knowledge Base</h3>
              </div>
              <div className="flex gap-2">
                <Input placeholder='Ask anything... e.g. "What is our SLA for standard wash?"'
                  value={askQuery} onChange={e => setAskQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askQuery.trim() && handleAsk()}
                  className="flex-1" data-testid="input-ask-memory" />
                <Button onClick={handleAsk} disabled={!askQuery.trim()} className="gap-2" data-testid="button-ask">
                  <Sparkles className="h-4 w-4" /> Ask
                </Button>
              </div>
              {askResult && (
                <div className="mt-3 bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-line">{askResult}</div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(cat => {
              const Icon = catIcons[cat] || Database;
              return (
                <Card key={cat} className="glass-panel hover:border-primary/30 cursor-pointer transition-colors" data-testid={`category-${cat}`}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${catColors[cat]}`} />
                    <div>
                      <p className="text-lg font-bold">{grouped[cat]?.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{cat}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {staleEntries.length > 0 && (
            <Card className="glass-card border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-400 mb-1">Stale Entries Detected</h4>
                  <p className="text-xs text-muted-foreground mb-2">{staleEntries.length} entries haven't been updated in over 90 days. Consider reviewing for accuracy.</p>
                  <div className="flex flex-wrap gap-1">
                    {staleEntries.slice(0, 5).map((m: any) => (
                      <Badge key={m.id} variant="outline" className="text-[9px] border-yellow-500/30">{m.key}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search memories..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-memory" />
            </div>
            <Badge variant="outline">{filtered.length} entries</Badge>
          </div>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              {categories.map(c => <TabsTrigger key={c} value={c} className="capitalize text-xs" data-testid={`tab-${c}`}>{c}</TabsTrigger>)}
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {filtered.map((mem: any) => {
                const Icon = catIcons[mem.category] || Database;
                const isStale = staleEntries.some(s => s.id === mem.id);
                return (
                  <Card key={mem.id} className={`glass-card ${isStale ? 'border-yellow-500/20' : ''}`} data-testid={`memory-${mem.id}`}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Icon className={`h-5 w-5 ${catColors[mem.category]} shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm">{mem.key}</h3>
                          <Badge variant="outline" className="text-[9px] capitalize">{mem.category}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{mem.source}</Badge>
                          {mem.confidence < 1 && <Badge variant="outline" className="text-[9px]">{Math.round(mem.confidence * 100)}%</Badge>}
                          {isStale && <Badge className="text-[9px] bg-yellow-500/20 text-yellow-400">Stale</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{mem.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Updated: {new Date(mem.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length === 0 && (
                <Card className="glass-panel border-dashed p-8 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <h3 className="font-semibold mb-1">{searchTerm ? 'No matching entries' : 'Empty Workspace Memory'}</h3>
                  <p className="text-sm text-muted-foreground">{searchTerm ? 'Try a different search term.' : 'Add policies, SOPs, and preferences to build the workspace genome.'}</p>
                </Card>
              )}
            </TabsContent>

            {categories.map(cat => (
              <TabsContent key={cat} value={cat} className="mt-4 space-y-3">
                {(grouped[cat] || []).map((mem: any) => (
                  <Card key={mem.id} className="glass-card" data-testid={`memory-${mem.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{mem.key}</h3>
                        <Badge variant="secondary" className="text-[9px]">{mem.source}</Badge>
                        {mem.confidence < 1 && <Badge variant="outline" className="text-[9px]">{Math.round(mem.confidence * 100)}%</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{mem.value}</p>
                    </CardContent>
                  </Card>
                ))}
                {(!grouped[cat] || grouped[cat].length === 0) && (
                  <div className="py-8 text-center"><p className="text-sm text-muted-foreground">No {cat} entries yet.</p></div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {canWrite && (
            <Card className="glass-panel border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">SOP Generator</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">AI can generate Standard Operating Procedures based on patterns from chat discussions, resolved incidents, and operational data.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-gen-sop-wash">Generate Wash SOP</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-gen-sop-damage">Generate Damage SOP</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-gen-sop-shift">Generate Shift SOP</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

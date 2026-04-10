import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, UploadCloud, RefreshCw, BookOpen, Search, Brain, MessageSquare, Sparkles, Shield } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { useEntitlements } from "@/lib/useEntitlements";
import { LockedFeature } from "@/components/LockedFeature";

export default function KnowledgeBasePage() {
  const { data: memories } = useQuery({ queryKey: ["/api/workspace-memory"] });
  const { hasFeature } = useEntitlements();
  const allMemories = Array.isArray(memories) ? memories : [];
  const [searchTerm, setSearchTerm] = React.useState('');
  const [askQuery, setAskQuery] = React.useState('');
  const [askResult, setAskResult] = React.useState<string | null>(null);

  const sources = [
    { name: 'Company Manuals', count: 12, icon: FileText, color: 'text-blue-400' },
    { name: 'Vehicle Specs', count: 45, icon: Database, color: 'text-green-400' },
    { name: 'Insurance Policies', count: 3, icon: Shield, color: 'text-purple-400' },
    { name: 'SOPs', count: allMemories.filter((m: any) => m.category === 'sop').length, icon: BookOpen, color: 'text-cyan-400' },
    { name: 'AI Learned', count: allMemories.filter((m: any) => m.source === 'ai').length, icon: Brain, color: 'text-pink-400' },
  ];

  const documents = [
    { name: 'SOP_Vehicle_Checkout.pdf', size: '2.4 MB', date: '2 days ago', type: 'SOP', indexed: true },
    { name: 'Cleaning_Standards_2026.docx', size: '1.1 MB', date: '1 week ago', type: 'Manual', indexed: true },
    { name: 'Emergency_Protocols.pdf', size: '3.8 MB', date: '1 month ago', type: 'SOP', indexed: true },
    { name: 'Employee_Handbook.pdf', size: '5.2 MB', date: '3 months ago', type: 'HR', indexed: true },
    { name: 'Insurance_Guide_2026.pdf', size: '1.8 MB', date: '2 months ago', type: 'Insurance', indexed: true },
    { name: 'Damage_Assessment_Guide.pdf', size: '3.1 MB', date: '1 month ago', type: 'SOP', indexed: true },
  ];

  const filteredDocs = searchTerm
    ? documents.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.type.toLowerCase().includes(searchTerm.toLowerCase()))
    : documents;

  const handleAsk = () => {
    const lower = askQuery.toLowerCase();
    const memMatches = allMemories.filter((m: any) =>
      m.key?.toLowerCase().includes(lower) || m.value?.toLowerCase().includes(lower)
    );
    const docMatches = documents.filter(d => d.name.toLowerCase().includes(lower) || d.type.toLowerCase().includes(lower));

    let result = '';
    if (memMatches.length > 0) {
      result += `Found ${memMatches.length} workspace memory entries:\n${memMatches.map((m: any) => `  [${m.category}] ${m.key}: ${m.value}`).join('\n')}\n\n`;
    }
    if (docMatches.length > 0) {
      result += `Found ${docMatches.length} related documents:\n${docMatches.map(d => `  ${d.name} (${d.type})`).join('\n')}`;
    }
    if (!result) result = `No matching results for "${askQuery}". Try different keywords or upload relevant documents.`;
    setAskResult(result);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-5 w-5 text-primary" /> Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">Documents, SOPs, AI-indexed knowledge, and ask-document mode</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" data-testid="button-sync"><RefreshCw className="h-3 w-3" /> Sync</Button>
          <LockedFeature locked={!hasFeature("knowledge_ingestion")}>
            <Button size="sm" className="gap-2" data-testid="button-upload"><UploadCloud className="h-4 w-4" /> Upload</Button>
          </LockedFeature>
        </div>
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
                <Input placeholder='Ask anything... e.g. "What is the checkout procedure?" or "How to handle damage claims?"'
                  value={askQuery} onChange={e => setAskQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askQuery.trim() && handleAsk()}
                  className="flex-1" data-testid="input-ask-kb" />
                <Button onClick={handleAsk} disabled={!askQuery.trim()} className="gap-2" data-testid="button-ask-kb">
                  <Sparkles className="h-4 w-4" /> Ask
                </Button>
              </div>
              {askResult && (
                <div className="mt-3 bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-line">{askResult}</div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {sources.map((src, i) => (
              <Card key={i} className="glass-panel hover:border-primary/30 cursor-pointer transition-colors">
                <CardContent className="p-3 flex items-center gap-2">
                  <src.icon className={`h-4 w-4 ${src.color}`} />
                  <div>
                    <p className="text-lg font-bold">{src.count}</p>
                    <p className="text-[10px] text-muted-foreground">{src.name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="documents">
            <TabsList>
              <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
              <TabsTrigger value="memory" data-testid="tab-memory">AI Memory ({allMemories.length})</TabsTrigger>
              <TabsTrigger value="training" data-testid="tab-training">Training Mode</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4 space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search documents..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-docs" />
              </div>

              <Card className="glass-panel">
                <CardContent className="p-0 divide-y">
                  {filteredDocs.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`doc-item-${i}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{file.size}</span>
                            <Badge variant="outline" className="text-[8px] h-4">{file.type}</Badge>
                            {file.indexed && <Badge className="text-[8px] h-4 bg-green-500/20 text-green-400">Indexed</Badge>}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{file.date}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="memory" className="mt-4 space-y-3">
              {allMemories.slice(0, 10).map((mem: any) => (
                <Card key={mem.id} className="glass-card" data-testid={`kb-memory-${mem.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{mem.key}</span>
                        <Badge variant="outline" className="text-[8px] capitalize">{mem.category}</Badge>
                        <Badge variant="secondary" className="text-[8px]">{mem.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{mem.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {allMemories.length === 0 && (
                <Card className="glass-panel border-dashed p-8 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground">No AI memory entries yet. The system learns from operations, chat, and manual input.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="training" className="mt-4 space-y-4">
              <Card className="glass-panel border-primary/20">
                <CardContent className="p-6 text-center">
                  <BookOpen className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Training Mode</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Interactive learning sessions for new staff. AI generates quizzes from SOPs, vehicle specs, and company policies.
                  </p>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-4">
                    <div className="bg-muted/30 rounded-lg p-3"><p className="text-lg font-bold text-green-400">12</p><p className="text-[10px] text-muted-foreground">SOPs Available</p></div>
                    <div className="bg-muted/30 rounded-lg p-3"><p className="text-lg font-bold text-blue-400">45</p><p className="text-[10px] text-muted-foreground">Quiz Questions</p></div>
                    <div className="bg-muted/30 rounded-lg p-3"><p className="text-lg font-bold text-purple-400">3</p><p className="text-[10px] text-muted-foreground">Active Courses</p></div>
                  </div>
                  <Button data-testid="button-start-training">Start Training Session</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

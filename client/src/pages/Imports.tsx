import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileUp, Wand2, Database, AlertCircle, FileSpreadsheet, Upload, CheckCircle2,
  Loader2, Table2, ArrowRight, X, Eye, Download,
  RotateCcw, Trash2, Brain
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface ImportRecord {
  id: number;
  filename: string;
  status: string;
  uploadedBy: number;
  records: number;
  columns: number;
  mappings: Array<{ source: string; target: string; confidence: number }> | null;
  diffs: { added: number; updated: number; deleted: number; conflicts: number } | null;
  fileType: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function ImportsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('active');
  const [dragOver, setDragOver] = useState(false);
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: importsList = [], isLoading } = useQuery<ImportRecord[]>({
    queryKey: ['/api/imports'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const createImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'csv';
      const res = await apiRequest('POST', '/api/imports', {
        filename: file.name,
        status: 'uploading',
        fileType: ext,
        records: 0,
        columns: 0,
      });
      return res.json();
    },
    onSuccess: async (data: ImportRecord) => {
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      toast({ title: "Import Created", description: `${data.filename} — processing started.` });
      // Trigger server-side processing pipeline
      try {
        await apiRequest('POST', `/api/imports/${data.id}/process`);
        queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      } catch {/* no-op */}
    },
    onError: () => toast({ title: "Upload Failed", description: "Could not create import job.", variant: "destructive" }),
  });

  const commitImportMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/imports/${id}/apply`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setSelectedImport(null);
      setShowDiffView(false);
      toast({ title: "Import Applied", description: `${data.applied} records applied successfully.${data.errors?.length ? ` ${data.errors.length} errors.` : ''}` });
    },
    onError: () => toast({ title: "Apply Failed", description: "The import could not be applied. Check if the data is still valid and try again.", variant: "destructive" }),
  });

  const discardImportMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/imports/${id}/fail`, { errorMessage: 'Discarded by user' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      setSelectedImport(null);
      setShowDiffView(false);
      toast({ title: "Import Discarded" });
    },
    onError: () => toast({ title: "Discard Failed", description: "Could not discard this import. Refresh and try again.", variant: "destructive" }),
  });

  const retryImportMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/imports/${id}/retry`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      setSelectedImport(null);
      toast({ title: "Retrying Import", description: "Import has been queued for re-processing." });
    },
    onError: () => toast({ title: "Retry Failed", description: "Could not retry this import. The file may need to be re-uploaded.", variant: "destructive" }),
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploading(true);
      createImportMutation.mutate(file, { onSettled: () => setUploading(false) });
    }
  }, [createImportMutation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      createImportMutation.mutate(file, { onSettled: () => setUploading(false) });
    }
    if (e.target) e.target.value = '';
  };

  const activeImports = importsList.filter(i => !['completed', 'failed'].includes(i.status));
  const completedImports = importsList.filter(i => i.status === 'completed');
  const failedImports = importsList.filter(i => i.status === 'failed');

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-imports-title">Data Imports & Intelligence</h1>
          <p className="text-sm text-muted-foreground">Upload enterprise data, map columns with AI, and review diffs before commit.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.csv,.json,.pdf" className="hidden" />
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()} data-testid="button-new-import">
            <FileUp className="h-4 w-4"/> New Import
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
          <Card
            className={`border-dashed border-2 transition-all ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'bg-muted/10'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              {uploading ? (
                <>
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Uploading & Analyzing...</h3>
                  <p className="text-sm text-muted-foreground">Creating import job...</p>
                </>
              ) : (
                <>
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-primary/20' : 'bg-primary/10'}`}>
                    <Upload className={`h-8 w-8 ${dragOver ? 'text-primary animate-bounce' : 'text-primary'}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {dragOver ? 'Drop file here' : 'Drag and drop files here'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Supports XLSX, CSV, PDF reports, and JSON. AI will auto-map columns.</p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-browse-files">Browse Files</Button>
                </>
              )}
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="active" className="gap-2">
                Active
                {activeImports.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeImports.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed" className="gap-2">
                Failed
                {failedImports.length > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{failedImports.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 space-y-4">
              {activeImports.length > 0 ? activeImports.map(imp => (
                <ImportCard key={imp.id} data={imp} onSelect={() => setSelectedImport(imp)} onDiff={() => { setSelectedImport(imp); setShowDiffView(true); }} onDiscard={() => discardImportMutation.mutate(imp.id)} />
              )) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-3 text-green-500/50" />
                    <p className="text-sm font-medium">No active imports</p>
                    <p className="text-xs">Upload a file to get started</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4 space-y-4">
              {completedImports.length > 0 ? completedImports.map(imp => (
                <ImportCard key={imp.id} data={imp} onSelect={() => setSelectedImport(imp)} onDiff={() => {}} />
              )) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
                    <Database className="h-10 w-10 mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No completed imports yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="failed" className="mt-4 space-y-4">
              {failedImports.length > 0 ? failedImports.map(imp => (
                <Card key={imp.id} className="border-red-500/20" data-testid={`import-card-${imp.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10">
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{imp.filename}</h4>
                          <p className="text-xs text-muted-foreground">{imp.records} records — {new Date(imp.createdAt).toLocaleDateString()}</p>
                          {imp.errorMessage && <p className="text-xs text-red-400 mt-1">{imp.errorMessage}</p>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => retryImportMutation.mutate(imp.id)} disabled={retryImportMutation.isPending} data-testid={`button-retry-${imp.id}`}>
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-3 text-green-500/50" />
                    <p className="text-sm font-medium">No failed imports</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="templates" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Vehicle Fleet Import', desc: 'Standard vehicle data with plates, make, model, status', icon: <FileSpreadsheet /> },
                  { name: 'Staff Roster', desc: 'Employee names, roles, stations, schedules', icon: <FileSpreadsheet /> },
                  { name: 'Reservation Batch', desc: 'Customer reservations with dates, vehicles, pricing', icon: <FileSpreadsheet /> },
                  { name: 'Station Configuration', desc: 'Station settings, SLA rules, operating hours', icon: <FileSpreadsheet /> },
                ].map((tmpl, i) => (
                  <Card key={i} className="hover:border-primary/30 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {React.cloneElement(tmpl.icon, { className: "h-5 w-5 text-primary" })}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{tmpl.name}</h4>
                        <p className="text-xs text-muted-foreground">{tmpl.desc}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          )}

          {selectedImport && (
            <Card className="border-primary/30 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{selectedImport.filename}</CardTitle>
                      <CardDescription>{selectedImport.records} records, {selectedImport.columns} columns</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedImport(null); setShowDiffView(false); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
              {!showDiffView && selectedImport.mappings && selectedImport.mappings.length > 0 && (
                  <>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-primary" /> AI Column Mappings
                    </h4>
                    <div className="space-y-2">
                      {selectedImport.mappings.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border">
                          <span className="text-sm font-medium w-40 truncate">{m.source}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-mono text-primary w-32 truncate">{m.target}</span>
                          <div className="flex-1" />
                          <Badge variant={m.confidence > 0.9 ? 'default' : m.confidence > 0.8 ? 'secondary' : 'outline'}
                            className={`text-[10px] ${m.confidence > 0.9 ? 'bg-green-500/20 text-green-400 border-green-500/30' : m.confidence > 0.8 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30'}`}>
                            {Math.round(m.confidence * 100)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {(showDiffView || !selectedImport.mappings?.length) && selectedImport.diffs && (
                  <>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-primary" /> Diff Preview
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="text-2xl font-bold text-green-400">+{selectedImport.diffs.added}</div>
                        <div className="text-xs text-muted-foreground">New Records</div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="text-2xl font-bold text-amber-400">~{selectedImport.diffs.updated}</div>
                        <div className="text-xs text-muted-foreground">Updates</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="text-2xl font-bold text-muted-foreground">-{selectedImport.diffs.deleted}</div>
                        <div className="text-xs text-muted-foreground">Deletions</div>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400">{selectedImport.diffs.conflicts}</div>
                        <div className="text-xs text-muted-foreground">Conflicts</div>
                      </div>
                    </div>
                    {selectedImport.diffs.conflicts > 0 && (
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                        <div className="flex items-center gap-2 text-red-400 font-semibold mb-1">
                          <AlertCircle className="h-4 w-4" /> {selectedImport.diffs.conflicts} Conflicts Detected
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedImport.diffs.conflicts} records have conflicting values. Review required before commit.</p>
                      </div>
                    )}
                  </>
                )}

                {selectedImport.status === 'reviewing' && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button className="gap-2" onClick={() => commitImportMutation.mutate(selectedImport.id)} disabled={commitImportMutation.isPending} data-testid="button-commit-import">
                      {commitImportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Commit Import
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setShowDiffView(!showDiffView)}>
                      <Eye className="h-4 w-4" /> {showDiffView ? 'Show Mappings' : 'Show Diffs'}
                    </Button>
                    <Button variant="ghost" className="gap-2 text-destructive" onClick={() => discardImportMutation.mutate(selectedImport.id)} disabled={discardImportMutation.isPending}>
                      <Trash2 className="h-4 w-4" /> Discard
                    </Button>
                  </div>
                )}

                {selectedImport.status === 'failed' && (
                  <div className="space-y-3 pt-2">
                    {selectedImport.errorMessage && (
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                        <div className="flex items-center gap-2 text-red-400 font-semibold mb-1">
                          <AlertCircle className="h-4 w-4" /> Import Failed
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedImport.errorMessage}</p>
                      </div>
                    )}
                    <Button variant="outline" className="gap-2" onClick={() => retryImportMutation.mutate(selectedImport.id)} disabled={retryImportMutation.isPending} data-testid="button-retry-import">
                      {retryImportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry Import
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ImportCard({ data, onSelect, onDiff, onDiscard }: { data: ImportRecord; onSelect: () => void; onDiff: () => void; onDiscard?: () => void }) {
  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    uploading: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Uploading', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    mapping: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'AI Mapping', icon: <Brain className="h-3 w-3" /> },
    reviewing: { color: 'bg-primary/20 text-primary border-primary/30', label: 'Needs Review', icon: <Eye className="h-3 w-3" /> },
    completed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Completed', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed', icon: <AlertCircle className="h-3 w-3" /> },
  };

  const config = statusConfig[data.status] || statusConfig['uploading'];
  const timeAgo = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '';

  return (
    <Card className={`hover:border-primary/30 transition-colors cursor-pointer ${data.status === 'reviewing' ? 'border-primary/40 shadow-primary/5' : data.status === 'completed' ? 'opacity-70' : ''}`}
      onClick={onSelect} data-testid={`import-card-${data.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${data.status === 'reviewing' ? 'bg-primary/20' : data.status === 'completed' ? 'bg-muted' : 'bg-blue-500/20'}`}>
              {data.status === 'reviewing' ? <Wand2 className="h-5 w-5 text-primary" /> : <Database className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">{data.filename}</h4>
                <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                  {config.icon} <span className="ml-1">{config.label}</span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {data.records} records, {data.columns} columns — {timeAgo}
              </p>
              {data.diffs && (
                <div className="flex items-center gap-4 text-xs font-medium bg-muted/50 p-2 rounded-md border">
                  <span className="text-green-500">+{data.diffs.added} New</span>
                  <span className="text-yellow-500">~{data.diffs.updated} Updates</span>
                  <span className="text-muted-foreground">-{data.diffs.deleted} Deletions</span>
                  {data.diffs.conflicts > 0 && <span className="text-red-400">{data.diffs.conflicts} Conflicts</span>}
                </div>
              )}
            </div>
          </div>
          {data.status === 'reviewing' && (
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onDiff(); }} data-testid={`button-review-${data.id}`}>Review Diffs</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); onDiscard?.(); }} data-testid={`button-discard-${data.id}`}>Discard</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

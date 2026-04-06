import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Droplets, CheckCircle2, Undo2, Camera, Clock, Zap, AlertTriangle, Sun, Hand, BarChart3, TrendingUp, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WASH_TYPES = ['Quick Wash', 'Full Detail', 'Interior Only', 'Exterior Only'];
const NUM_PAD = ['1','2','3','4','5','6','7','8','9','0','-','⌫'];

export default function WasherRegister() {
  const queryClient = useQueryClient();
  const [plates, setPlates] = useState('');
  const [selectedType, setSelectedType] = useState('Quick Wash');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [gloveMode, setGloveMode] = useState(false);
  const [sunMode, setSunMode] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('washer-offline-queue') || '[]'); } catch { return []; }
  });

  // Persist offlineQueue to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('washer-offline-queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Flush offline queue when online
  const flushOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    const toFlush = [...offlineQueue];
    const remaining: any[] = [];
    for (const item of toFlush) {
      try {
        await apiRequest("POST", "/api/wash-queue", { vehiclePlate: item.vehiclePlate, washType: item.washType, priority: "Normal", status: "pending", slaInfo: "OK" });
      } catch {
        remaining.push(item);
      }
    }
    setOfflineQueue(remaining);
    if (remaining.length < toFlush.length) {
      queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] });
    }
  }, [offlineQueue, queryClient]);

  useEffect(() => {
    const onOnline = () => { flushOfflineQueue(); };
    window.addEventListener('online', onOnline);
    // Also try flushing on mount in case we came back online
    if (navigator.onLine && offlineQueue.length > 0) flushOfflineQueue();
    return () => window.removeEventListener('online', onOnline);
  }, [flushOfflineQueue]);

  const { data: queueData } = useQuery({ queryKey: ["/api/wash-queue"] });
  const queue = Array.isArray(queueData) ? queueData.filter((q: any) => q.status !== 'completed') : [];
  const completedToday = Array.isArray(queueData) ? queueData.filter((q: any) => q.status === 'completed').length : 0;

  const isDuplicate = (plate: string) => queue.some((q: any) => q.vehiclePlate === plate.toUpperCase() && q.status !== 'completed');

  const addMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/wash-queue", { vehiclePlate: plates.toUpperCase(), washType: selectedType, priority: "Normal", status: "pending", slaInfo: "OK" }); },
    onSuccess: () => { setLastAdded(plates.toUpperCase()); setPlates(''); queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] }); setTimeout(() => setLastAdded(null), 3000); },
    onError: () => { setOfflineQueue(prev => [...prev, { vehiclePlate: plates.toUpperCase(), washType: selectedType, timestamp: Date.now() }]); setPlates(''); },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/wash-queue/${id}`, { status: "completed" }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] }),
  });

  const undoMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/wash-queue/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] }); setLastAdded(null); },
  });

  const handleNumPad = (key: string) => {
    if (key === '⌫') setPlates(p => p.slice(0, -1));
    else setPlates(p => p + key);
  };

  const urgentItems = queue.filter((q: any) => q.priority === 'Urgent');
  const normalItems = queue.filter((q: any) => q.priority !== 'Urgent');
  const sortedQueue = [...urgentItems, ...normalItems];

  const buttonSize = gloveMode ? 'h-20 text-2xl' : 'h-14 text-xl';
  const mainBtnSize = gloveMode ? 'h-24 text-2xl' : 'h-16 text-xl';

  return (
    <div className={`flex flex-col h-full ${sunMode ? 'bg-white text-black' : 'bg-background'}`}>
      <header className={`flex items-center justify-between px-4 h-14 border-b shrink-0 ${sunMode ? 'bg-white border-gray-200' : 'bg-background/95'}`}>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <Droplets className={`h-5 w-5 ${sunMode ? 'text-blue-600' : 'text-primary'}`} /> Wash Queue
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{queue.length} pending</Badge>
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${gloveMode ? 'bg-primary/20' : ''}`} onClick={() => setGloveMode(!gloveMode)} title="Glove Mode" data-testid="button-glove-mode">
            <Hand className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${sunMode ? 'bg-yellow-200' : ''}`} onClick={() => setSunMode(!sunMode)} title="Sun Mode" data-testid="button-sun-mode">
            <Sun className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSummary(true)} title="Shift Summary" data-testid="button-shift-summary">
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {lastAdded && (
        <div className={`border-b px-4 py-3 flex items-center justify-between ${sunMode ? 'bg-green-50 border-green-200' : 'bg-green-500/10 border-green-500/20'}`} data-testid="undo-bar">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className={`text-sm font-medium ${sunMode ? 'text-green-700' : 'text-green-400'}`}>{lastAdded} added</span>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { const last = queue[0]; if (last) undoMutation.mutate(last.id); }} data-testid="button-undo">
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
        </div>
      )}

      {offlineQueue.length > 0 && (
        <div className={`px-4 py-2 flex items-center gap-2 border-b ${sunMode ? 'bg-yellow-50' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-xs text-yellow-500">{offlineQueue.length} item(s) queued offline — will sync when connection restores</span>
        </div>
      )}

      <div className={`p-4 border-b shrink-0 space-y-3 ${sunMode ? 'bg-gray-50' : 'bg-muted/20'}`}>
        <div className={`rounded-xl p-4 border shadow-sm ${sunMode ? 'bg-white border-gray-300' : 'bg-background'}`}>
          <input value={plates} onChange={(e) => setPlates(e.target.value.toUpperCase())}
            placeholder="ΠΙΝΑΚΙΔΑ / PLATE"
            className={`w-full text-center font-bold font-mono tracking-[0.3em] bg-transparent border-none focus:outline-none uppercase ${gloveMode ? 'text-4xl h-20' : 'text-3xl h-16'} ${sunMode ? 'text-black placeholder:text-gray-400' : ''}`}
            data-testid="input-plate" />
        </div>

        {isDuplicate(plates) && plates.length >= 3 && (
          <div className={`rounded-lg p-2 flex items-center gap-2 text-sm ${sunMode ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <Shield className="h-4 w-4" /> This plate is already in the queue
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {NUM_PAD.map(key => (
            <Button key={key} variant="outline" className={`${buttonSize} font-bold ${sunMode ? 'bg-white border-gray-300 text-black hover:bg-gray-100' : ''}`}
              onClick={() => handleNumPad(key)} data-testid={`numpad-${key}`}>{key}</Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {WASH_TYPES.map(type => (
            <Button key={type} variant={selectedType === type ? 'default' : 'outline'}
              className={`${gloveMode ? 'h-16 text-base' : 'h-12 text-sm'} font-medium ${selectedType !== type && sunMode ? 'bg-white text-gray-600 border-gray-300' : selectedType !== type ? 'text-muted-foreground' : ''}`}
              onClick={() => setSelectedType(type)} data-testid={`wash-type-${type.replace(/\s/g,'-').toLowerCase()}`}>{type}</Button>
          ))}
        </div>

        <Button className={`w-full ${mainBtnSize} font-bold gap-3 rounded-xl ${sunMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          disabled={plates.length < 3 || addMutation.isPending || isDuplicate(plates)}
          onClick={() => addMutation.mutate()} data-testid="button-add-to-queue">
          <Zap className="h-6 w-6" /> ADD TO QUEUE
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-medium ${sunMode ? 'text-gray-500' : 'text-muted-foreground'}`}>Active Queue ({queue.length})</h2>
          <Badge variant="outline" className="text-[10px]">{completedToday} done today</Badge>
        </div>
        <div className="space-y-3">
          {sortedQueue.map((q: any) => (
            <Card key={q.id} className={`${q.priority === 'Urgent' ? (sunMode ? 'border-red-300 bg-red-50' : 'border-destructive/50') : ''} ${sunMode ? 'bg-white border-gray-200' : 'glass-card'}`} data-testid={`queue-item-${q.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className={`${gloveMode ? 'text-3xl' : 'text-2xl'} font-bold font-mono`}>{q.vehiclePlate}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{q.washType}</Badge>
                      {q.assignedTo && <Badge variant="outline" className="text-xs">{q.assignedTo}</Badge>}
                      {q.status === 'in_progress' && <Badge className="bg-blue-500/20 text-blue-400 text-xs">In Progress</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {q.priority === 'Urgent' && <Badge variant="destructive" className="text-xs uppercase">Urgent</Badge>}
                    {q.slaInfo && q.slaInfo !== 'OK' && <span className="text-[10px] text-destructive">{q.slaInfo}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className={`flex-1 ${gloveMode ? 'h-20 text-xl' : 'h-14 text-lg'} bg-green-600 hover:bg-green-700 text-white gap-2 rounded-xl`}
                    onClick={() => completeMutation.mutate(q.id)} data-testid={`button-complete-${q.id}`}>
                    <CheckCircle2 className="h-5 w-5" /> Done
                  </Button>
                  <Button variant="outline" className={`${gloveMode ? 'h-20 w-20' : 'h-14 w-14'} rounded-xl`} data-testid={`button-photo-${q.id}`}>
                    <Camera className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {queue.length === 0 && (
            <div className="text-center py-12">
              <Droplets className={`h-10 w-10 mx-auto mb-2 opacity-20 ${sunMode ? 'text-gray-400' : 'text-muted-foreground'}`} />
              <p className={sunMode ? 'text-gray-500' : 'text-muted-foreground'}>Queue is empty. Add a vehicle above.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Shift Summary</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{completedToday}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-400">{queue.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">{completedToday + queue.length}</p>
                <p className="text-xs text-muted-foreground">Total Today</p>
              </div>
            </div>
            <Card className="glass-panel">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Performance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Wash Time</span><span className="font-medium">38 min</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SLA Compliance</span><span className="font-medium text-green-400">94%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rework Rate</span><span className="font-medium">3%</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

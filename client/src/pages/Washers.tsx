import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Droplets, CheckCircle2, QrCode, MonitorSmartphone, Loader2, Plus } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { WashQueueItem } from "@shared/schema";

export default function WashersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newItem, setNewItem] = React.useState({ vehiclePlate: '', washType: 'Quick Wash', priority: 'Normal' });

  const { data: queue, isLoading } = useQuery<WashQueueItem[]>({
    queryKey: ["/api/wash-queue"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/wash-queue", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] });
      toast({ title: "Added to queue" });
      setDialogOpen(false);
      setNewItem({ vehiclePlate: '', washType: 'Quick Wash', priority: 'Normal' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/wash-queue/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] });
      toast({ title: "Queue updated" });
    },
  });

  const items = Array.isArray(queue) ? queue : [];
  const pending = items.filter(i => i.status === 'pending' || i.status === 'in_progress');
  const completed = items.filter(i => i.status === 'completed');

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Washers Queue</h1>
          <p className="text-sm text-muted-foreground">Manage wash operations, QC, and throughput.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open('/washer', '_blank')}>
            <MonitorSmartphone className="h-4 w-4" /> Launch Kiosk
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-wash"><Plus className="h-4 w-4" /> Add to Queue</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add to Wash Queue</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newItem); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Vehicle Plate</Label>
                  <Input value={newItem.vehiclePlate} onChange={e => setNewItem({...newItem, vehiclePlate: e.target.value})} required data-testid="input-wash-plate" />
                </div>
                <div className="space-y-2">
                  <Label>Wash Type</Label>
                  <Select value={newItem.washType} onValueChange={v => setNewItem({...newItem, washType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quick Wash">Quick Wash</SelectItem>
                      <SelectItem value="Full Detail">Full Detail</SelectItem>
                      <SelectItem value="Interior Only">Interior Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newItem.priority} onValueChange={v => setNewItem({...newItem, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-submit-wash">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add to Queue
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Live Queue <Badge variant="secondary" data-testid="badge-pending-count">{pending.length} Pending</Badge>
                </h2>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-3 content-visibility-auto">
                  {pending.map((item) => (
                    <Card key={item.id} className={`glass-card ${item.priority === 'Urgent' ? 'border-l-4 border-l-destructive' : ''}`} data-testid={`card-wash-${item.id}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Droplets className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-bold text-lg">{item.vehiclePlate}</div>
                            <div className="text-sm text-muted-foreground">{item.washType}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.priority === 'Urgent' && <span className="text-xs text-destructive font-medium">{item.slaInfo}</span>}
                          <span className="text-sm font-medium">{item.assignedTo || 'Unassigned'}</span>
                          {!item.assignedTo ? (
                            <Button size="sm" onClick={() => updateMutation.mutate({ id: item.id, data: { assignedTo: 'Staff', status: 'in_progress' } })} data-testid={`button-assign-${item.id}`}>
                              Assign
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => updateMutation.mutate({ id: item.id, data: { status: 'completed' } })} data-testid={`button-complete-${item.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pending.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Droplets className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Queue is clear!</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="glass-panel">
                <CardHeader><CardTitle className="text-base">Today's Throughput</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Total Completed</span>
                    <span className="font-bold text-xl" data-testid="text-completed-count">{completed.length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">In Queue</span>
                    <span className="font-bold text-xl">{pending.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 text-center space-y-3">
                  <QrCode className="h-10 w-10 mx-auto text-primary opacity-50" />
                  <h3 className="font-semibold">Washer Kiosk Ready</h3>
                  <p className="text-xs text-muted-foreground">Washers can access their queue without logging in.</p>
                  <Button variant="outline" className="w-full text-xs h-8" onClick={() => window.open('/washer', '_blank')}>Open Kiosk</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

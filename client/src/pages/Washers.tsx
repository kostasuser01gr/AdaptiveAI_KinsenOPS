import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Droplets, CheckCircle2, QrCode, MonitorSmartphone, Loader2, Plus, Users2, Sparkles, Download } from 'lucide-react';
import { exportToCsv } from '@/lib/csv';
import { Empty, EmptyContent, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Badge } from "@/components/ui/badge";
import { MotionDialog } from "@/components/motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertWashQueueSchema } from "@shared/schema";
import type { WashQueueItem } from "@shared/schema";

const addWashSchema = insertWashQueueSchema.pick({
  vehiclePlate: true,
  washType: true,
  priority: true,
}).extend({
  vehiclePlate: z.string().min(1, "Vehicle plate is required"),
});
type AddWashValues = z.infer<typeof addWashSchema>;

export default function WashersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const washForm = useForm<AddWashValues>({
    resolver: zodResolver(addWashSchema),
    defaultValues: { vehiclePlate: '', washType: 'Quick Wash', priority: 'Normal' },
  });

  const { data: queue, isLoading } = useQuery<WashQueueItem[]>({
    queryKey: ["/api/wash-queue"],
  });

  const { data: washerLoads } = useQuery<Array<{ washer: string; active: number; lastSeenAt: string | null }>>({
    queryKey: ["/api/wash-queue/washer-loads"],
    refetchInterval: 30_000,
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
      washForm.reset();
    },
    onError: (err: Error) => toast({ title: "Failed to add to queue", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/wash-queue/${id}`, data);
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/wash-queue"] });
      const previous = queryClient.getQueryData(["/api/wash-queue"]);
      queryClient.setQueryData(["/api/wash-queue"], (old: any[] | undefined) =>
        old?.map((item: any) => item.id === id ? { ...item, ...data } : item)
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/wash-queue"], context.previous);
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
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
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv(items, [
            { key: 'vehiclePlate', label: 'Plate' }, { key: 'washType', label: 'Type' },
            { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
            { key: 'assignedTo', label: 'Assigned To' }, { key: 'createdAt', label: 'Created' },
          ], 'wash-queue')} data-testid="button-export-wash"><Download className="h-4 w-4" /> Export</Button>
          <Button className="gap-2" onClick={() => setDialogOpen(true)} data-testid="button-add-wash"><Plus className="h-4 w-4" /> Add to Queue</Button>
          <MotionDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Add to Wash Queue">
              <Form {...washForm}>
              <form onSubmit={washForm.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
                <FormField control={washForm.control} name="vehiclePlate" render={({ field }) => (
                  <FormItem><FormLabel>Vehicle Plate</FormLabel><FormControl><Input {...field} data-testid="input-wash-plate" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={washForm.control} name="washType" render={({ field }) => (
                  <FormItem><FormLabel>Wash Type</FormLabel><FormControl>
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quick Wash">Quick Wash</SelectItem>
                        <SelectItem value="Full Detail">Full Detail</SelectItem>
                        <SelectItem value="Interior Only">Interior Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={washForm.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel><FormControl>
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-submit-wash">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add to Queue
                </Button>
              </form>
              </Form>
          </MotionDialog>
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
                          <span className="text-sm font-medium truncate max-w-[120px]">{item.assignedTo || 'Unassigned'}</span>
                          {!item.assignedTo ? (
                            <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: item.id, data: { assignedTo: 'Staff', status: 'in_progress' } })} data-testid={`button-assign-${item.id}`}>
                              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Assign
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                              disabled={updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: item.id, data: { status: 'completed' } })} data-testid={`button-complete-${item.id}`}>
                              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Done
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pending.length === 0 && (
                    <Empty className="py-12">
                      <EmptyContent>
                        <EmptyMedia variant="icon"><Sparkles className="h-10 w-10" /></EmptyMedia>
                        <EmptyTitle>Wash queue is clear</EmptyTitle>
                        <EmptyDescription>All vehicles are clean. New wash jobs will appear here when queued.</EmptyDescription>
                      </EmptyContent>
                    </Empty>
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

              <Card className="glass-panel">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-primary" /> Washer Loads
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">Auto-assign</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.isArray(washerLoads) && washerLoads.length > 0 ? (
                    [...washerLoads]
                      .sort((a, b) => b.active - a.active || a.washer.localeCompare(b.washer))
                      .slice(0, 6)
                      .map((w) => {
                        const pct = Math.min(w.active * 20, 100);
                        const tone = w.active === 0 ? 'bg-green-500/40' : w.active <= 2 ? 'bg-primary/60' : 'bg-amber-500/70';
                        return (
                          <div key={w.washer} className="space-y-1" data-testid={`washer-load-${w.washer}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate">{w.washer}</span>
                              <span className="text-muted-foreground">{w.active} active</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No recent washer activity. New items will stay unassigned until a washer claims one.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
                    New queue items auto-assign to the least-loaded washer.
                  </p>
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

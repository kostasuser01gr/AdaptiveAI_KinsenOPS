import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Car, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Loader2, Plus, Trash2, RotateCcw, Eye, TrendingUp, Activity, Wrench, MapPin, Brain, ArrowRightLeft, ParkingSquare, Send, HeartPulse } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { usePageLayout } from "@/hooks/useLayoutPreferences";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from 'lucide-react';
import type { Vehicle } from "@shared/schema";

function VehicleMemoryPanel({ vehicle }: { vehicle: Vehicle }) {
  const { data: evidence } = useQuery({
    queryKey: ["/api/vehicles", vehicle.id, "evidence"],
    queryFn: async () => { const r = await fetch(`/api/vehicles/${vehicle.id}/evidence`, { credentials: 'include' }); return r.json(); },
  });
  const items = Array.isArray(evidence) ? evidence : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-lg font-bold">{vehicle.mileage?.toLocaleString() || '—'}</p>
          <p className="text-[10px] text-muted-foreground">Mileage</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-lg font-bold">{vehicle.fuelLevel || '—'}%</p>
          <p className="text-[10px] text-muted-foreground">Fuel</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-lg font-bold">{items.length}</p>
          <p className="text-[10px] text-muted-foreground">Evidence</p>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Predictive Readiness</h4>
        <div className="space-y-1.5">
          {[
            { label: 'Damage Recurrence Risk', value: items.length > 2 ? 'High' : items.length > 0 ? 'Medium' : 'Low', color: items.length > 2 ? 'text-red-400' : items.length > 0 ? 'text-yellow-400' : 'text-green-400' },
            { label: 'Wash Cycle Position', value: vehicle.status === 'washing' ? 'In Queue' : 'Ready', color: 'text-foreground' },
            { label: 'Next Service Due', value: (vehicle.mileage || 0) > 80000 ? 'Overdue' : 'On Track', color: (vehicle.mileage || 0) > 80000 ? 'text-red-400' : 'text-green-400' },
            { label: 'SLA Compliance', value: vehicle.sla === 'high' ? 'At Risk' : 'OK', color: vehicle.sla === 'high' ? 'text-red-400' : 'text-green-400' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-medium ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence Timeline</h4>
          {items.slice(0, 5).map((ev: any) => (
            <div key={ev.id} className="flex items-center gap-2 p-2 rounded bg-muted/20 text-sm">
              <div className={`h-2 w-2 rounded-full ${ev.severity === 'high' ? 'bg-red-400' : ev.severity === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
              <span className="flex-1 truncate">{ev.caption || ev.type}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const [newVehicle, setNewVehicle] = React.useState({ plate: '', model: '', category: 'B', status: 'ready', sla: 'normal', nextBooking: '', timerInfo: '-' });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const canDelete = user && ['admin', 'coordinator', 'supervisor'].includes(user.role);

  // Per-user column visibility (persisted via layout preferences)
  const ALL_COLUMNS = ['vehicle', 'cat', 'status', 'sla', 'mileage', 'fuel', 'nextBooking', 'actions'] as const;
  type ColKey = typeof ALL_COLUMNS[number];
  const COLUMN_LABELS: Record<ColKey, string> = { vehicle: 'Vehicle', cat: 'Cat', status: 'Status', sla: 'SLA', mileage: 'Mileage', fuel: 'Fuel', nextBooking: 'Next Booking', actions: 'Actions' };
  const { get: getFleetLayout, set: setFleetLayout } = usePageLayout('fleet');
  const visibleColumns = getFleetLayout<ColKey[]>('columns', [...ALL_COLUMNS]);
  const isColVisible = (col: ColKey) => visibleColumns.includes(col);
  const toggleColumn = (col: ColKey) => {
    const next = isColVisible(col) ? visibleColumns.filter((c: ColKey) => c !== col) : [...visibleColumns, col];
    if (next.length > 0) setFleetLayout('columns', next);
  };

  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const allVehicles = Array.isArray(vehicles) ? vehicles : [];
  const selectedVehicle = allVehicles.find(v => v.id === selectedVehicleId) ?? null;
  const { data: stations } = useQuery<Array<{ id: number; name: string }>>({ queryKey: ["/api/stations"], staleTime: 60_000 });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/vehicles", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] }); toast({ title: "Vehicle added" }); setDialogOpen(false); setNewVehicle({ plate: '', model: '', category: 'B', status: 'ready', sla: 'normal', nextBooking: '', timerInfo: '-' }); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/vehicles/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] }); toast({ title: "Vehicle archived" }); setSelectedVehicleId(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const res = await apiRequest("PATCH", `/api/vehicles/${id}`, data); return res.json(); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] }),
  });

  const washQueueMutation = useMutation({
    mutationFn: async (vehicle: Vehicle) => {
      const res = await apiRequest("POST", "/api/wash-queue", {
        vehiclePlate: vehicle.plate,
        washType: "Quick Wash",
        priority: vehicle.sla === 'high' || vehicle.sla === 'premium' ? 'High' : 'Normal',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wash-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Added to wash queue" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const incidentMutation = useMutation({
    mutationFn: async (vehicle: Vehicle) => {
      const res = await apiRequest("POST", "/api/incidents", {
        title: `Vehicle Incident: ${vehicle.plate}`,
        description: `Incident reported for ${vehicle.plate} (${vehicle.model})`,
        severity: "high",
        category: "vehicle_damage",
        vehicleId: vehicle.id,
        stationId: vehicle.stationId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Incident created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = allVehicles.filter(v => {
    const matchSearch = v.plate.toLowerCase().includes(search.toLowerCase()) || v.model.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: allVehicles.length,
    ready: allVehicles.filter(v => v.status === 'ready').length,
    washing: allVehicles.filter(v => v.status === 'washing').length,
    maintenance: allVehicles.filter(v => v.status === 'maintenance').length,
    returned: allVehicles.filter(v => v.status === 'returned').length,
    highPriority: allVehicles.filter(v => v.sla === 'high' || v.sla === 'premium').length,
    stuckTooLong: allVehicles.filter(v => v.status === 'maintenance' && (v.mileage || 0) > 80000).length,
  };

  const categoryCount = allVehicles.reduce((acc, v) => { acc[v.category] = (acc[v.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const statusColors: Record<string, string> = { ready: 'bg-green-500/20 text-green-400', washing: 'bg-blue-500/20 text-blue-400', maintenance: 'bg-yellow-500/20 text-yellow-400', returned: 'bg-purple-500/20 text-purple-400', rented: 'bg-cyan-500/20 text-cyan-400' };

  const [mainTab, setMainTab] = React.useState('overview');

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Car className="h-5 w-5 text-primary" /> Fleet Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Predictive readiness, vehicle memory, damage clustering, and lifecycle management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => {
              if (!selectedVehicle) { toast({ title: "Select a vehicle", description: "Click a vehicle row first to log an incident." }); return; }
              incidentMutation.mutate(selectedVehicle);
            }}
            disabled={incidentMutation.isPending}
            data-testid="button-log-incident">
            <ShieldAlert className="h-4 w-4" /> Log Incident
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-vehicle"><Plus className="h-4 w-4" /> Add Vehicle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Vehicle</DialogTitle><DialogDescription>Register a new vehicle to the fleet.</DialogDescription></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newVehicle); }} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>License Plate</Label><Input value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})} required data-testid="input-vehicle-plate" /></div>
                  <div className="space-y-2"><Label>Model</Label><Input value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} required data-testid="input-vehicle-model" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={newVehicle.category} onValueChange={v => setNewVehicle({...newVehicle, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['A','B','C','D','E'].map(c => <SelectItem key={c} value={c}>Category {c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Status</Label>
                    <Select value={newVehicle.status} onValueChange={v => setNewVehicle({...newVehicle, status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ready">Ready</SelectItem><SelectItem value="washing">Washing</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="returned">Returned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-submit-vehicle">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Vehicle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 border-b">
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="text-xs gap-1.5"><Car className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="positions" className="text-xs gap-1.5"><ParkingSquare className="h-3.5 w-3.5" /> Positions</TabsTrigger>
            <TabsTrigger value="transfers" className="text-xs gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> Transfers</TabsTrigger>
            <TabsTrigger value="health" className="text-xs gap-1.5"><HeartPulse className="h-3.5 w-3.5" /> Health</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="flex-1 overflow-hidden mt-0">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex flex-col ${selectedVehicle ? 'w-[60%]' : 'w-full'}`}>
          <ScrollArea className="flex-1 content-visibility-auto">
            <div className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: 'Total', value: stats.total, icon: Car, color: 'text-foreground' },
                  { label: 'Ready', value: stats.ready, icon: CheckCircle2, color: 'text-green-400' },
                  { label: 'Washing', value: stats.washing, icon: Activity, color: 'text-blue-400' },
                  { label: 'Maintenance', value: stats.maintenance, icon: Wrench, color: 'text-yellow-400' },
                  { label: 'Returned', value: stats.returned, icon: RotateCcw, color: 'text-purple-400' },
                  { label: 'High Priority', value: stats.highPriority, icon: AlertTriangle, color: stats.highPriority > 0 ? 'text-red-400' : 'text-muted-foreground' },
                  { label: 'Stuck', value: stats.stuckTooLong, icon: Clock, color: stats.stuckTooLong > 0 ? 'text-orange-400' : 'text-muted-foreground' },
                ].map((s, i) => (
                  <Card key={i} className="glass-panel hover:border-primary/30 cursor-pointer transition-colors">
                    <CardContent className="p-3 text-center">
                      <s.icon className={`h-4 w-4 ${s.color} mx-auto mb-1`} />
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="glass-panel col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Category Distribution</CardTitle></CardHeader>
                  <CardContent className="flex items-end gap-2 h-20">
                    {Object.entries(categoryCount).sort().map(([cat, count]) => (
                      <div key={cat} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-bold mb-1">{count}</span>
                        <div className="w-full bg-primary/20 rounded-t" style={{ height: `${(Number(count) / Math.max(...Object.values(categoryCount).map(Number))) * 50}px` }} />
                        <span className="text-[9px] text-muted-foreground mt-1">Cat {cat}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="glass-panel">
                  <CardContent className="p-3">
                    <Brain className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs font-semibold mb-1">AI Insight</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats.maintenance > 2 ? 'Multiple vehicles in maintenance — check for recurring issues.' :
                       stats.highPriority > 0 ? 'High priority vehicles need immediate attention.' :
                       'Fleet health is good. All metrics within normal range.'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-panel">
                  <CardContent className="p-3">
                    <TrendingUp className="h-4 w-4 text-green-400 mb-2" />
                    <p className="text-xs font-semibold mb-1">Readiness Score</p>
                    <p className={`text-2xl font-bold ${stats.ready / Math.max(stats.total, 1) > 0.7 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {Math.round((stats.ready / Math.max(stats.total, 1)) * 100)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-panel">
                <CardHeader className="pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Vehicle Timeline & Status</CardTitle>
                    <div className="flex gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="washing">Washing</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="relative w-56">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search plates/models..." className="pl-8 h-9 bg-muted/50" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-vehicles" />
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-column-settings">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-2" align="end">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Visible Columns</p>
                          {ALL_COLUMNS.map(col => (
                            <label key={col} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                              <Checkbox checked={isColVisible(col)} onCheckedChange={() => toggleColumn(col)} />
                              {COLUMN_LABELS[col]}
                            </label>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          {isColVisible('vehicle') && <TableHead>Vehicle</TableHead>}
                          {isColVisible('cat') && <TableHead>Cat</TableHead>}
                          {isColVisible('status') && <TableHead>Status</TableHead>}
                          {isColVisible('sla') && <TableHead>SLA</TableHead>}
                          {isColVisible('mileage') && <TableHead>Mileage</TableHead>}
                          {isColVisible('fuel') && <TableHead>Fuel</TableHead>}
                          {isColVisible('nextBooking') && <TableHead>Next Booking</TableHead>}
                          {isColVisible('actions') && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((v) => (
                          <TableRow key={v.id} className={`cursor-pointer hover:bg-muted/50 ${v.sla === 'high' ? 'bg-destructive/5' : ''} ${selectedVehicle?.id === v.id ? 'bg-primary/10' : ''}`}
                            onClick={() => setSelectedVehicleId(selectedVehicleId === v.id ? null : v.id)} data-testid={`row-vehicle-${v.id}`}>
                            {isColVisible('vehicle') && <TableCell>
                              <div className="font-medium flex items-center gap-2">
                                {v.plate}
                                {(v.sla === 'high' || v.sla === 'premium') && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              </div>
                              <div className="text-xs text-muted-foreground">{v.model}</div>
                            </TableCell>}
                            {isColVisible('cat') && <TableCell><Badge variant="outline" className="text-[10px]">{v.category}</Badge></TableCell>}
                            {isColVisible('status') && <TableCell><Badge className={statusColors[v.status] || 'bg-muted'}>{v.status}</Badge></TableCell>}
                            {isColVisible('sla') && <TableCell><span className={`text-sm ${v.sla === 'high' ? 'text-red-400 font-medium' : v.sla === 'premium' ? 'text-purple-400' : 'text-muted-foreground'}`}>{v.sla}</span></TableCell>}
                            {isColVisible('mileage') && <TableCell className="text-sm text-muted-foreground">{v.mileage?.toLocaleString() || '—'}</TableCell>}
                            {isColVisible('fuel') && <TableCell>
                              {v.fuelLevel != null && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${v.fuelLevel > 50 ? 'bg-green-500' : v.fuelLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${v.fuelLevel}%` }} />
                                  </div>
                                  <span className="text-[10px]">{v.fuelLevel}%</span>
                                </div>
                              )}
                            </TableCell>}
                            {isColVisible('nextBooking') && <TableCell className="text-sm">{v.nextBooking || '—'}</TableCell>}
                            {isColVisible('actions') && <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedVehicleId(v.id); }} data-testid={`button-view-${v.id}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(v.id); }} data-testid={`button-delete-${v.id}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>}
                          </TableRow>
                        ))}
                        {filtered.length === 0 && (
                          <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">{search ? 'No vehicles match' : 'No vehicles yet'}</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>

        {selectedVehicle && (
          <div className="w-full sm:w-[340px] absolute inset-0 sm:relative sm:inset-auto border-l flex flex-col bg-card z-10 sm:z-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg font-mono">{selectedVehicle.plate}</h3>
                <p className="text-xs text-muted-foreground">{selectedVehicle.model} · Cat {selectedVehicle.category}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedVehicleId(null)}>×</Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              <Tabs defaultValue="memory">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="memory" className="flex-1 text-xs">Memory</TabsTrigger>
                  <TabsTrigger value="actions" className="flex-1 text-xs">Actions</TabsTrigger>
                  <TabsTrigger value="workshop" className="flex-1 text-xs">Workshop</TabsTrigger>
                </TabsList>
                <TabsContent value="memory"><VehicleMemoryPanel vehicle={selectedVehicle} /></TabsContent>
                <TabsContent value="actions" className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs"
                    onClick={() => washQueueMutation.mutate(selectedVehicle)}
                    disabled={washQueueMutation.isPending}
                    data-testid="button-action-wash">
                    <Activity className="h-3 w-3" /> Send to Wash Queue
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={() => updateMutation.mutate({ id: selectedVehicle.id, data: { status: 'ready' } })} data-testid="button-action-ready">
                    <CheckCircle2 className="h-3 w-3" /> Mark as Ready
                  </Button>
                  {/* Transfer Station: opens dialog to initiate inter-station transfer */}
                  <TransferStationButton vehicle={selectedVehicle} stations={Array.isArray(stations) ? stations : []} />
                  <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs"
                    onClick={() => incidentMutation.mutate(selectedVehicle)}
                    disabled={incidentMutation.isPending}
                    data-testid="button-action-incident">
                    <ShieldAlert className="h-3 w-3" /> Log Incident
                  </Button>
                  {canDelete && (
                    <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs text-destructive border-destructive/30" onClick={() => deleteMutation.mutate(selectedVehicle.id)} data-testid="button-action-archive">
                      <Trash2 className="h-3 w-3" /> Archive Vehicle
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="workshop">
                  <WorkshopJobsPanel vehicleId={selectedVehicle.id} />
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="positions" className="flex-1 overflow-auto mt-0">
          <PositionsPanel stations={Array.isArray(stations) ? stations : []} />
        </TabsContent>

        <TabsContent value="transfers" className="flex-1 overflow-auto mt-0">
          <TransfersPanel stations={Array.isArray(stations) ? stations : []} />
        </TabsContent>

        <TabsContent value="health" className="flex-1 overflow-auto mt-0">
          <FleetHealthPanel vehicles={allVehicles} stations={Array.isArray(stations) ? stations : []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Workshop Jobs Panel (Phase 4.2B) ───
function WorkshopJobsPanel({ vehicleId }: { vehicleId: number }) {
  // We query repair orders for this vehicle first, then get workshop jobs linked to them
  const { data: repairOrders } = useQuery<Array<{ id: number; title: string; status: string }>>({
    queryKey: ["/api/repair-orders", { vehicleId }],
    queryFn: () => fetch(`/api/repair-orders?vehicleId=${vehicleId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vehicleId,
  });

  const repairOrderIds = repairOrders?.map(ro => ro.id) ?? [];
  const firstRoId = repairOrderIds[0];

  const { data: workshopJobs } = useQuery<Array<{
    id: number;
    workshopName: string;
    normalizedStatus: string;
    externalStatus: string | null;
    estimateAmount: number | null;
    invoiceRef: string | null;
    updatedAt: string;
  }>>({
    queryKey: ["/api/workshop-jobs", { repairOrderId: firstRoId }],
    queryFn: () => fetch(`/api/workshop-jobs?repairOrderId=${firstRoId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!firstRoId,
  });

  const statusColor: Record<string, string> = {
    pending: "bg-gray-500/10 text-gray-400",
    estimate_received: "bg-blue-500/10 text-blue-400",
    approved: "bg-indigo-500/10 text-indigo-400",
    parts_ordered: "bg-amber-500/10 text-amber-400",
    in_repair: "bg-orange-500/10 text-orange-400",
    qa_ready: "bg-purple-500/10 text-purple-400",
    completed: "bg-green-500/10 text-green-400",
    cancelled: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground">Workshop Jobs</h4>
      {(!workshopJobs || workshopJobs.length === 0) ? (
        <p className="text-xs text-muted-foreground">No workshop jobs linked to this vehicle.</p>
      ) : (
        workshopJobs.map((job) => (
          <Card key={job.id} className="glass-panel">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{job.workshopName}</span>
                <Badge className={statusColor[job.normalizedStatus] || ""} variant="outline">
                  {job.normalizedStatus.replace(/_/g, " ")}
                </Badge>
              </div>
              {job.externalStatus && (
                <p className="text-[10px] text-muted-foreground">External: {job.externalStatus}</p>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                {job.estimateAmount != null && <span>${job.estimateAmount.toFixed(2)}</span>}
                {job.invoiceRef && <span>Inv: {job.invoiceRef}</span>}
                <span>{new Date(job.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Transfer Station Button (Phase 5) ───
function TransferStationButton({ vehicle, stations }: { vehicle: Vehicle; stations: Array<{ id: number; name: string }> }) {
  const [open, setOpen] = React.useState(false);
  const [targetStation, setTargetStation] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transfers", {
        vehicleId: vehicle.id,
        fromStationId: vehicle.stationId,
        toStationId: Number(targetStation),
        notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      toast({ title: "Transfer requested" });
      setOpen(false);
      setTargetStation('');
      setNotes('');
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const otherStations = stations.filter(s => s.id !== vehicle.stationId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" data-testid="button-action-transfer">
          <MapPin className="h-3 w-3" /> Transfer Station
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer {vehicle.plate}</DialogTitle>
          <DialogDescription>Request a vehicle transfer to another station.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Destination Station</Label>
            <Select value={targetStation} onValueChange={setTargetStation}>
              <SelectTrigger><SelectValue placeholder="Select station..." /></SelectTrigger>
              <SelectContent>
                {otherStations.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Transfer reason..." />
          </div>
          <Button onClick={() => transferMutation.mutate()} disabled={!targetStation || transferMutation.isPending} className="w-full">
            {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Request Transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Positions Panel (Phase 5) ───
function PositionsPanel({ stations }: { stations: Array<{ id: number; name: string }> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stationFilter, setStationFilter] = React.useState('all');

  const { data: positions, isLoading } = useQuery<Array<any>>({
    queryKey: ["/api/positions", { stationId: stationFilter !== 'all' ? stationFilter : undefined }],
    queryFn: () => fetch(`/api/positions${stationFilter !== 'all' ? `?stationId=${stationFilter}` : ''}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: assignments } = useQuery<Array<any>>({
    queryKey: ["/api/position-assignments"],
    queryFn: () => fetch("/api/position-assignments", { credentials: "include" }).then(r => r.json()),
  });

  const createPositionMutation = useMutation({
    mutationFn: async (data: { stationId: number; label: string; type: string; zone?: string }) => {
      const res = await apiRequest("POST", "/api/positions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({ title: "Position created" });
    },
  });

  const [newPos, setNewPos] = React.useState({ stationId: '', label: '', type: 'parking', zone: '' });

  const positionList = Array.isArray(positions) ? positions : [];
  const assignmentList = Array.isArray(assignments) ? assignments : [];
  const assignedPositionIds = new Set(assignmentList.filter((a: any) => !a.releasedAt).map((a: any) => a.positionId));

  const typeColors: Record<string, string> = {
    parking: 'bg-blue-500/20 text-blue-400',
    staging: 'bg-amber-500/20 text-amber-400',
    wash_bay: 'bg-cyan-500/20 text-cyan-400',
    delivery: 'bg-green-500/20 text-green-400',
    overflow: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ParkingSquare className="h-5 w-5 text-primary" /> Station Positions</h2>
          <p className="text-sm text-muted-foreground">Manage typed parking/staging positions per station</p>
        </div>
        <div className="flex gap-2">
          <Select value={stationFilter} onValueChange={setStationFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              {stations.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-panel">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{positionList.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Positions</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{positionList.filter(p => !assignedPositionIds.has(p.id)).length}</p>
            <p className="text-[10px] text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{assignedPositionIds.size}</p>
            <p className="text-[10px] text-muted-foreground">Occupied</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{Math.round((assignedPositionIds.size / Math.max(positionList.length, 1)) * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">Utilization</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Position</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2 items-end" onSubmit={e => {
            e.preventDefault();
            if (!newPos.stationId || !newPos.label) return;
            createPositionMutation.mutate({ stationId: Number(newPos.stationId), label: newPos.label, type: newPos.type, zone: newPos.zone || undefined });
            setNewPos({ stationId: '', label: '', type: 'parking', zone: '' });
          }}>
            <Select value={newPos.stationId} onValueChange={v => setNewPos({ ...newPos, stationId: v })}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>{stations.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Label (e.g. P-01)" className="w-32 h-9" value={newPos.label} onChange={e => setNewPos({ ...newPos, label: e.target.value })} />
            <Select value={newPos.type} onValueChange={v => setNewPos({ ...newPos, type: v })}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="wash_bay">Wash Bay</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="overflow">Overflow</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Zone" className="w-24 h-9" value={newPos.zone} onChange={e => setNewPos({ ...newPos, zone: e.target.value })} />
            <Button type="submit" size="sm" disabled={createPositionMutation.isPending}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead>Zone</TableHead><TableHead>Station</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {positionList.map((p: any) => {
                  const occupied = assignedPositionIds.has(p.id);
                  const stationName = stations.find(s => s.id === p.stationId)?.name || `Station ${p.stationId}`;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell><Badge className={typeColors[p.type] || ''}>{p.type.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.zone || '—'}</TableCell>
                      <TableCell className="text-sm">{stationName}</TableCell>
                      <TableCell><Badge variant={occupied ? "destructive" : "default"} className={occupied ? "" : "bg-green-500/20 text-green-400"}>{occupied ? 'Occupied' : 'Available'}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {positionList.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No positions configured</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Transfers Panel (Phase 5) ───
function TransfersPanel({ stations }: { stations: Array<{ id: number; name: string }> }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user && ['admin', 'supervisor'].includes(user.role);

  const { data: transfers, isLoading } = useQuery<Array<any>>({
    queryKey: ["/api/transfers"],
    queryFn: () => fetch("/api/transfers", { credentials: "include" }).then(r => r.json()),
  });

  const updateTransferMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/transfers/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Transfer updated" });
    },
  });

  const transferList = Array.isArray(transfers) ? transfers : [];
  const statusColors: Record<string, string> = {
    requested: 'bg-blue-500/20 text-blue-400',
    in_transit: 'bg-amber-500/20 text-amber-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  const stationName = (id: number) => stations.find(s => s.id === id)?.name || `#${id}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Vehicle Transfers</h2>
        <p className="text-sm text-muted-foreground">Track inter-station vehicle movements</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: transferList.length, color: 'text-foreground' },
          { label: 'Requested', value: transferList.filter(t => t.status === 'requested').length, color: 'text-blue-400' },
          { label: 'In Transit', value: transferList.filter(t => t.status === 'in_transit').length, color: 'text-amber-400' },
          { label: 'Delivered', value: transferList.filter(t => t.status === 'delivered').length, color: 'text-green-400' },
        ].map((s, i) => (
          <Card key={i} className="glass-panel">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Vehicle</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {transferList.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">Vehicle #{t.vehicleId}</TableCell>
                    <TableCell>{stationName(t.fromStationId)}</TableCell>
                    <TableCell>{stationName(t.toStationId)}</TableCell>
                    <TableCell><Badge className={statusColors[t.status] || ''}>{t.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {canManage && t.status === 'requested' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateTransferMutation.mutate({ id: t.id, status: 'in_transit' })}>Dispatch</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateTransferMutation.mutate({ id: t.id, status: 'cancelled' })}>Cancel</Button>
                        </div>
                      )}
                      {canManage && t.status === 'in_transit' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateTransferMutation.mutate({ id: t.id, status: 'delivered' })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Delivered
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {transferList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Fleet Health Panel ───
function FleetHealthPanel({ vehicles, stations }: { vehicles: Vehicle[]; stations: Array<{ id: number; name: string }> }) {
  const { data: washQueue } = useQuery<any[]>({ queryKey: ["/api/wash-queue"] });
  const queue = Array.isArray(washQueue) ? washQueue : [];

  // ── Compute health metrics ──
  const total = vehicles.length || 1;
  const readyPct = Math.round((vehicles.filter(v => v.status === 'ready').length / total) * 100);
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  const overdueService = vehicles.filter(v => (v.mileage || 0) > 80000).length;
  const lowFuel = vehicles.filter(v => v.fuelLevel != null && v.fuelLevel < 20).length;
  const highSla = vehicles.filter(v => v.sla === 'high' || v.sla === 'premium').length;
  const pendingWashes = queue.filter((q: any) => q.status === 'pending').length;

  // Composite health score (0-100)
  const healthScore = Math.max(0, Math.min(100, Math.round(
    readyPct * 0.4 +
    Math.max(0, 100 - maintenanceCount * 15) * 0.2 +
    Math.max(0, 100 - overdueService * 20) * 0.2 +
    Math.max(0, 100 - lowFuel * 10) * 0.1 +
    Math.max(0, 100 - highSla * 10) * 0.1
  )));
  const healthColor = healthScore >= 80 ? 'text-green-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400';

  // Station distribution
  const stationDist = stations.map(s => ({
    ...s,
    count: vehicles.filter(v => v.stationId === s.id).length,
    ready: vehicles.filter(v => v.stationId === s.id && v.status === 'ready').length,
    maintenance: vehicles.filter(v => v.stationId === s.id && v.status === 'maintenance').length,
  })).filter(s => s.count > 0);

  // Status breakdown for bar chart
  const statusBreakdown = [
    { label: 'Ready', count: vehicles.filter(v => v.status === 'ready').length, color: 'bg-green-500' },
    { label: 'Washing', count: vehicles.filter(v => v.status === 'washing').length, color: 'bg-blue-500' },
    { label: 'Maintenance', count: vehicles.filter(v => v.status === 'maintenance').length, color: 'bg-yellow-500' },
    { label: 'Returned', count: vehicles.filter(v => v.status === 'returned').length, color: 'bg-purple-500' },
    { label: 'Rented', count: vehicles.filter(v => v.status === 'rented').length, color: 'bg-cyan-500' },
  ].filter(s => s.count > 0);

  // Risk items
  const risks = [
    ...overdueService > 0 ? [{ severity: 'high' as const, label: `${overdueService} vehicle(s) overdue for service (>80k km)` }] : [],
    ...lowFuel > 0 ? [{ severity: 'medium' as const, label: `${lowFuel} vehicle(s) with low fuel (<20%)` }] : [],
    ...maintenanceCount > 3 ? [{ severity: 'high' as const, label: `${maintenanceCount} vehicles in maintenance — possible systemic issue` }] : [],
    ...highSla > 0 ? [{ severity: 'medium' as const, label: `${highSla} high-priority SLA vehicle(s) need attention` }] : [],
    ...pendingWashes > 5 ? [{ severity: 'low' as const, label: `${pendingWashes} pending washes — wash queue backlog` }] : [],
  ];

  const severityColor = { high: 'text-red-400 bg-red-500/10', medium: 'text-yellow-400 bg-yellow-500/10', low: 'text-blue-400 bg-blue-500/10' };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" /> Fleet Health Dashboard</h2>
        <p className="text-sm text-muted-foreground">Aggregated fleet health, risk alerts, and station distribution</p>
      </div>

      {/* Top row: health score + key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass-panel md:row-span-2">
          <CardContent className="p-4 flex flex-col items-center justify-center h-full">
            <div className="relative w-24 h-24 mb-2">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${healthScore * 2.64} 264`} strokeLinecap="round" className={healthColor} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
              </div>
            </div>
            <p className="text-xs font-semibold">Health Score</p>
            <p className="text-[10px] text-muted-foreground">Composite fleet metric</p>
          </CardContent>
        </Card>
        {[
          { label: 'Readiness', value: `${readyPct}%`, sub: `${vehicles.filter(v => v.status === 'ready').length}/${vehicles.length}`, color: readyPct > 70 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'In Maintenance', value: maintenanceCount, sub: 'vehicles', color: maintenanceCount > 3 ? 'text-red-400' : 'text-yellow-400' },
          { label: 'Service Overdue', value: overdueService, sub: '>80k km', color: overdueService > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Low Fuel', value: lowFuel, sub: '<20%', color: lowFuel > 0 ? 'text-orange-400' : 'text-green-400' },
          { label: 'High SLA', value: highSla, sub: 'priority vehicles', color: highSla > 0 ? 'text-red-400' : 'text-muted-foreground' },
          { label: 'Wash Backlog', value: pendingWashes, sub: 'pending', color: pendingWashes > 5 ? 'text-orange-400' : 'text-muted-foreground' },
        ].map((m, i) => (
          <Card key={i} className="glass-panel">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/60">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status distribution bar */}
      <Card className="glass-panel">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-6 rounded-full overflow-hidden mb-3">
            {statusBreakdown.map((s, i) => (
              <div key={i} className={`${s.color} transition-all`} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {statusBreakdown.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk alerts */}
        <Card className="glass-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Risk Alerts</CardTitle></CardHeader>
          <CardContent>
            {risks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-400 py-4">
                <CheckCircle2 className="h-4 w-4" /> No active risk alerts
              </div>
            ) : (
              <div className="space-y-2">
                {risks.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded ${severityColor[r.severity]}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${r.severity === 'high' ? 'bg-red-400' : r.severity === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                    {r.label}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Station distribution */}
        <Card className="glass-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Station Distribution</CardTitle></CardHeader>
          <CardContent>
            {stationDist.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No station data available</p>
            ) : (
              <div className="space-y-3">
                {stationDist.map(s => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{s.count} vehicles</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
                      <div className="bg-green-500 transition-all" style={{ width: `${(s.ready / Math.max(s.count, 1)) * 100}%` }} />
                      <div className="bg-yellow-500 transition-all" style={{ width: `${(s.maintenance / Math.max(s.count, 1)) * 100}%` }} />
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[9px] text-muted-foreground">
                      <span>{s.ready} ready</span>
                      {s.maintenance > 0 && <span>{s.maintenance} maintenance</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

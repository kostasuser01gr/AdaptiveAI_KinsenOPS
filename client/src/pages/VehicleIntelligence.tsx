import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Camera, FileText, AlertTriangle, Clock, Eye, Mic, Fuel, Gauge, Shield, Search, TrendingUp, Activity, Brain, Wrench } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const DAMAGE_ZONES = [
  { id: 'front-bumper', label: 'Front Bumper', x: 42, y: 5, w: 16, h: 8 },
  { id: 'hood', label: 'Hood', x: 38, y: 13, w: 24, h: 12 },
  { id: 'windshield', label: 'Windshield', x: 38, y: 25, w: 24, h: 8 },
  { id: 'roof', label: 'Roof', x: 38, y: 33, w: 24, h: 14 },
  { id: 'rear-window', label: 'Rear Window', x: 38, y: 47, w: 24, h: 8 },
  { id: 'trunk', label: 'Trunk', x: 38, y: 55, w: 24, h: 10 },
  { id: 'rear-bumper', label: 'Rear Bumper', x: 42, y: 65, w: 16, h: 8 },
  { id: 'driver-front', label: 'Driver Front Door', x: 20, y: 25, w: 18, h: 15 },
  { id: 'driver-rear', label: 'Driver Rear Door', x: 20, y: 40, w: 18, h: 15 },
  { id: 'passenger-front', label: 'Passenger Front Door', x: 62, y: 25, w: 18, h: 15 },
  { id: 'passenger-rear', label: 'Passenger Rear Door', x: 62, y: 40, w: 18, h: 15 },
  { id: 'driver-fender', label: 'Driver Front Fender', x: 22, y: 13, w: 16, h: 12 },
  { id: 'passenger-fender', label: 'Pass. Front Fender', x: 62, y: 13, w: 16, h: 12 },
  { id: 'driver-quarter', label: 'Driver Rear Quarter', x: 22, y: 55, w: 16, h: 10 },
  { id: 'passenger-quarter', label: 'Pass. Rear Quarter', x: 62, y: 55, w: 16, h: 10 },
];

function DamageHeatmap({ onZoneClick, zoneHits }: { onZoneClick: (zone: string) => void; zoneHits: Record<string, number> }) {
  const [hoveredZone, setHoveredZone] = React.useState<string | null>(null);
  
  const getZoneColor = (hits: number) => {
    if (hits === 0) return 'fill-green-500/10 stroke-green-500/30';
    if (hits === 1) return 'fill-amber-500/20 stroke-amber-500/50';
    return 'fill-red-500/30 stroke-red-500/60';
  };

  return (
    <div className="relative">
      <div className="text-xs text-muted-foreground text-center mb-2 font-medium uppercase tracking-wider">Top-Down Damage Heatmap</div>
      <svg viewBox="0 0 100 80" className="w-full max-w-md mx-auto" style={{ aspectRatio: '100/80' }}>
        <rect x="30" y="2" width="40" height="76" rx="8" ry="8" className="fill-muted/20 stroke-border" strokeWidth="0.5" />
        <rect x="32" y="4" width="36" height="72" rx="6" ry="6" className="fill-none stroke-border/50" strokeWidth="0.3" strokeDasharray="1,1" />
        
        <circle cx="35" cy="15" r="4" className="fill-muted/30 stroke-border/50" strokeWidth="0.3" />
        <circle cx="65" cy="15" r="4" className="fill-muted/30 stroke-border/50" strokeWidth="0.3" />
        <circle cx="35" cy="65" r="3.5" className="fill-muted/30 stroke-border/50" strokeWidth="0.3" />
        <circle cx="65" cy="65" r="3.5" className="fill-muted/30 stroke-border/50" strokeWidth="0.3" />

        {DAMAGE_ZONES.map(zone => {
          const hits = zoneHits[zone.id] || 0;
          return (
            <g key={zone.id}>
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                rx="1.5" ry="1.5"
                className={`${getZoneColor(hits)} cursor-pointer transition-all ${hoveredZone === zone.id ? 'opacity-100 stroke-primary' : 'opacity-70 hover:opacity-100'}`}
                strokeWidth={hoveredZone === zone.id ? "0.8" : "0.4"}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => onZoneClick(zone.id)}
              />
              {hits > 0 && (
                <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 1.5} textAnchor="middle" className="fill-foreground text-[3px] font-bold pointer-events-none">
                  {hits}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hoveredZone && (
        <div className="text-center mt-1">
          <span className="text-xs font-medium text-primary">
            {DAMAGE_ZONES.find(z => z.id === hoveredZone)?.label} — {zoneHits[hoveredZone] || 0} incidents
          </span>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" /> Clean</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50" /> Minor</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/40 border border-red-500/60" /> Multiple</span>
      </div>
    </div>
  );
}

export default function VehicleIntelligencePage() {
  const { data: vehiclesData } = useQuery({ queryKey: ["/api/vehicles"] });
  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
  const [selectedVehicle, setSelectedVehicle] = React.useState<any>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedZone, setSelectedZone] = React.useState<string | null>(null);

  const { data: evidenceData } = useQuery({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "evidence"],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${selectedVehicle.id}/evidence`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedVehicle?.id,
  });
  const evidence = Array.isArray(evidenceData) ? evidenceData : [];

  const { data: trendsResult } = useQuery<{ totalWashes: number; totalEvidence: number; recentWashes: number; recentEvidence: number; topZones: { zone: string; count: number }[] }>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "trends"],
    queryFn: () => fetch(`/api/vehicles/${selectedVehicle.id}/trends`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!selectedVehicle?.id,
  });
  const vehicleTrends = trendsResult || { totalWashes: 0, totalEvidence: 0, recentWashes: 0, recentEvidence: 0, topZones: [] };

  // Compute zone hits from real evidence data
  const zoneHits: Record<string, number> = {};
  evidence.forEach((ev: any) => {
    if (ev.zone) {
      zoneHits[ev.zone] = (zoneHits[ev.zone] || 0) + 1;
    }
  });
  const damageEvidence = evidence.filter((ev: any) => ev.evidenceType === 'damage');

  const filtered = vehicles.filter((v: any) =>
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    ready: 'text-green-400 bg-green-500/10', washing: 'text-blue-400 bg-blue-500/10',
    maintenance: 'text-yellow-400 bg-yellow-500/10', returned: 'text-purple-400 bg-purple-500/10',
    rented: 'text-orange-400 bg-orange-500/10'
  };

  const readinessScore = selectedVehicle ? (
    (selectedVehicle.fuelLevel > 50 ? 30 : 15) +
    (selectedVehicle.status === 'ready' ? 40 : selectedVehicle.status === 'washing' ? 20 : 10) +
    (selectedVehicle.mileage < 50000 ? 30 : selectedVehicle.mileage < 100000 ? 20 : 10)
  ) : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Eye className="h-5 w-5 text-primary" /> Vehicle Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Multimodal evidence, damage heatmap, predictive readiness, vehicle memory</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search plate or model..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-9" data-testid="input-vehicle-search" />
            </div>
          </div>
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-1 pb-4">
              {filtered.map((v: any) => (
                <button key={v.id} onClick={() => { setSelectedVehicle(v); setSelectedZone(null); }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${selectedVehicle?.id === v.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
                  data-testid={`vehicle-item-${v.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm font-mono">{v.plate}</p>
                      <p className="text-xs text-muted-foreground">{v.model}</p>
                    </div>
                    <Badge className={`text-[9px] ${statusColors[v.status] || ''}`}>{v.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={v.fuelLevel || 0} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground">{v.fuelLevel || 0}%</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedVehicle ? (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold font-mono">{selectedVehicle.plate}</h2>
                    <p className="text-muted-foreground">{selectedVehicle.model} — Category {selectedVehicle.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-0.5">Readiness Score</div>
                      <div className={`text-2xl font-bold ${readinessScore >= 80 ? 'text-green-400' : readinessScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {readinessScore}%
                      </div>
                    </div>
                    <Badge className={`${statusColors[selectedVehicle.status] || ''}`}>{selectedVehicle.status}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="glass-panel">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Gauge className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div><p className="text-lg font-bold">{selectedVehicle.mileage?.toLocaleString() || '—'}</p><p className="text-[10px] text-muted-foreground">km</p></div>
                    </CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Fuel className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div><p className="text-lg font-bold">{selectedVehicle.fuelLevel || '—'}%</p><p className="text-[10px] text-muted-foreground">Fuel</p></div>
                    </CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Camera className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div><p className="text-lg font-bold">{evidence.length}</p><p className="text-[10px] text-muted-foreground">Evidence</p></div>
                    </CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardContent className="p-3 flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div><p className="text-lg font-bold">{damageEvidence.length}</p><p className="text-[10px] text-muted-foreground">Damage</p></div>
                    </CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardContent className="p-3 flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div><p className="text-lg font-bold">{Object.keys(zoneHits).length}</p><p className="text-[10px] text-muted-foreground">Zones Hit</p></div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="timeline">
                  <TabsList>
                    <TabsTrigger value="timeline" data-testid="tab-timeline">Evidence Timeline</TabsTrigger>
                    <TabsTrigger value="damage" data-testid="tab-damage">Damage Heatmap</TabsTrigger>
                    <TabsTrigger value="predictive" data-testid="tab-predictive">Predictive</TabsTrigger>
                    <TabsTrigger value="memory" data-testid="tab-memory">Vehicle Memory</TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4 space-y-4">
                    <div className="flex justify-end gap-2 mb-2">
                      <Button variant="outline" size="sm" className="gap-1"><Camera className="h-3 w-3" /> Add Photo</Button>
                      <Button variant="outline" size="sm" className="gap-1"><Mic className="h-3 w-3" /> Voice Note</Button>
                      <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3 w-3" /> Inspection</Button>
                    </div>
                    {evidence.length > 0 ? (
                      <div className="space-y-3">
                        {evidence.map((ev: any) => {
                          const typeIcons: Record<string, any> = { photo: Camera, damage: AlertTriangle, inspection: FileText, voice_note: Mic };
                          const EvIcon = typeIcons[ev.evidenceType] || Camera;
                          return (
                            <div key={ev.id} className="flex gap-3 items-start" data-testid={`timeline-event-${ev.id}`}>
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                                <EvIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 border-b pb-3">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-medium capitalize">{ev.evidenceType?.replace('_', ' ')}</span>
                                  <Badge variant="outline" className="text-[9px]">{ev.source || 'system'}</Badge>
                                  {ev.zone && <Badge variant="secondary" className="text-[9px]">{ev.zone}</Badge>}
                                </div>
                                {ev.notes && <p className="text-sm text-muted-foreground">{ev.notes}</p>}
                                <p className="text-xs text-muted-foreground mt-1"><Clock className="h-3 w-3 inline mr-1" />{new Date(ev.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Card className="glass-panel border-dashed p-8 text-center">
                        <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <h3 className="font-semibold mb-1">No Evidence Yet</h3>
                        <p className="text-sm text-muted-foreground">Upload photos, voice notes, or inspection forms to build the vehicle's evidence timeline.</p>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="damage" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="glass-panel p-4">
                        <DamageHeatmap onZoneClick={(zone) => setSelectedZone(zone)} zoneHits={zoneHits} />
                      </Card>
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" /> Evidence Log
                          {selectedZone && (
                            <Badge variant="secondary" className="text-xs">{DAMAGE_ZONES.find(z => z.id === selectedZone)?.label}</Badge>
                          )}
                        </h4>
                        {(() => {
                          const filteredEvidence = selectedZone
                            ? evidence.filter((ev: any) => ev.zone === selectedZone)
                            : evidence;
                          if (filteredEvidence.length === 0) return (
                            <div className="text-center py-6 text-muted-foreground">
                              <Shield className="h-6 w-6 mx-auto mb-2 text-green-400/50" />
                              <p className="text-sm">{selectedZone ? 'No evidence recorded for this zone' : 'No evidence items recorded'}</p>
                            </div>
                          );
                          return filteredEvidence.map((ev: any, i: number) => (
                            <Card key={ev.id || i} className="glass-panel hover:border-primary/30 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-sm font-medium capitalize">{ev.evidenceType?.replace('_', ' ') || 'Evidence'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {ev.zone && <Badge variant="outline" className="text-[9px]">{DAMAGE_ZONES.find(z => z.id === ev.zone)?.label || ev.zone}</Badge>}
                                      <Badge variant="secondary" className="text-[9px]">{ev.source || 'system'}</Badge>
                                      <span className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                                  </div>
                                  {ev.severity && <Badge variant={ev.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[9px]">{ev.severity}</Badge>}
                                </div>
                              </CardContent>
                            </Card>
                          ));
                        })()}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="predictive" className="mt-4 space-y-4">
                    <Card className="glass-panel border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> AI Readiness Prediction</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 rounded-lg bg-muted/30">
                            <div className="text-2xl font-bold text-green-400">{readinessScore}%</div>
                            <div className="text-xs text-muted-foreground">Current Readiness</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted/30">
                            <div className="text-2xl font-bold text-blue-400">{vehicleTrends.totalWashes}</div>
                            <div className="text-xs text-muted-foreground">Total Washes</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted/30">
                            <div className="text-2xl font-bold text-purple-400">{vehicleTrends.totalEvidence}</div>
                            <div className="text-xs text-muted-foreground">Total Evidence</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1">Recent Activity (30 days)</p>
                            <p className="text-sm"><span className="font-bold">{vehicleTrends.recentWashes}</span> washes, <span className="font-bold">{vehicleTrends.recentEvidence}</span> evidence items</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1">Top Damage Zones</p>
                            {vehicleTrends.topZones.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {vehicleTrends.topZones.slice(0, 3).map((z, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px]">{DAMAGE_ZONES.find(d => d.id === z.zone)?.label || z.zone} ({z.count})</Badge>
                                ))}
                              </div>
                            ) : <p className="text-sm text-muted-foreground">No zone data</p>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(() => {
                            // Derive health metrics from real data
                            const fuelHealth = Math.min(100, (selectedVehicle.fuelLevel || 0));
                            const mileageHealth = selectedVehicle.mileage < 30000 ? 95 : selectedVehicle.mileage < 60000 ? 80 : selectedVehicle.mileage < 100000 ? 60 : 40;
                            const damageLoad = Math.max(0, 100 - damageEvidence.length * 15);
                            const washFreq = vehicleTrends.recentWashes >= 4 ? 90 : vehicleTrends.recentWashes >= 2 ? 70 : vehicleTrends.recentWashes >= 1 ? 50 : 30;
                            return [
                              { label: 'Fuel Level', value: fuelHealth, icon: <Fuel className="h-3 w-3" /> },
                              { label: 'Mileage Health', value: mileageHealth, icon: <Gauge className="h-3 w-3" /> },
                              { label: 'Body Condition', value: damageLoad, icon: <Shield className="h-3 w-3" /> },
                              { label: 'Wash Frequency', value: washFreq, icon: <Wrench className="h-3 w-3" /> },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center text-muted-foreground">{item.icon}</div>
                                <span className="text-sm w-32">{item.label}</span>
                                <Progress value={item.value} className="flex-1 h-2" />
                                <span className={`text-xs font-mono w-10 text-right ${item.value >= 80 ? 'text-green-400' : item.value >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {item.value}%
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass-panel">
                      <CardContent className="p-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" /> Utilization Forecast
                        </h4>
                        <div className="grid grid-cols-7 gap-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                            const util = [85, 72, 60, 90, 95, 45, 30][i];
                            return (
                              <div key={day} className="text-center">
                                <div className={`h-16 rounded-md mb-1 flex items-end justify-center ${util > 80 ? 'bg-primary/20' : util > 50 ? 'bg-amber-500/15' : 'bg-muted/30'}`}>
                                  <div className={`w-full rounded-md ${util > 80 ? 'bg-primary/40' : util > 50 ? 'bg-amber-500/30' : 'bg-muted/50'}`} style={{ height: `${util}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{day}</span>
                                <span className="text-[10px] font-mono block text-foreground/70">{util}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="memory" className="mt-4 space-y-3">
                    {(() => {
                      const topZone = Object.entries(zoneHits).sort((a, b) => b[1] - a[1])[0];
                      const topZoneLabel = topZone ? (DAMAGE_ZONES.find(z => z.id === topZone[0])?.label || topZone[0]) : null;
                      const memoryItems = [
                        { key: "Total Evidence", value: `${evidence.length} item(s) recorded`, source: "System", confidence: 1.0 },
                        { key: "Damage Records", value: `${damageEvidence.length} damage incident(s)`, source: "System", confidence: 1.0 },
                        { key: "Zones Affected", value: Object.keys(zoneHits).length > 0 ? `${Object.keys(zoneHits).length} zone(s) with evidence` : "No zones with damage", source: "System", confidence: 1.0 },
                        ...(topZone ? [{ key: "Most Vulnerable Zone", value: `${topZoneLabel} (${topZone[1]} incident${topZone[1] > 1 ? 's' : ''})`, source: "AI Learned", confidence: 0.85 }] : []),
                        { key: "Current Status", value: selectedVehicle.status, source: "System", confidence: 1.0 },
                        { key: "Fuel Level", value: `${selectedVehicle.fuelLevel || 0}%`, source: "System", confidence: 1.0 },
                        { key: "Mileage", value: `${selectedVehicle.mileage?.toLocaleString() || '—'} km`, source: "System", confidence: 1.0 },
                        { key: "Readiness Score", value: `${readinessScore}% — ${readinessScore >= 80 ? 'Good' : readinessScore >= 50 ? 'Fair' : 'Needs Attention'}`, source: "AI Learned", confidence: 0.9 },
                      ];
                      return memoryItems.map((mem, i) => (
                        <Card key={i} className="glass-panel hover:border-primary/20 transition-colors" data-testid={`memory-item-${i}`}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                <Brain className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{mem.key}</p>
                                <p className="text-xs text-muted-foreground">{mem.value}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{mem.source}</Badge>
                              <span className={`text-[10px] font-mono ${mem.confidence >= 0.9 ? 'text-green-400' : 'text-amber-400'}`}>
                                {Math.round(mem.confidence * 100)}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ));
                    })()}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                <h3 className="font-semibold mb-1">Select a Vehicle</h3>
                <p className="text-sm text-muted-foreground max-w-xs">Choose a vehicle to view its intelligence profile, evidence timeline, damage heatmap, and predictive readiness.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

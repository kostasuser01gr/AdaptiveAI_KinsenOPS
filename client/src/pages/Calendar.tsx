import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Car, Users, Droplets, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);

export default function CalendarPage() {
  const { data: shiftsData } = useQuery({ queryKey: ["/api/shifts"] });
  const { data: washData } = useQuery({ queryKey: ["/api/wash-queue"] });
  const { data: vehiclesData } = useQuery({ queryKey: ["/api/vehicles"] });
  const { data: reservationsData } = useQuery({ queryKey: ["/api/reservations"] });

  const shifts = Array.isArray(shiftsData) ? shiftsData : [];
  const washes = Array.isArray(washData) ? washData : [];
  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
  const reservationsList = Array.isArray(reservationsData) ? reservationsData : [];

  const [weekOffset, setWeekOffset] = React.useState(0);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const shiftColors: Record<string, string> = {
    Manager: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    Agent: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    Washer: 'bg-green-500/20 border-green-500/40 text-green-300',
  };

  const parseShiftHours = (s: string) => {
    if (!s || s === 'OFF') return null;
    const [start, end] = s.split('-').map(Number);
    return { start, end };
  };

  // Build fleet events from real reservations
  const fleetEvents = React.useMemo(() => {
    const events: { day: number; hour: number; label: string; type: 'pickup' | 'return' }[] = [];
    for (const r of reservationsList) {
      const pickup = new Date(r.pickupDate);
      const ret = new Date(r.returnDate);
      // Find vehicle plate for the label
      const vehicle = vehicles.find((v: any) => v.id === r.vehicleId);
      const plate = vehicle ? (vehicle as any).plate : `Res#${r.id}`;
      // Check if pickup falls in current week
      for (let di = 0; di < 7; di++) {
        const wd = weekDates[di];
        if (pickup.toDateString() === wd.toDateString()) {
          events.push({ day: di, hour: pickup.getHours() || 9, label: `${plate} Pickup`, type: 'pickup' });
        }
        if (ret.toDateString() === wd.toDateString()) {
          events.push({ day: di, hour: ret.getHours() || 16, label: `${plate} Return`, type: 'return' });
        }
      }
    }
    return events;
  }, [reservationsList, vehicles, weekDates]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <CalendarDays className="h-5 w-5 text-primary" /> Master Calendar
          </h1>
          <p className="text-sm text-muted-foreground">Shifts, fleet events, and queue pressure — unified week view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-prev-week"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} data-testid="button-today">Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-next-week"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-purple-500/40" /><span className="text-xs text-muted-foreground">Manager</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-blue-500/40" /><span className="text-xs text-muted-foreground">Agent</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-green-500/40" /><span className="text-xs text-muted-foreground">Washer</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-orange-500/40" /><span className="text-xs text-muted-foreground">Pickup</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-cyan-500/40" /><span className="text-xs text-muted-foreground">Return</span></div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-8 gap-0 border rounded-lg overflow-hidden">
            <div className="bg-muted/30 p-2 border-r border-b">
              <span className="text-xs font-medium text-muted-foreground">Week</span>
            </div>
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} className={`p-2 text-center border-b ${i < 6 ? 'border-r' : ''} ${isToday ? 'bg-primary/10' : 'bg-muted/20'}`}>
                  <p className="text-xs font-medium text-muted-foreground">{DAYS[i]}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</p>
                </div>
              );
            })}

            {shifts.map((shift: any, si: number) => (
              <React.Fragment key={si}>
                <div className="p-2 border-r border-b bg-muted/10 flex items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{shift.employeeName?.[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium truncate leading-tight">{shift.employeeName}</p>
                      <p className="text-[10px] text-muted-foreground">{shift.employeeRole}</p>
                    </div>
                  </div>
                </div>
                {DAYS.map((_, di) => {
                  const schedule = Array.isArray(shift.schedule) ? shift.schedule : [];
                  const slot = schedule[di] || 'OFF';
                  const hours = parseShiftHours(slot);
                  const colorClass = shiftColors[shift.employeeRole] || 'bg-muted/30 text-muted-foreground';
                  return (
                    <div key={di} className={`p-1.5 border-b ${di < 6 ? 'border-r' : ''} flex items-center justify-center min-h-[48px]`}>
                      {hours ? (
                        <div className={`w-full rounded-md border px-2 py-1 text-center ${colorClass}`} data-testid={`shift-cell-${si}-${di}`}>
                          <p className="text-xs font-bold">{slot}</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">OFF</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}

            <div className="p-2 border-r bg-muted/10 flex items-center">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Fleet Events</span>
              </div>
            </div>
            {DAYS.map((_, di) => (
              <div key={di} className={`p-1.5 ${di < 6 ? 'border-r' : ''} space-y-1 min-h-[48px]`}>
                {fleetEvents.filter(e => e.day === di).map((ev, ei) => (
                  <div key={ei} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ev.type === 'pickup' ? 'bg-orange-500/20 text-orange-300' : 'bg-cyan-500/20 text-cyan-300'}`} data-testid={`event-${di}-${ei}`}>
                    {ev.label}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-panel">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-lg font-bold">{shifts.length}</p>
                  <p className="text-xs text-muted-foreground">Staff Scheduled</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardContent className="p-4 flex items-center gap-3">
                <Droplets className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-lg font-bold">{washes.length}</p>
                  <p className="text-xs text-muted-foreground">Wash Queue Items</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardContent className="p-4 flex items-center gap-3">
                <Car className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-lg font-bold">{vehicles.filter(v => v.status === 'ready').length}</p>
                  <p className="text-xs text-muted-foreground">Fleet Ready</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Droplets, Wrench, ArrowRightLeft, Camera, Activity } from 'lucide-react';

type TimelineEntry = {
  id: string;
  type: "event" | "wash" | "repair" | "transfer" | "evidence";
  title: string;
  description?: string;
  status?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

const TYPE_CONFIG: Record<string, { icon: typeof Activity; color: string; bg: string }> = {
  event: { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
  wash: { icon: Droplets, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  repair: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10" },
  transfer: { icon: ArrowRightLeft, color: "text-purple-500", bg: "bg-purple-500/10" },
  evidence: { icon: Camera, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  in_progress: "secondary",
  pending: "outline",
  cancelled: "destructive",
  failed: "destructive",
};

export function VehicleTimeline({ vehicleId }: { vehicleId: number }) {
  const { data: entries, isLoading } = useQuery<TimelineEntry[]>({
    queryKey: [`/api/vehicles/${vehicleId}/timeline`],
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Car className="w-4 h-4" /> Vehicle Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const items = entries ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="w-4 h-4" /> Vehicle Timeline
          <Badge variant="outline" className="ml-auto font-normal">{items.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No timeline events found.</div>
          ) : (
            <div className="relative px-6 pb-6">
              <div className="absolute left-[31px] top-0 bottom-0 w-px bg-border" />
              {items.map((entry) => {
                const config = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.event;
                const Icon = config.icon;
                return (
                  <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{entry.title}</span>
                        {entry.status && (
                          <Badge variant={STATUS_VARIANT[entry.status] ?? "outline"} className="text-[10px] px-1.5 py-0">
                            {entry.status}
                          </Badge>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.description}</p>
                      )}
                      <time className="text-[10px] text-muted-foreground/60 mt-1 block">
                        {new Date(entry.timestamp).toLocaleString()}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

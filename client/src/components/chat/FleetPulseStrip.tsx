import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { Car, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FleetCounts {
  ready: number;
  cleaning: number;
  qc: number;
  blocked: number;
  rented: number;
}

const PILL_CONFIG = [
  { key: 'ready' as const, label: 'Ready', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  { key: 'cleaning' as const, label: 'Cleaning', color: 'bg-primary', textColor: 'text-primary' },
  { key: 'qc' as const, label: 'In QC', color: 'bg-amber-500', textColor: 'text-amber-500' },
  { key: 'blocked' as const, label: 'Blocked', color: 'bg-destructive', textColor: 'text-destructive' },
  { key: 'rented' as const, label: 'Rented', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' },
];

export function FleetPulseStrip({ onPillClick }: { onPillClick?: (command: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: summary } = useQuery<{ vehiclesByStatus: Record<string, number>; totalVehicles: number }>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 30000,
  });

  const { data: dashStats } = useQuery<{ vehicles: number; washQueue: number }>({
    queryKey: queryKeys.dashboard.stats(),
    refetchInterval: 30000,
  });

  // Derive counts from available data
  const vByStatus = summary?.vehiclesByStatus || {};
  const counts: FleetCounts = {
    ready: vByStatus.ready ?? 0,
    cleaning: vByStatus.washing ?? vByStatus.cleaning ?? 0,
    qc: vByStatus.qc ?? vByStatus.quality_check ?? 0,
    blocked: vByStatus.out_of_service ?? vByStatus.blocked ?? 0,
    rented: vByStatus.rented ?? 0,
  };

  const total = summary?.totalVehicles ?? dashStats?.vehicles ?? 0;
  if (total === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-card text-[11px] font-mono text-muted-foreground hover:border-primary/30 transition-colors mx-auto"
      >
        <Car className="h-3 w-3" />
        <span>{total} vehicles</span>
        <ChevronDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-t bg-card/80 backdrop-blur-sm flex-wrap">
      <button
        onClick={() => setCollapsed(true)}
        className="p-1 rounded hover:bg-muted transition-colors"
        title="Collapse fleet pulse"
      >
        <ChevronUp className="h-3 w-3 text-muted-foreground" />
      </button>
      {PILL_CONFIG.map(pill => {
        const count = counts[pill.key];
        return (
          <button
            key={pill.key}
            onClick={() => onPillClick?.(`/fleet status:${pill.key} `)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
              "border bg-card hover:border-primary/30 transition-all",
              "text-xs font-mono cursor-pointer"
            )}
            title={`Click to query ${pill.label.toLowerCase()} vehicles`}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", pill.color)} />
            <span className="text-muted-foreground">{pill.label}</span>
            <span className="font-semibold text-foreground">{count}</span>
          </button>
        );
      })}
      <span className="text-[10px] text-muted-foreground font-mono ml-auto hidden sm:inline">
        fleet pulse · {total} total
      </span>
    </div>
  );
}

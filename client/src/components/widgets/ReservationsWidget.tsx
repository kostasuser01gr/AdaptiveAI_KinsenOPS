import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

const statusColor: Record<string, string> = {
  confirmed: 'bg-blue-500/10 text-blue-600',
  checked_out: 'bg-emerald-500/10 text-emerald-600',
  returned: 'bg-slate-500/10 text-slate-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function ReservationsWidget({ config }: WidgetProps) {
  const { data: reservations = [] } = useQuery<any[]>({
    queryKey: ['/api/reservations'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const upcoming = reservations
    .filter((r: any) => r.status === 'confirmed')
    .slice(0, 6);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{upcoming.length} upcoming</span>
        </div>
        {upcoming.map((r: any) => (
          <div key={r.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{r.customerName}</span>
              <Badge className={`text-[10px] ${statusColor[r.status] || ''}`}>{r.status}</Badge>
            </div>
            <div className="text-muted-foreground mt-0.5">
              {new Date(r.pickupDate).toLocaleDateString()} → {new Date(r.returnDate).toLocaleDateString()}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No upcoming reservations</div>
        )}
      </div>
    </ScrollArea>
  );
}

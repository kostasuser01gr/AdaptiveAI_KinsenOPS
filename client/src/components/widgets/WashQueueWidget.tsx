import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Droplets } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { WidgetProps } from './index';

export default function WashQueueWidget({ config }: WidgetProps) {
  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ['/api/wash-queue'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const pending = queue.filter((w: any) => w.status === 'pending');
  const inProgress = queue.filter((w: any) => w.status === 'in_progress');
  const completed = queue.filter((w: any) => w.status === 'completed');
  const total = queue.length || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Droplets className="h-3.5 w-3.5" />
        <span>{queue.length} items in queue</span>
      </div>
      <Progress value={(completed.length / total) * 100} className="h-2" />
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="text-lg font-semibold text-amber-500">{pending.length}</div>
          <div className="text-muted-foreground">Pending</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-blue-500">{inProgress.length}</div>
          <div className="text-muted-foreground">Active</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-emerald-500">{completed.length}</div>
          <div className="text-muted-foreground">Done</div>
        </div>
      </div>
      {inProgress.slice(0, 3).map((w: any) => (
        <div key={w.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
          <span className="font-mono">{w.vehiclePlate}</span>
          <Badge variant="outline" className="text-[10px]">{w.washType}</Badge>
        </div>
      ))}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

export default function ActivityFeedWidget({ config }: WidgetProps) {
  const { data: feed = [] } = useQuery<any[]>({
    queryKey: ['/api/activity-feed'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const items = feed.slice(0, (config?.limit as number) || 10);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No recent activity</div>
        ) : items.map((item: any) => (
          <div key={item.id} className="flex items-start gap-2 text-xs">
            <Activity className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <span className="font-medium">{item.actorName}</span>{' '}
              <span className="text-muted-foreground">{item.action}</span>{' '}
              {item.entityLabel && <span className="font-medium">{item.entityLabel}</span>}
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(item.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

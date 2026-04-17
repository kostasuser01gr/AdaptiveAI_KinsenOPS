import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Bell, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/useAuth';
import type { WidgetProps } from './index';

export default function NotificationsWidget({ config }: WidgetProps) {
  const { user } = useAuth();
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!user,
  });

  const unread = notifications.filter((n: any) => !n.read);
  const items = unread.slice(0, 8);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {unread.length > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Bell className="h-3 w-3" />
            {unread.length} unread
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground text-xs">
            <CheckCheck className="h-5 w-5 mb-1" />
            All caught up!
          </div>
        ) : items.map((n: any) => (
          <div key={n.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
            <div className="font-medium truncate">{n.title}</div>
            <div className="text-muted-foreground truncate">{n.body}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

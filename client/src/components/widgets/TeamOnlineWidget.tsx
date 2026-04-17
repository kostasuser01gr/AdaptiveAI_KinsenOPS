import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Users, Circle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

export default function TeamOnlineWidget({ config }: WidgetProps) {
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{users.length} team members</span>
        </div>
        {users.slice(0, 10).map((u: any) => (
          <div key={u.id} className="flex items-center gap-2 text-xs">
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
            <span className="font-medium">{u.displayName}</span>
            <span className="text-muted-foreground ml-auto text-[10px] capitalize">{u.role}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

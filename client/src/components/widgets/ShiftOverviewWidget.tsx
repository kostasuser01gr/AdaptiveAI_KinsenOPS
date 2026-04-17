import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

export default function ShiftOverviewWidget({ config }: WidgetProps) {
  const { data: shifts = [] } = useQuery<any[]>({
    queryKey: ['/api/shifts'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const published = shifts.filter((s: any) => s.status === 'published');
  const today = new Date().toLocaleDateString('en-CA');

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{published.length} published shifts</span>
        </div>
        {published.slice(0, 6).map((s: any) => (
          <div key={s.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{s.employeeName}</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{s.employeeRole}</Badge>
          </div>
        ))}
        {published.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No published shifts</div>
        )}
      </div>
    </ScrollArea>
  );
}

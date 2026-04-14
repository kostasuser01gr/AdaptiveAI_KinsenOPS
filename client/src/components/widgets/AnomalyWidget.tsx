import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

export default function AnomalyWidget({ config: _config }: WidgetProps) {
  const { data: anomalies = [] } = useQuery<any[]>({
    queryKey: ['/api/anomalies'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const open = anomalies.filter((a: any) => a.status === 'open');

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>{open.length} active anomalies</span>
        </div>
        {open.slice(0, 5).map((a: any) => (
          <div key={a.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{a.title}</span>
              <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                {a.severity}
              </Badge>
            </div>
            <div className="text-muted-foreground truncate mt-0.5">{a.type}</div>
          </div>
        ))}
        {open.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No anomalies detected</div>
        )}
      </div>
    </ScrollArea>
  );
}

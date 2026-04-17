import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetProps } from './index';

const severityColor: Record<string, string> = {
  low: 'bg-slate-500/10 text-slate-600',
  medium: 'bg-amber-500/10 text-amber-600',
  high: 'bg-orange-500/10 text-orange-600',
  critical: 'bg-red-500/10 text-red-600',
};

export default function IncidentsWidget({ config }: WidgetProps) {
  const { data: incidents = [] } = useQuery<any[]>({
    queryKey: ['/api/incidents'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const open = incidents.filter((i: any) => i.status === 'open' || i.status === 'investigating');

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{open.length} open incidents</span>
        </div>
        {open.slice(0, 6).map((inc: any) => (
          <div key={inc.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{inc.title}</span>
              <Badge className={`text-[10px] ${severityColor[inc.severity] || ''}`}>{inc.severity}</Badge>
            </div>
            <div className="text-muted-foreground truncate mt-0.5">{inc.category}</div>
          </div>
        ))}
        {open.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No open incidents</div>
        )}
      </div>
    </ScrollArea>
  );
}

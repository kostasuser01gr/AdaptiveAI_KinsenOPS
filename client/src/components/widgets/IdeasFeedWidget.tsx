import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation } from 'wouter';
import type { WidgetProps } from './index';

const statusColor: Record<string, string> = {
  proposed: 'bg-blue-500/10 text-blue-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  applied: 'bg-purple-500/10 text-purple-600',
  rejected: 'bg-red-500/10 text-red-600',
};

export default function IdeasFeedWidget({ config: _config }: WidgetProps) {
  const [, navigate] = useLocation();
  const { data: proposals = [] } = useQuery<any[]>({
    queryKey: ['/api/ideas'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const recent = proposals.slice(0, 6);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>{proposals.length} ideas</span>
          </div>
          <button className="text-primary text-[10px] hover:underline" onClick={() => navigate('/ideas')}>
            View all
          </button>
        </div>
        {recent.map((p: any) => (
          <div key={p.id} className="text-xs bg-muted/50 rounded px-2 py-1.5 cursor-pointer hover:bg-muted" onClick={() => navigate('/ideas')}>
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{p.label}</span>
              <Badge className={`text-[10px] ${statusColor[p.status] || ''}`}>{p.status}</Badge>
            </div>
            {p.description && <div className="text-muted-foreground truncate mt-0.5">{p.description}</div>}
          </div>
        ))}
        {recent.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No ideas yet — be the first!</div>
        )}
      </div>
    </ScrollArea>
  );
}

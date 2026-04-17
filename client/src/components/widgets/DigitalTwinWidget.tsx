import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Layers } from 'lucide-react';
import type { WidgetProps } from './index';

export default function DigitalTwinWidget({ config }: WidgetProps) {
  const { data: snapshots = [] } = useQuery<any[]>({
    queryKey: ['/api/digital-twin/snapshots'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const latest = snapshots[0];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Layers className="h-8 w-8 text-primary/40 mb-2" />
      {latest ? (
        <div className="text-center">
          <div className="text-xs font-medium">Latest Snapshot</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {latest.snapshotType} &middot; {new Date(latest.createdAt).toLocaleString()}
          </div>
          <div className="text-lg font-semibold mt-2">
            {Object.keys(latest.data || {}).length} metrics
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No snapshots yet</div>
      )}
    </div>
  );
}

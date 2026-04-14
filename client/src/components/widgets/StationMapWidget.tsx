import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { MapPin } from 'lucide-react';
import type { WidgetProps } from './index';

export default function StationMapWidget({ config: _config }: WidgetProps) {
  const { data: stations = [] } = useQuery<any[]>({
    queryKey: ['/api/stations'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });
  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['/api/vehicles'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const stationCounts = vehicles.reduce((acc: Record<number, number>, v: any) => {
    if (v.stationId) acc[v.stationId] = (acc[v.stationId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{stations.length} stations</div>
      <div className="grid grid-cols-2 gap-2">
        {stations.slice(0, 8).map((s: any) => (
          <div key={s.id} className="bg-muted/50 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="font-medium truncate">{s.name}</span>
            </div>
            <div className="text-muted-foreground mt-0.5">
              {stationCounts[s.id] || 0} vehicles
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

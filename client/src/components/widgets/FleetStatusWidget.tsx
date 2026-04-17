import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Car, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WidgetProps } from './index';

const statusColors: Record<string, string> = {
  ready: 'bg-emerald-500/10 text-emerald-600',
  rented: 'bg-blue-500/10 text-blue-600',
  maintenance: 'bg-amber-500/10 text-amber-600',
  damaged: 'bg-red-500/10 text-red-600',
};
const statusIcons: Record<string, React.ReactNode> = {
  ready: <CheckCircle2 className="h-3.5 w-3.5" />,
  rented: <Car className="h-3.5 w-3.5" />,
  maintenance: <Clock className="h-3.5 w-3.5" />,
  damaged: <AlertTriangle className="h-3.5 w-3.5" />,
};

export default function FleetStatusWidget({ config }: WidgetProps) {
  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['/api/vehicles'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const counts = vehicles.reduce((acc: Record<string, number>, v: any) => {
    const s = v.status || 'ready';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const statuses = ['ready', 'rented', 'maintenance', 'damaged'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{vehicles.length} vehicles total</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {statuses.map(s => (
          <div key={s} className={`rounded-lg px-3 py-2 flex items-center gap-2 ${statusColors[s] || 'bg-muted'}`}>
            {statusIcons[s]}
            <div>
              <div className="text-lg font-semibold leading-none">{counts[s] || 0}</div>
              <div className="text-[10px] capitalize opacity-80">{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

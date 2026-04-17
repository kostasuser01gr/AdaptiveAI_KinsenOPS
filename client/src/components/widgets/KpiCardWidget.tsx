import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WidgetProps } from './index';

export default function KpiCardWidget({ config }: WidgetProps) {
  const slug = (config?.slug as string) || 'fleet-utilization';
  const { data: stats } = useQuery<Record<string, unknown>>({
    queryKey: ['/api/analytics/dashboard'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const value = (stats as any)?.[slug] ?? (stats as any)?.totalVehicles ?? 0;
  const trend = (config?.trend as number) ?? 0;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-3xl font-bold tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-muted-foreground mt-1 capitalize">
        {(config?.label as string) || slug.replace(/-/g, ' ')}
      </div>
      {trend !== 0 && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

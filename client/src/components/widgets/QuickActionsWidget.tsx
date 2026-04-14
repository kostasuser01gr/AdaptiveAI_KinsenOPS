import { useLocation } from 'wouter';
import { Zap, Plus, Car, CalendarDays, MessageSquare, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WidgetProps } from './index';

const defaultActions = [
  { label: 'New Wash', icon: Plus, path: '/washers' },
  { label: 'Add Vehicle', icon: Car, path: '/fleet' },
  { label: 'Schedule', icon: CalendarDays, path: '/calendar' },
  { label: 'AI Chat', icon: MessageSquare, path: '/' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
];

export default function QuickActionsWidget({ config }: WidgetProps) {
  const [, navigate] = useLocation();
  const actions = (config?.actions as typeof defaultActions) || defaultActions;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => {
        const Icon = typeof a.icon === 'string' ? Zap : a.icon;
        return (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => navigate(a.path)}
          >
            <Icon className="h-3.5 w-3.5" />
            {a.label}
          </Button>
        );
      })}
    </div>
  );
}

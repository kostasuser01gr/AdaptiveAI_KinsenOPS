import React, { lazy, Suspense, type ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Widget Component Registry ───
// Maps widget slugs (from widget_definitions.component) to lazy-loaded React components.
// Each widget receives `config` prop for customization.

export interface WidgetProps {
  config?: Record<string, unknown>;
}

// Lazy-load widget components to keep initial bundle small
const FleetStatusWidget = lazy(() => import('./FleetStatusWidget'));
const WashQueueWidget = lazy(() => import('./WashQueueWidget'));
const KpiCardWidget = lazy(() => import('./KpiCardWidget'));
const ActivityFeedWidget = lazy(() => import('./ActivityFeedWidget'));
const NotificationsWidget = lazy(() => import('./NotificationsWidget'));
const QuickActionsWidget = lazy(() => import('./QuickActionsWidget'));
const ShiftOverviewWidget = lazy(() => import('./ShiftOverviewWidget'));
const IncidentsWidget = lazy(() => import('./IncidentsWidget'));
const StationMapWidget = lazy(() => import('./StationMapWidget'));
const ChatSummaryWidget = lazy(() => import('./ChatSummaryWidget'));
const ReservationsWidget = lazy(() => import('./ReservationsWidget'));
const AnomalyWidget = lazy(() => import('./AnomalyWidget'));
const DigitalTwinWidget = lazy(() => import('./DigitalTwinWidget'));
const TeamOnlineWidget = lazy(() => import('./TeamOnlineWidget'));
const IdeasFeedWidget = lazy(() => import('./IdeasFeedWidget'));

const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {
  FleetStatusWidget,
  WashQueueWidget,
  KpiCardWidget,
  ActivityFeedWidget,
  NotificationsWidget,
  QuickActionsWidget,
  ShiftOverviewWidget,
  IncidentsWidget,
  StationMapWidget,
  ChatSummaryWidget,
  ReservationsWidget,
  AnomalyWidget,
  DigitalTwinWidget,
  TeamOnlineWidget,
  IdeasFeedWidget,
};

export function getWidgetComponent(componentKey: string): ComponentType<WidgetProps> | undefined {
  return widgetRegistry[componentKey];
}

function WidgetFallback() {
  return <Skeleton className="w-full h-full min-h-[60px] rounded-lg" />;
}

export function RenderWidget({ componentKey, config }: { componentKey: string; config?: Record<string, unknown> }) {
  const Component = widgetRegistry[componentKey];
  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Widget "{componentKey}" not found
      </div>
    );
  }
  return (
    <Suspense fallback={<WidgetFallback />}>
      <Component config={config} />
    </Suspense>
  );
}

export default widgetRegistry;

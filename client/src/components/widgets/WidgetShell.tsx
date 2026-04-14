import React, { useMemo } from 'react';
import { DraggableGrid, type GridWidget } from '@/components/ui/draggable-grid';
import { RenderWidget } from '@/components/widgets';
import { useGridLayout } from '@/hooks/useGridLayout';
import type { TabWidget, WidgetDefinition } from '@shared/schema';

interface WidgetShellProps {
  tabId: number;
  tabWidgets: TabWidget[];
  widgetCatalog: WidgetDefinition[];
  onLayoutChange?: (layouts: Array<{ id: number; x: number; y: number; w: number; h: number }>) => void;
}

export function WidgetShell({ tabId, tabWidgets, widgetCatalog, onLayoutChange }: WidgetShellProps) {
  const catalogMap = useMemo(
    () => new Map(widgetCatalog.map(w => [w.slug, w])),
    [widgetCatalog]
  );

  const defaultLayout = useMemo(
    () => tabWidgets.map(tw => ({
      i: String(tw.id),
      x: tw.x,
      y: tw.y,
      w: tw.w,
      h: tw.h,
      minW: catalogMap.get(tw.widgetSlug)?.minW ?? 2,
      minH: catalogMap.get(tw.widgetSlug)?.minH ?? 2,
      maxW: catalogMap.get(tw.widgetSlug)?.maxW ?? undefined,
      maxH: catalogMap.get(tw.widgetSlug)?.maxH ?? undefined,
    })),
    [tabWidgets, catalogMap]
  );

  const { layouts, editMode, setEditMode, onLayoutChange: handleLayoutChange, resetLayout } = useGridLayout(
    `tab-${tabId}`,
    defaultLayout
  );

  const gridWidgets: GridWidget[] = useMemo(
    () => tabWidgets.map(tw => {
      const def = catalogMap.get(tw.widgetSlug);
      return {
        i: String(tw.id),
        title: def?.name ?? tw.widgetSlug,
        component: (
          <RenderWidget
            componentKey={def?.component ?? tw.widgetSlug}
            config={tw.config ?? def?.defaultConfig ?? undefined}
          />
        ),
      };
    }),
    [tabWidgets, catalogMap]
  );

  const handleGridChange = (newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    handleLayoutChange(newLayout as any);
    if (onLayoutChange) {
      const mapped = newLayout.map(l => ({
        id: Number(l.i),
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      }));
      onLayoutChange(mapped);
    }
  };

  return (
    <DraggableGrid
      widgets={gridWidgets}
      layouts={layouts}
      editMode={editMode}
      onLayoutChange={handleGridChange}
      onResetLayout={resetLayout}
      onToggleEdit={() => setEditMode(!editMode)}
    />
  );
}

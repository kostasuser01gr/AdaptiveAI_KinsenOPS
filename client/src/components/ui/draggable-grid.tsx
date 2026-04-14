import React, { useMemo } from 'react';
import ReactGridLayout, { WidthProvider } from 'react-grid-layout/legacy';

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GripVertical, RotateCcw, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import 'react-grid-layout/css/styles.css';

const GridLayout = WidthProvider(ReactGridLayout);

export interface GridWidget {
  i: string;
  title: string;
  component: React.ReactNode;
}

interface DraggableGridProps {
  widgets: GridWidget[];
  layouts: Layout[];
  editMode: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onResetLayout: () => void;
  onToggleEdit: () => void;
  cols?: number;
  rowHeight?: number;
}

export function DraggableGrid({
  widgets,
  layouts,
  editMode,
  onLayoutChange,
  onResetLayout,
  onToggleEdit,
  cols = 12,
  rowHeight = 80,
}: DraggableGridProps) {
  const widgetMap = useMemo(
    () => new Map(widgets.map(w => [w.i, w])),
    [widgets]
  );

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex gap-2 justify-end mb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={onToggleEdit}>
              {editMode ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              <span className="text-xs">{editMode ? 'Lock' : 'Customize'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{editMode ? 'Lock widget positions' : 'Drag widgets to rearrange'}</TooltipContent>
        </Tooltip>
        {editMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={onResetLayout}>
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="text-xs">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to default layout</TooltipContent>
          </Tooltip>
        )}
      </div>

      <GridLayout
        layout={layouts}
        cols={cols}
        rowHeight={rowHeight}
        onLayoutChange={onLayoutChange}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".grid-drag-handle"
        compactType="vertical"
        margin={[12, 12]}
        containerPadding={[0, 0]}
        className={editMode ? 'grid-edit-mode' : ''}
      >
        {layouts.map((l: any) => {
          const widget = widgetMap.get(l.i);
          if (!widget) return <div key={l.i} />;
          return (
            <div key={l.i} className={`${editMode ? 'ring-1 ring-dashed ring-primary/30 rounded-xl' : ''}`}>
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  {editMode && (
                    <GripVertical className="grid-drag-handle h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                  )}
                  <CardTitle className="text-sm font-medium flex-1">{widget.title}</CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-3rem)] overflow-auto">
                  {widget.component}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}

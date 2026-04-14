import { useState, useCallback, useMemo } from 'react';

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface WidgetConfig {
  i: string;
  title: string;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

const STORAGE_PREFIX = 'grid_layout_';

export function useGridLayout(pageId: string, defaultLayout: Layout[]) {
  const storageKey = `${STORAGE_PREFIX}${pageId}`;

  const [layouts, setLayouts] = useState<Layout[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Layout[];
        // Merge: keep saved positions but ensure all default widgets exist
        const savedMap = new Map(parsed.map(l => [l.i, l]));
        return defaultLayout.map(dl => savedMap.get(dl.i) ?? dl);
      }
    } catch { /* ignore corrupt data */ }
    return defaultLayout;
  });

  const [editMode, setEditMode] = useState(false);

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayouts(newLayout);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newLayout));
    } catch { /* quota exceeded */ }
  }, [storageKey]);

  const resetLayout = useCallback(() => {
    setLayouts(defaultLayout);
    localStorage.removeItem(storageKey);
  }, [defaultLayout, storageKey]);

  const lockedLayouts = useMemo(() => 
    editMode ? layouts : layouts.map(l => ({ ...l, static: true })),
  [layouts, editMode]);

  return {
    layouts: lockedLayouts,
    editMode,
    setEditMode,
    onLayoutChange,
    resetLayout,
  };
}

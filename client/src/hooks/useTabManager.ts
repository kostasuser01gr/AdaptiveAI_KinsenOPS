import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';

export interface OpenTab {
  id: string;
  path: string;
  label: string;
  icon?: string;
  pinned?: boolean;
}

const STORAGE_KEY = 'open_tabs';
const MAX_TABS = 12;

function loadTabs(): OpenTab[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveTabs(tabs: OpenTab[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch { /* quota exceeded */ }
}

export function useTabManager() {
  const [tabs, setTabs] = useState<OpenTab[]>(loadTabs);
  const [location, navigate] = useLocation();

  const activeTab = tabs.find(t => t.path === location);

  const openTab = useCallback((tab: Omit<OpenTab, 'id'>) => {
    setTabs(prev => {
      const existing = prev.find(t => t.path === tab.path);
      if (existing) return prev;
      const newTab: OpenTab = { ...tab, id: `tab-${Date.now()}` };
      const next = [...prev, newTab].slice(-MAX_TABS);
      saveTabs(next);
      return next;
    });
    navigate(tab.path);
  }, [navigate]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;
      const closing = prev[idx];
      const next = prev.filter(t => t.id !== tabId);
      saveTabs(next);

      // If closing active tab, navigate to nearest tab or home
      if (closing.path === location) {
        const nearest = next[Math.min(idx, next.length - 1)];
        navigate(nearest?.path || '/');
      }
      return next;
    });
  }, [location, navigate]);

  const closeOtherTabs = useCallback((keepId: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id === keepId || t.pinned);
      saveTabs(next);
      return next;
    });
  }, []);

  const pinTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === tabId ? { ...t, pinned: !t.pinned } : t);
      saveTabs(next);
      return next;
    });
  }, []);

  const reorderTab = useCallback((fromIdx: number, toIdx: number) => {
    setTabs(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      saveTabs(next);
      return next;
    });
  }, []);

  return {
    tabs,
    activeTab,
    openTab,
    closeTab,
    closeOtherTabs,
    pinTab,
    reorderTab,
  };
}

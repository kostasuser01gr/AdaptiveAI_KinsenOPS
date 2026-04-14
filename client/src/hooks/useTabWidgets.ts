import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import type { UserTab, TabWidget, WidgetDefinition } from '../../../shared/schema';

export function useUserTabs() {
  const qc = useQueryClient();
  const { data: tabs = [], ...rest } = useQuery<UserTab[]>({
    queryKey: queryKeys.tabs.all(),
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const createTab = useMutation({
    mutationFn: (data: { label: string; icon?: string; template?: string }) =>
      apiRequest('POST', '/api/tabs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.all() }),
  });

  const updateTab = useMutation({
    mutationFn: ({ id, ...data }: { id: number; label?: string; icon?: string }) =>
      apiRequest('PATCH', `/api/tabs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.all() }),
  });

  const deleteTab = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/tabs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.all() }),
  });

  const reorderTabs = useMutation({
    mutationFn: (tabIds: number[]) => apiRequest('POST', '/api/tabs/reorder', { tabIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.all() }),
  });

  return { tabs, createTab, updateTab, deleteTab, reorderTabs, ...rest };
}

export function useTabWidgets(tabId: number | null) {
  const qc = useQueryClient();
  const { data: widgets = [], ...rest } = useQuery<TabWidget[]>({
    queryKey: queryKeys.tabs.widgets(tabId),
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: tabId !== null,
  });

  const addWidget = useMutation({
    mutationFn: (data: { widgetSlug: string; x?: number; y?: number; w?: number; h?: number; config?: Record<string, unknown> }) =>
      apiRequest('POST', `/api/tabs/${tabId}/widgets`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.widgets(tabId) }),
  });

  const removeWidget = useMutation({
    mutationFn: (widgetId: number) => apiRequest('DELETE', `/api/tabs/${tabId}/widgets/${widgetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tabs.widgets(tabId) }),
  });

  const saveLayout = useMutation({
    mutationFn: (layouts: Array<{ id: number; x: number; y: number; w: number; h: number }>) =>
      apiRequest('PUT', `/api/tabs/${tabId}/layout`, { layouts }),
  });

  return { widgets, addWidget, removeWidget, saveLayout, ...rest };
}

export function useWidgetCatalog(category?: string) {
  const { data: catalog = [], ...rest } = useQuery<WidgetDefinition[]>({
    queryKey: queryKeys.widgets.catalog(category),
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });
  return { catalog, ...rest };
}

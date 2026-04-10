import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useCallback, useMemo } from 'react';

// ─── Per-user layout preferences ─────────────────────────────────────────────
//
// Uses the existing user_preferences table with category="layout".
// Each preference is scoped per-user, per-workspace (enforced server-side).
//
// Layout keys follow a dot-notation convention:
//   layout.sidebar.order        → sidebar nav item ordering
//   layout.sidebar.collapsed    → collapsed sidebar sections
//   layout.{page}.panels        → panel visibility/order per page
//   layout.{page}.widgets       → widget grid positions per page
//   layout.{page}.columns       → column visibility for tables
//   layout.dashboard.grid       → dashboard widget arrangement
//   layout.global.pinnedTabs    → globally pinned tabs
//
// Shared app graph (governed) is NEVER mutated by this hook.
// This is strictly per-user personalization.

interface LayoutPreference {
  id: number;
  userId: number;
  workspaceId: string;
  scope: string;
  category: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

const LAYOUT_CATEGORY = 'layout';

/**
 * Hook for reading/writing per-user layout preferences.
 * All mutations go through the existing /api/user-preferences endpoint.
 * Server enforces workspace scoping via wsFilter/wsInsert.
 */
export function useLayoutPreferences() {
  const queryClient = useQueryClient();

  const { data: allPrefs, isLoading } = useQuery<LayoutPreference[]>({
    queryKey: ['/api/user-preferences', LAYOUT_CATEGORY],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/user-preferences?category=${LAYOUT_CATEGORY}`);
      return res.json();
    },
  });

  const layoutPrefs = useMemo(() => allPrefs ?? [], [allPrefs]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      await apiRequest('POST', '/api/user-preferences', {
        category: LAYOUT_CATEGORY,
        key,
        value,
        scope: 'personal',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences'] });
    },
  });

  /** Get a layout preference value by key, with optional fallback. */
  const getLayout = useCallback(
    <T = unknown>(key: string, fallback?: T): T => {
      const pref = layoutPrefs.find((p) => p.key === key);
      return (pref ? pref.value : fallback) as T;
    },
    [layoutPrefs],
  );

  /** Save a layout preference (upserts via existing server logic). */
  const setLayout = useCallback(
    (key: string, value: unknown) => {
      saveMutation.mutate({ key, value });
    },
    [saveMutation],
  );

  return {
    /** All layout preferences for current user. */
    layoutPrefs,
    /** Whether preferences are still loading. */
    isLoading,
    /** Get a specific layout preference. */
    getLayout,
    /** Set a specific layout preference (persisted server-side). */
    setLayout,
    /** Whether a save is in-flight. */
    isSaving: saveMutation.isPending,
  };
}

// ─── Page-scoped convenience hook ────────────────────────────────────────────

/**
 * Convenience wrapper for page-specific layout state.
 * Automatically prefixes keys with the page name.
 *
 * Usage:
 *   const { get, set } = usePageLayout('fleet');
 *   const cols = get('columns', ['plate','status','mileage']);
 *   set('columns', ['plate','status']);
 */
export function usePageLayout(page: string) {
  const { getLayout, setLayout, isLoading, isSaving } = useLayoutPreferences();

  const get = useCallback(
    <T = unknown>(key: string, fallback?: T): T =>
      getLayout(`${page}.${key}`, fallback),
    [getLayout, page],
  );

  const set = useCallback(
    (key: string, value: unknown) => setLayout(`${page}.${key}`, value),
    [setLayout, page],
  );

  return { get, set, isLoading, isSaving };
}

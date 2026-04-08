import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "./queryClient";
import { useAuth } from "./useAuth";

/** Feature keys aligned with server/entitlements/engine.ts */
export type FeatureKey =
  | "exports"
  | "advanced_exports"
  | "automation_execution"
  | "ai_automation_drafting"
  | "executive_briefings"
  | "anomaly_detection"
  | "kpi_snapshots"
  | "connector_sync"
  | "knowledge_ingestion"
  | "trust_export_preview"
  | "document_storage"
  | "staffing_recommendations";

interface EntitlementPayload {
  plan: string;
  features: Record<string, boolean>;
}

/**
 * Fetch effective feature flags for the current workspace.
 * Returns a stable `hasFeature()` helper plus raw plan/features data.
 *
 * The backend remains authoritative — this is advisory for UI.
 */
export function useEntitlements() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<EntitlementPayload>({
    queryKey: ["/api/entitlements/features"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const features = data?.features ?? {};
  const plan = data?.plan ?? "core";

  function hasFeature(key: FeatureKey): boolean {
    // If entitlements haven't loaded yet, default to true (don't block UI while loading)
    if (!data) return true;
    return features[key] === true;
  }

  return { plan, features, hasFeature, isLoading, error };
}

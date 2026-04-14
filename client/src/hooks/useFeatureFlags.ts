import { useQuery } from "@tanstack/react-query";

interface FeatureFlagValue {
  enabled: boolean;
  description: string;
}

/**
 * Hook to check feature flags from the server.
 * Caches for 5 minutes to avoid excessive requests.
 */
export function useFeatureFlags() {
  const { data: flags = {} as Record<string, FeatureFlagValue> } = useQuery<Record<string, FeatureFlagValue>>({
    queryKey: ["/api/feature-flags"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    flags,
    isEnabled: (flag: string) => (flags as Record<string, FeatureFlagValue>)[flag]?.enabled ?? true,
  };
}

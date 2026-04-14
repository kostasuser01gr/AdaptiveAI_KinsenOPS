import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── App Graph Hooks ────────────────────────────────────────────────────────

export function useAppGraphVersions() {
  return useQuery<Array<{
    id: number;
    version: number;
    label: string | null;
    graph: Record<string, unknown>;
    diff: Record<string, unknown> | null;
    appliedAt: string | null;
    rolledBackAt: string | null;
    createdBy: number;
    createdAt: string;
  }>>({
    queryKey: ['/api/app-graph/versions'],
  });
}

export function useLatestAppGraph() {
  return useQuery<{
    id: number;
    version: number;
    label: string | null;
    graph: Record<string, unknown>;
    diff: Record<string, unknown> | null;
    appliedAt: string | null;
    rolledBackAt: string | null;
    createdBy: number;
    createdAt: string;
  } | null>({
    queryKey: ['/api/app-graph/latest'],
  });
}

export function useCreateAppGraphVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { graph: Record<string, unknown>; label?: string; diff?: Record<string, unknown> }) => {
      const res = await apiRequest('POST', '/api/app-graph/versions', data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/app-graph/versions'] });
      qc.invalidateQueries({ queryKey: ['/api/app-graph/latest'] });
    },
  });
}

export function useApplyAppGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const res = await apiRequest('POST', `/api/app-graph/versions/${version}/apply`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/app-graph/versions'] });
      qc.invalidateQueries({ queryKey: ['/api/app-graph/latest'] });
    },
  });
}

export function useRollbackAppGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const res = await apiRequest('POST', `/api/app-graph/versions/${version}/rollback`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/app-graph/versions'] });
      qc.invalidateQueries({ queryKey: ['/api/app-graph/latest'] });
    },
  });
}

// ─── Extension Hooks ────────────────────────────────────────────────────────

export function useInstalledExtensions() {
  return useQuery<Array<{
    id: number;
    slug: string;
    name: string;
    version: string;
    manifest: unknown;
    permissions: string[];
    enabled: boolean;
    installedAt: string;
  }>>({
    queryKey: ['/api/extensions'],
  });
}

export function useInstallExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { slug: string; name: string; version: string; manifest: unknown; permissions: string[] }) => {
      const res = await apiRequest('POST', '/api/extensions', data);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/extensions'] }),
  });
}

export function useToggleExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest('PATCH', `/api/extensions/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/extensions'] }),
  });
}

export function useUninstallExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/extensions/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/extensions'] }),
  });
}

// ─── AI Gateway Hooks ───────────────────────────────────────────────────────

export function useAiProviders() {
  return useQuery<Array<{ provider: string; models: string[] }>>({
    queryKey: ['/api/ai/providers'],
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: async (data: { provider: string; model: string; messages: Array<{ role: string; content: string }>; maxTokens?: number }) => {
      const res = await apiRequest('POST', '/api/ai/gateway/chat', data);
      return res.json();
    },
  });
}

export function useAiUsageStats() {
  return useQuery<Array<{
    id: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    latencyMs: number;
    createdAt: string;
  }>>({
    queryKey: ['/api/ai/usage'],
  });
}

type QueryParamValue = string | number | boolean;

function key(path: string) {
  return [path] as const;
}

function withParams(
  path: string,
  params?: Record<string, QueryParamValue | QueryParamValue[] | null | undefined>,
) {
  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();

  for (const [param, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        searchParams.append(param, String(entry));
      }
      continue;
    }

    searchParams.set(param, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export const queryKeys = {
  activity: {
    feed: (limit?: number) => key(withParams("/api/activity-feed", { limit })),
  },
  conversations: {
    all: () => key("/api/conversations"),
    messages: (conversationId: number) => ["/api/conversations", conversationId, "messages"] as const,
  },
  customActions: {
    all: () => key("/api/custom-actions"),
  },
  dashboard: {
    stats: () => key("/api/dashboard-stats"),
  },
  incidents: {
    byStatuses: (...statuses: string[]) => key(withParams("/api/incidents", { status: statuses })),
  },
  moduleRegistry: {
    all: () => key("/api/module-registry"),
  },
  notifications: {
    all: () => key("/api/notifications"),
  },
  proposals: {
    all: () => key("/api/proposals"),
  },
  shifts: {
    all: () => key("/api/shifts"),
    requests: () => key("/api/shift-requests"),
  },
  tabs: {
    all: () => key("/api/tabs"),
    widgets: (tabId: number | null) => ["/api/tabs", tabId, "widgets"] as const,
  },
  users: {
    all: () => key("/api/users"),
  },
  vehicles: {
    all: () => key("/api/vehicles"),
    evidence: (vehicleId: number | null | undefined) => ["/api/vehicles", vehicleId, "evidence"] as const,
    timeline: (vehicleId: number | null | undefined) => ["/api/vehicles", vehicleId, "timeline"] as const,
    trends: (vehicleId: number | null | undefined) => ["/api/vehicles", vehicleId, "trends"] as const,
  },
  washQueue: {
    all: () => key("/api/wash-queue"),
    overdue: () => key("/api/wash-queue/overdue"),
    scored: () => key("/api/wash-queue/scored"),
  },
  widgets: {
    catalog: (category?: string) => key(withParams("/api/widgets/catalog", { category })),
  },
};
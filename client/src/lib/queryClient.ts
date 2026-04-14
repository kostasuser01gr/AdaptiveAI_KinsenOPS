import { QueryClient, QueryFunction, onlineManager } from "@tanstack/react-query";

/**
 * Check if an error is an entitlement 403 from the backend.
 * Returns the feature key if it is, otherwise null.
 */
export function parseEntitlementError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  try {
    // Error message shape: "403: {json}"
    const msg = error.message;
    if (!msg.startsWith("403:")) return null;
    const json = JSON.parse(msg.slice(4).trim());
    if (json?.code === "ENTITLEMENT_REQUIRED" && json?.feature) {
      return json.feature as string;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      // Handle envelope error format { ok: false, error: { message } }
      if (body?.error?.message) {
        message = body.error.message;
        if (body.error.code) message = `${message} [${body.error.code}]`;
      } else if (body?.message) {
        message = body.message;
      }
    } catch {
      message = (await res.clone().text().catch(() => "")) || res.statusText;
    }
    throw new Error(`${res.status}: ${message}`);
  }
}

/** Extract `data` from the standard { ok, data } envelope, falling back to raw body. */
function unwrapEnvelope<T>(body: unknown): T {
  if (body && typeof body === "object" && "ok" in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>).data as T;
  }
  return body as T;
}

function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  const csrfToken = getCsrfToken();
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // Patch .json() to auto-unwrap the server envelope { ok, data }
  const originalJson = res.json.bind(res);
  (res as Response).json = async () => {
    const body = await originalJson();
    return unwrapEnvelope(body);
  };

  return res;
}

/** Convenience: apiRequest + auto-unwrap the envelope { ok, data }. */
export async function apiJson<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await apiRequest(method, url, data);
  const body = await res.json();
  return unwrapEnvelope<T>(body);
}

export function buildQueryPath(queryKey: readonly unknown[]): string {
  return queryKey
    .filter((segment) => segment !== undefined && segment !== null && segment !== "")
    .map((segment) => String(segment))
    .join("/");
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(buildQueryPath(queryKey), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfResNotOk(res);
    const body = await res.json();
    return unwrapEnvelope(body);
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // 30s stale time keeps operational data fresh without hammering the server
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

// Wire navigator.onLine to onlineManager so queries pause when offline
onlineManager.setEventListener((setOnline) => {
  const onOnline = () => setOnline(true);
  const onOffline = () => setOnline(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
});

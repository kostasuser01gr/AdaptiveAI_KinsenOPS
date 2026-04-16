import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

export interface SentryUserShape {
  id: number;
  username: string;
  role: string;
  workspaceId?: string | null;
}

export function setSentryUser(user: SentryUserShape | null) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: String(user.id),
    username: user.username,
    role: user.role,
    workspaceId: user.workspaceId ?? "default",
  });
}

export { Sentry };

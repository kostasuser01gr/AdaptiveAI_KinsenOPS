/**
 * Phase 4.3 — Workspace-scoped AsyncLocalStorage context.
 *
 * Any code running within a request can call getWorkspaceScope()
 * to obtain the current tenant's workspace ID without passing it
 * through every function signature.
 */
import { AsyncLocalStorage } from "async_hooks";

const store = new AsyncLocalStorage<string>();

/** Execute `fn` inside a workspace scope. All async descendants inherit the scope. */
export function runWithWorkspace<T>(workspaceId: string, fn: () => T): T {
  return store.run(workspaceId, fn);
}

/**
 * Read the current workspace ID from the async context.
 * Falls back to "default" when called outside a request (seed, tests, CLI).
 */
export function getWorkspaceScope(): string {
  return store.getStore() ?? "default";
}

import { test, expect } from "@playwright/test";
import { ADMIN, AGENT, loginAPI } from "./helpers";

/**
 * Auth boundary + RBAC tests — all API-level for stability.
 *
 * Covers:
 *   - Unauthenticated requests to protected endpoints → 401
 *   - Agent (non-admin) blocked from app-graph governance → 403
 *   - Admin can list app-graph versions → 200
 */

test.describe("Auth boundary — unauthenticated", () => {
  test("unauthenticated GET /api/vehicles returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/vehicles");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated GET /api/channels returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/channels");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated GET /api/app-graph/versions returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/app-graph/versions");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated GET /api/dashboard-stats returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/dashboard-stats");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated POST /api/app-graph/versions returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/app-graph/versions", {
      data: { label: "unauth", graph: { nodes: [], edges: [] } },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("RBAC — app-graph governance (agent blocked)", () => {
  test.beforeEach(async ({ request }) => {
    await loginAPI(request, AGENT);
  });

  test("agent cannot create app-graph version → 403", async ({ request }) => {
    const res = await request.post("/api/app-graph/versions", {
      data: { label: "e2e-blocked", graph: { nodes: [], edges: [] } },
    });
    expect(res.status()).toBe(403);
  });

  test("agent cannot apply app-graph version → 403", async ({ request }) => {
    const res = await request.post("/api/app-graph/versions/1/apply");
    expect(res.status()).toBe(403);
  });

  test("agent cannot rollback app-graph version → 403", async ({
    request,
  }) => {
    const res = await request.post("/api/app-graph/versions/1/rollback");
    expect(res.status()).toBe(403);
  });
});

test.describe("RBAC — app-graph governance (admin allowed)", () => {
  test("admin can list app-graph versions → 200", async ({ request }) => {
    await loginAPI(request, ADMIN);
    const res = await request.get("/api/app-graph/versions");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

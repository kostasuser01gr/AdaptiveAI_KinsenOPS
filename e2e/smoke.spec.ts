import { test, expect } from "@playwright/test";

/**
 * Minimal E2E smoke covering released surfaces:
 *   1. Login as admin
 *   2. Fleet page loads
 *   3. Channels page loads
 *   4. App Builder page loads (admin)
 *   5. App-graph RBAC rejects non-admin via API
 *
 * Requires: running dev server on BASE_URL (default http://localhost:5000)
 * Seed users: admin/admin123 (admin), john/john123 (agent)
 */

const ADMIN = { username: "admin", password: "admin123" };
const AGENT = { username: "john", password: "john123" };

async function login(
  page: import("@playwright/test").Page,
  creds: { username: string; password: string },
) {
  await page.goto("/");
  // Wait for the auth page to load
  await page.waitForSelector('[data-testid="input-login-username"]', {
    timeout: 15_000,
  });
  await page.fill('[data-testid="input-login-username"]', creds.username);
  await page.fill('[data-testid="input-login-password"]', creds.password);
  await page.click('[data-testid="button-login"]');
  // Wait for navigation away from auth — sidebar user badge appears
  await page.waitForSelector('[data-testid="text-user-displayname"]', {
    timeout: 10_000,
  });
}

test.describe("Smoke — admin login + page loads", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test("fleet page loads", async ({ page }) => {
    await page.goto("/fleet");
    await expect(page.locator('[data-testid="text-page-title"]')).toBeVisible({
      timeout: 10_000,
    });
    // Fleet table should render at least the search input
    await expect(
      page.locator('[data-testid="input-search-vehicles"]'),
    ).toBeVisible();
  });

  test("channels page loads", async ({ page }) => {
    await page.goto("/channels");
    // Channels page should render — wait for any meaningful content
    await expect(page.locator("h1, h2, [data-testid]").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("app builder page loads for admin", async ({ page }) => {
    await page.goto("/app-builder");
    await expect(page.locator("h1, h2, [data-testid]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("RBAC — app-graph API rejection for non-admin", () => {
  test("agent cannot create app-graph version", async ({ request }) => {
    // Login as agent via API
    const loginRes = await request.post("/api/auth/login", {
      data: { username: AGENT.username, password: AGENT.password },
    });
    expect(loginRes.ok()).toBeTruthy();

    // Attempt to create a version — should be 403
    const createRes = await request.post("/api/app-graph/versions", {
      data: { label: "e2e-blocked", graph: { nodes: [], edges: [] } },
    });
    expect(createRes.status()).toBe(403);
  });

  test("agent cannot apply app-graph version", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { username: AGENT.username, password: AGENT.password },
    });
    expect(loginRes.ok()).toBeTruthy();

    const applyRes = await request.post("/api/app-graph/versions/1/apply");
    expect(applyRes.status()).toBe(403);
  });

  test("agent cannot rollback app-graph version", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { username: AGENT.username, password: AGENT.password },
    });
    expect(loginRes.ok()).toBeTruthy();

    const rollbackRes = await request.post(
      "/api/app-graph/versions/1/rollback",
    );
    expect(rollbackRes.status()).toBe(403);
  });
});

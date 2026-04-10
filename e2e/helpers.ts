import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Shared helpers for E2E tests.
 * Seed users: admin/admin123 (admin), john/john123 (agent)
 * Dev server: http://localhost:5000
 */

export const ADMIN = { username: "admin", password: "admin123" };
export const AGENT = { username: "john", password: "john123" };

/** Browser-based login via the auth page form. */
export async function loginUI(
  page: Page,
  creds: { username: string; password: string },
) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="input-login-username"]', {
    timeout: 15_000,
  });
  await page.fill('[data-testid="input-login-username"]', creds.username);
  await page.fill('[data-testid="input-login-password"]', creds.password);
  await page.click('[data-testid="button-login"]');
  await page.waitForSelector('[data-testid="text-user-displayname"]', {
    timeout: 10_000,
  });
}

/** API-based login — returns cookies already stored on the request context. */
export async function loginAPI(
  request: APIRequestContext,
  creds: { username: string; password: string },
) {
  const res = await request.post("/api/auth/login", { data: creds });
  expect(res.ok()).toBeTruthy();
  return res;
}

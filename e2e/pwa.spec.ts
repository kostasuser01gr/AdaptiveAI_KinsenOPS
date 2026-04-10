import { test, expect } from "@playwright/test";

/**
 * PWA asset checks — verifies manifest and service worker are served correctly.
 * These are public static assets, no auth required.
 */

test.describe("PWA assets", () => {
  test("/manifest.json returns 200 with valid shape", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBeTruthy();
    expect(body.display).toBe("standalone");
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThanOrEqual(1);
  });

  test("/sw.js returns 200", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
  });
});

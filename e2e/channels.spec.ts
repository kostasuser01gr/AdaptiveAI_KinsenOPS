import { test, expect } from "@playwright/test";
import { ADMIN, loginUI, loginAPI } from "./helpers";

/**
 * Channels E2E — create channel, send message, verify render, cleanup via archive.
 * Uses both browser UI and API-assisted setup/cleanup for determinism.
 */

const TEST_CHANNEL = {
  name: `e2e-smoke-${Date.now()}`,
  type: "public",
  description: "Playwright E2E channel — auto-cleaned",
};

test.describe("Channels — CRUD flow", () => {
  let channelId: number;

  test("create channel via API, verify in UI, send message, archive", async ({
    page,
    request,
  }) => {
    // — Setup: create channel via API for speed & determinism —
    await loginAPI(request, ADMIN);
    const createRes = await request.post("/api/channels", {
      data: TEST_CHANNEL,
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    channelId = created.id;
    expect(created.name).toBe(TEST_CHANNEL.name);
    expect(created.slug).toBeTruthy();

    // — UI: login and navigate to channels —
    await loginUI(page, ADMIN);
    await page.goto("/channels");
    await expect(
      page.locator('[data-testid="text-channels-title"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Channel should appear in the sidebar list
    const channelItem = page.locator(
      `[data-testid="channel-item-${channelId}"]`,
    );
    await expect(channelItem).toBeVisible({ timeout: 5_000 });

    // Click into the channel
    await channelItem.click();

    // Message input should be visible (we're auto-joined as creator)
    await expect(
      page.locator('[data-testid="input-channel-message"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Send a message
    await page.fill(
      '[data-testid="input-channel-message"]',
      "E2E smoke message",
    );
    await page.click('[data-testid="button-send-channel-message"]');

    // Verify message appears in the message list
    await expect(page.getByText("E2E smoke message")).toBeVisible({
      timeout: 5_000,
    });

    // — Cleanup: archive the channel via API —
    const archiveRes = await request.post(
      `/api/channels/${channelId}/archive`,
    );
    expect(archiveRes.ok()).toBeTruthy();
  });
});

test.describe("Channels — API list", () => {
  test("GET /api/channels returns 200", async ({ request }) => {
    await loginAPI(request, ADMIN);
    const res = await request.get("/api/channels");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

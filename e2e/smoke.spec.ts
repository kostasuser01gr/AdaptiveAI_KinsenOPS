import { test, expect } from "@playwright/test";
import { ADMIN, loginUI } from "./helpers";

/**
 * Core page-load smoke tests.
 * Verifies that admin can navigate to released surfaces and see key UI elements.
 */

test.describe("Page loads — admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, ADMIN);
  });

  test("fleet page loads with search and column settings", async ({ page }) => {
    await page.goto("/fleet");
    await expect(page.locator('[data-testid="text-page-title"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="input-search-vehicles"]'),
    ).toBeVisible();
    // Column visibility settings button is reachable
    await expect(
      page.locator('[data-testid="button-column-settings"]'),
    ).toBeVisible();
  });

  test("fleet column settings popover opens", async ({ page }) => {
    await page.goto("/fleet");
    await page.click('[data-testid="button-column-settings"]');
    // The popover should show "Visible Columns" label with checkboxes
    await expect(page.getByText("Visible Columns")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("channels page loads", async ({ page }) => {
    await page.goto("/channels");
    await expect(
      page.locator('[data-testid="text-channels-title"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("app builder page loads for admin", async ({ page }) => {
    await page.goto("/app-builder");
    await expect(page.locator("h1, h2, [data-testid]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

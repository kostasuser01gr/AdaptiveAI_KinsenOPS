import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  webServer: {
    command:
      'npx tsx server/index.ts',
    port: 5000,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://localhost:5432/adaptiveai_closure_test",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "closure-test-secret",
      NODE_ENV: process.env.NODE_ENV ?? "development",
      SEED_DATABASE: process.env.SEED_DATABASE ?? "true",
    },
  },
});

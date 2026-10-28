import { defineConfig, devices } from "@playwright/test";

const worker = process.env.E2E_WORKER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Local workerd is resource-constrained; keep the same assertions with less contention.
  workers: worker ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: worker ? "http://127.0.0.1:8787" : "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: worker
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        env: { SUPABASE_TEST_SERVICE_ROLE_KEY: "" },
        timeout: 60_000,
      },
});

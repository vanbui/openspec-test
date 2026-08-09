import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:3001",
    colorScheme: "light",
    locale: "en-AU",
    reducedMotion: "reduce",
    timezoneId: "Australia/Melbourne",
    trace: "on-first-retry",
  },
  webServer: {
    command: "yarn workspace @idambox/csrm dev",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

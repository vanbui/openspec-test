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
    timezoneId: "Australia/Melbourne",
    trace: "on-first-retry",
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  webServer: [
    {
      command: "node scripts/start-e2e-strapi.mjs",
      url: "http://127.0.0.1:1338/api/csrm-assessment-requests",
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command:
        "NODE_ENV=development CSRM_STRAPI_BASE_URL=http://127.0.0.1:1338/api IDAMBOX_CSRM_INTERNAL_TOKEN=idambox-csrm-e2e-internal-token-0123456789abcdef ./node_modules/.bin/next dev --webpack --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "NODE_ENV=production NEXT_DIST_DIR=.next-e2e-production CSRM_STRAPI_BASE_URL=http://127.0.0.1:1338/api IDAMBOX_CSRM_INTERNAL_TOKEN=idambox-csrm-e2e-internal-token-0123456789abcdef yarn build && NODE_ENV=production NEXT_DIST_DIR=.next-e2e-production CSRM_STRAPI_BASE_URL=http://127.0.0.1:1338/api IDAMBOX_CSRM_INTERNAL_TOKEN=idambox-csrm-e2e-internal-token-0123456789abcdef ./node_modules/.bin/next start --port 3002",
      url: "http://127.0.0.1:3002",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

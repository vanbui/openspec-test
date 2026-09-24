import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

/*
 * Stop any Strapi dev server before running this suite.
 *
 * The run gets its own ports, its own SQLite file, and its own Next build
 * directory, but `strapi develop` has no equivalent knob for its output: both
 * this run and a dev server compile into the single `apps/strapi/dist`. Running
 * them together makes one process clean that directory while the other writes
 * into it, which surfaces as `ENOTEMPTY` during "Cleaning dist dir" and leaves a
 * half-written build behind. The symptom afterwards is a mounted route
 * answering 405, which reads like an authorization or routing bug and is not
 * one; `rm -rf apps/strapi/dist` and a restart clears it.
 *
 * Browsers must also be present: `npx playwright install chromium` downloads
 * both the browser and the headless shell this config launches.
 *
 * A run also leaves `next-env.d.ts` and `tsconfig.json` pointing at the
 * throwaway Next build directory below, because Next rewrites both to match
 * whichever dist directory it last built into. Restore them after a run
 * (`git checkout -- apps/web/next-env.d.ts apps/web/tsconfig.json`) so the
 * change does not travel into a commit.
 */
const invocationId = randomUUID();
mkdirSync(join(tmpdir(), 'csrm-playwright-e2e'), { recursive: true });
const e2eRuntimeRoot = mkdtempSync(join(tmpdir(), 'csrm-playwright-e2e', `${invocationId}-`));
const e2eRuntimeAttestationPath = join(e2eRuntimeRoot, 'attestation.json');
const e2eRuntimeNonce = randomUUID();
writeFileSync(e2eRuntimeAttestationPath, JSON.stringify({ nonce: e2eRuntimeNonce, createdAt: new Date().toISOString() }), { mode: 0o600 });
process.once('exit', () => {
  rmSync(e2eRuntimeRoot, { recursive: true, force: true });
});
const isolatedDatabaseFilename = `.tmp/playwright-e2e-${invocationId}.db`;
const isolatedNextDistDir = `.tmp/playwright-next-${invocationId}`;
const developmentApiToken = 'csrm-playwright-development-only';
const pnpmCli = join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js');
const runPnpm = (args: string) => `"${process.execPath}" "${pnpmCli}" ${args}`;
const runSlot = process.pid % 10_000;
const derivedStrapiOrigin = `http://127.0.0.1:${20_000 + runSlot}`;
const derivedWebOrigin = `http://127.0.0.1:${40_000 + runSlot}`;
const strapiOrigin = process.env.CSRM_E2E_STRAPI_ORIGIN ?? derivedStrapiOrigin;
const webOrigin = process.env.CSRM_E2E_WEB_ORIGIN ?? derivedWebOrigin;
const strapiPort = Number(new URL(strapiOrigin).port);
const webPort = Number(new URL(webOrigin).port);
const strapiHealthUrl = `${strapiOrigin}/_health`;
const strapiApiBaseUrl = `${strapiOrigin}/api`;

process.env.CSRM_E2E_STRAPI_ORIGIN ??= strapiOrigin;
process.env.CSRM_E2E_WEB_ORIGIN ??= webOrigin;

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // The suite runs against `next dev` (production-build E2E is deferred to
  // Phase 8), where on-demand route compilation can stall an assertion well
  // past the 5s default while an unrelated route compiles.
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: runPnpm('develop'),
      cwd: '../strapi',
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: String(strapiPort),
        DATABASE_CLIENT: 'sqlite',
        DATABASE_FILENAME: isolatedDatabaseFilename,
        CSRM_ENVIRONMENT: 'development',
        CSRM_DEV_IDENTITY: 'true',
        CSRM_DEV_API_TOKEN: developmentApiToken,
        IDAMBOX_SEED_CORE: 'true',
        IDAMBOX_SEED_CSRM: 'true',
        CSRM_AI_PROVIDER: 'deterministic',
        csrmAppIsEnabled: 'true',
        STRAPI_ADMIN_AUTO_OPEN: 'false',
      },
      url: strapiHealthUrl,
      reuseExistingServer: false,
      timeout: 600_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: runPnpm(`exec next dev --hostname 127.0.0.1 --port ${webPort}`),
      env: {
        NODE_ENV: 'development',
        CSRM_ENVIRONMENT: 'development',
        CSRM_DEV_IDENTITY: 'true',
        CSRM_API_BASE_URL: strapiApiBaseUrl,
        CSRM_API_TOKEN: developmentApiToken,
        CSRM_NEXT_DIST_DIR: isolatedNextDistDir,
        CSRM_E2E_UI_STATE_HARNESS: '1',
        CSRM_E2E_RUNTIME_ROOT: e2eRuntimeRoot,
        CSRM_E2E_RUNTIME_ATTESTATION_PATH: e2eRuntimeAttestationPath,
        CSRM_E2E_RUNTIME_NONCE: e2eRuntimeNonce,
      },
      url: `${webOrigin}/sign-in`,
      reuseExistingServer: false,
      timeout: 600_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
});

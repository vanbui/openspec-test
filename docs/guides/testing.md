<!-- generated-by: gsd-doc-writer -->
# Testing

## Test framework and setup

The web uses Vitest 4.1.11 with jsdom and Testing Library, configured in `apps/csrm/vitest.config.ts`; `apps/csrm/src/test/setup.ts` supplies shared setup. Tests match src/**/*.test.{ts,tsx} and exclude E2E files.

The backend test script compiles application and test TypeScript, then runs Node's test runner serially with a 600000 ms per-test timeout. It first refuses maintenance switches through `apps/backend/scripts/refuse-maintenance-switches.mjs`.

Browser tests use Playwright 1.58.2. Install workspace dependencies first, then Chromium:

```bash
pnpm --filter @csrm/web exec playwright install chromium
```

CI uses the same install with --with-deps.

## Running tests

From the repository root:

```bash
pnpm test
pnpm --filter @csrm/web test
pnpm --filter @csrm/strapi test
pnpm --filter @csrm/web test:e2e
```

Root test uses Turbo dependencies; the package test command runs that package's script directly. Root E2E also depends on build and tests.

Target a web file or a browser spec:

```bash
pnpm --filter @csrm/web test src/features/requests/request-service.test.ts
pnpm --filter @csrm/web test:e2e e2e/requestor-request-workflow.spec.ts --project=desktop
```

For interactive Vitest watching, use `pnpm --filter @csrm/web exec vitest`; no separate watch script is declared.

## Browser harness isolation

`apps/csrm/playwright.config.ts` starts its own Strapi and a production-built Next server. It does not reuse running servers. Each run has an isolated SQLite database, attachment directory and Next build, plus port bands derived from the runner process.

The harness pins deterministic AI, disables Keycloak provisioning/verification, and uses a gated development identity with an attested production-build runtime. A developer's local OIDC settings do not change its identity mode.

Desktop runs at 1440×900. Mobile runs selected @journey tests at 375×812 with touch. One worker runs projects sequentially to avoid conflicting database mutations. Some one-shot fixtures are desktop-only and verify mobile layout within the same journey.

Successful runs clean up their own database, attachment store and builds. Failed/interrupted runs retain them for debugging. `CSRM_E2E_KEEP_ARTIFACTS=1` retains successful-run artifacts too.

## Writing new tests

- Web unit/component tests use *.test.ts or *.test.tsx alongside the module.
- Backend unit and mounted HTTP proofs live under `apps/backend/tests/`. Use `apps/backend/tests/helpers/strapi-http-harness.ts` and scoped runtime helpers instead of a developer's database.
- Browser journeys use *.spec.ts under `apps/csrm/e2e/`; reusable navigation, request and collaboration helpers live under `apps/csrm/e2e/helpers/`.
- Exercise denials, cross-record access, stale state and atomic failure as well as the successful workflow.
- Build fixtures that survive the suite's ordered runs; do not consume a shared one-shot record in both projects.

## Coverage requirements

No numeric coverage threshold is configured in the Vitest configuration. Material workflows must have automated evidence; a percentage is not a substitute for authorisation and transition proofs.

## CI integration

`.github/workflows/ci.yml` runs on pull requests and pushes to main. The web-quality job installs with the frozen pnpm lockfile, installs Chromium with system dependencies, runs the web api:check command, then `pnpm turbo run lint typecheck test build test:e2e`. The job timeout is 15 minutes.

This guide describes the configured harness. It does not claim that a fresh test run has been performed by generating documentation.

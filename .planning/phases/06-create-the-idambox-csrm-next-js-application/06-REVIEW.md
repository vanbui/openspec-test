---
phase: 06-create-the-idambox-csrm-next-js-application
reviewed: 2026-08-09T11:38:45Z
depth: deep
files_reviewed: 80
files_reviewed_list:
  - .gitignore
  - apps/csrm/.env.example
  - apps/csrm/AGENTS.md
  - apps/csrm/CLAUDE.md
  - apps/csrm/components.json
  - apps/csrm/e2e/shell.spec.ts
  - apps/csrm/eslint.config.mjs
  - apps/csrm/next-env.d.ts
  - apps/csrm/next.config.ts
  - apps/csrm/package.json
  - apps/csrm/playwright.config.ts
  - apps/csrm/postcss.config.mjs
  - apps/csrm/scripts/check-openapi-drift.mjs
  - apps/csrm/scripts/generate-openapi.mjs
  - apps/csrm/scripts/verify-runtime.mjs
  - apps/csrm/src/app/globals.css
  - apps/csrm/src/app/layout.tsx
  - apps/csrm/src/app/loading.tsx
  - apps/csrm/src/app/not-found.tsx
  - apps/csrm/src/app/page.tsx
  - apps/csrm/src/app/test-evidence/analyst-only/page.tsx
  - apps/csrm/src/app/test-evidence/states/page.tsx
  - apps/csrm/src/app/test-evidence/states/state-evidence-harness.tsx
  - apps/csrm/src/components/shell/account-menu.tsx
  - apps/csrm/src/components/shell/app-header.tsx
  - apps/csrm/src/components/shell/app-shell.tsx
  - apps/csrm/src/components/shell/breadcrumbs.tsx
  - apps/csrm/src/components/shell/development-identity-selector.production.tsx
  - apps/csrm/src/components/shell/development-identity-selector.tsx
  - apps/csrm/src/components/shell/mobile-navigation.tsx
  - apps/csrm/src/components/shell/navigation-group.tsx
  - apps/csrm/src/components/shell/page-header.tsx
  - apps/csrm/src/components/shell/route-announcer.tsx
  - apps/csrm/src/components/shell/shell.test.tsx
  - apps/csrm/src/components/shell/sidebar.tsx
  - apps/csrm/src/components/states/access-denied-state.tsx
  - apps/csrm/src/components/states/empty-state.tsx
  - apps/csrm/src/components/states/error-state.tsx
  - apps/csrm/src/components/states/loading-state.tsx
  - apps/csrm/src/components/states/optional-value.tsx
  - apps/csrm/src/components/states/state-boundary.tsx
  - apps/csrm/src/components/states/states.test.tsx
  - apps/csrm/src/components/states/unavailable-state.tsx
  - apps/csrm/src/components/ui/alert.tsx
  - apps/csrm/src/components/ui/avatar.tsx
  - apps/csrm/src/components/ui/breadcrumb.tsx
  - apps/csrm/src/components/ui/button.tsx
  - apps/csrm/src/components/ui/card.tsx
  - apps/csrm/src/components/ui/collapsible.tsx
  - apps/csrm/src/components/ui/dropdown-menu.tsx
  - apps/csrm/src/components/ui/separator.tsx
  - apps/csrm/src/components/ui/sheet.tsx
  - apps/csrm/src/components/ui/skeleton.tsx
  - apps/csrm/src/components/ui/tooltip.tsx
  - apps/csrm/src/config/capabilities.test.ts
  - apps/csrm/src/config/capabilities.ts
  - apps/csrm/src/config/env.ts
  - apps/csrm/src/config/routes.ts
  - apps/csrm/src/domain/identity.ts
  - apps/csrm/src/domain/route-access.test.ts
  - apps/csrm/src/domain/route-access.ts
  - apps/csrm/src/domain/service-result.ts
  - apps/csrm/src/lib/api/client.ts
  - apps/csrm/src/lib/api/csrm-service.test.ts
  - apps/csrm/src/lib/api/csrm-service.ts
  - apps/csrm/src/lib/api/generated/openapi.ts
  - apps/csrm/src/lib/fixtures/identities.ts
  - apps/csrm/src/lib/fixtures/resolve-identity.test.ts
  - apps/csrm/src/lib/fixtures/resolve-identity.ts
  - apps/csrm/src/lib/fixtures/select-development-identity.ts
  - apps/csrm/src/lib/utils.ts
  - apps/csrm/src/proxy.ts
  - apps/csrm/src/styles/tokens.test.ts
  - apps/csrm/src/test/fixtures.ts
  - apps/csrm/src/test/handlers.ts
  - apps/csrm/src/test/msw-server.ts
  - apps/csrm/src/test/setup.ts
  - apps/csrm/tsconfig.json
  - apps/csrm/vitest.config.ts
  - turbo.json
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-09T11:38:45Z
**Depth:** deep
**Files Reviewed:** 80
**Status:** issues_found

## Summary

The Phase 6 Next.js foundation, its API/capability boundaries, fixtures, shell, test suites, and production build path were reviewed against the Phase 6 plans and UI contract. The test suite and type-check pass, but the declared lint gate and capability verifier fail. More importantly, the claimed production fixture-exclusion boundary leaves the complete development identity registry—including Jane/Bob fixture data and elevated capabilities—in the shipped server bundle.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Production build retains the development fixture registry

**File:** `apps/csrm/src/app/layout.tsx:8-10`, `apps/csrm/src/components/shell/app-shell.tsx:12-20`, `apps/csrm/src/lib/fixtures/resolve-identity.ts:45-54`, `apps/csrm/e2e/shell.spec.ts:162-169`

**Issue:** The production-only replacement removes the selector client island, but the root layout still unconditionally imports and calls the fixture resolver, and `AppShell` still constructs Jane/Bob selector props. A fresh `NODE_ENV=production NEXT_DIST_DIR=.next-review yarn workspace @idambox/csrm build` contains `fixture:jane.doe@idambox.com`, `fixture:bob.doe@idambox.com`, and `Security Analyst — Bob` in `.next-review/server/chunks/162.js`. This violates the Phase 6 production-boundary requirement that production not import the fixture resolver and leaves privileged development fixtures in the deployable artifact. The Playwright test scans only browser-loaded static JavaScript, so it misses this server-bundle leakage.

**Fix:** Split the identity/shell integration at compile time so the production layout cannot import either `resolve-identity` or `identities` (for example, replace a dedicated fixture-provider module with a production null provider in both server and client compilation). Do not construct selector options outside the development-only module. Extend the production test to scan the complete build output—server and static chunks—for fixture labels, subjects, and fixture cookie names.

## Warnings

### WR-01: The required lint gate fails

**File:** `apps/csrm/src/proxy.ts:8`

**Issue:** `yarn workspace @idambox/csrm lint` exits 1 because `_request` is unused while the script sets `--max-warnings 0`. This makes the documented validation and CI-quality gate fail despite the project being presented as verified.

**Fix:** Remove the unused parameter (`export function proxy()`) or deliberately consume it, then keep the strict zero-warning lint policy.

### WR-02: The advertised capability verifier does not exist

**File:** `apps/csrm/package.json:17`

**Issue:** `verify:capabilities` invokes `scripts/verify-capabilities.mjs`, but that file is absent. `yarn workspace @idambox/csrm verify:capabilities` fails with `MODULE_NOT_FOUND`, so the promised command seam cannot validate the Function-ID/capability contract.

**Fix:** Add the intended verifier (including catalogue-to-registry parity checks) or remove the script until a working equivalent is provided. Add it to a package-level validation command so future deletions are detected.

### WR-03: Identity switching focuses the old page before navigation completes

**File:** `apps/csrm/src/components/shell/development-identity-selector.tsx:27-35`

**Issue:** After changing the fixture, the component requests `router.refresh()` and then `router.replace("/")`, but immediately queries and focuses the current document's `h1`. On any non-home route, focus lands on the outgoing heading and is lost when the replacement completes, rather than moving to the destination page title as required by the accessibility contract.

**Fix:** Carry a one-shot focus intent through the identity change and move focus from an effect that runs after the pathname/render changes, or make the destination page own focus restoration. Add a browser test that switches identity from a non-root route and asserts focus on the rendered home-page `h1`.

---

_Reviewed: 2026-08-09T11:38:45Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

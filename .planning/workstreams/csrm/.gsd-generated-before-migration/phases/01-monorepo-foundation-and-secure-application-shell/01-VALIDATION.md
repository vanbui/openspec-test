---
phase: 1
slug: monorepo-foundation-and-secure-application-shell
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-27
---

# Phase 1 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest + Testing Library/jsdom; Playwright + axe Playwright integration |
| **Config file** | `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/web/playwright.config.ts` — Wave 0 |
| **Quick run command** | `pnpm --filter @csrm/web test --run` |
| **Full suite command** | `pnpm turbo run lint typecheck test build test:e2e` |
| **Estimated runtime** | Under 5 minutes locally after dependencies are installed |

## Sampling Rate

- **After every task commit:** Run the relevant web test command plus `pnpm --filter @csrm/web typecheck` when the workspace exists.
- **After every plan wave:** Run `pnpm turbo run lint typecheck test build`.
- **Before `$gsd-verify-work`:** Run the full suite, including browser tests.
- **Max feedback latency:** 5 minutes.

## Requirement Verification Map

| Requirement | Threat Ref | Secure behavior | Test type | Automated command | File exists | Status |
|---|---|---|---|---|---|---|
| FOUND-01 | — | Root workspace has only the intended packages and one root lockfile; Turbo tasks address both apps. | integration/CI | `pnpm turbo run typecheck build` | ❌ Wave 0 | ⬜ pending |
| FOUND-02 | — | Shell exposes landmarks, token-driven styling, locked state copy, responsive navigation, and no horizontal page overflow. | component + E2E | `pnpm --filter @csrm/web test --run`; `pnpm --filter @csrm/web test:e2e` | ❌ Wave 0 | ⬜ pending |
| FOUND-03 | T-01-03 | OpenAPI output is deterministic and pages/components do not call raw production `fetch`. | static + build | `pnpm --filter @csrm/web api:check && pnpm --filter @csrm/web typecheck` | ❌ Wave 0 | ⬜ pending |
| FOUND-04 | T-01-01, T-01-02 | Development capability projection stays centralized; Strapi denies unauthorised and IDOR attempts independently of UI visibility. | unit + integration | `pnpm --filter @csrm/web test --run`; `pnpm --filter @csrm/strapi test` | ❌ Wave 0 | ⬜ pending |
| FOUND-05 | T-01-04 | State components, role selection, desktop/mobile shell, and accessibility smoke checks run in automated suites. | component + E2E | `pnpm --filter @csrm/web test:e2e` | ❌ Wave 0 | ⬜ pending |

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` and `apps/web/src/test/setup.ts` — jsdom and Testing Library matcher setup.
- [ ] `apps/web/src/lib/capabilities/capability-adapter.test.ts` — capability projection and no direct role-string use outside the development adapter.
- [ ] `apps/web/src/components/states/*.test.tsx` — exact loading, empty, error, and permission-denied state copy and accessible roles.
- [ ] `apps/web/e2e/app-shell.spec.ts` — 375, 390, 430, 768, 1024, and 1440px shell behaviour; keyboard menu handling and no horizontal overflow.
- [ ] `apps/web/e2e/accessibility.spec.ts` — axe smoke scan plus explicit manual WCAG checks.
- [ ] `apps/web/package.json` and root Turbo configuration — non-watch test/typecheck/build/e2e scripts.
- [ ] Strapi authorization integration-test harness/seed strategy before any claim of production FunctionAPI/record/IDOR verification.
- [ ] Human package-legitimacy checkpoint before installing any research-labelled `[ASSUMED]` package, because Node/npm and registry auditing are unavailable in this environment.

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Test instructions |
|---|---|---|---|
| New packages are legitimate, current, and compatible with the selected Node LTS | FOUND-01, FOUND-05 | Node/npm registry tooling is unavailable in the current environment. | Verify package publisher, current compatible versions, repository, and license before install; record approved versions in `package.json`/lockfile. |
| The initial BProton-led tokens reflect approved brand material | FOUND-02 | Formal brand assets are not yet in the repository. | Compare semantic token selections and replaceable wordmark with supplied/approved BProton material before release. |
| Strapi effective-grant and IDOR enforcement | FOUND-04 | The supplied OpenAPI contract lacks the effective-capabilities endpoint and live Keycloak configuration. | With two identities and live backend configuration, verify a restricted record returns denial regardless of the frontend role selector. |

## Validation Sign-Off

- [x] Every Phase 1 requirement has an automated or explicit manual verification path.
- [x] Wave 0 lists all missing test infrastructure.
- [x] Security-sensitive authorization checks are assigned to the Strapi boundary, not frontend UI checks.
- [x] No watch-mode command is used for verification.
- [x] Package legitimacy is a blocking human checkpoint before install.

**Approval:** ready for planning 2026-08-27

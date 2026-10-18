---
phase: 2
slug: requestor-risk-assessment-request-workflow
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner with mounted Strapi + Vitest/Testing Library + Playwright |
| **Config file** | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | Backend changes: `cd apps/strapi && npm test`; web changes: `cd apps/web && pnpm test -- <targeted files>` |
| **Full suite command** | `cd apps/strapi && npm test`; then `cd apps/web && pnpm typecheck && pnpm test && pnpm test:e2e` |
| **Estimated runtime** | ~120 seconds before Phase 2 E2E expansion |

---

## Sampling Rate

- **After every task commit:** Run the affected targeted Vitest files, or the full `apps/strapi` test suite for backend/catalogue changes.
- **After every plan wave:** Run `apps/strapi npm test`, then `apps/web pnpm typecheck` and `apps/web pnpm test`.
- **Before `$gsd-verify-work`:** Backend tests, web typecheck/unit tests, and Playwright E2E must all be green.
- **Max feedback latency:** 120 seconds for task-level checks; E2E is reserved for workflow/wave gates.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-04-00 | 02-04 | 1 | REQ-01–REQ-05 | T-02-SC | Active Node satisfies exact root engine before dependency installation | engine preflight | `node --version; node -e "/* exact >=24.19.0 <25 assertion from plan */"` | ✅ config | ⬜ pending |
| 02-W0-01A | 02-02 | 1 | REQ-01, REQ-02, REQ-03, REQ-04 | T-02-01, T-02-02 | Development identity and least-privilege permission bootstrap fail closed | targeted mounted HTTP RED | compile, then `node --test --test-name-pattern='PHASE2 RED development (identity bridge|permission seed)' .tmp/tests-dist/tests/authorization.integration.test.js`; require both exact sentinels | ❌ W0 | ⬜ pending |
| 02-W0-01B | 02-05 | 2 | REQ-01, REQ-02, REQ-03, REQ-04 | T-02-02, T-02-03, T-02-04 | Owner scope and server-owned workflow fields cannot be forged | targeted mounted HTTP RED | compile, then `node --test --test-name-pattern='PHASE2 RED request workflow guards' .tmp/tests-dist/tests/request-workflow.integration.test.js`; require exact sentinel | ❌ W0 | ⬜ pending |
| 02-W0-02A | 02-07 | 3 | REQ-01, REQ-02, REQ-05 | T-02-04 | Query state is bounded; detail/dashboard populate URLs and normalized hydrated relations are exact | unit + loopback transport | `cd apps/web && pnpm test -- src/features/requests/request-service.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-02B | 02-07 | 3 | REQ-01 | T-02-04 | Table URL state and five display states behave deliberately | component | `cd apps/web && pnpm test -- src/features/requests/request-table.test.tsx` | ❌ W0 | ⬜ pending |
| 02-W0-03A | 02-12 | 4 | REQ-02, REQ-03, REQ-04 | T-02-02, T-02-03, T-02-04 | Typed mutation/action contracts enforce authoritative persisted fields, submit intent, and sponsor omission | unit | `cd apps/web && pnpm test -- src/features/requests/request-service.test.ts src/features/requests/request-actions.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-03B | 02-08 | 5 | REQ-02, REQ-03, REQ-04 | T-02-02, T-02-03 | Form contracts consume the typed action boundary and preserve entered values/errors | component | `cd apps/web && pnpm test -- src/features/requests/request-form.test.tsx src/features/requests/request-workflow.test.tsx` | ❌ W0 | ⬜ pending |
| 02-W0-03C | 02-08 | 5 | REQ-02, REQ-03, REQ-04 | T-02-02, T-02-03 | New/detail/edit screens expose only permitted workflow actions | component | `cd apps/web && pnpm test -- src/features/requests/request-form.test.tsx src/features/requests/request-workflow.test.tsx` | ❌ W0 | ⬜ pending |
| 02-W0-04 | 02-09 | 6 | REQ-05 | T-02-02, T-02-04 | Dashboard widgets derive only from authorised typed service data | component | `cd apps/web && pnpm test -- src/features/dashboard/requestor-dashboard.test.tsx` | ❌ W0 | ⬜ pending |
| 02-W0-05 | 02-01 / 02-09 | 1 / 6 | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05 | T-02-01, T-02-02, T-02-03, T-02-04 | A Requestor completes create → save draft → edit → submit → status without crossing identity scope | E2E | `cd apps/web && pnpm test:e2e -- requestor-request-workflow.spec.ts` | ❌ W0 | ⬜ pending |

Threat references are defined in the Phase 2 PLAN.md `<threat_model>` blocks and must preserve these stable identifiers.

---

## Wave 0 Requirements

- [ ] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with submitted fixtures, persistence helpers, development-header configuration, and scoped pagination assertions.
- [ ] Add mounted backend cases for request-number ownership, transition guards, development middleware fail-closed behavior, least-privilege permission bootstrap, and catalogue parity.
- [ ] Add `apps/web/src/features/requests/request-service.test.ts`, `request-actions.test.ts`, `request-table.test.tsx`, `request-form.test.tsx`, and `request-workflow.test.tsx`.
- [ ] Add `apps/web/src/features/dashboard/requestor-dashboard.test.tsx`.
- [ ] Add `apps/web/e2e/requestor-request-workflow.spec.ts` and configure Playwright to start Strapi and Next with isolated development identity settings.
- [ ] Add generated-contract assertions for pagination metadata and server-owned create fields; keep `pnpm api:check` green.
- [ ] Add the exact Node `>=24.19.0 <25` blocking preflight before the TanStack dependency install.
- [ ] Add generated populate-array assertions plus exact repeated-key transport URLs and normalized relation payload cases for detail and dashboard projections.
- [ ] Add effective Jane/Bob Role → Function → FunctionAPI tests for the API-only Assessment Request Reference Data API Function, with IAM and unrelated CRUD denials.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive visual hierarchy from 375px to 1440px | REQ-01–REQ-05 | Automated viewport checks cannot fully judge truncation, density, or focus clarity | Inspect dashboard, list, form, detail, confirmation, and submitted state at 375px, 768px, and 1440px; verify no horizontal page overflow and keyboard focus remains visible. |
| Five-state presentation quality | REQ-01, REQ-05 | State reachability is automated; visual legibility still needs human review | Exercise populated, loading, empty, error, and permission-denied fixtures; confirm distinct copy, actions, and non-colour-only status cues. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing test references.
- [ ] No watch-mode flags.
- [ ] Feedback latency is below 120 seconds for task-level checks.
- [ ] `nyquist_compliant: true` is set in frontmatter after the planner assigns task IDs and commands.

**Approval:** pending

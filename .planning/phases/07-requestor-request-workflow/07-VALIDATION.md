---
phase: 7
slug: requestor-request-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, Testing Library, MSW 2.15.0, Playwright 1.62.1; backend targeted integration tests |
| **Config file** | `apps/csrm/vitest.config.ts`, `apps/csrm/playwright.config.ts` |
| **Quick run command** | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm test --run` |
| **Full suite command** | `yarn workspace @idambox/csrm verify && yarn workspace @idambox/csrm test:e2e && yarn workspace backend check-types` |
| **Estimated runtime** | ~180 seconds |

## Sampling Rate

- **After every task commit:** Run the quick command plus the task's targeted backend or CSRM tests.
- **After every plan wave:** Run the full suite.
- **Before `$gsd-verify-work`:** Run backend ownership/lifecycle tests, generated OpenAPI drift checks, full CSRM suite, and the production fixture-exclusion scan.
- **Max feedback latency:** 180 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | CSRM-05 | T-07-01 IDOR | Backend binds actor/requestor, filters before lookup, and returns metadata-safe denial for unknown or non-owned IDs. | backend integration | targeted backend request-workflow test | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | CSRM-05 | T-07-02 tampering | Backend strips system-owned fields and permits only actor/state-valid save, submit, and withdraw transitions. | backend unit/integration | targeted backend request-workflow test | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | CSRM-05 | T-07-03 transport | Typed service and MSW use the generated contract and map only safe failures. | HTTP integration | `yarn workspace @idambox/csrm test --run src/lib/api` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | CSRM-05 | T-07-04 unsafe input | Form validates draft versus submit fields, preserves input, maps safe errors, and retains ownership-safe UI states. | component | `yarn workspace @idambox/csrm test --run src/features/requests` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 4 | CSRM-05 | T-07-05 fixture leak | Browser flows prove desktop/mobile list behavior, transitions, no metadata disclosure, and production fixture exclusion. | E2E/production | `yarn workspace @idambox/csrm test:e2e` | ❌ W0 | ⬜ pending |

## Wave 0 Requirements

- [ ] Backend request-workflow fixtures: two Requestors and one Security Analyst, including unknown versus non-owned ID denial.
- [ ] Request domain validation and MSW payload factories for request and catalogue operations.
- [ ] Component fixtures for error, empty, loading, read-only, and dirty-form states.
- [ ] Playwright request workflow coverage and production emitted-asset/HTTP fixture-exclusion extension.
- [ ] No dependency or lockfile change without the Phase 6 provenance/compatibility checkpoint.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New direct Strapi credential configuration | CSRM-05 | Local environment secret must not be committed or printed. | Configure only through environment variables; inspect source and production artifacts to confirm it is absent. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

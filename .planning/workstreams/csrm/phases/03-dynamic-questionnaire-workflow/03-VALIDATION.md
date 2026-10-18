---
phase: 3
slug: dynamic-questionnaire-workflow
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner with mounted Strapi + Vitest/Testing Library + Playwright |
| **Config file** | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @csrm/strapi test` for backend; `pnpm --filter @csrm/web test -- src/features/questionnaires` for web |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm --filter @csrm/web api:check && pnpm --filter @csrm/web test:e2e -- questionnaire-workflow.spec.ts` |
| **Estimated runtime** | ~180 seconds after Phase 3 E2E expansion |

## Sampling Rate

- **After every task commit:** Run the affected targeted backend or questionnaire Vitest tests.
- **After every plan wave:** Run `pnpm test`, `pnpm typecheck`, and `pnpm --filter @csrm/web api:check` when the contract is touched.
- **Before `$gsd-verify-work`:** Full backend, web, contract, build, and questionnaire Playwright journey must be green.
- **Max feedback latency:** 120 seconds for task-level checks; mounted full/E2E checks run at wave boundaries.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-W0-01 | 03-04, 03-05 | 2–3 | QUES-01, QUES-03, QUES-04, QUES-05 | T-03-01–T-03-06 | Mounted routes enforce exact grants, ownership, state guards, and atomic submission | mounted HTTP | `pnpm --filter @csrm/strapi test` | ❌ W0 | ⬜ pending |
| 03-W0-02 | 03-02 | 1 | QUES-02–QUES-04 | T-03-03–T-03-07 | JSON conventions, conditional visibility, values, and completeness fail closed | unit | `pnpm --filter @csrm/web test -- src/features/questionnaires/questionnaire-schema.test.ts` | ❌ W0 | ⬜ pending |
| 03-W0-03 | 03-07 | 4 | QUES-01, QUES-03, QUES-04, QUES-05 | T-03-01–T-03-06 | Typed services/actions use generated routes and safe error mappings | unit/transport | `pnpm --filter @csrm/web test -- src/features/questionnaires/questionnaire-service.test.ts src/features/questionnaires/questionnaire-actions.test.ts` | ❌ W0 | ⬜ pending |
| 03-W0-04 | 03-09 | 5 | QUES-02–QUES-05 | T-03-03, T-03-04, T-03-07 | One renderer handles edit/read-only, conditions, progress, validation, save/submit, and unsupported uploads | component | `pnpm --filter @csrm/web test -- src/features/questionnaires/questionnaire-renderer.test.tsx` | ❌ W0 | ⬜ pending |
| 03-W0-05 | 03-08, 03-10 | 5–6 | QUES-01, QUES-05 | T-03-01, T-03-06 | Five route states reveal no unauthorized response content | component | `pnpm --filter @csrm/web test -- src/features/questionnaires/questionnaire-workflow.test.tsx` | ❌ W0 | ⬜ pending |
| 03-W0-06 | 03-01, 03-12 | 1, 8 | QUES-01–QUES-05 | T-03-01–T-03-07 | Jane saves/resumes/submits and Bob reviews the authoritative submitted response | E2E | `pnpm --filter @csrm/web test:e2e -- questionnaire-workflow.spec.ts` | ❌ W0 | ⬜ pending |

Threat identifiers are stable inputs from `03-RESEARCH.md` and must be copied into relevant PLAN.md `<threat_model>` blocks.

## Wave 0 Requirements

- [ ] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with owner/other/analyst questionnaire fixtures and persistence helpers.
- [ ] Add `apps/strapi/tests/questionnaire-workflow.integration.test.ts` for cross-owner 403, state guards, mass-assignment denial, and atomic submission.
- [ ] Add questionnaire schema/service/action/renderer/workflow test files under `apps/web/src/features/questionnaires/`.
- [ ] Add `apps/web/e2e/questionnaire-workflow.spec.ts` using the isolated dual-server database and stable seed.
- [ ] Extend catalogue/contract assertions for exact Phase 3 routes, effective Jane/Bob grants, copy parity, and generated OpenAPI types.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive grouped-form hierarchy from 375px to 1440px | QUES-01–QUES-05 | Automated overflow checks cannot fully judge dense question legibility and action placement | Inspect list, editable questionnaire, confirmation, submitted read-only, and analyst review at 375px, 768px, and 1440px with 200% zoom. |
| Keyboard/focus clarity across conditional changes | QUES-02, QUES-04 | Focus visibility and comprehension benefit from human review beyond DOM assertions | Complete the seeded conditional path by keyboard, hide a focused/dependent field, trigger invalid submit, and confirm focus/order/error summary remain understandable. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers every missing test reference.
- [ ] No watch-mode flags.
- [ ] Feedback latency stays below 120 seconds for task-level checks.
- [x] `nyquist_compliant: true` is set.

**Approval:** pending

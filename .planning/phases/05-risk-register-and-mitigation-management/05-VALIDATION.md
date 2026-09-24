---
phase: 05
slug: risk-register-and-mitigation-management
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-31
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node 24 test runner (Strapi), Vitest 4 + Testing Library (web), Playwright 1.58 (E2E) |
| **Config file** | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/strapi/tsconfig.test.json` |
| **Quick run command** | `pnpm --filter @csrm/strapi test` or the focused Vitest file named by the task |
| **Full suite command** | `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` |
| **Estimated runtime** | Quick checks under 120 seconds; full suite runtime measured during execution |

---

## Sampling Rate

- **After every task commit:** Run the narrow new backend or frontend test file plus TypeScript for the touched workspace.
- **After every plan wave:** Run `pnpm --filter @csrm/strapi test`, `pnpm --filter @csrm/web test`, and `pnpm --filter @csrm/web api:check` whenever contract files change.
- **Before `$gsd-verify-work`:** Run `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` with Playwright's isolated servers on ports 1338/3100.
- **Max feedback latency:** 120 seconds for task-level sampling; escalate slower suites to wave gates.

---

## Per-Task Verification Map

Final task IDs below are reconciled to the executable Phase 5 plans. A comma-separated Task ID cell means the validation responsibility deliberately spans the named RED/implementation or contract/consumer tasks.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-02-01, 05-02-02 | 05-02 | 2 | RISK-01 | T-05-01, T-05-02, T-05-03 | Closed parser rejects unknown, duplicate, malformed, or unbounded filter/sort/pagination input before count; authorization occurs before count. The historical date-key rejection was explicitly superseded by 05-10. | backend unit + mounted integration | `pnpm --filter @csrm/strapi test` | ✅ | ✅ GREEN (historical evidence; date assertion superseded) |
| 05-03-01, 05-05-01, 05-07-01 | 05-03, 05-05, 05-07 | 3–4 | RISK-01, RISK-02 | T-05-04, T-05-07 | Catalogue-backed authenticated reads return closed projections; Requestors receive safe denial and no existence/count clues | contract + mounted integration | `pnpm --filter @csrm/strapi test && pnpm --filter @csrm/web api:check` | ✅ | ✅ GREEN (94 tests + generated contract) |
| 05-02-01, 05-02-02 | 05-02 | 2 | RISK-01 | T-05-02, T-05-03 | Every approved filter and allowlisted sort is server-authoritative before pagination; targetDate asc/desc is globally correct with nulls last; totals remain exact without duplicate Risks | mounted integration | `pnpm --filter @csrm/strapi test` | ✅ | ✅ GREEN (94 Strapi tests) |
| 05-05-01, 05-05-02 | 05-05 | 3 | RISK-02 | T-05-04, T-05-05, T-05-07 | Detail includes every bounded ID/label relation; complete mutable/released parents expose the server-owned discriminant, while partial release facts return a safe complete-load error with no Risk projection | backend unit + mounted integration | `pnpm --filter @csrm/strapi test` | ✅ | ✅ GREEN (94 Strapi tests) |
| 05-06-01, 05-06-02 | 05-06 | 4 | RISK-01, RISK-02 | T-05-06 | Dev fixture gates remain off outside the triple-gated environment; repeated/repair runs are idempotent and do not alter the 2,646 reusable Controls | backend integration | `pnpm --filter @csrm/strapi test` | ✅ | ✅ GREEN (94 Strapi tests) |
| 05-03-02, 05-04-01, 05-04-02 | 05-03, 05-04 | 3–4 | RISK-01 | T-05-02, T-05-03 | URL state is canonical and typed; target dates render in UTC en-AU with exact icon-plus-text Overdue state; hostile/over-populated responses are rejected; mobile cards and all five register states are covered. The historical date-key stripping assertion was explicitly superseded by 05-11. | Vitest schema/service/component | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-schema.test.ts src/features/risks/risk-service.test.ts src/features/risks/risk-register.test.tsx` | ✅ | ✅ GREEN (historical evidence; date assertion superseded) |
| 05-07-02, 05-08-01, 05-08-02 | 05-07, 05-08 | 4–5 | RISK-02 | T-05-04, T-05-05, T-05-07 | Released details render no mutation affordance; mutable actions submit deltas and a 409 reloads authoritative read-only state | Vitest component/action | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-details.test.tsx src/features/risks/risk-actions.test.ts` | ✅ | ✅ GREEN (20 tests) |
| 05-01-01 | 05-01 | 1 | RISK-01, RISK-02 | T-05-01 through T-05-07 | The original attributable RED browser contract is retained as the final real-stack journey and now passes without its obsolete expected-failure wrapper | Playwright | `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts --reporter=line` | ✅ | ✅ GREEN (superseded RED wrapper removed) |
| 05-09-01 | 05-09 | 6 | RISK-01, RISK-02 | T-05-01 through T-05-07 | Bob can filter/open/edit via isolated servers, targetDate asc/desc is null-last, Overdue is explicit, and Jane is denied; released fixture is read-only; mutable fixture persists; both routes prove geometry, breakpoint, focus/dialog behavior, and no overflow at 375/390/430/768/1024/1440. The historical absent-date-control assertion was explicitly superseded by 05-12. | Playwright | `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts --reporter=line` | ✅ | ✅ GREEN (historical evidence; date assertion superseded) |
| 05-09-02 | 05-09 | 6 | RISK-01, RISK-02 | T-05-01 through T-05-07 | No schema/package/lockfile edit, test sentinel/focus/escape hatch, raw feature colour, raw page/component fetch, catalogue hash/byte drift, public-role exposure, generated drift, forbidden live port, wrong branch/Node, or AI attribution survives GREEN | deterministic integrity script + full gate | `node scripts/verify-phase-05-integrity.mjs && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` | ✅ | ✅ GREEN (integrity + root gate) |
| 05-10-01 | 05-10 | 7 | RISK-01 | T-05-10-01 through T-05-10-04 | Exact calendar-valid one-sided/equal/closed bounds are inclusive, invalid or inverted ranges fail closed, authorization precedes parsing, and count/page share one pre-pagination SQLite predicate | backend unit + mounted integration | `pnpm --filter @csrm/strapi test` | ✅ | ✅ GREEN (96 Strapi tests) |
| 05-10-02 | 05-10 | 7 | RISK-01 | T-05-10-SC | OpenAPI and generated query types expose both optional date-only parameters without catalogue, schema, package, or lock drift | contract + generated API | `pnpm --filter @csrm/strapi test && pnpm --filter @csrm/web api:check` | ✅ | ✅ GREEN (96 tests + generated contract) |
| 05-11-01 | 05-11 | 8 | RISK-01 | T-05-11-01, T-05-11-02 | Closed browser state preserves valid ranges, drops invalid/inverted pairs, and typed service transport sends only canonical bounds | Vitest schema/service + generated API | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-schema.test.ts src/features/risks/risk-service.test.ts && pnpm --filter @csrm/web api:check` | ✅ | ✅ GREEN (schema/service + generated contract) |
| 05-11-02 | 05-11 | 8 | RISK-01 | T-05-11-02, T-05-11-03 | Shared desktop/mobile controls have visible labels, loading persistence, chips/counts, page reset, and individual/paired/global clearing that retains sort/page size | TypeScript + Vitest component/schema/service + generated API | `pnpm --filter @csrm/web typecheck && pnpm --filter @csrm/web exec vitest run src/features/risks/risk-register.test.tsx src/features/risks/risk-schema.test.ts src/features/risks/risk-service.test.ts && pnpm --filter @csrm/web api:check` | ✅ | ✅ GREEN (43 focused tests + generated contract) |
| 05-12-01 | 05-12 | 9 | RISK-01 | T-05-12-01 through T-05-12-03 | Isolated real-browser journey proves equal-bound inclusivity, authoritative totals, composition, canonical persistence, zero results, clearing, responsive keyboard behavior, and unchanged non-enumerating Jane denial | Playwright | `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts --reporter=line` | ✅ | ✅ GREEN (1 full-stack journey) |
| 05-12-02 | 05-12 | 9 | RISK-01 | T-05-12-02, T-05-12-03, T-05-12-SC | Final integrity, production build, exact Strapi suite, and exact complete web gate prove no sentinel, focused test, escape, schema/package/lock/catalogue drift, live-port use, or RISK-02 regression | deterministic integrity + build + full product gate | `node scripts/verify-phase-05-integrity.mjs && pnpm --filter @csrm/web build && cd apps/strapi && npm test && cd ../.. && cd apps/web && pnpm typecheck && pnpm test && pnpm api:check && pnpm test:e2e` | ✅ | ✅ GREEN (integrity + build + 96 Strapi + 241 Vitest + 12 Playwright) |

### Threat References

- **T-05-01:** IDOR or privilege escalation through a Risk document ID.
- **T-05-02:** Filter/sort injection or unbounded query work.
- **T-05-03:** Pagination/count disclosure or duplicate-row dishonesty.
- **T-05-04:** Over-populated relation or partial-aggregate data leakage.
- **T-05-05:** Parent-release time-of-check/time-of-use mutation race.
- **T-05-06:** Development identity or fixture activation outside all three gates.
- **T-05-07:** Error-based record enumeration.

---

## Wave 0 Requirements

- [x] `apps/strapi/tests/risk-register.unit.test.ts` — closed query parser with exact calendar-valid `targetDateFrom`/`targetDateTo`, invalid/inverted rejection, projection, semantic ordering, and target-date null-last contract.
- [x] `apps/strapi/tests/risk-register.integration.test.ts` — mounted authorization-before-parsing, inclusive one-sided/equal/closed date predicates, composed filters, zero matches, exact totals, detail projection, and parent lock.
- [x] Extend `apps/strapi/tests/contract-catalogue.integration.test.ts` — both catalogue-backed reads, closed DTOs, and byte-identical catalogue copies.
- [x] `apps/strapi/tests/risk-register-seed.integration.test.ts` — triple gates, fresh/repeat/repair behavior, stable fixture keys, and unchanged Control inventory.
- [x] `apps/web/src/features/risks/risk-schema.test.ts` — closed URL and response schemas, including canonical valid date ranges and pair-level invalid/inverted discard.
- [x] `apps/web/src/features/risks/risk-service.test.ts` — exact openapi-fetch serialization of canonical date bounds and hostile response rejection.
- [x] `apps/web/src/features/risks/risk-register.test.tsx` — URL state, all filters including labelled responsive date controls, chips/counts/clearing, targetDate sorting/display/Overdue behavior, table/cards, honest paging, and five states.
- [x] `apps/web/src/features/risks/risk-details.test.tsx` — five sections/states and mutable/released affordances.
- [x] `apps/web/src/features/risks/risk-actions.test.ts` — delta submission, revalidation, and 409 authoritative reload.
- [x] `apps/web/e2e/risk-register-workflow.spec.ts` — Bob/Jane critical journey on ports 1338/3100.
- [x] The Wave 1 expected-failure wrapper was removed after its browser contract became GREEN.
- [x] `scripts/verify-phase-05-integrity.mjs` — deterministic final repository/environment/generated-contract/static integrity gate.

No new framework or dependency is required.

---

## Manual-Only Verifications

All functional, authorization, and responsive behaviors have automated verification. The execution handoff may retain screenshot review at 375px and 1440px as supplemental UI-contract evidence, but it must not replace Playwright geometry/focus/overflow assertions on both routes at 375, 390, 430, 768, 1024, and 1440px.

---

## Validation Sign-Off

- [x] All final tasks have `<automated>` verification or an explicit Wave 0 dependency.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 coverage is assigned to concrete RED/implementation tasks above.
- [x] No watch-mode flags.
- [x] Task-level commands are focused; suites expected beyond 120 seconds are wave/final gates.
- [x] Plan 05-09 blocks completion if any sentinel or escape hatch survives GREEN.
- [x] `nyquist_compliant: true` reflects the reconciled executable plan/test map and `wave_0_complete: true` records passing implementation evidence.

**Approval:** GREEN execution evidence recorded 2026-09-01; final integrity and root gates passed on Node 24.19.0

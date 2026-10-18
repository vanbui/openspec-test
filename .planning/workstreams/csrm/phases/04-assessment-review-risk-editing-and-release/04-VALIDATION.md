---
phase: 4
slug: assessment-review-risk-editing-and-release
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner with mounted Strapi; Vitest 4 + Testing Library; Playwright 1.58 |
| **Config file** | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | Full `npm test` in `apps/strapi` (the package script supplies explicit Node test operands), or `pnpm test -- <web test>` in `apps/web` |
| **Full suite command** | `npm test` in `apps/strapi`; `pnpm typecheck && pnpm test && pnpm api:check` in `apps/web`; focused Playwright release journey |
| **Estimated runtime** | ~90 seconds for backend + web unit/type/contract suites, excluding Playwright server startup |

---

## Sampling Rate

- **After every task commit:** Run the targeted test named by that task; run `pnpm api:check` whenever the OpenAPI contract or generated client changes.
- **After every plan wave:** Run `npm test` in `apps/strapi` and `pnpm typecheck && pnpm test && pnpm api:check` in `apps/web`.
- **Before `$gsd-verify-work`:** Run both full suites, the focused `assessment-release-workflow.spec.ts`, a byte comparison of both catalogue copies, and the test-integrity sentinel sweep.
- **Max feedback latency:** 120 seconds for task-level checks; full Playwright is reserved for the phase gate.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-W0-01 | 04-01 | 1 | ASSESS-01..05 | T-04-01 / T-04-02 | Fixtures expose owner, cross-owner, analyst, release triples, jobs, aggregates, and injected failures without bypasses | harness | `npm test` in `apps/strapi` | ✅ | ✅ passed |
| 04-W0-02 | 04-01 | 1 | ASSESS-01..05 | T-04-01 / T-04-04 | Browser skeleton proves the Bob-to-Jane journey through real dual servers | e2e | `pnpm test:e2e -- assessment-release-workflow.spec.ts` | ✅ | ✅ passed |
| 04-C01 | 04-02 | 1 | ASSESS-01..05 | T-04-01 / T-04-03 | Every served operation has an exact catalogue grant and bounded generated DTO | contract | Full `npm test` in `apps/strapi`, then fail-closed `api:generate` and `api:check` | ✅ | ✅ passed |
| 04-B01 | 04-04, 04-06 | 3-4 | ASSESS-02 | T-04-03 / T-04-05 | Identical normalized answers produce identical proposals; the provider cannot set release facts | unit + mounted | `npm test` in `apps/strapi` | ✅ | ✅ passed |
| 04-B02 | 04-02, 04-03, 04-07, 04-15, 04-08, 04-09, 04-13 | 1-10 | ASSESS-03 | T-04-02 / T-04-03 / T-04-04 | Closed DTOs, parsers, typed actions, editors, and mounted tests cover every frozen non-server-owned Risk field: `issueStatement`, `riskStatement`, `riskCategory`, `riskSubCategory`, `riskCause`, `potentialImpact`, `riskType`, `riskOwner`, `informationSystemImpacted`, `informationAssetImpacted`, `dataClassification`, `inherentLikelihood`, `highestInherentConsequence`, `inherentRating`, `inherentRatingRationale`, `residualLikelihood`, `highestResidualConsequence`, `residualRating`, `residualRatingRationale`, `controlEffectiveness`, `riskVelocity`, `identifiedDate`, `targetDate`, `closureDate`, `isExempted`, `exemptionReviewDate`, `escalationDetails`, `comments`, `riskCommunicationDate`, `treatmentAction`, `treatmentPlan`, `treatmentOwner`, `treatmentResolveDate`, `treatmentStatus`; and exactly ControlImplementation `control`, `controlOwner`, `controlStatus`, `effectivenessRating`, `evidence`, `implementationDueDate`, `implementedDate`, `reviewDate`. Every child mutation checks its parent assessment state and rejects server-owned fields | unit + mounted + Vitest | `npm test` in `apps/strapi`; `pnpm test -- src/features/assessments/assessment-service.test.ts src/features/assessments/assessment-actions.test.ts src/features/assessments/assessment-editor.test.tsx` in `apps/web` | ✅ | ✅ passed |
| 04-B03 | 04-03, 04-16 | 2, 8 | ASSESS-04 | T-04-04 / T-04-06 | Release atomically stamps the complete release fact and owning request; failed writes leave no partial release | mounted + concurrency | `npm test` in `apps/strapi` | ✅ | ✅ passed |
| 04-B04 | 04-16 | 8 | ASSESS-05 | T-04-01 / T-04-02 | Requestors can read only their own complete release fact and have no mutation capability | mounted IDOR | `npm test` in `apps/strapi` | ✅ | ✅ passed |
| 04-F01 | 04-10 | 10 | ASSESS-01..02 | T-04-01 / T-04-05 | Queue/detail and bounded polling surface authorized states with concrete Suspense skeletons and no infinite loading | Vitest + component | `pnpm test -- src/features/assessments/assessment-review-workflow.test.tsx` | ✅ | ✅ passed |
| 04-F02 | 04-13 | 10 | ASSESS-03..04 | T-04-03 / T-04-04 | Editor permits Risk add/edit and ControlImplementation add/edit/remove, preserves terminology, and release removes mutations | Vitest + component | `pnpm test -- src/features/assessments/assessment-editor.test.tsx` | ✅ | ✅ passed |
| 04-F03 | 04-11, 04-14 | 11 | ASSESS-05 | T-04-01 / T-04-02 | Dashboard and released detail render only owner-scoped released data with no form controls | Vitest + component | `pnpm test -- src/features/dashboard src/features/assessments` | ✅ | ✅ passed |
| 04-E01 | 04-12 | 12 | ASSESS-01..05 | T-04-01..06 | Bob drafts, edits and releases; Jane sees read-only output and mutation/IDOR attempts remain denied | Playwright + full gate | `pnpm test:e2e -- assessment-release-workflow.spec.ts` | ✅ | ✅ passed |

Threat references: T-04-01 prerelease/cross-owner IDOR; T-04-02 child-route aggregate bypass; T-04-03 forged server-owned/provider fields; T-04-04 post-release mutation; T-04-05 job enumeration/double generation; T-04-06 partial/concurrent release.

---

## Multi-Source Coverage Audit

| Source | ID | Feature / constraint | Plans | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Analyst review → observable draft → edit → explicit release → Requestor read-only outcome | 04-01, 04-05..14 | COVERED | Full Bob-to-Jane path closes in 04-12. |
| REQ | ASSESS-01 | Authorised analyst submitted-request review | 04-01, 04-05, 04-09, 04-10, 04-12 | COVERED | Queue/detail and denials included. |
| REQ | ASSESS-02 | queued/running/completed/failed/retry draft jobs | 04-01, 04-04, 04-06, 04-09, 04-10, 04-12 | COVERED | Deterministic provider cannot release. |
| REQ | ASSESS-03 | Assessment metadata, full frozen non-server-owned Risk edit surface, and exact ControlImplementation add/edit/remove surface | 04-02..04, 04-07, 04-15, 04-08, 04-09, 04-13, 04-12 | COVERED | Risk DTO/parser/service/action/editor/tests enumerate all frozen editable fields; ControlImplementation uses only `control`, `controlOwner`, `controlStatus`, `effectivenessRating`, `evidence`, `implementationDueDate`, `implementedDate`, `reviewDate`; Risk delete is not required. |
| REQ | ASSESS-04 | Explicit readiness-gated analyst-only atomic release | 04-02, 04-03, 04-16, 04-09, 04-13, 04-12 | COVERED | Resolved readiness checklist is shared by server and UI guidance. |
| REQ | ASSESS-05 | Owner-only released read-only view and dashboard | 04-02, 04-03, 04-16, 04-09, 04-11, 04-14, 04-12 | COVERED | Complete release triple plus owner scope; no Requestor mutation. |
| RESEARCH | — | Frozen schemas, closed DTOs, exact catalogue parity, ASM/RSK IDs, aggregate locks, deterministic bounded registry | 04-02..08, 04-15, 04-16, 04-09, 04-12 | COVERED | No dependency or schema change is planned. |
| RESEARCH | A2/A4/A7 | Resolved readiness, initiating-analyst generatedBy wording, Low/Moderate/High/Critical vocabulary | 04-02..04, 04-06, 04-07, 04-15, 04-08, 04-16, 04-09, 04-13 | COVERED | `04-RESEARCH.md` records each selected answer as RESOLVED. |
| CONTEXT | locked constraints in 04-RESEARCH | Deterministic advisory-only provider; explicit analyst release; concrete loading/error states; immutable owner view; real dashboard; dual-role E2E | 04-01..16 | COVERED | No standalone CONTEXT.md exists; the research `<user_constraints>` block is the locked source. |

Deferred production Keycloak/provider work, schema migrations, organisation Risk Register UX, and administration CRUD/import UX remain excluded by the locked Phase 4 scope and are not coverage gaps.

---

## Wave 0 Requirements

- [x] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with assessment aggregates, complete/partial release facts, a second Requestor, risk-type/control data, job state, concurrency, and injected provider/write failures.
- [x] Add backend workflow, contract, seed, determinism, authorization, immutability, and transaction tests before mounting the Phase 4 routes.
- [x] Add assessment service/action/domain/job/editor/released-view tests under `apps/web/src/features/assessments/`.
- [x] Add explicit Suspense fallback assertions for analyst request/assessment Server Component reads; test the complete frozen Risk field surface and the exact eight ControlImplementation fields separately from server-owned exclusions so the UI cannot drift beyond the served route inventory.
- [x] Replace the dashboard test's deliberate `contract-unavailable` seam with owner-scoped released projections.
- [x] Add `apps/web/e2e/assessment-release-workflow.spec.ts` and remove the Phase 3-specific database filename assumption without adding any test escape hatch.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive visual quality at 375px and 1440px | ASSESS-01..05 | Layout and information hierarchy benefit from human visual inspection in addition to automated assertions | Exercise queue, detail, editor, release dialog, dashboard, and released detail at both widths; confirm no page overflow, clipped actions, colour-only state, or hidden focus indicator. |

All authorization, state transition, determinism, immutability, and end-to-end workflow outcomes require automated coverage.

---

## Validation Sign-Off

- [x] Every generated plan task has a targeted automated verification or an explicit Wave 0 dependency.
- [x] Sampling continuity has no three consecutive tasks without an automated check.
- [x] Wave 0 creates every missing harness/test reference before the corresponding implementation task.
- [x] No watch-mode flags are used.
- [x] Task-level feedback latency remains below 120 seconds.
- [x] The final test-integrity sweep finds no sentinel, skip, bypass, or escape-hatch added for Phase 4.
- [x] `nyquist_compliant: true` remains set in frontmatter.

## Final Gate Evidence

- `node --version`: `v24.19.0`.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-phase-04-integrity.ps1`: passed from base `ccfe77e6650e95b539645700f190aaab2c924bfe`, with 99 implementation-and-validation files at the gate and nine Phase 4 test files swept.
- `npm test` in `apps/strapi`: 65 passed, 0 failed, 0 skipped.
- `pnpm test`: 157 web tests and 65 Strapi tests passed; generated API check passed.
- `pnpm typecheck`: all packages passed.
- `pnpm build`: Next.js and Strapi production builds passed.
- `pnpm --filter @csrm/web test:e2e -- assessment-release-workflow.spec.ts`: one real dual-server Bob-to-Jane journey passed.
- Catalogue SHA-256 parity: `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89` for both copies.
- `git diff --check`: passed.

**Approval:** Phase 4 automated validation complete on 2026-08-30.

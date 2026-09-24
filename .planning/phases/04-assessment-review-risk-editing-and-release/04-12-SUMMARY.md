---
phase: 04-assessment-review-risk-editing-and-release
plan: "12"
subsystem: testing
tags: [playwright, strapi, nextjs, authorization, release, integrity]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: analyst review, deterministic drafting, aggregate editing, atomic release, and owner-only read slices
provides:
  - real persisted Bob-to-Jane assessment release journey
  - fail-closed Phase 4 diff and test-integrity gate
  - complete Nyquist validation evidence for ASSESS-01 through ASSESS-05
affects: [phase-05, phase-08, verification, security-review]

tech-stack:
  added: []
  patterns: [process-unique Playwright database, dual-browser authorization proof, diff-aware integrity gate]

key-files:
  created:
    - scripts/verify-phase-04-integrity.ps1
  modified:
    - apps/web/e2e/assessment-release-workflow.spec.ts
    - apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/web/src/features/assessments/assessment-draft-job.tsx
    - .planning/phases/04-assessment-review-risk-editing-and-release/04-VALIDATION.md

key-decisions:
  - "Prerelease Requestor checks use a separate browser context so the frozen RiskSummary response remains unchanged while Strapi independently validates persisted release readiness."
  - "The integrity gate derives its range from the oldest executor-scoped Phase 4 commit and scans added production/test lines plus the complete Phase 4 test set."

patterns-established:
  - "End-to-end release proof awaits every Next Server Action response and then verifies the server-owned readiness transition."
  - "Phase closure rejects frozen schema, package manifest, lockfile, catalogue, generated-client, and conditional-test drift."

requirements-completed: [ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05]

duration: 1h 25m
completed: 2026-08-30
---

# Phase 4 Plan 12: Final Assessment Release Gate Summary

**Real Strapi-backed analyst drafting, full-field review, explicit atomic release, and owner-only Requestor read proof with a fail-closed 99-file integrity gate**

## Performance

- **Duration:** 1h 25m
- **Started:** 2026-08-30T02:02:12Z
- **Completed:** 2026-08-30T03:27:25Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Executed the real dual-server journey from Bob's submitted-request queue through deterministic drafting, all release-required Risk edits, an exact eight-field ControlImplementation, explicit release, and Jane's authoritative dashboard/detail.
- Proved prerelease and cross-owner disclosure denial while retaining Strapi as the authorization and release-readiness authority.
- Swept nine Phase 4 test files for focused, skipped, sentinel, missing-file, argument-controlled, and early-return success mechanisms; none remain.
- Added a fail-closed integrity script that verifies the `dylan-test` branch, Node 24.19.0, a non-empty derived Phase 4 range, frozen paths, catalogue bytes, generated API parity, and added-line safety rules.
- Closed validation with 65 Strapi tests, 157 web tests, strict typecheck, both production builds, and the focused Playwright journey green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete the real Bob-to-Jane journey and mounted adversarial matrix** - `fecb2ff` (fix)
2. **Task 1 correctness follow-up: Narrow discriminated lifecycle timestamps** - `8c368e4` (fix)
3. **Task 2: Run the final integrity, contract, and Nyquist gate** - `9180392` (test)

## Files Created/Modified

- `scripts/verify-phase-04-integrity.ps1` - Derives and checks the complete Phase 4 diff, test integrity, protected paths, catalogues, Node version, and generated API.
- `.planning/phases/04-assessment-review-risk-editing-and-release/04-VALIDATION.md` - Records every validation row and final observed gate result.
- `apps/web/e2e/assessment-release-workflow.spec.ts` - Runs the persisted analyst-to-Requestor journey at mobile and desktop widths with keyboard, axe, overflow, authorization, readiness, and immutability assertions.
- `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts` - Reconciles submitted target answers and a second owner fixture needed for real authorization testing.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Aligns mounted queue responses and bodyless generation behavior with the frozen contract and real Strapi parser.
- `apps/web/src/features/assessments/assessment-draft-job.tsx` - Exposes persisted queued/running/completed lifecycle evidence with strict discriminated-union narrowing.
- `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` - Bounds catalogue control descriptions to the strict external DTO limit.
- `apps/web/src/config/navigation/navigation.ts` - Exposes the implemented analyst Assessment Requests route and terminology.

## Decisions Made

- Kept the frozen `RiskSummary` response unchanged. Bob's live editor state drives client guidance, a separate Requestor browser context proves prerelease denial, and Strapi revalidates persisted fields during release.
- Selected a real reusable Control from the seeded catalogue instead of relying on a label not present in the authoritative projection; the persisted document reference and all contextual fields are verified after release.
- Treated transient draft execution as persisted lifecycle evidence: a fast deterministic job may finish between polls, but its queued, started, and completed timestamps truthfully render all reached states.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aligned analyst queue output with its closed response schema**
- **Found during:** Task 1
- **Issue:** The queue returned undeclared pagination metadata, so strict web parsing rejected an otherwise authorized result.
- **Fix:** Returned the contract's data-only analyst queue envelope and updated mounted assertions.
- **Files modified:** `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`, `apps/strapi/tests/assessment-workflow.integration.test.ts`
- **Verification:** Full Strapi suite and Playwright queue traversal passed.
- **Committed in:** `fecb2ff`

**2. [Rule 2 - Missing Critical] Added complete persisted dual-owner workflow fixtures**
- **Found during:** Task 1
- **Issue:** The development seed lacked submitted answers, a generation-valid target state, and a second owner record, so the real journey could not prove drafting or cross-owner denial.
- **Fix:** Reconciled eight submitted answer envelopes, the valid request state, and a Bob-owned cross-owner request under the existing development gates.
- **Files modified:** `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts`, `apps/strapi/tests/questionnaire-seed.integration.test.ts`
- **Verification:** Seed idempotency tests, 65-test Strapi suite, and Playwright journey passed.
- **Committed in:** `fecb2ff`

**3. [Rule 1 - Bug] Accepted Strapi's empty-object body parser artifact**
- **Found during:** Task 1
- **Issue:** A bodyless generation POST arrived as `{}` and was rejected despite matching the closed no-input operation.
- **Fix:** Accepted only `undefined` or an empty object while retaining rejection for every supplied field.
- **Files modified:** `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`, `apps/strapi/tests/assessment-workflow.integration.test.ts`
- **Verification:** Mounted generation tests and real E2E generation passed.
- **Committed in:** `fecb2ff`

**4. [Rule 1 - Bug] Repaired strict editor reference and control parsing blockers**
- **Found during:** Task 1
- **Issue:** The active-user picker issued an invalid empty search, and one seeded control description exceeded the strict external string bound, collapsing the assessment editor read.
- **Fix:** Used a valid bounded active-user search and truncated external control descriptions to the frozen DTO maximum.
- **Files modified:** `apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx`, `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts`
- **Verification:** Editor loaded with real references; web typecheck, build, and E2E passed.
- **Committed in:** `fecb2ff`

**5. [Rule 1 - Bug] Narrowed lifecycle timestamps for strict TypeScript**
- **Found during:** Task 2 root gate
- **Issue:** Queued job variants do not contain `startedAt` or `completedAt`, and the initial lifecycle display accessed them without discriminant narrowing.
- **Fix:** Guarded each timestamp with an `in` check while preserving truthful lifecycle output.
- **Files modified:** `apps/web/src/features/assessments/assessment-draft-job.tsx`
- **Verification:** Focused 12-test workflow suite, root typecheck, 157-test web suite, build, and Playwright passed.
- **Committed in:** `8c368e4`

---

**Total deviations:** 5 auto-fixed (3 bugs, 1 missing critical fixture, 1 blocking contract alignment)
**Impact on plan:** Every deviation was required for the specified persisted journey or strict verification gate; frozen schemas, catalogues, packages, and production boundaries remained unchanged.

## Issues Encountered

- Fast deterministic execution can move from queued to completed before a poll observes running; persisted job timestamps now provide truthful lifecycle evidence without delaying production behavior.
- The package-manager shim reports its own Node 22 runtime warning, while `node --version`, every spawned test/build process, and the integrity gate resolve Node v24.19.0 as required.

## Known Stubs

None. Empty identifiers found by the scan are test setup variables populated by mounted workflow setup, and null/empty collection checks are fail-closed production guards.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 requirements ASSESS-01 through ASSESS-05 have complete automated evidence and final validation sign-off.
- The frozen schema and exact catalogue remain unchanged and byte-identical; Phase 5 can consume the released assessment boundary.
- Durable external provider infrastructure and provenance remain correctly deferred to Phase 8.

## Self-Check: PASSED

- Found the integrity script, Phase 4 validation record, and this summary on disk.
- Verified task commits `fecb2ff`, `8c368e4`, and `9180392` exist in Git history.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

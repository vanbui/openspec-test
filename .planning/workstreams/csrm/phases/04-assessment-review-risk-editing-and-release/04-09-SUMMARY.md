---
phase: 04-assessment-review-risk-editing-and-release
plan: "09"
subsystem: web-api
tags: [nextjs, zod, openapi-fetch, server-actions, strict-typescript]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: exact analyst assessment, Risk, ControlImplementation, release, and owner-only Requestor operations
provides:
  - Strict closed Phase 4 web schemas and pure release-readiness guidance
  - Generated-client-only server services for every served assessment workflow operation
  - Validated success-only-revalidating Server Actions for assessment mutations and draft jobs
affects: [04-10, 04-11, 04-12, 04-13, 04-14]

tech-stack:
  added: []
  patterns: [closed external DTO parsing, explicit generated request projection, success-only cache invalidation]

key-files:
  created:
    - apps/web/src/features/assessments/assessment-schema.ts
    - apps/web/src/features/assessments/assessment-domain.ts
    - apps/web/src/features/assessments/assessment-service.ts
    - apps/web/src/features/assessments/assessment-actions.ts
    - apps/web/src/features/assessments/assessment-service.test.ts
    - apps/web/src/features/assessments/assessment-actions.test.ts
  modified: []

key-decisions:
  - "Keep analyst and Requestor assessment functions and schemas distinct even where the generated API shares a GET path."
  - "Project every mutation body field explicitly into the named generated OpenAPI DTO and let openapi-fetch serialize validated opaque path parameters."
  - "Expose no Risk delete service, action, input, or result because the served generated inventory has no Risk DELETE operation."

patterns-established:
  - "Transport boundary: generated client method -> strict response envelope -> closed domain DTO -> redacted TransportResult."
  - "Mutation boundary: strict outer action schema -> complete allowlisted input -> one typed service -> success-only revalidation."

requirements-completed: [ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05]

duration: 13min
completed: 2026-08-30
---

# Phase 4 Plan 09: Strict Typed Assessment Web Boundary Summary

**Closed Zod contracts, generated openapi-fetch services, and validated Server Actions now cover every served Phase 4 analyst and Requestor assessment workflow without raw network calls or client-owned release decisions.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-30T00:53:00Z
- **Completed:** 2026-08-30T01:06:07Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Defined exhaustive assessment ratings and statuses, four-state draft jobs, separate analyst/released DTOs, exact Risk and ControlImplementation mutation surfaces, minimal reference pickers, and pure release-readiness guidance.
- Bound all 22 service call sites to generated `GET`, `POST`, `PATCH`, or `DELETE` methods, with explicit named request projections, strict success parsing, bounded search, and redacted failures.
- Added typed Server Actions that reject unknown and server-owned fields before transport, preserve submitted values and field errors, and revalidate analyst plus Requestor routes only after authoritative success.
- Kept Risk Types separate from contextual Risks, reusable Controls separate from ControlImplementations, and omitted every Risk delete contract.

## Task Commits

Each TDD task was committed through its required gates:

1. **Task 1 RED: Specify strict assessment contracts** - `6251f79` (test)
2. **Task 1 GREEN: Define strict assessment contracts** - `d0cadcc` (feat)
3. **Task 2 RED: Specify generated assessment transport** - `07f20f9` (test)
4. **Task 2 GREEN: Add generated assessment services** - `9c0a207` (feat)
5. **Task 3 RED: Specify assessment Server Actions** - `ba285b3` (test)
6. **Task 3 GREEN: Add validated assessment actions** - `6b2ddf3` (feat)

## Files Created/Modified

- `apps/web/src/features/assessments/assessment-schema.ts` - Closed analyst, released, job, mutation, reference, and result schemas.
- `apps/web/src/features/assessments/assessment-domain.ts` - Exhaustive rating presentation, complete-release predicate, and server-parity readiness guidance.
- `apps/web/src/features/assessments/assessment-service.ts` - Server-only generated-client transport for the complete served Phase 4 inventory.
- `apps/web/src/features/assessments/assessment-actions.ts` - Strict mutation and job Server Actions with safe failures and success-only revalidation.
- `apps/web/src/features/assessments/assessment-service.test.ts` - Contract, terminology, readiness, generated-path, body-projection, and transport-failure coverage.
- `apps/web/src/features/assessments/assessment-actions.test.ts` - Hostile-input, retained-values, safe-status, retryable-release, and cache-invalidation coverage.

## Decisions Made

- The generated client receives validated opaque path values and owns URL serialization; actions encode those same values when constructing cache paths.
- Released detail parsing requires the complete approved/approver/approval-date fact plus the release assessment date written by the authoritative transaction; status alone never produces a released DTO.
- Shared wire paths have separate analyst and Requestor service exports so downstream pages cannot accidentally consume the wrong trust-boundary projection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused service and action tests: PASS, 28/28 tests.
- Full web Vitest suite: PASS, 126/126 tests across 22 files.
- Strict TypeScript: PASS with `pnpm typecheck`.
- Generated API drift: PASS with `pnpm api:check`; `schema.d.ts` remains generated from the frozen specification.
- Generated-client key link: PASS, 22 explicit `client.GET`, `client.POST`, `client.PATCH`, or `client.DELETE` call sites and no raw `fetch` in the assessment feature.
- Frozen contract/model guard: PASS, no plan commit changed `specification.json` or any Strapi content-type `schema.json`.
- Catalogue integrity: PASS, authoritative and bootstrap catalogues remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Test integrity: PASS, no skip/todo, RED sentinel, runner-argument mutation, file guard, conditional assertion bypass, or test early return remains.

## Known Stubs

None.

## Self-Check: PASSED

- All six plan-owned implementation and test files exist.
- All six RED/GREEN task commits exist in repository history in the required order.
- All task acceptance criteria and plan-level verification pass with frozen schemas, byte-identical catalogues, no Risk delete surface, and no raw API call.

## Next Phase Readiness

- Plans 04-10 through 04-14 can consume the strict analyst editor/job boundary and separate owner-only released projections.
- No blocker or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

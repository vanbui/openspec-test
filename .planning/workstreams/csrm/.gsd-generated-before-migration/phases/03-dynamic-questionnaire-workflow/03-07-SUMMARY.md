---
phase: 03-dynamic-questionnaire-workflow
plan: 07
subsystem: questionnaire-web-transport
tags: [nextjs, server-actions, openapi-fetch, zod, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: eight generated questionnaire workflow operations and secure Strapi read/mutation behavior from Plans 03-03 through 03-05
provides:
  - Server-only typed services for every Phase 3 Requestor and analyst questionnaire operation
  - Closed runtime parsing for questionnaire summaries, definitions, answers, and mutation results
  - Server-revalidated draft and submit actions with safe errors and success-only cache invalidation
affects: [03-08, 03-09, 03-10, questionnaire-pages, questionnaire-renderer]

tech-stack:
  added: []
  patterns: [generated-path server transport, bounded Zod projection, value-preserving Server Action failure]

key-files:
  created:
    - apps/web/src/features/questionnaires/questionnaire-service.ts
    - apps/web/src/features/questionnaires/questionnaire-actions.ts
    - apps/web/src/features/questionnaires/questionnaire-service.test.ts
    - apps/web/src/features/questionnaires/questionnaire-actions.test.ts
  modified:
    - apps/web/src/features/questionnaires/questionnaire-schema.ts

key-decisions:
  - "Keep Requestor and analyst questionnaire inventories as distinct service functions even though they share a bounded summary projection."
  - "Parse over-populated question records into an explicit allowlist before applying the strict definition graph parser."
  - "Return validated answer values with safe mutation failures and invalidate Requestor plus analyst routes only after authoritative success."

requirements-completed: [QUES-01, QUES-03, QUES-04, QUES-05]

duration: 6min
completed: 2026-08-30
---

# Phase 3 Plan 7: Typed Questionnaire Transport and Actions Summary

**All eight questionnaire workflow operations now use generated server-only paths with bounded runtime projections, allowlisted mutations, and safe value-preserving Server Actions.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T17:54:40Z
- **Completed:** 2026-08-29T18:00:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added separate Requestor and Security Analyst list/summary services plus shared authorised detail and question reads.
- Added draft PATCH and submit POST services using the exact generated `/v1` path keys and no caller-controlled identity or workflow facts.
- Parsed every Strapi response into closed questionnaire summaries, definition graphs, answer envelopes, and authoritative mutation results.
- Added Server Actions that revalidate unknown input, preserve validated values on failure, expose stable 400/403/404/409 messages, and invalidate caches only on success.
- Removed the RED sentinel and file-existence loading gate once the full six-test contract passed unconditionally.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-03: Specify generated services and safe actions** - `509a07e` (test)
2. **Task 2: Implement typed questionnaire services and actions** - `a875f5d` (feat)

## Files Created/Modified

- `apps/web/src/features/questionnaires/questionnaire-service.ts` - Generated-path reads and mutations with runtime parsing and normalized failures.
- `apps/web/src/features/questionnaires/questionnaire-actions.ts` - Server-revalidated save/submit actions and success-only route invalidation.
- `apps/web/src/features/questionnaires/questionnaire-service.test.ts` - Exact path, projection, malformed response, identity exclusion, and body allowlist coverage.
- `apps/web/src/features/questionnaires/questionnaire-actions.test.ts` - Input revalidation, retained values, safe error, and cache invalidation coverage.
- `apps/web/src/features/questionnaires/questionnaire-schema.ts` - Shared closed answer-input schema used by service and action boundaries.

## Decisions Made

- Actor-specific list functions make the intended Requestor or analyst slice explicit without accepting actor or identity input.
- Question records are reduced to the five contract fields before the strict existing definition parser runs, so unrelated Strapi relations cannot cross the service boundary.
- Submit actions validate the current answer array for a stable form contract but send no client-owned completeness or lifecycle data; Strapi remains authoritative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added the action answer schema to the shared questionnaire schema module**
- **Found during:** Task 2
- **Issue:** Keeping a second answer-input contract inside the action or service would violate the shared-schema validation boundary and risk drift.
- **Fix:** Added one closed `questionnaireAnswerInputSchema` to the existing Phase 3 schema module and reused it from both service and Server Actions.
- **Files modified:** `apps/web/src/features/questionnaires/questionnaire-schema.ts`, `apps/web/src/features/questionnaires/questionnaire-service.ts`, `apps/web/src/features/questionnaires/questionnaire-actions.ts`
- **Verification:** Focused tests, strict typecheck, and `api:check` pass.
- **Commit:** `a875f5d`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical validation boundary).
**Impact on plan:** One existing shared schema file was extended; no new dependency, API facade, identity input, or backend contract was introduced.

## Issues Encountered

- pnpm reported Node v22.19.0 although the workspace requests Node 24.19.x. All required focused tests, strict typechecking, and generated-contract checks passed; global tooling was not changed.

## Verification Results

- `pnpm --filter @csrm/web test -- src/features/questionnaires/questionnaire-service.test.ts src/features/questionnaires/questionnaire-actions.test.ts` - PASS (6/6 tests)
- `pnpm --filter @csrm/web typecheck` - PASS
- `pnpm --filter @csrm/web api:check` - PASS
- Exact generated paths and identity exclusion - PASS (all eight operations)
- Raw questionnaire fetch and frontend API facade scan - PASS
- GREEN test-integrity scan - PASS (no RED sentinel, file-existence gate, or escape hatch)
- Frozen questionnaire/question schemas - PASS (unchanged)
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)

## Known Stubs

None.

## Next Phase Readiness

- Plans 03-08 through 03-10 can consume a single typed boundary for Requestor discovery/editing and analyst review.
- The shared renderer can receive normalized definitions without parsing Strapi response envelopes or deriving identity in JSX.
- No blocker remains for Plan 03-08.

## Self-Check: PASSED

- All five created or modified implementation/test files and this summary exist.
- Task commits `509a07e` and `a875f5d` are present in repository history.
- All plan acceptance and verification commands pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*

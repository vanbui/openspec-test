---
phase: 03-dynamic-questionnaire-workflow
plan: 04
subsystem: questionnaire-authorization
tags: [strapi, authorization, idor, questionnaire, mounted-tests]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: eight exact questionnaire workflow operations and catalogue grants from Plan 03-03
provides:
  - Mounted Requestor questionnaire inventory, summary, detail, and question reads scoped through assessmentRequest.requestor
  - Explicit-grant Security Analyst inventory, review summary, detail, and submitted-answer reads
  - Fail-closed questionnaire actor and collection-scope authorization state
  - Disabled generic questionnaire and question CRUD bypass routes
affects: [03-05, 03-06, 03-07, questionnaire-backend, questionnaire-web]

tech-stack:
  added: []
  patterns: [policy-derived questionnaire actor and scope, bounded workflow projections, submitted-batch answer masking]

key-files:
  created:
    - apps/strapi/src/api/csrm-questionnaire/operations.ts
    - apps/strapi/src/api/csrm-question/operations.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/strapi/tests/questionnaire-workflow.integration.test.ts
  modified:
    - apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/strapi/src/api/csrm-question/routes/csrm-question.ts
    - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts

key-decisions:
  - "Serve questionnaire reads only through exact catalogue-backed /api/v1 workflow routes; generic questionnaire and question CRUD routes remain unmounted."
  - "Resolve explicit analyst grants before the implicit Requestor birthright, yielding analyst read-all or Requestor owner-only scope server-side."
  - "Mask every draft answer from analyst question projections until the questionnaire has one complete submitted answer batch."

requirements-completed: [QUES-01, QUES-05]

duration: 10min
completed: 2026-08-30
---

# Phase 3 Plan 4: Secure Questionnaire Read Slice Summary

**Catalogue-authorised Strapi routes now provide owner-scoped Requestor questionnaire reads and explicit-grant analyst review reads with direct IDOR denial and draft-answer masking.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T17:11:09Z
- **Completed:** 2026-08-29T17:21:08Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Mounted six Phase 3 read operations with `csrm-app-enabled` followed by exact FunctionAPI authorization.
- Derived Requestor ownership through `questionnaire.assessmentRequest.requestor` and gave only explicitly granted analysts read-all scope.
- Returned bounded questionnaire, progress, request, pagination, status-summary, review-summary, and question projections.
- Masked draft answer contents from analyst review while exposing complete submitted batches.
- Removed generic questionnaire and question CRUD routes as an authorization bypass surface.
- Proved owner, cross-owner, hostile-filter, analyst, missing-grant, inactive-identity, safe-error, projection, persistence, and generic-route behavior over mounted HTTP.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount authorised questionnaire read fixtures and RED cases** - `377ece8` (test)
2. **Task 2: Implement exact-grant owner-scoped questionnaire reads** - `d19b129` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-questionnaire/operations.ts` - Exact catalogue operation constants for the six read routes.
- `apps/strapi/src/api/csrm-question/operations.ts` - Exact questionnaire-scoped question read constant.
- `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts` - Custom protected routes ordered before parameterized detail paths.
- `apps/strapi/src/api/csrm-question/routes/csrm-question.ts` - Empty core router that prevents generic question CRUD.
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` - Thin workflow read controllers and safe error mapping.
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts` - Bounded queries, owner scope, derived state/progress, and actor-aware projections.
- `apps/strapi/src/policies/csrm-authorization.ts` - Typed questionnaire actor, collection scope, and ownership resolver.
- `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` - Development-only permissions for mounted workflow reads.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Isolated questionnaire fixtures and persisted reload helpers.
- `apps/strapi/tests/questionnaire-workflow.integration.test.ts` - Mounted authorization, IDOR, projection, summary, and route-narrowing evidence.

## Decisions Made

- Custom workflow routes are the sole served questionnaire read boundary; retaining generic reads offered no required capability and increased bypass risk.
- Client filters are allowlisted and replaced with the policy-derived owner relation for Requestors.
- Shared detail URLs select analyst behavior only when an explicit Security Analyst grant contains that exact operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking verifier] Used a case-sensitive RED output guard**
- **Found during:** Task 1
- **Issue:** PowerShell's case-insensitive `-match 'No test'` falsely matched normal `.test.js` output despite the intended sentinel being the only failing test.
- **Fix:** Used the equivalent case-sensitive `-cmatch` guard while preserving the non-zero exit, baseline exclusions, and required sentinel check.
- **Files modified:** None beyond the planned RED test files.
- **Verification:** RED run reported the required `PHASE3_RED_W0_01_READ_AUTHORIZATION_ABSENT` marker after mounted request authorization succeeded.
- **Commit:** `377ece8`

**2. [Rule 2 - Missing critical functionality] Added development Content API permissions for mounted read actions**
- **Found during:** Task 2
- **Issue:** Custom controller actions require users-permissions grants before the catalogue policy runs; omitting them would make the development identity workflow unusable.
- **Fix:** Added only the six read actions to the existing triple-gated, CSRM-only, idempotent development permission reconciliation.
- **Files modified:** `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts`, `apps/strapi/tests/helpers/strapi-http-harness.ts`
- **Verification:** The permission reconciliation contract and mounted questionnaire suite pass with no IAM or mutation grants added.
- **Commit:** `d19b129`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both changes preserve the planned security boundary and make its automated and development execution reliable.

## Issues Encountered

- The active shell reported Node v22.19.0 while the repository requests Node 24.19.x. The complete strict TypeScript and mounted test suite passed; global tooling was not changed.

## Verification Results

- `pnpm --filter @csrm/strapi test` - PASS (13/13 tests)
- Mounted Requestor owner list/detail/questions and hostile-filter replacement - PASS
- Mounted direct cross-owner detail/questions 403 with unchanged persisted records - PASS
- Mounted analyst read-all, exact-grant denial, inactive identity denial, and anonymous denial - PASS
- Analyst draft-answer masking and submitted-answer projection - PASS
- Generic questionnaire/question GET/POST/PUT/DELETE absence - PASS (404/405)
- Safe missing questionnaire response - PASS (404 without raw internal details)
- Frozen questionnaire schema diff - PASS (no changes)
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)
- GREEN integrity scan - PASS (no Plan 03-04 RED sentinel or test escape hatch remains)

## Known Stubs

None.

## Next Phase Readiness

- Plan 03-05 can build draft-answer mutations on the policy-derived actor and ownership decision.
- Plan 03-06 can consume bounded read projections without trusting client-supplied ownership filters.
- No blocker remains for Plan 03-05.

## Self-Check: PASSED

- All ten created or modified implementation/test files and this summary exist.
- Task commits `377ece8` and `d19b129` are present in repository history.
- All plan acceptance and verification commands pass.

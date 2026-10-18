---
phase: 03-dynamic-questionnaire-workflow
plan: 03
subsystem: api-contract
tags: [openapi, strapi, authorization, generated-types, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: closed questionnaire definition and answer schemas from Plan 03-02
provides:
  - Eight exact Phase 3 questionnaire workflow operations in the authoritative OpenAPI contract
  - Byte-identical capability catalogues with explicit Phase 3 served-route boundaries
  - Generated strict TypeScript paths and DTOs for questionnaire list, detail, answers, and submission
  - Contract tests for effective Requestor and Security Analyst grants
affects: [03-04, 03-05, 03-06, questionnaire-backend, questionnaire-web]

tech-stack:
  added: []
  patterns: [canonical served-route table, named bounded workflow DTOs, generated contract parity]

key-files:
  created: []
  modified:
    - docs/references/specification.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - apps/web/src/lib/api/generated/schema.d.ts

key-decisions:
  - "Expose exactly eight Phase 3 questionnaire workflow operations under /v1; Phase 4 review-comment, complete-review, and assessment-generation operations remain unserved catalogue intents."
  - "Use questionnaireId as an opaque Strapi documentId string and expose only questionKey/value in draft answer mutations."
  - "Return bounded named questionnaire DTOs and shared safe error envelopes for 400, 403, 404, and 409 responses."

patterns-established:
  - "Contract parity: one served-route table verifies OpenAPI, generated paths, exact FunctionAPI URLs, reciprocal function links, and effective role reachability."
  - "Mutation boundary: questionnaire answer drafts accept only answers containing questionKey and value; workflow state and timestamps remain server-owned."

requirements-completed: [QUES-01, QUES-03, QUES-04, QUES-05]

duration: 8min
completed: 2026-08-30
---

# Phase 3 Plan 3: Questionnaire Contract Alignment Summary

**Eight authorised questionnaire workflow operations now share one bounded OpenAPI, capability-catalogue, integration-test, and generated TypeScript contract.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T16:57:01Z
- **Completed:** 2026-08-29T17:05:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added the exact Requestor and Security Analyst questionnaire inventory, summary, detail, questions, draft-answer, and submit operations.
- Added closed named DTOs for bounded questionnaire projections and safe 400/403/404/409 error responses.
- Proved exact catalogue grants, reciprocal function links, Requestor separation from analyst inventory, byte parity, generated-client coverage, and Phase 4 route exclusion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Specify exact Phase 3 operation and grant parity** - `6f9a47a` (test)
2. **Task 2: Align OpenAPI, catalogue copies, and generated schema** - `0fda90d` (feat)

## Files Created/Modified

- `docs/references/specification.json` - Defines eight workflow paths, named DTOs, documentId parameter, and safe responses.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` - Documents the Phase 3 served-route boundary.
- `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` - Preserves byte-identical runtime catalogue content.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Owns the canonical served-route and effective-grant parity contract.
- `apps/web/src/lib/api/generated/schema.d.ts` - Generated typed paths, operations, request bodies, and responses.

## Decisions Made

- The custom `/v1` workflow routes are the only Phase 3 questionnaire client contract; generic CRUD paths are not substitutes.
- Future analyst mutations remain documented in the catalogue but absent from the Phase 3 OpenAPI and generated client.
- The answer draft payload is closed to `{ answers: [{ questionKey, value }] }`; clients cannot write workflow state, timestamps, relations, or definition data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking verifier] Made the RED verification marker check case-sensitive**
- **Found during:** Task 1 (Specify exact Phase 3 operation and grant parity)
- **Issue:** The plan's case-insensitive `No test` regex matched the unrelated existing test title `no test identity`, rejecting an otherwise valid RED result.
- **Fix:** Verified the same command output with a case-sensitive syntax/no-test guard while retaining the required non-zero exit and `PHASE3_RED_CONTRACT_ROUTES_ABSENT` marker checks.
- **Files modified:** None beyond the planned test.
- **Verification:** The suite reported 11 passes and one intentional contract-route failure carrying the required marker.
- **Committed in:** `6f9a47a`

**2. [Rule 3 - State tooling compatibility] Used supported field mutations for the current STATE format**
- **Found during:** Plan close-out
- **Issue:** The legacy `state.advance-plan` and `state.update-progress` handlers expect body fields that this repository's frontmatter-first STATE format does not contain.
- **Fix:** Used `state.update`, named-argument metric/decision/session handlers, and the roadmap/requirements handlers to advance to Plan 4 and record completion without editing protected tracking files directly.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** STATE reports Current Plan 4 and the completed 03-03 session; ROADMAP reports 3/12 plans executed.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking/tooling issues)
**Impact on plan:** Verification semantics were preserved; implementation scope did not change.

## Issues Encountered

- pnpm emitted an engine warning reporting Node v22.19.0 while the workspace requires Node 24.19.x. All required tests, generation, API drift checks, and strict typechecking still completed successfully; no global tooling was changed.

## Verification Results

- `pnpm --filter @csrm/strapi test` - PASS (12/12 tests)
- `pnpm --filter @csrm/web api:generate` - PASS and deterministic by SHA-256
- `pnpm --filter @csrm/web api:check` - PASS
- `pnpm --filter @csrm/web typecheck` - PASS
- Catalogue SHA-256 parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)
- Frozen content-type schema diff - PASS (no changes)
- GREEN integrity scan - PASS (no Phase 3 RED sentinel or test escape hatch remains)

## Known Stubs

None.

## Next Phase Readiness

- Downstream controller, authorization, and typed service plans can implement against the generated custom workflow operations.
- No blocker remains for Plan 03-04.

## Self-Check: PASSED

- All five modified contract artifacts and this summary exist.
- Task commits `6f9a47a` and `0fda90d` are present in repository history.

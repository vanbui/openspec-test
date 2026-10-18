---
phase: 02-requestor-risk-assessment-request-workflow
plan: 05
subsystem: api
tags: [strapi, authorization, workflow, pagination, request-number]

requires:
  - phase: 02-02
    provides: persisted development identity and least-privilege FunctionAPI authorization
provides:
  - Server-owned Requestor draft creation and immutable workflow facts
  - Requestor draft edit allowlist and one-way draft-to-submitted transition
  - Owner-scoped collection data and matching pagination metadata
  - Collision-resistant RAR request numbers with bounded unique-conflict retries
affects: [02-06, 02-07, 02-08, 02-12, requestor-workflow]

tech-stack:
  added: []
  patterns: [policy-derived actor state, persisted workflow state machine, database-backed identifier retry, same-scope data and count]

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment-request/services/request-workflow.ts
    - apps/strapi/src/api/csrm-assessment-request/services/request-number.ts
    - apps/strapi/tests/request-workflow.integration.test.ts
  modified:
    - apps/strapi/src/policies/csrm-authorization.ts
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts

key-decisions:
  - 'Checkpoint outcome — specified-format: requestNumber = "RAR-" + UTC four-digit year at creation + "-" + 6 random characters from the Crockford base32 alphabet (digits 0-9 and uppercase A-Z excluding I, L, O, U), generated from a cryptographically secure source. Example: RAR-2026-X7K4Q2. Fixed total length 15. No sequential or gapless guarantee. Uniqueness is backed by the existing database unique constraint with a bounded retry (maximum 5 attempts) only on recognized unique-conflict errors; never count rows.'

patterns-established:
  - "Trusted actor pattern: controllers consume the policy-derived Requestor or analyst actor and never reinterpret client role claims."
  - "Workflow pattern: Requestor mutations load persisted state, filter through a closed field allowlist, and stamp server-owned transition facts."
  - "Collection pattern: one bounded owner-scoped filter drives both document retrieval and total count."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04]

duration: 11 min
completed: 2026-08-29
---

# Phase 2 Plan 5: Requestor Workflow Boundary Summary

**Strapi now owns Requestor identity, identifiers, draft mutations, submission facts, and pagination scope through mounted server-side enforcement.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-29T12:52:43Z
- **Completed:** 2026-08-29T13:04:21Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- Added a cryptographically generated `RAR-YYYY-XXXXXX` request number with the existing unique constraint as its backstop and at most five retries for recognized request-number conflicts.
- Enforced a closed Requestor field allowlist, immutable owner/identifier facts, persisted draft guards, and exactly one server-timestamped `draft` to `submitted` transition.
- Returned Strapi-shaped pagination metadata from the same bounded owner-scoped filters used for collection data, ignoring hostile ownership and sponsor-expansion input.
- Proved the behavior through the mounted router, policy, controller, and isolated SQLite path, including unchanged persistence after denials.

## Task Commits

Each implementation task was committed atomically:

1. **02-W0-01B: Specify mounted ownership, pagination, mass-assignment, and transition behavior** - `80effa3` (test)
2. **02-05-02: Approve the server-owned requestNumber display format** - resolved operator checkpoint; no code commit
3. **02-05-03: Enforce trusted actor and server-owned create/update workflow** - `97a2f9e` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment-request/services/request-number.ts` - Generates the approved identifier and limits conflict retries.
- `apps/strapi/src/api/csrm-assessment-request/services/request-workflow.ts` - Defines Requestor-writable fields and the persisted draft state machine.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` - Validates bounded query input and builds identically scoped data/count queries.
- `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` - Routes trusted actor facts through server-owned create, update, and list behavior.
- `apps/strapi/src/policies/csrm-authorization.ts` - Records the effective Requestor or analyst actor with analyst priority.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Adds workflow fixtures, relation fixtures, scoped counts, and persisted reload support.
- `apps/strapi/tests/request-workflow.integration.test.ts` - Exercises mass assignment, IDOR, transitions, pagination, and retry bounds over mounted HTTP.

## Decisions Made

Checkpoint outcome — specified-format: requestNumber = "RAR-" + UTC four-digit year at creation + "-" + 6 random characters from the Crockford base32 alphabet (digits 0-9 and uppercase A-Z excluding I, L, O, U), generated from a cryptographically secure source. Example: RAR-2026-X7K4Q2. Fixed total length 15. No sequential or gapless guarantee. Uniqueness is backed by the existing database unique constraint with a bounded retry (maximum 5 attempts) only on recognized unique-conflict errors; never count rows.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `cd apps/strapi; npm exec tsc -- --pretty false` - PASS
- `cd apps/strapi; npm exec tsc -- -p tests/tsconfig.json --pretty false` - PASS
- Focused mounted RED command emitted only `PHASE2_RED_REQUEST_WORKFLOW_GUARDS_ABSENT` before implementation - PASS
- `cd apps/strapi; npm test` after implementation - PASS (9 tests)
- No assessment-request content-type schema changes - PASS
- No new dependencies - PASS

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Strapi workflow boundary is ready for the typed API contract and supporting inventory work in Plan 02-06.
- No blockers remain for downstream Requestor list, form, action, or end-to-end plans.

## Self-Check: PASSED

- All key files exist.
- Task commits `80effa3` and `97a2f9e` exist in repository history.
- The full Strapi verification suite passes.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*

---
phase: 04-assessment-review-risk-editing-and-release
plan: "06"
subsystem: api
tags: [strapi, deterministic-jobs, transactions, authorization, assessment-drafts]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: closed draft-job contract, bounded provider/registry, domain identifiers, seeded RiskTypes, and analyst review queue
provides:
  - Exact-grant generate, poll, and retry routes for volatile assessment draft jobs
  - Atomic deterministic Assessment and Risk aggregate persistence with server-owned provenance and identifiers
  - Mounted rollback, single-flight, safe-failure, retry, rediscovery, and actor-denial coverage
affects: [04-07, 04-09, 04-10, 04-12]

tech-stack:
  added: []
  patterns: [module-scoped bounded registry, authoritative attempt reload, transaction relation backstop, closed job projection]

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment/operations.ts
  modified:
    - apps/strapi/tests/assessment-workflow.integration.test.ts
    - apps/strapi/src/api/csrm-questionnaire/operations.ts
    - apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts

key-decisions:
  - "Keep volatile lifecycle state in the bounded registry while assessment-workflow owns every authoritative reload, identifier, relation, workflow fact, and transaction."
  - "Expose only the frozen exhaustive job fields; provider metadata, initiating-actor internals, questionnaire answers, and diagnostics never cross the route boundary."
  - "Treat an already-linked risk-assessment-drafted aggregate as restart discovery and return it without invoking the provider or creating a duplicate."

patterns-established:
  - "Draft attempt: validate target -> enqueue -> authoritative reload -> deterministic proposal -> transaction lock/recheck -> Assessment/Risk writes -> request transition."
  - "Advisory-only completion: generatedBy identifies the initiating analyst, while approvedBy and approvalDate remain unset and assessmentStatus remains draft."

requirements-completed: [ASSESS-02]

duration: 19min
completed: 2026-08-30
---

# Phase 4 Plan 6: Deterministic Assessment Draft Job Summary

**Exact-grant non-blocking draft jobs now persist one deterministic advisory Assessment/Risk aggregate atomically, with bounded polling, safe failure, retry, and restart discovery.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-29T23:14:08Z
- **Completed:** 2026-08-29T23:33:11Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Mounted `POST /api/v1/questionnaires/{questionnaireId}/generate_assessment`, `GET /api/v1/assessment_draft_jobs/{jobId}`, and `POST /api/v1/assessment_draft_jobs/{jobId}/retry` behind exact catalogue operations and server-side actor checks.
- Reloaded submitted visible answers plus sorted deterministic RiskTypes and Controls for every attempt, parsed the closed provider proposal, and persisted one draft Assessment with deterministic Risks in one transaction.
- Added the request-row lock and one-to-one relation recheck before writes; concurrent generation returns one logical job, write failure rolls back the complete aggregate, and an existing linked draft is discovered rather than regenerated.
- Kept all release fields server-owned and unset: completion records `generatedDate`, links `generatedBy` to the initiating analyst, transitions the request to `risk-assessment-drafted`, and leaves the assessment in `draft`.
- Proved provider failures, failed-job retry, job enumeration denial, inactive/ungranted actor denial, non-submitted and missing questionnaire rejection, forged server-field rejection, safe DTOs, Crockford identifiers, and no partial persistence through mounted HTTP tests.

## Task Commits

The TDD task was committed atomically through its required gates:

1. **RED: Add failing mounted draft generation contract** - `4b5d732` (test)
2. **GREEN: Mount deterministic assessment draft jobs** - `1d5a4e5` (feat)

**Plan metadata:** committed with this summary before sequential tracking updates.

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment/operations.ts` - Names the exact job lookup and retry FunctionAPI operations.
- `apps/strapi/src/api/csrm-questionnaire/operations.ts` - Names the generation FunctionAPI operation.
- `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts` - Mounts the analyst generation route.
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` - Validates the bodyless request and queues the initial job through `generateAssessment`.
- `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts` - Replaces generic assessment CRUD exposure with bounded job status and retry routes.
- `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts` - Projects actor-scoped job status and retry responses with safe errors.
- `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` - Owns authoritative reload, deterministic proposal validation, transaction persistence, provenance, relation backstop, and registry integration.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` - Covers mounted lifecycle, concurrency, rollback, safe failure, retry, discovery, DTO closure, and denials.

## Decisions Made

- The questionnaire controller links to the registry through the named `generateAssessment` workflow export, keeping HTTP concerns separate while making the planned source link human-readable and directly traceable.
- `assessment-workflow.ts` is the only layer allowed to set `assessmentRequest`, `generatedBy`, `generatedDate`, `assessmentStatus`, `riskNumber`, `assessmentNumber`, or `risk-assessment-drafted`; neither provider output nor request bodies can set them.
- Job lookup is initiating-analyst scoped after the exact Security Analyst grant policy succeeds. An equivalent all-job scope is not inferred from a role label.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The mounted harness intentionally does not seed the development-only deterministic RiskTypes into its production-like database. The integration test creates bounded reference fixtures through the harness' isolated public-permission helper, without changing production seeds, schemas, or permissions.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate: full Strapi suite passed 52 existing tests and failed only the two ordinary missing generation-route assertions (HTTP 405).
- GREEN gate: `npm test` in `apps/strapi` under Node 24.19.0 with `STRAPI_ADMIN_AUTO_OPEN=false`: PASS, 55/55 tests.
- Mounted focused workflow: PASS, generation/failure/retry/authorization tests 5/5.
- Catalogue SHA-256 comparison: PASS, authoritative and bootstrap copies remain byte-identical.
- Frozen content-type schema guard: PASS, no `schema.json` changes.
- Test-integrity scan: PASS, no RED sentinel, `execArgv`, file-existence gate, skip, todo, conditional escape hatch, or early-return test guard.

## Known Stubs

None.

## Self-Check: PASSED

- All eight created or modified task files exist.
- RED commit `4b5d732` and GREEN commit `1d5a4e5` exist in repository history in the required order.
- The full task acceptance criteria and plan-level Strapi verification pass without schema, catalogue, dependency, or developer-database changes.

## Next Phase Readiness

- Plan 04-07 can mount allowlisted Assessment/Risk editing on the generated aggregate.
- Plans 04-09 and 04-10 can consume the closed generate/status/retry contract and safe exhaustive job states.
- No blocker, durable-job claim, release side effect, schema change, dependency, or external setup remains.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

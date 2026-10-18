---
phase: 04-assessment-review-risk-editing-and-release
plan: "02"
subsystem: api
tags: [openapi, strapi, authorization, assessment-release, deterministic-jobs]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: closed questionnaire DTOs, exact catalogue parity, generated client boundary, and submitted-answer contract
  - phase: 04-assessment-review-risk-editing-and-release
    provides: Wave 0 release fixtures and browser acceptance boundary from Plan 01
provides:
  - Composite owner-scoped assessment release invariant with frozen-model limitations
  - Deterministic bounded draft-job lifecycle and stable risk proposal mappings
  - Closed Phase 4 OpenAPI operations, mutation DTOs, exact grants, and generated client paths
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13, 04-14, 04-15, 04-16]

tech-stack:
  added: []
  patterns: [composite release predicate, exhaustive job union, closed workflow DTOs, exact contract-catalogue parity]

key-files:
  created:
    - docs/contract-gaps/phase-04-composite-release-fact.md
    - docs/contract-gaps/phase-04-deterministic-draft-jobs.md
  modified:
    - docs/references/specification.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - apps/web/src/lib/api/generated/schema.d.ts

key-decisions:
  - "Release requires the complete assessment status/approver/date triple and owning-request approval in one transaction; partial facts fail closed."
  - "Draft jobs use an exhaustive volatile four-state registry with bounded terminal retention, while persisted provenance identifies the initiating analyst."
  - "Risk and ControlImplementation mutation contracts expose only their frozen editable fields and resolve relation identifiers server-side."

patterns-established:
  - "Complete-release scope: Requestor projections require owner scope plus the full composite release fact on every aggregate read."
  - "Contract inventory parity: each intended /v1 method maps to one operationId, exact role-facing Function grants, safe envelopes, and a generated path."

requirements-completed: [ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05]

duration: 16min
completed: 2026-08-30
---

# Phase 4 Plan 2: Assessment Contract and Grant Boundary Summary

**Composite release semantics, bounded deterministic draft jobs, and 21 closed workflow operations with exact catalogue and generated-client parity.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-29T22:03:30Z
- **Completed:** 2026-08-29T22:19:07Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Defined complete assessment release as an atomic four-part aggregate fact, with owner-only post-release reads, fail-closed partial states, descendant immutability, and one server-authoritative readiness checklist.
- Fixed the deterministic provider boundary as a single-flight four-state job lifecycle with bounded terminal retention, stable risk mappings, authoritative answer reloads, safe retry/failure behavior, and honest volatile provenance limits.
- Added 21 named Phase 4 workflow operations with closed assessment, Risk, ControlImplementation, picker, released-read, rating-summary, and exhaustive job DTOs.
- Extended catalogue grants only where required for draft-job observation/retry and the minimal analyst owner picker, retained byte parity, and generated the strict web client without hand edits.
- Added unconditional parity tests for exact grants, safe error envelopes, mutation allowlists, server-owned-field exclusion, ambiguous verb absence, unsafe generic-grant absence, generated paths, and minimal development permissions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Document the composite release contract gap** - `2aacbfa` (docs)
2. **Task 2: Document the deterministic draft-job contract gap** - `380ff07` (docs)
3. **Task 3: Add closed OpenAPI operations and exact catalogue parity tests** - `47fe435` (feat)

## Files Created/Modified

- `docs/contract-gaps/phase-04-composite-release-fact.md` - Freezes release atomicity, readiness, visibility, rating, owner projection, and model limitations.
- `docs/contract-gaps/phase-04-deterministic-draft-jobs.md` - Defines the bounded job state machine, stable mappings, restart behavior, exclusions, and provenance limits.
- `docs/references/specification.json` - Adds named bounded Phase 4 paths, responses, parameters, and closed DTOs.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` - Adds narrow job and analyst owner-picker FunctionAPIs.
- `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` - Remains a byte-identical bootstrap copy of the authoritative catalogue.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Enforces Phase 4 contract, grant, DTO, client, and development-permission parity.
- `apps/web/src/lib/api/generated/schema.d.ts` - Regenerated typed paths and exhaustive DTO unions.

## Decisions Made

- The release fact is complete only when `assessmentStatus=approved`, `approvedBy`, and valid server `approvalDate` are present and the owning request transitions to `approved` atomically.
- `submit_for_approval`, `approve`, and `regenerate_draft` remain unserved because the frozen model cannot safely represent distinct approval and release events.
- Rating values are exactly `Low`, `Moderate`, `High`, and `Critical`; clients display but never calculate them.
- Active owner search returns only `{documentId, displayName}` and relation IDs are validated and resolved server-side.
- Draft registry state is volatile and bounded to 500 terminal entries with one-hour TTL/LRU; queued and running jobs are never evicted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed the development-permission absence assertion**
- **Found during:** Task 3 (Add closed OpenAPI operations and exact catalogue parity tests)
- **Issue:** The first forbidden-action pattern also matched the legitimate `csrm-assessment-request` permissions, causing a false failure after all contract checks passed.
- **Fix:** Matched only the exact Phase 4 content API namespaces for assessment, Risk, and ControlImplementation actions while retaining the unconditional exact-array assertion for every permitted development action.
- **Files modified:** `apps/strapi/tests/contract-catalogue.integration.test.ts`
- **Verification:** Final Strapi suite passed 27/27 tests under Node 24.19.0.
- **Committed in:** `47fe435`

**2. [Rule 3 - Blocking] Reconciled state fields unsupported by the installed state handlers**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` could not parse the frontmatter-first state format, while progress synchronization mixed disk-wide phase counts with the milestone plan total and left a stale Next Action.
- **Fix:** Used the successful state handlers for metrics, decisions, session, roadmap, and requirements; then reconciled Plan 3, 36/50 (72%) progress, execution status, and the Plan 04-03 next action.
- **Files modified:** `.planning/STATE.md`
- **Verification:** State records `current_plan: 3`, `completed_plans: 36`, `percent: 72`, and `Stopped At: Completed 04-02-PLAN.md`; ROADMAP records 2/16 Phase 4 plans executed.
- **Committed in:** plan tracking commit

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue).
**Impact on plan:** The corrections removed a false positive and completed sequential tracking without weakening the contract or expanding scope.

## Issues Encountered

- The default pnpm shim resolved its bundled Node 22 runtime. Verification used the existing user-level pnpm shim with the required Node 24.19.0 path explicitly prepended; no runtime or global-tool installation was changed.
- `api:check` compares the generated file to the index, so the freshly generated client was staged before the drift check and then committed with the rest of Task 3.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test` in `apps/strapi` under Node 24.19.0: PASS, 27/27 tests.
- `pnpm --filter @csrm/web api:generate`: PASS.
- `pnpm --filter @csrm/web api:check`: PASS.
- Catalogue SHA-256 comparison: PASS, both copies byte-identical.
- Frozen content-type schema diff guard: PASS, no `schema.json` changes.
- Task acceptance checks for exact Risk fields (34), ControlImplementation fields (8), closed DTOs, generated paths, and ambiguous operation absence: PASS.

## Known Stubs

None. The deterministic provider is an intentional Phase 4 production boundary documented here, not an unwired placeholder; durable provider infrastructure remains explicitly assigned to Phase 8.

## Self-Check: PASSED

- Both contract-gap records and all five Task 3 artifacts exist.
- Task commits `2aacbfa`, `380ff07`, and `47fe435` exist in repository history.
- Final contract tests, client generation/check, catalogue parity, and frozen-schema guard all pass.

## Next Phase Readiness

- Plan 04-03 can implement pure release-readiness and aggregate projection contracts against fixed DTO and transition semantics.
- Later route, provider, authorization, editor, and release plans have one exact machine-checkable operation/grant inventory.
- No unresolved model decision blocks Phase 4 implementation; durable provider provenance remains deliberately deferred to Phase 8.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

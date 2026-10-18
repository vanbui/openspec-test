---
phase: 04-assessment-review-risk-editing-and-release
plan: "19"
subsystem: api
tags: [strapi, authorization, owner-labels, route-registration, integration-tests]
requires:
  - phase: 04-17
    provides: bounded analyst assessment detail and persisted owner-label projection
  - phase: 04-18
    provides: closed typed assessment-detail consumer contract
provides:
  - bounded active-user picker search regression coverage
  - persisted inactive-owner hydration through the authorised assessment detail
  - one actor-aware registration for each shared descendant GET
affects: [assessment-review, risk-editing, requestor-released-detail]
tech-stack:
  added: []
  patterns: [persisted-relation owner hydration, bounded identity search, actor-aware shared reads]
key-files:
  created: []
  modified: [apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts, apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts, apps/strapi/tests/assessment-workflow.integration.test.ts, apps/strapi/tests/helpers/strapi-http-harness.ts]
key-decisions:
  - "The existing authorised assessment-detail response remains the sole transport for persisted owner labels."
  - "Shared descendant GET paths are registered only by the actor-aware assessment controller."
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 11min
completed: 2026-08-30
---

# Phase 04 Plan 19: Bounded Owner Search and Actor-Aware Routes Summary

**Active owner search stays capped at 20 while the authorised assessment detail retains persisted owner labels after search exclusion or account deactivation.**

## Performance

- **Duration:** 11 min
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Mounted coverage proves search is active-only, sorted, capped, query-closed, and cannot accept caller-supplied selected IDs.
- Persisted owner labels remain available only through the authorised analyst assessment detail, including an owner omitted by the picker cap and made inactive afterwards.
- Removed duplicate descendant GET registrations so Requestor and analyst reads always select the actor-aware assessment controller.

## Task Commits

1. **Task 1: Specify bounded active search and existing-detail persisted-owner behaviour** — `00ccdc1` (test)
2. **Task 2: Keep the search contract bounded without expanding the catalogue-controlled surface** — `c8109d3` (feat)

## Decisions Made

- Kept the frozen OpenAPI detail response and catalogue unchanged; regeneration verifies its serialized type remains stable.
- Used test-only fixture helpers to create capped-search and post-selection deactivation conditions without mounting any identity CRUD endpoint.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Missing critical verification support] Added isolated fixture helpers for picker-cap and inactive-owner coverage**
- **Found during:** Task 2
- **Issue:** The existing HTTP harness could not create the 21 active identities or deactivate a persisted owner required to prove the closed mounted contract.
- **Fix:** Added narrowly scoped test-harness helpers that write only to the isolated test database; no production route, schema, catalogue, or client contract changed.
- **Files modified:** `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/assessment-workflow.integration.test.ts`
- **Verification:** Focused and full Strapi suites passed.
- **Commit:** `c8109d3`

**Total deviations:** 1 auto-fixed (Rule 2).

## Issues Encountered

The legacy Phase 4 `STATE.md` counters could not be parsed by the SDK's advance-plan, progress, metric, or decision handlers. Session recording and roadmap progress updates succeeded; no state content was manually rewritten.

## Verification

- `npm test -- --test-name-pattern="active user|assessment detail|ownerLabels|1,000|1,001|2,000|2,001"` — passed (67 tests)
- `npm test` — passed (67 tests)
- `pnpm --filter @csrm/web api:generate` — passed
- `pnpm --filter @csrm/web api:check` — passed
- `git diff --check` — passed
- Confirmed both frozen role/function/API catalogue copies retain SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.

## Known Stubs

None.

## Next Phase Readiness

The analyst editor can rely on its existing closed detail response for persisted owners without adding an identity-selection API surface.

## Self-Check: PASSED

- Confirmed task commits `00ccdc1` and `c8109d3` exist.
- Confirmed all four modified files exist.

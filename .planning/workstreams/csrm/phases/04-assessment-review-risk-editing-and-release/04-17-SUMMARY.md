---
phase: 04-assessment-review-risk-editing-and-release
plan: "17"
subsystem: api
tags: [strapi, openapi, risk-assessment, authorization, generated-types]
requires:
  - phase: 04-12
    provides: bounded assessment workflow and readiness validation
  - phase: 04-16
    provides: owner-scoped released assessment reads
provides:
  - closed analyst and Requestor assessment-detail responses
  - lossless bounded analyst Risk reload projection
  - generated discriminated web API contract
affects: [assessment-review, release, requestor-assessment-detail]
tech-stack:
  added: []
  patterns: [actor-selected closed response DTOs, bounded relation-derived labels]
key-files:
  created: [scripts/verify-phase-04-integrity.test.ps1]
  modified: [apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts, apps/strapi/src/api/csrm-risk/services/risk-workflow.ts, docs/references/specification.json, apps/web/src/lib/api/generated/schema.d.ts]
key-decisions:
  - "Assessment detail branches by the authorised actor before response serialization."
  - "Analyst owner labels are resolved solely from persisted Risk owner relations after aggregate bounds pass."
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 29min
completed: 2026-08-30
---

# Phase 04 Plan 17: Full Analyst Risk Reload Contract Summary

**Closed actor-specific assessment detail responses now preserve full analyst Risk editor state, server-authoritative release readiness, and persisted owner labels.**

## Performance

- **Duration:** 29 min
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Reloads up to 1,000 persisted Risks with all frozen writable fields and five relation document IDs for authorised analysts.
- Computes analyst readiness with the release workflow validator and derives stable owner labels only from persisted Risk relations.
- Publishes generated OpenAPI oneOf actor variants; Requestor detail omits analyst-only keys at serialization.

## Task Commits

1. **Task 1: Prove full Risk save-reload and authoritative readiness at the mounted boundary** — `fb43953` (test)
2. **Task 2: Implement and publish the full analyst Risk/readiness contract with a bounded OpenAPI exception** — `c00ae02` (feat)

## Decisions Made

- The existing authorised detail route remains the only route; it selects either the analyst or Requestor DTO after server-side scope checks.
- The OpenAPI exception is limited to the detail GET 200 schema and directly referenced closed variants; mutation responses retain their existing DTO.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the mounted readiness assertion to use the shared validator**
- **Found during:** Task 2
- **Issue:** The RED test hard-coded an incomplete missing-field list that did not match `validateReleaseReadiness` for the persisted aggregate.
- **Fix:** Compared the response to the shared validator result, preserving the assertion that detail readiness is server-owned.
- **Files modified:** `apps/strapi/tests/assessment-workflow.integration.test.ts`
- **Verification:** Focused and full Strapi suites pass.
- **Commit:** `c00ae02`

**Total deviations:** 1 auto-fixed (Rule 1).

## Verification

- `npm test -- --test-name-pattern="save-reload|readiness"` — passed
- `npm test` — passed (65 tests)
- `pnpm --filter @csrm/web api:generate` and `api:check` — passed
- `scripts/verify-phase-04-integrity.test.ps1` and `scripts/verify-phase-04-integrity.ps1` — passed
- `git diff --check` — passed

## Issues Encountered

- The planning SDK could not parse this repository's legacy Phase 4 plan counters, so `state.advance-plan`, progress, metric, and decision mutations were not applied. Its session update and the roadmap plan-progress update succeeded; no project-state content was manually rewritten.

## Self-Check: PASSED

- Confirmed task commits `fb43953` and `c00ae02` exist.
- Confirmed generated contract and integrity scripts exist.

## Next Phase Readiness

The assessment detail endpoint now supplies complete persisted analyst editor state without exposing analyst-only fields to Requestors.

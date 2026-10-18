---
phase: 04-assessment-review-risk-editing-and-release
plan: "22"
subsystem: Strapi assessment workflow validation
tags: [strapi, validation, risk, assessment-review]
dependency_graph:
  requires: [04-19]
  provides: [normalized-risk-statements, calendar-valid-review-date-filters]
  affects: [risk-mutations, analyst-review-collection]
tech_stack:
  added: []
  patterns: [closed-parser-normalization, UTC-calendar-component-validation]
key_files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/tests/assessment-workflow.unit.test.ts
    - apps/strapi/tests/assessment-workflow.integration.test.ts
decisions:
  - Normalize all supplied Risk text in the shared writable-field parser before validation and persistence.
  - Validate analyst review due-date filters through UTC component round-tripping to avoid timezone drift.
requirements-completed: [ASSESS-03, ASSESS-04]
duration: 6 min
completed: 2026-08-30
---

# Phase 04 Plan 22: Input-validation closure Summary

Risk statements now trim to meaningful persisted text, and analyst review date filters reject impossible Gregorian calendar values before reaching Strapi queries.

## Tasks Completed

1. Added RED unit and mounted route regressions for whitespace Risk statements, normalized persistence, impossible review dates, and leap-day acceptance. (`6fb6acc`)
2. Normalized shared Risk parser text and added UTC real-calendar validation for analyst review due-date filters. (`3e6e99a`)

## Verification

- `npm test -- --test-name-pattern="whitespace|risk statement|review date|leap"` — passed (68 tests).
- `npm test` — passed (68 tests).

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 3 - Blocking issue] Updated the shared Risk writable-field parser
- **Found during:** Task 2
- **Issue:** `risk-workflow.ts` consumes `parseWritableRiskFields`, but the parser is owned by `csrm-assessment/services/assessment-workflow.ts`; changing only the listed workflow file could not satisfy parser-level normalization coverage.
- **Fix:** Normalized and validated the Risk statement in the shared closed parser while preserving Risk route contracts and authorization.
- **Files modified:** `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts`
- **Commit:** `3e6e99a`

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** No API, authorization, schema, catalogue, or data-store change.

## Known Stubs

None.

## Self-Check: PASSED

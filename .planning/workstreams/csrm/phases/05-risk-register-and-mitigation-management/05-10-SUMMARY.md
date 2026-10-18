---
phase: 05-risk-register-and-mitigation-management
plan: 10
subsystem: api
tags: [strapi, sqlite, openapi, typescript, authorization, date-filtering]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised Risk Register query, pagination, sorting, projection, and generated client boundary
provides:
  - Closed targetDateFrom and targetDateTo query parsing with exact calendar validation
  - Inclusive shared SQLite date predicates for authoritative totals and pages
  - Canonical OpenAPI date parameters and regenerated strict web transport types
affects: [05-11, 05-12, risk-register, generated-api]

tech-stack:
  added: []
  patterns: [UTC component round-trip date validation, shared pre-pagination repository predicates]

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-risk/services/risk-register-query.ts
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/tests/risk-register.unit.test.ts
    - apps/strapi/tests/risk-register.integration.test.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts

key-decisions:
  - "Validate fixed-width target dates by UTC component round-tripping before comparing canonical YYYY-MM-DD strings."
  - "Apply both inclusive date bounds only through the shared repository filter used by count and page selection."

patterns-established:
  - "Closed date query contract: scalar YYYY-MM-DD inputs are calendar-valid, independently optional, and non-inverted."
  - "Contract generation: edit canonical OpenAPI and regenerate schema.d.ts; never widen generated types manually."

requirements-completed: [RISK-01]

duration: 12min
completed: 2026-09-01
---

# Phase 05 Plan 10: Risk Register Target-Date Contract Summary

**Authorised Risk Register date ranges now use exact calendar parsing, inclusive pre-pagination SQLite predicates, and generated OpenAPI transport types.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-31T20:53:01Z
- **Completed:** 2026-08-31T21:04:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added closed `targetDateFrom` and `targetDateTo` parsing that rejects blank, repeated, non-string, overlong, datetime, impossible, and inverted inputs.
- Applied inclusive lower and upper `r.target_date` predicates through the same database filter used for distinct totals and ordered page selection.
- Proved exact-bound, one-sided, closed, zero-match, composed-filter, honest-pagination, and authorization-before-parsing behavior through unit and mounted tests.
- Published both optional `format: date` OpenAPI parameters immediately before `sort` and regenerated the strict web schema without catalogue drift.

## Task Commits

Each task was committed through its TDD RED and GREEN gates:

1. **Task 1 RED: Add failing target-date range coverage** - `2c3e43d` (test)
2. **Task 1 GREEN: Implement target-date range filtering** - `1f7cfc9` (feat)
3. **Task 2 RED: Add failing date-query contract assertions** - `f243353` (test)
4. **Task 2 GREEN: Publish target-date query contract** - `8ad3fb8` (feat)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` - Closed scalar date parsing and inverted-range rejection.
- `apps/strapi/src/api/csrm-risk/services/risk-register.ts` - Inclusive shared SQLite target-date predicates.
- `apps/strapi/tests/risk-register.unit.test.ts` - Parser positive and hostile-input matrices.
- `apps/strapi/tests/risk-register.integration.test.ts` - Mounted authorization, range composition, totals, pagination, and zero-match proof.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Canonical parameter and generated-type assertions.
- `docs/references/specification.json` - Optional date-only Risk Register query parameters.
- `apps/web/src/lib/api/generated/schema.d.ts` - Regenerated optional date query properties.

## Decisions Made

- Used UTC component round-tripping rather than permissive date parsing so impossible dates cannot normalize into valid ones.
- Kept lexical range comparison only after canonical fixed-width parsing, where `YYYY-MM-DD` ordering is chronological.
- Reused `applyFilters` for both count and page queries so totals cannot diverge from selected records.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The global `pnpm` PowerShell shim launched Node 22 despite the active Node 24.19.0 executable. Verification was run through Node 24's `corepack pnpm` entry point, matching the locked runtime.
- `api:check` intentionally reports generated drift while the new generated file is unstaged. After staging the canonical specification and generated output together, regeneration was stable and the drift check passed.
- The state SDK advanced the reopened gap-closure counter from 1 to 2 rather than the actual plan-file position. STATE was normalized to Plan 11, the next unexecuted plan; Phase 5 remains in progress at 10/12 summaries.

## Known Stubs

None. Stub-pattern matches were existing nullable projection behavior, empty accumulator initialization, and test fixtures; none flow to a placeholder UI or prevent the plan goal.

## Verification

- `corepack pnpm --filter @csrm/strapi test` — PASS, 96/96 tests.
- `corepack pnpm --filter @csrm/web api:check` — PASS after canonical generation.
- Capability catalogue SHA-256 copies — PASS, both `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Frozen content schemas, package manifests, lockfile, and RISK-02 feature files — PASS, unchanged from the pre-plan base.
- TDD gate ordering — PASS, each test commit precedes its corresponding feature commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend and generated transport support are ready for Plan 05-11 to wire the Risk Register URL/UI date controls.
- Phase 5 remains in progress; this plan does not start Phase 6 or declare the gap-closure sequence complete.

## Self-Check: PASSED

- All seven planned files exist and only those production/test/contract files changed from the pre-plan base.
- All four TDD task commits exist in git history.
- The complete Strapi and generated-contract verification commands pass.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*

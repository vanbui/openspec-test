---
phase: 05-risk-register-and-mitigation-management
plan: 11
subsystem: ui
tags: [nextjs, typescript, zod, vitest, accessibility, date-filtering]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised Risk Register query plus generated targetDateFrom and targetDateTo transport contract
provides:
  - Closed canonical browser state for one-sided and bounded Target date ranges
  - Responsive labelled native date controls with independent chips and active counts
  - Paired and global date clearing that retains sort and page size
  - Superseding approved UI contract for target-date filtering
affects: [05-12, risk-register, risk-register-ui, RISK-01]

tech-stack:
  added: []
  patterns: [fail-closed URL validation, shared responsive filter composition, independent filter chips]

key-files:
  created:
    - apps/web/src/features/risks/risk-register-page.test.tsx
  modified:
    - apps/web/app/(app)/app/risks/page.tsx
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-schema.test.ts
    - apps/web/src/features/risks/risk-service.test.ts
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-register.test.tsx
    - .planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md

key-decisions:
  - "The approved RISK-01 target-date addendum supersedes earlier temporary Phase 5 decisions that rejected or stripped the two date parameters."
  - "Reject the complete browser query when any supplied target-date bound is invalid, duplicated, impossible, or inverted, then render no data and issue no service requests."
  - "Reuse one Target date range fieldset in desktop More filters and the mobile Sheet while representing each bound as an independent active filter."

patterns-established:
  - "Date range fail-closed boundary: exact UTC-round-tripped YYYY-MM-DD values survive; repeated, malformed, impossible, or inverted state rejects the query before data access."
  - "Responsive filter parity: desktop popover and mobile Sheet compose the same labelled fields and clear behavior."

requirements-completed: [RISK-01]

duration: 8min
completed: 2026-09-01
---

# Phase 05 Plan 11: Risk Register Target-Date UI Summary

**Canonical target-date ranges now round-trip through typed web state and appear as accessible shared desktop/mobile controls with complete chip, count, reset, and clearing behavior.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-31T21:12:05Z
- **Completed:** 2026-08-31T21:20:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Extended the closed Risk Register browser schema with exact calendar validation and pair-level rejection before generated transport.
- Added labelled native Target date inputs to the shared More-filter composition used by the desktop popover and mobile Sheet.
- Wired both bounds into canonical URLs, active counts, independent removable chips, paired clearing, global clearing, and page reset while retaining sort and page size.
- Superseded the approved UI specification with the complete interaction contract and required component/browser evidence.

## Task Commits

Each TDD task was committed through its RED and GREEN gates:

1. **Task 1 RED: Add failing date-query web contract** - `925d8dc` (test)
2. **Task 1 GREEN: Carry canonical date ranges to Strapi** - `9ff2305` (feat)
3. **Task 2 RED: Add failing responsive date-filter coverage** - `e55e146` (test)
4. **Task 2 GREEN: Add responsive target-date filters** - `a4b480f` (feat)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `apps/web/src/features/risks/risk-schema.ts` - Exact browser date parsing, pair canonicalization, and service projection.
- `apps/web/src/features/risks/risk-schema.test.ts` - Valid one-sided/closed range and hostile date-state coverage.
- `apps/web/src/features/risks/risk-service.test.ts` - Generated-client preservation of canonical date bounds.
- `apps/web/src/features/risks/risk-register-filters.tsx` - Shared labelled native date controls and paired clearing.
- `apps/web/src/features/risks/risk-register.tsx` - URL allowlist, chips, active count, individual removal, and global clearing.
- `apps/web/src/features/risks/risk-register.test.tsx` - Desktop/mobile, loading, URL, count, chip, and clear behavior evidence.
- `apps/web/src/features/risks/risk-register-page.test.tsx` - Permission-first invalid-query and no-request route evidence.
- `apps/web/app/(app)/app/risks/page.tsx` - Fail-closed route validation before register and picker service calls.
- `.planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md` - Superseding target-date interaction addendum.

## Decisions Made

- The approved RISK-01 addendum supersedes the earlier temporary Phase 5 decisions that rejected or stripped `targetDateFrom` and `targetDateTo` before the backend contract existed.
- Reject the complete query at the server-rendered route boundary so an invalid supplied endpoint cannot silently broaden the authorised result set.
- Kept date validation in the shared schema and reused the existing responsive filter composition, leaving JSX responsible only for presentation and events.
- Displayed canonical ISO date-only values in chips so shared URL state remains directly traceable without locale ambiguity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rejected invalid date URLs before data access**
- **Found during:** Post-execution code review CR-01
- **Issue:** Malformed, duplicate, impossible, or inverted date bounds were deleted as a pair, allowing an unrestricted register request.
- **Fix:** The schema now rejects invalid supplied bounds, the permission-gated route renders an accessible non-data invalid-filter state, and no register or picker request is issued.
- **Files modified:** `risk-schema.ts`, `risk-schema.test.ts`, `risk-register.tsx`, `page.tsx`, `risk-register-page.test.tsx`, `05-UI-SPEC.md`
- **Verification:** Focused schema, service, component, and page tests plus strict typecheck and generated API drift check.
- **Committed in:** Post-review CR-01 remediation commit.

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** Restores the intended fail-closed validated date-filter contract without addressing unrelated review warnings.

## Issues Encountered

- The global `pnpm` PowerShell shim launched Node 22 despite the active Node 24.19.0 runtime. All authoritative verification used Node 24.19.0's Corepack entry point, matching the locked project runtime.
- `risk-service.ts` required no production edit because it already sends `serializeRiskRegisterQuery` output directly through the generated client; the new schema projection and service assertion completed the planned typed transport behavior.

## Known Stubs

None. Stub-pattern matches were established safe not-found copy, nullable domain handling, or test initialization; none are placeholder UI or unwired data.

## Verification

- `corepack pnpm --filter @csrm/web typecheck` - PASS.
- `corepack pnpm --filter @csrm/web exec vitest run src/features/risks/risk-register.test.tsx src/features/risks/risk-schema.test.ts src/features/risks/risk-service.test.ts src/features/risks/risk-register-page.test.tsx` - PASS, 55/55 tests.
- `corepack pnpm --filter @csrm/web api:check` - PASS; generated schema remains stable.
- UI contract scan - PASS; both canonical parameters, controls, chips, active count, page reset, individual/paired/global clearing, retained sort/page size, loading persistence, responsive placement, labels, and evidence are specified with no surviving omission claim.
- TDD gate ordering - PASS; each failing test commit precedes its corresponding feature commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete RISK-01 backend, generated transport, URL, and responsive UI date-filter contract is ready for Plan 05-12 final gap-closure verification.
- Phase 5 remains in progress; this plan does not mark it complete or start Phase 6.

## Self-Check: PASSED

- All nine implementation, test, route, and contract files recorded for Plan 05-11 exist.
- All four TDD task commits exist in git history in RED-then-GREEN order.
- The strict typecheck, 55 focused tests, generated API drift check, UI contract scan, and protected dirty-file check pass.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*

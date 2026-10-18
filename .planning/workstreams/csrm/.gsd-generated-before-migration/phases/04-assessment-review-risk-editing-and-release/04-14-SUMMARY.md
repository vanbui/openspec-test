---
phase: 04-assessment-review-risk-editing-and-release
plan: "14"
subsystem: ui
tags: [nextjs, server-components, requestor, dashboard, accessibility, vitest]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: strict owner-scoped released assessment list and rating-summary services
  - phase: 04-assessment-review-risk-editing-and-release
    provides: immutable Requestor assessment routes and semantic RiskRatingBadge
provides:
  - Owner-scoped released assessment count and rating summary on the Requestor dashboard
  - Five-item bounded released assessment projection with encoded immutable detail links
  - Fail-closed permission, transport, empty, approval-only, and populated dashboard coverage
affects: [phase-04-e2e, requestor-dashboard, assessment-release]

tech-stack:
  added: []
  patterns: [parallel typed dashboard composition, discriminated released projection, semantic rating summary]

key-files:
  created: []
  modified:
    - apps/web/src/features/dashboard/requestor-dashboard-service.ts
    - apps/web/src/features/dashboard/requestor-dashboard.tsx
    - apps/web/src/features/dashboard/requestor-dashboard.test.tsx

key-decisions:
  - "Use the owner-scoped rating-summary total as the released dashboard count while bounding rendered recent assessment DTOs to five."
  - "Treat any released list or rating-summary permission or transport failure as a dashboard permission/error state rather than an empty success."
  - "Construct read-only assessment links from encoded opaque document IDs and never derive releases from approved request records."

patterns-established:
  - "Authoritative release dashboard: typed Requestor list plus rating summary -> discriminated empty/populated projection -> read-only widget."
  - "Rating communication: every Low, Moderate, High, and Critical count uses the shared icon-and-label badge plus tabular numeric count."

requirements-completed: [ASSESS-05]

duration: 5min
completed: 2026-08-30
---

# Phase 4 Plan 14: Requestor Released Assessment Dashboard Summary

**The Requestor dashboard now shows the authoritative owner-scoped released total, exhaustive rating summary, and five recent assessments with encoded immutable detail links.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-30T01:53:40Z
- **Completed:** 2026-08-30T01:58:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced the deliberate contract-unavailable seam with parallel calls to the strict Requestor released list and rating-summary services.
- Preserved existing draft-request and questionnaire projections while keeping released permission, transport, empty, and populated outcomes distinct and fail-closed.
- Added a responsive semantic-token widget with all four rating categories, five bounded recent items, encoded opaque assessment links, release dates, and no mutation surface.
- Proved that generic approved requests never become released assessments and that released service failures never degrade into empty success.

## Task Commits

1. **Task 1 RED: Specify released dashboard projection** - `148504c` (test)
2. **Task 1 GREEN: Project owner-released dashboard data** - `57accbb` (feat)
3. **Task 2 RED: Specify released dashboard widget** - `c810b77` (test)
4. **Task 2 GREEN: Render released assessment dashboard widget** - `dd830e9` (feat)

## Files Created/Modified

- `apps/web/src/features/dashboard/requestor-dashboard-service.ts` - Owner-released list/rating composition, discriminated projection, five-item bound, encoded domain links, and fail-closed mapping.
- `apps/web/src/features/dashboard/requestor-dashboard.tsx` - Responsive released count, rating summary, recent items, immutable navigation, and deliberate empty presentation.
- `apps/web/src/features/dashboard/requestor-dashboard.test.tsx` - Owner-service, no-inference, bounded projection, state, accessible rating, encoded-link, and existing-widget regression proof.

## Decisions Made

- The server-provided rating-summary total is the only released count; the UI does not reconstruct it from requests or the bounded recent list.
- Released service 403s map to the existing permission state, while malformed/unavailable results map to the existing error state; neither becomes an empty dashboard.
- Recent links are rebuilt from the returned opaque document ID with `encodeURIComponent` at the rendering boundary and expose no edit, mutation, or release affordance.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused Requestor dashboard suite: PASS, 2/2 tests.
- Full plain web Vitest suite: PASS, 157/157 tests across 25 files.
- Strict TypeScript: PASS with `pnpm typecheck`.
- Generated API drift: PASS with `pnpm api:check`.
- Frozen contract/model guard: PASS, no change to `specification.json`, generated schema output, or any Strapi `schema.json`.
- Catalogue integrity: PASS, authoritative and bootstrap catalogues remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Boundary scan: PASS, no raw fetch, frontend API facade, owner input, approval inference, mutation affordance, dependency, or hard-coded brand colour was introduced.
- Test integrity: PASS, no skip, todo, RED sentinel, runner-argument mutation, conditional assertion bypass, or early return was added.

## Known Stubs

None. Empty arrays are deliberate typed defaults or authoritative empty states and never substitute for failed released reads.

## Threat Flags

None. The plan adds no endpoint, authentication path, file access pattern, schema change, or new trust boundary.

## Self-Check: PASSED

- All three plan-owned files and this summary exist.
- All four RED/GREEN task commits exist in repository history in the required order.
- Focused and full web verification, strict TypeScript, generated API drift, frozen schemas, catalogue parity, and boundary/test-integrity scans pass.

## Next Phase Readiness

- The Requestor dashboard now consumes the released list/detail journey established by Plans 04-11 and 04-16.
- Phase 4 end-to-end closure can verify Bob release to Jane dashboard/detail without any dashboard release inference.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

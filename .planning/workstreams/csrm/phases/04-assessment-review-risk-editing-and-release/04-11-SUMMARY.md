---
phase: 04-assessment-review-risk-editing-and-release
plan: "11"
subsystem: ui
tags: [nextjs, server-components, requestor, read-only, accessibility, vitest]

requires:
  - phase: 04-assessment-review-risk-editing-and-release
    provides: strict Requestor released DTOs and owner-scoped assessment, Risk, and ControlImplementation service reads
  - phase: 04-assessment-review-risk-editing-and-release
    provides: semantic RiskRatingBadge and released analyst workflow output
provides:
  - Owner-scoped released assessment inventory with encoded detail navigation
  - Purpose-built immutable released assessment detail presentation
  - Fail-closed permission, unavailable, not-found, loading, and error route states
affects: [04-12, 04-14, phase-04-e2e, requestor-dashboard]

tech-stack:
  added: []
  patterns: [Requestor-only service composition, fail-closed aggregate rendering, immutable DTO presentation]

key-files:
  created:
    - apps/web/src/features/assessments/released-assessment.tsx
    - apps/web/src/features/assessments/released-assessment.test.tsx
    - apps/web/app/(app)/app/assessments/page.tsx
    - apps/web/app/(app)/app/assessments/loading.tsx
    - apps/web/app/(app)/app/assessments/error.tsx
    - apps/web/app/(app)/app/assessments/[documentId]/page.tsx
    - apps/web/app/(app)/app/assessments/[documentId]/loading.tsx
    - apps/web/app/(app)/app/assessments/[documentId]/error.tsx
  modified: []

key-decisions:
  - "Consume only the current strict owner-released service projections; never infer release from status or enrich missing contract fields in the UI."
  - "Discard the complete presentation if any released descendant read is forbidden, missing, malformed, or unavailable."
  - "Keep the Requestor presentation structurally separate from analyst editors and expose no form, mutation, disabled-control, or release affordance."

patterns-established:
  - "Released aggregate composition: assessment release read -> released Risk read -> released ControlImplementation reads -> render only after every boundary succeeds."
  - "Immutable presentation: semantic definitions and cards over strict DTOs with no client state or action surface."

requirements-completed: [ASSESS-05]

duration: 6min
completed: 2026-08-30
---

# Phase 4 Plan 11: Requestor Released Assessment Views Summary

**Owner-scoped released assessment inventory and immutable detail pages now render authoritative Risk and mitigation data only after every Requestor release boundary succeeds.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-30T01:43:41Z
- **Completed:** 2026-08-30T01:50:36Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a responsive released assessment inventory with encoded opaque identifiers, semantic rating icons and labels, and deliberate loading, empty, permission, and error states.
- Added a purpose-built immutable detail presentation for strict released metadata, compact Risks, and ControlImplementations without importing or imitating analyst controls.
- Composed only the Requestor-specific released service exports and withheld the entire aggregate for forbidden, prerelease, cross-owner, missing, malformed, or incomplete descendant results.
- Added route-level loading and recoverable error boundaries plus `notFound` handling for missing authoritative records.

## Task Commits

1. **Task 1 RED: Specify owner-released assessment views** - `12e12f1` (test)
2. **Task 1 GREEN: Add owner-released assessment inventory** - `64385a1` (feat)
3. **Task 2 RED: Specify released assessment detail route** - `44c77d5` (test)
4. **Task 2 GREEN: Add immutable released assessment detail** - `1f9efb9` (feat)
5. **Rule 1 fix: Preserve semantic assessment definitions** - `68c13d0` (fix)

## Files Created/Modified

- `apps/web/src/features/assessments/released-assessment.tsx` - Separate responsive inventory, immutable detail, safe states, and concrete skeletons.
- `apps/web/src/features/assessments/released-assessment.test.tsx` - Inventory, route boundary, released field, immutability, sensitive-data discard, and state coverage.
- `apps/web/app/(app)/app/assessments/page.tsx` - Owner-released inventory Server Component using only `listMyReleasedAssessments`.
- `apps/web/app/(app)/app/assessments/loading.tsx` - Concrete released inventory loading state.
- `apps/web/app/(app)/app/assessments/error.tsx` - Recoverable released inventory route error boundary.
- `apps/web/app/(app)/app/assessments/[documentId]/page.tsx` - Fail-closed owner-released detail and descendant composition.
- `apps/web/app/(app)/app/assessments/[documentId]/loading.tsx` - Concrete released detail loading state.
- `apps/web/app/(app)/app/assessments/[documentId]/error.tsx` - Recoverable released detail route error boundary.

## Decisions Made

- The current strict released projection is the sole UI data source. The page does not reconstruct affected assets, likelihoods, treatment fields, resolved reusable Control names, or other richer Section 8 values that the frozen current projection does not expose.
- A failure in any descendant read discards already loaded assessment and Risk data before presentation; partial aggregate rendering could disclose sensitive risk information.
- Opaque Control references are rendered exactly as supplied by the bounded ControlImplementation DTO rather than joining against the analyst-only control library.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Normalized absent redacted error statuses**
- **Found during:** Task 2 verification
- **Issue:** Strict TypeScript identified that normalized transport failures may omit an HTTP status.
- **Fix:** Map absent statuses to the generic safe error state while retaining exact 403 permission and 404 not-found behavior.
- **Files modified:** `apps/web/app/(app)/app/assessments/[documentId]/page.tsx`
- **Verification:** Focused released-view tests and strict TypeScript pass.
- **Committed in:** `1f9efb9`

**2. [Rule 1 - Bug] Restored semantic definition-list structure**
- **Found during:** Final accessibility verification
- **Issue:** Assessment overview terms and descriptions were visually grouped but lacked their required `dl` ancestor.
- **Fix:** Wrapped the complete metadata grid in a semantic definition list without changing presentation behavior.
- **Files modified:** `apps/web/src/features/assessments/released-assessment.tsx`
- **Verification:** Focused and full web test suites plus strict TypeScript pass.
- **Committed in:** `68c13d0`

---

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 markup bug).
**Impact on plan:** Both fixes preserve fail-closed behavior and accessibility without widening the frozen transport, schema, dependency, or authorization surface.

## Issues Encountered

- The current frozen released Risk projection is intentionally compact and does not expose every richer Section 8 domain field. The implementation consumes and tests every field available from the current released assessment, Risk, and ControlImplementation service outputs and does not invent competing UI data.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused released assessment suite: PASS, 9/9 tests.
- Full plain web Vitest suite: PASS, 157/157 tests across 25 files.
- Strict TypeScript: PASS with `pnpm typecheck`.
- Generated API drift: PASS with `pnpm api:check`.
- Frozen contract/model guard: PASS, no change to `specification.json`, generated schema output, or any Strapi `schema.json`.
- Catalogue integrity: PASS, authoritative and bootstrap catalogues remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- Boundary scan: PASS, no raw fetch, frontend API facade, analyst editor, mutation action, dependency, hard-coded brand colour, or client-side release inference was introduced.
- Test integrity: PASS, no skip, todo, RED sentinel, runner-argument mutation, conditional assertion bypass, or early return was added.

## Known Stubs

None. Empty collections are deliberate safe-state defaults and populated routes always supply authoritative service data.

## Self-Check: PASSED

- All eight plan-owned files exist.
- All five RED/GREEN/fix commits exist in repository history in the required order.
- Both task acceptance gates and plan-level verification pass against the current strict released-page output.

## Next Phase Readiness

- Plan 04-14 can exercise the Requestor released list/detail journey against these current route outputs.
- A future contract decision is required before richer Section 8 Risk fields can be displayed; this plan leaves the frozen schema and catalogues unchanged.

---
*Phase: 04-assessment-review-risk-editing-and-release*
*Completed: 2026-08-30*

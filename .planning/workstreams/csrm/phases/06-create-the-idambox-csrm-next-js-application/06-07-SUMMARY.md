---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "07"
subsystem: ui-shell
tags: [nextjs, react, server-components, accessibility, capabilities, vitest]
requires:
  - phase: 06-04
    provides: Typed capability registry, server-only identity fixtures, and UI preflight
  - phase: 06-05
    provides: Semantic UI primitives and CSRM design tokens
  - phase: 06-06
    provides: Shared loading, forbidden, and unavailable state compositions
provides:
  - Server-first CSRM shell with fixed desktop header/sidebar geometry and semantic landmarks
  - Capability-filtered enabled navigation and a single foundation page hierarchy
  - Safe loading, unavailable, and non-production direct-route authorization outcomes
affects: [06-08-shell-islands, 06-09-browser-evidence, 07-requestor-request-workflow, 13-integration-and-hardening]
actuals:
  tokens: 4149
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns: [server-shell-composition, capability-filtered-navigation, safe-direct-route-preflight]
key-files:
  created:
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/sidebar.tsx
    - apps/csrm/src/app/test-evidence/analyst-only/page.tsx
  modified:
    - apps/csrm/src/app/layout.tsx
    - apps/csrm/src/app/page.tsx
    - apps/csrm/src/components/shell/shell.test.tsx
key-decisions:
  - "Keep the shell server-compatible and pass only serializable identity and route registry data into it."
  - "Render only enabled routes whose exact Function capability is effective; planned route definitions remain configuration-only."
  - "Use the routable non-production /test-evidence/analyst-only path because Next treats __test__ segments as private and omits them from builds."
patterns-established:
  - "Root layout resolves the trusted development identity server-side before rendering AppShell."
  - "Direct-route evidence calls shared preflight before any protected callback or content and returns fixed state UI for denial."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Server-rendered desktop shell with fixed landmark order, page hierarchy, and capability-filtered navigation.
    requirement: APP-06
    verification:
      - kind: unit
        ref: apps/csrm/src/components/shell/shell.test.tsx#renders-the-desktop-foundation-shell-and-filters-planned-navigation
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm check-types
        status: pass
    human_judgment: false
  - id: D2
    description: Shared loading/unavailable output and environment-gated analyst-only direct-route evidence without protected metadata.
    requirement: APP-06
    verification:
      - kind: unit
        ref: apps/csrm/src/components/shell/shell.test.tsx#loading-planned-route-analyst-only-production-evidence-route
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm build
        status: pass
    human_judgment: false
duration: 9 min
completed: 2026-08-09
status: complete
---

# Phase 06 Plan 07: Server CSRM Shell and Route States Summary

**Server-rendered CSRM desktop frame with exact capability-filtered navigation, semantic landmarks, and metadata-safe direct-route states.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-09T20:01:47+10:00
- **Completed:** 2026-08-09T10:10:57Z
- **Tasks:** 2/2
- **Files modified:** 12

## Accomplishments

- Resolved the development/test identity server-side in the root layout and composed a server-compatible AppShell with skip link, header, sidebar navigation, account context, and one-page-title main hierarchy.
- Filtered rendered navigation by exact enabled Function capability, leaving all planned groups and links absent for both Requestor and Security Analyst fixtures.
- Reused shared loading and unavailable states, then added a non-navigation analyst evidence route that denies Requestor access before content, presents neutral evidence only for the Analyst fixture, and calls `notFound()` before identity resolution in production.

## Task Commits

1. **Task 1: Navigate the foundation page through the desktop server shell** — `57f5e23` (test), `e6ef0fb` (feat)
2. **Task 2: Wire loading, unavailable, and forbidden direct-route states before data** — `30c7b45` (test), `2953c0e` (feat), `93b3ba4` (fix)

## Files Created/Modified

- `apps/csrm/src/app/layout.tsx` — resolves the safe server identity and wraps every page in AppShell.
- `apps/csrm/src/app/page.tsx` — renders the single neutral foundation page through PageHeader.
- `apps/csrm/src/app/{loading,not-found}.tsx` — reuse the shared state contract within the shell geometry.
- `apps/csrm/src/app/test-evidence/analyst-only/page.tsx` — non-production direct-route preflight evidence, excluded from navigation.
- `apps/csrm/src/components/shell/*` — server-first header, sidebar, group navigation, breadcrumbs, page header, and frame composition.
- `apps/csrm/src/components/shell/shell.test.tsx` — landmark, navigation, loading, authorization, and production route-gate coverage.

## Decisions Made

- Kept AppShell, page heading, breadcrumbs, and initial navigation free of client-wide state; Plan 06-08 owns interactive islands.
- Retained all future routes in the central registry as `planned`, while rendering only the enabled Dashboard destination after exact capability filtering.
- Replaced the plan's private `__test__` route segment with `/test-evidence/analyst-only` after a production build confirmed Next 16 omits `__test__` folders from its route manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced the ignored Next private route segment with a routable non-production evidence path**

- **Found during:** Task 2 (Wire loading, unavailable, and forbidden direct-route states before data)
- **Issue:** Next 16 excluded `src/app/__test__/analyst-only/page.tsx` from `.next/server/app`, so the required direct-route authorization evidence could never execute.
- **Fix:** Moved the route to `src/app/test-evidence/analyst-only/page.tsx`, retained its omission from navigation, exact `function.administration.controls` guard, and production `notFound()` gate before identity or content work.
- **Files modified:** `apps/csrm/src/app/test-evidence/analyst-only/page.tsx`, `apps/csrm/src/components/shell/shell.test.tsx`
- **Verification:** Focused Requestor/Analyst/production tests, strict type check, lint, and webpack build pass; the build manifest contains the corrected route.
- **Committed in:** `93b3ba4`

**Total deviations:** 1 auto-fixed (Rule 1).
**Impact on plan:** The intended direct-route evidence works in development/test and remains unavailable in production, without a config hack, package change, navigation entry, or production capability.

## Verification

- `yarn workspace @idambox/csrm test` — pass (7 files, 42 tests).
- `yarn workspace @idambox/csrm check-types` — pass.
- `yarn workspace @idambox/csrm lint` — pass.
- `yarn workspace @idambox/csrm build` — pass; output contains `/test-evidence/analyst-only`.
- `git diff --exit-code -- apps/csrm/package.json yarn.lock` — pass; no dependency or lockfile change.

## Known Stubs

None.

## Next Phase Readiness

- Plan 06-08 can add only the approved interactive shell islands while preserving the server identity, capability filtering, and direct-route preflight boundary.
- Plan 06-09 can exercise the desktop and responsive shell in a browser using the routable non-production evidence surface.

## Self-Check: PASSED

- Confirmed all shell, route-state, and evidence files exist.
- Confirmed all five task commits are present in git history.

---
*Phase: 06-create-the-idambox-csrm-next-js-application*
*Completed: 2026-08-09*

---
phase: 07-requestor-request-workflow
plan: "07"
subsystem: ui
tags: [nextjs, react, vitest, accessibility, request-workflow, strapi]
requires:
  - phase: 07-requestor-request-workflow
    provides: Owner-bound request service, dashboard endpoint, safe Server Actions, form, and request details lifecycle.
provides:
  - URL-driven My Requests discovery with protected typed-service loading and responsive semantic presentation.
  - Action-first Requestor dashboard displaying only sanitized owner-bound workflow data.
  - Shared textual request-status treatment and server-side allowed sort/query alignment.
affects: [07-08-integration-hardening, csrm-request-workflow]
actuals:
  tokens: 11537
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns:
    - Server Components preflight route capability and actor before calling typed request services.
    - Client list controls mutate only URL state and refresh server-rendered owner-bound data.
    - Dashboard widgets use independent safe retry affordances while preserving successful request data.
key-files:
  created:
    - apps/csrm/src/app/requests/page.tsx
    - apps/csrm/src/features/requests/request-list.tsx
    - apps/csrm/src/features/requests/request-status-badge.tsx
    - apps/csrm/src/features/requests/request-dashboard.tsx
  modified:
    - apps/csrm/src/app/page.tsx
    - apps/csrm/src/config/routes.ts
    - apps/csrm/src/lib/api/csrm-service.ts
    - apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts
key-decisions:
  - "Keep filters, pagination, and sort shareable in the URL while leaving request data loading and authorization server-side."
  - "Use one exhaustive textual status badge mapping across request lists and dashboard widgets."
  - "Map approved UI sort choices to the protected backend allowlist rather than sorting owner data in the browser."
patterns-established:
  - "List table and mobile cards expose the same named request links and textual status data."
  - "Action-first dashboard widgets consume only the dashboard service response and do not fabricate later-phase workflow content."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: My Requests supplies normalized URL filters, exact sort choices, responsive table/card parity, labelled pagination, and safe empty/error states.
    requirement: CSRM-05
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/features/requests/request-list.test.tsx
        status: pass
      - kind: integration
        ref: yarn workspace @idambox/csrm test:unit --run src/lib/api/csrm-service.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Dashboard renders action-first owner-bound request widgets, status links, exact empty copy, retry states, and responsive semantic layout.
    requirement: CSRM-05
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/features/requests/request-dashboard.test.tsx
        status: pass
    human_judgment: false
duration: 9m
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 07: Request Discovery and Dashboard Summary

**Owner-bound My Requests discovery and an action-first dashboard with server preflight, shareable filters, responsive semantics, and accessible status workflow cues.**

## Performance

- **Duration:** 9m
- **Started:** 2026-08-22T14:53:30Z
- **Completed:** 2026-08-22T15:02:02Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Enabled the My Requests route and added protected server loading with normalized keyword, status, sort, and pagination URL state.
- Delivered the required semantic desktop table and separate mobile request cards, including textual status badges, concise announcements, bounded pagination, and exact empty/error states.
- Replaced the foundation home page with the four locked Requestor dashboard widgets: Needs your attention, Recently submitted, Request status, and Notifications.
- Corrected the typed request service and protected backend sort/query contract so UI filters reach the owner-enforced list endpoint.

## Task Commits

1. **Task 1: Deliver URL-driven My Requests with desktop table and mobile cards** — `cf06eee` (RED coverage), `4547c8c` (implementation).
2. **Task 2: Replace the foundation page with the action-first Requestor dashboard** — `0035249` (RED coverage), `10aef6b` (implementation).
3. **Verification remediation** — `bd58cae` (lint-safe URL-state synchronization and Phase 7 assertion updates).

## Files Created/Modified

- `apps/csrm/src/app/requests/page.tsx` — server-side route preflight, normalized list query, and typed owner-bound service load.
- `apps/csrm/src/features/requests/request-list.tsx` — URL-controlled filters, semantic table/mobile cards, announcements, states, and pagination.
- `apps/csrm/src/features/requests/request-status-badge.tsx` — exhaustive textual status labels with semantic token treatments.
- `apps/csrm/src/app/page.tsx` and `apps/csrm/src/features/requests/request-dashboard.tsx` — action-first Requestor dashboard and safe widget states.
- `apps/csrm/src/lib/api/csrm-service.ts` and `apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts` — approved list query and sort mapping at the typed protected boundary.

## Decisions Made

- Kept all list query updates in the URL and reset pagination whenever keyword, status, or sort changes.
- Used backend-supported `updatedAt`/`title` sort values to keep sorting owner-bound and avoid browser-side authorization or whole-collection logic.
- Kept notifications empty unless the dashboard response provides real workflow notices; no questionnaire, risk, or assessment data is fabricated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned the typed list service with the protected workflow query contract**
- **Found during:** Task 1
- **Issue:** The existing typed service emitted generic Strapi `_q`/`filters[...]` query keys, while the protected workflow service accepts allowlisted `keyword`, `status`, `sort`, `page`, and `pageSize` keys. It also could not express the required UI sort choices.
- **Fix:** Mapped the three approved UI sorts to backend allowlist values and extended the backend allowlist to match the approved D-12 sorts.
- **Files modified:** `apps/csrm/src/lib/api/csrm-service.ts`, `apps/csrm/src/lib/api/csrm-service.test.ts`, `apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts`
- **Verification:** Focused request-list/service tests, lint, type checks, OpenAPI drift, capability verification, and backend type checks passed.
- **Committed in:** `4547c8c`

**2. [Rule 1 - Bug] Replaced effect-driven filter synchronization rejected by the lint gate**
- **Found during:** Plan closeout
- **Issue:** Synchronously setting client query state inside an effect triggered the React hooks lint rule.
- **Fix:** Keyed the client list by server-normalized URL state so browser back/forward remounts the controlled input without a cascading state effect.
- **Files modified:** `apps/csrm/src/app/requests/page.tsx`, `apps/csrm/src/features/requests/request-list.tsx`
- **Verification:** Targeted tests, lint, and strict TypeScript passed.
- **Committed in:** `bd58cae`

**Total deviations:** 2 auto-fixed Rule 1 issues.
**Impact on plan:** Both changes were required for the specified protected list behavior and verification gates; no package or unrelated feature scope was added.

## Known Stubs

None.

## Issues Encountered

- The full `yarn workspace @idambox/csrm verify` remains blocked only by the three pre-existing capability-count assertions documented in `deferred-items.md`; they expect 23 capabilities while the committed catalogue and authoritative capability verifier report 27. This plan does not own capability vocabulary or fixture identity counts.

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-list.test.tsx src/features/requests/request-dashboard.test.tsx src/lib/api/csrm-service.test.ts src/domain/route-access.test.ts apps/csrm/src/config/capabilities.test.ts src/styles/tokens.test.ts` — passed (22 tests).
- `yarn workspace @idambox/csrm lint` — passed.
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm verify:openapi` — passed (105 operations).
- `yarn workspace @idambox/csrm verify:capabilities` — passed (27 Functions, 23 routes).
- `yarn workspace backend check-types` — passed.
- `yarn workspace @idambox/csrm verify` — not fully green solely because of the three unrelated, already-deferred stale capability-count tests above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07-08 can use the enabled My Requests route and data-driven dashboard for real-stack responsive and production-boundary evidence.

## Self-Check: PASSED

Confirmed all eight planned UI artifacts and the summary exist, and all five implementation/test commits are present in Git history.

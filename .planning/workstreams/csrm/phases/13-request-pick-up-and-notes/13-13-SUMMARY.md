---
phase: 13-request-pick-up-and-notes
plan: 13
subsystem: navigation
tags: [assigned-to-me, review-queue, navigation-counts, quick-find, route-guards, playwright, axe, performance-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the queue's open bucket, filters[assignee]=me|unassigned, the item's assignee, meta.viewer, countReviewQueue(queue, { assignee }) and AssessmentRequestList's showAssignee (13-12); Sam Analyst and the Second Security Analyst sign-in (13-07); the assign picker (13-09)
  - phase: 11-navigation-landing-and-list-clarity
    provides: the navigation profile, NavigationCountKey, navigationCountMeaning, loadNavigationCounts, page-headings.ts, quick find and the navigation-and-home and quick-find specs
provides:
  - The Assigned to me route /app/review/assigned (page, loading, error), AssignedRequestListContent, AssignedRequestListHeader
  - AssessmentRequestList's view prop ('requests' | 'assigned'), AssessmentRequestListSkeleton({ view }), each view's own default queue
  - parseAssessmentRequestReviewQuery(params, defaultQueue)
  - The Assigned to me navigation item (first in Assessment work) with assignedToMeNeedingAction; requestsWaitingForPickUp replacing requestsRequiringAttention
  - quickFindRequestLine and the analyst Requests options' holder line
  - REQ08_ASSIGNED_TO_ME_VIEW and REQ08_QUICK_FIND_NAMES_ASSIGNEE @journey at 1440 and 375
affects: [13-14, 13-19]
actuals:
  tokens: 21800
  tasks: 3
  commits: 5
plan_head_before: 970efe576ba98ebd894b67b7ec8c0ab64d6937ad
plan_head_after: 7712ff1c2a20d1bd411b2f5956cf8076f792a3d1
tech-stack:
  added: []
  patterns:
    - "A queue view fixes its scope on the server (filters[assignee]=me) and hands the list a query without it, so the scope is never a chip, a control or a URL value"
    - "Each queue view owns its default queue: the URL leaves it out, Clear filters returns to it and a missing or unknown queue parses to it"
key-files:
  created:
    - apps/csrm/app/(app)/app/review/assigned/page.tsx
    - apps/csrm/app/(app)/app/review/assigned/loading.tsx
    - apps/csrm/app/(app)/app/review/assigned/error.tsx
  modified:
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/assessments/assessment-list.test.tsx
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/config/navigation/navigation.ts
    - apps/csrm/src/config/navigation/navigation.test.ts
    - apps/csrm/src/config/navigation/page-headings.ts
    - apps/csrm/src/config/navigation/page-boundaries.test.tsx
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
    - apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
    - apps/csrm/src/components/shell/navigation-counts.ts
    - apps/csrm/src/components/shell/navigation-counts.test.ts
    - apps/csrm/src/components/shell/mobile-navigation.test.tsx
    - apps/csrm/src/features/quick-find/quick-find-domain.ts
    - apps/csrm/src/features/quick-find/quick-find-actions.ts
    - apps/csrm/src/features/quick-find/quick-find-actions.test.ts
    - apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/quick-find.spec.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
key-decisions:
  - "Assigned to me's scope is fixed in the page (assignee: 'me' sent to Strapi, which resolves it to the policy's viewer) and stripped from the query the list sees, so a URL ?assignee=unassigned can neither widen it nor appear as a chip."
  - "AssessmentRequestList gains a view prop ('requests' | 'assigned') rather than separate default-queue and empty-copy props: one switch gives the view its default queue (All open), its empty copy, and no Assigned to column, filter or card holder line."
  - "parseAssessmentRequestReviewQuery takes the view's default queue, so a missing or unknown queue is All open on Assigned to me and Requires attention on Requests (unchanged)."
  - "The error boundary reads `We couldn’t load the requests assigned to you.` under the Assigned to me heading (the Requests route's locked structure, with the view as the area); the list's permission state keeps the locked `assessment requests` area."
  - "Assigned to me's count and the changed Requests count stay client-resolved (navigationCountMeaning in the client navigation module): every route measured within budget, so the plan's server-side-meanings fallback was not needed."
  - "The Assigned to me count's equal list is /app/review/assigned?queue=requires-attention and the Requests count's is /app/review/requests?assignee=unassigned (default queue); the sidebar opens each page unfiltered (UI-D7)."
  - "REQ-08 stays Pending until the phase gate, as in 13-03 to 13-12."
patterns-established:
  - "AssessmentRequestList({ view: 'assigned' }) for a person-scoped queue view; AssessmentRequestListSkeleton({ view }) for its column count"
requirements-completed: []
coverage:
  - id: D1
    description: "Assigned to me (/app/review/assigned): heading equals label, the description, filters[assignee]=me fixed and never a chip or control, All open by default, search, status, queue and notes, nine columns without Assigned to; cleared and filtered empty states; nine-column skeleton; error boundary"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the Assigned to me view (13-13)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx#Assigned to me reads only the viewer’s requests"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/config/navigation/page-boundaries.test.tsx#review/assigned/loading, review/assigned/error"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_ASSIGNED_TO_ME_VIEW @journey"
        status: pass
    human_judgment: false
  - id: D2
    description: "The analyst navigation leads Assessment work with Assigned to me (sidebar and drawer); Assigned to me counts the viewer's Requires attention requests (need your action), Requests counts those nobody holds (waiting for pick-up); zero, a failed and a refused read show no count; each count equals its list"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/navigation-counts.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#navigation counts"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_ANALYST_COUNTS_EQUAL_LISTS"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_DRAWER_COUNTS @journey"
        status: pass
    human_judgment: false
  - id: D3
    description: "Quick find's analyst Requests options read {status} · Assigned to {name} or {status} · Not picked up from the queue projection, with no new read; the Requestor's options are unchanged"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/quick-find/quick-find-actions.test.ts#shows five options of a larger group"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_QUICK_FIND_NAMES_ASSIGNEE @journey"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/quick-find.spec.ts#UX10_ANALYST_GROUPS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every key route stays within its delivered-JavaScript budget with no override; /app/risks/{documentId} 299,887 of 300,000 bytes"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/performance.spec.ts --project desktop (11 passed)"
        status: pass
    human_judgment: false
duration: 33min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 13: Assigned to me, the Assignment-Aware Counts and Quick Find's Holder Summary

**An analyst now opens `Assigned to me` (first in Assessment work, sidebar and drawer) to see the open requests they hold, the sidebar says how many of those need them and how many requests wait for anyone to pick up, and quick find names who holds each request. Every route stays inside its budget with no override.**

## Performance

- **Duration:** about 33 minutes (2026-10-08T23:18Z to 23:51Z), including three desktop performance runs and two runs of the three specs
- **Tasks:** 3 (Task 1 the tracer; Tasks 1 and 2 RED then GREEN)
- **Files changed:** 22 (3 created)

## Accomplishments

- **The view (D-14; UI-D6, UI-D10).**
  - `/app/review/assigned` sends `filters[assignee]=me` with the chosen queue, `All open` by default; the URL never carries the assignee.
  - `h1` and title `Assigned to me` from `page-headings.ts`; the description `Requests you’re accountable for, and what each needs next.`
  - Nine columns, no `Assigned to` filter, no card holder line, no `Pick up`; the notes filter and the X-17 unread line stay.
  - Default empty view: cleared `No open requests assigned to you` with where requests waiting for pick-up are, no action. Filtered: `No requests match these filters` with `Clear filters`, which returns to `All open`.
  - `loading.tsx` uses the nine-column skeleton; `error.tsx` keeps the Requests route's locked structure.
  - The page exports `AssignedRequestListContent`. It authorises before it reads, and reads before it resolves an E2E fixture.
- **Route guards.** The zod boundary classifies `(app)/app/review/assigned`. The route authorisation tables cover `AssignedRequestListContent`: it reads before its fixture, a 403 renders outside the fixture boundary, and a Requestor is refused before any read. The page boundaries carry `Assigned to me`, and the error boundary recovers.
- **Navigation and counts (D-14; Phase 11 D-09, D-11).**
  - `Assigned to me` (`UserRoundCheck`) is first in Assessment work, with `count: 'assignedToMeNeedingAction'`.
  - `Requests` carries `requestsWaitingForPickUp`, which replaces `requestsRequiringAttention`.
  - The link names are `Assigned to me, 3 need your action` or `1 needs your action`, and `Requests, 4 waiting for pick-up`.
  - `loadNavigationCounts` reads `countReviewQueue('requires-attention', { assignee: 'me' })` and `({ assignee: 'unassigned' })` in parallel. Each settles to a number or nothing, and a Requestor issues neither.
- **Quick find (D-13).** The analyst `Requests` options read `{status} · Assigned to {name}` or `{status} · Not picked up` (`quickFindRequestLine`), from the same queue read.

## Test Counts

- **Task 1.**
  - RED (`dbeccea`): web `Tests 19 failed | 598 passed`; 2 files could not import the missing route.
  - GREEN (`8402c9c`): web `Tests 685 passed` (21 files: navigation, mobile navigation, assessments, the zod boundary, route authorisation); typecheck and lint clean.
  - Tracer gate: the verify command's parts were re-run after the GREEN edits, before the commit (exit 0).
- **Task 2.**
  - RED (`93ea325`): web `Tests 15 failed | 242 passed`.
  - GREEN (`d6e5b75`): web `Tests 257 passed` (13 files: navigation, shell, quick find); typecheck and lint clean; `requestsRequiringAttention` is gone from `apps/csrm/src`.
- **Task 3 (`7712ff1`).**
  - The mobile list collects both new journeys (7 tests in `request-pick-up.spec.ts`).
  - Playwright `navigation-and-home`, `quick-find` and `request-pick-up`: **56 passed (desktop 34, mobile 22)**. The first run was before the commit; the second ran as the plan's verify command after it. Both passed, with no failure or flake.
  - `performance.spec.ts --project desktop`: **11 passed**.
  - The verify command exited 0 and `git status --short -- apps/csrm apps/backend/src docs` was empty after the run.
- **Full web unit suite:** `Test Files 188 passed`, `Tests 4127 passed`.
- **Strapi:** not run; this plan changes no Strapi source.

## Performance Budget (delivered JavaScript, desktop medians, `apps/csrm/.tmp/performance/baseline-desktop.json`)

| Route | After 13-12 (13-12-SUMMARY) | After Task 1 | Final (after Tasks 2 and 3) | Budget |
|---|---|---|---|---|
| `/app/risks/{documentId}` | 299,743 | 299,863 | **299,887** (113 bytes left) | 300,000 |
| `/app/requests/{documentId}` | 279,873 | 280,004 | 280,016 | 300,000 |
| `/app` (both actors) | n/a | 235,947 | 235,965 | 300,000 |
| `/app/requests` | n/a | 257,240 | 257,258 | 300,000 |
| `/app/risks` | n/a | 269,540 | 269,558 | 300,000 |
| `/app/reports/risk-exposure` | n/a | 261,447 | 261,465 | 300,000 |
| `/app/admin/controls` | n/a | 256,350 | 256,368 | 300,000 |
| `/app/review/assessments/{documentId}` | n/a | 317,226 | 317,245 | 460,000 (override, unchanged) |
| `/app/questionnaires/{documentId}` | n/a | 360,961 | 360,971 | 500,000 (override, unchanged) |
| `/app/review` | 231,276 | 231,276 | 231,276 | 300,000 |

- The new item, its icon, its count key and meaning added 144 bytes to the shell's first load: 120 in Task 1, 24 in Task 2.
- No source fix was needed. `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.
- The built client chunks show Turbopack drops unused exports: `routeTitle` is absent from the client bundle.
- **Watch for later plans:** the Risk detail has 113 bytes of headroom. If a later shell change breaches it, the plan's fallback still applies: the server's `loadNavigationCounts` resolves each count's meaning, so `navigationCountMeaning` and its strings leave the client graph while staying in `navigation.ts`.

## Task Commits

1. **Task 1 (tracer):** `dbeccea` (test, RED), `8402c9c` (feat, GREEN)
2. **Task 2:** `93ea325` (test, RED), `d6e5b75` (feat, GREEN)
3. **Task 3:** `7712ff1` (test)

## Phase 11 Assertions Changed Deliberately (13-UI-SPEC §16)

- **E2, `navigation-and-home.spec.ts`:**
  - `UX07_SECTIONS_PER_ACTOR` lists `Assigned to me` first in Assessment work.
  - `UX07_ANALYST_COUNTS_EQUAL_LISTS` names Requests `…waiting for pick-up` (was `need(s) attention`). It now proves Requests equals `/app/review/requests?assignee=unassigned`, and that Assigned to me's count (or a settled zero) equals `/app/review/assigned?queue=requires-attention`.
  - `UX07_DRAWER_COUNTS`: the message `the submitted fixture waits for pick-up`.
  - `UX07_REQUESTOR_NO_ANALYST_COUNTS` asserts no `Assigned to me` link.
- **E3, `quick-find.spec.ts`:** `UX10_ANALYST_GROUPS` asserts the analyst options' line 2 `Submitted · Not picked up`.
- **Unit tests renamed deliberately:** `requestsRequiringAttention` becomes `requestsWaitingForPickUp`, and `Requests, 9 need attention` / `Requests, 1 needs attention` become `… waiting for pick-up`. This touched `navigation.test.ts`, `navigation-counts.test.ts` and `mobile-navigation.test.tsx` (the sidebar, the drawer and the key-warning cases).

## Decisions Made

See `key-decisions` above. In brief:
- **Scope:** the scope is fixed on the server and stripped from the list's query.
- **One `view` switch:** a single prop gives the view its default queue, its empty copy and no holder column.
- **Default queue:** the parser takes the view's default queue.
- **Error copy:** the boundary says `We couldn’t load the requests assigned to you.`
- **Count meanings:** they stay on the client, because every route measured within budget.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `parseAssessmentRequestReviewQuery` takes a default queue (file outside the plan's list)**
- **Found during:** Task 1 GREEN.
- **Issue:** the query schema catches a missing or unknown queue to `requires-attention`, so the page could not open on `All open` and still treat an unknown queue safely.
- **Fix:** the parser reads its queue through a named `reviewQueueSchema` and falls back to the caller's default. Requests is unchanged.
- **Files modified:** `apps/csrm/src/features/assessments/assessment-service.ts`
- **Commit:** `8402c9c`

**2. [Test placement] The view's query proof lives in the route-authorisation test**
- The plan lists no test file of the page's own. "Sends `filters[assignee]=me` and `All open` by default; never takes the assignee from the URL; an unknown queue falls back to All open" is a new describe in `e2e-ui-state-route-authorization.test.tsx`, which already mocks `listAssessmentRequests` for `AssignedRequestListContent`.

---

**Total deviations:** 2 (one Rule 3 parser change, one test placement).
**Impact on plan:** every planned behaviour shipped. No content type, contract, catalogue or Strapi file changed, and no dependency was added.

## Issues Encountered

- **The harness's connection drop did not recur** in either run of the three specs or in the three performance runs.
- **Heredoc failure.** A Bash heredoc carrying a long Python edit failed (`unexpected EOF`), so the larger edits went through script files in the scratchpad, as 13-09 to 13-12 recorded.

## Threat Model Coverage

- **T-13-44 (accept):** Assigned to me is presentation. Strapi decides the queue read and resolves `filters[assignee]=me` to the policy's viewer (13-12). The page sends the fixed scope, so no URL value names another person.
- **T-13-45 (mitigate):** each count is one `pageSize=1` queue read with no polling. A failed or refused read hides only its own count (unit-proven).
- **T-13-SC:** no package was added.

## Known Stubs

None.

## Next Phase Readiness

- **For 13-14 (analyst Home):**
  - `Needs your action` equals `/app/review/assigned?queue=requires-attention` (E1).
  - `AssessmentRequestList({ view: 'assigned' })` serves that address.
  - The sidebar counts read the same predicates as `countReviewQueueBucket`.
- **For 13-19's walk:** check the drawer with the extra item at 375×812. `UX07_DRAWER_SAME_SECTIONS` passed: the last item still ends within 812px. Also check the nine-column Assigned to me table at 1440.
- **REQ-08** stays Pending until the phase gate.

## Self-Check: PASSED

---
phase: 11-navigation-landing-and-list-clarity
plan: 12
subsystem: ui
tags: [next-app-router, react, home, my-requests, holder, e2e-fixtures, served-operations, capabilities, axe, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-10: GET /v1/my_requests, listMyRequests, MyRequestItem and the status summary's byHolder; 11-11: My requests' holder filter (/app/requests?holder=…), myRequestNextStep and requestHolderPresentation; 11-07: overallRating on My risk assessments and requestTitle on the released summary; 11-02 and 11-03: Home at /app and the analyst Home's D-18 order; 11-06: createSubmittedRequest"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: LocalInstant and TimeZoneProvider; the shared state primitives and RetryableErrorState"
provides:
  - "features/home/requestor-home-service.ts: getRequestorHome() runs four owner-scoped reads in parallel (holder=requestor, holder=analyst, the released list by approvalDate:desc, the rating summary); a 403 on any read is permission-denied, all failing is error, otherwise each section settles on its own"
  - "features/home/requestor-home-presentation.ts (zod-free): RequestorHomeState, RequestorHomeSection<T>, emptyRequestorHome, requestorHomeCopy, needsActionItemView, withAnalystItemView, releasedItemView, ratingChipLinks, submittedAgo, sectionFooter, isFirstUse, ownRequestsCopy, ownRequestsRows"
  - "features/home/requestor-home.tsx: RequestorHome({ state, failedSection? }) with Needs your action, With the Security Analyst and Released assessments, RequestorHomeContent with its fixture ladder and partial, RequestorHomeSkeleton (three sections, status Loading Home)"
  - "features/home/home-section.tsx: HomeSection (the analyst DashboardWidget moved unchanged), HomeSectionFooter, HomeSectionSkeleton, homeGridClassName, homeRowClassName, homeLinkRowClassName, shared by both Homes"
  - "features/home/own-requests-panel.tsx: OwnRequestsPanel({ state, className? }), last on the analyst Home, in the left column from lg"
  - "e2e-ui-state.ts: resolveE2eRequestorHomePartial (requestor-home-with-analyst-error) replaces resolveE2eDashboardPartial"
  - "getMyRequestStatusSummary returns { statuses, byHolder } (MyRequestStatusSummary)"
  - "e2e: createDraftRequest(page, { title }); UX08_REQUESTOR_PHONE_FIRST_SCREEN, UX08_REQUESTOR_HOME_SPLIT, UX08_ANALYST_OWN_REQUESTS"
  - "Retired: features/dashboard/* (three files), listDashboardRequests, the request list parser and its parity grandfather entry (42 to 41), resolveE2eDashboardPartial; served-operations.json regenerated (the core list stays served with no web caller)"
affects: [11-13, 11-19, 11-21]

actuals:
  tokens: 55000
  tasks: 3
  commits: 7
plan_head_before: 1599c116bcc89da3de6b068c82c77a5dc9b4d48a
plan_head_after: f774d518c196e3edb3f756dfceb1143e3e722ff9

tech-stack:
  added: []
  patterns:
    - "A Home section is a typed RequestorHomeSection<T> (ready or unavailable), so each read fails, empties and bounds on its own, and the page error is only every read failing"
    - "One widget frame (HomeSection) for both Homes, so a section and a widget share their card, heading, description, footer and skeleton"
    - "A figure's link name begins with its visible text, and a flex row that draws no word break gets an explicit text node, so axe label-content-name-mismatch holds"

key-files:
  created:
    - apps/csrm/src/features/home/home-section.tsx
    - apps/csrm/src/features/home/requestor-home-service.ts
    - apps/csrm/src/features/home/requestor-home-presentation.ts
    - apps/csrm/src/features/home/requestor-home.test.tsx
    - apps/csrm/src/features/home/own-requests-panel.tsx
    - apps/csrm/src/features/home/own-requests-panel.test.tsx
  modified:
    - apps/csrm/src/features/home/requestor-home.tsx
    - apps/csrm/src/features/home/analyst-home.tsx
    - apps/csrm/src/features/home/home-page.test.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/testing/e2e-ui-state.ts
    - apps/csrm/src/lib/testing/e2e-ui-state.test.ts
    - apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.test.ts
    - apps/csrm/scripts/verify-shared-list-states.mjs
    - apps/csrm/playwright.config.ts
    - docs/references/served-operations.json
    - apps/csrm/e2e/helpers/requests.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/accessibility.spec.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/csrm/e2e/performance.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts
    - apps/csrm/e2e/design-system-conformance.spec.ts
    - apps/csrm/e2e/analyst-insights.spec.ts
  deleted:
    - apps/csrm/src/features/dashboard/requestor-dashboard.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard-service.ts

key-decisions:
  - "11-12: first use (Needs your action offers New request) is derived from the three section totals, with no extra read: every request is held by the Requestor, by the Security Analyst, or by no one once released (D-20), so three known-empty sections mean no request. An unavailable section is not known to be empty, and Needs your action then shows its cleared state, which offers no action"
  - "11-12: the capability assessment-request:read anchors to GET:/api/v1/my_requests, the read My requests and the Requestor Home now make; ADR 0004's rule is that each anchor is a served operation the web calls. Every identity holds it through the Requestor birthright (effective-access.ts adds the requestor roles to every user), so no actor's capabilities change and no grant changed"
  - "11-12: a section with nothing to show has no footer (no 'View all 0'); a truncated Released assessments says 'Showing {shown} of {total}' like the other two sections (the must-have truth; the UI-SPEC row lists only View all)"
  - "11-12: the partial selector applies whenever it resolves after the real reads, with or without __e2eState, as the analyst Home's Top alerts partial does"
  - "11-12: getMyRequestStatusSummary returns { statuses, byHolder }; the analyst Home reads byHolder now and 11-13's sidebar counts read it next"
  - "11-12: the grandfather backlog count ends at 41 (from 42): the request list parser retired with its last caller"

patterns-established:
  - "requestor-home-presentation.ts holds every Home word and href; components only lay out views"
  - "homeLinkRowClassName: the whole-row link (label, count, ChevronRight) for the Review queue and Your own requests"

requirements-completed: []

coverage:
  - id: D1
    description: "The Requestor Home leads with Needs your action from GET /v1/my_requests?holder=requestor: drafts (title, number and due date, the plain next step), returned drafts with their local date and reason, and questionnaires to answer with a linked next step, '{a} of {t} answered' and a named progress bar; ten shown with 'Showing 10 of 11' and 'View all 11 in My requests' to ?holder=requestor; no assessment field on any item"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/requestor-home.test.tsx#Requestor Home: Needs your action (six cases)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/home/requestor-home.test.tsx#getRequestorHome (two cases: the holder reads and no analyst read)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On a 375×812 phone the first content after the header (Home, its description, New request) is Needs your action, starting within the first screen and listing the saved draft; DOM order equals visual order; its View all total equals the list it opens"
    requirement: "UX-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_REQUESTOR_PHONE_FIRST_SCREEN ([desktop] and [mobile], both at 375×812)"
        status: pass
    human_judgment: false
  - id: D3
    description: "With the Security Analyst (five, 'Submitted today / 1 day ago / n days ago', the server's sentence never linked, View all to ?holder=analyst) and Released assessments (rating chips linking a count above zero to My risk assessments by overall rating, named '{Rating}: {n} released risk assessment(s)', zeros plain; five items with number, request title, local release date and rating or Not rated; View all in My risk assessments). At 1440 a draft sits under Needs your action and a submitted request under With the Security Analyst, side by side, each total equal to its list"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/requestor-home.test.tsx#Requestor Home: With the Security Analyst, Released assessments"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_REQUESTOR_HOME_SPLIT ([desktop])"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/design-system-conformance.spec.ts#asserts the documented repair points at mobile and desktop widths (E16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The five states: first use (New request only in Needs your action) and cleared sections, a compact error per section with Try again, the page error 'We couldn’t load your requests', the permission state with Return to sign in, and the three-section skeleton named Loading Home; the fixture ladder and the closed partial requestor-home-with-analyst-error resolve only after the real reads succeed, and a Requestor at /app issues no analyst read, fixture or partial"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/requestor-home.test.tsx#empty states, errors, permission and loading, guarded fixtures"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/testing/e2e-ui-state.test.ts#resolveE2eRequestorHomePartial"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx#gives a Requestor at /app the Requestor Home before any analyst read, analyst fixture or partial selector"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/design-system-conformance.spec.ts#renders every guarded dashboard state, ordinary-server boundary, and partial-widget recovery (E15, E17)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyst Home ends with Your own requests in the left column from lg: link rows 'Needs your action: n request(s)' and 'With the Security Analyst: n request(s)' (zero rows render) to My requests filtered by holder, footer links View My requests and New request, its own compact error; the skeleton has the eighth widget; each count equals the list it opens"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/own-requests-panel.test.tsx (four cases)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#ends with Your own requests…; loads as a labelled skeleton of four tiles and eight widgets"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_ANALYST_OWN_REQUESTS ([desktop])"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts (E6: the h2 order ends with Your own requests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The retired dashboard: features/dashboard, listDashboardRequests and its parser are gone; no web module calls GET /csrm-assessment-requests; served-operations.json lists the core list as served with no web caller; the parity backlog is 41; the copy guard scans features/home"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/contract-operation-chain.test.ts and contract-response-parity.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend served-operations:write (check mode, 8/8)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual quality of the new Requestor Home and Your own requests at 375 and 1440 (spacing, the chip tiles, wrapping of long titles and sentences)"
    verification: []
    human_judgment: true
    rationale: "The automated proofs read layout boxes, order and type tokens; whether the sections read well is a visual judgement for the 11-21 walkthrough and the UI review"

duration: 1h 39m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 12: The Requestor Home leads with what needs them Summary

**The Requestor Home is rebuilt on `GET /v1/my_requests`'s holder: Needs your action, then With the Security Analyst, then Released assessments with rating chips that open My risk assessments by overall rating. Each section is bounded, says `Showing {shown} of {total}` and links `View all {total}` to a list whose total equals it. Each has its own empty and error states and the new closed partial fixture, and a phone opens on Needs your action within the first screen. The analyst Home ends with Your own requests. The stored-status dashboard, its core-list read and its parity entry are retired, and `served-operations.json` is regenerated.**

## Performance

- **Duration:** 1 h 39 min. The wall clock includes three Playwright runs (the Home spec at 1.8 min, the three named specs at 5.0 min, and two full runs at 16.6 and 16.5 min), the served-operations write and check, and five full web suites.
- **Started:** 2026-10-03T11:17:10Z
- **Completed:** 2026-10-03T12:56:00Z
- **Tasks:** 3 of 3
- **Files changed:** 36: 6 created, 27 modified, 3 deleted.

## Accomplishments

- **Needs your action (D-19, D-22, UAT-004).**
  - The section reads `holder=requestor` and shows up to ten items.
  - A draft shows its title link, `{number} · Due {date}` (or `· No due date`) and the plain sentence `Complete and submit this request.`. The sentence is not linked, because its destination is the title's (UI-D17).
  - A returned draft adds `Returned to draft on {local date}. Reason: {reason}`.
  - A questionnaire item links `Answer and submit the questionnaire.` and shows `{a} of {t} answered` with a progress bar named `{a} of {t} questions answered`.
  - On a phone it is the first content after the header, starting within the first 812 px.
- **With the Security Analyst (D-20, D-21).**
  - The section reads `holder=analyst` and shows up to five items.
  - Each item shows `{number} · Submitted today`, `Submitted 1 day ago` or `Submitted {n} days ago`, from the server's `daysSinceSubmission`.
  - The server's sentence names the Security Analyst and is never linked.
- **Released assessments (D-35, X-10).**
  - The list `Released assessments by overall rating` shows the chips Low, Moderate, High and Critical.
  - A count above zero makes its chip a whole link to `/app/assessments?overallRating={Rating}`, named `{Rating}: {n} released risk assessment(s)`. A zero is plain.
  - Up to five items: the assessment number link, the request title, `Released {local date}`, and the rating badge or `Not rated`.
- **States (UI-SPEC §5.2, §5.4).**
  - Empty: first use (`No requests yet` with the only `New request`) or cleared (`No requests waiting for you`, `No requests with the Security Analyst`, `No released risk assessments yet` with the chips still shown, plain).
  - Each section has its own compact error with `Try again`.
  - Every read failing shows the page error `We couldn’t load your requests`.
  - A refused read shows `You don’t have access to your requests` with `Return to sign in`.
  - Loading is three section skeletons in the final grid, a status named `Loading Home`.
- **The partial fixture (D-23).** `__e2ePartial=requestor-home-with-analyst-error` resolves only under the attested harness and only after the real reads succeed. It fails With the Security Analyst alone.
- **Your own requests (D-18 item 7).**
  - The panel is last on the analyst Home, in the left column from lg.
  - Two whole-row links with a count and a `ChevronRight`, to My requests filtered by holder. Zero rows render.
  - Footer links `View My requests` and `New request`.
  - It fails on its own with `We couldn’t load your own requests`.
  - `AnalystHomeContent` reads `getMyRequestStatusSummary()` after its gate, beside the review summary.
- **Shared frame.** `HomeSection` is the analyst `DashboardWidget`, moved unchanged into `features/home` together with its footer and skeleton. The analyst dashboard imports it.
- **Retired.**
  - `features/dashboard/*`.
  - `listDashboardRequests`, the request list schema and parsers, `requestSortParams` and `RequestList`.
  - The `request.listDashboardRequests` parity entry: the grandfather backlog went from 42 to **41**.
  - `resolveE2eDashboardPartial`.
  - `grep -rn "client.GET('/csrm-assessment-requests'" apps/csrm/src` prints nothing.
  - **`served-operations.json` was regenerated** with the dev servers stopped. `GET:/api/csrm-assessment-requests` stays served, and its `webCallers` is gone. The only other change is `generatedAt`.

## Task Commits

1. **Task 1: The Requestor's Home opens on Needs your action (tracer, TDD)**
   - `5e870bc`: test(11-12), RED
   - `5967bc7`: feat(11-12), GREEN
2. **Task 2: With the Security Analyst, Released assessments, the states and the partial fixture; retire the old dashboard (TDD)**
   - `41a871e`: test(11-12), RED
   - `2710e26`: feat(11-12), GREEN
3. **Task 3: The analyst's own requests panel, the Home proofs at both widths, every journey (TDD)**
   - `e591e80`: test(11-12), RED
   - `8bb123d`: fix(11-12), the rating chip name (deviation 1)
   - `f774d51`: feat(11-12), GREEN

The ledger count is `git rev-list --count 1599c11..f774d51` = 7. Every commit carries the `Co-Authored-By: Claude Opus 5.5` trailer (checked per commit).

## TDD Gate Compliance

- **Task 1.** RED `5e870bc` comes before GREEN `5967bc7`.
  - The first RED run failed to load: `./requestor-home-service` did not exist. That is an invalid RED.
  - The RED commit therefore also carries the zod-free state types with `emptyRequestorHome`, and a `getRequestorHome` that returned `{ kind: 'error' }`. With those, 8 of 14 tests failed on the planned assertions:
    - the holder reads were never made;
    - no `Needs your action` region;
    - the Requestor case's `getRequestorHome` was called 0 times.
  - Tracer gate: the run was interactive, in end-of-phase mode, with an automated-only verify. The unit run (118/118) and the typecheck were re-run on the committed tree. `navigation-and-home.spec.ts` had passed 20/20 on functionally identical content: the only later change rewrote the service's call sites to the literal `holder: 'requestor'`. Task 2 started only after that.
- **Task 2.** RED `41a871e` comes before GREEN `2710e26`. 18 of 467 tests failed (5 of 24 files):
  - the two sections and their states were missing;
  - `resolveE2eRequestorHomePartial` was not exported;
  - `listDashboardRequests` was still defined;
  - the parity entry was stale;
  - the route test's partial order.
  - One test defect was fixed before the RED commit: the page error's own heading is an h2.
- **Task 3.** RED `e591e80` comes before GREEN `f774d51`. The commit carries an `OwnRequestsPanel` that rendered nothing, for the same load reason as Task 1. 10 of 131 tests failed (3 of 7 files):
  - no panel rows;
  - no summary read;
  - seven skeleton widgets instead of eight;
  - the source-order check;
  - the summary's return shape.
- **Fix `8bb123d`.** The target test failed first on `'Low0'` against the expected `'Low 0'`, then passed.
- The plan is `type: execute`, so no plan-level `tdd-red-evidence` record was produced. The failures above come from the RED runs' own output.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/features/home`) | 8 failed, 6 passed (14); 2 files |
| Task 1 GREEN (`src/features/home`, `src/features/analyst-dashboard`, zod boundary) | 6 files, 118/118; typecheck clean |
| Task 1 Playwright `navigation-and-home.spec.ts` | **20 passed: desktop 11, mobile 9; 0 failed, 0 flaky, 0 skipped; 1.8 min**; tree unchanged |
| Task 2 RED (home, requests, testing, performance, parity, chain) | 18 failed, 449 passed (467); 5 of 24 files |
| Task 2 GREEN (same paths, after the inventory write) | 24 files, 465/465; typecheck clean |
| `served-operations:write` (servers stopped) | 7 passed, 1 skipped by design (35 s) |
| Strapi served-operations check | **8/8, 35.2 s** |
| Task 2 full web suite | 2 failed on the first run (deviations 2 and 3), then **139 files, 3,047/3,047** |
| Task 3 RED (home, analyst-dashboard, request service) | 10 failed, 121 passed (131); 3 of 7 files |
| Task 3 GREEN (home, analyst-dashboard, requests, testing, performance, parity, chain) | 28 files, 556/556; typecheck clean |
| Playwright `navigation-and-home`, `design-system-conformance`, `analyst-insights` | **41 passed: desktop 32, mobile 9; 0 failed; 5.0 min**; tree unchanged |
| Full Playwright, first run | 119 passed, 2 failed (both `accessibility.spec.ts`, axe `label-content-name-mismatch` on the rating chips, deviation 1); 16.6 min (12:07:21Z to 12:23:56Z); tree unchanged |
| **Full Playwright, final run** (`pnpm --dir apps/csrm test:e2e`, production build) | **121 passed: desktop 104, mobile 17; 0 failed, 0 flaky, 0 skipped; 16.5 min** (12:32:22Z to 12:48:52Z). `git status --short` was identical before and after |
| **Full web suite** (final, committed tree) | **140 files, 3,056/3,056** (73.0 s) |
| `typecheck` / `lint` / `api:check` (final) | clean / clean / exit 0. `schema.d.ts` was refreshed with `git update-index --refresh` and not staged |
| Full Strapi suite | Not run: the plan edits no Strapi source and no specification. The inventory changed, so the served-operations check ran (8/8) |

- Before every Playwright run and both served-operations runs, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.
- The final run logged Next's known benign `The destination stream closed early` 184 times and one `failed-to-find-server-action`. 11-11 logged 164 and 1. No assertion reads them.
- After every commit, `git status --short` showed only the three operator items.

## Files Created/Modified

- **Home**
  - `home-section.tsx`: the shared frame.
  - `requestor-home-service.ts`, `requestor-home-presentation.ts` and `requestor-home.tsx`: the Requestor Home.
  - `own-requests-panel.tsx`: the analyst panel.
  - `analyst-home.tsx`: the summary read and the panel.
- **Analyst dashboard:** `analyst-dashboard.tsx` imports the frame, renders `ownRequests` last and has an eight-widget skeleton.
- **Requests**
  - `request-service.ts`, `request-schema.ts`: `listDashboardRequests` and the list parsers are removed; the summary returns `byHolder`.
  - `request-domain.ts`: `requestSortParams` and `RequestList` are removed.
- **Harness and guards**
  - `e2e-ui-state.ts`: the new selector.
  - `strapi-capabilities.ts`: the anchor.
  - `verify-shared-list-states.mjs`: the list-state target.
  - `playwright.config.ts`: a comment.
  - `served-operations.json`: regenerated.
- **Tests**
  - New: `requestor-home.test.tsx` and `own-requests-panel.test.tsx`.
  - Updated: `home-page.test.tsx`, `analyst-dashboard.test.tsx`, `request-service.test.ts`, `contract-response-parity.test.ts`, `e2e-ui-state.test.ts`, `e2e-ui-state-route-authorization.test.tsx`, `interface-copy-guard.test.ts` and `strapi-capabilities.test.ts`.
- **E2E**
  - `helpers/requests.ts` and `navigation-and-home.spec.ts`.
  - E6: `analyst-insights.spec.ts`.
  - E14: `accessibility.spec.ts`, `requestor-request-workflow.spec.ts`, `performance.spec.ts` and `assessment-release-workflow.spec.ts`.
  - E15 to E17: `design-system-conformance.spec.ts`.
- **Deleted:** `features/dashboard/requestor-dashboard.tsx`, `requestor-dashboard.test.tsx` and `requestor-dashboard-service.ts`. These deletions are intentional, in `2710e26`.

## Decisions Made

See `key-decisions`. The two with the most consequence:

- **First use is derived, not read.** Three known-empty holder sections mean no request (D-20). An unavailable section falls back to the cleared state, so the Home never offers an action it cannot stand behind.
- **The read capability's anchor moved to `GET /v1/my_requests`.** ADR 0004 anchors each capability to an operation the web calls. The web no longer calls the core list, so the chain test failed until the anchor moved. Every identity holds the new anchor through the Requestor birthright, so nobody's capabilities changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug caused by this plan] The rating chip links failed axe `label-content-name-mismatch`**
- **Found during:** Task 3, the first full Playwright run. `accessibility.spec.ts:305` and `:452` failed at `Requestor Home … has no axe violations`.
- **Issue:** The chip's flex row drew no word break between the badge and the count. The visible text therefore read `Moderate1`, which is not part of the name `Moderate: 1 released risk assessment` (WCAG 2.5.3). The unit test had pinned `'Moderate0'`.
- **Fix:** A `{' '}` text node between the badge and the count, as the Review queue rows already have. The unit test now pins `'Moderate 0'` and failed first.
- **Files modified:** `requestor-home.tsx`, `requestor-home.test.tsx`
- **Verification:** The final full run passed 121/121.
- **Committed in:** `8bb123d` (its own commit)

**2. [Rule 3 - Blocking] The capability anchor read a core-list call the web no longer makes**
- **Found during:** Task 2, the full web suite. `strapi-capabilities.test.ts` failed with `GET:/api/csrm-assessment-requests: expected false to be true`.
- **Issue:** `assessment-request:read` was anchored to the core list. Once `listDashboardRequests` was gone, the regenerated inventory listed no web caller for it.
- **Fix:**
  - The anchor is now `GET:/api/v1/my_requests`. The fixture adds it, and a new assertion proves the capability is withheld without it.
  - `effective-access.ts` grants the birthright's operations to every identity, so the capability set is unchanged for every actor.
  - No grant, Function, FunctionApi or role changed.
- **Files modified:** `strapi-capabilities.ts`, `strapi-capabilities.test.ts` (outside the plan's list)
- **Committed in:** `2710e26`

**3. [Rule 3 - Blocking] The shared list-state guard read the deleted dashboard**
- **Found during:** Task 2, the full web suite (`ENOENT … requestor-dashboard.tsx`).
- **Fix:** `listStateTargets` names `features/home/requestor-home.tsx` instead. It passes, because every Home state uses the shared primitives.
- **Files modified:** `apps/csrm/scripts/verify-shared-list-states.mjs` (outside the plan's list)
- **Committed in:** `2710e26`

**4. [Carry-over 11-10] `getMyRequestStatusSummary` returns `byHolder`**
- The function returns `{ statuses, byHolder }` (`MyRequestStatusSummary`).
- It had no caller left after the dashboard retired. The analyst Home reads it now, and 11-13 reads it next.
- `request-schema.ts` and `request-service.ts` are outside Task 3's list.
- **Committed in:** `f774d51`

**5. [TDD validity] Type contracts in two RED commits**
- `5e870bc` carries the state types and an unwired `getRequestorHome`.
- `e591e80` carries an `OwnRequestsPanel` that rendered nothing.
- Without them, the RED runs failed to load the modules, which is an invalid RED. Both were replaced in their GREEN commits.

**6. [Cleanup within the retirement] Dead request-list code removed**
- `requestListPayloadSchema`, `parseRequestListPayload`, `parseRequestDashboardListPayload`, `requestSortParams` and `RequestList` had no caller left.
- The core-list part of the serializer test in `request-service.test.ts` was removed with them, because the web no longer sends that query.
- `request-domain.ts` is outside the plan's list.

**7. [Shared frame scope] More than `DashboardWidget` moved to `home-section.tsx`**
- Its footer, skeleton, grid, row and link-row classes moved too, so the Requestor Home and Your own requests reuse them rather than copying them.
- The analyst dashboard's markup is unchanged.

**8. [Parity registry] `features/home/requestor-home-service.ts` declared**
- It is declared `no-direct-response-parser` in the parity inventory, in place of the deleted dashboard service.

**9. [Assertions changed beyond the plan's list]**
- `assessment-release-workflow.spec.ts`:
  - finds Jane's released item by its request title, because the item no longer shows the summary;
  - checks the shared `record-link` class instead of the old explicit link classes.
- `accessibility.spec.ts`: the Secondary Requestor's Home guard expects the first-use state, because she has no request.
- `design-system-conformance.spec.ts`:
  - the Requestor Home type scan waits for `Needs your action`, not `My Assessment Requests`;
  - `expectStateMeaning` names whose Home `/app` is in its messages.
- `requestor-request-workflow.spec.ts`: the old `Submitted` lifecycle-card link click became the With the Security Analyst `View all` click, which lands on `?holder=analyst` with the Show filter set.
- `strapi-capabilities.test.ts`: deviation 2.

**10. [Config comment] `playwright.config.ts`**
- Its project note now says the Home journeys also save a uniquely titled draft per project, because `UX08_REQUESTOR_PHONE_FIRST_SCREEN` runs in both projects.

---

**Total deviations:**
- 3 auto-fixed: 1 Rule 1 bug caused by this plan, 2 Rule 3 blockers.
- 1 carry-over.
- 6 recorded scope or assertion notes.

**Impact on plan:** Every must-have holds. There was no Strapi source, specification, content-type, grant, role or dependency change (D-01, D-02, T-11-SC).

## Issues Encountered

- **Heredocs in Git Bash.** Multi-line heredocs with long content failed with `unexpected EOF`, as 11-10 recorded. Edits went through the Edit tool or Python scripts in the session scratchpad, with a line-ending-aware helper. CRLF files kept CRLF.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.

## Known Stubs

None. The two RED type contracts were replaced in their GREEN commits, and a scan of `features/home` finds no placeholder.

## Threat Flags

None beyond the plan's threat model:
- **T-11-52.** The service calls only owner-scoped operations. The route and Home tests prove no analyst read, fixture or partial for a Requestor.
- **T-11-30.** Request items render `MyRequestItem` fields only, and a unit case asserts no assessment link on them.
- **T-11-31.** The partial selector is closed, gated on the attested harness and resolved after the reads.
- **The capability anchor (deviation 2).** It is presentation only. Strapi still authorises every read.

## User Setup Required

None.

## Next Phase Readiness

- **11-13:** `getMyRequestStatusSummary()` returns `byHolder` for the sidebar counts. `ownRequestsRows` and `requestHolderPresentation` hold the holder vocabulary.
- **11-19:** quick find can reuse `myRequestNextStep` and the Home's holder labels.
- **11-21:** coverage D7 (the visual read of both Homes) is for the walkthrough. My requests' 1440 overflow, from 11-11, is unchanged.
- `requirements.ready-ids` reports 0/1 ready for UX-08, because later Phase 11 plans declare it too. REQUIREMENTS.md is unchanged.

## Self-Check: PASSED

- The created files exist: `home-section.tsx`, `requestor-home-service.ts`, `requestor-home-presentation.ts`, `requestor-home.test.tsx`, `own-requests-panel.tsx` and `own-requests-panel.test.tsx`. `git ls-files apps/csrm/src/features/dashboard` prints nothing.
- Commits `5e870bc`, `5967bc7`, `41a871e`, `2710e26`, `e591e80`, `8bb123d` and `f774d51` exist on `post-demo`, and each carries the trailer.
- Task 1's acceptance criteria re-ran PASS:
  - the service starts with `import 'server-only'` and calls `listMyRequests({ ...firstPage, holder: 'requestor' })`;
  - `home-section.tsx` exports `HomeSection`, which `analyst-dashboard.tsx` imports;
  - the spec contains `UX08_REQUESTOR_PHONE_FIRST_SCREEN`;
  - the verify exited 0.
- Task 2's acceptance criteria re-ran PASS:
  - the dashboard is gone;
  - `e2e-ui-state.ts` contains `requestor-home-with-analyst-error` and exports `resolveE2eRequestorHomePartial`;
  - the presentation contains `released risk` and `holder=analyst`;
  - no web module calls `GET /csrm-assessment-requests`;
  - the verify exited 0.
- Task 3's acceptance criteria re-ran PASS:
  - `OwnRequestsPanel` is exported;
  - `analyst-home.tsx` reads `getMyRequestStatusSummary`;
  - both E2E names and `requestor-home-with-analyst-error` are in their specs;
  - the full Playwright run passed in both projects with the tree clean.
- The plan's verification passed: the web suite, typecheck and `api:check` are clean, the chain guard passes with the regenerated inventory, and the full Playwright suite passes in both projects.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

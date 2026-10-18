---
phase: 13-request-pick-up-and-notes
plan: 14
subsystem: analyst-dashboard
tags: [analyst-home, dashboard-summary, review-queue, assigned-to-me, pick-up-pool, figure-link-audit, playwright, axe]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: countReviewQueueBucket with the assignee and notes criteria, the open bucket and the policy's viewerId and humanAnalyst facts (13-12); /app/review/assigned and AssessmentRequestList's view prop (13-13); assignment and notes operations (13-03 to 13-09)
  - phase: 11-navigation-landing-and-list-clarity
    provides: the analyst Home, its KPI strip and Review queue widget, the figure-link audit and UX08_ANALYST_PHONE_FIRST_SCREEN
provides:
  - DashboardReviewQueue.mine (DashboardReviewQueueMine) and DashboardReviewQueue.unassigned, served and published
  - computeDashboardSummary(strapi, today, viewer)
  - DashboardKpiCounts.needsYourAction (replaces requiresAttention)
  - Tile 1 `Needs your action`; the `Assigned to you` group; `Waiting for pick-up`; `Requires attention`
  - REQ08_HOME_COUNTS_ASSIGNED_WORK @journey at 1440 and 375
affects: [13-19]
actuals:
  tokens: 20450
  tasks: 2
  commits: 4
plan_head_before: 3c0c027a9c0cc9e1c5bf71c7b81358ae2944610b
plan_head_after: 6f2009cbd5dbd9e8389c0630104926362fa55bf9
tech-stack:
  added: []
  patterns:
    - "A per-viewer dashboard figure reuses the queue's own count with the policy's viewer (countReviewQueueBucket with assignee=me / notes=unread), so the figure and the list it opens share one SQL definition"
    - "A summary block that only one viewer may see is a closed nested component (DashboardReviewQueueMine), pinned in the spec, the mounted test, the contract-catalogue guard and the web parser"
key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
    - apps/backend/src/api/csrm-analyst-insight/controllers/dashboard.ts
    - apps/backend/tests/analyst-dashboard.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-schema.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx
    - apps/csrm/src/features/home/home-page.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/reports/figure-link-audit.test.ts
    - apps/csrm/e2e/analyst-insights.spec.ts
    - apps/csrm/e2e/design-system-conformance.spec.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
key-decisions:
  - "computeDashboardSummary takes the viewer as the repository's own UnreadNotesViewer ({ id, humanAnalyst }) rather than the plan's { viewerId }: countReviewQueueBucket's notes filter needs humanAnalyst, so the summary passes exactly what the queue read uses."
  - "The controller reads the viewer after the insight-scope assertion and before the empty-query check; a caller without a positive whole viewerId gets the insight scope's own 403 (`CSRM analyst insight access is denied.`), never a summary counted for nobody. The service re-asserts the viewer."
  - "With new notes counts Assigned to me's open queue with notes=unread; a released request Bob holds with an unread note is outside it (mounted proof B4)."
  - "The analyst Home's own work reads `Assessment Request(s)` as its noun, and `With new notes` names `… assigned to you` (UI-SPEC §3 with the plan's requestNoun)."
  - "E1 tolerates Bob holding nothing: a zero tile opens Assigned to me's filtered empty state (`No requests match these filters`), as 13-13's UX07 proof does."
  - "REQ-08 stays Pending until the phase gate, as in 13-03 to 13-13."
patterns-established:
  - "Negative label assertions match /my attention/i so the plan's grep for the retired label stays meaningful over test files too"
coverage:
  - id: D1
    description: "The summary serves reviewQueue.mine.{requiresAttention, awaitingRequestor, generationInProgress, withUnreadNotes} and reviewQueue.unassigned for the policy's viewer, each equal to the queue read it opens, read as that viewer; the second analyst's counts are theirs only; a viewerless caller is refused"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/analyst-dashboard.integration.test.ts#each analyst's summary counts the requests that analyst holds"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/analyst-dashboard.integration.test.ts#the summary controller refuses a caller the policy resolved no viewer for"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 7 analyst dashboard summary is published closed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tile 1 `Needs your action` reads mine.requiresAttention and opens /app/review/assigned?queue=requires-attention; the Review queue leads with Assigned to you (4 rows), the team group starts with Waiting for pick-up and reads Requires attention; 11 links; every figure opens a list and is named by its visible label"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/reports/figure-link-audit.test.ts#walks the analyst Home’s own-work figures"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the browser at 1440 and 375, Bob's tile 1 and Assigned to you row equal Assigned to me under Requires attention (listing the request he picked up), Waiting for pick-up equals Requests with assignee=unassigned, the Review queue starts within 812px at 375, axe is clean"
    requirement: "REQ-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_HOME_COUNTS_ASSIGNED_WORK @journey"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#analyst dashboard shows what needs attention and every tile equals the list it opens"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_ANALYST_PHONE_FIRST_SCREEN"
        status: pass
    human_judgment: false
duration: 90min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 14: The Analyst Home Leads With Assigned Work Summary

**The analyst Home now opens on the analyst's own work. Tile 1 reads `Needs your action` and counts the requests the analyst holds that require attention. The Review queue starts with an `Assigned to you` group (needs your action, new notes, awaiting Requestor, generation in progress), then the team's `Waiting for pick-up` pool. Strapi computes every figure with the same SQL as the list it opens, for the viewer the policy resolved.**

## Performance

- **Duration:** about 90 minutes (2026-10-08T23:55Z to 2026-10-09T01:25Z), including two full Strapi suites (19 and 17 minutes), two runs of the four specs and one desktop performance run.
- **Tasks:** 2 (Task 1 the tracer, RED then GREEN).
- **Files changed:** 18 (none created).

## Accomplishments

- **Summary (D-15).** `DashboardReviewQueue` gains:
  - `mine`, with `requiresAttention`, `awaitingRequestor` and `generationInProgress` from `countReviewQueueBucket(…, { assignee: 'me', viewer })`, and `withUnreadNotes` from the `open` bucket with `notesUnread`.
  - `unassigned`, from `requires-attention` with `assignee: 'unassigned'`.
  - No `mine.open` is served.
  - The controller passes `{ id: csrmAuthorization.viewerId, humanAnalyst }` and refuses (403) without a viewer.
- **Contract.** `DashboardReviewQueueMine` (closed, all four counts required), and `mine` and `unassigned` required on `DashboardReviewQueue`. The generated client is regenerated and `api:check` is clean. The web parser carries both (strict), and the parity guard proves either missing, or an extra `open`, is refused.
- **KPI count.** `DashboardKpiCounts.needsYourAction` replaces `requiresAttention` and is filled from `reviewQueue.mine.requiresAttention`. Before this plan, the tile read the team's count.
- **Home (UI-SPEC §3).**
  - Tile 1: `Needs your action`, `Requests assigned to you that need analyst action`, `UserRoundCheck` in the muted tone, opening `/app/review/assigned?queue=requires-attention`.
  - Widget description: `Your assigned requests first, then the team’s queue.`
  - `Assigned to you` rows: Needs your action, With new notes (`With new notes: {n} Assessment Request(s) assigned to you`), Awaiting Requestor and Generation in progress. Each opens `/app/review/assigned?…`.
  - The team group: `Waiting for pick-up` (opens `/app/review/requests?assignee=unassigned`), then `Requires attention`, Awaiting Requestor and Generation in progress.
  - Zero rows render as links, so the widget has 11 links.

## Test Counts

- **Task 1 RED (`ac61d2a`).**
  - Web: `Tests 25 failed | 286 passed` (8 files).
  - Strapi `analyst-dashboard.integration`: `# pass 1 / # fail 9`. The first run crossed UTC midnight and was re-run.
- **Task 1 GREEN (`f77d1af`).**
  - Web: `Tests 311 passed` (8 files).
  - Strapi focused (dashboard, insight authorisation, insight routes, queue buckets): `# pass 48 / # fail 0`.
  - `api:check`, typecheck and lint are clean.
  - First full Strapi suite: `# pass 906 / # fail 1`. The failure was `contract-catalogue.integration`'s pinned `DashboardReviewQueue` keys (deviation 1). After the fix, that file ran alone: `# pass 23 / # fail 0`.
- **Tracer gate.**
  - The re-run verify exited 1: the old-label grep matched the three new negative assertions (deviation 2).
  - Fixed in `0211f45`, then re-run: exit 0, `Tests 311 passed`.
- **Task 2 (`6f2009c`).**
  - The mobile list collects `REQ08_HOME_COUNTS_ASSIGNED_WORK` (8 tests in `request-pick-up.spec.ts`).
  - Playwright `analyst-insights`, `design-system-conformance`, `navigation-and-home` and `request-pick-up`: **73 passed (desktop 54, mobile 19)**, run twice with no failure or flake. The first run was before the commit; the second was the plan's verify command after it, which exited 0 with `git status --short -- apps/csrm apps/backend/src docs` empty.
- **Full web unit suite:** `Test Files 188 passed`, `Tests 4130 passed`.
- **Full Strapi suite (final, at HEAD `6f2009c`):** `# tests 907 / # pass 907 / # fail 0`.
- **Performance** (`performance.spec.ts --project desktop`, 11 passed):
  - `/app`: 235,964 bytes (was 235,965).
  - `/app/risks/{documentId}`: 299,884 bytes (was 299,887).
  - No route grew, and no budget override was used. The plan does not touch the shell; the dashboard is a Server Component.

## Task Commits

1. **Task 1 (tracer):** `ac61d2a` (test, RED), `f77d1af` (feat, GREEN), `0211f45` (test, the verify-grep fix)
2. **Task 2:** `6f2009c` (test)

## Assertions Changed Deliberately (13-UI-SPEC §16)

- **U1:**
  - `analyst-dashboard-presentation.test.ts`: tile 1 and the eleven review rows. The Questionnaires group index moves from 1 to 2.
  - `analyst-dashboard.test.tsx`:
    - tile 1's href and name;
    - the groups and the eleven rows, with `Submitted` moving from row 3 to row 8;
    - the list-role case: Assigned to you has 4 rows, and Assessment Requests has 4 (was 3).
  - `home-page.test.tsx`: the analyst case asserts tile 1, the group order and 11 links.
- **E1, `analyst-insights.spec.ts`:** the `Requires my attention` tile proof becomes `Needs your action`. It equals the total of `/app/review/assigned?queue=requires-attention`, or that list's empty state at zero, and `Assigned to me` is the current navigation item.
- **The Review queue link count changed from 6 to 11:**
  - In the unit tests: `analyst-dashboard.test.tsx` (×4).
  - In the browser: `analyst-insights.spec.ts` (the Top alerts failure case) and `design-system-conformance.spec.ts` (the Review queue sibling at each width).
- **`navigation-and-home.spec.ts`:** unchanged, and it passes in both projects, including `UX08_ANALYST_PHONE_FIRST_SCREEN`.

## Decisions Made

See `key-decisions` above. In brief:
- **Viewer shape:** `{ id, humanAnalyst }`, the queue read's own.
- **Viewerless caller:** refused with the insight scope's 403.
- **New notes:** counted over the open queue.
- **E1 at zero:** a zero tile opens the filtered empty list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deliberate assertion] `contract-catalogue.integration.test.ts` pinned the old `DashboardReviewQueue` keys (file outside the plan's list)**
- **Found during:** Task 1 GREEN, in the first full Strapi suite.
- **Issue:** the Phase 7 guard pins each dashboard component's keys, and requires every `DashboardReviewQueue` property to be a count.
- **Fix:**
  - The keys gain `mine` and `unassigned`.
  - `DashboardReviewQueueMine` joins the closed components.
  - The count-shape check accepts `mine` as `$ref DashboardReviewQueueMine` and requires every other property, and all of `DashboardReviewQueueMine`, to be counts.
- **Commit:** `f77d1af`

**2. [Rule 1 - Verify gate] The old-label grep matched the new negative assertions**
- **Found during:** the tracer gate.
- **Issue:** `! grep -rq "Requires my attention" …/analyst-dashboard …/home` scans the test files too.
- **Fix:** the three negative assertions, and the new journey's, match `/my attention/i`. That is stricter, and it restates no retired label.
- **Commit:** `0211f45` (the journey's copy is in `6f2009c`).

---

**Total deviations:** 2. Neither changes behaviour. No content type changed, no dependency was added, and `served-operations.json` was not regenerated.

## Issues Encountered

- **UTC midnight.** The first RED Strapi run crossed UTC midnight, so the file's `UTC_DAY_ROLLED_OVER_DURING_TEST` guard fired. The re-run showed the intended RED.
- **Harness noise.** The WebServer logged `The destination stream closed early` 63 times during Playwright, from navigations that abort streamed renders. No test failed.

## Threat Model Coverage

- **T-13-46 (mitigate):** the viewer comes only from `csrmAuthorization.viewerId` and `humanAnalyst`, never from a query. The summary still refuses any query key. The controller refuses a caller without a viewer, which the mounted test proves on the controller. Bob's and the second analyst's summaries differ only in `mine`, each equal to that analyst's own list.
- **T-13-47 (mitigate):** the insight scope's underlying-read rule is unchanged, and every new count reuses the queue's own predicates.
- **T-13-SC (accept):** no package was added.

## Known Stubs

None.

## Next Phase Readiness

- **For 13-19's walk:**
  - At 1440: tile 1 and the eleven-row Review queue.
  - At 375: the widget starts within the first screen (proven in `UX08` and the new journey); check its length visually.
- **REQ-08** stays Pending until the phase gate.

## Self-Check: PASSED

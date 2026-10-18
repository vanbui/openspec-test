---
phase: 11-navigation-landing-and-list-clarity
plan: 13
subsystem: ui
tags: [navigation, sidebar, drawer, counts, streaming, suspense, react-use, nextjs, vitest, playwright, accessibility]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-05: the navigation profiles, the section loop, the collapsible My own requests; 11-10/11-12: getMyRequestStatusSummary returning { statuses, byHolder }; 11-11: My requests' holder filter (/app/requests?holder=requestor)"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: the layout's readViewerTimeZone and AppShell's TimeZoneProvider; 10-08: NavigationGuardProvider and the guarded links"
provides:
  - "navigation.ts: NavigationCountKey, NavigationCounts, NavigationItem.count, navigationCountMeaning(key, n), shownNavigationCount(value), sectionNavigationCount(counts, items); count keys on the Requestor's My requests and My questionnaires and the analyst's Requests, Alerts and own My requests"
  - "components/shell/navigation-counts.ts (server-only): loadNavigationCounts(granted) -> Promise<NavigationCounts>, never rejecting; reads only the keys the viewer's navigation shows"
  - "assessment-service.ts: countReviewQueue(queue) -> TransportResult<number>, a one-row page of GET /v1/assessment_requests"
  - "AppShellProps.counts: Promise<NavigationCounts>; CapabilityNavigation and MobileNavigation take counts?; the layout starts loadNavigationCounts unawaited"
  - "capability-navigation.tsx: CountSeparator, CountTag, LabelWithCount (each count in its own Suspense with fallback null); the collapsed section button's count"
  - "globals.css: .nav-count (sidebar neutral tag, micro-label class) and .nav-count-separator"
  - "e2e helpers: openFromNavigation(page, string | RegExp, exact?, section?), navigationLabel(text), navigationText(label), createCompleteDraftRequest, submitRequestFromItsPage"
  - "E2E: UX07_COUNT_EQUALS_LIST, UX07_ANALYST_COUNTS_EQUAL_LISTS, UX07_COUNTS_REFRESH_AFTER_SUBMIT, UX07_DRAWER_COUNTS, UX07_REQUESTOR_NO_ANALYST_COUNTS"
affects: [11-14, 11-19, 11-21, 13, 20, 22]

actuals:
  tokens: 14100
  tasks: 3
  commits: 8
plan_head_before: 776317a2eacc47b7ce13b294d4e0c794d15a970f
plan_head_after: c73e1f7cdc18253afb4a0692a07acccf991ed0d0

tech-stack:
  added: []
  patterns:
    - "A count streams from the layout: the layout starts one never-rejecting promise and does not await it; each count part reads it with use() inside its own Suspense boundary whose fallback is nothing"
    - "Count reads follow what the navigation shows: the keys of the viewer's visible profile items choose the reads, so a profile change cannot add an unscoped read"
    - "A count joins its link's name through content: the label's element holds an inline hidden comma, then the visible micro-label tag and a visually hidden meaning, with no aria-label"
    - "E2E reads a navigation label with navigationLabel/navigationText, so a count in the link text never breaks a label assertion"

key-files:
  created:
    - apps/csrm/src/components/shell/navigation-counts.ts
    - apps/csrm/src/components/shell/navigation-counts.test.ts
  modified:
    - apps/csrm/src/config/navigation/navigation.ts
    - apps/csrm/src/config/navigation/navigation.test.ts
    - apps/csrm/src/components/shell/capability-navigation.tsx
    - apps/csrm/src/components/shell/mobile-navigation.test.tsx
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/app/(app)/layout.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/lib/security/server-only-boundary.test.ts
    - apps/csrm/e2e/helpers/navigation.ts
    - apps/csrm/e2e/helpers/requests.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts
    - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
    - apps/csrm/e2e/analyst-insights.spec.ts
    - apps/csrm/e2e/review-lists.spec.ts
    - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
    - apps/csrm/e2e/request-relationship-states.spec.ts

key-decisions:
  - "11-13: loadNavigationCounts chooses its reads from the keys on the viewer's visible profile items (navigationProfileFor + can), rather than a separate capability switch, so the reads always equal the counted items: a Requestor issues two reads and no analyst read; an analyst issues three and never the questionnaire summary"
  - "11-13: the hidden comma sits inline inside the label's own span (.nav-count-separator, opacity 0), because a flex item or an absolutely positioned sr-only span computes to display block and Playwright's (and Chrome's) name computation pads a block with spaces, which read 'My requests , 3'"
  - "11-13: NavigationCounts is defined in the zod-free navigation.ts and re-exported by navigation-counts.ts, so the client navigation never imports the server-only module, even for a type"
  - "11-13: the count is the micro-label lockup (class), not a font of its own: the full run's type scan refused 11px at weight 500"
  - "11-13: assumption A2 held: after the submit Server Action and a client navigation to Home by the sidebar, the count had dropped, with no reload"
  - "11-13: UX-07 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Streamed figure in the shell: layout starts promise -> AppShell prop -> client use() in Suspense fallback null; fail soft by settling every read to a number or undefined"
  - "E2E for a streamed count: wait on the visible .nav-count tag (navigationCount) when the count must be above zero; compare with the list's own output total"

requirements-completed: []

coverage:
  - id: D1
    description: "The Requestor's My requests and My questionnaires, and the analyst's Requests, Alerts and own My requests, carry a count named by its content ('My requests, 3 need your action', 'Requests, 1 needs attention', 'Alerts, 6 overdue', 'My questionnaires, 2 to answer'); zero and unknown show nothing"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#navigation counts (D-10, UI-SPEC §1.2, §1.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/config/navigation/navigation.test.ts#navigation counts (D-10, UI-SPEC §1.3)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_COUNT_EQUALS_LIST ([desktop] 1440)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Count reads are server-scoped, bounded and fail-soft: two reads for a Requestor (no analyst read), three for an analyst (no questionnaire summary); a refused, failed or throwing read hides only its own count; the promise never rejects"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/navigation-counts.test.ts (both actors)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-service.test.ts#countReviewQueue: the sidebar’s one-row queue count (D-11)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/security/server-only-boundary.test.ts (navigation-counts.ts starts with import 'server-only')"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_REQUESTOR_NO_ANALYST_COUNTS ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each badge equals the total of the list it counts: My requests = /app/requests?holder=requestor, Requests = the Requires my attention queue, Alerts = /app/alerts?urgency=overdue"
    requirement: "UX-07"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_COUNT_EQUALS_LIST"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_ANALYST_COUNTS_EQUAL_LISTS"
        status: pass
    human_judgment: false
  - id: D4
    description: "The layout starts the reads unawaited and streams one promise; counts refresh with the layout's server renders (a submit drops My requests' count without a reload) and never poll"
    requirement: "UX-07"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_COUNTS_REFRESH_AFTER_SUBMIT"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#shows no count while the figures are unknown, and none at all without them"
        status: pass
    human_judgment: false
  - id: D5
    description: "The drawer at 375 renders the same counts; the collapsed My own requests button is named 'My own requests, 1 needs your action', and once open the count moves to its My requests item"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#renders the same counts in the drawer (D-12)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_DRAWER_COUNTS ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D6
    description: "The count tag looks right on the dark sidebar: the neutral pill at the item's end in the item's own colour, muted at rest and inverse on hover and when current"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#draws a count as the sidebar’s neutral tag in the item’s own colour, at the item’s end (X-6)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/design-system-conformance.spec.ts (the Requestor Home type scan)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the rule's tokens, the micro-label class and the type scan; the rendered pill on the sidebar and in the drawer is a visual judgment no test asserts"

duration: 1h 54m
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 13: Sidebar counts Summary

**The sidebar and the drawer now show how much work waits in each place. A Requestor sees counts on My requests ("needs your action") and My questionnaires ("to answer"). The analyst sees counts on Requests (Requires my attention), Alerts (overdue) and their own My requests, and the collapsed My own requests button carries that count too. Each count is part of its link's accessible name, for example "My requests, 3 need your action". The layout starts the reads, passes one promise down without awaiting it, and each count streams into a Suspense boundary that renders nothing while it waits, so no page waits for a count. Each badge equals the total of the list it counts. A refused or failed read just shows no count.**

## Performance

- **Duration:** 1h 54m, including six Playwright runs (two full) and three full web suites
- **Started:** 2026-10-03T13:04:41Z
- **Completed:** 2026-10-03T14:58:54Z
- **Tasks:** 3 of 3
- **Files changed:** 22 (2 created, 20 modified, none deleted)

## Accomplishments

- **Count model (`navigation.ts`, zod-free):**
  - `NavigationCountKey` has four keys: `myRequestsNeedingAction`, `questionnairesToAnswer`, `requestsRequiringAttention` and `overdueAlerts`.
  - `NavigationCounts = Partial<Record<…, number>>`.
  - `NavigationItem.count?` sets the key on each item that holds work, following D-10 and UI-SPEC §1.1.
  - `navigationCountMeaning(key, n)` returns the UI-SPEC wording: `need your action` (`needs` for one), `to answer`, `need attention` (`needs` for one) and `overdue`.
  - `shownNavigationCount(value)` decides whether a count shows: only a number above zero does.
  - `sectionNavigationCount(counts, items)` gives a collapsed section's figure. It adds each key once, and returns undefined when no figure is known.
- **Reads (`navigation-counts.ts`, `server-only`):**
  - `loadNavigationCounts(granted)` reads only the keys carried by items the viewer can see in their profile. Each read goes through an existing service function:
    - `getMyRequestStatusSummary`, picking `byHolder.requestor`;
    - `getMyQuestionnaireSummary`, picking `notStarted + draft`;
    - the new `countReviewQueue('requires-attention')`;
    - `getAlertSummary`, picking `byUrgency.overdue`.
  - Each read settles to a number or to undefined, and the promise never rejects.
  - A Requestor makes 2 reads and no analyst read. An analyst makes 3 and never reads the questionnaire summary.
- **`countReviewQueue(queue)` (`assessment-service.ts`):** sends `GET /v1/assessment_requests` with `filters[queue]`, `pagination[page]=1` and `pagination[pageSize]=1`, and returns `meta.pagination.total`. It reuses the existing `request` helper and `requestQueueResponseSchema`. It is the same operation from the same file, so `served-operations.json` is unchanged, and the chain guard passes.
- **Wiring:**
  - Once the capability check passes, the layout calls `loadNavigationCounts(granted)` without `await` and passes `counts=` to `AppShell`. The permission-denied branch passes `Promise.resolve({})`.
  - `AppShell` passes the same promise to the sidebar's `CapabilityNavigation` and to `MobileNavigation`.
- **Rendering (`capability-navigation.tsx`):**
  - `LabelWithCount` wraps the label in `span.nav-link-label`. Inside that span, a `<Suspense fallback={null}>` renders `CountSeparator`, an inline hidden comma.
  - After the label, a second Suspense boundary renders `CountTag`: a space, then the visible `span.nav-count.micro-label`, then a space and the `sr-only` meaning.
  - No link carries an `aria-label`.
  - While My own requests is collapsed, its button renders the section's count the same way. Once open, the count shows on the My requests item instead.
- **CSS (`globals.css`):**
  - `.nav-count` is the sidebar's neutral tag (X-6): `margin-inline-start: auto`, a 1px `--line-on-dark-strong` border, `--radius-full`, 2px 10px padding and `tabular-nums`. It inherits the item's colour and gets its type from the `micro-label` class.
  - `.nav-count-separator` sets `opacity: 0`.
  - Neither rule holds a hex colour.
- **E2E:**
  - Five new proofs, listed below, plus the E12 and E13 locator changes.
  - `openFromNavigation` accepts a pattern.
  - New label helpers mean a count in a link's text never breaks a label assertion.

## Task Commits

1. **Task 1: The Requestor's My requests count, streamed from the layout (tracer, TDD)**
   - `35ca7ab`: test(11-13), RED
   - `31119b8`: feat(11-13), GREEN
2. **Task 2: The analyst's counts and the other Requestor count, fail-soft (TDD)**
   - `79b8e94`: test(11-13), RED
   - `527e541`: feat(11-13), GREEN
3. **Task 3: Prove the counts in the browser, move the exact locators, run every journey**
   - `682c7a5`: fix(11-13), the count's typography (deviation 1)
   - `5463c09`: test(11-13), the seeded requests opened by search (deviation 2)
   - `c73e1f7`: test(11-13), the browser proofs and the locators

The ledger count is `git rev-list --count 776317a..c73e1f7` = 8. That includes `8f0f6c1` ("docs(brief): use the weekly limit up to 99% before wrapping up"), which was committed on `post-demo` during the run by someone other than this executor. This plan made 7 commits, and each ends with the `Co-Authored-By` trailer (checked with `git log --format=%(trailers)`).

## TDD Gate Compliance

- **Task 1:** RED `35ca7ab` comes before GREEN `31119b8`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `mobile-navigation.test.tsx`, "navigation counts > names the Requestor’s My requests by its content: the label, the count and what it counts". The test failed on `Unable to find role="link" and name "My requests, 3 need your action"`.
  - The RED run failed 19 of 182 tests. The rest were the other count cases, the CSS rule, `navigationCountMeaning` (not yet a function), and the server-only guard's missing module. `navigation-counts.test.ts` failed at import.
- **Task 2:** RED `79b8e94` comes before GREEN `527e541`.
  - `RED_EVIDENCE_OK` for "loadNavigationCounts for a Security Analyst > reads the Requires my attention total, the overdue alerts and the own requests summary, and no questionnaire summary". The result was `{ myRequestsNeedingAction: 1 }` alone.
  - The RED run failed 13 of 192 tests, each on an assertion or a missing export (`countReviewQueue`, `sectionNavigationCount`).
- As in earlier plans, the gsd-core JUnit parser reads the first `name=` attribute, so the evidence was checked against a scratchpad copy with `name` moved first. Nothing in the repository changed for this.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full Task 1 verify was re-run against the committed tree, and it passed: 187/187 unit, typecheck clean, Playwright 23 passed. Task 2 started only after that.

## Assumption A2

**A2 held.** In `UX07_COUNTS_REFRESH_AFTER_SUBMIT`:
1. The Requestor saved a complete draft, and the My requests count read N.
2. They submitted the draft from its page, through the `submitRequest` Server Action, which calls `revalidatePath`.
3. They clicked Home in the sidebar, a client navigation.
4. `expect.poll` read N−1 without any `page.reload()`. It passed in every run: the changed-specs run, the reproduction runs and the final full run.

The test proves this combination (a revalidating Server Action, then a client navigation) refreshes the count. It does not separate which of the two re-ran the layout.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/components/shell`, `src/config/navigation`, server-only and zod-boundary guards) | 19 failed, 163 passed (182) |
| Task 1 GREEN verify (unit files) | 10 files, 187/187; typecheck clean |
| Task 1 full web suite | 141 files, 3,082/3,082 |
| Task 1 Playwright `navigation-and-home.spec.ts` (first attempt) | Did not start: the Next build's type check failed because the executor added a Task 2 test file during the build (see Issues). Rerun below |
| Task 1 Playwright `navigation-and-home.spec.ts` | 23 passed (desktop 14, mobile 9), 0 failed, 0 flaky, 0 skipped; 1.6 min; tree identical before and after |
| Tracer re-run of the Task 1 verify | 187/187; typecheck clean; Playwright 23 passed (1.4 min) |
| Task 2 RED | 13 failed, 179 passed (192) |
| Task 2 GREEN verify (`src/components/shell`, `src/config/navigation`, `assessment-service.test.ts`, `contract-operation-chain.test.ts`) | 10 files, 192/192; typecheck clean |
| Task 2 full web suite | 141 files, 3,096/3,096 |
| Task 3 changed specs (`navigation-and-home`, `assessment-release-workflow`, `questionnaire-generation-workflow`, `analyst-insights`, `review-lists`) | 49 passed (desktop 34, mobile 15), 0 failed, 0 flaky, 0 skipped; 3.0 min; tree identical before and after |
| Full Playwright, first run | 113 passed, 6 failed (desktop only, deviations 1 and 2), 0 flaky, 0 skipped; 13.8 min; tree identical before and after |
| Reproduction: `navigation-and-home`, `design-system-conformance`, `questionnaire-governance-workflow`, `request-relationship-states` | 47 passed, 2 failed: the invariant journey opened non-title links through search (deviation 2, refined); 5.6 min; tree unchanged |
| Reproduction: `navigation-and-home`, `questionnaire-governance-workflow`, `request-relationship-states` | 39 passed, 0 failed; 3.1 min; tree unchanged |
| **Full Playwright, final** (`pnpm --dir apps/csrm test:e2e`, production build) | **128 passed: desktop 109, mobile 19; 0 failed, 0 flaky, 0 skipped; 15.5 min** (14:37:01Z to 14:52:32Z). `git status --short` identical before and after the run |
| Final full web suite (`pnpm --dir apps/csrm test`) | 141 files, 3,096/3,096 (11-12 ended at 3,056) |
| `typecheck` and `lint` (`next typegen && tsc --noEmit`) | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |

The Strapi suite was not run, because this plan changes no Strapi file. The production server logged 132 `The destination stream closed early` messages and one `failed-to-find-server-action` in the final full run (11-05 logged 75 and 1). Every test passed.

## E2E Assertions Changed

Listed in the plan:
- **E12, Requests:** `/^Requests\b/` replaces the exact `Requests` name in:
  - `assessment-release-workflow.spec.ts:113` (the plan said 108);
  - `questionnaire-generation-workflow.spec.ts:91` and `:245` (the plan said 90 and named one);
  - `analyst-insights.spec.ts:489` (the plan said 485).
- **E13, Alerts:** `/^Alerts\b/` replaces the exact name in `analyst-insights.spec.ts:205`, `:208` and `:290`.
- **New proofs in `navigation-and-home.spec.ts`:**
  - `UX07_COUNT_EQUALS_LIST`, `UX07_ANALYST_COUNTS_EQUAL_LISTS` and `UX07_COUNTS_REFRESH_AFTER_SUBMIT`, at the desktop project's 1440 only;
  - `UX07_DRAWER_COUNTS` and `UX07_REQUESTOR_NO_ANALYST_COUNTS`, in the `@journey` describe, so they run in both projects.
- `openFromNavigation(page, name: string | RegExp, exact?, section?)`. A collapsed section's `section` name is matched with or without its count.

Changed beyond the plan's list:
- `review-lists.spec.ts:60`: `openFromNavigation(page, /^Requests\b/)`. The grep the plan asks for found it.
- `analyst-insights.spec.ts`:
  - `:316-319`: the Oversight links read `['Risk register', /^Alerts(, [\d,]+ overdue)?$/, 'Reports']`, and the per-name loop anchors Alerts.
  - `:701-703`: the Requestor's "no Analyst dashboard, Alerts or Reports link" checks are anchored patterns. With exact names, a count in an Alerts name could have made `toHaveCount(0)` pass vacuously.
- `navigation-and-home.spec.ts` existing proofs (11-02 to 11-05):
  - The label readers in `UX07_LABEL_EQUALS_HEADING`, `navigationOutline`, `ungroupedLinks` and `sectionsOf` strip a count with `navigationLabel`.
  - The exact-name `My own requests` button, the `My requests` link and the toHaveText arrays for My work, Assessment work, Oversight and My own requests accept a count through `navigationText(label)`.
  - The in-page `My own requests` lookup uses `startsWith`.
- `helpers/navigation.ts`: `navigationLabel(text)` and `navigationText(label)`.
- `helpers/requests.ts`: `createCompleteDraftRequest` and `submitRequestFromItsPage`, which `createSubmittedRequest` now composes. Its behaviour is unchanged.
- `questionnaire-governance-workflow.spec.ts` and `request-relationship-states.spec.ts`: these specs now open seeded requests by searching their title (deviation 2).
- The grep for other exact-name locators on a counted item (`My requests`, `My questionnaires`) found none outside `navigation-and-home.spec.ts`. The remaining `'My Requests'` locators are non-exact, so they match by case-insensitive substring and still find the link when a count is present.

## Files Created/Modified

- `src/config/navigation/navigation.ts`: the count keys, meanings and section sum; `count` on the five items
- `src/components/shell/navigation-counts.ts` (new): `loadNavigationCounts`
- `src/features/assessments/assessment-service.ts`: `countReviewQueue`
- `app/(app)/layout.tsx`, `src/components/shell/app-shell.tsx`: the unawaited promise and the `counts` prop
- `src/components/shell/capability-navigation.tsx`: `CountSeparator`, `CountTag`, `LabelWithCount`, the item and section counts, `counts?` on both navigations
- `app/globals.css`: `.nav-count`, `.nav-count-separator`
- Unit tests:
  - `navigation-counts.test.ts` (new): both actors, fail-soft, never rejects
  - `mobile-navigation.test.tsx`: names, zero and unknown, collapsed button, drawer, CSS
  - `navigation.test.ts`: the counted items, the meanings, one meaning per collapsible section, the section sum
  - `assessment-service.test.ts`: `countReviewQueue`
  - `server-only-boundary.test.ts`: the new module is guarded
  - `app-shell-account.test.tsx`: `counts={Promise.resolve({})}`
- E2E: the helpers, `navigation-and-home`, `assessment-release-workflow`, `questionnaire-generation-workflow`, `analyst-insights`, `review-lists`, `questionnaire-governance-workflow` and `request-relationship-states`

## Decisions Made

- **The reads follow the visible items.** `loadNavigationCounts` collects the count keys of the profile items the viewer can see, then reads only those. The plan's "chooses its reads with `can(…, granted)`" still holds, because `can` filters the items. A profile change cannot add a read for an item the viewer cannot see. The unit tests prove a Requestor makes no analyst read, and an analyst never reads the questionnaire summary (T-11-07).
- **Where the hidden comma sits.** The plan's markup put a hidden `, ` in an `sr-only` span between the label and the tag. That span is absolutely positioned, and the tag is a flex item. Both compute to `display: block`, and Playwright's name computation, like Chrome's, pads a block with spaces. The name would then read "My requests , 3 need your action". So the comma is inline inside the label's own span, hidden by `opacity: 0`, and plain-text spaces separate the tag and the meaning. Playwright then computes exactly "My requests, 3 need your action", and so does the jsdom name computation (`UX07_COUNT_EQUALS_LIST` and the unit cases). The name still comes from the content alone, with no `aria-label`, as UI-SPEC §1.3 and Pitfall 5 require.
- **`NavigationCounts` lives in `navigation.ts`.** `navigation-counts.ts` re-exports it, so the client component never names the server-only module, not even as a type.
- **The count's type is the micro-label class.** The direction's neutral tag uses `--text-micro`, which is the micro lockup (mono, 11px, weight 400, tracked, uppercase). The rule therefore sets no font of its own (deviation 1).
- **Counts stay in the link.** The count is part of the same guarded `Link` as the label, so Phase 10's navigation guard and the 11-05 intent prefetch are unchanged.
- **UX-07 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: bug caused by this plan] The count's type was outside the typography contract**
- **Found during:** Task 3, the first full Playwright run. `design-system-conformance.spec.ts:159` failed: "the Requestor Home at 1440px contains typography outside the document contract", with two elements at `11px` and weight `500`.
- **Issue:** `.nav-count` set `font-size: var(--text-micro-size)` but inherited the item's weight 500. The contract has no 11px/500 style.
- **Fix:** The count carries the `micro-label` class, which is the neutral tag's type in the direction, and `.nav-count` sets no font. The unit test now pins the class and the rule's lack of a font, and it failed first.
- **Files modified:** `capability-navigation.tsx`, `globals.css`, `mobile-navigation.test.tsx`
- **Verification:** `design-system-conformance.spec.ts` passed in the reproduction run and in the final full run.
- **Committed in:** `682c7a5` (its own commit)

**2. [Rule 1: test harness broken by this plan's new records] Seeded requests fell off My requests' first page**
- **Found during:** Task 3, the first full Playwright run.
- **Issue:** `questionnaire-governance-workflow.spec.ts:74` and four `request-relationship-states.spec.ts` journeys (`:92` and `:141`, at 375 and 1440) opened a seeded request by looking for its title on `/app/requests`. The count journeys run earlier, alphabetically, and create five more Requestor requests. My requests shows 10 per page, so the seeded titles moved to page 2.
- **Fix:** Both specs' `openRequest` helpers load the list with `?q=<title>`. `q` searches the number and the title in `GET /v1/my_requests`, and `/app/review/requests` takes the same parameter.
  - The first reproduction run showed that the invariant journey (`request-relationship-states.spec.ts:47`) opens every link it read from the first page, and some of those links name a next step, not a title. That journey now opens them from the first page as before (`search = false`).
- **Files modified:** `questionnaire-governance-workflow.spec.ts`, `request-relationship-states.spec.ts`
- **Verification:** The reproduction run passed 39/39, and the final full run passed 128/128.
- **Committed in:** `5463c09` (its own commit)

**3. [Rule 1: broken by the planned change] Existing navigation proofs read a label from the link text**
- **Found during:** Task 1, before the first Playwright run.
- **Issue:** A count joins the link's text as well as its name. The 11-02 to 11-05 proofs in `navigation-and-home.spec.ts` read labels with `textContent`, `toHaveText([...])` or exact names, so they would fail whenever a count above zero showed.
- **Fix:** `navigationLabel(text)` and `navigationText(label)` in `helpers/navigation.ts`, applied to every such read. This was committed with the RED tests, so the Task 1 Playwright run proves both together.
- **Committed in:** `35ca7ab`

**4. [Rule 3: blocking] Unit renders must settle the streamed counts inside an awaited `act`**
- **Issue:** A component that suspends on `use()` under React 19's act environment queues its retry in the act queue. `findByRole` alone never saw the count, and a render with a pending promise committed nothing.
- **Fix:** `renderSettled()`, an awaited `act` around `render` followed by an empty awaited `act`. The drawer case opens the sheet inside an awaited `act`. No production code changed for this.
- **Committed in:** `31119b8`, `527e541`

---

**Total deviations:** 4 auto-fixed: 2 bugs this plan caused in a full-run proof and in the harness, 1 assertion set broken by the planned change, and 1 test-environment blocker.
**Impact on plan:** No added scope, no Strapi change, no new operation and no new dependency. D-01 and D-02 hold, and `served-operations.json` is unchanged.

## Issues Encountered

- **Executor error, recovered:** the first Task 1 Playwright run did not start. While the run's Next build was type-checking, the executor wrote the Task 2 `countReviewQueue` test into `assessment-service.test.ts`, which named a function that did not exist yet. That file was set aside in the scratchpad and restored with `git checkout --`, a file this task had changed. The rerun passed. Nothing in the repository was edited during any later run.
  - That run kept its database and build for debugging, under the harness's ignored `.tmp` directories: `apps/backend/.tmp/playwright-e2e-ca3c229a-….db` and `apps/csrm/.tmp/playwright-next-ca3c229a-…`. They are untracked and ignored, and `git status` does not list them.
- `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files (CRLF/LF stat). They stay untouched and unstaged.
- `apps/csrm/e2e/request-relationship-states.spec.ts` already held one stray backspace control character (`\x08`) at `HEAD` before this plan. It is untouched.
- `8f0f6c1` (a POST-DEMO-BRIEF wording change) landed on `post-demo` during the run, from outside this executor. It is counted in the ledger above.

## Known Stubs

None. Every count reads a real server figure, and a missing figure renders nothing by design (D-11).

## Threat Flags

None. The only new read is a one-row page of an operation the web already calls from the same file. Every authorisation decision stays in Strapi, and only numbers reach the client.
- **T-11-07:** the reads follow the visible items. A unit test shows a Requestor makes no analyst read, and `UX07_REQUESTOR_NO_ANALYST_COUNTS` proves it in the browser.
- **T-11-32:** two or three bounded reads, all aggregates except the one-row page, started unawaited and never polled.
- **T-11-33:** a failed read renders nothing, so no error text reaches the sidebar.
- **T-11-SC:** no package was added.

## User Setup Required

None.

## Next Phase Readiness

- **11-14 onward:** a later item gets a count with a new `NavigationCountKey`, its meaning in `navigationCountMeaning`, a reader in `navigation-counts.ts` (the `Record` type then fails to typecheck until one exists) and `count:` on the item. Phase 13's "Assigned to me" is that change.
- **A collapsible section's counted items share one meaning:** `navigation.test.ts` asserts it, because its button shows their sum.
- **E2E:** use `navigationText(label)` or an anchored pattern for any counted item. A journey that opens a seeded record from a list should search for it, because the suite keeps adding records.

## Self-Check: PASSED

- Created files exist: `apps/csrm/src/components/shell/navigation-counts.ts` and `navigation-counts.test.ts` (FOUND).
- Commits `35ca7ab`, `31119b8`, `79b8e94`, `527e541`, `682c7a5`, `5463c09` and `c73e1f7` exist on `post-demo`, and each carries the trailer.
- Task 1 acceptance criteria re-ran PASS:
  - `navigation-counts.ts` starts with `import 'server-only'` and exports `loadNavigationCounts`.
  - `layout.tsx` calls `loadNavigationCounts(granted)` with no `await` (0 matches for `await loadNavigationCounts`) and passes `counts=`.
  - `capability-navigation.tsx` contains `Suspense` and `use(`. Its `aria-label`s sit only on groups, the landmark and Close navigation, never on a link.
  - The verify exited 0, twice.
- Task 2 acceptance criteria re-ran PASS:
  - `countReviewQueue` sends `'pagination[pageSize]': 1`.
  - `navigation.ts` sets `count: 'requestsRequiringAttention'` and `count: 'overdueAlerts'`.
  - The verify exited 0.
- Task 3 acceptance criteria re-ran PASS:
  - The four journey names are in `navigation-and-home.spec.ts`.
  - `assessment-release-workflow.spec.ts` uses `/^Requests\b/`.
  - The full run passed in both projects (128/128), with the tree clean afterwards.
- The plan's verification passed:
  - web 3,096/3,096, typecheck, lint and `api:check` clean;
  - the chain and server-only guards pass;
  - full Playwright green in both projects;
  - the tree is clean.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

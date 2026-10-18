---
phase: 11-navigation-landing-and-list-clarity
plan: 09
subsystem: ui
tags: [next-app-router, react, lifecycle-stepper, request-hub, next-action, responsive, zod, client-bundle, playwright, vitest]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-08: nextAction.holder beside actor; the hub's link rule (holder === actor plus an href)"
  - phase: 10-existing-flow-gap-closure
    provides: "10-04: the Requestor page renders the stepper before the hub; 10-14 and WR-201: nextActionOverride and hubLifecycle in AssessmentDetail; 10-23 fix 4: analystRequestLifecycle"
provides:
  - "request-domain.ts: nextActionPresentation(nextAction, override?), the one presentation the hub and the stepper read"
  - "RequestLifecycleStepper ('use client', { lifecycle, nextActionOverride? }): below 768px the heading, Step n of m, the next action and a Show all steps / Hide all steps disclosure; from 768px the full stepper"
  - "RequestHub: its Next action line is hidden md:block (UI-D23, one next action per width)"
  - "AssessmentDetail: the stepper reads the hub's own lifecycle, hubLifecycle(analystRequestLifecycle(request), awaitingRefresh), and the same nextActionOverride (D-28)"
  - "E2E: UX08_PHONE_STEPPER (Requestor and Security Analyst at 375x812, then 1440) in request-relationship-states.spec.ts"
  - "zod-client-boundary.test.ts: all 18 app/(app) routes that validate nothing in the browser, the 6 that do documented, and a coverage test over every page directory"
  - "alert-domain.ts (zod-free): alertKinds, alertUrgencies, MAX_ALERT_PAGE, readAlertListUrlQuery"
  - "questionnaire-domain.ts is zod-free; questionnaire-submitted-answers.tsx holds the read-only submitted answers"
affects: [11-10, 11-11, 11-12, 11-14, 11-19, 11-21]

actuals:
  tokens: 13799
  tasks: 3
  commits: 6
plan_head_before: 1c7d2078b35fec1ea45bf523d7412f5d9c1cee64
plan_head_after: 58a24496b0c0afca379b97d05b4a3a465a27345a

tech-stack:
  added: []
  patterns:
    - "Two renders of one fact, one displayed per width: both lines stay in the DOM and read one presentation helper; md:hidden on the phone block, hidden md:block on the desktop line"
    - "A route's client modules read vocabularies and URL readers from a zod-free *-domain.ts; the *-schema.ts module re-exports them and delegates to the same reader"
    - "Every app/(app) route is classified for the zod guard, so a new route fails the coverage test until it is listed"

key-files:
  created:
    - apps/csrm/src/features/alerts/alert-domain.ts
    - apps/csrm/src/features/alerts/alert-domain.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-submitted-answers.tsx
  modified:
    - apps/csrm/src/features/requests/request-lifecycle-stepper.tsx
    - apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
    - apps/csrm/src/features/alerts/alert-list.tsx
    - apps/csrm/src/features/alerts/alert-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
    - apps/csrm/e2e/request-relationship-states.spec.ts
    - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts

key-decisions:
  - "11-09: nextActionPresentation keeps the plan's (nextAction, override?) signature; the hub folds a page's hrefs.nextAction into the served next action before calling it, so 11-08's holder rule still gates it"
  - "11-09: the step line is omitted when currentKey is not among the served steps (the analyst unit fixtures serve steps: []); the disclosure and next action still render"
  - "11-09: the stepper's list id is the fixed request-lifecycle-steps, beside the shipped fixed heading id; one stepper renders per page"
  - "11-09: the next-action link in the compact block is inline (wraps with the sentence), unlike the hub's inline-flex min-h-11 link"
  - "11-09: questionnaire-governance-workflow's two Next action assertions use filter({ visible: true }), because the preceding width sweep leaves the page at 375, not 1440 as the plan and E18 say"
  - "11-09: alertListUrlQuerySchema delegates to the zod-free readAlertListUrlQuery, so the server page and the browser read a URL with one implementation"
  - "11-09: the analyst questionnaire review renders the extracted read-only answers instead of QuestionnaireRenderer in read-only mode, so its route no longer reaches react-hook-form's zod resolver"
  - "11-09: UX-08 is shared with later Phase 11 plans: requirements.ready-ids reports 0/1 ready, so REQUIREMENTS.md is unchanged"

patterns-established:
  - "Compact phone presentation: one ol whose classes keep the desktop grid from md and are hidden below md until a disclosure expands it to one column"

requirements-completed: []

coverage:
  - id: D1
    description: "Below 768px the stepper reads its heading, Step n of m, Next action (a link only for the step's holder with an href) and a Show all steps disclosure with aria-expanded and aria-controls; the expanded list is one column and focus stays on the disclosure"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx#reads Step n of m, then the next action, then the disclosure below 768px (X-9, UI-SPEC §6.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx#reveals the full ordered list from the disclosure and keeps focus on it (D-26)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx#shows terminal text only when closed, with no next action"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx#sets the heading at the panel title size at every width and each step label as a caption at 500 (UI-D24)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One next action per width: nextActionPresentation is shared, the hub's line is hidden md:block, the compact block is md:hidden"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#nextActionPresentation"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#displays its next action line from 768px only, the override included"
        status: pass
    human_judgment: false
  - id: D3
    description: "On the analyst page the stepper reads the hub's lifecycle and override: the generation-job text in both lines as plain text, no action in either while awaiting the refresh (WR-201), none for a non-submitted request served the Submitted step (walkthrough fix 4)"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#says questionnaire generation is in progress, with no link, then refreshes once it completes and never names Generate again"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#names no questionnaire generation for a %s request with no questionnaire, because none is offered"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#names questionnaire generation for a submitted request with no questionnaire, beside the Generate control"
        status: pass
    human_judgment: false
  - id: D4
    description: "At 375x812 the heading, Step 2 of 8 and the next action sit within the first screen on both request pages; Show all steps reveals eight steps; at 1440 the compact block is hidden and the hub's line shows"
    requirement: "UX-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-relationship-states.spec.ts#UX08_PHONE_STEPPER ([desktop], sets 375x812 and 1440x900 itself)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every app/(app) route is in the zod client boundary guard, the six client-validating routes are documented, and no client module on the other eighteen reaches zod"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/zod-client-boundary.test.ts#zod in the browser"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/alerts/alert-domain.test.ts#readAlertListUrlQuery"
        status: pass
    human_judgment: false
  - id: D6
    description: "The phone stepper reads well at 375 (spacing, type and the disclosure's feel) and the full stepper is unchanged from 768px"
    verification: []
    human_judgment: true
    rationale: "Visual quality and the feel of the disclosure are judgment calls no test asserts; the UI review or the operator's UAT should look at both request pages on a phone"

duration: 53min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 09: Phone lifecycle stepper and the widened zod boundary Summary

**Below 768px both request pages now read `Current lifecycle state: {label}`, then `Step {n} of {m}`, then `Next action: …`, then a `Show all steps` disclosure that reveals the eight steps in one column. From 768px the full stepper shows as before, and the hub carries the one next action (`hidden md:block`). Both lines read one helper, `nextActionPresentation`. On the analyst page the stepper reads the hub's own lifecycle and Phase 10's generation-job override, so no width names an action the page does not offer. The zod guard now covers every `app/(app)` route. The Alerts list, both questionnaire lists and the analyst questionnaire review no longer download zod.**

## Performance

- **Duration:** 53 min. Wall clock covers four Playwright runs (two of them full suites) and three full web runs.
- **Started:** 2026-10-03T08:27:49Z
- **Completed:** 2026-10-03T09:21:18Z
- **Tasks:** 3 of 3
- **Files changed:** 24 (3 created, 21 modified, none deleted)

## Accomplishments

- **Compact stepper (D-26, X-9, UI-SPEC §6.3).** `RequestLifecycleStepper` is now a client component taking `{ lifecycle, nextActionOverride? }`.
  - **Phone block (`md:hidden`).** It shows, in this order:
    - `Step {n} of {m}` at body 500 with `tabular-nums`;
    - `Next action: ` and the summary;
    - an outline pill button, 44px tall: `Show all steps` with `ChevronDown`, or `Hide all steps` with `ChevronUp`, with `aria-expanded` and `aria-controls="request-lifecycle-steps"`.
  - **Spacing.** 8px between the heading, the step line and the next action, and 16px before the disclosure.
  - **List.** There is one `ol`, named `Assessment request lifecycle`. Its classes are `hidden` below `md` until expanded, then `grid` in one column. From `md` they keep the shipped `md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8`.
  - **Type.** The heading uses `text-heading-sm` at every width. The step labels are caption at 500 (`text-xs font-medium`, UI-D24).
  - **Edge cases.**
    - No lifecycle renders no stepper.
    - A closed request shows the terminal line and no next action.
    - A `currentKey` that is not among the served steps renders no step line.
- **One next action per width (UI-D23).**
  - `nextActionPresentation(nextAction, override?)` in `request-domain.ts` returns one of three things:
    - the override, as plain text;
    - otherwise the summary, with its href only when `holder === actor` and an href was served;
    - otherwise `null`.
  - The hub and the stepper both call it. The hub's line is `hidden md:block`.
- **Analyst page (D-28, walkthrough fix 4, WR-201).** `AssessmentDetail` renders `<RequestLifecycleStepper lifecycle={lifecycle} nextActionOverride={nextActionOverride} />`. The `lifecycle` is the same constant the hub receives, `hubLifecycle(analystRequestLifecycle(request), awaitingRefresh)`. Nothing passes the raw served lifecycle to the stepper any more.
- **Browser proof.** `UX08_PHONE_STEPPER` runs in the desktop project and sets each width itself.
  - **Requestor.** For a request created with `createSubmittedRequest`, at 375×812:
    - the heading, `Step 2 of 8` and `Next action: The Security Analyst is reviewing your request and will send you a questionnaire to answer.` (plain text) all end above 812px;
    - the hub's line is hidden;
    - the disclosure reveals 8 steps and keeps focus.
    - At 1440 the compact lines are hidden and the hub's line reads the same sentence.
  - **Security Analyst.** On the same request at 375×812:
    - `Step 2 of 8` and `Next action: Generate the questionnaire.` as a link sit within the first screen.
    - At 1440 the hub's line carries the link.
- **Zod boundary (UI-SPEC Notes carried).**
  - `routesWithoutClientValidation` lists 18 routes, up from 9.
  - `routesWithClientValidation` documents the six routes that validate in the browser:
    - request new and edit;
    - administration new, edit and import;
    - the Requestor's questionnaire.
  - A new coverage test fails on any `app/(app)` page directory that is in neither list.

## Chains the widened guard reported, and how each was fixed

| Route | Chain | Fix |
|---|---|---|
| `/app/alerts` | `alerts/page.tsx -> alert-list.tsx -> alert-schema.ts -> zod`, and two more through `risk-schema.ts` and `administration-schema.ts` | New zod-free `alert-domain.ts`: `alertKinds`, `alertUrgencies`, `MAX_ALERT_PAGE` and `readAlertListUrlQuery`. `alert-schema.ts` re-exports them, and its `alertListUrlQuerySchema` now delegates to the same reader. `AlertList` and `AlertListLoading` read the URL with `readAlertListUrlQuery`. The list imports only types from `alert-schema.ts`. |
| `/app/questionnaires` | `questionnaires/page.tsx -> questionnaire-list.tsx -> questionnaire-domain.ts -> zod` | `questionnaire-domain.ts` had a zod import itself, for `assessmentRequestRelationshipSchema`. The parser moves to `questionnaire-schema.ts`, with a `SameType` check against the new plain type `QuestionnaireRequestRelationship` in the domain module. The service and the schema test import it from there. |
| `/app/review/questionnaires` | `review/questionnaires/page.tsx -> questionnaire-review-list.tsx -> questionnaire-domain.ts -> zod` | Same fix as `/app/questionnaires`. |
| `/app/review/questionnaires/{documentId}` | `questionnaire-review.tsx -> questionnaire-renderer.tsx -> @hookform/resolvers/zod` and `-> zod` (plus the `questionnaire-domain.ts` chain) | Not in the plan's expected list. The analyst review rendered `QuestionnaireRenderer` in read-only mode, which statically imports the Requestor's form and its zod resolver. The read-only view moves to a new `questionnaire-submitted-answers.tsx`, which holds `SubmittedQuestionnaireAnswers`, `ReadOnlyQuestion`, `hasAnswerValue` and `questionFieldId`. The renderer shows it once submitted, with an unchanged DOM, and the analyst review renders it directly. |

The request hub's `assessmentStatuses` chain, which the plan expected, was not reported. The hub already imports the vocabulary from the zod-free `assessment-domain.ts` (WR-07); only a type is imported from `assessment-schema.ts`, and the guard erases it.

## Task Commits

1. **Task 1: on a phone both request pages read "Step n of m" and the next action first (tracer, TDD)**
   - `9f69a9f`: test(11-09), RED
   - `f1012f6`: feat(11-09), GREEN
2. **Task 2: prove the analyst page's phone stepper in the browser**
   - `0fe88d5`: test(11-09)
3. **Task 3: every route's client modules stay free of zod, then every journey (TDD)**
   - `20a2633`: test(11-09), RED
   - `44ca8f2`: test(11-09), the two journey locators (deviation 1)
   - `58a2449`: refactor(11-09), GREEN

The ledger count is `git rev-list --count 1c7d207..58a2449` = 6. All six commits end with the `Co-Authored-By: Claude Opus 5.5` trailer (checked with grep).

## TDD Gate Compliance

- **Task 1:** RED `9f69a9f` comes before GREEN `f1012f6`.
  - RED ran three files: 17 failed and 65 passed (82). Each failure was an assertion:
    - `the stepper’s compact block: expected null not to be null`, in 7 stepper cases and 7 analyst cases;
    - `expected undefined to be type of 'function'`, in 2 `nextActionPresentation` cases;
    - `toHaveClass("hidden md:block")` and `toHaveClass("text-heading-sm")`, which received the old classes.
  - The hub-line assertions and the `screen` absences passed at RED, as the plan predicted.
- **Tracer feedback gate (Task 1):**
  - The run was interactive, in end-of-phase mode, with an automated-only verify.
  - I re-ran the unit paths (29 files, 500/500) and the typecheck against the committed tree.
  - The Playwright half had passed 10/10 on content identical to the commit.
  - Task 2 started only after that.
- **Task 3:** RED `20a2633` comes before GREEN `58a2449`.
  - RED was 4 of 20 failing, each on the guard's `toEqual([])` assertion naming its chains. The new coverage test passed at RED.
  - The commit type is `refactor`, as the plan names it. Nothing user-visible changes, apart from the analyst review now rendering the same read-only DOM through a different module.
- The plan is `type: execute`, so the plan-level `tdd-red-evidence` check was not run. The failures above come from the RED runs' own output.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (stepper, hub, analyst review workflow) | 17 failed, 65 passed (82), 3 files |
| Task 1 GREEN, unit paths of the verify | 29 files, 500/500; typecheck clean |
| Full web suite before the Task 1 commit | 138 files, 2,982/2,982 |
| Task 1 Playwright, first run (two specs) | 9 passed, 1 failed (my own `UX08_PHONE_STEPPER` final assertion, which read the hub's `span`; see Issues); 2.2 min; tree clean apart from my uncommitted work |
| Task 1 Playwright, rerun | **10 passed (desktop 10), 0 failed, 0 flaky, 0 skipped; 1.8 min**. Tree clean apart from my uncommitted work |
| Task 2 unit (review workflow, `src/features/requests`) | 11 files, 144/144; typecheck clean |
| Task 2 Playwright (two specs) | **10 passed (desktop 10), 0 failed, 0 flaky, 0 skipped; 1.9 min**. Tree clean apart from my uncommitted spec edit |
| Task 3 RED, the guard | 4 failed, 16 passed (20) |
| Task 3 GREEN, unit paths (guard, alerts, questionnaires, requests) | 29 files, 460/460; typecheck clean |
| **Full web suite** (`pnpm --dir apps/csrm test`), Task 3 tree | **139 files, 2,999/2,999** |
| `lint` | clean |
| `api:check` | exit 0. `schema.d.ts` was refreshed with `git update-index --refresh`, stayed clean and was not staged |
| Full Playwright, first run (Task 3 tree) | 111 passed, 3 failed (deviation 1: the release journey on desktop, and the request journey on desktop and mobile); 14.5 min |
| **Full Playwright, rerun** (`pnpm --dir apps/csrm test:e2e`) | **114 passed: desktop 99, mobile 15; 0 failed, 0 flaky, 0 skipped; 14.6 min** (09:05:49Z to 09:20:27Z). Afterwards `git status --short` showed only my uncommitted work and the three operator items |
| Strapi suite | not run: the plan is web only and changed no Strapi file, contract or spec |

- **Servers.** Before every Playwright run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.
- **Harness state.** The two failing runs kept their database and Next build under `apps/backend/.tmp/` and `apps/csrm/.tmp/`, as the harness does after a failure. Both paths are ignored, so no tracked file changed.

## Files Created/Modified

- **Stepper and hub**
  - `request-lifecycle-stepper.tsx`: the compact block, the disclosure, the responsive list, and the UI-D23 comment.
  - `request-domain.ts`: `nextActionPresentation` and `NextActionPresentation`.
  - `request-hub.tsx`: calls the helper, with the line `hidden md:block`.
  - `assessment-detail.tsx`: the stepper takes the hub's `lifecycle` and `nextActionOverride`.
- **Zod boundary**
  - `alert-domain.ts` (new) and `alert-domain.test.ts` (new).
  - `alert-schema.ts`: re-exports, and the delegating URL schema.
  - `alert-list.tsx`: imports from the domain module.
  - `questionnaire-domain.ts`: zod-free, with a plain relationship type.
  - `questionnaire-schema.ts`: the relationship parser and its type check.
  - `questionnaire-service.ts` and `questionnaire-schema.test.ts`: import the parser from the schema module.
  - `questionnaire-submitted-answers.tsx` (new).
  - `questionnaire-renderer.tsx`: uses it.
  - `questionnaire-review.tsx`: renders it.
  - `zod-client-boundary.test.ts`.
- **Unit tests:** `request-lifecycle-stepper.test.tsx`, `request-hub.test.tsx`, `assessment-review-workflow.test.tsx` and `questionnaire-workflow.test.tsx`.
- **E2E**
  - `request-relationship-states.spec.ts`: the E18 locator at both widths, and `UX08_PHONE_STEPPER`.
  - `questionnaire-governance-workflow.spec.ts`: E18.
  - `assessment-release-workflow.spec.ts` and `requestor-request-workflow.spec.ts`: deviation 1.

## Decisions Made

- **The helper keeps the plan's signature.** The hub folds a page's `hrefs.nextAction` into the served next action before calling it. The page override therefore stays gated by 11-08's holder rule, and no production page passes one.
- **The step line is omitted for an unserved current step.** The analyst unit fixtures serve `steps: []`. Strapi always serves eight.
- **Ids are fixed.** The list id is the fixed `request-lifecycle-steps`, beside the shipped fixed `request-lifecycle-heading`. One stepper renders per page.
- **The compact next-action link is inline.** It wraps with its sentence, unlike the hub's `inline-flex min-h-11` link. WCAG 2.5.8 exempts a link inside a sentence from the target size.
- **The browser and the server read a URL the same way.** `alertListUrlQuerySchema` is now `z.record(...).transform(readAlertListUrlQuery)`, so there is one implementation. The existing `alert-schema.test.ts` cases pass through it unchanged.
- **UX-08 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: bug] Two journeys had locators the compact stepper made ambiguous (the E18 class, outside UI-SPEC §14.1's list)**
- **Found during:** Task 3, the first full Playwright run.
- **Issue:**
  - **`assessment-release-workflow.spec.ts:135`.** `main a[href^="/app/review/questionnaires/"]` with `.first()` resolved to the stepper's `Draft the assessment.` link, which is hidden from 768px. The run failed `ASSESS-01 authorised questionnaire relationship is visible at 1440px`.
  - **`requestor-request-workflow.spec.ts:48`.** On the analyst page at 375, the first button in `main` is now `Show all steps`. The run failed `REQUEST_MOBILE_REVERSAL_IS_FIRST_ACTION` in both projects.
- **Fix:**
  - The questionnaire link is read inside the hub's `Request relationships` region, which is what the test's comment says it proves.
  - The first workflow action is read among buttons other than the `Show all steps` / `Hide all steps` disclosure, which changes only what is shown.
  - No assertion's intent changed.
- **Verification:** the full suite reran with 114/114 passing.
- **Committed in:** `44ca8f2`, its own commit, before the refactor.

**2. [Plan fact] The governance spec's two Next action assertions run at 375, not 1440**
- The plan and UI-SPEC E18 place them at 1440. In fact, each follows an `expectAtBothWidths` sweep that ends at 375. Scoping them to `Request summary` would therefore read a hidden line.
- Both now use `.filter({ visible: true })`, which the plan allows, so each reads the one line displayed. The acceptance criterion ("scoped to a region or filtered to visible") holds.

**3. [Rule 3: blocking] A chain outside the plan's expected list: the analyst questionnaire review reached the Requestor's form**
- `/app/review/questionnaires/{documentId}` rendered `QuestionnaireRenderer` in read-only mode. That module statically imports `zodResolver` and `zod`.
- The plan's fix pattern, moving a value into a `*-domain.ts` module, cannot remove a component's dependencies. I extracted the read-only view into `questionnaire-submitted-answers.tsx` instead, with the same DOM and copy.
- `questionnaire-workflow.test.tsx` had two cases pinned to the renderer mock on the analyst page. They now assert the shared read-only answers: the analyst notice, every question heading, no textbox and no Save or Submit control.
- **Committed in:** `58a2449`.

**4. [Plan fact] questionnaire-domain.ts held the zod import itself**
- The plan assumed `questionnaire-domain.ts` was the zod-free destination for the questionnaire chains. In fact it defined `assessmentRequestRelationshipSchema`.
- The schema moved out to `questionnaire-schema.ts`, behind a compile-time `SameType` check, and the domain module keeps a plain type. The schema module does not re-export it from the domain module, because that would put zod back into the domain module.

**5. [Plan fact] The request hub's `assessmentStatuses` chain was already closed**
- The guard did not report it, and the hub needed no change in Task 3. It is listed in the plan's Task 3 files, but no edit was required (WR-07 had fixed it).

---

**Total deviations:**
- One test-locator fix in its own commit
- One extraction needed to clear an unexpected chain
- Three plan facts recorded with evidence

**Impact on plan:**
- No content type, Function, FunctionAPI, role, route, specification or dependency changed (D-01, D-02, T-11-SC).
- The stepper renders only served facts through `nextActionPresentation`, so it gives the Requestor no new field or link (T-11-24).
- Validation of external input stays in Server Actions and services (T-11-25).

## Issues Encountered

- **My own E2E assertion read the wrong element.** In the first Task 1 Playwright run, `UX08_PHONE_STEPPER`'s last assertion used `getByText(/^Next action: /)` inside `Request summary`. That resolved to the `<span>` lead, so `toHaveText` saw only `Next action: `. Every phone assertion before it had passed. Both hub-line reads in the test now use `locator('p').filter({ hasText: /^Next action: / })`. The fix went into the GREEN commit `f1012f6`, and the rerun passed.
- **Production server log noise.** The final full run logged 103 `The destination stream closed early` messages and one `failed-to-find-server-action`. 11-08 logged 126 and 1. No test asserts on them, and this plan changed no streaming code.
- **Line endings.** Git printed its usual LF-to-CRLF warnings for the files I wrote. The index stores LF, so each commit shows content changes only.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.

## Known Stubs

None.

## Threat Flags

None. There is no new endpoint, route, grant, file access or schema at a trust boundary. The new modules are presentation and URL reading, and the threat model covers them (T-11-24, T-11-25).

## User Setup Required

None.

## Next Phase Readiness

- Plans 11-10 to 11-12 can render a next action anywhere through `nextActionPresentation`, with the same holder rule.
- Every new `app/(app)` route must now be classified in `zod-client-boundary.test.ts`. The coverage test fails until it is. Quick find (11-19) and any new Home module must read their vocabularies from zod-free modules.
- The two journeys fixed here show that a hidden phone duplicate can make a page-wide `.first()` or `main` locator ambiguous. Later plans that add a second render of a control should grep the E2E suite for page-wide `.first()` locators.

## Self-Check: PASSED

- Files exist: `alert-domain.ts`, `alert-domain.test.ts`, `questionnaire-submitted-answers.tsx`.
- Commits `9f69a9f`, `f1012f6`, `0fe88d5`, `20a2633`, `44ca8f2` and `58a2449` are on `post-demo`, and each carries the trailer.
- Task 1 acceptance criteria re-ran PASS:
  - The stepper starts with `'use client'` and contains `Show all steps`, `Hide all steps`, `aria-controls` and `md:hidden`.
  - `request-domain.ts` exports `nextActionPresentation`, and `request-hub.tsx` calls it and contains `hidden md:block`.
  - `UX08_PHONE_STEPPER` sets `{ width: 375, height: 812 }`.
  - `assessment-detail.tsx` contains the exact stepper render, has 0 occurrences of `lifecycle={request.lifecycle}`, and keeps `hubLifecycle(analystRequestLifecycle(request), awaitingRefresh)`.
  - `nextActionLine()` is scoped to `Request summary`, and the compact block is asserted in the WR-201 test, the fix-4 `it.each` and the override case.
  - The governance spec's assertions are filtered to visible.
- Task 2 acceptance criteria re-ran PASS: `UX08_PHONE_STEPPER` signs in as the Security Analyst and asserts `Next action: Generate the questionnaire.` at 375×812, and its verify passed.
- Task 3 acceptance criteria re-ran PASS:
  - The guard lists `(app)/app/alerts`, `(app)/app/questionnaires` and `(app)/app/review/questionnaires`, and documents its exclusions.
  - `alert-domain.ts` has no zod import.
  - The full Playwright suite passed in both projects, and the tree was clean.
- The plan's verification passed: web suite 2,999/2,999, typecheck, lint and `api:check` are clean, and full Playwright is 114/114.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

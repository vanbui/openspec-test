---
phase: 08-production-integration-and-hardening
plan: 12
subsystem: accessibility
tags: [wcag-2.2, axe, label-content-name-mismatch, target-size, focus-not-obscured, reflow, text-spacing, page-titled, headings, generate-metadata, not-found, react-cache, playwright, vitest]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build harness and expectSettled (08-02); the Menu trigger, the in-shell and root not-found (08-09); the CSP collector (08-10); signInAs and the desktop and mobile projects (08-11)
provides:
  - apps/web/e2e/accessibility.spec.ts, the WCAG 2.2 AA sweep of 47 routes (79 route-actor pairs) for the Security Analyst, both Requestors and a signed-out visitor at 1440 and 375, five tags plus label-content-name-mismatch, settled, one h1, populated-content guards and zero CSP violations; keyboard, focus-not-obscured, reflow and text-spacing proofs
  - apps/web/e2e/helpers/focus.ts, expectFocusVisible and expectFocusNotObscured, shared by the sweep, the Risk Register and the Administration journeys
  - AdministrationAccessDenied({ kind }), the collection's PageHeader above the permission state, at all 12 call sites
  - the Requestor request detail and edit routes headed by the page in every state, and titled
  - src/lib/metadata/record-route-metadata.ts, recordRouteMetadata, which resolves a record route's title through the page's own cached read, so a 404 takes the not-found title
  - docs/accessibility/phase-08-wcag22-conformance.md, the WCAG 2.2 AA conformance record
affects: [08-13 (the full-suite time rises with the sweep), 08-14 (phase gate; residual register rows for the development sign-in title and the streamed 404 status), Phase 8 UI review (the exposure link wording, the development sign-in title)]

tech-stack:
  added: []
  patterns:
    - "A record route resolves its document title in generateMetadata through the page's own read wrapped in React cache(), and raises notFound() there on a 404: Next then renders the not-found convention's metadata even though the page has already streamed."
    - "Every refused or failed page renders its PageHeader (the page's one level-one heading, naming the page and never the record) above the shared state."
    - "An axe scan sets rule options before withTags, because AxeBuilder#options replaces every option set before it, and asserts the result's toolOptions and rule list."
    - "A link or button with its own aria-label keeps its visible words as the start of that name: adjacent label and count spans are separated by a whitespace text node, and a self-naming badge inside it drops its own label."

key-files:
  created:
    - apps/web/e2e/helpers/focus.ts
    - apps/web/src/lib/metadata/record-route-metadata.ts
    - apps/web/src/features/requests/request-routes.test.tsx
    - apps/web/src/features/assessments/released-assessment-route.test.ts
    - apps/web/src/components/shell/wordmark.test.tsx
    - docs/accessibility/phase-08-wcag22-conformance.md
  modified:
    - apps/web/e2e/accessibility.spec.ts
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/e2e/administration-workflow.spec.ts
    - apps/web/e2e/production-hardening.spec.ts
    - apps/web/e2e/assessment-navigation-lifecycle.spec.ts
    - apps/web/e2e/requestor-request-workflow.spec.ts
    - apps/web/e2e/analyst-insights.spec.ts
    - apps/web/src/features/administration/administration-workspace.tsx
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - apps/web/app/(app)/app/admin/[collection]/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/new/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/import/page.tsx
    - apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx
    - apps/web/app/(app)/app/requests/[documentId]/page.tsx
    - apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx
    - apps/web/app/(app)/app/assessments/[documentId]/page.tsx
    - apps/web/src/components/shell/wordmark.tsx
    - apps/web/src/components/csrm/risk-rating-badge.tsx
    - apps/web/src/components/csrm/bar-chart.tsx
    - apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - docs/design/csrm-design-direction.md

key-decisions:
  - "The request detail's denial is headed 'Assessment request' and the edit route's 'Edit assessment request', over a generic page description; neither names the record. Titles: 'Assessment Request | IdamBox CSRM' (the Requestor's sibling detail routes are named by record type) and 'Edit Request | IdamBox CSRM' (beside 'New Request')."
  - "A notFound() raised after streaming cannot change the resolved title, but one raised in generateMetadata makes Next render the not-found convention's metadata (next/dist/lib/metadata/metadata.js). The released assessment, request detail and request edit routes therefore resolve their title through the page's own read, wrapped in React cache() so it is one request; another Requestor's assessment now reads 'Page not found | IdamBox CSRM'. The streamed 200 stays: the installed docs give a real 404 only through a record check in proxy."
  - "No seeded request is a draft, so the plan's Submit request confirmation cannot be opened without creating a record, which the read-only sweep (T-08-12-03) forbids. The dialog proof uses the same shared ConfirmDialog on the Security Analyst's own submitted request (Return to draft, with its required reason field), cancelled with Escape, and a reload proves nothing changed."
  - "The Label in Name fixes keep every accessible name's meaning: the wordmark reads 'BProton, IdamBox CSRM home'; the dashboard rows keep '{label}: {n} {records}' with a word break the flex row does not draw; the exposure bars read '{Rating}: {n} open Risks by residual rating'. RiskRatingBadge keeps its Severity label everywhere except inside a link that names the rating."
  - "The Administration denial on the create, import and record pages needs the collection before the capability check; each reads it first, and the check order (capability, then collection) is unchanged."

patterns-established:
  - "recordRouteMetadata(read, title) for any record route whose read can answer 404."
  - "expectFocusVisible reaches the control by Tab from the stop before it; expectFocusNotObscured checks the sticky header and a scrolling table's sticky column."

requirements-completed: [INT-04]

duration: 1h 37m
completed: 2026-09-26
---

# Phase 08 Plan 12: WCAG 2.2 AA sweep of every route, actor and width, with the denials headed and titled and the conformance record Summary

**Every route now passes axe under the five WCAG A and AA tags with Label in Name enabled and no impact filter: 47 routes (79 route-actor pairs) for the Security Analyst, the Requestor, the Secondary Requestor and a signed-out visitor, at 1440 and 375. Each route is settled first, headed by exactly one level-one heading and proven populated. Refused pages are now headed by the page and never the record: the Administration denial by its collection, and another Requestor's request by `Assessment request`. A record the read reports missing is titled `Page not found | IdamBox CSRM`, because its route resolves the title through the page's own cached read. Label in Name found two defects, both fixed at the source: the wordmark link's name and the analyst dashboard's link rows and exposure bars. The criteria axe cannot decide have their own browser proofs: focus not obscured over fifteen Tab presses on six journey pages, reflow at 320, text spacing, and keyboard operation of the sheet, popover and confirmation dialog. `docs/accessibility/phase-08-wcag22-conformance.md` records the evidence. The sweep passed five consecutive isolated runs (55/55) and the full suite in both projects passed 71 of 71 in 10.5 minutes, leaving the tree clean.**

## Performance

- **Duration:** 1h 37m
- **Started:** 2026-09-26T00:18:31Z
- **Completed:** 2026-09-26T01:56:00Z (the metadata commit)
- **Tasks:** 3 of 3, plus the orchestrator's two additions (the request denial's heading and title; the in-shell not-found's title)
- **Files:** 33 across the code and record commits (6 created, 27 modified), plus this summary, STATE and ROADMAP

## Coverage (routes × actors × widths)

| Actor | Routes scanned (each at 1440 and 375) | Test |
|---|---|---|
| Security Analyst | 40: the personal dashboard; My Requests, the analyst's own request, New request, My Questionnaires, My Risk Assessments; the analyst dashboard; the request queue (two queues) and hub; the questionnaire review list and two reviews; the assessment review list and editor; the Risk Register and a Risk; Alerts; the report index and four reports; the four Administration lists, create forms, first records and imports; the in-shell not-found | shell, 06.8, 06.9, Phase 7, CSV import guidance, analyst lists … routes |
| Requestor | 19: dashboard, My Requests, New request, the request hub, the edit route's refusal, My Questionnaires, the draft questionnaire, My Risk Assessments, the released assessment; ten refusals | 06.8, 06.9, Phase 7, Requestor lists, record edit and refusal routes |
| Secondary Requestor | 18: dashboard, three empty lists, New request; Jane's request (403), questionnaire (403) and assessment (404); the ten refusals | Secondary Requestor lists and the denials of another Requestor’s records |
| Signed out | 2: `/sign-in`, `/app/this-route-does-not-exist` (404); the unavailable card in `production-hardening.spec.ts` | signed-out sign-in and the root not-found page |

79 route-actor pairs, 82 visits and 164 settled scans per run (three pairs are scanned by two tests), plus the unavailable card's two. 47 distinct routes, counting a record route once per record. The spec holds 33 distinct quoted route literals and 23 URL patterns.

## Violations found and fixed

| Rule | Component | Where it failed | Fix | Commit |
|---|---|---|---|---|
| One level-one heading (STATE follow-up 2026-09-25; 2.4.6) | `AdministrationAccessDenied` | every `/app/admin/*` route refused to a Requestor | the collection's `PageHeader` above the permission state, 12 call sites | `cf7d784` → `0fcd2dd` |
| One level-one heading; 2.4.2 Page Titled (orchestrator additions 1 and 2) | the request detail and edit pages; the released assessment route | another Requestor's request; a request past draft; another Requestor's assessment | page headings on every non-populated state; route titles; `recordRouteMetadata` | `cfcf1b5` → `3cdb326` |
| `label-content-name-mismatch` (2.5.3) | `Wordmark` (`components/shell/wordmark.tsx`) | every signed-in page, both widths | named `BProton, IdamBox CSRM home`; direction §4 Logo lockup corrected first | `39997fe` |
| `label-content-name-mismatch` (2.5.3) | `ReviewQueueBody` (six rows) and `BarChart` linked rows with `RiskRatingBadge` (four bars) on `/app/review` | the analyst dashboard, both widths | a whitespace text node between label and count; `RiskRatingBadge labelled={false}` inside a link that names the rating; exposure names `{Rating}: {n} open Risks by residual rating` | `d0cbbc7` |

No other rule failed on any route, actor or width: every scan ran `target-size` and `label-content-name-mismatch` (asserted) and found nothing else.

## The in-shell not-found's title (orchestrator addition 2)

- **Why the title was wrong:** Maya's direct URL to Jane's assessment raises `notFound()` inside the page after the shell has streamed. The page's static `metadata` had already resolved, so the title stayed `Released Risk Assessment | IdamBox CSRM`.
- **The supported way, read from the installed Next 16.3.6:** `notFound()` may be called in `generateMetadata` (`generate-metadata.md`). When it is, `createMetadataComponents` catches the HTTP-access-fallback error and renders `getNotFoundMetadata`, the not-found convention's metadata, in place of the route's (`next/dist/lib/metadata/metadata.js`), streaming metadata included. The metadata outlet also rethrows the error into the page tree, so the page and its title agree.
- **The implementation:** `recordRouteMetadata(read, title)` (`src/lib/metadata/record-route-metadata.ts`) awaits the page's own read and raises `notFound()` on a 404. The released assessment, request detail and request edit routes wrap their read in React `cache()` and pass it to both `generateMetadata` and the page, so it is one request.
- **Observed on the production build:** Maya on Jane's assessment gets the title `Page not found | IdamBox CSRM` at 1440 and 375, asserted in `assessment-navigation-lifecycle.spec.ts` (both projects) and the sweep. Jane's own assessment keeps `Released Risk Assessment | IdamBox CSRM`.
- **The status stays 200.** The installed docs (`not-found.md`, "Calling notFound() after streaming has started"; `loading.md`, "Status Codes") give a real 404 only by checking the record before streaming, in `proxy`. That would put an authorised Strapi read in the proxy for every navigation, so the 200 with Next's `noindex` stays and is recorded (conformance record, open finding 2).

## Task Commits

1. **Task 1: the Administration denial's heading (test-first)**
   - `cf7d784` test(08-12): expect the Administration denial to keep its page heading (RED: 6 of 25 failed, no level-one heading)
   - `0fcd2dd` fix(08-12): keep the page heading above the Administration permission state (GREEN: 25 of 25; web 84 files, 1603 tests)
2. **Orchestrator additions 1 and 2: the request denials' heading and the truthful titles (test-first)**
   - `cfcf1b5` test(08-12): expect the request routes and the released assessment to keep a heading and a truthful title in every state (RED: 9 of 9 failed)
   - `3cdb326` fix(08-12): head refused request pages by the page and title a missing record Page not found (GREEN: 9 of 9; web 86 files, 1614 tests; the lifecycle and hardening specs 12 of 12 on the production build)
3. **Task 2: the sweep, and the two fixes it forced (each before the test commit)**
   - `39997fe` fix(08-12): name the sidebar wordmark link by the word it shows
   - `d0cbbc7` fix(08-12): let the analyst dashboard's link rows and exposure bars show the words their names begin with (RED on the updated unit tests: 5 failed; GREEN: web 87 files, 1616 tests)
   - `2748402` test(08-12): sweep every route for both actors at both widths under the WCAG 2.2 AA tags with keyboard, focus and reflow proofs
4. **Task 3: the conformance record, the full run and the gate**
   - `d078f9e` docs(08-12): record the WCAG 2.2 AA conformance evidence for every route, actor and width

**Plan metadata:** the `docs(08-12): complete …` commit carrying this summary, STATE and ROADMAP.

## TDD Gate Compliance

- **Task 1:** `cf7d784` (RED, 6 failing: the permission case and the five heading cases) before `0fcd2dd` (GREEN).
- **Additions 1 and 2:** `cfcf1b5` (RED, 9 failing: no route title, no heading on the refused and failed states) before `3cdb326` (GREEN).
- **The sweep's fixes:** the browser sweep was the failing test. The first run failed 8 of 11 tests on `label-content-name-mismatch: .wordmark`, and a discovery run with soft scan assertions then listed every remaining violation (the analyst dashboard, both widths). The updated unit tests were run against the unfixed components first: 5 failed. Each fix is its own `fix(08-12)` commit before the sweep's `test(08-12)` commit, as the plan orders.

## Assertions changed deliberately, and why

**Unit (vitest)**

| File | Change | Reason |
|---|---|---|
| `administration-workflow.test.tsx` | the permission case asserts one level-one heading, `Risk Types`; a new case per collection and without one | Task 1 |
| `bar-chart.test.tsx` | the linked rows' names `Critical: 2 open Risks`, `High: 1 open Risk` (labelText `Critical`, badge `labelled={false}`); the link's text is `Critical 2`, opens its name, and nothing inside it names itself; `/^Critical2$/` → `/^Critical 2$/`, `/^High5$/` → `/^High 5$/`; `Existing0Planned3Implemented1` → `Existing 0Planned 3Implemented 1` | 2.5.3; the old assertions encoded the run-together text |
| `risk-rating-badge.test.tsx` | adds the `labelled={false}` case | the new prop |
| `analyst-dashboard.test.tsx` | the queue rows' visible words open their names; `/^Submitted3$/` → `/^Submitted 3$/`; the exposure names `{Rating}: {n} open Risks by residual rating`; no `Severity:` label inside the exposure links; `Not rated1` → `Not rated 1` | 2.5.3 |
| `analyst-dashboard-presentation.test.ts` | `labelText` is the rating word; the unit is `open Risk(s) by residual rating` | 2.5.3 |
| `report-views.test.tsx` | the eight `barLabels` expectations gain the word break (`Critical 1`, `Alpha system 2` …) | the shared `BarRowContent` now writes it |

**Browser (Playwright)**

| Spec | Change | Reason |
|---|---|---|
| `accessibility.spec.ts` | rewritten: `signInAs`, one scan helper with the five tags and the label rule, settle + one h1 + guard + CSP on every route; `'Requestor request hub'` title `IdamBox CSRM` → `Assessment Request \| IdamBox CSRM` | the sweep; addition 1 |
| `production-hardening.spec.ts` | `firstOwnRequest` title `IdamBox CSRM` → `Assessment Request \| IdamBox CSRM`; the `/app/admin/controls` refusal gains its heading `Controls`; the unavailable card's scan enables the label rule and asserts one h1 | additions 1; Task 1; D-26 on the sign-in states |
| `assessment-navigation-lifecycle.spec.ts` | Jane's request as Maya: one h1 `Assessment request` and the title; Jane's assessment as Maya: the title `Page not found \| IdamBox CSRM` | additions 1 and 2 |
| `requestor-request-workflow.spec.ts:151` | `IdamBox CSRM home` → `BProton, IdamBox CSRM home` (exact) | the wordmark fix |
| `analyst-insights.spec.ts:502` | `/^Critical residual rating: …/` → `/^Critical: [\d,]+ open Risks? by residual rating$/` | the exposure names |
| `risk-register-workflow.spec.ts`, `administration-workflow.spec.ts` | the local focus helpers replaced by `e2e/helpers/focus.ts`; the register adds `expectFocusNotObscured` on the focused sort button | Task 2 step 1. The Administration calls now reach the control by Tab from the stop before it rather than by programmatic focus, which is stronger. |

Nothing was loosened.

## Decisions Made

See `key-decisions` above. In short:
- **Headings name the page:** refused and failed pages are headed by the page they are.
- **Titles follow the state:** a record route resolves its title through the page's own cached read.
- **The dialog proof:** it uses the seeded return-to-draft confirmation instead of creating a draft.
- **Label in Name:** each fix keeps the names' meaning and puts the visible words first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's chain] `.withTags(...).options(...)` would have dropped the tags**
- **Found during:** Task 2, reading the installed `@axe-core/playwright` 4.11.0 (`options(options) { this.option = options; }`).
- **Issue:** the plan's chain calls `options` after `withTags`, and `options` replaces the whole option object, so the scan would have run axe's default rules plus the label rule, not the five tags.
- **Fix:** `.options({ rules: { 'label-content-name-mismatch': { enabled: true } } }).withTags(wcagTags)`. The scan helper asserts `results.toolOptions.runOnly` equals the five tags and that `label-content-name-mismatch` and `target-size` appear among the rules that ran.
- **Commit:** `2748402`.

**2. [Rule 1 - Bug] Label in Name on the wordmark and the analyst dashboard** (the violations table above).

**3. [Rule 1 - Bug in my own proof] A `:focus` selector cannot see a date input's own fields**
- **Found during:** Task 2, before commit. The first five-repeat run passed, but it counted fewer than fifteen stops on four pages. When the Tab loop was made to prove that an early end means Tab left the page, the next run failed on the questionnaire, whose active element was a date input.
- **Issue:** while Tab moves through a date input's day, month and year, focus sits in the input's internal shadow tree, and `page.locator(':focus')` matches nothing. The loop had stopped at the first date input on the questionnaire and the editor, instead of at the end of the page.
- **Fix:** `expectActiveElementNotObscured` reads `document.activeElement`. The loop ends early only when nothing in the document holds focus. The questionnaire and the editor now reach all fifteen presses; the released assessment (one link) and the CSV import's Guidance step (five stops) end because Tab leaves the page, which is asserted.
- **Verification:** the five-repeat run was repeated on the final spec: 55/55.
- **Commit:** `2748402`.

**4. [Rule 2 - Must-have] The label rule on the unavailable sign-in card.** The must-have covers the sign-in states with the label rule enabled; the 08-02 scan in `production-hardening.spec.ts` lacked it. It now sets the rule before the tags and asserts one h1. Commit `2748402`.

### Plan-text deviations

5. **The confirmation-dialog proof uses `Return to draft`, not `Submit request`.** No seeded request is a draft, and the `Submit request` confirmation is offered only on a draft. Creating one would break the read-only sweep (T-08-12-03, "no mutation in the sweep"). The same shared `ConfirmDialog` (a Radix alert dialog) is proven on the Security Analyst's own submitted request, `Other Requestor security assessment`: opened by Enter at 1440 and 375, focus kept through Tab ×5 and Shift+Tab ×5, cancelled by Escape with focus returned. A reload shows the request still `Submitted`.
6. **The Requestor's edit route is scanned in its refusal state.** Every seeded request of Jane's is past draft, so `/app/requests/{id}/edit` renders its refusal, now under the page's heading. The populated edit form is the create form's `RequestForm` plus one `Submit request` control. The create form is scanned for all three actors, and the request journey drives the edit form at both widths.
7. **The Tab sweep starts from `main`.** It moves the sequential focus start there through the skip link and then presses Tab fifteen times, rather than taking the page's first fifteen stops. Those would be the skip link and the sidebar, which the header never covers.
8. **Text spacing is checked at 1440 and 375, and reflow at 320,** on the plan's six pages.
9. **Orchestrator additions in scope:** the request detail and edit denials' headings and titles, and the in-shell not-found's title, with `recordRouteMetadata` on three routes.
10. **The Secondary Requestor is swept over the ten refusals too** (T-08-12-02, "for both Requestor identities"), besides the plan's lists and Jane's three URLs.
11. **Windows host translations, as the preamble sets out:**
    - Node 24 from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`;
    - ports checked with `Get-NetTCPConnection`;
    - logs in `apps/web/.tmp/logs/csrm-phase-08/`;
    - `--project=desktop`;
    - targeted unit runs through `pnpm --filter @csrm/web exec vitest run <paths>`.

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 2) and 7 recorded. **Impact:** there is no Strapi source, content-type schema, contract, grant, `CSRM_AI_*` or Keycloak change, and no new dependency. The product changes are headings, titles and the names or text of four components; `RiskRatingBadge` gains one optional prop.

## Issues Encountered

- **The first sweep run failed 8 of 11 tests,** all on the wordmark's Label in Name; the signed-out test passed, which proved the scan helper itself was sound. The discovery run with soft scan assertions then showed the analyst dashboard as the only other failing surface.
- **A stopped run left its servers running.** Stopping the corrected five-repeat run (to fix the Tab loop) left its Strapi (port 23188) and `next start` (43188) processes alive. I stopped exactly that run's eight processes, identified by start time and command line, and nothing else. Ports 1337 and 3000 were never used.
- **Server log noise:** the production server logged `The destination stream closed early.` 26 times in the full run, against 16 after 08-11. This is the known 08-02 note: a navigation away from a page that is still streaming, and the sweep makes many more navigations. No test failed, and the browser console stayed clean.
- **Google Fonts:** the transient did not recur. Every `next build` in this plan (eight runs, the stopped repeat included) compiled.

## Verification

| Command | Result |
|---|---|
| Task 1 RED: `vitest run src/features/administration/administration-workflow.test.tsx` | 6 failed, 19 passed (no level-one heading on the denial) |
| Task 1 GREEN: the same with the list-state guard; `pnpm --filter @csrm/web test`; `typecheck` | 28 passed; **84 files, 1603 tests**; exit 0 |
| Task 1 greps: `<AdministrationAccessDenied kind=` in `apps/web/app`, `<AdministrationAccessDenied` in `apps/web/app`, `kind=` sites in the workspace | 10, 10, 2 |
| Additions RED: `request-routes.test.tsx`, `released-assessment-route.test.ts` | 9 failed of 9 |
| Additions GREEN: the same; `pnpm --filter @csrm/web test`; `typecheck` | 9 passed; **86 files, 1614 tests**; exit 0 |
| `test:e2e --project=desktop e2e/assessment-navigation-lifecycle.spec.ts e2e/production-hardening.spec.ts` (after the additions) | **12 passed** (1.7 min) |
| First sweep run | 3 passed, 8 failed (`label-content-name-mismatch: .wordmark`) |
| Discovery run (soft scan assertions, not committed) | 10 passed, 1 failed (the analyst dashboard at both widths) |
| Label-in-name fixes RED: the updated bar-chart, badge, dashboard and presentation tests | 5 failed |
| GREEN: those files, then `pnpm --filter @csrm/web test`, `typecheck` | 106 passed; **87 files, 1616 tests**; exit 0 |
| `test:e2e --project=desktop --project=mobile` risk-register, administration, requestor-request, analyst-insights, production-hardening | **27 passed** (3.8 min) |
| **`test:e2e --project=desktop e2e/accessibility.spec.ts --repeat-each 5`, final spec** | **55 passed / 0 failed / 0 flaky** (9.2 min, 556 s wall; 01:18:03 to 01:27:19Z) |
| **`pnpm --filter @csrm/web test:e2e`, full, both projects** | **71 passed / 0 failed / 0 flaky**, no retries (10.5 min, 630 s wall; 01:27:49 to 01:38:19Z): `desktop` 67, `mobile` 4 |
| `git status --porcelain` before and after the full run | unchanged by the run (the only differences were my own STATE and ROADMAP edits made while it ran); `next-env.d.ts` and `test-results/` are ignored by design |
| **`pnpm --filter @csrm/strapi test`** | **504 passed / 0 failed / 0 skipped** (618.6 s; 623 s wall, 01:38:54 to 01:49:17Z); the count is unchanged, and no Strapi file changed |
| **`pnpm --filter @csrm/web test`**, final tree | **87 files, 1616 tests passed** (21.7 s) |
| **`pnpm --filter @csrm/web typecheck`** | exit 0 |
| **`pnpm --prefix apps/web api:check`** | exit 0, no drift |
| Task 2 acceptance on `accessibility.spec.ts` | `wcag22aa` 2, `label-content-name-mismatch` 2, `expectSettled` 8, `signInAs` 13, `expectNoCspViolations` 4, `Secondary Requestor` 12, `/app/this-route-does-not-exist` 1, `320` 7, `letter-spacing` 1, `expectFocusNotObscured` 3; `.filter(({ impact })` 0; 678 lines (min 300); 33 quoted route literals plus 23 URL patterns (47 distinct routes swept) |
| `e2e/helpers/focus.ts` exports; local focus helpers left in the two journeys | `expectFocusVisible`, `expectFocusNotObscured`, `expectActiveElementNotObscured`; `expectFocusIsVisible` and `expectKeyboardFocus` 0 |
| Frozen paths since `cd68e4c` (`apps/strapi`, `docs/references`, `.env*`, content-type schemas); added lines naming `CSRM_AI_` or Keycloak | empty; 0 |
| Tool attribution in this plan's commit messages, added lines and documents; commit trailers | 0; 0 |

## Known Stubs

None.

## Threat Flags

None. No endpoint, grant, trust boundary or data path is added:
- `recordRouteMetadata` awaits the same typed, authorised read the page already makes, deduplicated by React `cache()`.
- The denials render copy only.

Each mitigation holds:
- **T-08-12-01:** the per-criterion proofs and the record.
- **T-08-12-02:** every refusal for both Requestor identities is checked for the permission state, one alert and no record link. Jane's three URLs as Maya are checked for no record facts in the lifecycle journey.
- **T-08-12-03:** the confirmation is cancelled, and a reload proves nothing changed.

## Open issues for the orchestrator (also in STATE "Found in 08-12")

1. **The development sign-in's title is `IdamBox CSRM`,** pinned by 08-02 (`sign-in-page.test.tsx`). `Development sign-in | IdamBox CSRM` would describe the page; that is a UI review decision.
2. **A streamed not-found answers 200 with `noindex`.** A real 404 needs a record check in `proxy`. For the residual register.
3. **Other detail routes and nonexistent ids.** The questionnaire detail and the analyst review details keep their route title over `Page not found` for a nonexistent id. `recordRouteMetadata` would fix each; no Requestor reaches that state through another Requestor's record.
4. **The exposure link wording changed** from 07-UI-SPEC §7.2. The UI review should confirm it.

## Browser backstops for the orchestrator

Against `next dev` on port 3000.

1. **The Administration denial at 375, as Requestor:** `/app/admin/risk-types`, `/app/admin/controls/new` and `/app/admin/information-assets/import` each show one heading naming the collection (`Risk Types`, `Controls`, `Information Assets`) above the `You don’t have access to Administration records` state, titled `Risk Types | IdamBox CSRM`, `Create Control | IdamBox CSRM` and `Import Information Assets CSV | IdamBox CSRM`.
2. **The Secondary Requestor on Jane's records, at 375 and 1440:**
   - Jane's request shows the heading `Assessment request` above the permission state, and the tab title is `Assessment Request | IdamBox CSRM`.
   - Jane's questionnaire shows `Questionnaire unavailable`.
   - Jane's assessment shows `Page not found` in the shell, and the tab title is `Page not found | IdamBox CSRM`.
   - Nothing names Jane's records.
   - Get the URLs as Requestor from My Requests (`Customer portal questionnaire draft request`), My Questionnaires (`Customer portal questionnaire draft`) and My Risk Assessments (`ASM-E2E-NAV-OWNER-001`).
3. **Jane's own records** keep their titles: the request `Assessment Request | IdamBox CSRM`, and the released assessment `Released Risk Assessment | IdamBox CSRM`.
4. **A VoiceOver- or NVDA-style check of names,** as Security Analyst:
   - At 375 the trigger announces `Menu, button, collapsed`.
   - The sidebar wordmark announces `BProton, IdamBox CSRM home, link`.
   - On `/app/review` the queue rows read like `Requires my attention: 8 Assessment Requests`, and the exposure bars `Critical: 2 open Risks by residual rating`. Each row still looks the same: label, count, chevron.
5. **Keyboard at 375:** Tab, Tab to `Menu`, Enter, Tab through the sheet, then Escape returns to `Menu`. On your own submitted request (`Other Requestor security assessment` in My Requests), `Return to draft` opens by Enter and Escape cancels it. Do not confirm it.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-11. INT-04 closes at the phase gate (08-14).
- **08-13 can start.** Its suite-time baseline grows by the sweep: 71 tests (67 desktop, 4 mobile) in 630 s wall, against 65 in 554 s after 08-11. The accessibility spec now takes about 106 s of test time.
- **08-14:** the residual register takes open findings 1 to 3 of the conformance record.

## Self-Check: PASSED

- **Created files exist:**
  - `apps/web/e2e/helpers/focus.ts`
  - `apps/web/src/lib/metadata/record-route-metadata.ts`
  - `apps/web/src/features/requests/request-routes.test.tsx`
  - `apps/web/src/features/assessments/released-assessment-route.test.ts`
  - `apps/web/src/components/shell/wordmark.test.tsx`
  - `docs/accessibility/phase-08-wcag22-conformance.md`
- **The eight plan commits are on `dev`:** `cf7d784`, `0fcd2dd`, `cfcf1b5`, `3cdb326`, `39997fe`, `d0cbbc7`, `2748402` and `d078f9e`.
- **Acceptance criteria re-run on the final tree:**
  - Task 1: the greps 10, 10 and 2; the one-h1 unit assertions.
  - Task 2: every listed string, no impact filter, 678 lines, the three `focus.ts` exports, and no local focus helper left.
  - Task 3: the record has a row for each of the nine criteria and for dialogs and sheets, the required strings, and the test titles.
  - The gate commands exit 0.
- **Every Markdown table** in the record, this summary, STATE and deferred-items has consistent cells.
- **No tool attribution or trailer** in this plan's commits, added lines or documents.

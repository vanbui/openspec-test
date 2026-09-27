# WCAG 2.2 AA conformance record (Phase 8)

- **Date:** 2026-09-26
- **Standard:** WCAG 2.2, Level A and Level AA (brief §21 "Target WCAG 2.2 AA quality").
- **Decisions:** D-25 (axe on every route for every actor at 375 and 1440, and this record for what axe cannot decide), D-26 (Label in Name, the `Menu` trigger), D-13 (scans only settled destinations).
- **Threats:** T-08-12-01 (criteria axe cannot decide left unrecorded), T-08-12-02 (a denial rendering data before its permission state), T-08-12-03 (the keyboard proof submitting a request).
- **Build under test:** the production build (`next build`, then `next start`, `NODE_ENV=production`) inside the attested E2E runtime, against `strapi develop` with the seeded, run-isolated SQLite database. Next 16.3.6, React 19.2.4.
- **Tools:** Playwright 1.58.2 driving Chromium 145.0.7632.6 (Chrome for Testing); `@axe-core/playwright` 4.11.0 with axe-core 4.11.4.
- **Evidence:** `apps/web/e2e/accessibility.spec.ts` (the sweep and the proofs below), `apps/web/e2e/helpers/focus.ts`, the journey specs each row cites, and the unit tests named in the fixes table. Measured on commit `2748402` (the sweep) and the tree after it; the run figures are under "Runs".

## Scope

| Dimension | Covered |
|---|---|
| Actors | Security Analyst (Bob), Requestor (Jane), Secondary Requestor (Maya, who owns no record) and a signed-out visitor |
| Widths | 1440×900 and 375×812 for every route; 320×568 for reflow |
| Rule set | axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, plus `label-content-name-mismatch`, which axe ships disabled. No impact filter: a violation of any impact fails the scan. `target-size` (2.5.8) is in `wcag22aa`. |
| States | Populated, empty, refused (the shared permission state), the questionnaire's own refusal, the in-shell not-found (a streamed `notFound()`), the root not-found (404), both sign-in states. Loading states are never scanned: every scan waits for the settled destination. The error state is scanned by the design-contract and conformance suites' guarded fixtures (`design-contract.spec.ts`, `design-system-conformance.spec.ts`), which filter to serious and critical; it is not reachable on a healthy build. |

## Method

Every route goes through one path, `expectAccessibleAtBothWidths` in `accessibility.spec.ts`. At each width, in this order:

1. **Settled (D-13).** `expectSettled` waits for the destination URL, the route's exact document title, its level-one heading by name, and no skeleton or busy region. A scan never measures the page being left.
2. **Exactly one level-one heading.** Refusals and not-found pages included (the Administration and request-detail denials gained theirs in this plan).
3. **Populated-content guard.** An axe pass cannot tell a list from its error state (the 2026-09-24 lesson), so each route first proves what it rendered: a non-zero result total and the fixture's record link on a list; the first field of a form; a region only the populated page draws on a detail; the shared permission state headed with the refused area, one alert and no record link on a refusal; the empty state and no record link on an empty list. No route renders an error state (`[data-state-kind="error"]` count 0).
4. **The scan.** `AxeBuilder#options` sets `label-content-name-mismatch` first, because the method replaces every option set before it, then `withTags` sets the five tags. The result's own `toolOptions` and rule list are asserted, so a reordering cannot silently drop the tags or the rule. `violations` must equal `[]`.
5. **No horizontal page overflow** (`document.documentElement.scrollWidth <= innerWidth`).
6. **No Content-Security-Policy violation** (`e2e/helpers/csp.ts`, attached once per test).

The criteria axe cannot decide have their own proofs, listed under "Criteria axe cannot decide".

## Route coverage

Every route below is scanned at 1440 and 375 by the test named. "Record" routes open the fixture record named in the spec.

### Security Analyst

| Route | State scanned | Test (`accessibility.spec.ts`) |
|---|---|---|
| `/app` | personal dashboard, seven lifecycle cards | has no axe violations in the signed-in CSRM shell |
| `/app/requests` | populated (`Other Requestor security assessment`) | has no axe violations on the analyst lists, create forms, records and administration routes |
| `/app/requests/{id}` (the analyst's own submitted request) | populated, request actions | same |
| `/app/requests/new` | the request form | same |
| `/app/questionnaires`, `/app/assessments` | the analyst's own records or the empty state | same |
| `/app/review` | four KPI tiles with figures | has no axe violations on phase 07 analyst surfaces |
| `/app/review/requests`, `?queue=released` | populated queues | has no axe violations on phase 06.8 governed questionnaire surfaces |
| `/app/review/requests/{id}` | the request hub | same |
| `/app/review/questionnaires` | populated | analyst lists, create forms, records and administration routes |
| `/app/review/questionnaires/{id}` ×2 | awaiting release; released | phase 06.8 governed questionnaire surfaces |
| `/app/review/assessments` | populated (`ASM-E2E-NAV-ANALYST-001`) | analyst lists, create forms, records and administration routes |
| `/app/review/assessments/{id}` | the editor with its lifecycle and identified Risks | phase 06.9 assessment lifecycle detail surfaces; analyst lists … routes |
| `/app/risks` | populated (`RSK-DEV-MUTABLE-001`) | analyst lists, create forms, records and administration routes |
| `/app/risks/{id}` | the Risk detail | same |
| `/app/alerts?kind=risk-treatment-overdue` | populated (`RSK-E2E-P7-OVERDUE-001`) | phase 07 analyst surfaces |
| `/app/reports` and the four reports | the report index; a section table on each report | same |
| `/app/admin/{risk-types,controls,information-systems,information-assets}` | populated | analyst lists, create forms, records and administration routes |
| each collection's `/new` | the form's first field | same |
| each collection's first record `/{documentId}` | the record, `Edit {Label}` | same |
| each collection's `/import` | the Guidance step, `Choose CSV file` | same; CSV import guidance (Risk Types) |
| `/app/admin/not-a-collection` | the in-shell not-found | analyst lists, create forms, records and administration routes |

### Requestor

| Route | State scanned | Test |
|---|---|---|
| `/app` | seven lifecycle cards | has no axe violations on the Requestor lists, record edit and refusal routes; phase 06.8 surfaces |
| `/app/requests`, `/app/questionnaires`, `/app/assessments` | populated with Jane's fixtures | Requestor lists, record edit and refusal routes |
| `/app/requests/new` | the request form | same |
| `/app/requests/{id}` | the request hub (`Customer portal questionnaire draft request`) | phase 06.8 governed questionnaire surfaces |
| `/app/requests/{id}/edit` | the refusal of a request past draft, under the page's heading `Edit assessment request` | Requestor lists, record edit and refusal routes |
| `/app/questionnaires/{id}` | the draft questionnaire with its completion summary | phase 06.8 governed questionnaire surfaces |
| `/app/assessments/{id}` | the released assessment with its lifecycle | phase 06.9 assessment lifecycle detail surfaces |
| `/app/review`, `/app/alerts`, `/app/reports`, `/app/reports/risk-exposure` | refusals | phase 07 analyst surfaces |
| `/app/risks`, `/app/review/requests`, `/app/review/questionnaires`, `/app/review/assessments`, `/app/admin/risk-types`, `/app/admin/controls/import` | refusals | Requestor lists, record edit and refusal routes |

### Secondary Requestor

| Route | State scanned | Test |
|---|---|---|
| `/app` | seven lifecycle cards (all zero) | has no axe violations for the Secondary Requestor lists and the denials of another Requestor’s records |
| `/app/requests`, `/app/questionnaires`, `/app/assessments` | empty states | same |
| `/app/requests/new` | the request form | same |
| Jane's `/app/requests/{id}` | Strapi 403: the shared permission state under `Assessment request`, titled `Assessment Request \| IdamBox CSRM` | same |
| Jane's `/app/questionnaires/{id}` | Strapi 403: `Questionnaire unavailable` and its permission alert | same |
| Jane's `/app/assessments/{id}` | Strapi 404: the in-shell `Page not found`, titled `Page not found \| IdamBox CSRM` | same |
| the ten refusals above | refusals | same |

### Signed out

| Route | State scanned | Test |
|---|---|---|
| `/sign-in` | the development sign-in (three identities) | has no axe violations on the signed-out sign-in and the root not-found page |
| `/app/this-route-does-not-exist` | the root not-found card, HTTP 404 | same |
| `/sign-in` on a build without the run attestation | the unavailable card | `production-hardening.spec.ts` › a production build without the run attestation refuses the development sign-in (five tags and the label rule, at 375 and 1440) |

`app/global-error.tsx` cannot be reached on a healthy build. Its proof is the component test from plan 08-09, `src/lib/security/root-fallbacks.test.tsx`: the card renders `Something went wrong` as its level-one heading, in its own document with the title `Something went wrong | IdamBox CSRM`, and never renders the error it receives.

**Totals per run:** 47 distinct routes (a record route counts once per record), 79 route-actor pairs, 82 route visits and 164 settled scans (every visit at 1440 and at 375), plus the unavailable sign-in card at both widths in `production-hardening.spec.ts`. Three pairs are scanned by two tests: Jane's dashboard, the analyst's assessment editor and the Risk Types import.

## Results the scan decides

Zero violations on every route above, at both widths, for every actor, after the three fixes in "Fixed in this plan". Since the phase UI review the open navigation sheet at 375 is scanned too (B-1). Every scan asserted that `label-content-name-mismatch` and `target-size` ran.

## Criteria axe cannot decide

| Criterion | Where it applies | Evidence | Result |
|---|---|---|---|
| **2.4.11 Focus Not Obscured (Minimum)** | The sticky application header (`.header`, 56px below 768 and 64px from 768) over scrolled content, and a scrolling DataTable's sticky identifier column. A DataTable's sticky `thead` sticks inside its own scroller, which never scrolls vertically, so it covers no row. | `html { scroll-padding-top }` equals the header height at each breakpoint and `[data-overflow="true"] { scroll-padding-inline-start }` equals the sticky column's width (`globals.css`, 08-08). `accessibility.spec.ts` › focus is never obscured and text reflows: on the six journey landing pages (My Requests, the questionnaire, the released assessment, the risk assessment editor, the Risk Register and the CSV import) at 1440 and 375, the skip link moves the sequential focus start into `main`, and after each of the next fifteen Tab presses the element holding focus passes `expectActiveElementNotObscured` (`e2e/helpers/focus.ts`): its top edge is at or below the header's bottom edge, and inside a scrolling table its start edge is at or beyond the sticky cell's end edge. Focus is read from `document.activeElement`, because while Tab moves through a date input's own fields no `:focus` selector matches the input. A page with fewer stops ends early only when Tab has left the page and nothing in it holds focus. The keyboard test checks the focused `More filters` and `Return to draft` the same way (`expectFocusNotObscured`), and `risk-register-workflow.spec.ts` the focused `Sort by Target date` at 1440. Measured, the same at 1440 and 375: fifteen presses clear on My Requests, the questionnaire, the risk assessment editor and the Risk Register; the released assessment has one focusable element in `main` (its originating-request link) and the CSV import's Guidance step five, after which Tab leaves the page. | Pass |
| **2.5.3 Label in Name** | Every control whose name is not its content. | `label-content-name-mismatch` is enabled on every scan. It found two defects, both fixed (see "Fixed in this plan"). Reviewed `aria-label` sites that pass: the navigation sheet's close control, `Close navigation` (shows "Close"); DataTable sort buttons, `Sort by {header}` (show the header); the rating badge, `Severity: {rating} ({n} of 4)` (shows the rating word; inside a link that names the rating it now carries no label of its own); the dashboard queue rows, `{label}: {n} {records}`; the exposure bars, `{Rating}: {n} open Risks by residual rating`; the relation pickers' `Remove {name}` (shows "Remove"); the wordmark, `BProton, IdamBox CSRM home` (shows "BProton"). Icon-only controls have no visible text to contain: the filter-chip remove buttons, `Remove {label} filter`, and the pagination buttons. The mobile trigger is named by its content, `Menu` (D-26, plan 08-09), and exposes `aria-expanded` and `aria-controls`. | Pass |
| **2.5.8 Target Size (Minimum)** | Every pointer target. | axe `target-size` ran in every scan with zero violations. Row controls inside DataTable rows are at least 24×24px (`[&_button]:min-h-6 min-w-6`), sort buttons `min-h-6 min-w-6`, card identifier links `min-h-6` or `min-h-11`, dashboard link rows and bar links `min-h-11`, and buttons reach the 44px touch height below 768 (direction §4 Buttons). Exception used: record links inside table cells and sentences are inline text targets (the criterion's inline exception). | Pass |
| **1.4.10 Reflow** | Every page at 320 CSS px. | focus is never obscured and text reflows: at 320×568 the six journey landing pages have `scrollWidth <= 320`. Every sweep route has no horizontal overflow at 375. Exception used: a table wider than its container scrolls inside its own labelled, focusable region (`{table}, scrolls horizontally`, X-2), the two-dimensional layout the criterion exempts; the page itself never scrolls sideways. | Pass |
| **1.4.12 Text Spacing** | All text. | focus is never obscured and text reflows: on the six pages at 1440 and 375, a style tag applies `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em` to everything and `margin-bottom: 2em` to paragraphs, all `!important`. The page does not scroll sideways, `main` is no wider than its box, and no badge, page title or heading is clipped by its own box (`scrollWidth <= clientWidth`; no `overflow: hidden` or `clip` element whose `scrollHeight` exceeds its `clientHeight`). | Pass |
| **2.4.7 Focus Visible** | Every focusable element. | `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`, the inverse ring in the sidebar and the sheet (direction §3.7). `expectFocusVisible` (`e2e/helpers/focus.ts`) reaches a control by Tab from the stop before it, reads its outline and box-shadow at rest (while the stop before it holds focus) and again once Tab has reached it, each after its transitions settle, and asserts that focus adds a visible outline or shadow layer the resting control lacks. A shadow the control carries at rest, such as a primary button's, and an outline in a transparent colour are not indicators (corrected after the phase code review, SR-04, `e482a5c`: as first written the helper passed on any computed outline or ring, a resting shadow included). It runs on `More filters`, `Return to draft` (1440 and 375) and `Choose CSV file` (1440 and 375) in the keyboard test, and in the journeys: the Target date fields and `Sort by Target date` (Risk Register), a Risk's related-record link, `Search reusable Controls`, `Create Control`, `Create Information System` and `Choose CSV file` (Administration). | Pass |
| **3.2.6 Consistent Help** | Help mechanisms repeated across pages. | No page offers a help mechanism: no contact details, contact form, chat or self-help link. The error and permission states' sentence "If the problem continues, contact your administrator" names no contact and is state copy, in the same place in every state. | Not applicable |
| **3.3.7 Redundant Entry** | Multi-step processes. | The request edit form comes back filled with the saved values, the retained Information Systems and Information Assets included (`requestor-request-workflow.spec.ts`); a questionnaire draft keeps its saved answers (`questionnaire-workflow.spec.ts`). The CSV import asks for the same file again at commit: the preview digest binds the commit to the bytes that were reviewed (Phase 6), the criterion's exception for re-entry needed for security. | Pass |
| **3.3.8 Accessible Authentication (Minimum)** | Sign-in. | The development sign-in is three buttons, one per fixture identity: no password, code or puzzle. Outside the attested runtime the page is the unavailable card with no form. Real authentication (Keycloak, INT-02) is deferred by operator decision; its login page must allow paste and password managers, to be checked when INT-02 lands. | Pass (development sign-in); deferred with INT-02 |
| **Keyboard operability of dialogs and sheets** | The navigation sheet, the Risk Register's More filters popover and Filters sheet, confirmation dialogs. | `accessibility.spec.ts` › keyboard operability of dialogs and sheets: at 375, Tab reaches `Menu` after the skip link, Enter opens the sheet and focuses `Close navigation`, `aria-expanded` goes false to true, Tab through every stop plus two and Shift+Tab ×3 keep focus inside, and Escape closes it and returns focus to `Menu`. With the sheet open and its entrance settled, the page is scanned with the five tags and the label rule (added after the phase UI review, B-1: the sheet's `Close` control inherited the sheet's light text on its white pill, 1.09:1, and no scan saw the sheet open; the outline variant now draws its label in ink). At 1440, More filters opens from the keyboard and moves focus into its fields, and Escape returns focus to it. At 1440 and 375 the `Return to draft` confirmation opens with Enter, takes focus, keeps it through Tab ×5 and Shift+Tab ×5, and Escape cancels it and returns focus to its trigger; a reload shows the request still `Submitted`. Cited as well: `app-shell.spec.ts` (focus returns to `Menu` at 390), `requestor-request-workflow.spec.ts` (the return-to-draft dialogs trap Tab and Shift+Tab at 375 and 1440), `risk-register-workflow.spec.ts` (the Filters sheet and More filters at every width, Escape returning focus). | Pass |
| **2.4.2 Page Titled** | Every route. | Every scan settles on the route's exact title. The Requestor request detail and edit routes had no title of their own and now carry `Assessment Request \| IdamBox CSRM` and `Edit Request \| IdamBox CSRM`. A `notFound()` raised after a page starts streaming can no longer change the resolved title, so another Requestor's assessment kept `Released Risk Assessment \| IdamBox CSRM` over `Page not found`. The route's `generateMetadata` now makes the page's own cached read and raises `notFound()` itself, and Next renders the not-found convention's metadata in its place (`next/dist/lib/metadata/metadata.js`, `getNotFoundMetadata`), so the title is `Page not found \| IdamBox CSRM`. The request detail and edit routes follow the same pattern. The status stays the streamed 200 with Next's `noindex` tag: the installed docs (`not-found.md`, "Calling notFound() after streaming has started") give a real 404 only by checking the record in `proxy` before streaming, which would put an authorised Strapi read in the proxy for every navigation. See open finding 2. | Pass |
| **1.3.1 and 2.4.6 (headings)** | Every route. | Exactly one level-one heading on every scanned route and state. | Pass |

## Fixed in this plan

| Rule or criterion | Where | Fix | Commit |
|---|---|---|---|
| One level-one heading; 2.4.6 (STATE follow-up 2026-09-25) | `AdministrationAccessDenied` (every `/app/admin/*` route refused to a Requestor) | The denial renders the collection's page header (`Risk Types`, `Controls`, `Information Systems`, `Information Assets`, or `Administration`) above the shared permission state; all 12 call sites pass their collection. Unit test: `administration-workflow.test.tsx`. | `cf7d784` (test), `0fcd2dd` |
| One level-one heading; 2.4.2 | The Requestor request detail and edit routes (another Requestor's request; a request past draft; a failed read) | The page heading, `Assessment request` or `Edit assessment request`, above the permission and error states, naming the page and never the record; route titles; the not-found title through the metadata read. Unit tests: `request-routes.test.tsx`, `released-assessment-route.test.ts`. | `cfcf1b5` (test), `3cdb326` |
| `label-content-name-mismatch` (2.5.3) | The sidebar wordmark link, every signed-in page | Named `BProton, IdamBox CSRM home` (was `IdamBox CSRM home` while it shows "BProton"); the direction document's Logo lockup records the name first. Unit test: `wordmark.test.tsx`. | `39997fe` |
| `label-content-name-mismatch` (2.5.3) | The analyst dashboard's six review-queue rows and four Risk exposure bars, 1440 and 375 | A word break between each row's label and its count or value (the flex row draws none; the text now reads as drawn); the rating badge carries no label of its own inside a link that names the rating; the exposure links read `{Rating}: {n} open Risks by residual rating`, visible words first. Unit tests: `bar-chart.test.tsx`, `risk-rating-badge.test.tsx`, `analyst-dashboard.test.tsx`, `analyst-dashboard-presentation.test.ts`, `report-views.test.tsx`. | `d0cbbc7` |

## Open findings

1. **Closed 2026-09-26 (phase UI review, verdict 1):** the development sign-in is titled `Development sign-in | IdamBox CSRM`, and `sign-in-page.test.tsx`, the sweep and the production hardening sweep pin it. As first recorded: **The development sign-in's title is the site name alone.** `/sign-in` with the development session is titled `IdamBox CSRM` (plan 08-02 kept it, and `sign-in-page.test.tsx` pins it), while the unavailable card is `Sign-in unavailable | IdamBox CSRM`. The page exists only in development and the attested E2E runtime. A descriptive title would be `Development sign-in | IdamBox CSRM`. Changing it reverses a pinned decision, so it is left for the UI review.
2. **A streamed not-found answers HTTP 200.** The status cannot change once streaming has started (Next's documented soft 404 with `noindex`). The title and page are truthful; only the status differs. A 404 would need a record check in `proxy`. Recorded for the residual register.
3. **Not-found for a nonexistent record id on other detail routes.** The questionnaire detail and the three analyst review details raise `notFound()` only for an id that does not exist (their refusals are 403 permission states, which keep a truthful title). There the title stays the route's own (`Questionnaire | IdamBox CSRM` and so on) over `Page not found`. The same metadata read would fix each; no Requestor reaches that state through another Requestor's record. **Resolved after the phase code review (WR-05, 2026-09-26):** each of the four routes now applies `recordRouteMetadata`, so an id that does not exist takes `Page not found | IdamBox CSRM` and every other outcome keeps the route's title. `record-route-titles.test.ts` pins the four routes, and the production sweep opens each with an id that does not exist.
4. **Closed 2026-09-26 (phase UI review, verdict 2):** the review accepted the shipped name, and 07-UI-SPEC §5.2 and §7.2 carry a dated amendment stating it (`1456e49`). As first recorded: **The Phase 7 UI-SPEC's exposure link wording changed.** 07-UI-SPEC §7.2 named each exposure link `{Rating} residual rating: {n} open Risks` and judged it to meet 2.5.3. The visible words ("Critical 2") were not the start of the name, and axe fails it, so the links now read `{Rating}: {n} open Risks by residual rating`.

## Runs

All runs used the production-build harness on the Windows build host, with ports 1337 and 3000 free.

| Run | Result |
|---|---|
| First sweep (before the fixes) | 3 passed, 8 failed. Every signed-in test failed on `label-content-name-mismatch: .wordmark`; the signed-out test passed, which showed the scan itself was sound. |
| Discovery (scan assertions made soft for one run, not committed) | 10 passed, 1 failed. Only the analyst dashboard failed, at 1440 and 375: the six review-queue rows and the four exposure bars. Every other route was already clean. |
| `accessibility.spec.ts --repeat-each 5`, final spec (D-13) | **55 passed, 0 failed, 0 flaky**, 9.2 min (556 s wall). Every test passed five times at a steady duration; the analyst sweep took 30.1 to 32.1 s each time. An earlier five-repeat run, also 55/55, was superseded when the Tab loop was found to stop at a date input's internal fields rather than at the end of the page; the corrected loop is the one recorded above. |
| Full suite, both projects | **71 passed (67 desktop, 4 mobile), 0 failed, 0 flaky**, no retries, 10.5 min (630 s wall). The run changed no tracked file. |
| The five specs the fixes and the focus helpers touched (Risk Register, Administration, request journey, analyst insights, hardening), both projects | 27 passed (3.8 min), before the sweep commit |
| The plan gate | Strapi **504 passed, 0 failed** (618.6 s); web unit **87 files, 1616 tests** (21.7 s); `typecheck` and `api:check` clean. No Strapi source, contract, grant, `CSRM_AI_*` or Keycloak change. |

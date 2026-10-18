---
phase: 11-navigation-landing-and-list-clarity
plan: 07
subsystem: api
tags: [strapi, openapi, knex, assessment-list, risk-register, data-table, local-time, playwright, vitest, node-test]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-06: review-lists.spec.ts (@journey, Brisbane) on the mobile project's list; 11-04: the Risk assessments and My risk assessments headings; 11-01: approved reads Released"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: LocalInstant and TimeZoneProvider; the parity guard and closed parsers; the X-4 separator"
provides:
  - "Strapi: projectAssessmentSummary(document, riskSummary?) adds requestTitle, riskCount and highestResidualRating; riskSummariesFor(connection, assessmentIds) is one grouped aggregate (COUNT DISTINCT and the residual rating ladder CASE) bounded by the page's numeric ids"
  - "Strapi: collection keys overallRating (the rating ladder), approvedFrom and approvedTo (existing YYYY-MM-DD dates, from not after to, else 400); q also matches assessmentRequest.title; the dates bound the approval instant's UTC date inclusively"
  - "Spec: AssessmentSummary requires requestTitle (1 to 255, nullable), riskCount (minimum 0) and highestResidualRating (AssessmentRating or null), closed; both list operations take overallRating, approvedFrom and approvedTo (format date) and describe q"
  - "Web: assessmentSummarySchema and the Risk register picker parser widened; AssessmentCollectionQuery.overallRating, .approvedFrom, .approvedTo read closed from the URL (an inverted range is dropped); the zod-free assessmentRatings in assessment-domain.ts"
  - "Web: the Risk assessments list's seven columns and phone card, its Overall rating select and its Overall rating, Released from and Released to chips; My risk assessments' Request title, Released through LocalInstant date-long, and the same select and chips"
  - "Web: listRiskRegisterAssessments(search?) sends { q, pageSize: 25 }; picker options read '{assessment number} · {request title}' or the number alone; the action returns the server's first 20 assessment options unfiltered"
  - "E2E: UX09_ASSESSMENT_COLUMNS (@journey, both projects) and UX09_PICKER_FINDS_BY_REQUEST_TITLE (desktop)"
affects: [11-12, 11-15, 11-18, 11-19, 16, 18]

actuals:
  tokens: 31012
  tasks: 3
  commits: 6
plan_head_before: 41737e0deb4b0cec2ef79dffc0e654f6c04b4b9a
plan_head_after: 373134a31f762a975c6b555a336b88994447dc3e

tech-stack:
  added: []
  patterns:
    - "A list item's figures from its children: the page is read through the Document Service, then one knex aggregate over the page's numeric ids (link table joined to the child table, grouped by the parent id) fills a Map the projection reads; a parent with no row reads 0 and null"
    - "A severity ladder in SQL as MAX(CASE column WHEN 'Low' THEN 1 ... WHEN 'Critical' THEN 4 END), mapped back through the ladder array; any other value, null included, has no rank"
    - "An inclusive UTC calendar-date range on an instant: $gte {from}T00:00:00.000Z and $lt the day after {to}, each date checked to exist by a round trip through toISOString"
    - "A browser component takes a vocabulary from the zod-free *-domain.ts module, never from the zod schema module, or the zod client-boundary guard fails"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/assessments/released-assessment.tsx
    - apps/csrm/src/features/risks/risk-actions.ts
    - apps/csrm/src/features/risks/risk-service.ts
    - apps/csrm/src/features/risks/risk-schema.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/assessments/assessment-list.test.tsx
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/released-assessment.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/csrm/src/features/risks/risk-actions.test.ts
    - apps/csrm/src/features/risks/risk-service.test.ts
    - apps/csrm/src/features/risks/risk-schema.test.ts
    - apps/csrm/e2e/review-lists.spec.ts
    - apps/csrm/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "11-07: the request title crosses only within the contract's 1-255 bounds; a missing or whitespace-only title reads null, and the web shows Not recorded"
  - "11-07: the Risk count covers every Risk of the assessment and the highest residual rating ignores null and off-ladder values (D-31); Phase 16 will exclude withdrawn Risks from both"
  - "11-07: the web drops an inverted released range (from after to) whole, so a hand-edited URL never turns the list into its error state; Strapi still refuses it with 400"
  - "11-07: My risk assessments shows Released from and Released to chips whenever the URL carries them, as the analyst list does, so it never looks unfiltered; UI-SPEC §7.2 names the chips for the analyst list only"
  - "11-07: a phone card whose assessment holds Risks with no rating reads '{n} Risks · Highest residual Not rated'; UI-SPEC §7.2 names only the rated line and No Risks yet"
  - "11-07: the assessment rating ladder moved to the zod-free assessment-domain.ts (assessment-schema re-exports it), so the two client lists import no zod"
  - "11-07: UX-09 is shared with later Phase 11 plans: requirements.ready-ids reports 0/1 ready, so REQUIREMENTS.md is unchanged"

patterns-established:
  - "riskSummariesFor(connection, assessmentIds): the page-bounded child aggregate later list items can copy (Phase 16 adds the withdrawn exclusion here)"
  - "selectMatchingOptionAndWait(page, combobox, typed, key, optionLabel?): a picker option whose label differs from the typed term"

requirements-completed: []

coverage:
  - id: D1
    description: "Both assessment list operations carry each assessment's request title, its Risk count and its highest residual rating, from one grouped aggregate over the page; null and off-ladder ratings count but never rate"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#assessment lists carry the request title, the Risk count and the highest residual rating"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted analyst assessment metadata routes are bounded and transition the first accepted edit once"
        status: pass
    human_judgment: false
  - id: D2
    description: "q on both lists matches the number, the summary or the request title; overallRating, approvedFrom and approvedTo narrow both lists inclusively by the approval's UTC date; malformed values are 400; the owner list stays released-only and owner-scoped under every filter (T-11-04)"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#both assessment lists find an assessment by a word of its request title"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#both assessment lists narrow by overall rating and by the approval's UTC date, inclusively"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#an invalid rating, a malformed date or an inverted release range is refused on both lists"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#no filter combination widens the owner list: a second Requestor sees none of the owner's assessments and the owner no unreleased one"
        status: pass
    human_judgment: false
  - id: D3
    description: "The contract publishes the widened closed AssessmentSummary and the three parameters; the generated client is current; the closed parsers (analyst, owner and Risk register picker) are held by the parity guard"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the assessment list item with its request title, Risk count and highest residual rating, closed against any other key (D-02 item 2)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-service.test.ts#the assessment list filters"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Risk assessments list shows Assessment, Request title, Status, Risks, Highest residual rating (badge or Not rated), Draft initiated by and Released (local date or Not released), the phone card's Risk line, an Overall rating select and the Overall rating, Released from and Released to chips"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the risk assessment list columns"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the risk assessment list filters"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_ASSESSMENT_COLUMNS ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D5
    description: "My risk assessments shows Request title in place of Summary, Released in the long local form (27 September 2026), and the Overall rating select and chip, preselected from ?overallRating"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment.test.tsx#My risk assessments columns and overall rating filter"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Risk register's Related assessment picker searches on the server by number, summary or request title, beyond the first 25, and labels each option '{number} · {request title}' or the number alone"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-actions.test.ts#the Risk register relation search"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-service.test.ts#the Related assessment picker search"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#UX09_PICKER_FINDS_BY_REQUEST_TITLE"
        status: pass
    human_judgment: false
  - id: D7
    description: "The seven-column Risk assessments table, its phone card and the two-line request title read well at 1440 and 375"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_ASSESSMENT_COLUMNS (both projects)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the columns, cells, badge and card lines; how seven columns with a clamped title and a severity badge look side by side is a visual judgment no test asserts"

duration: 58min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 07: Assessment lists by request title Summary

**Both assessment lists now name each assessment by its request's title. The Security Analyst's Risk assessments list also shows how many Risks each assessment holds and the highest residual rating among them, from one grouped Strapi aggregate per page. Search on both lists matches the request title. New filters narrow by overall rating and by release date, and the owner's list keeps its scope under every one. The Risk register's Related assessment picker searches the server by request title and labels each option "{number} · {request title}".**

## Performance

- **Duration:** 58 min. Wall clock covers two Playwright runs and one full Strapi suite.
- **Started:** 2026-10-03T06:14:36Z
- **Completed:** 2026-10-03T07:13:32Z
- **Tasks:** 3 of 3
- **Files changed:** 24, all modified (none created or deleted)

## Accomplishments

- **Strapi projection and aggregate (D-02 item 2, D-31).**
  - `projectAssessmentSummary(document, riskSummary?)` adds three fields:
    - `requestTitle`: from the populated `assessmentRequest`, 1 to 255 characters, else null.
    - `riskCount`: else 0.
    - `highestResidualRating`: else null.
  - `riskSummariesFor` runs one knex query over `csrm_risks_assessment_lnk` joined to `csrm_risks`:
    - restricted by `whereIn` to the page's positive integer ids, and grouped by assessment;
    - `COUNT(DISTINCT r.id)` for the count, and `MAX(CASE r.residual_rating WHEN 'Low' THEN 1 … WHEN 'Critical' THEN 4 END)` for the rating;
    - both read through `Number()`, because PostgreSQL returns them as strings.
  - Both list handlers use it, so `GET /v1/my_risk_assessments` gets the same projection.
- **Strapi filters (D-02 item 2, T-11-04, T-11-21).**
  - The closed key list now accepts `overallRating`, `approvedFrom` and `approvedTo`.
  - Each value is checked closed:
    - the rating must be on the ladder;
    - each date must match `^\d{4}-\d{2}-\d{2}$` and exist;
    - `approvedFrom` must not be after `approvedTo`.
    - Anything else is a 400.
  - `q` also matches `assessmentRequest.title` (`$containsi`).
  - The dates become `approvalDate $gte {from}T00:00:00.000Z` and `$lt` the day after `{to}`.
  - Every filter joins one `$and` with the owner list's released, owner-scoped predicate, so a filter can only narrow that list.
- **Contract.**
  - `AssessmentSummary` requires the three fields and stays `additionalProperties: false`.
  - Both list operations take the three parameters: `overallRating` as an enum, the dates as `format: date`. `q` now has a description.
  - `schema.d.ts` was regenerated and `api:check` is clean.
  - Routes, grants, content types, `served-operations.json` and both catalogue copies are unchanged. The two catalogue copies are byte-identical (SHA-1 `2da80b71…`).
- **Web, Risk assessments (UI-SPEC §7.2).**
  - Columns: Assessment, Request title, Status, Risks, Highest residual rating, Draft initiated by, Released.
    - Request title is a long-text column clamped to two lines, `Not recorded` when missing.
    - Risks is a magnitude numeric column.
    - Highest residual rating shows a `RiskRatingBadge` with text and icon, or `Not rated`.
    - Released shows `LocalInstant` `date`, or `Not released`.
  - Phone card lines:
    1. the number with its status badge;
    2. the request title;
    3. `{n} {Risk|Risks} · Highest residual` with the badge, or `No Risks yet`;
    4. `Draft initiated by {name}`;
    5. `Released {date}`, when released.
  - Filters:
    - an `Overall rating` select: `All ratings`, `Low`, `Moderate`, `High`, `Critical`;
    - chips `Overall rating: High`, `Released from: 1 Sept 2026` and `Released to: 30 Sept 2026`, each removable. `Clear filters` clears them all, and every navigation keeps them.
- **Web, My risk assessments (UI-D29, D-55).**
  - Request title replaces Summary.
  - Released renders through `LocalInstant style="date-long"` in the table and on the card. The UTC `formatDate` is deleted.
  - The same select and chip are added, and `?overallRating=High` preselects them.
- **Web, query and service.**
  - The collection query reads the three parameters closed from the URL. A value off the ladder or a malformed date becomes absent, and an inverted range is dropped.
  - `collectionParams` sends each parameter only when present. Both pages read them through `parseAssessmentCollectionQuery`.
- **Related assessment picker (D-32, UAT-048).**
  - `listRiskRegisterAssessments(search?)` sends `{ q, pageSize: 25 }`.
  - An option reads `ASM-2026-2XX26G · UAT-A: Brightwage People cloud HR and payroll platform`, or the number alone when the request has no title.
  - For assessments, `searchRiskRegisterRelationsAction` passes the term through and returns the server's first 20 options with no client-side label filter. Owners, systems and assets are searched as before.

## Task Commits

1. **Task 1: The analyst's assessment list shows each request's title, Risk count and highest residual rating (tracer, TDD)**
   - `f5136d7`: test(11-07), RED
   - `3b5065c`: feat(11-07), GREEN
2. **Task 2: Search both lists by request title and filter them by overall rating and release date (TDD)**
   - `b41b549`: test(11-07), RED
   - `41ab7de`: feat(11-07), GREEN
3. **Task 3: The Related assessment picker searches the server by request title, proved in the browser (TDD)**
   - `50d251d`: test(11-07), RED
   - `373134a`: feat(11-07), GREEN

The ledger count is `git rev-list --count 41737e0..373134a` = 6. Each of the six commits ends with the `Co-Authored-By: Claude Opus 5.5` trailer (checked with grep).

## TDD Gate Compliance

- **Task 1:** RED `f5136d7` comes before GREEN `3b5065c`.
  - Web RED: 8 of 170 failed, each on an assertion:
    - the parity case (AssessmentSummary lacked the fields);
    - the header count (13, not 16);
    - the record-opener case (no request title in the DOM);
    - five column and card cases.
  - Strapi RED: 7 of 26 failed.
    - Both target tests failed on `ASSESSMENT_LIST_ITEM_KEYS`.
    - Five more failed only because the first metadata test stopped at its keys assertion before making the edits later tests depend on (`MUTABLE_ASSESSMENT_FIXTURE_MISSING` and others). They pass from GREEN on.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full verify was re-run against the committed tree: web 525/525 (17 files), `api:check` and typecheck clean, Strapi 26/26. Task 2 started only after that.
- **Task 2:** RED `b41b549` comes before GREEN `41ab7de`.
  - Web RED: 11 of 537 failed: the URL-parse case, and every select, chip and column case on both lists.
  - Strapi RED: 3 of 30 failed:
    - `ANALYST_REQUEST_TITLE_SEARCH_WRONG`;
    - the filter and isolation proofs, at `ASSESSMENT_LIST_FILTER_READ_FAILED`, because the closed key list refused the new keys with 400.
  - Three cases passed at RED, as noted under Deviations (item 6).
- **Task 3:** RED `50d251d` comes before GREEN `373134a`.
  - Unit RED: 3 of 148 failed, each on an assertion: the action's term, the service's query, and the option label.
  - The E2E cases were written in RED and run after GREEN, as the plan orders.
- The plan is `type: execute`, so the plan-level `tdd-red-evidence` check was not run. The failures above come from the RED runs' own output.
- No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED, web (list test, parity) | 8 failed, 162 passed (170) |
| Task 1 RED, Strapi (`assessment-workflow.integration`) | 7 failed, 19 passed (26) |
| Task 1 GREEN, web (`src/features`) | 67 files, 1,358/1,358; typecheck clean; `api:check` exit 0 |
| Task 1 GREEN, full web suite | 138 files, 2,955/2,955 |
| Task 1 GREEN and tracer re-run, Strapi file | 26/26 |
| Task 2 RED, web | 11 failed, 526 passed (537) |
| Task 2 RED, Strapi file | 3 failed, 27 passed (30) |
| Task 2 GREEN, web (`src/features/assessments`, parity) | 17 files, 537/537; typecheck clean; `api:check` exit 0 |
| Task 2 GREEN, Strapi file | 30/30 |
| Task 2 GREEN, full web suite | first run 2 failed (zod client boundary, deviation 3); after the fix, 138 files, 2,967/2,967 |
| Task 3 RED, web (`src/features/risks`, chain) | 3 failed, 145 passed (148) |
| Task 3 GREEN, web (`src/features/risks`, chain, parity) | 10 files, 290/290; typecheck clean |
| Task 3 Playwright (`review-lists.spec.ts`, `risk-register-workflow.spec.ts`) | **9 passed: desktop 5, mobile 4; 0 failed, 0 flaky, 0 skipped; 2.1 min**. Afterwards `git status --short` showed only my uncommitted Task 3 edits and the three operator items |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **672/672, 0 skipped, 11 min 57 s** (06:45:57Z to 06:57:59Z) |
| `served-operations:write`, check mode (dev servers stopped) | 8/8; `docs/references/served-operations.json` unchanged |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **138 files, 2,972/2,972** |
| `typecheck`, `lint` | clean |
| `api:check` | exit 0. The contract changed, so `schema.d.ts` was staged and committed with the spec in both feature commits. `git update-index --refresh` after the last check left it clean |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **113 passed: desktop 98, mobile 15; 0 failed, 0 flaky, 0 skipped; 13.4 min** (06:59:54Z to 07:13:17Z). Afterwards `git status --short` showed only the three operator items |

Before every Strapi, served-operations and Playwright run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.

## Files Created/Modified

- **Strapi**
  - `assessment-scope.ts`: the projection, the rating ladder, the closed filter keys, the date parsing and the predicates.
  - `controllers/csrm-assessment.ts`: `riskSummariesFor`, used by both list handlers.
- **Strapi tests:** `assessment-workflow.integration.test.ts` holds:
  - the aggregate proof;
  - the request-title search, filter, refusal and owner-isolation proofs;
  - the metadata test's eleven-key item.
- **Contract:** `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`.
- **Web**
  - `assessment-schema.ts`: the widened closed parser.
  - `assessment-domain.ts`: the zod-free ladder.
  - `assessment-service.ts`: the query and params.
  - `assessment-list.tsx`: the columns, card, select and chips.
  - `released-assessment.tsx`: Request title, `date-long`, select and chips.
  - `risk-service.ts`, `risk-schema.ts` and `risk-actions.ts`: the server-searched picker.
- **Web tests**
  - The plan's cases: `contract-response-parity.test.ts`, `assessment-list.test.tsx`, `assessment-service.test.ts`, `released-assessment.test.tsx`, `risk-actions.test.ts` and `risk-service.test.ts`.
  - Fixtures widened: `assessment-review-workflow.test.tsx`, `requestor-dashboard.test.tsx` and `risk-schema.test.ts`.
- **E2E:** `review-lists.spec.ts` (`UX09_ASSESSMENT_COLUMNS`) and `risk-register-workflow.spec.ts` (`UX09_PICKER_FINDS_BY_REQUEST_TITLE`, and the journey's new option label).

## Decisions Made

- **The title within bounds.** `requestTitle` crosses only as 1 to 255 characters. A blank or missing title reads null, which the spec's `minLength: 1` allows.
- **Literal SQL for the ladder.** The rank `CASE` is constant text, like `risk-register.ts`'s sort ladder. Only the page's numeric ids are bound.
- **One `$and`.** The owner list's released predicate and every filter sit in the same conjunction. A second Requestor and a birthright analyst-agent see none of the owner's assessments under nine filter combinations. The owner never sees an unreleased one.
- **The web drops an inverted range.** Strapi refuses `approvedFrom` after `approvedTo` with 400. The web drops both dates instead, so the list never turns into its error state, as 11-06 did for its sort.
- **Chips on My risk assessments.** The released date range has no control on either list. When the URL carries one, My risk assessments shows the chips too, so the list never looks unfiltered.
- **The rated-or-not card line.** An assessment holding only unrated Risks reads `{n} Risks · Highest residual Not rated`.
- **Seeded proofs that only read.** `UX09_ASSESSMENT_COLUMNS` reads the released `ASM-E2E-P7-RELEASED-001`: "Immutable cloud backup for tier 1 systems", one Critical Risk. It is released, so no journey can add a Risk to it, and the @journey can run in both projects. The picker proof types "penetration", which appears only in `ASM-DEV-RISK-001`'s request title.
- **UX-09 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] The Risk register picker's closed parser was widened in Task 1, not Task 3**
- **Found during:** Task 1, GREEN
- **Issue:** `risk-schema.ts` parses `GET /v1/risk_assessments` with its own closed copy of the list item. Without the three fields, every picker read would fail, and the parity guard would fail too.
- **Fix:** Task 1's GREEN widened the parser's fields. Task 3 changed only the label.
- **Committed in:** `3b5065c`

**2. [Rule 3: blocking] Test fixtures typed or parsed as the list item**
- **Found during:** Task 1, GREEN (typecheck and `src/features`)
- **Issue:** Five fixtures lacked the three required fields, in files outside Task 1's list: `assessment-review-workflow.test.tsx`, `requestor-dashboard.test.tsx`, `released-assessment.test.tsx`, `assessment-service.test.ts` and `risk-schema.test.ts`.
- **Fix:** Each fixture gained the fields. No assertion changed.
- **Committed in:** `3b5065c`

**3. [Rule 1: broken by the change] The zod client-boundary guard**
- **Found during:** Task 2, the full web suite (2 failures in `zod-client-boundary.test.ts`)
- **Issue:** `assessment-list.tsx` and `released-assessment.tsx` are client components. Their value import of `assessmentRatings` from `assessment-schema.ts` pulled zod into the browser.
- **Fix:**
  - The ladder now lives in the zod-free `assessment-domain.ts`, which is not on the plan's file list.
  - `assessment-schema.ts` imports and re-exports it, as it already does for `assessmentStatuses`.
  - The suite then passed 2,967/2,967.
- **Committed in:** `41ab7de`

**4. [Rule 2: input validation] An inverted released range in the URL**
- The web query drops it whole, as described in Decisions.
- **Committed in:** `41ab7de`

**5. [Copy, UI-SPEC gap] Chips on My risk assessments and the unrated card line**
- Both are described in Decisions.
- **Committed in:** `41ab7de` and `3b5065c`

**6. [RED notes] Three cases passed at RED**
- **Two service cases.** `assessment-service.test.ts` "sends … exactly as given" and "leaves out each filter that is absent" passed at RED. The old `collectionParams` spread `...rest` and forwarded any key.
  - GREEN replaced the spread with explicit, typed parameters.
  - Both cases now pin that behaviour.
  - The URL-parse case failed at RED as intended.
- **The Strapi refusal proof.** It passed at RED because the closed key list refused the unknown keys. From GREEN on, it proves the real value checks.

**7. [Plan files] The two pages are unchanged**
- `app/(app)/app/assessments/page.tsx` and `app/(app)/app/review/assessments/page.tsx` already parse through `parseAssessmentCollectionQuery`, which now reads the three parameters. Neither page needed an edit.

**8. [E2E] The journey's Related assessment option**
- The Risk register journey picked the option named exactly `ASM-DEV-RISK-001`, which is now `ASM-DEV-RISK-001 · Customer portal penetration test findings`.
- `selectMatchingOptionAndWait` gained an optional `optionLabel`. The journey still types the number, which the server matches.
- **Committed in:** `50d251d`

---

**Total deviations:**
- Two blocking widenings
- One test broken by the change, found by the full suite
- One validation tightening
- One UI-SPEC gap decided
- Two notes (RED, plan files)
- One E2E label update

**Impact on plan:** No added scope.
- No content type, Function, FunctionAPI, role, route or dependency changed (D-01, D-02, T-11-SC).
- The owner list stays released-only and owner-scoped under every filter (T-11-04, integration proof).
- The aggregate binds only the page's numeric ids, at most 100 (T-11-21, T-11-22).

## Issues Encountered

- **Line endings.** Several working-tree files are CRLF and their index copies LF. Edits kept each file's own line endings, so Git printed its LF-to-CRLF warnings. No content outside the edits changed.
- **Production server log noise.** The full Playwright run logged 43 `The destination stream closed early` messages and one `failed-to-find-server-action`. 11-06 logged 77 and 1. Every test passed.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.

## Known Stubs

None. Every new cell renders a server fact. "Not recorded", "Not rated", "Not released" and "No Risks yet" are the UI-SPEC's copy for a missing value.

## Threat Flags

None. There is no new endpoint or route. The two widened reads are the existing analyst-scoped `GET /v1/risk_assessments` and owner-scoped `GET /v1/my_risk_assessments`. The new fields (request title, Risk count, highest residual rating) and filters are in the plan's threat model (T-11-04, T-11-21, T-11-22).

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-08 and later.
- The throughput figures (11-12) can open `/app/review/assessments?approvedFrom=…&approvedTo=…`, and the Requestor Home's rating chips (11-18) can open `/app/assessments?overallRating=…`. Both lists show the matching chips.
- The Risk register's selected-assessment chip still reads the number from `selectedLabels`. Plan 11-15 changes it to `{number} · {request title}`.
- Phase 16's withdrawn-Risk exclusion is one `where` in `riskSummariesFor`.

## Self-Check: PASSED

- Commits `f5136d7`, `3b5065c`, `b41b549`, `41ab7de`, `50d251d` and `373134a` exist on `post-demo`, and each carries the trailer.
- Task 1 acceptance criteria re-ran PASS:
  - The spec's `AssessmentSummary` requires the three fields and is closed.
  - The controller contains `COUNT(DISTINCT` and the ladder `CASE`.
  - `assessment-list.tsx` contains `Request title`, `Risks` and `Highest residual rating`.
  - The verify exited 0, twice.
- Task 2 acceptance criteria re-ran PASS:
  - `assessment-scope.ts` accepts the three keys and holds `assessmentRequest: { title: { $containsi`.
  - `released-assessment.tsx` contains `Request title` and `date-long`.
  - The integration test holds the second-Requestor case (`SECOND_REQUESTOR_SAW_OWNER_ASSESSMENT`).
  - The verify parts exited 0.
- Task 3 acceptance criteria re-ran PASS:
  - `risk-actions.ts` calls `listRiskRegisterAssessments(search)` and returns assessment options without a label filter.
  - `risk-schema.ts` builds the label with ` · `.
  - Both E2E names are present and passed.
  - The Strapi suite passed in full, and the tree was clean.
- The plan's verification passed:
  - `api:check` is clean, and the parity and chain guards pass.
  - The web suite and typecheck pass, and the full Strapi suite passes.
  - Both named Playwright specs and the full Playwright suite pass in both projects, with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

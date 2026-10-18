---
phase: 11-navigation-landing-and-list-clarity
plan: 06
subsystem: api
tags: [strapi, openapi, review-queue, data-table, local-time, playwright, vitest, node-test]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-01: request labels from one mapping (approved reads Released); 11-04: the Requests heading; 11-05: the analyst navigation profile with Requests under Assessment work"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: LocalInstant and TimeZoneProvider; 10-06: the request controller's analyst branch; the parity guard and closed parsers"
provides:
  - "Strapi: REVIEW_QUEUE_BUCKETS with all (reviewable plus released statuses, never draft, no lifecycle predicate); ReviewFilters.q and AnalystReviewRead.q; ReviewQueueCriteria.q; projectAnalystReviewRequest(document, today)"
  - "Queue item fields requestorName (display name only), assessmentType, businessCriticality, dueDate, daysSinceSubmission (UTC days, never negative)"
  - "Spec: AssessmentRequestQueueItem with the five required nullable fields, closed; filters[queue] enum with all; filters[q] (1 to 200)"
  - "Web: the closed queue parser; AssessmentRequestReviewQuery.queue with all and a closed sort enum; listAssessmentRequests sends filters[q]; the nine requestColumns with sorting on five; the phone card; All requests; Search by number or title"
  - "E2E: helpers/requests.ts (chooseRelation, createSubmittedRequest); review-lists.spec.ts (@journey, Brisbane) on the mobile project's list"
affects: [11-07, 11-10, 11-13, 11-19, 13]

actuals:
  tokens: 16477
  tasks: 3
  commits: 6
plan_head_before: 9037867ee8186473171b5d0a66b9ca078bef22d6
plan_head_after: 20d3d4d74a4963bb6f9fa1b960df284c81d24a3d

tech-stack:
  added: []
  patterns:
    - "A server-computed age: the controller reads the clock once per request (utcToday(new Date())) and the projection takes today as an argument, so it never reads the clock and every row counts to the same day"
    - "A computed field on a Strapi read survives sanitizeOutput when the projection runs before it: the queue keeps project-then-sanitise"
    - "One search term over two columns: (LOWER(number) LIKE LOWER(?) ESCAPE '!' OR LOWER(title) LIKE LOWER(?) ESCAPE '!') with literalContains bound twice"
    - "E2E records created through the UI by a shared helper, named per Playwright project, so a @journey can run in both projects against one database"

key-files:
  created:
    - apps/csrm/e2e/helpers/requests.ts
    - apps/csrm/e2e/review-lists.spec.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/tests/review-queue.unit.test.ts
    - apps/backend/tests/review-queue-buckets.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/assessments/assessment-list.test.tsx
    - apps/csrm/src/features/assessments/assessment-status-filters.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/csrm/playwright.config.ts

key-decisions:
  - "11-06: sanitizeOutput keeps the computed keys, so the queue keeps its project-then-sanitise order; the integration test proves requestorName and daysSinceSubmission arrive"
  - "11-06: daysSinceSubmission counts from the UTC calendar date of the submission instant (normalizeDateTime, utcToday) to the server's UTC today; a submission stamped after today reads 0, a missing one null"
  - "11-06: requestorName is the display name only, read through a displayName-only requestor populate; a blank name reads null, and the spec bounds it 1 to 255"
  - "11-06: the web review query's sort is a closed enum of the twelve served orders (falls back to submittedDate:desc), so a hand-edited URL never reaches Strapi as a malformed sort"
  - "11-06: the phone card's missing age reads 'Age not recorded'; UI-SPEC §7.1 names only the populated line"
  - "11-06: UX-07/UX-09 shared: requirements.ready-ids reports UX-09 0/1 ready, so REQUIREMENTS.md is unchanged"

patterns-established:
  - "createSubmittedRequest(page, { title, assessmentType, businessCriticality, dueDate }): the page is signed in as a Requestor; it returns { requestNumber, documentId }"
  - "review-lists.spec.ts keeps one created request per Playwright project in module state; a test that runs alone creates its own"

requirements-completed: []

coverage:
  - id: D1
    description: "Each review queue item carries the requestor's display name, assessment type, business criticality, due date and days since submission, computed by the server from its UTC today, with no other requestor field"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#a queue item carries the requestor's name, type, criticality, due date and days since submission"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#a queue item reads null for each triage fact the request does not record"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/review-queue-buckets.integration.test.ts#a submitted request reads with its triage facts, and no more of its requestor than the display name"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted analyst review queue is exact, bounded, and follows existing detail links"
        status: pass
    human_judgment: false
  - id: D2
    description: "filters[q] matches the request number or the title, case-insensitively and literally; filters[queue]=all reads every reviewable and released request and never a draft, inside the analyst scope"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#the review search term is one string of 1 to 200 characters"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#the All requests queue reads every reviewable and released status and never a draft"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/review-queue-buckets.integration.test.ts#the queue search finds a request by its number or a word of its title, literally"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/review-queue-buckets.integration.test.ts#All requests reads every reviewable and released request and no draft"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 06.8 questionnaire governance surface is published and human-analyst only (PHASE68_QUEUE_FILTER_VALUES, PHASE11_QUEUE_SEARCH_PARAMETER)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The contract publishes the widened closed queue item, all and filters[q]; the generated client is current and the closed parser is held by the parity guard"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the request queue item with its five triage fields, closed against any other key (D-02 item 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Requests list shows nine columns in order (criticality as plain text, Age in days, due date as a calendar day, Submitted through LocalInstant), sorts on the five server-sorted columns, offers All requests, labels the search Search by number or title and sends filters[q]"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the request queue triage columns"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the request queue views and phone cards"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-status-filters.test.tsx#Analyst request queue search and All requests"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_QUEUE_TRIAGE_COLUMNS ([desktop] and [mobile])"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_QUEUE_SEARCH_BY_TITLE ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D5
    description: "The nine-column table and the four-line phone card read well at 1440 and 375 (density, wrapping of the title, the right-aligned age)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts (both projects)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the content, order, plain-text criticality and card lines; how the nine columns and the card look side by side is a visual judgment no test asserts"

duration: 96min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 06: The request queue is triaged from its columns Summary

**The Security Analyst's Requests list now shows who raised each request, its type, business criticality, due date and age, all computed by Strapi. The search box, "Search by number or title", finds a request by its number. "All requests" lists every request in review scope, reviewable and released, and never a draft. The Submitted date reads in the viewer's time zone. Phone cards show the four triage lines.**

## Performance

- **Duration:** 96 min (wall clock: two full Strapi suites, one full web suite and two Playwright runs)
- **Started:** 2026-10-03T04:33:44Z
- **Completed:** 2026-10-03T06:10:41Z
- **Tasks:** 3 of 3
- **Files changed:** 22 (2 created, 20 modified, none deleted)

## Accomplishments

- **Strapi projection.** `projectAnalystReviewRequest(document, today)` now adds five fields:
  - `requestorName`: the display name, or null.
  - `assessmentType` and `businessCriticality`: enum values, or null.
  - `dueDate`: a UTC calendar date, or null.
  - `daysSinceSubmission`: the UTC date of the submission to `today`, never negative, or null.

  The repository hydrates the three new attributes. It populates `requestor` with `fields: ['displayName']` only. The controller reads `utcToday(new Date())` once per request.
- **Strapi filters.**
  - `REVIEW_QUEUE_BUCKETS` gains `all`. Its statuses are the four reviewable and two released statuses. `applyBucket` adds no predicate for it.
  - `safeReviewFilters` accepts `q` (1 to 200 characters) from a closed key list. `applyCriteria` binds one escaped `literalContains` pattern twice, against the request number and the title.
  - The route, its policy (`requireAnalystRequestCollectionScope`) and its grant are unchanged. `all` widens statuses only inside that scope.
- **Contract.**
  - `AssessmentRequestQueueItem` gains the five fields: all required, nullable, enums as listed, `daysSinceSubmission` `minimum: 0`, `requestorName` 1 to 255. It keeps `additionalProperties: false`.
  - `filters[queue]` lists `all`. `filters[q]` is published, and `filters[requestStatus]`'s description names the all queue.
  - `schema.d.ts` was regenerated and `api:check` is clean.
  - `served-operations.json` and both catalogue copies are unchanged. The copies are byte-identical (same SHA-1).
- **Web.**
  - The closed parser reads the five fields.
  - `requestColumns` are, in order: Request, Title, Requestor, Assessment type, Business criticality, Status, Due date, Age and Submitted.
    - Criticality is plain text, with no `RiskRatingBadge`.
    - Age reads `{n} day|days`.
    - The due date goes through `formatRequestDate`.
    - Submitted renders `LocalInstant style="date"`. The UTC `formatDate` is deleted.
  - Request, Title, Status, Due date and Submitted sort through the URL. Age does not sort.
  - The query takes `all` and a closed sort enum. `listAssessmentRequests` sends `filters[q]`.
  - The queue select ends with `All requests`, and the line above it reads `Queue: All requests`.
  - The phone card shows four lines: the number with the badge, the title, `{requestor} · Due {date}` or `· No due date`, and `Age {n} {day|days}`.
  - The density key `assessment-review-requests` is unchanged. The skeleton follows the nine columns.
- **E2E.**
  - `helpers/requests.ts` now holds `chooseRelation`, moved here, and `createSubmittedRequest`.
  - New: `review-lists.spec.ts`, with the Brisbane zone and two `@journey` tests.
  - The mobile project's `testMatch` and its comment name the new file.

## Task Commits

1. **Task 1: A queue row shows who asked, what kind, how critical, when due and how old (tracer, TDD)**
   - `b3e063c`: test(11-06), RED
   - `0b01321`: feat(11-06), GREEN
2. **Task 2: Find a request by number, see every request in scope, and triage on a phone (TDD)**
   - `d3a52d7`: test(11-06), RED
   - `19dc30b`: feat(11-06), GREEN
   - `1e4c96e`: test(11-06), the assessment workflow proof's ten-key item (deviation 1)
3. **Task 3: Prove the triage columns, search and local date in the browser, then run the Strapi suite**
   - `20d3d4d`: test(11-06)

The ledger count is `git rev-list --count 9037867..20d3d4d` = 6. All six commits end with the required `Co-Authored-By` trailer, checked with grep.

## TDD Gate Compliance

- **Task 1:** RED `b3e063c` comes before GREEN `0b01321`.
  - Web RED: 7 of 161 tests failed, each on an assertion: six list cases (header count, the nine headers, cells, ages, missing values, sorting) and the parity case.
  - Strapi RED: 4 of 17 failed, each on an assertion: `QUEUE_ITEM_TRIAGE_FIELDS`, `QUEUE_ITEM_MISSING_FACTS_NOT_NULL`, `REVIEW_QUEUE_ITEM_KEYS_CHANGED_RQB-ORD-B` and `TRIAGE_AGE_WRONG`.
  - The Strapi tests' `tsconfig` has `noEmitOnError: true`. The new two-argument call did not compile until GREEN, so the RED build used `--noEmitOnError false` to emit the tests and run them to their assertions. The committed tests compile cleanly from GREEN on.
- **Task 2:** RED `d3a52d7` comes before GREEN `19dc30b`.
  - Web RED: 6 of 519 tests failed: the all queue's status loop, the search and queue service case, the search label, the queue options and both card cases.
  - Strapi RED: 6 of 37 failed:
    - `PHASE68_QUEUE_FILTER_VALUES`.
    - Both integration cases, at `REVIEW_QUEUE_READ_FAILED`, because the server refused `q` and `all` with 400.
    - The bucket list deepEqual.
    - Two parser cases, where `AssessmentRequestQueryError` was thrown because the parser refused the new key or value.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full Task 1 verify was re-run against the committed tree: web 170/170 (3 files), `api:check` and typecheck clean, Strapi 17/17. Task 2 started only after that.
- The plan is `type: execute`, so the plan-level `tdd-red-evidence` JUnit check was not run. The failures above are from the RED runs' own output.
- No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED, web (`assessment-list.test.tsx`, parity) | 7 failed, 154 passed (161) |
| Task 1 RED, Strapi (unit and buckets files) | 4 failed, 13 passed (17) |
| Task 1 GREEN, web (`src/features/assessments`, parity, chain) | 18 files, 523/523; typecheck clean; `api:check` exit 0 |
| Task 1 GREEN, Strapi (unit and buckets) | 17/17 |
| Tracer re-run of the Task 1 verify | 3 files, 170/170; `api:check` and typecheck clean; Strapi 17/17 |
| Task 2 RED, web | 6 failed, 513 passed (519) |
| Task 2 RED, Strapi (unit, buckets, contract-catalogue) | 6 failed, 31 passed (37) |
| Task 2 GREEN, web | 18 files, 528/528; typecheck clean; `api:check` exit 0 |
| Task 2 GREEN, Strapi | 37/37 |
| Task 3 Playwright (`review-lists.spec.ts`, `requestor-request-workflow.spec.ts`) | **6 passed (desktop 3, mobile 3), 0 failed, 0 flaky, 0 skipped; 2.2 min**. `git status --short` showed only my uncommitted Task 3 edits, as before the run |
| Full Strapi suite, first run | 666/667 in 13 min 13 s: `UNEXPECTED_ASSESSMENT_QUEUE_PROJECTION` (deviation 1) |
| Single file after the fix (`assessment-workflow.integration.test.ts`) | 25/25 |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **667/667, 0 skipped, 12 min 21 s** (05:29:55Z to 05:42:22Z) |
| `served-operations:write` (dev servers stopped) | 8/8; `docs/references/served-operations.json` unchanged |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **138 files, 2,949/2,949** |
| `typecheck` and `lint` | clean |
| `api:check` | exit 0. The contract changed, so `schema.d.ts` was staged and committed with the spec in both feature commits. `git update-index --refresh` after the final check left it clean |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **110 passed: desktop 96, mobile 14; 0 failed, 0 flaky, 0 skipped; 13.9 min** (05:51:00Z to 06:04:53Z). `git status --short` showed only the three operator items afterwards |

Before every Strapi, served-operations and Playwright run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.

## Files Created/Modified

- Strapi:
  - `collection-scope.ts`: the all bucket, `q`, and the projection with `today`
  - `review-queue-repository.ts`: the hydrated fields, the `requestor` displayName populate, the `q` predicate, and `all` in `applyBucket`
  - `controllers/csrm-assessment-request.ts`: `utcToday(new Date())`
- Strapi tests:
  - `review-queue.unit.test.ts` and `review-queue-buckets.integration.test.ts`: the plan's proofs
  - `contract-catalogue.integration.test.ts` and `assessment-workflow.integration.test.ts`: deviations 1 and 2
  - `helpers/strapi-http-harness.ts`: the fixture now takes a type and a criticality, and the bucket type includes `all`
- Contract: `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`
- Web:
  - `assessment-schema.ts`: the closed parser
  - `assessment-service.ts`: the query and `filters[q]`
  - `assessment-list.tsx`: the columns, sorting, the card, All requests and the search label
- Web tests:
  - `assessment-list.test.tsx`, `assessment-status-filters.test.tsx` and `contract-response-parity.test.ts`: the plan's cases
  - `assessment-review-workflow.test.tsx` and `assessment-service.test.ts`: fixtures widened to the new item
- E2E: `helpers/requests.ts` (new), `review-lists.spec.ts` (new), `requestor-request-workflow.spec.ts` (imports `chooseRelation`) and `playwright.config.ts`

## Decisions Made

- **Project, then sanitise.** `sanitizeOutput` kept `requestorName` and `daysSinceSubmission`, so the sanitise-then-project order the plan anticipated was not needed. The integration test reads both through the mounted route.
- **The age is a UTC day count.** It runs from the submission's UTC calendar date to the server's UTC today, using `normalizeDateTime` and `utcToday` from `insights/utc-date.ts`. A clock-skewed future submission reads 0.
- **Only the display name leaves Strapi.** The populate asks for `displayName` alone. A whitespace-only name reads null, which matches the spec's `minLength: 1`.
- **The review sort is a closed enum** of the twelve orders Strapi serves, falling back to `submittedDate:desc`. The table only produces those values. The enum also stops a hand-edited URL from turning the list into its error state.
- **Title is a long-text column.** It is `wrap: true` with `line-clamp-2`, per §7.1. Age is `numeric: 'magnitude'`.
- **A missing age on a card reads `Age not recorded`.** §7.1 specifies only the populated line.
- **UX-09 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: broken by the planned change] The assessment workflow proof pinned the five-key queue item**
- **Found during:** Task 3 (the first full Strapi suite: 666/667, `UNEXPECTED_ASSESSMENT_QUEUE_PROJECTION`)
- **Issue:** `assessment-workflow.integration.test.ts` ("mounted analyst review queue is exact, bounded, and follows existing detail links") required exactly five keys. The file is not on the plan's list.
- **Fix:** It now expects the ten published keys and no `requestor` key. The file passed 25/25 on its own, then the full suite passed 667/667.
- **Committed in:** `1e4c96e`, its own commit

**2. [Rule 1: broken by the planned change] The contract catalogue pinned the four queue values**
- **Found during:** Task 2, RED
- **Issue:** `PHASE68_QUEUE_FILTER_VALUES` in `contract-catalogue.integration.test.ts` asserted exactly the four lifecycle queues. The file is not on the plan's list.
- **Fix:** The assertion now lists `all`. A new `PHASE11_QUEUE_SEARCH_PARAMETER` pins `filters[q]` as `{ type: string, minLength: 1, maxLength: 200 }`.
- **Committed in:** `d3a52d7` (RED), green from `19dc30b`

**3. [Rule 3: blocking] The test harness could not build the fixtures the proofs need**
- **Issue:** `createAssessmentRequestFixture` took no assessment type or criticality, and `ReviewQueueBucketFixture` had no `all`.
- **Fix:** Both types are widened in `helpers/strapi-http-harness.ts`. The fixture already spread its data into the document. The shared counter is the application's own `countReviewQueueBucket`.
- **Committed in:** `b3e063c` and `d3a52d7`

**4. [Rule 3: blocking] Three web test fixtures did not satisfy the widened closed parser and type**
- **Fix:** The queue items in `assessment-review-workflow.test.tsx`, `assessment-service.test.ts` and `assessment-status-filters.test.tsx` gained the five fields.
- **Committed in:** `0b01321`

**5. [Copy rule] The empty-queue description said "bucket"**
- **Issue:** With `All requests`, the existing template produced the new sentence "There is no work in the All requests bucket". UI-SPEC "Voice" says new copy avoids "bucket".
- **Fix:** The template now says "queue" for every non-default queue. No test asserted the old sentence.
- **Committed in:** `19dc30b`

**6. [Rule 2: input validation] The review query's sort was any string of up to 100 characters**
- **Fix:** It is now a closed enum, as in Decisions.
- **Committed in:** `0b01321`

**7. [Plan order] The search label assertion**
- UI-SPEC §14.2 attributes the `Search assessment requests` to `Search by number or title` change at `assessment-list.test.tsx:198-199` to 11-04. 11-04 left it unchanged. This plan made the change in Task 2, as its own text says.

---

**Total deviations:**
- Two tests broken by the planned change (one of them found only by the full suite)
- Two blocking fixture and type widenings
- One copy fix
- One validation tightening
- One ordering note

**Impact on plan:** No added scope.
- No content type, Function, FunctionAPI, role, route or dependency changed (D-01, D-02, T-11-SC).
- `all` stays inside `requireAnalystRequestCollectionScope` and never reads a draft (T-11-03, integration proof).
- `q` is bound and escaped (T-11-03, T-11-20).
- The item carries no requestor email, username or identifier (T-11-19, unit and integration proofs).

## Issues Encountered

- **Line endings.** Several working-tree files are CRLF and their index copies LF. Edits were written in each file's own line endings, so Git printed its LF-to-CRLF warnings. No content outside the edits changed.
- **Production server log noise.** The full Playwright run logged 77 `The destination stream closed early` messages and one `failed-to-find-server-action`. 11-05 logged 75 and 1. Every test passed.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.

## Known Stubs

None. Every column renders a server fact. "Not recorded" and "Not provided" are the UI-SPEC's copy for a missing value.

## Threat Flags

None. No new endpoint or route. The widened read is the existing analyst-scoped `GET /v1/assessment_requests`, and the newly exposed field, the requestor's display name, is in the plan's threat model (T-11-19).

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-07 and later.
- `createSubmittedRequest` is the shared way to make a submitted request in a journey. Later plans reuse it, as the plan says.
- Phase 13's assignee column is one more `requestColumns` entry. Its `filters[assignee]` is one more key in `REVIEW_FILTER_KEYS` and `ReviewQueueCriteria`. This plan added no assignee filter, no `open` bucket and no reserved queue option (D-13 seam).
- Quick find (11-19) and the throughput report's status links can use `queue=all` with `filters[q]` and `filters[requestStatus]`.

## Self-Check: PASSED

- Created files exist: `apps/csrm/e2e/helpers/requests.ts` and `apps/csrm/e2e/review-lists.spec.ts`.
- Commits `b3e063c`, `0b01321`, `d3a52d7`, `19dc30b`, `1e4c96e` and `20d3d4d` exist on `post-demo`, and each has the trailer.
- Task 1 acceptance criteria re-ran PASS:
  - The spec's `AssessmentRequestQueueItem` requires the five fields and is closed.
  - The repository populates `requestor` with `displayName` only.
  - `assessment-list.tsx` contains the five headers and `LocalInstant`.
  - The verify exited 0, twice.
- Task 2 acceptance criteria re-ran PASS:
  - `REVIEW_QUEUE_BUCKETS` holds `"all"`, and `REVIEW_FILTER_KEYS` holds `"q"`.
  - The spec's queue enum holds `all`, and `filters[q]` has `maxLength: 200`.
  - The service sends `'filters[q]'`.
  - The list contains `Search by number or title` and `All requests`.
  - The verify exited 0.
- Task 3 acceptance criteria re-ran PASS:
  - The spec holds the Brisbane zone and both proof names, and the helper exports `createSubmittedRequest`.
  - The config lists the file and its comment names it.
  - The runs report `[mobile]` results for `review-lists.spec.ts`.
  - The Strapi suite passed in full and the tree was clean.
- The plan's verification passed: `api:check` is clean, the parity and chain guards pass, the web suite and typecheck pass, the full Strapi suite passes, and the full Playwright suite passes in both projects with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

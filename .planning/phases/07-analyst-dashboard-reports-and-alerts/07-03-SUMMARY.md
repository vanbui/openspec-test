---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 03
subsystem: analyst-review-queues
tags: [strapi, knex, sqlite, review-queue, database-predicates, node-test, tdd]

requires:
  - phase: 06.9-assessment-navigation-and-lifecycle-visibility
    provides: the four review queues, the queue and status intersection with its outside-queue short-circuit (06.9-04), and the semantic bucket rule selectReviewQueueBucket
  - phase: 05-risk-register-and-mitigation-management
    provides: the knex repository precedent (bound LIKE ... ESCAPE '!', countDistinct, a page of document ids, ordered hydration)
provides:
  - every analyst review queue answered by database predicates, exact at any volume, with the 1,000-row scan removed (D-21)
  - createReviewQueueRepository (count, selectPage, hydrate), countReviewQueueBucket and whereQuestionnaireHasSubmittedAnswer for plans 04 and 08
  - parseAnalystReviewQuery, REVIEWABLE_REQUEST_STATUSES, RELEASED_REQUEST_STATUSES, REVIEW_QUEUE_SORT_FIELDS and reviewQueueStatuses
  - the registry's sorted activeRequestIds snapshot and the workflow's bounded activeQuestionnaireGenerationRequestIds (cap 1,000, failing closed)
  - harness seams createFixtureDocument, createQuestionnaireLifecycleFixture, getRequestLifecycleDocument, seedReviewableRequestsDirectly, withHeldQuestionnaireGeneration and countReviewQueueBucketFixture, plus a widened createAssessmentRequestFixture
  - a D-30 equivalence proof: one fixture per lifecycle step, each agreeing with the semantic rule on the fully populated document
affects: [07-04, 07-08, 07-09, analyst-dashboard, review-queues, strapi-http-harness]

tech-stack:
  added: []
  patterns:
    - "A queue is the request-status bound ANDed with EXISTS facts over link tables, correlated on the outer request row r. Nothing is joined at the top level, so COUNT and the page read the same rows."
    - "Process-local state (the generation registry) enters SQL only as a bounded, bound id set: IN for the queue that selects it, NOT IN for the queue that excludes it."
    - "Validation is separate from query construction: the parser returns a closed read description, and each repository translates it with closed column maps."
    - "Mounted mutation checks: the harness recompiles dist from src, so mutants are applied to the source from a backup and restored byte-exact."

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment-request/services/review-queue-repository.ts
    - apps/strapi/tests/review-queue-buckets.integration.test.ts
  modified:
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/review-queue.unit.test.ts
    - apps/strapi/tests/questionnaire-generation.unit.test.ts

key-decisions:
  - "The equivalence oracle is selectReviewQueueBucket applied within the queue's status bound, exactly as the former scan applied it. The rule alone calls a draft 'awaiting-requestor', because no queue ever reads a draft."
  - "Text filters lower-case both sides in the database (LOWER(col) LIKE LOWER(?) ESCAPE '!'), matching Strapi's $containsi, rather than lower-casing the term in JavaScript."
  - "An isolating fixture (X2: an under-review request whose assessment carries the complete release triple) pins the released-assessment exclusion. It was an extra, explained RED: the scan populated the assessment without its approver, so it never saw a release."
  - "The repository re-asserts the active-id cap on every count and page, and hydration refuses more than 100 ids, so the bounds hold for every caller, not only the controller."
  - "reviewQueueStatuses (the former private queueStatuses) is exported, so countReviewQueueBucket builds the whole-queue read from the same status bound as the parser."

patterns-established:
  - "Review-queue style repository: closed column map, explicit NULL-order CASE term per sort key, r.id tiebreak, countDistinct through Number(), page of document_ids, then Document Service hydration with only the projected fields."
  - "Held-job seam: patch the dist provider to await a gate, act, then release, poll to completion (at most 50 polls) and restore in finally."

requirements-completed: [DASH-01]

duration: "about 33 minutes (12:27:24Z to the docs commit), including one full Strapi suite of 6 min 11 s"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 4
---

# Phase 7 Plan 03: Exact Review-Queue Buckets as Database Predicates Summary

**Every analyst review queue is now a knex query: the request-status bound ANDed with EXISTS lifecycle facts, with active generation applied as a bound id set. Pages, totals and the dashboard's shared `countReviewQueueBucket` are exact beyond 1,000 requests, and agree with the semantic rule at every lifecycle step.**

This is plan 3 of 9 (D-35), wave 1. It closes the carried-forward D-21 follow-up and gives plan 08 its single bucket definition. The endpoint, its parameters and the item shape are unchanged, so there was no spec or client change.

## Performance

- **Duration:** about 33 minutes, including the full Strapi suite (6 min 11 s), the web suite, the web typecheck, `api:check`, one RED and one GREEN run of the new mounted file, one run of `assessment-workflow.integration`, and seven mounted mutation runs.
- **Started:** 2026-09-24T12:27:24Z
- **Completed:** 2026-09-24, at the docs commit that carries this summary
- **Tasks:** 3 of 3. Each has a RED commit and a GREEN commit; Task 3's RED is Task 2.
- **Files modified:** 9 (2 created, 7 modified), plus this summary.

## Accomplishments

- **D-21 closed.**
  - The controller's analyst branch parses the query and keeps the outside-queue short-circuit.
  - It reads the generation snapshot only for "Generation in progress" and "Requires my attention".
  - It runs `count` and `selectPage` in parallel, hydrates at most one page of ids, and projects and sanitises as before.
  - The 1,000-row scan and its comment are deleted, as are `buildAnalystReviewCollectionQuery` and `hasActiveQuestionnaireGeneration`.
  - With 1,050 more submitted requests, the total, page count and page 11 are exact. The former scan reported 998 where the truth was 1,068.
- **One bucket definition (D-21, D-03).** `review-queue-repository.ts` expresses:
  - **Released:** the status bound alone.
  - **Generation in progress:** `document_id IN active`. An empty set issues no query.
  - **Awaiting requestor:** a released questionnaire, no submitted answer and no assessment. It ignores active jobs, as the rule does.
  - **Requires my attention:** `NOT IN active`, and no released assessment, and either nothing released to the Requestor, or a submitted answer, or an assessment.
  - A released assessment is the complete triple: `approved`, an `approval_date` and an `approved_by` link.
  - The answer fact uses `whereJsonPath("qu.answer", "$.state", "=", "submitted")`, with no `json_extract` and no JSON `LIKE`.
- **D-30 equivalence.** Thirteen lifecycle fixtures in the mounted file (steps 1 to 11, plus the isolating X1 and X2) each land in exactly their literal queue across all four queues. Each agrees with the semantic rule run on the fully populated document; the populate itself is asserted.
- **Contract parity.** The following are pinned at the mounted seam, and all hold after the rewrite:
  - title and request-number search, case-insensitive, now with literal `%`, `_` and `!`;
  - exact due date;
  - status intersection and the outside-queue empty page;
  - the default two-key order, with no submission date first;
  - no due date first ascending and last descending;
  - two explicit keys;
  - literal page slices, and pages that tile the queue;
  - the five item keys and their values.
- **Bounded registry snapshot.** `activeRequestIds()` returns a sorted copy. `activeQuestionnaireGenerationRequestIds` fails closed with `QuestionnaireGenerationCapacityError` beyond `MAX_ACTIVE_GENERATION_REQUEST_IDS = 1_000`, which the controller lets through as a generic 500.

## Task Commits

1. **Task 1 RED: pin the parsed review-queue read and the active generation id set.** `cc0b1dc` (test)
2. **Task 1 GREEN: parse the review queue read separately and expose the active generation id set.** `63b0db8` (refactor)
3. **Task 2 RED: pin every review queue bucket, beyond a thousand requests and during generation.** `757c0f3` (test)
4. **Task 3 GREEN: answer the analyst review queues from database bucket predicates.** `6980ca9` (feat)

**Plan metadata:** the `docs(07-03)` commit that carries this summary.

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment-request/services/review-queue-repository.ts` (created) contains:
  - the private fact builders, the exported `whereQuestionnaireHasSubmittedAnswer`, `applyBucket` (an exhaustive switch) and the escaped text filters;
  - the closed sort-column map with NULL-order CASE terms and the `r.id` tiebreak;
  - `createReviewQueueRepository` and `countReviewQueueBucket`;
  - `MAX_REVIEW_QUEUE_HYDRATION = 100`.
- `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`: the analyst branch of `find` is answered from the repository. The Requestor branch behaves as before.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` contains:
  - `parseAnalystReviewQuery`, with the same validation in the same order, and its closed `AnalystReviewQuery` union;
  - the exported, frozen status sets and sort fields;
  - `reviewQueueStatuses`;
  - the oracle comment on `selectReviewQueueBucket`.
  - The transitional wrapper was added in Task 1 and deleted in Task 3.
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts`: `activeRequestIds`, and the extended process-local comment.
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts`: `MAX_ACTIVE_GENERATION_REQUEST_IDS`, `QuestionnaireGenerationCapacityError`, `assertActiveGenerationCapacity` and `activeQuestionnaireGenerationRequestIds`. `hasActiveQuestionnaireGeneration` was removed because no caller remained.
- `apps/strapi/tests/helpers/strapi-http-harness.ts`: the seven seams listed under "provides", plus the `CsrmFixtureUid` closed union.
- `apps/strapi/tests/review-queue-buckets.integration.test.ts` (created): 8 mounted tests.
- `apps/strapi/tests/review-queue.unit.test.ts`: the builder assertions moved to the parsed read, plus status-set, sort-field, default-read and scope cases (6 tests).
- `apps/strapi/tests/questionnaire-generation.unit.test.ts`: the registry snapshot and workflow accessor cases (6 tests).

## Verification

**RED:**

| Check | Result |
| --- | --- |
| Task 1: `tsc -p tests/tsconfig.json` with only the tests changed | exit 1, 14 errors, all missing exports: TS2305 ×6 (`MAX_ACTIVE_GENERATION_REQUEST_IDS`, `assertActiveGenerationCapacity`, `RELEASED_REQUEST_STATUSES`, `REVIEWABLE_REQUEST_STATUSES`, `REVIEW_QUEUE_SORT_FIELDS`, `parseAnalystReviewQuery`), TS2724 ×2 (`QuestionnaireGenerationCapacityError`, `activeQuestionnaireGenerationRequestIds`), TS2339 ×6 (`activeRequestIds`) |
| Task 2: `review-queue-buckets.integration` against the 1,000-row scan | 3 passed, 5 failed. Lifecycle equivalence, filters, and ordering and paging passed on the scan (characterisation). The failures follow this table. |

The five Task 2 failures, each for the expected reason:

| Test | Failure |
| --- | --- |
| X2 released-assessment | `LIFECYCLE_BUCKET_MEMBERSHIP_X2_requires-attention` (actual true), the scan's under-populated assessment |
| Escape | `PERCENT_TREATED_AS_WILDCARD` (2 ids where 1 is expected) |
| Beyond the bound | `REQUIRES_ATTENTION_TOTAL_CAPPED`, `998 !== 1068` |
| Held generation | `MODULE_NOT_FOUND` for `dist/.../review-queue-repository.js`. It is thrown by the counter call, which is the last statement of the action, so the endpoint assertions before it passed on the scan; the held job completed in `finally`. |
| Awaiting ignores active ids | `MODULE_NOT_FOUND`, the same module |

**GREEN:**

| Check | Result |
| --- | --- |
| Task 1: root `tsc`, tests `tsc` | both exit 0 |
| Task 1: `review-queue.unit` + `questionnaire-generation.unit` | 12 passed, 0 failed |
| Task 1 mutant: the outside-queue check moved before sort validation (compiled output, restored) | 1 failed: `OUTSIDE_QUEUE_STATUS_SKIPPED_VALIDATION_{"filters":{"requestStatus":"approved"},"sort":"createdBy:desc"}`. After restore, 6 of 6. |
| Task 3: `review-queue-buckets.integration` | 8 passed, 0 failed (re-run after the mutation checks: 8 of 8) |
| Task 3: `assessment-workflow.integration`, with `git diff 6f2f27b` empty for the file | 22 passed, 0 failed, including the three 06.9-04 queue tests |
| Task 3: the two unit files against the final source | 12 passed, 0 failed |

**Mounted mutants.** Each mutant was applied to the repository source, the mounted file was run, and the source was restored. The sha256 was `1cfa43ac…` before and after, byte-exact.

| Mutant | Killed by |
| --- | --- |
| released predicate without the `approved_by` link | `LIFECYCLE_BUCKET_MEMBERSHIP_08_requires-attention` (fixture 8 in no queue) |
| `NOT IN active` removed | `HELD_REQUEST_REQUIRES_ATTENTION`, `SHARED_COUNTER_IGNORES_ACTIVE_GENERATION` |
| released-assessment exclusion removed | `LIFECYCLE_BUCKET_MEMBERSHIP_X2_requires-attention` |
| search term not escaped | `PERCENT_TREATED_AS_WILDCARD` |
| request-status bound removed | `LIFECYCLE_BUCKET_MEMBERSHIP_01_released`, `..._X2_released`, `STATUS_FILTER_NOT_APPLIED` |
| awaiting-requestor ignores the assessment | `LIFECYCLE_BUCKET_MEMBERSHIP_X1_awaiting-requestor` |
| generation queue not restricted to active ids | `HELD_REQUEST_NOT_GENERATING` |

**Acceptance checks:**

| Check | Result |
| --- | --- |
| `scanLimit` or `1_000` in the controller | none |
| `createReviewQueueRepository` in the controller | present (import and use) |
| `grep -rn buildAnalystReviewCollectionQuery apps/strapi/src` | empty |
| `whereJsonPath` in the repository | present; no `json_extract`, no `%"state"` |
| `hasActiveQuestionnaireGeneration` in `apps/strapi/src` and `apps/strapi/tests` | none |
| `git diff --name-only 6f2f27b HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| Added lines and commit messages scanned for tool or assistant names and attribution trailers | none |
| Deleted files across the plan | none |

**Plan gate (final tree, identical to `6980ca9`):**

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 285 passed, 0 failed, 0 skipped, exit 0 (12:51:22Z to 12:57:37Z). This is the 272 at the 07-01 gate plus 13 new: 3 parser, 2 registry and accessor, 8 mounted. |
| `pnpm --filter @csrm/web test` (full) | 444 passed across 51 files, exit 0. Unchanged, since no web code changed. |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0, no diff in `schema.d.ts` |

The web typecheck and `api:check` ran while the Strapi suite was running. Neither reads `apps/strapi/dist`. The web unit suite ran after it.

## Decisions Made

- **The oracle is bounded by status.** Applied literally, `selectReviewQueueBucket(bucket, document, () => false)` calls a draft "awaiting-requestor", because the rule never reads the queue's status bound. That contradicts the plan's own literal expectation for fixture 11. The mounted test therefore compares each queue's membership with `QUEUE_STATUSES[bucket].includes(status) && selectReviewQueueBucket(...)`, which is exactly how the former scan applied the rule.
- **Case-insensitive matching happens in the database.** `LOWER(col) LIKE LOWER(?) ESCAPE '!'` gives the same folding on both sides of the comparison, as Strapi's `$containsi` did. Lower-casing only the term in JavaScript would fold non-ASCII capitals that SQLite's ASCII-only `LOWER` leaves in the column. The escaping of `!`, `%` and `_` follows the Risk Register.
- **NULL ordering.** `CASE WHEN col IS NULL THEN 0 ELSE 1 END` runs in the same direction as the column, so NULL is the smallest value both ways: first ascending, last descending. This is SQLite's native order, so the SQLite suite cannot tell it from a plain `ORDER BY`. The term exists for PostgreSQL (see the notes for plan 09).
- **Hydration.** Hydration reads only the five projected fields and restores the page order. A request deleted between the page read and hydration is left out rather than failing the read.
- **Defence in depth.**
  - The repository calls `assertActiveGenerationCapacity` on every count and page, so plan 08's dashboard and any later caller get the same fail-closed bound.
  - `hydrate` refuses more than `MAX_REVIEW_QUEUE_HYDRATION` (100) ids.
  - `applyBucket` is an exhaustive switch that throws on an unknown queue.
- **The whole-queue read shares the parser's status bound.** `reviewQueueStatuses` is the former private `queueStatuses`, exported. `countReviewQueueBucket` builds its whole-queue criteria with it, so the dashboard count and the queue pages share the status bound as well as the predicates.
- **Direct seed layout.** `seedReviewableRequestsDirectly` numbers requests `${prefix}-${index}` with the index padded to five digits. It gives them submission dates one minute apart from 2030-01-01 and returns the request numbers in order, so page 11's content is a literal slice of that list. Like the risk-type precedent, it sets no `publishedAt`: for types without draft and publish, the Document Service applies no status lookup.
- **`requirements-completed` lists DASH-01**, copied from the plan. DASH-01 completes only with the phase, and `REQUIREMENTS.md`, `STATE.md` and `ROADMAP.md` were not touched.

## Deviations from Plan

1. **[Additional proof, extra RED] Fixture X2 and its own test.**
   - **Found during:** Task 2 design.
   - **Issue:**
     - Fixtures 1 to 11 cannot tell the requires-attention predicate with `NOT assessmentReleased` from one without it.
     - Fixture 8 has partial facts, and fixtures 9 and 10 are excluded by their status.
     - The former scan populated `assessment: true` without `approvedBy`, so it never recognised a release (the research's Q3 latent fact).
   - **Fix:** an under-review request whose assessment carries the complete release triple must be in no queue. It sits in a separate test so the RED stayed legible. It failed on the scan as explained above, and its mutant is killed.
   - **Behaviour change:** only in a state production cannot reach, because a release approves the request in the same transaction.
   - **Commits:** `757c0f3`, `6980ca9`.
2. **[Additional proof] Fixture X1.** A released questionnaire in draft plus a draft assessment. It is the only fixture whose membership rests on `assessmentExists` alone, in both action queues. Its mutant is killed. It is unreachable in production and labelled as such in the test.
3. **[Plan detail] The oracle is applied within the status bound**, for the reason under Decisions Made.
4. **[Plan detail] `LOWER(?)` on the search term**, for the reason under Decisions Made.
5. **[Plan detail] Proof beyond the behaviour list.**
   - **Unit tests:** the snapshot is a copy, not registry state; three sort keys, a `sideways` direction and page 0 are refused; the analyst-scope refusals.
   - **Mounted tests:**
     - the two-key explicit order;
     - the item values as well as the keys;
     - a due-date negative case;
     - tiling at page size 7, with the meta checked on every page;
     - the counter against the endpoint total for all four queues;
     - the counter with one active id (total minus 1);
     - "Released" ignoring active ids;
     - the held job asserted to reach `completed`, not only a terminal state.
6. **[Plan detail] Additional exports.**
   - **`collection-scope.ts`:** `reviewQueueStatuses`, and the types `AnalystReviewRead`, `AnalystReviewOutsideQueue`, `AnalystReviewQuery`, `ReviewQueueSort`, `ReviewQueueSortField` and `RequestStatus`.
   - **`review-queue-repository.ts`:** `ReviewQueueCriteria`, `ReviewQueueRepository`, `ReviewQueueRepositoryError` and `MAX_REVIEW_QUEUE_HYDRATION`.
7. **[Plan detail] The registry keeps `hasActiveJob`**, as the plan says ("beside `hasActiveJob`"), although nothing calls it now that the workflow accessor is gone.
8. **STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.** The orchestrator owns them, so the executor's state-update steps were skipped.

**Total deviations:** 8. None reduces scope or changes the published contract. Items 1 and 2 strengthen D-30. Items 3 and 4 resolve a literal reading that would contradict the plan's own expectations or parity. Items 5 to 7 add proof or exports. Item 8 follows the orchestrator's instruction.

## Behaviour Changes an Analyst Could Notice

- **Search:** a `%`, `_` or `!` in the Title or Request number filter is now matched literally. Before, `%` and `_` were wildcards, so `_` matched every title.
- **Exactness beyond 1,000:** beyond 1,000 reviewable requests, every total, page count and page is exact. Before, the scan reported what it had read.
- **Ties:** ties in a single-key sort, such as two equal due dates, are broken by the request's database id. Before, the order was whatever the database returned.
- **Unreachable state:** an under-review request whose assessment is fully released is no longer in "Requires my attention". Production cannot reach this state.

## Notes for Plan 09 (D-30 divergence and Phase 8 record)

For `docs/contract-gaps/phase-07-derived-insights.md`:
1. **Malformed question definition.** The application reads the questionnaire as not started. The SQL reads it as submitted if any answer's `state` is `submitted`. This is the accepted divergence.
2. **`submittedAt` is not read by the SQL.** The SQL reads `answer.state` only. The application also requires `submittedAt` to be a string. Every submit stamps both, so a submitted state without a timestamp is malformed data.
3. **Mixed submitted and draft answers.** Where active questions hold both, the SQL says submitted and the application says draft. Submission is all or nothing (submit, immutability, revert and return-to-review), so this is unreachable.
4. **Process-local registry (T-07-03-05).** "Generation in progress" is exact for a single Strapi process, because the registry is process-local. A multi-process deployment needs a shared job store.
5. **PostgreSQL portability (research A2).** The NULL-order CASE terms, `whereJsonPath` and `LOWER(...) LIKE LOWER(?) ESCAPE '!'` are portable by construction, but unverified because `pg` is not installed.

## Issues Encountered

- **Line endings.** New files were written with LF. Git warns that they will be CRLF in the working copy (`core.autocrlf=true`). The index is LF, and `api:check` showed no content diff. This is cosmetic.
- **pnpm engine warning.** The standalone pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix. `node` resolved to v24.19.0 for every run.

## Deferred Issues

None from this plan. The known pre-existing items recorded by 07-01 are unchanged: `authorization.policy.test.js` never runs, and `verify-phase-06-integrity.mjs` has stale counts.

## Known Stubs

None. No UI changed, and every repository function is wired to the live endpoint or exported for plan 08.

## Threat Flags

None beyond the plan's threat model.
- **T-07-03-01:** every SQL value is bound, every column comes from a constant or the closed sort map, and the only `orderByRaw` fragment is built from those closed values. `whereQuestionnaireHasSubmittedAnswer` binds its server-chosen column as an identifier (`??`).
- **T-07-03-02 and T-07-03-04:** the analyst scope check still runs inside `parseAnalystReviewQuery`, before any read.
- **Harness seam:** `withHeldQuestionnaireGeneration` is test-only. It patches the deterministic provider in the harness process and restores it in `finally`.

## Next Phase Readiness

- **Plan 04** can import `REVIEWABLE_REQUEST_STATUSES` and compare it with 07-01's `REQUEST_ALERT_STATUSES`. The repository is the knex typing and style reference: `Database["connection"]` and `ReturnType<Knex["queryBuilder"]>`, with no new dependency.
- **Plan 08** can call `countReviewQueueBucket(strapi, bucket, activeQuestionnaireGenerationRequestIds(strapi))` and `whereQuestionnaireHasSubmittedAnswer(query, "q.id")`. The mounted seam `countReviewQueueBucketFixture` is ready for its tile-to-list equality test.
- **Browser coverage:** plan 05's targeted Playwright run (`assessment-navigation-lifecycle.spec.ts`) exercises these queues in the browser.

## TDD Gate Compliance

- **Task 1:** RED `cc0b1dc` (test), then GREEN `63b0db8` (refactor). The GREEN is a `refactor` because the observable queue behaviour did not change in that task.
- **Task 2 and Task 3:** RED `757c0f3` (test), then GREEN `6980ca9` (feat).

## Self-Check: PASSED

- `review-queue-repository.ts` and `review-queue-buckets.integration.test.ts` exist and are tracked at HEAD.
- Commits `cc0b1dc`, `63b0db8`, `757c0f3` and `6980ca9` exist on `dev`.
- No tracked file was deleted between `6f2f27b` and HEAD.
- `git status` showed only the pre-existing untracked `.planning/debug/` before this summary was written.

---
*Phase: 07-analyst-dashboard-reports-and-alerts*
*Completed: 2026-09-24*

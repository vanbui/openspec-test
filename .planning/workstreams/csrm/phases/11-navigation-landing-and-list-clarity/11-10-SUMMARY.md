---
phase: 11-navigation-landing-and-list-clarity
plan: 10
subsystem: api
tags: [strapi, knex, openapi, owner-scope, request-lifecycle, holder, served-operations, authorization-matrix, zod, vitest, node-test]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-08: holderFor, LifecycleKey and the §6.1 next-action sentences in request-lifecycle.ts; 11-06: the review queue repository's lifecycle facts, literalContains and its id-tiebreak order"
  - phase: 10-existing-flow-gap-closure
    provides: "the two catalogue copies, served-operations.json, the authorization matrix and its provenance check, the contract parity and chain guards, questionnaire-scope.ts"
provides:
  - "Strapi: GET /api/v1/my_requests (operationId assessment-workflow/get-my-requests) under the existing FunctionApi function.risk_assessment_requests.my_requests.api.01. Its router is routes/my-requests.ts with requireRequestCollectionScope, and its handler is api::csrm-assessment-request.my-requests.list"
  - "Strapi services/my-requests.ts: parseMyRequestsQuery (q, status, holder, sort, page, pageSize; anything else is a 400), applyRequestHolder (D-20 over the review queue's exported facts), ownedRequests, ownRequestorId, projectMyRequest and listMyRequests"
  - "Strapi: countOwnedRequestsByHolder and MyRequestStatusSummary.byHolder { requestor, analyst, none }"
  - "Reused by export rather than copied: questionnaireReleased, questionnaireSubmitted, assessmentExists and literalContains (review-queue-repository.ts); daysSinceSubmission (collection-scope.ts); questionnaireProgress (questionnaire-scope.ts)"
  - "Spec: /v1/my_requests with six parameters; MyRequestListResponse, the closed MyRequestItem and MyRequestHolderCounts; byHolder required on MyRequestStatusSummary; schema.d.ts regenerated"
  - "Web: MyRequestListQuery, MyRequestItem and MyRequestList (request-domain.ts); myRequestListResponseSchema and parseMyRequestListPayload (request-schema.ts); listMyRequests(query) and its parity entry request.listMyRequests (request-service.ts); the status summary parser requires the closed byHolder"
  - "Catalogue design note 9 in both copies (cmp silent); served-operations.json lists GET:/api/v1/my_requests as served; the six-actor matrix row"
affects: [11-11, 11-12, 11-13, 11-19]

actuals:
  tokens: 24800
  tasks: 3
  commits: 5
plan_head_before: d8c2105d089e472d28bc761a24105f3de7cb1c2a
plan_head_after: 6fd6eb6dfefc7a5f584e71a5fe0ca61b62f16459

tech-stack:
  added: []
  patterns:
    - "One SQL definition serves a list's filter, its total and a summary's counts: applyRequestHolder feeds the my requests page, its pagination total and countOwnedRequestsByHolder"
    - "A Requestor-side list projects every item through a fixed requestor view state, so an analyst's own requests never read from the analyst's side, whatever the policy sets"
    - "A matrix row for a 'My' list reads its owner total from meta.pagination.total, beside mustNotDisclose"

key-files:
  created:
    - apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
    - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
    - apps/backend/tests/my-requests.integration.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/operations.ts
    - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
    - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/tests/request-status-summary.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts

key-decisions:
  - "11-10: every item is projected through a fixed requestor view state (REQUESTOR_VIEW), not ctx.state, so an analyst's own list reads Requestor sentences and /app/requests and /app/questionnaires hrefs even if a future grant made the policy set the analyst actor (T-11-27, research Pitfall 12)"
  - "11-10: the SQL holder follows D-20 literally (requestor for a draft or a released, unsubmitted questionnaire with no Risk Assessment; none for approved or closed; analyst otherwise). Fixtures at all eight lifecycle steps, plus a returned draft and a closed request, prove it equal to holderFor(deriveRequestLifecycle(facts).currentKey). The unreachable 'reviewable status with a released assessment' state (queue fixture X2) is not covered by D-20 and is not added"
  - "11-10: countOwnedRequestsByHolder runs one counted query per holder through applyRequestHolder, not a CASE expression, so there is one predicate definition"
  - "11-10: the query is plain keys (q, status, holder, sort, page, pageSize). Default sort updatedAt:desc, default page size 10, page at most 1,000,000; a repeated parameter or an operator object is a 400, and the query is checked before the owner scope, as on the status summary"
  - "11-10: getMyRequestStatusSummary still returns the status counts only. Its parser now requires and checks byHolder, but the counts are not yet returned to callers. Plans 11-12 and 11-13 must widen the return value to read byHolder"
  - "11-10: ownRequestorId moved to services/my-requests.ts and is shared by both owner-scoped controllers; each controller keeps its own safeError, the codebase's controller pattern"
  - "11-10: UX-08 and UX-09 are declared by later Phase 11 plans as well; requirements.ready-ids reports 0/2 ready, so REQUIREMENTS.md is unchanged"

patterns-established:
  - "applyRequestHolder(query, holder): the single SQL holder predicate. Home, the sidebar counts and quick find read it through listMyRequests or byHolder"

requirements-completed: []

coverage:
  - id: D1
    description: "Any actor lists exactly their own requests, and each item's holder and stage equal the lifecycle's holderFor(currentKey) at all eight steps plus closed. The holder filter selects exactly those items, with exact totals"
    requirement: "UX-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/my-requests.integration.test.ts#each of my requests names who holds it, equal to the lifecycle's holder at every step (D-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each item carries the Requestor-side next step (with an href only for the holder's own step), its age, the return reason and date for a returned draft, and the questionnaire's progress once released. No item carries an assessment number, an assessment id or any Risk field"
    requirement: "UX-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/my-requests.integration.test.ts#my requests carry the Requestor's next step, age, return facts and released questionnaire progress"
        status: pass
    human_judgment: false
  - id: D3
    description: "Owner isolation: the second Requestor never sees the first Requestor's requests. The analyst lists only its own request, read from the Requestor's side. The service agent and the analyst-named identity without the analyst role see an empty list. A missing or inactive identity gets 403, and a missing token gets 401"
    verification:
      - kind: integration
        ref: "apps/backend/tests/my-requests.integration.test.ts#every actor lists only the requests it raised, an analyst from the Requestor's side (D-03, T-11-05, T-11-27)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts#GET:/api/v1/my_requests answers each actor as stated"
        status: pass
    human_judgment: false
  - id: D4
    description: "The list searches by number or title word (literally), filters by status and holder, sorts by the eight My requests sort values with an id tiebreak, and pages at 10, 20 or 50; any other key or value is one safe 400"
    requirement: "UX-09"
    verification:
      - kind: integration
        ref: "apps/backend/tests/my-requests.integration.test.ts (the search, status, sort, tiling and 400 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The status summary carries byHolder for every actor. Its counts sum to total, and each count equals the my requests holder total for that actor"
    requirement: "UX-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-status-summary.integration.test.ts#mounted request status summary counts the caller's own requests by holder, equal to the my requests holder totals"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract chain: a closed specification and generated client; the closed web parser and listMyRequests sending exactly the parsed query; both catalogue copies byte-identical with design note 9; served-operations.json listing the operation as served with its web caller"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0); cmp of the two catalogue copies (silent)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses my requests closed, with each item's holder, stage and next step and no assessment field (D-02 item 6, T-11-53)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-service.test.ts#lists my requests through GET /v1/my_requests with exactly the parsed query (D-02 item 6, D-34)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 11 my requests is published closed and granted through My Requests"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/served-operations.integration.test.ts (check mode, in the full suite)"
        status: pass
    human_judgment: false

duration: 44min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 10: My requests with who holds each one Summary

**Strapi now serves the catalogue-reserved `GET /api/v1/my_requests` under its existing My Requests FunctionApi. The owner scope comes from the policy: every actor lists only the requests it raised, and an analyst reads its own requests from the Requestor's side. Each item names its holder (decided in SQL from the review queue's lifecycle facts and proved equal to `holderFor` at every step), its stage and its Requestor-side next step. It also carries its age, return facts and released questionnaire progress, and never any assessment field. The status summary gains `byHolder` from the same predicate. The specification, generated client, closed web parser, `listMyRequests`, catalogue note 9, `served-operations.json` and the six-actor matrix row complete the chain.**

## Performance

- **Duration:** 44 min. The wall clock includes the full Strapi suite (13 min 21 s) and the full web suite.
- **Started:** 2026-10-03T09:25:54Z
- **Completed:** 2026-10-03T10:10:00Z
- **Tasks:** 3 of 3
- **Files changed:** 25: 4 created and 21 modified, none deleted.

## Accomplishments

- **The route (D-03).**
  - `GET /v1/my_requests` has its own router, as the status summary does, with `global::csrm-app-enabled` and `global::csrm-authorization` `{ operation: "GET:/api/v1/my_requests", requireRequestCollectionScope: true }`.
  - The FunctionApi `function.risk_assessment_requests.my_requests.api.01` already existed and was already granted to `role.requestor` through My Requests. No grant, Function, FunctionApi, role or content type changed: the catalogue's `roles`, `functions`, `functionApis` and `metadata` compare equal to `d8c2105`.
- **The owner predicate (T-11-05).**
  - The controller reads `ownRequestorId(ctx.state)` and returns 403 unless the policy decided `own`.
  - The service joins `csrm_assessment_requests_requestor_lnk as o` on that numeric id.
  - Hydration re-applies `requestor.id = requestorId` as a second bound.
  - No query value reaches the owner check.
- **The holder predicate (D-20).** `applyRequestHolder` composes the exported `questionnaireReleased`, `questionnaireSubmitted` and `assessmentExists` facts with `REVIEWABLE_REQUEST_STATUSES` and `RELEASED_REQUEST_STATUSES`:
  - `requestor`: a draft, or reviewable work with a released, unsubmitted questionnaire and no Risk Assessment;
  - `none`: approved or closed;
  - `analyst`: every other reviewable request.
- **The item (D-02 item 6).** Each item carries `documentId`, `requestNumber`, `title`, `requestStatus`, `submittedDate`, `dueDate`, `updatedAt`, `daysSinceSubmission`, `holder`, `stage { key, label }`, `nextAction { summary, href? } | null`, `returned { reason, at } | null` and `questionnaire { documentId, answered, total } | null`.
  - `holder` is `holderFor(lifecycle.currentKey)`, and the integration test proves it equal to the SQL predicate.
  - `nextAction` is the §6.1 Requestor sentence. It has an href only at the holder's own step, and is null for a closed request.
  - `questionnaire` is present only when the relationship projection marks it available to the Requestor, that is, once it is released.
- **The list controls (D-34).**
  - `q` (1 to 200 characters) matches the number or the title literally, using the queue's `literalContains` with `ESCAPE '!'`.
  - `status` takes the datamodel vocabulary and `holder` takes the three holders.
  - `sort` takes the eight `requestSortValues`, over a closed column map, with NULL smallest and the id as the final tiebreak.
  - `pageSize` is 10, 20 or 50, and `page` is between 1 and 1,000,000.
  - Anything else is a 400 with the existing safe message.
- **`byHolder` (D-11).** `countOwnedRequestsByHolder` counts the owner's requests once per holder through `applyRequestHolder`. Its three counts sum to `total` and equal the list's holder totals for every actor.
- **The contract chain.**
  - The spec has the path with six parameters and the closed `MyRequestListResponse`, `MyRequestItem` and `MyRequestHolderCounts` schemas, with `byHolder` required on the summary.
  - `api:generate` was run, and `api:check` is clean.
  - The web gained `listMyRequests(query)`, which sends only the parameters the caller set, with its closed parser and its parity entry `request.listMyRequests`.
  - The summary parser requires the closed `byHolder`.
- **The inventory and the matrix.**
  - Design note 9 was edited in both copies, which are byte-identical.
  - `served-operations.json` was regenerated with the servers stopped. `GET:/api/v1/my_requests` moved from `unserved` to `served` with `webCallers: ["src/features/requests/request-service.ts"]`.
  - The matrix row was added.

### Design note 9, exactly as written

The list of reserved request aliases served through the core routes no longer names `my_requests`: it now begins "the /api/v1 request aliases (assessment_requests create, get, patch and submit, …". The note now ends:

> Phase 11 serves GET /api/v1/my_requests as reserved, under the Requestor's My Requests Function, owner-scoped by the policy; it lists the caller's own requests with their lifecycle holder.

## Task Commits

1. **Task 1: A person lists their own requests with who holds each one (tracer, TDD)**
   - `00b6fdd`: test(11-10), RED
   - `4c7da53`: feat(11-10), GREEN
2. **Task 2: Holder counts on the status summary, and search, status, sort and pagination on my requests (TDD)**
   - `86e5746`: test(11-10), RED
   - `b7c5c82`: feat(11-10), GREEN
3. **Task 3: Record the served operation in the catalogue, the inventory and the matrix, then run the Strapi suite**
   - `6fd6eb6`: feat(11-10)

The ledger count is `git rev-list --count d8c2105..6fd6eb6` = 5. A grep confirms that every commit ends with the `Co-Authored-By: Claude Opus 5.5` trailer.

## TDD Gate Compliance

- **Task 1.** RED `00b6fdd` comes before GREEN `4c7da53`.
  - Web RED: 3 of 152 tests failed:
    - two because `service.listMyRequests is not a function`;
    - the parity case because `MyRequestItem is not published`.
  - Strapi RED: 5 of 5 tests failed, each because `GET /api/v1/my_requests` answered 404 (`MY_REQUESTS_READ_FAILED_*`, or 404 where 403 was expected). All the fixtures were built before the first failure.
  - Tracer feedback gate: the run was interactive, in end-of-phase mode, with an automated-only verify. I re-ran the whole verify chain against the committed tree, and it exited 0: web 229/229 (11 files), `api:check` and typecheck clean, Strapi 5/5. Task 2 started only after that.
- **Task 2.** RED `86e5746` comes before GREEN `b7c5c82`.
  - Web RED: 2 of 8 tests failed, both on the summary parser: the payload carrying `byHolder` was refused, and the payload missing `byHolder` was accepted.
  - Strapi RED: 9 of 31 tests failed:
    - the five query cases (q, status and sort answered `400 … query is invalid`);
    - three summary cases (`SUMMARY_DATA_KEYS_LITERAL_*`, and `byHolder` absent);
    - `PHASE7_SUMMARY_COUNT_KEYS`.
- The plan is `type: execute`, so the plan-level `tdd-red-evidence` record was not produced. The failures above come from the RED runs' own output.
- No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED, web (request service and parity) | 3 failed, 149 passed (152), 2 files |
| Task 1 RED, Strapi (`my-requests`) | 5 failed, 0 passed (5) |
| Task 1 GREEN and tracer re-run, web (`src/features/requests` and parity) | 11 files, 229/229; typecheck clean; `api:check` exit 0 |
| Task 1 GREEN, Strapi (`my-requests`) | 5/5 (29.6 s); related unit files 65/65 |
| Task 2 RED, web | 2 failed, 6 passed (8) |
| Task 2 RED, Strapi (`my-requests`, `request-status-summary`, `contract-catalogue`) | 9 failed, 22 passed (31) |
| Task 2 GREEN, web (same paths) | 11 files, 229/229; typecheck clean; `api:check` exit 0 |
| Task 2 GREEN, Strapi (same three files) | 31/31 |
| Task 3, web chain guard and parity | 2 files, 155/155 |
| Task 3, Strapi (`served-operations` check mode, `contract-catalogue`, matrix provenance, `authorization-matrix`) | **152/152, 96.4 s.** The matrix's 116 rows took 38.2 s of row time, plus the harness start; the new row took 79 ms |
| `served-operations:write` (dev servers stopped) | 7 passed, 1 skipped by design (the write run skips its drift check); the diff is only the moved operation and `generatedAt` |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **689/689, 0 skipped, 13 min 21 s** (09:54:13Z to 10:07:34Z) |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **139 files, 3,004/3,004** (37.2 s) |
| `lint` / `typecheck` / `api:check` (final, on the committed tree) | clean / clean / exit 0 |
| Playwright | Not run, by plan: the operation's first web surface is plan 11-11 |

- Before every Strapi run and the `served-operations:write` run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.
- The contract changed, so `schema.d.ts` was staged with the spec before `api:check` and committed with it in `4c7da53` and `b7c5c82`. Afterwards `git update-index --refresh` left it clean.
- After every commit, `git status --short` showed only the three operator items.

## Files Created/Modified

- **Strapi**
  - `routes/my-requests.ts`, `controllers/my-requests.ts` and `services/my-requests.ts`: new.
  - `operations.ts`: adds `listMyRequests`.
  - `review-queue-repository.ts`: exports the three facts and `literalContains`.
  - `collection-scope.ts`: exports `daysSinceSubmission`.
  - `request-status-summary.ts`: adds `countOwnedRequestsByHolder` and the `byHolder` type.
  - `controllers/my-request-status-summary.ts`: adds `byHolder` and uses the shared `ownRequestorId`.
  - `questionnaire-scope.ts`: `questionnaireProgress`, which `projectQuestionnaire` reuses.
- **Strapi tests**
  - `my-requests.integration.test.ts`: new, 10 tests.
  - `request-status-summary.integration.test.ts`: `byHolder`.
  - `contract-catalogue.integration.test.ts`: the summary keys, and a new Phase 11 test.
  - `served-operations.integration.test.ts`: the reason removed.
  - `fixtures/authorization-matrix.ts`: the row.
  - `authorization-matrix.integration.test.ts`: the list total read.
- **Contract:** `specification.json`, `schema.d.ts`, both catalogue copies and `served-operations.json`.
- **Web:** `request-domain.ts`, `request-schema.ts`, `request-service.ts`, `request-service.test.ts` and `contract-response-parity.test.ts`.

## Decisions Made

See `key-decisions` in the frontmatter. The two with the most consequence are:

- **The Requestor view is fixed in the service.** It does not follow `ctx.state`. The policy already sets the Requestor actor for this operation, because it is granted to `role.requestor` only. The fixed view makes the analyst-side reading impossible even if a grant is later widened.
- **`getMyRequestStatusSummary` keeps its return shape.** The parser requires `byHolder`, but the function still returns the seven status counts, so the requestor dashboard and its tests are unchanged. Plans 11-12 and 11-13 read `byHolder` and must widen this return value. That is a one-line change in `parseMyRequestStatusSummaryPayload`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] Two tests outside the plan's task lists pinned the old status summary shape**
- **Found during:** Task 2, RED (the pre-GREEN grep the orchestrator asked for)
- **Issue:** Adding `byHolder` would break two existing assertions:
  - the Phase 7 summary test in `contract-catalogue.integration.test.ts` pins `MyRequestStatusSummary` to exactly eight keys and eight `required` entries;
  - `request-status-summary.integration.test.ts` checks every value as a whole number.
  - The first file is in Task 3's file list, but the change belongs to Task 2.
- **Fix:**
  - Both now expect `byHolder`, through `$ref: MyRequestHolderCounts`, whose closed shape the catalogue test also pins.
  - The updates were part of Task 2's RED commit, so they failed first.
  - No assertion's intent changed.
- **Committed in:** `86e5746`

**2. [Rule 2: correctness] The matrix's owner-total check read only a summary's `data.total`**
- **Found during:** Task 3
- **Issue:**
  - The plan asks the new row to mirror the summary's row, including `ownedRecordTotal: ownedByRequestorsOnly`.
  - For a list, `data` is an array, so the check in `authorization-matrix.integration.test.ts`, which is outside the plan's list, would read `undefined` and fail for every actor.
- **Fix:**
  - The check now reads `meta.pagination.total` when `data` is an array, and the `ownedRecordTotal` doc comment says so.
  - The row also carries `mustNotDisclose` with every other actor's request ids and titles, as the plan asked.
  - Together these assert that the analyst and the service agent list 0 requests and both Requestors list some.
- **Committed in:** `6fd6eb6`

**3. [Reuse over copy] Three small exports beyond the plan's three facts**
- `literalContains` (review-queue-repository.ts) and `daysSinceSubmission` (collection-scope.ts, which is outside the plan's list) are exported so the q match and the item's age are the queue's own definitions, not copies.
- `ownRequestorId` moved from the status summary controller into `services/my-requests.ts` and is shared by both controllers.
- **Committed in:** `4c7da53`, `b7c5c82`

**4. [Signature] `listMyRequests(strapi, { requestorId, query, today })` takes no `state`**
- The plan's artifact lists `state` as an input. The service projects every item through its fixed Requestor view, so a `state` input would go unused, and I did not add it.
- **Committed in:** `4c7da53`

**5. [Spec detail] `MyRequestItem.updatedAt` is nullable**
- `updatedAt` is `["string", "null"]`, so that an unreadable timestamp serves `null` rather than a malformed string. The web parser mirrors it.
- **Committed in:** `4c7da53`

---

**Total deviations:**
- One blocking test update
- One matrix check widened
- Three reuse, signature or spec notes

**Impact on plan:** No added scope.
- No grant, Function, FunctionApi, role, content type or dependency changed (D-01, D-03, T-11-SC).
- Between `4c7da53` and `6fd6eb6`, the served-operations drift check and the matrix's served-row coverage were knowingly out of date. The plan puts the inventory in Task 3 by design. Both pass from `6fd6eb6` on, in the full suite.

## Issues Encountered

- **A heredoc append failed in Git Bash** with "unexpected EOF". Nothing was written, which I checked with `wc -l`. I made the same change with the Edit tool.
- **Line endings.** The new files are LF in the working copy, and Git normalises them on commit with its usual LF-to-CRLF warnings. Edited CRLF files kept CRLF.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.
- **One scratch file outside the scratchpad.** One verify log was written to `/tmp/v1.txt` instead of the session scratchpad. It is outside the repository and holds test output only.

## Known Stubs

None. Every field is served from stored facts.

## Threat Flags

None beyond the plan's threat model:
- The new endpoint is T-11-05 and is mitigated by the policy's owner scope, the bound owner join, the closed query, the per-actor tests and the matrix row.
- The item's disclosure surface is T-11-53: there is no assessment field, the questionnaire appears only once released, and the test asserts no assessment number, id, Risk fact or `/app/assessments/` href.
- Query tampering is T-11-26: closed maps, bound `LIKE … ESCAPE '!'`, a 200-character limit and page sizes 10, 20 and 50.
- The analyst's own list is T-11-27: a fixed Requestor view, and the test asserts Requestor hrefs and no `/app/review/`.

## User Setup Required

None.

## Next Phase Readiness

- **11-11:** My requests can switch from `listRequests` to `listMyRequests(query)`, add `holder` to the URL keys, and render `MyRequestItem` rows with `nextActionPresentation`-style link rules. The item's `nextAction` carries an `href` only when the Requestor holds the step.
- **11-12 and 11-13:** `byHolder` is served and parsed. Widen `getMyRequestStatusSummary`'s return value to expose it, as Decisions Made describes.
- **11-19:** quick find can call `listMyRequests({ q, …, pageSize: 10 })`.

## Self-Check: PASSED

- The created files exist: `routes/my-requests.ts`, `controllers/my-requests.ts`, `services/my-requests.ts` and `tests/my-requests.integration.test.ts`.
- Commits `00b6fdd`, `4c7da53`, `86e5746`, `b7c5c82` and `6fd6eb6` exist on `post-demo`, and each carries the trailer.
- Task 1's acceptance criteria re-ran PASS:
  - the route contains `path: "/v1/my_requests"` and `requireRequestCollectionScope: true`;
  - the three facts are exported and imported by `services/my-requests.ts`;
  - the spec has the operationId, and `MyRequestItem` is closed;
  - `listMyRequests` is exported;
  - the verify exited 0.
- Task 2's acceptance criteria re-ran PASS:
  - `countOwnedRequestsByHolder` is built on `applyRequestHolder`;
  - `byHolder` is in `MyRequestStatusSummary.required`;
  - the verify exited 0.
- Task 3's acceptance criteria re-ran PASS:
  - both copies contain the note, and `cmp` is silent;
  - `served-operations.json` lists the operation under `served` with its web caller and not under `unserved`;
  - the matrix row uses `everyIdentity(200)`;
  - the full Strapi suite passed at 689/689.
- The plan's verification passed:
  - `api:check` is clean;
  - the parity and chain guards pass;
  - the catalogue copies are identical;
  - the full Strapi suite passes, including the matrix, served-operations and contract-catalogue files.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

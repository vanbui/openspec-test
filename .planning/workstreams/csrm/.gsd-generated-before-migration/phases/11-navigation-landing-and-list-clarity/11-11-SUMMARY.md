---
phase: 11-navigation-landing-and-list-clarity
plan: 11
subsystem: ui
tags: [next-app-router, react, data-table, my-requests, holder, local-time, zod, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-10: GET /v1/my_requests, listMyRequests, MyRequestItem, MyRequestListQuery and the closed parser; 11-08/11-09: nextActionPresentation (link only for the viewer's own step); 11-06: createSubmittedRequest and review-lists.spec.ts; 11-04: the My requests heading and description; 11-01: the Released label"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: LocalInstant and TimeZoneProvider; the DataTable long-text column (wrap)"
provides:
  - "/app/requests reads listMyRequests (GET /v1/my_requests) with the parsed query, holder included; listRequests and its summary-list parser are retired"
  - "request-domain.ts: requestHolderPresentation (Needs your action, With the Security Analyst, No action needed), myRequestNextStep (the served sentence through nextActionPresentation from the Requestor's side) and shownInstant"
  - "request-schema.ts: parseRequestListQuery reads holder (closed, unknown dropped) and returns MyRequestListQuery"
  - "request-table.tsx: the long-text Next step column (holder line above the sentence), the Show select and Show: chip, Updated through LocalInstant, and the holder-aware phone card"
  - "E2E UX09_MY_REQUESTS_NEXT_STEP (desktop) and UX09_MY_REQUESTS_HOLDER_FILTER (@journey, both projects)"
affects: [11-12, 11-13, 11-14, 11-19]

actuals:
  tokens: 14300
  tasks: 2
  commits: 6
plan_head_before: b1b8bcf4c9ead9f79d37df6174640e5634ecb008
plan_head_after: bc18ce7f9eae22f3c4bae266301124ba2b3977b5

tech-stack:
  added: []
  patterns:
    - "A Requestor-side list item's next step goes through the shared nextActionPresentation with actor 'requestor' and the served holder, so the list links exactly where the request hub would"
    - "A list's URL holder filter is one more closed key in the shared query parser, a chip through the DataTable's label: value format, and part of 'filtered' for the empty state"

key-files:
  created: []
  modified:
    - apps/csrm/app/(app)/app/requests/page.tsx
    - apps/csrm/app/(app)/app/requests/loading.tsx
    - apps/csrm/src/features/requests/request-table.tsx
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/requests/request-table.test.tsx
    - apps/csrm/src/features/requests/request-routes.test.tsx
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/e2e/review-lists.spec.ts
    - apps/csrm/e2e/helpers/requests.ts
    - apps/csrm/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "11-11: parseRequestListQuery returns the MyRequestListQuery 11-10 introduced (holder: RequestHolder | undefined) instead of adding holder to RequestListQuery, which stays the dashboard read's query until plan 11-12 retires it"
  - "11-11: the request.listRequests parity entry is relabelled request.listDashboardRequests rather than deleted: listDashboardRequests still parses GET /csrm-assessment-requests through the same requestListPayloadSchema, so deleting it would have unregistered a live parse. The grandfather backlog stays at 42; plan 11-12 retires the entry with its caller"
  - "11-11: formatRequestDate and updatedDateLabel stay (assessment lists, request hub, context details, Requestor Home and toRequest still read them); parseRequestSummaryListPayload, whose only caller was listRequests, is deleted"
  - "11-11: the Next step sentence clamps to two lines in the table and three on the phone card (UI Considerations, long-text); the holder line is .micro-label text-foreground-secondary"
  - "11-11: UX09_MY_REQUESTS_NEXT_STEP proves a table column, so it runs at 1440 outside the @journey describe; UX09_MY_REQUESTS_HOLDER_FILTER is @journey and proves the 375 card"
  - "11-11: My requests may now overflow at 1440 (UI-SPEC section 7 permits it); the Risk Register journey's 'a table that fits' proof moved to My released risk assessments"

patterns-established:
  - "myRequestNextStep(item): the one place a my requests item's next step is decided; Home (11-12) and quick find (11-19) can read it"

requirements-completed: [UX-09, UX-08]

coverage:
  - id: D1
    description: "My requests reads GET /v1/my_requests with the parsed query (search, status, holder, sort, page, page size) and keeps its fixture ladder and permission state; listRequests is gone"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-routes.test.tsx#reads GET /v1/my_requests with the parsed query and shows whose turn each request is (D-34)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-routes.test.tsx#shows the permission state when the read is refused, and no record"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-service.test.ts#maps bounded request queries and normalizes hydrated payloads (listRequests undefined)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each row shows a Next step column: the holder line (Needs your action, With the Security Analyst, No action needed) above the server's sentence, linked only when the Requestor holds the step and the server sent an href; a closed request shows its holder alone; the column wraps within the X-3 bounds"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#shows whose turn each request is above the server’s next step, linking only the viewer’s own step (D-34, UI-D25)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#links a next step only when the viewer holds it and the server supplies an href, and shows a closed request’s holder alone"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_MY_REQUESTS_NEXT_STEP ([desktop])"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Show select filters by holder through the URL (page reset), the chip reads Show: {label}, Clear filters and the chip's remove clear it, a holder alone counts as a filter; /app/requests?holder=analyst lists a submitted request and ?holder=requestor does not"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#filters by who holds the request through the URL, with a Show chip that Clear filters clears (D-34, D-35)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#reads the holder from the URL and drops a value it does not know (D-34, T-11-28)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-routes.test.tsx#passes the Show filter’s holder to the read and drops one it does not know (D-35)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_MY_REQUESTS_HOLDER_FILTER ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D4
    description: "Updated reads Updated {date} in the viewer's time zone through LocalInstant, or No update date; Status reads Released for approved"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#reads Updated in the viewer’s time zone, or No update date (D-55)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phone card shows the number and title with the status badge, then the holder line and the sentence, then Due {date} · Updated {date}"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#shows the holder line and the sentence on the phone card, then the due and update dates (UI-SPEC §7.3)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/review-lists.spec.ts#UX09_MY_REQUESTS_HOLDER_FILTER ([mobile], 375)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fit of the six-column table at 1440: with long seeded identifiers and titles it overflows into its labelled scroll region (UI-SPEC section 7 permits this); whether Title should also become a long-text column is a design call"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC says Title is unchanged and permits overflow at 1440; whether the overflow is acceptable on the primary desktop width is a visual judgement for the pilot"

duration: 53min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 11: My requests says whose turn it is Summary

**My requests now reads `GET /v1/my_requests`. Each row has a long-text `Next step` column: a holder line (`Needs your action`, `With the Security Analyst` or `No action needed`) above the server's sentence, which links only when the Requestor holds the step. A `Show` select filters by holder through the URL with a `Show: {label}` chip that `Clear filters` clears, `Updated` reads the local date through `LocalInstant`, and the phone card carries the holder line, the sentence and `Due {date} · Updated {date}`. `listRequests` and its summary-list parser are retired.**

## Performance

- **Duration:** 53 min. The wall clock includes two full Playwright runs (15.6 and 16.0 min) and five spec runs.
- **Started:** 2026-10-03T10:16:01Z
- **Completed:** 2026-10-03T11:08:25Z
- **Tasks:** 2 of 2
- **Files changed:** 13, all modified, none created or deleted.

## Accomplishments

- **The read (D-34).** The page calls `listMyRequests(query)`. The query is the closed `parseRequestListQuery`, which now reads `holder` and drops a value it does not know (T-11-28). The fixture ladder and the 403 permission state are unchanged. The owner scope comes from Strapi's policy, never the URL.
- **The Next step column (UI-SPEC §7.3, UI-D25).**
  - `requestHolderPresentation` in the zod-free `request-domain.ts` holds the three labels.
  - `myRequestNextStep(item)` passes the served sentence through the shared `nextActionPresentation` with `actor: 'requestor'` and the served holder. An href the server sent for a step the Requestor does not hold is never a link (T-11-29).
  - The holder line is `.micro-label text-foreground-secondary`. The sentence clamps to two lines (three on a card) and keeps its full text in the DOM. The column uses the DataTable `wrap` bounds.
- **The Show filter (D-34, D-35).** Choosing `All requests`, `Needs your action`, `With the Security Analyst` or `No action needed` writes `holder` (requestor, analyst or none) to the URL and returns to page 1. The chip reads `Show: Needs your action`. `Clear filters` and the chip's remove both clear it. A holder alone counts as a filter, so an empty Show view gets the filtered-empty state with `Clear filters`. `/app/requests?holder=requestor` and `?holder=analyst` are the lists plan 11-12's Home figures will open.
- **Dates (D-55).** `Updated {date}` renders through `LocalInstant` in the viewer's zone, or `No update date`. `Due {date}` stays a zone-free calendar date (`formatRequestDate`), or `No due date`.
- **The phone card.** Number and title with the status badge (unchanged), then the holder line and the sentence, then `Due {date} · Updated {date}`.
- **Retired.**
  - `listRequests` (its only caller was this page).
  - `parseRequestSummaryListPayload` (its only caller was `listRequests`).
  - `formatRequestDate` and `updatedDateLabel` stay: the assessment lists, request hub, context details, Requestor Home and `toRequest` still read them.
  - `served-operations.json` is unchanged: `listDashboardRequests` still calls `GET /csrm-assessment-requests`.

## Task Commits

1. **Task 1: My requests shows whose turn each request is (tracer, TDD)**
   - `8021bbe`: test(11-11), RED
   - `f040c8a`: test(11-11), the pre-existing helper fix (deviation 1)
   - `4be3d59`: feat(11-11), GREEN
2. **Task 2: Filter by holder, local update dates and the phone card (TDD)**
   - `37b0339`: test(11-11), RED
   - `ad6f770`: feat(11-11), GREEN
   - `bc18ce7`: test(11-11), the Risk Register fit proof (deviation 2)

The ledger count is `git rev-list --count b1b8bcf..bc18ce7` = 6. Every commit carries the `Co-Authored-By: Claude Opus 5.5` trailer (checked per commit).

## TDD Gate Compliance

- **Task 1.** RED `8021bbe` comes before GREEN `4be3d59`. The RED run failed 9 of 242 tests (4 of 12 files), each on the planned behaviour:
  - the column headers lacked `Next step`;
  - no next-step sentence or link was rendered;
  - `Due 12 Sept 2026` was not found (the rows became served my requests items);
  - the page source lacked `listMyRequests`;
  - the route test hit `No "listRequests" export is defined on the mock`;
  - `service.listRequests` was still defined;
  - the parity guard reported `STALE_GRANDFATHER request.listDashboardRequests` and the unregistered `request.listRequests` boundary.
- **Task 1 tracer gate.** The run was interactive, in end-of-phase mode, with an automated-only verify. The unit run and the typecheck were re-run on the committed tree: 242/242 and clean. The Playwright half had passed 7/7 on content identical to the commit. Task 2 started only after that.
- **Task 2.** RED `37b0339` comes before GREEN `ad6f770`. The RED run failed 8 of 93 tests (2 of 10 files):
  - the parser dropped `holder`;
  - there was no `Show` combobox (in two tests);
  - no filtered-empty state for a holder alone;
  - `Updated` read UTC `27 Sept`, not `28 Sept 2026`;
  - the card lacked the holder line and the combined date line;
  - the single due-date label count was 2, not 1;
  - the route did not pass `holder`.
- The plan is `type: execute`, so no plan-level `tdd-red-evidence` record was produced. The failures above come from the RED runs' own output. No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/features/requests`, parity, chain guard) | 9 failed, 233 passed (242); 4 of 12 files failed |
| Task 1 GREEN and tracer re-run (same paths) | 12 files, 242/242; typecheck clean |
| Task 1 Playwright `review-lists.spec.ts`, runs 1 and 2 | 6 passed, 1 failed each (desktop `UX09_QUEUE_TRIAGE_COLUMNS`, pre-existing helper strict-mode failure, deviation 1); 1.1 min each |
| Task 1 Playwright `review-lists.spec.ts`, after the helper fix | **7 passed: desktop 4, mobile 3; 0 failed, 0 flaky, 0 skipped; 1.1 min**. The tree held only my uncommitted edits |
| Task 2 RED (`src/features/requests`) | 8 failed, 85 passed (93); 2 of 10 files failed |
| Task 2 GREEN (`src/features/requests`, copy guard, parity, chain guard, `src/test`) | 15 files, 320/320; typecheck clean after the loading boundary's query gained `holder` |
| Task 2 Playwright `review-lists.spec.ts` and `requestor-request-workflow.spec.ts` | **11 passed: desktop 6, mobile 5; 0 failed, 0 flaky, 0 skipped; 2.2 min**. `git status --short` was identical before and after |
| **Full web suite** (`pnpm --dir apps/csrm test`) | **139 files, 3,014/3,014** (34.2 s) |
| `typecheck` / `lint` / `api:check` (final, committed tree) | clean / clean / exit 0. `schema.d.ts` was refreshed with `git update-index --refresh` and not staged |
| Full Playwright, first run | 114 passed (desktop 99, mobile 15), 2 failed (the Risk Register journey in both projects, deviation 2), 1 did not run (`UX09_PICKER_FINDS_BY_REQUEST_TITLE`, serial after the failure); 15.6 min (10:31:12Z to 10:46:49Z). The tree was unchanged afterwards |
| Temporary measuring spec (not committed, file removed) | 1 passed (desktop); measured the column widths in deviation 2 |
| `risk-register-workflow.spec.ts` after the fix | **3 passed: desktop 2, mobile 1; 0 failed; 2.3 min**. The tree was unchanged afterwards |
| **Full Playwright, final run** (`pnpm --dir apps/csrm test:e2e`, production build) | **117 passed: desktop 101, mobile 16; 0 failed, 0 flaky, 0 skipped; 16.0 min** (10:52:14Z to 11:08:14Z). `git status --short` was identical before and after the run |
| Strapi | Not run: the plan is web only (no Strapi or specification change) |

- Before every Playwright run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.
- The final full run logged Next's known benign `The destination stream closed early` 164 times and one `failed-to-find-server-action`. 11-08 logged 126 and 1. No assertion reads them.
- After every commit, `git status --short` showed only the three operator items.

## Files Created/Modified

- `apps/csrm/app/(app)/app/requests/page.tsx`: reads `listMyRequests(query)` and passes `items`.
- `apps/csrm/app/(app)/app/requests/loading.tsx`: the skeleton's query carries `holder: undefined`.
- `apps/csrm/src/features/requests/request-table.tsx`: the Next step and Updated columns, the Show select and chip, and the phone card.
- `apps/csrm/src/features/requests/request-domain.ts`: `requestHolderPresentation`, `myRequestNextStep` and `shownInstant`.
- `apps/csrm/src/features/requests/request-schema.ts`: `holder` in the closed URL query; `parseRequestSummaryListPayload` removed.
- `apps/csrm/src/features/requests/request-service.ts`: `listRequests` removed; the parity entry relabelled `request.listDashboardRequests`.
- Tests:
  - `request-table.test.tsx`, `request-routes.test.tsx` and `request-service.test.ts`;
  - `contract-response-parity.test.ts`;
  - `e2e/review-lists.spec.ts`, `e2e/helpers/requests.ts` and `e2e/risk-register-workflow.spec.ts`.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- the parser returns `MyRequestListQuery`;
- the parity entry moves to the dashboard read instead of disappearing;
- the date helpers stay because other surfaces read them;
- the sentence clamps to 2 lines in the table and 3 on the card;
- the desktop-only E2E proof sits outside `@journey`;
- the Risk Register journey's "table that fits" proof moves to a four-column list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, pre-existing harness defect] `createSubmittedRequest` filled the due date with a label query that also matched a hidden duplicate**
- **Found during:** Task 1, the first `review-lists.spec.ts` run (it failed 2 of 2 times on desktop `UX09_QUEUE_TRIAGE_COLUMNS`, before any My requests code ran).
- **Issue:** On a cold first load, React client-rendered the new request form before the streamed one arrived. The trace's DOM snapshot shows the late segment left in the page as `<div hidden id="S:2">` with a second `dueDate` input (server id `_R_3tinpfiv5ukqbrb_`, beside the live client id `_r_d_`). `getByLabel('Due date', { exact: true })` matches hidden elements and failed strict mode. Every other field in the helper is filled by role, which skips hidden elements.
- **Fix:** Fill the due date by role (`getByRole('textbox', { name: 'Due date', exact: true })`), with a comment saying why.
- **Files modified:** `apps/csrm/e2e/helpers/requests.ts`
- **Verification:** `review-lists.spec.ts` passed 7/7, then 11/11 with the workflow spec, then in both full runs.
- **Committed in:** `f040c8a` (its own commit)

**2. [Rule 1 - Bug caused by this plan] The Risk Register journey proved "a table that fits" on My requests at 1440**
- **Found during:** the first full Playwright run. `risk-register-workflow.spec.ts:689` `the analyst's own request list fits at 1440px` failed in both projects.
- **Issue:** The Next step column widens the table. A temporary measuring spec found, for the analyst's seeded requests at 1440, a scroller of 1186 px of content in 1102 px. The column widths were Request ID 188, Title 348, Status 141, Next step 224 (its `min-w-56` floor), Due date 125 and Updated 159. Phase 11 UI-SPEC §7 allows this ("a table wider than its container scrolls only inside its labelled region, its identifier column sticky"), and §7.3 keeps Title "unchanged".
- **Fix:** My requests at 1440 still proves its scroller follows its measured width. The `toBe(false)` fitting proof moved to the four-column My released risk assessments, whose request title wraps (1102 px in 1102 px).
- **Files modified:** `apps/csrm/e2e/risk-register-workflow.spec.ts`
- **Verification:** the spec passed 3/3 (desktop 2, mobile 1); the final full run passed 117/117.
- **Committed in:** `bc18ce7` (its own commit)

**3. [Plan adjustment] The parity entry was relabelled, not deleted**
- The plan said to delete `listRequests` "and its parity registration". The same `requestListPayloadSchema` on `GET /csrm-assessment-requests` still parses `listDashboardRequests`' payload, so the entry and its grandfather reason now carry the label `request.listDashboardRequests`. The backlog count stays 42. Deleting it would have left a live parse unregistered. Plan 11-12 retires the entry with its caller.

**4. [Plan adjustment] `holder` went on `MyRequestListQuery`, not `RequestListQuery`**
- The plan ("written ahead") said `RequestListQuery` gains `holder`. Plan 11-10 had already introduced `MyRequestListQuery extends RequestListQuery { holder }` for `listMyRequests`. `parseRequestListQuery` now returns that type. `RequestListQuery` stays as the dashboard read's query, so the Requestor Home's call site needed no change.

**5. [Plan adjustment] Files outside the task lists**
- `app/(app)/app/requests/loading.tsx`: its literal query needed `holder` (typecheck).
- `e2e/helpers/requests.ts` and `e2e/risk-register-workflow.spec.ts`: deviations 1 and 2.
- `requestor-request-workflow.spec.ts` needed no change. Its My requests assertions read the title link, the status badge and the controls, none of which the new column or card changes. It passed in both projects.

**6. [Acceptance grep vs. the shared chip format] `request-table.tsx` does not contain the literal `Show:`**
- The chip text comes from the DataTable's `{filter.label}: {filter.value}` with `label: 'Show'`, the same way the Status chip reads `Status: Released`. The rendered `Show: Needs your action` and `Show: No action needed` are asserted in `request-table.test.tsx`, and `Show: With the Security Analyst` in `UX09_MY_REQUESTS_HOLDER_FILTER`. The behaviour, not the grep, was kept. The other Task 2 greps pass: `All requests` and `LocalInstant` are present, `parseRequestListQuery` reads `holder`, and `UX09_MY_REQUESTS_HOLDER_FILTER` is in the spec.

**7. [TDD sequencing] Task 1's interim page call**
- Between the two GREEN commits the page passed `{ ...query, holder: undefined }`, so the holder parser stayed Task 2's RED. Task 1's `Updated` cell kept today's UTC label until Task 2 moved it to `LocalInstant`. Both were replaced in `ad6f770`.

---

**Total deviations:** 2 auto-fixed (Rule 1: one pre-existing harness defect, one caused by this plan) plus 5 recorded plan adjustments.
**Impact on plan:** Every must-have holds. No scope was added beyond the two test fixes. There was no Strapi, specification, content-type, grant or dependency change.

## Issues Encountered

- **My requests at 1440.** With long identifiers and titles (seeded `RAR-RELEASED-33SAEN` and a 48-character title), the six-column table is about 84 px wider than the content area. It scrolls inside its labelled region, as UI-SPEC §7 allows. For ordinary `RAR-2026-XXXXXX` numbers it is narrower. If the pilot wants it to fit at 1440, making Title a long-text column too (it is "unchanged" in §7.3) would do it: the measured Title of 348 px would drop to its 224 px wrap floor. This is recorded as coverage D6 for human judgement.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 11-12 can link the Homes' holder figures to `/app/requests?holder=requestor` and `?holder=analyst`. It retires `listDashboardRequests`, the last caller of `GET /csrm-assessment-requests`, and with it the `request.listDashboardRequests` parity entry (grandfather count 42 → 41) and `served-operations.json`'s `webCallers`.
- `myRequestNextStep` and `requestHolderPresentation` are ready for Home (11-12) and quick find (11-19).
- `requirements.ready-ids` reports 0/2 ready for UX-09 and UX-08: later Phase 11 plans declare them too, so REQUIREMENTS.md is unchanged.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*

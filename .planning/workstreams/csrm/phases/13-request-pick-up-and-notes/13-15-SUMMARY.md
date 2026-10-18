---
phase: 13-request-pick-up-and-notes
plan: 15
subsystem: requestor-surfaces
tags: [my-requests, requestor-home, holder-sentences, assignee, unread-notes, x-17, x-10, status-summary, contract, playwright, axe, route-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the assignment relation and the people projection (13-03, 13-04); the notes, read states and unread rule (13-05, 13-06); the queue's unread body and countUnreadNotesByRequest (13-12); the request read's Security Analyst row (13-07 to 13-10)
  - phase: 11-navigation-landing-and-list-clarity
    provides: holderFor and the §6.1 sentences (11-08); GET /v1/my_requests and the status summary's byHolder (11-10); the My requests table (11-11); the Requestor Home (11-12)
provides:
  - projectRequestLifecycle(document, state, { assigneeName }) with the 13-UI-SPEC §12.1 Requestor sentences
  - MyRequestItem.assignee (MyRequestAssignee, { displayName } only) and .unreadNotes; GET /v1/my_requests?notes=unread
  - MyRequestStatusSummary.withUnreadNotes, in the summary's one-statement UNION ALL
  - hasUnreadNotes(viewer), exported from review-queue-repository.ts and shared by the queue, My requests and the summary
  - My requests' Security Analyst column, X-17 unread line, Notes filter and chip, and card lines
  - The Requestor Home's new-notes row and its items' ` · Assigned to {name}` and X-17 markers
  - REQ08_REQUESTOR_SEES_ASSIGNEE, COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR and COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG @journey at 1440 and 375
affects: [13-16, 13-19]
actuals:
  tokens: 42000
  tasks: 3
  commits: 6
plan_head_before: b1d5b176fd8743185b4a58d6985b605b9913621f
plan_head_after: ab9868f7c803d2dbe90d4a91f050db93a557d3fa
tech-stack:
  added: []
  patterns:
    - "A Requestor-facing sentence that names a person takes the display name as an option of the projection; the caller reads it with PERSON_FIELDS, so the lifecycle module never reads a person"
    - "One EXISTS body (hasUnreadNotes) serves a list's filter, its per-row counts and the summary figure that opens it"
    - "A value export in a module every route's client chunk carries ships even when unused (Turbopack keeps the module's export table); closed value lists the server parser alone needs live in the schema module, the domain module exports the type"
key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts
    - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
    - apps/backend/tests/request-lifecycle.unit.test.ts
    - apps/backend/tests/my-requests.integration.test.ts
    - apps/backend/tests/request-status-summary.integration.test.ts
    - apps/backend/tests/request-status-summary.unit.test.ts
    - apps/backend/tests/request-workflow.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/features/requests/request-table.tsx
    - apps/csrm/src/features/requests/request-table.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/app/(app)/app/requests/loading.tsx
    - apps/csrm/src/features/quick-find/quick-find-actions.ts
    - apps/csrm/src/features/home/requestor-home.tsx
    - apps/csrm/src/features/home/requestor-home-presentation.ts
    - apps/csrm/src/features/home/requestor-home-service.ts
    - apps/csrm/src/features/home/requestor-home.test.tsx
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/csrm/e2e/review-lists.spec.ts
    - apps/csrm/e2e/request-relationship-states.spec.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/request-notes.spec.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
key-decisions:
  - "My requests' notes filter is the flat query parameter `notes=unread`, not the plan's `filters[notes]`: GET /v1/my_requests publishes flat parameters (q, status, holder, sort, page, pageSize), the Home row's link is /app/requests?notes=unread, and the review queue's filters[...] shape is a 400 here (mounted)."
  - "The owner reads My requests and the summary as the Requestor: the unread viewer is { id: the policy's own requestor id, humanAnalyst: false }, so a Security Analyst's own request counts the analysts' notes as new to them, exactly as the request read does."
  - "withUnreadNotes is one more UNION ALL branch of the summary's single statement (the unit test still proves one statement), so the summary's counts share one snapshot."
  - "A blank or whitespace assignee name reads as unassigned; a name is trimmed. The analysts' sentences, the holder and every href are unchanged by the assignee."
  - "The status summary is the Home's fifth parallel read, caught on its own (`.catch(() => null)`); a failure, refusal or rejection gives withUnreadNotes 0, so the Home renders byte-for-byte as at zero (unit-proved) and never turns into the error or permission state."
  - "The new-notes row is a card that is one link (X-10 block link): `--radius-lg` hairline card, MessageSquareDot 16px, the label at 500, a muted ChevronRight; hover darkens the hairline and lifts only with motion allowed (KpiTile's treatment). It is a sibling above the grid, so DOM order equals visual order at both widths."
  - "The analyst's Your own requests panel is a count panel (byHolder rows) with no items, so it gains no marker; the analyst reaches their own requests' new notes through My requests, which is the same surface (13-UI-SPEC §12.4)."
  - "COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR proves the figure equals the list it opens rather than pinning `1`: Jane is the shared seeded Requestor, so another journey's unread note would make a hard-coded 1 flaky; it asserts `New notes on 1 request` whenever the figure is 1, which it was in both projects."
  - "The tracer gate re-ran Task 1's verify without the Strapi suite after the GREEN commit (exit 0); the full Strapi suite ran twice: after GREEN (907/909, the two contract-catalogue guards, fixed) and as the plan's final verify at HEAD (909/909)."
  - "REQ-08 and COLLAB-01 stay Pending until the phase gate, as in 13-03 to 13-14."
patterns-established:
  - "projectRequestLifecycle(document, state, { assigneeName }) is how a caller names the assignee to the Requestor"
  - "hasUnreadNotes({ id, humanAnalyst }) composes the unread EXISTS on any query over the request row `r`"
requirements-completed: []
coverage:
  - id: D1
    description: "The Requestor's holder sentences name the assigned analyst at every analyst-held step and say plainly when nobody has picked the request up; analyst sentences and holder unchanged"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/backend/tests/request-lifecycle.unit.test.ts#the Requestor's sentences name the assigned Security Analyst, or say nobody has picked the request up (D-17)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#a submitted request names the Security Analyst as the holder of its next step for both readers, and the Requestor reads who picked it up (D-27, D-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "My requests items carry the assignee's display name only and the unread count; notes=unread lists exactly the owner's requests with new notes, its total equal to the summary's withUnreadNotes; another Requestor sees none of it"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/my-requests.integration.test.ts#my requests name the assigned Security Analyst and count the Requestor's new notes, equal to the summary (D-17, D-24, D-23)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-status-summary.integration.test.ts#mounted request status summary counts the caller's own requests by holder, equal to the my requests holder totals"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/request-status-summary.unit.test.ts#the owner summary reads status and holder counts in one statement snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "My requests shows the Security Analyst column, the X-17 unread line, the Notes filter with its chip, and the card lines; the Requestor Home shows the new-notes row only above zero and the items' assignee and unread markers"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/home/requestor-home.test.tsx#Requestor Home: new notes and the assigned Security Analyst (D-17, D-24; 13-UI-SPEC §12.3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "In the browser at 1440 and 375: Jane reads Bob on her request page, My requests and Home; Bob's reply flags her Home and My requests and opens the thread; the Secondary Requestor sees nothing; axe clean, no horizontal overflow"
    requirement: "REQ-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_REQUESTOR_SEES_ASSIGNEE @journey"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR @journey"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG @journey"
        status: pass
    human_judgment: true
    rationale: "The new-notes row's look beside the Home grid at 1440 and 375, and the seven-column My requests table at 1440, are the orchestrator's walk (13-19)."
duration: 100min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 15: The Requestor Sees Who Holds Each Request and Which Have New Notes Summary

**Jane now reads which Security Analyst holds each request: on the request page, on My requests and on Home. When nobody has picked a request up, the next step says it is waiting for one. My requests and Home flag the requests with notes new to her, and each figure opens a list of the same size. Another Requestor sees none of it.**

## Performance

- **Duration:** about 100 minutes (2026-10-09T01:29Z to 03:10Z). This includes two full Strapi suites (17 and 16 minutes), three Playwright runs and six performance runs.
- **Tasks:** 3. Task 1 was the tracer; Tasks 1 and 2 ran RED then GREEN. One route-budget fix followed.
- **Files changed:** 32 (none created).

## Accomplishments

- **Holder sentences (D-17; 13-UI-SPEC §12.1).**
  - `projectRequestLifecycle(document, state, { assigneeName })` gives the Requestor `{name} is reviewing your request and will send you a questionnaire to answer.` and the four later named sentences.
  - When nobody holds the request, the Requestor reads `Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.`, or the `A Security Analyst …` sentence at the later steps.
  - The request read passes the assignee it already reads with `PERSON_FIELDS`. My requests populates `assignedAnalyst` with `PERSON_FIELDS` only.
- **My requests (D-17, D-24, D-23).**
  - Each item carries `assignee` (`{ displayName }` or null) and `unreadNotes`, from one grouped read per page (`countUnreadNotesByRequest`).
  - The closed query accepts `notes=unread`, an EXISTS over `hasUnreadNotes`. That body is now exported from the queue repository and shared with the queue.
  - The owner is the viewer, read from the Requestor's side.
- **Status summary.** `withUnreadNotes` is one more `UNION ALL` branch of the same single statement, equal to the `notes=unread` total.
- **Contract.**
  - New schema `MyRequestAssignee` (closed, `displayName` only).
  - `MyRequestItem.assignee` and `.unreadNotes` are required.
  - New `notes` parameter, enum `unread`.
  - `MyRequestStatusSummary.withUnreadNotes` is required.
  - `schema.d.ts` was regenerated, and the contract-catalogue guard pins every new shape.
- **My requests UI (13-UI-SPEC §12.4).**
  - A `Security Analyst` column after `Status`: the name, or `Not picked up yet` in the secondary text colour.
  - The X-17 unread line under the title (`{n} new {note|notes}`, named `… on {RAR}`, linking to `#notes`).
  - A `Notes` select (`All requests`, `With new notes`) with the chip `Notes: New notes`, cleared by `Clear filters`.
  - The card adds `Security Analyst: {name}` or `Not picked up yet`, then the unread line.
- **Requestor Home (13-UI-SPEC §12.3).**
  - The status summary is a fifth parallel read, caught on its own.
  - `New notes on {n} {request|requests}` is an X-10 block link to `/app/requests?notes=unread`, directly under the header and above the grid. It is absent at zero or when the read fails.
  - Items in both request sections gain ` · Assigned to {name}` on line 2, and the X-17 marker as their last line.

## Test Counts

- **Task 1.**
  - RED (`a9b3e47`): Strapi `# pass 15 / # fail 16` over the five focused files (compiled with `--noEmitOnError false`). Web: `Tests 15 failed | 265 passed`.
  - GREEN (`a1c00ff`): Strapi focused (lifecycle, summary unit, review-queue unit, my-requests, summary and request-workflow integration) `# pass 44 / # fail 0`. Contract-catalogue `# pass 23 / # fail 0`. Web `Tests 280 passed` (12 files). `api:check`, typecheck and lint clean.
  - First full Strapi suite: `# pass 907 / # fail 2`. Both failures were the contract-catalogue guards pinning the old shapes; they were fixed in the GREEN commit.
- **Task 2.**
  - RED (`25b9e94`): web `Tests 6 failed | 69 passed` (4 files).
  - GREEN (`f2f1c43`): `Tests 75 passed`, plus typecheck and lint.
- **Task 3 (`fd1cfec`).** Playwright, six specs:
  - First run: 82 passed, 4 failed (my two notes journeys in both projects, on a strict-mode `Search` button match).
  - After the fix, `request-notes.spec.ts` alone: 18 passed.
  - The plan's verify command after the commit: **86 passed (desktop 52, mobile 34)**, exit 0.
  - The tree was clean after every run.
- **Full web unit suite:** `Test Files 188 passed`, `Tests 4148 passed`.
- **Full Strapi suite (the plan's final Task 1 verify at HEAD `ab9868f`):** **`# tests 909 / # pass 909 / # fail 0`** (968 s). It ran inside the whole verify command (api:check, the requests vitest, typecheck, lint, Strapi), exit 0, with nothing listening on 1337 or 3000.

## Performance Budget (delivered JavaScript, desktop medians)

| Route | Before | After this plan |
| --- | --- | --- |
| `/app` (Requestor) | 235,964 | 235,962 |
| `/app/requests` | — | 257,760 |
| `/app/requests/{documentId}` | 279,873 (13-12) | 280,522 |
| `/app/risks/{documentId}` | 299,884 (13-14) | **299,882** |

- `/app` and `/app/risks/{documentId}` are the 13-14 figures; `/app/requests/{documentId}` is the 13-12 figure.
- 11/11 performance tests passed. `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.
- The first measurements after Task 3 read `/app/risks/{documentId}` at 299,885 three times.
  - A bisect with the pre-plan web code restored in the working tree read 299,883 and 299,886. That build-to-build spread is ±3 bytes, because server action ids differ in every build.
  - The cause was real all the same: `request-domain.ts` sits whole in a shared client chunk, and the new `myRequestNotesFilters` export added 37 decoded bytes to it.
  - The fix (`ab9868f`) moved the value list to `request-schema.ts`. The shared chunk is back to its pre-plan 48,328 decoded bytes.
  - The working tree was restored file by file with `git checkout -- <file>` after the bisect and is clean.

## Task Commits

1. **Task 1 (tracer):** `a9b3e47` (test, RED), `a1c00ff` (feat, GREEN)
2. **Task 2:** `25b9e94` (test, RED), `f2f1c43` (feat, GREEN)
3. **Task 3:** `fd1cfec` (test)
4. **Route budget:** `ab9868f` (fix)

## Assertions Changed Deliberately (13-UI-SPEC §16, D-32)

- **The old holder sentence, in five lines of four specs** (six assertions), each on a freshly submitted, unassigned request. Each now reads `Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.`:
  - `requestor-request-workflow.spec.ts`: `UX08_NEXT_ACTION_NAMES_HOLDER`.
  - `request-relationship-states.spec.ts`: `UX08_PHONE_STEPPER_REQUESTOR_NEXT_ACTION` and `UX08_DESKTOP_HUB_NEXT_ACTION` (in `UX08_PHONE_STEPPER`).
  - `navigation-and-home.spec.ts`: the `With the Security Analyst` item of `UX08_REQUESTOR_HOME_SPLIT`.
  - `review-lists.spec.ts`: the `analystHeldSentence` constant behind `UX09_MY_REQUESTS_NEXT_STEP` and `UX09_MY_REQUESTS_CARD_NEXT_STEP`.
- **`review-lists.spec.ts` column changes:**
  - `UX09_MY_REQUESTS_COLUMN_HEADERS` gains `Security Analyst` after `Status`.
  - `UX09_MY_REQUESTS_NEXT_STEP` and `UX09_MY_REQUESTS_ROW_HOLDER` (the desktop branch of `UX09_MY_REQUESTS_HOLDER_FILTER`) read their cell at `nth(4)`, not `nth(3)`.
  - The holder-filter journey also asserts `Not picked up yet`, in the row (`UX09_MY_REQUESTS_ROW_NOT_PICKED_UP`) and on the card (`UX09_MY_REQUESTS_CARD_NOT_PICKED_UP`).
- **The repo-wide check** for the five old `The Security Analyst is …` openings over `apps/csrm/e2e` is silent. No old sentence is kept in a comment or constant.
- **Web unit tests:**
  - `request-table.test.tsx`: the columns, and cell indexes 3→4 and 5→6.
  - `requestor-home.test.tsx`: the With the Security Analyst fixture now uses the waiting sentence.
  - `contract-response-parity.test.ts`: the next-action fixture.
- **Strapi tests:**
  - `request-lifecycle.unit.test.ts`: the holder table's Requestor sentences.
  - `my-requests.integration.test.ts`: `SUBMITTED_NEXT_ACTION`, `REVIEWED_NEXT_ACTION` and the fifteen item keys.
  - `request-workflow.integration.test.ts`: the Requestor's submitted next action.

## Decisions Made

See `key-decisions` above. In brief:

- **Notes filter:** the flat `notes=unread`, not `filters[notes]`.
- **Unread viewer:** the owner, read from the Requestor's side.
- **Summary:** one statement for every count.
- **Failed summary read:** the Home renders exactly as at zero.
- **New-notes row:** a block-link card above the grid.
- **Analyst panel:** unchanged.
- **The new journey:** asserts that the figure equals its list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tests outside the plan's list that pin the shapes**
- **Files:**
  - `contract-catalogue.integration.test.ts`: `PHASE7_SUMMARY_COUNT_KEYS` and `PHASE11_MY_REQUESTS_PARAMETERS` and `…_ITEM_KEYS`, plus new Phase 13 pins. The first full Strapi suite found these.
  - `request-status-summary.unit.test.ts`: the note tables, and an `id` column on the requestor link the unread body reads.
- **Commit:** `a1c00ff`

**2. [Rule 3 - Blocking] Typecheck callers of `MyRequestListQuery` and `MyRequestItem`**
- **Files:** `loading.tsx`, `quick-find-actions.ts`, `requestor-home-service.ts` (`notes: undefined`) and the `requestor-home.test.tsx` fixture (`assignee: null, unreadNotes: 0`).
- **Commit:** `a1c00ff`

**3. [Rule 1 - Bug] The route budget grew by one byte**
- **Issue:** `/app/risks/{documentId}` measured 299,885 bytes against 13-14's 299,884, because the new value export shipped in a shared chunk.
- **Fix:** moved the value list out of `request-domain.ts`. The route now measures 299,882.
- **Commit:** `ab9868f`

**4. [Interpretation] `notes`, not `filters[notes]`** (see Decisions).

**5. [Test robustness] The reply journey's figure**
- **Issue:** a hard-coded `New notes on 1 request` would be flaky on the shared seeded Requestor.
- **Fix:** the journey asserts that the figure equals its list. It still checks the singular wording when the figure is 1, which it was in both projects.

---

**Total deviations:** 5. None changes behaviour beyond the plan. No content type, grant or catalogue changed, and `served-operations.json` was not regenerated. No dependency was added and no budget override was used.

## Issues Encountered

- **Heredocs.** In this shell, heredocs carrying `’` or `${}` failed, as 13-09 to 13-12 recorded. Those edits went through the Edit tool or scratchpad scripts.
- **Harness flake.** One performance run lost the harness's Next server (`ERR_CONNECTION_FAILED` on `/app/risks`), the 13-12 flake. The next run passed 11/11.
- **Kept scratch builds.** Failed or experimental runs kept their builds under `apps/{backend,csrm}/.tmp/playwright-*`. These are ignored scratch, left in place.

## Threat Model Coverage

- **T-13-48 (mitigate):** My requests and the summary compose the owner predicate, from the policy's numeric id, with the unread body. The mounted test proves that the second Requestor and the analyst who wrote the notes get `withUnreadNotes: 0` and an empty `notes=unread` list. `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG` proves the same in the browser.
- **T-13-49 (mitigate):** `MyRequestAssignee` is `{ displayName }`, closed in the spec, the web parser and the guard. The mounted test asserts no `@` and no assignee documentId anywhere in My requests.
- **T-13-SC (accept):** no package was added.

## Known Stubs

None.

## Next Phase Readiness

- **For 13-16 (AI context):** nothing here changes the AI inputs.
- **For 13-19's walk:**
  - The seven-column My requests table at 1440 with long names.
  - The new-notes row above the Home grid at 1440 and 375.
  - The Home items' line 2 with a long analyst name.
- **REQ-08 and COLLAB-01** stay Pending until the phase gate.

## Self-Check: PASSED

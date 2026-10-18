---
phase: 13-request-pick-up-and-notes
plan: 12
subsystem: review-queue
tags: [review-queue, assignee, pick-up, unread-notes, x-15, x-17, x-14, undo-toast, optimistic-ui, sql-predicates, oracle, contract, playwright, axe]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: allowedAssignmentActions and the policy's viewerId and humanAnalyst (13-03); changeAssigneeAction and family K (13-04); the notes, author and read-state link tables and the unread rule by sequence (13-05, 13-06); the analyst assignment view's viewer, toastAction and the assignment toasts (13-09)
  - phase: 11-navigation-landing-and-list-clarity
    provides: the all bucket, filters[q], the nine-column queue, the queue select and review-lists.spec.ts (11-06)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: successToast (X-14)
provides:
  - The open bucket (every submitted request not yet released) and its oracle
  - filters[assignee]=me|unassigned and filters[notes]=unread as SQL predicates with exact totals, for the policy's viewer only
  - The queue item's assignee ({ documentId, displayName } or null), pickUp (allowed | own-request | not-offered) and unreadNotes
  - The queue read's meta.viewer (AssessmentRequestQueueMeta), which the queue's Pick up sends as the analyst
  - pickUpState in request-assignment-policy.ts; countUnreadNotesByRequest (one grouped read per page); countReviewQueueBucket(strapi, bucket, activeIds, filters?)
  - QueuePickUpButton (row and card) with the viewer's name at once, an X-14 Undo, family K rollback and focus to the next Pick up
  - The Requests page's Assigned to column, card holder line, Assigned to and Notes selects with chips, the X-17 unread line, All open, Requires attention and the UI-D30 description
  - countReviewQueue(queue, { assignee }) for 13-13's and 13-14's counts
  - REQ08_PICK_UP_FROM_QUEUE_ROW and COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE @journey at 1440 and 375
affects: [13-13, 13-14, 13-19]
actuals:
  tokens: 31000
  tasks: 3
  commits: 6
plan_head_before: 11beeb56da09151850f7bc0329a014c593c8db57
plan_head_after: 917a11a4f6a75efa4dd14a69c4e5c2cf37c9b71a
tech-stack:
  added: []
  patterns:
    - "One unread body (whereNoteUnreadFor) serves both the notes=unread EXISTS filter and the page's grouped count, so the flag and the count can never disagree"
    - "A list read names its viewer in meta when a row action must send the viewer's own IdamBox User documentId"
    - "A row action that the next server read removes keeps its Undo outside the component's life: the Undo records the request id to focus, and the restored row's button takes focus when it mounts"
key-files:
  created:
    - apps/csrm/src/features/request-assignment/queue-pick-up-button.tsx
    - apps/csrm/src/features/request-assignment/queue-pick-up-button.test.tsx
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment-policy.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/tests/review-queue.unit.test.ts
    - apps/backend/tests/review-queue-buckets.integration.test.ts
    - apps/backend/tests/request-assignment.unit.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/assessments/assessment-list.test.tsx
    - apps/csrm/src/features/assessments/assessment-status-filters.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/app/(app)/app/review/requests/page.tsx
    - apps/csrm/e2e/request-pick-up.spec.ts
    - apps/csrm/e2e/request-notes.spec.ts
    - apps/csrm/e2e/review-lists.spec.ts
key-decisions:
  - "The queue's Pick up learns the viewer's IdamBox User documentId from the queue read itself: the response's meta gains a required viewer ({ documentId, displayName }, AssessmentRequestQueueMeta), resolved from ctx.state.idamboxUser through the people projection. One fact per read, not per row; it names only the caller; the optimistic cell shows the same display name Strapi will serve, not the session's."
  - "pickUp is 'own-request' for a human Security Analyst on any submitted request they raised, held or not (the reason never changes), and 'not-offered' for a non-human viewer even on their own request; 'allowed' is exactly allowedAssignmentActions(...).includes('pick-up'), proven over every status x holder x requestor x viewer combination."
  - "unreadNotes and notes=unread count by the request read's own rule (summarizeRequestNotes): the author link must name someone other than the viewer (a note without an author is not new, as the Document Service count already reads it), the read state is the first by id (readStateOf), and a viewer who is not a human Security Analyst counts only on a request they raised (canUseRequestNotes)."
  - "filters[assignee] and filters[notes] are refused (400) without a valid policy viewerId; the parsed read carries viewerId only when a filter needs it, and humanAnalyst only with notes, so unfiltered reads are byte-identical to before."
  - "The chip row's Clear filters keeps the chosen queue (Phase 11 verdict 4a, its unit test unchanged) and now also clears Assigned to and Notes; the empty state's Clear filters returns everything, the queue included, to the default. 13-UI-SPEC §2.2's single Clear filters row reads as the empty-state one."
  - "The new selects take their visible labels as their names ('Assigned to', 'Notes'), so Label in Name holds without an aria-label."
  - "On a phone card with Pick up, QueuePickUpButton renders the holder line, the card's facts (as children) and the full-width button, so the holder line changes with the button at once; cards without Pick up render a static holder line."
  - "The released-status set in request-assignment-policy.ts is read at call time: collection-scope.ts now imports pickUpState, and a Set built at load would have been built from an uninitialised binding in the import cycle."
  - "REQ-08 and COLLAB-01 stay Pending until the phase gate, as in 13-03 to 13-11."
patterns-established:
  - "countReviewQueueBucket(strapi, bucket, activeIds, { assignee?, notesUnread?, viewer: { id, humanAnalyst } }) is how a count reads the assignee and notes filters"
  - "AssessmentRequestList({ requests, query, viewer, showAssignee }) shows the queue; 13-13's Assigned to me passes showAssignee={false}"
requirements-completed: []
coverage:
  - id: D1
    description: "Each queue item carries its assignee (documentId and displayName, or null), pickUp from the assignment operation's own rule, and the viewer's unread note count; the read names its viewer; no item carries an email"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/backend/tests/request-assignment.unit.test.ts#pickUpState offers a pick-up exactly where the assignment operation would, and names the viewer's own request"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#a queue item names its assignee, whether the viewer may pick it up, and the viewer's new notes"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/review-queue-buckets.integration.test.ts#each queue item names who holds it, whether the viewer may pick it up and the viewer's new notes (D-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The open bucket and the assignee and notes filters return exactly the oracle's requests with exact totals, for the policy's viewer only; open and released partition All requests; the shared counter agrees"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/backend/tests/review-queue.unit.test.ts#the assignee and notes filters are closed values that carry the policy's viewer, never one from the query"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/review-queue-buckets.integration.test.ts#every queue with every assignee and notes filter returns exactly the oracle's requests, with exact totals (D-13, D-24)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Requests shows Assigned to after Status (name, Pick up, Not picked up, You raised it); Pick up applies at once with an Undo toast, rolls back with family K and moves focus to the next Pick up"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/queue-pick-up-button.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the Assigned to column and Pick up on the Requests queue"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_PICK_UP_FROM_QUEUE_ROW @journey"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both the row and the card flag new notes with the X-17 unread line linking to #notes; Notes: With new notes and Assigned to filter with chips; All open, Requires attention and the UI-D30 description"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx#the Requests queue filters, unread line and labels (13-12)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE @journey"
        status: pass
    human_judgment: false
  - id: D5
    description: "Overflow: the queue scrolls inside its labelled region with the sticky identifier column at 1440 and renders cards below 768px with Pick up last at full width"
    requirement: "REQ-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_PICK_UP_FROM_QUEUE_ROW @journey (375: full-width, 44px Pick up; no horizontal page overflow)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/accessibility.spec.ts (queue cards at 320 and 305px, no horizontal scroll)"
        status: pass
    human_judgment: true
    rationale: "The ten-column table's in-region scroll with the sticky Request column at 1440 is DataTable's existing behaviour, unchanged here; seeing it with long names is the orchestrator's walk (13-19)."
duration: 93min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 12: Pick-up and New Notes on the Requests Queue Summary

**The team's Requests queue now names who holds every request, lets an analyst pick one up from its row or card with an Undo, flags requests with notes new to the viewer, and filters by who holds a request and by new notes, each filter an exact SQL predicate checked against the semantic oracle in all 72 view × filter combinations.**

## Performance

- **Duration:** about 93 minutes (2026-10-08T21:45Z to 23:18Z), the full Strapi suite (twice), Playwright (three runs) and the full web suite included
- **Tasks:** 3 (Task 1 the tracer; Tasks 1 and 2 RED then GREEN), plus one catalogue-guard fix the full Strapi suite found
- **Files changed:** 26 (2 created)

## Accomplishments

- **Contract (D-13).**
  - `filters[queue]` gains `open`; `filters[assignee]` (`me`, `unassigned`) and `filters[notes]` (`unread`) are new closed parameters.
  - `AssessmentRequestQueueItem` requires `assignee` (ActiveUserSummary or null), `pickUp` (`allowed` | `own-request` | `not-offered`) and `unreadNotes` (integer ≥ 0), still closed.
  - The response's meta is `AssessmentRequestQueueMeta`: `pagination` plus a required `viewer`. `schema.d.ts` regenerated with the spec in each GREEN commit.
- **Strapi.**
  - `pickUpState` derives the offer from `allowedAssignmentActions` (Pitfall 9).
  - `hydrate` reads `requestor` and `assignedAnalyst` as `PERSON_FIELDS` only.
  - `countUnreadNotesByRequest` counts the page's unread notes in one grouped read (`GROUP BY r.document_id`, page size ≤ 100; T-13-43).
  - `applyViewerFilters` adds `assignee=me` (EXISTS over `csrm_assessment_requests_assigned_analyst_lnk` naming the viewer), `unassigned` (NOT EXISTS) and `notes=unread` (EXISTS with the same unread body), with constant identifiers and bound values (T-13-41).
  - The viewer is the policy's `viewerId` and `humanAnalyst`; `parseAnalystReviewQuery` refuses either filter without a valid `viewerId`, and any unknown key, value or operator is a 400 (T-13-40).
  - `countReviewQueueBucket` takes the same filters for 13-13's and 13-14's counts.
- **Web.**
  - `assessment-schema.ts` parses the three fields (people with the contract's own unbounded `ActiveUserSummary` shape) and `assessment-service.ts` the meta viewer; the queue query reads `assignee` and `notes` from the URL (a malformed value falls back to none) and sends them; `countReviewQueue(queue, { assignee })`.
  - `QueuePickUpButton` (`'use client'`): outline small, named `Pick up {RAR}`; shows the viewer's name at the pending opacity at once; calls `changeAssigneeAction` with `expectedAnalyst: null`; toasts `You picked up {RAR}.` through `successToast` with `toastAction('Undo')` (no Undo, and the reassign sentence, on a released request); rolls back with family K and `Try again` or `Refresh page`; refreshes at once on `ASSIGNMENT_CHANGED`; moves focus to the next `Pick up` in the same rendering, else the row's request number link; Undo focuses the restored row's `Pick up`.
  - `assessment-list.tsx`: `Assigned to` after `Status` (name, `Pick up`, or `Not picked up` with `You raised it`), hideable for 13-13; the X-17 unread line under the title outside its clamp (`{n} new {note|notes}`, named `… on {RAR}`, linking to `#notes`); cards gain the unread line, the holder line and a full-width, touch-height `Pick up` last; the `Assigned to` and `Notes` selects with their chips; `All open`; `Requires attention`; the UI-D30 description.
  - The Requests page passes the read's viewer to the list.

## Test Counts

- **Task 1.**
  - RED (`61ae764`): web `Tests 17 failed | 230 passed` (4 files); the Strapi test compile failed on the missing `pickUpState` and the new projection signature.
  - GREEN (`9d6c735`): Strapi unit `# pass 23 / # fail 0` (request-assignment and review-queue units); `review-queue-buckets` integration `# pass 12 / # fail 0`; `contract-catalogue` 23, `analyst-dashboard` 8, `assessment-workflow` 37 and `authorization` 21 integration, all `# fail 0`; web `Tests 724 passed` (24 files); typecheck and lint clean.
  - Tracer gate: the plan's Task 1 verify re-run end to end after the commit, exit 0 (`Tests 724 passed`; Strapi `# pass 24 / # fail 0`).
- **Task 2.**
  - RED (`c040738`): web `Tests 10 failed | 465 passed` (2 files); the Strapi test compile failed on the missing `open` bucket.
  - GREEN (`c5cb358`): review-queue unit `# pass 13 / # fail 0`; `review-queue-buckets` integration `# pass 13 / # fail 0`, its combination test covering **72 combinations** (6 queues × 3 assignee × 2 notes × 2 analysts) plus the shared counter in 60 filtered combinations; web `Tests 732 passed`.
  - The first full Strapi run: `# pass 904 / # fail 1` (the catalogue guard's queue enum, fixed in `6607921`: `contract-catalogue` `# pass 23 / # fail 0`).
- **Task 3 (`917a11a`).**
  - The mobile list collects `REQ08_PICK_UP_FROM_QUEUE_ROW` and `COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE` (12 tests in the two files).
  - Playwright `request-pick-up`, `request-notes` and `review-lists`: **34 passed (desktop 18, mobile 16)**; the tree was clean after the run.
  - A wider run of the specs that render the Requests queue (`accessibility`, `assessment-navigation-lifecycle`, `navigation-and-home`, `quick-find`, `design-contract`, `requestor-request-workflow`, `analyst-insights`, `performance`): **91 passed, 1 failed** on `ERR_CONNECTION_FAILED` to the harness's Next server (`UX10_ESCAPE_RESTORES_FOCUS`); `quick-find.spec.ts` alone then **13 passed**. The tree was clean after each run.
- **Full web unit suite:** `Test Files 188 passed`, `Tests 4093 passed`.
- **Full Strapi suite (final, after every commit):** **`# pass 905 / # fail 0`** (`ℹ tests 905`, 1,036 s, about 17.3 min), run as Task 2's whole verify command (api:check, the assessments vitest, typecheck, lint, the copy grep and `pnpm --dir apps/backend test`), exit 0; nothing listened on 1337 or 3000.

## Performance Budget (delivered JavaScript, desktop medians)

`/app/review/requests` has no budgeted route of its own. The budgeted routes are unchanged in effect: `/app/risks/{documentId}` 299,743 bytes (after 13-11: 299,740), `/app/requests/{documentId}` 279,873 (279,835), `/app/review` 231,276. `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.

## Task Commits

1. **Task 1 (tracer):** `61ae764` (test, RED), `9d6c735` (feat, GREEN)
2. **Task 2:** `c040738` (test, RED), `c5cb358` (feat, GREEN), `6607921` (fix, the catalogue guard)
3. **Task 3:** `917a11a` (test)

## Decisions Made

See `key-decisions` above. In brief:

- **The viewer for the queue's Pick up** comes from the queue read's `meta.viewer`, one fact per read; it names only the caller.
- **`pickUp`** is `allowed` exactly where the operation takes a pick-up; `own-request` for a human analyst's own submitted request, held or not.
- **Unread** uses the request read's own rule, so the queue and the request page always agree.
- **Filters without a viewer** are refused, never widened; unfiltered reads are unchanged.
- **Clear filters** in the chip row keeps the queue; the empty state's resets it.
- **The policy's released set** is read at call time because of the new import cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The queue read names its viewer (contract addition)**
- **Found during:** Task 1 design (13-09's open item).
- **Issue:** `PUT …/assignee` takes the analyst's IdamBox User documentId, and no web session carries it; the plan's "viewer's display name from the session" covers only the optimistic cell.
- **Fix:** `AssessmentRequestQueueMeta` with a required `viewer`, resolved in Strapi from `ctx.state.idamboxUser` through `resolvePeople` (PERSON_FIELDS only); the web parser requires it, and the Requests page passes it to the list. The assessment lists keep `CollectionMeta`.
- **Scope:** no content type and no grant changed; the plan already changed the specification.
- **Commit:** `9d6c735`

**2. [Rule 1 - Bug] An import cycle would have emptied the policy's released-status set**
- **Found during:** Task 1 GREEN.
- **Issue:** `collection-scope.ts` imports `pickUpState`, and `request-assignment-policy.ts` built `new Set(RELEASED_REQUEST_STATUSES)` at load from `collection-scope.ts`, so whichever module loaded first could build it from an uninitialised binding (silently empty: unassign offered on released requests).
- **Fix:** the set is read at call time (`isReleasedStatus`).
- **Commit:** `9d6c735`

**3. [Rule 3 - Blocking] Tests outside the plan's list that assert the queue's shape**
- `assessment-workflow.integration.test.ts` (the item's key count, now 13; the queue meta with its viewer), `assessment-status-filters.test.tsx` and `assessment-review-workflow.test.tsx` (fixtures gain the three fields and the meta viewer; the assessment lists keep their own fixtures), and `contract-catalogue.integration.test.ts` (`PHASE68_QUEUE_FILTER_VALUES` gains `open`, found by the full Strapi suite; the guard also pins the two new filters).
- `review-queue.unit.test.ts`'s projection cases moved to Task 1, because the projection's signature changed there.
- `helpers/strapi-http-harness.ts`: the `open` bucket and the count fixture's assignee and notes options, so the mounted test proves the shared counter.
- **Commits:** `61ae764`, `9d6c735`, `c040738`, `6607921`

**4. [Copy] One sentence aligned with UI-D9**
- The non-default queue's empty description now ends `…to see work requiring attention.` (was `requiring your attention`), as `Requires attention` drops "my". No test asserted it.

---

**Total deviations:** 4 (one Rule 3 contract addition, one Rule 1 import-cycle fix, Rule 3 test-shape updates, one copy alignment).
**Impact on plan:** every planned behaviour shipped. No content type, grant, catalogue or `served-operations.json` changed, and no dependency was added.

## Issues Encountered

- **Harness flake.** One wider Playwright run lost its connection to the harness's Next server in `UX10_ESCAPE_RESTORES_FOCUS` (`ERR_CONNECTION_FAILED`); the spec passed alone. The failed run kept its database and Next build under `apps/backend/.tmp/playwright-e2e-9ce1794d…` and `apps/csrm/.tmp/playwright-next-9ce1794d…` (ignored scratch, left in place), as did the first three-spec run (`…a3cad2aa…`), which failed on the one `Submitted` cell index fixed before the commit.
- **Heredocs in Bash.** Heredocs carrying `’` failed in this shell, as 13-09 and 13-11 recorded; those edits went through script files in the scratchpad.

## Threat Model Coverage

- **T-13-40:** the viewer is the policy's `viewerId`, never a query value; `filters[viewer]`, `filters[viewerId]` and an analyst's documentId as `filters[assignee]` are each a 400, and the second analyst's `assignee=me` lists only the second analyst's requests (mounted).
- **T-13-41:** closed enums parsed before any query; constant identifiers and bound values in every predicate.
- **T-13-42:** `assignee` and `meta.viewer` are a documentId and a display name; the mounted test asserts no `@` anywhere in a queue response and the item's 13 keys.
- **T-13-43:** one grouped unread read per page, bounded at 100 ids.
- **T-13-SC:** no package was added.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: response-field (low) | apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts | The analyst review queue's meta now carries the caller's own documentId and display name as `viewer`, through the people projection. It names only the caller, on a read already restricted to the analyst review scope. |

## Known Stubs

None.

## Next Phase Readiness

- **For 13-13 (Assigned to me, the counts and quick find):** `AssessmentRequestList` with `showAssignee={false}`, the `open` default and `filters[assignee]=me`; `countReviewQueue('requires-attention', { assignee: 'me' | 'unassigned' })` for the sidebar counts; and the queue item's `assignee`, already in the projection quick find reads through `listAssessmentRequests`.
- **For 13-14 (analyst Home):** `countReviewQueueBucket(strapi, bucket, activeIds, { assignee, notesUnread, viewer })` counts with the same predicates as the list.
- **For 13-19's walk:** the ten-column table at 1440 with long names, and a queue Undo after the row has left a filtered view.
- **REQ-08 and COLLAB-01:** stay Pending until the phase gate.

## Self-Check: PASSED

---
phase: 13-request-pick-up-and-notes
plan: 06
subsystem: api
tags: [strapi, request-notes, ai-input-mark, human-analyst-only, request-lock, request-delete, separation-of-duties, catalogue, openapi, zod, server-actions]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the notes services, note-ai-input-log.ts, canUseRequestNotes, the AI-input posting rules and the notes harness helpers (13-05)
  - phase: 13-request-pick-up-and-notes
    provides: withRequestLock, OWN_REQUEST, HUMAN_ANALYST_ONLY_OPERATIONS at 14 literals with the assignment branch of humanAnalystDenialMessage, the request read's assignment projection (13-03, 13-04)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: the closed conflict reason lists and refusal-copy.ts
provides:
  - PUT /api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input (setNoteAiInput, handler setAiInput, CSRM_REQUEST_NOTE_OPERATIONS.setAiInput), human Security Analyst only twice
  - function.risk_assessment_requests.note_ai_input_api for role.security_analyst alone, in both catalogue copies
  - HUMAN_ANALYST_ONLY_OPERATIONS at 15 literals plus the insight operations, with its own refusal sentence
  - summarizeRequestNotes and countRequestNotes; the request read's required, nullable notes summary
  - The request delete override (REQUEST_HAS_NOTES under withRequestLock) and the D-20 refusal (NOT_REQUEST_REQUESTOR) in prepareAnalystUpdate
  - REQUEST_HAS_NOTES and NOT_REQUEST_REQUESTOR in both closed lists and both published error schemas
  - Web setNoteAiInput, setNoteAiInputAction, refusal family M (noteAiInputRefusal), requestNotesSummarySchema and RequestNotesSummary
  - O-5's Phase 13 disposition in 08-SECURITY.md; R-08-37's Phase 13 PostgreSQL constructs and O-5's note in the residual register
affects: [13-07, 13-08, 13-10, 13-11, 13-12, 13-17, 13-18, 13-19, 14, 15, 16, 17, 17.1, 19.1]
actuals:
  tokens: 34600
  tasks: 3
  commits: 6
plan_head_before: 02f0122e45b2a35fae39e5b8f36689ecabc6dfa2
plan_head_after: 4c5ed7607f45a4947ae744c2a18662ca03260e94
tech-stack:
  added: []
  patterns:
    - "A core-controller delete override that runs the guard read and super.delete inside one withRequestLock call, the lock the competing create takes"
    - "An identity-relative 403 with a closed reason on an existing core update (denyForbidden beside denyConflict)"
    - "A human-only literal listed with the handler it guards, its denial sentence keyed on the operation constant"
key-files:
  created:
    - .planning/workstreams/csrm/phases/13-request-pick-up-and-notes/13-06-SUMMARY.md
  modified:
    - apps/backend/src/api/csrm-request-note/services/request-notes.ts
    - apps/backend/src/api/csrm-request-note/controllers/request-notes.ts
    - apps/backend/src/api/csrm-request-note/routes/request-notes.ts
    - apps/backend/src/api/csrm-request-note/operations.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - docs/references/served-operations.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/authorization-policy.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/request-notes.integration.test.ts
    - apps/backend/tests/request-notes.unit.test.ts
    - apps/backend/tests/authorization.integration.test.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/csrm/src/features/request-notes/notes-schema.ts
    - apps/csrm/src/features/request-notes/notes-service.ts
    - apps/csrm/src/features/request-notes/notes-service.test.ts
    - apps/csrm/src/features/request-notes/notes-actions.ts
    - apps/csrm/src/features/request-notes/notes-actions.test.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/refusal-copy.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
    - .planning/workstreams/csrm/phases/08-production-integration-and-hardening/08-SECURITY.md
    - docs/security/phase-08-residual-risks.md
key-decisions:
  - "The mark decides in this order under the request lock: 404 (request gone or not the caller's, or the note not on it), 403 OWN_REQUEST, 403 for a non-human analyst, 409 NOTES_CLOSED, the same-value no-op, then 409 HISTORY_UNAVAILABLE. A shut window refuses even the same value, so the frozen mark is never touched."
  - "A malformed AI-input log refuses a change with HISTORY_UNAVAILABLE (fail closed); the code never repairs or rewrites a log. A full log still answers a same-value call 200, because no event is written."
  - "The request read's notes summary is required and nullable in the contract and in the web detail parser; a viewer canUseRequestNotes refuses gets null and no notes query runs for them (T-13-24)."
  - "D-20 is decided before the status rule: an analyst submitting a request someone else raised gets 403 NOT_REQUEST_REQUESTOR whatever the request's status, identity before state as G-1 orders it. Every other status keeps the Requestor path, so T-08-A2's 400 cases stand unedited."
  - "A missing request on the delete keeps Strapi 5's core answer, 204 with nothing deleted, never REQUEST_HAS_NOTES."
  - "Family M reads a 400 and every 409 as the blocked sentence; invalid action input reads 'We couldn’t change the mark. Try again.' as blocked, the addRequestNoteAction pattern."
  - "REQ-08 and COLLAB-01 stay Pending until the phase gate (the 13-03 to 13-05 precedent)."
requirements-completed: []
coverage:
  - id: D1
    description: "A human Security Analyst who did not raise the request marks or unmarks any note on it, the Requestor's included, while the request accepts notes; each change appends one schemaVersion 1 event; Undo is a second change; the same value writes nothing"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#a Security Analyst marks the Requestor's note as changing the AI inputs and undoes it, one logged event per change and none for the same value (D-26)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The mark is human-analyst-only twice: the Requestor, the other Requestor and the service agent get 403, a requesting analyst 403 OWN_REQUEST, a released, closed or returned request 409 NOTES_CLOSED, a full or unreadable log 409 HISTORY_UNAVAILABLE, all with nothing written"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#the AI-input mark is refused to the Requestor, the other Requestor, the service agent and a requesting analyst, outside the notes window, for a note from another request and for an open body, with nothing written (D-26, D-07, D-30)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts#every human-analyst-only operation is served and its row denies the owner, the other Requestor and the service agent"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/authorization-policy.unit.test.ts#Strapi tells a mis-granted Security Analyst Agent that marking a note as changing the AI inputs requires a human Security Analyst"
        status: pass
    human_judgment: false
  - id: D3
    description: "The request read carries the viewer's notes summary (total, unread, accepting, closedReason) for the requestor and the human analysts, null for anyone else"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#the request read carries each reader's notes summary, unread by sequence, with the closedReason of a never-submitted draft, a request returned to draft and a released request (D-24, D-25)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/request-notes.unit.test.ts#summarizeRequestNotes answers null, reading nothing, for a viewer who may not use the request's notes (T-13-24)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A request holding a note cannot be deleted (409 REQUEST_HAS_NOTES, nothing deleted), and a delete raced with a note create leaves no orphan"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#a request holding a note cannot be deleted (REQUEST_HAS_NOTES) and nothing is deleted; a request with no note still can be (D-21, T-13-22)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#a delete and a note create started together leave no orphan: the create wins and the delete is refused, or the delete wins and the create is 404 (D-21, T-13-22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Only a request's own requestor submits it: an analyst's submission of another person's draft is 403 NOT_REQUEST_REQUESTOR with persistence deep-equal; T-08-A2 stays green and unedited"
    verification:
      - kind: integration
        ref: "apps/backend/tests/authorization.integration.test.ts#D-20 an analyst submitting a draft they did not raise is refused with NOT_REQUEST_REQUESTOR, while amending it and the requestor's own submission stay allowed"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization.integration.test.ts#T-08-A2 mounted update ignores server-owned facts and honours only the published submission intent from an analyst"
        status: pass
    human_judgment: false
duration: 58min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 06: The AI-input mark, the notes summary and the two request refusals Summary

**A human Security Analyst who did not raise a request can now mark any of its notes as changing the AI inputs and undo it, each change logged. Every reader allowed to use the notes sees from the request read how many there are and how many are new. A request holding a note can no longer be deleted, and only a request's own requestor submits it, which closes O-5.**

## Performance

- **Duration:** about 58 min
- **Started:** about 2026-10-08T17:22Z
- **Completed:** 2026-10-08T18:21Z
- **Tasks:** 3. Task 1 is the tracer. Each task ran RED, then GREEN.
- **Files changed:** 36, plus this SUMMARY

## Accomplishments

- **The AI-input mark (D-26, D-07, D-30).** `PUT /api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input` takes exactly `{ data: { changesAiInputs: boolean } }`. `setNoteAiInput` runs under `withRequestLock` and re-reads the request and the note after the lock. It then decides in this order:
  1. 404: the request is gone, or no longer the caller's to use, or the note is not on it;
  2. 403 `OWN_REQUEST`: the caller raised the request (G-1);
  3. 403: the caller is not a human Security Analyst;
  4. 409 `NOTES_CLOSED`: the request takes no new note (released, closed or returned to draft);
  5. 200, nothing written: the mark already has that value;
  6. 409 `HISTORY_UNAVAILABLE`: the log is full or cannot be read.

  Otherwise the mark and one `{ schemaVersion: 1, by, at, from, to }` event are written in the same update. The answer is the analyst's projection of the note.
- **Human-only twice.**
  - `function.risk_assessment_requests.note_ai_input_api` (`.api.01`, Set Request Note AI Input Mark) is granted to `role.security_analyst` only. The grant is written both ways (the Function's `roleIds` and the role's `functionIds`) in both catalogue copies, and `cmp` is silent.
  - The literal is in `HUMAN_ANALYST_ONLY_OPERATIONS`, in the policy and in the matrix mirror. The count is now `15 + insightOperations.size`.
  - `humanAnalystDenialMessage` answers `Marking a note as changing the AI inputs requires a human Security Analyst.`
  - The matrix row expects `humanAnalystOnly(200)` and cites the mounted mark test for Bob's success.
- **The notes summary (D-24, D-25).** The request read (`findOne`) carries `notes: { total, unread, accepting, closedReason } | null` beside `assignment`. It is computed by the thread's own unread rule, by sequence. For a viewer `canUseRequestNotes` refuses it is null, and no notes query runs for them. Reading the request writes nothing.
- **No orphaned notes (D-21, T-13-22).** The request controller's `delete` override counts the request's notes and calls `super.delete` inside one `withRequestLock` call. The count goes through the Document Service, so it joins the lock's transaction. With a note it answers 409 `REQUEST_HAS_NOTES` and deletes nothing. A note create waiting behind a delete finds the request gone and answers 404. A missing request keeps the core answer, 204.
- **Only the requestor submits (D-20, O-5).** `prepareAnalystUpdate(persisted, data, submittedAt, actorDocumentId)` refuses `requestStatus: "submitted"` from an analyst who did not raise the request: 403 `NOT_REQUEST_REQUESTOR`. The controller passes `ctx.state.idamboxUser.documentId` and maps the 403 through a new `denyForbidden` that keeps the reason. An analyst still amends another person's draft and still submits their own (T-08-A2).
- **Contract.**
  - The spec gains the mark path and `RequestNoteAiInputRequest`.
  - It gains `RequestNotesSummary` (closed), and the request read's `notes`, which is required and nullable.
  - `REQUEST_HAS_NOTES` and `NOT_REQUEST_REQUESTOR` are added to both error schemas' reason enums.
  - The core delete gains a 409, and the core update's 403 now references `AssessmentWorkflowErrorResponse`.
  - The client is regenerated, and `served-operations.json` is regenerated with the route and its web caller.
- **Web.**
  - `setNoteAiInput` in the `server-only` service, registered with the parity guard as `RequestNoteResponse`.
  - `setNoteAiInputAction`: strict input, and it revalidates `/app/review/requests/{id}`.
  - Family M and `noteAiInputRefusal`, with §10.4's sentences verbatim.
  - `requestNotesSummarySchema` on the request detail parser, and the `RequestNotesSummary` type.
- **Records.**
  - `08-SECURITY.md` gains O-5's `**Phase 13 disposition (2026-10-01).**`.
  - The residual register gains R-08-37's Phase 13 PostgreSQL constructs (`FOR UPDATE` before the deciding reads, ALS-bound queries in the lock, `COUNT` as a string, boolean `changes_ai_inputs`) and O-5's settlement note.

## Test Counts

- **Task 1 RED:**
  - Web: `Tests 12 failed | 122 passed` (`setNoteAiInput` and `setNoteAiInputAction` missing; family M missing).
  - Strapi: `# pass 191 / # fail 10`. The failures were the mounted mark cases, the matrix row and the human-only count (`HUMAN_ANALYST_GUARD_LITERAL_MISSING_PUT…`), the provenance check, `NOTE_AI_INPUT_OPERATION_NOT_HUMAN_ONLY`, `PHASE13_AI_INPUT_FUNCTION_MISSING` and `NOTE_AI_INPUT_OPERATION_NOT_SERVED`.
- **Task 1 verify** (exit 0):
  - `cmp` silent and `api:check` clean.
  - Vitest `Tests 308 passed`: request-notes, refusal-copy, parity and chain.
  - Web typecheck and Strapi `tsc` clean.
  - node:test over request-notes.integration, contract-catalogue.integration, served-operations.integration, authorization-policy.unit, authorization-matrix-provenance.unit and authorization-matrix.integration: `# pass 201 / # fail 0`.
  - The tracer feedback gate re-ran this verify end to end before expansion: it passed.
- **Task 2 RED:**
  - Web: `Tests 1 failed | 289 passed`.
  - Strapi: `# pass 20 / # fail 2`. The unit file did not compile (`summarizeRequestNotes` missing), and the mounted case failed at `UNEXPECTED_JANE_SUMMARY`.
- **Task 2 verify** (exit 0):
  - `api:check` clean.
  - Vitest `Tests 290 passed`: requests, request-notes and parity.
  - Web typecheck clean.
  - node:test over request-notes.integration, request-workflow.integration and request-notes.unit: `# pass 29 / # fail 0`.
- **Task 3 RED:**
  - Web: `Tests 2 failed | 55 passed`.
  - Strapi: `# pass 33 / # fail 4`: `REQUEST_HAS_NOTES_MISSING`, `UNEXPECTED_DELETE_WITH_NOTES_STATUS`, `UNEXPECTED_RACE_ORPHANED_NOTES` and `D20_SUBMISSION_STATUS_`.
- **Task 3 focused:**
  - conflict-reasons.unit, request-notes.integration, authorization.integration and contract-catalogue.integration: `# pass 59 / # fail 0`.
  - Web conflict-reasons, parity and chain: `Tests 233 passed`.
- **Task 3 verify** (exit 0): the O-5 and R-08-37 greps, `api:check`, `Tests 59 passed` (conflict-reasons) and the web typecheck.
  - **Full Strapi suite (`pnpm --dir apps/backend test`): `# pass 890 / # fail 0`** (`ℹ tests 890`, about 15.5 minutes). Nothing was listening on 1337 or 3000. T-08-A2 is green.
- **Full web suite (`vitest run`):** `Test Files 172 passed`, `Tests 3806 passed`. This run is extra, for the request detail parser change.
- **Content-type freeze since ab000f6:** exactly the three approved schema files. This plan changed no content type.

## Task Commits

1. **Task 1 RED:** `c5554a2` (test)
2. **Task 1 GREEN:** `c75fbb4` (feat)
3. **Task 2 RED:** `308775c` (test)
4. **Task 2 GREEN:** `7295f47` (feat)
5. **Task 3 RED:** `0323ae7` (test)
6. **Task 3 GREEN:** `4c5ed76` (feat)

## Decisions Made

- **Mark order.** The order is 404, then `OWN_REQUEST`, then the non-human 403, then `NOTES_CLOSED`, then the no-op, then `HISTORY_UNAVAILABLE`. The same value on a shut request is still `NOTES_CLOSED`: the mark is frozen with the record, so even a no-op is not offered there.
- **Fail closed on the log.** A malformed `aiInputLog` refuses a change with `HISTORY_UNAVAILABLE` and is never repaired, so the mark never changes without its audit record. Whether a note is marked is still read from `changesAiInputs` alone.
- **The summary is required and nullable.** Both the contract and the web detail parser require `notes`. A read without it fails closed in the web as unavailable.
- **D-20 before the status rule.** Identity comes before state, as G-1 orders it. An analyst submitting another person's request gets `NOT_REQUEST_REQUESTOR` whatever its status. Other statuses keep the Requestor path's 400.
- **A missing delete stays 204.** Strapi 5's core delete answers 204 for any id. The override changes only a request that holds a note.
- **Family M edges.**
  - A 400 reads the blocked fallback, as a 409 does.
  - Invalid action input reads `We couldn’t change the mark. Try again.` as blocked, the `addRequestNoteAction` pattern.
  - The action revalidates only the analyst request page. Plan 13-18 adds the questionnaire and assessment pages.
- **Requirements.** REQ-08 and COLLAB-01 stay Pending until the phase gate, as in 13-03 to 13-05.

## Deviations from Plan

### Auto-fixed issues and additions

**1. [Rule 3 - Blocking] The served-operations test named exactly three notes routes**
- **Issue:** `served-operations.integration.test.ts` asserted that the notes API serves three routes (`NOTES_API_SERVES_ANOTHER_ROUTE`). The file is not in the plan's list.
- **Fix:** it now checks the AI-input route's router, token-only auth, policy, Function, role and web caller, and expects four routes.
- **Commit:** `c5554a2`

**2. [Rule 3 - Blocking] Harness additions**
- **Issue:** the full-log and unreadable-log cases needed to write a note's `aiInputLog` directly, and the orphan proof needed a count no request filter can reach.
- **Fix:**
  - `CsrmFixtureUid` gains the note UID.
  - `countOrphanedRequestNotes()` counts, in SQL, the note rows that reference no existing request.
- **Commits:** `c5554a2`, `0323ae7`

**3. [Rule 2 - Missing critical] T-13-24 unit proof**
- **Issue:** no current reader can read a request without being allowed its notes, so the null branch of the summary could not be reached through a mounted route.
- **Fix:** a case in `request-notes.unit.test.ts` proves that `summarizeRequestNotes` returns null without touching the Document Service.
- **Commit:** `308775c`

**4. [Rule 1 - Test expectation] A missing request's delete**
- **Issue:** the first GREEN run expected 404 for a delete naming a missing request. The core delete answers 204, and the plan says the core answer is kept.
- **Fix:** the test asserts 204 with nothing deleted. This was fixed before the Task 3 GREEN commit; no production code changed for it.
- **Commit:** `4c5ed76`

**5. [Contract] `notes` is in the request read's `required` list**
- **Issue:** the plan names the field "nullable", but the web parser requires it.
- **Fix:** the spec lists `notes` as required too, so the parser and the contract agree.
- **Commit:** `7295f47`

**6. [Plan file list] Files listed but unchanged**
- `contract-response-parity.test.ts` needed no edit: the new parser registers through `notes-service.ts`'s `responseParserModule`, and the request detail through `request-service.ts`'s existing `request.getRequest` entry.
- `notes-domain.ts` already typed `notesClosedReasons`; `request-domain.ts` imports the type from it.

---

**Total deviations:** 6: two Rule 3 fixes, one Rule 2 addition, one test-expectation fix, one contract alignment and one file-list note.
**Impact on plan:** none widens scope. No content type changed. T-08-A2's assertions are unedited: the diff to `authorization.integration.test.ts` adds lines only.

## Issues Encountered

- **The Bash tool's handling of quoted heredocs.** Some heredocs that contained backticks or apostrophes failed to parse, and Git Bash rewrote `:/api/…` arguments given to `node -e`. Every multi-line edit therefore went through a script file written with the Write tool, keeping each file's line endings.
- **`api:check` and the index.** `api:check` compares the regenerated client with the index (`git diff --exit-code`), so each contract change's `schema.d.ts` was staged by its explicit path before the check and committed with that change.

## Threat Model Coverage

- **T-13-20:**
  - The grant is the human analyst's alone, and the literal is in `HUMAN_ANALYST_ONLY_OPERATIONS`.
  - `OWN_REQUEST` is decided inside the lock, before the window.
  - The matrix 403 rows check persistence deep-equal, and the mounted refusals check it for the owner, the other Requestor, the service agent and a requesting analyst.
- **T-13-21:** each change appends one event, capped at 200 and fail-closed. The concurrency case proves that two analysts setting the same value at once log one event.
- **T-13-22:** the delete override counts and deletes under the create's lock. The race test ran three rounds, and the orphan count is 0.
- **T-13-23:** `NOT_REQUEST_REQUESTOR` 403 with persistence deep-equal. T-08-A2 is green.
- **T-13-24:** `summarizeRequestNotes` returns null without reading notes for a refused viewer.
- **T-13-SC:** no package was added.

## User Setup Required

None. No schema changed.

## Next Phase Readiness

- **13-10 and 13-11** have:
  - `setNoteAiInputAction` and `noteAiInputRefusal` for the switch and its Undo toast (§10.1, §10.4);
  - the request read's `notes` for the hub and page figures.
- **13-17 and 13-18** read `changesAiInputs` and `aiInputLog`. Every event carries `schemaVersion: 1`.
- **Phase 17.1** completes the self-review separation that O-5's disposition cites.

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*

## Self-Check: PASSED

All six plan commits exist: c5554a2, c75fbb4, 308775c, 7295f47, 0323ae7, 4c5ed76. Both catalogue copies are byte-identical. `operations.ts` holds `setAiInput`, `refusal-copy.ts` holds §10.4's OWN_REQUEST sentence, `08-SECURITY.md` holds the Phase 13 disposition, and the request controller defines `async delete(` with `REQUEST_HAS_NOTES`. The content-type freeze since ab000f6 lists exactly the three approved schema files.

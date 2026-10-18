---
phase: 13-request-pick-up-and-notes
plan: 05
subsystem: api
tags: [strapi, request-notes, content-types, request-lock, read-state, ai-input-mark, catalogue, openapi, zod, server-actions]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the approved request notes record (13-02, G-6, approved by the pilot on 2026-10-09)
  - phase: 13-request-pick-up-and-notes
    provides: withRequestLock, projectPerson, PERSON_FIELDS, the policy facts humanAnalyst and viewerId, OWN_REQUEST in both reason lists, a transport that keeps a closed reason on 403 and 409 (13-03, 13-04)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: the closed conflict reason lists and refusal-copy.ts families A to I
provides:
  - The two approved content types, api::csrm-request-note.csrm-request-note (csrm_request_notes) and api::csrm-request-note.csrm-request-note-read-state (csrm_request_note_read_states), their four link tables, no inverse attribute and no core router
  - request-notes-policy.ts (acceptsNotes, notesClosedReason, canUseRequestNotes, authorPartFor, isUnreadNote, parseNoteBody and the bounds)
  - note-ai-input-log.ts (the closed, append-only, 200-event AI-input log)
  - request-notes.ts (loadNotesRequest, listRequestNotes, addRequestNote, markRequestNotesRead, projectNote, RequestNotesError)
  - GET and POST /api/v1/assessment_requests/{requestId}/notes and POST …/notes/read, with CSRM_REQUEST_NOTE_OPERATIONS
  - function.risk_assessment_requests.notes_api for role.security_analyst and role.requestor, and the amended design note 6
  - NOTES_CLOSED and NOTES_LIMIT_REACHED in both closed lists and both published error schemas
  - Web features/request-notes (domain, closed parsers, typed service, three Server Actions) and refusal family L (noteRefusal)
affects: [13-06, 13-07, 13-08, 13-10, 13-11, 13-12, 13-17, 13-19, 14, 15, 16, 17, 17.1, 17.2, 19.1]
actuals:
  tokens: 39000
  tasks: 2
  commits: 5
plan_head_before: 6be455bce8f1a2465bd0fc89764210bbd86e068d
plan_head_after: ca144ca6f2254e27e0c8bae062eb128663bea2da
tech-stack:
  added: []
  patterns:
    - "A record-level reader predicate in the controller that answers every refused caller with the missing-record 404, separate from the request read so a later widening of the request read never reaches it"
    - "An API folder with content types and only a custom router: no createCoreRouter, so no core route exists to close"
    - "Sequence-based unread: per-person lastReadSequence compared with a server-assigned sequence, never with times"
key-files:
  created:
    - apps/backend/src/api/csrm-request-note/content-types/csrm-request-note/schema.json
    - apps/backend/src/api/csrm-request-note/content-types/csrm-request-note-read-state/schema.json
    - apps/backend/src/api/csrm-request-note/services/request-notes-policy.ts
    - apps/backend/src/api/csrm-request-note/services/request-notes.ts
    - apps/backend/src/api/csrm-request-note/services/note-ai-input-log.ts
    - apps/backend/src/api/csrm-request-note/controllers/request-notes.ts
    - apps/backend/src/api/csrm-request-note/routes/request-notes.ts
    - apps/backend/src/api/csrm-request-note/operations.ts
    - apps/backend/tests/request-notes.unit.test.ts
    - apps/backend/tests/request-notes.integration.test.ts
    - apps/csrm/src/features/request-notes/notes-domain.ts
    - apps/csrm/src/features/request-notes/notes-domain.test.ts
    - apps/csrm/src/features/request-notes/notes-schema.ts
    - apps/csrm/src/features/request-notes/notes-service.ts
    - apps/csrm/src/features/request-notes/notes-service.test.ts
    - apps/csrm/src/features/request-notes/notes-actions.ts
    - apps/csrm/src/features/request-notes/notes-actions.test.ts
  modified:
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/types/generated/contentTypes.d.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - docs/references/served-operations.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/refusal-copy.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
key-decisions:
  - "The create decides in this order under the request lock: 404 (gone, or no longer the caller's), then the AI-input mark from the requestor (403 OWN_REQUEST for a requesting analyst, 400 for a Requestor), then NOTES_CLOSED, then NOTES_LIMIT_REACHED. G-1 comes first, so a requesting analyst learns only OWN_REQUEST."
  - "Carrying changesAiInputs at all (true or false) is the refused act: a Requestor gets 400 for either value, and a requesting analyst gets 403 OWN_REQUEST for either value."
  - "Mark-read is allowed in every status, a returned draft and a released request included: the read state is personal and the thread stays readable after the window shuts."
  - "A note's changesAiInputs is projected to a human Security Analyst only (a requesting analyst included), never to the Requestor; canMarkAiInputs is false for a requesting analyst."
  - "parseNoteBody refuses exactly the C0 control characters other than tab and newline, as the record states; DEL is not refused."
  - "validateNoteDraft applies all three server rules, so a pasted control character reads 'Remove the hidden formatting characters from the note, then add it.' (not in 13-UI-SPEC §8.3; recorded for 13-10)."
  - "noteRefusal reads §9.5's 403 sentence 'You can’t add notes to this request.' for a 403, an unexplained 400 and a 409 with no notes reason; 404 is kind not-found with Phase 10's locked request refusal."
  - "The generated content types were regenerated and committed alone (db1a2bc), so nothing is pending; the code keeps the csrm-ai-run cast pattern, which is harmless now that the UIDs are generated."
requirements-completed: []
coverage:
  - id: D1
    description: "The Requestor and a human Security Analyst add attributed, append-only, plain-text notes to a submitted request and list them oldest first, with author display name, part, server time and sequence; no edit or delete route exists"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#the Requestor and a Security Analyst exchange notes on a submitted request, oldest first, each unread only for the other part (D-21, D-24)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/served-operations.integration.test.ts#request notes are served by their three operations alone, with no core route and no edit or delete of a note (D-02, D-21)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Another Requestor, a participant-shaped caller, the service agent and anyone naming a missing request get 404 on every notes route with persistence unchanged"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#another Requestor, the service agent and anyone naming a missing request get 404 on every notes route with nothing written (D-23)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#a participant-shaped caller who is not the requestor gets 404 on every notes route with nothing written (D-23, G-12)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The posting window, the bounds and the read state: NOTES_CLOSED on a draft, a returned draft, an approved and a closed request; NOTES_LIMIT_REACHED at 500; 400 for over 5,000 characters or a control character; monotonic mark-read; one read-state row and distinct sequences under concurrency; no GET write"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/request-notes.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The posting-time AI-input mark for a human Security Analyst, logged as one event; the Requestor's mark 400 and a requesting analyst's 403 OWN_REQUEST"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#a Security Analyst may mark a note as changing the AI inputs when posting; a Requestor's mark is 400 and a requesting analyst's is OWN_REQUEST (D-26, D-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The contract chain and the web typed layer: spec, generated client, both catalogue copies, served inventory, closed parsers registered with the parity guard, three Server Actions and refusal family L"
    verification:
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 13 request notes are held by one Function granted to the Security Analyst and the Requestor alone and published closed"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#noteRefusal (family L)"
        status: pass
    human_judgment: false
duration: 41min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 05: Request Notes Summary

**Jane and any human Security Analyst can now add attributed, append-only, plain-text notes to a submitted request and read them through Strapi and the web's typed layer. Unread notes are counted per person by sequence. Nobody else can reach the notes: everyone else gets a 404.**

## Performance

- **Duration:** about 41 min
- **Started:** 2026-10-08T16:44:48Z
- **Completed:** 2026-10-08T17:25:57Z
- **Tasks:** 2. Task 1 is the tracer. Each task ran RED, then GREEN.
- **Files changed:** 33

## Accomplishments

- **Schema.** The two approved content types are in `apps/backend/src/api/csrm-request-note/`, exactly as the record names them:
  - `draftAndPublish: false`;
  - no `inversedBy` on any relation;
  - no core router. `routes/` holds only `request-notes.ts`, and the folder contains no `createCoreRouter`.

  `PRAGMA table_info` lists every approved column and the four link tables. The request table gains no column.
- **Readers.** Every handler loads the request and asks `canUseRequestNotes`, which admits the requestor first and then any human Security Analyst. Everyone else gets the same 404, `CSRM request notes were not found.`, before anything is read or written. The predicate's doc comment states that Phase 17's participant read never reaches notes, and that widening it needs its own decision.
- **Writes.** The create and the mark-read run under `withRequestLock`. The count, the highest sequence and the read state are read after the lock.
  - The create decides in this order: 404, the mark rules (403 `OWN_REQUEST` or 400), `NOTES_CLOSED`, then `NOTES_LIMIT_REACHED`.
  - A posting-time mark writes `changesAiInputs: true` and the first log event (`from: false`, `to: true`, by the author, at `postedAt`).
  - The mark-read only advances, and a GET never writes.
- **Grant and contract.**
  - `function.risk_assessment_requests.notes_api` is written both ways in both catalogue copies (`cmp` is silent). The Security Analyst Agent's role does not hold it.
  - Design note 6 records the notes as Phase 13's collaboration entity and keeps comments elsewhere as COLLAB-03.
  - The spec gains the two paths, the nine closed components and the two reasons in both error schemas.
- **Web.**
  - `features/request-notes/` holds a zod-free domain, closed parsers, the `import 'server-only'` service and the `'use server'` actions. The add action revalidates both request pages; the mark-read action revalidates nothing.
  - Family L and `noteRefusal` are in `refusal-copy.ts`.
  - The parser module is registered with the parity guard.

## Test Counts

- **Task 1 RED:**
  - Web: 3 files failed on the missing `notes-service` module.
  - Strapi: `PHASE13_NOTES_FUNCTION_MISSING`, `UNEXPECTED_NOTE_COLUMN_MISSING_body`, `UNEXPECTED_JANE_ADD_STATUS` and `UNEXPECTED_SEED_NOTE_STATUS`.
- **Task 1 verify** (exit 0):
  - `cmp` silent and `api:check` clean.
  - Vitest `Tests 209 passed`: request-notes, parity, chain and zod boundary.
  - Web typecheck and Strapi `tsc` clean.
  - node:test over request-notes.integration, contract-catalogue.integration, served-operations.integration, authorization-matrix-provenance.unit and authorization-matrix.integration: `# pass 167 / # fail 0`.
- **Task 2 RED:**
  - Web: 13 failed, 163 passed.
  - Strapi: the unit file did not compile (the missing `note-ai-input-log` module). Emitted with `--noEmitOnError false`, the mounted run failed four targets: `NOTES_CLOSED_MISSING`, `UNEXPECTED_STATUS_NEVER_SUBMITTED`, `UNEXPECTED_STATUS_CONTROL_CHARACTER` and `UNEXPECTED_MARKED_ADD_STATUS`.
  - The mark-read, concurrency and participant cases already passed, because Task 1 built the mark-read monotonic and the reader rule complete.
- **Task 2 focused:** request-notes.unit, conflict-reasons.unit and request-notes.integration ran `# pass 18 / # fail 0`. The web notes, reason, refusal-copy, copy-guard, parity and chain tests ran `Tests 485 passed`.
- **Task 2 verify** (exit 0):
  - `api:check` clean.
  - Vitest `Tests 313 passed`: request-notes, refusal-copy, conflict-reasons and the interface copy guard.
  - Web typecheck clean.
  - **Full Strapi suite (`pnpm --dir apps/backend test`): `# pass 879 / # fail 0`** (`ℹ tests 879`, about 15.9 minutes). Nothing was listening on 1337 or 3000.
- **Matrix:** three new rows:
  - `GET` and `POST …/notes` and `POST …/notes/read`, each `{ owner: 200, other: 404, analyst: 200, serviceAgent: 404, noIdentity: 403 }`;
  - token-less 401 (the content-api-token family);
  - the GET row issues its successes, and the two POST rows cite the mounted exchange.

  The matrix now has 86 served rows and 37 plugin rows. The human-only count stays at 14, because the notes are not human-only.
- **Content-type freeze since ab000f6:** exactly the three approved schema files (the request schema, `csrm-request-note`, `csrm-request-note-read-state`).

## Task Commits

1. **Task 1 RED:** `0881afd` (test)
2. **Task 1 GREEN:** `f544479` (feat)
3. **Generated types:** `db1a2bc` (chore(backend)), `contentTypes.d.ts` only. The diff is the two new interfaces, 89 lines.
4. **Task 2 RED:** `918d24c` (test)
5. **Task 2 GREEN:** `ca144ca` (feat)

## Decisions Made

- **Create order.** G-1 is decided first: a requesting analyst's mark gets 403 `OWN_REQUEST` before the window or the cap is checked.
- **The mark key itself is the refused act.** A Requestor's create carrying `changesAiInputs` gets 400 whatever its value. A requesting analyst's gets 403 `OWN_REQUEST` whatever its value. The UI never offers the control to either.
- **Mark-read in every status.** The read state is personal, and a closed or returned thread stays readable, so marking it read is never refused for the request's status.
- **Who sees the mark.** It is projected to a human Security Analyst only, a requesting analyst included. `canMarkAiInputs` is false on a request the analyst raised.
- **Control characters.** The server refuses exactly what the record says: C0 except tab and newline. `validateNoteDraft` applies the same three rules, so a pasted control character is caught in the composer (see deviation 2).
- **Unexplained refusals.** A 403, a 400 that the composer's check did not foresee, and a 409 without a notes reason all read §9.5's 403 sentence. A 404 is kind `not-found`.

## Deviations from Plan

### Auto-fixed issues and additions

**1. [Rule 2 - Missing critical] Harness helpers for the notes**
- `listRequestNotes`, `listRequestNoteReadStates`, `createRequestNoteFixtures` and `registerTestIdentity` were added to `tests/helpers/strapi-http-harness.ts`, which is not in the plan's file list.
- The persistence deep-equal checks need the notes and read states, the cap case needs 500 seeded notes, and the participant-shaped caller needs an identity created in the test.
- **Commits:** `0881afd`, `918d24c`

**2. [Rule 2 - Missing critical] A third composer sentence for control characters**
- **Issue:** 13-UI-SPEC §8.3 words only the empty and over-length errors. Without a third check, a note with a pasted control character would come back as a 400 with no reason the person could act on.
- **Fix:** `validateNoteDraft` returns `Remove the hidden formatting characters from the note, then add it.` 13-10 should adopt the sentence, or replace it in the UI-SPEC.
- **Commit:** `ca144ca`

**3. [Orchestrator overlay v2] The generated content types were regenerated and committed**
- The plan records this regeneration as pending. The overlay directs committing it alone.
- It was produced with `strapi ts:generate-types` (register only, no database), both Keycloak flags false and the deterministic AI provider. It is in `db1a2bc`. Nothing is pending.

**4. [Plan file list] Task 1 built the complete mark-read**
- Task 1 built the mark-read monotonic and under the lock, because the matrix rows needed it proven for both readers.
- Task 2's mark-read and concurrency cases therefore passed at RED. Task 2's RED targets were the window, the cap, the control characters, the mark rules and the AI-input log.

---

**Total deviations:** 4 (two Rule 2 additions, one orchestrator-directed, one ordering note).
**Impact on plan:** none widens scope. No content type changed beyond the two approved schemas.

## Issues Encountered

- **The Bash tool's heredocs.** A quoted heredoc containing apostrophes failed in the Bash tool, so script files and appended tests were written with the Write and Edit tools instead.
- **`Core.RouterConfig["routes"][number]`.** This is not a valid type in this Strapi version. The router lists its three routes literally, as the assignment router does.

## Threat Model Coverage

- **T-13-14:**
  - `canUseRequestNotes` runs in every handler, with a 404 and persistence deep-equal.
  - No core router exists. The inventory proves that no route starts with `/api/csrm-request-note`, and a live GET of both core bases answers 404.
  - The matrix rows answer `other` with 404.
- **T-13-15:** the analyst path needs `humanAnalyst`. The agent role holds no `notes_api`, and the matrix answers `serviceAgent` with 404 on Jane's request.
- **T-13-16:** a Requestor's mark gets 400 and a requesting analyst's gets 403 `OWN_REQUEST`, both proven mounted. The mark is logged.
- **T-13-17:** 5,000 characters per note, 500 notes per request counted under the lock, and pages of at most 50.
- **T-13-18:** the create and the mark-read run under `withRequestLock`. The mounted concurrency cases pass. PostgreSQL stays R-08-37's.
- **T-13-19:** control characters are refused on the server and in the composer. The web renders text only (13-10).

## User Setup Required

None. The development database gains both tables and the four link tables at the orchestrator's next Strapi start.

## Next Phase Readiness

- **13-06:** adds `PUT …/notes/{noteId}/ai_input` beside `CSRM_REQUEST_NOTE_OPERATIONS`, using `appendNoteAiInputEvent` and `NOTE_AI_INPUT_LOG_MAX_EVENTS` (409 `HISTORY_UNAVAILABLE` at the cap). It also adds `REQUEST_HAS_NOTES` and the human-only count of 15. The served-inventory test already allows a `…/ai_input` path under a note.
- **13-10:** has `listRequestNotesAction`, `addRequestNoteAction`, `markRequestNotesReadAction`, `notePartLabels`, `validateNoteDraft` and `noteRefusal`.
- **COLLAB-01** stays Pending until the phase gate (the 13-01 to 13-04 precedent). This plan proves criteria 1, 2 (the server-side unread fact) and 4 at the API.

---
*Phase: 13-request-pick-up-and-notes*
*Completed: 2026-10-09*

## Self-Check: PASSED

All 17 created files exist. All five plan commits exist: 0881afd, f544479, db1a2bc, 918d24c, ca144ca. Both catalogue copies are byte-identical. `routes/` holds only `request-notes.ts`, and no file in the notes folder contains `createCoreRouter` or `inversedBy`. `notes-service.ts` starts with `import 'server-only'`, `notes-actions.ts` with `'use server'`, and `notes-domain.ts` imports nothing from zod. The content-type freeze since ab000f6 lists exactly the three approved schema files.

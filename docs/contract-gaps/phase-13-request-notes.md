# Phase 13: Request Notes

## Gap

Once a request is submitted, neither the Requestor nor a Security Analyst has anywhere to add information to it (UAT-013). COLLAB-01 asks for attributed, append-only, plain-text notes on the request from submission onwards, a flag on new notes until they are read, and a way to feed chosen notes into the AI context.

The frozen CSRM JDL cannot hold any of it. It has no comment or activity entity, as the role-function catalogue's design note 6 records ("The JDL does not contain persisted Alert, ReportDefinition, Attachment, Comment, or Activity/Audit entities"). The two free-text attributes that look closest belong elsewhere: `CsrmQuestion.reviewComment` belongs to one question and is written by analysts only, and `CsrmRisk.comments` is a field of one Risk. Neither is a conversation between the Requestor and the analysts on the request, and neither can say who wrote what, when, or who has read it. The brief (§20, Collaboration) asks for comments, history, timestamps and actor identity, and for gaps in the data model to be recorded rather than a competing model created quietly.

`CsrmRequestNote` is therefore a new recorded concept, the glossary's "Note (request)", and it competes with no JDL entity. It is never a contest point: a contest point is Phase 17.2's challenge to an assessment under acceptance, with a target, a status and a round, and a note has none of them (G-15). Its per-person read state, `CsrmRequestNoteReadState`, has no JDL counterpart either.

## Approved Compatibility Extension

This is the only notes schema change Phase 13 proposes: two new content types. The notes section of the AI run's context summary ("Notes in the AI Context") is an envelope change and changes no schema.

```jdl
entity CsrmRequestNote {
  body TextBlob required,
  authorPart CsrmRequestNotePart required,
  sequence Integer required,
  postedAt Instant required,
  changesAiInputs Boolean required,
  aiInputLog AnyBlob
}

enum CsrmRequestNotePart { REQUESTOR, SECURITY_ANALYST }

entity CsrmRequestNoteReadState {
  lastReadAt Instant required,
  lastReadSequence Integer required
}

relationship ManyToOne {
  CsrmRequestNote{assessmentRequest} to CsrmAssessmentRequest,
  CsrmRequestNote{author} to IdamBoxUser,
  CsrmRequestNoteReadState{reader} to IdamBoxUser,
  CsrmRequestNoteReadState{assessmentRequest} to CsrmAssessmentRequest
}
```

`CsrmRequestNotePart` is stored as the Strapi enumeration values `requestor` and `security-analyst`.

Both content types live in one API folder, `apps/backend/src/api/csrm-request-note/`, with `draftAndPublish: false`:

- `api::csrm-request-note.csrm-request-note`, collection `csrm_request_notes`;
- `api::csrm-request-note.csrm-request-note-read-state`, collection `csrm_request_note_read_states`.

**The note.**

| Attribute | Strapi type | Required | Server-owned | Meaning and bound |
| --- | --- | --- | --- | --- |
| `body` | text | yes | written once, from the author's text | Plain text. Trimmed, CRLF and CR normalised to LF, 1 to 5,000 characters after trimming (JavaScript string length, so the web's schema and the server agree), no C0 control character other than tab and newline. Never rendered as HTML or Markdown, and never auto-linked. |
| `authorPart` | enumeration `requestor`, `security-analyst` | yes | yes | The author's part on the request, fixed at posting by `authorPartFor` ("Readers"). |
| `sequence` | integer | yes | yes | 1, 2, 3 … per request, with no gap or duplicate ("Write Discipline"). The thread's order, the key that "mark read through" and the unread rule compare, the list cursor, and the label the AI context gives the note. |
| `postedAt` | datetime | yes | yes | The server's clock at posting. Shown to people in their local time; never used to order the thread or decide what is unread. |
| `changesAiInputs` | boolean, default false | yes | yes | The current AI-input mark ("The AI-Input Mark"). The only mark fact the AI context and the signal read. |
| `aiInputLog` | json | no | yes | Append-only, schema-versioned history of every change of the mark, at most 200 events. Null when the mark has never been set. |
| `assessmentRequest` | relation manyToOne `api::csrm-assessment-request.csrm-assessment-request` | always set in code | yes | The request the note belongs to. |
| `author` | relation manyToOne `api::idambox-user.idambox-user` | always set in code | yes | The resolved IdamBox User who posted the note. |

**The read state.** One row per reader and request.

| Attribute | Strapi type | Required | Server-owned | Meaning and bound |
| --- | --- | --- | --- | --- |
| `lastReadSequence` | integer | yes | yes | The `sequence` of the note through which the reader has read the thread. Only ever increases. The fact the unread rule compares. |
| `lastReadAt` | datetime | yes | yes | The server's time of the last advance of `lastReadSequence`, kept for people and for Phase 17. Never compared by the unread rule. |
| `reader` | relation manyToOne `api::idambox-user.idambox-user` | always set in code | yes | The person whose read state it is. |
| `assessmentRequest` | relation manyToOne `api::csrm-assessment-request.csrm-assessment-request` | always set in code | yes | The request the thread belongs to. |

Strapi keeps every relation in a link table, `manyToOne` included. The four new link tables, computed with `@strapi/database` 5.51's identifier rules (13-RESEARCH §A). Each name is under the 55-character limit, so none is shortened and raw SQL may name them. Strapi shortens three index names of the 52-character table with a hash; it manages them, and no code names them.

| Relation | Link table | Owner column | Target column |
| --- | --- | --- | --- |
| note `assessmentRequest` | `csrm_request_notes_assessment_request_lnk` | `csrm_request_note_id` | `csrm_assessment_request_id` |
| note `author` | `csrm_request_notes_author_lnk` | `csrm_request_note_id` | `idambox_user_id` |
| read state `reader` | `csrm_request_note_read_states_reader_lnk` | `csrm_request_note_read_state_id` | `idambox_user_id` |
| read state `assessmentRequest` | `csrm_request_note_read_states_assessment_request_lnk` | `csrm_request_note_read_state_id` | `csrm_assessment_request_id` |

**No inverse attributes.** None of the four relations has an inverse (`inversedBy`) attribute, in the same way `CsrmAssessmentRequest.revertedBy` has none. `CsrmAssessmentRequest` and `IdamBoxUser` therefore gain no `notes` or `readStates` attribute: the request's `populate` (including `populate=*`) and the generated client's populate enum never reach a note or a read state, and neither existing content type changes.

**No core router.** Neither content type has a Strapi core router or core controller route. They are reachable only through the four operations below; the served-operations inventory and the authorisation matrix prove that no core route exists for them.

| Operation | Purpose |
| --- | --- |
| `GET /api/v1/assessment_requests/{requestId}/notes` | List the thread, oldest first, in pages of at most 50 notes by the `before` sequence cursor, with the viewer's unread count and `lastReadSequence`. |
| `POST /api/v1/assessment_requests/{requestId}/notes` | Add a note. |
| `POST /api/v1/assessment_requests/{requestId}/notes/read` | Mark the thread read through one note (`throughNoteId`). |
| `PUT /api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input` | Set or clear a note's AI-input mark. |

Two API-only Functions grant them, in both copies of the role-function catalogue (D-30): `function.risk_assessment_requests.notes_api` (the list, the create and the mark-read) for `role.requestor` and `role.security_analyst`, and `function.risk_assessment_requests.note_ai_input_api` (the mark) for `role.security_analyst` only, whose operation also joins `HUMAN_ANALYST_ONLY_OPERATIONS`. Neither is granted to `role.security_analyst_agent`.

**Bounds and closed reasons.**

| Bound | Value | Over the bound |
| --- | --- | --- |
| Note body | 1 to 5,000 characters after trimming and normalising | 400, nothing written |
| Notes per request | 500 | 409 `NOTES_LIMIT_REACHED`, nothing written |
| `aiInputLog` events per note | 200 | 409 `HISTORY_UNAVAILABLE` (Phase 10's code), the mark unchanged |
| Thread page | 50 notes, cursor `before=<sequence>` | Earlier notes load page by page |
| Marked notes in one AI context | 50 | `CONTEXT_TOO_LARGE` before any run or provider call, naming the marked notes |

The new closed reasons, all 409, join Phase 10's single closed list (`apps/backend/src/csrm/conflict-reasons.ts` and its web copy): `NOTES_CLOSED` ("Posting Window"), `NOTES_LIMIT_REACHED` (above) and `REQUEST_HAS_NOTES` ("Write Discipline"). `OWN_REQUEST` (403) is the assignment record's reason, reused here ("The AI-Input Mark").

## Write Discipline

**Append-only.** There is no edit operation and no delete operation for a note, for anyone. Once posted, a note's `body`, `authorPart`, `sequence`, `postedAt`, `author` and `assessmentRequest` never change. The only attribute that changes after posting is the mark, and each change of it is appended to `aiInputLog`. No code path removes, reorders or rewrites an earlier note or an earlier log event. A read state is never deleted.

**Under the request lock.** Every note write, mark-read and AI-input change runs inside `withRequestLock`, the one per-request lock module that the assignment record (`docs/contract-gaps/phase-13-request-assignment.md`, "Write Discipline") extracts from the Phase 06.1 revert: an in-process promise tail per request, then a transaction that takes `SELECT … FOR UPDATE` on the request row before reading anything it decides on. The revert, assignment, notes, mark-read and AI-input paths share the one lock, and it is never nested for one request. Under it:

- **`sequence`** is the request's highest note `sequence` plus one (1 for the first note), read after the lock, so concurrent posts get 1, 2, 3 … with no gap and no duplicate;
- **the 500-note cap is exact**: the count is read after the lock, so two concurrent posts can never make 501;
- **the read state stays one row per reader and request**: the mark-read finds the reader's row for the request, then creates it or updates it, under the lock. A pair of relations cannot carry a database unique constraint, so the lock is what keeps the row single, and a test proves that two concurrent mark-reads leave one row;
- **the AI-input change** reads the current mark and the log after the lock, so two analysts toggling at once append two ordered events and leave the mark the log ends on.

`postedAt` and `sequence` are the server's: a create that carries either, or any key the create does not declare, is refused (400).

**No orphans.** A request that holds a note cannot be deleted. The analyst-only, API-only core delete (`DELETE /api/csrm-assessment-requests/{id}`) takes the same request lock, counts the request's notes after it, and refuses with 409 `REQUEST_HAS_NOTES` when there is at least one, deleting nothing. A create that took the lock first makes the count non-zero; a create waiting behind a delete finds the request gone and answers 404. So no note ever references a deleted request.

**Retention.** Notes and read states follow the request's retention. No CSRM workflow deletes either.

## Posting Window

One predicate, `acceptsNotes`, decides whether a request takes a new note. It is true exactly for the reviewable statuses `submitted`, `questionnaire-in-progress`, `risk-assessment-drafted` and `under-review` (`REVIEWABLE_REQUEST_STATUSES`): from the request's first submission until its assessment is released or the request is closed.

- **A draft takes no new note**, whether it was never submitted or was returned to draft by the Phase 06.1 revert. The Requestor edits the draft itself, and analysts do not work on drafts. Notes already on a returned draft stay readable through the list.
- **A released or closed request is read-only**: `approved`, and `closed` from Phase 17.1 (G-13). The thread is part of the released record, and information after release belongs to the Risk Register's treatment progress (Phase 20).
- **The refusal** is 409 `NOTES_CLOSED`, with nothing written. The list tells the web whether the thread accepts notes and why not, so the composer is replaced by the reason.
- **Cancellation**: CSRM has none (`CsrmRequestStatus` holds no cancelled value). A future withdrawal state closes notes through this predicate.
- **New statuses**: a status that Phase 17 or 17.1 adds before closure joins the predicate. No second window check exists anywhere.

## Readers

One predicate, `canUseRequestNotes`, decides who may use a request's notes. It is separate from the request read, so a later widening of the request read (Phase 17's participant read of the request summary) never reaches notes. It holds for:

- **the request's requestor**, through either grant (the Requestor birthright, or the Security Analyst role on a request they raised);
- **any human Security Analyst**: an active user who holds the notes operation through the human Security Analyst role. Every human analyst may read every submitted request, so every human analyst may use its notes.

**Everyone else gets the refusal a missing record gets: 404, on every notes route, with persistence unchanged.** That covers another Requestor, a participant who is not the requestor (a nominated risk owner or an executive approver from Phase 17), the Security Analyst Agent on another person's request (its role holds no notes Function, and its Requestor birthright reaches only requests it raised), and anyone naming a missing request or a note that is not on the named request. The answer and its message are the same for each, so a caller cannot tell a request they may not read from one that does not exist. The rule is decided in Strapi against the resolved IdamBox User, after the Role → Function → FunctionAPI check, and never branches on the auth mode. G-12 is confirmed: participants never read notes, and widening `canUseRequestNotes` later needs its own decision.

**The author's part.** `authorPartFor(request, caller)` fixes the note's `authorPart` at posting: `requestor` when the caller is the request's requestor, otherwise `security-analyst`. A Security Analyst who raised the request therefore writes in the `requestor` part on it (G-1, as the assignment record reads it). G-11's "in a note" (a different risk owner proposed in a note) is the Requestor's path only.

**People.** A note's author crosses the API as `documentId` and `displayName` only, with the note's part: never email, username, names, account status, external subject or roles (D-04).

## Read State

The read state is personal. It is never shown to anyone but its reader, and no projection says who has read a note (no read receipts).

**The unread rule, by sequence.** `isUnreadNote(note, viewer)` holds when the note:

- was written in the other part (for the requestor, by a Security Analyst; for an analyst, by the requestor);
- was not written by the viewer;
- has a `sequence` above the viewer's `lastReadSequence` for the request, which is 0 when the viewer has no read state.

**Unread is computed from `sequence`, never from post times.** Two notes posted in the same millisecond, or a server clock that steps back, cannot hide a note or mark it read: `sequence` is assigned under the request lock and only increases. `postedAt` and `lastReadAt` are never compared by the rule.

**Marking read.** The read state advances only through `POST /api/v1/assessment_requests/{requestId}/notes/read`, which names the note through which the viewer has read the thread (`throughNoteId`, a note on the same request). Under the request lock it sets `lastReadSequence` to that note's `sequence` when that is higher, and `lastReadAt` to the server's time of the advance. It is monotonic: a call naming an earlier note changes nothing and succeeds. No GET has a side effect: listing the thread, reading the request or loading a queue never marks anything read. The web calls the operation once the thread has been shown, and its "New" markers stay for that view.

The same rule feeds every count: the request read's notes summary, the analyst queue's unread count and `notes=unread` filter, My requests and its status summary, and the dashboard figures. The SQL takes the viewer's part from the requestor link and compares `sequence` with `COALESCE(last_read_sequence, 0)` in one grouped query per page (13-RESEARCH, "Unread SQL").

## The AI-Input Mark

`changesAiInputs` records a Security Analyst's decision that a note changes what the AI should use (G-3 data minimisation; decision 2's pattern, where the analyst opts each supplementary input in and the default is off).

- **Who sets it.** A human Security Analyst, when posting their own note (off by default), or later on any note, the Requestor's included, through `PUT /api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input`. The operation is human Security Analyst only twice: its Function is granted to `role.security_analyst` only, and it is in `HUMAN_ANALYST_ONLY_OPERATIONS`. The mark set when posting is guarded the same way (code review WR-101 and WR-102, 2026-10-09): the policy records `canMarkNoteAiInputs`, the mark operation's own grant through the human Security Analyst role held by an eligible person (never a holder of the Security Analyst Agent role), and a create that carries `changesAiInputs` from any other analyst is refused with 403 and nothing written. The notes grant alone never sets the mark, and `meta.canMarkAiInputs` is derived from the same fact.
- **Not on their own request.** A Security Analyst who raised the request cannot set or change a mark on it, when posting or later: 403 with the closed reason `OWN_REQUEST`, as the assignment record defines it (an identity-relative refusal, which stays in the 403 family).
- **Never the Requestor.** The Requestor never sets the mark and never sees it: the Requestor's projection of a note carries no mark, and a Requestor's create that carries `changesAiInputs` is refused with 400, nothing written. A Requestor calling the mark operation has no grant (403).
- **The log.** Each change of the mark appends one event to `aiInputLog`, in the same transaction as the change: `{ schemaVersion: 1, by, at, from, to }`, where `by` is the analyst's IdamBox User documentId, `at` the server's time, and `from` and `to` the booleans before and after. A note posted with the mark set records it as its first event (`from: false`, `to: true`, by the author, at `postedAt`). Setting the mark to the value it already has is a no-op that succeeds and writes no event. Undo is a second change. The log holds at most 200 events; at the cap the change is refused with 409 `HISTORY_UNAVAILABLE` and nothing is written, so the mark never changes without its audit record.
- **The 06.8 posture.** The log is append-only, parsed closed (unknown keys and versions are invalid) and fails safe: a malformed log projects as "history unavailable" and never denies the read of the note. Whether a note is marked is read from `changesAiInputs` alone, never derived from the log, so a damaged history can never add a note to the AI context or remove one from it.
- **The window.** The mark changes only while `acceptsNotes` holds. Once the request is released or closed the mark is frozen with the record, and a change is refused with 409 `NOTES_CLOSED`; on a request returned to draft it waits for resubmission with the same refusal.

## Notes in the AI Context

This is Phase 12's extension point (Phase 12 D-08), built here.

**What the AI reads.** Exactly the notes of the request currently marked (`changesAiInputs` true), in `sequence` order. An unmarked note never reaches a provider. Each marked note goes into its own delimited block inside the untrusted Requestor data section, whoever wrote it, because an analyst's note can quote the Requestor. Each block is labelled by part and sequence with code constants and server integers only. The prompt carries no author name, no time, no documentId and no request number (Phase 12 D-04); the note text is sent whole (06.7 D-10) and escaped as data.

**The same policy and bounds.** The same classification check applies. More than 50 marked notes, or a context over the operation's budget (`CONTEXT_BOUNDS`: 100,000 characters for the questionnaire, 200,000 for the draft), fails before any run is created and before any provider call with `CONTEXT_TOO_LARGE`, and its message names the marked notes by sequence so the analyst can unmark some. Every operation built on the context builder includes the marked notes: Phase 12's questionnaire and draft generation now, then Phase 15's questionnaire proposals, Phase 16's re-runs and Phase 17's residual reassessment.

**The context summary v2.** The run record's `CsrmAiRun.contextSummary` (Phase 12's record, `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, "Envelopes") gains a new envelope version, not a schema change. A v2 summary carries every v1 field with `schemaVersion: 2`, plus:

```text
notes: {
  included: [{ documentId, part, sequence, postedAt, characters }],
  marked: <number of notes marked when the context was built>,
  bound: 50
}
```

Each included note is named by its documentId, its part, its `sequence`, its `postedAt` and its character count, never its text (G-3). `postedAt` is kept so that the analyst's "What the AI used" sheet can show the note's time and link to it in the thread without its text. The closed parser (`parseContextSummary`) accepts v1 and v2 and fails safe to null on anything else; a v1 summary, written before this phase, reads as "included none". The 64 KB summary bound (`CONTEXT_BOUNDS.summaryBytes`, WR-104) still applies; 50 included notes add about 6 KB.

**The "AI inputs changed" signal.** Per target (the questionnaire, and the assessment), the notes whose current mark differs from what the target's latest completed context-wide run included: marked now but not included, or included but since unmarked. It is the set difference, in both directions, between the documentIds of the currently marked notes and the run's `contextSummary.notes.included`, with a v1 summary counting as "included none".

- **Context-wide runs**: today questionnaire generation and draft generation. Phase 15's questionnaire proposals and Phase 16's "Suggest more risks" declare themselves context-wide; risk-scoped runs include the marked notes but never clear the signal.
- **The baseline run** is the one the target's read already names as its `generation.runId`.
  - *Amended 2026-10-11 (Phase 15), approved by the pilot under G-6 with the Phase 15 amendment to `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` (its "Affected Workstreams", item 6):* for the questionnaire, the baseline is the questionnaire's newest completed `questionnaire-generation` or `questionnaire-proposals` run, so a completed proposal run clears the signal and a rewrite never does. `generation.runId` still names the latest completed generation run (Phase 15 D-27). The assessment's baseline is unchanged.
  - *Amended 2026-10-15 (Phase 16), under G-6:* for the assessment, the baseline is its newest completed assessment-draft or risk-suggestions run; the rule and its approval status are in "Phase 16 amendment (2026-10-15): the assessment's AI-inputs baseline" below.
- **The `generatedDate` fallback.** A record generated before Phase 12 has no run. Its baseline is its `generatedDate`: a currently marked note counts when its latest event setting the mark to `true` in `aiInputLog` is after that date (plan 13-17). This is the one place the signal reads the log, and only for that time; whether the note is marked still comes from `changesAiInputs`. If a currently marked note's `aiInputLog` cannot be parsed, or holds no event that set the mark to `true`, the fallback counts the note as changed since generation. The signal is advisory and analyst-only: it gates nothing and never decides what reaches a provider. So it fails toward showing the analyst an input that may have changed, because missing a changed input is the riskier failure (orchestrator decision, 2026-10-09; plan 13-17 implements it).
- **No baseline, no signal**: with no completed run and no `generatedDate`, there is no signal.
- **A marked note the signal cannot name** (code review IN-103, 2026-10-09): one with no documentId, an unknown part, no positive `sequence` or no readable `postedAt` fails the read with the context loader's own error ("CSRM request note is invalid."). It is never left out of the signal, because the next generation refuses the same row and the two would then disagree about it.
- **Analysts only.** The signal is served on the analyst's request read and in the `generation` block of the analyst's questionnaire and assessment reads. A Requestor never sees it. This phase offers no re-run action; Phases 15 and 16 attach theirs.

## What This Extension Does Not Add

- **No edit and no delete** of a note, for anyone, by any route.
- **No internal notes.** Every note is visible to the requestor and every human Security Analyst; there is no analyst-only thread.
- **No targets, statuses or rounds.** A note is about the request as a whole; it is not a contest point (G-15) and not a comment on a question, Risk or field (COLLAB-03, future).
- **No mentions** and **no read receipts.**
- **No attachments.** Files, including a file posted with a note, are Phase 14's.
- **No reach for participants.** Nominated risk owners and executive approvers read Phase 17's request summary, never notes (G-12).
- **No note in any export or print report** (Phase 19).
- **No notification.** Phase 19.1's notification centre (G-19) sends "new notes" (`note-added`) from these facts (decision 18).
- **No change to an existing content type.** `CsrmAssessmentRequest` and `IdamBoxUser` gain no attribute, and no enumeration gains a value.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-09 that section's workstream table lists one workstream, `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmAssessmentRequest` and the only caller of the notes operations. This extension is backward compatible for any later reader:

- the two tables (and their four link tables) are new, with no core router and no inverse attribute on `CsrmAssessmentRequest` or `IdamBoxUser`, so no existing read, `populate` (including `populate=*`) or generated populate enum reaches them;
- no existing attribute, relation, enumeration value or grant changes;
- the two new Functions, `function.risk_assessment_requests.notes_api` (for `role.requestor` and `role.security_analyst`) and `function.risk_assessment_requests.note_ai_input_api` (for `role.security_analyst`), are additive (D-30), and neither is granted to `role.security_analyst_agent`. They are the same two the assignment record names beside its own `assignment_api`.

The notes also change existing endpoints. Each change concerns only the `csrm` workstream's application, and each is in a `csrm` plan:

- **The request delete's new refusal.** `DELETE /api/csrm-assessment-requests/{id}` answers 409 `REQUEST_HAS_NOTES` for a request that holds a note (D-21, plan 13-06). It is the only new refusal on an existing endpoint, and it refuses only a request that holds a note: every delete that succeeds today still succeeds until a note exists, and only this phase's notes create one.
- **Additive fields.** The request read gains the viewer's notes summary (D-24) and, for human analysts, the AI-inputs-changed signal per target (D-29); the review queue, My requests, its status summary and the dashboard summary gain unread counts and a `notes=unread` filter (D-24); the analyst questionnaire and assessment reads gain the signal in their `generation` block (D-29). No existing field changes meaning, and none is removed.
- **The AI run read's context summary.** `GET /api/v1/ai_runs/{runId}` serves the v2 notes section as a new envelope version beside v1, which still parses and reads as "included none", within the existing summary bound `CONTEXT_BOUNDS.summaryBytes` (65,536 bytes, `apps/backend/src/csrm/ai/assessment-context.ts`, WR-104) (D-28). The read stays human Security Analyst only.

The assignment's changes to existing endpoints are recorded in `docs/contract-gaps/phase-13-request-assignment.md`.

## Migration

The extension is additive. Strapi schema sync creates the two tables and the four link tables; no migration file accompanies it, following the Phase 06.1, 06.7, 06.8 and Phase 12 precedent, and `apps/backend/database/migrations/` stays empty. Proof requires:

- a fresh test database, with legacy requests reading as having no notes and an empty notes summary;
- `PRAGMA table_info` on `csrm_request_notes`, listing `body`, `author_part`, `sequence`, `posted_at`, `changes_ai_inputs` and `ai_input_log`, and on `csrm_request_note_read_states`, listing `last_read_at` and `last_read_sequence`, with the four link tables present;
- the development database showing both tables and the four link tables after the orchestrator's next Strapi start;
- the content-type freeze check since `PHASE_13_BASE` listing exactly the approved schema files.

## Audit Semantics and Limitation

The thread is part of the request record: the information on which the assessment's context was established (ISO/IEC 27005 context establishment), kept for as long as the request. That is why it is append-only and closes at release.

`aiInputLog` is the history and `changesAiInputs` the current fact, the split the 06.8 record makes between `governanceLog` and the release facts: the current fact is what the AI context and the signal read; the history says who changed it and when, and is never consulted to decide what reaches a provider. The log is scoped to one note and readable only through the notes operations; no unscoped history endpoint is introduced, and a cross-aggregate audit store stays out of scope.

A note posted in error cannot be removed by this extension. Redacting one is a later, audited Admin action that needs its own decision; until then, a correction is a further note.

The concurrency proofs (sequence assignment, the exact cap, one read-state row, the delete against a create) run on SQLite, where knex's single connection serialises the transaction and the lock statement compiles to a plain `SELECT`. They prove the serialised outcome, not the lock (code review WR-201, 2026-10-09): the lock's in-process tail is proven in `request-lock.unit.test.ts`. PostgreSQL's row lock stays unproven until R-08-37 runs the Strapi suites on PostgreSQL; its checklist gains the constructs this extension relies on: `FOR UPDATE` before the reads of the highest `sequence`, the note count and the read state, and queries inside the lock bound to the transaction (Document Service and query-builder calls through Strapi's async context; raw knex through `.transacting(trx)`).

## Later Phases

- **Phase 14** may link an attachment to the note it was posted with, and adds files to the AI-inputs-changed signal on the same rule (the analyst opts each one in).
- **Phases 15 and 16** read the marked notes through the context builder and the signal to offer re-runs, and declare each new AI operation context-wide or risk-scoped.
- **Phase 19.1**'s notification centre (G-19) sends "new notes" within these readers only, and keeps its own per-notification read state; it may mark a "new note" notification read once the person's `lastReadSequence` passes the note (D-12, D-24; 19.1-CONTEXT D-22).
- **Phase 17.1**'s `closed` status closes the posting window through `acceptsNotes`.
- **Phase 17.2**'s contest replies reuse the thread pattern, but they are not notes and are not stored as notes.

None needs another notes schema change.

## Approval

Status: **approved by the pilot on 2026-10-09** (G-6), for the two content types exactly as the "Compatibility Extension" section states them.

What the pilot checked:

- **JDL** (`docs/references/idambox-datamodel.jdl`) **and the catalogue's design note 6**: the JDL has no comment or activity entity. `CsrmQuestion.reviewComment` and `CsrmRisk.comments` are fields of one record, not a conversation on the request. `CsrmRequestNote` and `CsrmRequestNoteReadState` are recorded concepts that compete with no JDL entity. Neither has an inverse attribute, so `CsrmAssessmentRequest` and `IdamBoxUser` do not change.
- **API contract** (`docs/references/specification.json`): four additive operations and no core router. The changes to existing endpoints are `REQUEST_HAS_NOTES` on the request delete (refusing only a request that holds a note), additive fields, and the v2 context-summary envelope beside v1. Only `csrm` reads them, and the new closed reasons join Phase 10's single list.
- **Role-function catalogue**: `notes_api` is granted to `role.requestor` and `role.security_analyst`, and `note_ai_input_api` to `role.security_analyst` only, which is also human-analyst-only. Neither is granted to `role.security_analyst_agent`.
- **AGENTS.md**:
  - one reader rule enforced in Strapi against the resolved IdamBox User, separate from the request read, with the refusal a missing record gets for everyone else, so another Requestor never reaches a note;
  - no branching on the auth mode;
  - people cross the API as `documentId` and `displayName` only.
- **Glossary "Note (request)", G-12 and G-15**: participants never read notes, and a note is never a contest point.
- **AI data policy (G-3, decision 5)**:
  - only analyst-marked notes reach a provider, each as a delimited, untrusted block labelled by code constants;
  - the classification check and bounds apply before any run or provider call;
  - the run summary names notes and never stores their text (consistent with Phase 12's WR-105);
  - the AI-inputs-changed signal is advisory and analyst-only.
- **Audit**:
  - append-only notes and a fail-safe mark history, with no edit and no delete;
  - sequence-based unread, so clock skew cannot hide a note;
  - one lock module for every request-scoped write;
  - PostgreSQL locking carried to R-08-37.

Pilot correction made with this approval: the notification references now name Phase 19.1, which G-19 gave the centre and the "new notes" event. They had read Phase 17. Phase 13 still sends nothing.

## Phase 16 amendment (2026-10-15): the assessment's AI-inputs baseline

Decided by the pilot's ruling of 2026-10-15 (16-CONTEXT D-28; 16-PLAN-CHECK iteration 2, B5) and written on 2026-10-15 by plan 16-01, before any code changes the baseline. It amends "Notes in the AI Context", "The baseline run", for the assessment only. It is not a content-type change: no attribute, relation or enumeration changes, and no stored record is rewritten.

- **The new baseline.** For the assessment, the baseline of the "AI inputs changed" signal is its newest completed `assessment-draft` or `risk-suggestions` run: the completed runs of either operation whose `assessment` relation names the assessment, the newest `completedAt` first, then the newest id. With no such run, it falls back to the run the assessment's `aiProvenance` names, and then to the `generatedDate` fallback above, so every assessment without a completed `risk-suggestions` run reads exactly as today.
- **Why.** A completed "Suggest more risks" run consumed the current marked notes and included attachments, so it legitimately resets the signal: the rule the Phase 15 amendment applied to the questionnaire, whose baseline is its newest completed `questionnaire-generation` or `questionnaire-proposals` run.
- **A rewrite never moves it.** A "Rewrite this risk" run (`risk-rewrite`) targets one Risk and is never context-wide, so it never moves the baseline and never clears the signal.
- **`generation.runId` is unchanged.** It still names the draft run.
- **What it changes.** The Phase 15 sub-bullet's "The assessment's baseline is unchanged" no longer holds from this amendment. That sub-bullet stays verbatim as approved history, and a pointer sub-bullet under "The baseline run" points here.

The `risk-suggestions` operation is context-wide for the assessment and joins `CONTEXT_WIDE_AI_OPERATIONS` (`apps/backend/src/csrm/ai/ai-inputs-signal.ts`), as this record's "Context-wide runs" bullet anticipated; its run is recorded in `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, "Phase 16 amendment (2026-10-01): risk proposals, decisions and per-field run references". The signal stays advisory and analyst-only: it gates nothing and never decides what reaches a provider.

### Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-15 that section's workstream table lists `csrm` and `iam`. `csrm`, whose application is `apps/csrm`, is the only reader of the signal. `iam` reads none of it: on 2026-10-15, `grep -rlE "csrm-risk|CsrmRisk|risk_assessments|assessment_requests|csrm-assessment-request|AiRun|ai_runs|ai_proposal|/v1/risks|REQUEST_HAS|aiInputsChanged|contextSummary" .planning/workstreams/iam/` printed nothing (exit status 1).

It changes the value, not the shape, served by two existing endpoints:

- **The analyst assessment read** (`GET /api/v1/risk_assessments/{assessmentId}`): `generation.aiInputsChanged`.
- **The request read** (`GET /api/csrm-assessment-requests/{id}`): the assessment target in `RequestAiInputs`.

Both stay backward compatible: the shape of `AiInputsChanged` is unchanged; the value is identical for every assessment without a completed `risk-suggestions` run, which only a Phase 16 operation creates; and only an analyst-facing advisory signal that gates nothing changes meaning. No grant changes.

Phase 16 amendment status: **approved by the pilot on 2026-10-15** (G-6).

What the pilot checked (2026-10-15): the text against the frozen JDL (`docs/references/idambox-datamodel.jdl`: `CsrmRisk`, `CsrmAssessment`, `IdamBoxUser`, `CsrmTreatmentAction`; no competing entity or status, `closureDate` and `treatmentStatus` keep their meanings), `docs/references/specification.json` and the role-function catalogue (every new Function granted to `role.security_analyst` only, no existing grant changed), AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; AI output is advisory and never accepts, releases or closes; JDL terminology; no hard delete; the released record stays immutable), 16-CONTEXT and the 2026-10-15 fresh plan check (iterations 2 to 4), and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section names `csrm` as the only reader, the `iam` grep is empty, and every changed endpoint stays backward compatible for existing callers. The pilot's ruling of 2026-10-15 is recorded as written: a completed `risk-suggestions` run moves the assessment's baseline, a `risk-rewrite` run never does, and the signal stays advisory and analyst-only.

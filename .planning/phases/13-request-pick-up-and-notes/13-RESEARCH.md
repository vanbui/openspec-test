# Phase 13: Request pick-up and notes - Research

**Researched:** 2026-10-01
**Domain:** Strapi 5.51 record-level authorisation, per-request serialisation, additive content types with raw-SQL queue predicates, the in-process generation-job registries, and Next.js (App Router) typed Server Actions
**Confidence:** HIGH for the code facts and the six open items below. MEDIUM for PostgreSQL behaviour, which is by construction only (R-08-37).

**Written ahead.** This research reads today's code (`5a12215` on `post-demo`) plus the planned outputs of Phase 10 (23 plans), Phase 11 (CONTEXT, UI-SPEC, RESEARCH, PATTERNS, plans 11-01 to 11-10 so far) and Phase 12 (CONTEXT, RESEARCH, UI-SPEC, PATTERNS). Stage 3 re-runs the plan check before execution, because those phases change the files this phase edits.

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied verbatim from `13-CONTEXT.md`, with headings demoted one level. The context's operator-decisions table, contract-gap records, authorisation model and seams bind the planner equally; read them there.

### Locked Decisions

#### Scope and contract boundary

- **D-01:** The only content-type changes, each through its own contract-gap record approved at a checkpoint before any schema file changes (G-6; see Contract-Gap Records below):
  1. `docs/contract-gaps/phase-13-request-assignment.md`: `CsrmAssessmentRequest` gains four optional attributes: `assignedAnalyst` (many-to-one `IdamBoxUser`), `assignedAt` (datetime), `assignedBy` (many-to-one `IdamBoxUser`) and `assignmentLog` (json, append-only, schema-versioned). Existing requests stay valid and read as unassigned.
  2. `docs/contract-gaps/phase-13-request-notes.md`: two new content types. `CsrmRequestNote` holds a plain-text `body`, an `authorPart` (`requestor` or `security-analyst`), a server-owned `postedAt`, the `changesAiInputs` mark and its append-only `aiInputLog`, with many-to-one relations to the `assessmentRequest` and the `author`. `CsrmRequestNoteReadState` holds `lastReadAt`, with many-to-one relations to the `reader` and the `assessmentRequest`, one per person and request. The record also states the notes section that Phase 12's `CsrmAiRun.contextSummary` envelope gains (D-28), which is not a schema change.

  The names are proposals in JDL style; the records fix them. Nothing else in the schema changes. **Reversibility:** one-way - new tables and new request columns holding audit facts; undoing them needs a data migration.
- **D-02:** Every new or changed endpoint follows the established chain (Phase 12 D-02): exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical; record-level checks in Strapi against the resolved IdamBox User, never branching on the auth mode; the operation and schemas in `docs/references/specification.json`, then `api:generate` and a clean `api:check`; closed parsers registered in the contract parity guard; a row in the six-actor authorization matrix; `docs/references/served-operations.json` regenerated with the dev servers stopped. The server shape and its web parser change in the same plan. The two new content types get no Strapi core router: they are reachable only through the operations below, and the inventory and the matrix prove that no core route exists for them.
- **D-03:** The API changes are these, and no others:
  1. **One assignment operation,** `PUT /api/v1/assessment_requests/{requestId}/assignee`: pick up, assign, reassign and unassign (D-05).
  2. **One eligible-analyst read,** `GET /api/v1/assessment_requests/{requestId}/assignable_analysts` (D-06).
  3. **Notes:** `GET` and `POST /api/v1/assessment_requests/{requestId}/notes` (D-21 to D-23), and `POST /api/v1/assessment_requests/{requestId}/notes/read`, which marks the thread read through one note (D-24).
  4. **The AI-input mark,** `PUT /api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input` (D-26).
  5. **The request read** gains the assignment projection, the viewer's notes summary and, for analysts, the AI-input signal (D-09, D-16, D-17, D-24, D-29).
  6. **The review queue** (`GET /v1/assessment_requests`) gains the `open` bucket, the `assignee` and `notes` filters, and three item fields (D-13).
  7. **My requests** (`GET /v1/my_requests`, served by Phase 11) items gain the assignee's display name and the unread note count, the list gains the `notes` filter, and the status summary gains the count of requests with unread notes (D-17, D-24).
  8. **The dashboard summary's** review queue gains per-viewer counts (D-15).
  9. **The analyst questionnaire and assessment reads:** their request summary gains the assignee, and their Phase 12 `generation` block gains the AI-input signal (D-16, D-29).
  10. **Generation jobs:** the by-id reads and retries and Phase 10's generation-jobs read change their access rule, `canRetry`, the initiator's display name and the identifier bounds (D-18). No grant changes.
  11. **The AI run read's** context summary gains the notes section (D-28).
  12. **Closed conflict reasons** join Phase 10's list (D-05 to D-08, D-10, D-21, D-22).
  13. **Two refusals on existing operations:** deleting a request that holds a note (D-21), and the analyst branch of the request update submitting a request the analyst did not raise (D-20).

  **Reversibility:** costly - published operations, fields, filters and error codes.
- **D-04:** People are server projections. The assignee, the assigner, note authors and the actors in the assignment history are projected by Strapi as `documentId` and `displayName` only (the Requestor gets the assignee's display name alone), never email, username, external subject or roles. None of these relations can be populated through a caller's `populate`: the request read's caller populate excludes every IdamBox User relation. `IdamBoxUser.email` is not a private attribute, so research checks what today's `populate=revertedBy` on the request read returns; if it carries more than the display name and id, the plan that adds the assignee projection projects `revertedBy` the same way.

#### The assignment model (REQ-08; decision 10; G-1; UAT-014)

- **D-05:** One accountable assignee per request (decision 10, REQ-08 criterion 4).
  - **The current fact** is `assignedAnalyst`: one Security Analyst, or nobody.
  - **One operation** changes it. The body names the new analyst (or `null`) and the assignee the caller last saw (`expectedAnalyst`, or `null`), with an optional plain-text reason of at most 500 characters. The server derives the action: **pick up** (yourself, when unassigned), **assign** (another analyst, when unassigned), **reassign** (from one analyst to another, yourself included) and **unassign** (back to the queue).
  - **No silent overwrite:** when the current assignee differs from `expectedAnalyst`, the operation is refused with `ASSIGNMENT_CHANGED` and the current assignee, so two analysts picking up at once never overwrite each other.
  - **Who:** any eligible human Security Analyst may take any of the four actions on any request they may act on (decision 10: "any Security Analyst assigns"). There is no lead role.
  - **Editing stays non-exclusive:** no questionnaire, assessment, Risk or control mutation checks the assignment. The assigned-analyst steps of Phase 17.1 are the only exception (D-10).
  - **Reversible:** each change gives an Undo toast (G-4; Phase 12's X-14), and undoing is a second recorded change. No change needs a confirmation dialog.

  The product never calls unassigning "release": "Released" names the assessment's state (root `CONTEXT.md`, decision 16). The UI-SPEC words the action ("Unassign" or "Return to queue").
- **D-06:** Who can be assigned: one eligibility predicate in one module.
  - An eligible assignee is an active IdamBox User who holds the human Security Analyst role and its analyst grants, does not hold the Security Analyst Agent role (G-1: a service identity is never assignable, as G-11 and G-17 also exclude it), and did not raise the request.
  - **Later phases extend the same predicate:** Phase 17 adds "is not a nominated risk owner or a named executive approver of the request's assessment" (G-11). Phase 22's Admin, who holds no analyst grants by default (decision 1), is never eligible.
  - **The eligible-analyst read** returns exactly this set for the request: `documentId` and `displayName`, searchable by name, bounded. A picker therefore never offers a person the operation would refuse. Naming anyone else (an inactive user, a Requestor-only user, the service agent, the request's own requestor) is refused with `ASSIGNEE_NOT_ELIGIBLE`.
- **D-07:** G-1 for the acting analyst. On a request they raised, an analyst is its Requestor for every control this phase adds:
  - they take no assignment action on it: they cannot pick it up, assign it, reassign it or unassign it, whoever the target, and they cannot read its eligible-analyst list;
  - they cannot change a note's AI-input mark on it (D-26), and their own notes are written in the Requestor's part (D-23).

  The refusal carries the closed reason `OWN_REQUEST` with actor-neutral copy, and the UI offers them none of these controls on that request and says that another Security Analyst picks it up. This is a reading of G-1: choosing one's own assessor, or steering the AI inputs of one's own request, is the conflict G-1 removes. G-1 does not stop them contributing edits; Phase 17.1 adds its review, approval and release rules.
- **D-08:** When the assignment can change.
  - **Only on a submitted request.** A draft is refused with `REQUEST_NOT_SUBMITTED`: it is not in the analysts' scope.
  - **A return to draft (06.1)** keeps the assignment as it is, and nobody changes it while the request is a draft, so the same analyst stays accountable when the request is resubmitted.
  - **Before release** (statuses `submitted`, `questionnaire-in-progress`, `risk-assessment-drafted` and `under-review`) every action is allowed.
  - **After release** (`approved`, and `closed` from Phase 17.1) the request can be reassigned but not unassigned (`ASSIGNMENT_REQUIRED`). Monitoring after release reaches the assigned analyst (G-16's escalations, NOTIFY-02's reminders), so released work never loses its accountable analyst. A request released before this phase has no assignee and can be picked up or assigned.
  - **Phases 17 and 17.1 widen "reassign only"** to the stages where participants wait on the analyst (D-11).
- **D-09:** The history.
  - **One event per change.** Every change appends one event to `assignmentLog`: the schema version, the action (pick up, assign, reassign or unassign), who, when, from, to and the optional reason. It is written in the same transaction as the current facts `assignedAnalyst`, `assignedAt` and `assignedBy`.
  - **Serialised per request,** with the row lock and the in-process tail that the request revert already uses (`request-workflow.ts` `serializeRequestRevert` and `lockRequest`).
  - **The 06.8 posture:** the log is append-only, read through a closed parser that fails safe, bounded by a generous cap that research sets, and never read by an authorisation decision. Gates read `assignedAnalyst` only.
  - **Who sees what:** analysts see the current assignee with who assigned them and when, and the history (who, when, from, to and reason) on the request page. The Requestor sees only the current assignee's display name.
- **D-10:** "The assigned analyst": one server-side predicate for later phases.
  - **The rule:** `assertAssignedAnalyst(request, caller)` holds when the caller is the request's current `assignedAnalyst`, is still eligible under D-06 at the moment of use (active, the human role, not the requestor, and from Phase 17 not a risk owner or executive approver), and reaches the operation through the human Security Analyst grant.
  - **Its refusals** carry closed reasons: `REQUEST_UNASSIGNED` when nobody is assigned (the UI offers Pick up to an eligible viewer), and `NOT_ASSIGNED_ANALYST` when someone else is (the UI names them).
  - **In Phase 13** the predicate is built and unit-tested, and gates nothing new: the v1 release stays open to any human analyst until Phase 17.1 replaces it (G-13), and editing stays non-exclusive.
  - **Phase 17.1** uses it for Mark reviewed (decision 17: "the assigned analyst marks the assessment reviewed"), Submit final assessment, recall, and release and close (G-13; ASSESS-24 criterion 5; ASSESS-25 criterion 4).
- **D-11:** What an unassigned request means for later steps.
  - **Reserved steps are refused.** Every step reserved to the assigned analyst is refused until an eligible analyst picks the request up. That is 17.1's list (D-10), plus Phase 17's release for response if Phase 17 reserves it; reserving it is recommended, because it decides who sees the assessment.
  - **No unassigning once participants wait.** From the first release for response (Phase 17), and while an acceptance round is open (Phase 17.1), the request can be reassigned but not left unassigned. Participants' events go to the assigned analyst (G-18: the response submitted, decisions recorded, contest points raised). Phases 17 and 17.1 add those states to D-08's rule.
  - **Events for "the assigned analyst"** (G-16, G-18, NOTIFY-02) go to the current assignee. For requests released before this phase, which have none, Phase 20 decides the fallback; the releasing analyst (`approvedBy`) is the suggested default. This phase backfills nothing.
  - **A reassignment after Mark reviewed** is 17.1's to settle. The recommendation is that submission needs a review by the current assignee.
- **D-12:** This phase records; Phase 17 notifies. Decision 18's "assignment" event is Phase 17's: its centre tells an analyst when someone else assigns a request to them, reading the assignment history, never for picking up oneself and never to the service agent. This phase sends nothing.

#### Where the assignee shows (REQ-08 criteria 1 and 2; Phase 11's seams)

- **D-13:** The review queue contract.
  - **A new bucket, `open`:** every submitted request not yet released, at any step.
  - **`filters[assignee]`:** `me` or `unassigned` (absent means anyone). It is orthogonal to the lifecycle bucket, so "my work by stage" (`REPORT.md` §4) is any bucket intersected with `me`. There is no filter by a named analyst (deferred).
  - **`filters[notes]=unread`** (D-24).
  - **Each item gains** the assignee (`documentId` and `displayName`, or `null`), whether the viewer may pick it up, and the viewer's unread note count.
  - **`requires-attention` keeps its value,** and its label drops "my", because the personal meaning moves to Assigned to me. This is the rename Phase 11 deferred here; the UI-SPEC words it.
  - **SQL predicates with exact totals** (the Phase 7 D-21 pattern), checked against the semantic oracle as Phase 7 D-30 does. The counts use the same definitions.
  - **Quick find** (Phase 11 D-49) shows the assignee, or that nobody has picked it up, on line 2 of the analyst's `Requests` options, from this projection. There is no new read and no new group.
- **D-14:** "Assigned to me" (REQ-08 criterion 2; Phase 11 D-13).
  - **A view:** the viewer's open assigned requests (`queue=open`, `assignee=me`), with the lifecycle queue and notes filters still available. It is its own route, whose heading is `Assigned to me` (Phase 11 D-09: label equals heading); the UI-SPEC names the route.
  - **A sidebar item** in Assessment work (first is recommended), shown in the phone drawer too. Its count is the viewer's assigned requests that need analyst action (`requires-attention` with `assignee=me`), named "need your action".
  - **The `Requests` count changes** to the requests that need analyst action and that nobody has picked up (`requires-attention` with `assignee=unassigned`). This reverses Phase 11 D-10's team-wide count: the personal meaning moves to Assigned to me, and the team's call to action becomes the pick-up pool.
  - **Count reads** follow Phase 11 D-11: one bounded queue read each, no polling, and no badge on a failure.
- **D-15:** The analyst Home (REQ-08 criteria 1 and 2; `REPORT.md` §4 "My work by stage").
  - **It leads with the viewer's own work:** their assigned requests that need action (replacing the "Requires my attention" tile), the unassigned pool, and their assigned requests with new notes.
  - **The team's lifecycle figures** stay in the Review queue widget, relabelled.
  - **The dashboard summary's review queue gains, for the viewer:** the lifecycle counts restricted to their assigned requests, the unassigned count, and their assigned open requests with unread notes.
  - **Every figure opens an equal list** through the D-13 filters (X-10).

  The UI-SPEC composes the tiles and rows.
- **D-16:** The analyst's request, questionnaire and assessment pages.
  - **The hub's `Owner` label** (the Requestor's name) becomes `Requestor`. Phase 10's UI-D30 deferred this naming to this phase.
  - **An assignment block** shows the assignee with "assigned by" and when, the actions the server says this viewer may take (Pick up, Assign, Reassign, Unassign; a requesting analyst sees why there are none), and the history.
  - **Picking up:** an eligible analyst picks up from the queue row or card, and from the request page. Assign opens the eligible-analyst picker, a sheet on phones.
  - **The analyst questionnaire and assessment pages** show the assignee beside the originating request link, server-rendered (the editor route is near its JavaScript budget, R-08-34).
- **D-17:** The Requestor's surfaces (Phase 11 D-21 and D-27).
  - **The request page** names the assigned analyst, or says that the request is waiting for a Security Analyst to pick it up.
  - **The server's Requestor-facing holder sentences** (`request-lifecycle.ts`) name the assignee when there is one, and say plainly at the submitted step when nobody has picked the request up yet. `holder` keeps its lifecycle meaning.
  - **My requests rows and Home items** carry the assignee's display name, and never more than that.

#### Generation jobs, R-08-36 and O-5 (REQ-08 criterion 3; G-6; Phase 10 D-25 to D-27)

- **D-18:** Any analyst on the request can follow its jobs.
  - **Access:** the by-id reads and retries of questionnaire and draft jobs are open to any human Security Analyst who may read the request, which today is every human analyst. They go through the existing human-only grants (Phase 12 D-32), so the registries' `canReadAllQuestionnaireGenerationJobs` and `canReadAllDraftJobs` become true for those callers. The service agent and Requestors stay refused.
  - **`canRetry`,** in Phase 10's generation-jobs read and on the by-id reads, means "the job failed and this viewer may retry it", no longer "this viewer started it".
  - **A retry is the retrying analyst's attempt.** The job record and the new run (Phase 12 D-20) name them as the initiator, because every run names its accountable initiator (G-3).
  - **Job projections** carry the initiating analyst's display name, so a colleague sees who started the job.
  - **Contract tidy-up:** the by-id job operations declare their identifier bounds, which retires the narrowed parity paths that 10-13 left for this phase. The catalogue descriptions of the job FunctionAPIs lose "initiating analyst's". No grant changes.
- **D-19:** R-08-36 stays open. Jobs stay process-local, and this phase builds no shared job store. The residual's trigger is unchanged (before Strapi runs as more than one process), persisted job history is Phase 21's (DASH-04), and Phase 12's run record already makes interrupted runs visible (Phase 12 D-20). The residual register records that job access widened in Phase 13 without a storage change.
- **D-20:** O-5 is settled.
  - **Self-review:** settled by G-1, through D-07 now and through Phase 17.1's review, approval and release rules.
  - **Submitting a draft:** O-5's second consequence is closed by least privilege. The analyst branch of the request update refuses to submit a request the analyst did not raise: only a request's own requestor submits it, so the first line attests its own request, and no product path uses the power. The analyst's ability to amend a request's writable fields stays, and T-08-A2's own-submission proof stays green.
  - **The record:** a plan task records both dispositions where O-5 is tracked (`08-SECURITY.md` and the residual register).

#### Notes (COLLAB-01; UAT-013)

- **D-21:** The note entity, JDL first.
  - **No JDL entity fits.** The JDL has no comment or activity entity (catalogue design note 6). `CsrmQuestion.reviewComment` belongs to one question and is analyst-only, and `CsrmRisk.comments` is a Risk field. The brief (§20) asks for gaps to be recorded rather than a competing model. So `CsrmRequestNote` is a new recorded concept that competes with no JDL entity, as G-15 already assumes ("Phase 13's note").
  - **Each note holds:** a plain-text body (trimmed, 1 to 5,000 characters, line breaks kept, never rendered as HTML or Markdown, links not auto-linked), the author, the author's part on the request (`requestor` or `security-analyst`, fixed at posting), the server's posting time, and its AI-input mark (D-26).
  - **Append-only.** There is no edit and no delete operation for anyone. A note is never removed and follows the request's retention.
  - **No orphans.** Deleting a request that holds a note (the analyst-only, API-only core delete) is refused with `REQUEST_HAS_NOTES`.
- **D-22:** When notes can be added (the draft and cancelled cases).
  - **The window:** from the request's first submission until its assessment is released or the request is closed. That is exactly the reviewable statuses (`submitted`, `questionnaire-in-progress`, `risk-assessment-drafted` and `under-review`), held in one predicate, `acceptsNotes`.
  - **A draft takes no new note:** neither one never submitted nor one returned to draft (06.1). The Requestor edits the request itself, and analysts do not work on drafts. Notes already on a returned draft stay readable.
  - **Released and closed requests are read-only:** `approved`, and `closed` from Phase 17.1 (G-13). The thread is part of the record (ISO/IEC 27005 context establishment), and information after release belongs to the register's treatment progress notes (Phase 20).
  - **Cancellation:** CSRM has none (`CsrmRequestStatus` holds no cancelled value). A future withdrawal state would close notes through the same predicate.
  - **New statuses:** a status that Phase 17 or 17.1 adds before closure joins the predicate.
  - **The refusal** is `NOTES_CLOSED`, and the UI shows a line saying why in place of the composer.
- **D-23:** Who reads and writes notes (COLLAB-01 criterion 4; G-12).
  - **Only the request's requestor and any human Security Analyst** (every human analyst may read every submitted request).
  - **Its own predicate:** notes have one predicate (`canUseRequestNotes`), separate from the request read, so Phase 17's participant read of the request summary never reaches them. This confirms G-12: nominated risk owners and executive approvers do not read notes, and contest points (Phase 17.2) are their channel. Widening it later needs its own decision.
  - **Never the service agent:** the notes Function is not granted to its role, and its Requestor birthright reaches only requests it raised.
  - **Everyone else gets the refusal a missing record gets** (404) on every notes route, with persistence unchanged: another Requestor, a participant who is not the requestor, and anyone naming a missing request. The web shows the not-found state.
  - **A requesting analyst** writes in the `requestor` part on their own request (D-07).
  - **G-11's "in a note"** (a different risk owner may be proposed "in a note (Phase 13)") is the Requestor's path only. A nominated owner who is not the requestor proposes in the response (Phase 17) or a contest point (Phase 17.2).
- **D-24:** The minimal "unseen" fact (COLLAB-01 criterion 2), decided now because the notification centre arrives in Phase 17 (decision 18).
  - **The fact:** `CsrmRequestNoteReadState` holds one `lastReadAt` per person and request. It is personal and never shown to anyone else (no read receipts).
  - **The rule:** a note is unread for a person when it was written in the other part (for the requestor, by a Security Analyst; for an analyst, by the requestor), not by them, and after their `lastReadAt`. With no read state, every such note is unread.
  - **Marking read:** the read state advances only through the explicit "mark read through note N" operation, which is monotonic and never moves back. No GET has a side effect. The web calls it once the thread has been shown to the person, and the "New" markers stay for that view.
  - **Where unread shows:**
    - analysts: queue rows and the request page;
    - the Requestor: the request page, My requests and Home;
    - the analyst Home's figure for their assigned requests with new notes.
  - **Filters:** `notes=unread` on the review queue and My requests lets every figure open its list.
  - **Phase 17's notification centre** keeps its own per-notification read state, and may mark a "new note" notification read once the person's note read state passes it.
- **D-25:** The notes presentation baseline (G-4; the UI-SPEC fixes the values).
  - **Each note** shows the author's display name, the part (Requestor or Security Analyst) and the posting time in the viewer's local time (Phase 10 X-3). The thread runs oldest first, with the newest beside the composer, and is paginated and bounded (the UI-SPEC decides how earlier notes load).
  - **Where:** the thread and composer sit on both request pages. The analyst questionnaire and assessment pages show a server-rendered summary (the count, the new count and the AI-input changes) linking to the thread, which leaves the editor's route budget untouched.
  - **Posting** is immediate and optimistic, and a failure rolls back and restores the text. The composer says that a note cannot be changed once added and who will see it. Ctrl+Enter or ⌘+Enter posts. Unsent text is kept for the browser session, and Phase 10's navigation guard warns before it is lost.
  - **States:** a skeleton while loading, empty states that say what to do next, phone cards, and a composer that fits 375px.
  - **Transparency:** the Requestor's panel says that a Security Analyst may include notes in what the AI assistance uses (G-3).

#### Notes and the AI inputs (COLLAB-01 criterion 3; INT-05; G-3; decision 5)

- **D-26:** The "changes the AI inputs" mark is a Security Analyst's decision.
  - **Who sets it:** an analyst, when posting (off by default), or later on any note, the Requestor's included, by any human Security Analyst except a requesting analyst on their own request (D-07). The Requestor never sets it or sees it: a Requestor's create that carries it is refused (400).
  - **The operation** is analyst-only and in `HUMAN_ANALYST_ONLY_OPERATIONS`.
  - **The record:** each change is recorded in the note's append-only `aiInputLog` (who, when, from and to). The AI and the signal read the current mark only.
  - **Reversible:** an Undo toast, no confirmation.
  - **Basis:** G-3 data minimisation; decision 2's pattern for files, where the analyst opts each one in and the default is off; decision 5's untrusted Requestor text; and the second line owning the method.
- **D-27:** What the AI reads: Phase 12 D-08's extension point, which this phase builds.
  - **Exactly the notes currently marked,** in posting order. Unmarked notes never reach the provider.
  - **Untrusted data:** each marked note goes in a delimited block of its own as untrusted data, whoever wrote it, because analyst notes can quote the Requestor. Each is labelled by part and sequence with code constants. The prompt carries no name, time, id or request number (Phase 12 D-04).
  - **The same policy and bounds:** the same classification check, and note text sent whole (06.7 D-10). A context over the hard budget fails before any provider call with `CONTEXT_TOO_LARGE`, and its message names the marked notes, which the analyst can unmark.
  - **Every operation built on the context builder includes them:** Phase 12's questionnaire and draft generation now, then Phase 15's questionnaire proposals, Phase 16's re-runs and Phase 17's residual reassessment.
  - **The guardrail tests** extend to hostile note text.
- **D-28:** The run record.
  - **The context summary** gains a notes section: each included note's `documentId`, part and character count, never its text (G-3). It is a new envelope version that the closed parser accepts beside v1, and earlier runs read as having included no notes.
  - **The "What the AI used" sheet** (Phase 12 §2, X-13) lists the included notes by part and posting time, each linking to the note in the request's thread.
- **D-29:** "AI inputs changed since the last generation", the signal Phases 15 and 16 read.
  - **Per target** (the questionnaire, and the assessment): the notes whose current mark differs from their inclusion in the target's latest completed context-wide run, either marked but not included, or included but since unmarked.
  - **Context-wide runs:** today, questionnaire generation and draft generation. Phase 15's questionnaire proposals and Phase 16's "Suggest more risks" declare themselves context-wide. Risk-scoped runs (16's "Rewrite this risk", 17's per-risk reassessment) include the notes but never clear the signal.
  - **No baseline, no signal:** with no completed run there is no signal. A record generated before Phase 12, which has no run, compares by its `generatedDate`.
  - **Analyst reads only:** the request read for both targets, and the `generation` block of the questionnaire and assessment reads. A Requestor never sees it.
  - **Display:** server-rendered on the hub, the governance page and the editor, with the changed notes listed. This phase offers no re-run action; Phases 15 and 16 attach theirs.

#### Roles, grants and fixtures

- **D-30:** The catalogue, in both copies, byte-identical.
  - **Three new API-only Functions:**

    | Function | Holder | Operations |
    |---|---|---|
    | `function.risk_assessment_requests.assignment_api` | `role.security_analyst` | the assignment operation; the eligible-analyst read |
    | `function.risk_assessment_requests.notes_api` | `role.requestor` and `role.security_analyst` | note list, create and mark read |
    | `function.risk_assessment_requests.note_ai_input_api` | `role.security_analyst` | the AI-input mark |

    None is granted to `role.security_analyst_agent`.
  - **`HUMAN_ANALYST_ONLY_OPERATIONS`** gains the assignment operation, the eligible-analyst read and the AI-input operation, in the policy and in the matrix's mirror, as a second refusal.
  - **The notes operations serve both actors,** so they cannot join that set. Their analyst path is human-only because the agent's role lacks the grant, and the record check (D-23) does the rest.
  - **Records:** a catalogue design note records the new Functions and amends note 6 for notes, and `served-operations.json` is regenerated.
  - **Names:** research fixes the Function names within these families.
- **D-31:** A second development Security Analyst persona.
  - **What:** a second human Security Analyst identity, seeded for development and E2E only, as the Secondary Requestor is (`seed-assessment-navigation-lifecycle.ts`, behind `IDAMBOX_SEED_CSRM` and the development identity), and offered by the development sign-in.
  - **Why:** the UI proofs of another analyst following a job, of reassignment and of per-person flags need a second analyst.
  - **Keycloak:** it gets no Keycloak fixture subject, as the Secondary Requestor has none, so ADR 0004's fixture subjects and the realm import stay as they are, and the OIDC tests stay green.
  - **Strapi tests** use Phase 10's harness identity `second-analyst` (10-13).

#### Verification and plan shape

- **D-32:** How the phase is proved. Each behaviour gets a failing test first at its seam.
  - **Strapi unit:** eligibility, the assigned-analyst predicate, `acceptsNotes`, the unread rule, the signal, and the assignment and AI-input log parsers.
  - **Strapi integration** (mounted):
    - every operation, and every refusal in the authorisation table below;
    - the compare-and-set race;
    - the queue and dashboard predicates against the semantic oracle;
    - job access and retry attribution;
    - the context builder including marked notes only, with hostile note text staying data;
    - the run summary;
    - the request delete and submit-on-behalf refusals.
  - **The matrix:** a row for each new route, and changed rows for the by-id job routes.
  - **Web unit (Vitest):** presentation, components, actions and the refusal states. A requesting analyst sees no Pick up, a closed request shows no composer, another Requestor gets not found, and a Requestor sees no AI mark.
  - **Playwright,** at 1440px and 375px, with each journey's own records:
    - pick-up and assignment;
    - notes between Jane and Bob;
    - the Secondary Requestor refused;
    - the second analyst following a job.

    Existing specs that assert a changed label (the hub's `Owner`, "Requires my attention", the Requests count) change deliberately in the plan that changes it, and that plan names them. A run leaves the tree clean (Phase 8 D-12, G-6).
- **D-33:** Plan shape.
  - **Contract-gap records first,** each followed by its checkpoint where the executor stops. The schema change comes only after approval.
  - **Serialised by shared files,** one owner per file per wave:
    - the specification and the generated client;
    - both catalogue copies, `served-operations.json`, the matrix and the parity guard;
    - `csrm-authorization.ts`;
    - `collection-scope.ts` and `review-queue-repository.ts`;
    - the request controller and `request-lifecycle.ts`;
    - `dashboard-summary.ts`;
    - Phase 12's context builder and run envelopes;
    - the navigation profile, both Homes, the hub and the queue table;
    - the E2E sign-in helper.
  - **Dev servers** are stopped for every plan that edits Strapi or runs Playwright.
  - **The last plan** runs the full gate on the production build, with the 375px and 1440px checks for the Requestor, the Secondary Requestor and both analysts, then asserts a clean tree.

#### Interface

- **D-34:** UI values come only from `docs/design/csrm-design-direction.md`.
  - **Reuse:** Phase 12's X-13 side sheet (the eligible-analyst picker on phones) and X-14 Undo toast.
  - **New patterns:** the UI-SPEC proposes the notes thread, the unread marker and the assignee control as recorded extensions, numbered from the first free number the orchestrator gives, each recorded in the direction by a plan task before the task that uses it.
  - **The G-4 bar:**
    - a keyboard path for pick-up, assign, unassign, posting and marking;
    - optimistic feedback with rollback;
    - Undo toasts for the reversible actions;
    - no confirmation dialogs, because nothing here is a governance-significant irreversible step;
    - skeletons, and empty states that say what to do next;
    - no lost input;
    - the queue's density modes;
    - motion from the direction that honours reduced motion;
    - phone cards and sheets.
  - **Route budget:** the assessment editor stays within its budget. The assignee and the signal render on the server there, and it gets no notes composer in this phase.

### Claude's Discretion (the context's "Planner's Discretion")

- Module placement: the assignment and notes services, the eligibility and assigned-analyst predicates, and whether the notes routes live under the request API or a new `csrm-request-note` API folder.
- The names of reason codes, Functions, operations, fields and envelope versions, within the families above.
- The bounds: the note-length bound against Phase 12's context budget (5,000 is the decision unless research finds it breaks the budget), the per-request note cap, the assignment-log cap and the eligible-list size.
- The SQL and indexes for the assignee, unread and AI-input predicates, provided the totals are exact.
- The second analyst persona's name and email.
- How the work splits into plans, provided D-33's serialisation holds.
- Copy, layout, routes and visuals: the UI-SPEC's.

### Deferred Ideas (OUT OF SCOPE)

- **A filter by a named analyst** and sorting by assignee, for a lead's oversight: not asked for; candidates with Phase 21's management views.
- **Bulk assignment** and workload balancing: not asked for.
- **Auto-assignment on an analyst's first workflow action:** a candidate Admin setting for Phase 22; explicit pick-up is the rule now.
- **Internal analyst-only notes** (ServiceNow's "work notes"): not asked for, and a visibility toggle invites disclosure mistakes.
- **Mentions,** and per-question or per-assessment comments: COLLAB-03, future.
- **Redacting a note posted in error:** an audited, Admin-only redaction, for a later phase; notes stay append-only.
- **Read receipts:** never; the read state is personal.
- **The assignee as a column** on the Questionnaires and Risk assessments lists: Phase 18's column chooser can add it.
- **Recent-activity entries** for assignment and notes: Phase 21's history and metrics.
- **Team fan-out of events on an unassigned request:** Phase 17's notification design.
- **Answering another Requestor's request read with 404 instead of today's 403,** as G-12 does for assessments: not needed for notes, which are already 404; a candidate when Phase 17 reshapes request reads for participants.
- **Whether a requesting analyst may contribute edits** to their own request's questionnaire or assessment: G-1 does not forbid it, and Phase 17.1 adds its review, approval and release rules.
- **A shared job store** or persisted job history: R-08-36, Phase 21.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-08 | A Security Analyst can pick up a submitted request, assign or reassign it to a Security Analyst, or release it back to the queue (the product says "Unassign" or "Return to queue", D-05), and every analyst on the request can follow its generation jobs. | §A (assignment attributes, link tables, log cap), §C (`OWN_REQUEST` as 403), §E (compare-and-set under the request lock on SQLite and PostgreSQL), §F (widening the job registries and retry attribution), "Queue and count SQL", Validation Architecture rows REQ-08 (1) to (5) |
| COLLAB-01 | The Requestor and Security Analysts can add attributed plain-text notes to a request at any point after submission and read its notes history. | §A (note and read-state types, the per-request `sequence`), §B (5,000 characters fits Phase 12's budgets; a 50-note count bound), §D (people projections and the `populate` leak), "Unread SQL", "Notes in the AI context", Validation Architecture rows COLLAB-01 (1) to (4) |
</phase_requirements>

## Summary

The context settles almost everything. Research had six items left to settle, and each now has a code-grounded answer:

1. **Names and SQL.** Use `CsrmRequestNote` (`csrm_request_notes`) and `CsrmRequestNoteReadState` (`csrm_request_note_read_states`). Strapi 5 keeps every relation, `manyToOne` included, in a link table. The real names, computed with `@strapi/database` 5.51's own identifier shortener, are `csrm_assessment_requests_assigned_analyst_lnk`, `csrm_request_notes_assessment_request_lnk` and the others listed in §A. All fit the 55-character limit, so raw SQL can name them. Add a server-assigned per-request `sequence` to the note, and `lastReadSequence` to the read state. Unread and "mark read through note N" then compare integers, not millisecond timestamps, which two notes can share.
2. **Note length.** 5,000 characters is safe. It is 5% of Phase 12's questionnaire budget (about 100,000) and 2.5% of the draft budget (about 200,000). The total budget still governs: `CONTEXT_TOO_LARGE`, naming the marked notes. Add a count bound of 50 marked notes, so that the run's context-summary notes section stays far below its 64 KB cap.
3. **`OWN_REQUEST`.** Return **403** with `error.details.reason: "OWN_REQUEST"`. The refusal is about who the caller is relative to the record (separation of duties, G-1), not about record state, and reloading cannot resolve it. It stays in the denial family the authorisation matrix and security tests already reason about. Strapi's `ctx.forbidden(message, details)` carries the reason. The web transport must keep a reason on a 403 as well as on a 409.
4. **`populate=revertedBy` leaks.** On `GET /api/csrm-assessment-requests/{id}`, the caller's `populate` goes through Strapi's core `findOne`. Strapi's output sanitiser removes only private and password attributes. It removes a relation only when the auth lacks `find` on the target, and the web's full-access API token has every scope. `revertedBy` therefore arrives with `email`, `username`, `firstName`, `lastName`, `accountStatus` and `externalSubject`. So does `populate=*`, which also populates `requestor`, `sponsor` and, after this phase, `assignedAnalyst` and `assignedBy`. The web's zod parser strips these fields on the Next server, so no browser sees them. The wire still breaks D-04's "never email". The plan that adds the assignee projection must therefore:
   - filter the request read's caller `populate` to `informationSystems`, `informationAssets`, `questionnaire` and `assessment`;
   - project `revertedBy` on the server as `{ documentId, displayName }`, as `findOne` already does for `requestor`.
5. **Compare-and-set.** Follow the 06.1 revert: the in-process tail, then `strapi.db.transaction`, `SELECT id … FOR UPDATE` on the request row, then read and compare inside the lock.
   - **SQLite (dev and tests):** knex compiles `forUpdate` to an empty string. Serialisation comes from knex's SQLite pool (`min: 1, max: 1`): a transaction holds the only connection.
   - **PostgreSQL (production):** the row lock serialises across processes. A read after the lock sees the committed winner under READ COMMITTED.
   - **One trap:** raw `strapi.db.connection` knex queries are not bound to Strapi's AsyncLocalStorage transaction. Inside the lock they must call `.transacting(trx)`. Otherwise SQLite waits 60 s for its only connection, and PostgreSQL reads outside the snapshot.
   - **R-08-37 stays open:** the race test proves the logic on SQLite only.
6. **Jobs and R-08-36.** Widening is a flag change at two call sites (`canReadAll…: false` today). Two real changes go with it:
   - **Attribution:** both registries' `retry` keep the original `initiatingAnalystDocumentId`. D-18's "a retry is the retrying analyst's attempt" needs `retry` to rewrite it before `launch`.
   - **Display name:** the registries store only a documentId, so the initiator's display name is resolved at read time.

   The jobs stay in memory. The residual's wording gains "access widened, storage unchanged", and its trigger stays as it is.

**Primary recommendation:** One shared `withRequestLock(strapi, requestId, work)` module, extracted from `request-workflow.ts`, owns every write in this phase: assignment, note create, mark read and the AI-input mark. One `request-people.ts` projection module owns every person shape (`{ documentId, displayName }`). One `request-assignment-policy.ts` owns eligibility and `assertAssignedAnalyst`, and one `request-notes-policy.ts` owns `acceptsNotes`, `canUseRequestNotes`, the author part and the unread rule. The raw-SQL predicates for `open`, `assignee` and `notes=unread` join `review-queue-repository.ts`'s `applyCriteria` and are checked against the semantic oracle.

## Project Constraints (from AGENTS.md)

There is no `CLAUDE.md` at the repository root. `apps/csrm/CLAUDE.md` includes `apps/csrm/AGENTS.md`: this Next.js version differs from training data, so read `node_modules/next/dist/docs/` before writing code. The binding directives from the root `AGENTS.md` and the Stage 2 rules:

- **API boundary:**
  - Strapi stays the production API boundary: no frontend API facade and no raw `fetch` in page components;
  - the web calls Strapi only through `apps/csrm/src/lib/api`, from server code and Server Actions.
- **Authorisation:**
  - Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI and record-level authorisation against the resolved IdamBox User, and never branches on the auth mode;
  - navigation visibility is not security. Requestors must not reach another Requestor's records.
- **AI:** AI output is advisory. Notes marked for the AI are data, never instructions.
- **Domain:** JDL terminology. Gaps go into contract-gap records, followed by an approval checkpoint where the executor stops (G-6).
- **Web code:**
  - semantic tokens only, shadcn/ui first, strict TypeScript and Server Components by default;
  - no business logic in JSX; responsive and accessible.
- **Tests:** tests with every material workflow: Strapi `node:test` integration for every grant and refusal, Vitest for the web, and Playwright with a clean tree after the run.
- **Dependencies:** none without a concrete reason. This phase needs none.
- **Dev mode:**
  - never start Keycloak or flip `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`;
  - new settings go in the `.example` files.
- **Paths:** `apps/backend` (Strapi) and `apps/csrm` (web), never the pre-rename folder names.
- **Gate commands:**
  - `pnpm --dir apps/csrm api:check`, `typecheck`, `lint` and `test`;
  - `pnpm --dir apps/backend test`;
  - `pnpm --dir apps/csrm test:e2e`;
  - `git status --short`.
- **Project skills:** `.agents/skills/` `tdd` (red, then green, per seam), `codebase-design` (deep modules behind small interfaces: the lock, the people projection and the two policy modules) and `domain-modeling` (record the "Note" and "Assigned analyst" terms in the glossary rather than inventing synonyms).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assignment change (pick up, assign, reassign, unassign), compare-and-set, history | API / Backend (Strapi service under the request lock) | Database (row lock, link table) | Authorisation, G-1 and the race are server facts |
| Eligibility and `assertAssignedAnalyst` | API / Backend (pure policy module) | — | One predicate reused by Phase 17 and 17.1; never in the web |
| Eligible-analyst read | API / Backend (bounded SQL over `idambox_users`, `idambox_users_roles_lnk`, `idambox_roles`) | Browser (picker sheet) | The picker never offers what the server refuses |
| Notes create, list and mark read; the AI-input mark | API / Backend | Frontend Server (Server Actions, optimistic rollback in Client Components) | The record rule `canUseRequestNotes` gives 404 server-side |
| Unread counts, `assignee` and `notes` filters, `open` bucket | Database (SQL predicates, exact totals) | API (projection) | The Phase 7 D-21 pattern; counts equal lists |
| People projection (`documentId`, `displayName`) | API / Backend | — | D-04; nothing populated by the caller |
| Marked notes in the AI context, the run summary's notes section, the "AI inputs changed" signal | API / Backend (Phase 12 builder and run record) | Frontend Server (rendered on the server in the editor; route budget) | G-3 minimisation; R-08-34 budget |
| Generation-job access and retry attribution | API / Backend (process-local registries) | — | R-08-36 storage unchanged |
| Assignee and notes UI: thread, composer, picker, flags, counts | Browser (Client Components for the composer, picker and toasts) | Frontend Server (Server Components for lists, summaries and Home) | G-4 bar; Server Components by default |
| Second analyst persona | API / Backend (seed behind `IDAMBOX_SEED_CSRM` and dev identity) | Frontend Server (development session role) | No Keycloak fixture subject (ADR 0004) |

## Standard Stack

### Core (all installed; nothing is added)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@strapi/strapi`, `@strapi/database` | 5.51.0 [VERIFIED: apps/backend/package.json] | Content types, Document Service, QueryBuilder (`forUpdate`, AsyncLocalStorage transactions), schema sync | The production API boundary |
| knex (through Strapi) | 3.0.1 [VERIFIED: node_modules/.pnpm/knex@3.0.1…] | Raw SQL predicates in `review-queue-repository.ts` | Existing queue pattern |
| better-sqlite3 | 12.8.0 [VERIFIED: apps/backend/package.json] | Dev and test database | Every suite runs on it |
| Next.js App Router, zod, openapi-fetch | as installed in `apps/csrm` | Server Components, Server Actions, closed parsers, typed client | The existing web pattern |
| shadcn/ui `Sheet`, sonner `toast` | as installed | Picker sheet (X-13), Undo toast (X-14) | Phase 12 extensions reused (D-34) |

### Supporting (tests)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` with the Strapi HTTP harness | Node 24 | Mounted integration, the matrix, the race | Every grant and refusal |
| vitest | 4.1.11 [VERIFIED: apps/csrm/package.json] | Web unit and component tests | Domain, parsers, components, actions |
| @playwright/test | 1.58.2 [VERIFIED: apps/csrm/package.json] | Journeys at 1440 and 375 | Pick-up, notes, refusals, second analyst |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Row lock plus in-process tail | A single conditional `UPDATE … WHERE assigned_x = ?` compare-and-set | The assignee lives in a link table, so no single-statement compare-and-set exists without a version column; the lock is the proven 06.1 pattern |
| `sequence` integer for unread | `postedAt` timestamp comparisons | Millisecond ties between concurrent notes; SQLite stores datetimes as epoch milliseconds through knex's binding conversion, PostgreSQL as `timestamptz`; integers compare identically in both |
| A separate read-state entity (locked, D-24) | A JSON map on the request | Locked by D-01; the JSON map would serialise every reader's write through the request row |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase. Every capability uses Strapi, knex, zod, openapi-fetch, shadcn/ui, sonner, vitest and Playwright as already installed.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## The six open items, settled

### A. Content-type names, attributes and SQL identifiers

**Strapi 5 keeps every relation in a link table**, `manyToOne` included. The existing requestor predicate proves it [VERIFIED: apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts:72-75]:

```ts
.from("csrm_assessment_requests as r")
.join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
.where("o.idambox_user_id", requestorId)
```

**Identifiers above 55 characters are shortened with a hash** (`IDENTIFIER_MAX_LENGTH = 55` [VERIFIED: @strapi/database 5.51.0 dist/utils/identifiers/index.js:29]). The names below were computed with that module's own `identifiers.getJoinTableName`, `getJoinColumnAttributeIdName` and the index-name helpers [VERIFIED: node probe of `@strapi/database/dist/utils/identifiers/index.js`, this session]:

| Relation | Link table (length) | Owner column | Target column |
|---|---|---|---|
| request `assignedAnalyst` → IdamBox User | `csrm_assessment_requests_assigned_analyst_lnk` (45) | `csrm_assessment_request_id` | `idambox_user_id` |
| request `assignedBy` → IdamBox User | `csrm_assessment_requests_assigned_by_lnk` (40) | `csrm_assessment_request_id` | `idambox_user_id` |
| note `assessmentRequest` → request | `csrm_request_notes_assessment_request_lnk` (41) | `csrm_request_note_id` | `csrm_assessment_request_id` |
| note `author` → IdamBox User | `csrm_request_notes_author_lnk` (29) | `csrm_request_note_id` | `idambox_user_id` |
| read state `reader` → IdamBox User | `csrm_request_note_read_states_reader_lnk` (40) | `csrm_request_note_read_state_id` | `idambox_user_id` |
| read state `assessmentRequest` → request | `csrm_request_note_read_states_assessment_request_lnk` (52) | `csrm_request_note_read_state_id` | `csrm_assessment_request_id` |

All six table names are unshortened, so raw SQL may name them. Three index names of the 52-character table are hashed (`csrm_request_note_read_states_assessment_reque38b27_ifk`, `…_ofk`, `…_oifk`). Strapi manages those, and no code names them. The user-to-role link is `idambox_users_roles_lnk` with `idambox_user_id` and `role_id` [VERIFIED: the same probe], and roles live in `idambox_roles` [VERIFIED: apps/backend/src/api/role/content-types/role/schema.json:3 `"collectionName": "idambox_roles"`].

**Proposed attributes for the two records** (the records fix the names; D-01):

| Type | Attribute | Strapi type | Notes |
|---|---|---|---|
| `CsrmAssessmentRequest` (+4) | `assignedAnalyst` | relation manyToOne `api::idambox-user.idambox-user` | The current fact, the only thing gates read |
| | `assignedAt` | datetime | Server-owned; null when unassigned |
| | `assignedBy` | relation manyToOne IdamBox User | Who made the current assignment |
| | `assignmentLog` | json | `{ schemaVersion: 1, events: [...] }` or a bare versioned array as in 06.8; cap **1,000 events** (the 06.8 `GOVERNANCE_LOG_MAX_ENTRIES = 1_000` precedent [VERIFIED: questionnaire-governance-log.ts:24]); each event `{ schemaVersion, action: "pick-up" \| "assign" \| "reassign" \| "unassign", by, at, from, to, reason? }`, with ids as documentIds and the reason at most 500 characters |
| `CsrmRequestNote` (`csrm_request_notes`, `draftAndPublish: false`) | `body` | text | Trimmed, 1 to 5,000 characters, CRLF normalised to LF |
| | `authorPart` | enumeration `requestor`, `security-analyst` | Fixed at posting |
| | `sequence` | integer | **Proposed addition:** 1, 2, 3 … per request, assigned under the request lock; the thread order, the "mark read through" key and the AI label |
| | `postedAt` | datetime | Server clock |
| | `changesAiInputs` | boolean, default false | The current mark |
| | `aiInputLog` | json | Append-only `{ schemaVersion, by, at, from, to }`; cap **200 events** per note |
| | `assessmentRequest`, `author` | relation manyToOne | No `inversedBy`, so the request schema gains no `notes` attribute and `populate=*` on the request never reaches notes |
| `CsrmRequestNoteReadState` (`csrm_request_note_read_states`) | `lastReadAt` | datetime | When the reader last marked read (the D-24 fact) |
| | `lastReadSequence` | integer | **Proposed addition:** the monotonic "read through" mark that the unread rule compares |
| | `reader`, `assessmentRequest` | relation manyToOne | One row per (reader, request), enforced by writing only under the request lock (see §E) |

**Why no `inversedBy` on the new relations:** an inverse attribute on `CsrmAssessmentRequest` (`notes`) would join the request's core `populate` surface, the generated client's populate enum and `populate=*`. A one-way relation keeps notes reachable only through the notes operations (D-02, D-23). This matches `revertedBy`, which has no inverse either [VERIFIED: csrm-assessment-request schema.json:81-85].

**Uniqueness of the read state.** Strapi enforces a scalar `unique: true` in its entity validator; whether it also creates a database unique index in 5.51 was not probed [ASSUMED], and a pair of relations cannot carry a unique constraint at all. Correctness therefore comes from writing the read state only under the request lock: find, then create or update. A test asserts that two concurrent "mark read" calls leave exactly one row.

### B. The note length against Phase 12's context budget

Phase 12's budgets are about 100,000 characters for the questionnaire's user prompt and about 200,000 for the draft. Over budget is `CONTEXT_TOO_LARGE` before any run is created, and Requestor text is never truncated [CITED: 12-RESEARCH.md "Bounds (D-06)"]. The context summary is at most 64 KB [CITED: 12-RESEARCH.md, `contextSummary` row].

| Bound | Value | Reason |
|---|---|---|
| Note body | **1 to 5,000 characters** (keep D-21's value) | One full note is 5% of the questionnaire budget and 2.5% of the draft budget. Request fields alone can exceed the budget (the web bounds each text field to 65,535 [CITED: 12-RESEARCH.md, `request-schema.ts:40`]), so the total budget is the real guard, not the note length |
| Marked notes included in one context | **50**, over → `CONTEXT_TOO_LARGE`, naming the marked notes | Mirrors Phase 12's count bounds (100 systems or assets). It keeps the notes section of the summary at about 50 × 120 bytes ≈ 6 KB, far below 64 KB, even for one-character notes |
| Notes per request | **500**, over → 409 `NOTES_LIMIT_REACHED` | Flood protection: 500 × 5,000 = 2.5 MB per request at most |
| Thread page | 50 notes, cursor `before=<sequence>` | Append-only threads page stably by sequence |
| Assignment log | 1,000 events; at the cap the change is refused (409 `HISTORY_UNAVAILABLE`, Phase 10's code) | Fail closed on audit, as 06.8 does |
| AI-input log per note | 200 events, same refusal | Same posture |
| Eligible-analyst read | 50 people, `q` at most 100 characters, ordered by `displayName` then `id` | A bounded picker; search narrows |
| Assignment reason | 500 characters (the `MAX_REASON_LENGTH = 500` family [VERIFIED: questionnaire-governance-log.ts:58 by shell read]) | Same as revert reasons |

**Body validation:** trim, normalise CRLF and CR to LF, and refuse C0 control characters other than tab and newline. Count JavaScript string length on both sides, so zod's `.max(5000)` and the server agree. The text is rendered as text only: no HTML, no Markdown, no auto-linking.

### C. `OWN_REQUEST`: 403, with a closed reason

| Option | For | Against |
|---|---|---|
| **403 + `details.reason: "OWN_REQUEST"` (recommended)** | It is an authorisation refusal: who the caller is relative to the record (G-1). No reload or state change resolves it. It stays in the denial family the matrix and security tests reason about ("policy denial is 403"). Phase 17.1's `NOT_ASSIGNED_ANALYST` is the same kind, so the families stay consistent: identity-relative refusals are 403, record-state refusals are 409 (`REQUEST_UNASSIGNED`, `ASSIGNMENT_CHANGED`, `NOTES_CLOSED`) | Phase 10's closed list is named `CONFLICT_REASONS` and its transport tests key on 409 |
| 409 + reason | Every closed reason travels on the same status | It mislabels a security control as a state conflict; a UI that treats 409 as "reload" would invite the analyst to retry |

**How it travels:** Strapi's error helpers accept details for every status. `app.response[methodName] = function responseCode(response = statusName, details = {})` builds `createError(code, response, { details })` [VERIFIED: @strapi/core 5.51.0 dist/services/server/koa.js:18-26]. So `ctx.forbidden("…", { reason: "OWN_REQUEST" })` works from a controller.

**What the plan must do:**
- add `OWN_REQUEST` to Phase 10's single closed reason list (10-06 `apps/backend/src/csrm/conflict-reasons.ts` and `apps/csrm/src/lib/api/conflict-reasons.ts`, kept identical), and document that the list also covers 403 refusals;
- declare `reason` in the 403 response schema these operations use;
- check that 10-06's `normalizeTransportError` keeps a validated reason whatever the status. Its plan text reads the reason without naming a status, but its tests use 409 only. Add a 403 case.

**D-20's refusal** (an analyst submitting a draft they did not raise) is the same kind: 403, persistence deep-equal, with a closed reason (proposed `NOT_REQUEST_REQUESTOR`; there is no web caller). Today the update route refuses workflow violations with 400 [VERIFIED: csrm-assessment-request controller `update`, `denyBadRequest`]. The existing T-08-A2 own-submission proof stays green [VERIFIED: apps/backend/tests/authorization.integration.test.ts:734-746].

### D. `populate=revertedBy` today

- **The route:** `GET /api/csrm-assessment-requests/{id}` calls `super.findOne(ctx)` with the caller's query, then adds the requestor's display name, the relationships and the lifecycle [VERIFIED: controllers/csrm-assessment-request.ts `findOne`].
- **What the web asks for:** `populate: ['informationSystems', 'informationAssets', 'revertedBy']` [VERIFIED: apps/csrm/src/features/requests/request-service.ts:73-79].
- **What the contract allows:** the specification lets `findOne` take `populate` `*` or any of `informationSystems`, `informationAssets`, `questionnaire`, `assessment` and `revertedBy` [VERIFIED: node read of specification.json `/csrm-assessment-requests/{id}` get].
- **The sanitiser:** Strapi's `sanitizeOutput` applies `defaultSanitizeOutput` (`removePassword`, `removePrivate`) and, only when `auth` is set, `removeRestrictedRelations(auth)`. That transform removes a relation only when `strapi.auth.verify(auth, { scope: "<target>.find" })` fails [VERIFIED: @strapi/utils 5.51.0 dist/sanitize/index.js:97-123, sanitizers.js:26-34, visitors/remove-restricted-relations.js:78-110].
- **The token:** the development token is `type: "full-access"` [VERIFIED: apps/backend/src/bootstrap/seed-development-api-token.ts:22-31], and the harness uses the same type [VERIFIED: tests/helpers/strapi-http-harness.ts:469-474]. Under OIDC, `Authorization` still carries that API token; only the identity moves to `x-csrm-identity-token` [VERIFIED: apps/backend/src/middlewares/csrm-keycloak-identity.ts:5-11].
- **The IdamBox User schema** marks only `password` private. `email`, `username`, `firstName`, `lastName`, `displayName`, `accountStatus` and `externalSubject` are public [VERIFIED: apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json:14-49].

**Conclusion** (by code reading; no HTTP probe was run, because Stage 2 forbids starting Strapi): today `populate=revertedBy` returns the reverting user's email, username, names, account status and external subject, plus `id`, `createdAt` and `updatedAt`. `populate=*` does the same for `requestor` and `sponsor`, and after this phase would for `assignedAnalyst` and `assignedBy`.

**Severity:** low. Strapi is reachable only with the server-held token. The Next server parses `revertedBy` with `z.object({ documentId, displayName })`, which strips unknown keys [VERIFIED: apps/csrm/src/features/requests/request-schema.ts:158]. No browser receives the fields. It is a D-04 least-privilege break all the same, and the new relations would widen it.

**The fix** belongs in the plan that adds the assignee projection:
1. In `findOne`, before `super.findOne`, filter `ctx.query.populate` to `informationSystems`, `informationAssets`, `questionnaire` and `assessment`. That is the `safePopulate` pattern the collection read already uses [VERIFIED: collection-scope.ts:136-142]. Drop `*` and every IdamBox User relation.
2. Add `revertedBy: { documentId, displayName } | null` to the server augmentation, from `REQUEST_RELATIONSHIP_POPULATE` extended with `revertedBy`.
3. Drop `revertedBy` and `*` from the request read's populate enum in the specification. Declare the projected `revertedBy` and the new `assignment` block in its response schema. Remove `revertedBy` from the web's `populate` array.
4. **RED first:** a mounted test asserts `Object.keys(body.data.revertedBy).sort()` equals `["displayName", "documentId"]` after an analyst reverts Jane's request, and that `?populate=*` returns no `requestor.email`.

The revert response's own `populate: { revertedBy: true }` [VERIFIED: request-workflow.ts:111-113 by shell read] returns the caller's own record to themselves. It is not a cross-user disclosure, but the same projection should replace it for one shape.

### E. Compare-and-set serialisation on SQLite and PostgreSQL (R-08-37)

**The existing pattern** [VERIFIED: apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts:63-83]: `serializeRequestRevert(documentId, work)`, an in-process promise tail per request, then `strapi.db.transaction(async ({ trx }) => { await lockRequest(strapi, id, trx); … })`. `lockRequest` issues `SELECT id … WHERE documentId = ? FOR UPDATE` through `strapi.db.queryBuilder(uid)`.

| Fact | Consequence |
|---|---|
| knex's SQLite compiler sets `this.forUpdate = emptyStr` [VERIFIED: knex 3.0.1 lib/dialects/sqlite3/query/sqlite-querycompiler.js:26] | On SQLite the lock statement is a plain `SELECT` |
| SQLite pool default `{ min: 1, max: 1 }` [VERIFIED: knex lib/dialects/sqlite3/index.js:215-216]; better-sqlite3 extends it [VERIFIED: lib/dialects/better-sqlite3/index.js:5]; `config/database.ts` sets no pool for SQLite [VERIFIED: apps/backend/config/database.ts sqlite block] | On SQLite one connection serves the process. An open transaction excludes every other query until commit, which is what serialises two pick-ups in dev and tests |
| Strapi's `db.transaction` runs the callback inside AsyncLocalStorage, and `QueryBuilder.execute` binds `transactionCtx.get()` [VERIFIED: @strapi/database 5.51.0 dist/index.js:60-90, query/query-builder.js:536-541] | Document Service and `db.query`/`db.queryBuilder` calls inside the callback join the transaction automatically |
| Raw `strapi.db.connection` knex (the review-queue repository's style) is not bound to that context | Inside the lock, raw SQL must call `.transacting(trx)`. Otherwise, on SQLite it waits for the only connection until `acquireConnectionTimeout` (60,000 ms [VERIFIED: config/database.ts]) and fails; on PostgreSQL it reads outside the transaction |
| PostgreSQL: `FOR UPDATE` blocks a second transaction on the same row until commit; under READ COMMITTED each later statement sees the committed state [ASSUMED: PostgreSQL semantics, not run here] | The read of the current assignee must come after `lockRequest` in the same transaction, never before |
| PostgreSQL: inserting a link row that references the request takes `FOR KEY SHARE` on the request row [ASSUMED] | Every writer in this phase takes the request lock first, so no transaction upgrades from key-share to update after another has locked: no deadlock |

**The algorithm** (one module, `request-assignment.ts`):
1. Parse the body: `analyst` (documentId or null), `expectedAnalyst` (documentId or null), optional `reason` (at most 500).
2. Resolve the target's eligibility before the lock (a read with no side effects), so the lock is held briefly. Re-check that eligibility is unchanged inside the lock only if it is cheap; the decision is "at the moment of use".
3. `withRequestLock(requestId)`, inside which:
   - load the request with `requestor`, `assignedAnalyst` and `requestStatus`;
   - if the request is missing → 404;
   - if the caller is the requestor → 403 `OWN_REQUEST`;
   - if the status is `draft` → 409 `REQUEST_NOT_SUBMITTED`;
   - if the current assignee differs from `expectedAnalyst` → 409 `ASSIGNMENT_CHANGED` with the current assignee;
   - if the target is ineligible → 409 `ASSIGNEE_NOT_ELIGIBLE`;
   - if the target is null and the status is in `RELEASED_REQUEST_STATUSES` → 409 `ASSIGNMENT_REQUIRED`;
   - if the target equals the current assignee → a no-op 200 (no event; idempotent);
   - otherwise derive the action and write `assignedAnalyst`, `assignedAt`, `assignedBy` and the appended log in one `documents.update`.
4. Return the assignment projection.

**One shared lock module.** The tail map must be one map for the revert, assignment, notes, mark-read and AI-mark paths. Two separate maps would not serialise against each other in-process. The pool and the row lock still would, but only by waiting. Never nest `withRequestLock` for the same id: the tail would wait on itself forever.

**Proof:**
- **Mounted race:** `Promise.all` of Bob's and the second analyst's pick-ups, both with `expectedAnalyst: null`. Exactly one 200 and one 409 `ASSIGNMENT_CHANGED` naming the winner; the persisted assignee is the winner; the log holds one event.
- **Stale compare:** a unit test proves the compare itself.
- **R-08-37** stays open. Add these constructs to its PostgreSQL checklist: `FOR UPDATE` before the read, ALS-bound queries in the lock, `COUNT` returned as a string (already handled with `Number(row?.total ?? 0)` [VERIFIED: review-queue-repository.ts `count`]) and boolean bindings.

### F. "Any analyst on the request can follow its generation jobs" and R-08-36

| Fact | [VERIFIED] source |
|---|---|
| The questionnaire registry's `authorize` refuses when `actor.documentId !== job.initiatingAnalystDocumentId && !actor.canReadAllQuestionnaireGenerationJobs` | questionnaire-generation-registry.ts:20 (shell read) |
| The workflow's `actor()` returns `{ documentId, canReadAllQuestionnaireGenerationJobs: false }` | questionnaire-generation-workflow.ts:15 (shell read) |
| The draft registry's `authorize` is the same; `draftActor()` returns `canReadAllDraftJobs: false` | assessment-draft-registry.ts:130-137; assessment-workflow.ts:818-823 (shell read) |
| `retry` resets status, attempt and times, and **keeps** `initiatingAnalystDocumentId`; `launch` passes it to `execute`, which writes it as `generatedBy` | assessment-draft-registry.ts:213-231 (shell read); questionnaire-generation-registry.ts (`retry`, `launch`) |
| Job ids are `randomBytes(18).toString("base64url")` (24 characters); `nonBlank` accepts at most 255 | questionnaire-generation-registry.ts:10, :15; assessment-draft-registry.ts:100 (Read) |
| The web parses job ids with `documentIdSchema = z.string().trim().min(1).max(255)` | apps/csrm/src/features/assessments/assessment-schema.ts:10 (Read) |
| Terminal jobs are kept for 1 hour, at most 500 | questionnaire-generation-registry.ts:15 (`maxTerminal ?? 500`, `terminalTtlMs ?? 3600000`) |

**What changes:**
1. **Access.** Pass `canReadAll… = true` when the policy admitted the caller through the human analyst grant. Read it from a policy-set flag (for example `ctx.state.csrmAuthorization.humanAnalyst`), not a constant, so a later route reusing the workflow cannot widen by accident. The by-id routes keep their human-only grants (Phase 12 D-32). Phase 10's `latestForRequest` computes `canRetry` as `job.status === "failed" && viewerMayRetry` (D-18).
2. **Attribution.** In both registries, `retry(jobId, actor)` sets `job.initiatingAnalystDocumentId = actor.documentId` before `launch`. Then `generatedBy`, and Phase 12's new run `initiatedBy`, name the retrier. Unit test: Bob starts, the job fails, the second analyst retries, and `execute` receives the second analyst.
3. **Initiator display name.** The registry holds only the documentId. Resolve `displayName` at projection time with one bounded `findOne` on the IdamBox User (fields `documentId` and `displayName`), and project `initiatedBy: { documentId, displayName } | null`. Do not store the name in the registry: a renamed user would read stale.
4. **Identifier bounds.** Declare `minLength: 1, maxLength: 255` on the `jobId` path parameters (`QuestionnaireGenerationJobId` inline and the `AssessmentDraftJobId` component, today `{"type":"string","minLength":1}` [VERIFIED: node read of specification.json]) and on the response `jobId` fields. That matches the server's `nonBlank` and the web's `documentIdSchema`. A 24-character pattern would break injected test ids. This retires 10-13's `narrowedPaths` entries.
5. **Catalogue descriptions** of the job FunctionAPIs drop "initiating analyst's". No grant changes.

**R-08-36** (process-local registries): widening adds no new failure mode.
- **Restart:** it still forgets jobs; a colleague reads 404 and the generation-jobs read returns `null`.
- **Multi-process:** a colleague might reach another process, exactly as the initiator might.
- **Retention:** terminal jobs vanish after an hour; Phase 12's run record is the durable history.
- **The register entry gains one line:** "Phase 13 widened job access to every human analyst; storage unchanged."
- **Trigger:** unchanged.

## Contract changes (D-03), with the shapes research proposes

| # | Operation or change | Proposed shape (names are Planner's Discretion within the families) |
|---|---|---|
| 1 | `PUT /api/v1/assessment_requests/{requestId}/assignee` | Body `{ data: { analyst: string \| null, expectedAnalyst: string \| null, reason?: string } }`. 200 `{ data: AssessmentRequestAssignment }`. 400 (malformed), 403 (no grant, human-only, `OWN_REQUEST`), 404, 409 (`REQUEST_NOT_SUBMITTED`, `ASSIGNMENT_CHANGED` with `details.assignee`, `ASSIGNEE_NOT_ELIGIBLE`, `ASSIGNMENT_REQUIRED`, `HISTORY_UNAVAILABLE`). The `ASSIGNMENT_CHANGED` details need a dedicated error schema (`{ reason, assignee: Person \| null }`), because `AssessmentWorkflowErrorResponse.error.details` is closed (`additionalProperties: false`) [CITED: 10-06-PLAN interfaces] |
| 2 | `GET …/{requestId}/assignable_analysts?q=` | `{ data: Person[] }`, at most 50; 403 `OWN_REQUEST` for a requesting analyst |
| 3 | `GET …/{requestId}/notes?before=` and `POST …/notes`; `POST …/notes/read` | List `{ data: RequestNote[], meta: { hasEarlier, unread, lastReadSequence } }`; create body `{ data: { body, changesAiInputs?: boolean } }` (a Requestor's `changesAiInputs` → 400); read body `{ data: { throughNoteId } }` → 200 with the new summary. Every route: 404 for anyone `canUseRequestNotes` refuses |
| 4 | `PUT …/notes/{noteId}/ai_input` | Body `{ data: { changesAiInputs: boolean } }`; human analyst only; `OWN_REQUEST`; `NOTES_CLOSED` once released or closed (the mark is part of the frozen record) |
| 5 | Request read | Gains `assignment` (analyst view: `assignee`, `assignedBy`, `assignedAt`, `actions`, `history`, `ownRequest`; Requestor view: `{ assignee: { displayName } \| null }`), `notes` (`total`, `unread`, `accepting`, `closedReason`), `aiInputs` (analyst only: per target, the changed notes) and the projected `revertedBy` |
| 6 | Review queue | `filters[queue]=open`; `filters[assignee]=me\|unassigned`; `filters[notes]=unread`; items gain `assignee: Person \| null`, `canPickUp: boolean`, `unreadNotes: number` |
| 7 | My requests (11-10) | Items gain `assignee: { displayName } \| null` and `unreadNotes`; `filters[notes]=unread`; the status summary gains `withUnreadNotes` |
| 8 | Dashboard summary | `reviewQueue.mine: { requiresAttention, awaitingRequestor, generationInProgress, open, withUnreadNotes }`, `reviewQueue.unassigned` |
| 9 | Questionnaire and assessment analyst reads | `assessmentRequest.assignee`; `generation.aiInputsChanged: { count, notes: [...] } \| null` |
| 10 | Job reads and retries, generation-jobs read | `initiatedBy: Person \| null`; `canRetry` (failed and may retry); `jobId` bounds |
| 11 | AI run read | `contextSummary` v2 with `notes: { included: [{ documentId, part, sequence, characters }], marked, bound }`; v1 parses as no notes |
| 12 | Closed reasons | `OWN_REQUEST` (403), `ASSIGNMENT_CHANGED`, `ASSIGNEE_NOT_ELIGIBLE`, `ASSIGNMENT_REQUIRED`, `NOTES_CLOSED`, `NOTES_LIMIT_REACHED`, `REQUEST_HAS_NOTES` (409); reuse `REQUEST_NOT_SUBMITTED` and `HISTORY_UNAVAILABLE` from 10-06 |
| 13 | Refusals on existing operations | `DELETE /api/csrm-assessment-requests/{id}` → 409 `REQUEST_HAS_NOTES`; analyst `PUT` submitting a draft they did not raise → 403 |

`Person` = `{ documentId: string (1..255), displayName: string }`.

**`REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST`** (D-10): define them as constants in the predicate module now, with unit tests, and add them to the published enum in Phase 17.1, when a route first returns them. Publishing codes no route returns adds dead contract surface.

**Catalogue (D-30)**, in both copies, byte-identical (today `cmp` is silent [VERIFIED: cmp this session]):

| Function id | Name | roleIds | FunctionApis |
|---|---|---|---|
| `function.risk_assessment_requests.assignment_api` | Assessment Request Assignment API | `["role.security_analyst"]` | `.api.01` `PUT:/api/v1/assessment_requests/{requestId}/assignee`; `.api.02` `GET:/api/v1/assessment_requests/{requestId}/assignable_analysts` |
| `function.risk_assessment_requests.notes_api` | Assessment Request Notes API | `["role.security_analyst", "role.requestor"]` | `.api.01` GET notes; `.api.02` POST notes; `.api.03` POST notes/read |
| `function.risk_assessment_requests.note_ai_input_api` | Assessment Request Note AI Input API | `["role.security_analyst"]` | `.api.01` `PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input` |

These follow the existing pattern: `"This API-only Function intentionally has no menuPath."` and `function.<group>.<name>_api.api.NN` [VERIFIED: catalogue node read: `function.risk_assessment_requests.revert_to_draft_api` and `function.questionnaire_generation.*`]. The role ids `role.security_analyst`, `role.security_analyst_agent` and `role.requestor` are the catalogue's [VERIFIED: same read].

`HUMAN_ANALYST_ONLY_OPERATIONS` gains the three analyst-only URLs in the policy [VERIFIED: csrm-authorization.ts:41-49] and in the matrix mirror (`apps/backend/tests/fixtures/authorization-matrix.ts:75`).

## Queue and count SQL

Every predicate joins `applyCriteria` in `review-queue-repository.ts` [VERIFIED: file read this session], with bound values and constant identifiers.

- **`open` bucket:** the statuses are `REVIEWABLE_REQUEST_STATUSES` and there is no lifecycle predicate. Semantic oracle: `REVIEWABLE_REQUEST_STATUSES.includes(request.requestStatus)`. `open` ∪ `released` equals Phase 11's `all`. Source [VERIFIED: collection-scope.ts:45-52]:
  ```ts
  export const REVIEWABLE_REQUEST_STATUSES = Object.freeze([
    "submitted",
    "questionnaire-in-progress",
    "risk-assessment-drafted",
    "under-review",
  ] as const);
  export const RELEASED_REQUEST_STATUSES = Object.freeze(["approved", "closed"] as const);
  ```
- **The viewer's numeric id.** Unread and `me` need the viewer's `idambox_users.id`. The policy already resolves it (`requestorId: user.id` in `loadEffectiveGrants` [VERIFIED: csrm-authorization.ts, `loadEffectiveGrants`]) but stores it only for the Requestor collection scope. Set it for the analyst review scope too, as a policy fact, never from the query.
- **Unread** (viewer V, request row `r`). The viewer's part is `requestor` when the request's requestor link names V, else `security-analyst`. A note is unread when `n.author_part <> viewerPart`, its author is not V, and `n.sequence > COALESCE(rs.last_read_sequence, 0)`. One grouped query per page (`GROUP BY nl.csrm_assessment_request_id` over the page's ids), never one query per row. The `notes=unread` filter is the same body inside `EXISTS`.
- **Counts:** `countDistinct("r.id")` as today; PostgreSQL returns a string.

## Notes in the AI context (Phase 12 D-08's extension point)

- **The loader** reads the request's notes with `changesAiInputs = true`, ordered by `sequence`, with fields `documentId`, `authorPart`, `sequence` and `body`. Over 50 → `CONTEXT_TOO_LARGE` with a message naming the marked notes.
- **The builder** renders each note as `promptDataTag("note", body)` inside the untrusted Requestor data block, whoever wrote it. Its attributes are code constants and server integers only: `part` from the closed enum, `n` = sequence. No name, time or id goes into the prompt. `promptDataTag` escapes `&`, `<` and `>` [CITED: 12-RESEARCH.md, `prompt-data.ts:1-10`].
- **The summary v2 notes section:** `documentId`, `part`, `sequence` and `characters`, never text.
- **The signal (D-29)** for a target:
  - find the latest completed context-wide run, resolved exactly as Phase 12 resolves `generation.runId`;
  - the changed notes are the set difference between the currently marked note ids and the run's `contextSummary.notes.included` ids, in both directions;
  - a v1 summary counts as "included none";
  - with no completed run, compare by `generatedDate`: notes marked after it count;
  - with neither, there is no signal.

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components: composer, picker sheet, Undo toast)
   │ Server Action (zod-validated input)
   ▼
Next server: typed service (openapi-fetch, closed parsers) ──► Strapi /api/v1/...
                                                                │
                      csrm-app-enabled ─► csrm-authorization policy
                      (grant; HUMAN_ANALYST_ONLY_OPERATIONS; sets actor, humanAnalyst, viewerId)
                                                                │
                                   ┌────────────────────────────┼──────────────────────────────┐
                                   ▼                            ▼                              ▼
                    assignment controller          notes controller                 request read / queue / dashboard
                     │                               │ canUseRequestNotes ─ no ─► 404   │ people projection
                     ▼                               ▼                                   ▼
               withRequestLock(requestId)  ◄─── shared ───► withRequestLock        raw SQL predicates
               (tail ─► trx ─► FOR UPDATE)                  (create / read / mark)  (open, assignee, unread)
                     │ eligibility, G-1, compare-and-set     │ acceptsNotes, sequence, caps        │
                     ▼                                        ▼                                   ▼
          csrm_assessment_requests (+ link tables)   csrm_request_notes, csrm_request_note_read_states
                                                              │ marked notes
                                                              ▼
                                         Phase 12 context builder ─► provider (deterministic in suites)
                                                              │
                                                              ▼
                                         CsrmAiRun.contextSummary v2 (notes section) ─► signal (D-29)
```

### Recommended module placement (Planner's Discretion)
```
apps/backend/src/api/csrm-assessment-request/services/
├── request-lock.ts                # withRequestLock: one tail map + trx + FOR UPDATE (extracted; revert uses it)
├── request-people.ts              # projectPerson, projectRequestorView: {documentId, displayName} only
├── request-assignment-policy.ts   # isEligibleAssignee, assertAssignedAnalyst, deriveAssignmentAction, change rules
├── request-assignment.ts          # the compare-and-set operation and the eligible-analyst read
├── assignment-log.ts              # closed, versioned, capped parser and appender (06.8 posture)
apps/backend/src/api/csrm-request-note/
├── content-types/csrm-request-note/schema.json            # no routes folder: no core router (D-02)
├── content-types/csrm-request-note-read-state/schema.json # or its own api folder; Strapi needs an api folder per type
├── services/request-notes-policy.ts   # acceptsNotes, canUseRequestNotes, authorPartFor, isUnread
├── services/request-notes.ts          # list, create, mark read, AI mark (under withRequestLock)
├── services/note-ai-input-log.ts
├── controllers/request-notes.ts, routes/request-notes.ts (custom routes only), operations.ts
apps/csrm/src/features/requests/
├── request-assignment-domain.ts, request-notes-domain.ts   # zod-free, for Client Components
├── request-assignment-service.ts, request-notes-service.ts, *-schema.ts, *-actions.ts
├── request-assignment.tsx, request-notes-thread.tsx, request-notes-composer.tsx
```

### Pattern 1: Current fact plus append-only log (06.8)
Gates read `assignedAnalyst` and `changesAiInputs` only. Logs are versioned, parsed closed and capped. A malformed log projects as "history unavailable" and never denies a read.

### Pattern 2: The record rule returns 404 from the controller, not the policy
The notes routes use the grant check only (no `requireRequestOwnership`, which answers 403 [VERIFIED: csrm-authorization.ts end of `csrmAuthorization`]). The controller loads the request with `requestor` and calls `canUseRequestNotes(request, caller)`:
- the request's requestor, through either grant, may use the notes;
- a human analyst (grant through the human role) may use them;
- anyone else gets 404, with persistence unchanged.

### Pattern 3: People are projections
Every person crosses as `{ documentId, displayName }`, and the Requestor sees the assignee's `displayName` only. The relation is populated server-side with `fields: ["documentId", "displayName"]`, never through the caller's `populate`.

### Pattern 4: Human-only twice
A grant to `role.security_analyst` only, plus `HUMAN_ANALYST_ONLY_OPERATIONS`, plus the matrix mirror.

### Anti-Patterns to Avoid
- **Reading the assignee before taking the lock:** a stale compare, which is a silent overwrite on PostgreSQL.
- **Raw knex inside `withRequestLock` without `.transacting(trx)`:** a 60 s stall on SQLite, outside the snapshot on PostgreSQL.
- **A second tail map:** the in-process serialisation splits.
- **`inversedBy: "notes"` on the request:** notes leak into `populate=*` and the populate enum.
- **Timestamp-based unread:** millisecond ties; dialect storage differences.
- **Marking read on GET:** D-24 forbids side effects on reads.
- **Storing the initiator's name in the job registry:** stale on rename.
- **Gating editing on the assignee:** decision 10, editing is non-exclusive. Only Phase 17.1's steps use `assertAssignedAnalyst`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request mutual exclusion | A new mutex or a `version` column scheme | The existing tail plus `FOR UPDATE` (`request-workflow.ts:63-83`), extracted | Proven by 06.1 and the generation workflow |
| Link-table names | Guessed SQL identifiers | The names computed in §A; assert them in a schema test (`PRAGMA table_info`) | Strapi shortens above 55 characters |
| Closed reason transport | A new error envelope | Phase 10's `error.details.reason` list and `normalizeTransportError` | One vocabulary |
| Local time display | Date formatting | Phase 10's `LocalInstant` and `formatInstant` (X-3) | Time-zone cookie already handled |
| Unsaved-text protection | A custom `beforeunload` | Phase 10's navigation guard (10-08) plus `sessionStorage` per request | No lost input |
| Picker sheet, Undo | New primitives | X-13 `Sheet`, X-14 sonner toast with action | D-34 |
| Prompt delimiting | New escaping | `promptDataTag` | Phase 12 guardrails |
| Semantic oracle | Ad hoc expectations | `selectReviewQueueBucket` extended with `open`, assignee and unread | Phase 7 D-30 |

## Runtime State Inventory

This is not a rename phase. The additive schema still has runtime consequences:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Dev database requests (UAT-A, UAT-B, UAT-C, Bob's two) gain null assignee columns and link tables at the next Strapi start; no backfill (D-11) | None. Legacy rows read as unassigned with no notes; proven by a test on a fresh database |
| Live service config | None. No external service holds assignment or notes | None |
| OS-registered state | None | None |
| Secrets and env vars | None new. The second analyst needs no secret; no `.example` change unless a bound becomes configurable (not recommended) | None |
| Build artifacts | `apps/backend/types/generated/*.d.ts` regenerates on Strapi start: the operator item the rules leave alone; `apps/csrm/src/lib/api/generated/schema.d.ts` regenerates through `api:generate` | Commit only the web generated client; leave the Strapi generated types to the operator |

## Common Pitfalls

### Pitfall 1: The ALS-unbound raw query inside the lock
- **What goes wrong:** the queue repository's `strapi.db.connection` knex is used inside `withRequestLock`, for example to count notes for the cap.
- **Why:** raw knex ignores Strapi's transaction context.
- **Avoid:** inside the lock use `strapi.db.query(uid)` or Document Service calls, or call `.transacting(trx)`.
- **Warning sign:** a test that hangs for about 60 s, then fails with a pool timeout.

### Pitfall 2: The leak returns through `populate=*`
- **What goes wrong:** the new relations are added before the request read's populate is filtered.
- **Avoid:** the populate filter and the people projection land in, or before, the plan that adds the schema attributes.
- **Warning sign:** `requestor.email` appears in a mounted response.

### Pitfall 3: Notes routes answering 403 to another Requestor
- **What goes wrong:** they reuse `requireRequestOwnership`.
- **Avoid:** grant-only policy config plus the controller record rule (404). The matrix rows: `other` 404, `serviceAgent` 404, `owner` 200, `analyst` 200.

### Pitfall 4: The service agent through the Requestor birthright
- **What goes wrong:** the agent holds `notes_api` through `role.requestor` (every identity's birthright [VERIFIED: csrm-authorization.ts `loadEffectiveGrants`, requestorRoles]), so the grant check admits it.
- **Avoid:** `canUseRequestNotes` admits the analyst path only through `hasHumanAnalystOperation`, and the agent reaches only requests it raised. The AI mark and assignment are in `HUMAN_ANALYST_ONLY_OPERATIONS`.

### Pitfall 5: A requesting analyst slips through
- **What goes wrong:** the analyst path is checked before the requestor check.
- **Avoid:** in every new decision, test "is the caller this request's requestor" first. A requesting analyst writes in the `requestor` part, cannot assign or mark, and is not eligible.

### Pitfall 6: Retry attribution
- **What goes wrong:** the analyst who retries is not recorded as the initiator.
- **Why:** the registry keeps the original initiator through `retry`.
- **Avoid:** set the initiator in `retry`. Test through `generatedBy` and the Phase 12 run `initiatedBy`.

### Pitfall 7: Changed labels break existing E2E specs
- **What goes wrong:** the hub's `Owner` becomes `Requestor`, "Requires my attention" drops "my", and the `Requests` count changes meaning.
- **Avoid:** the plan that changes each label names and updates the affected specs (`navigation-and-home.spec.ts`, `assessment-navigation-lifecycle.spec.ts`, `analyst-insights.spec.ts` and Phase 11's new specs) in the same task.

### Pitfall 8: An unread marker that disappears too early
- **What goes wrong:** the web calls mark-read before rendering.
- **Avoid:** render "New" from the read summary fetched with the thread, then call mark-read through the newest shown note. The marker stays for that view (D-24).

### Pitfall 9: A queue item's `canPickUp` disagrees with the server
- **What goes wrong:** the item computes it differently from the assignment operation.
- **Avoid:** both call the same `isEligibleAssignee` and change-rule functions.

### Pitfall 10: The editor route budget
- **What goes wrong:** client-side notes UI on the assessment editor (R-08-34).
- **Avoid:** the editor shows only a server-rendered summary (D-25, D-34). `performance.spec.ts` stays green.

## Code Examples

### The shared lock (extracted from `request-workflow.ts:63-83`)
```ts
// Source: apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts:63-83 (read this session)
const requestTails = new Map<string, Promise<void>>();

export async function withRequestLock<T>(strapi: LockStrapi, requestId: string, work: (trx: unknown) => Promise<T>): Promise<T> {
  const previous = requestTails.get(requestId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  requestTails.set(requestId, tail);
  await previous;
  try {
    return await strapi.db.transaction(async ({ trx }) => {
      const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request");
      query.select(["id"]); query.where({ documentId: requestId }); query.forUpdate(); query.transacting(trx);
      await query.execute<unknown>();
      return work(trx); // every read that decides must happen here, after the lock
    });
  } finally {
    release();
    if (requestTails.get(requestId) === tail) requestTails.delete(requestId);
  }
}
```

### Assignee predicates (knex, bound values, constant identifiers)
```ts
// Table and column names: computed with @strapi/database 5.51.0 identifiers (this session); pattern from request-status-summary.ts:72-75
function assignedTo(query: QueryBuilder, viewerId: number): void {
  query.whereExists((link) => {
    link.from("csrm_assessment_requests_assigned_analyst_lnk as aa")
      .whereRaw("aa.csrm_assessment_request_id = r.id")
      .where("aa.idambox_user_id", viewerId)
      .select("aa.id");
  });
}
function unassigned(query: QueryBuilder): void {
  query.whereNotExists((link) => {
    link.from("csrm_assessment_requests_assigned_analyst_lnk as aa")
      .whereRaw("aa.csrm_assessment_request_id = r.id")
      .select("aa.id");
  });
}
```

### Eligibility (role names quoted from csrm-authorization.ts:9-14)
```ts
// Source: apps/backend/src/policies/csrm-authorization.ts:9-14 (Read this session):
//   const SECURITY_ANALYST_ROLE_NAMES = new Set(["Security Analyst", "Security Analyst Agent"]);
//   const HUMAN_SECURITY_ANALYST_ROLE_NAME = "Security Analyst";
// Export the names (or a predicate) from the policy module rather than duplicating literals.
export function isEligibleAssignee(user: LoadedUser, request: { requestorDocumentId: string }): boolean {
  return user.accountStatus === "active"
    && hasHumanAnalystOperation(user.roles, LIST_ANALYST_REVIEW_REQUESTS) // the human role's analyst grant
    && !user.roles.some((role) => role.name === "Security Analyst Agent")  // G-1: never the service identity
    && user.documentId !== request.requestorDocumentId;                    // G-1: never your own request
  // Phase 17 adds: not a nominated risk owner or executive approver of the request's assessment (G-11).
}
```

### People projection for the request read
```ts
// Pattern: controllers/csrm-assessment-request.ts findOne augmentation (requestor display name), extended
const ALLOWED_READ_POPULATE = new Set(["informationSystems", "informationAssets", "questionnaire", "assessment"]);
export function projectPerson(value: unknown): { documentId: string; displayName: string } | null {
  return isRecord(value) && typeof value.documentId === "string" && typeof value.displayName === "string"
    ? { documentId: value.documentId, displayName: value.displayName }
    : null;
}
```

### Retry attribution (both registries)
```ts
// Source: assessment-draft-registry.ts:213-231 (shell read); the one added line is marked
function retry(jobId: string, actor: AssessmentDraftJobActor): AssessmentDraftJobRecord {
  cleanup();
  const job = jobs.get(jobId);
  if (!job) throw new AssessmentDraftRegistryError(404, "Assessment draft job was not found.");
  authorize(job, actor);
  if (job.status !== "failed" || inFlight.has(job.questionnaireId)) throw new AssessmentDraftRegistryError(409, "Only failed jobs can be retried.");
  job.initiatingAnalystDocumentId = actor.documentId; // D-18: the retry is the retrying analyst's attempt
  job.status = "queued"; job.attempt += 1; /* … unchanged … */
  launch(job);
  return publicRecord(job);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jobs readable by their initiator only (`canReadAll…: false`) | Any human analyst who may read the request | Phase 13 (D-18) | Colleagues follow and retry jobs |
| Caller-chosen `populate` of IdamBox User relations on the request read | Server projections only | Phase 13 (D-04) | No email or subject on the wire |
| Hub label `Owner` (the Requestor) | `Requestor`, and `Assigned to` for the analyst | Phase 13 (D-16) | Ownership is unambiguous |
| The `Requests` count is team-wide "requires attention" | Unassigned and requiring attention; "Assigned to me" counts the viewer's | Phase 13 (D-14) | The pick-up pool is the call to action |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL `FOR UPDATE` plus READ COMMITTED gives a correct compare after the lock, and link-row inserts take `FOR KEY SHARE` on the request row | §E | A double assignment or a deadlock in production; mitigated by R-08-37's PostgreSQL run before deployment |
| A2 | Strapi 5.51 may or may not create a database unique index for a scalar `unique: true`; correctness does not rely on it | §A | None if every read-state write runs under the lock |
| A3 | The leak conclusion in §D rests on reading the sanitiser and the token type, without an HTTP probe | §D | If Strapi strips more than the code shows, the fix is still harmless (projection only) |
| A4 | 10-06's `normalizeTransportError` keeps `reason` regardless of status | §C | A 403 `OWN_REQUEST` shows generic copy; add a 403 test case |
| A5 | The proposed bounds (50 marked notes, 500 notes per request, 1,000 log events, 200 AI-mark events, 50-person picker) suit the pilot's volume | §B | Too low a cap refuses legitimate work; all are constants in one module each |
| A6 | Proposed names `sequence`, `lastReadSequence`, `NOT_REQUEST_REQUESTOR`, `NOTES_LIMIT_REACHED` and the Function display names | §A, §C, Contract | Cosmetic; the records fix the names |

## Open Questions

1. **Add `sequence` and `lastReadSequence` to the records?**
   - What we know: D-01 lists `postedAt` and `lastReadAt` only. Timestamp unread has tie and dialect hazards (§A).
   - Recommendation: add both in the notes record before its approval checkpoint. Keep `lastReadAt` as the human-readable fact.
2. **The `ASSIGNMENT_CHANGED` payload.**
   - What we know: D-05 returns the current assignee, and the shared error `details` is closed.
   - Recommendation: a dedicated assignment-conflict error schema with `assignee`. Alternatively, the web re-reads the request on that reason (simpler, one more round trip).
3. **`OWN_REQUEST` on a list the caller cannot see.**
   - What we know: a requesting analyst reads their own request through the analyst routes.
   - Recommendation: the request read's `assignment.ownRequest: true` lets the UI hide the controls without calling the operation.
4. **Seam with 11-06's wording** ("'Assigned to me' one more value in `REVIEW_QUEUE_BUCKETS`").
   - What we know: D-13 makes `assignee` an orthogonal filter and adds only `open` to the buckets.
   - Recommendation: follow D-13. The "Assigned to me" route is `queue=open&assignee=me`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (Git Bash PATH prefix `/c/ProgramData/nvm/v24.19.0`) | Builds and tests | ✓ (Node 22.19.0 is the shell default; the executors use 24.19.0 per the brief) | 24.19.0 | — |
| pnpm | Scripts | ✓ (per 12-VALIDATION) | 11.24.0 | — |
| SQLite (better-sqlite3) | Every suite | ✓ | 12.8.0 | — |
| PostgreSQL and the `pg` driver | R-08-37 proof | ✗ | — | Portability by construction; R-08-37 stays open |
| Keycloak | Not used | not started (rule) | — | Development identity bridge |

**Missing dependencies with no fallback:** none blocking. **With fallback:** PostgreSQL (R-08-37).

## Proposed plan outline (for 13-VALIDATION's seed rows; the planner owns the split)

D-33 serialises these plans by shared file:

| Plan | Wave | Content |
|---|---|---|
| 13-01 | 1 | Assignment contract-gap record, then a checkpoint |
| 13-02 | 1 | Notes contract-gap record, then a checkpoint |
| 13-03 | 2 | Schema for the request attributes and the two types. Extract `withRequestLock`; add the people projection and the request-read populate filter (D-04) |
| 13-04 | 3 | Assignment operation and eligible-analyst read: services, spec, catalogue, matrix, served inventory, web parser |
| 13-05 | 4 | Notes operations, the AI mark, the request-delete refusal, D-20's refusal |
| 13-06 | 5 | Projections and SQL: the `open` bucket, filters, item fields, dashboard `mine`, My requests, request read blocks, holder sentences |
| 13-07 | 6 | Job access widening, retry attribution, initiator name, id bounds, R-08-36 line |
| 13-08 | 7 | Marked notes in the Phase 12 builder, summary v2, the D-29 signal |
| 13-09 | 7 | Second analyst persona; record the UI extensions in the direction |
| 13-10 | 8 | Web: queue column and card, Pick up, Assigned to me, navigation counts, analyst Home, hub assignment block, picker |
| 13-11 | 9 | Web: notes thread and composer, unread flags, Requestor surfaces |
| 13-12 | 10 | Web: questionnaire and assessment summaries, the AI mark and signal display |
| 13-13 | 11 | The two journeys and the full gate |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Web: vitest 4.1.11 (jsdom) with Testing Library. Strapi: `node:test` compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file. E2E: Playwright 1.58.2 with axe, Chromium, production build |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900, `mobile` 375×812, `workers: 1`) |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <path>`. Strapi file (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test`, then `pnpm --dir apps/csrm test:e2e` and `git status --short` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-08 (1) | Pick-up, assign, reassign and unassign record actor, time, from, to and reason; the assignee shows on the request read, queue items, the dashboard, quick find and the questionnaire and assessment reads | Strapi integration + web + E2E | quick run `request-assignment.integration.test.js`; `vitest run src/features/requests`; `test:e2e e2e/request-pick-up.spec.ts` | ❌ W0 |
| REQ-08 (2) | `open` bucket, `assignee=me\|unassigned`, `notes=unread` equal the oracle; dashboard `mine` and `unassigned` counts equal their lists; sidebar counts | Strapi integration + web | quick run `review-queue-buckets.integration.test.js`, `analyst-dashboard.integration.test.js`, `review-queue.unit.test.js`; `vitest run src/config/navigation src/features/analyst-dashboard` | ✅ extended |
| REQ-08 (3) | The second analyst reads and retries Bob's job by id (200); `canRetry` means failed and may retry; a retry's initiator is the retrier; the Requestor and the agent get 403 | Strapi unit + integration + E2E | quick run `questionnaire-generation.unit.test.js`, `questionnaire-generation.integration.test.js`, `assessment-workflow.integration.test.js`; `test:e2e e2e/request-pick-up.spec.ts` (second analyst follows the job) | ✅ extended |
| REQ-08 (4) | Editing stays non-exclusive: an unassigned analyst edits questionnaire and assessment; `assertAssignedAnalyst` gates nothing new | Strapi unit + integration | quick run `request-assignment.unit.test.js`; existing workflow suites stay green | ❌ W0 |
| REQ-08 (5) | A requesting analyst gets 403 `OWN_REQUEST` for every assignment action, the eligible list and the AI mark; the service agent, an inactive user, a Requestor-only user and the requestor named as assignee give 409 `ASSIGNEE_NOT_ELIGIBLE` | Strapi integration + matrix + web | quick run `request-assignment.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/requests` (no Pick up for a requesting analyst) | ❌ W0 / ✅ |
| REQ-08 (race) | Concurrent pick-ups: one 200, one 409 `ASSIGNMENT_CHANGED` naming the winner; one log event | Strapi integration | quick run `request-assignment.integration.test.js` | ❌ W0 |
| COLLAB-01 (1) | Notes record author, part, server time and text; append-only (no route for edit or delete; the matrix and inventory prove it); the window is `acceptsNotes` (`NOTES_CLOSED` on draft, released and closed); 409 `REQUEST_HAS_NOTES` on request delete | Strapi unit + integration + matrix | quick run `request-notes.unit.test.js`, `request-notes.integration.test.js`, `served-operations.integration.test.js` | ❌ W0 |
| COLLAB-01 (2) | Unread per person by sequence; mark read is monotonic, never on GET; flags on queue rows, the request, My requests and the Requestor Home | Strapi unit + integration + web + E2E | quick run `request-notes.unit.test.js`, `request-notes.integration.test.js`, `review-queue-buckets.integration.test.js`; `vitest run src/features/requests src/features/home`; `test:e2e e2e/request-notes.spec.ts` | ❌ W0 / ✅ |
| COLLAB-01 (3) | Only marked notes reach the context, as delimited untrusted data (hostile `</note>` stays data); a Requestor create carrying the mark gives 400; summary v2 lists ids, parts and character counts; the signal per target; 50 marked → `CONTEXT_TOO_LARGE` | Strapi unit + integration | quick run `assessment-context.unit.test.js`, `ai-provider-guardrails.unit.test.js`, `ai-run.integration.test.js` (Phase 12 files, extended), `request-notes.integration.test.js` | ✅ (after Phase 12) |
| COLLAB-01 (4) | Maya (another Requestor) gets 404 on every notes route, with persistence deep-equal; no notes, flags or counts of Jane's reach her anywhere | Strapi integration + matrix + E2E | quick run `request-notes.integration.test.js`, `authorization-matrix.integration.test.js`; `test:e2e e2e/request-notes.spec.ts` | ❌ W0 |
| D-04 | The request read projects people only; `populate=*` and `populate=revertedBy` carry no email | Strapi integration | quick run `request-workflow.integration.test.js` | ✅ extended |
| D-20 | An analyst submitting Jane's draft gets 403, nothing written; own submission stays 200 | Strapi integration | quick run `authorization.integration.test.js` | ✅ extended |
| D-01 | Exactly the approved schema files change; legacy requests read as unassigned; the link tables exist (`PRAGMA table_info`) | static + Strapi integration | content-type freeze check; quick run `request-assignment.integration.test.js` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched web files by path; `typecheck` when types change; `api:check` after any spec change; the touched Strapi files by path, with dev servers stopped.
- **Per wave merge:** the full web suite, `typecheck`, `lint` and `api:check`; the full Strapi suite after every plan that edits Strapi; each UI plan's targeted Playwright specs at its end.
- **Phase gate:** the full suite green on the production build at 1440 and 375, then `git status --short` showing only the brief's three operator items.

### Wave 0 Gaps
- [ ] `apps/backend/tests/request-assignment.unit.test.ts`: eligibility, `assertAssignedAnalyst`, action derivation, change rules, the log parser and cap
- [ ] `apps/backend/tests/request-notes.unit.test.ts`: `acceptsNotes`, `canUseRequestNotes`, the author part, the unread rule, the body parser, the AI-mark log, the signal
- [ ] `apps/backend/tests/request-assignment.integration.test.ts`: operations, refusals, the race, history, the eligible list, legacy rows, link tables
- [ ] `apps/backend/tests/request-notes.integration.test.ts`: list, create, read and mark; 404s; the window; caps; the delete refusal; concurrent mark-read leaves one row
- [ ] `apps/csrm/e2e/request-pick-up.spec.ts` and `apps/csrm/e2e/request-notes.spec.ts`
- [ ] The harness identity `second-analyst` comes from 10-13 (Phase 10); the development persona (D-31) from this phase's seed plan

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Keycloak or the development bridge; no change |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Role → Function → FunctionAPI grants, `HUMAN_ANALYST_ONLY_OPERATIONS`, `canUseRequestNotes` (404), G-1 `OWN_REQUEST`, eligibility |
| V5 Input Validation | yes | Closed body parsers on the server; zod on the web; length, control-character and enum checks; text-only rendering |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | People projections (`documentId`, `displayName`); no notes in exports (Phase 19); the summary holds no note text |
| V11 Business Logic | yes | Compare-and-set under the lock; monotonic read state; append-only logs with caps |
| V13 API | yes | No core routes for the new types; closed reasons; the matrix row per route |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on notes (another Requestor) | Information disclosure | Record rule → 404 on every notes route; persistence deep-equal; matrix rows |
| Self-assignment of one's own request | Elevation (separation of duties) | `OWN_REQUEST` before every assignment decision; eligibility excludes the requestor |
| Service agent becomes accountable or steers AI inputs | Elevation | Excluded from eligibility; human-only operations twice |
| Lost update between concurrent pick-ups | Tampering | `expectedAnalyst` compare inside the row lock |
| Prompt injection through note text | Tampering | Marked notes only, delimited untrusted blocks, escaped; guardrail tests with hostile text |
| Personal data on the wire (`populate`) | Information disclosure | Populate allow-list plus projections (§D) |
| Note flooding | Denial of service | 500 notes per request, 5,000 characters per note, 50 marked per context |
| Stored XSS through note text | Tampering | Rendered as React text only; no HTML, Markdown or auto-links |
| Repudiation of assignment changes | Repudiation | Append-only, versioned log written in the same transaction as the fact |

## Sources

### Primary (HIGH confidence)
- Repository code read this session:
  - `request-workflow.ts`, `csrm-authorization.ts`, the request controller and routes, `collection-scope.ts`, `review-queue-repository.ts`, `request-status-summary.ts`;
  - both job registries and workflows;
  - the IdamBox User, request and role schemas;
  - `seed-development-api-token.ts`, `csrm-keycloak-identity.ts`, `config/database.ts` and `config/api.ts`;
  - `request-service.ts`, `request-schema.ts` and `assessment-schema.ts`;
  - `authorization.integration.test.ts` (T-08-A2) and the matrix fixture header.
- Framework source in `node_modules`:
  - `@strapi/database` 5.51.0 (identifiers, transaction context, query builder);
  - `@strapi/utils` 5.51.0 (sanitize);
  - `@strapi/core` 5.51.0 (`koa.js` error helpers);
  - knex 3.0.1 (SQLite query compiler, pool defaults, better-sqlite3 bindings).
- `docs/references/specification.json` and both catalogue copies, read with node.

### Secondary (MEDIUM confidence)
- `12-RESEARCH.md` (budgets, envelopes, delimiting), `10-06-PLAN.md` and `10-13-PLAN.md` (reason list, transport, generation-jobs read), and `11-06`, `11-08` and `11-10` (queue, holder, My requests).
- `docs/security/phase-08-residual-risks.md` (R-08-36, R-08-37) and `08-SECURITY.md` (O-5).

### Tertiary (LOW confidence)
- PostgreSQL locking semantics (A1), from training knowledge; not exercised here.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing is added; versions read from the package files.
- Architecture: HIGH. Each module extends a proven in-repo pattern.
- Pitfalls: HIGH for the Strapi and SQLite mechanics (read in framework source); MEDIUM for PostgreSQL.

**Research date:** 2026-10-01
**Valid until:** 2026-10-31, or earlier if Phase 10, 11 or 12 plans change the files named here.

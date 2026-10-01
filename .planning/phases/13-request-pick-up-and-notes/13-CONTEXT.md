# Phase 13: Request pick-up and notes - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005), at the G-4 premium bar. The decisions are grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: UAT-013, UAT-014, and `REPORT.md` §4, §5, §8 and §9);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#2, #5, #10, #16, #17, #18, G-1, G-3, G-4, G-6, and the post-demo G-11, G-12, G-13, G-15, G-16 and G-18);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code;
- the planned outputs of Phase 10 (CONTEXT and 23 plans), Phase 11 (CONTEXT, UI-SPEC, RESEARCH and PATTERNS; its plans are being written) and Phase 12 (CONTEXT, RESEARCH and UI-SPEC);
- a read of today's code in `apps/backend` and `apps/csrm`.

There is no SPEC.md for this phase. The discussion log is `13-DISCUSSION-LOG.md`. Plans for this phase are written ahead, against today's code plus the planned outputs of Phases 10, 11 and 12, and each plan says so and names the earlier plans it relies on.

<domain>
## Phase Boundary

Give every submitted Assessment Request one accountable Security Analyst, whom any analyst can pick up, assign, reassign or unassign with a recorded history, and give the Requestor and the Security Analysts a notes thread on the request where new information has a home from submission until the request is released or closed. The phase closes UAT-013 and UAT-014, delivers REQ-08 and COLLAB-01, settles security note O-5 with G-1, and widens generation-job access to every analyst on the request (Phase 10 D-27, G-6). It also defines "the assigned analyst", the one server-side predicate that Phase 17.1's assigned-analyst-only steps reuse.

In scope:
- the assignee on the request: current facts, history, one assignment operation, the eligible-analyst read, the G-1 rules and the assigned-analyst predicate;
- the assignee everywhere a request appears: the review queue (column, card, "Assigned to me" and "Unassigned"), the sidebar counts, the analyst Home, quick find, the analyst request, questionnaire and assessment pages, and the Requestor's request page, Home and My requests;
- generation jobs readable and retryable by any human Security Analyst who may read the request, with retries attributed to the analyst who retries;
- the request note, its read state, its AI-input mark, its place in the AI context and the "AI inputs changed" signal;
- the contract-gap records and their approval checkpoints, the catalogue grants, the authorisation proofs, a second development Security Analyst persona, and the tests.

Out of scope:
- notifications of any kind (Phase 17, decision 18): this phase records the facts Phase 17 notifies on;
- attachments, including files posted with a note (Phase 14);
- AI re-run actions that use new notes (Phases 15 and 16): this phase only feeds marked notes into the context and shows the signal;
- assigned-analyst gates on review, submission, recall and release (Phase 17.1), and the risk-owner rule of G-11 (Phase 17);
- persisted jobs or a shared job store (R-08-36 stays open; Phase 21);
- comments on questionnaires and assessments (COLLAB-03, future) and contest points (Phase 17.2);
- Keycloak, and live AI generation in any suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

**REQ-08:** A Security Analyst can pick up a submitted request, assign or reassign it to a Security Analyst, or release it back to the queue, and every analyst on the request can follow its generation jobs.
- (1) Pick-up, assignment, reassignment and release record actor and time, and the assignee's name shows on the request, the review queue and the dashboards: D-05, D-09, D-13 to D-17.
- (2) The review queue has an "Assigned to me" view that the analyst dashboard counts: D-13 to D-15.
- (3) Any Security Analyst who may read the request can read its questionnaire and draft generation jobs: D-18.
- (4) One analyst is accountable, and assignment does not restrict which analysts may contribute (decision 10): D-05.
- (5) An analyst cannot pick up or be assigned a request they raised, enforced in Strapi (G-1): D-06, D-07.

**COLLAB-01:** The Requestor and Security Analysts can add attributed plain-text notes to a request at any point after submission and read its notes history.
- (1) Each note records author, local time and text, and notes are append-only: D-21, D-25.
- (2) A new note is flagged on the analyst queue and the Requestor's Home until read: D-24.
- (3) A note can be marked as changing the AI inputs, and the AI context (INT-05) includes notes: D-26 to D-29.
- (4) Another Requestor cannot list or read the notes by any route, enforced in Strapi: D-23.

**ROADMAP success criteria (Phase 13):**
1. An analyst picks up a request from the queue, and it shows "Assigned to <name>" everywhere it appears: D-05, D-13, D-16, D-17.
2. "Assigned to me" is a queue view and a dashboard figure, and any analyst on the request can follow its generation jobs: D-14, D-15, D-18.
3. The Requestor adds a note after submission, and the analyst sees it flagged on the queue and the request: D-22, D-24.
4. The analyst replies with a note the Requestor sees; each note shows its author and local time, and another Requestor cannot read it: D-23, D-25.
5. A note can be marked "changes the AI inputs", which Phases 12, 15 and 16 read: D-26 to D-29.

**Closes:** UAT-013 (neither actor can add information after submission) and UAT-014 (no pick-up or assignment; jobs readable only by their initiator).
**Carried items settled here:** security note O-5 (D-07, D-20), Phase 10 D-27 (D-18), and this phase's part of R-08-36 (D-19).
**Intent:** F2, A1, A2, R2.
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

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

### The assignment model (REQ-08; decision 10; G-1; UAT-014)

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

### Where the assignee shows (REQ-08 criteria 1 and 2; Phase 11's seams)

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

### Generation jobs, R-08-36 and O-5 (REQ-08 criterion 3; G-6; Phase 10 D-25 to D-27)

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

### Notes (COLLAB-01; UAT-013)

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

### Notes and the AI inputs (COLLAB-01 criterion 3; INT-05; G-3; decision 5)

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

### Roles, grants and fixtures

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

### Verification and plan shape

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

### Interface

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

### Planner's Discretion

- Module placement: the assignment and notes services, the eligibility and assigned-analyst predicates, and whether the notes routes live under the request API or a new `csrm-request-note` API folder.
- The names of reason codes, Functions, operations, fields and envelope versions, within the families above.
- The bounds: the note-length bound against Phase 12's context budget (5,000 is the decision unless research finds it breaks the budget), the per-request note cap, the assignment-log cap and the eligible-list size.
- The SQL and indexes for the assignee, unread and AI-input predicates, provided the totals are exact.
- The second analyst persona's name and email.
- How the work splits into plans, provided D-33's serialisation holds.
- Copy, layout, routes and visuals: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #10 Pick-up and assignment | One accountable assignee; self-assignment or any analyst assigns; reassignment recorded; editing not exclusive | D-05 to D-09, D-13 to D-17 |
| G-1 Separation of duties | Nobody is assigned a request they raised; the service agent never holds human-analyst grants | D-06, D-07, D-10, D-20, D-30 |
| G-6 Housekeeping | Every human analyst sees a request's generation jobs (Phase 10 D-25, D-47); the orchestrator approves contract-gap records; a Playwright run leaves the tree clean | D-01, D-18, D-32 |
| G-3 AI data policy | Minimal context; Requestor text delimited as untrusted; runs record a context summary, not text | D-26 to D-29 |
| #5 Analyst instructions | Requestor text never in the instruction slot; always delimited data | D-27 |
| #2 Attachments (pattern) | The analyst opts supplementary text into the AI context, off by default | D-26 |
| #18 Notifications | "Assignment" and "new notes" are Phase 17 events; this phase records the facts | D-12, D-24 |
| #16 and G-13 Labels and closure | "Released" names the assessment; the request closes at release and close; the released predicate covers `approved` and `closed` | D-05, D-08, D-22 |
| #17 Review before release | The assigned analyst marks the assessment reviewed (Phase 17.1) | D-10, D-11 |
| G-11 Nominated risk owners | The assigned analyst cannot be a risk owner or executive approver (Phase 17 extends D-06); "in a note" is the Requestor's path | D-06, D-23 |
| G-12 Who reads the assessment | Notes stay with the Requestor and the analysts; participants never read them | D-23 |
| G-15 Contest points | Contest points are not notes; notes have no target, status or round | D-21, D-23 |
| G-16 and G-18 Monitoring and events | Escalations, reminders and participants' events reach the assigned analyst | D-08, D-11 |
| G-4 Premium bar | Keyboard, optimistic feedback, Undo, skeletons, empty states, no lost input, phone layouts | D-25, D-34 |
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoints

Both records follow the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, and Audit Semantics and Limitation.

1. **`docs/contract-gaps/phase-13-request-assignment.md`.**
   - **The gap:** the JDL request has `requestor`, `sponsor` and `revertedBy` only, with no assignee (UAT-014).
   - **The extension:** D-01 item 1.
   - **Write discipline:** D-09. One protected operation writes the facts, serialised per request; the log is append-only and versioned; gates read `assignedAnalyst` only.
   - **The rules:** the eligibility rule (D-06), the G-1 reading (D-07), the change rules (D-08) and the assigned-analyst predicate (D-10).
   - **Not added:** a lead role, an assignment entity, any edit restriction.
2. **`docs/contract-gaps/phase-13-request-notes.md`.**
   - **The gap:** no comment or activity entity exists (catalogue design note 6; brief §20; UAT-013).
   - **The extension:** D-01 item 2.
   - **Append-only discipline:** D-21.
   - **The rules:** the posting window (D-22), the readers (D-23), the read state and its rule (D-24), and the AI-input mark and its log (D-26).
   - **The context summary's notes section** (D-28), without a schema change.
   - **Not added:** edit, delete, internal-only notes, targets, statuses, and any reach for participants.

**Checkpoints:** each record is followed by a `checkpoint:decision` task at which the executor stops. Under G-6 the orchestrator reviews the record, approves it, and records the approval in the record itself. Only then does the plan that changes `apps/backend/src/api/*/content-types/*` run. The content-type freeze check then lists exactly the approved schema files. The change is additive, so Strapi's schema sync creates the columns and tables, and `apps/backend/database/migrations/` stays empty, as in 06.1, 06.7, 06.8 and Phase 12. The proof boots a fresh test database, reads legacy requests as unassigned with no notes, and confirms the development database's new tables after the orchestrator's next Strapi start.
</contract_gaps>

<authorisation>
## Authorisation Model

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record-level rule, against the resolved IdamBox User (`ctx.state` after the identity middlewares), identically under the development identity bridge and a Keycloak-verified user. Navigation visibility is not authorisation: every control the UI hides is also refused by Strapi.

**Grants:**
- **Assignment** (change and eligible list): the human Security Analyst only, held twice (the grant and `HUMAN_ANALYST_ONLY_OPERATIONS`).
- **Notes** (list, create, mark read): the Requestor birthright and the Security Analyst, with the record rule of D-23.
- **The AI-input mark:** the human Security Analyst only, held twice.
- **Generation-job reads and retries:** unchanged human-only grants (Phase 10, Phase 12 D-32); the record rule widens to any human analyst who may read the request (D-18).

**Positive cases:**
- any eligible human Security Analyst picks up, assigns, reassigns and unassigns (D-05 to D-08) and reads the eligible list;
- the request's requestor and any human Security Analyst list, add (inside D-22's window) and mark read notes;
- any human Security Analyst changes a note's AI-input mark;
- any human Security Analyst reads and retries a request's generation jobs.

**Negative cases** (each proven in the API by a Strapi integration test or matrix row, and in the UI by a web unit test or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| Another Requestor lists, reads, adds or marks read the notes of Jane's request | 404, persistence unchanged | Jane's request shows its existing permission state, and no note, flag or count of hers appears anywhere for the other Requestor |
| A participant who is not the requestor (Phase 17 onward) uses any notes route | 404 (the notes predicate never includes participants) | No notes on any participant view |
| A Requestor calls the assignment operation, the eligible list or the AI-input mark | 403 (no grant) | No assignment control and no AI mark shown |
| A Requestor's note create carries the AI-input mark | 400, nothing written | The Requestor's composer has no such control |
| The service agent calls assignment, the eligible list or the AI-input mark | 403 (human-only set) | Not applicable (no web session) |
| The service agent uses a notes route on another person's request | 404 | Not applicable |
| The service agent, an inactive user, a Requestor-only user or the request's requestor is named as assignee | 409 `ASSIGNEE_NOT_ELIGIBLE` | Never offered by the picker |
| An analyst who raised the request picks it up, assigns, reassigns, unassigns, reads its eligible list or changes a note's AI-input mark on it | `OWN_REQUEST` refusal (research fixes 403 or 409 with the closed reason) | No such control on that request, and a line saying another Security Analyst picks it up |
| A stale assignment (`expectedAnalyst` differs) | 409 `ASSIGNMENT_CHANGED` with the current assignee | The view refreshes and names who holds it |
| An assignment change on a draft | 409 `REQUEST_NOT_SUBMITTED` | Not offered |
| Unassigning a released or closed request | 409 `ASSIGNMENT_REQUIRED` | Only Reassign offered |
| A note on a draft, released or closed request | 409 `NOTES_CLOSED` | The composer is replaced by the reason |
| Editing or deleting a note | No such route exists (the matrix and the inventory prove it) | No such control |
| Deleting a request that holds a note | 409 `REQUEST_HAS_NOTES` | Not applicable (no web caller) |
| An analyst submits a draft they did not raise | Refused, nothing written (D-20) | Not offered |
| A Requestor or the service agent reads or retries a generation job by id | 403 | Not applicable |
| No identity, or no token | Per the matrix conventions: 403, or the token family's status | The sign-in path |

**Phase 17.1's assigned-analyst-only steps** add their negatives (`REQUEST_UNASSIGNED`, `NOT_ASSIGNED_ANALYST`) through D-10's predicate.
</authorisation>

<seams>
## Cross-Phase Seams

- **Phase 10** (executes first):
  - the generation-jobs read's `canRetry` and the by-id job reads widen here (D-27, D-18);
  - its harness identity `second-analyst` serves the Strapi tests;
  - its closed conflict-reason list gains this phase's codes;
  - its navigation guard protects unsent notes;
  - `LocalInstant` and X-3 show note times;
  - its UI-D30 deferral of the hub's `Owner` label lands here.
- **Phase 11** (executes first):
  - its navigation profile gains Assigned to me (D-13 seam), and the `Requests` count changes meaning (D-14, reversing D-10's count);
  - the "Requires my attention" labels on the queue select, the Home tile and the Review queue widget drop "my";
  - its holder sentences name the assignee (D-21, D-27);
  - My requests and quick find gain the assignee (D-17, D-13);
  - the queue gains the assignee column Phase 11 deferred (D-29).
- **Phase 12** (executes first):
  - this phase builds its notes extension point (D-08) and a new context-summary envelope version;
  - its "What the AI used" sheet gains the notes group;
  - the signal resolves "the latest completed run" exactly as `generation.runId` does (Phase 12 D-25).
- **Phase 14:**
  - attachments may be posted with a note (Phase 14 decides an optional link from the attachment to its note, "notes give files their context");
  - the per-file AI opt-in follows D-26's analyst-only mark pattern;
  - the "AI inputs changed" signal (D-29) gains files on the same rule;
  - attachments use D-23's readers.
- **Phases 15 and 16:**
  - their operations use the context builder, so marked notes are included automatically;
  - they read D-29's signal to offer re-runs, and declare each operation context-wide or risk-scoped;
  - QUES-12's "the notes" means the marked notes, so Phase 15's success criterion 1 marks the offshore-support note first.
- **Phase 17:**
  - D-06 gains the G-11 exclusion, and the risk-owner nomination refuses `assignedAnalyst`;
  - the participant read never reaches notes (D-23);
  - reserving release for response to the assigned analyst is recommended (D-11);
  - unassign is refused from the first release for response (D-11);
  - the notification centre sends "assignment" and "new notes" events within D-23's readers (D-12, D-24);
  - its risk-owner fixture identity sits beside this phase's second analyst persona (D-31);
  - the first slice of `apps/csrm/e2e/risk-owner-journey.spec.ts` has the analyst pick up the request, because Phase 17.1's submit needs the assigned analyst.
- **Phase 17.1:**
  - `assertAssignedAnalyst` gates Mark reviewed, submit, recall, and release and close (D-10);
  - unassign is refused while a round is open;
  - a review by a previous assignee is 17.1's to settle (D-11);
  - release and close moves the request to `closed`, which makes notes read-only (D-22) and keeps reassign-only (D-08).
- **Phase 17.2:** contest points are not notes (glossary), but their reply threads reuse the notes thread pattern (append-only, attributed, local time). The contest history view never includes notes.
- **Phase 19:**
  - the review queue's export carries the assignee column and honours the `assignee` and `notes` filters;
  - no export or print-ready report includes a note, because participants receive exports (G-12).
- **Phase 20:**
  - G-16's escalations and NOTIFY-02's reminders go to `assignedAnalyst`, which D-08 keeps set after release;
  - Phase 20 decides the fallback for requests released before this phase (D-11).
- **Phase 21:**
  - time to pick-up, reassignments and per-analyst workload come from the versioned `assignmentLog` and the current facts;
  - persisted job history closes R-08-36 (D-19).
- **Phase 22:**
  - the Admin holds no analyst grants, so is never eligible (D-06);
  - auto-assignment on an analyst's first action is a candidate setting (deferred);
  - the service agent's role review inherits D-30's exclusions.
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-013 and UAT-014 in full; UAT-041 for job visibility.
- `.planning/uat/product-gaps/REPORT.md`:
  - §4: "My work by stage (assigned to me)", "Messages from the analyst", the job health row;
  - §5: the analyst sidebar's Requests badge;
  - §8: the Phase 13 proposal;
  - §9: decision 10.
- `.planning/uat/product-gaps/JOURNEYS.md`: area 2's "A1 requestor adds information" and "A1 analyst adds information", and the F2 queue journey.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F2, A1, A2 and R2.

### Planning authority
- `.planning/ROADMAP.md`: the Phase 13 entry (goal, decisions, contract line, success criteria 1 to 5), and the entries for Phases 14, 15, 16, 17, 17.1, 17.2, 19, 20, 21 and 22 for the seams. The post-demo journey paragraph.
- `.planning/REQUIREMENTS.md`:
  - REQ-08 and COLLAB-01, with their acceptance criteria;
  - INT-05, QUES-12, ASSESS-21, ASSESS-22, ASSESS-24, ASSESS-25, NOTIFY-01, NOTIFY-02, RISK-04 and COLLAB-04, for the seams.
- `.planning/NEXT-WAVE-DECISIONS.md`: #2, #5, #10, #16, #17, #18, G-1, G-3, G-4, G-6, G-11, G-12, G-13, G-15, G-16 and G-18.
- `.planning/POST-DEMO-BRIEF.md` §1 and §2 (overrides and dev-mode rules); `.planning/STATE.md` Decisions; `.planning/PROJECT.md`.

### Earlier phases this phase builds on
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`:
  - D-19 (local time) and D-22 (conflict reason codes);
  - D-25 to D-27 and D-47 (the generation-jobs read; this phase's widening);
  - D-40 (serialisation).
- `.planning/phases/10-existing-flow-gap-closure/10-13-PLAN.md`: the generation-jobs read, `canRetry`, the narrowed parity paths and the `second-analyst` harness identity.
- `.planning/phases/10-existing-flow-gap-closure/10-08-PLAN.md`: the navigation guard. `10-01-PLAN.md`: `formatInstant`, `LocalInstant` and the time-zone cookie.
- `.planning/phases/10-existing-flow-gap-closure/10-UI-SPEC.md`: UI-D30 (the hub's `Owner` label) and extensions X-1 to X-5.
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md`:
  - D-06 to D-13 (navigation profile, labels, counts, seams);
  - D-18 to D-21 and D-27 (Homes, holder, next-action sentences);
  - D-29 and D-30 (queue columns and search);
  - D-34 (My requests) and D-49 (quick find);
  - the Deferred Ideas naming this phase.
- `.planning/phases/11-navigation-landing-and-list-clarity/11-UI-SPEC.md`:
  - §1.1 to §1.3 (profiles and counts);
  - §4.3 (quick-find options);
  - §5.2 and §5.3 (Homes);
  - §6.1 (holder sentences);
  - §7.1 and §7.3 (Requests and My requests);
  - X-6 to X-10.
- `.planning/phases/11-navigation-landing-and-list-clarity/11-PATTERNS.md` and `11-RESEARCH.md`: the queue, Home and navigation file map.
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md`:
  - D-04 to D-08 (the context builder, slots, bounds and extension points);
  - D-19 to D-21 and D-25 (the run record and run read);
  - D-32 to D-34 (human-only generation, G-1 seams).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-RESEARCH.md`: "Envelopes (versioned, closed)" and "The assessment context" (field table, delimiting, bounds).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-UI-SPEC.md`: §2 (the "What the AI used" sheet), X-13 (side sheet) and X-14 (Undo toast).
- `.planning/phases/08-production-integration-and-hardening/08-SECURITY.md`: observation O-5. `docs/security/phase-08-residual-risks.md`: R-08-36.

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md`:
  - §3 (the Requestor collaborates with Security Analysts; Security Analysts ask for more information);
  - §19 (untrusted user text);
  - §20 (collaboration: comments, activity, actor identity; record gaps rather than competing models);
  - §22 (IDOR, output escaping, unsafe HTML).
- `docs/references/idambox-datamodel.jdl`: `CsrmAssessmentRequest` (its relations and `CsrmRequestStatus`), `IdamBoxUser`, `CsrmQuestion.reviewComment` and `CsrmRisk.comments` (why neither fits).
- `CONTEXT.md` (repository root): the glossary ("Released", "Closed", and "Contest point", which avoids "Note"). A plan adds "Assigned analyst" and "Note".

### Contract, authorisation and records
- `docs/references/specification.json`: `ApiCsrmAssessmentRequestCsrmAssessmentRequestDocument`, `AssessmentRequestQueueItem`, `AssessmentRequestQueueResponse`, `AssessmentRequestLifecycleNextAction`, `MyRequestStatusSummary`, `DashboardReviewQueue`, `AssessmentRequestSummary`, `QuestionnaireAssessmentRequestAvailable`, `QuestionnaireGenerationJob`, `AssessmentDraftJob`, and the conflict response schemas.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`:
  - design notes 6 and 9;
  - the request Functions;
  - `function.questionnaire_generation.*`, the pattern for API-only human-only Functions.
- `docs/references/served-operations.json`.
- `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the record format, and the fact-plus-log posture.
- `docs/contract-gaps/phase-04-composite-release-fact.md`: the released and closed states. `docs/contract-gaps/phase-04-deterministic-draft-jobs.md` and `phase-06.2-questionnaire-generation-provenance.md`: the job contracts D-18 widens.
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.
- `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`, `apps/backend/src/keycloak/development-fixture-subjects.ts` and `idp/keycloak/import/idambox-realm.json`: why the second analyst persona gets no fixture subject.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §4 AppShell, DataTable, Tags and chips, Dialogs, Toasts, Empty states, Record links and Skeletons; §5 Motion; §6 Do-not list.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md`: sequential dispatch, and revalidation after a Server Action.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts`:
  - `serializeRequestRevert` and `lockRequest`: the per-request serialisation the assignment operation reuses;
  - `prepareAnalystUpdate`: where D-20's submission refusal goes.
- `apps/backend/src/policies/csrm-authorization.ts`:
  - `HUMAN_ANALYST_ONLY_OPERATIONS` (lines 41-49);
  - `hasHumanAnalystOperation`, and `loadEffectiveGrants`, the birthright plus explicit roles;
  - `requireRequestOwnership`'s explicit-analyst bypass (lines 399-419).
- `apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts`: `applyBucket`, `applyCriteria`, `countReviewQueueBucket` and `REVIEW_QUEUE_ITEM_FIELDS`. The `open` bucket, the assignee and notes predicates, and the item fields join them.
- `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts`:
  - `REVIEWABLE_REQUEST_STATUSES` and `RELEASED_REQUEST_STATUSES`, which `acceptsNotes` and D-08 reuse;
  - `safeReviewFilters`, `parseAnalystReviewQuery`, `selectReviewQueueBucket` (the oracle) and `projectAnalystReviewRequest`.
- `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`: `findOne`'s server-side augmentation (requestor display name, relationships and lifecycle), the place for the assignment projection and the notes summary.
- `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts`: `actionFor` and the holder sentences (Phase 11 changes them; this phase names the assignee).
- `apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts`: `DashboardReviewQueue` and the `countReviewQueueBucket` calls, which gain the per-viewer counts.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` (`authorize`, line 20) and `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts` (`authorize`, lines 130-137). Both already take a `canReadAll…` flag; the workflows pass `false` today (`questionnaire-generation-workflow.ts:15`, `assessment-workflow.ts:822`).
- `apps/backend/src/middlewares/csrm-development-identity.ts` and `apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts`: the email-keyed development identity and the Secondary Requestor's seeding, the pattern for D-31.
- Phase 12's planned `apps/backend/src/csrm/ai/` context builder, `promptDataTag` (`apps/backend/src/csrm/prompt-data.ts`) and the run envelopes.
- Web:
  - `apps/csrm/src/features/requests/request-hub.tsx` (the `Owner` label) and `request-service.ts`, `request-actions.ts` and `request-schema.ts` (the typed service and Server Action pattern);
  - `apps/csrm/src/features/assessments/assessment-detail.tsx` (the analyst request page and job panels) and `assessment-list.tsx` (the review queue list and its queue labels);
  - `apps/csrm/src/features/assessments/assessment-request-link.tsx` and `apps/csrm/src/features/questionnaires/questionnaire-review.tsx`: the originating-request blocks that gain the assignee;
  - `apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts` (the tile and the Review queue rows);
  - `apps/csrm/src/components/csrm/data-table.tsx`, `confirm-dialog.tsx`, `record-link.tsx` and `revert-audit-summary.tsx`;
  - `apps/csrm/src/lib/auth/session-adapter.ts` and `development-session-adapter.ts` (the development roles, extended by D-31);
  - `apps/csrm/e2e/helpers/navigation.ts` (`signInAs`).

### Established Patterns
- **API-only, human-only Functions,** plus `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal (06.8, Phase 7 D-07, Phase 10 D-25, Phase 12 D-32).
- **Current fact plus append-only log** (06.8): gates read a dedicated fact, never the log; logs are versioned and parsed closed, failing safe.
- **Policy denial is 403; an unreadable record is 404 by design.** Denials keep persistence deep-equal, and responses never echo fixture titles (the matrix conventions).
- **Review queues are SQL predicates** with exact totals, checked against a semantic oracle (Phase 7 D-21, D-30).
- **Closed 409 reason codes** in `error.details.reason`, with actor-neutral copy (Phase 10 D-22).
- **Zod-free `*-domain.ts` modules** for client components; typed openapi-fetch services and Server Actions that revalidate; no raw `fetch`.
- **The server words, links and counts;** the web formats what it is given (Phase 7 D-02, D-34). Navigation is data (Phase 11 D-06).

### Integration Points
- **Strapi:**
  - the request routes, controller and services;
  - the questionnaire and assessment job controllers and workflows;
  - `dashboard-summary.ts`;
  - the Phase 12 context builder and run read;
  - `csrm-authorization.ts`;
  - the bootstrap seeds;
  - the two catalogue copies.
- **Web:**
  - the analyst request page `app/(app)/app/review/requests/[documentId]/page.tsx` and the Requestor request page `app/(app)/app/requests/[documentId]/page.tsx`;
  - the review queue page, and the new Assigned to me route;
  - the navigation profile `src/config/navigation/navigation.ts` (Phase 11);
  - both Homes and My requests (Phase 11);
  - the quick-find action (Phase 11);
  - the analyst questionnaire and assessment pages;
  - the "What the AI used" sheet (Phase 12).
- **Tests:**
  - `apps/backend/tests/*.integration.test.ts`, the authorization matrix, and the Strapi HTTP harness (`identities.secondAnalyst` from 10-13);
  - Vitest beside each module;
  - the new Playwright journeys under `apps/csrm/e2e/`.
</code_context>

<specifics>
## Specific Ideas

- **UAT-013's scenario is the yardstick.** After UAT-A's questionnaire exists, Jane learns that after-hours vendor support will come from an offshore team with administrator access. She adds a note on her request. Bob sees "New note" on his queue row and on the request, marks the note "Changes the AI inputs", and the hub and the questionnaire page say that one note changed the AI inputs since the questionnaire was generated. In Phase 15, that is the note his follow-up questions use. Bob replies; Jane sees the reply flagged on her Home and her request, with Bob's name and the local time. Maya, the Secondary Requestor, finds nothing of it anywhere, and gets 404 from every notes route.
- **UAT-014's scenario.** Bob opens Requests, sees the request unassigned, and picks it up from the row: "Assigned to Bob Doe" appears on the row, the request, his Home, quick find, the questionnaire and assessment pages, and Jane's request page and Home. He reassigns it to the second analyst, who finds it in Assigned to me and follows the draft job Bob started. On a request Bob raised himself, from his own section, he sees no Pick up, and the API refuses him.
- **Development database.** The schema change, the seeded second analyst and the catalogue grants reach the operator's development database only when the orchestrator restarts Strapi. Requests there (UAT-A, UAT-B, UAT-C, and Bob's own two) start unassigned with no notes. Tests use their own databases.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The research and the UI-SPEC raised these points. Each is settled as follows and binds the plans:

- **Unread ordering:** the notes record gives each note a per-request `sequence` and the read state a `lastReadSequence`, and unseen is computed from the sequence, never from post times. Both fields are in `docs/contract-gaps/phase-13-request-notes.md` before its approval checkpoint.
- **`ASSIGNMENT_CHANGED`:** the 409 carries only its closed reason, in Phase 10's closed `details`, and the web re-reads the request to show the current assignee. There is no new error schema.
- **`OWN_REQUEST`:** 403 with the closed reason, not 409. Phase 10's web transport keeps the reason on a 403 too, with a test.
- **Phase 11's queue wording:** D-13 governs. "Assigned to me" is an `assignee` filter over the `open` bucket, not a new bucket. Phase 11 leaves the slot without fixing its model, and its plan 11-06 is corrected to match.
- **People projection:** the plan that adds the assignee relations filters `populate` and projects every person as `documentId` and `displayName` only, including today's `revertedBy`, which currently exposes email, username and external subject to the Next server.
- **UI-SPEC UI-D7 and UI-D18 are accepted:** sidebar counts open their page unfiltered (Phase 11 §1.3), with the Home figures opening the exact lists, and unsent note text survives in-app navigation for the browser session.

---

*Phase: 13-request-pick-up-and-notes*
*Context gathered: 2026-10-01*

# Phase 17: Mitigation response and residual reassessment - Research

**Researched:** 2026-10-01
**Domain:** Strapi 5 record-level authorisation (a participant read across every assessment route), new audit entities for response rounds, AI proposals on Phases 12, 15 and 16's machinery, a hardened directory search with security logging, development fixtures that keep ADR 0004's Keycloak files consistent, and a sliced Playwright journey
**Confidence:** HIGH for today's code (read this session, quoted below). MEDIUM for the seams to Phases 10 to 16, 19 and 19.1, which are planned but not built (cited from their CONTEXT, RESEARCH and PLAN files). LOW only where the Assumptions Log says so.

## Summary

Phase 17 is mostly an authorisation and workflow phase built on planned machinery. It adds no library. The risky part is breadth, not novelty:
- one participant predicate must answer correctly on every assessment, risk, control implementation, round, response, export and notification route;
- the authorisation matrix gains a seventh caller;
- several existing seeds and tests silently assume things the G-11 rules forbid.

The CONTEXT's decisions hold against today's code with three corrections the planner must carry:
1. **Bob is seeded as a risk owner.** The development seeds name Bob, the Security Analyst, as `riskOwner` on mutable assessments. The Risk Register journey edits one of those risks as Bob. Under D-18 that edit becomes `409 ACTOR_IS_RISK_OWNER`, so the seeds, their seed tests and that spec must change in the plan that adds the owner rule.
2. **The response kinds must read the participant predicate, not the released one.** Phase 19.1 reads assessment notifications through Phase 19's *released* predicate. Phase 17's `response-requested` concerns an unreleased assessment, so its readability must use the participant "may read now" half of that predicate, or every response notification disappears.
3. **The new journey must be added to the mobile project.** Playwright's `mobile` project runs only an explicit `testMatch` list, so `risk-owner-journey.spec.ts` must be added to it or it never runs at 375px.

**Primary recommendation:**
- **The participant predicate.** Build one participant module with a pure form (`participationOf`) and an SQL form (EXISTS fragments), proven equal against an oracle. Put it behind Phase 19's one released-assessment predicate and Phase 19.1's readability.
- **Order of work.** Hang everything else off that module in D-78's order: rounds, responses and decisions as two-table writes under a fixed request-then-assessment lock order; the reassessment as a new operation on Phase 15's generic job registry and proposal items with Phase 16's field units; the people search hardened in place with one `csrm.people.search` line through Phase 14's security event log.
- **The journey.** Create `risk-owner-journey.spec.ts` as one `@journey` test made of named slice functions over a shared `JourneyRecords` object, so Phases 17.1, 17.2 and 20 insert or append slices without restructuring.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Participant predicate, gate fact, stage and holder derivation | API / Backend (pure module plus SQL fragments) | Database (EXISTS predicates) | Authorisation is Strapi's (AGENTS.md); the SQL form keeps lists, counts and notifications exact |
| Owner nomination, G-11 refusals, the editable guard | API / Backend | — | Record-level rules against `ctx.state` identity, never the web |
| Response rounds, responses, decisions | API / Backend (transactions under locks) | Database (new tables) | Audit facts written in the event's transaction |
| Residual reassessment | API / Backend (job registry, provider, adapter) | AI provider (deterministic in every suite) | AI is advisory; the server owns ratings (D-49) |
| People search and its log | API / Backend | Deployment log platform (SIEM) | Least privilege and logging (G-17; ISO/IEC 27001:2022 A 8.15, 8.16) |
| Response notifications | API / Backend (Phase 19.1's service) | — | Written in the event transaction; readability at read time |
| Participant page, response form, analyst panels, picker | Browser / Client (small client islands) | Frontend Server (RSC renders reads, Server Actions call the typed API) | AGENTS.md: Server Components first; no raw fetch in pages |
| Development persona, realm user | Dev tooling (seed, realm import) | — | ADR 0004 consistency; Keycloak never started |

<user_constraints>
## User Constraints (from 17-CONTEXT.md)

Copied verbatim from `17-CONTEXT.md` (`<decisions>`, `<deferred>` and its Orchestrator Confirmations); only heading levels are lowered by one. The CONTEXT's `<requirements>`, `<operator_decisions>`, `<contract_gaps>`, `<authorisation>` and `<seams>` sections bind as well and are read in place. **The Orchestrator Confirmations override the decisions they name:** the notification centre (D-56 to D-63) and the eligible-person predicate (D-16) are Phase 19.1's; `phase-17-notifications.md` is not written; NOTIFY-01 moved to 19.1; Phase 17 keeps the `response-requested` and `response-submitted` kinds and success criterion 5.

### Orchestrator Confirmations (2026-10-01; binding)

The discussion raised four shared-file changes. Each is settled as follows and binds the research, the UI-SPEC and the plans:

- **The notification centre moves to Phase 19.1 (G-19).** D-56 to D-63 are now Phase 19.1's to decide and build: the entity, its read state, the centre's UI, and the kinds that exist before Phase 17. This phase keeps D-57's `response-requested` and `response-submitted` kinds, emits them through Phase 19.1's notification service, and no longer writes `phase-17-notifications.md`. NOTIFY-01 moves to Phase 19.1. ROADMAP success criterion 5 ("each participant is told in the app when the response waits or arrives") stays here. Phase 17 is now sized L.
- **ROADMAP wording:** the Phase 17 entry now says it narrows "every risk and control mutation is analyst-only", rather than reversing it (D-04).
- **ASSESS-12 criterion 1** now reads: existing controls each with an owner found by name and its evidence, or planned controls each with an owner found by name and a due date (D-33).
- **D-25's readable fields** include the issue statement, cause, impact and the rating rationales, which Phase 17.1's deciders need (17.1-CONTEXT D-47).
- **The eligible-person predicate (D-16) comes from Phase 19.1** (19.1-CONTEXT D-07), which executes first. This phase reuses it and builds no second one.
- **Phase 11's Requestor Home:** the new `participants` holder changes the wording of Phase 11's "With the Security Analyst" section. The Phase 17 plan that adds the holder updates that section's copy and its tests. No shared file changes now.

### Locked Decisions

#### Scope and contract boundary

- **D-01:** The content-type changes are exactly these, each through its contract-gap record and the approval checkpoint (`<contract_gaps>`), before any schema file changes. Names are proposals in JDL style; the records fix them.
  1. **On `CsrmAssessment`:** two optional attributes, `sharedWithParticipantsAt` (datetime) and `sharedWithParticipantsBy` (many-to-one `IdamBoxUser`): the participant gate fact (D-11).
  2. **`CsrmAssessmentRound`:** one row per round of an assessment: `assessment`, `kind` (a closed vocabulary owned by the contract, `response` in this phase), `number` (from 1 per assessment and kind, never reused), `openedAt`, `openedBy`, an optional analyst `message` (plain text), `closedAt`, `closedBy` and `outcome` (`closed` in this phase). Phase 17.1 may add `acceptance` as a kind and its outcomes (recalled, completed; 17.2's returned) by amending this record rather than adding a second round entity; 17.1 decides.
  3. **`CsrmRoundResponse`:** one per round and participant: `round`, `assessment`, `responder` (`IdamBoxUser`), the responder's parts at opening, `status` (`requested`, `draft`, `submitted`, `not-submitted`), `savedAt` and `submittedAt` (D-31).
  4. **`CsrmResponseItem`:** one per proposal: `response`, `risk`, `kind` (`proposed-control`, `proposed-owner`, `comment`), the proposed values (D-33), and the analyst's decision facts: `decision` (`accepted`, `rejected`, `lapsed`), the values the analyst changed, `decisionReason`, `decidedBy`, `decidedAt`, and the `controlImplementation` an accepted control created (D-38).
  5. **`CsrmNotification`:** one per recipient and event, with its per-user read state (D-56).

  Nothing else changes schema. No JDL entity covers rounds, responses or notifications (the catalogue's design note 6 already says collaboration and audit need model extensions), so none of these competes with a JDL entity, and decision 3 and decision 18 are the domain decisions behind them. The risk history (Phase 16), the AI run record and provenance (Phase 12) and the assignment facts (Phase 13) are extended by dated amendments to their records, not by new types. **Reversibility:** one-way - four new tables and two persisted columns holding audit facts; undoing them needs a data migration and loses the record of who was asked, who responded and who was told.
- **D-02:** Every new or changed endpoint follows the established chain (Phase 12 D-02, Phase 16 D-02): exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical; record-level checks in Strapi against the resolved IdamBox User (`ctx.state` after the identity middlewares), never branching on the auth mode; the operation or schema in `docs/references/specification.json`, then `api:generate` and a clean `api:check`; closed parsers registered in the contract parity guard; a row per route in the authorisation matrix, which gains a seventh caller (D-75); `docs/references/served-operations.json` regenerated with the dev servers stopped. The new content types get no Strapi core router: they are reachable only through the operations below, and the inventory and the matrix prove that no core route exists for them. The server shape and its web parser change in the same plan (the 06.9 lesson).
- **D-03:** The API changes are these groups, and no others. Paths and names are proposals within these families; research fixes them.
  1. **Owner nomination:** one batch operation, `PUT /api/v1/risk_assessments/{assessmentId}/risk_owners`, body `[{ riskId, ownerId }]` (1 to 200 pairs), returning `{ applied, unchanged }` (D-17). The existing `PATCH /api/v1/risks/{riskId}` keeps `riskOwner`, under the same validation.
  2. **Rounds:** open (`POST /api/v1/risk_assessments/{assessmentId}/response_rounds`, "Release for response", with the optional message) and close (`POST …/response_rounds/{number}/close`); one rounds read (`GET …/response_rounds`) for analysts and participants, with the submitted responses, their items and decisions.
  3. **The participant's own response:** read, save the draft and submit (`GET`, `PUT` and `POST …/response_rounds/current/my_response[/submit]`).
  4. **Response decisions:** one batch operation, `POST /api/v1/risk_assessments/{assessmentId}/response_decisions`, with `accept`, `reject` and `restore` per item (D-38, D-39).
  5. **Residual reassessment:** `POST /api/v1/risk_assessments/{assessmentId}/residual_reassessments`, body `{ riskIds?, instruction? }`, 202 with a job in Phase 16's risk proposal job family; its units are decided through Phase 12's decision operation as Phase 16 extended it (D-46 to D-50).
  6. **The participant read:** the existing Requestor branches of `GET /api/v1/risk_assessments/{assessmentId}`, `GET …/{assessmentId}/risks` and `GET /api/v1/risks/{riskId}/control_implementations` widen from "released and raised by me" to the participant predicate at every stage after the gate, with a participant projection (D-25, D-27); `GET /api/v1/my_risk_assessments` and its rating summary widen to participation (D-28).
  7. **Reads that change shape:** the analyst assessment detail gains the stage, the participants, the round summary, release-for-response readiness and the viewer's own participation (D-06, D-10, D-37); release readiness gains "No response round open" and "Responses decided" (D-14, D-41); the request lifecycle gains the stage step and a holder value (D-07, D-08); the review queue buckets absorb the stage (D-08).
  8. **The people search:** `GET /api/v1/users?search=` hardened in place (D-52 to D-54).
  9. **Notifications:** list (paginated, an unread filter), unread summary, and mark read (some, or all up to a time) (D-56 to D-61).
  10. **Phase 19's released-assessment export and report** authorise through the widened predicate (D-29).
  11. **Closed conflict reasons** added to Phase 10's vocabulary, for example `RESPONSE_ROUND_OPEN`, `RESPONSE_ROUND_NOT_OPEN`, `RELEASE_FOR_RESPONSE_NOT_READY`, `OWNER_NOT_ELIGIBLE`, `OWNER_IS_ASSIGNED_ANALYST`, `ACTOR_IS_RISK_OWNER`, `NOT_A_PARTICIPANT`, `RESPONSE_NOT_PERMITTED`, `RESPONSE_ALREADY_SUBMITTED`, `CONTROL_ALREADY_ON_RISK`, `RESPONSES_UNDECIDED` and `ASSESSMENT_NOT_RELEASED`, reusing Phase 12's AI policy reasons and Phase 16's `ASSESSMENT_NOT_MUTABLE` and `RISK_WITHDRAWN`.
  12. **Catalogue:** new API-only Functions (D-64) and renamed descriptions for the widened reads (D-65).

  **Reversibility:** costly - published operations, fields, filters, vocabularies and error codes.
- **D-04:** What this phase reverses or narrows, each named in the records:
  - **ASSESS-05's release-only visibility** and the 06.4 decision that the Requestor sees an assessment only after release (decision 3, G-12): participants read from the first release for response.
  - **v1's owner-only Requestor read** (Phase 4; `phase-04-composite-release-fact.md`, "Requestor visibility and projections"): the read comes from being named on the record (G-12).
  - **Phase 2's deferred directory contract** ("Keep sponsor lookup absent until a least-privilege sponsor-directory contract is defined"): the hardened search is that contract (G-17); sponsor selection stays off.
  - **"Every risk and control mutation is analyst-only"** is narrowed, not reversed: first-line people now author proposals, but every risk and control implementation is still written only by a Security Analyst, by accepting a proposal (ASSESS-12 criterion 2). The ROADMAP's word "reversing" is recorded as this narrowing.

#### The response stage in the published vocabulary (decision 3; G-12)

- **D-05:** The stage is derived from current facts, never stored as a status. No value is added to `CsrmAssessmentStatus` or `CsrmRequestStatus`. During the response stage the request stays `under-review` and the assessment `draft` or `in-review`, exactly as today's edit transition leaves them; the stage comes from the round facts (D-09) and the gate fact (D-11). This follows 06.8's precedent ("No value is added to any existing enumeration, because the stepper is a read-only projection rather than a stored state"), keeps every status-based predicate (queues, `acceptsNotes`, assignment rules, the release transition) unchanged, and keeps the JDL vocabularies intact; the assessment's own `closed` stays unused (G-13). **Reversibility:** costly - the published stage vocabulary and the lifecycle step are contracts.
- **D-06:** One closed stage vocabulary is published wherever an assessment is shown: the analyst detail, the participant projection, "My risk assessments" items and the analyst's assessment list items.
  - `not-shared`: before the gate opens (analyst views only);
  - `released-for-response`: a response round is open;
  - `with-security-analyst`: the gate is open, no round is open, and the assessment is not released;
  - `released`: released (v1 release now; 17.1's release and close later).

  Phase 17.1 adds `awaiting-acceptance` without restructuring. The display labels ("Released for response", "With the Security Analyst", "Released"; G-12) are values in the one status mapping (`statusPresentation`) and in Phase 19's label vocabulary, proven equal by its parity test (the G-13 seam).
- **D-07:** The request lifecycle (06.8 D-01's published stepper) gains a "Released for response" step after "Assessment drafted". It is current while a round is open and completed once a round has closed. It never shows as completed when no round ran: research and the UI-SPEC choose between omitting it for that request and a "not used" step state, and the "Step n of m" wording follows. The next-action sentences for both actors live in `request-lifecycle.ts` (Phase 11 D-27): the Requestor reads "Respond to round {n}" linking to the assessment, and the analyst reads who is still to respond, or "Close round {n} and decide the responses".
- **D-08:** The holder and the queues follow whose turn it is (Phase 11 D-20's seam).
  - **The holder** (Phase 11 D-02 item 5) is `requestor` while a round is open and the Requestor's own response is not submitted, and `analyst` once every response of the open round is submitted, or the round is closed. It gains one value, `participants` (name by research), while the Requestor has submitted and another participant has not, so the Requestor's Home never says "With the Security Analyst" when the work waits on a risk owner (UAT-003's lesson). Phase 17.1's acceptance rounds reuse the value. **Reversibility:** costly - a published vocabulary value.
  - **The review queue:** an open round with any response not submitted belongs to the `awaiting-requestor` bucket (the business's turn; the UI-SPEC rewords its label to cover risk owners); otherwise the request is in `requires-attention` as today. Both the SQL predicates and the semantic oracle change together (Phase 7 D-21 and D-30; `selectReviewQueueBucket`).

#### Response rounds (decision 3; ASSESS-11)

- **D-09:** "Release for response" opens round n. It is reserved to the request's assigned analyst through Phase 13's `assertAssignedAnalyst` (Phase 13 D-11 recommends this, because it decides who sees the assessment), human Security Analyst only, and it asks for confirmation (G-4: release for response is governance-significant). The confirmation names who will read the assessment (the Requestor and each owner, by name), says that nothing is final and that editing pauses until the round closes, and takes an optional message to the participants (plain text, at most 2,000 characters, never sent to the AI). In one transaction, under the assessment's serialisation and lock, it creates the round, one `requested` response per participant (D-31), the gate fact on the first round (D-11), and the notifications (D-57).
- **D-10:** Release-for-response readiness is its own server projection, in the shape of release readiness (requirement keys, labels, states and destinations; Phase 10 D-35's summary presentation), and the open operation refuses with `RELEASE_FOR_RESPONSE_NOT_READY` and the outstanding keys. It requires:
  - at least one non-withdrawn risk (Phase 16 D-13's active-risk rule);
  - on every non-withdrawn risk, a risk statement, an inherent and a residual rating, and an eligible owner (D-16) who is not the request's assigned analyst (G-11);
  - no AI-proposed value awaiting review and no open AI proposal (Phase 12 D-21, Phase 16 D-42), so nothing the AI wrote reaches first-line people unconfirmed;
  - no AI job running on the assessment, so no proposal lapses because the round opened (Phase 16 D-22);
  - an editable assessment with no round open, and an assigned request.

  It does not require "Mark reviewed" (17.1) or the release fields: nothing is final at this stage.
- **D-11:** The gate fact is `sharedWithParticipantsAt` and `sharedWithParticipantsBy` on the assessment (D-01). The first release for response writes it; Phase 17.1's first "Submit final assessment" writes it when no round ever ran (ASSESS-22 criterion 1); nothing else writes it, and nothing ever clears it: not a closed round, a recall, a return, a release or an owner change. The participant read reads it directly, never the rounds or any log (the 06.8 posture: a gate reads a dedicated server-owned fact). It is named for the read it opens, not for the response stage, because 17.1 can open it too. **Reversibility:** one-way - every participant read from this phase on depends on the stored fact.
- **D-12:** "Close round {n}" is reserved to the assigned analyst, like opening. It needs no reason. It asks for confirmation only when a participant has not submitted, naming them, because closing ends their turn in that round; otherwise it closes at once with a plain success toast (it cannot be undone). In one transaction it records `closedAt`, `closedBy` and the outcome, and closes every unsubmitted response as `not-submitted` (D-34). There is at most one open round per assessment; rounds never close on their own, because the response stage is analyst-controlled (decision 3).
- **D-13:** Rounds repeat as often as the analyst needs: round n+1 opens through the same operation, readiness and confirmation. A new round may open while items of earlier rounds are undecided; the confirmation says how many, and each stays decidable. There is no response due date in this phase (deferred).
- **D-14:** v1's release (still served until 17.1 replaces it) is refused while a round is open (`RESPONSE_ROUND_OPEN`), and release readiness gains two requirements: "No response round open" and "Responses decided" (D-41). The released record then carries the rounds and responses. A v1 release notifies the participants (D-57). Phase 17.1's submission readiness inherits both requirements.
- **D-15:** Assignment once participants wait (Phase 13 D-08 and D-11): from the first release for response, the request can be reassigned but not unassigned (`ASSIGNMENT_REQUIRED`). A reassigned analyst inherits round control, and events for "the assigned analyst" go to the current assignee (Phase 13 D-11).

#### Risk owners and separation of duties (G-11; ASSESS-21)

- **D-16:** One eligible-person predicate, in one shared module: an active IdamBox User who does not hold the Security Analyst Agent role (a service identity). It serves the people search's results (D-52), risk owners, control owners and proposed owners in responses, and every person relation the risk and control implementation write paths resolve (`riskOwner`, `treatmentOwner` and `controlOwner`, which today check only `accountStatus`). Phase 13's assignee eligibility adds the human analyst role on top of it, and Phase 17.1 reuses it for executive approvers.
- **D-17:** Nomination has two paths with one validation:
  - **the batch operation** (D-03 item 1) of `(risk, owner)` pairs in one transaction, which serves "Set one owner for every risk" (all non-withdrawn risks), a multi-select, and Undo (the previous owners, sent back as pairs);
  - **the risk update's `riskOwner`**, for a single risk from the risk card.

  Any human Security Analyst on the request may nominate (editing is not exclusive, decision 10), through the editable guard (D-43), while the assessment is editable and no round is open. Refusals carry closed reasons: an ineligible person (`OWNER_NOT_ELIGIBLE`), the request's current `assignedAnalyst` (`OWNER_IS_ASSIGNED_ANALYST`), a withdrawn risk (`RISK_WITHDRAWN`), a risk of another assessment (404 for the whole batch). Nomination is reversible, so it confirms with an Undo toast and never a dialog (G-4).
- **D-18:** Nobody who owns a risk acts on its assessment as a Security Analyst (G-11, extending G-1). A person currently named as a risk owner on an assessment is refused, whatever roles they hold, every analyst act on that assessment and its request: every content mutation, owner nomination, AI enqueue and decision, round open and close, response decision and v1 release (through the editable guard and the round operations, `ACTOR_IS_RISK_OWNER`), and every assignment action and note AI-input mark (Phase 13 D-06 and D-07, read the same way: choosing one's assessor or steering the AI inputs is the conflict G-11 removes). Phase 13's assignee eligibility gains "is not a named risk owner of the request's assessment", so a named owner is never assigned; with D-17, the assigned analyst is never named. Their analyst reads stay. The UI withholds those controls and says why.
- **D-19:** Every owner change is recorded in Phase 16's risk history (its D-18 to D-20): a field change of `riskOwner` with who, when, the old and new owner (id and display name at the time) and its source: an analyst edit, the nomination batch (with a batch id), or an accepted response item (D-38). The record amends `phase-16-risk-withdrawal-and-history.md`'s source vocabulary. Participation follows the change at once (D-22).
- **D-20:** Who can be named: the Requestor (success criterion 1 names them as owner of every risk) and any eligible person, analysts included, except the request's assigned analyst; never an inactive user or a service identity. An analyst named as an owner keeps their analyst reads and loses their analyst acts on that assessment (D-18).
- **D-21:** A different owner is proposed in a response (D-33: the Requestor or an owner, per risk, with a reason) or, by the Requestor only, in a note (Phase 13 D-23). Only a Security Analyst changes the owner, by accepting the proposal or nominating (ASSESS-21 criterion 3).

#### The participant read (G-12; ASSESS-22)

- **D-22:** The participants of an assessment are its request's Requestor and the current owners of its non-withdrawn risks; Phase 17.1 adds the named executive approvers. One predicate module (for example `assessment-participation.ts`) answers, for a viewer and an assessment, whether they participate, in which parts (`requestor`, `risk-owner` with their risks; 17.1's `executive-approver`), and whether they may read now. Participation is current: someone who stops owning every risk of the assessment loses the read at once, and their submitted responses stay on the record, attributed. The owner of a withdrawn risk only is not a participant (G-11).
- **D-23:** The gate is the fact of D-11. Before it, participants read nothing of the assessment. An assessment with no gate fact (released before this flow, or released in this phase without any round) is read whole only by its Requestor and only once released, as in v1; its owners see their own risks through Phase 20 (RISK-05).
- **D-24:** Everyone else gets the refusal a missing record gets (404), at every stage, on every assessment, risk, control implementation, round and response route, with persistence unchanged; the web shows the in-shell not-found page. This covers an unrelated Requestor, a nominated owner before the gate, a former owner, and anyone naming a missing record. A route the caller holds no grant for keeps the policy's record-independent 403, which discloses nothing (Phase 16's negative case 2 and the matrix conventions). A Security Analyst, who may read every assessment, calling a participant-only operation gets 403 with `NOT_A_PARTICIPANT`, because a 404 would be untrue (Phase 19 D-15's reasoning).
- **D-25:** The participant projection, a closed allowlist:
  - **the stage** (D-06), the viewer's parts, the Requestor's and the assigned analyst's display names, and the round summary (the current or latest round, its message, and the viewer's response status);
  - **the request summary** (G-12): number, title, description, assessment type, division, business unit, business criticality, and the systems and assets in scope by name;
  - **the assessment's fields:** summary, overall rating, overall control effectiveness, recommendations, overall rationale and next review date, and, once released, the release date and who released it;
  - **every non-withdrawn risk** with Phase 10 D-34's released risk fields, its owner's and treatment owner's display names, and its control implementations (control number and name, status, owner, due date, effectiveness);
  - **every submitted response** of every round, attributed (name, part, local time), with each item's decision and reason (D-36);
  - Phase 12's disclosure that AI assisted and a Security Analyst confirmed it (D-23 there; the UI-SPEC words it per stage).
- **D-26:** What participants never read: withdrawn risks (Phase 16 D-08); analyst-only facts (AI provenance markers, citations and runs, readiness, review facts, the risk's `comments` and `escalationDetails`, and anything else outside D-25's allowlist); Phase 16's risk history (Phase 17.2's history view decides participant access); the request's questionnaire, notes and attachments, and every request route, which keep their own rules (Phase 13 D-23; Phase 14). And between rounds, an AI-proposed value an analyst has not confirmed: a risk holding one (a suggestion added between rounds, Phase 16 D-33) is listed as being prepared by the Security Analyst, without its content, until confirmed, so first-line people never see unreviewed AI output as the analyst's view (decision 5's spirit; INT-06).
- **D-27:** Where participants read. The existing Requestor branches of the three read routes serve the participant projection at every stage after the gate, through the one predicate; no second participant read URL is added. The participant page is today's `/app/assessments/{documentId}`, now stage-aware. An analyst who is also a participant (for example an analyst named as owner, or the Requestor of their own request) uses the analyst page, which carries their participation (D-37) and their own response panel; "My risk assessments" links each item to the page the viewer's capabilities choose (the Phase 11 D-16 rule).
- **D-28:** "My risk assessments" (`GET /api/v1/my_risk_assessments`) lists every assessment the viewer participates in and may read now (D-22, D-23), for every actor, analysts included (the 06.3 rule that My lists are owner-scoped). Each item gains the stage, the viewer's parts, the round number and whether the viewer's response is awaited. It gains closed filters for the part, the stage and "awaiting your response". The rating summary reads the same predicate (released only), so Home's figures equal the list. The Requestor Home's "Needs your action" lists every awaited response (Phase 11 D-19 and D-20's seam), the sidebar's "My risk assessments" gains its count of awaited responses (Phase 11 D-10: counts only on items that hold work), and every figure opens an equal list (X-10). Quick find's Requestor assessment group reads the same list, so it widens with no work of its own (Phase 11 D-49).
- **D-29:** Exports and print follow the read (decision 12, G-12): Phase 19 D-14's one predicate becomes "participant and released", in that one place, so the released-assessment export, its A4 report route and the "My risk assessments" export open to every participant with no export change. Before release, a participant's export or report is refused with `ASSESSMENT_NOT_RELEASED` (409, "available once released"), because they can read the assessment; a non-participant gets 404 (Phase 19 D-15 and D-16). Phase 17.1 widens "released" to `closed` in the same place.
- **D-30:** The predicate is the one place later phases widen or read: Phase 17.1 adds executive approvers and the decisions; Phase 17.2 the contest points and history; Phase 20 owner-scoped reads for non-participants; Phase 18's table and Phase 21's metrics read it where they show participants anything.

#### Responses (decision 3; ASSESS-12)

- **D-31:** A response is one participant's answer in one round. Opening a round creates one per participant, `requested`; it becomes `draft` on the first save and `submitted` on submission; a round that closes first leaves it `not-submitted`. The response holds per-risk content (D-33), autosaves server-side with a visible saved state (X-1; Phase 10 D-11's pattern), is private to its author until submitted, and is submitted once per round, with a confirmation (G-4: submit is governance-significant) saying that it cannot be changed in that round and who will see it. A submitted response is immutable. Saves and submission are serialised per response, and a submission after the round closed is refused (`RESPONSE_ROUND_NOT_OPEN`).
- **D-32:** Who responds on what (ASSESS-12 criterion 3): the Requestor on any non-withdrawn risk of their request; an owner on the risks they own; a person in both parts on the union. Strapi refuses every other response item with `RESPONSE_NOT_PERMITTED` (403, because they can read the risk), a reader who is not a participant per D-24, and the service identity on every participant operation, whatever it holds (a response is a human act; Phase 19 D-13 refuses it exports the same way). The UI offers response controls only where they are allowed.
- **D-33:** Per risk, a response may hold:
  - **proposed mitigation controls** (decision 3): a short title (required), an optional description, `Existing` or `Planned`, a control owner found by name (required; D-16, D-55), a due date (required when `Planned`, the future `implementationDueDate`) and an evidence statement (required when `Existing`, what shows it operates; optional when planned). ASSESS-12's "an owner, evidence and a due date" is read by status this way, because a control in place has no due date and a planned one has no evidence yet. First-line people describe controls in their own words; mapping to the control library is the second line's job (D-38), so participants get no library picker;
  - **a proposed different risk owner** (one per risk per response), found by name, with a reason (at most 500 characters);
  - **a comment** for the analyst (plain text).

  Everything is plain text, never rendered as HTML or Markdown. Bounds (items per risk and per response, text lengths) are research's; the proposed defaults are 10 controls per risk, a 200-character title and 2,000 characters for descriptions, evidence and comments.
- **D-34:** No lost input (G-4). When a round closes, an unsubmitted response closes `not-submitted`, stays readable to its author, and seeds that person's draft when the next round opens, keeping only items on risks they may still respond on. Phase 10's navigation guard covers an unsaved field.
- **D-35:** A participant can submit a response with no items by choosing "Nothing to add" explicitly, which records that they looked; an empty draft cannot be submitted by accident.
- **D-36:** Submitted responses are visible to every participant and analyst of the assessment as soon as they are submitted, attributed, with each item's decision and reason once made, under their round. Drafts are visible only to their author. A former participant's submitted response stays visible to everyone else, marked with the part they held.
- **D-37:** An analyst who is a participant responds from their own response panel on the analyst page, through the same participant operations (granted by the Requestor birthright, D-64), and the analyst detail carries their participation and the reason their analyst controls are withheld (D-18).

#### The analyst's decisions on responses (ASSESS-12 criterion 2)

- **D-38:** Decisions are made once the round is closed, on an editable assessment, by any human Security Analyst on the request who is not a named owner (D-18), through one batch operation (D-03 item 4), so "Accept all" and multi-selects are one Server Action.
  - **Accept a proposed control:** the analyst chooses the library control (Phase 10's shared control picker; a control implementation requires one) and may change the proposed status, owner, due date and evidence, and set the effectiveness (default "Not Assessed"). The server creates the control implementation through the existing creation path, in the same transaction, linked to the item, recorded in the risk history with the item as its source (D-19). A changed proposal needs a reason, and the item records which values changed. Accepting into a library control already on the risk is refused (`CONTROL_ALREADY_ON_RISK`), and the dialog offers "Reject: already recorded".
  - **Reject:** a reason is required (at most 500 characters), and it is shown to the participants.
  - **A proposed owner:** accept (the nomination rules of D-17, the source recorded) or reject with a reason.
  - **A comment** needs no decision.

  Repeating an applied decision is a no-op; an unknown item is 404 for the whole batch.
- **D-39:** Undo (G-4; Phase 12's UI-D12 rule): `restore` returns an accepted control to undecided by removing the control implementation it created, but only while that implementation is unchanged and the assessment is editable, and returns an accepted owner by restoring the previous owner while the owner is unchanged; it returns a rejected item to undecided. Otherwise `restore` is refused with a closed reason and the copy names the next step. Every step is recorded.
- **D-40:** An item still undecided when its risk is withdrawn closes `lapsed`, citing the withdrawal; a reinstatement does not reopen it, and the analyst can ask again in the next round.
- **D-41:** "Responses decided" is a readiness requirement: every item of every submitted response on a non-withdrawn risk has a decision. It joins v1 release readiness now (D-14) and Phase 17.1's submission readiness; it does not block opening a new round (D-13).
- **D-42:** Decisions that create a control implementation or change an owner are content edits and take the accepted-edit transition; rejections and restores of a rejection change no content and take the serialisation and the guard but not the transition (Phase 16 D-23).

#### The editable guard in the response stage (Phase 16 D-22)

- **D-43:** While a round is open, Strapi refuses every analyst content mutation of the assessment with `RESPONSE_ROUND_OPEN`, through the one guard behind `withMutableAssessmentMutation`: assessment fields, risk create and update, owner nomination, control implementation create, update and delete, withdrawal and reinstatement, AI enqueue and every AI decision (dismissals and rejections included), response decisions, and v1 release. A job that reaches execution or completion after a round opened records its proposals as lapsed (Phase 16 D-22 and D-40). Participants then respond to stable content, as management responds to a draft report the assessor does not change underneath them. **Reversibility:** costly - every mutation path reads it.
- **D-44:** Allowed while a round is open: every read; notes (Phase 13's window includes `under-review`); reassignment (not unassignment, D-15); closing the round; and the participants' own saves and submissions, which require an open round instead.
- **D-45:** Between rounds the assessment is editable as before ("the analyst can still edit the assessment between rounds", root `CONTEXT.md`), and participants read the analyst's rework as it happens, under "With the Security Analyst" (G-12), subject to D-26. The guard takes the actor, and its order is fixed: not editable (`ASSESSMENT_NOT_MUTABLE`), a round open, the actor a named owner. Phase 17.1 adds the acceptance-round lock and the executive approver rule to the same guard; this phase leaves that lock to 17.1.

#### Residual reassessment (ASSESS-13; UAT-026)

- **D-46:** "Reassess residual risk" is offered per risk and for the whole assessment (every eligible risk in one run), on an editable assessment with no round open, human Security Analyst only. A risk is eligible when it is active and has an inherent likelihood and consequence and at least one control implementation; otherwise the control is disabled with the reason. It is offered whether or not a response round ran, because analysts record controls themselves too.
- **D-47:** It builds on Phases 12 and 16 with no parallel machinery:
  - **a job** in Phase 16's risk proposal job family and registry (read and retry by any analyst who may read the request, Phase 13 D-18), single flight per assessment, so two reassessments never propose over each other;
  - **a run** per provider call, with operation `residual-reassessment` (name by research) in Phase 12's closed run vocabulary, the risk relation set for a single-risk run, the instruction and the context summary (Phase 12 D-19, D-20);
  - **the AI data policy** checked at enqueue (409 with the policy reason) and again at execution (Phase 12 D-26 to D-29);
  - **an optional analyst instruction**, bounded and in its own slot (decision 5; Phase 15's validator in `apps/backend/src/csrm/ai/`, Phase 16 D-27).
- **D-48:** The context is Phase 12's builder (with Phase 13's marked notes and Phase 14's opted-in attachment text, automatically) plus, per target risk: its statement, cause and impact, its inherent and current residual likelihood, consequence and rating, its control implementations (control number and title, status, effectiveness, due date and evidence statement), and the submitted response comments and decided items on it. Every business-written value (evidence, responses, comments) goes in the untrusted data block (G-3); no person's name, number or date is sent. The run is risk-scoped: it includes the notes but never clears Phase 13's "AI inputs changed" signal (Phase 13 D-29).
- **D-49:** The proposal per risk has two units on Phase 16's field-change mechanism (its D-34 to D-37): residual likelihood and consequence with the derived rating, as one unit (Phase 16 D-36), and the residual rationale. "Per field" in ASSESS-13 means these units, because a rating derives from both scores.
  - The rationale cites the control implementations it relies on; a rationale citing none is flagged "No control cited" (Phase 12 D-14's pattern).
  - A residual score above the inherent score is dropped by the adapter, with the adjustment recorded, because residual risk is what remains after controls.
  - The residual rating counts planned controls (G-14), so the proposal is the risk left once every recorded control is in place, and the rationale names the planned ones.
  - Ratings are derived by `risk-scale.ts` (Phase 12 D-10), never by the model.
- **D-50:** The units are decided through Phase 12's decision operation with Phase 16's run-scoped mechanics: visible "Confirm" per unit and "Confirm all", and "Reject" (the API keeps `accept`; Phase 12's 2026-10-01 confirmation reserves visible "Accept" for the risk owner); `restore` for Undo; stale units never applied (Phase 16 D-37); a newer reassessment, or a newer rewrite proposing the same risk's residual unit, supersedes the older open unit (Phase 16 D-40, across the two operations); lapsed when the assessment stops being editable. Phase 16's "AI proposals decided" readiness covers them, and its overall-rating hint (Phase 16 D-15) shows when confirmed residuals move the highest rating. The AI never changes the record by itself.
- **D-51:** The deterministic provider and the wire tests follow Phase 12 D-15 and D-38: on a UAT-A-like context with recorded controls, it proposes a lower residual likelihood for a risk with an existing effective control and cites it, a proposal for a risk with planned controls only that names them, one uncited rationale, and one score above inherent that the adapter drops. Provider tests send model-facing JSON through `fake-openai-compatible-server.ts` and inspect the captured prompt (data block, instruction slot, no names).

#### The people search (G-17; ASSESS-23)

- **D-52:** One hardened operation for every caller, in place at `GET /api/v1/users?search=`: a term of 2 to 100 characters after trimming and no other query parameter (both refused with 400); at most 20 results, sorted by display name; only eligible people (D-16), so never an inactive user or a service identity; each result `documentId` and `displayName` only, never email, username, external subject or roles; matching on the display name only. Analysts' owner pickers use the same operation, and now need two characters (G-17). **Reversibility:** costly - a published operation's bounds.
- **D-53:** Callers: every active human user, through the Requestor's "Search Users" grant or the analyst's "Search Active Assessment Owners" grant. The service identity is refused (403), whatever it holds: naming people is a human act, no agent workflow needs it, and directory enumeration by automation is what the log exists to catch (ISO/IEC 27001:2022 Annex A 8.15 and 8.16; Phase 19 D-13's precedent for exports). Its matrix row changes from 200 to 403.
- **D-54:** Every search writes one line through Phase 19's security event log module (its D-18): a stable event name, the time (UTC), the actor (`documentId` and display name), the term, the result count and the outcome (`searched`, or `refused` with its reason); never a result. R-08-13 already treats these lines as personal data. The record amends `phase-19-exports-and-export-log.md` with the event. No in-app search history.
- **D-55:** The web offers one people picker for first-line and analyst use (the X-2 record picker, from Phase 10's `OwnerCombobox`): it sends nothing below two characters and says so, debounces, and shows display names only. First-line users meet it for control owners and proposed owners in the response; 17.1 reuses it for treatment owners and executive approvers. Sponsor selection stays unavailable.

#### Notifications (decision 18; G-18; NOTIFY-01)

- **D-56:** A notification is one fact per recipient per event: the recipient, the kind, the request (always set), the questionnaire and the assessment where the kind has one, a small versioned `facts` envelope holding only identifiers and numbers (a round number, a note id; never a title, a name or Requestor text), `createdAt` and `readAt`. It is written in the same transaction as the event it reports, through one notification service the workflows call. It is never created for the person who acted, for a service identity or for an inactive user. Events whose recipient is "the assigned analyst" create nothing while the request is unassigned: the queue's unassigned pool (Phase 13 D-14) is the team's channel, and there is no fan-out (Phase 13's deferral settled).
- **D-57:** The kinds in this phase, a closed vocabulary in code and in the contract that later phases extend without a schema change (Phase 12's run `operation` precedent):

  | Kind (proposed) | Event | Recipients |
  |---|---|---|
  | `request-assigned` | someone else assigns or reassigns a request to an analyst (Phase 13 D-12) | the new assignee |
  | `questionnaire-released` | a questionnaire is released or re-released | the Requestor |
  | `questionnaire-submitted` | the Requestor submits answers | the assigned analyst |
  | `response-requested` | a response round opens | each participant asked (D-31) |
  | `response-submitted` | a participant submits a response | the assigned analyst |
  | `assessment-released` | v1 release (17.1 replaces it with released and closed) | the Requestor and, when the gate is open, every participant |
  | `note-added` | a note is posted (Phase 13) | the other part: the Requestor for an analyst's note, the assigned analyst for the Requestor's |

  Phase 17.1 adds acceptance requested, executive approval requested, decision recorded and voided, round recalled, and released and closed; Phase 17.2 contest point raised and answered, and assessment returned; Phase 20 its reminders (G-18).
- **D-58:** Nobody is told about a record they may not read. A notification is listed and counted only while its recipient may read its subject, by the same predicates as the record reads (the request's, and D-22's for the assessment kinds), applied when the list and the count are read, never by a stored copy of access; a former owner's notifications disappear with their read, and a notification whose subject no longer exists is not shown. Counts stay exact; research chooses SQL predicates or a bounded in-memory filter.
- **D-59:** The server words each notification and gives its destination for the recipient at read time, as `request-lifecycle.ts` words next actions (Phase 11 D-27): one sentence naming the record by number and title, and the page the recipient's actor class opens (the analyst page for an analyst, the participant page otherwise). Titles are never stored in the notification, so a renamed request reads correctly and nothing is copied out of the record's own access rules.
- **D-60:** Read state is per notification and per person: opening one reads it, "Mark as read" and "Mark all as read" read them, and acting on the work reads it too (submitting a response reads that round's `response-requested`; answering the questionnaire reads `questionnaire-released`). A `note-added` notification counts as read once the person's note read state passes its note (Phase 13 D-24's seam), derived at read time: no GET has a side effect.
- **D-61:** The centre: a header control with the unread count (Phase 11 D-13: "Phase 17 adds the notification centre to the header"), opening a panel with the latest notifications (a popover from 768px, a sheet below), each opening its record, with "Mark all as read" and a link to a Notifications page with all and unread views and pagination. The count refreshes with every server render and after the person's own actions, with no polling (the direction's do-not 9; Phase 11 D-11's count rule), and a failed count read shows no badge.
- **D-62:** The centre is channel-neutral: it records that work waits for a person. Phase 20 adds its reminder kinds and email delivery through Strapi's email plugin as its own delivery facts (a delivery record or attributes, its record decides; ROADMAP Phase 20), without changing this entity; email stays out of this phase (decision 18, G-18, G-7).
- **D-63:** Notifications are never deleted in this phase and follow the request record's retention. A shorter retention for read notifications is a candidate Admin setting (deferred to Phase 22).

#### Roles, grants and catalogue

- **D-64:** New API-only Functions, in both catalogue copies, byte-identical, none granted to `role.security_analyst_agent`:
  - **human Security Analyst only**, each also in `HUMAN_ANALYST_ONLY_OPERATIONS` (and the matrix's mirror) as the second refusal: owner nomination; round open and close; response decisions; residual reassessment (its job read and retry join Phase 16's existing human-only proposal-job Functions);
  - **analysts and the Requestor birthright:** the rounds read, with the record rule of D-24;
  - **the Requestor birthright:** the participant's own response (read, save, submit), with the participation rule, and the service identity refused (D-32); notifications (list, summary, mark read), which every identity holds through the birthright and which list only the caller's own.

  Function names are research's within these families, and a catalogue design note records them. No new IdamBox Role (the brief's access rule; G-11 to G-14).
- **D-65:** The widened reads keep their Functions and URLs (`function.risk_assessments.risk_assessment_details_read_only`, `function.risk_assessments.my_risk_assessments`), with the FunctionApi names and descriptions that say "Released" or "own" updated to the participant scope. The people search FunctionApis keep their URLs, with descriptions that state the hardened contract. `served-operations.json` is regenerated.
- **D-66:** Every refusal in `<authorisation>` is proven in the API (Strapi integration tests and the matrix) and in the UI (Vitest, and Playwright where it is a journey step).

#### Development fixtures

- **D-67:** The personas for the journey and the proofs:
  - **Jane** (`jane.doe@idambox.com`): the Requestor;
  - **Bob** (`bob.doe@idambox.com`): the Security Analyst who picks up and releases;
  - **Phase 13's second analyst persona**: "another analyst" cases;
  - **Maya** (`maya.requestor@idambox.com`, the Secondary Requestor, already seeded with the Requestor birthright only and no Keycloak subject): the unrelated Requestor;
  - **a new first-line risk owner persona** who is not the Requestor: an active user with the Requestor birthright only, seeded behind `IDAMBOX_SEED_CSRM` and the development identity (the Maya pattern in `seed-assessment-navigation-lifecycle.ts`), offered by the development sign-in with the Requestor's capabilities and a persona label that does not read as an IdamBox Role. Unlike Maya, this persona gets a fixed Keycloak id in `apps/backend/src/keycloak/development-fixture-subjects.ts` and a matching user in `idp/keycloak/import/idambox-realm.json`, in the same shape and credential convention as Jane's and Bob's, changed together, so a local Keycloak sign-in can walk the whole risk-owner flow; the existing unit test "the fixture ids match the local realm import" proves the two files agree, nobody starts Keycloak, and the OIDC tests stay green.

  The persona's name and email are the planner's.
- **D-68:** The Strapi HTTP harness gains a `risk-owner` identity (Requestor birthright only) for integration tests and the matrix's seventh caller (D-75); the web's development roles and the E2E `signInAs` gain the persona; Playwright journeys create their own records. A development seed of an assessment released for response, with the persona as one owner, is the planner's choice for manual exploration and is never what a journey relies on.

#### Interface

- **D-69:** Surfaces:
  - **the participant page** (`/app/assessments/{documentId}`): the stage, the viewer's part, the round panel (round, message, the viewer's response status, submit), the request summary, the assessment, the risks with "Your risk" marked and a filter to the viewer's own, each risk's response area and everyone's submitted responses with decisions;
  - **the analyst editor**: release-for-response readiness and "Release for response"; owner nomination per risk and "Set one owner for every risk"; a participants panel with each person's response status; while a round is open, a banner saying editing is paused and "Close round {n}"; after close, a responses panel per risk with the decision controls; "Reassess residual risk" per risk and for all, with its proposals; the analyst's own response panel when they participate;
  - **My risk assessments**, the Requestor Home and the sidebar count (D-28); the request pages' stepper and next action (D-07); the analyst lists' stage marker (D-06); the header's notification centre and the Notifications page (D-61).
- **D-70:** The G-4 bar: a keyboard path for every action; confirmations for release for response, submitting a response, and closing a round with participants outstanding, and for nothing else here; Undo toasts for nominations, item decisions and unit confirmations; autosave with a visible saved state and no lost input (D-34); optimistic feedback with rollback; skeletons; empty states that say what to do next ("Add the controls you have or plan", "Nothing waits for you"); comfortable and compact density on the responses and participants lists; motion from the direction honouring reduced motion; phone layouts as cards and sheets (the response form for a risk opens as a sheet below 768px); every figure opens its records.
- **D-71:** Values come only from `docs/design/csrm-design-direction.md`. The UI-SPEC reuses X-1 (save status), X-2 (record picker), X-3 (dates and times), X-4 (separators), X-5 (in-place edit form), X-9 (compact stepper), X-10 (figure links), X-11 (AI provenance), X-13 (side sheet) and X-14 (Undo toast), Phase 16's field comparison extension (before and after), and Phase 13's unread marker; the stage values are tags through the one status mapping. It proposes new patterns (at least the notification centre and the response round panel) as recorded extensions numbered from the first free X-n the orchestrator gives, each recorded in the direction by a plan task before the task that uses it.
- **D-72:** Route budgets: the assessment editor stays within its budget (R-08-34): the nomination sheet, the responses panel and the reassessment proposals load on demand with `next/dynamic` from a Client Component, and static parts render on the server; the participant page renders on the server with a small, zod-free client response form; the notification panel loads on demand. `performance.spec.ts` stays green, or a recorded exception gives its reason.
- **D-73:** Copy follows the direction's voice. The terms are "Release for response", "Released for response", "Round {n}", "Close round {n}", "Your response", "Submit response", "Nothing to add", "Proposed mitigation control" (STATE.md: "mitigation control" is the display term), "Risk owner", "Set one owner for every risk", "Reassess residual risk", "Confirm", "Reject", "Notifications" and "Mark all as read"; never "Accept" for an analyst's act (Phase 12's confirmation). Exact strings are the UI-SPEC's. A plan adds "Response round" and "Participant" to the root `CONTEXT.md` glossary.

#### Verification and plan shape

- **D-74:** Each behaviour gets a failing test first at its seam:
  - **Strapi unit:** the participant predicate and parts, the gate and legacy rules, the stage and holder derivations, release-for-response readiness, the eligible-person predicate, response validation by part and status, carry-forward, decision rules and restore, the guard's order, the reassessment adapter (citations, the inherent cap, planned controls), notification recipients, readability and wording;
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test): every operation and every refusal in `<authorisation>`; the read at each stage for each participant and for Maya; the queue buckets against the oracle; rounds, responses and decisions end to end with history rows; the v1 release refusals; reassessment jobs, runs, units and readiness; the search bounds, filtering and its log line; notifications created in the event's transaction, hidden when access goes, read state and counts; the export and report predicate for participants;
  - **provider tests** through the fake OpenAI-compatible server (D-51);
  - **web unit (Vitest):** closed parsers, zod-free domain modules, every component and its refusal states (no response control on another owner's risk, none for an analyst who is not a participant, the not-found page for Maya, the paused-editing state, the two-character picker), the Undo and rollback paths, and the parity and chain guards.
- **D-75:** The authorisation matrix gains a seventh caller, `riskOwner`: a first-line person nominated as owner of a risk of Jane's fixture assessment, which is released for response, and not its Requestor. Every row states that caller's outcome (the helpers give the Requestor-shaped default; the participant rows state their 200s with mounted proofs), so every route proves that participation opens the assessment reads and nothing else: not the request, its questionnaire, notes or attachments, and no analyst operation. Later phases state the caller's outcome for each route they add. **Reversibility:** costly - every row and helper changes shape.
- **D-76:** Playwright (`apps/csrm/e2e/`), at 1440px and 375px, each journey on its own records, leaving the tree clean (Phase 8 D-12, G-6):
  - **`risk-owner-journey.spec.ts` (created here, first slice):** Jane raises a UAT-A-like request; Bob picks it up (Phase 13, because 17.1's submission needs the assigned analyst), generates and releases the questionnaire; Jane answers and submits; Bob drafts and confirms the assessment, sets Jane as owner of every risk in one step, then names the risk owner persona on the two risks that persona later accepts and treats in 17.1's slice; Bob releases for response; Jane and the persona each see the whole assessment marked "Released for response", the persona in "My risk assessments" with their part and a notification; the persona responds only on their own risks; Jane adds two mitigation controls to a risk with a control owner found by name; both submit and Bob is notified; Bob closes the round, accepts one control and rejects the other with a reason, and confirms a "Reassess residual risk" proposal per unit. The negative cases at each step: Maya gets the not-found page and the API's 404 for the assessment, its risks, control implementations and responses, before and after release for response; the persona gets no response control on Jane's risks and the API refuses one; Bob gets no response control and the API refuses him a response (`NOT_A_PARTICIPANT`), the analyst-cannot-accept rule as it stands before 17.1. 17.1 continues this test from here.
  - **A second phase spec** (name by the planner) covers what the journey does not: success criterion 1's refusals (release for response with an unowned risk, naming the assigned analyst), the two-character search, a second round with carry-forward, the editing pause, a v1 release after responses followed by the persona's print and export (success criterion 2's tail), and the notification centre's read state at both widths.
  - **Existing specs** that change deliberately (the My risk assessments heading and description, the lifecycle stepper, release readiness, the header) are named in the plan that changes them.
- **D-77:** Plans are serialised by shared files, one owner per file per wave: the specification and the generated client; both catalogue copies and `served-operations.json`; the authorisation matrix, the parity guard and the chain guard; the Strapi hot files (`csrm-authorization.ts`, `conflict-reasons.ts`, `assessment-workflow.ts`, `assessment-scope.ts`, the assessment controller and routes, `risk-workflow.ts`, `control-implementation-workflow.ts`, `request-lifecycle.ts`, `collection-scope.ts` and `review-queue-repository.ts`, the AI provenance and run modules, the context builder, Phase 19's predicate and event log modules); the web hot files (`assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `assessment-editor.tsx`, `risk-editor.tsx`, `released-assessment.tsx`, `status-badge.tsx`, the navigation profile, the shell header, both Homes); the E2E sign-in helper. Dev servers are stopped for every plan that edits Strapi or runs Playwright.
- **D-78:** Wave order: the three contract-gap records and their approval checkpoint first (with pure modules alongside: the participant predicate, the stage and holder derivations, the eligible-person predicate, readiness); then the schema; then the people search and nomination with the G-11 rules; then the participant read across every route with the matrix's seventh caller; then rounds and the guard; then responses and decisions; then the reassessment; then the notification centre and its event hooks; then the UI; then the fixtures, the two Playwright specs and the full gate (`api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`) with the 375px and 1440px checks for Jane, the persona, Maya and Bob. **Size:** beyond L as scoped: four new content types, a participant read across every assessment route with a new matrix caller, a new AI operation, a notification centre wired into seven events, and three new UI surfaces. The proposed split is in the return to the orchestrator; if Phase 17 stays whole, the planner reports the plan count against the usual L.

### Claude's Discretion (the CONTEXT's "Planner's Discretion")

- Module placement, for example `apps/backend/src/api/csrm-assessment/services/assessment-participation.ts`, `response-rounds.ts` and `response-decisions.ts`, a new `apps/backend/src/api/csrm-notification/` folder, `apps/backend/src/csrm/people/eligible-person.ts`, `apps/backend/src/csrm/ai/residual-reassessment/`, and web `apps/csrm/src/features/responses/` and `features/notifications/`.
- Names of operations, Functions, reason codes, kinds, run operations, stage and holder values and envelope versions, within the families above.
- Bounds: rounds per assessment, items per risk and per response, text lengths, the notification page size and panel length, the reassessment's risks per run.
- How readability is applied to notification counts (SQL or bounded filtering), provided counts stay exact (D-58).
- Whether the response draft saves per field or per risk, provided autosave and the saved state hold (D-31).
- The development persona's name, email and label (D-67), and whether a development seed shows the response stage (D-68).
- The lifecycle step's skipped presentation (D-07), with the UI-SPEC.
- How plans split, provided D-77's serialisation and D-78's order hold.
- Copy, layout, routes for the Notifications page, and visuals: the UI-SPEC's.

### Deferred Ideas (OUT OF SCOPE)

- **A response due date** per round and reminders for overdue responses: not in decision 18's or G-18's lists; a candidate for Phase 20's reminders.
- **A "named as risk owner" notification** and **a notification to a control owner named in a response**: not work waiting in decision 18's sense; Phase 20's owner views cover control owners after release.
- **A notification when AI proposals are ready** (Phase 16's deferral): not in decision 18's list; the job panel shows progress.
- **Files attached to responses** as evidence: Phase 14's attachments are the Requestor's and the analysts'; Phase 20's treatment evidence reuses them.
- **Custom (non-library) controls** when no library control fits a proposal: the analyst rejects with a reason or asks the Admin for a control (Phase 22 owns the library).
- **Participant access to the risk history and a rounds history view**: Phase 17.2's history view.
- **Team fan-out** of events on unassigned requests, **real-time push** of notifications, **digests or coalescing**, and **notification preferences** (NOTIFY-03).
- **A notification retention setting** for read notifications: Phase 22.
- **Answering a participant's request read with 404 instead of today's 403** (Phase 13's deferral): request routes keep their rules here.
- **Disambiguating people with the same display name** in the search (a second line such as a business unit) and **rate limiting** the search beyond the log's monitoring.
- **Reassessing the risk's overall control effectiveness** with the residual: ASSESS-13 asks for likelihood, consequence, rating and rationale only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSESS-11 | Release the initial risks to the Requestor and nominated owners for a response, in rounds | §D (participant read and gate), §F (rounds, readiness, close), §G (guard and locks), §C (stage, lifecycle step, holder, queue) |
| ASSESS-12 | Respond per risk with existing or planned controls, each with an owner found by name; the analyst accepts, edits or rejects each | §F (responses, draft storage, submit validation, decisions, restore), §I (people search), Code Examples 2 and 3 |
| ASSESS-13 | "Reassess residual risk" proposes residual values citing accepted controls; the analyst confirms per field and can re-run | §H (operation on Phase 15 and 16 machinery, wire, adapter, deterministic provider) |
| ASSESS-21 | Nominate an owner for every risk; G-11 separation of duties | §F (nomination batch), §G (owner rule in the guard), Pitfall 1 (seeded owners), §A (reasons) |
| ASSESS-22 | Participants read the whole assessment from the gate, nobody else | §D (predicate, projection, routes), §E (seventh matrix caller), §J (export and notification predicates) |
| ASSESS-23 | Least-privilege people search, logged | §I (hardening, eligible-person filter, service-identity refusal, event line) |
| SC5 (notification part) | Each participant is told in the app when a response waits or arrives | §J (two kinds through Phase 19.1, part `risk-owner`, readability via the participant predicate) |
| SC6 | Playwright, first journey slice | §L (spec structure, records, negatives, API checks) |
</phase_requirements>

## Project Constraints (from AGENTS.md and the Stage 2 rules)

- **Boundary:** Strapi is the production API boundary. The web calls it only through `apps/csrm/src/lib/api` from server code and Server Actions; there is no facade and no raw `fetch` in pages.
- **Authorisation:** Keycloak authenticates; Strapi enforces Role → Function → FunctionAPI plus record-level rules against the resolved IdamBox User. Authorisation never branches on the auth mode, and navigation visibility is not authorisation.
- **Requestor isolation:** a Requestor never reaches another Requestor's restricted records. The read comes from being named on the record (G-12).
- **AI:** AI output is advisory. Reassessment proposals change nothing until a human confirms them, and no AI path accepts, closes or releases.
- **Terms:** JDL terminology ("mitigation control" is the display term for a control implementation).
- **UI:** semantic tokens only, shadcn/ui first, strict TypeScript, Server Components by default, no domain logic in JSX, responsive and accessible.
- **Tests and dependencies:** tests with every material workflow; no new dependency (none is needed).
- **Dev mode:** never start Keycloak, never flip the four Keycloak or identity flags, and keep the OIDC tests green. New settings go in the `.example` files.
- **Contract changes:** each starts with its `docs/contract-gaps/phase-17-*.md` record and a `checkpoint:decision` where the executor stops (G-6). After approval, the chain is: spec, `api:generate`, `api:check`, both catalogue copies byte-identical, `served-operations.json`.
- **Tests per plan set:** Strapi integration tests for every grant and refusal; Vitest for every component and refusal state; Playwright for the flows, leaving `git status --short` clean.
- **The journey:** `risk-owner-journey.spec.ts` is one spec, created here (first slice) and extended by 17.1, 17.2 and 20. Every slice carries the negatives.
- **Plans are written ahead:** each plan names the earlier plans it relies on.
- **Gate commands:**
  - `pnpm --dir apps/csrm api:check`, `typecheck`, `lint` and `test`;
  - `pnpm --dir apps/backend test`;
  - `pnpm --dir apps/csrm test:e2e`;
  - `git status --short`.

  Run them under Node 24 (`/c/ProgramData/nvm/v24.19.0`).
- **Skills:** `codebase-design` (deep modules at the seams below), `tdd` (one failing test per seam, vertical slices, never horizontal), `domain-modeling` (the two glossary entries D-73 asks for, "Response round" and "Participant").

## Standard Stack

### Core (all installed; nothing is added)

| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| `@strapi/strapi`, `@strapi/database` | 5.51.0 [VERIFIED: apps/backend/package.json line 24, `"@strapi/strapi": "5.51.0"`] | Content types, Document Service, `strapi.db.transaction`, knex query builder | The API boundary; schema sync creates the new tables (no migration, the 06.1/06.8/12/13/16 precedent) |
| `next` | 16.3.6 [VERIFIED: apps/csrm/package.json line 26] | App Router, Server Actions, `next/dynamic` | Read `apps/csrm/node_modules/next/dist/docs/` before writing (apps/csrm/AGENTS.md) |
| `openapi-fetch` | 0.17.0 [VERIFIED: apps/csrm/package.json line 28] | The typed API layer | Strapi calls only through it |
| `zod` | ^4.4.3 [VERIFIED: apps/csrm/package.json line 37] | Closed server-side parsers | Zod stays out of client modules (`*-domain.ts` are zod-free) |
| `@playwright/test` | 1.58.2 [VERIFIED: apps/csrm/package.json line 41] | E2E, `test.step`, multi-context actors | The journey and the second spec |
| `vitest` | 4.1.11 [VERIFIED: apps/csrm/package.json line 54] | Web unit tests | Components, parsers, refusal states |
| `node:test` | Node 24.19.0 | Strapi unit and integration suites | `tests/tsconfig.json` compiled to `.tmp/tests-dist` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL EXISTS fragments for participation | Document Service `$or` and relation filters | Joins duplicate rows on to-many relations, `$not` applies to joined rows (Pitfall 4), and exact counts are not guaranteed; the repository pattern (`review-queue-repository.ts`) with an oracle test is the project's proven answer |
| Draft response as a JSON attribute on `CsrmRoundResponse` | Draft `CsrmResponseItem` rows replaced on every save | Rows churn on every autosave, deletes appear on an audit entity, and immutability after submission is harder to prove. JSON keeps items append-only (§F) |
| A new `skipped` step state | Omitting the step for requests that never ran a round | Omission changes `m` in "Step n of m" mid-life and hides an honest fact; `skipped` costs one enum value (§C) |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase, so the gate has nothing to check. Any plan that proposes one must justify it (AGENTS.md) and run `gsd_run query package-legitimacy check` first.

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## What today's code does (read this session)

| Fact | Evidence (verbatim) | Consequence |
|------|---------------------|-------------|
| Two fixed Keycloak ids exist, keyed by email, and the helper's parameter type is the map's keys | `export const DEVELOPMENT_FIXTURE_SUBJECTS = Object.freeze({` / `"jane.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e01",` / `"bob.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e02",` / `export function developmentFixtureSubject(email: keyof typeof DEVELOPMENT_FIXTURE_SUBJECTS)` [VERIFIED: apps/backend/src/keycloak/development-fixture-subjects.ts:14-21] | Adding the persona's email to the map types the seed call; the next free id in the sequence is `…5e03` (§K) |
| The realm import holds the two users with fixed ids and a password equal to the first name | `"id": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e01", "username": "jane.doe", "email": "jane.doe@idambox.com", … "credentials": [{ "type": "password", "value": "jane", "temporary": false }]` [VERIFIED: idp/keycloak/import/idambox-realm.json:11-28] | The persona's realm user copies this shape |
| A unit test proves every map entry has a matching realm user | `for (const [email, id] of Object.entries(DEVELOPMENT_FIXTURE_SUBJECTS)) { assert.equal(realm.users.find((user) => user.email === email)?.id, id, email); }` [VERIFIED: apps/backend/tests/keycloak-identity.unit.test.ts:278-288] | Changing both files together keeps it green without Keycloak running |
| The people search accepts one character and has one-key query parsing | `if (!isRecord(query) \|\| Object.keys(query).length !== 1 \|\| typeof query.search !== "string")` … `if (search.length < 1 \|\| search.length > 100)` [VERIFIED: assessment-scope.ts:360-369] | Change the lower bound to 2; other keys are already refused |
| The search filters only by status and display name | `filters: { accountStatus: { $eq: "active" }, displayName: { $containsi: search } }, sort: ["displayName:asc"], limit: 20` [VERIFIED: risk-workflow.ts:241-250] | The service identity is returned today; §I adds the eligible-person filter |
| The search projects two fields | `return { documentId: document.documentId, displayName: document.displayName };` [VERIFIED: assessment-scope.ts:340-342] | Already least-privilege; keep it |
| Owner relations check only `accountStatus` | `if (!relation \|\| ((field === "riskOwner" \|\| field === "treatmentOwner") && relation.accountStatus !== "active")) {` [VERIFIED: risk-workflow.ts:72] | D-16's predicate replaces this check; `controlOwner` gets it too |
| The policy picks the actor from the explicit analyst grant | `setAssessmentRequestActor(policyContext, explicitAnalystOperation ? "analyst" : "requestor");` after the human-only check [VERIFIED: csrm-authorization.ts:272-283] | An analyst calling a birthright-only operation (for example `my_response`) arrives as `requestor`, which is how analyst-participants respond (D-37); the service agent arrives the same way, so it needs its own refusal (§I) |
| The matrix has six actors and helper expectations without a seventh | `export type MatrixActor = "owner" \| "other" \| "analyst" \| "serviceAgent" \| "noIdentity" \| "noToken";` [VERIFIED: authorization-matrix.ts:28-29]; `return { owner: status, other: status, analyst: status, serviceAgent: status, noIdentity: 403 };` [VERIFIED: authorization-matrix.ts:173-175] | §E adds `riskOwner` as a required key, so TypeScript forces every row to state it |
| The people search row expects 200 for every identity | `operation: "GET:/api/v1/users", … request: () => ({ path: "/api/v1/users?search=Jane" }), expect: everyIdentity(200),` [VERIFIED: authorization-matrix.ts:1093-1097] | It becomes the service agent's 403 (D-53) |
| Provenance recognises an actor by the harness identity a cited test names | `owner: /\bidentities\.owner\b/, other: /\bidentities\.otherRequestor\b/, analyst: /\bidentities\.analyst\b/, serviceAgent: /\bidentities\.serviceAnalystAgent\b/, noIdentity: null, noToken: null,` [VERIFIED: matrix-provenance.ts:17-24] | Add `riskOwner: /\bidentities\.riskOwner\b/` |
| The control implementation status vocabulary | `"enum": ["Existing", "Planned", "Implemented", "Retired"]`; effectiveness `"enum": ["Effective", "Partially Effective", "Ineffective", "Not Assessed"]`; `control` is `"required": true` [VERIFIED: csrm-control-implementation/schema.json:15-50] | A response's `Existing`/`Planned` map directly to `controlStatus`; acceptance needs a library control (D-38) |
| The lifecycle has eight steps; the state vocabulary is closed | `{ key: "assessment-drafted", label: "Assessment drafted" }, { key: "assessment-reviewed", label: "Assessment reviewed" }, { key: "assessment-released", label: "Assessment released" }` [VERIFIED: request-lifecycle.ts:13-18]; spec `AssessmentRequestLifecycleStep.state` is `"enum":["completed","current","future"]` and `key` is a free string [VERIFIED: specification.json, printed this session] | A new key needs no spec change; `skipped` does (§C) |
| Mobile runs an explicit spec list | `testMatch: ['**/requestor-request-workflow.spec.ts', '**/assessment-navigation-lifecycle.spec.ts', '**/risk-register-workflow.spec.ts', '**/administration-workflow.spec.ts'], grep: /@journey/,` [VERIFIED: apps/csrm/playwright.config.ts:184-196] | Add the journey and the second spec, or they never run at 375px (Pitfall 3) |
| The E2E sign-in roles are a closed union | `export type SignInRole = 'Requestor' \| 'Secondary Requestor' \| 'Security Analyst';` [VERIFIED: apps/csrm/e2e/helpers/navigation.ts:4] | Phase 13 adds `'Second Security Analyst'`; Phase 17 adds the persona's label |
| The production build is scanned for fixture emails | `const fixtureEmails = ['jane.doe@idambox.com', 'maya.requestor@idambox.com', 'bob.doe@idambox.com'] as const;` [VERIFIED: apps/csrm/e2e/production-hardening.spec.ts:602] | Add the persona's email so the scan covers it |
| The mutable Risk Register fixture names Bob as owner | `riskOwner: bob.documentId, treatmentOwner: bob.documentId,` [VERIFIED: seed-risk-register-workflow.ts:182-185] | D-18 refuses Bob's edits there (Pitfall 1) |
| Strapi's `$not` wraps a condition over a join | `if (key === '$not') { filters[key] = processNested(value, ctx); continue; }` … `const subAlias = join.createJoin(ctx, { alias: alias \|\| qb.alias, attributeName: key, attribute });` [VERIFIED: @strapi/database 5.51.0 dist/query/helpers/where.js:101-119] | Never express "has no Security Analyst Agent role" as `$not` over `roles` (Pitfall 4) |
| Strapi shortens identifiers over 55 characters | `const IDENTIFIER_MAX_LENGTH = 55;` [VERIFIED: @strapi/database 5.51.0 dist/utils/identifiers/index.js:29] | Raw SQL must resolve link-table names from metadata or keep them short (Pitfall 5) |
| Transactions bind the Document Service through AsyncLocalStorage | `const trx = notNestedTransaction ? await this.connection.transaction() : transactionContext.transactionCtx.get();` [VERIFIED: @strapi/database 5.51.0 dist/index.js:61-62]; query builder reads `transactionContext.transactionCtx.get()` [VERIFIED: dist/query/query-builder.js:539] | Document Service writes (rounds, notifications) join the workflow transaction; raw knex needs `.transacting(trx)` (13-RESEARCH Pitfall 1) |

## Settled research items

### A. Names (within D-03's families; the records fix them before approval)

**Operations** (catalogue URL form; constants in `CSRM_ASSESSMENT_OPERATIONS` or a new `CSRM_RESPONSE_OPERATIONS`):

| Family | Operation | Body / response | Function (both catalogue copies) |
|---|---|---|---|
| Nomination | `PUT:/api/v1/risk_assessments/{assessmentId}/risk_owners` | `{ owners: [{ riskId, ownerId }] }` (1-200) → `200 { data: { applied, unchanged } }` | `function.risk_owners.nomination_api`, `role.security_analyst` only, plus `HUMAN_ANALYST_ONLY_OPERATIONS` |
| Open round | `POST:/api/v1/risk_assessments/{assessmentId}/response_rounds` | `{ message?: string }` → `201 { data: ResponseRound }` | `function.response_rounds.manage_api` (`.api.01`), human-only, plus `assertAssignedAnalyst` |
| Close round | `POST:/api/v1/risk_assessments/{assessmentId}/response_rounds/{roundNumber}/close` | `{}` → `200 { data: ResponseRound }` | `function.response_rounds.manage_api` (`.api.02`), human-only, plus `assertAssignedAnalyst` |
| Rounds read | `GET:/api/v1/risk_assessments/{assessmentId}/response_rounds` | → `200 { data: ResponseRoundsView }` | `function.response_rounds.read_api`, `role.security_analyst` and `role.requestor` (never the agent) |
| Own response | `GET` and `PUT:/api/v1/risk_assessments/{assessmentId}/my_response`; `POST:…/my_response/submit` | `PUT { expectedSavedAt, draft }`; `submit { expectedSavedAt }` | `function.response_rounds.my_response_api`, `role.requestor` only |
| Decisions | `POST:/api/v1/risk_assessments/{assessmentId}/response_decisions` | `{ decisions: [...] }` (1-200) → `200 { data: { applied, unchanged } }` | `function.response_rounds.decide_api`, human-only |
| Reassessment | `POST:/api/v1/risk_assessments/{assessmentId}/residual_reassessments` | `{ riskIds?, instruction? }` → `202 { data: RiskProposalJob }` | `function.risk_ai_proposals.residual_reassessment_api`, human-only; job read and retry stay Phase 16's Functions |

**Why `…/my_response` and not D-03's `…/response_rounds/current/my_response`:** the literal `current` sits where `{roundNumber}` sits on the close route, which invites a routing ambiguity (19-RESEARCH Pitfall 1's class of bug). The response is always the caller's own in the open round, or in the latest round on read, so the path needs no round segment.

**Closed reasons** (added to Phase 10's `conflict-reasons.ts` on both sides, 409 unless stated):
- From D-03 item 11: `RESPONSE_ROUND_OPEN`, `RESPONSE_ROUND_NOT_OPEN`, `RELEASE_FOR_RESPONSE_NOT_READY`, `OWNER_NOT_ELIGIBLE`, `OWNER_IS_ASSIGNED_ANALYST`, `ACTOR_IS_RISK_OWNER`, `RESPONSE_ALREADY_SUBMITTED`, `CONTROL_ALREADY_ON_RISK`, `RESPONSES_UNDECIDED` and `ASSESSMENT_NOT_RELEASED`.
- Two of D-03's reasons answer 403: `NOT_A_PARTICIPANT` and `RESPONSE_NOT_PERMITTED`.
- Added here:
  - `RESPONSE_CHANGED`, for a stale `expectedSavedAt` (two tabs);
  - `RESPONSE_INCOMPLETE`, for a submit with invalid items, or empty without "Nothing to add" (D-35);
  - `RESPONSE_ITEM_DECIDED`, for a conflicting decision;
  - `RESPONSE_DECISION_UNDO_UNAVAILABLE` (D-39);
  - `RESPONSE_ROUND_LIMIT`.
- Published here for the first time:
  - Phase 13's `REQUEST_UNASSIGNED` (409) and `NOT_ASSIGNED_ANALYST` (403). 13-01's record says Phase 17.1 publishes them when a route first returns them, but release for response returns them first [CITED: 13-01-PLAN.md line 92].
  - `ASSIGNMENT_REQUIRED`, reused for unassignment after the gate.
- `RELEASE_FOR_RESPONSE_NOT_READY` carries the outstanding keys, so it needs a dedicated error schema. `AssessmentWorkflowErrorResponse.error.details` is closed (`"additionalProperties":false`) [VERIFIED: specification.json, printed this session], as Phase 13 found for `ASSIGNMENT_CHANGED`.

**Vocabularies:**

| Vocabulary | Values |
|---|---|
| Stage (D-06) | `not-shared`, `released-for-response`, `with-security-analyst`, `released` |
| Participant parts | `requestor`, `risk-owner` (17.1 adds `executive-approver`) |
| Holder (Phase 11 + D-08) | `requestor`, `analyst`, `none`, + `participants` |
| Lifecycle step | key `released-for-response`, label "Released for response"; step state + `skipped` |
| Round | `kind`: `response`; `outcome`: `closed` |
| Response `status` | `requested`, `draft`, `submitted`, `not-submitted` |
| Item `kind` | `proposed-control`, `proposed-owner`, `comment` |
| Item `decision` | `accepted`, `rejected`, `lapsed` (undecided = null) |
| Risk history `sourceKind` (Phase 16) | + `nomination` (with `batchId`), + `response` (with the item's id) |
| AI run `operation` (Phase 12 `AI_RUN_OPERATIONS`) | + `residual-reassessment` |
| Job target key (Phase 15 registry) | `residual:{assessmentId}` |
| Notification kinds and part (Phase 19.1) | + `response-requested`, + `response-submitted`; `recipientPart` + `risk-owner` |
| Security event | `csrm.people.search`, outcome `searched` or `refused` |

**Entity names (record 1):** `CsrmAssessmentRound` (`csrm_assessment_rounds`), `CsrmRoundResponse` (`csrm_round_responses`), `CsrmResponseItem` (`csrm_response_items`), and on `CsrmAssessment` the attributes `sharedWithParticipantsAt` and `sharedWithParticipantsBy`.
- Every relation is unidirectional. No `inversedBy` on existing types, so the only change to an existing schema is the gate pair.
- The two gate attributes are `"private": true`, as Phase 13 did for its request facts [CITED: 13-03-PLAN.md line 212].

### B. Bounds (Planner's Discretion; recommended)

| Bound | Value | Refusal |
|---|---|---|
| Round message | ≤ 2,000 characters, plain text, never sent to the AI (D-09) | 400 |
| Response rounds per assessment | 20 [ASSUMED] | `RESPONSE_ROUND_LIMIT` |
| Proposed controls per risk per response | 10 (D-33's proposal) | 400 |
| Control title | 1-200; description, evidence and comment ≤ 2,000 (D-33) | 400 at save; completeness at submit |
| Proposed owner reason; reject or change reason | 1-500 (D-33, D-38; Phase 16's `REVERT_REASON_MAX_LENGTH = 500` [CITED: 16-RESEARCH.md, revert-reason.ts:1]) | 400 |
| Items per response | ≤ 500, draft JSON ≤ 256 KB [ASSUMED] | 400 |
| Planned due date | an ISO date on or after the server's UTC date at submit, within 5 years [ASSUMED] | `RESPONSE_INCOMPLETE` |
| Nomination and decision batches | 1-200 (D-03; Phase 12 and 15 batch size) | 400 |
| Reassessment risks per run | `riskIds` 1-50; whole-assessment runs take every eligible risk up to 50 [ASSUMED] | `CONTEXT_TOO_LARGE` (Phase 12) beyond |
| Instruction | 1-500, line feeds only (Phase 15 `INSTRUCTION_MAX_LENGTH = 500` [CITED: 15-RESEARCH.md §E]) | Phase 15's 400 reasons |
| People search term | 2-100 after trim; ≤ 20 results (G-17) | 400 |

### C. Stage, lifecycle step, holder and queue (D-05 to D-08)

**Stage** (pure, from the gate fact, the open round and the release facts):
- `released` when `isReleased(assessment)`;
- else `released-for-response` when a response round is open;
- else `with-security-analyst` when `sharedWithParticipantsAt` is set;
- else `not-shared`.

A legacy released assessment with no gate fact is `released`.

**Lifecycle step "Released for response"**: inserted at index 6, after `assessment-drafted` and before `assessment-reviewed`. It is computed apart from the "highest milestone" rule:

| Facts | Step state | Current step |
|---|---|---|
| A response round is open | `current` | `released-for-response` |
| No round open, at least one closed | `completed` | the highest milestone at or after `assessment-reviewed`; `assessment-reviewed` until it is ready, so exactly one step is current |
| No round ever opened, current index beyond 6 | `skipped` | unchanged rule |
| No round ever opened, current index at or before 6 | `future` | unchanged rule |

- **Recommendation: a `skipped` state, labelled "Not used" by the UI-SPEC,** rather than omitting the step.
  - `m` in "Step n of m" stays 9 for every request: Phase 11's UI-SPEC says "`m` is 8" [CITED: 11-UI-SPEC.md line 575], and that changes once.
  - A request released before this flow reads truthfully.
  - Phase 17.1's later steps follow the same shape.
  - It costs one value in the published enum, the web's closed parser, the stepper and its compact form (X-9).
- **A request reopened for a second round** moves its current step back to the response step. That is honest rework, and Phase 17.2's rework rounds follow the same rule.
- **Next actions** (in `request-lifecycle.ts`, Phase 11 D-27):
  - the Requestor reads "Respond to round {n}", linking to the participant page;
  - the analyst reads who is still to respond, or "Close round {n} and decide the responses";
  - after a closed round with undecided items, the analyst's action names the decisions.

  The exact wording is the UI-SPEC's.

**Holder:** Phase 11 plans `holderFor(key: LifecycleKey): RequestHolder` [CITED: 11-08-PLAN.md line 114] and decides it in SQL for "My requests" [CITED: 11-10-PLAN.md lines 43, 109]. The holder now depends on response facts, so it becomes `holderFor(facts)`:
- **While a round is open:**
  - `requestor` while the Requestor's response is `requested` or `draft`;
  - `participants` while the Requestor's response is submitted and another's is not;
  - `analyst` once all are submitted.
- **Otherwise:** today's rule.

Three things change in the same plan:
- the SQL holder fragment, with EXISTS over `csrm_round_responses` joined to the open round;
- `MyRequestStatusSummary.byHolder`, which gains `participants`;
- the `holder` filter enum.

The 11-10 oracle test covers the new value. The Requestor Home's "With the Security Analyst" section copy changes in that plan (Orchestrator Confirmation).

**Review queue:** an open round with any response not submitted belongs to `awaiting-requestor`; an open round with all submitted belongs to `requires-attention`. Two places change together:
- `selectReviewQueueBucket` (the oracle) [VERIFIED: collection-scope.ts:312-334, `if (bucket === "awaiting-requestor") return lifecycle.currentKey === "draft" || lifecycle.currentKey === "questionnaire-released";`];
- `applyBucket`, the SQL predicates [VERIFIED: review-queue-repository.ts:137-170].

### D. The participant predicate and the read across routes (D-22 to D-30)

**One module** (`apps/backend/src/api/csrm-assessment/services/assessment-participation.ts`) with a small interface and a deep body:

```ts
export type ParticipantPart = "requestor" | "risk-owner";           // 17.1 adds "executive-approver"
export type ParticipationFacts = {
  requestorId: string | null;
  sharedWithParticipantsAt: string | null;   // the gate (D-11)
  released: boolean;                          // isReleased(...) today; 17.1 widens to closed
  risks: ReadonlyArray<{ documentId: string; ownerId: string | null; withdrawn: boolean }>;
};
export type Participation = {
  parts: ParticipantPart[];                   // empty = not a participant
  ownRiskIds: string[];                       // non-withdrawn risks the viewer owns
  mayReadNow: boolean;                        // gate open, or legacy: Requestor and released
  legacy: boolean;                            // no gate fact
};
export function participationOf(viewerId: string, facts: ParticipationFacts): Participation;
export function mayRespondOn(p: Participation, riskId: string): boolean;   // Requestor: any active risk; owner: own risks
// SQL forms, one per question, proven equal to participationOf by an oracle test:
export function whereViewerMayReadAssessment(qb, input: { viewerId: string; assessmentIdColumn: string }): void;
export function whereViewerParticipates(qb, input: { viewerId: string; assessmentIdColumn: string; part?: ParticipantPart }): void;
```

- **Legacy (no gate fact):** `mayReadNow` holds only for the Requestor of a released assessment (v1). Owners never read here; Phase 20 owns their own-risk reads.
- **The owner of withdrawn risks only** is not a participant (G-11).
- **Participation is current:** computed from today's `riskOwner` values, never from a stored copy.
- **Phase 19's one released-assessment predicate** (19-RESEARCH Pattern 3: `findReadableReleasedAssessment({ documents, viewer, documentId })`, path fixed by Phase 19's plans) is split in place into its two halves: `readable(viewer, assessment)` (this module) and `released(assessment)`. Callers:

| Caller | Predicate |
|---|---|
| Released export, A4 report, and the released half of "My risk assessments" (17.1 widens `released` to `closed` here) | `readable && released` |
| Assessment detail, risks and control implementations | `readable` |
| The rounds read | `readable` |
| `my_response` | `participant`, plus `mayRespondOn` per item |
| Phase 19.1's notification readability for `response-requested` and the `risk-owner` part | `readable` (Pitfall 2) |

**Routes and their participant outcomes:**

| Route | Participant (gate open) | Non-participant, before gate, former owner | Analyst | Agent |
|---|---|---|---|---|
| `GET /risk_assessments/{id}` | 200 participant projection | 404 | 200 analyst detail (+ `viewerParticipation`) | 200 analyst detail (its existing grant) |
| `GET /risk_assessments/{id}/risks` | 200 non-withdrawn, D-26 masking | 404 | 200 | 200 |
| `GET /risks/{riskId}/control_implementations` | 200 when the risk is active and the assessment readable | 404 (also for a withdrawn risk) | 200 | 200 |
| `GET …/response_rounds` | 200, submitted responses only | 404 | 200 | 403 (§I set) |
| `GET/PUT …/my_response`, `POST …/submit` | 200 (submit 200), with `RESPONSE_NOT_PERMITTED` per item | 404 | 403 `NOT_A_PARTICIPANT` when the analyst is not a participant; else as participant | 403 |
| `GET /my_risk_assessments`, `/rating_summary` | 200 with own participations (rating summary released only) | 200, nothing of others | 200, own participations only (06.3) | 200, own only |
| Released export and report (Phase 19) | 200 when released; 409 `ASSESSMENT_NOT_RELEASED` before | 404 | 200 / 409 (Phase 19 D-15) | 403 (19 D-13) |
| Request routes (request, questionnaire, notes, attachments, generation jobs) | unchanged: 403 request read, 404 notes and attachments, 403 by grant elsewhere | unchanged | unchanged | unchanged |
| Analyst operations (nomination, rounds, decisions, reassessment, risk and control implementation writes, register, history, AI runs) | 403 (no grant) | 403 | per its rules | 403 (human-only set) |

**The participant projection** is a third branch of `AssessmentDetailGetResponse`. Today the union is `oneOf` `AnalystAssessmentDetail` and `RequestorReleasedAssessmentDetail`, discriminated by `actor` with mapping `"analyst"` and `"requestor"` [VERIFIED: specification.json `AssessmentDetailGetResponse`, printed this session].
- **Recommendation:** a new `ParticipantAssessmentDetail` with `actor: "participant"`, served for every non-analyst reader including the legacy Requestor read. `RequestorReleasedAssessmentDetail` is retired from the union in the same plan, with the web parser and the parity registry (the 06.9 lesson).
- The alternative of extending the Requestor branch keeps a name ("Requestor", "Released") that is false for a risk owner reading before release.
- **Fields:** D-25's allowlist, with stage, parts, the round summary, the request summary (number, title, description, assessment type, division, business unit, business criticality, systems and assets by name), the assessment fields, the release date and releaser once released, and the AI-assisted disclosure flag.
- **Control implementations:** today's Requestor list projects `evidence`, `implementedDate` and `reviewDate` [VERIFIED: assessment-scope.ts:344-357]. D-25 lists "control number and name, status, owner, due date, effectiveness". Keep today's fields so v1's released read does not narrow (Open Question 3).
- **D-26 masking:** a risk holding an unconfirmed AI value, or an open AI proposal, projects as `{ documentId, riskNumber, beingPrepared: true }` with every other field null in the risks list, and its control implementations route answers an empty list. The flag is read from Phase 12's `aiProvenance` per-field state and Phase 15's fold over the risk's open items.

**"My risk assessments"** moves from the Document Service owner filter (`releasedAssessmentQuery(ownerDocumentId)` [VERIFIED: assessment-scope.ts:159-181]) to a repository on the review-queue pattern:
- EXISTS predicates from `whereViewerMayReadAssessment`, with exact totals;
- closed filters `part`, `stage` and `awaiting=me`;
- per item: stage, parts, round number and `awaitingYourResponse`.

The rating summary uses the same predicate plus `released`. The sidebar count, Home's "Needs your action" and quick find read it (D-28).

### E. The seventh matrix caller (D-75)

- **Actor:**
  - `MatrixActor` and `MATRIX_ACTORS` gain `"riskOwner"`, and `MatrixExpectation` gains a required `riskOwner: number`;
  - `callerOf` maps it to `harness.identities.riskOwner`;
  - `ProvenanceActor` and `ACTOR_IDENTITY_REFERENCES` gain `riskOwner: /\bidentities\.riskOwner\b/`.
- **Harness:** identity `risk-owner`, a user `risk.owner@example.test` holding the Requestor role only (the `other` pattern [VERIFIED: strapi-http-harness.ts:536-547]), exposed as `identities.riskOwner` and `users.riskOwner`.
- **Helpers:** `everyIdentity(s)` gives `riskOwner: s`. `humanAnalystOnly`, `analystAndAgent` and `OWNER_READ_OTHER_DENIED_403` give 403. Phase 19 and 19.1's human-only-birthright helper gives `riskOwner: s` with the agent at 403. Every literal row adds the key by hand; TypeScript refuses a row without it.
- **Participant fixture:** a new `seedParticipantFixtures()`, seeded once after `seedAssessmentWorkflowFixtures()` in the matrix's `fixtures()`. It holds:
  - Jane's request, assigned to Bob (Phase 13);
  - an assessment with `sharedWithParticipantsAt` set and round 1 open;
  - risk P1 owned by Jane, risk P2 owned by `riskOwner` with one control implementation, and risk P3 withdrawn and owned by `riskOwner`;
  - Jane's submitted response and `riskOwner`'s draft.

  Titles join `FIXTURE_TITLE_PATTERN` (for example `Participant fixture`).
- **Rows that read assessments** keep their probe on `releaseFacts.complete`, the legacy released record, so `riskOwner` there is 404. They gain a variant labelled `participant assessment released for response` probing the participant fixture: owner 200, other 404, analyst 200, serviceAgent 200, riskOwner 200, noIdentity 403. This proves both the legacy rule and the gate with the existing `variants` mechanism [VERIFIED: authorization-matrix.ts `MatrixVariant` type, lines 134-137].
- **Rows for P3, the withdrawn risk:** its control implementations answer 404 to `riskOwner`. A variant states it.
- **`my_risk_assessments`:**
  - `mustNotDisclose` for `riskOwner` lists `complete`, `crossOwnerComplete` and their numbers;
  - for `other` it adds the participant fixture's id;
  - `ownedRecordTotal` on the rating summary gives `riskOwner: "none"`, because the fixture is unreleased.
- **The human-only check:** the test "every human-analyst-only operation is served and its row denies the owner, the other Requestor and the service agent" also asserts `row.expect.riskOwner === 403`. Its literal count `6 + insightOperations.size` [VERIFIED: authorization-matrix.integration.test.ts:166] is already changed by Phases 12 to 19.1; Phase 17 adds its four human-only operations (nominate, open and close, decide, reassess).
- **Persistence guards** on the new mutation rows snapshot the round, the responses and the items.

### F. Rounds, responses and decisions (D-09 to D-15, D-31 to D-42)

**Open round (`POST …/response_rounds`)**: inside `withRequestLock(requestId)`, then the assessment serialisation (§G):
1. Parse (400), the record (404 for the analyst's own scope), `assertAssignedAnalyst` (`REQUEST_UNASSIGNED` 409, `NOT_ASSIGNED_ANALYST` 403), and the guard (§G).
2. Release-for-response readiness (`RELEASE_FOR_RESPONSE_NOT_READY` with keys), the round limit, then create:
   - the round, `number = max(number) + 1` per assessment and kind;
   - one `requested` response per participant, recording the parts at opening and a draft seeded by carry-forward (D-34);
   - the gate fact if absent;
   - the `response-requested` notifications through Phase 19.1's service;
   - the unread notifications of any earlier round, marked read (19.1 D-21's reversal pattern).
3. Readiness keys, mirroring `projectReleaseReadiness`:
   - `activeRisk`;
   - `riskStatement`, `inherentRating`, `residualRating` and `eligibleOwner`, each per risk;
   - `aiValuesConfirmed`, `aiProposalsDecided` and `noAiJobRunning`;
   - `noRoundOpen`, `assessmentEditable` and `requestAssigned`.

**Close round:** the assigned analyst, the number equal to the open round's (else `RESPONSE_ROUND_NOT_OPEN`).
- Unsubmitted responses become `not-submitted` and keep their draft.
- The participants' unread `response-requested` for that round are read (the reversal).
- The assignee's unread `response-submitted` for that round are read (acting on the work).

**Draft storage (recommendation):** the draft is a versioned JSON attribute `draft` on `CsrmRoundResponse`, rewritten whole on each `PUT`. `CsrmResponseItem` rows are created only at submission, from the validated draft, and are never edited afterwards except for their decision facts.
- This keeps "a submitted response is immutable" structural, and it keeps item ids stable for decisions, notifications and history.
- `draft` is a new attribute name within D-01 ("names are proposals; the records fix them"). Record 1 states it (Open Question 2).
- Draft envelope v1: `{ schemaVersion: 1, nothingToAdd: boolean, risks: [{ riskId, controls: [{ key, title, description?, status: "Existing"|"Planned", ownerId?, dueDate?, evidence? }], proposedOwner?: { ownerId, reason }, comment? }] }`. It is closed, and keys are client-chosen strings unique per risk.
- **Save** accepts incomplete controls (autosave must never lose input, G-4), but refuses:
  - risks the caller may not respond on (`RESPONSE_NOT_PERMITTED`, 403);
  - unknown or withdrawn risks (404 for the whole save);
  - over-bound text (400);
  - an ineligible `ownerId` (`OWNER_NOT_ELIGIBLE`).
- **Concurrency:** `expectedSavedAt` must equal the stored `savedAt`, else `RESPONSE_CHANGED`. Only the author writes, so this guards two tabs, not two people.
- **Submit** validates completeness:
  - a title and an owner on every control;
  - a due date for Planned;
  - evidence for Existing;
  - a reason for a proposed owner;
  - at least one item, or `nothingToAdd`.

  Failures answer `RESPONSE_INCOMPLETE` with a closed list of `{ riskId, key?, field }`. Submit then materialises the items, sets `submitted` and `submittedAt`, notifies the assignee (`response-submitted`), and reads the submitter's `response-requested`.
- **Carry-forward (D-34):** the next round's `requested` response starts with the previous `not-submitted` draft, filtered to risks the person may still respond on and to eligible owners.

**Decisions (`POST …/response_decisions`)**: inside the request lock, then the assessment mutation.
- **Preconditions:** no round open (`RESPONSE_ROUND_OPEN`), and the actor is not a named owner.
- **Item order:** every item in the path's assessment, else 404 for the whole batch; then, per item in order, the item state, then the action.
- **Accept a control** creates the control implementation through Phase 16's transaction-scoped inner create, as follows.
  - **The body:** `accept: { controlId, controlStatus?, ownerId?, dueDate?, evidence?, effectivenessRating?, reason? }`; `reason` is required when anything differs from the proposal.
  - **Fields:** `controlStatus` Existing or Planned; effectiveness defaults to `Not Assessed`.
  - **History:** the history source is `response` with the item id.
  - **Refusals:** `CONTROL_ALREADY_ON_RISK` when the control is already on the risk.
- **Reject** needs a reason.
- **Restore (Undo):**
  - an accepted control returns only while its implementation is unchanged (compare a fingerprint stored at acceptance) and the assessment is editable;
  - an accepted owner returns while the owner is unchanged.

  Otherwise `RESPONSE_DECISION_UNDO_UNAVAILABLE`.
- **Lapse:** items on a risk withdrawn while undecided are written `lapsed` in the withdrawal's transaction (D-40). Phase 16's withdraw inner function gains the hook.
- **Transition:** a batch containing a content change takes the accepted-edit transition once (D-42; Phase 16 D-23).

### G. The guard, locks and serialisation (D-15, D-18, D-43 to D-45)

- **Guard order:** `assertAssessmentEditable({ assessment, actor })` (Phase 16 D-22) checks, in this order:
  1. not editable → `ASSESSMENT_NOT_MUTABLE`;
  2. a response round open → `RESPONSE_ROUND_OPEN`;
  3. actor named as owner of any non-withdrawn risk → `ACTOR_IS_RISK_OWNER`.

  The open-round fact is a read inside the transaction: the newest round row with `closedAt` null for the assessment. The guard reads the risks already loaded by `assessmentReleasePopulate`, which populates `riskOwner` [VERIFIED: assessment-workflow.ts:409-421], so the owner check costs nothing extra.
- **Lock order:** every Phase 17 write that reads the assignee or changes owners takes Phase 13's `withRequestLock(requestId)` first, then the assessment serialisation, never the reverse. This covers open, close, nomination, decisions that accept an owner, and Phase 13's assignment (which now reads the owners).
  - Without a common lock, "reassign to X" and "nominate X" race and leave X both assignee and owner.
  - Phase 13's lock and the assessment queue are separate in-process tails, so a fixed order cannot deadlock.
  - Never nest the same tail (16-RESEARCH Pitfall 1; 13-RESEARCH Pitfall 1).
- **Assignment rules (Phase 13):**
  - `isEligibleAssignee` gains "not a named owner of the request's assessment";
  - unassignment refuses `ASSIGNMENT_REQUIRED` once `sharedWithParticipantsAt` is set;
  - the AI-input mark and every assignment action refuse `ACTOR_IS_RISK_OWNER`;
  - `assertAssignedAnalyst` is re-evaluated at use, so an assignee later named owner cannot open rounds.

  None of these can happen through Phase 17's own nominations, because the assignee cannot be named; they guard other paths.
- **AI jobs during a round:** enqueue refuses through the guard. A job completing after a round opened completes with every item `lapsed` (Phase 15 §C lapse; Phase 16 D-40).

### H. Residual reassessment on Phase 15 and 16's machinery (D-46 to D-51)

- **Registry:** Phase 15's generic `createProposalJobRegistry` in `src/csrm/ai/proposal-job-registry.ts` [CITED: 15-RESEARCH.md §K], with target key `residual:{assessmentId}`. That gives single flight for the whole assessment, so per-risk and whole-assessment runs never overlap (D-47). Job read and retry are Phase 16's routes; any analyst who may read the request reads and retries (Phase 13 D-18).
- **Enqueue order:**
  1. parse (400);
  2. assessment (404);
  3. guard (§G);
  4. eligible risks (none → `RESIDUAL_REASSESSMENT_NOT_ELIGIBLE`, 409);
  5. instruction (Phase 15's 400s and Requestor-text guard);
  6. AI policy (Phase 12 reasons);
  7. enqueue.

  Eligible means active, with inherent likelihood and consequence, and at least one control implementation.
- **Run:** `createRunningAiRun` with `operation: "residual-reassessment"`, the `risk` relation for a single-risk run, the instruction and the context summary.
- **Context:** Phase 12's `buildAssessmentContext` plus a `<referenceData>` block `targetRisks`:
  - per risk, a short key, statement, cause and impact;
  - inherent and current residual values;
  - its controls as short keys `control-1…` with number, title, status, effectiveness, due date and evidence;
  - the submitted response comments and decided items on it.

  Every business-written value goes in the untrusted data block; no names, numbers or dates of people (G-3; D-48).
- **Wire (model-facing, portable subset):** `{ schemaVersion: [1], risks: [{ key, residualLikelihood, highestResidualConsequence, residualRatingRationale, citedControls: string[] }] }`. Ratings never cross the wire (Phase 12 D-10).
- **Adapter:**
  1. map keys back;
  2. drop unknown controls (`sources-dropped`);
  3. derive the rating with `risk-scale.ts`;
  4. drop a scores unit whose score exceeds the inherent score (`residual-above-inherent-dropped`, D-49);
  5. flag an uncited rationale (`uncitedClaims`);
  6. build two units per risk on Phase 16's `field-units.ts`: `residualLikelihood + highestResidualConsequence + residualRating`, and `residualRatingRationale` [CITED: 16-RESEARCH.md "Rewrite units and stale detection"];
  7. capture base values.
- **Decisions:** through Phase 12's `ai_proposal_decisions` with run-scoped targets.
  - **Folding and transitions:** Phase 15's fold and transitions [CITED: 15-RESEARCH.md §C, §L].
  - **Copy:** visible "Confirm" and "Confirm all", and "Reject".
  - **Stale units:** never applied (`AI_PROPOSAL_STALE`).
  - **Supersession:** a newer reassessment, or a newer `risk-rewrite` whose units include the residual scores or rationale of the same risk, supersedes the older open unit, written at the newer run's completion (Phase 15 §C).
  - **Readiness:** Phase 16's "AI proposals decided" covers the units.
- **Deterministic provider (D-51):**
  - lowers residual likelihood one step, floored at `Rare`, for a risk with at least one `Existing` or `Implemented` control rated `Effective`, citing it;
  - lowers it one step for a risk whose controls are all `Planned`, naming them (residual counts planned controls, G-14);
  - leaves one rationale uncited for a risk whose only controls are `Ineffective`;
  - proposes a consequence above inherent for a risk whose only controls are `Retired`, which the adapter drops.

  This fixes the journey's outcome: Internet Exposure, inherent `Likely × Major` and residual `Possible × Major` (High) [CITED: 12-06-PLAN.md line 123], becomes `Unlikely × Major` = 8, Moderate. The bands come from 12-02-PLAN line 31: 1-4 Low, 5-9 Moderate, 10-16 High, 20-25 Critical.
- **Provider tests** send model-facing JSON through `fake-openai-compatible-server.ts`. They inspect the captured prompt for the data block, the instruction slot and the absence of names.

### I. The hardened people search and its log (D-52 to D-55)

- **Parser:** `parseActiveUserSearchQuery` takes the lower bound 2, keeps the one-key rule, and returns a closed refusal reason for the log (`TERM_TOO_SHORT`, `TERM_TOO_LONG`, `UNKNOWN_PARAMETER`).
- **Query:** reuse Phase 19.1's eligible-person module (`src/csrm/people/eligible-person.ts`, 19.1-CONTEXT D-07). It needs a set-level form; Phase 17 adds it there without changing the predicate. A two-step query is exact and needs no NOT-join:
  1. `serviceIdentityIds = users.findMany({ filters: { roles: { name: { $eq: SECURITY_ANALYST_AGENT_ROLE_NAME } } }, fields: ["documentId"], limit: 1_000 })`, failing closed above the cap;
  2. `findMany({ filters: { accountStatus: { $eq: "active" }, displayName: { $containsi: term }, documentId: { $notIn: serviceIdentityIds } }, sort: ["displayName:asc"], limit: 20 })`.

  `$notIn` is a supported operator [VERIFIED: @strapi/database where.js:162 `case '$notIn':`]. `SECURITY_ANALYST_AGENT_ROLE_NAME` is the export 13-03 adds to `csrm-authorization.ts` [CITED: 13-03-PLAN.md line 127].
- **Callers:**
  - the service identity is refused 403 by the human-only-birthright set that Phase 19 creates for exports and 19.1 generalises (19.1-CONTEXT D-36), joined here by the search, `my_response` and the rounds read;
  - the analyst's grant ("Search Active Assessment Owners") and the Requestor's ("Search Users") keep their URLs; their descriptions state the hardened contract (D-65).
- **Event line:** one function in Phase 14's `src/csrm/audit/security-event-log.ts` [CITED: 14-RESEARCH.md line 28; 19-RESEARCH.md Pattern 9], writing:

  `{ event: "csrm.people.search", at, actor: { documentId, displayName }, term, resultCount, outcome: "searched" | "refused", reason? }`

  It never includes a result. The sink is injectable.
- **Policy denials** (no identity, the service identity) stay in Strapi's request log, as 19 D-18 rules for exports. The controller logs `searched` and its own 400 refusals.
- **R-08-13** already treats these lines as personal data. Record 2 amends `phase-19-exports-and-export-log.md` with the event.
- **Web:**
  - `parseActiveUserSearch` and the `OwnerCombobox` debounce send nothing below two characters and say so;
  - every consumer gets the rule: the assessment editor, the Risk Register detail, the Administration information-system owner and the new response form;
  - the picker for first-line people is the X-2 record picker over the same Server Action, display names only.

### J. Notifications through Phase 19.1 (D-57; SC5)

- **Kinds:** `response-requested` (recipients: each participant asked; part `requestor` or `risk-owner`; subject: request and assessment; `facts { schemaVersion: 1, roundNumber }`) and `response-submitted` (recipient: the assigned analyst; part `security-analyst`; `facts { schemaVersion: 1, roundNumber, responderId }`). The responder is named only where the analyst's read shows them, which it does (19.1 D-16).
- **Recipient rules:**
  - one notification per recipient per event: a person who is both Requestor and owner gets one, in the `requestor` part;
  - never the actor, the service identity or an inactive user (19.1 D-06);
  - nothing to an unassigned request's analyst, which cannot occur after open, because open requires an assignee.
- **`assessment-released`** gains every participant as a recipient when the gate is open (19.1 D-12).
- **Readability:**
  - the `risk-owner` part and `response-requested` use `whereViewerMayReadAssessment`;
  - the `requestor` part's assessment kinds must also use it for response kinds, and `readable && released` only for `assessment-released` (Pitfall 2);
  - a former owner's notifications disappear with their read.
- **Destinations** are built at read time:
  - the participant page for a non-analyst recipient;
  - the analyst page for a recipient who holds the analyst read, where analyst-participants work (D-27);
  - the analyst assessment page for `response-submitted`.
- **Read by acting and by reversal:** submit reads the submitter's `response-requested`; close reads outstanding participants' `response-requested` and the assignee's `response-submitted` for that round.

### K. Development fixtures (D-67, D-68)

**Persona (recommended values; Planner's Discretion):**

| Field | Value |
|---|---|
| Display name | Riley Chen |
| First and last name | Riley, Chen |
| Username | `riley.chen` |
| Email | `riley.chen@idambox.com` |
| Account | `accountStatus: "active"`, `roles: []` (birthright only, as Maya [VERIFIED: seed-assessment-navigation-lifecycle.ts:54-62]) |
| Sign-in label | `Payroll Manager`: a job title, not an IdamBox Role, and short enough for the 375px header fit Phase 11 and 19.1 check with the longest development role |
| Keycloak id | `5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e03`, the next value in the existing sequence |
| Realm password | `riley`, the first-name convention |

- **Seed:** in `seed-assessment-navigation-lifecycle.ts` beside Maya and 13-07's `sam.analyst@idambox.com`, behind `IDAMBOX_SEED_CSRM` and `developmentIdentityEnabled()` [VERIFIED: seed-assessment-navigation-lifecycle.ts:47-48]. It spreads `...developmentFixtureSubject("riley.chen@idambox.com")`, so the id is written only in development with provisioning off.
- **Keycloak files, changed together in one task:**
  - `DEVELOPMENT_FIXTURE_SUBJECTS` gains the entry, and its header comment changes "the two local fixture people" to the fixture people;
  - `idp/keycloak/import/idambox-realm.json` gains the user in Jane's shape (lines 12-28);
  - `idp/README.md`'s Realm Import table lists the user and id [VERIFIED: idp/README.md, "Fixed user ids" row].
- **Keycloak proofs:**
  - "the fixture ids match the local realm import" proves the two files agree;
  - the existing development-seed test proves the gating;
  - a seed integration test (the 13-07 `second-analyst-seed` pattern) proves the persona exists with no role and, under the development identity with provisioning off, the fixed `externalSubject`;
  - Keycloak is never started, and no flag changes.
- **Web:**
  - `developmentRoles` gains `'Payroll Manager'`;
  - `developmentFixtureIdentityForRole('Payroll Manager')` returns the email;
  - the persona gets the Requestor capabilities (19.1 adds `notification:read`);
  - the role switcher and the sign-in page offer `Continue as Payroll Manager`;
  - `SignInRole` gains it;
  - `production-hardening.spec.ts`'s `fixtureEmails` gains the email.
- **Strapi harness:** identity `risk-owner` (§E). Playwright journeys create their own records. A development seed of an assessment in the response stage is optional (D-68); if a plan adds one, no journey reads it.

### L. The journey spec: `apps/csrm/e2e/risk-owner-journey.spec.ts` (first slice)

**Structure, built for extension:**
- **One test, one run per project.** One `test.describe('Post-demo risk-owner journey @journey')` holds one `test('the risk owner journey', …)`. Each project (desktop, then mobile) runs the whole journey on its own records with a run-unique suffix.
  - One test keeps every slice on one record set. `describe.serial` would split state across tests and re-run everything on retry.
  - The test budget is the sum of per-slice budgets: `test.setTimeout(JOURNEY_SLICE_BUDGETS_MS.reduce(...))`, with Phase 17's slice at 600,000 ms [ASSUMED]. 17.1, 17.2 and 20 add their entries.
- **Actors as browser contexts.** Jane, Bob, the persona and Maya each get `browser.newContext({ baseURL: webOrigin, viewport: primaryViewport(testInfo) })`, signed in once with `signInAs` (the existing multi-context pattern [VERIFIED: assessment-navigation-lifecycle.spec.ts:173-174]).
- **One state object.** `type JourneyRecords = { suffix; requestNumber; requestId; assessmentId; risks: { ownerTreat: Risk; ownerAccept: Risk; requestorOnly: Risk[] }; roundNumber; … }` is filled as the steps run.
- **Slices are exported functions in the spec**, each wrapping `test.step` blocks with stable titles (`PD17-01 raise the request`, …):
  - Phase 17: `sliceRaiseAndAssess`, `sliceNominateAndRelease`, `sliceRespond`, `sliceDecideAndReassess`;
  - Phase 17.1 appends `sliceSubmitForAcceptance`, `sliceDecideRisks` and `sliceReleaseAndClose`;
  - Phase 17.2 inserts its contest between `sliceSubmitForAcceptance` and `sliceDecideRisks`;
  - Phase 20 appends `sliceTrackTreatment`.

  The test body is a list of awaited slice calls, so each phase's change is one line plus its functions.
- **Negatives as helpers in `e2e/helpers/journey-guards.ts`**, called at every step:
  - `expectNotFoundForMaya(mayaPage, records)`: the in-shell not-found page for the assessment URL, and the record absent from her "My risk assessments", Home, notifications and quick find;
  - `expectApiRefusals(request, records, stage)`: Maya's 404 on the assessment, its risks, control implementations, rounds and `my_response`; the persona's 403 `RESPONSE_NOT_PERMITTED` on a save naming Jane's risk; Bob's 403 `NOT_A_PARTICIPANT` on `my_response`.
- **API checks in Playwright** use Playwright's `request` fixture against `CSRM_E2E_STRAPI_ORIGIN` with:
  - `Authorization: Bearer ${process.env.CSRM_E2E_DEVELOPMENT_API_TOKEN}`, which `playwright.config.ts` sets (`process.env.CSRM_E2E_DEVELOPMENT_API_TOKEN ??= developmentApiToken;` [VERIFIED: playwright.config.ts:100]);
  - `x-csrm-dev-identity: <email>`, which Strapi's development middleware resolves to an active user [VERIFIED: csrm-development-identity.ts:36-52].

  These are direct proofs of Strapi's refusals, not a frontend API path. `harness-urls.ts` exports the Strapi origin, and the helper lives in `e2e/helpers/strapi-api.ts`. No existing spec does this yet [VERIFIED: grep this session found the token only in `production-hardening.spec.ts`].

**The first slice's records and steps** (the CONTEXT's specifics, reconciled with the deterministic draft v2 [CITED: 12-06-PLAN.md lines 122-130]):
1. Jane raises a UAT-A-like request (12-19's records approach) with internet-facing system, third-party involvement and the answers that produce the Internet Exposure and Third-Party Dependency risks.
2. Bob picks it up (Phase 13), generates and releases the questionnaire. Jane answers and submits.
3. Bob drafts, confirms the AI values (dismissing suggestions on the persona's two risks, so readiness has no open proposal), and sets Jane as owner of every risk in one step. He then names the persona on two risks:
   - `ownerTreat` = Internet Exposure;
   - `ownerAccept` = Third-Party Dependency, which the draft proposes as Accept at residual Moderate with no suggested control [CITED: 12-06-PLAN.md line 126].

   This meets 17.1's constraint that the accepted planned control sits on one of the persona's risks and the other has none [CITED: 17.1-CONTEXT.md D-70].
4. Bob releases for response with a message. Jane and the persona each see "Released for response", the persona in "My risk assessments" with "Risk owner · 2 risks" and a notification.
5. The persona responds only on their own risks.
6. Jane adds two controls on `ownerTreat` (Existing with evidence; Planned with a due date), naming a control owner by typing two letters. Both submit, and Bob is notified.
7. Bob closes round 1. He accepts the Planned control into a library control and rejects the Existing one ("already recorded") with a reason. "Reassess residual risk" on `ownerTreat` proposes `Unlikely × Major` citing the accepted control, and Bob confirms each unit.

Negatives at each step as above. The second spec (name: `response-stage.spec.ts`) covers what the CONTEXT lists: SC1 refusals, the two-character search, round 2 with carry-forward, the editing pause, and a v1 release followed by the persona's print and export.

**Cross-slice constraint for 17.1:** 17.1's slice keeps decided risks at Low or Moderate "so no approver is needed" [CITED: 17.1-CONTEXT.md D-70]. The draft's Personal Information Handling and untested-recovery risks are High (`Possible × Major` = 12). Either the journey's answers avoid them, or 17.1's slice lowers Jane's risks; the two plans must agree (Open Question 4).

### M. Contract and record changes (the chain)

- **Records:**
  - `docs/contract-gaps/phase-17-response-rounds.md` holds the entities, the gate fact, stage, step, holder and queue, write discipline, readiness, the guard, and dated amendments to `phase-16-risk-withdrawal-and-history.md` (sources) and `phase-12-ai-run-record-and-provenance.md` (operation and units).
  - `docs/contract-gaps/phase-17-participant-read.md` holds the predicate, projection, routes, "My risk assessments", export and report, separation of duties, and the people search. It amends `phase-04-composite-release-fact.md` ("Requestor visibility and projections"), `phase-13-request-assignment.md`, and `phase-19-exports-and-export-log.md` (the predicate split; 19 D-16's "own unreleased: 404" becomes 409 for a participant who can read; the search event).
  - Both are followed by a `checkpoint:decision` where the executor stops. No `phase-17-notifications.md` (Orchestrator Confirmation).
- **Spec:**
  - new paths and schemas;
  - `ParticipantAssessmentDetail` in the union;
  - stage and parts on list items;
  - `skipped` in the step state;
  - `participants` in the holder;
  - `search` `minLength: 2`, from 1 [VERIFIED: specification.json `/v1/users` parameter `"minLength":1,"maxLength":100`];
  - the new reasons and the readiness error schema.

  Then `api:generate` and `api:check`.
- **Catalogue:**
  - the new Functions (§A) and a design note;
  - the renamed descriptions of `function.risk_assessments.risk_assessment_details_read_only.api.01` ("Get Released Risk Assessment … only when it is associated with the signed-in Requestor's request") and `function.risk_assessments.my_risk_assessments.api.01` and `.api.02` [VERIFIED: catalogue `functionApis[34..36]`, printed this session], with URLs unchanged;
  - both copies `cmp`-identical.
- **`served-operations.json`:** regenerated with the dev servers stopped. The new content types get no core router (the existing custom-router pattern [VERIFIED: csrm-control-implementation/routes/csrm-control-implementation.ts:1-30]).

## Architecture Patterns

### System Architecture Diagram

```
 Analyst (Bob)                       Participants (Jane, Riley)            Maya / agent
     │ nominate, open, close,             │ read, save, submit                 │ any route
     │ decide, reassess                   │                                    │
     ▼                                    ▼                                    ▼
 Server Actions ──typed API──▶ Strapi route ─▶ csrm-authorization (grant, human-only set,
                                              human-only-birthright set) ── 403 ──────────▶
                                    │ actor = analyst | requestor
                                    ▼
                    ┌──────────── controller ─────────────┐
                    │ participant read?                    │ analyst write?
                    ▼                                      ▼
        assessment-participation           withRequestLock(request) → assessment serialisation
        (participationOf / SQL EXISTS)        → guard: editable → round open → actor is owner
           │ not readable → 404                  │ refused → 409 (persistence unchanged)
           │ readable → participant projection   ▼
           │   (D-25 allowlist, D-26 masking)   round / response / item / control implementation
           ▼                                     / risk history / gate fact writes
    response JSON ◀────────────────────────────── │ same transaction
                                                  ├─▶ Phase 19.1 notify(kind, subject, actor, facts)
                                                  └─▶ security-event-log (people search only)
 Reassess residual risk: enqueue (guard, policy) → proposal-job-registry (residual:{assessment})
   → run (Phase 12) → context builder + targetRisks → provider (deterministic in suites)
   → adapter (derive ratings, drop above-inherent, flag uncited, field units) → proposal on the run
   → analyst Confirm/Reject per unit via ai_proposal_decisions (stale → refused)
```

### Recommended Project Structure

```
apps/backend/src/
├── api/csrm-assessment/services/
│   ├── assessment-participation.ts      # predicate, parts, stage, SQL fragments (pure + knex)
│   ├── assessment-participation-repository.ts  # My risk assessments list, counts, filters
│   ├── response-rounds.ts               # open, close, readiness, carry-forward
│   ├── response-drafts.ts               # draft envelope parser, save, submit validation (pure)
│   ├── response-decisions.ts            # batch decisions, restore, lapse hook
│   └── risk-owner-nomination.ts         # batch + single-path validation, history source
├── api/csrm-assessment-round/ csrm-round-response/ csrm-response-item/   # content types only, no core routes
├── csrm/ai/residual-reassessment/       # context part, wire, adapter, deterministic + hosted providers
├── csrm/people/eligible-person.ts       # Phase 19.1's; Phase 17 adds the set-level query form
└── csrm/audit/security-event-log.ts     # Phase 14's; Phase 17 adds recordPeopleSearch
apps/csrm/src/features/
├── responses/   (*-schema.ts, *-service.ts, *-actions.ts, responses-domain.ts zod-free,
│                 round-panel, response-form, responses-panel, decision dialog, participants panel)
├── participation/ (stage tag mapping lives in status-badge's one mapping; participant page parts)
└── assessments/ (nomination sheet, release-for-response readiness, reassessment proposals)
apps/csrm/e2e/
├── risk-owner-journey.spec.ts           # one @journey test, slices as functions
├── response-stage.spec.ts               # the second spec (name: planner)
└── helpers/strapi-api.ts, helpers/journey-guards.ts
```

### Pattern 1: One predicate, two forms, one oracle
**What:** the pure `participationOf` decides single records. The SQL fragments decide lists, counts and notification readability. One integration test seeds every case and asserts that both forms agree, the Phase 7 D-21/D-30 pattern [CITED: review-queue-repository.ts header comment, lines 13-24 read this session]. The cases are: Requestor, owner, both, former owner, withdrawn-only owner, before the gate, legacy released, legacy unreleased, an analyst-owner, and Maya.
**When:** every read that lists or counts participations.

### Pattern 2: Gate facts read directly, histories narrate (06.8)
The gate is `sharedWithParticipantsAt`, never "a round exists" and never a log. It is written once and never cleared.

### Pattern 3: Human-only operations with a second refusal; birthright operations with record rules and an agent refusal
- **Analyst acts:** API-only Functions on `role.security_analyst`, plus `HUMAN_ANALYST_ONLY_OPERATIONS`.
- **Participant acts:** `role.requestor` Functions, plus the human-only-birthright set (19.1 D-36), plus the participation rule in the service.

### Pattern 4: Immutable submitted content, decisions beside it
`CsrmResponseItem` content never changes after submission. Decision facts are the only writes, and `restore` clears them under Undo rules, recorded in the risk history.

### Anti-Patterns to Avoid
- **A second participant check in a controller:** every read calls the module. A local "requestor or owner" test in one route is the forgotten-reader bug (16-RESEARCH Pitfall 3).
- **Reading participation from rounds or responses:** participation is current ownership plus the gate, never "was asked in round n".
- **Checking the service identity in the web:** the refusal is Strapi's.
- **Validating completeness on autosave:** this loses input. Validate at submit.
- **`$not` over `roles`, or a Document Service `$or` across two relations for counts:** both give wrong or duplicated rows (Pitfall 4).
- **Notification readability through the released predicate for response kinds** (Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue, single flight, retry | A reassessment registry | Phase 15's `proposal-job-registry.ts` | One retention, failure-code and retry policy (16's Orchestrator Confirmation) |
| Proposal item states | `itemStates` in the proposal | Phase 15's `proposal-items.ts` fold over decision events | One model across Phases 12, 15, 16 and 17 (16 Orchestrator Confirmation) |
| Residual units, base capture, stale detection | Custom diffing | Phase 16's `field-units.ts` | Already generic for this purpose ("Phase 17 reuses") [CITED: 16-PATTERNS.md line 20] |
| Ratings | Model-provided or ad-hoc maths | `risk-scale.ts` `deriveRating` | Decision 8's 5×5 bands in one place (Phase 22 takes it over) |
| Instruction validation | A new validator | Phase 15's `parseAnalystInstruction` | 1-500, line feeds only, Requestor-text guard |
| Person eligibility | `accountStatus` checks per path | Phase 19.1's `eligible-person.ts` | One predicate for owners, control owners, search, recipients |
| Security log lines | `console.log` / ad-hoc `strapi.log` | Phase 14's `security-event-log.ts` | Stable event names for the SIEM; injectable sink for tests |
| Notifications | Inserts from the workflow | Phase 19.1's `notify(...)` | Recipients, exclusions, readability and wording are its contract |
| Exports and print for participants | A participant export | Phase 19's predicate split in place | "No export change" (D-29) |
| Locks | New mutexes | `withRequestLock` (13) then the assessment queue (16) | Fixed order; no nested tails |
| Record picker | A new combobox | X-2 record picker over `OwnerCombobox` | Two-character rule in one place |

**Key insight:** almost everything this phase needs exists as a planned seam. The phase's own code is the predicate, the three entities' workflows and the guard order; every reuse removes a place where the participant rule could drift.

## Runtime State Inventory

Not a rename phase, but three runtime facts change outside the repo's files:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The operator's development SQLite database: new tables and the gate columns appear only after the orchestrator restarts Strapi (schema sync). Existing assessments read as `not-shared`; released ones keep Jane's v1 read. Seeds that reconcile `riskOwner` from Bob to Jane (Pitfall 1) rewrite those rows on the next seed run | Code edit only; no data migration (additive schema). The seed reconcile updates the dev rows |
| Live service config | A local Keycloak volume keeps its old realm: the persona exists in Keycloak only after `docker compose down -v` in `idp/` (ADR 0004 Consequences [VERIFIED: docs/adr/0004 line 36]) | None in this phase (Keycloak is never started). Note it in `idp/README.md` beside the new user |
| OS-registered state | None: verified by reading the phase scope (no scheduled tasks, services or process names) | None |
| Secrets and env vars | None: no new setting is required. Bounds are code constants, and the development API token and identity header already exist | None |
| Build artifacts | `apps/backend/dist` and `.tmp/tests-dist` are rebuilt by every Strapi run. A dev server running during a test corrupts `dist` (playwright.config.ts header [VERIFIED: lines 25-35]) | Stop the dev servers before Strapi tests and Playwright (every plan's hard rule) |

## Common Pitfalls

### Pitfall 1: Seeds and specs that name the analyst as a risk owner
- **What goes wrong:** D-18 refuses every analyst act on an assessment where the actor owns a risk. Three fixtures name Bob as owner:
  - the mutable Risk Register fixture (`RSK-DEV-MUTABLE-001`, on Bob's own request) [VERIFIED: seed-risk-register-workflow.ts:182-185];
  - the Phase 7 mutable fixture [VERIFIED: seed-analyst-insights.ts:232 `riskOwner: analyst.documentId,`];
  - the released Risk Register fixture.

  `risk-register-workflow.spec.ts` edits the mutable risk as Bob ("Save risk", "Save mitigation control") and filters by "Risk owner: Bob Doe" [VERIFIED: risk-register-workflow.spec.ts:446-447, 571, 584]. These become `409 ACTOR_IS_RISK_OWNER` failures on both projects.
- **How to avoid:** the plan that adds the owner rule changes:
  - the seeds' `riskOwner` and `treatmentOwner` on mutable fixtures to Jane;
  - `risk-register-seed.integration.test.ts`, which asserts Bob [VERIFIED: lines 218-223];
  - the spec's owner filter;
  - the analyst-insights expectations, if any read the owner.

  Released fixtures may keep Bob, since they are immutable and the rule only refuses acts. Prefer Jane everywhere so no seed contradicts G-11.
- **Warning signs:** a 409 on a seeded risk in the register journey, and seed tests asserting `bob.doe@idambox.com` as `riskOwner`.

### Pitfall 2: Response notifications filtered by the released predicate
- **What goes wrong:** 19.1-CONTEXT D-13 makes the `requestor` part's assessment notifications readable through Phase 19's released predicate. `response-requested` concerns an unreleased assessment, so it is never listed or counted.
- **How to avoid:** split the predicate into `readable` and `released` (§D). Response kinds and the `risk-owner` part use `readable`; only `assessment-released` uses both. Add a 19.1 count-oracle case for each.

### Pitfall 3: The journey never runs at 375px
- **What goes wrong:** the `mobile` project lists its specs explicitly [VERIFIED: playwright.config.ts:189-194]. A new `@journey` spec outside the list runs only on desktop.
- **How to avoid:** add both new specs to `testMatch` in the plan that creates them, and update the comment block that lists the journeys. The verify block fails when the mobile project reports zero tests for the spec (12-19's `fails_when` pattern).

### Pitfall 4: Strapi relation filters that do not mean what they say
- **What goes wrong:** `$not: { roles: { name: { $eq: agent } } }` applies the NOT to joined rows [VERIFIED: where.js:101-119]. A user holding Requestor and Agent matches through the Requestor row. Likewise, `$or` across `assessmentRequest.requestor` and `risks.riskOwner` joins both relations and duplicates rows.
- **How to avoid:** use a positive id set plus `$notIn` for exclusions (§I). Use EXISTS fragments with an oracle for participation lists and counts (§D).

### Pitfall 5: Long link-table names in raw SQL
- **What goes wrong:** Strapi shortens any identifier over 55 characters [VERIFIED: identifiers/index.js:29]. Hand-written names such as `csrm_round_responses_round_lnk` are fine, but a longer relation name silently differs.
- **How to avoid:** resolve join tables from `strapi.db.metadata.get(uid).attributes[name].joinTable` in the repository, or keep names short. A unit test asserts every table name the repository uses exists in metadata.

### Pitfall 6: The one-character search in an existing test
- **What goes wrong:** `assessment-workflow.integration.test.ts` searches `"/api/v1/users?search=a"` and expects 20 results [VERIFIED: lines 77-79]. With the two-character bound it gets 400.
- **How to avoid:** change the term to `al` (the fixtures are "Alpha Search …"), and add the 1-character 400 case and the service-identity exclusion case.

### Pitfall 7: Autosave that validates, or submits that do not
- **What goes wrong:** rejecting a half-filled planned control on save loses input (G-4). Accepting it at submit creates an item that cannot become a control implementation.
- **How to avoid:** save takes shape and bound checks only; submit runs the completeness rules and answers `RESPONSE_INCOMPLETE` with a closed issue list the form maps to fields.

### Pitfall 8: Lock order inversions
- **What goes wrong:** a nomination taking the assessment lock and then reading the assignee races Phase 13's reassignment, which holds the request lock and reads owners. Nesting the same tail never resolves.
- **How to avoid:** request lock first, always (§G). Integration tests race "reassign to X" against "nominate X" and assert that exactly one succeeds.

### Pitfall 9: Legacy and analyst readers of the detail union
- **What goes wrong:** retiring `RequestorReleasedAssessmentDetail` breaks the web's `getReleasedAssessment` parser and the parity registry entries labelled `getReleasedAssessment` and `(analyst actor)` [VERIFIED: assessment-service.ts:141-157]. The released page treats a non-404 analyst branch specially.
- **How to avoid:** change the server projection, the spec, the parser, the parity entries and the participant page in one plan, and run the parity and chain guards.

### Pitfall 10: The service identity through the birthright
- **What goes wrong:** `loadEffectiveGrants` gives every active identity the Requestor birthright, so the agent passes the grant check for `my_response`, the rounds read and the search.
- **How to avoid:** join the human-only-birthright set (19 D-13, 19.1 D-36). Matrix rows state `serviceAgent: 403`.

### Pitfall 11: Phase 19's "own unreleased: 404"
- **What goes wrong:** 19 D-16 answers a Requestor's export of their own unreleased assessment with 404. For a participant past the gate the read succeeds, so D-29 makes it 409 `ASSESSMENT_NOT_RELEASED`. Before the gate it stays 404.
- **How to avoid:** amend 19's record and tests in the same plan as the predicate split.

### Pitfall 12: An analyst named as owner, and the agent's search refusal in old rows
- **Analyst named as owner:** D-20 allows any eligible person except the assigned analyst, so a second analyst may be named owner. The guard then refuses their analyst acts, and the analyst detail must say why (D-37). Prove it with the harness's `second-analyst` (10-13).
- **The agent's search refusal:** the matrix's search row (`everyIdentity(200)`) becomes agent 403. Any test or seed path where the agent searches people fails loudly; none was found [VERIFIED: grep for `/api/v1/users` in tests this session: only `assessment-workflow.integration.test.ts` and the matrix].

## Code Examples

### 1. The guard in its fixed order (extends Phase 16's `assertAssessmentEditable`)
```ts
// Source: 16-RESEARCH.md "The editable guard" (planned) + D-45's order
export function assertAssessmentEditable(input: { assessment: LoadedAssessment; actor: { documentId: string } }): void {
  assertMutableAssessment(input.assessment);                         // ASSESSMENT_NOT_MUTABLE (Phase 12 reason)
  if (input.assessment.openResponseRound) throw conflict("RESPONSE_ROUND_OPEN");
  const owns = input.assessment.risks.some((risk) =>
    !risk.withdrawnAt && relationId(risk.riskOwner) === input.actor.documentId);
  if (owns) throw conflict("ACTOR_IS_RISK_OWNER");
  // Phase 17.1 adds the acceptance-round lock and the executive approver rule here, in this order.
}
```

### 2. Hardened search with the event line
```ts
// Source: today's controller (csrm-risk.ts:208-215) + D-52..D-54; names per §I
async searchActiveUsers(ctx) {
  const actor = await currentActor(ctx);                 // documentId + displayName, from ctx.state
  const parsed = parsePeopleSearchQuery(ctx.query);      // { ok: true, term } | { ok: false, reason }
  if (!parsed.ok) {
    recordPeopleSearch({ actor, term: null, resultCount: 0, outcome: "refused", reason: parsed.reason });
    return safeError(ctx, 400, "CSRM people search is invalid.");
  }
  const people = await searchEligiblePeople(strapi, parsed.term);   // eligible-person set form, ≤ 20
  recordPeopleSearch({ actor, term: parsed.term, resultCount: people.length, outcome: "searched" });
  return { data: people.map(projectActiveUserSummary) };
}
```
Whether to log a refused term verbatim is the record's call. Recommend logging `null` for over-long terms and the term otherwise (Assumption A6).

### 3. Submit materialising items once
```ts
// Source: D-31, D-33, D-35 (design; names per §F)
await withRequestLock(strapi, requestId, () => withAssessmentWork(strapi, assessmentId, async (trx) => {
  const round = await openRoundFor(assessmentId);              // RESPONSE_ROUND_NOT_OPEN
  const response = await ownResponse(round, viewerId);         // 404 / NOT_A_PARTICIPANT / ALREADY_SUBMITTED
  if (response.savedAt !== body.expectedSavedAt) throw conflict("RESPONSE_CHANGED");
  const issues = completenessIssues(parseDraft(response.draft), participation);  // pure
  if (issues.length) throw incomplete(issues);                 // RESPONSE_INCOMPLETE
  const items = toItems(parseDraft(response.draft));           // proposed-control | proposed-owner | comment
  for (const item of items) await createItem({ ...item, response, round, assessment });
  await markSubmitted(response, now());
  await notify({ kind: "response-submitted", subject: { request, assessment }, actor: viewerId,
                 facts: { schemaVersion: 1, roundNumber: round.number, responderId: viewerId } });
  await readOwnNotifications({ kind: "response-requested", recipient: viewerId, roundNumber: round.number });
}));
```

### 4. The journey skeleton
```ts
// Source: existing E2E patterns (signInAs, primaryViewport, multi-context) + §L
import { test, expect } from '@playwright/test';
test.describe('Post-demo risk-owner journey @journey', () => {
  test('the risk owner journey', async ({ browser, request }, testInfo) => {
    test.setTimeout(JOURNEY_SLICE_BUDGETS_MS.reduce((a, b) => a + b, 0));
    const actors = await openActors(browser, testInfo);        // jane, bob, riley, maya contexts
    const records = newJourneyRecords(testInfo);               // run-unique suffix
    await sliceRaiseAndAssess(actors, records);                // Phase 17
    await sliceNominateAndRelease(actors, records, request);   // Phase 17
    await sliceRespond(actors, records, request);              // Phase 17
    await sliceDecideAndReassess(actors, records, request);    // Phase 17 (last line of this slice)
    // Phase 17.1 appends: sliceSubmitForAcceptance, sliceDecideRisks, sliceReleaseAndClose
    // Phase 17.2 inserts its contest after sliceSubmitForAcceptance; Phase 20 appends sliceTrackTreatment
    await closeActors(actors);
  });
});
```

## Plan grouping and wave order (D-77, D-78; the planner owns the split)

One owner per hot file per wave. After wave 1 the Strapi plans run one at a time (shared `tests-dist`, `dist`, the spec, the catalogue copies and the matrix). Dev servers are stopped for every plan that edits Strapi or runs Playwright.

| Wave | Proposed plan | Content | Hot files owned |
|---|---|---|---|
| 1 | 17-01 | The two contract-gap records and the `checkpoint:decision`; pure modules with RED-first units: `assessment-participation.ts` (pure part), stage, step and holder derivations, release-for-response readiness, the guard order, the draft envelope parser and completeness rules | `docs/contract-gaps/` (records only) |
| 2 | 17-02 | Schema after approval: three content types and the gate pair, no core routes; freeze check; boot proof (legacy reads `not-shared`) | content-type schemas |
| 2 | 17-03 | Development persona: seed, `development-fixture-subjects.ts`, realm import, `idp/README.md`, web development role, sign-in, `SignInRole`, production-hardening emails, persona seed test | Keycloak files, E2E sign-in helper |
| 3 | 17-04 | People search hardening: the eligible-person set form, the agent refusal, the event line, spec `minLength`, catalogue descriptions, matrix row, the web two-character rule, the updated search test | `csrm-authorization.ts`, spec, catalogue, matrix |
| 4 | 17-05 | Nomination batch and single path; the owner rule in the guard; assignee eligibility and post-gate unassignment; history sources; the seeds and specs that named Bob as owner (Pitfall 1) | `assessment-workflow.ts`, `risk-workflow.ts`, Phase 13's assignment policy, seeds |
| 5 | 17-06 | The participant read: Phase 19's predicate split; `ParticipantAssessmentDetail`; risks masking; control implementations; "My risk assessments" repository and rating summary; export and report; web parser and page in the same plan; the matrix's seventh caller, harness identity and participant fixture | assessment controller and scope, Phase 19's predicate, matrix, harness, web assessment schema and service |
| 6 | 17-07 | Rounds: open and close, readiness, the round lock in the guard, v1 release refusals, "Responses decided", lifecycle step, holder, queue (oracle and SQL), My requests holder SQL, `response-requested` hooks | `request-lifecycle.ts`, `collection-scope.ts`, `review-queue-repository.ts`, 11-10's repository |
| 7 | 17-08 | Responses: rounds read, own response read, save, submit, carry-forward, `response-submitted`; readability of both kinds in 19.1's repository | the notification readability module |
| 8 | 17-09 | Decisions: the batch, accept into a control implementation, reject, restore, lapse hook on withdrawal | `control-implementation-workflow.ts`, Phase 16's withdraw path |
| 9 | 17-10 | Residual reassessment: context part, wire, adapter, deterministic and hosted providers, operation, job, run, units, supersession | `csrm/ai/*`, Phase 12's run vocabulary |
| 10 | 17-11 | Web typed layer: schemas, services, Server Actions, zod-free domain modules, parity and chain guards for every new operation | web services |
| 11 | 17-12 | Analyst UI: the recorded X-n extensions, nomination sheet, release-for-response readiness and confirmation, participants panel, paused banner, close round, responses panel and decision dialog, reassessment proposals, the analyst's own response panel | `assessment-editor.tsx`, `risk-editor.tsx`, `status-badge.tsx` |
| 12 | 17-13 | Participant UI: stage-aware participant page, round panel, response form (sheet below 768px), "My risk assessments", Home items and sidebar count, stepper and next action | participant page, Homes, navigation profile |
| 13 | 17-14 | `risk-owner-journey.spec.ts` first slice, `helpers/strapi-api.ts`, `helpers/journey-guards.ts`, mobile `testMatch` | E2E config |
| 14 | 17-15 | `response-stage.spec.ts`; existing specs that change deliberately; glossary entries ("Response round", "Participant"); the full gate at 375px and 1440px | `CONTEXT.md` (glossary), specs |

The count (15) sits at the top of L, as the Orchestrator Confirmation expects after the move to 19.1. If the plan check finds it beyond L, the seam to split on is the reassessment (17-10) plus its UI, which depend only on the guard and Phase 16's machinery.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| The Requestor reads only their released assessment (Phase 4; 06.4) | Participants read from a never-cleared gate; legacy keeps v1 | This phase (G-12) | Every assessment reader goes through one predicate |
| The owner picker accepts any active user, from one character | Eligible humans only, from two characters, logged | This phase (G-17) | Analyst pickers change too |
| "Every risk and control mutation is analyst-only" | Narrowed: first-line people author proposals; only analysts apply them | This phase (D-04) | No participant write to risks or control implementations exists |
| Per-feature proposal state | One fold model (Phase 15) | Phase 16 confirmation | The reassessment adds an operation, not a mechanism |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rounds per assessment capped at 20 | §B | A legitimate long engagement is refused; raise the constant |
| A2 | Items per response ≤ 500 and draft ≤ 256 KB | §B | Very large assessments hit the cap; the cap is a constant |
| A3 | Planned due date on or after today and within 5 years | §B | Users with legitimately longer plans are refused; it is a validation constant |
| A4 | Reassessment ≤ 50 risks per run | §B | Whole-assessment runs on very large assessments need batching |
| A5 | Journey slice budget 600,000 ms | §L | Timeout on a slow host; raise the per-slice constant |
| A6 | A refused over-long search term is logged as `null` | Code Example 2 | Less detail for the SIEM; the record decides |
| A7 | Persona name, email, label, id `…5e03` and password `riley` | §K | Cosmetic; the planner may rename (D-67) |
| A8 | Storing the draft as a JSON attribute on `CsrmRoundResponse` is acceptable within D-01 | §F | If the pilot prefers draft rows, save becomes delete-and-create of items before submission |
| A9 | Phase 19 and 19.1's plans expose a splittable predicate and a human-only-birthright set under those concepts | §D, §I | Phase 17 adds the split or the set itself and records it in their records |
| A10 | `skipped` (labelled "Not used") is preferred over omitting the step | §C | The UI-SPEC may choose omission; then `m` varies per request |

## Open Questions

1. **The response routes' path.**
   - What we know: D-03 proposes `…/response_rounds/current/my_response`. Research recommends `…/my_response` (§A).
   - What's unclear: whether the pilot prefers the literal `current`.
   - Recommendation: `…/my_response`, fixed in record 1.
2. **The draft attribute.**
   - What we know: D-01 lists the response's attributes without one for draft content.
   - What's unclear: whether a `draft` JSON attribute is acceptable.
   - Recommendation: add `draft` (§F) and state it in record 1 for the pilot's approval.
3. **Control implementation fields in the participant read.**
   - What we know: D-25 omits evidence and the implemented and review dates, which today's Requestor read includes.
   - Recommendation: keep today's fields (no narrowing of v1). The UI-SPEC confirms.
4. **The 17 and 17.1 journey slices' risk ratings.**
   - What we know: 17.1 needs every risk decided without an executive approver; the deterministic draft yields High risks unless the answers avoid them.
   - Recommendation: the Phase 17 plan chooses answers producing the persona's two risks plus at most Moderate risks for Jane, or 17.1's slice lowers them. Decide when 17.1 is planned; Phase 17's slice records which risks it leaves.
5. **Glossary wording.**
   - What we know: root `CONTEXT.md` says a risk owner "holds only the Requestor birthright role" [VERIFIED: CONTEXT.md:17-19], while D-20 allows analysts (not the assignee) to be owners.
   - Recommendation: the plan that adds "Response round" and "Participant" also softens that sentence (Shared-file note).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Every gate (brief §4) | ✓ | v24.19.0 at `/c/ProgramData/nvm/v24.19.0` (default `node` is v22.19.0, so always use the PATH preamble) | — |
| pnpm | Every gate | ✓ | 11.24.0 via Corepack | — |
| Playwright Chromium | E2E | ✓ | `chromium-1208` and headless shell in `%LOCALAPPDATA%\ms-playwright` | — |
| Dev servers stopped | Strapi tests, `served-operations:write`, Playwright | ✓ at research time (`netstat` showed nothing on 1337 or 3000) | — | Wait for the orchestrator |
| Keycloak / Docker | Nothing (never started) | not probed by design | — | The realm-import unit test stands in |
| Live AI provider | Nothing (deterministic in every suite) | — | — | Deterministic provider |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Web: vitest 4.1.11 (jsdom). Strapi: `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file; provider adapters through `tests/helpers/fake-openai-compatible-server.ts`. E2E: Playwright 1.58.2 with axe, Chromium, production build |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` only, explicit `testMatch`; `workers: 1`) |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <paths>`. Strapi file (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test && pnpm --dir apps/csrm test:e2e && git status --short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASSESS-22 | `participationOf` and the SQL fragments agree on every case (Requestor, owner, both, former owner, withdrawn-only, before gate, legacy released or unreleased, analyst-owner, Maya) | Strapi unit + integration oracle | quick run `assessment-participation.unit.test.js`, `assessment-participation.integration.test.js` | ❌ W0 |
| ASSESS-22 | Detail, risks and control implementations: participant 200 with projection and D-26 masking; others 404 with persistence unchanged at every stage; analyst `viewerParticipation` | Strapi integration + matrix | quick run `participant-read.integration.test.js`, `authorization-matrix.integration.test.js` | ❌ W0 / ✅ |
| ASSESS-22 | "My risk assessments" filters, parts, stage, awaited flag, exact totals; the rating summary is released only | Strapi integration | quick run `participant-read.integration.test.js` | ❌ W0 |
| ASSESS-22 (5) | Export and report: participant 200 after release, 409 before, non-participant 404 | Strapi integration + E2E | quick run of Phase 19's export test file (extended); `response-stage.spec.ts` | ✅ (19) / ❌ W0 |
| ASSESS-21 | Nomination batch: eligible, `OWNER_NOT_ELIGIBLE`, `OWNER_IS_ASSIGNED_ANALYST`, `RISK_WITHDRAWN`, foreign risk 404 for the whole batch, history rows with batch id, Undo pairs | Strapi integration | quick run `risk-owner-nomination.integration.test.js` | ❌ W0 |
| ASSESS-21 (4) | The guard's order; `ACTOR_IS_RISK_OWNER` on every analyst act, including assignment and the AI-input mark; assignee eligibility excludes owners; the reassign/nominate race | Strapi unit + integration | quick run `assessment-guard.unit.test.js`, `risk-owner-nomination.integration.test.js`, Phase 13's `request-assignment.integration.test.js` (extended) | ❌ W0 / ✅ |
| ASSESS-11 | Readiness keys; open and close by the assignee only; gate written once; one requested response per participant; round limit; v1 release refused while open; "Responses decided" | Strapi unit + integration | quick run `response-rounds.unit.test.js`, `response-rounds.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ |
| ASSESS-11 (2) | Editing paused while a round is open (`RESPONSE_ROUND_OPEN` on every analyst mutation); AI jobs lapse | Strapi integration | quick run `response-rounds.integration.test.js` | ❌ W0 |
| ASSESS-12 | Draft save (partial allowed, CAS, permitted risks, eligible owners), submit completeness, immutability, carry-forward, `NOT_A_PARTICIPANT`, service identity 403 | Strapi unit + integration | quick run `response-drafts.unit.test.js`, `responses.integration.test.js` | ❌ W0 |
| ASSESS-12 (2) | Decisions: accept creates a control implementation with history; changed values need a reason; reject reason; `CONTROL_ALREADY_ON_RISK`; restore rules; lapse on withdrawal | Strapi integration | quick run `response-decisions.integration.test.js` | ❌ W0 |
| ASSESS-13 | Adapter: derived ratings, above-inherent dropped, uncited flag, planned controls named; deterministic outcomes; wire and prompt through the fake server | Strapi unit (wire) | quick run `residual-reassessment.unit.test.js`, `ai-provider-residual.unit.test.js` | ❌ W0 |
| ASSESS-13 (2) | Jobs single flight, runs, units confirmed per unit, stale refused, supersession across rewrite and reassessment, readiness | Strapi integration | quick run `residual-reassessment.integration.test.js` | ❌ W0 |
| ASSESS-23 | 2-100 term, other keys 400, ≤ 20, no inactive, service identity or extra fields; agent caller 403; one log line per search with no results | Strapi unit + integration + matrix | quick run `people-search.unit.test.js`, `assessment-workflow.integration.test.js` (updated), `authorization-matrix.integration.test.js` | ❌ W0 / ✅ |
| SC5 | `response-requested` and `response-submitted` written in the event transaction; one per person; readability via `readable`; a former owner's disappear; read by acting and reversal; counts against 19.1's oracle | Strapi integration | quick run of 19.1's notification test file (extended) | ✅ (19.1) |
| D-07, D-08 | Step states (current, completed, skipped, future), the holder `participants`, queue buckets against the oracle, My requests holder SQL | Strapi unit + integration | quick run `request-lifecycle.unit.test.js`, `request-workflow.integration.test.js`, the 11-10 list test | ✅ (extended) |
| D-67 | Fixture ids match the realm import; the persona seeded with no role and the fixed subject only in development | Strapi unit + integration | quick run `keycloak-identity.unit.test.js`, `risk-owner-persona-seed.integration.test.js` | ✅ / ❌ W0 |
| D-75 | Seven callers on every row; provenance for `riskOwner` | Strapi integration + unit | quick run `authorization-matrix.integration.test.js`, `authorization-matrix-provenance.unit.test.js` | ✅ (extended) |
| UI (D-69, D-70) | Participant page by stage; no response control on others' risks; none for a non-participant analyst; not-found for Maya; paused editing; the two-character picker; Undo and rollback; parsers closed; parity and chain guards | Web unit | `pnpm --dir apps/csrm exec vitest run src/features/responses src/features/assessments src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts` | ❌ W0 / ✅ |
| SC6 | The journey's first slice, with negatives, at both widths; tree clean | E2E | `pnpm --dir apps/csrm test:e2e e2e/risk-owner-journey.spec.ts` then `git status --short` | ❌ W0 |
| SC1-SC4 tails | SC1 refusals, the search, round 2 with carry-forward, the pause, v1 release then the persona's print and export | E2E | `pnpm --dir apps/csrm test:e2e e2e/response-stage.spec.ts` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched web files by path; the touched Strapi files by path (dev servers stopped); `api:check` after any spec change; `cmp` of the catalogue copies after any catalogue change.
- **Per wave merge:** the full web suite, `typecheck`, `api:check`, and the full Strapi suite after every plan that edits Strapi. Each UI plan's targeted Playwright specs run at its end.
- **Phase gate:** the full suite above, with the 375px and 1440px checks for Jane, the persona, Maya and Bob, then a clean `git status --short`.

### Wave 0 Gaps
- [ ] `apps/backend/tests/assessment-participation.unit.test.ts` and `.integration.test.ts` (oracle): the predicate
- [ ] `apps/backend/tests/participant-read.integration.test.ts`: ASSESS-22 routes and lists
- [ ] `apps/backend/tests/risk-owner-nomination.integration.test.ts`, `assessment-guard.unit.test.ts`: ASSESS-21
- [ ] `apps/backend/tests/response-rounds.unit.test.ts` and `.integration.test.ts`: ASSESS-11
- [ ] `apps/backend/tests/response-drafts.unit.test.ts`, `responses.integration.test.ts`, `response-decisions.integration.test.ts`: ASSESS-12
- [ ] `apps/backend/tests/residual-reassessment.unit.test.ts`, `ai-provider-residual.unit.test.ts`, `residual-reassessment.integration.test.ts`, and wire fixtures under `tests/fixtures/ai-wire/`: ASSESS-13
- [ ] `apps/backend/tests/people-search.unit.test.ts`: ASSESS-23
- [ ] `apps/backend/tests/risk-owner-persona-seed.integration.test.ts`: D-67
- [ ] Harness: identity `risk-owner`, `seedParticipantFixtures()`, and helpers to open and close rounds and submit responses directly for fixtures
- [ ] Web: `apps/csrm/src/features/responses/*.test.ts(x)`
- [ ] E2E: `apps/csrm/e2e/risk-owner-journey.spec.ts`, `response-stage.spec.ts`, `helpers/strapi-api.ts`, `helpers/journey-guards.ts`, and both specs in the mobile `testMatch`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Keycloak / development bridge; no change, flags untouched |
| V3 Session Management | no (unchanged) | — |
| V4 Access Control | yes | Role → Function → FunctionAPI; the participant predicate (404 for unreadable records); human-only and human-only-birthright sets; the guard's owner rule (G-11) |
| V5 Validation, Sanitisation and Encoding | yes | Closed `assertPayload` bodies; the draft envelope parser; bounds §B; plain text only, never rendered as HTML or Markdown; the untrusted data block for AI context (G-3) |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | Closed reasons with actor-neutral copy; `csrm.people.search` lines with no results (R-08-13 personal data) |
| V8 Data Protection | yes | Two-field directory projection; the participant allowlist; no names or dates in the AI context; notification facts are ids and numbers only |
| V13 API | yes | No core routes for the new types (inventory and matrix prove it); every route in the matrix for seven callers |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on assessment, risk, control implementation, round or response ids | Information disclosure | One predicate on every reader; 404 for unreadable records; Maya negatives in the API and the UI |
| An analyst assessing a risk they own, or choosing their own assessor | Elevation of privilege | Guard `ACTOR_IS_RISK_OWNER`; assignee eligibility excludes owners; the assignee cannot be named |
| Directory enumeration through the search | Information disclosure | Two characters, 20 results, eligible humans only, agent refused, every search logged |
| Prompt injection through response text or evidence | Tampering | Untrusted data block, escaped tags, instruction slot apart; the adapter derives ratings and drops out-of-range values |
| Mass assignment in the response or decision payload | Tampering | Closed envelopes; server-owned item ids, statuses and decisions; owners re-checked for eligibility |
| Race between decisions, reassignment and nomination | Tampering | Request lock, then assessment serialisation; CAS on drafts; idempotent repeats |
| Notifications revealing records | Information disclosure | Readability at read time through the same predicate; no titles stored |
| A service identity responding or searching | Spoofing / Repudiation | The human-only-birthright set; matrix rows at 403 |

## Sources

### Primary (HIGH confidence; read this session)
- `apps/backend/src/keycloak/development-fixture-subjects.ts`, `idp/keycloak/import/idambox-realm.json`, `apps/backend/tests/keycloak-identity.unit.test.ts`, `idp/README.md`, `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/authorization-matrix.integration.test.ts`, `apps/backend/tests/helpers/matrix-provenance.ts`, `apps/backend/tests/helpers/strapi-http-harness.ts`
- `apps/backend/src/api/csrm-assessment/{controllers/csrm-assessment.ts, services/assessment-scope.ts, services/assessment-workflow.ts}`, `csrm-risk/{services/risk-workflow.ts, controllers/csrm-risk.ts, operations.ts, routes/csrm-risk.ts}`, `csrm-control-implementation/{schema.json, routes}`, `csrm-assessment-request/services/{request-lifecycle.ts, collection-scope.ts, review-queue-repository.ts}`
- Seeds: `seed-csrm-data.ts`, `seed-assessment-navigation-lifecycle.ts`, `seed-risk-register-workflow.ts`, `seed-analyst-insights.ts`; tests `assessment-workflow.integration.test.ts`, `risk-register-seed.integration.test.ts`
- Web and E2E: `apps/csrm/playwright.config.ts`, `e2e/helpers/navigation.ts`, `e2e/harness-urls.ts`, `e2e/production-hardening.spec.ts`, `e2e/risk-register-workflow.spec.ts`, `src/features/assessments/assessment-service.ts`, `src/lib/auth/*`, `app/(app)/app/assessments/[documentId]/page.tsx`
- `docs/references/specification.json` and both catalogue copies (printed with `node -e`)
- `@strapi/database` 5.51.0 dist (`where.js`, `identifiers/index.js`, `index.js`, `query-builder.js`)

### Secondary (MEDIUM: planned outputs, cited)
- 11-08, 11-10 plans and 11-UI-SPEC; 12-02, 12-04, 12-06, 12-10, 12-19 plans; 13-01, 13-03, 13-07 plans and 13-RESEARCH; 14-RESEARCH; 15-RESEARCH; 16-CONTEXT (Orchestrator Confirmations), 16-RESEARCH and 16-PATTERNS; 17.1-CONTEXT; 19-CONTEXT and 19-RESEARCH; 19.1-CONTEXT
- `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md` G-11, G-12, G-17, G-18, G-19; `.planning/workstreams/csrm/REQUIREMENTS.md`; `.planning/workstreams/csrm/ROADMAP.md`; root `CONTEXT.md`

### Tertiary (LOW)
- None used. No web source was needed: the phase adds no library, and every external standard is cited by the CONTEXT.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing is added, and the versions were read from package.json.
- Architecture: MEDIUM-HIGH. It is built on read code plus planned seams whose names Stage 3's plan check re-verifies.
- Pitfalls: HIGH. Each one is grounded in a read file and line.

**Research date:** 2026-10-01
**Valid until:** 2026-10-31, or until any of Phases 10 to 16, 19 or 19.1 changes a seam named here; re-check at Stage 3's plan check.

# Phase 17: Mitigation response and residual reassessment - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk treatment, communication and consultation; ISO/IEC 27001:2022 clause 6.1.3), at the G-4 premium bar. The decisions are grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: UAT-025 and UAT-026, `REPORT.md` §4, §8 and §9, `BRIEF.md` F8 and F9);
- the post-demo brief (`.planning/POST-DEMO-BRIEF.md` §6: the asks PD-1 and PD-4, and the journey);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md`: #3 and #18 first, with #5, #6, #8, #9, #10, #12, #16, G-1, G-3, G-4, G-6, and the post-demo G-11, G-12, G-17 and G-18 (G-13 to G-16 shape what this phase leaves ready);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code (see "Seeds confirmed or corrected" at the end);
- the planned outputs of Phases 10 (CONTEXT, UI-SPEC, 23 plans), 11 (CONTEXT, UI-SPEC, RESEARCH, PATTERNS, plans), 12 (CONTEXT with both Orchestrator Confirmations, RESEARCH, UI-SPEC), 13, 16 and 19 (CONTEXT);
- a read of today's code in `apps/backend` and `apps/csrm` (file references under `<code_context>`).

There is no SPEC.md for this phase. The discussion log is `17-DISCUSSION-LOG.md`.

**Plans are written ahead.** Phase 17 executes after Phases 10 to 16 and 19 (execution order 10, 11, 12, 13, 14, 15, 16, 19, 17, 17.1, 17.2, 18, 20, 21, 22). Its plans are written against today's code plus the planned outputs of those phases, name the earlier plans they rely on, and get a fresh plan check just before execution (STATE.md, "Next wave planning method").

**Size.** This phase is beyond L as scoped (D-78). The decisions are grouped so that the notification centre (D-56 to D-63) can move to its own phase without rewriting the rest; the orchestrator decides.

<domain>
## Phase Boundary

Open the post-demo risk-owner flow. A Security Analyst nominates an owner for every risk and releases the assessment for response in numbered rounds; the Requestor and the nominated risk owners then read the whole assessment and respond, per risk, with the controls they have or plan; the analyst decides each proposal, and the AI proposes a residual-risk reassessment from the recorded controls, which the analyst confirms field by field. First-line people find each other through a hardened people search, and everyone is told in the app when work waits for them. The phase closes UAT-025 and UAT-026, answers PD-1 and its part of PD-4, and creates the post-demo journey spec with its first slice.

### In scope
- Risk owner nomination, one step for all and per risk, with the G-11 separation-of-duties rules (D-16 to D-21).
- The response stage: rounds, release-for-response readiness, the never-cleared participant gate fact, closing rounds, and how the stage appears in the published vocabulary, the lifecycle, the holder and the queues (D-05 to D-15).
- The participant read: who participates, what they read at each stage, the refusals for everyone else, "My risk assessments", Home, exports and print (D-22 to D-30).
- Responses and the analyst's decisions on them, with the editable guard for the response stage (D-31 to D-45).
- "Reassess residual risk", an AI proposal confirmed per field (D-46 to D-51).
- The hardened people search and its log (D-52 to D-55).
- The in-app notification centre with per-user read state, and this phase's event kinds (D-56 to D-63).
- Grants, the contract chain, three contract-gap records and their approval checkpoint, development fixtures, the interface, and the tests, including the first slice of `apps/csrm/e2e/risk-owner-journey.spec.ts` (D-64 to D-78).

### Out of scope
- "Mark reviewed", peer approval, "Submit final assessment", acceptance rounds and their lock, recall, the Accept or Treat decision, executive approvers, release and close, and the "Closed" label: Phase 17.1 (ASSESS-14, ASSESS-20, ASSESS-24, ASSESS-25). This phase leaves each seam ready (`<seams>`).
- Contest points, sending back, rework rounds and the assessment history view: Phase 17.2.
- Owner-scoped reads for people who are not participants, treatment tracking, reminders and email: Phase 20.
- A response due date and response reminders; files attached to responses; custom (non-library) controls; real-time push of notifications; notification preferences (NOTIFY-03). See `<deferred>`.
- Any change to the stored assessment or request status vocabularies (D-05).
- Keycloak, and live AI generation in any automated suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md, abridged) | Decisions |
|---|---|---|
| **ASSESS-11** Release the initial risks for a response | (1) in "Released for response" the Requestor and every nominated owner read the risks, nothing before; (2) they edit only their responses, never risk fields; the analyst closes a round and opens another; (3) an unrelated user gets the refusal a missing record gets | D-05 to D-15, D-22 to D-27, D-43 to D-45 |
| **ASSESS-12** Respond with mitigating controls; the analyst decides each | (1) per risk, proposed existing or planned controls, each with an owner found by name, evidence and a due date, an optional different owner, then submit; (2) the analyst accepts, edits or rejects each with a reason, and accepted ones become control implementations; (3) an owner responds only on their own risks, the Requestor on any; Strapi refuses every other response | D-31 to D-42 |
| **ASSESS-13** The AI proposes a residual-risk write-up | (1) "Reassess residual risk", per risk or for the assessment, proposes residual likelihood, consequence, rating and rationale citing the accepted controls; (2) the analyst accepts per field and can re-run | D-46 to D-51 |
| **ASSESS-21** Nominate a risk owner for every risk | (1) per risk or one owner for every risk, recorded in the risk's history; (2) release for response refused while a non-withdrawn risk has no owner; inactive users and service identities refused; (3) the Requestor or an owner proposes a different owner, only an analyst changes it; (4) the assigned analyst cannot be named, and a named owner is refused every analyst mutation of that assessment | D-10, D-16 to D-21, D-38 |
| **ASSESS-22** Participants read the whole assessment, nobody else | (1) from the first release for response (or 17.1's first submission), through a dedicated fact never cleared; legacy releases keep v1's Requestor read; (2) the read lasts through every round and the released record, each view names its stage, actions only in their stage and on one's own risks; (3) the request summary, not its questionnaire, notes or attachments; (4) everyone else gets the refusal a missing record gets, in the API and the UI; (5) "My risk assessments" with the person's part; print and export of the released assessment for every participant | D-05, D-06, D-11, D-22 to D-30 |
| **ASSESS-23** A least-privilege people search | (1) at most 20 active human users matching two or more characters, `documentId` and `displayName` only; (2) never inactive users or service identities, never email, username or roles; other parameters refused; (3) every search logged; (4) used for planned-control owners now and treatment owners in 17.1; sponsor selection stays off | D-16, D-52 to D-55 |
| **NOTIFY-01** Told in the app when work waits | (1) a centre with an unread count and per-user read state for assignment, questionnaire released and submitted, risks released for response, response submitted, assessment released, and new notes; 17.1 and 17.2 add their events; (2) each opens its record within what the person may read, and nobody is told about a record they may not read | D-56 to D-63 |

**ROADMAP success criteria (Phase 17), each planned in the UI and the API with its negative cases:**
1. The analyst nominates the Requestor as owner of every risk in one step, then a different first-line person for one risk; release for response is refused while any risk has no owner, and the assigned analyst cannot be named. (D-10, D-16 to D-20)
2. The Requestor and that risk owner see the whole of UAT-A's assessment after release for response, and nothing before; the owner finds it in "My risk assessments" marked with their part, responds only on their own risk, and, once released, prints and exports it as the Requestor can. (D-22 to D-30, D-32)
3. The Requestor adds two mitigating controls to a risk, naming a control owner found by name, and submits; the analyst accepts one and rejects one with a reason. The people search needs two characters, returns no email and no service identity, and logs each search. (D-31 to D-39, D-52 to D-55)
4. "Reassess residual risk" proposes new residual values citing the accepted controls, and the analyst accepts them per field (visible "Confirm"). (D-46 to D-51)
5. An unrelated Requestor gets the refusal a missing record gets for the assessment, its risks, control implementations and responses, at every stage, in the API and the UI; each participant is told in the app when the response waits or arrives. (D-24, D-57, `<authorisation>`)
6. Playwright, first slice of the post-demo journey, with its negative cases. (D-76)

**Closes:** UAT-025 (the Requestor cannot see or respond to the initial risks before release) and UAT-026 (no AI write-up of residual risk after mitigations are recorded).
**Asks:** PD-1 (the nominated risk owner and the Requestor view the assessment) and PD-4's people search (ASSESS-23; the Accept-or-Treat choice is 17.1's).
**Intent:** F8, F9 (Phase 9 workflow).
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

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

### The response stage in the published vocabulary (decision 3; G-12)

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

### Response rounds (decision 3; ASSESS-11)

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

### Risk owners and separation of duties (G-11; ASSESS-21)

- **D-16:** One eligible-person predicate, in one shared module: an active IdamBox User who does not hold the Security Analyst Agent role (a service identity). It serves the people search's results (D-52), risk owners, control owners and proposed owners in responses, and every person relation the risk and control implementation write paths resolve (`riskOwner`, `treatmentOwner` and `controlOwner`, which today check only `accountStatus`). Phase 13's assignee eligibility adds the human analyst role on top of it, and Phase 17.1 reuses it for executive approvers.
- **D-17:** Nomination has two paths with one validation:
  - **the batch operation** (D-03 item 1) of `(risk, owner)` pairs in one transaction, which serves "Set one owner for every risk" (all non-withdrawn risks), a multi-select, and Undo (the previous owners, sent back as pairs);
  - **the risk update's `riskOwner`**, for a single risk from the risk card.

  Any human Security Analyst on the request may nominate (editing is not exclusive, decision 10), through the editable guard (D-43), while the assessment is editable and no round is open. Refusals carry closed reasons: an ineligible person (`OWNER_NOT_ELIGIBLE`), the request's current `assignedAnalyst` (`OWNER_IS_ASSIGNED_ANALYST`), a withdrawn risk (`RISK_WITHDRAWN`), a risk of another assessment (404 for the whole batch). Nomination is reversible, so it confirms with an Undo toast and never a dialog (G-4).
- **D-18:** Nobody who owns a risk acts on its assessment as a Security Analyst (G-11, extending G-1). A person currently named as a risk owner on an assessment is refused, whatever roles they hold, every analyst act on that assessment and its request: every content mutation, owner nomination, AI enqueue and decision, round open and close, response decision and v1 release (through the editable guard and the round operations, `ACTOR_IS_RISK_OWNER`), and every assignment action and note AI-input mark (Phase 13 D-06 and D-07, read the same way: choosing one's assessor or steering the AI inputs is the conflict G-11 removes). Phase 13's assignee eligibility gains "is not a named risk owner of the request's assessment", so a named owner is never assigned; with D-17, the assigned analyst is never named. Their analyst reads stay. The UI withholds those controls and says why.
- **D-19:** Every owner change is recorded in Phase 16's risk history (its D-18 to D-20): a field change of `riskOwner` with who, when, the old and new owner (id and display name at the time) and its source: an analyst edit, the nomination batch (with a batch id), or an accepted response item (D-38). The record amends `phase-16-risk-withdrawal-and-history.md`'s source vocabulary. Participation follows the change at once (D-22).
- **D-20:** Who can be named: the Requestor (success criterion 1 names them as owner of every risk) and any eligible person, analysts included, except the request's assigned analyst; never an inactive user or a service identity. An analyst named as an owner keeps their analyst reads and loses their analyst acts on that assessment (D-18).
- **D-21:** A different owner is proposed in a response (D-33: the Requestor or an owner, per risk, with a reason) or, by the Requestor only, in a note (Phase 13 D-23). Only a Security Analyst changes the owner, by accepting the proposal or nominating (ASSESS-21 criterion 3).

### The participant read (G-12; ASSESS-22)

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

### Responses (decision 3; ASSESS-12)

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

### The analyst's decisions on responses (ASSESS-12 criterion 2)

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

### The editable guard in the response stage (Phase 16 D-22)

- **D-43:** While a round is open, Strapi refuses every analyst content mutation of the assessment with `RESPONSE_ROUND_OPEN`, through the one guard behind `withMutableAssessmentMutation`: assessment fields, risk create and update, owner nomination, control implementation create, update and delete, withdrawal and reinstatement, AI enqueue and every AI decision (dismissals and rejections included), response decisions, and v1 release. A job that reaches execution or completion after a round opened records its proposals as lapsed (Phase 16 D-22 and D-40). Participants then respond to stable content, as management responds to a draft report the assessor does not change underneath them. **Reversibility:** costly - every mutation path reads it.
- **D-44:** Allowed while a round is open: every read; notes (Phase 13's window includes `under-review`); reassignment (not unassignment, D-15); closing the round; and the participants' own saves and submissions, which require an open round instead.
- **D-45:** Between rounds the assessment is editable as before ("the analyst can still edit the assessment between rounds", root `CONTEXT.md`), and participants read the analyst's rework as it happens, under "With the Security Analyst" (G-12), subject to D-26. The guard takes the actor, and its order is fixed: not editable (`ASSESSMENT_NOT_MUTABLE`), a round open, the actor a named owner. Phase 17.1 adds the acceptance-round lock and the executive approver rule to the same guard; this phase leaves that lock to 17.1.

### Residual reassessment (ASSESS-13; UAT-026)

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

### The people search (G-17; ASSESS-23)

- **D-52:** One hardened operation for every caller, in place at `GET /api/v1/users?search=`: a term of 2 to 100 characters after trimming and no other query parameter (both refused with 400); at most 20 results, sorted by display name; only eligible people (D-16), so never an inactive user or a service identity; each result `documentId` and `displayName` only, never email, username, external subject or roles; matching on the display name only. Analysts' owner pickers use the same operation, and now need two characters (G-17). **Reversibility:** costly - a published operation's bounds.
- **D-53:** Callers: every active human user, through the Requestor's "Search Users" grant or the analyst's "Search Active Assessment Owners" grant. The service identity is refused (403), whatever it holds: naming people is a human act, no agent workflow needs it, and directory enumeration by automation is what the log exists to catch (ISO/IEC 27001:2022 Annex A 8.15 and 8.16; Phase 19 D-13's precedent for exports). Its matrix row changes from 200 to 403.
- **D-54:** Every search writes one line through Phase 19's security event log module (its D-18): a stable event name, the time (UTC), the actor (`documentId` and display name), the term, the result count and the outcome (`searched`, or `refused` with its reason); never a result. R-08-13 already treats these lines as personal data. The record amends `phase-19-exports-and-export-log.md` with the event. No in-app search history.
- **D-55:** The web offers one people picker for first-line and analyst use (the X-2 record picker, from Phase 10's `OwnerCombobox`): it sends nothing below two characters and says so, debounces, and shows display names only. First-line users meet it for control owners and proposed owners in the response; 17.1 reuses it for treatment owners and executive approvers. Sponsor selection stays unavailable.

### Notifications (decision 18; G-18; NOTIFY-01)

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

### Roles, grants and catalogue

- **D-64:** New API-only Functions, in both catalogue copies, byte-identical, none granted to `role.security_analyst_agent`:
  - **human Security Analyst only**, each also in `HUMAN_ANALYST_ONLY_OPERATIONS` (and the matrix's mirror) as the second refusal: owner nomination; round open and close; response decisions; residual reassessment (its job read and retry join Phase 16's existing human-only proposal-job Functions);
  - **analysts and the Requestor birthright:** the rounds read, with the record rule of D-24;
  - **the Requestor birthright:** the participant's own response (read, save, submit), with the participation rule, and the service identity refused (D-32); notifications (list, summary, mark read), which every identity holds through the birthright and which list only the caller's own.

  Function names are research's within these families, and a catalogue design note records them. No new IdamBox Role (the brief's access rule; G-11 to G-14).
- **D-65:** The widened reads keep their Functions and URLs (`function.risk_assessments.risk_assessment_details_read_only`, `function.risk_assessments.my_risk_assessments`), with the FunctionApi names and descriptions that say "Released" or "own" updated to the participant scope. The people search FunctionApis keep their URLs, with descriptions that state the hardened contract. `served-operations.json` is regenerated.
- **D-66:** Every refusal in `<authorisation>` is proven in the API (Strapi integration tests and the matrix) and in the UI (Vitest, and Playwright where it is a journey step).

### Development fixtures

- **D-67:** The personas for the journey and the proofs:
  - **Jane** (`jane.doe@idambox.com`): the Requestor;
  - **Bob** (`bob.doe@idambox.com`): the Security Analyst who picks up and releases;
  - **Phase 13's second analyst persona**: "another analyst" cases;
  - **Maya** (`maya.requestor@idambox.com`, the Secondary Requestor, already seeded with the Requestor birthright only and no Keycloak subject): the unrelated Requestor;
  - **a new first-line risk owner persona** who is not the Requestor: an active user with the Requestor birthright only, seeded behind `IDAMBOX_SEED_CSRM` and the development identity (the Maya pattern in `seed-assessment-navigation-lifecycle.ts`), offered by the development sign-in with the Requestor's capabilities and a persona label that does not read as an IdamBox Role. Unlike Maya, this persona gets a fixed Keycloak id in `apps/backend/src/keycloak/development-fixture-subjects.ts` and a matching user in `idp/keycloak/import/idambox-realm.json`, in the same shape and credential convention as Jane's and Bob's, changed together, so a local Keycloak sign-in can walk the whole risk-owner flow; the existing unit test "the fixture ids match the local realm import" proves the two files agree, nobody starts Keycloak, and the OIDC tests stay green.

  The persona's name and email are the planner's.
- **D-68:** The Strapi HTTP harness gains a `risk-owner` identity (Requestor birthright only) for integration tests and the matrix's seventh caller (D-75); the web's development roles and the E2E `signInAs` gain the persona; Playwright journeys create their own records. A development seed of an assessment released for response, with the persona as one owner, is the planner's choice for manual exploration and is never what a journey relies on.

### Interface

- **D-69:** Surfaces:
  - **the participant page** (`/app/assessments/{documentId}`): the stage, the viewer's part, the round panel (round, message, the viewer's response status, submit), the request summary, the assessment, the risks with "Your risk" marked and a filter to the viewer's own, each risk's response area and everyone's submitted responses with decisions;
  - **the analyst editor**: release-for-response readiness and "Release for response"; owner nomination per risk and "Set one owner for every risk"; a participants panel with each person's response status; while a round is open, a banner saying editing is paused and "Close round {n}"; after close, a responses panel per risk with the decision controls; "Reassess residual risk" per risk and for all, with its proposals; the analyst's own response panel when they participate;
  - **My risk assessments**, the Requestor Home and the sidebar count (D-28); the request pages' stepper and next action (D-07); the analyst lists' stage marker (D-06); the header's notification centre and the Notifications page (D-61).
- **D-70:** The G-4 bar: a keyboard path for every action; confirmations for release for response, submitting a response, and closing a round with participants outstanding, and for nothing else here; Undo toasts for nominations, item decisions and unit confirmations; autosave with a visible saved state and no lost input (D-34); optimistic feedback with rollback; skeletons; empty states that say what to do next ("Add the controls you have or plan", "Nothing waits for you"); comfortable and compact density on the responses and participants lists; motion from the direction honouring reduced motion; phone layouts as cards and sheets (the response form for a risk opens as a sheet below 768px); every figure opens its records.
- **D-71:** Values come only from `docs/design/csrm-design-direction.md`. The UI-SPEC reuses X-1 (save status), X-2 (record picker), X-3 (dates and times), X-4 (separators), X-5 (in-place edit form), X-9 (compact stepper), X-10 (figure links), X-11 (AI provenance), X-13 (side sheet) and X-14 (Undo toast), Phase 16's field comparison extension (before and after), and Phase 13's unread marker; the stage values are tags through the one status mapping. It proposes new patterns (at least the notification centre and the response round panel) as recorded extensions numbered from the first free X-n the orchestrator gives, each recorded in the direction by a plan task before the task that uses it.
- **D-72:** Route budgets: the assessment editor stays within its budget (R-08-34): the nomination sheet, the responses panel and the reassessment proposals load on demand with `next/dynamic` from a Client Component, and static parts render on the server; the participant page renders on the server with a small, zod-free client response form; the notification panel loads on demand. `performance.spec.ts` stays green, or a recorded exception gives its reason.
- **D-73:** Copy follows the direction's voice. The terms are "Release for response", "Released for response", "Round {n}", "Close round {n}", "Your response", "Submit response", "Nothing to add", "Proposed mitigation control" (STATE.md: "mitigation control" is the display term), "Risk owner", "Set one owner for every risk", "Reassess residual risk", "Confirm", "Reject", "Notifications" and "Mark all as read"; never "Accept" for an analyst's act (Phase 12's confirmation). Exact strings are the UI-SPEC's. A plan adds "Response round" and "Participant" to the root `CONTEXT.md` glossary.

### Verification and plan shape

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

### Planner's Discretion

- Module placement, for example `apps/backend/src/api/csrm-assessment/services/assessment-participation.ts`, `response-rounds.ts` and `response-decisions.ts`, a new `apps/backend/src/api/csrm-notification/` folder, `apps/backend/src/csrm/people/eligible-person.ts`, `apps/backend/src/csrm/ai/residual-reassessment/`, and web `apps/csrm/src/features/responses/` and `features/notifications/`.
- Names of operations, Functions, reason codes, kinds, run operations, stage and holder values and envelope versions, within the families above.
- Bounds: rounds per assessment, items per risk and per response, text lengths, the notification page size and panel length, the reassessment's risks per run.
- How readability is applied to notification counts (SQL or bounded filtering), provided counts stay exact (D-58).
- Whether the response draft saves per field or per risk, provided autosave and the saved state hold (D-31).
- The development persona's name, email and label (D-67), and whether a development seed shows the response stage (D-68).
- The lifecycle step's skipped presentation (D-07), with the UI-SPEC.
- How plans split, provided D-77's serialisation and D-78's order hold.
- Copy, layout, routes for the Notifications page, and visuals: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #3 The response stage | An analyst-controlled "Released for response" stage in numbered rounds; the Requestor and named owners respond per risk with existing and planned controls, each with an owner, a due date and evidence | D-05 to D-15, D-31 to D-42 |
| #18 Notifications | An in-app centre with per-user read state in Phase 17, for assignment, questionnaire released and submitted, risks released for response, response submitted, assessment released and new notes; email and reminders in Phase 20 | D-56 to D-63 |
| G-11 Nominated risk owners | Each risk's `riskOwner`, nominated by an analyst, one step for all; required before release for response; never inactive or a service identity; the assigned analyst never an owner, and an owner never acts as an analyst on that assessment | D-10, D-16 to D-21 |
| G-12 Who reads the assessment | The Requestor and current owners read the whole assessment from a never-cleared gate, through every stage; the request summary but not its questionnaire, notes or attachments; anyone else gets the refusal a missing record gets; "My risk assessments"; exports and print follow the read | D-11, D-22 to D-30 |
| G-17 Finding people by name | One hardened search: two characters, 20 results, active human users, `documentId` and `displayName`, every search logged | D-16, D-52 to D-55 |
| G-18 Notifications for the flow | Phase 17: risks released for response to the Requestor and each owner; a response submitted to the assigned analyst; later phases add their kinds | D-57, D-62 |
| #5 Analyst instructions | The reassessment's instruction slot, never holding Requestor text | D-47, D-48 |
| #6 Removing risks | Withdrawn risks never reach participants; items on a withdrawn risk lapse | D-26, D-40 |
| #8 Scales and appetite | Derived ratings; residual counts planned controls | D-49 |
| #9 After release | The released record is immutable; no round after release | D-14, D-43 |
| #10 Pick-up and assignment | Editing is not exclusive; release for response is reserved to the assignee | D-09, D-17, D-38 |
| #12 Exports | Participants export and print what they read, once released | D-29 |
| #16 Released label | "Released" for the released stage | D-06 |
| G-1 Separation of duties | Human-only analyst operations; G-11 extends it to owners | D-18, D-64 |
| G-3 AI data policy | Minimal context, untrusted delimiting, a run per call, refusal above the ceiling | D-47, D-48 |
| G-4 Premium bar | Keyboard, confirmations for governance steps, Undo, autosave, skeletons, phone layouts | D-70 |
| G-6 Housekeeping | The pilot approves each contract-gap record; Playwright leaves the tree clean | `<contract_gaps>`, D-76 |
| G-13 Submit, release and close (seam) | One extensible status mapping; the released predicate widens in one place; the assignee gates 17.1 | D-06, D-29, D-45 |
| G-14 Accept or Treat (seam) | Residual counts planned controls; the people search serves treatment owners | D-49, D-55 |
| G-15 Contest and rework (seam) | Rounds are an extensible concept; history and contest points join the read in 17.2 | D-01, D-30 |
| G-16 Treatment tracking (seam) | No `targetDate` due logic in any new surface; the one shared rule stays the only one | `<seams>` |

**Conflicts:** none between the ROADMAP entry and these decisions. Decision 18's list includes "acceptance requested and decided"; G-18 (later) assigns those events to Phase 17.1, which this phase follows. The ROADMAP's "reversing 'every risk and control mutation is analyst-only'" is recorded as a narrowing (D-04).
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoint

Each record follows the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md`, `phase-06.8-questionnaire-governance-facts.md` and the Phase 12, 13 and 16 records: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, and Migration.

1. **`docs/contract-gaps/phase-17-response-rounds.md`.**
   - **The gap:** the JDL has no response stage, round or response (UAT-025; `REPORT.md` §8: "a new assessment stage in the status vocabulary and a requestor response per risk need contract-gap records").
   - **The stage in the published vocabulary:** derived, with no stored enum change (D-05); the published `stage` values (D-06), the lifecycle step (D-07), the holder value and the queue buckets (D-08).
   - **The extension:** `CsrmAssessmentRound`, `CsrmRoundResponse` and `CsrmResponseItem` (D-01 items 2 to 4), and the gate fact on `CsrmAssessment` (D-01 item 1; D-11: written once by the first release for response or 17.1's first submission, never cleared, read directly by the participant read; unlike 06.8's questionnaire `releasedAt`, which a return to analyst review clears).
   - **Write discipline:** rounds opened and closed only by their operations, in one transaction under the assessment lock, at most one open; responses written only by their author until submitted and immutable after; decisions only by their batch operation; every write in the transaction of its event.
   - **The response-stage rules:** release-for-response readiness (D-10), the guard during an open round (D-43 to D-45), the v1 release refusals and readiness additions (D-14, D-41).
   - **Dated amendments, summarised here:** `phase-16-risk-withdrawal-and-history.md` (new history sources: the nomination batch and the response item; D-19, D-38); `phase-12-ai-run-record-and-provenance.md` (the `residual-reassessment` operation and its run-scoped units; D-47, D-49).
   - **Not added:** a stored status value, a response due date, files on responses, custom controls, participant edits of risks or control implementations.
2. **`docs/contract-gaps/phase-17-participant-read.md`, amending `phase-04-composite-release-fact.md` ("Requestor visibility and projections").**
   - **The gap:** v1 reads an assessment only through the request's `requestor` and only after release; the JDL request has no owner field, and ownership sits on the risk (G-11).
   - **The rule:** the participants (D-22), the gate and the legacy rule (D-23), the refusals (D-24), the projection's allowlist and exclusions (D-25, D-26), the routes (D-27), "My risk assessments" (D-28), exports and print through Phase 19's predicate (D-29, amending `phase-19-exports-and-export-log.md`'s predicate section), and participation being current.
   - **Separation of duties:** the eligible-person predicate (D-16), nomination and its refusals (D-17, D-20), the owner rule (D-18), with a dated amendment to `phase-13-request-assignment.md` (assignee eligibility excludes named owners; no unassignment from the first release for response; D-15, D-18).
   - **The people search (G-17):** the hardened contract (D-52, D-53) and its event line, amending `phase-19-exports-and-export-log.md` (D-54); this settles Phase 2's deferred directory contract.
   - **Not added:** a request-level owner field, any use of `sponsor`, a new IdamBox Role, participant access to request routes, notes, attachments or the risk history.
3. **`docs/contract-gaps/phase-17-notifications.md`.**
   - **The gap:** no notification or read-state entity exists (catalogue design note 6; decision 18).
   - **The extension:** `CsrmNotification` with its per-user read state (D-01 item 5; D-56).
   - **The rules:** the kind vocabulary and how later phases extend it without a schema change (D-57), recipients and exclusions (D-56), readability at read time (D-58), wording at read time (D-59), read state (D-60), channel neutrality and Phase 20's delivery facts (D-62), retention (D-63).
   - **Not added:** email, push, preferences (NOTIFY-03), stored titles or Requestor text.

**Approval checkpoint:** the first plan writes the three records, then a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews each record, approves it, and records the approval in the record itself; each record's schema, catalogue and specification work runs only after its own approval. The changes are additive, so Strapi's schema sync creates the tables and columns and `apps/backend/database/migrations/` stays empty (the 06.1, 06.8, 12, 13 and 16 precedent). The proof boots a fresh test database; existing assessments read as `not-shared` with no rounds, existing released assessments keep their Requestor read, and the operator's development database shows the new tables after the orchestrator's next Strapi start. The content-type freeze check then lists exactly the approved schema files.
</contract_gaps>

<authorisation>
## Authorisation Model and Negative Cases

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record-level rule, against the resolved IdamBox User in `ctx.state`, identically under the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2). Navigation visibility is not authorisation: every control the UI hides is also refused by Strapi.

**Grants** (D-64): the analyst operations through human-only API Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`; the participant operations and notifications through the Requestor birthright with record rules; the widened reads through their existing Functions with the participant predicate; release for response and round close also through `assertAssignedAnalyst`; the guard (D-43, D-45) for every analyst mutation.

**Positive cases:**
- any human Security Analyst on the request reads everything, nominates owners, decides response items and reassesses, when the guard allows and they are not a named owner;
- the assigned analyst opens and closes rounds;
- the Requestor and current owners read the assessment from the gate on, at every stage, and respond in an open round within D-32;
- every participant exports and prints the released assessment;
- every active human user searches people with two or more characters;
- every person reads and marks their own notifications.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by Vitest or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| Maya (an unrelated Requestor) reads Jane's assessment, its risks, control implementations, rounds or responses, before the gate, during a round, between rounds or after release | 404, persistence unchanged | Not-found page; nothing in My risk assessments, Home, notifications or quick find |
| Maya saves or submits a response on Jane's assessment | 404 | Not offered |
| A nominated owner reads anything before the first release for response | 404 | Not listed; no notification |
| A former owner (renominated away) reads or responds | 404 | Not listed; their notifications disappear |
| A participant who is not the Requestor reads the request, its questionnaire, notes, attachments or generation jobs | The existing refusals: 403 for the request read, 404 for notes (Phase 13 D-23) and attachments, 403 by grant elsewhere | No links; the page's permission or not-found state |
| An owner responds on another owner's risk | 403 `RESPONSE_NOT_PERMITTED` | No response control on that risk |
| A participant saves or submits with no round open, or after submitting | 409 `RESPONSE_ROUND_NOT_OPEN` or `RESPONSE_ALREADY_SUBMITTED` | Read-only response with the reason |
| A participant calls any analyst operation (nominate, rounds, decisions, reassess, risk or control implementation mutations) | 403 (no grant) | No control |
| A Security Analyst who is not a participant reads, saves or submits "my response" | 403 `NOT_A_PARTICIPANT` | No response panel: the analyst cannot respond on a participant's behalf |
| The service identity saves or submits a response, or searches people | 403 | Not applicable |
| The service identity calls any Phase 17 analyst operation | 403 (human-only set) | Not applicable |
| Naming the service identity, an inactive user or (as risk owner) the assigned analyst | 409 `OWNER_NOT_ELIGIBLE` or `OWNER_IS_ASSIGNED_ANALYST`; control owners and proposed owners refused the same way | The picker never offers the first two and marks the assigned analyst not eligible |
| A named owner holding the analyst role edits, nominates, decides, reassesses, opens or closes a round, releases, assigns or marks a note's AI input on that assessment | 409 `ACTOR_IS_RISK_OWNER`, persistence unchanged | Analyst controls withheld with the reason |
| Assigning the request to a named owner | 409 `ASSIGNEE_NOT_ELIGIBLE` | Not in the eligible list |
| Release for response by an analyst other than the assignee, or on an unassigned request | `NOT_ASSIGNED_ANALYST` or `REQUEST_UNASSIGNED` (Phase 13 D-10) | Control shown only to the assignee; others see who holds it |
| Release for response with an unowned risk, an unconfirmed AI value, an open proposal or a running AI job | 409 `RELEASE_FOR_RESPONSE_NOT_READY` with the outstanding keys | The readiness checklist with links |
| Any analyst content edit, decision, reassessment or v1 release while a round is open | 409 `RESPONSE_ROUND_OPEN` | Editing paused, with the reason |
| v1 release with undecided response items | 409, release readiness outstanding | Readiness shows "Responses decided" |
| Accepting a proposed control without a library control, or into one already on the risk | 400, or 409 `CONTROL_ALREADY_ON_RISK` | The dialog requires the control and offers "Reject: already recorded" |
| A search term under two characters, or any other parameter | 400 | The picker waits for two characters |
| Search results including an inactive user, the service identity, an email or a role | Never (tested) | Not applicable |
| A participant's export or report before release | 409 `ASSESSMENT_NOT_RELEASED` | No export or print control before release |
| A non-participant's export or report | 404 | Not-found page |
| Listing, counting or marking another person's notifications | Only the caller's own are listed; another id is 404 | Not applicable |
| A notification about a record the recipient can no longer read | Not listed or counted | Not shown |
| No identity, or no token | The matrix conventions: 403, or the token family's status | The sign-in path |

**The seventh matrix caller** (D-75) proves every served route for a participant who is not the Requestor. Phase 17.1 adds its negatives (decisions refused to the analyst, the Requestor when not named and the service identity) through the same predicate and guard.
</authorisation>

<seams>
## Cross-Phase Seams

- **Phase 10** (executes first): closed conflict reasons and refusal copy (its D-22); the released risk projection (D-34), which the participant projection extends; the shared record picker and the control picker (D-28, D-29); the navigation guard (D-12); `LocalInstant` and X-1 to X-5.
- **Phase 11** (executes first): the navigation profile gains the My risk assessments count, and the header gains the notification centre (its D-10, D-13); the holder gains a value and the response step (its D-20, D-27); the Requestor Home's "Needs your action" gains awaited responses (its D-19); the assessment lists carry the stage; quick find widens through the list; the status mapping and the request lifecycle stay one extensible place each (the G-13 seam).
- **Phase 12** (executes first): the context builder, policy, run record, provenance, decision operation and run read (its D-04 to D-08, D-19 to D-25) carry the reassessment; visible "Confirm" (its 2026-10-01 confirmation); its Requestor disclosure appears on the participant page; "AI proposals reviewed" gates release for response (D-10).
- **Phase 13** (executes first): `assignedAnalyst` and `assertAssignedAnalyst` (its D-10) gate the rounds; its eligibility (D-06) excludes named owners; unassignment stops at the first release for response (D-08, D-11); notes stay with the Requestor and analysts (D-23); its recorded events become notifications here (D-12, D-24), and a `note-added` notification reads with the note read state; its second analyst persona joins this phase's personas (D-31); the journey's analyst picks up the request.
- **Phase 14** (executes first): participants who are not the Requestor never read attachments; opted-in attachment text enters the reassessment context; files on responses are deferred, and Phase 20's treatment evidence reuses Phase 14's service.
- **Phase 15** (executes first): its instruction validator, in `apps/backend/src/csrm/ai/`, serves the reassessment (Phase 16 D-27).
- **Phase 16** (executes first): the guard (its D-22) gains the round lock and the owner rule; the active-risk rule (D-13, D-14) defines owners, readiness and the read; the risk history records owner changes and response-sourced control implementations (D-18 to D-20); its proposal mechanism, jobs and supersession carry the reassessment (D-26, D-34 to D-41); withdrawn risks stay hidden from participants (D-08). Its seam S-5 is answered: analysts cannot withdraw or re-run during an open round, and items on a later-withdrawn risk lapse (D-40, D-43). Its Orchestrator Confirmations (2026-10-01) bind here too: visible "Confirm" and "Confirm all" for AI units (D-50 follows them), one closed reason for a decision on a proposal no longer open, any analyst who may read the request retries a job, no AI "Accept" while a planned control exists (which response-sourced planned controls now trigger), and no deletion of a request that has an assessment, so rounds, responses and notifications are never orphaned.
- **Phase 19** (executes first): its one released-assessment predicate (D-14) is widened here in its one place; its event log (D-18) carries the search line; its label vocabulary (D-07) gains the stage labels; list exports follow the widened "My risk assessments" (D-05); before release, a participant's export is 409, as an analyst's is (D-15).
- **Phase 17.1:**
  - the guard gains the acceptance-round lock and the executive approver rule, in the same place (D-45);
  - executive approvers join the participant predicate, the eligible-person predicate and the notification recipients (D-22, D-16, D-57);
  - its first "Submit final assessment" writes the gate fact when no round ran (D-11);
  - submission readiness inherits "No response round open" and "Responses decided" (D-14, D-41), and a response round cannot open while an acceptance round is open;
  - release and close replaces v1's release, keeps its refusals, widens the released predicate to `closed` (D-29), and changes `assessment-released` to released and closed;
  - the stage vocabulary gains `awaiting-acceptance` (D-06), and the holder's `participants` value serves acceptance rounds (D-08);
  - rounds may gain an `acceptance` kind on this phase's entity (D-01, 17.1 decides);
  - the decision fingerprint covers response-sourced control implementations and owner changes as ordinary risk content;
  - `risk-owner-journey.spec.ts` continues from this slice.
- **Phase 17.2:** contest points belong to acceptance rounds, not response rounds; a response comment is not a contest point; contest points and the history view join the participant read through the predicate (D-30); the before-and-after view reuses Phase 16's field comparison; it decides participant access to the risk history and the rounds' history view.
- **Phase 18:** bulk edits honour the response-round lock and the owner rules through the guard and the eligible-person predicate; bulk owner changes record in the risk history with a batch source; the table shows response-sourced control implementations like any other.
- **Phase 20:** it adds reminder kinds and email delivery facts without changing the notification entity (D-62); control and treatment owners who are not participants (for example a control owner named in a response) see their own records only after release (RISK-05); owners of assessments released before this flow see their own risks there (D-23). G-16: this phase adds no due-state logic; any due marker on a participant view comes from the one shared rule Phase 20 switches to `treatmentResolveDate`.
- **Phase 21:** the rounds' opened and closed times and the responses' submission times feed stage times (the response rounds are a stage); notifications are not a metric source.
- **Phase 22:** the Admin is never eligible as an assignee and holds no analyst grant; a notification retention setting is a candidate (D-63); the service agent's role review inherits D-53's search refusal.
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings, asks and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-025 and UAT-026 in full; UAT-033 (the released view this read extends) and UAT-040 (review, 17.1).
- `.planning/uat/product-gaps/REPORT.md`: §4 (Requestor "Messages from the analyst"; analyst "My work by stage"), §8 (the Phase 17 proposal, "a new assessment stage in the status vocabulary"), §9 (decisions 3 and 18).
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F8 and F9.
- `.planning/POST-DEMO-BRIEF.md`: §1 and §2 (overrides and dev-mode rules), §6 (the operator's asks and the full journey).

### Planning authority
- `.planning/ROADMAP.md`: the Phase 17 entry (goal, decisions, contract line, six success criteria), the 17.1, 17.2, 18, 19 and 20 entries for the seams, "Next-wave coverage" and "The post-demo journey".
- `.planning/REQUIREMENTS.md`: ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21, ASSESS-22, ASSESS-23 and NOTIFY-01 with their acceptance criteria; ASSESS-14, ASSESS-20, ASSESS-24, ASSESS-25, ASSESS-26, COLLAB-04, NOTIFY-02, NOTIFY-04, RISK-04, RISK-05, RISK-06 and CSV-01 for the seams.
- `.planning/NEXT-WAVE-DECISIONS.md`: decisions 3, 5, 6, 8, 9, 10, 12, 16 and 18; G-1, G-3, G-4, G-6; the post-demo G-11 to G-18 and the asks PD-1 to PD-5.
- `.planning/STATE.md` Decisions (the planning method; "mitigation control" as the display term), `.planning/PROJECT.md`, and `.planning/milestones/v1.0-STATE.md` (Phase 04's release and visibility decisions; 06.4's Requestor-after-release decision; Phase 2's sponsor deferral, in `.planning/STATE-ARCHIVE.md`).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md` (D-04 to D-08, D-10, D-14, D-19 to D-25, D-32, and both Orchestrator Confirmations), `12-RESEARCH.md` ("Envelopes", "The assessment context") and `12-UI-SPEC.md` (X-11 to X-14, UI-D1, UI-D12).
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md` (D-06 to D-12, D-18, D-22 to D-24, D-29, D-31, and its `<seams>` for Phase 17).
- `.planning/phases/16-risk-curation-and-targeted-ai-re-runs/16-CONTEXT.md` (D-05 to D-08, D-13, D-14, D-18 to D-23, D-26, D-27, D-34 to D-42, D-46, seams S-5, S-6, S-11, and its Orchestrator Confirmations of 2026-10-01).
- `.planning/phases/19-csv-export-and-import-hardening/19-CONTEXT.md` (D-05, D-07, D-13 to D-16, D-18, D-23, D-34, and its Orchestrator Confirmations of 2026-10-01: files reach the browser through a Server Action returning Strapi's bytes, which the participant export reuses).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-06 to D-13, D-16, D-19 to D-21, D-27, D-31, D-49) and `11-UI-SPEC.md` (§1, §5.2, §7.2, X-6 to X-10).
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md` (D-11, D-12, D-19, D-22, D-28 to D-30, D-34, D-35, D-41) and `10-UI-SPEC.md` (X-1 to X-5).

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §3 (collaboration), §8 (risk content), §19 (AI architecture, untrusted content), §20 (record gaps rather than competing models) and §22 (IDOR, output escaping).
- `docs/references/idambox-datamodel.jdl`: `CsrmAssessment` (`assessmentStatus`), `CsrmAssessmentRequest` (`requestor`, `sponsor`, `CsrmRequestStatus`), `CsrmRisk` (`riskOwner`, `treatmentOwner`, `riskCommunicationDate`), `CsrmControlImplementation` (`control` required, `controlStatus`, `controlOwner`, `evidence`, `implementationDueDate`), `IdamBoxUser` (`accountStatus`).
- `CONTEXT.md` (repository root): Released, Released for response, Risk owner, Executive approver, Submit final assessment, Accept and Treat, Withdrawn, Contest point and Closed. A plan adds "Response round" and "Participant".

### Contract, authorisation and records
- `docs/contract-gaps/phase-04-composite-release-fact.md` ("Requestor visibility and projections", amended here), `phase-06.8-questionnaire-governance-facts.md` (the release fact pattern and the "no enumeration value" precedent), `phase-06.1-revert-audit-facts.md` (format), and, once written, `phase-12-ai-run-record-and-provenance.md`, `phase-13-request-assignment.md`, `phase-13-request-notes.md`, `phase-16-risk-withdrawal-and-history.md` and `phase-19-exports-and-export-log.md` (each amended here).
- `docs/references/specification.json`: `AnalystAssessmentDetail`, `RequestorReleasedAssessmentDetail`, `AssessmentDetailGetResponse`, `AssessmentListResponse`, `RiskSummary`, `ControlImplementationListResponse`, `ActiveUserSummary`, `ActiveUserListResponse`, `AssessmentRequestLifecycleNextAction`, the review queue schemas and the conflict response schemas; the operations `search-active-users`, `get-risk-assessment`, `get-my-released-risk-assessments` and `get-my-risk-assessment-rating-summary`.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: `function.risk_assessment_requests.new_request` ("Search Users"), `function.risk_assessments.risk_assessment_details` ("Search Active Assessment Owners", held by the agent too), `function.risk_assessments.risk_assessment_details_read_only`, `function.risk_assessments.my_risk_assessments`, design notes 6 and 9; `function.questionnaire_generation.*` as the human-only pattern.
- `docs/references/served-operations.json`.
- `docs/adr/0002`, `0003` and `0004` (Keycloak; the fixture subjects and the realm import), `apps/backend/src/keycloak/development-fixture-subjects.ts`, `idp/keycloak/import/idambox-realm.json` and `apps/backend/tests/keycloak-identity.unit.test.ts` ("the fixture ids match the local realm import").
- `docs/security/phase-08-residual-risks.md`: R-08-13 (personal data in log lines), R-08-34 (route budgets), R-08-36 (process-local jobs).
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/helpers/strapi-http-harness.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/backend/tests/served-operations.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §4 AppShell (header), Status and risk badges, Forms, Dialogs, Toasts, Empty states, Record links, Skeletons, Print; §5 Motion; §6 Do-not list (9: no auto-refresh without a visible control).
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch; batch actions; revalidation) and `01-app/02-guides/lazy-loading.md` (`next/dynamic` from Client Components).

### External
- ISO/IEC 27005:2022 (risk owners; communication and consultation), ISO/IEC 27001:2022 clause 6.1.3 and Annex A 8.15 and 8.16 (logging and monitoring), the Three Lines Model (IIA, 2020).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts`: `withMutableAssessmentMutation` (serialisation, row lock, the guard, the edit transition), `assertMutableAssessment` (the guard Phase 16 D-22 names), `transitionForAcceptedEdit`, `projectReleaseReadiness` and `validateReleaseReadiness` (the readiness vocabulary that release-for-response readiness mirrors), `releaseAssessment` (v1's release, which gains the round refusal), `assessmentReleasePopulate`, `RISK_WRITABLE_FIELDS` (holds `riskOwner`).
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`: `releasedAssessmentQuery`, `releasedAssessmentDetailQuery` and `isReleasedAssessmentForOwner` (Phase 19 gathers them into its one predicate, which this phase widens), `buildAssessmentCollectionQuery`'s owner scope (the "My risk assessments" list), `projectReleasedAssessmentDetail`, `projectAnalystAssessmentDetail`, `parseActiveUserSearchQuery` (one key only today; a one-character term accepted) and `projectActiveUserSummary` (`documentId`, `displayName`).
- `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts`: `releasedForOwner` and the requestor branches of `getAssessment`, `listAssessmentRisks` and `listRiskControlImplementations`, which become the participant branches.
- `apps/backend/src/api/csrm-risk/services/risk-workflow.ts`: `resolveRelations` (active check for `riskOwner` and `treatmentOwner`, where D-16's predicate goes), `updateRisk`, `searchActiveUserDocuments` (active and `displayName $containsi`, limit 20; no service-identity filter today).
- `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts`: `createRiskControlImplementation` (the path an accepted proposal uses), `resolveReferences` (control required; owner active check).
- `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts`: `REQUEST_LIFECYCLE_STEPS`, `deriveRequestLifecycle` and `actionFor` (the step and next-action strings); `collection-scope.ts` (`selectReviewQueueBucket`, the oracle) and `review-queue-repository.ts` (`applyBucket`), which absorb the stage.
- `apps/backend/src/policies/csrm-authorization.ts`: `HUMAN_ANALYST_ONLY_OPERATIONS`, `loadEffectiveGrants` (the Requestor birthright for every identity), `requireAssessmentOwnerCollectionScope`, the `assessmentRequestActor` decision (an analyst calling a birthright-only operation acts as `requestor`, which is how analyst-participants respond).
- `apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts` (Maya's seeding, the persona pattern), `apps/backend/src/bootstrap/seed-csrm-data.ts` (Jane and Bob with `developmentFixtureSubject`), `apps/backend/src/keycloak/development-fixture-subjects.ts`.
- Planned modules from earlier phases: Phase 10's `conflict-reasons.ts` (both sides) and `refusal-copy.ts`; Phase 12's `apps/backend/src/csrm/ai/` (context builder, policy, prompt sections), `risk-scale.ts`, the run record and `ai-provenance.ts`; Phase 13's assignment service, `assertAssignedAnalyst`, notes and read state; Phase 16's guard, active-risk rule, risk history, proposal jobs and field-change mechanism; Phase 19's released-assessment predicate, security event log module and label vocabulary.
- Web: `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` and `apps/csrm/app/(app)/app/assessments/page.tsx` (the participant page and "My risk assessments"); `apps/csrm/src/features/assessments/released-assessment.tsx`, `assessment-service.ts` (`getReleasedAssessment` already parses both actor branches), `assessment-schema.ts`, `assessment-actions.ts`, `assessment-editor.tsx`, `risk-editor.tsx`, `owner-combobox.tsx` (the people picker's base); `apps/csrm/src/components/csrm/status-badge.tsx` (`statusPresentation`), `confirm-dialog.tsx`; `apps/csrm/src/components/shell/app-shell.tsx` (the header); `apps/csrm/src/config/navigation/navigation.ts`; `apps/csrm/src/lib/auth/development-session-adapter.ts`, `session-adapter.ts` and `apps/csrm/src/lib/capabilities/development-capabilities.ts` (the development personas); `apps/csrm/e2e/helpers/navigation.ts` (`signInAs`).

### Established Patterns
- Current fact plus a dedicated gate fact (06.8): gates read a server-owned fact directly, never a log; histories narrate.
- Human-analyst-only API Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`; birthright operations with record rules for first-line people; the service identity refused human acts explicitly (Phase 19 D-13).
- An unreadable record is 404; a policy denial is 403; denials keep persistence deep-equal; responses never echo fixture titles.
- Closed 409 reason codes with actor-neutral copy (Phase 10 D-22); closed payloads (`assertPayload`).
- Derived, published vocabularies for the lifecycle and the holder (06.8 D-01, Phase 11 D-27); the server words and links, the web formats.
- Model-friendly wire shapes, adapters that assign server-owned values, closed parsers as the gate; deterministic providers for every suite.
- Zod-free `*-domain.ts` modules for client components; typed openapi-fetch services and Server Actions that revalidate; batch Server Actions because Next dispatches them one at a time.

### Integration Points
- **Strapi:** the assessment, risk and control implementation routes, controllers and services; the request lifecycle, queue and assignment services; the notes service (for `note-added`); the questionnaire release and submit workflows (for their kinds); the AI context builder and run modules; `csrm-authorization.ts`; Phase 19's predicate and event log; the bootstrap seeds and both catalogue copies; a new notification API folder.
- **Web:** the participant page and list, the analyst assessment page and editor, both request pages (stepper and next action), both Homes, the navigation profile, the shell header, a Notifications page, the development sign-in.
- **Tests:** the authorisation matrix and harness (the seventh caller and the `risk-owner` identity), the integration suites, Vitest beside each module, and the two Playwright specs.
</code_context>

<specifics>
## Specific Ideas

- **The journey's first slice in words.** Jane raises a UAT-A-like request for a payroll SaaS. Bob picks it up, releases the questionnaire, and drafts the assessment after Jane answers. He confirms the AI's values, sets Jane as owner of every risk in one step, then names the risk owner persona (a finance operations manager, say) on the payroll-file integrity risk and the segregation-of-duties risk, the two the persona accepts and treats in 17.1. He releases for response with a short message. Jane and the persona each get a notification; the persona finds the assessment in "My risk assessments" marked "Risk owner · 2 risks" and "Released for response", reads all of it, and sees response controls only on their two risks. Jane proposes two mitigation controls on one risk, an existing reconciliation control with evidence and a planned file-signing control with a due date, naming a control owner she finds by typing two letters. Both submit; Bob is notified, closes round 1, accepts the file-signing control (mapping it to the library's integrity control) and rejects the other as already recorded, with a reason. "Reassess residual risk" proposes a lower residual likelihood citing the accepted control, and Bob confirms each unit. Maya gets the not-found page and the API's 404 at every step, and Bob is refused a response of his own.
- **The interim release.** Until 17.1 lands, v1's release stays: once every response item is decided and no round is open, Bob can release, and the persona then prints and exports the released assessment exactly as Jane can (success criterion 2's tail).
- **An analyst who owns a risk.** If Bob's own request (one he raised) goes to another analyst, Bob is its Requestor and may be named owner; he then responds from his own response panel on the analyst page, and every analyst control on that assessment is withheld from him with the reason.
- **Development database.** The schema changes, the persona, the grants and the notifications reach the operator's development database only when the orchestrator restarts Strapi; tests use their own databases. Existing assessments read as `not-shared` with no rounds, and released ones keep Jane's v1 read.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

## Seeds Confirmed or Corrected

The orchestrator's seeds, each checked against the code and the decisions:

- **Requirements, findings and asks:** confirmed. NOTIFY-01's list includes 17.1's events; G-18 (later) assigns those to 17.1, so this phase builds the centre and its own kinds (D-57).
- **The three contract-gap records before an approval checkpoint:** confirmed (`<contract_gaps>`). **Corrected:** 06.8's questionnaire release fact (`releasedAt`, `releasedBy`) is cleared by a return to analyst review (its record, "Write Discipline"), so the likeness is only that the gate reads a dedicated server-owned fact directly; Phase 17's fact is never cleared, and it is named for the read it opens because 17.1's first submission can write it too (D-11).
- **"Strapi refuses the assigned analyst (Phase 13's `assertAssignedAnalyst`)":** corrected. Refusing the assignee as a risk owner compares the nominee with the request's `assignedAnalyst` (D-17); `assertAssignedAnalyst` gates the caller of assigned-analyst-only steps, which here are opening and closing rounds (D-09, D-12).
- **Owner nomination, one step for all then per risk, inactive users and service identities refused, owners refused analyst mutations, changes through the risk history:** confirmed (D-16 to D-21). Today `resolveRelations` checks only `accountStatus`, and no code excludes the Security Analyst Agent role; D-16 adds one predicate.
- **The participant read as one predicate gated by the first-release fact, the one place Phase 19's check widens:** confirmed (D-22 to D-30). **Precision:** an analyst calling a participant-only operation gets 403 `NOT_A_PARTICIPANT`, not 404 (D-24), and a participant's export before release is 409, not 404 (D-29), each because a 404 would be untrue for someone who can read the record (Phase 19 D-15).
- **Participants read the request summary but not its questionnaire, notes or attachments:** confirmed; the summary travels inside the participant projection, and no request route widens (D-25, D-26).
- **"My risk assessments" with the person's part, print and export as the Requestor:** confirmed (D-28, D-29).
- **Responses in numbered rounds; control owners through the hardened search; the analyst accepts or rejects each with a reason:** confirmed, with the precisions of D-33 (ASSESS-12's evidence and due date read by status) and D-38 (acceptance maps to a library control, because a control implementation requires one; a reason is required to reject and to change a proposal).
- **The hardened search:** confirmed against the code. `parseActiveUserSearchQuery` already refuses other parameters and terms over 100 characters but accepts one character; `searchActiveUserDocuments` filters active users, limits to 20 and projects `documentId` and `displayName`, but returns service identities and logs nothing. The operation is granted to the Requestor ("Search Users"), the analyst and the service agent ("Search Active Assessment Owners"). **Added:** the service identity is refused as a caller (D-53).
- **"Reassess residual risk" through Phase 12's decision operation with a visible "Confirm":** confirmed (D-46 to D-51).
- **The notification centre, designed for 17.1, 17.2 and 20 to add kinds without a schema change, and email in Phase 20:** confirmed (D-56 to D-63). **Precision:** participants are told when a response waits; the assigned analyst when one arrives (G-18).
- **The editability guard:** confirmed; while a round is open the analyst's content edits are refused, between rounds everything is editable, and the acceptance-round lock is left to 17.1 (D-43 to D-45).
- **Development fixtures:** Maya (`maya.requestor@idambox.com`) already exists as the unrelated Requestor, with no Keycloak subject; no first-line risk owner persona exists; Phase 13 adds a second analyst persona. This phase adds the risk owner persona, with its Keycloak fixture subject and realm user changed together (D-67).
- **The post-demo journey:** confirmed; the first slice includes the analyst's pick-up and its negatives, and "the analyst cannot accept" is read, before 17.1 exists, as "the analyst cannot respond on a participant's behalf" (D-76).
- **Sizing:** the phase is beyond L as scoped (D-78); a split is proposed to the orchestrator.

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The discussion raised four shared-file changes. Each is settled as follows and binds the research, the UI-SPEC and the plans:

- **The notification centre moves to Phase 19.1 (G-19).** D-56 to D-63 are now Phase 19.1's to decide and build: the entity, its read state, the centre's UI, and the kinds that exist before Phase 17. This phase keeps D-57's `response-requested` and `response-submitted` kinds, emits them through Phase 19.1's notification service, and no longer writes `phase-17-notifications.md`. NOTIFY-01 moves to Phase 19.1. ROADMAP success criterion 5 ("each participant is told in the app when the response waits or arrives") stays here. Phase 17 is now sized L.
- **ROADMAP wording:** the Phase 17 entry now says it narrows "every risk and control mutation is analyst-only", rather than reversing it (D-04).
- **ASSESS-12 criterion 1** now reads: existing controls each with an owner found by name and its evidence, or planned controls each with an owner found by name and a due date (D-33).
- **D-25's readable fields** include the issue statement, cause, impact and the rating rationales, which Phase 17.1's deciders need (17.1-CONTEXT D-47).
- **Research questions settled (17-RESEARCH):** the response path is `.../my_response`, not `.../response_rounds/current/my_response`. Response drafts are a `draft` JSON attribute on `CsrmRoundResponse`, named in `phase-17-response-rounds.md` for approval, so response items are created only at submit. Participants keep today's Requestor read of a control implementation's evidence, implemented date and review date, so D-25 does not narrow v1. The journey's analyst step sets the residual ratings of the two risks it nominates to the different owner to Moderate and Low, so Phase 17.1's slice (accept the Moderate, treat the Low) does not depend on the deterministic draft's ratings.
- **The journey spec structure:** the journey spec `apps/csrm/e2e/risk-owner-journey.spec.ts` is one `@journey` test per width (desktop and mobile project), with each slice a function over a shared context object: Phase 17 creates it and the first slice, 17.1 adds its slice after `submitFinalAssessment`, 17.2 inserts the contest slice after `submitFinalAssessment`, and Phase 20 adds the final slice. The mobile project lists the spec.
- **The eligible-person predicate (D-16) comes from Phase 19.1** (19.1-CONTEXT D-07), which executes first. This phase reuses it and builds no second one.
- **Phase 11's Requestor Home:** the new `participants` holder changes the wording of Phase 11's "With the Security Analyst" section. The Phase 17 plan that adds the holder updates that section's copy and its tests. No shared file changes now.
---

*Phase: 17-mitigation-response-and-residual-reassessment*
*Context gathered: 2026-10-01*

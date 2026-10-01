# Phase 16: Risk curation and targeted AI re-runs - Research

**Researched:** 2026-10-01
**Domain:** Strapi 5 workflow services (soft withdrawal, append-only audit entity, assessment serialisation), AI proposal runs on Phase 12's foundations, Next.js 16 App Router editor surfaces
**Confidence:** HIGH for the code facts and placement (code read this session); MEDIUM for Phase 12, 13 and 15 seams (planned, not built); MEDIUM for the duplicate thresholds (to be tuned on fixtures)

<user_constraints>
## User Constraints (from 16-CONTEXT.md)

Copied verbatim from `16-CONTEXT.md` (`<decisions>` and `<deferred>`); only the heading levels are lowered by one. The `<operator_decisions>`, `<contract_gaps>`, `<authorization>` and `<seams>` sections of the CONTEXT bind as well and are not repeated here: the planner reads them in place.

### Locked Decisions

#### Scope and contract boundary

- **D-01:** The content-type changes are exactly two, both through `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, approved at a `checkpoint:decision` where the executor stops (G-6) before any schema file changes:
  1. **Withdrawal facts on `CsrmRisk`:** three optional attributes, `withdrawnAt` (datetime), `withdrawnBy` (many-to-one `IdamBoxUser`) and `withdrawalReason` (text), in the 06.1 and 06.8 audit-fact shape (D-05).
  2. **The risk history:** a new append-only content type, one row per change to a risk or one of its control implementations (D-18).

  Nothing else changes schema. The AI proposals live in Phase 12's `CsrmAiRun` and `aiProvenance` JSON attributes, whose envelopes this phase extends as dated amendments (D-03). **Reversibility:** one-way - a new table and three persisted columns; undoing them needs a data migration and loses audit records.
- **D-02:** Every new or changed endpoint follows the established chain (Phase 10 D-02, Phase 12 D-02): exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical; record-level checks in Strapi against the resolved IdamBox User (`ctx.state`), never branching on the auth mode; the operation or schema in `docs/references/specification.json`, then `api:generate` and a clean `api:check`; closed Zod parsers registered in the contract parity guard; a six-actor authorisation matrix row for every new route; `docs/references/served-operations.json` regenerated with the dev servers stopped. The server shape and the web parser change in the same plan (the 06.9 lesson).
- **D-03:** The API changes are these, and no others. Names are proposals; research fixes them within these families.
  1. **Withdraw:** `POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals`, body `{ riskIds (1 to 200), reason }` (D-09).
  2. **Reinstate:** `POST /api/v1/risk_assessments/{assessmentId}/risk_reinstatements`, same body (D-10).
  3. **Risk history read:** `GET /api/v1/risks/{riskId}/history`, paginated (D-21).
  4. **Suggest more risks:** `POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions`, body `{ instruction? }`, 202 with a job (D-30).
  5. **Rewrite this risk:** `POST /api/v1/risks/{riskId}/rewrite`, body `{ instruction?, focus? }`, 202 with a job (D-34).
  6. **Proposal job read and retry:** `GET /api/v1/risk_proposal_jobs/{jobId}` and `POST /api/v1/risk_proposal_jobs/{jobId}/retry` (D-26).
  7. **Proposals read:** `GET /api/v1/risk_assessments/{assessmentId}/ai_proposals`, the open and recently decided run-scoped proposals of one assessment (D-41).
  8. **Phase 12's decision operation** (`POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions`) gains run-scoped targets and the `reject` action, as its D-24 anticipated (D-39).
  9. **Reads that change shape:** the analyst assessment detail carries each risk's `withdrawal` block (null when active) and the open-proposal count; release readiness gains `aiProposalsDecided` (D-42); every risk read, list, count and figure applies the active-risk rule (D-13).
  10. **Closed conflict reasons** added to Phase 10's vocabulary (both conflict response schemas), for example `RISK_WITHDRAWN`, `RISK_NOT_WITHDRAWN`, `AI_PROPOSAL_STALE`, `AI_PROPOSAL_NOT_OPEN` and `AI_ACCEPT_NOT_PERMITTED`, reusing Phase 12's `ASSESSMENT_NOT_MUTABLE` and AI policy codes.
  11. **Catalogue:** new human-analyst-only API Functions (D-43); `regenerate_draft` and the generic core risk routes stay unserved with updated reasons (D-16, D-24).

  The AI envelope extensions (the run `operation` vocabulary, run-scoped proposal items and their decision events, per-field run references in a risk's `aiProvenance`, the assessment's open-proposal fact) are written as a dated amendment to `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` and summarised in the Phase 16 record, reviewed at the same checkpoint. **Reversibility:** costly - published operations, fields and error codes.
- **D-04:** Phase 04's draft-job contract is amended, not replaced. `docs/contract-gaps/phase-04-deterministic-draft-jobs.md` gains a dated note: an assessment linked to its draft may invoke the provider again, but only through the targeted proposal operations, which write proposals into a run and never replace the assessment or any risk. The draft job keeps every rule it has: single flight, "completed jobs are terminal", and restart discovery of a linked draft. This narrows the Phase 04 decision "Treat a linked draft on a risk-assessment-drafted request as restart discovery and never invoke the provider" (`.planning/milestones/v1.0-STATE.md`, Phase 04) to the draft job itself, as the ROADMAP entry says this phase does.

#### Withdrawal and reinstatement (ASSESS-09; UAT-027; decision 6)

- **D-05:** Withdrawal is a current fact on the risk, not a status. The risk is withdrawn exactly when `withdrawnAt` is set; `withdrawnBy` and `withdrawalReason` complete the fact. A status field is rejected because the JDL gives `CsrmRisk` no lifecycle status, and a competing one would collide with `closureDate` (Phase 20's closure) and `treatmentStatus`; reusing `closureDate` or `comments` is rejected because it overloads JDL terms (decision 6 keeps closure for released risks). The gates read this fact directly and never parse the history, following 06.8 ("an access-control decision must not depend on parsing a mutable JSON array").
- **D-06:** A withdrawal needs a reason: trimmed, 1 to 500 characters, through the same parser as revert reasons (`REVERT_REASON_MAX_LENGTH`). The withdrawn risk keeps its risk number, every field, its control implementations and its AI provenance, unchanged; numbers are never reused.
- **D-07:** A withdrawn risk is read-only. Strapi refuses, with `RISK_WITHDRAWN`, every mutation that targets it: `PATCH /api/v1/risks/{riskId}`, control implementation create, update and delete, Phase 12's AI proposal decisions on its fields or suggestions, and "Rewrite this risk". Reinstate it to change it. This keeps parked records from changing unseen and keeps their history meaningful.
- **D-08:** Who sees a withdrawn risk: only Security Analysts. The analyst editor shows it under a "Withdrawn" filter with its reason, who and when, its history and "Reinstate"; the Risk Register offers "Withdrawn" as an explicit filter value and excludes it from every default view. The Requestor, and from Phase 17 every participant (G-12: "every non-withdrawn risk"), never see a withdrawn risk or learn that one exists: their assessment, risk and control implementation reads exclude it, and a direct read of a withdrawn risk returns the refusal a missing record gets. A withdrawn risk is second-line working material, often an AI misfire, and is not part of what the assessment communicates (decision 6, G-12).
- **D-09:** Withdrawal is one batch operation per assessment: 1 to 200 risk ids and one reason, applied in one transaction under the assessment's serialisation, returning `{ applied, unchanged }` (a risk already withdrawn is unchanged, with no new history entry). The single "Withdraw risk" action sends one id. Phase 18's bulk withdrawal reuses this operation without a new contract (decision 7's table; ROADMAP Phase 18 "withdraw with exact grants"). A risk id that does not belong to the assessment fails the whole batch with 404 and leaves persistence deep-equal.
- **D-10:** A withdrawn risk can be reinstated while its assessment is editable, with a reason (same bounds), recorded in the history; the withdrawal facts are cleared and the history keeps both events (the 06.8 pattern: the current fact is cleared, the log keeps it). Reinstatement is the same batch shape as withdrawal. It exists because withdrawals are sometimes wrong, and new information (a note, D-28) can bring a risk back; recreating the risk by hand would split one risk into two records and lose its provenance. Reinstating a risk with an earlier acceptance decision is Phase 17.1's to rule on (seam S-6).
- **D-11:** Withdrawal and reinstatement are reversible, so neither uses a confirmation dialog (G-4). Withdrawing asks for the reason in a compact in-place form (a sheet on phones), applies optimistically, and shows an Undo toast. Undo reinstates with the fixed reason "Withdrawal undone", which the history shows as an undo. Reinstating likewise asks for a reason.
- **D-12:** Both are content edits. They run the accepted-edit transition (`transitionForAcceptedEdit`, 06.8 D-13), so a withdrawal after review withdraws the review today, and "Mark reviewed" from Phase 17.1 (decision 17: "Edits after review withdraw the review"). Withdrawing the last active risk is allowed, and release readiness then shows "At least one Risk" as outstanding.

#### The active-risk rule: where withdrawn risks drop out

- **D-13:** One active-risk rule, defined once in each form it is needed and used by every reader, so no surface counts a withdrawn risk. The forms:
  - **SQL:** beside `applyDisclosableParent` and Phase 11's stage predicates in `apps/backend/src/api/csrm-risk/services/risk-register.ts` (Phase 11 D-40 put the stage rule "once, beside that scope"), so the Risk Register, the dashboard summary, the alerts and the reports inherit it;
  - **document filters:** one exported filter fragment for every `strapi.documents("api::csrm-risk.csrm-risk")` read that lists or counts an assessment's risks;
  - **in memory:** one pure predicate used by release readiness, the overall-rating hint (D-15) and the proposal context (D-31).

  The readers that change: release readiness (`validateReleaseReadiness`, `projectReleaseReadiness` and the release path, which load risks through `assessmentReleasePopulate`); the analyst assessment detail (active risks plus withdrawn ones marked, D-08); `GET /api/v1/risk_assessments/{assessmentId}/risks` and the control implementation list for the Requestor; the Requestor's released assessment and `my_risk_assessments` reads; the assessment lists' risk count and highest residual rating (Phase 11 D-31 records "Phase 16's withdrawal will exclude withdrawn Risks later"); the Risk Register list and detail, exposure and its under-assessment and accepted figures (decision 11, Phase 11 D-40 to D-43); the dashboard; the alerts; the reports; the seeds' expectations. **Reversibility:** costly - every count and figure the product shows depends on it.
- **D-14:** Later phases read the same rule rather than restating it: Phase 17's nominated owners and its release-for-response gate (G-11: "the distinct `riskOwner`s of its non-withdrawn risks"), Phase 17's participant read (G-12), Phase 17.1's decisions, readiness and fingerprints (G-13: "every non-withdrawn risk has a valid decision"), Phase 18's table, Phase 19's exports (the export authorises through the same record-read predicate the read uses), Phase 20's registers and Phase 21's metrics.
- **D-15:** The overall rating is the analyst's conclusion and never changes on its own. When the active set changes (a withdrawal, a reinstatement, an added risk or an accepted residual rating), the editor shows, without blocking, that the overall rating no longer matches the highest residual rating of the active risks, and offers "Use {rating}". Phase 12 derives the overall rating this way at generation; Phase 18 may make the relation a rule with an override reason (ASSESS-18).

#### No hard delete (decision 6)

- **D-16:** No persisted risk is ever deleted, by any route or code path. Phase 04's "Expose no Risk delete service, action, input, or result" stands; decision 6 reaffirms it rather than reversing it as UAT-027 suggested. Proof:
  - no route serves DELETE for a risk: `DELETE /api/v1/risks/{riskId}` is not mounted, and the generic `DELETE /api/csrm-risks/{id}` stays unmounted (its `served-operations.json` entry stays under spec-only routes), each probed in the matrix with the same refusal for every actor;
  - a static guard test asserts that no Strapi source calls a delete on `api::csrm-risk.csrm-risk`, and that no cascade from a request or assessment deletion reaches a risk.

  The ROADMAP contract line's "risk withdraw and delete" therefore means withdrawal plus this proof, with no delete operation.
- **D-17:** An unsaved new risk is discarded, never persisted. The editor's "Add risk" form gains "Discard", which removes the unsaved form and offers an Undo toast that restores what was typed (client state only). Phase 10's navigation guard (D-12 there) warns before leaving with unsaved input in it. Nothing is written, so nothing is recorded.

#### Risk history (ASSESS-09 criterion 1; decisions 6 and 9; G-15)

- **D-18:** The risk history is a new append-only entity (proposed name `CsrmRiskHistoryEvent`; the contract-gap record fixes it), one row per change, each with: the assessment and the risk (relations, both set in this phase); the kind (a closed vocabulary in code and the contract, extended by later phases without a schema change, like `CsrmAiRun.operation`); the actor (`IdamBoxUser`) and the time; the source (analyst, an AI run with its run relation and proposal item, and later import or bulk with a batch id); the reason where the kind needs one; and the changes, a versioned JSON list of `{ field, from, to }` with relation values recorded as id plus the label at the time. Rows are never updated or deleted, and follow the assessment record's retention.
  - **Why an entity, not a JSON log on the risk:** the 06.8 log pattern grows every risk read, contends with Phase 18's batch edits and Phase 20's years of treatment updates, and leaves Phase 21 scanning JSON; Phase 12 rejected the same option for the run record for the same reasons.
  - **Why it is allowed:** the 06.1 and 06.8 records deferred "a cross-aggregate audit trail ... to a future domain-model decision" and forbade audit entities that compete with JDL ones. Decisions 6 and 9 and G-15 are that decision for risks, and the JDL has no history entity, so this competes with none (Phase 12's reasoning for `CsrmAiRun`). The catalogue's design note 6 already says audit history needs a model extension.
  - **Gates never read it.** It is narrative history; the gates read current facts (D-05; Phase 12 D-21).

  **Reversibility:** one-way - a new table holding audit records.
- **D-19:** From Phase 16 on, every change to a risk on the analyst paths is recorded, in the same transaction as the change:
  - `created`: by an analyst ("Add risk"), by draft generation (Phase 12's `persistAssessmentDraft`, source the draft run) or by accepting a suggested risk (source the suggestion run and item);
  - `updated`: every `PATCH` that changes values, and every accepted rewrite unit (source the rewrite run), each listing only the fields that changed with their old and new values; an update that changes nothing records nothing;
  - `withdrawn` and `reinstated`, with the reason;
  - `control-implementation-added`, `-updated` and `-removed`, naming the control by number and title, with the changed fields; a removal keeps the removed values, so the audit trail survives the existing hard delete of a control implementation.

  Phase 12's per-field acceptances and suggestion dismissals change no value; they stay in the run's decisions log, and the history view may show them beside the risk's events (the UI-SPEC decides). The history is complete for every change made from Phase 16 on; risks created earlier show "History recorded from {date}", as Phase 12 notes that per-field tracking began later.
- **D-20:** Recording every change now, not only withdrawals, is deliberate. A history that showed an AI rewrite but not the manual edit after it would mislead the third line, and later phases depend on it: Phase 17's ASSESS-21 criterion 1 ("the risk's history records each change with who and when", for owner nominations, which go through the same update path), Phase 17.2's before-and-after view for deciders (G-15), Phase 18's ASSESS-16 criterion 4 (old and new values) and Phase 20's RISK-04 criterion 2. Each of those phases adds its own event kinds and sources to this store through its own contract-gap amendment, with no new history entity (seam S-9).
- **D-21:** One read, `GET /api/v1/risks/{riskId}/history`, human Security Analyst only in this phase, paginated newest first, with the record-level check through the risk's assessment (an unknown risk is 404, with no enumeration). It serves the withdrawn risk's history too. Participant access to history is Phases 17 and 17.2's to decide (G-12, G-15).

#### The editable guard (ASSESS-24 seam)

- **D-22:** One server-side guard decides whether an assessment can be changed by this actor now. It is the one exported predicate behind `withMutableAssessmentMutation` (today `assertMutableAssessment`: not released, status `draft` or `in-review`, no release facts), and every Phase 16 entry point passes it:
  - withdraw and reinstate, inside the mutation transaction;
  - enqueue of both AI operations, as a read-only check before a job is queued;
  - job execution, re-checked before the provider is called, so a run never starts on an assessment that stopped being editable;
  - run completion, which records the proposals as lapsed instead of open when the assessment stopped being editable while the job ran (D-40);
  - every proposal decision, accept and reject alike.

  It takes the actor as well as the assessment, so Phase 17 adds G-11's rule (a nominated risk owner is refused every analyst mutation of that assessment) and Phase 17.1 adds ASSESS-24's lock (every analyst edit refused while an acceptance round is open) in one place, and every Phase 16 mutation inherits both without change. Refusals carry a closed reason (`ASSESSMENT_NOT_MUTABLE` today; 17.1 may add its own). **Reversibility:** costly - every mutation path routes through it.
- **D-23:** The guard is separate from the edit transition. Changes to the assessment's content or to a field's review state apply the accepted-edit transition (withdraw, reinstate, adding a suggested risk, accepting a rewrite unit, restoring an accepted unit). Rejecting a proposal, and writing a run's completion, change no content: they take the assessment's serialisation and the guard but not the edit transition, so they never withdraw a review. Phase 12 D-24 runs every decision through the edit transition, including dismissing a suggested control; the plan that extends the decision operation aligns that dismissal with this rule, with a test, because both close a proposal without changing the record.

#### Targeted AI re-runs: shared foundations (ASSESS-10; UAT-028)

- **D-24:** Two targeted operations replace any notion of regenerating the draft: "Suggest more risks" for the assessment, and "Rewrite this risk" for one risk. Neither replaces or deletes anything: each writes proposals into its run, and nothing reaches the assessment until an analyst accepts it. Whole-draft regeneration is not offered, because it would discard curation, mirroring decision 4's rule for questionnaires; the catalogue's `regenerate_draft` intent stays unserved, its `served-operations.json` reason updated to name these operations.
- **D-25:** Both build on Phase 12, adding no parallel machinery:
  - **Context:** Phase 12's assessment context builder (D-04 to D-08 there), with the same data minimisation and three-slot prompt; this phase adds operation-specific blocks (D-31, D-35).
  - **Policy:** the AI data policy (G-3; Phase 12 D-26 to D-29) is checked at enqueue (a 409 with the policy reason, before a job is queued) and again at execution (the job fails with the same code, and nothing is sent).
  - **Run record:** one `CsrmAiRun` per provider call, `operation` `risk-suggestions` or `risk-rewrite` (names fixed by research), with the assessment and, for a rewrite, the risk relation set, the instruction, the context summary, the proposal, its decisions, and failures (Phase 12 D-19, D-20; interrupted at restart).
  - **Wire and parser:** each proposed risk uses Phase 12's draft risk wire shape (schemaVersion 2), adapter and context-aware closed parser, inside the strict structured-output subset (Phase 12 D-06, D-15); ratings stay derived by `apps/backend/src/csrm/risk-scale.ts` (Phase 12 D-10).
  - **Provenance:** an accepted value carries per-field provenance (Phase 12 D-21), now naming the run that proposed each field, because one risk can hold fields from a draft and a rewrite (D-03's envelope amendment).
- **D-26:** The jobs follow the existing registry pattern: in-process (R-08-36), single flight per target (one suggestion job per assessment, one rewrite job per risk; a second request returns the active job), queued, running, completed or failed, with a read and a retry. Who may read and retry follows Phase 13's rule for generation jobs (REQ-08 criterion 3: any Security Analyst who may read the request reads its jobs). The proposals themselves are durable in the run, so a restart loses only an in-flight job, whose run is marked interrupted (Phase 12 D-20). The editor shows progress with the existing job-panel pattern (Phase 10 D-26; poll, then "Check again").
- **D-27:** Both operations take an optional analyst instruction: trusted but bounded, in its own slot, logged in the run, and never carrying Requestor text (decision 5; Phase 12 D-05). The bounds and validator are Phase 15's (its instruction slot for questionnaire proposals, QUES-11 criterion 4); Phase 16 reuses them from the shared AI module, and if Phase 15's plans place the validator elsewhere, the plan moves it to `apps/backend/src/csrm/ai/` so Phase 17 reuses it too. The instruction cannot loosen a server rule: the adapter enforces the Accept rule, the allowed values and the bounds whatever it says.
- **D-28:** New information reaches re-runs. Both operations' contexts include the request's notes as Phase 13 defines them (COLLAB-01 criterion 3; Phase 13 success criterion 5: notes marked "changes the AI inputs", which "Phases 12, 15 and 16 read") and the attachment text the analyst opted in (Phase 14, COLLAB-02 criterion 5), through Phase 12's D-08 extension points, inside the untrusted data block, listed in the run's context summary. The editor tells the analyst, server-derived, when such a note or file arrived after the latest completed AI run on the assessment ("New information since the last AI run"), and offers "Suggest more risks" and per-risk "Rewrite". Phase 13 and Phase 14 are treated as planned inputs; if either lands differently, the plan adapts the extension point, not this behaviour.
- **D-29:** Released risks cannot be re-run: both enqueue routes refuse a released (or otherwise not editable) assessment with `ASSESSMENT_NOT_MUTABLE`, a rewrite of a withdrawn risk with `RISK_WITHDRAWN`, and both offer no control in those states.

#### Suggest more risks (ASSESS-10 criterion 1; success criterion 2)

- **D-30:** "Suggest more risks" is offered on any editable assessment, from the Identified Risks section of the editor, with an optional instruction (for example "risks about payment files"). It returns at most a bounded number of proposed risks per run (proposed: 8), each a complete draft risk in Phase 12's shape: statement fields with citations, uncited claims, system and asset pre-filled from the request's own records, classification from the asset, likelihood and consequence on the 5 × 5 scales with derived ratings, treatment action and plan under the Accept rule (D-38), and suggested controls from the bounded candidate set (Phase 12 D-12).
- **D-31:** The context tells the model what already exists, so it proposes only what is missing:
  - the assessment's active risks (short keys, Risk Type, statement and cause capped, system and asset), marked "already in the assessment";
  - withdrawn risks with their reasons, marked "withdrawn by the analyst; do not propose again unless the new information changes the reason";
  - suggestions rejected on earlier runs for this assessment, with their reasons, and suggestions still open, marked "do not repeat".

  Each entry goes in the data block as data (it may restate Requestor facts), with short keys and no risk numbers, owner names or dates (G-3 minimisation). The lists are bounded (proposed: 200 entries in all), and an assessment over the bound fails the job with `CONTEXT_TOO_LARGE` before any provider call (06.7 D-10: no silent truncation).
- **D-32:** Duplicates are handled in two tiers, server-side and deterministically, reusing Phase 12's lexical ranker (`library-ranking.ts`) as the similarity scorer, with no dependency:
  - **Near-identical** to an active risk, a withdrawn risk, a rejected or open suggestion, or another proposal in the same run (same Risk Type and a very high statement similarity): removed by the adapter and recorded as an adjustment in the run, and the panel says how many were left out and why (in the style of Phase 12 D-14's dropped sources).
  - **Similar** below that threshold: kept, and flagged "Similar to {risk number}" (or "to a withdrawn risk" or "to a rejected suggestion") with a side-by-side comparison and a one-click "Reject as duplicate" that records the reason.

  Thresholds are research's, unit-tested on fixed fixtures. Dropping only what is clearly a repeat and flagging judgement calls keeps the list honest without hiding the model's output.
- **D-33:** Accepting a suggestion ("Add to assessment") creates the risk through the existing create path, in one transaction with its `created` history entry (D-19) and the decision event. The risk arrives exactly as a drafted risk does: its AI-written values marked "AI proposed" with their citations, uncited claims and suggested controls, reviewed per field in the risk card with Phase 12's "Accept" and "Accept remaining", and gated by Phase 12's "AI proposals reviewed" readiness requirement. One mental model serves both: AI values on the record carry markers until a person accepts or edits them (Phase 12 D-21; INT-06). The new risk has no owner, dates or controls until the analyst sets them, as today. "Add to assessment" has no Undo toast (it creates a persisted record); the toast offers "Open risk", and a wrong addition is withdrawn (D-05).

#### Rewrite this risk (ASSESS-10 criterion 2; success criterion 3)

- **D-34:** "Rewrite this risk" is offered on every active risk of an editable assessment, with an optional instruction and an optional focus (statement and cause, ratings, treatment; default all). It proposes new values for the AI-writable fields only, Phase 12's twenty: Risk Type, the statement fields, category and subcategory, cause, impact, system and asset (from the request's own), classification (from the asset), inherent and residual likelihood and consequence with derived ratings and their rationales, treatment action and plan. Owners, dates, statuses, exemption, escalation, comments, control effectiveness and velocity are first- and second-line facts that the AI never proposes. The proposal mechanism (base value, proposed value, per-unit decision, stale detection) is built generically, so Phase 17's "Reassess residual risk" (ASSESS-13: "the analyst accepts proposals per field") adds an operation, not a mechanism (seam S-11).
- **D-35:** The rewrite context holds the target risk's current values and its control implementations (control number, title and status) as data, the assessment's other active risk statements (so a rewrite does not turn it into a duplicate), the request context (D-25) and the instruction. The model returns one complete risk in the draft risk shape; the adapter computes the diff against the values captured when the context was built and keeps only fields that change.
- **D-36:** The diff is per field, except where one value derives from another, which form one unit accepted or rejected together, so the risk never holds an inconsistent combination:
  - inherent likelihood, consequence and the derived rating; residual likelihood, consequence and the derived rating (decision 8);
  - the impacted asset and the classification taken from it (Phase 12 D-13);
  - a treatment action change to Accept and its rationale in the plan (Phase 12 D-11).

  Each unit carries its base value, its proposed value, its citations (statement units) and its uncited flags. A text unit shows changed words marked by more than colour. "Accept all" and "Reject remaining" sit beside per-unit Accept and Reject.
- **D-37:** Stale units are never applied. Each unit records the base value it was proposed against; accepting checks, inside the transaction, that the risk still holds that value, and otherwise refuses with `AI_PROPOSAL_STALE` and leaves persistence deep-equal. The panel shows a stale unit as "Changed since proposed" with the current value, offering Reject or a fresh rewrite. A newer rewrite of the same risk supersedes the older open proposal (D-40), and the start dialog says so.
- **D-38:** The Accept rule holds end to end (decision 8: "the AI may propose 'Accept' only for Low or Moderate residual risk, and only with a rationale"). In both operations the adapter turns an AI Accept into Treat, recording the adjustment, when the resulting residual rating is High or Critical, when the rationale is missing, or when the target risk has a planned control implementation (G-14: Accept "is offered only for a risk with no planned control implementation, because the residual rating counts planned controls"). At acceptance the server refuses an AI-proposed Accept unit with `AI_ACCEPT_NOT_PERMITTED` if the risk's residual rating, after the units accepted in the same batch, is High or Critical. The rule reads Phase 12's `acceptProposalAllowed` in `risk-scale.ts`, the one configuration point Phase 22 takes over. An accepted AI Accept stays the analyst's recommendation, which the owner's decision replaces in Phase 17.1 (G-14).

#### Proposal decisions and lifecycle (decision 6)

- **D-39:** Every AI proposal ends in a human decision. Phase 12's decision operation gains run-scoped targets, a proposed risk of a suggestion run and a unit of a rewrite run, each named by run id and item key, with the run checked against the assessment in the path. Its actions for these targets: `accept` (adds the risk, or applies the unit), `reject` (with an optional reason, 500 characters at most; decision 6's word) and `restore` (returns a rejected item to open, and an accepted unit to its base value and open, only while the risk still holds the accepted value; this is what G-4's Undo toasts call). Batches stay within Phase 12's 200 items, so "Accept all" and "Reject remaining" are one Server Action. Repeating an applied decision is a no-op; deciding an item that is no longer open is refused with `AI_PROPOSAL_NOT_OPEN`.
- **D-40:** Item states: `open`, `accepted`, `rejected`, `superseded` (a newer rewrite of the same risk replaced it, or the risk was withdrawn while it was open; recorded with the human act that caused it) and `lapsed` (the assessment stopped being editable before the proposal could be decided, for example released while the job ran). Superseded and lapsed items are closed, never silently open, and cite their cause. A newer "Suggest more risks" run does not supersede open suggestions: they stay open beside the new ones, and the new run's context lists them (D-31), so nothing the analyst has not decided is lost.
- **D-41:** Proposals are durable in the run (`proposal` holds the items; `decisions` is the append-only history, Phase 12 D-19). The current open-item count per assessment is a current fact the gate reads without parsing history: proposed as an amendment to the assessment's `aiProvenance` envelope, written in the same transaction as run completion and each decision (the 06.8 and Phase 12 D-21 split: current fact plus append-only log). The proposals read (D-03 item 7) returns open proposals and the recently decided ones, bounded, with run facts (operation, initiating analyst, time, provider, instruction) and per-item state, decider, time and reason; the editor loads it on demand.
- **D-42:** Release readiness gains "AI proposals decided" at assessment scope, outstanding while any proposal item of the assessment is open, with a destination that opens the proposals panel. Decision 6's basis is "record what the AI proposed and what a person decided", and an AI-proposed risk left undecided would leave risk identification incomplete, with no person's decision on record. "Reject remaining" clears it in one step. From Phase 17.1, "Submit final assessment" inherits it (G-13: "every other release-readiness condition is met"). Phase 12's undecided suggested controls keep their rule and do not block (Phase 12 research, open question 1): they refine a reviewed risk, while a proposed risk is an identification decision.

#### Roles and grants (G-1, G-3; Phase 12 D-32)

- **D-43:** Every Phase 16 operation is human Security Analyst only: new API-only Functions granted to `role.security_analyst` alone (the `function.questionnaire_generation.*` pattern; for example `function.risk_curation.*` and `function.risk_ai_proposals.*`), plus `HUMAN_ANALYST_ONLY_OPERATIONS` as the second refusal, so a later catalogue edit cannot reach automation. AI generation is human-initiated so every run names an accountable analyst (G-3), and withdrawing, reinstating and deciding are human judgements (decision 6: "what a person decided"). Phase 12's extended decision operation keeps its existing human-only Function.
- **D-44:** The analyst service agent keeps its existing risk create and update grants (their future is Phase 22's role review, Phase 12 D-33), but cannot set withdrawal facts (they are not writable fields, so a closed payload with them is a 400), cannot edit a withdrawn risk (D-07), and reaches no Phase 16 operation. Every analyst on the request may withdraw, reinstate, re-run and decide: editing is not exclusive (decision 10), and Phase 13's assignee does not narrow it.

#### Interface

- **D-45:** Surfaces:
  - **Assessment editor, Identified Risks:** a filter between active and withdrawn risks, each with its count; "Suggest more risks"; the proposals panel (open suggestions with "Add to assessment" and "Reject", similarity flags, decided items below); the "New information since the last AI run" notice (D-28); the overall-rating hint (D-15); and "Discard" on an unsaved new risk (D-17).
  - **Each active risk card:** "Withdraw risk", "Rewrite this risk" and "History" in its actions; an open rewrite shows its diff with per-unit Accept and Reject.
  - **Each withdrawn risk card:** collapsed and read-only, with the "Withdrawn" tag, its reason, who and when, "Reinstate" and "History".
  - **Release readiness:** "AI proposals decided"; withdrawn risks contribute no items.
  - **Risk Register:** the "Withdrawn" filter value; a withdrawn risk's register detail is read-only with its withdrawal facts and a link to its assessment; "History" opens from there too.
  - **Released assessment (analyst):** the withdrawn filter stays readable; no withdraw, reinstate, rewrite or suggest control anywhere.
  - **Requestor surfaces:** unchanged apart from the exclusions (D-08).

  These components are built for reuse by Phase 18's table (the withdraw form, the history sheet, the diff, the proposals panel).
- **D-46:** Values come only from `docs/design/csrm-design-direction.md`. The UI-SPEC reuses the recorded extensions: Phase 10's X-1 (save status), X-3 (dates and times), X-4 (separators) and X-5 (in-place edit form), Phase 11's X-10 (figure links), Phase 12's AI provenance marker and citation chip, the questionnaire revision timeline's presentation for the history, and the one status mapping (`statusPresentation`) for the "Withdrawn" tag, as a new value in that extensible mapping with a neutral tone, icon and text (never colour alone; G-13's seam keeps the mapping one place). It proposes new extensions only for the field comparison (before and after; Phase 17's residual reassessment and Phase 17.2's before-and-after view reuse it) and the withdrawn record treatment, numbered from the first free X-n the orchestrator gives.
- **D-47:** The premium bar (G-4):
  - a keyboard path for every action: withdraw and reinstate from the card's actions, reason entry with Enter to submit, the filter as a segmented control, the proposals panel and the diff in reading order with per-unit Accept and Reject reachable without a mouse;
  - optimistic feedback that rolls back on error for withdraw, reinstate, reject and unit accept;
  - Undo toasts for withdraw (D-11), reject and unit accept (`restore`, D-39), and discard (D-17); no confirmation dialog, because nothing here is irreversible or governance-significant;
  - skeletons for the proposals panel and the history sheet, and the job states while a run works;
  - empty states that say what to do next ("No AI proposals yet" with "Suggest more risks"; "No withdrawn risks"; a cleared "No open AI proposals");
  - no lost input: the reason, the instruction and an unsaved risk survive errors and navigation;
  - comfortable and compact density for the proposals list and the history;
  - motion from the direction, honouring reduced motion;
  - phone layouts: the withdraw form, the history and the proposals panel as sheets, the diff as stacked cards (current above proposed) per unit;
  - every figure opens its records: the filter counts, the readiness item and the open-proposal count.
- **D-48:** The assessment editor route is close to its JavaScript budget (R-08-34; 269,653 of 300,000 bytes at the Phase 8 baseline, before Phases 10 and 12 add to it). So the proposals panel, the diff, the history sheet and the withdraw form load on demand with `next/dynamic` from a Client Component, static parts render on the server, client pieces stay zod-free (08-13), and `performance.spec.ts` stays green, or a recorded exception gives its reason.
- **D-49:** Copy follows the direction's voice (Australian English, sentence case, verb-first actions). The terms are "Withdraw risk", "Withdrawn", "Reinstate risk", "Suggest more risks", "Rewrite this risk", "Add to assessment", "Accept", "Reject", "Reject remaining" and "History"; never "Delete", "Remove" or "Not applicable" for a withdrawal. Exact strings are the UI-SPEC's. A plan adds "Withdrawn (Risk)" to the root `CONTEXT.md` glossary.

#### Verification and plan shape

- **D-50:** How the phase is proved:
  - **Each behaviour** gets a failing test first at its seam: the pure active-risk predicate, readiness and the overall-rating hint; the history diff and its event envelope; the duplicate scorer and thresholds; the diff units and stale detection; the Accept rule; the open-item fact.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test, one database per file) for every new grant and every refusal (see `<authorization>`), plus: the active-risk rule across readiness, the assessment lists' counts, the Risk Register, the dashboard, alerts and reports, and every Requestor read; history rows per path in the mutation's transaction; the lifecycle of both jobs and their runs; decisions, idempotence, stale, superseded and lapsed items; the readiness gate; the static no-delete guard.
  - **Provider tests** send model-facing wire JSON through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` (the 06.7 lesson) and inspect the captured prompt (existing risks, withdrawn and rejected lists, notes, instruction slot, escaping, the schema subset).
  - **Deterministic providers** for both operations: on a UAT-A-like context, "Suggest more risks" proposes the payment-file integrity risk (with no Risk Type where none fits, Phase 12 D-09) and never repeats an existing, withdrawn or rejected risk; fixtures also exercise one near-identical drop, one similarity flag, an Accept for a Moderate residual rating and an Accept downgrade. "Rewrite this risk" proposes text units with citations, one rating unit, one uncited unit, and omits unchanged fields.
  - **Web units** (Vitest): closed parsers (nullable withdrawal and proposal fields), the zod-free domain modules, every component and its refusal states (no control for released or withdrawn records; the 409 reasons mapped to copy), the Undo and rollback paths, the parity and chain guards.
  - **Playwright:** a new spec with its own records (the 06.9 lesson), at 375px and 1440px with axe: a UAT-A-like request through questionnaire and draft; withdraw a risk with a reason and see it leave readiness and appear under "Withdrawn" with its reason and history; Undo, then withdraw again and reinstate; "Suggest more risks" proposes the payment-file risk with no duplicate, add it and accept its fields; "Rewrite this risk", accept one unit and reject another; readiness waits for every proposal to be decided; release; then no withdraw, rewrite or suggest control remains and the API refuses each; the Requestor's released view excludes the withdrawn risk; an unrelated Requestor is refused. Specs that change deliberately are named in their plans (for example `assessment-release-workflow.spec.ts` if readiness copy shifts). A Playwright run leaves the tree clean (Phase 8 D-12, G-6). Phase 16 adds no slice to `risk-owner-journey.spec.ts`, which Phase 17 creates.
  - **The live model check** (a UAT-A "Suggest more risks" on the hosted provider) is manual and the operator's; every suite pins the deterministic provider and the empty classification ceiling (Phase 12 D-31).
- **D-51:** Plans are serialised by shared files, one owner per file per wave: the specification and generated client; both catalogue copies and `served-operations.json`; the authorisation matrix and the parity and chain guards; the Strapi hot files (`assessment-workflow.ts`, `assessment-scope.ts`, the assessment controller, `risk-workflow.ts`, `control-implementation-workflow.ts`, `risk-register.ts`, the insight repositories, `csrm-authorization.ts`, `conflict-reasons.ts`, the AI provenance and run modules); the web hot files (`assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `assessment-editor.tsx`, `risk-editor.tsx`, `released-assessment.tsx`, the risk register modules, `status-badge.tsx`). Dev servers are stopped for any plan that edits Strapi or runs Playwright.
- **D-52:** Wave order: the contract-gap record and its approval checkpoint first, with pure modules alongside (the active-risk predicate, the history diff, the duplicate scorer, the diff units); then the schema change; then the guard and withdrawal with history and the active-risk rule across every reader; then the AI operations (context, providers, jobs, runs), then decisions and readiness; then the UI; then the E2E spec and the full gate (`api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`), with the 375px and 1440px checks. The size is at the top of M: the planner keeps each plan within its estimate and reports if the set needs more than the usual count.

### Claude's Discretion (the CONTEXT's "Planner's Discretion")

- Names of operations, Functions, reason codes, run operations, item kinds and history kinds, within the families above.
- Module placement, for example `apps/backend/src/api/csrm-risk/services/risk-curation.ts` and `risk-history.ts`, `apps/backend/src/csrm/ai/risk-proposals/`, and web `apps/csrm/src/features/risk-curation/` beside Phase 12's `features/ai-assistance/`.
- Exact bounds within the proposed values (proposals per run, context entries, units, history page size, stored value sizes), and the duplicate thresholds.
- Where the open-item fact lives (the assessment's `aiProvenance` amendment is recommended; an equivalent current fact the gate reads directly is acceptable).
- The deterministic providers' rules and wording, within D-50.
- Whether withdraw and reinstate share a plan with the history, and how the AI plans split, provided shared files are serialised.
- Copy, layout and visuals: the UI-SPEC's.

### Deferred Ideas (OUT OF SCOPE)

- **Closing released risks through the register with a reason:** Phase 20 (decision 6, decision 9; the catalogue's unserved `close` intent).
- **Bulk withdrawal and bulk edits in the risk table, with history batch sources:** Phase 18, on D-09 and D-18.
- **Residual reassessment from responses:** Phase 17, on the field-change proposal mechanism (D-34).
- **Participant access to risk history, and the assessment-wide history view:** Phases 17 and 17.2 (G-12, G-15).
- **Soft removal of control implementations:** not requested; their removal stays a hard delete, now recorded in the risk history (D-19). A later phase may extend decision 6 to them.
- **A notification when AI proposals are ready:** not in decision 18's event list; Phase 17's notification centre could add it.
- **Withdrawal reason categories** for reporting: Phase 21 may add them if "AI assistance health" needs more than the AI provenance of withdrawn risks.
- **Merging a duplicate into another risk:** a new capability, not planned.
- **Per-cell AI markers and diffs in the risk table:** Phase 18.
- **Whole-draft regeneration:** not offered (D-24).
- **Local model evaluation for these operations:** backlog 999.1; the portable schema subset keeps it open.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSESS-09 | A Security Analyst can withdraw an unreleased risk with a reason. (1) A withdrawn risk leaves the assessment, release readiness and counts, and the history keeps it with reason, actor and time; (2) no persisted risk is ever hard-deleted: an unsaved row is discarded, and a rejected AI proposal is recorded as rejected in the run record; (3) Strapi refuses to withdraw a released risk | "The editable guard and the serialisation split"; "Withdrawal and reinstatement"; "The active-risk rule: the complete reader inventory"; "The risk history entity"; "No hard delete: the proof"; Pitfalls 1 to 7 |
| ASSESS-10 | A Security Analyst can re-run the AI for one risk or to propose additional risks. (1) "Suggest more risks" proposes risks that do not duplicate existing ones, each accepted or rejected on its own; (2) "Rewrite this risk" proposes field changes as a diff accepted per field; (3) each run is recorded with instruction, analyst, time and provider, and released risks cannot be re-run | "AI proposals: runs, envelopes and item states"; "The proposal jobs"; "Contexts"; "Duplicates"; "Rewrite units and stale detection"; "The decision operation, extended"; Pitfalls 8 to 16 |
</phase_requirements>

## Summary

Phase 16 is mostly a **cross-cutting server change wearing a small UI**. The two content-type changes (three withdrawal attributes on `CsrmRisk` and one append-only history entity) are simple. The work, and the risk, is in three places the CONTEXT names but the code makes harder than it looks:

1. **The mutation wrapper cannot be nested, and it couples the guard to the edit transition.** `withMutableAssessmentMutation` serialises on an in-process per-assessment promise queue, opens a transaction, locks the row, runs `assertMutableAssessment`, computes `transitionForAcceptedEdit` and always writes the transition [VERIFIED: apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:381-396, 430-481]. A decision batch that calls today's `updateRisk` or `createAssessmentRisk` from inside it would wait on its own queue entry and hang. Phase 16 therefore needs (a) one exported guard taking the actor, (b) a wrapper variant without the edit transition (rejections, run completion, D-23), and (c) transaction-scoped inner functions for create, update and control-implementation changes that both the HTTP paths and the decision batch call.
2. **The active-risk rule has more readers than the CONTEXT lists.** Besides the readers in D-13, the request relationship projection counts the assessment's risks by residual rating and counts their control implementations through `assessmentReleasePopulate` [VERIFIED: apps/backend/src/api/csrm-assessment-request/services/relationship-scope.ts:30-34, 57-77], and the Requestor reaches it. Every reader must take the rule from one module, and a static guard should find any new `csrm_risks` reader that skips it.
3. **The draft job registry cannot be copied as is.** Its single flight returns any retained job for the target, terminal or not, for up to an hour [VERIFIED: assessment-draft-registry.ts:177-183], which is correct for a one-shot draft and wrong for re-runs that analysts repeat.

The AI half reuses Phase 12 entirely (context builder, policy, run record, provenance, decision operation) and adds two run operations, run-scoped proposal items with a current state per item, an open-item count on the assessment as the gate fact, a deterministic duplicate scorer, and a generic field-unit diff with stale detection that Phase 17 reuses.

**Primary recommendation:** Plan the contract-gap record and its checkpoint first, with the pure modules (active-risk predicate, history change diff, reason parser, duplicate scorer, field units) beside it. Then the schema. Then the guard and serialisation refactor with history writes on every existing path. Then withdraw and reinstate with the active-risk rule across every reader. Then the AI operations, decisions and readiness. Then the UI, then a new E2E spec and the full gate. Settle the four copy and vocabulary conflicts in "Open Questions" before the UI-SPEC is written.

## Project Constraints (from AGENTS.md and the Stage 2 rules)

- Strapi is the production API boundary: the web calls Strapi only through `apps/csrm/src/lib/api` from server code and Server Actions; no frontend facade, no raw `fetch` in pages.
- Keycloak authenticates; Strapi enforces Role → Function → FunctionAPI plus record-level checks against the resolved IdamBox User in `ctx.state`, never branching on the auth mode. Navigation visibility is not authorisation.
- AI output is advisory: no AI path accepts, decides, closes or releases anything. Every Phase 16 proposal ends in a human decision.
- JDL terminology; document model gaps in `docs/contract-gaps/` rather than inventing competing entities. Every content-type change starts with its record and a `checkpoint:decision` where the executor stops (G-6).
- Semantic tokens only, shadcn/ui first, strict TypeScript, Server Components by default, zod-free client modules, no business logic in JSX, responsive and accessible; every UI value from `docs/design/csrm-design-direction.md`, anything new as a recorded X-n extension.
- Tests with every material workflow: Strapi integration for every grant and refusal, Vitest for logic and refusal states, Playwright for the flows; a Playwright run leaves the tree clean.
- No new dependency without a concrete reason. This research recommends none.
- Dev mode only: never start Keycloak or flip the four auth switches; new settings go to `.example` files with safe defaults.
- Paths: `apps/backend` and `apps/csrm` only.
- Plans are written ahead against today's code plus the planned outputs of Phases 10 to 15, and name the earlier plans they rely on.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Withdraw and reinstate (batch, reason, guard, transition) | API / Backend (Strapi workflow service) | Browser (optimistic UI, Undo) | Record-level checks, serialisation and audit belong in Strapi |
| The active-risk rule | API / Backend (one module, three forms) | Frontend Server (filters the analyst's view only for presentation) | Counts, gates and Requestor exclusion must be server-enforced |
| Risk history (write and read) | Database / Storage (new append-only entity) | API / Backend (writers in each mutation transaction; analyst read) | Durable audit (decisions 6 and 9, G-15) |
| The editable guard | API / Backend | — | Phases 17 and 17.1 extend it; authorisation-adjacent |
| Suggest and rewrite jobs, contexts, adapters, dedupe, diff units | API / Backend (`apps/backend/src/csrm/ai/risk-proposals/`) | — | Provider boundary, data minimisation and the Accept rule are server-owned |
| Proposal item state and the open-item count | Database / Storage (run envelope, assessment `aiProvenance`) | API / Backend | Current fact plus append-only log (06.8 split) |
| Decisions (accept, reject, restore) | API / Backend (assessment serialisation) | Browser (optimistic, rollback, Undo) | Stale checks and the Accept rule must run inside the transaction |
| Word-level text diff for display | Browser / Frontend Server (pure zod-free module) | — | Presentation of base versus proposed values the server already sent |
| Overall-rating hint | Frontend Server (pure domain function over the served active risks) | — | Advisory only; never writes (D-15) |

## Standard Stack

### Core (all installed; nothing is added)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@strapi/strapi` | 5.51.0 | Content types, document service, transactions, custom routes and policies | The API boundary [VERIFIED: apps/backend/package.json] |
| `openai` | 7.15.0 | The OpenAI-compatible client behind Phase 12's providers | Unchanged [VERIFIED: apps/backend/package.json] |
| `next` | 16.3.6 | Server Components, Server Actions, `next/dynamic` | Project framework [VERIFIED: apps/csrm/package.json] |
| `zod` | ^4.4.3 | Closed response parsers on the web | Parity guard pattern [VERIFIED: apps/csrm/package.json] |
| `openapi-fetch` / `openapi-typescript` | as installed | Typed client and `api:generate` / `api:check` | The contract chain [VERIFIED: apps/csrm/package.json scripts `api:generate`, `api:check`] |
| shadcn/ui `sheet`, `popover`, `sonner`, `tabs` | in `apps/csrm/src/components/ui/` | History sheet, phone sheets, Undo toasts | Already present [VERIFIED: directory listing of `apps/csrm/src/components/ui`] |
| `SegmentedControl`, `StatusBadge` (`statusPresentation`), `ConfirmDialog` | `apps/csrm/src/components/csrm/` | Active/Withdrawn filter, "Withdrawn" tag, reason fields | Existing primitives [VERIFIED: `segmented-control.tsx`, `status-badge.tsx:116` `export const statusPresentation`] |

### Supporting (tests)

| Tool | Version | Use |
|------|---------|-----|
| `node:test` + `tsc -p tests/tsconfig.json` | — | Strapi unit and mounted integration, one database per file |
| `apps/backend/tests/helpers/fake-openai-compatible-server.ts` | — | Model-facing wire tests for both operations (the 06.7 lesson) |
| vitest | 4.1.11 | Web units [VERIFIED: apps/csrm/package.json] |
| @playwright/test | 1.58.2 | E2E at 1440 (`desktop`) and 375 (`mobile`, `@journey` tests only) [VERIFIED: apps/csrm/playwright.config.ts:184-195] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A hand-written word-level diff (bounded LCS, about 60 lines, zod-free) | The npm `diff` (jsdiff) package [ASSUMED name; not verified this session] | A dependency for one bounded display function; AGENTS forbids a dependency without concrete need. Revisit only if the diff must handle very long texts beyond the cap |
| A token-set similarity scorer on Phase 12's tokeniser | An embedding model or a fuzzy-search library | Non-deterministic or a dependency; D-32 requires a deterministic server-side scorer with no dependency |
| A new history entity | A JSON log on `CsrmRisk` | Rejected by D-18 (read growth, contention with Phase 18 and 20, Phase 21 scans) |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: Phase 16 installs no package in either workspace. If a plan later finds a genuine need (for example a diff library), it runs the Package Legitimacy Gate then and gates the install behind a `checkpoint:human-verify` task.

## What today's code does (verified this session)

| Fact | Evidence | Consequence for Phase 16 |
|------|----------|--------------------------|
| The editable predicate takes only the assessment: `export function assertMutableAssessment(value: unknown): void {` … `const hasReleaseFact = value.assessmentStatus === "approved" \|\| value.approvedBy != null \|\| value.approvalDate != null;` … `if (hasReleaseFact \|\| (value.assessmentStatus !== "draft" && value.assessmentStatus !== "in-review")) {` | [VERIFIED: assessment-workflow.ts:128-134] | D-22's guard adds an actor parameter; today's error is `AssessmentWorkflowError(409, "CSRM assessment is not mutable.")`, to which Phase 12 adds the reason `ASSESSMENT_NOT_MUTABLE` |
| The wrapper always applies the edit transition: it calls `transitionForAcceptedEdit({ … releaseReady: validateReleaseReadiness(assessment).ready }, input.analystDocumentId)` before `mutate`, then writes `assessmentStatus` and `reviewedBy`, and the request status when the assessment was `draft` | [VERIFIED: assessment-workflow.ts:459-478] | Rejections and run completion need a variant without the transition (D-23) |
| Serialisation is an in-process promise queue per assessment: `const previous = queues.get(documentId) ?? Promise.resolve();` … `await previous;` | [VERIFIED: assessment-workflow.ts:381-396] | Calling a wrapped function from inside the wrapper for the same assessment never resolves (Pitfall 1) |
| `createAssessmentRisk`, `updateRisk` and the three control-implementation mutations each open their own `withMutableAssessmentMutation` | [VERIFIED: risk-workflow.ts:168-225; control-implementation-workflow.ts:171-249] | Extract transaction-scoped inner functions for the decision batch |
| Readiness and the pre-edit transition read `assessment.risks` loaded through `assessmentReleasePopulate`, which has no filter: `risks: { populate: { riskOwner: true, treatmentOwner: true, controlImplementations: { populate: { control: true } } } }` | [VERIFIED: assessment-workflow.ts:409-421, 317-354] | Apply the in-memory active predicate inside `validateReleaseReadiness` and `projectReleaseReadiness` |
| The analyst detail computes readiness from every loaded risk: `releaseReadiness: projectReleaseReadiness({ ...document, risks })` | [VERIFIED: controllers/csrm-assessment.ts:174-180] | The detail keeps withdrawn risks (marked) but readiness must not see them |
| `listAssessmentRisks` and `listRiskControlImplementations` serve both actors with unfiltered queries: `.findMany({ filters: { assessment: { documentId: { $eq: documentId } } }, sort: ["riskNumber:asc"], limit: 1_000 })` | [VERIFIED: controllers/csrm-assessment.ts:254-290] | Exclude withdrawn risks; a Requestor's read of a withdrawn risk's implementations is 404 |
| The request relationship projection counts risks and control implementations from `assessment: { populate: assessmentReleasePopulate }` | [VERIFIED: relationship-scope.ts:30-34, 57-77] | A reader D-13 does not list; it must apply the in-memory predicate |
| The SQL readers share `applyDisclosableParent` (parent mutable or fully released), and the register filters open and closed by `r.closure_date` | [VERIFIED: risk-register.ts:137-164; risk-register-query.ts:7 `export const RISK_REGISTER_STATES = ["open", "closed"] as const;`] | Add a sibling `applyActiveRisk` rather than folding it into `applyDisclosableParent`, because the register's "Withdrawn" filter must still reach withdrawn rows |
| The dashboard, alerts and reports call `applyDisclosableParent(...)` plus `closure_date IS NULL` | [VERIFIED: grep this session: dashboard-summary.ts:149, alert-repository.ts:235 and 248, report-repository.ts:163 and 171] | Each gains the active rule |
| The register detail projects `parentLock: "mutable" \| "released"` and the spec closes it: `{"type":"string","enum":["mutable","released"]}` | [VERIFIED: risk-register.ts:113-120; specification.json `RiskDetail.parentLock` printed this session] | Add a separate `withdrawal` block; do not widen `parentLock` |
| The risk update payload is closed: `assertPayload(input, RISK_WRITABLE_FIELDS)` | [VERIFIED: assessment-workflow.ts:87-91, 561-563] | A body carrying withdrawal facts is already a 400 (D-44); a test proves it |
| The revert reason parser requires a one-key body: `if (!isRecord(body) \|\| Object.keys(body).length !== 1 \|\| typeof body.reason !== "string") {` with `export const REVERT_REASON_MAX_LENGTH = 500;` | [VERIFIED: revert-reason.ts:1, 9-17] | Withdrawal bodies carry `riskIds` too: extract a `parseReasonText(value)` helper beside it and reuse the constant |
| The draft registry's single flight returns any retained job, terminal or not: `const existingId = jobsByQuestionnaire.get(input.questionnaireId); if (existingId) { const existing = jobs.get(existingId); if (existing) { … return publicRecord(existing); } }` | [VERIFIED: assessment-draft-registry.ts:177-183] | The proposal registry must return an existing job only while it is queued or running (Pitfall 8) |
| The human-only set lists the release, five governance URLs and the insights; the denial message falls back to questionnaire wording | [VERIFIED: csrm-authorization.ts:41-49, 64-65] | Add the Phase 16 operations and a message branch for them |
| `regenerate_draft` is catalogued and unserved: `"catalogueUrl": "POST:/api/v1/risk_assessments/{assessmentId}/regenerate_draft"`, `"function.risk_assessments.risk_assessment_details.api.05"` | [VERIFIED: docs/references/served-operations.json:2230-2234] | Update its `reason` to name the Phase 16 operations (D-24) |
| The risk content type is `csrm_risks`, `draftAndPublish: false` | [VERIFIED: csrm-risk/schema.json:1-14] | `withdrawnAt` becomes column `withdrawn_at` [ASSUMED: Strapi's snake-case column naming, consistent with `closure_date` used in the SQL readers] |
| The human Security Analyst holds `function.risk_assessment_requests.delete_api` | [VERIFIED: catalogue role grants printed this session with `node -e`] | D-16's "no cascade reaches a risk" needs a mounted proof that deleting a request with an assessment leaves its risk rows (Pitfall 6) |
| The glossary already holds "Withdrawn (Risk)" | [VERIFIED: root CONTEXT.md:33-35] | D-49's glossary task is already done; a plan only checks the entry still matches |
| Error details are closed: `"details":{"type":"object","additionalProperties":false}` | [VERIFIED: specification.json `AssessmentWorkflowErrorResponse` printed this session] | Phase 10 plan 10-06 adds `reason`; Phase 16 only extends the vocabulary |

## The editable guard and the serialisation split (D-22, D-23)

Recommended shape, in `assessment-workflow.ts` (a hot file; one plan owns it per wave):

- `assertAssessmentEditable({ assessment, actor })`: the one exported predicate. Today it wraps `assertMutableAssessment(assessment)` and ignores `actor` except for its validity; Phase 17 adds G-11's owner rule and Phase 17.1 the acceptance-round lock here. It throws `AssessmentWorkflowError(409, …)` carrying the closed reason (`ASSESSMENT_NOT_MUTABLE` from Phase 12's vocabulary).
- `withAssessmentMutation({ strapi, assessmentDocumentId, actor, transition: "accepted-edit" | "none", mutate })`: the serialise → transaction → lock → load (release populate) → guard → mutate → (transition) sequence. `withMutableAssessmentMutation` becomes a thin alias with `transition: "accepted-edit"`, so existing callers and tests keep working.
- Transaction-scoped inner functions, called only from inside the wrapper: `createRiskInMutation`, `updateRiskInMutation` (computes the history `updated` entry and Phase 12's `edited` marking), `createControlImplementationInMutation`, `updateControlImplementationInMutation`, `removeControlImplementationInMutation`. The HTTP-facing `createAssessmentRisk`, `updateRisk` and the control-implementation functions become wrapper plus inner call. Each inner function also runs the withdrawn-risk guard (D-07), so every path (assessment editor, Risk Register detail, Phase 12 decisions, Phase 16 decisions) inherits it.
- **Where each entry point runs:**

  | Entry point | Wrapper | Transition |
  |---|---|---|
  | Withdraw, reinstate (D-12) | `withAssessmentMutation` | `accepted-edit` |
  | Accept a suggested risk, accept or restore an accepted rewrite unit | `withAssessmentMutation` | `accepted-edit` |
  | Reject, restore a rejected item, Phase 12's dismiss and restore-dismissed | `withAssessmentMutation` | `none` |
  | Run completion (write proposal, item states, open count; supersede older rewrite items) | `withAssessmentMutation` with the actor = the run's initiating analyst | `none`; if the guard refuses, the run completes with items `lapsed` outside the guard (D-40) |
  | Enqueue (both operations) | none: a read-only load plus `assertAssessmentEditable` before queueing | — |
  | Job execution, before the provider call | none: the same read-only check; a refusal fails the job with `ASSESSMENT_NOT_MUTABLE` and creates no run | — |

- **Phase 12 alignment:** the 2026-10-01 Orchestrator Confirmation in `12-CONTEXT.md` already rules that dismissing and restoring a dismissed suggestion take the guard but not the transition. If Phase 12's plans implement a no-transition variant first, Phase 16 reuses it and only adds the `actor` parameter; the plan says which plan created it.
- **Release-readiness input to the transition** (`releaseReady: validateReleaseReadiness(assessment).ready`) must read active risks only; because the in-memory predicate is applied inside `validateReleaseReadiness`, this follows automatically.

## Withdrawal and reinstatement (D-05 to D-12)

- **Body:** `{ riskIds: string[] (1 to 200, unique, each a non-empty documentId of 255 or fewer characters), reason: string }`, closed. The reason goes through the extracted `parseReasonText` (trim, 1 to `REVERT_REASON_MAX_LENGTH` = 500). Duplicate ids are a 400, not silently merged.
- **Algorithm (one transaction, `transition: "accepted-edit"`):**
  1. Load the risks by `documentId $in riskIds` with their assessment relation, inside the transaction. If the count differs or any risk's assessment is not the path's assessment, throw 404 for the whole batch (persistence deep-equal; no enumeration of which id failed).
  2. Partition: already withdrawn → `unchanged`; active → `applied`. For reinstatement, the reverse; reinstating only active risks is `RISK_NOT_WITHDRAWN` when **every** id is active (a mixed batch reports the active ones as `unchanged`, mirroring withdrawal) [ASSUMED: the CONTEXT names `RISK_NOT_WITHDRAWN` for "reinstating an active risk" without saying whether a mixed batch fails; the recommendation keeps both operations symmetric, and the planner may choose the stricter rule].
  3. If `applied` is empty, return `{ applied: [], unchanged }` without the transition write [ASSUMED: an all-unchanged batch is a no-op and should not withdraw a review; the wrapper today writes the transition unconditionally, so the inner function returns early and the wrapper skips the write when the mutate result says nothing changed].
  4. For each applied risk: write `withdrawnAt` (server clock), `withdrawnBy` (actor), `withdrawalReason` (or clear all three for reinstatement), append a history row (`withdrawn` or `reinstated`, with the reason and, for Undo, a `cause: "undo"` marker when the reason is the fixed "Withdrawal undone"), and supersede any open rewrite items for that risk (D-40) with their decision events, decrementing the open-item count.
- **Undo** (D-11) calls reinstatement with the fixed reason. Recommend a closed body flag `{ undo: true }` instead of a magic reason string, with the server writing the reason "Withdrawal undone" so the history shows an undo unambiguously [ASSUMED: the CONTEXT fixes the reason text, not the mechanism].
- **Withdrawing the last active risk** is allowed; readiness then shows "At least one Risk" outstanding (D-12).

## The active-risk rule: the complete reader inventory (D-13, D-14)

One module, recommended `apps/backend/src/csrm/active-risk.ts`, exporting three forms:

| Form | Export | Used by |
|------|--------|---------|
| In memory | `isActiveRisk(risk): boolean` (true when `withdrawnAt` is null or absent) and `activeRisks(risks)` | `validateReleaseReadiness`, `projectReleaseReadiness`, the transition's pre-edit readiness, `relationship-scope.ts` (`residualRiskCounts`, `controlImplementationCount`), Phase 12's "AI proposals reviewed" readiness, the proposal contexts, the web's overall-rating hint (a mirror in the zod-free domain module) |
| Document filter | `ACTIVE_RISK_FILTER = { withdrawnAt: { $null: true } }` | `listAssessmentRisks`, the Requestor's control-implementation read (load the risk and 404 when withdrawn), Phase 11's assessment-list aggregate if it uses the document service, any later `strapi.documents("api::csrm-risk.csrm-risk").findMany` that lists or counts an assessment's risks |
| SQL | `applyActiveRisk(query)` adding `r.withdrawn_at IS NULL`, exported from `risk-register.ts` beside `applyDisclosableParent`, plus a convenience `applyContextualRisk(query)` = disclosable parent + active | The Risk Register list (default) and its "Withdrawn" filter value (inverse), the dashboard summary, the three alert queries, the report queries, Phase 11's stage predicates and the assessment-list aggregate if it is SQL |

The complete list of readers that change, from the CONTEXT plus this session's code read:

| Reader | File | Today | Phase 16 |
|--------|------|-------|----------|
| Release readiness and the release path | `assessment-workflow.ts` | All loaded risks | In-memory predicate inside both readiness functions |
| Pre-edit transition readiness | `assessment-workflow.ts` | All loaded risks | Inherits the above |
| Analyst assessment detail | `controllers/csrm-assessment.ts`, `assessment-scope.ts` | All risks, readiness over all | All risks with a `withdrawal` block (null when active), readiness over active only, `openAiProposals` count |
| Assessment risk list (both actors) | `controllers/csrm-assessment.ts:254-270` | All | Active only |
| Control implementations of a risk | `controllers/csrm-assessment.ts:272-290` | Any risk | Requestor: 404 for a withdrawn risk; analyst: allowed (read-only history) |
| Request relationship counts (both actors) | `relationship-scope.ts:57-77` | All | Active only (**not in D-13's list**) |
| `my_risk_assessments` list and rating summary | `controllers/csrm-assessment.ts:232-253` | Assessment fields only today; Phase 11 adds counts | Phase 11's counts active only |
| Analyst assessment list counts and highest residual (Phase 11 D-31) | Phase 11's aggregate | Planned, all risks | Active only |
| Risk Register list and filters | `risk-register.ts`, `risk-register-query.ts` | Disclosable parent; `state` open or closed | Default excludes withdrawn; a closed new filter value selects withdrawn only |
| Risk Register detail | `risk-register.ts:187-220` | `parentLock` | Adds `withdrawal`; read-only in the UI when set; the PATCH path refuses with `RISK_WITHDRAWN` |
| Dashboard, alerts, reports, exposure figures | `dashboard-summary.ts`, `alert-repository.ts`, `report-repository.ts` | Disclosable parent + open | + active |
| Seeds' expectations | `seed-analyst-insights.ts`, `seed-risk-register-workflow.ts` and their integration tests | — | Unchanged data; tests prove a withdrawn risk drops out |

**Static guard (recommended):** a Strapi unit test that greps `apps/backend/src` for `from("csrm_risks as r")` and `"api::csrm-risk.csrm-risk"` `findMany` calls and fails when a file is not on an allow-list of files that apply the rule or are proven exempt (the withdrawal service itself, the history read, the register's "Withdrawn" branch). This turns D-14's "later phases read the same rule" into a failing test rather than a reminder.

**Register filter vocabulary:** keep `state` (`open`, `closed`) as is and add a separate closed parameter, for example `withdrawal` with values `active` (default when absent) and `withdrawn`, so Phase 11's and Phase 19's filter plumbing extend rather than reinterpret `state` [ASSUMED: name and values are the planner's; the shape avoids mixing closure and withdrawal in one enum].

## The risk history entity (D-18 to D-21)

Proposed content type for the contract-gap record (`apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json`), collection `csrm_risk_history_events`, `draftAndPublish: false`:

| Attribute | Strapi type | Notes |
|-----------|-------------|-------|
| `kind` | string (64), required | Closed vocabulary in code and contract: `created`, `updated`, `withdrawn`, `reinstated`, `control-implementation-added`, `control-implementation-updated`, `control-implementation-removed`; later phases add kinds by amendment |
| `occurredAt` | datetime, required | Server clock, same transaction as the change |
| `actor` | manyToOne `api::idambox-user.idambox-user` (unidirectional) | The human analyst |
| `assessment` | manyToOne `api::csrm-assessment.csrm-assessment` (unidirectional) | Set in this phase |
| `risk` | manyToOne `api::csrm-risk.csrm-risk` (unidirectional) | Set in this phase |
| `sourceKind` | string (32), required | `analyst`, `ai-run`; later `import`, `bulk`, `response` |
| `aiRun` | manyToOne `api::csrm-ai-run.csrm-ai-run` (unidirectional), optional | Phase 12's run |
| `proposalItem` | string (128), optional | The run's item key |
| `batchId` | string (64), optional | Reserved for Phase 18 |
| `reason` | text, optional | Withdrawal and reinstatement |
| `changes` | json | Versioned envelope `{ schemaVersion: 1, fields: [{ field, from, to }] }`; relation values as `{ documentId, label }` captured at the time; control-implementation kinds add `{ control: { documentId, controlNumber, name } }` |

- **Unidirectional relations are essential.** An `inversedBy` on `CsrmRisk` or `CsrmAssessment` would add attributes to those schemas, break D-01's "exactly two changes" (the freeze check lists exactly `csrm-risk/schema.json` and the new type's schema) and make every risk populate risk pulling history rows [ASSUMED: Strapi 5 creates a link table for a unidirectional manyToOne without touching the target schema, as the existing unidirectional `riskOwner` relation on `CsrmRisk` does; verified only by analogy with `csrm-risk/schema.json`'s `riskOwner` relation, which has no `inversedBy`].
- **Route exposure:** the content type's core router mounts nothing (`only: []`, as for other CSRM types), so the generic `/api/csrm-risk-history-events` routes appear in `served-operations.json` under spec-only routes with the standard reason.
- **Writer:** one service, `apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts`, with `recordRiskHistory(strapi, entry)` called only from the inner mutation functions and `persistAssessmentDraft`, inside their transactions. A pure `riskChanges(before, after, fields)` in `apps/backend/src/csrm/risk-history-changes.ts` computes the `fields` list after the same trimming `parseWritableRiskFields` applies; an empty list means no row (D-19: "an update that changes nothing records nothing").
- **Bounds:** each `from` and `to` text value is stored whole (risk text fields are the record's own values; truncation would falsify the audit) [ASSUMED: the CONTEXT leaves "stored value sizes" to the planner; whole values are recommended because the history is the audit trail and the risk's own fields are already bounded by the web form]; the envelope is validated by a closed parser on read, and a malformed row projects with `changes: null` rather than failing the read (the 06.8 posture).
- **Read:** `GET /api/v1/risks/{riskId}/history?page=&pageSize=` (page size 25 default, 100 maximum), newest first, actors resolved through one batched user lookup (the 08 D-31 pattern), human analyst only; the record-level check resolves the risk's assessment and applies `assertAnalystAssessmentScope`. An unknown risk is 404. Older risks show "History recorded from {date}"; the read returns `recordedFrom` (the phase's deployment date is not knowable in code, so use the earliest event's `occurredAt`, or null with no events) [ASSUMED: the UI-SPEC fixes the copy].
- **Gates never read it** (D-18).

## No hard delete: the proof (D-16, D-17)

- **Routes:** no `DELETE` on `/api/v1/risks/{riskId}` (the risk router mounts GET and PATCH only [VERIFIED: apps/backend/src/api/csrm-risk/operations.ts:1-10]); the generic `/api/csrm-risks/{id}` routes stay under spec-only routes in `served-operations.json`. Matrix rows probe both with the same refusal for all six actors.
- **Static guard:** a unit test that scans `apps/backend/src` for `.delete(` and `deleteMany` on `api::csrm-risk.csrm-risk` (and on the new history type) and fails on any hit. Today's only document `.delete(` calls are the control-implementation delete and the questionnaire regeneration's question delete [VERIFIED: grep this session].
- **Cascade:** the human analyst can DELETE an assessment request through the core route (the analyst role holds `delete_api`; the Requestor is refused [CITED: apps/backend/tests/fixtures/authorization-matrix.ts:224, "mounted DELETE denies an owning Requestor before an exact-grant analyst removes the record"]). Strapi 5 removes relation link rows rather than cascading deletes to related documents [ASSUMED], so risks survive, but nothing proves it. Add a mounted test: delete a request whose assessment has risks and assert every risk row and history row is still present. Whether a request with an assessment should be deletable at all is outside this phase (see Open Questions).

## AI proposals: runs, envelopes and item states (D-24 to D-26, D-39 to D-41)

### Run operations
`CsrmAiRun.operation` gains `risk-suggestions` and `risk-rewrite` (the closed vocabulary Phase 12 owns in code and the contract). A rewrite run sets the `risk` relation; both set the assessment and the request.

### Proposal envelope v2 (amendment to the Phase 12 record)
Keep the AI's output immutable and put the human state beside it:

```text
proposal: {
  schemaVersion: 2,
  operation: "risk-suggestions" | "risk-rewrite",
  items: [ ... immutable proposed content, keyed "s-1"… or "u-statement"… ],
  adjustments: [ { kind: "near-duplicate-dropped" | "accept-downgraded" | "sources-dropped" | …, item?, detail } ],
  itemStates: { "<itemKey>": { state: "open"|"accepted"|"rejected"|"superseded"|"lapsed",
                               by?, at?, reason?, cause?: { kind: "newer-rewrite"|"risk-withdrawn"|"assessment-not-editable", runId?, riskId? },
                               createdRisk?: documentId } }
}
```
[ASSUMED: field names are proposals for the contract-gap record; the structure follows D-41's "current fact plus append-only log"]

- `itemStates` is the current fact read by the decision path (`AI_PROPOSAL_ALREADY_DECIDED` or the CONTEXT's `AI_PROPOSAL_NOT_OPEN`, see Open Questions) and by the proposals read; `decisions` stays the append-only narrative (Phase 12 D-19). Both are written in the same transaction under the assessment's serialisation. No gate parses `decisions`.
- **Suggestion items** hold one draft risk each in Phase 12's internal risk shape (schemaVersion 2) plus `similarTo: { kind: "active"|"withdrawn"|"rejected"|"open", riskId?, runId?, itemKey?, score } | null`.
- **Rewrite items** are units: `{ key, fields: string[], base: Record<field, value>, proposed: Record<field, value>, sources?, uncited? }`.

### The open-item fact
Add to the assessment's `aiProvenance` envelope (amendment): `openProposals: { count: number, byRun: Record<runId, number> }`, written in the same transaction as run completion and every decision, supersession and lapse. Release readiness's new `aiProposalsDecided` reads `count === 0` directly. `byRun` lets a plan recompute and assert consistency in tests without parsing logs [ASSUMED: the CONTEXT allows "an equivalent current fact the gate reads directly"; this keeps it on the existing JSON attribute with no schema change].

Pre-Phase 12 assessments have a null `aiProvenance`: treat null as `count: 0`, and the first run completion creates the envelope (Phase 12 Pitfall 11).

### The proposal jobs (D-26)
A new registry, `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-registry.ts`, modelled on `assessment-draft-registry.ts` with three differences:
1. **Target key**: `suggestions:{assessmentId}` or `rewrite:{riskId}`.
2. **Single flight only while active**: return the existing job when it is `queued` or `running`; otherwise create a new job (Pitfall 8).
3. **Reads follow Phase 10 D-47 and REQ-08 criterion 3**: any human Security Analyst who may read the request reads its jobs; `canRetry` is true for the initiating analyst (Phase 10 D-25's rule). Retry of a failed job creates a new run (Phase 12 D-20).

Job shape mirrors the draft job (`jobId`, `operation`, `assessmentId`, `riskId?`, `attempt`, `queuedAt`, `startedAt?`, `completedAt?`, `runId?`, `failureCode?`, `failureMessage?`, `status`, `canRetry`), as a new closed schema family in the spec. Failure codes stay free strings in the job schema, as the draft job's are.

### Contexts (D-25, D-27, D-28, D-31, D-35)
Both operations call Phase 12's `buildAssessmentContext` and add operation blocks inside `<referenceData>` (data, never instructions):

| Block | Suggest more risks | Rewrite this risk |
|-------|--------------------|-------------------|
| `existingRisks` | Active risks: short key, Risk Type, statement and cause (capped, for example 600 characters each), system and asset short keys; marked "already in the assessment" | The assessment's other active risk statements, marked "do not turn this risk into one of these" |
| `withdrawnRisks` | Withdrawn risks with their reasons, marked "withdrawn by the analyst; do not propose again unless the new information changes the reason" | — |
| `decidedSuggestions` | Rejected suggestions (with reasons) and open suggestions from earlier runs, marked "do not repeat" | — |
| `targetRisk` | — | The risk's current values for the AI-writable fields and its control implementations (number, title, status) |
| Request context, notes (Phase 13), opted-in attachment text (Phase 14) | Phase 12's builder through its D-08 extension points | Same |
| Instruction | `<analystInstruction>` slot (Phase 12 D-05) | Same, plus the focus as a closed list rendered by code |

- **Bounds:** at most 200 entries across `existingRisks`, `withdrawnRisks` and `decidedSuggestions`; over the bound the job fails with `CONTEXT_TOO_LARGE` before any run is created (06.7 D-10). Phase 12's character budget applies to the whole prompt.
- **No risk numbers, owners or dates** in the context (G-3 minimisation); short keys (`existing-1`, `withdrawn-1`, `rejected-1`) are mapped back by the adapter.
- **Instruction validator (D-27):** reuse Phase 15's. Phase 15 is not discussed yet; if its plans do not exist when Phase 16 is planned, define `parseAnalystInstruction` in `apps/backend/src/csrm/ai/analyst-instruction.ts` (trimmed; empty means null; 1 to 2,000 characters; no control characters other than newline and tab) and record that Phase 15 adopts it [ASSUMED: the bounds; Phase 15 owns them].
- **Rewrite focus:** a closed array of `statement`, `ratings`, `treatment`; absent means all. The adapter drops units outside the focus and records the adjustment.

### Wire shapes and adapters (D-25, D-30, D-34 to D-38)
- **Suggestions wire:** `{ schemaVersion: [2], risks: [ <Phase 12 draft risk wire object> ] }` inside the portable subset (no `maxItems`; the adapter caps at 8 and records `over-limit-dropped`). Ratings, ids and classification stay out of the wire (Phase 12 D-10, D-13).
- **Rewrite wire:** one risk object of the same shape, plus nothing else.
- **Suggestion adapter steps:** Phase 12's draft adapter steps 1 to 6 and 8 per risk, then: (a) score each proposed risk against the existing, withdrawn, decided and same-run sets; (b) drop near-identicals with an adjustment; (c) attach `similarTo` to similar ones; (d) apply the Accept rule (residual High or Critical, missing rationale → Treat); (e) assign `s-1`… keys in output order.
- **Rewrite adapter steps:** map, derive and parse as for one draft risk; apply the Accept rule including G-14's "no planned control implementation" condition using the target's current controls; diff against the base values captured at context time; group into units; drop unchanged units; drop units outside the focus.

### Duplicates (D-32)
- **Tokeniser:** reuse Phase 12's `library-ranking.ts` tokeniser (lowercase words of three or more letters, stop list). If 12-03 does not export it, the Phase 16 plan exports it without changing its behaviour.
- **Score:** Jaccard similarity of the token sets of `riskStatement + " " + riskCause` (pure, deterministic, symmetric, no IDF corpus needed) [ASSUMED: Jaccard is recommended over the ranker's IDF score because duplicate detection is pairwise and symmetric; the ranker scores documents against one query].
- **Thresholds** (starting values, fixed by fixture tests): near-identical when the Risk Types match (both null counts as a match) and the score is at least 0.8; similar when the score is at least 0.5 regardless of type [ASSUMED: values to tune; the CONTEXT assigns thresholds to research, and the fixtures below pin them].
- **Fixtures:** a verbatim restatement (score 1.0, dropped); a reworded restatement of UAT-A's offshore admin access risk (flagged similar); the payment-file integrity risk against UAT-A's three drafted risks (below 0.5, kept, no flag); a near-identical against a withdrawn risk and against a rejected suggestion (both dropped with the right cause).

### Rewrite units and stale detection (D-36, D-37)
- **Units:** `riskType`; `issueStatement`; `riskStatement`; `riskCategory`; `riskSubCategory`; `riskCause`; `potentialImpact`; `informationSystemImpacted`; `informationAssetImpacted` + `dataClassification`; `inherentLikelihood` + `highestInherentConsequence` + `inherentRating`; `inherentRatingRationale`; `residualLikelihood` + `highestResidualConsequence` + `residualRating`; `residualRatingRationale`; `treatmentAction` + `treatmentPlan` when the action changes to Accept; otherwise `treatmentAction` and `treatmentPlan` separately. The field names are the twenty AI-writable fields Phase 12 lists, which are the frozen schema's [CITED: 12-RESEARCH.md "Envelopes"].
- **Base values** are normalised the way the update path stores them (strings trimmed, relations as documentIds, null for absent), so "unchanged" and "stale" compare like with like.
- **Accept a unit:** inside the transaction, reload the risk, compare every field of the unit with `base`; any difference → `AI_PROPOSAL_STALE`, persistence deep-equal. Otherwise apply through `updateRiskInMutation`, which writes the history `updated` row with source `ai-run` and the item key, and Phase 12's per-field provenance with the rewrite run's id (D-25's per-field run reference).
- **Restore an accepted unit:** allowed only while the risk still holds the accepted values (else `AI_PROPOSAL_STALE`); writes the base values back, a history row, and returns the item to `open`.
- **The Accept rule at acceptance (D-38):** compute the residual rating after every unit accepted in the same batch; an AI-proposed Accept unit with a High or Critical result is `AI_ACCEPT_NOT_PERMITTED`. The rule calls Phase 12's `acceptProposalAllowed` in `apps/backend/src/csrm/risk-scale.ts`.
- **Generic mechanism for Phase 17:** put units, base capture, staleness and application in `apps/backend/src/csrm/ai/risk-proposals/field-units.ts` with no reference to the rewrite operation, so ASSESS-13 adds an operation.

### The decision operation, extended (D-39)
Phase 12's `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` body gains a target kind:

```text
{ target: { kind: "proposal", runId, item }, action: "accept" | "reject" | "restore", reason?: string (≤ 500) }
```
[ASSUMED: field names; Phase 12 research proposes `target: { kind: "risk", riskId } | { kind: "assessment" }` and actions `accept | dismiss | restore` for its own targets]

- The parser is closed per target kind: `reject` is valid only for `proposal` targets and `dismiss` only for Phase 12's suggested-control targets, so neither verb leaks across.
- The run must belong to the path's assessment (404 for the whole batch otherwise); an unknown item is a 400 (Phase 12's rule).
- **Ordering inside one batch:** apply in the order sent; the whole batch is one transaction, and any refusal rolls back all of it (persistence deep-equal), as Phase 12's batch does.
- **Transition per batch:** if any item in the batch is a content change, the batch takes the accepted-edit transition once; a batch of only rejections takes none.

### Release readiness (D-42)
Add one assessment-scope requirement to `projectReleaseReadiness` with key `aiProposalsDecided`, destination `ai-proposals`, outstanding while `openProposals.count > 0`. The `key` and `destination` are free strings in the spec [CITED: 12-RESEARCH.md "Contract changes" row 5], so only the served label is new; the UI-SPEC fixes it.

### "New information since the last AI run" (D-28)
Server-derived in the analyst assessment detail: `aiInputsChanged: { since: <latest completed run's completedAt for this assessment>, notes: number, files: number } | null`. Notes come from Phase 13's notes marked "changes the AI inputs", files from Phase 14's opted-in attachments, each counted with `createdAt > since`. Until Phases 13 and 14 exist the field is null. Build it as a function the Phase 13 and 14 extension points feed, so the plan adapts the extension point if those phases land differently.

## Contract changes

| # | Operation or schema | Change | Grant (human analyst only, D-43) |
|---|---|---|---|
| 1 | `POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals` | New; body `{ riskIds, reason }`; 200 `{ data: { applied: string[], unchanged: string[] } }`; 400, 403, 404, 409 | `function.risk_curation.withdraw_api` |
| 2 | `POST /api/v1/risk_assessments/{assessmentId}/risk_reinstatements` | New; body `{ riskIds, reason }` or `{ riskIds, undo: true }`; same response | `function.risk_curation.reinstate_api` |
| 3 | `GET /api/v1/risks/{riskId}/history` | New; paginated `{ data: RiskHistoryEvent[], meta: { pagination, recordedFrom } }` | `function.risk_curation.history_read_api` |
| 4 | `POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions` | New; body `{ instruction? }`; 202 `{ data: RiskProposalJob }`; 409 with `ASSESSMENT_NOT_MUTABLE` or an AI policy reason | `function.risk_ai_proposals.suggest_api` |
| 5 | `POST /api/v1/risks/{riskId}/rewrite` | New; body `{ instruction?, focus? }`; 202; 409 `RISK_WITHDRAWN`, `ASSESSMENT_NOT_MUTABLE` or an AI policy reason | `function.risk_ai_proposals.rewrite_api` |
| 6 | `GET /api/v1/risk_proposal_jobs/{jobId}`, `POST …/{jobId}/retry` | New | `function.risk_ai_proposals.job_read_api`, `.retry_api` |
| 7 | `GET /api/v1/risk_assessments/{assessmentId}/ai_proposals` | New; open items plus the latest decided items (bounded, for example 50), with run facts | `function.risk_ai_proposals.read_api` |
| 8 | Phase 12's `ai_proposal_decisions` | Gains `proposal` targets and `reject` | Phase 12's existing human-only Function |
| 9 | `AnalystRiskDetail` | `withdrawal: { at, by: ActiveUserSummary, reason } \| null` (required, nullable) | — |
| 10 | `AnalystAssessmentDetail` | `openAiProposals: number`; `aiInputsChanged` (above) | — |
| 11 | `RiskDetail` (register) | `withdrawal` block as in 9 | — |
| 12 | Risk Register query | The new closed `withdrawal` filter | — |
| 13 | Release readiness | `aiProposalsDecided` key and label | — |
| 14 | Conflict reasons (both copies, both conflict response schemas) | `RISK_WITHDRAWN`, `RISK_NOT_WITHDRAWN`, `AI_PROPOSAL_STALE`, `AI_ACCEPT_NOT_PERMITTED`, and either `AI_PROPOSAL_NOT_OPEN` or Phase 12's `AI_PROPOSAL_ALREADY_DECIDED` (Open Question 2) | — |
| 15 | Catalogue | Two new API-only Functions (`function.risk_curation.*`, `function.risk_ai_proposals.*`) on `role.security_analyst`; the routes join `HUMAN_ANALYST_ONLY_OPERATIONS` with a denial-message branch; `regenerate_draft`'s served-operations `reason` names the Phase 16 operations | — |

Names are proposals within the CONTEXT's families; the planner fixes them. **Shared schemas with several producers** (Phase 12 Pitfall 17): `AnalystRiskDetail` is emitted only inside `AnalystAssessmentDetail` [VERIFIED: specification.json reference scan this session], but `RiskSummary` is the item of both `RiskResponse` and `RiskListResponse`; Phase 16 should not change `RiskSummary`, so the create and update responses stay as they are.

## Architecture Patterns

### System Architecture Diagram

```
Security Analyst (editor) ──Withdraw/Reinstate──> Strapi route ─grant: risk_curation (human only)─> controller
        │                                              │ assertAnalystAssessmentScope; closed body
        │                                              v
        │                      withAssessmentMutation(transition=accepted-edit)
        │                        serialise → trx → lock → load → assertAssessmentEditable(actor)
        │                        → set/clear withdrawal facts → history rows → supersede open rewrite items
        │                        → openProposals count → transition write
        │
        ├──Suggest more risks / Rewrite──> route ─grant: risk_ai_proposals─> enqueue
        │          read-only guard + AI policy (409 before queueing) ──> proposal registry (single flight while active)
        │                                         │ async
        │                                         v
        │      guard + policy re-check ─fail─> job failed (no run)
        │      Phase 12 context builder + existing/withdrawn/decided blocks (+ notes, files, instruction)
        │                     │ over bound ─> job failed CONTEXT_TOO_LARGE (no run)
        │                     v
        │      CsrmAiRun(running) ─> provider (deterministic | openai-compatible) ─> adapter
        │      (dedupe | diff units, Accept rule) ─> closed parser
        │                     v
        │      withAssessmentMutation(transition=none): run completed, items open (or lapsed if not editable),
        │      older rewrite items superseded, openProposals updated
        │
        ├──GET ai_proposals──> open + recent items ──> proposals panel / rewrite diff
        ├──POST ai_proposal_decisions (accept | reject | restore)──> withAssessmentMutation
        │        accept suggestion → createRiskInMutation + history(created, ai-run) + provenance
        │        accept unit → stale check → Accept rule → updateRiskInMutation + history(updated, ai-run)
        │        reject → itemStates + decisions log (transition none)
        └──Release──> readiness over active risks + aiProposalsDecided
Requestor ──> released assessment, risk list, control implementations, relationship counts: active risks only;
              a withdrawn risk reads as not found
```

### Recommended Project Structure (new modules)

```
apps/backend/src/csrm/
├── active-risk.ts                     # isActiveRisk, activeRisks, ACTIVE_RISK_FILTER
├── risk-history-changes.ts            # pure field diff and envelope parser
└── ai/
    ├── analyst-instruction.ts         # only if Phase 15 has not placed it (D-27)
    └── risk-proposals/
        ├── duplicate-scorer.ts        # Jaccard on Phase 12's tokeniser; thresholds
        ├── field-units.ts             # units, base capture, staleness, application plan (generic, Phase 17 reuses)
        ├── proposal-envelope.ts       # v2 items, itemStates, closed parsers
        ├── suggestion-context.ts      # existing / withdrawn / decided blocks
        ├── rewrite-context.ts
        ├── suggestion-adapter.ts, rewrite-adapter.ts
        ├── deterministic-risk-proposal-provider.ts, openai-compatible-risk-proposal-provider.ts
        ├── risk-proposal-registry.ts
        └── risk-proposal-workflow.ts  # enqueue, execute, complete, supersede, lapse
apps/backend/src/api/csrm-risk-history-event/   # content type, risk-history.ts writer and read
apps/backend/src/api/csrm-risk/services/risk-curation.ts   # withdraw, reinstate
apps/csrm/src/features/risk-curation/
├── risk-curation-domain.ts            # zod-free: states, labels, overall-rating hint, word diff
├── risk-curation-schema.ts, risk-curation-service.ts, risk-curation-actions.ts
└── withdraw-risk-form.tsx, risk-history-sheet.tsx, ai-proposals-panel.tsx, risk-rewrite-diff.tsx,
    risk-proposal-job.tsx, withdrawn-risk-card.tsx   # the panel, diff, sheet and form load with next/dynamic
```

### Pattern 1: One guard, two wrappers, inner functions
Every entry point passes `assertAssessmentEditable(actor)`; content changes take the accepted-edit transition, non-content decisions do not; inner functions never serialise. This is the seam Phases 17, 17.1 and 18 extend.

### Pattern 2: Current fact plus append-only log (06.8, Phase 12 D-21)
Withdrawal facts on the risk (gates read them), history rows (narrative). `itemStates` and `openProposals` (gates read them), the run's `decisions` (narrative).

### Pattern 3: Wire shape, adapter, context-aware closed parser (06.7 D-14, Phase 12 D-15)
The model returns friendly shapes; the adapter assigns keys, ids, derived ratings and Accept downgrades, dedupes and diffs; the parser is the gate.

### Pattern 4: Human-only API Functions with a second guard
As `function.questionnaire_generation.*` [VERIFIED: catalogue lines 58-60, 121-159 printed this session] plus `HUMAN_ANALYST_ONLY_OPERATIONS`.

### Pattern 5: Batch Server Actions
"Reject remaining", "Confirm all" and multi-risk withdrawal are one Server Action each, because Next 16.3 dispatches Server Actions one at a time per client [CITED: 12-RESEARCH.md Pattern 5, from `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md`].

### Anti-Patterns to Avoid
- Calling `updateRisk` or `createAssessmentRisk` from inside a decision batch (deadlock).
- Folding the active rule into `applyDisclosableParent` (the register's "Withdrawn" filter would become unreachable).
- Reusing `closureDate`, `comments` or a status enum for withdrawal (D-05).
- Copying the draft registry's single flight (terminal jobs block re-runs).
- Parsing `decisions` or history rows in any gate.
- A bidirectional history relation (changes the risk schema; heavy populates).
- Computing the diff or duplicate flags in the browser from model output (the server owns them; the browser only renders the word diff of two values it was sent).
- Putting withdrawn risks in any Requestor or participant projection, count or figure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serialisation and locking | A new lock | `withAssessmentMutation` (the refactored `withMutableAssessmentMutation`) | Keeps 06.8 D-04 and D-13 review semantics |
| Reason bounds | A new limit | `REVERT_REASON_MAX_LENGTH` via an extracted `parseReasonText` | One bound for every reason |
| Prompt escaping, provider HTTP, context, policy, run record | New machinery | Phase 12's `promptDataTag`, `requestJsonCompletion`, `buildAssessmentContext`, data policy, `CsrmAiRun` | D-25: no parallel machinery |
| Ratings and the Accept rule | Local tables | Phase 12's `risk-scale.ts` (`deriveRating`, `acceptProposalAllowed`) | One configuration point for Phase 22 |
| Tokenising | A second tokeniser | Phase 12's `library-ranking.ts` tokeniser | Same normalisation for ranking and dedupe |
| Reason codes and refusal copy | Ad hoc messages | Phase 10's `conflict-reasons.ts` (both copies) and `refusal-copy.ts` | One closed vocabulary |
| Status tag | A new badge | `statusPresentation` with a "Withdrawn" value | G-13's one mapping |
| History presentation | A new timeline | `questionnaire-revision-timeline.tsx`'s presentation | D-46 |
| Job polling UI | A new poller | The `assessment-draft-job.tsx` pattern (Phase 10 D-26) | Consistent "Check again" behaviour |
| User display names | Per-row lookups | One batched lookup | Bounded reads |

**Key insight:** every decision that matters (what counts, who may change what, what the AI may propose, whether a value is stale) lives in one server module with a pure core that tests pin; the browser renders and sends intents.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The operator's development SQLite database holds UAT-A, UAT-B, UAT-C and the seeds; no risk has withdrawal facts or history | None: schema sync adds the columns and table at the orchestrator's next Strapi start; existing risks read as active with no history (code edit only, no data migration) |
| Live service config | Role → Function grants reconcile from the bootstrap catalogue at every boot (Phase 12 research, `seed-csrm-data.ts`) | The two new Functions reach the dev database at the next boot |
| OS-registered state | None: no scheduled task or service is added | None |
| Secrets and environment variables | None new. Phase 12's `CSRM_AI_DATA_CLASSIFICATION_CEILING` and `CSRM_AI_PROVIDER` pins apply to both new operations | None; harness pins already planned by Phase 12 |
| Build artifacts | `apps/backend/dist` (shared by tests and dev server), `apps/csrm/src/lib/api/generated/schema.d.ts`, `docs/references/served-operations.json` | Regenerate with the dev servers stopped |

## Common Pitfalls

### Pitfall 1: Nested serialisation deadlock
- **What goes wrong:** a decision batch inside `withMutableAssessmentMutation` calls `updateRisk`, which queues behind itself on the same assessment and never resolves.
- **Why:** `serializeAssessmentMutation` awaits the previous promise for the same document id [VERIFIED: assessment-workflow.ts:381-396].
- **How to avoid:** inner `*InMutation` functions; a unit test that runs an accept-suggestion and an accept-unit batch with a timeout.
- **Warning signs:** an integration test that hangs until the 600,000 ms test timeout.

### Pitfall 2: Readiness counting withdrawn risks
- **What goes wrong:** filtering only the detail's display, not `validateReleaseReadiness`, keeps a withdrawn incomplete risk blocking release, or lets the transition table compute readiness from the wrong set.
- **How to avoid:** the in-memory predicate inside both readiness functions; tests for release with an incomplete withdrawn risk.

### Pitfall 3: The forgotten reader
- **What goes wrong:** `relationship-scope.ts` (not in D-13's list) or a later SQL reader keeps counting withdrawn risks; a Requestor sees a risk count that does not match the released view.
- **How to avoid:** the static reader guard; a Requestor relationship-count test.

### Pitfall 4: An all-unchanged batch withdraws a review
- **What goes wrong:** the wrapper writes the transition unconditionally, so re-sending an already applied withdrawal regresses an in-review, release-ready assessment.
- **How to avoid:** skip the transition when nothing changed; test idempotence on a release-ready assessment.

### Pitfall 5: Undo identified by a magic string
- **What goes wrong:** an analyst types "Withdrawal undone" as a reason and the history shows an undo.
- **How to avoid:** a closed `undo: true` flag; the server writes the fixed reason and a `cause`.

### Pitfall 6: Request deletion and orphaned risks
- **What goes wrong:** an analyst deletes a request with an assessment; risks survive but their request is gone, and register and insight readers may mis-project.
- **How to avoid:** the mounted proof that risks and history survive; raise whether request deletion should be refused once an assessment exists (Open Question 4).

### Pitfall 7: History rows written outside the transaction
- **What goes wrong:** a failed mutation leaves a history row, or a successful one lacks it.
- **How to avoid:** write inside the same `db.transaction` callback; the existing code relies on document-service calls inside `strapi.db.transaction` joining that transaction [VERIFIED: the pattern at assessment-workflow.ts:443-480]; a test forces a failure after the history write and asserts no row remains.

### Pitfall 8: Terminal jobs blocking re-runs
- **What goes wrong:** copying the draft registry makes a second "Suggest more risks" return the completed job for an hour.
- **How to avoid:** single flight only while `queued` or `running`; unit test.

### Pitfall 9: A run completing after release
- **What goes wrong:** the assessment is released while a job runs; completion opens items on a released assessment and the open count blocks nothing but misleads.
- **How to avoid:** completion checks the guard inside the serialised transaction and records items `lapsed`; a test releases between start and completion using a deterministic provider with an injectable delay.

### Pitfall 10: Stale comparisons that never match
- **What goes wrong:** base values captured untrimmed, or relations captured as objects, make every accept stale (or none).
- **How to avoid:** normalise exactly as `parseWritableRiskFields` and `resolveRelations` store values; property tests on the unit module.

### Pitfall 11: Accept rule only in the adapter
- **What goes wrong:** the residual unit is rejected but the Accept unit accepted, leaving Accept on a High risk.
- **How to avoid:** re-check at acceptance after the batch's units (D-38); tests for both orders in one batch and across two batches.

### Pitfall 12: Supersession without a human cause
- **What goes wrong:** items close silently when a newer rewrite completes.
- **How to avoid:** supersession records the cause (`newer-rewrite` with the run id, or `risk-withdrawn` with the actor) and a decision event; the proposals read shows it.

### Pitfall 13: Context flooding through withdrawn and rejected lists
- **What goes wrong:** a long-curated assessment exceeds the context and the job truncates silently.
- **How to avoid:** the 200-entry bound and `CONTEXT_TOO_LARGE`, never truncation.

### Pitfall 14: Copy collision with the glossary
- **What goes wrong:** buttons read "Accept" for the analyst's review, which the glossary and Phase 12's UI-D1 reserve for the risk owner.
- **How to avoid:** settle Open Question 1 before the UI-SPEC.

### Pitfall 15: The route budget
- **What goes wrong:** the editor route exceeds 300,000 bytes; it was 269,653 at the Phase 8 baseline [VERIFIED: docs/performance/phase-08-baseline.md:61] before Phases 10 and 12 add to it.
- **How to avoid:** `next/dynamic` from a Client Component for the panel, diff, sheet and form; zod-free client modules; `performance.spec.ts` green.

### Pitfall 16: The base moves first
- **What goes wrong:** Phases 10 to 15 rewrite the hot files before Phase 16 executes, and Phase 12's plans are being written now.
- **How to avoid:** plans name the earlier plans they rely on (Phase 10's 10-06 and 10-13; Phase 12's context, run record, provenance, decision and readiness plans) and the plan check re-runs before execution.

## Code Examples

### The active-risk forms (proposal; names are the planner's)

```typescript
// apps/backend/src/csrm/active-risk.ts (new)
export const ACTIVE_RISK_FILTER = { withdrawnAt: { $null: true } } as const; // $notNull is used in-repo: recent-activity-repository.ts:85
export function isActiveRisk(risk: unknown): boolean {
  return typeof risk === "object" && risk !== null && (risk as { withdrawnAt?: unknown }).withdrawnAt == null;
}
export const activeRisks = <T>(risks: readonly T[]): T[] => risks.filter(isActiveRisk);

// apps/backend/src/api/csrm-risk/services/risk-register.ts (beside applyDisclosableParent)
export function applyActiveRisk<T extends { whereRaw(sql: string): unknown }>(query: T): T {
  query.whereRaw("r.withdrawn_at IS NULL");
  return query;
}
```
`$null` is the counterpart of the `$notNull` filter used in-repo [VERIFIED: recent-activity-repository.ts:85 `filters: { submittedDate: { $notNull: true }, … }`]; `withdrawn_at` is the expected column name [ASSUMED].

### The readiness change (in place)

```typescript
// assessment-workflow.ts, validateReleaseReadiness: replace the risks source
const risks = Array.isArray(value.risks) ? activeRisks(value.risks) : [];
if (risks.length === 0) { missing.push("risks"); return { ready: false, missing }; }
risks.forEach((risk, index) => { /* unchanged checks */ });
// projectReleaseReadiness must iterate the same activeRisks(...) list so the
// `risks[${index}]` paths line up with validateReleaseReadiness.
```
The index alignment matters: `projectReleaseReadiness` builds paths `risks[${index}]` from its own iteration [VERIFIED: assessment-workflow.ts:280-304], so both functions must filter the same way.

### Extracted reason parser

```typescript
// revert-reason.ts (beside parseRevertReason, which then calls it)
export function parseReasonText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 1 && reason.length <= REVERT_REASON_MAX_LENGTH ? reason : null;
}
```

### Jaccard scorer (pure)

```typescript
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}
```

## Plan grouping and wave order

"Owns" lists shared files, one owner per wave (D-51). Numbers are a proposal at the top of M (13 plans); the planner may merge.

| Wave | Plan | Slice | Owns (shared files) | Dev servers |
|---|---|---|---|---|
| 1 | 16-01 | `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, the dated amendments to `phase-12-ai-run-record-and-provenance.md` and `phase-04-deterministic-draft-jobs.md`; `checkpoint:decision` | `docs/contract-gaps/` | Running is fine |
| 1 | 16-02 | Pure modules and units: `active-risk.ts`, `risk-history-changes.ts`, `parseReasonText`, `duplicate-scorer.ts`, `field-units.ts`, `proposal-envelope.ts` | `revert-reason.ts`, new `csrm/*` files | Stopped for Strapi runs |
| 2 | 16-03 | Schema after approval: withdrawal attributes, `csrm-risk-history-event` type and writer; migration proof; freeze check | `csrm-risk/schema.json`, the new type | Stopped |
| 3 | 16-04 | Guard and wrapper refactor, inner functions, history writes on every existing path (including `persistAssessmentDraft`), the withdrawn-risk guard on every risk and control mutation | `assessment-workflow.ts`, `risk-workflow.ts`, `control-implementation-workflow.ts` | Stopped |
| 4 | 16-05 | Withdraw, reinstate and history read: routes, controllers, spec, catalogue Functions, guard list, matrix, served-operations, conflict reasons (both copies), web schema, service, actions, parity | Catalogue copies, `csrm-authorization.ts`, matrix, `served-operations.json`, spec and client, `conflict-reasons.ts` (both), parity and chain guards | Stopped |
| 5 | 16-06 | Active rule on the assessment side: readiness, analyst detail (`withdrawal`), Requestor reads, relationship counts, Phase 11's list aggregates | `assessment-scope.ts`, assessment controller, `relationship-scope.ts`, spec and client, web assessment schema | Stopped |
| 6 | 16-07 | Active rule on the register and insights: register filter and detail, dashboard, alerts, reports; the static reader guard; seeds' tests | `risk-register.ts`, `risk-register-query.ts`, the three insight repositories, spec and client, web risk schema | Stopped |
| 7 | 16-08 | AI core: contexts, wire, adapters, deterministic and OpenAI-compatible providers, wire tests through the fake server | `csrm/ai/risk-proposals/*` | Stopped |
| 8 | 16-09 | Jobs and runs: registry, enqueue routes, job read and retry, completion, supersede and lapse, open-item fact; spec, catalogue, matrix, served-operations | Catalogue copies, `csrm-authorization.ts`, matrix, spec and client | Stopped |
| 9 | 16-10 | Decisions extension, proposals read, `aiProposalsDecided` readiness; spec and parity | Phase 12's decision service, `assessment-workflow.ts`, spec and client | Stopped |
| 10 | 16-11 | Recorded design extensions (X-n), then `features/risk-curation/*` components and units | `docs/design/csrm-design-direction.md`, new web feature | Running is fine for web units |
| 11 | 16-12 | Editor, register detail and released-view integration; Discard; overall-rating hint; new-information notice; deliberate E2E changes | `assessment-editor.tsx`, `risk-editor.tsx`, `released-assessment.tsx`, `risk-detail-editor.tsx`, `status-badge.tsx`, page loaders | Stopped (Playwright) |
| 12 | 16-13 | New spec `risk-curation.spec.ts`; full gate; 375 and 1440; clean tree | New spec | Stopped |

## E2E specs that change deliberately

| Spec | Change | Plan |
|---|---|---|
| `assessment-release-workflow.spec.ts` | Only if readiness copy shifts with the new requirement | 16-12 |
| `risk-register-workflow.spec.ts` | Only if the default view or filter bar changes visibly | 16-12 |
| `accessibility.spec.ts`, `performance.spec.ts` | Stay green | 16-12, 16-13 |
| New `risk-curation.spec.ts` | D-50's journey with its own records, `@journey` at 375 and 1440 | 16-13 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard delete of wrong records | Soft withdrawal with reason plus an append-only change log | Audit practice for risk registers (decision 6) | Withdrawal facts plus history entity |
| Whole-draft regeneration | Targeted proposals reviewed per item or per field | Human-in-the-loop AI review patterns [ASSUMED] | Two operations, run-scoped items, per-unit diff |
| Free-form duplicate judgement | Deterministic similarity with explicit "dropped" and "similar" tiers | — | Honest lists without hidden model output |

**Deprecated or outdated here:** the Phase 04 rule "a linked draft never invokes the provider again" (narrowed to the draft job, D-04); `regenerate_draft` as a future intent (now superseded by the two operations).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Strapi names the column `withdrawn_at` | Code Examples; reader inventory | The SQL fragment fails; caught at the first integration test |
| A2 | A unidirectional manyToOne leaves the target schema unchanged | The risk history entity | The freeze check fails; switch the relation form |
| A3 | Strapi 5 document deletion does not cascade to related documents | No hard delete | Deleting a request could delete risks; the mounted proof catches it |
| A4 | Jaccard with thresholds 0.8 (same type) and 0.5 suits the fixtures | Duplicates | Too many or too few flags; tuned on fixtures, operator's live check |
| A5 | An all-unchanged batch should skip the transition | Withdrawal | A review is withdrawn by a no-op; a design choice for the planner |
| A6 | Mixed reinstatement batches report active ids as unchanged | Withdrawal | Stricter rule needed; one-line change |
| A7 | `undo: true` flag rather than a reason string | Withdrawal | Copy and contract change only |
| A8 | Instruction bounds 1 to 2,000 characters if Phase 15 has not set them | Contexts | Phase 15 overrides |
| A9 | Envelope field names (`itemStates`, `openProposals`, unit keys) | AI proposals | Contract-gap record renames them |
| A10 | History stores whole text values | The risk history entity | Larger rows; bounded by the risk fields themselves |
| A11 | The npm `diff` package name | Alternatives | Informational only |
| A12 | Human-in-the-loop review is the prevailing pattern | State of the Art | Informational |

## Open Questions

1. **Visible copy: "Accept" or "Confirm" for the analyst's review of a rewrite unit and for "Accept all"?**
   - What we know: D-36, D-47 and D-49 say "Accept", "Accept all". The 2026-10-01 Orchestrator Confirmation in `12-CONTEXT.md` rules that "the analyst's review of an AI proposal reads 'Confirm' and 'Confirmed' in visible copy… visible 'Accept' is reserved for the risk owner's decision", and the root glossary agrees. An "Accept" button beside a proposed treatment action "Accept" is ambiguous.
   - Recommendation: visible "Confirm" and "Confirm all" (API `accept` unchanged); "Reject" and "Reject remaining" stay (decision 6's word); keep Phase 12's "Dismiss" for suggested controls. The orchestrator confirms before the UI-SPEC.
2. **One "not open" reason or two?** Phase 12's research adds `AI_PROPOSAL_ALREADY_DECIDED`; Phase 16's CONTEXT proposes `AI_PROPOSAL_NOT_OPEN`.
   - Recommendation: reuse Phase 12's code for every item that is not open (accepted, rejected, superseded, lapsed); the copy reads the item's state from the refreshed proposals read. Add `AI_PROPOSAL_NOT_OPEN` only if Phase 12's plans do not adopt its code.
3. **Who may retry a failed proposal job?** D-26 defers to "Phase 13's rule", which Phase 13 has not written; Phase 10 D-25 gives `canRetry` to the initiator only.
   - Recommendation: any analyst reads; the initiator retries (Phase 10's rule); another analyst simply starts a new run, which names them.
4. **Should a request with an assessment be deletable?** The human analyst holds `delete_api` on requests. Phase 16 proves risks survive; whether deletion should be refused once an assessment exists is a separate decision (not Phase 16's scope). Shared-file change: none in this phase; the orchestrator may raise it for Phase 22's role review.
5. **At acceptance, should an AI Accept also be refused when the risk has a planned control implementation?** D-38 applies G-14's planned-control condition in the adapter only; controls can be added between proposal and acceptance.
   - Recommendation: apply the same condition at acceptance with `AI_ACCEPT_NOT_PERMITTED`, because G-14 says Accept "is offered only for a risk with no planned control implementation". Needs the orchestrator's confirmation since it extends D-38.
6. **The first free X-n** for the field comparison and the withdrawn-record extensions comes from the orchestrator (Phase 12 used X-11 to X-14; Phases 13 to 15 may take more).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (nvm) | All builds and tests | ✓ | `C:\ProgramData\nvm\v24.19.0` present (observed) | — |
| pnpm | Scripts | ✓ (Phase 12 observed 11.24.0) | — | — |
| SQLite (`better-sqlite3`) | Strapi tests | ✓ | as installed | — |
| Playwright Chromium | E2E | ✓ | 1.58.2 | — |
| Hosted AI provider | The manual live check only | Operator-owned | — | Deterministic provider in every suite |
| Dev servers (1337, 3000) | Browser checks | Not listening at research time (observed) | — | Must be stopped for Strapi-editing plans and Playwright |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Strapi: `node:test` via `tsc -p tests/tsconfig.json`, one database per file; web: vitest 4.1.11 (jsdom) with Testing Library; E2E: Playwright 1.58.2 with @axe-core/playwright on the production build |
| Config file | `apps/backend/tests/tsconfig.json`; `apps/csrm/vitest.config.ts`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --filter @csrm/web exec vitest run <paths>`. Strapi file (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| Full suite command | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test`; `pnpm --dir apps/csrm test:e2e`; then `git status --short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASSESS-09 (1) | Withdrawn risks leave readiness, counts, figures, registers and every Requestor read; history keeps reason, actor and time | Strapi unit + integration + web + E2E | quick run `active-risk.unit.test.js`, `risk-curation.integration.test.js`, `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-reports.integration.test.js`; `vitest run src/features/risk-curation`; `risk-curation.spec.ts` | ❌ W0 / ✅ |
| ASSESS-09 (2) | No persisted risk is deleted (routes, static guard, cascade proof); Discard is client-only; rejected proposals recorded | Strapi unit + integration + matrix + web | quick run `risk-no-delete.unit.test.js`, `risk-curation.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/assessments/risk-editor.test.tsx` | ❌ W0 / ✅ |
| ASSESS-09 (3) | Withdraw, reinstate, edits and decisions refused on a released assessment; edits refused on a withdrawn risk | Strapi integration + web + E2E | quick run `risk-curation.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ W0 / ✅ |
| ASSESS-10 (1) | Suggestions exclude existing, withdrawn and decided risks; near-identical dropped, similar flagged; each item accepted or rejected | Strapi unit (wire) + integration + E2E | quick run `risk-duplicate-scorer.unit.test.js`, `ai-provider-risk-proposals.unit.test.js`, `risk-proposals.integration.test.js`; `risk-curation.spec.ts` | ❌ W0 |
| ASSESS-10 (2) | Rewrite proposes units; per-unit accept and reject; stale refused; Accept rule enforced | Strapi unit + integration + web + E2E | quick run `risk-field-units.unit.test.js`, `risk-proposal-decisions.integration.test.js`; `vitest run src/features/risk-curation` | ❌ W0 |
| ASSESS-10 (3) | Each run records instruction, analyst, time and provider; released and withdrawn risks cannot be re-run | Strapi integration + matrix | quick run `risk-proposals.integration.test.js`, `ai-run.integration.test.js`, `authorization-matrix.integration.test.js` | ❌ W0 / Phase 12 W0 |

### Sampling Rate
- **Per task commit:** the touched web files by path; the touched Strapi files by path (dev servers stopped); `typecheck` after type changes; `api:check` after spec changes.
- **Per wave merge:** the full web suite, `typecheck`, `lint` and `api:check`; the full Strapi suite after every Strapi-editing plan; each UI plan's targeted Playwright specs at its end.
- **Phase gate:** the full gate on the production build, `git status --short` clean, the content-type freeze check (exactly `csrm-risk/schema.json` and the history type's `schema.json` since the Phase 16 context commit), `cmp` of the catalogue copies, and no Keycloak change.

### Wave 0 Gaps
- [ ] `apps/backend/tests/active-risk.unit.test.ts` (16-02)
- [ ] `apps/backend/tests/risk-history-changes.unit.test.ts` (16-02)
- [ ] `apps/backend/tests/risk-duplicate-scorer.unit.test.ts` (16-02)
- [ ] `apps/backend/tests/risk-field-units.unit.test.ts` (16-02)
- [ ] `apps/backend/tests/risk-no-delete.unit.test.ts` and the static reader guard (16-04, 16-07)
- [ ] `apps/backend/tests/risk-curation.integration.test.ts` (16-04, 16-05, 16-06)
- [ ] `apps/backend/tests/ai-provider-risk-proposals.unit.test.ts` and `tests/fixtures/ai-wire/risk-proposals/*.json` (16-08)
- [ ] `apps/backend/tests/risk-proposals.integration.test.ts` (16-09)
- [ ] `apps/backend/tests/risk-proposal-decisions.integration.test.ts` (16-10)
- [ ] `apps/csrm/src/features/risk-curation/*.test.ts(x)` (16-05, 16-11)
- [ ] `apps/csrm/e2e/risk-curation.spec.ts` (16-13)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged; Keycloak deferred) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Human-analyst-only Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`; `assertAnalystAssessmentScope`; risk → assessment ancestry; run → assessment match; the editable guard; the withdrawn-risk guard; Requestor 404 for withdrawn risks |
| V5 Input Validation | yes | Closed Strapi parsers (bodies, wire, envelopes, history); closed Zod on the web; reason and instruction bounds; batch size and uniqueness |
| V6 Cryptography | no new use | — |
| V7 Error Handling and Logging | yes | Closed conflict reasons; safe job failure codes; the history and run records as audit |
| V8 Data Protection | yes | Phase 12 minimisation and ceiling for both operations; no owners, numbers or dates in contexts; withdrawn risks never reach Requestors |
| V13 API | yes | The contract chain, served inventory, six-actor matrix |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection through risk text that restates Requestor facts, withdrawal or rejection reasons | Tampering / Elevation | Everything except the analyst instruction sits in the escaped data block; closed wire schema; adapter-owned ids, ratings and Accept rule; human decision for every item |
| IDOR on withdrawal, history, jobs, runs or decisions | Information disclosure / Tampering | Assessment scope; risk and run ancestry checked against the path; 404 for the whole batch; no enumeration |
| Requestor learning a withdrawn risk exists | Information disclosure | Active rule on every Requestor read and count; 404 on direct reads; tests in each read |
| Audit erasure | Repudiation | No delete route or code path for risks or history; append-only history and decisions; static guard |
| Automation curating or re-running | Elevation | Human-only Functions; the service agent holds no Phase 16 grant |
| Silent overwrite by a stale proposal | Tampering | Base-value check in the transaction; `AI_PROPOSAL_STALE` |
| Accept slipping onto a High risk | Tampering | The Accept rule in the adapter and at acceptance |
| Context flooding | Denial of service | Entry and character bounds, `CONTEXT_TOO_LARGE`, single-flight registry |

## Sources

### Primary (HIGH confidence)
- Repository code read this session: `assessment-workflow.ts`, `risk-workflow.ts`, `control-implementation-workflow.ts`, `risk-register.ts`, `risk-register-query.ts`, `revert-reason.ts`, `assessment-draft-registry.ts`, `csrm-authorization.ts`, the assessment controller, `relationship-scope.ts`, the risk and control-implementation operations, the risk schema, `served-operations.json`, the catalogue (via `node -e`), `specification.json` schemas (via `node -e`), the authorization matrix header, the web feature and component directories, the root `CONTEXT.md` glossary.
- Planning inputs: `16-CONTEXT.md`; `12-CONTEXT.md` (including both Orchestrator Confirmations), `12-RESEARCH.md`, `12-UI-SPEC.md`, `12-VALIDATION.md`; Phase 10 plans 10-06 and 10-13; `11-CONTEXT.md` D-31 and D-40 to D-45; `ROADMAP.md` Phase 16 and its neighbours; `REQUIREMENTS.md`; `NEXT-WAVE-DECISIONS.md` decision 6; `FINDINGS.md` UAT-027 and UAT-028; `JOURNEYS.md` area 2; the Stage 2 rules.

### Secondary (MEDIUM confidence)
- Phase 12's planned module names and contracts (`12-RESEARCH.md`), which Phase 16 builds on before they exist.

### Tertiary (LOW confidence)
- Strapi documentation page on Document Service populate (fetched; it documents `sort` inside populate but not `filters`, so this research does not rely on populate filters).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions from manifests.
- Architecture: HIGH for placement, the guard split and the reader inventory (code read); MEDIUM for the AI seams, which depend on Phase 12's plans.
- Pitfalls: HIGH for the code-grounded ones (deadlock, registry, readiness, readers); MEDIUM for thresholds and Strapi relation behaviour.

**Research date:** 2026-10-01
**Valid until:** 2026-10-31, or until Phase 10, 11 or 12 executes, whichever comes first (their changes move line numbers and create the modules this phase builds on).

# Phase 16: Risk curation and targeted AI re-runs - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option, which is what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk identification and communication; decision 6's audit-trail integrity) at the G-4 premium bar. Grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: UAT-027 and UAT-028, JOURNEYS.md area 2, F7 rows);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#5, #6, #8, #9, #10, #11, #12, #14, #17, G-1, G-3, G-4, G-6, G-7, G-11 to G-15);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code;
- the planned outputs of Phase 10 (plans), Phase 11 (CONTEXT, UI-SPEC), Phase 12 (CONTEXT, RESEARCH) and the ROADMAP entries of Phases 13, 14, 15, 17, 17.1, 17.2, 18, 19, 20 and 22;
- a read of today's code (file references under `<code_context>`).

There is no SPEC.md for this phase. The discussion log is `16-DISCUSSION-LOG.md`.

**Plans are written ahead.** Phase 16 executes after Phases 10 to 15 (execution order 10, 11, 12, 13, 14, 15, 16). Its plans are written against today's code plus the planned outputs of those phases, name the earlier plans they rely on, and get a fresh plan check just before execution (STATE.md, "Next wave planning method").

<domain>
## Phase Boundary

Let a Security Analyst take wrong risks out of an unreleased assessment without deleting them, and ask the AI either to rewrite one risk or to propose the risks the draft missed, so that the draft ends up complete and correct without being rebuilt by hand. Every AI proposal ends in a human decision, and every change to a risk is kept in its history.

### Requirements and success criteria this phase owns

| ID | Requirement (REQUIREMENTS.md) | Closes |
|---|---|---|
| ASSESS-09 | A Security Analyst can withdraw an unreleased risk with a reason. Acceptance: (1) a withdrawn risk leaves the assessment, release readiness and counts, and the history keeps it with reason, actor and time; (2) no persisted risk is ever hard-deleted: an unsaved row is discarded, and a rejected AI proposal is recorded as rejected in the run record (decision 6); (3) Strapi refuses to withdraw a released risk, which closes through the register instead | UAT-027 |
| ASSESS-10 | A Security Analyst can re-run the AI for one risk or to propose additional risks. Acceptance: (1) "Suggest more risks" proposes risks that do not duplicate existing ones, each accepted or rejected on its own; (2) "Rewrite this risk" proposes field changes as a diff accepted per field; (3) each run is recorded with instruction, analyst, time and provider, and released risks cannot be re-run | UAT-028 |

ROADMAP success criteria (each is planned in the UI and the API, with its negative cases):
1. A withdrawn risk leaves the assessment and release readiness but stays in history with its reason. (D-05 to D-15, D-18 to D-21)
2. "Suggest more risks" on UAT-A-like input proposes the missing payment-file risk without duplicating the existing ones. (D-24 to D-33)
3. "Rewrite this risk" shows a field-by-field diff the analyst accepts or rejects. (D-34 to D-38, D-39 to D-42)
4. Released risks cannot be withdrawn, deleted or re-run. (D-16, D-17, D-22, D-23, D-29)

### In scope
- Withdrawal and reinstatement of persisted, unreleased risks, with reasons, as assessment-scoped batch operations (D-05 to D-12).
- One active-risk rule applied by every read, count, figure and gate (D-13 to D-15).
- The structural guarantee that no persisted risk is ever deleted, and discarding an unsaved new risk (D-16, D-17).
- The risk history: a durable, append-only record of every change to a risk and its mitigation controls from this phase on, which Phases 17, 17.2, 18 and 20 extend (D-18 to D-21).
- One server-side "assessment is editable" guard that every Phase 16 mutation and AI run passes, and that Phases 17 and 17.1 extend (D-22, D-23).
- Two targeted AI operations, "Suggest more risks" and "Rewrite this risk", as generation jobs on Phase 12's context builder, AI data policy, run record and provenance (D-24 to D-38).
- Run-scoped AI proposals and their decisions, extending Phase 12's decision operation, with a release-readiness requirement that every proposal is decided (D-39 to D-42).
- Grants, the contract chain, the interface and the tests for all of the above.

### Out of scope
- Closing a released risk through the register with a reason (decision 6, decision 9): Phase 20.
- Bulk withdrawal and bulk editing in the risk table: Phase 18, which reuses this phase's operations and history (D-09, D-18).
- Whole-draft regeneration: not offered (D-24). `regenerate_draft` stays unserved.
- Residual reassessment from responses (ASSESS-13): Phase 17, which reuses this phase's field-change proposal mechanism (D-34).
- Analyst instructions for questionnaires and follow-up questions: Phase 15 (its instruction slot is reused here, D-27).
- Notes and attachments themselves: Phases 13 and 14 (this phase reads what they feed the context, D-28).
- Soft removal of control implementations: their deletion stays as built; the history records each removal (D-20).
- Controlled scales and the rating override in the editor (Phase 18), configurable scales and appetite (Phase 22), a shared job store (R-08-36), Keycloak, live AI in any automated suite.
</domain>

<decisions>
## Implementation Decisions

### Scope and contract boundary

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

### Withdrawal and reinstatement (ASSESS-09; UAT-027; decision 6)

- **D-05:** Withdrawal is a current fact on the risk, not a status. The risk is withdrawn exactly when `withdrawnAt` is set; `withdrawnBy` and `withdrawalReason` complete the fact. A status field is rejected because the JDL gives `CsrmRisk` no lifecycle status, and a competing one would collide with `closureDate` (Phase 20's closure) and `treatmentStatus`; reusing `closureDate` or `comments` is rejected because it overloads JDL terms (decision 6 keeps closure for released risks). The gates read this fact directly and never parse the history, following 06.8 ("an access-control decision must not depend on parsing a mutable JSON array").
- **D-06:** A withdrawal needs a reason: trimmed, 1 to 500 characters, through the same parser as revert reasons (`REVERT_REASON_MAX_LENGTH`). The withdrawn risk keeps its risk number, every field, its control implementations and its AI provenance, unchanged; numbers are never reused.
- **D-07:** A withdrawn risk is read-only. Strapi refuses, with `RISK_WITHDRAWN`, every mutation that targets it: `PATCH /api/v1/risks/{riskId}`, control implementation create, update and delete, Phase 12's AI proposal decisions on its fields or suggestions, and "Rewrite this risk". Reinstate it to change it. This keeps parked records from changing unseen and keeps their history meaningful.
- **D-08:** Who sees a withdrawn risk: only Security Analysts. The analyst editor shows it under a "Withdrawn" filter with its reason, who and when, its history and "Reinstate"; the Risk Register offers "Withdrawn" as an explicit filter value and excludes it from every default view. The Requestor, and from Phase 17 every participant (G-12: "every non-withdrawn risk"), never see a withdrawn risk or learn that one exists: their assessment, risk and control implementation reads exclude it, and a direct read of a withdrawn risk returns the refusal a missing record gets. A withdrawn risk is second-line working material, often an AI misfire, and is not part of what the assessment communicates (decision 6, G-12).
- **D-09:** Withdrawal is one batch operation per assessment: 1 to 200 risk ids and one reason, applied in one transaction under the assessment's serialisation, returning `{ applied, unchanged }` (a risk already withdrawn is unchanged, with no new history entry). The single "Withdraw risk" action sends one id. Phase 18's bulk withdrawal reuses this operation without a new contract (decision 7's table; ROADMAP Phase 18 "withdraw with exact grants"). A risk id that does not belong to the assessment fails the whole batch with 404 and leaves persistence deep-equal.
- **D-10:** A withdrawn risk can be reinstated while its assessment is editable, with a reason (same bounds), recorded in the history; the withdrawal facts are cleared and the history keeps both events (the 06.8 pattern: the current fact is cleared, the log keeps it). Reinstatement is the same batch shape as withdrawal. It exists because withdrawals are sometimes wrong, and new information (a note, D-28) can bring a risk back; recreating the risk by hand would split one risk into two records and lose its provenance. Reinstating a risk with an earlier acceptance decision is Phase 17.1's to rule on (seam S-6).
- **D-11:** Withdrawal and reinstatement are reversible, so neither uses a confirmation dialog (G-4). Withdrawing asks for the reason in a compact in-place form (a sheet on phones), applies optimistically, and shows an Undo toast. Undo reinstates with the fixed reason "Withdrawal undone", which the history shows as an undo. Reinstating likewise asks for a reason.
- **D-12:** Both are content edits. They run the accepted-edit transition (`transitionForAcceptedEdit`, 06.8 D-13), so a withdrawal after review withdraws the review today, and "Mark reviewed" from Phase 17.1 (decision 17: "Edits after review withdraw the review"). Withdrawing the last active risk is allowed, and release readiness then shows "At least one Risk" as outstanding.

### The active-risk rule: where withdrawn risks drop out

- **D-13:** One active-risk rule, defined once in each form it is needed and used by every reader, so no surface counts a withdrawn risk. The forms:
  - **SQL:** beside `applyDisclosableParent` and Phase 11's stage predicates in `apps/backend/src/api/csrm-risk/services/risk-register.ts` (Phase 11 D-40 put the stage rule "once, beside that scope"), so the Risk Register, the dashboard summary, the alerts and the reports inherit it;
  - **document filters:** one exported filter fragment for every `strapi.documents("api::csrm-risk.csrm-risk")` read that lists or counts an assessment's risks;
  - **in memory:** one pure predicate used by release readiness, the overall-rating hint (D-15) and the proposal context (D-31).

  The readers that change: release readiness (`validateReleaseReadiness`, `projectReleaseReadiness` and the release path, which load risks through `assessmentReleasePopulate`); the analyst assessment detail (active risks plus withdrawn ones marked, D-08); `GET /api/v1/risk_assessments/{assessmentId}/risks` and the control implementation list for the Requestor; the Requestor's released assessment and `my_risk_assessments` reads; the assessment lists' risk count and highest residual rating (Phase 11 D-31 records "Phase 16's withdrawal will exclude withdrawn Risks later"); the Risk Register list and detail, exposure and its under-assessment and accepted figures (decision 11, Phase 11 D-40 to D-43); the dashboard; the alerts; the reports; the seeds' expectations. **Reversibility:** costly - every count and figure the product shows depends on it.
- **D-14:** Later phases read the same rule rather than restating it: Phase 17's nominated owners and its release-for-response gate (G-11: "the distinct `riskOwner`s of its non-withdrawn risks"), Phase 17's participant read (G-12), Phase 17.1's decisions, readiness and fingerprints (G-13: "every non-withdrawn risk has a valid decision"), Phase 18's table, Phase 19's exports (the export authorises through the same record-read predicate the read uses), Phase 20's registers and Phase 21's metrics.
- **D-15:** The overall rating is the analyst's conclusion and never changes on its own. When the active set changes (a withdrawal, a reinstatement, an added risk or an accepted residual rating), the editor shows, without blocking, that the overall rating no longer matches the highest residual rating of the active risks, and offers "Use {rating}". Phase 12 derives the overall rating this way at generation; Phase 18 may make the relation a rule with an override reason (ASSESS-18).

### No hard delete (decision 6)

- **D-16:** No persisted risk is ever deleted, by any route or code path. Phase 04's "Expose no Risk delete service, action, input, or result" stands; decision 6 reaffirms it rather than reversing it as UAT-027 suggested. Proof:
  - no route serves DELETE for a risk: `DELETE /api/v1/risks/{riskId}` is not mounted, and the generic `DELETE /api/csrm-risks/{id}` stays unmounted (its `served-operations.json` entry stays under spec-only routes), each probed in the matrix with the same refusal for every actor;
  - a static guard test asserts that no Strapi source calls a delete on `api::csrm-risk.csrm-risk`, and that no cascade from a request or assessment deletion reaches a risk.

  The ROADMAP contract line's "risk withdraw and delete" therefore means withdrawal plus this proof, with no delete operation.
- **D-17:** An unsaved new risk is discarded, never persisted. The editor's "Add risk" form gains "Discard", which removes the unsaved form and offers an Undo toast that restores what was typed (client state only). Phase 10's navigation guard (D-12 there) warns before leaving with unsaved input in it. Nothing is written, so nothing is recorded.

### Risk history (ASSESS-09 criterion 1; decisions 6 and 9; G-15)

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

### The editable guard (ASSESS-24 seam)

- **D-22:** One server-side guard decides whether an assessment can be changed by this actor now. It is the one exported predicate behind `withMutableAssessmentMutation` (today `assertMutableAssessment`: not released, status `draft` or `in-review`, no release facts), and every Phase 16 entry point passes it:
  - withdraw and reinstate, inside the mutation transaction;
  - enqueue of both AI operations, as a read-only check before a job is queued;
  - job execution, re-checked before the provider is called, so a run never starts on an assessment that stopped being editable;
  - run completion, which records the proposals as lapsed instead of open when the assessment stopped being editable while the job ran (D-40);
  - every proposal decision, accept and reject alike.

  It takes the actor as well as the assessment, so Phase 17 adds G-11's rule (a nominated risk owner is refused every analyst mutation of that assessment) and Phase 17.1 adds ASSESS-24's lock (every analyst edit refused while an acceptance round is open) in one place, and every Phase 16 mutation inherits both without change. Refusals carry a closed reason (`ASSESSMENT_NOT_MUTABLE` today; 17.1 may add its own). **Reversibility:** costly - every mutation path routes through it.
- **D-23:** The guard is separate from the edit transition. Changes to the assessment's content or to a field's review state apply the accepted-edit transition (withdraw, reinstate, adding a suggested risk, accepting a rewrite unit, restoring an accepted unit). Rejecting a proposal, and writing a run's completion, change no content: they take the assessment's serialisation and the guard but not the edit transition, so they never withdraw a review. Phase 12 D-24 runs every decision through the edit transition, including dismissing a suggested control; the plan that extends the decision operation aligns that dismissal with this rule, with a test, because both close a proposal without changing the record.

### Targeted AI re-runs: shared foundations (ASSESS-10; UAT-028)

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

### Suggest more risks (ASSESS-10 criterion 1; success criterion 2)

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

### Rewrite this risk (ASSESS-10 criterion 2; success criterion 3)

- **D-34:** "Rewrite this risk" is offered on every active risk of an editable assessment, with an optional instruction and an optional focus (statement and cause, ratings, treatment; default all). It proposes new values for the AI-writable fields only, Phase 12's twenty: Risk Type, the statement fields, category and subcategory, cause, impact, system and asset (from the request's own), classification (from the asset), inherent and residual likelihood and consequence with derived ratings and their rationales, treatment action and plan. Owners, dates, statuses, exemption, escalation, comments, control effectiveness and velocity are first- and second-line facts that the AI never proposes. The proposal mechanism (base value, proposed value, per-unit decision, stale detection) is built generically, so Phase 17's "Reassess residual risk" (ASSESS-13: "the analyst accepts proposals per field") adds an operation, not a mechanism (seam S-11).
- **D-35:** The rewrite context holds the target risk's current values and its control implementations (control number, title and status) as data, the assessment's other active risk statements (so a rewrite does not turn it into a duplicate), the request context (D-25) and the instruction. The model returns one complete risk in the draft risk shape; the adapter computes the diff against the values captured when the context was built and keeps only fields that change.
- **D-36:** The diff is per field, except where one value derives from another, which form one unit accepted or rejected together, so the risk never holds an inconsistent combination:
  - inherent likelihood, consequence and the derived rating; residual likelihood, consequence and the derived rating (decision 8);
  - the impacted asset and the classification taken from it (Phase 12 D-13);
  - a treatment action change to Accept and its rationale in the plan (Phase 12 D-11).

  Each unit carries its base value, its proposed value, its citations (statement units) and its uncited flags. A text unit shows changed words marked by more than colour. "Accept all" and "Reject remaining" sit beside per-unit Accept and Reject.
- **D-37:** Stale units are never applied. Each unit records the base value it was proposed against; accepting checks, inside the transaction, that the risk still holds that value, and otherwise refuses with `AI_PROPOSAL_STALE` and leaves persistence deep-equal. The panel shows a stale unit as "Changed since proposed" with the current value, offering Reject or a fresh rewrite. A newer rewrite of the same risk supersedes the older open proposal (D-40), and the start dialog says so.
- **D-38:** The Accept rule holds end to end (decision 8: "the AI may propose 'Accept' only for Low or Moderate residual risk, and only with a rationale"). In both operations the adapter turns an AI Accept into Treat, recording the adjustment, when the resulting residual rating is High or Critical, when the rationale is missing, or when the target risk has a planned control implementation (G-14: Accept "is offered only for a risk with no planned control implementation, because the residual rating counts planned controls"). At acceptance the server refuses an AI-proposed Accept unit with `AI_ACCEPT_NOT_PERMITTED` if the risk's residual rating, after the units accepted in the same batch, is High or Critical. The rule reads Phase 12's `acceptProposalAllowed` in `risk-scale.ts`, the one configuration point Phase 22 takes over. An accepted AI Accept stays the analyst's recommendation, which the owner's decision replaces in Phase 17.1 (G-14).

### Proposal decisions and lifecycle (decision 6)

- **D-39:** Every AI proposal ends in a human decision. Phase 12's decision operation gains run-scoped targets, a proposed risk of a suggestion run and a unit of a rewrite run, each named by run id and item key, with the run checked against the assessment in the path. Its actions for these targets: `accept` (adds the risk, or applies the unit), `reject` (with an optional reason, 500 characters at most; decision 6's word) and `restore` (returns a rejected item to open, and an accepted unit to its base value and open, only while the risk still holds the accepted value; this is what G-4's Undo toasts call). Batches stay within Phase 12's 200 items, so "Accept all" and "Reject remaining" are one Server Action. Repeating an applied decision is a no-op; deciding an item that is no longer open is refused with `AI_PROPOSAL_NOT_OPEN`.
- **D-40:** Item states: `open`, `accepted`, `rejected`, `superseded` (a newer rewrite of the same risk replaced it, or the risk was withdrawn while it was open; recorded with the human act that caused it) and `lapsed` (the assessment stopped being editable before the proposal could be decided, for example released while the job ran). Superseded and lapsed items are closed, never silently open, and cite their cause. A newer "Suggest more risks" run does not supersede open suggestions: they stay open beside the new ones, and the new run's context lists them (D-31), so nothing the analyst has not decided is lost.
- **D-41:** Proposals are durable in the run (`proposal` holds the items; `decisions` is the append-only history, Phase 12 D-19). The current open-item count per assessment is a current fact the gate reads without parsing history: proposed as an amendment to the assessment's `aiProvenance` envelope, written in the same transaction as run completion and each decision (the 06.8 and Phase 12 D-21 split: current fact plus append-only log). The proposals read (D-03 item 7) returns open proposals and the recently decided ones, bounded, with run facts (operation, initiating analyst, time, provider, instruction) and per-item state, decider, time and reason; the editor loads it on demand.
- **D-42:** Release readiness gains "AI proposals decided" at assessment scope, outstanding while any proposal item of the assessment is open, with a destination that opens the proposals panel. Decision 6's basis is "record what the AI proposed and what a person decided", and an AI-proposed risk left undecided would leave risk identification incomplete, with no person's decision on record. "Reject remaining" clears it in one step. From Phase 17.1, "Submit final assessment" inherits it (G-13: "every other release-readiness condition is met"). Phase 12's undecided suggested controls keep their rule and do not block (Phase 12 research, open question 1): they refine a reviewed risk, while a proposed risk is an identification decision.

### Roles and grants (G-1, G-3; Phase 12 D-32)

- **D-43:** Every Phase 16 operation is human Security Analyst only: new API-only Functions granted to `role.security_analyst` alone (the `function.questionnaire_generation.*` pattern; for example `function.risk_curation.*` and `function.risk_ai_proposals.*`), plus `HUMAN_ANALYST_ONLY_OPERATIONS` as the second refusal, so a later catalogue edit cannot reach automation. AI generation is human-initiated so every run names an accountable analyst (G-3), and withdrawing, reinstating and deciding are human judgements (decision 6: "what a person decided"). Phase 12's extended decision operation keeps its existing human-only Function.
- **D-44:** The analyst service agent keeps its existing risk create and update grants (their future is Phase 22's role review, Phase 12 D-33), but cannot set withdrawal facts (they are not writable fields, so a closed payload with them is a 400), cannot edit a withdrawn risk (D-07), and reaches no Phase 16 operation. Every analyst on the request may withdraw, reinstate, re-run and decide: editing is not exclusive (decision 10), and Phase 13's assignee does not narrow it.

### Interface

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

### Verification and plan shape

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

### Planner's Discretion

- Names of operations, Functions, reason codes, run operations, item kinds and history kinds, within the families above.
- Module placement, for example `apps/backend/src/api/csrm-risk/services/risk-curation.ts` and `risk-history.ts`, `apps/backend/src/csrm/ai/risk-proposals/`, and web `apps/csrm/src/features/risk-curation/` beside Phase 12's `features/ai-assistance/`.
- Exact bounds within the proposed values (proposals per run, context entries, units, history page size, stored value sizes), and the duplicate thresholds.
- Where the open-item fact lives (the assessment's `aiProvenance` amendment is recommended; an equivalent current fact the gate reads directly is acceptable).
- The deterministic providers' rules and wording, within D-50.
- Whether withdraw and reinstate share a plan with the history, and how the AI plans split, provided shared files are serialised.
- Copy, layout and visuals: the UI-SPEC's.

</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #5 Analyst instructions | A bounded instruction slot, logged in the run, never holding Requestor text | D-27 |
| #6 Removing risks | No hard delete; withdrawal with a reason, kept in history and under a "Withdrawn" filter; rejected proposals recorded as rejected; released risks close through the register (Phase 20) | D-05 to D-12, D-16, D-17, D-39 to D-42 |
| #8 Scales and appetite | AI Accept only for Low or Moderate with a rationale; ratings derived | D-25, D-36, D-38 |
| #9 After release | The released record is immutable | D-22, D-29 |
| #10 Pick-up and assignment | Editing is not exclusive | D-44 |
| #11 Exposure | Released risks by default, under assessment separately; withdrawn never count | D-13 |
| #12 Exports | Exports follow the read, so withdrawn risks are excluded | D-14 (seam S-8) |
| #14 Risk Types | Proposed risks draw on the library and may carry no type | D-30, D-50 |
| #17 Review before release | Edits withdraw the review; rejections are not edits | D-12, D-23 |
| G-1 Separation of duties | Human-only operations; the service agent holds no Phase 16 grant | D-43, D-44 |
| G-3 AI data policy | Minimal context, untrusted delimiting, a run per call, refusal above the ceiling | D-25, D-28, D-31 |
| G-4 Premium bar | Keyboard, optimistic feedback, Undo, skeletons, phone layouts, figures that open records | D-11, D-17, D-45 to D-48 |
| G-6 Housekeeping | The orchestrator approves the contract-gap record; Playwright leaves a clean tree | D-01, D-50 |
| G-7 Production infrastructure | Suites stay deterministic; the policy fails closed in production | D-25, D-50 |
| G-11 Nominated risk owners | Owners are those of non-withdrawn risks; the guard takes the actor | D-14, D-22 |
| G-12 Who reads the assessment | Participants read only non-withdrawn risks | D-08, D-14 |
| G-13 Submit and release | Readiness counts only non-withdrawn risks; submission inherits "AI proposals decided" | D-13, D-42 |
| G-14 Accept or Treat | Accept is coherent only without a planned control; an AI Accept stays a recommendation | D-38 |
| G-15 Contest and rework | Decisions and fingerprints cover non-withdrawn risks; the history supports the before-and-after view | D-14, D-20 |

Phase 12's run record and per-field provenance (its D-19 to D-25) are the foundation of D-25, D-33, D-39 and D-41. Approving the hosted provider for production data stays the operator's and does not block this phase.
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and the Approval Checkpoint

**Written first, by the first plan:** `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, in the format of `phase-06.1-revert-audit-facts.md`, `phase-06.8-questionnaire-governance-facts.md` and Phase 12's record (Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, Migration). It covers:
1. **Withdrawal facts** on `CsrmRisk` (D-05 to D-07, D-10): the three attributes, who writes them (only the withdraw and reinstate operations, in their transaction), what reads them (every gate and reader, directly), and reinstatement clearing them while the history keeps both events.
2. **The risk history entity** (D-18 to D-21): attributes and relations, the closed kind and source vocabularies and how later phases extend them, the change envelope, append-only write discipline, retention, read authorisation, and the honest start ("History recorded from {date}" for older risks).
3. **No hard delete** (D-16): the structural guarantee, and that Phase 04's "no Risk delete service" stands.
4. **AI proposal envelopes** (D-03, D-25, D-39 to D-41), as a summary of the dated amendment to `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: the two run operations, run-scoped items and states, decision events, per-field run references, and the open-item fact.
5. **The Phase 04 draft-job amendment** (D-04), as a summary of the dated note in `docs/contract-gaps/phase-04-deterministic-draft-jobs.md`.
6. **Migration:** additive; Strapi schema sync creates the table and columns, `apps/backend/database/migrations/` stays empty (the 06.1, 06.2, 06.7, 06.8 and Phase 12 precedent); proof that a fresh test database boots with them, that legacy risks read as active with no history and no readiness change, that the operator's development database shows them after the orchestrator's next Strapi start, and that the content-type freeze check lists exactly the approved schema files.

**Approval checkpoint:** a `checkpoint:decision` task straight after the record, at which the executor stops. Under G-6 the orchestrator reviews the record and records its approval in the record itself; no schema file, catalogue entry or specification change for these facts runs before that.

No other record is needed: the API changes without a content-type change follow the endpoint chain (D-02).
</contract_gaps>

<authorization>
## Authorisation Model and Negative Cases

**Model.** Keycloak authenticates; Strapi authorises against the resolved IdamBox User in `ctx.state`, identically for the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2).
- **Grant:** every Phase 16 operation sits in a human-analyst-only API Function on `role.security_analyst`, and in `HUMAN_ANALYST_ONLY_OPERATIONS` (D-43).
- **Record scope:** the analyst's assessment review scope (`assertAnalystAssessmentScope`); the risk's ancestry (risk → assessment) resolved server-side; a run's assessment matched to the path for every decision.
- **State:** the one editable guard (D-22) for every mutation and run; the withdrawn-risk guard (D-07) for every risk mutation.
- **AI:** jobs write only the run and the open-item fact; nothing reaches the record without a human decision (D-24, D-39). Navigation visibility is never authorisation: the UI hides controls, Strapi refuses.

**Negative cases, each proved in the API (Strapi integration and the matrix) and the UI (Vitest and Playwright):**
1. **The request's own Requestor** cannot withdraw, reinstate, read risk history, start or read AI proposals, read proposal jobs, or decide proposals: 403 from the grant, persistence deep-equal; the analyst routes show the permission state (Phase 10 D-23).
2. **An unrelated Requestor** gets the same 403s, and the refusal a missing record gets (404) for any risk, control implementation or assessment read, withdrawn or not; nothing reveals that a withdrawn risk exists.
3. **The Requestor's own reads** (released assessment, its risk list, a risk's control implementations, `my_risk_assessments` and its rating summary) never include a withdrawn risk; a direct read of one is 404.
4. **The analyst service agent** is refused every Phase 16 operation (403, human-only); a `PATCH` carrying withdrawal facts is a 400 (closed payload); its existing edits are refused on a withdrawn risk.
5. **Any Security Analyst** is refused, with a closed reason and persistence deep-equal:
   - withdraw, reinstate, re-run or decide on a released or otherwise not editable assessment (`ASSESSMENT_NOT_MUTABLE`);
   - any edit, control implementation change, Phase 12 decision or rewrite on a withdrawn risk (`RISK_WITHDRAWN`);
   - reinstating an active risk (`RISK_NOT_WITHDRAWN`);
   - a stale unit (`AI_PROPOSAL_STALE`), an item no longer open (`AI_PROPOSAL_NOT_OPEN`), an AI Accept on a High or Critical residual rating (`AI_ACCEPT_NOT_PERMITTED`);
   - a batch naming a risk or run of another assessment (404 for the whole batch);
   - generation above the classification ceiling, or with no ceiling outside development (Phase 12's AI policy reasons).
6. **Nobody deletes a persisted risk:** no route serves it, for every actor, and the static guard proves no code path does (D-16).
7. **By extension, later:** a nominated risk owner of the assessment (G-11, Phase 17) and any analyst while an acceptance round is open (ASSESS-24, Phase 17.1) are refused every Phase 16 mutation through the same guard; those phases prove it.
</authorization>

<seams>
## Cross-Phase Seams

- **S-1 Phase 12 (depends on):** the context builder, policy, run record, per-field provenance, decision operation and run read are this phase's foundation (D-25, D-39). Its envelopes gain dated amendments here (D-03). Its "every decision is an edit" is refined for dismissals (D-23).
- **S-2 Phase 13 (planned input):** notes marked "changes the AI inputs" enter both contexts and raise the "New information" notice (D-28); job reads follow its rule for any analyst on the request (D-26).
- **S-3 Phase 14 (planned input):** attachment text opted into the AI context enters both contexts and raises the notice (D-28).
- **S-4 Phase 15 (planned input):** the instruction slot and its validator are reused (D-27).
- **S-5 Phase 17:** nominated owners and the release-for-response gate count only non-withdrawn risks (G-11); participants never read a withdrawn risk (G-12); owner nominations are recorded in this phase's risk history (ASSESS-21 criterion 1); the guard gains G-11's actor rule (D-22); whether analysts may withdraw or re-run during an open response round, and how responses on a later-withdrawn risk show, are Phase 17's to decide; "Reassess residual risk" reuses the field-change proposal mechanism (D-34).
- **S-6 Phase 17.1:** the guard gains ASSESS-24's acceptance-round lock (D-22); decisions, readiness and fingerprints cover non-withdrawn risks (G-13, G-15); withdrawal and reinstatement are edits that withdraw "Mark reviewed" (D-12). Recommended for 17.1: withdrawal voids the risk's decision, and a reinstated risk is decided again, because a risk that left the assessment and came back is not the risk that was decided. 17.1 may also make "no open AI proposals" part of "Mark reviewed"; Phase 16 exposes the count (D-41).
- **S-7 Phase 17.2:** the before-and-after view for deciders reuses this phase's field comparison extension (D-46) and can read the risk history (D-20).
- **S-8 Phase 19 and decision 12:** exports authorise through the same record-read predicate and active-risk rule as the reads, so withdrawn risks never appear in a Requestor's or participant's export; analysts export withdrawn risks only by choosing the "Withdrawn" filter.
- **S-9 Phase 18:** bulk withdrawal reuses the batch operation (D-09); bulk edits and imports record into the same history with a batch source (D-18, D-20), so Phase 18's "risk change history" contract-gap record amends this phase's record rather than adding a store; the table shows withdrawn rows only under the filter; bulk edits honour the acceptance-round lock through the same guard (ASSESS-24).
- **S-10 Phase 20 and decision 6:** released risks close through the register with a reason (not here); registers exclude withdrawn risks (D-13); post-release changes record into the same history (RISK-04 criterion 2).
- **S-11 Phase 17's residual reassessment** adds an operation on the generic field-change proposal mechanism (D-34, D-36, D-37).
- **S-12 Phase 21:** metrics exclude withdrawn risks (D-14); "AI assistance health" and failed runs can read `CsrmAiRun` and this phase's decisions (rejected suggestions, withdrawn AI-proposed risks).
- **S-13 Phase 22:** decision 8's Accept rule stays in `risk-scale.ts` and the AI policy in Phase 12's policy module, one configuration point each (D-38).
- **S-14 G-13's status labels:** "Withdrawn" is a value in the one extensible status mapping (D-46).
- **S-15 The post-demo journey** (`apps/csrm/e2e/risk-owner-journey.spec.ts`): Phase 17 creates it; Phase 16 adds no slice and keeps its own spec (D-50).
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-027 and UAT-028 in full (steps, expected, actual, evidence, recommendation, impact).
- `.planning/uat/product-gaps/JOURNEYS.md`: area 2 F7 rows ("F7 add": the payment-file integrity risk added by hand; "F7 delete, re-run") and the area 4 coverage row (the draft missed payment-file integrity and segregation of duties).
- `.planning/uat/product-gaps/REPORT.md` §3 (F7 status), §7 (delete or withdraw with a reason in the table), §8 (the Phase 16 proposal and its operator decisions) and §9.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F7 and A2.

### Planning authority
- `.planning/ROADMAP.md` Phase 16 (goal, four success criteria, contract line) and Phases 12, 13, 14, 15, 17, 17.1, 17.2, 18, 19, 20 and 22 (their seams), "Next-wave coverage" and "The post-demo journey".
- `.planning/REQUIREMENTS.md`: ASSESS-09 and ASSESS-10; INT-05 and INT-06 (Phase 12's AI foundations); COLLAB-01 criterion 3 and COLLAB-02 criterion 5 (inputs); QUES-11 criterion 4 (the instruction slot); ASSESS-13, ASSESS-16 criterion 4, ASSESS-21 criterion 1, ASSESS-22, ASSESS-24, ASSESS-26, RISK-04 criterion 2 (later phases that build on this one).
- `.planning/NEXT-WAVE-DECISIONS.md`: decisions 5, 6, 8, 9, 10, 11, 12, 14 and 17; G-1, G-3, G-4, G-6, G-7; G-11 to G-15.
- `.planning/POST-DEMO-BRIEF.md` §1 and §2 (overrides and dev-mode rules).
- `.planning/STATE.md` Decisions, and `.planning/milestones/v1.0-STATE.md` Phase 04 ("Treat a linked draft ... as restart discovery and never invoke the provider", "Expose no Risk delete service") and 06.8 D-04 and D-13 (the edit transition).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md` (D-01 to D-39, especially D-04 to D-08, D-10 to D-15, D-19 to D-25, D-32) and `12-RESEARCH.md` ("The run record and provenance", "Envelopes", "The assessment context", "Wire shapes and adapters", "Contract changes", Pitfalls 9, 10, 11 and 17).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md`: D-31 (assessment list counts, which this phase changes), D-35 and D-44 (Risk Register filters), D-40 to D-43 (exposure and where its rule lives).
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`: D-02, D-12 (navigation guard), D-22 (closed reasons), D-23 (analyst route gates), D-25 to D-27 (jobs), D-28 to D-35 (the editor this phase extends), D-41 (recorded extensions); plans 10-06 (conflict reasons) and 10-13 (generation jobs).

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §8 (risk content), §19 (AI architecture: provenance, review state, human modifications, audit history; untrusted content) and §20 (record gaps rather than competing models).
- `docs/references/idambox-datamodel.jdl`: `CsrmRisk` (no status; `closureDate`, `treatmentAction`, `treatmentStatus`), `CsrmControlImplementation`, `CsrmAssessment`, `CsrmTreatmentAction`.
- `CONTEXT.md` (repository root): the glossary (Risk owner, Accept and Treat, Contest point, Released); a plan adds "Withdrawn (Risk)".

### Contract, authorisation and records
- `docs/references/specification.json`: `RiskSummary`, `AnalystRiskDetail`, `AnalystAssessmentDetail`, `RequestorReleasedAssessmentDetail`, `ReleaseReadiness*`, `RiskRegister*`, `RiskDetail*`, `AssessmentWorkflowErrorResponse`, the draft job schemas, and the generic `/csrm-risks` paths.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: byte-identical copies; `function.questionnaire_generation.*` is the human-only pattern; `function.risk_assessments.risk_assessment_details.api.05` (`regenerate_draft`) and `function.risk_register.risk_details.api.05` (`close`) stay unserved; design notes 6 and 9.
- `docs/references/served-operations.json`: the unserved `regenerate_draft` and `close` entries and the spec-only `/api/csrm-risks` routes.
- `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `phase-06.8-questionnaire-governance-facts.md` (the record format and the fact-plus-log split); `phase-04-deterministic-draft-jobs.md` and `phase-04-composite-release-fact.md` (the contracts this phase amends or keeps); `phase-07-derived-insights.md` (the insight readers' predicates); Phase 12's `phase-12-ai-run-record-and-provenance.md` once written.
- `docs/security/phase-08-residual-risks.md`: R-08-34 (route budget) and R-08-36 (volatile jobs).
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/backend/tests/served-operations.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: every UI value; Tags and chips, Forms (segmented control), Dialogs, Toasts, Skeletons, Empty states, Record links, Motion and the optimistic-UI rule.
- The recorded extensions X-1 to X-10 in Phases 10 and 11's UI-SPECs, and Phase 12's UI-SPEC (being written) for the AI marker and citation chip.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch; one response carries data and UI), `01-app/02-guides/lazy-loading.md` (`next/dynamic` from Client Components).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts`: `withMutableAssessmentMutation` (serialisation, row lock, editable check, edit transition), `assertMutableAssessment` (the predicate D-22 names), `transitionForAcceptedEdit`, `validateReleaseReadiness` and `projectReleaseReadiness` (the readiness vocabulary D-42 extends), `assessmentReleasePopulate`, `persistAssessmentDraft` (where D-19's `created` entries for drafted risks are written).
- `apps/backend/src/api/csrm-risk/services/risk-workflow.ts`: `createAssessmentRisk`, `updateRisk`, `resolveRelations` (active-user check for owners), `loadAnalystAssessmentRiskDetails`, `listAssessmentRiskDocuments`; the history writes and the withdrawn guard join these.
- `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts`: create, update and the existing hard delete, all inside the mutation guard; history entries join each.
- `apps/backend/src/api/csrm-risk/services/risk-register.ts`: `applyDisclosableParent` and the register's `state` filter; with Phase 11's stage predicates, the one place D-13's SQL form joins.
- `apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts`, `alert-repository.ts`, `dashboard-summary.ts`: the "open contextual Risk" predicate (`applyDisclosableParent` plus `closure_date IS NULL`), repeated in each, which D-13 extends through the shared rule.
- `apps/backend/src/api/csrm-assessment-request/services/revert-reason.ts`: the 1 to 500 character reason parser D-06 reuses.
- `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts`: the volatile job registry pattern (single flight, four states, bounded terminal retention) D-26 follows.
- Phase 12's planned modules: `apps/backend/src/csrm/risk-scale.ts` (`deriveRating`, `acceptProposalAllowed`), `apps/backend/src/csrm/ai/` (context builder, policy, ranker `library-ranking.ts`, prompt sections), `apps/backend/src/api/csrm-ai-run/` (run record), `apps/backend/src/api/csrm-assessment/services/ai-provenance.ts`, and the web `apps/csrm/src/features/ai-assistance/` (markers, citations, suggestions, disclosure).
- Phase 10's planned modules: `apps/backend/src/csrm/conflict-reasons.ts` and `apps/csrm/src/lib/api/conflict-reasons.ts` with `refusal-copy.ts`, the shared record picker, `save-status.tsx`, the navigation guard, `formatInstant` and `LocalInstant`.
- Web: `apps/csrm/src/components/csrm/confirm-dialog.tsx` (reason fields), `status-badge.tsx` (`statusPresentation`), `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx` (the timeline presentation the history reuses), `assessment-draft-job.tsx` (the job panel pattern), `apps/csrm/src/components/states/states.tsx`.

### Established Patterns
- Every risk and control implementation mutation runs inside `withMutableAssessmentMutation`; a released assessment refuses all of them (Phase 04: "After release, the entire assessment aggregate is immutable").
- Current fact plus append-only history (06.8, Phase 12 D-21): gates read the fact, the log narrates.
- Human-analyst-only operations: API-only Functions for `role.security_analyst` plus `HUMAN_ANALYST_ONLY_OPERATIONS`.
- Closed payloads (`assertPayload`): unknown keys are a 400, so server-owned facts cannot be written through the generic update.
- Denials keep persistence deep-equal; an unauthorised assessment or risk read is 404 (08 D-16).
- Model-friendly wire shape, an adapter that assigns server-owned values, and a closed context-aware parser as the gate (06.7 D-14, Phase 12 D-15); deterministic providers are the test default.
- Zod-free `*-domain.ts` modules for client components; typed openapi-fetch services and Server Actions that revalidate; batch Server Actions because Next 16.3 dispatches actions one at a time.

### Integration Points
- **Strapi:** the risk routes and controller (`apps/backend/src/api/csrm-risk/routes/csrm-risk.ts`, `operations.ts`, `controllers/csrm-risk.ts`) for the history read; the assessment routes and controller (`apps/backend/src/api/csrm-assessment/`) for withdraw, reinstate, suggestions, the proposals read and the job routes; `assessment-scope.ts` projections (`projectAnalystRiskDetail`, `projectRiskSummary`, the Requestor and released queries); `risk-register.ts` and the three insight repositories; `csrm-authorization.ts`; the catalogue seed reconciliation (`apps/backend/src/bootstrap/seed-csrm-data.ts`); the analyst-insight and risk-register seeds, whose expectations change with D-13.
- **Web:** `assessment-editor.tsx` (Identified Risks, readiness card, add risk), `risk-editor.tsx` (create mode gains Discard), `control-implementation-editor.tsx`, `released-assessment.tsx`, `assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `assessment-domain.ts` (readiness presentation); the Risk Register's `risk-register-filters.tsx`, `risk-detail-editor.tsx`, `risk-details.tsx`, `risk-schema.ts`, `risk-service.ts`; the review assessment page loader under `apps/csrm/app/(app)/app/review/assessments/`.
</code_context>

<specifics>
## Specific Ideas

- **UAT-A as the yardstick.** A Project request for a payroll SaaS whose answers describe unsigned payment files reconciled by hand, partial segregation of duties and an untested pay-run fallback. The draft gave three risks, one per seeded type, and missed payment-file integrity and segregation of duties; the analyst added the payment-file risk by hand in about 25 fields (JOURNEYS.md area 2). With Phase 16, "Suggest more risks" proposes the payment-file integrity risk (citing the payment-file answer, on the request's payroll system, with no Risk Type if none fits) and repeats none of the three; adding it is one click, then its fields are reviewed like any drafted risk.
- **A withdrawal the third line can follow.** UAT-C's API-key risk was forced into "Internet Exposure". Withdrawn "Proposed under the wrong Risk Type; replaced by the rewritten risk", it stays under "Withdrawn" with its reason, actor, time and AI provenance, and its history shows it was AI-drafted, withdrawn, and never released.
- **Rewrite in practice.** "Rewrite this risk: make it specific to unsigned payment files" on a generic integrity risk proposes a sharper statement, cause and impact with citations, and a residual rating unit; the analyst accepts the statement and cause, rejects the rating unit, and the history shows the two accepted fields with their old and new values and the rewrite run.
- **Development database.** The schema change, the catalogue Functions and the seeds' new expectations reach the operator's development database only when the orchestrator restarts Strapi; tests use their own databases. Existing risks (UAT-A, UAT-B, UAT-C and the seeds) read as active, with history from Phase 16 on.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

---

*Phase: 16-risk-curation-and-targeted-ai-re-runs*
*Context gathered: 2026-10-01*

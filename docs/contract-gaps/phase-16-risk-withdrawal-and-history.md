# Phase 16: Risk Withdrawal and History

## Gap

UAT-027 asked for a way to take a wrong Risk out of an assessment, and UAT-028 for a way to ask the AI to rewrite one Risk or propose the ones the draft missed. Decision 6 settles the first: no persisted Risk is ever deleted; a Security Analyst withdraws it with a reason, it is kept in history and under a "Withdrawn" filter, and a rejected AI proposal is recorded as rejected. Decision 9 keeps the released record immutable, and G-15 needs a before-and-after history that deciders can read.

The frozen CSRM JDL (`docs/references/idambox-datamodel.jdl`) supports none of this. Two facts are missing:

1. **No withdrawal fact.** `CsrmRisk` has no lifecycle status. Its `closureDate` belongs to the closure of released risks (Phase 20, decision 6) and its `treatmentStatus` to treatment, so neither can mean "taken out of the assessment" without overloading a JDL term, and a new status attribute would compete with both.
2. **No Risk history.** The JDL has no history or audit entity. The Phase 06.1 record deferred "a full event-history model ... pending a future domain-model decision", and the Phase 06.8 record deferred "a cross-aggregate audit trail spanning requests, assessments, and risks" to the same decision. Decisions 6 and 9 and G-15 are that decision for Risks. The catalogue's design note 6 already says audit history needs a model extension.

A JSON log on `CsrmRisk`, the 06.8 pattern, is rejected for the reasons Phase 12 rejected it for the run record: it grows every Risk read, contends with Phase 18's batch edits and Phase 20's years of treatment updates, and leaves Phase 21 scanning JSON. The AI proposals need no schema change: they live in Phase 12's `CsrmAiRun` and `aiProvenance` JSON attributes, whose envelopes this phase extends by the dated amendment to the Phase 12 record (see "AI Risk Proposals (summary)").

## Compatibility Extension

This record proposes exactly two content-type changes (16-CONTEXT D-01). Nothing else changes schema.

**1. Withdrawal facts on `CsrmRisk`** (`api::csrm-risk.csrm-risk`): three optional attributes in the 06.1 and 06.8 audit-fact shape.

| Attribute | Strapi type | Column | Meaning |
| --- | --- | --- | --- |
| `withdrawnAt` | datetime, optional | `withdrawn_at` | Server-owned time of the current withdrawal. Set means withdrawn; null means active. |
| `withdrawnBy` | relation, manyToOne `api::idambox-user.idambox-user`, unidirectional (no `inversedBy`) | link table `csrm_risks_withdrawn_by_lnk` | The human Security Analyst who withdrew the Risk. |
| `withdrawalReason` | text, optional | `withdrawal_reason` | The trimmed reason given for the current withdrawal, 1 to 500 characters. |

Each attribute is optional, so every Risk created before this extension stays valid and reads as active.

**2. The Risk history entity** `api::csrm-risk-history-event.csrm-risk-history-event`, collection `csrm_risk_history_events`, `draftAndPublish: false`, with a core router that mounts nothing (`only: []`, the `csrm-risk-type` folder shape):

```jdl
entity CsrmRiskHistoryEvent {
  kind String required maxlength(64),
  occurredAt Instant required,
  sourceKind String required maxlength(32),
  proposalItem String maxlength(64),
  batchId String maxlength(64),
  reason TextBlob,
  undo Boolean,
  changes AnyBlob
}

relationship ManyToOne {
  CsrmRiskHistoryEvent{actor} to IdamBoxUser,
  CsrmRiskHistoryEvent{assessment} to CsrmAssessment,
  CsrmRiskHistoryEvent{risk} to CsrmRisk,
  CsrmRiskHistoryEvent{aiRun} to CsrmAiRun
}
```

| Attribute | Strapi type | Meaning and bound |
| --- | --- | --- |
| `kind` | string, required, at most 64 characters | The closed history kind (see "Risk History"). |
| `occurredAt` | datetime, required | The server's time, in the transaction of the change. |
| `actor` | relation, manyToOne `api::idambox-user.idambox-user`, unidirectional | The human Security Analyst who made the change. |
| `assessment` | relation, manyToOne `api::csrm-assessment.csrm-assessment`, unidirectional | The Risk's assessment; always set in this phase. |
| `risk` | relation, manyToOne `api::csrm-risk.csrm-risk`, unidirectional | The Risk changed; always set in this phase. |
| `sourceKind` | string, required, at most 32 characters | How the change was made (see "Risk History"). |
| `aiRun` | relation, manyToOne `api::csrm-ai-run.csrm-ai-run`, unidirectional, optional | The AI run whose confirmed proposal made the change. |
| `proposalItem` | string, at most 64 characters, optional | The run's proposal item key (`s-1` to `s-8`, `u-{unit}`). |
| `batchId` | string, at most 64 characters, optional | Reserved for later batch sources (Phase 18). |
| `reason` | text, optional | The reason of a withdrawal or reinstatement. |
| `undo` | boolean, default false | True when the event reverses the previous withdrawal or reinstatement through Undo, or, on an `updated` row with source `ai-run`, the Undo of a confirmed AI rewrite change (Phase 16 execution amendment, 2026-10-16). |
| `changes` | json | The change envelope v1 (see "Risk History"). |

Every relation is unidirectional, so `CsrmRisk`, `CsrmAssessment`, `IdamBoxUser` and `CsrmAiRun` gain no inverse attribute and no other schema file changes. `withdrawnBy` is unidirectional for the same reason.

## Withdrawal Facts

Withdrawal is a current fact on the Risk, not a status (D-05). A Risk is withdrawn exactly when `withdrawnAt` is set; `withdrawnBy` and `withdrawalReason` complete the fact.

- **Who writes them.** Only the withdraw and reinstate operations ("Operations, Functions and Reasons"), in their own transaction, together with the history row that records the change. No generic or Risk update path accepts them: the Risk update payload is closed, so a `PATCH /api/v1/risks/{riskId}` carrying any of the three is a 400, for every actor, the Security Analyst Agent included (D-44).
- **What a withdrawn Risk keeps.** Its `riskNumber` (numbers are never reused), every field, its control implementations and its AI provenance, unchanged (D-06).
- **A withdrawn Risk is read-only** (D-07). Strapi refuses with 409 `RISK_WITHDRAWN` every mutation that targets it: `PATCH /api/v1/risks/{riskId}` (from the assessment editor and from the Risk Register detail), control implementation create, update and delete, Phase 12's AI proposal decisions on its fields or suggested controls, Phase 16's decisions on its rewrite units, and "Rewrite this risk". Reinstating it is the way to change it.
- **Reinstatement** clears the three facts in one write. The history keeps both events, the withdrawal and the reinstatement, each with its reason, actor and time: the current fact is cleared and the log keeps it, the split the 06.8 record makes between the release facts and `governanceLog`.
- **Gates read the facts directly, never the history.** Every gate and reader that needs to know whether a Risk is withdrawn reads `withdrawnAt`, following 06.8 ("an access-control decision must not depend on parsing a mutable JSON array"). The history is narrative only and is never consulted for an authorisation, readiness or visibility decision.

## Risk History

**One row per change** to a Risk or to one of its control implementations, made on the analyst paths from Phase 16 on, written in the same transaction as the change (D-18, D-19).

**Kinds** (closed in code and in the API contract; later phases extend the list by amendment to this record):

| Kind | Written when |
| --- | --- |
| `created` | An analyst adds a Risk ("Add risk"), draft generation creates one (Phase 12's `persistAssessmentDraft`, source the draft run), or an analyst adds a proposed Risk from a `risk-suggestions` run ("Add to assessment", source that run and item). |
| `updated` | A Risk update changes at least one value, or a confirmed rewrite unit is applied or restored (source the rewrite run and item). |
| `withdrawn` | The withdraw operation withdraws the Risk, with its reason. |
| `reinstated` | The reinstate operation reinstates the Risk, with its reason. |
| `control-implementation-added` | A control implementation is created on the Risk. |
| `control-implementation-updated` | A control implementation of the Risk changes at least one value. |
| `control-implementation-removed` | A control implementation of the Risk is removed (the existing hard delete); the row keeps the removed values. |

**Sources** (closed): `analyst` (a hand edit, a withdrawal or a reinstatement) and `ai-run` (a confirmed AI proposal; `aiRun` and `proposalItem` are set). `import`, `bulk` and `response` are reserved for later amendments (Phases 18 and 17); `batchId` is reserved with them.

**The change envelope v1** in `changes`, parsed closed:

```text
{
  schemaVersion: 1,
  fields: [{ field, from, to }],                         // at most 40
  control?: { documentId, controlNumber, name }          // the three control-implementation kinds only
}
```

- Scalar values are recorded as stored. A relation value is `{ documentId, label }`, with the label it had at the time, so the entry still reads after the related record is renamed or gone. Text values are stored whole: the history is the audit trail, and a truncated value would falsify it.
- An `updated` row lists only the fields that changed after the update path's own normalisation (the trimming and relation resolution the Risk update applies), so a value sent unchanged is not a change. A change of nothing writes no row.
- A `created` row lists each field the Risk was created with that holds a value, each with `from: null`. A `control-implementation-added` row lists the implementation's values with `from: null`, a `-updated` row the fields that changed, and a `-removed` row the values the implementation held, each with `to: null`, so the record survives its removal.
- A `withdrawn` or `reinstated` row carries `fields: []`: what changed is the withdrawal fact, recorded by the row's kind, actor, time, `reason` and `undo`.

**Append-only.** No row is ever updated or deleted, by any route or code path. Rows follow the retention of the assessment record they belong to.

**The read.** `GET /api/v1/risks/{riskId}/history` serves a Risk's history to human Security Analysts only in this phase (D-21), newest first, with the record-level check through the Risk's assessment (`assertAnalystAssessmentScope`); an unknown Risk, or one outside the analyst's scope, is 404 with no enumeration. It serves a withdrawn Risk's history too, and a released assessment's. A row whose `changes` does not parse is served with its kind, time and actor and `changes: null`, rather than failing the read (the 06.8 posture). Participant access to history is Phases 17 and 17.2's to decide (G-12, G-15).

**The honest start.** The read's `meta.recordedFrom` is the earliest event's `occurredAt` for the Risk, or null when it has none. A Risk created before Phase 16 has no `created` row, so its history begins with its first recorded change and the interface says "History recorded from {date}" (X-29). No history is backfilled or inferred.

**Later phases add kinds and sources by amendment** to this record, with no new history entity (seam S-9): Phase 17's owner nominations, Phase 18's bulk edits and imports with a `batchId`, Phase 20's post-release changes.

## No Hard Delete

No persisted Risk is ever deleted, by any route or code path (decision 6; D-16). Phase 04's "Expose no Risk delete service, action, input, or result" stands; decision 6 reaffirms it.

- **No route serves a Risk delete.** `DELETE /api/v1/risks/{riskId}` is not mounted, and the generic `/api/csrm-risks/{id}` routes stay spec-only (listed under spec-only routes in `docs/references/served-operations.json`). The authorisation matrix probes both with the same refusal for every actor.
- **A static test** proves that no Strapi source calls a delete on `api::csrm-risk.csrm-risk` or on `api::csrm-risk-history-event.csrm-risk-history-event`, and that no cascade from a request or assessment deletion reaches a Risk.
- **An unsaved Risk** is discarded in the browser only (D-17): "Discard new risk" removes the unsaved form, with an Undo that restores what was typed from client state. Nothing is written, so nothing is recorded.
- **Request deletion** (Orchestrator Confirmation "Request deletion", decision 6). Strapi refuses to delete an Assessment Request once it has a Risk Assessment, with 409 `REQUEST_HAS_ASSESSMENT`, so no assessment or Risk is lost through its request. The check runs under the request lock, before Phase 13's `REQUEST_HAS_NOTES` and Phase 14's `REQUEST_HAS_ATTACHMENTS`. A request without an assessment keeps today's delete rule. The web offers no request delete control (16-UI-SPEC UI-D34), so the reason gets refusal copy only.

"Risk withdraw and delete" in the ROADMAP's contract line therefore means withdrawal plus this proof, with no delete operation.

## Operations, Functions and Reasons

Every operation is human Security Analyst only (D-43): an API-only Function granted to `role.security_analyst` alone, never to `role.security_analyst_agent` or `role.requestor`, and the operation joins `HUMAN_ANALYST_ONLY_OPERATIONS` as the second refusal. Both catalogue copies stay byte-identical.

| Operation | Body and response | Function and FunctionApi |
| --- | --- | --- |
| `POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals` | `{ riskIds, reason }` or `{ riskIds, undo: true }`; 200 `{ data: { applied: string[], unchanged: string[] } }` | `function.risk_curation.withdraw_api`, `.api.01` |
| `POST /api/v1/risk_assessments/{assessmentId}/risk_reinstatements` | the same two bodies and response | `function.risk_curation.withdraw_api`, `.api.02` |
| `GET /api/v1/risks/{riskId}/history?page&pageSize` | `{ data: RiskHistoryEvent[], meta: { pagination, recordedFrom } }`; page size 25 by default, at most 100; newest first | `function.risk_curation.history_read_api`, `.api.01` |
| `POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions` | `{ instruction? }`; 202 with a risk proposal job | `function.risk_ai_proposals.propose_api`, `.api.01` |
| `POST /api/v1/risks/{riskId}/rewrite` | `{ instruction?, focus? }`, `focus` a non-empty unique subset of `statement`, `ratings` and `treatment` (absent means all three); 202 with a risk proposal job | `function.risk_ai_proposals.propose_api`, `.api.02` |
| `GET /api/v1/risk_proposal_jobs/{jobId}` | the job | `function.risk_ai_proposals.job_read_api`, `.api.01` |
| `POST /api/v1/risk_proposal_jobs/{jobId}/retry` | the job, queued again | `function.risk_ai_proposals.retry_api`, `.api.01` |
| `GET /api/v1/risk_assessments/{assessmentId}/ai_proposals` | the assessment's open and recently decided risk proposals with their run facts | `function.risk_ai_proposals.proposals_read_api`, `.api.01` |
| Phase 12's `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` | gains the entry `{ target: { kind: "proposal", runId, item }, action: "accept" \| "reject" \| "restore", reason? }` | Phase 12's `function.ai_proposals.decide_api`, unchanged |

**The curation body.** `riskIds` holds 1 to 200 unique documentIds, each 1 to 255 characters; a repeated id is a 400, never silently merged. `reason` is trimmed and 1 to 500 characters, through the same parser as the revert reasons (`REVERT_REASON_MAX_LENGTH`). The body is closed: exactly one of `reason` or `undo: true`, and `undo` accepts only `true`.

**The closed `undo: true` flag** (D-11, UI-D7; Orchestrator Confirmation "UI-SPEC points settled"):

- On reinstatements, `undo: true` reinstates with the fixed reason `Withdrawal undone`. It is what the withdrawal's Undo toast sends.
- On withdrawals, `undo: true` withdraws again with the reason of the Risk's most recent `withdrawn` history event, the reason it held before the reinstatement. It is what the reinstatement's Undo toast sends. A Risk with no `withdrawn` event to take that reason from is refused as invalid (400), because no reinstatement of it can be undone.
- Both write their history row with `undo: true`. A typed reason never marks an undo, whatever its words (16-RESEARCH Pitfall 5), so an analyst who types "Withdrawal undone" records an ordinary reinstatement.

**Batch rules** (D-09, D-10). Each batch runs in one transaction under the assessment's serialisation and the editable guard.

- A risk id that does not belong to the path's assessment, or does not exist, fails the whole batch with 404 and leaves persistence deep-equal, without saying which id failed.
- Withdrawing an already withdrawn Risk reports it in `unchanged` and writes no history row.
- Reinstating refuses with 409 `RISK_NOT_WITHDRAWN` when every named Risk is active. A mixed batch reinstates the withdrawn ones and reports the active ones as `unchanged`.
- A batch whose `applied` is empty changes nothing and takes no edit transition, so re-sending an applied withdrawal never withdraws a review (16-RESEARCH Pitfall 4).
- Withdrawing the last active Risk is allowed; release readiness then shows "At least one Risk" as outstanding (D-12).
- Withdrawing a Risk supersedes every open unit of a `risk-rewrite` run on it, `by` the withdrawing analyst (the Phase 12 amendment, "Decisions and item states").

**Who may act** (D-44; Orchestrator Confirmation "UI-SPEC points settled"). Every human Security Analyst in the assessment's review scope may withdraw, reinstate and read history; editing is not exclusive (decision 10), and Phase 13's assignee does not narrow it. A Security Analyst who raised the request (G-1; Phase 15 D-32) keeps withdrawing, reinstating and reading history, but takes no targeted AI action on it: the two start operations, the job read and retry, the proposals read and every decision on a `proposal` target refuse with 403 `OWN_REQUEST`.

**Closed reasons.** Four new reasons join Strapi's `CONFLICT_REASONS` (`apps/backend/src/csrm/conflict-reasons.ts`), both conflict response schemas of `docs/references/specification.json` (`AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`) and the web's list:

- 409 `RISK_WITHDRAWN`: a mutation, decision or rewrite targets a withdrawn Risk.
- 409 `RISK_NOT_WITHDRAWN`: every Risk a reinstatement names is active.
- 409 `AI_ACCEPT_NOT_PERMITTED`: confirming an AI-proposed Accept treatment action would leave the Risk's residual rating, after the units confirmed in the same batch, High or Critical (D-38; `acceptProposalAllowed` in `apps/backend/src/csrm/risk-scale.ts`).
- 409 `REQUEST_HAS_ASSESSMENT`: the request delete names a request that has a Risk Assessment.

Reused, already in the list: `ASSESSMENT_NOT_MUTABLE` (the editable guard); `AI_PROPOSAL_ALREADY_DECIDED`, the one "no longer open" code, covering decided, superseded and lapsed items (no `AI_PROPOSAL_NOT_OPEN` is added; Orchestrator Confirmation "One reason code"); `AI_PROPOSAL_STALE`; `AI_PROPOSAL_UNDO_UNAVAILABLE`; `AI_PROPOSAL_RUN_LIMIT`; `AI_ACCEPT_WITH_PLANNED_CONTROL` with Phase 12's `riskHasPlannedControl`, with no second reason or predicate (Orchestrator Confirmation "Phase 12's planned-control rule is reused"); 403 `OWN_REQUEST`; Phase 15's three instruction reasons (400 `INSTRUCTION_TOO_LONG`, `INSTRUCTION_CHARACTERS_NOT_ALLOWED`, `INSTRUCTION_REPEATS_REQUESTOR_TEXT`); and the AI policy reasons `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED`.

**Unserved intents stay unserved.** The catalogue's `regenerate_draft` (`function.risk_assessments.risk_assessment_details.api.05`) stays unserved, with its `served-operations.json` reason naming `risk-suggestions` and `risk-rewrite` (D-24); the register's `close` intent stays Phase 20's.

## Write Discipline

- **One transaction per change.** The withdrawal facts, the history row and, for a confirmed proposal, the run's decision event and the Risk's per-field provenance are written in the transaction of the change they document, under the assessment's existing serialisation and row lock. A failed change leaves no history row, and a successful one always has its row (16-RESEARCH Pitfall 7).
- **Inner functions inside one mutation.** Every Risk and control implementation path that writes history runs inside the one mutation wrapper, through transaction-scoped inner functions, so a decision batch never re-enters the serialisation it already holds (16-RESEARCH Pitfall 1).
- **Server-owned.** The withdrawal facts and every history attribute are server-owned. No generic content-API route reaches the history (its core router mounts nothing), and no client-supplied value becomes an actor, time, kind, source, run or reason other than the reason the operation validates.
- **Append-only.** No code path updates, reorders or deletes a history row.
- **Closed reads.** The change envelope is parsed closed and versioned on read, and a malformed envelope projects as null without failing the read.

## Readers and the Active-Risk Rule

**One rule** decides which Risks count (D-13): a Risk is active exactly when `withdrawnAt` is null. It is defined once in each of the three forms its readers need, in one module, and every reader uses it rather than restating it:

- **an in-memory predicate** over loaded Risks, used by release readiness and the release path (`validateReleaseReadiness`, `projectReleaseReadiness`, the transition's pre-edit readiness), Phase 12's "AI proposals reviewed" requirement, the request relationship counts, the proposal contexts and the overall-rating hint;
- **a document filter** for every `strapi.documents("api::csrm-risk.csrm-risk")` read that lists or counts an assessment's Risks;
- **a SQL fragment** beside `applyDisclosableParent` and Phase 11's stage predicates in `apps/backend/src/api/csrm-risk/services/risk-register.ts`, so the Risk Register, the dashboard summary, the alerts and the reports inherit it.

**The readers that change** (16-RESEARCH "The active-risk rule: the complete reader inventory"):

| Reader | Phase 16 |
| --- | --- |
| Release readiness, the release path and the pre-edit transition readiness | Active Risks only; a withdrawn incomplete Risk never blocks release |
| The analyst assessment detail | Lists every Risk, each with its `withdrawal` block (null when active); readiness over active Risks only |
| `GET /api/v1/risk_assessments/{assessmentId}/risks` | Active Risks only |
| A Risk's control implementations | 404 for the Requestor when the Risk is withdrawn; analysts read them, read-only |
| The request relationship counts (both actors) | Active Risks only |
| `GET /api/v1/my_risk_assessments`, its risk count and highest residual rating | Active Risks only |
| The analyst assessment list's risk count and highest residual rating | Active Risks only |
| The Requestor's released assessment detail | Active Risks only |
| The Risk Register list | The default view and the `open` and `closed` state values exclude withdrawn Risks; the `withdrawn` value selects them only |
| The Risk Register detail | Adds `withdrawal`; the update path refuses with `RISK_WITHDRAWN` |
| The dashboard, alert, report and exposure figures | Active Risks only |

A static test lists every Strapi source that queries `csrm_risks` or lists `api::csrm-risk.csrm-risk` documents and fails on one that neither applies the rule nor is on a reviewed exempt list (the curation service, the history read, the register's `withdrawn` branch), so a forgotten reader fails a test (16-RESEARCH Pitfall 3).

**Requestors and participants never learn that a withdrawn Risk exists** (D-08; G-12). Their assessment, Risk and control implementation reads exclude it, their counts and rating summaries omit it, and a direct read of a withdrawn Risk returns the refusal a missing record gets (404). A withdrawn Risk is second-line working material and is not part of what the assessment communicates.

**Later phases read the same rule** (D-14): Phase 17's nominated owners and its release-for-response gate (G-11), its participant read (G-12), Phase 17.1's decisions, readiness and fingerprints (G-13), Phase 18's table, Phase 19's exports (which authorise through the same record-read predicate), Phase 20's registers and Phase 21's metrics.

## The Editable Guard

**One exported predicate** decides whether an assessment can be changed by this actor now (D-22). It takes the actor as well as the assessment and today wraps the existing `assertMutableAssessment` rule (not released, status `draft` or `in-review`, no release facts), refusing with 409 `ASSESSMENT_NOT_MUTABLE`. It sits behind `withMutableAssessmentMutation`, and every Phase 16 entry point passes it:

- withdraw and reinstate, inside the mutation transaction;
- the enqueue of both AI operations, as a read-only check before a job is queued;
- job execution, re-checked before the provider is called, so no run starts on an assessment that stopped being editable (the job fails with `ASSESSMENT_NOT_MUTABLE` and creates no run);
- run completion, which records the items as lapsed instead of open when the assessment stopped being editable while the job ran;
- every proposal decision, confirm, reject and restore alike.

Phase 17 adds G-11's rule (a nominated risk owner is refused every analyst mutation of that assessment) and Phase 17.1 adds ASSESS-24's lock (every analyst edit refused while an acceptance round is open) to this one predicate, and every Phase 16 mutation inherits both without change.

**The guard is separate from the edit transition** (D-23). Changes to the assessment's content or to a field's review state take the accepted-edit transition (`transitionForAcceptedEdit`, 06.8 D-13): a withdrawal, a reinstatement, adding a proposed Risk, confirming a rewrite unit and restoring a confirmed unit. Rejecting a proposal, restoring a rejected one, Phase 12's dismissal of a suggested control and its restore, and writing a run's completion change no content: they take the serialisation and the guard but not the transition, so they never withdraw a review. The wrapper keeps its `transition` option, a value or a function of the mutation's result, so a curation batch passes `none` when nothing was applied.

## AI Risk Proposals (summary)

The AI proposals need no content-type change. They are recorded by the dated amendment to the Phase 12 record, `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, "Phase 16 amendment (2026-10-01): risk proposals, decisions and per-field run references", reviewed at the same checkpoint. In summary:

- **Two run operations**: `risk-suggestions` (assessment-wide; context-wide for Phase 13's signal) and `risk-rewrite` (one Risk; sets the run's `risk` relation; never context-wide).
- **One proposal model, Phase 15's**: an immutable proposal (the risk proposal envelope v1), Phase 15's decision event v2 with Risk payloads and two new cause kinds, and item states folded from the decisions. Phase 16 stores no `itemStates` and no `openProposals` counter; the open set of an assessment is derived on each read.
- **Per-field run references**: each per-field fact in a Risk's `aiProvenance` written from Phase 16 on names the run that proposed it, because one Risk can now hold fields from a draft and several rewrites.
- **Release readiness** gains the assessment-scope requirement `aiProposalsDecided` (`Decisions on AI proposals`, destination `ai-proposals`), outstanding while any risk proposal item of the assessment is open. It protects no access, so it fails open on a damaged run.
- **The context summary v5** adds a `riskProposals` section.

The assessment's "AI inputs changed" baseline moves under the dated amendment to the Phase 13 notes record, `docs/contract-gaps/phase-13-request-notes.md`, "Phase 16 amendment (2026-10-15): the assessment's AI-inputs baseline".

## Phase 04 Draft-Job Amendment (summary)

`docs/contract-gaps/phase-04-deterministic-draft-jobs.md` gains "Phase 16 amendment (2026-10-01): targeted proposal operations" (D-04). An assessment linked to its draft may invoke the provider again, but only through `risk-suggestions` and `risk-rewrite`, which write proposals into a run and never replace the assessment or any Risk. The draft job keeps single flight, "completed jobs are terminal" and restart discovery of a linked draft, and `regenerate_draft` stays unserved.

## What This Extension Does Not Add

- **No status field** on `CsrmRisk`, and no new value in an existing enumeration (`treatmentStatus` and `closureDate` keep their JDL meanings).
- **No delete operation** for a Risk or a history row, and no cascade that reaches either.
- **No `itemStates`** stored on a run, **no `openProposals` counter** on the assessment, and **no second proposal model**: risk proposals use Phase 15's item core, decision event v2 and fold.
- **No participant history access**: Phases 17 and 17.2 decide it (G-12, G-15).
- **No soft removal of control implementations**: their removal stays the existing hard delete, now recorded in the Risk history with the removed values.
- **No unscoped history endpoint** and no cross-aggregate audit store: the history is scoped to one Risk and read through that Risk's assessment scope.
- **No inverse attribute** on `CsrmRisk`, `CsrmAssessment`, `CsrmAssessmentRequest`, `IdamBoxUser` or `CsrmAiRun`.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams", "The shared backend"). On 2026-10-15 that section's workstream table lists two workstreams: `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmRisk`, `CsrmAssessment`, `CsrmAssessmentRequest` and `CsrmAiRun` and the only caller of the endpoints below; and `iam`, a platform workstream with no application (the midPoint identity engine and Strapi SCIM).

`iam` reads none of the changed types or endpoints. On 2026-10-15, `grep -rlE "csrm-risk|CsrmRisk|risk_assessments|assessment_requests|csrm-assessment-request|AiRun|ai_runs|ai_proposal|/v1/risks|REQUEST_HAS|aiInputsChanged|contextSummary" .planning/workstreams/iam/` printed nothing (exit status 1). The `iam` workstream's only backend references are `/api/v1/info` and the `idambox-user` content type's schema (SCIM), and neither changes: `withdrawnBy` and the history's relations are unidirectional, so `IdamBoxUser` gains no attribute.

This extension is backward compatible for any later reader:

- the new table and the three columns carry only unidirectional relations, and the history has no core router, so no existing read, `populate` (including `populate=*`) or generated populate enum reaches them, and no inverse attribute is added to `CsrmAssessment`, `CsrmAssessmentRequest`, `IdamBoxUser` or `CsrmAiRun`;
- the new Functions go to `role.security_analyst` only, never to `role.security_analyst_agent` or `role.requestor`, and no existing grant changes.

Phase 16 changes these existing endpoints and shapes. Each is reached only by `csrm`'s application and is changed with its web parser in the same plan (the 06.9 lesson):

1. **The request delete** (`DELETE /api/csrm-assessment-requests/{id}`) answers 409 `REQUEST_HAS_ASSESSMENT` for a request whose `assessment` relation is set. The check runs before Phase 13's `REQUEST_HAS_NOTES` and Phase 14's `REQUEST_HAS_ATTACHMENTS`, so a request holding an assessment and notes (or files) now reports `REQUEST_HAS_ASSESSMENT` where today it reports `REQUEST_HAS_NOTES` (or `REQUEST_HAS_ATTACHMENTS`). Compatible: a narrowing refusal with the same 409 status; every delete that succeeds today on a request without an assessment still succeeds, and the web's reason list gains the code in plan 16-03.
2. **Reads that drop withdrawn Risks**: the Requestor's reads (the released assessment detail, `GET /api/v1/risk_assessments/{assessmentId}/risks`, `GET /api/v1/my_risk_assessments` with its risk count and highest residual rating, and a withdrawn Risk's control implementations, which read as the missing-record 404), the analyst assessment list's risk count and highest residual rating, release readiness and the release path, the request relationship counts, the Risk Register's default view, and the dashboard, alert, report and exposure figures. The analyst assessment detail keeps listing every Risk. Compatible: no shape changes, and until a Risk is withdrawn, which only this phase's withdraw operation can do, every read returns exactly what it returns today.
3. **New required keys** `AnalystRiskDetail.withdrawal` (the analyst assessment detail) and `RiskDetail.withdrawal` (the Risk Register detail), each a `RiskWithdrawal` or null. Compatible for `csrm`: its closed parsers change in the same plans (16-06, 16-07); a strict reader of those shapes must accept the key, and no other workstream reads them.
4. **The `/v1/risks` state filter** enum gains `withdrawn`, which selects withdrawn Risks only; the default and the `open` and `closed` values exclude them. Compatible: an added query value; the existing values keep today's results until a Risk is withdrawn.
5. **Release readiness** gains the assessment-scope requirement `aiProposalsDecided` (`Decisions on AI proposals`, destination `ai-proposals`) on the analyst detail's `releaseReadiness`, and the release operation refuses while it is outstanding. Compatible: it is met whenever no risk proposal is open, which holds for every assessment until this phase's AI operations run; the web presents it in plan 16-14.
6. **The decision operation** (`POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions`): `AiProposalDecisionRequest` entries gain the `proposal` target, the `reject` action (on proposal targets only) and its optional `reason`. Compatible: Phase 12's entries parse and behave as today, and the response is unchanged.
7. **The AI run read** (`GET /api/v1/ai_runs/{runId}`): `AiRun.operation` (and the summary's `operation`) gains `risk-suggestions` and `risk-rewrite`, and the context summary gains v5 with `riskProposals`. Compatible: earlier runs and the v1 to v4 summaries read unchanged (detailed in the Phase 12 amendment's own "Affected Workstreams").
8. **The four new reasons** (`RISK_WITHDRAWN`, `RISK_NOT_WITHDRAWN`, `AI_ACCEPT_NOT_PERMITTED`, `REQUEST_HAS_ASSESSMENT`) join both conflict response enums, `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`, Strapi's `CONFLICT_REASONS` and the web list. Compatible: added enum values, each returned only by a path this phase adds or changes.
9. **The assessment's AI-inputs baseline** (`AiInputsChanged`, served as `generation.aiInputsChanged` on the analyst assessment read and in the request read's `RequestAiInputs`) moves to the newest completed `assessment-draft` or `risk-suggestions` run; see the Phase 13 notes amendment.
10. **New, not changes**: the eight operations in "Operations, Functions and Reasons" and their components (`RiskWithdrawal`, the curation request and result, `RiskHistoryEvent` and its page, the risk proposal job, and the proposals read).

## Audit Semantics and Limitations

The withdrawal facts are the current fact and the history is the log, the split the 06.8 record makes between the release facts and `governanceLog`. The current fact is what every gate, reader and count reads; the history says who changed what, when, why and from which proposal, and is never consulted for an authorisation, readiness or visibility decision.

The history is complete for every change made on the analyst paths from Phase 16 on. It does not reconstruct earlier changes: a Risk created before Phase 16 shows "History recorded from {date}", as Phase 12 notes that per-field tracking began later. Phase 12's per-field confirmations and suggestion dismissals change no value; they stay in the run's `decisions` and are not history entries (16-UI-SPEC UI-D23).

Rows are never updated or deleted by any CSRM workflow and follow the assessment record's retention. The content type stays editable in the Content Manager, as the run record does (this extension adds no `pluginOptions`), so "never deleted" means that no CSRM workflow deletes a row; an administrator's change there is outside the record's guarantee. A cross-aggregate audit store spanning requests, assessments and Risks remains out of scope.

The concurrency proofs run on SQLite, where knex's single connection serialises the transaction. They prove the serialised outcome, not PostgreSQL's row lock, which stays unproven until R-08-37 runs the Strapi suites on PostgreSQL.

## Migration

The extension is additive. Strapi schema sync creates the table, its link tables and the three columns; no migration file accompanies it, following the Phase 06.1, 06.2, 06.7, 06.8, 12, 13 and 14 precedent, and `apps/backend/database/migrations/` stays empty. Proof requires:

- a fresh test database booting with `csrm_risk_history_events`, its link tables, `withdrawn_at`, `withdrawal_reason` and `csrm_risks_withdrawn_by_lnk`;
- legacy Risks reading as active, with no history rows and no change to release readiness;
- the operator's development database showing the table and columns after the orchestrator's next Strapi start;
- the content-type freeze check since `PHASE_16_BASE` listing exactly `apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json` and `apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json`.

## Later Phases

- **S-5 Phase 17:** nominated owners and the release-for-response gate count only non-withdrawn Risks (G-11); participants never read a withdrawn Risk (G-12); owner nominations are recorded in this history by amendment; the editable guard gains G-11's actor rule; "Reassess residual risk" reuses the field-change proposal mechanism.
- **S-6 Phase 17.1:** the guard gains ASSESS-24's acceptance-round lock; decisions, readiness and fingerprints cover non-withdrawn Risks; withdrawal and reinstatement are edits that withdraw "Mark reviewed"; reinstating a Risk with an earlier acceptance decision is 17.1's to rule on.
- **S-7 Phase 17.2:** the before-and-after view for deciders reuses X-28's comparison and can read this history.
- **S-8 Phase 19:** exports authorise through the same record-read predicate and active-risk rule as the reads.
- **S-9 Phase 18:** bulk withdrawal reuses the batch operation; bulk edits and imports record into this history with a batch source by amendment to this record, with no new store.
- **S-10 Phase 20:** released Risks close through the register with a reason; registers exclude withdrawn Risks; post-release changes record into this history.
- **S-11 Phase 17's residual reassessment** adds an operation on the generic field-change proposal mechanism.
- **S-12 Phase 21:** metrics exclude withdrawn Risks, and AI assistance health can read the runs and their decisions.
- **S-13 Phase 22:** the Accept rule stays in `risk-scale.ts` and the AI policy in Phase 12's policy module, one configuration point each.
- **S-14 G-13's status labels:** `Withdrawn` is a value in the one status mapping.
- **S-15 The post-demo journey:** Phase 17 creates `risk-owner-journey.spec.ts`; Phase 16 adds no slice to it.

None needs another Risk history or withdrawal schema change.

## Approval

No schema file, catalogue entry, `docs/references/specification.json` change or stored-format write for these facts runs before the pilot's dated approval is written here (G-6).

Status: **approved by the pilot on 2026-10-15** (G-6).

What the pilot checked (2026-10-15): the text against the frozen JDL (`docs/references/idambox-datamodel.jdl`: `CsrmRisk`, `CsrmAssessment`, `IdamBoxUser`, `CsrmTreatmentAction`; no competing entity or status, `closureDate` and `treatmentStatus` keep their meanings), `docs/references/specification.json` and the role-function catalogue (every new Function granted to `role.security_analyst` only, no existing grant changed), AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; AI output is advisory and never accepts, releases or closes; JDL terminology; no hard delete; the released record stays immutable), 16-CONTEXT and the 2026-10-15 fresh plan check (iterations 2 to 4), and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section names `csrm` as the only reader, the `iam` grep is empty, and every changed endpoint stays backward compatible for existing callers. The pilot also confirms the executor's open choices: a `created` row lists starting values with `from: null`, a removed control implementation's row lists removed values with `to: null`, and `withdrawn`/`reinstated` rows carry `fields: []`; `undo: true` on a Risk with no `withdrawn` event is a 400; the requesting analyst is refused 403 `OWN_REQUEST` on the proposals read and the job read and retry, mirroring Phase 15. Accepted limitation: the content type stays editable in the Content Manager, so "never deleted" binds CSRM workflows, as for the run record.

## Phase 16 execution amendment (2026-10-16): Undo of a confirmed AI change

Found while executing 16-10. The `undo` flag is also true on one more row: the `updated` row, with source `ai-run` (the run and the unit), that writes a confirmed rewrite change's `before.values` back when the analyst restores it. That Undo is offered only while the assessment is editable and the active Risk still holds the confirmed values (otherwise 409 `AI_PROPOSAL_UNDO_UNAVAILABLE`), and never on an added Risk, as Phase 12's record states. No other kind of row carries `undo: true`, and a typed reason still never marks an undo. No schema, endpoint, Function or grant changes.

Phase 16 execution amendment status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): 16-10's SUMMARY (the restore path, `risk-history.ts` allowing `undo` on exactly that row) against this record's append-only rule (the Undo is a new row, never an edit of the confirmed one), AGENTS.md (the analyst, not the AI, restores; the released record stays immutable through the editable guard), and `.planning/PROJECT.md` "The shared backend": `csrm` stays the only reader.

## Phase 16 code review amendment (2026-10-16, proposed): Undo binds to the act it reverses

Found by the Phase 16 code review (`.planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-REVIEW.md`, BE1-03 Warning). Today `{ riskIds, undo: true }` on reinstatements reinstates any withdrawn Risk with the fixed reason `Withdrawal undone`, whoever withdrew it and whenever; on withdrawals it re-withdraws any active Risk that has some earlier `withdrawn` event. Only the client limits it to the toast. So any analyst can reinstate another analyst's withdrawal without a reason (D-10), and the history then reads "Withdrawal undone" for an act that undid nothing the actor did (T-16-15).

Proposed, with no schema, Function or grant change:

1. **Reinstatement Undo** applies to a Risk only while its current withdrawal is the acting analyst's (`withdrawnBy` is the actor) and that Risk's most recent history row is that `withdrawn` row.
2. **Withdrawal Undo** applies to a Risk only while its most recent history row is a `reinstated` row by the acting analyst.
3. A Risk in the batch that fails either rule refuses the whole batch with 409 and a new closed reason `RISK_CURATION_UNDO_UNAVAILABLE`, nothing written; the web shows a refusal sentence for it from `16-UI-SPEC.md`'s refusal table (new copy: "This can no longer be undone. Withdraw or reinstate the risk with a reason instead."). `docs/references/specification.json` gains the reason on the two curation operations, and the two `RiskCuration*Request` descriptions state the rule. A Risk with no `withdrawn` event stays the existing 400.

Alternative: defer to Phase 18 (S-9, bulk curation reuses this batch operation) and record the gap as accepted until then.

Phase 16 code review amendment status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): 16-REVIEW.md BE1-03 against D-10 (every withdrawal and reinstatement carries a reason) and T-16-15 (the history tells the truth about who reversed what); chosen over the Phase 18 deferral, because an Undo that bypasses the reason is a control gap a second-line function would not carry, and Phase 18's bulk curation would inherit it. Checked that the rule binds Undo to the acting analyst's own latest act, enforced in Strapi against the resolved IdamBox User, with the whole batch refused and nothing written; that the change is additive: one new closed reason, `RISK_CURATION_UNDO_UNAVAILABLE`, on the two curation operations in `docs/references/specification.json`, and the two request descriptions, with no schema, Function or grant change and the existing 400 kept; the refusal copy, approved as written (it names what to do next), recorded in `16-UI-SPEC.md`'s refusal table; and `.planning/PROJECT.md` "The shared backend": `csrm` stays the only reader.

# Phase 12: AI Run Record and Per-Field Provenance

## Gap

The frozen JDL has no AI or audit entity, and neither `CsrmRisk` nor `CsrmAssessment` has a JSON attribute for per-field review state. Catalogue design note 6 anticipates audit-history extensions. G-3 requires a record for each generation; decision 6 requires rejected proposals to remain recorded. These are the domain decisions deferred by the Phase 06.1 and 06.8 records.

Option A is chosen: one `CsrmAiRun` entity, optional current-state `aiProvenance` on the risk and assessment, and question origin derived from the questionnaire log. JSON run logs on existing aggregates would grow those records and make cross-request failure counts expensive. Keeping all field state on the run would require joins and merges for every risk edit and read. One row per proposal item would multiply rows and joins. The chosen shape gives a failed first generation a home, keeps current facts beside their records, and lets Phase 21 query failed runs by `startedAt`.

## Approved Compatibility Extension

This is the only proposed Phase 12 content-type change: one new content type and one optional JSON attribute on each of two existing content types.

```jdl
entity CsrmAiRun {
  operation String required,
  status CsrmAiRunStatus required,
  startedAt Instant required,
  completedAt Instant,
  providerName String required,
  providerVersion String required,
  jobId String,
  attempt Integer,
  instruction TextBlob,
  contextSummary AnyBlob,
  proposal AnyBlob,
  decisions AnyBlob,
  failureCode String,
  failureMessage String
}

enum CsrmAiRunStatus { RUNNING, COMPLETED, FAILED, INTERRUPTED }

relationship ManyToOne {
  CsrmAiRun{assessmentRequest} to CsrmAssessmentRequest,
  CsrmAiRun{questionnaire} to CsrmQuestionnaire,
  CsrmAiRun{assessment} to CsrmAssessment,
  CsrmAiRun{risk} to CsrmRisk,
  CsrmAiRun{initiatedBy} to IdamBoxUser
}
```

The content type is `api::csrm-ai-run.csrm-ai-run`, collection `csrm_ai_runs`. `assessmentRequest` is required by application code; `questionnaire`, `assessment` and `risk` are optional targets. `initiatedBy` identifies the human Security Analyst.

| Attribute | Strapi type | Meaning and bound |
| --- | --- | --- |
| `operation` | string | At most 64 characters. `AiRunOperation` is closed in code and the API contract: `questionnaire-generation`, `assessment-draft` for Phase 12. |
| `status` | enumeration | `AiRunStatus`: `running`, `completed`, `failed`, `interrupted`. |
| `startedAt`, `completedAt` | datetime | Server-owned times. |
| `initiatedBy` | manyToOne `IdamBoxUser` | The initiating human analyst. |
| `providerName`, `providerVersion` | string | Provider identity for the run. |
| `jobId`, `attempt` | string, integer | Correlation with the in-process job. |
| `assessmentRequest`, `questionnaire`, `assessment`, `risk` | manyToOne | Request is always set in code; the other relations are optional. |
| `instruction` | text | Null until Phase 15; never Requestor text. |
| `contextSummary` | json | Versioned envelope, at most 64 KB. |
| `proposal` | json | Validated internal proposal with adjustments, at most 1 MB. |
| `decisions` | json | Append-only versioned events, at most 5,000 per run. |
| `failureCode`, `failureMessage` | string | Safe values only, without submitted text. |

`CsrmRisk.aiProvenance` and `CsrmAssessment.aiProvenance` are optional `json` attributes. Null means no per-field AI provenance, including for legacy rows.

## Envelopes

Every envelope is schema-versioned and parsed closed: unknown keys, values and versions are invalid.

- **Context summary v1:** `schemaVersion: 1`, `operation`, `request.fields` (key, label, character count), `questions` (included and answered counts and source keys with question label at most 300 characters and section), `systems` (key, documentId, name), `assets` (key, documentId, name, classification), `riskTypes` (offered, total, names), `controlCandidates` (offered, library total), `classification` (level, source `assets` or `default`, ceiling, decision), `characters`, `budget`, and `digest`. The digest is `sha256:` over the exact user prompt. The summary holds no Requestor free text.
- **Internal proposal v2:** `schemaVersion: 2`, the validated proposal and its server-owned adjustments. It holds the closed, context-checked output after source, Risk Type, system, asset, control, rating and Accept checks. It is not a client-writable field.
- **Decision event v1:** `schemaVersion: 1`, `at`, `by`, `target` (`assessment` or a risk documentId), optional `item`, `kind` (`accepted`, `dismissed`, `restored`, `edited`), optional `fields`, and optional `implementation`.
- **Risk `aiProvenance` v1:** `schemaVersion: 1`, `runId`, `proposalKey`, `fields`, `uncitedClaims`, `suggestions`, and `adjustments`. Each AI-written field has `state` (`proposed`, `accepted`, `edited`), optional `by` and `at`, and `sources` on the seven statement fields: `issueStatement`, `riskStatement`, `riskCause`, `potentialImpact`, `inherentRatingRationale`, `residualRatingRationale`, `treatmentPlan`. The 20 fields are `riskType`, `issueStatement`, `riskStatement`, `riskCategory`, `riskSubCategory`, `riskCause`, `potentialImpact`, `informationSystemImpacted`, `informationAssetImpacted`, `dataClassification`, `inherentLikelihood`, `highestInherentConsequence`, `inherentRating`, `inherentRatingRationale`, `residualLikelihood`, `highestResidualConsequence`, `residualRating`, `residualRatingRationale`, `treatmentAction`, and `treatmentPlan`. `uncitedClaims` holds at most five claims per risk, each at most 300 characters. `suggestions` holds at most five per risk, each with `key`, `control` documentId, `controlNumber`, `rationale` (at most 500 characters), `state` (`proposed`, `added`, `dismissed`), and optional `by`, `at`, `implementation` and `implementationSnapshot`. The snapshot captures the created Planned implementation's writable fields for a safe restore.
- **Assessment `aiProvenance` v1:** the same version, run, proposal and field-state shape over `summary`, `overallRating`, `overallRiskRationale`, and `recommendationsSummary`. `summary`, `overallRiskRationale`, and `recommendationsSummary` carry sources.

## Run Lifecycle

After eligibility, context bounds and the data-policy check pass, create one `running` run immediately before each provider call. A refusal before the call creates no run. Complete the run in the transaction that persists the questionnaire or draft. On failure, record a safe failure code and message outside that transaction. A retry is a new attempt and a new run. At bootstrap, reconcile remaining `running` runs to `interrupted`.

**Amendment, 2026-10-08 (Phase 12 code review, stage B).** A clarification of the approved behaviour, with no schema, attribute, relation, enumeration or endpoint change:

- **Reconciliation (WR-01, WR-207).** Bootstrap reconciles to `interrupted` only the `running` runs that started more than the AI request bound ago: the request timeout (`CSRM_AI_REQUEST_TIMEOUT_MS`, 60,000 ms by default) plus a five-minute margin. It sweeps once more when that bound has passed since the start, so a starting process never interrupts another process's live run, and a run orphaned by a quick restart is still closed. A worker lease or heartbeat on each run waits for R-08-36's shared job store (Phase 21), as `docs/security/phase-08-residual-risks.md` records.
- **A draft that finds an assessment (WR-206, IN-103).** When the request already holds an assessment by the time the draft's transaction runs, the draft saves nothing and its run ends `failed` with the code `ASSESSMENT_ALREADY_EXISTS`, recorded outside the transaction like every run failure. It keeps no proposal and links no assessment. The job reports the assessment the request holds.
- **One failure code (IN-102).** A draft failure with no safe code of its own is `DRAFT_GENERATION_FAILED` ("Assessment draft generation failed safely.") on both the job and its run. `ASSESSMENT_DRAFT_FAILED` is no longer written; rows written before keep it.
- **An unwritable history (WR-103).** The closed reason `AI_RUN_RECORD_UNAVAILABLE` (the amendment under "Decisions and the Mutability Guard") also refuses the control removal below when its event can't be recorded.
- **A removed control (CR-02).** When an analyst removes, through the ordinary control implementation route, the Planned implementation that a suggestion added, that suggestion returns to `proposed` in the same transaction, without its `implementation` and `implementationSnapshot`, as its restore leaves it. The run's `decisions` receive a `restored` event naming the item and the removed implementation. If that event can't be recorded, the removal is refused and rolled back. A suggestion still `added` after its implementation is gone (written before this rule, or recording no implementation) is read as `proposed` by the analyst's projection and by the decision operation, so it can be added again or dismissed.
- **Decision input (WR-102, WR-106).** `action` and the target's `kind` are closed strings, never coerced. An `accept` without `fields` confirms the fields still `proposed`, so a repeat after none is left is a no-op. A field `restore` names its `fields`.

## Write Discipline

Only generation workflows, risk and assessment update paths, and protected decision operations write these facts. They use the aggregate's existing serialisation and transaction. `decisions` is append-only: earlier events are never removed, reordered or rewritten. `aiProvenance` is the current fact read by release readiness; the run's decisions are history. A decision writes both in one transaction. Neither JSON attribute is client-writable through generic update operations. Reads parse every envelope closed and project a malformed envelope as null without denying the record read.

**Amendment, 2026-10-08 (Phase 12 code review, stage B; verifier W-3).** No schema, attribute, relation, enumeration, endpoint, route or grant change. AI output is assistance a human must review (AGENTS.md; D-21; G-1), so only a human Security Analyst's edit or decision moves an AI field out of `proposed`. The risk and assessment update paths decide who is editing from the resolved IdamBox User, as the human-analyst-only guard decides it: an active user holding the update operation through the human Security Analyst Role. That analyst's edit is unchanged: a changed `proposed` or `accepted` field becomes `edited`, by the analyst, and a field already `edited` stays so. An edit by any other identity that changes an AI field's value leaves the field `proposed`, or returns it there from `accepted` or `edited`, with that identity as `by` and the edit's time as `at`, so the review of AI proposals stays outstanding until a human Security Analyst confirms or edits the field. Today that identity is the Security Analyst Agent, an automation identity that keeps the assessment and Risk edit grants D-33 left it for Phase 22's role review. The run's `decisions` receive an `edited` event naming those fields, by that identity, in the same transaction, and the WR-103 amendment's refusal applies to it as to every edit. The decision operation stays human Security Analyst only (D-24, D-32), so no automation identity can confirm a field either.

## Decisions and the Mutability Guard

Every decision goes through the single exported `assertMutableAssessment` guard behind `withMutableAssessmentMutation`. Phases 16, 17 and 17.1 extend that same guard for their actor and workflow rules. A released or otherwise immutable assessment refuses a decision with `ASSESSMENT_NOT_MUTABLE`. A proposal that has already been decided refuses a conflicting repeat with `AI_PROPOSAL_ALREADY_DECIDED`; an exact repeat is a no-op.

The accepted-edit transition applies to content changes: accepting fields, accepting a suggested control, restoring an accepted field, and restoring an added suggested control. Dismissing a suggestion and restoring a dismissed suggestion record decisions but do not change assessment content. Restoring an added suggestion removes only the Planned implementation it created, while the assessment is editable and the implementation's writable fields still equal `implementationSnapshot`. Otherwise `AI_SUGGESTION_CONTROL_CHANGED` refuses the restore and leaves the implementation intact.

Confirming an AI-proposed `Accept` treatment action is refused with `AI_ACCEPT_WITH_PLANNED_CONTROL` while the risk has a Planned implementation, including one added from a suggestion in the same batch. Draft validation does not propose `Accept` beside a suggested control; it changes the proposal to `Treat` and records `accept-with-suggested-controls`. An AI proposal is advice and cannot itself accept a risk or release an assessment.

**Amendment, 2026-10-08 (Phase 12 code review, WR-103).** A decision, and an edit of a `proposed` or `accepted` AI field through the risk or assessment update path, append their event to the run's `decisions` in the same transaction. When the run cannot take the event (it was deleted, its `decisions` no longer parse closed, or it already holds 5,000 events), the operation is refused with 409 and the closed reason `AI_RUN_RECORD_UNAVAILABLE`, and the transaction rolls back, so no decision and no AI field edit is applied without its audit record. Edits of fields the AI never proposed are unaffected. The run stays editable and deletable in the Content Manager (this extension adds no `pluginOptions`), so "never deleted" under Audit Semantics means that no CSRM workflow deletes a run; an administrator who deletes or corrupts one blocks the review of that draft's proposals until the run is repaired, and the analyst is told to contact the administrator. The reason joins the closed list in `apps/backend/src/csrm/conflict-reasons.ts`, both conflict response schemas of `docs/references/specification.json` and the web's list. It narrows nothing that existed and changes no endpoint's success shape.

## What This Extension Does Not Add

Question origin is derived from `CsrmQuestionnaire.governanceLog` after the latest generation, with no question-provenance attribute (D-22). `CsrmQuestion.helpText` already exists (D-17). The active Risk Type flag waits for Phase 22 (D-09). There is no new value in an existing enumeration and no change to `CsrmQuestionnaire`.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-05 the only workstream is `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmRisk`, `CsrmAssessment` and the new `CsrmAiRun`. This extension is backward compatible for any later reader: the table is new, both attributes are optional and null on existing rows, the extension changes no existing attribute, relation, enumeration value, endpoint or grant, and `aiProvenance` is never accepted from a generic write.

Phase 12 does change grants, separately from this extension and recorded in the role-function catalogue's Phase 12 design note: D-32 moves draft generation, its job read and its retry from the Questionnaire Details and Risk Assessment Details Functions into three human Security Analyst-only Functions, and D-33 withdraws the assessment-request core, delete and reference-data Functions from the Security Analyst Agent role. The code review's fixes (2026-10-08) also add the closed conflict reason `AI_RUN_RECORD_UNAVAILABLE` (amendment above) and narrow the Requestor's released assessment read, which no longer serves `generatedBy` (WR-304); both concern only the `csrm` workstream's application.

## Supersedes

This decision resolves the durable provenance, proposal-source, field-level human-change and job-audit deferrals in `phase-04-deterministic-draft-jobs.md`, `phase-06.2-questionnaire-generation-provenance.md`, and `phase-06.7-ai-provider-provenance.md`. It does not establish a general cross-aggregate audit store.

## Migration

The extension is additive. Strapi schema sync creates the table and two columns; no migration file accompanies it, following the Phase 06.1, 06.2, 06.7 and 06.8 precedent. Proof requires: a fresh test database with the table and columns; legacy rows reading as null with no new readiness requirement; the development database showing `csrm_ai_runs` and both `ai_provenance` columns after the orchestrator's next start; and a content-type freeze check listing exactly the three approved schema files.

## Audit Semantics and Limitations

Runs are never deleted and follow the assessment record's retention. A run keeps no Requestor free text (G-3). The job registries remain in-process. Bootstrap interruption reconciliation is honest only with one Strapi process; R-08-36 remains open until a shared job store supports multiple processes.

**Clarification, 2026-10-08 (Phase 12 code review, stage B; WR-105).** No schema, attribute, relation, enumeration or endpoint change. The context summary holds no Requestor text. It names each answer source by the question's position among the questions sent ("Question 3") and its section, never by the question's text, which a generator can write from the request; the analyst's run read and the citations on the analyst's assessment read show the question's current text, read from the run's questionnaire when they are served, and keep the position label for a question that is gone. The `proposal` is provider output, the validated proposal as the provider returned it, kept for audit and read only by human Security Analysts (no read serves it, and a Requestor never reaches a run). A hosted model's questions and statements may restate request content, so the proposal may hold some. The deterministic providers quote no Requestor text: the questionnaire's sentences are CSRM's own and name only the request's business criticality (a closed value) and its first selected information asset (reference data the summary also names), and the draft's statements are fixed.

**Clarification, 2026-10-08 (Phase 12 code review, stage B; WR-104).** No schema change. The run record's bounds hold inside every published limit: a context whose summary would exceed 64 KB (for example 100 systems and 100 assets with long names in a non-Latin script) fails before any run or provider call with `CONTEXT_TOO_LARGE`, as D-06 says; a validated proposal whose envelope would exceed 1 MB is refused as `PROVIDER_OUTPUT_INVALID` before the transaction that would save it, so nothing is saved and the run records that code; and a Risk's category and sub-category are refused over 255 characters, the length they are stored in.

**Clarification, 2026-10-08 (Phase 12 code review, stage B; WR-107, WR-203, IN-109).** No schema change. The server-owned adjustments gain three codes. On a draft Risk (in the run's proposal and the Risk's `aiProvenance`): `uncited-claims-capped`, when the model listed more than five uncited claims (the first five are kept, and each is still refused over 300 characters), and `accept-without-rationale`, when the model proposed Accept with a blank treatment plan (it becomes Treat, with a plan CSRM writes for the analyst to replace, citing nothing). On a questionnaire run's proposal, whose adjustments were always empty: `help-text-missing`, when a generated question has no help text (stored as none).

## Later Phases

Phase 15 fills `instruction`. Phases 16 and 17 extend the operation vocabulary and decision-item kinds through dated envelope amendments to this record and use the optional `risk` relation. Phase 21 counts `failed` runs by `startedAt`. None needs another run-record schema change.

## Approval

Status: Approved by the pilot on 2026-10-05 (G-6). Recorded by the pilot; plan 12-04 changes the three schema files after this line.

Checked before approval: the JDL (`docs/references/idambox-datamodel.jdl`) has no AI or audit entity and no JSON attribute on `CsrmRisk` or `CsrmAssessment`, so the new entity competes with no existing term; the specification gains no generic write path for either JSON attribute; the role-function catalogue design note 6 anticipates audit history; AGENTS.md (AI output stays advisory, nothing here releases or accepts, record-level authorisation stays in Strapi); 12-CONTEXT D-01, D-19 to D-24 and the 2026-10-01 confirmations; the shared-backend rule (section above). The change is one-way, as D-01 records.

## Phase 15 amendment (2026-10-01): questionnaire proposals, decisions and instructions

Decided in Phase 15 (15-CONTEXT D-01, D-03, D-12 to D-14, D-19 to D-24 and D-29) and written on 2026-10-11 by plan 15-01, before any code writes these shapes. It extends the envelopes this record governs, as "Later Phases" anticipated. `CsrmAiRun` already holds `instruction`, `contextSummary`, `proposal` and `decisions` (Phase 12 D-19), so no content type, attribute, relation or Strapi enumeration changes, and no file under `apps/backend/src/api/*/content-types/` changes in Phase 15. What changes is the closed operation vocabulary in code and in the API contract, two new envelope versions (the questionnaire proposal envelope v1 and the decision event v2) and the next context summary version. Every parser stays closed, versioned and fail-safe, as "Envelopes" and "Write Discipline" say. Phases 16 and 17 extend this amendment rather than restating it.

### Run operations and the instruction

- **Two operations.** `AiRunOperation` (`AI_RUN_OPERATIONS` in `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts`, and `AiRun.operation` in the API contract) gains `questionnaire-proposals` and `question-rewrite`. `operation` stays a string of at most 64 characters.
  - `questionnaire-proposals` is questionnaire-wide: the AI proposes questions to add, change or remove across one questionnaire (D-10). It is context-wide for the questionnaire in the sense of Phase 13 D-29 (`CONTEXT_WIDE_AI_OPERATIONS`), so its completed run can be the baseline of the questionnaire's "AI inputs changed" signal.
  - `question-rewrite` is question-scoped: the AI rewrites one unanswered question in plain language, changing only its text, help text and choice labels (D-11). It is never context-wide and never clears the signal.
  - Both set `assessmentRequest`, `questionnaire` and `initiatedBy` (the human Security Analyst who asked); `assessment` and `risk` stay unset. Both use questionnaire generation's provider settings (provider, model, timeout and output-token limit) and record the provider name and version as every run does.
- **The instruction.** `questionnaire-generation` accepts the same optional instruction as the two new operations (D-12). `instruction` holds the exact validated instruction a Security Analyst gave: CRLF and CR become LF, the line feed is the only control character allowed, the text is trimmed, and it is 1 to 500 UTF-16 code units long. It is null when none was given, including a rewrite that runs on CSRM's own plain-language preset, which the context summary names by its `instruction.source` and which is never stored as an instruction. Only a human Security Analyst who did not raise the request may give one: a requesting analyst is refused with 403 `OWN_REQUEST` (G-1). The instruction reaches the provider only inside the `<analystInstruction>` slot, escaped as data (`promptDataTag`), where it may steer the task but cannot change the rules, the output format or the limits.
- **No Requestor text.** `instruction` never holds Requestor text. Before any job is queued, an instruction is refused with 400 `INSTRUCTION_REPEATS_REQUESTOR_TEXT` when any 60-character window of it, normalised (NFKC, lower case, every whitespace run one space), appears in the Requestor's text normalised the same way: the request's text fields, the Requestor's notes, submitted answers and the text of files included in the AI inputs. Draft answers are never compared, so the refusal cannot reveal one, and an analyst's own notes are not compared. The run keeps no other Requestor text either (G-3; "Audit Semantics and Limitations").

### Questionnaire proposal envelope v1

Both new operations store this envelope in `proposal`. It is written once, by the transaction that completes the run, and never changed:

```text
{
  schemaVersion: 1,
  operation: "questionnaire-proposals" | "question-rewrite",
  outcome: "items" | "no-change",
  items: [{
    key: "i-1" … "i-30",
    kind: "add" | "change" | "remove",
    target?: { questionDocumentId, questionKey, textSnapshot },     // a change or a removal only
    proposed?: { questionText, helpText, answerType, choices, required,
                 section?, visibility? },                           // an addition or a change only; section and visibility on an addition only
    rationale,
    sources: [{ kind, ref }],
    base: ChangeBase | AddBase
  }],
  adjustments: [{ code, wireIndex?, count?, detail }]
}
```

- **`outcome`** is `no-change` when the AI found nothing to change (for example a rewrite whose result equals its question), and then `items` is empty; otherwise it is `items`.
- **`items`**: at most 30, keyed `i-1` to `i-30` in the order CSRM kept them; at most 15 additions; at most one item per target question in one run, so a run never makes its own items stale.
- **`target`** (a change or a removal): the question's `questionDocumentId` and `questionKey`, and `textSnapshot`, its text when the run completed, at most 500 characters by Phase 10's snapshot rule (trimmed, and over 500 kept as its first 499 characters and `…`), so the item still reads after the question row is gone.
- **`proposed`** (an addition or a change): `questionText`, 1 to 1,000 characters; `helpText`, at most 2,000 characters, or null; `answerType`; `choices`, a list of `{ value, label }` (labels at most 255 characters and unique without regard to case; 2 to 20 on a select before Not sure; empty for every other type), where a select carries exactly one canonical Not sure by the shipped rule (IN-110, WR-02: `NOT_SURE_CHOICE`, `isNotSureEquivalent` and `withCanonicalNotSure`: a model's equivalent is canonicalised where the model put it, and Not sure is added last when absent); and `required`.
  - The AI never proposes the Boolean or File upload answer type. A change that leaves the answer type alone, and every rewrite, keeps the target's own type.
  - An addition also carries `section`, `{ kind: "existing", key }` or `{ kind: "new", title }` (a title of 1 to 255 characters), and may carry `visibility`, `{ questionKey, operator, value }`: a rule on an earlier active question, with `operator` one of `equals`, `notEquals`, `includes` and `notIncludes` and a `value` that question offers.
  - A change never moves its question: its section, order and visibility stay the target's. A change's `proposed` holds every value the question will have, with the fields the AI left alone copied from the target, so the comparison and the decision read one object. A rewrite changes only the text, the help text and the choice labels; choice values never change (D-11).
- **`rationale`**: the AI's reason, at most 1,000 characters.
- **`sources`**: at most 10 `{ kind, ref }`. `kind` is one of `request-field`, `note`, `file`, `answered-question` and `instruction`; `ref` is the context's id for that source (`request.{field}`, `note-{n}`, `file-{n}`, `Q{n}` for an answered question, or `instruction`), which the proposals read resolves to a label when it is served, as Phase 12's citations are. An id the context did not offer is dropped and counted (`sources-dropped`); the item is kept.
- **`base`**: under "Bases and staleness" below.
- **`adjustments`**: at most 60 `{ code, wireIndex?, count?, detail }`, recording what CSRM changed in or left out of the model's output and why, never silently (Phase 12 D-06). `code` is one of thirteen: `answered-target`, `removed-target`, `unknown-target`, `duplicate-target`, `invalid-item`, `near-duplicate`, `no-change`, `definition-invalid`, `answers-affected`, `rewrite-out-of-scope`, `over-limit`, `ignored-field` and `sources-dropped`. `wireIndex` is the position of the model's item it concerns; `count` aggregates repeats (the over-limit drops are one adjustment with a count, which keeps the list within 60); `detail` is CSRM's own short sentence, at most 500 characters, built from closed values and never copied from model output or Requestor text.
- **Dispatch by operation.** The same `proposal` column holds Phase 12's internal proposal envelope (`schemaVersion: 2`) for `questionnaire-generation` and `assessment-draft`. A reader chooses the parser by the run's `operation`, never by `schemaVersion`: the two new operations parse only this envelope, and Phase 12's operations only theirs. `AI_RUN_BOUNDS` applies to every operation unchanged (a 1,048,576-byte proposal, 5,000 decision events, a 65,536-byte summary). As Phase 12's clarification of 2026-10-08 (WR-105) says of every proposal, this is provider output validated against the context: a hosted model's text may restate request content, it is read only by human Security Analysts, and a Requestor never reaches a run.

### Bases and staleness

- **A change or removal base** is `{ kind: "question", fingerprint, unanswered: true }`. `fingerprint` is `sha256:` and the lowercase hex digest of the canonical JSON, object keys sorted at every level, of `{ questionText, helpText, answerType, choices, required, section: { key, title, order }, order, visibility, removed }`, read from the question row (`helpText` null when blank, `removed` a boolean). A base never holds a question's text or an answer.
- **An addition base** is `{ kind: "placement", generatedAt, section, controller }`: `generatedAt` is the questionnaire's `generatedDate` when the run's context was built (or null); `section` is `{ kind: "existing", key, title, order }` or `{ kind: "new", title }`; `controller` is `{ questionKey, fingerprint }` for the question its visibility rule reads, or null.
- **Stale.** A change or removal is stale when its target's fingerprint differs, the target is now answered, or it is removed (so a removal of a question already removed is stale). An addition is stale when the questionnaire's `generatedDate` differs from `generatedAt`, its existing section no longer holds an active question with the same key, title and order, or its controller's fingerprint changed or the controller was removed.
- **Derived, never stored.** Staleness is derived on every read and checked again inside the decision transaction, against the questionnaire as the earlier decisions of the same batch leave it. A stale item can only be rejected: its confirmation is refused with `AI_PROPOSAL_STALE`.

### Decision event v2 and item states

For the two new operations only, decisions append this event to `decisions`. Phase 12's v1 events stay the only kind for Phase 12's operations; a v1 event on a questionnaire run, or a v2 event on a Phase 12 run, is refused and nothing is written.

```text
{
  schemaVersion: 2,
  at,                                  // the server's time
  by,                                  // an IdamBox User documentId (1 to 255 characters), or "system"
  item,                                // "i-1" … "i-30", a key in this run's proposal
  action: "accepted" | "rejected" | "restored" | "superseded" | "lapsed",
  edits?,                              // the field names the analyst changed before confirming
  reason?,                             // a rejection's reason, 1 to 500 characters
  cause?: { kind: "newer-rewrite", runId } | { kind: "questionnaire-frozen" },
  before?,                             // the target as it was, on the accept of a change or removal (for Undo)
  applied?: { questionDocumentId, questionKey, fingerprint }   // on an accept, and on the restore of an accepted item
}
```

`edits` holds at most 10 names from `questionText`, `helpText`, `answerType`, `choices`, `required` and `section`. `before` holds the target's fingerprinted values with its `questionDocumentId` and `questionKey`. On the wire the analyst's actions stay `accept`, `reject` and `restore`; the visible word is "Confirm" (the orchestrator's confirmation of 2026-10-01).

**Item state** is a pure fold of the run's v2 events over its proposal's items, and is never stored:

| From \ event | `accepted` | `rejected` | `restored` | `superseded`, `lapsed` |
| --- | --- | --- | --- | --- |
| open | accepted | rejected | no-op | superseded, lapsed |
| accepted | no-op without edits; with edits, not open | not open | open (Undo) | not open |
| rejected | not open | no-op | open (Undo) | not open |
| superseded, lapsed | not open | not open | not open | not open |

Superseded and lapsed are final. A repeated identical decision is a no-op: it succeeds, is counted as unchanged and is not stored. A decision on an item that is no longer open is refused with `AI_PROPOSAL_ALREADY_DECIDED`, whose meaning now covers superseded and lapsed items as well as decided ones (the orchestrator's confirmation of 2026-10-01: no parallel code is added).

- **Who decides, and when.** Only a human Security Analyst who did not raise the request (403 `OWN_REQUEST` otherwise), under the questionnaire's governance lock, all or nothing for each batch. A confirmation, and the Undo of a confirmation, need the questionnaire in analyst review; a rejection, and the Undo of a rejection, are allowed until the assessment draft starts. Once an assessment exists (`ASSESSMENT_STARTED`) or its draft job is queued or running (`ASSESSMENT_DRAFT_IN_PROGRESS`), no decision is taken. These are questionnaire decisions, not assessment decisions, so "Decisions and the Mutability Guard" does not apply to them.
- **Supersession.** When a newer `question-rewrite` of the same question completes with an item, every older rewrite item on that question that is still open receives `superseded`, `by` the newer run's initiating analyst, with `cause: { kind: "newer-rewrite", runId }` naming the newer run. A newer run that fails, or finds no change, supersedes nothing.
- **Lapse.** When a proposal run completes and finds the questionnaire frozen (an assessment exists, or its draft job is queued or running), the run still completes and every item receives `lapsed`, `by: "system"`, with `cause: { kind: "questionnaire-frozen" }`.
- **Advisory only.** Supersession and lapse close an item without applying it. Nothing applies an item without a human Security Analyst's confirmation, and nothing here releases a questionnaire or an assessment (AGENTS.md).

### Open items, the run bound and the fail-safe direction

- **The open set** of a questionnaire is derived on each read from its completed runs of both operations: the items whose folded state is open. Nothing stores it.
- **The run bound.** A questionnaire holds at most 100 completed proposal runs, both operations counted together, which bounds the fold to 100 runs of at most 30 items. A start at the bound is refused with 409 `AI_PROPOSAL_RUN_LIMIT` before a job is queued, and a job that finds the bound reached when it executes fails with the same code before any run is created or any provider is called.
- **A damaged run.** A run whose `proposal` or `decisions` do not parse, or whose fold meets an event naming an unknown item or an illegal transition, counts as having no open item, is logged once per read, and none of its items can be confirmed or restored.
- **The fail-safe direction.** The gates that read the open set (release, draft generation and replacement, which refuse with `AI_PROPOSALS_OPEN` while an item is open or a proposal job is queued or running; D-08, D-09) protect no access: they keep the analyst's review in order. So they fail open, and a damaged run never blocks them. Access gates keep reading only their dedicated facts (the release gate reads `releasedAt`, as the 06.8 record requires), never a run.

### Context summary: questionnaire and instruction sections

Phase 12's v1, Phase 13's v2 (`docs/contract-gaps/phase-13-request-notes.md`, "Notes in the AI Context") and Phase 14's v3 (`docs/contract-gaps/phase-14-request-attachments.md`, "The Run Record") are followed by **the context summary v4**: v3's envelope with `schemaVersion: 4`, plus two required, nullable sections:

```text
questionnaire: {
  scope: "questionnaire" | "question",
  questionsOffered, answered,
  answerContent: "included" | "withheld",
  openItemsListed, rejectedItemsListed, rejectedItemsTotal, removedListed
} | null,
instruction: { source: "analyst" | "plain-language-preset" | "default-task" } | null
```

- Every context built after this amendment is implemented writes v4. `questionnaire` is set for the two new operations and null for questionnaire generation and the draft. `instruction.source` is `analyst` or `default-task` for questionnaire generation and a proposal run, and `analyst` or `plain-language-preset` for a rewrite; it is null for the draft.
- `answerContent` is `included` only when every active, visible question holds a submitted answer (the questionnaire read's submitted-batch rule); a rewrite sends no answers.
- The summary holds counts and closed values only: never the instruction's text (that is the run's `instruction`) and never Requestor text (G-3).
- A `question-rewrite` context offers no Risk Type library, so its `riskTypes` reads `{ offered: 0, total, names: [] }`.
- The attachments section's `bound` for both new operations is 30,000 characters, Phase 14 D-33's questionnaire bound (`ATTACHMENT_CONTEXT_BOUNDS` in `apps/backend/src/csrm/ai/assessment-context.ts`).
- The closed parser (`parseContextSummary`) accepts v1, v2, v3 and v4 unchanged and fails safe to null on anything else; an earlier version reads with `questionnaire` and `instruction` null, beside its empty notes and attachments. The summary bound (`CONTEXT_BOUNDS.summaryBytes`, 65,536 bytes) still applies.

### Bounds

| Bound | Value | On excess |
| --- | --- | --- |
| Instruction | 1 to 500 UTF-16 code units after CRLF and CR become LF; empty or whitespace only is no instruction | 400 `INSTRUCTION_TOO_LONG` |
| Instruction characters | the line feed is the only control character; no format, surrogate or private-use character, and no U+2028 or U+2029 | 400 `INSTRUCTION_CHARACTERS_NOT_ALLOWED` |
| Requestor-text guard | a 60-character verbatim window after NFKC, lower case and whitespace normalisation | 400 `INSTRUCTION_REPEATS_REQUESTOR_TEXT` |
| Items per run | 30 | adjustment `over-limit` |
| Additions per run | 15 | adjustment `over-limit` |
| Items per target per run | 1 | adjustment `duplicate-target` |
| Completed proposal runs per questionnaire (both operations) | 100 | 409 `AI_PROPOSAL_RUN_LIMIT` at enqueue; the same job failure code at execution |
| Active questions in a context | 150 | job failure `CONTEXT_TOO_LARGE`, before any run |
| Open items listed in a context | 200 | job failure `CONTEXT_TOO_LARGE`, before any run |
| Rejected items listed in a context | the 100 most recent | ranked, with the total in the summary (`rejectedItemsTotal`), never silent |
| Removed questions listed in a context | 200 | job failure `CONTEXT_TOO_LARGE`, before any run |
| Decisions per batch | 1 to 200 | 400 |
| Reject reason | at most 500 characters | 400 |
| Recently decided items in the proposals read | 50, newest first | older decided items are not served |
| Near-duplicate | token-set Jaccard 0.8 or more; an exact normalised match when either side has fewer than three tokens | adjustment `near-duplicate` |

Phase 12's bounds are unchanged: the questionnaire prompt budget (100,000 characters, `CONTEXT_BOUNDS.questionnairePromptCharacters`) and `AI_RUN_BOUNDS`.

### Closed reasons

**Closed 4xx reasons** are served in `error.details.reason`. They live in Strapi's `CONFLICT_REASONS` (`apps/backend/src/csrm/conflict-reasons.ts`), both conflict response schemas of `docs/references/specification.json` (`QuestionnaireWorkflowErrorResponse` and `AssessmentWorkflowErrorResponse`) and the web's list, one list as `tests/conflict-reasons.unit.test.ts` proves. Twelve join it:

- 409 `AI_PROPOSALS_OPEN`: an item is open, or a proposal job is queued or running (release, draft generation, replacement).
- 409 `AI_PROPOSAL_STALE`: the item's basis has changed, so it can only be rejected.
- 409 `QUESTIONNAIRE_HAS_ANALYST_CHANGES`: a replacement would discard analyst changes made since the latest generation (D-09).
- 409 `QUESTION_ANSWERED`: a rewrite was asked for an answered question.
- 409 `ASSESSMENT_DRAFT_IN_PROGRESS`: the assessment draft job is queued or running.
- 409 `AI_PROPOSAL_RUN_LIMIT`: the questionnaire already holds 100 completed proposal runs.
- 409 `AI_PROPOSAL_UNDO_UNAVAILABLE`: the confirmed question has changed or been answered since, or the questionnaire has left analyst review.
- 409 `ANSWERED_QUESTION_AFFECTED`: applying the item would change, hide or invalidate an answered question.
- 409 `QUESTIONNAIRE_ANSWERED`: a replacement of a questionnaire that holds answers. Today it is only a generation job failure code; D-09 now refuses it at enqueue too, so it joins the closed list (15-PLAN-CHECK iteration 2, Q-1). The rule is unchanged: no replacement once answered.
- 400 `INSTRUCTION_TOO_LONG`, `INSTRUCTION_CHARACTERS_NOT_ALLOWED` and `INSTRUCTION_REPEATS_REQUESTOR_TEXT`: the instruction's bounds and the Requestor-text guard.

These are reused, already in the closed list: Phase 10's 409 `QUESTIONNAIRE_RELEASED`, `QUESTIONNAIRE_NOT_SUBMITTED`, `QUESTIONNAIRE_NOT_ANSWERABLE`, `ASSESSMENT_STARTED`, `QUESTION_REMOVED`, `QUESTION_HAS_DEPENDENTS`, `LAST_ACTIVE_QUESTION`, `DEFINITION_INVALID` and `HISTORY_UNAVAILABLE`; Phase 12's 409 `AI_PROPOSAL_ALREADY_DECIDED` (widened in meaning, above), `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED`; and Phase 13's 403 `OWN_REQUEST`.

**Job failure codes** are a failed job's and its run's `failureCode`. The contract keeps `failureCode` a free string of the registry's safe form, so a new code needs no schema change.

- Job failure codes only, never a 4xx reason: `CONTEXT_TOO_LARGE` (the context exceeds a bound, before any run is created; the job keeps the ids of the included files it counted and serves them as `failureAttachments`, as Phase 14's generation job does) and `PROVIDER_OUTPUT_INVALID` (the model's output fails the structure check, or the envelope would exceed `AI_RUN_BOUNDS`; the run records it).
- Both a closed reason and a job failure code: the two AI policy codes, `AI_POLICY_NOT_CONFIGURED` and `AI_CLASSIFICATION_ABOVE_CEILING`, and the state reasons a job re-checks before its provider call or in its transaction:
  - a proposal job: its start's state refusals (`QUESTIONNAIRE_NOT_SUBMITTED`, `ASSESSMENT_DRAFT_IN_PROGRESS`, `ASSESSMENT_STARTED`, and for a rewrite `QUESTION_REMOVED` and `QUESTION_ANSWERED`) and `AI_PROPOSAL_RUN_LIMIT`, before the provider call; and `HISTORY_UNAVAILABLE` when the governance log cannot take the `ai-proposal` event at completion. A questionnaire frozen at completion lapses the items instead of failing the run;
  - a replacing questionnaire generation, in its locked transaction: `QUESTIONNAIRE_RELEASED`, `QUESTIONNAIRE_ANSWERED`, `QUESTIONNAIRE_HAS_ANALYST_CHANGES`, `AI_PROPOSALS_OPEN`, and `HISTORY_UNAVAILABLE` as today;
  - an assessment draft, in its transaction: `AI_PROPOSALS_OPEN`.

### Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-11 that section's workstream table lists one workstream, `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmAiRun` and the only caller of the operations below. This amendment is backward compatible for any later reader:

- every run written before it reads unchanged: Phase 12's envelopes, its v1 decision events and the v1 to v3 summaries still parse, and the new versions apply only to the two new operations, or, for the summary, only to runs built after it;
- every change to an existing endpoint is additive, or a narrowing refusal reached only by the `csrm` workstream's application, which changes its parsers in the same plans (the 06.9 lesson);
- no content type, attribute, relation, Strapi enumeration value or existing grant changes;
- the new Functions go to `role.security_analyst` only, never to `role.security_analyst_agent` and never to the Requestor birthright (`role.requestor`).

Phase 15 changes these existing endpoints, schemas, grants and behaviours:

1. **Questionnaire generation** (`POST /api/v1/assessment_requests/{requestId}/generate_questionnaire`): the body gains the optional `instruction`, which may be refused with 400 `INSTRUCTION_TOO_LONG`, `INSTRUCTION_CHARACTERS_NOT_ALLOWED` or `INSTRUCTION_REPEATS_REQUESTOR_TEXT`, and with 403 `OWN_REQUEST` for a requesting analyst who gives one. The replacement path narrows (D-09): at enqueue it is refused with 409 `QUESTIONNAIRE_ANSWERED`, `QUESTIONNAIRE_HAS_ANALYST_CHANGES` or `AI_PROPOSALS_OPEN` (today only `QUESTIONNAIRE_RELEASED` is refused at enqueue, and an answered questionnaire fails in the job), and the same three are job failures in the locked transaction.
2. **Questionnaire release** (`POST /api/v1/questionnaires/{questionnaireId}/release`): 409 `AI_PROPOSALS_OPEN` (D-08).
3. **Assessment draft generation** (`POST /api/v1/questionnaires/{questionnaireId}/generate_assessment`): 409 `AI_PROPOSALS_OPEN` at enqueue, and the same code as a job failure (D-08).
4. **The Requestor's answer save and submit** (`PATCH /api/v1/questionnaires/{questionnaireId}/answers` and `POST /api/v1/questionnaires/{questionnaireId}/submit`): the release fact is re-checked inside the locked transaction, refusing with the existing 409 `QUESTIONNAIRE_NOT_ANSWERABLE` and its existing message (D-25).
5. **The analyst questionnaire read** (`GET /api/v1/questionnaires/{questionnaireId}`): `generation.openProposals` (`AiGenerationFacts`, optional and nullable; null for a requesting analyst); each question's (`QuestionnaireQuestion`) optional `answered` flag, served in analyst review and on a submitted questionnaire only (D-30); and `aiOrigin` gains `proposal-confirmed` and `proposal-edited` (D-27).
6. **The AI-inputs signal** (`AiInputsChanged`, on `AiGenerationFacts` and on the request read's `RequestAiInputs`, `GET /api/csrm-assessment-requests/{id}`): for the questionnaire it now compares against the questionnaire's newest completed `questionnaire-generation` or `questionnaire-proposals` run, so a completed proposal run clears it; `generation.runId` still names the latest completed generation run (D-27, D-29; S-2). This changes Phase 13's rule that the baseline is the run `generation.runId` names, for the questionnaire only.
7. **The AI run read** (`GET /api/v1/ai_runs/{runId}`): `AiRun.operation` and `AiRunContextSummary.operation` gain the two operations; `AiRunContextSummary.schemaVersion` gains 4, with the required, nullable `questionnaire` and `instruction`; the summary's `attachments.bound` is 30,000 for both new operations; and for the new operations `proposal` holds the questionnaire envelope v1 and `decisions` the v2 events, dispatched by `operation` (the Phase 12 envelope is `schemaVersion: 2`). The read stays human Security Analyst only.
8. **Closed reasons**: both `QuestionnaireWorkflowErrorResponse` and `AssessmentWorkflowErrorResponse` reason enums, Strapi's `CONFLICT_REASONS` and the web's list gain twelve, the eleven new names and `QUESTIONNAIRE_ANSWERED`; `AI_PROPOSAL_ALREADY_DECIDED` widens in meaning to superseded and lapsed items. Job failure codes are listed apart, under "Closed reasons".
9. **Grants and the catalogue**: five new API-only Functions for `role.security_analyst` only (`function.questionnaire_ai.propose_api`, `function.questionnaire_ai.job_read_api`, `function.questionnaire_ai.retry_api`, `function.questionnaire_ai.proposals_read_api` and `function.questionnaire_ai.decide_api`), granted through each Function's `roleIds` and the role's `functionIds`, with both catalogue copies identical; the six operations join `HUMAN_ANALYST_ONLY_OPERATIONS`; `docs/references/served-operations.json` is regenerated. No existing Function, grant or role changes.
10. **New, not changes**: the six operations (`POST` and `GET /api/v1/questionnaires/{questionnaireId}/ai_proposals`, `POST /api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite`, `GET /api/v1/questionnaire_proposal_jobs/{jobId}`, `POST /api/v1/questionnaire_proposal_jobs/{jobId}/retry` and `POST /api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions`), `QuestionnaireProposalJob` with its optional `failureAttachments` (S-3), and the proposals read's `QuestionnaireAiProposals`.
11. **No contract change for the notes-aware `CONTEXT_TOO_LARGE` copy** (D-29): the job cards show Strapi's existing `failureMessage` when it names marked notes, by the 15-UI-SPEC §13 amendment of 2026-10-11.

The governance events' changes are listed in the 06.8 record's amendment (`docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`, "Phase 15 amendment (2026-10-01)").

### Migration

None. No content type changes, so there is no schema sync, migration file or content-type freeze entry (the freeze check since `PHASE_15_BASE` lists no file). Runs written before this amendment read unchanged through the closed parsers, which accept the earlier versions beside the new ones and fail safe on anything else; no stored run is rewritten. Phase 16 and Phase 17 extend this amendment, adding target kinds on the same item core and the same decision event v2, rather than restating it.

Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6), for the operations, envelopes, bounds, closed reasons and changes to existing endpoints exactly as this amendment states them. Plan 15-02 and every later Phase 15 plan write these shapes only after this line.

What the pilot checked:

- **JDL** (`docs/references/idambox-datamodel.jdl`): no entity, attribute, relation or enumeration changes. The proposals, their decisions and the instruction live in the approved `CsrmAiRun` attributes (`instruction`, `contextSummary`, `proposal`, `decisions`), as Phase 12 D-19 designed and "Later Phases" anticipated, and the questionnaire changes go through the existing `CsrmQuestion` attributes and the `options` soft removal. `git diff --name-only 15eb830b -- apps/backend/src` is empty at the checkpoint.
- **API contract** (`docs/references/specification.json`): six new operations, all additive. The eleven listed changes to existing endpoints are additive fields or narrowing refusals, each reached only by `csrm` and each changed with its web parser in the same plan. The twelve new closed reasons join the one list; job failure codes stay free strings, listed apart.
- **Role-function catalogue**: five new API-only Functions for `role.security_analyst` only, granted through `roleIds` and the role's `functionIds` in both copies; nothing for `role.security_analyst_agent` or `role.requestor`; the six operations join `HUMAN_ANALYST_ONLY_OPERATIONS`.
- **AGENTS.md and decisions 4 to 6**:
  - AI output stays advisory: nothing applies an item without a human Security Analyst's confirmation, made only in analyst review, so nothing reaches the Requestor before the 06.8 release; supersession and lapse close items without applying them.
  - The open-proposal gates protect no access and fail open; the release gate keeps reading only `releasedAt`.
  - The instruction is the analyst's own text in its own escaped slot, analyst-only, never Requestor text; the 60-character guard is defence in depth.
  - G-1 holds: 403 `OWN_REQUEST` for a requesting analyst. Record-level checks stay in Strapi against the resolved IdamBox User, with no branch on the auth mode.
- **Audit (decision 6, G-3)**: the proposal is immutable and its decisions append-only, with who, when and why, the Undo included. A damaged run can block nothing and can never be confirmed. The summary holds counts and closed values only.
- **Backward compatibility**: runs written before read unchanged (parsers chosen by `operation`; v1 to v3 summaries still parse), and no stored run is rewritten.
- **The executor's choices, accepted**:
  - an adjustment's `detail` is CSRM's own sentence of at most 500 characters, never model or Requestor text;
  - `section` and `visibility` only on an addition, so a change never moves its question (D-13);
  - a change's `proposed` holds every value the question will have;
  - a run that completes on a frozen questionnaire lapses its items (D-24) rather than failing, because the provider was already called and the record should say what came back;
  - "never Boolean or File upload" binds only an answer type the AI proposes, so a change or a rewrite may keep the target's own type.
- **The fresh plan check's decisions, confirmed**: the notes-aware `CONTEXT_TOO_LARGE` copy shows the served message, with no contract change (D-29); `QUESTIONNAIRE_ANSWERED` becomes a closed 409 reason refused at enqueue, the rule unchanged (Q-1); the questionnaire's signal baseline is its newest completed generation or proposals run (S-2, item 6), recorded by a dated note of 2026-10-11 in `docs/contract-gaps/phase-13-request-notes.md`.

### 2026-10-13 — Answer citation identity amendment (BE-06)

**Status:** approved by the pilot during the Phase 15 review fixes. **Affected workstreams:** CSRM only; shared Strapi implementation and the existing Phase 12 run record. No content type, grant, published response contract or answer-value storage changes.

The v4 `contextSummary.questionnaire` section may additionally hold `answerSources: [{ ref, questionDocumentId }]`. Each entry contains only a context-time `Qn` reference and its question's documentId, never question text, help text or an answer. The list is optional for backward compatibility, capped at 200 entries and at the submitted-answer count, with unique references and identifiers. References must identify questions offered by that context. A rewrite or withheld-answer context holds an empty list; a questionnaire-wide context maps only active, visible submitted answers actually offered as sources.

At the analyst-only proposals read, resolve the preserved identifier against that questionnaire's current active questions. Its citation label is `Answered question: {question text}`. If the question was removed, is missing, or the legacy run has no map, use the neutral `An answered question` fallback. Never infer identity from current ordering. Existing runs remain unchanged and continue to parse. The map follows the existing analyst-only provenance boundary and persists no answer content.

## Phase 16 amendment (2026-10-01): risk proposals, decisions and per-field run references

Decided in Phase 16 (16-CONTEXT D-03, D-25 and D-39 to D-41, and its Orchestrator Confirmations of 2026-10-01) and written on 2026-10-15 by plan 16-01, before any code writes these shapes. It extends the Phase 15 amendment above, as that amendment's "Migration" anticipated, on Phase 15's one proposal model: an immutable proposal, decision event v2, and item states folded from the decisions. Phase 16 stores no `itemStates` and no `openProposals` counter, and adds no second proposal model (Orchestrator Confirmation "One proposal model, Phase 15's"). `CsrmAiRun` and `CsrmRisk.aiProvenance` already hold everything needed, so no content type, attribute, relation or Strapi enumeration changes through this amendment; Phase 16's two content-type changes (the withdrawal facts and the Risk history) are in `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`. Every parser stays closed, versioned and fail-safe.

### Run operations

- **Two operations.** `AiRunOperation` (`AI_RUN_OPERATIONS` in `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts`, and `AiRun.operation` in the API contract) gains `risk-suggestions` and `risk-rewrite`. `operation` stays a string of at most 64 characters.
  - `risk-suggestions` ("Suggest more risks") is assessment-wide: the AI proposes Risks the assessment is missing. It sets `assessmentRequest`, `assessment` and `initiatedBy`, with the other relations as the assessment draft's run sets them; `risk` stays unset. It is context-wide for the assessment in the sense of Phase 13 D-29 (`CONTEXT_WIDE_AI_OPERATIONS`), so its completed run can be the baseline of the assessment's "AI inputs changed" signal (the Phase 16 amendment to `docs/contract-gaps/phase-13-request-notes.md`).
  - `risk-rewrite` ("Rewrite this risk") is Risk-scoped: the AI proposes new values for one active Risk's AI-writable fields. It sets the same relations and the run's `risk` relation. It is never context-wide and never moves the signal's baseline.
- **Provider settings.** Both use the assessment draft's provider settings (provider, model, timeout and output-token limit) and record the provider name and version as every run does.
- **The instruction.** Both take Phase 15's optional instruction with its bounds, validator and Requestor-text guard unchanged (`analyst-instruction.ts`; 1 to 500 characters, line feed only), stored in `instruction` and sent only in the `<analystInstruction>` slot. A Security Analyst who raised the request is refused with 403 `OWN_REQUEST` at every start, retry, proposals read and decision on these runs (G-1; Phase 15 D-32).
- **Who starts and retries.** Only a human Security Analyst in the assessment's review scope, after the editable guard passes at enqueue and again at execution, and after the AI data policy passes at both (Phase 12 D-26 to D-29). A retry is a new attempt and a new run, initiated by the retrying analyst (Phase 13 D-18).

### Risk proposal envelope v1

Both new operations store this envelope in `proposal`. It is written once, by the transaction that completes the run, and never changed:

```text
{
  schemaVersion: 1,
  operation: "risk-suggestions" | "risk-rewrite",
  outcome: "items" | "no-change",
  items: [SuggestionItem] | [UnitItem],
  adjustments: [{ code, wireIndex?, count?, detail }]
}

SuggestionItem = {
  key: "s-1" … "s-8",
  kind: "risk",
  proposed: <Phase 12's internal draft risk v2 shape: the twenty AI-writable fields,
             citations, uncited claims and suggested controls>,
  similarTo: { kind: "active" | "withdrawn" | "rejected" | "open",
               riskDocumentId?, runId?, itemKey?, score } | null
}

UnitItem = {
  key: "u-{unit}",
  kind: "change",
  riskDocumentId,
  fields,            // the unit's field names
  base,              // { field: value } the Risk held when the context was built
  proposed,          // { field: value } the AI proposes
  sources?,          // on the statement units
  uncited?,          // the unit's claims that cite no source
  aiAccept?          // true on a treatment unit that proposes the Accept action
}
```

- **`outcome`** is `no-change` when the AI proposed nothing new (no suggestion kept, or a rewrite whose values equal the Risk's), and then `items` is empty.
- **Suggestion items** hold one complete proposed Risk each, in the shape Phase 12's draft adapter and context-aware closed parser produce (Phase 12 D-15): system and asset from the request's own records, classification from the asset, ratings derived by `apps/backend/src/csrm/risk-scale.ts`, the Accept rule applied, suggested controls from the bounded candidate set. `similarTo` names the record a kept suggestion resembles (an active or withdrawn Risk by `riskDocumentId`, a rejected or open item by `runId` and `itemKey`) with its score, or is null.
- **Unit items** (`risk-rewrite`): one item per unit that changes, keyed by its unit. The units are `risk-type`, `issue-statement`, `risk-statement`, `risk-category`, `risk-sub-category`, `risk-cause`, `potential-impact`, `information-system`, `information-asset` (with `dataClassification`), `inherent-rating` (likelihood, consequence and the derived rating), `inherent-rating-rationale`, `residual-rating` (likelihood, consequence and the derived rating), `residual-rating-rationale`, and `treatment` (action and plan together, when the action changes to Accept), otherwise `treatment-action` and `treatment-plan` separately. Fields that derive from one another form one unit, decided together, so a Risk never holds an inconsistent combination (D-36). `base` and `proposed` hold values normalised exactly as the Risk update path stores them (strings trimmed, relations as documentIds, null for absent), so "unchanged" and "stale" compare like with like. A unit outside the requested `focus` is dropped (`outside-focus`).
- **Adjustments**: at most 60, Phase 15's shape, with `detail` CSRM's own sentence of at most 500 characters, never model or Requestor text. `code` is one of thirteen: `near-duplicate-active`, `near-duplicate-withdrawn`, `near-duplicate-rejected`, `near-duplicate-proposed`, `invalid-item`, `over-limit`, `accept-not-permitted`, `accept-with-planned-control`, `sources-dropped`, `suggestions-dropped`, `suggestions-capped`, `outside-focus` and `no-change`.
- **Dispatch by operation.** A reader chooses the parser by the run's `operation`, never by `schemaVersion`: the two new operations parse only this envelope, Phase 15's operations only theirs, and Phase 12's operations only the internal proposal v2. `AI_RUN_BOUNDS` applies unchanged. As for every proposal, this is provider output validated against the context, read only by human Security Analysts; a Requestor never reaches a run.

**Stale.** A unit is stale when the Risk's current values for its fields differ from `base`. Staleness is derived on every read and checked again inside the decision transaction, against the Risk as the earlier decisions of the same batch leave it. A stale unit can only be rejected: its confirmation is refused with `AI_PROPOSAL_STALE` and persistence stays deep-equal (D-37). A suggestion item has no base: it creates a new Risk.

### Decisions and item states

Decisions on these runs append **Phase 15's decision event v2** (`schemaVersion: 2`) to `decisions`, folded by Phase 15's item core (`apps/backend/src/csrm/ai/proposal-items.ts`) unchanged. A v1 event on a `risk-rewrite` run is refused and nothing is written; on a `risk-suggestions` run, Phase 12's v1 field and suggested-control events for a Risk the run added are accepted beside the v2 item events (Phase 16 execution amendment, 2026-10-16, below). The event's `item` is a key of this run's proposal (`s-1` to `s-8`, or `u-{unit}`). The Risk payloads are:

- **`before`**, on the accept of a unit: `{ riskDocumentId, values, fieldFacts }`, the unit's field values before the accept and each unit field's Phase 12 per-field fact before the accept (or null where the field had none), so an Undo restores both.
- **`applied`**, on the accept or restore of a unit: `{ riskDocumentId, values }`; on an added suggestion: `{ riskDocumentId }`, the Risk it created.
- **`edits`** is never written on these runs: Phase 16 offers no "Edit, then confirm" (16-UI-SPEC UI-D18).
- **`reason`**, on a rejection: 1 to 500 characters, optional.
- **`cause`** gains two kinds beside Phase 15's `newer-rewrite`: `{ kind: "risk-withdrawn", riskDocumentId }` and `{ kind: "assessment-not-editable" }`. `newer-rewrite` and `risk-withdrawn` are accepted only with `superseded`, and `assessment-not-editable` only with `lapsed`; Phase 15's `questionnaire-frozen` stays on questionnaire runs.

**Item state is the fold** of Phase 15's table, never stored. Superseded and lapsed are final. A repeated identical decision is a no-op. A decision on an item that is no longer open, whether decided, superseded or lapsed, is refused with `AI_PROPOSAL_ALREADY_DECIDED` (Orchestrator Confirmation "One reason code").

**The decision operation.** Phase 12's `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` gains the entry `{ target: { kind: "proposal", runId, item }, action: "accept" | "reject" | "restore", reason? }`. `reject` and `reason` are valid only on a `proposal` target, and `dismiss` stays only on Phase 12's suggested-control targets, so neither verb leaks across. The batch stays all or nothing, 1 to 200 entries, applied in the order sent; every named run must be a completed `risk-suggestions` or `risk-rewrite` run of the path's assessment (404 for the whole batch otherwise), and an unknown item is a 400. Every decision passes the one editable guard (`ASSESSMENT_NOT_MUTABLE`), runs inside the assessment's serialisation, and refuses with `RISK_WITHDRAWN` when its Risk is withdrawn.

- **Accept a suggestion** ("Add to assessment"): creates the Risk through the existing create path, in one transaction with its `created` history row (source `ai-run`, the run and the item) and the decision event. The Risk arrives as a drafted Risk does, its AI-written values `proposed` in its `aiProvenance` with their citations, uncited claims and suggested controls, reviewed per field with Phase 12's decisions and gated by Phase 12's `aiProposalsReviewed`. It has no Undo (D-33): a restore of an added suggestion is refused with `AI_PROPOSAL_UNDO_UNAVAILABLE`, and a wrong addition is withdrawn.
- **Accept a unit** ("Confirm"): checks the base (`AI_PROPOSAL_STALE`) and the Accept rule after the units confirmed in the same batch (`AI_ACCEPT_NOT_PERMITTED` when the residual rating would be High or Critical; `AI_ACCEPT_WITH_PLANNED_CONTROL` while the Risk has a Planned implementation, through Phase 12's `riskHasPlannedControl`), then applies the values through the Risk update path, which writes the history `updated` row (source `ai-run`) and sets each unit field's per-field fact to `accepted`, by the confirming analyst, naming the rewrite run.
- **Reject**: records the decision with its optional reason and changes no Risk value.
- **Restore** (Undo): returns a rejected item to open; returns a confirmed unit to open by writing `before.values` and `before.fieldFacts` back, only while the Risk still holds `applied.values`, otherwise 409 `AI_PROPOSAL_UNDO_UNAVAILABLE`.
- **The edit transition** (D-23): a batch that confirms a unit, adds a suggestion or restores a confirmed unit takes the accepted-edit transition once; a batch of only rejections and restores of rejections takes none.

**Supersession.** When a newer `risk-rewrite` of the same Risk completes with at least one unit, every open unit of an older rewrite run on that Risk receives `superseded`, `by` the newer run's initiating analyst, with `cause: { kind: "newer-rewrite", runId }`. A newer run that fails or finds no change supersedes nothing. When a Risk is withdrawn, every open unit of a rewrite run on it receives `superseded`, `by` the withdrawing analyst, with `cause: { kind: "risk-withdrawn", riskDocumentId }`, in the withdrawal's transaction. A reinstatement reopens nothing. A newer `risk-suggestions` run supersedes nothing: open suggestions stay open beside the new ones (D-40).

**Lapse.** When a run completes and the editable guard finds the assessment no longer editable (for example released while the job ran), the run still completes and every item receives `lapsed`, `by: "system"`, with `cause: { kind: "assessment-not-editable" }`.

**Advisory only.** Supersession and lapse close an item without applying it. Nothing applies an item without a human Security Analyst's decision, and nothing here accepts a Risk, releases an assessment or decides for anyone (AGENTS.md).

### Open items, the run bound and the fail-safe direction

- **The open set** of an assessment is derived on each read from its completed `risk-suggestions` and `risk-rewrite` runs (by the run's `assessment` relation): the items whose folded state is open. Nothing stores it.
- **The proposals read** (`GET /api/v1/risk_assessments/{assessmentId}/ai_proposals`) serves the open items and the 50 most recently decided ones, with each run's facts (operation, initiating analyst, time, provider, instruction) and each item's state, decider, time, reason and cause.
- **Release readiness** gains the assessment-scope requirement `aiProposalsDecided` (label `Decisions on AI proposals`, destination `ai-proposals`), outstanding while the derived open count is above zero; the release operation refuses while it is outstanding, as for every outstanding requirement (D-42). Phase 12's undecided suggested controls keep their own rule.
- **The run bound.** An assessment holds at most 100 completed risk proposal runs, both operations counted together, which bounds the fold. A start at the bound is refused with 409 `AI_PROPOSAL_RUN_LIMIT` before a job is queued, and a job that finds the bound reached when it executes fails with the same code before any run is created or any provider is called.
- **A damaged run.** A run whose `proposal` or `decisions` do not parse, or whose fold meets an event naming an unknown item or an illegal transition, counts as having no open item, is logged once per read, and none of its items can be confirmed or restored.
- **The fail-safe direction.** `aiProposalsDecided` protects no access: it keeps the analyst's review in order. So readiness fails open on a damaged run, and a damaged run never blocks release. Access gates keep reading only their dedicated facts, never a run.

### Per-field run references in a risk's aiProvenance

One Risk can now hold field values proposed by several runs: its draft, the suggestion that created it, and any number of confirmed rewrites. Phase 12's Risk `aiProvenance` v1 therefore gains one optional key on each per-field fact, `runId`: the documentId of the run that proposed the field's value, 1 to 255 characters. The envelope stays `schemaVersion: 1`, as Phase 10 and Phase 15 kept their envelopes for added keys, and the closed parser declares the key.

- Every per-field fact written from Phase 16 on carries its `runId`: a field confirmed from a rewrite unit names that rewrite's run; a Risk added from a suggestion names the suggestion run on each field, and its envelope's `runId` and `proposalKey` name that run and item.
- The envelope-level `runId` is demoted to the read-time default for facts written before Phase 16: readers resolve `fact.runId ?? envelope.runId`, so a field from the draft still resolves to the draft run.
- A Risk with no `aiProvenance` (created by hand) gains the envelope when its first rewrite unit is confirmed, with that run and unit as its `runId` and `proposalKey` and empty uncited claims, suggestions and adjustments.
- An analyst's later edit of such a field makes it `edited` as today and keeps its `runId`.

### Context summary: risk proposal section

Phase 15's v4 is followed by **the context summary v5**: v4's envelope with `schemaVersion: 5`, plus one required, nullable section:

```text
riskProposals: {
  scope: "assessment" | "risk",
  risksListed, withdrawnListed, rejectedListed, openListed,
  controlsListed: <number> | null,
  focus: ["statement" | "ratings" | "treatment"] | null
} | null
```

- Every context built after this amendment is implemented writes v5. `riskProposals` is set for the two new operations and null for every other operation; `questionnaire` is null for the two new operations.
- `scope` is `assessment` for `risk-suggestions` and `risk` for `risk-rewrite`. `risksListed` counts the active Risks listed ("already in the assessment", or for a rewrite the other active Risks); `withdrawnListed`, `rejectedListed` and `openListed` count the withdrawn Risks and the rejected and open suggestions listed (zero for a rewrite). `controlsListed` counts the target Risk's control implementations listed, and `focus` the rewrite's focus; both are null for `risk-suggestions`.
- The section reuses Phase 15's `instruction` section unchanged: `analyst` or `default-task` for both new operations.
- The summary holds counts and closed values only: never the instruction's text, never a Risk's text and never Requestor text (G-3).
- The closed parser (`parseContextSummary`) accepts v1 to v5 unchanged and fails safe to null on anything else; an earlier version reads with `riskProposals` null. The summary bound (`CONTEXT_BOUNDS.summaryBytes`, 65,536 bytes) still applies.

### Bounds

| Bound | Value | On excess |
| --- | --- | --- |
| Suggestions kept per run | 8 | adjustment `over-limit` (Phase 16 execution amendment, 2026-10-16) |
| Entries listed in a context (existing, withdrawn, rejected and open, together) | 200 | job failure `CONTEXT_TOO_LARGE`, before any run |
| Completed risk proposal runs per assessment (both operations) | 100 | 409 `AI_PROPOSAL_RUN_LIMIT` at enqueue; the same job failure code at execution |
| Decisions per batch | 1 to 200 | 400 |
| Reject reason | at most 500 characters | 400 |
| Recently decided items in the proposals read | 50, newest first | older decided items are not served |
| Instruction | Phase 15's: 1 to 500 characters, line feed only, the Requestor-text guard | Phase 15's three 400 reasons |
| Rewrite focus | a non-empty unique subset of `statement`, `ratings` and `treatment`; absent means all | 400 |
| Near-identical (dropped) | the Risk Types match (both null counts as a match) and Phase 15's `isNearDuplicate` holds on statement plus cause | adjustment `near-duplicate-active`, `-withdrawn`, `-rejected` or `-proposed` |
| Similar (kept and flagged) | token-set Jaccard of statement plus cause at least 0.5 | `similarTo` on the item |

Phase 12's bounds are unchanged: the draft's prompt budget and `AI_RUN_BOUNDS` (a 1,048,576-byte proposal, 5,000 decision events, a 65,536-byte summary).

### Closed reasons

**One new closed reason** joins Strapi's `CONFLICT_REASONS`, both conflict response schemas of `docs/references/specification.json` (`AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`) and the web's list: 409 `AI_ACCEPT_NOT_PERMITTED`, confirming an AI-proposed Accept whose residual rating, after the batch's units, would be High or Critical (D-38). `RISK_WITHDRAWN`, `RISK_NOT_WITHDRAWN` and `REQUEST_HAS_ASSESSMENT` are added by the Phase 16 record.

These are reused: `ASSESSMENT_NOT_MUTABLE`; `AI_PROPOSAL_ALREADY_DECIDED` (no `AI_PROPOSAL_NOT_OPEN` is added); `AI_PROPOSAL_STALE`; `AI_PROPOSAL_UNDO_UNAVAILABLE`; `AI_PROPOSAL_RUN_LIMIT`; `AI_ACCEPT_WITH_PLANNED_CONTROL` with `riskHasPlannedControl` (no second reason or predicate); 403 `OWN_REQUEST`; Phase 15's three instruction reasons; and `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED`.

**Job failure codes** stay free strings of the registry's safe form: `CONTEXT_TOO_LARGE` and `PROVIDER_OUTPUT_INVALID` as job codes only, and the state reasons a job re-checks before its provider call (`ASSESSMENT_NOT_MUTABLE`, `AI_PROPOSAL_RUN_LIMIT`, for a rewrite `RISK_WITHDRAWN`, and the two AI policy codes). An assessment that stops being editable after the provider call lapses the items instead of failing the run.

### Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-15 that section's workstream table lists `csrm` and `iam`. `csrm`, whose application is `apps/csrm`, is the only reader of `CsrmAiRun` and the only caller of the operations below. `iam` reads none of them: on 2026-10-15, `grep -rlE "csrm-risk|CsrmRisk|risk_assessments|assessment_requests|csrm-assessment-request|AiRun|ai_runs|ai_proposal|/v1/risks|REQUEST_HAS|aiInputsChanged|contextSummary" .planning/workstreams/iam/` printed nothing (exit status 1). This amendment is backward compatible for any later reader:

- every run written before it reads unchanged: Phase 12's envelopes, its v1 decision events, Phase 15's questionnaire envelope and decision events v2, and the v1 to v4 summaries still parse, and the new versions apply only to the two new operations or, for the summary, only to runs built after it;
- a per-field fact without `runId` reads as today, resolving to the envelope's run;
- no content type, attribute, relation, Strapi enumeration value or existing grant changes through this amendment.

It changes these existing endpoints, each reached only by `csrm`'s application and changed with its web parser in the same plan (the 06.9 lesson):

1. **The AI run read** (`GET /api/v1/ai_runs/{runId}`): `AiRun.operation` and the summary's `operation` gain `risk-suggestions` and `risk-rewrite`; `AiRunContextSummary.schemaVersion` gains 5 with the required, nullable `riskProposals`; for the two new operations `proposal` holds the risk proposal envelope v1 and `decisions` the v2 events with Risk payloads, dispatched by `operation`. Compatible: added values and a new version beside the old ones; the read stays human Security Analyst only.
2. **The decision operation** (`POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions`): `AiProposalDecisionRequest` entries gain the `proposal` target, the `reject` action and its optional `reason`. Compatible: Phase 12's entries parse and behave as today, and the response is unchanged.
3. **Release readiness**: the analyst detail's `releaseReadiness` gains `aiProposalsDecided`, and the release operation refuses while it is outstanding. Compatible: it is met whenever no risk proposal is open, which holds for every assessment until a Phase 16 AI operation runs.
4. **Closed reasons**: `AI_ACCEPT_NOT_PERMITTED` joins both conflict enums. Compatible: an added value, returned only by a decision this amendment adds.

The new operations (the two starts, the job read and retry, and the proposals read) are new, not changes, and are listed in the Phase 16 record.

### Migration

None for this amendment. No content type changes through it, so there is no schema sync and no freeze entry of its own (the Phase 16 record's freeze check lists its two schema files). Runs and Risk provenance written before it read unchanged through the closed parsers, which accept the earlier versions beside the new ones and fail safe on anything else; no stored run or provenance envelope is rewritten. Phase 17 extends this amendment, adding its operation on the same unit mechanism and decision event v2, rather than restating it.

Phase 16 amendment status: **approved by the pilot on 2026-10-15** (G-6).

What the pilot checked (2026-10-15): the text against the frozen JDL (`docs/references/idambox-datamodel.jdl`: `CsrmRisk`, `CsrmAssessment`, `IdamBoxUser`, `CsrmTreatmentAction`; no competing entity or status, `closureDate` and `treatmentStatus` keep their meanings), `docs/references/specification.json` and the role-function catalogue (every new Function granted to `role.security_analyst` only, no existing grant changed), AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; AI output is advisory and never accepts, releases or closes; JDL terminology; no hard delete; the released record stays immutable), 16-CONTEXT and the 2026-10-15 fresh plan check (iterations 2 to 4), and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section names `csrm` as the only reader, the `iam` grep is empty, and every changed endpoint stays backward compatible for existing callers. The pilot confirms: the per-field `runId` is an optional key with the envelope kept at `schemaVersion: 1`, a hand-made Risk gains the envelope on its first confirmed rewrite unit, the decision entry's optional `reason` is additive, and restoring an added suggestion or a changed confirmed unit is refused with `AI_PROPOSAL_UNDO_UNAVAILABLE`. An AI-proposed Accept stays the analyst's proposal to confirm under `AI_ACCEPT_NOT_PERMITTED` and `AI_ACCEPT_WITH_PLANNED_CONTROL`; risk acceptance itself stays the owner's (Phase 17.1).

## Phase 16 execution amendment (2026-10-16): field review of an added Risk, and the suggestion cap's code

Found while executing 16-10 (`.planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/deferred-items.md`). Two clarifications of the Phase 16 amendment above; no schema, endpoint, Function or grant changes.

1. **Phase 12's v1 events on a `risk-suggestions` run.** A Risk added through "Add to assessment" carries the suggestion run in its `aiProvenance` envelope (`runId`, `proposalKey`), as this record requires, and is "reviewed per field with Phase 12's decisions". Phase 12's field review (`Confirm remaining`, field confirm and reject, suggested-control decisions) and a human analyst's edit of a proposed field append Phase 12's v1 events to the envelope's run. On a `risk-suggestions` run those v1 events are accepted, beside the run's v2 item events, when their `target` is a Risk that this run added (its `created` history row names this run and item). The run record parses the two families by `schemaVersion`; the item fold reads only the v2 events and Phase 12's field-review fold reads only the v1 events, so neither changes the other's state. A v1 event for any other target, a v1 event on a `risk-rewrite` run, and a v2 event on a Phase 12 run stay refused, and nothing is written. Release stays gated by Phase 12's `aiProposalsReviewed` for the added Risk. This keeps one audit trail per run: every AI-written value of the added Risk is decided on the run that proposed it, and no decision is taken without its run record (WR-103).
2. **The suggestion cap's adjustment code.** Suggestions past the eighth kept per run are recorded with the adjustment `over-limit` (one adjustment with a `count`), not `suggestions-capped`. `suggestions-capped` keeps its existing meaning: suggested controls past five on one Risk. The thirteen codes listed above are unchanged.

Options considered for item 1: pointing the added Risk's envelope at the assessment's draft run (rejected: it records the review of the suggestion's fields on a run that did not propose them), and skipping the v1 audit event on proposal runs (rejected: it weakens WR-103 and decision 6's "who, when and why").

Phase 16 execution amendment status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): the 16-10 probe (`confirm` and `edit` on an added Risk both answered 409 `AI_RUN_RECORD_UNAVAILABLE`) and the three options in `deferred-items.md`; AGENTS.md (AI output stays advisory and never accepts, releases or closes; Strapi enforces every rule against the resolved IdamBox User; JDL terminology); decision 6 and WR-103 (no AI decision without its append-only run record, with who, when and why); that the change is confined to which event families a `risk-suggestions` run accepts, with no schema, endpoint, Function, grant or `docs/references/specification.json` change; and `.planning/PROJECT.md` "The shared backend": `csrm` stays the only reader of the run record, so no other workstream is affected. Item 2 records the code's existing behaviour (`risk-proposal-adapter.ts`, `openai-compatible-assessment-draft-provider.ts`).

## Phase 16 code review amendment (2026-10-16, proposed): Phase 12's field review of a value a rewrite confirmed

Found by the Phase 16 code review (`.planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-REVIEW.md`, BE2-01 Critical and BE2-03 Warning). The record above says a Risk created by hand "gains the envelope when its first rewrite unit is confirmed, with that run … as its `runId`", that "an analyst's later edit of such a field makes it `edited` as today", and (amendment item 1) that "a v1 event on a `risk-rewrite` run" stays refused. Together they make the edit impossible: Phase 12's edit and field decisions append their v1 event to the envelope's run, which is the rewrite run, the append is refused, and the edit answers 409 `AI_RUN_RECORD_UNAVAILABLE` for good. On a drafted Risk, the same v1 events for a field a rewrite confirmed land on the draft run, which did not propose that value (decision 6, WR-103).

Proposed, with no schema, endpoint, Function, grant or `docs/references/specification.json` change:

1. **Each v1 field event goes to the run that proposed the field's value.** Phase 12's `edited`, `accepted`, `dismissed` and `restored` events for a Risk's fields are appended to `fieldRunId(provenance, field)` (`fact.runId ?? envelope.runId`), not always to the envelope's run. A decision or edit that names fields of several runs is split into one event per run, in one transaction (WR-103). Suggested-control events stay on the envelope's run. The Assessment's envelope is unchanged.
2. **A `risk-rewrite` run takes Phase 12's v1 field events for its own Risk.** Beside its v2 item events, a `risk-rewrite` run accepts a v1 field event whose `target` is the run's own `risk` relation and whose `fields` are all fields of that run's change units. The log is parsed by `schemaVersion` as for a `risk-suggestions` run (amendment item 1): the item fold reads only v2 events, Phase 12's field-review fold only v1 events. Any other v1 event on a rewrite run (another Risk, the assessment, a suggested-control event, a field outside its units) and a v2 event on a Phase 12 run stay refused, and nothing is written.

Options considered: refusing the edit (today's behaviour; it blocks an ordinary workflow, hand-written Risk, rewrite, confirm, fix a word, with an "administrator must repair" message); skipping the v1 event for such fields (rejected for the same reason as before: it weakens WR-103 and decision 6's "who, when and why"); pointing the envelope at the draft run (rejected: a hand-made Risk has none, and it records the review on a run that did not propose the value).

Phase 16 code review amendment status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): 16-REVIEW.md BE2-01 and BE2-03 against this record's earlier text (a hand-made Risk's envelope names the rewrite run; amendment item 1 refused every v1 event on a `risk-rewrite` run), which together make an ordinary edit fail for good; decision 6 and WR-103 (each field event names the run that proposed the value, with who, when and why, appended in one transaction); AGENTS.md (AI output stays advisory, Strapi enforces every rule against the resolved IdamBox User, JDL terminology); that the change is confined to which event families a run accepts and where Phase 12's field events are appended, with no schema, endpoint, Function, grant or `docs/references/specification.json` change; that every other v1 event on a rewrite run and every v2 event on a Phase 12 run stay refused; and `.planning/PROJECT.md` "The shared backend": `csrm` stays the only reader of the run record. The integration test that asserted the 409 (`risk-proposal-decisions.integration.test.ts`) is to be rewritten to expect the edit recorded on the rewrite run, RED first.

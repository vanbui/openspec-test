# Phase 12: AI context, suggestions and provenance - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`. Every gray area took the recommended option, grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#5, #6, #8, #14, G-1, G-3, G-6, G-7);
- the orchestrator's seeds for this unit;
- a read of the code each finding names.

There is no SPEC.md for this phase. The discussion log is `12-DISCUSSION-LOG.md`, and `12-RESEARCH.md` carries the evidence (file and line references) behind each decision.

<domain>
## Phase Boundary

Give both AI operations one reviewable assessment context built from everything the request holds, and make every AI proposal visible, cited and accountable until a Security Analyst accepts or edits it. The phase closes seven findings (UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043, UAT-044) and delivers INT-05, INT-06, ASSESS-08 and QUES-10. It is the foundation of the Phase 9 intent: Phases 15, 16 and 17 build on its assessment context, run record and provenance.

In scope:
- the shared assessment context builder, used by questionnaire generation and assessment draft generation;
- the new draft and questionnaire wire shapes, adapters, parsers and deterministic providers;
- suggested controls as one-click proposals, and "Accept" proposals within decision 8;
- per-field provenance and the AI run record, through a contract-gap record approved at a checkpoint (G-6);
- the AI data policy: the request's data classification, the provider's approved ceiling, and the transcript flag (G-3, G-7);
- help text on questions, end to end;
- the provenance and disclosure surfaces for both actors;
- R-08-42, the analyst service agent's request grants.

Out of scope: analyst instructions to the AI and any re-run (Phases 15 and 16); risk withdrawal (Phase 16); residual reassessment (Phase 17); controlled scales in the risk editor and the API (Phase 18); configurable scales, ceiling and active Risk Types (Phase 22); notes and attachments in the context (Phases 13 and 14); the failed-run dashboard (Phase 21); a shared job store; Keycloak; live AI generation in any automated suite.
</domain>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** The only content-type changes are the run record and per-field provenance. They go through `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` in JDL terms, and a `checkpoint:decision` where the orchestrator reviews and approves the record (G-6), before any schema file changes. The changes are:
  - a new content type, `CsrmAiRun` (the run record, D-19);
  - one optional JSON attribute, `aiProvenance`, on `CsrmRisk` and on `CsrmAssessment` (D-21).

  Nothing else changes:
  - question provenance is derived from the governance log (D-22);
  - `CsrmQuestion.helpText` already exists (D-17);
  - the active Risk Type flag waits for Phase 22 (D-09).

  **Reversibility:** one-way - a new table and persisted JSON facts; undoing them needs a data migration.
- **D-02:** Every new or changed endpoint follows the established chain:
  - exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical;
  - record-level checks in Strapi;
  - the operation or schema in `docs/references/specification.json`, then `api:generate` and a clean `api:check`;
  - closed Zod parsers registered in the contract parity guard;
  - a row in the six-actor authorization matrix;
  - `docs/references/served-operations.json` regenerated with the dev servers stopped.

  The server shape and the web parser change in the same plan (the 06.9 lesson).
- **D-03:** The API changes are these, and no others (each is detailed in `12-RESEARCH.md`, "Contract changes"):
  1. **Question reads** gain `helpText`, and analyst reads gain each question's AI origin (D-17, D-22).
  2. **The questionnaire summary** gains `aiAssisted` for both actors, and a `generation` block for analysts.
  3. **The analyst assessment detail** gains a `generation` block, the assessment's `aiProvenance`, and each risk's `aiProvenance` (D-21, D-23).
  4. **The Requestor's released assessment** gains `aiAssisted` (D-23).
  5. **Release readiness** gains an "AI proposals reviewed" requirement, at assessment and risk scope (D-21).
  6. **One new read,** `GET /api/v1/ai_runs/{runId}` (D-25).
  7. **One new decision operation,** `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` (D-24).
  8. **Phase 10's generation-jobs read** gains the request's AI policy status (D-29).
  9. **Closed conflict reasons** for the policy refusals and the decision refusals are added to Phase 10's reason list (D-28, D-24).
  10. **Catalogue moves and withdrawals** for human-initiated generation and R-08-42 (D-32, D-33). These are grant changes, not new operations.

  **Reversibility:** costly - published contract fields and operations.

### The assessment context (INT-05; UAT-030)

- **D-04:** One assessment context builder serves both operations. It is a deep module in `apps/backend/src/csrm/ai/`: it loads its own records, and returns the model-facing context, the run's context summary, its source catalogue and the policy decision. It holds:
  - **Request fields:** title, description, assessment type, division, business unit, business purpose, business criticality, third-party involvement, third-party details and regulatory requirements.
  - **Systems and assets:** each selected information system (name, description, type, environment, deployment model, criticality, internet-facing, external access, hosting location, lifecycle) and each selected information asset (name, description, type, location, data classification, confidentiality, integrity and availability ratings, and the personal, legal and card-data flags).
  - **Questions, for draft generation only:** every active, visible question, with its section, text, help text, answer type and the Requestor's submitted answer, rendered with choice labels and "Not answered".
  - **The active Risk Type library** (D-09), sent to both operations. Questionnaire generation uses it to choose topics.
  - **Control candidates, for draft generation only** (D-12).

  Data minimisation (G-3): the builder never sends the Requestor's or sponsor's identity, owners' names, request or record numbers, dates, revert reasons or asset comments. `12-RESEARCH.md` holds the field-by-field table.
- **D-05:** The prompt has three slots.
  1. **System instructions:** written by CSRM, and trusted.
  2. **An analyst instruction slot:** trusted but bounded (decision 5). It is empty in Phase 12, and Phase 15 fills it. It never holds Requestor text.
  3. **The data block:** every Requestor-originated value (request text fields and answers now, notes and attachment text later), each wrapped by the existing `promptDataTag` escaping inside a delimited block that the system instructions declare untrusted data, never instructions.

  Reference data (systems, assets, Risk Types and controls) is also passed as tagged data. The model gets no tools.
- **D-06:** Size bounds, with no silent truncation (06.7 D-10 stands):
  - **Requestor text** (request fields and answers) is sent whole.
  - **Reference libraries** are bounded by count. When a library exceeds its bound, a deterministic relevance ranking selects what is offered, and the run's context summary records what was offered and how many were left out. Proposed bounds: 60 Risk Types, a control candidate set of at most 150 and 100 selected systems or assets.
  - **Anything over a hard bound** fails the job before any provider call, with `CONTEXT_TOO_LARGE` and a plain message. That covers the total context character budget and more than 100 selected systems or assets.
  - **Wire schemas** stay within the documented strict structured-output subset of the G-7 production target (Azure OpenAI): no `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` or `const`, at most 100 object properties, and at most five levels of nesting. Bounds move into the adapters and parsers.
- **D-07:** The analyst can see what a run used. A "What the AI used" disclosure on the questionnaire governance page and the assessment editor reads the run (D-25). It shows:
  - the request fields included;
  - the number of questions and answers;
  - the systems and assets, with their classifications;
  - the Risk Types and control candidates offered, and how many were left out;
  - the request's classification and the policy decision;
  - the provider, model, time and initiating analyst;
  - a digest of the exact context sent.

  The run record keeps a context summary, not the Requestor's text (G-3). The Requestor never sees a run.
- **D-08:** The builder has named extension points for notes (Phase 13, COLLAB-01 criterion 3) and extracted attachment text (Phase 14, COLLAB-02 criterion 5). Both enter the untrusted data block and the context summary, and both are subject to the same classification check. Phase 12 builds neither.

### Draft generation (ASSESS-08; UAT-029, UAT-031, UAT-042, UAT-044)

- **D-09:** The draft draws on the active Risk Type library (decision 14). `CsrmRiskType` has no active flag, so every Risk Type counts as active until Phase 22 adds the Admin's active flag. Research finds no need for a separate "AI-eligible" flag.
  - **Bounds:** the library is bounded at 60 types, ranked by relevance when larger, with descriptions capped.
  - **Several risks per type:** the parser's one-risk-per-type rule goes.
  - **No fitting type:** a risk may carry no Risk Type ("No matching Risk Type") rather than be forced into a wrong one, as happened to UAT-C's API-key risk.
  - **Order:** risks keep the shared Risk Type ordering rule (08 D-09), with no type last and the model's order kept within a type.
- **D-10:** The model proposes likelihood and consequence on the 5 × 5 scales of decision 8, and CSRM derives every rating:
  - inherent and residual ratings are the product of the two scores, banded 1–4 Low, 5–9 Moderate, 10–16 High and 20–25 Critical;
  - the overall rating is the highest derived residual rating.

  The model outputs no rating, and the parser re-derives each rating and rejects a mismatch. The vocabulary and derivation live in one shared module, `apps/backend/src/csrm/risk-scale.ts`.
  - **Phase 18** imports the module to enforce the closed vocabulary on risk create and update, adds the web mirror, and adds the override with a reason.
  - **Phase 22** sources the module's scales, bands and appetite from Admin configuration; its interface stays.
  - **Phase 12** does not change the risk editor's likelihood and consequence inputs.

  **Reversibility:** costly - the draft schema and stored AI values use the vocabulary.
- **D-11:** "Accept" follows decision 8.
  - **Only Low or Moderate:** the AI may propose Accept only when the derived residual rating is Low or Moderate, and only with a rationale. The rationale is the risk's treatment plan text, the plan for an accepted risk.
  - **Enforced by the adapter:** an Accept for a High or Critical residual rating, or without a rationale, becomes Treat. The adjustment is recorded in the run's proposal.
  - **The analyst confirms:** an AI-proposed Accept is marked like any AI value until the analyst accepts or edits it.
  - **Later phases:** acceptance authority is Phase 17.1's (G-2). The appetite rule reads from the scale module (D-10), so Phase 22 can change it.
- **D-12:** Suggested controls are one-click proposals drawn from the whole control library.
  - **Candidates:** a bounded set, made of each offered Risk Type's applicable controls plus a deterministic lexical shortlist of the whole library ranked against the context. It holds at most 150 controls; the model sees their numbers and names.
  - **Per risk:** the model picks at most five candidates, each with a short rationale.
  - **Storage:** suggestions persist in the risk's `aiProvenance`.
  - **Add:** "Add as planned control" creates a control implementation with status Planned for that control, through the decision operation (D-24).
  - **Dismiss:** a dismissal is recorded (decision 6).
  - **Already present:** a suggestion whose control is already implemented on the risk shows as added.
  - **Release:** suggestions never block release.
  - **Never automatic:** nothing becomes a control implementation without the analyst.
- **D-13:** Draft risks are pre-filled from the context for the analyst to confirm:
  - **Impacted system and asset:** chosen only from the request's own selected systems and assets.
  - **Data classification:** taken from the chosen asset's recorded classification, never from the model.
  - **Marked:** each pre-filled value is AI-proposed (D-21).
- **D-14:** Citations and uncited claims:
  - **Per statement:** each statement field cites the context sources it used: issue statement, risk statement, cause, impact, both rating rationales and the treatment plan, and at assessment level the summary, the overall rationale and the recommendations.
  - **Sources:** request fields, answers (by question), systems and assets.
  - **Unknown sources:** the adapter drops unknown source ids, so one bad citation never fails a draft. A statement left with no source is flagged "No source cited".
  - **Uncited claims:** the model lists, per risk, up to five claims it could not cite, shown as a warning beside the risk. This covers UAT-042's invented patch-status fact.
  - **Where citations show:** each citation shows beside its field and opens the source: the question with the Requestor's answer, or the request field.
- **D-15:** The draft wire shape is versioned (schemaVersion 2) and model-friendly. The adapter assigns:
  - proposal keys (`risk-1`, and so on) and the order;
  - system and asset ids, mapped from the context's short keys;
  - classification and ratings, derived;
  - the Accept rule, enforced;
  - citations and control candidates, filtered to known values.

  The closed parser stays the unconditional gate (06.7 D-07) and now takes the context's allowed Risk Types, sources, systems, assets and control candidates. The deterministic provider produces the same internal proposal and exercises every behaviour: several risks per type, pre-fill, citations, an uncited field and an uncited claim, suggestions, an Accept for a Moderate residual rating, and a risk with no Risk Type where no seeded type fits. Its rules read request fields and the selected systems and assets as well as answers.

### Questionnaire generation (QUES-10; UAT-043)

- **D-16:** Generated questionnaires suit a non-expert Requestor:
  - **Plain language:** plain language and one thing per question; specialist terms are explained in help text or avoided.
  - **Size:** 6 to 20 questions, up from 8 to 15, because compound questions split.
  - **Yes/No questions** are Single select with Yes, No and Not sure; Boolean is no longer generated.
  - **"Not sure":** the adapter ensures every generated Single or Multi select offers "Not sure", added last when the model left it out.
  - **Optional questions:** a question is optional where the Security Analyst can find the answer elsewhere or it is supplementary. The model judges this per question, following explicit guidance.
  - **Help text:** every question carries short help text, at most 2,000 characters (the existing contract bound), with one or two sentences asked for.
  - **Context:** the builder's context (D-04) includes the regulatory requirements, the selected systems and assets with their classifications, and the Risk Type library.
- **D-17:** Help text works end to end:
  - **Stored:** generation writes `CsrmQuestion.helpText`.
  - **Read:** the question read projects it for both actors.
  - **Shown:** the Requestor's questionnaire shows it with its question, as the field hint, and the analyst's governance view and read-only released questions show it.
  - **Edited:** the governance editor's in-place form (Phase 10 D-04, X-5) gains a help text field; the mutation already accepts it.

  This closes the help-text deferral in Phase 10's CONTEXT.
- **D-18:** Generated question keys stay `q-1` … `q-N` within a generation, because a replacement replaces every question and events carry text snapshots (Phase 10 D-10, D-18). Phase 15, which adds questions to an existing questionnaire, needs a key allocator that avoids every existing key, removed ones included. Phase 12 records that seam and does not build it.

### The run record and provenance (INT-06; UAT-032)

- **D-19:** `CsrmAiRun` is the run record, one per provider call. It is designed so Phases 15, 16 and 17 need no further content-type change. It holds:

  | Group | Fields |
  |---|---|
  | What ran | `operation` (a string with a closed vocabulary owned by the API contract: `questionnaire-generation` and `assessment-draft` now, extended by later phases without a schema change) and `status` (`running`, `completed`, `failed` or `interrupted`) |
  | When | `startedAt` and `completedAt` |
  | Who and with what | `initiatedBy` (IdamBoxUser), `providerName`, `providerVersion`, `jobId` and `attempt` |
  | Targets | relations to the assessment request (always set), and to the questionnaire, the assessment and a single risk (each optional; the risk is for Phases 16 and 17) |
  | Inputs | `instruction` (the analyst's instruction, null until Phase 15; never Requestor text) and `contextSummary` (a versioned JSON envelope) |
  | Outputs | `proposal` (the validated internal proposal with its adjustments, a versioned JSON envelope), `decisions` (an append-only, versioned JSON log of accept, dismiss and restore decisions with actor and time) and `failureCode` and `failureMessage` (safe values only) |

  - Runs are never deleted and follow the assessment record's retention.
  - The record supersedes the Phase 4 and 06.2 deferrals of durable provenance, proposal sources, field-level human changes and job audit history (`phase-04-deterministic-draft-jobs.md`, `phase-06.2-questionnaire-generation-provenance.md`, `phase-06.7-ai-provider-provenance.md`).

  **Reversibility:** one-way - a new table holding the audit record.
- **D-20:** The run lifecycle:
  - **Creation:** a run is created with status `running` just before the provider call, after the job's eligibility and policy checks pass. Every provider call has exactly one run, and a refusal before the call creates none.
  - **Completion:** a run completes in the same transaction that persists the questionnaire or draft.
  - **Failure:** a failed run records a safe code outside that transaction.
  - **Retries:** a retry is a new attempt, so it creates a new run.
  - **Restarts:** at bootstrap, runs left `running` by a restart become `interrupted`. This is honest under R-08-36's single-process deployment. The job registries stay in-process, and a shared job store is still needed before Strapi runs as more than one process.
- **D-21:** Per-field provenance on the risk and the assessment:
  - **Storage:** the versioned `aiProvenance` JSON holds the run id, the proposal key, each AI-written field's state (`proposed`, `accepted` or `edited`) with actor and time, its citations, the uncited claims, the suggestions and the adjustments. Derived values (ratings, classification) count as AI-written.
  - **Edited:** an edit through the existing risk or assessment update path that changes an AI-proposed value marks that field `edited`, in the same transaction.
  - **Accepted:** the analyst accepts one field or all remaining fields of a risk or of the assessment through the decision operation (D-24).
  - **Release readiness:** a new requirement, "AI proposals reviewed", is outstanding while any field is still `proposed`, at risk and at assessment scope. No AI value reaches release unreviewed, which keeps the core value: analysts, not the AI, control review and release.
  - **Current fact and history:** following the 06.8 split, `aiProvenance` is the current fact that gates read, and the run's `decisions` log is the history. Both are written in one transaction.
- **D-22:** Question provenance is derived, with no schema change. After the latest generation (`generatedDate`), a question is:
  - AI-proposed while it has no question-added or question-edited event;
  - edited by an analyst once it has a question-edited event;
  - analyst-added when it has a question-added event.

  The rule reuses Phase 10's `countAnalystChangesSinceGeneration` basis. The analyst sees the markers while the questionnaire is in analyst review; release accepts the set. The Requestor sees no per-question marker.
- **D-23:** Where provenance shows:
  - **Analyst, questionnaire and assessment:** a provenance header names the provider label, the model, the generation time and the initiating analyst ("Generated with AI at the request of {analyst}"), with the "What the AI used" disclosure (D-07).
  - **Analyst, per field:** markers show on AI-written fields until they are accepted or edited. After release, only the header shows.
  - **Requestor:** a disclosure says that AI assisted and a Security Analyst reviewed before release. It appears in the questionnaire introduction (Phase 10 D-13), which also now mentions the "Not sure" choice where the questionnaire offers one, and in the released assessment overview.
  - **"Generated by":** the released view's "Generated by {analyst}" label goes (UAT-032). The Requestor sees neither the provider nor the model.
  - **Pre-Phase 12 records:** records generated before Phase 12 have no `aiProvenance`. They show the header from their stored provider facts with a note that per-field tracking began later, and carry no readiness requirement.
- **D-24:** One decision operation per assessment, `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions`, human Security Analyst only.
  - **Batch:** it takes up to 200 decisions per call, each naming its target (the assessment details, a risk, or one of a risk's suggested controls), so bulk actions are one Server Action (Next 16.3 dispatches actions one at a time). The run comes from the target's `aiProvenance`, so a decision always applies to the run that proposed the value.
  - **Decisions:** `accept` (fields of a risk or of the assessment, or a suggested control, which creates the Planned implementation), `dismiss` (a suggestion) and `restore` (an accepted field or a dismissed suggestion back to proposed, so G-4's Undo toast is possible).
  - **Guarded like an edit:** it runs through the assessment's existing mutation serialisation, lock and edit transition, so it records the reviewer like any accepted edit until Phase 17.1's explicit review.
  - **Refusals:** a released assessment is refused with a closed reason. Repeating an applied decision is a no-op, and an unknown item is a 400.
  - **For later phases:** Phases 16 and 17 add run-scoped items (proposals not yet on a record) to the same operation, and Phase 15 adds its questionnaire counterpart.
- **D-25:** One run read, `GET /api/v1/ai_runs/{runId}`, human Security Analyst only.
  - **Returns:** the run's facts, its context summary with the source catalogue that resolves citations, and its outcome; not the proposal.
  - **Unknown run:** 404, with no enumeration.
  - **Finding the run:** the questionnaire and assessment reads carry `generation.runId`. The questionnaire's is resolved at read time as the latest completed run for it; the assessment's comes from `aiProvenance`.

### The AI data policy (G-3, G-7)

- **D-26:** A request's data classification is the highest recorded classification among its selected information assets, ordered Public < Internal < Restricted < Critical Infrastructure Sensitive. With no classified asset it is Internal, the organisation default for unlabelled business information, and the context summary says the default applied. Phase 22 can make that default configurable.
- **D-27:** The provider's approved ceiling is configuration: a new `CSRM_AI_DATA_CLASSIFICATION_CEILING` in `config/ai.ts`, whose values are the four classification labels. It is read through one policy module, the seam Phase 22 moves to an Admin setting.
  - **Development** means both `NODE_ENV` and `CSRM_ENVIRONMENT` are `development`, the same double key as the development identity. There, an unset ceiling means no ceiling, and a set ceiling is enforced.
  - **Everywhere else,** generation is refused until the ceiling is set (fail closed).
  - **An invalid value** fails boot with a clear message.
  - **Every provider:** the policy applies to the deterministic provider too, so suites can prove refusals.

  **Reversibility:** costly - a configuration contract for operators.
- **D-28:** Generation above the ceiling, or with no ceiling in production, is refused:
  - **When the analyst asks:** a 409 with a closed reason, before a job is queued: `AI_CLASSIFICATION_ABOVE_CEILING` or `AI_POLICY_NOT_CONFIGURED`.
  - **When the job runs:** the check is repeated. A job that fails it ends with the same code, and nothing is sent to the provider.
  - **The message** is plain and names the request's classification and the ceiling.
- **D-29:** The hub offers generation only when the policy allows it. Phase 10's generation-jobs read (10-13) gains an `aiPolicy` block (allowed or refused, the reason, the request's classification and the ceiling), and both job panels show the refusal in place of Generate (UX-06 criterion 1).
- **D-30:** The full-transcript diagnostics flag (R-08-12) takes effect only in development (G-7). Elsewhere it is ignored, with a warning at boot. The residual register rows for R-08-12 and R-08-42 are closed with their evidence.
- **D-31:** Approving the hosted provider for production data stays the operator's. Every automated suite pins the deterministic provider, and both harnesses (the Strapi test harness and Playwright's Strapi server) also pin the new ceiling variable empty, so a developer's `.env` cannot change an outcome. No proof calls a live model.

### Roles and least privilege (R-08-42, G-1)

- **D-32:** AI generation is always initiated by a human Security Analyst, so every run names an accountable initiator (G-3). Draft generation and its job read and retry move from shared menu Functions into three human-analyst-only API Functions, mirroring questionnaire generation, and join `HUMAN_ANALYST_ONLY_OPERATIONS`. The two new operations (D-24, D-25) are human-analyst-only in the same way. The service agent can no longer start a draft.
- **D-33:** R-08-42 is closed by withdrawing three grants from the analyst service agent:
  - request create and update (`function.risk_assessment_requests.core_api`);
  - request delete (`function.risk_assessment_requests.delete_api`);
  - the unmounted request reference-data read (`function.risk_assessment_requests.reference_data_api`).

  No product path uses the agent, and no v2.0 phase defines an agent-driven workflow. The agent keeps its other grants. Whether the service agent role should remain at all is recorded for Phase 22's role review.
- **D-34:** G-1 (no analyst reviews their own request) is enforced for assignment in Phase 13 and for review, approval and release in Phase 17.1. Phase 12 does not add a partial rule, but the decision operation must go through the same guard once it exists.

### Interface

- **D-35:** Provenance renders from existing tokens, recorded as CSRM extensions in `docs/design/csrm-design-direction.md` before use, as Phase 10 did (D-41).
  - **What is recorded:** the AI provenance marker and the citation chip; the UI-SPEC names and numbers them.
  - **Never colour alone:** a marker is an icon plus text ("AI proposed", "Edited", "Accepted"), and each marker and citation has an accessible name.
  - **Suggestions:** a list per risk, with "Add as planned control" and "Dismiss".
  - **Actions:** "Accept" per field and "Accept remaining" per risk and for the assessment details.
  - **Exact copy** goes in the UI-SPEC.
- **D-36:** The premium bar (G-4) applies:
  - every action has a keyboard path;
  - Accept and Dismiss give optimistic feedback that rolls back on error, with an Undo toast (restore, D-24) and no confirmation, because both are reversible;
  - the run disclosure has a skeleton and all five states;
  - phones get stacked cards and a sheet for the disclosure;
  - motion follows the direction and honours reduced motion.

  The assessment editor route is at 89.9% of its 300,000-byte JavaScript budget (R-08-34), so:
  - provenance renders server-side where it can;
  - client pieces stay zod-free (08-13);
  - the disclosure and the suggestion list may load on demand with `next/dynamic` from a Client Component;
  - `performance.spec.ts` must stay green, and any override needs a recorded reason.
- **D-37:** Surfaces:
  - **The request hub:** the policy status (D-29).
  - **The questionnaire governance page:** the provenance header, the disclosure, question markers, and help text shown and editable.
  - **The Requestor's questionnaire:** help text, "Not sure" and the disclosure.
  - **The assessment editor:** the header, the disclosure, field markers, citations, uncited flags, suggestions and acceptance.
  - **The released assessment:** the analyst header and the Requestor disclosure.
  - **Not in Phase 12:** the Risk Register's risk detail shows no per-field markers. Phase 18's table brings per-cell markers.

### Verification and plan shape

- **D-38:** How the phase is proved:
  - **Each behaviour** gets a failing test first at its seam: the pure context builder and policy and scale modules; the provider adapters, with model-facing wire fixtures through the fake OpenAI-compatible server (the 06.7 lesson); the parsers; mounted Strapi integration; the matrix; web units; and E2E.
  - **New browser proofs** use their own records. A new journey creates a UAT-A-like request with systems, assets and regulatory requirements, generates the questionnaire, answers it, generates the draft and reviews it, at 375px and 1440px.
  - **Existing E2E specs** that change deliberately are named in their plans: the release journey accepts AI proposals, and the released view loses "Generated by".
  - **The live model check** (a UAT-A re-run on the hosted provider) is manual and the operator's.
- **D-39:** Plans are serialised by shared files, one owner per file per wave:
  - the specification and the generated client;
  - both catalogue copies and the served-operations inventory;
  - the authorization matrix and the parity guard;
  - the Strapi hot files: `assessment-workflow.ts`, `assessment-scope.ts`, `questionnaire-generation-workflow.ts`, `questionnaire-scope.ts`, `risk-workflow.ts`, `csrm-authorization.ts` and `conflict-reasons.ts`;
  - the web hot files: `assessment-schema.ts`, `assessment-service.ts`, `assessment-editor.tsx`, `risk-editor.tsx`, `questionnaire-renderer.tsx`, `questionnaire-governance.tsx` and `released-assessment.tsx`.

  Dev servers are stopped for any plan that edits Strapi or runs Playwright. The contract-gap checkpoint precedes the schema plan. The last plan runs the full five-command gate on the production build and the 375px and 1440px checks for both actors, then asserts a clean tree.

### Planner's Discretion

- Module decomposition and file placement under `apps/backend/src/csrm/ai/` and `apps/csrm/src/features/`, for example a new `ai-assistance` feature folder.
- The relevance ranking's details (tokenising, stop words, weighting) within D-06 and D-12. It stays deterministic, dependency-free and unit-tested.
- The exact bounds within the proposed ranges (library counts, character budgets, suggestions and uncited claims per risk).
- Reason-code, Function and operation names within the families `12-RESEARCH.md` proposes.
- Whether the decision and run operations and the catalogue moves share one plan or two, provided the shared files are serialised.
- Copy, layout and marker visuals: the UI-SPEC's.

</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #5 Analyst instructions | A separate, bounded instruction slot, logged in the run record and never holding Requestor text | D-05, D-19 (slot and field; Phase 15 fills them) |
| #6 Removing risks | A rejected AI proposal is recorded as rejected | D-12, D-24 (dismissed suggestions in the decisions log) |
| #8 Scales and appetite | 5 × 5 scales, derived ratings, Accept only for Low or Moderate with a rationale | D-10, D-11 |
| #14 Risk Types for the AI | The active library, several risks per type, no AI-eligible flag | D-09 |
| G-1 Separation of duties | The agent never holds human-analyst grants | D-32, D-33, D-34 |
| G-3 AI data policy | Minimal context, untrusted delimiting, a run record per generation, refusal above the ceiling, where classification comes from | D-04 to D-08, D-19, D-20, D-26 to D-29 |
| G-4 Premium bar | Keyboard, optimistic feedback, Undo, skeletons, phone layouts | D-36 |
| G-6 Housekeeping | The orchestrator approves the contract-gap record | D-01 |
| G-7 Production infrastructure | Production fails closed until the ceiling is set; the transcript flag works only in development; suites stay deterministic | D-27, D-30, D-31 |

The hosted provider's approval for production data remains the operator's and does not block this phase.
</operator_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043 and UAT-044 in full (steps, expected, actual, evidence, recommendation); UAT-008 for the scales.
- `.planning/uat/product-gaps/JOURNEYS.md`: the AI job log and area 4's quality comparison (what each generation missed and why).
- `.planning/uat/product-gaps/REPORT.md` §4 ("AI assistance health" metric), §7 (the risk table's per-cell AI marker), §8 (the Phase 12 proposal), §9 and §12.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F1, F3, F6, F7 and Q5.

### Planning authority
- `.planning/ROADMAP.md` Phase 12: goal, five success criteria, contract and datamodel line (run record and provenance are the only schema change).
- `.planning/REQUIREMENTS.md`: INT-05, INT-06, ASSESS-08 and QUES-10 with their acceptance criteria; ASSESS-18 (Phase 18's scale enforcement) and COLLAB-01 and COLLAB-02 (the Phase 13 and 14 context extensions).
- `.planning/NEXT-WAVE-DECISIONS.md`: decisions 5, 6, 8 and 14, G-1, G-3, G-4, G-6 and G-7.
- `.planning/STATE.md` Decisions, and `.planning/milestones/v1.0-STATE.md`, especially Phase 4 (restart discovery, volatile jobs, draft provenance wording), Pre-06.5 (only the two AI operations), 06.7 (wire shapes, deterministic E2E Strapi) and Phase 8 D-09 (the Risk Type ordering rule).
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`: D-04 and D-05 (governance form), D-09, D-10 and D-16 (regeneration, the Regenerated event, the change count), D-13 (the Requestor introduction), D-22 (reason codes), D-25 and D-26 (the generation-jobs read), D-34 (the released view) and D-41 (recorded extensions). Its plans 10-05 to 10-07, 10-09 to 10-11, 10-13 to 10-15 and 10-18 to 10-22 change the files Phase 12 builds on (numbering as revised on 2026-09-28, when 10-22 became the control titles and 10-23 the gate).
- `.planning/phases/06.7-real-ai-provider-integration-for-questionnaire-and-assessmen/06.7-CONTEXT.md`: D-07 (the parser is the gate), D-08 (layered guardrails), D-10 (no silent truncation), D-11 (registry unchanged) and D-14 (model-friendly wire shape, adapter assigns keys).
- `.planning/phases/08-production-integration-and-hardening/08-CONTEXT.md`: D-03, D-04, D-16, D-17, D-24, D-36 and D-45.

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §19 (AI architecture: provenance, review state, human modifications, audit history; untrusted content) and §20 (record gaps rather than competing models).
- `docs/references/idambox-datamodel.jdl`: `CsrmAssessmentRequest`, `CsrmInformationAsset.dataClassification`, `CsrmQuestion.helpText`, `CsrmRisk`, `CsrmRiskType`, `CsrmControl`, `CsrmControlImplementation.controlStatus`, `CsrmTreatmentAction`.
- `CONTEXT.md` (repository root): the glossary; a plan adds the new terms (AI run, AI proposal, request data classification).

### Contract, authorization and records
- `docs/references/specification.json`: `QuestionnaireQuestion`, `QuestionnaireSummary`, `AnalystAssessmentDetail`, `AnalystRiskDetail`, `RequestorReleasedAssessmentDetail`, `ReleaseReadinessRiskRequirement`, `QuestionnaireGenerationJob`, `AssessmentDraftJob`, and the conflict response schemas.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: the byte-identical copies; `function.questionnaire_generation.*` is the pattern for D-32.
- `docs/references/served-operations.json`.
- `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the record format; `phase-04-deterministic-draft-jobs.md`, `phase-06.2-questionnaire-generation-provenance.md` and `phase-06.7-ai-provider-provenance.md`: the deferrals D-19 supersedes.
- `docs/security/phase-08-residual-risks.md`: R-08-12, R-08-34, R-08-35, R-08-36 and R-08-42.
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: every UI value, badges and tags, never colour alone, forms (hint text), toasts, empty states and motion.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch; one response carries data and UI), `01-app/02-guides/lazy-loading.md` (`next/dynamic` from Client Components) and `01-app/03-api-reference/04-functions/refresh.md`.

### External
- Azure OpenAI structured outputs, "JSON Schema support and limitations" (https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs, updated 2026-08-24): the portable schema subset of D-06.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/csrm/prompt-data.ts`: `promptDataTag` escapes `&`, `<` and `>` and wraps a value in a labelled tag; the untrusted data block builds on it.
- `apps/backend/src/csrm/openai-compatible-client.ts`: `requestJsonCompletion` (strict JSON schema, no tools, typed failure codes) and `logCompletionDiagnostic`, the place D-30 gates.
- `apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts`: `compareRiskTypeNames` and `sortRiskProposals` (keep the ordering rule) and the closed parser to evolve.
- `apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts`: `toQuestionnaireGenerationProposal`, the model-shape-to-definition adapter pattern for both operations.
- `apps/backend/tests/helpers/fake-openai-compatible-server.ts`: the endpoint double for wire-shape provider tests.
- `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts`: `withMutableAssessmentMutation` (serialisation, lock, edit transition), `projectReleaseReadiness` and `validateReleaseReadiness` (the readiness vocabulary), `submittedAnswers` (active and visible answers).
- `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts`: control implementation creation, reused by "Add as planned control".
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`: with Phase 10's `countAnalystChangesSinceGeneration`, the basis for question provenance.
- `apps/backend/src/utils/development-identity-enabled.ts`: the `NODE_ENV` plus `CSRM_ENVIRONMENT` double key D-27 reuses.
- Phase 10's new modules: `apps/backend/src/csrm/conflict-reasons.ts`, `apps/csrm/src/lib/api/conflict-reasons.ts`, `apps/csrm/src/lib/api/refusal-copy.ts`, `apps/csrm/src/components/csrm/save-status.tsx`, `apps/csrm/src/features/questionnaires/questionnaire-introduction.tsx`, `apps/csrm/src/features/assessments/control-label.ts`, `released-risk-details.tsx` and `release-readiness-summary.ts`.

### Established Patterns
- Provider substitution behind `AssessmentDraftProvider` and `QuestionnaireGenerationProvider`. Deterministic providers are the test default, the E2E Strapi pins `CSRM_AI_PROVIDER=deterministic`, and the provider is resolved at call time.
- A model-friendly wire shape, an adapter that assigns keys and orders, and an unchanged closed parser as the gate (06.7 D-14).
- Current fact plus append-only log (06.8): the gate reads a dedicated fact, and the log carries history.
- Human-analyst-only operations: API-only Functions granted to `role.security_analyst` only, plus `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal.
- Zod-free `*-domain.ts` modules for client components, typed openapi-fetch services and Server Actions that revalidate.
- Denials keep persistence deep-equal, and an unauthorised assessment read is 404.

### Integration Points
- **Strapi:**
  - `assessment-workflow.ts`: `loadRiskTypeContext`, `submittedAnswers`, `persistAssessmentDraft`, readiness and the draft registry wiring.
  - `questionnaire-generation-workflow.ts`: `persistGeneratedQuestionnaire` and `generateQuestionnaire`.
  - The two OpenAI-compatible providers and the two deterministic providers.
  - `assessment-scope.ts`, `questionnaire-scope.ts`, `risk-workflow.ts` (`updateRisk`) and `updateAssessment`, for the D-21 edit rule.
  - The questionnaire and assessment controllers and routes, `csrm-authorization.ts`, `config/ai.ts`, `ai-config-validation.ts` and `src/index.ts` (bootstrap reconciliation).
- **Web:**
  - `assessment-schema.ts`, `assessment-service.ts` and `assessment-actions.ts`.
  - `assessment-editor.tsx` and `risk-editor.tsx`.
  - `released-assessment.tsx`.
  - `assessment-detail.tsx`, with the two job panels.
  - The questionnaire schema, service, renderer, governance and introduction modules.
  - The assessment and questionnaire review page loaders under `apps/csrm/app/(app)/app/review/`.
</code_context>

<specifics>
## Specific Ideas

- **UAT-A as the yardstick.** A Project request for a payroll SaaS, three systems (the HR and payroll platform, the finance system and the identity provider), one Restricted asset (employee personal and bank details), Privacy Act and tax file number obligations in its regulatory requirements, and answers about unsigned payment files, partial segregation of duties and an untested pay-run fallback. A good draft:
  - links each risk to the right system and asset, with Restricted classification where the asset applies;
  - proposes more than one risk under at least one type, or a risk with no type where none fits, without forcing the payment-file risk into "Internet Exposure";
  - cites the payment-file and segregation answers;
  - suggests controls such as file integrity, segregation of duties and backup testing from the library.

  The deterministic fixture mirrors this shape, and the operator's live re-run judges the model.
- **UAT-C's invented fact.** The connector patch status that no answer mentioned is the canonical uncited claim. It must now appear as an uncited claim or a statement with no cited source.
- **Development database.** The schema change and the catalogue moves reach the operator's development database only when the orchestrator restarts Strapi. Tests use their own databases. The operator's `.env` sets no ceiling, so development generation is unchanged.
- **Records generated before Phase 12** (UAT-A, UAT-B, UAT-C and the seeded drafts) stay releasable. They show generation facts without per-field markers.
</specifics>

<deferred>
## Deferred Ideas

- **Analyst instructions, targeted re-runs and follow-up questions:** Phases 15 and 16. The instruction slot, the run's `instruction` field and the decision operation are their foundations.
- **Risk withdrawal and deletion:** Phase 16 (decision 6).
- **Residual reassessment from recorded controls:** Phase 17.
- **Controlled likelihood and consequence in the editor and the API, and the derived rating with an override reason:** Phase 18 (ASSESS-18), on D-10's module.
- **Configurable scales, bands, appetite, active Risk Types, the classification ceiling and the unclassified default:** Phase 22 (ADMIN-07), behind D-10's and D-27's seams.
- **Notes and attachment text in the context:** Phases 13 and 14, through D-08's extension points.
- **Failed AI runs in the last seven days, and AI assistance health:** Phase 21 (DASH-04 criterion 2), reading `CsrmAiRun`.
- **A shared job store, or persisted job queue, for more than one Strapi process:** R-08-36 stays open. D-20 only makes interrupted runs visible.
- **Per-cell AI markers in the risk table and the Risk Register's risk detail:** Phase 18.
- **G-1 on AI acceptance** (an analyst reviewing their own request): Phase 17.1, with the other review acts.
- **A key allocator for questions added to an existing questionnaire:** Phase 15 (D-18).
- **Whether the service agent role should remain at all:** Phase 22's role review (D-33).
- **Local model evaluation for both operations:** backlog 999.1. The portable schema subset (D-06) keeps it open.
</deferred>


## Orchestrator Confirmations (2026-09-28)

The research asked for three confirmations. Each follows least privilege, AI human oversight and data governance (`NEXT-WAVE-DECISIONS.md` G-1 and G-3), and all three are confirmed:

- **Unclassified default (A1):** a request whose assets record no classification is treated as Internal for the AI data policy. That is the common default for unlabelled business data. It is conservative enough that a production ceiling below Internal still refuses, and permissive enough not to block ordinary work.
- **Human-initiated generation:** AI generation is human-initiated only. Draft generation and its job read and retry move to human-only Functions, and the analyst service agent can no longer start drafts. Its authorization-matrix rows change from allowed to refused.
- **Service agent grants:** `reference_data_api` is withdrawn from the service agent with its request create, update and delete. This closes R-08-42 fully, since the agent keeps no grant that no workflow needs.

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The UI-SPEC and Phase 16's discussion raised four points, and Phase 16's research a fifth. Each is settled as follows and binds the plans:

- **Visible "Confirm" (12-UI-SPEC UI-D1):** the analyst's review of an AI proposal reads "Confirm" and "Confirmed" in visible copy, replacing D-35's quoted "Accept" and "Accepted". The API keeps `accept` and the `accepted` state. Across the product, visible "Accept" is reserved for the risk owner's decision (G-14, root `CONTEXT.md`).
- **Undo after "Add as planned control" (UI-D12):** D-24's `restore` also covers an added suggested control. It removes the Planned implementation that the suggestion created, but only while that implementation is unchanged and the assessment is still editable. Otherwise `restore` is refused with a closed reason, and the copy names the next step: remove the mitigation control in the editor. The suggestion's history keeps both steps.
- **D-24 aligned with Phase 16 D-22 and D-23 (planned):** the decision operation passes the one exported guard that decides whether this actor may change this assessment now. That guard is today's `assertMutableAssessment` behind `withMutableAssessmentMutation`, which Phases 16, 17 and 17.1 extend. The accepted-edit transition applies only to content changes: accepting fields or a suggested control, and restoring an accepted unit. Dismissing a suggestion and restoring a dismissed one change no content. They take the assessment's serialisation and the guard, but not the edit transition, so they never record or withdraw a review.
- **No non-AI path:** a manual start when the data policy refuses generation (an empty questionnaire or assessment draft) is outside this phase. It goes to Phase 22, which owns the AI data policy setting and so the configuration that makes a refusal reachable. Development has no ceiling by default (D-27). The refusal copy names the request's classification, the ceiling and who can act (UI-D24).
- **No AI "Accept" where a planned control exists (G-14; Phase 16's confirmations):** the decision operation refuses to confirm an AI-proposed "Accept" treatment action, with a closed reason, while the risk has a planned control implementation, including one just added from a suggested control. The draft's output validation does not propose Accept for such a risk. The analyst's recommendation stays within what the risk owner may decide.

---

*Phase: 12-ai-context-suggestions-and-provenance*
*Context gathered: 2026-09-28*

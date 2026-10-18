# Phase 12: AI context, suggestions and provenance - Research

**Researched:** 2026-09-28
**Domain:** Server-side AI context assembly and prompt safety (Strapi 5.51), structured model output with closed parsers, AI provenance and audit records (a new content type and JSON facts), AI data policy, least-privilege grants, and provenance UI on Next 16.3.
**Confidence:** HIGH for the code facts and the contract chain, which were read this session. MEDIUM for the portable schema subset: it comes from official docs, and Azure's and OpenAI's docs differ. LOW for the model-quality outcomes (citations, the candidate shortlist), which only the operator's live check can confirm.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scope and contract boundary

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

#### The assessment context (INT-05; UAT-030)

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

#### Draft generation (ASSESS-08; UAT-029, UAT-031, UAT-042, UAT-044)

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

#### Questionnaire generation (QUES-10; UAT-043)

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

#### The run record and provenance (INT-06; UAT-032)

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

#### The AI data policy (G-3, G-7)

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

#### Roles and least privilege (R-08-42, G-1)

- **D-32:** AI generation is always initiated by a human Security Analyst, so every run names an accountable initiator (G-3). Draft generation and its job read and retry move from shared menu Functions into three human-analyst-only API Functions, mirroring questionnaire generation, and join `HUMAN_ANALYST_ONLY_OPERATIONS`. The two new operations (D-24, D-25) are human-analyst-only in the same way. The service agent can no longer start a draft.
- **D-33:** R-08-42 is closed by withdrawing three grants from the analyst service agent:
  - request create and update (`function.risk_assessment_requests.core_api`);
  - request delete (`function.risk_assessment_requests.delete_api`);
  - the unmounted request reference-data read (`function.risk_assessment_requests.reference_data_api`).

  No product path uses the agent, and no v2.0 phase defines an agent-driven workflow. The agent keeps its other grants. Whether the service agent role should remain at all is recorded for Phase 22's role review.
- **D-34:** G-1 (no analyst reviews their own request) is enforced for assignment in Phase 13 and for review, approval and release in Phase 17.1. Phase 12 does not add a partial rule, but the decision operation must go through the same guard once it exists.

#### Interface

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

#### Verification and plan shape

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-05 | Both AI operations receive one reviewable assessment context built from everything the request holds | "Findings" UAT-030; "The assessment context"; "Wire shapes and adapters"; "The AI data policy"; D-04 to D-08, D-13, D-26 to D-29 |
| INT-06 | AI-proposed content is marked until an analyst accepts or edits it, and cites its sources | "Findings" UAT-032 and UAT-042; "The run record and provenance"; "Contract changes" 1–7; D-14, D-19 to D-25 |
| ASSESS-08 | AI draft generation uses the organisation's Risk Type library and proposes controls and treatments for the analyst to accept | "Findings" UAT-029, UAT-031 and UAT-044; "Wire shapes and adapters"; D-09 to D-12 |
| QUES-10 | Generated questionnaires suit a Requestor who is not a security expert | "Findings" UAT-043; "Wire shapes and adapters" (questionnaire v2); D-16 to D-18 |
</phase_requirements>

## Summary

The UAT's reading of the code holds line by line.
- **Draft generation** sends the model only the submitted answer values, keyed by question key and sorted by key (`assessment-workflow.ts:638-666`), plus three hard-coded Risk Types (`:668-688`). No question text, request field, system or asset reaches it.
- **The draft schema** fixes the treatment action to `Treat` (`openai-compatible-assessment-draft-provider.ts:29`). The parser refuses two risks of one type (`assessment-draft-provider.ts:115`).
- **Suggested controls** are parsed and then never persisted (`assessment-workflow.ts:768-794` writes no control and no system, asset or classification).
- **Questionnaire generation** sends seven request fields (`openai-compatible-questionnaire-generation-provider.ts:51`), asks for 8–15 questions, and has no help text anywhere in its wire shape, proposal parser or persistence. The question read does not even project `helpText` (`questionnaire-scope.ts:421-428`).
- **Provenance:** nothing marks AI values. The provider facts persisted since 06.7 are never projected (`assessment-scope.ts:204-223`), and the released view says "Generated by {analyst}" (`released-assessment.tsx:204`).

The recommended design has four parts.
1. **One context builder** as a deep module in `apps/backend/src/csrm/ai/`, used by both operations. It owns data minimisation, untrusted-data delimiting, bounded library selection with a deterministic ranker, the source catalogue for citations, the context summary and the policy decision.
2. **New wire shapes (schemaVersion 2)** for both operations, kept inside the strict structured-output subset that the G-7 production target (Azure OpenAI) documents. Adapters assign keys, orders, ids and derived values, and context-aware closed parsers stay the gate.
3. **A shared 5 × 5 scale module** that derives every rating and enforces the Accept rule (decision 8). Phase 18 enforces it in the editor, and Phase 22 configures it.
4. **Provenance, split the 06.8 way:** a new `CsrmAiRun` record per provider call (the audit history that Phases 15–17 and 21 reuse), and a versioned `aiProvenance` JSON on `CsrmRisk` and `CsrmAssessment` (the current per-field state that release readiness gates on). Question provenance is derived from the governance log.

A policy module decides the request's classification and the provider's ceiling. Generation becomes human-initiated only, which also closes R-08-42.

**Primary recommendation:**
- Plan the contract-gap record and its approval checkpoint first, and in parallel build the pure scale, policy and context modules with unit tests.
- Then change the schema, then the two generation pipelines, then the reads, then the two new operations and the grant changes.
- Then build the UI.
- Finish with a new UAT-A-like E2E journey and the full gate.

Every behaviour is proved with the deterministic provider and with model-facing wire fixtures through the existing fake OpenAI-compatible server. No proof calls a live model.

## Project Constraints (from AGENTS.md)

- Next.js App Router, strict TypeScript, Server Components by default, and Client Components only when required. Next.js is 16.3.6: read `apps/csrm/node_modules/next/dist/docs/` before framework work.
- Semantic tokens only, and no BProton brand colours in feature code. `docs/design/csrm-design-direction.md` is the only source of values; anything new is a recorded CSRM extension.
- Keep business logic out of JSX (zod-free `*-domain.ts` modules). Use the typed openapi-fetch layer only: no raw fetch in pages and no frontend facade.
- Validate external input with shared schemas (closed Zod on the web; closed hand-written parsers in Strapi).
- Authorization is enforced server-side, and navigation visibility is not authorization. A Requestor must not reach another Requestor's records.
- **AI output is advisory and never releases an assessment automatically.**
- Use the JDL terminology, and record model gaps (`docs/contract-gaps/`) rather than inventing competing entities.
- Tests come with every material workflow. No dependency without a concrete reason. Keycloak stays disabled, and no secrets are committed.
- Frozen content-type schemas: the only exception here is the approved contract-gap record (D-01).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assessment context assembly, minimisation, bounds | API / Backend (Strapi `csrm/ai`) | — | Needs the authoritative records and must never trust the browser |
| Classification ceiling decision | API / Backend (policy module) | Frontend Server (displays the served decision) | Authorisation-adjacent; must fail closed server-side |
| Prompt, wire schema, adapter, parser | API / Backend (providers) | — | Provider-independent boundary (brief §19) |
| Rating derivation and the Accept rule | API / Backend (`csrm/risk-scale.ts`) | Frontend Server (Phase 18 mirror) | One rule; the parser re-derives |
| Run record and per-field provenance | Database / Storage (new content type, JSON facts) | API / Backend (writers and projections) | Durable audit (G-3, brief §19) |
| Decisions (accept, dismiss, restore) | API / Backend (assessment mutation path) | Browser (optimistic UI with rollback) | Record-level checks and serialisation live in Strapi |
| Provenance display and the disclosure | Frontend Server (Server Components) | Browser (markers and actions in Client Components) | Keeps first-load JavaScript inside R-08-34's budget |
| Requestor AI disclosure | Frontend Server | — | Reads a served boolean; no AI data reaches the Requestor |

## Standard Stack

### Core (all already installed; nothing is added)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@strapi/strapi` | 5.51.0 | Content types, document service, custom routes, policies | The API boundary [VERIFIED: apps/backend/package.json] |
| `openai` | 7.15.0 | Thin OpenAI-compatible client (`requestJsonCompletion`) | 06.7 D-02; unchanged [VERIFIED: apps/backend/package.json] |
| `node:crypto` | Node 24.19.0 | SHA-256 context digest | Built in; no dependency |
| `next` | 16.3.6 | Server Components, Server Actions, `next/dynamic` | Project framework [VERIFIED: apps/csrm/package.json] |
| `zod` | ^4.4.3 | Closed response parsers | Parity guard pattern [VERIFIED: apps/csrm/package.json] |
| `openapi-fetch` / `openapi-typescript` | 0.17.0 / 7.13.0 | Typed client and `api:generate` | The contract chain [VERIFIED: apps/csrm/package.json] |
| `lucide-react` | 1.30.0 | Marker and citation icons (the UI-SPEC chooses; `sparkles` exists) | Icon system of ADR 0001 [VERIFIED: apps/csrm/node_modules/lucide-react/dist/esm/icons/sparkles.mjs exists] |

### Supporting (tests)

| Tool | Version | Use |
|------|---------|-----|
| `node:test` + `tsc -p tests/tsconfig.json` | — | Strapi unit and mounted integration, one database per file |
| `apps/backend/tests/helpers/fake-openai-compatible-server.ts` | — | Model-facing wire-shape tests (06.7 lesson) |
| vitest | 4.1.11 | Web units (jsdom) [VERIFIED: apps/csrm/package.json] |
| @playwright/test + @axe-core/playwright | 1.58.2 + 4.11.0 | E2E on the production build, axe |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A hand-written deterministic lexical ranker (about 80 lines) | MiniSearch or Fuse.js [ASSUMED names] | A dependency for a batch selection that runs about once per draft. AGENTS forbids a dependency without concrete need. Revisit if candidate quality needs fuzzy or prefix search |
| Enum-constrained citation ids in the schema | Adapter-validated plain strings | Enums multiply values across seven fields and risk the provider's enum limits; the adapter drop-and-flag is robust |
| A run list by request | A read by run id | The list carries context summaries for many runs; Phase 12 only needs one run at a time |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no package in either workspace. If a plan later finds a genuine need (for example a search library for the ranker), it runs the Package Legitimacy Gate then, and gates the install behind a `checkpoint:human-verify` task.

## Findings: root cause, fix, layer, tests

### UAT-029: only three hard-coded Risk Types, one risk per type (ASSESS-08 criterion 1)

- **Root cause (confirmed):**
  - `loadRiskTypeContext` filters to three names and fails the draft if any is missing [VERIFIED: apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:668-688]: `const supported = new Set(["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"]);` (line 669) and `throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft reference data is unavailable.");` (line 685).
  - The parser refuses repeated types [VERIFIED: assessment-draft-provider.ts:115]: `if (new Set(risks.map(({ riskTypeName }) => riskTypeName)).size !== risks.length`.
  - The deterministic provider rejects any other name [VERIFIED: deterministic-assessment-draft-provider.ts:13-15, 49-51]: `"Internet Exposure", "Personal Information Handling", "Third-Party Dependency"`.
- **Fix:**
  - Load the whole Risk Type library (bounded at 60 and ranked when larger; name, description capped at 500 characters, and applicable controls) through the context builder.
  - Allow repeated types and a null type. The adapter sorts with `compareRiskTypeNames` (null last) and keeps the model's order within a type; the parser checks the order is non-decreasing.
  - `CsrmRiskType` has no active flag [VERIFIED: apps/backend/src/api/csrm-risk-type/content-types/csrm-risk-type/schema.json attributes `name`, `description`, `applicableControls`, `risks`], so every type counts as active until Phase 22.
- **Layer:** Strapi (context loader, provider, parser, persistence).
- **Tests:**
  - Adapter wire tests: two risks of one type are accepted; a null type is accepted; mixed-case order holds.
  - Deterministic unit: a second Personal Information Handling risk when regulatory requirements are present.
  - Integration: a library with a fourth type reaches the prompt (the fake server's captured request) and the draft persists two risks of one type.

### UAT-030: the draft never sees the request or the question text, and questionnaire generation omits regulatory requirements, systems and assets (INT-05)

- **Root cause (confirmed):**
  - `submittedAnswers` returns only `{ questionKey, value }` sorted by key [VERIFIED: assessment-workflow.ts:663, 665]: `return { questionKey: question.questionKey, value: answer.value as SubmittedAnswer["value"] };` and `.sort((left, right) => left.questionKey.localeCompare(right.questionKey));`.
  - The draft prompt renders only `<questionnaireAnswers>` and `<riskTypes>` [VERIFIED: openai-compatible-assessment-draft-provider.ts:14-20].
  - The questionnaire prompt sends exactly seven fields [VERIFIED: openai-compatible-questionnaire-generation-provider.ts:51]: `["title", "description", "assessmentType", "businessPurpose", "businessCriticality", "thirdPartyInvolvement", "thirdPartyDetails"]`.
  - `persistGeneratedQuestionnaire` loads the request without systems or assets [VERIFIED: questionnaire-generation-workflow.ts:29, 32].
- **Fix:** the context builder (D-04 to D-06; "The assessment context" below). Both providers take the builder's output. Draft risks are pre-filled from the request's own systems and assets, with classification from the asset (D-13).
- **Layer:** Strapi.
- **Tests:**
  - Builder unit tests over a UAT-A-like fixture: every included field is present, every excluded field is absent, and the Requestor text is escaped inside the data block.
  - Provider wire tests that inspect the captured request.
  - Integration: the generated questionnaire's deterministic questions reflect the regulatory requirements and an asset, and the draft's risks carry the request's system and asset with the asset's classification.

### UAT-031: suggested controls are discarded (ASSESS-08 criterion 2)

- **Root cause (confirmed):**
  - The OpenAI-compatible schema limits suggestions to the three types' applicable controls [VERIFIED: openai-compatible-assessment-draft-provider.ts:24, 30]: `riskProperties.suggestedControlNumbers = { type: "array", maxItems: 100, items: { type: "string", enum: controlNumbers } };`.
  - `persistAssessmentDraft` never reads `suggestedControlNumbers` and creates no control implementation [VERIFIED: assessment-workflow.ts:768-794].
  - The deterministic provider folds them into the treatment plan text [VERIFIED: deterministic-assessment-draft-provider.ts:68-70]: `` `Suggested reusable controls: ${suggestedControlNumbers.join(", ")}. Review these suggestions and record the analyst-approved treatment plan.` ``.
- **Fix:**
  - A bounded candidate set: offered types' applicable controls (at most 20 per type) plus a lexical shortlist of the whole library (about 80), capped at 150 and ordered by control number. The model sees `controlNumber` and name.
  - At most five suggestions per risk, each with a rationale (500 characters or fewer), persisted in the risk's `aiProvenance`.
  - The decision `accept` creates a control implementation `{ control, controlStatus: "Planned" }` through the existing workflow and marks the suggestion `added`.
  - `CsrmControlImplementation.controlStatus` includes `Planned` [VERIFIED: apps/backend/src/api/csrm-control-implementation/content-types/csrm-control-implementation/schema.json enum `Existing|Planned|Implemented|Retired`].
  - Phase 10's plan 10-22 loads control titles, which improves both the ranking and the names shown.
- **Layer:** Strapi (candidates, adapter, persistence, decisions); web (the suggestion list).
- **Tests:**
  - Ranker unit tests (deterministic order and ties).
  - Adapter: an unknown control is dropped, a duplicate is removed, and more than five are refused or capped per the parser rule.
  - Integration: accepting a suggestion creates a Planned implementation and records the decision; dismissing records it; restore returns it to proposed.
  - Web: the one-click add and its Undo.

### UAT-032: nothing marks AI content; the released view says "Generated by" (INT-06 criteria 1 and 3)

- **Root cause (confirmed):**
  - The assessment detail projects `generatedBy` but no provider facts [VERIFIED: assessment-scope.ts:204-223].
  - The questionnaire summary projects no generation facts [VERIFIED: questionnaire-scope.ts:386-406].
  - The released view renders `<Definition label="Generated by" value={assessment.generatedBy?.displayName ?? 'Not recorded'} />` [VERIFIED: apps/csrm/src/features/assessments/released-assessment.tsx:204].
  - The 06.7 record kept the provider facts "persistence-only" [CITED: docs/contract-gaps/phase-06.7-ai-provider-provenance.md "These fields are persistence-only in this phase. No API projection exposes them"].
- **Fix:**
  - The run record and `aiProvenance` (D-19 to D-21), derived question origin (D-22), projections and markers (D-23).
  - The Requestor's `aiAssisted` disclosure.
  - Phase 4's required wording, "draft initiated by" [CITED: docs/contract-gaps/phase-04-deterministic-draft-jobs.md "the user-facing wording is exactly 'draft initiated by'"], is honoured by "Generated with AI at the request of {analyst}".
- **Layer:** Strapi, web.
- **Tests:** projection integration tests for each actor (the Requestor never receives `generation`, run ids or provenance); web units for the header, markers and disclosure; E2E at both widths.

### UAT-042: invented facts and no link to sources; vocabulary drift (INT-06 criterion 2)

- **Root cause (confirmed):**
  - No citation exists in any wire shape, parser or record [VERIFIED: assessment-draft-provider.ts:52-57 `RISK_KEYS`].
  - Likelihood and consequence are free strings in the schema [VERIFIED: openai-compatible-assessment-draft-provider.ts:25], so "High" can appear as a consequence.
- **Fix:** citations per statement field, drop-and-flag, and uncited claims (D-14); scales with derived ratings (D-10).
- **Tests:** the adapter drops unknown ids and flags empty ones; a scale value outside the vocabulary is refused; a rating mismatch in an internal proposal is refused; the deterministic output includes one uncited field and one uncited claim, which the UI flags.

### UAT-043: every question required, technical, long text, no help text (QUES-10)

- **Root cause (confirmed):**
  - The bounds are `const MIN_QUESTIONS = 8;` and `const MAX_QUESTIONS = 15;` [VERIFIED: openai-compatible-questionnaire-generation-provider.ts:16-17].
  - The answer types include Boolean with no "Not sure" [VERIFIED: :7].
  - The system prompt gives no plain-language, optionality or help-text guidance [VERIFIED: :36-43].
  - The wire shape has no help text [VERIFIED: :10 `QUESTION_KEYS = ["questionText", "answerType", "sectionTitle", "required", "choices"]`].
  - The proposal parser's question keys are `["questionText", "answerType", "options"]` [VERIFIED: questionnaire-generation-provider.ts:8].
  - Persistence writes no help text [VERIFIED: questionnaire-generation-workflow.ts:36].
  - The read does not project it [VERIFIED: questionnaire-scope.ts:421-428].
- **Fix:** questionnaire wire v2 and adapter guarantees (D-16), help text end to end (D-17). The mutation already accepts help text of 2,000 characters or fewer [VERIFIED: questionnaire-governance-workflow.ts:76].
- **Tests:**
  - Adapter: "Not sure" is appended, a Boolean answer type is refused, 5 and 21 questions are refused, help text passes through.
  - Deterministic unit.
  - Integration: help text persists and projects for both actors.
  - Web: the Requestor sees help text as the hint (`aria-describedby`).
  - E2E: a generated questionnaire shows help text and a "Not sure" choice.

### UAT-044: every treatment is "Treat" (ASSESS-08 criterion 3)

- **Root cause (confirmed):** `riskProperties.treatmentAction = { type: "string", const: "Treat" };` [VERIFIED: openai-compatible-assessment-draft-provider.ts:29]; the type says `treatmentAction: "Treat";` [VERIFIED: assessment-draft-provider.ts:29]; and the parser checks `if (value.treatmentAction !== "Treat") invalid();` [VERIFIED: assessment-draft-provider.ts:100]. The schema already allows `["Accept", "Treat"]` [VERIFIED: assessment-workflow.ts:50].
- **Fix:** D-11. The wire enum is `Accept | Treat`. The adapter downgrades an Accept for a High or Critical residual rating, or one with no plan text, and records the adjustment; the parser rejects an Accept above Moderate.
- **Tests:** adapter downgrade cases (a High residual; a blank rationale); the deterministic provider proposes Accept for a Moderate residual rating; integration persists Accept with the rationale in `treatmentPlan`.

### Requirement coverage

| Criterion | Where it is met |
|---|---|
| INT-05 (1) the context holds everything the request holds | D-04; builder tests |
| INT-05 (2) the analyst sees the context; Requestor text quoted as untrusted | D-05, D-07, D-25; the guardrail test extended to the new data block |
| INT-05 (3) pre-fill system, asset and classification | D-13 |
| INT-05 (4) refusal above the ceiling; each run records its context summary | D-26 to D-29, D-19 and D-20 |
| INT-06 (1) proposed markers; provider, time and analyst shown | D-21 to D-23 |
| INT-06 (2) citations; uncited flagged | D-14 |
| INT-06 (3) the Requestor is told AI assisted and an analyst reviewed | D-23 |
| INT-06 (4) a run record for Phases 15–17 | D-19, D-20, D-24 |
| ASSESS-08 (1) the library; several per type | D-09 |
| ASSESS-08 (2) whole-library suggestions, one click | D-12, D-24 |
| ASSESS-08 (3) Accept for Low or Moderate with a rationale; the analyst confirms | D-11, D-21 |
| QUES-10 (1) plain language, choices with "Not sure", optional, help text | D-16, D-17 |
| QUES-10 (2) generation receives the context | D-04 |

## The run record and provenance: options and choice

The frozen schema has no home for either: `CsrmRisk` and `CsrmAssessment` have no JSON attribute [VERIFIED: the two schema.json files read this session], and the JDL has no AI or audit entity [VERIFIED: docs/references/idambox-datamodel.jdl, read in full; its entities are at lines 17-307]. The catalogue's own design note 6 anticipates it: "persisted workflow collaboration, file uploads, alerts, and audit history require model extensions" [VERIFIED: docs/references/idambox-csrm-role-function-api-catalogue.json:21].

| Option | For | Against | Fit for Phases 15, 16, 17 and 21 |
|---|---|---|---|
| **A. `CsrmAiRun` entity, plus `aiProvenance` JSON on the risk and the assessment, plus question state derived from the log** (chosen) | One home for every run; a failed first generation has a home; cross-request queries (Phase 21) are ordinary queries; current state is read with the record (no join for the editor or the Phase 18 table); the run's decisions log is the history, as 06.8 split `releasedAt` from `governanceLog` | A new table and two JSON attributes; new reads need their own grants | Phase 15 fills `instruction` and pending `proposal` items. Phases 16 and 17 add operations and item kinds on the same decision operation, and use the optional `risk` relation. Phase 21 counts `failed` runs by `startedAt`. None needs another run-record schema change |
| B. JSON run logs on the request, questionnaire and assessment | Inherits each aggregate's authorisation; follows 06.8 literally | Four schema changes; the request becomes a dumping ground for failed first generations; aggregates grow with every re-run; job completion writes contend with analyst edits; Phase 21 must scan JSON in every row | Poor: Phase 21 metrics and Phase 16 per-risk runs fit badly |
| C. A run entity holding all per-field state | No change to existing types | Every risk edit writes the run; editor and table reads join runs; current state becomes a merge across Phase 16 and 17 runs | Poor for Phase 18's per-cell markers |
| D. One row per proposal item | Normalised and queryable | Tens of rows per draft; a join on every read | Heavy |

**Choice: A.** The 06.1 and 06.8 records excluded "a competing audit entity outside the frozen JDL" [CITED: docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md], and 06.8 deferred "a cross-aggregate audit trail ... to a future domain-model decision". G-3 ("Each run records its context summary, provider, initiating analyst and outcome") and decision 6 ("A rejected AI proposal is recorded in the run record") are that decision for AI runs. `CsrmAiRun` competes with no JDL entity.

### Proposed record contents (for `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`)

**`CsrmAiRun`** (collection `csrm_ai_runs`; JDL-style: `entity CsrmAiRun { operation String required, status CsrmAiRunStatus required, startedAt Instant required, completedAt Instant, providerName String required, providerVersion String required, jobId String, attempt Integer, instruction TextBlob, contextSummary AnyBlob, proposal AnyBlob, decisions AnyBlob, failureCode String, failureMessage String }`, with `enum CsrmAiRunStatus { RUNNING, COMPLETED, FAILED, INTERRUPTED }`; and `ManyToOne` relations to `CsrmAssessmentRequest` (required in code), `CsrmQuestionnaire`, `CsrmAssessment`, `CsrmRisk` and `IdamBoxUser` as `initiatedBy`):

| Attribute | Strapi type | Notes |
|---|---|---|
| `operation` | string (at most 64) | Closed vocabulary in code and in the contract (`AiRunOperation`); later phases extend it without a schema change |
| `status` | enumeration `running`, `completed`, `failed`, `interrupted` | Stable closed set |
| `startedAt`, `completedAt` | datetime | Server-owned |
| `initiatedBy` | manyToOne IdamBoxUser | The human analyst (D-32) |
| `providerName`, `providerVersion` | string | Same meaning as the 06.7 fields |
| `jobId`, `attempt` | string, integer | Link to the volatile job |
| `assessmentRequest`, `questionnaire`, `assessment`, `risk` | manyToOne | The request is always set; the others are optional |
| `instruction` | text | Null until Phase 15; never Requestor text |
| `contextSummary` | json | Versioned envelope; at most 64 KB |
| `proposal` | json | Versioned internal proposal with adjustments; at most 1 MB |
| `decisions` | json | Append-only, versioned events; bounded (at least 1,000) |
| `failureCode`, `failureMessage` | string | Safe values only |

**`aiProvenance`** on `CsrmRisk` and on `CsrmAssessment`: json, optional. Existing rows stay null, and null means "no per-field AI provenance" (D-23).

**Write discipline:**
- Only the generation workflows and the decision and update paths write these facts, each inside the aggregate's existing serialisation and transaction.
- `decisions` is append-only.
- Reads validate every envelope with a closed parser and fail safe: a malformed envelope projects as null provenance, and never denies a read (the 06.8 posture).

**Migration:**
- The change is additive. Strapi schema sync creates the table and the columns, and `apps/backend/database/migrations/` stays empty, following the 06.1, 06.2, 06.7 and 06.8 precedent [CITED: docs/contract-gaps/phase-06.7-ai-provider-provenance.md, "No migration file accompanies this change"].
- The proof has four parts:
  - a fresh test database boots with the table and columns;
  - legacy rows (created without the attributes) read with null provenance and no new readiness requirement;
  - the development database shows `csrm_ai_runs` and the `ai_provenance` columns after the orchestrator's next boot (the 06.8-01 PRAGMA check);
  - the content-type freeze check lists exactly the three approved schema files.

### Envelopes (versioned, closed)

- **Context summary v1:**
  - `schemaVersion`, `operation`;
  - `request.fields` (key, label, characters);
  - `questions` (included count, answered count, sources, each with its key, question text label of 300 characters or fewer, and section);
  - `systems` (key, documentId, name) and `assets` (key, documentId, name, classification);
  - `riskTypes` (offered, total, names), `controlCandidates` (offered, library total);
  - `classification` (level, source `assets` or `default`, ceiling, decision);
  - `characters`, `budget` and `digest` (`sha256:` over the exact user prompt).

  It holds no Requestor free text.
- **Risk `aiProvenance` v1:**
  - `schemaVersion`, `runId`, `proposalKey`;
  - `fields` (for each AI-written field: `state`, optional `by` and `at`, and `sources` for statement fields);
  - `uncitedClaims` (at most 5, each 300 characters or fewer);
  - `suggestions` (each with `key`, `control` documentId, `controlNumber`, `rationale`, `state` (`proposed`, `added` or `dismissed`), optional `by`, `at` and `implementation`);
  - `adjustments` (for example `accept-not-permitted`, `sources-dropped`).
- **AI-written risk fields (20):** riskType, issueStatement, riskStatement, riskCategory, riskSubCategory, riskCause, potentialImpact, informationSystemImpacted, informationAssetImpacted, dataClassification, inherentLikelihood, highestInherentConsequence, inherentRating, inherentRatingRationale, residualLikelihood, highestResidualConsequence, residualRating, residualRatingRationale, treatmentAction and treatmentPlan. The field names are the frozen schema's [VERIFIED: apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json].
- **Assessment `aiProvenance` v1:** the same shape over `summary`, `overallRating`, `overallRiskRationale` and `recommendationsSummary`, with sources for the three text fields.
- **Decision event v1:** `schemaVersion`, `at`, `by`, `target` (`assessment`, or a risk documentId), optional `item` (a suggestion key), `kind` (`accepted`, `dismissed`, `restored` or `edited`), optional `fields` and optional `implementation`.

## The assessment context

### Field table (data minimisation, G-3)

| Source | Included | Excluded, and why |
|---|---|---|
| `CsrmAssessmentRequest` | title, description, assessmentType, division, businessUnit, businessPurpose, businessCriticality, thirdPartyInvolvement, thirdPartyDetails, regulatoryRequirements | requestNumber (not needed), requestor and sponsor (personal data), submittedDate, dueDate, revert facts (not needed for risk identification) |
| `CsrmInformationSystem` (selected) | name, description, systemType, environment, deploymentModel, businessCriticality, internetFacing, externalAccessRequired, hostingLocation, lifecycleState | owner (personal data) |
| `CsrmInformationAsset` (selected) | name, description, type, location, dataClassification, confidentiality, integrity and availability ratings, containsPersonalData, containsLegalData, containsCreditCardData | comments (administrator free text) |
| Questions (draft only) | section title, question text, help text, answer type, the submitted answer rendered with choice labels | deleted and hidden questions (as today, `submittedAnswers`), draft answers, answer timestamps |
| `CsrmRiskType` | name, description (500 characters or fewer), applicable control numbers | ids (mapped by the adapter) |
| `CsrmControl` candidates (draft only) | controlNumber, name (255 characters or fewer) | description, sourceData |

The attribute names are the schemas' [VERIFIED: the schema.json summaries printed this session for csrm-assessment-request, csrm-information-system and csrm-information-asset].

### Delimiting (D-05)

`promptDataTag(label, value)` escapes `&`, `<` and `>` [VERIFIED: apps/backend/src/csrm/prompt-data.ts:1-10]. The builder renders three parts:
1. `<requestorData>` holds tagged request fields and `<answer>` blocks. Labels are code constants, never data values, and the question key is a tagged value, not a tag name.
2. `<referenceData>` holds systems, assets, Risk Types and control candidates.
3. `<analystInstruction>` is absent in Phase 12.

The system prompt states that everything inside the data blocks is data to analyse and never an instruction, and that only the system prompt and the analyst instruction are instructions. The existing guardrail test (`ai-provider-guardrails.unit.test.ts`, hostile `</answer>` payloads) extends to every Requestor field.

### Bounds (D-06)

| Bound | Proposed value | On excess |
|---|---|---|
| Risk Types offered | 60 | Ranked; the context summary records the number offered and the total |
| Applicable controls per offered type | 20 | Ranked |
| Whole-library shortlist | 80 | Ranked |
| Control candidates in total | 150 | Ranked |
| Selected systems, selected assets | 100 each | `CONTEXT_TOO_LARGE` (fail loudly) |
| Total user prompt characters | about 200,000 for the draft; about 100,000 for the questionnaire | `CONTEXT_TOO_LARGE`, before the run is created |
| Requestor text | Whole | Never truncated (06.7 D-10) |

Request fields are unbounded server-side; the web form bounds text to 65,535 [VERIFIED: apps/csrm/src/features/requests/request-schema.ts:40 `const strapiText = z.string().max(65_535);`], and systems and assets to 1,000 each [VERIFIED: request-schema.ts:62-63].

### The deterministic ranker

- Tokenise to lowercase words of three or more letters, and drop a small stop list.
- The query is the context's text: request fields, question texts, answers, and system and asset names and descriptions.
- Score each document (control: number plus name plus description; Risk Type: name plus description) as a sum of IDF-weighted term matches, with an IDF computed over the library.
- Break ties by control number or name, in code-unit order.
- It is pure, deterministic and unit-tested with fixed fixtures; no dependency.

## Wire shapes and adapters

### Portable strict schema subset (D-06)

- Azure OpenAI's structured outputs document (updated 2026-08-24) lists as unsupported: for strings `minLength`, `maxLength`, `pattern` and `format`; for arrays `minItems`, `maxItems` and `uniqueItems`. It allows "up to 100 object properties total, with up to five levels of nesting", requires every field to be required with `additionalProperties: false`, and supports nullable fields through `type: ["string", "null"]`, plus `anyOf`, `$defs` and `enum` [CITED: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs].
- OpenAI raised its own limits in July 2025: 5,000 object properties, 1,000 enum values, and 15,000 characters for enums of more than 250 values [CITED: https://community.openai.com/t/structured-outputs-limits-are-raised-to-support-larger-schemas/1313593].
- OpenAI's documentation now lists `minItems` and `maxItems` as supported, while community reports conflict [CITED: https://community.openai.com/t/min-maxitems-are-not-supported-in-structured-output/958567], and Azure's page still excludes them.
- **Conclusion:** keep both wire schemas inside Azure's subset. That excludes `const` too, which Azure's supported list does not name; use a one-value `enum` instead. Enforce bounds in the adapter and parser.
- **Today's questionnaire schema breaks this:** it uses `const: 1`, `minLength`, `maxLength`, `minItems` and `maxItems` [VERIFIED: openai-compatible-questionnaire-generation-provider.ts:22-29]. Whether Azure rejects or ignores these keywords is not verified [ASSUMED: A2].
- **A unit guard** walks each schema sent through the fake server, asserts no forbidden keyword, at most 100 object properties and nesting depth of five or less.

### Draft wire v2 (model-facing)

- **Root:** `schemaVersion` (enum `[2]`), `summary`, `summarySources` (string array), `overallRiskRationale`, `overallRiskRationaleSources`, `recommendationsSummary`, `recommendationsSummarySources` and `risks` (an array of risk objects).
- **Each risk:**
  - `riskTypeName`: enum of the offered names, plus null;
  - the text fields `issueStatement`, `riskStatement`, `riskCategory`, `riskSubCategory`, `riskCause` and `potentialImpact`;
  - `informationSystem`: enum `system-1` … plus null; `informationAsset`: enum `asset-1` … plus null;
  - `inherentLikelihood` and `residualLikelihood`: enum Rare, Unlikely, Possible, Likely, Almost certain;
  - `highestInherentConsequence` and `highestResidualConsequence`: enum Insignificant, Minor, Moderate, Major, Severe;
  - `inherentRatingRationale` and `residualRatingRationale`;
  - `treatmentAction`: enum Accept, Treat; and `treatmentPlan`;
  - `sources`: an object with seven string arrays, one per statement field;
  - `uncitedClaims`: a string array;
  - `suggestedControls`: an array of `{ controlNumber (enum of candidates), rationale }`.
- **Size:** about 39 object properties and nesting depth 4, so it fits the subset. Enum values total about 60 + 20 + 2 + 150 + systems + assets, under 500 even if every occurrence is counted.
- **Out of the wire shape:** ratings, classification, overall rating and control ids. CSRM derives or maps them.

### Draft adapter steps (D-15)

1. Check the structure exactly (a structural failure is `PROVIDER_OUTPUT_INVALID`).
2. Map `system-n` and `asset-n` to documentIds; take the classification from the asset record.
3. Derive the ratings with `risk-scale.ts`; the overall rating is the highest residual rating.
4. Apply the Accept rule, downgrading to Treat when it does not hold.
5. Filter sources to catalogue keys, recording the number dropped.
6. Filter suggestions to candidates, remove duplicates, and keep at most five.
7. Sort risks by type (null last), keeping the index order within a type; assign `risk-1` … .
8. Run the context-aware closed parser, `parseAssessmentDraftProposal(value, allowed)`, which also re-derives the ratings and refuses a mismatch.

### The internal proposal and the deterministic provider

The internal proposal (schemaVersion 2) is what both providers return, the parser checks, the run's `proposal` stores and persistence materialises.

The deterministic provider:
- keeps its three answer rules;
- adds context rules: an internet-facing system gives an Internet Exposure risk on that system; an asset with personal data gives a Personal Information Handling risk on that asset; present regulatory requirements give a second Personal Information Handling risk citing `request.regulatoryRequirements`; third-party involvement in the request gives a Third-Party Dependency risk proposing Accept, because Possible × Moderate = 9 is Moderate;
- cites the sources of each rule, suggests the type's applicable controls with templated rationales, and leaves one statement uncited with one uncited claim;
- sorts with the shared rule.

Its existing outputs stay consistent with derivation, except that sensitive personal data today yields "Critical" from Possible × Severe = 15, which is High. The fix: set Likely × Severe = 20, which is Critical, so the existing assertion holds [VERIFIED: deterministic-assessment-draft-provider.ts:109, 117-118].

### Questionnaire wire v2

- **Root:** `schemaVersion` (enum `[2]`), `title`, `description` and `questions` (an array).
- **Each question:** `questionText`, `helpText` (an empty string means none), `answerType` (enum Text, Long text, Single select, Multi select, Date), `sectionTitle`, `required` and `choices` (a string array).
- **The adapter:**
  - assigns `q-N`, the section keys and the orders, as today (06.7 D-14);
  - rejects fewer than 6 or more than 20 questions;
  - converts choices to `{value, label}`;
  - appends `{ value: "not-sure", label: "Not sure" }` last to any select without an equivalent ("not sure", "unsure", "don't know", or "unknown" in any case);
  - maps help text to null when blank and rejects help text of more than 2,000 characters.
- **The proposal parser** accepts an optional `helpText` on each question.
- **The deterministic provider:** help text on every question; one optional question; one question echoing the regulatory requirements and one naming a selected asset (so integration and E2E can prove the context arrived).
  - Its yes/no third-party question becomes a Single select with Yes, No and Not sure (values `yes`, `no`, `not-sure`), as D-16 requires of every generated questionnaire.
  - Its dependent details question stays conditional, visible when the answer `equals` `"yes"`. The visibility rule accepts string values [VERIFIED: apps/backend/src/api/csrm-questionnaire/services/questionnaire-definition.ts:24, `visibility?: { questionKey: string; operator: VisibilityOperator; value: string | boolean }`].
  - The deterministic draft's third-party rule therefore reads `true` or `"yes"`, because seeded questionnaires keep their Boolean answers.

## The AI data policy

- **Classification:** `requestClassification(assets)` returns the maximum of `dataClassification` in the order `["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"]` [VERIFIED: assessment-workflow.ts:48 `const DATA_CLASSIFICATIONS = ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"] as const;`]; with none it returns `{ level: "Internal", source: "default" }` [ASSUMED: A1, the default].
- **Environment:** `isDevelopmentRuntime()` checks `process.env.NODE_ENV === "development" && process.env.CSRM_ENVIRONMENT === "development"`, the first two keys of the development identity [VERIFIED: apps/backend/src/utils/development-identity-enabled.ts:2-6].
- **Ceiling:**
  - `config/ai.ts` gains `dataClassificationCeiling: env("CSRM_AI_DATA_CLASSIFICATION_CEILING", "")`.
  - `assertCsrmAiConfiguration` rejects a non-empty value outside the four labels. It runs at `register` [VERIFIED: apps/backend/src/index.ts:16-18].
  - The check must sit before the function's early return for non-hosted providers (`if (config?.provider !== "openai-compatible") return;` [VERIFIED: apps/backend/src/csrm/ai-config-validation.ts:18]), because the policy applies to every provider (D-27).
  - **Resolution:** development with no ceiling allows everything; otherwise, with no ceiling, refuse with `AI_POLICY_NOT_CONFIGURED`; with a ceiling, refuse when the classification is above it with `AI_CLASSIFICATION_ABOVE_CEILING`.
- **Where it is checked:**
  - at enqueue, in `generateQuestionnaire` and `generateAssessment`, as a 409 with the reason;
  - at execution, in the job, before the run is created, as a job failure with the same code;
  - in the generation-jobs read, as `aiPolicy`.
- **The transcript flag:** `logCompletionDiagnostic` writes when `config.completionTranscriptDiagnostics` is true [VERIFIED: apps/backend/src/csrm/openai-compatible-client.ts:27-29], and `config/ai.ts:9` reads `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS`. Phase 12 honours it only when `isDevelopmentRuntime()`, and `assertCsrmAiConfiguration` warns when it is set elsewhere. The existing transcript test runs under the development environment.
- **Pins:** the Strapi harness saves and restores its environment keys [VERIFIED: apps/backend/tests/helpers/strapi-http-harness.ts:415, 436, 471-473], and Playwright's Strapi server pins `CSRM_AI_PROVIDER: 'deterministic'` [VERIFIED: apps/csrm/playwright.config.ts webServer env]. Both add `CSRM_AI_DATA_CLASSIFICATION_CEILING: ''`.

## Roles and R-08-42

- **The agent's grants:** `role.security_analyst_agent` holds, among others, `function.questionnaires.questionnaire_details`, `function.risk_assessments.risk_assessment_details`, `function.risk_assessment_requests.core_api`, `function.risk_assessment_requests.delete_api` and `function.risk_assessment_requests.reference_data_api` [VERIFIED: docs/references/idambox-csrm-role-function-api-catalogue.json:74-94].
- **Where draft generation sits:** `POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment` belongs to `function.questionnaires.questionnaire_details` (`.api.05`) [VERIFIED: catalogue:1481-1485], and the draft job read and retry belong to `function.risk_assessments.risk_assessment_details` (`.api.09`, `.api.10`) [VERIFIED: catalogue:1626-1645].
- **The guard:** the human-only guard lists the release, the five governance operations and the insights, not draft generation [VERIFIED: apps/backend/src/policies/csrm-authorization.ts:41-49]. The matrix expects `analystAndAgent(202)` for draft generation [VERIFIED: apps/backend/tests/fixtures/authorization-matrix.ts:904-916].
- **Plan:** move the three FunctionApis into `function.assessment_draft.generate_api`, `.job_read_api` and `.retry_api`, held by `role.security_analyst` only. Keep their names, URLs and descriptions, and give each an id under its new Function (`.api.01`), as Phase 7 did: its moved entries kept "their names, URLs and descriptions unchanged" [VERIFIED: catalogue:23, note 8] and took ids such as `function.dashboard.summary_api.api.01` (observed in the printed catalogue). Add the three URLs to `HUMAN_ANALYST_ONLY_OPERATIONS`. Update `contract-catalogue.integration.test.ts:150-152` (grants) and add a test in the pattern of `questionnaireGenerationRoutes` [VERIFIED: :172-200].
- **R-08-42:** remove `core_api`, `delete_api` and `reference_data_api` from the agent. The Requestor still holds `core_api` and `reference_data_api` [VERIFIED: catalogue:97-113]. The matrix rows at `authorization-matrix.ts:644-705` change their `serviceAgent` expectation for the create, update and delete rows, and the request list and read rows follow the new grants.
- **Seeding:** at every boot the seed replaces each Function's API list and each role's Function list from the catalogue [VERIFIED: apps/backend/src/bootstrap/seed-csrm-data.ts:434-574]. A moved FunctionApi therefore becomes an unlinked row, which has no effect on authorisation (the policy walks role → function → functionApis [VERIFIED: csrm-authorization.ts:149-153]).

## Contract changes

| # | Operation or schema | Change | Actors |
|---|---|---|---|
| 1 | `QuestionnaireQuestion` | `helpText: string \| null` (required, nullable; 2,000 characters or fewer); `aiOrigin: "generated" \| "generated-edited" \| "analyst-added"` (optional, analyst reads only; absent when not generated) | helpText for both; origin for the analyst |
| 2 | `QuestionnaireSummary` (and its header response) | `aiAssisted: boolean` (both actors); `generation: { generatedAt, generatedBy: ActiveUserSummary \| null, providerName, providerVersion, runId: string \| null } \| null` (optional, analyst only) | Both / analyst |
| 3 | `AnalystAssessmentDetail` | `generation` (the same shape); `aiProvenance: AssessmentAiProvenance \| null`; `AnalystRiskDetail.aiProvenance: RiskAiProvenance \| null`, with actors resolved to `ActiveUserSummary` and suggestions carrying the control summary through Phase 10's label rule | Analyst |
| 4 | `RequestorReleasedAssessmentDetail` | `aiAssisted: boolean` | Requestor |
| 5 | Release readiness | New keys: risk-scope `aiProposalsReviewed` (destination `risk-{id}`), assessment-scope `aiProposalsReviewed` (destination `assessment-details`); the `key` is already a free string [VERIFIED: specification.json `ReleaseReadinessRiskRequirement.key` `{"type":"string"}`], and the labels are served | Analyst |
| 6 | `GET /api/v1/ai_runs/{runId}` (new) | 200 `{ data: AiRun }`: documentId, operation, status, startedAt, completedAt, initiatedBy, providerName, providerVersion, instruction, contextSummary, failureCode, failureMessage, targets; 403 or 404 | Human analyst only |
| 7 | `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` (new) | Body `{ decisions: [{ target: { kind: "risk", riskId } \| { kind: "assessment" }, action: "accept" \| "dismiss" \| "restore", fields?: string[], suggestion?: string }] }` (1 to 200 items); 200 `{ data: { applied, unchanged } }`; 400, 403, 404 or 409 with a reason | Human analyst only |
| 8 | Phase 10's generation-jobs read | `aiPolicy: { status: "allowed" \| "refused", reason: string \| null, requestClassification, classificationSource: "assets" \| "default", ceiling: string \| null }` | Human analyst |
| 9 | Both conflict response schemas (Phase 10 10-06) | New reasons: `AI_POLICY_NOT_CONFIGURED`, `AI_CLASSIFICATION_ABOVE_CEILING`, `ASSESSMENT_NOT_MUTABLE`, `AI_PROPOSAL_ALREADY_DECIDED`; `AssessmentDraftWorkflowError` gains the optional reason | — |
| 10 | Catalogue | Three moved FunctionApis, two new API-only Functions (`function.ai_runs.read_api`, `function.ai_proposals.decide_api`) for `role.security_analyst`, three agent withdrawals; served-operations regenerated | — |

The job `failureCode` is a free string today [VERIFIED: specification.json `QuestionnaireGenerationJob.failureCode` `{"type":"string"}`], so `CONTEXT_TOO_LARGE`, `AI_POLICY_NOT_CONFIGURED` and `AI_CLASSIFICATION_ABOVE_CEILING` as job failure codes need no schema change. The web maps them to copy.

## Architecture Patterns

### System Architecture Diagram

```
Security Analyst (hub) --Generate--> Strapi route --policy: human-analyst grant--> controller
        |                                                          |
        |                                  AI data policy (classification vs ceiling)
        |                                        | refused -> 409 AI_* reason (hub already shows it via aiPolicy)
        |                                        v allowed
        |                              in-process job registry (single flight) --202 job--> hub polls
        |                                        | async
        |                                        v
        |          context builder: request (+systems, assets), [questions and answers], Risk Type
        |          library (ranked, bounded), [control candidates] -> model context + summary + sources
        |                                        | over budget -> job failed CONTEXT_TOO_LARGE (no run)
        |                                        | policy re-check fails -> job failed AI_* (no run)
        |                                        v
        |                              CsrmAiRun created (running, contextSummary)
        |                                        v
        |          provider: deterministic | openai-compatible (wire v2 -> adapter -> internal)
        |                                        v
        |                      context-aware closed parser --invalid--> run failed, job failed
        |                                        v
        |      one transaction: questionnaire (helpText) or draft (risks with aiProvenance,
        |      pre-fill, suggestions) + assessment aiProvenance + run completed (proposal)
        v
Analyst (editor) --GET assessment (aiProvenance) + GET ai_runs/{id}--> markers, citations, suggestions
        |--POST ai_proposal_decisions--> assessment mutation lock --> aiProvenance + run.decisions (+ Planned control)
        |--PATCH risk / assessment--> fields changed from AI values become "edited"
        '--Release--> readiness requires no "proposed" field
Requestor --> questionnaire (help text, "Not sure", AI disclosure) --> released assessment (AI disclosure)
Bootstrap --> runs left "running" become "interrupted"
```

### Recommended project structure (new modules)

```
apps/backend/src/csrm/
├── risk-scale.ts                  # 5 x 5 vocabulary, scores, bands, deriveRating, acceptProposalAllowed
└── ai/
    ├── data-policy.ts             # classification order, request classification, ceiling, dev runtime, transcript gate
    ├── assessment-context.ts      # types, pure builder, bounds, source catalogue, summary, digest
    ├── assessment-context-loader.ts  # Strapi reads (request + relations, questionnaire, library, candidates)
    ├── library-ranking.ts         # deterministic lexical ranker
    └── prompt-sections.ts         # system / instruction slot / data block rendering over promptDataTag
apps/backend/src/api/csrm-ai-run/
├── content-types/csrm-ai-run/schema.json
├── services/ai-run-record.ts      # create running, complete, fail, reconcile; closed envelope parsers
├── controllers/csrm-ai-run.ts, routes/csrm-ai-run.ts, operations.ts   # GET /v1/ai_runs/:runId only
apps/backend/src/api/csrm-assessment/services/ai-provenance.ts   # envelopes, edit marking, decision application
apps/csrm/src/features/ai-assistance/
├── ai-assistance-domain.ts        # zod-free: states, labels, source kinds, presentation
├── ai-run-schema.ts, ai-run-service.ts, ai-assistance-actions.ts
└── ai-provenance-header.tsx, ai-run-disclosure.tsx (lazy), ai-field-marker.tsx, ai-citations.tsx,
    ai-control-suggestions.tsx, ai-assistance-notice.tsx
```

### Pattern 1: Deep context module

- **What:** `buildAssessmentContext(strapi, { operation, requestId, questionnaireId? })` returns `{ userPrompt, summary, sources, allowed, policy }`, with the loader and the pure builder behind it.
- **When:** every AI operation, now and later (notes and attachments plug in, D-08).
- **Why:** the prompt, the summary, the citations and the policy are computed once from one set of records, so they cannot disagree.

### Pattern 2: Wire shape, adapter, context-aware parser

The 06.7 D-14 pattern extended: the model returns a friendly shape; the adapter assigns every server-owned value; the parser, given the context's allowed sets, is the gate.

### Pattern 3: Current fact plus append-only history (06.8)

`aiProvenance` is read by release readiness; `CsrmAiRun.decisions` is the narrative. Both are written in one transaction inside `withMutableAssessmentMutation` [VERIFIED: assessment-workflow.ts:430-481].

### Pattern 4: Human-only API Functions with a second guard

As `function.questionnaire_generation.*` [VERIFIED: catalogue:118-131] and `HUMAN_ANALYST_ONLY_OPERATIONS`.

### Pattern 5: Batch decisions in one Server Action

Next 16.3 "dispatches Server Actions one at a time per client" [CITED: apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md "Sequential dispatch on the client"]. "Accept remaining" and bulk actions therefore send one batch request, and the action calls `revalidatePath` so the response carries the re-rendered page [CITED: same file, "A single response carries data and UI"].

### Anti-Patterns to Avoid

- Asking the model for ratings or classifications that CSRM can derive.
- Enum-constraining every citation field.
- Silently trimming Requestor text.
- Tag names built from data values.
- Letting the service agent start generation.
- Storing Requestor text in the run record.
- Projecting `generation`, run ids or provenance to a Requestor.
- Zod in client components on the editor route.
- A second, parallel readiness mechanism, instead of new keys in `projectReleaseReadiness`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prompt escaping | A new escaper | `promptDataTag` | Already tested against tag breaking (`ai-provider-guardrails.unit.test.ts`) |
| Provider HTTP, retries, errors | A fetch client | `requestJsonCompletion` | Typed failure taxonomy, keyless endpoints, strict `response_format` |
| Assessment serialisation, locks, edit transitions | New locking | `withMutableAssessmentMutation` | Preserves the 06.8 D-04 and D-13 review semantics |
| Control implementation creation | Direct document writes | The control-implementation workflow's create | Same validation as the manual path |
| Actor display names | Per-row lookups | One batched lookup (the 08 D-31 pattern in `questionnaire-scope.ts:283-307`) | Bounded reads |
| Reason codes and copy | Ad hoc messages | Phase 10's `conflict-reasons.ts` and `refusal-copy.ts` | One closed vocabulary |
| Hashing | A custom digest | `node:crypto` SHA-256 | Standard |

**Key insight:** every risky decision (ratings, classification, the Accept rule, what reaches the provider, who may start) must live server-side in one module that tests can pin. The model and the browser only choose among values CSRM allows.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The operator's development SQLite database (`apps/backend/.tmp/data.db`) holds UAT-A, UAT-B and UAT-C and the seeded AI drafts with `providerName` but no provenance | None. No backfill (D-23): the table and columns appear at the orchestrator's next Strapi start, and existing rows read as null provenance. Code edit only |
| Live service config | Role → Function grants are reconciled from the bootstrap catalogue at every boot [VERIFIED: seed-csrm-data.ts:531-574] | The agent withdrawals and FunctionApi moves take effect at the next boot. Moved entries leave unlinked FunctionApi rows (harmless; the Phase 7 precedent) |
| OS-registered state | None known: the phase adds no scheduled task, service or other OS registration, and none was found for the AI settings | None |
| Secrets and environment variables | A new, non-secret `CSRM_AI_DATA_CLASSIFICATION_CEILING`. The operator's `.env` lacks it, so development keeps no ceiling. Production deployments must set it | Document it in `apps/backend/.env.example` and in the residual register; pin it empty in both test harnesses |
| Build artifacts | `apps/backend/dist` (rebuilt at boot and shared by tests, D-12), `apps/csrm/src/lib/api/generated/schema.d.ts`, `docs/references/served-operations.json` | Regenerate with `api:generate` and `served-operations:write`, dev servers stopped |

## Common Pitfalls

### Pitfall 1: Schema keywords outside the production subset
- **What goes wrong:** Azure rejects or ignores `minItems`, `maxLength` or `const`, and production generation fails or drifts.
- **How to avoid:** the schema guard test (D-06); bounds live in the adapters.
- **Warning signs:** `PROVIDER_OUTPUT_INVALID` with `provider_rejected_request` in development transcripts.

### Pitfall 2: The one-type check survives
- **What goes wrong:** the old uniqueness check (`assessment-draft-provider.ts:115`) refuses a legitimate two-risk draft.
- **How to avoid:** a wire test with two risks of one type is RED first.

### Pitfall 3: Ratings in two places
- **What goes wrong:** keeping model ratings next to derivation invites mismatches.
- **How to avoid:** remove ratings from the wire shape; the parser re-derives.

### Pitfall 4: Output budget
- **What goes wrong:** citations and suggestions roughly double the output. The assessment default is `maxOutputTokens: env.int("CSRM_AI_ASSESSMENT_MAX_OUTPUT_TOKENS", 8000)` [VERIFIED: apps/backend/config/ai.ts:14]. A long draft can hit the limit, and truncated JSON fails as `PROVIDER_OUTPUT_INVALID`.
- **How to avoid:** the prompt asks for concise statements and typically 3–12 risks; document the recommended budget in `.env.example`. Never change the operator's `.env`.

### Pitfall 5: Latency
- **What goes wrong:** larger prompts take longer than the UAT's 20–25 seconds. The request timeout default is 60 seconds [VERIFIED: config/ai.ts:7], and the hub stops polling after 30 seconds, then offers "Check again".
- **How to avoid:** keep that behaviour; a `PROVIDER_TIMEOUT` is visible and retryable.

### Pitfall 6: Hand-written provider fixtures
- **What goes wrong:** a hand-written internal proposal cannot catch wire-shape defects, as 06.7 found.
- **How to avoid:** every adapter test sends model-facing JSON through `fake-openai-compatible-server.ts`.

### Pitfall 7: The route budget
- **What goes wrong:** `/app/review/assessments/{documentId}` is at 269,653 of 300,000 delivered bytes [VERIFIED: docs/performance/phase-08-baseline.md:61, 92], and Phase 10 adds pickers.
- **How to avoid:** server-render the header and the disclosure; keep the markers small and zod-free; `next/dynamic` must be called from a Client Component, because "When a Server Component dynamically imports a Client Component, automatic code splitting is currently not supported" [CITED: apps/csrm/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md].

### Pitfall 8: Environment leakage into tests
- **What goes wrong:** a developer's ceiling, or `openai-compatible`, in `.env` changes outcomes.
- **How to avoid:** pin both variables in both harnesses (D-31).

### Pitfall 9: The readiness regression
- **What goes wrong:** a decision is an accepted edit. `restore` on an in-review, release-ready assessment regresses it to draft (the 06.8 D-13 table [VERIFIED: assessment-workflow.ts:181-203]).
- **How to avoid:** this is intended; the tests assert it.

### Pitfall 10: The provenance log and concurrency
- **How to avoid:** append to `run.decisions` only inside the assessment's serialisation, and bound the log.
- **Warning signs:** lost decisions when two analysts accept concurrently.

### Pitfall 11: Null provenance in closed parsers
- **What goes wrong:** legacy rows carry null `aiProvenance`, and a parser that does not accept null breaks every assessment read.
- **How to avoid:** accept null in every Zod and Strapi parser.

### Pitfall 12: A malformed governance log
- **What goes wrong:** deriving `aiOrigin` from a malformed log throws.
- **How to avoid:** project null origins; never deny the read (the 06.8 posture).

### Pitfall 13: Interrupted reconciliation with several processes
- **What goes wrong:** with more than one Strapi process, the bootstrap would mark other processes' runs interrupted.
- **How to avoid:** record it in the contract-gap record and under R-08-36.

### Pitfall 14: Phase 10 is the base
- **What goes wrong:** every Phase 12 plan edits files that Phase 10 plans 10-05 to 10-23 change, and Phase 10's plans are being revised as this is written (10-23 was added).
- **How to avoid:** re-read the files and re-run the plan check after Phase 10 (and Phase 11) execute.

### Pitfall 15: Stale `dist` and dev servers
- **What goes wrong:** the Strapi suite, single-file runs and `served-operations:write` share `apps/backend/dist` with the dev server.
- **How to avoid:** stop the dev servers first.

### Pitfall 16: Windows vitest `EPERM: rename`
- **How to avoid:** rerun the file alone before treating it as a failure.

### Pitfall 17: Shared schemas have more than one producer
- **What goes wrong:** a closed schema changes, but one of the projections that emits it does not, and a parse fails.
- **Where the schemas are shared** [VERIFIED: specification.json references printed this session]:
  - `QuestionnaireSummary` is the item of `QuestionnaireListResponse` as well as the data of `QuestionnaireHeaderResponse`;
  - `QuestionnaireQuestion` is the item of `QuestionnaireQuestionsResponse` and of `QuestionnaireMutationResult.answers` (the answer-save response);
  - `AnalystAssessmentDetail` and `RequestorReleasedAssessmentDetail` are the two branches of `AssessmentDetailGetResponse`.
- **How to avoid:** every projection that emits a changed schema (the list, the header, the questions read, the answer-save result, both assessment branches) changes in the same plan as the spec and the parser.

## Code Examples

### The 5 × 5 derivation (decision 8 values, verbatim)

```typescript
// Source: .planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md decision 8 (Likelihood, Consequence, Rating)
export const LIKELIHOODS = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"] as const;
export const CONSEQUENCES = ["Insignificant", "Minor", "Moderate", "Major", "Severe"] as const;
export function deriveRating(likelihood: Likelihood, consequence: Consequence): AssessmentRating {
  const score = (LIKELIHOODS.indexOf(likelihood) + 1) * (CONSEQUENCES.indexOf(consequence) + 1);
  return score <= 4 ? "Low" : score <= 9 ? "Moderate" : score <= 16 ? "High" : "Critical"; // 1–4, 5–9, 10–16, 20–25
}
export const acceptProposalAllowed = (residual: AssessmentRating) => residual === "Low" || residual === "Moderate";
```

### Request classification and the policy decision

```typescript
// Source: assessment-workflow.ts:48 (the classification vocabulary); D-26, D-27
const ORDER = ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"] as const;
export function requestClassification(assets: readonly { dataClassification?: string | null }[]) {
  const levels = assets.map((a) => ORDER.indexOf(a.dataClassification as never)).filter((i) => i >= 0);
  return levels.length ? { level: ORDER[Math.max(...levels)], source: "assets" as const }
                       : { level: "Internal" as const, source: "default" as const };
}
```

### The portable schema guard (test sketch)

```typescript
const FORBIDDEN = new Set(["minLength", "maxLength", "pattern", "format", "minItems", "maxItems", "uniqueItems", "const"]);
function walk(node: unknown, depth: number, acc: { properties: number; maxDepth: number; forbidden: string[] }) {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (FORBIDDEN.has(key)) acc.forbidden.push(key);
    if (key === "properties" && value && typeof value === "object") { acc.properties += Object.keys(value).length; acc.maxDepth = Math.max(acc.maxDepth, depth + 1); }
    walk(value, key === "properties" || key === "items" ? depth + 1 : depth, acc);
  }
}
// assert: forbidden empty, properties <= 100, object nesting <= 5
```

### The Next 16.3 Server Action for a decision batch

```typescript
// Source: apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md (single roundtrip)
'use server';
import { revalidatePath } from 'next/cache';
export async function decideAiProposalsAction(input: unknown) {
  const parsed = decisionInputSchema.safeParse(input);           // closed Zod input
  if (!parsed.success) return { ok: false as const, formError: 'The decision could not be sent.' };
  const result = await decideAiProposals(parsed.data);           // typed openapi-fetch service
  if (result.ok) revalidatePath(`/app/review/assessments/${encodeURIComponent(parsed.data.assessmentId)}`);
  return result;
}
```

## Tests

- **Deterministic provider units** (both operations): outputs pass their own parsers; the same normalised input gives the same output; each context rule fires from request fields and systems or assets; several risks per type; an Accept for a Moderate residual rating; citations; one uncited field and one uncited claim; a null type; help text and "Not sure".
- **Model-facing wire tests** (`ai-provider-assessment.unit.test.ts`, `ai-provider-questionnaire.unit.test.ts` and `ai-provider-guardrails.unit.test.ts`, through the fake server):
  - UAT-A-like wire fixtures: two risks of one type, an Accept on a High residual (downgraded), an unknown source (dropped), a suggestion outside the candidates (dropped), an unknown system key (refused), a rating field present (refused as an extra key);
  - the captured request: the three-slot prompt, escaping, no tools, the schema subset and property count, the candidate and type enums;
  - the transcript flag honoured only in development.
- **Pure module units:** `risk-scale` (all 25 cells against the band table), `data-policy` (every branch: environment by ceiling by classification by default), the context builder (inclusion, exclusion, bounds, digest stability, `CONTEXT_TOO_LARGE`), the ranker (order, ties), and the envelopes (closed parsing, fail-safe nulls).
- **Mounted integration (Strapi):**
  - questionnaire generation writes a run (running, then completed), help text, and the context summary without Requestor text;
  - policy refusals leave persistence deep-equal and create no run;
  - draft persistence: pre-fill, `aiProvenance`, suggestions, the run's completion and proposal;
  - readiness outstanding until accepted; edits mark `edited`;
  - decisions: accept (fields, suggestion creating Planned), dismiss, restore, idempotence, released refusal;
  - bootstrap reconciliation (interrupted);
  - projections for each actor (the Requestor never gets `generation` or provenance);
  - legacy rows with null provenance.
- **Matrix, catalogue and inventory:** rows for the two new operations (`humanAnalystOnly`); draft generation, job read and retry move to `humanAnalystOnly`; the agent's request rows change; `contract-catalogue` covers the human-only draft Functions and the withdrawals; `served-operations` is regenerated; `cmp` of the catalogue copies.
- **Web units:** parsers (closed, nullable provenance), `ai-assistance-domain`, markers (icon plus text, accessible names), citations, suggestions (add, dismiss, Undo), accept (optimistic, rollback), the disclosure's five states, the Requestor notice, help text as the hint, the hub's policy refusal copy, the parity guard and the chain guard.
- **E2E:**
  - a new `ai-context-provenance.spec.ts` journey with its own records (UAT-A-like request, questionnaire with help text and "Not sure", answers, draft with system, asset and classification pre-filled, citations, suggestion add, accept remaining, release; the Requestor sees the disclosure) at 375px and 1440px, with axe;
  - deliberate changes to `assessment-release-workflow.spec.ts` (accept AI proposals before release; the released view has no "Generated by") and `questionnaire-generation-workflow.spec.ts` (help text and "Not sure" on the generated questionnaire).

## Plan grouping and wave order

"Owns" lists the shared files a plan edits, so no two plans in a wave share one.

| Wave | Plan | Slice | Owns (shared files) | Dev servers |
|---|---|---|---|---|
| 1 | 12-01 | Contract-gap record `phase-12-ai-run-record-and-provenance.md`, then a `checkpoint:decision` (the orchestrator approves and records it, G-6) | `docs/contract-gaps/` (new file) | Running is fine (docs) |
| 1 | 12-02 | `csrm/risk-scale.ts`, `csrm/ai/data-policy.ts`; `config/ai.ts` ceiling; `ai-config-validation.ts` (invalid ceiling, transcript warning); `openai-compatible-client.ts` transcript gate; `.env.example`; units | `config/ai.ts`, `ai-config-validation.ts`, `openai-compatible-client.ts` | Stopped for Strapi test runs |
| 2 | 12-03 | Context builder, ranker, prompt sections and loader; units with UAT-A-like fixtures (depends on 12-02) | `csrm/ai/*` (new) | Stopped |
| 2 | 12-04 | Schema change after approval: `csrm-ai-run` type, `aiProvenance` on the risk and the assessment; `ai-run-record.ts`, `ai-provenance.ts` envelopes; bootstrap reconciliation; migration proof (depends on 12-01) | Three `schema.json` files, `src/index.ts` | Stopped |
| 3 | 12-05 | Questionnaire generation v2: wire, adapter, deterministic provider, context, policy (enqueue and execution), run lifecycle, help text persistence; conflict reasons in Strapi, the spec and the web; refusal copy; harness pins | `questionnaire-generation-*`, `conflict-reasons.ts` (both), `refusal-copy.ts`, spec and generated client, `strapi-http-harness.ts`, `playwright.config.ts` | Stopped |
| 3 | 12-06 | Draft provider layer v2: internal proposal and parser, OpenAI adapter, deterministic provider; wire-shape tests (no persistence) | `assessment-draft-provider.ts`, `openai-compatible-assessment-draft-provider.ts`, `deterministic-assessment-draft-provider.ts` | Stopped |
| 4 | 12-07 | Draft persistence: context and policy in `generateAssessment` and the job, run lifecycle, pre-fill, provenance, suggestions; readiness requirement; edit marking in `updateRisk` and `updateAssessment`; draft conflict reason pass-through | `assessment-workflow.ts`, `risk-workflow.ts`, the questionnaire controller's `generateAssessment` | Stopped |
| 5 | 12-08 | Questionnaire reads: `helpText`, `aiOrigin`, `generation`, `aiAssisted`; spec, generated client, closed parsers, parity | `questionnaire-scope.ts`, questionnaire controller, spec and generated client, web questionnaire schema and service, parity guard | Stopped |
| 6 | 12-09 | Assessment reads: `generation`, `aiProvenance`, `aiAssisted`; batched name and control lookups | `assessment-scope.ts`, assessment controller, spec and generated client, web assessment schema and service, parity guard | Stopped |
| 7 | 12-10 | New operations: run read and decisions (routes, handlers, operations, guard, catalogue Functions, spec, services, actions, parsers, matrix, inventory) | Catalogue copies, `csrm-authorization.ts`, matrix, `served-operations.json`, spec and generated client, parity and chain guards | Stopped |
| 8 | 12-11 | Human-initiated generation and R-08-42: FunctionApi moves, agent withdrawals, guard list, matrix, catalogue test, residual register (R-08-12, R-08-42) | Catalogue copies, `csrm-authorization.ts`, matrix, `served-operations.json`, `contract-catalogue.integration.test.ts`, `docs/security/phase-08-residual-risks.md` | Stopped |
| 9 | 12-12 | `aiPolicy` on the generation-jobs read, and the hub panels' refusal state | Questionnaire controller (the jobs read), spec and generated client, web assessment schema and service, `assessment-detail.tsx`, both job panels | Stopped |
| 10 | 12-13 | Recorded design extensions (marker, citation chip), then the AI provenance primitives, the disclosure (lazy) and the Requestor notice | `docs/design/csrm-design-direction.md`, `features/ai-assistance/*` | Running is fine for web units |
| 11 | 12-14 | Assessment editor and released view integration; release journey E2E changes | `assessment-editor.tsx`, `risk-editor.tsx`, `released-assessment.tsx`, `released-risk-details.tsx`, the assessment page loader, `assessment-release-workflow.spec.ts`, copy guard | Stopped (Playwright) |
| 12 | 12-15 | Questionnaire surfaces: governance header, markers, help text field; Requestor help text; introduction disclosure and "Not sure"; E2E changes | `questionnaire-governance.tsx`, `questionnaire-renderer.tsx`, `questionnaire-introduction.tsx`, `questionnaire-review.tsx`, questionnaire page loaders, questionnaire specs | Stopped (Playwright) |
| 13 | 12-16 | New UAT-A-like E2E journey; glossary entries in the root `CONTEXT.md` (AI run, AI proposal, request data classification); full five-command gate on the production build; 375px and 1440px checks for both actors; clean tree | `ai-context-provenance.spec.ts` (new), `CONTEXT.md` | Stopped |

The planner may merge 12-10 and 12-11, or 12-02 and 12-03, if each plan stays within its estimate. Any plan that edits a shared file runs after the previous owner of that file.

## E2E specs that change deliberately

| Spec | Change | Plan |
|---|---|---|
| `assessment-release-workflow.spec.ts` | After generating the draft, accept the remaining AI proposals on each risk and the assessment details before readiness reads all met; the Requestor's released overview shows the AI disclosure and no "Generated by". The deterministic summary sentence at `:283` stays unless the deterministic provider changes it, in which case the plan names it | 12-14 |
| `questionnaire-generation-workflow.spec.ts` | The generated questionnaire shows help text and a "Not sure" choice; the provenance header is visible to the analyst | 12-15 |
| `questionnaire-workflow.spec.ts` | Only if the Requestor introduction assertion changes with the disclosure | 12-15 |
| `accessibility.spec.ts`, `performance.spec.ts` | Stay green (new markers pass axe; the editor route stays in budget) | 12-14, 12-16 |
| New `ai-context-provenance.spec.ts` | The UAT-A-like journey with its own records | 12-16 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Asking a model for loosely typed output and repairing it | Strict JSON-schema structured outputs, with a closed server parser as the gate | Structured outputs 2024; limits raised July 2025 [CITED: community.openai.com, 1313593] | Keep schemas inside the strictest documented subset (Azure) |
| Free-form "grounding" | Per-statement citations to retrievable source ids, with uncited claims surfaced for human review | Common retrieval-augmented practice [ASSUMED] | The adapter validates ids; the analyst verifies |
| Model-assigned risk ratings | Derived ratings from a documented matrix | ISO 31000 and ISO/IEC 27005 risk criteria (decision 8 basis) | One derivation module |

**Deprecated or outdated in this repository:**
- `const: "Treat"`.
- The three-name Risk Type filter.
- Questionnaire bounds 8–15.
- `minLength`, `maxLength`, `minItems`, `maxItems` and `const` in wire schemas.
- The released view's "Generated by".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Internal is an acceptable default classification for requests with no classified asset | The AI data policy; D-26 | If the operator wants fail-closed, requests without classified assets become unable to use AI once a ceiling is set; a one-line policy change |
| A2 | Azure rejects or ignores the unsupported keywords (only "unsupported" is documented) | Wire shapes | Either way the fix (remove them) is the same; only the urgency differs |
| A3 | A lexical shortlist of about 80 controls plus the applicable controls gives useful candidates | D-12 | Weaker suggestions; the operator's live check judges; a search library could replace the ranker |
| A4 | Models follow the citation and uncited-claim instructions well enough to help review | D-14 | More "No source cited" flags; still safe, because flags push the analyst to check |
| A5 | The default of 8,000 output tokens can be too small for long drafts with citations | Pitfall 4 | `PROVIDER_OUTPUT_INVALID` on long drafts; document the budget |
| A6 | Search library names (MiniSearch, Fuse.js) | Standard Stack alternatives | Informational only; nothing is installed |
| A7 | Per-statement citation is the prevailing grounding practice | State of the Art | Informational |

## Open Questions

1. **Should undecided suggestions block release?**
   - What we know: decision 6 records rejections, and G-4 wants low friction.
   - Recommendation: no. The decisions log shows which were added or dismissed, and undecided ones were simply not adopted.
2. **Should the context budgets be configurable now?**
   - What we know: local models (999.1) have smaller windows.
   - Recommendation: constants now, with the seam noted. 999.1 adds configuration.
3. **The exact readiness label text** ("AI proposals reviewed"): fixed by the UI-SPEC, served by Strapi.
4. **Service agent role retirement:** recorded for Phase 22 (D-33).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (via the PATH prefix) | All builds and tests | ✓ | v24.19.0 (observed) | — |
| pnpm | Scripts | ✓ | 11.24.0 (observed) | — |
| SQLite (`better-sqlite3`) | Strapi tests | ✓ | 12.8.0 | — |
| Playwright Chromium | E2E | ✓ (used by the Phase 8 gate) | 1.58.2 | — |
| Hosted AI provider | Manual live check only | Operator-owned | — | Deterministic provider in all suites |
| Dev servers (1337, 3000) | Browser checks | Running now (observed LISTENING) | — | Must be stopped for Strapi-editing plans and Playwright |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Strapi: `node:test` via `tsc -p tests/tsconfig.json`, one database per file; web: vitest 4.1.11 (jsdom) with Testing Library; E2E: Playwright 1.58.2 with @axe-core/playwright 4.11.0 on the production build |
| Config file | `apps/backend/tests/tsconfig.json`; `apps/csrm/vitest.config.ts`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --filter @csrm/web exec vitest run <paths>`. Strapi file (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| Full suite command | `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/csrm api:check`; `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test:e2e` (dev servers stopped) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-05 (1) | The context holds the request fields, systems, assets, questions and answers, and minimises the rest | Strapi unit | quick run `assessment-context.unit.test.js` | ❌ Wave 0 |
| INT-05 (2) | Requestor text is escaped inside the data block; the analyst reads the run's summary | Strapi unit + integration + web | quick run `ai-provider-guardrails.unit.test.js`, `ai-run.integration.test.js`; `vitest run src/features/ai-assistance` | ✅ / ❌ Wave 0 |
| INT-05 (3) | Risks pre-filled with system, asset and classification from the request | Strapi integration + E2E | quick run `assessment-workflow.integration.test.js`; `ai-context-provenance.spec.ts` | ✅ / ❌ Wave 0 |
| INT-05 (4) | Refusal above the ceiling and when not configured (enqueue and execution), with no run; the summary recorded | Strapi unit + integration | quick run `ai-data-policy.unit.test.js`, `questionnaire-generation.integration.test.js`, `assessment-workflow.integration.test.js` | ❌ Wave 0 / ✅ |
| INT-06 (1) | Markers until accepted or edited; provider, time and analyst shown | Strapi integration + web + E2E | quick run `assessment-workflow.integration.test.js`; `vitest run src/features/ai-assistance src/features/assessments/assessment-editor.test.tsx`; E2E | ✅ / ❌ Wave 0 |
| INT-06 (2) | Citations kept or dropped; uncited flagged | Strapi unit (wire) + web | quick run `ai-provider-assessment.unit.test.js`; web marker tests | ✅ |
| INT-06 (3) | Requestor disclosure; no provider detail to the Requestor | Strapi integration + web + E2E | Projection tests; `released-assessment.test.tsx`; E2E | ✅ |
| INT-06 (4) | A run per provider call; lifecycle; interrupted at boot; decisions log | Strapi integration | quick run `ai-run.integration.test.js` | ❌ Wave 0 |
| ASSESS-08 (1) | The library reaches the prompt; several per type; null type | Strapi unit (wire) + integration | quick run `ai-provider-assessment.unit.test.js`, `assessment-workflow.integration.test.js` | ✅ |
| ASSESS-08 (2) | Candidates from the whole library; one-click Planned; dismiss and restore recorded | Strapi unit + integration + web + E2E | quick run `library-ranking.unit.test.js`, `ai-proposal-decisions.integration.test.js`; web suggestions test; E2E | ❌ Wave 0 |
| ASSESS-08 (3) | Accept only when Low or Moderate, with a rationale; downgrade recorded; the analyst confirms | Strapi unit + integration | quick run `risk-scale.unit.test.js`, `ai-provider-assessment.unit.test.js` | ❌ Wave 0 / ✅ |
| QUES-10 (1) | Plain-language guidance; "Not sure"; optional; help text end to end; 6–20 | Strapi unit (wire) + integration + web + E2E | quick run `ai-provider-questionnaire.unit.test.js`, `questionnaire-generation.integration.test.js`; `vitest run src/features/questionnaires/questionnaire-renderer.test.tsx`; E2E | ✅ |
| QUES-10 (2) | Generation receives the context (regulatory requirements, systems, assets) | Strapi unit + integration | Builder and wire tests | ❌ Wave 0 / ✅ |
| D-32, D-33 | Human-only generation; agent withdrawals | Matrix + catalogue | quick run `authorization-matrix.integration.test.js`, `contract-catalogue.integration.test.js` | ✅ |
| D-06 | Portable schema subset | Strapi unit | the schema guard inside both provider unit files | ✅ |

### Sampling Rate

- **Per task commit:** the touched web files by path; the touched Strapi files by path (dev servers stopped); `typecheck` after type changes; `api:check` after spec changes.
- **Per wave merge:** the full web suite, `typecheck` and `api:check`; the full Strapi suite after every Strapi-editing plan; each UI plan's targeted Playwright specs at its end.
- **Phase gate:** the five full-suite commands on the production build, then `git status --porcelain` empty, the content-type freeze check (exactly the three approved schema files) and `cmp` of the catalogue copies.

### Wave 0 Gaps

- [ ] `apps/backend/tests/risk-scale.unit.test.ts`: the 25 cells, bands and appetite rule
- [ ] `apps/backend/tests/ai-data-policy.unit.test.ts`: environment by ceiling by classification by default; transcript gate
- [ ] `apps/backend/tests/assessment-context.unit.test.ts`: inclusion, exclusion, escaping, bounds, digest, `CONTEXT_TOO_LARGE`
- [ ] `apps/backend/tests/library-ranking.unit.test.ts`: determinism and ties
- [ ] `apps/backend/tests/ai-run.integration.test.ts`: the run lifecycle, reconciliation, the run read
- [ ] `apps/backend/tests/ai-proposal-decisions.integration.test.ts`: accept, dismiss, restore, idempotence, refusals, readiness
- [ ] `apps/backend/tests/fixtures/ai-wire/*.json`: model-facing UAT-A-like draft and questionnaire bodies
- [ ] `apps/csrm/src/features/ai-assistance/*.test.ts(x)`: domain, parsers, components, actions
- [ ] `apps/csrm/e2e/ai-context-provenance.spec.ts`: the new journey

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged; Keycloak deferred) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Exact grants; `HUMAN_ANALYST_ONLY_OPERATIONS`; record-level checks (run → request; decisions → the assessment's mutability); Requestor projections exclude AI internals; agent withdrawals |
| V5 Input Validation | yes | Closed Strapi parsers (wire, internal proposal, envelopes, decision body, bounds); closed Zod on the web; escaping of Requestor text |
| V6 Cryptography | yes (integrity digest only) | `node:crypto` SHA-256 |
| V7 Error Handling and Logging | yes | Safe failure codes and messages; the transcript flag works only in development; no Requestor text in the run record |
| V8 Data Protection | yes | Minimisation table; classification ceiling; fail-closed production |
| V13 API | yes | Contract chain, served inventory, matrix |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection through Requestor text | Tampering / Elevation | Delimited, escaped data block; system prompt states data is never instructions; no tools; closed parser; enums; derived ratings, classification and ids; the Accept rule enforced server-side; human review before release |
| Invented facts | Repudiation / Integrity | Citations validated against the catalogue; uncited flags; uncited claims; analyst acceptance required |
| Sending data above the approved classification | Information disclosure | Ceiling check at enqueue and in the job; fail closed in production; no run and no call on refusal |
| Transcript logging of personal data | Information disclosure | Flag works only in development (G-7) |
| Automation starting AI runs or editing requests | Elevation | Human-only generation Functions and guard; R-08-42 withdrawals |
| IDOR on runs | Information disclosure | Human-analyst-only operation; unknown id 404 with no enumeration; the Requestor never receives run ids |
| Provenance tampering (forging "accepted") | Tampering / Repudiation | Only the decision and update paths write provenance, inside the assessment lock; append-only decisions log with actor and time |
| Context flooding (denial of service) | Denial of service | Count bounds, character budget and `CONTEXT_TOO_LARGE` before any call; single-flight registry |

## Sources

### Primary (HIGH confidence)
- Repository code read this session:
  - the Strapi AI providers, workflows, registries, scopes, controllers, policy, bootstrap, config and schemas;
  - the catalogue JSON, the specification (schemas and paths printed), the matrix, the catalogue test, the provider tests and the harness;
  - the web editor, released view, hub, request schema and Playwright configuration.
- `.planning/` inputs: ROADMAP, REQUIREMENTS, NEXT-WAVE-DECISIONS, STATE, v1.0-STATE, FINDINGS, JOURNEYS, REPORT; the Phase 10 CONTEXT, plans (revised versions present) and UI-SPEC excerpts; the 06.7 and 08 CONTEXT files.
- `docs/contract-gaps/` records for Phases 4, 06.1, 06.2, 06.7 and 06.8; `docs/security/phase-08-residual-risks.md`; `docs/performance/phase-08-baseline.md`.
- Next 16.3.6 bundled docs: `server-actions.md`, `07-mutating-data.md`, `lazy-loading.md`, `refresh.md`.

### Secondary (MEDIUM confidence)
- Azure OpenAI structured outputs, "JSON Schema support and limitations" (Microsoft Learn, updated 2026-08-24).
- OpenAI Developer Community, "Structured Outputs limits are raised to support larger schemas" (2025-07-11).

### Tertiary (LOW confidence)
- OpenAI Developer Community thread on `minItems` and `maxItems` support (conflicting reports).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions read from the package manifests.
- Architecture: HIGH for placement and contracts (code read); MEDIUM for the ranker's usefulness, pending the live check.
- Pitfalls: HIGH for the code-grounded ones; MEDIUM for provider-subset behaviour.

**Research date:** 2026-09-28
**Valid until:** 2026-10-28, or until Phase 10 or 11 executes, whichever is first (their changes move line numbers and add the modules Phase 12 builds on).

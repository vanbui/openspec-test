# Phase 06.2: AI-Generated Contextualised Questionnaire - Research

**Researched:** 2026-09-03  
**Domain:** Authorised asynchronous questionnaire generation in the existing CSRM Strapi and Next.js workflow  
**Confidence:** HIGH

## User Constraints

- Plan only; do not implement in this phase-planning run. [VERIFIED: operator constraint]
- Keycloak is disabled and out of scope. [VERIFIED: operator constraint]
- `CsrmQuestionnaire` and `CsrmQuestion` are frozen and already carry the required generated-questionnaire data; do not make a schema change. Any alleged exception must be explicitly justified in the plan. [VERIFIED: operator constraint; `apps/strapi/src/api/csrm-questionnaire/content-types/csrm-questionnaire/schema.json`; `apps/strapi/src/api/csrm-question/content-types/csrm-question/schema.json`]
- Use the existing typed `openapi-fetch` web service layer, never raw page fetches; keep Strapi as the authoritative API and authorisation boundary; preserve JDL terminology; use strict TypeScript, semantic tokens, WCAG 2.2 AA, and responsive layouts from 375 to 1440px. [VERIFIED: AGENTS.md]
- Register every new route in both catalogue copies, update `docs/references/specification.json`, then run `pnpm --filter @csrm/web api:generate`; generated declarations must not be edited by hand. [VERIFIED: operator constraint]
- The existing assessment-draft pattern is the required design baseline. [VERIFIED: operator constraint]

## Summary

Build the operation as a sibling of the assessment-draft workflow, but make the assessment request—not a questionnaire—the generation target. The submitted analyst-review request screen must always render the generation affordance when `requestStatus` is `submitted`, including when no related questionnaire exists. This directly avoids treating an absent relation as an empty request screen. [VERIFIED: `.planning/ROADMAP.md` Phase 06.2 scope; `apps/web/src/features/assessments/assessment-detail.tsx`]

The backend should own a `QuestionnaireGenerationProvider` interface, a strict closed parser for its proposal, and a request-keyed in-memory registry with the assessment-draft lifecycle: `queued`, `running`, `completed`, `failed`, and failed-only retry. The persistence operation must load the request, validate submitted state, lock the request in a transaction, re-read authoritative state, replace only an existing unanswered questionnaire under an explicit replacement acknowledgement, and return a response whose persisted `questionnaire` relation is populated. [VERIFIED: `.planning/ROADMAP.md` Phase 06.2; `apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts`; `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts`]

**Primary recommendation:** Create a request-keyed questionnaire-generation workflow in the questionnaire domain, reusing the assessment draft registry/component semantics and the established Questionnaire Definition parser unchanged; no data-model change and no new dependency are needed. [VERIFIED: existing provider/registry/parser patterns]

## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| QUES-07 | An analyst triggers a reviewable contextual questionnaire generation job for a submitted request; an ordinary draft questionnaire is persisted and safe regeneration/retry behaviour is visible. | Request-scoped registry/provider/workflow, generated OpenAPI service boundary, analyst review client island, and mounted plus browser coverage. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Start, observe, and retry generation | API / Backend | Browser / Client | Strapi validates capability and record state; the browser only submits typed actions and polls. |
| Proposal validation and question persistence | API / Backend | Database / Storage | The provider output is untrusted until the closed parser accepts it; Strapi transactionally creates the questionnaire and questions. |
| Job state presentation and replacement acknowledgement | Browser / Client | API / Backend | The client shows bounded progress, safe errors, retry and confirmation; the API repeats all state checks. |
| Permission and record scope | API / Backend | — | FunctionAPI plus request record scope are authoritative; visibility is usability only. |

## Standard Stack

No package installation is required. Reuse the existing Strapi custom route/controller/service pattern, `openapi-fetch` client layer, generated declarations, server actions, React client island, shadcn primitives, Vitest, and Playwright. [VERIFIED: `apps/strapi/package.json`; `apps/web/package.json`; `AGENTS.md`]

## Architecture Patterns

### Required data flow

```text
Analyst submitted-request review
  -> typed Server Action -> typed questionnaire service -> POST /api/v1/assessment_requests/{requestId}/generate_questionnaire
  -> Strapi FunctionAPI + request scope policy
  -> request workflow guard -> request-keyed job registry
  -> queued -> running -> provider.generate(request context) -> closed proposal parser
  -> transaction + request row lock + authoritative reload
  -> replace unanswered questionnaire or create questionnaire and ordered CsrmQuestion records
  -> completed job carrying populated questionnaire relation
  -> client polling GET job status; failed job may POST retry
```

### Provider and parser boundary

Use a `QuestionnaireGenerationProvider` with immutable `name`, `version`, and `generate(context)` members, modelled on `AssessmentDraftProvider`. The deterministic provider must derive questions from request facts such as title, description, assessment type, business purpose/criticality, and third-party involvement; it must not rely on UI-only input. Every result must pass a closed parser before any persistence. [VERIFIED: `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts`; `.planning/ROADMAP.md` Phase 06.2 scope]

The parser must emit exactly the persisted definition shape supported today: each proposal question maps to `questionText`, `answerType`, and JSON `options`; the latter must carry `schemaVersion: 1`, a unique `questionKey`, one consistent ordered section, unique per-section order, required flag, optional valid choices, and only backwards-pointing type-compatible visibility conditions. [VERIFIED: `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts`]

Persist answer values as draft/empty (`answer: null`), so the existing Phase 3 renderer and answer workflow remain the sole renderer and mutation path. The known answer envelope values are `"draft"` and `"submitted"`; `assertMutableAnswerBatch` prevents edits once any submitted envelope exists. [VERIFIED: `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`]

### Registry and workflow contract

Mirror `createAssessmentDraftRegistry` with a bounded provenance adjustment: request-keyed deduplication applies only while a queued or running job is active. Maintain a separate active-by-request index and retained-by-job index; remove the active mapping when a job becomes completed or failed, retain that terminal record by job ID for actor-scoped reads until TTL/cap cleanup, and permit a new explicitly acknowledged generation request to create a fresh job after a terminal result. Keep queued asynchronous launch, single-flight execution, actor-scoped read/retry, attempt increment on retry, terminal TTL/cap cleanup, and safe failure code/message. The existing registry uses a `WeakMap` per Strapi process and returns its initial `queued` record immediately. [RESOLVED: bounded registry provenance decision]

Use an explicit generated questionnaire job response with `jobId`, `requestId`, initiating analyst identifier, provider name/version, `status`, `attempt`, timestamps, optional `questionnaire`, and safe failure code/message. The completed response must populate the `questionnaire` relation—not merely create it—because the typed web response parser rejects a declared relation that is absent. [VERIFIED: operator constraint; assessment job projection pattern in `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts`]

Before enqueue and again inside the transaction, require `requestStatus === "submitted"`. If no questionnaire exists, create it. If a questionnaire exists, inspect all its question answer envelopes: permit replacement only when no answer has a value/envelope indicating Requestor work, require an explicit replacement acknowledgement in the POST body, then replace the question set atomically. Refuse generation once any answer exists, never submit a questionnaire, and do not create an assessment or change request status. [VERIFIED: `.planning/ROADMAP.md` Phase 06.2 scope; state and answer-envelope guards in `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`]

Lock the `CsrmAssessmentRequest` row and re-read it in the transaction, following `lockAssessmentRequest` and the authoritative second-read in the assessment workflow. This closes races between job start, resubmission/reversal, and Requestor answering. [VERIFIED: `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts`]

### Routes, policies, catalogue, and generated contract

Plan three new explicit routes: POST generate for an assessment request, GET its job, and POST failed-job retry. Use the existing custom-operation route/controller/policy form; each route must use the application-enabled and CSRM authorisation policies, with request resource scope for generate and actor-scoped job access for GET/retry. [VERIFIED: `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts`; `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts`]

Create a dedicated API-only Function for each of the three operations so grants can be withdrawn independently. Grant generate, job read, and retry to `role.security_analyst` only. Do **not** grant them to `role.security_analyst_agent`: the operator confirms a human analyst triggers this action, and the agent role should not receive a new autonomous creation power merely because it currently mirrors analyst grants. State this deliberate divergence in the catalogue descriptions. [VERIFIED: operator constraint; `docs/references/idambox-csrm-role-function-api-catalogue.json` role definitions]

Update both byte-identical catalogue copies, `docs/references/specification.json`, and then regenerate `apps/web/src/lib/api/generated/schema.d.ts` with `pnpm --filter @csrm/web api:generate`. The web service must use the generated paths through the existing typed service boundary and closed schemas, never a hand-written declaration or page fetch. [VERIFIED: operator constraint; `apps/web/package.json`]

### Analyst UI

Extend `AssessmentDetail` rather than adding a competing screen. In the `submitted` request state, render the generation client island even when `request.questionnaire` is absent. If an unanswered questionnaire is already present, present an explicit destructive/irreversible replacement confirmation before POSTing; if answers exist, show a clear non-actionable explanation rather than a misleading trigger. [VERIFIED: `.planning/ROADMAP.md` Phase 06.2; `apps/web/src/features/assessments/assessment-detail.tsx`]

Model the island on `AssessmentDraftJob`: immediate queued display; 1-second bounded polling; distinct queued/running/completed/failed state; polite status announcement; safe failure display; failed-only retry; and a `Check again` recovery control after the 30-second polling bound. Preserve heading semantics (`h2`) and semantic tokens. On completion, link to the existing questionnaire review/detail route so it is rendered by Phase 3 rather than a duplicate renderer. [VERIFIED: `apps/web/src/features/assessments/assessment-draft-job.tsx`; `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx`]

## Do Not Hand-Roll

| Problem | Do not build | Reuse | Why |
|---|---|---|---|
| Questionnaire rendering and answer validation | A generated-question-only renderer or ad-hoc client validation | `parseQuestionnaireDefinition`, `QuestionnaireRenderer`, and the existing questionnaire workflow | Preserves conditional, ordered, grouped definition semantics and server validation. |
| Async lifecycle | An unbounded spinner or fire-and-forget browser state | Registry plus bounded polling component pattern | Provides observable terminal state, retry, safe failure, and server-owned state. |
| Authorization | Client role branching | FunctionAPI policy and record scope in Strapi | Navigation/action visibility cannot secure state-changing routes. |
| Proposal acceptance | Permissive JSON mapping | Closed provider proposal parser before persistence | Rejects malformed/unexpected generation output before it becomes persisted question data. |

## Common Pitfalls

1. **Completed job with an unpopulated relation.** A closed web boundary treats the response as a failure if a promised questionnaire relation is absent. Make controller/service projection tests assert the completed job returns populated questionnaire data. [VERIFIED: operator constraint]
2. **Hiding the generation action with the missing questionnaire.** The eligible state is exactly a submitted request, often before a questionnaire exists. Put the action on that review detail state, not behind the existing questionnaire link/empty presentation. [VERIFIED: operator constraint; `.planning/ROADMAP.md`]
3. **Replacing answered work.** “No answers” must be evaluated authoritatively from all persisted question answer envelopes inside the locked transaction; a stale initial relation read is insufficient. [VERIFIED: `.planning/ROADMAP.md`; `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`]
4. **Unvalidated provider output.** Never persist provider JSON directly. Reuse the strict-definition constraints and map parser violations to safe retryable job failure. [VERIFIED: `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts`; assessment provider parser pattern]
5. **Over-granting automation.** Do not inherit a new operation into `role.security_analyst_agent` by symmetry; generation remains deliberately human-initiated. [VERIFIED: operator constraint]
6. **Flaky browser path.** Before clicks near page bottoms, move the pointer away and wait for Sonner toasts to clear. For a client island reached by navigation, retry opening the confirmation/control rather than assuming its first click was hydrated. [VERIFIED: `apps/web/e2e/requestor-request-workflow.spec.ts`; operator constraint]

## Validation Architecture

| Layer | Required coverage |
|---|---|
| Strapi unit/service | Closed proposal parser rejects extra/malformed keys, invalid choice/visibility/order/key collisions; deterministic provider yields valid contextual definitions; registry lifecycle, TTL/cap, actor scope, retry, single-flight, and safe failures. |
| Strapi mounted workflow | Unauthorised/cross-record generation denied; non-submitted request denied; create succeeds; replacement needs acknowledgement and only succeeds before answers; answered questionnaire denied; transaction race/reload is conflict-safe; completed response includes populated questionnaire relation. |
| Contract/catalogue | The docs catalogue and bootstrap copy are byte-identical; all three routes/spec schemas exist; `pnpm --filter @csrm/web api:generate` is run; web typecheck verifies generated use. |
| Web service/actions/component | Generated operation parsing, safe form errors, revalidation, queued/running/completed/failed/retry/timed-out recovery, relation-based completed navigation, replacement confirmation, keyboard focus and polite status. |
| Browser | Analyst opens submitted request with no questionnaire, starts generation, sees lifecycle and generated questionnaire rendered through existing review path; covers refusal after Requestor answers, replacement confirmation before answers, denial for non-eligible state, toast clearing, mobile 375px, and client-island interaction retry. |

Run `pnpm --filter @csrm/strapi test`, `pnpm --filter @csrm/web test`, `pnpm --filter @csrm/web typecheck`, and the focused Playwright journey; retain an end-to-end full-suite gate. [VERIFIED: `apps/strapi/package.json`; `apps/web/package.json`]

## Security Domain

| Area | Control |
|---|---|
| Access control | Strapi FunctionAPI grant and record scope enforce generate, status read, and retry server-side. |
| State integrity | Recheck submitted/no-answers state under row lock and transaction before persistence. |
| Input validation | Reject non-empty/invalid generate bodies except the explicit replacement acknowledgement; validate provider output with a closed parser; return only safe failure messages. |
| Output safety | Persist plain data fields for the existing renderer; do not render provider text as HTML. |
| Privilege boundary | Browser action visibility is advisory; generated questionnaire remains a draft and cannot submit, generate an assessment, or release one. |

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The current development identity test harness can create a submitted request with no questionnaire for the browser tracer. | The plan may need a small fixture/harness extension, not a production schema change. |
| A2 | Questionnaire provenance can be represented by the registry/job response for this phase without new persistent questionnaire fields. | If durable provenance is a success-criterion interpretation, the frozen schema constraint requires an explicit documented exception or an already-supported persistence location. |

## Resolved Questions

1. **Bounded provenance location:** Provider name/version, initiating analyst, timestamps, attempt, and safe outcome are retained in the in-memory job record and exposed through the authorised actor-scoped status route for its terminal retention period. This bounded record is the phase's provenance location; the frozen questionnaire schemas remain unchanged. Durable questionnaire-level provenance remains a separately approved contract/data-model decision. [RESOLVED: bounded registry provenance decision]
2. **Replacement identity and numbering:** An explicitly acknowledged regeneration of an unanswered questionnaire updates that questionnaire in place. It preserves its `documentId`, `questionnaireNumber`, and request relation while atomically replacing only its question rows. First creation allocates `QGEN-<request.documentId>` and, only on a unique-number conflict, deterministic `-02` through `-99` suffixes. [RESOLVED: in-place regeneration identity/number rule]

## Sources

- `.planning/ROADMAP.md` — Phase 06.2 locked scope, success criteria, and lifecycle/replacement rules. [VERIFIED]
- `AGENTS.md` and `docs/CSRM-PROJECT-BRIEF.md` — engineering, security, UI, API, and test constraints. [VERIFIED]
- `docs/references/specification.json`, `docs/references/idambox-datamodel.jdl`, and both role/function catalogue copies — current API and terminology baseline. [VERIFIED]
- `apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts`, `assessment-draft-provider.ts`, `deterministic-assessment-draft-provider.ts`, and `assessment-workflow.ts` — required sibling pattern. [VERIFIED]
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts` and `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts` — definition and persistence contract. [VERIFIED]
- `apps/web/src/features/assessments/assessment-draft-job.tsx`, `assessment-detail.tsx`, and existing browser specs — UI/polling and reliable browser coverage pattern. [VERIFIED]

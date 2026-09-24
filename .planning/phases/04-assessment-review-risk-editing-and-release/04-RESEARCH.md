# Phase 4: Assessment Review, Risk Editing, and Release - Research

**Researched:** 2026-08-30  
**Domain:** Strapi-enforced assessment workflow, deterministic asynchronous draft generation, contextual risk editing, and authorised release  
**Confidence:** HIGH for codebase boundaries and persisted model; MEDIUM for the proposed no-schema release checklist and ephemeral job lifecycle

<user_constraints>
## User Constraints (from operator-supplied phase context)

### Locked Decisions

- Foundations already available and MUST NOT be replanned: triple-gated dev auth bridge (jane Requestor / bob Security Analyst), `csrm-authorization` + catalogue-grant patterns, `/v1` questionnaire routes, Phase 3 versioned JSON contract pattern, design composites, typed `openapi-fetch`, dual-server Playwright, dev seeds `RAR-DEV-QUES-001` + `QUES-DEV-001` and 2646 controls.
- Frozen in-scope entities: `csrm-assessment`, `csrm-risk`, `csrm-risk-type`, `csrm-control`, `csrm-control-implementation`; preserve Risk vs RiskType and Control vs ControlImplementation.
- Design/document without schema changes: release fact using existing `assessmentStatus`/`approvedBy`/timestamp convention with explicit analyst-only release, owner-only requestor read post-release, no prerelease visibility, irreversible requestor view and real dashboard projection.
- Use a deterministic server stub draft-job provider boundary and module registry with queued/running/completed/failed/retry states, deriving risks from questionnaire + seeded risk types, setting `generatedBy`, never releasing, and documenting provenance limits. A real provider remains Phase 8.
- Backend: full route auth, analyst mutations, owner-requestor released reads, `/v1` workflow verbs, server ASM/RSK Crockford IDs plus unique backstop, exact request/assessment transitions, post-release immutability, seeded risk types/applicable controls, and minimal permissions.
- Frontend: analyst queue/detail/questionnaire, polled job UI with bounded failure/timeout/skeletons, full project-brief section 8 assessment/risk/control editor, `ConfirmDialog` release, requestor released read-only view, and `RiskRatingBadge` with icon plus label.
- E2E journey: Bob -> draft -> edit rating/add control -> release -> Jane dashboard/detail read-only, plus prerelease, cross-owner, mutation, immutability, and determinism tests.
- Quality: Node `v24.19.0`, no test sentinels, branch `dylan-test`, never push, no AI attribution, catalogue copies byte-identical, and `api:check` green.

### the agent's Discretion

- Exact Phase 4 route hierarchy, bounded DTO property names, module/file boundaries, polling interval, registry retention, release-readiness validation details, and plan/wave decomposition, provided all locked outcomes above remain true.

### Deferred Ideas (OUT OF SCOPE)

- Production Keycloak and a real AI/provider integration remain Phase 8 work.
- New content types, fields, or schema migrations are out of scope.
- Organisation-level searchable Risk Register UX remains Phase 5, although Phase 4 creates the contextual Risks it will later consume.
- Administration CRUD/import UX for Risk Types and Controls remains Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| ASSESS-01 | A Security Analyst can view and review submitted requests authorised to them. | Reuse the analyst-wide assessment-request and submitted-questionnaire scopes; add the catalogue-declared analyst `/v1/assessment_requests` queue while retaining the existing hydrated request/questionnaire detail projections. [VERIFIED: `.planning/REQUIREMENTS.md`, catalogue, and codebase] |
| ASSESS-02 | A Security Analyst can trigger or observe a reviewable AI assessment-draft job with queued, running, completed, failed, and retry states. | Add a provider interface, deterministic development provider, bounded in-process registry, generate/status/retry verbs, polling UI, and injected failure tests. The provider persists only a draft assessment and draft risks and has no release capability. [VERIFIED: locked phase context; CITED: `docs/CSRM-PROJECT-BRIEF.md` section 19] |
| ASSESS-03 | A Security Analyst can edit assessment metadata, contextual risks, ratings, owners, treatments, target dates, and mitigation-control implementations. | Use existing `CsrmAssessment`, `CsrmRisk`, and `CsrmControlImplementation` fields and relations through allowlisted workflow services; seed reusable Risk Types with applicable existing Controls. [VERIFIED: JDL and Strapi schemas] |
| ASSESS-04 | A Security Analyst can explicitly release a completed assessment only after required review. | Define release as the atomic persisted invariant `approved` + `approvedBy` + `approvalDate`, reached only from reviewed `in-review` through `POST .../release`; set the owning request to `approved` and then deny all assessment-tree mutations. [VERIFIED: locked phase context and existing fields; readiness checklist details are ASSUMED] |
| ASSESS-05 | A Requestor can view an authorised released assessment read-only and cannot modify it. | Requestor list/detail queries require both the release invariant and `assessmentRequest.requestor.documentId === identity.documentId`; all requestor mutation grants remain absent and the dashboard consumes the real released list. [VERIFIED: locked phase context, AGENTS.md, and relation model] |
</phase_requirements>

## Summary

Phase 4 should be planned as one vertical workflow, not five disconnected CRUD screens. Strapi must own every transition and every record-level decision: an analyst starts a deterministic draft job from a submitted questionnaire; job completion atomically creates one draft `CsrmAssessment` and contextual `CsrmRisk` records; analyst edits move the request/assessment into review; explicit release stamps the only authoritative release fact; and only then may the owning Requestor read the immutable tree. [VERIFIED: project brief, locked phase context, and existing architecture]

The model already contains all business fields needed for the MVP editor and the relations needed to traverse Requestor -> AssessmentRequest -> Assessment -> Risk -> ControlImplementation -> Control. It does not contain a release boolean/date distinct from approval, a draft-job entity, provider/model metadata, or a human-edit audit history. The prescribed no-schema design therefore uses a composite release invariant and an ephemeral module registry, and must document that job state/provenance do not survive a Strapi restart while the created assessment and `generatedBy` relation do. [VERIFIED: JDL and schemas; registry limitation follows from the locked in-process design]

No new dependency is needed. The phase should extend the existing custom `/v1` route/controller/service/policy pattern, Phase 2 Crockford identifier generator, Phase 3 bounded OpenAPI DTOs and safe error envelopes, Zod-validated server-only web service/action boundary, shared composites, and the mounted Strapi plus dual-server Playwright test architecture. [VERIFIED: codebase and package manifests]

**Primary recommendation:** Plan contract/security tests first, then the persisted workflow and deterministic provider, then the typed UI, and finish by replacing the Requestor dashboard’s deliberate `contract-unavailable` projection with owner-scoped released data. [VERIFIED: current dashboard seam and locked acceptance journey]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Analyst request/questionnaire review | API / Backend | Browser / Client | Strapi owns catalogue grants and record scope; the UI presents the already-authorised DTO. [VERIFIED: AGENTS.md and current Phase 3 flow] |
| Draft-job lifecycle | API / Backend | Browser / Client | The provider and registry live in the Strapi process; the browser only triggers and polls bounded status DTOs. [VERIFIED: locked phase context] |
| Assessment/risk/control editing | API / Backend | Browser / Client | Server services own allowlists, parent traversal, transitions, and immutability; client forms provide validation and recovery. [VERIFIED: AGENTS.md and ASVS guidance] |
| Release | API / Backend | Database / Storage | The release route validates readiness and writes assessment/request facts transactionally; UI confirmation is not an authorization control. [VERIFIED: AGENTS.md; CITED: OWASP ASVS authorization guidance] |
| Requestor released view | API / Backend | Frontend Server (SSR) | Strapi checks release plus owner scope; Next Server Components call the typed service and render read-only content. [VERIFIED: locked context and current web architecture] |
| Identifier uniqueness | API / Backend | Database / Storage | Node creates random Crockford IDs; existing unique columns are the final backstop with bounded retry. [VERIFIED: Phase 2 `request-number.ts` and schemas] |

## Project Constraints (from AGENTS.md)

- Use Next.js App Router with strict TypeScript, prefer Server Components, use Client Components only for interaction, and keep business/domain logic out of JSX. [VERIFIED: `AGENTS.md`]
- Use shadcn/ui before custom primitives, semantic theme tokens only, no hard-coded BProton colours, and responsive accessible behavior at mobile and desktop widths. [VERIFIED: `AGENTS.md`]
- Call Strapi only through the typed API layer; do not add a frontend API facade or raw fetch calls in page/components. Validate external input with shared schemas. [VERIFIED: `AGENTS.md`]
- Strapi remains the production API and authorization boundary. Keycloak authenticates; Strapi enforces Role -> Function -> FunctionAPI plus record scope. Navigation visibility is never authorization. [VERIFIED: `AGENTS.md`]
- A Requestor may not access another Requestor's restricted records. AI output is advisory and cannot release an assessment. [VERIFIED: `AGENTS.md`]
- Preserve JDL terminology, especially Risk/RiskType and Control/ControlImplementation; document contract gaps instead of inventing competing entities. [VERIFIED: `AGENTS.md`]
- Add automated tests for each material workflow, introduce no dependency without a concrete reason, never commit secrets, never move `node_modules`, and do not merge the nested Strapi history. [VERIFIED: `AGENTS.md`]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard |
|---|---:|---|---|
| Node.js | 24.19.0 | Runtime and secure random bytes for Crockford IDs | Required by root engines and active in the environment. [VERIFIED: environment probe and root `package.json`] |
| Strapi | 5.51.0 | `/v1` routes, policies, document persistence, and transactions | Existing production API boundary. [VERIFIED: `apps/strapi/package.json`; CITED: https://docs.strapi.io/cms/backend-customization/controllers] |
| Next.js App Router | 16.3.3 | Server-rendered pages, loading/error boundaries, Server Actions | Locked web framework and installed official docs confirm Server Components are the App Router default. [VERIFIED: package and installed Next docs] |
| TypeScript | 5.9.3 web / existing Strapi TS toolchain | Closed DTOs, state machines, exhaustive presentation maps | Strict TypeScript is mandatory. [VERIFIED: package manifests and AGENTS.md] |
| openapi-fetch / openapi-typescript | 0.17.0 / 7.13.0 | Generated path types and server-only transport | Existing typed service boundary; `api:check` currently passes. [VERIFIED: package manifests and local test execution] |
| Zod | 4.4.3 | Validate action inputs and all external DTOs | Existing service/action convention. [VERIFIED: package and questionnaire/request features] |
| React Hook Form | 7.86.0 | Assessment and nested risk/control editor state | Already installed and used for material forms; no new form dependency is warranted. [VERIFIED: package and request forms] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| shadcn/Radix primitives | repository components / Radix Dialog 1.1.15 | Accessible forms, selects, dialogs, tabs/sections | Compose the analyst editor and existing `ConfirmDialog`; do not create new primitive systems. [VERIFIED: codebase and AGENTS.md] |
| Lucide React | 1.30.0 | Non-colour-only risk/status iconography | Use in `RiskRatingBadge` and job state presentation with textual labels. [VERIFIED: package and existing `StatusBadge`] |
| Vitest + Testing Library | 4.0.18 + 16.3.0 | Domain/service/component tests | Test release controls, editor state, polling boundaries, and requestor read-only rendering. [VERIFIED: package and current 98-test baseline] |
| Node test runner + mounted Strapi | Node 24.19.0 | Real policy/router/controller/database integration | Prove IDOR, transitions, rollback, immutability, permission exactness, and deterministic output. [VERIFIED: current 26-test backend baseline] |
| Playwright | 1.58.2 | Bob-to-Jane dual-server acceptance journey | Extend the existing isolated SQLite, single-worker harness. [VERIFIED: package and `playwright.config.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| In-process job registry | Persist a job content type or use an external queue | Persistence would improve restart recovery, but both choices violate the locked no-schema/no-new-infrastructure Phase 4 boundary. Keep a clean provider/registry interface so Phase 8 can replace it. [VERIFIED: locked phase context] |
| Composite release invariant | Add `releasedAt` / publication entity | A dedicated fact is clearer, but schema change is forbidden. Treat all three existing fields as one atomic invariant and prohibit separate approval verbs in this MVP. [VERIFIED: catalogue design note and locked context] |
| Existing stack | Add a polling/query-state dependency | The lifecycle is small and bounded; a focused Client Component with timer cleanup is sufficient and avoids an unjustified dependency. [VERIFIED: AGENTS.md dependency rule; implementation proportionality is a recommendation] |

**Installation:** none. No package manifest or lockfile should change. [VERIFIED: stack audit]

## Package Legitimacy Audit

No external package is proposed, so the package legitimacy gate does not apply. All libraries above are already locked in the repository. [VERIFIED: package manifests]

## Contract and Workflow Semantics

### Authoritative release fact

Define `isReleased(assessment)` as all of the following: `assessmentStatus === "approved"`, `approvedBy` is populated, and `approvalDate` is a valid server timestamp. Partial combinations fail closed and are not Requestor-visible. Only `POST /api/v1/risk_assessments/{assessmentId}/release` may set this triple, and it must set the owning request to `approved` in the same transaction. [VERIFIED: locked no-schema decision and existing fields; transaction pattern CITED: https://docs.strapi.io/cms/database-transactions]

Do not expose the catalogue's separate `submit_for_approval` or `approve` verbs during Phase 4. The current model cannot distinguish “approved but not released,” and Phase 2 explicitly established that approval alone must never be projected as release. [VERIFIED: catalogue design note and `.planning/STATE-ARCHIVE.md`]

### Exact transitions

| Event | Assessment request before -> after | Assessment before -> after | Required side effects |
|---|---|---|---|
| Questionnaire submitted | `submitted` or `questionnaire-in-progress` -> `questionnaire-in-progress` | none | Phase 3 already owns this transition. [VERIFIED: `questionnaire-workflow.ts`] |
| Draft job queued/running | `questionnaire-in-progress` -> unchanged | none | Registry only; no premature assessment/release fact. [VERIFIED: locked phase context] |
| Draft job completes | `questionnaire-in-progress` -> `risk-assessment-drafted` | none -> `draft` | In one transaction create ASM ID, assessment linked to request, deterministic RSK records linked to seeded Risk Types, `generatedDate`, and `generatedBy`; store resulting assessment ID on the completed job. [VERIFIED: available schema fields; transition is prescribed by locked context] |
| First accepted analyst edit | `risk-assessment-drafted` -> `under-review` | `draft` -> `in-review` | Set `reviewedBy` to acting analyst; later edits remain `under-review` / `in-review`. [ASSUMED: exact review-entry event is not specified by the brief or catalogue] |
| Explicit release | `under-review` -> `approved` | `in-review` -> `approved` | Validate readiness; set `assessmentDate`, `approvedBy`, `approvalDate` server-side atomically; make whole assessment tree immutable. [VERIFIED: locked outcome and fields; readiness details ASSUMED] |
| Closed | no Phase 4 transition | no Phase 4 transition | `closed` is not a synonym for release and remains out of this workflow. [VERIFIED: enums; lifecycle meaning is not specified, so no transition should be invented] |

Reject generation from a non-submitted questionnaire, from a request outside `questionnaire-in-progress`, or when that request already has an assessment/completed job. Reject editing outside `draft`/`in-review`, release outside `in-review`, and every assessment/risk/control-implementation mutation after release. [VERIFIED: locked workflow/security constraints; precise guards are prescriptive]

### Release-readiness checklist

The planner should make one pure `validateReleaseReadiness` function used by controller/service tests and the UI checklist. Require: assessment is `in-review`; `reviewedBy` is set; non-empty summary, overall rating, and overall risk rationale; at least one Risk; each Risk has statement, inherent/residual likelihood/consequence/rating, risk owner, treatment action, and target date; `Treat` additionally requires treatment plan, treatment owner, treatment resolve date, and at least one ControlImplementation referencing a reusable Control. [ASSUMED: the authoritative sources enumerate editable fields but do not define a minimum release checklist]

If product owners reject that checklist, they must resolve it before the release plan is executed; silently treating Strapi's sparse `required` flags as “review complete” would allow materially incomplete releases. [ASSUMED: planning risk derived from schema/brief mismatch]

### Identifier contract

Generalise the existing Phase 2 generator rather than copy it. Use `ASM-YYYY-XXXXXX` and `RSK-YYYY-XXXXXX`, where `YYYY` is UTC creation year and `X` uses `0123456789ABCDEFGHJKMNPQRSTVWXYZ`; source six random bytes through `node:crypto`, mask to five bits, retry at most five times only for a recognised unique conflict, and rely on the existing unique columns as the backstop. [VERIFIED: locked format direction, Phase 2 `request-number.ts`, and schemas]

### `/v1` operation surface

| Operation | Actor/scope | Phase 4 purpose |
|---|---|---|
| `GET /api/v1/assessment_requests` | explicit analyst, all | Review queue of submitted/in-progress/drafted/review requests; bounded pagination/filter/sort. Existing catalogue intent. [VERIFIED: catalogue] |
| `GET /api/csrm-assessment-requests/{id}` | existing exact grant; owner or analyst | Hydrated request detail reused by analyst. [VERIFIED: current served route] |
| `GET /api/v1/questionnaires/{questionnaireId}` and `/questions` | existing analyst grant | Submitted questionnaire review; Phase 3 projection masks drafts. [VERIFIED: current served routes] |
| `POST /api/v1/questionnaires/{questionnaireId}/generate_assessment` | explicit analyst, resource | Queue initial deterministic draft job; existing unserved catalogue intent. [VERIFIED: catalogue] |
| `GET /api/v1/assessment_draft_jobs/{jobId}` | explicit analyst, registry ownership/grant | Observe queued/running/completed/failed state. Add bounded OpenAPI/catalogue operation. [VERIFIED: locked job observability; path is recommended] |
| `POST /api/v1/assessment_draft_jobs/{jobId}/retry` | explicit analyst, failed only | Retry same job with incremented attempt. Add bounded OpenAPI/catalogue operation. [VERIFIED: locked retry outcome; path is recommended] |
| `GET /api/v1/risk_assessments` and `/status_summary` | explicit analyst | Analyst assessment queue and state counts. Existing catalogue intents. [VERIFIED: catalogue] |
| `GET/PATCH /api/v1/risk_assessments/{assessmentId}` | analyst; Requestor GET only after owner+release checks | Bounded assessment detail/edit DTO. [VERIFIED: catalogue and locked scope] |
| `GET/POST /api/v1/risk_assessments/{assessmentId}/risks` | GET owner+released or analyst; POST analyst mutable only | List/create contextual Risks. Existing catalogue intents. [VERIFIED: catalogue] |
| `PATCH /api/v1/risks/{riskId}` | explicit analyst, parent mutable | Edit contextual Risk; existing Risk Register intent can be served early for Phase 4. [VERIFIED: catalogue] |
| `GET/POST /api/v1/risks/{riskId}/control_implementations` | GET owner+released or analyst; POST analyst mutable only | List/add contextual mitigation Controls. [VERIFIED: catalogue] |
| `PATCH/DELETE /api/v1/control_implementations/{implementationId}` | explicit analyst, parent mutable | Edit/remove implementation before release. Existing catalogue intents. [VERIFIED: catalogue] |
| `GET /api/v1/risk_types`, `GET /api/v1/controls`, `GET /api/v1/users?search=` | explicit analyst; bounded projection | Risk Type, Control, and owner pickers. All are existing catalogue intents, but owner-directory exposure must be minimal. [VERIFIED: catalogue] |
| `POST /api/v1/risk_assessments/{assessmentId}/release` | explicit analyst, mutable+ready | Atomic irreversible release. Existing catalogue intent. [VERIFIED: catalogue and locked context] |
| `GET /api/v1/my_risk_assessments` and `/rating_summary` | implicit Requestor, own+released | Read-only inventory and dashboard projection. Existing catalogue intents. [VERIFIED: catalogue] |

Use named, closed OpenAPI DTOs rather than exposing generic Strapi documents or arbitrary `populate`. Keep shared safe 400/403/404/409 responses; generation should return `202` with a job projection, while polling returns `200`. Every served operation must have exactly the expected FunctionAPI grant set in each byte-identical catalogue and must be present in generated client paths; shared analyst/Requestor reads legitimately have one grant per role-facing Function. [VERIFIED: Phase 3 contract pattern; HTTP status recommendation follows asynchronous semantics]

## Architecture Patterns

### System Architecture Diagram

```text
Bob (analyst)
  -> Next Server Component (queue/detail data)
  -> small Client islands (editor, job polling, release dialog)
  -> Server Actions + Zod
  -> generated openapi-fetch transport
  -> Strapi /api/v1 route
  -> csrm-app-enabled -> csrm-authorization -> parent/resource scope
  -> workflow service + transaction
       |-> draft provider interface -> deterministic stub
       |-> in-process job registry (queued/running/completed/failed/retry)
       |-> CsrmAssessment -> CsrmRisk -> CsrmControlImplementation -> CsrmControl
       `-> CsrmAssessmentRequest status

Explicit release -> atomic approved + approvedBy + approvalDate + request approved
  -> Jane (owning Requestor only)
  -> /api/v1/my_risk_assessments -> real dashboard projection
  -> released detail DTO -> purpose-built read-only assessment view
```

This keeps provider code unable to invoke release and makes Strapi, not browser state, the trust boundary. [VERIFIED: locked architecture]

### Recommended Project Structure

```text
apps/strapi/src/api/csrm-assessment/
├── operations.ts
├── routes/csrm-assessment.ts
├── controllers/csrm-assessment.ts
└── services/
    ├── assessment-scope.ts
    ├── assessment-workflow.ts
    ├── assessment-number.ts
    ├── assessment-draft-provider.ts
    ├── deterministic-assessment-draft-provider.ts
    └── assessment-draft-registry.ts
apps/strapi/src/api/csrm-risk/{operations,routes,controllers,services}/
apps/strapi/src/api/csrm-control-implementation/{operations,routes,controllers,services}/
apps/strapi/src/bootstrap/seed-assessment-workflow.ts
apps/strapi/tests/{assessment-workflow.unit,assessment-workflow.integration,assessment-seed.integration}.test.ts

apps/web/src/features/assessments/
├── assessment-schema.ts
├── assessment-domain.ts
├── assessment-service.ts
├── assessment-actions.ts
├── assessment-list.tsx
├── assessment-detail.tsx
├── assessment-editor.tsx
├── risk-editor.tsx
├── control-implementation-editor.tsx
├── assessment-draft-job.tsx
└── released-assessment.tsx
apps/web/src/components/csrm/risk-rating-badge.tsx
apps/web/app/(app)/app/review/{requests,assessments}/...
apps/web/app/(app)/app/assessments/...
apps/web/e2e/assessment-release-workflow.spec.ts
docs/contract-gaps/phase-04-assessment-release-and-draft-jobs.md
```

File names may vary, but domain rules, transport, JSX, and provider/registry responsibilities must remain separated. [VERIFIED: AGENTS.md and existing feature patterns]

### Component Responsibilities

| Component/module | Responsibility | Must not do |
|---|---|---|
| `assessment-scope` | Build bounded analyst/requestor queries; traverse assessment -> request -> owner and risk/control -> assessment. [VERIFIED: existing scope pattern] | Trust a client owner filter or visibility control. |
| `assessment-workflow` | State machine, release invariant/readiness, transactions, writable-field allowlists, post-release guards. [VERIFIED: controller/service pattern] | Render DTOs or call an AI provider directly. |
| provider | Convert submitted questionnaire plus seeded Risk Types/applicable Controls to deterministic draft values. [VERIFIED: locked context] | Persist arbitrary data, release, read secrets, or execute retrieved text as instructions. |
| registry | Single-flight jobs, attempts, timestamps, safe error code/message, retention/eviction. [VERIFIED: locked context] | Become the authoritative release record or retain sensitive answers indefinitely. |
| controller | Parse IDs/bodies, delegate, sanitize/project named DTOs, map safe errors. [CITED: https://docs.strapi.io/cms/backend-customization/controllers] | Hold complex state-machine/business logic. |
| web service/actions | Zod-parse transport DTOs and normalize errors/revalidation. [VERIFIED: Phase 2/3 pattern] | Expose raw API payloads or arbitrary raw fetch. |
| editor Client Component | Interactive form state, accessible validation, save/release feedback. [VERIFIED: AGENTS.md] | Decide actor authority, workflow state, or release. |
| released view | Render a separate immutable presentation DTO. [CITED: project brief section 8] | Reuse editable controls in disabled mode as the security mechanism. |

### Pattern 1: Provider returns data, workflow persists

```typescript
// Source: locked Phase 4 boundary, adapted to the existing service pattern.
type DraftContext = {
  questionnaire: SubmittedQuestionnaire;
  riskTypes: readonly SeededRiskType[];
};

interface AssessmentDraftProvider {
  readonly name: string;
  generate(context: DraftContext): Promise<AssessmentDraftProposal>;
}
```

The proposal contains no `assessmentStatus`, `approvedBy`, `approvalDate`, request status, document IDs, or actor-controlled relations. The workflow service generates identifiers, supplies `generatedBy`, validates the proposal, and persists it transactionally. [VERIFIED: locked advisory-only requirement; allowlist is prescriptive]

### Pattern 2: Parent-aware immutable mutation

```typescript
// Source: existing questionnaire transaction/lock pattern and Phase 4 invariant.
await strapi.db.transaction(async () => {
  const aggregate = await loadAssessmentAggregateForUpdate(assessmentId);
  assertAnalystMutable(aggregate.assessment);
  const data = parseWritableRiskFields(input);
  await riskDocuments.update({ documentId: riskId, data });
});
```

Every Risk and ControlImplementation mutation must load and lock/recheck its ancestor Assessment. Checking only the child document or relying on a previous page load creates a release/edit race. [VERIFIED: Phase 3 concurrency pattern; threat is derived from the aggregate]

### Pattern 3: Bounded polling

Use a Client Component only for polling. Start at about one second, stop on `completed` or `failed`, stop and show timeout recovery after a fixed budget (recommend 30 seconds for the deterministic stub), clean up timers on unmount/job change, pause duplicate requests while one is in flight, and let the user manually retry a failed job. The server remains idempotent if the browser repeats a request. [ASSUMED: exact interval/timeout are UX recommendations; bounded/non-blocking behavior is locked]

### Anti-Patterns to Avoid

- **Generic core CRUD routes:** Existing Assessment/Risk/ControlImplementation routers currently expose core CRUD behind only `csrm-app-enabled`; replace them with exact `/v1` workflow routes plus `csrm-authorization`. [VERIFIED: current codebase]
- **Approval equals release by status alone:** Require the full triple and set it only through release. [VERIFIED: locked context and Phase 2 decision]
- **Provider owns persistence:** It would allow provider output to smuggle workflow fields or bypass human review. Return a bounded proposal instead. [VERIFIED: AGENTS.md]
- **Disabled editor as authorization:** Requestors need separate read-only DTO/UI and no mutation grant; disabled inputs are presentation only. [VERIFIED: project brief and AGENTS.md]
- **RiskType/Risk or Control/ControlImplementation conflation:** Store templates in RiskType/Control and assessment-specific context in Risk/ControlImplementation. [VERIFIED: JDL and catalogue design notes]
- **Infinite polling/spinner:** Bound time, failure, retry, and cleanup. [CITED: project brief sections 19 and 23]
- **Random deterministic-stub prose:** Semantic output must be stable for the same normalized questionnaire and risk-type seed; tests may normalize server IDs/timestamps only. [VERIFIED: locked determinism requirement]

## Deterministic Draft-Job Design

### Registry record

Use a closed record with `jobId`, `questionnaireId`, initiating analyst ID, provider name/version, status (`queued|running|completed|failed`), attempt, queued/started/completed timestamps, optional assessment ID, and a safe failure code/message. Retain no full answer payload in the registry; reload authoritative questionnaire data inside each attempt. [VERIFIED: locked lifecycle and project security requirement; exact fields are recommended]

The registry should enforce one active/completed job per questionnaire, reject cross-analyst arbitrary job lookup unless the caller has the same analyst FunctionAPI scope, cap entries (recommend 500) and evict terminal entries by TTL/LRU (recommend one hour), while never evicting queued/running entries. A process restart loses job state; if an assessment was committed, the one-to-one request relation prevents a duplicate and status discovery must return the existing assessment rather than regenerate. [ASSUMED: limits are proportional recommendations; uniqueness relation is VERIFIED by schema]

### Stub derivation

Seed a small, idempotent set of Risk Types such as Internet Exposure, Personal Information Handling, and Third-Party Dependency, each related to a small stable subset of the existing 2,646 Controls. Derive applicability from normalized Phase 3 `questionKey`/answer values (for example hosting model, personal-data flag/categories, and third-party providers), sort matched Risk Types and control numbers before producing proposals, and always emit the same statements/ratings/control suggestions for the same inputs. [ASSUMED: exact seed vocabulary/mapping requires product confirmation; use JDL entities and existing seed facts]

Job completion persists contextual Risks referencing those Risk Types but should not automatically persist all suggested controls unless the UX clearly presents them as draft suggestions. The locked browser journey explicitly adds a control manually, so the deterministic seed should leave at least one relevant applicable Control available in the picker. [ASSUMED: suggested-control persistence behavior is not fixed by authoritative sources]

### Provenance limits

Persisted provenance is limited to `generatedDate` and `generatedBy`; in this MVP `generatedBy` should identify the analyst who initiated the job because the relation targets `IdamBoxUser`. Provider name/version, attempts, safe failures, and timestamps exist only in the volatile registry; the model cannot persist model identifiers, prompt/retrieval sources, human field-level edits, or audit history. Document this under `docs/contract-gaps/` and do not imply stronger provenance in the UI. [VERIFIED: schemas and locked documentation requirement; `generatedBy` interpretation is ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Secure identifier entropy | `Math.random`, counters, row counts | Existing Node `randomBytes` Crockford pattern + unique constraint | Prevents predictable IDs and preserves bounded collision handling. [VERIFIED: Phase 2 pattern] |
| Transactions/locking | Ad hoc compensating updates | Strapi database transaction and existing query-builder lock pattern | Release and aggregate creation must not partially persist. [VERIFIED: Phase 3 code; CITED: Strapi transaction docs] |
| Authorization | Role-name checks in controllers/JSX | `csrm-authorization` exact FunctionAPI grants plus parent scope | Preserves birthright Requestor and explicit analyst rules. [VERIFIED: AGENTS.md and policy] |
| API client | Raw `fetch` or handwritten transport types | OpenAPI + generated `openapi-fetch` server transport | Keeps contract drift visible through `api:check`. [VERIFIED: Phase 1-3 pattern] |
| Dialog/focus behavior | Custom modal | Existing `ConfirmDialog`/shadcn AlertDialog | Existing component keeps failure feedback open and prevents duplicate confirm. [VERIFIED: component code/tests] |
| Rating/status communication | Colour-only pills | Exhaustive `RiskRatingBadge`/`StatusBadge` maps with icon+label | Required non-colour communication and compile-time coverage. [VERIFIED: locked context and current status pattern] |
| Full queue infrastructure | New Redis/BullMQ/worker stack | Locked provider interface + bounded in-process registry | Real provider/infrastructure is deferred; no dependency is justified. [VERIFIED: locked context] |

**Key insight:** the difficult part is not form rendering; it is enforcing aggregate ownership, state, immutability, and atomic release consistently through every route that can touch an Assessment descendant. [VERIFIED: relation model and security boundary]

## Common Pitfalls

### Pitfall 1: A released child remains editable

**What goes wrong:** The assessment PATCH is blocked, but direct Risk or ControlImplementation endpoints still mutate descendants.  
**Why it happens:** Each core controller validates only its own content type.  
**How to avoid:** Resolve the parent Assessment on every child mutation and lock/recheck it in the write transaction.  
**Warning signs:** Post-release tests cover only assessment PATCH, or generic Strapi CRUD remains mounted. [VERIFIED: current router inventory and aggregate model]

### Pitfall 2: Partial release facts leak data

**What goes wrong:** A failed multi-write leaves `approved` without actor/date, or a query filters only status and exposes it.  
**Why it happens:** Approval and release are represented by three fields without a dedicated release column.  
**How to avoid:** One transaction, one predicate, and tests for every partial combination.  
**Warning signs:** Multiple `isReleased` implementations or requestor filters containing only `assessmentStatus`. [VERIFIED: schema gap and locked design]

### Pitfall 3: Job retries duplicate assessments/risks

**What goes wrong:** Poll retries, browser double clicks, or process restart create a second aggregate.  
**Why it happens:** Registry idempotency is mistaken for database idempotency.  
**How to avoid:** Single-flight registry plus a transaction that reloads the request's one-to-one assessment relation before create; completed retries return the existing aggregate.  
**Warning signs:** Provider generates IDs or persistence occurs before the duplicate check. [VERIFIED: one-to-one schema; concurrency control is recommended]

### Pitfall 4: Stub output is called “AI provenance”

**What goes wrong:** UI suggests durable model/prompt/audit metadata that is not persisted.  
**Why it happens:** Volatile registry metadata is conflated with the Assessment record.  
**How to avoid:** Label output “deterministic draft assistance,” document persistence limits, and reserve provider integration claims for Phase 8.  
**Warning signs:** Model name in persisted DTO without a schema field or registry data shown after restart. [VERIFIED: locked provenance limitation]

### Pitfall 5: Owner picker widens IAM exposure

**What goes wrong:** A generic IdamBoxUser CRUD route exposes roles, external subjects, or private fields.  
**Why it happens:** The full brief requires owner selection, but Phase 2 intentionally deferred sponsor search.  
**How to avoid:** Serve the existing catalogue `GET /v1/users?search=` intent as an exact analyst grant returning only active `documentId` and display name (and email only if product-approved), with bounded query/page size.  
**Warning signs:** Core `/idambox-users` route is development-enabled or arbitrary populate is accepted. [VERIFIED: existing contract gap and schema; projection recommendation is ASSUMED]

### Pitfall 6: OpenAPI/catalogue drift

**What goes wrong:** A mounted verb is missing or duplicated in the catalogue/generated types.  
**Why it happens:** The phase touches several previously proposed but unserved catalogue operations.  
**How to avoid:** Contract-first operation inventory, exact expected-grant-set tests, authoritative docs catalogue edit followed by byte copy, and `api:check`.  
**Warning signs:** manual client casts or catalogue hashes differ. [VERIFIED: Phase 1/3 pattern]

### Pitfall 7: Loading and polling regress accessibility

**What goes wrong:** Screen readers receive repeated noisy updates, focus disappears after release, or skeletons replace stable context.  
**Why it happens:** Poll state is implemented as whole-page navigation/loading.  
**How to avoid:** Keep page context stable, announce only meaningful state changes through one polite live region, provide manual retry, respect reduced motion, and return focus through existing dialog behavior.  
**Warning signs:** one-second toast spam, indefinite spinner, or colour-only job/risk states. [CITED: project brief accessibility/loading requirements]

## Code Examples

### Composite release predicate

```typescript
// Source: locked no-schema release convention and existing CsrmAssessment fields.
export function isReleased(value: AssessmentReleaseFields): boolean {
  return value.assessmentStatus === 'approved'
    && value.approvedBy !== null
    && value.approvalDate !== null;
}
```

All server collection/detail projections, dashboard derivation, and mutation guards must import one equivalent domain rule rather than reimplementing it. [VERIFIED: architecture recommendation derived from locked invariant]

### Safe custom controller boundary

```typescript
// Source: https://docs.strapi.io/cms/backend-customization/controllers
const parsed = assessmentMutationSchema.safeParse(ctx.request.body);
if (!parsed.success) return safeError(ctx, 400, 'Assessment data is invalid.');
const result = await workflow.updateAssessment({ actor, assessmentId, data: parsed.data });
return { data: projectAssessment(result) };
```

Strapi's official controller guidance requires validation/sanitisation for custom actions and recommends moving complex reusable logic into services. [CITED: https://docs.strapi.io/cms/backend-customization/controllers]

### Exhaustive rating presentation

```typescript
// Source: existing `request-domain.ts` / `status-badge.tsx` pattern.
const RISK_RATING_PRESENTATION = {
  Low: { label: 'Low', icon: CircleCheckIcon },
  Moderate: { label: 'Moderate', icon: CircleAlertIcon },
  High: { label: 'High', icon: TriangleAlertIcon },
  Critical: { label: 'Critical', icon: OctagonAlertIcon },
} satisfies Record<RiskRating, RatingPresentation>;
```

The actual closed rating vocabulary is not defined by the JDL (rating fields are strings), so the Phase 4 OpenAPI/Zod contract must document the chosen values before this map is locked. [VERIFIED: schema; vocabulary is an open contract gap]

## State of the Art

| Old/current gap | Phase 4 approach | Impact |
|---|---|---|
| Generic Assessment/Risk/ControlImplementation core CRUD guarded only by app-enabled policy | Exact custom `/v1` routes with catalogue authorization and parent scope | Removes unscoped mutation/read exposure. [VERIFIED: current routes] |
| Requestor dashboard returns `contract-unavailable` for released assessments | Owner-scoped `/v1/my_risk_assessments` projection using the composite release fact | Completes the deferred real dashboard requirement. [VERIFIED: current dashboard and locked context] |
| Catalogue contains unserved Phase 4 intents | Serve only the exact operations needed for the MVP; add job status/retry operations and keep ambiguous approve verbs unserved | Makes route/OpenAPI/catalogue parity testable. [VERIFIED: catalogue and Phase 3 decision] |
| No assessment generation implementation | Provider-independent deterministic server stub with volatile registry | Validates UX/workflow before real Phase 8 integration. [CITED: project brief sections 19 and 30] |

**Deprecated/outdated:** Treating `assessmentStatus: approved` alone as release is explicitly invalid for this project. [VERIFIED: Phase 2 decision and locked Phase 4 convention]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The first accepted analyst edit is the event that moves draft -> in-review and request -> under-review. | Exact transitions | Product may require a separate “begin review” verb; plans would need a contract/UI adjustment. |
| A2 | **RESOLVED:** The stated release-readiness checklist is the Phase 4 definition of completed review: in-review + reviewedBy; non-empty assessment summary, overall rating, and overall risk rationale; at least one complete Risk; and the documented Treat-specific plan/owner/date/ControlImplementation requirements. | Release readiness | Locked for Phase 4 contract, backend, UI guidance, and tests; a later product change requires an explicit contract revision. |
| A3 | Registry limit 500, terminal TTL one hour, polling about one second, and UI timeout 30 seconds are proportionate defaults. | Job design/polling | Different operational expectations change memory and UX behavior but not the boundary. |
| A4 | **RESOLVED:** `generatedBy` identifies the initiating analyst because no persisted AI/service-principal provenance model exists; user-facing copy says “draft initiated by” and does not imply model identity. | Provenance | Locked for the Phase 4 deterministic provider; durable provider provenance remains Phase 8. |
| A5 | Seed Risk Type names/mapping and whether suggested Controls are persisted versus offered for manual selection. | Stub derivation | Deterministic expected output and E2E fixtures depend on this product choice. |
| A6 | The owner directory may expose active `documentId` + display name to analysts through the existing `/v1/users?search=` catalogue intent. | Owner picker | Privacy/authorization policy may require a narrower directory or fixed fixture-only owners. |
| A7 | **RESOLVED:** Risk ratings use the closed Phase 4 DTO vocabulary `Low|Moderate|High|Critical`; clients display but never calculate these values. | Badge/editor contract | Locked for OpenAPI, backend validation, Zod parsing, badge exhaustiveness, editor inputs, and release readiness. |

## Open Questions (RESOLVED)

1. **Required review — RESOLVED**
   - What we know: explicit analyst review and release are mandatory; section 8 lists the expected assessment/risk fields. [VERIFIED: brief and requirements]
   - What's unclear: the model marks very few editor fields required and the catalogue has no checklist definition. [VERIFIED: schemas/catalogue]
   - Selected answer: use the stated readiness checklist in this research artifact and encode it once in the backend domain contract; the UI mirrors it only as guidance while Strapi remains authoritative. [RESOLVED]

2. **`generatedBy` identity — RESOLVED**
   - What we know: the field relates only to IdamBoxUser and job provenance is otherwise not persisted. [VERIFIED: schema]
   - What's unclear: initiator versus seeded service identity. [VERIFIED: contract gap]
   - Selected answer: use the initiating analyst (Bob in the acceptance fixture) and label the fact “draft initiated by,” not “AI model.” [RESOLVED]

3. **Closed rating vocabulary — RESOLVED**
   - What we know: Risk/Assessment rating fields are unbounded strings, while UI needs an exhaustive icon+label badge. [VERIFIED: schemas and locked UI]
   - What's unclear: exact values and calculation policy. [VERIFIED: authoritative-source gap]
   - Selected answer: `Low`, `Moderate`, `High`, and `Critical`; define the vocabulary in the Phase 4 DTOs and never infer or compute ratings client-side. [RESOLVED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | all phase work | yes | 24.19.0 | none needed. [VERIFIED: environment probe] |
| pnpm | web/Turbo scripts | yes | 11.24.0 | none needed. [VERIFIED: environment probe] |
| npm | Strapi scripts | yes | 11.17.0 | none needed. [VERIFIED: environment probe] |
| SQLite / better-sqlite3 | mounted/E2E persistence | yes | better-sqlite3 12.8.0 | none needed. [VERIFIED: package and passing tests] |
| Existing 2,646-control seed | deterministic applicable-control data | yes | 12 source catalogues / 2,646 records | use a stable subset only. [VERIFIED: seed inventory and passing backend output] |
| External AI service | real generation | no / intentionally deferred | — | deterministic provider stub. [VERIFIED: locked scope] |

**Missing dependencies with no fallback:** none. [VERIFIED: audit]

**Missing dependencies with fallback:** real AI/provider infrastructure is intentionally replaced by the deterministic stub until Phase 8. [VERIFIED: locked scope]

Baseline on 2026-08-30: branch `dylan-test`; Strapi `npm test` passed 26 tests in about 50 seconds; web typecheck passed, Vitest passed 98 tests in 20 files, and `api:check` passed. [VERIFIED: local execution]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Backend framework | Node test runner with compiled TypeScript and mounted real Strapi/router/policy/controller using isolated SQLite. [VERIFIED: codebase] |
| Backend config | `apps/strapi/tests/tsconfig.json`, `apps/strapi/tests/helpers/strapi-http-harness.ts`, package `test` script. [VERIFIED: codebase] |
| Web framework | Vitest 4.0.18 + jsdom + Testing Library. [VERIFIED: package/config] |
| Browser framework | Playwright 1.58.2, Chromium, one worker, dual Strapi/Next dev servers, isolated SQLite. [VERIFIED: package/config] |
| Backend quick/full command | `npm test` in `apps/strapi` (current full baseline about 50 seconds because 2,646 controls are seeded). [VERIFIED: local execution] |
| Web quick command | `pnpm test -- src/features/assessments/<file>.test.ts[x]` in `apps/web`. [VERIFIED: Vitest CLI/current pattern] |
| Web full command | `pnpm typecheck && pnpm test && pnpm api:check` in `apps/web`; browser gate `pnpm test:e2e -- assessment-release-workflow.spec.ts`. [VERIFIED: scripts and established workflow] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| ASSESS-01 | Analyst sees submitted authorised queue/detail/questionnaire; Requestor/cross-owner cannot use analyst queue | mounted HTTP + web service/component + E2E | `npm test`; `pnpm test -- src/features/assessments/assessment-service.test.ts src/features/assessments/assessment-list.test.tsx` | No - Wave 0 |
| ASSESS-02 | queued/running/completed/failed/retry, single-flight, deterministic proposals, no release | unit + mounted HTTP + polling component + E2E success | `npm test`; `pnpm test -- src/features/assessments/assessment-draft-job.test.tsx` | No - Wave 0 |
| ASSESS-03 | allowlisted metadata/risk/owner/treatment/control edits persist only pre-release | unit + mounted aggregate integration + form/component + E2E | `npm test`; `pnpm test -- src/features/assessments/assessment-editor.test.tsx` | No - Wave 0 |
| ASSESS-04 | ready in-review release atomically stamps facts; incomplete/wrong actor/repeat/concurrent release denied | unit + mounted transaction/race + ConfirmDialog + E2E | `npm test`; `pnpm test -- src/features/assessments/assessment-release.test.tsx` | No - Wave 0 |
| ASSESS-05 | only owning Requestor sees released list/dashboard/detail; all prerelease/cross-owner/mutations denied | mounted IDOR + service/component + E2E Bob->Jane | `npm test`; `pnpm test -- src/features/assessments/released-assessment.test.tsx src/features/dashboard/requestor-dashboard.test.tsx`; `pnpm test:e2e -- assessment-release-workflow.spec.ts` | Dashboard test exists; Phase 4 cases/files are Wave 0 |

### Required Backend Cases

- Exact FunctionAPI grant on every mounted operation; no generic Assessment/Risk/ControlImplementation CRUD remains reachable; development permissions equal the exact Phase 4 served CSRM action set and contain no IAM action. [VERIFIED: established test pattern]
- Requestor list/detail requires both owner relation and complete release invariant; test other Requestor, analyst-named/no-grant identity, inactive identity, missing identity, and each partial release triple. [VERIFIED: existing identity harness and locked scope]
- Generate requires submitted immutable questionnaire and valid request state; concurrent/double POST creates one job/aggregate; provider output is identical for identical normalized inputs after removing IDs/timestamps. [VERIFIED: locked behavior]
- Provider cannot supply server-owned status/IDs/relations/release fields; injected provider failure persists no partial aggregate and exposes a safe failed job; retry completes once. [VERIFIED: advisory/atomic boundary]
- ASM/RSK format, UTC year, Crockford alphabet, unique-conflict recognition, five-attempt bound, and non-unique error propagation mirror Phase 2 tests. [VERIFIED: locked ID direction and existing pattern]
- First edit transitions exactly once to in-review/under-review and stamps `reviewedBy`; hostile bodies cannot alter assessment number/status/generated/review/approval facts or parent relations. [ASSUMED transition plus VERIFIED mass-assignment requirement]
- Risk and control implementation routes deny wrong parent IDs, forged relations, cross-resource access, invalid enum/date/rating values, and every mutation after release. [VERIFIED: security requirement]
- Release rejects missing checklist items, wrong state, wrong actor, partial aggregate, repeat/concurrent attempts, and injected second-write failure; successful release writes assessment/request facts atomically. [ASSUMED checklist plus VERIFIED atomic outcome]
- Seed is development-gated and idempotent, retains exactly 2,646 Controls, adds stable Risk Types/applicable-Control links, preserves `RAR-DEV-QUES-001`/`QUES-DEV-001`, and supports deterministic reruns. [VERIFIED: locked seed outcome]
- Both catalogue files remain byte-identical and every served URL has exactly its expected role-facing FunctionAPI grant set with reciprocal role/function links; OpenAPI paths and generated client paths match. [VERIFIED: established Phase 3 contract test]

### Required Web Cases

- Analyst list/detail render loading, empty, populated, error, and permission-denied states at 375px and 1440px without horizontal page overflow. [VERIFIED: brief and project pattern]
- Poller shows queued/running/completed/failed, prevents duplicate in-flight polls, stops on terminal/unmount/timeout, offers retry only when failed, and announces meaningful transitions without colour-only feedback. [VERIFIED: locked UI behavior; timing is ASSUMED]
- Editor maps every section 8 field that exists in the schemas, keeps logic outside JSX, preserves values/errors, supports add/edit contextual Risks plus add/edit/remove ControlImplementations, and distinguishes reusable definitions from contextual records. Risk removal is not a Phase 4 UI action because the authoritative served inventory intentionally has no Risk DELETE operation. [VERIFIED: brief, JDL, AGENTS.md, and closed Phase 4 route inventory]
- `RiskRatingBadge` has an icon, label, semantic token mapping, and exhaustive test for every contract value. [VERIFIED: locked UI behavior]
- Release uses `ConfirmDialog`, retains normalized failure inside the open dialog for retry, and removes all mutation affordances after success. [VERIFIED: existing component behavior and locked UI]
- Released Requestor presentation contains no form controls/actions; dashboard uses returned released count/items and links an encoded opaque document ID. [VERIFIED: brief and existing dashboard link pattern]

### Sampling Rate

- **Per task commit:** targeted Vitest for web-only work; full `apps/strapi npm test` for backend/catalogue/seed changes; `pnpm api:check` for any OpenAPI/generated change. [VERIFIED: current scripts/durations]
- **Per wave merge:** Strapi full suite; web typecheck + full Vitest + `api:check`. [VERIFIED: established workflow]
- **Phase gate:** all above plus the focused dual-server assessment release Playwright journey and catalogue byte comparison. [VERIFIED: locked quality gate]

### Wave 0 Gaps

- [ ] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with released/partial-release, assessment aggregate, risk type/control, second Requestor, job, injected provider/write-failure, and concurrency fixtures. [VERIFIED: current harness gap]
- [ ] Add `apps/strapi/tests/assessment-workflow.unit.test.ts`, `assessment-workflow.integration.test.ts`, and `assessment-seed.integration.test.ts`. [VERIFIED: files absent]
- [ ] Add generated-contract/catalogue tests for all Phase 4 paths and explicit exclusion of ambiguous/unserved approval routes. [VERIFIED: current contract gap]
- [ ] Add assessment service/action/domain/editor/job/released-view tests under `apps/web/src/features/assessments/`. [VERIFIED: feature absent]
- [ ] Expand `requestor-dashboard.test.tsx` from `contract-unavailable` to real owner-scoped release projections. [VERIFIED: current deliberate seam]
- [ ] Add `apps/web/e2e/assessment-release-workflow.spec.ts`; adapt the isolated database filename away from the Phase 3-specific `playwright-03-12-*` name without introducing a sentinel. [VERIFIED: current config]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | development bridge only | Reuse the triple environment gate and server-derived Jane/Bob identity; production OIDC remains Phase 8. [VERIFIED: locked foundation] |
| V3 Session Management | yes, existing development session | Reuse HTTP-only same-site session and server transport identity mapping; add no client credential. [VERIFIED: existing code] |
| V4 Access Control | yes, critical | Exact FunctionAPI grant plus owner/release/parent aggregate checks on every route; deny by default. [VERIFIED: AGENTS.md; CITED: OWASP ASVS authorization guidance] |
| V5 Input Validation | yes, critical | Closed Zod/OpenAPI DTOs, server writable-field allowlists, schema validation, bounded search/page sizes, and safe errors. [CITED: OWASP ASVS input validation; Strapi controller docs] |
| V6 Cryptography | identifier randomness only | Node `randomBytes`; do not implement cryptography. [VERIFIED: existing Phase 2 pattern] |

### Known Threat Patterns for Next.js + Strapi Assessment Workflow

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Requestor prerelease/cross-owner IDOR | Information disclosure | Owner + complete release predicate at Strapi collection and detail boundaries; hostile identifier tests. [VERIFIED: locked security requirement] |
| Forged workflow/release fields | Tampering / Elevation | Positive writable-field allowlists; server-owned IDs, actors, states, and timestamps. [CITED: OWASP ASVS input validation] |
| Child-route post-release edit | Tampering | Resolve and lock ancestor Assessment on every Risk/ControlImplementation write. [VERIFIED: aggregate design] |
| Provider prompt/content manipulation | Tampering / Elevation | Deterministic rules treat answers as data, provider returns bounded proposal, no tool/network/instruction execution. [CITED: project brief section 19] |
| Job enumeration/leak | Information disclosure | Opaque bounded ID, exact analyst grant, safe job DTO without answer payload/provider internals. [VERIFIED: security boundary; ID format is implementation discretion] |
| Double generate/release race | Tampering / Repudiation | Single-flight plus transaction/row lock/reload; unique relation/IDs; idempotent terminal response. [VERIFIED: Phase 3 concurrency pattern] |
| Sensitive data in logs/errors | Information disclosure | Safe error code/message, no questionnaire content/model prompt in logs, no stack trace to UI. [CITED: project brief security requirements] |
| Catalogue/dev permission overgrant | Elevation | Exact action allowlist, CSRM-only assertion, no IAM/core generic routes, byte parity tests. [VERIFIED: established pattern] |

## Recommended Planning Decomposition

1. Freeze RED contracts first: route/DTO inventory, release invariant/transition tests, deterministic job tests, aggregate immutability/IDOR tests, and the Bob-to-Jane Playwright acceptance skeleton. [VERIFIED: Nyquist and locked E2E requirement]
2. Update the authoritative OpenAPI and both byte-identical catalogues together; generate client types; mount no production route until exact-grant tests describe it. [VERIFIED: Phase 3 contract-first pattern]
3. Implement generalized ASM/RSK identifier helpers, assessment scope/state/release domain services, and parent-aware policy decisions. [VERIFIED: dependency order]
4. Implement provider interface, deterministic stub, registry, generation/status/retry controllers, atomic aggregate persistence, and development Risk Type/applicable-Control seed. [VERIFIED: locked backend outcome]
5. Implement exact analyst/read-only Requestor routes for assessment/risk/control/reference projections and release; remove generic unsafe routers and minimize dev permissions. [VERIFIED: current route gap]
6. Add server-only assessment services/actions/Zod DTO validation, then analyst request/assessment queues and questionnaire-to-job entry. [VERIFIED: existing web layering]
7. Build the full analyst editor and job UI as bounded Client islands within Server Component pages, then explicit release confirmation. [VERIFIED: AGENTS.md and brief]
8. Build the separate Requestor released list/detail and replace dashboard `contract-unavailable`; keep prerelease and cross-owner states deliberate. [VERIFIED: current seam]
9. Run aggregate security/concurrency/determinism suites, full contract/type/unit gates, and the dual-role Playwright journey; remove no tests and add no sentinels. [VERIFIED: locked quality constraints]

These steps should become multiple fine-grained plans/waves; do not put contract, all backend aggregates, the entire editor, and E2E closure into one plan. [VERIFIED: project granularity is `fine`; decomposition recommendation]

## Sources

### Primary (HIGH confidence)

- Repository `AGENTS.md`, planning requirements/roadmap/state, Phase 1-3 context/research/summaries/verifications, current Strapi/web implementation, package manifests, and locally executed test commands. [VERIFIED: codebase]
- `docs/CSRM-PROJECT-BRIEF.md`, especially sections 3-5, 8, 10, 15, 18-19, 22-24, and 29-30. [VERIFIED: authoritative project brief]
- `docs/references/specification.json` for current CRUD/questionnaire paths and generated contract baseline. [VERIFIED: authoritative API reference]
- `docs/references/idambox-datamodel.jdl` and the five frozen Strapi content-type schemas for terminology, fields, enums, and relations. [VERIFIED: authoritative data model and codebase]
- `docs/references/idambox-csrm-role-function-api-catalogue.json` plus runtime copy for proposed `/v1` operations and design-note gaps. [VERIFIED: authoritative catalogue]
- [Strapi controllers](https://docs.strapi.io/cms/backend-customization/controllers) - custom actions, service delegation, validation, and sanitization. [CITED: official docs]
- [Strapi routes](https://docs.strapi.io/cms/backend-customization/routes) and [policies](https://docs.strapi.io/cms/backend-customization/policies) - custom routing and policy configuration. [CITED: official docs]
- [Strapi Document Service](https://docs.strapi.io/cms/api/document-service) and [database transactions](https://docs.strapi.io/cms/database-transactions) - document IDs/relations and atomic multi-write workflow. [CITED: official docs]
- Installed official Next.js 16.3.3 docs under `apps/web/node_modules/next/dist/docs/01-app/` - App Router Server/Client boundaries, Server Actions, loading, and errors. [VERIFIED: installed official docs]
- [OWASP ASVS input validation](https://cornucopia.owasp.org/taxonomy/asvs-5.0/02-validation-and-business-logic/02-input-validation) and [OWASP ASVS index](https://cheatsheetseries.owasp.org/IndexASVS.html) - trusted-layer validation and authorization verification basis. [CITED: official OWASP sources]

### Secondary (MEDIUM confidence)

- None required; recommendations are derived from locked decisions and primary project/framework sources. [VERIFIED: research process]

### Tertiary (LOW confidence)

- None. Product decisions not present in authoritative sources are tagged `[ASSUMED]` and collected above. [VERIFIED: this document]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no package is added and all versions are installed and tested. [VERIFIED]
- Architecture: HIGH - it extends the tested Phase 2/3 service, policy, contract, and test boundaries. [VERIFIED]
- Persisted model/release invariant: HIGH for available fields and locked composite fact; MEDIUM for the minimum readiness checklist. [VERIFIED / ASSUMED]
- Draft registry/provider: MEDIUM - boundary and lifecycle are locked, but TTL, failure injection, `generatedBy`, and seed mapping need product confirmation. [VERIFIED / ASSUMED]
- Security pitfalls: HIGH - routes, relations, missing release field, and existing authorization patterns are directly observable. [VERIFIED]

**What might have been missed:** a formal product definition of rating vocabulary, release completeness, directory privacy, and durable provenance does not exist in the supplied authoritative references. These are explicitly surfaced rather than guessed. Production queue recovery, real provider/model safety, durable audit history, and Keycloak remain Phase 8 or require a future model change. [VERIFIED: source audit and locked scope]

**Research date:** 2026-08-30  
**Valid until:** 2026-09-06 for fast-moving framework/API details; internal model findings remain valid until the locked schemas or Phase 4 decisions change.

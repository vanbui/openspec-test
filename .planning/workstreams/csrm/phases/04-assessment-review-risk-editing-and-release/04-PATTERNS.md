# Phase 4: Assessment Review, Risk Editing, and Release - Pattern Map

**Mapped:** 2026-08-30  
**Files classified:** 52 likely new/modified files (grouped below where one pattern applies to a route/page family)  
**Analog families found:** 5 / 5  
**Locked source:** `04-RESEARCH.md` `<user_constraints>` (there is no `CONTEXT.md`)

## Locked Boundaries

- Keep the content-type schemas for `csrm-assessment`, `csrm-risk`, `csrm-risk-type`, `csrm-control`, and `csrm-control-implementation` unchanged. The existing fields and relations are the contract; preserve Risk versus RiskType and Control versus ControlImplementation.
- Release is one server-owned composite fact: `assessmentStatus === "approved"`, populated `approvedBy`, and a valid `approvalDate`, written atomically with owning request status `approved`. Partial triples fail closed. Do not serve separate Phase 4 `submit_for_approval` or `approve` verbs.
- Requestor reads require both the complete release fact and `assessmentRequest.requestor.documentId === identity.documentId`. Requestors receive no mutation grants. Every descendant mutation re-loads and locks/rechecks the ancestor Assessment.
- The deterministic provider returns a bounded proposal only. The workflow owns IDs, `generatedBy`, state, relations, transactions, and persistence. Provider/registry code has no release capability. Job state is volatile and full questionnaire answers are not retained in the registry.
- Preserve `RAR-DEV-QUES-001`, `QUES-DEV-001`, and exactly 2,646 Controls. Add only development-gated, idempotent Risk Type/applicable-Control data.
- Use Node `v24.19.0`, no new dependency, no test sentinels or escape hatches, and keep `docs/references/idambox-csrm-role-function-api-catalogue.json` byte-identical to `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `apps/strapi/src/api/csrm-assessment/operations.ts` | config | request-response | `apps/strapi/src/api/csrm-questionnaire/operations.ts` | exact |
| `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts` | route | request-response | `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts` | exact; replace core router |
| `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts` | controller | request-response | `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` | service | CRUD/query | `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts` | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` | service | CRUD/transactional | `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts` | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-number.ts` | utility | transform/CRUD | `apps/strapi/src/api/csrm-assessment-request/services/request-number.ts` | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts` | provider | transform | `questionnaire-workflow.ts` pure proposal/validation functions | role-match |
| `apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts` | provider | batch/transform | `seed-questionnaire-workflow.ts` stable question-key data | flow-match |
| `apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts` | store | event-driven | questionnaire per-document serialization map in `questionnaire-workflow.ts` | flow-match |
| `apps/strapi/src/api/csrm-risk/operations.ts` | config | request-response | questionnaire `operations.ts` | exact |
| `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` | route | request-response | questionnaire route file | exact; replace core router |
| `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | controller | request-response | questionnaire controller | exact |
| `apps/strapi/src/api/csrm-risk/services/risk-workflow.ts` (or assessment aggregate service) | service | CRUD/transactional | questionnaire workflow | exact |
| `apps/strapi/src/api/csrm-risk/services/risk-number.ts` | utility | transform/CRUD | request number service | exact |
| `apps/strapi/src/api/csrm-control-implementation/operations.ts` | config | request-response | questionnaire `operations.ts` | exact |
| `apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts` | route | request-response | questionnaire route file | exact; replace core router |
| `apps/strapi/src/api/csrm-control-implementation/controllers/csrm-control-implementation.ts` | controller | request-response | questionnaire controller | exact |
| `apps/strapi/src/api/csrm-control-implementation/services/control-implementation-workflow.ts` | service | CRUD/transactional | questionnaire workflow | exact |
| `apps/strapi/src/policies/csrm-authorization.ts` | policy | request-response | its questionnaire scope/ownership branches | exact extension |
| `apps/strapi/src/bootstrap/seed-assessment-workflow.ts` | config/seed | batch/CRUD | `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts` | exact |
| `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` | config/seed | batch/CRUD | existing exact-action permission reconciliation | exact extension |
| `apps/strapi/src/index.ts` | config | event-driven/bootstrap | existing questionnaire seed registration | exact extension |
| `apps/strapi/tests/assessment-workflow.unit.test.ts` | test | transform/state-machine | `questionnaire-workflow.unit.test.ts` | exact |
| `apps/strapi/tests/assessment-workflow.integration.test.ts` | test | request-response/CRUD | `questionnaire-workflow.integration.test.ts` | exact |
| `apps/strapi/tests/assessment-seed.integration.test.ts` | test | batch/CRUD | `questionnaire-seed.integration.test.ts` | exact |
| `apps/strapi/tests/contract-catalogue.integration.test.ts` | test | request-response/parity | its Phase 3 route inventory | exact extension |
| `apps/strapi/tests/helpers/strapi-http-harness.ts` | test utility | request-response/CRUD | existing request/questionnaire fixtures and failure injection | exact extension |
| `docs/references/specification.json` | config/contract | request-response | Phase 3 named questionnaire DTOs/responses | exact extension |
| `docs/references/idambox-csrm-role-function-api-catalogue.json` | config/auth | request-response | Phase 3 exact FunctionAPI entries | exact extension |
| `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | config/auth | request-response | authoritative catalogue byte copy | exact |
| `apps/web/src/lib/api/generated/schema.d.ts` | generated config | request-response | Phase 3 generated questionnaire paths | exact regeneration |
| `docs/contract-gaps/phase-04-assessment-release-and-draft-jobs.md` | documentation | transform | `docs/contract-gaps/phase-03-questionnaire-json-contract.md` | exact |
| `apps/web/src/features/assessments/assessment-schema.ts` | model/validation | transform | `questionnaire-schema.ts` | exact |
| `apps/web/src/features/assessments/assessment-domain.ts` | model/utility | transform | `request-domain.ts` | exact |
| `apps/web/src/features/assessments/assessment-service.ts` | service | request-response | `questionnaire-service.ts` | exact |
| `apps/web/src/features/assessments/assessment-actions.ts` | server action | request-response | `questionnaire-actions.ts` | exact |
| `apps/web/src/features/assessments/assessment-list.tsx` | component | request-response | `questionnaire-review-list.tsx` | exact |
| `apps/web/src/features/assessments/assessment-detail.tsx` | component | request-response | `questionnaire-review.tsx` | exact |
| `apps/web/src/features/assessments/assessment-editor.tsx` | component | CRUD | `request-form.tsx` / questionnaire renderer | role-match |
| `apps/web/src/features/assessments/risk-editor.tsx` | component | CRUD | `request-form.tsx` | role-match |
| `apps/web/src/features/assessments/control-implementation-editor.tsx` | component | CRUD | `request-form.tsx` | role-match |
| `apps/web/src/features/assessments/assessment-draft-job.tsx` | component | event-driven/polling | no complete analog; use bounded client-island conventions | partial |
| `apps/web/src/features/assessments/released-assessment.tsx` | component | request-response | `questionnaire-review.tsx` read-only projection | exact |
| `apps/web/src/components/csrm/risk-rating-badge.tsx` | component | transform | dashboard exhaustive presentation map / `status-badge.tsx` | exact |
| `apps/web/app/(app)/app/review/requests/page.tsx` and `[documentId]/page.tsx` | page | request-response | review questionnaire App Router pages | exact; wrap async children in explicit Suspense skeletons |
| `apps/web/app/(app)/app/review/assessments/page.tsx` and `[documentId]/page.tsx` | page | request-response | review questionnaire App Router pages | exact; wrap async children in explicit Suspense skeletons |
| `apps/web/app/(app)/app/assessments/{page,loading,error}.tsx` and `[documentId]/...` | page | request-response | requestor questionnaire pages | exact |
| `apps/web/src/features/dashboard/requestor-dashboard-service.ts` | service/projection | request-response/transform | current dashboard service seam | exact modification |
| `apps/web/src/features/dashboard/requestor-dashboard.tsx` | component | request-response | current released widget seam | exact modification |
| assessment feature tests plus `requestor-dashboard.test.tsx` | test | transform/request-response | Phase 2/3 service/action/component tests | exact |
| `apps/web/e2e/assessment-release-workflow.spec.ts` | test | request-response/E2E | `questionnaire-workflow.spec.ts` | exact |

Do **not** schedule changes to any frozen `content-types/**/schema.json`. Existing schema facts are sufficient: Assessment fields/relations are at `csrm-assessment/schema.json:15-90`, Risk at `csrm-risk/schema.json:15-173`, and ControlImplementation at `csrm-control-implementation/schema.json:15-63`.

## Pattern Assignments

### 1. `/v1` operations, routes, controllers, scope, and workflow

**Apply to:** all Assessment, Risk, ControlImplementation, analyst request queue, reference picker, released-read, job, and release endpoints.  
**Primary analogs:** questionnaire operations/routes/controller/workflow.

Centralize canonical grant strings (`questionnaire/operations.ts:1-8`):

```typescript
export const CSRM_QUESTIONNAIRE_OPERATIONS = {
  listMine: "GET:/api/v1/my_questionnaires",
  listAll: "GET:/api/v1/questionnaires",
  findOne: "GET:/api/v1/questionnaires/{questionnaireId}",
} as const;
```

Copy the two-policy route shape and choose collection versus resource scope (`questionnaire/routes/csrm-questionnaire.ts:5-16`, `18-20`, `40-67`):

```typescript
const policies = (operation: string, scope: "collection" | "resource") => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: {
      operation,
      ...(scope === "collection"
        ? { requireQuestionnaireCollectionScope: true }
        : { requireQuestionnaireOwnership: true }),
    },
  },
];
```

Phase 4 should introduce equivalent assessment aggregate scope flags (and parent lookup for Risk/ControlImplementation), not controller role-name checks. The policy already resolves active identities, implicit Requestor grants, and explicit analyst grants (`csrm-authorization.ts:75-98`, `129-150`). Its questionnaire ownership branch demonstrates record traversal (`166-178`):

```typescript
const questionnaire = await ...findOne({
  documentId,
  populate: { assessmentRequest: { populate: { requestor: true } } },
});
if (questionnaire?.assessmentRequest?.requestor?.documentId !== identity.documentId) {
  return deny(policyContext, "CSRM questionnaire access is denied.");
}
```

Copy the controller boundary: parse path/body, delegate, return named projections, and normalize only safe domain errors (`questionnaire/controllers/csrm-questionnaire.ts:72-89`, `132-148`):

```typescript
function safeError(ctx, status: 400 | 403 | 404 | 409, message: string) {
  // choose badRequest/forbidden/notFound/conflict; fallback to closed envelope
  ctx.status = status;
  return { data: null, error: { status, message } };
}

const result = await mutation({
  strapi,
  questionnaireDocumentId: documentId,
  actor: questionnaireActor(ctx.state),
  body: request.body,
});
return { data: projectMutation(result) };
```

Keep state, allowlists, readiness, release predicate, and persistence out of controllers. Use closed payloads like `parseAnswerMutationPayload` (`questionnaire-workflow.ts:31-50`): reject unknown keys, duplicate keys, oversized arrays, invalid enums/dates/ratings, and client-supplied server-owned fields.

For aggregate writes, copy the serialized transaction + row lock + reload pattern (`questionnaire-workflow.ts:172-205`):

```typescript
return serializeQuestionnaireMutation(input.questionnaireDocumentId, () =>
  input.strapi.db.transaction(async ({ trx }) => {
    await lockQuestionnaire(input.strapi, input.questionnaireDocumentId, trx);
    return work();
  }));
```

Within every assessment/risk/control mutation transaction: lock Assessment, reload the aggregate, reject a complete or partial release state, select an allowlisted body, then write. Release must validate `in-review` readiness and atomically update Assessment plus owning request. Inject the transaction/write boundary so rollback and race behavior can be mounted-tested.

Replace—not extend—the generic core routers currently mounted at:

- `csrm-assessment/routes/csrm-assessment.ts:3-10`
- `csrm-risk/routes/csrm-risk.ts:3-10`
- `csrm-control-implementation/routes/csrm-control-implementation.ts:3-10`

Those routes presently guard generic CRUD only with `csrm-app-enabled`; Phase 4 tests must prove they are no longer reachable.

### 2. Crockford IDs, deterministic proposals, registry, and seeding

**Apply to:** `assessment-number.ts`, `risk-number.ts`, provider/registry files, seed file, and their unit/integration tests.  
**Primary analogs:** Phase 2 request-number service and Phase 3 seed.

Generalize the existing generator (`request-number.ts:1-18`) rather than duplicating it:

```typescript
import { randomBytes } from "node:crypto";
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const bytes = randomBytes(6);
for (const byte of bytes) random += CROCKFORD_BASE32[byte & 31];
return `RAR-${year}-${random}`;
```

Use the same five-attempt, unique-conflict-only retry (`request-number.ts:38-49`) for `ASM-YYYY-XXXXXX` and `RSK-YYYY-XXXXXX`. Non-unique failures propagate immediately; the unique database columns remain the backstop.

Define the provider as a pure boundary:

```typescript
interface AssessmentDraftProvider {
  readonly name: string;
  generate(context: DraftContext): Promise<AssessmentDraftProposal>;
}
```

The proposal excludes IDs, persisted relations, request/assessment states, reviewer/approver fields, and all release facts. Normalize questionnaire answers and sort matched Risk Types/control numbers before proposal generation so semantic output is stable after tests remove only IDs/timestamps.

The registry should mirror the per-document map's single-flight discipline (`questionnaire-workflow.ts:172-186`) but expose a closed record with `queued|running|completed|failed`, attempt/timestamps, initiating analyst, provider name/version, optional assessment ID, and safe failure. Add retry as an event, not a fifth persisted status. Bound retention (research recommendation: 500 terminal entries, one-hour TTL/LRU), never evict active entries, and never retain full answers.

Copy the seed gate and idempotent reconciliation (`seed-questionnaire-workflow.ts:122-163`, `165-188`):

```typescript
if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) return;
const [existing] = await service.findMany({ filters: { ... }, limit: 1 });
const record = existing
  ? await service.update({ documentId: existing.documentId, data })
  : await service.create({ data });
```

Seed a small stable Risk Type set and applicable links to existing Controls. Never recreate/delete the 2,646-control library, and preserve the Phase 3 request/questionnaire fixture IDs.

### 3. Catalogue, OpenAPI, generated client, and parity tests

**Apply to:** both catalogue copies, `specification.json`, generated `schema.d.ts`, contract gap doc, contract test, and development permissions.  
**Primary analog:** `contract-catalogue.integration.test.ts` Phase 3 inventory.

Build one `phase4ServedRoutes` inventory with method, path, operationId, and exact role-facing grant set, following lines `60-115`. For every route, copy the parity assertions at `117-182`:

```typescript
const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
assert.deepEqual(
  exactApis.map((entry) => entry.functionId).sort(),
  expectedGrants.map(([, functionId]) => functionId).sort(),
);
assert.equal(openApiOperation.operationId, route.operationId);
assert.ok(generatedSchema.includes(`"${route.path}": {`));
assert.ok(generatedSchema.includes(`${route.method}: operations["${route.operationId}"];`));
```

Retain the byte comparison at `contract-catalogue.integration.test.ts:118-131`. Assert named closed request/response schemas and `additionalProperties: false`, as Phase 3 does at `184-205`. Add safe 400/403/404/409 responses, plus `202` for generate and `200` for poll. Assert generic CRUD absence and that development permissions contain exactly the served CSRM actions and no IAM actions.

Catalogue operations already establish the intended grants and semantics:

- requestor released inventory/detail: catalogue lines `1075-1129`
- analyst request queue: `1133-1161`
- generation intent: `1229-1243`
- assessment queue/detail/edit/risk/release: `1246-1371`
- risk/control implementation verbs: `1434-1467`, `1524+`

The catalogue's separate `submit_for_approval` and `approve` entries (`1341-1360`) stay unserved. Add bounded job status/retry FunctionAPIs, then copy the authoritative catalogue bytes to bootstrap. Do not hand-edit generated TypeScript; regenerate and require `api:check` green.

The current OpenAPI exposes generic Strapi documents. Phase 4 `/v1` DTOs must be named, bounded projections. The frozen document schemas confirm all required persisted fields exist; they do not authorize exposing generic populate or accepting those shapes as mutation bodies.

### 4. Typed web service/actions and App Router pages

**Apply to:** assessment schema/domain/service/actions, queue/detail pages, loaders/errors, and dashboard projection.  
**Primary analogs:** questionnaire schema/service/actions and review page.

Validate every external DTO with strict Zod schemas (`questionnaire-schema.ts:16-42`, `63-79`). Use discriminated unions for job states and separate analyst editable DTOs from Requestor released DTOs. Define a closed rating vocabulary in contract/Zod before implementing the exhaustive badge; do not calculate ratings in JSX.

Copy the server-only transport wrapper (`questionnaire-service.ts:1-15`, `96-112`):

```typescript
import 'server-only';
async function read<T>(request, parse): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await request(client);
    if (error || !data) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}
```

Call only generated `client.GET/PATCH/POST/DELETE` paths (`questionnaire-service.ts:185-235`), parse path IDs with bounded schemas, parse all payloads, and expose domain results rather than raw Strapi documents.

Copy the Server Action shape (`questionnaire-actions.ts:1-18`, `25-32`, `62-105`): `safeParse` unknown input, preserve submitted values/errors, normalize status-specific messages, call the typed service, then revalidate dashboard/list/detail paths. Release failures must remain inside the open confirmation dialog for retry.

Use Server Components for list/detail reads. The review page pattern (`review/questionnaires/[documentId]/page.tsx:10-26`) resolves async params, maps 404 to `notFound`, distinguishes 403/error/empty/state, and passes authorized data to presentation. For Phase 4 analyst request and assessment list/detail reads, keep the route shell synchronous and wrap the async service-reading child in React `Suspense` with concrete responsive list/detail/editor skeleton components; test the fallback before a deferred service promise resolves. Limit Client Components to editor interaction, polling, and confirmation.

Replace the explicit dashboard seam in `requestor-dashboard-service.ts:34-43`, `94-100`, and add released service calls to the existing `Promise.all` at `104-136`. Build links with `encodeURIComponent` as at `52-77`. Replace the unavailable widget at `requestor-dashboard.tsx:142-169` with real owner-scoped released count/items; the UI must not reinterpret `approved` as released.

### 5. Components, read-only presentation, polling, and browser acceptance

**Apply to:** editor suite, draft-job poller, released view, `RiskRatingBadge`, component tests, and Playwright.  
**Primary analogs:** `questionnaire-review.tsx`, `ConfirmDialog`, dashboard presentation map, and Phase 3 E2E.

Use a purpose-built read-only component rather than disabled editor controls. The questionnaire review analog separates safe states and read-only content (`questionnaire-review.tsx:12-40`, `42-51`). Render assessment metadata, context, risks, ratings, owners, treatments, dates, and mitigation controls with no form controls or mutation actions for Requestors.

Use the existing confirmation primitive unchanged (`confirm-dialog.tsx:31-60`, `63-87`). It prevents duplicate submits, stays open when `onConfirm` throws, renders normalized error feedback with `role="alert"`, and applies reduced-motion behavior to the pending icon.

Copy the exhaustive icon+label presentation technique from `requestor-dashboard.tsx:23-45`:

```typescript
const presentations = {
  // each closed contract value -> semantic-token className, icon, label
} satisfies Record<RiskRating, RatingPresentation>;
```

`RiskRatingBadge` must use semantic tokens, a Lucide icon, and visible label; tests cover every rating value. Keep release readiness and editing logic in domain modules, not JSX.

The poller is the one new client pattern without a complete analog: poll about once per second, allow only one in-flight poll, stop on completed/failed/unmount/job change, stop with recoverable timeout after a fixed budget (research recommendation: 30 seconds), offer retry only for failed jobs, and announce meaningful transitions through one polite live region. No whole-page refresh loop or indefinite spinner.

Extend the dual-role Playwright structure from `questionnaire-workflow.spec.ts`:

- health check and explicit fixture failures (`48-54`)
- 375px/reduced-motion and overflow checks (`56-60`)
- real Requestor/Analyst sign-in with cookie clearing (`31-46`, `147-149`)
- desktop transition and no serious/critical Axe violations (`144-160`)
- anonymous/pre-release secrecy (`84-87`, `162-167`)

Phase 4 journey: Bob reviews request/questionnaire -> queues and polls deterministic draft -> edits rating -> adds a ControlImplementation referring to a reusable Control -> releases through ConfirmDialog -> switches to Jane -> dashboard count/item and released detail are real and read-only. Add API/mounted coverage for prerelease, cross-owner, missing/inactive identity, partial release triples, hostile bodies, direct child mutation, post-release immutability, duplicate generation, deterministic output, injected provider/write failures, retry, and concurrent release.

## Shared Patterns

### Authorization and record scope

**Source:** `apps/strapi/src/policies/csrm-authorization.ts:63-98`, `129-178`  
**Apply to:** every served route.

- Match exact FunctionAPI URL strings.
- Requestor is implicit birthright; analyst requires an explicit active assignment.
- Put resolved actor/scope into `ctx.state.csrmAuthorization`; services consume it.
- Parent traversal is mandatory for Assessment descendants; browser visibility is never authority.

### Error handling

**Source:** questionnaire controller `72-83`, `109-112`, `132-148`; web service `96-112`; actions `62-75`.

- Backend returns safe 400/403/404/409 envelopes and never exposes stack/provider/database details.
- Web normalizes transport errors once and renders stable permission/not-found/conflict/unavailable messages.
- Forms retain values and field/form errors. Job failures expose only a safe code/message and remain retryable.

### Validation and mass-assignment resistance

**Source:** `questionnaire-workflow.ts:31-50`; `request-workflow.ts:3-17`, `33-53`; `questionnaire-schema.ts` strict schemas.

- Explicit writable allowlists for Assessment, Risk, and ControlImplementation.
- Server owns ASM/RSK IDs, state, release/reviewer/generator facts, parent relations, and timestamps.
- Provider proposals and browser bodies are both untrusted external input.

### Transactions and immutability

**Source:** `questionnaire-workflow.ts:172-205`, `265-299`.

- Serialize per aggregate in-process and use a database transaction/row lock.
- Reload state after lock; do not rely on page or policy-time state.
- One release predicate is imported by scope queries, DTO projection, readiness, dashboard, and mutation guards.

### Responsive/accessibility states

**Source:** `questionnaire-review.tsx`, dashboard components, Phase 3 Playwright.

- Every major screen: loading, empty, populated, error, permission denied.
- Mobile and desktop, no horizontal page overflow, useful skeletons, semantic theme tokens.
- Status/rating never color-only; dialogs, errors, live updates, focus, and reduced motion remain accessible.

## No Exact Analog

| File/Concern | Reason | Planner Direction |
|---|---|---|
| `assessment-draft-registry.ts` | No existing job registry | Adapt questionnaire single-flight map; use closed volatile records, bounds, TTL/LRU, no answer retention |
| `assessment-draft-job.tsx` | No existing polling component | Implement one bounded Client island with cleanup, terminal stop, timeout, one in-flight request, manual retry |
| composite release/readiness functions | No current release fact exists | Implement once in backend domain service; mirror readiness for UI guidance but trust server only |

## Planner Guardrails

1. Contract/security tests first: route inventory, closed DTOs, exact grants, byte parity, generated paths, generic CRUD absence.
2. Pure domain next: release predicate/readiness, transitions, allowlists, ASM/RSK generator, deterministic provider, registry.
3. Persisted workflow: parent scope, transactions, generation, mutations, release, released reads, seed.
4. Typed web boundary and Server Components before client editor/poller islands.
5. Dashboard replacement and Bob-to-Jane E2E last, followed by full mounted/Vitest/typecheck/`api:check`/Playwright gates.

Do not plan production Keycloak/provider work, schema migrations, organisation Risk Register UX, or administration CRUD/import UX in Phase 4.

## Metadata

**Analog search scope:** `apps/strapi/src`, `apps/strapi/tests`, `apps/web/app`, `apps/web/src`, `apps/web/e2e`, authoritative docs and Phase 4 planning artifacts  
**Strong analog families:** Phase 3 questionnaire backend; Phase 2 request ID/workflow; Phase 3 contract/catalogue/seed; Phase 3 typed web/App Router; Phase 3 dual-role E2E/components  
**Pattern extraction date:** 2026-08-30

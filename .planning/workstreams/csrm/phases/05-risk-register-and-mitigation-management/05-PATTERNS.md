# Phase 5: Risk Register and Mitigation Management - Pattern Map

**Mapped:** 2026-08-31  
**Inputs:** `05-RESEARCH.md`, `05-UI-SPEC.md`, `05-VALIDATION.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `AGENTS.md`  
**Scope:** 31 new/modified files or file groups; 30 have implemented analogs; one deliberately new query-ordering boundary has no exact analog.

## Locked Boundaries

- Keep Strapi as the API boundary. Pages and arbitrary components do not call `fetch`; server-only services use the generated `openapi-fetch` client.
- Both new reads are analyst-only and use content API token authentication, then `global::csrm-app-enabled`, then `global::csrm-authorization`, with the exact catalogue operations already present for `GET /api/v1/risks` and `GET /api/v1/risks/{riskId}`.
- Add an explicit analyst Risk-register scope to policy state and assert it inside list/detail services. Requestor navigation absence is not authorization; Requestors must receive safe denial with no count or record-existence clues.
- Do not change any content-type schema and do not add dependencies. `CsrmRisk.treatmentStatus` is the Risk status dimension; do not invent `riskStatus`.
- Preserve existing Risk and ControlImplementation mutation routes and the serialized parent-Assessment lock. Released means the complete approved + approvedBy + approvalDate fact; partial release facts fail closed.
- The two catalogue JSON files already contain the read grants. They should remain byte-identical and normally require no edit. If contract work proves a change is unavoidable, copy identical bytes and retain the byte-comparison test.
- Generate `apps/web/src/lib/api/generated/schema.d.ts` from `docs/references/specification.json`; never hand-edit it.
- Keep the isolated Playwright servers on ports 1338 and 3100. Do not copy the stale `1337` health constant from the Phase 4 spec.

## File Classification

| New/Modified File or Responsibility | Role | Data Flow | Closest Implemented Analog | Match |
|---|---|---|---|---|
| `apps/strapi/src/api/csrm-risk/operations.ts` | config/constants | request-response | same file, existing Phase 4 mutation/read constants | exact extension |
| `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` | route | request-response | same file lines 5-41 | exact extension |
| `apps/strapi/src/policies/csrm-authorization.ts` | middleware/policy | request-response | analyst request collection scope, lines 11-18 and 155-176 | exact role match |
| `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | controller | request-response | `csrm-assessment-request/controllers/csrm-assessment-request.ts` lines 33-68 | exact flow match |
| `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` | utility/query service | transform + CRUD query | `csrm-assessment-request/services/collection-scope.ts` lines 120-214 | exact role/flow |
| `apps/strapi/src/api/csrm-risk/services/risk-register.ts` | service/projection | CRUD + request-response | `assessment-scope.ts` lines 145-243 and request controller lines 39-64 | strong composite |
| semantic rating/null-last page selector inside the Risk-register service | repository/query utility | CRUD query + transform | no exact Phase 3-4 analog | new bounded pattern |
| `apps/strapi/src/api/csrm-risk/services/risk-workflow.ts` | service | transactional CRUD | same file lines 192-224 plus `assessment-workflow.ts` lines 245-292 | exact reuse/minimal extension |
| `apps/strapi/src/bootstrap/seed-risk-register-workflow.ts` and bootstrap invocation | seed/config | batch CRUD | `seed-assessment-workflow.ts`; `assessment-seed.integration.test.ts` lines 99-145 | role/flow match |
| `docs/references/specification.json` | API contract | request-response | existing Phase 4 `/v1` paths asserted by contract test | exact extension |
| `apps/web/src/lib/api/generated/schema.d.ts` | generated config/types | transform | generated Phase 4 path types | generated, not hand-written |
| `apps/web/src/features/risks/risk-schema.ts` | model/schema | transform | `requests/request-schema.ts` lines 12-34, 162-169; `assessments/assessment-schema.ts` lines 137-224, 269-308 | exact composite |
| `apps/web/src/features/risks/risk-service.ts` | server-only service | request-response | `assessments/assessment-service.ts` lines 56-100 and 226-314 | exact role/flow |
| `apps/web/src/features/risks/risk-actions.ts` | server action | request-response + cache invalidation | `assessments/assessment-actions.ts` lines 139-172, 210-242 | exact role/flow |
| `apps/web/src/features/risks/risk-register.tsx` | component | request-response + URL event-driven | `requests/request-table.tsx` lines 122-215 | exact role/flow |
| `apps/web/src/features/risks/risk-register-filters.tsx` | client component | URL event-driven | `requests/request-table.tsx` lines 122-174 | role/flow match |
| `apps/web/src/features/risks/risk-details.tsx` | component/state router | request-response | `assessments/assessment-editor.tsx` plus detail route state handling | role match |
| `apps/web/src/features/risks/risk-detail-editor.tsx` | client form component | CRUD/event-driven | `assessments/risk-editor.tsx` lines 132-203 | exact logic, distinct layout |
| `apps/web/src/features/risks/mitigation-control-list.tsx` | component | CRUD/event-driven | `assessments/control-implementation-editor.tsx` lines 72-135 | exact logic, distinct composition |
| `/app/risks/page.tsx` | App Router Server Component | request-response | `/app/requests/page.tsx` lines 11-37 | exact role/flow |
| `/app/risks/loading.tsx`, `/app/risks/error.tsx` | route states | request-response | `/app/requests/loading.tsx`, `/app/requests/error.tsx` | exact role |
| `/app/risks/[documentId]/page.tsx` | App Router Server Component | request-response | `/app/review/assessments/[documentId]/page.tsx` lines 17-62 | exact role, simplify to one aggregate read |
| `/app/risks/[documentId]/loading.tsx`, `error.tsx`, optional `not-found.tsx` | route states | request-response | assessment detail loading/error files | exact role |
| `apps/strapi/tests/risk-register.unit.test.ts` | test | transform/query | `assessment-workflow.unit.test.ts` | role match |
| `apps/strapi/tests/risk-register.integration.test.ts` | mounted integration test | request-response + CRUD | `assessment-workflow.integration.test.ts` lines 514-710, 1318-1388 | exact harness |
| `apps/strapi/tests/contract-catalogue.integration.test.ts` | contract test | file-I/O + transform | same file lines 254-300 | exact extension |
| `apps/strapi/tests/risk-register-seed.integration.test.ts` | integration test | batch CRUD | `assessment-seed.integration.test.ts` lines 20-50, 99-145 | exact harness |
| `apps/web/src/features/risks/risk-schema.test.ts` | unit test | transform | request/assessment schema tests | exact role |
| `risk-service.test.ts`, `risk-actions.test.ts` | unit tests | request-response | assessment service/action tests | exact role |
| `risk-register.test.tsx`, `risk-details.test.tsx` | component tests | event-driven/request-response | `request-table.test.tsx`, `assessment-editor.test.tsx` | strong role match |
| `apps/web/e2e/risk-register-workflow.spec.ts` | E2E test | request-response + CRUD | `assessment-release-workflow.spec.ts` with `playwright.config.ts` | exact harness |

`apps/web/src/config/navigation/navigation.ts` already contains `{ href:'/app/risks', label:'Risk register', capability:'risk:manage' }`; do not create a second navigation entry. The catalogue copies likewise already contain the two read operations and should be verification inputs, not assumed edit targets.

## Pattern Assignments

### Backend operations, route, and policy scope

**Apply to:** `operations.ts`, `routes/csrm-risk.ts`, `csrm-authorization.ts`  
**Analogs:** current Risk route and analyst request collection scope.

Copy the token-authenticated two-policy route shape from `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts:5-23`:

```ts
const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];

config: {
  auth: { strategies: ["content-api-token"] },
  policies: policies(CSRM_RISK_OPERATIONS.update),
}
```

For the two reads, extend the policy config rather than relying only on `policies(operation)`. Copy the explicit analyst-scope gate from `apps/strapi/src/policies/csrm-authorization.ts:155-176`:

```ts
const explicitAnalystOperation = hasExplicitAnalystOperation(grants.explicitRoles, config.operation);
if (!effectiveOperation) return deny(policyContext, "CSRM FunctionAPI access is denied.");

if (config.requireAnalystRequestCollectionScope) {
  if (!explicitAnalystOperation) {
    return deny(policyContext, "CSRM assessment review access is denied.");
  }
  policyContext.state.csrmAuthorization = {
    ...policyContext.state.csrmAuthorization,
    assessmentReviewCollectionScope: "all",
  };
}
```

**Reuse:** explicit-role grant detection, fail-closed denial, state projection, token gate, policy order.  
**Keep distinct:** introduce a Risk-register-specific config/state name such as `requireAnalystRiskRegisterScope` and `riskRegisterCollectionScope: "all"`; never reuse `assessmentReviewCollectionScope` semantically. Add constants for exact catalogue strings `GET:/api/v1/risks` and `GET:/api/v1/risks/{riskId}`. Do not alter mutation constants.

### Closed register query and honest pagination

**Apply to:** `risk-register-query.ts`, `risk-register.ts`, controller, unit/mounted tests.  
**Analog:** `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts:120-214`.

```ts
function analystAuthorization(state: unknown): void {
  if (!isRecord(state)) throw new AssessmentRequestQueryError();
  if ((state as AuthorizationState).csrmAuthorization?.assessmentReviewCollectionScope !== "all") {
    throw new AssessmentRequestQueryError();
  }
}

export function buildAnalystReviewCollectionQuery(query: unknown, state: unknown) {
  if (!isRecord(query)) throw new AssessmentRequestQueryError();
  analystAuthorization(state);
  assertOnlyKeys(query, ["pagination", "filters", "sort"]);
  // one `filters` object is shared by count and data queries
  return {
    countQuery: { filters },
    dataQuery: { filters, sort, start: (page - 1) * pageSize, limit: pageSize },
    pagination: { page, pageSize },
  };
}
```

Copy the controller envelope from `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:39-68`:

```ts
const [output, total] = await Promise.all([
  documents.findMany(dataQuery),
  documents.count(countQuery),
]);
const pageCount = Math.ceil(total / pagination.pageSize);
const meta = { pagination: { ...pagination, pageCount, total } };
return this.transformResponse
  ? this.transformResponse(sanitized, meta)
  : { data: sanitized, meta };
```

**Reuse:** strict record checks, allowed-key checks, bounded text/ID/integer parsing, shared filter expression, parallel data/count, safe 400 mapping, closed projection before response.  
**Keep distinct:** accept only the flat canonical Phase 5 keys (`q`, nine named filters, `sort`, `page`, `pageSize`), only page sizes 10/25/50, all eight sort fields, and Risk relation filters. Authorization must run before count. Prevent duplicate Risks from mitigation joins and return the exact authorised total.

### Semantic ordering repository (no exact analog)

**Apply to:** a small internal boundary in `risk-register.ts` or a clearly named sibling such as `risk-register-order.ts` if implementation size warrants it.  
**Analog:** none; do not pretend `safeReviewSort()` supplies the required semantics.

Required distinct behavior:

- Map Low=1, Moderate=2, High=3, Critical=4 before pagination.
- Put null target dates after dated records for both directions, with `riskNumber` as deterministic tie-breaker.
- Bind values; select only authorised/filter-matching document IDs for the requested page; hydrate and project those IDs through Strapi.
- Never fetch the entire register and sort it in JavaScript.
- Cover SQLite behavior now and leave production-database portability as an explicit Phase 8 concern, not a schema change.

### Closed Risk detail projection

**Apply to:** `risk-register.ts`, controller, `risk-schema.ts`, detail component/tests.  
**Analog:** `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts:145-243`.

```ts
export function projectAnalystRiskDetail(document: RecordValue): RecordValue {
  const result: RecordValue = { documentId: document.documentId, riskNumber: document.riskNumber };
  for (const field of RISK_DETAIL_FIELDS) {
    result[field] = relationFields.includes(field)
      ? projectRelationDocumentId(document[field])
      : document[field] ?? null;
  }
  return result;
}

export function projectControlImplementationSummary(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    control: /* bounded reusable-Control identity */,
    controlOwner: projectUser(document.controlOwner),
    controlStatus: document.controlStatus ?? null,
    effectivenessRating: document.effectivenessRating ?? null,
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}
```

**Reuse:** the complete `RISK_DETAIL_FIELDS` inventory, null normalization, bounded projections, `MAX_ASSESSMENT_RISKS` style +1 descendant probes.  
**Keep distinct:** the Phase 5 aggregate returns relation summaries, not bare IDs: Risk type `{documentId,name,description}`, owners `{documentId,displayName}`, system/asset `{documentId,name}`, Assessment `{documentId,assessmentNumber,title}`, and mitigation Controls `{documentId,controlNumber,name}`. Load the whole five-section aggregate as one unit; on relation/mitigation failure expose no partial Risk.

### Released parent lock and mutation reuse

**Apply to:** detail loader, existing `risk-workflow.ts`, Risk-page actions, integration/component tests.  
**Analogs:** `assessment-workflow.ts:111-123,245-292`; `risk-workflow.ts:192-224`.

```ts
export function isReleased(value: unknown): boolean {
  return isRecord(value)
    && value.assessmentStatus === "approved"
    && isRelation(value.approvedBy)
    && isDateTime(value.approvalDate);
}

export function assertMutableAssessment(value: unknown): void {
  if (!isRecord(value)) throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  const hasReleaseFact = value.assessmentStatus === "approved"
    || value.approvedBy != null || value.approvalDate != null;
  if (hasReleaseFact || (value.assessmentStatus !== "draft" && value.assessmentStatus !== "in-review")) {
    throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  }
}
```

`withMutableAssessmentMutation()` at `assessment-workflow.ts:245-292` serializes by Assessment, opens a transaction, locks/reloads the parent, asserts mutability, performs the child mutation, and applies the accepted-edit transition. `updateRisk()` at `risk-workflow.ts:192-224` additionally reloads the Risk under that lock and rejects changed ancestry.

**Reuse unchanged:** PATCH Risk, POST/PATCH/DELETE ControlImplementation services and routes, writable allowlists, relation resolution, ancestor re-check, 409 behavior.  
**Keep distinct:** successful detail data projects `parentLock: "mutable" | "released"`. Partial release facts abort the complete load into the safe error/not-available envelope with no Risk projection; there is no populated `invalid` detail. The client does not reconstruct release from a status label. A 409 action path reloads the authoritative aggregate and switches to released read-only detail or safe not-available.

### Web schemas and typed server-only transport

**Apply to:** `risk-schema.ts`, `risk-service.ts`, schema/service tests.  
**Analogs:** request schema/service and assessment schema/service.

Canonical URL parsing follows `apps/web/src/features/requests/request-schema.ts:12-34,162-169`:

```ts
const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;
const queryText = z.preprocess(firstValue, z.string().trim().max(120).catch(''));

export const requestListQuerySchema = z.object({
  q: queryText.default(''),
  sort: querySort.default('updatedAt:desc'),
  page: queryPage.default(1),
  pageSize: queryPageSize.default(10),
}).strip();

export function parseRequestListPayload(payload: unknown): RequestList {
  const parsed = listPayloadSchema.parse(payload);
  return { requests: parsed.data.map(toRequest), pagination: parsed.meta.pagination };
}
```

Closed mutation fields already exist in `assessment-schema.ts:137-224,269-308`. Re-export or extract them; do not duplicate divergent enums/allowlists.

Typed transport follows `assessment-service.ts:56-100,226-314`:

```ts
import 'server-only';
const responseOf = <T extends z.ZodType>(schema: T) => z.object({ data: schema }).strict();

async function request<T>(invoke, parse): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    if (error !== undefined || data === undefined) {
      return normalizeTransportError(error, response.status);
    }
    return { data: parse(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}
```

```ts
return request((client) => client.GET('/v1/risk_assessments/{assessmentId}', {
  params: { path: { assessmentId: id(assessmentId) } },
}), (payload) => analystAssessmentResponseSchema.parse(payload).data);
```

**Reuse:** `server-only`, generated path typing, `createStrapiClient`, `normalizeTransportError`, strict Zod envelopes, document ID parsing, existing mutations and inventory reads.  
**Keep distinct:** exact flat register query serialization and the new closed list/detail DTOs. Reject hostile over-populated responses. Unknown browser URL keys are discarded for canonical UX, while the backend rejects unknown API parameters.

### URL-driven responsive register

**Apply to:** `risk-register.tsx`, `risk-register-filters.tsx`, `/app/risks/page.tsx`, loading/error states, component tests.  
**Analogs:** `requests/request-table.tsx:122-215`; `/app/requests/page.tsx:11-37`.

```tsx
const pathname = usePathname();
const router = useRouter();
const currentSearchParams = useSearchParams();

const navigate = (nextQuery: RequestListQuery) => {
  const params = nextSearchParameters(new URLSearchParams(currentSearchParams.toString()), nextQuery);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
};
const resetPage = (changes: Partial<RequestListQuery>) => navigate({ ...query, ...changes, page: 1 });
```

```tsx
<DataTable
  data={[...requests]}
  filters={filters}
  onPageChange={(page) => navigate({ ...query, page })}
  onPageSizeChange={(pageSize) => resetPage({ pageSize })}
  onSortingChange={(sorting) => resetPage({ sort: sortFor(sorting) })}
  renderMobileCard={(item) => <article>{/* explicit links, not a giant card link */}</article>}
  stateSlots={{ empty, error, permission }}
  totalCount={pagination.total}
/>
```

The Server Component pattern at `/app/requests/page.tsx:15-22` is `parse(await searchParams)`, then parallel server-side service/session loading, then state selection from the transport result.

**Reuse:** URL as truth, `router.replace(..., {scroll:false})`, page reset, out-of-range correction, honest `pagination.total`, manual server sorting/paging, density persistence, state slots, desktop/mobile split.  
**Keep distinct:** the exact Phase 5 canonical parameters, 25 default page size, eight sort fields, nine filters plus search, chips preserving relation labels, desktop columns, mobile card contract, and exact UI copy. Clear filters keeps sort/pageSize and resets page. Keep `PageHeader` in all five states.

### Detail route and editors

**Apply to:** detail page/states, `risk-details.tsx`, `risk-detail-editor.tsx`, `mitigation-control-list.tsx`, tests.  
**Analogs:** assessment detail page; `risk-editor.tsx:132-203`; `control-implementation-editor.tsx:72-135`.

The existing Risk editor already supplies delta/no-op semantics and accessible field errors:

```tsx
const normalized = normalizeEmptyValues(values);
const submitted = mode === 'create' ? normalized : changedValues(normalized, initial);
if (mode === 'edit' && Object.keys(submitted).length === 0) {
  setStatusMessage('No changes to save.');
  return;
}
```

The mitigation editor uses the same delta pattern and retains a failed destructive dialog via a thrown error. Its current dialog at `control-implementation-editor.tsx:132` is the direct analog.

**Reuse:** React Hook Form, shared writable arrays/schemas, changed-value projection, OwnerCombobox, form-level Alert, per-field `aria-describedby`, polite live region, ConfirmDialog, authoritative response merge.  
**Keep distinct:** dedicated detail forms are single-column and max 640px; default state is read mode; add discard controls and dirty confirmation/focus restoration. Use the UI contract's exact remove body: “This removes the contextual implementation from this Risk. The reusable Control remains in the library.” Released mode renders semantic detail only and zero mutation affordances—do not render disabled forms. The detail page should perform one aggregate Risk load rather than the Phase 4 page's N+1 mitigation reads.

### Server actions and 409 refresh

**Apply to:** `risk-actions.ts`, action tests.  
**Analog:** `assessment-actions.ts:139-172,210-242`.

```ts
export async function updateRiskAction(input: unknown) {
  const parsed = updateRiskInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateRisk(parsed.data.riskId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}
```

`refreshAnalystAssessmentAction()` at lines 166-172 is the refresh analog.  
**Reuse:** strict action input parse, field/form error normalization, typed service calls, successful revalidation.  
**Keep distinct:** revalidate `/app/risks` and encoded `/app/risks/{riskId}`. On mutation status 409, call the Risk detail read, return a complete authoritative mutable/released aggregate or a safe no-data not-available result, and always let the UI leave edit mode.

### Seed and mounted test harnesses

**Apply to:** new seed, seed test, mounted register integration test.  
**Analogs:** `assessment-seed.integration.test.ts`; `assessment-workflow.integration.test.ts`.

The seed harness isolates SQLite and all environment gates (`assessment-seed.integration.test.ts:23-50`), then verifies every gate separately (`:99-107`), idempotence and the exact 2,646-Control inventory (`:109-131`), and repair (`:133-145`). Copy that structure.

Mounted routes are exercised through the real token/policy/controller stack. Phase 4 asserts exact closed keys for reference projections at `assessment-workflow.integration.test.ts:527-545`, hostile values and persistence non-effects at `:669-702`, complete-vs-partial release facts and cross-owner scope at `:1318-1369`, and denial of every Requestor mutation at `:1372-1388`.

**Reuse:** existing shared mounted harness, Bob analyst and Jane/requestor identities, isolated per-process DB, HTTP status plus payload assertions, before/after persistence checks, fresh/repeat/repair seed cycles.  
**Keep distinct:** seed one stable mutable Bob aggregate without modifying released `ASM-2026-33SAEN`; reconcile by domain keys rather than counts; ensure Controls stay exactly 2,646. Register tests cover all filters/sorts, no-mitigation, duplicates, exact totals, page boundaries, safe Requestor denial, relation projection, and every partial release combination.

### Contract/catalogue parity

**Apply to:** `specification.json`, generated schema, extension of `contract-catalogue.integration.test.ts`.  
**Analog:** `contract-catalogue.integration.test.ts:254-300`.

```ts
const authoritativeBytes = readFileSync(authoritativePath);
const bootstrapBytes = readFileSync(bootstrapPath);
assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");

const exactApis = catalogue.functionApis.filter((entry) => entry.url === catalogueUrl);
assert.deepEqual(exactApis.map((entry) => entry.functionId).sort(), expectedFunctionIds);
const openApiOperation = specification.paths?.[route.path]?.[route.method];
assert.ok(openApiOperation);
assert.equal(openApiOperation.operationId, route.operationId);
```

Extend parity assertions for both reads, closed list/detail schemas, safe 400/403/404 responses, generated path presence, exact Security Analyst grants, Requestor grant absence, and catalogue byte equality. Do not add these handlers to a public/users-permissions escape surface.

### Playwright harness

**Apply to:** `apps/web/e2e/risk-register-workflow.spec.ts`; reuse existing config.  
**Analogs:** `apps/web/playwright.config.ts:1-60`; `assessment-release-workflow.spec.ts`.

The config already owns isolation and ports:

```ts
const isolatedDatabaseFilename = `.tmp/playwright-e2e-${process.pid}.db`;
const isolatedNextDistDir = `.tmp/playwright-next-${process.pid}`;
const developmentApiToken = 'csrm-playwright-development-only';
// Strapi PORT 1338, Next port 3100, reuseExistingServer: false
```

The Phase 4 journey supplies shared accessibility/overflow helpers and actor switching (`assessment-release-workflow.spec.ts:8-40,77-106,190-201`) plus the released zero-mutation assertion (`:203-234`).

**Reuse:** one serial journey, deterministic token/seed, Bob analyst and Jane requestor contexts, both routes at 375/390/430/768/1024/1440, reduced-motion, keyboard-visible focus, Sheet/dialog focus restoration, Axe, no-overflow, persisted reload assertions.  
**Keep distinct:** use the configured 1338 health endpoint, never the stale line-4 `1337` constant. Cover filter URL round-trip and totals, assessment-created Risk discovery, mutable mitigation persistence, released `ASM-2026-33SAEN` read-only behavior, direct Requestor list/detail denial, and no record clues.

## Shared Patterns

### Authentication and authorization

Source: `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts:5-41` and `apps/strapi/src/policies/csrm-authorization.ts:139-176`. Apply token authentication and the two-policy chain to both reads. Exact explicit analyst operation grants create Risk-register scope; services assert that scope before all data access.

### Safe errors

Source: `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:33-37,65-67` and the workflow error classes. Invalid queries map to a closed 400 envelope. Authorization is 403. Detail denial/concealed absence must not reveal which condition occurred. Parent immutability is 409 and causes authoritative refresh.

### Closed validation and projection

Source: `assessment-schema.ts`, `assessment-scope.ts`, `assessment-service.ts`. Use strict positive allowlists at backend mutation/query boundaries and strict Zod response envelopes at the web boundary. Project only document IDs and UI-required labels; never return numeric IDs, emails, audit fields, arbitrary populations, or partial aggregates.

### Date, status, and styling

Dates are date-only UTC values rendered with `en-AU` medium formatting. Overdue and every severity/status use icon plus text. Feature components use semantic tokens only. Keep business ordering, date formatting, changed-field projection, and mutability outside JSX.

### Five route states

Both routes retain their `PageHeader` for populated, loading, empty/not-available, error, and permission states. Loading skeletons match final geometry after 300ms; errors never expose partial detail; permission/concealed not-found reveal no Risk facts.

## No Exact Analog

| Responsibility | Why | Planner Direction |
|---|---|---|
| Database-portable semantic severity and null-last ordering before pagination | Existing Phase 2 collections use normal Strapi field sorting; no Phase 3-4 implementation ranks enum severities or enforces null-last globally. | Isolate a minimal bound-query repository, test SQLite cross-page order exhaustively, hydrate through Strapi, and record production database portability for Phase 8. Do not add a column/schema or sort the whole collection in memory. |

## Reuse Versus Distinct Summary

| Reuse unchanged or extract | Must remain Phase 5-specific |
|---|---|
| token gate and two-policy chain | explicit Risk-register analyst scope and Requestor denial |
| same-filter `count`/`findMany` architecture | exact flat filter matrix, semantic ordering, no duplicate Risks |
| frozen Risk/ControlImplementation writable allowlists | relation-labelled full aggregate and parent-lock discriminant |
| typed `openapi-fetch` request wrapper and normalized errors | new generated GET paths and hostile-response rejection |
| DataTable manual paging/density/mobile/state slots | exact columns, chips, filter drawer, 25 default, Phase 5 copy |
| Risk/mitigation delta forms and ConfirmDialog | single-column detail UX, discard/focus, exact destructive text |
| serialized Assessment transaction and ancestor checks | 409 detail reload and released zero-affordance presentation |
| mounted/seed/Playwright harnesses | complete Phase 5 matrix, mutable fixture, `ASM-2026-33SAEN`, ports 1338/3100 |

## Metadata

**Analog search scope:** `apps/strapi/src/api`, `apps/strapi/src/policies`, `apps/strapi/src/bootstrap`, `apps/strapi/tests`, `apps/web/app`, `apps/web/src/features`, `apps/web/src/components/csrm`, `apps/web/e2e`, `docs/references`  
**Primary analog generation:** completed Phases 2-4, with Phase 4 preferred for Risk, mitigation, release, seed, and E2E behavior  
**Pattern extraction date:** 2026-08-31

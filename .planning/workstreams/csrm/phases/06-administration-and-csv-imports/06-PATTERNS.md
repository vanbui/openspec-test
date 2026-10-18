# Phase 6: Administration and CSV Imports - Pattern Map

**Mapped:** 2026-09-01
**Scope:** ADMIN-01 through ADMIN-04 plus INT-01/INT-04 support
**Source files inspected:** 31 planning, source, configuration, and test files
**Pattern families found:** 5 strong local families; 2 research-led gaps

## File Classification

The phase inputs prescribe one closed, configuration-driven Administration domain. The entries below are the complete likely create/modify inventory; braces denote a repeated, identical file family rather than optional work.

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `apps/strapi/src/api/csrm-administration/operations.ts` | config | request-response | `apps/strapi/src/api/csrm-risk/operations.ts` | exact |
| `apps/strapi/src/api/csrm-administration/routes/csrm-administration.ts` | route | request-response + file-I/O | `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` | exact for auth/routes |
| `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` | controller | request-response + file-I/O | `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | role-match |
| `apps/strapi/src/api/csrm-administration/services/administration-config.ts` | config | transform | no local closed four-collection adapter | research-led |
| `apps/strapi/src/api/csrm-administration/services/administration-query.ts` | utility | transform | `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` | exact |
| `apps/strapi/src/api/csrm-administration/services/administration-repository.ts` | service | CRUD | `apps/strapi/src/api/csrm-risk/services/risk-register.ts` | exact for list repository |
| `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` | service | CRUD + batch | `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` and Risk Register service | role-match |
| `apps/strapi/src/api/csrm-administration/services/csv-import.ts` | service | file-I/O + batch + transform | no local CSV import | research-led |
| `apps/strapi/src/policies/csrm-authorization.ts` | policy | request-response | its `requireAnalystRiskRegisterScope` branch | exact |
| `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` and `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | route/controller | request-response | existing mounted picker routes and `listRiskTypes`/`listControls` handlers | required single-owner picker-versus-canonical-Administration dispatch; do not duplicate GET routes |
| `apps/strapi/src/api/{csrm-risk-type,csrm-control,csrm-information-system,csrm-information-asset}/routes/*.ts` | route | request-response | existing core routers | modify exposure |
| `apps/strapi/config/middlewares.ts` | config | file-I/O | current `strapi::body` entry | config extension |
| `apps/strapi/package.json`, `apps/web/package.json`, `pnpm-lock.yaml` | config | build | current manifests | dependency modification |
| `apps/strapi/src/bootstrap/seed-administration-workflow.ts`, `apps/strapi/src/index.ts` | service/config | CRUD + batch | `seed-risk-register-workflow.ts` | role-match; create only if stable fixtures are needed |
| `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | config | authorization | same byte-identical pair | exact |
| `docs/references/specification.json`, `apps/web/src/lib/api/generated/schema.d.ts` | config/generated | request-response + multipart | current OpenAPI generation | exact |
| `docs/contract-gaps/phase-06-administration-import-contract.md` | documentation | contract | `docs/contract-gaps/phase-05-risk-register-date-filter.md` | exact |
| `apps/web/next.config.ts` | config | file-I/O | current typed Next config | config extension |
| `apps/web/src/features/administration/administration-config.ts` | config | transform | no four-collection adapter; use Risk schemas' closed constants style | role-match |
| `apps/web/src/features/administration/administration-schema.ts` | model/utility | transform | `apps/web/src/features/risks/risk-schema.ts` | exact |
| `apps/web/src/features/administration/administration-service.ts` | service | request-response + file-I/O | `apps/web/src/features/risks/risk-service.ts` | exact except multipart |
| `apps/web/src/features/administration/administration-actions.ts` | service | request-response + file-I/O | `apps/web/src/features/risks/risk-actions.ts` | exact |
| `apps/web/src/features/administration/administration-list.tsx` | component | request-response | `apps/web/src/features/risks/risk-register.tsx` | exact |
| `apps/web/src/features/administration/administration-form.tsx` | component | CRUD | `apps/web/src/features/requests/request-form.tsx` | exact |
| `apps/web/src/features/administration/administration-detail.tsx` | component | request-response | Risk detail feature + `DetailSection` | role-match |
| `apps/web/src/features/administration/csv-import-schema.ts` | model | transform | `risk-schema.ts` strict response parsers | role-match |
| `apps/web/src/features/administration/csv-client-parser.ts` | utility | file-I/O + transform | no local CSV parser | research-led |
| `apps/web/src/features/administration/csv-import-flow.tsx` | component | event-driven + file-I/O | no local five-step file workflow; compose existing states/forms/dialog | research-led |
| `apps/web/app/(app)/app/admin/{risk-types,controls,information-systems,information-assets}/page.tsx` | route/component | request-response | `apps/web/app/(app)/app/risks/page.tsx` | exact |
| `apps/web/app/(app)/app/admin/{risk-types,controls,information-systems,information-assets}/new/page.tsx` | route/component | CRUD | `apps/web/app/(app)/app/requests/new/page.tsx` | role-match |
| `apps/web/app/(app)/app/admin/{risk-types,controls,information-systems,information-assets}/[documentId]/page.tsx` | route/component | CRUD | `apps/web/app/(app)/app/risks/[documentId]/page.tsx` | exact |
| `apps/web/app/(app)/app/admin/{risk-types,controls,information-systems,information-assets}/import/page.tsx` | route/component | file-I/O + batch | no local import route | research-led |
| `apps/web/src/lib/capabilities/capability-adapter.ts`, `development-capabilities.ts` | config/provider | authorization | existing `risk:manage` capability | exact |
| `apps/web/src/config/navigation/navigation.ts`, `apps/web/src/components/shell/capability-navigation.tsx`, `app-shell.tsx` | config/component | authorization + event-driven | current flat capability navigation | modify for grouped navigation |
| `apps/strapi/tests/administration.unit.test.ts` | test | transform + CRUD + batch | `apps/strapi/tests/risk-register.unit.test.ts` | role-match |
| `apps/strapi/tests/administration.integration.test.ts` | test | mounted request-response + file-I/O | `apps/strapi/tests/risk-register.integration.test.ts` | exact harness pattern |
| `apps/strapi/tests/helpers/strapi-http-harness.ts` | test utility | mounted request-response | existing fixture/request API in same file | exact |
| `apps/strapi/tests/authorization.integration.test.ts` | test | authorization | catalogue byte/exact-grant block in same file | exact |
| `apps/web/src/features/administration/administration-schema.test.ts` | test | transform | `risk-schema.test.ts` | exact |
| `apps/web/src/features/administration/administration-service.test.ts` | test | request-response + multipart | `risk-service.test.ts` | role-match |
| `apps/web/src/features/administration/administration-workflow.test.tsx` | test | event-driven | `risk-register.test.tsx` + request form tests | role-match |
| `apps/web/e2e/administration-workflow.spec.ts` | test | dual-server E2E | `apps/web/e2e/risk-register-workflow.spec.ts` | exact |
| `scripts/verify-phase-06-integrity.mjs` | test utility | batch | `scripts/verify-phase-05-integrity.mjs` | exact |

Do **not** modify any of the four content-type `schema.json` files. Risk Type and Control already have schema uniqueness; System and Asset do not, and that frozen gap is handled/documented at the service boundary.

## Pattern Assignments

### Strapi operations and `/v1` route chain

**Apply to:** `operations.ts`, `routes/csrm-administration.ts`, policy change, and all controller entry points.

**Analog:** `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` lines 1-25 and `operations.ts` lines 1-10.

```ts
import type { Core } from "@strapi/strapi";
import { CSRM_RISK_OPERATIONS } from "../operations";

const riskRegisterPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: { operation, requireAnalystRiskRegisterScope: true },
  },
];

config: {
  auth: { strategies: ["content-api-token"] },
  policies: riskRegisterPolicies(CSRM_RISK_OPERATIONS.listRegister),
}
```

Copy the shape but rename the flag to `requireAnalystAdministrationScope`; the policy must require the exact human `Security Analyst` role and stamp `administrationCollectionScope: 'all'`. Catalogue constants use `{parameter}` even though mounted paths use `:parameter`.

The dedicated constant map must contain exactly these 24 grants:

```ts
GET|POST:/api/v1/risk_types
GET|PATCH:/api/v1/risk_types/{riskTypeId}
POST:/api/v1/risk_types/import/preview
POST:/api/v1/risk_types/import

GET|POST:/api/v1/controls
GET|PATCH:/api/v1/controls/{controlId}
POST:/api/v1/controls/import/preview
POST:/api/v1/controls/import

GET|POST:/api/v1/information_systems
GET|PATCH:/api/v1/information_systems/{informationSystemId}
POST:/api/v1/information_systems/import/preview
POST:/api/v1/information_systems/import

GET|POST:/api/v1/information_assets
GET|PATCH:/api/v1/information_assets/{informationAssetId}
POST:/api/v1/information_assets/import/preview
POST:/api/v1/information_assets/import
```

No DELETE constant or route is permitted. Centralize the already-mounted no-query Risk Type/Control picker routes without changing their `{ data: [...] }` compatibility response; canonical admin queries select `{ data, meta }`.

### Thin controller and safe status mapping

**Apply to:** `controllers/csrm-administration.ts`.

**Analog:** `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` lines 34-67, 72-95, 108-143.

```ts
function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest
    : status === 403 ? ctx.forbidden
      : status === 404 ? ctx.notFound : ctx.conflict;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

async listRiskRegister(ctx: RecordValue) {
  try {
    return await listRiskRegister({ repository, state: ctx.state, query: ctx.query });
  } catch (error) {
    return handleError(ctx, error);
  }
}
```

Keep query/body/file extraction and 201 assignment in the controller; parsing, matching, uniqueness, transactions, projections, and CSV classification belong in services. Extend typed errors to safe 413/415 in addition to 400/403/404/409. Authorization has already run before any file parsing.

### Closed adapter, query, repository, and uniqueness workflow

**Apply to:** all five backend service files.

**Analog:** `risk-register-query.ts` (closed parsing) and `risk-register.ts` lines 251-283, 337-423.

```ts
assertRiskRegisterScope(input.state);
const parsed = parseRiskRegisterQuery(input.query);
const [total, ids] = await Promise.all([
  input.repository.count(parsed.filters),
  input.repository.selectPage({
    filters: parsed.filters,
    sort: parsed.sort,
    offset: (parsed.page - 1) * parsed.pageSize,
    limit: parsed.pageSize,
  }),
]);
const documents = ids.length > 0 ? await input.repository.hydrate(ids) : [];
const byId = new Map(documents.map((document) => [document.documentId, document]));
const ordered = ids.map((id) => byId.get(id));
```

The repository analog maps sort choices to constant SQL columns, binds filter values, counts and selects from the same predicate, hydrates only selected IDs, then restores selected order. Phase 6 additionally orders by requested field, natural key, and `document_id`.

The new adapter must be a compile-time closed map:

```ts
type AdministrationKind = 'risk-types' | 'controls' | 'information-systems' | 'information-assets';

const ADMINISTRATION = {
  controls: {
    uid: 'api::csrm-control.csrm-control',
    table: 'csrm_controls',
    naturalKey: 'controlNumber',
    naturalKeyColumn: 'control_number',
    defaultSort: 'controlNumber:asc',
  },
  // three other explicit adapters
} as const satisfies Record<AdministrationKind, AdministrationConfig>;
```

Never accept a UID, table, sort column, filter structure, or writable field from the caller. Normalize comparisons with:

```ts
value.trim().normalize('NFKC').toLocaleLowerCase('en-AU')
```

Persist the trimmed display key. Use a per-collection serialized mutation queue and transaction recheck. Map application conflicts and database unique failures to the same field-addressable `409 NATURAL_KEY_CONFLICT`. Existing frozen schemas show `unique: true` only for Risk Type `name` and Control `controlNumber`; document the single-process limitation for System/Asset.

### CSV preview and commit

**Apply to:** backend `csv-import.ts`, workflow service, web CSV parser/schema/flow, middleware/Next limits.

**Local analog:** none. Use the locked research contract.

```ts
// Browser
import { parse } from 'csv-parse/browser/esm/sync';
// Strapi
import { parse } from 'csv-parse/sync';

parse(text, {
  bom: true,
  columns: (headers) => normalizeAndValidateHeaders(headers, contract),
  info: true,
  max_record_size: 65_536,
  relax_column_count: false,
  skip_empty_lines: false,
  trim: false,
});
```

Enforce 5,242,880 bytes, 5,000 data rows, fatal UTF-8, strict row width, normalized unique known headers, required values, closed enums, and strict booleans. Duplicate normalized natural keys make every occurrence ambiguous. Blank optional update cells mean unchanged, not clear.

Preview returns authoritative whole-file `create/update/unchanged/rejected/ambiguous` rows plus SHA-256 digest. `unchanged` is a first-class classification, never a rejection, and performs no write. Commit receives the same file, digest, and `confirmed=true`; it verifies bytes, reparses, reclassifies current state, ignores all client classifications/IDs/counts, then commits eligible create/update rows sequentially in one transaction per row. Partial row rejection is a 200 summary; digest mismatch is 409 with zero import writes. Formula-neutralize all downloadable report cells.

`apps/web/next.config.ts` extends its typed config with a 6 MiB Server Action body limit. `apps/strapi/config/middlewares.ts` replaces the bare `strapi::body` entry with explicit multipart/Formidable configuration plus minimal overhead, while application checks remain authoritative.

### Typed OpenAPI service and Server Actions

**Apply to:** OpenAPI JSON/generated types, `administration-service.ts`, `administration-actions.ts`.

**Analog:** `risk-service.ts` lines 1-47 and `risk-actions.ts` lines 85-125, 145-152.

```ts
import 'server-only';

async function request<T>(invoke, parse): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}

const canonical = serializeAdministrationQuery(query);
client.GET('/v1/controls', { params: { query: canonical } });
```

Multipart uses the generated literal path and serializer, with no manual Content-Type:

```ts
client.POST('/v1/controls/import/preview', {
  body: { file },
  bodySerializer(body) {
    const form = new FormData();
    form.append('file', body.file);
    return form;
  },
});
```

Actions are `'use server'`, validate unknown input, preserve submitted values, map zod issues to `fieldErrors`, map 409 to the configured natural-key field, and call `revalidatePath` only after success. Preview/commit actions accept `FormData`. Regenerate `schema.d.ts`; never hand-edit it.

### URL-driven list, five states, and route guard

**Apply to:** list component/schema and all list/detail/new/import pages.

**Analog:** `risk-schema.ts` lines 48-103, `risk-register.tsx` lines 16-45 and 70-134, and Risk page lines 15-32.

```ts
const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
if (!can('risk:manage', granted)) return <RiskRegisterPermissionState />;

const parsedQuery = riskRegisterQuerySchema.safeParse(await searchParams);
if (!parsedQuery.success) return <RiskRegisterInvalidFilterState />;
const result = await listRiskRegister(parsedQuery.data);
```

Change the capability to `administration:manage` and perform this check before every collection service call on list/detail/new/import routes. Denial renders only the non-enumerating full-page permission state.

Copy canonical URL serialization and `resetPage` behavior:

```ts
const navigate = (next) => router.replace(`${pathname}?${searchParametersFor(next)}`, { scroll: false });
const resetPage = (changes) => navigate({ ...query, ...changes, page: 1 });

<DataTable
  page={pagination.page}
  pageSize={pagination.pageSize}
  pageSizeOptions={[10, 25, 50, 100]}
  state={resolvedState}
  totalCount={pagination.total}
  renderMobileCard={renderMobileCard}
/>
```

Use one configuration-driven list with per-collection columns/filter/sort/copy. Preserve the deliberate `ready/loading/empty/error/success` behavior plus permission, desktop table/mobile card split, honest server totals, 300 ms search debounce/Enter, stale response suppression, semantic booleans/enums, and no hidden row click target.

### RHF + zod form and shared composites

**Apply to:** `administration-form.tsx`, detail component, create/detail pages.

**Analog:** `request-form.tsx` lines 1-23, 40-50, 142-175, 189-238.

```tsx
const form = useForm<Input>({
  defaultValues,
  mode: 'onBlur',
  resolver: zodResolver(schema),
});

for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
  const message = messages?.[0];
  if (message) form.setError(field as keyof Input, { message });
}

<FormSection title="Identity" description="...">...</FormSection>
```

Reuse `FormSection`, `DetailSection`, `ConfirmDialog`, installed shadcn form controls, and sonner. Add the locked behavior missing from the simpler analog: focus first invalid field; after first failed submit revalidate corrected fields on change; render a linked summary only for multiple errors. Unsaved confirmation is allowed; deletion is not.

### Capability and grouped navigation

**Apply to:** capability adapter, development grants, navigation config/renderers.

**Analog:** `capability-adapter.ts` lines 1-4, `development-capabilities.ts` lines 5-9, `capability-navigation.tsx` lines 24-43.

```ts
export const capabilities = [/* existing */, 'administration:manage'] as const;

const grants = {
  Requestor: ['assessment-request:create', 'assessment-request:read'],
  'Security Analyst': [/* existing */, 'administration:manage'],
};
```

Preserve `filter(item => can(item.capability, granted))`. Extend the navigation model/rendering to support a visible **Administration** group with four links; do not grant it to Requestor, and do not treat visibility as authorization.

### Catalogue byte identity and no-delete assertions

**Apply to:** both catalogue copies and authorization integration test.

**Analog:** `authorization.integration.test.ts` lines 184-225.

```ts
const authoritativeBytes = readFileSync(authoritativePath);
const bootstrapBytes = readFileSync(bootstrapPath);
assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0,
  'catalogue copies must be byte-identical');

for (const operation of Object.values(OPERATIONS)) {
  const matches = catalogue.functionApis.filter((entry) => entry.url === operation);
  assert.equal(matches.length, 1, `${operation} must have exactly one canonical FunctionAPI`);
}
```

Update the authoritative copy, then copy identical bytes to bootstrap. Remove the four Administration DELETE FunctionAPIs and membership references without renumbering survivors. Assert all 24 mounted operations have exactly one grant and Requestor and Security Analyst Agent functions contain none.

### Mounted Strapi and dual-server tests

**Apply to:** both backend tests, harness extension, E2E spec.

**Analog:** `strapi-http-harness.ts` lines 175-236, 309-318, 707-725, 948-957; `playwright.config.ts` lines 5-17, 24-30, 40-76.

```ts
strapi.server.listen(0, '127.0.0.1');

return fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
  ...init,
  headers: {
    ...(!omitApiToken ? authorizationHeader : {}),
    ...(identity ? { 'x-csrm-test-identity': identity } : {}),
    ...init.headers,
  },
});
```

Extend the mounted harness with closed Administration fixtures/helpers and multipart requests; keep its process-specific SQLite file and cleanup. Test denial before malformed query/file parsing, Bob success, Jane/agent denial, exact 409 uniqueness including simultaneous requests, bounds, preview classifications, digest mismatch zero-write, drift, and per-row rollback.

Playwright already derives unique loopback ports, a UUID SQLite database, and UUID Next directory, runs one worker, and sets `reuseExistingServer:false`. The new serial journey must use that config unchanged: Bob lists/creates all four, edits/reloads at least two, proves Control totals over 2,646, completes happy and rejected/ambiguous CSV paths, then Jane receives no data/file/count/existence clues. Never target 1337/3000.

### Seed invariants and Phase 6 integrity gate

**Apply to:** optional Administration seed, Strapi index, `verify-phase-06-integrity.mjs`.

**Analog:** `seed-risk-register-workflow.ts` lines 39-49, 243-280 and `verify-phase-05-integrity.mjs` lines 30-70, 81-109, 120-175.

```ts
const [existing] = await documentService.findMany({ filters, limit: 1 });
return existing
  ? documentService.update({ documentId: existing.documentId, data: safeRepairOnly })
  : documentService.create({ data: creationFacts });

let reconciliationQueue: Promise<void> = Promise.resolve();
const reconciliation = reconciliationQueue.then(reconcile, reconcile);
reconciliationQueue = reconciliation.catch(() => undefined);
```

For mutable admin acceptance data, creation owns initial editable facts; repeat bootstraps must not restore names/descriptions/enums after Bob edits them. Keep the existing environment/development identity gates and serialized queue. Do not recreate or modify the 2,646 Control library.

Copy the Phase 5 integrity script structure and update phase paths/hash. Phase 6 must scan new production/tests for `.only`/skip/fixme, bypass switches, secrets, raw fetch, hard-coded colors, live ports, schema changes, AI attribution, divergent catalogues, and generated OpenAPI drift. Unlike Phase 5, package/lock changes for the approved direct `csv-parse@7.0.2` dependencies are expected; the integrity rule must allow only that deliberate dependency change, not blanket package mutation.

## Shared Patterns

### Authorization ordering

Every route is: content API token outer gate -> `csrm-app-enabled` -> exact FunctionAPI -> human analyst Administration scope -> closed parsing/service assertion. No denied caller learns query validity, file validity, record existence, totals, natural keys, or preview facts.

### Error envelopes

Controllers translate typed expected errors only. CRUD: 400 invalid, 403 denied, 404 non-enumerating unavailable, 409 natural-key conflict. Import adds 413 bounds and 415 type. Unexpected infrastructure errors propagate; after an uncertain commit response, the web copy must not claim failure or auto-retry.

### Validation boundary

Use strict zod/allowlists at web schemas/actions and revalidate independently in Strapi. Generated OpenAPI types are compile-time transport shapes, not runtime validation. Keep domain rules out of JSX.

### Five deliberate states

Lists and import surfaces use deliberate ready/loading/empty/error/complete behavior, with a separate permission state. Copy state composition from `risk-register.tsx`; use existing `Alert`, `Skeleton`, `Progress`, `DataTable` state slots, icon+text semantics, mobile cards, and sonner summaries.

### Frozen schemas

The four `schema.json` files are read-only for Phase 6. All writable DTOs are positive allowlists. No `sourceData`, server IDs/timestamps, downstream workflow relations, Risk, or ControlImplementation values are accepted. System/Asset normalized uniqueness cannot be cross-process guaranteed without a forbidden database constraint; record this under INT-01.

## No Local Analog Found

| File/Concern | Reason | Planner Source |
|---|---|---|
| `services/csv-import.ts` and `csv-client-parser.ts` | Repository has no CSV parser/import | Research parser options, limits, normalization, and classification contract |
| `csv-import-flow.tsx` and import pages | Repository has no five-step file workflow | Locked `06-UI-SPEC.md`; compose existing states/dialog/form primitives |
| Four-collection adapter | Existing features are single-domain | Research `AdministrationKind` closed-map pattern |
| Digest-bound preview/re-upload commit | No local preview/commit workflow | Research contract; SHA-256 binds bytes but is not authorization |
| Frozen-schema normalized uniqueness for System/Asset | No database uniqueness exists | Research queue + transaction recheck; document single-process limitation |

## Planner Guardrails

- Do not create four backend or frontend implementations; differences belong in closed adapters/config.
- Do not mount duplicate `/v1/risk_types` or `/v1/controls` routes or break no-query picker consumers.
- Do not leave generic mutation/delete routes mounted. Systems/Assets retain only already-authorized generic `find` needed by Requestor reference reads; Risk Type/Control generic content routes are disabled.
- Do not add raw fetches, a Next Route Handler facade, client-authoritative classification, batch-wide transactions, parallel import writes, or persistent import entities.
- Do not set multipart `Content-Type` manually.
- Do not infer Control totals from a page or load all 2,646 Controls into the browser.
- Do not change live servers, fixed ports, content schemas, or analyst-edited seed evidence.

## Metadata

**Analog search scope:** `apps/strapi/src/api`, `apps/strapi/src/policies`, `apps/strapi/src/bootstrap`, `apps/strapi/tests`, `apps/web/app`, `apps/web/src/features`, `apps/web/src/components`, `apps/web/src/lib`, `apps/web/e2e`, `scripts`, and contract/catalogue references.

**Primary analog families:** Strapi Risk Register route/controller/repository; web Risk Register schema/service/list/routes; Request RHF form and Risk actions; authorization catalogue/mounted harness; Phase 5 Playwright/seed/integrity.

**Pattern extraction date:** 2026-09-01

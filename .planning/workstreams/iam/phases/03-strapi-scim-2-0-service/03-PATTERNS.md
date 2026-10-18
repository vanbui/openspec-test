# Phase 3: Strapi SCIM 2.0 service — Pattern Map

**Mapped:** 2026-10-15
**Scope:** Locked P3-01–P3-32; P3-32 supersedes the original rate defaults. File splits below are proposals for the planner, not existing exports. All analog paths were checked with `git ls-files`; no installed/runtime mirror is an implementation target.

## File Classification

Paths in the first column are relative to the repository root. Brace lists identify separate proposed files with the same responsibility.

| New/modified file | Role | Data flow | Closest tracked analog | Match |
|---|---|---|---|---|
| `apps/backend/src/iam/scim/{routes,handlers}.ts` | route/controller | request-response | `apps/backend/src/index.ts`; mounted-route harness below | partial: root registration is new |
| `apps/backend/src/policies/scim-source-bearer.ts`; `apps/backend/src/iam/scim/source-context.ts` | middleware/utility | request-response | `apps/backend/src/iam/identity/source-principal.ts` | authority match; new bearer/grant boundary |
| `apps/backend/src/iam/scim/{token-service,source-lock,source-activity}.ts` | service/utility | CRUD | `apps/backend/src/iam/identity/user-lock.ts`; source principal | partial: source-row target differs |
| `apps/backend/src/iam/scim/{token-cli,dev-token-export}.ts`; `apps/backend/package.json`; `docker/.env.example` | utility/config | file-I/O | `apps/backend/tests/helpers/iam-live-keycloak-gate.ts` | partial lifecycle match; safe export new |
| `apps/backend/src/iam/scim/{wire,mapping,errors,discovery}.ts` | utility | transform | `apps/backend/src/iam/identity/identity-input.ts` | validation/outcome match; wire format new |
| `apps/backend/src/iam/scim/{filter,patch}.ts` | utility | transform | `apps/backend/src/iam/identity/{identity-input,identity-service}.ts` | partial: constrained grammars new |
| `apps/backend/src/iam/identity/identity-service.ts` | service | CRUD | same file | exact extension location |
| `apps/backend/src/middlewares/scim-boundary.ts`; `apps/backend/src/iam/scim/{limiter,config}.ts`; `apps/backend/config/middlewares.ts` | middleware/config | request-response | `apps/backend/src/middlewares/csrm-multipart-cleanup.ts` | lifecycle match; scoped parser/limiter new |
| `apps/backend/src/index.ts` | config | event-driven | same file | exact bootstrap location |
| `apps/backend/tests/helpers/strapi-http-harness.ts`; `apps/backend/tests/{served-operations,contract-catalogue}.integration.test.ts` | test | request-response | same files | exact inventory extension |
| `docs/references/specification.json`; both existing capability-catalogue copies; `docs/references/served-operations.json` | config | transform | existing inventory index/test below | contract extension; inventory generated from runtime |
| `apps/backend/tests/iam-scim-*.unit.test.ts`; `apps/backend/tests/iam-scim-*.integration.test.ts`; proposed SCIM HTTP helper | test | request-response | `apps/backend/tests/iam-identity.integration.test.ts`; HTTP harness | exact runtime/setup patterns |
| Proposed `docker/midpoint/e2e/` capture/refusal scripts | utility | request-response/file-I/O | `docker/midpoint/reload.sh`; live Keycloak gate | partial orchestration match |
| Proposed replay test and `apps/backend/tests/fixtures/iam-scim/` | test | request-response/file-I/O | real HTTP harness | no captured-lifecycle analog; capture prerequisite |
| Existing OIDC/capability/layout tests; narrowly required repairs to those modules only | provider/component/test | request-response | existing OIDC adapter, capability loader and protected layout below | exact refusal flow |

Final PLAN files must enumerate actual filenames rather than retain these globs or brace shorthand. No schema, generated content-type declaration, index or JDL file belongs in this list.

## Pattern Assignments

### Source authority and source metadata

**Analog:** `apps/backend/src/iam/identity/source-principal.ts:60–74`:

```typescript
export async function resolveSourcePrincipal(strapi: SourceReader, sourceDocumentId: string): Promise<SourcePrincipal | null> {
  const serviceUserDocumentId = await readValidBinding(strapi, sourceDocumentId);
  if (!serviceUserDocumentId) return null;
  const principal: SourcePrincipal = Object.freeze({ sourceDocumentId, serviceUserDocumentId, [principalBrand]: true as const });
  issued.set(principal, strapi);
  return principal;
}
```

`validateSourcePrincipal(strapi: SourceReader, principal: unknown): Promise<SourcePrincipal | null>` checks the private WeakMap and rereads the binding. Lines 42–57 check active source, protected active manual service, absent password/subject, exactly one Identity Provisioning Role/Function, active `idambox-iam` Application and unique binding. Reuse this authority without constructing/copying it. These functions authenticate neither bearer tokens nor individual FunctionAPI grants: the new policy must verify the digest and freshly traverse the exact operation grant separately. Store authority in separate server-created SCIM state, never human identity state.

**Lock analog:** `apps/backend/src/iam/identity/user-lock.ts:24–55`:

```typescript
export async function withIdentityUserLock<T>(strapi: Core.Strapi, documentId: string | undefined,
  work: (trx: Knex.Transaction) => Promise<T>, coordination?: IdentityCoordination): Promise<T> {
  const nested = strapi.db.inTransaction();
```

Inside its transaction the helper calls `lockIdentityUser` before `work(trx)`. PostgreSQL uses `forUpdate()` on the user; SQLite acquires its write reservation and retries the entire outer transaction on contention. Copy that transaction/rollback approach for **source-row** serialization, deriving source table/column metadata from the existing model. The user helper does not lock a source row just because its documentId is passed in. Token writes remain Document Service updates of only `tokenHash`/`tokenRotatedAt`; activity is an independent Document Service update outside user transactions. Revoke must bypass active-binding preconditions. Crypto comparison, atomic owner-only ignored-env export and revoke-on-export-failure have no complete existing analog: implement the locked decisions explicitly rather than copying a superficially similar helper.

### Six-method writer and wire validation

**Analog:** `apps/backend/src/iam/identity/identity-service.ts`. `createIdentityService(strapi: Core.Strapi)` returns the following existing API; these are not transport handler signatures:

```typescript
createFromSource(principal: SourcePrincipal, input: SourceIdentityInput)
replaceFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput)
patchFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput)
deactivateFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, sourceDeletion = false)
readForSource(principal: SourcePrincipal, documentId: string)
listForSource(principal: SourcePrincipal, input: SourceIdentityListInput = {})
```

Each returns `Promise<IdentityOutcome<...>>`: mutation/read values are `SourceIdentity`; list values are `{ items: SourceIdentity[]; total: number }`. `SourceIdentityTarget = string | { sourceExternalId: string }`. DELETE uses the final boolean `true`, never a delete writer. The service projects `documentId` plus `SOURCE_IDENTITY_FIELDS`, with no created/updated timestamps. Manual candidates omit their source key. Its current list filter is `{ field, eq: string } | { and: SourceIdentityFilter[] }`, with `{ start?, limit? }`, `$eq` and `id:asc`. Extend only an allowlisted comparison option for P3-16; keep `externalId` exact and visibility inside the filter used for both total and page.

**Input analog:** `apps/backend/src/iam/identity/identity-input.ts:49–71`:

```typescript
export function parseSourceIdentityInput(input: unknown, mode: "patch"): IdentityOutcome<IdentityPatchInput>;
export function parseSourceIdentityInput(input: unknown, mode?: "create" | "replace"): IdentityOutcome<SourceIdentityInput>;
```

The parser rejects unknown internal fields and clears omitted optional fields in replacement mode. Preserve this as the final internal DTO validator. SCIM mapping must first enforce schemas, attribute mutability, single-primary-email reduction and protocol-specific path errors. `identityFailure("keycloakUnavailable")` yields `{ ok: false, code, retryAfterSeconds: 30 }` (lines 12–19); map it to safe 503/Retry-After without remote text. New protocol errors such as invalidPath/noTarget cannot be reconstructed from the existing coarse invalidInput outcome.

### PATCH deciding read and rollback seam

**Analog:** `apps/backend/src/iam/identity/identity-service.ts:119–135`:

```typescript
return await withIdentityUserLock(strapi, id, async () => {
  if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
  const user = await readUser(strapi, id); if (!accessible(user, principal)) return identityFailure("notFound");
  externalId = user.sourceExternalId ?? undefined;
```

Extend this existing locked mutation path with a typed reducer seam: supply the allowlisted current projection after locking, reduce all operations in order, validate the final delta, then perform the existing single `runSourceMutation(..., "patch", ...)` Document Service update. Preserve the existing DTO call form. Define the new reducer contract explicitly in the implementation plan; it does not exist yet. No read in a handler followed by a later unlocked patch and no independent writer.

`identity-input.ts:35–47` requires conflict translation **after rollback**:

```typescript
if (strapi.db.inTransaction()) throw new Error("IAM_IDENTITY_TRANSACTION_ACTIVE");
```

Wrapping the public patch method in an outer transaction can reach this guard while translating uniqueness. Keep the outer catch/`failedWrite` boundary in the service after its own user-lock transaction. Tests must cover concurrent unrelated deltas, later-operation failure with zero persistence/remote effects, uniqueness rollback, immutable key attempts and blocking remote failure. A returned failure cannot follow an earlier mutation in the same reducer.

### Outer boundary, parser and root mounting

**Middleware analog:** `apps/backend/src/middlewares/csrm-multipart-cleanup.ts:30–39`:

```typescript
export default function csrmMultipartCleanup() {
  return async (context: MultipartContext, next: () => Promise<unknown>): Promise<void> => {
    try {
      await next();
    } finally {
      await Promise.all(temporaryPaths(context.request.files).map((location) => unlink(location).catch(() => undefined)));
    }
  };
}
```

Copy the factory/typed-context/outer-finally form for one canonical SCIM event, adding safe scoped error translation. Do not copy its post-parser placement or swallowed errors for activity persistence. `apps/backend/config/middlewares.ts` puts `strapi::query` before `strapi::body`, followed by multipart cleanup. Insert the SCIM boundary before parsing; configure SCIM JSON recognition/1 MiB without changing CSRM form/upload limits. Valid bearer activity must persist even for later parser/grant/source-limit refusals; design ordering so the pre-parser path can perform it once. Limiter defaults are 1200/IP and 600/source per 60 seconds with capped buckets, injected clock and safe capacity rejection.

**Bootstrap analog:** `apps/backend/src/index.ts` uses `register`, async `bootstrap` and async `destroy` hooks with explicit registration/imports. Add root route registration once in bootstrap using `strapi.server.routes({ prefix: '/scim/v2', routes: [...] })`, **omitting type**. Ordinary `src/api` routers are not root-route analogs. Each manifest operation needs `auth:false` plus the explicit source policy, including discovery and unsupported Groups. Preserve the existing seeds and shutdown lifecycle.

### Real HTTP tests, inventory and additive contract

**Integration analog:** `apps/backend/tests/iam-identity.integration.test.ts:1–65` imports `node:assert/strict`, `node:test`, type-only service/principal types; uses isolated SQLite env and fixtures; compiles Strapi and requires modules from `compiled.distDir`. Core setup excerpt (lines 43–46):

```typescript
const compiled = await runtime.compileStrapi({ appDir });
assert.ok(compiled.distDir); compiledDir = compiled.distDir;
strapi = await runtime.createStrapi(compiled).load(); strapi.cron?.destroy();
```

Load the principal and service from that same compiled runtime so private authority is not split across module instances. Preserve `after` teardown of runtime/remote/files and restored env. Reuse `apps/backend/tests/helpers/strapi-http-harness.ts` for actual listening HTTP routes and in-memory credentials; authored transport tests must assert persistence as well as wire outcomes.

The harness's `listMountedContentApiRoutes` at lines 199–235 currently filters `router.type === "content-api"` and reads only `strapi.server.api("content-api").listRoutes()`. Extend inventory with manifest **and observed root layers**. Manifest declarations alone cannot prove mounting. Keep content-api/plugin classifications and verify each SCIM method/path once plus no `/api/scim/v2` alias.

`apps/backend/tests/served-operations.integration.test.ts:225–241` currently builds `${upper}:/api${specPath}`. Lines 298 and 559 also prepend `/api` for client/spec-only entries. Normalize operation-local root servers in every relevant branch rather than special-casing only the first comparison. The Phase 2 test at lines 640–669 asserts SCIM is absent; replace its reservation assertions with mounted authenticated-route assertions while retaining existing human-role exclusions. `contract-catalogue.integration.test.ts` contains existing per-route contract/grant checks to preserve; add root-SCIM coverage without changing old CSRM meaning. Both catalogue copies remain byte-identical; served inventory is regenerated from the runtime. Generated client declarations follow existing generation only if the additive contract requires a diff.

### Capture/replay and same-session refusal

**Orchestration analogs:** `docker/midpoint/reload.sh` applies resource objects through midPoint REST with credentials consumed inside the container. `apps/backend/tests/helpers/iam-live-keycloak-gate.ts:358–375` boots isolated compiled Strapi, and its execution stages/finally restore live Keycloak availability. Reuse owned-resource cleanup, bounded stages and in-memory secrets; do not copy expanded credential-bearing XML or raw request recording into evidence.

The current live gate's `deactivate` branch at lines 422–430 changes status directly through Document Service. Replace that trigger in the Phase 3 proof with actual authenticated SCIM PUT/PATCH/DELETE requests. Keep its same still-valid signed-token validation, pending-outbox checks and refusal assertion. `apps/backend/tests/helpers/fake-keycloak-server.ts` exports `startFakeKeycloakServer(options: { tokenLifetimeSeconds?: number } = {})`; reuse it for automated outage tests, with `close()` in teardown. Its request recording includes sensitive fields: never persist it directly as sanitized SCIM capture.

There is no genuine connector lifecycle fixture analog. Create sanitizing capture tooling first; the orchestrator then runs the pinned real connector and writes `03-CONNECTOR-CAPTURE-EVIDENCE.md` plus sanitized provenance. Only a later dependent plan creates `tests/fixtures/iam-scim/` and HTTP replay from that actual traffic. Missing operations require recapture or a pending gate; authored direct probes remain separately labelled.

**Existing refusal flow:** `apps/csrm/src/lib/auth/oidc-session-adapter.ts` exposes `OidcSessionAdapter.capabilitiesFor(_session: Session): CapabilityAdapter` and `identityToken(): Promise<string | null>`. The former delegates to `strapiGrantedCapabilities`; the latter forwards the unexpired existing session access token. `apps/csrm/src/lib/capabilities/strapi-capabilities.ts:34–37`:

```typescript
export async function strapiGrantedCapabilities(): Promise<ReadonlySet<Capability>> {
  const result = await getCurrentUserAccess();
  return result.error ? new Set() : capabilitiesFromOperations(result.data.operations);
}
```

`apps/csrm/app/(app)/layout.tsx` sets `dynamic = 'force-dynamic'`, resolves current capabilities and renders the existing `PermissionDeniedState` after `CapabilityDeniedError`. Use the existing typed API and refusal copy; no direct component fetch or new screen. The live orchestrator proves positive access then next-request API/browser/detail/write refusal with the same session, outage before recovery and 1440/375 screenshots. Evidence destinations: `03-REFUSAL-EVIDENCE.md`, `03-BROWSER-REFUSAL-EVIDENCE.md`, `evidence/browser-refusal/`. These are future destinations, not proof produced by this mapping.

## Shared Patterns and No-Analog Boundaries

- Keep private principal issuance, ownership/claims, guarded Document Service writer, existing leaver outbox and source tuple reservation. No physical/model changes.
- New token cryptography/source locks, SCIM parsers/discovery, bounded limiter and safe export require explicit tests against locked behavior; there is no complete codebase implementation to copy.
- Real connector capture and browser proof are orchestrator checkpoints. Captured fixture provenance cannot be manufactured by copying authored test payloads.
- Post-execution steps must include `gsd-code-review`, `gsd-secure-phase`, remediation and `03-GATE-EVIDENCE.md`. Final root command is `pnpm --dir apps/backend test`; contract or CSRM changes also require `pnpm --dir apps/csrm api:check`, typecheck and test. Keep the three activation flags false in committed configuration.

## Metadata

Primary analog families: private source authority, transactional identity service/input, outer middleware lifecycle, real HTTP/runtime inventory, live gate/session refusal. Search stopped after these strong matches; targeted supporting files are cited only where the primary analog lacks the required boundary. This map introduces no runtime evidence, source changes or new dependency.

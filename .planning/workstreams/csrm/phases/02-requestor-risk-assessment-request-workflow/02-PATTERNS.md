# Phase 2: Requestor Risk Assessment Request Workflow - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 43 proposed new/modified files (grouped below where one pattern applies to a family)
**Analogs found:** 41 / 43

This map treats the Phase 1 authorization spine and the landed design foundation as fixed architecture. It maps patterns to copy; it does not propose a replacement design.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/strapi/src/middlewares/csrm-development-identity.ts` | middleware | request-response | `apps/strapi/tests/helpers/strapi-http-harness.ts` identity middleware | flow-match |
| `apps/strapi/config/middlewares.ts` | config | request-response | same file | exact modification |
| `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` | service/bootstrap | CRUD | `apps/strapi/src/bootstrap/seed-core-data.ts` | role-match |
| `apps/strapi/src/index.ts` | config/bootstrap | batch | same file | exact modification |
| `apps/strapi/.env.example`, `apps/web/.env.local.example` | config | request-response | same files | exact modification |
| `apps/strapi/src/policies/csrm-authorization.ts` | policy | request-response | same file | exact modification |
| `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` | controller | CRUD/request-response | same file | exact modification |
| `apps/strapi/src/api/csrm-assessment-request/services/request-workflow.ts` | service | transform/CRUD | `request-ownership.ts` + `collection-scope.ts` | role-match |
| `apps/strapi/src/api/csrm-assessment-request/services/request-number.ts` | service | transform | `request-ownership.ts` | partial |
| `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` | service | transform | same file | exact modification |
| CSRM collection route files read by dashboard/request screens | route | request-response | assessment-request route | exact role/flow |
| `docs/references/specification.json` | API contract | request-response | existing assessment-request operations in same file | exact modification |
| `apps/web/src/lib/api/generated/schema.d.ts` | generated model | transform | same generated file via `pnpm api:generate` | exact generated |
| both `idambox-csrm-role-function-api-catalogue.json` copies | config/catalogue | authorization graph | Phase 1 canonical grant entries | exact modification |
| `apps/strapi/tests/helpers/strapi-http-harness.ts` | test utility | request-response/CRUD | same file | exact modification |
| `apps/strapi/tests/authorization.integration.test.ts` (or focused mounted test included by script) | integration test | request-response/CRUD | same file | exact modification |
| `apps/web/src/lib/auth/development-session-adapter.ts` | auth adapter | request-response | same file | exact modification |
| `apps/web/src/lib/api/transport/server-client.ts` | service/transport | request-response | same file | exact modification |
| `apps/web/src/features/requests/request-domain.ts` | model/adapter | transform | `src/features/shell/shell-service.ts` parsing layer | role-match |
| `apps/web/src/features/requests/request-schema.ts` | validation/model | transform | `src/lib/auth/session-adapter.ts` validated parsing | role-match |
| `apps/web/src/features/requests/request-service.ts` | service | request-response/CRUD | `src/features/shell/shell-service.ts` | exact role/flow |
| `apps/web/src/features/requests/request-actions.ts` | server action | request-response/CRUD | `app/sign-in/server-actions.ts` | role-match |
| `apps/web/src/features/requests/request-form.tsx` | client component | event-driven/CRUD | shadcn `form.tsx` composition | role-match |
| `apps/web/src/features/requests/request-table.tsx` | client component | event-driven/transform | shadcn `table.tsx` composition | role-match |
| `apps/web/src/features/dashboard/requestor-dashboard-service.ts` | service | request-response/transform | `src/features/shell/shell-service.ts` | exact role/flow |
| `apps/web/src/features/dashboard/requestor-dashboard.tsx` | component | transform | workspace page + shell state components | role-match |
| `apps/web/src/components/csrm/data-table.tsx` | component | event-driven/transform | `src/components/ui/table.tsx` | role-match |
| `apps/web/src/components/csrm/status-badge.tsx` | component | transform | `src/components/ui/badge.tsx` | role-match |
| `apps/web/src/components/csrm/page-header.tsx` | component | transform | `src/components/shell/app-shell.tsx` `PageHeader` | exact extraction |
| `apps/web/src/components/csrm/detail-section.tsx` | component | transform | `src/components/ui/card.tsx` + `separator.tsx` | role-match |
| `apps/web/src/components/csrm/form-section.tsx` | component | transform | `src/components/ui/form.tsx` | role-match |
| `apps/web/src/components/csrm/confirm-dialog.tsx` | component | event-driven | `src/components/ui/alert-dialog.tsx` | exact composition |
| `/app`, `/app/requests`, `/new`, `/[documentId]`, `/edit` pages | App Router page | request-response | `app/(app)/app/page.tsx` + protected layout | role-match |
| route `loading.tsx`, `error.tsx`, empty/denied renderings | component/state | request-response | `src/components/states/states.tsx` | exact role/flow |
| four request tests + dashboard test | unit/component test | transform/event-driven | shell service and state tests | role-match |
| `apps/web/e2e/requestor-request-workflow.spec.ts` | E2E test | event-driven/CRUD | `e2e/app-shell.spec.ts` | exact role/flow |
| `apps/web/playwright.config.ts` | test config | process orchestration | same file | exact modification |
| `apps/web/package.json` / lockfile | config | dependency graph | existing exact-pinned UI dependencies | exact modification |
| `apps/web/app/layout.tsx` (Toaster mount) | provider/layout | event-driven | root layout + `ui/sonner.tsx` | exact composition |

## Pattern Assignments

### Development identity bridge

**Applies to:** `csrm-development-identity.ts`, `config/middlewares.ts`, both environment examples, `development-session-adapter.ts`, `server-client.ts`.

**Primary analog:** `apps/strapi/tests/helpers/strapi-http-harness.ts`

**Koa middleware shape** (lines 34-41):

```typescript
function testIdentityMiddleware() {
  return async (ctx, next) => {
    const identity = testIdentities.get(ctx.get("x-csrm-test-identity"));
    if (identity) ctx.state.idamboxUser = identity;
    await next();
  };
}
```

Copy the state handoff and always-call-`next` shape, but production source must use the locked double gate and a database lookup by exact seeded email. It must contribute no identity unless `NODE_ENV === 'development' && CSRM_DEV_IDENTITY === 'true'`; unknown/inactive users also contribute no identity. Register it before the mounted router/body consumers in `config/middlewares.ts`, following that file's typed `Core.Config.Middlewares` array (lines 1-16).

**Server-only role/session pattern:** `apps/web/src/lib/auth/development-session-adapter.ts` lines 1-39 and `session-adapter.ts` lines 5-25. Keep `import 'server-only'`, parse the two-role closed union, and add an email mapping to the session/server adapter rather than exposing the header value to client code.

**Transport boundary:** `apps/web/src/lib/api/transport/server-client.ts` lines 1-6, 40-46:

```typescript
import 'server-only';
import createClient, { type Client } from 'openapi-fetch';
import type { paths } from '../generated/schema';

export function createStrapiClient(): StrapiClient {
  return createClient<paths>({ baseUrl: parseStrapiRestBase(process.env.CSRM_API_BASE_URL) });
}
```

Extend this single factory to attach `x-csrm-dev-identity` only from the server-derived development session mapping. Keep the existing safe `TransportResult` and `normalizeTransportError`; do not add a browser transport or page-level `fetch`.

**Config analogs:** `apps/strapi/.env.example` lines 10-15 and `apps/web/.env.local.example` line 1. Add the feature flag to both relevant examples as required by the locked decision; values are examples, never secrets.

### Development Content API permission bootstrap

**Applies to:** `seed-development-content-api-permissions.ts`, `src/index.ts`, mounted tests.

**Analog:** `apps/strapi/src/bootstrap/seed-core-data.ts` lines 44-76.

```typescript
export async function seedCoreData(strapi: Core.Strapi) {
  if (process.env.IDAMBOX_SEED_CORE !== "true") return;
  const applicationService = strapi.documents("api::application.application");
  const existingApplications = await applicationService.findMany({ filters: ..., limit: 1 });
  existingApplications[0] ?? await applicationService.create({ data: ... });
  strapi.log.info("IdamBox core sample data seed complete");
}
```

Copy the explicit environment gate, lookup-before-create idempotency, typed Strapi argument, and final log. For permissions, query the users-permissions public role and reconcile an explicit action allowlist only. The allowlist may contain required `api::csrm-*` actions; assert it contains no `application`, `function`, `function-api`, `role`, or `idambox-user` actions. Wire it in `src/index.ts` after the existing seeds using the import/await sequence at lines 1-14.

### Authorization policy actor fact and route policies

**Applies to:** `csrm-authorization.ts`, assessment-request routes, every additional CSRM collection route used by Phase 2.

**Analog:** `apps/strapi/src/policies/csrm-authorization.ts` lines 97-152.

```typescript
const grants = await loadEffectiveGrants(authorizationStrapi, identity);
if (!grants) return deny(policyContext, "CSRM FunctionAPI access is denied.");

const explicitAnalystOperation = hasExplicitAnalystOperation(grants.explicitRoles, config.operation);
const requestorOperation = hasOperation(grants.requestorRoles, config.operation);
if (!effectiveOperation) return deny(...);
```

Extend `ctx.state.csrmAuthorization` (current type at lines 23-29 and merge pattern at lines 89-95) with one trusted request actor fact. The controller must consume this fact; it must not re-derive authority from a client role label.

**Route composition:** `apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` lines 4-63. Each used operation composes `global::csrm-app-enabled` first and configured `global::csrm-authorization` second, referencing `operations.ts` constants. Collection reads use `requireRequestCollectionScope`; item mutations use `requireRequestOwnership` where applicable.

### Request controller, ownership, collection pagination, and workflow services

**Applies to:** controller, `request-workflow.ts`, `request-number.ts`, `collection-scope.ts`.

**Controller analog:** `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` lines 5-44.

```typescript
export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const query = applyAssessmentRequestCollectionScope(ctx.query, ctx.state);
    const output = await strapi.documents(UID).findMany(query);
    const sanitized = this.sanitizeOutput ? await this.sanitizeOutput(output, ctx) : output;
    return this.transformResponse ? this.transformResponse(sanitized) : { data: sanitized };
  },
  async create(ctx) {
    applyTrustedRequestorOwnership(ctx);
    const document = await strapi.documents(UID).create({ data: ctx.request.body.data });
    // sanitize, set 201, transform
  },
}));
```

Preserve factory extension, trusted query/data preparation, document service access, output sanitization, transformResponse, and explicit create status. Correct `find` to return scoped `meta.pagination`; never calculate totals before owner scope is applied.

**Fail-closed transform analog:** `collection-scope.ts` lines 34-66. Validate unknown state/query, throw on absent trusted scope, preserve allowed caller filters, and overwrite the `requestor` filter from policy state. New workflow helpers should use the same small pure-function/unknown-input style.

**Server ownership analog:** `request-ownership.ts` lines 21-34:

```typescript
if (!hasDocumentId(identity) || !body || !isRecord(data)) {
  throw new Error("CSRM assessment request ownership is denied.");
}
body.data = { ...data, requestor: identity.documentId };
```

Expand the server-owned replacement idea to `requestor`, `requestNumber`, `requestStatus`, and `submittedDate`. For update, use an explicit editable-field allowlist and a persisted-state transition guard: Requestor may edit only a draft, and only `draft -> submitted`; submission stamps the server time. Keep analyst behavior distinct through the trusted actor fact. `request-number.ts` has no exact local analog: keep it a small backend-only generator with bounded uniqueness retry rather than count-then-increment.

### Contract, generated types, and catalogue parity

**Applies to:** `specification.json`, generated `schema.d.ts`, both catalogue copies.

The OpenAPI source is authoritative and the generated file is never hand-edited. After describing `meta.pagination`, typed query parameters (`filters`, `_q`, `sort`, `pagination`), and a create body without server-owned fields, regenerate with the existing `apps/web/package.json` scripts (lines 12-13):

```json
"api:generate": "openapi-typescript ../../docs/references/specification.json -o src/lib/api/generated/schema.d.ts",
"api:check": "pnpm api:generate && git diff --exit-code -- src/lib/api/generated/schema.d.ts"
```

**Catalogue test pattern:** `apps/strapi/tests/authorization.integration.test.ts` lines 34-79 compares authoritative/runtime bytes, verifies reciprocal Role/Function links, and asserts exactly one FunctionAPI for every served operation. Phase 1's analyst-only DELETE split must remain intact; do not fold DELETE back into the Requestor core function.

### Typed request and dashboard services

**Applies to:** request domain/schema/service/actions and dashboard service.

**Analog:** `apps/web/src/features/shell/shell-service.ts` lines 1-58.

```typescript
import 'server-only';
import { createStrapiClient, normalizeTransportError, type TransportResult } from '../../lib/api/transport/server-client';

export async function listShellApplications(): Promise<TransportResult<readonly ShellApplication[]>> {
  try {
    const { data, error, response } = await createStrapiClient().GET('/applications');
    if (error || !data) return normalizeTransportError(error, response.status);
    return { data: parseShellApplications(data), error: null };
  } catch (error) {
    return normalizeTransportError(error);
  }
}
```

Copy the server-only boundary, explicit domain interface, runtime payload parsing, typed generated path, safe error normalization, and discriminated result. Request list calls pass generated `params.query`; detail/update pass `params.path` with Strapi `documentId`; create/update map only validated domain fields into `{ data: ... }`. Dashboard aggregation calls these feature services or its own typed endpoints, never arbitrary component fetches. “Released” remains a contract gap and must not be inferred from approval.

`request-schema.ts` should expose shared field, draft, submit, and bounded list-query schemas. `request-actions.ts` is a thin `'use server'` adapter: parse unknown input again, call the service, and revalidate/redirect only after success. Business rules remain out of JSX.

### App Router server/client boundary

**Applies to:** all five pages, request table/form, confirm dialog, dashboard component.

**Server page analog:** `apps/web/app/(app)/app/page.tsx` lines 1-17 imports feature/UI modules and returns server-rendered composition without `'use client'`. Protected identity/capability handling remains in `app/(app)/layout.tsx` lines 6-32.

Pages load initial data through server-only services. In Next.js 16, await `params` and `searchParams`. Only URL/table controls, React Hook Form interaction, confirmation, and toast-triggering event handlers cross into files marked `'use client'`.

### CSRM composites and landed design system

**PageHeader:** extract/re-export the existing implementation from `src/components/shell/app-shell.tsx` lines 7-21; update shell/page imports so there is one implementation, not a duplicate.

**DataTable:** compose the landed `src/components/ui/table.tsx` primitives. Lines 7-18 provide the overflow wrapper; lines 55-90 provide semantic rows/heads/cells and token-backed utilities. TanStack owns state/models, while CSRM owns accessible markup, URL callbacks, server pagination, empty state, and responsive card fallback. Do not copy v8 `useReactTable` APIs into the pinned v9 implementation.

**FormSection/request form:** compose `src/components/ui/form.tsx` lines 32-65 and 90-155. It already links labels, descriptions, messages, `aria-describedby`, and `aria-invalid`. Configure RHF validation `mode: 'onBlur'`; use `zodResolver`; keep one column and server revalidation.

**ConfirmDialog:** compose `src/components/ui/alert-dialog.tsx` lines 47-68 and 147-180. Use its focus-trapped primitive, responsive action stack, and explicit cancel/action controls. Submission is irreversible, so wait for the server and name the action “Submit request”.

**Notifications:** mount `Toaster` once in `app/layout.tsx`, importing `src/components/ui/sonner.tsx`. That wrapper already maps success/info/warning/error icons (lines 12-33) and semantic CSS variables. Toasts supplement inline validation and the persistent returned status.

**StatusBadge:** wrap `ui/badge.tsx` with a closed request-status mapping. Every rendering includes icon plus text; use semantic status utilities only and `aria-live="polite"` for a live transition.

**DetailSection/FormSection:** compose `Card`/`Separator`/form primitives. Keep domain formatting in request-domain helpers and pass render-ready values to JSX.

**States:** reuse or specialize `src/components/states/states.tsx` lines 4-40: loading uses `role="status"`/polite live region, error and permission denial use `role="alert"`, recovery is an actual Button/Link. For known layouts use landed `Skeleton` primitives instead of full-page spinners. Distinguish first-use empty, filtered-empty (clear filters), error, and denied copy.

### Tests and harness

**Mounted Strapi harness:** extend `tests/helpers/strapi-http-harness.ts`, preserving isolated SQLite setup (lines 61-100), test-only middleware insertion (102-104), seeded role lookup/fixture creation (122-172), loopback listener (174-189), persistence helper and cleanup (190-199). Add submitted fixtures, development-gate configuration, persistence/update helpers, and pagination assertions. Never weaken production source for testing.

**Backend HTTP tests:** copy the `request()` helper and payload assertion pattern from `authorization.integration.test.ts` lines 18-31. Transition tests must assert both status and unchanged persistence, as existing cross-requestor update and DELETE-denial tests do at lines 123-153. Add fail-closed matrix cases for disabled environment, false/missing flag, missing/unknown email, inactive identity, and non-development runtime.

**Service unit tests:** `src/features/shell/shell-service.test.ts` lines 1-40 shows the project pattern: hoist transport mocks, mock `server-only`, import after mocks, verify mapped success and normalized failure without raw details.

**Component tests:** `src/components/states/states.test.tsx` lines 1-34 uses Testing Library roles/text and real user-visible affordances. Request tests should assert behavior and announcements, not CSS implementation details.

**E2E:** `e2e/app-shell.spec.ts` lines 12-17 provides the sign-in helper; lines 19-39 show responsive loops and overflow assertions; lines 42-52 show keyboard focus checks. The new journey signs in as Requestor and covers create -> save draft -> edit -> confirm submit -> returned submitted status.

**Playwright config:** change `webServer` in `playwright.config.ts` lines 15-20 to an array that starts isolated Strapi and Next processes with explicit dev identity/seed/permission environment. Retain one worker, trace-on-failure, bounded timeouts, and CI retry behavior from lines 3-14.

## Shared Patterns

### Authorization and ownership

- Strapi is the authorization boundary. UI capability/nav state is presentation only.
- Exact `METHOD:/api/...` operation constants feed route policy config and seeded FunctionAPI URLs.
- Requestor collection scope overwrites hostile ownership filters; item access checks persisted ownership.
- Controller/workflow code consumes trusted policy actor facts and replaces server-owned fields.
- Every additional CSRM collection read needs both policy attachment and one canonical catalogue grant.

### Error handling

- Strapi policy helpers fail closed with stable, non-sensitive denial messages.
- Controllers sanitize output before transform/return.
- Web feature services catch transport/config failures and return `TransportResult`; they do not expose raw Strapi details.
- Pages render distinct error/permission states. Actions return field/form errors suitable for RHF and use notifications only as supplemental feedback.

### Validation and mass-assignment defense

- Parse external URL/form/action input through shared Zod schemas.
- Validate again in server actions even after client validation.
- Backend workflow services allowlist writable fields and load persisted state before transitions.
- Query schemas bound page/pageSize/sort/status/search before conversion to generated Strapi query params.

### UI composition

- Server Components by default; client islands only for event/state APIs.
- Use shadcn primitives, semantic theme aliases, Inter, and existing responsive shell.
- No raw brand/status colors in feature components, no color-only status, no in-page shadows, no zebra tables.
- Preserve 375px-1440px layouts, visible focus, skeleton-first loading, and tabular numerics.

### Test conventions

- Backend: real mounted Strapi router/policy/controller plus isolated SQLite and persistence assertions.
- Web: Vitest/jsdom with `@` alias and `src/**/*.test.{ts,tsx}` include (`vitest.config.ts` lines 5-17).
- Browser: Playwright role-based locators, responsive viewports, keyboard assertions, and real dual-server journey.
- Contract: regenerate from authoritative OpenAPI and enforce generated diff; catalogue copies are byte-identical.

## No Analog Found

| File | Role | Data Flow | Reason / Planner Direction |
|---|---|---|---|
| `apps/strapi/src/api/csrm-assessment-request/services/request-number.ts` | service | transform/CRUD | No local request-number generator exists. Implement the research's bounded, collision-resistant backend generator; do not invent a count-based sequence. Identifier format remains a product checkpoint. |
| `apps/web/src/components/csrm/data-table.tsx` TanStack state layer | component | event-driven/transform | Local table primitives exist, but no TanStack table engine analog exists. Use pinned v9 docs/research for state APIs and retain local markup/design patterns. |

## Planner Guardrails

- Do not alter Strapi content-type schemas.
- Do not add a Next.js Route Handler/API facade.
- Do not expose IAM collection permissions through the development public role.
- Do not let Requestor mutate `requestor`, `requestNumber`, `requestStatus` except the permitted submit intent, `submittedDate`, `questionnaire`, or `assessment`.
- Do not equate approved with released; keep the recently-released widget service-backed with a true empty state until the release fact is defined.
- Do not redesign the landed shell/tokens/primitives. Extract the existing PageHeader and compose existing shadcn primitives.
- Preserve the Phase 1 analyst-only DELETE function and catalogue byte parity.

## Metadata

**Analog search scope:** `apps/strapi/src`, `apps/strapi/tests`, `apps/web/app`, `apps/web/src`, `apps/web/e2e`, Phase 1 plans/summaries, project configuration and design direction.

**Strong analog families read:** authorization/controller/scope; bootstrap/harness; server transport/service/session; shell/primitives/states; Vitest/Playwright tests and configuration.

**Pattern extraction date:** 2026-08-29

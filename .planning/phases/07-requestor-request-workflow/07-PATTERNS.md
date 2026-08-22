# Phase 7: Requestor Request Workflow - Pattern Map

**Mapped:** 2026-08-22  
**Files analyzed:** 18 planned new/modified file groups  
**Analogs found:** 15 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` | controller | CRUD, request-response | same file | role-match |
| `apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts` | service | CRUD, event-driven transitions | same file | role-match |
| `apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` | route | request-response | same file | exact |
| `apps/backend/src/api/csrm-assessment-request/policies/internal-csrm-caller.ts` | middleware | request-response | `src/policies/csrm-app-enabled.ts` | role-match |
| `apps/backend/specification.json`, `apps/csrm/docs/references/specification.json`, `apps/csrm/src/lib/api/generated/openapi.ts` | config / generated contract | transform | existing generated contract and scripts | exact workflow |
| `apps/csrm/src/lib/api/client.ts` | service | request-response | same file | exact extension |
| `apps/csrm/src/lib/api/csrm-service.ts` | service | CRUD, request-response | same file | exact extension |
| `apps/csrm/src/features/requests/request-types.ts`, `request-validation.ts` | model / utility | transform | `src/domain/service-result.ts` | partial |
| `apps/csrm/src/features/requests/request-actions.ts` | controller | request-response | `src/lib/fixtures/select-development-identity.ts` | role-match |
| `apps/csrm/src/features/requests/request-form.tsx` and catalogue/workflow/dialog compositions | component | CRUD, event-driven | `src/components/shell/development-identity-selector.tsx`, `src/components/ui/button.tsx` | partial |
| `apps/csrm/src/features/requests/request-list.tsx`, `request-dashboard.tsx`, `request-details.tsx` | component | request-response | `src/components/states/state-boundary.tsx`, `src/components/shell/page-header.tsx` | role-match |
| `apps/csrm/src/app/page.tsx` | route component | request-response | same file | exact replacement |
| `apps/csrm/src/app/requests/page.tsx`, `new/page.tsx`, `[requestId]/page.tsx` | route component | request-response | `src/app/page.tsx` | role-match |
| `apps/csrm/src/config/routes.ts` | config | transform | same file | exact |
| `apps/csrm/src/test/fixtures.ts`, `handlers.ts` | test fixture | request-response | same files | exact extension |
| `apps/csrm/src/lib/api/csrm-service.test.ts`, `src/features/requests/*.test.tsx` | test | request-response | `csrm-service.test.ts`, `components/shell/shell.test.tsx` | role-match |
| `apps/csrm/e2e/shell.spec.ts` | test | request-response, responsive | same file | exact extension |

## Pattern Assignments

### Backend request workflow files

**Analogs:** `apps/backend/src/api/csrm-assessment-request/{controllers,services,routes}/csrm-assessment-request.ts`; `apps/backend/src/policies/csrm-app-enabled.ts`.

The current request API is intentionally a guarded Strapi core route. Preserve its feature flag on every core and added transition route, then replace only its controller/service implementation with ownership-aware logic. The policy follows the project’s small typed-context, boolean-or-`forbidden()` convention.

**Core router guard** — `routes/csrm-assessment-request.ts:1-10`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::csrm-assessment-request.csrm-assessment-request', {
  config: {
    find: { policies: ['global::csrm-app-enabled'] },
    findOne: { policies: ['global::csrm-app-enabled'] },
    create: { policies: ['global::csrm-app-enabled'] },
    update: { policies: ['global::csrm-app-enabled'] },
  },
});
```

**Policy failure convention** — `src/policies/csrm-app-enabled.ts:3-14`:

```ts
type PolicyContext = { forbidden?: (message: string) => unknown };

export default (policyContext: PolicyContext) => {
  if (isCsrmAppEnabled()) return true;
  return policyContext.forbidden
    ? policyContext.forbidden('CSRM application behavior is disabled. Set csrmAppIsEnabled=true to enable CSRM routes.')
    : false;
};
```

Apply a second internal-caller policy to all request endpoints, including custom `submit` and `withdraw`; resolve the actor exclusively from server-to-server assertion. Service methods must first perform actor-derived ownership lookup, whitelist mutable fields, then create/save/transition. Never accept `requestor`, `requestNumber`, `requestStatus`, or `submittedDate` from browser payload. Return identical safe denial for unknown and unowned identifiers.

**Persisted-field boundary** — `content-types/csrm-assessment-request/schema.json:15-103`: only the form fields in the schema (`title` through `dueDate`, plus `informationAssets`/`informationSystems`) are mutable request data. System fields and statuses are at lines 15-18 and 62-90.

### Typed API transport and service

**Analogs:** `apps/csrm/src/lib/api/client.ts`, `apps/csrm/src/lib/api/csrm-service.ts`, `apps/csrm/src/domain/service-result.ts`.

Extend the existing server-only client rather than calling `fetch` from pages/components. Add typed JSON mutation methods beside `get`, retaining the timeout, JSON-content, response-shape validation, and opaque error result.

**Imports and result boundary** — `client.ts:1-11`, `service-result.ts:1-15`:

```ts
import "server-only";
import { getCsrmStrapiBaseUrl } from "@/config/env";
import { SAFE_API_MESSAGES, type ServiceResult } from "@/domain/service-result";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeApiError };
```

**Safe transport mechanics** — `client.ts:53-90`:

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetchImpl(buildRequestUrl(baseUrl.data, path), {
    headers: { accept: "application/json" }, signal: controller.signal,
  });
  if (!response.ok) return error("http", { status: response.status, retryable: response.status === 429 || response.status >= 500 });
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) return error("invalid-response", { retryable: false });
  // parse JSON and apply supplied runtime guard
} catch {
  return error(controller.signal.aborted ? "timeout" : "network", { retryable: true });
} finally { clearTimeout(timeout); }
```

**Focused generated-contract service** — `csrm-service.ts:1-26`:

```ts
import type { paths } from "@/lib/api/generated/openapi";
import { createApiClient } from "@/lib/api/client";

export async function listApplications(): Promise<ServiceResult<ApplicationCollectionResponse>> {
  return createApiClient().get<ApplicationCollectionResponse>("/applications", isApplicationCollectionResponse);
}
```

Use the same `paths[...]` generated types and narrow runtime envelope guards for `listOwnedRequests`, `getOwnedRequest`, `createDraft`, `saveDraft`, `submitRequest`, `withdrawRequest`, and catalogue reads. Keep actor credentials/assertions server-only. Regenerate the backend spec, copy it byte-for-byte to CSRM references, regenerate `openapi.ts`, and use the existing drift check; do not hand-maintain a second transport schema.

### Server Actions and identity seam

**Analog:** `apps/csrm/src/lib/fixtures/resolve-identity.ts:57-73` and `src/lib/fixtures/select-development-identity.ts`.

Actions are server-only adapters: resolve identity on the server, parse/validate `FormData`, call `csrm-service`, and return safe discriminated action state. Preserve the runtime gate—no selected fixture or service credential may reach browser bundles.

```ts
export function resolveDevelopmentIdentity(options: ResolveIdentityOptions = {}): IdentitySnapshot | undefined {
  const runtime = options.runtime ?? process.env.NODE_ENV;
  if (!isFixtureRuntime(runtime)) return undefined;
  return snapshotFor(isFixtureKey(options.cookieValue) ? options.cookieValue : "requestor");
}
```

### Request pages and UI compositions

**Analogs:** `apps/csrm/src/app/page.tsx`, `src/components/shell/page-header.tsx`, `src/components/states/{state-boundary,access-denied-state,unavailable-state,optional-value}.tsx`, `src/components/ui/button.tsx`.

Pages are Server Components by default: capability preflight then typed service load, mapping safe result/denial to shared state surfaces. Keep interaction (filters in URL, dirty state, confirmation dialogs, searchable selectors, form submissions) in narrow request feature Client Components.

**Page hierarchy/action placement** — `page-header.tsx:5-31`:

```tsx
<PageHeader
  title="Dashboard"
  action={<Button asChild><Link href="/requests/new">New request</Link></Button>}
/>
```

**State mapping** — `state-boundary.tsx:16-29`:

```tsx
switch (status) {
  case 'loading': return <LoadingState />;
  case 'error': return <ErrorState error={error} onRetry={onRetry} />;
  case 'empty': return <EmptyState />;
  case 'ready': return <section aria-label="CSRM content" className="min-w-0 overflow-x-auto">{children}</section>;
}
```

Use `AccessDeniedState` for metadata-safe ownership denial and `UnavailableState` only for genuinely unavailable/missing records; never render record title/number/status before the ownership decision. Use `OptionalValue` for read-only optional fields, which supplies the contract copy `Not provided` (`optional-value.tsx:7-12`).

**Semantic button/focus convention** — `button.tsx:7-27,30-45`: retain `primary`, `secondary`, `ghost`, and `destructive` variants; they include touch sizing and `focus-visible` outline. Compose official shadcn/Radix primitives; do not roll custom dialog/popover focus management.

No direct UI analog exists yet for the progressive request form, responsive table-to-card list, or catalogue multi-select. Implement them as reusable `features/requests` compositions following the UI contract, rather than embedding separate route markup.

### Capability and route enablement

**Analogs:** `apps/csrm/src/config/routes.ts:45-85`, `src/config/capabilities.ts:37-84`, `src/domain/route-access.ts:39-50`.

Enable only existing `my-requests`, `new-request`, and `request-details` definitions; do not add role-name checks or a parallel nav list.

```ts
export function visibleRoutes(capabilities: readonly CapabilityId[]): readonly RouteDefinition[] {
  const effectiveCapabilities = new Set(capabilities);
  return routeDefinitions.filter(
    (route) => route.status === "enabled" && effectiveCapabilities.has(route.capability),
  );
}
```

Route access is display-only. Preserve the explicit comment/ordering that calls protected work only after allowed UI classification, while backend ownership remains authoritative (`route-access.ts:34-50`).

### Tests, MSW, and production exclusion

**Analogs:** `apps/csrm/src/lib/api/csrm-service.test.ts`, `src/test/{fixtures,handlers}.ts`, `src/components/shell/shell.test.tsx`, `e2e/shell.spec.ts:219-243`.

Extend MSW HTTP handlers (not an in-memory UI store) and type fixtures from request service response aliases.

```ts
export const handlers = [
  http.get("http://strapi.test/api/applications", () => HttpResponse.json(applicationsFixture)),
];
```

API tests use `server.use(...)` to model transport failures and assert `ServiceResult`, including absence of leaked internals (`csrm-service.test.ts:52-150`). Component tests use Testing Library role/name assertions, as in `shell.test.tsx:203-260`. E2E production tests must extend the emitted-JS fixture string scan and direct-route 404 assertions (`shell.spec.ts:219-243`) for any request fixture/evidence module.

## Shared Patterns

### Authorization and non-disclosure

**Sources:** `apps/csrm/src/domain/route-access.ts:4-11`; `apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts:3-10`.

UI capability checks may hide routes/actions; backend policy/controller/service enforce internal caller identity and ownership for all record operations. Treat unknown and non-owned IDs identically and reveal no metadata.

### Safe failures

**Source:** `apps/csrm/src/lib/api/client.ts:62-90`.

Normalize HTTP/network/timeout/invalid JSON failures to `ServiceResult`; pages and actions show approved safe copy rather than raw Strapi payloads.

### Server-only boundary

**Sources:** `apps/csrm/src/lib/api/client.ts:1`; `apps/csrm/src/lib/fixtures/resolve-identity.ts:1,57-73`.

All Strapi access, service credentials, and actor resolution sit behind `server-only`; browser input never chooses an actor or a transition-owned field.

### Generated API contract

**Sources:** `apps/backend/specification.json`; `apps/csrm/docs/references/specification.json`; `apps/csrm/src/lib/api/generated/openapi.ts`.

Backend route changes require specification generation/copy/type generation in the same change set, followed by the repository drift check.

## No Analog Found

| File / composition | Role | Data Flow | Reason |
|---|---|---|---|
| `features/requests/request-form.tsx` | component | CRUD | No existing CSRM form or Server Action form composition. |
| `features/requests/catalogue-multi-select.tsx` | component | request-response | No existing searchable relation selector. |
| `features/requests/request-list.tsx` | component | request-response | No existing responsive semantic table/card-list pair. |

## Metadata

**Analog search scope:** `apps/csrm/src`, `apps/csrm/e2e`, `apps/backend/src`, generated specifications  
**Files scanned:** 25  
**Pattern extraction date:** 2026-08-22

# Phase 2: Requestor Risk Assessment Request Workflow - Research

**Researched:** 2026-08-29
**Domain:** Strapi-authorised request workflow with a Next.js App Router client
**Confidence:** HIGH for existing boundaries and the core request workflow; MEDIUM where the supplied contract lacks product semantics

## User Constraints

- The development authentication bridge is a locked Wave 1 deliverable: a development-only Strapi middleware resolves `x-csrm-dev-identity` by seeded email into `ctx.state.idamboxUser`; it is enabled only when both `NODE_ENV=development` and `CSRM_DEV_IDENTITY=true`, and otherwise contributes no identity. The matching web adapter maps Requestor to `jane.doe@idambox.com`, Security Analyst to `bob.doe@idambox.com`, and `createStrapiClient()` attaches the header server-side. [VERIFIED: orchestration context and `.planning/STATE.md`]
- The development bootstrap must grant the users-permissions public role only an explicit allowlist of required `csrm-*` Content API actions. It must never grant `application`, `function`, `function-api`, `role`, or `idambox-user`. Environment flags belong in both example environment files. [VERIFIED: orchestration context]
- The design foundation is complete and must not be replanned. Phase 2 must add the locked CSRM composites: `DataTable` on `@tanstack/react-table`, `StatusBadge`, `PageHeader`, `DetailSection`, `FormSection`, `ConfirmDialog`, and Sonner notifications. Screens compose primitives and semantic tokens; they contain no raw colour values or business rules in JSX. [VERIFIED: orchestration context, `.planning/STATE.md`, and `docs/design/csrm-design-direction.md`]
- `requestNumber`, ownership, `requestStatus`, and `submittedDate` are server-controlled facts. Requestor updates are permitted only while the request is a draft, and the only Requestor transition in this phase is `draft -> submitted`. [VERIFIED: orchestration context]
- Every CSRM collection read by the web application must receive the existing `csrm-authorization` policy and a catalogue-seeded canonical served-route grant, following the Phase 1 exact-operation and byte-parity pattern. Both catalogue copies stay byte-identical. [VERIFIED: orchestration context and Phase 1 summaries]
- Use the generated `openapi-fetch` client, with query parameters represented in the generated contract, and use React Hook Form plus Zod for form state and validation. Do not call Strapi from arbitrary components or create a frontend HTTP facade. [VERIFIED: orchestration context and `AGENTS.md`]
- Do not alter Strapi content-type schemas. [VERIFIED: orchestration context]
- The UI must work from 375px through 1440px, satisfy WCAG 2.2 AA patterns, and deliberately cover populated, loading, empty, error, and permission-denied states. [VERIFIED: orchestration context and `docs/design/csrm-design-direction.md`]
- Verification commands are `npm test` in `apps/strapi`, then `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` in `apps/web`. At least one Playwright journey must cover create, save draft, edit, submit, and final status; mounted Strapi HTTP tests must cover transition guards and development middleware fail-closed behavior. [VERIFIED: orchestration context]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| REQ-01 | A Requestor can view only authorised Risk Assessment Requests with status, search, filtering, sorting, and pagination. | Preserve the Phase 1 owner scope, restore pagination metadata, use typed Strapi query parameters, and drive a manual/server-side `DataTable`. [VERIFIED: `.planning/REQUIREMENTS.md`, codebase, Strapi REST docs] |
| REQ-02 | A Requestor can create a structured Risk Assessment Request using persisted CSRM fields and assessment context. | Use the existing `CsrmAssessmentRequest` fields and relations; derive owner/number/status on Strapi; do not invent a UI-only request model. [VERIFIED: `.planning/REQUIREMENTS.md`, schema, JDL] |
| REQ-03 | A Requestor can save, resume, and edit a draft while its workflow state permits it. | Put editability in a server transition guard and a shared domain policy; use `PUT /csrm-assessment-requests/{id}` and an edit route that loads the persisted draft. [VERIFIED: OpenAPI contract and locked context] |
| REQ-04 | A Requestor can submit a valid request and receive an unambiguous workflow-state confirmation. | Revalidate with the shared submit schema, confirm the irreversible transition, send canonical `PUT`, let Strapi stamp `submittedDate`, then render/announce the returned `submitted` status. [VERIFIED: locked context and design direction] |
| REQ-05 | A Requestor dashboard shows requests and questionnaires requiring action and recently released assessments from data-driven widgets. | Build widgets from typed services and request status/relation facts. The “released” marker is a contract gap and must not be equated with approval without a product decision. [VERIFIED: `.planning/REQUIREMENTS.md`, schemas, project brief] |
</phase_requirements>

## Summary

Phase 1 already supplies the correct security spine: canonical operation constants, exact Role -> Function -> FunctionAPI matching, Requestor birthright grants, owner-scoped collection reads, item ownership checks, server-derived create ownership, and mounted HTTP tests. Phase 2 should extend that spine rather than replace it. [VERIFIED: `apps/strapi/src/policies/csrm-authorization.ts`, assessment-request route/controller, and Phase 1 summaries]

The vertical slice should use `/app/requests`, `/app/requests/new`, `/app/requests/[documentId]`, and `/app/requests/[documentId]/edit`, with `/app` becoming the Requestor dashboard. Pages remain Server Components; only the table controls, form, confirmation dialog, and notification interactions cross the client boundary. Feature services alone call the server-only typed Strapi client, and thin Server Actions invoke mutation services after server-side Zod validation. [CITED: `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`; VERIFIED: `AGENTS.md`]

Three contract corrections belong before screen work: return and describe `meta.pagination` from the owner-scoped collection controller; make the OpenAPI create body match the server-owned request fields; and test Strapi-compatible serialization of typed `filters`, `_q`, `sort`, and `pagination`. The present controller returns only `{data}`, and the present OpenAPI POST body incorrectly requires client-supplied `requestNumber` and `publishedAt`. [VERIFIED: `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` and `docs/references/specification.json`]

**Primary recommendation:** Plan one security-and-contract wave first, then reusable CSRM composites, then the request list/form/detail vertical slice, then dashboard/E2E integration. Keep every authorization and workflow decision in Strapi or shared domain modules, never in presentation code. [VERIFIED: locked context and `AGENTS.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Resolve development identity | API / Backend | Frontend Server | Strapi establishes `ctx.state.idamboxUser`; the server-only web transport supplies the trusted development header. [VERIFIED: locked context] |
| Authorise and owner-scope records | API / Backend | Database / Storage | The existing policy resolves persisted grants and request ownership; URL visibility is not authority. [VERIFIED: codebase and `AGENTS.md`] |
| Generate request number | API / Backend | Database / Storage | The server creates the identifier and the existing unique constraint is the collision backstop. [VERIFIED: locked context and schema] |
| Enforce draft editing/submission | API / Backend | Frontend Server | Strapi owns the transition; the web layer validates early and communicates the result. [VERIFIED: locked context] |
| Fetch list/detail/dashboard data | Frontend Server (SSR) | API / Backend | Server Components call feature services; Strapi remains the production API and authorisation boundary. [CITED: local Next.js server/client guide; VERIFIED: `AGENTS.md`] |
| Manage form/table interaction | Browser / Client | Frontend Server (SSR) | React Hook Form, table controls, dialogs, and URL updates need event handlers; initial data stays server-rendered. [CITED: local Next.js server/client guide] |
| Persist request and relations | Database / Storage | API / Backend | Existing Strapi content types and relations are authoritative; no Phase 2 schema change is allowed. [VERIFIED: schemas and locked context] |

## Project Constraints (from AGENTS.md)

- Use Next.js App Router, strict TypeScript, Server Components by default, shadcn/ui primitives, semantic theme tokens, responsive accessible layouts, and feature-oriented reusable modules. [VERIFIED: `AGENTS.md`]
- Keep business/domain rules outside JSX and external input behind shared schemas. [VERIFIED: `AGENTS.md`]
- All production communication goes through the typed API layer to Strapi. Do not add page-level raw fetches or a frontend API facade. [VERIFIED: `AGENTS.md`]
- Keycloak proves identity in production; Strapi owns Role -> Function -> FunctionAPI and record-level authorisation. Requestor is implicit; Security Analyst is explicit. [VERIFIED: `AGENTS.md`]
- Never treat navigation visibility as authorisation or allow one Requestor to access another Requestor's restricted records. [VERIFIED: `AGENTS.md`]
- Preserve JDL terminology, record contract/model gaps, add automated tests for material workflows, and add dependencies only for a concrete need. [VERIFIED: `AGENTS.md`]
- Never commit secrets, move `node_modules`, or merge the nested Strapi Git history. [VERIFIED: `AGENTS.md`]
- Before Phase 2 implementation, read the relevant Next.js 16.3.3 documentation from `apps/web/node_modules/next/dist/docs/` because this project explicitly treats its installed documentation as authoritative. [VERIFIED: `apps/web/AGENTS.md`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard Here |
|---|---:|---|---|
| Next.js | 16.3.3 | App Router pages, Server Components, Server Actions, route state | Already installed and mandated. Pages and layouts are Server Components by default; interactivity is layered into Client Components. [VERIFIED: `apps/web/package.json`; CITED: local Next.js docs] |
| React | 19.2.4 | UI runtime | Existing pinned application runtime. [VERIFIED: `apps/web/package.json`] |
| Strapi | 5.51.0 | Production API, persistence, policies, controller workflow rules | Existing production boundary; core controllers can be extended and custom outputs must be sanitised. [VERIFIED: `apps/strapi/package.json`; CITED: https://docs.strapi.io/cms/backend-customization/controllers] |
| openapi-fetch | 0.17.0 | Typed server-only Strapi transport | Already implemented; official API accepts typed `params.path`, `params.query`, and request bodies. [VERIFIED: `apps/web/package.json`; CITED: https://openapi-ts.dev/openapi-fetch/api] |
| React Hook Form | 7.86.0 | Client form state and blur validation | Locked and already installed. [VERIFIED: `apps/web/package.json`] |
| Zod | 4.4.3 | Shared URL/form/action validation | Locked and already installed; Next.js documentation recommends schema validation on the server. [VERIFIED: `apps/web/package.json`; CITED: local Next.js forms guide] |
| @hookform/resolvers | 5.9.1 | Connect Zod to React Hook Form | Already installed; the official resolver exposes `zodResolver` with inferred input/output types. [VERIFIED: `apps/web/package.json`; CITED: https://github.com/react-hook-form/resolvers] |
| @tanstack/react-table | 9.2.4 | Headless sorting/filtering/pagination state for the locked `DataTable` composite | Official current package and documentation; markup remains under CSRM control. Pin the exact version because v9 is a recent major with a different feature API. [VERIFIED: npm registry + TanStack docs + slopcheck] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| sonner | 2.0.8 | Success/error notifications | Use after mutations; do not replace inline validation or persistent workflow status. [VERIFIED: `apps/web/package.json` and design direction] |
| lucide-react | 1.30.0 | Status/action icons | Pair every status icon with a text label. [VERIFIED: `apps/web/package.json` and design direction] |
| date-fns | 4.4.0 | Display and date input normalisation | Use only in domain/presentation adapters, not as persisted business logic. [VERIFIED: `apps/web/package.json`] |
| Vitest / Testing Library | 4.0.18 / 16.3.0 | Unit and component/workflow tests | Existing web test foundation. [VERIFIED: `apps/web/package.json` and `vitest.config.ts`] |
| Playwright | 1.58.2 | Browser journey and responsive/accessibility checks | Existing E2E foundation and installed Chromium. [VERIFIED: `apps/web/package.json`, `playwright.config.ts`, environment probe] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `@tanstack/react-table` | A bespoke table state engine | Rejected by locked context; custom sorting/filtering/pagination state would duplicate a headless library while still requiring all CSRM markup and accessibility work. [VERIFIED: locked context; CITED: https://tanstack.com/table/latest/docs/overview] |
| Native URL APIs | A URL-state package | Do not add another dependency for four scalar query fields; validate `searchParams` with Zod and update them with `URLSearchParams`/Next navigation. The no-extra-dependency rule is verified; the sufficiency of this URL shape is [ASSUMED]. [VERIFIED: `AGENTS.md`] |
| Server Actions | Route Handlers as a frontend facade | Route Handlers would violate the locked no-facade boundary; thin actions can call the same server-only feature service without creating another HTTP contract. [VERIFIED: `AGENTS.md`; CITED: local Next.js forms guide] |

**Installation:**

```bash
pnpm --dir apps/web add --save-exact @tanstack/react-table@9.2.4
```

`@tanstack/react-table@9.2.4` was published 2026-08-28; the registry reported 19,960,882 downloads for 2026-08-22 through 2026-08-28, an official TanStack repository, and no postinstall script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---:|---:|---|---|---|
| `@tanstack/react-table` | npm | Package lineage since 2022-01-19 | 19,960,882/week | `github.com/TanStack/table` | OK | Approved; official TanStack docs name the package. [VERIFIED: npm registry + TanStack docs + slopcheck] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]

**Packages flagged as suspicious [SUS]:** none. [VERIFIED: slopcheck]

## Architecture Patterns

### System Architecture Diagram

```text
Browser URL / form event
  -> Next.js App Router Server Component or thin Server Action
  -> requests feature schema + service
  -> server-only openapi-fetch client
       -> in development only: x-csrm-dev-identity header
  -> Strapi users-permissions route gate
  -> csrm-app-enabled policy
  -> csrm-authorization policy
       -> deny: 403 -> permission-denied/error state
       -> allow: trusted actor/scope in ctx.state
  -> assessment-request controller + workflow service
       -> list: inject owner filter -> results + pagination meta
       -> create: replace owner/number/status/date -> create draft
       -> update: load current record -> requestor actor?
            -> non-draft or illegal transition: 4xx, no write
            -> draft edit: persist draft
            -> draft -> submitted: stamp submittedDate, persist
  -> Strapi Document/Core Service -> SQLite/dev or production database
  -> sanitised OpenAPI response -> feature domain adapter -> UI state
```

The decision points remain on the Strapi side; a disabled button or hidden navigation item is only presentation behavior. [VERIFIED: `AGENTS.md` and existing policy architecture]

### Recommended Project Structure

```text
apps/strapi/
├── src/middlewares/csrm-development-identity.ts
├── src/bootstrap/seed-development-content-api-permissions.ts
├── src/api/csrm-assessment-request/
│   ├── controllers/csrm-assessment-request.ts
│   ├── services/request-workflow.ts
│   ├── services/request-number.ts
│   └── services/collection-scope.ts
└── tests/
    ├── helpers/strapi-http-harness.ts
    └── authorization.integration.test.ts

apps/web/
├── app/(app)/app/
│   ├── page.tsx
│   └── requests/{page.tsx,new/page.tsx,[documentId]/page.tsx,[documentId]/edit/page.tsx}
└── src/
    ├── components/csrm/{data-table,status-badge,page-header,detail-section,form-section,confirm-dialog}.tsx
    ├── features/requests/{request-domain,request-schema,request-service,request-actions,request-form,request-table}.ts(x)
    └── features/dashboard/{requestor-dashboard-service,requestor-dashboard}.ts(x)
```

Use the existing `PageHeader` implementation in `src/components/shell/app-shell.tsx` as the migration source; extract or re-export it instead of creating two competing components. [VERIFIED: codebase]

### Pattern 1: Trusted Actor Facts from the Policy

Extend the existing policy result with a minimal trusted actor classification such as `assessmentRequestActor: 'requestor' | 'analyst'`; do not make the controller reload and reinterpret roles independently. The controller can then preserve the Phase 1 analyst update behavior while imposing draft-only rules on Requestors. The state property name is [ASSUMED]. [VERIFIED: existing policy]

```typescript
// Source: existing apps/strapi/src/policies/csrm-authorization.ts pattern
ctx.state.csrmAuthorization = {
  ...ctx.state.csrmAuthorization,
  assessmentRequestActor: explicitAnalystOperation ? 'analyst' : 'requestor',
};
```

### Pattern 2: Server-Owned Create Fields

Before document creation, replace rather than trust all server-owned values: `requestor`, `requestNumber`, `requestStatus: 'draft'`, and an absent `submittedDate`. Ignore or reject client attempts consistently and test the chosen behavior. The existing owner helper already replaces `requestor`. [VERIFIED: locked context and existing ownership helper]

After the blocking Plan 02-05 decision supplies the exact display contract, generate the server-owned request number accordingly and let the database unique constraint reject collisions; retry only the recognised uniqueness error and cap retries. No human-readable, opaque, prefix, date, sequence, length, character-set, or entropy presentation is selected before that decision. [RESOLVED BY CHECKPOINT]

### Pattern 3: Separate Draft Validation from Submission Validation

Use one shared field schema for types/enums and two operation schemas: draft creation/update and submission. With the current unchanged content type, `title` is the only user-entered required field; every stricter business requirement needs an explicit product decision and matching server rule. The schema composition names are [ASSUMED]. [VERIFIED: assessment-request schema and OpenAPI]

```typescript
// Source: schema values in the repository; zodResolver pattern from official resolver docs
const requestFields = z.object({
  title: z.string().trim().min(1),
  assessmentType: z.enum(['BAU', 'Project', 'Other']).optional(),
  businessCriticality: z.enum(['Low', 'Moderate', 'High', 'Critical']).optional(),
  thirdPartyInvolvement: z.boolean().optional(),
  dueDate: z.iso.date().optional(),
  // remaining persisted optional text and relation IDs
});
```

The Server Action must parse again even if React Hook Form already passed client validation. [CITED: local Next.js forms guide; VERIFIED: `AGENTS.md`]

### Pattern 4: Server-Side Table Operations with URL State

Use URL fields `q`, `status`, `sort`, `page`, and `pageSize`; validate them in the async page `searchParams` prop, translate them to the generated OpenAPI query object, and pass rows plus total count into manual TanStack table state. Reset `page` to 1 whenever search, filters, sort, or page size changes. [CITED: local Next.js page docs; https://tanstack.com/table/latest/docs/framework/react/guide/pagination; https://docs.strapi.io/cms/api/rest/sort-pagination]

Do not combine server pagination with client-only filtering or sorting: that would operate on only the loaded page. [CITED: https://tanstack.com/table/latest/docs/framework/react/guide/sorting and https://tanstack.com/table/latest/docs/framework/react/guide/column-filtering]

```typescript
// Source: official openapi-fetch API and generated repository contract
client.GET('/csrm-assessment-requests', {
  params: {
    query: {
      _q: query.q || undefined,
      filters: query.status ? { requestStatus: { $eq: query.status } } : undefined,
      sort: `${query.sort.field}:${query.sort.direction}`,
      pagination: { page: query.page, pageSize: query.pageSize, withCount: true },
    },
  },
});
```

Add a transport test that inspects the actual request URL. `openapi-fetch` documents deep-object query serialization but warns that deeply nested arrays can require a custom serializer; Phase 2 must prove the exact Strapi syntax rather than assume it. [CITED: https://openapi-ts.dev/openapi-fetch/api]

### Pattern 5: Canonical Mutation and Returned State

Keep canonical `PUT /csrm-assessment-requests/{id}` for both Save Draft and Submit; the proposed `/api/v1/.../submit` catalogue entry is not a served OpenAPI route. Submission sends `requestStatus: 'submitted'`, but the server decides whether it is legal and supplies `submittedDate`. The UI confirms success from the returned persisted status, not from optimistic local state. [VERIFIED: OpenAPI, operation constants, catalogue, locked context]

### Pattern 6: Dashboard from Authorised Facts

Use filtered/count-aware assessment-request reads for draft/action and recently submitted widgets. Use `requestStatus === 'questionnaire-in-progress'` plus the authorised request relation for questionnaire action, avoiding a broad questionnaire collection read in this phase. That action-widget interpretation is [ASSUMED]. [VERIFIED: request status enum and relationships]

Create the recently released assessment widget as a typed stateful slot, but do not treat `approved` as `released`: the model contains approval fields and no release marker/date, while the brief distinguishes approval from release. Until the Phase 4 contract defines release, the Phase 2 service should return a genuine empty result rather than a fabricated count; acceptance of that temporary behavior is [ASSUMED]. [VERIFIED: project brief and assessment schema]

### UI Composite Contracts

| Composite | Required contract |
|---|---|
| `DataTable<T>` | Headless TanStack v9 state; sticky 40px header, 44px rows, hairline horizontal dividers, result count, filters/chips, page size and pagination; populated/loading/empty/error/permission-denied slots; mobile card/list alternative for secondary columns. [VERIFIED: locked context and design direction] |
| `StatusBadge` | Exhaustive `requestStatus` mapping; icon plus human label; semantic status tokens; `aria-label`/polite announcement when status changes. [VERIFIED: schema and design direction] |
| `PageHeader` | One page title, concise description, responsive primary action; evolve the existing shell implementation. [VERIFIED: codebase and project brief] |
| `DetailSection` / `FormSection` | Group persisted fields, one-column forms, max field width 640px, labels and inline errors. [VERIFIED: design direction] |
| `ConfirmDialog` | Focus-managed shadcn alert dialog with explicit irreversible Submit wording; submission waits for server confirmation. [VERIFIED: locked context and design direction] |
| Notifications | Mount the existing Sonner toaster once; success can auto-dismiss, mutation errors retain recovery guidance. [VERIFIED: installed component and design direction] |

### Status Mapping

| Persisted value | Label | Semantic treatment |
|---|---|---|
| `draft` | Draft | neutral document/edit icon |
| `submitted` | Submitted | info send/check icon |
| `questionnaire-in-progress` | Questionnaire in progress | warning clipboard icon |
| `risk-assessment-drafted` | Risk assessment drafted | info file icon |
| `under-review` | Under review | warning review/search icon |
| `approved` | Approved | success check icon |
| `closed` | Closed | neutral archive icon |

The values are authoritative; the icon/treatment mapping is [ASSUMED]. [VERIFIED: schema]

### Anti-Patterns to Avoid

- **Client-supplied authority fields:** never accept the requestor, request number, initial status, or submitted date as truth. [VERIFIED: locked context]
- **UI-only transition guards:** disabling Submit does not prevent a crafted `PUT`; enforce the transition in Strapi. [VERIFIED: `AGENTS.md`]
- **Role string checks in components:** use existing capabilities for presentation and the policy's trusted actor classification for server behavior. [VERIFIED: existing capability/policy architecture]
- **Broad public IAM permission:** sponsor search must not be solved by exposing `idambox-user`. [VERIFIED: locked context]
- **Client-side operations on a server page:** do not sort/filter only the currently fetched page. [CITED: TanStack sorting/filtering docs]
- **Dropping response metadata:** the table cannot show total/page counts if the scoped controller returns only `data`. [VERIFIED: current controller and requirement]
- **Manual edits to both catalogues:** edit the authoritative copy and copy complete bytes to the bootstrap copy, then compare. [VERIFIED: Phase 1 pattern]
- **Conflating approval and release:** the brief treats them as different lifecycle facts. [VERIFIED: project brief and schema]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Table state | Custom sorting/filtering/pagination reducer | `@tanstack/react-table` v9 plus URL state | Locked headless engine; retains CSRM control of markup. [CITED: TanStack docs] |
| Form orchestration | One `useState` per field and ad-hoc errors | React Hook Form + `zodResolver` + shared server parse | Existing locked stack and inferred schemas. [CITED: official resolver docs] |
| Dialog focus management | Homemade modal | Existing shadcn AlertDialog/Dialog | Focus and escape behavior already delegated to installed primitives. [VERIFIED: codebase] |
| Notifications | Custom timer/portal | Existing Sonner wrapper | Already installed and directed by the design contract. [VERIFIED: codebase] |
| Query string concatenation | Hand-authored nested Strapi URL strings | Generated `openapi-fetch` params plus a tested serializer | Keeps the contract typechecked and encoding testable. [CITED: openapi-fetch API] |
| Authorization | Client role branching or duplicated controller grant loading | Existing `csrm-authorization` policy and trusted state | Prevents drift and IDOR. [VERIFIED: codebase] |
| Request identifiers | Browser timestamps or row-count sequences | Server generator plus unique database constraint | Client values are forgeable and count-then-increment races. [ASSUMED] |

**Key insight:** Phase 2 is a workflow-boundary phase, not primarily a page-building phase. The list, form, and dashboard are trustworthy only if identity, grants, ownership, state transitions, and transport contracts are correct first. [VERIFIED: requirements and existing architecture]

## Common Pitfalls

### Pitfall 1: The Scoped Find Loses Pagination

**What goes wrong:** `DataTable` receives rows but no total, page count, or stable page behavior. [VERIFIED: current controller]

**Why it happens:** the controller calls Document Service `findMany()` and transforms only the array; the OpenAPI 200 schema also omits `meta`. [VERIFIED: controller and specification]

**How to avoid:** sanitise the public query, inject trusted scope afterward, call a service path that returns results plus pagination (or pair a scoped result query with an equivalently scoped count), return `transformResponse(results, { pagination })`, and update the contract. The exact compatible implementation is [ASSUMED] pending a controller spike. [CITED: https://docs.strapi.io/cms/backend-customization/controllers]

**Warning signs:** pagination controls show the current row count as the total, or the response has no `meta.pagination`. [VERIFIED: requirement]

### Pitfall 2: Generated Contract Still Demands Server-Owned Fields

**What goes wrong:** the typed POST call forces the web client to invent `requestNumber` and `publishedAt`. [VERIFIED: current specification/generated types]

**How to avoid:** update the authoritative OpenAPI request schema to reflect the actual extended controller, regenerate types, and keep an API drift test. Do not change the content-type schema. [VERIFIED: locked constraints]

### Pitfall 3: Requestor Can Edit After Submission

**What goes wrong:** ownership passes, so the generic core update still accepts title/body changes on a submitted record. [VERIFIED: current controller/policy behavior]

**How to avoid:** load current state after authorization and before mutation; for a Requestor reject every update unless current state is `draft`, and reject every status change except staying draft or moving to submitted. [VERIFIED: locked transition]

### Pitfall 4: Development Identity Leaks Outside Development

**What goes wrong:** an arbitrary header becomes an authentication bypass. [VERIFIED: threat model inference]

**How to avoid:** require both gates, resolve only exact seeded active email, contribute no identity on missing/unknown/duplicate lookup, and test production/test/disabled cases through the mounted router. Never forward a browser-supplied copy of this header; the server transport derives it from the server session. [VERIFIED: locked context]

### Pitfall 5: Public Role Becomes the Real Authorisation Layer

**What goes wrong:** broad users-permissions actions expose records before CSRM policy checks or expose IAM collections outright. [VERIFIED: Strapi request pipeline and locked context]

**How to avoid:** seed only exact route actions required to reach CSRM policies, attach both policies to every served CSRM route used by the frontend, and assert forbidden IAM actions are absent. [VERIFIED: locked context and existing harness]

### Pitfall 6: Sponsor Selector Violates the IAM Boundary

**What goes wrong:** implementing the proposed `Search Users` function by granting public `idambox-user.find` conflicts with the locked permission denylist. [VERIFIED: catalogue and locked context]

**How to avoid:** keep `sponsor` optional for the Phase 2 MVP and record the missing safe sponsor-search operation. Do not accept a free-text duplicate field or expose generic IdamBox users. [VERIFIED: schema and locked context]

### Pitfall 7: Mobile Table Is Desktop Overflow

**What goes wrong:** secondary columns cause horizontal page overflow at 375px. [VERIFIED: project brief]

**How to avoid:** render a compact request record-list/card presentation below the table breakpoint, preserving status, identifier, title, due/update date, and row action. The exact mobile field priority is [ASSUMED]. [VERIFIED: project brief]

### Pitfall 8: E2E Starts Only Next.js

**What goes wrong:** the current Playwright configuration starts the web server but not Strapi, so the real typed-service journey cannot run. [VERIFIED: `apps/web/playwright.config.ts`]

**How to avoid:** configure Playwright's `webServer` array for development-seeded Strapi and Next.js, with the development identity flags supplied via process environment, and retain one worker for deterministic persisted state. The exact startup orchestration is [ASSUMED]. [VERIFIED: existing config]

## Code Examples

### Fail-Closed Development Middleware Shape

```typescript
// Source: Strapi middleware docs and tests/helpers/strapi-http-harness.ts
export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) =>
  async (ctx: Context, next: Next) => {
    if (process.env.NODE_ENV !== 'development' || process.env.CSRM_DEV_IDENTITY !== 'true') {
      return next();
    }

    const email = ctx.get('x-csrm-dev-identity').trim().toLowerCase();
    if (email) {
      const matches = await strapi.documents('api::idambox-user.idambox-user').findMany({
        filters: { email: { $eq: email }, accountStatus: { $eq: 'active' } },
        limit: 2,
      });
      if (matches.length === 1) ctx.state.idamboxUser = matches[0];
    }
    await next();
  };
```

Register a global custom middleware in `config/middlewares.ts`; Strapi will not load it otherwise. [CITED: https://docs.strapi.io/cms/backend-customization/middlewares]

### Server-Side Request Form Action

```typescript
// Source: local Next.js forms guide and existing server-only transport
'use server';

export async function saveRequest(input: unknown) {
  const values = requestDraftSchema.parse(input);
  return createRequest({ data: values });
}
```

The feature service, not the action or component, owns mapping to the OpenAPI body and normalising transport errors. [VERIFIED: existing `shell-service.ts` pattern and `AGENTS.md`]

### Requestor Transition Guard Shape

```typescript
// Source: locked phase transition and Strapi Document Service update API
if (actor === 'requestor') {
  if (current.requestStatus !== 'draft') denyEdit();
  if (incoming.requestStatus && !['draft', 'submitted'].includes(incoming.requestStatus)) denyTransition();
}

const submitting = actor === 'requestor' && incoming.requestStatus === 'submitted';
const data = {
  ...allowedEditableFields(incoming),
  ...(submitting ? { requestStatus: 'submitted', submittedDate: new Date().toISOString() } : {}),
};
```

Use an allowlist mapper so the update cannot mass-assign `requestor`, `requestNumber`, `submittedDate`, `questionnaire`, or `assessment`. [CITED: OWASP ASVS input/mass-assignment guidance; VERIFIED: schema]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Familiar TanStack Table v8 `useReactTable` patterns | TanStack Table v9 feature registration and `useTable` | v9 stable published 2026-08-04 | Follow current v9 docs and pin 9.2.4; do not copy v8 examples from memory. [VERIFIED: npm registry and TanStack migration docs] |
| Next page `params`/`searchParams` treated synchronously | Async `Promise` page props | Installed Next.js 16 docs | Await both in request detail/list pages. [CITED: local Next.js page docs] |
| Strapi numeric entity IDs as the public identifier | Strapi 5 `documentId` | Strapi 5 | Use the generated `{id: string}` path with document IDs, matching the existing ownership policy. [CITED: https://docs.strapi.io/cms/api/document-service; VERIFIED: codebase] |
| Proposed `/api/v1` catalogue paths | Canonical served `/api/csrm-*` paths | Phase 1 plans 01-09/01-10 | Keep proposed entries for traceability but add exact canonical served grants used by production routes. [VERIFIED: catalogue and Phase 1 summaries] |

**Deprecated/outdated:**

- Do not use `PATCH` for assessment requests; the mounted router returns 405 and the OpenAPI contract exposes `PUT`. [VERIFIED: mounted test and OpenAPI]
- Do not implement from TanStack Table v8 examples while installing the current v9 package. [VERIFIED: npm registry and official current docs]
- Do not use client-side role labels as an authorization source. [VERIFIED: `AGENTS.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | [RESOLVED BY CHECKPOINT] No request-number display format is assumed; Plan 02-05 obtains an exact blocking human decision before generator implementation. | Architecture Pattern 2 and Open Questions resolution | Prevents an unapproved product-visible prefix, date, sequence, character set, or length from becoming contract. |
| A2 | [ASSUMED] `q`, `status`, `sort`, `page`, and `pageSize` are sufficient URL state for the MVP list. | Standard Stack / Pattern 4 | Additional filters would require URL/schema/service extension. |
| A3 | [ASSUMED] The trusted policy state property can be named `assessmentRequestActor`. | Architecture Pattern 1 | A different naming convention changes plan file references, not behavior. |
| A4 | [ASSUMED] Shared field, draft, and submit schemas are the appropriate composition. | Architecture Pattern 3 | Validation modules may be divided differently. |
| A5 | [ASSUMED] `questionnaire-in-progress` denotes a Requestor questionnaire action. | Architecture Pattern 6 | The Phase 3 response model may define a different action state. |
| A6 | [ASSUMED] A service-backed empty recently-released widget is acceptable until Phase 4 defines release semantics. | Architecture Pattern 6 | REQ-05 acceptance may demand a persisted release fact earlier. |
| A7 | [ASSUMED] The proposed icon/treatment mapping is acceptable. | Status Mapping | Product accessibility review may select different icons while keeping labels. |
| A8 | [ASSUMED] The scoped controller can use a core service pagination path after sanitisation and trusted filter injection. | Pitfall 1 | Strapi 5.51 may require a scoped result query plus scoped count. |
| A9 | [ASSUMED] Mobile request cards prioritise identifier, title, status, due/update date, and action. | Pitfall 7 | Product may require different priority fields. |
| A10 | [ASSUMED] Playwright should start both local servers through its `webServer` array. | Pitfall 8 | A repository script or global setup may prove more reliable on Windows/CI. |

## Open Questions (RESOLVED)

1. **`requestNumber` display format — DEFERRED TO BLOCKING HUMAN DECISION.** The identifier remains required, unique, and server-owned, but no authoritative source defines its display format. Plan 02-05 therefore pauses at a `checkpoint:decision` before implementation. The executor must implement the exact approved format and bounded collision handling; no prefix, date component, sequence, or entropy presentation is selected by research or planning, and count-then-increment remains prohibited. [VERIFIED: schema, locked context, and absence from authoritative references]

2. **Recently released assessment semantics — RESOLVED FOR PHASE 2.** Approval is not release. Because the current contract exposes no authoritative release fact and schema changes are prohibited, Phase 2 uses a typed honest unavailable/empty projection, records the contract gap, and does not infer release from `approved` or `approvalDate`. Phase 4 owns the release contract. [VERIFIED: operator brief, schema, and no-schema-change constraint]

3. **Sponsor selection — RESOLVED FOR PHASE 2.** Phase 2 provides no generic sponsor-directory access and omits sponsor selection from the form. The implementation records the missing least-privilege sponsor-directory contract and adds no `idambox-user` permission or route grant. [VERIFIED: operator brief, served OpenAPI, and least-privilege constraint]

4. **Submit validation — RESOLVED FOR PHASE 2.** Submission enforces only authoritative constraints already present in the persisted schema and shared generated contract; currently `title` is the only required user-entered field. No additional product completeness rule is invented unless a later locked decision supplies one. [VERIFIED: content schema and JDL precedence]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | all workspaces | Available, wrong/inconsistent version | direct probe returned 24.5.0; pnpm reported 22.19.0; root requires `>=24.19.0 <25` | Activate/install Node 24.19+ before installs and E2E. [VERIFIED: environment probe and root `package.json`] |
| npm | Strapi tests/start | yes | 11.5.1 | none needed. [VERIFIED: environment probe] |
| pnpm | web/install/root tasks | yes | 11.24.0 | none needed. [VERIFIED: environment probe and root `package.json`] |
| Chromium for Playwright | E2E | yes | Playwright browser build 1208 | `pnpm exec playwright install chromium` if cache is removed. [VERIFIED: environment probe] |
| Strapi local server | E2E | not currently listening | 5.51.0 package installed | Playwright `webServer` starts it with development seeds/bridge. [VERIFIED: environment probe and package] |
| SQLite | mounted Strapi tests/dev | yes through package | better-sqlite3 12.8.0 | none needed. [VERIFIED: package and passing mounted tests] |

**Missing dependencies with no fallback:** compliant Node 24.19+ is not active; fix before dependency installation or phase verification. [VERIFIED: environment probe]

**Missing dependencies with fallback:** local servers are intentionally not persistent and can be started by Playwright. [VERIFIED: current config]

Baseline on 2026-08-29: `apps/strapi npm test` passed 6 tests; `apps/web pnpm typecheck` passed; `apps/web pnpm test` passed 23 tests. [VERIFIED: local execution]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Backend framework | Node test runner through `apps/strapi/package.json`; mounted real Strapi router/policy/controller with isolated SQLite. [VERIFIED: codebase] |
| Web framework | Vitest 4.0.18 + jsdom + Testing Library. [VERIFIED: package/config] |
| Browser framework | Playwright 1.58.2, Chromium, one worker. [VERIFIED: package/config] |
| Backend config | `apps/strapi/tests/tsconfig.json` and `apps/strapi/tests/helpers/strapi-http-harness.ts`. [VERIFIED: codebase] |
| Web config | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`. [VERIFIED: codebase] |
| Backend quick/full command | `npm test` in `apps/strapi` (baseline about 25 seconds). [VERIFIED: local execution] |
| Web quick command | `pnpm test -- src/features/requests/<file>.test.ts[x]` in `apps/web`. [VERIFIED: Vitest CLI pattern] |
| Web full command | `pnpm typecheck && pnpm test && pnpm test:e2e` in `apps/web`. [VERIFIED: locked context] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| REQ-01 | owner-only list, search/filter/sort/page mapping, counts, five states | mounted HTTP + service/component | `npm test` in Strapi; `pnpm test -- src/features/requests/request-service.test.ts src/features/requests/request-table.test.tsx` | Existing ownership harness; new web tests are Wave 0 |
| REQ-02 | structured persisted fields, server-owned owner/number/status | mounted HTTP + form/component | `npm test`; `pnpm test -- src/features/requests/request-form.test.tsx` | Mounted create exists; new field/number tests are Wave 0 |
| REQ-03 | save/resume/edit draft; deny submitted Requestor edit | mounted HTTP + workflow component | `npm test`; `pnpm test -- src/features/requests/request-workflow.test.tsx` | New tests are Wave 0 |
| REQ-04 | validated confirm -> submit -> returned submitted status | mounted HTTP + component + E2E | `npm test`; `pnpm test -- src/features/requests/request-workflow.test.tsx`; `pnpm test:e2e -- requestor-request-workflow.spec.ts` | New tests are Wave 0 |
| REQ-05 | dashboard counts/states from typed data | service/component | `pnpm test -- src/features/dashboard/requestor-dashboard.test.tsx` | New test is Wave 0 |

### Required Backend Cases

- Development header resolves Jane and Bob only when both gates are enabled; disabled environment, disabled flag, missing header, unknown email, inactive identity, and non-development runtime reach the CSRM policy without an identity and fail closed. [VERIFIED: locked context]
- Development permission bootstrap is idempotent, grants only exact allowed `csrm-*` actions, and contains zero IAM actions. [VERIFIED: locked context]
- Create ignores/rejects forged `requestor`, `requestNumber`, `requestStatus`, and `submittedDate`, then persists a unique server-generated draft owned by Jane. [VERIFIED: locked context]
- Requestor can update a draft without changing server-owned fields; another Requestor gets 403; submitted Requestor updates persist nothing. [VERIFIED: locked context]
- Draft submission stamps a server date and returns `submitted`; repeat submission and every non-draft transition are rejected without persistence. [VERIFIED: locked context]
- Collection queries preserve owner scope even with hostile requestor filters, and response metadata matches the scoped result set. [VERIFIED: existing Phase 1 threat and REQ-01]
- Every canonical served operation appears exactly once in the catalogue, role/function links are reciprocal, and both catalogue files are byte-identical. [VERIFIED: Phase 1 test pattern]

### Sampling Rate

- **Per task commit:** targeted Vitest file for web-only work, or full `apps/strapi npm test` for any backend/catalogue change. [VERIFIED: test durations]
- **Per wave merge:** `apps/strapi npm test`; `apps/web pnpm typecheck`; `apps/web pnpm test`. [VERIFIED: locked commands]
- **Phase gate:** backend suite, web typecheck/unit suite, and full Playwright journey all green before verification. [VERIFIED: locked commands]

### Wave 0 Gaps

- [ ] Extend `apps/strapi/tests/helpers/strapi-http-harness.ts` with submitted fixtures, request persistence helpers, development-header configuration, and scoped pagination assertions. [VERIFIED: current harness gaps]
- [ ] Add backend transition/request-number/dev-middleware tests to `apps/strapi/tests/authorization.integration.test.ts` or focused mounted files included by the package script. [VERIFIED: current test script]
- [ ] Add `apps/web/src/features/requests/request-service.test.ts`, `request-table.test.tsx`, `request-form.test.tsx`, and `request-workflow.test.tsx`. [VERIFIED: files absent]
- [ ] Add `apps/web/src/features/dashboard/requestor-dashboard.test.tsx`. [VERIFIED: file absent]
- [ ] Add `apps/web/e2e/requestor-request-workflow.spec.ts` and change Playwright to start both Strapi and Next with isolated development environment values. [VERIFIED: current config gap]
- [ ] Add a generated-contract assertion for pagination metadata and server-owned create fields; keep `pnpm api:check` green. [VERIFIED: current contract gap]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | development bridge only | Two environment gates, exact active seeded identity lookup, server-derived header, fail closed. [VERIFIED: locked context] |
| V3 Session Management | yes, web development session | Existing HTTP-only same-site development cookie; only the server adapter maps it to an identity email. [VERIFIED: codebase and locked context] |
| V4 Access Control | yes, critical | Strapi Role -> Function -> FunctionAPI plus owner scope and workflow actor state on every operation. [VERIFIED: `AGENTS.md`; CITED: OWASP ASVS] |
| V5 Input Validation | yes, critical | Zod on URL/form/action input, Strapi schema validation, query sanitisation, and explicit writable-field allowlists. [CITED: OWASP ASVS; Strapi controller docs] |
| V6 Cryptography | no new cryptographic protocol | Use Node's built-in random UUID primitive only for identifier entropy; do not implement cryptography. [ASSUMED] |

### Known Threat Patterns for Next.js + Strapi

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Forged development identity header | Spoofing / Elevation | Header attached only by server transport; middleware double-gated and absent outside development; mounted fail-closed tests. [VERIFIED: locked context] |
| Requestor IDOR | Information disclosure / Tampering | Existing owner-scoped list and item policy; overwrite hostile filters and forged ownership. [VERIFIED: codebase] |
| Mass assignment of workflow fields | Tampering / Elevation | Writable-field allowlist plus server replacement of owner/number/status/date. [CITED: OWASP ASVS input validation guidance] |
| Illegal or repeated submission | Tampering | Load current persisted state, validate transition atomically with the update path, reject non-draft Requestor edits. [VERIFIED: locked context] |
| Permission bootstrap overgrant | Elevation | Exact action allowlist, CSRM-only UID prefix, explicit IAM deny assertions, dev-only gate. [VERIFIED: locked context] |
| Catalogue drift | Tampering | Authoritative-first edit, byte copy, hash/test parity, exact-once served URL assertions. [VERIFIED: Phase 1 pattern] |
| Nested query manipulation | Information disclosure / DoS | Zod bounds for page/pageSize/sort/filter, Strapi query sanitisation, server-overwritten owner scope. [CITED: Strapi controller and pagination docs] |

## Sources

### Primary (HIGH confidence)

- Repository: `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, Phase 1 plans/summaries, Strapi schemas/controllers/policies/tests, web transport/capability/tests, `specification.json`, JDL, catalogue, project brief, and design direction. [VERIFIED: codebase]
- [Strapi Controllers](https://docs.strapi.io/cms/backend-customization/controllers) - extending core controllers, sanitisation, validation, service delegation. [CITED: official docs]
- [Strapi Middlewares](https://docs.strapi.io/cms/backend-customization/middlewares) - application middleware location and configuration. [CITED: official docs]
- [Strapi Lifecycle Functions](https://docs.strapi.io/cms/configurations/functions) - bootstrap timing and seed usage. [CITED: official docs]
- [Strapi Document Service](https://docs.strapi.io/cms/api/document-service) - `documentId`, create/find/update behavior. [CITED: official docs]
- [Strapi Sort and Pagination](https://docs.strapi.io/cms/api/rest/sort-pagination) and [Filters](https://docs.strapi.io/cms/api/rest/filters) - REST query semantics. [CITED: official docs]
- [openapi-fetch API](https://openapi-ts.dev/openapi-fetch/api) - typed path/query/body params and serializer behavior. [CITED: official docs]
- [TanStack Table Overview](https://tanstack.com/table/latest/docs/overview), [Pagination](https://tanstack.com/table/latest/docs/framework/react/guide/pagination), [Sorting](https://tanstack.com/table/latest/docs/framework/react/guide/sorting), and [Filtering](https://tanstack.com/table/latest/docs/framework/react/guide/column-filtering) - headless table and consistent server-side operations. [CITED: official docs]
- Local installed Next.js 16.3.3 docs under `apps/web/node_modules/next/dist/docs/` - Server/Client Components, forms, async page props. [VERIFIED: installed official docs]
- [React Hook Form Resolvers](https://github.com/react-hook-form/resolvers) - `zodResolver` pattern. [CITED: official repository]
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) - access-control and input-validation verification basis. [CITED: official standard]

### Secondary (MEDIUM confidence)

- npm registry metadata and npm downloads API for current package versions, dates, repository, scripts, and usage. [VERIFIED: registry]
- `slopcheck 0.6.1` result for `@tanstack/react-table`: OK. [VERIFIED: local tool]

### Tertiary (LOW confidence)

- None. Every unresolved product choice is explicitly tagged `[ASSUMED]` and listed in the Assumptions Log. [VERIFIED: this document]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all packages except the new locked table package are installed; the table package was verified through official docs, npm, and slopcheck. [VERIFIED]
- Architecture: HIGH - it extends already-tested project boundaries and official framework patterns. [VERIFIED]
- Workflow rules: HIGH for draft/submitted enforcement; MEDIUM for identifier format and submit completeness because authoritative references do not define them. [VERIFIED]
- Dashboard: MEDIUM - request/questionnaire status facts exist, but released-assessment semantics do not. [VERIFIED]
- Pitfalls: HIGH - most are directly observable in the current controller, contract, permissions, and test configuration. [VERIFIED]

**What might have been missed:** production Keycloak behavior, final release semantics, sponsor-directory design, and attachment storage are intentionally outside this phase or unresolved upstream. No content-type schema alternative was researched because the phase explicitly forbids schema changes. [VERIFIED: roadmap and locked constraints]

**Research date:** 2026-08-29

**Valid until:** 2026-09-05 for package/API details; internal architecture findings remain valid until the Phase 2 contract or locked decisions change.

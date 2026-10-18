# Phase 5: Risk Register and Mitigation Management - Research

**Researched:** 2026-08-31  
**Domain:** Authorised organisation-level contextual Risk querying, aggregate detail, and mitigation-control maintenance  
**Confidence:** HIGH for codebase patterns and locked contracts; MEDIUM for database-portable semantic ordering

<user_constraints>
## User Constraints

### Locked Decisions

- Foundations are fixed and MUST NOT be replanned: token-only outer gate; triple-gated dev identity header; IdamBox csrm-authorization policy; auth-enabled routes with policy chain and exact catalogue-backed grants in BOTH byte-identical catalogue copies.
- Reuse Phase 3-4 /v1 route and typed openapi-fetch patterns, composites, dual-server Playwright harness ports 1338/3100, deterministic dev token, existing released fixture ASM-2026-33SAEN, seeded risk types and 2646 controls.
- Backend: bounded analyst-only org register list with full validated filter matrix, allowlisted sorting, honest pagination totals; full detail projection with relation IDs/labels; reuse mutation routes; parent-lock projection; no content-type schema changes; requestors receive nothing.
- Frontend: /app/risks and /app/risks/[documentId] per UI spec, five deliberate states each, mobile card fallback, assessment-created risk discoverability.
- E2E/mounted tests cover bob analyst flow, filter correctness, released read-only detail, mutable mitigation edit fixture via established dev-gated idempotent seed pattern, analyst-only access, requestor denial, pagination honesty.
- Test integrity: no sentinel/escape hatch survives GREEN. Node v24.19.0. Branch dylan-test. Conventional commits with real newlines, never push, no AI attribution, never touch live ports 1337/3000.
- Do not change content-type schemas.

### The agent's Discretion

- No additional discretion decisions were supplied beyond choosing implementation details that honor the locked contracts.

### Deferred Ideas (OUT OF SCOPE)

- Creating or deleting Risks from the register; Risk Type or reusable Control administration; CSV import; export; aggregate dashboards; standalone mitigation-control pages; and Risk close are out of scope. [VERIFIED: `05-UI-SPEC.md`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RISK-01 | A Security Analyst can search, filter, sort, and paginate contextual Risk records by status, ratings, owners, dates, assessments, systems/assets, and mitigation status. | Add a closed `GET /api/v1/risks` contract, a pure query parser, exact count/data queries, semantic severity ordering, relation filters, and URL-driven responsive list UI. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-UI-SPEC.md`, codebase inspection] |
| RISK-02 | A Security Analyst can view Risk details and maintain its mitigation-control implementation information. | Add a closed `GET /api/v1/risks/{riskId}` aggregate projection and reuse the existing PATCH/POST/PATCH/DELETE mutation workflows and parent assessment lock. [VERIFIED: `.planning/REQUIREMENTS.md`, `05-UI-SPEC.md`, existing Phase 4 routes/services] |
</phase_requirements>

## Summary

Phase 5 should be planned as a vertical extension of the Phase 4 assessment aggregate, not as a second Risk domain. `CsrmRisk` already owns every required contextual field and relates to an Assessment, Risk Type, owners, impacted system/asset, and ControlImplementations; `CsrmControlImplementation` already relates a reusable Control to one contextual Risk. No content-type schema change is needed or permitted. [VERIFIED: `docs/references/idambox-datamodel.jdl`, five Strapi content-type schemas, locked constraints]

The backend work is two new reads: a closed analyst-only `GET /api/v1/risks` register projection and a closed analyst-only `GET /api/v1/risks/{riskId}` aggregate detail. Keep all existing Phase 4 mutation routes and their serialized parent-Assessment transaction/immutability guard. The new reads must be mounted under the existing token-authenticated `/v1` boundary, run `global::csrm-app-enabled` then `global::csrm-authorization`, and require exact explicit analyst grants. [VERIFIED: `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts`, `apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts`, locked constraints]

The frontend should add a feature-oriented `risks` module and two App Router pages. The list page reads the async `searchParams` prop on the server, validates it through a shared schema, and passes canonical state to a small Client Component that only manages URL interactions. The detail page loads one complete projection before rendering anything, then reuses/extracts the Phase 4 Risk and ControlImplementation editors in the dedicated single-column interaction specified by the approved UI contract. [CITED: https://nextjs.org/docs/app/getting-started/layouts-and-pages] [VERIFIED: `05-UI-SPEC.md`, existing request and assessment pages]

**Primary recommendation:** Build one closed Risk-register query/projection boundary plus one complete Risk aggregate read, then compose the approved UI entirely from existing typed transport, authorization, form, state, and responsive table patterns. [VERIFIED: codebase inspection and locked constraints]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canonical list-query validation | API / Backend | Frontend Server | Strapi must reject unknown/invalid filters; the page parser canonicalises URLs for UX only. [VERIFIED: project authorization/input-validation rules] |
| Organisation-wide Risk scope | API / Backend | Database / Storage | Explicit FunctionAPI grant and server record scope decide visibility before query execution. [VERIFIED: `csrm-authorization.ts`] |
| Filtering, exact totals, pagination | Database / Storage | API / Backend | One validated filter expression must drive both `findMany` and `count`; the controller projects the closed result. [VERIFIED: `csrm-assessment-request/controllers/csrm-assessment-request.ts`] |
| Semantic severity/null-last ordering | Database / Storage | API / Backend | Correct global ordering must happen before pagination; lexical/client sorting is incorrect. [VERIFIED: `05-UI-SPEC.md`] |
| URL/filter interaction | Browser / Client | Frontend Server | The URL is the UI source of truth, while the server page performs data loading from its `searchParams` prop. [CITED: https://nextjs.org/docs/app/api-reference/functions/use-search-params] |
| Risk register/detail rendering | Frontend Server (SSR) | Browser / Client | Server Components own reads and deliberate route states; clients are limited to filters/forms. [VERIFIED: AGENTS.md and existing App Router pages] |
| Risk/mitigation mutation | API / Backend | Database / Storage | Existing services re-resolve ancestry and lock the parent Assessment in one transaction. [VERIFIED: `risk-workflow.ts`, `control-implementation-workflow.ts`, `assessment-workflow.ts`] |
| Parent immutable/read-only decision | API / Backend | Frontend Server | Complete release facts and malformed partial facts are server-owned; UI consumes, never infers, the projection. [VERIFIED: Phase 4 workflow and `05-UI-SPEC.md`] |

## Project Constraints (from AGENTS.md)

- Use Next.js App Router and strict TypeScript; prefer Server Components and use Client Components only when interaction requires them. [VERIFIED: `AGENTS.md`]
- Use shadcn/ui and semantic theme tokens; never hard-code BProton colours; support mobile and desktop. [VERIFIED: `AGENTS.md`]
- Keep business/domain logic outside JSX and call Strapi only through the typed API layer. [VERIFIED: `AGENTS.md`]
- Validate external input with shared schemas and enforce authorization server-side; navigation visibility is not authorization. [VERIFIED: `AGENTS.md`]
- Keycloak authenticates while Strapi enforces Role -> Function -> FunctionAPI and record-level authorization; Requestor is implicit and Security Analyst explicit. [VERIFIED: `AGENTS.md`]
- Preserve JDL terminology and document contract gaps rather than creating competing entities. [VERIFIED: `AGENTS.md`]
- Add automated tests for every material workflow and introduce no dependency without a concrete reason. [VERIFIED: `AGENTS.md`]
- Keep Strapi as the production API boundary; do not add a frontend API facade or raw fetch in pages. [VERIFIED: `AGENTS.md`]
- Never commit secrets, move `node_modules`, or merge nested Strapi Git history silently. [VERIFIED: `AGENTS.md`]

## Standard Stack

No new package is required. Use the installed, locked project stack. [VERIFIED: `package.json`, `apps/web/package.json`, `apps/strapi/package.json`]

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.3.3 | App Router pages, Server Components, route state | Project standard and required by AGENTS.md. [VERIFIED: `apps/web/package.json`] |
| React | 19.2.4 | Interactive filter/editor components | Existing web runtime. [VERIFIED: `apps/web/package.json`] |
| TypeScript | 5.9.3 | Strict shared types and generated API client | Existing strict toolchain. [VERIFIED: `apps/web/package.json`, `tsconfig.json`] |
| Strapi | 5.51.0 | Authoritative API, policy, document queries, transactions | Fixed production API boundary. [VERIFIED: `apps/strapi/package.json`, AGENTS.md] |
| openapi-fetch | 0.17.0 | Typed server-only Strapi calls | Existing Phase 3-4 transport pattern. [VERIFIED: `apps/web/package.json`, `assessment-service.ts`] |
| Zod | 4.4.3 | Closed URL/response/mutation parsing | Existing external-input validation standard. [VERIFIED: `apps/web/package.json`, `assessment-schema.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack React Table | 9.2.4 | Manual sorting/pagination through `DataTable` | Risk desktop table only; retain server authority. [VERIFIED: `data-table.tsx`, `apps/web/package.json`] |
| React Hook Form | 7.86.0 | Risk and mitigation editors | Reuse/extract existing Phase 4 editors. [VERIFIED: `risk-editor.tsx`, `control-implementation-editor.tsx`] |
| Vitest | 4.0.18 | Web unit/component tests | Schemas, services, filters, editors, five states. [VERIFIED: `apps/web/package.json`] |
| Playwright | 1.58.2 | Dual-server acceptance journey | Bob/Jane, responsive, filters, persistence, denial. [VERIFIED: environment probe and `playwright.config.ts`] |
| Node test runner | Node 24.19.0 | Strapi unit/mounted integration tests | Existing backend test script. [VERIFIED: environment probe and `apps/strapi/package.json`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `DataTable` | New grid/table library | Rejected: would duplicate density, manual server paging, mobile cards, skeletons, and state slots. [VERIFIED: `data-table.tsx`, locked UI contract] |
| Existing Phase 4 editors/workflows | New Risk forms and mutation endpoints | Rejected: risks divergent allowlists, release locks, and terminology. [VERIFIED: existing workflows and UI contract] |
| URL-driven state | Client-only store | Rejected: loses shareability/server loading and contradicts the approved canonical parameter contract. [VERIFIED: `05-UI-SPEC.md`] |
| Database ordering | Sort the current page in JavaScript | Rejected: produces incorrect results across page boundaries. [VERIFIED: pagination semantics] |

**Installation:** none. Do not edit package manifests or the lockfile for this phase. [VERIFIED: locked constraints and existing stack]

## Package Legitimacy Audit

Not applicable: Phase 5 should install no external package. The existing package set is sufficient. [VERIFIED: stack/codebase inspection]

## Existing Contract and Catalogue Facts

| Item | Current state | Planning consequence |
|------|---------------|----------------------|
| `GET /v1/risks` | Present in the FunctionAPI catalogue as `function.risk_register.risk_register.api.01`, but absent from OpenAPI and mounted routes. [VERIFIED: parsed catalogue/spec/routes] | Add one route/operation/schema and extend parity tests; do not invent another URL. |
| `GET /v1/risks/{riskId}` | Present in the catalogue as `function.risk_register.risk_details.api.01`; the OpenAPI path currently contains PATCH only. [VERIFIED: parsed catalogue/spec] | Add GET beside PATCH and preserve the existing PATCH operation unchanged. |
| Risk mutations | POST assessment Risk, PATCH Risk, and mitigation GET/POST/PATCH/DELETE already exist under `/v1`. [VERIFIED: OpenAPI and route files] | Reuse services/actions; Phase 5 adds no Risk create/delete/close affordance. |
| Catalogue copies | `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` currently share SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`. [VERIFIED: `Get-FileHash`] | If either file changes, copy bytes exactly and retain the byte-comparison test; the two new reads already have exact catalogue entries, so content changes should not be necessary. |
| Requestor grants | Requestor has no grant for either register read; the descendant mitigation GET remains separately owner-scoped for released assessment viewing. [VERIFIED: effective catalogue parse and contract test] | New register endpoints must reveal nothing to Requestors without breaking the existing released-assessment descendant flow. |
| Generated client | `apps/web/src/lib/api/generated/schema.d.ts` is generated from `docs/references/specification.json`. [VERIFIED: `apps/web/package.json`] | Edit OpenAPI, run `pnpm --filter @csrm/web api:generate`, never hand-edit generated output. |

### Requirement-to-Model Interpretation

`CsrmRisk` has no independent `riskStatus` field. It has `treatmentStatus`, while ControlImplementation has `controlStatus`; the approved UI matrix therefore implements the RISK-01 “status” dimension as `treatmentStatus` and the mitigation dimension as ControlImplementation status. Do not invent a competing Risk status or change the content schema. [VERIFIED: JDL, Strapi schemas, `05-UI-SPEC.md`]

### Contract Gap: RISK-01 broad date-filter wording

RISK-01 and the Phase 5 roadmap success criteria broadly mention filtering by dates/date fields. The later, more specific locked Phase 5 filter matrix and binding UI contract intentionally omit date-range parameters. This is an unresolved upstream product-contract mismatch, not evidence that display or sorting is a date filter. Phase 5 delivers the complete user-authorized matrix only: search; treatment status, inherent rating, residual rating, risk owner, treatment owner, related assessment, impacted system, impacted asset, and mitigation-control status filters; the UI-SPEC sort allowlist; and pagination. It does not deliver a date filter. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `05-UI-SPEC.md`, locked Phase 5 scope]

The exact delivered date behavior is: `targetDate` is projected and displayed; `targetDate` is an allowlisted globally correct sort in both directions with nulls last; and overdue treatment is derived and displayed exactly as `05-UI-SPEC.md` defines. The backend closed query rejects unknown date-range parameters including `targetDateFrom` and `targetDateTo`; the browser canonicalizer discards them and the typed transport/OpenAPI contract cannot serialize them. Tests must prove those negative boundaries and must not introduce date controls, query parameters, or competing model fields. The mismatch is also recorded in `docs/contract-gaps/phase-05-risk-register-date-filter.md`. RISK-01 traceability in Phase 5 therefore means full coverage of the user-authorized Phase 5 contract while the broader upstream date-filter wording remains explicit product-contract debt. [VERIFIED: `AGENTS.md`, `05-UI-SPEC.md`]

## Architecture Patterns

### System Architecture Diagram

```text
Browser URL /app/risks?... or /app/risks/{documentId}
  -> Next.js Server Component validates URL/path
  -> server-only openapi-fetch service + API token (+ dev identity only under gates)
  -> Strapi content-api-token authentication
  -> global::csrm-app-enabled
  -> global::csrm-authorization exact FunctionAPI grant
       -> Requestor / missing explicit analyst grant -> safe 403, no record clues
       -> explicit analyst risk-register scope -> controller
            -> closed query parser -> count + paged data -> closed register DTO
            -> aggregate loader -> parent release validation -> closed detail DTO
            -> existing mutation workflow -> parent Assessment lock/transaction
                 -> mutable -> commit and authoritative reload
                 -> released/partial/changed ancestor -> safe 409 -> UI refreshes detail
```

This preserves the existing service boundaries and makes the API, not navigation, authoritative. [VERIFIED: AGENTS.md, existing route/policy/service chain]

### Recommended Project Structure

```text
apps/strapi/src/api/csrm-risk/
├── operations.ts                         # add list/detail operation constants
├── routes/csrm-risk.ts                   # mount the two authenticated reads
├── controllers/csrm-risk.ts              # safe envelopes, projection only
└── services/
    ├── risk-register-query.ts            # pure closed parser/query builder
    ├── risk-register.ts                  # count/page/detail load + projections
    └── risk-workflow.ts                  # existing mutations; reuse, minimal extraction

apps/web/src/features/risks/
├── risk-schema.ts                        # URL and closed DTO schemas
├── risk-service.ts                       # openapi-fetch reads and reused command wrappers
├── risk-actions.ts                       # server actions/revalidation/409 reload
├── risk-register.tsx                     # table/mobile state composition
├── risk-register-filters.tsx             # URL interaction only
├── risk-details.tsx                      # five sections and state router
├── risk-detail-editor.tsx                # dedicated single-column reuse/extraction
└── mitigation-control-list.tsx           # inline add/edit/remove and read-only mode

apps/web/app/(app)/app/risks/
├── page.tsx
├── loading.tsx
├── error.tsx
└── [documentId]/
    ├── page.tsx
    ├── loading.tsx
    ├── error.tsx
    └── not-found.tsx                     # only if it remains indistinguishable from denied
```

These locations follow existing `features/assessments`, `features/requests`, and App Router analogs. [VERIFIED: codebase file map]

### Component and Code Analog Map

| New responsibility | Closest analog(s) | Reuse instruction |
|--------------------|-------------------|-------------------|
| Query parse/count/page | `collection-scope.ts`, assessment-request controller | Copy the closed-parser + same-filter `count/findMany` architecture, not its field set. [VERIFIED: codebase] |
| URL table state | `request-schema.ts`, `request-table.tsx`, `questionnaire-pagination.tsx` | Preserve `router.replace(..., {scroll:false})`, page reset, out-of-range correction, and honest totals. [VERIFIED: codebase] |
| Typed reads | `assessment-schema.ts`, `assessment-service.ts` | Parse over-populated transport into closed feature DTOs and return normalized transport errors. [VERIFIED: codebase] |
| Full Risk fields | `assessment-scope.ts::projectAnalystRiskDetail` | Reuse the frozen Risk field inventory but replace relation IDs with bounded ID/label summaries required by detail. [VERIFIED: codebase/UI spec] |
| Risk form | `risk-editor.tsx` | Extract shared fields/changed-value projection; provide the UI-spec single-column layout and discard/focus behavior. [VERIFIED: codebase/UI spec] |
| Mitigation editor | `control-implementation-editor.tsx` | Preserve allowlist/delta/ConfirmDialog workflow; update exact removal copy and inline dedicated-detail behavior. [VERIFIED: codebase/UI spec] |
| Parent lock | `isReleased`, `assertMutableAssessment`, `withMutableAssessmentMutation` | Server returns mutable/released only for a complete valid aggregate; partial release facts abort the load into a safe no-data error, and the client never reconstructs release state. [VERIFIED: `assessment-workflow.ts`] |
| Five states | `assessment-editor.tsx`, `request-table.tsx`, shared state/composites | Keep PageHeader in every state and never render partial aggregate data. [VERIFIED: UI spec] |
| E2E harness | `playwright.config.ts`, `assessment-release-workflow.spec.ts` | Reuse ports 1338/3100, isolated process DB/dist, deterministic token, Bob/Jane contexts. [VERIFIED: codebase/locked constraints] |

### Pattern 1: One Closed Register Query Model

Accept only the exact flat UI parameters: `q`, `treatmentStatus`, `inherentRating`, `residualRating`, `riskOwner`, `treatmentOwner`, `assessment`, `system`, `asset`, `mitigationStatus`, `sort`, `page`, and `pageSize`. Reject arrays, duplicate/unknown keys, invalid enum values, invalid directions, out-of-range integers, and overlong text/opaque IDs with the existing safe 400 envelope. [VERIFIED: `05-UI-SPEC.md`; pattern from `collection-scope.ts`]

| Parameter | Backend expression |
|-----------|--------------------|
| `q` | Trimmed, bounded case-insensitive OR over `riskNumber` and `riskStatement`. [CITED: https://docs.strapi.io/cms/api/document-service/filters] |
| Ratings/status | Exact `$eq` against closed JDL/UI values. [VERIFIED: JDL and UI spec] |
| Owners/assessment/system/asset | Deep relation `documentId` equality after opaque-ID validation. [CITED: https://docs.strapi.io/cms/api/document-service/filters] |
| Mitigation status | Deep ControlImplementation status match; the dedicated `none` value must use an absence predicate/`NOT EXISTS`, not `status = null`. [VERIFIED: JDL relationship and UI spec] |
| Pagination | `start=(page-1)*pageSize`, `limit=pageSize`; only 10, 25, 50, default 25. [CITED: https://docs.strapi.io/cms/api/document-service/sort-pagination] |
| Default sort | `targetDate:asc`, nulls last, then `riskNumber:asc` as deterministic tie-breaker. [VERIFIED: UI spec] |

Build `countQuery` and `dataQuery` from one parsed filter object and execute them together. Never calculate `total` from page length. [VERIFIED: assessment-request controller analog]

### Pattern 2: Isolate Semantic Ordering Before Pagination

Normal text/date/relation sorts can use Strapi sort expressions with a stable Risk-number tie-breaker. Rating sorts must map Low=1, Moderate=2, High=3, Critical=4, and target dates must place null after dated records in both directions as required by the UI contract. [VERIFIED: `05-UI-SPEC.md`]

Because the content model has no stored numeric severity and schema changes are forbidden, isolate rating/null ordering in a small repository using the existing Strapi database/Knex query boundary, bind every value, select only authorised matching document IDs for the requested page, then hydrate/project those IDs through Strapi. [ASSUMED] This is the only identified implementation area that depends on database-specific ordering semantics; cover SQLite now and add a Phase 8 portability check for the selected production database. [ASSUMED]

Do not fetch the whole register to sort in memory. The project brief explicitly forbids fetching an entire large register for one page. [VERIFIED: `docs/CSRM-PROJECT-BRIEF.md`]

### Pattern 3: Complete Aggregate Detail Projection

Return a single closed DTO containing all five UI groups in one response so relation or mitigation failures cannot create partial disclosure. [VERIFIED: `05-UI-SPEC.md`]

The projection should contain:

- Every frozen non-server-owned Risk field already enumerated by `RISK_DETAIL_FIELDS`, plus `documentId` and `riskNumber`. [VERIFIED: `assessment-scope.ts`]
- `riskType: {documentId,name,description} | null`; owners as `{documentId,displayName} | null`; system/asset as `{documentId,name} | null`. [VERIFIED: JDL relations and UI spec]
- `assessment: {documentId,assessmentNumber,title}` where title comes through `assessment.assessmentRequest.title`. [VERIFIED: JDL and assessment-request model]
- `controlImplementations[]` with reusable Control `{documentId,controlNumber,name}`, owner label, status, effectiveness, evidence, and dates. [VERIFIED: JDL and UI spec]
- A server-owned parent lock discriminant on successful detail data: `mutable` or `released`. `released` requires the complete approved/approvedBy/approvalDate fact; any partial fact fails the complete aggregate load and returns no Risk projection. [VERIFIED: `isReleased`, `assertMutableAssessment`, Phase 4 decisions]

Use bounded `+1` probes for descendants before projection, following the existing 1,000-Risk assessment aggregate pattern. [VERIFIED: `loadAnalystAssessmentRiskDetails`]

Link the related Assessment to the existing authorised analyst assessment route. Render system/asset as labelled values in Phase 5 because their dedicated application detail routes belong to Phase 6; do not create dead links or pull administration pages forward. [VERIFIED: ROADMAP, current App Router file map, UI spec]

### Pattern 4: Distinct Risk-Register Authorization Scope

Add a policy config such as `requireAnalystRiskRegisterScope` that can only be set by an explicit Security Analyst operation grant, then set `csrmAuthorization.riskRegisterCollectionScope = "all"`. The query/detail services must assert that scope rather than relying on presentation capability or caller query input. [VERIFIED: `requireAnalystRequestCollectionScope` precedent; exact new operation grants]

Both new routes use `auth: { strategies: ["content-api-token"] }` and the standard two-policy chain. Do not add the controller actions to any users-permissions public-role allowlist; `reconcile-development-public-permissions.ts` proves the project has moved to the token-only outer gate. [VERIFIED: routes, reconciliation code, locked constraints]

At the web route, resolve the current session capabilities and apply `requireCapability('risk:manage', granted)` before calling the Risk service. Render the approved permission state on presentation denial, while mounted API tests separately prove that changing URLs or bypassing navigation cannot bypass Strapi. [VERIFIED: `server-guard.ts`, navigation config, project authorization rules]

### Pattern 5: Reuse Mutations and Refresh on Parent-Lock Conflict

Keep these exact routes and workflow services: PATCH `/v1/risks/{riskId}`, POST `/v1/risks/{riskId}/control_implementations`, PATCH/DELETE `/v1/control_implementations/{implementationId}`. They already resolve references, re-check exact ancestry under the serialized Assessment transaction, and reject immutable parents. [VERIFIED: route/service inspection]

New Risk-page server actions should submit changed allowlisted fields only and revalidate `/app/risks/{riskId}`. On a 409, immediately reload the new aggregate detail; if it is now released, discard edit state and render the exact read-only UI. This implements the UI contract without weakening the existing safe error envelope. [VERIFIED: UI spec; existing mutation behavior]

### Pattern 6: URL-Driven Server Data, Client Interaction Only

The page should `await searchParams`, parse/canonicalise it, and load the list in the Server Component. `RiskRegisterFilters` may use `useSearchParams`, `usePathname`, and `useRouter().replace` to update the URL without scrolling; `useSearchParams` is a Client Component hook and the server page prop is the recommended source when parameters load database data. [CITED: https://nextjs.org/docs/app/getting-started/layouts-and-pages] [CITED: https://nextjs.org/docs/app/api-reference/functions/use-search-params]

Unknown list-state parameters are discarded, search submits on Enter/button, categorical filters apply on selection, and filter/sort/page-size changes reset page to 1. Preserve sort/pageSize when clearing filters. [VERIFIED: UI spec]

### Pattern 7: Idempotent Mutable Development Fixture

Add a dedicated risk-register seed after the existing core/questionnaire/assessment seeds. Gate it with `IDAMBOX_SEED_CSRM=true` and `developmentIdentityEnabled()` (NODE_ENV, CSRM_ENVIRONMENT, and CSRM_DEV_IDENTITY), and reconcile by stable request/assessment/Risk domain keys rather than counts. [VERIFIED: `seed-questionnaire-workflow.ts`, `seed-assessment-workflow.ts`, `development-identity-enabled.ts`]

The seed should create/repair one Bob-editable, unreleased Assessment aggregate with at least one Risk and contextual ControlImplementation referencing the existing 2,646-Control library. Test fresh, repeated, and repair runs. Do not modify or replace the locked released fixture `ASM-2026-33SAEN`. [VERIFIED: locked constraints; seed test precedents]

## Register Response Contract

Use named, closed OpenAPI schemas; do not return generic Strapi documents. [VERIFIED: Phase 3-4 contract convention]

```typescript
type RiskRegisterItem = {
  documentId: string;
  riskNumber: string;
  riskStatement: string;
  inherentRating: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  residualRating: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  treatmentStatus: 'Not Started' | 'In Progress' | 'Overdue' | 'Complete' | null;
  treatmentOwner: { documentId: string; displayName: string } | null;
  targetDate: string | null;
  assessment: { documentId: string; assessmentNumber: string; title: string };
};

type RiskRegisterResponse = {
  data: RiskRegisterItem[];
  meta: {
    pagination: { page: number; pageSize: 10 | 25 | 50; pageCount: number; total: number };
    selectedLabels: Record<string, { documentId: string; label: string } | null>;
  };
};
```

The `selectedLabels` projection is recommended so deep-linked active chips retain authorised human labels even when the selected relation has no row on the current page. [ASSUMED] Keep it bounded to the requested relation IDs and closed keys. [ASSUMED]

## Relationship Option Strategy

| Picker | Use |
|--------|-----|
| Risk/Treatment owner | Existing bounded `GET /v1/users?search={query}` and `OwnerCombobox` behavior. [VERIFIED: OpenAPI/routes/web] |
| Assessment | Existing analyst `GET /v1/risk_assessments` inventory for initial options; use assessment number as the stable label and preserve requested label through list metadata. [VERIFIED: existing list DTO; UI permits relation labels] |
| System/asset | Existing typed `/csrm-information-systems` and `/csrm-information-assets` reads with bounded page size/filter wrapper; do not issue raw fetch. [VERIFIED: request service and generated contract] |
| Reusable Control | Existing bounded `GET /v1/controls` inventory (current service cap 5,000; seed contains 2,646) filtered in the dedicated searchable picker. [VERIFIED: `listControlDocuments`, seed tests] |

If mounted tests prove an existing inventory cap can omit a selected relation, add a catalogue-backed bounded option operation rather than silently client-filtering an incomplete list. [VERIFIED: UI prerequisite]

## Anti-Patterns to Avoid

- **Generic Strapi Risk CRUD:** It permits caller-shaped populate/filter behavior and bypasses the closed `/v1` projection. Use custom controller/services. [VERIFIED: established Phase 3-4 pattern]
- **Client-side full-register filtering/sorting:** It breaks totals, semantic order, authorization boundaries, and scale. [VERIFIED: requirements/project brief]
- **Alphabetical rating sort:** `Critical, High, Low, Moderate` is not the required severity order. [VERIFIED: UI spec]
- **`page.length` as total:** It lies whenever another page exists. Use `documents.count` with identical filters. [VERIFIED: assessment-request controller]
- **Inferring release from status text:** Require the complete release fact; partial facts fail closed. [VERIFIED: Phase 4 workflow]
- **Rendering disabled mutation controls:** Released details require a purpose-built read-only presentation with zero mutation affordances. [VERIFIED: UI spec]
- **Returning relation objects wholesale:** Project only required IDs/labels; do not leak emails, numeric IDs, audit fields, or nested records. [VERIFIED: existing projection conventions]
- **Parallel detail fetches that render partially:** Load/project one aggregate or show the route error/permission state. [VERIFIED: UI spec]
- **Reusing the broad two-column Phase 4 editor unchanged:** Extract field/schema logic and render the specified single-column dedicated-detail form. [VERIFIED: UI spec/current editor]
- **Adding standalone mitigation routes/pages:** Explicitly out of scope. [VERIFIED: UI spec]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table engine | Custom grid/pager/density storage | Existing `DataTable` | Already supplies manual server state, density, mobile fallback, skeletons, filters, and state slots. [VERIFIED: component inspection] |
| API client | Raw fetch wrapper | Generated `openapi-fetch` client | Maintains contract drift detection and server-only headers. [VERIFIED: AGENTS.md/transport] |
| Validation | Ad hoc query/body checks in JSX | Pure backend parser + Zod web schemas | Creates one closed, testable input boundary. [VERIFIED: project rules/patterns] |
| Authorization | Role checks/navigation hiding | `csrm-authorization` exact grants + asserted scope | Strapi is authoritative and Requestor birthright must not bleed into analyst inventory. [VERIFIED: policy/AGENTS.md] |
| Release lock | Client status check | Existing parent Assessment lock/transaction | Covers races, partial facts, and descendant ancestry. [VERIFIED: workflow services] |
| Risk/mitigation forms | New field inventories | Existing writable-field schemas and delta projection | Prevents contract divergence across assessment and register editing. [VERIFIED: Phase 4 schemas/editors] |
| Dialog/focus primitives | Custom modal | Existing shadcn/Radix and `ConfirmDialog` | Existing accessibility/focus behavior and approved UI registry. [VERIFIED: UI spec/components] |
| Date presentation | Locale-sensitive implicit parsing | Existing UTC date-only formatter pattern | Avoids timezone drift and meets `en-AU` contract. [VERIFIED: UI spec/Phase 4 decision] |

**Key insight:** The deceptively hard parts—authorization, exact totals, semantic ordering, aggregate release locking, and mutation allowlists—already have authoritative homes; Phase 5 should expose and compose them rather than duplicate them in feature JSX. [VERIFIED: codebase architecture]

## Common Pitfalls

### Pitfall 1: Count and Data Queries Drift

**What goes wrong:** The table shows a total that does not match filtered pages.  
**Why it happens:** Relation/mitigation filters are added to `findMany` but not `count`, or joins duplicate Risk rows.  
**How to avoid:** Derive both queries from one parsed filter representation; assert totals across multi-control Risks and `none` mitigation status. [VERIFIED: existing count pattern and JDL cardinality]  
**Warning signs:** Page count changes when page size changes, or a Risk with two matching controls counts twice.

### Pitfall 2: Severity and Null Ordering Happens After Pagination

**What goes wrong:** Each page looks sorted but the register is globally wrong.  
**Why it happens:** The current page is sorted in JavaScript after database pagination.  
**How to avoid:** Apply rank/null ordering in the database before limit/offset and add cross-page tests for all four ratings plus nulls. [VERIFIED: UI sort contract]  
**Warning signs:** Low appears before Critical on later pages or null target dates occupy page 1.

### Pitfall 3: Birthright Requestor Grant Leaks into Register Reads

**What goes wrong:** A Requestor receives a count, empty result, or detail clue.  
**Why it happens:** Code checks “any effective grant” or reuses the actor flag without a register-specific explicit-analyst scope.  
**How to avoid:** Require the exact analyst register FunctionAPI and test Jane with valid token/header against list and multiple detail identifiers. [VERIFIED: authorization model]  
**Warning signs:** Requestor receives 200/404 instead of the same safe denial.

### Pitfall 4: Detail Mutability Is Inferred Client-Side

**What goes wrong:** A released or partially released aggregate briefly exposes editors or accepts a stale action.  
**Why it happens:** UI checks only `assessmentStatus`.  
**How to avoid:** Project the parent lock from the authoritative aggregate, fail partial facts closed, retain transaction re-check, and reload on 409. [VERIFIED: Phase 4 workflow/UI spec]  
**Warning signs:** Disabled controls appear, or a 409 leaves the form editable.

### Pitfall 5: Relation Labels Disappear on Deep Links

**What goes wrong:** Active chips show opaque document IDs after refresh.  
**Why it happens:** The selected option is outside the current bounded search result.  
**How to avoid:** Resolve only selected relation IDs server-side and return closed labels, or use an exact authorised lookup. [ASSUMED]  
**Warning signs:** Filter chips change labels when results or searches change.

### Pitfall 6: Existing Editors Are Reused Visually but Not Semantically

**What goes wrong:** Wrong removal copy, two-column dedicated detail, missing discard/focus behavior, or a native 2,646-option select.  
**Why it happens:** Importing Phase 4 editors unchanged is mistaken for reuse.  
**How to avoid:** Extract shared allowlists/delta/action logic and implement the approved detail-specific composition. [VERIFIED: UI spec/current editors]  
**Warning signs:** UI contract copy tests fail or the page is unusable at 375px/keyboard-only.

### Pitfall 7: OpenAPI, Routes, Generated Types, and Catalogue Lose Parity

**What goes wrong:** A route works locally but typed clients or effective grants disagree.  
**Why it happens:** One of the four representations is updated alone.  
**How to avoid:** Extend `contract-catalogue.integration.test.ts` to assert operationId, safe errors, closed schemas, generated paths, exact grants, Requestor absence, and catalogue byte equality. [VERIFIED: existing Phase 4 parity test]  
**Warning signs:** Hand edits in `schema.d.ts` or different catalogue hashes.

### Pitfall 8: Seed Pollutes Production or Duplicates on Restart

**What goes wrong:** Test aggregates appear outside development or multiply on every bootstrap.  
**Why it happens:** Only `IDAMBOX_SEED_CSRM` is checked or records are reconciled by count.  
**How to avoid:** Use the full development identity gate and stable domain keys; test fresh/repeat/repair. [VERIFIED: established seed pattern]  
**Warning signs:** second bootstrap changes counts or `NODE_ENV=production` creates fixtures.

## Code Examples

Verified/adapted patterns for planning; exact field lists belong in shared modules, not controllers.

### Honest Count and Page

```typescript
// Source: apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
const { dataQuery, countQuery, pagination } = buildRiskRegisterQuery(ctx.query, ctx.state);
const [documents, total] = await Promise.all([
  risks.findMany(dataQuery),
  risks.count(countQuery),
]);
return {
  data: documents.map(projectRiskRegisterItem),
  meta: {
    pagination: {
      ...pagination,
      pageCount: Math.ceil(total / pagination.pageSize),
      total,
    },
  },
};
```

### Canonical URL Replacement

```typescript
// Source: apps/web/src/features/requests/request-table.tsx
const pathname = usePathname();
const router = useRouter();
const current = useSearchParams();

function navigate(nextQuery: RiskRegisterQuery) {
  const params = serializeRiskRegisterQuery(new URLSearchParams(current.toString()), nextQuery);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}
```

### Server-Owned Release Discriminant

```typescript
// Source: apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
function parentLock(assessment: unknown): 'mutable' | 'released' {
  if (isReleased(assessment)) return 'released';
  assertMutableAssessment(assessment);
  return 'mutable';
}
```

The detail loader must catch the mutable assertion failure caused by partial release facts at the aggregate boundary and return the safe complete-load error/not-available envelope with no Risk projection. `invalid` is never serialized as a populated-detail discriminant; successful detail data contains only `parentLock: mutable|released`. [VERIFIED: Phase 4 fail-closed decision and approved five-state UI contract]

## State of the Art

| Old/insufficient approach | Current Phase 5 approach | Evidence/Impact |
|---------------------------|--------------------------|-----------------|
| Generic `/csrm-risks` CRUD | Closed catalogue-backed `/v1/risks` list/detail projections | Prevents caller-driven over-population and aligns generated DTOs. [VERIFIED: Phase 3-4 architecture] |
| Client query object as authority | App Router async `searchParams` for server data plus URL interaction client | Matches current Next.js guidance and shareable state. [CITED: https://nextjs.org/docs/app/getting-started/layouts-and-pages] |
| Status-only read-only inference | Complete server release fact plus transaction guard | Partial facts and races fail closed. [VERIFIED: Phase 4 workflow] |
| Full inventory/page client sort | Database filter/order/count before pagination | Required for honest scalable register semantics. [VERIFIED: project brief/UI spec] |
| Separate assessment/register editors | Shared schema/action logic with route-specific composition | Maintains one allowlist without reproducing Phase 4's broad layout. [VERIFIED: UI spec] |

**Deprecated/outdated for this project:** users-permissions public action grants for development API access are historical and actively removed; all Phase 5 routes retain content-api-token authentication. [VERIFIED: `reconcile-development-public-permissions.ts`, locked constraints]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An isolated Strapi database/Knex repository can implement the required CASE/null-last ordering for the Phase 5 SQLite boundary without a schema field. | Pattern 2 | Production-dialect portability remains unproven until the mandatory Phase 8 dialect contract test. |
| A2 | Returning bounded selected relation labels in register metadata is the simplest way to preserve deep-linked chip labels. | Register response | The planner may instead need an existing exact lookup/option route; security properties remain the same. |
| A3 | Existing assessment/system/asset/control inventories are accepted for Phase 5 option discovery when wrapped with bounded typed services, selected labels, and explicit +1/cap-overflow failures. | Relationship options | If a real inventory exceeds a bound, the UI fails explicitly and a later exact catalogue-backed option operation is required; silent omission is forbidden. |

## Open Questions (RESOLVED)

1. **Semantic-ordering database boundary — RESOLVED for Phase 5.**
   - Phase 5 supports and tests the isolated SQLite execution boundary. Encapsulate Low/Moderate/High/Critical rank and bidirectional null-last target-date ordering behind one bound-value repository, with deterministic riskNumber tie-breaks and cross-page acceptance tests before hydration. No schema field or whole-register in-memory sort is permitted. [VERIFIED: Phase 5 harness, locked no-schema constraint, UI ordering contract]
   - Production-dialect selection and portability validation are explicitly a Phase 8 obligation. When the production database is selected, Phase 8 must run the same semantic-rank, null-last, tie-break, and cross-page contract against that dialect before production acceptance; Phase 5 does not claim PostgreSQL/MySQL portability from SQLite evidence. [VERIFIED: ROADMAP Phase 8 production integration boundary]

2. **Bounded relation-inventory coverage — RESOLVED for Phase 5.**
   - Phase 5 accepts the existing bounded authorised owner, Risk Type, Control, assessment, system, and asset inventories, and returns selected relation labels with list/detail DTOs so deep-linked selections remain intelligible. [VERIFIED: existing typed service boundaries and locked selected-label contract]
   - Every inventory boundary must use a +1/cap-overflow probe or equivalent explicit completeness signal. Unit/service/component acceptance tests must force overflow for each bounded picker path and require an explicit unavailable/error treatment; silently omitting valid selectable records is forbidden. A later exact lookup/option operation is required only if a real inventory exceeds the accepted bound, and cannot be substituted silently during Phase 5 execution. [VERIFIED: Phase 5 fail-closed input/projection rules]

Both questions are resolved for Phase 5 under the locked Phase 5/Phase 8 boundaries. [VERIFIED: locked constraints]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All workspaces/tests | Yes | 24.19.0 | None; exact locked version present. [VERIFIED: environment probe] |
| pnpm | Workspace commands | Yes | 11.24.0 | None needed. [VERIFIED: environment probe] |
| Turbo | Root orchestration | Yes | 2.8.16 | Run filtered workspace commands if isolating a failure. [VERIFIED: environment probe] |
| Strapi CLI | API/build/tests | Yes | 5.51.0 | None needed. [VERIFIED: environment probe] |
| Playwright | E2E | Yes | 1.58.2 | None needed. [VERIFIED: environment probe] |
| Git branch | Locked execution context | Yes | `dylan-test` | Do not switch. [VERIFIED: environment probe] |
| Isolated SQLite | Mounted/E2E persistence | Yes through current config | better-sqlite3 12.8.0 | None needed. [VERIFIED: package/harness] |

**Missing dependencies with no fallback:** none. [VERIFIED: environment audit]

**Missing dependencies with fallback:** Context7 CLI is unavailable; official current Next.js and Strapi documentation was used instead. [VERIFIED: environment probe]

## Validation Architecture

Nyquist validation is enabled in `.planning/config.json`. [VERIFIED: config]

### Test Framework

| Property | Value |
|----------|-------|
| Backend unit/integration | Node 24 test runner after TypeScript compilation; existing script `pnpm --filter @csrm/strapi test`. [VERIFIED: package script] |
| Web unit/component | Vitest 4.0.18 + Testing Library/jsdom; `pnpm --filter @csrm/web test`. [VERIFIED: package script/dependencies] |
| Browser acceptance | Playwright 1.58.2 dual-server config; focused `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts`. [VERIFIED: config/environment] |
| Contract drift | `apps/strapi/tests/contract-catalogue.integration.test.ts` plus `pnpm --filter @csrm/web api:check`. [VERIFIED: existing tests/scripts] |
| Full suite | `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`. [VERIFIED: root scripts] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RISK-01 | closed parsing for every valid/invalid filter, all eight sorts, page sizes, unknown keys | backend unit | `node --test apps/strapi/.tmp/tests-dist/tests/risk-register.unit.test.js` after test TS compile | No - Wave 0 |
| RISK-01 | mounted exact grants, Requestor denial, filter combinations, no-mitigation, severity/null ordering, exact totals, page boundaries | mounted integration | `pnpm --filter @csrm/strapi test` | No - Wave 0 |
| RISK-01 | closed OpenAPI DTOs, generated paths, exact effective grants, byte-identical catalogues | contract integration | `pnpm --filter @csrm/strapi test && pnpm --filter @csrm/web api:check` | Existing file; Phase 5 cases missing |
| RISK-01 | canonical URL round trip, chip labels/removal, clear semantics, page correction, mobile cards, five states | Vitest component | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-register.test.tsx` | No - Wave 0 |
| RISK-01 | typed request serialization and malicious/over-populated response rejection | Vitest service | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-service.test.ts` | No - Wave 0 |
| RISK-02 | complete relation-labelled projection, parent lock, partial fact failure, descendant bounds | backend unit/mounted | `pnpm --filter @csrm/strapi test` | No - Wave 0 |
| RISK-02 | mutable/read-only detail, five sections/states, exact copy, zero released actions, 409 refresh | Vitest component | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-details.test.tsx` | No - Wave 0 |
| RISK-02 | existing mutation routes retain allowlists/ancestor lock; register action revalidates/reloads | backend + Vitest action | `pnpm --filter @csrm/strapi test && pnpm --filter @csrm/web exec vitest run src/features/risks/risk-actions.test.ts` | Existing backend coverage; new action file missing |
| RISK-01/02 | Bob register/filter/detail/edit, released `ASM-2026-33SAEN`, mutable seed persistence, Jane denial, and list/detail breakpoint/focus/overflow geometry at 375/390/430/768/1024/1440 | Playwright | `pnpm --filter @csrm/web exec playwright test e2e/risk-register-workflow.spec.ts --reporter=line` | No - Wave 0 |

### Required Backend Test Matrix

- Parser: each canonical parameter alone; every valid enum; arrays/duplicates/unknowns; blank/overlong q; malformed IDs; invalid sort/page/pageSize. [VERIFIED: UI/API contract]
- Filters: all ten list dimensions including search and `No mitigation controls`; AND combinations; multiple ControlImplementations must not duplicate rows/totals. [VERIFIED: RISK-01/UI spec]
- Sorts: all eight fields in both directions, severity rank, null target dates last, deterministic tie-breaker, and cross-page order. [VERIFIED: UI spec]
- Pagination: totals 0/1/pageSize/pageSize+1, final partial page, out-of-range page with unchanged honest total, different page sizes. [VERIFIED: UI spec]
- Authorization: Bob succeeds; Jane and missing/ungranted identities receive safe 403 for list/detail; random/missing detail cannot distinguish denied/not-found to Requestor. [VERIFIED: security contract]
- Projection: every Risk field and required relation ID/label; no email/numeric IDs/audit fields; mitigation reusable-control identity; no partial aggregate on relation failure. [VERIFIED: UI/JDL]
- Parent lock: mutable, complete released, every partial release combination, ancestor changes during mutation, and post-409 authoritative reload. [VERIFIED: Phase 4 test precedent]
- Seed: gates off, fresh, repeat, repair, stable domain keys, exactly 2,646 reusable Controls unchanged. [VERIFIED: seed precedents/locked constraints]

### Required Frontend Test Matrix

- Exact UI copy and all five top-level states on both routes, PageHeader retained, no partial detail. [VERIFIED: UI spec]
- URL canonicalisation for all parameters, unknown discard, Enter/button search, selection application, page resets, clear behavior, and `scroll:false`. [VERIFIED: UI spec]
- Desktop columns/manual sorts and mobile cards below 768px; no giant nested link; density desktop-only. [VERIFIED: UI spec]
- Accessible labels, role search, combobox focus, `aria-sort`, live regions, field `aria-describedby`, destructive dialog focus/error behavior. [VERIFIED: UI spec]
- Released aggregate contains exact notice and no Edit/Save/Add/Edit/Remove/Close/menu/prefetch affordance. [VERIFIED: UI spec]
- Mutable no-op, changed-field-only submissions, discard confirmation/focus restoration, authoritative success updates, and 409 conversion to read-only. [VERIFIED: UI spec/existing editor patterns]

### Sampling Rate

- **Per task commit:** run the narrow new unit/component file plus TypeScript for the touched workspace. [VERIFIED: existing workflow pattern]
- **Per wave merge:** run `pnpm --filter @csrm/strapi test`, `pnpm --filter @csrm/web test`, and `pnpm --filter @csrm/web api:check` when contract files change. [VERIFIED: package scripts]
- **Phase gate:** root typecheck/test/build plus the complete Playwright suite on isolated 1338/3100; scan for Phase 5 sentinels/escape hatches and raw colours/fetches. [VERIFIED: locked constraints/UI acceptance]

### Wave 0 Gaps

- [ ] `apps/strapi/tests/risk-register.unit.test.ts` - query parser/projection/ordering contract.
- [ ] `apps/strapi/tests/risk-register.integration.test.ts` - mounted routes, filters, totals, scope, parent lock.
- [ ] Extend `apps/strapi/tests/contract-catalogue.integration.test.ts` - new reads and closed DTO parity.
- [ ] `apps/strapi/tests/risk-register-seed.integration.test.ts` - development seed gates/idempotence/repair.
- [ ] `apps/web/src/features/risks/risk-schema.test.ts` - URL/DTO closure.
- [ ] `apps/web/src/features/risks/risk-service.test.ts` - exact openapi-fetch calls and hostile responses.
- [ ] `apps/web/src/features/risks/risk-register.test.tsx` - URL/table/cards/five states.
- [ ] `apps/web/src/features/risks/risk-details.test.tsx` - five sections, mutable/released states, exact copy.
- [ ] `apps/web/src/features/risks/risk-actions.test.ts` - delta/revalidation/409 reload.
- [ ] `apps/web/e2e/risk-register-workflow.spec.ts` - Bob/Jane critical journey.

No framework install or new shared test fixture package is required. [VERIFIED: environment audit]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set it false. [VERIFIED: config]

The repository carries OWASP ASVS 5.0.0 (released 2025-05-30) as a seeded verification catalogue; applicable chapter names below use that version rather than the older ASVS 4 numbering. [VERIFIED: `owasp-asvs-5.0.0.json`]

### Applicable ASVS 5 Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Encoding and Sanitization | Yes | Bind database values, encode opaque IDs in links, React escaping, no unsafe HTML. [VERIFIED: ASVS catalogue/project patterns] |
| V2 Validation and Business Logic | Yes | Closed filter/body schemas, allowlisted sorts, parent aggregate state machine. [VERIFIED: phase contract] |
| V3 Web Frontend Security | Yes | No secrets/client tokens, safe router URLs, semantic output, no raw HTML. [VERIFIED: server transport/UI rules] |
| V4 API and Web Service | Yes | Auth-enabled `/v1` routes, closed DTOs/errors, bounded pagination. [VERIFIED: architecture] |
| V6 Authentication | Preserved, not newly implemented | Content API token outer gate; Keycloak remains Phase 8. [VERIFIED: locked constraints/ROADMAP] |
| V7 Session Management | Preserved | Existing server session adapter; no new client auth state. [VERIFIED: web auth code] |
| V8 Authorization | Critical | Exact FunctionAPI grant plus explicit analyst risk-register scope and Requestor denial. [VERIFIED: authorization policy/catalogue] |
| V9 Self-contained Tokens | Preserved | Existing API token handling; no token parsing added. [VERIFIED: server-client transport] |
| V13 Configuration | Yes | Triple development gate and isolated ports/database; no production fixture activation. [VERIFIED: gate/harness] |
| V14 Data Protection | Critical | Closed projections, no partial aggregate, no sensitive relation/user fields. [VERIFIED: project brief/UI spec] |
| V16 Security Logging and Error Handling | Yes | Safe 400/403/404/409 envelopes; no SQL, stack, or record existence clues. [VERIFIED: existing controllers/tests] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR by Risk documentId | Information Disclosure/Elevation | Exact analyst grant and record scope before lookup; indistinguishable Requestor denial. [VERIFIED: security contract] |
| Filter/sort injection | Tampering | Closed parser, allowlists, parameter binding; never pass caller objects/raw SQL fragments. [VERIFIED: ASVS V1/V2] |
| Pagination disclosure | Information Disclosure | Deny before count; no count/filter clues on 403. [VERIFIED: UI permission state] |
| Over-populated relation leakage | Information Disclosure | Explicit closed projection and web Zod parse. [VERIFIED: Phase 4 service tests] |
| TOCTOU release race | Tampering | Existing serialized parent Assessment lock and authoritative re-read in transaction. [VERIFIED: workflow service] |
| Dev identity impersonation outside dev | Spoofing | NODE_ENV + CSRM_ENVIRONMENT + CSRM_DEV_IDENTITY gate, deterministic token outer gate. [VERIFIED: development gate/locked constraints] |
| Stored rich-text/XSS | Tampering/Disclosure | Treat Risk/evidence/comments as plain bounded text and let React escape; no `dangerouslySetInnerHTML`. [VERIFIED: project security rules] |
| Error-based record enumeration | Information Disclosure | Safe generic denied/not-available copy and no relation/mutation clues. [VERIFIED: UI spec] |

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` - binding engineering, security, architecture, and terminology rules.
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` - phase goal, RISK-01/RISK-02, inherited decisions.
- `.planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md` - approved route, state, query, copy, layout, accessibility, and API prerequisites.
- `docs/CSRM-PROJECT-BRIEF.md` - Risk Register semantics, scale, API, security, testing.
- `docs/references/idambox-datamodel.jdl` and Strapi schemas - entities, fields, enums, relationships.
- `docs/references/specification.json` - currently served `/v1` operations and DTOs.
- Both `idambox-csrm-role-function-api-catalogue.json` copies - exact effective grants and intended register reads.
- Phase 4 route/controller/service/web/test files named throughout - implemented analogs.
- https://nextjs.org/docs/app/getting-started/layouts-and-pages - App Router async params/searchParams and server data guidance.
- https://nextjs.org/docs/app/api-reference/functions/use-search-params - client URL-state behavior.
- https://nextjs.org/docs/app/api-reference/functions/use-router - safe App Router replace/navigation behavior.
- https://docs.strapi.io/cms/api/document-service/filters - current Strapi filter operators.
- https://docs.strapi.io/cms/api/document-service/sort-pagination - current Strapi sort/start/limit behavior.
- https://docs.strapi.io/cms/backend-customization/routes - current custom route configuration.
- https://docs.strapi.io/cms/backend-customization/policies - current policy configuration.

### Secondary (MEDIUM confidence)

- Installed `@strapi/database` 5.51.0 TypeScript declarations - available low-level query builder/raw/order API; this is internal implementation evidence, not a portability guarantee.

### Tertiary (LOW confidence)

- None. Unverified design inferences are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - exact installed versions and no new dependencies. [VERIFIED: manifests/environment]
- Architecture: HIGH - direct reuse of implemented Phase 2-4 boundaries and approved UI contract. [VERIFIED: codebase]
- Query/filter behavior: HIGH except semantic database portability - official Strapi docs plus project count pattern; production dialect unknown. [CITED: Strapi docs] [ASSUMED]
- Authorization/security: HIGH - exact policy/catalogue/routes and mounted-test precedents inspected. [VERIFIED: codebase]
- UI patterns: HIGH - approved Phase 5 contract and concrete existing components. [VERIFIED: UI spec/codebase]
- Pitfalls: HIGH for authorization/count/release/UI; MEDIUM for database-specific ordering implementation. [VERIFIED: codebase] [ASSUMED]

**Research date:** 2026-08-31  
**Valid until:** 2026-09-30 for the locked project stack; recheck official docs and package versions after dependency changes.

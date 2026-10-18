# Phase 7: Requestor Request Workflow - Research

**Researched:** 2026-08-22
**Domain:** Ownership-safe Strapi request workflow with a Next.js App Router client
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Integrate Phase 7 directly with Strapi rather than using a deterministic MSW-only request store. Include the backend ownership and authorization work required by this Requestor workflow. — **Reversibility:** costly — replacing this boundary later would touch request services, authorization policies, and all workflow screens.
- **D-02:** Record access and available actions must continue to come from centralized capabilities, with server-side ownership enforcement preventing identifier-based access to another Requestor's records.
- **D-03:** A Requestor can withdraw a submitted request back to `draft` until an analyst starts processing it; after processing starts, it is read-only to the Requestor.
- **D-04:** Security Analysts can view and edit a Requestor's unsubmitted draft.
- **D-05:** Analyst edits leave the request in `draft`; the Requestor must review and explicitly submit it.
- **D-06:** Present existing Strapi fields in one progressive, sectioned page rather than a wizard or unstructured long form.
- **D-07:** Saving a draft requires only `title`; submitting enforces the agreed essential persisted fields. Do not invent duplicate frontend-only domain fields.
- **D-08:** Information Systems and Information Assets use searchable selections from the existing Strapi catalogues; either relation may remain empty when none applies.
- **D-09:** Show `thirdPartyDetails` only when `thirdPartyInvolvement` is true and require it when submitting.
- **D-10:** The Requestor dashboard is action-first: needs-attention requests lead, followed by recent submissions, status summary, and notifications.
- **D-11:** My Requests is a sortable table on desktop and compact request cards on mobile.
- **D-12:** My Requests defaults to most recently updated first and initially provides keyword search plus a status filter only.

### the agent's Discretion
- Define the exact essential submission fields from the persisted Strapi schema and CSRM data-model terminology, preserving draft permissiveness.
- Determine the implementation details needed to reconcile the approved direct Strapi authorization work with the later Phase 13 OIDC/hardening scope; do not silently weaken ownership enforcement.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CSRM-05 | Requestor can create, view, and edit their own CSRM assessment requests in a Next.js application. | Ownership-bound Strapi handlers, typed service methods, lifecycle guards, capability-gated routes, and HTTP/component/E2E verification. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use Next.js App Router and strict TypeScript; prefer Server Components and isolate Client Components to required interactions. [VERIFIED: apps/csrm/AGENTS.md:13-15]
- Keep domain logic outside JSX, call APIs only through the typed API layer, validate external input with shared schemas, and enforce authorization server-side. [VERIFIED: apps/csrm/AGENTS.md:19-22]
- Navigation is not authorization; Requestors must not access another Requestor's restricted records. [VERIFIED: apps/csrm/AGENTS.md:22-23]
- Use the supplied JDL terminology, make every page responsive, add automated tests for material workflows, and avoid dependencies without a concrete reason. [VERIFIED: apps/csrm/AGENTS.md:20-27]
- Preserve `IdamBoxUser -> Role -> Function -> Application`; do not add free-floating permission strings or restore historical Entitlement/ApplicationRole types. [VERIFIED: AGENTS.md:24-26]

## Summary

Implement the request flow as one vertical contract: Next Server Components and Server Actions call a server-only typed CSRM service; that service calls Strapi; Strapi custom controllers/services bind every request to the resolved actor and enforce ownership plus lifecycle transitions. This is required because the current CSRM assessment-request router exposes generic `find`, `findOne`, `create`, `update`, and `delete` behind only `global::csrm-app-enabled`, and its controller/service are still core factories. [VERIFIED: apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts:3-11] [VERIFIED: apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:1-3] [VERIFIED: apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts:1-3]

The UI must never be a parallel request store. It should consume one focused request domain service above generated OpenAPI types, with MSW exercising the identical HTTP paths in tests. The committed specification currently declares the generic `"/csrm-assessment-requests"` collection path, while the project brief explicitly says a missing operation is a backend API gap—not an excuse for a frontend mock endpoint. [VERIFIED: apps/csrm/docs/references/specification.json:3165-3168] [VERIFIED: apps/csrm/docs/CSRM-PROJECT-BRIEF.md:747-783]

**Primary recommendation:** First build the Strapi ownership/lifecycle contract and regenerate the OpenAPI artifact; then add the focused typed service/actions; finally compose the dashboard, list, form, and detail views on that real contract. [CITED: https://docs.strapi.io/cms/backend-customization/controllers] [CITED: https://nextjs.org/docs/app/guides/forms]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Actor resolution and request mutation | Frontend Server (SSR) | API / Backend | Server Actions resolve the trusted current identity and keep service credentials out of browser code; Strapi remains the authoritative record-access decision point. [CITED: https://nextjs.org/docs/app/guides/forms] [VERIFIED: apps/csrm/src/lib/api/client.ts:1-10] |
| Ownership filtering and lifecycle transitions | API / Backend | Database / Storage | The backend owns record lookup, requestor assignment, allowed fields, and status change validation; database relations persist the result. [CITED: https://docs.strapi.io/cms/backend-customization/controllers] [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:62-115] |
| Dashboard, list, form, read-only presentation | Browser / Client | Frontend Server (SSR) | Pages load server-first; controlled search, dirty-state interception, catalogue selection, and confirmation dialogs are narrow client islands. [VERIFIED: apps/csrm/AGENTS.md:13-15] [CITED: https://nextjs.org/docs/app/guides/forms] |
| Route/action discoverability | Frontend Server (SSR) | Browser / Client | Central Function-derived route configuration determines discoverability only; it must not replace backend authorization. [VERIFIED: apps/csrm/src/config/routes.ts:45-94] [VERIFIED: apps/csrm/src/domain/route-access.ts:3-9] |
| Request, catalogue, and relation persistence | Database / Storage | API / Backend | Strapi's request collection and existing information-system/asset relations are the persisted source of truth. [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:14-115] |

## Standard Stack

### Core

| Library / facility | Current version / state | Purpose | Why standard here |
|--------------------|-------------------------|---------|-------------------|
| Strapi custom controller, service, route policy, Document Service | Existing backend pin: `"@strapi/strapi": "5.23.6"` | Ownership-filtered CRUD and explicit lifecycle actions. | Strapi documents custom core-action overrides, routes/policies, output sanitization, and Document Service queries/updates. [VERIFIED: apps/backend/package.json:20-24] [CITED: https://docs.strapi.io/cms/backend-customization/controllers] [CITED: https://docs.strapi.io/cms/backend-customization/policies] |
| Next.js App Router + React Server Actions | Existing pins: `"next": "16.3.0"`, `"react": "19.2.8"` | Server-first pages and mutation boundary. | Server Actions are server-side form handlers; each must authenticate/authorize sensitive work and can return expected errors to `useActionState`. [VERIFIED: apps/csrm/package.json:28-30] [CITED: https://nextjs.org/docs/app/guides/forms] [CITED: https://nextjs.org/docs/app/getting-started/error-handling] |
| Generated OpenAPI types plus focused service wrapper | Existing pin: `"openapi-typescript": "7.13.0"` | Static transport types without exposing a generated SDK to UI code. | Existing generator enforces an OpenAPI 3.1 specification and emits a committed artifact; openapi-typescript generates runtime-free types from OpenAPI schemas. [VERIFIED: apps/csrm/package.json:54-54] [VERIFIED: apps/csrm/scripts/generate-openapi.mjs:7-18] [CITED: https://openapi-ts.dev/introduction] |

### Supporting

| Facility | Purpose | When to use |
|----------|---------|-------------|
| Vitest + Testing Library + MSW + Playwright | Unit/domain, component/accessibility, HTTP-contract, and browser/production-exclusion evidence. [VERIFIED: apps/csrm/package.json:45-55] | Extend the existing stack; MSW handlers must mirror the production request contract rather than create a fixture-only contract. [VERIFIED: apps/csrm/src/test/handlers.ts:1-9] |
| Existing shadcn/Radix primitives | Form, table/card, status, dialog, popover, and command compositions. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:246-251] | Reuse existing primitives first; perform the Phase 6 provenance checkpoint before any new direct package or component-generated package change. [VERIFIED: .planning/phases/07-requestor-request-workflow/.continue-here.md:10-17] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Strapi integration | MSW-only deterministic store | Rejected by locked D-01; it would delay the backend authorization/lifecycle contract and create a competing request store. |
| Explicit submit/withdraw backend actions | Client-controlled `requestStatus` updates through generic PATCH | Rejected: it permits invalid transitions and conflicts with server-side ownership/action enforcement. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-CONTEXT.md:14-18] |
| Server Actions calling the server-only service | Browser fetches to Strapi | Rejected by project rule against arbitrary UI fetches and because service credentials/actor assertions must not enter client assets. [VERIFIED: apps/csrm/AGENTS.md:20-22] [VERIFIED: apps/csrm/src/lib/api/client.ts:1-10] |

**Installation:** No package installation is approved by this research. Preserve the audited pins. Any missing UI primitive that changes `apps/csrm/package.json` or `yarn.lock` needs a `checkpoint:human-verify` package-provenance/compatibility gate before installation. [VERIFIED: .planning/phases/07-requestor-request-workflow/.continue-here.md:10-17]

## Architecture Patterns

### System Architecture Diagram

```text
Browser
  │ routes, URL search/filter state; client islands for form/dialog/catalogue selection
  ▼
Next Server Component / Server Action
  │ resolve server-trusted current identity; validate user input; never accept actor/role/status fields
  ▼
Server-only typed CSRM request service
  │ generated OpenAPI request/response types + safe ServiceResult mapping
  ▼
Strapi request policy → custom controller → workflow/ownership service
  │              │                  │
  │              ├─ authenticated internal caller only
  │              ├─ actor → IdamBoxUser lookup
  │              └─ owner/analyst + lifecycle decision
  ▼
Strapi Document Service → CSRM Assessment Request / catalogue relations
  │
  ├─ owned request list/detail or generic no-metadata denial
  └─ create / save draft / submit / withdraw response
```

### Pattern 1: Force actor-bound ownership at Strapi

**What:** Override generic request `find`, `findOne`, `create`, and `update`, and add explicit `submit`/`withdraw` actions. The actor is resolved server-side from the trusted app-to-Strapi call; do not accept `requestor`, `requestNumber`, `submittedDate`, or `requestStatus` from form input. The service must apply ownership filter before lookup and return the same safe denial shape for an unknown/non-owned document ID. [CITED: https://docs.strapi.io/cms/backend-customization/controllers] [CITED: https://docs.strapi.io/cms/backend-customization/policies]

**Why it is necessary:** the persisted request model requires a unique `requestNumber`, has a requestor relation, and has workflow state; generic `create` does not make a title-only draft valid unless backend logic supplies system-owned fields. [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:15-23] [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:62-90]

**Verbatim domain values:**

```json
"assessmentType": {
  "type": "enumeration",
  "enum": [
    "BAU",
    "Project",
    "Other"
  ]
}
```
[VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:27-34]

```json
"requestStatus": {
  "type": "enumeration",
  "enum": [
    "draft",
    "submitted",
    "questionnaire-in-progress",
    "risk-assessment-drafted",
    "under-review",
    "approved",
    "closed"
  ],
  "default": "draft",
  "required": true
}
```
[VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:78-90]

**Recommended transition matrix:**

| Actor | Current status | Allowed operation | Result |
|-------|----------------|-------------------|--------|
| Requestor owner | `draft` | Create/update/save | `draft` |
| Security Analyst | `draft` | Update/save | `draft` |
| Requestor owner | `draft` | Submit after validation | `submitted` and server-set `submittedDate` |
| Requestor owner | `submitted` | Withdraw only while no later workflow processing exists | `draft` and clear server transition metadata as defined by service |
| Requestor owner | `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`, `approved`, `closed` | Read only | unchanged |
| Non-owner Requestor | any | List/detail/update/transition | generic access denial with no request metadata |

This matrix implements D-03 through D-05 and uses only persisted statuses quoted above. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-CONTEXT.md:14-18]

### Pattern 2: Preserve a Phase 13-compatible identity seam

**What:** In Phase 7, a Server Action resolves the existing server-only development/test identity and passes a non-user-controllable actor assertion only over a server-to-server authenticated call. Strapi's policy rejects unauthenticated direct calls; its service resolves the assertion to the product `IdamBoxUser` and derives elevated analyst authority from the server-side identity/capability seam. Phase 13 replaces only this resolver/assertion with validated OIDC subject-to-`IdamBoxUser.externalSubject` mapping, while retaining the same ownership and lifecycle service. This is a bounded development bridge, not a claim that fixture cookies are production authentication. [VERIFIED: apps/csrm/src/lib/fixtures/resolve-identity.ts:57-83] [VERIFIED: apps/csrm/src/lib/fixtures/identities.ts:19-36] [VERIFIED: apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json:31-52]

**Guardrail:** do not expose a Strapi API token, internal credential, selected fixture identity, role, capability, requestor relation, or transition target in browser-delivered code. The Phase 6 production test scans every emitted server/client JavaScript asset and asserts test-only paths return `404`; Phase 7 must extend that test for any new fixture request modules/routes. [VERIFIED: apps/csrm/e2e/shell.spec.ts:219-243]

### Pattern 3: Typed service + Server Action result boundary

**What:** Extend `ApiClient` from GET-only to typed JSON mutation support with timeout, JSON-content, and runtime-response validation. Add request-specific service methods (`listOwnedRequests`, `getOwnedRequest`, `createDraft`, `saveDraft`, `submitRequest`, `withdrawRequest`, `listInformationSystems`, `listInformationAssets`) returning discriminated safe results. Server Actions validate form data and map expected errors to field-safe action state; pages/components never call `fetch` directly. [VERIFIED: apps/csrm/src/lib/api/client.ts:9-92] [VERIFIED: apps/csrm/src/lib/api/csrm-service.ts:1-26] [CITED: https://nextjs.org/docs/app/guides/forms] [CITED: https://nextjs.org/docs/app/getting-started/error-handling]

### Pattern 4: One request form, separate draft/submit validation

**What:** Model one persisted request draft DTO and two validation modes. Draft mode requires `title`; submission mode additionally requires title, description, assessment type, business purpose, business criticality, explicit third-party choice, and conditional third-party details. Both information relations remain optional. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:140-151]

**Do not add frontend-only request fields.** Persisted form fields are `title`, `description`, `assessmentType`, `division`, `businessUnit`, `businessPurpose`, `businessCriticality`, `thirdPartyInvolvement`, `thirdPartyDetails`, `regulatoryRequirements`, `dueDate`, `informationSystems`, and `informationAssets`; `requestNumber`, `requestor`, `requestStatus`, and `submittedDate` are server-owned. [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:15-103] [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:136-149]

### Recommended Project Structure

```text
apps/backend/src/api/csrm-assessment-request/
├── controllers/                 # ownership-filtered core overrides + submit/withdraw actions
├── services/                    # actor resolution, request-number generation, transition rules
├── policies/                    # authenticated internal caller precondition
└── routes/                      # preserve guarded core routes; add only submit/withdraw paths

apps/csrm/src/
├── app/(csrm)/                  # dashboard, requests, new request, detail routes
├── features/requests/           # domain DTOs, validation, form/list/detail/dashboard compositions
├── lib/api/                     # server-only typed request/catalogue service
├── config/routes.ts             # enable only existing centralized requestor route entries
└── test/                        # MSW handlers/payload factories for the same endpoints
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Record authorization | Client route checks, hidden buttons, or query-string requestor filters | Strapi policy + controller/service ownership decision | A changed identifier or forged relation must not disclose/modify another record. [VERIFIED: apps/csrm/AGENTS.md:22-23] |
| Request lifecycle | Generic client PATCH of `requestStatus` | Explicit backend submit/withdraw actions and a transition function | State-dependent and actor-dependent changes need one authoritative guard. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-CONTEXT.md:14-18] |
| Transport contract | Ad-hoc request interfaces or a separate browser BFF API | Existing Strapi OpenAPI spec → generated types → focused service | The project brief names the specification authoritative and says missing operations are backend gaps. [VERIFIED: apps/csrm/docs/CSRM-PROJECT-BRIEF.md:747-783] |
| Test persistence | In-memory page store | MSW as an HTTP-level Strapi double | It keeps test requests on the same service contract as production. [VERIFIED: .planning/phases/06-create-the-idambox-csrm-next-js-application/06-CONTEXT.md:35-39] |
| Dialog/focus/menu primitives | Custom focus traps and unlabelled div controls | Existing/official shadcn and Radix primitives | The UI contract already mandates their accessible dialog, popover, command, table, and pagination behavior. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:37-55] |

## Common Pitfalls

### Pitfall 1: Treating Strapi generic CRUD as the workflow API

**What goes wrong:** a title-only draft fails because `requestNumber` is required, and client payloads can try to set another `requestor`, a workflow status, or `submittedDate`. [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:15-23] [VERIFIED: apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json:62-90]

**How to avoid:** whitelist mutable draft fields, generate the request number and assign the actor server-side, and expose explicit transition actions. Strapi recommends validation/sanitization of custom controller input, query, and output. [CITED: https://docs.strapi.io/cms/backend-customization/controllers]

### Pitfall 2: Filtering only in the Next.js UI/service

**What goes wrong:** `GET /csrm-assessment-requests/{id}` could still leak data when a Requestor changes a URL, or a direct Strapi caller can bypass the UI. [VERIFIED: apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts:3-11]

**How to avoid:** apply actor-derived ownership in backend list and detail queries before response serialization; use one generic denial for missing/not-owned records and test both identifier cases for absence of title, request number, and status. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:167-173]

### Pitfall 3: Giving fixtures production reach

**What goes wrong:** development identities or request fixtures remain in server bundles even if a client-only scan passes. [VERIFIED: .planning/phases/07-requestor-request-workflow/.continue-here.md:10-17]

**How to avoid:** keep actor resolution/service credentials server-only, compile-time replace development request modules in production where necessary, scan all emitted JavaScript, and assert request/evidence fixture endpoints are unavailable in the production runtime. [VERIFIED: apps/csrm/e2e/shell.spec.ts:219-243]

### Pitfall 4: OpenAPI drift after backend routes change

**What goes wrong:** the generated client types continue to describe only generic collection operations while UI code calls new submit/withdraw behavior. [VERIFIED: apps/csrm/scripts/generate-openapi.mjs:35-45]

**How to avoid:** regenerate the backend specification after routes/controllers are added, keep `apps/backend/specification.json` and `apps/csrm/docs/references/specification.json` byte-identical, regenerate `src/lib/api/generated/openapi.ts`, and run the existing drift checker. [VERIFIED: apps/backend/specification.json:1-10] [VERIFIED: apps/csrm/scripts/check-openapi-drift.mjs:8-33]

### Pitfall 5: Responsive presentation as compressed desktop table

**What goes wrong:** hiding columns leaves inaccessible actions or horizontal overflow at mobile widths. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:177-194]

**How to avoid:** render a semantic table at `768px` and above and a semantic card list below it, using the same result data, filters, sort, count, and pagination. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:80-105]

## Code Examples

### Ownership-safe action shape

```ts
// Server Action outline; actor comes from server-only resolution, never FormData.
"use server";

export async function submitRequest(
  requestId: string,
  formData: FormData,
) {
  const actor = await resolveCurrentIdentityOnServer();
  const draft = parseRequestForm(formData, { mode: "submit" });
  if (!draft.ok) return draft;

  return updateAndSubmitOwnedRequest({ actor, requestId, data: draft.data });
}
```

This is a structural sketch, not a contract for new values. It follows the documented Server Action requirement to authenticate/authorize each sensitive operation and return expected validation errors as values. [CITED: https://nextjs.org/docs/app/guides/forms] [CITED: https://nextjs.org/docs/app/getting-started/error-handling]

### Backend decision ordering

```ts
// Pseudocode for the Strapi workflow service.
const request = await findRequestVisibleTo(actor, requestId);
if (!request) return denyWithoutMetadata();

assertCanMutate(actor, request);
const data = validateAndWhitelistDraftInput(input);
return updateRequest(request.documentId, data);
```

Use a Strapi custom controller/service and its documented input/query/output sanitization, rather than returning document-service objects without filtering. [CITED: https://docs.strapi.io/cms/backend-customization/controllers]

## State of the Art

| Old approach | Current approach | Impact |
|--------------|------------------|--------|
| Phase 6 GET-only `/applications` tracer | Phase 7 focused read/write request and catalogue service above the same generated contract | The service boundary becomes a real vertical workflow boundary while preserving one transport source of truth. [VERIFIED: apps/csrm/src/lib/api/csrm-service.ts:18-26] |
| Planned request routes | Enable the existing `my-requests`, `new-request`, and `request-details` capability entries | No duplicate navigation or role-name checks. [VERIFIED: apps/csrm/src/config/routes.ts:59-85] |
| Generic CRUD as generated API surface | Custom ownership-aware core overrides plus custom transition endpoints | Makes draft-save, submit, withdrawal, and metadata-safe denial enforceable. [CITED: https://docs.strapi.io/cms/backend-customization/routes] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A server-to-server authenticated actor assertion can be configured in the local Phase 7 environment without changing the Phase 13 OIDC architecture. | Architecture Pattern 2 | The planner needs a small configuration decision before backend ownership tests can run. |

The exact mechanism is intentionally not locked here; the non-negotiable contract is that browser input cannot choose the actor and the backend rejects unauthenticated calls. [ASSUMED]

## Open Questions (RESOLVED)

1. **RESOLVED — What local machine-to-machine credential is used between Next Server Actions and Strapi before Phase 13 OIDC?**
   - What we know: current development identities are server-only fixtures and production replaces their runtime shell; Strapi requires an authenticated caller before it can trust an actor assertion. [VERIFIED: apps/csrm/src/lib/fixtures/resolve-identity.ts:57-83] [VERIFIED: apps/csrm/e2e/shell.spec.ts:219-243]
   - Resolution: use `IDAMBOX_CSRM_INTERNAL_TOKEN`, a random 32-byte-or-longer environment secret shared only by Next Server Actions and a Strapi route policy. After authenticating that bridge, Strapi resolves the asserted IdamBoxUser and remains authoritative for ownership and lifecycle. The value is never `NEXT_PUBLIC_`, never accepted from browser input, and is covered by production emitted-asset exclusion. Phase 13 replaces actor authentication/mapping, not these ownership rules.

2. **RESOLVED — How are custom submit/withdraw operations represented in the generated Strapi OpenAPI specification?**
   - What we know: generic request endpoints exist and the backend has `strapi openapi generate`; the brief requires missing operations to be added to the backend contract. [VERIFIED: apps/backend/package.json:7-17] [VERIFIED: apps/csrm/docs/CSRM-PROJECT-BRIEF.md:762-769]
   - Resolution: declare the custom dashboard, submit, and withdraw routes with Strapi route metadata/schema consumed by `strapi openapi generate`; regenerate `apps/backend/specification.json`, copy it byte-for-byte to the CSRM reference, then run `openapi-typescript`. The coverage gate requires all three path/verb pairs and exactly 106 decided operations, and fails on backend/reference/type drift.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next, Strapi, generators, test runners | ✓ | `v22.19.0` | — |
| Yarn | workspace scripts | ✓ | `1.22.22` | — |
| npm | package metadata/provenance commands if a new package is proposed | ✓ | `9.5.0` | — |
| Local Strapi process + CSRM feature flag | Direct integration/HTTP verification | Not probed during read-only research | — | Start the existing backend with `csrmAppIsEnabled=true` before integration verification. [VERIFIED: apps/backend/src/policies/csrm-app-enabled.ts:7-15] |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10`, Testing Library, MSW `2.15.0`, Playwright `1.62.1`. [VERIFIED: apps/csrm/package.json:45-55] |
| Config file | `apps/csrm/vitest.config.ts` and `apps/csrm/playwright.config.ts`. [VERIFIED: apps/csrm/vitest.config.ts:1-18] [VERIFIED: apps/csrm/playwright.config.ts:1-32] |
| Quick run command | `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm test --run` |
| Full suite command | `yarn workspace @idambox/csrm verify && yarn workspace @idambox/csrm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CSRM-05 | Backend creates a title-only owned draft, ignores forged system fields, and lists/details only actor-owned records. | backend integration | `yarn workspace backend check-types` plus targeted backend integration test command | ❌ Wave 0 |
| CSRM-05 | Only allowed Requestor/Analyst draft actions and submit/withdraw transitions succeed; later statuses are Requestor read-only. | backend unit/integration | targeted workflow service/controller tests | ❌ Wave 0 |
| CSRM-05 | Typed service serializes generated request DTOs, validates response envelopes, maps errors safely, and MSW intercepts every declared request. | HTTP integration | `yarn workspace @idambox/csrm test --run src/lib/api` | ❌ Wave 0 |
| CSRM-05 | Dashboard/list/form/details meet capability, validation, focus, error, empty, and metadata-safe denial behavior. | component | `yarn workspace @idambox/csrm test --run src/features/requests` | ❌ Wave 0 |
| CSRM-05 | Desktop/mobile list swap, draft/save/submit/withdraw, no overflow, and fixture exclusion work in a production build. | E2E/production | `yarn workspace @idambox/csrm test:e2e` | Extend existing `apps/csrm/e2e/shell.spec.ts` |

### Sampling Rate

- **Per task commit:** `yarn workspace @idambox/csrm check-types && yarn workspace @idambox/csrm test --run`
- **Per wave merge:** `yarn workspace @idambox/csrm verify && yarn workspace backend check-types`
- **Phase gate:** full CSRM E2E suite, backend workflow/ownership tests, generated OpenAPI drift check, production emitted-asset scan, and required viewport evidence green. [VERIFIED: apps/csrm/e2e/shell.spec.ts:219-243]

### Wave 0 Gaps

- [ ] Backend request workflow tests with two Requestor identities plus an Analyst identity, including unknown versus non-owned identifier non-disclosure.
- [ ] Request service/domain validation and MSW request/catalogue payload factories.
- [ ] Component tests for validation summary, conditional third-party details, dialog focus, dirty-form interception, list/table-card parity, and live announcements.
- [ ] Playwright workflow and responsive snapshots at the UI contract's required viewports, plus expanded production fixture-exclusion coverage.
- [ ] Human package-provenance checkpoint before any new direct dependency or lockfile change. [VERIFIED: .planning/phases/07-requestor-request-workflow/.continue-here.md:10-17]

## Security Domain

OWASP ASVS 5.0.0 is the current stable version and provides a basis for testing technical security controls. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Server Action resolves current actor; Strapi accepts requests only through the authenticated server-to-server boundary. [CITED: https://nextjs.org/docs/app/guides/forms] |
| V3 Session Management | Yes | Existing fixture choice is an HTTP-only, strict same-site server cookie and is development/test only. [VERIFIED: apps/csrm/src/lib/fixtures/resolve-identity.ts:13-28] |
| V4 Access Control | Yes | Backend owner/analyst decision for every list, detail, write, submit, and withdraw operation; UI visibility is not authorization. [VERIFIED: apps/csrm/AGENTS.md:21-23] |
| V5 Input Validation | Yes | Separate draft/submit validation, server-side whitelist, and Strapi controller input/query/output sanitization. [CITED: https://docs.strapi.io/cms/backend-customization/controllers] |
| V6 Cryptography | Yes | Store service credentials only in environment configuration; never emit them to browser assets. Exact secret-management mechanism remains Phase 7 configuration work. [ASSUMED] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Identifier swapping / IDOR | Information disclosure, tampering | Filter before lookup in Strapi and deny non-owned/missing records without metadata; test both cases. |
| Forged `requestor` or `requestStatus` in form body | Elevation of privilege, tampering | Ignore/strip system-owned fields; derive owner and transition server-side. |
| Fixture identity or service credential in emitted assets | Elevation of privilege, information disclosure | Server-only modules, compile-time production replacement, full emitted-server/client asset scan, and production HTTP assertions. |
| Unsafe transport errors surfaced to UI | Information disclosure | Preserve values, map safe field errors, and never render raw Strapi/HTTP/token/stack details. [VERIFIED: .planning/phases/07-requestor-request-workflow/07-UI-SPEC.md:167-173] |

## Sources

### Primary (HIGH confidence)

- [Strapi Controllers](https://docs.strapi.io/cms/backend-customization/controllers) — core overrides, controller validation/sanitization, custom actions.
- [Strapi Routes](https://docs.strapi.io/cms/backend-customization/routes) and [Policies](https://docs.strapi.io/cms/backend-customization/policies) — route-to-controller and pre-controller enforcement.
- [Strapi Document Service](https://docs.strapi.io/cms/api/document-service) — document IDs, filtering, sorting, pagination, create/update.
- [Next.js Forms](https://nextjs.org/docs/app/guides/forms) and [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) — secure Server Actions and expected error returns.
- [openapi-typescript](https://openapi-ts.dev/introduction) — runtime-free generated types.
- In-repo schema, OpenAPI, service-boundary, fixture-exclusion, and UI-contract sources cited inline.

### Secondary (MEDIUM confidence)

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) — security verification baseline and stable v5.0.0 reference.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — existing pinned stack and generator/service boundary were opened; official Strapi/Next/OpenAPI docs confirm the implementation model.
- Architecture: HIGH — locked direct-Strapi/ownership decisions, current backend gaps, and Phase 6 fixture contract align.
- Pitfalls: HIGH — each critical pitfall is grounded in the current generic backend, UI contract, or Phase 6 executable constraints.

**Research date:** 2026-08-22
**Valid until:** 2026-09-21 for the pinned project stack; re-check before changing dependencies or Strapi/Next versions.

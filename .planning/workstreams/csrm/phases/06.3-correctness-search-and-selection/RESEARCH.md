# Phase 06.3: Correctness, Search, and Selection - Research

**Researched:** 2026-09-07  
**Domain:** Server-authorised collection scope, bounded query APIs, searchable selection, and response-contract validation  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- The three `my` collection screens must resolve owner scope for every authenticated actor, including an actor with Security Analyst grants. Analyst review routes retain their separate organisation-wide scope.
- Information Systems and Information Assets use a searchable multi-select; Risk owner uses the established bounded, server-backed active-user combobox and persists an identity, not typed text.
- Search, status filtering, pagination, counts, empty-filter recovery, and paging preservation are server-backed for My Questionnaires, My Risk Assessments, and all three analyst review screens.
- Reproduce the Requestor-owned released-assessment read failure before fixing its actual release fact or projection cause. Development must distinguish a client response-schema mismatch from a transport outage.
- Add a contract-to-client-schema parity guard. Returned relations must be populated and every response must be a bounded projection rather than a raw Strapi document.
- No Strapi content-type schema change is expected. If one becomes unavoidable, justify it in the plan and create a contract-gap record before changing a schema.

### Constraints

- Use the typed `openapi-fetch` service layer only; no page-level raw requests and no frontend API facade.
- Any changed route must be represented in both catalogue copies byte-identically and in `docs/references/specification.json`; declarations are regenerated only with `pnpm --filter @csrm/web api:generate`.
- Keycloak is disabled and excluded.
- Use strict TypeScript, semantic theme tokens, WCAG 2.2 AA patterns, responsive layouts from 375px through 1440px, and non-colour-only status/risk signals.
- Browser coverage clears transient toasts before obscured clicks, retries a client-island navigation target when necessary, and uses named locators.
</user_constraints>

## Project Constraints (from AGENTS.md)

- Strapi remains the production API boundary; authorization and record scope are server-authoritative.
- Preserve CSRM JDL terminology; do not invent entities or change the frozen data model for this phase.
- Keep business logic out of JSX; use shared input schemas and reusable feature modules.
- Add automated tests for every material workflow, without adding a dependency unless necessary.

## Summary

This phase is primarily a query-and-projection correction, not a data-model change. The current policy assigns `"all"` to `requireRequestCollectionScope` and `requireQuestionnaireCollectionScope` when an actor has the analyst-granted operation. That makes an analyst’s `my` pages organisation-wide. Owner scope must instead be selected from the route meaning: the my collection policies always set the acting IdamBox user as owner, while `requireAnalystRequestCollectionScope` remains the only review-queue path that assigns organisation scope. Assessment routes need the same explicit owner-scope decision, because their current policy has no requestor collection-scope configuration.

The web already has the intended interaction foundations: RequestTable supplies server-backed search/filter/sort/page behaviour, and OwnerCombobox supplies debouncing, bounded result display, keyboard navigation, loading, error/retry, and selected-value retention. Reuse or generalise these rather than fetching every Information System or Information Asset page into a checkbox list. The current request service loops through up to 1,000 pages for inventory, which is exactly the volume behaviour this phase must remove.

**Primary recommendation:** make five existing list endpoints query-complete with bounded projections and exact OpenAPI/catalogue declarations, add shared list-query and searchable multi-select primitives, then prove both scope directions and schema/contract parity before browser acceptance coverage.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| My-record owner scoping | API / Backend | Database / Storage | Strapi derives the authenticated owner and composes it into the query; browser visibility is never the control. |
| Search, status filter, sort, and paging | API / Backend | Browser / Client | Server validates bounded inputs, filters/counts/project records; client only serialises validated query state and renders it. |
| System/asset and owner selection | Browser / Client | API / Backend | Accessible combobox state belongs in the client; its bounded search results come from typed, authorised endpoints. |
| Released-assessment availability | API / Backend | Browser / Client | Backend must supply complete released facts in its bounded projection; client must diagnose response-schema mismatch distinctly during development. |
| Contract-to-schema parity | Build / Test | API / Backend | A test reads the published contract and exercises the schemas that parse each declared response. |

## Existing Seams and Required Changes

| Scope area | Existing authoritative files | Required Phase 06.3 change | Risk / dependency |
|---|---|---|---|
| Request `my` scope | `apps/strapi/src/policies/csrm-authorization.ts`; `apps/strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts`; `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` | For `requireRequestCollectionScope`, always store `own` with `grants.requestorId`; do not use `explicitAnalystOperation` for this route meaning. Keep `requireAnalystRequestCollectionScope` unchanged as `all`. Extend direct-policy and mounted authorization tests with analyst-owned and other-requestor records. | A role check must never become a route-scope inference. Test both visible own record and denied/not-listed other record. |
| Questionnaire `my` scope and filtering | `apps/strapi/src/policies/csrm-authorization.ts`; `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts`; `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts`; controller | Make `requireQuestionnaireCollectionScope` owner-scoped for every actor; add strict allowed query keys, bounded status and text search/filter parsing, count-query parity, and projected relation population. Keep `/v1/questionnaires` analyst review all-scoped. | Existing `safeFilters` admits only title/number and passes shapes through. Client/server vocabulary must use the questionnaire’s `not-started`, `draft`, `submitted` state set. |
| My released assessment scope/list | `apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts`; controller; `services/assessment-scope.ts`; `operations.ts` | Add an explicit owner collection-scope policy/configuration for `/v1/my_risk_assessments` and its summary route; create a strict query builder for released-assessment list search/status/sort/pagination and matching count. Keep `/v1/risk_assessments` analyst-only all scope. | Assessment policy currently does not set scope for my routes; this must not rely on `assessmentRequestActor` alone. |
| Analyst request review search/filter | Request controller and `collection-scope.ts`; `apps/web/src/features/assessments/assessment-service.ts`; assessment-list/page | Reuse `buildAnalystReviewCollectionQuery` pattern, expose bounded search/status fields in contract/service/page/list, preserve result count and reset/recover paging. | Existing review builder already validates status, text, date, sort, and paging; avoid a second parser. |
| Analyst questionnaire review search/filter | Questionnaire scope/controller/service/list/page | Same server-backed request vocabulary adapted to questionnaire state; use a bounded status filter and search title/number/request summary fields only if all projections contain them. | Do not filter an incomplete browser page or search a relation that was not populated. |
| Analyst assessment review search/filter | Assessment scope/controller/service/list/page | Replace current unpaginated `ASSESSMENT_LIST_QUERY` read with a strict all-scoped query builder, count, bounded summary projection, then client query/list controls. | The current analyst list and my list are arrays, not envelopes; OpenAPI and Zod response envelopes change together. |
| Request systems/assets picker | `apps/web/src/features/requests/request-form.tsx`; `request-service.ts`; request actions/pages; information-system/asset routes/services | Replace exhaustive inventory fetch and checkbox fieldsets with one reusable multi-select based on OwnerCombobox’s interaction contract. Add typed search service methods, bounded page size, selected-record hydration/retention, and controlled `string[]` form values. | The input must support zero/one/many and keep selections outside the current search page. No arbitrary unbounded `findMany` or raw document response. |
| Risk owner picker | `apps/web/src/features/assessments/risk-editor.tsx`; `owner-combobox.tsx`; `assessment-service.ts`; risk actions | Reuse existing active-user lookup for Risk owner and retain its selected `ActiveUser` representation; verify mutations send `documentId` only. | Existing Risk owner already uses OwnerCombobox; regression work should prove search selection and identity persistence, not replace it. |
| Released-detail defect | `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts`; `services/assessment-scope.ts`; `apps/web/src/features/assessments/assessment-schema.ts`; `assessment-service.ts`; `released-assessment.tsx`; detail page | First identify the failing one of status, assessmentDate, approvalDate, approvedBy against a Requestor-owned approved fixture. Fix at the release workflow/projection/contract source, never by weakening a valid release invariant. Make response-schema failure independently observable in development without exposing details in production. | The current closed refinement maps all parse failures into generic transport failure. A returned relation must be populated and projected exactly. |
| Contract/client parity | `docs/references/specification.json`; generated declarations; all response schemas in request/questionnaire/assessment/admin services; existing `contract-catalogue.integration.test.ts` and web service tests | Add a targeted contract-to-Zod-parsers test registry. Each typed service read/mutation response parser declares its operation id/path, success media schema, fixture payload, and Zod parser. Assert required/nullable/enum/projection correspondence and reject missing populated relation fields. | Structural OpenAPI-vs-Zod comparison cannot infer every refinement; combine static shape assertions with fixture parse tests for released facts and discriminator/status branches. |

## Route and Contract Inventory

No new route is inherently required. The phase changes query capability and response envelopes for existing routes. Each changed route must be updated in the two byte-identical catalogues, `docs/references/specification.json`, and regenerated declarations.

| Existing route | Required query/response contract change |
|---|---|
| `GET /v1/my_questionnaires` | Add bounded `q`, questionnaire-state filter, sort and pagination parameters; return paginated bounded questionnaire summaries with populated assessment-request summary. |
| `GET /v1/questionnaires` | Add the same bounded review-list query parameters and envelope. |
| `GET /v1/my_risk_assessments` | Add bounded `q`, released status semantics, sort, pagination, and result metadata; retain approved-only owner condition server-side. |
| `GET /v1/risk_assessments` | Add bounded analyst status/text/sort/pagination query and paginated assessment-summary envelope. |
| `GET /v1/assessment_requests` | Align query declaration with its implemented strict review collection builder, including search/status/sort/pagination and paginated projection. |
| `GET /v1/information_systems` | Declare bounded search plus pagination for the request selector and retain its authorised summary projection. |
| `GET /v1/information_assets` | Declare bounded search plus pagination for the request selector and retain its authorised summary projection. |
| `GET /v1/risk_assessments/{assessmentId}` | Correct only the bounded requestor released-detail projection/schema where the reproduction proves it differs; no new endpoint. |

The catalogue copies are `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`. Maintain exact byte equality as an automated assertion. Do not hand-edit `apps/web/src/lib/api/generated/schema.d.ts`; regenerate it after the OpenAPI update using `pnpm --filter @csrm/web api:generate`.

## Standard Stack

| Component | Established use | Phase use |
|---|---|---|
| Strapi document service and policy state | `csrm-authorization.ts`, collection scopes, controllers | Derive scope once, validate query input, use count/data queries, and project bounded DTOs. |
| `openapi-fetch` typed transport | `apps/web/src/lib/api/transport/server-client.ts` and feature services | Add query-capable service calls only through the existing server-only typed client. |
| Zod | Feature request/questionnaire/assessment schemas | Validate URL query state, response envelopes, and dedicated contract-to-parser fixtures. |
| react-hook-form + existing form schemas | Request and Risk forms | Maintain selected document-id arrays/identities without domain logic in JSX. |
| Existing shadcn Popover/Checkbox/Input and OwnerCombobox | Owner selection | Generalise interaction, accessibility, and selected-value retention for multi-select inventory. |
| Vitest, Node test, and Playwright | Existing unit/integration/browser suites | Unit query builders/parsers/components; mounted authorization/contract checks; dual-actor journeys. |

No external dependency is justified.

## Recommended Delivery Order

1. Add failing direct-policy and mounted dual-actor coverage plus a Requestor-owned released assessment fixture that records the actual failed release condition.
2. Correct explicit `my` owner scope for requests, questionnaires, and assessments, retaining only named analyst review flags for all-record access.
3. Make all five list query builders strict, bounded, count-consistent, and projection-driven; update routes, catalogues, OpenAPI, and generated declarations as one atomic contract change.
4. Extend typed services, Zod schemas, server pages, and reusable list controls from the RequestTable pattern; each surface has loading, populated, no-record, no-match/recovery, error, and permission states.
5. Generalise the bounded combobox into a multi-select relation picker and wire the Risk owner regression through the existing selected identity path.
6. Fix the reproduced released-detail source mismatch and add development-only response-contract diagnostics. Add the cross-service contract-to-client-schema parity registry and regression fixtures.
7. Complete component, policy, HTTP, contract, generation, typecheck, and browser acceptance gates.

## Contract-to-Client-Schema Parity Design

Use a small explicit registry in web tests rather than attempting to derive arbitrary Zod internals. Each entry names: OpenAPI path/method or operationId; success status/content schema reference; the feature’s exported response parser; a canonical valid fixture; and mutation variants when success is a union. The test reads `docs/references/specification.json`, verifies that the operation and success schema exist, verifies generated declarations after `api:generate`, and asserts that the canonical bounded payload parses. It must include every response schema currently parsed in request, questionnaire, assessment, administration, dashboard, and action service modules.

For relationship safety, fixtures must include every relation that the client schema declares. Add negative fixtures omitting `assessmentRequest`, `approvedBy`, `revertedBy`, owner, or other declared relation so the test fails with a clear parser-contract mismatch. For released assessment, retain the strict release refinement and add four focused fixtures for non-approved status, null assessment date, null approval date, and null approver. The regression fixture must identify which one was observed before the implementation fix; only then update the API projection/workflow/contract source that caused it.

The transport result needs an internal, typed distinction between HTTP/network failure and a caught response-schema parse failure. In development, the detail error boundary/state exposes a safe diagnostic category and operation identifier; in production it keeps the existing non-leaking user message. Do not use an empty state for an incomplete related record, and do not disclose raw backend payloads or stack data.

## Test Plan

| Layer | Files to extend/create | Required proof |
|---|---|---|
| Strapi policy unit | `apps/strapi/tests/authorization.policy.test.js`; fixture support under `apps/strapi/tests/fixtures/` | An analyst on a my request/questionnaire route receives `own` scope with their own IdamBox user id; analyst review remains `all`; forged filters cannot widen owner scope. |
| Strapi query/service unit | Existing `collection-scope`/questionnaire/assessment service tests, or adjacent new focused test files | Invalid keys/oversized text/status/sort/page fail closed; exact search/status filters are composed with owner/all scope; count and data queries share filters. |
| Strapi integration | `apps/strapi/tests/authorization.integration.test.ts`; `contract-catalogue.integration.test.ts` | Analyst sees own record but not another Requestor’s in each my collection; analyst queue can see organisation records; changed served routes, grants, two catalogue copies, and OpenAPI stay congruent. |
| Web feature unit | `request-service.test.ts`, `request-form.test.tsx`, `owner-combobox.test.tsx`, `questionnaire-service.test.ts`, `assessment-service.test.ts`, list/detail tests | Typed query serialization and closed parser fixtures; picker keyboard/multi-select/retention; result count/no-match recovery/paging; selected Risk owner persists documentId. |
| Parity guard | New focused web contract/parser parity test alongside service tests | Every registry entry has an OpenAPI operation/success schema and valid fixture; declared relations are present; negative drift fixtures fail. |
| Browser | Extend `apps/web/e2e/requestor-request-workflow.spec.ts`, `questionnaire-workflow.spec.ts`, `assessment-release-workflow.spec.ts`, and/or a dedicated Phase 06.3 file | Two actors prove no owner leak and preserved analyst review scope; all lists search/filter/page; system/asset keyboard multi-select retains off-page values; Requestor-owned released assessment opens after regression; desktop/mobile overflow/accessibility checks. |

Browser tests must use named controls/headings/regions, clear a transient toast before any covered target, and retry a client-island click only after asserting the named target is ready. Include 375px and desktop viewport checks for picker/list overflow and keyboard-only selection.

## Common Pitfalls

- **Role-derived collection scope:** An actor can hold analyst grants and still be the owner of a my record. Route semantics decide scope; role grants only decide capability.
- **Client-side filtering of one page:** This produces wrong totals and hides matching records on later pages. The database query and count query must share the same validated filters.
- **Unbounded selector hydration:** Fetching all pages or returning raw documents undermines large-volume usability and expands contract drift. Use bounded pages and hydrate only already-selected ids.
- **Dropping selections outside search results:** Search result replacement must never overwrite controlled selected ids; maintain selected summaries independently and reconcile them by documentId.
- **Schema “fix” by loosening released invariants:** A missing release fact is either an invalid release workflow or omitted projection. Preserve the strict refinement and fix the producer/contract.
- **Partial relation projection:** If a response contains a relation, explicitly populate it and project exactly the fields its client parser requires.
- **Contract declaration after service work:** Typed declarations and the two catalogue copies must change with the server route/query shape, then be regenerated. Hand-edited declarations conceal drift.

## Data-Model Decision

No Strapi `schema.json` change is justified. The JDL already defines `CsrmAssessmentRequest` associations to `CsrmInformationSystem` and `CsrmInformationAsset`, and risks already reference an IdamBox user as `riskOwner`. This phase changes how existing records are authorised, found, projected, and selected. If execution discovers a missing persisted fact, stop that task, document the unavoidable model gap under `docs/contract-gaps/`, and justify it before any schema mutation.

## Validation Architecture

| Property | Value |
|---|---|
| Backend quick tests | Existing direct-policy/query-builder tests and `apps/strapi/tests/authorization.integration.test.ts` |
| Web quick tests | Focused Vitest files under `apps/web/src/features/**` |
| Contract declaration | `pnpm --filter @csrm/web api:generate` followed by the repository declaration check |
| Browser gate | Focused Playwright journeys plus the existing relevant workflow suites |
| Type gate | Strapi and web strict TypeScript checks |

Required implementation checks: regenerated declarations have no diff; catalogue copies are byte-identical; each changed route appears in both catalogues and OpenAPI; no raw fetch is added outside transport; and no content-type schema changes occur.

## Security Domain

| ASVS category | Applies | Phase control |
|---|---|---|
| V4 Access Control | Yes | Strapi policy derives owner/all scope and tests IDOR-style collection denial. |
| V5 Input Validation | Yes | Strict bounded query parsers and Zod schemas reject unknown keys, oversized terms, invalid states, pagination, and sorting. |
| V7 Error Handling | Yes | Development distinguishes response-contract mismatch from transport failure without leaking payloads in production. |
| V13 API and Web Service | Yes | Published OpenAPI, generated typed client declarations, bounded projections, and route/catalogue parity tests. |

## Dependencies and Risks

| Dependency / risk | Handling |
|---|---|
| Released regression needs a Requestor-owned approved record; the current seed owner differs | Create a development-gated fixture or adjust development-only seeded ownership solely for the reproduction, then preserve it as a test fixture. |
| Changed existing routes still require documentation parity | Treat route/query/OpenAPI/two catalogues/generation as one task with an automated parity assertion. |
| Existing assessment list payloads are unpaginated arrays | Make the envelope contract change deliberately across Strapi, schema, service, page, component, tests, and generated declarations; do not support ad-hoc dual shapes indefinitely. |
| Shared combobox expansion can regress existing owner fields | Preserve current OwnerCombobox tests and add multi-select as an additive generic mode or dedicated wrapper with the same keyboard contract. |
| Search/filter semantics can drift among six screens | Keep record-specific query schemas in server feature services, but reuse one web list-control contract and test status vocabulary per resource. |

## Sources

- [VERIFIED: `AGENTS.md`] Project architecture, security, type, accessibility, API-boundary, and test requirements.
- [VERIFIED: `.planning/ROADMAP.md`, Phase 06.3] Scope decisions, known defect, and five success criteria.
- [VERIFIED: `.planning/phases/06.3-correctness-search-and-selection/06.3-CONTEXT.md`] Locked owner scope, query, picker, released-read, parity, and no-schema decisions.
- [VERIFIED: `docs/contract-gaps/phase-06.3-released-assessment-read-failure.md`] Released detail failure mechanism and required reproduction/diagnostic outcome.
- [VERIFIED: `apps/strapi/src/policies/csrm-authorization.ts`] Current policy order and separate analyst review scope.
- [VERIFIED: `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts`] Existing strict request query builder pattern.
- [VERIFIED: `apps/web/src/features/requests/request-table.tsx` and `request-service.ts`] Existing server-backed Requestor list pattern and exhaustive inventory-fetch behaviour to replace.
- [VERIFIED: `apps/web/src/features/assessments/owner-combobox.tsx`] Existing debounced, keyboard-accessible bounded owner search interaction.
- [VERIFIED: `apps/web/src/features/assessments/assessment-schema.ts`] Strict released-assessment refinement and closed response shapes.

## Assumptions Log

None. The planned route changes extend existing endpoints and do not require a data-model change unless execution establishes a missing persisted release fact.

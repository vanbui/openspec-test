# Phase 7 API Coverage — Requestor Request Workflow

> Full coverage for the Strapi request and catalogue surface touched by CSRM-05. The transport source of truth is `apps/csrm/docs/references/specification.json`; the FunctionApi catalogue remains authorization traceability and does not create a competing frontend endpoint contract.

## Assumption-delta result

`no-change` — `IdamBoxUser` remains the primary product-user model. References to “another user” in ownership tests mean a different `IdamBoxUser` owns a particular `CsrmAssessmentRequest`; they do not authorize a second user model, owner collection, or schema migration.

## OpenAPI operation decisions

| Operation | Decision | Typed CSRM adapter | Phase 7 contract |
|---|---|---|---|
| `GET /csrm-assessment-requests` | INTEGRATE | `listOwnedRequests` | Requestor results are owner-filtered before lookup and support allowlisted keyword/status/sort/page inputs; an analyst-capable actor may query accessible drafts without weakening Requestor ownership. |
| `POST /csrm-assessment-requests` | INTEGRATE | `createDraft` | Creates a title-only draft for the resolved actor; request number, requestor, status, and submission date are server-owned. |
| `GET /csrm-assessment-requests/{id}` | INTEGRATE | `getAccessibleRequest` | Returns an owned request or an analyst-accessible draft; missing and non-owned identifiers share one metadata-free denial. |
| `PUT /csrm-assessment-requests/{id}` | INTEGRATE | `saveDraft` | Saves only allowlisted persisted draft fields while the actor and lifecycle permit editing. |
| `DELETE /csrm-assessment-requests/{id}` | PROHIBIT | none | Phase 7 exposes no delete action and removes the generic delete route from the workflow surface. |
| `GET /csrm-assessment-requests/dashboard` | ADD + INTEGRATE | `getRequestorDashboard` | Returns owned needs-attention rows, recent submissions, status counts, and relevant request notifications without requiring the UI to load the whole collection. |
| `POST /csrm-assessment-requests/{id}/submit` | ADD + INTEGRATE | `submitRequest` | Validates essential persisted fields, performs the `draft` → `submitted` transition, and sets `submittedDate` server-side. |
| `POST /csrm-assessment-requests/{id}/withdraw` | ADD + INTEGRATE | `withdrawRequest` | Permits only an owner’s exact `submitted` → `draft` transition before later processing and clears submission transition metadata. |
| `GET /csrm-information-systems` | INTEGRATE | `listInformationSystems` | Read-only, bounded, searchable catalogue choices for the optional relation. |
| `GET /csrm-information-assets` | INTEGRATE | `listInformationAssets` | Read-only, bounded, searchable catalogue choices for the optional relation. |
| All other Information System/Asset operations | OPT-OUT | none | Phase 11 owns catalogue administration; Phase 7 only selects existing records. |
| IdamBox user CRUD operations | OPT-OUT | none | The backend resolves the asserted actor internally through the existing `IdamBoxUser` Document Service; no user-administration adapter is exposed to the request UI. |

The current 103-operation specification therefore gains exactly three custom workflow operations and must regenerate to 106 operations. The backend copy, CSRM reference copy, and generated `openapi.ts` must agree in the same change set.

## FunctionApi reconciliation

| Catalogue intent | Phase 7 disposition | OpenAPI mapping / reason |
|---|---|---|
| List My Assessment Requests | INTEGRATE | `GET /csrm-assessment-requests` with actor-derived ownership. |
| Get My Request Status Summary | INTEGRATE | Included in `GET /csrm-assessment-requests/dashboard`. |
| Get Assessment Request Form Metadata | COMPOSE | Generated request enums plus the persisted schema drive the form; no duplicate runtime metadata model is introduced. |
| Search Information Systems / Assets | INTEGRATE | `GET /csrm-information-systems` and `GET /csrm-information-assets`. |
| Search Users | OPT-OUT | The approved UI contract has no Phase 7 sponsor selector. |
| Create / Update Assessment Request | INTEGRATE | `POST` collection and `PUT` item operations; the catalogue’s proposed PATCH spelling does not override generated OpenAPI. |
| Add Request Information System / Asset | COMPOSE | Relation document IDs are submitted through the allowlisted create/save DTO; no second relation-mutation endpoint is required. |
| Get Assessment Request | INTEGRATE | `GET /csrm-assessment-requests/{id}`. |
| List Request Information Systems / Assets | COMPOSE | The authorized detail response includes populated, sanitized relation summaries. |
| Submit Assessment Request | ADD + INTEGRATE | `POST /csrm-assessment-requests/{id}/submit`. |
| Withdraw Assessment Request | ADD + INTEGRATE | `POST /csrm-assessment-requests/{id}/withdraw`, required by D-03 even though the earlier catalogue does not yet name it. Preserve the decision in the generated OpenAPI contract and later FunctionApi catalogue reconciliation rather than hiding it in frontend code. |
| Generate Request Questionnaire | OPT-OUT | Phase 8 owns questionnaire generation/workflow. |
| Analyst request list/status/overdue operations | OPT-OUT | Phase 7 only needs analyst access to a known unsubmitted draft per D-04/D-05; analyst triage/reporting breadth remains in later workflow/reporting phases. |

## Coverage invariants

- Every INTEGRATE or ADD + INTEGRATE row has a generated `paths[...]` type, a focused server-only service method, a runtime response guard, and HTTP-level MSW coverage.
- Every mutation authenticates the internal caller, resolves an active `IdamBoxUser`, ignores actor/system-owned fields from browser input, and rechecks ownership/lifecycle in Strapi.
- FunctionApi catalogue URLs are traceability evidence. They never authorize mock-only endpoints or bypass the committed OpenAPI document.
- Package manifests and `yarn.lock` remain unchanged in Phase 7. If an unavoidable package change is discovered, execution stops before mutation until research supplies a Package Legitimacy Audit and the Phase 6 provenance/compatibility checkpoint is approved.

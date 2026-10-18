# Phase 2 Multi-Source Coverage Audit

| Source | ID | Feature / constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Requestor creates, saves, edits, submits, and tracks authorised requests end-to-end | 02-01, 02-05, 02-07–02-09, 02-12 | COVERED | Browser contract plus backend, typed mutation boundary, and UI slices. |
| REQ | REQ-01 | Authorised searchable/filterable/sortable/paginated My Requests | 02-05–02-07, 02-09 | COVERED | Owner scope and URL-backed DataTable. |
| REQ | REQ-02 | Structured persisted request and assessment context | 02-05–02-08, 02-12 | COVERED | Generated detail populate for systems/assets, normalized hydrated relations, persisted edit defaults, and no schema change. |
| REQ | REQ-03 | Save, resume, and edit drafts only while permitted | 02-05, 02-08, 02-09, 02-12 | COVERED | Backend persisted-state guard, typed mutation boundary, and UI flow. |
| REQ | REQ-04 | Valid irreversible submit with unambiguous state | 02-05, 02-08, 02-09, 02-12 | COVERED | Authoritative validation, confirmed draft→submitted, and server timestamp. |
| REQ | REQ-05 | Data-driven request/questionnaire/released widgets | 02-06, 02-07, 02-09 | COVERED | Dashboard reads populate only questionnaire/assessment, normalize consumed facts, and keep released honestly empty until a release fact exists. |
| RESEARCH | — | Double-gated development identity and CSRM-only public permissions | 02-02, 02-03 | COVERED | Exact Jane/Bob fixtures; fail closed; no IAM. |
| RESEARCH | — | Server-owned number/owner/status/submittedDate and transition guard | 02-05 | COVERED | Closed writable fields and mounted persistence tests; requestNumber display format is decided at blocking checkpoint 02-05-02 before implementation. |
| RESEARCH | — | Pagination/query/create/populate contract correction and generated types | 02-06, 02-07 | COVERED | Authoritative source regenerated; exact detail/dashboard populate arrays, URLs, and normalized payloads are tested. |
| RESEARCH | — | Compliant Node `>=24.19.0 <25` before dependency installation | 02-04 | COVERED | Blocking 02-04-00 preflight rejects measured v24.5.0 and gives exact activation guidance. |
| RESEARCH | — | Locked composite UI, semantic tokens, WCAG/responsive/five states | 02-04, 02-07–02-11 | COVERED | Foundation reused rather than replanned. |
| RESEARCH | — | No generic sponsor lookup and no approval=release inference | 02-06, 02-08, 02-09, 02-12 | COVERED | Sponsor is omitted from typed/UI surfaces; released projection is honestly unavailable/empty with the contract gap recorded. |
| RESEARCH | — | Submit validates only authoritative existing persisted/generated constraints | 02-05, 02-12 | COVERED | No unapproved completeness rule is invented. |
| CONTEXT | Pre-02 auth bridge | Strapi/web development bridge in Wave 1 | 02-02, 02-03 | COVERED | Both plans are Wave 1. |
| CONTEXT | Pre-02 design foundation | Foundation landed; add only composites and compose screens | 02-04, 02-07–02-11 | COVERED | No token/shell redesign. |
| CONTEXT | Locked workflow | Real fields/relations, draft-only edit, one-way submit, dashboard | 02-05, 02-07–02-09, 02-12 | COVERED | Full persisted workflow. |
| CONTEXT | Locked API/security | Strapi boundary, generated openapi-fetch, route policy/catalogue parity | 02-05–02-09, 02-12 | COVERED | New API-only reference-data Function grants exact inventory GETs to Jane/Bob through the full graph; IAM/admin CRUD remain denied. |
| CONTEXT | Locked validation | Mounted HTTP, Vitest, Playwright, exact four commands | 02-01–02-12 | COVERED | Named RED tests require unique sentinels and reject startup/config/module/syntax/timeout/baseline failures; final E2E and fail-fast four-command gate are in 02-09. |

Excluded rather than missing: Keycloak production integration (Phase 8); questionnaire completion (Phase 3); assessment release contract (Phase 4); generic sponsor directory (blocked by least privilege and absent contract); content-type schema changes (explicitly prohibited).

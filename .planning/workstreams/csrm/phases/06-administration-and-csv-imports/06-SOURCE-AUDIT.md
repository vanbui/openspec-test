# Phase 6 Multi-Source Coverage Audit

SOURCE | ID | Feature / requirement | Plan | Status | Notes
--- | --- | --- | --- | --- | ---
GOAL | — | Analyst manages four reusable collections and safely imports CSV with validation and preview | 06-04..10 | COVERED | CRUD and import are executable vertical outcomes.
REQ | ADMIN-01 | Risk Type list/create/view/edit, distinct from contextual Risk | 06-04, 06-05 | COVERED | Exact `/v1` boundary through mounted workspace.
REQ | ADMIN-02 | Control list/create/view/edit, distinct from implementations and scalable to 2,646 records | 06-06 | COVERED | Server totals/search/filter/pagination.
REQ | ADMIN-03 | Information System and Information Asset list/create/view/edit | 06-07 | COVERED | Frozen JDL fields and normalized names.
REQ | ADMIN-04 | Four five-step CSV imports with guidance, preview, errors, confirmation, results | 06-08..10 | COVERED | Five first-class classifications including unchanged no-write.
RESEARCH | AUTH | Token, app-enabled, exact grant, human analyst scope before parsing | 06-01..03 | COVERED | Bob/Jane/agent/missing-grant tests and byte-identical catalogues.
RESEARCH | ROUTES | Exact `/v1` CRUD/preview/commit routes; picker compatibility; no duplicate/delete/generic mutation | 06-02..04 | COVERED | No schema edits or frontend API facade.
RESEARCH | CONTRACT | Generated OpenAPI/openapi-fetch DTOs and INT-01 contract gap | 06-03 | COVERED | Includes resolved single-process boundary and cross-process limitation.
RESEARCH | CRUD | Closed adapters, URL queries, natural-key normalization, queue/transaction recheck, safe errors | 06-04..07 | COVERED | Each collection becomes operable end to end.
RESEARCH | CSV | Audited csv-parse 7.0.2; strict UTF-8/grammar; 5 MiB/5,000/65,536 bounds | 06-08 | COVERED | Browser advisory, Strapi authoritative.
RESEARCH | FIVE-STATE | Create/update/unchanged/rejected/ambiguous in DTOs, counts, rows, UI and tests | 06-01, 06-03, 06-08..10 | COVERED | Unchanged is never rejected and performs no write.
RESEARCH | COMMIT | Same-byte digest, reclassification, sequential per-row transactions, drift, honest unknown outcome | 06-09, 06-10 | COVERED | No client classifications or automatic retry.
RESEARCH | UI | Locked list/form/five-step copy, responsive states, accessibility, semantic tokens, no delete | 06-05..10 | COVERED | Adds distinct Unchanged presentation to the locked layout.
RESEARCH | TESTS | Mounted, component, generated-contract, isolated Bob/Jane E2E, integrity | 06-01, 06-06, 06-07, 06-09, 06-10 | COVERED | Derived ports/databases; no live servers.
RESEARCH | SECURITY | ASVS V2/V5/V8/V14/V16 treatment for auth, bounds, tampering, disclosure, stale routes | 06-01..10 | COVERED | Each plan has severity, control IDs, mitigation, command, residual disposition; unresolved HIGH blocks.
CONTEXT | — | No Phase 6 CONTEXT.md decision ledger exists | — | NOT APPLICABLE | Locked operator constraints are recorded in RESEARCH/UI-SPEC and covered above.
CONTEXT | RESOLVED-A1 | Schema-frozen Phase 6 targets one Strapi process; cross-process normalized uniqueness excluded and documented | 06-03, 06-04, 06-07 | COVERED | Does not claim current production topology.

Deferred/out-of-scope exclusions: durable import-result persistence/status entity, CSV clearing of optional fields, schema/index migration, multi-process normalized uniqueness, deletion, raw `sourceData` editing, and any frontend API facade.

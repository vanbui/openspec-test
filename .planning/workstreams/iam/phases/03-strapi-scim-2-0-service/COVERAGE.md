# Phase 3 — Source and Capability Coverage

Status: executed and verified on 2026-10-16. Every COVERED row below is implemented and proven by the tests and live evidence named in 03-GATE-EVIDENCE.md (connector capture and replay, live outage refusal at 1440 and 375, review, security audit, final suites). Deferred rows stay deferred.

## Dependency contract

One sequential plan per wave: 03-01 → 03-02 → 03-03 → 03-04 → 03-05 → 03-06 → 03-07 → 03-08 → 03-09 → 03-10 → 03-11 → 03-12 → 03-13 → 03-14 → 03-15 → 03-16 → 03-17 → 03-18. Each plan depends on its immediate predecessor; this intentionally preserves Phase 2's ordered small groups and prevents shared-file races. Tracer mode is disabled for that requested style.

Critical evidence chain: 03-12 implements tooling without fixtures; 03-13 returns to the orchestrator for live capture; only 03-14 creates fixture/replay from the passed actual capture. 03-15 implements refusal assertions/helpers; 03-16 returns to the orchestrator for Docker/Keycloak/midPoint/Strapi/CSRM/browser/outage proof at1440/375. 03-17 runs post-execution code review/security audit and remediation; 03-18 runs final mandatory suites. No live checkpoint can be executed or auto-approved by an isolated worker.

## Multi-source audit

| Source | ID | Scope | Plans | Planning coverage |
|---|---|---|---|---|
| GOAL | Phase3 | Source bearer provisions own users through root SCIM and genuine connector sequence proves contract in CI | 01–18 | COVERED |
| REQ | MODEL-02 | Token lifecycle and dev delivery | 01, 02, 06, 10, 13, 18 | COVERED |
| REQ | PROV-01 | Sourced create with birthright only | 03, 09, 10, 13, 14, 18 | COVERED |
| REQ | PROV-02 | Scoped list/search/page/read | 04, 09, 10, 13, 14, 18 | COVERED |
| REQ | PROV-03 | PUT/PATCH and preserved IdamBox Roles | 03, 05, 09, 10, 13, 14, 15, 16, 18 | COVERED |
| REQ | PROV-04 | Authenticated discovery and Groups subset | 08, 09, 10, 11, 13, 14, 18 | COVERED |
| REQ | PROV-08 | Genuine capture and real HTTP CI replay | 11, 12, 13, 14, 18 | COVERED |
| REQ | LIFE-01 | Immediate same-session API/browser refusal | 15, 16, 18 | COVERED |
| REQ | LIFE-03 | Tombstone with retained references | 09, 10, 13, 14, 15, 16, 18 | COVERED |
| CONTEXT | P3-10 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 02, 12, 13 | COVERED |
| CONTEXT | P3-11 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 03, 08, 10 | COVERED |
| CONTEXT | P3-12 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 03, 09, 10 | COVERED |
| CONTEXT | P3-13 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 03, 09, 10 | COVERED |
| CONTEXT | P3-14 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 05, 09, 10 | COVERED |
| CONTEXT | P3-15 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 04, 05, 10 | COVERED |
| CONTEXT | P3-16 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 04, 10 | COVERED |
| CONTEXT | P3-17 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 04, 10 | COVERED |
| CONTEXT | P3-18 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 08, 09, 10, 13 | COVERED |
| CONTEXT | P3-19 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 05, 10, 15, 16 | COVERED |
| CONTEXT | P3-20 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 09, 10, 16 | COVERED |
| CONTEXT | P3-21 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 07, 10 | COVERED |
| CONTEXT | P3-22 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 07, 10 | COVERED |
| CONTEXT | P3-23 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 06, 07, 10 | COVERED |
| CONTEXT | P3-24 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 08, 09, 11 | COVERED |
| CONTEXT | P3-25 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 11, 18 | COVERED |
| CONTEXT | P3-26 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 12, 13, 14 | COVERED |
| CONTEXT | P3-27 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 12, 13, 14 | COVERED |
| CONTEXT | P3-28 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 14, 18 | COVERED |
| CONTEXT | P3-29 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 15, 16 | COVERED |
| CONTEXT | P3-30 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 15, 16 | COVERED |
| CONTEXT | P3-31 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 17, 18 | COVERED |
| CONTEXT | P3-32 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 07, 10, 18 | COVERED |
| CONTEXT | P3-01 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 01, 18 | COVERED |
| CONTEXT | P3-02 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 05, 09 | COVERED |
| CONTEXT | P3-03 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 09, 11 | COVERED |
| CONTEXT | P3-04 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 06, 09, 10 | COVERED |
| CONTEXT | P3-05 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 06, 10 | COVERED |
| CONTEXT | P3-06 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 03, 07, 10 | COVERED |
| CONTEXT | P3-07 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 03, 07, 10 | COVERED |
| CONTEXT | P3-08 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 01, 06 | COVERED |
| CONTEXT | P3-09 | Exact locked decision in03-CONTEXT.md; P3-32 amends P3-21 defaults | 01, 02 | COVERED |
| RESEARCH | R-01 | Installed Strapi root manager, actual Koa layers, no /api alias | 09,11 | COVERED |
| RESEARCH | R-02 | Closed wire mapping/schema/primary-email projection and safe errors | 03,08,09,10 | COVERED |
| RESEARCH | R-03 | Atomic PATCH reducer under existing lock; uniqueness translated after outer rollback | 05,10 | COVERED |
| RESEARCH | R-04 | Fresh private source authority and exact grant; independent activity before parser/denial | 06,07,10 | COVERED |
| RESEARCH | R-05 | Token random/digest/source-row lock/safe development export | 01,02,13 | COVERED |
| RESEARCH | R-06 | Bounded eq/and grammar, allowlisted case comparison, scope before count/page | 04,10 | COVERED |
| RESEARCH | R-07 | Bounded per-instance limiter and one canonical privacy-safe log | 07,10 | COVERED |
| RESEARCH | R-08 | No package install; reuse pinned runtime, database, cryptography and test runner | 01–18 | COVERED |
| RESEARCH | R-09 | Capture tooling→orchestrator actual capture→real HTTP CI replay | 12,13,14 | COVERED |
| RESEARCH | R-10 | Existing-session same-token API/browser refusal; outage before recovery; retained references | 15,16 | COVERED |
| RESEARCH | R-11 | Runtime inventory/contract normalization and generated-client compatibility | 11,18 | COVERED |
| RESEARCH | R-12 | Post-execution review/security, final full backend/client gate | 17,18 | COVERED |

No source item is missing. Deferred Phase4 correlation/pending completion/schedules/audit combination and Phase5 password/email/full CSV journey are excluded by locked scope, together with Group membership governance, new source screens, additional HR storage, multi-address persistence, restoration/unclaim and schema/index/JDL changes. Existing content types and physical invariants remain frozen.

## SCIM operation coverage

Every row contributes authenticated real HTTP boundary/grant/visibility/error checks in03-09/03-10, operation-local root contract and mounted-runtime inventory in03-11, and capture/replay when listed. Captured traffic coverage is pending03-13; this table cannot fabricate a connector call.

| Reservation | Active method/path | Planned capability contribution | Plans / test surface |
|---|---|---|---|
| .01 | GET /scim/v2/Users | Scoped list, eq/and, count/page/projection; actual connector lookup/read/list/filter/page | 04,09,10,13,14 |
| .02 | POST /scim/v2/Users | Complete mapping/create, roles=[], uniqueness/503 rollback; actual connector create | 03,09,10,13,14 |
| .03 | GET /scim/v2/Users/{id} | Own/manual safe projection; protected/foreign/tombstone404; actual connector read | 09,10,13,14 |
| .04 | PUT /scim/v2/Users/{id} | Full replacement/claim trust, optional clearing/roles, blocking503/inactive outbox; actual connector mover/deactivation | 03,09,10,13,14,15,16 |
| .05 | PATCH /scim/v2/Users/{id} | Ordered casing/pathless/selectors; atomic lock/rollback/noTarget; explicit actual connector invocation when needed | 05,09,10,13,14,15,16 |
| .06 | DELETE /scim/v2/Users/{id} | Idempotent204 tombstone/reserved tuple/retained references/refusal; actual connector deletion | 09,10,13,14,15,16 |
| .07 | GET /scim/v2/ServiceProviderConfig | Truthful supported flags; independent authenticated HTTP probe | 08,09,10,13 |
| .08 | GET /scim/v2/Schemas | Core/Enterprise/Group descriptors; independent authenticated HTTP probe | 08,09,10,13 |
| .09 | GET /scim/v2/Schemas/{id} | Known descriptor/unknown404; independent authenticated HTTP probe | 08,09,10,13 |
| .10 | GET /scim/v2/ResourceTypes | User/Group; actual connector connection-test request | 08,09,10,13,14 |
| .11 | GET /scim/v2/ResourceTypes/{id} | User/Group exact resources/unknown404; direct conformance | 08,09,10,13 |
| .12 | GET /scim/v2/Groups | Empty standard ListResponse, no membership governance | 08,09,10,13 |
| .13 | GET /scim/v2/Groups/{id} | Authenticated404, no state/role leak | 08,09,10 |
| .14 | POST /scim/v2/Groups | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .15 | PUT /scim/v2/Groups | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .16 | PATCH /scim/v2/Groups | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .17 | DELETE /scim/v2/Groups | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .18 | POST /scim/v2/Groups/{id} | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .19 | PUT /scim/v2/Groups/{id} | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .20 | PATCH /scim/v2/Groups/{id} | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |
| .21 | DELETE /scim/v2/Groups/{id} | Authenticated/grant/throttle then501; no Roles changed | 08,09,10 |

All21 keep function.identity_provisioning.api.api.01 through .21 and Identity Provisioning Function/Role/Application linkage. Unsupported Group behavior is an explicit mounted501 contract, not an unserved reservation.

## Reused Keycloak and midPoint capability surfaces

These are narrow existing capability uses, not a request to expand either product's API coverage.

| Surface | Active contribution | Proof plan | Reasoned opt-out |
|---|---|---|---|
| Keycloak OIDC authorization/code exchange and existing token/session | Positive baseline, same unexpired session retained after SCIM deactivation | 15 fake harness;16 live OIDC/browser | Password setup/email/new-user journey belongs to Phase5 |
| Keycloak OIDC discovery/JWKS verification | Existing signed token stays valid while Strapi inactive status independently refuses request | 15,16 | No new identity provider or verifier protocol |
| Keycloak admin provisioning create/mirrored update/reactivate | Blocking failure503/Retry-After30 with write/claim rollback; inactive create remains blocking | 10 | midPoint pending-operation completion after recovery belongs to Phase4 |
| Keycloak admin disable/logout via existing durable worker | Inactive commit/outbox pending during outage and refusal before recovery | 10,15,16 | Phase2 worker/fencing implementation is reused; no new worker schema |
| midPoint temporary resource create/test/cleanup | Real pinned ResourceTypes connection test and actual connector version/source provenance | 12,13 | Persistent HR resource/secret injection and configuration belong to Phase4 |
| midPoint connector search/get/create/update/patch/delete | All locked lifecycle requests observed, including explicit connector invocation for missing normal mappings | 12,13,14 | Missing connector operation cannot be replaced with curl/authored fixture |
| midPoint role/group assignment, password change, bulk/sort/ETag | No active capability; advertised unsupported or deferred | 08,10,11 | Locked P3-18 capabilities and no Group membership governance |
| midPoint CSV schedules/correlation/pending refresh/audit combination | No Phase3 implementation | — | Explicit Phase4 requirements ENG-01..04/PROV-06/LIFE-04 |
| Existing CSRM access/data/detail/write typed API | Positive source-human baseline then next-request403; protected layout denial | 15,16 | No frontend provisioning facade or source administration UI |

## Roadmap success criteria

| Criterion | Requirement IDs | Required actual evidence after execution |
|---|---|---|
| 1 Token lifecycle/dev delivery | MODEL-02 | Token tests plus03-CONNECTOR-CAPTURE-EVIDENCE.md one-time safe delivery/rotation/revocation outcomes |
| 2 Discovery | PROV-04 | Genuine ResourceTypes connector connection test; separate schema/config authenticated probes; Groups conformance |
| 3 Source provisioning/read/update | PROV-01,PROV-02,PROV-03 | Authored HTTP/persistence and genuine lifecycle replay, preserved Roles/conflict503 rollback |
| 4 Immediate refusal/tombstone | LIFE-01,LIFE-03 | 03-REFUSAL-EVIDENCE.md,03-BROWSER-REFUSAL-EVIDENCE.md and1440/375 screenshots, pending-outbox outage and references |
| 5 Replay/cross-cutting/regression | PROV-08 plus all cross-cutting decisions | Genuine fixture provenance/replay, limits1200/IP600/source/60s, logs/activity, actual inventory/contract,03-REVIEW.md,03-SECURITY.md,03-GATE-EVIDENCE.md |

Final gate runs pnpm --dir apps/backend test from repository root and, because shared contract changes, pnpm --dir apps/csrm api:check, typecheck and test. Status remains pending until execution; planning writes no runtime evidence.


## Capability decisions

| capability | decision | reason |
|---|---|---|
| GET /scim/v2/Users | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| POST /scim/v2/Users | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/Users/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PUT /scim/v2/Users/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PATCH /scim/v2/Users/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| DELETE /scim/v2/Users/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/ServiceProviderConfig | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/Schemas | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/Schemas/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/ResourceTypes | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/ResourceTypes/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/Groups | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| GET /scim/v2/Groups/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| POST /scim/v2/Groups | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PUT /scim/v2/Groups | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PATCH /scim/v2/Groups | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| DELETE /scim/v2/Groups | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| POST /scim/v2/Groups/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PUT /scim/v2/Groups/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| PATCH /scim/v2/Groups/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| DELETE /scim/v2/Groups/{id} | INTEGRATE | Locked authenticated service surface, including explicit unsupported responders. |
| Keycloak existing OIDC session and token verification | INTEGRATE | Reuse existing sign-in and verification for same-session refusal proof. |
| Keycloak create, mirrored update and reactivation | INTEGRATE | Reuse blocking provisioning and rollback semantics. |
| Keycloak disable and logout | INTEGRATE | Reuse existing outbox worker; prove immediate refusal before recovery. |
| midPoint temporary resource and connector lifecycle | INTEGRATE | Actual capture checkpoint and provenanced replay. |
| CSRM current access, data, detail and write | INTEGRATE | Existing typed transport and protected-layout refusal. |
| SCIM Bulk, password change, sort and ETag | OPT-OUT | P3-18 locks these unsupported; no implementation in Phase 3. |
| Group membership governance | OPT-OUT | P3-18 provides empty reads and explicit unsupported writes only. |
| Persistent HR resources, correlation, schedules and pending refresh | OPT-OUT | Assigned to Phase 4 by the locked roadmap. |
| New-user password email and complete CSV sign-in journey | OPT-OUT | Assigned to Phase 5 by the locked roadmap. |
| Additional Keycloak and midPoint administration APIs | OPT-OUT | Phase 3 reuses the named existing boundaries only; no new administration product surface. |

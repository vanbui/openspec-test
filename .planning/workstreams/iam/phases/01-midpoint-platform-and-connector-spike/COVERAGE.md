# Phase 1 coverage and source audit

Planning only. All live gates remain pending execution. Scope is deployment/discovery under `docker/` and decisions/evidence under `docs/`; application provisioning is excluded by the phase boundary.

## External API capability decisions

| capability | decision | reason |
|---|---|---|
| midPoint authenticated connector listing | INTEGRATE | Prove exact loaded connector type/version, count one |
| midPoint stable resource connection test | INTEGRATE | Actual POST test plus successful OperationResult |
| midPoint resource description read | INTEGRATE | Prove reload overwrite and ordering |
| midPoint native repository bootstrap and Ninja info | INTEGRATE | Distribution SQL and positive native repository readiness |
| midPoint ordered Ninja import overwrite | INTEGRATE | Explicit configuration reload |
| connector GET ResourceTypes | INTEGRATE | Discovery-only User/Group compatibility gate |
| connector POST/GET Users and GET/PUT/PATCH/DELETE Users by id | OPT-OUT | Real provisioning service/recorded request replay belongs to Phase 3; mappings/lifecycle belong to Phase 4 |
| connector Groups writes and Bulk | OPT-OUT | Explicit milestone exclusions; no consumer |
| real ServiceProviderConfig/Schemas/Groups discovery service | OPT-OUT | Phase 3 backend contract; add static discovery only after actual spike request requires it |
| midPoint HR CSV/correlation/sync/reconciliation/refresh tasks | OPT-OUT | Phase 4 configuration, not platform discovery |
| Keycloak direct midPoint provisioning | OPT-OUT | D2 preserves Strapi as sole writer |
| Keycloak set-password email and sign-in journey | OPT-OUT | Phase 5; Mailpit infrastructure only now |
| Strapi SCIM token/source identity operations | OPT-OUT | Phase 2/3 backend work; spike uses ignored local token with no issuer |
| PostgreSQL operator CRUD/API surface | OPT-OUT | Internal native repository used by midPoint only |
| Mailpit programmatic inbox/send API | OPT-OUT | Infrastructure/console only in Phase 1; email verification belongs to Phase 5 |

## Assumption delta and schema gate

The deterministic phase scan detected pluralization `fallback` and chosen `custom`. Decision: **no-change**; Identity engine remains midPoint, connector remains its deployment detail, and no second identity authority is introduced. No-go records alternatives without choosing/implementing one. No application ORM schema path is modified; native distribution SQL is bootstrap, not an application schema push.

## Spec-less edge probe

No SPEC exists. Fallback is enabled. Preserve the deterministic classifier result and resolve acceptance through observations, not a fabricated classifier decision.

| Requirement | Probe category/status | Acceptance and review |
|---|---|---|
| PLAT-01 | unclassified / unresolved | Flagged assumption: fresh/reused/partial schema, env and network boundaries require explicit Build/Spike/Reused/Reset observations; final review resolves from evidence |
| PLAT-02 | adjacency / resolved, explicit | Exactly one connector of exact type and version; duplicates or wrong version fail |
| PLAT-02 | empty / resolved, explicit | Empty ResourceTypes or missing either User/Group fails |
| PLAT-02 | ordering / resolved, explicit | Numeric source prefixes sort lexically; duplicate canonical names fail; lexical last overwrite observed by REST |
| PLAT-03 | unclassified / unresolved | Flagged assumption: both non-root reloads, failures, preserved source hashes and clean reset require explicit observations; final review resolves from evidence |

## Prohibition recall and precision audit

Adversarial recall, per requirement, considered silent expansions: public database, public stub, unbounded polling, credential export, realm fixture churn, incorrect init schema detection, mutable connector pin, duplicate connector version, implicit source reseed, false broader compatibility proof; unauthorized direct Keycloak writer, changed engine after failure, skipped Phase2 gate, production SCIM claims, missing Group, thin JAR, missing resolved dependency evidence, schema mismatch, unobserved connection test, caller-cwd reload dependence; destructive unowned reset, source rename, hidden state loss, reordered import, skipped bad import, no overwrite, credential rotation claims, premature readiness, broad secret scanning of exempt fixtures and unsupported test success.

Precision drops ordinary correctness/hygiene items into explicit task checks. Credential disclosure, XML/path injection and destructive-state risks are security canon: referred to phase STRIDE mitigation and later secure-phase review, not minted as bespoke prohibitions. Two bespoke safety/transparency items survive: discovery must not be advertised as full provisioning/conformance proof; no-go must not silently switch technology or start Phase2. They are descriptor-less flagged-unverified items in plan02 must_haves.prohibitions. No check descriptor or machine proof is asserted. PLAT03 adds no further bespoke prohibition after routine/canon filtering. Equality: two surfaced bespoke items, two authored items, zero silently dropped items.

## Multi-source coverage audit

| SOURCE | ID | Item | Plan | Status |
|---|---|---|---|---|
| GOAL | Phase1 | Developer runs platform and proves connector discovery before dependency | 01-01,01-02,01-04,01-05 | COVERED |
| REQ | PLAT-01 | Pinned shared compose platform/env | 01-01,01-02,01-04,01-05 | COVERED |
| REQ | PLAT-02 | Source bundle and actual connector listing/test | 01-01,01-02,01-04,01-05 | COVERED |
| REQ | PLAT-03 | Reload/reset/documentation | 01-03,01-04,01-05 | COVERED |
| RESEARCH | build provenance | Fixed source/wrapper/build number, fat manifest, reports with real dynamic resolutions | 01-01,01-02 | COVERED |
| RESEARCH | native bootstrap | Positive independent repository/audit probes; partial/auth failures rejected | 01-01,01-02,01-04 | COVERED |
| RESEARCH | runtime secrets | DOM materialization chosen deterministically; ignored env/volume XML | 01-01,01-02,01-03 | COVERED |
| RESEARCH | real integration | REST status and correlated stub request, bounded helper | 01-01,01-02 | COVERED |
| RESEARCH | lifecycle/cache | Ordered overwrite then restart and REST assertion; fresh/reused/reset | 01-03,01-04 | COVERED |
| RESEARCH | security/support | Loopback/internal boundaries, redaction, license/community risk | all | COVERED |
| CONTEXT | P1-01 | Pinned runtime | 01-01,01-02 | COVERED |
| CONTEXT | P1-02 | Preserve idp/Keycloak/ClamAV; additive services | 01-01,01-02 | COVERED |
| CONTEXT | P1-03 | Native health/init/server sequence and repeated schema handling | 01-01,01-02,01-04 | COVERED |
| CONTEXT | P1-04 | Loopback consoles/internal DB/SMTP | 01-01,01-02,01-04 | COVERED |
| CONTEXT | P1-05 | Source-built fat JAR | 01-01,01-02 | COVERED |
| CONTEXT | P1-06 | Upstream repositories/build number/dependency reports | 01-01,01-02 | COVERED |
| CONTEXT | P1-07 override | Outside-home immutable bundle refreshed every init | 01-01,01-02,01-04 | COVERED |
| CONTEXT | P1-08 | Fixed opt-in static stub | 01-01,01-02 | COVERED |
| CONTEXT | P1-09 | Exact User/Group ListResponse | 01-01,01-02 | COVERED |
| CONTEXT | P1-10 | Stable spike OID/type/version and secret runtime token | 01-01,01-02 | COVERED |
| CONTEXT | P1-11 | Host bridge and no direct Keycloak writer | 01-01,01-02,01-05 | COVERED |
| CONTEXT | P1-12 | Actual discovery gate and failure blocks Phase2 | 01-01,01-02,01-05 | COVERED |
| CONTEXT | P1-13 | Ignored env and clear missing-value errors | 01-01,01-02,01-04 | COVERED |
| CONTEXT | P1-14 narrowed | Bootstrap env only; realm/README fixtures unchanged | 01-01,01-02,01-05 | COVERED |
| CONTEXT | P1-15 override | Read-only source, first-repository home seed | 01-01,01-02,01-03,01-04 | COVERED |
| CONTEXT | P1-16 | Both non-root ordered reloads and failure checks | 01-03 | COVERED |
| CONTEXT | P1-17 override | Ignore generated state, canonical names unchanged, no restoration | 01-01,01-02,01-03,01-04 | COVERED |
| CONTEXT | P1-18 | Complete start/test/reload/stop/reset instructions | 01-05 | COVERED |
| CONTEXT | P1-19 | Exact ADR0005/0006 paths | 01-01,01-02,01-05 | COVERED |
| CONTEXT | P1-20 | Engine/inbound boundary/sole writer and supersession | 01-05 | COVERED |
| CONTEXT | P1-21 | Official facts and actual risk outcome | 01-01,01-02,01-05 | COVERED |
| CONTEXT | P1-22 | All live gates and pnpm backend suite | 01-04,01-05 | COVERED |
| CONTEXT | P1-23 | Conventional subjects and attribution-free records | 01-01,01-02,01-05 | COVERED |

Exclusions: IdentitySource/model/token issuer/outbox, real SCIM backend, HR configuration/lifecycle, set-password email/sign-in and alternative implementations are assigned to later phases or explicitly deferred. No missing phase-scoped source item remains.

## Revision evidence and execution isolation

Five plans now separate Wave0 prerequisites from the first substantive deployment tracer (plan02). All actual runtime/reset/reload checks use the complete isolated project/container/volume/loopback-port remap and manifest endpoints defined in every plan; preexisting canonical idp state is preserved and never blocks reset verification. Canonical developer startup uses `up -d --force-recreate` to guarantee completed init recreation and home bundle refresh. Plan04 tests two consecutive such commands without down.

Pinned generated Scim2Configuration declares String token with confidential=true; midPoint v4.8.14 converts that to ProtectedStringType. DOM materialization therefore replaces exactly cfg:token/t:clearValue, never scalar token text. Native config's SqaleAuditServiceFactory inherits repository datasource because audit jdbcUrl/dataSource are absent; required positive audit probes use ma_audit_event,ma_audit_delta,ma_audit_ref. See 01-RESEARCH-ADDENDUM.md for pinned references/observations.

## Final planning gates

Independent plan review passed after two targeted revisions, with no remaining findings. Structural validation passed for all five plans. Requirement coverage is 3/3.

The decision parser recognizes D-prefixed IDs but not this context's P1-prefixed IDs or override headings. A temporary projection preserved all 23 effective decision texts, applied P1-07/14/15/17 overrides, and normalized IDs consistently in context and plans. The decision gate passed 23/23 with no uncovered items. The projection was removed; the authoritative context is unchanged. Override semantics were also checked independently.

Planning status is ready to execute. Every runtime result, including connector go/no-go and backend regression, remains pending execution.

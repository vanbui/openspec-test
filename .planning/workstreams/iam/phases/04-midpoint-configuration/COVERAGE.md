# Phase 4 source and API capability coverage

Status: planning coverage only. All 32 plans are written; implementation and every live outcome remain pending. COVERED below means an explicit plan owns the source item, not that a check has run.

## Dependency contract

One sequential plan per wave: 04-01 → 04-02 → 04-03 → 04-04 → 04-05 → 04-06 → 04-07 → 04-08 → 04-09 → 04-10 → 04-11 → 04-12 → 04-13 → 04-14 → 04-15 → 04-16 → 04-17 → 04-18 → 04-19 → 04-20 → 04-21 → 04-22 → 04-23 → 04-24 → 04-25 → 04-26 → 04-27 → 04-28 → 04-29 → 04-30 → 04-31 → 04-32. Every plan depends on its immediate predecessor. Plans 01–09 are offline preparation;10–13 are separate orchestrator-run compatibility probes. A BLOCKED/missing probe stops dependent configuration/writes; no downgrade satisfies the phase. Persistent configuration 14–16 consumes only actually supported saved XML. The first end-to-end lifecycle tracer is 19 after configuration gate 18. Later capability expansion follows it. Each task owns at most5paths.

Live/runtime responsibility is separate from reversible implementation. The autonomous:false plans are 10, 11, 12, 13, 18, 19, 21, 22, 24, 25, 27, 28, 31, 32;31 is a review with no service operation required. No routine approval prompt is added. No implementation, live evidence, schema change, activation-default change or Git mutation is authorized by this planning record.

## Multi-source audit

| Source | ID | Feature or constraint | Plans | Planning coverage |
|---|---|---|---|---|
| GOAL | Phase 4 | CSV joiner/mover/leaver within 300 seconds with native correlation, repair, retry and audit | 01–32 | COVERED |
| GOAL | SC1 | Reference CSV, one immutable-key Identity, numbered configuration and explicit reload | 01–05,10,14–18 | COVERED |
| GOAL | SC2 | Actual<=300 second joiner/mover/terminated leaver, PUT disable and role retention | 02,11,14–19 | COVERED |
| GOAL | SC3 | Native confirmed manual claim, no duplicate, protected exclusion and subsequent source-key linkage | 06,08–12,15,20–22 | COVERED |
| GOAL | SC4 | CSV joiner outage native pending/automatic recovery plus complete managed drift repair | 07,09,13,16,20,22–25 | COVERED |
| GOAL | SC5 | Native causal audit, matching SCIM log, genuine recapture/replay and full backend gate | 06,17–32 | COVERED |
| REQ | ENG-01 | Strict reference import, immutable employeeNumber and scoped HR authority | 01, 02, 03, 04, 05, 06, 08, 10, 11, 14, 15, 17, 18, 19, 22, 26, 27, 28, 29, 30, 31, 32 | COVERED |
| REQ | ENG-02 | Healthy-stack 300 second lifecycle and unchanged-byte UTC date behavior | 01, 02, 06, 08, 10, 11, 14, 15, 16, 17, 19, 26, 27, 28, 29, 30, 31, 32 | COVERED |
| REQ | ENG-03 | Complete nightly managed repair and compliant native pending refresh | 03, 04, 05, 06, 07, 09, 13, 16, 18, 20, 22, 23, 24, 25, 28, 29, 30, 31, 32 | COVERED |
| REQ | ENG-04 | Connected native cause/decision, request source/target/outcome and resulting state | 06, 07, 09, 12, 13, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 | COVERED |
| REQ | PROV-06 | Explicit native operator case decision before exact keyed remote claim | 03, 06, 08, 09, 11, 12, 15, 20, 21, 22, 28, 29, 30, 31, 32 | COVERED |
| REQ | LIFE-04 | Durable CSV-origin blocking failure and automatic completion after Keycloak recovery | 07, 09, 13, 16, 23, 24, 25, 28, 29, 30, 31, 32 | COVERED |
| CONTEXT | P4-01 | P4-01/P4-04: One manifest fixes production/supporting OIDs and separates the discovery spike; configuration reload cannot target workforce User objects. | 03, 04, 05, 10, 14, 17, 18, 30, 32 | COVERED |
| CONTEXT | P4-02 | P4-02/P4-03: Seed and both reload paths use the same named-slot renderer, validate the complete set and token before mutation, and transport secrets only through protected stdin/environment. | 04, 05, 17, 18, 30, 32 | COVERED |
| CONTEXT | P4-03 | P4-02/P4-03: Seed and both reload paths use the same named-slot renderer, validate the complete set and token before mutation, and transport secrets only through protected stdin/environment. | 04, 05, 10, 17, 18, 30, 31, 32 | COVERED |
| CONTEXT | P4-04 | P4-01/P4-04: One manifest fixes production/supporting OIDs and separates the discovery spike; configuration reload cannot target workforce User objects. | 03, 04, 05, 14, 16, 17, 18, 30, 31, 32 | COVERED |
| CONTEXT | P4-05 | P4-05/P4-06/P4-07/P4-08: UTF-8 snapshots preserve exact trimmed string keys and reject structural defects as a whole; invalid keyed activation disables visibly. | 01, 02, 05, 10, 14, 18, 32 | COVERED |
| CONTEXT | P4-06 | P4-05/P4-06/P4-07/P4-08: UTF-8 snapshots preserve exact trimmed string keys and reject structural defects as a whole; invalid keyed activation disables visibly. | 01, 02, 10, 14, 15, 19, 31, 32 | COVERED |
| CONTEXT | P4-07 | P4-05/P4-06/P4-07/P4-08: UTF-8 snapshots preserve exact trimmed string keys and reject structural defects as a whole; invalid keyed activation disables visibly. | 01, 02, 08, 10, 14, 16, 17, 19, 32 | COVERED |
| CONTEXT | P4-08 | P4-05/P4-06/P4-07/P4-08: UTF-8 snapshots preserve exact trimmed string keys and reject structural defects as a whole; invalid keyed activation disables visibly. | 01, 02, 10, 14, 19, 32 | COVERED |
| CONTEXT | P4-09 | P4-09/P4-10/P4-11: Real pinned connector exchanges and post-write state establish every required D19 field, claim assertion and optional clear. | 11, 14, 15, 17, 19, 28, 29, 32 | COVERED |
| CONTEXT | P4-10 | Define fixed configuration identities and full local schema validation | 03, 08, 11, 14, 19, 28, 32 | COVERED |
| CONTEXT | P4-11 | Create closed phase evidence, audit and population validators offline | 06, 08, 11, 14, 17, 19, 28, 29, 31, 32 | COVERED |
| CONTEXT | P4-12 | Create closed phase evidence, audit and population validators offline | 06, 09, 12, 15, 20, 21, 28, 31, 32 | COVERED |
| CONTEXT | P4-13 | Create closed phase evidence, audit and population validators offline | 06, 08, 09, 11, 12, 15, 20, 21, 28, 31, 32 | COVERED |
| CONTEXT | P4-14 | Create closed phase evidence, audit and population validators offline | 06, 09, 12, 15, 20, 21, 28, 29, 31, 32 | COVERED |
| CONTEXT | P4-15 | P4-15/P4-29: Namespace-aware full local XSD validation rejects unresolved imports, wrong parents/types/sequence and unknown vocabulary; dynamic CSV/SCIM fields still require live discovery. | 03, 09, 12, 15, 20, 21, 31, 32 | COVERED |
| CONTEXT | P4-16 | P4-16/P4-18: Termination, date expiry, valid-snapshot disappearance and assignment removal disable rather than delete, retaining focus/link/history. | 15, 16, 17, 19, 28, 31, 32 | COVERED |
| CONTEXT | P4-17 | P4-17: Independent suspended tasks define HR 300 second live sync/date reevaluation, HR 01:00 UTC and managed repair 02:00 UTC without same-projection overlap. | 16, 17, 19, 22, 30, 32 | COVERED |
| CONTEXT | P4-18 | P4-16/P4-18: Termination, date expiry, valid-snapshot disappearance and assignment removal disable rather than delete, retaining focus/link/history. | 15, 16, 20, 22, 32 | COVERED |
| CONTEXT | P4-19 | P4-19/P4-20/P4-21: Population evidence accounts for at least125 owned plus independent manual/protected/foreign controls, retained absent-HR and lost-link cases, without claiming arbitrary orphan inventory. | 06, 16, 20, 22, 28, 29, 30, 31, 32 | COVERED |
| CONTEXT | P4-20 | P4-19/P4-20/P4-21: Population evidence accounts for at least125 owned plus independent manual/protected/foreign controls, retained absent-HR and lost-link cases, without claiming arbitrary orphan inventory. | 06, 20, 22, 28, 32 | COVERED |
| CONTEXT | P4-21 | P4-19/P4-20/P4-21: Population evidence accounts for at least125 owned plus independent manual/protected/foreign controls, retained absent-HR and lost-link cases, without claiming arbitrary orphan inventory. | 06, 16, 20, 22, 30, 32 | COVERED |
| CONTEXT | P4-22 | P4-22/P4-23: Real per-operation attempts obey observed Retry-After, increasing delay from60seconds capped3600, ten-failure attention and continuing capped cadence;401/403 suspend writes. | 07, 09, 13, 16, 23, 24, 25, 28, 30, 31, 32 | COVERED |
| CONTEXT | P4-23 | P4-22/P4-23: Real per-operation attempts obey observed Retry-After, increasing delay from60seconds capped3600, ten-failure attention and continuing capped cadence;401/403 suspend writes. | 07, 09, 13, 16, 23, 24, 25, 30, 31, 32 | COVERED |
| CONTEXT | P4-24 | Prepare retry eligibility and isolated gate control contracts offline | 07, 09, 13, 23, 25, 28, 29, 30, 31, 32 | COVERED |
| CONTEXT | P4-25 | Prepare retry eligibility and isolated gate control contracts offline | 07, 13, 23, 24, 28, 32 | COVERED |
| CONTEXT | P4-26 | Orchestrator-run live lifecycle tracer from CSV through native audit to Strapi | 19, 26, 27, 30, 32 | COVERED |
| CONTEXT | P4-27 | P4-27: Each accepted lifecycle record joins HR cause/key, native focus/task/case/audit and exact SCIM target/outcome to resulting state/lastSyncedAt. | 06, 07, 12, 13, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 | COVERED |
| CONTEXT | P4-28 | Create closed phase evidence, audit and population validators offline | 06, 26, 28, 29, 30, 31, 32 | COVERED |
| CONTEXT | P4-29 | Freeze the shared baseline and executable HR fixture contract | 01, 03, 06, 07, 08, 09, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32 | COVERED |
| CONTEXT | P4-30 | P4-30: The current unfiltered shared-backend result is recorded before implementation, with WINDOWS.md entry 11 inspected rather than inherited exclusions. | 01, 29, 30, 31, 32 | COVERED |
| RESEARCH | R1 | Pinned4.8.14/SCIM2 V1.2.9/source identity; preserve spike | 03–05,10–18,32 | COVERED |
| RESEARCH | R2 | Full local XSD imports/entities/network closure and dynamic-schema distinction | 03,08–16,18,32 | COVERED |
| RESEARCH | R3 | Actual runtime Java/JAXP/CSV 1.10.0 availability before helper/parser use | 02,04,05,08,10,14 | COVERED |
| RESEARCH | R4/A1 | Whole accepted immutable snapshot, scheduled invocation and UTC reevaluation | 01,02,08,10,14,16,17,19 | COVERED |
| RESEARCH | R5 | Complete-set render/prevalidate/suspend/apply/connection/enable and cleanup | 03–05,17,18 | COVERED |
| RESEARCH | R6/A3 | Enterprise assertion/update and each optional clear; null omission/name restoration hazards | 08,11,14,17,19,28,29 | COVERED |
| RESEARCH | R7/A2 | Actual employee/email filter translation, escaping and complete bounded lookups | 06,08,11,12,20–22 | COVERED |
| RESEARCH | R8/A4 | Native focus-owner versus remote-shadow seam; no predecision write | 06,09,12,15,20,21 | COVERED |
| RESEARCH | R9/A5 | Complete repository focus/retained-link iteration, targeted id/key recovery beyond 100 | 06,16,20,22 | COVERED |
| RESEARCH | R10/A6 | Fault header/classification gap, actual durable pending, increasing/capped real-time cadence | 07,09,13,16,23–25 | COVERED |
| RESEARCH | R11 | Shared exclusion across writers, independent UTC tasks and actual <=300 second outcome | 16,17,19,20,22 | COVERED |
| RESEARCH | R12 | Native audit causal graph, operator identity and activity versus committed state | 06,12,17,19,21–29 | COVERED |
| RESEARCH | R13 | Genuine CSV joiner/mover/reactivation outage; independent existing leaver outbox | 07,23,24 | COVERED |
| RESEARCH | R14 | Remote503/30 rollback distinct409 without backend reclassification | 07,09,13,23,25,29 | COVERED |
| RESEARCH | R15 | Cold full-reference before warm, separate125run, no extrapolation | 26,27 | COVERED |
| RESEARCH | R16 | Phase-local genuine capture, byte-exact replay and historical evidence retention | 06,26,28,29 | COVERED |
| RESEARCH | R17 | Review threats, unchanged shared contracts/grants/defaults, unfiltered final suites | 01,30–32 | COVERED |
| RESEARCH | R18 | No dependency installation, no runtime binary committed and no midPoint in CI | 02–05,14,29,32 | COVERED |

No in-scope source item is omitted. A failed compatibility experiment records BLOCKED evidence and leaves affected requirements pending; it does not remove its planned feature.

## Brief decision continuity

| Decisions | Phase 4 treatment |
|---|---|
| D1,D2,D3,D4,D8 | midPoint remains lifecycle engine, Strapi remains API/Keycloak writer; CSV reference and IAM paths/terms preserved (01,02,14–16,19,24). |
| D5,D9,D10 | Existing compose project/runtime/connector pins and distinct spike remain (03–05,10,18,32). |
| D6,D12,D19,D20 | HR identity/status authority, exact D19 mapping, PUT disable and IdamBox-only role grants (11,14–19,21–25,29). |
| D7,D25,D26 | Existing five-phase milestone/workstream boundary remains; only Phase 4 plans are created. |
| D11,D15,D18 | Existing SCIM source bearer/API/captured CI contract, no midPoint CI, fixed tasks and replay (04–09,16,18,28,29,32). |
| D13 | Native confirmed manual-target claim with exact employee assertion and subsequent source/key linkage (06,09,12,15,20–22). |
| D14,D22 | Existing schema and UI boundary retained; no new HR fields/content types or CSRM UI (14,29,32). |
| D16,D21 | Blocking creates/updates retry natively; leaver existing outbox preserved; connected native/SCIM audit (07,13,23–25,28,29). |
| D17 | No source password; Phase 5 owns password-email/browser acceptance. Observe provisioning side effects only as measurement facts. |
| D23 | Delivered read-only objects-src, private initial seed and cache-aware REST PUT override original writable/Ninja wording (03–05,18,30). |
| D24 | Existing ADR authority remains; this phase does not reopen settled engine/schema decisions. |

## API capability scope

All 21 existing reservations function.identity_provisioning.api.api.01–.21 and their Function/Role/Application linkage remain unchanged. Phase 4 adds configuration and test/capture coverage, no route, permission, schema or API operation. Existing regression remains the authority for inherited behavior. A listed opt-out concerns new Phase 4 scenarios only and never removes existing checks or grants.

| capability | decision | reason |
|---|---|---|
| GET /scim/v2/Users | INTEGRATE | Targeted complete employee/email/source-key lookups are required for claims, lost-link recovery and managed repair. |
| POST /scim/v2/Users | INTEGRATE | CSV joiner creation and durable outage rollback/automatic recovery are required lifecycle behavior. |
| GET /scim/v2/Users/{id} | INTEGRATE | Known-id reads prove D19 results and complete repository-known projection repair. |
| PUT /scim/v2/Users/{id} | INTEGRATE | Movers, explicit clears, confirmed keyed claims, disable and same-key reactivation require actual PUT behavior. |
| PATCH /scim/v2/Users/{id} | INTEGRATE | Preserve and replay the actual remove/add email PATCH sequence; claims still require keyed PUT. |
| DELETE /scim/v2/Users/{id} | OPT-OUT | Normal leavers require PUT disable under D12/P4-16. Preserve existing DELETE tombstone conformance and historical replay; add no lifecycle DELETE use. |
| GET /scim/v2/ServiceProviderConfig | INTEGRATE | Retain authenticated discovery and connection compatibility with the existing unchanged capability contract. |
| GET /scim/v2/Schemas | INTEGRATE | Discovery grounds actual dynamic attribute names and schema compatibility; add no new backend schema. |
| GET /scim/v2/Schemas/{id} | OPT-OUT | No new descriptor or descriptor-id scenario is needed in Phase 4; preserve the inherited Phase 3 contract and unfiltered regression. |
| GET /scim/v2/ResourceTypes | INTEGRATE | The connector connection test requires actual User and Group resource-type discovery. |
| GET /scim/v2/ResourceTypes/{id} | OPT-OUT | No new resource type is introduced; retain existing by-id discovery behavior through inherited regression. |
| GET /scim/v2/Groups | INTEGRATE | The existing empty Group ListResponse remains part of connector compatibility; no membership or role provisioning. |
| GET /scim/v2/Groups/{id} | OPT-OUT | Phase 4 has no Group membership consumer. Preserve inherited authenticated404 behavior and existing grants. |
| POST /scim/v2/Groups | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| PUT /scim/v2/Groups | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| PATCH /scim/v2/Groups | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| DELETE /scim/v2/Groups | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| POST /scim/v2/Groups/{id} | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| PUT /scim/v2/Groups/{id} | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| PATCH /scim/v2/Groups/{id} | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |
| DELETE /scim/v2/Groups/{id} | OPT-OUT | Group/role provisioning is deferred by D6/D11/D20 and P4-09. Preserve existing authenticated/grant/throttle501 behavior and all human grants. |

### Route and plan traceability

| Reservation | Existing method/path | Decision | Phase 4 contribution or reasoned opt-out | Plans |
|---|---|---|---|---|
| .01 | GET /scim/v2/Users | INTEGRATE | New targeted employeeNumber/emails.value correlation and exact source-key recovery, with complete bounded results | 08,11,12,20–22,28,29 |
| .02 | POST /scim/v2/Users | INTEGRATE | New CSV-origin joiner, Requestor-only create, outage rollback/pending/automatic retry | 17,19,23,24,28,29 |
| .03 | GET /scim/v2/Users/{id} | INTEGRATE | Known-projection reads for complete managed repair and actual post-write values | 11,19,22,28,29 |
| .04 | PUT /scim/v2/Users/{id} | INTEGRATE | D19 mover/clears, first keyed confirmed claim, disable and same-key reactivation | 11,12,15,19,21–25,28,29 |
| .05 | PATCH /scim/v2/Users/{id} | INTEGRATE | Preserve actual connector remove/add email update sequence; no PATCH claim | 08,11,19,28,29 |
| .06 | DELETE /scim/v2/Users/{id} | OPT-OUT | Reasoned opt-out of lifecycle use: D12/P4-16 requires PUT disable; retain historical tombstone conformance/replay unchanged | 15,19,28,29,32 |
| .07 | GET /scim/v2/ServiceProviderConfig | INTEGRATE | Inherited authenticated discovery; retain existing contract and baseline capture; no capability expansion | 18,28,29,32 |
| .08 | GET /scim/v2/Schemas | INTEGRATE | Inherited discovery contributes actual schema/attribute verification; no new schema | 10,11,18,28,29,32 |
| .09 | GET /scim/v2/Schemas/{id} | OPT-OUT | Reasoned opt-out of new scenarios: Phase 3 descriptor contract unchanged; unfiltered regression retains coverage | 29,32 |
| .10 | GET /scim/v2/ResourceTypes | INTEGRATE | Actual connector connection prerequisite with User and Group | 11,18,28,29 |
| .11 | GET /scim/v2/ResourceTypes/{id} | OPT-OUT | Reasoned opt-out of new scenarios: no new resource type; inherited Phase 3 regression | 29,32 |
| .12 | GET /scim/v2/Groups | INTEGRATE | Inherited empty ListResponse required for connection compatibility; no role/group provisioning | 18,28,29,32 |
| .13 | GET /scim/v2/Groups/{id} | OPT-OUT | Reasoned opt-out of new scenarios: no Group membership consumer; inherited authenticated404 | 29,32 |
| .14 | POST /scim/v2/Groups | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .15 | PUT /scim/v2/Groups | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .16 | PATCH /scim/v2/Groups | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .17 | DELETE /scim/v2/Groups | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .18 | POST /scim/v2/Groups/{id} | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .19 | PUT /scim/v2/Groups/{id} | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .20 | PATCH /scim/v2/Groups/{id} | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |
| .21 | DELETE /scim/v2/Groups/{id} | OPT-OUT | Reasoned opt-out: Group/Role provisioning is deferred by D6/D11/D20 and P4-09; retain authenticated/grant/throttle501 contract and all existing human grants | 29,32 |

## Assumptions and edge resolution

| Concern | Explicit obligation | Plans |
|---|---|---|
| ENG-01 adjacency/empty/ordering | Exact ordered headers and whole-snapshot rejection before publication; valid UTF-8 full-header zero-record input accepts automatically as complete population 0 and disables all formerly managed projections with links/history retained. Empty bytes or missing/unreadable/broken sources reject without user-state mutation. | 01,02,08,10,17,19 |
| ENG-04 adjacency/empty/ordering/concurrency | Complete nonempty cause/decision/request/state graph; native decision precedes write and concurrent flows retain independent source/key/target attribution. | 06,12,17,19,21–29 |
| LIFE-04 idempotency/concurrency | One durable target/operation, one shared write exclusion group, no duplicate/adoption across failures and automatic recovery; backend leaver outbox independent. | 07,09,13,16,23–25 |
| ENG-02 unclassified timing | Flagged runtime assumption:300 second polling alone is insufficient. Actual near-worst-phase observation>=300 seconds and each healthy publication-to-commit<=300 seconds, including unchanged-byte dates. | 17,19 |
| ENG-03 unclassified completeness/retry | Flagged runtime assumption: independently count125owned plus controls and retained/lost links; observe actual UTC schedules and supported per-operation header/backoff/pending behavior. | 07,09,13,16,20,22 |
| PROV-06 unclassified native case | Flagged runtime assumption: candidates are native focuses; real remote-shadow claim seam needs exact native graph/operator/time/no-write and selected keyed PUT or BLOCKED. | 09,12,15,21 |

## Explicit scope exclusions

DatabaseTable/SIMS/customer connectors, secret-provider integration, connector replacement/upgrade, arbitrary remote orphan discovery, remote-conflict status reclassification, new HR/backend fields, source screens, role/group provisioning and change-log integration remain deferred under P4scope. Phase 5 retains set-password email, browser sign-in and full CSV-to-browser acceptance. Cold throughput applies only to the measured reference dataset, distinct from125-user completeness. No full remote inventory claim is made.

## Final acceptance

Plan 32 maps six requirements to all five roadmap criteria, after review 31 and genuine capture 28/replay 29. Final `pnpm --dir apps/backend test` is unfiltered; current WINDOWS.md entry 11 is inspected in 01 and 32, with any diagnostic subsets recorded separately. Missing live evidence cannot mark a requirement complete. STATE.md remains outside plan ownership.


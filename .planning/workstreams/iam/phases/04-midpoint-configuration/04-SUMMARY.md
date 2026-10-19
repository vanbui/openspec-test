---
phase: 04-midpoint-configuration
workstream: iam
status: complete
completed: 2026-10-16
consolidated: true
source: [04-EXECUTION.md, 04-VERIFICATION.md, 04-LIVE-EVIDENCE.md, 04-CONTEXT.md]
requirements-completed: [ENG-01, ENG-02, ENG-03, ENG-04, PROV-06, LIFE-04]
commits: [7d9cd434, f900418d, 296af908, 3353b875]
amendments: [A1, A2, A3, A4, A5, A6, A7, A8, A9, A10]
---

# Phase 4 Summary: midPoint configuration

This is one consolidated summary for all 32 plans, not one per plan. Phase 4 ran on 2026-10-16 as a single orchestrator-driven pass (`04-EXECUTION.md` explains why and gives each plan's disposition). This file was written afterwards, on 2026-10-19, from the execution and verification records. It adds no new claims.

HR CSV joiners, movers and leavers reach Strapi through midPoint 4.8.14 and the SCIM2 connector V1.2.9. Correlation is on `employeeNumber`, and the sync runs on a 5-minute live-sync cycle. Deactivation is `PUT active=false`, never `DELETE`. Pre-existing manual users are claimed only after operator confirmation. Nightly reconciliation, a pending refresh and durable retry-later triggers handle outages and drift, and both midPoint's audit and Strapi's SCIM log record every decision.

## What landed

| Area | Files |
| --- | --- |
| Resources | `docker/midpoint/objects/100-resource-hr-csv.xml`, `110-resource-idambox-scim.xml` (connector paging A4, email form A7, native correlation A8, delete capability disabled) |
| Template and archetype | `140-object-template-hr-person.xml`, `150-archetype-hr-person.xml`; schema extension `docker/midpoint/schema/idambox-extension.xsd` (A3) |
| Tasks | `300` HR live sync (300 s), `310` HR reconciliation, `320` IdamBox reconciliation, `330` pending refresh, `340` validity scan; retry-later on every task (A5) |
| Seed and reload | `render.sh` token renderer (A1), `init.sh`, `reload.sh`, `reload.ps1`; fixed OIDs in dependency order (A9) |
| HR snapshot | `docker/midpoint/hr/reference.csv`, `hr-validate.mjs` whole-snapshot check at publication (A2) |
| Capture and replay | Phase 4 capture runner, `evidence/connector-capture/`, `apps/backend/tests/iam-scim-replay-phase4.integration.test.ts` (A10) |
| Docs | `docker/README.md`, `docker/midpoint/hr/README.md`, `docker/midpoint/e2e/README.md`, ADR 0006 Phase 4 observations |

## Requirements

| ID | Evidence (04-VERIFICATION.md) |
| --- | --- |
| ENG-01 | Criterion 1: CSV import, correlation on `employeeNumber`, numbered objects applied by reload (LIVE §1, §2) |
| ENG-02 | Criterion 2: scheduler-only cycle of 4 min 58 s, mover kept `Security Analyst`, zero `DELETE` (LIVE §2) |
| ENG-03 | Criterion 4: drift repair on 139/139 users, refresh and retry; nightly schedules configured and triggered on demand (LIVE §4, §5) |
| ENG-04 | Criterion 5: native audit and SCIM log per decision; recaptured traffic replays 2/2 (LIVE §7, §8) |
| PROV-06 | Criterion 3: operator-confirmed claims without duplicates, rejected candidate untouched, relink by source key (LIVE §3, §9) |
| LIFE-04 | Criterion 4 via A5: 503 at 11:18:26, automatic 201 at 11:25:46 from a durable retry trigger (LIVE §4) |

## Deviations and limits

- Ten amendments (A1–A10 in `04-CONTEXT.md`) changed the design after the live compatibility probes. Plans 04-06 (partly), 04-07, 04-08, 04-09, 04-17, 04-20 and 04-23 were superseded, not dropped silently.
- 04-24: mover/reactivation and the leaver outbox during an outage were not re-run here. The outbox is Phase 2's gate. 04-25: the Keycloak email conflict (IN-03) was not exercised; Phase 5 later exercised it.
- 04-31: the review was done inline during execution, and there is no separate review report.
- Gate at the time: 2025/2025 backend tests, excluding two csrm red-phase files that blocked the unfiltered compile (WINDOWS.md entry 11). The unfiltered suite later passed at HEAD (2577/2577 in 03-VERIFICATION.md, 2026-10-19).

## Handoffs

- Reloading a task object resets its run state. Size Strapi's 600-per-minute source limit before a large source; the connector reaches it at about 150–200 users a minute.
- The Phase 1 spike resource `110-resource-scim-spike.xml` still sits in the default object set (see the milestone audit).

# Phase 4 verification: midPoint configuration

**Date:** 2026-10-16
**Verdict:** Phase 4 complete. Every success criterion was checked by the orchestrator against the running stack; delegated work was reviewed and re-run, never accepted on report.
**Evidence:** `04-LIVE-EVIDENCE.md` (live), `evidence/connector-capture/` (genuine capture), decisions and amendments in `04-CONTEXT.md`.

## Success criteria (ROADMAP.md Phase 4)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | The reference HR CSV with the D19 columns imports from `docker/midpoint/hr/`; one Identity per person named and correlated by `employeeNumber`; resources, template, mapping and tasks are numbered files applied with the reload scripts | **Met** | LIVE §1, §2; `docker/midpoint/objects/{100,110,140,150,300-340}`; fresh seeds ×4 with 10/10 objects, reload.sh and reload.ps1 live |
| 2 | Joiner, mover and leaver reach Strapi within one 5-minute live-sync cycle as create, attribute update and `PUT active=false`, never `DELETE`; the mover keeps IdamBox Roles | **Met** | LIVE §2: scheduler-only cycle 4 min 58 s (published 11:39:27, delivered 11:44:24.7–25.3); mover kept `Security Analyst`; zero `DELETE` in the session, delete capability disabled |
| 3 | A pre-existing manual user matching by email or employee number appears as a correlation case; only the operator's confirmation links them, without a duplicate; afterwards only the source key links; protected users are never candidates | **Met** | LIVE §3 (kai.manual, mia.manual beyond position 100 confirmed; lena.manual rejected, untouched; zero writes before decisions), §9 (fresh midPoint relinks by source key without duplicates); protected users are not listed to the source (Phase 2/3) |
| 4 | With Keycloak stopped, a CSV joiner's create answers 503 with `Retry-After`, waits in midPoint, and reaches Strapi and Keycloak after Keycloak returns without manual action; nightly reconciliation repairs drift (on demand) | **Met, with amendment A5** | LIVE §4 (503 at 11:18:26, automatic 201 at 11:25:46 via a durable retry trigger, not a provisioning pending operation, because the connector reports 503 as a generic error); LIVE §5 (drift at list position 134 repaired; 139/139) |
| 5 | midPoint's audit shows each joiner, mover and leaver decision with its cause and Strapi's SCIM log the matching request; the replay tests match the requests this configuration sends (re-captured); `pnpm --dir apps/backend test` passes | **Met** for audit and replay; backend gate below | LIVE §7, §8; `iam-scim-replay-phase4.integration.test.ts` 2/2, Phase 3 replay unchanged and passing |

Carried from Phase 3: P3-36 is answered by connector-side paging (A4), proven on 139 users; IN-03 (Keycloak email conflict as 503) is unchanged and was not exercised (LIVE §11).

## Requirements

| ID | Status | Note |
| --- | --- | --- |
| ENG-01 | Complete | criterion 1 |
| ENG-02 | Complete | criterion 2; the bound holds while a sync run finishes well inside its interval |
| ENG-03 | Complete | criteria 4 (drift repair, retry); nightly cron patterns configured, not waited for |
| ENG-04 | Complete | criterion 5 |
| PROV-06 | Complete | criterion 3 |
| LIFE-04 | Complete | criterion 4, via amendment A5 |

## Gate

| Check | Result |
| --- | --- |
| Full backend suite (all compiled tests except the two WINDOWS.md entry 11 csrm files), committed defaults only, 12:11–12:49 UTC | **2025 tests, 2025 pass, 0 fail, 0 skipped** (Phase 3: 2012; +13 Phase 4 tests) |
| `pnpm --dir apps/backend test` unfiltered | stops at test compilation with 3 errors in each of `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` only (WINDOWS.md entry 11, owner csrm), as in Phase 3 |
| Shell tests `docker/midpoint/tests/*.test.sh` | 4/4 ALL PASS |
| `capture-scim.mjs --check`, `capture-lifecycle.mjs --check`, `capture-lifecycle.mjs --verify-evidence` | pass |
| Capture tooling unit tests and both replay tests | pass |
| OpenAPI contract, catalogue copies, content types | unchanged (no backend source change in this phase); `api:check` not required |
| Committed Keycloak and OIDC flags | unchanged (false) |

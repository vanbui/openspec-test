# Phase 4 execution record

**Executed:** 2026-10-16, one session, as a single orchestrator-driven pass over the 32 checked plans.
**Why consolidated:** the plans put four live compatibility probes (04-10 to 04-13) before any dependent configuration, with offline harnesses (04-06 to 04-09) built first to drive them. The probes were run directly against the pinned runtime instead, on the real configuration objects, and their results (amendments A1–A10 in `04-CONTEXT.md`) changed what several later plans had to build. Plans whose purpose an amendment removed are marked superseded; nothing in them was silently dropped, and every roadmap criterion is checked in `04-VERIFICATION.md`.

## Commits

| Commit | Content |
| --- | --- |
| `fc04cbdd` | discussion (P4-01 to P4-30) |
| `ab697b28` | research, patterns, validation strategy, 32 plans, plan check |
| `7d9cd434` | HR CSV resource, IdamBox SCIM resource, archetype, template, five tasks, renderer, HR publish, reference CSV, schema extension, compose/init/reload changes |
| `f900418d` | retry-later on every task, strong displayName, reload.ps1 parity, shell tests, operations docs, ADR 0006 Phase 4 observations |
| `296af908` | Phase 4 capture runner, genuine capture evidence, fixture, replay test, live evidence |
| `3353b875` | HR snapshot validation before publication (duplicate-key defect) |

## Plan disposition

| Plan | Disposition |
| --- | --- |
| 04-01 baseline and HR fixture contract | Done: `docker/midpoint/hr/reference.csv`, capture fixtures `docker/midpoint/e2e/fixtures/phase4/`; baseline suite 2012/2012 before changes |
| 04-02 whole-snapshot acceptance and UTC activation | Done as amended (A2): `hr-validate.mjs` at publication; activation in the HR resource mappings, verified live |
| 04-03 fixed identities and schema validation | Done: fixed OIDs `11000000-…-000000000{100,110,140,150,300-340}`; `docker/midpoint/tests/objects.test.sh` |
| 04-04 secure credential renderer | Done (A1): `docker/midpoint/render.sh`, `tests/render.test.sh` |
| 04-05 seed, Bash and PowerShell reload contract | Done: `init.sh`, `reload.sh`, `reload.ps1`, both reload paths run live |
| 04-06 evidence, audit and population validators | Partly superseded: capture evidence verifier extended (`scim-evidence.mjs` phase4 profile); population counted live (LIVE §5) instead of an offline validator (A4) |
| 04-07 retry eligibility and gate controls | Superseded by A5 (no supported increasing-backoff policy); retry proven live |
| 04-08, 04-09 CSV, connector, case and pending-operation probe harnesses | Superseded: probes run directly live |
| 04-10 to 04-13 live probes | Done: LIVE §2 (CSV, dates), §2 (D19 writes, email form), §3 (native cases), §4 (retry) |
| 04-14 persistent HR and D19 configuration | Done: `100-resource-hr-csv.xml`, `110-resource-idambox-scim.xml` |
| 04-15 template, native cases, disable semantics | Done: `140-object-template-hr-person.xml`, `150-archetype-hr-person.xml`, correlation and reactions in `110` |
| 04-16 schedules, complete repair, pending refresh | Done: `300`–`340` |
| 04-17 convergence and timing checks offline | Superseded: measured live (LIVE §1, §2) |
| 04-18 secure seed and reload convergence (live) | Done: four fresh seeds, reload.sh/ps1 live |
| 04-19 lifecycle tracer CSV → audit → Strapi (live) | Done: LIVE §2, §7 |
| 04-20 authority and >100 gates offline | Superseded by the live 139-user run (LIVE §5) |
| 04-21 confirmed claims and protected boundaries (live) | Done: LIVE §3 |
| 04-22 125-user repair and nightly schedules (live) | Done, schedules triggered on demand (LIVE §5, §11) |
| 04-23 outage, recovery and conflict gates offline | Superseded |
| 04-24 outage recovery and leaver outbox (live) | Joiner recovery done (LIVE §4); mover/reactivation during an outage and the leaver outbox during an outage not re-run in this phase (LIVE §11; the outbox is Phase 2's gate) |
| 04-25 remote conflict rollback and bounded attention (live) | Partly: a rejected claim keeps answering 409 at the 15-minute retry interval without writes (LIVE §3); the Keycloak-side email conflict (IN-03) not exercised |
| 04-26, 04-27 throughput runner and first full reconciliation | Done: LIVE §6 |
| 04-28 genuine recapture | Done: LIVE §8 |
| 04-29 replay | Done: `iam-scim-replay-phase4.integration.test.ts` 2/2 |
| 04-30 documentation and final validator | Done: `docker/README.md`, `docker/midpoint/hr/README.md`, `docker/midpoint/e2e/README.md`, ADR 0006 |
| 04-31 review of configuration, scripts and threat mitigations | Orchestrator review during execution (findings fixed: email churn, multi-valued department, administrative status overriding validity, live sync stopping on one error, duplicate keys, capture runner JSON handling); no separate review report this phase |
| 04-32 final acceptance | `04-VERIFICATION.md` |

## Handoffs and follow-ups

- **Operations:** a reload of a task object resets its run state (documented). The connector's request volume (three to four requests per operation) meets Strapi's 600-per-minute source limit at about 150–200 users a minute; size the limit before a large source (ADR 0006, LIVE §6).
- **Phase 5:** the developer stack holds the reference people, 125 load users, the claimed `kai.mann`/`mia.moss`, and the manual `lena.manual`, all fictitious; Keycloak provisioning is on in the git-ignored backend `.env`. Reset as `docker/README.md` describes before Phase 5's gate.
- **csrm:** none new.

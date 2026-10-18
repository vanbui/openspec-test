---
phase: 01-midpoint-platform-and-connector-spike
workstream: iam
verified: 2026-10-14
status: passed
requirements: [PLAT-01, PLAT-02, PLAT-03]
go_no_go: go
---

# Phase 1 Verification

Checked against the live `idp` stack and the ROADMAP Phase 1 success criteria.

| # | Success criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | With `docker/.env` from `.env.example`, one compose command starts Keycloak, ClamAV, midPoint 4.8.14 LTS (pinned tag) with its PostgreSQL 16 repository prepared by the one-shot init, and Mailpit; midPoint answers on `127.0.0.1:8081`; no credential or binary is tracked. | **Pass** | `evidence/fresh-stack-go.txt`: after `down -v`, `docker compose --profile scim-spike up -d` brought up all services (midPoint, Postgres and Mailpit healthy, init `Exited (0)` after creating both schemas); console `127.0.0.1:8081/midpoint/` → 302 to login; realm discovery → 200; Mailpit API → 200. Images pinned: `evolveum/midpoint:4.8.14-alpine`, `postgres:16-alpine`, `axllent/mailpit:v1.31.5`, `nginx:1.28.0-alpine`. `docker/.env` is git-ignored and created by `new-env.sh`; no JAR under version control; the connector is built in the image. The Keycloak realm fixtures stay as the documented local-only values (context override of P1-14). |
| 2 | **Go/no-go:** the multi-stage `docker/midpoint/Dockerfile` image (connector `V1.2.9` from source) lists the SCIM2 connector, and a resource on it passes its connection test against a stub `/ResourceTypes` listing User and Group; result recorded. | **Pass — GO** | `spike-test.sh`: exactly one connector with type `com.exclamationlabs.connid.base.scim2.Scim2Connector` **and** version 1.2.9 (REST search on both), resource `11000000-0000-4000-8000-000000000001` test `success` in every step, stub logged `GET /scim/v2/ResourceTypes 200` during the test. Recorded in ADR 0006 and the evidence file, with source commit `05c404bb…`, bundle SHA-256 and resolved classpath. |
| 3 | Edit a numbered object in `docker/midpoint/objects/`, run `reload.ps1` or `reload.sh`, see the change; `docker compose down -v` returns a clean stack; `*.done` ignored; README documents start, reset and reload. | **Pass** | Description edit → `reload.sh` → read back over REST showed the change; reverted the same way. `reload.ps1` passed in PowerShell 7 (Standard and Legacy argument passing) and Windows PowerShell 5.1; a bad object fails with HTTP 400 and exit 1; a missing file exits 1. `down -v` removed every volume and the next `up` re-created both schemas and re-seeded. Objects are mounted read-only, so `*.done` never appears in the repository (`docker/.gitignore` also ignores it). `docker/README.md`: Quickstart, Reset, midPoint, reload, connector check. |
| 4 | `docs/adr/` holds ADR 1 (midPoint as identity engine, SCIM 2.0 as only inbound contract, replacing the 2026-10-03 decision, which is marked superseded) and ADR 3 (versions, licence facts, community-support risk, fallback). | **Pass** | `docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md`, `docs/adr/0006-midpoint-lts-and-community-scim2-connector.md`; `docs/iam-early-research/IDENTITY-LIFECYCLE-BRIEF.md` carries the superseded notice and links ADR 0005. |

## Gate

- `pnpm --dir apps/backend test`: 1583 tests, **1581 pass, 1 fail, 1 skipped**. Phase 1 changes nothing under `apps/`. The failure (`questionnaire-ai-proposals.integration.test.ts:458`, `fetch failed` / `ECONNRESET`) predates this phase: it failed identically on a baseline run, fails when its file runs (19/20), and passes alone. Recorded in `.planning/WINDOWS.md` for the `csrm` workstream.
- `docker/midpoint/tests/new-env.test.sh`: ALL PASS.
- Code review (`01-REVIEW.md`): 2 blockers and 2 warnings, all fixed and re-verified (resolution table in that file).

## Not proven here (by design)

The spike proves the connector loads on 4.8 and completes discovery. User provisioning, the lifecycle rules and SCIM conformance are proven against Strapi's real service in Phases 3 and 4.

---
phase: "01"
slug: "midpoint-platform-and-connector-spike"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-13"
---

# Phase 1 — Validation Strategy

## Test Infrastructure

Use Docker Compose smoke checks, shell/PowerShell syntax checks, authenticated midPoint REST assertions and the existing backend test suite. No new test framework.

- Quick: `docker compose --env-file docker/.env -f docker/docker-compose.yaml config --quiet` (requires ignored local env).
- Full regression: `pnpm --dir apps/backend test`.
- Live integration: build, startup, connector listing, connection test with observed stub request, reload, reused-volume init and clean reset.
- Quick feedback target: 30 seconds; image build and startup are bounded integration gates with longer timeouts.

## Sampling Rate

After each task run the relevant syntax/config/assertion check. After each wave run its available smoke slice. Before phase verification run the full lifecycle checks and backend suite. Every automated command in plans must state its observable failure condition.

## Per-Task Verification Map

| Task | Wave/dependency | Automated gate | Observable failure |
|---|---|---|---|
| 01-01-01 | Wave1; Wave0 helper created in this task | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Tooling -TimeoutSeconds 30` | Parser/env/exclusion failure or timeout |
| 01-01-02 | Wave1; 01-01-01 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Fixtures -TimeoutSeconds 30` | Invalid XML/JSON, missing User/Group, wrong version/OID or source token |
| 01-02-01 | Wave2; plan01 prerequisites | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode ComposeStatic -TimeoutSeconds 60`; `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Build -TimeoutSeconds 1800`; `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Start -TimeoutSeconds 600`; `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Spike -TimeoutSeconds 900` | Invalid isolation, build/init/audit/readiness, exact-one connector, successful OperationResult or correlated 2xx ResourceTypes request missing |
| 01-02-02 | Wave2; 01-02-01 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Record -TimeoutSeconds 60` | Missing actual provenance/audit/test evidence, contradictory outcome or secret disclosure |
| 01-03-01 | Wave3; plan02 go | `bash -n docker/midpoint/reload.sh`; PowerShell ParseFile gate from plan03 | Either script has syntax errors |
| 01-03-02 | Wave3; 01-03-01 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Reload -TimeoutSeconds 1800`; `git status --short -- docker/midpoint/objects` | Non-root invocation/order/overwrite/failure propagation/REST description/source hashes fail |
| 01-04-01 | Wave4; 01-03 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Reused -TimeoutSeconds 1800` | Normal startup requires stub; repeated init reseeds; stale/duplicate bundle; state lost; partial/auth errors pass |
| 01-04-02 | Wave4; 01-04-01 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Reset -TimeoutSeconds 1800`; `pnpm --dir apps/backend test` | Ownership guard unmet; old state/profile survives; fresh import fails; backend test failure (900-second bound) |
| 01-05-01 | Wave5; 01-04 | Protected-file `git diff --exit-code` gate from plan05 | Existing fixture/ADR/predecessor changes |
| 01-05-02 | Wave5; 01-05-01 | `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Final -TimeoutSeconds 120` | Missing/failed evidence, changed fixture tables, tracked introduced secret/binary, ADR conflict or open high security finding |

All results are **pending execution**. The initial actual tracer closes plan02 before lifecycle/documentation expansion. Build mode runs exactly `docker compose --env-file docker/.env -f docker/docker-compose.yaml build midpoint_init midpoint_server` with a subprocess deadline. Helpers are created before references. Every automated element in plans has an immediately following `fails_when` sibling.

## Exact live operations

The verifier constructs administrator Basic auth in memory from ignored env; headers and complete object payloads never enter evidence. Spike GETs `http://127.0.0.1:8081/midpoint/ws/rest/connectors`, requires exactly one matching type/version1.2.9, POSTs `http://127.0.0.1:8081/midpoint/ws/rest/resources/11000000-0000-4000-8000-000000000001/test`, requires successful top-level/nested OperationResult, and reads `docker compose --env-file docker/.env -f docker/docker-compose.yaml logs --since MARKER scim_stub` for a subsequent successful GET ResourceTypes. Reload observes only description from the stable resource GET.

Init runs `/opt/midpoint/bin/midpoint.sh init-native`, positive authenticated schema probes, `/opt/midpoint/bin/ninja.sh -B run-sql --create --mode REPOSITORY`, then `--mode AUDIT` only for absent schemas. `docker compose --env-file docker/.env -f docker/docker-compose.yaml exec -T midpoint_server /opt/midpoint/bin/ninja.sh -B info` must return `Repository test: SUCCESS`. Imports are individually `/opt/midpoint/bin/ninja.sh -B import --overwrite --input FILE` in canonical lexical order, followed by restart and REST checks.

Reused mode performs stop/start; profile-aware down **without** -v; normal up; profile up; two `docker compose --env-file docker/.env -f docker/docker-compose.yaml run --rm midpoint_init` calls with server stopped, then starts server and reruns Spike. Reset performs `docker compose --env-file docker/.env -f docker/docker-compose.yaml --profile scim-spike down -v` only on the manifest-matching isolated disposable full-stack project, followed by profile up and fresh assertions. Optional profile containers are included in removal. Source filenames are never restored because they are never renamed.

Native/HTTP individual limits are 60/15 seconds and readiness600 seconds; full modes have the declared total deadline. Image build1800 and backend900-second gates are integration/regression checks, not quick tests. PLAT01/PLAT03 unclassified/unresolved assumptions remain visibly flagged until their explicit evidence is reviewed. The two descriptor-less bespoke prohibitions remain flagged-unverified; no wired-check proof is claimed.

## Wave 0 Requirements

Create the phase-owned bounded verification helper under docker/midpoint/ before any plan references it as executable. Validate status payloads and redact credentials. Existing backend infrastructure covers regression tests.

## Manual-Only Verifications

None planned. An actual connector no-go records failure and blocks Phase 2; selecting an alternate connector remains an operator decision outside this phase's non-interactive run.

## Validation Sign-Off

- [ ] Every task has automated verification and an explicit failure condition.
- [ ] Every helper referenced exists before its verification command runs.
- [ ] No watch mode; readiness and network operations have bounded timeouts.
- [ ] Live fresh/reused/reload/reset evidence is recorded without secrets.
- [ ] Backend regression gate is green.
- [ ] Execution audit sets nyquist_compliant and wave_0_complete from observed evidence.

**Approval:** Pending execution; planning does not assert runtime success.

## Revised execution context and additional checks

The commands above are canonical operator equivalents. All automated live modes prepend both ignored verification env/override files and the unique manifest project using the exact prefix in the plans; they derive every endpoint from that manifest. Tooling (01-01-01) creates this context; no canonical idp container/volume/port may remain in the merged isolated configuration. PostgreSQL/stub remain internal. The canonical idp baseline is compared unchanged after tests. Reset works whether or not canonical idp state already exists.

- 01-02-01 Start gate: `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Start -TimeoutSeconds 600`; startup/init/audit failure or deadline fails. ComposeStatic gate: `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode ComposeStatic -TimeoutSeconds 60`; invalid canonical/isolated config or any surviving canonical resource fails.
- 01-02-02 Record gate: `pwsh -NoProfile -File docker/midpoint/verify.ps1 -Mode Record -TimeoutSeconds 60`; missing provenance/actual connector/test/stub/audit evidence or conflicting outcome fails.
- 01-04-01 Reused additionally runs two consecutive documented `up -d --force-recreate` commands without down/run-init and requires new successful init container identities, removed older bundle sentinel and preserved schema/state.
- Audit readiness is independent of repository success: authenticated ON_ERROR_STOP SELECT count(*) against ma_audit_event, ma_audit_delta, ma_audit_ref must all succeed, and source/native config inheritance must agree. Broken audit state fails startup/readiness.
- Materialization fixture is cfg:token/t:clearValue with the types namespace; scalar token text or competing encryptedData fails. Generated String/confidential metadata is validated in build provenance.

Wave order is 1 prerequisite tooling/fixtures → 2 actual tracer/outcome → 3 reload → 4 reused/reset/backend → 5 docs/final review. Every result remains pending execution.

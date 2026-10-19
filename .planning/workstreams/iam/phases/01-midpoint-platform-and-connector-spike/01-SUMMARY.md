---
phase: 01-midpoint-platform-and-connector-spike
workstream: iam
status: complete
completed: 2026-10-13
requirements: [PLAT-01, PLAT-02, PLAT-03]
requirements-completed: [PLAT-01, PLAT-02, PLAT-03]
go_no_go: go
commits: [aa2bb310, 5e1e23db, 67fe2599]
---

# Phase 1 Summary: midPoint platform and connector spike

midPoint 4.8.14 LTS runs beside Keycloak in the `idp` compose project with its PostgreSQL 16 repository, Mailpit and a source-built Provision IAM SCIM2 connector `V1.2.9`. The connector **go/no-go gate passed ("go")** on a freshly reset stack: midPoint lists exactly one `com.exclamationlabs.connid.base.scim2.Scim2Connector` 1.2.9, the spike resource passes every step of its connection test, and the discovery stub logged the connector's `GET /scim/v2/ResourceTypes`. Phase 2 may start.

## What landed

| Area | Files |
| --- | --- |
| Compose services (D5) | `docker/docker-compose.yaml`: `midpoint_data` (postgres:16-alpine, healthcheck), `midpoint_init` (one-shot), `midpoint_server` (container `midpoint`, `127.0.0.1:8081`, healthcheck, `host.docker.internal:host-gateway`), `mailpit` (`axllent/mailpit:v1.31.5`, inbox `127.0.0.1:8025`), `scim_stub` (`nginx:1.28.0-alpine`, profile `scim-spike`). Keycloak 26.6.1 and ClamAV keep their ports, container names and volumes; the Keycloak bootstrap admin moved to env interpolation. |
| Credentials | `docker/.env.example` (names, the documented Keycloak admin/admin default, `change-me` placeholders); `docker/midpoint/new-env.sh` creates the git-ignored `docker/.env` with fresh 14-character secrets without printing them. The realm import and its test-user/client-secret fixtures are unchanged (override of P1-14). |
| Connector build (D10) | `docker/midpoint/Dockerfile`: `gradle:7.2-jdk11` stage clones `V1.2.9`, checks commit `05c404bb…`, builds `fatJar` with `BUILD_NUMBER=0`, records the resolved runtime classpath and source commit; runtime `FROM evolveum/midpoint:4.8.14-alpine` keeps the bundle in `/opt/midpoint/connector-bundle`. |
| Init | `docker/midpoint/init.sh`: `init-native`, schema creation only when the repository is absent, a fail-closed repository check, connector bundle replaced in `var/connid-connectors` on every start, numbered objects seeded as post-initial objects on first creation only. |
| Config as code (D23) | `docker/midpoint/objects/110-resource-scim-spike.xml` (fixed OID, connector found by type and version, placeholder token because the stub does not authenticate); objects mounted read-only. |
| Reload (PLAT-03) | `docker/midpoint/reload.sh` and `reload.ps1`: PUT each numbered object through midPoint's REST API from inside the container, in filename order or by name; stop non-zero on the first failure. |
| Spike check | `docker/midpoint/scim-stub/` (static `ResourceTypes` listing User and Group, GET only, logs method/path/status only) and `docker/midpoint/spike-test.sh` (`RESULT: GO`/`NO-GO`). |
| Docs | `docker/README.md` (services, quickstart, reset, midPoint init, reload, connector check, Mailpit); ADR 0005 (midPoint as identity engine; SCIM 2.0 as the only inbound contract; supersedes the 2026-10-03 brief, which now links it); ADR 0006 (4.8.14 LTS, connector `V1.2.9`, licence and support facts, the go result, unselected fallbacks). |
| Repository hygiene | `.gitattributes` keeps midPoint container scripts LF; `docker/.gitignore` ignores `*.done`. `scripts/verify-keycloak-idp.mjs` now expects the env-backed bootstrap admin. |

## Deviations from the plans

The five plans (01-01 … 01-05) were not executed as written. The orchestrator built the phase directly against the live stack, because every task needed Docker iteration and the plans' machinery was far larger than the phase needed:

1. **No isolated duplicate stack.** The plans ran every live check in a second, collision-checked compose project with remapped container names, volumes and ports (`docker/runtime/phase01.*`). The canonical `idp` stack is local development state that the brief allows to be reset, so checks ran against it directly, including a real `docker compose --profile scim-spike down -v`.
2. **No XML secret materializer.** The plans installed Python in the midPoint image and rewrote a `ProtectedString` token into the resource XML at start. The spike stub does not authenticate, so the spike resource carries a non-secret placeholder token. How the real Identity Source token reaches midPoint's IdamBox SCIM resource is decided in Phase 4.
3. **Reload through the REST API, not `ninja import --overwrite`.** Ninja writes straight to the repository behind a running midPoint's caches; a REST `PUT` goes through the model. D23's intent (an explicit reload of numbered objects) is kept.
4. **One small check script** (`spike-test.sh`) instead of a multi-mode `verify.ps1`.
5. **Post-initial objects** are mounted read-only and copied into the home volume on first creation (orchestrator override in 01-CONTEXT.md), so midPoint's `*.done` renames never touch tracked files.

## Findings worth keeping

- midPoint 4.8's default password policy allows at most **14 characters**; a longer `MIDPOINT_ADMIN_PASSWORD` makes the administrator import fail. `new-env.sh` generates 14.
- Ninja resolves its bundled SQL scripts relative to `/opt/midpoint`; the init script must `cd` there.
- The connector bundle's name, and so midPoint's configuration namespace (`…/bundle/connector-scim2/com.exclamationlabs.connid.base.scim2.Scim2Connector`), comes from the clone directory name.
- The connection test calls `GET /scim/v2/ResourceTypes` five times and nothing else against the stub.
- On Windows, Git Bash rewrites container paths such as `/connectors`; the scripts export `MSYS_NO_PATHCONV=1`.
- Re-running `docker compose up -d` re-runs `midpoint_init` (schema detected, bundle refreshed, nothing re-seeded) without restarting a running server; a rebuilt image needs `up -d --build`.

## Evidence

`evidence/fresh-stack-go.txt`: service status after a full reset, the init log, the spike test (`RESULT: GO`), console/realm/Mailpit reachability, the connector source commit, the bundle's SHA-256 and the resolved runtime classpath. Reload was checked by editing the spike resource's description, reloading with `reload.sh` and reading the change back over REST, then reverting; `reload.ps1` was run for all objects; a bad object fails reload with HTTP 400 and exit code 1; a missing file exits 1.

## Deferred

- WINDOWS.md entry: the root Keycloak static verifiers already failed before this phase on stale root-README assertions.

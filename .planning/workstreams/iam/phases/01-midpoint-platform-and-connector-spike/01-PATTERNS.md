# Phase 1: midPoint platform and connector spike - Pattern Map

**Mapped:** 2026-10-13
**Files classified:** 14 proposed new/modified files
**Analogs:** 8 files have exact, role or partial matches; 6 require research patterns.

Scope is `docker/` and `docs/` only. The context's Orchestrator overrides control credential scope, connector refresh and read-only source objects. Proposed paths below are assignments for planning, not existing implementation claims.

## File Classification

| New/modified file | Role | Data flow | Closest tracked analog | Quality |
|---|---|---|---|---|
| `docker/docker-compose.yaml` | config | batch / request-response | Same file | exact |
| `docker/.env.example` | config | file-I/O | `docker/README.md` | partial: local setup documentation |
| `docker/.gitignore` | config | file-I/O | `.gitignore` | role-match |
| `docker/midpoint/Dockerfile` | config | batch | None | no local connector-image build |
| `docker/midpoint/init.sh` | utility | batch / file-I/O | None | no native repository/bootstrap analog |
| `docker/midpoint/objects/110-resource-scim-spike.xml` | config | request-response | None | no local ConnId resource analog |
| `docker/midpoint/reload.sh` | utility | batch | None | no equivalent shell import loop |
| `docker/midpoint/reload.ps1` | utility | batch | `scripts/verify-phase-04-integrity.ps1` | role-match: fail-fast commands |
| `docker/midpoint/verify.ps1` | test | request-response / batch | `scripts/verify-phase-04-integrity.ps1` | role-match: executable assertions |
| `docker/midpoint/scim-stub/nginx.conf` | config | request-response | None | no static SCIM route analog |
| `docker/midpoint/scim-stub/ResourceTypes.json` | config | request-response | None | realm JSON is unrelated to SCIM discovery |
| `docker/README.md` | config (operator documentation) | batch / file-I/O | Same file | exact |
| `docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md` | config (architecture record) | transform | `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md` | role-match |
| `docs/adr/0006-midpoint-lts-and-community-scim2-connector.md` | config (architecture record) | transform | `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md` | role-match |

Evidence/build-resolution artifacts must remain under `docker/` or `docs/`. Any additional dependency lock or evidence file should be classified as config/file-I/O and follow the exclusions/redaction below. `docker/.env` is ignored operator state, not a committed deliverable. `docker/keycloak/import/idambox-realm.json` is preserved unchanged.

## Pattern Assignments

### Compose: preserve project, ports and volume identities

**Source:** `docker/docker-compose.yaml`, lines 1, 4-5, 10-17, 19-30.

```yaml
name: idp

services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.6.1
    # Existing command stays start-dev --import-realm.
    ports:
      - "127.0.0.1:8080:8080"
    # Bootstrap credentials move to required env interpolation.
    volumes:
      - keycloak_data:/opt/keycloak/data
      - ./keycloak/import:/opt/keycloak/data/import:ro
  clamav:
    image: clamav/clamav:stable
    ports:
      - "127.0.0.1:3310:3310"
    volumes:
      - clamav-db:/var/lib/clamav

volumes:
  keycloak_data:
  clamav-db:
    name: clamav-db
```

This excerpt omits unchanged container names and existing literal bootstrap settings intentionally. Preserve the realm mount and fixture contents. Extend this project with health-gated PostgreSQL → init → server, internal repository/stub, loopback midPoint/Mailpit ports and the opt-in `scim-spike` profile. Add `objects-src:ro`; copy into the home volume only for fresh repository creation. Refresh the bundled connector from an image directory outside `var` on every init, including reused home volumes. Use `01-RESEARCH.md` for actual CLI flags; the early research compose is not the deployment authority.

### Environment setup and exclusions

**Source:** `.gitignore`, lines 12-16, 24-26.

```gitignore
# Local runtime state and secrets
.env
.env.*
!.env.example
!.env.local.example
```

Apply equivalent documentation comments to `docker/.env.example`, containing variable names and explanations with non-secret placeholders for introduced secrets. Preserve the explicitly authorized local Keycloak bootstrap defaults there. Add phase exclusions in `docker/.gitignore`, including generated runtime material, connector build/binary artifacts and `*.done`; do not broaden changes into root `.gitignore`. Do not ignore canonical numbered XML or dependency-resolution documentation intended for review.

The existing local fixture tables in `docker/README.md` lines 53-90 and provisioning settings lines 94-107 are compatibility constraints. They remain unchanged. New phase credential handling does not require realm materialization or test-user/client-secret changes.

### Reload and verification scripts: fail on native command errors

**Source:** `scripts/verify-phase-04-integrity.ps1`, lines 1-7, 13-20.

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string] $Message) {
  Write-Error $Message
  exit 1
}

# Existing native invocation pattern:
$output = & git @Arguments 2>&1
$exitCode = $LASTEXITCODE
# Existing wrapper checks $exitCode before accepting $output.
```

Copy strict mode, explicit native exit checks and nonzero failure behavior, adapting the wrapper to Docker. Do not copy phase-specific commit hashes, branch checks, old Node pin or protected-schema rules. Unlike that Git wrapper, never echo captured command arguments/output containing credentials. Locate deployment paths from `$PSScriptRoot` (shell: script directory), independent of caller working directory. Use argument arrays rather than command-string evaluation; do not execute dotenv as code.

Research supplies `/opt/midpoint/bin/ninja.sh -B import --overwrite --input FILE`; import source XML in numeric order from the read-only source mount, stop at first failure, and restart server after successful imports as specified in research. No source filename restoration is necessary. No existing script supplies midPoint REST assertions: the new verifier must implement bounded readiness, exact connector type/version matching, successful OperationResult inspection, corresponding stub request observation, and redacted fresh/reused/reload/reset evidence.

### Operator README: runnable steps and state consequences

**Source:** `docker/README.md`, lines 28-38 and 49-51.

```powershell
docker compose stop
docker compose down -v
```

Existing explanatory pattern: name what state survives, what reset removes, and why the project/volume identities matter. Expand to exact root-invocable commands with `--env-file docker/.env -f docker/docker-compose.yaml`, normal/profile startup, build, readiness, both reload scripts and verification helper. Reset removes Keycloak state, midPoint repository/home and ClamAV signatures; canonical source objects remain unchanged. Changing env does not rotate persisted credentials. Existing fixture tables and realm/provisioning explanations must remain intact.

### ADRs: sequential records with concrete consequences

**Source:** `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`, lines 1-8, 14, 32, 40.

```markdown
# ADR 0004: Strapi verifies Keycloak access tokens and serves the caller's own effective access

- **Status:** Accepted
- **Date:** 2026-09-30

## Context
## Decision
## Consequences
## Alternatives considered
```

Use this section structure for ADRs 0005/0006; metadata describes the new decision, not copied dates/status outcomes. Existing ADRs 0001-0004 remain intact. ADR 0005 names midPoint the identity engine, Strapi SCIM the inbound provisioning boundary and Strapi the sole Keycloak provisioning writer. ADR 0006 separates verified versions/license/support references from the future live go/no-go outcome and documents fallback only upon observed failure. Do not claim runtime compatibility from samples or image inspection.

## Shared Patterns

- **Authorization/writer boundary:** `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md` line 10 says Strapi owns IdamBox User and every authorization decision; line 21 makes provisioning opt-in and rejects invalid/missing configuration without logging values. Carry that boundary into ADR 0005 and README; do not amend its transaction/outbox decision in Phase 1.
- **Domain language:** root `CONTEXT.md` defines Identity Source, identity engine, Identity and IdamBox User. `docs/agents/domain.md` lines 41-49 requires glossary terms and explicit handling of ADR conflicts. Do not introduce an alternate account/hub model.
- **Security:** fail missing required env values, use quiet Compose validation, never print Basic headers/tokens/resource dumps, keep PostgreSQL/stub internal, preserve loopback port patterns.
- **Lifecycle:** read-only canonical source objects; writable home copies may become `.done`. Fresh seed, repeated init, reused volume, actual reload and clean reset each need explicit assertions. `pnpm --dir apps/backend test` remains the mandatory phase regression gate without backend edits.

## No Analog Found

| File | Reason / research pattern to use |
|---|---|
| `docker/midpoint/Dockerfile` | No existing connector build. Use JDK 11/wrapper 7.2, tagged source, `BUILD_NUMBER=0`, upstream `fatJar`, resolved dependency evidence and outside-home immutable bundle. |
| `docker/midpoint/init.sh` | No native repository bootstrap. Use pinned `midpoint.sh init-native`, independent schema probes and Ninja repository/audit creation; fail authentication/partial-state errors. |
| `docker/midpoint/objects/110-resource-scim-spike.xml` | No local ConnId XML. Use research namespace/fields and stable resource OID with type/version lookup; token only from ignored runtime configuration. |
| `docker/midpoint/reload.sh` | No analogous import script. Use script-relative paths, ordered source imports and explicit failure propagation. |
| `docker/midpoint/scim-stub/nginx.conf` | No SCIM server. Use exact static ResourceTypes route, SCIM content type, restricted methods and method/path/status-only access logging. |
| `docker/midpoint/scim-stub/ResourceTypes.json` | No SCIM discovery fixture. Use two-entry RFC ListResponse User/Group fixture from research; add endpoints only after actual observed need. |

## Metadata

**Search scope:** tracked `docker/`, `docs/adr/`, `.gitignore`, root domain instructions and PowerShell/shell/config file inventory. Project skill index files were inspected for applicable conventions.
**Strong analogs:** Compose, Docker README, root exclusions, existing PowerShell verifier, ADR 0004.
**Tracked-source gate:** `git ls-files --` confirmed each named analog and ADR 0002; no installed/runtime mirror is used.
**Extraction date:** 2026-10-13. No implementation, live compatibility result or completion claim is implied.

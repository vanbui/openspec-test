# Phase 1: midPoint platform and connector spike - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning
**Workstream:** iam
**Mode:** Non-interactive; choices resolved from the documents and explicit run instructions.

<domain>
## Phase Boundary

Deliver PLAT-01/02/03: midPoint 4.8.14 LTS, PostgreSQL repository and Mailpit in the existing idp compose project; a source-built SCIM2 connector; a minimal connection-test stub; numbered configuration with reload/reset instructions; architecture and connector-risk ADRs.

The brief's D1-D26 are authoritative; ROADMAP.md Phase 1 success criteria define done. Implementation touches docker/ and docs/ only; planning lives in .planning/workstreams/iam/. No apps/backend or apps/csrm changes. This invocation captures discussion only. The orchestrator owns subsequent planning, builds, compose runs and live verification. Do not automatically chain into planning/execution.

</domain>

<decisions>
## Implementation Decisions

### Pinned platform and source build

- **P1-01:** Pin the final image to evolveum/midpoint:4.8.14-alpine, never latest. Docker Hub's exact-tag API returned this tag on 2026-10-13 with digest sha256:36d443167d9fe9b429e6257c253360d72998d886b8299a0e407af05e01a0e1da. This proves tag availability, not runtime compatibility.
- **P1-02:** Extend docker/docker-compose.yaml, keeping project idp, Keycloak 26.6.1, ClamAV and existing volume identities. Add midpoint_data (postgres:16-alpine), midpoint_init (one-shot), midpoint_server and Mailpit. No pgadmin, Samba AD or HR database.
- **P1-03:** PostgreSQL health precedes init; successful init precedes server startup. Follow the native-repository pattern: midpoint.sh init-native, Ninja repository/audit SQL initialization, then midpoint.sh container. Init and server share midpoint_home at /opt/midpoint/var and consistent MP_SET_midpoint_repository_* settings. Repeated init must handle an existing repository without masking real errors.
- **P1-04:** midPoint binds 127.0.0.1:8081; Keycloak stays on 127.0.0.1:8080 and ClamAV on 127.0.0.1:3310. Keep PostgreSQL internal. Mailpit exposes SMTP internally as mailpit:1025 and the inbox on 127.0.0.1:8025. Research selects a verified fixed Mailpit release. Set-password email integration remains Phase 5.
- **P1-05:** docker/midpoint/Dockerfile builds connector-scim2 tag V1.2.9 from source in a JDK 11 stage using its Gradle 7.2 wrapper; project_version is 1.2.9. Build the fat JAR including runtime dependencies, not the thin JAR, and install it in /opt/midpoint/var/connid-connectors/. Commit no binaries.
- **P1-06:** Account for the upstream plugin/dependency repositories at https://us-east1-maven.pkg.dev/provision-general-operations/provision-public and https://nexus.evolveum.com/nexus/content/repositories/releases/. Upstream uses dynamic dependency suffixes and a time-derived build number. Research must select a stable build number and record resolved dependencies; a source tag alone does not imply bit-for-bit reproducibility. Do not silently upgrade the connector or wrapper.
- **P1-07:** Research must ensure the connector remains installed when midpoint_home masks the image's var directory, including reused volumes. Choose the smallest reliable installation/initialization mechanism.

### Stub and compatibility gate

- **P1-08:** Use a tiny static HTTP container in opt-in compose profile scim-spike, with fixtures/configuration under docker/midpoint/scim-stub/. Research selects a fixed lightweight image. Serve /scim/v2/ResourceTypes as application/scim+json. No host port; midPoint connects by compose service DNS. Normal startup does not need the stub.
- **P1-09:** The fixture is a SCIM ListResponse listing User and Group ResourceTypes, correct core schema URNs, /Users and /Groups endpoints, and list metadata. No provisioning writes, backend endpoints or token issuer. Add other static discovery fixtures only if the real connection-test path requires them. This is a disposable discovery stub, not a production API.
- **P1-10:** Add a clearly named numbered spike object, such as 110-resource-scim-spike.xml, with a stable resource OID and connector lookup by type com.exclamationlabs.connid.base.scim2.Scim2Connector and version 1.2.9, not a machine-specific connector OID. Enable the standard schema; required bearer-token values come from ignored local runtime configuration. Keep this resource separate from Phase 4's IdamBox resource.
- **P1-11:** Preserve the future host bridge: midPoint reaches Strapi at host.docker.internal:1337 with extra_hosts host.docker.internal:host-gateway. No midPoint-to-Keycloak provisioning writer.
- **P1-12:** Go requires the running midPoint to list the connector and the spike resource to pass its connection test, with an observed ResourceTypes request at the stub. A build or direct HTTP fixture check is insufficient. Record versions, commands, connector identifier, result and redacted logs in phase evidence. No-go blocks Phase 2 and records the failure/fallback in ADR 0006. A custom ConnId connector or midPoint 4.11 SCIMREST requires the operator's fallback choice; no silent switch.

### Credentials and configuration lifecycle

- **P1-13:** Credentials live in git-ignored docker/.env; docker/.env.example contains names, explanations and non-secret placeholders. Fail clearly on missing required values. Use one repository credential set across PostgreSQL/init/server. Move hard-coded compose bootstrap credentials to env variables. Never track passwords, bearer tokens, connector binaries or secret-bearing rendered objects/logs.
- **P1-14:** Existing realm import/README contain local passwords and client-secret defaults. The roadmap's no-tracked-credential criterion requires the plan to address these explicitly through environment-backed runtime materialization under ignored docker/ paths, preserving realm/client IDs, redirect URLs, test identities and existing development sign-in behavior. No backend changes. Document that changing env values does not rotate already persisted credentials.
- **P1-15:** Numbered objects under docker/midpoint/objects/ are mounted read-write as /opt/midpoint/var/post-initial-objects/. Stable OIDs and ascending three-digit prefixes define import/overwrite order. Only minimum spike configuration is created now; HR mappings/tasks remain Phase 4.
- **P1-16:** reload.sh and reload.ps1 locate paths from their own location/repository, not the caller's working directory. Explicitly import with Ninja overwrite, in numeric order, accepting both .xml and startup-renamed .xml.done files. Stop on import failure with a nonzero exit code. Restart alone is not reload.
- **P1-17:** Ignore *.done and generated runtime material within docker/. Startup on a read-write bind mount renames host source files; reload/reset must preserve or restore canonical numbered filenames. Document restoration before fresh import: docker compose down -v does not restore host files. Use local rename/copy logic, never destructive git reset.
- **P1-18:** docker/README.md covers env setup, one-command normal startup, opt-in spike startup/test, readiness/logs, both reload scripts, stop preserving state and clean reset. Reset uses docker compose down -v and restores import filenames. Explain removal of Keycloak, midPoint repository/home and ClamAV signatures, and persisted credential reset/rotation behavior.

### ADRs and evidence

- **P1-19:** Brief “ADR 1” and “ADR 3” are local labels. Allocate docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md for D1/D2 and docs/adr/0006-midpoint-lts-and-community-scim2-connector.md for D9/D10 and the compatibility risk. Existing ADRs 0001-0004 remain intact; ADR 0002's outbox amendment belongs to Phase 2.
- **P1-20:** ADR 0005 establishes midPoint as the identity engine, Strapi SCIM as the only inbound provisioning contract, and Strapi as the sole Keycloak provisioning writer. The 2026-10-03 lifecycle brief already has a superseded notice; preserve it and link its replacement.
- **P1-21:** ADR 0006 records pinned versions, primary-source license/support facts without a legal opinion, community-support risk, actual go/no-go result and fallback. Recheck official license/support references during research; sample XML is not compatibility evidence.
- **P1-22:** Subsequent execution verifies every Phase 1 roadmap criterion and runs the mandatory pnpm --dir apps/backend test gate despite no backend changes. No live result or Phase 1 completion is claimed during discussion.
- **P1-23:** Plain conventional commits; no tool/model attribution, co-author trailers or generation notices in files or commits.

### Orchestrator overrides (2026-10-13, supersede the decisions they name)

- **P1-14 narrowed.** "No credential tracked by git" applies to the credentials this phase introduces (midPoint repository, midPoint administrator, any stub token) and to the Keycloak bootstrap admin in `docker/docker-compose.yaml`, which moves to `docker/.env` with the same local default documented in `docker/.env.example`. The Keycloak realm import (`docker/keycloak/import/idambox-realm.json`), its test users and client secrets, and their README tables stay unchanged: they are the documented local-only fixtures that `apps/backend/.env.example`, the CSRM development sign-in and ADR 0004's fixed ids depend on, and the realm seed changes only when a phase needs it.
- **P1-15/P1-17 replaced (deviation from D23's read-write bind mount).** midPoint renames each loaded post-initial object to `*.done`, so a read-write bind of `docker/midpoint/objects/` would rename tracked files and dirty the working tree on every first start. Instead mount `docker/midpoint/objects/` read-only (e.g. `/opt/midpoint/objects-src`); the init service copies the numbered objects into `/opt/midpoint/var/post-initial-objects/` inside the `midpoint_home` volume when the repository is first created; the reload scripts import from the read-only mount with `ninja import --overwrite`. Repository files are never renamed, so no filename restoration logic is needed; `*.done` is still git-ignored as a safeguard.
- **P1-07 direction.** Keep the built connector bundle at an image path outside `/opt/midpoint/var` and have the init service (which runs on every `docker compose up`) copy it into `/opt/midpoint/var/connid-connectors/`, replacing older copies, so a reused `midpoint_home` volume always carries the image's connector. Verified on 2026-10-13: `gradle fatJar` (JDK 11, Gradle 7.2, cloned into a directory named `connector-scim2`, `BUILD_NUMBER=0`) produces `connector-scim2-1.2.9-0-fat.jar` (~27 MB, 41 bundled libs, manifest `ConnectorBundle-Name: connector-scim2`, `ConnectorBundle-Version: 1.2.9`); the project name comes from the clone directory name.
- **Mailpit** pin: `axllent/mailpit:v1.31.5` (pulled 2026-10-13).

### Implementation Discretion

Exact health checks, fixed auxiliary image releases, secure runtime materialization, stable build number and Ninja flags are research/planning choices. Resolve them against pinned sources without routine human questions. Explicitly test clean and reused volumes, repeated init, reload after .done renames and reset during execution.

</decisions>

<canonical_refs>
## Canonical References

**Read before planning or implementing:**

- .planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md — D1-D26, especially D4/D5/D9/D10/D23/D24 and sections 2, 7, 8.
- .planning/workstreams/iam/ROADMAP.md — Phase 1 criteria/go-no-go and PLAT-03 placement.
- .planning/workstreams/iam/REQUIREMENTS.md — PLAT-01/02/03.
- .planning/workstreams/iam/PROJECT.md — value and constraints.
- .planning/PROJECT.md — GSD Workstreams and portable-document rules.
- CONTEXT.md — Identity Source, Identity engine, Identity, IdamBox User.
- docs/agents/domain.md — glossary and ADR conventions.
- docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md — outbound writer; amendment deferred.
- docs/adr/0004-strapi-verifies-keycloak-access-tokens.md — authentication/authorization boundary.
- docs/iam-early-research/IDENTITY-LIFECYCLE-BRIEF.md — superseded predecessor.
- docs/iam-early-research/IDENTITY-SOURCE-PROVISIONING.md — prior primary-source SCIM research.
- docs/iam-early-research/identity-management-design/ — engine-selection research.
- docs/iam-early-research/midpoint-docker-compose.yaml — starting pattern only.
- docker/docker-compose.yaml, docker/README.md, docker/keycloak/import/idambox-realm.json and .gitignore — deployment, realm and exclusions.
- docs/references/idambox-datamodel.jdl — domain authority; no Phase 1 schema change.

External pinned references:

- [Docker Hub exact tag](https://hub.docker.com/v2/repositories/evolveum/midpoint/tags/4.8.14-alpine) — checked through API on 2026-10-13.
- [Connector V1.2.9](https://github.com/ExclamationLabs/connector-scim2/tree/V1.2.9) — source, README and license.
- [Build](https://github.com/ExclamationLabs/connector-scim2/blob/V1.2.9/build.gradle), [properties](https://github.com/ExclamationLabs/connector-scim2/blob/V1.2.9/gradle.properties), [wrapper](https://github.com/ExclamationLabs/connector-scim2/blob/V1.2.9/gradle/wrapper/gradle-wrapper.properties) — packaging/dependencies and wrapper.
- [Upstream artifacts](https://github.com/ExclamationLabs/connector-scim2/tree/V1.2.9/artifacts) — samples to adapt selectively.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- Existing compose project and volume identities support additive deployment.
- Root ignore rules already exclude docker/.env and allow .env.example. Add runtime/*.done exclusions in docker/ to keep implementation within scope.
- Docker README documents import/reset and ClamAV; update coherently.
- artifacts/ is in the upstream connector repository, not this repository. Its AWS sample shows configuration namespace/schema flags, but references connector 1.2.7, a fixed connector OID and service-specific configuration. Do not copy credentials, role mappings or extensions without a concrete need.

### Established Patterns

- One root glossary; sequential repository-wide ADRs.
- .planning/PROJECT.md already records the IAM platform exception; no further root planning change needed.
- The research compose's extra services, sample credentials and latest fallback are rejected.

### Integration Points

- Default compose network connects repository, midPoint, Mailpit and optional stub.
- midpoint_home persists application state; midpoint_data persists repository data.
- Stub establishes discovery compatibility now; Strapi SCIM and HR lifecycle arrive later.

</code_context>

<specifics>
## Specific Ideas

A successful connection test proves this discovery path only. It does not prove User provisioning, claims, leaver safety or production SCIM conformance.

</specifics>

<deferred>
## Deferred Ideas

- Identity model, tokens, service identities and leaver-safe outbox: Phases 2-3.
- Real SCIM endpoints and recorded request replay: Phase 3.
- CSV, correlation, mappings and lifecycle/reconciliation/refresh tasks: Phase 4.
- Set-password email and end-to-end sign-in: Phase 5.
- Alternative connector/framework implementation: only after recorded no-go and operator fallback choice.

</deferred>

---

*Phase: 01-midpoint-platform-and-connector-spike*
*Context gathered: 2026-10-13*

# ADR 0006: midPoint 4.8 LTS with the community SCIM2 connector

- **Status:** Accepted — connector compatibility gate passed ("go") on 2026-10-13
- **Date:** 2026-10-13
- **Related:** [ADR 0005](0005-midpoint-identity-engine-and-strapi-scim.md)
- **Code:** `docker/midpoint/Dockerfile`, `docker/midpoint/init.sh`, `docker/docker-compose.yaml`, `docker/midpoint/objects/110-resource-scim-spike.xml`, `docker/midpoint/spike-test.sh`
- **Evidence:** `.planning/workstreams/iam/phases/01-midpoint-platform-and-connector-spike/evidence/fresh-stack-go.txt`
- **Brief:** `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`, decisions D9, D10, D23

## Context

ADR 0005 makes midPoint the identity engine and SCIM 2.0 the contract between midPoint and Strapi. That needs a midPoint version to ship and a ConnId connector that speaks SCIM 2.0 as a client. midPoint bundles CSV, DatabaseTable and LDAP connectors, but **no SCIM 2.0 connector is bundled with or supported by Evolveum**, and the community connector's documented midPoint compatibility is unstated. Every later `iam` phase depends on that connector, so it had to be proven before anything was built on it.

## Decision

**midPoint 4.8.14 "Curie" LTS**, image `evolveum/midpoint:4.8.14-alpine` (never `latest`), with a PostgreSQL 16 native repository. Re-evaluate at the next LTS.

**Provision IAM (formerly Exclamation Labs) SCIM2 connector, tag `V1.2.9`** (commit `05c404bbecf9c28938e2183411c7b04b4f8f4226`, connector class `com.exclamationlabs.connid.base.scim2.Scim2Connector`, bundle `connector-scim2` 1.2.9). It is built from source in the first stage of `docker/midpoint/Dockerfile` (Gradle 7.2 wrapper on JDK 11, `BUILD_NUMBER=0`, `fatJar`) and copied into the runtime image outside the midPoint home; the init service installs it into `var/connid-connectors` on every start, so a reused home volume always runs the image's bundle. No binary is committed.

## Facts recorded (2026-10-13)

**Licences** (stated facts, not a legal opinion):
- midPoint: the distribution's `LICENSE` states the code is dual-licensed under the Apache License 2.0 and the European Union Public Licence 1.2, at the user's choice; its documentation is CC BY-NC-ND 4.0. midPoint 4.10.x is EUPL only, which is one reason to stay on the 4.8 LTS line.
- SCIM2 connector: Apache License 2.0 (repository `LICENSE`; README: "Copyright 2024 Exclamation Graphics").

**Support:** midPoint 4.8 is Evolveum's LTS line, supported to 2028-10-17. The SCIM2 connector is community-maintained with no Evolveum support; its last tag is `V1.2.9`.

**Reproducibility:** the tag's `build.gradle` resolves some dependencies with dynamic `-+` versions from the vendor's public Maven registry (`us-east1-maven.pkg.dev/provision-general-operations/provision-public`) and Evolveum's Nexus. The build pins the source commit and build number but cannot promise byte-identical bundles over time; the resolved runtime classpath is written next to the bundle (`/opt/midpoint/connector-bundle/runtime-classpath.txt`) and recorded in the evidence (for example `connector-base:4.1.11-+ -> 4.1.11-197`).

**Connector behaviour that Strapi's SCIM service must honour** (brief sections 2 and 8): the connection test calls `GET /ResourceTypes` and fails unless both User and Group are listed; updates are a GET then a full `PUT`; multi-valued changes arrive as `PATCH` with lowercase operation names; search is `eq` only; paging is `startIndex`/`count`; authentication is a bearer token; it does not read `/ServiceProviderConfig`.

## Compatibility gate: go

On a freshly reset `idp` stack (`docker compose --profile scim-spike down -v`, then `up -d`), `docker/midpoint/spike-test.sh` found:
- midPoint 4.8.14 discovered the bundle (`Discovered ICF bundle in JAR: connector-scim2 version: 1.2.9`) and exactly one connector of type `com.exclamationlabs.connid.base.scim2.Scim2Connector`, version 1.2.9;
- the spike resource (OID `11000000-0000-4000-8000-000000000001`) passed its connection test: every step succeeded — connector instantiation, initialisation, configuration, connection test, capabilities and resource schema;
- the discovery stub logged the connector's `GET /scim/v2/ResourceTypes` requests (HTTP 200) during the test.

This proves only that the connector loads on 4.8 and completes discovery against a static `ResourceTypes` response. It does not prove user provisioning, the lifecycle rules or SCIM conformance: those are proven against Strapi's real service and the captured request sequence in `iam` Phases 3 and 4.

## Consequences

- Later phases may depend on the connector.
- The community-support risk stays open: if a later phase finds a blocking connector defect, the fallbacks below are the operator's choice and are recorded here.
- Building the image needs network access to GitHub, Maven Central, Evolveum's Nexus and the vendor registry.

## Fallbacks (not selected)

- A custom ConnId SCIM connector maintained in this repository.
- Upgrading to the midPoint 4.11 line and its SCIMREST connector framework (EUPL-only licensing to be weighed).

## Addendum (2026-10-16): behaviour observed against Strapi's SCIM service

The live probe and connector capture in `iam` Phase 3 ran the pinned connector through midPoint against the real `/scim/v2` service (`.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/03-LIVE-PROBE.md` and `03-CONNECTOR-CAPTURE-EVIDENCE.md`). They corrected or added to the connector behaviour listed above:

- Every request sends `Accept: application/json` and `Content-Type: application/json`, so the service also negotiates `application/json`.
- Creates carry no `externalId`; the Enterprise `employeeNumber` is the only source key, and `schemas` includes a Slack extension URN the service must tolerate.
- Emails travel as a JSON string attribute on the midPoint side; email changes arrive as a `PATCH` that removes then adds, with `primary` as the string `"true"`.
- An attribute change arrives as a GET then a full `PUT` that omits email and Enterprise data, so the service applies asserted-attribute replacement and keeps what was not sent.
- midPoint 4.8.14 does not pass shadow-search paging to the connector, even with a native `pagedSearch` capability: list requests carry no `startIndex`/`count`, so the service's default page of 100 applies. Reconciliation of more than 100 users is a Phase 4 concern.

None of these is a blocking defect; the go decision stands.

## Phase 4 observations (2026-10-16)

Live verification of connector `V1.2.9` on midPoint 4.8.14 established the following. These observations refine the Phase 3 capture above; the decision and fallbacks remain unchanged.

- With connector properties `pagination=true` and `importBatchSize=100`, the connector base pages full listings itself using `count` and `startIndex`, stopping at an empty page or `totalResults`. This answers P3-36 without changing Strapi's default page size of 100; it does not depend on midPoint passing shadow-search paging to the connector.
- The connector reads `displayName` back as `userName`: the read builds the `displayName` attribute from `getUserName`. A strong `displayName` mapping therefore rewrites each sourced IdamBox User on every IdamBox reconciliation. Strapi stores the correct display name; the extra writes arise from the connector's read behaviour.
- Every unrecognised fault, including Strapi's HTTP 503 while Keycloak is unavailable, becomes a generic `ConnectorException`. midPoint records no provisioning pending operation for it, and `Retry-After` is not passed on. Durable retry comes from the task-level `retryLater` reaction: a retry trigger on the person's HR row is fired by midPoint's trigger scanner after five minutes and then every fifteen minutes. Pending-operation refresh does not recover these generic failures; nightly reconciliations repair missed changes.
- HTTP 409 uniqueness conflicts become `AlreadyExistsException`.
- Emails are read back as `{"value":...,"primary":true}`. The resource sends exactly this form, with a boolean `primary`, to avoid remove/add churn for an unchanged email.
- An update `PUT` contains the freshly read user plus the delta. It carries the Enterprise extension only when the delta changes an Enterprise attribute. Strapi preserves attributes that the request does not assert.
- The connector reads `/ResourceTypes` before almost every operation (and `/Groups` with each user read), so a create or update costs three to four SCIM requests. Under Strapi's per-source limit of 600 requests a minute, a full reconciliation is throttled to roughly 150 to 200 users a minute; a throttled request answers 429, which reaches midPoint as a generic error and is retried like a 503. Throughput figures for larger populations must be measured with this in mind (Phase 4 gate evidence).

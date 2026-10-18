# ADR 0005: midPoint is the identity engine; SCIM 2.0 is Strapi's only inbound provisioning contract

- **Status:** Accepted
- **Date:** 2026-10-13
- **Supersedes:** the "Strapi is the hub" direction of `docs/iam-early-research/IDENTITY-LIFECYCLE-BRIEF.md` (2026-10-03), already marked superseded there
- **Related:** [ADR 0002](0002-keycloak-provisioning-blocks-the-user-write.md) (Strapi provisions Keycloak; amended in `iam` Phase 2 for leaver safety), [ADR 0004](0004-strapi-verifies-keycloak-access-tokens.md) (one active `externalSubject` per Keycloak `sub`), [ADR 0006](0006-midpoint-lts-and-community-scim2-connector.md) (midPoint version and connector)
- **Code:** `docker/docker-compose.yaml`, `docker/midpoint/`; from `iam` Phase 3, Strapi's `/scim/v2` in `apps/backend`
- **Brief:** `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`, decisions D1, D2, D4, D6, D13, D20

## Context

IdamBox needs its workforce to arrive from the customer's Identity Source (typically the HR system): joiners created, movers updated and leavers deactivated without anyone keying users in. A leaver must lose access to every IdamBox product on the next sync.

The 2026-10-03 brief made Strapi the hub: Strapi would pull or receive source data, correlate people, decide lifecycle changes and keep import screens and CSV snapshots. That puts correlation, attribute authority, scheduling, retry and audit — the core of an identity engine — inside a content API that every IdamBox product shares, and it would have to be rebuilt for each new kind of source.

midPoint is an open-source identity engine that already does this work: source connectors (CSV, database table, LDAP), correlation with operator confirmation, attribute mappings, live sync and reconciliation tasks, pending-operation retry and an audit log of every decision.

## Decision

**midPoint is the identity engine and the reference hub.** It reads the Identity Source, owns correlation, decides joiner, mover and leaver changes, and pushes identity attributes and `active` to IdamBox. It runs in the `idp` compose project beside Keycloak (`docker/`), configured as code in `docker/midpoint/objects/`.

**SCIM 2.0 is Strapi's only inbound provisioning contract.** Strapi serves RFC 7643/7644 `/scim/v2/Users` (and the discovery endpoints) to each Identity Source through that source's own non-human service identity and bearer token, authorised through an Identity Provisioning Function (Role → Function → FunctionAPI). Strapi stays standards-based and independent of midPoint: another hub (Entra, Okta) could be pointed at the same interface later. There are no midPoint-specific endpoints and no import screens in Strapi.

**Strapi stays the authority for `IdamBoxUser` and the only Keycloak writer.** Every provisioning write goes through Strapi's Document Service, which provisions Keycloak (ADR 0002). midPoint never writes to Keycloak in this milestone: two writers would break the `externalSubject` link that ADR 0004 relies on.

**Ownership split.** The Identity Source owns identity attributes and status; IdamBox owns roles. A sourced user receives only the birthright Requestor role through provisioning; Security Analyst and Admin are granted only inside IdamBox. Manual and protected users are never changed by a source except through a one-time confirmed claim of an unowned, unprotected manual user.

**Leaver means disable.** A leaver becomes `PUT active=false`; a `DELETE` that still arrives deactivates and marks the user source-deleted. No IdamBox User record is ever removed, so references from requests, risks and owners survive.

## Consequences

- One lifecycle authority: correlation, scheduling, retry and audit live in midPoint, not in each product's backend.
- Strapi gains a SCIM service, an Identity Source model and source-ownership rules (`iam` Phases 2–3); `csrm` keeps reading `IdamBoxUser` as before.
- The SCIM interface must match the real client: the connector's request sequence is captured from midPoint and replayed as backend tests, because midPoint does not run in CI.
- midPoint is a Java service with its own PostgreSQL repository to run, upgrade and back up.
- The `iam` workstream is a platform workstream with no `apps/` folder (`.planning/PROJECT.md`, "GSD Workstreams").

## Alternatives considered

- **Strapi as the hub** (2026-10-03 brief): rejected — rebuilds an identity engine inside the shared content API.
- **midPoint provisioning Keycloak directly**: deferred (backlog) — it would make two Keycloak writers.
- **Product-specific or midPoint-specific provisioning endpoints**: rejected — SCIM 2.0 keeps Strapi independent of the engine.

# IdamBox Identity and Access Management (IAM)

## What This Is

The IAM workstream gives the BProton / IdamBox product suite its identity lifecycle. midPoint, the identity engine, reads the customer's Identity Source (typically the HR system), decides each person's joiner, mover and leaver changes, and provisions IdamBox Users into the shared Strapi backend through a Strapi SCIM 2.0 interface. Keycloak authenticates; Strapi enforces Role → Function → FunctionAPI and record-level authorisation for every product, CSRM first.

`iam` is a platform workstream with no `apps/` folder: it plans the midPoint deployment and configuration under `docker/` and the backend provisioning it needs in `apps/backend`, under the shared-backend rules in `.planning/PROJECT.md`, "GSD Workstreams". CSRM screens stay with the `csrm` workstream.

## Core Value

A leaver in the customer's Identity Source loses access to every IdamBox product on the next sync, without anyone remembering to do it, and no external system can grant IdamBox roles.

## Current Milestone: v1.0 Identity Provisioning

**Goal:** midPoint provisions IdamBox Users from the customer's Identity Source through a Strapi SCIM 2.0 interface, so joiners, movers and leavers reach Keycloak and every IdamBox product without manual user administration.

**Target features:**
- midPoint 4.8.14 LTS with its PostgreSQL repository, the community SCIM2 connector and Mailpit in the `docker/` `idp` compose project.
- The identity model (`IdentitySource`, source fields on `IdamBoxUser`) and leaver-safe Keycloak sync through an outbox.
- A Strapi SCIM 2.0 `/Users` service with per-source bearer-token service identities, proven by the connector's recorded request sequence.
- midPoint configuration as code: HR CSV resource, IdamBox SCIM resource, correlation with confirmation, disable instead of delete, sync tasks.
- Set-password email for sourced users and a scripted joiner → mover → leaver journey.

**Brief (decisions D1–D26):** `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`

## Requirements

### Validated

- ✓ midPoint runs beside Keycloak in the `idp` compose project with the SCIM2 connector loaded — Phase 1 (connector GO, ADR 0006).

### Active

- [ ] Strapi accepts provisioning only through SCIM 2.0, from an Identity Source's own service identity, for the users that source owns.
- [ ] A leaver's deactivation commits in Strapi even when Keycloak is unavailable, and the person is refused immediately.
- [ ] midPoint applies joiners, movers and leavers from the reference HR CSV on a 5-minute cycle with nightly reconciliation.
- [ ] Sourced users set their own password through Keycloak; provisioning never sets one.

### Out of Scope

- Pull connectors to HR vendor APIs — midPoint owns source connectivity.
- Passwords or roles from a source — HR sends no passwords; roles are governed inside IdamBox.
- Hard deletes — references from requests, risks and owners must survive.
- SCIM `/Groups` writes and `/Bulk` — no consumer needs them.
- midPoint in CI — too heavy; the recorded connector sequence keeps the contract honest.
- CSRM UI changes beyond the sign-in journey — handed off to the `csrm` workstream.

## Context

- Strapi (`apps/backend`) already provisions Keycloak inside the `IdamBoxUser` write (ADR 0002) and maps the Keycloak `sub` to one active `IdamBoxUser.externalSubject` per request (ADR 0004).
- `docker/docker-compose.yaml` (project `idp`) runs Keycloak 26.6.1 and ClamAV.
- Earlier research: `docs/iam-early-research/` (SCIM standards and hubs, engine selection, a starting midPoint compose). The 2026-10-03 "Strapi is the hub" brief there is superseded by this workstream's brief.
- No SCIM 2.0 connector is bundled with or supported by Evolveum; the chosen one is the community Provision IAM SCIM2 connector `V1.2.9`.

## Constraints

- **Datamodel**: frozen; content-type changes start with a `docs/contract-gaps/` record that names every reading workstream (`csrm` reads `IdamBoxUser`) — shared backend.
- **Backward compatibility**: shared backend code, catalogue and OpenAPI changes keep existing endpoints and grants working for `csrm`.
- **Licence**: midPoint 4.8 LTS (dual EUPL/Apache-2.0) chosen for a shipped product; no binaries committed.
- **Secrets**: credentials only in git-ignored `docker/.env`; never committed.
- **Gates**: `pnpm --dir apps/backend test` is part of every phase gate.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| midPoint is the identity engine; SCIM 2.0 is Strapi's only inbound provisioning contract | One lifecycle authority; Strapi stays independent of the engine | — Pending |
| Strapi keeps provisioning Keycloak; deactivation commits through an outbox | One Keycloak writer; leaver safety during outages | — Pending |
| midPoint 4.8.14 LTS with the community SCIM2 connector | Longest support, Apache-2.0 available; only usable SCIM 2.0 target connector | ✓ Good — loads and passes discovery on 4.8.14 (Phase 1, ADR 0006) |
| HR owns identity attributes and status; IdamBox owns roles | No two writers on a field; no external role grants | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after Phase 1 (midPoint platform and connector spike)*

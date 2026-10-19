# IdamBox Identity and Access Management (IAM)

## What This Is

The IAM workstream gives the BProton / IdamBox product suite its identity lifecycle. midPoint, the identity engine, reads the customer's Identity Source (typically the HR system), decides each person's joiner, mover and leaver changes, and provisions IdamBox Users into the shared Strapi backend through a Strapi SCIM 2.0 interface. Keycloak authenticates; Strapi enforces Role → Function → FunctionAPI and record-level authorisation for every product, CSRM first.

`iam` is a platform workstream with no `apps/` folder: it plans the midPoint deployment and configuration under `docker/` and the backend provisioning it needs in `apps/backend`, under the shared-backend rules in `.planning/PROJECT.md`, "GSD Workstreams". CSRM screens stay with the `csrm` workstream.

## Core Value

A leaver in the customer's Identity Source loses access to every IdamBox product on the next sync, without anyone remembering to do it, and no external system can grant IdamBox roles.

## Current State

**Shipped v1.0 Identity Provisioning on 2026-10-19** (`milestones/v1.0-ROADMAP.md`, audit 24/24). midPoint 4.8.14 LTS reads the reference HR CSV and provisions IdamBox Users through Strapi's SCIM 2.0 `/Users` with a per-source bearer token. Joiners get the birthright Requestor role and a Keycloak set-password email, movers keep their IdamBox Roles, and leavers are deactivated, never deleted. A leaver is refused on their next request, and Keycloak disable and logout follow through an outbox once Keycloak is reachable.

## Next Milestone Goals

Not yet defined. Run `/gsd-new-milestone --ws iam`. Candidates from v1.0 handoffs:
- csrm handoffs: source badges, read-only HR fields, inactive-owner reassignment, provisioning change-log screens (owned by the `csrm` workstream).
- Operations: rate-limit sizing for large sources, task reload that keeps run state, a production HR source resource in midPoint beyond the reference CSV.
- Hygiene: Nyquist validation for phases 1, 3, 4 and 5; move the Phase 1 spike resource out of the default object set.

**Brief (decisions D1–D26):** `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`

## Requirements

### Validated

- ✓ midPoint runs beside Keycloak in the `idp` compose project with the SCIM2 connector loaded — v1.0 (Phase 1, connector GO, ADR 0006).
- ✓ Strapi accepts provisioning only through SCIM 2.0, from an Identity Source's own service identity, for the users that source owns — v1.0 (Phases 2–3).
- ✓ A leaver's deactivation commits in Strapi even when Keycloak is unavailable, and the person is refused immediately — v1.0 (Phases 2–3, Phase 5 journey).
- ✓ midPoint applies joiners, movers and leavers from the reference HR CSV on a 5-minute cycle with nightly reconciliation — v1.0 (Phase 4; measured 4 min 58 s, nightly runs triggered on demand).
- ✓ Sourced users set their own password through Keycloak; provisioning never sets one — v1.0 (Phase 5).

### Active

- (none until the next milestone is defined)

### Out of Scope

- Pull connectors to HR vendor APIs — midPoint owns source connectivity.
- Passwords or roles from a source — HR sends no passwords; roles are governed inside IdamBox.
- Hard deletes — references from requests, risks and owners must survive.
- SCIM `/Groups` writes and `/Bulk` — no consumer needs them.
- midPoint in CI — too heavy; the recorded connector sequence keeps the contract honest.
- CSRM UI changes beyond the sign-in journey — handed off to the `csrm` workstream.

## Context

- v1.0 shipped: `apps/backend/src/iam/` (identity, scim, keycloak-sync, password-setup), `docker/midpoint/` (objects 100–340, render/reload scripts, e2e capture, refusal and journey tooling), ADRs 0005 and 0006. The unfiltered backend suite was 2577/2577 at the close.
- Known debt (v1.0 audit): Nyquist validation incomplete for phases 1, 3, 4 and 5; SECURITY report body text lags the closed registers; MySQL is unverified for source/user locks.
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
| midPoint is the identity engine; SCIM 2.0 is Strapi's only inbound provisioning contract | One lifecycle authority; Strapi stays independent of the engine | ✓ Good — 21 SCIM operations served; genuine connector capture replays in CI (v1.0) |
| Strapi keeps provisioning Keycloak; deactivation commits through an outbox | One Keycloak writer; leaver safety during outages | ✓ Good — live outage/recovery and two-process PostgreSQL gates passed (v1.0) |
| midPoint 4.8.14 LTS with the community SCIM2 connector | Longest support, Apache-2.0 available; only usable SCIM 2.0 target connector | ✓ Good — loads and passes discovery on 4.8.14 (Phase 1, ADR 0006) |
| Connector-side paging, durable retry-later triggers and native correlation cases (Phase 4 amendments A4, A5, A8) | The connector reports 503 generically and sends no paging by default | ⚠️ Revisit — works (139-user run, automatic recovery) but retry has no increasing backoff and request volume nears the 600/min source limit at ~150–200 users/min |
| Partial-PUT merge semantics (P3-34, superseding P3-13) | The pinned connector omits emails, Enterprise data and externalId on update | ✓ Good — prevents wiping source keys; discovery wording still to align |
| HR owns identity attributes and status; IdamBox owns roles | No two writers on a field; no external role grants | ✓ Good — mover kept Security Analyst; owned fields refused on SCIM and admin paths (v1.0) |

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
*Last updated: 2026-10-19 after v1.0 milestone*

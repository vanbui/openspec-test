# Phase 2: CSRM Bootstrap Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 2-CSRM Bootstrap Data
**Areas discussed:** Seed activation policy, CSRM naming and identifiers, Role/user assignment details, Verification expectations

---

## Seed Activation Policy

| Option | Description | Selected |
|--------|-------------|----------|
| New CSRM flag | Add a separate `IDAMBOX_SEED_CSRM=true|false` flag for CSRM bootstrap data. Keeps Phase 2 independent from existing core sample data. | ✓ |
| Fold into core seed | Extend existing `IDAMBOX_SEED_CORE=true` to include CSRM app, roles, and users. Simpler, but CSRM sample users become part of the broad core seed. | |
| Always bootstrap CSRM | Create CSRM app/roles/users on every Strapi boot, idempotently, without a seed flag. Best matches "when it boots up," but makes these baseline platform data. | |

**User's choice:** New CSRM flag.
**Notes:** Lock `IDAMBOX_SEED_CSRM` as a separate activation flag independent from `IDAMBOX_SEED_CORE`.

---

## CSRM Naming And Identifiers

| Option | Description | Selected |
|--------|-------------|----------|
| IdamBox CSRM | `name: "IdamBox CSRM"`, `slug: "idambox-csrm"`, and a description that expands CSRM as Cybersecurity Risk Manager. | ✓ |
| CSRM | `name: "CSRM"`, `slug: "csrm"`, and a description that expands CSRM. Shorter, but less consistent with other IdamBox application names. | |
| IdamBox Cybersecurity Risk Manager | `name: "IdamBox Cybersecurity Risk Manager"`, `slug: "idambox-cybersecurity-risk-manager"`. Explicit but verbose in admin lists. | |

**User's choice:** IdamBox CSRM.
**Notes:** Use `idambox-csrm` as the canonical slug.

---

## Role/User Assignment Details

| Option | Description | Selected |
|--------|-------------|----------|
| No Jane role | Create Jane as an active IdamBox user with no roles. She represents an end user/requestor for later CSRM phases, but Phase 2 only creates the two specified security roles. | ✓ |
| Create Requestor role | Add a `Requestor` or `CSRM Requestor` role and assign Jane. May help Phase 6 authorization, but expands Phase 2 beyond the two requested roles. | |
| Create user only, inactive | Create Jane as inactive until the CSRM app exists. Conservative, but less useful for later bootstrap/demo flows. | |

**User's choice:** No Jane role.
**Notes:** Bob Doe is assigned to the reusable `Security Analyst` role. `Security Analyst Agent` is seeded but not assigned to Jane or Bob in Phase 2.

---

## Verification Expectations

| Option | Description | Selected |
|--------|-------------|----------|
| Static + idempotency script | Add/extend a verifier that checks seed definitions, required env flag, and relationship targets, plus verifies running the seed twice would not duplicate records where practical. | ✓ |
| Static only | Verify code shape and schema relationships, but do not require executing seed behavior. | |
| Boot-level integration | Require starting Strapi with `IDAMBOX_SEED_CSRM=true` and checking records exist. Strongest, but more brittle and likely slower in local/sandbox runs. | |

**User's choice:** Static + idempotency script.
**Notes:** Verification should focus on seed definitions, configuration, relationships, and duplicate prevention.

---

## the agent's Discretion

- Planner may choose the internal seed helper/module structure.
- Planner may choose whether the idempotency check is a script, focused test, or static verifier extension, provided it covers the agreed expectations.

## Deferred Ideas

- Keycloak user/client bootstrap is deferred to Phase 3.
- Strapi-to-Keycloak provisioning is deferred to Phase 4.
- CSRM content types are deferred to Phase 5.
- CSRM frontend workflows are deferred to Phase 6.

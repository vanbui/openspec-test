# Milestones

## v1.0 Identity Provisioning (Shipped: 2026-10-19)

**Delivered:** midPoint provisions IdamBox Users from an HR CSV Identity Source through Strapi's SCIM 2.0 `/Users`. Joiners, movers and leavers reach Keycloak and CSRM without manual user administration, and a leaver is refused on their next request even while Keycloak is down.

**Phases completed:** 5 phases, 80 plans (Phases 1 and 4 executed as consolidated passes)
**Timeline:** 2026-10-13 → 2026-10-19 (7 days), 149 workstream commits
**Change size:** 238 files, +47,858 / −286 lines across `apps/backend/src/iam`, `apps/backend/tests`, `docker/midpoint`, `apps/csrm/e2e` and `docs/adr`
**Requirements:** 24/24 satisfied (audit `milestones/v1.0-MILESTONE-AUDIT.md`, status tech_debt)

**Key accomplishments:**
- midPoint 4.8.14 LTS, its PostgreSQL repository, Mailpit and a source-built community SCIM2 connector V1.2.9 run in the `idp` compose project. The connector go/no-go gate passed (ADR 0005, ADR 0006).
- Identity model with Identity Sources, source-owned and protected IdamBox Users, source isolation enforced on every write, and a leaver outbox. Deactivation commits locally, and the user is disabled and logged out in Keycloak once it is reachable.
- Strapi serves SCIM 2.0 at root: 21 operations, per-source bearer tokens stored as hashes, rate limits, one structured log line per request, and a genuine connector capture replayed in CI.
- midPoint configuration as code: HR CSV and SCIM resources, a template and archetype, 5-minute live sync, nightly reconciliation, pending refresh, durable retry, and operator-confirmed correlation. Proven live on 139 users.
- Keycloak set-password email after commit, and a scripted fresh-stack journey (joiner → sign-in as Requestor → mover → leaver → refused in UI and API) passing at 1440 and 375.

**Closeout:** override_closeout. The audit passed with 24/24 requirements. The tool's strict readiness projection flags two phases for record format only:
- Phase 1: the 2026-10-14 verification has no file fingerprint (reported "stale"), and one consolidated summary covers 5 plans.
- Phase 4: the verification has no frontmatter (reported "missing"), and one consolidated summary covers 32 plans.

Known verification overrides: 2 newly acknowledged, 0 carried forward.

**Known tech debt:** Nyquist records for phases 1, 3, 4 and 5 are not compliant. The 02-SECURITY.md and 03-SECURITY.md body text contradicts their closed registers. The Phase 1 spike resource is still in the default midPoint object set. Large sources need rate-limit sizing. See the audit for the full list.

---

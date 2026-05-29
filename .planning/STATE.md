---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
last_updated: "2026-05-29T09:08:31.094Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 67
stopped_at: Phase 5 context gathered
---

# State: IdamBox Platform

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.
**Current focus:** Phase 05 — CSRM Backend Content Model

## Current Phase

| Field     | Value                      |
| --------- | -------------------------- |
| Phase     | 5                          |
| Name      | CSRM Backend Content Model |
| Status    | Ready to plan              |
| Started   | -                          |
| Completed | -                          |
| Plans     | 0                          |

## Workflow State

- Project initialized: 2026-05-20
- Requirements defined: 2026-05-20
- Roadmap created: 2026-05-20
- Phase 1 planned: 2026-05-20
- Phase 1 executed: 2026-05-20
- Phases 2-6 added to roadmap: 2026-05-24
- Phase 2 context gathered: 2026-05-24
- Phase 2 planned: 2026-05-24
- Phase 2 executed: 2026-05-24
- Phase 3 context gathered: 2026-05-25
- Phase 3 planned: 2026-05-25
- Phase 3 executed: 2026-05-25
- Phase 4 context gathered: 2026-05-25
- Phase 4 planned: 2026-05-25
- Phase 4 executed: 2026-05-26
- Next command: `$gsd-plan-phase 5`

## Memory

- Phase 1 is backend-only.
- Use Strapi native admin authentication for content administration.
- Auth0 is deferred until Next.js app modules are added.
- Use a custom IdamBox user collection rather than Strapi admin users for product users.
- Application roles start with `name` and `description`, scoped to applications.
- Roles bundle application roles and are assigned to users.
- Follow the `example-projects/edalas-dylan` monorepo shape.
- Phase 2 added idempotent Strapi bootstrap data for the CSRM application, CSRM roles, and Jane/Bob sample users behind `IDAMBOX_SEED_CSRM`.
- Phase 3 added a top-level Keycloak `idp` setup based on `example-projects/idambox_old/keycloak`, with a local `idambox` realm, Jane/Bob Keycloak users, an `idambox-csrm` OIDC client, and static verification.
- Keycloak committed credentials and `idambox-csrm-local-secret` are local-only values and must not be reused outside local development.
- Phase 4 executed as three waves: Keycloak admin client/configuration, backend provisioning integration, and verification/documentation closeout.
- Phase 4 added Strapi-to-Keycloak provisioning gated by `IDAMBOX_KEYCLOAK_PROVISIONING=true`, using the dedicated local admin client `idambox-strapi-admin`, storing Keycloak user IDs in `externalSubject`, and clearing transient IdamBox user passwords after successful provisioning.
- Phase 6 will add the IdamBox CSRM Next.js application using Keycloak/OIDC.

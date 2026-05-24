---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-05-24T04:06:47.009Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 33
---

# State: IdamBox Platform

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.
**Current focus:** Phase 3 - Keycloak Identity Provider Setup

## Current Phase

| Field | Value |
|-------|-------|
| Phase | 2 |
| Name | CSRM Bootstrap Data |
| Status | Complete |
| Started | - |
| Completed | 2026-05-24 |
| Plans | 1 |

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
- Next command: `$gsd-discuss-phase 3`

## Memory

- Phase 1 is backend-only.
- Use Strapi native admin authentication for content administration.
- Auth0 is deferred until Next.js app modules are added.
- Use a custom IdamBox user collection rather than Strapi admin users for product users.
- Application roles start with `name` and `description`, scoped to applications.
- Roles bundle application roles and are assigned to users.
- Follow the `example-projects/edalas-dylan` monorepo shape.
- Phase 2 added idempotent Strapi bootstrap data for the CSRM application, CSRM roles, and Jane/Bob sample users behind `IDAMBOX_SEED_CSRM`.
- Phase 3 will add a top-level Keycloak `idp` setup based on `example-projects/idambox_old/keycloak`.
- Phase 6 will add the IdamBox CSRM Next.js application using Keycloak/OIDC.

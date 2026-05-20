# State: IdamBox Platform

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.
**Current focus:** Phase 1 - Strapi Backend Foundation

## Current Phase

| Field | Value |
|-------|-------|
| Phase | 1 |
| Name | Strapi Backend Foundation |
| Status | Pending planning |
| Started | Not started |
| Completed | Not completed |

## Workflow State

- Project initialized: 2026-05-20
- Requirements defined: 2026-05-20
- Roadmap created: 2026-05-20
- Next command: `$gsd-plan-phase 1`

## Memory

- Phase 1 is backend-only.
- Use Strapi native admin authentication for content administration.
- Auth0 is deferred until Next.js app modules are added.
- Use a custom IdamBox user collection rather than Strapi admin users for product users.
- Application roles start with `name` and `description`, scoped to applications.
- Roles bundle application roles and are assigned to users.
- Follow the `example-projects/edalas-dylan` monorepo shape.

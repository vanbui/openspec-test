# Phase 1 Research: Strapi Backend Foundation

**Phase:** 1 - Strapi Backend Foundation
**Date:** 2026-05-20
**Status:** Complete

## Research Question

What needs to be known to plan a Strapi 5 backend foundation for IdamBox inside a Turbo monorepo?

## Inputs

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/research/SUMMARY.md`
- `example-projects/edalas-dylan`
- `example-projects/grad`

## Findings

### Monorepo Pattern

Use the `example-projects/edalas-dylan` shape as the baseline:

- Root `package.json` with Yarn workspaces.
- `turbo.json` for build/dev/check orchestration.
- `apps/backend` as the Strapi application.
- Future Next.js modules under `apps/*`.
- Optional `packages/*` for shared UI and config, but Phase 1 should avoid unnecessary package scaffolding unless needed by workspace configuration.

Turborepo's current docs describe deployable applications as application packages commonly found under `./apps`, while shared internal packages belong under a library package area. This matches the user's intended "one backend, one Next.js app per module over time" structure.

### Strapi Project Structure

Strapi 5 TypeScript projects use:

- `config/*.ts` for server, database, admin, plugins, and middleware configuration.
- `src/api/[api-name]/content-types/[content-type-name]/schema.json` for collection type schemas.
- generated types under `types/generated`.

Collection schemas should use `kind: "collectionType"`, explicit `collectionName`, `info` names, `options.draftAndPublish: false`, and `attributes` with `relation` fields for cross-collection links.

### Core Data Model

The Phase 1 model should represent:

```text
IdamBoxUser
  many-to-many Role

Role
  many-to-many IdamBoxUser
  many-to-many ApplicationRole

Application
  one-to-many ApplicationRole

ApplicationRole
  many-to-one Application
  many-to-many Role
```

Recommended collection API names:

- `idambox-user`
- `role`
- `application`
- `application-role`

Recommended minimum fields:

- IdamBoxUser: `email`, `firstName`, `lastName`, `displayName`, `status`, `externalSubject`
- Role: `name`, `description`
- Application: `name`, `description`, `slug`, `status`
- ApplicationRole: `name`, `description`, `application`

The user only required `name` and `description` on application roles; the relationship to application is necessary to meet the roadmap and derive effective access. Extra fields on IdamBoxUser/Application/Role are acceptable only when they support administration and future Auth0 mapping without implementing Auth0 now.

### Authentication Boundary

Use native Strapi admin authentication for Phase 1. Do not implement Auth0 or app-user login yet. The custom IdamBox user collection should be product/platform data, not Strapi admin accounts.

### Validation Approach

The phase should verify:

- root workspace scripts exist and target the backend;
- Strapi app package scripts exist for `dev`, `build`, `start`, and type checks;
- all four content-type schemas exist under `apps/backend/src/api`;
- relations encode `IdamBoxUser -> Role -> ApplicationRole -> Application`;
- Strapi can build or at minimum run TypeScript/schema checks after dependency installation.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Scaffolding from `create-strapi` requires network access | Prefer copying/adapting local example structure when dependency download is unavailable. |
| Confusing Strapi admin users with IdamBox users | Keep IdamBox users in a custom collection and document the boundary in backend README. |
| Over-modeling permissions too early | Keep application roles as named records with descriptions; do not add permission strings yet. |
| Relation direction mistakes | Use explicit Strapi relations and verify schema files against the access path. |

## Sources

- Strapi 5 Docs: https://docs.strapi.io/
- Strapi project structure docs: https://www.strapi.cn/dev-docs/project-structure
- Strapi models and relations docs: https://www.strapi.cn/dev-docs/backend-customization/models
- Turborepo workspaces docs: https://turborepo.com/docs/guides/workspaces
- Turborepo package types docs: https://turborepo.com/repo/docs/core-concepts/package-types

## RESEARCH COMPLETE

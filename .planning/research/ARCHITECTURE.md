# Architecture Research: IdamBox Platform Foundation

## Target Shape

```text
idambox/
  apps/
    backend/          # Strapi backend, Phase 1
    <future-app>/     # Next.js modules added later
  packages/
    eslint-config/    # shared tooling, if needed
    typescript-config/
    ui/               # shared UI, future
  package.json
  turbo.json
```

## Core Data Model

```text
IdamBoxUser
  many-to-many Role

Role
  many-to-many ApplicationRole

Application
  one-to-many ApplicationRole

ApplicationRole
  many-to-one Application
```

## Authorization Direction

User access is derived as:

```text
IdamBoxUser -> Roles -> ApplicationRoles -> Application
```

This keeps reusable organizational roles separate from application-specific role definitions.

## Build Order

1. Monorepo and Strapi app scaffold.
2. Core content-type schemas.
3. Relationship validation and admin visibility.
4. Seed/sample data for at least one application and role bundle.
5. Verification through Strapi build/type checks and manual admin workflow.

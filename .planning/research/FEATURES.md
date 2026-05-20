# Feature Research: IdamBox Platform Foundation

## Table Stakes For Phase 1

- Strapi backend exists in the monorepo.
- Backend can be run and administered through native Strapi admin.
- Core collection types exist for IdamBox user, role, application, and application role.
- Application roles belong to applications.
- Roles bundle application roles.
- IdamBox users can be assigned roles.
- The model supports deriving a user's application roles through their assigned roles.

## Deferred Platform Features

- Auth0 authentication for Next.js application users.
- One Next.js app per IdamBox module.
- Application-specific navigation and UI authorization.
- Fine-grained permissions/entitlements.
- Audit logs, governance reports, compliance evidence, and lifecycle automation.

## Anti-Features For Phase 1

- Do not build a frontend shell just to prove future app behavior.
- Do not couple IdamBox product users to Strapi admin users.
- Do not over-model application role permissions before the module requirements exist.

# Stack Research: IdamBox Platform

## Recommendation

Follow the closest provided example, `example-projects/edalas-dylan`:

- Turbo monorepo
- Yarn workspaces
- `apps/backend` for the Strapi backend
- Future Next.js apps under `apps/*`
- Shared tooling/config packages under `packages/*`
- TypeScript throughout

## Backend

- Strapi 5, matching the examples that already use Strapi 5.23.6.
- Native Strapi admin authentication for Phase 1.
- Start with SQLite for local development if matching example ergonomics, but keep database configuration environment-driven so PostgreSQL can be used for production later.

## Frontend

No frontend is in Phase 1. Future application modules should be separate Next.js apps under `apps/*`, following the `edalas-dylan` shape.

## Notes From Current Strapi Docs

Strapi 5 models content types as schema files under `src/api/[api-name]/content-types/[content-type-name]/schema.json`, with relation attributes defined explicitly in the schema. The Content-Type Builder is intended for development-time modeling and collection types are the right fit for user, role, application, and application-role records.

Sources:
- https://docs.strapi.io/
- https://www.strapi.cn/dev-docs/backend-customization/models
- https://www.strapi.cn/dev-docs/plugins/users-permissions

## Confidence

High for monorepo shape and backend stack because it follows the provided examples and the user's explicit constraints.

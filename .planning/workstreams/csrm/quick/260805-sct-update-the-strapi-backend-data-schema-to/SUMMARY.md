---
status: complete
task: Update the Strapi backend data schema to rename Entitlement object to Function and add a menuPath attribute of type Text to the object.
completed: 2026-08-05
---

# Quick Task Summary

Renamed the Strapi Entitlement API/content type to Function, including its controller, route, service, generated type declaration, and application/role relationships. Added the optional `menuPath` attribute with Strapi type `text`. Updated core seed logic and backend documentation to use Function terminology.

The existing `idambox_entitlements` database collection name was retained to avoid unnecessarily breaking existing persisted records while the public Strapi object/API name changes.

## Verification

- `npm run check-types --workspace=backend` passed.
- `npm run build --workspace=backend` passed.
- Strapi type generation passed and refreshed `apps/backend/types/generated/contentTypes.d.ts`.
- Active backend source, README, and generated content types contain no stale Entitlement identifiers; only the retained database collection name remains.
- `npm run openapi --workspace=backend` was attempted but Strapi's experimental generator failed in route registration before writing output.

---
name: update-the-strapi-backend-data-schema-to
status: complete
---

# Update the Entitlement schema to Function

Rename the Strapi Entitlement content type and its authorization relationships to Function, add the `menuPath` text attribute, and update backend seed/source documentation references while retaining the existing database collection name for data continuity.

## Tasks

1. Rename the Strapi API files and schema identifiers from entitlement to function, including the `menuPath` text field and `application.functions` / `role.functions` relations.
2. Update seed logic, README, and generated type metadata to use Function terminology.
3. Verify TypeScript compilation and confirm no active backend source references to Entitlement remain.

## Verification

- `npm run check-types --workspace=backend`
- Search backend source and generated types for stale `entitlement` identifiers.
- Inspect the Function schema for `menuPath` with `type: "text"` and reciprocal relationships.

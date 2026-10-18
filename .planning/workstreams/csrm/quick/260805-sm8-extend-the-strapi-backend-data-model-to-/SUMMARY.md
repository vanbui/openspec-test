---
status: complete
task: Extend the Strapi backend data model to add another class called FunctionApi with the following attributes: name, description, and url. Add one-way relationship to link the Function object with many FunctionApi's.
completed: 2026-08-05
---

# Quick Task Summary

Added the Strapi `FunctionApi` collection with required `name` and `url` string attributes plus optional `description` text. Added the one-way `Function.functionApis` one-to-many relationship targeting `FunctionApi`; `FunctionApi` has no inverse relationship field. Updated backend documentation and regenerated content-type declarations.

## Verification

- `npx strapi ts:generate-types` passed.
- `npm run check-types --workspace=backend` passed.
- `npm run build --workspace=backend` passed.
- Schema JSON validation and `git diff --check` passed.

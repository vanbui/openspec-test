---
name: extend-the-strapi-backend-data-model-to-
status: complete
---

# Add FunctionApi to the backend data model

Create a Strapi `FunctionApi` collection with `name`, `description`, and `url`, then add a one-way one-to-many relation from `Function` to `FunctionApi`.

## Tasks

1. Add the FunctionApi schema, controller, route, and service.
2. Add the one-way `Function.functionApis` relation and update backend documentation.
3. Regenerate Strapi types and verify type checking/build output.

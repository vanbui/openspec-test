---
phase: 1
phase_name: Strapi Backend Foundation
plan: 2
title: Core IdamBox Data Model
type: implementation
wave: 2
depends_on:
  - 01-PLAN.md
files_modified:
  - apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json
  - apps/backend/src/api/idambox-user/controllers/idambox-user.ts
  - apps/backend/src/api/idambox-user/routes/idambox-user.ts
  - apps/backend/src/api/idambox-user/services/idambox-user.ts
  - apps/backend/src/api/role/content-types/role/schema.json
  - apps/backend/src/api/role/controllers/role.ts
  - apps/backend/src/api/role/routes/role.ts
  - apps/backend/src/api/role/services/role.ts
  - apps/backend/src/api/application/content-types/application/schema.json
  - apps/backend/src/api/application/controllers/application.ts
  - apps/backend/src/api/application/routes/application.ts
  - apps/backend/src/api/application/services/application.ts
  - apps/backend/src/api/application-role/content-types/application-role/schema.json
  - apps/backend/src/api/application-role/controllers/application-role.ts
  - apps/backend/src/api/application-role/routes/application-role.ts
  - apps/backend/src/api/application-role/services/application-role.ts
autonomous: true
requirements_addressed:
  - BACK-02
  - DATA-01
  - DATA-02
  - DATA-03
  - DATA-04
  - DATA-05
  - DATA-06
  - DATA-07
---

<objective>
Implement the four core Strapi collection types and relationships that allow IdamBox user access to be derived through assigned roles and application roles.
</objective>

<context>
The required collections are IdamBox user, role, application, and application role. Application roles start with `name` and `description`, and must be related to their owning application. Roles are reusable bundles of application roles. IdamBox users receive access indirectly through roles.
</context>

<must_haves>
<truths>
- Product users must be represented by a custom IdamBox user collection, not Strapi admin users.
- Application roles must be separate from applications.
- Application roles must have `name` and `description`.
- Roles must bundle application roles.
- IdamBox users must be assigned roles, not direct application roles.
- Effective access must be derivable through `IdamBoxUser -> Role -> ApplicationRole -> Application`.
</truths>
</must_haves>

<threat_model>
**Assets:** user identity records, role assignments, application role definitions.
**Threats:**
- HIGH: modeling product users as Strapi admin users, creating privilege confusion.
- HIGH: direct user-to-application-role assignment bypassing the intended role bundle model.
- MEDIUM: ambiguous relation names causing future app authorization mistakes.
- MEDIUM: storing Auth0 implementation details before authentication requirements exist.
**Mitigations:**
- Create `idambox-user` as a first-class collection.
- Implement only user-to-role, role-to-application-role, and application-to-application-role relations.
- Name relation fields clearly and symmetrically.
- Include only future-proof external identity placeholder fields if useful; do not implement Auth0 login.
**Residual Risk:** Strapi content API permissions still need admin configuration if API access is exposed in future phases.
</threat_model>

<tasks>
<task id="1" type="implementation">
<title>Create Application collection</title>
<files>
- `apps/backend/src/api/application/content-types/application/schema.json`
- `apps/backend/src/api/application/controllers/application.ts`
- `apps/backend/src/api/application/routes/application.ts`
- `apps/backend/src/api/application/services/application.ts`
</files>
<action>
Create a Strapi collection type for IdamBox applications. Include fields for `name`, `slug`, `description`, and `status`. Add a one-to-many relationship from application to application roles.
</action>
<verify>
Schema uses `kind: "collectionType"`, `draftAndPublish: false`, stable `singularName`/`pluralName`, and a relation to `api::application-role.application-role`.
</verify>
<acceptance_criteria>
- Administrator can create records for IdamBox IAM, Compliance, Automation, Crypto Manager, LMS, and Cyber Risk Manager.
- Application records can show their application roles through the relationship.
</acceptance_criteria>
</task>

<task id="2" type="implementation">
<title>Create Application Role collection</title>
<files>
- `apps/backend/src/api/application-role/content-types/application-role/schema.json`
- `apps/backend/src/api/application-role/controllers/application-role.ts`
- `apps/backend/src/api/application-role/routes/application-role.ts`
- `apps/backend/src/api/application-role/services/application-role.ts`
</files>
<action>
Create a Strapi collection type for application roles with required `name`, optional `description`, a required many-to-one relation to application, and a many-to-many relation to roles.
</action>
<verify>
Schema includes `name` and `description`, plus relation fields for owning application and associated roles. Do not add fine-grained permission strings.
</verify>
<acceptance_criteria>
- Administrator can create LMS roles such as `STUDENT` and `TUTOR`.
- Each application role belongs to exactly one application.
</acceptance_criteria>
</task>

<task id="3" type="implementation">
<title>Create Role collection</title>
<files>
- `apps/backend/src/api/role/content-types/role/schema.json`
- `apps/backend/src/api/role/controllers/role.ts`
- `apps/backend/src/api/role/routes/role.ts`
- `apps/backend/src/api/role/services/role.ts`
</files>
<action>
Create a Strapi collection type for reusable role bundles. Include required `name`, optional `description`, a many-to-many relation to application roles, and a many-to-many relation to IdamBox users.
</action>
<verify>
Schema allows a role to bundle multiple application roles and be assigned to multiple users.
</verify>
<acceptance_criteria>
- Administrator can create a role bundle such as `LMS Tutor Bundle` that includes application roles for one or more applications.
- Role records do not duplicate application role definitions.
</acceptance_criteria>
</task>

<task id="4" type="implementation">
<title>Create IdamBox User collection</title>
<files>
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json`
- `apps/backend/src/api/idambox-user/controllers/idambox-user.ts`
- `apps/backend/src/api/idambox-user/routes/idambox-user.ts`
- `apps/backend/src/api/idambox-user/services/idambox-user.ts`
</files>
<action>
Create a custom IdamBox user collection. Include admin-friendly identity fields such as `email`, `firstName`, `lastName`, `displayName`, `status`, and optional `externalSubject` for later Auth0 mapping. Add a many-to-many relation to roles.
</action>
<verify>
Schema is distinct from Strapi admin users and users-permissions users. Relation points to `api::role.role`.
</verify>
<acceptance_criteria>
- Administrator can assign one or more roles to an IdamBox user.
- A user's effective application roles can be derived by traversing the role relationships.
</acceptance_criteria>
</task>
</tasks>

<verification>
Run these checks after implementation:
- Confirm all four schema files exist under `apps/backend/src/api`.
- Check relation targets and `mappedBy`/`inversedBy` pairs manually.
- Run `yarn check-types` or `yarn build` if dependencies are installed.
- If Strapi can run locally, open the admin content manager and verify the four collections are visible.
</verification>

<success_criteria>
- Four core collections exist.
- Application roles have `name`, `description`, and application ownership.
- Roles bundle application roles.
- IdamBox users receive roles.
- The relationship path required by DATA-07 is present.
</success_criteria>

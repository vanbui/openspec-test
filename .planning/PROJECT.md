# IdamBox Platform

## What This Is

IdamBox is a rebuilt platform foundation for BProton application modules such as IdamBox IAM, IdamBox Compliance, IdamBox Automation, IdamBox Crypto Manager, IdamBox LMS, and IdamBox Cyber Risk Manager. The platform starts with one shared Strapi backend that owns the core identity and authorization data model, while application-specific Next.js modules are added to the monorepo over time.

The current platform foundation includes the Strapi backend, core authorization collections, local Keycloak identity-provider setup, Strapi-to-Keycloak user provisioning, and the backend-only CSRM assessment content model. The CSRM Next.js application remains a future phase.

## Core Value

IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.

## Requirements

### Validated

- ✓ Turbo monorepo with `apps/backend` as the Strapi application and room for future `apps/*` modules — Phase 1
- ✓ IdamBox Strapi backend exists as the first application in the monorepo — Phase 1
- ✓ Strapi native admin authentication remains the Phase 1 content administration path — Phase 1
- ✓ Custom IdamBox user collection exists separately from Strapi admin users and future Auth0 users — Phase 1
- ✓ Applications, application roles, roles, and user role assignments are modeled in Strapi — Phase 1
- ✓ User access can be derived indirectly through assigned roles and those roles' application roles — Phase 1
- ✓ CSRM bootstrap application access data and sample users exist behind local seed flags — Phase 2
- ✓ Local Keycloak identity-provider setup exists for future application login — Phase 3
- ✓ Strapi IdamBox users can be provisioned into Keycloak when provisioning is enabled — Phase 4
- ✓ Backend-only CSRM assessment content model exists behind `csrmAppIsEnabled` route guarding — Phase 5

### Active

- Build the IdamBox CSRM Next.js application using Keycloak/OIDC and the Phase 5 CSRM backend model — Phase 6

### Out of Scope

- Auth0 app authentication - deferred until Next.js application modules are added.
- Building IdamBox IAM, Compliance, Automation, Crypto Manager, LMS, or Cyber Risk Manager frontends - future phases.
- Implementing fine-grained entitlement strings such as `users.read` or `roles.write` - application roles start with `name` and `description`.
- Building custom Strapi admin UI - use native Strapi administration for Phase 1.
- Production deployment, SSO, audit reporting, and compliance workflows - future platform/application work.

## Context

The root workspace contains example monorepos. The closest example is `example-projects/edalas-dylan`, which uses a Turbo monorepo with `apps/backend` for Strapi, `apps/web` for Next.js, and shared packages under `packages/*`. The IdamBox rebuild should follow that shape so future application modules can be added as independent Next.js apps under `apps/*`.

BProton's public site frames IdamBox around identity, compliance, automation, crypto management, learning, and cyber risk modules. The rebuild should treat those products as applications that can define their own application roles while sharing the central IdamBox backend.

Strapi Phase 1 uses native Strapi admin authentication for administrators who enter and edit records in Strapi. Future Next.js apps will use Auth0 for end-user authentication and map external identities to the custom IdamBox user collection.

## Constraints

- **Scope**: Phase 1 is backend-only - avoid frontend shell work until application modules are planned.
- **Authentication**: Strapi native admin authentication only for Phase 1 - Auth0 is deferred to app phases.
- **User model**: Create an IdamBox-specific user collection - do not rely on Strapi admin users as product users.
- **Role model**: Roles are bundles of application roles - application role assignment reaches users indirectly through roles.
- **Application roles**: Start with `name` and `description` only, plus the relationship to the owning application.
- **Monorepo pattern**: Follow the closest example project, `example-projects/edalas-dylan`, using an `apps/*` and `packages/*` Turbo workspace shape.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Strapi as the shared backend | The platform is underpinned by Strapi and Phase 1 is focused on core data modeling. | - Pending |
| Use Strapi native admin authentication in Phase 1 | Administrators only need to enter and manage backend data through Strapi. | - Pending |
| Defer Auth0 to app phases | Auth0 is needed for future Next.js application users, not for the initial backend-only phase. | - Pending |
| Create a custom IdamBox user collection | Product users should be separate from Strapi admin users and future external identity provider records. | - Pending |
| Model application roles as separate records | Each IdamBox application needs its own role vocabulary, such as LMS `STUDENT` and `TUTOR`. | - Pending |
| Assign application roles indirectly through roles | Roles act as reusable bundles of application roles assigned to users. | - Pending |
| Follow the `edalas-dylan` monorepo pattern | It is the closest provided example for Strapi plus Next.js apps in a Turbo monorepo. | - Pending |
| Add guarded core sample seeding | Local verification benefits from representative application and LMS role records, but production must not seed by default. | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-29 after Phase 5 completion*

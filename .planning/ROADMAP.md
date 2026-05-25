# Roadmap: IdamBox Platform

**Created:** 2026-05-20
**Granularity:** Coarse
**Current milestone:** Backend foundation

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Strapi Backend Foundation | Complete 2026-05-20. Create the IdamBox monorepo backend and core authorization data model. | MONO-01, MONO-02, MONO-03, BACK-01, BACK-02, BACK-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07 | 5 |
| 2 | CSRM Bootstrap Data | Complete 2026-05-24. Seed the Strapi backend with CSRM application access data and sample IdamBox users on boot. | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | 5 |
| 3 | Keycloak Identity Provider Setup | Complete 2026-05-25. Added a top-level Keycloak Docker setup for IdamBox with CSRM users and an OIDC client. | IDP-01, IDP-02, IDP-03, IDP-04 | 5 |
| 4 | Strapi To Keycloak User Provisioning | Provision Strapi IdamBox user records into Keycloak through backend lifecycle hooks. | IDP-05, IDP-06 | 4 |
| 5 | CSRM Backend Content Model | Add feature-flagged Strapi collections for CSRM assessment workflows. | CSRM-01, CSRM-02, CSRM-03, CSRM-04 | 5 |
| 6 | IdamBox CSRM Next.js Application | Create the first IdamBox application module for CSRM requestors and security analysts. | AUTH-01, APP-06, CSRM-05, CSRM-06, CSRM-07, CSRM-08, CSRM-09 | 6 |

## Phase Details

### Phase 1: Strapi Backend Foundation

**Goal:** Create a runnable IdamBox Strapi backend inside a Turbo monorepo and implement the core data model for users, roles, applications, and application roles.

**Requirements:**
- MONO-01
- MONO-02
- MONO-03
- BACK-01
- BACK-02
- BACK-03
- DATA-01
- DATA-02
- DATA-03
- DATA-04
- DATA-05
- DATA-06
- DATA-07

**Success Criteria:**
1. Repository has a Turbo workspace layout matching the closest example, with Strapi located at `apps/backend` and room for future app modules under `apps/*`.
2. Strapi backend can be installed, built, and run in development mode from root workspace scripts.
3. Native Strapi admin authentication allows an administrator to enter and edit Phase 1 records.
4. Content types exist for IdamBox user, role, application, and application role with the agreed Phase 1 attributes.
5. Relationships support deriving application access through `IdamBoxUser -> Role -> ApplicationRole -> Application`.

**Plans:**

**Wave 1**
- `01-PLAN.md` - Monorepo And Strapi Backend Scaffold

**Wave 2 *(blocked on Wave 1 completion)***
- `02-PLAN.md` - Core IdamBox Data Model

**Wave 3 *(blocked on Wave 2 completion)***
- `03-PLAN.md` - Backend Verification, Seeds, And Documentation

**Cross-cutting constraints:**
- Phase 1 is backend-only; do not create a frontend app.
- Strapi native admin authentication is the Phase 1 admin path.
- Auth0 is deferred to later app phases.
- Product users must use a custom IdamBox user collection, not Strapi admin users.
- Effective access must follow `IdamBoxUser -> Role -> ApplicationRole -> Application`.

**UI hint:** no

### Phase 2: CSRM Bootstrap Data

**Goal:** Populate the Strapi backend at boot with baseline CSRM application access data and representative IdamBox users.

**Requirements:**
- BOOT-01
- BOOT-02
- BOOT-03
- BOOT-04

**Depends on:** Phase 1

**Success Criteria:**
1. Strapi bootstraps an `Application` record for CSRM, standing for Cybersecurity Risk Manager.
2. Strapi bootstraps `ApplicationRole` records for `Security Analyst` and `Security Analyst Agent`, owned by the CSRM application.
3. Strapi bootstraps matching reusable `Role` records for those two application roles.
4. Strapi bootstraps IdamBox users `Jane Doe <jane.doe@idambox.com>` and `Bob Doe <bob.doe@idambox.com>`.
5. Bob Doe is assigned to the `Security Analyst` role, while Jane Doe remains an end-user/requestor account for later CSRM assessment requests.

**Plans:** 1/1 plans complete

Plans:
- [x] `02-01-PLAN.md` - CSRM Seed Data, Documentation, And Verification

**Cross-cutting constraints:**
- Preserve the authorization path: `IdamBoxUser -> Role -> ApplicationRole -> Application`.
- Bootstrap data must be idempotent so repeated Strapi starts do not create duplicate records.
- Use the existing Phase 1 custom IdamBox user model, not Strapi admin users.

**UI hint:** no

### Phase 3: Keycloak Identity Provider Setup

**Goal:** Create a top-level `idp` Keycloak Docker Compose setup for the IdamBox platform using `example-projects/idambox_old/keycloak` as the template.

**Requirements:**
- IDP-01
- IDP-02
- IDP-03
- IDP-04

**Depends on:** Phase 2

**Success Criteria:**
1. A top-level `idp` directory contains a Docker Compose based Keycloak setup adapted from `example-projects/idambox_old/keycloak`.
2. Keycloak bootstraps matching users for `jane.doe@idambox.com` and `bob.doe@idambox.com`.
3. Keycloak bootstraps an OIDC client for the future CSRM Next.js application.
4. The top-level `README.md` includes setup instructions for launching the Keycloak container.
5. Documentation states that Keycloak is the IdamBox OIDC Identity Provider and may later broker authentication to customer IdPs such as Auth0, Ping Access Management, Okta, and Entra ID.

**Plans:** 1/1 plans complete

Plans:
- [x] `03-01-PLAN.md` - Local Keycloak IDP Setup, Realm Import, Documentation, And Verification

**Cross-cutting constraints:**
- Do not wire application login into a Next.js app in this phase.
- Keep Keycloak setup reusable for future IdamBox application modules.
- Treat customer IdP brokering as future configuration, not required Phase 3 behavior.

**UI hint:** no

### Phase 4: Strapi To Keycloak User Provisioning

**Goal:** Add backend lifecycle behavior that provisions Strapi IdamBox user records into Keycloak through Keycloak's API.

**Requirements:**
- IDP-05
- IDP-06

**Depends on:** Phase 3

**Success Criteria:**
1. Strapi has a lifecycle hook or equivalent backend integration for IdamBox user creation/update events.
2. New or updated Strapi IdamBox user records can be provisioned into Keycloak through the Keycloak API.
3. Provisioning is idempotent and does not create duplicate Keycloak users for the same email address.
4. Keycloak connection settings and credentials are driven by environment configuration and are not hard-coded.

**Plans:** 0 plans

Plans:
- [ ] TBD (run `$gsd-plan-phase 4` to break down)

**Cross-cutting constraints:**
- Strapi remains the source of product user/profile records.
- Keycloak is the identity provider account store for authentication.
- Do not store Keycloak admin credentials in source-controlled files.

**UI hint:** no

### Phase 5: CSRM Backend Content Model

**Goal:** Extend the Strapi backend with CSRM assessment workflow collections that are active only when the `csrmAppIsEnabled` environment flag is true.

**Requirements:**
- CSRM-01
- CSRM-02
- CSRM-03
- CSRM-04

**Depends on:** Phase 4

**Success Criteria:**
1. Strapi defines a `CSRM Assessment Request` collection for requestor-submitted assessment requests.
2. Strapi defines a `CSRM Assessment Questionnaire` collection associated with assessment requests.
3. Strapi defines a `CSRM Assessment` collection associated with assessment requests and release state.
4. The CSRM collections are gated by the Strapi environment flag `csrmAppIsEnabled`.
5. When the flag is disabled, the backend does not expose active CSRM collection behavior to application consumers.

**Plans:** 0 plans

Plans:
- [ ] TBD (run `$gsd-plan-phase 5` to break down)

**Cross-cutting constraints:**
- Keep CSRM-specific data separate from the core platform authorization model.
- Do not build CSRM frontend workflows in this phase.
- Preserve a clean path for enabling additional application modules later.

**UI hint:** no

### Phase 6: IdamBox CSRM Next.js Application

**Goal:** Create the first IdamBox application module, IdamBox CSRM (Cybersecurity Risk Manager), as a Next.js app using `example-projects/idambox_old/keycloak/nextjs-app` as the template.

**Requirements:**
- AUTH-01
- APP-06
- CSRM-05
- CSRM-06
- CSRM-07
- CSRM-08
- CSRM-09

**Depends on:** Phase 5

**Success Criteria:**
1. A Next.js CSRM app is added to the monorepo as an IdamBox application module and uses the old Keycloak Next.js example as its template reference.
2. Requestor users such as `jane.doe@idambox.com` can view, create, and edit their own assessment requests.
3. Requestor users can view and fill out assessment questionnaires for their own assessment requests.
4. Requestor users can view assessments for their own assessment requests after those assessments are released.
5. Security Analyst users such as `bob.doe@idambox.com` can view and edit all assessment requests, assessment questionnaires, and assessments.
6. Security Analyst users can release assessments for requestor viewing.

**Plans:** 0 plans

Plans:
- [ ] TBD (run `$gsd-plan-phase 6` to break down)

**Cross-cutting constraints:**
- The CSRM app must use Keycloak/OIDC for authentication.
- Authorization must align with Strapi's `IdamBoxUser -> Role -> ApplicationRole -> Application` model.
- The app should remain one module under the Turbo monorepo, not a separate repository.

**UI hint:** yes

## Coverage Validation

All 13 v1 requirements are mapped to Phase 1.

The active roadmap now adds bootstrap data, Keycloak identity provider setup, Strapi-to-Keycloak provisioning, CSRM backend collections, and the first CSRM Next.js application across Phases 2-6.

## Future Milestones

Future milestones should add more IdamBox application modules after CSRM, using the same shared platform, Keycloak/OIDC identity provider, and application-role authorization model.

---
*Roadmap created: 2026-05-20*

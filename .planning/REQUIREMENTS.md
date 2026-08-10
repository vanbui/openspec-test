# Requirements: IdamBox Platform

**Defined:** 2026-05-20
**Core Value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.

## v1 Requirements

Requirements for the initial backend foundation release. Each maps to roadmap phases.

### Monorepo

- [x] **MONO-01**: Developer can work in a Turbo monorepo structured like the closest example, with applications under `apps/*` and shared packages under `packages/*`.
- [x] **MONO-02**: Developer can run the IdamBox Strapi backend from `apps/backend` through root workspace scripts.
- [x] **MONO-03**: Developer can add future Next.js application modules under `apps/*` without restructuring the repository.

### Backend

- [x] **BACK-01**: Administrator can access the Strapi admin panel using native Strapi admin authentication.
- [x] **BACK-02**: Administrator can create and edit IdamBox platform records through Strapi content management.
- [x] **BACK-03**: Backend configuration supports local development without requiring a Phase 1 frontend application.

### Data Model

- [x] **DATA-01**: Administrator can manage IdamBox users in a custom IdamBox-specific user collection.
- [x] **DATA-02**: Administrator can manage applications representing IdamBox modules such as IAM, Compliance, Automation, Crypto Manager, LMS, and Cyber Risk Manager.
- [x] **DATA-03**: Administrator can manage application-owned Functions as records with `name`, `description`, and navigation metadata.
- [x] **DATA-04**: Administrator can associate each Function with its owning Application and manage FunctionApi operation grants beneath a Function.
- [x] **DATA-05**: Administrator can manage Roles as reusable bundles of application-owned Functions.
- [x] **DATA-06**: Administrator can assign one or more roles to an IdamBox user.
- [x] **DATA-07**: Backend data relationships allow a user's effective application access to be derived through `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi records supplying operation-level grants.

## v2 Requirements

Identity provider, CSRM bootstrap, and first application-module requirements added after Phase 1 completion.

### Authentication

- [x] **IDP-01**: Developer can run a top-level Keycloak Docker Compose setup for IdamBox from an `idp` directory.
- [x] **IDP-02**: Keycloak bootstraps IdamBox test users matching the Strapi sample users.
- [x] **IDP-03**: Keycloak bootstraps an OIDC client for the CSRM Next.js application.
- [x] **IDP-04**: Documentation explains launching Keycloak and its future role as a broker to customer IdPs such as Auth0, Ping Access Management, Okta, and Entra ID.
- **IDP-05**: Strapi can provision custom IdamBox user records into Keycloak through the Keycloak API.
- **IDP-06**: Keycloak provisioning is idempotent and configured through environment values rather than hard-coded secrets.
- **AUTH-01**: User can authenticate into a Next.js IdamBox application using Keycloak/OIDC.

### Future Identity Broker

- **AUTH-02**: Customer IdP identities, including Auth0 identities, can be brokered through Keycloak and mapped to IdamBox user records.

### Bootstrap Data

- [x] **BOOT-01**: Strapi can seed a CSRM application record at backend boot.
- [x] **BOOT-02**: Strapi can seed CSRM application-owned Function and FunctionApi access data for Security Analyst and the equivalent Security Analyst Agent Role.
- [x] **BOOT-03**: Strapi can seed reusable Function-backed Roles for Security Analyst, Security Analyst Agent with the same Function grants, and the current Requestor catalogue Role.
- [x] **BOOT-04**: Strapi can seed Jane Doe and Bob Doe as custom IdamBox users, assigning Bob Doe to the Security Analyst role.

### CSRM

- **CSRM-01**: Administrator can enable CSRM backend collections through the `csrmAppIsEnabled` environment flag.
- **CSRM-02**: Backend can manage CSRM Assessment Request records.
- **CSRM-03**: Backend can manage CSRM Assessment Questionnaire records associated with assessment requests.
- **CSRM-04**: Backend can manage CSRM Assessment records associated with assessment requests and release state.
- **CSRM-05**: Requestor can create, view, and edit their own CSRM assessment requests in a Next.js application.
- **CSRM-06**: Requestor can view and fill out assessment questionnaires for their own assessment requests.
- **CSRM-07**: Requestor can view released assessments for their own assessment requests.
- **CSRM-08**: Security Analyst can view and edit all CSRM assessment requests, questionnaires, and assessments.
- **CSRM-09**: Security Analyst can release assessments for requestor viewing.

### Accepted Authorization Migration

The completed Phase 1/2 requirement wording above records the accepted migration from the former `ApplicationRole` terminology to the implemented Application/Function/FunctionApi/Role model. It supersedes the historical terminology without reopening completed Phase 1 or Phase 2 scope.

### Applications

- **APP-06**: IdamBox Cyber Risk Manager can be added as a Next.js application module.

### Deferred Application Modules

- **APP-01**: IdamBox IAM can be added as a Next.js application module.
- **APP-02**: IdamBox Compliance can be added as a Next.js application module.
- **APP-03**: IdamBox Automation can be added as a Next.js application module.
- **APP-04**: IdamBox Crypto Manager can be added as a Next.js application module.
- **APP-05**: IdamBox LMS can be added as a Next.js application module.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                           | Reason                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| Auth0 login in Phase 1            | App authentication starts when Next.js modules are added.        |
| Next.js frontend shell in Phase 1 | Current scope is the Strapi backend and core model only.         |
| Free-floating fine-grained permissions | Application authorization is modeled through Functions and FunctionApi operation grants, not standalone permission strings. |
| Custom Strapi admin UI            | Native Strapi admin is sufficient for Phase 1.                   |
| Production deployment             | First milestone is backend/data-model foundation.                |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| MONO-01     | Phase 1 | Complete |
| MONO-02     | Phase 1 | Complete |
| MONO-03     | Phase 1 | Complete |
| BACK-01     | Phase 1 | Complete |
| BACK-02     | Phase 1 | Complete |
| BACK-03     | Phase 1 | Complete |
| DATA-01     | Phase 1 | Complete |
| DATA-02     | Phase 1 | Complete |
| DATA-03     | Phase 1 | Complete |
| DATA-04     | Phase 1 | Complete |
| DATA-05     | Phase 1 | Complete |
| DATA-06     | Phase 1 | Complete |
| DATA-07     | Phase 1 | Complete |
| BOOT-01     | Phase 2 | Complete |
| BOOT-02     | Phase 2 | Complete |
| BOOT-03     | Phase 2 | Complete |
| BOOT-04     | Phase 2 | Complete |
| IDP-01      | Phase 3 | Complete |
| IDP-02      | Phase 3 | Complete |
| IDP-03      | Phase 3 | Complete |
| IDP-04      | Phase 3 | Complete |
| IDP-05      | Phase 4 | Complete |
| IDP-06      | Phase 4 | Complete |
| AUTH-01     | Phase 13 | Planned  |
| CSRM-01     | Phase 5 | Planned  |
| CSRM-02     | Phase 5 | Planned  |
| CSRM-03     | Phase 5 | Planned  |
| CSRM-04     | Phase 5 | Planned  |
| CSRM-05     | Phases 7, 13 | Planned  |
| CSRM-06     | Phases 8, 13 | Planned  |
| CSRM-07     | Phases 9, 13 | Planned  |
| CSRM-08     | Phases 8-13 | Planned  |
| CSRM-09     | Phases 9, 13 | Planned  |
| APP-06      | Phases 6, 13 | Planned  |

**Coverage:**

- v1 requirements: 13 total
- v2 active roadmap requirements: 21 total
- Mapped to phases: 34
- Unmapped: 0

---

_Requirements defined: 2026-05-20_
_Last updated: 2026-05-25 after completing Phase 3_

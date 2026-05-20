# Requirements: IdamBox Platform

**Defined:** 2026-05-20
**Core Value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.

## v1 Requirements

Requirements for the initial backend foundation release. Each maps to roadmap phases.

### Monorepo

- [ ] **MONO-01**: Developer can work in a Turbo monorepo structured like the closest example, with applications under `apps/*` and shared packages under `packages/*`.
- [ ] **MONO-02**: Developer can run the IdamBox Strapi backend from `apps/backend` through root workspace scripts.
- [ ] **MONO-03**: Developer can add future Next.js application modules under `apps/*` without restructuring the repository.

### Backend

- [ ] **BACK-01**: Administrator can access the Strapi admin panel using native Strapi admin authentication.
- [ ] **BACK-02**: Administrator can create and edit IdamBox platform records through Strapi content management.
- [ ] **BACK-03**: Backend configuration supports local development without requiring a Phase 1 frontend application.

### Data Model

- [ ] **DATA-01**: Administrator can manage IdamBox users in a custom IdamBox-specific user collection.
- [ ] **DATA-02**: Administrator can manage applications representing IdamBox modules such as IAM, Compliance, Automation, Crypto Manager, LMS, and Cyber Risk Manager.
- [ ] **DATA-03**: Administrator can manage application roles as records with `name` and `description`.
- [ ] **DATA-04**: Administrator can associate each application role with its owning application.
- [ ] **DATA-05**: Administrator can manage roles as reusable bundles of application roles.
- [ ] **DATA-06**: Administrator can assign one or more roles to an IdamBox user.
- [ ] **DATA-07**: Backend data relationships allow a user's effective application roles to be derived through user -> roles -> application roles -> application.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: User can authenticate into a Next.js IdamBox application using Auth0.
- **AUTH-02**: Auth0 identities can be mapped to IdamBox user records.

### Applications

- **APP-01**: IdamBox IAM can be added as a Next.js application module.
- **APP-02**: IdamBox Compliance can be added as a Next.js application module.
- **APP-03**: IdamBox Automation can be added as a Next.js application module.
- **APP-04**: IdamBox Crypto Manager can be added as a Next.js application module.
- **APP-05**: IdamBox LMS can be added as a Next.js application module.
- **APP-06**: IdamBox Cyber Risk Manager can be added as a Next.js application module.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auth0 login in Phase 1 | App authentication starts when Next.js modules are added. |
| Next.js frontend shell in Phase 1 | Current scope is the Strapi backend and core model only. |
| Fine-grained permissions | Application roles start as simple named roles with descriptions. |
| Custom Strapi admin UI | Native Strapi admin is sufficient for Phase 1. |
| Production deployment | First milestone is backend/data-model foundation. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MONO-01 | Phase 1 | Pending |
| MONO-02 | Phase 1 | Pending |
| MONO-03 | Phase 1 | Pending |
| BACK-01 | Phase 1 | Pending |
| BACK-02 | Phase 1 | Pending |
| BACK-03 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| DATA-07 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after roadmap creation*

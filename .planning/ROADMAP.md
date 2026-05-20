# Roadmap: IdamBox Platform

**Created:** 2026-05-20
**Granularity:** Coarse
**Current milestone:** Backend foundation

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Strapi Backend Foundation | Create the IdamBox monorepo backend and core authorization data model. | MONO-01, MONO-02, MONO-03, BACK-01, BACK-02, BACK-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07 | 5 |

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

## Coverage Validation

All 13 v1 requirements are mapped to Phase 1. No v1 requirements are unmapped.

## Future Milestones

Future milestones should add Auth0-backed Next.js application modules one at a time, starting with whichever IdamBox product module has the clearest immediate business need.

---
*Roadmap created: 2026-05-20*

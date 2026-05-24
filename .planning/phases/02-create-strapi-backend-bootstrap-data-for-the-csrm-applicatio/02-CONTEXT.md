# Phase 2: CSRM Bootstrap Data - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 adds idempotent Strapi boot-time bootstrap data for the CSRM application, its two CSRM application roles, matching reusable IdamBox roles, and two representative IdamBox users. It does not add Keycloak, CSRM content types, or the CSRM Next.js app; those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Seed Activation Policy
- **D-01:** CSRM bootstrap data must use a separate environment flag named `IDAMBOX_SEED_CSRM=true|false`.
- **D-02:** `IDAMBOX_SEED_CSRM` is independent from the existing `IDAMBOX_SEED_CORE` sample-data flag, so planners should not require enabling Phase 1 sample data to seed CSRM records.
- **D-03:** The CSRM seed must be idempotent: repeated Strapi boots with `IDAMBOX_SEED_CSRM=true` must not create duplicate applications, application roles, roles, or users.

### CSRM Application Identity
- **D-04:** The Strapi `Application` record must use `name: "IdamBox CSRM"`.
- **D-05:** The Strapi `Application` record must use `slug: "idambox-csrm"`.
- **D-06:** The application description should expand CSRM as Cybersecurity Risk Manager.

### Roles And Users
- **D-07:** Create exactly two CSRM `ApplicationRole` records in Phase 2: `Security Analyst` and `Security Analyst Agent`.
- **D-08:** Create matching reusable `Role` records for `Security Analyst` and `Security Analyst Agent`, each bundling its matching CSRM application role.
- **D-09:** Create active IdamBox user `Jane Doe <jane.doe@idambox.com>` with no role assignments in Phase 2. Jane represents a future requestor/end user, but Phase 2 must not introduce an extra requestor role.
- **D-10:** Create active IdamBox user `Bob Doe <bob.doe@idambox.com>` and assign Bob to the reusable `Security Analyst` role.

### Verification
- **D-11:** Phase 2 verification should include static checks plus idempotency-focused verification.
- **D-12:** Verification should prove the seed definitions, `IDAMBOX_SEED_CSRM` configuration, and relationship targets are correct, and should check that running seed logic more than once does not duplicate records where practical.

### the agent's Discretion
- Planners may choose the internal helper/module structure for CSRM seed code as long as it follows existing Strapi bootstrap patterns and keeps CSRM seed activation separate from `IDAMBOX_SEED_CORE`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Sources
- `.planning/ROADMAP.md` — Phase 2 goal, requirements, success criteria, dependency, and constraints.
- `.planning/REQUIREMENTS.md` — `BOOT-01` through `BOOT-04` and Phase 2 traceability.
- `.planning/PROJECT.md` — platform constraints and authorization model.
- `.planning/STATE.md` — current focus and memory from Phase 1.

### Existing Backend Code
- `apps/backend/src/bootstrap/seed-core-data.ts` — existing guarded Strapi seed implementation and idempotent application/application-role lookup pattern.
- `apps/backend/src/index.ts` — Strapi bootstrap entry point that currently calls `seedCoreData`.
- `apps/backend/.env.example` — existing seed flag convention for `IDAMBOX_SEED_CORE`.
- `apps/backend/README.md` — existing sample-data documentation pattern.
- `apps/backend/src/api/application/content-types/application/schema.json` — Application attributes and relationships.
- `apps/backend/src/api/application-role/content-types/application-role/schema.json` — ApplicationRole attributes and relationships.
- `apps/backend/src/api/role/content-types/role/schema.json` — reusable Role attributes and relationships.
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json` — IdamBox user attributes and role relationship.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `seedCoreData(strapi)` in `apps/backend/src/bootstrap/seed-core-data.ts`: reusable pattern for guarded boot-time seed execution using Strapi document services.
- `slugify` helper in `seed-core-data.ts`: existing slug generation pattern, though Phase 2 locks `idambox-csrm` explicitly.
- Strapi document services for `api::application.application`, `api::application-role.application-role`, `api::role.role`, and `api::idambox-user.idambox-user`: integration surface for creating and linking all Phase 2 records.

### Established Patterns
- Seed behavior is currently opt-in through an environment flag and disabled by default.
- Application records are looked up by slug before create.
- Application roles are looked up by role name plus owning application before create.
- Role assignment must preserve `IdamBoxUser -> Role -> ApplicationRole -> Application`.

### Integration Points
- `apps/backend/src/index.ts` is the Strapi bootstrap entry point where the CSRM seed should be invoked.
- `apps/backend/.env.example` should document `IDAMBOX_SEED_CSRM`.
- `apps/backend/README.md` should document the CSRM seed behavior and the records created.

</code_context>

<specifics>
## Specific Ideas

- Treat Jane Doe as a future requestor sample user, but do not create or assign a requestor role in Phase 2.
- Treat Bob Doe as the sample security analyst user by assigning the reusable `Security Analyst` role.
- Keep `Security Analyst Agent` available as seeded authorization data, but do not assign it to Jane or Bob unless a future phase asks for it.

</specifics>

<deferred>
## Deferred Ideas

- Keycloak users and OIDC client bootstrap belong to Phase 3.
- Strapi-to-Keycloak user provisioning belongs to Phase 4.
- CSRM assessment request, questionnaire, and assessment collections belong to Phase 5.
- CSRM requestor/security analyst frontend workflows belong to Phase 6.

</deferred>

---

*Phase: 2-CSRM Bootstrap Data*
*Context gathered: 2026-05-24*

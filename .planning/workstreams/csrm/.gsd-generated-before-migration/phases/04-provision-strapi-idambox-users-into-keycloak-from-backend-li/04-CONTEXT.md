# Phase 4: Strapi To Keycloak User Provisioning - Context

**Gathered:** 2026-05-25T20:07:09Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 adds backend behavior that provisions custom Strapi `IdamBox User` records into Keycloak through the Keycloak Admin API. Provisioning runs from Strapi user create/update lifecycle behavior, creates or updates users in the existing `idambox` realm, stores the Keycloak user ID back on the Strapi user, and keeps credentials/configuration environment-driven.

This phase may update the local Keycloak realm seed to add a dedicated Strapi admin API client. It must not build Next.js login, move product authorization into Keycloak, add CSRM workflow content types, or use Strapi admin users as IdamBox product users.

</domain>

<decisions>
## Implementation Decisions

### Provisioning Trigger And Activation
- **D-01:** Provisioning must run on custom Strapi `IdamBox User` create and update events.
- **D-02:** Provisioning must be explicitly gated by `IDAMBOX_KEYCLOAK_PROVISIONING=true`.
- **D-03:** Provisioning must also require complete Keycloak environment configuration. Missing required config should prevent provisioning from running successfully rather than silently using committed defaults.
- **D-04:** A failed Keycloak provisioning operation must fail the Strapi create/update operation so Strapi and Keycloak do not silently drift.

### Keycloak Realm And Admin Client
- **D-05:** Strapi-created users must be created in the existing Keycloak `idambox` realm.
- **D-06:** Phase 4 must update `idp/keycloak/import/idambox-realm.json` with a dedicated service-account-style admin API client for Strapi.
- **D-07:** The local admin API client ID must be `idambox-strapi-admin`.
- **D-08:** The local admin API client secret must be `idambox-strapi-admin-local-secret`.
- **D-09:** The dedicated client values are local-only development values and documentation must say they must not be reused outside local development.
- **D-10:** Strapi must use the dedicated client ID/secret for Keycloak Admin API calls, not the bootstrap `admin` / `admin` username and password.

### User Mapping And Idempotency
- **D-11:** Provisioning should find or create Keycloak users by the unique IdamBox user email address.
- **D-12:** After successful Keycloak create or lookup, Strapi must store the Keycloak user ID in the `IdamBox User.externalSubject` field.
- **D-13:** Future updates should use `externalSubject` when present, while retaining email lookup as the idempotency path when `externalSubject` is missing.
- **D-14:** Provisioning must not create duplicate Keycloak users for the same email address.

### Password And Required Action Behavior
- **D-15:** When creating a Keycloak user, if the Strapi `IdamBox User.password` field is set to a non-empty value, use it to set the Keycloak account password.
- **D-16:** When creating a Keycloak user and the Strapi password field is missing or empty, create the Keycloak account without committed passwords and set an appropriate Keycloak required action such as password setup/reset.
- **D-17:** When updating a Keycloak user, set the Keycloak password only if the Strapi `IdamBox User.password` field is set to a non-empty value.
- **D-18:** After a successful Keycloak user create or update, always clear the Strapi `IdamBox User.password` field.
- **D-19:** The Strapi password field must remain a transient write-only provisioning input, not a persisted product credential store.

### the agent's Discretion
- Planners may choose the internal module structure for Keycloak client code, lifecycle hooks, and shared helpers as long as it follows existing Strapi backend patterns.
- Planners may choose exact environment variable names beyond the locked activation flag and local client values, but they must clearly cover base URL, realm, admin client ID, and admin client secret.
- Planners may choose the exact Keycloak required action name after verifying the current Keycloak Admin API representation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Sources
- `.planning/ROADMAP.md` — Phase 4 goal, requirements, success criteria, dependency, and constraints.
- `.planning/REQUIREMENTS.md` — `IDP-05` and `IDP-06` requirements and Phase 4 traceability.
- `.planning/PROJECT.md` — platform constraints, custom product user boundary, and authorization model.
- `.planning/STATE.md` — current focus and memory from completed phases.
- `.planning/phases/03-create-keycloak-docker-compose-identity-provider-setup-for-i/03-CONTEXT.md` — locked Keycloak realm, local-only credential warnings, and authorization boundary.
- `.planning/phases/02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio/02-CONTEXT.md` — Jane/Bob Strapi user seed context and product-user identity decisions.

### Backend Integration Points
- `apps/backend/src/index.ts` — existing Strapi bootstrap entry point and established backend startup integration style.
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json` — custom product user attributes, including `email`, `status`, `externalSubject`, `password`, and `roles`.
- `apps/backend/src/api/idambox-user/services/idambox-user.ts` — current core service for IdamBox users.
- `apps/backend/src/api/idambox-user/controllers/idambox-user.ts` — current core controller for IdamBox users.
- `apps/backend/src/api/idambox-user/routes/idambox-user.ts` — current core router for IdamBox users.
- `apps/backend/src/bootstrap/seed-csrm-data.ts` — existing idempotent Strapi document-service user lookup/create/update pattern.
- `apps/backend/.env.example` — existing environment variable documentation pattern for backend behavior flags.
- `apps/backend/README.md` — backend documentation surface for new provisioning behavior.

### Keycloak Integration Points
- `idp/keycloak/import/idambox-realm.json` — existing local `idambox` realm seed that must gain the dedicated Strapi admin API client.
- `idp/docker-compose.yml` — local Keycloak runtime and realm import mount.
- `idp/README.md` — detailed Keycloak setup documentation and local-only credential warning surface.
- `README.md` — root quickstart and verification documentation surface.
- `scripts/verify-keycloak-idp.mjs` — existing static Keycloak realm verifier that should be extended or complemented for the new admin client contract.
- `package.json` — root script surface for verification commands.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/bootstrap/seed-csrm-data.ts`: demonstrates Strapi document-service lookup by unique email, create when missing, and update existing user records.
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json`: already has `externalSubject` for external identity subject storage and a private `password` field suitable as a transient provisioning input.
- `idp/keycloak/import/idambox-realm.json`: existing committed local realm seed for the `idambox` realm and future CSRM OIDC client.
- `scripts/verify-keycloak-idp.mjs`: existing static verifier pattern for checking realm JSON, docs, and root scripts without requiring Docker runtime.

### Established Patterns
- Local seed and verification behavior is explicit and environment-driven rather than hidden.
- Local-only secrets may be committed only when clearly documented as development-only values.
- Product authorization remains in Strapi through `IdamBoxUser -> Role -> Entitlement -> Application`; Keycloak authenticates users and must not become the product authorization source in this phase.
- Existing sample users are custom Strapi `IdamBox User` records, not Strapi admin users.

### Integration Points
- Add lifecycle behavior or equivalent Strapi backend integration around `api::idambox-user.idambox-user`.
- Add Keycloak Admin API client code under the backend, configured by environment.
- Update `idp/keycloak/import/idambox-realm.json` with `idambox-strapi-admin` and `idambox-strapi-admin-local-secret`.
- Update `apps/backend/.env.example`, `apps/backend/README.md`, `idp/README.md`, and `README.md` with provisioning configuration and local-only warnings.
- Extend or add verification so Phase 4 checks the backend provisioning contract, required environment values, realm admin client seed, and password-clearing behavior where practical.

</code_context>

<specifics>
## Specific Ideas

- Use activation flag `IDAMBOX_KEYCLOAK_PROVISIONING=true`.
- Use Keycloak realm `idambox`.
- Use local admin API client ID `idambox-strapi-admin`.
- Use local admin API client secret `idambox-strapi-admin-local-secret`.
- Store the Keycloak user ID in `IdamBox User.externalSubject`.
- Treat `IdamBox User.password` as a temporary provisioning input that is cleared after successful Keycloak synchronization.

</specifics>

<deferred>
## Deferred Ideas

- Next.js OIDC login wiring belongs to Phase 6.
- CSRM assessment request, questionnaire, and assessment collections belong to Phase 5.
- Customer IdP brokering configuration remains future work.
- Keycloak CSRM authorization roles or groups remain out of scope; Strapi remains the product authorization source.

</deferred>

---

*Phase: 4-Strapi To Keycloak User Provisioning*
*Context gathered: 2026-05-25T20:07:09Z*

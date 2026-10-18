# Phase 3: Keycloak Identity Provider Setup - Context

**Gathered:** 2026-05-25T10:16:46Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 adds a top-level `idp` directory containing a local Docker Compose based Keycloak setup for IdamBox. It bootstraps the `idambox` realm, Jane Doe and Bob Doe as local test users, and an OIDC confidential client for the future CSRM Next.js application. It also documents how to launch, inspect, reset, and use Keycloak as the IdamBox OIDC provider.

This phase does not wire login into a Next.js application, provision Strapi users into Keycloak, add CSRM backend workflow collections, or duplicate Strapi authorization roles/groups inside Keycloak.

</domain>

<decisions>
## Implementation Decisions

### Local Credentials And User Bootstrap
- **D-01:** Phase 3 may commit easy local-only credentials because the Keycloak setup is explicitly for local development.
- **D-02:** Keep the Keycloak bootstrap admin credentials as `admin` / `admin`, matching the old template.
- **D-03:** Import `jane.doe@idambox.com` as an enabled, email-verified local user with no required actions and password `jane`.
- **D-04:** Import `bob.doe@idambox.com` as an enabled, email-verified local user with no required actions and password `bob`.
- **D-05:** Documentation must clearly label all committed credentials and secrets as local-only values that must not be reused outside local development.

### CSRM OIDC Client Values
- **D-06:** The future CSRM Next.js application client ID must be `idambox-csrm`.
- **D-07:** The local confidential client secret must be `idambox-csrm-local-secret`.
- **D-08:** The CSRM app local origin must be `http://localhost:3000`.
- **D-09:** The CSRM client redirect URI must be `http://localhost:3000/api/auth/callback/keycloak`.
- **D-10:** The CSRM client post-logout/home URL and web origin must be `http://localhost:3000`.
- **D-11:** The client should follow the old template's Auth.js-compatible OIDC shape, including a confidential client, standard authorization code flow, PKCE S256, and no implicit flow.

### Realm Import And Reset Behavior
- **D-12:** Bootstrap Keycloak with committed static realm JSON under `idp/keycloak/import/idambox-realm.json`.
- **D-13:** Run Keycloak with `start-dev --import-realm`, adapted from the old template.
- **D-14:** Use a named Docker volume for Keycloak data so local admin-console edits survive normal `docker compose down` / `docker compose up -d` restarts.
- **D-15:** Documentation must explain that Keycloak skips importing an existing realm from JSON and that developers must run `docker compose down -v` from `idp/` to remove the volume and force a clean re-import.
- **D-16:** Do not add Keycloak realm roles or groups for CSRM authorization in Phase 3. Keycloak authenticates users; Strapi remains the source for IdamBox product authorization through `IdamBoxUser -> Role -> Entitlement -> Application`.

### Developer Command Surface And Documentation
- **D-17:** Developers should start Keycloak from the top-level `idp/` directory with `docker compose up -d`.
- **D-18:** The root `README.md` should include Keycloak quickstart commands, admin URL, local credentials, OIDC issuer/client values, and reset notes.
- **D-19:** Add a detailed `idp/README.md` covering setup, credentials, realm import behavior, reset behavior, OIDC values, and Keycloak's future broker role for customer IdPs.
- **D-20:** Phase 3 verification should include static checks for the Docker Compose file, realm JSON, and documentation. Docker startup should be documented as the runtime verification path, but static verification is sufficient for automated checks when Docker is unavailable.

### the agent's Discretion
- Planners may choose the exact static verifier implementation and script name, as long as it verifies the Phase 3 compose, realm, and documentation contract.
- Planners may preserve or adapt nonessential Keycloak realm display metadata from the old template when it does not conflict with the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Sources
- `.planning/ROADMAP.md` — Phase 3 goal, requirements, success criteria, dependency, and constraints.
- `.planning/REQUIREMENTS.md` — `IDP-01` through `IDP-04` and Phase 3 traceability.
- `.planning/PROJECT.md` — platform constraints, authentication boundary, and shared authorization model.
- `.planning/STATE.md` — current focus and memory from completed phases.
- `.planning/phases/02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio/02-CONTEXT.md` — Jane/Bob identity decisions and CSRM application identity from Phase 2.

### Keycloak Template
- `example-projects/idambox_old/keycloak/docker-compose.yml` — source template for local Keycloak service, `start-dev --import-realm`, named volume, and import mount.
- `example-projects/idambox_old/keycloak/keycloak/import/idambox-realm.json` — source template for the `idambox` realm, local user import shape, and confidential OIDC client settings.
- `example-projects/idambox_old/keycloak/README.md` — source template for quickstart, credential warnings, OIDC value tables, and reset documentation.

### Existing Backend Context
- `apps/backend/src/bootstrap/seed-csrm-data.ts` — current Jane/Bob Strapi sample users that Keycloak bootstrap users must match by email.
- `apps/backend/src/bootstrap/seed-core-data.ts` — CSRM application slug and reusable role naming context.
- `README.md` — root developer setup documentation that should gain Keycloak launch instructions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `example-projects/idambox_old/keycloak/docker-compose.yml`: reusable Compose structure using `quay.io/keycloak/keycloak:26.6.1`, `start-dev --import-realm`, loopback port binding, admin bootstrap env vars, a named volume, and read-only import mount.
- `example-projects/idambox_old/keycloak/keycloak/import/idambox-realm.json`: reusable realm JSON structure for enabled realm, email login, committed local users, and confidential OIDC client.
- `example-projects/idambox_old/keycloak/README.md`: reusable documentation pattern for quickstart, local-only credential warnings, OIDC value mapping, and persisted state vs import JSON behavior.

### Established Patterns
- Root package scripts currently expose Strapi/backend checks, but no Docker or IDP scripts exist yet.
- Phase 2 sample users are Strapi product users, not Strapi admin users. Phase 3 Keycloak users must match those product-user emails.
- Authorization remains in Strapi's IdamBox model; Phase 3 Keycloak should avoid creating competing role/group authorization sources.

### Integration Points
- Add the new Keycloak setup under top-level `idp/`.
- Update root `README.md` with IDP quickstart and canonical local OIDC values.
- Add `idp/README.md` for detailed Keycloak setup and reset instructions.
- Add static verification through a root script if planning chooses a verifier, consistent with existing `verify:schema` and `verify:csrm-seed` patterns.

</code_context>

<specifics>
## Specific Ideas

- Use realm `idambox`.
- Use client ID `idambox-csrm`.
- Use local client secret `idambox-csrm-local-secret`.
- Use issuer `http://localhost:8080/realms/idambox`.
- Use admin console URL `http://localhost:8080/admin`.
- Use CSRM local app origin `http://localhost:3000`.
- Use callback URL `http://localhost:3000/api/auth/callback/keycloak`.
- Treat Keycloak as the stable OIDC provider from the future CSRM app perspective, even if Keycloak later brokers to Auth0, Ping Access Management, Okta, or Entra ID.

</specifics>

<deferred>
## Deferred Ideas

- Strapi-to-Keycloak user provisioning belongs to Phase 4.
- CSRM assessment request, questionnaire, and assessment collections belong to Phase 5.
- Wiring actual Next.js login, Auth.js configuration, requestor/security analyst workflows, and browser login verification belongs to Phase 6.
- Customer IdP brokering configuration is future work; Phase 3 documentation should mention the role but not implement external IdP integrations.

</deferred>

---

*Phase: 3-Keycloak Identity Provider Setup*
*Context gathered: 2026-05-25T10:16:46Z*

---
phase: 04
phase_name: Strapi To Keycloak User Provisioning
status: complete
created: 2026-05-25T20:30:00Z
---

# Phase 04 Research — Strapi To Keycloak User Provisioning

## Research Complete

Phase 4 should be planned as a backend integration with three concerns:

1. Update the local Keycloak realm seed so Strapi has a dedicated service-account client for Admin API calls.
2. Add Strapi-side provisioning around the custom `api::idambox-user.idambox-user` document flow.
3. Add static and type verification that proves the integration contract without requiring Docker in automated checks.

## Key Findings

### Strapi Integration Point

Strapi 5 supports content-type model files under `./src/api/[api-name]/content-types/[content-type-name]/`, including manually created lifecycle hook files. The current project already centralizes startup customization in `apps/backend/src/index.ts`, which is also where Phase 2 seed behavior is invoked.

For Strapi 5, Document Service middleware is the better fit for most custom document-level behavior. Official Strapi docs show `strapi.documents.use(middleware)` and document that the middleware context includes `uid`, `action`, and `params`, with `create` and `update` actions represented in the context. The plan should use this route unless execution discovers an incompatible Strapi 5.23.6 typing/runtime issue, in which case a registered lifecycle subscriber in `src/index.ts` is the fallback.

Recommended shape:

- Register middleware from `apps/backend/src/index.ts` or a helper imported by it.
- Filter to `uid === 'api::idambox-user.idambox-user'`.
- Filter to `action === 'create' || action === 'update'`.
- Skip unless `process.env.IDAMBOX_KEYCLOAK_PROVISIONING === 'true'`.
- Call `await next()` first so Strapi validation and persistence happen.
- Provision the persisted document into Keycloak.
- Persist `externalSubject` and clear `password` after successful provisioning.
- Avoid recursive provisioning when clearing `password` and storing `externalSubject`.

### Keycloak Admin API Authentication

Keycloak supports service accounts for confidential clients. Its server administration guide states that service account roles and client role-scope mappings combine to determine token roles, and the client credentials token URL is `/realms/{realm-name}/protocol/openid-connect/token`.

Plan the local realm seed with:

- client ID: `idambox-strapi-admin`
- client secret: `idambox-strapi-admin-local-secret`
- confidential client with `serviceAccountsEnabled: true`
- no browser login redirect/web origins needed for this admin client
- service-account user granted only the minimum `realm-management` client roles needed for user provisioning: `view-users`, `manage-users`, and `query-users` if required by Keycloak 26 import/runtime behavior

Strapi should call Keycloak with environment values, not hard-coded production credentials:

- `IDAMBOX_KEYCLOAK_PROVISIONING=true`
- `KEYCLOAK_BASE_URL=http://localhost:8080`
- `KEYCLOAK_REALM=idambox`
- `KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin`
- `KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret`

### User Provisioning Contract

Keycloak users should be matched idempotently:

- Prefer `externalSubject` when already present.
- Otherwise lookup by exact email in the `idambox` realm.
- If not found, create a new Keycloak user with `username` equal to email, `email` equal to email, `enabled` based on Strapi `status === 'active'`, and profile fields from Strapi.
- Store the Keycloak user ID in Strapi `externalSubject` after create or lookup.

Password handling is the most important implementation detail:

- On create, if Strapi `password` is non-empty, set the Keycloak credential.
- On create, if Strapi `password` is missing/empty, create without credentials and set a required action such as `UPDATE_PASSWORD`.
- On update, only reset Keycloak password when Strapi `password` is non-empty.
- After successful create/update, clear Strapi `password`.

Failure policy is strict:

- If provisioning is enabled and Keycloak config/API fails, fail the Strapi create/update.
- Do not save silent drift as "eventual consistency" in this phase.

### Verification Strategy

Runtime Keycloak tests are useful but should not be the required automated gate for this phase because prior phases already use static verification when Docker is unavailable. Phase 4 should add a static verifier that checks:

- Keycloak realm JSON includes `idambox-strapi-admin` with the local secret and service-account settings.
- Docs mention local-only status and required env vars.
- Backend source includes the activation flag and no `admin/admin` Admin API credential usage.
- Backend provisioning source references `externalSubject`, email lookup, password clearing, and required action behavior.
- Root `package.json` exposes `verify:keycloak-provisioning`.

The normal verification chain should become:

```text
yarn verify:keycloak-idp
yarn verify:keycloak-provisioning
yarn verify:schema
yarn verify:csrm-seed
yarn check-types
```

Optional manual runtime verification can launch Keycloak with Docker, run Strapi with provisioning env vars, create/update an IdamBox user, and inspect Keycloak. That should be documented but not required for automated phase completion.

## Validation Architecture

The phase can be validated without adding a test framework:

- Static verifier: `node scripts/verify-keycloak-provisioning.mjs`
- Type checker: `yarn check-types`
- Existing static checks: `yarn verify:keycloak-idp`, `yarn verify:schema`, `yarn verify:csrm-seed`

Use source assertions and JSON parsing rather than brittle text-only checks where possible.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Keycloak service-account import shape is wrong | Keep Phase 4 verifier focused on source contract; document runtime reset with `docker compose down -v`; executor should inspect the existing realm JSON shape before editing. |
| Password clearing causes recursive provisioning | Plan an explicit recursion guard or internal persistence helper that only updates `externalSubject` and clears `password` after successful provisioning. |
| Keycloak unavailable blocks admin saves | This is intentional per context D-04 when provisioning is enabled; docs must make local setup prerequisites explicit. |
| Product authorization leaks into Keycloak | Do not add CSRM roles/groups; the dedicated admin client exists only for user management API access. |
| Secrets accidentally treated as production | Docs and `.env.example` must label committed local client secret as local-only and require environment-driven values. |

## Sources

- Strapi Models docs — content-type model files and `lifecycles.js`: https://docs.strapi.io/cms/backend-customization/models
- Strapi Document Service middleware docs — `strapi.documents.use(middleware)` and context fields: https://docs.strapi.io/cms/api/document-service/middlewares
- Strapi blog — Strapi 5 guidance favoring Document Service middleware for most lifecycle-style behavior: https://strapi.io/blog/when-to-use-lifecycle-hooks-in-strapi
- Keycloak Server Administration Guide — service account roles and client credentials token endpoint: https://www.keycloak.org/docs/latest/server_admin/index.html
- Keycloak Admin REST API — admin endpoints use `realm` path parameter as realm name: https://www.keycloak.org/docs-api/26.5.2/rest-api/


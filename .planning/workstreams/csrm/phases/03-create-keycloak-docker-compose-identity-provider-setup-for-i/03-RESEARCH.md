---
phase: 03
slug: create-keycloak-docker-compose-identity-provider-setup-for-i
status: complete
created: 2026-05-25
sources:
  - https://www.keycloak.org/server/importExport
  - https://www.keycloak.org/getting-started/getting-started-docker
  - https://www.keycloak.org/server/containers
---

# Phase 3 Research: Keycloak Identity Provider Setup

## Research Complete

Phase 3 should adapt the existing local Keycloak template into a top-level `idp` directory with three implementation tracks: Docker Compose service, realm import JSON, and developer documentation/static verification.

## Official Keycloak Findings

- Keycloak startup import is supported with `start --import-realm` or `start-dev --import-realm`; Keycloak reads regular `.json` files from `data/import`, and the container import path is `/opt/keycloak/data/import`.
- Startup import intentionally skips a realm when that realm already exists, which matches the planned named-volume behavior and requires explicit reset documentation for clean re-imports.
- The current Docker quickstart still uses `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` to create the initial admin account and exposes Keycloak on `127.0.0.1:8080`.
- The current Docker quickstart examples use Keycloak 26.6.x. The local template already pins `quay.io/keycloak/keycloak:26.6.1`, so Phase 3 can preserve that image tag unless implementation discovers a local compatibility issue.
- Keycloak's own getting-started material recommends treating the `master` realm as administrative only; application users and clients should live in a separate realm such as `idambox`.

## Local Template Findings

### Docker Compose

`example-projects/idambox_old/keycloak/docker-compose.yml` already has the correct shape:

- service name: `keycloak`
- image: `quay.io/keycloak/keycloak:26.6.1`
- command list: `start-dev`, `--import-realm`
- port binding: `127.0.0.1:8080:8080`
- admin env vars: `KC_BOOTSTRAP_ADMIN_USERNAME=admin`, `KC_BOOTSTRAP_ADMIN_PASSWORD=admin`
- named volume: `keycloak_data:/opt/keycloak/data`
- import mount: `./keycloak/import:/opt/keycloak/data/import:ro`

Phase 3 should copy this structure to `idp/docker-compose.yml` and preserve the import mount relative to the new `idp` directory.

### Realm JSON

`example-projects/idambox_old/keycloak/keycloak/import/idambox-realm.json` provides a compact import file with:

- realm `idambox`
- email login enabled
- registration and reset password disabled
- one imported local user with `emailVerified: true`, `enabled: true`, no `requiredActions`, and a non-temporary password
- one confidential OIDC client with standard flow enabled, implicit flow disabled, direct access grants disabled, PKCE S256, redirect URI, web origin, and post-logout redirect URI

Phase 3 should adapt the user list to Jane and Bob and adapt the client to `idambox-csrm`.

### Documentation

`example-projects/idambox_old/keycloak/README.md` has useful sections to preserve:

- local-only credentials warning
- quickstart from the Keycloak directory
- admin console URL
- credential table
- realm/client value table
- persisted state vs import JSON behavior
- `docker compose down -v` reset instructions
- note that apps continue to trust Keycloak even if it later brokers to another IdP

Phase 3 should split documentation between root `README.md` quickstart/value summary and detailed `idp/README.md`.

## Implementation Shape

### Files To Create

- `idp/docker-compose.yml`
- `idp/keycloak/import/idambox-realm.json`
- `idp/README.md`
- `scripts/verify-keycloak-idp.mjs`

### Files To Modify

- `README.md`
- `package.json`

### Expected Root Script

Add a static verifier script:

```json
"verify:keycloak-idp": "node scripts/verify-keycloak-idp.mjs"
```

Do not add a root `dev:idp` script unless implementation explicitly chooses to document both root and `idp/` command surfaces. The Phase 3 context says developers should start Keycloak from `idp/`.

## Verification Strategy

Static verification is enough for automated Phase 3 completion because Docker may be unavailable in some execution environments. The verifier should parse and assert:

- `idp/docker-compose.yml` contains `quay.io/keycloak/keycloak:26.6.1`
- Compose command includes `start-dev` and `--import-realm`
- Compose binds `127.0.0.1:8080:8080`
- Compose sets `KC_BOOTSTRAP_ADMIN_USERNAME: admin` and `KC_BOOTSTRAP_ADMIN_PASSWORD: admin`
- Compose mounts `keycloak_data:/opt/keycloak/data`
- Compose mounts `./keycloak/import:/opt/keycloak/data/import:ro`
- `idp/keycloak/import/idambox-realm.json` parses as JSON
- Realm is `idambox`, enabled, email login enabled, duplicate emails disabled
- Users include exactly Jane and Bob Phase 3 sample identities with enabled/email-verified/no required actions/non-temporary password values from CONTEXT.md
- Client `idambox-csrm` is confidential, standard flow enabled, implicit/direct grants disabled, secret `idambox-csrm-local-secret`, redirect URI `http://localhost:3000/api/auth/callback/keycloak`, web origin `http://localhost:3000`, post-logout redirect `http://localhost:3000`, and PKCE S256
- Docs include admin URL, issuer URL, OIDC discovery URL, local-only credential warning, reset instructions, and future broker note for Auth0/Ping/Okta/Entra ID
- `package.json` exposes `verify:keycloak-idp`

Runtime verification should be documented but optional:

```bash
cd idp
docker compose up -d
docker compose logs -f keycloak
docker compose down
docker compose down -v
```

## Validation Architecture

Phase 3 validation should be static-first with an optional Docker runtime check:

- Quick command: `yarn verify:keycloak-idp`
- Full command: `yarn verify:keycloak-idp && yarn verify:schema && yarn verify:csrm-seed && yarn check-types`
- Optional runtime command: `cd idp && docker compose up -d`

The static verifier must fail on malformed realm JSON, missing local credentials warnings, missing reset docs, incorrect OIDC values, or any Keycloak role/group authorization content added for CSRM.

## Risks And Mitigations

- **Risk:** Realm JSON changes do not apply after the first import because the named Docker volume preserves the existing realm.
  **Mitigation:** Document `docker compose down -v` reset clearly in root and `idp` docs.
- **Risk:** Keycloak roles/groups duplicate Strapi authorization.
  **Mitigation:** Verifier can assert the import does not define CSRM realm roles or groups.
- **Risk:** Local-only secrets are mistaken for production guidance.
  **Mitigation:** Root and `idp` docs must warn that committed admin/user/client credentials are local-only.
- **Risk:** Future Phase 6 app cannot use the client.
  **Mitigation:** Use Auth.js-compatible callback and issuer values matching the template: `http://localhost:8080/realms/idambox`, `idambox-csrm`, `idambox-csrm-local-secret`, `http://localhost:3000/api/auth/callback/keycloak`.

## Planning Recommendation

Use one implementation plan with four tasks:

1. Create `idp` Compose and realm import files.
2. Add root and `idp` documentation.
3. Add static verifier and package script.
4. Run static verification and record optional Docker runtime instructions.

Splitting into multiple plans is not necessary; this phase is bounded, has a small file set, and all tasks are sequentially related.

---
phase: 03
status: complete
created: 2026-05-25
---

# Phase 3 Pattern Map

## Existing Analogs

| New file | Closest analog | Pattern to reuse |
|----------|----------------|------------------|
| `idp/docker-compose.yml` | `example-projects/idambox_old/keycloak/docker-compose.yml` | Single `keycloak` service, pinned Keycloak image, `start-dev --import-realm`, loopback port binding, bootstrap admin env vars, named data volume, read-only import mount. |
| `idp/keycloak/import/idambox-realm.json` | `example-projects/idambox_old/keycloak/keycloak/import/idambox-realm.json` | Compact realm import with enabled realm, email login, local users with non-temporary passwords, and one confidential OIDC client. |
| `idp/README.md` | `example-projects/idambox_old/keycloak/README.md` | Quickstart, local-only credential warning, credential table, OIDC values, useful URLs, reset/import behavior, future broker explanation. |
| `scripts/verify-keycloak-idp.mjs` | `scripts/verify-csrm-seed.mjs` | Node.js static verifier using `readFileSync`, local `assert` helpers, JSON parsing, source/doc exact-string assertions, and final success message. |
| `README.md` | existing root README sections | Short project-level quickstart section with concrete commands and canonical local values. |
| `package.json` | existing `verify:schema` / `verify:csrm-seed` scripts | Root verification scripts call Node.js files under `scripts/`. |

## Data Flow

1. Developer enters `idp/` and runs `docker compose up -d`.
2. Compose starts Keycloak with `start-dev --import-realm`.
3. Compose mounts `idp/keycloak/import` to `/opt/keycloak/data/import:ro`.
4. Keycloak imports `idambox-realm.json` only if the `idambox` realm does not already exist in the named `keycloak_data` volume.
5. Future CSRM app uses issuer `http://localhost:8080/realms/idambox`, client ID `idambox-csrm`, and local secret `idambox-csrm-local-secret`.

## Verification Pattern

Use a static verifier that checks source-of-truth values rather than relying on Docker availability. The verifier should parse JSON for realm/client/user assertions and inspect docs/compose/package files for exact strings.

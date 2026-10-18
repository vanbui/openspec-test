---
phase: 03
phase_name: Keycloak Identity Provider Setup
plan: 01
title: Local Keycloak IDP Setup, Realm Import, Documentation, And Verification
status: complete
completed: 2026-05-25
requirements_completed:
  - IDP-01
  - IDP-02
  - IDP-03
  - IDP-04
---

# Plan 03-01 Summary

## Outcome

Phase 3 added a top-level local Keycloak identity provider setup for IdamBox. The setup provides a Docker Compose service, imported `idambox` realm, Jane/Bob local users, a confidential `idambox-csrm` OIDC client, developer documentation, and static verification.

## Task Commits

| Task | Commit | Result |
| --- | --- | --- |
| 1. Compose and realm import | `6bdfb2d` | Added `idp/docker-compose.yml` and `idp/keycloak/import/idambox-realm.json`. |
| 2. Developer documentation | `6d71def` | Added root and `idp/` Keycloak docs. |
| 3. Static verification | `f6f1257` | Added `scripts/verify-keycloak-idp.mjs` and `yarn verify:keycloak-idp`. |
| 4. Verification docs refinement | `23c1ef1` | Added the Keycloak verifier to the root verification command list. |

## Files Created Or Modified

- `idp/docker-compose.yml`
- `idp/keycloak/import/idambox-realm.json`
- `idp/README.md`
- `README.md`
- `scripts/verify-keycloak-idp.mjs`
- `package.json`

## Requirements

- `IDP-01`: complete. Developers can run Keycloak from the top-level `idp/` directory.
- `IDP-02`: complete. Keycloak imports Jane Doe and Bob Doe with local passwords.
- `IDP-03`: complete. Keycloak imports the confidential `idambox-csrm` OIDC client for local CSRM development.
- `IDP-04`: complete. Documentation explains startup, local credentials, OIDC values, reset behavior, and future broker direction.

## Verification

Passed:

```text
yarn verify:keycloak-idp
yarn verify:schema
yarn verify:csrm-seed
yarn check-types
```

The optional Docker runtime check was not run during this execution. Runtime verification is documented in `idp/README.md` and uses `docker compose up -d`, `docker compose logs keycloak`, the OIDC discovery URL, and `docker compose down`.

## Deviations

- No Next.js login wiring was added.
- No Strapi-to-Keycloak provisioning was added.
- No CSRM Keycloak authorization roles or groups were added; Strapi remains the product authorization source through `IdamBoxUser -> Role -> Entitlement -> Application`.

## Next Phase Readiness

Phase 4 can build on the committed Keycloak realm/client values when implementing Strapi-to-Keycloak user provisioning. Production credentials remain out of source control; the committed Phase 3 values are explicitly local-only.

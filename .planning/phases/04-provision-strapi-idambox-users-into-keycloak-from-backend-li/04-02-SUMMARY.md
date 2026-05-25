---
phase: 04
phase_name: Strapi To Keycloak User Provisioning
plan: 02
title: Backend Keycloak Provisioning Integration
status: complete
completed: 2026-05-26
requirements_completed:
  - IDP-05
  - IDP-06
key_files:
  created:
    - apps/backend/src/keycloak/config.ts
    - apps/backend/src/keycloak/admin-client.ts
    - apps/backend/src/keycloak/provision-idambox-user.ts
    - apps/backend/src/keycloak/register-idambox-user-provisioning.ts
  modified:
    - apps/backend/src/index.ts
---

# Plan 04-02 Summary

## Outcome

Implemented backend Keycloak provisioning for custom Strapi `IdamBox User` create and update events. Provisioning is gated by `IDAMBOX_KEYCLOAK_PROVISIONING=true`, uses client-credentials authentication, creates or updates users in the `idambox` realm, and preserves idempotency through `externalSubject` with email fallback.

## Task Commits

| Task                             | Commit    | Result                                                                                                                                                                        |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend provisioning integration | `93f2959` | Added the environment config reader, fetch-based Keycloak Admin API client, IdamBox user provisioning service, document middleware registration, and Strapi bootstrap wiring. |

## Files Created Or Modified

- `apps/backend/src/index.ts`
- `apps/backend/src/keycloak/config.ts`
- `apps/backend/src/keycloak/admin-client.ts`
- `apps/backend/src/keycloak/provision-idambox-user.ts`
- `apps/backend/src/keycloak/register-idambox-user-provisioning.ts`

## Requirements

- `IDP-05`: complete. Strapi registers Document Service middleware for `api::idambox-user.idambox-user` create and update actions and provisions the persisted document into Keycloak.
- `IDP-06`: complete. Keycloak connection values are read from environment configuration and no bootstrap `admin/admin` credential path is used.

## Verification

Passed:

```text
yarn check-types
yarn verify:schema
```

## Deviations

- The existing `IdamBox User.password` schema already had the required private transient password behavior, so no schema or generated type changes were needed.

## Self-Check

PASSED

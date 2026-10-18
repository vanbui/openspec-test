---
phase: 04
status: passed
verified: 2026-05-26
requirements:
  IDP-05: passed
  IDP-06: passed
human_verification: []
---

# Phase 4 Verification

## Automated Checks

| Command                             | Result |
| ----------------------------------- | ------ |
| `yarn verify:keycloak-idp`          | Passed |
| `yarn verify:keycloak-provisioning` | Passed |
| `yarn verify:schema`                | Passed |
| `yarn verify:csrm-seed`             | Passed |
| `yarn check-types`                  | Passed |

## Coverage

- `IDP-05`: verified by the Strapi Document Service middleware in `apps/backend/src/keycloak/register-idambox-user-provisioning.ts`, the provisioning service in `apps/backend/src/keycloak/provision-idambox-user.ts`, and static assertions in `scripts/verify-keycloak-provisioning.mjs`.
- `IDP-06`: verified by the dedicated `idambox-strapi-admin` client in `idp/keycloak/import/idambox-realm.json`, environment-driven backend config in `apps/backend/src/keycloak/config.ts`, and docs asserting local-only credentials plus no `admin/admin` provisioning path.

## Must-Haves

- Provisioning runs on custom `api::idambox-user.idambox-user` create and update events.
- Provisioning is disabled unless `IDAMBOX_KEYCLOAK_PROVISIONING=true`.
- Required Keycloak settings are read from `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, and `KEYCLOAK_ADMIN_CLIENT_SECRET`.
- Keycloak users are found by `externalSubject` first and email second to avoid duplicates.
- New users are created in the `idambox` realm with email/username, profile names, enabled state, and `displayName` attributes from the Strapi user.
- Non-empty Strapi passwords are sent to Keycloak on create or update.
- Passwordless user creation sets `UPDATE_PASSWORD` and does not commit a password credential.
- Successful provisioning stores the Keycloak user ID in `externalSubject` and clears the transient Strapi `password` field.

## Runtime Verification

Optional Docker runtime verification was not run in this execution. The local runtime path is documented:

```powershell
cd idp
docker compose up -d
```

Then run Strapi with:

```powershell
IDAMBOX_KEYCLOAK_PROVISIONING=true
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=idambox
KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret
```

Create or update an `IdamBox User` and inspect the matching Keycloak user in the `idambox` realm. Use `docker compose down -v` from `idp/` when a clean realm import is needed.

## Review

Phase code review passed with no open findings after the review fix recorded in `04-REVIEW.md`.

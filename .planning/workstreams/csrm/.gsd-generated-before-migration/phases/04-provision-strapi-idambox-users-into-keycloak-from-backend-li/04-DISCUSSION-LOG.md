# Phase 4: Strapi To Keycloak User Provisioning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25T20:07:09Z
**Phase:** 04-Strapi To Keycloak User Provisioning
**Areas discussed:** Provisioning Behavior, Account Mapping, Credential Handling, Failure Policy, Environment Configuration, Provisioning Enable Flag, Keycloak Admin Client Seed

---

## Provisioning Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Create and update | Provision on IdamBox user create, and update Keycloak profile/enabled state when the Strapi record changes. | ✓ |
| Create only | Create the Keycloak user once, then leave later Keycloak profile changes alone. | |
| Manual/admin action only | Add backend provisioning code, but do not run it automatically from lifecycle hooks yet. | |

**User's choice:** Create and update.
**Notes:** Provisioning should run from Strapi IdamBox user create/update behavior.

---

## Account Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Email lookup plus `externalSubject` storage | Find/create by unique email, then store Keycloak user ID in `externalSubject` for future updates. | ✓ |
| Email only | Always find Keycloak users by email and do not store the Keycloak subject ID in Strapi. | |
| Keycloak subject only | Require `externalSubject` before updates and fail if it is missing. | |

**User's choice:** Email lookup plus `externalSubject` storage.
**Notes:** Email remains the idempotency lookup path. `externalSubject` stores the Keycloak user ID after successful create or lookup.

---

## Credential Handling

| Option | Description | Selected |
|--------|-------------|----------|
| No password, required action | Create users without committed passwords and set a Keycloak required action such as password setup/reset for non-local provisioning. | |
| Temporary generated password | Create a temporary password and require reset, but do not expose/store it in source control. | |
| Local-only fixed defaults | Use easy fixed passwords only when a local development flag is enabled. | |
| Custom policy | Use `IdamBox User.password` when non-empty, otherwise create without committed password and set required action. Clear the Strapi password after success. | ✓ |

**User's choice:** Custom policy.
**Notes:** On create, if the IdamBox user `password` field is set, use it as the Keycloak password. If it is missing or empty, create the Keycloak user without committed passwords and set a required action such as password setup/reset. On update, only set the Keycloak password when the Strapi password field is non-empty. Always clear the Strapi password field after successful Keycloak create/update.

---

## Failure Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fail the Strapi operation | User create/update should error so Strapi and Keycloak do not silently drift. | ✓ |
| Save Strapi and log error | Keep the Strapi change, log provisioning failure, and retry manually later. | |
| Fail create, allow update | Block new users if Keycloak fails, but allow profile updates to save with a logged provisioning error. | |

**User's choice:** Fail the Strapi operation.
**Notes:** Strapi and Keycloak should not silently diverge.

---

## Environment Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Admin API config only | Require Keycloak base URL, realm, admin client ID, and admin credential values from environment; no production secrets committed. | |
| Use local Phase 3 defaults automatically | Default to `http://localhost:8080`, `idambox`, and `admin/admin` when env vars are absent. | |
| Service account client | Require a dedicated Keycloak admin client ID/secret instead of username/password admin login. | ✓ |
| Custom policy | Environment-driven config plus dedicated admin client ID/secret, not `admin/admin`. | ✓ |

**User's choice:** Admin API config should be environment-driven, but use a dedicated Keycloak admin client ID/secret instead of `admin/admin` username/password.
**Notes:** Required config should include base URL, realm, admin client ID, and admin client secret. Exact variable names may be chosen during planning.

---

## Provisioning Enable Flag

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit flag plus env config | Provisioning runs only when `IDAMBOX_KEYCLOAK_PROVISIONING=true` and required Keycloak env vars are present. | ✓ |
| Env config only | Provisioning runs whenever all required Keycloak env vars are present. | |
| Always attempt | Provisioning runs on every local/dev startup and user save, failing when config is missing. | |

**User's choice:** Explicit flag plus env config.
**Notes:** `IDAMBOX_KEYCLOAK_PROVISIONING=true` is the locked activation flag.

---

## Keycloak Admin Client Seed

| Option | Description | Selected |
|--------|-------------|----------|
| Local fixed values | Client ID `idambox-strapi-admin`, local-only secret `idambox-strapi-admin-local-secret`, documented as development-only. | ✓ |
| Client ID fixed, secret env-only | Realm seed includes the client, but secret is configured outside the committed JSON. | |
| Planner decides | Require a dedicated service-account client, but leave exact local values to implementation. | |
| Exact custom values | User provides exact client ID/secret values. | |

**User's choice:** Local fixed values.
**Notes:** Phase 4 must update `idp/keycloak/import/idambox-realm.json` with a dedicated admin client ID and secret for Strapi to use when invoking the Keycloak API. Strapi-created Keycloak users must be created in the existing `idambox` realm.

---

## the agent's Discretion

- Exact backend module/helper structure for Keycloak client code.
- Exact environment variable names beyond the locked activation flag and dedicated local client values.
- Exact Keycloak required action name after verifying current Keycloak Admin API shape.

## Deferred Ideas

- Next.js OIDC login wiring remains Phase 6.
- CSRM workflow content types remain Phase 5.
- Customer IdP brokering remains future work.
- Keycloak product authorization roles/groups remain out of scope.

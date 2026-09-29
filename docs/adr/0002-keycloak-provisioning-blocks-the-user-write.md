# ADR 0002: Keycloak provisioning is part of the IdamBox User write, and is off by default

- **Status:** Accepted
- **Date:** 2026-09-29
- **Confirms:** Phase 4 decisions D-02, D-03 and D-04 (`.planning/phases/04-provision-strapi-idambox-users-into-keycloak-from-backend-li/04-CONTEXT.md`), and specifies how D-04 is enforced.
- **Code:** `apps/backend/src/keycloak/`

## Context

Keycloak authenticates IdamBox users; Strapi owns the `IdamBox User` record and every authorisation decision. When provisioning is on, Strapi creates or updates the matching Keycloak account on each `IdamBox User` create/update. It then stores the Keycloak user id in `externalSubject` and clears the transient `password` input.

Two questions needed an answer:

1. **Activation.** Local development, CI and the automated tests have no Keycloak. They must boot and pass with no `KEYCLOAK_*` value set.
2. **Outage behaviour.** When Keycloak is down or rejects a request, should the Strapi write fail, or succeed and only log the error?

The first implementation ran the Keycloak call *after* the Strapi write had committed and then threw. The caller saw an error, but the user row was already saved. It had no `externalSubject`, and it kept the bcrypt hash of a password that Keycloak never received. That is the drift D-04 was meant to prevent.

## Decision

**Off by default.** Provisioning runs only when `IDAMBOX_KEYCLOAK_PROVISIONING=true`. Any other value except `false`, empty or unset stops the boot. When it is off, the Strapi `register` phase reads nothing else: no admin client is created, no document middleware is registered and no network call is made. When it is on, every required `KEYCLOAK_*` value is validated in `register`, so incomplete configuration stops Strapi before it serves a request. Errors name the variable and never its value.

**Keycloak blocks the write, atomically.** The provisioning document middleware opens a database transaction around the document service call. The document service joins that transaction instead of opening its own. The Strapi write, the Keycloak create/update and the `externalSubject`/`password: null` write-back therefore commit together. Any Keycloak failure (unreachable, timeout, 401/403, 409 conflict, 4xx/5xx) is logged without secrets and rethrown. The rollback then leaves Strapi exactly as it was, so the caller can retry.

Blocking is chosen over log-only because the failure modes differ in severity:

- **Blocking:** an operator sees the error at save time and retries once Keycloak is back.
- **Log-only:** a user exists in CSRM but cannot sign in, and nothing retries the sync. With log-only, a password change or deactivation that silently fails to reach Keycloak would leave a deactivated user able to authenticate. That is a security failure, not an availability one.

## Consequences

- While Keycloak is unavailable, IdamBox User creates, and updates that change a provisioned attribute (`email`, `username`, `firstName`, `lastName`, `displayName`, `accountStatus`, `password`, `externalSubject`), fail. Updates that touch only other fields, such as role assignments, skip Keycloak once the user is linked. All other content types are unaffected.
- A database transaction stays open during the Keycloak calls. Each call is bounded by `KEYCLOAK_REQUEST_TIMEOUT_MS` (default 5000). On SQLite this holds the write lock for that time, so production should use PostgreSQL or MySQL. User administration is low-volume, so the lock time is acceptable.
- If Keycloak succeeds but the Strapi commit then fails, a Keycloak account exists without a Strapi user. The account grants no CSRM access, because Strapi authorises a caller only through an active IdamBox User record (`apps/backend/src/policies/csrm-authorization.ts`). It is adopted by email on the next attempt, since provisioning is idempotent: it looks up by `externalSubject`, then by email, and a 409 on create falls back to an update.
- The plaintext password exists only in the request and the Keycloak call. The committed row never holds it, not even as a hash.
- Deleting an IdamBox User does not remove or disable the Keycloak account. Deactivate the user (`accountStatus: inactive`, which disables the Keycloak account) before deleting it. Propagating deletes is future work.

## Alternatives considered

- **Log-only, with a later reconciliation job.** Rejected for now for the security reason above. An outbox with retry is the natural next step if Keycloak availability becomes a problem for user administration.
- **Provision before the Strapi write.** Rejected. It runs before Strapi validation, so an invalid write would already have created a Keycloak account with a password.

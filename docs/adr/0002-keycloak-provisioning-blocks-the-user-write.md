# ADR 0002: Keycloak provisioning is part of the IdamBox User write, and is off by default

- **Status:** Accepted
- **Date:** 2026-09-29
- **Amended:** 2026-10-15, under the approved 2026-10-14 [identity model and leaver sync contract](../contract-gaps/iam-identity-model-and-leaver-sync.md), decisions P2-02, P2-18, P2-19 and P2-24.
- **Confirms:** Phase 4 decisions D-02, D-03 and D-04 (`.planning/workstreams/csrm/phases/04-provision-strapi-idambox-users-into-keycloak-from-backend-li/04-CONTEXT.md`), and specifies how D-04 is enforced.
- **Code:** `apps/backend/src/keycloak/`

## Context

Keycloak authenticates IdamBox users; Strapi owns the `IdamBox User` record and every authorisation decision. When provisioning is on, Strapi creates or updates the matching Keycloak account on each `IdamBox User` create/update. It then stores the Keycloak user id in `externalSubject` and clears the transient `password` input.

Two questions needed an answer:

1. **Activation.** Local development, CI and the automated tests have no Keycloak. They must boot and pass with no `KEYCLOAK_*` value set.
2. **Outage behaviour.** When Keycloak is down or rejects a request, should the Strapi write fail, or succeed and only log the error?

The first implementation ran the Keycloak call *after* the Strapi write had committed and then threw. The caller saw an error, but the user row was already saved. It had no `externalSubject`, and it kept the bcrypt hash of a password that Keycloak never received. That is the drift D-04 was meant to prevent.

## Decision

**Remote provisioning is off by default; ownership and enqueue are always on.** Remote provisioning and the outbox worker run only when `IDAMBOX_KEYCLOAK_PROVISIONING=true`. Any other value except `false`, empty or unset stops the boot. When it is off, remote provisioning reads nothing beyond the flag: no admin client, remote provisioning middleware, worker timer or network call is created. The separate identity Document Service middleware still enforces ownership and atomically enqueues existing-user deactivations. Pending work survives for a later enabled boot. When provisioning is on, every required `KEYCLOAK_*` value is validated in `register`, so incomplete configuration stops Strapi before it serves a request. Errors name the variable and never its value. Token verification remains independently off by default under ADR 0004.

**Creates, other mirrored updates and reactivation block, atomically.** The provisioning document middleware opens a database transaction around the Document Service call. The Document Service joins that transaction instead of opening its own. The Strapi write, the Keycloak create/update and the trusted nested Document Service `externalSubject`/`password: null` write-back therefore commit together. Any Keycloak failure (unreachable, timeout, 401/403, 409 conflict, 4xx/5xx) is logged without secrets and rethrown. The rollback then leaves Strapi exactly as it was, so the caller can retry. Linked role-only and other nonmirrored updates retain their skip. Registered Identity Source service users are bearer-only and skip remote provisioning through their verified registration binding, not through `protected=true` alone.

**Approved existing-user deactivation exception.** An update whose effective `accountStatus` is `inactive` commits the user change and durable `disableAndEndSessions` outbox work in one database transaction, with no Keycloak lookup, token request or other network call. This includes inactive replay and a source full PUT with additional HR changes. It excludes every create, including an inactive create. An enqueue failure rolls back the whole write. Inactive replay retains attempts/backoff; a new deactivation rearms the one work row with a new generation. The subject is snapshotted from `externalSubject`; the leaver worker never looks up or adopts by email. Subjectless work completes safely without creating a remote account. Strapi re-reads active status on every authorised request, so an existing signed-in user is refused on the next request even while Keycloak is unavailable. ADR 0004's verified `sub` to `externalSubject` matching is unchanged.

**Serialized, fenced retry.** Worker and user writes share the database per-user serialization boundary. PostgreSQL/MySQL lock the user row before the outbox; SQLite acquires its write transaction before deciding reads. No raw user mutation obtains a lock. A claim is one atomic conditional update of a due pending row or an expired processing lease, with database time, a fresh `leaseOwner` UUID and attempts increment. Row id, generation and owner fence completion, retry, renewal and cancellation. After acquiring the user lock, the worker revalidates current inactivity, subject, generation and lease before sending anything. Blocking reactivation holds the same user lock and cancels old pending generations in its transaction, so stale workers cannot subsequently disable that user. Database support claims require the corresponding executable gate; SQLite evidence does not establish multi-instance safety.

Default polling is 5 seconds, lease 60 seconds, and the entire disable/logout attempt is bounded to 30 seconds, including token refresh/retry, with each call no longer than 5 seconds. Configuration must fit the lease with headroom; invalid configuration fails boot, and renewal is atomic and fenced. The worker sends `PUT /admin/realms/{realm}/users/{externalSubject}` with `enabled=false`, then `POST /admin/realms/{realm}/users/{externalSubject}/logout`. It completes only after both succeed; a Keycloak 404 is safe success. Partial failure or a crash replays the whole idempotent pair. Retry indefinitely with `min(3600, 5 * 2^(attempts-1))` seconds plus bounded jitter of at most 20%. Authentication/configuration failures remain pending with capped retry. Persist only closed error codes; never remote bodies, credentials or tokens. Destroy stops timers and awaits bounded in-flight work. The guarantee is one valid lease/concurrent execution per row/generation and at-least-once remote delivery, not exactly-once requests.

Blocking is chosen over log-only because the failure modes differ in severity:

- **Blocking:** an operator sees the error at save time and retries once Keycloak is back.
- **Log-only:** a user exists in CSRM but cannot sign in, and nothing retries the sync. A password change or deactivation that silently fails to reach Keycloak would leave drift without durable recovery. The approved deactivation exception uses atomic durable work and immediate local refusal, rather than log-only success.

## Consequences

- While Keycloak is unavailable, provisioned IdamBox User creates and other mirrored updates (`email`, `username`, `firstName`, `lastName`, `displayName`, `accountStatus`, `password`, `externalSubject`), including reactivation, fail. Existing-user effective-inactive updates commit with durable outbox work. Updates that touch only other fields, such as role assignments, skip Keycloak once the user is linked. All other content types are unaffected.
- A database transaction stays open during the Keycloak calls. Each call is bounded by `KEYCLOAK_REQUEST_TIMEOUT_MS` (default 5000). On SQLite this holds the write lock for that time, so production should use PostgreSQL or MySQL. User administration is low-volume, so the lock time is acceptable.
- If Keycloak succeeds but the Strapi commit then fails, a Keycloak account exists without a Strapi user. The account grants no CSRM access, because Strapi authorises a caller only through an active IdamBox User record (`apps/backend/src/policies/csrm-authorization.ts`). It is adopted by email on the next attempt, since provisioning is idempotent: it looks up by `externalSubject`, then by email, and a 409 on create falls back to an update.
- With remote provisioning enabled, the plaintext password exists only in the request and the Keycloak call. The committed row never holds it, not even as a hash; legacy off-mode password behavior is preserved.
- Hard deletion does not remove the Keycloak account. Source deletion is an inactive tombstone that retains ownership and queues disable/logout. Deactivate and wait for completed remote work before considering hard deletion; remote account deletion is future work.

## Alternatives considered

- **Log-only, with a later reconciliation job.** Rejected. The approved narrow deactivation exception uses an atomic outbox with bounded attempts and indefinite retry; creates, other mirrored updates and reactivation retain blocking behavior.
- **Provision before the Strapi write.** Rejected. It runs before Strapi validation, so an invalid write would already have created a Keycloak account with a password.

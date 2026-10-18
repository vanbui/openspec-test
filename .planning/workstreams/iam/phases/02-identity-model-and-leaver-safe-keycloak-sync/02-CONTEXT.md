# Phase 2: Identity model and leaver-safe Keycloak sync - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning; content-type approval pending
**Workstream:** iam
**Mode:** Non-interactive; all gray areas selected and resolved from locked references.

<domain>
## Phase Boundary

Deliver MODEL-01, MODEL-03, PROV-05, PROV-07 and LIFE-02. Establish Identity Source ownership, protected users, an internal identity upsert service, HR-field enforcement, source service grants and an outage-safe Keycloak deactivation outbox. No UI and no public provisioning endpoint in Phase 2.

D1-D26 and the ROADMAP.md reconciliation are locked. Phase 3 owns SCIM routes, bearer-token tooling and wire error serialization. Phase 4 owns operator-confirmed midPoint correlation, pending-operation refresh and the two-system audit proof. Phase 5 owns password email and sign-in. Phase 1's connector GO is a prerequisite and proves discovery only.

Carry forward Phase 1's discussion-only handoff: this run captures decisions; subsequent planning and execution are separate. No automatic schema approval or execution.
</domain>

<decisions>
## Implementation Decisions

### Approval and naming

- **P2-01:** The first execution plan must first create or reconcile docs/contract-gaps/iam-identity-model-and-leaver-sync.md, then stop at an operator approval checkpoint before any content-type, generated content-type declaration, schema-sync boot or data migration. Approval is pending, cannot be auto-selected, and must identify the exact reviewed record revision. A later schema change to the proposal needs renewed approval. Name iam and csrm as affected workstreams; csrm reads IdamBoxUser throughout requests, questionnaires, assessments, risks and people selectors. Do not silently mark approval as received.
- **P2-02:** JDL defines IdamBoxUser, Role, Function, FunctionApi, username, firstName, lastName, displayName, accountStatus and externalSubject. It contains neither IdentitySource nor KeycloakSyncOutbox nor the new source fields. Record these as additive contract gaps, not as existing JDL entities. Use FunctionApi in schema/entity terminology and Role → Function → FunctionAPI in capability prose. Do not rewrite the frozen JDL as a side effect. Amend ADR 0002 only during approved implementation; preserve its off-by-default and blocking-create/update decisions.

### Exact schema proposal

- **P2-03:** IdentitySource: UID api::identity-source.identity-source, collection identity_sources, singular identity-source, plural identity-sources, display name Identity Source. draftAndPublish false, no localization. Built-in id, documentId, createdAt and updatedAt remain Strapi-owned.

| Field | Strapi type | Constraints and meaning |
| --- | --- | --- |
| name | string | Required, unique, maxLength 255; trimmed nonblank source label. |
| sourceStatus | enumeration | Required, active or inactive, default active; inactive refuses provisioning. |
| serviceUser | relation oneToOne to api::idambox-user.idambox-user | Required, one-way; database uniqueness of target relation must be verified. |
| tokenHash | string | Optional, private, maxLength 255; null means no token/revoked; never plaintext. |
| tokenRotatedAt | datetime | Optional, private, UTC; latest issuance, rotation or revocation time. |
| lastActivityAt | datetime | Optional, UTC; latest authenticated source request. |

- **P2-04:** Add these attributes to the existing api::idambox-user.idambox-user / idambox_users, preserving all existing field types, requiredness, global email/username/externalSubject uniqueness and roles relations.

| Field | Strapi type | Constraints and meaning |
| --- | --- | --- |
| identitySource | relation manyToOne to api::identity-source.identity-source | Optional, one-way; null means manual. No inverse field. |
| sourceExternalId | string | Optional, maxLength 255; opaque, case-sensitive, nonblank when sourced; NOT globally unique. |
| sourceIdentityKey | string | Optional, private, unique, minLength/maxLength 64; server-derived SHA-256 hex of UTF-8 JSON.stringify([identitySource.documentId, sourceExternalId]). Null for manual users. |
| employeeNumber | string | Optional, maxLength 255; matching information, not unique and not an ownership key. |
| department | string | Optional, maxLength 255. |
| jobTitle | string | Optional, maxLength 255; SCIM title maps here. |
| sourceDeletedAt | datetime | Optional, UTC tombstone; does not erase ownership. |
| lastSyncedAt | datetime | Optional, UTC; latest accepted source mutation, including idempotent replay. |
| protected | boolean | Required, default false; existing rows read false. Blocks every source read, claim and mutation. |

- **P2-05:** A user is either manual (identitySource, sourceExternalId and sourceIdentityKey all null) or sourced (all present). Reject partial tuples. Preserve sourceExternalId verbatim: no trimming, case folding or numeric coercion; reject empty/whitespace-only or overlong values. A source and its key are immutable after claim. Deleted/inactive users retain the tuple and its uniqueness reservation. Another source may use the same external id but global email and username uniqueness still applies. Preflight is only a friendly error; the database unique index on sourceIdentityKey arbitrates races. Compute the key in middleware from the persisted source documentId and validated external key, never caller input. On constraint conflict compare the actual tuple and refuse; never adopt a different tuple because of a hash match. Verify the actual index after fresh and reused schema sync. This private technical field is part of the approval proposal, not a new domain entity. Case-sensitive hash input avoids database text-collation differences.
- **P2-06:** KeycloakSyncOutbox: UID api::keycloak-sync-outbox.keycloak-sync-outbox, collection keycloak_sync_outboxes, singular keycloak-sync-outbox, plural keycloak-sync-outboxes, display name Keycloak Sync Outbox. draftAndPublish false, no localization; internal-only, no core content API routes or public permissions.

| Field | Strapi type | Constraints and meaning |
| --- | --- | --- |
| userDocumentId | string | Required, unique, maxLength 24; stable IdamBoxUser documentId, one durable work row per user. |
| idamboxUser | relation oneToOne to api::idambox-user.idambox-user | Required, one-way; must match userDocumentId. |
| externalSubject | string | Optional, maxLength 255; snapshot of the Keycloak id for this deactivation, never email lookup. |
| operation | enumeration | Required, disableAndEndSessions only. |
| syncStatus | enumeration | Required, pending, processing, completed or cancelled; default pending. |
| generation | integer | Required, default 1, min 1; increments on each new deactivation; no wraparound. |
| attempts | integer | Required, default 0, min 0; increments on a successful claim. |
| lastErrorCode | string | Optional, maxLength 120; closed safe code, never remote body, credentials or personal data. |
| nextAttemptAt | datetime | Required, UTC; due time, initially transaction time. |
| leaseOwner | string | Optional, private, maxLength 36; random UUID for each claim, not an instance name. |
| leaseExpiresAt | datetime | Optional, private, UTC; expiry of the active claim. |
| completedAt | datetime | Optional, UTC; both disable and session termination succeeded, or subject absent. |

The outbox is a durable current-work record, not a lifecycle audit store. Rearm its row under the user lock for a new active-to-inactive transition, increment generation and reset lease/attempt/error/completion fields. Repeated deactivation of the same inactive state neither creates another row nor resets backoff; ensure missing work is enqueued for a linked inactive user. Bounds overflow fails safely and never wraps. Required fields belong only to newly introduced collections; legacy users gain nullable fields and protected=false. No blanket changes to existing status, roles, subjects or references.

### Source service identity and catalogue

- **P2-07:** Each source acts as an ordinary IdamBoxUser: protected=true, identitySource/sourceExternalId/sourceIdentityKey null, accountStatus=active, no password or externalSubject, one explicit Identity Provisioning Role. Derive non-human status from being registered as IdentitySource.serviceUser; do not invent a principal content type, a human boolean or a new use for protected. Protected break-glass people remain people. Only trusted registration/seed code may attach the provisioning Role, and only to a registered protected source service identity. Refuse unprotection or unrelated role grants while registered. Source authentication must re-read active source, active service user, protection, binding and exact grant each request.
- **P2-08:** Both catalogue copies add role.identity_provisioning named Identity Provisioning with exactly function.identity_provisioning.api named Identity Provisioning. The Function belongs to a new seeded Application row, IdamBox IAM (slug idambox-iam, active; only idambox-csrm exists today, and an Application row is seed data, not a content-type change). The Function has no menuPath and no grants to existing roles. Source identities receive no explicit or implicit Requestor/analyst grants. Exclude registered source service identities from the existing unconditional Requestor birthright calculation and person selectors; do not exclude all protected users. Source bearer authentication populates only its provisioning identity context and never the CSRM identity-header context.
- **P2-09:** Reserve FunctionApi entries for GET /scim/v2/Users, POST /scim/v2/Users, GET /scim/v2/Users/{id}, PUT /scim/v2/Users/{id}, PATCH /scim/v2/Users/{id}, DELETE /scim/v2/Users/{id}, GET /scim/v2/ServiceProviderConfig, GET /scim/v2/Schemas, GET /scim/v2/Schemas/{id}, GET /scim/v2/ResourceTypes, GET /scim/v2/ResourceTypes/{id}, GET /scim/v2/Groups and POST/PUT/PATCH/DELETE Group collection/resource operations needed for explicit 501 responses. URLs use the existing METHOD:/path catalogue convention. Phase 2 reserves them as intentionally unserved; Phase 3 catalogs every actually mounted operation and adds traceability for 501 Group responses. Do not mount a FunctionApi just to satisfy a reservation. Existing CSRM grants and endpoints remain backward compatible.
- **P2-10:** Add an idempotent opt-in development source seed under the existing development seed discipline: name midPoint (dev), active, dedicated protected service user username midpoint-dev-provisioning, email midpoint-dev-provisioning@idambox.test, displayName midPoint (dev) provisioning. Refuse collisions with an unrelated user instead of converting them. Persist source and service-user binding atomically; do not reset tokens or overwrite sourced fixture users on restart. Seed no bearer token in Phase 2; tokenHash remains null until Phase 3 tooling. Seed IAM Functions against the IAM Application instead of sending them through the CSRM seed's hard-coded Application assignment.

### Internal service, ownership and claims

- **P2-11:** Add a feature module under apps/backend/src/iam/identity/ with typed internal methods createFromSource, replaceFromSource, patchFromSource, deactivateFromSource, readForSource and listForSource. There is no generic save, raw-database writer, HTTP facade or midPoint-specific API. Inputs use an authenticated SourcePrincipal constructed internally from source/service identity/grants, plus a normalized shared-schema identity DTO. Service methods validate the principal and use Document Service transactions. Read/list project allowlisted fields, never raw populated records or private attributes.
- **P2-12:** The source DTO permits username, email, firstName, lastName, displayName, accountStatus, sourceExternalId, employeeNumber, department and jobTitle. D19 mapping is fixed. It cannot set roles, password, protected, externalSubject, identitySource, sourceIdentityKey, sourceDeletedAt or lastSyncedAt. The latter ownership/timestamp fields are derived by the service. New sourced people have roles=[] and receive Requestor implicitly. Movers/claims preserve explicit IdamBox Roles. Phase 3 translates full PUT replacement of optional source-owned fields and PATCH deltas; neither may erase IdamBox-owned fields. Internal closed outcomes include forbidden, notFound, uniqueness, immutableSourceKey, invalidInput and keycloakUnavailable, with safe details and retryAfterSeconds=30 for transient Keycloak failure. Phase 3 maps them to SCIM/HTTP including 503 and Retry-After: 30; duplicate uniqueness remains 409 and validation 4xx.
- **P2-13:** A source sees its own nonprotected, nontombstoned users plus unowned, unprotected manual users for read-only correlation. Direct foreign/protected/tombstoned reads and mutations answer indistinguishable notFound; filters/counts/pagination must not reveal them. Manual reads omit the nonexistent source externalId. Writes resolve only explicit documentId or an owned source tuple, never silently email/employeeNumber.
- **P2-14:** Only replaceFromSource can claim: an explicit manual target documentId, a nonblank externalId mapped to sourceExternalId, and an authenticated source. The first PUT to that unowned, unprotected user is the confirmed-claim signal under D13. Strapi cannot independently prove a midPoint operator clicked confirmation; that trust boundary is explicit. Do not add a nonstandard claim token/header or a backend confirmation screen. Phase 4 proves the operator-confirmed correlation case. POST conflicts instead of claiming; PATCH and DELETE cannot claim. Under a database user lock, re-read source/protection/tuple, reserve the unique tuple, apply identity changes and timestamp in one transaction. Same-source/key replay becomes an update; another source or another key is refused. Keycloak blocking failure rolls the claim back. Log source, service identity, target and outcome, never credentials.
- **P2-15:** deactivateFromSource accepts only an owned target and a server-selected source-deletion flag. Set inactive; on deletion set sourceDeletedAt once. Tombstoned repeats are idempotent for the owning source, while reads stay hidden. No hard delete. No unclaim/reassignment operation. Restoring a source-deleted user is deferred; do not silently resurrect a tombstone with create or replace.

### Refusal of HR-owned edits

- **P2-16:** Register ownership/field middleware unconditionally in Strapi register, independently of Keycloak flags. Controllers may translate errors, but controller-only enforcement is rejected: the IdamBoxUser core router has only:[], while content-manager and internal Document Service callers bypass that controller. Read the persisted user inside the write transaction, then refuse attempts by ordinary administration to change username, email, firstName, lastName, displayName, accountStatus, employeeNumber, department or jobTitle on a sourced user. Equal-value submissions are allowed as no-ops; any different owned field rejects the whole write before next(). Roles-only edits still succeed. Ownership fields, source timestamps and protection changes require narrowly trusted server operations. For sourced users password and externalSubject are never generic administrative inputs; credentials remain Keycloak-owned.
- **P2-17:** Use a private request-scoped/in-process write context for source operations, source registration and Keycloak linkage write-back. It must be impossible to assert through HTTP data, headers or arbitrary context.params properties. No global boolean, leaked privilege across concurrent promises or public skip-provisioning option. Middleware validates the operation's exact field allowlist and source ownership even with trusted context. Development reseeding skips HR edits of already sourced people rather than impersonating their source. Direct internal Document Service calls without source context cannot edit HR fields.

### Leaver transaction and blocking updates

- **P2-18:** Route all IdamBoxUser creates/updates through a transaction-aware middleware path. On an existing user's update with effective accountStatus=inactive, commit the Document Service change and enqueue/rearm its outbox atomically without a Keycloak lookup, token call or other network I/O. This covers an active-to-inactive transition, inactive replay and a source full PUT containing additional HR changes. It does not create an inactive user asynchronously: all creates still use the blocking path. Outbox failure rolls the whole transaction back; never commit a deactivation with silently lost work. No general catch-and-continue around the blocking provisioner.
- **P2-19:** All creates and non-deactivation updates that require Keycloak retain blocking transaction behavior and rollback on failure. Preserve ADR 0002's linked roles-only/nonmirrored-field skip. An inactive-to-active update is a blocking reactivation. Before enabling, serialize against outbox work and cancel pending old generations in the same transaction; stale workers must not subsequently disable the reactivated user. No Keycloak call for a registered source service identity, which is bearer-only; this exception is derived from the verified registration binding, not protected=true alone.
- **P2-20:** Identity ownership/outbox enqueue remain active when provisioning is off. The worker is inert and creates no client or network call while IDAMBOX_KEYCLOAK_PROVISIONING is false/unset. Pending work stays pending for a later enabled boot. Linked users enqueue a snapshot externalSubject; absence of externalSubject completes as a safe no-op when the worker runs, without creating/adopting a Keycloak user. No email lookup in the leaver worker. Authorization continues to re-read active status per request as ADR 0004 requires; queue availability never controls API refusal.

### Outbox concurrency and retry

- **P2-21:** All instances may poll, but ownership is database-atomic. Select a candidate as a hint, then issue one conditional UPDATE for its id and generation: either pending with nextAttemptAt <= database UTC now, or processing with leaseExpiresAt <= now. Set processing, fresh leaseOwner UUID, leaseExpiresAt, and attempts+1. Proceed only when exactly one row was affected; PostgreSQL may use RETURNING. Never read then perform an unconditional update, never rely on a timer flag or process-local mutex. Use transaction-bound Knex for outbox-only atomic coordination, which is explicitly allowed; it must not become a user-data mutation path.
- **P2-22:** Completion, retry, renewal and cancellation are fenced by row id, generation and leaseOwner. Use database time for eligibility/expiry. Default poll 5 seconds, lease 60 seconds; bound the entire disable/logout attempt to 30 seconds with existing per-call timeouts no greater than 5 seconds, including token refresh/retry. If configuration cannot fit the lease, fail boot or renew atomically before exceeding it. A lost fence cannot acknowledge or reschedule work. Expired leases are recoverable after restart.
- **P2-23:** Claims alone do not prevent a stale disable racing reactivation. Worker and all user writes share a database per-user serialization boundary. PostgreSQL/MySQL use the existing user row lock; the worker revalidates current inactive state, externalSubject, generation and lease after locking, and fences the outbox in that transaction before network calls. Reactivation acquires the same lock before provisioning and cancelling old work. Lock user before outbox for row-lock databases; on SQLite acquire its write transaction lock through conditional outbox coordination before deciding reads, with bounded busy retry. No raw IdamBoxUser mutation to obtain a lock. Research must prove the pinned Strapi transaction binding and dialect behavior; a one-process promise tail or SQLite single-connection test is insufficient evidence of multi-instance safety.
- **P2-24:** Worker sends PUT /admin/realms/{realm}/users/{externalSubject} with enabled=false, then POST /admin/realms/{realm}/users/{externalSubject}/logout. Mark completed only after both succeed; Keycloak 404 is success because there is no user/session to revoke. Retry the whole idempotent pair after partial failure or crash. Backoff = min(3600, 5 * 2^(attempts-1)) seconds with bounded jitter of at most 20%; do not stop permanently after N attempts. Authentication/configuration failures stay pending with capped retry and a safe error log. Store only closed error codes, not remote messages/bodies. Stop timers and await bounded in-flight work in destroy().
- **P2-25:** Promise at-most-one valid lease and concurrent execution per row/generation, not exactly-once remote delivery: a crash after Keycloak success before acknowledgement necessarily causes replay. Keep an executable shared-PostgreSQL two-instance gate with independent Strapi processes/connections, simultaneous claims, forced lease expiry, worker death, stale-owner acknowledgement, partial disable/logout failure, reactivation interleaving and a second leaver generation. Both instances must point to the same backend database; midPoint's repository is unrelated. SQLite tests verify local semantics but cannot substitute for this production gate. Do not claim support for an untested database dialect.

### Document-Service-only rule and verification

- **P2-26:** No application IdamBoxUser write through strapi.db.query, entityService, query builder, raw Knex/SQL, bulk mutation or relation mutation outside Document Service. Reads and SELECT locks are allowed; atomic outbox coordination is allowed. Framework-internal database writes made by Document Service are not violations. Existing query-layer externalSubject/password write-back in register-idambox-user-provisioning.ts must be removed, not broadly allowlisted.
- **P2-27:** Capture and validate a transient manual password before next(), keep it out of persisted input when provisioning is enabled, pass it only to the Keycloak client, and use a nested trusted Document Service update for externalSubject/write-back inside the original transaction. Trusted linkage context may write only externalSubject and password cleanup and skip only recursive external provisioning, never the ownership guard. No plaintext or bcrypt hash persists after a provisioned write. Research must prove password omission/null cleanup under pinned Strapi 5.51 validation; do not assume the current comment that null fails is correct or use query-layer cleanup to avoid investigating it. Retain legacy off-mode behavior and password input validation.
- **P2-28:** Add a TypeScript-AST-based source guard that resolves literal UID/constants and local service aliases, detects database/entityService/raw user writes and rejects unresolved generic mutation helpers on the user path. Add fixture violations for direct query, aliased query, bulk and raw writes so the guard itself is proven. Runtime integration instruments Document Service context and query mutations: low-level user writes are permitted only during validated Document Service persistence, not merely while some user transaction exists. Exercise upsert methods, generic administration/content manager, source registration/seed, blocking linkage and deactivation. A middleware hook counter alone cannot prove no bypass. Negative tests intentionally bypass Document Service and must fail the discipline guard.
- **P2-29:** Use real Strapi transaction tests with the existing fake Keycloak server for rollback, inactive commit with no network calls, durable enqueue, failure between user write/enqueue, retry/logout, source ownership, protected users, duplicate source tuples, concurrent claims, unchanged roles, HR-edit refusal with provisioning off and on, private-field projection, service grants and repeat seeding. Retain Keycloak create/update rollback and password cleanup tests. Prove next-request refusal for an existing signed-in identity after Phase 2 internal deactivation; the SCIM/UI-specific refusal gate remains Phase 3.
- **P2-30:** Run pnpm --dir apps/backend test after approved implementation; record the known pre-existing order-dependent ECONNRESET baseline separately and do not relabel it as a pass. Retain contract/catalogue/served-operation compatibility checks. Confirm schema diff matches the approved gap record and no existing CSRM grants changed. Before execution, merge any backend changes from the default branch that this branch lacks (merge, never rebase) and re-run the plan check; never alter nested history.

### Implementation discretion

Exact module filenames, validation helper reuse, middleware registration arrangement and dialect adapter details may be chosen during research. Locked field names/types, ownership and claim rules, database uniqueness, atomic leases, blocking semantics, Document Service discipline and the approval gate cannot be relaxed. No new dependency without a concrete reason. Write no attribution or generation notices in deliverables.
</decisions>

<canonical_refs>
## Canonical References

Read before planning or implementing:

- .planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md — D1-D26 and model gaps.
- .planning/workstreams/iam/ROADMAP.md — Phase 2 success criteria and locked reconciliation.
- .planning/workstreams/iam/REQUIREMENTS.md — exact phase requirement allocation.
- .planning/workstreams/iam/PROJECT.md — platform scope and constraints.
- .planning/PROJECT.md — shared-backend approval and portable-document rules.
- .planning/workstreams/iam/STATE.md — Phase 1 GO and approval blocker.
- .planning/workstreams/iam/phases/01-midpoint-platform-and-connector-spike/01-CONTEXT.md — prior handoffs and discussion-only mode.
- .planning/workstreams/iam/phases/01-midpoint-platform-and-connector-spike/01-VERIFICATION.md — discovery evidence.
- CONTEXT.md — Identity Source, Identity engine, Identity, IdamBox User, Sourced user and Manual user.
- docs/agents/domain.md — glossary/ADR conventions.
- docs/references/idambox-datamodel.jdl — existing entity/field naming, frozen baseline.
- docs/references/specification.json — backward-compatible API baseline.
- docs/references/idambox-csrm-role-function-api-catalogue.json — reference catalogue.
- apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json — executable catalogue copy.
- docs/references/served-operations.json — served/unserved traceability.
- docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md — blocking semantics to amend.
- docs/adr/0004-strapi-verifies-keycloak-access-tokens.md — active-subject authorization.
- docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md — ownership and inbound contract.
- docs/adr/0006-midpoint-lts-and-community-scim2-connector.md — connector GO and limits.
- docs/contract-gaps/iam-identity-model-and-leaver-sync.md — proposed exact extension; approval pending.
- .planning/WINDOWS.md — existing backend gate baseline.

Primary technical references checked during discussion:

- https://docs.strapi.io/cms/api/document-service/middlewares — Document Service context and interception.
- https://docs-v5.strapi.io/cms/database-transactions — implicit Document Service transaction participation; verify against installed 5.51 implementation.
- https://www.postgresql.org/docs/17/sql-update.html — conditional UPDATE and RETURNING.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- apps/backend/src/keycloak/register-idambox-user-provisioning.ts — current blocking transaction/mirrored-field skip and query-layer write-back that must change.
- apps/backend/src/keycloak/provision-idambox-user.ts — idempotent create/update; never use email adoption in the leaver worker.
- apps/backend/src/keycloak/admin-client.ts — bounded Admin API calls, token sharing and refresh; add disable/logout operations.
- apps/backend/tests/keycloak-provisioning.integration.test.ts and apps/backend/tests/helpers/fake-keycloak-server.ts — real transaction and external failure tests.
- apps/backend/src/policies/csrm-authorization.ts — current unconditional active-user birthright; exempt registered source identities.
- apps/backend/src/csrm/people/eligible-person.ts — person eligibility extension point, without treating protected people as services.
- apps/backend/src/api/csrm-assessment-request/services/request-lock.ts — inspect existing transaction/row-lock pattern; process-local serialization is insufficient for workers.

### Established Patterns

- apps/backend/src/api/idambox-user/routes/idambox-user.ts has only:[]; Phase 2 must not reopen generic content APIs.
- apps/backend/src/bootstrap/seed-csrm-data.ts uses Document Service but assigns Functions to CSRM; partition additive IAM catalogue entries by Application and preserve existing seeding.
- apps/backend/config/database.ts supports SQLite, PostgreSQL and MySQL. Verify concurrency on shared PostgreSQL; do not infer it from SQLite.
- Strapi 5.51 is pinned. No maps, pending matching todos, Phase 2 SPEC, prior Phase 2 context or blocking continue-here record were found.

### Integration Points

- apps/backend/src/index.ts register/bootstrap/destroy — always-on identity guards, opt-in source seed and bounded worker lifecycle.
- Existing user, role, function and application Document Services — no separate identity facade.
- Existing token verification middleware — immediate inactive-user refusal; no changes to token-subject matching.
</code_context>

<specifics>
## Specific Ideas

A Keycloak outage must never roll back an authorized leaver because of remote provisioning. Atomic enqueue may still fail if the database itself fails. Two instance claims require a shared database and idempotent remote replay; they do not create exactly-once Keycloak delivery. A source's first explicit PUT claim trusts its correlation confirmation upstream and never uses email as a silent link.
</specifics>

<deferred>
## Deferred Ideas

- SCIM routes, token hashing/issuance/rotation/revocation and wire error mapping — Phase 3.
- Captured connector request replay and local midPoint evidence — Phase 3 onward.
- Operator-confirmed correlation and pending-operation refresh — Phase 4.
- Set-password email, Mailpit journey and responsive sign-in proof — Phase 5.
- CSRM source badge/read-only screens — csrm handoff.
- Source tombstone restoration, source reassignment, extra HR fields and centralized change log — future work.
</deferred>

*Phase: 02-identity-model-and-leaver-safe-keycloak-sync*
*Context gathered: 2026-10-14*

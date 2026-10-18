# IAM: Identity model and leaver-safe Keycloak sync

**Status:** Approved by the operator on 2026-10-14 (see "Approval")
**Date:** 2026-10-14
**Workstream:** iam, Phase 2
**Decision record:** .planning/workstreams/iam/phases/02-identity-model-and-leaver-safe-keycloak-sync/02-CONTEXT.md

## Gap and domain check

The frozen docs/references/idambox-datamodel.jdl defines IdamBoxUser and its roles, accountStatus and externalSubject. It defines neither IdentitySource nor KeycloakSyncOutbox, nor source ownership, protection, HR attributes or durable Keycloak revocation work. CONTEXT.md defines Identity Source as the customer's authoritative workforce source; midPoint is the Identity engine. These collections implement the locked brief D6/D13-D16 without inventing an alternative Identity or principal entity. externalSubject remains the Keycloak id; sourceExternalId is the source correlation key.

## Affected workstreams

- iam owns the source model, source service identity, internal upsert service, field guards and outbox.
- csrm reads IdamBoxUser through requests, questionnaires, assessments, risks, access and people selectors. Existing people keep their identity, subjects, roles and references. Registered source service identities must be excluded from Requestor birthright and human selectors; protected human users retain their existing grants.
- No other reading application workstream is registered in .planning/PROJECT.md. Recheck readers before approval and implementation; add any newly registered reader to this record and checkpoint.

## Proposed exact compatibility extension

All new collections disable Draft & Publish and localization. Built-in ids/documentIds/timestamps remain Strapi-owned. Relations are one-way, with no inverse attributes added to IdamBoxUser or other content types.

### IdentitySource

UID api::identity-source.identity-source; collection identity_sources; singular identity-source; plural identity-sources; display name Identity Source.

| Field | Strapi type | Constraints and meaning |
| --- | --- | --- |
| name | string | Required, unique, maxLength 255; trimmed nonblank source label. |
| sourceStatus | enumeration | Required, active or inactive, default active; inactive refuses provisioning. |
| serviceUser | relation oneToOne to api::idambox-user.idambox-user | Required, one-way; database uniqueness of target relation must be verified. |
| tokenHash | string | Optional, private, maxLength 255; null means no token/revoked; never plaintext. |
| tokenRotatedAt | datetime | Optional, private, UTC; latest issuance, rotation or revocation time. |
| lastActivityAt | datetime | Optional, UTC; latest authenticated source request. |

A source's serviceUser is an existing IdamBoxUser with protected=true, active status, no source tuple, no password or Keycloak subject, and exactly the Identity Provisioning Role. Registration is transactionally validated and the target cannot belong to two sources. Verify actual relation uniqueness in the database. Source token tooling is Phase 3; null tokenHash authorizes no request.

### IdamBoxUser

Keep UID api::idambox-user.idambox-user and collection idambox_users. Preserve every existing attribute, requiredness, relation and uniqueness rule.

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

A source tuple is all-null (manual) or all-present (sourced). Its source/key are immutable. sourceExternalId is nonblank opaque text, 1–255 characters, preserved exactly and case-sensitive; employeeNumber is matching data, never a unique key. The private technical sourceIdentityKey is SHA-256 lowercase hex of UTF-8 JSON.stringify([source.documentId, sourceExternalId]), recomputed by the server. A real database unique index arbitrates concurrent creates/claims; preflight checks alone are insufficient. Hash conflicts must compare the tuple and fail safely, never link another tuple. Different sources can reuse external ids; existing global email and username constraints still apply. Deactivation and source deletion retain the tuple and its reservation.

### KeycloakSyncOutbox

UID api::keycloak-sync-outbox.keycloak-sync-outbox; collection keycloak_sync_outboxes; singular keycloak-sync-outbox; plural keycloak-sync-outboxes; display name Keycloak Sync Outbox.

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

One durable work row per user is rearmed for each new deactivation generation. Replays of the same inactive state do not reset attempts/backoff. There are no content API routers or public read/write grants for either new collection. Outbox and token-bearing source data are internal projections only, never generic populated responses.

## Enforcement and API impact

Phase 2 introduces only an internal typed source service, no inbound API. Phase 3 serves standards-based /scim/v2 operations through source-specific bearer authentication. First explicit source PUT with externalId can claim an unowned/unprotected manual target; POST, PATCH and DELETE cannot claim. Upstream confirmation is trusted and proven with midPoint in Phase 4; there is no silent email linking or nonstandard confirmation endpoint. Source/protected/foreign/tombstoned reads are scoped without disclosure.

Always-on Document Service middleware refuses changed HR-owned values on sourced users: username, email, firstName, lastName, displayName, accountStatus, employeeNumber, department and jobTitle. A role-only administrative change remains allowed. Ownership/timestamp/protection/subject fields are server-owned. Existing core IdamBoxUser routes stay unmounted. A controller-only guard is insufficient for content-manager and internal calls.

Both catalogue copies gain role.identity_provisioning and function.identity_provisioning.api, both named Identity Provisioning, attached to a new seeded Application row, IdamBox IAM (slug `idambox-iam`; only `idambox-csrm` exists today, and an Application row is seed data, not a content-type change), with no menuPath or grants to existing roles. The registered source service identity has only this explicit Role and is excluded from implicit Requestor grants. Phase 2 reserves SCIM operation grants as unserved; Phase 3 mounts/catalogues the actual routes. Existing CSRM grants remain unchanged.

## Transaction and delivery contract

Deactivating an existing user writes inactive status and pending outbox work in one transaction, with zero Keycloak network calls. Remote failure cannot roll it back; a database enqueue failure rolls the whole transaction back. Creates and other provisioned-field updates still block; linked role-only updates keep the existing skip. Reactivation is blocking and serialized against old outbox work. Provisioning-off boots retain the guards and queue while the worker performs no network call.

Claim work with an atomic conditional UPDATE of a due pending row or an expired processing lease, fencing by row id, generation and a fresh leaseOwner UUID. One affected row wins. Completion/retry/renewal use the same fence. Default polling 5 seconds, lease 60 seconds, attempt budget 30 seconds, per-call bound at most 5 seconds. PostgreSQL/MySQL worker and user writes share a per-user row lock; SQLite acquires its write transaction before deciding reads. Recheck inactive status/subject/generation/fence before sending disable then logout. A stale worker cannot disable a reactivated user after the shared serialization boundary.

Keycloak disable and session termination are idempotent; missing subjects/users are safe completion without email adoption. Retry after partial failure/crash with capped exponential backoff. Remote delivery is at least once; the database ensures one valid claim and concurrent execution per generation. It does not promise exactly-once Keycloak requests.

Every IdamBoxUser write, including current Keycloak externalSubject/password cleanup, goes through Document Service. Remove the existing query-layer write-back; trusted nested linkage updates skip only recursive external provisioning. Validate/capture transient passwords, keep them out of persisted input while provisioning is enabled, and prove no plaintext/hash is retained. Atomic raw coordination is allowed for outbox rows, not user mutation.

## Migration and backward compatibility

After approval only, Strapi schema sync adds two collections and optional user fields plus protected=false. Verify existing null/absent protection reads false; backfill only if the pinned implementation requires it, via Document Service. Keep source ownership, HR fields and timestamps null for legacy users. Do not assign their source, alter their existing roles or subjects, or reset tokens. Source seed is opt-in and idempotent; it must skip HR-owned edits of fixtures that have since been claimed.

Verify the real unique index on sourceIdentityKey and unique outbox userDocumentId, and one-to-one relation enforcement, on fresh and reused databases. Document exact physical identifiers discovered from Strapi metadata; do not invent a compound index on a relation column because Strapi stores relations in link tables. Generated declarations must match only the approved schemas. Frozen JDL changes are not included in this proposal.

## Required verification after approval

- Real Strapi tests cover source/protected ownership, atomic one-time claims, concurrent duplicate tuples, field refusals independent of provisioning flags, preserved roles, safe projections, source-service access isolation and seed restart.
- Keycloak fake-server integration proves blocking-create/update rollback, no retained password, inactive commit without network, atomic enqueue rollback, disable/logout retry, crash replay and next-request active-status refusal.
- AST write guard and runtime Document Service discipline tests fail deliberate direct/aliased/bulk/raw user writes; legitimate Document Service persistence and outbox coordination pass.
- Shared PostgreSQL, two independent Strapi instances/connections prove concurrent lease claim, expiry/crash recovery, owner/generation fencing and reactivation serialization. SQLite single-process evidence is insufficient for this gate.
- Run pnpm --dir apps/backend test, compare the known baseline in .planning/WINDOWS.md, and verify catalogues, served-operation reservations and CSRM contracts retain compatibility.
- Amend docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md with the approved deactivation exception and retry limits; keep ADR 0004 subject matching intact.

## Departures from the milestone brief (section 5)

The operator should check these before approving, because they go beyond the fields the brief lists:

1. **`IdamBoxUser.sourceIdentityKey`** (private, unique, server-derived). Strapi has no compound unique index, and relations live in link tables, so "`sourceExternalId` unique per source" needs a single-column database guarantee. Without it, two concurrent creates or claims could both succeed.
2. **`KeycloakSyncOutbox` lease and fencing fields** (`userDocumentId`, `idamboxUser`, `externalSubject`, `operation`, `syncStatus`, `generation`, `leaseOwner`, `leaseExpiresAt`, `completedAt`) beside the brief's attempts, last error code and next attempt time. They make "each row claimed once with two Strapi instances" provable and stop a stale worker from disabling a reactivated user.
3. **A seeded `idambox-iam` Application row and the `role.identity_provisioning` Role** in both catalogue copies. These are data, not content types, and no existing Role's grants change.
4. **Requestor birthright excludes registered source service identities.** This changes shared authorisation code only for the new service users. Every existing user keeps their access.

## Approval

Status: **approved by the operator on 2026-10-14**, for the three content-type changes exactly as this record states them, including the departures listed above.

The schema that lands must match this record exactly. Any later change to a field, relation or index reopens approval.

Approval covers:

- the new `IdentitySource` and `KeycloakSyncOutbox` collections and the new `IdamBoxUser` attributes, exactly as tabled above, including the departures listed above;
- the readers: `iam` (owner) and `csrm`, which reads `IdamBoxUser` throughout requests, questionnaires, assessments, risks, access and people selectors;
- migration behaviour: optional fields left null, `protected` read as false for existing users, and no change to any existing user's roles, `externalSubject` or references;
- the ADR 0002 amendment: a deactivation commits in Strapi and the outbox carries the Keycloak disable and session end; creates and other updates still block.

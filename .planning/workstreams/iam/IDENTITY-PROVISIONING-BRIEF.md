# Identity provisioning brief: midPoint provisions IdamBox Users from the customer's Identity Source

**Status:** input for `/gsd-new-milestone --ws iam` (`iam` v1.0 Identity Provisioning). Agreed with the operator on 2026-10-13 through a grilling session; every decision below (D1–D26) was accepted explicitly. Nothing here has been added to the `iam` `ROADMAP.md`, `REQUIREMENTS.md` or `STATE.md` yet: the GSD milestone workflow does that.
**Supersedes:** `docs/iam-early-research/IDENTITY-LIFECYCLE-BRIEF.md` (2026-10-03, "Strapi is the hub"). Decisions carried over from it are cited as I-numbers.
**Research:** `docs/iam-early-research/IDENTITY-SOURCE-PROVISIONING.md` (SCIM standards and hub behaviour), `docs/iam-early-research/identity-management-design/` (engine selection, 2026-10-11), `docs/iam-early-research/midpoint-docker-compose.yaml` (starting compose, not to be copied as is), and the connector facts in section 2 (checked 2026-10-13).
**Sections:** 1 goal, 2 ground truth, 3 decisions, 4 architecture, 5 model gaps, 6 requirements, 7 phases, 8 risks, 9 handoffs to `csrm`, 10 backlog, 11 out of scope.

## 1. Goal

As an IdamBox operator, I want the workforce in the customer's Identity Source (typically the HR system) to become IdamBox Users automatically through midPoint, the identity engine: joiners created, movers updated and leavers deactivated without anyone keying users in by hand, so a leaver loses access to every IdamBox product (CSRM first) on the next sync.

## 2. Ground truth (checked 2026-10-13; verify, don't assume)

**Repository**
- `docker/docker-compose.yaml` is compose project `idp`: Keycloak 26.6.1 on `127.0.0.1:8080` (realm import from `docker/keycloak/import`) and ClamAV on `127.0.0.1:3310`. Credentials are hard-coded dev defaults.
- `IdamBoxUser` (`apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json`): `email`, `username` unique and required; `firstName`, `lastName`; `displayName` required; `accountStatus` `active|inactive`; `externalSubject` unique (the Keycloak user id); private `password`; `roles` manyToMany `Role`. No source, correlation or HR fields.
- Outbound Keycloak provisioning exists (ADR 0002, `apps/backend/src/keycloak/`): with `IDAMBOX_KEYCLOAK_PROVISIONING=true`, a Document Service middleware creates/updates the Keycloak user inside the `IdamBoxUser` write transaction; a Keycloak failure rolls the write back. Deletes do not propagate.
- Strapi maps the Keycloak token `sub` to exactly one active `IdamBoxUser.externalSubject` on every request (ADR 0004); an inactive user is refused immediately. Email linking was rejected.
- Requestor is an implicit birthright role; Security Analyst is explicit. There is no change-log content type yet (csrm Phase 22, not started, plans one).
- The datamodel is frozen: a content-type change starts with a `docs/contract-gaps/` record and an approval checkpoint that names every workstream reading the type (`.planning/PROJECT.md`, "GSD Workstreams").
- `CONTEXT.md` now defines Identity Source, Identity engine, Identity, IdamBox User, Sourced user and Manual user.

**midPoint and connector (external, checked 2026-10-13)**
- midPoint 4.8.14 "Curie" is the LTS (supported to 2028-10-17), dual EUPL/Apache-2.0. 4.10.x is EUPL only. Image tags follow `<version>-<os>-<channel>`; never use `latest`. PostgreSQL is the only repository (16 is what the official compose uses).
- The official compose pattern is a one-shot init service (`midpoint.sh init-native`, `ninja.sh run-sql --create`) then `midpoint.sh container`, sharing a `midpoint_home` volume at `/opt/midpoint/var`, configured with `MP_SET_midpoint_repository_*`.
- Objects in `/opt/midpoint/var/post-initial-objects/` load at startup in three-digit prefix order, overwrite existing objects, and are then renamed `*.done` (not re-applied on restart).
- The CSV, DatabaseTable and LDAP connectors are bundled. **No SCIM 2.0 connector is bundled or Evolveum-supported.** The chosen one is the community **Provision IAM (formerly Exclamation Labs) SCIM2 connector** `com.exclamationlabs.connid.base.scim2.Scim2Connector`, tag `V1.2.9`, Apache-2.0, built from source with Gradle and dropped into `/opt/midpoint/var/connid-connectors/`. Its documented midPoint compatibility is unstated: proving it loads on 4.8 is Phase 1's spike.
- What that connector sends: create = `POST /Users` after a lookup; update = GET then full `PUT /Users/{id}`, plus a `PatchOp` with lowercase `add`/`remove`/`replace` for multi-valued attributes; disable = `active` in the `PUT` body; delete = `DELETE /Users/{id}`; search = `<attr> eq "<value>"` only; paging = `startIndex`/`count`; Enterprise User extension behind a flag; auth = bearer token only. Its connection test calls `GET /ResourceTypes` and **fails unless both User and Group are listed**. It does not read `/ServiceProviderConfig`.

## 3. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **midPoint is the identity engine and the reference hub.** It owns correlation, HR attribute authority and joiner/mover/leaver decisions. Strapi's SCIM 2.0 interface is IdamBox's only inbound provisioning contract and stays standards-based, so Entra or Okta could be pointed at it later. Carries over I3, I8 (as amended by D13), I11, I12, I13, I20; drops I2, I14's import screens, I15's import job and I16's CSV snapshot logic, which midPoint now does. | One lifecycle authority; Strapi stays the authority for `IdamBoxUser` and the production API boundary without depending on midPoint. |
| D2 | **Strapi keeps provisioning Keycloak** (ADR 0002, amended by D16). midPoint does not write to Keycloak in this milestone. | Two Keycloak writers would break the `externalSubject` link ADR 0004 relies on. |
| D3 | **Reference Identity Source is a CSV file resource in midPoint** (bundled CSV connector). A DatabaseTable "HR" source is a stretch goal; SIMS and other customer sources are out of scope. | Fastest to script and reset; no extra database. |
| D4 | **`iam` is a platform workstream with no `apps/` folder.** midPoint configuration lives under `docker/midpoint/`; backend changes are planned here under the shared-backend rules. `.planning/PROJECT.md` records the exception. | midPoint config is deployment config, like `docker/keycloak/import`. |
| D5 | **One `idp` compose project** gains `midpoint_data` (postgres:16-alpine), `midpoint_init` (one-shot) and `midpoint_server` on `127.0.0.1:8081`, plus Mailpit (D17). Credentials come from a git-ignored `docker/.env` with a committed `docker/.env.example`. No pgadmin, no Samba AD. midPoint reaches Strapi on the host via `host.docker.internal:1337` (with `extra_hosts: host-gateway`). | Port 8080 is Keycloak's; no secrets in git; the research compose file's extras and conflicting passwords are not needed. |
| D6 | **HR owns identity attributes and status; IdamBox owns roles.** midPoint pushes identity attributes and `active` only. HR-owned fields of sourced users are read-only in IdamBox, enforced by the Strapi user APIs. Manual and protected users are never changed by a source except through a confirmed claim (D13). | No two writers on a field; break-glass users survive a sync. |
| D7 | **`iam` milestone v1.0 "Identity Provisioning", phases numbered from 1.** midPoint's console is the admin UI for sources, sync and activity, so there is no dependency on csrm Phase 22. | Independent delivery; the only coupling is the shared-backend rules. |
| D8 | **Glossary:** Identity Source, Identity engine, Identity, IdamBox User, Sourced user, Manual user (written to `CONTEXT.md` 2026-10-13). "Account" is avoided for an IdamBox User in product copy. | One vocabulary across midPoint, Strapi and CSRM. |
| D9 | **midPoint 4.8.14 LTS** (`evolveum/midpoint:4.8.14-…`, exact tag pinned in Phase 1). Re-evaluate at the next LTS. Licence facts go in an ADR; no legal opinion is implied. | Longest support; Apache-2.0 available for a shipped product. |
| D10 | **Provision IAM SCIM2 connector `V1.2.9`, built in a multi-stage `docker/midpoint/Dockerfile`** (Gradle stage builds the pinned tag; final stage `FROM evolveum/midpoint:4.8.14-…` copies the JAR into `connid-connectors`). No binaries committed. A Phase 1 spike proves it loads and passes its connection test on 4.8 before anything depends on it. | Only usable SCIM 2.0 target connector; reproducible build. |
| D11 | **Strapi SCIM 2.0 scope:** `POST/GET /Users`, `GET/PUT/PATCH/DELETE /Users/{id}`; PATCH ops case-insensitive; `filter` with `eq`/`and` on `userName`, `externalId`, `emails.value`, Enterprise `employeeNumber`; index pagination; `/ServiceProviderConfig` (`bulk`, `changePassword`, `sort`, `etag` false), `/Schemas`, `/ResourceTypes` listing **User and Group**; `GET /Groups` returns an empty `ListResponse`, Group writes answer 501; media type `application/scim+json`. **Acceptance gate = the connector's own request sequence**, captured once from midPoint and replayed as backend tests. | Matches the real client, including its User+Group connection-test quirk, while staying RFC 7644 conformant. |
| D12 | **Leaver = disable.** HR `terminated` → Identity disabled → `PUT active=false` → `IdamBoxUser.accountStatus=inactive`. The IdamBox resource's outbound uses disable-instead-of-delete. A `DELETE` that still arrives deactivates and sets `sourceDeletedAt`; reads then answer 404 (I11). No record is ever removed. | Leaver revocation is the security-critical path; references from requests, risks and owners must survive. |
| D13 | **Existing users are linked by a confirmed claim.** SCIM lists unowned, unprotected manual users read-only. midPoint correlates on email/employee number with operator confirmation (correlation case). The first `PUT` carrying `externalId` from a source to an unowned user claims it for that source, once. `protected` users (break-glass, service identities) are never listed and never claimable. After a claim only (source, `sourceExternalId`) links (I8). | Avoids 409 duplicates for pre-existing people without rebuilding the dry-run screen; email alone never links silently. |
| D14 | **Smaller model** (section 5): `IdentitySource` collection; `IdamBoxUser` gains `identitySource`, `sourceExternalId` (unique per source), `employeeNumber`, `department`, `jobTitle`, `sourceDeletedAt`, `lastSyncedAt`, `protected`. `manager`, `division`, start/end dates are backlog. | midPoint holds HR history and dates; add fields only when a feature reads them. |
| D15 | **Each Identity Source has a non-human IdamBox User** with a hashed, rotatable bearer token. SCIM operations are catalogued as FunctionApis under an **Identity Provisioning** Function granted only to service identities, in both catalogue copies. A source changes only users it owns (plus D13 claims). Tokens are issued and rotated by `pnpm --dir apps/backend scim:token <source>`, printed once; dev seed creates source "midPoint (dev)" and the token goes into `docker/.env`. | Hubs use one long-lived bearer token; every served operation stays traceable through Role → Function → FunctionAPI. |
| D16 | **Leaver-safe Keycloak sync (I9), amending ADR 0002:** a deactivation always commits in Strapi; a `KeycloakSyncOutbox` worker disables the Keycloak user and ends its sessions with retry. Creates and other updates still block and answer **503 with `Retry-After`** when Keycloak is down; midPoint retries through its pending operations and a refresh task. | Under ADR 0002 a Keycloak outage rolls back the leaver; Strapi already refuses inactive users on every request. |
| D17 | **Provisioning never sets a password** (I18). For a new sourced user Strapi triggers Keycloak's `execute-actions-email` (`UPDATE_PASSWORD`); Mailpit in the `idp` project receives it locally. Corporate IdP brokering is backlog. | HR sends no passwords. |
| D18 | **Cadence:** HR CSV live sync every 5 minutes; nightly reconciliation of the HR CSV and of the IdamBox resource (drift repair); a pending-operation refresh task. **No midPoint in CI:** CI runs backend SCIM tests against the recorded connector requests; a scripted local gate in `docker/midpoint/e2e/` runs the full journey and its evidence is recorded in every phase that touches SCIM. | Java/midPoint startup is too heavy for CI; the recorded sequence keeps the contract honest. |
| D19 | **Reference CSV columns:** `employeeNumber`, `givenName`, `familyName`, `preferredName`, `email`, `username`, `department`, `jobTitle`, `status` (`active`/`terminated`), `startDate`, `endDate`. `employeeNumber` is the Identity's correlator and `name`; `status` and dates drive activation in midPoint. **Fixed SCIM mapping (I20):** `userName`; primary `emails` → `email`; `name.givenName`/`familyName` → `firstName`/`lastName`; `displayName` (derived from names when absent); `active` → `accountStatus`; `externalId` = HR `employeeNumber` → `sourceExternalId`; Enterprise `employeeNumber`, `department`; `title` → `jobTitle`. The engine renames; Strapi has one mapping. | No per-source mapping configuration in Strapi. |
| D20 | **Birthright Requestor only for sourced users** (I5, I12). Security Analyst and Admin are granted only inside IdamBox; movers keep explicit roles. | An external system must not grant analyst rights around Role → Function governance. |
| D21 | **Audit:** midPoint's audit log records every lifecycle decision and its cause; Strapi writes a structured log line per SCIM request (source, operation, target, outcome) and sets `lastSyncedAt`. Feeding csrm Phase 22's change log is backlog. | No change log exists yet. |
| D22 | **`iam` enforces rules server-side; CSRM UI changes are handed off** (section 9). `iam` touches `apps/csrm` only where the end-to-end sign-in journey needs it. | Each application's UI is planned in its own workstream. |
| D23 | **midPoint config as code:** `docker/midpoint/objects/` with numbered files (`100-resource-hr-csv.xml`, `110-resource-idambox-scim.xml`, `200-object-template-user.xml`, `300-task-*.xml`, …) bind-mounted read-write as `post-initial-objects`; `*.done` git-ignored; `docker/midpoint/reload.ps1` and `reload.sh` re-apply with `ninja import --overwrite`; `docker compose down -v` resets. HR sample data in `docker/midpoint/hr/`. | Post-initial import runs once per file; config changes need an explicit reload. |
| D24 | **ADRs:** (1) midPoint is the identity engine and SCIM 2.0 is Strapi's only inbound provisioning contract (replaces the 2026-10-03 "Strapi is the hub" decision); (2) ADR 0002 amendment for D16; (3) midPoint 4.8 LTS and the community SCIM2 connector: version, licence facts and community-support risk. The 2026-10-03 brief is marked superseded. | Hard to reverse, surprising without context, real trade-offs. |
| D25 | **Phases 1–5** as in section 7. | Platform and connector risk first, leaver safety before any automated feed. |
| D26 | This brief is the input to `/gsd-new-milestone --ws iam`; the research files stay where they are. | Planning files stay owned by the workflow. |

Defaults applied without a separate question: the SCIM routes are rate-limited; midPoint and Strapi share only the host bridge in development (no IP allow-list); dev-mode rules still apply (provisioning and token-verification flags off by default, SCIM tests run with no Keycloak and the outbox simply queues).

## 4. Architecture

```
Identity Source (HR CSV)                         docker compose project "idp"
        │ CSV connector: live sync 5 min, nightly reconciliation
        ▼
   midPoint 4.8 LTS  ── Postgres 16 repository, audit log, correlation cases
        │ Provision IAM SCIM2 connector (bearer token)
        │ POST / PUT (active=false = leaver) / PATCH / DELETE / GET eq-filter
        ▼
   Strapi  /scim/v2  ── token → source service identity → Identity Provisioning Function
        │
   identity upsert service (ownership, claim, protected, HR-owned fields)
        │
   Document Service write of IdamBoxUser
        │
   ┌────┴───────────────────────────┐
   create / update: blocking         deactivate: commits in Strapi;
   Keycloak provisioning (ADR 0002)  Keycloak disable + session end via KeycloakSyncOutbox
   + execute-actions-email → Mailpit
        │
   Keycloak 26.6.1 ── sign-in ──► CSRM (Requestor birthright)
```

- Every write goes through the upsert service and the Document Service, never `strapi.db.query` (which skips Keycloak provisioning). A test enforces it.
- Duplicate creates answer 409 `uniqueness`; data errors answer 4xx; transient Keycloak failures answer 503 with `Retry-After`, so midPoint retries instead of quarantining.

## 5. Model gaps (the contract-gap record writes these first)

**New collection `IdentitySource`:** `name` (unique), `sourceStatus` (`active` | `inactive`), `serviceUser` (the source's non-human `IdamBoxUser`), `tokenHash`, `tokenRotatedAt`, `lastActivityAt`.

**New `IdamBoxUser` fields:**

| Field | Purpose |
|---|---|
| `identitySource` (manyToOne `IdentitySource`; empty = manual user) | Ownership (D6, D15) |
| `sourceExternalId` (unique per source) | Correlation key; never confused with `externalSubject` (Keycloak's id) |
| `employeeNumber` | HR matching, claim correlation |
| `department`, `jobTitle` | Context and mover visibility |
| `sourceDeletedAt` | SCIM `DELETE` (D12) |
| `lastSyncedAt` | Audit and stale-record detection |
| `protected` (boolean) | Break-glass and service users: never listed, claimed or changed by a source (D13) |

**New collection `KeycloakSyncOutbox`:** pending Keycloak disable/session-end work with attempts, last error code and next attempt time; one worker claims rows at a time, safe with more than one Strapi instance.

The record names the `csrm` workstream as a reader of `IdamBoxUser`. Check `docs/references/idambox-datamodel.jdl` for existing terms before naming.

## 6. Requirements (draft IDs)

- **IAM-01** The `idp` compose project runs midPoint 4.8.14 LTS with its Postgres repository, the SCIM2 connector and Mailpit beside Keycloak, with credentials from `docker/.env`, and `docker/README.md` documents start, reset and reload.
- **IAM-02** An operator issues, rotates and revokes an Identity Source's bearer token; the source acts only through its own service identity and the Identity Provisioning Function.
- **IAM-03** midPoint creates, reads, replaces, patches, disables and deletes IdamBox Users through Strapi's SCIM 2.0 `/Users`, and the connector's connection test passes; the recorded connector request sequence passes as backend tests.
- **IAM-04** A source changes only users it owns; manual users are changed only through a confirmed claim; protected users are never listed or changed.
- **IAM-05** A leaver's deactivation commits in Strapi even while Keycloak is unavailable; Keycloak is disabled and sessions ended when it returns; the person is refused in the UI and the API immediately.
- **IAM-06** SCIM `DELETE` deactivates and marks the user source-deleted without removing the record.
- **IAM-07** HR-owned fields of sourced users are refused by the Strapi user APIs; roles are granted only inside IdamBox and sourced users receive birthright Requestor.
- **IAM-08** midPoint reads the reference HR CSV, correlates on `employeeNumber`, confirms email matches to pre-existing users through correlation cases, and applies joiner, mover and leaver changes on the 5-minute live sync, with nightly reconciliation and a pending-operation refresh.
- **IAM-09** Every SCIM request is logged with source, operation, target and outcome; midPoint's audit log records each lifecycle decision.
- **IAM-10** A new sourced user receives Keycloak's set-password email (Mailpit locally); provisioning never sets a password.
- **IAM-11** A scripted local gate proves CSV joiner → midPoint → Strapi → Keycloak → sign-in as Requestor → CSV mover → CSV leaver → refused in the UI and the API, with a Playwright sign-in proof at 1440 and 375.

## 7. Phases (`iam` v1.0 Identity Provisioning)

| # | Phase | Delivers | Requirements | Size |
|---|---|---|---|---|
| 1 | midPoint platform and connector spike | Compose services (D5), `.env`/`.env.example`, the multi-stage Dockerfile with the SCIM2 connector, proof the connector loads on 4.8 and reaches a stub `/ResourceTypes`; `docker/README.md`; ADRs 1 and 3; `.planning/PROJECT.md` workstream note (D4). | IAM-01 | M |
| 2 | Identity model and leaver-safe Keycloak sync | Contract-gap record and approved schema change (section 5); JDL/glossary terms; `IdentitySource`, service identity, Identity Provisioning Function in both catalogue copies; the upsert service with ownership, claim, protected and HR-owned-field rules; the Document-Service-only test; `KeycloakSyncOutbox` with session end; ADR 2 (ADR 0002 amendment). No UI. | IAM-04, IAM-05, IAM-07 (service) | L |
| 3 | Strapi SCIM 2.0 service | Endpoints and discovery (D11), token auth and `scim:token` script, 409/503/rate limits, DELETE semantics, request logging, recorded-connector replay tests. | IAM-02, IAM-03, IAM-06, IAM-09 (Strapi) | L |
| 4 | midPoint configuration | HR CSV resource and sample data, IdamBox SCIM resource, object template and mapping (D19), correlation with confirmation, disable-instead-of-delete, live sync/reconciliation/refresh tasks, reload scripts. Can overlap Phase 3 once the SCIM contract is fixed. | IAM-08, IAM-09 (midPoint) | M |
| 5 | Sign-in and end-to-end journey | `execute-actions-email` for sourced users via Mailpit; the `docker/midpoint/e2e/` gate; the Playwright sign-in proof. | IAM-10, IAM-11 | M |

Order: 1 → 2 → 3 → 4 → 5 (3 ∥ 4 once the contract is fixed).

## 8. Risks to plan for

- **Community connector:** no Evolveum support and unstated 4.8 compatibility (Phase 1 spike gates everything; fallback is a custom ConnId connector or the 4.11 SCIMREST framework, recorded in ADR 3).
- **Connector quirks:** User+Group `/ResourceTypes` requirement, full-`PUT` updates (Strapi must treat omitted optional attributes per RFC 7644 replace semantics without wiping IdamBox-owned data), lowercase PATCH ops, `eq`-only search.
- **Middleware bypass:** any write through `strapi.db.query` creates users without Keycloak accounts (Phase 2 test).
- **Retry storms:** a 503 during a Keycloak outage makes midPoint queue pending operations; the refresh task and Retry-After must be tuned so recovery doesn't flood Keycloak.
- **Claim misuse:** a wrong correlation confirmation hands a manual user to a source; claims are logged and limited to unprotected, unowned users.
- **Token compromise:** scoped to the source's own users, rotatable, every write logged with the source identity.
- **Config drift:** `post-initial-objects` loads once; forgetting the reload leaves midPoint on stale config (reload scripts, README).
- **Throughput:** each create costs a Keycloak Admin API call inside a transaction; measure the first full reconciliation of the reference CSV before promising timings for 10k users.

## 9. Handoffs to the `csrm` workstream (backlog there, not built here)

- Source badge and read-only HR fields on CSRM user screens (the API already refuses the edits).
- "Owned by an inactive user" list and reassignment (I19).
- Provisioning entries in csrm Phase 22's change log once it exists.

## 10. Backlog (captured, not in `iam` v1.0)

midPoint provisioning Keycloak directly (Openstandia connector) and managed Keycloak groups; Microsoft SCIM Validator and Okta test-suite conformance runs (need a public URL); Entra/Okta as alternative hubs; corporate IdP brokering in Keycloak; DatabaseTable or SIMS Identity Sources; `manager`, `division`, start/end dates; HR groups → IdamBox Role mapping; GDPR erasure; an admin screen for Identity Sources and tokens; upgrade to the next midPoint LTS and Keycloak 26.8.

## 11. Out of scope

Pull connectors to HR vendor APIs; passwords from a source; hard deletes; roles from a source; SCIM `/Groups` writes and `/Bulk`; midPoint in CI; CSRM UI changes beyond the sign-in journey.

# Identity Source Provisioning into `IdamBoxUser`: standards, tools and patterns

**Date:** 2026-10-03
**Question:** Which open standards, tools and frameworks matter for bringing workers from an authoritative Identity Source (usually an HR system such as Workday, SAP SuccessFactors, BambooHR, Oracle HCM, ADP or Personio) into the Strapi 5 `IdamBoxUser` collection? The goal is a one-time initial load, followed by automatic joiner, mover and leaver (JML) create/update/deactivate.
**Scope note:** Sections 1–5 hold cited facts. Section 7, "Implications for IdamBox", is **inference** and is labelled as such. Anything I could not confirm from a primary source is marked *unverified*.

---

## TL;DR

1. **SCIM 2.0 is the de-facto inbound provisioning contract.** It is defined by RFC 7642/7643/7644 and, since 2025–26, extended by **RFC 9865** (cursor pagination) and **RFC 9967** (SCIM Security Event Tokens, which define `activate`/`deactivate`/`create`/`patch` events). Every hub examined (Entra, Okta, Google Workspace, JumpCloud, midPoint, Syncope, Keycloak 26.6+) speaks SCIM as client, server or both.
2. **No HR system pushes SCIM to arbitrary apps at enterprise scale on its own.** In practice a hub (Entra, Okta, an IGA such as midPoint) reads HR through vendor APIs (for example Workday `Get_Workers` with transaction-log delta queries) and **pushes SCIM to the app**. The one exception found is JumpCloud's BambooHR connector, which is SCIM HR→JumpCloud and is still hub-bound.
3. **Hubs deactivate rather than delete.** Okta never sends `DELETE` for users; it sets `active=false`. Entra sets `active=false` on unassign, out-of-scope or disable, and sends `DELETE` only when a user is hard-deleted (by default 30 days after soft-delete). This fits IdamBox's "deactivate, don't delete" posture, but the endpoint still has to decide what a `DELETE` means.
4. **Hubs require only a small subset of SCIM.** `/Users` with POST/GET/PATCH/PUT, `filter=userName eq` and `externalId eq`, index pagination, `active`, `/Schemas`/`/ServiceProviderConfig`, and a bearer token. **Entra does not use `/Bulk`**, and Okta does not either for user push.
5. **Keycloak now has official SCIM.** The Realm SCIM API was **experimental in 26.6** (flag `scim-api`), **preview in 26.7**, and **supported and on by default in 26.8**. It is inbound only, with no `/Bulk` and no sorting. IdamBox runs 26.6.1, so for IdamBox it is experimental. Community extensions: Captain-P-Goldfish `scim-for-keycloak` is end-of-life (moved to a commercial site); Metatavu `keycloak-scim-server` and `mitodl/keycloak-scim` (outbound client) are active.
6. **There is no credible Strapi SCIM plugin.** npm and marketplace searches found none. Node building blocks exist: `scimmy` (MIT, last release 2025-03), `scim-patch` and `scim2-parse-filter` (Unlicense, active in 2026), and `scimgateway` (MIT, active, but it is a standalone gateway, not a library).
7. **OIDC JIT provisioning cannot handle leavers.** It runs only at sign-in, so it never learns about terminations. SSF/CAEP/RISC 1.0 (OpenID Final, 2025) can signal account-disabled and session-revoked, but they are signals, not a provisioning contract.
8. **Today's model cannot correlate HR records.** There is no stable source key (employee number or HR worker id), no source attribution, no lifecycle dates and no manager. Email is mutable and IdamBox already rejected it for sign-in linking. This needs a `docs/contract-gaps/` record before any build.
9. **Inference:** recommend one inbound contract, a **SCIM 2.0 `/scim/v2/Users` service hosted inside Strapi**, plus a **CSV/initial-load path that reuses the same upsert service**. Defer pull connectors to HR APIs to hubs or IGAs.
10. **Inference: the blocking per-user Keycloak middleware is the main scaling and availability risk.** Bulk loads and HR syncs during a Keycloak outage will fail or roll back per record. Idempotent upserts, per-record transactions and hub retry semantics make that tolerable. Decoupling (outbox) would require revising ADR 0002.

---

## 1. Standards

### 1.1 SCIM 2.0 core (IETF, 2015)

- **RFC 7642** (Informational) defines the concepts and use cases, including the actors "Cloud Service Provider" and "Enterprise Cloud Subscriber", and triggers such as change and de-provisioning. [RFC 7642]
- **RFC 7643 Core Schema** defines:
  - The `User` resource (`userName` REQUIRED and unique, `name`, `displayName`, `emails`, `active`, `roles`, `entitlements`, `groups`).
  - Common attributes `id` (service-provider assigned, immutable) and `externalId` (client-assigned identifier, as defined by the provisioning client).
  - `meta.version` for ETags. [RFC 7643 §3.1, §4.1]
  - The **Enterprise User extension** `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User` (§4.3), with `employeeNumber`, `costCenter`, `organization`, `division`, `department` and `manager` (complex: `value` = manager's SCIM `id`, `$ref`, `displayName`). [RFC 7643 §4.3]
  - **Note:** SCIM has no standard hire, start or termination date. Hubs fill this gap with extensions; for example Entra uses `employeeHireDate` and `employeeLeaveDateTime` in Entra-side lifecycle workflows. [Entra API-driven concepts]
- **RFC 7644 Protocol** covers:
  - Create (`POST`, §3.3), Read/Query (`GET` with `filter`, `startIndex`/`count` index pagination, §3.4.2), Replace (`PUT`, §3.5.1) and **Modify (`PATCH` with `add`/`remove`/`replace` ops and value paths, §3.5.2)**.
  - Delete (§3.6), **Bulk** (`POST /Bulk` with `bulkId` cross-references and `failOnErrors`, §3.7), and `/Me`.
  - Discovery endpoints `/ServiceProviderConfig`, `/ResourceTypes` and `/Schemas` (§4).
  - **ETags/versioning** (`If-Match`/`If-None-Match`, §3.14), and errors with `scimType` values (`uniqueness` → HTTP 409, `invalidFilter`, `mutability`, `tooMany`).
  - Media type `application/scim+json`. [RFC 7644]
- The deactivate semantics are not spelled out in the RFC. `active` is simply a boolean "administrative status" [RFC 7643 §4.1.1]. The convention that "leaver = `active:false`" comes from the hubs (§3).

### 1.2 SCIM working-group output since 2025 (status as of 2026-10-03)

| Document | Status | Relevance |
|---|---|---|
| **RFC 9865** Cursor-Based Pagination (2025-10) | Proposed Standard; updates 7643/7644 | Adds `cursor`/`count` and `nextCursor`/`previousCursor`. Index pagination stays the default when both are offered. Useful for large reconciliation reads. [RFC 9865] |
| **RFC 9967** SCIM Profile for Security Event Tokens (2026-05) | Proposed Standard; updates 7643/7644 | Defines SCIM events as RFC 8417 SETs: feed events, **provisioning events `create`/`patch`/`put`/`delete`/`activate`/`deactivate`** (notice or full mode), and **asynchronous request completion**. This standardises event-driven SCIM and async bulk. [RFC 9967] |
| **RFC 9944** Device Schema Extensions (2026-05) | Proposed Standard | Not relevant to workers. [SCIM WG] |
| `draft-ietf-scim-roles-entitlements-01` | **Expired** WG draft (2025-10) | Would give roles and entitlements a deterministic schema; not usable as a dependency. [draft-ietf-scim-roles-entitlements] |
| `draft-ietf-scim-use-cases-reloaded-02` | **Expired** WG draft (2026-01) | Informational. [SCIM WG] |
| `draft-wzdk-scim-agent-resource-00` (2026-06, Microsoft/Okta/Nextident) | Individual I-D | Proposes `Agents` and `AgenticApplications` resource types for non-human identities. Not a WG document. [SCIM WG related docs] |
| `draft-kushwaha-scim-agent-governance-00`, `-attr-cursor-pagination-01`, `-tenant-resource-00`, `-didvc-binding-01` | Individual I-Ds (2026-07/08) | Speculative; ignore for now. |
| `draft-zollner-scim-interop-profile-01`, `draft-schreiber-scim-ipsie-profile-00`, `draft-zollner-scim-group-members-01` | Individual I-Ds (2026) | Interop profiles. Worth watching because they will codify the "hub subset" in §3. Contents not reviewed (*unverified*). |

### 1.3 Security Event Tokens and the OpenID Shared Signals family

- **RFC 8417 (SET)** is a JWT envelope for security events. RFC 9967 builds on it. [RFC 8417, RFC 9967]
- **OpenID Shared Signals Framework 1.0, CAEP 1.0 and RISC 1.0** were approved as **OpenID Final Specifications** in 2025. [OpenID SSF/CAEP/RISC announcement, via SGNL/Biometric Update coverage; the primary list is at openid.net/specs]
  - SSF defines transmitter/receiver streams (push and poll).
  - CAEP covers session and credential changes (for example `session-revoked`, `credential-change`).
  - RISC covers account events (for example `account-disabled`, `account-purged`, `identifier-changed`). The event names come from my knowledge of the specs and were not re-fetched (*unverified*).
- **Relevance:** SSF can speed up a leaver's revocation (kill sessions in Keycloak or Strapi immediately). It does not carry the attribute payload needed to create or update a worker. Treat it as a complement to SCIM, not a substitute.

### 1.4 HR Open Standards (HR-JSON)

- The HR Open Standards Consortium publishes voluntary JSON/XML HR data-exchange standards (Recruiting, Assessments, Employee/Worker and Earnings in 4.3, JEDx, Trusted Career Profile, skills data). API specifications are on GitHub (`HROpen/APISpecifications`, last push 2026-02). [hropenstandards.org; GitHub HROpen; 4.3.0-rc2 announcement]
- **Relevance: low.** None of the HR vendors or IAM hubs examined use HR-JSON as a provisioning contract; they use proprietary APIs or SCIM. It can serve as a vocabulary reference for HR-derived attributes. Whether any HRIS natively emits HR-JSON for identity feeds is *unverified*.

### 1.5 LDAP / Active Directory as an intermediary

- The classic pattern is HR → (Entra/Okta/IGA) → AD/LDAP → apps. Entra's Workday and SuccessFactors connectors target **on-premises AD or Entra ID** as the primary destinations, and both Entra and Okta market "HR → AD" as the core HR-driven use case. [Entra plan-cloud-hr-provision; Okta HR-driven IT provisioning]
- Keycloak can federate LDAP/AD as a user store. That would make Keycloak, not Strapi, the place where HR-derived users appear, which conflicts with ADR 0002 (Strapi writes Keycloak). *Inference.*

### 1.6 OIDC Just-in-Time (JIT) provisioning: why it cannot replace JML

- JIT creates or updates a local account from ID-token claims **at sign-in**. OpenID Connect Core defines claims delivery at authentication time only; it has no out-of-band channel to say "this person left". [OIDC Core 1.0]
- So JIT covers joiners lazily (first login), covers movers only on the next login, and **never covers leavers**. Leavers need a push (SCIM `active:false`), a pull/reconciliation, or a signal (SSF/RISC).
- IdamBox already rejected email-based linking at sign-in (ADR 0004).

### 1.7 Governance frameworks (brief)

- **JML** is the vocabulary Microsoft uses for HR-driven provisioning ("Joiners-Movers-Leavers process"). [Entra plan-cloud-hr-provision]
- **NIST SP 800-53 Rev. 5 AC-2 Account Management:**
  - Covers account creation, modification, disabling and removal under defined conditions.
  - AC-2(h) requires notifying account managers when users are terminated or transferred.
  - AC-2(3) covers disabling accounts (for example when they are no longer associated with a user, or after inactivity).
  - FedRAMP assigns 8 hours for terminated/transferred notification. [NIST SP 800-53r5; secondary summaries]
- **ISO/IEC 27001:2022 Annex A:** **5.16 Identity management** (full identity lifecycle) and **5.18 Access rights** (provision, review and revoke access, with periodic review). [ISO 27001:2022 via ISMS.online summaries; the standard itself is paywalled, so exact wording is *unverified*]

---

## 2. Integration patterns

### 2.1 Direction

| Pattern | Who calls whom | Examples | Notes |
|---|---|---|---|
| **Push (SCIM server)** | Hub or IGA → app's `/scim/v2` | Entra outbound provisioning, Okta SCIM push, midPoint/Syncope SCIM connector, JumpCloud | The app owns a stable contract; the hub owns HR connectors, mapping, scoping and retries. [Entra how-provisioning-works; Okta SCIM 2.0 guide] |
| **Push (vendor bulk API)** | Any script → hub | **Entra API-driven inbound** `/bulkUpload` | SCIM `BulkRequest` payload, asynchronous (HTTP 202). The client needs no diff logic: "the provisioning service determines create/update/enable/disable". At most 50 records per call; 40 calls per 5 s; 2,000 calls/day (P1/P2) or 6,000 calls/day (Governance). Target is Entra ID or on-prem AD, **not a third-party app**. [Entra API-driven concepts] |
| **Pull (HR API delta)** | Connector → HR API | Entra Workday connector: full sync via `Get_Workers` over the transaction log, then incremental queries for manual updates, effective-dated updates and terminations, and **future-dated hires** | Requires per-vendor connectors and credentials. [Entra Workday integration reference] |
| **Pull (flat file)** | HR exports CSV via SFTP; connector reads | midPoint CSV "HR feed" with live sync and reconciliation; Entra "Scenario 1: HR data extracts" | Lowest common denominator; nightly latency. [midPoint HR feed exercise; Entra API-driven concepts] |
| **Event / webhook** | HR or hub emits events → app | RFC 9967 SCIM SETs; SSF/CAEP/RISC; vendor webhooks (unified HRIS APIs) | Events usually trigger a re-read; a full-state upsert stays the source of truth. *Inference.* |
| **Reconciliation** | Periodic full compare | Entra "Restart provisioning" re-evaluates all objects; midPoint reconciliation tasks | Catches missed events and drift. [Entra how-provisioning-works; midPoint] |

### 2.2 Lifecycle edge cases (as hubs model them)

- **Pre-hire / future-dated starts:**
  - Entra's Workday connector processes future-dated hires early and reads the profile as of the hire date (so it appears active). The docs suggest a `DateDiff` transformation to delay enablement.
  - Entra's planning guide asks: "Do you process future-dated hires and create … accounts in advance? Enabled or disabled?" [Entra Workday reference; plan-cloud-hr-provision]
- **Terminations:** the account is disabled, not deleted. Entra Lifecycle Workflows can delete "X days after termination". [plan-cloud-hr-provision]
- **Rehires:**
  - If the HR id is reused, the existing account is re-enabled.
  - If a new id is issued, a new account is created.
  - Workday conversions (CW↔FTE) produce two profiles with the same WorkerID and different WIDs; Entra transfers the account link to the active profile. [plan-cloud-hr-provision; Workday reference]
- **Correlation / matching:**
  - The default matching attribute for HR inbound is the **employee ID** (Workday `WorkerID` → AD `employeeID`). Multiple matching attributes with precedence are supported.
  - Outbound SCIM queries the app by `userName` and `externalId`. [plan-cloud-hr-provision; Entra SCIM tutorial]
- **Attribute ownership:** a scoping filter decides who is in scope, and per-attribute mappings decide which source wins. Entra API-driven mode warns to send the **complete record every time**, because omitted attributes can be cleared when "clear attribute values" is on. [Entra API-driven concepts]
- **Soft-delete vs delete:**
  - Entra: `active=false` on unassign, out-of-scope or disable. `DELETE` happens only on hard-delete (30 days after soft-delete by default) or when the app has no soft-delete. Microsoft recommends apps "support both soft-deletes and hard-deletes".
  - Okta never `DELETE`s users. [Entra how-provisioning-works; Okta SCIM 2.0]
- **Idempotency and retries:**
  - Entra retries failed records in later cycles with back-off. A job goes into **quarantine** after a high error rate (cycles drop to daily) and is disabled after 4 weeks in quarantine.
  - Duplicate creates are expected to return **409** `uniqueness`. [Entra how-provisioning-works; Entra SCIM validator]
- **Dry-run / audit:**
  - Entra provides provisioning logs and on-demand provisioning.
  - midPoint and Syncope have simulation/preview and audit features (midPoint "simulations"; *unverified* detail).
  - Dry-run is a hub feature; the app endpoint just needs to be deterministic and to log decisions.

---

## 3. Hubs and brokers between HR and apps

### 3.1 Microsoft Entra ID

- **HR-driven inbound connectors:** Workday (to AD, to Entra, and writeback) and SAP SuccessFactors (to AD and to Entra) natively. Other HRIS connect through **API-driven inbound provisioning**. [Entra plan-cloud-hr-provision; Workday reference]
- **API-driven inbound:** described in the push table in §2.1. It requires Entra ID P1, P2 or Governance. ISV permission is `SynchronizationData-User.Upload`. [Entra API-driven concepts]
- **Outbound SCIM to a custom app (what Entra expects from our server):**
  - Create users (groups optional), **PATCH** support, GET by id, and query by **`userName` and `externalId`** (groups by `displayName`).
  - `excludedAttributes=members` on groups, list and paginate, and **`active=false` soft-delete with the user still returned by GET**.
  - `/Schemas`, a **single bearer token**, HTTPS, and `Content-Type: application/scim+json`.
  - Only the `eq` and `and` filter operators are used.
  - PATCH `op` values arrive capitalised (`Add`/`Replace`/`Remove`), so matching must be case-insensitive.
  - `entitlements` on Users is not supported.
  - Groups require unique `displayName`, and **`/Bulk` is not used** ("we don't support SCIM /Bulk today").
  - Auth: either a long-lived secret token or an Entra-issued bearer token (Microsoft says the latter is for testing only). TLS 1.2 with a specified cipher list. Traffic arrives from the `AzureActiveDirectory` service-tag IP ranges. [Entra SCIM tutorial]
  - Incremental cycles run "at intervals defined in the tutorial specific to each application". The commonly cited 40-minute interval is *unverified* here. [Entra how-provisioning-works]

### 3.2 Okta

- **HR as a source:** Okta markets HR-driven IT provisioning with Workday, UltiPro, SAP SuccessFactors, BambooHR and Namely as sources, with scheduled hourly, daily or on-demand imports. [Okta HR-driven IT provisioning]
- **SCIM outbound requirements:**
  - Base URL `/scim/v2/` (no underscores) over TLS.
  - Required user attributes: `userName`, `name.givenName`, `name.familyName`, `emails`, `active`.
  - Stable server-generated `id`.
  - Auth via OAuth 2.0 authorisation code, Basic, or a header token.
  - Filter `userName eq "…"`.
  - PATCH for OIN apps, PUT for custom AIW apps.
  - `startIndex`/`count` (default 100) returned as integers.
  - **No `DELETE` of users; deprovision sets `active=false`.** [Okta SCIM prepare; Okta SCIM 2.0 reference]

### 3.3 Google Workspace

- **Inbound SCIM became generally available in July 2026.** Workspace acts as a SCIM service provider so an IdP, HRIS or custom app can provision, update and deactivate users and groups. GCDS and the cloud "Directory Sync" (beta) remain LDAP/AD-based options. [Google Workspace Updates 2026-07-09] Google is a target, not a hub for third-party apps, so its relevance to IdamBox is low.

### 3.4 JumpCloud

- Pre-built HRIS connectors (BambooHR via SCIM 2.0, one-way with HR as the master; Workday; others) plus a "Custom API Import" for any HRIS with REST and API-key or bearer auth. JumpCloud can then provision onward. [JumpCloud HRIS blog; JumpCloud BambooHR; Custom API import]

### 3.5 Open-source IGA

| Project | Fit | Status |
|---|---|---|
| **Evolveum midPoint** | Full IGA: authoritative "HR feed" resources (CSV), live sync and reconciliation, role mapping, then provision to targets through ConnId connectors, including SCIM and REST. | Very active (GitHub push 2026-10-02). Licence is EUPL/Apache dual per Evolveum (GitHub shows NOASSERTION; *unverified* exact terms). [midPoint HR feed exercise; CSV connector docs; GitHub] |
| **Apache Syncope** | IdM with pull and push tasks over ConnId connectors, and its own SCIM 2.0 REST API since 2.0.7. | Active (push 2026-10-02), Apache-2.0. [Syncope reference guide 4.x; Syncope CHANGES] |
| **ConnId** | Connector framework (Java) shared by midPoint and Syncope (CSV, DB, LDAP, AD, REST, SCIM bundles). | Active (Tirasa bundles pushed 2026-08). [GitHub Tirasa] |
| **OpenIAM** | Commercial/community IGA. | Not researched in depth (*unverified*). |
| **WSO2 Charon** | Java SCIM library used by WSO2 IS. | Active (push 2026-06). [GitHub wso2/charon] |

### 3.6 Keycloak (precise status)

- **Official Realm SCIM API:**
  - **26.6: experimental**, enabled with `--features=scim-api`. Base path `/realms/{realm}/scim/v2`. Users and Groups with POST/GET/PATCH/PUT/DELETE, filter and pagination, `/ServiceProviderConfig`, `/Schemas` and `/ResourceTypes`, core and Enterprise User schemas. Auth is OAuth 2.0 client credentials with admin RBAC. **Not supported: Bulk, password management, sorting, custom schemas; Groups only `displayName`/`members`.** [Keycloak blog 2026-04-10]
  - **26.7.0: preview** (flag still off by default). [Keycloak release notes]
  - **26.8.0: "promoted from preview to supported"** and enabled by default. Adds multivalued attributes, user-profile permissions, FGAP in filters and performance work. [Keycloak release notes]
  - One secondary source (WorkOS) says experimental shipped in 26.4. The Keycloak blog says 26.6, so treat 26.4 as wrong or *unverified*.
  - **It is inbound only.** Keycloak receives SCIM; it does not push SCIM to apps. [Keycloak blog; WorkOS summary]
- **Community extensions:**
  - `Captain-P-Goldfish/scim-for-keycloak`: README states **"has reached its end of life"** and points to the commercial scim-for-keycloak.de. Last push 2024-03. BSD-3. [GitHub]
  - `Metatavu/keycloak-scim-server`: SCIM server at realm and organisation level for Keycloak 26+. Apache-2.0, push 2026-09. [GitHub]
  - `mitodl/keycloak-scim`: **SCIM client** (Keycloak → apps via event listener). Apache-2.0, push 2026-09. [GitHub]
  - `suvera/keycloak-scim2-storage`: outbound. Last push 2024-09, no licence. [GitHub]
  - The "Suvera keycloak-scim" named in the brief resolves to this storage plugin.

### 3.7 Commercial unified HRIS APIs (brief)

- **Merge, Finch and Kombo** normalise dozens to hundreds of HRIS behind one REST "employees" model with sync-and-store plus webhooks. Finch says it covers 250+ employment platforms; Kombo says it has 120+ HRIS integrations with an EU focus. [Finch comparison blog; Kombo blog: both are vendor claims] They help with a **pull** strategy (one connector instead of N), at the cost of a third-party data processor holding HR PII.

---

## 4. Node/TypeScript building blocks and Strapi 5 hosting

### 4.1 Libraries (npm registry, checked 2026-10-03)

| Package | Latest / date | Licence | What it is | Notes |
|---|---|---|---|---|
| `scimmy` | 1.3.5 / 2025-03-05 | MIT | SCIM 2.0 schemas, resource types, filter parsing, PATCH, ListResponse/Error formatting; you supply ingress/egress/degress handlers | Repo pushed 2026-06; 71 stars. Framework-agnostic. Node ≥16. [npm; GitHub scimmyjs/scimmy] |
| `scimmy-routers` | 1.3.2 / 2025-01-22 | MIT | Express routers for SCIMMY | **Express, not Koa.** Strapi is Koa, so you would use `scimmy` directly in Koa controllers. Adapting is possible but *unverified*. [npm; GitHub] |
| `scim-patch` | 0.9.3 / 2026-09-06 | Unlicense | Applies RFC 7644 PATCH ops to a JSON resource | Active. [npm; GitHub thomaspoignant/scim-patch] |
| `scim2-parse-filter` | 0.3.0 / 2026-03-18 | Unlicense | RFC 7644 filter parser to AST, plus a filter-to-predicate helper | Active (repo push 2026-09). Translate the AST to Strapi `filters`. [npm; GitHub] |
| `scimgateway` | 6.2.10 / 2026-09-07 | MIT | Standalone SCIM gateway server with plugins (LDAP, MSSQL, Entra, API) | Separate process; contradicts "Strapi is the only boundary" unless it only calls Strapi. [npm; GitHub jelhub/scimgateway] |
| `scim-query-filter-parser` | 2.0.4 / 2020-01 | MIT | Filter parser | Stale. |
| Strapi SCIM plugin | — | — | **None found** (`strapi-plugin-scim` and `@strapi-community/plugin-scim` do not exist; npm text search for "strapi scim" returns nothing relevant). Third-party sources say Strapi itself has no SCIM. | [npm search; Stitchflow] |

### 4.2 Strapi 5 hosting mechanisms

- **Custom routes and controllers** in `src/api/<name>/routes` and `controllers`. A dedicated non-content-type API such as `src/api/scim/` can mount `/scim/v2/Users`.
  - Strapi prefixes content APIs with `/api` by default, so the URL would be `/api/scim/v2/...`. Hubs accept any base URL; Okta forbids underscores only. *Inference.*
  - Whether Strapi's `strapi::body` (koa-body) parses `application/scim+json` without configuration is *unverified*. Test it, or add the type to the body middleware config.
- **Document Service middleware:** `strapi.documents.use()` receives `{uid, action, params}`, and `next()` must be returned. [Strapi docs: Document Service middlewares] IdamBox's Keycloak middleware lives here and fires only on `create`/`update` of `IdamBoxUser` through the Document Service (`apps/backend/src/keycloak/register-idambox-user-provisioning.ts`). **Writes through `strapi.db.query()` bypass it.** That is a correctness trap for any bulk importer. *Inference from code plus docs.*
- **Cron:** `config/cron-tasks.ts`, enabled with `cron.enabled: true` in `config/server.ts`. Rules use a six-field cron format with `tz`, `start` and `end`. One timer per instance; **no multi-instance coordination is documented**, so you need your own lock if Strapi is scaled out. [Strapi docs: Cron] IdamBox has no `cron-tasks` file today.
- **Inbound client auth options:**
  - **Strapi API tokens:** read-only, full-access or custom (per-action scoping); expire after 7, 30 or 90 days or never; sent as `Authorization: Bearer`; shown once unless `encryptionKey` is set. [Strapi docs: API tokens] This matches Entra's "single long-lived bearer token" model.
  - **Keycloak client-credentials token** verified by the existing ADR 0004 verifier, with a service-account subject. *Inference;* note that Okta and Entra custom apps cannot easily do client credentials against a third-party authorisation server (Entra: secret token or Entra-issued token; Okta: OAuth authorisation code, Basic or header).

---

## 5. Testing and conformance

| Tool | What it does | Source |
|---|---|---|
| **Microsoft Entra SCIM Validator** (`scimvalidator.microsoft.com`) | Hosted; uses default attributes, discovers `/Schemas` or takes an uploaded schema. Fires create, filter, PATCH add/replace, duplicate create (expects 409) and `active:false`. | [Entra SCIM validator tutorial] |
| **Okta SCIM 2.0 spec tests** (BlazeMeter Runscope JSON test suites) | Okta-provided test definitions for SCIM 2.0 and 1.1. | [Okta SCIM prepare guide] |
| **`scim2-tester`** (Python, Apache-2.0, 0.5.0 on 2026-09-27) plus **`scim2-cli`** | RFC 7643/7644 checks (discovery, CRUD, PATCH) for CI. | [PyPI; readthedocs] |
| **`scimverify`** (npm 1.0.5 on 2025-10-22, GPL-3.0-only; hosted at verify.scim.dev) | SCIM verification tool. GPL, so run it as a dev tool only and don't bundle it. | [npm limosa-io/scimverify] |
| **Apache Directory SCIMple compliance-tests** | Java compliance module. | [mvnrepository SCIMple] |

---

## 6. Comparison of approaches

| Approach | Build effort in IdamBox | Standards compliance | Leaver handling | Fits "Strapi is the only production API boundary" |
|---|---|---|---|---|
| **A. SCIM 2.0 server in Strapi** (`/scim/v2/Users`, optionally `/Groups`) | Medium: routes, filter→Strapi translation, PATCH, schemas, auth, conformance tests | High (RFC 7643/7644 hub subset) | Good: `active:false` from Entra, Okta, IGAs; the hub owns HR timing | **Yes.** Strapi stays the boundary; Keycloak middleware unchanged |
| **B. CSV / initial-load importer in Strapi** (reuses the Phase 6 CSV pattern) | Low–medium | None (custom format) | Only if each file is a full snapshot (absent → deactivate) or carries an explicit status column | Yes |
| **C. Pull connector(s) in Strapi** (cron → Workday, SuccessFactors, BambooHR APIs or a unified API) | High per vendor; credential custody; effective-dated logic | Low (vendor APIs) | Good if termination and effective dates are modelled | Yes, but Strapi becomes an integration hub |
| **D. Keycloak native SCIM as the inbound target** | Low in Keycloak; **needs a reverse Keycloak→Strapi sync** | High | Good in Keycloak, but Strapi learns of it only through the reverse sync | **No.** It inverts ADR 0002 (Strapi writes Keycloak) and makes Keycloak the user master; experimental in 26.6 |
| **E. External IGA (midPoint/Syncope) → A** | Low in IdamBox (A is enough); high operationally (run an IGA) | High | Excellent (reconciliation, dates, role policies) | Yes (IGA is a client of Strapi SCIM) |
| **F. scimgateway in front of Strapi** | Medium | High at the edge | Good | Weak: a second API surface unless it only proxies to Strapi |
| **G. OIDC JIT only** | Very low | n/a | **None** | Yes, but fails JML |

---

## 7. Implications for IdamBox (inference, not cited fact)

### 7.1 Recommended architecture

1. **Single inbound contract: a SCIM 2.0 service provider in Strapi**, scoped to the hub subset in §3:
   - `GET/POST /Users`, `GET/PUT/PATCH/DELETE /Users/{id}`.
   - `filter` with `eq`/`and` on `userName`, `externalId`, `emails.value` and `enterprise:employeeNumber`.
   - Index pagination (add RFC 9865 cursors later).
   - `/ServiceProviderConfig` (with `bulk.supported=false`, `etag` optional), `/Schemas` and `/ResourceTypes`.
   - Groups deferred; see §7.4.
   - Build it with `scimmy` (schemas and formatting) or `scim-patch` plus `scim2-parse-filter` in Koa controllers under a dedicated `src/api/scim` module, calling a **domain upsert service** for `IdamBoxUser`. Never call `strapi.db.query` directly.
   - Any HR system reaches IdamBox through a hub (Entra, Okta, JumpCloud, midPoint) without bespoke connectors.
2. **Initial load and no-hub customers: a CSV importer on the same upsert service.** Reuse the Phase 6 admin CSV import pattern (`apps/backend/src/api/csrm-administration/services/csv-import.ts`), with:
   - dry-run (a diff report: create, update, deactivate, conflict);
   - an explicit mode, either "full snapshot (absent → deactivate)" or "delta";
   - a per-row result log.
   - Optionally accept a SCIM `BulkRequest` JSON body (the same shape Entra's `/bulkUpload` uses) so scripts can target either.
3. **Do not build vendor pull connectors in Strapi.** Recommend Entra API-driven inbound, Okta, or midPoint for customers who need Workday or SuccessFactors effective-dating, pre-hire and rehire logic. Those hubs already solve it (§2.2).
4. **DELETE semantics:** map SCIM `DELETE /Users/{id}` to **deactivate plus mark as source-deleted**, not a hard delete, consistent with "delete does not propagate; deactivate first". Microsoft explicitly expects apps to support both soft and hard delete. Also decide whether a later GET returns 404 or the inactive user. Entra expects the user to remain visible after `active=false`, and expects 404 only after a true delete.

### 7.2 Model gaps (needs a `docs/contract-gaps/` record before any schema change)

| Gap | Why | Candidate mapping |
|---|---|---|
| **Source correlation key** (`identitySourceId` / SCIM `externalId`) | Hubs send `externalId` and match on it; email is mutable and was rejected for linking (ADR 0004) | Unique per source, *not* `externalSubject` (that is Keycloak's `sub`) |
| **`employeeNumber`** | The default HR matching key (WorkerID → employeeID); needed for rehire logic | Enterprise extension `employeeNumber` |
| **Source attribution** (`identitySource`, `managedBy`: hr / manual / scim-client-x) | Attribute ownership: stops admins and HR overwriting each other, and stops SCIM from deactivating manually created break-glass users | Not in SCIM; IdamBox extension |
| **Lifecycle dates** (`startDate`, `endDate`, `lastSourceSyncAt`) | Pre-hire (create inactive until start), future-dated termination, audit | Custom extension (SCIM has none; Entra uses `employeeHireDate`/`employeeLeaveDateTime`) |
| **Manager** | Approval routing, Requestor context | Enterprise `manager.value`, which references another user's SCIM `id`, so it must resolve after both users exist |
| **Department / organisation / costCenter** | Possible future role rules and reporting | Enterprise extension |
| **SCIM resource `id` and `meta.version`** | Stable server id, plus ETag if offered | Could be Strapi `documentId`; `updatedAt` as a weak ETag |
| **JDL terminology** | Check `idambox-datamodel.jdl` for an existing term (for example "identity source") before naming new fields | Required by AGENTS.md |

### 7.3 Interaction with the blocking Keycloak middleware (ADR 0002)

- **Per record, the coupling is fine for SCIM push.** Hubs send one user per request and retry failures in later cycles. A Keycloak outage turns into 5xx responses, the hub retries, and its error rate may push the job into **quarantine** (Entra drops to daily cycles and disables the job after 4 weeks). So an outage of hours is tolerable; an outage of weeks is not. Return 503 (not 500) with `Retry-After` on Keycloak unavailability.
- **For bulk initial load (thousands of users):**
  - Each row costs a Keycloak create or update **inside a DB transaction**.
  - Never wrap the whole file in one transaction; one failure would roll back everything and hold locks for minutes.
  - Use one transaction per row, bounded concurrency (for example 5–10), and checkpoint/resume. The existing "adopt by email on the next attempt" behaviour makes reruns idempotent for Keycloak.
  - Expect throughput to be bounded by the Keycloak Admin API.
  - Benchmark before promising timings.
- **Leavers must not be blocked by Keycloak.** Under ADR 0002, a leaver's `accountStatus=inactive` write rolls back if Keycloak is down, so the person stays active in both systems. That is the worst failure mode for AC-2. Options for the product owner:
  - (a) accept it and rely on hub retries;
  - (b) amend ADR 0002 so *deactivation* commits in Strapi and Keycloak catches up through an outbox or reconciliation job, accepting a short Keycloak lag;
  - (c) additionally revoke Strapi-side access immediately: Strapi already maps `sub`→`externalSubject`→`accountStatus` on each request (ADR 0004), so an inactive Strapi record blocks API access even if the Keycloak account lingers. *Verify that the token verifier checks `accountStatus` on every request.*
- **Passwords:** SCIM pushes from HR hubs normally carry no password. The `password` field and Keycloak credential handling should be skipped for SCIM-sourced users (federated or SSO sign-in). Keycloak's own SCIM API also excludes password management.
- **Bypass risk:** any importer that writes through `strapi.db.query` skips the middleware and leaves users without Keycloak accounts. Add a test that enforces "all writes go through the Document Service".

### 7.4 Where roles fit

- **Birthright only for HR-sourced users.** Any active `IdamBoxUser` gets Requestor implicitly; that needs no SCIM roles.
- **Security Analyst stays explicit and IdamBox-managed.** Do **not** accept SCIM `roles` from hubs at first:
  - Entra doesn't support `entitlements` on Users.
  - The SCIM roles/entitlements draft has expired.
  - Accepting hub-pushed roles would let an external system grant analyst rights, bypassing IdamBox's Role → Function governance.
- **Later options:**
  - (i) SCIM `/Groups` mapped to IdamBox `Role` (hub group "CSRM Security Analysts" → Role), which needs a decision on who governs membership; or
  - (ii) server-side attribute rules (department = "Security" → propose a role for approval). This is advisory, like the AI-advisory principle.
- **Movers:** decide whether a department change revokes explicit roles automatically or flags them for review (ISO A.5.18 review).

### 7.5 Security notes

- Treat the SCIM client as a privileged principal with a dedicated Strapi API token (custom scope, limited to SCIM routes) or a dedicated Keycloak service-account client. Rotate it, and log every write with the client identity.
- Allow-list source IPs where the hub publishes them (Entra `AzureActiveDirectory` service tag).
- Enforce that SCIM can only touch users whose `identitySource` belongs to that client. This prevents one hub from deactivating another source's users or manual administrators.

### 7.6 Open questions for the product owner

1. Which hubs must be supported at launch: Entra, Okta, JumpCloud, midPoint, or "CSV only"?
2. What is the correlation key: HR employee number, hub `externalId`, or both (with precedence)? What happens on rehire with a new id?
3. Pre-hire policy: create inactive on HR entry and activate on start date, or create only on start date?
4. Leaver latency target (hours?), and whether deactivation may commit in Strapi before Keycloak (ADR 0002 amendment).
5. SCIM `DELETE`: deactivate, or hard delete after a retention period? GDPR erasure path?
6. Attribute ownership: which fields does HR own (names, email, status), and which are IdamBox-owned (roles, username?)? Can admins override HR-owned fields?
7. Are manually created users (break-glass administrators, contractors not in HR) exempt from snapshot deactivation?
8. Should hub-pushed groups ever grant Security Analyst, or is that always an in-app decision?
9. Will Strapi run multiple instances? That affects cron-based reconciliation locking.
10. Does IdamBox upgrade to Keycloak 26.8 (SCIM supported)? It doesn't change the recommendation, but it removes "experimental" from any Keycloak-side SCIM discussion.

---

## Sources

**IETF / standards**
- RFC 7642: https://www.rfc-editor.org/rfc/rfc7642
- RFC 7643: https://www.rfc-editor.org/rfc/rfc7643
- RFC 7644: https://www.rfc-editor.org/rfc/rfc7644
- RFC 8417: https://www.rfc-editor.org/rfc/rfc8417
- RFC 9865: https://www.rfc-editor.org/info/rfc9865
- RFC 9967: https://www.rfc-editor.org/info/rfc9967
- IETF SCIM WG documents: https://datatracker.ietf.org/group/scim/documents/
- draft-ietf-scim-roles-entitlements: https://datatracker.ietf.org/doc/draft-ietf-scim-roles-entitlements/
- WorkOS on the agent draft (secondary): https://workos.com/blog/scim-agentic-identity-one-year-later
- OpenID SSF/CAEP/RISC Final announcement (secondary coverage): https://sgnl.ai/2025/09/sgnl-welcomes-the-publication-of-the-final-shared-signals-and-caep-specifications/ ; https://biometricupdate.com/202509/openid-approves-3-standards-for-sharing-real-time-digital-identity-security-signals ; specs index: https://openid.net/specs/
- OpenID Connect Core 1.0: https://openid.net/specs/openid-connect-core-1_0.html
- HR Open Standards: https://www.hropenstandards.org/ ; https://github.com/HROpen/APISpecifications
- NIST SP 800-53 Rev. 5: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final ; AC-2 summary: https://www.stigviewer.com/controls/nist-800-53/AC-2
- ISO/IEC 27001:2022 A.5.16 summary: https://www.isms.online/iso-27001/annex-a-2022/5-16-identity-management-2022/

**Microsoft Entra**
- API-driven inbound concepts: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/inbound-provisioning-api-concepts
- API-driven inbound FAQ: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/inbound-provisioning-api-faqs
- Develop a SCIM endpoint (requirements): https://learn.microsoft.com/en-us/entra/identity/app-provisioning/use-scim-to-provision-users-and-groups
- How provisioning works: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/how-provisioning-works
- Plan cloud HR provisioning: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/plan-cloud-hr-provision
- Workday integration reference: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/workday-integration-reference
- SCIM Validator tutorial: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/scim-validator-tutorial ; tool: https://scimvalidator.microsoft.com/

**Okta, Google, JumpCloud**
- Okta SCIM prepare: https://developer.okta.com/docs/guides/scim-provisioning-integration-prepare/main/
- Okta SCIM 2.0 reference: https://developer.okta.com/docs/api/openapi/okta-scim/guides/scim-20/
- Okta HR-driven IT provisioning: https://www.okta.com/solutions/hr-driven-it-provisioning/
- Google Workspace inbound SCIM GA: https://workspaceupdates.googleblog.com/2026/07/streamline-identity-lifecycle-management-in-Google-Workspace-with-new-inbound-SCIM-support.html
- JumpCloud HRIS: https://jumpcloud.com/blog/how-jumpclouds-hris-integration-works ; https://jumpcloud.com/support/integrate-with-bamboohr ; https://jumpcloud.com/support/import-users-with-a-custom-api-integration

**Keycloak**
- SCIM as experimental (2026-04-10): https://www.keycloak.org/2026/04/scim-as-experimental-feature
- Release notes (26.7 preview, 26.8 supported): https://www.keycloak.org/docs/latest/release_notes/index.html
- WorkOS summary (secondary): https://workos.com/blog/keycloak-experimental-scim-api-vs-workos-directory-sync
- Captain-P-Goldfish/scim-for-keycloak (EOL): https://github.com/Captain-P-Goldfish/scim-for-keycloak
- Metatavu/keycloak-scim-server: https://github.com/Metatavu/keycloak-scim-server
- mitodl/keycloak-scim (client): https://github.com/mitodl/keycloak-scim
- suvera/keycloak-scim2-storage: https://github.com/suvera/keycloak-scim2-storage

**IGA**
- midPoint HR feed exercise: https://docs.evolveum.com/midpoint/exercises/01-hr-feed
- midPoint CSV connector: https://docs.evolveum.com/connectors/connectors/com.evolveum.polygon.csvfile.CSVFileConnector
- midPoint repo: https://github.com/Evolveum/midpoint
- Apache Syncope reference guide 4.1: https://syncope.apache.org/docs/4.1/reference-guide.pdf ; repo: https://github.com/apache/syncope
- ConnId bundles (Tirasa): https://github.com/Tirasa/ConnIdDBBundle
- WSO2 Charon: https://github.com/wso2/charon

**Unified HRIS APIs (vendor claims)**
- Finch comparison: https://tryfinch.com/blog/best-unified-apis-hris-payroll
- Kombo: https://kombo.dev/blog/best-unified-api-platforms-for-hr-tech-2026
- Merge: https://www.merge.dev/ (not fetched; *unverified* details)

**Node / Strapi**
- scimmy: https://www.npmjs.com/package/scimmy ; https://github.com/scimmyjs/scimmy
- scimmy-routers: https://www.npmjs.com/package/scimmy-routers
- scim-patch: https://www.npmjs.com/package/scim-patch ; https://github.com/thomaspoignant/scim-patch
- scim2-parse-filter: https://www.npmjs.com/package/scim2-parse-filter
- scimgateway: https://www.npmjs.com/package/scimgateway ; https://github.com/jelhub/scimgateway
- Strapi SCIM absence (third-party): https://www.stitchflow.com/scim/strapi
- Strapi cron: https://docs.strapi.io/cms/configurations/cron
- Strapi Document Service middlewares: https://docs.strapi.io/cms/api/document-service/middlewares
- Strapi API tokens: https://docs.strapi.io/cms/features/api-tokens

**Conformance**
- scim2-tester: https://pypi.org/project/scim2-tester/ ; https://scim2-tester.readthedocs.io/
- scim2-cli: https://scim2-cli.readthedocs.io/
- scimverify: https://www.npmjs.com/package/scimverify ; https://verify.scim.dev
- Apache Directory SCIMple: https://badges.mvnrepository.com/artifact/org.apache.directory.scimple

# Phase 3: Strapi SCIM 2.0 service — Research

**Researched:** 2026-10-15
**Domain:** Source-scoped SCIM transport, token administration, connector interoperability and immediate access refusal
**Confidence:** MEDIUM overall; implementation recommendations grounded in inspected source, external documentation cited separately.

<user_constraints>
## User Constraints (from CONTEXT.md)

DATA_8f47b6a1_START
## Implementation Decisions

### Frozen model and reuse

- **P3-01:** No content-type schema, generated content-type declaration, physical model/index or frozen JDL change in Phase 3. The approved contract-gap record and landed Phase 2 schemas are the baseline, including sourceIdentityKey and the outbox fencing fields. Record any newly discovered model gap separately; do not resolve it by silently extending the schema. Existing source timestamps and token fields suffice for this phase.
- **P3-02:** Place transport logic in apps/backend/src/iam/scim/, with thin Strapi handlers/policies and shared typed wire validation/mapping. All IdamBoxUser writes call createIdentityService's createFromSource, replaceFromSource, patchFromSource or deactivateFromSource; reads call readForSource/listForSource. Preserve private SourcePrincipal construction, exact operation/field capabilities, database user locking and Document Service-only mutation enforcement. Do not duplicate ownership checks in an alternate writer. Narrow extensions to the service's filter or projection contracts are allowed without model changes and require regression tests.

### Mounting, authentication and wire boundary

- **P3-03:** Mount custom API operations exactly at /scim/v2, alongside unchanged /api CSRM routes. Pinned Strapi 5.51.0 auto-loads src/api routers as content-api and consequently prefixes them with /api; adding prefix: /scim/v2 there is insufficient. Register a root router once from backend bootstrap through strapi.server.routes({ prefix: '/scim/v2', routes: [...] }), omitting the routing object's type so it uses the root route manager. Use function handlers or fully qualified handlers and explicit policies. Keep the route manifest in the SCIM module and expose it to the mounted-route inventory. Do not change api.rest.prefix, rewrite URLs in middleware, mount an independent server or create a frontend facade. Tests must prove each method/path has exactly one root layer and that /api/scim/v2 aliases are absent. This registration choice follows the installed runtime's server/index, register-routes and routing code; it is not an assumption that a content-api prefix escapes /api.
- **P3-04:** Every mounted SCIM operation, including discovery, empty Groups reads and explicit unsupported writes, has config.auth=false and an explicit source-bearer policy. This bypasses only Strapi's default JWT/API-token strategy. The policy requires Authorization: Bearer <token>, verifies the digest, resolves the existing SourcePrincipal, then freshly checks the operation's METHOD:/scim/v2/... FunctionApi through its Identity Provisioning Function and Role. Check active source, bound active protected manual service user, absent password/subject, unique binding and active idambox-iam Application using Phase 2 validation on every request. Missing/invalid/revoked tokens or invalid source/service invariants return identical 401 with WWW-Authenticate: Bearer; a valid source lacking the operation grant receives 403. No principal or grant cache across requests.
- **P3-05:** Source authority is carried in a separate server-created SCIM context. Never populate or accept CSRM idamboxUser identity as source authentication. x-csrm-dev-identity, x-csrm-identity-token, a CSRM API token and a human Keycloak token cannot authenticate SCIM; tests cover each alone, forged source headers and combinations. An unrelated development identity must not widen an otherwise valid source token's scope. Existing CSRM policies continue refusing registered source service identities and existing people retain their grants.
- **P3-06:** Emit application/scim+json for every nonempty SCIM success or error response, with SCIM resources/envelopes directly, never Strapi data/attributes wrappers. Configure the existing body parser to recognize application/scim+json; also accept application/json as a JSON compatibility input. Reject unsupported request media types with 415 and an incompatible Accept with 406. DELETE 204 has no body. Add a SCIM-scoped outer error/log boundary before body parsing so malformed JSON, body-limit errors, policy failures, throttling and unexpected exceptions all serialize safely. Keep existing CSRM parser behavior and limits unchanged; SCIM bodies are bounded to 1 MiB and PATCH to 100 operations.
- **P3-07:** Errors use schemas=['urn:ietf:params:scim:api:messages:2.0:Error'], status as a decimal string, safe detail, and scimType only when defined by SCIM. Map invalidInput/malformed values to 400 invalidValue (syntax failures invalidSyntax), invalid filter to 400 invalidFilter, unknown PATCH paths to 400 invalidPath, unmatched PATCH selection to 400 noTarget, prohibited writes/immutableSourceKey to 400 mutability, uniqueness to 409 uniqueness, hidden/missing target to 404, authenticated authorization failure to 403, unsupported Group writes to 501 and unexpected server failures to 500. keycloakUnavailable maps to 503 with Retry-After: 30, without scimType or a remote body. Do not expose SQL, constraint names, ownership, credentials, request bodies or internal exceptions. Transport must distinguish PATCH path errors before the closed identity outcome mapping.

### Token lifecycle and development handoff

- **P3-08:** Token format is idb_scim_v1.<sourceDocumentId>.<secret>, where sourceDocumentId is the persisted 24-character documentId and secret is 32 cryptographically random bytes encoded as unpadded base64url (43 characters). The source component is a lookup hint only, never authority. Store tokenHash as sha256:<64 lowercase hex characters>, SHA-256 over the entire exact UTF-8 token; no plaintext, recoverable encryption or token fragment in the database. A random 256-bit credential supports this fixed-length digest design without password hashing. Parse lengths/alphabet before lookup, decode stored/candidate digests to equal-length 32-byte buffers and use node:crypto timingSafeEqual; never compare digests with string equality. Missing source/hash uses a dummy digest comparison before the same 401. Rate limiting and generic responses remain required; do not claim constant network latency.
- **P3-09:** Add scim:token to apps/backend/package.json with interface pnpm --dir apps/backend scim:token <source> [issue|rotate|revoke] [--write-dev-env]. Omitted action means issue if tokenHash is null and rotate otherwise. Resolve <source> by exact documentId or exact unique name, refusing ambiguous/missing targets. Issue requires null hash; rotate requires a current hash; revoke clears it and is idempotent. Issue/rotate require a valid active source service binding; revoke must still be available for an inactive source or broken service grant. Update only tokenHash and tokenRotatedAt atomically through Document Service, under a serialized source-row lock/transaction; concurrent rotations cannot leave two valid tokens. The previous token is invalid for the next request after commit; no overlap/grace period. Do not promise cancellation of already authorized in-flight work. tokenRotatedAt records issuance, rotation and revocation in UTC. Never repair roles, status or bindings as a side effect.
- **P3-10:** CLI boots the existing backend configuration without listening, preserves registration/seed invariants, closes it in finally and prints a newly issued token exactly once after commit. Revoke prints a nonsecret confirmation. Keep credentials out of arguments, errors, shell tracing and logs. Development seed still creates no token and never rotates one on restart. --write-dev-env is accepted only in development for the exact registered midPoint (dev) source: atomically upsert MIDPOINT_SCIM_TOKEN in git-ignored docker/.env, preserve unrelated settings, restrict permissions to the owner, refuse a symlink/tracked destination, and never print the file. Add only an empty placeholder to docker/.env.example during implementation. On export failure report a safe failure and revoke the just-issued credential rather than claim a successful delivery. Without this option an operator may copy the one-time output into that key. This opt-in file export is the concrete dev delivery path; no token is written during this discussion. Phase 4's durable resource-secret injection remains separate; Phase 3's live gate consumes the local variable without committing expanded resource XML.

### D19 mapping and source ownership

- **P3-11:** Fixed inbound/outbound mapping, with no configurable Strapi source mappings:

| SCIM attribute | Internal field / rule |
| --- | --- |
| id | Stable Strapi documentId; server-issued, never numeric database id. |
| userName | username. |
| emails primary value | email; exactly one primary if marked; otherwise exactly one value. Ambiguous multiple unmarked primaries/values fail 400 invalidValue. Persist the selected primary only and return one primary email; do not claim storage of secondary addresses. |
| name.givenName / name.familyName | firstName / lastName. |
| displayName | displayName; if absent/blank derive from trimmed nonblank givenName and familyName joined with one space, then userName when both are absent. |
| active | accountStatus active/inactive; omitted on POST or full PUT defaults true; nonboolean is invalid. |
| externalId | sourceExternalId, exact opaque case-sensitive text, required on POST and full PUT. The reference engine sends HR employeeNumber here. |
| urn:ietf:params:scim:schemas:extension:enterprise:2.0:User.employeeNumber | employeeNumber, matching data rather than an ownership key. |
| Same Enterprise extension's department | department. |
| title | jobTitle. |

POST/PUT require schemas containing the Core User URN and include the Enterprise URN when that extension is present; reject unsupported schema URNs or mismatched resource shapes with 400 invalidValue. PATCH requires the PatchOp message URN. Reference CSV preferredName feeds displayName in the engine; givenName/familyName feed name; username/email retain their corresponding attributes. status and startDate/endDate drive active in midPoint, and dates are not stored in Strapi. Do not confuse sourceExternalId with externalSubject. Advertise Core User and Enterprise User schemas; Enterprise extension is optional for the resource, with only the supported fields described. Group discovery uses the standard Group schema. Omit unassigned optional values on output, omit externalId for manual correlation candidates, and emit meta.resourceType and a correctly rooted meta.location/Location. Do not advertise ETag/version support or invent timestamps unavailable in the Phase 2 projection.
- **P3-12:** POST validates a complete mapped DTO and calls createFromSource. Return 201, Location and the mapped user. Start explicit roles=[]; Requestor comes from existing birthright authorization and is not a persisted source grant. Never accept roles, protected, externalSubject, password, identitySource, sourceIdentityKey, sourceDeletedAt or lastSyncedAt as writable source attributes. Read-only id/meta may be echoed on PUT and ignored only after id consistency validation; attempts at IdamBox-owned write fields fail 400 mutability. Unknown unsupported writable attributes fail 400 invalidPath rather than being persisted. Return no private field or populated relation.
- **P3-13:** Full PUT is replacement of supported source-owned fields, through parseSourceIdentityInput(..., 'replace') and replaceFromSource. Require userName, selected email and externalId; derive displayName and default active as above. Omitted optional name parts, employeeNumber, department and title explicitly clear to null. It never clears or replaces IdamBox Roles, protection, Keycloak subject/password or ownership fields. Return 200 and the replaced representation. An explicit manual documentId plus externalId is the existing confirmed-claim signal; only PUT can claim. Strapi trusts upstream confirmation, with the actual operator correlation proof left in Phase 4. POST/PATCH/DELETE never claim; no email-based implicit adoption or extra claim header.
- **P3-14:** PATCH accepts the standard PatchOp schema, a nonempty Operations array and add/remove/replace in any letter case. Normalize supported attribute and subattribute names case-insensitively, preserve string values and externalId exactly, and process operations in order against the allowlisted current source projection. Support pathless add/replace object values, name subattributes, Enterprise fields, emails and emails[primary eq true].value / emails[value eq "..."] selections, including connector lowercase operations. Filtered email selectors are PATCH-path syntax, not an extension to list-filter grammar. Resolve the batch into one validated DTO delta and one patchFromSource transaction; any operation failure leaves the entire batch unchanged. No intermediate writes or side effects. Serialize the deciding read and final patch under the existing shared user lock to avoid overwriting concurrent deltas. Removing an optional field clears it; removing a required username/email/source key or setting an immutable key differently fails. Missing selected email targets yield noTarget; add on an existing supported single-valued attribute replaces its value. Return 200 with the resulting user. Multi-value email operations must reduce unambiguously to the single primary-email projection; reject unrepresentable results rather than add an email collection or silently change unrelated data.
- **P3-15:** Preserve Phase 2 visibility before filtering, totals or pagination: own nonprotected, nontombstoned users and unowned unprotected manual candidates only. Foreign, protected and tombstoned targets give indistinguishable 404 on direct access/mutation. No counts leak them. A source tuple remains immutable and uniquely reserved after deactivation/deletion. Duplicate username, email or source tuple returns 409 uniqueness after rollback; concurrent writes rely on existing database constraints, not a preflight lookup. Never adopt a record following a digest collision.

### Filters, pagination, discovery and deletion

- **P3-16:** List grammar is a comparison followed by zero or more 'and' comparisons: attrPath eq JSON-string, with whitespace, case-insensitive attribute/operator spelling and proper JSON string escaping. Supported paths only: userName, externalId, emails.value and the fully qualified Enterprise employeeNumber path (also accept employeeNumber as its unambiguous shorthand for the connector). Reject or/not, other operators, parentheses, value-path brackets, sort requests disguised as filters, unsupported paths, nonstring literals, malformed/trailing input and oversized input with 400 invalidFilter. Bound filter text to 4096 characters, terms to 20 and each decoded value to 255 characters. Never pass caller query structures to Strapi. Compile only to the service's typed eq/and form. externalId matching remains exact/case-sensitive. Other string comparisons honor SCIM caseExact=false through a narrowly extended allowlisted internal case-insensitive equality option, rather than silently using Phase 2's current $eq for every field. This is a service/query extension, not a model change.
- **P3-17:** startIndex is one-based, default 1, and values below 1 normalize to 1. count defaults 100, negative count normalizes to 0, maximum effective count 500; require safe integer syntax and reject repeated/malformed pagination parameters with 400 invalidValue. Translate to start=startIndex-1 and limit=count in listForSource, preserving deterministic id:asc ordering. count=0 returns totalResults and no Resources. Beyond the end returns an empty page. ListResponse has the standard schemas URN, totalResults after visibility/filtering, startIndex and itemsPerPage equal to returned length. Support attributes/excludedAttributes as allowlisted SCIM response projections, retaining always-returned id and schemas and never broadening the safe service projection. Validate paths case-insensitively; reject unknown/private paths and combining both projection parameters with 400 invalidValue. Reject unsupported query keys such as sortBy/sortOrder with a safe 400; sorting support is not advertised. An absent filter lists all visible users; an empty supplied filter is invalidFilter.
- **P3-18:** ServiceProviderConfig advertises patch and filter supported (filter.maxResults=500); bulk, changePassword, sort and etag unsupported; authenticationSchemes describes bearer tokens. Schemas collection/resource reads expose the supported Core User, Enterprise User and standard Group schema descriptors; ResourceTypes collection/resource reads list User and Group, correct /Users and /Groups endpoints and User's Enterprise extension. Unknown schema/resource-type ids return 404. GET /Groups returns empty ListResponse; GET /Groups/{id} returns 404. All mounted Group writes return 501 SCIM errors after authentication, authorization and throttling; they never grant roles. The connector connection test itself is known to call ResourceTypes only. Prove Schemas and ServiceProviderConfig separately with authenticated HTTP assertions, and do not describe those assertions as observed connector calls.
- **P3-19:** PUT/PATCH active=false uses the existing source mutation transaction and unconditional ownership/leaver middleware, including any HR field updates in the same request. Existing-user deactivation commits with durable outbox work and no synchronous Keycloak call. Creates, mirrored active updates and reactivation retain blocking Keycloak behavior; failure is 503 Retry-After: 30 and the write/claim rolls back. Preserve roles-only/nonmirrored skips, worker fencing and provisioning-off queue semantics. Do not route an inactive create through the asynchronous existing-user path.
- **P3-20:** DELETE calls deactivateFromSource(principal, id, true), returns 204, and sets inactive and first sourceDeletedAt without removing the record. Later GET/list omit it and direct GET/PUT/PATCH give 404. Repeated DELETE by the owning source retains Phase 2's idempotent 204 behavior and original tombstone time; foreign/protected/manual targets remain 404. No restore or unclaim. Verify source tuple, roles, subject and existing request/risk/owner references survive; deletion cannot be implemented by a raw or Document Service delete.

### Rate limiting, logs and timestamps

- **P3-21:** Apply throttling to the whole /scim/v2 namespace, discovery/errors included. Defaults (amended by the orchestrator at review, see P3-32): 1200 requests per 60-second window per client IP before authentication and 600 per 60 seconds per authenticated source across all operations, each overridable by a positive-integer backend environment setting validated at startup. Use ctx.ip with existing trusted-proxy rules, never an arbitrary forwarded header or bearer token as a key. Return 429 SCIM Error and integer Retry-After until the window resets. Cap live IP buckets at 10,000 and source buckets at 1,000, expire them after the window, and refuse new buckets with 429 while at capacity instead of evicting active limits. Bounded in-process buckets with expiry suffice for the reference single-instance host; authenticate and revalidate each accepted request. Document per-instance scope explicitly; multi-instance production must enforce the same aggregate limits at a shared ingress/store before deployment. No new persistence schema or unneeded dependency. Tests use an injected clock, exercise both limits and source isolation, and prove bounded bucket cleanup/capacity refusal rather than unbounded attacker-controlled maps.
- **P3-22:** One canonical structured SCIM request log line from an outer try/finally boundary for every request, including discovery, refused credentials, validation, throttling, 501, 404 and unexpected errors. Fields: event=scim.request, source=verified source documentId or null, operation=method plus route template, target=validated target documentId/schema id or null, outcome=closed safe outcome, status and requestId. Do not log token/hashes, headers, raw URLs/queries, personal attributes, bodies, remote errors or attacker text. A source hint in an invalid token is never logged as an authenticated source. Do not count Phase 2's separate IAM identity mutation event as another SCIM request event; retain that internal audit, with distinct event classification. For pre-route failures use a safe namespace operation label. Token administration has a separate safe lifecycle event, not a synthetic SCIM request.
- **P3-23:** lastActivityAt updates on a bearer-authenticated request with valid current source/service binding, including discovery and requests later refused for operation grant, bad payload, not-found or source throttling. It does not update for invalid credentials or pre-auth IP rejection. Persist through Document Service independently of user mutation rollback; a failure to persist activity fails the request safely with 500 and logs failure, never silently claiming activity was recorded. lastSyncedAt remains exclusively the existing identity service's timestamp for an accepted source mutation, including idempotent PUT/PATCH/DELETE replay. Reads, bad writes, rolled-back blocking writes and token lifecycle operations do not update lastSyncedAt; CLI issue/rotate/revoke changes tokenRotatedAt only.

### Catalogue and OpenAPI compatibility

- **P3-24:** Serve all 21 existing reservations, preserving function.identity_provisioning.api.api.01 through .21 and their urls/Function linkage in both catalogue copies. Specifically: .01-.06 Users collection GET/POST and resource GET/PUT/PATCH/DELETE; .07 ServiceProviderConfig GET; .08-.09 Schemas collection/resource GET; .10-.11 ResourceTypes collection/resource GET; .12-.13 Groups collection/resource GET; .14-.17 Groups collection POST/PUT/PATCH/DELETE; .18-.21 Groups resource POST/PUT/PATCH/DELETE. The Group writes are deliberately mounted 501 responders and Group resource GET is a mounted 404 responder, all authenticated and catalogued. Update reservation descriptions in both byte-identical copies to actual behavior, including explicit unsupported Groups semantics. Add no existing human-role grants, menu entries or Application reassignment. Remove only these entries' Phase 3 unserved reasons and regenerate docs/references/served-operations.json from real mounted routes; never hand-edit it to assert service.
- **P3-25:** Extend docs/references/specification.json additively with all 21 operations, unique SCIM operationIds, SCIM wire schemas, query parameters, media types, headers, errors and source-bearer security scheme. Existing contract paths are relative to the /api base (e.g. /v1/me/access); add /scim/v2/... paths with per-operation servers:[{url:'/'}] so generated clients resolve the actual root SCIM paths. Explicitly teach inventory/contract normalization that SCIM paths use this root server rather than prepend /api. Never globally change servers or existing operation security/response schemas. Describe the limited primary-email projection, eq/and subset, exact immutable externalId, PUT omission semantics, claim trust boundary, Groups limitations and 503 Retry-After. Verify existing CSRM operationIds, schemas and grants remain compatible. Run pnpm --dir apps/csrm api:check; if the additive shared contract changes generated client output, use the existing regeneration discipline with a backward-compatible diff, without adding SCIM calls to CSRM.

### Evidence, replay and immediate refusal

- **P3-26:** Until a genuine lifecycle capture exists, plans MUST contain an explicit orchestrator-run live capture step after the real SCIM service is mounted. Use the existing pinned midPoint 4.8.14 / Provision IAM connector 1.2.9 and host.docker.internal:1337/scim/v2 with the real dev source token. Phase 1's stub ResourceTypes trace proves discovery only. Direct curl/test-client requests and authored examples may test conformance but must never be labelled captured connector fixtures. A missing capture blocks PROV-08 and Phase 3 completion; it is not waived by a green synthetic suite. This discussion has captured no requests and claims no runtime gate result.
- **P3-27:** Put the scripted live gate under docker/midpoint/e2e/. The orchestrator runs a temporary real midPoint SCIM resource against isolated gate-owned Strapi data and triggers connection test, lookup, create, read/list/filter/page, full PUT mover, multi-value PATCH, active=false and DELETE operations through the connector. Trigger a connector operation explicitly when normal mapping would not emit it; record the invocation and distinguish extra direct HTTP conformance probes. Capture ordered method, relative path/query, allowlisted content headers, JSON body, response status, safe headers and JSON response. Strip Authorization, cookies, credentials and tokens BEFORE writing evidence. Parameterize dynamic resource ids, user ids and timestamps with a documented stable substitution map; use controlled fictitious people. Preserve actual operation spelling/order and payload shapes. Record runtime versions, sanitized run command, date, connector source commit, scenarios and observed results in phase evidence. Cleanup gate resources and preserve existing developer data. Read the token from the ignored env file without echoing it or writing expanded resource XML into tracked objects.
- **P3-28:** Store sanitized connector lifecycle fixtures under apps/backend/tests/fixtures/iam-scim/ with provenance and replay them against real Strapi HTTP routes in ordinary backend tests. Supply newly issued test credentials in memory, map created ids from actual Location/body responses, assert mapped persistence and source isolation as well as response shape/order. Allow variation only in declared dynamic values. Separate captured scenarios from authored negative/conformance cases; if an expected connector operation is absent, record that fact and perform another real capture or keep the gate pending. CI runs these fixtures without Docker/midPoint. Re-capture when Phase 4 configuration changes requests. Phase 4 may start in parallel only after discovery, mapping, error semantics and this captured sequence are fixed, as the roadmap requires.
- **P3-29:** LIFE-01 requires an active sourced human with an existing, still-valid Keycloak session/token: prove successful /api/v1/me/access and an authorized CSRM data request, deactivate through the real SCIM route, then repeat immediately with the same human token and CSRM API token. Both Strapi calls must return ordinary 403 on the next request while the source token still works. Cover PUT and PATCH deactivation; DELETE additionally covers LIFE-03. Exercise an outage with provisioning enabled only in the isolated runtime and show inactive commit/outbox pending and immediate refusal before worker recovery or token expiry. Reuse Phase 2's fake Keycloak HTTP harness for automated refusal tests and live gate infrastructure for the local proof; do not substitute a direct database status edit for SCIM.
- **P3-30:** Also prove CSRM refusal with the existing OIDC session and a fresh protected-page navigation/reload after SCIM deactivation: the typed transport forwards the same identity token, /v1/me/access fails, capabilities collapse and the protected layout renders its existing access-unavailable/permission-denied state without protected content. Attempt a direct detail URL and a write/server action to prove server-side denial, not merely hidden navigation. Use isolated runtime OIDC/verification flags for this local browser proof, with evidence at desktop and mobile widths; do not depend on the development adapter's fixed fixture capabilities as production proof. No promise of pushing an update into an already rendered browser without another request. Existing OidcSessionAdapter, typed client and app layout should provide this behavior; any required repair stays limited to this refusal journey and follows apps/csrm/AGENTS.md. New-user password setup and the full CSV sign-in journey stay Phase 5.
- **P3-31:** Completion evidence must map all eight requirement ids to the five roadmap success criteria: criterion 1 token lifecycle/dev delivery (MODEL-02); criterion 2 real connector discovery plus independent schema/config probes (PROV-04); criterion 3 create/read/filter/page/replace/patch, roles, uniqueness and outage (PROV-01/02/03); criterion 4 immediate API/browser refusal and retained deletion references (LIFE-01/03); criterion 5 genuine capture/replay, throttling, one request log, timestamps, catalogue/contract and regression suite (PROV-08 plus cross-cutting D15/D21). Run pnpm --dir apps/backend test and the relevant CSRM refusal/contract checks. Phase 2's final gate is green (1803 tests, zero failures, one Windows platform skip); do not use historical intermediate failures as a waiver. Before execution reconcile latest shared-backend changes and rerun plan checks. Keep IDAMBOX_KEYCLOAK_PROVISIONING, IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION and CSRM_AUTH_OIDC_ENABLED false in committed configuration; enable only isolated runtime gates. No secrets, binaries or attribution trailers in added files or commit messages.

### Orchestrator review amendments

- **P3-32:** P3-21's first defaults (300 per IP, 120 per source per minute) were raised at review. The connector sends a GET before every full PUT, and midPoint's single host shares one client IP, so a nightly reconciliation of the reference CSV at 120 per minute would hit 429 and turn into the retry storm the brief's section 8 warns about. Limits are configurable; Phase 4 measures the first full reconciliation and records whether the defaults need to change. The limiter still bounds a compromised token's write rate.

### Delegated discretion

All gray areas were delegated explicitly. The decisions above lock externally visible behavior and evidence gates. Internal file splits and reuse of existing validation/test helpers remain implementation choices; they cannot weaken ownership, change the model, replace genuine connector evidence or expand the phase. No operator schema approval is inferred: the existing Phase 2 approval is the only schema baseline.

## Deferred Ideas

Phase 4 owns persistent HR/resource mappings, operator-confirmed correlation cases, five-minute/nightly scheduling, pending-operation recovery and the combined audit proof. Phase 5 owns sourced-user password email and the full CSV joiner-to-sign-in journey. Source badges/read-only HR UI and a product change log remain CSRM handoffs. Multi-address persistence, Group membership governance, restoration/unclaim, additional HR fields, source administration screens and new model changes are outside this phase. Multi-instance aggregate throttling is a deployment requirement, not a claim about an in-process limiter.
DATA_8f47b6a1_END
</user_constraints>

## Project Constraints (from AGENTS.md)

[CITED: AGENTS.md; .planning/PROJECT.md] Use the project brief, shared OpenAPI contract, frozen JDL terminology, capability catalogue and adopted design direction as authorities. Keep Strapi the production API boundary; Keycloak authenticates and Strapi enforces Role → Function → FunctionAPI plus record scope. Requestor is implicit; Security Analyst is explicit. Assessment release remains a human-authorized workflow. Preserve existing restricted-record isolation.

[CITED: AGENTS.md] Use strict TypeScript, feature-oriented modules, shared input validation and automated tests for material workflows. For any narrowly necessary CSRM repair, use App Router, Server Components by default, existing shadcn/ui primitives, semantic tokens and accessible mobile/desktop layouts. Keep business logic outside JSX and API calls inside the typed API layer. Navigation visibility never grants access. Add no dependency without a concrete reason; favor clarity. Commit no secrets, move no dependency directories and merge no nested backend history.

[CITED: .planning/PROJECT.md; .planning/workstreams/iam/PROJECT.md] IAM owns platform work under the existing workstream and shared backend; preserve other workstreams' endpoints/grants. Reconcile latest shared-backend changes and rerun plan checking before execution. Use portable repository-relative paths and no checkout/branch names in artifacts. Issues use the existing issue-tracker and triage conventions; domain records use the single root context plus ADRs. This phase changes no content types, declarations, indexes or JDL. Keep all three activation flags false in committed configuration. Final backend suite is mandatory; changed shared contract requires CSRM contract generation checks and its typecheck/tests.

## Summary

[CITED: 03-CONTEXT.md P3-01–P3-32] Build a narrow SCIM adapter around Phase 2's identity service. Deliver root routes, fresh source authentication and exact operation grants first; prove a production HTTP create/read tracer before expanding replacement, PATCH and queries. Keep the token administration path separate from user identity mutation and keep request activity outside user rollback.

[CITED: 03-CONTEXT.md P3-26–P3-31] Connector capture is an execution gate. Implement capture tooling, then have the orchestrator run the real stack and write sanitized evidence; only the following plan can create captured lifecycle fixtures and their replay tests. The immediate refusal proof requires real SCIM deactivation and an existing human session at both required widths. This research has performed no capture, session deactivation or outage.

**Primary recommendation:** sequence small waves with a usable HTTP tracer, bounded protocol expansion, catalogue/contract verification, real capture checkpoint, replay implementation, live refusal checkpoint, then code review/security audit and final regression.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Responsibility |
|---|---|---|---|
| Root routing, wire validation, media/errors | Strapi transport | Existing parser | Translate protocol without introducing a second API server |
| Bearer token and operation grants | Strapi source policy | Source/service records | Fresh source authority, separate from human identity |
| Ownership, claims, identity writes | Existing identity service | Document Service transaction | Preserve the single guarded writer |
| PATCH reduction | Transport reducer + identity service lock | Database | Read, reduce and mutate under one deciding lock |
| Token lifecycle/activity | Backend administration/services | Source-row serialization | Independent source metadata, no user changes |
| Connector lifecycle | midPoint connector | Orchestrator live gate | Actual wire evidence before replay fixtures |
| Next-request refusal | Strapi authorization | CSRM server session/capability transport | Same still-valid human identity receives denial |

This is the prescribed responsibility split from the locked context. [CITED: 03-CONTEXT.md P3-02–P3-05, P3-14, P3-26–P3-30]

## Standard Stack

| Existing component | Version / evidence | Use |
|---|---|---|
| Strapi | `"@strapi/strapi": "5.51.0"` [VERIFIED: apps/backend/package.json:20-25] | Root route registration, policies and Document Service |
| Existing SQLite/PostgreSQL adapters | `"better-sqlite3": "12.8.0"`; `"pg": "8.23.1"` [VERIFIED: apps/backend/package.json:26-30] | Existing identity transaction/locking machinery |
| Node built-ins | Research probe returned `v24.20.0`; manifest range `">=22.2.0 <=26.x.x"` [VERIFIED: apps/backend/package.json:45-47] | Crypto, filesystem safety and existing test runner |
| Test runner | `node --test --test-concurrency=1 --test-timeout=600000` [VERIFIED: apps/backend/package.json:14] | Existing real Strapi HTTP integration suite |
| midPoint / connector | `FROM evolveum/midpoint:4.8.14-alpine`; `ARG SCIM2_CONNECTOR_TAG=V1.2.9` [VERIFIED: docker/midpoint/Dockerfile:11-12,32] | Live interoperability only |

**Installation:** none recommended. Retain pinned repository versions; no package upgrade is part of this phase. Registry-current versions are irrelevant to this reuse-only recommendation. [CITED: 03-CONTEXT.md P3-01, P3-21, P3-26]

## Package Legitimacy Audit

No external package installation is proposed. Use built-in cryptography and the existing runtime/test dependencies. If execution discovers a concrete package requirement, pause that installation for the workflow's registry/official-source legitimacy check; do not silently add it. [CITED: AGENTS.md; 03-CONTEXT.md P3-21]

## Architecture Patterns

### Root route registration and inventory

[CITED: installed @strapi/core 5.51.0 dist/services/server/index.js, register-routes.js, routing.js; https://docs.strapi.io/cms/backend-customization/routes] The installed route loader forces ordinary application routers into content-api. The server dispatches route objects with a type to an API manager; an object without type reaches the root manager. Therefore register the locked root manifest once during bootstrap with an omitted type. Function handlers avoid local controller namespace ambiguity. Explicit source policies remain mandatory with default authentication disabled.

[VERIFIED: apps/backend/tests/helpers/strapi-http-harness.ts:199-235] Existing inventory reads `router.type !== "content-api"` and `strapi.server.api("content-api").listRoutes()`. It cannot prove root SCIM mounting as written. Extend it to enumerate the SCIM manifest and root server layers, keeping existing content-api/plugin classification. Verify every reserved method/path once, and zero prefixed aliases.

[VERIFIED: apps/backend/tests/served-operations.integration.test.ts:640-669] The test named `"IAM reserves every SCIM operation for Phase 3 without mounting it or granting existing roles"` explicitly asserts absence. Replace its Phase 2 reservation assertions with exact mounted SCIM security/grant assertions; do not weaken its existing human-role exclusion. Regenerate the inventory only from real mounted routes and recheck without maintenance switches.

### Wire layer and narrow extensions

[VERIFIED: apps/backend/src/iam/identity/identity-input.ts:3-15] Existing fields are `"username", "email", "firstName", "lastName", "displayName", "accountStatus", "sourceExternalId", "employeeNumber", "department", "jobTitle"`; statuses are `"active" | "inactive"`. Closed failure codes are `"forbidden" | "notFound" | "uniqueness" | "immutableSourceKey" | "invalidInput"` plus `"keycloakUnavailable"` with `retryAfterSeconds: 30`. Transport must classify path/filter/media errors before this coarser outcome mapping. The source key stays exact opaque text.

[VERIFIED: apps/backend/src/iam/identity/identity-service.ts:9-41,88-101] Current projection is `["documentId", ...SOURCE_IDENTITY_FIELDS]`, query equality compiles to `$eq`, and results sort `"id:asc"`. There are no projected created/updated timestamps to emit. Add a narrowly allowlisted case-insensitive equality option for the locked non-key fields; preserve exact source-key matching and visibility before count/pagination.

[CITED: https://www.rfc-editor.org/rfc/rfc7643.html sections 2.2, 4, 7; https://www.rfc-editor.org/rfc/rfc7644 sections 3.4, 3.5, 3.12] Schema descriptors communicate mutability, comparison and returned behavior. PATCH is ordered and atomic; replacement must handle omitted supported fields deliberately. Build the constrained grammar from the locked decisions rather than accepting arbitrary query objects or a larger advertised protocol surface.

### Atomic PATCH and conflict translation

[VERIFIED: apps/backend/src/iam/identity/user-lock.ts:35-55] The shared helper checks `strapi.db.inTransaction()`, acquires the lock inside `strapi.db.transaction` and retries SQLite contention only for the outer operation. Reuse this database lock; process-local mutexes cannot coordinate writers.

[VERIFIED: apps/backend/src/iam/identity/identity-service.ts:119-135; apps/backend/src/iam/identity/identity-input.ts:35-47] A conflict flows from the method catch into `resolveIdentityUniqueness`, which throws `"IAM_IDENTITY_TRANSACTION_ACTIVE"` when called before outer rollback. Simply wrapping the public patch method in another transaction risks this failure. Prescriptive seam: keep PATCH reduction inside a narrow extension of the existing patch service's locked mutation path, with the current projection supplied to the reducer after lock acquisition, one validated delta, one Document Service mutation and uniqueness translation after outer rollback. Do not introduce another writer or expose a way to construct principals. Test concurrent deltas, failing later operation, uniqueness rollback and remote failure rollback through HTTP.

### Source authentication and independent activity

[VERIFIED: apps/backend/src/iam/identity/source-principal.ts:42-74] Binding validation requires `sourceStatus !== "active"` to fail and checks the single `"Identity Provisioning"` Role/Function, active application `"idambox-iam"`, protected manual service identity and unique binding. A private `WeakMap` ties issued authority to the runtime. Bearer authentication must obtain this principal rather than copying its visible fields; grant traversal must also check the requested FunctionAPI freshly.

[CITED: 03-CONTEXT.md P3-04–P3-10, P3-21–P3-23] Processing order: outer error/log scope and IP budget; authenticate token and current source/service binding; independently persist activity; source budget and exact grant; validation/read/write. For early parser rejection, ensure valid bearer activity still meets P3-23 without letting malformed bodies escape the outer response boundary. Persisting activity cannot be nested in the later user transaction. Do not count invalid hints as source identity. Source-row token serialization must coordinate across processes and use Document Service to mutate metadata, while permitting revocation of broken/inactive sources.

[CITED: https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b] Built-in timing-safe comparison requires buffers of equal byte length and does not make surrounding application logic timing-safe. Validate format first; compare fixed-size decoded digests, including dummy comparison for absent records. Use cryptographic random bytes for the secret. Do not advertise equal network latency.

### Proposed module responsibilities

These are planning suggestions, not assertions that files already exist: keep a route manifest, source policy/context, token service/CLI, wire schema/mapping, constrained filter parser, PATCH reducer, response/error helper, request boundary and limiter under the locked SCIM module. Keep shared lock/query extensions in the identity module. Split ordinary authored conformance tests from real-capture replay tests. New file names belong in individual plans before commands reference them. [CITED: 03-CONTEXT.md P3-02, P3-26–P3-28]

## Don't Hand-Roll

| Problem | Reuse |
|---|---|
| Ownership, confirmed claim, reserved tuple, tombstone | Existing six-method identity service and field guard |
| Transaction/user serialization | Existing shared database lock and Document Service |
| Outage-safe inactivity and recovery | Existing outbox, fenced worker and fake/live Keycloak harness |
| Digest/randomness | Node cryptography |
| HTTP mounting | Installed Strapi root manager |
| Human authorization and refusal | Existing Strapi policy and CSRM typed capability/session flow |

These reuse choices are locked by P3-01/P3-02/P3-29/P3-30; avoid an independent server, alternate identity writer, schema migration or a frontend provisioning facade. [CITED: 03-CONTEXT.md]

## Common Pitfalls

1. **Parser bypass of the error envelope.** Malformed JSON and oversize bodies occur before handlers. The SCIM boundary must precede parsing and consistently emit safe protocol errors and exactly one canonical request event, while preserving unrelated parser limits. [CITED: 03-CONTEXT.md P3-06, P3-22]
2. **Metadata accidentally advertising more than storage supports.** Return only supported primary-email projection and optional Enterprise fields; avoid invented timestamps, version/ETag support or multi-address persistence. [CITED: 03-CONTEXT.md P3-11, P3-18]
3. **Activity rollback or skipped activity on denial.** Track activity for valid binding even on later grant, source-rate or payload denial. A failed activity write safely fails the request. [CITED: 03-CONTEXT.md P3-23]
4. **Stale security state.** Rotation takes effect on the next request after commit; fresh binding and operation checks cannot be cached between requests. Development headers cannot broaden source authority. [CITED: 03-CONTEXT.md P3-04, P3-05, P3-09]
5. **Synthetic fixtures labelled as connector evidence.** A stub discovery result or direct HTTP script does not prove connector lifecycle requests. Missing operations require real recapture or an unmet gate. [CITED: 03-CONTEXT.md P3-26–P3-28]
6. **Limiter tuned to obsolete numbers.** Effective defaults are 1200/IP and 600/source per minute, not the superseded 300/120. Test injected-clock expiry, bounds, capacity refusal, source isolation and integer Retry-After. [CITED: 03-CONTEXT.md P3-21, P3-32]
7. **Development fixture access treated as production refusal.** Existing session token, real backend grants, direct detail and write refusal, outage before worker recovery and both widths are mandatory. [CITED: 03-CONTEXT.md P3-29–P3-30]

## Code Examples

Existing service pattern, quoted as source data (DATA_f0a73c19_START):

```typescript
return await withIdentityUserLock(strapi, id, async () => {
  if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
  const user = await readUser(strapi, id); if (!accessible(user, principal)) return identityFailure("notFound");
```

DATA_f0a73c19_END. This is the deciding-read location to extend for PATCH reduction; preserve the later single validated mutation and post-rollback conflict handling. [VERIFIED: apps/backend/src/iam/identity/identity-service.ts:126-128]

## Environment Availability

Read-only probes on research date; availability is not lifecycle acceptance evidence.

| Dependency | Observed | Execution consequence |
|---|---|---|
| Node / pnpm | `v24.20.0` / `11.24.0` from version probes | Use the operator-provided PATH locally; portable commands in plans |
| Docker | Client/server `27.3.1` | Orchestrator can run gated compose operations |
| midPoint | Compose reports healthy; HTTP `302` | Version/connector/source commit still recorded at actual capture |
| Keycloak | Compose running; realm metadata HTTP `200` | Existing session + outage gate still required |
| Strapi dev listener | Health request HTTP `000` | Start isolated configured process before capture; do not infer service correctness |
| Browser runtime | Not probed | Live checkpoint preflight verifies browser installation and starts isolated CSRM |

[VERIFIED: research-date version, compose status and HTTP probes] No credentials, environment contents or request bodies were printed. Graph context was unavailable because the graph status command returned disabled. Documentation provider requested by the research seam was unavailable as a callable tool/CLI; primary official documentation was fetched directly. Confidence classification returned MEDIUM for verified websearch and LOW for generic webfetch provider; repository source quotations remain separately verifiable.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Existing Node test runner with real Strapi HTTP harness |
| Config | Existing backend test TypeScript configuration |
| Compile | `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` |
| Quick sampling | Compile then run the specific newly created compiled unit test file with `node --test` |
| Full suite | `pnpm --dir apps/backend test` from repository root |

The existing script compiles production and tests, rejects maintenance switches and runs tests sequentially. [VERIFIED: apps/backend/package.json:14-16] Plans must create each proposed test before referencing its compiled output. Unit samples should stay below 30 seconds; real runtime integration and live gates need explicit larger timeouts and must not be represented as fast unit tests.

### Phase Requirements → Test Map

| Requirement | Required automated proof | Additional live checkpoint |
|---|---|---|
| MODEL-02 | Issue/default action/rotate/revoke, simultaneous rotation, generic 401, invalid binding, safe export/revoke-on-failure | Real development delivery and token lifecycle against mounted service |
| PROV-01 | HTTP create, persisted source ownership, no explicit roles, effective birthright only, conflict rollback | Connector create |
| PROV-02 | Direct/list visibility, bounded grammar/escaping/case comparisons, count-zero/page edges, safe projections | Connector lookup/read/filter/page |
| PROV-03 | PUT omission, id consistency/claim boundary, all PATCH shapes/casing/selectors, atomic/concurrent deltas, role retention, blocking 503/Retry-After | Connector mover, explicit PATCH if ordinary mapping omits it |
| PROV-04 | All discovery descriptors/resources, exact authenticated Group 404/501 behaviors | Actual connection test plus independent schema/config probes |
| PROV-08 | Genuine captured fixtures against real HTTP, strict shape/order, substitutions and persistence/source isolation | Capture must precede fixtures/replay plan |
| LIFE-01 | Same valid human token denied after real SCIM PUT/PATCH inactivity, source still active, fake-Keycloak outage | Existing OIDC browser session at 1440/375, API data/access 403, direct detail/write denial, real outage |
| LIFE-03 | SCIM DELETE 204/idempotence/tombstone, hidden reads, retained tuple/roles/subject/request/risk/owner references | Connector delete and retained-reference evidence |

This table implements the eight locked requirements and five criterion mapping. [CITED: .planning/workstreams/iam/REQUIREMENTS.md; 03-CONTEXT.md P3-31]

### Sampling Rate and Wave 0 Gaps

- Each task: compile plus its named behavior tests; maintain existing source/identity regressions after shared-service edits.
- Each protocol wave: the named HTTP integration suite plus security isolation checks.
- Before final acceptance: all real checkpoint evidence, code review, security audit, zero unresolved blocking findings, complete backend suite and relevant CSRM checks.
- Add authored token/wire/filter/PATCH/limiter tests first; add HTTP harness source fixtures without fabricating connector captures. Replay test/fixture files are created only after capture passes.
- Contract changes require `pnpm --dir apps/csrm api:check`, `pnpm --dir apps/csrm typecheck` and `pnpm --dir apps/csrm test`. Generate additive client declarations using the existing discipline if required; no SCIM UI calls.

These are planned acceptance actions; none ran as part of research. [CITED: 03-CONTEXT.md P3-25–P3-31; apps/csrm/package.json]

## Orchestrator-Run Checkpoints

Proposed evidence paths below belong in the phase directory and remain uncreated until their actual run. [CITED: 03-CONTEXT.md P3-26–P3-31]

| Sequence | Orchestrator action | Required evidence |
|---|---|---|
| After real routes and capture tooling | Start Docker/midPoint/Keycloak/isolated Strapi; run real connector lifecycle through temporary resource and token delivered via ignored env | `03-CONNECTOR-CAPTURE-EVIDENCE.md`: versions, pinned connector commit, sanitized command/date, scenario results, substitution map, capture manifest, cleanup |
| Following capture | Inspect provenance and create fixtures/replay implementation from sanitized actual traffic | Captured fixture provenance plus replay assertions; absent operations keep capture gate pending |
| After refusal harness | Establish existing human OIDC session, prove positive API access, deactivate by SCIM PUT/PATCH/DELETE; repeat same valid tokens; stop Keycloak only during isolated outage; restore in finally | `03-REFUSAL-EVIDENCE.md`: commit/pending outbox/refusal before recovery, source remains functional, API/browser/detail/write outcomes and 1440/375 proof |
| After execution | Run gsd-code-review and gsd-secure-phase, remediate and rerun affected checks | Actual review/security findings and final dispositions in phase directory |
| Final | Required backend command, contract/client and CSRM checks, schema/config/no-secret regression | `03-GATE-EVIDENCE.md`: eight requirements → five criteria with actual results and referenced evidence |

Capture tooling must sanitize before writing: allowlisted headers only, no authorization/cookies/credentials/tokens, controlled fictitious persons and declared substitutions only. Trigger missing connector actions explicitly and label any extra direct HTTP conformance requests separately. Use temporary gate-owned data/resources and restore availability without altering developer data. Phase 4 cannot start until discovery, mapping, errors and genuine captured sequence are fixed. [CITED: 03-CONTEXT.md P3-26–P3-28]

## Security Domain

Security enforcement and Nyquist validation are enabled by default/project configuration. [CITED: .planning/config.json]

| Applicable control area | Phase threat | Required mitigation |
|---|---|---|
| Authentication / session | Token forgery, replay after rotation, human/source confusion | Fresh bearer digest and binding, no human identity trust, same-token next-request refusal |
| Access control | Cross-source records, protected users, stolen operation grant | Private source principal, fresh exact FunctionAPI check, visibility before count, no source role grants |
| Input validation / API security | Query injection, patch paths, malformed bodies | Closed DTO/parser/projections, bounded body/operations/terms, no caller query objects |
| Cryptography | Predictable credentials, recoverable secrets, digest comparison | Random 256-bit secret, full-token SHA-256, fixed-buffer timing-safe comparison |
| Logging / data protection | Credentials/PII in request evidence | Closed event fields, sanitize before persistence, no raw URL/body/header logs |
| Availability / business logic | Bucket exhaustion, retry storms, partial mutation | Bounded caps/expiry, source/IP budgets, transactional PATCH, retained outbox behavior |

These are ASVS control areas applicable to the Strapi API, token CLI, database and server session boundary; this is a threat/test mapping, not an ASVS certification claim. Use the official current release mapping during the security audit rather than assuming historic chapter numbers. [CITED: https://owasp.org/www-project-application-security-verification-standard/; 03-CONTEXT.md P3-04–P3-10, P3-14–P3-23]

## State of the Art

Use the installed runtime as the routing authority rather than assuming an older content-api prefix trick. Use typed narrow adapters over the landed transaction/ownership service; do not replace approved storage to fit the protocol. Later protocol extensions do not expand this locked Phase 3 scope. [CITED: installed Strapi routing source; 03-CONTEXT.md P3-01–P3-03]

## Assumptions Log

No unverified claim has been promoted into a locked decision. Proposed module splits/evidence names are implementation recommendations. Browser installation and actual connector lifecycle shapes remain execution preconditions; the capture and browser checkpoints resolve them without asking new design questions. [CITED: 03-CONTEXT.md P3-26–P3-30]

## Open Questions (RESOLVED)

No design question blocks planning. Actual connector payload spelling/order, runtime lifecycle success and browser-refusal evidence remain unobserved by this research and must be resolved by the explicit execution checkpoints. Failure leaves the corresponding gate pending. [CITED: 03-CONTEXT.md P3-26–P3-31]

## Sources

- Repository authorities: complete locked Phase 3 context, IAM roadmap/requirements/projects, shared project guide and AGENTS.md.
- Inspected implementation: identity service/input/source principal/user lock, runtime bootstrap/middleware configuration, package scripts, HTTP inventory harness, served-operations assertions, live Keycloak helper, OIDC adapter and protected layout, Dockerfile and Phase 2 plan style.
- [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643.html): schema characteristics and supported resource descriptors; September 2015 standard.
- [RFC 7644](https://www.rfc-editor.org/rfc/rfc7644): retrieval, modification, discovery and protocol error behavior; September 2015 standard, current status consulted.
- [Strapi custom routes](https://docs.strapi.io/cms/backend-customization/routes): handler/policy/auth configuration; exact root behavior cross-checked against installed 5.51.0 source.
- [Node crypto](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b): fixed-length timing-safe comparison and surrounding-code caveat.
- [OpenAPI Operation Object](https://spec.openapis.org/oas/v3.0.3.html#operation-object): operation-local servers preserve the existing global API base.
- [ASVS](https://owasp.org/www-project-application-security-verification-standard/): security verification areas and current release authority.

## Metadata

**Stack confidence:** HIGH for inspected pinned versions and code signatures; no new package recommendation.
**Architecture confidence:** HIGH for source-backed existing behavior; live interoperability remains pending.
**External protocol confidence:** MEDIUM from primary documents fetched directly; constrained by locked decisions.
**Research date:** 2026-10-15. Reconcile shared-backend source immediately before execution; recapture whenever connector configuration changes actual requests.

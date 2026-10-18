# Phase 4: midPoint configuration — Research

**Researched:** 2026-10-16
**Scope:** ENG-01–ENG-04, PROV-06, LIFE-04
**Confidence:** HIGH for inspected schema/source facts; MEDIUM for configuration composition; unresolved runtime compatibility is explicitly gated.

<user_constraints>
## User Constraints (from CONTEXT.md)

## Implementation Decisions

### Configuration lifecycle and credentials

- **P4-01:** Retain the pinned midPoint 4.8.14 runtime and SCIM2 1.2.9 connector/source commit from ADR 0006. Keep the existing read-only `objects-src` mount, container-home initial seeding and REST PUT reload discipline. These delivered Phase 1 decisions supersede D23's original writable mount and Ninja reload wording. Both `reload.sh` and `reload.ps1` must behave equivalently. Do not replace the discovery spike's OID with the production target: keep it explicitly separate and never assign workforce identities to it.
- **P4-02:** Choose environment substitution at seed/reload time for the dev Identity Source token, using the existing `MIDPOINT_SCIM_TOKEN` delivered to ignored `docker/.env` by `scim:token --write-dev-env`. Do not introduce a separate midPoint secret-provider integration in this milestone. Compose must explicitly supply the value to the required runtime entrypoints; a host `.env` entry alone does not inject it into a container. No credential in a build argument, image layer, committed XML, command argument, diagnostic or published evidence. Token issuance/rotation remains the existing backend administration command; reload never issues a token automatically.
- **P4-03:** Use one narrowly scoped rendering contract for initial application and both reload paths: validate the credential and the complete selected object set before mutation; substitute only the named credential slot; XML-escape values; reject missing, blank, malformed or unresolved placeholders. Never source arbitrary environment-file text or run general shell interpolation over XML. Send rendered XML through stdin to container-local REST where possible. Any initial-import spool must stay in a private container runtime directory with owner-only access, and its XML and `.done` copies must be removed after successful import or failure cleanup. Never render into the checkout or expose raw error response bodies. Verify midPoint persists the token as an encrypted protected value; backups/home volumes remain sensitive. Resource activation and task enablement fail closed until credential application and the connection test succeed. Missing credentials may not silently retain a previously valid runtime credential while reporting reload success.
- **P4-04:** Keep stable OIDs and numbered files: `100-resource-hr-csv.xml`, `110-resource-idambox-scim.xml`, `200-object-template-user.xml` and separate `300-task-*.xml` objects, plus narrowly scoped supporting objects if needed. Keep the spike under a distinct filename/OID. Fresh seed and explicit reload must converge on the same mappings without dropping runtime identity `linkRef`, correlation cases, task progress or sync tokens. Overwrite only configuration objects; do not overwrite workforce User objects to change attributes. Reload is explicit, not automatic on restart. Stage tasks suspended until prerequisites pass; partial reload stops with a nonzero status and leaves dependent tasks suspended. A repeated reload must not duplicate resources, identities or schedules.

### HR CSV, Identity and activation

- **P4-05:** Use `docker/midpoint/hr/` for a committed, entirely fictitious UTF-8 reference CSV and fixture documentation. Mount the directory read-only at a stable container path, rather than a single file, so atomic file replacement remains visible. The runtime CSV connector state belongs in the writable midPoint home, never alongside tracked fixtures. The exact header order is `employeeNumber,givenName,familyName,preferredName,email,username,department,jobTitle,status,startDate,endDate`. Use normal CSV quoting, one person per row, unique nonblank employee numbers and unique usernames/emails; no passwords, roles, real personal data or credentials. Gate scenarios use an isolated writable copy and atomically replace complete snapshots. Do not let a gate modify the reference file or developer source data.
- **P4-06:** HR `employeeNumber` is the immutable source key and the sourced Identity's `name`; it is not username, email or Keycloak subject. Preserve leading zeros and exact key case, trim accidental surrounding whitespace, and reject empty/duplicate keys, including case-only duplicates that would be ambiguous in supported employee-number searches. Identity attributes are inbound-authoritative only from the HR resource. The user template derives the common focus fields and the IdamBox resource assignment only for valid HR-managed Identities; never apply this assignment globally to administrators, service identities or unrelated midPoint users. Dates/status may live in midPoint configuration/extension fields; they do not add fields to Strapi.
- **P4-07:** Activation uses UTC date-only boundaries with strict `YYYY-MM-DD` parsing. Active means `status=active`, startDate absent or reached, and endDate absent or not yet reached. Start is inclusive at 00:00 UTC; end is exclusive at 00:00 UTC. `terminated` always disables regardless of dates. Both dates may be blank; a supplied invalid date, end before start, unknown/missing status or missing required identity value is never treated as active. A row with a trustworthy existing source key but invalid activation becomes disabled and raises a visible error; a malformed new row cannot create an active user. Unparseable snapshots/duplicate keys stop ingestion, preserve last accepted state and raise an error; they cannot be interpreted as an empty workforce. Ensure time-triggered activation changes run within the same five-minute bound even if CSV bytes have not changed; live-sync change detection alone is insufficient.
- **P4-08:** Keep a small deterministic sample covering active, future starter, terminated and ended employment, preferred-name fallback, leading-zero key, and quoted/non-ASCII names. Define separate before/after fixtures for joiner, mover and leaver; use clock-relative synthetic dates for executable boundary checks so committed samples do not quietly age into different expectations. Removing a previously imported keyed person from a valid, complete snapshot disables their managed projection and retains their Identity/link/history; it never deletes. A missing/unreadable file, broken header or connector failure is an operational error, not evidence that everybody left. Explicit `terminated` is the primary leaver acceptance case.

### Object template and D19 outbound contract

- **P4-09:** Lock the D19 mapping: CSV username → SCIM `userName`; email → one primary work `emails` value; givenName/familyName → `name.givenName`/`name.familyName`; nonblank preferredName → `displayName`, otherwise joined given/family names, with username as final nonblank fallback; computed activation → `active`; employeeNumber → Enterprise `employeeNumber` and the logical source `externalId`; department → Enterprise `department`; jobTitle → `title`. Preserve the preferredName-as-displayName choice in Phase 3. Start/end dates remain in midPoint. No mapping of passwords, explicit IdamBox Roles, Keycloak `externalSubject`, source registration, protection or backend audit fields. Movers and claims preserve all explicit roles granted in IdamBox; newly sourced users receive only birthright Requestor.
- **P4-10:** Ground the resource in the actual Phase 3 connector shape: nonlegacy `Scim2User`, standard and Enterprise schema enabled, unrelated schema flags/deep import disabled, `/Users` and `/Groups`, endpoint `http://host.docker.internal:1337/scim/v2` in development. Encode the email connector attribute as a JSON string containing `value`, `primary: true` and `type: work`, as observed in 03-LIVE-PROBE.md. The pinned adapter does not serialize `externalId` on writes: Enterprise `employeeNumber` supplies the key under P3-33/P3-34, and Strapi returns it as `externalId`. Do not pretend an XML `externalId` mapping fixes the adapter or require it on every observed PUT. Preserve tested Slack-URN tolerance, asserted-attribute PUT and remove/add email PATCH semantics. Do not patch or upgrade the connector to hide these facts.
- **P4-11:** Every identity attribute change, including email, department and employee-number assertion during a claim, must actually reach Strapi. A mapping shown in XML is insufficient: the adapter omitted Enterprise data on the captured mover PUT. Require observed post-write state for D19 fields and explicit clearing of optional fields when HR clears them; an omission that preserves stale backend values is not successful drift repair. If the pinned connector cannot emit a required mapping, record a blocking compatibility gap with the real exchange. No raw backend writer, custom provisioning endpoint, schema change or silent narrowing of D19 is permitted.

### Correlation and protected boundaries

- **P4-12:** Use midPoint 4.8 smart correlation and native operator correlation cases. Separate already-owned linkage from a first manual-user claim. An established source/key link is authoritative; changes to email/username never re-correlate it. A previously unowned manual user's employee-number match is still a proposal requiring confirmation, exactly like an email match. Neither a unique candidate nor a high confidence score authorizes an automatic claim. No outbound write, including activation, may touch the manual target before confirmation.
- **P4-13:** Find candidates with separate bounded equality lookups for employeeNumber and `emails.value`, combining results without inventing SCIM `or`/substring filters. The backend supports `eq` and `and`, with case-insensitive employee/email matching and exact source-key matching. Deduplicate by stable SCIM `id`; disagreeing email/employee matches, multiple matches, invalid input and failed/truncated lookups stay unresolved and block create/claim. Never let the connector's default username lookup auto-link a manual user around the case. With complete successful searches and no candidate, create a new sourced user. Protected and foreign-source users are invisible under backend scope and never candidates; a hidden uniqueness collision must fail, not trigger a privileged fallback search or automatic adoption.
- **P4-14:** Confirmation must link the selected existing SCIM `id` and send the first keyed `PUT /Users/{id}`; no duplicate POST and no PATCH claim. The claim must assert the HR employeeNumber because a keyless PUT cannot claim. Strapi deliberately trusts this explicit target as the upstream confirmation signal; it has no independent confirmation proof. The midPoint case, operator identity, decision time and resulting PUT are therefore mandatory evidence. Rejection leaves the manual record untouched and the HR record unresolved until an operator chooses an explicit safe disposition; it must not immediately create a duplicate. On confirmation failure or concurrent protection/ownership change, retain unresolved/error state and never choose another candidate automatically.
- **P4-15:** The researcher must establish the exact 4.8 configuration that represents a discovered manual SCIM shadow as a native correlation candidate and prevents pre-confirmation projection writes. Do not confuse matching an HR shadow to an existing midPoint focus with proving a claim of an existing IdamBox User. Supporting focus/shadow representation must remain read-only and without HR outbound assignment until confirmed; after confirmation there is one HR Identity named by employeeNumber and one IdamBox User. XML element names, native case wiring and supported connector filter attribute names require version-specific validation during research and the live gate. If that seam cannot meet these locked semantics, provisioning remains suspended and the gap is reported; there is no automatic-link fallback.

### Leavers, scheduling and drift

- **P4-16:** Configure disable-instead-of-delete on the IdamBox projection, including HR termination, end-date expiry, disappearance from a successfully accepted snapshot and assignment removal. Retain the focus, projection linkage and audit history. Required observed lifecycle traffic is PUT with `active=false`, never DELETE. Keep the existing SCIM tombstone contract for unexpected DELETE; never use tombstoning as the normal leaver mechanism or automatically resurrect a tombstone. Reactivation, when HR validly returns to active, retains the same source/key and passes the existing blocking Keycloak path.
- **P4-17:** Poll HR live synchronization every 300 seconds and evaluate date-bound activation at least as often. Schedule nightly HR reconciliation at 01:00 UTC and IdamBox managed-projection reconciliation at 02:00 UTC, with no concurrent run of the same task and no overlapping writes to the same projection. Tasks are independently named/inspectable and can be triggered on demand. A success means one valid CSV joiner/mover/leaver change reaches Strapi within 300 seconds of atomic publication on a healthy stack; measure actual timestamps. A 300-second polling interval alone does not prove the end-to-end bound. If that bound fails, leave ENG-02 unaccepted and tune the supported scheduling path without weakening the criterion. Outages/correlation holds are visible exceptions, not successes inside the healthy-stack timing claim.
- **P4-18:** HR is authoritative for managed identity fields and status. Nightly IdamBox reconciliation reads current remote values and reapplies HR-derived values, including department and optional-field clears, while preserving IdamBox role grants and source/key ownership. Manual, protected, foreign and source-deleted records are never repaired by this task. Use a controlled out-of-band drift fixture only inside the isolated gate because ordinary user APIs correctly refuse HR-owned field changes. IdamBox inbound mappings may aid discovery/correlation but must not overwrite HR focus values or import role authority.

### P3-36: complete reconciliation beyond 100

- **P4-19:** Choose per-Identity filtered correlation and focus/known-projection-driven refresh/reconciliation for the IdamBox resource. Enumerate the complete accepted HR population and persisted managed focus/projection links from midPoint, then use keyed equality lookups or explicit SCIM-id reads for each. Include retained disabled identities and known projections whose HR row disappeared; do not restrict iteration to today's active CSV rows. This is the nightly IdamBox managed-user drift-repair path, distinct from HR resource reconciliation. An unpaged remote enumeration is never its authoritative population. Keep the backend default 100 and cap 500 unchanged. Increasing a finite default merely moves the truncation boundary and is rejected as the solution.
- **P4-20:** Prove P4-19 on at least 125 owned users, with additional manual candidates, protected controls and a foreign-source control. Establish the expected population independently through gate setup, not a truncated connector list. Demonstrate create/import, candidate resolution, drift repair and leaver repair for identities placed beyond the first 100 remote results, with complete expected/processed/succeeded/failed counts and sanitized actual requests. Test an email-only manual candidate beyond that boundary, retained absent-HR links and a previously unlinked HR Identity with a remote source-key match. Every filtered lookup must be complete; ambiguous or partial results cannot authorize creation. If the supported midPoint path still depends on unpaged enumeration, that is a blocking ENG-03/PROV-06 gap, not a passing 100-user limitation. A paging-capable alternative needs a new explicit decision plus captured proof; there is no assumed capability from `pagedSearch` metadata.
- **P4-21:** This choice proves repair of the managed population, not discovery of every orphan remote record with no HR Identity and no persisted link. State that limit in operational evidence. Do not interpret absence from a 100-row result as deletion or disable/create anything from that absence. A full remote-inventory claim requires a separately proven complete enumeration path; it is not required to grant authority over manual or foreign records. A reset/lost-link recovery check must still find HR-known users by source key without creating duplicates.

### Retry, outages and IN-03

- **P4-22:** Use a dedicated resource-scoped pending-operation refresh every 60 seconds, one worker initially, with per-operation eligibility no earlier than its last failure plus the observed Retry-After. Current blocking provisioning failures return 503 and 30 seconds; rate limits return 429 with their own delay, up to the fixed window. Configure supported midPoint retry eligibility/backoff rather than assuming the connector passes response headers through. A refresh sweep's frequency is not proof of retry spacing. Record real attempt timestamps for 503 and 429. If the supported path cannot guarantee the server delay, suspend automatic retries and treat LIFE-04 as blocked until a compliant configuration is proven.
- **P4-23:** Bound repeated transient retries with increasing delay, initially 60 seconds and capped at one hour, without deleting pending work; restrict concurrency and stagger resource tasks so recovery cannot flood the 600/source/minute and 1200/IP/minute defaults. Do not raise backend rate limits to make acceptance pass. After ten consecutive failures, surface a visible operator-attention state with task/target/closed outcome and continue only at the capped cadence; this is not successful completion. 401/403 require credential/authorization correction and suspended writes, not rapid retry. Invalid data, uniqueness conflicts and unresolved correlation need operator resolution, not a hot loop.
- **P4-24:** Retain IN-03/P3-19: Keycloak remote email conflict remains SCIM 503 with Retry-After 30 and local rollback, distinct from a local SCIM 409 uniqueness. Do not change that backend classification in Phase 4. midPoint cannot reliably identify a permanent remote email collision from that closed 503 alone; apply P4-23's bounded cadence and operator-attention rule without guessing from remote message text. Live proof must show a repeatable collision leaves no duplicate/claim/adoption and remains visible. Clean gate data must use unique run-specific usernames/emails; do not reuse stale Keycloak identities as an outage test.
- **P4-25:** LIFE-04 requires a genuine CSV-origin joiner while Keycloak is stopped: Strapi 503/Retry-After and rollback, durable midPoint pending operation, no manual retry, then successful automatic Strapi/Keycloak provisioning after recovery and no duplicate. Exercise a blocking mover/reactivation too. Separately confirm an existing-user leaver commits inactive while Keycloak is down and the existing Strapi outbox completes disable/session end after recovery. midPoint retries blocking writes; it must not replace, clear or bypass the backend leaver outbox. Keep all committed Keycloak/OIDC/seed flags false; only the orchestrator's isolated live process may enable required flags.

### Throughput, audit and evidence

- **P4-26:** Measure the first full reference-CSV reconciliation on a clean, isolated stack with Keycloak provisioning enabled, before a warm repeat. Record row count and eligibility, runtime/connector versions, database kind, task start/end UTC, elapsed time, completed/failed/held operations, SCIM request totals by operation/status, retries/429/503, and actual creates per second. Record Keycloak availability and relevant concurrency/cadence settings. Measure the 125-user completeness run separately. Do not extrapolate a small or flag-off capture to a larger supported workforce or promise timings before evidence. Correlation holds/errors are reported separately, never counted as provisioned throughput.
- **P4-27:** For each joiner, mover, leaver, claim, drift repair and retry, publish sanitized evidence connecting HR key and change/cause → midPoint Identity/task/correlation case and audit event → SCIM target/id, source, operation and outcome → resulting Strapi state and lastSyncedAt. Include operator confirmation and before-confirmation no-write evidence, retry timestamps and task completion counts. midPoint's native repository audit must record the cause and decision, not only connector success. Strapi `scim.request` logs complement it; rejected writes may still advance source activity and must not be mistaken for successful user mutation. Never capture Authorization, passwords, cookies, raw tokens, environment dumps or unsanitized connector traces. Use synthetic data only.
- **P4-28:** Treat a Phase 4 recapture as required: persistent HR/template/correlation/claim/filter/reconciliation mappings introduce scenarios absent from the 47-envelope Phase 3 shadow-level capture. Preserve Phase 3 evidence as historical. Use or extend `docker/midpoint/e2e/` sanitation, provenance, isolation and cleanup contracts for phase-local evidence, then update the backend replay fixture/provenance from genuine observed envelopes. Include the current baseline lifecycle sequence plus new relevant mapping/claim/filter shapes. Do not fabricate requests to fill missing connector operations, hand-edit captured bodies or call a direct HTTP probe connector-origin traffic. Keep replay byte-exact with only declared identifier substitutions. A byte-identical baseline run alone does not prove the CSV-to-focus path.
- **P4-29:** Offline work may validate XML structure, fixed OIDs, template/mapping/schedule contracts, renderer failure/redaction, CSV/date logic and gate evidence validators; backend regression/replay tests remain available without midPoint. Live-only acceptance belongs to the orchestrator: fresh/reused-volume seed and both reload paths, credential rotation/revocation delivery, CSV connector discovery/change detection/date transitions, native cases, actual D19 writes/clears, disable traffic, five-minute timing, both nightly tasks, >100 completeness, Keycloak outage/recovery/conflict, retry delays, native audit and first-reconciliation measurement. No Docker/network operation or live result is claimed by this discussion. An offline validator validates artifacts, not execution provenance.
- **P4-30:** Final acceptance requires every Phase 4 success criterion, new genuine capture/replay, and `pnpm --dir apps/backend test` from the repository root. Re-evaluate the current shared-backend baseline before execution. Phase 3's evidence recorded two narrowly named missing-module CSRM test exclusions in WINDOWS.md entry 11; that is historical context, not authorization for a blanket exclusion or a full-green claim. If the issue persists, report unfiltered failure and any exactly scoped diagnostic run separately. Keep catalogue copies, existing endpoint grants, generated contract compatibility and false defaults intact; no schema/JDL change. Missing live evidence leaves the corresponding requirement pending.

### Implementation discretion

All gray areas were delegated for this session. Internal XML expressions, supported 4.8 task/activity elements, safe renderer language and file splits remain research/implementation choices within these decisions. Version-specific behavior must be checked against the pinned runtime; an unverified syntax choice cannot relax confirmation, population completeness, retry spacing or field authority. No new dependency, connector replacement, broader backend contract or schema approval is inferred.

## Deferred Ideas

DatabaseTable/SIMS/customer connectors, a secret-provider integration, connector replacement/upgrades, arbitrary remote orphan inventory, remote-conflict status reclassification, broader HR fields or content types, role/group provisioning, source administration screens and product change-log integration remain outside Phase 4. Phase 5 owns set-password email acceptance, CSRM sign-in and the complete CSV-to-browser journey. This phase may observe provisioning email side effects during live measurement without claiming SIGN-01 or SIGN-02 completion.
</user_constraints>

## Summary

Use the pinned configuration lifecycle, bundled CSV 2.8 connector, resource-specific mappings, a scoped user template, native correlation cases, repository-driven recomputation and resource-scoped shadow refresh. Keep every workforce task suspended until credentials, connection, mapping, correlation and retry compatibility probes pass. Schema acceptance establishes names and types; it does not establish the resulting request sequence or lifecycle behavior. [VERIFIED: supplied schema, common/common-provisioning-3.xsd:536-555,842-1004,1386-1405; common/common-tasks-3.xsd:1908-2016,7128-7146,7268-7296]

The highest-risk seams are Enterprise assertions and clears on updates, native confirmation of an existing remote manual target, and durable retry eligibility/backoff after a closed SCIM failure. Connector source confirms Enterprise population is called on updates, so the previous omitted Enterprise body is not proof of universal impossibility. Its fault processor, however, constructs generic exceptions for parsed failures and does not pass Retry-After into its status/body handler. These require early isolated live falsification, before dependent expansion. [VERIFIED: connector V1.2.9, Scim2UserAdapter.java:357-435,780-805; Scim2FaultProcessor.java:27-85,93-117]

**Primary recommendation:** build offline fixtures, validation, rendering and probe harnesses first; run explicit orchestrator compatibility checkpoints next; implement only the configurations those checkpoints substantiate. A failed probe records a blocking gap and leaves affected provisioning suspended; it never authorizes weaker behavior. [VERIFIED: 04-CONTEXT.md, P4-11,P4-15,P4-22,P4-23,P4-29]

## Architectural Responsibility Map

| Capability | Primary owner | Secondary owner | Planning consequence |
|---|---|---|---|
| Complete HR snapshot validation and publication | Configuration ingestion boundary | CSV resource | Reject invalid snapshots before connector consumption; preserve last accepted snapshot |
| Immutable HR identity, activation, attribute authority | midPoint focus/template | HR resource inbound mappings | No frontend or backend HR decision engine |
| Candidate proposal and operator decision | midPoint native case | Read-only SCIM shadow discovery | No claim or activation write before confirmation |
| Managed drift repair and retry | midPoint tasks and pending work | ConnId connector | Scope population from persisted focuses/links; prove actual reads and writes |
| Ownership, source scope and explicit-id claim | Strapi SCIM identity service | Document Service | Keep the delivered backend boundary |
| Authentication and blocking provisioning | Keycloak through Strapi | Leaver outbox | midPoint never writes Keycloak directly |
| Sanitized causal evidence and replay | Phase gate and native audit | Backend request logging | Offline evidence validation cannot establish runtime provenance |

These responsibilities are locked by D1,D2,D6,D13,D16,D18,D21 and P4-01–30. [VERIFIED: IDENTITY-PROVISIONING-BRIEF.md:30-61; 04-CONTEXT.md, Implementation Decisions]

## Project Constraints (from AGENTS.md)

Use the existing project brief, API contract, JDL terminology and capability catalogue as authoritative references. Keep Strapi the production API boundary and enforce authorization, record ownership and Role → Function → FunctionAPI on the server. Preserve Requestor birthright and explicit Security Analyst grants; navigation visibility grants nothing. Validate external input, add automated tests for material workflows, introduce no dependency without a concrete reason, preserve existing work and secrets, and keep shared-backend endpoints/grants compatible. [VERIFIED: AGENTS.md, Authoritative References, CSRM Engineering Rules, Non-Negotiables; .planning/PROJECT.md, GSD Workstreams]

The web-specific constraints remain binding if touched: App Router, strict TypeScript, Server Components by default, existing primitives, semantic tokens and responsive accessible layouts; domain logic stays outside JSX and arbitrary components use the typed API layer. This phase does not require UI changes. No assessment release authority changes are in scope. [VERIFIED: AGENTS.md, CSRM Engineering Rules; 04-CONTEXT.md, Deferred Ideas]

Use repository-relative document references. Do not change content-type schemas, JDL, committed activation flags, connector pins, catalogue copies or public contracts. No new dependency is authorized. Commits and every live operation belong to the orchestrator. [VERIFIED: .planning/PROJECT.md, Portable briefs and prompts; 04-CONTEXT.md, P4-01,P4-25,P4-30]

<phase_requirements>
## Phase Requirements

| ID | Required behavior | Research support |
|---|---|---|
| ENG-01 | Import reference HR CSV and correlate on employeeNumber | CSV property inventory, snapshot validation, scoped focus/template |
| ENG-02 | Joiner/mover/leaver reaches Strapi within one five-minute cycle | Schedule types, independent date reevaluation, timestamped lifecycle gate |
| ENG-03 | Nightly managed drift repair and pending-operation refresh | Repository recomputation, complete managed population, retry probe |
| ENG-04 | Lifecycle decision/cause in native audit and matching SCIM log | Connected evidence, native case/operator attribution, actual state assertions |
| PROV-06 | Operator-confirmed manual-user claim; source key thereafter | Native owner-candidate distinction and no-write confirmation probe |
| LIFE-04 | Durable create/update retry after Keycloak recovery | Fault-classification/header risk, pending-operation and timing proof |

Requirement descriptions are summarized from `.planning/workstreams/iam/REQUIREMENTS.md`, Provisioning/Lifecycle/Engine. P4 decisions supply the stronger acceptance details. [VERIFIED: REQUIREMENTS.md:23-49; 04-CONTEXT.md]
</phase_requirements>

## Standard Stack

| Component | Fixed version / facility | Use and evidence |
|---|---|---|
| midPoint | `4.8.14` | Runtime and extracted XSD authority; the image declaration is `FROM evolveum/midpoint:4.8.14-alpine` [VERIFIED: docker/midpoint/Dockerfile:32; ADR 0006, Decision] |
| SCIM2 | `V1.2.9`, source `05c404bbecf9c28938e2183411c7b04b4f8f4226` | Pinned source inspection; never upgrade as a workaround [VERIFIED: docker/midpoint/Dockerfile:11-12; ADR 0006, Decision] |
| CSV | `2.8` | Inspected supplied connector classes and manifest; existing bundled connector |
| Script checks | Existing Node runtime and `node:test`; Bash and PowerShell | Reuse repository script/test conventions; no dependency install |
| XML validation | Existing `xmllint`, supplied XSDs and local catalogs | Full non-network XSD validation plus contract checks; malformed or unavailable schemas fail closed |
| Backend replay | Existing TypeScript/Node test suite | Genuine envelopes replay through mounted HTTP [VERIFIED: apps/backend/tests/iam-scim-replay.integration.test.ts:1-10,87-89] |

**Installation:** none. No package legitimacy installation gate is necessary because no package is added. The supplied extraction and existing binaries are references, not new runtime dependencies. [VERIFIED: 04-CONTEXT.md, Implementation discretion]

## Evidence Roots and Provenance

`SCHEMA_ROOT` means the supplied extracted `schema/xml/ns/public/` directory; citations below are relative to that root. `CSV_ROOT` means the supplied sibling `csv/`; class citations are relative to it. Do not bake machine paths into plans or scripts. Require an operator-supplied root for offline schema checks. The local SCIM2 source was read and its HEAD matched the pinned commit above. Public source references use `https://github.com/ExclamationLabs/connector-scim2/blob/05c404bbecf9c28938e2183411c7b04b4f8f4226/src/main/java/com/exclamationlabs/connid/base/scim2/` plus the named file. [VERIFIED: ADR 0006, Decision; local source HEAD and inspected source files]

The following schema table reports inspected declarations and inherited types, not a claim that every fragment alone is a complete importable object. Resource-instance attributes and connector configuration properties are dynamic; their namespace/schema must also be confirmed by live discovery. [VERIFIED: common/common-provisioning-3.xsd:148-196,866-923; connector/icf-1/connector-schema-3.xsd]

## Version-specific XML Vocabulary

| Path / containing type | Exact supported names and types | Inspected source |
|---|---|---|
| ResourceType | `connectorRef`, `connectorConfiguration`, `schemaHandling`, `consistency` | common/common-provisioning-3.xsd:132-220 |
| schemaHandling | `objectType` → ResourceObjectTypeDefinitionType | common/common-provisioning-3.xsd:536-555 |
| ResourceObjectTypeDefinitionType | `kind`, `intent`, `delineation`, `focus`, `attribute`, `activation`, `correlation`, `synchronization` | common/common-provisioning-3.xsd:581-594,798-1004 |
| focus specification | `type`, `archetypeRef` | common/common-provisioning-3.xsd:1052-1097 |
| refined resource item | `ref`; mapping directions `outbound`, `inbound` | common/common-core-3.xsd:4149-4160; common/common-provisioning-3.xsd:1864-2020 |
| AbstractMappingType | `strength`, `source`, `expression`, `target`, `condition`, `enabled` | common/common-core-3.xsd:5240-5321 |
| VariableBindingDefinitionType | `path` | common/common-core-3.xsd:5470-5515 |
| expressions | `script` → ScriptExpressionEvaluatorType; `code` | common/common-core-3.xsd:6240,6350-6413 |
| ResourceActivationDefinitionType | `administrativeStatus`, `validFrom`, `validTo`, `disableInsteadOfDelete` | common/common-provisioning-3.xsd:2132-2187 |
| disableInsteadOfDelete | AbstractPredefinedActivationMappingType; optional `lifecycleState` only | common/common-provisioning-3.xsd:2234-2261 |
| UserType / FocusType / AssignmentHolderType | `employeeNumber`; `linkRef`, `activation`; `assignment` | common/common-core-3.xsd:1512,1700-1777,2200-2435 |
| AssignmentType construction | `construction`; ConstructionType `resourceRef`, `kind`, `intent` | common/common-core-3.xsd:2993,8756-8779 |
| ObjectTemplateType | `mapping`, `correlation`; scoped archetype policy has `objectTemplateRef` | common/common-core-3.xsd:9004-9050,9593,9679 |
| inbound mapping use | `use` → InboundMappingUseType | common/common-core-3.xsd:9230-9290 |
| correlation | `correlators`, `thresholds`; composite `items`, `filter`, `expression` | common/common-correlation-3.xsd:35-67,165-193 |
| confidence threshold | `definite`, `candidate` | common/common-correlation-3.xsd:1156-1184 |
| synchronization | `opportunistic`, `reaction`; reaction `situation`, `condition`, `actions` | common/common-provisioning-3.xsd:5370-5539 |
| actions | `createCorrelationCase`, `inactivateFocus`, `inactivateResourceObject` | common/common-provisioning-3.xsd:5590-5617 |
| ResourceConsistencyType | `operationRetryPeriod` duration, `operationRetryMaxAttempts` int | common/common-provisioning-3.xsd:1386-1405 |
| TaskType | `executionState`, `executionConstraints`, `schedule`, `activity` | common/common-tasks-3.xsd:164,439,463,551 |
| task schedule | `interval` integer seconds, `cronLikePattern` string | common/common-tasks-3.xsd:1641-1663 |
| execution constraints | `group`, `groupTaskLimit`; distribution `workerThreads` | common/common-tasks-3.xsd:673-710,3756 |
| activity/work | `recomputation`, `reconciliation`, `liveSynchronization`, `shadowRefresh` | common/common-tasks-3.xsd:1908-2016 |
| recomputation | inherited `objects`; `executionOptions` → ModelExecuteOptionsType | common/common-tasks-3.xsd:7128-7146,7411-7435 |
| ModelExecuteOptionsType | `reconcile` boolean | common/common-core-3.xsd:17378-17395 |
| ObjectSetType | inherited `type`, `archetypeRef`; `query`, `searchOptions` | common/common-tasks-3.xsd:6864-6948 |
| reconciliation / liveSynchronization | `resourceObjects` → ResourceObjectSetType; its `resourceRef`, `kind`, `intent`, `query` | common/common-tasks-3.xsd:6973-7072,7458-7476,7525-7553 |
| shadowRefresh | `shadows` → ObjectSetType (not ResourceObjectSetType) | common/common-tasks-3.xsd:7268-7296 |

All exact names in this table are [VERIFIED: supplied 4.8.14 XSDs at the listed locations]. Preserve XSD sequence order and inherited declarations in the validator. In particular, do not add `enabled` beneath `disableInsteadOfDelete`, do not put `resourceObjects` beneath `shadowRefresh`, and do not invent a task `timeZone` child. Set and verify the process/JVM UTC scheduling context, then prove the nightly observed times. [VERIFIED: common/common-provisioning-3.xsd:2234-2261; common/common-tasks-3.xsd:1580-1677,7268-7296]

### Minimal schema-grounded fragments

Under the resource object type, this predefined mapping has the following supported shape:

```xml
<activation>
    <disableInsteadOfDelete/>
</activation>
```

The declaration supplies disable-on-unassignment semantics; actual lifecycle traffic must still prove `PUT active=false` and retained linkage. [VERIFIED: common/common-provisioning-3.xsd:2187-2199,2234-2261; 04-CONTEXT.md, P4-16]

For repository-driven repair, use `activity/work/recomputation/objects` scoped to managed focuses and `activity/work/recomputation/executionOptions/reconcile`. Do not substitute ordinary SCIM resource reconciliation, whose enumeration can stop at the remote default page. [VERIFIED: common/common-tasks-3.xsd:7128-7146,7411-7435; common/common-core-3.xsd:17378-17395; 03-LIVE-PROBE.md, P3-36]

## CSV Connector 2.8 Findings

The inspected `com/evolveum/polygon/connector/csv/CsvConfiguration.class` declares getters/setters for `filePath`, `uniqueAttribute`, `nameAttribute`, `encoding`, `fieldDelimiter`, `headerExists`, `readOnly`, `tmpFolder`, `trim`, `ignoreSurroundingSpaces`, `ignoreIdentifierCase`, `quote`, `quoteMode`, `escape`, `ignoreEmptyLines`, `preserveOldSyncFiles`, and additional formatting options. `ObjectClassHandlerConfiguration.class` contains corresponding fields. `Messages.properties` explicitly documents UTF-8 default encoding, default semicolon separator and default temporary files alongside the CSV. Configure the comma separator explicitly and redirect `tmpFolder` to writable private home storage. [VERIFIED: CSV_ROOT/com/evolveum/polygon/connector/csv/CsvConfiguration.class and ObjectClassHandlerConfiguration.class, inspected class signatures; Messages.properties:1-62]

Set both key and name configuration to employeeNumber, preserve exact strings, select header handling and read-only operation explicitly, and discover the actual connector property namespace/object class before activation. Do not infer that a generic dynamic-namespace XSD validates these runtime properties. [VERIFIED: the same class signatures; 04-CONTEXT.md, P4-05,P4-06]

`ObjectClassHandler.class` implements SyncOp and declares `findOldCsv`, `loadOldSyncFile`, `doSyncCreateOrUpdate`, `createNewSyncFile`, `getLatestSyncToken` and `cleanupOldSyncFiles`. This establishes a snapshot/token mechanism and writable state requirement; it does not prove duplicate validation, atomic snapshot rejection or missing-file safety. [VERIFIED: CSV_ROOT/com/evolveum/polygon/connector/csv/ObjectClassHandler.class, inspected class signatures]

Require a whole-snapshot acceptance step before any connector read: parse normal CSV quoting, exact ordered headers, UTF-8, nonblank unique exact keys plus case-fold collision checks, required username/email uniqueness and format, and structural row consistency. A malformed date with a trustworthy key follows P4-07's disable/error rule; duplicate keys or malformed CSV reject the entire snapshot. Do not rely on per-row mappings to roll back an already partially ingested snapshot. [VERIFIED: 04-CONTEXT.md, P4-05–08]

Recommended composition: source directory stays read-only; a narrowly scoped supported scheduled ingestion step validates a complete immutable snapshot, publishes only accepted bytes into private runtime storage, and invokes the CSV resource over that accepted snapshot. Avoid a second provisioning writer. The exact task-expression mechanism and failure/atomicity behavior are [ASSUMED] until the early CSV probe; if not supportable, ENG-01/02 stays blocked. Account for source changes between validation and read by consuming the validated snapshot rather than reopening mutable source bytes. Never infer mass departure from parse, read or connector failure.

## Connector Write and Filter Compatibility

The source defines `Scim2User`, core attributes `name_givenName`, `name_familyName`, `displayName`, `title`, `emails`, `externalId`, `active`, and Enterprise `employeeNumber`, `department`. These are connector-side names; public SCIM paths are a separate translation boundary. [VERIFIED: Scim2UserAdapter.java:27-29,45-95]

**Enterprise updates:** `constructModel` calls `populateEnterpriseUser` under standard+Enterprise configuration with no create-only guard. `populateEnterpriseUser` sets department/employeeNumber only when extracted values are non-null. `update` sends the constructed object via PUT. Therefore assert each needed Enterprise delta explicitly and test the result. The source permits an Enterprise-bearing PUT; it does not prove midPoint actually supplies those attributes during every claim, mover and drift repair. [VERIFIED: Scim2UserAdapter.java:357-435,780-805; driver.rest/Scim2UsersInvocator.java:308-364]

**Optional clears:** a null Enterprise delta is skipped by the adapter; omitted fields are preserved by delivered asserted-attribute replacement. Probe an explicit empty-string clear through real mappings and inspect both serialized request and stored backend value. The source checks non-null rather than nonblank, which makes this a plausible probe, not a proven remedy. Probe title clears and optional name clears separately: update code restores existing name values when null or empty, a positive indication that blank-name clearing is incompatible with that path. Do not call successful department update proof of all optional clears. [VERIFIED: Scim2UserAdapter.java:373-383; Scim2UsersInvocator.java:326-339; apps/backend/src/iam/scim/wire.ts:49-85,89-91; apps/backend/src/iam/identity/identity-input.ts:64-69]

**Email:** the connector declares emails as multivalued strings and parses JSON objects; updates generate remove/add PATCH operations. Preserve the observed one primary work JSON value, including tolerant string primary representation in captured responses. [VERIFIED: Scim2UserAdapter.java:68,159-174; Scim2UsersInvocator.java:27-46,372-397; 03-LIVE-PROBE.md]

**Equality search:** the invocator emits the filter attribute verbatim followed by equality, and its get-by-name path is separate. Connector attributes include `emails`, not a declared `emails.value` attribute. Thus backend support of `emails.value` does not prove the connector can express that filter through its discovered schema. Capture actual employeeNumber and email equality searches, including escaping and special-character values, and fail closed on unsupported translation. Do not silently use userName or an unfiltered list. [VERIFIED: Scim2UserAdapter.java:45-95; Scim2UsersInvocator.java:135-147,183-223]

The backend's exact filter field map includes `"username"`, `"externalid"`, `"emails.value"`, `"employeenumber"`; non-source-key comparisons become case-insensitive and source keys retain exact matching. The count expressions are `integer(values.get("count"), 100)` and `Math.min(500, Math.max(0, rawCount))`. Preserve these unchanged. [VERIFIED: apps/backend/src/iam/scim/filter.ts:5-8,24-30; apps/backend/src/iam/scim/query.ts:35-39]

## Native Correlation: Proven Boundary and Unresolved Seam

The 4.8 documentation describes correlation as matching resource data to existing repository focus objects. The pinned schema makes ownerFilter return candidate focus entries, and candidate options contain `candidateOwnerRef`. An HR-to-existing-focus match is therefore a different operation from discovering and claiming an existing remote IdamBox User. [CITED: https://docs.evolveum.com/midpoint/reference/support-4.8/correlation/ ; VERIFIED: common/common-correlation-3.xsd:535-576,1007-1037]

Use resource-object-type correlation, native `createCorrelationCase` synchronization action for disputed proposals, and strictly sub-definite confidence for unowned manual targets. The default confidence is one, and `definite` has inclusive threshold one, so default singleton matches can authorize automatic owner selection. A Boolean `confirmation` expression is an evaluation predicate, not an operator approval record. The deprecated `correlation/cases/enabled` location is not the recommended 4.8 action. [VERIFIED: common/common-correlation-3.xsd:103-124,552-576,1134-1151,1167-1180; common/common-provisioning-3.xsd:5611-5617]

**Required early experiment, still unproven:** discover manual SCIM shadows using complete bounded per-HR searches; represent candidates read-only without outbound assignment; open a native case associating a selected remote shadow with the correct HR focus; after explicit confirmation link that exact shadow and issue the first keyed PUT. Test both directions of the representation to establish whether the supported 4.8 path can maintain exactly one final Identity named by employeeNumber without a provisional write or duplicate focus. The exact complete native wiring is [ASSUMED]; this research does not claim an executable configuration for that cross-boundary seam.

**Blocking disposition:** do not mark PROV-06 ready from XSD structure alone. The early probe must produce the final supported XML, sanitized native case/owner references, operator/time/outcome, proof of zero preconfirmation writes, selected SCIM-id linkage, keyed first PUT, no duplicate POST/PATCH claim, rejection behavior and concurrent ownership/protection failure behavior. If native support cannot meet these conditions, report the gap and keep provisioning suspended. [VERIFIED: 04-CONTEXT.md, P4-12–15]

## Complete Managed Reconciliation

Repository recomputation explicitly accepts an object set and model execution options. Scope it to HR-managed focuses, include disabled and absent-HR retained focuses/links, and request reconciliation so remote reads precede repair. The focus/link set is authoritative; a default remote list is not. Confirm targeted GET by id or exact source-key recovery for unlinked known HR identities. This is the recommended native composition, with >100 runtime behavior [ASSUMED] until the completeness probe. [VERIFIED: common/common-tasks-3.xsd:6864-6948,7128-7146,7411-7435; common/common-core-3.xsd:17378-17395]

Use independent setup counts for at least 125 managed users plus manual/protected/foreign controls; place drift, missing-HR leavers, an email-only manual candidate and a reset/lost-link owned user beyond the first 100. Require expected = processed and processed = succeeded + failed + held with nonoverlapping unique identities; a passing repair additionally has no unexplained failure/hold. Publish the arbitrary-orphan-inventory limitation separately. [VERIFIED: 04-CONTEXT.md, P4-19–21]

## Retry, Pending Work and Rate Safety

The pinned ResourceConsistencyType declares scalar `operationRetryPeriod` (default PT30M) and `operationRetryMaxAttempts` (default 3); its documentation positively states zero disables retries. A 60-second refresh sweep is distinct from either setting. The shadow-refresh work definition says a custom filter replaces the built-in pending-operation filter: include both resource scoping and pending-work conditions explicitly, using ObjectSetType, or the task may refresh unintended shadows. [VERIFIED: common/common-provisioning-3.xsd:1386-1405; common/common-tasks-3.xsd:7268-7296]

The pinned fault processor passes status, raw body and parser into `handleFaultResponse`, without Retry-After. Parsed recognized errors produce generic ConnectorException. The 429 one-second sleep is in a separate branch for null parsed fault data, and is not evidence of compliant scheduling for real SCIM responses. This positively establishes a header/classification gap in that handler; whether inherited request handling supplies a compliant retry signal elsewhere is [ASSUMED] until live proof. Never claim all runtime retry behavior impossible solely from this source. [VERIFIED: driver.rest/Scim2FaultProcessor.java:27-85,93-117]

**High-risk unresolved feasibility:** the inspected scalar resource retry settings do not establish P4-23's increasing per-operation sequence, one-hour cap, retained work, ten-failure operator state and continuing capped cadence. Do not invent retryInterval/backoffFactor XML. PlannedOperationAttemptType is an experimental state structure, not evidence of a resource retry policy. Require a documented supported composition plus actual attempt traces; absence of a found policy is not proof of impossibility. [VERIFIED: common/common-provisioning-3.xsd:1386-1405; common/common-core-3.xsd:20773-20810]

Stage automatic retries disabled. The early isolated retry experiment must capture a CSV-origin failure, actual connector exception classification, durable pending operation, all eligible/attempt times, 503 Retry-After, 429 delay, increasing delay starting at 60 seconds, one-hour cap, ten-failure visible state and recovery with no duplicate. Test 401/403 suspended writes, local 409, invalid data, native unresolved case, and repeatable remote email-conflict 503 separately. A shortened clock or synthetic offline event ledger cannot establish the real-hour cap. If compliant behavior cannot be proven, leave LIFE-04 and affected ENG-03 acceptance blocked, retaining pending work. [VERIFIED: 04-CONTEXT.md, P4-22–25]

## Architecture Patterns

Treat configuration as a staged state transition: validate complete selected object set and credentials → suspend affected tasks → render one named credential slot → apply resources/support/template → test protected credential and connection → enable only eligible tasks. On any partial failure keep dependent tasks suspended. Configuration PUT must preserve runtime task progress/sync tokens, case data and focus linkRefs; do not blindly replace state-bearing task containers. Test fresh and reused home separately. [VERIFIED: 04-CONTEXT.md, P4-01–04; docker/midpoint/init.sh; docker/midpoint/reload.sh; docker/midpoint/reload.ps1]

Reuse a shared rendering contract for seed, Bash reload and PowerShell reload. Prefer an existing container runtime language for rendering, or a tested host contract with secure stdin delivery; confirm availability before selecting a language inside the image. XML-escape only the named slot, reject unsupported placeholders and invalid credentials, never evaluate environment text, and close diagnostics. Source diagnostics must not forward connector raw response bodies. [VERIFIED: 04-CONTEXT.md, P4-02–03; docker/midpoint/e2e/capture-scim.mjs:21-38]

Use a narrowly scoped HR archetype/template assignment with immutable employeeNumber name and HR-only inbound authority. Derive activation with strict date parsing and UTC clock injection for offline tests, then reevaluate date boundaries independently of unchanged CSV bytes. Do not convert exclusive end dates to inclusive validTo accidentally; prove exact midnight boundaries. [VERIFIED: 04-CONTEXT.md, P4-06–09; common/common-provisioning-3.xsd:842-866; common/common-core-3.xsd:9593,9679]

## Don't Hand-Roll

| Problem | Use | Avoid |
|---|---|---|
| Operator confirmation | Native cases and recorded decisions | Backend claim screen or Boolean predicate presented as approval |
| Provisioning | Installed connector through Strapi SCIM | Direct backend writer, custom endpoint, connector modification |
| Pending writes | Proven supported pending-operation path | Independent HTTP retry worker or fabricated backoff fields |
| XML parsing/escaping | Existing standards parser and bounded named substitution | Regex-only XML root parsing, shell interpolation, sourced environment text |
| Capture/replay | Extend existing sanitization/provenance/isolation contract | Invented envelopes or relabeled direct HTTP probes |
| CSV parsing | Existing standards CSV parsing facility in the chosen supported runtime | Comma splitting or partial snapshot acceptance |

These restrictions derive from P4-01–04,11–15,22–29. No new package installation follows from this table. [VERIFIED: 04-CONTEXT.md]

## Common Pitfalls

- Schema-valid configuration can still emit wrong traffic: assert backend post-write D19 state and actual optional clears, not merely matching XML. [VERIFIED: 04-CONTEXT.md, P4-11]
- A manually claimed employee-number match needs confirmation too; deduplicate separate email/key searches by stable id and hold disagreement or partial search. [VERIFIED: 04-CONTEXT.md, P4-12–15]
- Do not put tokens into command arguments, committed XML, seed .done copies, raw import errors or diagnostic captures. Compose must explicitly supply the variable. [VERIFIED: 04-CONTEXT.md, P4-02–03; docker/docker-compose.yaml:76-89,102-121]
- Disappearance from a complete accepted snapshot disables; an unreadable or malformed source does not. Snapshot validation must precede every run, not only initial installation. [VERIFIED: 04-CONTEXT.md, P4-07–08]
- Polling every 300 seconds leaves processing latency unaccounted for; publish near the worst poll phase and measure source publication to committed backend state. Keep ENG-02 pending if the observed bound fails. [VERIFIED: 04-CONTEXT.md, P4-17]
- `workerThreads=1` limits a task's workers, not all tasks writing one projection. Serialize the resource's write-producing tasks with shared execution constraints and test actual overlap. [VERIFIED: common/common-tasks-3.xsd:673-710,3756; 04-CONTEXT.md, P4-17,P4-23]
- A successful SCIM response or source lastActivityAt update is not proof of user mutation; join request/audit identifiers to resulting user state and lastSyncedAt. [VERIFIED: 04-CONTEXT.md, P4-27]

## Recommended Sequential Waves

The following is decomposition guidance; the planner should give each small delivery or live checkpoint its own plan, explicit dependencies and evidence filename. [VERIFIED: 04-CONTEXT.md, P4-29–30]

1. Offline CSV fixture contract, exact header/key/date validation and deterministic scenario fixtures.
2. Offline source/schema inventory, object/OID manifest and full selected-set XML validation.
3. Offline shared credential renderer and seed/reload failure ordering, private spool cleanup and redaction tests.
4. Offline isolated compatibility/evidence harnesses and negative evidence-validator tests.
5. **Orchestrator-run live probe:** CSV discovery, validated snapshot publication, deletion/malformed-source semantics, UTC date reevaluation; produce `04-CSV-PROBE.md`.
6. **Orchestrator-run live probe:** Enterprise update/assertion/clear and connector equality filter names; produce `04-CONNECTOR-PROBE.md` with sanitized exchanges. Stop dependent D19 work on incompatibility.
7. **Orchestrator-run live probe:** read-only manual representation, native case confirmation/rejection and first keyed PUT; produce `04-CORRELATION-PROBE.md`. Stop provisioning if P4-15 cannot be met.
8. **Orchestrator-run live probe:** pending-operation classification, 503/429 spacing, increasing/capped delay and operator state; produce `04-RETRY-PROBE.md`. Keep automatic retry suspended on failure.
9. Offline persistent HR/resource/template configuration grounded in passed probes; scoped activation and disable-instead-of-delete contracts.
10. Offline independent tasks for live sync/date reevaluation, nightly HR reconciliation, focus/link-driven remote repair and pending refresh; preserve task runtime state on reload.
11. **Orchestrator-run live configuration gate:** fresh/reused seed, both reload paths, rotation/revocation, encrypted token persistence and failure suspension; produce `04-CONFIGURATION-EVIDENCE.md`.
12. **Orchestrator-run live tracer:** one genuine CSV joiner, mover and terminated leaver with D19 state, role preservation, audit chain and five-minute timing; produce `04-LIFECYCLE-EVIDENCE.md`.
13. **Orchestrator-run live claim/authority gate:** singleton email and employee proposals, ambiguity/rejection/protected/foreign/concurrent controls; produce `04-CORRELATION-EVIDENCE.md`.
14. **Orchestrator-run live completeness/drift gate:** at least 125 owned identities, retained absent-HR links and lost-link recovery; prove nightly schedules and complete counts; produce `04-COMPLETENESS-EVIDENCE.md`.
15. **Orchestrator-run live outage/recovery/conflict gate:** CSV-origin joiner, mover/reactivation, leaver outbox and genuine automatic retry; produce `04-RECOVERY-EVIDENCE.md`.
16. **Orchestrator-run live measurement/recapture:** first cold reference reconciliation measured separately from warm and 125-user runs; genuine phase-local connector capture; produce `04-THROUGHPUT-EVIDENCE.md` and `04-CAPTURE-EVIDENCE.md`.
17. Offline update genuine replay fixture and provenance; preserve historical Phase 3 capture, replay actual bytes with declared substitutions only.
18. **Orchestrator-run final acceptance:** code/security review, all criterion/evidence checks and unfiltered backend/client-contract regression; produce `04-GATE-EVIDENCE.md`. Never report a runtime pass from missing evidence.

Evidence filenames above are proposed phase-local outputs, not existing artifacts or execution claims. No plan should create a success-shaped evidence placeholder before the live operation.

## Validation Architecture

**Existing baseline:** Node built-in tests and TypeScript backend test compilation, plus standalone script checks. The backend script runs maintenance-switch refusal, two TypeScript compilation steps and serial Node tests. The existing capture runner supports `--check`, `--run`, `--verify-evidence`. [VERIFIED: apps/backend/package.json, scripts.test; docker/midpoint/e2e/capture-scim.mjs:370-381]

Recommended new offline checks use standalone `node --test` tests of script modules, fake subprocess adapters and temporary directories, with the clock explicitly injected. A test must assert behavior rather than mirror XML text. Proposed commands below are executable acceptance contracts for files created by the relevant plan, not claims those files exist today.

| Requirement / concern | Proposed check | Offline / live |
|---|---|---|
| ENG-01 snapshot/key/date semantics | `node --test docker/midpoint/tests/hr-snapshot.test.mjs` | Offline; malformed quotes/header/duplicates/case-only key/leading zeros/unicode/atomic rejection |
| ENG-01 configuration structure | `node docker/midpoint/validate-config.mjs --check` | Offline; full selected set, namespace-aware parents/types/order, fixed OIDs, no users, scoped template |
| P4-02–04 rendering/reload | `node --test docker/midpoint/tests/config-render.test.mjs` | Offline; no mutation before validation, missing token, escaping, redaction, stale credential failure, cleanup, preserved state |
| ENG-02 time rules | Snapshot/date test with fixed and relative UTC dates | Offline boundaries; actual transition latency live |
| PROV-06 native semantics | Case evidence validator with omitted/forged/no-write/candidate mismatch negatives | Offline validation; real native case/claim live |
| ENG-03 complete population | Gate validator with 125 expected ids, duplicates/missing links/count mismatches | Offline validation; actual connector reads/repair live |
| LIFE-04 retry policy | Ledger validator for observed header/last failure/attempt time, increasing intervals/cap/failure count | Offline validation; genuine waiting/pending recovery live |
| ENG-04 audit chain | Evidence validator rejecting orphan request/case/audit/state edges and sensitive fields | Offline validation; actual native audit live |
| Recapture compatibility | Existing replay test extended from genuine phase capture | Backend integration, without midPoint |
| Shared backend | `pnpm --dir apps/backend test` | Required final unfiltered suite |

Full schema validation must resolve all imported namespaces locally and disable network/entity expansion. `common-3.xsd` imports Prism schemas by namespace URI and includes common schema parts by URI, so a bare --schema invocation without a local catalog is insufficient. Require the operator-supplied matching extraction/catalog and fail closed if imports are unavailable; do not replace missing full validation with a claimed pass from tag-name checks. Dynamic CSV/SCIM connector schema is an additional live discovery obligation. [VERIFIED: common/common-3.xsd:53-106]

**Sampling:** run relevant sub-30-second offline units per change, aggregate standalone checks per offline wave, and the backend suite at shared-backend and final gates. Do not execute live checks inside offline CI. Re-evaluate the shared baseline; historical WINDOWS.md entry 11 exclusions are not blanket authorization. If compilation still fails, record the unfiltered failure and separately named diagnostic result. [VERIFIED: 04-CONTEXT.md, P4-29–30; .planning/WINDOWS.md, entry 11]

## Security Domain

| Control area | Applicability | Required pattern |
|---|---|---|
| Authentication | Yes | Protected source bearer delivery, rotation/revocation, no token output |
| Session handling | Yes, leaver/outage gate | Preserve backend disable/session-end outbox and active-user refusal |
| Access control | Yes | Source scope, protected controls, explicit native confirmation, no predecision write |
| Input validation | Yes | Whole CSV snapshot, strict date/key parsing, closed placeholders and supported XML |
| Cryptography | Yes | Existing protected-string encryption and hashed token boundary; no custom crypto |
| Logging/audit | Yes | Closed sanitized outcomes and native operator/cause attribution |

These control areas follow the phase's authentication, source-ownership, snapshot-validation and evidence boundaries; they are a project threat checklist, not a new compliance certification claim. Reject token exfiltration through error bodies/command arguments, privilege escalation through role mapping, mass-disable through rejected snapshots, manual-user adoption before approval, and retry storms through overlapping tasks. [VERIFIED: 04-CONTEXT.md, P4-02–03,P4-07,P4-09,P4-12–15,P4-22–27]

## Environment Availability

| Dependency | Observed availability | Planning disposition |
|---|---|---|
| Node | v24.20.0 | Offline checks available; use repository-supported runtime |
| Python | 3.14.5 | Available for reference inspection; do not assume it exists inside runtime image |
| Java class inspection | Available | Supplied CSV class declarations inspected |
| xmllint | Present | Full XSD checks need complete local catalog/import set |
| PowerShell | Present | Offline parity tests available; actual reload remains live |
| Docker/midPoint/Keycloak/running Strapi | Not available for this research | Every dependent probe is explicitly orchestrator-run |

Availability here is host inspection only, not runtime health evidence. No service was started, contacted or modified. [VERIFIED: local version/command-presence checks; supplied session boundary]

## Assumptions Log and Blocking Compatibility Risks

| ID | Unproven composition | Risk / mandatory disposition |
|---|---|---|
| A1 | Supported scheduled whole-snapshot validation/publication and date reevaluation in pinned runtime | Partial ingestion or stale dates; early CSV probe must settle mechanism and atomicity |
| A2 | Connector equality translation for email subattribute and complete bounded results | False zero/partial candidate search; block create/claim until captured |
| A3 | Explicit Enterprise and optional clears through mappings | Stale state or keyless claim; early observed write/state matrix |
| A4 | Native remote-shadow confirmation with one final HR focus and no predecision writes | Unauthorized manual mutation/duplicates; P4-15 probe blocks provisioning |
| A5 | Complete focus/link-driven reconciliation and source-key recovery above 100 | Silent population truncation; 125-user gate required |
| A6 | Durable pending work, header-aware eligibility, increasing/capped cadence and ten-failure state | Lost work, retry storm or false recovery; keep automatic retry suspended until proven |

All six are [ASSUMED] runtime compositions, not changes to locked decisions. Resolve with the specified isolated probes, without unattended policy substitution. A failed compatibility probe records the conflicting source/exchange and affected requirement; it does not silently downgrade acceptance.

## Open Questions

1. What exact supported native configuration satisfies P4-15's remote manual target confirmation? Schema owner candidates establish only focus correlation. The early case probe must return supported configuration or a blocking gap.
2. Which real deltas emit every D19 value and clear? Source shows Enterprise update support but null omission and name-restoration hazards. Capture per-field update, claim and clear outcomes.
3. Does the delivered runtime convert closed SCIM 503/429 failures into durable retryable pending work, and how can its supported policy implement P4-23? Do not infer eligibility from task cadence.
4. Can the native repository recomputation and filtered discovery remain complete for all retained links and lost-link cases above 100? Independently count the population and inspect targeted requests.

These are the A2–A6 proof obligations above; no runtime acceptance is claimed.

## Sources

- Supplied midPoint 4.8.14 extraction: `common/common-3.xsd`, `common/common-core-3.xsd`, `common/common-provisioning-3.xsd`, `common/common-correlation-3.xsd`, `common/common-tasks-3.xsd`, `connector/icf-1/connector-schema-3.xsd` at the cited lines.
- Supplied CSV 2.8 extraction: `com/evolveum/polygon/connector/csv/CsvConfiguration.class`, `ObjectClassHandlerConfiguration.class`, `ObjectClassHandler.class`, `Messages.properties`, manifest.
- Pinned SCIM2 source: [adapter](https://github.com/ExclamationLabs/connector-scim2/blob/05c404bbecf9c28938e2183411c7b04b4f8f4226/src/main/java/com/exclamationlabs/connid/base/scim2/adapter/Scim2UserAdapter.java), [user invocator](https://github.com/ExclamationLabs/connector-scim2/blob/05c404bbecf9c28938e2183411c7b04b4f8f4226/src/main/java/com/exclamationlabs/connid/base/scim2/driver.rest/Scim2UsersInvocator.java), [fault processor](https://github.com/ExclamationLabs/connector-scim2/blob/05c404bbecf9c28938e2183411c7b04b4f8f4226/src/main/java/com/exclamationlabs/connid/base/scim2/driver.rest/Scim2FaultProcessor.java). Local checkout identity matched ADR 0006's commit.
- [4.8 correlation](https://docs.evolveum.com/midpoint/reference/support-4.8/correlation/) — focus-owner semantics, placement, correlation-only inbound mappings; page modified 2026-02-26.
- [4.8 work definitions](https://docs.evolveum.com/midpoint/reference/support-4.8/tasks/activities/work/) — repository recomputation, resource reconciliation and pending shadow refresh; page modified 2022-02-04.
- [4.8 shadow refresh](https://docs.evolveum.com/midpoint/reference/support-4.8/tasks/shadow-refresh-task/) — controlled pending refresh; page modified 2024-09-04.
- Repository constraints: `04-CONTEXT.md`, IAM brief D1–D26, IAM roadmap/requirements/state, root project/AGENTS.md, ADRs 0002–0006 and Phase 3 live/capture/gate/review records.

## Metadata

Pinned schema/source findings remain applicable while the version/source pins remain unchanged. Runtime compositions remain unaccepted until the named live evidence exists. This document writes research only and makes no implementation, execution, commit or acceptance claim.

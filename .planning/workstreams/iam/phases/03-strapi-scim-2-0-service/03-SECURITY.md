---
phase: "03"
slug: "strapi-scim-2-0-service"
workstream: iam
status: secured
threats_open: 0
threats_total: 19
threats_closed: 19
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-16"
---

# Phase 3 — Security

The implemented mitigations for T-03-01 through T-03-17 and T-03-SC are verified after the two log-privacy remediations below. **T-03-18 remains OPEN/high:** its final execution evidence does not exist. This audit does not certify Phase 3 completion or waive that gate.

## Scope and decisions

- Execute only 03-17 task 2. Initial audited revision: `f7eee026`; final implementation revision: `26a28101`; Phase 3 comparison baseline: `c0d48b8b`. Implementation remediation changes provisioning failure logging and SCIM request logging, with automated tests.
- Input state B: no prior SECURITY report; 18 PLAN files contain parseable threat models, and 16 execution SUMMARY files exist. Every PLAN threat row and SUMMARY threat/acceptance statement was reconciled with current code and later evidence. The 18 repeated T-03-SC rows describe one shared threat: 36 authored rows become 19 distinct IDs. There are no additional distinct threat IDs in the summaries.
- The active `verify:post` secure-phase hook was checked. Resolved settings are ASVS level 1 and block-on high. Verification ran inline under the invoked skill's dispatch restriction. The explicit unattended instruction selects verification and narrow remediation of gaps, with no risk acceptance and no questions.
- Historical intermediate SUMMARY assertions are not the final contract. The 03-01 orchestrator acceptance resolves its original compilation blocker using the two WINDOWS.md entry 11 exclusions. P3-33/P3-34/P3-35 supersede earlier create/PUT/email descriptions; current bounded wire tests and captured replay verify them. The 03-08, 03-12 and 03-15 pending mounted/live contributions are supplied by later 03-09/10, 03-13 and 03-16 artifacts.
- The explicit requirement to audit **every** final PLAN row includes T-03-18. Its mitigation requires actual final suites and published requirement evidence, beyond this audit. It is not silently omitted, marked accepted, transferred, or treated as closed merely because a plan exists. The instruction not to run 03-18 is preserved. This is an outstanding execution gate, not an identified code mitigation that can be repaired by a narrow source edit.
- All file references below are repository-relative, with line numbers on the audited source. Automated tests use isolated fixtures, synthetic credentials and fake remote HTTP boundaries. No operational server, Docker, Keycloak, midPoint or browser run was performed. No operational environment file or credential was opened or printed. Tests exercise the exporter only against disposable synthetic destinations.

## Trust Boundaries

| Boundary | Description | Data crossing |
|---|---|---|
| Untrusted HTTP → pre-parser SCIM boundary | Socket-IP budget precedes source authentication; independent activity precedes source budget, parser and route policy | Bearer credential, headers, query and bounded JSON |
| Authenticated source → current capability | Private instance/request authority; persisted source/service/Application invariants and exact Role → Function → FunctionAPI read afresh | Source documentId and exact method/template grant |
| Source → people | Own and eligible manual public reads; explicit keyed PUT claim; foreign/protected/tombstoned records hidden | Allowlisted source identity DTO |
| Identity service → persistence/remote identity system | Shared lock and transaction precede deciding reads and one accepted write; inactive writes queue durable work | Source tuple, account status, HR fields and outbox state |
| Human session → current backend authorization | Valid existing credentials still need a currently active human record; navigation does not authorize | Verified subject, current access, record ownership |
| Token administration → filesystem/output | Committed hash-only lifecycle; guarded private atomic export; failed delivery compensation | One transient plaintext credential |
| Runtime observation → published evidence | Sanitize before writes, pinned provenance, ordered invocations, cleanup before publication | Closed sanitized envelopes and refusal outcomes |
| Installed dependencies → runtime | Reuse existing graph; no install or dependency declaration change | Pinned dependency metadata and installed lock |
| Final gate → phase acceptance | Required executions and requirement mapping must exist before completion | Actual final results, not planned checks |

## Threat Register

All original severities and dispositions are preserved. Every row is high/mitigate; no accepted or transferred threats. Evidence references resolve to the detailed entries below.

| Threat ID | Category | Component | Severity | Disposition | Mitigation / evidence | Status |
|---|---|---|---|---|---|---|
| T-03-01 | Spoofing | Source token digest and row transaction | high | mitigate | Whole-token digest, fixed-buffer comparison, serialized metadata; E01 | CLOSED |
| T-03-02 | Information Disclosure | CLI stdout and ignored env file | high | mitigate | Committed one-time output, private atomic export and compensation; E02 | CLOSED |
| T-03-03 | Tampering | SCIM DTO and error mapper | high | mitigate | Closed field/path/mutability checks and public projection; E03 | CLOSED |
| T-03-04 | Information Disclosure | List query and source service | high | mitigate | Bounded equality DTO, scope before count/projection; E04 | CLOSED |
| T-03-05 | Tampering | Locked reducer seam | high | mitigate | Lock before reduction, one write, rollback before conflict classification; E05 | CLOSED |
| T-03-06 | Elevation of Privilege | Source context and FunctionAPI policy | high | mitigate | Private authority and fresh exact grants; human/development credentials cannot authenticate; E06 | CLOSED |
| T-03-07 | Denial of Service | Pre-parser SCIM boundary | high | mitigate | IP/source budgets, body/operation caps, closed request event without raw URL logging; E07 | CLOSED |
| T-03-08 | Elevation of Privilege | Discovery and Groups | high | mitigate | Source-authorized metadata, immutable empty Groups and write refusals; E08 | CLOSED |
| T-03-09 | Elevation of Privilege | Root manifest and handlers | high | mitigate | Exactly 21 explicit policies, sole identity-service writer; E09 | CLOSED |
| T-03-10 | Repudiation | Runtime security conformance | high | mitigate | Branch/activity/log assertions, with provisioning payload and raw-URL log gaps fixed; E10 | CLOSED |
| T-03-11 | Elevation of Privilege | Catalogue and served inventory | high | mitigate | Both catalogues, effective grants, actual layers and contract parity; E11 | CLOSED |
| T-03-12 | Information Disclosure | Live capture tooling | high | mitigate | In-memory sanitation, content-header allowlist, genuine provenance checks; E12 | CLOSED |
| T-03-13 | Tampering | Connector orchestrator checkpoint | high | mitigate | Isolated gate, genuine invocations, sanitized publication and cleanup; E13 | CLOSED |
| T-03-14 | Repudiation | Replay fixture provenance | high | mitigate | Published digest/byte equality, ordered real HTTP replay; E14 | CLOSED |
| T-03-15 | Elevation of Privilege | Existing-session refusal gate | high | mitigate | Same unexpired human/API credentials refused before recovery; E15 | CLOSED |
| T-03-16 | Elevation of Privilege | Live OIDC/page/server action boundary | high | mitigate | Recorded 1440/375 same-session page/detail/write refusal; E16 | CLOSED |
| T-03-17 | Elevation of Privilege | Post-execution review/audit gate | high | mitigate | Actual review acceptance, security remediation/rechecks, blocking outstanding gate; E17 | CLOSED |
| T-03-18 | Repudiation | Final requirement evidence | high | mitigate | Final suites and requirement mapping executed by the orchestrator: 03-GATE-EVIDENCE.md (backend 2012/2012, CSRM 5412/5412, api:check, typecheck, both evidence validators) | CLOSED |
| T-03-SC | Tampering | Dependency supply | high | mitigate | Unchanged dependency metadata/lock, matching installed lock, no install; ESC | CLOSED |

## Concrete verification evidence

Tests marked PASS below were executed during this audit, except browser scenarios explicitly identified as recorded live results. B, K, R, L, W and V refer to the commands/results in the verification ledger.

### E01 — T-03-01

`apps/backend/src/iam/scim/token-service.ts:13` enforces exact version, 24-character source id and canonical base64url; `:20` hashes every credential byte; `:27` compares exactly two 32-byte buffers including missing/malformed paths. `:49` serializes decisions through `source-lock.ts:7`; `:61` uses 32 cryptographically random bytes; `:64` persists only tokenHash/tokenRotatedAt. Plaintext never enters a stored field. Success logging is post-commit.

PASS (B): `iam-scim-token.unit.test.ts:50`, **missing source/hash still performs a timing-safe comparison of two 32-byte buffers**; `iam-scim-token.integration.test.ts:69`, **issue, automatic rotation and revoke persist only digest and independent UTC metadata**; `:115`, **independent concurrent transactions leave only the final committed rotation usable**; `:129`, **persistence failure and outer transaction rollback preserve the previous credential and emit no event**. PostgreSQL lock ordering has a metadata-backed unit test; real database concurrency here uses SQLite, not a claimed live PostgreSQL run.

### E02 — T-03-02

`apps/backend/src/iam/scim/token-cli.ts:80` emits once only after administration and requested export; `:64` compensates while holding the source lock and matches the undelivered digest, preserving a later rotation. `dev-token-export.ts:23` checks ignored/untracked paths; `:73` checks parent ownership/mode; `:65` refuses symlink/hardlink/foreign-owned destinations; `:77` reserves private staging, `:83` and `:89` use NOFOLLOW, and `:98` atomically renames after snapshot rechecks. Existing content and restrictive owner permissions are preserved. The development seed is eligibility-checked rather than repaired.

PASS (B): `iam-scim-token-cli.unit.test.ts:49`, **issue, rotate and omitted action reuse committed lifecycle and emit the secret exactly once without a listener**; `:71`, **export failure revokes the newly issued credential by stable documentId and never prints it**; `:178`, **refuses tracked or nonignored destinations, symlink destination/parent, hardlinks and unsafe directory permissions**; `:210`, **destination and parent replacement races refuse delivery and clean temporary files**; `:276`, **failed delivery compensation takes a source lock and cannot revoke a newer concurrent token**. Historical actual CLI issue/rotation/revoke and 0600 delivery are recorded in `03-CONNECTOR-CAPTURE-EVIDENCE.md:51`; no real export is rerun.

### E03 — T-03-03

`apps/backend/src/iam/scim/wire.ts:22` rejects owned/unknown keys, `:33` enforces resource shape, and `:112` delegates accepted DTOs to shared validation. `mapping.ts:19` creates an explicit public allowlist. `errors.ts:37` returns fixed details/status/headers; `scim-boundary.ts:73` rebuilds exception responses without trusting their messages, bodies or headers. P3-33/34/35 compatibility concessions do not permit extra writable fields or grants.

PASS (B): `iam-scim-wire.unit.test.ts:128`, **owned fields fail mutability at every object boundary; unsupported writable paths fail invalidPath**; `:147`, **outbound allowlist omits private fields and unassigned optionals without inventing metadata**; `:168`, **all closed error mappings use safe SCIM envelopes, exact status and retry headers**. Mounted conformance also passes **fixed mapping, implicit Requestor and private read/write boundaries persist over HTTP** (`iam-scim-lifecycle.integration.test.ts:47`).

### E04 — T-03-04

`apps/backend/src/iam/scim/filter.ts:14` accepts only bounded typed eq/and: 4096 characters, 20 terms, 255 decoded characters. `query.ts:25` rejects repeated/unknown/structured parameters and caps count at 500 (default 100); `:54` projects only after public mapping. `identity-service.ts:48` scopes own/manual visibility, excludes protected/tombstoned records, and `:127` combines scope before counts and pages. Wildcard/backslash comparisons are refined within scoped batches before totals/offsets.

PASS (B): `iam-scim-query.unit.test.ts:34`, **filter grammar rejects unsupported operations, paths, literals, injection and trailing text**; `iam-scim-query.integration.test.ts:69`, **real persistence scopes own/manual records before filtering, counts and deterministic pages**; `:146`, **literal refinement excludes false matches and hidden rows before page offsets and totals**. P3-36's connector default-100 limitation remains a Phase 4 dependency, not evidence of supported full-directory reconciliation.

### E05 — T-03-05

`apps/backend/src/iam/identity/identity-service.ts:184` takes the shared user lock before fresh principal/scope reads and reducer invocation, freezes the public projection, validates the final delta and performs one mutation. `user-lock.ts:41` owns the outer transaction/retry. `patch.ts:75` limits ordered operations to 100 and rejects immutable/unknown fields; `:128` closes malformed JSON selector escapes. Write errors are classified after unwinding the outer transaction. `register-identity-writes.ts:131` preserves tombstone/source immutability and `:190` queues inactive state atomically; `keycloak-sync/outbox.ts:60` preserves durable replay/backoff history.

PASS (B): `iam-scim-patch.integration.test.ts:73`, **one locked reduction writes once, retains Roles and preserves existing DTO callers**; `:97`, **later failure and immutable-key changes leave timestamps, outbox and the whole user unchanged**; `:107`, **concurrent disjoint reductions decide from the fresh locked projection and both deltas survive**; `:150`, **database uniqueness is translated only after actual outer rollback, with no partial mutation**; `:169`, **blocking remote failure rolls back the batch; inactive PATCH uses atomic durable outbox**. R rechecks persisted remote-failure/tombstone behavior after remediation.

### E06 — T-03-06

`apps/backend/src/iam/scim/source-context.ts:9` binds issued contexts to the request object and Strapi instance through a private WeakMap. `:37` accepts only verified source credentials and commits independent activity; `:63` rechecks current token hash, principal and exact grant. `identity/source-principal.ts:50` requires one active protected, passwordless, non-human service user, unique source binding, sole Identity Provisioning Role/Function and active IAM Application. The exact FunctionAPI URL comparison occurs at `source-context.ts:76`; no request header or mutable state object grants authority.

PASS (B): `iam-scim-auth.unit.test.ts:72`, **source context is private, request and instance bound; copied or forged state never authorizes**; `iam-scim-security.integration.test.ts:89`, **every persisted source/service/application invariant is freshly enforced after a successful request**; `:159`, **rotation/revocation and exact grant withdrawal take effect on the next HTTP request**; `:185`, **human/dev/API/forged-source combinations cannot authenticate or widen valid source scope**. `iam-scim-routes.integration.test.ts:64` withdraws each of all 21 exact grants.

**Development-header boundary:** `config/middlewares.ts:8` places SCIM before both human identity middlewares and parsing. A development header alone (including API/human/forged-source combinations) gets 401; a valid source bearer with a forged human or foreign-source hint remains constrained to its original source and gets 404 on foreign records. The general development middleware may populate unused human state after successful source authentication; neither SCIM handlers nor source policy consume it. It is never accepted as SCIM authentication or source authority. No development-header fallback exists.

### E07 — T-03-07

`apps/backend/src/middlewares/scim-boundary.ts:108` consumes trusted socket-IP budget before authentication; independent source activity precedes source budget. `:124` checks advertised length and reuses the installed parser with a 1 MiB cap, including chunked/nonordinary methods. `iam/scim/limiter.ts:24` never evicts active budgets: caps are 10,000 IPs and 1,000 sources, fixed 60-second windows. `iam/scim/config.ts:13` defaults to 1200/IP and 600/source. `patch.ts:75` caps operations; `filter.ts:18` bounds grammar. The wrapper at `apps/backend/src/middlewares/scim-request-logger.ts:4` suppresses the installed raw-URL HTTP log for SCIM (SEC-02). The finally event at `scim-boundary.ts:151` contains only event/source/operation/target/outcome/status/requestId with validated templates/ids.

PASS (B): `iam-scim-limiter.unit.test.ts:31`, **attacker keys cannot exceed caps or evict an active budget; expiry frees capacity**; `:62`, **effective default budgets allow exactly 1200 IP and 600 source requests**; `iam-scim-boundary.unit.test.ts:191`, **chunked overflow is bounded for writes and DELETE without trusting Content-Length**; `:209`, **the exact 1 MiB JSON boundary is accepted and one additional byte is refused**; `iam-scim-security.integration.test.ts:310`, **low isolated HTTP budgets throttle sources after activity and trusted socket IP before authentication**. Limits are per-process; aggregate multi-instance enforcement remains the recorded P3-32 deployment requirement, not a distributed-limiter claim.

### E08 — T-03-08

`apps/backend/src/iam/scim/discovery.ts:4` advertises only implemented capabilities; `:120` returns an empty standard Group list, `:124` fixed resource 404, and `:127` write 501. Every discovery/Group handler is behind the same explicit source policy in `routes.ts:15`. Groups cannot create Role or membership authority.

PASS (B): `iam-scim-discovery.unit.test.ts:9`, **discovery advertises only implemented capabilities and bearer authentication**; `iam-scim-routes.integration.test.ts:118`, **authenticated discovery reads, unknown descriptors and all eight unsupported Group writes use SCIM responses**; `iam-scim-lifecycle.integration.test.ts:217`, **authenticated discovery and empty Groups advertise the subset and reject every write without roles**. The outdated active-field discovery wording retained by review IN-05 is descriptive debt; current PUT cannot reactivate by omission and is tested.

### E09 — T-03-09

`apps/backend/src/iam/scim/routes.ts:7` creates explicit exact-operation policies with `auth:false` for the independent source boundary; `:31` registers once on the root manager. `handlers.ts:33` accepts only server-issued context and delegates mutations to the six existing identity-service operations. No second user writer, frontend facade, `/api/scim/v2` alias or generic grant route is added.

PASS (B): `iam-scim-routes.integration.test.ts:42`, **exactly 21 method/template layers mount once at the real root, with no content-api aliases**; `:95`, **CSRM API tokens, human credentials and forged source headers alone cannot authenticate SCIM**; `:108`, **representative existing CSRM read and ownership refusals remain unchanged**. Actual served-layer checks in E11 also pass.

### E10 — T-03-10

`apps/backend/src/iam/scim/source-activity.ts:6` refuses ambient transactions, validates persistence and commits its own timestamp before business work; failures emit a separate closed event and prevent authority issuance. `scim-boundary.ts:143` closes exception/returned errors and always logs once; `identity-service.ts:248` logs fixed mutation fields without source values. The provisioning error log at `keycloak/register-idambox-user-provisioning.ts:93` previously appended a remote-derived exception message. Remediation SEC-01 removes that payload while rethrowing the original error, retaining rollback and the existing 503 mapping.

PASS (B): `iam-scim-security.integration.test.ts:220`, **parser/media/payload/namespace/exception branches have closed envelopes, independent activity and one safe event**; `:251`, **activity persistence failure rolls back itself, fails closed before work and logs a separate safe failure**; `:271`, **sync timestamps change only on accepted writes including replay; token events stay distinct**. PASS (K): `keycloak-provisioning.unit.test.ts:570`, **provisioning rollback logs withhold remote error fields for create and update**. This new regression failed before the fix with injected remote text in the log; afterwards all 31 provisioning unit tests pass. R verifies no change to persisted rollback, safe responses or refusal behavior.

### E11 — T-03-11

`apps/backend/tests/contract-catalogue.integration.test.ts:2510` checks both catalogue copies byte-for-byte, preserves existing operation/grant digests, checks all 21 exact routes and operation-local `/` servers and source security. `served-operations.integration.test.ts:682` independently derives the exact Role → Function → FunctionAPI grants, excludes every existing Role, checks mounted policies/auth strategy, and refuses human credentials. `:721` verifies sole active IAM Application membership and repeated-seed stability; `:904` refuses missing/duplicate/aliased/unprotected root inventory.

PASS (B): **IAM root SCIM contract is additive and preserves all existing operations and grants**; **the two catalogue copies are byte-identical** (`served-operations.integration.test.ts:676`); **IAM serves every root SCIM operation with source authentication and no existing-role grants**; **IAM Function belongs only to the active IAM Application and repeated seed preserves capability bindings**; **root inventory rejects missing, duplicate, aliased and unprotected SCIM routes**. Both reference and bootstrap catalogue contents were audited by these independent contract and runtime checks.

### E12 — T-03-12

`docker/midpoint/e2e/scim-evidence.mjs:41` sanitizes headers/body/query in memory before persistence; `:147` checks closed provenance, pins, invocations, substitutions and complete scenarios. `capture-scim.mjs:56` observes streams without replacing payloads, `:115` sanitizes at observation, and `:343` validates before private staging/publication. No raw Authorization/cookie/token/error body is published.

PASS (B): `iam-scim-capture-tooling.unit.test.ts:23`, **authored sanitation removes credentials and non-content headers before persistence**; `:93`, **authored sanitation refuses secrets in values, escaped query strings and closed metadata**; `:110`, **authored evidence rejects every missing scenario, direct lifecycle, unknown versions and invented provenance**; `:152`, **authored substitutions reject undeclared, malformed, duplicate, unused and non-dynamic replacements**. These are explicitly authored tooling tests, not fabricated live capture. V validates the actual published capture separately.

### E13 — T-03-13

`docker/midpoint/e2e/capture-scim.mjs:86` guards disposable database/run identity, `:200` drives genuine midPoint shadow operations with pinned version checks, `:302` independently attempts cleanup, and `:318` refuses publication without successful cleanup. `scim-evidence.mjs:207` bounds execution with an independent cleanup budget.

PASS (B): `iam-scim-capture-tooling.unit.test.ts:193`, **authored isolation guard accepts only the disposable database for the exact run on port 1337**; `:289`, **authored runtime drives only midPoint lifecycle operations and isolates direct conformance probes**; `:309`, **authored partial create failure cleans up its allocated resource and closes capture**; `:324`, **authored runtime version mismatch performs no mutations or capture-session cleanup**. Recorded live result: `03-CONNECTOR-CAPTURE-EVIDENCE.md:3` and `:22`, 47 sanitized envelopes, real connector connection/lifecycle plus separately labelled direct Schemas/config/Groups probes; cleanup recorded at `:67`. The later refusal evidence `03-REFUSAL-EVIDENCE.md:56` records cleanup of earlier fictitious remote users. PASS (V): current offline validators; no new live attestation is claimed.

### E14 — T-03-14

`apps/backend/tests/iam-scim-replay.integration.test.ts:10` compares fixture bytes directly with published capture; `:65` checks both provenance digests and substitution/origin coverage; `:89` replays all 47 envelopes in exact order through the mounted stack, asserts JSON/headers/status, writes, roles/references/tombstone and foreign-source isolation. The replay helper sends captured headers without the convenience helper's defaults.

PASS (B): **replay fixture preserves every published capture envelope byte for byte**; **published digests, declared substitutions and genuine operation coverage are complete**; **all 47 captured envelopes replay in order through mounted HTTP with persistence and source isolation**. Capture SHA-256: `52a5a3d28f4eee56cd398404c72f370572720041c4c8a173b831b53bd2a693ae`. This is current regression against historical traffic, not a new connector run.

### E15 — T-03-15

`apps/backend/tests/helpers/iam-live-scim-gate.ts:154` proves the positive baseline; `:158` validates the same signed unexpired token and requires 403 on access/data/detail/write before recovery. `:96` checks inactive state and pending work; `:106` retains references. `src/middlewares/csrm-keycloak-identity.ts:49` matches the verified subject to a currently active record on each request. `identity/register-identity-writes.ts:190` queues deactivation in the same transaction. `keycloak-sync/worker.ts:30` rechecks fenced work and inactive state before remote disable/end-session completion.

PASS (B): `iam-scim-refusal.integration.test.ts:10`, **PUT refuses the same signed human and API credentials before outage recovery, retaining references**, and the equivalent **PATCH** and **DELETE** cases (3/3); `iam-scim-refusal-tooling.unit.test.ts:15`, **refusal and pending work precede recovery; only closed outcomes leave the runner**; `:22`, **every failed stage cleans up; attempted stop always restores even when stop fails**. Recorded actual outage evidence `03-REFUSAL-EVIDENCE.md:25` through `:32` establishes refusal before remote restart and worker recovery. R repeats the three persisted scenarios after remediation.

### E16 — T-03-16

`apps/csrm/e2e/iam-scim-refusal.spec.ts:50` defines the four PUT/PATCH × 1440/375 scenarios. `:67` retains the original session cookie; the fresh-page held-access check starts at `:73`; the scenario also refuses direct detail and asks the gate to verify same-token API writes. `apps/backend/tests/helpers/iam-live-scim-gate.ts:183` detects any browser-token change. `docker/midpoint/e2e/refusal-scim.mjs:37` orders baseline/stop/deactivate/refusal/pending/browser before recovery, and `:180` completes cleanup before publication.

Recorded PASS: **PUT refusal at 1440px before Keycloak recovery**, **PUT refusal at 375px before Keycloak recovery**, **PATCH refusal at 1440px before Keycloak recovery**, **PATCH refusal at 375px before Keycloak recovery**. `03-BROWSER-REFUSAL-EVIDENCE.md:5` records all four passes; `:17` records refused content/keyboard/overflow checks and `:24` lists inspected screenshots. `03-REFUSAL-EVIDENCE.md:6` supplies 50/50 passed ordered outcomes including API-only DELETE. PASS (V): outcomes and four PNGs validate offline. PASS (W): 36 focused session-adapter/typed-transport/protected-layout tests. No browser was launched during this audit.

### E17 — T-03-17

`03-17-PLAN.md:94` requires this actual post-execution audit. `03-REVIEW.md:99` through `:153` records each finding/disposition, five narrow remediation commits and required rechecks. Its latest **Orchestrator acceptance** at `:207` supersedes the earlier live-handoff recommendation at `:205`: the connector's captured Bearer syntax remains accepted; malformed selector escapes never appear in the captured/refusal traffic; byte-exact replay passes. This audit independently rechecks those source branches and replay. Remote 409 remains locked 503 with rollback (P3-19); P3-36 paging and discovery wording remain recorded product/documentation limitations, not permission to waive a high security gap.

PASS (B): **Bearer schemes ignore case and accept spaces while credential bytes remain exact** (`iam-scim-auth.unit.test.ts:44`); **invalid JSON escape casing in email selectors returns a closed failure without throwing** (`iam-scim-patch.unit.test.ts:126`); **SCIM projected response contract accepts independently selected email and metadata fields** (`iam-scim-contract-projection.unit.test.ts:16`), plus all three E14 replay tests. SEC-01 and SEC-02 were found, reproduced, fixed and reverified here. This report deliberately blocks the outstanding E18 execution evidence; completion of the audit process is not a Phase 3 acceptance claim.

### E18 — T-03-18 — blocking outstanding execution evidence

**OPEN/high, mitigate.** `03-18-PLAN.md:80` requires final backend/client suites, evidence validation and eight-requirement/five-criterion mapping; `:118` registers the threat. The required `03-GATE-EVIDENCE.md` and `03-18-SUMMARY.md` are absent. `03-VALIDATION.md` and `COVERAGE.md` remain planning artifacts, not substituted execution evidence. No test result can be assigned to a gate that has not run. Result: **NOT RUN / evidence missing** for the final gate's required full-suite and mapping assertions. C/B/K/R/W/V below are scoped audit checks, not that final gate.

There is no authorized narrow code fix for missing final execution. Running the final suites as 03-18, writing its artifacts, or declaring its requirement mapping complete would violate the explicit scope. No severity reduction, acceptance or transfer is used. Phase completion remains blocked pending that separately authorized execution; no automatic phase advancement occurs.

### ESC — T-03-SC

Phase history `git log c0d48b8b..HEAD -- pnpm-lock.yaml pnpm-workspace.yaml '**/package.json' package.json` contains only `3df3c6ab`: adding the `scim:token` script at `apps/backend/package.json:19`. All dependency/dev/peer/optional declarations, overrides, resolutions, packageManager and pnpm metadata in all three tracked package manifests equal the baseline. No dependency installation occurred during this audit; the completed plan summaries record reuse of installed dependencies.

PASS (audit snapshot comparison): `pnpm-lock.yaml:1` is byte-identical to baseline and the installed `node_modules/.pnpm/lock.yaml:1`, SHA-256 `65a257afef355d50472a7f550c132f855a70fc3a313d24a54a2475c7a3a9c79c`. Workspace configuration is also byte-identical, SHA-256 `3379c541241e67c5357654987ac8e2f2cd2311fbe0263c71ba9c458269b1ac61`. Installed modules metadata SHA-256 is `d8474230b741fbe2c4f42d4f840e0990cc5c9b766e12fd19b21493b544e85b08`. PASS (B): **offline check validates pinned files without credentials, Docker, listeners or evidence** (`iam-scim-capture-tooling.unit.test.ts:208`) and **authored runtime version mismatch performs no mutations or capture-session cleanup** (`:324`). Historical installed file bytes cannot be independently reconstructed from Git; these checks establish unchanged dependency selection, matching installed resolution and no recorded Phase 3 install, not a forensic attestation of every installed byte.

## Remediation SEC-01

**Original severity:** high. **Threat:** T-03-10, privacy of failure logs.

The SCIM finally-event itself was closed, but a blocking provisioning error additionally logged `error.message`. `apps/backend/src/keycloak/admin-client.ts:164` can compose that message from remote JSON `errorMessage`/`error`; truncation at `:265` does not exclude private values or embedded newlines. Thus a remote response could reach a local failure log even though the SCIM response was safe.

Fix: remove exception-message concatenation from `register-idambox-user-provisioning.ts:93`. Retain the persisted target id, fixed create/update action and rollback outcome. Rethrow the same original error. No error mapping, HTTP status/header/body, transaction, outbox state, token, grant, schema or configuration changes.

The new **provisioning rollback logs withhold remote error fields for create and update** test uses a fake remote 503 with fictitious private text and a newline in `errorMessage`. Before the fix it failed (exit 1), showing the injected value reached the log. After the fix the exact safe log, original failure status, absence of linkage writes and transaction participation pass for both actions. The earlier safe-503 log assertion is updated to the stricter fixed message. Commit: `db3b05f6`. K: 31/31 pass, no skips. R: all 27 affected persisted cases pass within B-final after both fixes.

**Wire behavior:** unchanged by SEC-01 and SEC-02. No live recapture is necessary for a log-only change with identical rethrow/rollback/SCIM mapping. The earlier WR-01/WR-02 wire changes remain documented in the published review with the explicit orchestrator no-rerun acceptance; this audit does not overwrite that evidence.

## Remediation SEC-02

**Original severity:** high. **Threats:** T-03-07/T-03-10, privacy of request logs.

The installed `@strapi/core` 5.51.0 middleware `dist/middlewares/logger.js:8` logs `ctx.url` at the HTTP level. The first middleware in `apps/backend/config/middlewares.ts:6` therefore duplicated the safe SCIM event with the raw path and query, including filter values. Existing assertions intercepted only structured info events and did not observe this outer HTTP channel.

Fix: `apps/backend/src/middlewares/scim-request-logger.ts:4` delegates ordinary requests to that same installed logger, but sends the exact `/scim/v2` namespace directly onward to the existing safe boundary event. Unknown SCIM paths and refused credentials are covered. Non-SCIM routes, logger configuration, parser ordering and error behavior are retained. `config/middlewares.ts:6` selects this wrapper instead of the raw logger. No dependency, schema or SCIM wire change.

Regression: `apps/backend/tests/iam-scim-security.integration.test.ts:201`, **mounted SCIM requests never log raw URLs on success or refusal; ordinary HTTP logging remains**. The real mounted stack first failed (exit 1) with raw HTTP messages for an unauthenticated private filter, authenticated filter and private target path. After remediation it requires zero raw SCIM messages, one closed structured event per request, and the ordinary installed HTTP log for a successful current-access request. `iam-scim-request-logger.unit.test.ts:7`, **SCIM namespace logging delegates only to the safe boundary while other requests retain the installed logger**, covers namespace/lookalike handling and configuration delegation; `:36`, **request logger fails startup closed when the installed logger is unavailable**, covers startup failure. Commit: `26a28101`. The new mounted logger assertion and the two wrapper unit cases passed in L. The unrelated low-budget fixture restart failed during that attempt; the complete final selection passes it without weakening assertions. B-final: PASS, 262/262 tests, no skips/cancellations, including all 25 logger/boundary/security cases and all 27 affected persisted workflow cases.

Review of both fixes: the original provisioning exception is rethrown unchanged; the wrapper calls `next` exactly once for SCIM and delegates unchanged for other routes. The boundary still emits its fixed-field event for successes and denials. No operational live evidence is edited or rerun. The affected mounted tests verify the actual runtime middleware registration and both logging channels.

## Verification ledger

Run date: 2026-10-16. Installed Node `v24.20.0`, pnpm `11.24.0`. C runs from the repository root. Compiled backend tests run from `apps/backend`, with `ENV_PATH` set to the nonexistent absolute path ending in `apps/backend/.tmp/iam-security-nonexistent-env`; it does not exist before or after the run. The isolated refusal fixture also overrides ENV_PATH to its own nonexistent synthetic location. No checkout configuration is loaded.

| ID | Command / scope | Actual result |
|---|---|---|
| C | `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-15.json --pretty false` | PASS, exit 0 before and after remediation. Config extends `tests/tsconfig.json` and excludes only the two WINDOWS.md entry 11 files. |
| B | `node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-scim*.test.js .tmp/tests-dist/tests/contract-catalogue.integration.test.js .tmp/tests-dist/tests/served-operations.integration.test.js` | PASS, exit 0, 222/222 tests, no skips/cancellations. ENV_PATH override plus `IDAMBOX_SEED_IAM=false CSRM_AUTH_OIDC_ENABLED=false`; isolated harnesses only. |
| K | `node --test --test-concurrency=1 .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js` | PASS, exit 0, 31/31, no skips/cancellations. New log regression first reproduced failure before remediation. |
| R | Affected compiled provisioning/lifecycle/security/refusal integration suites, exact command below | Initial attempt: 18 passed, 8 failed during security fixture setup (`dist/src/iam/identity/source-registration` missing), exit 1. Final result is supplied by B-final on unchanged assertions. |
| L | Compiled request-logger unit, security integration and boundary unit suites with `node --test --test-concurrency=1 --test-timeout=600000` | Initial attempt: 24 passed, 2 failures (one low-budget fixture restart and its teardown), exit 1; mounted logger regression, wrapper units and all boundary cases passed. Final result supplied by B-final. |
| B-final | B plus both compiled provisioning suites, after both fixes | PASS, exit 0, 262/262 tests, 0 failures/skips/cancellations, 367.098 seconds. Includes R (27 persisted cases) and L (25 logger/boundary/security cases) on final implementation `26a28101`. |
| W | `pnpm --dir apps/csrm exec vitest run src/lib/auth/oidc-session-adapter.test.ts src/lib/api/transport/server-client-oidc.test.ts src/components/shell/protected-layout.test.tsx` | PASS, exit 0, 3 files, 36/36 tests. Same ENV_PATH override. |
| V | `node docker/midpoint/e2e/capture-scim.mjs --check`; `--verify-evidence`; `node docker/midpoint/e2e/refusal-scim.mjs --check`; `--verify-evidence` | PASS, all four exit 0. Offline checks only; refusal `--check` has generic live-pending wording, while separate actual published-evidence validation succeeds. |
| D | Baseline manifest/lock/workspace and installed-lock comparisons; catalogue parity; frozen schema/JDL/generated content-type/index implementation diff | PASS. Phase 3 changes no frozen schema/JDL/generated content-type/index implementation. Dependency selection unchanged; backend package script addition only. |
| F | Committed example activation assignments | PASS: `apps/backend/.env.example:114` provisioning false, `:132` token verification false; `apps/csrm/.env.local.example:19` OIDC false. No activation configuration edited. |
| A | Report threat-register/count/reference validation, missing gate-artifact check, `git diff --check` | PASS. All 19 IDs accounted for; 18 CLOSED and T-03-18 OPEN/high; all source/test line references resolve, remediation commits exist, final gate artifacts remain absent. |

R command (backend working directory, same nonexistent ENV_PATH and off-default environment as B):

```sh
node --test --test-concurrency=1 --test-timeout=600000 \
  .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js \
  .tmp/tests-dist/tests/iam-scim-lifecycle.integration.test.js \
  .tmp/tests-dist/tests/iam-scim-security.integration.test.js \
  .tmp/tests-dist/tests/iam-scim-refusal.integration.test.js
```

Final scoped command (B-final), backend working directory and the same environment overrides:

```sh
node --test --test-concurrency=1 --test-timeout=600000 \
  .tmp/tests-dist/tests/iam-scim*.test.js \
  .tmp/tests-dist/tests/contract-catalogue.integration.test.js \
  .tmp/tests-dist/tests/served-operations.integration.test.js \
  .tmp/tests-dist/tests/keycloak-provisioning.unit.test.js \
  .tmp/tests-dist/tests/keycloak-provisioning.integration.test.js
```

Local command outputs are ignored artifacts under `apps/backend/.tmp/iam-03-security-*`; durable test names, outcomes, commands and source references are recorded here. An initial root-shell attempt at B expanded a backend-relative glob in the wrong directory and exited 1 before starting tests; it was corrected to the backend working directory. This was an invocation failure, not a failing behavior test. The initial R fixture could not resolve a compiled source-registration module. L subsequently exercised the mounted logger successfully but its second fixture boot had missing database connection configuration, followed by an already-destroyed-plugin teardown error. These are recorded failures, not waived assertions. No test/configuration was relaxed; the final unchanged scoped selection determines final verification. B began before remediation, so only B-final is claimed as the complete remediated selection. No full 03-18 backend/client gate was run.

## Accepted Risks Log

No accepted risks. No transfers. The one open high threat remains blocking. P3-32 aggregate deployment limits, P3-36 connector paging and IN-05 wording are explicitly bounded existing decisions, not newly accepted high/critical defects.

## Security Audit Trail

| Audit date | Threats total | Closed | Open | Mitigate | Accept | Transfer | Result |
|---|---|---|---|---|---|---|---|
| 2026-10-16 | 19 | 18 | 1 high | 19 | 0 | 0 | BLOCKED: T-03-18 final execution evidence absent; SEC-01/SEC-02 fixed and reverified |

## Sign-Off

- [x] Every registered threat has its original disposition and concrete evidence or an explicit missing-evidence result.
- [x] Actual implementation privacy gaps remediated narrowly with automated regressions and separate commits.
- [x] No accepted or transferred risks; no high/critical gap relabelled.
- [ ] `threats_open: 0` confirmed — false; T-03-18 remains open/high.
- [ ] `status: verified` — deliberately not set.

**Approval:** blocked. Audit of the authorized implementation scope is complete; full-phase security acceptance and the zero-blocker acceptance criterion of 03-17 task 2 remain unmet because the final register includes the unexecuted T-03-18 control. No 03-18 execution, published-evidence edit, ROADMAP.md or STATE.md update is included.

## Orchestrator closure of T-03-18 (2026-10-16)

The final gate ran on source `78794187`: backend suite 2012/2012 with no skip (only the two WINDOWS.md entry 11 files excluded, which the unfiltered command confirms are its only compile errors), CSRM `api:check`, typecheck and 5412/5412 tests, and both evidence validators. Every success criterion maps to requirement evidence in 03-GATE-EVIDENCE.md. The one fix the gate needed (`78794187`, SCIM rows in the authorization matrix asserting 401 for every CSRM caller) strengthens T-03 source/human isolation and changes no runtime code. T-03-18 is CLOSED; all 19 threats are closed and none is accepted or transferred.

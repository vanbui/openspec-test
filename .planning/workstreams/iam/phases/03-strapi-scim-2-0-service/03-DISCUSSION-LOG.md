# Phase 3: Strapi SCIM 2.0 service - Discussion Log

> Audit trail only. Planning and implementation consume 03-CONTEXT.md.

**Date:** 2026-10-15
**Workstream:** iam
**Mode:** Non-interactive; the operator delegated every gray-area choice, to be resolved from locked D1-D26, roadmap reconciliation, ADRs 0002-0006, the approved contract-gap record, domain vocabulary, Phase 2 context/summaries and actual backend code. No questions asked.
**Scope:** Discussion artefacts only. No plan, backend implementation, live capture, token issuance, runtime activation or STATE.md update.

## Evidence and precedence

The IAM roadmap identifies Phase 3 and all eight required identifiers: MODEL-02, PROV-01, PROV-02, PROV-03, PROV-04, PROV-08, LIFE-01 and LIFE-03. The roadmap reconciliation fixes adjacent-phase responsibility: immediate SCIM refusal belongs here; pending-operation completion, operator correlation and combined audit belong to Phase 4. Phase 3 nevertheless implements the Strapi request-log half of that audit and the 503 retry contract.

Phase 2's original discussion describes schema approval as pending. That historical status is superseded by the operator's 2026-10-14 approval in docs/contract-gaps/iam-identity-model-and-leaver-sync.md and the final 02-GATE-EVIDENCE.md. Several SUMMARY files also retain intermediate incomplete/failing notes; their later completion addenda and the final gate establish the delivered baseline. Neither delegated discussion nor this log grants a new model approval.

The source scout checked the six-method identity service, shared input parser, private source principals/write contexts, always-on ownership middleware, source seed, outbox implementation, current-user routes, CSRM identity middleware, mounted-operation inventory and shared contract/catalogues. It also checked the installed Strapi 5.51.0 route manager, auto-loaded API registration and bootstrap ordering. The discussion used the existing Phase 2 format; no new planning format or state transition was introduced. The Phase 3 directory had no existing context, plans, specification, continuation blocker or interrupted checkpoint; the workstream todo matcher returned no matches, and discuss:pre hooks were empty.

## Model freeze and internal boundary — P3-01/P3-02

| Option | Selected | Reason |
| --- | --- | --- |
| Transport around existing service and approved frozen schemas | Yes | Phase 2 already supplies source ownership, mutation authority, claims and leaver transactions. |
| New schema fields or a parallel SCIM persistence service | No | Only Phase 2 changes the model; parallel writers would bypass its enforcement. |

**Selection:** Delegated decision grounded in the approved gap, P2-11/P2-17 and the actual identity modules. Narrow typed filter/projection extensions are code changes, not permission to change the model.

## Root route mounting and source authority — P3-03/P3-05

| Option | Selected | Reason |
| --- | --- | --- |
| Root Strapi route-manager registration, auth:false plus explicit bearer/operation policy | Yes | Preserves /scim/v2 and the existing /api boundary while retaining source authorization. |
| Auto-loaded content-api router with a SCIM prefix | No | Installed register-routes forces content-api, whose parent router still adds /api. |
| Shared CSRM API token or development identity as SCIM authentication | No | D15 requires a source-specific credential and service identity. |

**Selection:** Delegated choice; root bootstrap registration uses the installed server.routes behavior with no routing-object type. A route prefix alone cannot escape /api. Every mounted method remains guarded, including discovery and 501 responders. Runtime path uniqueness and absence of accidental aliases are future execution assertions, not outcomes claimed here.

## Media, parsing and safe errors — P3-06/P3-07

| Option | Selected | Reason |
| --- | --- | --- |
| Scoped outer error boundary, SCIM media/envelope and closed error mapping | Yes | Parser/policy/throttle errors need the same contract as controller failures. |
| Strapi response wrappers or raw internal error serialization | No | Neither matches the SCIM consumer nor the safe Phase 2 outcomes. |

**Selection:** D11 and the internal parser/service establish the boundary. 503 uses the already implemented retryAfterSeconds=30. Official Strapi custom-route documentation supports auth:false with explicit access control; RFC 7644 supplies the Error envelope/media/pagination behavior. Existing CSRM error and parser contracts are preserved.

## Token format, lifecycle and local delivery — P3-08/P3-10

| Option | Selected | Reason |
| --- | --- | --- |
| Source-hinted 256-bit random credential, SHA-256 digest, timingSafeEqual and atomic rotation | Yes | Fits existing tokenHash/tokenRotatedAt with no schema or dependency addition. |
| Plaintext storage, token overlap or bootstrap rotation | No | Conflicts with printed-once credentials and immediate next-request revocation. |
| Explicit development-only export to ignored docker/.env | Yes | Concretely delivers MIDPOINT_SCIM_TOKEN without tracked credentials or resource XML. |

**Selection:** D15 and Phase 2's tokenless idempotent seed. Token source id is only a lookup hint; full persisted binding and operation grants authorize. CLI revoke remains usable when a source/service is inactive. File export is opt-in, atomic, owner-only and refuses tracked/symlink destinations; failed delivery revokes the new credential. Persistent midPoint resource secret injection is still Phase 4. No actual token was created or inspected in this discussion.

## D19 mapping and replacement — P3-11/P3-13

| Option | Selected | Reason |
| --- | --- | --- |
| Fixed SCIM-to-source DTO mapping and PUT replacement of source-owned fields only | Yes | D19 and Phase 2's replace parser already define one ownership boundary. |
| Merge-like PUT or replacing the entire IdamBoxUser record | No | One retains stale HR data; the other can erase Roles and Keycloak linkage. |
| New secondary-email persistence or date/manager fields | No | The approved model stores one email and excludes those fields. |

**Selection:** Explicit defaults resolve omitted displayName/active, while omitted optional HR fields clear. Select one primary email unambiguously and describe that projection honestly. externalId is the exact source key, distinct from employeeNumber matching data and externalSubject. Only explicit PUT to a manual documentId can claim under the existing trust boundary; proof of upstream confirmation stays Phase 4.

## Atomic case-insensitive PATCH — P3-14

| Option | Selected | Reason |
| --- | --- | --- |
| Ordered operation normalization into one validated delta under the shared user lock | Yes | Handles lowercase connector operations and prevents partially committed batches or stale read/patch races. |
| One database write per PATCH operation | No | Failure partway would break PATCH atomicity. |

**Selection:** D11, P2-12 and the source patch service. Support the stated email selectors and pathless values, preserve values exactly, and reject unsupported paths/unrepresentable primary-email results. Required-field removal and immutable source-key changes cannot reach persistence.

## Visibility, filter grammar and paging — P3-15/P3-17

| Option | Selected | Reason |
| --- | --- | --- |
| Visibility before filter/count/page; bounded eq/and parser and typed query translation | Yes | Reuses Phase 2's nondisclosing scope and keeps unsupported syntax out of database filters. |
| Permissive filter passthrough or filtering a previously counted unrestricted list | No | Risks unsupported operators and cross-source disclosure. |

**Selection:** D11/P2-13 and actual listForSource. Current internal equality is $eq; case-insensitive SCIM fields need a narrow typed equality extension, while externalId remains exact. Defaults are startIndex=1/count=100/max=500, with RFC negative/zero handling. Attribute projection stays within the safe allowlist, retaining id/schemas. Unsupported filter syntax always yields invalidFilter.

## Discovery and retained deletion — P3-18/P3-20

| Option | Selected | Reason |
| --- | --- | --- |
| User and Group discovery, empty Groups list, authenticated unsupported writes | Yes | Honors the connector's confirmed User+Group discovery quirk without Role provisioning. |
| Claim that the connector reads every discovery endpoint | No | ADR 0006 says its connection test calls ResourceTypes only. |
| Existing deactivation/tombstone transaction and idempotent owning-source DELETE | Yes | D12 and the implemented service preserve records, references and reserved source keys. |
| Physical delete or silent tombstone restoration | No | Violates lifecycle and reference-preservation rules. |

**Selection:** Discovery schema/config checks supplement the actual connector trace and retain separate provenance. Deactivation commits even through a full inactive PUT containing other HR updates; creates/reactivations still block and roll back on Keycloak failure. Owning-source repeated DELETE is 204; later reads and replacements stay 404.

## Throttling, audit and timestamps — P3-21/P3-23

| Option | Selected | Reason |
| --- | --- | --- |
| IP and source windows, one canonical outer SCIM event, distinct activity/sync timestamps | Yes | Covers failed/discovery requests as well as successful mutations. |
| Reuse only the internal mutation audit or treat reads as synchronization | No | Existing audit omits reads/transport failures and lastSyncedAt means accepted mutation. |

**Selection:** D21 and the approved timestamp definitions. Defaults: IP 300/minute and source 120/minute; bounded expiring maps and Retry-After. Per-instance limiter scope is explicit; shared ingress/store is required for aggregate multi-instance deployment limits. lastActivityAt follows authenticated requests independently of user-write rollback; lastSyncedAt remains service-owned and tokenRotatedAt follows token administration. No bodies, raw filters or credentials enter canonical request logs.

## Served catalogue and shared contract — P3-24/P3-25

| Option | Selected | Reason |
| --- | --- | --- |
| Activate all 21 existing reservations, including explicit Groups 404/501 responders | Yes | Makes each mounted outcome traceable through the existing provisioning Function. |
| Leave mounted operations marked unserved or broaden human grants | No | Misstates the runtime and breaks source-service isolation. |
| Add root-server SCIM OpenAPI operations and adapt inventory normalization | Yes | Current CSRM contract paths are relative to /api; SCIM is rooted separately. |

**Selection:** Actual .01-.21 catalogue entries, 02-03-SUMMARY.md, served-operation tests and specification.json. Preserve ids and existing CSRM grants/operations. Regenerate observed inventory in its maintenance mode, then run ordinary drift checks; never edit inventory to manufacture a passing gate. Shared typed-client checks remain required.

## Genuine connector capture and CI replay — P3-26/P3-28

| Option | Selected | Reason |
| --- | --- | --- |
| Explicit orchestrator-run midPoint-to-real-Strapi capture, sanitized at collection, then replay | Yes | D11/D18 and PROV-08 require the real client's lifecycle sequence. |
| Author expected fixtures and describe them as captured traffic | No | Would supply no evidence that connector 1.2.9 actually emits that sequence. |
| Use the Phase 1 discovery stub trace as lifecycle evidence | No | ADR 0006 explicitly limits that proof to discovery. |

**Selection:** The operator explicitly required an orchestrator-run capture step until genuine fixtures exist. Future plans must declare that step and its runtime prerequisites at host.docker.internal:1337. Replay provenance records actual order and payloads with declared substitutions. Any missing connector scenario requires another real trigger/capture or stays pending; authored conformance requests are separately labelled. No live capture was attempted in this discussion and PROV-08 is not marked complete.

## Next-request API and CSRM refusal — P3-29/P3-31

| Option | Selected | Reason |
| --- | --- | --- |
| SCIM deactivation followed by the same valid human token's next API requests and fresh CSRM navigation | Yes | Directly proves LIFE-01 without waiting for token expiry, logout or outbox completion. |
| Only a direct status-edit test, hidden navigation or deferred Phase 5 proof | No | Does not demonstrate the Phase 3 SCIM-to-UI/API security path. |

**Selection:** Roadmap reconciliation and actual ADR 0004 middleware/OIDC adapter/layout. Prove ordinary 403 at current-user/data operations, existing browser session refusal, direct protected detail and write denial. Local isolated runtime flags may be enabled for the gate; committed flags remain false. Full CSV onboarding/password setup stays Phase 5. Final Phase 2 evidence establishes a green backend baseline; historical intermediate failures do not waive Phase 3 regressions.

## Delegated discretion and handoff

The operator selected every area non-interactively and delegated its resolution within the locked references. Numerical limits, token syntax, CLI actions, root registration, parser defaults, safe failure behavior and evidence ownership are explicit choices in P3-01 through P3-31. Internal module splits and helper reuse remain discretionary within those decisions. There were no pending todos to fold and no approval inferred for model changes, activation or runtime evidence.

Deferred work remains Phase 4 engine configuration/correlation/retry/audit; Phase 5 password email and complete CSV sign-in journey; CSRM administration/change-log UI; and backlog-only model extensions, Group governance, restoration and source management screens. The next separate workflow may plan Phase 3 from 03-CONTEXT.md. This run stops after committing these two discussion artefacts.

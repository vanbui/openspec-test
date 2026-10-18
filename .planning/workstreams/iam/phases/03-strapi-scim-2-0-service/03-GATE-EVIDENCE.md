# Phase 3 final gate evidence (plan 03-18)

**Status:** Passed. All mandatory checks are green on the final source; the five success criteria are met with the evidence below.
**Date:** 2026-10-16 (AEDT); runs between 04:27Z and 05:06Z
**Final source:** `78794187` (plus this evidence commit)

## Mandatory commands

All run from the repository root. The backend suite ran with `ENV_PATH` pointing at a nonexistent file, so no local environment file was loaded and only committed defaults applied (Keycloak provisioning, token verification and OIDC off).

| Command | Started (UTC) | Result |
| --- | --- | --- |
| Full backend suite: `node scripts/refuse-maintenance-switches.mjs`, `tsc` (source), `tsc` (all tests except the two WINDOWS.md entry 11 files), then `node --test --test-concurrency=1 --test-timeout=600000` over every compiled test file except those two | 04:27:30 | **2012 tests, 2012 pass, 0 fail, 0 cancelled, 0 skipped**, 2152 s |
| `pnpm --dir apps/backend test` (unfiltered) | 05:06 | Stops at test compilation with 3 errors in each of `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts`, and no other error: the csrm red-phase files whose modules do not exist on this branch (WINDOWS.md entry 11, owner csrm). This is why the suite above excludes exactly those two files. |
| `pnpm --dir apps/csrm api:check` | 05:03:37 | pass; the committed generated client matches the contract |
| `pnpm --dir apps/csrm typecheck` | 05:03 | pass |
| `pnpm --dir apps/csrm test` | 05:04 | 222 files, **5412 tests pass** |
| `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence` | 05:05 | pass |
| `node docker/midpoint/e2e/refusal-scim.mjs --verify-evidence` | 05:05 | pass |

Phase 2's final baseline was 1803 tests (1802 pass, 1 platform skip). The 209 new tests are Phase 3's; there is now no skip.

### First full run (failed, fixed)

The first full run (03:48Z to 04:24Z) failed `authorization-matrix.integration.test.ts`: the served-operations inventory gained the 21 SCIM operations in 03-11, but the authorization matrix, which needs exactly one row per served operation, was not extended, and the focused checks in 03-11 through 03-17 did not include it. Fixed in `78794187` with one row per SCIM operation asserting 401 for every CSRM caller (both Requestors, the human Security Analyst, the service agent, a missing identity, a missing API token). The matrix and provenance tests passed 168/168 alone before the full rerun above.

## Static checks

| Check | Result |
| --- | --- |
| Content-type schemas, generated content-type declarations, JDL since the Phase 3 planning commit `c0d48b8b` | No change |
| Role-function catalogue copies (`apps/backend/src/bootstrap/…` and `docs/references/…`) | Byte-identical (SHA-256 `0b38fdcb…`) |
| Committed activation defaults | `IDAMBOX_KEYCLOAK_PROVISIONING=false`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`, `IDAMBOX_SEED_IAM=false` (`apps/backend/.env.example`); `CSRM_AUTH_OIDC_ENABLED=false` (`apps/csrm/.env.local.example`); no tracked config sets any of them true |
| Served SCIM operations | 21, each with its Identity Provisioning FunctionApi in the catalogue (`contract-catalogue` and `served-operations` tests in the suite) |
| Existing CSRM endpoints, operationIds, security and human grants | Unchanged: 03-11 added 21 SCIM operations only; the contract, served-operations and authorization-matrix tests pass |
| Secrets, binaries, attribution | None in the 79 Phase 3 commits or their diffs |

## Success criteria

| # | Criterion | Requirements | Evidence |
| --- | --- | --- | --- |
| 1 | `scim:token` issues, rotates and revokes; printed once, hash only; rotated or revoked token gets 401; dev token reaches the ignored `docker/.env` | MODEL-02 | Live token proof in [03-CONNECTOR-CAPTURE-EVIDENCE.md](03-CONNECTOR-CAPTURE-EVIDENCE.md) (issue, rotate, old token 401 on the next request, revoke 401, reissue 200, `--write-dev-env` exit 0 with the delivered token working); `iam-scim-token*.test.ts` and `iam-scim-token-cli.unit.test.ts` (hash-only storage, one stdout line, closed failure codes, serialized rotation) |
| 2 | midPoint's connection test passes against `/ResourceTypes` (User and Group), `/Schemas` and `/ServiceProviderConfig`; `GET /Groups` empty; Group writes 501 | PROV-04 | Live capture: `connection` scenario (`POST /resources/{resource}/test`, `GET /ResourceTypes` 200), direct `schemas`, `config` and `groups` probes; [03-LIVE-PROBE.md](03-LIVE-PROBE.md) connection test success; Group 501 in `iam-scim-routes.integration.test.ts` and the replayed capture |
| 3 | Create gives only the birthright Requestor role; GET, list, `eq`/`and` search, paging; scoped visibility; PUT and PATCH (any case) keep Roles; duplicate 409; Keycloak outage 503 with `Retry-After` | PROV-01, PROV-02, PROV-03 | Live capture: create 201, read, list, filter, mover PUT, multi-value PATCH; `iam-scim-lifecycle`, `iam-scim-query`, `iam-scim-patch`, `iam-scim-security` integration tests (Roles retained, foreign and protected users hidden, 409 `uniqueness`, fake-Keycloak outage 503 `Retry-After: 30` with rollback). Paging: server `startIndex`/`count` is covered by the query and lifecycle tests; the connector itself sends no paging (P3-36) |
| 4 | `active=false` refused on the next API request and in CSRM; `DELETE` deactivates, sets `sourceDeletedAt`, later reads 404, references kept | LIFE-01, LIFE-03 | Live gate [03-REFUSAL-EVIDENCE.md](03-REFUSAL-EVIDENCE.md) and [03-BROWSER-REFUSAL-EVIDENCE.md](03-BROWSER-REFUSAL-EVIDENCE.md): same unexpired token 403 on access, data, detail and write after SCIM PUT, PATCH and DELETE with Keycloak stopped and the outbox pending; browser refusal at 1440 and 375; DELETE references unchanged. Later-read 404: `iam-scim-lifecycle.integration.test.ts` and the live probe (DELETE 204 then 404) |
| 5 | Captured sequence replays in CI; rate limit; one structured log line per request; every SCIM operation is a FunctionApi; backend suite green with csrm unchanged | PROV-08 | `iam-scim-replay.integration.test.ts` (47 captured envelopes, byte-exact fixture); `iam-scim-limiter` and boundary tests; `scim.request` closed log event (also observed live), raw SCIM URLs kept out of the request logger (`26a28101`); catalogue and served-operations tests; the 2012-test suite above |

## Review and security

- [03-REVIEW.md](03-REVIEW.md): 0 blockers; 3 warnings fixed; info items fixed, retained under P3-19 or deferred (P3-36 to Phase 4, discovery wording). Orchestrator acceptance recorded.
- [03-SECURITY.md](03-SECURITY.md): T-03-01 to T-03-17 and T-03-SC closed with tested mitigations; T-03-18 (final requirement evidence) is closed by this gate.

## Carried to Phase 4

- **P3-36:** midPoint 4.8.14 sends no paging to the connector, so an unpaged `GET /Users` returns the default 100 users. Reconciliation above 100 users must be solved in Phase 4 (filtered correlation, a paging-capable configuration, or an approved default change).
- **IN-03:** a Keycloak email conflict during a SCIM write is reported as 503 under P3-19; a later decision may separate remote conflict from availability.
- If Phase 4 midPoint configuration changes the connector's requests, recapture and update the replay fixture in that phase.

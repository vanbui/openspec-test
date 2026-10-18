---
phase: 05-sign-in-and-end-to-end-journey
plan: "06"
subsystem: identity
tags: [iam, scim, midpoint, sqlite, lifecycle, isolation]
status: complete
verification-status: blocked-unfiltered-test-compilation
requires:
  - phase: 05-05
    provides: Ordered journey stages, private configuration and closed evidence contracts.
provides:
  - Catalogue-only bootstrap and real fresh-SQLite prerequisite, registration and token tests.
  - Disposable runtime ownership, private compose handoff and administration-before-listener ordering.
  - Validated whole CSV snapshots, bounded native task polling and stable lifecycle linkage checks.
  - Authenticated loopback stage coordination and bounded process-local revocation worker hold.
affects: [05-07, 05-08, SIGN-02]
tech-stack:
  added: []
  patterns: [injected process and filesystem boundaries, exclusive private handoffs, native task driving]
key-files:
  created:
    - apps/backend/tests/iam-journey-bootstrap.integration.test.ts
    - docker/midpoint/e2e/journey-runtime.mjs
  modified:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - docker/midpoint/e2e/journey.test.mjs
    - docker/midpoint/e2e/journey.mjs
    - docker/midpoint/e2e/journey-evidence.mjs
key-decisions:
  - A fresh source receives an initial private issue before the exact rotate CLI because rotate rejects a null token hash.
  - Existing idp state and fixed Docker resource collisions are refused rather than adopted.
  - Stored sourced-user roles remain empty; Requestor is implicit and ordinary access is verified by later browser stages.
  - Later browser, mail, remote-observation, conflict and evidence adapters remain closed until supplied.
requirements: [SIGN-02]
requirements-completed: []
actuals:
  tokens: 22431
  tasks: 2
  commits: 0
plan_head_before: 0e6c95178b8c182b1def14bd6f83b10b5928a023
plan_head_after: 0e6c95178b8c182b1def14bd6f83b10b5928a023
duration: 10min
completed: 2026-10-17
---

# Phase 5 Plan 6: Disposable CSV Lifecycle Runtime Summary

**Fresh-SQLite bootstrap and private disposable runtime drive native midPoint lifecycle tasks with stable identity checks and bounded cleanup.**

Both implementation tasks are delivered for offline review. Full unfiltered backend test compilation remains blocked by inherited diagnostics. SIGN-02 live acceptance remains pending; no live journey or successful runtime evidence was produced.

## Delivered behavior

- Extracted `seedCapabilityCatalogue(strapi)` uses the approved catalogue and Document Service, returns the role map, and preserves the existing guarded full-seed behavior. Fresh administration explicitly runs core and catalogue seeds before trusted source registration, without human or control fixtures.
- Runtime refuses foreign listeners, concurrent compilers, an existing database, missing disposable owner marker, unsafe private paths, existing idp project state and fixed container/volume/network collisions. Each compose call uses explicit project, environment file, project directory and compose file arguments with an interpolation-safe environment.
- Administration compiles, loads, initializes prerequisites, registers the exact development source, privately issues its initial credential and fully destroys before token rotation. The exact rotation CLI excludes the development exporter. A single canonical issued credential is extracted from its private pipe only after successful child completion/destruction and handed to the owner-only compose file through exclusive no-follow filesystem operations.
- Enabled listener startup follows private token handoff, forced midPoint recreation, native readiness, container-side renderer/reload and native schedule suspension. It reuses compiled output and existing worker controls; it performs no compilation while the listener runs. Automatic seeds and the development identity bridge remain disabled.
- Native objects 100/110/140/150/300/310/320/330/340 are checked. Fresh on-demand task completion requires a matching OID, a finish after the trigger, non-running execution and a successful native result. Connector paging, five-minute cadence and five/fifteen-minute retryLater configuration are preserved. Schedules are restored during cleanup.
- Run-scoped desktop/mobile/conflict people have distinct source keys and recipients. Whole joiner/mover/leaver snapshots retain prior rows and use the delivered header and validator, then publish exclusively through `hr-publish.sh`. Mover checks preserve source/Identity/document/subject linkage and aggregate both old and new invitation recipients. Leaver checks require connector PUT with inactive retained local records and pending remote work during the hold.
- Loopback coordination accepts authenticated POSTs for the currently waiting named stage and closed observation fields only. Process browser launch receives its control credential through its environment. The gate-only listener process stops/restarts the existing revocation worker, bounds the hold, refuses insufficient pre-expiry proof windows, verifies the same session and three ordinary 403 outcomes, and releases in failure cleanup.
- Cleanup closes only tracked children, restores native schedules, checks Docker project state before teardown, removes owned private token/configuration/database/journal/snapshot files, releases the compiler lock and removes the private run directory. The runner continues preserving the original stage failure when cleanup also fails.

## Verification results

All runtime tests inject command, readiness, filesystem or loopback server operations. They start no Docker container, network listener or external service.

| Check | Actual result |
|---|---|
| `node --test docker/midpoint/e2e/journey.test.mjs` | **90 passed, 0 failed, 0 skipped**, 908.372363 ms |
| `node docker/midpoint/e2e/journey.mjs --check` | Passed |
| `node --check docker/midpoint/e2e/journey-runtime.mjs` | Passed; administration/listener child programs also parsed without execution in the injected test |
| Backend source `tsc --pretty false --incremental false` | Passed, reported by the backend execution owner |
| Unfiltered backend `tsc -p tests/tsconfig.json --pretty false` | Failed on six inherited diagnostics in `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` |
| Diagnostic compilation excluding only those two inherited files | Passed; this does not establish an unfiltered pass |
| Fresh bootstrap integration test | **6 passed, 0 failed, 0 skipped**, 26012.349514 ms, reported by the backend execution owner |

The bootstrap test exercises real catalogue/source/token persistence on fresh SQLite with no provisioning calls. Its CLI dependency injection proves the real token-service contract and destruction handling, without claiming live child-process proof. An initial backend run encountered an incomplete compiled module graph; a later run exposed framework telemetry and was corrected by explicitly disabling telemetry. The final focused integration result above is the passing run.

Runtime tests cover actual compose keys and ambient alias exclusion, exact token CLI arguments, no developer environment access, canonical token parsing, owner/mode/symlink/inode races, compilation/administration/destruction ordering, schedule restoration, stale and failed native completions, snapshot validation, immutable linkage, private database cleanup, stage handshake authentication and hold release after failed refusal proof. The developer Docker environment was never read or modified.

## Deviations from plan

1. **Fresh-token precondition:** Existing `rotate` rejects a newly registered source with a null token hash. Administration therefore privately issues and discards the initial plaintext before destruction; the required child command still performs the exact `rotate` invocation.
2. **Stricter Docker ownership:** The runtime requires no existing idp project state and refuses all colliding fixed Docker names, including the globally named `clamav-db` volume. It does not reset an earlier probe's unclaimed stack. This avoids removing foreign resources through `compose down -v`.
3. **Private contract parser:** Added support for the required initially empty `MIDPOINT_SCIM_TOKEN`; other required compose values remain nonempty. Existing private contract tests cover both cases.
4. **SQLite child path:** The external contract retains an absolute owned database path. Child configuration receives its backend-relative equivalent because the delivered database configuration joins the path under the backend directory.
5. **Verification limit:** The full unfiltered test compile remains blocked by the inherited six diagnostics. Focused success is recorded separately and does not close that blocker.

## Remaining gates

- Later adapters must supply real browser/mail/remote/audit observations and implement the IN-03 conflict/recovery and completed evidence stages. Missing adapters throw a closed error; no synthetic test fixture is published as live evidence.
- Actual compose startup, token child execution, native REST/task behavior, connector audit correlation, Keycloak effects, both browser widths, pre-expiry refusal and complete cleanup need the later authorized live checkpoint.
- The six inherited test-compilation diagnostics must be resolved before an unfiltered backend verification can pass.
- No dependency, schema, generated model, catalogue or activation-default changes were introduced by this plan.

## TDD and commits

The compose environment isolation assertion was observed failing before its implementation, then passing. Additional integration boundaries were covered by injected tests during implementation. Git writes and commits were prohibited for this execution; no task or metadata commits were made. Actual token cost is characters divided by four over the six realized source/test diffs, including new file contents; it excludes this summary and unrelated concurrent changes.

## Self-Check: PASSED

All six listed source/test files exist. Runtime test and static-check results are recorded above. HEAD was unchanged and no commits were created. No live evidence directory or acceptance claim was produced.

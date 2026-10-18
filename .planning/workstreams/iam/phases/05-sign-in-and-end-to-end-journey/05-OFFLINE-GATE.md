---
phase: 05-sign-in-and-end-to-end-journey
plan: "10"
workstream: iam
status: blocked
verification-status: blocked
verified: 2026-10-18
requirements-completed: []
---

# Phase 5 offline gate

**OPEN — acceptance blocked.** This record covers only 05-10, wave 6, at `6c39366e`, including 05-08 `bfee09b3` and the delivered default mail/remote/evidence bindings. No live acceptance, phase completion or SIGN-01/SIGN-02 closure is claimed.

The working tree was initially clean. The orchestrator supplied the reconciliation fact that the default branch has no backend changes absent here; no fetch, merge, git write or backend modification was performed. The plan was rechecked inline against the current implementation: documentation and measurement remain appropriate; no contract/schema/grant/default change is authorized. No separate automated plan-checker pass is claimed. Later live plans 05-11 and 05-12 remain unexecuted. STATE.md and ROADMAP.md were left untouched.

## Required unfiltered regressions

Commands ran individually so failure of the backend command did not suppress the CSRM measurements. Durations below are measured wall time, including the package launcher.

| Exact command | Exit | Seconds | Observed result |
| --- | --- | --- | --- |
| `pnpm --dir apps/backend test` | 1 | 13.763 | Source compilation passed; test compilation stopped with six diagnostics in the two inherited CSRM red-phase files. No backend test execution occurred. |
| `pnpm --dir apps/csrm typecheck` | 0 | 6.884 | Route types generated; TypeScript passed. |
| `pnpm --dir apps/csrm test` | 1 | 111.385 | 5410 passed, 2 failed, 5412 total; 221 files passed, 1 failed, 222 total. Runner duration 109.68 s. Both failures are sandbox-only listener refusals, described below. |

Backend compilation diagnostics, preserved without exclusion:

```text
tests/risk-curation-rules.unit.test.ts(17,8): TS2307 missing ../src/csrm/risk-curation-rules
tests/risk-curation-rules.unit.test.ts(124,20): TS18046 'error' is of type 'unknown'
tests/risk-curation-rules.unit.test.ts(125,20): TS18046 'error' is of type 'unknown'
tests/risk-history-changes.unit.test.ts(15,8): TS2307 missing ../src/csrm/risk-history-changes
tests/risk-history-changes.unit.test.ts(92,33): TS7006 'change' implicitly has an 'any' type
tests/risk-history-changes.unit.test.ts(125,33): TS7006 'change' implicitly has an 'any' type
```

**Open blocker B1: WINDOWS.md entry 11, owner csrm.** The modules required by those committed red-phase tests are absent here. Neither test was edited. Only an eventual passing **unfiltered** backend command closes this gate; focused or exclusion-based results cannot do so.

**Sandbox-only limitation S1:** both failures in `src/lib/api/transport/server-client.test.ts` report `listen EPERM: operation not permitted 127.0.0.1`:

- `sends the generated applications path to the canonical Strapi REST endpoint`
- `preserves a reverse-proxy prefix that ends in the Strapi REST segment`

The restricted sandbox refuses local listening. The orchestrator must rerun the unfiltered CSRM command outside it. This execution remains exit 1; no outside-sandbox pass is inferred.

## Offline tooling and explicit discovery

Task 1 exact verification: `node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check` exited **0** in **2.286 s**. The test command reported **119 passed, 0 failed**, no cancellations/skips/todos, **duration_ms 2139.040308**, followed by the passing static-check message. An earlier standalone run of the same test file also exited 0 (119/119, wall 2.230 s, duration_ms 2153.446532).

| Command | Exit | Seconds | Observed result |
| --- | --- | --- | --- |
| `node --test docker/midpoint/e2e/journey*.test.mjs` | 0 | 3.064 | 218 tests, 218 passed; 0 failed/cancelled/skipped/todo; duration_ms 2964.078164. |
| `node docker/midpoint/e2e/journey.mjs --check` | 0 | 0.083 | Static check passed; no live acceptance. |
| `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list` | 0 | 2.032 | Closed reporter output: journey-browser-run:passed; discovery only. |
| `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list --reporter=list` | 0 | 1.701 | List reporter confirms 2 tests in 1 file, widths 1440 and 375; no browser launched. |

The journey wildcard expanded to all eight existing files: `journey.test.mjs`, `journey-access.test.mjs`, `journey-bindings.test.mjs`, `journey-contract.test.mjs`, `journey-conflict.test.mjs`, `journey-observations.test.mjs`, `journey-seed.test.mjs`, `journey-defaults.test.mjs`. This covers handoff owner/mode/symlink/inode/race refusal, compose allowlisting, source bootstrap ordering, compiler/listener exclusion, SMTP/default/outbox invariants, bounded cleanup, contract/conflict behavior and default observations/publication through injected seams. No service or real evidence bundle was used.

## Diagnostic compilation and focused SQLite checks

**Diagnostic only — excludes exactly the two B1 files.** A temporary ignored `apps/backend/.tmp/05-10-diagnostic-tsconfig.json` extended `../tests/tsconfig.json`, set `compilerOptions.incremental=false`, and retained the ordinary `../node_modules`, `../dist`, `../.tmp` exclusions plus only `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. The config was removed in `finally`. No committed config or test changed. No narrowed full-backend-suite pass is claimed.

```sh
pnpm --dir apps/backend exec tsc -p .tmp/05-10-diagnostic-tsconfig.json --pretty false
```

Exit **0**, wall **46.831 s**. Focused tests ran only after that successful compilation:

```sh
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-password-setup.unit.test.js .tmp/tests-dist/tests/iam-password-setup.integration.test.js .tmp/tests-dist/tests/iam-journey-bootstrap.integration.test.js .tmp/tests-dist/tests/iam-write-discipline.unit.test.js .tmp/tests-dist/tests/iam-scim-capture-tooling.unit.test.js .tmp/tests-dist/tests/iam-scim-lifecycle-capture-tooling.unit.test.js
```

Exit **1**, wall **84.087 s**; runner **duration_ms 82548.523054**, **118 tests, 116 passed, 2 failed, 0 cancelled/skipped/todo**. The two failed counts are one child assertion and its parent, not two independent underlying defects.

**Open blocker B2: fresh bootstrap transport assertion, owner iam for investigation.** `iam-journey-bootstrap.integration.test.ts`, child `private issuance then CLI rotation authenticates only the registered source`, failed `no provisioning, email or session transport`: actual **3**, expected **0**. Its parent `fresh administration bootstrap initializes only approved source prerequisites` is consequently failed. Missing-grant refusal, explicit core/catalogue grant seeding, idempotence and protected-source registration subtests passed. The issuance/rotation/scoped authentication assertions reached the final transport-count check. The test replaces global transport with a rejecting stub; the count identifies attempted calls, not successful external delivery. This run does not establish their origin or classify them as sandbox-only. Backend source and tests were left intact. The orchestrator must investigate/re-run this before declaring all iam-owned checks green.

Password-setup unit and real nested-transaction SQLite cases, capture tooling and the write-discipline checks passed within that diagnostic run. The semantic production inventory covered **275 files**, with IdamBox user writes restricted to the Document Service. These passes do not erase B1 or B2.

## Frozen surfaces and acceptance

A read-only byte comparison with `git show HEAD:<path>` covered the same **43 files** selected by `snapshotJourneyContracts`: all `docs/references` files, backend content-type schemas, backend generated types, frontend generated API types, both committed activation example files, and the backend capability catalogue. Exit **0**, wall **0.587 s**; no differences. Aggregate SHA-256 (sorted path then bytes), identical at HEAD and in the working tree:

```text
44610028bcb3ce815a8c26c07a260a9803f782a3e4603dba017518f40e6342b0
```

The reference catalogue and backend catalogue, specification, JDL, generated types, schemas and false defaults remain unchanged. Journey seed tests additionally check the SMTP-only realm exception, intact realm settings and disable-only outbox. No backend source, endpoint or Document Service guard change was made. `api:check` was not run because no shared contract changed; it would regenerate the frozen frontend type file unnecessarily.

The default live evidence stage now cleans up before running unfiltered backend/CSRM regressions, journey tests and the static check. A regression failure prevents publication. Its runner commands were not invoked live here; injected tests validate that ordering and fail-closed behavior. No network, Docker, live service, real browser journey or live evidence publication was performed. No dependency was installed. Local SQLite and injected transports supplied focused offline coverage.

Acceptance remains blocked by **B1**, **B2**, and the outstanding outside-sandbox recheck for **S1**. The prior orchestration allowance for live checkpoints with only the inherited CSRM compilation blocker cannot establish readiness here while B2 is unresolved. All actual live A1–A4, IN-03 and both-width evidence remains pending 05-11/05-12. No requirements or phase tracking files were advanced.

## Orchestrator re-run (2026-10-18, outside the restricted sandbox)

**B2 resolved — test isolation, not an IdamBox transport.** Tracing the stubbed `fetch` showed every counted call was `https://registry.npmjs.org/@strapi%2Fcore`: Strapi's own update notifier, started inside `createStrapi` and throttled by a per-user cache, so the test passed only while that cache was fresh (date-dependent). `STRAPI_DISABLE_UPDATE_NOTIFICATION`, which the test sets, is no longer honoured by Strapi 5.51 (it now reads `server.logger.updates.enabled`, set before load). The test still refuses that call but no longer counts it; every other remote call is counted and must be zero. No backend source or shared configuration changed.

| Command | Exit | Result |
|---|---:|---|
| `node --test .tmp/tests-dist/tests/iam-journey-bootstrap.integration.test.js` (after fix) | 0 | 6 passed, 0 failed |
| Backend: maintenance-switch check, `tsc`, diagnostic test compilation excluding **only** the two B1 files, then every compiled test | 0 | **2070 passed, 0 failed** (duration 2191 s) |
| `pnpm --dir apps/csrm test` | 0 | 222 files, **5412 passed**; the sandbox `listen EPERM` failures do not reproduce |
| `node --test docker/midpoint/e2e/journey*.test.mjs` | 0 | 218 passed |

Everything iam owns is green. **B1 stays open** (owner csrm): the unfiltered `pnpm --dir apps/backend test` still stops at compilation of `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` until csrm's modules reach the default branch. The diagnostic run above does not satisfy the unfiltered gate, and the journey's own evidence stage runs the unfiltered suite, so a passing evidence bundle cannot be published while B1 is open.

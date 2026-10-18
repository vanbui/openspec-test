---
phase: 05-sign-in-and-end-to-end-journey
plan: "10"
workstream: iam
subsystem: operations
status: complete
verification-status: blocked
requirements: [SIGN-01, SIGN-02]
requirements-completed: []
completed: 2026-10-18
actuals:
  tasks: 2
  commits: 0
key-files:
  created:
    - .planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OPERATIONS.md
    - .planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OFFLINE-GATE.md
    - .planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-10-SUMMARY.md
  modified:
    - docker/midpoint/e2e/README.md
    - docker/README.md
---

# Plan 05-10 execution summary

Delivered the operating contract and measured regression record for wave 6 only. Both documentation/measurement tasks are complete; the offline acceptance gate remains **blocked**, with no live proof or SIGN-01/SIGN-02 closure.

## Delivered

Task 1 documents the actual implementation at `6c39366e`, incorporating 05-08 `bfee09b3` and the subsequent default bindings. The operating contract covers root CLI commands, exact private environment names, disposable ownership/reset, compile/register/destroy/token/destroy-before-listener ordering, explicit core/capability seeding and the exact provisioning-role prerequisite, native object/task OIDs, budgets, SMTP exception, accepted-versus-delivered recovery, A1–A4, IN-03, browser isolation and the closed evidence schema. Both Docker entry points link it and the gate record while preserving historical Phase 3/4 instructions.

The current default mailbox, remote, browser/access and evidence adapters are documented as delivered. The evidence stage performs cleanup **before** compiling/running unfiltered regressions and refuses publication on any failure. Mail matches only synthetic recipients; remote observations correlate stored linkage, native audit and source-authenticated connector receipts. IN-03 records the actual retry scanner and measures its initial interval from failed processing start. No live history is inferred. The default contract probe returns observations without publishing `contract.json`; the verifier requires an existing bundle.

Task 2 rechecked the plan inline against the current shared implementation and recorded exact checks in [05-OFFLINE-GATE.md](05-OFFLINE-GATE.md). The orchestrator supplied that the default branch contains no missing backend changes; no network reconciliation or merge was attempted. No separate automated plan-checker result is claimed.

## Verification

| Command / check | Exit | Wall seconds | Result |
| --- | --- | --- | --- |
| `node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check` | 0 | 2.286 | 119/119; duration_ms 2139.040308, then static check passed. |
| `node --test docker/midpoint/e2e/journey*.test.mjs` | 0 | 3.064 | All eight files, 218/218; duration_ms 2964.078164. |
| `node docker/midpoint/e2e/journey.mjs --check` | 0 | 0.083 | Static check passed. |
| `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list` | 0 | 2.032 | Inert discovery, closed reporter success. |
| Same discovery with `--reporter=list` | 0 | 1.701 | Exactly 2 tests in 1 file, widths 1440 and 375. |
| `pnpm --dir apps/backend test` | 1 | 13.763 | Unfiltered test compilation blocked; six diagnostics in the two inherited CSRM files. |
| `pnpm --dir apps/csrm typecheck` | 0 | 6.884 | Passed. |
| `pnpm --dir apps/csrm test` | 1 | 111.385 | 5410 passed, 2 failed; both sandbox-only `listen EPERM` in transport tests. |
| Diagnostic test compilation, excluding only the two inherited files | 0 | 46.831 | Temporary ignored config removed afterward. |
| Focused compiled IAM password/bootstrap/write-discipline/capture tests | 1 | 84.087 | 118 total, 116 passed, 2 failed counts from one bootstrap child assertion and its parent; duration_ms 82548.523054. |
| Frozen-surface byte comparison with HEAD | 0 | 0.587 | All 43 files unchanged; digest recorded in the gate. |

Exact diagnostic compiler and six-file test commands, CSRM failing test names and all six backend compiler diagnostics are recorded in the gate. The standalone Task 1 test also passed 119/119 before the exact combined verification. No narrowed full-backend-suite green claim was made. `api:check` was not needed because no shared contract changed.

The semantic Document Service inventory passed across 275 production files. Focused password-setup tests passed, including real nested SQLite outer commit/rollback, timeout/failure and operator eligibility behavior. Journey tests cover private handoff ownership/symlink/race, compose allowlist, compiler/listener ordering, defaults, SMTP/outbox freeze, contract/conflict adapters and publication only after cleanup/regressions.

## Blockers and remaining checkpoints

- **B1, owner csrm:** WINDOWS.md entry 11 remains open. Unfiltered backend test compilation cannot resolve the two red-phase modules and reports associated strict-type diagnostics. Those tests remain unchanged; exclusions do not satisfy acceptance.
- **B2, owner iam for investigation:** fresh SQLite bootstrap child `private issuance then CLI rotation authenticates only the registered source` expected zero remote transport attempts but counted **3** in its rejecting stub. Earlier prerequisite/registration subtests passed and token/authentication assertions reached that final check. This is unresolved and is **not** classified as sandbox-only. No backend/test fix was attempted under this documentation-only plan.
- **S1, sandbox-only:** CSRM's two loopback listener tests fail with `listen EPERM`. The orchestrator reruns outside the sandbox; no passing result is assumed.
- 05-11 A1–A4 and 05-12 full two-width/IN-03 live checkpoints remain pending. The prior allowance for live work with only B1 does not establish readiness while B2 is unresolved. Phase verification/completion and requirement closure remain pending.

## Deviations and commits

No production changes were necessary or authorized. Unexpected B2 is recorded rather than suppressed. The supplied read-only-git constraint overrides per-task commits: **no commits**, git writes, STATE.md or ROADMAP.md updates. Only 05-10 was executed inline. No network, Docker, live service, real browser journey, dependency installation, committed example/default change, backend source/content-type/catalogue change or evidence publication occurred. The private diagnostic compiler config was removed; test outputs stay ignored.

| Task | Commit | Outcome |
| --- | --- | --- |
| 1: Operating instructions | None, read-only git | Delivered; exact task verification passed. |
| 2: Full regression truth | None, read-only git | Delivered; acceptance explicitly blocked by recorded results. |

## Self-check

Documentation artifacts exist and link to one another. All prescribed regressions were attempted and their actual outcomes retained. Frozen files match HEAD, and only the five documented Markdown files are changed. Whitespace and local-link checks passed. **Acceptance verification: BLOCKED**, with B1/B2/S1 retained for orchestration. Phase tracking files remain unchanged.

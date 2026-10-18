---
phase: 05-sign-in-and-end-to-end-journey
plan: "08"
subsystem: identity
status: complete
verification-status: passed-offline
live-readiness: blocked-inherited-runner-wiring
requirements: [SIGN-02]
requirements-completed: []
provides:
  - Both-width Requestor access, mover continuity and retained-session refusal browser assertions.
  - Independent retained-token API observations before and after browser refusal.
  - Closed lifecycle acknowledgements and private allowlisted viewport screenshots.
key-files:
  modified:
    - apps/csrm/e2e/iam-journey.spec.ts
    - docker/midpoint/e2e/journey-runtime.mjs
    - docker/midpoint/e2e/journey.test.mjs
    - docker/midpoint/e2e/journey-access.mjs
    - docker/midpoint/e2e/journey-access.test.mjs
actuals:
  tasks: 2
  commits: 0
completed: 2026-10-18
---

# Plan 05-08 execution summary

Both offline implementation tasks are delivered. All final plan checks pass. This records executable assertions with injected observations; it establishes no live journey acceptance or SIGN-02 closure.

## Delivered behavior

At 1440×900 and 375×812, separate synthetic people keep their original signed-in browser context through Requestor access, CSV mover and leaver refusal. The spec checks exact private route inputs, direct analyst and administration route denial, a non-disclosing foreign-record page, an owned request list/detail, keyboard reachability, visible focus, readable errors and document overflow. Session cookies are compared privately; raw values never enter assertion output. After the existing remote-completion observation reports disabled account and zero sessions, a separate fresh context attempts sign-in and must stay at the authentication error without an application session cookie.

The access driver continues to derive exact Requestor operation equality from the existing catalogue and reject explicit roles. It creates the owned request through the ordinary API, demonstrates an actual title write and reads it back. The foreign sourced person still goes through the identity service; their request goes through the supported domain service. Ordinary outer API authentication and the retained verified identity token are preserved. The inherited unserved `/api/roles` probe is replaced with the served administration operation `GET:/api/v1/risk_types`; the catalogue must contain its non-Requestor grant. The approved client identifier remains the default, with the existing token-client environment setting respected.

Sanitized in-memory observations identify `/app/requests`, the actual owned/foreign detail routes, `/app/review/requests`, `/app/admin/risk-types` and the exact access/list/create/read/write operation identifiers. Restricted API probes are `GET:/api/v1/dashboard/summary` and `GET:/api/v1/risk_types`. These are observations for later evidence assembly, not a published passing manifest.

The browser now acknowledges requestor-access, csv-mover, immediate-refusal and remote-completion stages. Runtime validates the stage-specific booleans, session linkage, closed payload and exact screenshot name and viewport dimensions. It independently repeats the listener's retained-token access/detail/write checks after the UI refusals and before releasing the bounded revocation hold. A failed second probe cannot retain a passing refusal image or observation. Browser data cannot overwrite independent API statuses. The existing listener verifies the token cryptographically, checks expiry and positive remaining lifetime, local inactivity, pending outbox and remote enabled account/sessions; ordinary API access/read/write must all return 403.

Only explicit viewport captures of the owned CSRM request route are accepted, with the four names `screenshots/csrm-{1440|375}-{requestor|refusal}.png`. Queries, fragments, authentication pages, other origins, unknown widths and other screenshot kinds refuse. Images travel over authenticated loopback into private memory, with bounded payloads; they are not written as browser artifacts or attached to reports. Automatic artifact settings and the closed reporter remain unchanged. No screenshot or passing live evidence was fabricated.

## Final verification

Commands ran from the repository root with installed Node 24.20.0. The Node installation directory was prepended to PATH. Package commands used the process-local `pnpm_config_verify_deps_before_run=false` setting to prevent dependency installation or registry access. No dependencies or package configuration changed.

| Command | Exit | Wall time | Exact result |
|---|---:|---:|---|
| `node --test docker/midpoint/e2e/journey.test.mjs` | 0 | 1.345 s | 108 passed, 0 failed, 0 skipped; runner duration 1269.424902 ms. |
| `node docker/midpoint/e2e/journey.mjs --check` | 0 | 0.075 s | Passed; output: `Journey command passed; offline checks do not establish live acceptance.` |
| `pnpm --dir apps/csrm typecheck` | 0 | 4.822 s | Passed: `next typegen && tsc --noEmit`; route types generated successfully. |
| `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list` | 0 | 2.077 s | Discovery passed; exact reporter output: `journey-browser-run:passed`. No browser or service started. |
| `node --test docker/midpoint/e2e/journey-access.test.mjs` | 0 | 0.188 s | 3 passed, 0 failed, 0 skipped; runner duration 107.48395 ms. |
| `node --test docker/midpoint/e2e/journey*.test.mjs` | 0 | Runner: 1306.479054 ms | 184 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo. |
| `git diff --check` | 0 | Not timed | No output; no whitespace errors. |
| `git diff --name-only -- apps/backend .planning/workstreams/iam/STATE.md .planning/workstreams/iam/ROADMAP.md` | 0 | Not timed | No output; these tracked paths are unchanged. |

The broader journey command includes the access-driver tests and the contract, seed, observations, bindings and conflict regressions. All use local synthetic fixtures and injected transports/processes. Browser discovery is only discovery; it does not execute the two responsive cases. Full backend and CSRM unit suites were not run; those remain outside this plan's prescribed checks.

## Earlier check results and corrections

- Before implementation, `node --test --test-name-pattern='owned browser advertises' docker/midpoint/e2e/journey.test.mjs` exited 1: 0 passed, 1 failed, 0 skipped, duration 140.089502 ms. The existing browser advertised only password setup/sign-in. This was the observed red check.
- The first expanded focused run reported 102 passed and 2 failed out of 104, duration 1187.045997 ms. The new process lifecycle fixtures omitted the listener's refusal statuses. Correcting those synthetic replies produced 104 passed, 0 failed, duration 1127.03132 ms.
- Added expiry/hold/screenshot coverage then passed 107/107 (1195.441927 ms); the next verification passed 107/107 (1189.99373 ms). The final post-UI-probe regression brings the final focused result to 108/108 as recorded above.
- The earlier standalone access-driver run passed 3/3 (114.784244 ms). Its final rerun, including the changed-title readback and served administration probe, is recorded above.
- The earlier broader journey run passed 183/183 (1231.827562 ms); the final added regression brings it to 184/184.
- Every typecheck, static `--check`, browser `--list` and whitespace-check invocation passed. Final command outputs and timings are recorded above; no installation was attempted.

## Scope and deviations

Only plan 05-08, wave 5, was executed inline. The existing access helper and its test also changed because the plan's real-boundary fixture needed a served administration endpoint, actual write/readback and exact route/operation observations. No production endpoint, authorization rule, user-write authority, model, catalogue, grant, committed flag or dependency changed.

No Git write or commit was performed. STATE.md and ROADMAP.md remain untouched. There are no tracked changes under apps/backend. Existing offline test fixtures briefly use their isolated temporary directories and remove them. No network operation, container operation, listener or live browser/service was started.

## Remaining acceptance and inherited integration gaps

The live two-width assertions, native CSV/task correlation, invitation absence, actual remote revocation and screenshot appearance remain unexecuted. SIGN-02 and phase acceptance stay open.

Inspection also found pre-existing gaps outside these two tasks: `createJourneyRuntime` requires injected `observeMail` and `observeRemote`, while `runJourney` does not supply default lifecycle implementations; the final evidence stage still raises `JOURNEY_ADAPTER_UNAVAILABLE`. Consequently the unmodified default full-run path cannot yet reach a complete passing journey, even with live infrastructure. These gaps require explicit follow-up before the whole-journey checkpoint; this plan does not manufacture adapters, audit history or a passing manifest to bypass them. The new access observations and private screenshots are available for later evidence assembly.

The next planned wave is 6 (05-10). Phase-level verification, requirement closure and completion were not performed because later plans remain incomplete and tracking files belong to the orchestrator.

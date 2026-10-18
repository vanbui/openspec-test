---
phase: 05-sign-in-and-end-to-end-journey
plan: "07"
subsystem: identity
tags: [iam, mail, oidc, browser, isolation]
status: complete
verification-status: blocked-sandbox-loopback
requires:
  - phase: 05-04
    provides: Local action-email delivery configuration.
  - phase: 05-06
    provides: Disposable lifecycle runtime and authenticated stage coordination.
provides:
  - Exact-recipient fresh-message selection and private validated action-link extraction.
  - Separate opt-in password setup and independent sign-in at desktop and mobile widths.
  - Closed browser diagnostics and owned isolated Next process lifecycle.
affects: [05-08, 05-10, SIGN-01, SIGN-02]
tech-stack:
  added: []
  patterns: [closed diagnostics, one-time private stage input, injected process boundaries]
key-files:
  created:
    - apps/csrm/playwright.iam-journey.config.ts
    - apps/csrm/e2e/iam-journey.spec.ts
    - apps/csrm/e2e/iam-journey-reporter.ts
    - docker/midpoint/e2e/journey-mail.mjs
  modified:
    - docker/midpoint/e2e/journey-runtime.mjs
    - docker/midpoint/e2e/journey.test.mjs
key-decisions:
  - Dedicated project identity and explicit live opt-in are both required before private input is read.
  - Fresh setup and subsequent sign-in use separate contexts without copied cookies or storage.
  - Mail links and browser inputs remain private memory and authenticated loopback responses.
  - Automatic page error snapshots are explicitly disabled in addition to traces, video and screenshots.
requirements: [SIGN-01, SIGN-02]
requirements-completed: []
actuals:
  tokens: 7821
  tasks: 2
  commits: 0
plan_head_before: 6ec9063593e7d9b2630304d8a61349dbf4edc931
plan_head_after: 6ec9063593e7d9b2630304d8a61349dbf4edc931
completed: 2026-10-17
---

# Phase 5 Plan 7: Private Mail-Link Password Setup Summary

Fresh matching local mail supplies the actual password action link, followed by a separate browser session signing in through the existing application authentication flow.

Both implementation tasks are delivered for offline review. Live form acceptance remains pending. The complete CSRM unit suite ran and encountered two sandbox listener failures; it did not pass.

## Delivered behavior

- Dedicated configuration imports no ordinary fixture configuration and starts no services during discovery. It uses one worker, zero retries and disables traces, video, screenshots, retained output and automatic error-context page snapshots. The reporter emits closed statuses only, discarding process output, raw errors, titles and attachments.
- The spec requires both the explicit live variable and the dedicated project identity. Ordinary discovery cannot read private control input even if the opt-in variable was inherited. Desktop and mobile cases obtain distinct run-owned synthetic people and create separate setup and fresh sign-in contexts. Passwords are generated in memory. Accessible form labels, keyboard submission, visible focus and readable nonoverflowing content are checked. Setup uses the actual action URL; independent sign-in starts at the existing CSRM sign-in page and returns to the Risk register through the existing authentication boundary.
- Mail selection requires one exact synthetic recipient, a creation timestamp strictly after the joiner trigger and an unseen message identifier. Multiple matching messages, truncated listings, wrong recipients, stale messages and reused identifiers refuse. Message detail is matched again before a unique action link is extracted. The link must use the exact local realm/action endpoint with one nonempty key and no user information or fragment. Polling, individual requests and total mail time are bounded; raw transport errors are replaced with closed failures.
- Runtime wiring records joiner trigger times, retains received action links only in private memory and serves one-time private input to the current browser stage over authenticated loopback. Foreign Origin/Host values, invalid authentication and repeated input delivery refuse. Diagnostics never publish those inputs.
- The default browser adapter owns an isolated Next development process on the registered localhost origin, forces OIDC on and the development identity bridge off, passes the existing private API credential and issuer configuration, and starts the dedicated browser process. Both children suppress dependency status installs, keep output private and are closed during cleanup. Owned build output is removed. Early browser exit interrupts the stage wait. Later access and refusal stages remain closed until their owning plan supplies them.

## Verification results

Commands used Node 24.20.0. Required package commands were rerun with `pnpm_config_verify_deps_before_run=false` to use installed dependencies without an automatic installation attempt.

| Check | Result |
|---|---|
| Initial focused red check | 0 passed, 1 file failed because the new mail module did not yet exist. |
| `node --test docker/midpoint/e2e/journey.test.mjs` | 96 passed, 0 failed, 0 skipped; 2152.309229 ms. |
| `node --test docker/midpoint/e2e/*.test.mjs` | 143 passed, 0 failed; 1045.519097 ms, reported by the execution coordinator. |
| `node docker/midpoint/e2e/journey.mjs --check` | Passed. |
| `pnpm --dir apps/csrm typecheck` | Passed after disabling automatic dependency checks. |
| `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list` | Passed after disabling automatic dependency checks; no browser or service was started. |
| `pnpm --dir apps/csrm test` | 5410 passed, 2 failed, 5412 total; 221 files passed, 1 failed, 222 total; 120.99 s. |

The two CSRM failures are unchanged tests in `src/lib/api/transport/server-client.test.ts`: “sends the generated applications path to the canonical Strapi REST endpoint” and “preserves a reverse-proxy prefix that ends in the Strapi REST segment”. Both report `listen EPERM: operation not permitted 127.0.0.1`. Baseline reproduction was not performed here; these failures are reported without claiming a complete pass.

The first exact package-command attempts triggered the installed package manager's automatic dependency check, attempted an unavailable registry request and stopped with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. No installation completed. The environment override prevented that behavior on subsequent checks; dependencies and package configuration were unchanged.

Offline coverage executes the reporter with secret-bearing synthetic errors/output and proves only closed statuses escape. It evaluates the dedicated configuration, checks artifact settings, injects process creation to verify the OIDC environment and cleanup, tests synthetic username compatibility, and exercises authenticated one-time stage input without opening a listener.

## Deviations from plan

1. Runtime integration also modifies `journey-runtime.mjs`, authorized during execution because mail selection, private stage input and owned Next/browser startup require concrete wiring beyond the five originally listed paths.
2. Installed browser tooling also writes automatic error-context page snapshots when its ordinary artifact settings are off. Its supported environment switch is set explicitly to prevent that secret-bearing output.
3. Package commands use a process-local configuration override to suppress automatic dependency checks. No dependency installation or configuration change was introduced.
4. The requested full CSRM test command was executed but remains blocked by two sandbox loopback-listener failures. No unrelated source repair was attempted.

## Remaining acceptance

Actual Mailpit delivery, local action-form behavior, password choice and both independent sign-ins require the later authorized live checkpoint. No server, container, live browser test or CSRM E2E suite was started during this execution. Safe post-sign-in/refusal screenshots and whole-lifecycle continuity belong to the later access/refusal work; no screenshot or live acceptance evidence was fabricated.

## TDD and commits

New mail behavior tests were observed failing before implementation, then passing. No Git write or state update was performed. No local environment file or secret was read or printed. Changes remain in the working tree. The actual token estimate is characters divided by four over the six realized source/test diffs and new source files, excluding this summary and unrelated concurrent changes.

## Self-Check: PASSED

All six listed source/test files and this summary exist. Focused tests, static checks and package-check outcomes are recorded above, including the two failing CSRM tests. No requirements were marked accepted and no live evidence was published.

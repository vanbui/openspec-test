---
phase: "05"
slug: sign-in-and-end-to-end-journey
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-17"
---

# Phase 5 — Validation Strategy

Planning contract only. No implementation or runtime result is claimed. Task identifiers/waves below are reconciled with the twelve plans; runtime validation remains pending.

## Infrastructure and sampling

Use installed node:test with real Strapi/SQLite integration, existing CSRM Vitest and opt-in Playwright. Add no framework or dependency. Compile before invoking compiled tests:

```sh
pnpm --dir apps/backend exec tsc --pretty false
pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false
node --test --test-concurrency=1 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js
node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js
node --test docker/midpoint/e2e/journey.test.mjs
node docker/midpoint/e2e/journey.mjs --check
pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list
```

New test/runner paths above are deliverables, not existing passing commands. Run the relevant focused check after each changed task; target feedback within 120 seconds for units/checks. Real SQLite tests have a 600-second ceiling. After a wave, run affected suites; before acceptance require unfiltered `pnpm --dir apps/backend test`, `pnpm --dir apps/csrm typecheck` and `pnpm --dir apps/csrm test`. Record measured duration at execution rather than inventing a baseline. Run `pnpm --dir apps/csrm api:check` if the shared contract changes. Report inherited WINDOWS.md entry 11 compilation failure separately; exclusions cannot yield a full-green verdict.

## Behavioral verification map

| Behavior | Requirement / decisions | Verification | Environment / status |
|---|---|---|---|
| Exact stored subject, UPDATE_PASSWORD array, no credential provisioning | SIGN-01; P5-01,02,06,09 | Injected bounded client and safe-log unit tests | Offline; pending |
| Dispatch only after real outer commit; no send on rollback/linkage/commit failure | SIGN-01; P5-03,04,24 | Real Document Service SQLite transaction integration tests | Offline; pending |
| Create remains successful through scheduler/client/timeout/logger failure | SIGN-01; P5-03,04,06,24 | Mounted SCIM response plus caught-rejection tests | Offline; pending |
| Eligibility exclusions and guarded operator resend | SIGN-01; P5-01,07,24 | Unit and integration success/refusal tests | Offline; pending |
| Frozen model, false defaults, default-off inertness | Both; P5-05,08,09,25 | Existing regression checks plus focused assertions | Offline; pending |
| Ordered stages, bounded polling, cleanup, private handoff, evidence rejection | SIGN-02; P5-11–15,21,22 | Injected runner tests and inert --check | Offline; pending |
| Separate browser config; ordinary discovery inert | SIGN-02; P5-19,20,21 | Config/spec list and isolation tests | Offline; pending |
| Version-pinned endpoint query, SMTP and existing requiredActions semantics | SIGN-01; P5-02,08 | Controlled contract probe plus local vendor evidence where available | Orchestrator live checkpoint; pending |
| Fresh-stack mail → password setup → independent Requestor sign-in | Both; P5-10–17,20 | Complete connector journey at both widths | Orchestrator live checkpoint; pending |
| Mover continuity and no invitation; immediate pre-expiry same-session leaver refusal | SIGN-02; P5-16–18 | Native task outcomes, API 403 and protected-page refusal | Orchestrator live checkpoint; pending |
| IN-03 remote-only collision, rollback, 503/Retry-After and supported recovery | SIGN-02; P5-23 | Separate controlled negative stage, retry trigger and eventual recovery | Orchestrator live checkpoint; pending |

## Wave-zero deliverables

Create injected client/scheduler/log ports and focused tests in the first email slice; build real nested transaction fixtures with real Document Service. Gate implementation delivers injectable stages, evidence validator, private browser handshake and tests. Missing test paths must be created by their owning implementation task before verification; no stub-only infrastructure plan is needed. All executable tasks require an automated check; live-only tasks require exact checkpoint commands and evidence. Avoid three consecutive implementation tasks without feedback.

## Live checkpoints

Run only in the disposable environment with exclusive listener/compiler ownership. Exact private-input contracts and internal task commands are deliverables of the runner plans. Proposed entry commands from repository root:

```sh
node docker/midpoint/e2e/journey.mjs --probe-keycloak
node docker/midpoint/e2e/journey.mjs --run
node docker/midpoint/e2e/journey.mjs --verify-evidence
```

Fresh reset, Mailpit, Keycloak, midPoint tasks, Playwright and IN-03 are unavailable in the planning sandbox. They cannot be replaced by --check, mocked responses or historical evidence. Require reset/versions/native task runs, stable source-to-subject linkage, both viewports, pre-expiry refusal timing, conflict recovery and cleanup in sanitized evidence. A partial run fails. The contract probe resolves research A1–A4 before dependent acceptance. No secrets, raw mail/action links, traces or browser state may be published.

## Sign-off

- [x] Task/wave map reconciled against the written plans; independent plan check is recorded separately.
- [ ] Missing tests delivered with their owning slice.
- [ ] Focused offline checks pass with measured timings.
- [ ] Unfiltered regressions pass; inherited failures reported accurately.
- [ ] Version-pinned contract and complete live evidence pass.
- [ ] Mark validated/compliant only after the required execution evidence exists.

Approval: pending execution. Planning review does not establish runtime compliance.

## Final per-task verification map

Additional05-06-1 requirement: compile and run node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-journey-bootstrap.integration.test.js. A real fresh empty SQLite database must first reject registration for missing provisioning grant without user writes, then explicit approved core/catalogue initialization must establish exact IAM app/role/function/APIs before protected source registration and resolvable token issuance. Assert idempotent catalogue initialization, no human fixtures, no remote provisioning/email/session calls and original authority/Document Service boundary. Plan06 now owns the narrowly extracted catalogue seed service and this integration test; no new model/default/grant or broad fixture behavior is introduced. All runtime results remain pending.

Revision obligations for task05-06-1: `journey.test.mjs` must assert supported token CLI private stdout handoff (no development-file export), unchanged developer `docker/.env` bytes/stat on success/failure, owner-only no-follow private handoff and symlink/mode/ownership/race refusal, actual compose keys including `KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD` propagated to every explicitly selected private env-file call, ambient alias/missing-key refusal and compile/register/destroy/token/destroy-before-listener event ordering with zero overlap. Task05-10-1 synchronizes this contract in operations docs; checkpoints05-11-1 and05-12-1 require the same real private preparation and lifecycle order. These are pending implementation tests/observations, not planning passes.

All entries are execution obligations, not observed passes. Compile backend application/tests before compiled node:test invocations. Default-off checks use no remote services; --list does not launch the browser application. Long real SQLite tests have a600-second ceiling; units/inert checks target120 seconds. Live evidence is mandatory even where read-only evidence validation is automated.

| Task | Wave | Decision focus | Automated command / required evidence | Environment/status |
|---|---|---|---|---|
| 05-01-1 | 1 | P5-01, P5-02, P5-03, P5-04, P5-05, P5-06, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js  | Offline; pending |
| 05-01-2 | 1 | P5-01, P5-02, P5-03, P5-04, P5-05, P5-06, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js  | Offline; pending |
| 05-02-1 | 2 | P5-01, P5-03, P5-04, P5-06, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js  | Offline; pending |
| 05-02-2 | 2 | P5-01, P5-03, P5-04, P5-06, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js  | Offline; pending |
| 05-03-1 | 3 | P5-04, P5-06, P5-07, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 apps/backend/.tmp/tests-dist/tests/iam-password-setup.unit.test.js  | Offline; pending |
| 05-03-2 | 3 | P5-04, P5-06, P5-07, P5-09, P5-24 | pnpm --dir apps/backend exec tsc --pretty false && pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && node --test --test-concurrency=1 --test-timeout=600000 apps/backend/.tmp/tests-dist/tests/iam-password-setup.integration.test.js  | Offline; pending |
| 05-04-1 | 2 | P5-02, P5-05, P5-08, P5-09, P5-10, P5-25 | node --test docker/midpoint/e2e/journey-seed.test.mjs  | Offline; pending |
| 05-04-2 | 2 | P5-02, P5-05, P5-08, P5-09, P5-10, P5-25 | node --test docker/midpoint/e2e/journey-seed.test.mjs  | Offline; pending |
| 05-05-1 | 2 | P5-11, P5-13, P5-14, P5-21, P5-22, P5-25 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-05-2 | 2 | P5-11, P5-13, P5-14, P5-21, P5-22, P5-25 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-06-1 | 3 | P5-09, P5-10, P5-11, P5-12, P5-13, P5-14, P5-16, P5-18, P5-21, P5-22 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-06-2 | 3 | P5-09, P5-10, P5-11, P5-12, P5-13, P5-14, P5-16, P5-18, P5-21, P5-22 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-07-1 | 4 | P5-02, P5-10, P5-15, P5-19, P5-20, P5-21 | pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list  | Offline; pending |
| 05-07-2 | 4 | P5-02, P5-10, P5-15, P5-19, P5-20, P5-21 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list  | Offline; pending |
| 05-08-1 | 5 | P5-10, P5-16, P5-17, P5-18, P5-20, P5-21, P5-22 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list  | Offline; pending |
| 05-08-2 | 5 | P5-10, P5-16, P5-17, P5-18, P5-20, P5-21, P5-22 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list  | Offline; pending |
| 05-09-1 | 4 | P5-02, P5-08, P5-14, P5-21, P5-22, P5-23 | node --test docker/midpoint/e2e/journey-contract.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-09-2 | 4 | P5-02, P5-08, P5-14, P5-21, P5-22, P5-23 | node --test docker/midpoint/e2e/journey-conflict.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-10-1 | 6 | P5-04, P5-05, P5-07, P5-08, P5-09, P5-10, P5-11, P5-12, P5-13, P5-14, P5-19, P5-21, P5-22, P5-23, P5-24, P5-25 | node --test docker/midpoint/e2e/journey.test.mjs && node docker/midpoint/e2e/journey.mjs --check  | Offline; pending |
| 05-10-2 | 6 | P5-04, P5-05, P5-07, P5-08, P5-09, P5-10, P5-11, P5-12, P5-13, P5-14, P5-19, P5-21, P5-22, P5-23, P5-24, P5-25 | pnpm --dir apps/backend test && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm test  | Offline; pending |
| 05-11-1 | 7 | P5-02, P5-08, P5-09, P5-11, P5-12, P5-15, P5-21, P5-22, P5-25 | node docker/midpoint/e2e/journey.mjs --check ; exact live commands and safe observations are mandatory in plan action. | Orchestrator live checkpoint; pending |
| 05-11-2 | 7 | P5-02, P5-08, P5-09, P5-11, P5-12, P5-15, P5-21, P5-22, P5-25 | node docker/midpoint/e2e/journey.mjs --verify-evidence --contract ; exact live commands and safe observations are mandatory in plan action. | Orchestrator live checkpoint; pending |
| 05-12-1 | 8 | P5-10, P5-11, P5-12, P5-13, P5-14, P5-15, P5-16, P5-17, P5-18, P5-19, P5-20, P5-21, P5-22, P5-23, P5-25 | node docker/midpoint/e2e/journey.mjs --verify-evidence ; exact live commands and safe observations are mandatory in plan action. | Orchestrator live checkpoint; pending |
| 05-12-2 | 8 | P5-10, P5-11, P5-12, P5-13, P5-14, P5-15, P5-16, P5-17, P5-18, P5-19, P5-20, P5-21, P5-22, P5-23, P5-25 | node docker/midpoint/e2e/journey.mjs --verify-evidence ; exact live commands and safe observations are mandatory in plan action. | Orchestrator live checkpoint; pending |

## Threat verification trace

| Threat ref | Plans / task | Required verification | Status |
|---|---|---|---|
| T-05-01,03,05 | 01–03 | Real identity authority, eligibility, stored subject, commit ordering and CLI refusal tests | Pending |
| T-05-02,04,06 | 01–03 | Adversarial secret canaries and closed logging/CLI outcomes | Pending |
| T-05-07,08 | 04 | Parsed SMTP/client/default/passwordless-source invariants | Pending |
| T-05-09,10 | 05 | Stage/ownership/evidence allowlist failure cases and inert check | Pending |
| T-05-11,12 | 06 | Native fresh task completion/ownership/private adapter tests | Pending |
| T-05-13,14 | 07 | Opt-in list isolation, fresh mail/origin matching and reporter secrecy | Pending |
| T-05-15,16 | 08 | Catalogue equality, cross-owner refusal and same-session pre-expiry assertions | Pending |
| T-05-17,18 | 09 | Contract/IN-03 fake adapter failure cases plus mandatory actual probe | Pending |
| T-05-19,20 | 10 | Operating contract consistency, unfiltered regressions and safe reports | Pending |
| T-05-21,22 | 11 | Disposable reset/version/probe A1–A4 and sanitized contract evidence | Pending |
| T-05-23,24 | 12 | Complete actual two-width/native lifecycle and safe complete publication | Pending |
| T-05-SC | All | No package installation is planned; investigate any proposed dependency before adding it | Pending |

Wave0 deliverables are embedded in owning slices:01 creates email service/test ports and real transaction tracer;05 creates injected runner/evidence validator;07 creates opt-in browser config/private handshake. No missing-test placeholder is treated as completion. Status remains draft, nyquist_compliant false and wave_0_complete false until execution supplies actual results.


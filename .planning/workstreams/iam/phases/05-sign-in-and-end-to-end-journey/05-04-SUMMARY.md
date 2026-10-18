---
phase: 05-sign-in-and-end-to-end-journey
plan: "04"
subsystem: auth
tags: [keycloak, smtp, mailpit, offline-tests]
requires:
  - phase: 05-01
    provides: Password setup email boundary and frozen source contract
provides:
  - Local realm SMTP seed targeting the existing internal Mailpit service
  - Offline guards for full realm preservation, disabled defaults and credential-free source input
affects: [05-09, 05-10, 05-11]
tech-stack:
  added: []
  patterns: [Canonical parsed-JSON baseline checks, isolated configuration evaluation]
key-files:
  created: [docker/midpoint/e2e/journey-seed.test.mjs]
  modified: [docker/keycloak/import/idambox-realm.json]
key-decisions:
  - Protect the complete original realm tree with a fixed canonical digest rather than duplicate local fixture credentials in tests.
  - Evaluate configuration exports using installed Node built-ins and explicit environment objects; never read private environment files.
requirements-completed: []
requirements-addressed: [SIGN-01]
actuals:
  tokens: 3320
  tasks: 2
  commits: 0
plan_head_before: a877fd7b7934d1302d0901b4248957496c31b2c8
plan_head_after: a877fd7b7934d1302d0901b4248957496c31b2c8
duration: 8min
completed: 2026-10-17
status: complete
coverage:
  - id: D1
    description: Realm seed points only to internal Mailpit SMTP while retaining the complete original realm settings.
    requirement: SIGN-01
    verification:
      - kind: unit
        ref: node --test docker/midpoint/e2e/journey-seed.test.mjs
        status: pass
    human_judgment: false
  - id: D2
    description: Committed false defaults, credential-free source contract and disable-only outbox remain guarded offline.
    verification:
      - kind: unit
        ref: node --test docker/midpoint/e2e/journey-seed.test.mjs
        status: pass
    human_judgment: false
---

# Phase 5 Plan 04: Local SMTP seed Summary

The local Keycloak realm now targets `mailpit:1025` for password setup mail, with offline checks preserving its original identity and client configuration.

## Accomplishments

- Added exactly six `smtpServer` values: internal host and port, fictitious `no-reply@idambox.invalid` sender, and string-valued false authentication, SSL and STARTTLS settings. Password setup delivery requires this deliberate development realm exception under P5-08.
- Guarded every pre-existing realm field through a canonical parsed-tree baseline, including all clients, fixture subjects, grants, scopes and audience mappings. Exact callback, browser origin and logout registration also have direct assertions. Digest assertions avoid printing fixture credentials on failure.
- Checked the existing pinned Mailpit and Keycloak images, loopback-only Mailpit HTTP publication and absence of an SMTP publication on that service.
- Parsed committed environment examples and evaluated actual provisioning, token verification and OIDC configuration exports. Unset, empty and false activation values stay disabled and read no other environment fields.
- Checked exact CSV header and source DTO/allowlist fields, rejected credential-bearing source inputs, inspected credential mapping paths/elements, and protected the entire parsed disable-only outbox schema against drift.

## Verification

Command: `node --test docker/midpoint/e2e/journey-seed.test.mjs`.

- Before the realm edit: **7 tests, 6 passed, 1 failed**, with the SMTP assertion failing because `smtpServer` was absent.
- After the realm edit: **7 tests, 7 passed, 0 failed, 0 skipped, 0 cancelled**, duration **221.187162 ms**.
- Node emits its existing experimental warning for built-in TypeScript stripping; execution succeeds without package installation or application builds.

The seed suite runs offline and reads only named committed examples/configuration/source files. No private environment file, runtime service, mail body, action link or live credential is involved. The checks establish source configuration only; no SMTP delivery, realm import, browser sign-in or lifecycle result is claimed. SIGN-01 remains pending its later live acceptance gate.

## Task Results

1. **Add only the development realm SMTP exception:** complete; realm changes are confined to `smtpServer`.
2. **Guard committed disabled defaults and passwordless source contract:** complete; offline guards pass using installed Node only.

## Files Created/Modified

- `docker/keycloak/import/idambox-realm.json` — adds local internal SMTP configuration.
- `docker/midpoint/e2e/journey-seed.test.mjs` — seven offline seed, default and source-contract checks.
- `.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-04-SUMMARY.md` — execution record.

## Deviations from Plan

- Changes remain uncommitted as explicitly required for this restricted execution. No staging, commit, realm import or service operation was attempted. State, roadmap and phase completion are left to the enclosing execution.
- The complete realm baseline uses a fixed canonical SHA-256 digest rather than an additional fixture file. This preserves every original parsed value while avoiding another copy of existing local fixture credentials and keeps failures free of those values. The outbox receives the same full-tree protection.
- No implementation change was needed for Task 2: existing defaults and source contracts already satisfy the planned behavior, so its new tests protect the existing behavior.

## Remaining Acceptance

Later plans must import the seed in a disposable stack and establish actual mail delivery and the complete browser lifecycle. This plan introduces no model migration, dependency or new endpoint, and does not complete the phase or SIGN-01. The inherited unfiltered backend compilation issue remains outside this seed-only test scope; no full backend regression result is claimed here.

## Self-Check: PASSED

Both implementation files and this summary exist. The seven focused tests pass; the original realm tree and outbox schema satisfy their checked baseline digests. No commit was requested or attempted.

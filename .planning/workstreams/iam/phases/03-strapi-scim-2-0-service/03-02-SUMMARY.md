---
phase: 03-strapi-scim-2-0-service
plan: "02"
subsystem: auth
tags: [scim, identity-source, cli, development-export]
status: complete
requires:
  - phase: 03-01
    provides: Serialized source token lifecycle and guarded source principals
provides:
  - No-listener source token CLI with one-time post-commit output and finally cleanup
  - Atomic ignored development env delivery with source eligibility and filesystem safeguards
  - Failed-delivery compensation that preserves a newer concurrent rotation
  - Named behavior tests and passing seed/restart regressions
affects: [03-13, development-token-delivery]
tech-stack:
  added: []
  patterns: [injected CLI runtime, exclusive export reservation, atomic replacement, source-locked compensation]
key-files:
  created:
    - apps/backend/src/iam/scim/token-cli.ts
    - apps/backend/src/iam/scim/dev-token-export.ts
    - apps/backend/tests/iam-scim-token-cli.unit.test.ts
  modified:
    - apps/backend/package.json
    - docker/.env.example
key-decisions:
  - Reuse existing backend compilation, load/destroy and serialized token administration
  - Validate development source eligibility before issuance and again before delivery
  - Revoke failed delivery only while its hash still matches under the source lock
  - Fail closed on export contention, unsafe paths, ownership or replacement races
requirements-completed: ["MODEL-02"]
coverage:
  - id: token-cli
    description: Exact source/action interface, one-time output, no listener and finally cleanup
    requirement: MODEL-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-token-cli.unit.test.ts
        status: pass
    human_judgment: false
  - id: development-export
    description: Exact registered source eligibility and safe atomic ignored-env replacement
    requirement: MODEL-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-token-cli.unit.test.ts
        status: pass
    human_judgment: false
  - id: failed-delivery-compensation
    description: Serialized revocation of only the undelivered credential
    requirement: MODEL-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-token-cli.unit.test.ts#failed delivery compensation takes a source lock and cannot revoke a newer concurrent token
        status: pass
    human_judgment: false
  - id: seed-and-lifecycle-preservation
    description: Existing token lifecycle and tokenless seed/restart contracts remain intact
    requirement: MODEL-02
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-token.integration.test.ts
        status: pass
      - kind: integration
        ref: apps/backend/tests/iam-source-registration.integration.test.ts
        status: pass
    human_judgment: false
actuals:
  tasks: 1
  commits: 3
duration: 7 min
completed: "2026-10-15T12:09:12Z"
---

# Phase 3 Plan 02: Safe source token CLI summary

The backend CLI issues, rotates and revokes source tokens without an HTTP listener, emits a credential once after commit and requested delivery, and safely compensates failed development delivery.

## Scope and performance

Only 03-02 was executed. One task changed five owned files. Task implementation began at 2026-10-15T12:01:34Z and completed at 2026-10-15T12:09:12Z, approximately seven minutes; preparation preceded that interval. Earlier summaries were treated as completed work, as instructed. No later plan or live checkpoint was started.

Before implementation, the latest landed backend token service, source registration, seed, bootstrap and runtime contracts were reconciled against P3-09/P3-10. All 18 phase plan structure checks passed again with no errors or warnings. No dependency, schema, generated declaration, index, JDL, catalogue or endpoint changed.

## Accomplishments

- Added `pnpm --dir apps/backend scim:token <source> [issue|rotate|revoke] [--write-dev-env]` using installed TypeScript/Strapi compilation. Omitted action delegates to the existing issue-or-rotate lifecycle. Revocation emits only nonsecret confirmation. Invalid invocations refuse before backend configuration loads; every acquired backend is destroyed in finally, including load failures.
- Development export validates the exact seeded `midPoint (dev)` service registration and active grant before changing credentials and again before delivery. The exporter refuses tracked/nonignored paths, symlink parents/destinations, hardlinks, unsafe ownership/parent permissions and observed replacement races. An exclusive owner-only lock directory protects private staging; atomic replacement preserves unrelated text and restrictive owner mode while removing group/other permissions. Only an empty example variable was added.
- Output waits for commit and successful requested delivery. Failure emits closed diagnostics and revokes the issued hash through the serialized lifecycle. The hash is checked while holding the source lock, so compensation cannot revoke a newer concurrent rotation. No role, source status or binding is repaired.
- Eighteen CLI/export tests pass. Nineteen existing token and registration tests additionally prove lifecycle behavior, tokenless seeding and preservation of an existing hash across restart.

## Task commits

1. `a6e655d8` — `test(iam): specify token CLI delivery and filesystem safeguards` (initial compilation failed because the new implementation modules were absent).
2. `3df3c6ab` — `feat(iam): deliver source tokens through a guarded development CLI`.
3. `6972e171` — `test(iam): verify export eligibility cleanup and rotation races`.

The summary, state and roadmap are committed separately as plan metadata.

## Verification

All commands ran from repository root with the supplied Node/pnpm installation on PATH.

| Check | Result |
|---|---|
| Phase plan structure checks | 18/18 valid; zero errors/warnings |
| `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-scim.json --pretty false` | Pass; final compilation exits 0 |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-token-cli.unit.test.js` | 18/18 pass; zero failures/skips |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-scim-token.unit.test.js .tmp/tests-dist/tests/iam-scim-token.integration.test.js .tmp/tests-dist/tests/iam-source-registration.integration.test.js` | 19/19 pass; zero failures/skips; about 42 seconds |
| `pnpm --dir apps/backend scim:token` | Package builds and runs; expected exit 1 with safe usage text, before boot |
| `git diff --check` | Pass |

The ignored `.tmp/tsconfig.iam-scim.json` extends `../tests/tsconfig.json` and excludes exactly `../tests/risk-curation-rules.unit.test.ts` and `../tests/risk-history-changes.unit.test.ts`. This is the prescribed WINDOWS.md entry 11 gate procedure, not a deviation. The ordinary test config and both excluded tests are unchanged. The full backend suite was not run; the orchestrator owns that gate.

Committed activation examples remain `IDAMBOX_KEYCLOAK_PROVISIONING=false`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false` and `CSRM_AUTH_OIDC_ENABLED=false`. No real development credential was issued/exported. Tests used random transient credentials and disposable ignored fixture destinations only; the checkout's `docker/.env` was never read, printed or written.

## Deviations and issues

No functional deviation. The explicit execution request takes precedence over the plan's worker-only instruction to leave STATE/ROADMAP untouched: both tracking files are updated for 03-02 only. MODEL-02 remains pending at workstream level because later sibling plans and live delivery evidence still contribute to it.

The first race-test run exposed a fixture path mismatch through the platform temporary-directory symlink. Canonicalising that fixture made the injected replacement run; implementation checks and assertions were retained. Final named verification is green.

Export contention or a stale reservation fails closed; operators must resolve a stale private lock before retrying. If the parent directory is moved during export, cleanup refuses to follow its replacement. Any residual staging remains inside the original owner-only reservation and the new credential is invalidated by compensation; the command does not claim successful delivery.

## Remaining gates

03-03 through 03-18 are unstarted by this execution. Live token delivery, connector capture, browser/refusal evidence, review/security audits and the full repository gate remain with their declared later checkpoints. Phase 3 is still in progress; its roadmap count is 2/18. Stop after 03-02.

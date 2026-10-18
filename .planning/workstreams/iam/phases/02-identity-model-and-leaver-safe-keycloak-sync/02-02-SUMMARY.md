---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "02"
subsystem: database
tags: [postgresql, pg, pnpm]
status: complete
completed: 2026-10-14
requires:
  - phase: 02-01
    provides: Approved schemas and database invariant checks
provides:
  - Exact pg 8.23.1 runtime driver, resolvable from backend and Knex
affects: [iam, backend]
tech-stack:
  added: [pg@8.23.1]
  patterns: [exact runtime driver pin]
key-files:
  created: []
  modified: [apps/backend/package.json, pnpm-lock.yaml]
requirements-completed: [MODEL-01, MODEL-03, LIFE-02]
actuals:
  tasks: 1
  commits: 0
metrics:
  verification_commands_passed: 2
---

# Plan 02-02 Summary

Installed the exact runtime dependency `pg: 8.23.1` with `pnpm --dir apps/backend add pg@8.23.1 --save-exact`. No framework or unrelated dependency version changed.

## Package audit

Rechecked registry metadata before installation with `pnpm view pg@8.23.1 name version repository.url homepage license engines dist.integrity maintainers --json`. Version, maintainer/repository, MIT licence, Node >=16 engine and integrity match the verified research audit. The [official installation documentation](https://node-postgres.com/) identifies `pg` as the driver and covers Node 24 compatibility; the [Strapi testing documentation](https://docs.strapi.io/cms/testing) supplies its database-driver guidance. No PostgreSQL helper was invoked before installation.

Integrity: `sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==`.

## Verification

| Command | Outcome |
| --- | --- |
| `pnpm --dir apps/backend exec node -e "const a=require('node:assert/strict'); const r=require('node:module').createRequire(require.resolve('knex')); a.equal(require('pg/package.json').version,'8.23.1'); a.ok(require('pg').Client); a.ok(r('pg').Client)"` | Passed; exact driver and Client export resolve from backend and Knex. |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Passed. |
| Plan 02-01 standalone schema check, after compilation | Passed, 4/4 with no skips. |

Semantic lockfile comparison against the starting revision confirms every existing package's version/integrity metadata is unchanged, and other workspace importers are identical. Backend specifiers remain unchanged except for the new exact pg declaration. The lockfile adds only pg and its 13 transitive packages; Strapi/Knex peer-resolution keys and hashes change to include the installed driver. These are necessary peer-context changes, not version upgrades.

## Deviations

None. Existing dependencies were reused; only the required driver was added.

## Task commits

| Task | Commit |
| --- | --- |
| 1 — Verified pinned PostgreSQL runtime driver | None; left in working tree for orchestrator review. |

## Orchestrator-run gates

The shared PostgreSQL database and independent-process proof remain orchestrator-run in 02-11. The driver is installed and the metadata-derived layout helper is ready. No Docker service, production database or live stack was started or mutated. The whole backend suite remains for the orchestrator.

Tracked provisioning/token-verification configuration remains false/unset. ROADMAP.md and STATE.md were not changed.

## Self-Check: PASSED

The two declared artifacts exist; package audit, driver resolution, compilation and scoped dependency comparison passed. No commit was made.

---
phase: 03-strapi-scim-2-0-service
plan: "01"
subsystem: auth
tags: [scim, identity-source, transactions, cryptography]
status: complete
acceptance-status: accepted-by-orchestrator
requires:
  - phase: 02-identity-model-and-leaver-safe-keycloak-sync
    provides: Registered source principals, guarded Document Service writes and transaction patterns
provides:
  - Exact full-token cryptography and serialized source credential administration
  - Real SQLite lifecycle, rollback and independent-transaction concurrency tests
tech-stack:
  added: []
  patterns: [source-row locking, fixed-buffer digest comparison, after-commit lifecycle events]
key-files:
  created:
    - apps/backend/src/iam/scim/token-service.ts
    - apps/backend/src/iam/scim/source-lock.ts
    - apps/backend/tests/iam-scim-token.unit.test.ts
    - apps/backend/tests/iam-scim-token.integration.test.ts
key-decisions:
  - Reuse the persisted source principal; never repair service bindings or grants
  - Emit the closed lifecycle event only after the outer transaction commits
  - Keep acceptance pending when the required global compile fails
requirements-in-scope: ["MODEL-02"]
requirements-completed: []
coverage:
  - id: token-cryptography
    description: Exact token parsing, whole-token SHA-256 and fixed-buffer comparison including absent hashes
    requirement: MODEL-02
    verification:
      - kind: unit
        ref: apps/backend/tests/iam-scim-token.unit.test.ts
        status: pass
    human_judgment: false
  - id: token-lifecycle
    description: Serialized issuance, rotation and idempotent revocation with rollback and independent timestamps
    requirement: MODEL-02
    verification:
      - kind: integration
        ref: apps/backend/tests/iam-scim-token.integration.test.ts
        status: pass
    human_judgment: false
  - id: required-compilation
    description: Repository-wide test compilation required for plan acceptance
    verification:
      - kind: other
        ref: pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false
        status: fail
    human_judgment: true
    rationale: Shared-backend modules imported by pre-existing CSRM tests are absent; restore that baseline and rerun the exact check
actuals:
  tasks: 1
  commits: 2
duration: 8 min
completed: null
---

# Phase 3 Plan 01: Source token lifecycle summary

**Source credentials use exact whole-token digests and serialized Document Service metadata writes. Implementation is committed; plan acceptance remains blocked by pre-existing repository test compilation. This SUMMARY does not certify completion.**

## Execution scope and performance

Only 03-01 was executed. No later plan, CLI, route, connector capture or live gate was started. Implementation/test work ran from 2026-10-15T11:16:34Z (first owned test file creation) to 2026-10-15T11:24:22Z, approximately eight minutes; preparation preceded that interval. Four owned code/test files were created. One task was implemented; zero plans were accepted.

Before implementation, repository refs were fetched and no additional shared-backend commits needed reconciliation. All 18 phase plan structure checks passed with no warnings. The existing principal, registration, write middleware and lock contracts were checked against P3-01/P3-08/P3-09; none required a model or authority change.

## Accomplishments

- Parse exactly the versioned token with a persisted 24-character source documentId and canonical 43-character base64url secret. Generate 32 random bytes, hash the complete exact UTF-8 credential, decode validated digests into 32-byte buffers, and compare through timingSafeEqual. Missing source/hash still compares dummy buffers and fails.
- Resolve exact documentId before unique exact name, refuse ambiguity, acquire a runtime-metadata source-row lock and re-resolve before deciding the operation. PostgreSQL uses FOR UPDATE; SQLite reserves its writer and retries only complete outer transactions. Real SQLite tests exercise independent concurrent rotations and competing explicit issues.
- Issue/rotate require the existing active source principal. Revoke remains idempotent for inactive sources and broken bindings. Only tokenHash/tokenRotatedAt are submitted to Document Service; UTC metadata, lastActivityAt, user lastSyncedAt, roles and service records are checked. Persistence and outer rollback retain the previous credential and emit no success event.

## Task commits

1. `a4314ce1` — `test(iam): specify source token cryptography and lifecycle`
2. `7c775f61` — `feat(iam): serialize source token issuance rotation and revocation`

The RED test failed on the intended parsing assertion (expected the source documentId, received null), with one discovered test, one assertion failure and exit 1. The evidence check accepted this failure. The initial typed service stub was replaced in the implementation commit; all final named tests pass. No separate refactor commit was necessary.

## Verification results

| Check | Result |
|---|---|
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | **FAIL**, exit 1: pre-existing missing CSRM imports and consequent type diagnostics |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=180000 .tmp/tests-dist/tests/iam-scim-token.unit.test.js .tmp/tests-dist/tests/iam-scim-token.integration.test.js` | **PASS**, 14 tests, 0 failures/skips, approximately 19 seconds |
| `pnpm --dir apps/backend test` | **FAIL**, exit 1 at test compilation, before full test discovery; maintenance-switch check and production compilation passed |
| Supplemental strict compile of the two owned tests and generated declarations | **PASS**, using an ignored local configuration extending the unchanged test tsconfig |
| Supplemental identity/source-registration/schema/write-discipline regression compile and execution | **PASS**, 59 tests, 0 failures/skips, approximately 86 seconds; production writer inventory covered 253 files |
| Frozen content types, generated content-type declarations, invariant/index implementation and JDL compared with starting commit `c0d48b8b` | **PASS**, no changes |
| Committed activation configuration | **PASS**, unchanged; all three requested flags remain false |
| `git diff --check` | **PASS** |

The supplemental compiles provide scoped behavior evidence; they do not replace or waive the failed required global check. They changed no tracked configuration or existing test. Local configurations are `apps/backend/.tmp/scim-plan-tsconfig.json` and `apps/backend/.tmp/scim-regression-tsconfig.json`, each extending `../tests/tsconfig.json`. The former includes only the two owned tests plus generated declarations; the latter includes `iam-identity.integration.test.ts`, `iam-source-registration.integration.test.ts`, `iam-schema-contract.unit.test.ts`, `iam-write-discipline.unit.test.ts` and generated declarations. Both use the original strict compiler options. Compiled paths retain the ordinary `.tmp/tests-dist/tests/` layout.

PostgreSQL source-lock query ordering is covered by a unit test using runtime metadata. Live PostgreSQL token concurrency was not run or claimed; real lifecycle/concurrency evidence in this plan uses isolated SQLite persistence. No physical index or schema changes were introduced.

## Acceptance and threat evidence

P3-01 is preserved by the unchanged model/configuration diff. P3-08 is exercised by exact-byte, canonical-format, malformed-digest and instrumented fixed-buffer comparison tests. P3-09 is exercised by independent transaction rotations, single-winner explicit issue, rollback, immediate old-token refusal, broken-binding revocation and UTC metadata tests. T-03-01 has this implementation/test evidence; T-03-SC is preserved by using existing dependencies without installation. Later phase security review remains pending.

The complete MODEL-02 requirement remains unchecked: later plans own CLI delivery, request authentication and final evidence. The 03-01 roadmap checkbox also remains unchecked because its required compilation command failed. STATE and ROADMAP record implementation progress and the acceptance blocker without advancing the dependency chain.

## Deviations from plan

1. **Pre-existing shared-backend compilation blocker.** The starting checkout contains `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts`, but not their imported `apps/backend/src/csrm/risk-curation-rules.ts` and `apps/backend/src/csrm/risk-history-changes.ts` modules. The exact required compile was run before and after implementation and failed identically: TS2307 at test lines 17 and 15, TS18046 at curation test lines 124/125, and TS7006 at history test lines 92/125. These imports predate this task, and fetching repository refs supplied no missing backend implementation. Supplemental strict compilation enabled all owned behavior tests and selected regressions to execute without modifying the required check, weakening tests or starting unrelated feature work. Required global compilation and full-suite acceptance remain unmet. No out-of-scope repair was committed.

No implementation deviation from the locked token decisions was necessary. Planning tracking was updated as explicitly requested for this run, despite the executor-oriented plan footer assigning those writes elsewhere.

## Next action and stop boundary

Restore the missing shared-backend modules through their owning workstream, then rerun both exact 03-01 verification commands and the backend gate. Reconcile this partial SUMMARY and mark 03-01 complete only when the required commands pass. Do not infer completion from this file's presence. No next plan was started.

## Orchestrator acceptance (2026-10-15)

The compilation blocker is csrm's, not this plan's: csrm 16-02 (paused) committed the two red-phase unit tests before their modules (WINDOWS.md entry 11). The orchestrator reviewed the diff and ran the full backend suite with only those two csrm files excluded from compilation and the run: 1817 tests, 1817 pass, 0 fail. Plan 03-01 is accepted on that gate. The unfiltered `pnpm --dir apps/backend test` turns green once csrm lands the two modules; iam neither implements them nor edits csrm tests.

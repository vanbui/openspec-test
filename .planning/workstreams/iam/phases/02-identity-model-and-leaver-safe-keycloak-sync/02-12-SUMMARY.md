---
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "12"
wave: 12
status: complete
subsystem: identity
requirements: ["MODEL-01", "MODEL-03", "PROV-05", "PROV-07", "LIFE-02"]
tasks-completed: [1, 2]
actuals:
  tasks: 2
  commits: 0
key-files:
  created:
    - apps/backend/scripts/idambox-user-write-guard.ts
    - apps/backend/tests/iam-write-discipline.unit.test.ts
    - apps/backend/tests/helpers/idambox-write-discipline.ts
    - apps/backend/tests/iam-write-discipline.integration.test.ts
completed: 2026-10-15
---

# Plan 02-12: Document Service write discipline

Executed only plan 02-12. The initial production inventory result was vacuous:
the Windows path filter matched no source files. Its earlier pass was not evidence
of production write discipline. The review corrections and fresh verification
below supersede that claim.
All changes remain uncommitted for orchestrator review. STATE.md and ROADMAP.md
were not updated. No containers were started and no dependencies were changed.

## Task 1: semantic source inventory

The installed TypeScript compiler supplies a Program and TypeChecker. The guard
resolves imported UID constants, local repository/factory aliases, destructured
and bound mutation methods, assignments, and local helper arguments and returns.
It rejects direct query/entity-service/entity-manager writes, bulk mutations,
Knex and raw SQL writes, inverse Role membership, source/outbox user bindings and
unresolved helpers or SQL receiving a user persistence target. Diagnostics contain
source location, operation and a closed explanation, without source excerpts or
input values.

The path filter now resolves TypeScript's forward-slash filenames to native paths
and rejects an empty inventory. The compiled production test resolves from
`apps/backend/.tmp/tests-dist/tests/` to `apps/backend/src`, checks that path, and
requires more than 100 scanned files. The fresh passing test scanned 250 files.

Object literals retain member-specific provenance and lexical bindings. A property
access selects only that initializer; method calls bind their parameters and read
only their own return expressions. Factory-returned objects, shorthand properties,
arrow methods, member aliases and element access retain the same precision. The
administration repository's sibling user read no longer taints its unrelated
collection writes. Information System owner writes remain writes to that system.
No production source rewrite or application helper exemption was added.

Facts and function-body inspection are memoised by node and stable bound-fact
context, retaining lexical captures while excluding unrelated caller locals.
Return-expression inventories are cached. Active analysis keys replace copied
per-node path sets. Standard-library data operations and the imported Strapi
definition-factory namespace are resolved by compiler provenance; metadata reads
and read-only query joins are distinguished from persistence helpers.

Thirty-five fixture tests retain every previous expected outcome and add unrelated
collection/user collection factory twins, distinct bound member aliases, recursion
and depth-limit cases. Unresolved application helpers receiving user persistence
targets still fail closed. The production inventory test is additional to these
fixtures.

## Task 2: actual persistence provenance

Test-only instrumentation verifies Strapi 5.51.0, the entries module fingerprint,
its actual factory callable fingerprint, and the relation persistence module
fingerprint. The compiler locates the three exact entries persistence call sites.
Repository entry requires the matching structured caller module, function, source
line, Document Service UID and action. Action context around next() carries no
persistence authority.

Each genuine repository invocation owns a private, revocable permit containing
its UID/action, target tables, row and fields. Lower entity-manager mutations
require framework provenance. Knex builders and compiled query identities must
come from framework persistence under that same permit. The only captured raw
mutation callables are the pinned relation orderer's two internal order-column
updates. Arbitrary raw SQL cannot receive their query identity. Checks run before
connection acquisition and again before SQL dispatch. The ledger records actual
SQL dispatch targets and fields, without credentials or record values; transaction
rollback remains independently checked against persisted records.

Lifecycle callbacks and their asynchronous descendants receive no permit. Genuine
nested Document Service writes construct fresh permits. Seven deliberate bypass
forms fail outside and inside transactions, middleware and lifecycle callbacks;
a source-authority bypass also fails. A held lifecycle proves a concurrent promise
cannot borrow authority while a nested legitimate create succeeds.

The real integration suite covers all six source methods with provisioning off and
on, explicit claims and movers, deactivation and tombstones, registration and
repeat source seeding, existing people seeding/reseeding after a claim, ordinary
administration and content-manager updates, manual deletion, nested linkage and
password cleanup, blocking remote-failure rollback, and leaver enqueue without
remote calls. SELECT reads and outbox-only atomic coordination remain allowed.
A replaced entries callable makes installation fail closed.

## Decisions and refinements

- Interprocedural analysis is capped at 24 helper calls. Recursion or depth
  exhaustion receiving a user persistence target reports `unresolved-helper`,
  rather than silently passing or recursing without bound. This conservative
  choice is covered by fixtures.
- The real scan initially exposed the four administration false positives and
  unbounded re-analysis. The final corrections are the Windows path filter,
  member-precise provenance, memoisation and bounded interprocedural inspection.
- A temporary raw `strapi.db.query("api::idambox-user.idambox-user").update(...)`
  probe in `administration-workflow.ts` was compiled. The production-only test
  failed with exactly that forbidden update at line 3 (exit 1; 17.62 seconds).
  The source was restored byte-for-byte; SHA-256 matched its pre-probe value and
  `git diff --exit-code -- apps/backend/src/api/csrm-administration/services/administration-workflow.ts`
  returned 0 with no output. No probe remains.
- Followed the approved contract-gap record and P2-26 through P2-29: source
  inventory is a compiler-based check; runtime instrumentation stays in tests;
  every production user workflow retains the existing Document Service boundary.
- Framework-generated timestamps/defaults and target-bound deletion cleanup
  fields are discovered from metadata. Genuine deletion may clear the document
  identity and remove incoming relation links; this permission exists only inside
  the captured framework delete invocation and retains the target-row check.
- The pinned relation orderer uses raw ROW_NUMBER updates. Those exact internal
  callables are captured rather than permitting all raw work in a transaction.
- Initial fixture verification exposed missed inverse relations and a SELECT
  FOR UPDATE false positive. Runtime iterations exposed timestamp/default fields,
  native frames without source files, relation-order raw SQL and deletion cleanup.
  All were corrected and the final required checks passed. One intermediate
  focused run was stopped when a root-connection raw probe waited on SQLite's
  occupied transaction; checking before acquisition now rejects it immediately.

## Verification

Commands ran from the repository root using installed dependencies. Compilation
preceded each named test invocation.

| Required command | Final result |
| --- | --- |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | PASS, exit 0; 5.56 seconds after probe removal. |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-write-discipline.unit.test.js .tmp/tests-dist/tests/iam-write-discipline.integration.test.js` | PASS, exit 0; 49 tests passed, 0 failed/cancelled/skipped; 220.91 seconds. The production test scanned 250 files and took 21.32 seconds. |
| `pnpm --dir apps/backend exec node .tmp/tests-dist/scripts/idambox-user-write-guard.js --check` | PASS, exit 0; 24.76 seconds including pnpm/Node startup while the focused suite ran. A preceding clean scan took 18.15 seconds. Both are below the 60-second target. |
| `git diff --check` | PASS. |

The original broader 50-test run (approximately 137 seconds) also included
`keycloak-provisioning.integration.test.js`; that historical result is retained as
prior evidence only. Its static production inventory was vacuous. The review run
uses exactly the two requested test files and does not rerun that third suite.
All fresh review checks passed, including the non-vacuous production scan and
the deliberately failing temporary production probe. All changes remain uncommitted;
no Git writes, containers, production rewrites or dependency changes were made.
This is plan work, not phase completion. The full backend suite was deliberately
not run; the orchestrator owns
that gate and comparison against the existing baseline. Runtime provenance tests
here use real SQLite persistence and a localhost fake remote server. The separate
shared PostgreSQL evidence belongs to plan 02-11; its summary records orchestrator
execution on fresh/reused schemas in both process time zones. This plan does not
rerun or substitute for that evidence, and makes no new MySQL verification claim.

# Plan 02-11: complete (Task 1 helpers; Task 2 run by the orchestrator)
phase: 02-identity-model-and-leaver-safe-keycloak-sync
plan: "11"
status: partial
subsystem: identity
tags: [iam, postgres, concurrency, gate]
requires:
  - phase: "02-10"
    provides: Production claims, fenced transitions and bounded revocation worker
provides:
  - Standalone PostgreSQL gate helpers and safe independent-process IPC
  - Dedicated disposable PostgreSQL Compose profile
  - Unit coverage for infrastructure boundaries, failures, cleanup and redaction
actuals:
  tasks: 1
  commits: 0
tasks-completed: [1]
tasks-pending: [2]
requirements-completed: []
tech-stack:
  added: []
key-files:
  created:
    - apps/backend/tests/helpers/iam-postgres-gate.ts
    - apps/backend/tests/helpers/iam-process-runner.ts
    - apps/backend/tests/helpers/iam-gate-harness.ts
    - apps/backend/tests/iam-gates.unit.test.ts
  modified:
    - docker/docker-compose.yaml
    - docker/.env.example
    - docker/README.md
updated: 2026-10-14
---

# Plan 02-11: Task 1 complete; Task 2 pending orchestrator execution

Executed only Task 1 of wave 11, with the requested dedicated gate infrastructure.
Task 2 has not run. This summary is partial and must not be treated as plan or phase
completion evidence. STATE.md and ROADMAP.md were not updated.

## Task 1 delivered

- Added `iam_pg_gate`, using `postgres:16-alpine`, exclusively under Compose profile
  `iam-pg-gate`, bound to `127.0.0.1:15432`. Its data directory is tmpfs, its
  healthcheck uses `pg_isready`, and it has no named volume or dependency on
  `midpoint_data`. Credentials come from `IAM_PG_GATE_USER`,
  `IAM_PG_GATE_PASSWORD` and `IAM_PG_GATE_DB`; placeholders were added only to
  `.env.example`. The local `docker/.env` was not written. README documents
  targeted start, readiness, stop and removal commands.
- The harness reads host, port, user, password and admin database from the invoking
  environment. It requires the dedicated loopback endpoint, rejects SQLite and
  database URL overrides, rejects midPoint names and checks the server database
  catalogue for a midPoint repository before creating anything. It creates a unique
  `iam_gate_<random>` database, registers ownership before waiting for creation,
  and drops only that owned database. A failed CREATE never grants cleanup ownership
  of an existing database.
- The existing installed `pg` driver resolves at version 8.23.1. No dependency was
  installed or changed. Driver, connection, database creation, startup, command,
  timeout and cleanup failures produce named nonzero failures without raw errors.
  The helper never starts containers or substitutes another database dialect.
- The parent compiles the real application once and boots two separate Strapi OS
  children sequentially to avoid racing the framework schema synchronizer. Each
  child has its own pool. The parent compares reported PIDs with launched OS PIDs,
  requires distinct PostgreSQL session IDs, and checks matching server/database
  identity. Child environment inheritance is restricted to OS launch essentials;
  product dotenv loading is redirected to a nonexistent gate-local path and the
  database URL override is explicitly empty.
- A closed IPC command set invokes the compiled production Document Service,
  identity service, claim/worker, user-lock and database-invariant functions.
  Process-local test barriers name claim, user-lock, remote-pair and acknowledgement
  stages. PostgreSQL lock waits are observed through tagged sessions and
  `pg_stat_activity`, rather than inferred from an unsettled promise. Physical
  uniqueness probes are confined to the disposable database and restore bindings
  before further workflow assertions. Production source files and routes are unchanged.
- Prepared mandatory fresh/reused schema scenarios: physical index inspection,
  source tuple and inverse-target races, outbox target/key races, one concurrent
  claim/execution, expired lease recovery and stale fences, partial remote-pair
  replay and unchanged inactive backoff, process death after remote success before
  acknowledgement, reactivation before/after the user lock, second-generation
  authority loss, expired pre-lock authority, subjectless completion, enqueue and
  blocking create/update/claim rollback, and existing-user writes sharing the lock
  while an unrelated write remains independent. These scenarios are implemented;
  they have not been exercised against PostgreSQL in this task.
- Evidence output allows only named outcomes, PIDs, gate database names, schema
  labels and physical index names. Private user snapshots are compared by digest;
  credentials, lease owners, personal fields, remote bodies and raw errors are
  excluded. `gate-complete` is emitted only after successful teardown. The
  30–3600 second timeout includes a fifteen-second cleanup reserve.

## Verification performed

The first test compilation failed on the intentionally absent helper modules,
establishing the initial failing check. After implementation:

| Check | Actual result |
|---|---|
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Passed; all three helpers emitted through the existing helper inclusion |
| `pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=60000 .tmp/tests-dist/tests/iam-gates.unit.test.js` | 14 passed, 0 failed, 0 skipped |
| `docker compose -f docker/docker-compose.yaml --profile iam-pg-gate config --quiet` | Passed static Compose validation |
| `docker compose -f docker/docker-compose.yaml config --services` | `iam_pg_gate` absent from default services |
| `docker compose -f docker/docker-compose.yaml --profile iam-pg-gate config --services` | `iam_pg_gate` present with the explicit profile |
| `git diff --check` | Passed |

Unit checks use mocked SQL and child-process boundaries. They cover argument
validation, missing/unsafe configuration, midPoint catalogue exclusion, two-process
identity, startup/launch/nonzero/timeout propagation, forced shutdown, partial
startup cleanup, unique database ownership, pending CREATE cleanup and evidence
redaction. They establish the helper contract, not a production-dialect pass.

No containers were started. No full backend suite or live PostgreSQL gate was run.
No Git write operation was performed; changes remain uncommitted.

## Task 2: pending orchestrator execution

The orchestrator must perform its shared-backend preflight, provide the gate
connection variables in the invoking environment, start only the disposable
service as documented, and run the compiled helper from the repository root:

```powershell
pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 600
```

Required environment: `IAM_PG_GATE_HOST=127.0.0.1`, `IAM_PG_GATE_PORT=15432`,
`IAM_PG_GATE_USER`, `IAM_PG_GATE_PASSWORD` and `IAM_PG_GATE_ADMIN_DB` (or
`IAM_PG_GATE_DB`). Compose `.env` interpolation does not export values into the
invoking shell. Existing `DATABASE_CLIENT`, if present, must be `postgres`, and
`DATABASE_URL` must be unset. The supplied database role needs CREATEDB privileges.

The orchestrator owns the actual run and the subsequent
`02-POSTGRES-EVIDENCE.md`. That evidence file was not created. No PostgreSQL,
cross-process workflow, physical-constraint or MySQL pass is claimed here.

Plan 02-11 and the phase remain pending until Task 2 records the actual named
PostgreSQL outcomes and successful cleanup.

## Task 2: orchestrator execution (2026-10-15)

PASS. Shared-backend preflight: the default branch had no backend changes this branch lacked. Both independent Strapi processes ran every named stage on a fresh schema and again on the reused schema, under process time zone Australia/Sydney and again under UTC. Cleanup dropped each gate database. Evidence: `02-POSTGRES-EVIDENCE.md`.

The gate found two production defects, both fixed in the same commit: bootstrap invariants used a schema-bound query builder that cannot start queries on PostgreSQL, and outbox raw time mixed the database session zone with Strapi's process-local `timestamp without time zone` writes, so queued leavers never fell due unless the host ran in UTC. The gate port moved from 55432 (Windows dynamic range, taken) to 15432. SQLite regressions after the fixes: 40 of 40.

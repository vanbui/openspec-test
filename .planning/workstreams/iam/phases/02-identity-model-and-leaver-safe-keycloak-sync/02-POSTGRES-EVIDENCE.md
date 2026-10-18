# 02-11 PostgreSQL two-process gate evidence

**Run by:** orchestrator, 2026-10-15 (local), against the disposable `iam_pg_gate` service (compose profile `iam-pg-gate`, PostgreSQL 16, `127.0.0.1:15432`). midPoint's repository (`midpoint_data`) was not used.
**Command:** `pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 1800`, with the `IAM_PG_GATE_*` connection variables in the invoking environment.
**Result:** PASS. Every stage below passed on a fresh schema and again after both Strapi processes restarted on the reused schema. The gate creates and drops its own `iam_gate_<random>` database per run.

## Defects the gate found (fixed before the passing runs)

1. **Bootstrap invariants could not run on PostgreSQL.** `assertConsistentRows` (02-01) called `strapi.db.getConnection()` without a table. With a configured schema, Strapi returns a schema-bound query builder, which cannot start a new query, so the backend could not boot on PostgreSQL at all (`TypeError: connection is not a function`). It now calls `getConnection(table)` per query. The gate's own `raw` probes use `db.connection.raw`.
2. **Outbox work never fell due on PostgreSQL unless the host ran in UTC.** Strapi's PostgreSQL `datetime` columns are `timestamp without time zone`, and the driver writes them in the Node process's local wall time. The outbox's raw coordination compared and wrote them with `clock_timestamp()` in the database session zone (UTC). With the host on AEDT, a freshly queued leaver looked 11 hours in the future, so the worker never claimed it. Database time is now expressed in the process zone (`clock_timestamp() AT TIME ZONE <process zone>`), consistent with Document Service writes. All Strapi instances sharing a database must share a time zone (recommended: UTC).
3. **Port choice.** `55432` falls inside Windows' dynamic port range and was taken by a local process. The gate service moved to `15432`.

## Run 1: process zone Australia/Sydney (database session UTC)

```
{"stage":"two-process-identity","pids":[39152,39560],"database":"iam_gate_0e24d763dba544f8bee4ad1564c535bf","passed":true}
{"stage":"physical-indexes","indexes":["iam_unique_6595caf7660c7b6cc0fd05e0","iam_unique_9afd8a894a5a4e2f9676edc0","iam_unique_058bd65b73a7f03fd56331cd","iam_unique_bea5a7f24e4c7d4ebccbff6d"],"schema":"fresh"}
{"stage":"fresh-physical-indexes","passed":true}
{"stage":"fresh-tuple-race","passed":true}
{"stage":"fresh-source-target-race","passed":true}
{"stage":"fresh-outbox-target-race","passed":true}
{"stage":"fresh-one-claim-and-execution","passed":true}
{"stage":"fresh-outbox-key-race","passed":true}
{"stage":"fresh-partial-pair-replay-and-backoff","passed":true}
{"stage":"fresh-dead-process-crash-before-ack","passed":true}
{"stage":"fresh-reactivation-before-lock-and-generation","passed":true}
{"stage":"fresh-expired-owner-before-user-lock","passed":true}
{"stage":"fresh-reactivation-after-lock","passed":true}
{"stage":"fresh-subjectless-completion","passed":true}
{"stage":"fresh-enqueue-and-blocking-rollback","passed":true}
{"stage":"fresh-existing-writes-user-lock","passed":true}
{"stage":"reused-two-process-identity","pids":[35020,23916],"database":"iam_gate_0e24d763dba544f8bee4ad1564c535bf","passed":true}
{"stage":"physical-indexes","indexes":["iam_unique_6595caf7660c7b6cc0fd05e0","iam_unique_9afd8a894a5a4e2f9676edc0","iam_unique_058bd65b73a7f03fd56331cd","iam_unique_bea5a7f24e4c7d4ebccbff6d"],"schema":"reused"}
{"stage":"reused-physical-indexes","passed":true}
{"stage":"reused-tuple-race","passed":true}
{"stage":"reused-source-target-race","passed":true}
{"stage":"reused-outbox-target-race","passed":true}
{"stage":"reused-one-claim-and-execution","passed":true}
{"stage":"reused-outbox-key-race","passed":true}
{"stage":"reused-partial-pair-replay-and-backoff","passed":true}
{"stage":"reused-dead-process-crash-before-ack","passed":true}
{"stage":"reused-reactivation-before-lock-and-generation","passed":true}
{"stage":"reused-expired-owner-before-user-lock","passed":true}
{"stage":"reused-reactivation-after-lock","passed":true}
{"stage":"reused-subjectless-completion","passed":true}
{"stage":"reused-enqueue-and-blocking-rollback","passed":true}
{"stage":"reused-existing-writes-user-lock","passed":true}
{"stage":"gate-complete","database":"iam_gate_0e24d763dba544f8bee4ad1564c535bf","passed":true}
```

## Run 2: process zone UTC (`TZ=UTC`)

31 evidence lines, all `"passed":true`, ending in `gate-complete` (database `iam_gate_0081b0fe84af4027b40dd919884c51d7`, since dropped).

## What the stages prove

| Stage | Proof |
| --- | --- |
| two-process-identity | Two OS processes with distinct PIDs, the same verified PostgreSQL database, separate connections. |
| physical-indexes | Four real unique indexes (sourceIdentityKey, outbox userDocumentId, IdentitySource serviceUser link, outbox user link) exist on fresh and reused schemas. |
| tuple-race | Concurrent creates of the same source tuple from both processes: exactly one succeeds. |
| source-target-race / outbox-target-race | Concurrent binding of one target: exactly one wins, enforced by the database. |
| one-claim-and-execution | Simultaneous due claims: one owner. After lease expiry the other process recovers (attempts 2); stale owner and wrong generation acknowledge/renew/retry affect zero rows; one disable+logout pair is sent. |
| outbox-key-race | Concurrent deactivation of one user from both processes: one outbox row, generation 1. |
| partial-pair-replay-and-backoff | Disable succeeds, logout fails: row pending with backoff, attempts 1, no remote body stored. A same-state inactive replay leaves attempts/backoff unchanged. When due, the full pair replays and completes. |
| dead-process-crash-before-ack | Worker process killed after both remote calls but before acknowledgement: row stays processing; after expiry the other process replays and completes. |
| reactivation-before-lock-and-generation | Reactivation after a claim but before the worker's user lock: no remote call, row cancelled; a second deactivation becomes generation 2 and the old claim's fence is dead. |
| expired-owner-before-user-lock | An owner whose lease expired while waiting sends nothing. |
| reactivation-after-lock | Reactivation waits on the worker's PostgreSQL row lock (observed in `pg_stat_activity`), then wins; an unrelated user's write is not blocked. |
| subjectless-completion | A user with no Keycloak subject completes without any remote call. |
| enqueue-and-blocking-rollback | An enqueue failure rolls back the deactivation; blocking create, update, reactivation and claim failures roll back with no partial state. |
| existing-writes-user-lock | Role, content-manager, patch, replace, deactivate, delete, manual edit, claim, protection and manual delete writes all wait on the same per-user lock. |

## Observations

- The PostgreSQL driver printed a deprecation warning (concurrent `client.query()` on one connection) once per process during the first race stages. It is not a failure; it comes from parallel queries inside a single transaction and should be traced before pg 9.
- MySQL is not verified.

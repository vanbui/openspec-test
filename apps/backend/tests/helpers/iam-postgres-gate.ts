import assert from "node:assert/strict";
import { GateDeadline, GateFailure, readGateConnection, createIamGateHarness, assertGateProcesses, evidenceLine } from "./iam-gate-harness";
import type { GateProcess, GateIdentity, GateCommand } from "./iam-process-runner";

export function parseGateArgs(args: string[]): number {
  if (args.length !== 2 || args[0] !== "--timeout-seconds" || !/^[1-9][0-9]*$/.test(args[1])) throw new GateFailure("arguments");
  const seconds = Number(args[1]);
  if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 3600) throw new GateFailure("arguments");
  return seconds;
}

type Mutation = { ok: boolean; value?: { documentId: string } };
type User = { documentId: string; accountStatus: string; externalSubject: string | null; fingerprint: string };
type Work = { documentId: string; syncStatus: string; generation: number; attempts: number; nextAttemptAt: string; lastErrorCode: string | null; leaseOwnerPresent: boolean; count: number };
type Claim = { claimed: boolean; generation?: number; attempts?: number; userDocumentId?: string };

/** Standalone entry only: ordinary backend unit-test discovery never invokes this gate. */
export async function runIamPostgresGate(args = process.argv.slice(2), env = process.env,
  emit: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<void> {
  // Reserve fifteen seconds within the requested total budget for failure teardown.
  const deadline = new GateDeadline(parseGateArgs(args) * 1000 - 15_000);
  const connection = readGateConnection(env);
  let harness: Awaited<ReturnType<typeof createIamGateHarness>> | undefined;
  let failure: unknown;
  try {
    harness = await createIamGateHarness(connection, deadline);
    const h = harness;
    emit(evidenceLine("two-process-identity", { pids: h.identities.map((i) => i.pid), database: h.database, passed: true }));
    await deadline.run("setup", () => h.a.request({ op: "setup" }));
    let a = h.a; let b = h.b;
    const read = (id: string) => b.request<User>({ op: "read", id });
    const work = (id: string) => b.request<Work>({ op: "work", id });
    async function create(name: string, manual = false, off = false) {
      const result = await a.request<Mutation>({ op: "create", name, manual, off });
      assert.equal(result.ok, true); assert.ok(result.value);
      return result.value.documentId;
    }
    async function mutate(command: Extract<GateCommand, { op: "mutate" }>, process = a) {
      assert.equal((await process.request<Mutation>(command)).ok, true);
    }
    async function leaver(name: string) {
      const id = await create(name);
      const user = await read(id); assert.ok(user.externalSubject);
      h.remote.sessions.set(user.externalSubject, new Set(["gate-session"]));
      await mutate({ op: "mutate", id, kind: "deactivate" });
      return { id, subject: user.externalSubject };
    }
    async function stage(schema: string, name: string, action: () => Promise<void>) {
      await deadline.run(`${schema}-${name}`, action);
      emit(evidenceLine(`${schema}-${name}`, { passed: true }));
    }
    async function blocked(pid: number) {
      // Observe PostgreSQL's real lock wait, not a wall-clock inference that a promise has not settled.
      while (!await a.request<boolean>({ op: "blocked", pid })) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    }
    for (const schema of ["fresh", "reused"] as const) {
      if (schema === "reused") {
        await a.stop(); await b.stop();
        a = await h.launch(); b = await h.launch();
        const identities = await Promise.all([a.request<GateIdentity>({ op: "identity" }), b.request<GateIdentity>({ op: "identity" })]);
        assertGateProcesses(identities, h.database, [a.pid, b.pid]);
        emit(evidenceLine("reused-two-process-identity", { pids: identities.map((i) => i.pid), database: h.database, passed: true }));
      }
      await stage(schema, "physical-indexes", async () => {
        const indexes = await a.request<string[]>({ op: "indexes" }); assert.equal(indexes.length, 4);
        emit(evidenceLine("physical-indexes", { indexes, schema }));
      });
      await stage(schema, "tuple-race", async () => {
        const results = await Promise.all([a, b].map((child, index) => child.request<Mutation>({ op: "create", name: `${schema}-tuple-${index}`, externalId: `${schema}-same-tuple` })));
        assert.equal(results.filter((r) => r.ok).length, 1);
      });
      await stage(schema, "source-target-race", async () => {
        const serviceId = await a.request<number>({ op: "service-target", name: `${schema}-binding-target` });
        const results = await Promise.all([a, b].map((child, index) => child.request<{ rejected: boolean }>({ op: "bind-source", serviceId, name: `${schema}-bind-${index}` })));
        assert.equal(results.filter((r) => r.rejected).length, 1);
        await Promise.all([a.request({ op: "restore-bindings" }), b.request({ op: "restore-bindings" })]);
      });
      await stage(schema, "outbox-target-race", async () => {
        const ids = await Promise.all([create(`${schema}-outbox-a`, true, true), create(`${schema}-outbox-b`, true, true)]);
        const target = await create(`${schema}-outbox-target`, true, true);
        for (const id of ids) await mutate({ op: "mutate", id, kind: "manual", active: false });
        const results = await Promise.all([a, b].map((child, index) => child.request<{ rejected: boolean }>({ op: "bind-outbox", id: ids[index], target })));
        assert.equal(results.filter((r) => r.rejected).length, 1);
        for (let index = 0; index < 2; index++) {
          assert.equal((await [a, b][index].request<{ rejected: boolean }>({ op: "bind-outbox", id: ids[index], target: ids[index] })).rejected, false);
        }
        await a.request({ op: "indexes" });
        await a.request({ op: "worker" }); await b.request({ op: "worker" });
        for (const id of ids) assert.equal((await work(id)).syncStatus, "completed");
      });
      await stage(schema, "one-claim-and-execution", async () => {
        const user = await leaver(`${schema}-one-claim`);
        const claims = await Promise.all([a, b].map((child) => child.request<Claim>({ op: "claim", slot: "old" })));
        assert.equal(claims.filter((c) => c.claimed).length, 1);
        const owner = claims[0].claimed ? a : b;
        const old = claims.find((c) => c.claimed)!; assert.equal(old.userDocumentId, user.id);
        await b.request({ op: "expire", id: user.id });
        const recovery = await b.request<Claim>({ op: "claim", slot: "recovery" });
        assert.equal(recovery.claimed, true); assert.equal(recovery.attempts, 2);
        assert.deepEqual(await owner.request({ op: "fence", slot: "old" }), [false, false, false, false]);
        assert.deepEqual(await b.request({ op: "fence", slot: "recovery", wrongGeneration: true }), [false, false, false, false]);
        await b.request({ op: "expire", id: user.id });
        const before = h.remote.adminRequests().length;
        await Promise.all([a.request({ op: "worker" }), b.request({ op: "worker" })]);
        assert.equal((await work(user.id)).syncStatus, "completed");
        assert.deepEqual(h.remote.adminRequests().slice(before).map((r) => r.method), ["PUT", "POST"]);
      });
      await stage(schema, "outbox-key-race", async () => {
        const id = await create(`${schema}-outbox-key`);
        const results = await Promise.all([a, b].map((child) => child.request<Mutation>({ op: "mutate", id, kind: "deactivate" })));
        assert.ok(results.every((r) => r.ok));
        const row = await work(id); assert.equal(row.count, 1); assert.equal(row.generation, 1);
        await b.request({ op: "worker" }); assert.equal((await work(id)).syncStatus, "completed");
      });
      await stage(schema, "partial-pair-replay-and-backoff", async () => {
        const user = await leaver(`${schema}-partial`);
        h.remote.failNext(`POST /admin/realms/idambox/users/${user.subject}/logout`, { status: 503, body: "private-remote-body" });
        await a.request({ op: "worker" });
        const pending = await work(user.id);
        assert.equal(pending.syncStatus, "pending"); assert.equal(pending.attempts, 1);
        assert.equal(h.remote.users.get(user.subject)?.enabled, false);
        const calls = h.remote.requests.length;
        await mutate({ op: "mutate", id: user.id, kind: "deactivate" });
        assert.deepEqual(await work(user.id), pending); assert.equal(h.remote.requests.length, calls);
        assert.equal(await b.request({ op: "worker" }), false);
        await b.request({ op: "due", id: user.id });
        const before = h.remote.adminRequests().length;
        await b.request({ op: "worker" });
        assert.deepEqual(h.remote.adminRequests().slice(before).map((r) => r.method), ["PUT", "POST"]);
        assert.equal(h.remote.sessions.has(user.subject), false); assert.equal((await work(user.id)).syncStatus, "completed");
      });
      await stage(schema, "dead-process-crash-before-ack", async () => {
        const user = await leaver(`${schema}-crash`);
        await a.request({ op: "arm", barrier: "acknowledgement" });
        const execution = a.request({ op: "worker" }); void execution.catch(() => {});
        await a.barrier("acknowledgement");
        assert.equal(h.remote.users.get(user.subject)?.enabled, false); assert.equal(h.remote.sessions.has(user.subject), false);
        await a.kill(); await assert.rejects(execution);
        assert.equal((await work(user.id)).syncStatus, "processing");
        await b.request({ op: "expire", id: user.id });
        const before = h.remote.adminRequests().length;
        await b.request({ op: "worker" });
        assert.deepEqual(h.remote.adminRequests().slice(before).map((r) => r.method), ["PUT", "POST"]);
        assert.equal((await work(user.id)).syncStatus, "completed");
        a = await h.launch();
        assertGateProcesses(await Promise.all([a.request<GateIdentity>({ op: "identity" }), b.request<GateIdentity>({ op: "identity" })]), h.database, [a.pid, b.pid]);
      });
      await stage(schema, "reactivation-before-lock-and-generation", async () => {
        const user = await leaver(`${schema}-before-lock`);
        await a.request({ op: "arm", barrier: "claim" });
        const execution = a.request({ op: "worker" }); void execution.catch(() => {});
        await a.barrier("claim");
        await mutate({ op: "mutate", id: user.id, kind: "patch", active: true }, b);
        const before = h.remote.requests.length;
        await a.request({ op: "release", barrier: "claim" }); await execution;
        assert.equal(h.remote.requests.length, before); assert.equal((await work(user.id)).syncStatus, "cancelled");
        await mutate({ op: "mutate", id: user.id, kind: "deactivate" }, b);
        assert.equal((await work(user.id)).generation, 2);
        assert.deepEqual(await a.request({ op: "fence", slot: "worker" }), [false, false, false, false]);
        await b.request({ op: "worker" }); assert.equal((await work(user.id)).syncStatus, "completed");
      });
      await stage(schema, "expired-owner-before-user-lock", async () => {
        const user = await leaver(`${schema}-expired-owner`);
        await a.request({ op: "arm", barrier: "claim" });
        const execution = a.request({ op: "worker" }); void execution.catch(() => {});
        await a.barrier("claim");
        await b.request({ op: "expire", id: user.id });
        const before = h.remote.requests.length;
        await a.request({ op: "release", barrier: "claim" }); await execution;
        assert.equal(h.remote.requests.length, before);
        assert.deepEqual(await a.request({ op: "fence", slot: "worker" }), [false, false, false, false]);
        await b.request({ op: "worker" }); assert.equal((await work(user.id)).syncStatus, "completed");
      });
      await stage(schema, "reactivation-after-lock", async () => {
        const user = await leaver(`${schema}-after-lock`);
        await a.request({ op: "arm", barrier: "user-lock" });
        const execution = a.request({ op: "worker" }); void execution.catch(() => {});
        await a.barrier("user-lock");
        const reactivation = b.request<Mutation>({ op: "mutate", id: user.id, kind: "patch", active: true }); void reactivation.catch(() => {});
        await blocked(b.pid);
        const other = await create(`${schema}-independent`);
        await mutate({ op: "mutate", id: other, kind: "patch" }, b);
        await a.request({ op: "release", barrier: "user-lock" }); await execution;
        assert.equal((await reactivation).ok, true); assert.equal((await read(user.id)).accountStatus, "active");
        assert.equal(h.remote.users.get(user.subject)?.enabled, true); assert.equal(h.remote.sessions.has(user.subject), false);
      });
      await stage(schema, "stop-worker-held-user-lock", async () => {
        const user = await leaver(`${schema}-stop-held-lock`);
        await a.request({ op: "arm", barrier: "user-lock" });
        const held = a.request({ op: "hold-lock", id: user.id }); void held.catch(() => {});
        await a.barrier("user-lock");
        const before = h.remote.requests.length;
        const { boundMs } = await b.request<{ boundMs: number }>({ op: "start-worker" });
        try {
          await b.barrier("claim");
          await blocked(b.pid);
          const { elapsedMs } = await b.request<{ elapsedMs: number }>({ op: "stop-worker" });
          assert.ok(elapsedMs <= boundMs + 250);
          assert.equal(await a.request<boolean>({ op: "blocked", pid: b.pid }), false, "worker transaction must leave the lock wait before teardown completes");
          assert.equal(h.remote.requests.length, before);
          const retained = await work(user.id);
          assert.equal(retained.syncStatus, "processing"); assert.equal(retained.leaseOwnerPresent, true);
        } finally {
          await b.request({ op: "stop-worker" });
          await a.request({ op: "release", barrier: "user-lock" }); await held;
        }
        await b.request({ op: "expire", id: user.id });
        await b.request({ op: "worker" });
        assert.equal((await work(user.id)).syncStatus, "completed");
      });
      await stage(schema, "subjectless-completion", async () => {
        const id = await create(`${schema}-subjectless`, true, true);
        await mutate({ op: "mutate", id, kind: "manual", active: false });
        const before = h.remote.requests.length;
        await b.request({ op: "worker" });
        assert.equal(h.remote.requests.length, before); assert.equal((await work(id)).syncStatus, "completed");
      });
      await stage(schema, "enqueue-and-blocking-rollback", async () => {
        const id = await create(`${schema}-queue-fault`); const original = await read(id);
        await assert.rejects(a.request({ op: "mutate", id, kind: "deactivate", failQueue: true }));
        assert.deepEqual(await read(id), original); assert.equal(await b.request({ op: "work", id }), null);
        h.remote.failNext("POST /admin/realms/idambox/users", { status: 503 });
        assert.equal((await a.request<Mutation>({ op: "create", name: `${schema}-create-fault` })).ok, false);
        assert.equal(await b.request({ op: "count-name", name: `${schema}-create-fault` }), 0);
        h.remote.failNext(`PUT /admin/realms/idambox/users/${original.externalSubject}`, { status: 503 });
        assert.equal((await a.request<Mutation>({ op: "mutate", id, kind: "patch" })).ok, false);
        assert.deepEqual(await read(id), original);
        await mutate({ op: "mutate", id, kind: "deactivate" });
        const pending = await work(id);
        h.remote.failNext(`PUT /admin/realms/idambox/users/${original.externalSubject}`, { status: 503 });
        assert.equal((await a.request<Mutation>({ op: "mutate", id, kind: "patch", active: true })).ok, false);
        assert.equal((await read(id)).accountStatus, "inactive"); assert.deepEqual(await work(id), pending);
        await b.request({ op: "worker" });
        const manual = await create(`${schema}-claim-fault`, true, true); const manualBefore = await read(manual);
        h.remote.failNext("POST /admin/realms/idambox/users", { status: 503 });
        assert.equal((await a.request<Mutation>({ op: "mutate", id: manual, kind: "claim", name: `${schema}-claim-fault` })).ok, false);
        assert.deepEqual(await read(manual), manualBefore);
      });
      await stage(schema, "existing-writes-user-lock", async () => {
        const owned = await create(`${schema}-lock-owned`);
        const manual = await create(`${schema}-lock-manual`, true, true);
        const protectable = await create(`${schema}-lock-protectable`, true, true);
        const deletable = await create(`${schema}-lock-deletable`, true, true);
        const commands: Extract<GateCommand, { op: "mutate" }>[] = [
          { op: "mutate", id: owned, kind: "roles" },
          { op: "mutate", id: owned, kind: "content-manager" },
          { op: "mutate", id: owned, kind: "patch" },
          { op: "mutate", id: owned, kind: "replace", name: `${schema}-lock-owned` },
          { op: "mutate", id: owned, kind: "deactivate" },
          { op: "mutate", id: owned, kind: "delete" },
          { op: "mutate", id: manual, kind: "manual" },
          { op: "mutate", id: manual, kind: "claim", name: `${schema}-lock-manual` },
          { op: "mutate", id: protectable, kind: "protect" },
          { op: "mutate", id: deletable, kind: "manual-delete" },
        ];
        for (const command of commands) {
          await a.request({ op: "arm", barrier: "user-lock" });
          const lock = a.request({ op: "hold-lock", id: command.id }); void lock.catch(() => {});
          await a.barrier("user-lock");
          const change = b.request<Mutation>(command); void change.catch(() => {});
          await blocked(b.pid);
          await a.request({ op: "release", barrier: "user-lock" }); await lock;
          assert.equal((await change).ok, true);
        }
        await b.request({ op: "worker" });
      });
    }
  } catch (error) { failure = error; }
  finally {
    try { await harness?.close(); } catch (error) { failure = error; }
  }
  if (failure) throw failure instanceof GateFailure ? failure : new GateFailure("gate");
  emit(evidenceLine("gate-complete", { passed: true, database: harness!.database }));
}

if (require.main === module) {
  void runIamPostgresGate().catch((error: unknown) => {
    const failure = error instanceof GateFailure ? error : new GateFailure("gate");
    process.stderr.write(`${failure.message}\n`); process.exitCode = 1;
  });
}

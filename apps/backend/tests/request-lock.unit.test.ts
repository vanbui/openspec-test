import assert from "node:assert/strict";
import test from "node:test";

import { withRequestLock, type RequestLockStrapi } from "../src/api/csrm-assessment-request/services/request-lock";

/*
 * Code review WR-201: the in-process half of the one per-request lock (request-lock.ts, layer 1), proven without
 * SQLite. The mounted race tests cannot fail without it: knex's single SQLite connection serialises every transaction on
 * its own. This fake database serialises nothing, as a pool of many connections would not, so only the promise tail
 * keeps two writers to one request apart. The row lock's own proof (FOR UPDATE making another process's transaction
 * wait) is R-08-37's, on PostgreSQL.
 */

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => { resolve = settle; });
  return { promise, resolve };
}

/** Lets every queued promise callback run, so a writer that could start has started. */
async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) await new Promise((resolve) => setImmediate(resolve));
}

/** A database whose transactions run side by side, recording each lock statement as `lock:<documentId>`. */
function fakeStrapi(events: string[]): RequestLockStrapi {
  return {
    db: {
      transaction: async (work) => work({ trx: {} }),
      queryBuilder: () => {
        let documentId = "";
        let forUpdate = false;
        const query = {
          select: () => query,
          where: (where: Record<string, unknown>) => { documentId = String(where.documentId); return query; },
          forUpdate: () => { forUpdate = true; return query; },
          transacting: () => query,
          execute: async <T>() => {
            assert.ok(forUpdate, "LOCK_READ_WITHOUT_FOR_UPDATE");
            events.push(`lock:${documentId}`);
            return [] as T;
          },
        };
        return query;
      },
    },
  };
}

test("two writers to one request never interleave: the second starts only after the first settles, each after its lock (WR-201)", async () => {
  const events: string[] = [];
  const strapi = fakeStrapi(events);
  const gate = deferred();
  const first = withRequestLock(strapi, "request-a", async () => {
    events.push("first:start");
    await gate.promise;
    events.push("first:end");
    return "first";
  });
  const second = withRequestLock(strapi, "request-a", async () => {
    events.push("second:start");
    events.push("second:end");
    return "second";
  });
  await settle();
  assert.deepEqual(events, ["lock:request-a", "first:start"], "SECOND_WRITER_STARTED_WHILE_THE_FIRST_HELD_THE_REQUEST");
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second]), ["first", "second"], "WRITERS_DID_NOT_BOTH_COMPLETE");
  assert.deepEqual(events, ["lock:request-a", "first:start", "first:end", "lock:request-a", "second:start", "second:end"], "WRITERS_INTERLEAVED");
});

test("writers to two requests run independently: one held request never delays another (WR-201)", async () => {
  const events: string[] = [];
  const strapi = fakeStrapi(events);
  const gate = deferred();
  const held = withRequestLock(strapi, "request-a", async () => {
    events.push("a:start");
    await gate.promise;
    events.push("a:end");
  });
  await settle();
  const other = await Promise.race([
    withRequestLock(strapi, "request-b", async () => { events.push("b:done"); return "ran"; }),
    new Promise((resolve) => setTimeout(() => resolve("waited"), 1_000)),
  ]);
  assert.equal(other, "ran", "ANOTHER_REQUEST_WAITED_ON_A_HELD_ONE");
  assert.deepEqual(events, ["lock:request-a", "a:start", "lock:request-b", "b:done"], "ANOTHER_REQUEST_RAN_OUT_OF_ORDER");
  gate.resolve();
  await held;
});

test("a writer that fails releases the request: the next writer runs, and so does one after both settle (WR-201)", async () => {
  const events: string[] = [];
  const strapi = fakeStrapi(events);
  const gate = deferred();
  const failing = withRequestLock(strapi, "request-a", async () => {
    events.push("failing:start");
    await gate.promise;
    throw new Error("refused");
  });
  const next = withRequestLock(strapi, "request-a", async () => { events.push("next:run"); return "next"; });
  await settle();
  assert.deepEqual(events, ["lock:request-a", "failing:start"], "NEXT_WRITER_STARTED_BEFORE_THE_FAILURE");
  gate.resolve();
  await assert.rejects(failing, /refused/, "FAILURE_NOT_PROPAGATED");
  assert.equal(await next, "next", "NEXT_WRITER_NEVER_RAN");
  // Both settled: a later writer is not left waiting on a tail that will never resolve.
  const later = await Promise.race([
    withRequestLock(strapi, "request-a", async () => "later"),
    new Promise((resolve) => setTimeout(() => resolve("stuck"), 1_000)),
  ]);
  assert.equal(later, "later", "A_SETTLED_TAIL_STILL_HELD_THE_REQUEST");
});

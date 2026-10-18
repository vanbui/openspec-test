import assert from "node:assert/strict";
import test from "node:test";

import {
  RESCAN_BACKOFF_MINUTES,
  RESCAN_MAX_ATTEMPTS,
  createRescanScheduler,
  type RescanOutcome,
  type RescanTimers,
} from "../src/csrm/files/rescan-scheduler";

/*
 * Phase 14 (D-13, D-21; 14-RESEARCH Settled 5, Pitfall 11): the in-process re-scan scheduler, with injected timers. A
 * quarantined file is re-scanned after 1, 5, 15 and 60 minutes, then hourly, at most 24 attempts in all; every start
 * re-scans every pending file once; stop() clears every timer; no timer keeps the process alive.
 */

const MINUTE = 60_000;

type FakeTimer = { id: number; callback: () => void; ms: number; unrefed: boolean };

/** Timers the test fires by hand, each recording whether it was unref()'d. */
function fakeTimers() {
  const live = new Map<number, FakeTimer>();
  const created: FakeTimer[] = [];
  let next = 1;
  const timers: RescanTimers = {
    setTimeout(callback, ms) {
      const timer: FakeTimer = { id: next++, callback, ms, unrefed: false };
      live.set(timer.id, timer);
      created.push(timer);
      return { id: timer.id, unref() { timer.unrefed = true; } };
    },
    clearTimeout(handle) {
      live.delete((handle as unknown as { id: number }).id);
    },
  };
  return {
    timers,
    created,
    live: () => [...live.values()],
    /** Fires one timer as the runtime would: it is no longer live once its callback runs. */
    fire(timer: FakeTimer): void {
      live.delete(timer.id);
      timer.callback();
    },
    /** Fires the only live timer and lets the re-scan it starts settle. */
    async fireOnly(): Promise<FakeTimer> {
      const [timer, ...rest] = [...live.values()];
      assert.ok(timer && rest.length === 0, `EXPECTED_ONE_LIVE_TIMER_${live.size}`);
      live.delete(timer.id);
      timer.callback();
      await settle();
      return timer;
    },
  };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

function recordingLogger() {
  const errors: string[] = [];
  return { errors, logger: { error: (message: string) => void errors.push(message) } };
}

test("the backoff is 1, 5, 15 and 60 minutes, then hourly, and the bound is 24 attempts", () => {
  assert.deepEqual([...RESCAN_BACKOFF_MINUTES], [1, 5, 15, 60]);
  assert.equal(RESCAN_MAX_ATTEMPTS, 24);
});

test("start() re-scans every pending file once, then schedules each one still pending by its attempts", async () => {
  const clock = fakeTimers();
  const { logger } = recordingLogger();
  const rescanned: string[] = [];
  const outcomes: Record<string, RescanOutcome> = { a: "still-pending", b: "released", c: "blocked", d: "still-pending" };
  const scheduler = createRescanScheduler({
    listPending: async () => [{ id: "a", attempts: 1 }, { id: "b", attempts: 3 }, { id: "c", attempts: 2 }, { id: "d", attempts: 4 }],
    rescan: async (id) => {
      rescanned.push(id);
      return { outcome: outcomes[id]!, attempts: id === "a" ? 2 : 5 };
    },
    timers: clock.timers,
    logger,
  });
  await scheduler.start();
  assert.deepEqual(rescanned, ["a", "b", "c", "d"], "UNEXPECTED_BOOT_RESCANS");
  assert.deepEqual(clock.live().map((timer) => timer.ms).sort((x, y) => x - y), [5 * MINUTE, 60 * MINUTE], "UNEXPECTED_BOOT_SCHEDULE");
  assert.deepEqual([...scheduler.scheduled()].sort(), ["a", "d"], "UNEXPECTED_SCHEDULED_IDS");
  scheduler.stop();
});

test("a file still pending is re-scanned after 1, 5, 15 and 60 minutes, then hourly, and not after 24 attempts, with one error", async () => {
  const clock = fakeTimers();
  const { errors, logger } = recordingLogger();
  let attempts = 1;
  const scheduler = createRescanScheduler({
    listPending: async () => [],
    rescan: async () => {
      attempts += 1;
      return { outcome: "still-pending", attempts };
    },
    timers: clock.timers,
    logger,
  });
  scheduler.schedule("pending-file", 1);
  const delays: number[] = [];
  while (clock.live().length > 0) delays.push((await clock.fireOnly()).ms / MINUTE);
  assert.deepEqual(delays, [1, 5, 15, ...Array.from({ length: 20 }, () => 60)], "UNEXPECTED_BACKOFF");
  assert.equal(attempts, RESCAN_MAX_ATTEMPTS, "UNEXPECTED_ATTEMPT_COUNT");
  assert.equal(errors.length, 1, `UNEXPECTED_ERRORS_${errors.join(" | ")}`);
  assert.match(errors[0] ?? "", /pending-file/, "UNEXPECTED_ERROR_WITHOUT_ID");
  assert.deepEqual(scheduler.scheduled(), [], "UNEXPECTED_STILL_SCHEDULED");
});

test("a released or blocked file is not rescheduled, and a file already at 24 attempts is not scheduled at all", async () => {
  const clock = fakeTimers();
  const { errors, logger } = recordingLogger();
  const results: RescanOutcome[] = ["released", "blocked"];
  const scheduler = createRescanScheduler({
    listPending: async () => [],
    rescan: async () => ({ outcome: results.shift() ?? "gone", attempts: 2 }),
    timers: clock.timers,
    logger,
  });
  scheduler.schedule("released-file", 1);
  await clock.fireOnly();
  assert.equal(clock.live().length, 0, "UNEXPECTED_RELEASED_RESCHEDULED");
  scheduler.schedule("blocked-file", 1);
  await clock.fireOnly();
  assert.equal(clock.live().length, 0, "UNEXPECTED_BLOCKED_RESCHEDULED");
  scheduler.schedule("exhausted-file", RESCAN_MAX_ATTEMPTS);
  assert.equal(clock.live().length, 0, "UNEXPECTED_EXHAUSTED_SCHEDULED");
  assert.equal(errors.length, 1, "UNEXPECTED_EXHAUSTED_ERROR_COUNT");
});

test("a re-scan that throws is logged and the file stays scheduled: it is never released by an error", async () => {
  const clock = fakeTimers();
  const { errors, logger } = recordingLogger();
  const scheduler = createRescanScheduler({
    listPending: async () => [],
    rescan: async () => {
      throw new Error("database unavailable");
    },
    timers: clock.timers,
    logger,
  });
  scheduler.schedule("flaky-file", 1);
  await clock.fireOnly();
  assert.equal(errors.length, 1, "UNEXPECTED_THROW_NOT_LOGGED");
  assert.deepEqual(clock.live().map((timer) => timer.ms), [5 * MINUTE], "UNEXPECTED_THROW_SCHEDULE");
  scheduler.stop();
});

test("stop() clears every timer, and a re-scan finishing after stop() schedules nothing", async () => {
  const clock = fakeTimers();
  const { logger } = recordingLogger();
  let finish: (() => void) | undefined;
  const scheduler = createRescanScheduler({
    listPending: async () => [],
    rescan: (id) => new Promise((resolve) => {
      if (id === "slow") finish = () => resolve({ outcome: "still-pending", attempts: 2 });
      else resolve({ outcome: "still-pending", attempts: 2 });
    }),
    timers: clock.timers,
    logger,
  });
  scheduler.schedule("a", 1);
  scheduler.schedule("b", 2);
  scheduler.schedule("slow", 1);
  assert.equal(clock.live().length, 3, "UNEXPECTED_TIMER_COUNT");
  clock.fire(clock.created[2]!);
  const stopped = scheduler.stop();
  assert.equal(clock.live().length, 0, "UNEXPECTED_TIMERS_AFTER_STOP");
  finish?.();
  await stopped;
  await settle();
  assert.equal(clock.live().length, 0, "UNEXPECTED_TIMER_AFTER_STOP");
  scheduler.schedule("late", 1);
  assert.equal(clock.live().length, 0, "UNEXPECTED_SCHEDULE_AFTER_STOP");
  assert.deepEqual(scheduler.scheduled(), [], "UNEXPECTED_SCHEDULED_AFTER_STOP");
});

test("every timer the scheduler creates is unref()'d, so none keeps the process alive", async () => {
  const clock = fakeTimers();
  const { logger } = recordingLogger();
  let attempts = 1;
  const scheduler = createRescanScheduler({
    listPending: async () => [{ id: "boot", attempts: 1 }],
    rescan: async () => ({ outcome: "still-pending", attempts: ++attempts }),
    timers: clock.timers,
    logger,
  });
  await scheduler.start();
  scheduler.schedule("upload", 1);
  assert.equal(clock.created.length, 2, "UNEXPECTED_TIMER_COUNT");
  assert.deepEqual(clock.created.filter((timer) => !timer.unrefed), [], "UNEXPECTED_REFERENCED_TIMER");
  scheduler.stop();
});

test("the real timers are unref()'d too", () => {
  const { logger } = recordingLogger();
  const scheduler = createRescanScheduler({ listPending: async () => [], rescan: async () => ({ outcome: "gone", attempts: 0 }), logger });
  const original = globalThis.setTimeout;
  const handles: NodeJS.Timeout[] = [];
  globalThis.setTimeout = ((callback: () => void, ms: number) => {
    const handle = original(callback, ms);
    handles.push(handle);
    return handle;
  }) as typeof setTimeout;
  try {
    scheduler.schedule("real", 1);
  } finally {
    globalThis.setTimeout = original;
  }
  assert.equal(handles.length, 1, "UNEXPECTED_REAL_TIMER_COUNT");
  assert.equal(handles[0]?.hasRef(), false, "UNEXPECTED_REAL_TIMER_REFERENCED");
  scheduler.stop();
});

/*
 * WR-102: bootstrap() does not wait for the start's re-scans, so a listing that rejects (a database error at boot) must
 * never become an unhandled rejection, which Node's default turns into the end of the process. The start's own promise
 * rejects for its caller to handle; no promise the scheduler derives from it may reject unhandled.
 */
test("a start whose listing rejects leaves no unhandled rejection behind (WR-102)", async () => {
  const { logger } = recordingLogger();
  const clock = fakeTimers();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const scheduler = createRescanScheduler({
      listPending: async () => { throw new Error("database unavailable at boot"); },
      rescan: async () => ({ outcome: "gone", attempts: 0 }),
      timers: clock.timers,
      logger,
    });
    await assert.rejects(scheduler.start(), /database unavailable at boot/, "THE_START_DID_NOT_REJECT_FOR_ITS_CALLER");
    await settle();
    await scheduler.stop();
    await settle();
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(unhandled.map(String), [], "AN_UNHANDLED_REJECTION_FIRED");
});

/*
 * IN-210: stop() runs at Strapi's destroy(), so it must never wait out a scan. The scheduler hands each re-scan an
 * AbortSignal and stop() aborts it: a scan in flight ends at once (the adapter answers an aborted scan "not scanned"),
 * and stop() resolves without waiting for the scanner's timeout. Here the re-scan ends only when its signal aborts, or
 * when the test gives up on it after stop() has had its chance.
 */
test("stop() aborts a re-scan in flight through the signal it was given, so a shutdown never waits out a scan (IN-210)", async () => {
  const clock = fakeTimers();
  const { logger } = recordingLogger();
  const signals: Array<AbortSignal | undefined> = [];
  let giveUp: () => void = () => undefined;
  const scheduler = createRescanScheduler({
    listPending: async () => [{ id: "in-flight", attempts: 1 }],
    rescan: (_id: string, signal?: AbortSignal) => new Promise((resolve) => {
      signals.push(signal);
      const end = () => resolve({ outcome: "still-pending", attempts: 1 });
      signal?.addEventListener("abort", end, { once: true });
      giveUp = end;
    }),
    timers: clock.timers,
    logger,
  });
  const started = scheduler.start();
  await settle();
  assert.equal(signals.length, 1, "THE_RESCAN_DID_NOT_START");
  const abortedBeforeStop = signals[0]?.aborted;
  const stopped = scheduler.stop();
  const first = await Promise.race([
    stopped.then(() => "stopped"),
    new Promise<string>((resolve) => setTimeout(() => resolve("still waiting"), 500)),
  ]);
  giveUp();
  await stopped;
  await started;
  assert.equal(first, "stopped", "STOP_WAITED_FOR_THE_SCAN_IN_FLIGHT");
  assert.equal(abortedBeforeStop, false, "THE_SIGNAL_WAS_ABORTED_BEFORE_STOP");
  assert.equal(signals[0]?.aborted, true, "THE_SCAN_IN_FLIGHT_WAS_NOT_ABORTED");
  assert.equal(clock.live().length, 0, "A_TIMER_OUTLIVED_STOP");
});

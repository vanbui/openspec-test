/*
 * The in-process re-scan scheduler (14-07; D-13, D-21; 14-RESEARCH Settled 5, Pitfall 11). Generic over what it
 * re-scans, so Phase 20's evidence files reuse it: the caller lists the pending items and re-scans one.
 *
 * - A file the scanner could not check is re-scanned after 1, 5, 15 and 60 minutes, then every 60, until a verdict
 *   releases or blocks it, and never past 24 attempts in all; the last one logs a single error so an operator can act.
 * - start() re-scans every pending item once (each Strapi start), then schedules each still pending by its attempts.
 * - Every timer is unref()'d and kept, and stop() clears them all, aborts any scan in flight through the signal each
 *   re-scan is given (IN-210), and waits for the re-scans to finish, so no timer or re-scan outlives Strapi and a
 *   shutdown never waits out a scan. An aborted re-scan writes nothing: the file stays pending for the next start.
 * - A re-scan that throws is logged and stays scheduled: an error never releases a file.
 *
 * It is a single-process scheduler, like the questionnaire generation registry (R-08-36): another process's uploads
 * are re-scanned at its own start or schedule, and every write it causes re-checks the record under the request lock.
 */

/** Minutes to wait before re-scan n + 1 after n attempts: 1, 5, 15, 60, then 60 for every later one. */
export const RESCAN_BACKOFF_MINUTES: readonly number[] = Object.freeze([1, 5, 15, 60]);

/** The most scan attempts a file gets, the upload's own included. */
export const RESCAN_MAX_ATTEMPTS = 24;

const MINUTE_MS = 60_000;

/** What a re-scan did: a verdict released or blocked the file, it is still pending, or there is nothing to re-scan. */
export type RescanOutcome = "released" | "blocked" | "still-pending" | "gone";

export type RescanResult = { readonly outcome: RescanOutcome; readonly attempts: number };

export type PendingRescan = { readonly id: string; readonly attempts: number };

export type RescanTimerHandle = { unref(): unknown };

/** The clock, injectable for tests; the real timers by default. */
export type RescanTimers = {
  setTimeout(callback: () => void, ms: number): RescanTimerHandle;
  clearTimeout(handle: RescanTimerHandle): void;
};

export type RescanLogger = { error(message: string): void };

export type RescanScheduler = {
  /** Re-scans every pending item once, then schedules each still pending. */
  start(): Promise<void>;
  /** Schedules the next re-scan of an item after `attempts` attempts; nothing at or past the bound. */
  schedule(id: string, attempts: number): void;
  /** Clears every timer, accepts no more work, aborts any scan in flight and resolves once its re-scan has finished. */
  stop(): Promise<void>;
  /** The ids with a re-scan scheduled, sorted. */
  scheduled(): readonly string[];
};

const REAL_TIMERS: RescanTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
};

/** The delay before the next re-scan of an item that has had `attempts` attempts. */
export function rescanDelayMs(attempts: number): number {
  const index = Math.max(0, Math.floor(attempts) - 1);
  return (RESCAN_BACKOFF_MINUTES[index] ?? RESCAN_BACKOFF_MINUTES[RESCAN_BACKOFF_MINUTES.length - 1]!) * MINUTE_MS;
}

export function createRescanScheduler(options: {
  listPending: () => Promise<readonly PendingRescan[]>;
  /** Re-scans one item; `signal` aborts when the scheduler stops, and the scan should end at once (IN-210). */
  rescan: (id: string, signal: AbortSignal) => Promise<RescanResult>;
  timers?: RescanTimers;
  logger: RescanLogger;
}): RescanScheduler {
  const timers = options.timers ?? REAL_TIMERS;
  const handles = new Map<string, RescanTimerHandle>();
  const inFlight = new Set<Promise<void>>();
  const stopping = new AbortController();
  let stopped = false;

  /*
   * WR-102: the bookkeeping promise handles both outcomes, so a rejected `work` (a listing that fails at boot) never
   * derives an unhandled rejection; `work` itself is returned for its caller to handle.
   */
  const track = (work: Promise<void>): Promise<void> => {
    inFlight.add(work);
    work.then(() => inFlight.delete(work), () => inFlight.delete(work));
    return work;
  };

  /** One re-scan, then the next step by its outcome; a throw is logged and the item stays scheduled. */
  const run = (id: string, attempts: number): Promise<void> => track((async () => {
    let next: RescanResult;
    try {
      next = await options.rescan(id, stopping.signal);
    } catch {
      options.logger.error(`csrm.attachment_rescan: the re-scan of attachment ${id} failed; it stays quarantined and is tried again.`);
      next = { outcome: "still-pending", attempts: attempts + 1 };
    }
    if (next.outcome === "still-pending") schedule(id, next.attempts);
  })());

  function schedule(id: string, attempts: number): void {
    if (stopped) return;
    const existing = handles.get(id);
    if (existing) {
      timers.clearTimeout(existing);
      handles.delete(id);
    }
    if (attempts >= RESCAN_MAX_ATTEMPTS) {
      options.logger.error(
        `csrm.attachment_rescan: attachment ${id} is still quarantined after ${attempts} scan attempts; it is not re-scanned again until the next start. Check the malware scanner.`,
      );
      return;
    }
    const handle = timers.setTimeout(() => {
      handles.delete(id);
      if (!stopped) void run(id, attempts);
    }, rescanDelayMs(attempts));
    handle.unref();
    handles.set(id, handle);
  }

  return {
    start() {
      if (stopped) return Promise.resolve();
      // Tracked like a re-scan, so stop() also waits for a start that is still listing or scanning.
      return track((async () => {
        const pending = await options.listPending();
        for (const item of pending) {
          if (stopped) return;
          await run(item.id, item.attempts);
        }
      })());
    },
    schedule,
    async stop() {
      stopped = true;
      stopping.abort();
      for (const handle of handles.values()) timers.clearTimeout(handle);
      handles.clear();
      await Promise.allSettled([...inFlight]);
    },
    scheduled() {
      return [...handles.keys()].sort();
    },
  };
}

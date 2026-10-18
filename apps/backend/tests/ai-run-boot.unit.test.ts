import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";

import type { Core } from "@strapi/strapi";

import application from "../src/index";
import { CsrmAiConfigurationError } from "../src/csrm/ai-config-validation";
import * as identityDatabaseInvariants from "../src/iam/identity/database-invariants";

/*
 * WR-207: the boot wiring, driven through the application's own lifecycle with a fake Strapi, as
 * keycloak-provisioning.unit drives `register`. D-27: `register` refuses to boot on a data classification ceiling
 * outside the scale. D-20 with WR-01: `bootstrap` closes the AI runs a previous process left `running` once they are
 * older than the AI request bound (the request timeout, CSRM_AI_REQUEST_TIMEOUT_MS, plus a five-minute margin), and
 * schedules one deferred sweep when that bound has passed since boot, on an unref'd timer that `destroy` stops.
 */

type Lifecycle = (input: { strapi: Core.Strapi }) => unknown;
const lifecycle = application as unknown as { register: Lifecycle; bootstrap: Lifecycle; destroy?: Lifecycle };

// The fake Strapi has no database. The IAM identity invariants run first in `bootstrap` and are proven against a real
// database by iam-database-invariants.integration, so this file stands them in to reach the AI run sweep.
mock.method(identityDatabaseInvariants, "ensureIdentityDatabaseInvariants", async () => undefined);

const BOOT_ENV_KEYS = [
  "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION", "IDAMBOX_SEED_CORE", "IDAMBOX_SEED_CSRM", "CSRM_DEV_IDENTITY", "CSRM_DEV_API_TOKEN",
] as const;

/**
 * IN-303: the settings register() validates for attachments (14-03), cleared with the others, so the ambient environment
 * never decides a boot outcome: with none set, attachments are simply not configured.
 */
function attachmentEnvKeys(): string[] {
  return ["NODE_ENV", "CSRM_ENVIRONMENT", ...Object.keys(process.env).filter((key) => /^CSRM_(ATTACHMENT|CLAMAV)_/.test(key))];
}

/** Runs `action` with Keycloak, the development seeds and the attachment settings off, whatever the developer's environment holds. */
async function withQuietBoot<T>(action: () => T | Promise<T>): Promise<T> {
  const keys = [...BOOT_ENV_KEYS, ...attachmentEnvKeys()];
  const saved = keys.map((key) => [key, process.env[key]] as const);
  for (const key of keys) delete process.env[key];
  try {
    return await action();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

type FakeRun = { documentId: string; status: string; startedAt: string; completedAt: string | null };
type RunQuery = { filters: { status: { $eq: string }; startedAt?: { $lt: string } }; limit: number };

/** A Strapi with just enough surface for `register`, `bootstrap` and `destroy` while Keycloak and the seeds are off. */
function fakeStrapi(input: { ai: unknown; runs?: FakeRun[] }) {
  const runs = input.runs ?? [];
  const runQueries: RunQuery[] = [];
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const state = { runReadsFail: false };
  const strapi = {
    // register() also validates the attachment settings (14-03), which reads the app root and stores its result.
    config: { get: (key: string) => (key === "ai" ? input.ai : undefined), set: () => undefined },
    dirs: { app: { root: process.cwd() } },
    server: { routes: () => undefined },
    // ...installs the private local provider on the upload plugin and unmounts its content-API routes (14-04).
    plugin: () => ({ provider: { extend: () => undefined }, routes: { "content-api": { routes: [] } } }),
    log: {
      info: (message: string) => logs.info.push(message),
      warn: (message: string) => logs.warn.push(message),
      error: (message: string) => logs.error.push(message),
      debug: () => undefined,
    },
    store: () => ({ get: async () => ({ allow_register: false }), set: async () => undefined }),
    query: (uid: string) => (uid === "plugin::users-permissions.role"
      ? { findOne: async () => ({ id: 1 }) }
      : { findMany: async () => [], delete: async () => undefined }),
    documents: (uid: string) => {
      assert.equal(uid, "api::csrm-ai-run.csrm-ai-run", `bootstrap read ${uid}`);
      return {
        // The Document Service's semantics for the filters a reconciliation may send: a status, and an optional start bound.
        findMany: async (query: RunQuery) => {
          runQueries.push(query);
          if (state.runReadsFail) throw new Error("database unavailable");
          const startedBefore = query.filters.startedAt?.$lt;
          return runs
            .filter((run) => run.status === query.filters.status.$eq && (startedBefore === undefined || Date.parse(run.startedAt) < Date.parse(startedBefore)))
            .slice(0, query.limit)
            .map((run) => ({ ...run }));
        },
        update: async ({ documentId, data }: { documentId: string; data: Partial<FakeRun> }) => {
          const run = runs.find((item) => item.documentId === documentId);
          assert.ok(run, `updated an unknown run ${documentId}`);
          Object.assign(run, data);
          return { ...run };
        },
      };
    },
  };
  // register() installs the always-on identity write guard (02-07); this fake never writes users.
  Object.assign(strapi.documents, { use: () => undefined });
  return { strapi: strapi as unknown as Core.Strapi, runs, runQueries, logs, state };
}

type RecordedTimer = { callback: () => unknown; delay: number | undefined; unrefs: number; handle: object };

/** Replaces the global timer functions for this test only, recording what is scheduled and cleared. */
function recordTimers(t: TestContext) {
  const scheduled: RecordedTimer[] = [];
  const cleared: unknown[] = [];
  t.mock.method(globalThis, "setTimeout", (callback: () => unknown, delay?: number) => {
    const timer: RecordedTimer = { callback, delay, unrefs: 0, handle: {} };
    timer.handle = { unref() { timer.unrefs += 1; return this; }, ref() { return this; }, hasRef: () => timer.unrefs === 0 };
    scheduled.push(timer);
    return timer.handle;
  });
  t.mock.method(globalThis, "clearTimeout", (handle: unknown) => { cleared.push(handle); });
  return { scheduled, cleared };
}

const statuses = (runs: FakeRun[]) => Object.fromEntries(runs.map((run) => [run.documentId, run.status]));

test("register refuses to boot on a data classification ceiling outside the scale", async () => {
  await withQuietBoot(() => {
    const refused = fakeStrapi({ ai: { provider: "deterministic", dataClassificationCeiling: "Secret" } });
    assert.throws(
      () => lifecycle.register({ strapi: refused.strapi }),
      (error: unknown) => error instanceof CsrmAiConfigurationError && error.message.includes("CSRM_AI_DATA_CLASSIFICATION_CEILING"),
    );
    const allowed = fakeStrapi({ ai: { provider: "deterministic", dataClassificationCeiling: "Internal" } });
    assert.doesNotThrow(() => lifecycle.register({ strapi: allowed.strapi }));
  });
});

test("bootstrap closes only runs past the AI request bound and sweeps once more when the bound has passed, until destroy", async (t) => {
  const requestTimeoutMs = 30_000;
  // The request timeout plus the five-minute margin for the persistence transaction (WR-01).
  const bound = requestTimeoutMs + 300_000;
  const boot = Date.parse("2026-10-08T00:00:00.000Z");
  const at = (offset: number) => new Date(boot + offset).toISOString();
  t.mock.timers.enable({ apis: ["Date"], now: boot });
  const timers = recordTimers(t);
  const fake = fakeStrapi({ ai: { provider: "deterministic", requestTimeoutMs }, runs: [
    { documentId: "orphan-past-the-bound", status: "running", startedAt: at(-bound - 1), completedAt: null },
    { documentId: "orphan-of-a-quick-restart", status: "running", startedAt: at(-5_000), completedAt: null },
    { documentId: "completed-long-ago", status: "completed", startedAt: at(-10 * bound), completedAt: at(-10 * bound + 1_000) },
  ] });

  await withQuietBoot(() => lifecycle.bootstrap({ strapi: fake.strapi }));
  assert.deepEqual(statuses(fake.runs), {
    "orphan-past-the-bound": "interrupted",
    "orphan-of-a-quick-restart": "running",
    "completed-long-ago": "completed",
  }, "BOOT_PASS_CLOSED_THE_WRONG_RUNS");
  assert.equal(fake.runs[0].completedAt, at(0));
  assert.equal(timers.scheduled.length, 1, "BOOT_DID_NOT_SCHEDULE_ONE_DEFERRED_SWEEP");
  assert.equal(timers.scheduled[0].delay, bound, "DEFERRED_SWEEP_NOT_AT_THE_BOUND");
  assert.equal(timers.scheduled[0].unrefs, 1, "DEFERRED_SWEEP_KEEPS_THE_PROCESS_ALIVE");

  // When the bound has passed, a run this boot found running is an orphan; one started after boot may be live.
  fake.runs.push({ documentId: "started-after-boot", status: "running", startedAt: at(60_000), completedAt: null });
  t.mock.timers.setTime(boot + bound);
  await timers.scheduled[0].callback();
  assert.deepEqual(statuses(fake.runs), {
    "orphan-past-the-bound": "interrupted",
    "orphan-of-a-quick-restart": "interrupted",
    "completed-long-ago": "completed",
    "started-after-boot": "running",
  }, "DEFERRED_SWEEP_CLOSED_THE_WRONG_RUNS");
  assert.equal(fake.runs[1].completedAt, at(bound));
  assert.deepEqual(fake.logs.error, []);

  assert.ok(lifecycle.destroy, "NO_DESTROY_STOPS_THE_SWEEP");
  await lifecycle.destroy({ strapi: fake.strapi });
  assert.deepEqual(timers.cleared, [timers.scheduled[0].handle], "DESTROY_DID_NOT_CLEAR_THE_SWEEP");
  const reads = fake.runQueries.length;
  await timers.scheduled[0].callback();
  assert.equal(fake.runQueries.length, reads, "THE_SWEEP_RAN_AFTER_DESTROY");
});

test("a deferred sweep that cannot read the runs logs it and never rejects", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-08T00:00:00.000Z") });
  const timers = recordTimers(t);
  const fake = fakeStrapi({ ai: { provider: "deterministic" } });
  await withQuietBoot(() => lifecycle.bootstrap({ strapi: fake.strapi }));
  assert.equal(timers.scheduled.length, 1);
  // The default request timeout (60,000 ms) when CSRM_AI_REQUEST_TIMEOUT_MS is not set, plus the margin.
  assert.equal(timers.scheduled[0].delay, 360_000);
  fake.state.runReadsFail = true;
  await assert.doesNotReject(async () => { await timers.scheduled[0].callback(); });
  assert.deepEqual(fake.logs.error, ["CSRM could not mark interrupted AI runs; the next start will try again."]);
  await lifecycle.destroy?.({ strapi: fake.strapi });
});

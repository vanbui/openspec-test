import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import type { Core } from "@strapi/strapi";
import { createPasswordSetupDispatcher, startPasswordSetupDispatcher, stopPasswordSetupDispatcher,
  registerPasswordSetupAfterCommit } from "../src/iam/password-setup/dispatcher";
import { passwordSetupEvent, readPasswordSetupEligibility, resendPasswordSetupEmail, sendPasswordSetupEmail, type PasswordSetupTarget } from "../src/iam/password-setup/service";
import { KeycloakAdminClient } from "../src/keycloak/admin-client";
import { createPasswordSetupCliDependencies, parsePasswordSetupCliArgs, runPasswordSetupCli, type PasswordSetupCliDependencies } from "../src/iam/password-setup/resend-cli";

const target: PasswordSetupTarget = { userDocumentId: "a".repeat(24), sourceDocumentId: "b".repeat(24) };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("resend accepts only one local documentId and rejects invalid input before boot", async () => {
  assert.equal(parsePasswordSetupCliArgs([target.userDocumentId]), target.userDocumentId);
  assert.equal(parsePasswordSetupCliArgs(["--", target.userDocumentId]), target.userDocumentId);
  let boots = 0;
  const output: string[] = [];
  const dependencies: PasswordSetupCliDependencies = {
    configure: () => { boots++; },
    createBackend: async () => { throw new Error("must not boot"); },
    resend: async () => { throw new Error("must not send"); },
    output: line => { output.push(line); },
  };
  for (const args of [[], ["person@example.test"], ["subject/id"], ["--help"], ["A".repeat(24)],
    ["a".repeat(23)], [target.userDocumentId, "extra"], ["--", "--", target.userDocumentId]]) {
    assert.throws(() => parsePasswordSetupCliArgs(args));
    assert.equal(await runPasswordSetupCli(args, dependencies), 1);
  }
  assert.equal(boots, 0);
  assert.ok(output.every(line => line === "Password setup command failed (usage).\n"));
});

const resendEnvironment = { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://keycloak.test",
  KEYCLOAK_REALM: "test", KEYCLOAK_ADMIN_CLIENT_ID: "test", KEYCLOAK_ADMIN_CLIENT_SECRET: "private", KEYCLOAK_REQUEST_TIMEOUT_MS: "100" };

test("command attempts once per explicit invocation and closes after success or refusal", async () => {
  for (const accepted of [true, false]) {
    const calls: string[] = [];
    const output: string[] = [];
    const host = { load: async () => { calls.push("load"); }, destroy: async () => { calls.push("destroy"); } };
    const dependencies: PasswordSetupCliDependencies = {
      configure: () => { calls.push("configure"); }, createBackend: async () => { calls.push("create"); return host; },
      resend: async (backend, documentId) => {
        assert.equal(backend, host); assert.equal(documentId, target.userDocumentId); calls.push("send");
        return accepted ? { outcome: "sent", reason: "accepted" } : { outcome: "skipped", reason: "ineligible" };
      }, output: line => { output.push(line); },
    };
    for (let invocation = 0; invocation < 2; invocation++) {
      assert.equal(await runPasswordSetupCli([target.userDocumentId], dependencies), accepted ? 0 : 1);
    }
    assert.deepEqual(calls, Array(2).fill(["configure", "create", "load", "send", "destroy"]).flat());
    assert.deepEqual(output, Array(2).fill(accepted ? "Password setup command sent (accepted).\n" : "Password setup command skipped (ineligible).\n"));
  }
});

test("configuration, boot, attempt, output and cleanup failures publish only closed codes", async () => {
  for (const stage of ["configure", "create", "load", "send", "output", "destroy", "hang"] as const) {
    let cleanups = 0;
    const output: string[] = [];
    const failure = () => { throw new Error("private@example.test password=private https://reset.test/?token=private"); };
    const dependencies: PasswordSetupCliDependencies = {
      configure: stage === "configure" ? failure : () => undefined,
      createBackend: async () => {
        if (stage === "create") failure();
        return { load: async () => { if (stage === "load") failure(); }, destroy: async () => {
          cleanups++; if (stage === "destroy") failure();
          if (stage === "hang") await new Promise<void>(() => {});
        } };
      },
      resend: async () => { if (stage === "send") failure(); return { outcome: "sent", reason: "accepted" }; },
      output: line => { output.push(line); if (stage === "output") failure(); }, cleanupTimeoutMs: 5,
    };
    assert.equal(await runPasswordSetupCli([target.userDocumentId], dependencies), 1);
    assert.equal(cleanups, ["configure", "create"].includes(stage) ? 0 : 1);
    assert.doesNotMatch(output.join(""), /private|example\.test|reset\.test|password=|token=/);
  }
});

test("runtime compiles and loads once with administration boot active before compilation", async () => {
  const { isAdministrationBoot } = require("../src/bootstrap/boot-mode") as typeof import("../src/bootstrap/boot-mode");
  const calls: string[] = [];
  const host = { load: async () => { calls.push("load"); }, destroy: async () => { calls.push("destroy"); } };
  const runtime = {
    compileStrapi: async (options: unknown) => { assert.equal(isAdministrationBoot(), true); assert.deepEqual(options, { appDir: "/test-app" }); calls.push("compile"); return { distDir: "/test-dist" }; },
    createStrapi: (options: unknown) => { assert.deepEqual(options, { appDir: "/test-app", distDir: "/test-dist" }); calls.push("create"); return host; },
  } as unknown as Pick<typeof import("@strapi/strapi"), "compileStrapi" | "createStrapi">;
  const dependencies = createPasswordSetupCliDependencies(runtime, "/test-app", resendEnvironment);
  dependencies.resend = async () => ({ outcome: "sent", reason: "accepted" });
  dependencies.output = () => undefined;
  assert.equal(await runPasswordSetupCli([target.userDocumentId], dependencies), 0);
  assert.deepEqual(calls, ["compile", "create", "load", "destroy"]);
  for (const env of [{ IDAMBOX_KEYCLOAK_PROVISIONING: "false" }, { IDAMBOX_KEYCLOAK_PROVISIONING: "true" },
    { ...resendEnvironment, KEYCLOAK_BASE_URL: "http://private:secret@keycloak.test" }]) {
    const guarded = createPasswordSetupCliDependencies(runtime, "/test-app", env);
    const output: string[] = []; guarded.output = line => { output.push(line); };
    assert.equal(await runPasswordSetupCli([target.userDocumentId], guarded), 1);
    assert.deepEqual(output, ["Password setup command failed (configuration).\n"]);
  }
  assert.equal(calls.length, 4, "invalid configuration never compiles or loads");
});

test("main restores output streams after guarded configuration failure", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const { main } = require(${JSON.stringify(require.resolve("../src/iam/password-setup/resend-cli"))});
    const stdout = process.stdout.write, stderr = process.stderr.write;
    main([${JSON.stringify(target.userDocumentId)}]).then(() => {
      if (process.stdout.write !== stdout || process.stderr.write !== stderr) process.exitCode = 2;
    });
  `], { encoding: "utf8", timeout: 10000, env: { ...process.env, IDAMBOX_KEYCLOAK_PROVISIONING: "false" } });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "Password setup command failed (configuration).\n");
  assert.equal(result.stderr, "");
});

test("entrypoint restores streams and terminates after bounded cleanup with retained handles", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const { main } = require(${JSON.stringify(require.resolve("../src/iam/password-setup/resend-cli"))});
    const stdout = process.stdout.write, stderr = process.stderr.write;
    setInterval(() => undefined, 1000);
    main([${JSON.stringify(target.userDocumentId)}], () => ({
      configure() {},
      createBackend: async () => ({ load: async () => { process.stderr.write("private boot diagnostic"); },
        destroy: () => new Promise(() => {}) }),
      resend: async () => ({ outcome: "sent", reason: "accepted" }), output() {}, cleanupTimeoutMs: 5,
    }), status => {
      if (process.stdout.write !== stdout || process.stderr.write !== stderr) process.exit(2);
      process.exit(status);
    });
  `], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "Password setup command sent (accepted).\nPassword setup command failed (cleanup).\n");
  assert.equal(result.stderr, "");
});

test("resend fresh read guards every excluded target without user writes or remote mutation", async () => {
  const valid = { documentId: target.userDocumentId, accountStatus: "active", protected: false,
    identitySource: { documentId: target.sourceDocumentId }, sourceExternalId: "key", sourceIdentityKey: "hash", externalSubject: "exact stored subject" };
  for (const mode of ["missing", "manual", "protected", "service", "inactive", "tombstoned", "subjectless", "race", "eligible"] as const) {
    let reads = 0;
    const calls: unknown[] = [];
    const events: string[] = [];
    const row = mode === "missing" ? null : mode === "manual" ? { ...valid, identitySource: null }
      : mode === "protected" ? { ...valid, protected: true } : mode === "inactive" ? { ...valid, accountStatus: "inactive" }
      : mode === "tombstoned" ? { ...valid, sourceDeletedAt: "2026-10-17" } : mode === "subjectless" ? { ...valid, externalSubject: null } : valid;
    const backend = { documents: () => ({ findOne: async () => { reads++; return mode === "race" && reads > 1 ? { ...valid, accountStatus: "inactive" } : row; },
      findMany: async () => mode === "service" ? [{}] : [] }), log: { info: (event: string) => { events.push(event); } } } as unknown as Core.Strapi;
    const result = await resendPasswordSetupEmail(backend, target.userDocumentId, { env: resendEnvironment,
      createClient: () => ({ executeActionsEmail: async (subject, actions) => { calls.push([subject, actions]); } }) });
    assert.deepEqual(result, mode === "eligible" ? { outcome: "sent", reason: "accepted" } : { outcome: "skipped", reason: "ineligible" });
    assert.deepEqual(calls, mode === "eligible" ? [["exact stored subject", ["UPDATE_PASSWORD"]]] : []);
    assert.ok(events.every(event => JSON.parse(event).trigger === "operator"));
  }
});

test("disabled and invalid resend configuration creates no client or read", async () => {
  for (const enabled of [false, true]) {
    const result = await resendPasswordSetupEmail({} as Core.Strapi, target.userDocumentId, {
      env: { IDAMBOX_KEYCLOAK_PROVISIONING: String(enabled) }, createClient: () => { throw new Error("must not create"); },
    });
    assert.deepEqual(result, enabled ? { outcome: "failed", reason: "configuration" } : { outcome: "skipped", reason: "disabled" });
  }
});

test("operator attempt timeout covers source discovery, eligibility and transport without retries", async () => {
  for (const stage of ["discovery", "eligibility", "transport"] as const) {
    let reads = 0;
    let sends = 0;
    let reject!: (reason: Error) => void;
    const hang = () => new Promise<never>((_resolve, rejectPromise) => { reject = rejectPromise; });
    const row = { accountStatus: "active", protected: false, identitySource: { documentId: target.sourceDocumentId },
      sourceExternalId: "key", sourceIdentityKey: "hash", externalSubject: "private-subject" };
    const events: string[] = [];
    const backend = { documents: () => ({ findOne: async () => { reads++; return stage === "discovery" || (stage === "eligibility" && reads === 2) ? hang() : row; },
      findMany: async () => [] }), log: { info: (event: string) => { events.push(event); } } } as unknown as Core.Strapi;
    assert.deepEqual(await resendPasswordSetupEmail(backend, target.userDocumentId, {
      env: { ...resendEnvironment, KEYCLOAK_REQUEST_TIMEOUT_MS: "5" }, createClient: () => ({ executeActionsEmail: async () => { sends++; return hang(); } }),
    }), { outcome: "failed", reason: "timeout" });
    reject(new Error("private@example.test https://reset.test/?token=private"));
    await tick();
    assert.equal(sends, stage === "transport" ? 1 : 0);
    assert.doesNotMatch(events.join(""), /private|example\.test|reset\.test/);
  }
});

test("dispatcher detaches request context and attempts once", async () => {
  const authority = new AsyncLocalStorage<string>();
  let calls = 0;
  const dispatcher = createPasswordSetupDispatcher(async (_target, signal) => {
    assert.equal(authority.getStore(), undefined);
    assert.equal(signal.aborted, false);
    calls++;
  });
  authority.run("source-authority", () => dispatcher.enqueue(target));
  await tick();
  assert.equal(calls, 1);
  await dispatcher.stop();
});

test("shutdown cancels queued work and bounds an unresolved attempt", async () => {
  let calls = 0;
  const queued = createPasswordSetupDispatcher(async () => { calls++; });
  queued.enqueue(target);
  await queued.stop();
  await tick();
  assert.equal(calls, 0);
  const active = createPasswordSetupDispatcher(async (_target, signal) => {
    calls++;
    await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  });
  active.enqueue(target);
  await tick();
  await active.stop();
  assert.equal(calls, 1);
});

test("fresh eligibility sends only UPDATE_PASSWORD and logs endpoint acceptance", async () => {
  const events: string[] = [];
  const calls: unknown[] = [];
  await sendPasswordSetupEmail(target, new AbortController().signal, {
    read: async () => ({ externalSubject: "stored-subject" }),
    client: { executeActionsEmail: async (...args) => { calls.push(args.slice(0, 2)); } },
    log: event => { events.push(event); },
  });
  assert.deepEqual(calls, [["stored-subject", ["UPDATE_PASSWORD"]]]);
  assert.deepEqual(JSON.parse(events[0]), { event: "iam.password_setup_email", ...target,
    trigger: "create", outcome: "sent", reason: "accepted" });
});

test("ineligible, rejected, timed-out and throwing logger paths remain closed", async () => {
  for (const mode of ["skip", "failure", "timeout", "logger"] as const) {
    const events: string[] = [];
    const controller = new AbortController();
    const pending = sendPasswordSetupEmail(target, controller.signal, {
      read: async () => mode === "skip" ? null : mode === "timeout" ? new Promise<never>(() => {}) : { externalSubject: "secret-subject" },
      client: { executeActionsEmail: async () => { throw new Error("secret@example.test Bearer password https://reset.test/?token=secret"); } },
      log: event => { events.push(event); if (mode === "logger") throw new Error("secret"); },
    });
    if (mode === "timeout") controller.abort();
    await pending;
    assert.equal(events.length, 1);
    assert.doesNotMatch(events[0], /secret|Bearer|password https|reset\.test/);
    assert.equal(JSON.parse(events[0]).outcome, mode === "skip" ? "skipped" : "failed");
  }
});

test("disabled boot creates no client or scheduler and never reads configuration", async () => {
  const backend = {} as Core.Strapi;
  let calls = 0;
  assert.equal(startPasswordSetupDispatcher(backend, { IDAMBOX_KEYCLOAK_PROVISIONING: "false", KEYCLOAK_BASE_URL: "invalid" },
    () => { calls++; throw new Error("unexpected client"); }), false);
  await registerPasswordSetupAfterCommit(backend, target);
  await stopPasswordSetupDispatcher(backend);
  assert.equal(calls, 0);
});

test("scheduling, registration and logger failures are contained", async () => {
  const dispatcher = createPasswordSetupDispatcher(async () => { throw new Error("must not run"); }, {
    schedule: () => { throw new Error("schedule secret"); },
    log: () => { throw new Error("log secret"); },
  });
  dispatcher.enqueue(target);
  await dispatcher.stop();
  const backend = { db: { transaction: async () => { throw new Error("registration secret"); } },
    log: { info: () => { throw new Error("log secret"); } } } as unknown as Core.Strapi;
  startPasswordSetupDispatcher(backend, { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://keycloak.test",
    KEYCLOAK_REALM: "test", KEYCLOAK_ADMIN_CLIENT_ID: "test", KEYCLOAK_ADMIN_CLIENT_SECRET: "secret" },
    () => ({ executeActionsEmail: async () => { throw new Error("must not run"); } }));
  await registerPasswordSetupAfterCommit(backend, target);
  await stopPasswordSetupDispatcher(backend);
});

test("deadline contains late read rejection and never starts remote work", async () => {
  let rejectRead!: (error: Error) => void;
  let calls = 0;
  const events: string[] = [];
  const dispatcher = createPasswordSetupDispatcher((target, signal) => sendPasswordSetupEmail(target, signal, {
    read: () => new Promise((_resolve, reject) => { rejectRead = reject; }),
    client: { executeActionsEmail: async () => { calls++; } }, log: event => { events.push(event); },
  }), { timeoutMs: 10 });
  dispatcher.enqueue(target);
  await new Promise(resolve => setTimeout(resolve, 30));
  rejectRead(new Error("late secret"));
  await tick();
  await dispatcher.stop();
  assert.equal(calls, 0);
  assert.equal(JSON.parse(events[0]).reason, "timeout");
});

test("eligibility refuses missing, manual, protected, service, inactive, tombstoned and subjectless targets", async () => {
  const valid = { documentId: target.userDocumentId, accountStatus: "active", protected: false,
    identitySource: { documentId: target.sourceDocumentId }, sourceExternalId: "key", sourceIdentityKey: "hash", externalSubject: "subject" };
  for (const row of [null, { ...valid, identitySource: null }, { ...valid, protected: true },
    { ...valid, accountStatus: "inactive" }, { ...valid, sourceDeletedAt: "2026-10-17" },
    { ...valid, externalSubject: null }, { ...valid, sourceExternalId: null }, { ...valid, sourceIdentityKey: null },
    { ...valid, identitySource: { documentId: "other" } }, valid]) {
    const backend = { documents: () => ({ findOne: async () => row, findMany: async () => row === valid ? [{}] : [] }) } as unknown as Core.Strapi;
    assert.equal(await readPasswordSetupEligibility(backend, target), null);
  }
  const backend = { documents: () => ({ findOne: async () => valid, findMany: async () => [] }) } as unknown as Core.Strapi;
  assert.deepEqual(await readPasswordSetupEligibility(backend, target), { externalSubject: "subject" });
});

test("diagnostics discard extra properties and adversarial identifiers", () => {
  const events: string[] = [];
  const log = (event: string) => { events.push(event); };
  const extra = { ...target, secret: "secret@example.test" };
  passwordSetupEvent(log, extra, "sent", "accepted");
  passwordSetupEvent(log, { ...target, userDocumentId: "https://reset.test?token=secret" }, "failed", "unavailable");
  assert.equal(events.length, 1);
  assert.doesNotMatch(events[0], /secret/);
});

test("admin transport sends one exact action-email PUT without optional parameters or retries", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const config = { baseUrl: "http://keycloak.test", realm: "a realm", adminClientId: "test", adminClientSecret: "secret", requestTimeoutMs: 100 };
  let status = 204;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/token")) return Response.json({ access_token: "private-token", expires_in: 300 });
    return new Response(status === 204 ? null : "private error body", { status });
  };
  try {
    const client = new KeycloakAdminClient(config);
    await client.executeActionsEmail("subject/id", ["UPDATE_PASSWORD"], new AbortController().signal);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, "http://keycloak.test/admin/realms/a%20realm/users/subject%2Fid/execute-actions-email");
    assert.equal(calls[1].init?.method, "PUT");
    assert.equal(calls[1].init?.body, '["UPDATE_PASSWORD"]');
    status = 401;
    await assert.rejects(client.executeActionsEmail("subject/id", ["UPDATE_PASSWORD"], new AbortController().signal), /KEYCLOAK_AUTH/);
    assert.equal(calls.length, 3, "email is never retried");
    const controller = new AbortController(); controller.abort();
    await assert.rejects(client.executeActionsEmail("subject/id", ["UPDATE_PASSWORD"], controller.signal), /KEYCLOAK_TIMEOUT/);
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = original; }
});

test("admin deadline covers unresolved token body, response body and ignored fetch abort", async () => {
  const original = globalThis.fetch;
  const config = { baseUrl: "http://keycloak.test", realm: "test", adminClientId: "test", adminClientSecret: "secret", requestTimeoutMs: 10 };
  try {
    for (const mode of ["token-body", "email-body", "fetch"] as const) {
      let calls = 0;
      globalThis.fetch = async (url) => {
        calls++;
        if (mode === "fetch") return new Promise<Response>(() => {});
        if (String(url).endsWith("/token")) {
          return mode === "token-body" ? new Response(new ReadableStream({ start() {} }))
            : Response.json({ access_token: "private-token", expires_in: 300 });
        }
        return new Response(new ReadableStream({ cancel: () => new Promise<void>(() => {}) }));
      };
      // Keep the event loop alive while AbortSignal.timeout's unref'ed timer fires.
      const keepAlive = setTimeout(() => undefined, 1000);
      try {
        await assert.rejects(new KeycloakAdminClient(config).executeActionsEmail("stored-subject", ["UPDATE_PASSWORD"], new AbortController().signal), /KEYCLOAK_TIMEOUT/);
        assert.equal(calls, mode === "email-body" ? 2 : 1);
      } finally { clearTimeout(keepAlive); }
    }
  } finally { globalThis.fetch = original; }
});

test("asynchronous diagnostic rejection is observed", async () => {
  passwordSetupEvent(async () => { throw new Error("private failure"); }, target, "failed", "unavailable");
  await tick();
});

test("a fresh read after scheduling refuses late deactivation", async () => {
  let active = true;
  let calls = 0;
  const events: string[] = [];
  const dispatcher = createPasswordSetupDispatcher((target, signal) => sendPasswordSetupEmail(target, signal, {
    read: async () => active ? { externalSubject: "stored-subject" } : null,
    client: { executeActionsEmail: async () => { calls++; } }, log: event => { events.push(event); },
  }));
  dispatcher.enqueue(target);
  active = false;
  await tick();
  await dispatcher.stop();
  assert.equal(calls, 0);
  assert.deepEqual(JSON.parse(events[0]), { event: "iam.password_setup_email", ...target,
    trigger: "create", outcome: "skipped", reason: "ineligible" });
});

test("two backend instances cannot share dispatcher registration or shutdown", async () => {
  const hooks: Array<Array<() => void>> = [[], []];
  const calls = [0, 0];
  const env = { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://keycloak.test",
    KEYCLOAK_REALM: "test", KEYCLOAK_ADMIN_CLIENT_ID: "test", KEYCLOAK_ADMIN_CLIENT_SECRET: "secret" };
  const instances = hooks.map((callbacks, index) => ({
    db: { transaction: async (work: (context: { onCommit(callback: () => void): void }) => Promise<void>) =>
      work({ onCommit: callback => { callbacks.push(callback); } }) },
    documents: () => ({ findOne: async () => ({ accountStatus: "active", protected: false,
      identitySource: { documentId: target.sourceDocumentId }, sourceExternalId: "key", sourceIdentityKey: "key", externalSubject: "subject" }),
      findMany: async () => [] }),
    log: { info: () => undefined }, index,
  }) as unknown as Core.Strapi);
  for (let index = 0; index < instances.length; index++) {
    startPasswordSetupDispatcher(instances[index], env, () => ({ executeActionsEmail: async () => { calls[index]++; } }));
    await registerPasswordSetupAfterCommit(instances[index], target);
  }
  assert.deepEqual(calls, [0, 0]);
  hooks[0][0]();
  await tick();
  assert.deepEqual(calls, [1, 0]);
  await stopPasswordSetupDispatcher(instances[0]);
  hooks[1][0]();
  await tick();
  assert.deepEqual(calls, [1, 1]);
  await registerPasswordSetupAfterCommit(instances[0], target);
  assert.equal(hooks[0].length, 1);
  await stopPasswordSetupDispatcher(instances[1]);
});

test("bounded client timeout and cancellation observe late rejections without secret diagnostics", async () => {
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => { unhandled.push(reason); };
  process.on("unhandledRejection", listener);
  try {
    for (const cancel of [false, true]) {
      const events: string[] = [];
      let rejectClient!: (reason: Error) => void;
      let calls = 0;
      const dispatcher = createPasswordSetupDispatcher((target, signal) => sendPasswordSetupEmail(target, signal, {
        read: async () => ({ externalSubject: "private-subject" }),
        client: { executeActionsEmail: () => { calls++; return new Promise((_resolve, reject) => { rejectClient = reject; }); } },
        log: event => { events.push(event); },
      }), { timeoutMs: 10 });
      dispatcher.enqueue(target);
      await tick();
      if (cancel) await dispatcher.stop();
      else await new Promise(resolve => setTimeout(resolve, 30));
      rejectClient(Object.assign(new Error("address@example.test password=private token=private https://remote.test/action?code=private"),
        { cause: new Error("private raw cause") }));
      await tick();
      await dispatcher.stop();
      assert.equal(calls, 1, "uncertain attempts have no automatic retry");
      assert.equal(events.length, 1);
      assert.equal(JSON.parse(events[0]).reason, "timeout");
      assert.doesNotMatch(events[0], /private|example\.test|remote\.test|password=|token=|cause/);
    }
    assert.deepEqual(unhandled, []);
  } finally { process.off("unhandledRejection", listener); }
});

test("a rejected deferred attempt is observed once with a closed scheduling outcome", async () => {
  const events: string[] = [];
  let calls = 0;
  const dispatcher = createPasswordSetupDispatcher(async () => {
    calls++;
    throw new Error("private remote scheduler failure");
  }, { log: event => { events.push(event); } });
  dispatcher.enqueue(target);
  await tick();
  await dispatcher.stop();
  assert.equal(calls, 1);
  assert.deepEqual(events.map(event => JSON.parse(event)), [{ event: "iam.password_setup_email", ...target,
    trigger: "create", outcome: "failed", reason: "unavailable" }]);
});

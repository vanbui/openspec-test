import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";

import { CORE_USER_URN } from "../src/iam/scim/wire";

const USER = "api::idambox-user.idambox-user";
let backend: Core.Strapi;
let compiledDir: string;
function backendModule<T>(relativePath: string): T {
  return require(path.join(compiledDir, "src", relativePath)) as T;
}
let sourceDocumentId: string;
let sourceToken: string;
const accounts = new Map<string, { id: string; email: string; password?: string; requiredActions?: string[] }>();
const remote = { users: accounts };
const originalFetch = globalThis.fetch;
const savedEnvironment = { ...process.env };
const appDir = path.resolve(__dirname, "../../..");
const databaseFilename = path.join(appDir, ".tmp", `password-setup-${process.pid}.sqlite`);
const harness = {
  get primary() { return { documentId: sourceDocumentId }; },
  backend: async <T>(work: (backend: Core.Strapi) => Promise<T>) => work(backend),
  request: async (url: string, method: string, body: unknown): Promise<Response> => {
    const bytes = Buffer.from(JSON.stringify(body));
    const socket = new Socket();
    Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
    const request = new IncomingMessage(socket);
    request.url = url; request.method = method;
    request.headers = { host: "localhost", authorization: `Bearer ${sourceToken}`, accept: "application/scim+json",
      "content-type": "application/scim+json", "content-length": String(bytes.length) };
    const response = new ServerResponse(request);
    return new Promise<Response>((resolve, reject) => {
      response.end = ((data?: string | Buffer) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.getHeaders())) if (value !== undefined) headers.set(key, String(value));
        resolve(new Response(data ? Buffer.from(data) : null, { status: response.statusCode, headers }));
        socket.destroy();
        return response;
      }) as typeof response.end;
      response.on("error", reject);
      backend.server.app.callback()(request, response);
      request.push(bytes); request.push(null);
    });
  },
};
const attempts: string[] = [];
const events: string[] = [];
const requestContext = new AsyncLocalStorage<string>();
let failEmail = false;
let failLinkage = false;
let failScheduling = false;
let delayEmail = false;
let rejectDelayedEmail: ((reason: Error) => void) | undefined;
let sequence = 0;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function settle() { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 5)); }
function input() {
  const key = `password-setup-${++sequence}`;
  return { username: key, email: `${key}@example.test`, displayName: key,
    accountStatus: "active" as const, sourceExternalId: key };
}
function modules() {
  return {
    dispatcher: backendModule<typeof import("../src/iam/password-setup/dispatcher")>("iam/password-setup/dispatcher"),
    identity: backendModule<typeof import("../src/iam/identity/identity-service")>("iam/identity/identity-service"),
    source: backendModule<typeof import("../src/iam/identity/source-principal")>("iam/identity/source-principal"),
  };
}
before(async () => {
  process.on("unhandledRejection", onUnhandled);
  await mkdir(path.dirname(databaseFilename), { recursive: true });
  Object.assign(process.env, { APP_KEYS: "password-setup-test-1,password-setup-test-2", ADMIN_JWT_SECRET: "test-admin",
    API_TOKEN_SALT: "test-api", TRANSFER_TOKEN_SALT: "test-transfer", ENCRYPTION_KEY: "test-encryption", JWT_SECRET: "test-jwt",
    DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, databaseFilename), IDAMBOX_SEED_CORE: "false",
    IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_IAM: "false", IDAMBOX_KEYCLOAK_PROVISIONING: "false",
    IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false", CSRM_AUTH_OIDC_ENABLED: "false", CSRM_AI_PROVIDER: "deterministic",
    STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", STRAPI_TELEMETRY_DISABLED: "true" });
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "http://keycloak.test", "no network transport is used");
    if (parsed.pathname.endsWith("/token")) return Response.json({ access_token: "private-test-token", expires_in: 300 });
    if (init?.method === "POST") {
      const data = JSON.parse(String(init.body));
      assert.equal(data.credentials, undefined, "sourced remote creation has no credential");
      const id = `subject-${accounts.size + 1}`;
      accounts.set(id, { ...data, id });
      return new Response(null, { status: 201, headers: { location: `http://keycloak.test/users/${id}` } });
    }
    if (init?.method === "PUT") return new Response(null, { status: 204 });
    const email = parsed.searchParams.get("email");
    if (email) return Response.json([...accounts.values()].filter(user => user.email === email));
    const account = accounts.get(parsed.pathname.split("/").pop()!);
    return account ? Response.json(account) : new Response(null, { status: 404 });
  };
  const { compileStrapi, createStrapi } = require("@strapi/strapi");
  const compiled = await compileStrapi({ appDir });
  compiledDir = compiled.distDir;
  backend = await createStrapi(compiled).load();
  backend.cron.destroy();
  await backend.documents("api::application.application").create({ data: { name: "IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const app = await backend.documents("api::application.application").findFirst({ filters: { slug: "idambox-iam" } }); assert.ok(app);
  const api = await backend.documents("api::function-api.function-api").create({ data: { name: "Create sourced user", url: "POST:/scim/v2/Users" } });
  const fn = await backend.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: app.documentId, functionApis: [api.documentId] } });
  await backend.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  const registration = backendModule<typeof import("../src/iam/identity/source-registration")>("iam/identity/source-registration");
  const source = await registration.registerIdentitySource(backend, { name: "HR", username: "hr-service", email: "hr@example.test", displayName: "HR" });
  sourceDocumentId = source.documentId;
  const credential = await backendModule<typeof import("../src/iam/scim/token-service")>("iam/scim/token-service").administerSourceToken(backend, sourceDocumentId);
  assert.ok("token" in credential); sourceToken = credential.token;
  backend.server.mount();
  await harness.backend(async backend => {
    const { registerIdamboxUserProvisioning } = backendModule<typeof import("../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
    const env = { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://keycloak.test",
      KEYCLOAK_REALM: "test", KEYCLOAK_ADMIN_CLIENT_ID: "test",
      KEYCLOAK_ADMIN_CLIENT_SECRET: "test-secret", KEYCLOAK_REQUEST_TIMEOUT_MS: "1000" };
    registerIdamboxUserProvisioning(backend, env);
    backend.documents.use(async (context, next) => {
      if (failLinkage && context.uid === USER && context.action === "update"
        && typeof (context.params as { data?: { externalSubject?: unknown } }).data?.externalSubject === "string") throw new Error("LINKAGE_TEST_FAILURE");
      return next();
    });
    const original = backend.log.info.bind(backend.log);
    backend.log.info = ((message: unknown) => {
      if (typeof message === "string" && message.includes('"event":"iam.password_setup_email"')) events.push(message);
      else original(message);
    }) as typeof backend.log.info;
    modules().dispatcher.startPasswordSetupDispatcher(backend, env, () => ({
      async executeActionsEmail(subject, actions, signal) {
        assert.deepEqual(actions, ["UPDATE_PASSWORD"]);
        assert.equal(signal.aborted, false);
        assert.equal(backend.db.inTransaction(), false, "detached dispatch has no inherited transaction");
        assert.equal(requestContext.getStore(), undefined, "dispatch has no live request context");
        const { identityWriteAuthority } = backendModule<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context");
        assert.equal(identityWriteAuthority(backend, "create", undefined, { username: "forged" }), null);
        const user = await backend.documents(USER).findFirst({ filters: { externalSubject: subject }, populate: { identitySource: true } });
        assert.ok(user?.identitySource, "committed source and subject are visible through Document Service");
        attempts.push(user.documentId);
        if (failEmail) throw new Error("secret@example.test token=secret");
        if (delayEmail) await new Promise<void>((_resolve, reject) => { rejectDelayedEmail = reject; });
      },
    }), { schedule: callback => {
      if (failScheduling) throw new Error("PRIVATE_SCHEDULER");
      return setImmediate(callback);
    } });
  });
});
after(async () => {
  try { if (backend) await backend.destroy(); }
  finally {
    process.off("unhandledRejection", onUnhandled);
    assert.deepEqual(unhandled, [], "optional work observes every rejected promise");
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
    Object.assign(process.env, savedEnvironment);
    await rm(databaseFilename, { force: true });
  }
});

test("mounted SCIM 201 commits passwordless linkage and dispatches exactly once", async () => {
  const data = input();
  const before = attempts.length;
  const response = await harness.request("/scim/v2/Users", "POST", {
    schemas: [CORE_USER_URN], userName: data.username, externalId: data.sourceExternalId,
    displayName: data.displayName, active: true, emails: [{ value: data.email, primary: true }],
  });
  assert.equal(response.status, 201);
  const body = await response.json() as { id: string };
  await settle();
  assert.deepEqual(attempts.slice(before), [body.id]);
  const account = [...remote.users.values()].find(user => user.email === data.email);
  assert.ok(account);
  assert.equal(account.password, undefined);
  assert.deepEqual(account.requiredActions, ["UPDATE_PASSWORD"]);
  await harness.backend(async backend => {
    const row = await backend.documents(USER).findOne({ documentId: body.id });
    assert.equal(row?.externalSubject, account.id);
    assert.equal(row.password, null);
  });
});

test("nested source create waits for the real outer commit and rollback never sends", async () => {
  await harness.backend(async backend => {
    const { identity, source } = modules();
    const principal = await source.resolveSourcePrincipal(backend, harness.primary.documentId); assert.ok(principal);
    const before = attempts.length;
    let id = "";
    await requestContext.run("live-source-request", () => backend.db.transaction(async () => {
      const result = await identity.createIdentityService(backend).createFromSource(principal, input()); assert.ok(result.ok);
      id = result.value.documentId;
      await tick();
      assert.equal(attempts.length, before);
    }));
    await settle();
    assert.deepEqual(attempts.slice(before), [id]);
    const rollback = input();
    await assert.rejects(backend.db.transaction(async () => {
      assert.ok((await identity.createIdentityService(backend).createFromSource(principal, rollback)).ok);
      throw new Error("ROLLBACK_TEST");
    }), /ROLLBACK_TEST/);
    await settle();
    assert.equal(attempts.length, before + 1);
    assert.equal(await backend.documents(USER).findFirst({ filters: { username: rollback.username } }), null);
  });
});

test("email rejection preserves SCIM 201 and durable user without leaking raw failures", async () => {
  const data = input();
  failEmail = true;
  try {
    const response = await harness.request("/scim/v2/Users", "POST", { schemas: [CORE_USER_URN], userName: data.username,
      externalId: data.sourceExternalId, emails: [{ value: data.email, primary: true }] });
    assert.equal(response.status, 201);
    const body = await response.json() as { id: string };
    await settle();
    assert.ok(attempts.includes(body.id));
    await harness.backend(async backend => { assert.ok(await backend.documents(USER).findOne({ documentId: body.id })); });
    const event = events.map(event => JSON.parse(event)).find(event => event.userDocumentId === body.id);
    assert.equal(event.outcome, "failed");
    assert.equal(event.reason, "unavailable");
    assert.doesNotMatch(JSON.stringify(event), /secret|example\.test/);
  } finally { failEmail = false; }
});

test("failed linkage, duplicate, manual create, claim, updates and reactivation never auto-send", async () => {
  await harness.backend(async backend => {
    const { identity, source } = modules();
    const service = identity.createIdentityService(backend);
    const principal = await source.resolveSourcePrincipal(backend, harness.primary.documentId); assert.ok(principal);
    const before = attempts.length;
    failLinkage = true;
    const failed = input();
    try { await assert.rejects(service.createFromSource(principal, failed), /LINKAGE_TEST_FAILURE/); }
    finally { failLinkage = false; }
    assert.equal(await backend.documents(USER).findFirst({ filters: { username: failed.username } }), null);
    const data = input();
    const { sourceExternalId: _externalId, ...manualData } = data;
    const manual = await backend.documents(USER).create({ data: { ...manualData, protected: false, roles: [] } });
    assert.ok((await service.replaceFromSource(principal, manual.documentId, data)).ok);
    assert.ok((await service.patchFromSource(principal, manual.documentId, { department: "new" })).ok);
    assert.ok((await service.patchFromSource(principal, manual.documentId, { accountStatus: "inactive" })).ok);
    assert.ok((await service.patchFromSource(principal, manual.documentId, { accountStatus: "active" })).ok);
    assert.equal((await service.createFromSource(principal, data)).ok, false);
    await settle();
    assert.equal(attempts.length, before);
  });
});

test("fresh post-commit eligibility skips a newly inactive or deleted user", async () => {
  await harness.backend(async backend => {
    const { identity, source } = modules();
    const service = identity.createIdentityService(backend);
    const principal = await source.resolveSourcePrincipal(backend, harness.primary.documentId); assert.ok(principal);
    const before = attempts.length;
    for (const deleted of [false, true]) {
      await backend.db.transaction(async () => {
        const created = await service.createFromSource(principal, input()); assert.ok(created.ok);
        const changed = deleted ? await service.deactivateFromSource(principal, created.value.documentId, true)
          : await service.patchFromSource(principal, created.value.documentId, { accountStatus: "inactive" });
        assert.ok(changed.ok);
      });
    }
    await settle();
    assert.equal(attempts.length, before);
    assert.ok(events.filter(event => JSON.parse(event).outcome === "skipped").length >= 2);
  });
});

test("throwing identity and invitation diagnostics cannot change a successful sourced create", async () => {
  await harness.backend(async backend => {
    const { identity, source } = modules();
    const principal = await source.resolveSourcePrincipal(backend, harness.primary.documentId); assert.ok(principal);
    const original = backend.log.info;
    backend.log.info = ((message: unknown) => {
      if (typeof message === "string" && (message.startsWith("IAM identity ") || message.includes('"event":"iam.password_setup_email"'))) {
        throw new Error("LOGGER_TEST_FAILURE");
      }
      original(message);
    }) as typeof backend.log.info;
    try {
      const data = input();
      const response = await harness.request("/scim/v2/Users", "POST", { schemas: [CORE_USER_URN], userName: data.username,
        externalId: data.sourceExternalId, emails: [{ value: data.email, primary: true }] });
      assert.equal(response.status, 201);
      const result = await response.json() as { id: string };
      await settle();
      assert.ok(attempts.includes(result.id));
      assert.ok((await backend.documents(USER).findOne({ documentId: result.id }))?.externalSubject);
    } finally { backend.log.info = original; }
  });
});

test("SCIM 201 and linkage survive a bounded client timeout and its late rejection", async () => {
  const data = input();
  delayEmail = true;
  try {
    const response = await harness.request("/scim/v2/Users", "POST", { schemas: [CORE_USER_URN], userName: data.username,
      externalId: data.sourceExternalId, emails: [{ value: data.email, primary: true }] });
    assert.equal(response.status, 201);
    const result = await response.json() as { id: string };
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.ok(rejectDelayedEmail);
    rejectDelayedEmail(Object.assign(new Error("private@example.test password=private token=private https://remote.test/action?code=private"),
      { cause: new Error("private cause") }));
    await settle();
    assert.equal(attempts.filter(id => id === result.id).length, 1);
    const row = await backend.documents(USER).findOne({ documentId: result.id, populate: { identitySource: true } });
    assert.equal(row?.identitySource?.documentId, sourceDocumentId);
    assert.ok(row?.externalSubject);
    const outcomes = events.map(event => JSON.parse(event)).filter(event => event.userDocumentId === result.id);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].reason, "timeout");
    assert.doesNotMatch(JSON.stringify(outcomes), /private|example\.test|remote\.test|password=|token=|cause/);
  } finally { delayEmail = false; rejectDelayedEmail = undefined; }
});

test("a rejected actual outer commit rolls back Document Service linkage and never dispatches", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const data = input();
  const count = attempts.length;
  const eventCount = events.length;
  await assert.rejects(backend.db.transaction(async ({ trx }) => {
    const created = await identity.createIdentityService(backend).createFromSource(principal, data);
    assert.ok(created.ok);
    const stored = await backend.documents(USER).findOne({ documentId: created.value.documentId });
    assert.ok(stored?.externalSubject, "real nested Document Service linkage exists before outer commit");
    await tick();
    assert.equal(attempts.length, count);
    // Reject the real Knex transaction operation, retaining its real rollback for cleanup.
    trx.commit = async () => { throw new Error("ACTUAL_COMMIT_REJECTED"); };
  }), /ACTUAL_COMMIT_REJECTED/);
  await settle();
  assert.equal(attempts.length, count);
  assert.equal(events.length, eventCount, "transaction errors are not reported as email errors");
  assert.equal(await backend.documents(USER).findFirst({ filters: { username: data.username } }), null);
  assert.equal(backend.db.inTransaction(), false);
});

test("dispatch detaches even while the originating request and source authority remain alive", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const { runSourceMutation, identityWriteAuthority } = backendModule<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context");
  await requestContext.run("still-live-request", () => runSourceMutation(backend, principal, "create", undefined, async () => {
    assert.ok(identityWriteAuthority(backend, "create", undefined, { username: "forged" }));
    const created = await identity.createIdentityService(backend).createFromSource(principal, input()); assert.ok(created.ok);
    await settle();
    assert.ok(attempts.includes(created.value.documentId));
    assert.equal(requestContext.getStore(), "still-live-request");
    assert.ok(identityWriteAuthority(backend, "create", undefined, { username: "forged" }), "source authority remains active in the caller");
  }));
});

test("invalid input, future-start inactive people and replay cause no additional invitations", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const service = identity.createIdentityService(backend);
  const count = attempts.length;
  const invalid = input();
  const rejected = await service.createFromSource(principal, { ...invalid, email: "invalid" });
  assert.deepEqual(rejected, { ok: false, code: "invalidInput" });
  assert.equal(await backend.documents(USER).findFirst({ filters: { username: invalid.username } }), null);
  // Future-start people use the existing inactive accountStatus contract.
  const future = await service.createFromSource(principal, { ...input(), accountStatus: "inactive" }); assert.ok(future.ok);
  await settle();
  assert.equal(attempts.length, count);
  const data = input();
  const created = await service.createFromSource(principal, data); assert.ok(created.ok);
  await settle();
  assert.equal(attempts.length, count + 1);
  assert.deepEqual(await service.createFromSource(principal, data), { ok: false, code: "uniqueness" });
  assert.ok((await service.replaceFromSource(principal, created.value.documentId, data)).ok, "reconciliation uses the existing replace path");
  await settle();
  assert.equal(attempts.length, count + 1);
});

test("SCIM 201 survives synchronous scheduling and commit-hook registration failures", async () => {
  for (const mode of ["scheduling", "registration"] as const) {
    const originalTransaction = backend.db.transaction;
    const dispatcherModule = modules().dispatcher;
    const originalRegistration = dispatcherModule.registerPasswordSetupAfterCommit;
    const count = attempts.length;
    const data = input();
    try {
      if (mode === "scheduling") failScheduling = true;
      else dispatcherModule.registerPasswordSetupAfterCommit = async (strapi, target) => {
        strapi.db.transaction = (async (callback?: Parameters<typeof originalTransaction>[0]) => {
          assert.ok(callback);
          return originalTransaction.call(strapi.db, context => callback({ ...context,
            onCommit: () => { throw new Error("PRIVATE_REGISTRATION"); },
          }));
        }) as typeof originalTransaction;
        try { await originalRegistration(strapi, target); }
        finally { strapi.db.transaction = originalTransaction; }
      };
      const response = await harness.request("/scim/v2/Users", "POST", { schemas: [CORE_USER_URN], userName: data.username,
        externalId: data.sourceExternalId, emails: [{ value: data.email, primary: true }] });
      assert.equal(response.status, 201);
      const body = await response.json() as { id: string };
      const stored = await backend.documents(USER).findOne({ documentId: body.id, populate: { identitySource: true } });
      assert.equal(stored?.identitySource?.documentId, sourceDocumentId);
      assert.ok(stored?.externalSubject);
      const event = events.map(event => JSON.parse(event)).find(event => event.userDocumentId === body.id);
      assert.equal(event.reason, mode);
    } finally {
      failScheduling = false;
      dispatcherModule.registerPasswordSetupAfterCommit = originalRegistration;
      backend.db.transaction = originalTransaction;
    }
    await settle();
    assert.equal(attempts.length, count);
  }
});

const operatorEnvironment = { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://keycloak.test",
  KEYCLOAK_REALM: "test", KEYCLOAK_ADMIN_CLIENT_ID: "test", KEYCLOAK_ADMIN_CLIENT_SECRET: "test-secret", KEYCLOAK_REQUEST_TIMEOUT_MS: "100" };

test("explicit operator recovery reads the committed stored subject twice without any user or remote mutation", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const data = input();
  const created = await identity.createIdentityService(backend).createFromSource(principal, data); assert.ok(created.ok);
  await settle();
  const documentId = created.value.documentId;
  const before = await backend.documents(USER).findOne({ documentId, populate: { identitySource: true, roles: true } }); assert.ok(before?.externalSubject);
  const { resendPasswordSetupEmail } = backendModule<typeof import("../src/iam/password-setup/service")>("iam/password-setup/service");
  const calls: unknown[] = [];
  const output: string[] = [];
  let checking = true;
  const fetch = globalThis.fetch;
  backend.documents.use(async (context, next) => {
    if (checking && context.uid === USER) assert.ok(["findOne", "findMany", "findFirst", "count"].includes(context.action), "operator must not mutate a user");
    return next();
  });
  globalThis.fetch = async () => { throw new Error("operator must not create, adopt, update or reset a remote user"); };
  try {
    for (let invocation = 0; invocation < 2; invocation++) {
      assert.deepEqual(await resendPasswordSetupEmail(backend, documentId, { env: operatorEnvironment, log: event => { output.push(event); },
        createClient: () => ({ executeActionsEmail: async (subject, actions) => { calls.push([subject, actions]); } }),
      }), { outcome: "sent", reason: "accepted" });
    }
    assert.deepEqual(calls, Array(2).fill([before.externalSubject, ["UPDATE_PASSWORD"]]));
    assert.deepEqual(await backend.documents(USER).findOne({ documentId, populate: { identitySource: true, roles: true } }), before);
    assert.deepEqual(output.map(event => JSON.parse(event)), Array(2).fill({ event: "iam.password_setup_email",
      userDocumentId: documentId, sourceDocumentId, trigger: "operator", outcome: "sent", reason: "accepted" }));
    assert.doesNotMatch(output.join(""), /test-secret|example\.test|subject-|password=|token=/);
  } finally { checking = false; globalThis.fetch = fetch; }
});

test("operator recovery refuses missing, manual, registered service, inactive and tombstoned Document Service records", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const service = identity.createIdentityService(backend);
  const { resendPasswordSetupEmail } = backendModule<typeof import("../src/iam/password-setup/service")>("iam/password-setup/service");
  const manualData = input();
  const { sourceExternalId: _externalId, ...manual } = manualData;
  const manualUser = await backend.documents(USER).create({ data: { ...manual, protected: false, roles: [] } });
  const registration = await backend.documents("api::identity-source.identity-source").findOne({ documentId: sourceDocumentId, populate: { serviceUser: true } });
  assert.ok(registration?.serviceUser);
  const inactive = await service.createFromSource(principal, { ...input(), accountStatus: "inactive" }); assert.ok(inactive.ok);
  const tombstoned = await service.createFromSource(principal, input()); assert.ok(tombstoned.ok);
  assert.ok((await service.deactivateFromSource(principal, tombstoned.value.documentId, true)).ok);
  await settle();
  let sends = 0;
  for (const documentId of ["z".repeat(24), manualUser.documentId, registration.serviceUser.documentId,
    inactive.value.documentId, tombstoned.value.documentId]) {
    const before = await backend.documents(USER).findOne({ documentId, populate: { identitySource: true, roles: true } });
    assert.deepEqual(await resendPasswordSetupEmail(backend, documentId, { env: operatorEnvironment,
      createClient: () => ({ executeActionsEmail: async () => { sends++; } }),
    }), { outcome: "skipped", reason: "ineligible" });
    assert.deepEqual(await backend.documents(USER).findOne({ documentId, populate: { identitySource: true, roles: true } }), before);
  }
  assert.equal(sends, 0);
});

test("operator refusal rechecks eligibility after target discovery and bounds uncertain recovery", async () => {
  const { identity, source } = modules();
  const principal = await source.resolveSourcePrincipal(backend, sourceDocumentId); assert.ok(principal);
  const service = identity.createIdentityService(backend);
  const created = await service.createFromSource(principal, input()); assert.ok(created.ok);
  await settle();
  const documentId = created.value.documentId;
  const { resendPasswordSetupEmail } = backendModule<typeof import("../src/iam/password-setup/service")>("iam/password-setup/service");
  let discovery = true;
  let checking = true;
  let sends = 0;
  backend.documents.use(async (context, next) => {
    const result = await next();
    if (checking && discovery && context.uid === USER && context.action === "findOne"
      && (context.params as { documentId?: string }).documentId === documentId) {
      discovery = false;
      assert.ok((await service.patchFromSource(principal, documentId, { accountStatus: "inactive" })).ok);
    }
    return result;
  });
  try {
    assert.deepEqual(await resendPasswordSetupEmail(backend, documentId, { env: operatorEnvironment,
      createClient: () => ({ executeActionsEmail: async () => { sends++; } }),
    }), { outcome: "skipped", reason: "ineligible" });
    assert.equal(sends, 0);
  } finally { checking = false; }
  assert.ok((await service.patchFromSource(principal, documentId, { accountStatus: "active" })).ok);
  const before = await backend.documents(USER).findOne({ documentId });
  const output: string[] = [];
  let reject!: (reason: Error) => void;
  assert.deepEqual(await resendPasswordSetupEmail(backend, documentId, {
    env: { ...operatorEnvironment, KEYCLOAK_REQUEST_TIMEOUT_MS: "20" }, log: event => { output.push(event); },
    createClient: () => ({ executeActionsEmail: () => { sends++; return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); } }),
  }), { outcome: "failed", reason: "timeout" });
  reject(new Error("private@example.test https://reset.test/?token=private"));
  await tick();
  assert.equal(sends, 1, "uncertain explicit recovery never retries itself");
  assert.deepEqual(await backend.documents(USER).findOne({ documentId }), before);
  assert.equal(output.length, 1);
  assert.deepEqual(JSON.parse(output[0]), { event: "iam.password_setup_email", userDocumentId: documentId,
    sourceDocumentId, trigger: "operator", outcome: "failed", reason: "timeout" });
  assert.doesNotMatch(output.join(""), /private|example\.test|reset\.test/);
});

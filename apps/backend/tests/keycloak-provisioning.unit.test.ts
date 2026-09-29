import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { Core } from "@strapi/strapi";

import application from "../src/index";
import { KeycloakAdminClient, KeycloakProvisioningError } from "../src/keycloak/admin-client";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  KeycloakProvisioningConfigurationError,
  readKeycloakProvisioningConfig,
  type KeycloakProvisioningConfig,
} from "../src/keycloak/config";
import { IDAMBOX_USER_UID, provisionIdamboxUser, type IdamBoxUserDocument } from "../src/keycloak/provision-idambox-user";
import {
  createIdamboxUserProvisioningMiddleware,
  registerIdamboxUserProvisioning,
} from "../src/keycloak/register-idambox-user-provisioning";
import {
  FAKE_KEYCLOAK_CLIENT_ID,
  FAKE_KEYCLOAK_CLIENT_SECRET,
  FAKE_KEYCLOAK_REALM,
  startFakeKeycloakServer,
} from "./helpers/fake-keycloak-server";

const KEYCLOAK_ENV_KEYS = [
  "IDAMBOX_KEYCLOAK_PROVISIONING",
  "KEYCLOAK_BASE_URL",
  "KEYCLOAK_REALM",
  "KEYCLOAK_ADMIN_CLIENT_ID",
  "KEYCLOAK_ADMIN_CLIENT_SECRET",
  "KEYCLOAK_REQUEST_TIMEOUT_MS",
] as const;

const completeEnv = {
  IDAMBOX_KEYCLOAK_PROVISIONING: "true",
  KEYCLOAK_BASE_URL: "https://keycloak.example.test/",
  KEYCLOAK_REALM: "idambox",
  KEYCLOAK_ADMIN_CLIENT_ID: "idambox-strapi-admin",
  KEYCLOAK_ADMIN_CLIENT_SECRET: FAKE_KEYCLOAK_CLIENT_SECRET,
};

const PASSWORD = "correct-horse-battery-staple";

function user(overrides: Partial<IdamBoxUserDocument> = {}): IdamBoxUserDocument {
  return {
    documentId: "doc-jane",
    email: "Jane.Doe@idambox.com",
    username: "jane.doe",
    firstName: "Jane",
    lastName: "Doe",
    displayName: "Jane Doe",
    accountStatus: "active",
    externalSubject: null,
    ...overrides,
  };
}

function clientConfig(baseUrl: string, overrides: Partial<KeycloakProvisioningConfig> = {}): KeycloakProvisioningConfig {
  return {
    baseUrl,
    realm: FAKE_KEYCLOAK_REALM,
    adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
    adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET,
    requestTimeoutMs: 2000,
    ...overrides,
  };
}

/** Runs `action` with the Keycloak variables replaced by `values` and every other one untouched. */
async function withKeycloakEnv<T>(values: Record<string, string>, action: () => T | Promise<T>): Promise<T> {
  const saved = KEYCLOAK_ENV_KEYS.map((key) => [key, process.env[key]] as const);
  for (const key of KEYCLOAK_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return await action();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Replaces global fetch with a recorder that fails, so any network attempt is both visible and harmless. */
async function withFetchForbidden<T>(action: () => T | Promise<T>): Promise<{ result: T; calls: number }> {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("network access is forbidden in this test");
  }) as typeof fetch;
  try {
    return { result: await action(), calls };
  } finally {
    globalThis.fetch = original;
  }
}

function fakeStrapi() {
  const middlewares: unknown[] = [];
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const logs = { info: [] as string[], error: [] as string[] };
  let transactions = 0;
  const strapi = {
    config: { get: () => undefined },
    documents: { use: (middleware: unknown) => middlewares.push(middleware) },
    db: {
      transaction: async (callback: () => Promise<unknown>) => {
        transactions += 1;
        return callback();
      },
      query: (uid: string) => ({
        update: async (params: { where: unknown; data: Record<string, unknown> }) => {
          assert.equal(uid, IDAMBOX_USER_UID);
          updates.push(params);
          return params;
        },
      }),
    },
    log: { info: (message: string) => logs.info.push(message), error: (message: string) => logs.error.push(message) },
  };
  return { strapi: strapi as unknown as Core.Strapi, middlewares, updates, logs, transactions: () => transactions };
}

function assertNoSecrets(text: string) {
  assert.ok(!text.includes(FAKE_KEYCLOAK_CLIENT_SECRET), `leaked the client secret: ${text}`);
  assert.ok(!text.includes(PASSWORD), `leaked the user password: ${text}`);
}

// ---------------------------------------------------------------------------
// Configuration parsing
// ---------------------------------------------------------------------------

test("provisioning is disabled when the flag is unset, empty or false, whatever else is configured", () => {
  assert.equal(readKeycloakProvisioningConfig({}), null);
  assert.equal(readKeycloakProvisioningConfig({ IDAMBOX_KEYCLOAK_PROVISIONING: "" }), null);
  assert.equal(readKeycloakProvisioningConfig({ IDAMBOX_KEYCLOAK_PROVISIONING: "false" }), null);
  assert.equal(readKeycloakProvisioningConfig({ ...completeEnv, IDAMBOX_KEYCLOAK_PROVISIONING: "false" }), null);
  // Disabled never validates the other values, so a broken value cannot stop a local boot.
  assert.equal(readKeycloakProvisioningConfig({ IDAMBOX_KEYCLOAK_PROVISIONING: "false", KEYCLOAK_BASE_URL: "not a url" }), null);
});

test("an unrecognised flag value stops the boot instead of silently disabling provisioning", () => {
  for (const value of ["yes", "1", "on", "enabled"]) {
    assert.throws(
      () => readKeycloakProvisioningConfig({ ...completeEnv, IDAMBOX_KEYCLOAK_PROVISIONING: value }),
      (error: unknown) => error instanceof KeycloakProvisioningConfigurationError && error.message.includes("IDAMBOX_KEYCLOAK_PROVISIONING"),
    );
  }
});

test("complete configuration is parsed, trimmed and normalised", () => {
  assert.deepEqual(readKeycloakProvisioningConfig({ ...completeEnv, IDAMBOX_KEYCLOAK_PROVISIONING: " TRUE " }), {
    baseUrl: "https://keycloak.example.test",
    realm: "idambox",
    adminClientId: "idambox-strapi-admin",
    adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  });
  assert.equal(readKeycloakProvisioningConfig({ ...completeEnv, KEYCLOAK_BASE_URL: "https://sso.example.test/auth/" })?.baseUrl, "https://sso.example.test/auth");
  assert.equal(readKeycloakProvisioningConfig({ ...completeEnv, KEYCLOAK_REQUEST_TIMEOUT_MS: "2500" })?.requestTimeoutMs, 2500);
});

for (const key of ["KEYCLOAK_BASE_URL", "KEYCLOAK_REALM", "KEYCLOAK_ADMIN_CLIENT_ID", "KEYCLOAK_ADMIN_CLIENT_SECRET"] as const) {
  test(`enabled provisioning without ${key} fails fast and names it`, () => {
    for (const value of [undefined, "", "   "]) {
      const env: Record<string, string | undefined> = { ...completeEnv, [key]: value };
      assert.throws(
        () => readKeycloakProvisioningConfig(env),
        (error: unknown) => error instanceof KeycloakProvisioningConfigurationError && error.message.includes(key),
      );
    }
  });
}

test("invalid base URL and timeout values fail fast without echoing the value", () => {
  for (const baseUrl of ["keycloak.example.test", "ftp://keycloak.example.test", `https://admin:${FAKE_KEYCLOAK_CLIENT_SECRET}@keycloak.example.test`, "https://keycloak.example.test/?x=1"]) {
    assert.throws(
      () => readKeycloakProvisioningConfig({ ...completeEnv, KEYCLOAK_BASE_URL: baseUrl }),
      (error: unknown) => error instanceof KeycloakProvisioningConfigurationError
        && error.message.includes("KEYCLOAK_BASE_URL") && !error.message.includes(baseUrl) && !error.message.includes(FAKE_KEYCLOAK_CLIENT_SECRET),
    );
  }
  for (const timeout of ["0", "-5", "1.5", "soon"]) {
    assert.throws(
      () => readKeycloakProvisioningConfig({ ...completeEnv, KEYCLOAK_REQUEST_TIMEOUT_MS: timeout }),
      (error: unknown) => error instanceof KeycloakProvisioningConfigurationError && error.message.includes("KEYCLOAK_REQUEST_TIMEOUT_MS"),
    );
  }
});

// ---------------------------------------------------------------------------
// Strapi register phase
// ---------------------------------------------------------------------------

test("Strapi register skips Keycloak entirely when provisioning is disabled", async () => {
  for (const flag of [undefined, "false"]) {
    const fake = fakeStrapi();
    const { calls } = await withKeycloakEnv(flag === undefined ? {} : { IDAMBOX_KEYCLOAK_PROVISIONING: flag }, () =>
      withFetchForbidden(() => application.register({ strapi: fake.strapi })));
    assert.equal(fake.middlewares.length, 0, "no document middleware is registered");
    assert.equal(calls, 0, "no network call is made");
    assert.deepEqual(fake.logs, { info: [], error: [] });
  }
});

test("Strapi register refuses to start when provisioning is enabled with incomplete configuration", async () => {
  const fake = fakeStrapi();
  await withKeycloakEnv({ ...completeEnv, KEYCLOAK_ADMIN_CLIENT_SECRET: "" }, () => {
    assert.throws(
      () => application.register({ strapi: fake.strapi }),
      (error: unknown) => error instanceof KeycloakProvisioningConfigurationError && error.message.includes("KEYCLOAK_ADMIN_CLIENT_SECRET"),
    );
  });
  assert.equal(fake.middlewares.length, 0);
});

test("enabled provisioning registers one middleware at startup without contacting Keycloak or logging the secret", async () => {
  const fake = fakeStrapi();
  const { result, calls } = await withFetchForbidden(() => registerIdamboxUserProvisioning(fake.strapi, completeEnv));
  assert.equal(result, true);
  assert.equal(fake.middlewares.length, 1);
  assert.equal(calls, 0);
  assert.equal(fake.logs.info.length, 1);
  assertNoSecrets(fake.logs.info.join("\n"));
});

// ---------------------------------------------------------------------------
// Provisioning against a mocked Keycloak Admin API
// ---------------------------------------------------------------------------

test("a new user with a password is created with that credential and no required action", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    const id = await provisionIdamboxUser(client, user(), PASSWORD);

    const created = keycloak.users.get(id);
    assert.ok(created);
    assert.equal(created.username, "jane.doe");
    assert.equal(created.email, "jane.doe@idambox.com");
    assert.equal(created.enabled, true);
    assert.equal(created.password, PASSWORD);
    assert.equal(created.requiredActions, undefined);
    assert.deepEqual(created.attributes, { displayName: ["Jane Doe"] });
  } finally {
    await keycloak.close();
  }
});

test("a new user without a password is created with the UPDATE_PASSWORD required action and no credential", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    const id = await provisionIdamboxUser(client, user({ accountStatus: "inactive" }), null);

    const created = keycloak.users.get(id);
    assert.deepEqual(created?.requiredActions, ["UPDATE_PASSWORD"]);
    assert.equal(created?.password, undefined);
    assert.equal(created?.enabled, false, "an inactive IdamBox user is a disabled Keycloak account");
  } finally {
    await keycloak.close();
  }
});

test("an existing account found by email (any case) is updated, never duplicated, and keeps its username", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const existing = keycloak.addUser({ username: "jane.doe", email: "jane.doe@idambox.com", firstName: "Old" });
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));

    const id = await provisionIdamboxUser(client, user({ firstName: "Janet" }), null);

    assert.equal(id, existing.id);
    assert.equal(keycloak.users.size, 1);
    assert.equal(keycloak.users.get(id)?.firstName, "Janet");
    assert.ok(!keycloak.adminRequests().some((request) => request.method === "POST"), "no create is attempted");
    const update = keycloak.adminRequests().find((request) => request.method === "PUT");
    assert.ok(update && !("username" in (update.body as object)), "the update omits the immutable username");
    assert.equal(keycloak.users.get(id)?.password, undefined, "no password is set when none was given");
  } finally {
    await keycloak.close();
  }
});

test("repeating a provisioning run is idempotent", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    const first = await provisionIdamboxUser(client, user(), PASSWORD);
    const second = await provisionIdamboxUser(client, user(), PASSWORD);
    const third = await provisionIdamboxUser(client, user({ externalSubject: first }), null);
    assert.equal(second, first);
    assert.equal(third, first);
    assert.equal(keycloak.users.size, 1);
  } finally {
    await keycloak.close();
  }
});

test("an existing account found by externalSubject is updated and gets a new password when one is given", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const existing = keycloak.addUser({ username: "jane.doe", email: "jane.doe@idambox.com", password: "old-password" });
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));

    const id = await provisionIdamboxUser(client, user({ externalSubject: existing.id, email: "jane@idambox.com" }), PASSWORD);

    assert.equal(id, existing.id);
    assert.equal(keycloak.users.get(id)?.email, "jane@idambox.com", "an email change follows the subject");
    assert.equal(keycloak.users.get(id)?.password, PASSWORD);
    assert.ok(!keycloak.adminRequests().some((request) => request.path.includes("?")), "no email search is needed");
  } finally {
    await keycloak.close();
  }
});

test("a stale externalSubject falls back to the email lookup and then to a create", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    const id = await provisionIdamboxUser(client, user({ externalSubject: "deleted/../in-keycloak" }), null);
    assert.notEqual(id, "deleted/../in-keycloak");
    assert.equal(keycloak.users.size, 1);
    assert.ok(
      keycloak.adminRequests().some((request) => request.path === `/admin/realms/idambox/users/${encodeURIComponent("deleted/../in-keycloak")}`),
      "the subject is sent as one encoded path segment",
    );
  } finally {
    await keycloak.close();
  }
});

test("a create that loses a race (409) adopts and updates the account created concurrently", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const winner = keycloak.addUser({ username: "jane.doe", email: "jane.doe@idambox.com" });
    // The first email search runs before the concurrent writer commits.
    keycloak.failNext("GET /admin/realms/idambox/users", { status: 200, body: "[]" });
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));

    const id = await provisionIdamboxUser(client, user(), PASSWORD);

    assert.equal(id, winner.id);
    assert.equal(keycloak.users.size, 1);
    assert.equal(keycloak.users.get(id)?.password, PASSWORD);
  } finally {
    await keycloak.close();
  }
});

test("a username held by an account with another email stays a conflict", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    keycloak.addUser({ username: "jane.doe", email: "someone.else@idambox.com" });
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    await assert.rejects(
      provisionIdamboxUser(client, user(), PASSWORD),
      (error: unknown) => error instanceof KeycloakProvisioningError && error.status === 409 && error.message.includes("User exists with same username"),
    );
  } finally {
    await keycloak.close();
  }
});

// ---------------------------------------------------------------------------
// Token caching
// ---------------------------------------------------------------------------

test("the admin token is cached until shortly before it expires and shared by concurrent calls", async () => {
  const keycloak = await startFakeKeycloakServer({ tokenLifetimeSeconds: 300 });
  try {
    let now = 1_000_000;
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl), () => now);

    await Promise.all([client.findUserByEmail("a@x.test"), client.findUserByEmail("b@x.test"), client.findUserByEmail("c@x.test")]);
    await client.findUserByEmail("d@x.test");
    assert.equal(keycloak.tokenRequests().length, 1);

    now += 269_000; // still more than the 30 s skew before expiry
    await client.findUserByEmail("e@x.test");
    assert.equal(keycloak.tokenRequests().length, 1);

    now += 2_000; // inside the skew window
    await client.findUserByEmail("f@x.test");
    assert.equal(keycloak.tokenRequests().length, 2);
  } finally {
    await keycloak.close();
  }
});

test("a token rejected with 401 is replaced once; a second 401 is reported", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    await client.findUserByEmail("a@x.test");
    keycloak.revokeTokens();
    await client.findUserByEmail("a@x.test");
    assert.equal(keycloak.tokenRequests().length, 2);

    keycloak.failNext("GET /admin", { status: 401 });
    keycloak.failNext("GET /admin", { status: 401 });
    await assert.rejects(client.findUserByEmail("a@x.test"), (error: unknown) => error instanceof KeycloakProvisioningError && error.status === 401);
  } finally {
    await keycloak.close();
  }
});

// ---------------------------------------------------------------------------
// Failures and secret handling
// ---------------------------------------------------------------------------

test("an authentication failure reports the status without the client secret", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl, { adminClientSecret: `wrong-${FAKE_KEYCLOAK_CLIENT_SECRET}` }));
    await assert.rejects(provisionIdamboxUser(client, user(), PASSWORD), (error: unknown) => {
      assert.ok(error instanceof KeycloakProvisioningError);
      assert.equal(error.status, 401);
      assert.match(error.message, /token request failed with HTTP 401 \(unauthorized_client\)/);
      assertNoSecrets(error.message);
      return true;
    });
    assert.equal(keycloak.adminRequests().length, 0);
  } finally {
    await keycloak.close();
  }
});

test("an Admin API error keeps Keycloak's error code but not the response body", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl));
    keycloak.failNext("POST /admin", { status: 400, body: JSON.stringify({ error: "invalidPasswordMinLengthMessage", echoed: PASSWORD }) });
    await assert.rejects(provisionIdamboxUser(client, user(), PASSWORD), (error: unknown) => {
      assert.ok(error instanceof KeycloakProvisioningError);
      assert.equal(error.message, "Keycloak create user failed with HTTP 400 (invalidPasswordMinLengthMessage).");
      return true;
    });

    keycloak.failNext("GET /admin", { status: 502, body: `<html>upstream ${FAKE_KEYCLOAK_CLIENT_SECRET}</html>` });
    await assert.rejects(client.findUserByEmail("a@x.test"), (error: unknown) => {
      assert.ok(error instanceof KeycloakProvisioningError);
      assert.equal(error.message, "Keycloak search users failed with HTTP 502.");
      return true;
    });
  } finally {
    await keycloak.close();
  }
});

test("an unreachable Keycloak is a network failure, not a hang", async () => {
  const closed = createServer();
  await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
  const { port } = closed.address() as AddressInfo;
  await new Promise<void>((resolve) => closed.close(() => resolve()));

  const client = new KeycloakAdminClient(clientConfig(`http://127.0.0.1:${port}`, { requestTimeoutMs: 5000 }));
  await assert.rejects(provisionIdamboxUser(client, user(), PASSWORD), (error: unknown) => {
    assert.ok(error instanceof KeycloakProvisioningError);
    assert.equal(error.message, "Keycloak token request could not reach Keycloak.");
    assert.equal(error.status, undefined);
    return true;
  });
});

test("a Keycloak that stops answering times out after the configured limit", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const client = new KeycloakAdminClient(clientConfig(keycloak.baseUrl, { requestTimeoutMs: 150 }));
    keycloak.failNext("GET /admin", { status: 200, body: "[]", delayMs: 2000 });
    const started = Date.now();
    await assert.rejects(provisionIdamboxUser(client, user(), PASSWORD), (error: unknown) => {
      assert.ok(error instanceof KeycloakProvisioningError);
      assert.equal(error.message, "Keycloak search users timed out after 150 ms.");
      return true;
    });
    assert.ok(Date.now() - started < 1500, "the request was abandoned at the timeout");
  } finally {
    await keycloak.close();
  }
});

// ---------------------------------------------------------------------------
// Document middleware
// ---------------------------------------------------------------------------

type Middleware = ReturnType<typeof createIdamboxUserProvisioningMiddleware>;

function runMiddleware(middleware: Middleware, context: { uid: string; action: string; params?: unknown }, next: () => Promise<unknown>) {
  return (middleware as unknown as (context: unknown, next: () => Promise<unknown>) => Promise<unknown>)(context, next);
}

test("a created IdamBox user is provisioned inside the write transaction and the password is cleared", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const fake = fakeStrapi();
    const middleware = createIdamboxUserProvisioningMiddleware(fake.strapi, new KeycloakAdminClient(clientConfig(keycloak.baseUrl)));
    const params = { data: { email: "jane.doe@idambox.com", username: "jane.doe", displayName: "Jane Doe", password: PASSWORD } };

    const result = await runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "create", params }, async () => {
      // The document service hashes the password in its own copy of the input before writing.
      params.data.password = "$2a$10$hashed";
      return { ...user(), password: "$2a$10$hashed" };
    }) as Record<string, unknown>;

    const [created] = keycloak.users.values();
    assert.equal(created?.password, PASSWORD, "Keycloak receives the plaintext captured before the hash");
    assert.equal(fake.transactions(), 1);
    assert.deepEqual(fake.updates, [{ where: { documentId: "doc-jane" }, data: { externalSubject: created?.id, password: null } }]);
    assert.equal(result.externalSubject, created?.id);
    assert.equal(result.password, null);
    assertNoSecrets(fake.logs.info.concat(fake.logs.error).join("\n"));
  } finally {
    await keycloak.close();
  }
});

test("a Keycloak failure fails the write, skips the write-back and logs no secret", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const fake = fakeStrapi();
    const middleware = createIdamboxUserProvisioningMiddleware(fake.strapi, new KeycloakAdminClient(clientConfig(keycloak.baseUrl)));
    keycloak.failNext("POST /admin", { status: 503 });

    await assert.rejects(
      runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "create", params: { data: { password: PASSWORD } } }, async () => user()),
      (error: unknown) => error instanceof KeycloakProvisioningError && error.status === 503,
    );
    assert.deepEqual(fake.updates, []);
    assert.equal(fake.logs.error.length, 1);
    assert.match(fake.logs.error[0] ?? "", /doc-jane; the create is rolled back\. Keycloak create user failed with HTTP 503\./);
    assertNoSecrets(fake.logs.error[0] ?? "");
  } finally {
    await keycloak.close();
  }
});

test("an update that touches no provisioned field of a linked user does not call Keycloak", async () => {
  const fake = fakeStrapi();
  const middleware = createIdamboxUserProvisioningMiddleware(fake.strapi, new KeycloakAdminClient(clientConfig("http://127.0.0.1:1")));
  const { calls } = await withFetchForbidden(() =>
    runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "update", params: { documentId: "doc-jane", data: { roles: ["r1"] } } },
      async () => user({ externalSubject: "kc-1" })));
  assert.equal(calls, 0);
  assert.deepEqual(fake.updates, []);
});

test("any update of a user not yet linked to Keycloak provisions it", async () => {
  const keycloak = await startFakeKeycloakServer();
  try {
    const fake = fakeStrapi();
    const middleware = createIdamboxUserProvisioningMiddleware(fake.strapi, new KeycloakAdminClient(clientConfig(keycloak.baseUrl)));
    await runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "update", params: { documentId: "doc-jane", data: { roles: ["r1"] } } },
      async () => user());
    assert.equal(keycloak.users.size, 1);
    assert.equal(fake.updates.length, 1);
  } finally {
    await keycloak.close();
  }
});

test("other content types, other actions and missing documents pass straight through", async () => {
  const fake = fakeStrapi();
  const middleware = createIdamboxUserProvisioningMiddleware(fake.strapi, new KeycloakAdminClient(clientConfig("http://127.0.0.1:1")));
  const { calls } = await withFetchForbidden(async () => {
    assert.equal(await runMiddleware(middleware, { uid: "api::role.role", action: "create", params: { data: {} } }, async () => "role"), "role");
    assert.equal(await runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "delete", params: {} }, async () => "deleted"), "deleted");
    assert.equal(await runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "findMany", params: {} }, async () => "rows"), "rows");
    assert.equal(await runMiddleware(middleware, { uid: IDAMBOX_USER_UID, action: "update", params: { data: { email: "x@y.z" } } }, async () => null), null);
  });
  assert.equal(calls, 0);
  assert.equal(fake.transactions(), 1, "only the IdamBox user update opened a transaction");
  assert.deepEqual(fake.updates, []);
});

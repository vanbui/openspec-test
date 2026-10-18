import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import { KeycloakAdminClient } from "../src/keycloak/admin-client";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-registration-${process.pid}`);
const environment = {
  APP_KEYS: "registration-test-1,registration-test-2", ADMIN_JWT_SECRET: "registration-admin",
  API_TOKEN_SALT: "registration-api", TRANSFER_TOKEN_SALT: "registration-transfer",
  ENCRYPTION_KEY: "registration-encryption", JWT_SECRET: "registration-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "registration.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
const runtime = require("@strapi/strapi") as {
  compileStrapi(options: { appDir: string }): Promise<{ appDir: string; distDir: string }>;
  createStrapi(options: { appDir: string; distDir: string }): Core.Strapi;
};
let compiled: { appDir: string; distDir: string };
let strapi: Core.Strapi;
let seedIamData: typeof import("../src/bootstrap/seed-iam-data").seedIamData;
let registerIdentitySource: typeof import("../src/iam/identity/source-registration").registerIdentitySource;
let createIdamboxUserProvisioningMiddleware: typeof import("../src/keycloak/register-idambox-user-provisioning").createIdamboxUserProvisioningMiddleware;
let remoteCalls = 0;
let failure: "create" | "bind" | "grant" | "invariant" | undefined;
class RejectingClient extends KeycloakAdminClient {
  override async findUserByEmail(): Promise<never> { remoteCalls++; throw new Error("REMOTE_CALL_REFUSED"); }
  override async findUserById(): Promise<never> { remoteCalls++; throw new Error("REMOTE_CALL_REFUSED"); }
}
async function boot(enabled: boolean) {
  // Use the modules loaded by the real application's register hook, including its private contexts.
  seedIamData = require(path.join(compiled.distDir, "src/bootstrap/seed-iam-data")).seedIamData;
  registerIdentitySource = require(path.join(compiled.distDir, "src/iam/identity/source-registration")).registerIdentitySource;
  createIdamboxUserProvisioningMiddleware = require(path.join(compiled.distDir, "src/keycloak/register-idambox-user-provisioning")).createIdamboxUserProvisioningMiddleware;
  strapi = runtime.createStrapi(compiled);
  await strapi.load();
  strapi.cron?.destroy();
  if (enabled) strapi.documents.use(createIdamboxUserProvisioningMiddleware(strapi, new RejectingClient({
    baseUrl: "http://127.0.0.1:1", realm: "test", adminClientId: "test", adminClientSecret: "test", requestTimeoutMs: 100,
  })));
  strapi.documents.use(async (context, next) => {
    const data = (context.params as { data?: { roles?: unknown } }).data;
    const result = await next();
    if ((failure === "create" && context.uid === USER && context.action === "create")
      || (failure === "bind" && context.uid === SOURCE && context.action === "create")
      || (failure === "grant" && context.uid === USER && context.action === "update" && data?.roles)
      || (failure === "invariant" && context.uid === SOURCE && context.action === "findOne")) {
      throw new Error("INJECTED_REGISTRATION_FAILURE");
    }
    return result;
  });
}
const manifest = (suffix: string) => ({ name: `Source ${suffix}`, username: `service-${suffix}`, email: `service-${suffix}@idambox.test`, displayName: `Service ${suffix}` });
const seedEnv = { NODE_ENV: "development", IDAMBOX_SEED_IAM: "true" };

before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  compiled = await runtime.compileStrapi({ appDir });
  await boot(false);
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
});
after(async () => {
  await strapi?.destroy();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

for (const enabled of [false, true]) {
  test(`registration, rollback and collision safety with provisioning ${enabled ? "enabled" : "disabled"}`, async () => {
    if (enabled) { await strapi.destroy(); await boot(true); }
    const label = enabled ? "on" : "off";
    remoteCalls = 0;
    const source = await registerIdentitySource(strapi, manifest(label));
    const user = await strapi.documents(USER).findOne({ documentId: source.serviceUser.documentId, populate: { roles: true, identitySource: true } });
    assert.ok(user);
    assert.equal(user.protected, true); assert.equal(user.accountStatus, "active");
    assert.deepEqual(user.roles?.map((role) => role.name), ["Identity Provisioning"]);
    for (const field of ["identitySource", "sourceExternalId", "sourceIdentityKey", "externalSubject", "password"] as const) assert.equal(user[field] ?? null, null);
    assert.equal(source.tokenHash ?? null, null);
    assert.equal(remoteCalls, 0);
    if (enabled) {
      await strapi.documents(USER).update({ documentId: user.documentId, data: { roles: user.roles?.map((role) => role.documentId) } });
      await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { roles: [] } }), /IAM_SOURCE_SERVICE_INVARIANT/);
      await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { password: "not-for-service" } }), /IAM_SOURCE_SERVICE_INVARIANT/);
      const unchanged = await strapi.documents(USER).findOne({ documentId: user.documentId, populate: { roles: true } });
      assert.equal(unchanged?.password ?? null, null);
      assert.deepEqual(unchanged?.roles?.map((role) => role.name), ["Identity Provisioning"]);
      assert.equal(remoteCalls, 0);
    }
    await seedIamData(strapi, seedEnv);
    const [seeded] = await strapi.documents(SOURCE).findMany({ filters: { name: "midPoint (dev)" }, populate: { serviceUser: true } });
    assert.ok(seeded.serviceUser);
    assert.equal(seeded.tokenHash ?? null, null);
    await seedIamData(strapi, seedEnv);
    assert.equal(await strapi.documents(SOURCE).count({ filters: { name: "midPoint (dev)" } }), 1);
    assert.equal(remoteCalls, 0);
    if (!enabled) {
      await assert.rejects(strapi.documents(SOURCE).delete({ documentId: seeded.documentId }), /IAM_IDENTITY_FORBIDDEN/);
      await assert.rejects(strapi.documents(USER).delete({ documentId: seeded.serviceUser.documentId }), /IAM_IDENTITY_FORBIDDEN/);
    }
    for (const stage of ["create", "bind", "grant", "invariant"] as const) {
      const input = manifest(`${label}-${stage}`);
      failure = stage;
      try { await assert.rejects(registerIdentitySource(strapi, input), /INJECTED_REGISTRATION_FAILURE/); }
      finally { failure = undefined; }
      assert.equal(await strapi.documents(USER).count({ filters: { username: input.username } }), 0);
      assert.equal(await strapi.documents(SOURCE).count({ filters: { name: input.name } }), 0);
    }
    // Create collisions with the middleware disabled through an isolated restart.
    await strapi.destroy(); await boot(false);
    const collision = manifest(`${label}-collision`);
    const person = await strapi.documents(USER).create({ data: { username: collision.username, email: `person-${label}@idambox.test`, displayName: "Person", protected: false, accountStatus: "active" } });
    if (enabled) { await strapi.destroy(); await boot(true); }
    await assert.rejects(registerIdentitySource(strapi, collision), /IAM_SOURCE_REGISTRATION_COLLISION/);
    await assert.rejects(registerIdentitySource(strapi, { ...collision, username: `other-${label}`, email: `person-${label}@idambox.test` }), /IAM_SOURCE_REGISTRATION_COLLISION/);
    assert.equal((await strapi.documents(USER).findOne({ documentId: person.documentId }))?.protected, false);
    assert.equal(remoteCalls, 0);
  });
}

test("opt-in seed, token/activity preservation and restart do not modify people", async () => {
  // An established service binding survives seed gating and cannot be removed generically.
  const [previous] = await strapi.documents(SOURCE).findMany({ filters: { name: "midPoint (dev)" }, populate: { serviceUser: true } });
  assert.ok(previous.serviceUser);
  for (const env of [{ NODE_ENV: "production", IDAMBOX_SEED_IAM: "true" }, { NODE_ENV: "development", IDAMBOX_SEED_IAM: "false" }]) {
    await seedIamData(strapi, env);
    assert.equal(await strapi.documents(SOURCE).count({ filters: { name: "midPoint (dev)" } }), 1);
  }
  await seedIamData(strapi, seedEnv);
  const [source] = await strapi.documents(SOURCE).findMany({ filters: { name: "midPoint (dev)" }, populate: { serviceUser: true } });
  assert.ok(source); assert.equal(source.tokenHash ?? null, null);
  const timestamp = "2026-10-14T00:00:00.000Z";
  await strapi.documents(SOURCE).update({ documentId: source.documentId, data: { tokenHash: "opaque-stored-hash", tokenRotatedAt: timestamp, lastActivityAt: timestamp, sourceStatus: "inactive" } });
  await strapi.destroy(); await boot(true);
  await seedIamData(strapi, seedEnv);
  const reused = await strapi.documents(SOURCE).findOne({ documentId: source.documentId, populate: { serviceUser: true } });
  assert.equal(reused?.tokenHash, "opaque-stored-hash"); assert.equal(reused?.lastActivityAt, timestamp);
  assert.equal(reused?.tokenRotatedAt, timestamp); assert.equal(reused?.sourceStatus, "inactive");
  assert.equal(reused?.serviceUser?.documentId, source.serviceUser?.documentId);
  assert.equal(remoteCalls, 0);
});

test("invalid manifests and changed persisted invariants fail closed", async () => {
  for (const input of [{ ...manifest("invalid"), name: "  " }, { ...manifest("invalid"), name: " padded " }, { ...manifest("invalid"), password: "secret" }, { ...manifest("invalid"), protected: true }, { ...manifest("invalid"), email: "bad" }]) {
    await assert.rejects(registerIdentitySource(strapi, input), /IAM_SOURCE_REGISTRATION_MANIFEST/);
  }
  const [source] = await strapi.documents(SOURCE).findMany({ filters: { name: "midPoint (dev)" }, populate: { serviceUser: true } });
  assert.ok(source.serviceUser);
  await assert.rejects(registerIdentitySource(strapi, { name: "midPoint (dev)", username: "different", email: "different@idambox.test", displayName: "different" }), /IAM_SOURCE_REGISTRATION_COLLISION/);
  await strapi.destroy(); await boot(false);
  await assert.rejects(strapi.documents(USER).update({ documentId: source.serviceUser.documentId, data: { roles: [] } }), /IAM_SOURCE_SERVICE_INVARIANT/);
  await seedIamData(strapi, seedEnv);
});

test("caller flags and protected people cannot assert registration privilege", async () => {
  await strapi.destroy(); await boot(true);
  const beforeCalls = remoteCalls;
  const forged = { ...manifest("forged"), accountStatus: "active" as const, protected: true, skipProvisioning: true, registration: true };
  await assert.rejects(strapi.documents(USER).create({ data: forged }), /IAM_IDENTITY_FORBIDDEN/);
  assert.equal(remoteCalls, beforeCalls);
  assert.equal(await strapi.documents(USER).count({ filters: { username: "service-forged" } }), 0);
});

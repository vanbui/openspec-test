import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import { deriveSourceIdentityKey, resolveIdentityUniqueness } from "../src/iam/identity/identity-input";
import { withIdentityUserLock } from "../src/iam/identity/user-lock";
import { KeycloakAdminClient } from "../src/keycloak/admin-client";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const ROLE = "api::role.role";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-ownership-${process.pid}`);
const environment = {
  APP_KEYS: "ownership-1,ownership-2", ADMIN_JWT_SECRET: "ownership-admin", API_TOKEN_SALT: "ownership-api",
  TRANSFER_TOKEN_SALT: "ownership-transfer", ENCRYPTION_KEY: "ownership-encryption", JWT_SECRET: "ownership-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "ownership.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi;
let registerIdentitySource: typeof import("../src/iam/identity/source-registration").registerIdentitySource;
let resolveSourcePrincipal: typeof import("../src/iam/identity/source-principal").resolveSourcePrincipal;
let runSourceMutation: typeof import("../src/iam/identity/write-context").runSourceMutation;
let runManualProtection: typeof import("../src/iam/identity/write-context").runManualProtection;
let createIdamboxUserProvisioningMiddleware: typeof import("../src/keycloak/register-idambox-user-provisioning").createIdamboxUserProvisioningMiddleware;
let serviceId: string;
let sourceId: string;
let roleId: string;
let ordinaryRoleId: string;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>>;
before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await runtime.compileStrapi({ appDir });
  assert.ok(compiled.distDir);
  registerIdentitySource = require(path.join(compiled.distDir, "src/iam/identity/source-registration")).registerIdentitySource;
  resolveSourcePrincipal = require(path.join(compiled.distDir, "src/iam/identity/source-principal")).resolveSourcePrincipal;
  ({ runSourceMutation, runManualProtection } = require(path.join(compiled.distDir, "src/iam/identity/write-context")));
  createIdamboxUserProvisioningMiddleware = require(path.join(compiled.distDir, "src/keycloak/register-idambox-user-provisioning")).createIdamboxUserProvisioningMiddleware;
  strapi = await runtime.createStrapi(compiled).load();
  strapi.cron?.destroy();
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  const role = await strapi.documents(ROLE).create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  roleId = role.documentId;
  ordinaryRoleId = (await strapi.documents(ROLE).create({ data: { name: "Ordinary analyst" } })).documentId;
  const source = await registerIdentitySource(strapi, { name: "Ownership source", username: "ownership-service", email: "service@ownership.test", displayName: "Service" });
  serviceId = source.serviceUser.documentId;
  sourceId = source.documentId;
});
after(async () => {
  await strapi?.destroy();
  await remote?.close();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

for (const enabled of [false, true]) {
  test(`locked source ownership through Document Service and content-manager, provisioning=${enabled}`, async () => {
    if (enabled) {
      remote = await startFakeKeycloakServer();
      strapi.documents.use(createIdamboxUserProvisioningMiddleware(strapi, new KeycloakAdminClient({
        baseUrl: remote.baseUrl, realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
        adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000,
      })));
    }
    const principal = await resolveSourcePrincipal(strapi, sourceId);
    assert.ok(principal);
    const data = { username: `sourced-${enabled}`, email: `sourced-${enabled}@ownership.test`,
      displayName: "Sourced", accountStatus: "active" as const, protected: false, identitySource: sourceId, sourceExternalId: ` 00Ab-${enabled} `,
      firstName: "Given", lastName: "Family", employeeNumber: "001", department: "HR", jobTitle: "Manager",
      roles: [], lastSyncedAt: "2026-10-14T00:00:00.000Z" };
    const user = await runSourceMutation(strapi, principal, "create", undefined, () => strapi.documents(USER).create({ data }));
    assert.equal(user.sourceIdentityKey, deriveSourceIdentityKey(sourceId, ` 00Ab-${enabled} `));
    assert.equal(user.sourceExternalId, ` 00Ab-${enabled} `);
    const contentManager = strapi.plugin("content-manager").service("document-manager") as {
      update(id: string, uid: string, params: { data: Record<string, unknown> }): Promise<unknown>;
    };
    for (const field of ["username", "email", "firstName", "lastName", "displayName", "accountStatus", "employeeNumber", "department", "jobTitle"]) {
      const value = field === "email" ? "changed@ownership.test" : field === "accountStatus" ? "inactive" : "Changed";
      await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { [field]: value } }), /IAM_IDENTITY_FORBIDDEN/);
      await assert.rejects(contentManager.update(user.documentId, USER, { data: { [field]: value } }), /IAM_IDENTITY_FORBIDDEN/);
    }
    await strapi.documents(USER).update({ documentId: user.documentId, data: { displayName: "Sourced", roles: [ordinaryRoleId] } });
    await contentManager.update(user.documentId, USER, { data: { displayName: "Sourced", roles: [ordinaryRoleId] } });
    for (const changed of [{ password: "forged-password" }, { externalSubject: "forged-subject" },
      { lastSyncedAt: "2026-10-15T00:00:00.000Z" }, { sourceExternalId: "different" }, { identitySource: null },
      { sourceIdentityKey: "a".repeat(64) }, { protected: true }]) {
      await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: changed }), /IAM_IDENTITY_FORBIDDEN|IAM_IDENTITY_IMMUTABLE_SOURCE_KEY/);
    }
    await assert.rejects(strapi.documents(USER).delete({ documentId: user.documentId }), /IAM_IDENTITY_FORBIDDEN/);
    await assert.rejects(runManualProtection(strapi, user.documentId, true), /IAM_IDENTITY_FORBIDDEN/);
    const changed = await runSourceMutation(strapi, principal, "patch", user.documentId,
      () => strapi.documents(USER).update({ documentId: user.documentId, data: { firstName: "Source changed" } }));
    assert.equal(changed?.firstName, "Source changed");
    const persisted = await strapi.documents(USER).findOne({ documentId: user.documentId, populate: { roles: true } });
    assert.deepEqual(persisted?.roles?.map((role) => role.documentId), [ordinaryRoleId]);
  });
}

test("server-owned tuple and protection cannot be forged through data or params", async () => {
  for (const data of [{ protected: true }, { identitySource: sourceId, sourceExternalId: "001" },
    { sourceIdentityKey: "a".repeat(64) }, { lastSyncedAt: new Date().toISOString() }]) {
    await assert.rejects(strapi.documents(USER).create({ data: {
      username: "forged", email: "forged@ownership.test", displayName: "Forged", accountStatus: "active", ...data, protected: data.protected ?? false,
    } }), /IAM_IDENTITY_FORBIDDEN/);
  }
});

test("service bindings and inverse Role writes cannot overgrant or unprotect a service", async () => {
  const otherRole = await strapi.documents(ROLE).create({ data: { name: "Other" } });
  await assert.rejects(strapi.documents(ROLE).update({ documentId: otherRole.documentId, data: { idamboxUsers: [serviceId] } }), /IAM_SOURCE_SERVICE_INVARIANT/);
  await assert.rejects(strapi.documents(ROLE).update({ documentId: roleId, data: { idamboxUsers: [] } }), /IAM_SOURCE_SERVICE_INVARIANT/);
  await assert.rejects(strapi.documents(USER).update({ documentId: serviceId, data: { protected: false } }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(SOURCE).update({ documentId: sourceId, data: { serviceUser: null } }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(SOURCE).delete({ documentId: sourceId }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(USER).delete({ documentId: serviceId }), /IAM_IDENTITY_FORBIDDEN/);
  const otherFunction = await strapi.documents("api::function.function").create({ data: { name: "Unrelated", application: null } });
  await assert.rejects(strapi.documents("api::function.function").update({ documentId: otherFunction.documentId, data: { roles: [roleId] } }), /IAM_SOURCE_PROVISIONING_GRANT/);
  const service = await strapi.documents(USER).findOne({ documentId: serviceId, populate: { roles: true } });
  assert.deepEqual(service?.roles?.map((role) => role.documentId), [roleId]);
});

test("manual protection is a concrete human-only maintenance operation", async () => {
  const user = await strapi.documents(USER).create({ data: { username: "manual-human", email: "human@ownership.test",
    displayName: "Human", accountStatus: "active", protected: false } });
  await runManualProtection(strapi, user.documentId, true);
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.protected, true);
  await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { protected: false } }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(runManualProtection(strapi, serviceId, false), /IAM_IDENTITY_FORBIDDEN/);
  const principal = await resolveSourcePrincipal(strapi, sourceId);
  assert.ok(principal);
  await assert.rejects(runSourceMutation(strapi, principal, "replace", user.documentId, () => strapi.documents(USER).update({
    documentId: user.documentId, data: { username: "manual-human", email: "human@ownership.test", displayName: "Human",
      accountStatus: "active", sourceExternalId: "human", identitySource: sourceId },
  })), /IAM_IDENTITY_FORBIDDEN/);
  await runManualProtection(strapi, user.documentId, false);
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.protected, false);
});

test("parallel ordinary writes and forged params cannot borrow a source context", async () => {
  const principal = await resolveSourcePrincipal(strapi, sourceId);
  assert.ok(principal);
  const [user] = await strapi.documents(USER).findMany({ filters: { username: "sourced-false" } });
  assert.ok(user);
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  const trusted = runSourceMutation(strapi, principal, "patch", user.documentId, async () => {
    entered(); await held;
    return strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Trusted" } });
  });
  await ready;
  try {
    await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Intruder" },
      ...{ sourcePrincipal: principal, sourceMutation: true, headers: { "x-source-authority": sourceId } },
    }), /IAM_IDENTITY_FORBIDDEN/);
  } finally { release(); }
  await trusted;
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.department, "Trusted");
  await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { department: "After" } }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(runSourceMutation(strapi, { ...principal }, "patch", user.documentId,
    () => strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Copied principal" } })), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(runSourceMutation(strapi, principal, "patch", serviceId,
    () => strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Wrong target" } })), /IAM_IDENTITY_FORBIDDEN/);
  let releaseLate: () => void = () => undefined;
  const lateBarrier = new Promise<void>((resolve) => { releaseLate = resolve; });
  let lateWrite: Promise<unknown> = Promise.resolve();
  await runSourceMutation(strapi, principal, "patch", user.documentId, async () => {
    // A descendant promise retains its async context even after run() returns.
    lateWrite = (async () => {
      await lateBarrier;
      return strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Expired authority" } });
    })();
    return strapi.documents(USER).update({ documentId: user.documentId, data: { department: "Finished operation" } });
  });
  const expired = assert.rejects(lateWrite, /IAM_IDENTITY_FORBIDDEN/);
  releaseLate();
  await expired;
});

test("inactive and tombstoned identities retain immutable reservations and cannot be resurrected", async () => {
  const principal = await resolveSourcePrincipal(strapi, sourceId);
  assert.ok(principal);
  const [user] = await strapi.documents(USER).findMany({ filters: { username: "sourced-false" } });
  assert.ok(user);
  const data = { accountStatus: "inactive" as const, sourceDeletedAt: "2026-10-14T01:00:00.000Z" };
  await runSourceMutation(strapi, principal, "delete", user.documentId, () => strapi.documents(USER).update({ documentId: user.documentId, data }));
  const stored = await strapi.documents(USER).findOne({ documentId: user.documentId, populate: { identitySource: true } });
  assert.equal(stored?.sourceIdentityKey, user.sourceIdentityKey);
  assert.equal(stored?.sourceExternalId, user.sourceExternalId);
  assert.equal(stored?.identitySource?.documentId, sourceId);
  await assert.rejects(runSourceMutation(strapi, principal, "patch", user.documentId,
    () => strapi.documents(USER).update({ documentId: user.documentId, data: { accountStatus: "active" } })), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(USER).delete({ documentId: user.documentId }), /IAM_IDENTITY_FORBIDDEN/);
  await runSourceMutation(strapi, principal, "delete", user.documentId, () => strapi.documents(USER).update({ documentId: user.documentId, data }));
});

test("SQLite write coordination precedes every ownership deciding read", async () => {
  const statements: string[] = [];
  const listener = (event: { sql: string }) => { statements.push(event.sql); };
  strapi.db.connection.on("query", listener);
  try {
    await assert.rejects(strapi.documents(USER).update({ documentId: serviceId, data: { protected: false } }), /IAM_IDENTITY_FORBIDDEN/);
  } finally { strapi.db.connection.removeListener("query", listener); }
  const coordination = statements.findIndex((sql) => /update.*keycloak_sync_outboxes/i.test(sql));
  // The guard's deciding read addresses the stable documentId. Earlier rejected
  // relation-population promises can finish their framework id lookups on this turn.
  const deciding = statements.findIndex((sql) => /select.*idambox_users.*where.*document_id/i.test(sql));
  assert.ok(coordination >= 0 && deciding > coordination, statements.join("\n"));
  await withIdentityUserLock(strapi, serviceId, async () => {
    assert.equal(strapi.db.inTransaction(), true);
  });
  let attempts = 0;
  await withIdentityUserLock(strapi, serviceId, async () => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
    return undefined;
  });
  assert.equal(attempts, 3, "driver error codes restart the entire outer transaction");
  attempts = 0;
  await assert.rejects(withIdentityUserLock(strapi, serviceId, async () => {
    attempts++; throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  }));
  assert.equal(attempts, 5, "busy retries are bounded");
});

test("one-time manual claims preserve roles, clear optional replacement fields and reserve the exact tuple", async () => {
  const principal = await resolveSourcePrincipal(strapi, sourceId);
  assert.ok(principal);
  const manual = await strapi.documents(USER).create({ data: { username: "claim-human", email: "claim@ownership.test", displayName: "Human",
    accountStatus: "active", protected: false, department: "Old", employeeNumber: "Old", roles: [ordinaryRoleId] } });
  const claim = { username: "claim-human", email: "claim@ownership.test", displayName: "Claimed", accountStatus: "active" as const,
    identitySource: sourceId, sourceExternalId: "00001" };
  const claimed = await runSourceMutation(strapi, principal, "replace", manual.documentId,
    () => strapi.documents(USER).update({ documentId: manual.documentId, data: claim }));
  assert.equal(claimed?.department, null); assert.equal(claimed?.employeeNumber, null);
  assert.equal(claimed?.sourceIdentityKey, deriveSourceIdentityKey(sourceId, "00001"));
  assert.equal("sourceIdentityKey" in claim, false);
  assert.equal("department" in claim, false);
  const persisted = await strapi.documents(USER).findOne({ documentId: manual.documentId, populate: { roles: true } });
  assert.deepEqual(persisted?.roles?.map((role) => role.documentId), [ordinaryRoleId]);
  await assert.rejects(runSourceMutation(strapi, principal, "replace", manual.documentId,
    () => strapi.documents(USER).update({ documentId: manual.documentId, data: { ...claim, sourceExternalId: "00002" } })), /IAM_IDENTITY_IMMUTABLE_SOURCE_KEY/);
  const duplicate = { username: "claim-duplicate", email: "duplicate@ownership.test", displayName: "Duplicate", accountStatus: "active" as const,
    identitySource: sourceId, sourceExternalId: "00001", protected: false, roles: [] };
  await assert.rejects(runSourceMutation(strapi, principal, "create", undefined, () => strapi.documents(USER).create({ data: duplicate })));
  assert.equal(strapi.db.inTransaction(), false);
  assert.deepEqual(await resolveIdentityUniqueness(strapi, sourceId, "00001"), { ok: false, code: "uniqueness" });
  assert.equal(await strapi.documents(USER).count({ filters: { username: "claim-duplicate" } }), 0);
  const manager = strapi.plugin("content-manager").service("document-manager") as {
    deleteMany(ids: string[], uid: string): Promise<unknown>;
  };
  await assert.rejects(manager.deleteMany([manual.documentId], USER), /IAM_IDENTITY_FORBIDDEN/);
  assert.ok(await strapi.documents(USER).findOne({ documentId: manual.documentId }));
});


test("reserved provisioning role rejects manual create/update and content-manager writes in every relation form", async () => {
  const role = await strapi.documents(ROLE).findOne({ documentId: roleId });
  assert.ok(role);
  const refs = [roleId, role.id, { documentId: roleId }, { id: role.id }];
  const forms = refs.flatMap((ref) => [[ref], { set: [ref] }, { connect: [ref] }]);
  const user = await strapi.documents(USER).create({ data: { username: "grant-target", email: "grant-target@ownership.test", displayName: "Target", protected: false, accountStatus: "active" } });
  const manager = strapi.plugin("content-manager").service("document-manager") as {
    update(id: string, uid: string, params: { data: Record<string, unknown> }): Promise<unknown>;
  };
  for (const roles of forms) {
    const relationData: Record<string, unknown> = { roles };
    const createData = { username: "illegal-grant", email: "illegal@ownership.test", displayName: "Illegal", protected: false, accountStatus: "active" as const, ...relationData };
    const updateData: Record<string, unknown> = { roles };
    await assert.rejects(strapi.documents(USER).create({ data: createData }), /IAM_IDENTITY_FORBIDDEN/);
    await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: updateData }), /IAM_IDENTITY_FORBIDDEN/);
    await assert.rejects(manager.update(user.documentId, USER, { data: { roles } }), /IAM_IDENTITY_FORBIDDEN/);
  }
  for (const idamboxUsers of [[user.documentId], [user.id], { set: [{ id: user.id }] }, { set: [user.documentId] }, { connect: [{ documentId: user.documentId }] }, { connect: [{ id: user.id }] }]) {
    await assert.rejects(strapi.documents(ROLE).update({ documentId: roleId, data: { idamboxUsers } }), /IAM_IDENTITY_FORBIDDEN/);
  }
  const reserved = await strapi.documents(ROLE).findOne({ documentId: roleId, populate: { functions: true } });
  assert.ok(reserved?.functions?.[0]);
  await assert.rejects(strapi.documents(ROLE).create({ data: {
    name: "Forged provisioning", functions: [reserved.functions[0].documentId], idamboxUsers: { connect: [user.documentId] },
  } }), /IAM_IDENTITY_FORBIDDEN|IAM_SOURCE_PROVISIONING_GRANT/);
  assert.deepEqual((await strapi.documents(USER).findOne({ documentId: user.documentId, populate: { roles: true } }))?.roles, []);
});

test("reserved provisioning role rejects sourced-person updates and preserves valid service submissions", async () => {
  const principal = await resolveSourcePrincipal(strapi, sourceId); assert.ok(principal);
  const person = await runSourceMutation(strapi, principal, "create", undefined, () => strapi.documents(USER).create({ data: {
    displayName: "Sourced target", username: "sourced-grant-target", email: "sourced-grant@ownership.test", identitySource: sourceId,
    sourceExternalId: "grant-target", accountStatus: "active", protected: false, roles: [],
  } }));
  for (const roles of [[roleId], { set: [{ documentId: roleId }] }, { connect: [roleId] }]) {
    await assert.rejects(strapi.documents(USER).update({ documentId: person.documentId, data: { roles } }), /IAM_IDENTITY_FORBIDDEN/);
    await strapi.documents(USER).update({ documentId: serviceId, data: { roles } });
  }
  for (const idamboxUsers of [{ set: [serviceId] }, { connect: [serviceId] }]) {
    await strapi.documents(ROLE).update({ documentId: roleId, data: { idamboxUsers } });
  }
  await assert.rejects(strapi.documents(USER).update({ documentId: serviceId, data: { roles: { disconnect: [roleId] } } }), /IAM_SOURCE_SERVICE_INVARIANT/);
});

import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { createIdentityService } from "../src/iam/identity/identity-service";
import type { SourcePrincipal } from "../src/iam/identity/source-principal";
import { DEVELOPMENT_FIXTURE_SUBJECTS } from "../src/keycloak/development-fixture-subjects";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

const USER = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-identity-${process.pid}`);
const environment = {
  APP_KEYS: "identity-1,identity-2", ADMIN_JWT_SECRET: "identity-admin", API_TOKEN_SALT: "identity-api",
  TRANSFER_TOKEN_SALT: "identity-transfer", ENCRYPTION_KEY: "identity-encryption", JWT_SECRET: "identity-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "identity.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi;
let service: ReturnType<typeof createIdentityService>;
let first: SourcePrincipal;
let second: SourcePrincipal;
let roleId: string;
let compiledDir: string;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>> | undefined;
const dto = (name: string, sourceExternalId = name) => ({ username: name, email: `${name}@identity.test`,
  displayName: name, accountStatus: "active" as const, sourceExternalId });
function value<T>(outcome: { ok: true; value: T } | { ok: false; code: string }): T {
  assert.ok(outcome.ok, JSON.stringify(outcome)); return outcome.value;
}
async function manual(name: string) {
  return strapi.documents(USER).create({ data: { ...dto(name), sourceExternalId: undefined, protected: false, roles: [roleId] } });
}
before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await runtime.compileStrapi({ appDir });
  assert.ok(compiled.distDir); compiledDir = compiled.distDir;
  strapi = await runtime.createStrapi(compiled).load(); strapi.cron?.destroy();
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  roleId = (await strapi.documents("api::role.role").create({ data: { name: "Human role" } })).documentId;
  const { registerIdentitySource } = require(path.join(compiledDir, "src/iam/identity/source-registration")) as typeof import("../src/iam/identity/source-registration");
  const { resolveSourcePrincipal } = require(path.join(compiledDir, "src/iam/identity/source-principal")) as typeof import("../src/iam/identity/source-principal");
  for (const name of ["first", "second"]) {
    const source = await registerIdentitySource(strapi, { name, username: `${name}-service`, email: `${name}-service@identity.test`, displayName: name });
    const principal = await resolveSourcePrincipal(strapi, source.documentId); assert.ok(principal);
    if (name === "first") first = principal; else second = principal;
  }
  service = (require(path.join(compiledDir, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
});
after(async () => {
  await strapi?.destroy(); await remote?.close();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

test("scoped create/patch and correlation reads preserve roles and project only approved fields", async () => {
  const human = await manual("manual");
  const owned = value(await service.createFromSource(first, { ...dto("owned", " 001Ab "), employeeNumber: "007", department: "HR" }));
  const foreign = value(await service.createFromSource(second, dto("foreign", " 001Ab ")));
  const protectedUser = await manual("protected");
  const { runManualProtection } = require(path.join(compiledDir, "src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
  await runManualProtection(strapi, protectedUser.documentId, true);
  assert.equal(value(await service.readForSource(first, human.documentId)).sourceExternalId, undefined);
  assert.equal(owned.sourceExternalId, " 001Ab ");
  assert.deepEqual((await strapi.documents(USER).findOne({ documentId: owned.documentId, populate: { roles: true } }))?.roles, []);
  for (const id of [foreign.documentId, protectedUser.documentId, "missing"]) {
    assert.deepEqual(await service.readForSource(first, id), { ok: false, code: "notFound" });
    assert.deepEqual(await service.patchFromSource(first, id, { department: "Other" }), { ok: false, code: "notFound" });
    assert.deepEqual(await service.replaceFromSource(first, id, dto("hidden-write")), { ok: false, code: "notFound" });
    assert.deepEqual(await service.deactivateFromSource(first, id, true), { ok: false, code: "notFound" });
  }
  assert.deepEqual(await service.patchFromSource(first, human.documentId, { department: "Other" }), { ok: false, code: "notFound" });
  assert.deepEqual(await service.createFromSource(first, { ...dto("manual"), sourceExternalId: "new-key" }), { ok: false, code: "uniqueness" });
  await strapi.documents(USER).update({ documentId: owned.documentId, data: { roles: [roleId] } });
  value(await service.patchFromSource(first, { sourceExternalId: " 001Ab " }, { department: "Engineering" }));
  const stored = await strapi.documents(USER).findOne({ documentId: owned.documentId, populate: { roles: true } });
  assert.equal(stored?.department, "Engineering"); assert.equal(stored?.employeeNumber, "007");
  assert.deepEqual(stored?.roles?.map((role) => role.documentId), [roleId]);
  assert.ok(stored?.lastSyncedAt);
  const allowed = ["documentId", "username", "email", "firstName", "lastName", "displayName", "accountStatus", "sourceExternalId", "employeeNumber", "department", "jobTitle"];
  const all = value(await service.listForSource(first, { start: 0, limit: 1 }));
  assert.equal(all.total, 2); assert.equal(all.items.length, 1);
  assert.ok(all.items.every((item) => Object.keys(item).every((key) => allowed.includes(key))));
  const next = value(await service.listForSource(first, { start: 1, limit: 1 }));
  assert.equal(next.total, 2); assert.equal(next.items.length, 1);
  assert.notEqual(next.items[0].documentId, all.items[0].documentId);
  assert.equal(value(await service.listForSource(first, { start: 2, limit: 1 })).items.length, 0);
  assert.equal(value(await service.listForSource(first, { filter: { field: "email", eq: "foreign@identity.test" } })).total, 0);
  assert.equal(value(await service.listForSource(first, { filter: { and: [{ field: "employeeNumber", eq: "007" }, { field: "department", eq: "Engineering" }] } })).total, 1);
  assert.deepEqual(await service.listForSource(first, { filter: { field: "password", eq: "secret" } } as never), { ok: false, code: "invalidInput" });
  assert.deepEqual(await service.createFromSource(first, { ...dto("overgrant"), roles: [roleId] } as never), { ok: false, code: "invalidInput" });
  assert.deepEqual(await service.readForSource({ ...first }, human.documentId), { ok: false, code: "forbidden" });
});

test("persisted principal revocation is checked on every operation", async () => {
  await strapi.documents("api::identity-source.identity-source").update({ documentId: second.sourceDocumentId, data: { sourceStatus: "inactive" } });
  assert.deepEqual(await service.listForSource(second), { ok: false, code: "forbidden" });
  assert.deepEqual(await service.createFromSource(second, dto("revoked")), { ok: false, code: "forbidden" });
  assert.deepEqual(await service.readForSource(second, "missing"), { ok: false, code: "forbidden" });
  assert.deepEqual(await service.patchFromSource(second, "missing", {}), { ok: false, code: "forbidden" });
  assert.deepEqual(await service.replaceFromSource(second, "missing", dto("revoked")), { ok: false, code: "forbidden" });
  assert.deepEqual(await service.deactivateFromSource(second, "missing"), { ok: false, code: "forbidden" });
  await strapi.documents("api::identity-source.identity-source").update({ documentId: second.sourceDocumentId, data: { sourceStatus: "active" } });
});

test("development reseed preserves a claimed fixture's HR values, roles, subject and references", async () => {
  const jane = await strapi.documents(USER).create({ data: { username: "jane.doe", email: "jane.doe@idambox.com",
    externalSubject: DEVELOPMENT_FIXTURE_SUBJECTS["jane.doe@idambox.com"],
    displayName: "Original", accountStatus: "active", protected: false, roles: [roleId] } });
  const bob = await strapi.documents(USER).create({ data: { username: "bob.doe", email: "bob.doe@idambox.com",
    externalSubject: DEVELOPMENT_FIXTURE_SUBJECTS["bob.doe@idambox.com"],
    displayName: "Original Bob", accountStatus: "active", protected: false, roles: [roleId] } });
  const { runSourceMutation } = require(path.join(compiledDir, "src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
  await runSourceMutation(strapi, first, "replace", jane.documentId, () => strapi.documents(USER).update({ documentId: jane.documentId,
    data: { ...dto("hr-jane", "jane-hr"), displayName: "HR Name", department: "HR Dept",
      identitySource: first.sourceDocumentId, lastSyncedAt: "2026-10-14T00:00:00.000Z" } }));
  await runSourceMutation(strapi, first, "replace", bob.documentId, () => strapi.documents(USER).update({ documentId: bob.documentId,
    data: { ...dto("hr-bob", "bob-hr"), displayName: "HR Bob", accountStatus: "inactive", jobTitle: "HR Title",
      identitySource: first.sourceDocumentId, lastSyncedAt: "2026-10-14T00:00:00.000Z" } }));
  const beforeSeed = await strapi.documents(USER).findOne({ documentId: jane.documentId, populate: { roles: true, identitySource: true } });
  const bobBeforeSeed = await strapi.documents(USER).findOne({ documentId: bob.documentId, populate: { roles: true, identitySource: true } });
  const system = await strapi.documents("api::csrm-information-system.csrm-information-system").create({ data: {
    name: "Claimed fixture reference", environment: "Production", lifecycleState: "Existing", systemStatus: "Active", owner: jane.documentId,
  } });
  const { seedCsrmData } = require(path.join(compiledDir, "src/bootstrap/seed-csrm-data")) as typeof import("../src/bootstrap/seed-csrm-data");
  process.env.IDAMBOX_SEED_CSRM = "true";
  try { await seedCsrmData(strapi); await seedCsrmData(strapi); }
  finally { process.env.IDAMBOX_SEED_CSRM = "false"; }
  const afterSeed = await strapi.documents(USER).findOne({ documentId: jane.documentId, populate: { roles: true, identitySource: true } });
  assert.deepEqual(afterSeed, beforeSeed);
  assert.deepEqual(await strapi.documents(USER).findOne({ documentId: bob.documentId, populate: { roles: true, identitySource: true } }), bobBeforeSeed);
  assert.equal(await strapi.documents(USER).count({ filters: { username: { $in: ["jane.doe", "bob.doe"] } } }), 0);
  const retained = await strapi.documents("api::csrm-information-system.csrm-information-system").findOne({ documentId: system.documentId, populate: { owner: true } });
  assert.equal(retained?.owner?.documentId, jane.documentId);
  // Reuse of a fixture's old email by another person must never select a
  // different document over the stable fixture subject on a later seed.
  await strapi.documents(USER).create({ data: { username: "new-person", email: "jane.doe@idambox.com",
    displayName: "New person", accountStatus: "active", protected: false } });
  process.env.IDAMBOX_SEED_CSRM = "true";
  try { await assert.rejects(seedCsrmData(strapi), /CSRM_FIXTURE_IDENTITY_CONFLICT/); }
  finally { process.env.IDAMBOX_SEED_CSRM = "false"; }
  assert.deepEqual(await strapi.documents(USER).findOne({ documentId: jane.documentId, populate: { roles: true, identitySource: true } }), beforeSeed);
});

test("explicit PUT claims once, replay preserves roles and full replacement clears only optional HR fields", async () => {
  const human = await manual("claim");
  await strapi.documents(USER).update({ documentId: human.documentId, data: { employeeNumber: "old", department: "old", jobTitle: "old" } });
  const replacement = dto("claim", " 000Ab ");
  value(await service.replaceFromSource(first, human.documentId, replacement));
  const claimed = await strapi.documents(USER).findOne({ documentId: human.documentId, populate: { roles: true, identitySource: true } });
  assert.equal(claimed?.identitySource?.documentId, first.sourceDocumentId);
  assert.equal(claimed?.sourceExternalId, " 000Ab ");
  assert.equal(claimed?.employeeNumber, null); assert.equal(claimed?.department, null); assert.equal(claimed?.jobTitle, null);
  assert.deepEqual(claimed?.roles?.map((role) => role.documentId), [roleId]);
  const oldSynced = claimed?.lastSyncedAt;
  await new Promise((resolve) => setTimeout(resolve, 5));
  value(await service.replaceFromSource(first, { sourceExternalId: " 000Ab " }, { ...replacement, department: "Moved" }));
  const replay = await strapi.documents(USER).findOne({ documentId: human.documentId, populate: { roles: true } });
  assert.notEqual(replay?.lastSyncedAt, oldSynced); assert.equal(replay?.department, "Moved");
  assert.deepEqual(replay?.roles?.map((role) => role.documentId), [roleId]);
  assert.deepEqual(await service.replaceFromSource(second, human.documentId, replacement), { ok: false, code: "notFound" });
  assert.deepEqual(await service.replaceFromSource(first, human.documentId, { ...replacement, sourceExternalId: "other-key" }), { ok: false, code: "immutableSourceKey" });
  assert.deepEqual(await service.patchFromSource(first, human.documentId, { sourceExternalId: "other-key" }), { ok: false, code: "immutableSourceKey" });
  assert.deepEqual(await service.replaceFromSource(first, { sourceExternalId: "missing-key" }, dto("missing-tuple")), { ok: false, code: "notFound" });
});

test("competing source claims, same-source key claims and duplicate tuples have exactly one persisted winner", async () => {
  const human = await manual("race-human");
  const results = await Promise.all([
    service.replaceFromSource(first, human.documentId, dto("race-human", "first-key")),
    service.replaceFromSource(second, human.documentId, dto("race-human", "second-key")),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.deepEqual(results.find((result) => !result.ok), { ok: false, code: "notFound" });
  const sameSource = await manual("race-keys");
  const keys = await Promise.all(["key-1", "key-2"].map((key) => service.replaceFromSource(first, sameSource.documentId, dto("race-keys", key))));
  assert.equal(keys.filter((result) => result.ok).length, 1);
  assert.deepEqual(keys.find((result) => !result.ok), { ok: false, code: "immutableSourceKey" });
  const targets = await Promise.all(["tuple-a", "tuple-b"].map(manual));
  // Disable only the test instance's friendly tuple preflight: the real unique
  // database index must arbitrate both duplicate claims and duplicate creates.
  const tupleAttribute: { unique?: boolean } = strapi.contentTypes[USER].attributes.sourceIdentityKey;
  const originalUnique = tupleAttribute.unique;
  tupleAttribute.unique = false;
  try {
    const duplicates = await Promise.all(targets.map((target, index) => service.replaceFromSource(first, target.documentId, dto(index === 0 ? "tuple-a" : "tuple-b", "duplicate-tuple"))));
    assert.equal(duplicates.filter((result) => result.ok).length, 1);
    assert.deepEqual(duplicates.find((result) => !result.ok), { ok: false, code: "uniqueness" });
    const loser = targets[duplicates.findIndex((result) => !result.ok)];
    assert.equal((await strapi.documents(USER).findOne({ documentId: loser.documentId, populate: { identitySource: true } }))?.identitySource, null);
    const creates = await Promise.all(["duplicate-a", "duplicate-b"].map((name) => service.createFromSource(first, dto(name, "duplicate-create"))));
    assert.equal(creates.filter((result) => result.ok).length, 1);
    assert.deepEqual(creates.find((result) => !result.ok), { ok: false, code: "uniqueness" });
    assert.equal(strapi.db.inTransaction(), false);
  } finally { tupleAttribute.unique = originalUnique; }
});

test("owned deletion retains tuple, roles and references; repeated deletion is safe and cannot restore", async () => {
  const human = await manual("leaver");
  value(await service.replaceFromSource(first, human.documentId, dto("leaver", "leaver-key")));
  const reference = await strapi.documents("api::csrm-information-system.csrm-information-system").create({ data: {
    name: "Leaver reference", environment: "Production", lifecycleState: "Existing", systemStatus: "Active", owner: human.documentId,
  } });
  const manualTarget = await manual("unowned-delete");
  assert.deepEqual(await service.deactivateFromSource(first, manualTarget.documentId, true), { ok: false, code: "notFound" });
  assert.deepEqual(await service.deactivateFromSource(second, human.documentId, true), { ok: false, code: "notFound" });
  value(await service.deactivateFromSource(first, human.documentId));
  assert.equal(value(await service.readForSource(first, human.documentId)).accountStatus, "inactive");
  value(await service.deactivateFromSource(first, { sourceExternalId: "leaver-key" }, true));
  const deleted = await strapi.documents(USER).findOne({ documentId: human.documentId, populate: { roles: true, identitySource: true } });
  assert.ok(deleted?.sourceDeletedAt); assert.equal(deleted.accountStatus, "inactive");
  value(await service.deactivateFromSource(first, human.documentId, true));
  const repeated = await strapi.documents(USER).findOne({ documentId: human.documentId, populate: { roles: true, identitySource: true } });
  assert.equal(repeated?.sourceDeletedAt, deleted.sourceDeletedAt); assert.equal(repeated?.sourceIdentityKey, deleted.sourceIdentityKey);
  assert.deepEqual(repeated?.roles?.map((role) => role.documentId), [roleId]);
  assert.equal(repeated?.identitySource?.documentId, first.sourceDocumentId);
  assert.deepEqual(await service.readForSource(first, human.documentId), { ok: false, code: "notFound" });
  assert.equal(value(await service.listForSource(first, { filter: { field: "email", eq: "leaver@identity.test" } })).total, 0);
  assert.deepEqual(await service.patchFromSource(first, human.documentId, { accountStatus: "active" }), { ok: false, code: "notFound" });
  assert.deepEqual(await service.replaceFromSource(first, human.documentId, dto("leaver", "leaver-key")), { ok: false, code: "notFound" });
  assert.deepEqual(await service.createFromSource(first, dto("resurrection", "leaver-key")), { ok: false, code: "uniqueness" });
  const retained = await strapi.documents("api::csrm-information-system.csrm-information-system").findOne({ documentId: reference.documentId, populate: { owner: true } });
  assert.equal(retained?.owner?.documentId, human.documentId);
  await assert.rejects(strapi.documents(USER).delete({ documentId: human.documentId }), /IAM_IDENTITY_FORBIDDEN/);
});

test("blocking Keycloak failure rolls back a manual claim and HR update, returning only the safe outcome", async () => {
  const human = await manual("remote-claim");
  const { createIdamboxUserProvisioningMiddleware } = require(path.join(compiledDir, "src/keycloak/register-idambox-user-provisioning")) as typeof import("../src/keycloak/register-idambox-user-provisioning");
  const { KeycloakAdminClient: CompiledClient } = require(path.join(compiledDir, "src/keycloak/admin-client")) as typeof import("../src/keycloak/admin-client");
  remote = await startFakeKeycloakServer();
  strapi.documents.use(createIdamboxUserProvisioningMiddleware(strapi, new CompiledClient({
    baseUrl: remote.baseUrl, realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
    adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000,
  })));
  remote.failNext("GET /admin/realms/idambox/users", { status: 503, body: "private upstream detail" });
  assert.deepEqual(await service.replaceFromSource(first, human.documentId, { ...dto("remote-claim", "remote-key"), department: "New" }),
    { ok: false, code: "keycloakUnavailable", retryAfterSeconds: 30 });
  const unchanged = await strapi.documents(USER).findOne({ documentId: human.documentId, populate: { identitySource: true, roles: true } });
  assert.equal(unchanged?.identitySource, null); assert.equal(unchanged?.sourceExternalId, null);
  assert.equal(unchanged?.sourceIdentityKey, null); assert.equal(unchanged?.department, null); assert.equal(unchanged?.lastSyncedAt, null);
  assert.deepEqual(unchanged?.roles?.map((role) => role.documentId), [roleId]);
  value(await service.replaceFromSource(first, human.documentId, dto("remote-claim", "remote-key")));
  const linked = await strapi.documents(USER).findOne({ documentId: human.documentId });
  assert.ok(linked?.externalSubject); assert.equal(linked.password, null);
  remote.failNext("PUT /admin/realms/idambox/users", { status: 503 });
  assert.deepEqual(await service.patchFromSource(first, human.documentId, { displayName: "Failed mover" }), { ok: false, code: "keycloakUnavailable", retryAfterSeconds: 30 });
  assert.equal((await strapi.documents(USER).findOne({ documentId: human.documentId }))?.displayName, "remote-claim");
});

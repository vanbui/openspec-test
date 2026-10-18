import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import {
  assertIdentityDatabaseInvariants,
  ensureIdentityDatabaseInvariants,
  identityDatabaseLayout,
} from "../src/iam/identity/database-invariants";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-invariants-${process.pid}`);
const databaseFilename = path.join(fixtureDir, "reused.sqlite");
const legacyDist = path.join(fixtureDir, "legacy-dist");
const constraintDist = path.join(fixtureDir, "constraint-dist");
const environment = {
  APP_KEYS: "iam-test-key-1,iam-test-key-2", ADMIN_JWT_SECRET: "iam-test-admin",
  API_TOKEN_SALT: "iam-test-api", TRANSFER_TOKEN_SALT: "iam-test-transfer",
  ENCRYPTION_KEY: "iam-test-encryption", JWT_SECRET: "iam-test-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, databaseFilename),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const originalEnvironment = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi | undefined;
let compiled: { appDir: string; distDir: string };
let legacyUserId: string;
let legacyRoleId: string;
let legacyRequestId: string;
const runtime = require("@strapi/strapi") as {
  compileStrapi(options: { appDir: string }): Promise<{ appDir: string; distDir: string }>;
  createStrapi(options: { appDir: string; distDir: string }): Core.Strapi;
};

async function boot(distDir = compiled.distDir) {
  strapi = runtime.createStrapi({ appDir, distDir });
  await strapi.load();
  strapi.cron?.destroy();
  return strapi;
}
async function close() {
  if (strapi) { await strapi.destroy(); strapi = undefined; }
}
function current() { assert.ok(strapi); return strapi; }
function newUser(suffix: string) {
  return { username: suffix, email: `${suffix}@idambox.test`, displayName: suffix, accountStatus: "active" as const, protected: false };
}
async function race(actions: (() => Promise<unknown>)[]) {
  const outcomes = await Promise.allSettled(actions.map((action) => action()));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, actions.length - 1);
}

before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  compiled = await runtime.compileStrapi({ appDir });
  // Physical-index tests intentionally use a schema-only application. Workflow
  // authority is exercised by the ownership suite, never relaxed in production.
  await cp(compiled.distDir, constraintDist, { recursive: true });
  await writeFile(path.join(constraintDist, "config/database.js"),
    `module.exports = require(${JSON.stringify(path.join(compiled.distDir, "config/database.js"))});\n`);
  await writeFile(path.join(constraintDist, "src/index.js"),
    'const { ensureIdentityDatabaseInvariants } = require("./iam/identity/database-invariants");\nmodule.exports = { register() {}, bootstrap({ strapi }) { return ensureIdentityDatabaseInvariants(strapi); } };\n');
  // Isolated compiled legacy application: no edits to tracked schemas or node_modules.
  await cp(compiled.distDir, legacyDist, { recursive: true });
  // Keep the database config's __dirname anchored to the real app root in both boots.
  await writeFile(path.join(legacyDist, "config/database.js"),
    `module.exports = require(${JSON.stringify(path.join(compiled.distDir, "config/database.js"))});\n`);
  const userSchemaPath = path.join(legacyDist, "src/api/idambox-user/content-types/idambox-user/schema.json");
  const userSchema = JSON.parse(await readFile(userSchemaPath, "utf8"));
  for (const field of ["identitySource", "sourceExternalId", "sourceIdentityKey", "employeeNumber", "department", "jobTitle", "sourceDeletedAt", "lastSyncedAt", "protected"]) delete userSchema.attributes[field];
  await writeFile(userSchemaPath, JSON.stringify(userSchema));
  await rm(path.join(legacyDist, "src/api/identity-source"), { recursive: true, force: true });
  await rm(path.join(legacyDist, "src/api/keycloak-sync-outbox"), { recursive: true, force: true });
  await writeFile(path.join(legacyDist, "src/index.js"), "module.exports = { register() {}, bootstrap() {} };\n");
  await boot(legacyDist);
  const legacy = current();
  const role = await legacy.documents("api::role.role").create({ data: { name: "Legacy reviewer" } });
  const user = await legacy.documents(USER).create({ data: { ...newUser("legacy-person"), externalSubject: "legacy-subject", roles: [role.documentId] } });
  const request = await legacy.documents("api::csrm-assessment-request.csrm-assessment-request").create({ data: {
    requestNumber: "IAM-LEGACY-001", title: "Legacy request", requestStatus: "draft", requestor: user.documentId,
  } });
  legacyUserId = user.documentId; legacyRoleId = role.documentId; legacyRequestId = request.documentId;
  await close();
});

after(async () => {
  await close();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("legacy schema migration preserves identity, roles and CSRM references", async () => {
  await boot();
  const instance = current();
  await assertIdentityDatabaseInvariants(instance);
  const user = await instance.documents(USER).findOne({ documentId: legacyUserId, populate: { roles: true, identitySource: true } });
  assert.ok(user);
  assert.equal(user.externalSubject, "legacy-subject");
  assert.equal(user.protected ?? false, false);
  for (const field of ["identitySource", "sourceExternalId", "sourceIdentityKey", "employeeNumber", "department", "jobTitle", "sourceDeletedAt", "lastSyncedAt"] as const) assert.equal(user[field] ?? null, null);
  assert.deepEqual(user.roles?.map((role) => role.documentId), [legacyRoleId]);
  const request = await instance.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: legacyRequestId, populate: { requestor: true } });
  assert.equal(request?.requestor?.documentId, legacyUserId);
});

async function proveConstraints(label: string) {
  const instance = current();
  await assertIdentityDatabaseInvariants(instance);
  const service = await instance.documents(USER).create({ data: { ...newUser(`${label}-service`), protected: true } });
  // Actual Document Service relation binds race; pair uniqueness alone lets both succeed.
  await race([1, 2].map((n) => () => instance.documents(SOURCE).create({ data: { name: `${label}-source-${n}`, sourceStatus: "active", serviceUser: service.documentId } })));
  const [source] = await instance.documents(SOURCE).findMany({ filters: { serviceUser: { documentId: service.documentId } } });
  assert.ok(source);
  const key = createHash("sha256").update(JSON.stringify([source.documentId, "Exact Key"])).digest("hex");
  await race([1, 2].map((n) => () => instance.documents(USER).create({ data: {
    ...newUser(`${label}-sourced-${n}`), identitySource: source.documentId, sourceExternalId: "Exact Key", sourceIdentityKey: key,
  } })));
  const [person] = await instance.documents(USER).findMany({ filters: { sourceIdentityKey: key } });
  assert.ok(person);
  const work = { userDocumentId: person.documentId, idamboxUser: person.documentId, operation: "disableAndEndSessions" as const, syncStatus: "pending" as const, generation: 1, attempts: 0, nextAttemptAt: new Date().toISOString() };
  await race([1, 2].map(() => () => instance.documents(OUTBOX).create({ data: work })));
  const layout = identityDatabaseLayout(instance);
  const [outbox] = await instance.documents(OUTBOX).findMany({ filters: { userDocumentId: person.documentId } });
  assert.ok(outbox);
  // Different durable work keys still cannot share the same physical relation target.
  const other = await instance.documents(USER).create({ data: newUser(`${label}-other`) });
  const second = await instance.documents(OUTBOX).create({ data: { ...work, userDocumentId: other.documentId, idamboxUser: other.documentId } });
  await assert.rejects(instance.db.getConnection(layout.outboxUser.name)
    .where(layout.outboxUser.joinColumn.name, second.id)
    .update({ [layout.outboxUser.inverseJoinColumn.name]: person.id }));
  // Corrupt relation/key disagreement is detected before a boot can seed or deliver work.
  await instance.documents(OUTBOX).update({ documentId: second.documentId, data: { userDocumentId: service.documentId } });
  await assert.rejects(ensureIdentityDatabaseInvariants(instance), /IAM_DATABASE_OUTBOX_USER_MISMATCH/);
  await instance.documents(OUTBOX).update({ documentId: second.documentId, data: { userDocumentId: other.documentId } });
  await assertIdentityDatabaseInvariants(instance);
  console.info(`${label} physical identity constraints: ${JSON.stringify(layout.uniqueColumns)}`);
}

test("reused database rejects concurrent source targets, source keys and outbox keys", async () => {
  await close();
  await boot(constraintDist);
  await proveConstraints("reused");
});

test("a second schema-sync boot restores inverse-target indexes and preserves legacy users", async () => {
  const instance = current();
  // Model a schema-sync removal: bootstrap must restore these on every boot.
  for (const invariant of identityDatabaseLayout(instance).uniqueColumns.slice(2)) {
    await instance.db.getSchemaConnection().alterTable(invariant.table, (table) => table.dropUnique([invariant.column], invariant.index));
  }
  await assert.rejects(assertIdentityDatabaseInvariants(instance), /IAM_DATABASE_UNIQUE_INDEX_MISSING/);
  await close();
  await boot(constraintDist);
  await proveConstraints("restart");
  const user = await current().documents(USER).findOne({ documentId: legacyUserId, populate: { roles: true } });
  assert.equal(user?.externalSubject, "legacy-subject");
  assert.deepEqual(user?.roles?.map((role) => role.documentId), [legacyRoleId]);
});

test("a fresh database enforces the same physical constraints", async () => {
  await close();
  process.env.DATABASE_FILENAME = path.relative(appDir, path.join(fixtureDir, "fresh.sqlite"));
  await boot(constraintDist);
  await proveConstraints("fresh");
});

test("conflicting persisted targets fail closed without choosing a winner", async () => {
  const instance = current();
  const layout = identityDatabaseLayout(instance);
  const invariant = layout.uniqueColumns[2];
  const service = await instance.documents(USER).create({ data: { ...newUser("conflict-service"), protected: true } });
  const sources = await Promise.all([1, 2].map((n) => instance.documents(SOURCE).create({ data: { name: `conflict-source-${n}`, sourceStatus: "active", serviceUser: service.documentId } }).catch(() => null)));
  const winner = sources.find((source) => source !== null); assert.ok(winner);
  const otherService = await instance.documents(USER).create({ data: { ...newUser("conflict-other"), protected: true } });
  const otherSource = await instance.documents(SOURCE).create({ data: { name: "conflict-existing", sourceStatus: "active", serviceUser: otherService.documentId } });
  await instance.db.getSchemaConnection().alterTable(invariant.table, (table) => table.dropUnique([invariant.column], invariant.index));
  await instance.db.getConnection(invariant.table).where(layout.sourceServiceUser.joinColumn.name, otherSource.id).update({ [invariant.column]: service.id });
  await assert.rejects(ensureIdentityDatabaseInvariants(instance), /IAM_DATABASE_DUPLICATE_IDENTITY_BINDING/);
  const rows = await instance.db.getConnection(invariant.table).where(invariant.column, service.id);
  assert.equal(rows.length, 2, "conflicting bindings are neither deleted nor reassigned");
  await instance.db.getConnection(invariant.table).where(layout.sourceServiceUser.joinColumn.name, otherSource.id).update({ [invariant.column]: otherService.id });
  await ensureIdentityDatabaseInvariants(instance);
});

import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type * as TokenService from "../src/iam/scim/token-service";

const SOURCE = "api::identity-source.identity-source";
const USER = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-scim-auth-${process.pid}`);
const environment = {
  APP_KEYS: "scim-test-1,scim-test-2", ADMIN_JWT_SECRET: "scim-test-admin", API_TOKEN_SALT: "scim-test-api",
  TRANSFER_TOKEN_SALT: "scim-test-transfer", ENCRYPTION_KEY: "scim-test-encryption", JWT_SECRET: "scim-test-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "tokens.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false", CSRM_AUTH_OIDC_ENABLED: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi;
let tokens: typeof TokenService;
let register: typeof import("../src/iam/identity/source-registration").registerIdentitySource;
let sequence = 0;
const events: string[] = [];
let originalInfo: Core.Strapi["log"]["info"];
let failPersistence = false;
let auth: typeof import("../src/iam/scim/source-context");
let policy: typeof import("../src/policies/scim-source-bearer").default;
let csrmPolicy: typeof import("../src/policies/csrm-authorization").default;
let fnId: string;
let applicationId: string;
const operation = "GET:/scim/v2/Users";
const errors: string[] = [];
let originalError: Core.Strapi["log"]["error"];
function context(token?: string) { return { request: { header: { authorization: token ? `Bearer ${token}` : undefined } }, state: {} }; }
async function authorizedSource() {
  const item = await source();
  const token = plaintext(await tokens.administerSourceToken(strapi, item.documentId));
  return { item, token };
}
function status(result: Awaited<ReturnType<typeof auth.authenticateSourceRequest>>) {
  assert.equal(result.ok, false); if (result.ok) throw new Error("Expected refusal"); return result.error.status;
}
async function source() {
  const name = `token-source-${++sequence}`;
  return register(strapi, { name, username: `${name}-service`, email: `${name}@token.test`, displayName: name });
}
async function read(documentId: string) {
  const row = await strapi.documents(SOURCE).findOne({ documentId, populate: { serviceUser: true } });
  assert.ok(row); return row;
}
function plaintext(result: TokenService.SourceTokenResult): string {
  assert.notEqual(result.action, "revoke");
  assert.ok("token" in result); return result.token;
}
before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await runtime.compileStrapi({ appDir });
  assert.ok(compiled.distDir);
  strapi = await runtime.createStrapi(compiled).load(); strapi.cron?.destroy();
  tokens = require(path.join(compiled.distDir, "src/iam/scim/token-service")) as typeof TokenService;
  register = (require(path.join(compiled.distDir, "src/iam/identity/source-registration")) as typeof import("../src/iam/identity/source-registration")).registerIdentitySource;
  auth = require(path.join(compiled.distDir, "src/iam/scim/source-context"));
  policy = require(path.join(compiled.distDir, "src/policies/scim-source-bearer")).default;
  csrmPolicy = require(path.join(compiled.distDir, "src/policies/csrm-authorization")).default;
  originalError = strapi.log.error;
  strapi.log.error = ((message: unknown) => { errors.push(String(message)); }) as typeof originalError;
  const api = await strapi.documents("api::function-api.function-api").create({ data: { name: "SCIM list", url: operation } });
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId, functionApis: [api.documentId] } });
  await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  fnId = fn.documentId; applicationId = application.documentId;
  originalInfo = strapi.log.info;
  strapi.log.info = ((message: unknown) => { events.push(String(message)); }) as typeof originalInfo;
  strapi.documents.use(async (context, next) => {
    const result = await next();
    if (failPersistence && context.uid === SOURCE && context.action === "update") throw new Error("TEST_PERSISTENCE_FAILURE");
    return result;
  });
});
after(async () => {
  if (strapi && originalInfo) strapi.log.info = originalInfo;
  if (strapi && originalError) strapi.log.error = originalError;
  await strapi?.destroy();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

test("persisted valid bearer records activity before grant denial and leaves sync/token metadata untouched", async () => {
  const { item, token } = await authorizedSource();
  const before = await read(item.documentId);
  const ctx = context(token); const start = Date.now();
  const result = await auth.authenticateSourceRequest(strapi, ctx); assert.ok(result.ok);
  assert.equal(result.value.sourceDocumentId, item.documentId);
  assert.equal(await policy(ctx, { operation }, { strapi }), true);
  await assert.rejects(policy(ctx, { operation: "POST:/scim/v2/Users" }, { strapi }), { status: 403 });
  const row = await read(item.documentId);
  assert.ok(row.lastActivityAt); assert.ok(Date.parse(String(row.lastActivityAt)) >= start);
  assert.equal(row.serviceUser!.lastSyncedAt, before.serviceUser!.lastSyncedAt);
  assert.equal(row.tokenRotatedAt, before.tokenRotatedAt); assert.equal(row.tokenHash, before.tokenHash);
  assert.deepEqual(ctx.state, {});
});
test("activity survives later bad payload, missing target, source throttling and real user transaction rollback", async () => {
  const { item, token } = await authorizedSource();
  const initial = await auth.authenticateSourceRequest(strapi, context(token)); assert.ok(initial.ok);
  const service = (require(path.join(strapi.dirs.dist.root, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
  const created = await service.createFromSource(initial.value, { username: "rollback-person", email: "rollback@auth.test", displayName: "Before", accountStatus: "active", sourceExternalId: "rollback-person" });
  assert.ok(created.ok); const person = created.value;
  const personBefore = await strapi.documents(USER).findOne({ documentId: person.documentId }); assert.ok(personBefore);
  for (const laterStatus of [400, 404, 429]) {
    await strapi.documents(SOURCE).update({ documentId: item.documentId, data: { lastActivityAt: "2000-01-01T00:00:00.000Z" } });
    const before = await read(item.documentId);
    const ctx = context(token); assert.ok((await auth.authenticateSourceRequest(strapi, ctx)).ok);
    assert.equal(await policy(ctx, { operation }, { strapi }), true);
    await assert.rejects(strapi.db.transaction(async () => {
      const principal = auth.getSourceContext(strapi, ctx); assert.ok(principal);
      assert.ok((await service.patchFromSource(principal, person.documentId, { displayName: "Rollback" })).ok);
      throw Object.assign(new Error("LATER_FAILURE"), { status: laterStatus });
    }), { status: laterStatus });
    const after = await read(item.documentId);
    assert.notEqual(after.lastActivityAt, before.lastActivityAt);
    assert.equal(after.serviceUser!.lastSyncedAt, before.serviceUser!.lastSyncedAt);
    assert.deepEqual(await strapi.documents(USER).findOne({ documentId: person.documentId }), personBefore);
  }
});
test("rotation, revocation, inactive binding and revoked operation take effect on the next request", async () => {
  const { item, token } = await authorizedSource();
  assert.ok((await auth.authenticateSourceRequest(strapi, context(token))).ok);
  const rotated = plaintext(await tokens.administerSourceToken(strapi, item.documentId, "rotate"));
  let before = await read(item.documentId);
  assert.equal(status(await auth.authenticateSourceRequest(strapi, context(token))), 401);
  assert.deepEqual(await read(item.documentId), before);
  assert.ok((await auth.authenticateSourceRequest(strapi, context(rotated))).ok);
  const fn = await strapi.documents("api::function.function").findOne({ documentId: fnId, populate: { functionApis: true } });
  assert.ok(fn);
  await strapi.documents("api::function.function").update({ documentId: fnId, data: { functionApis: [] } });
  try {
    const ctx = context(rotated); assert.ok((await auth.authenticateSourceRequest(strapi, ctx)).ok);
    await assert.rejects(policy(ctx, { operation }, { strapi }), { status: 403 });
  } finally { await strapi.documents("api::function.function").update({ documentId: fnId, data: { functionApis: fn.functionApis!.map(api => api.documentId) } }); }
  await strapi.documents(SOURCE).update({ documentId: item.documentId, data: { sourceStatus: "inactive" } });
  before = await read(item.documentId);
  assert.equal(status(await auth.authenticateSourceRequest(strapi, context(rotated))), 401);
  assert.deepEqual(await read(item.documentId), before);
  await tokens.administerSourceToken(strapi, item.documentId, "revoke"); before = await read(item.documentId);
  assert.equal(status(await auth.authenticateSourceRequest(strapi, context(rotated))), 401);
  assert.deepEqual(await read(item.documentId), before);
});
test("inactive service/application and corrupted unique binding refuse without activity", async () => {
  const { item, token } = await authorizedSource();
  const row = await read(item.documentId); const serviceId = row.serviceUser!.documentId;
  const userMetadata = strapi.db.metadata.get(USER);
  const statusAttribute = userMetadata.attributes.accountStatus;
  assert.ok("columnName" in statusAttribute && statusAttribute.columnName);
  // Deliberately corrupt the isolated service; normal Document Service writers enforce this invariant.
  await strapi.db.getConnection(userMetadata.tableName).where({ document_id: serviceId }).update({ [statusAttribute.columnName]: "inactive" });
  assert.equal(status(await auth.authenticateSourceRequest(strapi, context(token))), 401);
  assert.equal((await read(item.documentId)).lastActivityAt, row.lastActivityAt);
  await strapi.db.getConnection(userMetadata.tableName).where({ document_id: serviceId }).update({ [statusAttribute.columnName]: "active" });
  const applicationMetadata = strapi.db.metadata.get("api::application.application");
  const appStatus = applicationMetadata.attributes.applicationStatus;
  assert.ok("columnName" in appStatus && appStatus.columnName);
  await strapi.db.getConnection(applicationMetadata.tableName).where({ document_id: applicationId }).update({ [appStatus.columnName]: "inactive" });
  try { assert.equal(status(await auth.authenticateSourceRequest(strapi, context(token))), 401); }
  finally { await strapi.db.getConnection(applicationMetadata.tableName).where({ document_id: applicationId }).update({ [appStatus.columnName]: "active" }); }
  const attribute = strapi.db.metadata.get(SOURCE).attributes.serviceUser;
  assert.ok(attribute.type === "relation" && "joinTable" in attribute && attribute.joinTable);
  const join = attribute.joinTable;
  // Corrupt only the isolated fixture: ordinary writers forbid removing this binding.
  const links = await strapi.db.getConnection(join.name).where(join.joinColumn.name, item.id).select("*");
  await strapi.db.getConnection(join.name).where(join.joinColumn.name, item.id).delete();
  try {
    assert.equal(status(await auth.authenticateSourceRequest(strapi, context(token))), 401);
    assert.equal((await read(item.documentId)).lastActivityAt, row.lastActivityAt);
  } finally { await strapi.db.getConnection(join.name).insert(links); }
});
test("activity failure rolls back its own write, emits closed failure and fails request safely", async () => {
  const { item, token } = await authorizedSource(); const before = await read(item.documentId);
  failPersistence = true; const ctx = context(token);
  try { assert.equal(status(await auth.authenticateSourceRequest(strapi, ctx)), 500); }
  finally { failPersistence = false; }
  assert.deepEqual(await read(item.documentId), before);
  assert.equal(auth.getSourceContext(strapi, ctx), null);
  assert.deepEqual(JSON.parse(errors.at(-1)!), { event: "scim.activity", outcome: "failure" });
  assert.equal(errors.join("").includes(token), false);
  await assert.rejects(strapi.db.transaction(async () => {
    assert.equal(status(await auth.authenticateSourceRequest(strapi, context(token))), 500);
    throw new Error("OUTER_ROLLBACK");
  }), /OUTER_ROLLBACK/);
  assert.deepEqual(await read(item.documentId), before);
});
test("service bearer scope ignores forged foreign hints and existing CSRM policies still separate people", async () => {
  const { item, token } = await authorizedSource(); const other = await authorizedSource();
  const ctx = { request: { header: { authorization: `Bearer ${token}`, "x-source-id": other.item.documentId,
    "x-csrm-dev-identity": "analyst", "x-csrm-identity-token": "human-token" } }, state: { idamboxUser: { documentId: other.item.documentId } } };
  const result = await auth.authenticateSourceRequest(strapi, ctx); assert.ok(result.ok);
  assert.equal(result.value.sourceDocumentId, item.documentId);
  const service = (require(path.join(strapi.dirs.dist.root, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
  const foreign = await auth.authenticateSourceRequest(strapi, context(other.token)); assert.ok(foreign.ok);
  const created = await service.createFromSource(foreign.value, { username: "foreign-person", email: "foreign@auth.test", displayName: "Foreign", accountStatus: "active", sourceExternalId: "foreign-person" });
  assert.ok(created.ok);
  assert.deepEqual(await service.readForSource(result.value, created.value.documentId), { ok: false, code: "notFound" });
  const sourceRow = await read(item.documentId);
  assert.equal(await csrmPolicy({ params: {}, state: { idamboxUser: { documentId: sourceRow.serviceUser!.documentId } } }, { operation }, { strapi }), false);
  const api = await strapi.documents("api::function-api.function-api").create({ data: { name: "People read", url: "GET:/api/v1/people" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "People", application: applicationId, functionApis: [api.documentId] } });
  const role = await strapi.documents("api::role.role").create({ data: { name: "People reader", functions: [fn.documentId] } });
  const person = await strapi.documents(USER).create({ data: { username: "reader", email: "reader@auth.test", displayName: "Reader", protected: false, accountStatus: "active", roles: [role.documentId] } });
  assert.equal(await csrmPolicy({ params: {}, state: { idamboxUser: { documentId: person.documentId } } }, { operation: "GET:/api/v1/people" }, { strapi }), true);
  const before = await read(item.documentId);
  assert.equal(status(await auth.authenticateSourceRequest(strapi, context("human-keycloak-token"))), 401);
  assert.deepEqual(await read(item.documentId), before);
});

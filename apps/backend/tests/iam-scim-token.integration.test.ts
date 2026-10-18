import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type * as TokenService from "../src/iam/scim/token-service";

const SOURCE = "api::identity-source.identity-source";
const USER = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-scim-token-${process.pid}`);
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
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
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
  await strapi?.destroy();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

test("issue, automatic rotation and revoke persist only digest and independent UTC metadata", async () => {
  const item = await source();
  const before = await read(item.documentId);
  const userBefore = await strapi.documents(USER).findOne({ documentId: before.serviceUser!.documentId, populate: { roles: true } });
  const start = Date.now();
  assert.ok(item.name);
  const issued = await tokens.administerSourceToken(strapi, item.name);
  assert.equal(issued.action, "issue");
  const first = plaintext(issued);
  assert.deepEqual(tokens.parseSourceToken(first), { sourceDocumentId: item.documentId });
  const stored = await read(item.documentId);
  assert.equal(stored.tokenHash, tokens.hashSourceToken(first));
  assert.equal(stored.tokenRotatedAt, issued.tokenRotatedAt);
  assert.match(issued.tokenRotatedAt, /^\d{4}-\d\d-\d\dT.*Z$/);
  assert.ok(Date.parse(issued.tokenRotatedAt) >= start && Date.parse(issued.tokenRotatedAt) <= Date.now());
  assert.equal(JSON.stringify(stored).includes(first), false);
  assert.equal(stored.lastActivityAt, before.lastActivityAt);
  assert.deepEqual(await strapi.documents(USER).findOne({ documentId: before.serviceUser!.documentId, populate: { roles: true } }), userBefore);
  const rotated = await tokens.administerSourceToken(strapi, item.documentId);
  assert.equal(rotated.action, "rotate");
  const current = await read(item.documentId);
  assert.equal(tokens.verifySourceTokenDigest(first, current.tokenHash), false);
  assert.equal(tokens.verifySourceTokenDigest(plaintext(rotated), current.tokenHash), true);
  const revoked = await tokens.administerSourceToken(strapi, item.documentId, "revoke");
  assert.equal("token" in revoked, false);
  const revokedRow = await read(item.documentId);
  assert.equal(revokedRow.tokenHash, null);
  assert.equal(revokedRow.tokenRotatedAt, revoked.tokenRotatedAt);
  assert.equal(tokens.verifySourceTokenDigest(plaintext(rotated), revokedRow.tokenHash), false);
  assert.equal(revokedRow.lastActivityAt, before.lastActivityAt);
  assert.deepEqual(await strapi.documents(USER).findOne({ documentId: before.serviceUser!.documentId, populate: { roles: true } }), userBefore);
  const lifecycle = events.filter((event) => event.includes(item.documentId)).map((event) => JSON.parse(event) as unknown);
  assert.deepEqual(lifecycle, ["issue", "rotate", "revoke"].map((action) => ({ event: "scim.token", sourceDocumentId: item.documentId, action, outcome: "success" })));
});

test("explicit preconditions, missing targets and invalid actions fail without mutation", async () => {
  const item = await source();
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "rotate"), /IAM_SCIM_TOKEN_PRECONDITION/);
  await assert.rejects(tokens.administerSourceToken(strapi, "missing", "issue"), /IAM_SCIM_SOURCE_NOT_FOUND/);
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "invalid" as never), /IAM_SCIM_TOKEN_INVALID_ACTION/);
  await tokens.administerSourceToken(strapi, item.documentId, "issue");
  const before = await read(item.documentId);
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "issue"), /IAM_SCIM_TOKEN_PRECONDITION/);
  assert.deepEqual(await read(item.documentId), before);
});

test("independent concurrent transactions leave only the final committed rotation usable", async () => {
  const item = await source();
  const issued = await tokens.administerSourceToken(strapi, item.documentId);
  const rotated = await Promise.all(Array.from({ length: 5 }, () => tokens.administerSourceToken(strapi, item.documentId, "rotate")));
  const stored = await read(item.documentId);
  assert.equal(new Set(rotated.map(plaintext)).size, 5);
  assert.equal(rotated.filter((result) => tokens.verifySourceTokenDigest(plaintext(result), stored.tokenHash)).length, 1);
  assert.equal(tokens.verifySourceTokenDigest(plaintext(issued), stored.tokenHash), false);
  const empty = await source();
  const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => tokens.administerSourceToken(strapi, empty.documentId, "issue")));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  for (const result of attempts) if (result.status === "rejected") assert.match(String(result.reason), /IAM_SCIM_TOKEN_PRECONDITION/);
});

test("persistence failure and outer transaction rollback preserve the previous credential and emit no event", async () => {
  const item = await source();
  const issued = await tokens.administerSourceToken(strapi, item.documentId);
  const before = await read(item.documentId);
  const eventCount = events.length;
  failPersistence = true;
  try { await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "rotate")); }
  finally { failPersistence = false; }
  assert.deepEqual(await read(item.documentId), before);
  await assert.rejects(strapi.db.transaction(async () => {
    await tokens.administerSourceToken(strapi, item.documentId, "rotate");
    throw new Error("TEST_OUTER_ROLLBACK");
  }), /TEST_OUTER_ROLLBACK/);
  assert.deepEqual(await read(item.documentId), before);
  assert.equal(tokens.verifySourceTokenDigest(plaintext(issued), before.tokenHash), true);
  assert.equal(events.length, eventCount);
});

test("inactive source and broken binding refuse issue/rotate but allow repeated revocation", async () => {
  const item = await source();
  await tokens.administerSourceToken(strapi, item.documentId);
  await strapi.documents(SOURCE).update({ documentId: item.documentId, data: { sourceStatus: "inactive" } });
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "rotate"), /IAM_SCIM_SOURCE_INVALID_BINDING/);
  await tokens.administerSourceToken(strapi, item.documentId, "revoke");
  await tokens.administerSourceToken(strapi, item.documentId, "revoke");
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "issue"), /IAM_SCIM_SOURCE_INVALID_BINDING/);
  await strapi.documents(SOURCE).update({ documentId: item.documentId, data: { sourceStatus: "active" } });
  const attribute = strapi.db.metadata.get(SOURCE).attributes.serviceUser;
  assert.ok(attribute.type === "relation" && "joinTable" in attribute && attribute.joinTable);
  const join = attribute.joinTable;
  // Deliberately corrupt an isolated fixture; ordinary writers prohibit unbinding.
  await strapi.db.getConnection(join.name).where(join.joinColumn.name, item.id).delete();
  await assert.rejects(tokens.administerSourceToken(strapi, item.documentId, "issue"), /IAM_SCIM_SOURCE_INVALID_BINDING/);
  await tokens.administerSourceToken(strapi, item.documentId, "revoke");
  await tokens.administerSourceToken(strapi, item.documentId, "revoke");
  assert.equal((await read(item.documentId)).tokenHash, null);
});

test("an exact documentId wins over a colliding source name", async () => {
  const item = await source();
  const other = await source();
  await strapi.documents(SOURCE).update({ documentId: other.documentId, data: { name: item.documentId } });
  const result = await tokens.administerSourceToken(strapi, item.documentId);
  assert.equal(result.sourceDocumentId, item.documentId);
  assert.equal((await read(other.documentId)).tokenHash, null);
});

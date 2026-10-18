import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { createIdentityService } from "../src/iam/identity/identity-service";
import type { SourcePrincipal } from "../src/iam/identity/source-principal";
import type { scimPatchRequest } from "../src/iam/scim/patch";
import { PATCH_OP_URN } from "../src/iam/scim/wire";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

const USER = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-scim-patch-${process.pid}`);
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
let request: typeof scimPatchRequest;
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
  request = (require(path.join(compiledDir, "src/iam/scim/patch")) as typeof import("../src/iam/scim/patch")).scimPatchRequest;
  service = (require(path.join(compiledDir, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
});
after(async () => {
  await strapi?.destroy(); await remote?.close();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

const patch = (...Operations: unknown[]) => request({ schemas: [PATCH_OP_URN], Operations });
const snapshot = (id: string) => strapi.documents(USER).findOne({ documentId: id, populate: { roles: true, identitySource: true } });
const outbox = () => strapi.documents("api::keycloak-sync-outbox.keycloak-sync-outbox").findMany({ sort: "id:asc" });

test("one locked reduction writes once, retains Roles and preserves existing DTO callers", async () => {
  const user = value(await service.createFromSource(first, dto("patch-single", " 001Ab ")));
  await strapi.documents(USER).update({ documentId: user.documentId, data: { roles: [roleId] } });
  let updates = 0;
  strapi.documents.use(async (context, next) => {
    if (context.uid === USER && context.action === "update" && context.params.documentId === user.documentId) updates++;
    return next();
  });
  const updated = value(await service.patchFromSource(first, user.documentId, patch(
    { op: "replace", path: "name.givenName", value: "New" },
    { op: "replace", path: "displayName", value: "Final Name" },
    { op: "replace", path: "externalId", value: " 001Ab " })));
  assert.equal(updates, 1); assert.equal(updated.firstName, "New"); assert.equal(updated.displayName, "Final Name");
  assert.equal(updated.sourceExternalId, " 001Ab ");
  assert.deepEqual((await snapshot(user.documentId))?.roles?.map((role) => role.documentId), [roleId]);
  assert.equal(value(await service.patchFromSource(first, user.documentId, { department: "DTO" })).department, "DTO");
  for (const malformed of [null, 7, "text", [], { kind: "reduction" }]) {
    assert.deepEqual(await service.patchFromSource(first, user.documentId, malformed as never), { ok: false, code: "invalidInput" });
  }
  assert.deepEqual(await service.patchFromSource(first, user.documentId, {
    kind: "reduction", reduce: () => ({ ok: true as const, value: { roles: [roleId] } as never }),
  }), { ok: false, code: "invalidInput" });
});

test("later failure and immutable-key changes leave timestamps, outbox and the whole user unchanged", async () => {
  const user = value(await service.createFromSource(first, dto("patch-atomic")));
  const beforeUser = await snapshot(user.documentId); const beforeOutbox = await outbox();
  assert.deepEqual(await service.patchFromSource(first, user.documentId, patch(
    { op: "replace", path: "active", value: false }, { op: "remove", path: "unknown" })), { ok: false, code: "path" });
  assert.deepEqual(await service.patchFromSource(first, user.documentId, patch(
    { op: "replace", path: "externalId", value: "different" })), { ok: false, code: "immutableSourceKey" });
  assert.deepEqual(await snapshot(user.documentId), beforeUser); assert.deepEqual(await outbox(), beforeOutbox);
});

test("concurrent disjoint reductions decide from the fresh locked projection and both deltas survive", async () => {
  const user = value(await service.createFromSource(first, dto("patch-concurrent")));
  const seen: Array<{ firstName?: string | null; department?: string | null }> = [];
  function observed(input: ReturnType<typeof patch>) {
    return { ...input, reduce(current: Parameters<typeof input.reduce>[0]) {
      assert.equal(strapi.db.inTransaction(), true);
      assert.equal(Object.isFrozen(current), true);
      assert.ok(!("roles" in current) && !("externalSubject" in current) && !("sourceIdentityKey" in current));
      seen.push({ firstName: current.firstName, department: current.department });
      return input.reduce(current);
    } };
  }
  const results = await Promise.all([
    service.patchFromSource(first, user.documentId, observed(patch({ op: "replace", path: "name.givenName", value: "Concurrent" }))),
    service.patchFromSource(first, user.documentId, observed(patch({ op: "replace", path: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department", value: "Department" }))),
  ]);
  results.forEach(value);
  assert.equal(seen.length, 2);
  assert.ok(seen[1].firstName === "Concurrent" || seen[1].department === "Department");
  const stored = await snapshot(user.documentId);
  assert.equal(stored?.firstName, "Concurrent"); assert.equal(stored?.department, "Department");
});

test("reduction cannot inspect foreign, manual, protected or revoked-source records", async () => {
  const foreign = value(await service.createFromSource(second, dto("patch-foreign")));
  const unowned = await manual("patch-manual");
  const tombstoned = value(await service.createFromSource(first, dto("patch-tombstoned")));
  value(await service.deactivateFromSource(first, tombstoned.documentId, true));
  const protectedUser = await manual("patch-protected");
  const { runManualProtection } = require(path.join(compiledDir, "src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
  await runManualProtection(strapi, protectedUser.documentId, true);
  let called = false;
  const input = { kind: "reduction" as const, reduce() { called = true; return { ok: true as const, value: { department: "Denied" } }; } };
  for (const id of [foreign.documentId, unowned.documentId, protectedUser.documentId, tombstoned.documentId, "missing"]) {
    assert.deepEqual(await service.patchFromSource(first, id, input), { ok: false, code: "notFound" });
  }
  const owned = value(await service.createFromSource(first, dto("patch-revoked")));
  await strapi.documents("api::identity-source.identity-source").update({ documentId: first.sourceDocumentId, data: { sourceStatus: "inactive" } });
  try { assert.deepEqual(await service.patchFromSource(first, owned.documentId, input), { ok: false, code: "forbidden" }); }
  finally { await strapi.documents("api::identity-source.identity-source").update({ documentId: first.sourceDocumentId, data: { sourceStatus: "active" } }); }
  assert.equal(called, false);
});

test("database uniqueness is translated only after actual outer rollback, with no partial mutation", async () => {
  const existing = value(await service.createFromSource(first, dto("patch-existing")));
  const user = value(await service.createFromSource(first, dto("patch-conflict")));
  const beforeUser = await snapshot(user.documentId); const beforeOutbox = await outbox();
  let conflictProbes = 0;
  strapi.documents.use(async (context, next) => {
    if (context.uid === USER && context.action === "findMany" && "sourceIdentityKey" in (context.params.filters ?? {})
      && context.params.fields?.includes("sourceExternalId")) {
      conflictProbes++; assert.equal(strapi.db.inTransaction(), false, "uniqueness lookup must follow outer rollback");
    }
    return next();
  });
  assert.deepEqual(await service.patchFromSource(first, user.documentId, patch(
    { op: "replace", path: "name.givenName", value: "Must roll back" },
    { op: "replace", path: "emails", value: [{ value: existing.email }] })), { ok: false, code: "uniqueness" });
  assert.equal(conflictProbes, 1);
  assert.deepEqual(await snapshot(user.documentId), beforeUser); assert.deepEqual(await outbox(), beforeOutbox);
});

test("blocking remote failure rolls back the batch; inactive PATCH uses atomic durable outbox", async () => {
  const user = value(await service.createFromSource(first, dto("patch-remote")));
  const { createIdamboxUserProvisioningMiddleware } = require(path.join(compiledDir, "src/keycloak/register-idambox-user-provisioning")) as typeof import("../src/keycloak/register-idambox-user-provisioning");
  const { KeycloakAdminClient: CompiledClient } = require(path.join(compiledDir, "src/keycloak/admin-client")) as typeof import("../src/keycloak/admin-client");
  remote = await startFakeKeycloakServer();
  strapi.documents.use(createIdamboxUserProvisioningMiddleware(strapi, new CompiledClient({
    baseUrl: remote.baseUrl, realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
    adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000,
  })));
  value(await service.patchFromSource(first, user.documentId, { displayName: "Linked" }));
  const beforeUser = await snapshot(user.documentId); const beforeOutbox = await outbox();
  assert.ok(beforeUser?.externalSubject);
  remote.failNext("PUT /admin/realms/idambox/users", { status: 503, body: "private detail" });
  assert.deepEqual(await service.patchFromSource(first, user.documentId, patch(
    { op: "replace", path: "displayName", value: "Failed mover" }, { op: "replace", path: "name.givenName", value: "Failed" })),
    { ok: false, code: "keycloakUnavailable", retryAfterSeconds: 30 });
  assert.deepEqual(await snapshot(user.documentId), beforeUser); assert.deepEqual(await outbox(), beforeOutbox);
  const inactive = value(await service.patchFromSource(first, user.documentId, patch({ op: "replace", path: "active", value: false })));
  assert.equal(inactive.accountStatus, "inactive");
  const pending = (await outbox()).filter((item) => item.userDocumentId === user.documentId);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].syncStatus, "pending");
  assert.equal(pending[0].operation, "disableAndEndSessions");
  assert.equal(pending[0].externalSubject, beforeUser.externalSubject);
});

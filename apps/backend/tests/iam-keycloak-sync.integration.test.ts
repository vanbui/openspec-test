import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { createIdentityService } from "../src/iam/identity/identity-service";
import type { SourcePrincipal } from "../src/iam/identity/source-principal";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";
import { claimDueDeactivation, completeClaim, retryClaim, cancelClaim, renewClaim, retryDelayMs } from "../src/iam/keycloak-sync/outbox";
import { runOneDeactivation, startKeycloakSyncWorker, stopKeycloakSyncWorker } from "../src/iam/keycloak-sync/worker";
import { readKeycloakSyncConfig } from "../src/iam/keycloak-sync/config";
import { withIdentityUserLock } from "../src/iam/identity/user-lock";

const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-sync-${process.pid}`);
const environment = {
  APP_KEYS: "sync-1,sync-2", ADMIN_JWT_SECRET: "sync-admin", API_TOKEN_SALT: "sync-api",
  TRANSFER_TOKEN_SALT: "sync-transfer", ENCRYPTION_KEY: "sync-encryption", JWT_SECRET: "sync-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "sync.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi;
let service: ReturnType<typeof createIdentityService>;
let principal: SourcePrincipal;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>>;
let provisioning = false;
let failQueue = false;
let sawPersistedInactive = false;
let remoteClosed = false;
let legacyDocumentId: string;
let watchedReactivation: string | undefined;
let reactivationSawCancelled = false;
const dto = (name: string) => ({ username: name, email: `${name}@sync.test`, displayName: name,
  accountStatus: "active" as const, sourceExternalId: name });
function value<T>(outcome: { ok: true; value: T } | { ok: false; code: string }): T {
  assert.ok(outcome.ok, JSON.stringify(outcome)); return outcome.value;
}
function work(documentId: string) {
  return strapi.documents(OUTBOX).findFirst({ filters: { userDocumentId: documentId }, populate: { idamboxUser: true } });
}
before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  remote = await startFakeKeycloakServer();
  const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await runtime.compileStrapi({ appDir });
  assert.ok(compiled.distDir);
  strapi = await runtime.createStrapi(compiled).load(); strapi.cron?.destroy();
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  const { registerIdentitySource } = require(path.join(compiled.distDir, "src/iam/identity/source-registration")) as typeof import("../src/iam/identity/source-registration");
  const { resolveSourcePrincipal } = require(path.join(compiled.distDir, "src/iam/identity/source-principal")) as typeof import("../src/iam/identity/source-principal");
  const source = await registerIdentitySource(strapi, { name: "HR", username: "hr-service", email: "service@sync.test", displayName: "HR" });
  const resolved = await resolveSourcePrincipal(strapi, source.documentId); assert.ok(resolved); principal = resolved;
  service = (require(path.join(compiled.distDir, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
  const { createIdamboxUserProvisioningMiddleware } = require(path.join(compiled.distDir, "src/keycloak/register-idambox-user-provisioning")) as typeof import("../src/keycloak/register-idambox-user-provisioning");
  const { KeycloakAdminClient } = require(path.join(compiled.distDir, "src/keycloak/admin-client")) as typeof import("../src/keycloak/admin-client");
  const middleware = createIdamboxUserProvisioningMiddleware(strapi, new KeycloakAdminClient({ baseUrl: remote.baseUrl,
    realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID, adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000 }));
  strapi.documents.use((context, next) => provisioning ? middleware(context, next) : next());
  strapi.documents.use(async (context, next) => {
    const params = context.params as { documentId?: string; data?: Record<string, unknown> };
    if (context.uid === USER && context.action === "update" && params.documentId === watchedReactivation && params.data?.accountStatus === "active") {
      reactivationSawCancelled = (await work(params.documentId!))?.syncStatus === "cancelled";
    }
    if (failQueue && context.uid === OUTBOX && ["create", "update"].includes(context.action)) {
      const id = (context.params as { data: { userDocumentId?: string } }).data.userDocumentId;
      const user = await strapi.documents(USER).findOne({ documentId: id! });
      sawPersistedInactive = user?.accountStatus === "inactive";
      throw new Error("TEST_QUEUE_FAILURE");
    }
    return next();
  });
});
after(async () => {
  await strapi?.destroy(); if (!remoteClosed) await remote?.close(); await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

test("off mode preserves legacy password processing, ownership and durable subjectless enqueue", async () => {
  const user = await strapi.documents(USER).create({ data: { username: "legacy", email: "legacy@sync.test", displayName: "Legacy", accountStatus: "active", protected: false, password: "legacy-password" } });
  assert.match(String(user.password), /^\$2/);
  legacyDocumentId = user.documentId;
  await assert.rejects(strapi.documents(USER).update({ documentId: user.documentId, data: { password: "short" } }));
  await strapi.documents(USER).update({ documentId: user.documentId, data: { accountStatus: "inactive" } });
  const row = await work(user.documentId); assert.ok(row);
  assert.equal(row.externalSubject, null); assert.equal(row.idamboxUser?.documentId, user.documentId);
  assert.equal(row.generation, 1); assert.equal(row.syncStatus, "pending");
  await assert.rejects(strapi.documents(USER).delete({ documentId: user.documentId }), /IAM_IDENTITY_FORBIDDEN/);
  assert.equal((await work(user.documentId))?.idamboxUser?.documentId, user.documentId);
  const owned = value(await service.createFromSource(principal, dto("off-owned")));
  await assert.rejects(strapi.documents(USER).update({ documentId: owned.documentId, data: { department: "Forbidden" } }), /IAM_IDENTITY_FORBIDDEN/);
  value(await service.deactivateFromSource(principal, owned.documentId));
  assert.ok(await work(owned.documentId)); assert.equal(remote.requests.length, 0);
});

test("enabled inactive legacy writes clear retained credentials through Document Service without adopting a remote user", async () => {
  provisioning = true;
  const calls = remote.requests.length;
  await strapi.documents(USER).update({ documentId: legacyDocumentId, data: { displayName: "Legacy inactive", password: "transient-password" } });
  const user = await strapi.documents(USER).findOne({ documentId: legacyDocumentId });
  assert.equal(user?.password, null); assert.equal(user?.externalSubject, null);
  assert.equal((await work(legacyDocumentId))?.externalSubject, null);
  assert.equal(remote.requests.length, calls);
});

test("existing inactive full replacements commit HR edits with zero remote calls and replay retains backoff", async () => {
  provisioning = true;
  const user = value(await service.createFromSource(principal, dto("leaver")));
  const linked = await strapi.documents(USER).findOne({ documentId: user.documentId }); assert.ok(linked?.externalSubject);
  const calls = remote.requests.length;
  value(await service.replaceFromSource(principal, user.documentId, { ...dto("leaver"), accountStatus: "inactive", department: "Moved" }));
  const row = await work(user.documentId); assert.ok(row);
  assert.equal(remote.requests.length, calls);
  assert.equal(row.externalSubject, linked.externalSubject); assert.equal(row.idamboxUser?.documentId, user.documentId);
  assert.equal(row.operation, "disableAndEndSessions"); assert.equal(row.generation, 1);
  const nextAttemptAt = "2099-01-01T00:00:00.000Z";
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { attempts: 4, nextAttemptAt, lastErrorCode: "KEYCLOAK_UNAVAILABLE" } });
  value(await service.replaceFromSource(principal, user.documentId, { ...dto("leaver"), accountStatus: "inactive", department: "Again" }));
  const replay = await work(user.documentId); assert.ok(replay);
  assert.equal(replay.documentId, row.documentId); assert.equal(replay.generation, 1); assert.equal(replay.attempts, 4);
  assert.equal(replay.nextAttemptAt, nextAttemptAt); assert.equal(replay.lastErrorCode, "KEYCLOAK_UNAVAILABLE");
  assert.equal(remote.requests.length, calls);
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.department, "Again");
});

test("queue failure after persistence rolls back user HR fields, tombstone and first enqueue", async () => {
  const user = value(await service.createFromSource(principal, dto("queue-fault")));
  const original = await strapi.documents(USER).findOne({ documentId: user.documentId });
  const calls = remote.requests.length;
  failQueue = true; sawPersistedInactive = false;
  try {
    await assert.rejects(service.replaceFromSource(principal, user.documentId, { ...dto("queue-fault"), accountStatus: "inactive", department: "Lost" }), /TEST_QUEUE_FAILURE/);
    assert.equal(sawPersistedInactive, true);
    assert.deepEqual(await strapi.documents(USER).findOne({ documentId: user.documentId }), original);
    sawPersistedInactive = false;
    await assert.rejects(service.deactivateFromSource(principal, user.documentId, true), /TEST_QUEUE_FAILURE/);
    assert.equal(sawPersistedInactive, true);
  } finally { failQueue = false; }
  assert.deepEqual(await strapi.documents(USER).findOne({ documentId: user.documentId }), original);
  assert.equal(await work(user.documentId), null); assert.equal(remote.requests.length, calls);
});

test("blocking reactivation cancels old leases, failed enable rolls back and second deactivation rearms one generation", async () => {
  const user = value(await service.createFromSource(principal, dto("reactivate")));
  value(await service.deactivateFromSource(principal, user.documentId));
  const row = await work(user.documentId); assert.ok(row);
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { syncStatus: "processing", attempts: 7,
    leaseOwner: "00000000-0000-0000-0000-000000000001", leaseExpiresAt: "2099-01-01T00:00:00.000Z" } });
  const old = await work(user.documentId);
  watchedReactivation = user.documentId; reactivationSawCancelled = false;
  remote.failNext("PUT /admin", { status: 503 });
  assert.equal((await service.patchFromSource(principal, user.documentId, { accountStatus: "active" })).ok, false);
  assert.equal(reactivationSawCancelled, true, "cancellation precedes the blocking enable inside its transaction");
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.accountStatus, "inactive");
  assert.deepEqual(await work(user.documentId), old);
  value(await service.patchFromSource(principal, user.documentId, { accountStatus: "active" }));
  watchedReactivation = undefined;
  const cancelled = await work(user.documentId); assert.ok(cancelled);
  assert.equal(cancelled.syncStatus, "cancelled"); assert.equal(cancelled.generation, 1);
  assert.equal(cancelled.leaseOwner, null); assert.equal(cancelled.leaseExpiresAt, null);
  const calls = remote.requests.length;
  await strapi.documents(USER).update({ documentId: user.documentId, data: { roles: [] } });
  value(await service.patchFromSource(principal, user.documentId, { department: "Nonmirrored" }));
  assert.equal(remote.requests.length, calls, "linked roles-only writes skip remote work");
  value(await service.deactivateFromSource(principal, user.documentId));
  const second = await work(user.documentId); assert.ok(second);
  assert.equal(second.documentId, row.documentId); assert.equal(second.generation, 2);
  assert.equal(second.syncStatus, "pending"); assert.equal(second.attempts, 0); assert.equal(second.lastErrorCode, null);
  assert.equal(second.leaseOwner, null); assert.equal(second.completedAt, null); assert.equal(remote.requests.length, calls);
});

test("inactive replay repairs missing work, retains completed work and rejects generation overflow atomically", async () => {
  const user = value(await service.createFromSource(principal, dto("repair")));
  value(await service.deactivateFromSource(principal, user.documentId));
  const first = await work(user.documentId); assert.ok(first);
  await strapi.documents(OUTBOX).delete({ documentId: first.documentId });
  const calls = remote.requests.length;
  value(await service.patchFromSource(principal, user.documentId, { department: "Repair" }));
  const repaired = await work(user.documentId); assert.ok(repaired);
  await strapi.documents(OUTBOX).update({ documentId: repaired.documentId, data: { syncStatus: "completed", completedAt: "2026-10-14T00:00:00.000Z", attempts: 3 } });
  value(await service.deactivateFromSource(principal, user.documentId));
  assert.equal((await work(user.documentId))?.syncStatus, "completed");
  assert.equal((await work(user.documentId))?.attempts, 3); assert.equal(remote.requests.length, calls);
  value(await service.patchFromSource(principal, user.documentId, { accountStatus: "active" }));
  await strapi.documents(OUTBOX).update({ documentId: repaired.documentId, data: { generation: 2147483647 } });
  await assert.rejects(service.deactivateFromSource(principal, user.documentId), /IAM_OUTBOX_GENERATION_OVERFLOW/);
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.accountStatus, "active");
  assert.equal((await work(user.documentId))?.generation, 2147483647);
});

test("inactive creates still block and registered source services remain bearer-only", async () => {
  remote.failNext("POST /admin", { status: 503 });
  assert.equal((await service.createFromSource(principal, { ...dto("inactive-create"), accountStatus: "inactive" })).ok, false);
  assert.equal(await strapi.documents(USER).findFirst({ filters: { username: "inactive-create" } }), null);
  const calls = remote.requests.length;
  await strapi.documents(USER).update({ documentId: principal.serviceUserDocumentId, data: { displayName: "HR updated" } });
  assert.equal(remote.requests.length, calls);
});

function syncEnvironment(extra: Record<string, string | undefined> = {}) {
  return { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: remote.baseUrl, KEYCLOAK_REALM: FAKE_KEYCLOAK_REALM,
    KEYCLOAK_ADMIN_CLIENT_ID: FAKE_KEYCLOAK_CLIENT_ID, KEYCLOAK_ADMIN_CLIENT_SECRET: FAKE_KEYCLOAK_CLIENT_SECRET, ...extra };
}
function syncConfig() { const config = readKeycloakSyncConfig(syncEnvironment()); assert.ok(config); return config; }
async function isolateQueue() {
  for (const row of await strapi.documents(OUTBOX).findMany()) {
    if (row.syncStatus === "pending" || row.syncStatus === "processing") {
      await strapi.documents(OUTBOX).update({ documentId: row.documentId,
        data: { syncStatus: "pending", nextAttemptAt: "2099-01-01T00:00:00.000Z" } });
    }
  }
}
async function leaver(name: string) {
  await isolateQueue(); provisioning = true;
  const user = value(await service.createFromSource(principal, dto(name)));
  value(await service.deactivateFromSource(principal, user.documentId));
  const stored = await strapi.documents(USER).findOne({ documentId: user.documentId }); assert.ok(stored?.externalSubject);
  remote.sessions.set(stored.externalSubject, new Set(["live-session"]));
  return { ...user, subject: stored.externalSubject };
}
function latch() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test("worker config defaults, safe bounds, off-mode inertness and overflow-safe indefinite backoff", async () => {
  const config = syncConfig(); assert.equal(config.pollMs, 5000); assert.equal(config.leaseMs, 60000); assert.equal(config.attemptMs, 30000);
  for (const extra of [{ KEYCLOAK_REQUEST_TIMEOUT_MS: "5001" }, { IDAMBOX_KEYCLOAK_SYNC_ATTEMPT_MS: "30001" },
    { IDAMBOX_KEYCLOAK_SYNC_LEASE_MS: "31000" }, { IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "0" }, { IDAMBOX_KEYCLOAK_SYNC_LEASE_MS: "NaN" }]) {
    assert.throws(() => readKeycloakSyncConfig(syncEnvironment(extra)));
  }
  assert.equal(retryDelayMs(1, () => 0), 5000); assert.equal(retryDelayMs(2, () => 1), 12000);
  assert.equal(retryDelayMs(2147483647, () => 0), 3600000); assert.equal(retryDelayMs(2147483647, () => 1), 4320000);
  await isolateQueue(); const rows = await strapi.documents(OUTBOX).findMany(); const requests = remote.requests.length;
  for (const env of [{}, { IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "invalid" }]) {
    startKeycloakSyncWorker(strapi, env, { client: { disableUser: async () => assert.fail("off-mode client"), endUserSessions: async () => assert.fail("off-mode client") } });
    await stopKeycloakSyncWorker(strapi);
  }
  assert.deepEqual(await strapi.documents(OUTBOX).findMany(), rows); assert.equal(remote.requests.length, requests);
});

test("simultaneous polls have one lease winner; expired restart and every stale transition are fenced", async () => {
  const user = await leaver("lease-winner");
  const claims = await Promise.all([claimDueDeactivation(strapi), claimDueDeactivation(strapi)]);
  assert.equal(claims.filter(Boolean).length, 1); const first = claims.find((claim) => claim !== null)!;
  assert.equal(first.userDocumentId, user.documentId); assert.equal(first.attempts, 1);
  const row = await work(user.documentId); assert.ok(row);
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { leaseExpiresAt: "2000-01-01T00:00:00.000Z" } });
  const second = await claimDueDeactivation(strapi); assert.ok(second); assert.notEqual(second.leaseOwner, first.leaseOwner); assert.equal(second.attempts, 2);
  await withIdentityUserLock(strapi, user.documentId, async (trx) => {
    for (const stale of [first, { ...second, generation: second.generation + 1 }]) {
      assert.equal(await completeClaim(strapi, trx, stale), false);
      assert.equal(await retryClaim(strapi, trx, stale, "KEYCLOAK_AUTH"), false);
      assert.equal(await cancelClaim(strapi, trx, stale), false);
      assert.equal(await renewClaim(strapi, trx, stale, 60000), false);
    }
    assert.equal(await renewClaim(strapi, trx, second, 60000), true);
    assert.equal(await retryClaim(strapi, trx, second, "KEYCLOAK_AUTH", () => 0), true);
  });
  assert.equal((await work(user.documentId))?.lastErrorCode, "KEYCLOAK_AUTH");
});

test("partial disable/logout retries the complete pair with preserved backoff and real session termination", async () => {
  const user = await leaver("worker-partial");
  remote.failNext(`POST /admin/realms/idambox/users/${user.subject}/logout`, { status: 503, body: "private-remote-body" });
  await runOneDeactivation(strapi, syncConfig(), { random: () => 0 });
  const pending = await work(user.documentId); assert.ok(pending);
  assert.equal(pending.syncStatus, "pending"); assert.equal(pending.attempts, 1); assert.equal(pending.lastErrorCode, "KEYCLOAK_UNAVAILABLE");
  assert.equal(remote.users.get(user.subject)?.enabled, false); assert.equal(remote.sessions.get(user.subject)?.size, 1);
  const retryAt = pending.nextAttemptAt;
  value(await service.deactivateFromSource(principal, user.documentId)); assert.equal((await work(user.documentId))?.nextAttemptAt, retryAt);
  assert.equal(await runOneDeactivation(strapi, syncConfig()), false);
  await strapi.documents(OUTBOX).update({ documentId: pending.documentId, data: { nextAttemptAt: "2000-01-01T00:00:00.000Z" } });
  const before = remote.adminRequests().length;
  await runOneDeactivation(strapi, syncConfig());
  assert.deepEqual(remote.adminRequests().slice(before).map((r) => r.method), ["PUT", "POST"]);
  assert.equal(remote.sessions.has(user.subject), false); const done = await work(user.documentId);
  assert.equal(done?.syncStatus, "completed"); assert.equal(done?.attempts, 2); assert.ok(done?.completedAt); assert.equal(done?.lastErrorCode, null);
});

test("subjectless completion never invokes a client; crash after remote success replays both operations", async () => {
  await isolateQueue(); provisioning = false;
  const manual = await strapi.documents(USER).create({ data: { username: "no-subject", email: "no-subject@sync.test", displayName: "No subject", accountStatus: "active", protected: false } });
  await strapi.documents(USER).update({ documentId: manual.documentId, data: { accountStatus: "inactive" } });
  const before = remote.requests.length;
  await runOneDeactivation(strapi, syncConfig(), { client: { disableUser: async () => assert.fail("no subject"), endUserSessions: async () => assert.fail("no subject") } });
  assert.equal((await work(manual.documentId))?.syncStatus, "completed"); assert.equal(remote.requests.length, before);
  const user = await leaver("crash-replay"); const claim = await claimDueDeactivation(strapi); assert.ok(claim);
  const { KeycloakAdminClient } = require("../src/keycloak/admin-client") as typeof import("../src/keycloak/admin-client");
  const client = new KeycloakAdminClient(syncConfig().client);
  await client.disableUser(user.subject); await client.endUserSessions(user.subject);
  // Simulate death before acknowledgement, then a later process observes the expired lease.
  const row = await work(user.documentId); assert.ok(row);
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { leaseExpiresAt: "2000-01-01T00:00:00.000Z" } });
  const calls = remote.adminRequests().length; await runOneDeactivation(strapi, syncConfig());
  assert.deepEqual(remote.adminRequests().slice(calls).map((r) => r.method), ["PUT", "POST"]);
  assert.equal((await work(user.documentId))?.syncStatus, "completed");
});

test("authentication failures stay pending indefinitely with bounded saturated attempts and closed error codes", async () => {
  const user = await leaver("auth-retry"); const row = await work(user.documentId); assert.ok(row);
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { attempts: 2147483647 } });
  remote.failNext(`PUT /admin/realms/idambox/users/${user.subject}`, { status: 403, body: "private credential personal@example.test" });
  await runOneDeactivation(strapi, syncConfig(), { random: () => 0 });
  const pending = await work(user.documentId); assert.ok(pending);
  assert.equal(pending.syncStatus, "pending"); assert.equal(pending.attempts, 2147483647); assert.equal(pending.lastErrorCode, "KEYCLOAK_AUTH");
  const delay = new Date(pending.nextAttemptAt!).getTime() - Date.now(); assert.ok(delay > 3590000 && delay <= 3601000);
  await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { nextAttemptAt: "2000-01-01T00:00:00.000Z" } });
  await runOneDeactivation(strapi, syncConfig()); assert.equal((await work(user.documentId))?.syncStatus, "completed");
});

test("reactivation before worker lock cancels stale delivery; a later deactivation increments generation", async () => {
  const user = await leaver("before-lock"); const arrived = latch(); const release = latch();
  const execution = runOneDeactivation(strapi, syncConfig(), { afterClaim: async () => { arrived.release(); await release.promise; } });
  await arrived.promise;
  try { value(await service.patchFromSource(principal, user.documentId, { accountStatus: "active" })); }
  finally { release.release(); }
  const calls = remote.adminRequests().length; await execution;
  assert.equal(remote.adminRequests().length, calls); assert.equal((await work(user.documentId))?.syncStatus, "cancelled");
  value(await service.deactivateFromSource(principal, user.documentId)); assert.equal((await work(user.documentId))?.generation, 2);
  await runOneDeactivation(strapi, syncConfig()); assert.equal((await work(user.documentId))?.syncStatus, "completed");
});

test("reactivation after worker lock waits for disable/logout acknowledgement, then enables", async () => {
  const user = await leaver("after-lock"); const barrier = remote.holdNext(`PUT /admin/realms/idambox/users/${user.subject}`);
  const execution = runOneDeactivation(strapi, syncConfig()); await barrier.entered;
  let settled = false;
  const reactivation = service.patchFromSource(principal, user.documentId, { accountStatus: "active" }).then((result) => { settled = true; return result; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 30)); assert.equal(settled, false);
  } finally { barrier.release(); }
  await execution; value(await reactivation);
  assert.equal(remote.users.get(user.subject)?.enabled, true); assert.equal(remote.sessions.has(user.subject), false);
  assert.equal((await strapi.documents(USER).findOne({ documentId: user.documentId }))?.accountStatus, "active");
});

test("expired claim waiting for the user lock cannot execute or acknowledge", async () => {
  const user = await leaver("expired-before-lock"); let claimId: number | undefined;
  const calls = remote.requests.length;
  await runOneDeactivation(strapi, syncConfig(), { afterClaim: async (claim) => {
    claimId = claim.id; const row = await work(user.documentId); assert.ok(row);
    await strapi.documents(OUTBOX).update({ documentId: row.documentId, data: { leaseExpiresAt: "2000-01-01T00:00:00.000Z" } });
  } });
  assert.ok(claimId); assert.equal(remote.requests.length, calls); assert.equal((await work(user.documentId))?.syncStatus, "processing");
});

test("poller start is per-instance; shutdown aborts in-flight calls, retains recoverable lease and removes timers", async () => {
  const user = await leaver("shutdown"); const barrier = remote.holdNext(`PUT /admin/realms/idambox/users/${user.subject}`);
  startKeycloakSyncWorker(strapi, syncEnvironment({ IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "10" }));
  startKeycloakSyncWorker(strapi, syncEnvironment({ IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "10" }));
  await barrier.entered; const started = Date.now();
  try { await stopKeycloakSyncWorker(strapi); assert.ok(Date.now() - started < 1500); }
  finally { barrier.release(); }
  const pending = await work(user.documentId); assert.equal(pending?.syncStatus, "processing"); assert.ok(pending?.leaseOwner);
  await strapi.documents(OUTBOX).update({ documentId: pending!.documentId, data: { leaseExpiresAt: "2000-01-01T00:00:00.000Z" } });
  await runOneDeactivation(strapi, syncConfig());
  assert.equal((await work(user.documentId))?.syncStatus, "completed");
  const calls = remote.requests.length; await new Promise((resolve) => setTimeout(resolve, 40)); assert.equal(remote.requests.length, calls);
  await stopKeycloakSyncWorker(strapi);
});

test("existing inactive PUT commits even when the remote server is unreachable", async () => {
  const user = value(await service.createFromSource(principal, dto("outage")));
  const calls = remote.requests.length;
  await remote.close(); remoteClosed = true;
  value(await service.replaceFromSource(principal, user.documentId, { ...dto("outage"), accountStatus: "inactive", department: "Leaver HR edit" }));
  value(await service.replaceFromSource(principal, user.documentId, { ...dto("outage"), accountStatus: "inactive", jobTitle: "Inactive replay" }));
  const stored = await strapi.documents(USER).findOne({ documentId: user.documentId });
  assert.equal(stored?.accountStatus, "inactive"); assert.equal(stored?.jobTitle, "Inactive replay");
  assert.ok(await work(user.documentId)); assert.equal(remote.requests.length, calls);
});

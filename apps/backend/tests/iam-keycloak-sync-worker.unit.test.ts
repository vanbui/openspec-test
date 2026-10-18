import assert from "node:assert/strict";
import { test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { Knex } from "knex";
import { startKeycloakSyncWorker, stopKeycloakSyncWorker, workerShutdownMs, workerCoordinationMs } from "../src/iam/keycloak-sync/worker";
import { readKeycloakSyncConfig } from "../src/iam/keycloak-sync/config";
import { withIdentityUserLock } from "../src/iam/identity/user-lock";

const env = { IDAMBOX_KEYCLOAK_PROVISIONING: "true", KEYCLOAK_BASE_URL: "http://127.0.0.1:9999", KEYCLOAK_REALM: "test",
  KEYCLOAK_ADMIN_CLIENT_ID: "test", KEYCLOAK_ADMIN_CLIENT_SECRET: "test-secret", IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "1",
  IDAMBOX_KEYCLOAK_SYNC_LEASE_MS: "1200", IDAMBOX_KEYCLOAK_SYNC_ATTEMPT_MS: "100" };

test("stalled claim dependency cannot prevent bounded teardown or start a second worker", async () => {
  const config = readKeycloakSyncConfig(env); assert.ok(config);
  const warnings: string[] = [];
  const strapi = { log: { warn: (message: string) => warnings.push(message) } } as unknown as Core.Strapi;
  let entered!: () => void; let release!: () => void; let claims = 0;
  const arrived = new Promise<void>((resolve) => { entered = resolve; });
  const stalled = new Promise<null>((resolve) => { release = () => resolve(null); });
  const claim = async () => { claims++; entered(); return stalled; };
  startKeycloakSyncWorker(strapi, env, { claim });
  await arrived;
  try {
    const started = Date.now();
    await stopKeycloakSyncWorker(strapi);
    assert.ok(Date.now() - started <= workerShutdownMs(config) + 250);
    assert.ok(warnings.some((message) => message.includes("shutdown bound reached")));
    startKeycloakSyncWorker(strapi, env, { claim });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(claims, 1);
  } finally { release(); }
  await stopKeycloakSyncWorker(strapi);
  assert.ok(workerCoordinationMs(config) * 12 + config.attemptMs < config.leaseMs);
});

function transactionHost() {
  const statements: string[] = []; let rolledBack = false;
  const relation = { type: "relation", joinTable: { name: "link", joinColumn: { name: "source_id" }, inverseJoinColumn: { name: "user_id" } } };
  const attributes = Object.fromEntries(["id", "documentId", "sourceIdentityKey", "userDocumentId"].map((name) => [name, { columnName: name }]));
  const trx = { raw: async (sql: string) => { statements.push(sql); } } as unknown as Knex.Transaction;
  const strapi = { db: { dialect: { client: "postgres" }, inTransaction: () => false,
    metadata: { get: () => ({ tableName: "table", attributes: { ...attributes, serviceUser: relation, idamboxUser: relation } }) },
    transaction: async (work: (context: { trx: Knex.Transaction }) => Promise<unknown>) => {
      try { return await work({ trx }); } catch (error) { rolledBack = true; throw error; }
    },
  } } as unknown as Core.Strapi;
  return { strapi, statements, rolledBack: () => rolledBack };
}

test("worker bounds use SET LOCAL and aborted coordination rolls back; ordinary writes receive no timeouts", async () => {
  const host = transactionHost();
  await withIdentityUserLock(host.strapi, undefined, async () => true);
  assert.deepEqual(host.statements, []);
  await withIdentityUserLock(host.strapi, undefined, async () => true, { timeoutMs: 100 });
  assert.deepEqual(host.statements, ["SET LOCAL lock_timeout = '100ms'", "SET LOCAL statement_timeout = '100ms'"]);
  const controller = new AbortController();
  await assert.rejects(withIdentityUserLock(host.strapi, undefined, async () => { controller.abort(); }, { timeoutMs: 100, signal: controller.signal }), /IAM_WORKER_STOPPED/);
  assert.equal(host.rolledBack(), true);
});


test("a database timeout escapes the worker lock transaction for normal rollback", async () => {
  const host = transactionHost();
  const timeout = Object.assign(new Error("statement timeout"), { code: "57014" });
  await assert.rejects(withIdentityUserLock(host.strapi, undefined, async () => { throw timeout; }, { timeoutMs: 100 }),
    (error) => error === timeout);
  assert.equal(host.rolledBack(), true);
});


test("stopping during the poll delay removes a settled worker so it can restart", async () => {
  const strapi = { log: { warn: () => {} } } as unknown as Core.Strapi;
  let entered!: () => void; let claims = 0;
  const claim = async () => { claims++; entered(); return null; };
  const idleEnv = { ...env, IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "20" };
  for (let run = 0; run < 2; run++) {
    const arrived = new Promise<void>((resolve) => { entered = resolve; });
    startKeycloakSyncWorker(strapi, idleEnv, { claim });
    await arrived;
    await new Promise<void>((resolve) => setImmediate(resolve));
    await stopKeycloakSyncWorker(strapi);
  }
  assert.equal(claims, 2);
});

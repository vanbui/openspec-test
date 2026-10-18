import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import { installIdamboxWriteDiscipline, assertIdamboxWriteDiscipline, type WriteDiscipline } from "./helpers/idambox-write-discipline";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

const USER = "api::idambox-user.idambox-user";
const ROLE = "api::role.role";
const appDir = path.resolve(__dirname, "../../..");
const directory = path.join(appDir, ".tmp", `iam-discipline-${process.pid}`);
const environment = {
  APP_KEYS: "discipline-1,discipline-2", ADMIN_JWT_SECRET: "discipline-admin", API_TOKEN_SALT: "discipline-api",
  TRANSFER_TOKEN_SALT: "discipline-transfer", ENCRYPTION_KEY: "discipline-encryption", JWT_SECRET: "discipline-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(directory, "discipline.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(directory, "attachments"), CSRM_ATTACHMENT_SCANNER: "development",
  NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
let strapi: Core.Strapi;
let discipline: WriteDiscipline;
let compiledDir: string;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>>;
let source: import("../src/iam/identity/source-principal").SourcePrincipal;
let service: ReturnType<typeof import("../src/iam/identity/identity-service").createIdentityService>;
let role: string;
let victim: { id: number; documentId: string };
let intrusion: (() => Promise<unknown>) | undefined;
let lifecycleIntrusion: (() => Promise<unknown>) | undefined;
const dto = (name: string) => ({ username: name, email: `${name}@discipline.test`, displayName: name,
  accountStatus: "active" as const, sourceExternalId: name });
const manual = (name: string) => strapi.documents(USER).create({ data: { ...dto(name), sourceExternalId: undefined, protected: false } });
function value<T>(outcome: { ok: true; value: T } | { ok: false; code: string }): T { assert.ok(outcome.ok, JSON.stringify(outcome)); return outcome.value; }
const moduleAt = <T>(relative: string): T => require(path.join(compiledDir, "src", relative));

before(async () => {
  Object.assign(process.env, environment); await mkdir(directory, { recursive: true });
  const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await runtime.compileStrapi({ appDir }); assert.ok(compiled.distDir); compiledDir = compiled.distDir;
  strapi = await runtime.createStrapi(compiled).load(); strapi.cron?.destroy();
  discipline = installIdamboxWriteDiscipline(strapi);
  strapi.documents.use(async (ctx, next) => {
    if (ctx.uid === USER && ctx.action === "update" && intrusion) await intrusion();
    return next();
  });
  strapi.db.lifecycles.subscribe({ models: [USER], async beforeUpdate() { if (lifecycleIntrusion) await lifecycleIntrusion(); } });
  const application = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: application.documentId } });
  await strapi.documents(ROLE).create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
  role = (await strapi.documents(ROLE).create({ data: { name: "Human" } })).documentId;
  const registration = moduleAt<typeof import("../src/iam/identity/source-registration")>("iam/identity/source-registration");
  const registered = await registration.registerIdentitySource(strapi, { name: "Discipline source", username: "discipline-service", email: "service@discipline.test", displayName: "Service" });
  const principal = await moduleAt<typeof import("../src/iam/identity/source-principal")>("iam/identity/source-principal").resolveSourcePrincipal(strapi, registered.documentId);
  assert.ok(principal); source = principal;
  service = moduleAt<typeof import("../src/iam/identity/identity-service")>("iam/identity/identity-service").createIdentityService(strapi);
  const created = await manual("victim"); victim = { id: Number(created.id), documentId: created.documentId };
});
after(async () => {
  discipline?.restore(); await strapi?.destroy(); await remote?.close();
  await rm(directory, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

test("six source methods, explicit claim/mover/leaver, seed/reseed and administration use actual persistence", async () => {
  const owned = value(await service.createFromSource(source, dto("owned")));
  value(await service.readForSource(source, owned.documentId)); value(await service.listForSource(source));
  value(await service.patchFromSource(source, owned.documentId, { department: "Operations" }));
  const candidate = await manual("candidate");
  value(await service.replaceFromSource(source, candidate.documentId, dto("claimed")));
  value(await service.replaceFromSource(source, candidate.documentId, { ...dto("claimed"), jobTitle: "Mover" }));
  await strapi.documents(USER).update({ documentId: owned.documentId, data: { roles: [role] } });
  const manager = strapi.plugin("content-manager").service("document-manager") as { update(id: string, uid: string, params: { data: Record<string, unknown> }): Promise<unknown> };
  await manager.update(owned.documentId, USER, { data: { roles: [role] } });
  await assert.rejects(manager.update(owned.documentId, USER, { data: { department: "Unauthorized" } }), /IAM_IDENTITY_FORBIDDEN/);
  value(await service.deactivateFromSource(source, owned.documentId));
  value(await service.deactivateFromSource(source, candidate.documentId, true));
  const seed = moduleAt<typeof import("../src/bootstrap/seed-iam-data")>("bootstrap/seed-iam-data");
  await seed.seedIamData(strapi, { NODE_ENV: "development", IDAMBOX_SEED_IAM: "true" });
  await seed.seedIamData(strapi, { NODE_ENV: "development", IDAMBOX_SEED_IAM: "true" });
  process.env.IDAMBOX_SEED_CSRM = "true";
  try {
    const seedPeople = moduleAt<typeof import("../src/bootstrap/seed-csrm-data")>("bootstrap/seed-csrm-data");
    await seedPeople.seedCsrmData(strapi);
    const jane = await strapi.documents(USER).findFirst({ filters: { username: "jane.doe" } }); assert.ok(jane);
    value(await service.replaceFromSource(source, jane.documentId, dto("claimed-fixture")));
    await seedPeople.seedCsrmData(strapi);
    assert.equal((await strapi.documents(USER).findOne({ documentId: jane.documentId }))?.username, "claimed-fixture");
  } finally { process.env.IDAMBOX_SEED_CSRM = "false"; }
  const disposable = await manual("disposable"); await strapi.documents(USER).delete({ documentId: disposable.documentId });
  assertIdamboxWriteDiscipline(discipline);
  assert.ok(discipline.ledger.some((entry) => entry.table.endsWith("_lnk")), "No relation SQL evidence");
});

const bypasses: Array<[string, () => Promise<unknown>]> = [
  ["direct update", () => strapi.db.query(USER).update({ where: { id: victim.id }, data: { displayName: "Bypass" } })],
  ["aliased repository", () => { const repository = strapi.db.query(USER); return repository.update({ where: { id: victim.id }, data: { displayName: "Bypass" } }); }],
  ["bulk", () => strapi.db.query(USER).updateMany({ where: { id: victim.id }, data: { displayName: "Bypass" } })],
  ["query builder", () => strapi.db.entityManager.createQueryBuilder(USER).where({ id: victim.id }).update({ display_name: "Bypass" }).execute()],
  ["raw SQL", () => strapi.db.connection.raw("UPDATE idambox_users SET display_name = ? WHERE id = ?", ["Bypass", victim.id])],
  ["inverse grant", () => strapi.db.query(ROLE).update({ where: { documentId: role }, data: { idamboxUsers: [victim.id] } })],
  ["relation link table", () => { const attr = strapi.db.metadata.get(USER).attributes.roles; assert.ok("joinTable" in attr && attr.joinTable); return strapi.db.connection(attr.joinTable.name).delete(); }],
];
for (const [name, bypass] of bypasses) test(`runtime rejects ${name} outside and inside transaction/middleware/lifecycle`, async () => {
  const beforeLedger = discipline.ledger.length;
  await assert.rejects(async () => bypass(), /IAM_WRITE_DISCIPLINE_VIOLATION/);
  await assert.rejects(strapi.db.transaction(async () => bypass()), /IAM_WRITE_DISCIPLINE_VIOLATION/);
  intrusion = bypass;
  try { await assert.rejects(strapi.documents(USER).update({ documentId: victim.documentId, data: { displayName: "Legitimate" } }), /IAM_WRITE_DISCIPLINE_VIOLATION/); }
  finally { intrusion = undefined; }
  lifecycleIntrusion = bypass;
  try { await assert.rejects(strapi.documents(USER).update({ documentId: victim.documentId, data: { displayName: "Legitimate" } }), /IAM_WRITE_DISCIPLINE_VIOLATION/); }
  finally { lifecycleIntrusion = undefined; }
  assert.equal(discipline.ledger.length, beforeLedger);
  assert.equal((await strapi.documents(USER).findOne({ documentId: victim.documentId }))?.displayName, "victim");
});

test("source authority does not allow a direct persistence bypass", async () => {
  const context = moduleAt<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context");
  await assert.rejects(context.runSourceMutation(strapi, source, "patch", victim.documentId, bypasses[0][1]), /IAM_WRITE_DISCIPLINE_VIOLATION/);
});

test("nested legitimate lifecycle persistence is allowed without leaking to concurrent promises", async () => {
  let entered!: () => void; let release!: () => void;
  const reached = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  lifecycleIntrusion = async () => { entered(); await gate; await manual("nested-lifecycle"); };
  const update = strapi.documents(USER).update({ documentId: victim.documentId, data: { displayName: "victim" } });
  try { await reached; await assert.rejects(async () => bypasses[0][1](), /IAM_WRITE_DISCIPLINE_VIOLATION/); }
  finally { release(); }
  try { await update; } finally { lifecycleIntrusion = undefined; }
});

test("SELECT locks and outbox-only atomic coordination remain allowed", async () => {
  await strapi.db.connection.raw("SELECT id FROM idambox_users WHERE id = ?", [victim.id]);
  await strapi.db.transaction(async ({ trx }) => {
    await trx("idambox_users").select("id").where({ id: victim.id });
    await trx("keycloak_sync_outboxes").whereRaw("1=0").update({ attempts: 0 });
  });
});

test("blocking provisioner nests exact linkage and clears passwords; leaver queues without remote calls", async () => {
  remote = await startFakeKeycloakServer();
  const provisioning = moduleAt<typeof import("../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
  const { KeycloakAdminClient } = moduleAt<typeof import("../src/keycloak/admin-client")>("keycloak/admin-client");
  strapi.documents.use(provisioning.createIdamboxUserProvisioningMiddleware(strapi, new KeycloakAdminClient({
    baseUrl: remote.baseUrl, realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
    adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000,
  })));
  const user = await strapi.documents(USER).create({ data: { ...dto("linked"), sourceExternalId: undefined, protected: false, password: "transient-password" } });
  const persisted = await strapi.db.query(USER).findOne({ where: { id: user.id } });
  assert.ok(persisted?.externalSubject); assert.equal(persisted?.password, null);
  const calls = remote.requests.length;
  await strapi.documents(USER).update({ documentId: user.documentId, data: { accountStatus: "inactive" } });
  assert.equal(remote.requests.length, calls);
  assert.ok(await strapi.documents("api::keycloak-sync-outbox.keycloak-sync-outbox").findFirst({ filters: { userDocumentId: user.documentId } }));
  assert.ok(discipline.ledger.some((entry) => entry.fields.includes("external_subject") && entry.fields.includes("password")));
  const sourced = value(await service.createFromSource(source, dto("enabled-source")));
  value(await service.readForSource(source, sourced.documentId)); value(await service.listForSource(source));
  value(await service.patchFromSource(source, sourced.documentId, { firstName: "Mover" }));
  const claimTarget = await manual("enabled-manual");
  value(await service.replaceFromSource(source, claimTarget.documentId, dto("enabled-claim")));
  const manager = strapi.plugin("content-manager").service("document-manager") as { update(id: string, uid: string, params: { data: Record<string, unknown> }): Promise<unknown> };
  await manager.update(sourced.documentId, USER, { data: { roles: [role] } });
  const beforeLeaver = remote.requests.length;
  value(await service.deactivateFromSource(source, sourced.documentId));
  assert.equal(remote.requests.length, beforeLeaver);
  remote.failNext("POST /admin/realms/idambox/users", { status: 503 });
  assert.deepEqual(await service.createFromSource(source, dto("remote-rollback")), { ok: false, code: "keycloakUnavailable", retryAfterSeconds: 30 });
  assert.equal(await strapi.documents(USER).findFirst({ filters: { username: "remote-rollback" } }), null);
  assertIdamboxWriteDiscipline(discipline);
});

test("pinned entries callable drift fails closed", () => {
  const entries = require(discipline.entriesPath); const original = entries.createEntriesService;
  entries.createEntriesService = () => ({});
  try { assert.throws(() => installIdamboxWriteDiscipline(strapi), /Pinned entries callable drift/); }
  finally { entries.createEntriesService = original; }
});

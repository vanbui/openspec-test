import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";

import { IDAMBOX_USER_UID } from "../src/keycloak/provision-idambox-user";
import {
  FAKE_KEYCLOAK_CLIENT_ID,
  FAKE_KEYCLOAK_CLIENT_SECRET,
  FAKE_KEYCLOAK_REALM,
  startFakeKeycloakServer,
} from "./helpers/fake-keycloak-server";

/*
 * Boots the real application with provisioning enabled against an in-memory
 * Keycloak and proves ADR 0002 end to end: the IdamBox User write, the Keycloak
 * sync and the externalSubject/password write-back commit together, and a
 * Keycloak failure leaves the Strapi database as it was.
 */

type Row = Record<string, unknown> & { documentId: string };
type RunningStrapi = {
  documents: (uid: string) => {
    create: (params: { data: Record<string, unknown> }) => Promise<Row>;
    update: (params: { documentId: string; data: Record<string, unknown> }) => Promise<Row | null>;
  };
  db: { query: (uid: string) => { findOne: (params: { where: Record<string, unknown> }) => Promise<Row | null> } };
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "../../..");
const databaseDir = path.join(appDir, ".tmp", "keycloak-provisioning-tests");
const databaseFilename = path.join(databaseDir, `keycloak-provisioning-${process.pid}.sqlite`);
const PASSWORD = "integration-password-1";

const originalEnvironment = new Map(
  [
    "APP_KEYS", "ADMIN_JWT_SECRET", "API_TOKEN_SALT", "TRANSFER_TOKEN_SALT", "ENCRYPTION_KEY", "JWT_SECRET",
    "DATABASE_CLIENT", "DATABASE_FILENAME", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "CSRM_AI_PROVIDER",
    "STRAPI_DISABLE_UPDATE_NOTIFICATION", "IDAMBOX_KEYCLOAK_PROVISIONING", "KEYCLOAK_BASE_URL", "KEYCLOAK_REALM",
    "KEYCLOAK_ADMIN_CLIENT_ID", "KEYCLOAK_ADMIN_CLIENT_SECRET", "KEYCLOAK_REQUEST_TIMEOUT_MS",
  ].map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;
let keycloak: Awaited<ReturnType<typeof startFakeKeycloakServer>>;

before(async () => {
  keycloak = await startFakeKeycloakServer();
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "keycloak-provisioning-test-1,keycloak-provisioning-test-2";
  process.env.ADMIN_JWT_SECRET = "keycloak-provisioning-admin";
  process.env.API_TOKEN_SALT = "keycloak-provisioning-api";
  process.env.TRANSFER_TOKEN_SALT = "keycloak-provisioning-transfer";
  process.env.ENCRYPTION_KEY = "keycloak-provisioning-encryption";
  process.env.JWT_SECRET = "keycloak-provisioning-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.CSRM_AI_PROVIDER = "deterministic";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "true";
  process.env.KEYCLOAK_BASE_URL = keycloak.baseUrl;
  process.env.KEYCLOAK_REALM = FAKE_KEYCLOAK_REALM;
  process.env.KEYCLOAK_ADMIN_CLIENT_ID = FAKE_KEYCLOAK_CLIENT_ID;
  process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = FAKE_KEYCLOAK_CLIENT_SECRET;
  process.env.KEYCLOAK_REQUEST_TIMEOUT_MS = "2000";

  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  strapi = await strapiPackage.createStrapi(compiled).load();
  (strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();
});

after(async () => {
  if (strapi) await strapi.destroy();
  await rm(databaseFilename, { force: true });
  if (keycloak) await keycloak.close();
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function storedUser(email: string) {
  return strapi.db.query(IDAMBOX_USER_UID).findOne({ where: { email } });
}

function newUser(email: string, username: string) {
  return { email, username, displayName: username, accountStatus: "active", password: PASSWORD };
}

test("a created IdamBox user is linked to its Keycloak account and keeps no password", async () => {
  const created = await strapi.documents(IDAMBOX_USER_UID).create({ data: newUser("ada@idambox.test", "ada") });

  const [account] = [...keycloak.users.values()].filter((user) => user.email === "ada@idambox.test");
  assert.ok(account, "the Keycloak account exists");
  assert.equal(account.password, PASSWORD);
  assert.equal(created.externalSubject, account.id);

  const row = await storedUser("ada@idambox.test");
  assert.equal(row?.externalSubject, account.id);
  assert.equal(row?.password, null, "the password is not persisted in Strapi, not even as a hash");
});

test("a Keycloak failure on create rolls the Strapi user back", async () => {
  keycloak.failNext("POST /admin", { status: 503 });

  await assert.rejects(strapi.documents(IDAMBOX_USER_UID).create({ data: newUser("grace@idambox.test", "grace") }));

  assert.equal(await storedUser("grace@idambox.test"), null, "no Strapi user without a Keycloak account");
  assert.ok(![...keycloak.users.values()].some((user) => user.email === "grace@idambox.test"));

  // The retry succeeds once Keycloak recovers.
  const created = await strapi.documents(IDAMBOX_USER_UID).create({ data: newUser("grace@idambox.test", "grace") });
  assert.equal(typeof created.externalSubject, "string");
});

test("a Keycloak failure on update rolls the Strapi change back", async () => {
  const created = await strapi.documents(IDAMBOX_USER_UID).create({ data: newUser("alan@idambox.test", "alan") });
  keycloak.failNext("PUT /admin", { status: 503 });

  await assert.rejects(strapi.documents(IDAMBOX_USER_UID).update({ documentId: created.documentId, data: { firstName: "Alan", password: "new-password-2" } }));

  const row = await storedUser("alan@idambox.test");
  assert.equal(row?.firstName ?? null, null, "the Strapi change is rolled back");
  assert.equal(row?.password, null, "the new password hash is rolled back too");
  const account = keycloak.users.get(String(created.externalSubject));
  assert.equal(account?.firstName, undefined);
  assert.equal(account?.password, PASSWORD);

  await strapi.documents(IDAMBOX_USER_UID).update({ documentId: created.documentId, data: { firstName: "Alan", password: "new-password-2" } });
  assert.equal((await storedUser("alan@idambox.test"))?.firstName, "Alan");
  assert.equal(account?.firstName, "Alan");
  assert.equal(account?.password, "new-password-2");
});

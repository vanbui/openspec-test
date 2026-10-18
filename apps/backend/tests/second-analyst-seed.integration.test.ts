import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { seedAssessmentNavigationLifecycle } from "../src/bootstrap/seed-assessment-navigation-lifecycle";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";

/*
 * D-31: a second human Security Analyst, Sam Analyst, exists for development and E2E only. It is seeded behind
 * IDAMBOX_SEED_CSRM and the development identity, as the Secondary Requestor is, holds the Security Analyst role and
 * no other, and has no Keycloak fixture subject (ADR 0004): the development identity header names it by email.
 */

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = {
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
};
type RunningStrapi = {
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const SECOND_ANALYST_EMAIL = "sam.analyst@idambox.com";
const USER_UID = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "second-analyst-seed-tests");
const databaseFilename = path.join(databaseDir, `second-analyst-seed-${process.pid}.sqlite`);
const enabled = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };
const originalEnvironment = new Map(
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION"]
    .map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;

async function withSeedEnvironment(
  values: { nodeEnv?: string; environment?: string; identity?: string; seed?: string },
  action: () => Promise<void>,
) {
  const entries = [
    ["NODE_ENV", values.nodeEnv],
    ["CSRM_ENVIRONMENT", values.environment],
    ["CSRM_DEV_IDENTITY", values.identity],
    ["IDAMBOX_SEED_CSRM", values.seed],
  ] as const;
  const previous = new Map(entries.map(([name]) => [name, process.env[name]]));
  for (const [name, value] of entries) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await action();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function secondAnalysts(): Promise<Document[]> {
  return strapi.documents(USER_UID).findMany({
    filters: { email: { $eq: SECOND_ANALYST_EMAIL } },
    populate: { roles: true },
    limit: 10,
  });
}

before(async () => {
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "second-analyst-seed-test-1,second-analyst-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "second-analyst-seed-admin";
  process.env.API_TOKEN_SALT = "second-analyst-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "second-analyst-seed-transfer";
  process.env.ENCRYPTION_KEY = "second-analyst-seed-encryption";
  process.env.JWT_SECRET = "second-analyst-seed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = "false";
  process.env.STRAPI_ADMIN_AUTO_OPEN = "false";

  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  strapi = await strapiPackage.createStrapi(compiled).load();
  (strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();

  process.env.IDAMBOX_SEED_CSRM = "true";
  await seedCsrmData(strapi as never);
});

after(async () => {
  if (strapi) await strapi.destroy();
  await rm(databaseFilename, { force: true });
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("D-31 the second Security Analyst is not seeded without IDAMBOX_SEED_CSRM or without the development identity (T-13-25)", async () => {
  for (const values of [
    { ...enabled, seed: undefined },
    { ...enabled, seed: "false" },
    { ...enabled, identity: "false" },
    { ...enabled, identity: undefined },
    { ...enabled, nodeEnv: "production" },
    { ...enabled, environment: "production" },
  ]) await withSeedEnvironment(values, () => seedAssessmentNavigationLifecycle(strapi as never));

  assert.deepEqual(await secondAnalysts(), [], "SECOND_ANALYST_SEEDED_OUTSIDE_DEVELOPMENT");
});

test("D-31 seeding twice leaves one active Sam Analyst holding exactly the Security Analyst role and no Keycloak subject (T-13-26)", async () => {
  await withSeedEnvironment(enabled, () => seedAssessmentNavigationLifecycle(strapi as never));
  await withSeedEnvironment(enabled, () => seedAssessmentNavigationLifecycle(strapi as never));

  const users = await secondAnalysts();
  assert.equal(users.length, 1, "SECOND_ANALYST_NOT_EXACTLY_ONE");
  const [sam] = users;
  assert.equal(sam.displayName, "Sam Analyst");
  assert.equal(sam.firstName, "Sam");
  assert.equal(sam.lastName, "Analyst");
  assert.equal(sam.username, "sam.analyst");
  assert.equal(sam.accountStatus, "active");
  assert.ok(sam.externalSubject === null || sam.externalSubject === undefined, "SECOND_ANALYST_HAS_KEYCLOAK_SUBJECT");
  const roles = (sam.roles as Document[] | undefined) ?? [];
  assert.deepEqual(roles.map((role) => role.name), ["Security Analyst"], "SECOND_ANALYST_ROLES");
});

test("D-31 the second Security Analyst has no Keycloak fixture subject", async () => {
  const subjects = await readFile(path.join(appDir, "src", "keycloak", "development-fixture-subjects.ts"), "utf8");
  assert.equal(subjects.includes("sam.analyst"), false, "SECOND_ANALYST_KEYCLOAK_FIXTURE_SUBJECT");
});

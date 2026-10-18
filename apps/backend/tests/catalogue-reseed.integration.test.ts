import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import catalogue from "../src/bootstrap/idambox-csrm-role-function-api-catalogue.json";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";

/*
 * BE2-08 (Phase 19 code review): an existing database seeded before Phase 19 holds the two FunctionAPIs Phase 19 moved
 * (`GET:/api/v1/risks/export?format={format}` and `POST:/api/v1/reports/{reportKey}/export`) under their old Functions.
 * Re-seeding with the current catalogue must leave exactly one FunctionAPI row per catalogued URL, held by its
 * catalogued Function alone: no orphaned or stale row carries an export URL. The pre-Phase-19 database is made by
 * seeding PHASE_19_BASE's catalogue (`git show bdd0f698:...`) through the same seeder, then the current one.
 */

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = { findMany: (input: Record<string, unknown>) => Promise<Document[]> };
type RunningStrapi = { documents: (uid: string) => DocumentService; destroy: () => Promise<void> };
type Catalogue = typeof catalogue;

const PHASE_19_BASE = "bdd0f698";
const MOVED_URLS = ["GET:/api/v1/risks/export?format={format}", "POST:/api/v1/reports/{reportKey}/export"] as const;

const appDir = path.resolve(__dirname, "..", "..", "..");
const repositoryDir = path.resolve(appDir, "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "catalogue-reseed");
const databaseFilename = path.join(databaseDir, `catalogue-reseed-${process.pid}.sqlite`);
const originalEnvironment = new Map(
  [
    "APP_KEYS", "ADMIN_JWT_SECRET", "API_TOKEN_SALT", "TRANSFER_TOKEN_SALT", "ENCRYPTION_KEY", "JWT_SECRET",
    "DATABASE_CLIENT", "DATABASE_FILENAME", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE",
    "STRAPI_DISABLE_UPDATE_NOTIFICATION", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION",
  ].map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;
let baseCatalogue: Catalogue;
const beforeReseed = new Map<string, string[]>();

/** The seeder loaded with `fixture` in place of the bundled catalogue; the cached modules are restored afterwards. */
function seederWith(fixture: Catalogue): typeof seedCsrmData {
  const seederPath = require.resolve("../src/bootstrap/seed-csrm-data");
  const cataloguePath = require.resolve("../src/bootstrap/idambox-csrm-role-function-api-catalogue.json");
  const saved = { seeder: require.cache[seederPath], catalogue: require.cache[cataloguePath] };
  delete require.cache[seederPath];
  require.cache[cataloguePath] = { id: cataloguePath, filename: cataloguePath, loaded: true, exports: fixture } as unknown as NodeModule;
  try {
    return (require(seederPath) as { seedCsrmData: typeof seedCsrmData }).seedCsrmData;
  } finally {
    if (saved.seeder) require.cache[seederPath] = saved.seeder;
    else delete require.cache[seederPath];
    if (saved.catalogue) require.cache[cataloguePath] = saved.catalogue;
    else delete require.cache[cataloguePath];
  }
}

async function functionApisWithUrl(url: string): Promise<Document[]> {
  return strapi.documents("api::function-api.function-api").findMany({ filters: { url: { $eq: url } }, limit: 10 });
}

async function functionsHolding(functionApiDocumentId: string): Promise<Document[]> {
  return strapi.documents("api::function.function").findMany({
    filters: { functionApis: { documentId: { $eq: functionApiDocumentId } } },
    limit: 10,
  });
}

before(async () => {
  baseCatalogue = JSON.parse(execFileSync("git", ["show", `${PHASE_19_BASE}:apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`], {
    cwd: repositoryDir,
    encoding: "utf8",
  })) as Catalogue;

  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "catalogue-reseed-test-1,catalogue-reseed-test-2";
  process.env.ADMIN_JWT_SECRET = "catalogue-reseed-admin";
  process.env.API_TOKEN_SALT = "catalogue-reseed-api";
  process.env.TRANSFER_TOKEN_SALT = "catalogue-reseed-transfer";
  process.env.ENCRYPTION_KEY = "catalogue-reseed-encryption";
  process.env.JWT_SECRET = "catalogue-reseed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  // Strapi's SQLite config resolves this from the app root, so keep it relative.
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
  try {
    await seederWith(baseCatalogue)(strapi as never);
    for (const url of MOVED_URLS) beforeReseed.set(url, (await functionApisWithUrl(url)).map((row) => row.documentId));
    await seedCsrmData(strapi as never);
  } finally {
    process.env.IDAMBOX_SEED_CSRM = "false";
  }
});

after(async () => {
  if (strapi) await strapi.destroy();
  await rm(databaseFilename, { force: true });
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("the base catalogue placed each moved URL under its old Function, so the re-seed starts from a pre-Phase-19 database", () => {
  for (const url of MOVED_URLS) {
    const base = baseCatalogue.functionApis.find((entry) => entry.url === url);
    const current = catalogue.functionApis.find((entry) => entry.url === url);
    assert.ok(base && current, url);
    assert.notEqual(base.functionId, current.functionId, `${url} moved in Phase 19`);
    assert.equal(beforeReseed.get(url)?.length, 1, `${url} has one row before the re-seed`);
  }
});

test("after the re-seed each moved URL has exactly one FunctionAPI row, held by its catalogued Function alone (BE2-08)", async () => {
  for (const url of MOVED_URLS) {
    const rows = await functionApisWithUrl(url);
    assert.equal(rows.length, 1, `${url} FunctionAPI rows after the re-seed`);
    const owner = catalogue.functions.find((entry) => entry.id === catalogue.functionApis.find((api) => api.url === url)?.functionId);
    assert.ok(owner, url);
    const holders = await functionsHolding(rows[0]!.documentId);
    assert.deepEqual(holders.map((holder) => holder.name), [owner.name], `${url} is held by ${owner.name} alone`);
  }
});

test("after the re-seed no catalogued URL has an orphaned or second FunctionAPI row (BE2-08)", async () => {
  const problems: string[] = [];
  for (const url of new Set(catalogue.functionApis.map((entry) => entry.url))) {
    const rows = await functionApisWithUrl(url);
    const expected = catalogue.functionApis.filter((entry) => entry.url === url).length;
    if (rows.length !== expected) problems.push(`${url}: ${rows.length} rows, ${expected} catalogued`);
    for (const row of rows) {
      if ((await functionsHolding(row.documentId)).length === 0) problems.push(`${url}: orphaned row ${row.documentId}`);
    }
  }
  assert.deepEqual(problems, []);
});

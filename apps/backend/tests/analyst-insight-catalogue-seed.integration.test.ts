import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import catalogue from "../src/bootstrap/idambox-csrm-role-function-api-catalogue.json";
import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../src/api/csrm-analyst-insight/operations";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";

/*
 * D-33: the seed reconciles an API-only Function by name and application, so a
 * Function whose name collided with a menu Function, or one the reconciler could
 * not find again, would duplicate on every boot. Seeding twice into a fresh
 * database proves neither happens for the analyst insight Functions. Booting
 * also proves Strapi loads the `csrm-analyst-insight` API folder, which holds no
 * routes yet.
 */

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = { findMany: (input: Record<string, unknown>) => Promise<Document[]> };
type RunningStrapi = {
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "analyst-insight-catalogue-seed");
const databaseFilename = path.join(databaseDir, `analyst-insight-catalogue-seed-${process.pid}.sqlite`);
const originalEnvironment = new Map(
  [
    "APP_KEYS", "ADMIN_JWT_SECRET", "API_TOKEN_SALT", "TRANSFER_TOKEN_SALT", "ENCRYPTION_KEY", "JWT_SECRET",
    "DATABASE_CLIENT", "DATABASE_FILENAME", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE",
    "STRAPI_DISABLE_UPDATE_NOTIFICATION", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING",
  ].map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;

/* The five insight Functions are found through the operations they serve; names and urls come from the catalogue. */
const insightFunctions = Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS).map((url) => {
  const functionApi = catalogue.functionApis.find((entry) => entry.url === url);
  assert.ok(functionApi, `catalogue FunctionAPI for ${url}`);
  const catalogueFunction = catalogue.functions.find((entry) => entry.id === functionApi.functionId);
  assert.ok(catalogueFunction, `catalogue Function for ${url}`);
  return { name: catalogueFunction.name, url };
});

async function singleRoleNamed(name: string): Promise<Document> {
  const roles = await strapi.documents("api::role.role").findMany({
    filters: { name: { $eq: name } },
    populate: { functions: true },
    limit: 10,
  });
  assert.equal(roles.length, 1, `${name} role rows`);
  return roles[0]!;
}

function functionNames(role: Document): string[] {
  return (role.functions as Document[]).map((entry) => String(entry.name)).sort();
}

function urlsOf(platformFunction: Document): string[] {
  return (platformFunction.functionApis as Document[]).map((entry) => String(entry.url)).sort();
}

before(async () => {
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "analyst-insight-seed-test-1,analyst-insight-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "analyst-insight-seed-admin";
  process.env.API_TOKEN_SALT = "analyst-insight-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "analyst-insight-seed-transfer";
  process.env.ENCRYPTION_KEY = "analyst-insight-seed-encryption";
  process.env.JWT_SECRET = "analyst-insight-seed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  // Strapi's SQLite config resolves this from the app root, so keep it relative.
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.STRAPI_ADMIN_AUTO_OPEN = "false";

  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  strapi = await strapiPackage.createStrapi(compiled).load();
  (strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();

  // The seed flag is on only around the two seeds, as two boots would run them.
  process.env.IDAMBOX_SEED_CSRM = "true";
  try {
    await seedCsrmData(strapi as never);
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

test("seeding twice leaves one API-only Function and one FunctionAPI per analyst insight operation", async () => {
  assert.equal(insightFunctions.length, 5);
  for (const insight of insightFunctions) {
    const functions = await strapi.documents("api::function.function").findMany({
      filters: { name: { $eq: insight.name } },
      populate: { functionApis: true },
      limit: 10,
    });
    assert.equal(functions.length, 1, `${insight.name} Function rows`);
    assert.equal(functions[0]!.menuPath ?? null, null, `${insight.name} is API-only`);
    assert.deepEqual(urlsOf(functions[0]!), [insight.url], `${insight.name} FunctionAPIs`);

    const functionApis = await strapi.documents("api::function-api.function-api").findMany({
      filters: { url: { $eq: insight.url } },
      limit: 10,
    });
    assert.equal(functionApis.length, 1, `${insight.url} FunctionAPI rows`);
  }
});

test("the Security Analyst role holds exactly the catalogue's Function set after re-seeding", async () => {
  const analystRole = catalogue.roles.find((entry) => entry.id === "role.security_analyst");
  assert.ok(analystRole);
  // A sorted list, not a set: a Function name may legitimately repeat across menu groupings.
  const expected = analystRole.functionIds.map((functionId) => {
    const catalogueFunction = catalogue.functions.find((entry) => entry.id === functionId);
    assert.ok(catalogueFunction, functionId);
    return catalogueFunction.name;
  }).sort();
  assert.deepEqual(functionNames(await singleRoleNamed("Security Analyst")), expected);
});

test("neither the Security Analyst Agent nor the Requestor role holds an analyst insight Function", async () => {
  for (const roleName of ["Security Analyst Agent", "Requestor"]) {
    const held = new Set(functionNames(await singleRoleNamed(roleName)));
    assert.deepEqual(insightFunctions.filter(({ name }) => held.has(name)).map(({ name }) => name), [], roleName);
  }
});

test("the Dashboard, Reports and Alerts menu Functions keep only their unserved FunctionAPIs", async () => {
  for (const [name, menuPath, urls] of [
    ["Dashboard", "Dashboard:Dashboard", ["GET:/api/v1/dashboard/alerts", "GET:/api/v1/dashboard/reports"]],
    ["Reports", "Reports:Reports", ["POST:/api/v1/reports/{reportKey}/export"]],
    ["Alerts", "Reports:Alerts", ["GET:/api/v1/alerts/{alertId}", "PATCH:/api/v1/alerts/{alertId}/acknowledge"]],
  ] as const) {
    const functions = await strapi.documents("api::function.function").findMany({
      filters: { name: { $eq: name }, menuPath: { $eq: menuPath } },
      populate: { functionApis: true },
      limit: 10,
    });
    assert.equal(functions.length, 1, `${name} menu Function rows`);
    assert.deepEqual(urlsOf(functions[0]!), [...urls].sort(), `${name} menu FunctionAPIs`);
  }
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import catalogue from "../src/bootstrap/idambox-csrm-role-function-api-catalogue.json";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const appDir = path.resolve(__dirname, "../../..");
const savedEnvironment = { ...process.env };
const savedFetch = globalThis.fetch;
let backend: Core.Strapi | undefined;
let compiledDir: string;
let privateDir: string;
let remoteCalls = 0;

function backendModule<T>(relativePath: string): T {
  return require(path.join(compiledDir, "src", relativePath)) as T;
}
const manifest = {
  name: "midPoint (dev)", username: "midpoint-dev-provisioning",
  email: "midpoint-dev-provisioning@idambox.test", displayName: "midPoint (dev) provisioning",
};

before(async () => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.join(appDir, ".tmp"), { recursive: true });
  privateDir = await mkdtemp(path.join(appDir, ".tmp/journey-bootstrap-"));
  const envPath = path.join(privateDir, "backend.env");
  await writeFile(envPath, "", { mode: 0o600, flag: "wx" });
  Object.assign(process.env, {
    NODE_ENV: "development", ENV_PATH: envPath,
    APP_KEYS: "journey-bootstrap-test-1,journey-bootstrap-test-2", ADMIN_JWT_SECRET: "test-admin",
    API_TOKEN_SALT: "test-api", TRANSFER_TOKEN_SALT: "test-transfer", ENCRYPTION_KEY: "test-encryption", JWT_SECRET: "test-jwt",
    DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(privateDir, "fresh.sqlite")),
    IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_IAM: "false",
    IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
    CSRM_AUTH_OIDC_ENABLED: "false", STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", STRAPI_TELEMETRY_DISABLED: "true",
  });
  // Strapi's own daily update check (createStrapi, cached per user) is refused but not counted:
  // it is framework traffic, not provisioning, email or session transport.
  globalThis.fetch = async input => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== "https://registry.npmjs.org/@strapi%2Fcore") remoteCalls++;
    throw new Error("JOURNEY_UNEXPECTED_REMOTE_CALL");
  };
  const { compileStrapi, createStrapi } = require("@strapi/strapi") as typeof import("@strapi/strapi");
  const compiled = await compileStrapi({ appDir });
  assert.ok(compiled.distDir);
  compiledDir = compiled.distDir;
  backendModule<typeof import("../src/bootstrap/boot-mode")>("bootstrap/boot-mode").markAdministrationBoot();
  backend = createStrapi(compiled);
  await backend.load();
  backend.cron.destroy();
});

after(async () => {
  try { await backend?.destroy(); }
  finally {
    globalThis.fetch = savedFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
    Object.assign(process.env, savedEnvironment);
    if (privateDir) await rm(privateDir, { recursive: true, force: true });
  }
});

test("fresh administration bootstrap initializes only approved source prerequisites", async t => {
  assert.ok(backend);
  const strapi = backend;
  const { registerIdentitySource } = backendModule<typeof import("../src/iam/identity/source-registration")>("iam/identity/source-registration");
  const { seedCoreData } = backendModule<typeof import("../src/bootstrap/seed-core-data")>("bootstrap/seed-core-data");
  const { seedCapabilityCatalogue } = backendModule<typeof import("../src/bootstrap/seed-csrm-data")>("bootstrap/seed-csrm-data");
  async function initialize() {
    const previous = process.env.IDAMBOX_SEED_CORE;
    try { process.env.IDAMBOX_SEED_CORE = "true"; await seedCoreData(strapi); }
    finally {
      if (previous === undefined) delete process.env.IDAMBOX_SEED_CORE;
      else process.env.IDAMBOX_SEED_CORE = previous;
    }
    return seedCapabilityCatalogue(strapi);
  }

  await t.test("missing provisioning grant refuses before writing a service user", async () => {
    assert.equal(await strapi.documents(USER).count({}), 0);
    assert.equal(await strapi.documents(SOURCE).count({}), 0);
    assert.equal(await strapi.documents("api::application.application").count({}), 0);
    await assert.rejects(registerIdentitySource(strapi, manifest), { message: "IAM_SOURCE_PROVISIONING_GRANT" });
    assert.equal(await strapi.documents(USER).count({}), 0);
    assert.equal(await strapi.documents(SOURCE).count({}), 0);
  });

  await t.test("explicit core and catalogue seed the exact active IAM grant without fixtures", async () => {
    const roles = await initialize();
    const apps = await strapi.documents("api::application.application").findMany({ filters: { slug: "idambox-iam" } });
    assert.equal(apps.length, 1);
    assert.equal(apps[0].applicationStatus, "active");
    const provisioners = await strapi.documents("api::role.role").findMany({ filters: { name: "Identity Provisioning" },
      populate: { functions: { populate: { application: true, functionApis: true } } } });
    assert.equal(provisioners.length, 1);
    const role = provisioners[0];
    assert.ok([...roles.values()].some(value => value.documentId === role.documentId));
    assert.equal(role.functions?.length, 1);
    const fn = role.functions![0];
    assert.equal(fn.name, "Identity Provisioning");
    assert.equal(fn.menuPath, null);
    assert.equal(fn.application?.documentId, apps[0].documentId);
    const expected = catalogue.functionApis.filter(api => api.functionId === "function.identity_provisioning.api");
    assert.equal(fn.functionApis?.length, expected.length);
    assert.deepEqual(fn.functionApis!.map(api => api.url).sort(), expected.map(api => api.url).sort());
    assert.equal(await strapi.documents(USER).count({}), 0);
    assert.equal(await strapi.documents("api::csrm-control.csrm-control").count({}), 0);
    assert.equal(await strapi.documents("api::csrm-information-system.csrm-information-system").count({}), 0);
    assert.equal(process.env.IDAMBOX_SEED_CORE, "false");
  });

  await t.test("repeated catalogue initialization preserves all document identifiers", async () => {
    const snapshot = async () => {
      const uids = ["api::application.application", "api::role.role", "api::function.function", "api::function-api.function-api"] as const;
      return Promise.all(uids.map(async uid => (await strapi.documents(uid).findMany({ limit: 1000 }))
        .map(row => row.documentId).sort()));
    };
    const previous = await snapshot();
    await initialize();
    assert.deepEqual(await snapshot(), previous);
    assert.equal(await strapi.documents(USER).count({}), 0);
  });

  const registered = await registerIdentitySource(strapi, manifest);
  await t.test("trusted registration creates only its protected source service", async () => {
    assert.equal(await strapi.documents(USER).count({}), 1);
    assert.equal(await strapi.documents(SOURCE).count({}), 1);
    const user = await strapi.documents(USER).findFirst({ populate: { roles: true, identitySource: true } });
    assert.ok(user);
    assert.equal(user.protected, true);
    assert.equal(user.externalSubject, null);
    assert.equal(user.identitySource, null);
    assert.equal(user.password, null);
    assert.equal(user.username, manifest.username);
    assert.deepEqual(user.roles?.map(role => role.name), ["Identity Provisioning"]);
    assert.equal((await registerIdentitySource(strapi, manifest)).documentId, registered.documentId);
    assert.equal(await strapi.documents(USER).count({}), 1);
  });

  await t.test("private issuance then CLI rotation authenticates only the registered source", async () => {
    const tokens = backendModule<typeof import("../src/iam/scim/token-service")>("iam/scim/token-service");
    const { runTokenCli } = backendModule<typeof import("../src/iam/scim/token-cli")>("iam/scim/token-cli");
    // A freshly registered source has no credential to rotate until initial issuance.
    await assert.rejects(tokens.administerSourceToken(strapi, registered.documentId, "rotate"),
      { message: "IAM_SCIM_TOKEN_PRECONDITION" });
    const initial = await tokens.administerSourceToken(strapi, registered.documentId, "issue");
    assert.ok("token" in initial);
    let privateOutput = "";
    let destroyed = false;
    const exitCode = await runTokenCli([manifest.name, "rotate"], {
      createBackend: async () => ({ load: async () => undefined, destroy: async () => { destroyed = true; } }),
      administer: async (_instance, selector, action) => tokens.administerSourceToken(strapi, selector, action),
      validateExport: async () => { assert.fail("no developer export"); },
      exportToken: async () => { assert.fail("no developer export"); },
      revokeUndelivered: async () => { assert.fail("private delivery succeeds"); },
      stdout: async line => { privateOutput += line; },
      stderr: () => { assert.fail("no command error"); },
    });
    assert.equal(exitCode, 0);
    assert.equal(destroyed, true);
    assert.equal(privateOutput.split("\n").length, 2);
    const token = privateOutput.trim();
    assert.ok(tokens.parseSourceToken(token)?.sourceDocumentId === registered.documentId, "one scoped credential");
    const authentication = backendModule<typeof import("../src/iam/scim/source-context")>("iam/scim/source-context");
    const context = { request: { header: { authorization: `Bearer ${token}` } } };
    const resolved = await authentication.authenticateSourceRequest(strapi, context);
    assert.ok(resolved.ok);
    assert.equal(resolved.value.sourceDocumentId, registered.documentId);
    assert.ok((await authentication.requireSourceOperation(strapi, context, "POST:/scim/v2/Users")).ok);
    assert.equal((await authentication.requireSourceOperation(strapi, context, "POST:/api/idambox-users")).ok, false);
    assert.equal((await authentication.authenticateSourceRequest(strapi,
      { request: { header: { authorization: `Bearer ${initial.token}` } } })).ok, false);
    privateOutput = "";
    assert.equal(remoteCalls, 0, "no provisioning, email or session transport");
    assert.equal(await strapi.documents(USER).count({}), 1);
  });
});

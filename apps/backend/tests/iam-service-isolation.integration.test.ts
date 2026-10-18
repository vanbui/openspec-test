import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import { resolveSourcePrincipal, validateSourcePrincipal, isRegisteredSourceServiceUser, registeredSourceServiceUserDocumentIds } from "../src/iam/identity/source-principal";
import { loadEffectiveGrants, isHumanSecurityAnalyst, type AuthorizationStrapi } from "../src/policies/csrm-authorization";
import csrmAuthorization from "../src/policies/csrm-authorization";
import { isEligiblePerson } from "../src/csrm/people/eligible-person";
import { startFakeKeycloakServer, FAKE_KEYCLOAK_REALM, FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET } from "./helpers/fake-keycloak-server";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-isolation-${process.pid}`);
const environment = {
  APP_KEYS: "isolation-1,isolation-2", ADMIN_JWT_SECRET: "isolation-admin", API_TOKEN_SALT: "isolation-api",
  TRANSFER_TOKEN_SALT: "isolation-transfer", ENCRYPTION_KEY: "isolation-encryption", JWT_SECRET: "isolation-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "isolation.sqlite")),
  IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local", CSRM_ATTACHMENT_SCANNER: "development",
  CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
  KEYCLOAK_BASE_URL: "", KEYCLOAK_REALM: FAKE_KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID: FAKE_KEYCLOAK_CLIENT_ID,
  KEYCLOAK_ADMIN_CLIENT_SECRET: FAKE_KEYCLOAK_CLIENT_SECRET,
};
const saved = new Map(Object.keys(environment).map((key) => [key, process.env[key]]));
const runtime = require("@strapi/strapi") as {
  compileStrapi(options: { appDir: string }): Promise<{ appDir: string; distDir: string }>;
  createStrapi(options: { appDir: string; distDir: string }): Core.Strapi;
};
let compiled: { appDir: string; distDir: string };
let strapi: Core.Strapi;
let registerIdentitySource: typeof import("../src/iam/identity/source-registration").registerIdentitySource;
let runManualProtection: typeof import("../src/iam/identity/write-context").runManualProtection;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>>;
let applicationId: string;
let functionId: string;
let roleId: string;
let analystId: string;
let ordinaryRoleId: string;
const operation = "GET:/api/v1/assessment_requests/review";
async function boot() {
  registerIdentitySource = require(path.join(compiled.distDir, "src/iam/identity/source-registration")).registerIdentitySource;
  runManualProtection = require(path.join(compiled.distDir, "src/iam/identity/write-context")).runManualProtection;
  strapi = runtime.createStrapi(compiled);
  await strapi.load();
  strapi.cron?.destroy();
}
const authorization = () => strapi as unknown as AuthorizationStrapi;
before(async () => {
  Object.assign(process.env, environment);
  await mkdir(fixtureDir, { recursive: true });
  remote = await startFakeKeycloakServer();
  process.env.KEYCLOAK_BASE_URL = remote.baseUrl;
  compiled = await runtime.compileStrapi({ appDir });
  await boot();
  const app = await strapi.documents("api::application.application").create({ data: { name: "IdamBox IAM", slug: "idambox-iam", applicationStatus: "active" } });
  applicationId = app.documentId;
  const fn = await strapi.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: applicationId } });
  functionId = fn.documentId;
  roleId = (await strapi.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [functionId] } })).documentId;
  const api = await strapi.documents("api::function-api.function-api").create({ data: { name: "Review", url: operation } });
  const humanFn = await strapi.documents("api::function.function").create({ data: { name: "Review", application: applicationId, functionApis: [api.documentId] } });
  ordinaryRoleId = (await strapi.documents("api::role.role").create({ data: { name: "Ordinary Role" } })).documentId;
  analystId = (await strapi.documents("api::role.role").create({ data: { name: "Security Analyst", functions: [humanFn.documentId] } })).documentId;
  await strapi.documents("api::role.role").create({ data: { name: "Requestor", functions: [humanFn.documentId] } });
});
after(async () => {
  await strapi?.destroy();
  await remote?.close();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("fresh branded principal refuses forged, stale, inactive and invalid service grants", async () => {
  const source = await registerIdentitySource(strapi, { name: "Isolation", username: "isolation-service", email: "isolation@idambox.test", displayName: "Isolation" });
  const userId = source.serviceUser.documentId;
  assert.equal(source.tokenHash ?? null, null);
  const principal = await resolveSourcePrincipal(strapi, source.documentId);
  assert.ok(principal, "trusted internal resolution does not authenticate a bearer token");
  assert.equal(await validateSourcePrincipal(strapi, { ...principal }), null);
  assert.equal(await resolveSourcePrincipal(strapi, "missing"), null);
  assert.ok(await validateSourcePrincipal(strapi, principal));
  const mutations = [
    { uid: SOURCE, id: source.documentId, data: { sourceStatus: "inactive" }, restore: { sourceStatus: "active" } },
    { uid: USER, id: userId, data: { accountStatus: "inactive" }, restore: { accountStatus: "active" } },
    { uid: USER, id: userId, data: { protected: false }, restore: { protected: true } },
    { uid: USER, id: userId, data: { externalSubject: "unexpected" }, restore: { externalSubject: null } },
    { uid: USER, id: userId, data: { password: "unexpected" }, restore: { password: null } },
    { uid: USER, id: userId, data: { roles: [] }, restore: { roles: [roleId] } },
    { uid: USER, id: userId, data: { roles: [roleId, analystId] }, restore: { roles: [roleId] } },
    { uid: "api::role.role", id: roleId, data: { functions: [] }, restore: { functions: [functionId] } },
    { uid: "api::role.role", id: roleId, data: { functions: [functionId, (await strapi.documents("api::function.function").create({ data: { name: "Extra", application: applicationId } })).documentId] }, restore: { functions: [functionId] } },
    { uid: "api::function.function", id: functionId, data: { menuPath: "/unexpected" }, restore: { menuPath: null } },
    { uid: "api::application.application", id: applicationId, data: { applicationStatus: "inactive" }, restore: { applicationStatus: "active" } },
  ];
  for (const mutation of mutations) {
    const service = strapi.documents(mutation.uid as typeof USER) as unknown as { update(input: { documentId: string; data: unknown }): Promise<unknown> };
    if (mutation.uid !== SOURCE) {
      await assert.rejects(service.update({ documentId: mutation.id, data: mutation.data }), /IAM_IDENTITY_FORBIDDEN|IAM_SOURCE_SERVICE_INVARIANT|IAM_SOURCE_PROVISIONING_GRANT/);
      assert.ok(await validateSourcePrincipal(strapi, principal), "refused corruption leaves the principal valid");
      continue;
    }
    await service.update({ documentId: mutation.id, data: mutation.data });
    try {
      assert.equal(await resolveSourcePrincipal(strapi, source.documentId), null);
      assert.equal(await validateSourcePrincipal(strapi, principal), null);
      assert.equal(await isRegisteredSourceServiceUser(strapi, userId), true);
      assert.ok((await registeredSourceServiceUserDocumentIds(strapi)).includes(userId));
      const grants = await loadEffectiveGrants(authorization(), { documentId: userId });
      if (grants) {
        assert.deepEqual(grants.requestorRoles, []);
        assert.deepEqual(grants.explicitRoles.map((role) => role.name).filter((name) => name !== "Identity Provisioning"), []);
        assert.equal(isEligiblePerson({ accountStatus: "active", roles: grants.explicitRoles, registeredSourceService: grants.registeredSourceService }), false);
      }
      assert.equal(await isHumanSecurityAnalyst(authorization(), { documentId: userId }, operation), false);
      assert.equal(await csrmAuthorization({ params: {}, state: { idamboxUser: { documentId: userId } } }, { operation }, { strapi }), false);
    } finally { await service.update({ documentId: mutation.id, data: mutation.restore }); }
  }
  const replacement = await registerIdentitySource(strapi, { name: "Replacement", username: "replacement-service", email: "replacement@idambox.test", displayName: "Replacement" });
  await assert.rejects(strapi.documents(SOURCE).delete({ documentId: replacement.documentId }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(SOURCE).update({ documentId: source.documentId, data: { serviceUser: replacement.serviceUser.documentId } }), /IAM_IDENTITY_FORBIDDEN/);
  await assert.rejects(strapi.documents(SOURCE).delete({ documentId: source.documentId }), /IAM_IDENTITY_FORBIDDEN/);
  assert.ok(await validateSourcePrincipal(strapi, principal));
  assert.equal(await isRegisteredSourceServiceUser(strapi, userId), true);
});

test("protected humans and ordinary role holders retain human birthright; unbound provisioning grants are refused", async () => {
  await assert.rejects(strapi.documents(USER).create({ data: {
    username: "unbound-provisioning", email: "unbound-provisioning@idambox.test", displayName: "Unbound", protected: false,
    accountStatus: "active", roles: [roleId],
  } }), /IAM_IDENTITY_FORBIDDEN/);
  for (const [label, protectedValue, roles] of [["protected-person", true, [analystId]], ["ordinary-person", false, []], ["ordinary-role", true, [ordinaryRoleId]]] as const) {
    const user = await strapi.documents(USER).create({ data: { username: label, email: `${label}@idambox.test`, displayName: label, protected: false, accountStatus: "active", roles: [...roles] } });
    if (protectedValue) await runManualProtection(strapi, user.documentId, true);
    assert.equal(await isRegisteredSourceServiceUser(strapi, user.documentId), false);
    const identity = { documentId: user.documentId };
    const grants = await loadEffectiveGrants(authorization(), identity);
    assert.ok(grants);
    assert.equal(grants.registeredSourceService, false);
    assert.deepEqual(grants.requestorRoles.map((role) => role.name), ["Requestor"]);
    assert.equal(isEligiblePerson({ accountStatus: "active", roles: grants.explicitRoles, registeredSourceService: grants.registeredSourceService }), true);
    assert.equal(await isHumanSecurityAnalyst(authorization(), identity, operation), label === "protected-person");
    assert.equal(await csrmAuthorization({ params: {}, state: { idamboxUser: identity } }, { operation }, { strapi }), true);
  }
});

test("normal opt-in bootstrap reuses one source with provisioning off and on without remote calls", async () => {
  for (const enabled of [false, true]) {
    await strapi.destroy();
    process.env.IDAMBOX_SEED_IAM = "true";
    process.env.IDAMBOX_KEYCLOAK_PROVISIONING = String(enabled);
    for (let restart = 0; restart < 2; restart++) {
      await boot();
      const sources = await strapi.documents(SOURCE).findMany({ filters: { name: "midPoint (dev)" }, populate: { serviceUser: true } });
      assert.equal(sources.length, 1);
      assert.ok(await resolveSourcePrincipal(strapi, sources[0].documentId));
      assert.equal(remote.requests.length, 0);
      if (restart === 0) await strapi.destroy();
    }
  }
});

import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { createIdentityService } from "../src/iam/identity/identity-service";
import type { SourcePrincipal } from "../src/iam/identity/source-principal";
import { parseScimQuery, toScimListResponse } from "../src/iam/scim/query";

const USER = "api::idambox-user.idambox-user";
const appDir = path.resolve(__dirname, "../../..");
const fixtureDir = path.join(appDir, ".tmp", `iam-scim-query-${process.pid}`);
const environment = {
  APP_KEYS: "identity-1,identity-2", ADMIN_JWT_SECRET: "identity-admin", API_TOKEN_SALT: "identity-api",
  TRANSFER_TOKEN_SALT: "identity-transfer", ENCRYPTION_KEY: "identity-encryption", JWT_SECRET: "identity-jwt",
  DATABASE_CLIENT: "sqlite", DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "identity.sqlite")),
  IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_IAM: "false",
  IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
  CSRM_AUTH_OIDC_ENABLED: "false", STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", CSRM_ATTACHMENT_STORAGE: "local",
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
const dto = (name: string, sourceExternalId = name) => ({ username: name, email: `${name}@identity.test`,
  displayName: name, accountStatus: "active" as const, sourceExternalId });
function value<T>(outcome: { ok: true; value: T } | { ok: false }): T {
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
  service = (require(path.join(compiledDir, "src/iam/identity/identity-service")) as typeof import("../src/iam/identity/identity-service")).createIdentityService(strapi);
});
after(async () => {
  await strapi?.destroy();
  await rm(fixtureDir, { recursive: true, force: true });
  for (const [key, old] of saved) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});

async function list(entries: Array<[string, string]> = [], principal = first) {
  const parsed = value(parseScimQuery(entries));
  const result = value(await service.listForSource(principal, parsed.list));
  return { result, response: toScimListResponse(result, parsed) };
}
test("real persistence scopes own/manual records before filtering, counts and deterministic pages", async () => {
  const owned = value(await service.createFromSource(first, { ...dto("Alpha", " 00Ab "), employeeNumber: "EmpAb" }));
  const human = await manual("Manual");
  const foreign = value(await service.createFromSource(second, { ...dto("Foreign"), employeeNumber: "EmpAb" }));
  const protectedUser = await manual("Protected");
  const { runManualProtection } = require(path.join(compiledDir, "src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
  await runManualProtection(strapi, protectedUser.documentId, true);
  const deleted = value(await service.createFromSource(first, { ...dto("Deleted"), employeeNumber: "EmpAb" }));
  value(await service.deactivateFromSource(first, deleted.documentId, true));
  const all = await list();
  assert.equal(all.result.total, 2);
  assert.deepEqual(all.result.items.map((item) => item.documentId), [owned.documentId, human.documentId]);
  for (const id of [foreign.documentId, protectedUser.documentId, deleted.documentId]) {
    assert.deepEqual(await service.readForSource(first, id), { ok: false, code: "notFound" });
  }
  const page1 = await list([["count", "1"]]);
  const page2 = await list([["count", "1"], ["startIndex", "2"]]);
  assert.equal(page1.result.total, 2); assert.equal(page2.result.total, 2);
  assert.equal(page1.result.items[0].documentId, owned.documentId);
  assert.equal(page2.result.items[0].documentId, human.documentId);
  const zero = await list([["count", "0"]]);
  assert.equal(zero.response.totalResults, 2); assert.equal(zero.response.itemsPerPage, 0);
  assert.equal("Resources" in zero.response, false);
  const beyond = await list([["startIndex", "999"]]);
  assert.equal(beyond.response.totalResults, 2); assert.deepEqual(beyond.response.Resources, []);
  assert.equal((await list([["filter", 'employeeNumber eq "empab"']])).result.total, 1);
  for (const name of ["Foreign", "Protected", "Deleted"]) assert.equal((await list([["filter", `userName eq "${name}"`]])).result.total, 0);
  assert.equal((await list([], second)).result.total, 2);
});
test("database comparisons ignore case only for supported non-key fields; opaque keys remain exact", async () => {
  for (const filter of ['userName eq "aLPHa"', 'emails.value eq "ALPHA@IDENTITY.TEST"',
    'employeeNumber eq "eMPaB"', 'userName eq "ALPHA" and employeeNumber eq "EMPAB"', 'externalId eq " 00Ab "']) {
    assert.equal((await list([["filter", filter]])).result.total, 1);
  }
  for (const opaque of [" 00ab ", "00Ab", " 00AB "]) assert.equal((await list([["filter", `externalId eq "${opaque}"`]])).result.total, 0);
  const escaped = 'a"\\b';
  value(await service.createFromSource(first, dto("Escaped", escaped)));
  assert.equal((await list([["filter", `externalId eq ${JSON.stringify(escaped)}`]])).result.total, 1);
  assert.equal((await list([["filter", 'userName eq "Alpha%"']])).result.total, 0);
  assert.equal((await list([["filter", 'userName eq "Alph_"']])).result.total, 0);
  value(await service.createFromSource(first, { ...dto("Literal%_Name"), employeeNumber: "Emp%_Number" }));
  for (const filter of ['userName eq "literal%_name"', 'emails.value eq "LITERAL%_NAME@IDENTITY.TEST"',
    'employeeNumber eq "emp%_number"', 'userName eq "literal%_name" and employeeNumber eq "EMP%_NUMBER"']) {
    assert.equal((await list([["filter", filter]])).result.total, 1);
    const zero = await list([["filter", filter], ["count", "0"]]);
    assert.equal(zero.result.total, 1); assert.deepEqual(zero.result.items, []);
    const beyond = await list([["filter", filter], ["startIndex", "2"]]);
    assert.equal(beyond.result.total, 1); assert.deepEqual(beyond.result.items, []);
  }
  assert.equal((await list([["filter", 'userName eq "Alpha\' OR 1=1 --"']])).result.total, 0);
  value(await service.createFromSource(first, { ...dto("slash-literal"), employeeNumber: "Back\\Slash" }));
  assert.equal((await list([["filter", `employeeNumber eq ${JSON.stringify("BACK\\SLASH")}`]])).result.total, 1);
  assert.equal((await list([["filter", `employeeNumber eq ${JSON.stringify("OTHER\\SLASH")}`]])).result.total, 0);
});
test("internal comparison extension rejects nonallowlisted fields and leaves legacy equality exact", async () => {
  assert.equal(value(await service.listForSource(first, { filter: { field: "username", eq: "alpha" } })).total, 0);
  assert.equal(value(await service.listForSource(first, { filter: { field: "username", eq: "Alpha" } })).total, 1);
  for (const field of ["sourceExternalId", "documentId", "department", "displayName", "password", "__proto__"]) {
    assert.deepEqual(await service.listForSource(first, { filter: { field, eq: "x", caseInsensitive: true } } as never), { ok: false, code: "invalidInput" });
  }
  for (const option of [false, "true", 1, null]) {
    assert.deepEqual(await service.listForSource(first, { filter: { field: "username", eq: "Alpha", caseInsensitive: option } } as never), { ok: false, code: "invalidInput" });
  }
  assert.deepEqual(await service.listForSource(first, { filter: { field: "username", eq: "Alpha", $or: [] } } as never), { ok: false, code: "invalidInput" });
});
test("response projection uses persisted public fields and never broadens the service projection", async () => {
  const { response, result } = await list([["filter", 'userName eq "ALPHA"'], ["attributes", "USERNAME,emails.value"]]);
  assert.equal(response.totalResults, 1);
  assert.deepEqual(response.Resources, [{ id: result.items[0].documentId,
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User", "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"],
    userName: "Alpha", emails: [{ value: "Alpha@identity.test" }] }]);
  for (const field of ["roles", "protected", "externalSubject", "identitySource", "sourceIdentityKey", "sourceDeletedAt", "lastSyncedAt"]) {
    assert.equal(field in result.items[0], false);
  }
  const manualResponse = await list([["filter", 'userName eq "manual"']]);
  assert.equal(manualResponse.response.Resources?.[0].externalId, undefined);
});
test("literal refinement excludes false matches and hidden rows before page offsets and totals", async () => {
  value(await service.createFromSource(first, { ...dto("wild-decoy"), employeeNumber: "WildZZKey" }));
  const owned = value(await service.createFromSource(first, { ...dto("wild-owned"), employeeNumber: "Wild%_Key" }));
  const human = await manual("wild-manual");
  await strapi.documents(USER).update({ documentId: human.documentId, data: { employeeNumber: "Wild%_Key" } });
  value(await service.createFromSource(second, { ...dto("wild-foreign"), employeeNumber: "Wild%_Key" }));
  const deleted = value(await service.createFromSource(first, { ...dto("wild-deleted"), employeeNumber: "Wild%_Key" }));
  value(await service.deactivateFromSource(first, deleted.documentId, true));
  const protectedUser = await manual("wild-protected");
  await strapi.documents(USER).update({ documentId: protectedUser.documentId, data: { employeeNumber: "Wild%_Key" } });
  const { runManualProtection } = require(path.join(compiledDir, "src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
  await runManualProtection(strapi, protectedUser.documentId, true);
  const filter: [string, string] = ["filter", 'employeeNumber eq "wild%_key"'];
  assert.equal((await list([filter, ["count", "0"]])).result.total, 2);
  const page1 = await list([filter, ["count", "1"]]);
  const page2 = await list([filter, ["count", "1"], ["startIndex", "2"]]);
  assert.equal(page1.result.total, 2); assert.equal(page2.result.total, 2);
  assert.deepEqual(page1.result.items.map((item) => item.documentId), [owned.documentId]);
  assert.deepEqual(page2.result.items.map((item) => item.documentId), [human.documentId]);
  assert.deepEqual((await list([filter, ["startIndex", "3"]])).result.items, []);
});

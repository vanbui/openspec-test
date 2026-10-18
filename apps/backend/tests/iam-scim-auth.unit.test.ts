import assert from "node:assert/strict";
import { test } from "node:test";
import type { Core } from "@strapi/strapi";
import { authenticateSourceRequest, getSourceContext, requireSourceOperation } from "../src/iam/scim/source-context";
import policy from "../src/policies/scim-source-bearer";
import { hashSourceToken } from "../src/iam/scim/token-service";

const operation = "GET:/scim/v2/Users";
const sourceId = "a".repeat(24);
const token = `idb_scim_v1.${sourceId}.${Buffer.alloc(32, 7).toString("base64url")}`;
function fixture() {
  const application = { slug: "idambox-iam", applicationStatus: "active" };
  const fn = { name: "Identity Provisioning", menuPath: null, application, functionApis: [{ url: operation }] };
  const user = { documentId: "service", accountStatus: "active", protected: true, password: null,
    externalSubject: null, identitySource: null, sourceExternalId: null, sourceIdentityKey: null,
    roles: [{ name: "Identity Provisioning", functions: [fn] }] };
  const source = { documentId: sourceId, sourceStatus: "active", tokenHash: hashSourceToken(token), serviceUser: { documentId: "service" } };
  let writes = 0;
  const logs: string[] = [];
  const bindings = [source];
  const strapi = { documents: (uid: string) => ({
    findOne: async () => uid.includes("identity-source") ? source : user,
    findMany: async () => bindings,
    update: async () => { writes++; return source; },
  }), db: { inTransaction: () => false, transaction: async (work: () => Promise<unknown>) => work() },
  log: { error: (message: string) => logs.push(message) } } as unknown as Core.Strapi;
  const ctx = (authorization: unknown = `Bearer ${token}`) => ({ request: { header: { authorization } }, state: {} });
  return { strapi, ctx, user, source, fn, bindings, logs, writes: () => writes };
}
function status(result: Awaited<ReturnType<typeof authenticateSourceRequest>>): number {
  assert.equal(result.ok, false); if (result.ok) throw new Error("Expected refusal"); return result.error.status;
}
test("exact bearer grammar refuses absent, malformed and unrelated credentials identically without activity", async () => {
  const f = fixture();
  let expected: unknown;
  for (const credential of [null, "", "Basic abc", "Bearer\t" + token, `Bearer ${token} `,
    `Bearer ${token}, Bearer ${token}`, [`Bearer ${token}`], "Bearer csrm-api", "Bearer human-keycloak", `Bearer ${token.slice(0, -1)}A`]) {
    const result = await authenticateSourceRequest(f.strapi, f.ctx(credential));
    assert.equal(status(result), 401);
    if (!result.ok) { assert.equal(result.error.headers["WWW-Authenticate"], "Bearer"); expected ??= result; assert.deepEqual(result, expected); }
  }
  assert.equal(f.writes(), 0);
});
test("Bearer schemes ignore case and accept spaces while credential bytes remain exact", async () => {
  const f = fixture();
  for (const scheme of ["Bearer", "bearer", "BEARER", "bEaReR"]) {
    for (const separator of [" ", "   "]) {
      const ctx = f.ctx(`${scheme}${separator}${token}`);
      assert.ok((await authenticateSourceRequest(f.strapi, ctx)).ok);
      assert.ok((await requireSourceOperation(f.strapi, ctx, operation)).ok);
    }
  }
  assert.equal(status(await authenticateSourceRequest(f.strapi, f.ctx(`bearer ${token.toUpperCase()}`))), 401);
  assert.equal(f.writes(), 8);
});
test("all binding invariants fail closed with the same credential refusal", async () => {
  const changes: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.source.sourceStatus = "inactive"; }, f => { f.user.accountStatus = "inactive"; },
    f => { f.user.protected = false; }, f => { Object.assign(f.user, { password: "present" }); },
    f => { Object.assign(f.user, { externalSubject: "subject" }); }, f => { Object.assign(f.user, { identitySource: {} }); },
    f => { Object.assign(f.user, { sourceExternalId: "key" }); }, f => { Object.assign(f.user, { sourceIdentityKey: "key" }); },
    f => { f.user.roles = []; }, f => { f.user.roles.push(f.user.roles[0]); },
    f => { f.user.roles[0].name = "Human"; }, f => { f.fn.name = "Human"; },
    f => { f.user.roles[0].functions = []; }, f => { f.user.roles[0].functions.push(f.fn); },
    f => { Object.assign(f.source, { serviceUser: null }); },
    f => { Object.assign(f.fn, { menuPath: "/menu" }); }, f => { f.fn.application.slug = "csrm"; },
    f => { f.fn.application.applicationStatus = "inactive"; }, f => { f.bindings.push(f.source); },
    f => { f.source.serviceUser.documentId = "other"; }, f => { f.source.tokenHash = "revoked"; },
  ];
  for (const change of changes) { const f = fixture(); change(f); assert.equal(status(await authenticateSourceRequest(f.strapi, f.ctx())), 401); assert.equal(f.writes(), 0); }
});
test("source context is private, request and instance bound; copied or forged state never authorizes", async () => {
  const f = fixture(); const ctx = f.ctx();
  assert.equal(getSourceContext(f.strapi, ctx), null);
  const result = await authenticateSourceRequest(f.strapi, ctx); assert.ok(result.ok);
  assert.equal(getSourceContext(f.strapi, ctx), result.value);
  assert.equal(getSourceContext(fixture().strapi, ctx), null);
  const forged = { request: { ...ctx.request }, state: { scimSource: result.value, idamboxUser: result.value } };
  assert.equal(getSourceContext(f.strapi, forged), null);
  assert.equal(status(await requireSourceOperation(f.strapi, forged, operation)), 401);
  assert.deepEqual(ctx.state, {});
  assert.equal(f.writes(), 1);
});
test("policy checks fresh exact operation grants and refuses forged direct invocation", async () => {
  const f = fixture(); const ctx = f.ctx();
  await assert.rejects(policy(ctx, { operation }, { strapi: f.strapi }), { status: 401 });
  assert.ok((await authenticateSourceRequest(f.strapi, ctx)).ok);
  assert.equal(await policy(ctx, { operation }, { strapi: f.strapi }), true);
  for (const wrong of ["POST:/scim/v2/Users", "get:/scim/v2/Users", "GET:/scim/v2/Users/x", "GET:/api/v1/me/access", ""]) {
    await assert.rejects(policy(ctx, { operation: wrong }, { strapi: f.strapi }), { status: 403 });
  }
  f.fn.functionApis = [];
  await assert.rejects(policy(ctx, { operation }, { strapi: f.strapi }), { status: 403 });
  assert.equal(f.writes(), 1);
  f.source.tokenHash = "revoked";
  await assert.rejects(policy(ctx, { operation }, { strapi: f.strapi }), { status: 401 });
});
test("untrusted hints and CSRM identity do not widen valid bearer scope", async () => {
  const f = fixture();
  for (const hints of [{ "x-csrm-dev-identity": "analyst" }, { "x-csrm-identity-token": "human" },
    { "x-source-id": "foreign", "x-scim-source": "foreign" }, { "x-api-token": "csrm" }]) {
    const ctx = { request: { header: { ...hints } }, state: { idamboxUser: { documentId: "foreign" } } };
    assert.equal(status(await authenticateSourceRequest(f.strapi, ctx)), 401);
    Object.assign(ctx.request.header, { authorization: `Bearer ${token}` });
    const result = await authenticateSourceRequest(f.strapi, ctx); assert.ok(result.ok);
    assert.equal(result.value.sourceDocumentId, sourceId);
    assert.deepEqual(ctx.state, { idamboxUser: { documentId: "foreign" } });
  }
});
test("repeated authentication cannot retain stale authority", async () => {
  const f = fixture(); const ctx = f.ctx();
  assert.ok((await authenticateSourceRequest(f.strapi, ctx)).ok);
  ctx.request.header.authorization = "Bearer invalid";
  assert.equal(status(await authenticateSourceRequest(f.strapi, ctx)), 401);
  assert.equal(getSourceContext(f.strapi, ctx), null);
  assert.equal(f.writes(), 1);
});
test("activity storage failure returns closed 500, logs no credentials and issues no authority", async () => {
  const f = fixture(); const original = f.strapi.documents;
  f.strapi.documents = ((uid: string) => ({ ...original(uid as never), update: async () => { throw new Error(token); } })) as unknown as typeof original;
  const ctx = f.ctx(); assert.equal(status(await authenticateSourceRequest(f.strapi, ctx)), 500);
  assert.equal(getSourceContext(f.strapi, ctx), null);
  assert.deepEqual(f.logs.map(line => JSON.parse(line)), [{ event: "scim.activity", outcome: "failure" }]);
  assert.equal(f.logs.join("").includes(token), false);
});

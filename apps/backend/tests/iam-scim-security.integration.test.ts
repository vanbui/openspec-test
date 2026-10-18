import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CORE_USER_URN, PATCH_OP_URN } from "../src/iam/scim/wire";
import { ERROR_URN } from "../src/iam/scim/errors";
import { createScimLimiter } from "../src/iam/scim/limiter";
import { backendModule, startScimHttpHarness } from "./helpers/iam-scim-http-harness";
import { INTERNAL_ERROR_HEADER } from "./helpers/strapi-http-harness";

// Authored fictitious conformance cases; no captured connector or live-stack evidence.
const SOURCE = "api::identity-source.identity-source";
const USER = "api::idambox-user.idambox-user";
const oldActivity = "2000-01-01T00:00:00.000Z";
let h: Awaited<ReturnType<typeof startScimHttpHarness>>;
let sequence = 0;
before(async () => { h = await startScimHttpHarness(); });
after(async () => { await h?.close(); });
const readSource = (id: string) => h.backend(backend => backend.documents(SOURCE).findOne({ documentId: id }));
async function resetActivity(id = h.primary.documentId) {
  await h.backend(backend => backend.documents(SOURCE).update({ documentId: id, data: { lastActivityAt: oldActivity } }));
}
function input() {
  const name = `security-conformance-${++sequence}`;
  return { schemas: [CORE_USER_URN], externalId: name, userName: name, emails: [{ value: `${name}@conformance.test` }] };
}
async function checked(work: () => Promise<Response>, status: number, source: string | null = h.primary.documentId, media = "application/scim+json") {
  const { result: response, events, mutations } = await h.capture(work);
  assert.equal(response.status, status, await response.clone().text());
  const logs = events.filter(event => event.event === "scim.request"); assert.equal(logs.length, 1);
  const event = logs[0];
  assert.deepEqual(Object.keys(event).sort(), ["event", "source", "operation", "target", "outcome", "status", "requestId"].sort());
  assert.equal(event.status, status); assert.equal(event.source, source);
  assert.match(String(event.requestId), /^[a-f0-9-]{36}$/);
  assert.match(String(event.operation), /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|OTHER):\/scim\/v2(?:\/(?:Users|Groups|Schemas|ResourceTypes|ServiceProviderConfig)(?:\/:id)?)?$/);
  for (const mutation of mutations) {
    assert.deepEqual(Object.keys(mutation).sort(), ["source", "serviceUser", "operation", "target", "outcome"].sort());
    assert.equal(mutation.source, source);
    assert.ok(["create", "replace", "patch", "deactivate", "delete"].includes(String(mutation.operation)));
  }
  const serialized = JSON.stringify({ events, mutations });
  for (const secret of [h.primary.token, "attacker-sentinel", "private-person@conformance.test", "SELECT", "internal failure"]) assert.equal(serialized.includes(secret), false);
  let body: Record<string, any> = {};
  if (status === 204) { assert.equal(await response.text(), ""); assert.equal(response.headers.get("content-type"), null); }
  else {
    assert.ok(response.headers.get("content-type")?.startsWith(media));
    body = await response.json() as Record<string, any>;
    assert.equal(body.data, undefined);
    if (status >= 400) {
      assert.deepEqual(body.schemas, [ERROR_URN]); assert.equal(body.status, String(status));
      assert.deepEqual(Object.keys(body).sort(), ["schemas", "status", "detail", ...(body.scimType ? ["scimType"] : [])].sort());
      for (const secret of ["attacker-sentinel", "private-person@conformance.test", "SELECT", "internal failure"]) assert.equal(JSON.stringify(body).includes(secret), false);
    }
  }
  if (status === 401) assert.equal(response.headers.get("www-authenticate"), "Bearer");
  if (status === 429 || status === 503) assert.match(response.headers.get("retry-after") ?? "", /^[1-9][0-9]*$/);
  return { body, event, response, events, mutations };
}

// Corruption is confined to the isolated database so normal invariant guards remain enabled.
async function corruptScalar(uid: typeof SOURCE | typeof USER | "api::role.role" | "api::function.function" | "api::application.application", id: string, field: string, value: unknown, work: () => Promise<void>) {
  await h.backend(async backend => {
    const metadata = backend.db.metadata.get(uid);
    const attribute = metadata.attributes[field]; assert.ok("columnName" in attribute && attribute.columnName);
    const table = () => backend.db.getConnection(metadata.tableName).where({ document_id: id });
    const rows = await table().select("*"); assert.equal(rows.length, 1);
    await table().update({ [attribute.columnName]: value });
    try { await work(); }
    finally { await table().update({ [attribute.columnName]: rows[0][attribute.columnName] }); }
  });
}
async function corruptLinks(uid: typeof SOURCE | typeof USER | "api::role.role" | "api::function.function", id: string, field: string,
  change: (rows: Record<string, unknown>[], targetColumn: string) => Record<string, unknown>[], work: () => Promise<void>) {
  await h.backend(async backend => {
    const metadata = backend.db.metadata.get(uid); const attribute = metadata.attributes[field];
    assert.ok(attribute.type === "relation" && "joinTable" in attribute && attribute.joinTable);
    const join = attribute.joinTable; assert.ok("inverseJoinColumn" in join);
    const record = await backend.db.getConnection(metadata.tableName).where({ document_id: id }).first(); assert.ok(record);
    const links = () => backend.db.getConnection(join.name).where(join.joinColumn.name, record.id);
    const rows = await links().select("*");
    await links().delete();
    const altered = change(rows, join.inverseJoinColumn.name);
    try {
      if (altered.length) await backend.db.getConnection(join.name).insert(altered);
      await work();
    }
    finally { await links().delete(); if (rows.length) await backend.db.getConnection(join.name).insert(rows); }
  });
}

test("every persisted source/service/application invariant is freshly enforced after a successful request", async () => {
  const source = await h.source();
  const sourceId = source.documentId;
  const request = () => h.request("/scim/v2/Users", "GET", undefined, { token: source.token });
  const catalogue = await h.backend(async backend => {
    const [role] = await backend.documents("api::role.role").findMany({ filters: { name: "Identity Provisioning" },
      populate: { functions: { populate: { application: true } } } });
    assert.ok(role?.functions?.[0]?.application);
    return { role: role.documentId, fn: role.functions[0].documentId, app: role.functions[0].application.documentId };
  });
  const generic = (await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: null }), 401, null)).body;
  const denial = async () => {
    const before = await readSource(sourceId);
    assert.deepEqual((await checked(request, 401, null)).body, generic);
    assert.deepEqual(await readSource(sourceId), before);
  };
  const scalarCases = [
    [SOURCE, sourceId, "sourceStatus", "inactive"],
    [USER, source.serviceUserId, "accountStatus", "inactive"], [USER, source.serviceUserId, "protected", false],
    [USER, source.serviceUserId, "password", "attacker-sentinel"], [USER, source.serviceUserId, "externalSubject", "attacker-sentinel"],
    [USER, source.serviceUserId, "sourceExternalId", "attacker-sentinel"], [USER, source.serviceUserId, "sourceIdentityKey", "attacker-sentinel"],
    ["api::role.role", catalogue.role, "name", "Unrelated"], ["api::function.function", catalogue.fn, "name", "Unrelated"],
    ["api::function.function", catalogue.fn, "menuPath", "/attacker-sentinel"],
    ["api::application.application", catalogue.app, "slug", "unrelated"],
    ["api::application.application", catalogue.app, "applicationStatus", "inactive"],
  ] as const;
  for (const [uid, id, field, value] of scalarCases) {
    await checked(request, 200, sourceId);
    await corruptScalar(uid, id, field, value, denial);
  }
  for (const [uid, id, field] of [[SOURCE, sourceId, "serviceUser"], [USER, source.serviceUserId, "roles"],
    ["api::role.role", catalogue.role, "functions"], ["api::function.function", catalogue.fn, "application"]] as const) {
    await checked(request, 200, sourceId);
    await corruptLinks(uid, id, field, () => [], denial);
  }
  await corruptLinks(USER, source.serviceUserId, "identitySource", () => [], async () => {
    // Add a source ownership link to the otherwise valid manual service user.
    await h.backend(async backend => {
      const attr = backend.db.metadata.get(USER).attributes.identitySource;
      assert.ok(attr.type === "relation" && "joinTable" in attr && attr.joinTable);
      assert.ok("inverseJoinColumn" in attr.joinTable);
      const user = await backend.documents(USER).findOne({ documentId: source.serviceUserId });
      const src = await readSource(sourceId); assert.ok(user && src);
      await backend.db.getConnection(attr.joinTable.name).insert({ [attr.joinTable.joinColumn.name]: user.id,
        [attr.joinTable.inverseJoinColumn.name]: src.id });
    });
    await denial();
  });
  await h.backend(async backend => {
    const [role] = await backend.documents("api::role.role").findMany({ filters: { name: "Requestor" }, populate: { functions: true } });
    assert.ok(role?.functions?.[0]);
    for (const [uid, id, field, extra] of [[USER, source.serviceUserId, "roles", role.id],
      ["api::role.role", catalogue.role, "functions", role.functions[0].id]] as const) {
      await checked(request, 200, sourceId);
      await corruptLinks(uid, id, field, (rows, target) => {
        const { id: _id, ...link } = rows[0];
        return [...rows, { ...link, [target]: extra }];
      }, denial);
    }
  });
  const other = await h.source();
  // The existing unique relation prevents duplicate bindings without any schema/index alteration.
  await h.backend(async backend => {
    const service = await backend.documents(USER).findOne({ documentId: source.serviceUserId }); assert.ok(service);
    await assert.rejects(corruptLinks(SOURCE, other.documentId, "serviceUser",
      (rows, target) => rows.map(row => ({ ...row, [target]: service.id })), denial), /UNIQUE constraint failed/);
  });
  await checked(request, 200, sourceId);
});

test("rotation/revocation and exact grant withdrawal take effect on the next HTTP request", async () => {
  const source = await h.source();
  const request = (token = source.token) => h.request("/scim/v2/Users", "GET", undefined, { token });
  await checked(request, 200, source.documentId);
  const tokens = backendModule<typeof import("../src/iam/scim/token-service")>("iam/scim/token-service");
  const rotated = await h.backend(backend => tokens.administerSourceToken(backend, source.documentId, "rotate")); assert.ok("token" in rotated);
  const afterRotation = await readSource(source.documentId);
  await checked(request, 401, null); assert.deepEqual(await readSource(source.documentId), afterRotation);
  await checked(() => request(rotated.token), 200, source.documentId);
  await h.backend(async backend => {
    const [fn] = await backend.documents("api::function.function").findMany({ filters: { name: "Identity Provisioning" }, populate: { functionApis: true } }); assert.ok(fn);
    await backend.documents("api::function.function").update({ documentId: fn.documentId,
      data: { functionApis: fn.functionApis!.filter(api => api.url !== "GET:/scim/v2/Users").map(api => api.documentId) } });
    try {
      await resetActivity(source.documentId);
      await checked(() => request(rotated.token), 403, source.documentId);
      assert.notEqual((await readSource(source.documentId))?.lastActivityAt, oldActivity);
      assert.equal((await readSource(source.documentId))?.tokenRotatedAt, afterRotation?.tokenRotatedAt);
    } finally { await backend.documents("api::function.function").update({ documentId: fn.documentId, data: { functionApis: fn.functionApis!.map(api => api.documentId) } }); }
  });
  await checked(() => request(rotated.token), 200, source.documentId);
  await h.backend(backend => tokens.administerSourceToken(backend, source.documentId, "revoke"));
  const revoked = await readSource(source.documentId);
  await checked(() => request(rotated.token), 401, null); assert.deepEqual(await readSource(source.documentId), revoked);
});

test("human/dev/API/forged-source combinations cannot authenticate or widen valid source scope", async () => {
  const before = await readSource(h.primary.documentId);
  const humanHeaders: Record<string, string>[] = [
    { "x-csrm-dev-identity": h.http.developmentEmails.jane }, { "x-csrm-identity-token": "attacker-sentinel" },
    { Authorization: "Bearer human.keycloak.token" }, { "x-source-id": h.primary.documentId, "x-source-principal": h.primary.serviceUserId },
    { "x-csrm-dev-identity": h.http.developmentEmails.jane, "x-csrm-identity-token": "attacker-sentinel", "x-source-id": h.primary.documentId },
  ];
  for (const headers of humanHeaders) await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: null, headers }), 401, null);
  await checked(() => h.http.request({ path: "/scim/v2/Users", identity: "owner" }), 401, null);
  assert.deepEqual(await readSource(h.primary.documentId), before);
  const other = await h.source();
  const made = await checked(() => h.request("/scim/v2/Users", "POST", input(), { token: other.token }), 201, other.documentId);
  await checked(() => h.request(`/scim/v2/Users/${made.body.id}`, "GET", undefined, {
    headers: { "x-csrm-dev-identity": h.http.developmentEmails.jane, "x-source-id": other.documentId } }), 404);
});

test("mounted SCIM requests never log raw URLs on success or refusal; ordinary HTTP logging remains", async () => {
  await h.backend(async backend => {
    const messages: string[] = [];
    const original = backend.log.http;
    backend.log.http = ((message: string) => { messages.push(message); }) as typeof original;
    try {
      const query = `/scim/v2/Users?filter=${encodeURIComponent('userName eq "private.person@conformance.test"')}`;
      await checked(() => h.request(query, "GET", undefined, { token: null }), 401, null);
      await checked(() => h.request(query), 200);
      await checked(() => h.request("/scim/v2/Users/private-path-sentinel"), 404);
      assert.equal(messages.length, 0, "raw SCIM request logging must be replaced by the closed boundary event");
      const response = await h.http.request({ path: "/api/v1/me/access", identity: "owner" });
      assert.equal(response.status, 200);
      assert.equal(messages.length, 1);
      assert.match(messages[0], /^GET \/api\/v1\/me\/access \(\d+ ms\) 200$/);
    } finally { backend.log.http = original; }
  });
});

test("parser/media/payload/namespace/exception branches have closed envelopes, independent activity and one safe event", async () => {
  const made = await checked(() => h.request("/scim/v2/Users", "POST", input()), 201);
  const id = made.body.id as string;
  const before = await h.backend(backend => backend.documents(USER).findOne({ documentId: id }));
  const tokenTime = (await readSource(h.primary.documentId))?.tokenRotatedAt;
  const cases: Array<[number, () => Promise<Response>]> = [
    [400, () => h.raw("/scim/v2/Users?attacker-sentinel=private-person@conformance.test", "POST", '{"attacker-sentinel":')],
    [413, () => h.raw("/scim/v2/Users", "POST", '"' + "x".repeat(1_048_576) + '"')],
    [415, () => h.raw("/scim/v2/Users", "POST", "attacker-sentinel", { "Content-Type": "text/plain" })],
    [406, () => h.request("/scim/v2/Users", "GET", undefined, { headers: { Accept: "text/html" } })],
    [400, () => h.request(`/scim/v2/Users/${id}`, "PATCH", { schemas: [PATCH_OP_URN], Operations: Array.from({ length: 101 }, () => ({ op: "replace", path: "title", value: "attacker-sentinel" })) })],
    [400, () => h.request(`/scim/v2/Users/${id}`, "PATCH", { schemas: [PATCH_OP_URN], Operations: [
      { op: "replace", path: "title", value: "Uncommitted" },
      { op: "replace", path: 'emails[value eq "\\U0061@conformance.test"].value', value: "new@conformance.test" },
    ] })],
    [500, () => h.request("/scim/v2/Users", "GET", undefined, { headers: { [INTERNAL_ERROR_HEADER]: "1" } })],
    [404, () => h.request("/scim/v2/attacker-sentinel?email=private-person@conformance.test")],
    [404, () => h.request("/scim/v2/Users/attacker-sentinel")],
    [501, () => h.request("/scim/v2/Groups", "POST", { displayName: "attacker-sentinel" })],
  ];
  for (const [status, request] of cases) {
    await resetActivity();
    await checked(request, status);
    const source = await readSource(h.primary.documentId);
    assert.notEqual(source?.lastActivityAt, oldActivity); assert.equal(source?.tokenRotatedAt, tokenTime);
    assert.deepEqual(await h.backend(backend => backend.documents(USER).findOne({ documentId: id })), before);
  }
  await checked(() => h.request("/scim/v2/Users", "GET", undefined, { headers: { Accept: "application/json" } }), 200, h.primary.documentId, "application/json");
  await checked(() => h.request(`/scim/v2/Users/${id}`, "DELETE"), 204);
});

test("activity persistence failure rolls back itself, fails closed before work and logs a separate safe failure", async () => {
  let fail = true; let mutations = 0;
  await h.backend(async backend => { backend.documents.use(async (context, next) => {
    if (context.uid === USER && ["create", "update"].includes(context.action)) mutations++;
    const result = await next();
    if (fail && context.uid === SOURCE && context.action === "update") throw new Error("attacker-sentinel activity storage detail");
    return result;
  }); });
  const before = await readSource(h.primary.documentId);
  let errors: unknown[] = [];
  await h.backend(async backend => {
    const original = backend.log.error;
    backend.log.error = ((message: unknown) => { if (typeof message === "string" && message.startsWith("{")) errors.push(JSON.parse(message)); }) as typeof original;
    try { await checked(() => h.request("/scim/v2/Users", "POST", input()), 500, null); }
    finally { backend.log.error = original; fail = false; }
  });
  assert.deepEqual(errors, [{ event: "scim.activity", outcome: "failure" }]);
  assert.equal(mutations, 0); assert.deepEqual(await readSource(h.primary.documentId), before);
});

test("sync timestamps change only on accepted writes including replay; token events stay distinct", async () => {
  const tokenTime = (await readSource(h.primary.documentId))?.tokenRotatedAt;
  const made = await checked(() => h.request("/scim/v2/Users", "POST", input()), 201);
  const id = made.body.id as string;
  const read = () => h.backend(backend => backend.documents(USER).findOne({ documentId: id }));
  let before = await read(); assert.ok(before?.lastSyncedAt);
  await checked(() => h.request(`/scim/v2/Users/${id}`), 200);
  await checked(() => h.request(`/scim/v2/Users/${id}`, "PATCH", { schemas: [PATCH_OP_URN], Operations: [{ op: "replace", path: "unknown", value: "attacker-sentinel" }] }), 400);
  assert.deepEqual(await read(), before);
  const accepted = await checked(() => h.request(`/scim/v2/Users/${id}`, "PUT", { schemas: [CORE_USER_URN], title: "Accepted" }), 200);
  assert.equal(accepted.mutations.length, 1);
  assert.equal(accepted.mutations[0].outcome, "accepted");
  assert.equal(accepted.events.filter(event => event.event === "scim.request").length, 1);
  assert.equal(accepted.body.title, "Accepted"); assert.notEqual((await read())?.lastSyncedAt, before.lastSyncedAt);
  before = await read();
  await checked(() => h.request(`/scim/v2/Users/${id}`, "PUT", { schemas: [CORE_USER_URN], title: "Accepted" }), 200);
  assert.notEqual((await read())?.lastSyncedAt, before?.lastSyncedAt);
  assert.equal((await readSource(h.primary.documentId))?.tokenRotatedAt, tokenTime);
  const tokens = backendModule<typeof import("../src/iam/scim/token-service")>("iam/scim/token-service");
  const captured = await h.capture(() => h.backend(backend => tokens.administerSourceToken(backend, h.primary.documentId, "rotate")));
  assert.ok(captured.events.some(event => event.event === "scim.token"));
  assert.equal(captured.events.some(event => event.event === "scim.request"), false);
  assert.notEqual((await readSource(h.primary.documentId))?.tokenRotatedAt, tokenTime);
  assert.equal(JSON.stringify(captured.events).includes(h.primary.token), false);
});

test("bounded limiter caps expire with injected time; active budgets are retained", () => {
  let now = 0;
  const limiter = createScimLimiter({ ipLimit: 1, sourceLimit: 1 }, () => now);
  for (let i = 0; i < 10_000; i++) assert.equal(limiter.ip(`ip-${i}`).allowed, true);
  for (let i = 0; i < 1000; i++) assert.equal(limiter.source(`source-${i}`).allowed, true);
  assert.deepEqual(limiter.size(), { ip: 10_000, source: 1000 });
  assert.deepEqual(limiter.ip("overflow"), { allowed: false, retryAfter: 60 });
  assert.deepEqual(limiter.source("overflow"), { allowed: false, retryAfter: 60 });
  now = 59_999; assert.deepEqual(limiter.ip("ip-0"), { allowed: false, retryAfter: 1 });
  now = 60_000; assert.deepEqual(limiter.size(), { ip: 0, source: 0 });
  assert.equal(limiter.ip("fresh").allowed, true); assert.equal(limiter.source("fresh").allowed, true);
});

test("low isolated HTTP budgets throttle sources after activity and trusted socket IP before authentication", async () => {
  await h.close(); h = await startScimHttpHarness({ ipLimit: 6, sourceLimit: 2 });
  const second = await h.source();
  await checked(() => h.request("/scim/v2/Users"), 200);
  await checked(() => h.request("/scim/v2/Schemas"), 200);
  await resetActivity();
  await checked(() => h.request("/scim/v2/ResourceTypes"), 429);
  assert.notEqual((await readSource(h.primary.documentId))?.lastActivityAt, oldActivity);
  await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: second.token }), 200, second.documentId);
  await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: null }), 401, null);
  await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: null }), 401, null);
  await resetActivity(second.documentId);
  await checked(() => h.request("/scim/v2/Users", "GET", undefined, { token: second.token,
    headers: { "X-Forwarded-For": "198.51.100.99", "X-Real-IP": "198.51.100.100" } }), 429, null);
  assert.equal((await readSource(second.documentId))?.lastActivityAt, oldActivity);
  // The existing 6 MiB CSRM form limit still accepts a form larger than the SCIM body cap.
  const response = await h.http.request({ path: "/api/csrm-assessment-requests", identity: "owner", init: { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "title=" + "x".repeat(1_100_000) } });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type")?.startsWith("application/scim+json"), false);
});

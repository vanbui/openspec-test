import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CORE_USER_URN, ENTERPRISE_USER_URN, PATCH_OP_URN, LIST_RESPONSE_URN } from "../src/iam/scim/wire";
import { backendModule, startScimHttpHarness } from "./helpers/iam-scim-http-harness";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

// Authored fictitious conformance inputs; these are not connector captures.
const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
let h: Awaited<ReturnType<typeof startScimHttpHarness>>;
let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>>;
let sequence = 0;
const url = (id: string) => `/scim/v2/Users/${id}`;
function input<T extends Record<string, unknown>>(extra: T): { schemas: string[]; userName: string; externalId: string; emails: { value: string; primary: boolean }[] } & T;
function input(): { schemas: string[]; userName: string; externalId: string; emails: { value: string; primary: boolean }[] };
function input(extra: Record<string, unknown> = {}) {
  const key = `conformance-${++sequence}`;
  return { schemas: [CORE_USER_URN], userName: key, externalId: key,
    emails: [{ value: `${key}@conformance.test`, primary: true }], ...extra };
}
const patch = (...Operations: Record<string, unknown>[]) => ({ schemas: [PATCH_OP_URN], Operations });
async function json(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get("content-type") ?? "", /^application\/scim\+json/);
  const body = await response.json() as Record<string, any>;
  assert.equal(body.data, undefined);
  if (status >= 400) { assert.equal(body.status, String(status)); assert.equal(typeof body.detail, "string"); }
  return body;
}
async function create(data = input(), token?: string) {
  const response = await h.request("/scim/v2/Users", "POST", data, { token });
  const body = await json(response, 201);
  assert.equal(response.headers.get("location"), url(body.id));
  return { id: body.id as string, data, body };
}
const read = (id: string) => h.backend(async backend => {
  const row = await backend.documents(USER).findOne({ documentId: id, populate: { roles: true, identitySource: true } });
  return row ? { ...row, identitySource: row.identitySource ? { documentId: row.identitySource.documentId } : null } : null;
});
const work = (id: string) => h.backend(backend => backend.documents(OUTBOX).findFirst({ filters: { userDocumentId: id } }));
async function query(filter: string, rest: Record<string, string> = {}, token?: string) {
  return json(await h.request(`/scim/v2/Users?${new URLSearchParams({ filter, ...rest })}`, "GET", undefined, { token }));
}
before(async () => { h = await startScimHttpHarness(); remote = await startFakeKeycloakServer(); });
after(async () => { await h?.close(); await remote?.close(); });

test("fixed mapping, implicit Requestor and private read/write boundaries persist over HTTP", async () => {
  const data = input({ schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], name: { givenName: "Faye", familyName: "Example" },
    title: "Engineer", active: true, [ENTERPRISE_USER_URN]: { employeeNumber: "007", department: "Research" } });
  const { id, body } = await create(data);
  assert.deepEqual({ ...body }, { schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], id, userName: data.userName,
    externalId: data.externalId, emails: data.emails, name: data.name, displayName: "Faye Example", active: true,
    title: "Engineer", [ENTERPRISE_USER_URN]: data[ENTERPRISE_USER_URN], meta: { resourceType: "User", location: url(id) } });
  const row = await read(id); assert.ok(row);
  assert.deepEqual(row.roles, []); assert.equal(row.identitySource?.documentId, h.primary.documentId);
  assert.equal(row.sourceExternalId, data.externalId); assert.equal(row.employeeNumber, "007");
  assert.equal(row.department, "Research"); assert.equal(row.jobTitle, "Engineer"); assert.ok(row.lastSyncedAt);
  // The existing CSRM policy computes birthright from the persisted person with roles=[].
  h.http.registerTestIdentity("conformance-birthright", id);
  const response = await h.http.request({ path: "/api/csrm-assessment-requests", identity: "conformance-birthright" });
  assert.equal(response.status, 200);
  for (const field of ["roles", "protected", "password", "externalSubject", "identitySource", "sourceIdentityKey", "lastSyncedAt"]) {
    assert.equal(body[field], undefined);
    await json(await h.request("/scim/v2/Users", "POST", input({ [field]: "forbidden" })), 400);
    await json(await h.request(url(id), "PUT", { schemas: [CORE_USER_URN], [field]: "forbidden" }), 400);
    await json(await h.request(url(id), "PATCH", patch({ op: "replace", path: field, value: "forbidden" })), 400);
    await json(await h.request(`${url(id)}?attributes=${field}`), 400);
  }
  assert.deepEqual(await read(id), row);
});

test("source visibility precedes counts; manual claims require keyed PUT and preserve roles", async () => {
  const other = await h.source();
  const foreign = await create(input(), other.token);
  const manual = await h.http.createUserFixture({ username: "conformance-manual", email: "manual@conformance.test",
    displayName: "Manual", accountStatus: "active", roles: ["Security Analyst"] });
  const original = await read(manual);
  assert.equal((await json(await h.request(url(manual)))).externalId, undefined);
  for (const method of ["PATCH", "DELETE"]) {
    await json(await h.request(url(manual), method, method === "PATCH" ? patch({ op: "replace", path: "title", value: "No claim" }) : undefined), 404);
  }
  await json(await h.request("/scim/v2/Users", "POST", input({ userName: "conformance-manual", emails: [{ value: "manual@conformance.test" }] })), 409);
  await json(await h.request(url(manual), "PUT", { schemas: [CORE_USER_URN], title: "Missing key" }), 400);
  await json(await h.request(url(manual), "PUT", { ...input(), id: foreign.id }), 400);
  assert.deepEqual(await read(manual), original);
  await json(await h.request(url(manual), "PUT", { schemas: [CORE_USER_URN], id: manual, externalId: "confirmed-key", title: "Claimed" }));
  const claimed = await read(manual); assert.ok(claimed);
  assert.equal(claimed.identitySource?.documentId, h.primary.documentId);
  assert.deepEqual(claimed.roles?.map(role => role.name), ["Security Analyst"]);
  for (const id of [foreign.id, h.primary.serviceUserId, other.serviceUserId]) {
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) await json(await h.request(url(id), method,
      method === "PUT" ? input() : method === "PATCH" ? patch({ op: "replace", path: "title", value: "Hidden" }) : undefined,
      { headers: { "x-csrm-dev-identity": h.http.developmentEmails.jane } }), 404);
  }
  assert.equal((await query(`externalId eq "${foreign.data.externalId}"`)).totalResults, 0);
  assert.equal((await query('externalId eq "confirmed-key"', {}, other.token)).totalResults, 0);
  assert.equal((await query('userName eq "conformance-manual"')).totalResults, 1);
});

test("partial PUT keeps omitted fields including inactive, clears explicit nulls and rejects key mutation", async () => {
  const created = await create(input({ active: false, title: "Before", name: { givenName: "Faye" },
    [ENTERPRISE_USER_URN]: { employeeNumber: "007", department: "Research" } }));
  const updated = await json(await h.request(url(created.id), "PUT", { schemas: [CORE_USER_URN], id: created.id, title: "After" }));
  assert.equal(updated.active, false); assert.equal(updated.title, "After");
  for (const key of ["externalId", "emails", "name", ENTERPRISE_USER_URN]) assert.deepEqual(updated[key], created.body[key]);
  const cleared = await json(await h.request(url(created.id), "PUT", { schemas: [CORE_USER_URN], name: null, title: null,
    [ENTERPRISE_USER_URN]: { department: null } }));
  assert.equal(cleared.name, undefined); assert.equal(cleared.title, undefined);
  assert.deepEqual(cleared[ENTERPRISE_USER_URN], { employeeNumber: "007" });
  const before = await read(created.id);
  for (const method of ["PUT", "PATCH"]) {
    const error = await json(await h.request(url(created.id), method, method === "PUT"
      ? { schemas: [CORE_USER_URN], externalId: "new-key" }
      : patch({ op: "replace", path: "externalId", value: "new-key" })), 400);
    assert.equal(error.scimType, "mutability");
    assert.deepEqual(await read(created.id), before);
  }
  await json(await h.request("/scim/v2/Users", "POST", { schemas: [CORE_USER_URN] }), 400);
  const connector = await create(input({ externalId: undefined, groups: [],
    schemas: [CORE_USER_URN, "urn:ietf:params:scim:schemas:extension:slack:profile:2.0:User"],
    [ENTERPRISE_USER_URN]: { employeeNumber: "employee-fallback" } }));
  assert.equal(connector.body.externalId, "employee-fallback");
});

test("PATCH reduces ordered casing/pathless/name/Enterprise/email operations once and rolls back later failure", async () => {
  const created = await create();
  let writes = 0;
  await h.backend(async backend => { backend.documents.use(async (context, next) => {
    if (context.uid === USER && context.action === "update" && (context.params as { documentId?: string }).documentId === created.id) writes++;
    return next();
  }); });
  const body = await json(await h.request(url(created.id), "PATCH", patch(
    { op: "RePlAcE", value: { displayName: "Pat Example", title: "First" } },
    { op: "ADD", path: "NaMe", value: { givenName: "Pat", familyName: "Example" } },
    { op: "replace", path: "name.givenName", value: "Faye" },
    { op: "add", path: `${ENTERPRISE_USER_URN}:department`, value: "Research" },
    { op: "replace", path: ENTERPRISE_USER_URN, value: { employeeNumber: "007", department: "Engineering" } },
    { op: "remove", path: `emails[value eq "${created.data.emails[0].value}"]` },
    { op: "add", path: "emails", value: [{ value: "secondary@conformance.test" }, { value: "primary@conformance.test", primary: "true" }] },
    { op: "replace", path: 'emails[primary eq true].value', value: "final@conformance.test" },
    { op: "replace", path: 'emails[value eq "final@conformance.test"].value', value: "selected@conformance.test" },
    { op: "replace", path: "title", value: "Last" })));
  assert.equal(writes, 1); assert.equal(body.title, "Last");
  assert.deepEqual(body.name, { givenName: "Faye", familyName: "Example" });
  assert.deepEqual(body.emails, [{ value: "selected@conformance.test", primary: true }]);
  assert.deepEqual(body[ENTERPRISE_USER_URN], { employeeNumber: "007", department: "Engineering" });
  const before = await read(created.id);
  for (const [operation, type] of [
    [{ op: "replace", path: "unknown.path", value: "bad" }, "invalidPath"],
    [{ op: "replace", path: 'emails[value eq "absent@conformance.test"].value', value: "bad@conformance.test" }, "noTarget"],
    [{ op: "remove", path: "emails" }, "mutability"],
    [{ op: "replace", path: "emails", value: [{ value: "a@conformance.test", primary: true }, { value: "b@conformance.test", primary: true }] }, "invalidValue"],
  ] as const) {
    const failure = await json(await h.request(url(created.id), "PATCH", patch({ op: "replace", path: "title", value: "Rollback" }, operation)), 400);
    assert.equal(failure.scimType, type); assert.deepEqual(await read(created.id), before);
  }
  assert.equal(writes, 1);
  const concurrent = await Promise.all([
    h.request(url(created.id), "PATCH", patch({ op: "replace", path: "title", value: "Concurrent" })),
    h.request(url(created.id), "PATCH", patch({ op: "replace", path: `${ENTERPRISE_USER_URN}:department`, value: "Concurrent department" })),
  ]);
  for (const response of concurrent) await json(response);
  const persisted = await read(created.id);
  assert.equal(persisted?.jobTitle, "Concurrent"); assert.equal(persisted?.department, "Concurrent department");
  assert.equal(writes, 3);
});

test("bounded queries handle JSON escapes, casing, exact keys, normalized paging and strict projection", async () => {
  const key = ' 00Ab"\\%_ ';
  const created = await create(input({ externalId: key, displayName: 'Faye "Example"',
    [ENTERPRISE_USER_URN]: { employeeNumber: "Query007", department: "Conformance Query" } }));
  for (const filter of [`externalId eq ${JSON.stringify(key)}`, `USERNAME eq ${JSON.stringify(created.data.userName.toUpperCase())}`,
    `emails.value eq ${JSON.stringify(created.data.emails[0].value.toUpperCase())} and ${ENTERPRISE_USER_URN}:employeeNumber eq "query007"`]) {
    const result = await query(filter); assert.equal(result.totalResults, 1); assert.equal(result.Resources[0].id, created.id);
  }
  assert.equal((await query(`externalId eq ${JSON.stringify(key.toLowerCase())}`)).totalResults, 0);
  const filter = `externalId eq ${JSON.stringify(key)}`;
  for (const [rest, start, count] of [[{ startIndex: "-9", count: "9999" }, 1, 1], [{ startIndex: "2" }, 2, 0],
    [{ count: "-1" }, 1, 0], [{ count: "0" }, 1, 0]] as const) {
    const result = await query(filter, rest); assert.equal(result.startIndex, start);
    assert.equal(result.totalResults, 1); assert.equal(result.itemsPerPage, count);
    if (Number(rest.count) <= 0) assert.equal(result.Resources, undefined);
  }
  assert.equal((await query(Array.from({ length: 20 }, () => filter).join(" and "))).totalResults, 1);
  const projected = await query(filter, { attributes: "userName,emails.value,name.givenName" });
  assert.deepEqual(projected.Resources[0], { schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], id: created.id,
    userName: created.data.userName, emails: [{ value: created.data.emails[0].value }] });
  const excluded = await query(filter, { excludedAttributes: "schemas,id,emails,meta" });
  assert.ok(excluded.Resources[0].schemas); assert.equal(excluded.Resources[0].id, created.id);
  assert.equal(excluded.Resources[0].emails, undefined); assert.equal(excluded.Resources[0].meta, undefined);
  for (const raw of ["count=1&count=2", "unknown=value", "sortBy=userName", "sortOrder=ascending", "startIndex=1.5",
    "count=9007199254740992", "attributes=roles", "attributes=userName&excludedAttributes=title", "filter=" + encodeURIComponent('userName co "a"'),
    "filter=" + encodeURIComponent('active eq "true" or userName eq "x"'), "filter=" + encodeURIComponent("x".repeat(4097)),
    "filter=" + encodeURIComponent(`userName eq "${"x".repeat(256)}"`),
    "filter=" + encodeURIComponent(Array.from({ length: 21 }, () => filter).join(" and "))]) {
    await json(await h.request(`/scim/v2/Users?${raw}`), 400);
  }
});

test("username/email/tuple conflicts and concurrent creates return 409 after rollback without adoption", async () => {
  const existing = await create(); const before = await read(existing.id);
  for (const data of [input({ userName: existing.data.userName }), input({ emails: existing.data.emails }), input({ externalId: existing.data.externalId })]) {
    const error = await json(await h.request("/scim/v2/Users", "POST", data), 409); assert.equal(error.scimType, "uniqueness");
    assert.equal(await h.backend(async backend => backend.db.inTransaction()), false);
  }
  const duplicate = input();
  const results = await Promise.all([h.request("/scim/v2/Users", "POST", duplicate), h.request("/scim/v2/Users", "POST", duplicate)]);
  assert.deepEqual(results.map(response => response.status).sort(), [201, 409]);
  for (const response of results) await json(response, response.status);
  assert.equal(await h.backend(backend => backend.documents(USER).count({ filters: { username: duplicate.userName } })), 1);
  const target = await create(); const targetBefore = await read(target.id);
  await json(await h.request(url(target.id), "PATCH", patch({ op: "replace", path: "title", value: "Rollback" },
    { op: "replace", path: "userName", value: existing.data.userName })), 409);
  assert.deepEqual(await read(target.id), targetBefore); assert.deepEqual(await read(existing.id), before);
});

test("authenticated discovery and empty Groups advertise the subset and reject every write without roles", async () => {
  const roles = await h.backend(backend => backend.documents("api::role.role").findMany());
  assert.equal((await json(await h.request("/scim/v2/ServiceProviderConfig"))).filter.maxResults, 500);
  for (const [collection, ids] of [["Schemas", [CORE_USER_URN, ENTERPRISE_USER_URN, "urn:ietf:params:scim:schemas:core:2.0:Group"]],
    ["ResourceTypes", ["User", "Group"]]] as const) {
    const body = await json(await h.request(`/scim/v2/${collection}`)); assert.deepEqual(body.schemas, [LIST_RESPONSE_URN]);
    assert.equal(body.totalResults, ids.length);
    for (const id of ids) assert.equal((await json(await h.request(`/scim/v2/${collection}/${encodeURIComponent(id)}`))).id, id);
    await json(await h.request(`/scim/v2/${collection}/unknown`), 404);
  }
  assert.deepEqual((await json(await h.request("/scim/v2/Groups"))).Resources, []);
  for (const path of ["/scim/v2/Groups", "/scim/v2/Groups/" + "z".repeat(24)]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) await json(await h.request(path, method, method === "DELETE" ? undefined : {}), 501);
  }
  assert.deepEqual(await h.backend(backend => backend.documents("api::role.role").findMany()), roles);
});

test("real fake-Keycloak HTTP proves blocking rollback, inactive outbox commits and no remote adoption", async () => {
  const { KeycloakAdminClient } = backendModule<typeof import("../src/keycloak/admin-client")>("keycloak/admin-client");
  const { createIdamboxUserProvisioningMiddleware } = backendModule<typeof import("../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
  let enabled = true; let failQueue = false;
  await h.backend(async backend => {
    const middleware = createIdamboxUserProvisioningMiddleware(backend, new KeycloakAdminClient({ baseUrl: remote.baseUrl,
      realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID, adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000 }));
    backend.documents.use((context, next) => enabled ? middleware(context, next) : next());
    backend.documents.use(async (context, next) => {
      if (failQueue && context.uid === OUTBOX && ["create", "update"].includes(context.action)) throw new Error("conformance queue fault");
      return next();
    });
  });
  try {
    const active = await create(); const inactive = await create(input({ active: false }));
    for (const [person, state] of [[active, true], [inactive, false]] as const) {
      const row = await read(person.id); assert.ok(row?.externalSubject);
      assert.equal(remote.users.get(row.externalSubject)?.enabled, state);
    }
    const subject = (await read(active.id))!.externalSubject!;
    await json(await h.request(url(active.id), "PUT", { schemas: [CORE_USER_URN], displayName: "Mirrored" }));
    assert.ok(remote.adminRequests().some(request => request.method === "PUT" && request.path.endsWith(subject)));
    const calls = remote.requests.length;
    await json(await h.request(url(active.id), "PATCH", patch({ op: "replace", path: `${ENTERPRISE_USER_URN}:department`, value: "Nonmirrored" })));
    await h.backend(backend => backend.documents(USER).update({ documentId: active.id, data: { roles: [] } }));
    assert.equal(remote.requests.length, calls);
    for (const state of [true, false]) {
      remote.failNext("POST /admin", { status: 503, body: "remote-private-detail" });
      const data = input({ active: state }); const response = await h.request("/scim/v2/Users", "POST", data);
      const body = await json(response, 503); assert.equal(response.headers.get("retry-after"), "30");
      assert.equal(body.scimType, undefined); assert.equal(JSON.stringify(body).includes("remote-private-detail"), false);
      assert.equal(await h.backend(backend => backend.documents(USER).count({ filters: { username: data.userName } })), 0);
    }
    enabled = false;
    const manual = await h.http.createUserFixture({ username: "conformance-remote-claim", email: "claim@conformance.test", displayName: "Unclaimed", accountStatus: "active" });
    enabled = true;
    for (const [id, method, data] of [[active.id, "PATCH", patch({ op: "replace", path: "displayName", value: "Rollback" })],
      [manual, "PUT", { schemas: [CORE_USER_URN], externalId: "failed-claim", displayName: "Rollback" }]] as const) {
      const before = await read(id); const queue = await work(id);
      await h.backend(backend => backend.documents("api::identity-source.identity-source").update({
        documentId: h.primary.documentId, data: { lastActivityAt: "2000-01-01T00:00:00.000Z" } }));
      remote.failNext(id === manual ? "POST /admin" : "PUT /admin", { status: 503 });
      const response = await h.request(url(id), method, data); await json(response, 503);
      assert.equal(response.headers.get("retry-after"), "30");
      assert.deepEqual(await read(id), before); assert.deepEqual(await work(id), queue);
      const source = await h.backend(backend => backend.documents("api::identity-source.identity-source").findOne({ documentId: h.primary.documentId }));
      assert.notEqual(source?.lastActivityAt, "2000-01-01T00:00:00.000Z");
    }
    for (const [person, method] of [[active, "PUT"], [inactive, "PATCH"]] as const) {
      const count = remote.requests.length;
      const data = method === "PUT" ? { schemas: [CORE_USER_URN], active: false, displayName: "Inactive HR" }
        : patch({ op: "replace", value: { active: false, displayName: "Inactive HR" } });
      await json(await h.request(url(person.id), method, data));
      assert.equal(remote.requests.length, count); assert.equal((await read(person.id))?.accountStatus, "inactive");
      assert.equal((await read(person.id))?.displayName, "Inactive HR"); assert.equal((await work(person.id))?.syncStatus, "pending");
    }
    const before = await read(active.id); const queue = await work(active.id);
    remote.failNext("PUT /admin", { status: 503 });
    await json(await h.request(url(active.id), "PATCH", patch({ op: "replace", path: "active", value: true })), 503);
    assert.deepEqual(await read(active.id), before); assert.deepEqual(await work(active.id), queue);
    await json(await h.request(url(active.id), "PATCH", patch({ op: "replace", path: "active", value: true })));
    assert.equal((await work(active.id))?.syncStatus, "cancelled");
    failQueue = true;
    try { await json(await h.request(url(active.id), "DELETE"), 500); }
    finally { failQueue = false; }
    assert.equal((await read(active.id))?.accountStatus, "active"); assert.equal((await read(active.id))?.sourceDeletedAt, null);
    enabled = false;
    const offCalls = remote.requests.length; await create(); assert.equal(remote.requests.length, offCalls);
    // Preserve Phase 2 retry-by-email and its closed upstream-failure mapping; never adopt a different email.
    enabled = true;
    const collision = input();
    const held = remote.addUser({ username: collision.userName, email: "unrelated@conformance.test" });
    const heldBefore = { ...held };
    const collisionResponse = await h.request("/scim/v2/Users", "POST", collision);
    const collisionError = await json(collisionResponse, 503);
    assert.equal(collisionResponse.headers.get("retry-after"), "30");
    assert.equal(collisionError.scimType, undefined);
    assert.equal(await h.backend(backend => backend.documents(USER).findFirst({ filters: { username: collision.userName } })), null);
    assert.deepEqual(remote.users.get(held.id), heldBefore);
  } finally { enabled = false; failQueue = false; }
});

test("DELETE retains original tombstone, tuple, roles, subject and real request/risk/owner relations without delete", async () => {
  const id = await h.http.createUserFixture({ username: "conformance-retained", email: "retained@conformance.test",
    displayName: "Retained", accountStatus: "active", roles: ["Security Analyst"] });
  await h.backend(backend => backendModule<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context")
    .runKeycloakLinkage(backend, id, "conformance-retained-subject"));
  await json(await h.request(url(id), "PUT", { schemas: [CORE_USER_URN], externalId: "retained-key" }));
  const references = [
    ["api::csrm-assessment-request.csrm-assessment-request", "requestor", { requestNumber: "REQ-CONFORMANCE", title: "Retained", requestStatus: "draft", requestor: id }],
    ["api::csrm-risk.csrm-risk", "riskOwner", { riskNumber: "RISK-CONFORMANCE", riskStatement: "Retained", riskOwner: id }],
    ["api::csrm-information-system.csrm-information-system", "owner", { name: "Conformance retained", owner: id }],
  ] as const;
  const ids = await Promise.all(references.map(([uid, , data]) => h.http.createFixtureDocument(uid, data)));
  let deletes = 0;
  await h.backend(async backend => { backend.documents.use(async (context, next) => {
    if (context.uid === USER && ["delete", "deleteMany"].includes(context.action)) deletes++;
    return next();
  }); });
  const before = await read(id); assert.ok(before);
  let tombstone: unknown;
  for (let i = 0; i < 3; i++) {
    const response = await h.request(url(id), "DELETE"); assert.equal(response.status, 204);
    assert.equal(await response.text(), ""); assert.equal(response.headers.get("content-type"), null);
    const row = await read(id); assert.ok(row?.sourceDeletedAt);
    if (i === 0) tombstone = row.sourceDeletedAt; else assert.equal(row.sourceDeletedAt, tombstone);
    for (const field of ["sourceIdentityKey", "sourceExternalId", "externalSubject", "roles", "identitySource"] as const) assert.deepEqual(row[field], before[field]);
  }
  assert.equal(deletes, 0);
  for (let i = 0; i < references.length; i++) {
    const [uid, relation] = references[i];
    const row = await h.backend(backend => backend.documents(uid).findOne({ documentId: ids[i], populate: { [relation]: true } }));
    assert.equal((row as unknown as Record<string, { documentId: string }>)[relation].documentId, id);
  }
  for (const method of ["GET", "PUT", "PATCH"]) await json(await h.request(url(id), method,
    method === "PUT" ? { schemas: [CORE_USER_URN], active: true } : method === "PATCH" ? patch({ op: "replace", path: "active", value: true }) : undefined), 404);
  assert.equal((await query('externalId eq "retained-key"')).totalResults, 0);
  await json(await h.request("/scim/v2/Users", "POST", input({ externalId: "retained-key" })), 409);
});

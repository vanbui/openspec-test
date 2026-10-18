import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CORE_USER_URN, ENTERPRISE_USER_URN, PATCH_OP_URN, LIST_RESPONSE_URN } from "../src/iam/scim/wire";
import { backendModule, startScimHttpHarness } from "./helpers/iam-scim-http-harness";

const USER = "api::idambox-user.idambox-user";
const expected = [
  ["GET", "/Users"], ["POST", "/Users"],
  ...["GET", "PUT", "PATCH", "DELETE"].map(method => [method, "/Users/:id"]),
  ["GET", "/ServiceProviderConfig"], ["GET", "/Schemas"], ["GET", "/Schemas/:id"],
  ["GET", "/ResourceTypes"], ["GET", "/ResourceTypes/:id"], ["GET", "/Groups"], ["GET", "/Groups/:id"],
  ...["/Groups", "/Groups/:id"].flatMap(route => ["POST", "PUT", "PATCH", "DELETE"].map(method => [method, route])),
];
const absent = "z".repeat(24);
let harness: Awaited<ReturnType<typeof startScimHttpHarness>>;
let sequence = 0;
function input(overrides: Record<string, unknown> = {}) {
  const key = `http-user-${++sequence}`;
  return { schemas: [CORE_USER_URN], userName: key, externalId: key,
    emails: [{ value: `${key}@scim.test`, primary: true }], ...overrides };
}
function patch(path: string, value: unknown) {
  return { schemas: [PATCH_OP_URN], Operations: [{ op: "replace", path, value }] };
}
async function json(response: Response, status = 200) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /^application\/scim\+json/);
  const body = await response.json() as Record<string, any>;
  assert.equal(body.data, undefined);
  return body;
}
async function create(data = input(), token?: string) {
  const response = await harness.request("/scim/v2/Users", "POST", data, { token });
  const body = await json(response, 201);
  assert.equal(response.headers.get("location"), `/scim/v2/Users/${body.id}`);
  assert.equal(body.meta.location, response.headers.get("location"));
  return { data, body, id: body.id as string };
}
before(async () => { harness = await startScimHttpHarness(); });
after(async () => { await harness?.close(); });

test("exactly 21 method/template layers mount once at the real root, with no content-api aliases", async () => {
  const layers = await harness.layers();
  const actual = layers.filter(layer => layer.path.startsWith("/scim/v2/"))
    .flatMap(layer => layer.methods.filter(method => method !== "HEAD").map(method => `${method}:${layer.path}`));
  assert.deepEqual(actual.sort(), expected.map(([method, route]) => `${method}:/scim/v2${route}`).sort());
  assert.equal(layers.some(layer => layer.path.startsWith("/api/scim/v2")), false);
  await harness.backend(async backend => {
    const { registerScimRoutes } = backendModule<typeof import("../src/iam/scim/routes")>("iam/scim/routes");
    registerScimRoutes(backend); registerScimRoutes(backend);
  });
  assert.deepEqual(await harness.layers(), layers);
  assert.equal((await harness.http.request({ path: "/api/scim/v2/Users" })).status, 404);
  const manifest = backendModule<{ SCIM_ROUTES: Array<{ method: string; path: string; config: { auth: false; policies: unknown[] } }> }>("iam/scim/routes").SCIM_ROUTES;
  assert.equal(manifest.length, 21);
  for (const route of manifest) {
    assert.equal(route.config.auth, false);
    assert.deepEqual(route.config.policies, [{ name: "global::scim-source-bearer", config: {
      operation: `${route.method}:/scim/v2${route.path.replace(":id", "{id}")}`,
    } }]);
  }
});

test("all 21 operations require source authentication and freshly check their exact individual grant", async () => {
  const grant = await harness.backend(async backend => {
    const [fn] = await backend.documents("api::function.function").findMany({
      filters: { name: "Identity Provisioning" }, populate: { functionApis: true }, limit: 1,
    });
    assert.ok(fn); return { id: fn.documentId, apis: fn.functionApis! };
  });
  for (const [method, route] of expected) {
    const url = `/scim/v2${route.replace(":id", absent)}`;
    const body = ["POST", "PUT", "PATCH"].includes(method) ? {} : undefined;
    const unauthorized = await harness.request(url, method, body, { token: null });
    const error = await json(unauthorized, 401);
    assert.equal(error.status, "401");
    assert.equal(unauthorized.headers.get("www-authenticate"), "Bearer");
    const operation = `${method}:/scim/v2${route.replace(":id", "{id}")}`;
    const held = grant.apis.filter(api => api.url !== operation);
    assert.equal(held.length, grant.apis.length - 1, operation);
    await harness.backend(async backend => {
      await backend.documents("api::function.function").update({ documentId: grant.id,
        data: { functionApis: held.map(api => api.documentId) } });
    });
    try { await json(await harness.request(url, method, body), 403); }
    finally {
      await harness.backend(async backend => {
        await backend.documents("api::function.function").update({ documentId: grant.id,
          data: { functionApis: grant.apis.map(api => api.documentId) } });
      });
    }
  }
});

test("CSRM API tokens, human credentials and forged source headers alone cannot authenticate SCIM", async () => {
  await json(await harness.http.request({ path: "/scim/v2/Users", identity: "owner" }), 401);
  const humanHeaders: Record<string, string>[] = [
    { "x-csrm-dev-identity": harness.http.developmentEmails.jane },
    { "x-csrm-identity-token": "human-identity" }, { Authorization: "Bearer human.keycloak.token" },
    { "x-identity-source": harness.primary.documentId, "x-source-principal": harness.primary.serviceUserId },
  ];
  for (const headers of humanHeaders) await json(await harness.request("/scim/v2/Users", "GET", undefined, { token: null, headers }), 401);
  await json(await harness.request("/scim/v2/Users", "GET", undefined, {
    headers: { "x-csrm-dev-identity": harness.http.developmentEmails.jane, "x-csrm-identity-token": "unrelated" },
  }));
});

test("representative existing CSRM read and ownership refusals remain unchanged", async () => {
  const path = `/api/csrm-assessment-requests/${harness.http.requests.owner}`;
  const allowed = await harness.http.request({ path, identity: "owner" });
  assert.equal(allowed.status, 200);
  assert.ok((await allowed.json() as { data: unknown }).data);
  assert.equal((await harness.http.request({ path, identity: harness.http.identities.otherRequestor })).status, 403);
  assert.equal((await harness.http.request({ path, omitApiToken: true,
    init: { headers: { Authorization: `Bearer ${harness.primary.token}` } } })).status, 401);
});

test("authenticated discovery reads, unknown descriptors and all eight unsupported Group writes use SCIM responses", async () => {
  const config = await json(await harness.request("/scim/v2/ServiceProviderConfig"));
  assert.equal(config.patch.supported, true);
  assert.equal(config.filter.maxResults, 500);
  for (const [collection, id, count] of [["Schemas", CORE_USER_URN, 3], ["ResourceTypes", "User", 2]] as const) {
    const list = await json(await harness.request(`/scim/v2/${collection}`));
    assert.deepEqual(list.schemas, [LIST_RESPONSE_URN]);
    assert.equal(list.totalResults, count);
    assert.equal((await json(await harness.request(`/scim/v2/${collection}/${encodeURIComponent(id)}`))).id, id);
    await json(await harness.request(`/scim/v2/${collection}/missing`), 404);
  }
  const groups = await json(await harness.request("/scim/v2/Groups"));
  assert.equal(groups.totalResults, 0);
  assert.deepEqual(groups.Resources, []);
  await json(await harness.request(`/scim/v2/Groups/${absent}`), 404);
  for (const [method, route] of expected.filter(([method, route]) => route.startsWith("/Groups") && method !== "GET")) {
    await json(await harness.request(`/scim/v2${route.replace(":id", absent)}`, method,
      ["POST", "PUT", "PATCH"].includes(method) ? {} : undefined), 501);
  }
});

test("POST creates only birthright, GET/list use scoped public projections and strict raw queries", async () => {
  const created = await create(input({ schemas: [CORE_USER_URN, ENTERPRISE_USER_URN],
    name: { givenName: "Ada", familyName: "Example" }, [ENTERPRISE_USER_URN]: { department: "Security" } }));
  assert.equal(created.body.displayName, "Ada Example");
  const persisted = await harness.backend(backend => backend.documents(USER).findOne({
    documentId: created.id, populate: { roles: true, identitySource: true },
  }));
  assert.ok(persisted);
  assert.deepEqual(persisted.roles, []);
  assert.equal(persisted.identitySource?.documentId, harness.primary.documentId);
  assert.equal(persisted.protected, false);
  const read = await json(await harness.request(`/scim/v2/Users/${created.id}?attributes=userName,roles`), 400);
  assert.equal(read.scimType, "invalidValue");
  const projected = await json(await harness.request(`/scim/v2/Users/${created.id}?attributes=userName`));
  assert.deepEqual(Object.keys(projected).sort(), ["id", "schemas", "userName"]);
  const query = new URLSearchParams({ filter: `externalId eq "${created.data.externalId}"`, count: "1" });
  const list = await json(await harness.request(`/scim/v2/Users?${query}`));
  assert.equal(list.totalResults, 1);
  assert.equal(list.Resources[0].id, created.id);
  assert.equal(list.Resources[0].identitySource, undefined);
  const counted = await json(await harness.request(`/scim/v2/Users?${query}&count=0`), 400);
  assert.equal(counted.scimType, "invalidValue");
  query.set("count", "0");
  const zero = await json(await harness.request(`/scim/v2/Users?${query}`));
  assert.equal(zero.totalResults, 1); assert.equal(zero.itemsPerPage, 0); assert.equal(zero.Resources, undefined);
  await json(await harness.request("/scim/v2/Users", "POST", { ...input(), roles: [] }), 400);
  await json(await harness.request("/scim/v2/Users", "POST", created.data), 409);
});

test("PUT replaces asserted attributes and clears explicit nulls; PATCH reduces atomically and preserves path errors", async () => {
  const created = await create(input({ title: "Before", name: { givenName: "Before" } }));
  const replaced = await json(await harness.request(`/scim/v2/Users/${created.id}`, "PUT", {
    ...created.data, title: null, name: null, displayName: "Replacement",
  }));
  assert.equal(replaced.title, undefined); assert.equal(replaced.name, undefined);
  assert.equal(replaced.displayName, "Replacement");
  const updated = await json(await harness.request(`/scim/v2/Users/${created.id}`, "PATCH", patch("title", "After")));
  assert.equal(updated.title, "After");
  for (const [path, scimType] of [["unsupported", "invalidPath"], ['emails[value eq "missing@scim.test"].value', "noTarget"]]) {
    const failed = await json(await harness.request(`/scim/v2/Users/${created.id}`, "PATCH", {
      schemas: [PATCH_OP_URN], Operations: [{ op: "replace", path: "title", value: "Must roll back" },
        { op: "replace", path, value: "another@scim.test" }],
    }), 400);
    assert.equal(failed.scimType, scimType);
    assert.equal((await json(await harness.request(`/scim/v2/Users/${created.id}`))).title, "After");
  }
});

test("the pinned connector's partial mover PUT keeps every attribute it omits and never reactivates a leaver (P3-34)", async () => {
  const key = `connector-${++sequence}`;
  const created = await create({ schemas: [CORE_USER_URN, "urn:ietf:params:scim:schemas:extension:slack:profile:2.0:User"],
    userName: key, displayName: "Pat Probe", active: true, groups: [], title: "Probe Analyst", name: { givenName: "Pat", familyName: "Probe" },
    emails: [{ value: `${key}@scim.test`, type: "work", primary: true }],
    [ENTERPRISE_USER_URN]: { employeeNumber: key, department: "Research" } } as unknown as ReturnType<typeof input>);
  assert.equal(created.body.externalId, key);
  // The body connector 1.2.9 sends for a title change (observed live): no emails, Enterprise data or externalId.
  const moved = await json(await harness.request(`/scim/v2/Users/${created.id}`, "PUT", {
    active: true, displayName: "Pat Probe", groups: [], id: created.id, name: { familyName: "Probe", givenName: "Pat" },
    schemas: [CORE_USER_URN], title: "Senior Probe Analyst", userName: key }));
  assert.equal(moved.title, "Senior Probe Analyst");
  assert.equal(moved.externalId, key);
  assert.deepEqual(moved.emails, [{ value: `${key}@scim.test`, primary: true }]);
  assert.deepEqual(moved[ENTERPRISE_USER_URN], { employeeNumber: key, department: "Research" });
  // Leaver, then a PUT that does not assert active: the user stays inactive.
  assert.equal((await json(await harness.request(`/scim/v2/Users/${created.id}`, "PUT", { schemas: [CORE_USER_URN], active: false }))).active, false);
  const later = await json(await harness.request(`/scim/v2/Users/${created.id}`, "PUT", { schemas: [CORE_USER_URN], title: "After leaving" }));
  assert.equal(later.active, false); assert.equal(later.title, "After leaving");
  // A different asserted source key is refused; the key stays immutable.
  assert.equal((await json(await harness.request(`/scim/v2/Users/${created.id}`, "PUT", { schemas: [CORE_USER_URN], externalId: "other" }), 400)).scimType, "mutability");
});

test("only explicit manual PUT claims; foreign and protected records stay hidden even with development identity", async () => {
  const manualId = await harness.http.createUserFixture({ username: "manual-http", email: "manual-http@scim.test",
    displayName: "Manual", accountStatus: "active", roles: ["Security Analyst"] });
  const manual = await json(await harness.request(`/scim/v2/Users/${manualId}`));
  assert.equal(manual.externalId, undefined);
  await json(await harness.request(`/scim/v2/Users/${manualId}`, "PATCH", patch("title", "No claim")), 404);
  await json(await harness.request(`/scim/v2/Users/${manualId}`, "DELETE"), 404);
  // A claim must assert the source key (externalId or the Enterprise employeeNumber); a partial PUT cannot claim.
  assert.equal((await json(await harness.request(`/scim/v2/Users/${manualId}`, "PUT", { schemas: [CORE_USER_URN], title: "No key" }), 400)).scimType, "invalidValue");
  assert.equal((await json(await harness.request(`/scim/v2/Users/${manualId}`))).externalId, undefined);
  await json(await harness.request(`/scim/v2/Users/${manualId}`, "PUT", input({
    userName: "manual-http", emails: [{ value: "manual-http@scim.test" }], externalId: "confirmed-manual",
  })));
  const row = await harness.backend(backend => backend.documents(USER).findOne({ documentId: manualId, populate: { roles: true } }));
  assert.deepEqual(row?.roles?.map(role => role.name), ["Security Analyst"]);
  const foreign = await harness.source();
  const foreignUser = await create(input(), foreign.token);
  for (const id of [foreignUser.id, harness.primary.serviceUserId]) {
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      await json(await harness.request(`/scim/v2/Users/${id}`, method,
        method === "PUT" ? input() : method === "PATCH" ? patch("title", "Hidden") : undefined,
        { headers: { "x-csrm-dev-identity": harness.http.developmentEmails.jane } }), 404);
    }
  }
});

test("DELETE retains roles, subject, source tuple and request references; tombstone deletion is idempotent", async () => {
  const id = await harness.http.createUserFixture({ username: "retained-http", email: "retained-http@scim.test",
    displayName: "Retained", accountStatus: "active", roles: ["Security Analyst"] });
  await harness.backend(backend => backendModule<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context")
    .runKeycloakLinkage(backend, id, "retained-subject"));
  await json(await harness.request(`/scim/v2/Users/${id}`, "PUT", input({ userName: "retained-http",
    emails: [{ value: "retained-http@scim.test" }], externalId: "retained-key" })));
  const requestId = await harness.http.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "REQ-SCIM-RETAINED", title: "Retained reference", requestStatus: "draft", requestor: id,
  });
  const riskId = await harness.http.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: "RISK-SCIM-RETAINED", riskStatement: "Retained risk", riskOwner: id,
  });
  const systemId = await harness.http.createFixtureDocument("api::csrm-information-system.csrm-information-system", {
    name: "Retained system", owner: id,
  });
  const read = () => harness.backend(backend => backend.documents(USER).findOne({ documentId: id, populate: { roles: true } }));
  const before = await read();
  for (let i = 0; i < 2; i++) {
    const response = await harness.request(`/scim/v2/Users/${id}`, "DELETE");
    assert.equal(response.status, 204); assert.equal(await response.text(), "");
    assert.equal(response.headers.get("content-type"), null);
  }
  const after = await read();
  assert.ok(before && after);
  assert.equal(after.accountStatus, "inactive"); assert.ok(after.sourceDeletedAt);
  assert.equal(after.sourceIdentityKey, before.sourceIdentityKey);
  assert.equal(after.externalSubject, "retained-subject");
  assert.deepEqual(after.roles?.map(role => role.name), ["Security Analyst"]);
  const tombstone = after.sourceDeletedAt;
  assert.equal((await harness.request(`/scim/v2/Users/${id}`, "DELETE")).status, 204);
  assert.equal((await read())?.sourceDeletedAt, tombstone);
  const reference = await harness.backend(backend => backend.documents("api::csrm-assessment-request.csrm-assessment-request")
    .findOne({ documentId: requestId, populate: { requestor: true } }));
  assert.equal(reference?.requestor?.documentId, id);
  const risk = await harness.backend(backend => backend.documents("api::csrm-risk.csrm-risk")
    .findOne({ documentId: riskId, populate: { riskOwner: true } }));
  const system = await harness.backend(backend => backend.documents("api::csrm-information-system.csrm-information-system")
    .findOne({ documentId: systemId, populate: { owner: true } }));
  assert.equal(risk?.riskOwner?.documentId, id); assert.equal(system?.owner?.documentId, id);
  for (const method of ["GET", "PUT", "PATCH"]) await json(await harness.request(`/scim/v2/Users/${id}`, method,
    method === "PUT" ? input() : method === "PATCH" ? patch("title", "No restore") : undefined), 404);
  const list = await json(await harness.request(`/scim/v2/Users?filter=${encodeURIComponent('externalId eq "retained-key"')}`));
  assert.equal(list.totalResults, 0);
  await json(await harness.request("/scim/v2/Users", "POST", input({ externalId: "retained-key" })), 409);
});

test("blocking provisioning failures roll back create, mirrored update, reactivation and claim; inactive updates commit outbox", async () => {
  const existing = await create();
  const inactive = await create(input({ active: false }));
  const manualId = await harness.http.createUserFixture({ username: "rollback-claim", email: "rollback-claim@scim.test",
    displayName: "Unclaimed", accountStatus: "active" });
  const { KeycloakAdminClient, KeycloakProvisioningError } = backendModule<typeof import("../src/keycloak/admin-client")>("keycloak/admin-client");
  const { createIdamboxUserProvisioningMiddleware } = backendModule<typeof import("../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
  let attempts = 0;
  function unavailable(): never { attempts++; throw new KeycloakProvisioningError("Isolated upstream refusal", 503); }
  class UnavailableClient extends KeycloakAdminClient {
    async findUserById(): Promise<never> { return unavailable(); }
    async findUserByEmail(): Promise<never> { return unavailable(); }
    async createUser(): Promise<never> { return unavailable(); }
    async updateUser(): Promise<never> { return unavailable(); }
  }
  let enabled = true;
  await harness.backend(async backend => {
    const middleware = createIdamboxUserProvisioningMiddleware(backend, new UnavailableClient({
      baseUrl: "http://127.0.0.1:1", realm: "test", adminClientId: "isolated", adminClientSecret: "isolated",
      requestTimeoutMs: 100,
    }));
    backend.documents.use((context, next) => enabled ? middleware(context, next) : next());
  });
  try {
    for (const active of [true, false]) {
      const data = input({ active });
      const response = await harness.request("/scim/v2/Users", "POST", data);
      const body = await json(response, 503);
      assert.equal(response.headers.get("retry-after"), "30");
      assert.equal(body.scimType, undefined);
      assert.equal(JSON.stringify(body).includes("Isolated upstream"), false);
      assert.equal(await harness.backend(backend => backend.documents(USER).count({ filters: { username: data.userName } })), 0);
    }
    for (const [id, body] of [[existing.id, patch("displayName", "Rollback")], [inactive.id, patch("active", true)]] as const) {
      const response = await harness.request(`/scim/v2/Users/${id}`, "PATCH", body);
      await json(response, 503); assert.equal(response.headers.get("retry-after"), "30");
    }
    await json(await harness.request(`/scim/v2/Users/${manualId}`, "PUT", input({ userName: "rollback-claim",
      emails: [{ value: "rollback-claim@scim.test" }], displayName: "Rollback", externalId: "rollback-key" })), 503);
    const manual = await harness.backend(backend => backend.documents(USER).findOne({ documentId: manualId, populate: { identitySource: true } }));
    assert.equal(manual?.identitySource, null); assert.equal(manual?.displayName, "Unclaimed");
    assert.equal((await json(await harness.request(`/scim/v2/Users/${existing.id}`))).displayName, existing.body.displayName);
    assert.equal((await json(await harness.request(`/scim/v2/Users/${inactive.id}`))).active, false);
    assert.equal(attempts, 5);
    for (const method of ["PUT", "PATCH"]) {
      const target = method === "PUT" ? existing : inactive;
      await harness.backend(backend => backendModule<typeof import("../src/iam/identity/write-context")>("iam/identity/write-context")
        .runKeycloakLinkage(backend, target.id, `outbox-${method.toLowerCase()}`));
      const body = method === "PUT" ? { ...target.data, active: false, displayName: "Committed inactive" }
        : { schemas: [PATCH_OP_URN], Operations: [{ op: "replace", value: { active: false, displayName: "Committed inactive" } }] };
      const response = await json(await harness.request(`/scim/v2/Users/${target.id}`, method, body));
      assert.equal(response.active, false); assert.equal(response.displayName, "Committed inactive");
      const outbox = await harness.backend(backend => backend.documents("api::keycloak-sync-outbox.keycloak-sync-outbox")
        .findFirst({ filters: { userDocumentId: target.id } }));
      assert.ok(outbox); assert.equal(outbox.syncStatus, "pending");
    }
    assert.equal(attempts, 5);
  } finally { enabled = false; }
});

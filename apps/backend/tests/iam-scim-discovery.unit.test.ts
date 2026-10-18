import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyGroupList, groupResource, groupWrite, resourceTypeById, resourceTypes, schemaById, schemas,
  serviceProviderConfig, type SchemaAttribute, type SchemaDescriptor } from "../src/iam/scim/discovery";
import { ERROR_URN, SCIM_MEDIA_TYPE, type ScimFailure } from "../src/iam/scim/errors";
import { CORE_USER_URN, ENTERPRISE_USER_URN, GROUP_URN, LIST_RESPONSE_URN, parseCreateUser } from "../src/iam/scim/wire";
import { toScimUser } from "../src/iam/scim/mapping";

test("discovery advertises only implemented capabilities and bearer authentication", () => {
  assert.deepEqual(serviceProviderConfig(), {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 500 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{ name: "Bearer Token", description: "Identity Source bearer token",
      type: "oauthbearertoken", primary: true }],
    meta: { resourceType: "ServiceProviderConfig", location: "/scim/v2/ServiceProviderConfig" },
  });
});

function descriptor(id: string): SchemaDescriptor {
  const result = schemaById(id);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected a known schema");
  return result.value;
}
function attribute(items: SchemaAttribute[], name: string): SchemaAttribute {
  const found = items.find((item) => item.name === name);
  assert.ok(found, `Expected attribute ${name}`);
  return found;
}
function safeFailure(result: ScimFailure, status: number, detail: string) {
  assert.deepEqual(result, { ok: false, error: { status, headers: { "Content-Type": SCIM_MEDIA_TYPE },
    body: { schemas: [ERROR_URN], status: String(status), detail } } });
}

test("schema discovery exposes exactly Core User, Enterprise User and standard Group URNs", () => {
  assert.deepEqual(schemas().map((item) => item.id), [
    "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
    "urn:ietf:params:scim:schemas:core:2.0:Group",
  ]);
  for (const item of schemas()) {
    assert.deepEqual(item.schemas, ["urn:ietf:params:scim:schemas:core:2.0:Schema"]);
    assert.deepEqual(schemaById(item.id), { ok: true, value: item });
    assert.deepEqual(item.meta, { resourceType: "Schema", location: `/scim/v2/Schemas/${item.id}` });
    assert.ok(item.name);
    assert.ok(item.description);
  }
});

test("Core User describes the supported projection, required inputs and field ownership", () => {
  const attrs = descriptor(CORE_USER_URN).attributes;
  assert.deepEqual(attrs.map((item) => item.name), ["id", "externalId", "userName", "name", "displayName", "active", "emails", "title", "meta"]);
  for (const name of ["userName", "externalId", "emails"]) assert.equal(attribute(attrs, name).required, true);
  for (const name of ["name", "displayName", "active", "title", "meta", "id"]) assert.equal(attribute(attrs, name).required, false);
  assert.equal(attribute(attrs, "id").mutability, "readOnly");
  assert.equal(attribute(attrs, "id").returned, "always");
  assert.equal(attribute(attrs, "id").caseExact, true);
  assert.equal(attribute(attrs, "id").uniqueness, "global");
  assert.equal(attribute(attrs, "externalId").mutability, "immutable");
  assert.equal(attribute(attrs, "externalId").caseExact, true);
  assert.equal(attribute(attrs, "externalId").uniqueness, "none");
  assert.equal(attribute(attrs, "userName").uniqueness, "server");
  for (const name of ["userName", "displayName", "title"]) {
    assert.equal(attribute(attrs, name).mutability, "readWrite");
    assert.equal(attribute(attrs, name).caseExact, false);
    assert.equal(attribute(attrs, name).returned, "default");
  }
  assert.equal(attribute(attrs, "active").type, "boolean");
  assert.equal(attribute(attrs, "active").mutability, "readWrite");
  const parts = attribute(attrs, "name").subAttributes ?? [];
  assert.deepEqual(parts.map((item) => item.name), ["givenName", "familyName"]);
  for (const part of parts) {
    assert.equal(part.required, false);
    assert.equal(part.mutability, "readWrite");
    assert.equal(part.caseExact, false);
  }
  const meta = attribute(attrs, "meta");
  assert.equal(meta.mutability, "readOnly");
  assert.deepEqual(meta.subAttributes?.map((item) => item.name), ["resourceType", "location"]);
  for (const part of meta.subAttributes ?? []) assert.equal(part.mutability, "readOnly");
});

test("email descriptor promises only the selected primary email that the mapper returns", () => {
  const email = attribute(descriptor(CORE_USER_URN).attributes, "emails");
  assert.equal(email.type, "complex");
  assert.equal(email.multiValued, true);
  assert.equal(email.mutability, "readWrite");
  assert.match(email.description, /selected primary/i);
  assert.deepEqual(email.subAttributes?.map((item) => item.name), ["value", "primary"]);
  const value = attribute(email.subAttributes ?? [], "value");
  assert.equal(value.required, true);
  assert.equal(value.caseExact, false);
  assert.equal(attribute(email.subAttributes ?? [], "primary").type, "boolean");
  const parsed = parseCreateUser({ schemas: [CORE_USER_URN], userName: "ada", externalId: "HR-Ada",
    emails: [{ value: "secondary@example.test" }, { value: "ada@example.test", primary: true, type: "work", display: "Work" }] });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("Expected valid primary selection");
  const mapped = toScimUser({ ...parsed.value, documentId: "user123" });
  assert.deepEqual(mapped.emails, [{ value: "ada@example.test", primary: true }]);
  for (const key of Object.keys(mapped)) {
    if (key !== "schemas") assert.ok(attrsHave(key), `Mapped field ${key} must be described`);
  }
  function attrsHave(name: string) { return descriptor(CORE_USER_URN).attributes.some((item) => item.name === name); }
});

test("Enterprise discovery describes only optional employeeNumber and department", () => {
  const attrs = descriptor(ENTERPRISE_USER_URN).attributes;
  assert.deepEqual(attrs.map((item) => item.name), ["employeeNumber", "department"]);
  for (const item of attrs) {
    assert.equal(item.type, "string");
    assert.equal(item.required, false);
    assert.equal(item.multiValued, false);
    assert.equal(item.caseExact, false);
    assert.equal(item.mutability, "readWrite");
    assert.equal(item.returned, "default");
  }
});

test("Group discovery provides standard displayName and members attributes without Role attributes", () => {
  const attrs = descriptor(GROUP_URN).attributes;
  assert.deepEqual(attrs.map((item) => item.name), ["displayName", "members"]);
  assert.equal(attribute(attrs, "displayName").required, true);
  const members = attribute(attrs, "members");
  assert.equal(members.type, "complex");
  assert.equal(members.multiValued, true);
  assert.deepEqual(members.subAttributes?.map((item) => item.name), ["value", "$ref", "type", "display"]);
  const parts = members.subAttributes ?? [];
  assert.equal(attribute(parts, "value").mutability, "immutable");
  assert.equal(attribute(parts, "$ref").type, "reference");
  assert.equal(attribute(parts, "$ref").mutability, "immutable");
  assert.deepEqual(attribute(parts, "$ref").referenceTypes, ["User", "Group"]);
  assert.equal(attribute(parts, "type").mutability, "immutable");
  assert.deepEqual(attribute(parts, "type").canonicalValues, ["User", "Group"]);
  assert.equal(attribute(parts, "display").mutability, "readOnly");
});

test("ResourceTypes describe User and Group endpoints with an optional Enterprise extension", () => {
  assert.deepEqual(resourceTypes(), [
    { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "User", name: "User", endpoint: "/Users",
      schema: CORE_USER_URN, schemaExtensions: [{ schema: ENTERPRISE_USER_URN, required: false }],
      meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/User" } },
    { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "Group", name: "Group", endpoint: "/Groups",
      schema: GROUP_URN, meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/Group" } },
  ]);
  for (const item of resourceTypes()) assert.deepEqual(resourceTypeById(item.id), { ok: true, value: item });
});

test("unknown schema and ResourceType ids return the same safe 404 without echoing input", () => {
  for (const id of ["", "unknown", "user", "Users", "group", "__proto__", "constructor", "toString", "../Users", "%55ser", "private\nvalue"]) {
    for (const lookup of [schemaById, resourceTypeById]) {
      const result = lookup(id);
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("Expected unknown lookup to fail");
      safeFailure(result, 404, "The resource was not found.");
    }
  }
  assert.equal(schemaById(CORE_USER_URN.toUpperCase()).ok, false);
  assert.equal(resourceTypeById(CORE_USER_URN).ok, false);
  assert.equal(schemaById("User").ok, false);
});

test("Groups return a standard empty list, fixed resource 404 and safe write 501", () => {
  assert.deepEqual(emptyGroupList(), { schemas: [LIST_RESPONSE_URN], totalResults: 0, startIndex: 1, itemsPerPage: 0, Resources: [] });
  safeFailure(groupResource(), 404, "The resource was not found.");
  safeFailure(groupWrite(), 501, "Group writes are not supported.");
});

test("discovery results are isolated between calls and contain no invented timestamps or versions", () => {
  const baseline = JSON.stringify([serviceProviderConfig(), schemas(), resourceTypes(), emptyGroupList(), groupResource(), groupWrite()]);
  const config = serviceProviderConfig();
  config.filter.maxResults = 1;
  config.patch.supported = false;
  config.authenticationSchemes[0].name = "changed";
  const schema = descriptor(CORE_USER_URN);
  schema.attributes[0].name = "roles";
  schema.attributes.push({ ...schema.attributes[0] });
  const types = resourceTypes();
  types[0].endpoint = "/Roles";
  types[0].schemaExtensions?.push({ schema: "private", required: true });
  const failed = groupWrite();
  failed.error.body.detail = "changed";
  assert.equal(JSON.stringify([serviceProviderConfig(), schemas(), resourceTypes(), emptyGroupList(), groupResource(), groupWrite()]), baseline);
  assert.doesNotMatch(baseline, /"(?:created|lastModified|version|ETag|roles|password|externalSubject|identitySource|sourceIdentityKey)"/);
});

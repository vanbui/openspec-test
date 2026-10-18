import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCreateUser, parseReplaceUser, CORE_USER_URN, ENTERPRISE_USER_URN, SCIM_MEDIA_TYPE, scimResponse } from "../src/iam/scim/wire";
import { toScimUser } from "../src/iam/scim/mapping";
import { scimFailure, fromIdentityFailure, unexpectedScimFailure, ERROR_URN, type ScimErrorCode } from "../src/iam/scim/errors";
import type { SourceIdentityInput } from "../src/iam/identity/identity-input";

const base = () => ({ schemas: [CORE_USER_URN], userName: "ada", externalId: "  HR-Ada  ", emails: [{ value: "ada@example.test" }] });
function parsed(input: unknown, replace = false): SourceIdentityInput {
  // A replacement returns only asserted attributes (P3-34); tests read the fields they assert.
  const result = (replace ? parseReplaceUser(input, "doc123") : parseCreateUser(input)) as ReturnType<typeof parseCreateUser>;
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error("Expected successful parse");
  return result.value;
}
function rejected(input: unknown, type: string, replace = false) {
  const result = replace ? parseReplaceUser(input, "doc123") : parseCreateUser(input);
  assert.equal(result.ok, false, JSON.stringify(input));
  if (result.ok) throw new Error("Expected rejected input");
  assert.equal(result.error.body.scimType, type);
  assert.equal(result.error.body.status, "400");
}

test("create maps every supported field, preserves opaque identifiers and selects only the primary email", () => {
  assert.deepEqual(parsed({ ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN],
    emails: [{ value: "secondary@example.test" }, { value: "primary@example.test", primary: true, type: "work", display: "Work" }],
    name: { givenName: " Ada ", familyName: " Lovelace " }, displayName: "Countess", active: false,
    title: "Engineer", [ENTERPRISE_USER_URN]: { employeeNumber: "E1", department: "Research" },
  }), { username: "ada", email: "primary@example.test", sourceExternalId: "  HR-Ada  ",
    firstName: " Ada ", lastName: " Lovelace ", displayName: "Countess", accountStatus: "inactive",
    employeeNumber: "E1", department: "Research", jobTitle: "Engineer" });
});

test("displayName fallback trims name parts, then uses userName; omitted active defaults true", () => {
  for (const [name, expected] of [[{ givenName: " Ada ", familyName: " Lovelace " }, "Ada Lovelace"],
    [{ givenName: "  ", familyName: " Byron " }, "Byron"], [{}, "ada"]] as const) {
    for (const displayName of [undefined, "", "  ", null]) {
      const value = parsed({ ...base(), name, ...(displayName === undefined ? {} : { displayName }) });
      assert.equal(value.displayName, expected);
      assert.equal(value.accountStatus, "active");
    }
  }
});

test("replace returns only asserted attributes (P3-34) and accepts a consistent read-only echo", () => {
  const input = { ...base(), id: "doc123", meta: { resourceType: "User", location: "/scim/v2/Users/doc123" } };
  // Omitted attributes, including active, are not asserted: the service keeps their current values.
  assert.deepEqual(parsed(input, true), { username: "ada", email: "ada@example.test", sourceExternalId: "  HR-Ada  " });
  assert.equal("accountStatus" in parsed(input, true), false);
  assert.deepEqual(parsed({ schemas: [CORE_USER_URN], title: "Mover" }, true), { jobTitle: "Mover" });
  assert.deepEqual(parsed({ schemas: [CORE_USER_URN], active: false }, true), { accountStatus: "inactive" });
  assert.deepEqual(parsed({ schemas: [CORE_USER_URN], name: { givenName: "Ada", familyName: "King" } }, true),
    { firstName: "Ada", lastName: "King", displayName: "Ada King" });
  for (const id of ["wrong", 123, null, ""]) rejected({ ...input, id }, "invalidValue", true);
  for (const key of ["id", "meta"]) rejected({ ...base(), [key]: key === "id" ? "doc123" : {} }, "mutability");
});

test("optional nulls clear source fields on create and replacement", () => {
  for (const replace of [false, true]) {
    const value = parsed({ ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], name: null, title: null,
      [ENTERPRISE_USER_URN]: { employeeNumber: null, department: null } }, replace);
    for (const field of ["firstName", "lastName", "employeeNumber", "department", "jobTitle"] as const) assert.equal(value[field], null);
  }
});

test("the pinned connector's observed create body maps, with employeeNumber as the source key (P3-33)", () => {
  // Captured live from SCIM2 connector 1.2.9 on midPoint 4.8.14 (2026-10-16), with the JSON-string email mapping.
  const connectorBody = {
    active: true, displayName: "Pat Probe", [ENTERPRISE_USER_URN]: { employeeNumber: "P3-PROBE-0001" }, groups: [],
    name: { familyName: "Probe", givenName: "Pat" }, emails: [{ value: "pat.probe@idambox.test", primary: true, type: "work" }],
    schemas: [CORE_USER_URN, "urn:ietf:params:scim:schemas:extension:slack:profile:2.0:User"], title: "Probe Analyst", userName: "probe.joiner",
  };
  for (const replace of [false, true]) {
    const value = parsed(connectorBody, replace);
    assert.equal(value.sourceExternalId, "P3-PROBE-0001");
    assert.equal(value.employeeNumber, "P3-PROBE-0001");
    assert.equal(value.email, "pat.probe@idambox.test");
    assert.equal(value.username, "probe.joiner");
    assert.equal(value.jobTitle, "Probe Analyst");
  }
  // An explicit externalId stays the key, as every standard SCIM client sends it.
  assert.equal(parsed({ ...connectorBody, externalId: "HR-1" }).sourceExternalId, "HR-1");
  // Neither externalId nor employeeNumber: no source key, refused.
  const { [ENTERPRISE_USER_URN]: _enterprise, ...withoutKey } = connectorBody;
  rejected(withoutKey, "invalidValue");
  rejected({ ...connectorBody, [ENTERPRISE_USER_URN]: { employeeNumber: " " } }, "invalidValue");
});

test("closed schema and resource shape validation rejects malformed or unsupported values", () => {
  for (const input of [null, [], "{}", 1, true, {}, { ...base(), schemas: undefined },
    { ...base(), schemas: [] }, { ...base(), schemas: [ENTERPRISE_USER_URN] },
    { ...base(), schemas: [CORE_USER_URN, "unknown"] }, { ...base(), schemas: [CORE_USER_URN, CORE_USER_URN] },
    { ...base(), schemas: CORE_USER_URN }, { ...base(), schemas: [CORE_USER_URN, null] }, { ...base(), schemas: [CORE_USER_URN, 4] },
    { ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], [ENTERPRISE_USER_URN]: [] },
    { ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], [ENTERPRISE_USER_URN]: "Research" },
    { ...base(), name: [] }, { ...base(), name: "Ada" },
    ...["true", 0, null, {}].map((active) => ({ ...base(), active }))]) rejected(input, "invalidValue");
});

test("required fields and shared source DTO constraints are enforced for create and replacement", () => {
  for (const replace of [false, true]) {
    for (const key of ["userName", "externalId", "emails"] as const) {
      const input: Record<string, unknown> = base(); delete input[key];
      // Create requires them; a replacement that omits them leaves the current values (P3-34).
      if (replace) assert.equal(key === "externalId" ? "sourceExternalId" in parsed(input, true) : true, key !== "externalId");
      else rejected(input, "invalidValue");
      for (const value of [null, "", " ", 12, {}, "x".repeat(256)]) rejected({ ...base(), [key]: value }, "invalidValue", replace);
    }
    for (const input of [{ ...base(), displayName: 4 }, { ...base(), title: false },
      { ...base(), name: { givenName: 4 } }, { ...base(), name: { familyName: "x".repeat(256) } },
      { ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], [ENTERPRISE_USER_URN]: { employeeNumber: 4 } },
      { ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], [ENTERPRISE_USER_URN]: { department: [] } }]) rejected(input, "invalidValue", replace);
  }
});

test("email ambiguity, malformed addresses and invalid subattribute types fail closed", () => {
  for (const emails of [[], null, {}, [null], ["ada@example.test"], [{}], [{ value: "invalid" }],
    [{ value: "ada@example.test", primary: "yes" }], [{ value: "ada@example.test", primary: null }],
    [{ value: "ada@example.test", type: 4 }], [{ value: "ada@example.test", display: {} }],
    [{ value: "ada@example.test" }, { value: "other@example.test" }],
    [{ value: "ada@example.test", primary: false }, { value: "other@example.test", primary: false }],
    [{ value: "ada@example.test", primary: true }, { value: "other@example.test", primary: true }]]) rejected({ ...base(), emails }, "invalidValue");
  assert.equal(parsed({ ...base(), emails: [{ value: "ada@example.test", primary: false }] }).email, "ada@example.test");
  // P3-35: the pinned connector may send primary as a string.
  assert.equal(parsed({ ...base(), emails: [{ value: "other@example.test" }, { value: "ada@example.test", primary: "true" }] }).email, "ada@example.test");
});

test("owned fields fail mutability at every object boundary; unsupported writable paths fail invalidPath", () => {
  const owned = ["roles", "protected", "externalSubject", "password", "identitySource", "sourceIdentityKey", "sourceDeletedAt", "lastSyncedAt"];
  for (const field of owned) {
    for (const replace of [false, true]) {
      rejected({ ...base(), [field]: null }, "mutability", replace);
      rejected({ ...base(), [field.toUpperCase()]: [] }, "mutability", replace);
      rejected({ ...base(), name: { [field]: "value" } }, "mutability", replace);
    }
  }
  for (const groups of [[{ value: "analysts" }], {}, "analysts", null]) {
    rejected({ ...base(), groups }, "mutability");
    rejected({ ...base(), groups }, "mutability", true);
  }
  for (const input of [{ ...base(), username: "other" }, { ...base(), unknown: null },
    { ...base(), name: { formatted: "Ada" } }, { ...base(), emails: [{ value: "ada@example.test", unknown: true }] },
    { ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], [ENTERPRISE_USER_URN]: { manager: "someone" } },
    JSON.parse(JSON.stringify(base()).replace('"userName"', '"__proto__"'))]) rejected(input, "invalidPath");
});

test("outbound allowlist omits private fields and unassigned optionals without inventing metadata", () => {
  const source = { ...parsed({ ...base(), schemas: [CORE_USER_URN, ENTERPRISE_USER_URN],
    name: { givenName: "Ada", familyName: "Lovelace" }, title: "Engineer",
    [ENTERPRISE_USER_URN]: { employeeNumber: "E1", department: "Research" } }), documentId: "doc123",
    id: 7, roles: [{ name: "Administrator" }], protected: true, password: "private", externalSubject: "private",
    identitySource: {}, sourceIdentityKey: "private", sourceDeletedAt: "private", lastSyncedAt: "private" };
  assert.deepEqual(toScimUser(source), { schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], id: "doc123", userName: "ada",
    externalId: "  HR-Ada  ", emails: [{ value: "ada@example.test", primary: true }], name: { givenName: "Ada", familyName: "Lovelace" },
    displayName: "Ada Lovelace", active: true, title: "Engineer", [ENTERPRISE_USER_URN]: { employeeNumber: "E1", department: "Research" },
    meta: { resourceType: "User", location: "/scim/v2/Users/doc123" } });
  const { sourceExternalId: _externalId, ...manual } = { ...source, firstName: null, lastName: "", employeeNumber: null, department: "", jobTitle: null };
  const output = toScimUser(manual);
  assert.equal("externalId" in output, false);
  assert.equal("name" in output, false);
  assert.equal(ENTERPRISE_USER_URN in output, false);
  assert.equal("title" in output, false);
  assert.deepEqual(output.schemas, [CORE_USER_URN]);
  assert.equal(toScimUser({ ...manual, accountStatus: "inactive", documentId: "a/b?#" }).meta.location, "/scim/v2/Users/a%2Fb%3F%23");
  assert.equal(toScimUser({ ...manual, accountStatus: "inactive" }).active, false);
});

test("all closed error mappings use safe SCIM envelopes, exact status and retry headers", () => {
  const cases: Array<[ScimErrorCode, number, string | undefined]> = [
    ["invalidInput", 400, "invalidValue"], ["syntax", 400, "invalidSyntax"], ["filter", 400, "invalidFilter"],
    ["path", 400, "invalidPath"], ["noTarget", 400, "noTarget"], ["forbiddenWrite", 400, "mutability"],
    ["immutableSourceKey", 400, "mutability"], ["uniqueness", 409, "uniqueness"], ["notFound", 404, undefined],
    ["forbidden", 403, undefined], ["groupWrite", 501, undefined], ["unexpected", 500, undefined], ["keycloakUnavailable", 503, undefined],
  ];
  for (const [code, status, scimType] of cases) {
    const { error } = scimFailure(code);
    assert.equal(error.status, status);
    assert.deepEqual(error.body.schemas, [ERROR_URN]);
    assert.equal(error.body.status, String(status));
    assert.equal(error.body.scimType, scimType);
    assert.equal("scimType" in error.body, scimType !== undefined);
    assert.equal(error.headers["Content-Type"], SCIM_MEDIA_TYPE);
    assert.equal(error.headers["Retry-After"], code === "keycloakUnavailable" ? "30" : undefined);
    assert.equal(typeof error.body.detail, "string");
  }
  for (const code of ["forbidden", "notFound", "uniqueness", "immutableSourceKey", "invalidInput", "keycloakUnavailable"] as const) {
    const failure = code === "keycloakUnavailable" ? { ok: false as const, code, retryAfterSeconds: 30 as const } : { ok: false as const, code };
    assert.deepEqual(fromIdentityFailure(failure), scimFailure(code));
  }
  for (const error of [new Error("SQL private constraint credentials"), { message: "remote body", status: 409 }, "password", null]) {
    assert.deepEqual(unexpectedScimFailure(error), scimFailure("unexpected"));
    assert.doesNotMatch(JSON.stringify(unexpectedScimFailure(error)), /SQL|private|constraint|credentials|remote body|password/);
  }
});

test("wire helpers emit direct resources with SCIM media and a bodyless 204", () => {
  const user = toScimUser({ ...parsed(base()), documentId: "doc123" });
  assert.deepEqual(scimResponse(201, user), { status: 201, headers: { "Content-Type": SCIM_MEDIA_TYPE }, body: user });
  assert.deepEqual(scimResponse(204), { status: 204, headers: {} });
  assert.deepEqual(scimResponse(204, user), { status: 204, headers: {} });
});

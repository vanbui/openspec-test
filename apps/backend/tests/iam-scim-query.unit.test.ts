import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScimFilter } from "../src/iam/scim/filter";
import { parseScimQuery, projectScimUser, toScimListResponse } from "../src/iam/scim/query";
import { CORE_USER_URN, ENTERPRISE_USER_URN, LIST_RESPONSE_URN } from "../src/iam/scim/wire";
import type { SourceIdentity } from "../src/iam/identity/identity-service";

function value<T>(result: { ok: true; value: T } | { ok: false }): T {
  assert.ok(result.ok); return result.value;
}
function query(entries: Iterable<readonly [string, unknown]> = []) { return value(parseScimQuery(entries)); }
function invalid(result: ReturnType<typeof parseScimQuery> | ReturnType<typeof parseScimFilter>, type: string) {
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.error.status, 400); assert.equal(result.error.body.scimType, type); }
}
const person: SourceIdentity = { documentId: "person", username: "Person", email: "person@example.test", displayName: "Person",
  sourceExternalId: " 00Ab ", accountStatus: "active", firstName: "Given", lastName: "Family", employeeNumber: "Emp", department: "Dept", jobTitle: "Title" };

test("filter absence differs from empty or malformed supplied values", () => {
  assert.equal(value(parseScimFilter(undefined)), undefined);
  for (const input of ["", " ", null, 1, {}, [], true]) invalid(parseScimFilter(input), "invalidFilter");
});
test("eq/and parser decodes JSON escapes, normalizes paths/operators and preserves opaque values", () => {
  const opaque = ' 00Ab\\"\n\t☃ ';
  assert.deepEqual(value(parseScimFilter(` \tUsErNaMe EQ "PeRsOn" AnD externalID eq ${JSON.stringify(opaque)} `)), {
    and: [{ field: "username", eq: "PeRsOn", caseInsensitive: true }, { field: "sourceExternalId", eq: opaque }],
  });
  for (const attribute of ["employeeNumber", `${ENTERPRISE_USER_URN}:employeeNumber`]) {
    assert.deepEqual(value(parseScimFilter(`${attribute.toUpperCase()} eq "Emp"`)), { field: "employeeNumber", eq: "Emp", caseInsensitive: true });
  }
  assert.deepEqual(value(parseScimFilter('emails.VALUE eq "Mail"')), { field: "email", eq: "Mail", caseInsensitive: true });
  assert.deepEqual(value(parseScimFilter('userName eq "\\u0041"')), { field: "username", eq: "A", caseInsensitive: true });
});
test("filter grammar rejects unsupported operations, paths, literals, injection and trailing text", () => {
  for (const input of ['userName ne "a"', 'userName co "a"', 'userName eq "a" or externalId eq "x"',
    'not userName eq "a"', '(userName eq "a")', 'emails[value eq "a"].value eq "a"', 'roles eq "admin"',
    'sourceExternalId eq "a"', '__proto__ eq "a"', '$or eq "a"', 'userName eq 1', 'userName eq null',
    'userName eq true', "userName eq 'a'", 'userName eq "a" trailing', 'userName eq "a" and',
    'userName eq "a"and externalId eq "b"', 'userName eq"a"', 'userName eq "\\q"', 'userName eq "\n"',
    'userName eq "unterminated', 'sortBy eq "userName"', 'userName eq "a"; DROP TABLE users']) {
    invalid(parseScimFilter(input), "invalidFilter");
  }
});
test("filter limits are inclusive for text, terms and decoded string values", () => {
  assert.ok(parseScimFilter(`userName eq "${"a".repeat(255)}"`).ok);
  invalid(parseScimFilter(`userName eq "${"a".repeat(256)}"`), "invalidFilter");
  assert.ok(parseScimFilter(`userName eq "${"\\u0061".repeat(255)}"`).ok);
  const term = 'userName eq "x"';
  assert.ok(parseScimFilter(Array(20).fill(term).join(" and ")).ok);
  invalid(parseScimFilter(Array(21).fill(term).join(" and ")), "invalidFilter");
  assert.ok(parseScimFilter(term.padEnd(4096)).ok);
  invalid(parseScimFilter(term.padEnd(4097)), "invalidFilter");
});
test("raw entries reject repeated, unknown, structured and malformed parameters", () => {
  for (const key of ["filter", "startIndex", "count", "attributes", "excludedAttributes"]) {
    invalid(parseScimQuery([[key, "1"], [key, "2"]]), "invalidValue");
  }
  for (const entries of [[["sortBy", "userName"]], [["sortOrder", "ascending"]], [["filters[$or]", "x"]],
    [["count", []]], [["filter", {}]], [["COUNT", "1"]]] as Array<Array<[string, unknown]>>) invalid(parseScimQuery(entries), "invalidValue");
  for (const input of [null, {}, "count=1", [null], [["count"]], [["count", "1", "2"]]]) invalid(parseScimQuery(input as never), "invalidValue");
});
test("paging uses defaults, locked normalization, cap and safe integer lexical syntax", () => {
  assert.deepEqual(query().list, { start: 0, limit: 100 });
  assert.equal(query().startIndex, 1);
  assert.deepEqual(query([["startIndex", "-5"], ["count", "-2"]]).list, { start: 0, limit: 0 });
  assert.deepEqual(query([["startIndex", "0"], ["count", "501"]]).list, { start: 0, limit: 500 });
  assert.deepEqual(query([["startIndex", "2"], ["count", "1"]]).list, { start: 1, limit: 1 });
  assert.equal(query([["startIndex", String(Number.MAX_SAFE_INTEGER)]]).list.start, Number.MAX_SAFE_INTEGER - 1);
  for (const key of ["count", "startIndex"]) for (const input of ["", " ", "1.0", "1e2", "+1", "0x10", "1x", "NaN", "Infinity", "9007199254740992", "-9007199254740992"]) {
    invalid(parseScimQuery([[key, input]]), "invalidValue");
  }
  const result = query(new URLSearchParams('filter=userName+eq+%22Person%22&count=0'));
  assert.deepEqual(result.list.filter, { field: "username", eq: "Person", caseInsensitive: true });
});
test("projection validates case-insensitive public paths and rejects private fields and combinations", () => {
  for (const path of ["roles", "protected", "externalSubject", "password", "identitySource", "sourceIdentityKey", "sourceDeletedAt", "lastSyncedAt", "documentId", "meta.version", "emails.type", "__proto__", "name.unknown", `${ENTERPRISE_USER_URN}:manager`]) {
    for (const key of ["attributes", "excludedAttributes"]) invalid(parseScimQuery([[key, path]]), "invalidValue");
  }
  for (const input of ["", " ", ",", "userName,", "userName,,emails"]) invalid(parseScimQuery([["attributes", input]]), "invalidValue");
  invalid(parseScimQuery([["attributes", "id"], ["excludedAttributes", "id"]]), "invalidValue");
  assert.ok(query([["attributes", " UsErNaMe , NaMe.GiVeNnAmE "]]).projection);
});
test("inclusion projection retains mandatory fields and selects complex subattributes", () => {
  const parsed = query([["attributes", `USERNAME,name.givenName,emails.value,${ENTERPRISE_USER_URN.toUpperCase()}:EMPLOYEENUMBER,meta.location`]]);
  assert.deepEqual(projectScimUser(person, parsed.projection), { schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], id: "person",
    userName: "Person", name: { givenName: "Given" }, emails: [{ value: "person@example.test" }],
    [ENTERPRISE_USER_URN]: { employeeNumber: "Emp" }, meta: { location: "/scim/v2/Users/person" } });
});
test("parent projection and exclusions preserve siblings without leaking arbitrary fields", () => {
  const include = projectScimUser(person, query([["attributes", `name,${ENTERPRISE_USER_URN}`]]).projection);
  assert.deepEqual(include.name, { givenName: "Given", familyName: "Family" });
  assert.deepEqual(include[ENTERPRISE_USER_URN], { employeeNumber: "Emp", department: "Dept" });
  const output = projectScimUser({ ...person, password: "private", roles: ["admin"] } as SourceIdentity,
    query([["excludedAttributes", `id,schemas,name.familyName,emails.primary,${ENTERPRISE_USER_URN}:department,meta`]]).projection);
  assert.equal(output.id, "person"); assert.deepEqual(output.schemas, [CORE_USER_URN, ENTERPRISE_USER_URN]);
  assert.deepEqual(output.name, { givenName: "Given" }); assert.deepEqual(output.emails, [{ value: "person@example.test" }]);
  assert.equal(output.meta, undefined); assert.equal("password" in output, false); assert.equal("roles" in output, false);
  assert.deepEqual(output[ENTERPRISE_USER_URN], { employeeNumber: "Emp" });
  assert.deepEqual(projectScimUser(person, query([["attributes", "id,schemas"]]).projection), { id: "person", schemas: [CORE_USER_URN, ENTERPRISE_USER_URN] });
});
test("list response uses scoped total, actual page length and absent Resources for count zero", () => {
  assert.deepEqual(toScimListResponse({ total: 4, items: [] }, query([["count", "0"]])), {
    schemas: [LIST_RESPONSE_URN], totalResults: 4, startIndex: 1, itemsPerPage: 0,
  });
  assert.deepEqual(toScimListResponse({ total: 4, items: [] }, query([["startIndex", "100"]])), {
    schemas: [LIST_RESPONSE_URN], totalResults: 4, startIndex: 100, itemsPerPage: 0, Resources: [],
  });
  const response = toScimListResponse({ total: 4, items: [person] }, query([["count", "2"], ["attributes", "userName"]]));
  assert.equal(response.itemsPerPage, 1); assert.equal(response.totalResults, 4);
  assert.deepEqual(response.Resources, [{ id: "person", schemas: [CORE_USER_URN, ENTERPRISE_USER_URN], userName: "Person" }]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { reduceScimPatch, scimPatchRequest } from "../src/iam/scim/patch";
import { ENTERPRISE_USER_URN, PATCH_OP_URN } from "../src/iam/scim/wire";
import type { SourceIdentity } from "../src/iam/identity/identity-service";

const current: SourceIdentity = { documentId: "user1", username: "Original", email: "Original@example.test",
  displayName: "Original Name", accountStatus: "active", sourceExternalId: " 001Ab ", firstName: "First", lastName: "Last" };
const batch = (...Operations: unknown[]) => ({ schemas: [PATCH_OP_URN], Operations });
function value(input: unknown) {
  const result = reduceScimPatch(current, input);
  assert.ok(result.ok, JSON.stringify(result)); return result.value;
}
function fails(input: unknown, code: string) {
  assert.deepEqual(reduceScimPatch(current, input), { ok: false, code });
}

test("ordered operations normalize attribute and operation casing, preserving exact values", () => {
  const body = batch(
    { op: "aDd", path: "UsErNaMe", value: "MixedCase" },
    { op: "REPLACE", path: "externalID", value: " 001Ab " },
    { op: "replace", path: "NAME.GIVENNAME", value: "  Given  " },
    { op: "REMOVE", path: "name.familyNAME" },
    { op: "add", path: "Title", value: "Title" },
    { op: "replace", path: "TITLE", value: "Final Title" },
    { op: "add", path: `${ENTERPRISE_USER_URN.toUpperCase()}:Department`, value: "  Dept  " },
    { op: "replace", path: `${ENTERPRISE_USER_URN}.EMPLOYEENUMBER`, value: "007" },
    { op: "replace", path: "ACTIVE", value: false });
  assert.deepEqual(value(body), { username: "MixedCase", sourceExternalId: " 001Ab ", firstName: "  Given  ",
    lastName: null, jobTitle: "Final Title", department: "  Dept  ", employeeNumber: "007", accountStatus: "inactive" });
  assert.deepEqual(scimPatchRequest(body).reduce(current), reduceScimPatch(current, body));
  assert.equal(current.firstName, "First");
});

test("pathless objects, complex values, and optional removes reduce without touching unrelated fields", () => {
  assert.deepEqual(value(batch({ op: "ADD", value: { NAME: { GIVENNAME: "New", FAMILYNAME: "Family" },
    DISPLAYNAME: "Display", [ENTERPRISE_USER_URN.toUpperCase()]: { EMPLOYEENUMBER: "009", DEPARTMENT: "HR" } } },
  { op: "replace", path: "name", value: { givenName: "Final" } },
  { op: "remove", path: "title" }, { op: "remove", path: ENTERPRISE_USER_URN })),
  { firstName: "Final", lastName: "Family", displayName: "Display", employeeNumber: null, department: null, jobTitle: null });
  assert.deepEqual(value(batch({ op: "remove", path: "NAME" })), { firstName: null, lastName: null });
});

test("email selectors use JSON strings and current ordered state, with case-insensitive comparisons", () => {
  assert.deepEqual(value(batch({ op: "replace", path: "EMAILS[PRIMARY EQ true].VALUE", value: "Next@example.test" },
    { op: "replace", path: 'emails[value eq "next@EXAMPLE.test"].value', value: "Final@example.test" })), { email: "Final@example.test" });
  const escaped = { ...current, email: 'a"b@example.test' };
  const result = reduceScimPatch(escaped, batch({ op: "replace", path: `emails[value eq ${JSON.stringify(escaped.email)}]`,
    value: { value: "Escaped@example.test", primary: true } }));
  assert.deepEqual(result, { ok: true, value: { email: "Escaped@example.test" } });
  fails(batch({ op: "replace", path: 'emails[value eq "absent@example.test"].value', value: "new@example.test" }), "noTarget");
  fails(batch({ op: "add", path: 'emails[value eq "absent@example.test"]', value: { value: "new@example.test" } }), "noTarget");
});

test("email arrays require one unambiguous primary and never silently lose a selected target", () => {
  assert.deepEqual(value(batch({ op: "replace", path: "emails", value: [
    { value: "Secondary@example.test", type: "work" }, { value: "Primary@example.test", PRIMARY: true },
  ] })), { email: "Primary@example.test" });
  assert.deepEqual(value(batch({ op: "replace", path: "emails", value: [{ value: "Only@example.test" }] })), { email: "Only@example.test" });
  fails(batch({ op: "replace", path: "emails", value: [{ value: "a@example.test" }, { value: "b@example.test" }] }), "invalidInput");
  // P3-35: an added primary becomes the stored address; added secondaries are validated but not stored.
  assert.deepEqual(value(batch({ op: "add", path: "emails", value: [{ value: "a@example.test", primary: true }] })), { email: "a@example.test" });
  assert.deepEqual(value(batch({ op: "add", path: "emails", value: [{ value: "second@example.test" }] })), {});
  fails(batch({ op: "add", path: "emails", value: [{ value: "a@example.test", primary: true }, { value: "b@example.test", primary: true }] }), "invalidInput");
  fails(batch({ op: "add", path: "emails", value: [{ value: "bad", primary: true }] }), "invalidInput");
  fails(batch({ op: "replace", path: "emails", value: [] }), "invalidInput");
  fails(batch({ op: "replace", path: "emails", value: [{ value: "bad" }] }), "invalidInput");
  assert.deepEqual(value(batch({ op: "replace", path: "emails", value: [{ value: "a@example.test", primary: "TRUE" }] })), { email: "a@example.test" });
  fails(batch({ op: "replace", path: "emails", value: [{ value: "a@example.test", primary: "yes" }] }), "invalidInput");
  fails(batch({ op: "replace", path: "emails", value: [{ value: "a@example.test", primary: 1 }] }), "invalidInput");
  // Secondary values are not persisted: selecting one later cannot be represented.
  fails(batch({ op: "replace", path: "emails", value: [{ value: "a@example.test", primary: true }, { value: "b@example.test" }] },
    { op: "replace", path: 'emails[value eq "b@example.test"].value', value: "c@example.test" }), "noTarget");
});

test("the pinned connector's email PATCH shapes reduce to the single stored address (P3-35)", () => {
  // Observed live: a re-add of the current address with primary as the string "true" is a no-op change.
  assert.deepEqual(value(batch({ op: "add", path: "emails", value: [{ type: "work", value: "original@EXAMPLE.test", primary: "true" }] })),
    { email: "original@EXAMPLE.test" });
  // The connector's email change: remove the old value by filter, then add the new primary.
  assert.deepEqual(value(batch({ op: "remove", path: 'emails[value eq "Original@example.test"]' },
    { op: "add", path: "emails", value: [{ type: "work", value: "moved@example.test", primary: "true" }] })), { email: "moved@example.test" });
  // Removing the current address without a replacement would leave no email.
  fails(batch({ op: "remove", path: 'emails[value eq "Original@example.test"]' }), "forbiddenWrite");
  fails(batch({ op: "remove", path: 'emails[value eq "Original@example.test"]' },
    { op: "add", path: "emails", value: [{ value: "secondary@example.test" }] }), "forbiddenWrite");
  // Removing an address that is not stored changes nothing.
  assert.deepEqual(value(batch({ op: "remove", path: 'emails[value eq "never-stored@example.test"]' })), {});
});

test("immutable keys and required removals fail even if a later operation would restore them", () => {
  for (const path of ["userName", "emails", "emails[primary eq true].value", "externalId", "displayName", "active"]) {
    fails(batch({ op: "remove", path }), "forbiddenWrite");
  }
  fails(batch({ op: "replace", path: "externalId", value: " 001ab " },
    { op: "replace", path: "externalId", value: current.sourceExternalId }), "immutableSourceKey");
  for (const path of ["roles", "Protected", "externalSubject", "password", "identitySource", "sourceIdentityKey", "sourceDeletedAt", "lastSyncedAt", "id", "meta.location"]) {
    fails(batch({ op: "replace", path, value: "private" }), "forbiddenWrite");
    fails(batch({ op: "add", value: { [path]: "private" } }), "forbiddenWrite");
  }
});

test("malformed paths remain distinct from malformed values and unknown operation shapes", () => {
  for (const path of ["unknown", "name.middleName", "emails.value", "emails[primary eq false].value", 'emails[value eq unquoted]',
    'emails[value co "x"]', 'emails[value eq "x"]junk', "emails[primary eq true].type", "name..givenName", "", " title "]) {
    fails(batch({ op: "replace", path, value: "x" }), "path");
  }
  for (const input of [null, [], {}, { schemas: [], Operations: [{}] }, batch(), batch(...Array(101).fill({ op: "remove", path: "title" })),
    batch({ op: "move", path: "title", value: "x" }), batch({ op: "remove" }), batch({ op: "add", value: [] }),
    batch({ op: "add", value: {} }), batch({ op: "replace", path: "title" }), batch({ op: "add", path: "active", value: "false" }),
    batch({ op: "add", path: "title", value: 7 }), batch({ op: "add", path: "title", value: "x".repeat(256) }),
    batch({ op: "add", value: { title: "a", TITLE: "b" } }), batch({ op: "add", path: "title", value: "x", extra: true })]) {
    fails(input, "invalidInput");
  }
  assert.deepEqual(value(batch(...Array(100).fill({ op: "add", path: "title", value: "x" }))), { jobTitle: "x" });
});

test("a later failing operation returns no partial delta and never modifies its inputs", () => {
  const initial = structuredClone(current);
  const input = batch({ op: "replace", path: "active", value: false }, { op: "remove", path: "unknown" });
  const original = structuredClone(input);
  fails(input, "path");
  assert.deepEqual(current, initial); assert.deepEqual(input, original);
});

test("invalid JSON escape casing in email selectors returns a closed failure without throwing", () => {
  for (const escape of ["\\U0061", "\\N", "\\T", "\\B", "\\F", "\\R"]) {
    fails(batch({ op: "replace", path: "title", value: "Uncommitted" },
      { op: "replace", path: `emails[value eq "${escape}@example.test"].value`, value: "new@example.test" }), "invalidInput");
  }
});

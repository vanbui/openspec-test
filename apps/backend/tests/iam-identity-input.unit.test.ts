import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveSourceIdentityKey, identityFailure, parseSourceIdentityInput, resolveIdentityUniqueness, SOURCE_IDENTITY_FIELDS } from "../src/iam/identity/identity-input";

const input = { username: "worker", email: "worker@identity.test", displayName: "Worker", accountStatus: "active", sourceExternalId: " 00Ab " };

test("opaque external ids preserve spaces, case and leading zeros without coercion", () => {
  for (const key of [" 00Ab ", "001", "00ab", "0001", "x".repeat(255), "É源"]) {
    const result = parseSourceIdentityInput({ ...input, sourceExternalId: key });
    assert.ok(result.ok);
    assert.equal(result.value.sourceExternalId, key);
  }
  for (const key of ["", " ", "\t\n", 1, null, undefined, {}, "x".repeat(256)]) {
    assert.deepEqual(parseSourceIdentityInput({ ...input, sourceExternalId: key }), { ok: false, code: "invalidInput" });
  }
});

test("tuple hashes match literal lowercase UTF-8 JSON SHA-256 fixtures", () => {
  const cases = [
    ["source-001", " 00Ab ", "05097e7da0272d036175b87bff46f2fdb917efb11a3ca49e9e117bd3c27e6948"],
    ["source-001", "001", "0c07ce5d7639bcf3b3d2d82881380bc00f68262fb5862ee2a27389e811fe1d25"],
    ["source-002", "001", "cc2689673c7a0b69329223d7fadd535285b6f0f4643ca12fe5106b69a425c327"],
    ["source-001", "00ab", "3a6aaadc608fed1a35da198d12f1350ad175c734897dc44e6461ba10f1df21a2"],
  ];
  for (const [source, key, expected] of cases) assert.equal(deriveSourceIdentityKey(source, key), expected);
  for (const key of ["", " ", "x".repeat(256)]) assert.throws(() => deriveSourceIdentityKey("source-001", key), /IAM_IDENTITY_INVALID_INPUT/);
  assert.throws(() => deriveSourceIdentityKey("", "001"), /IAM_IDENTITY_INVALID_INPUT/);
});

test("only the ten approved source identity fields are accepted", () => {
  assert.equal(SOURCE_IDENTITY_FIELDS.length, 10);
  for (const field of ["password", "roles", "externalSubject", "identitySource", "sourceIdentityKey", "sourceDeletedAt",
    "lastSyncedAt", "protected", "tokenHash", "documentId", "id", "title", "userName", "skipProvisioning"]) {
    for (const mode of ["create", "replace", "patch"] as const) {
      const result = mode === "patch" ? parseSourceIdentityInput({ [field]: "forged" }, mode)
        : parseSourceIdentityInput({ ...input, [field]: "forged" }, mode);
      assert.deepEqual(result, { ok: false, code: "invalidInput" });
    }
  }
});

test("create/replace require all mandatory fields; patch changes only supplied fields", () => {
  for (const field of ["username", "email", "displayName", "accountStatus", "sourceExternalId"]) {
    const missing: Record<string, unknown> = { ...input }; delete missing[field];
    for (const mode of ["create", "replace"] as const) assert.deepEqual(parseSourceIdentityInput(missing, mode), { ok: false, code: "invalidInput" });
    for (const value of [undefined, null, "", " ", 1]) {
      assert.deepEqual(parseSourceIdentityInput({ ...input, [field]: value }), { ok: false, code: "invalidInput" });
    }
  }
  assert.deepEqual(parseSourceIdentityInput({ department: null }, "patch"), { ok: true, value: { department: null } });
  assert.deepEqual(parseSourceIdentityInput({ department: "HR" }, "patch"), { ok: true, value: { department: "HR" } });
  assert.deepEqual(parseSourceIdentityInput({}, "patch"), { ok: true, value: {} });
  assert.deepEqual(parseSourceIdentityInput(input), { ok: true, value: input });
});

test("replacement clears omitted optional HR fields; null and omission are explicit", () => {
  const replaced = parseSourceIdentityInput(input, "replace");
  assert.ok(replaced.ok);
  assert.deepEqual(replaced.value, { ...input, firstName: null, lastName: null, employeeNumber: null, department: null, jobTitle: null });
  for (const field of ["firstName", "lastName", "employeeNumber", "department", "jobTitle"]) {
    for (const value of [null, "", "x".repeat(255)]) assert.equal(parseSourceIdentityInput({ ...input, [field]: value }).ok, true);
    for (const value of [undefined, 123, {}, "x".repeat(256)]) assert.equal(parseSourceIdentityInput({ ...input, [field]: value }).ok, false);
  }
  for (const value of [null, undefined, [], "input"]) assert.equal(parseSourceIdentityInput(value).ok, false);
  assert.equal(parseSourceIdentityInput({ ...input, email: "invalid" }).ok, false);
  assert.equal(parseSourceIdentityInput({ ...input, accountStatus: "ACTIVE" }).ok, false);
});

test("closed safe conflict outcomes carry no private details and transient retry is 30 seconds", () => {
  for (const code of ["forbidden", "notFound", "uniqueness", "immutableSourceKey", "invalidInput"] as const) {
    assert.deepEqual(identityFailure(code), { ok: false, code });
  }
  assert.deepEqual(identityFailure("keycloakUnavailable"), { ok: false, code: "keycloakUnavailable", retryAfterSeconds: 30 });
});

test("uniqueness resolution refuses active transactions and compares the tuple after rollback", async () => {
  let active = true;
  let reads = 0;
  let matches: unknown[] = [];
  const reader = { db: { inTransaction: () => active }, documents: () => ({ findMany: async () => { reads++; return matches; } }) };
  await assert.rejects(resolveIdentityUniqueness(reader, "source-001", "001"), /IAM_IDENTITY_TRANSACTION_ACTIVE/);
  assert.equal(reads, 0);
  active = false;
  assert.deepEqual(await resolveIdentityUniqueness(reader, "source-001", "001"), { ok: false, code: "uniqueness" });
  matches = [{ sourceExternalId: "001", identitySource: { documentId: "source-001" } }];
  assert.deepEqual(await resolveIdentityUniqueness(reader, "source-001", "001"), { ok: false, code: "uniqueness" });
  for (const row of [{ sourceExternalId: "001", identitySource: { documentId: "other-source" } },
    { sourceExternalId: "different", identitySource: { documentId: "source-001" } }]) {
    matches = [row];
    assert.deepEqual(await resolveIdentityUniqueness(reader, "source-001", "001"), { ok: false, code: "immutableSourceKey" });
  }
});

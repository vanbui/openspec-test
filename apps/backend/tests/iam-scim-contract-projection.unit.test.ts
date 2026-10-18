import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { projectScimUser } from "../src/iam/scim/query";

type Schema = { required?: string[]; properties?: Record<string, Schema>; items?: Schema };
const specification = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/references/specification.json"), "utf8"));
function requiredFields(schema: Schema, value: unknown): void {
  if (Array.isArray(value)) { for (const item of value) requiredFields(schema.items ?? {}, item); return; }
  if (!value || typeof value !== "object") return;
  for (const key of schema.required ?? []) assert.ok(Object.prototype.hasOwnProperty.call(value, key), `contract requires omitted ${key}`);
  for (const [key, child] of Object.entries(value)) requiredFields(schema.properties?.[key] ?? {}, child);
}

test("SCIM projected response contract accepts independently selected email and metadata fields", () => {
  const person = { documentId: "person", username: "Person", email: "person@example.test", displayName: "Person", accountStatus: "active" as const };
  const projected = specification.components.schemas.ScimProjectedUser as Schema;
  for (const paths of [["emails.value"], ["emails.primary"], ["meta.location"], ["meta.resourceType"]]) {
    for (const mode of ["include", "exclude"] as const) {
      requiredFields(projected, projectScimUser(person, { mode, paths }));
    }
  }
  const full = specification.components.schemas.ScimUser as Schema;
  assert.deepEqual(full.properties?.emails.items?.required, ["value", "primary"]);
  assert.deepEqual(full.properties?.meta.required, ["resourceType", "location"]);
});

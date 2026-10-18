import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appDir = path.resolve(__dirname, "../../..");
const userUid = "api::idambox-user.idambox-user";
const string255 = { type: "string", maxLength: 255 };
// Independent transcription of the operator-approved contract, 2026-10-14.
const expectedSource = {
  name: { ...string255, required: true, unique: true },
  sourceStatus: { type: "enumeration", enum: ["active", "inactive"], required: true, default: "active" },
  serviceUser: { type: "relation", relation: "oneToOne", target: userUid, required: true },
  tokenHash: { ...string255, private: true },
  tokenRotatedAt: { type: "datetime", private: true },
  lastActivityAt: { type: "datetime" },
};
const legacyUser = {
  email: { type: "email", required: true, unique: true },
  username: { type: "string", required: true, unique: true },
  firstName: { type: "string" }, lastName: { type: "string" },
  displayName: { type: "string", required: true },
  accountStatus: { type: "enumeration", enum: ["active", "inactive"], default: "active", required: true },
  externalSubject: { type: "string", unique: true },
  password: { type: "password", minLength: 6, private: true },
  roles: { type: "relation", relation: "manyToMany", target: "api::role.role", inversedBy: "idamboxUsers" },
};
const expectedUser = {
  ...legacyUser,
  identitySource: { type: "relation", relation: "manyToOne", target: "api::identity-source.identity-source" },
  sourceExternalId: string255,
  sourceIdentityKey: { type: "string", private: true, unique: true, minLength: 64, maxLength: 64 },
  employeeNumber: string255, department: string255, jobTitle: string255,
  sourceDeletedAt: { type: "datetime" }, lastSyncedAt: { type: "datetime" },
  protected: { type: "boolean", required: true, default: false },
};
const expectedOutbox = {
  userDocumentId: { type: "string", required: true, unique: true, maxLength: 24 },
  idamboxUser: { type: "relation", relation: "oneToOne", target: userUid, required: true },
  externalSubject: string255,
  operation: { type: "enumeration", enum: ["disableAndEndSessions"], required: true },
  syncStatus: { type: "enumeration", enum: ["pending", "processing", "completed", "cancelled"], required: true, default: "pending" },
  generation: { type: "integer", required: true, default: 1, min: 1 },
  attempts: { type: "integer", required: true, default: 0, min: 0 },
  lastErrorCode: { type: "string", maxLength: 120 },
  nextAttemptAt: { type: "datetime", required: true },
  leaseOwner: { type: "string", private: true, maxLength: 36 },
  leaseExpiresAt: { type: "datetime", private: true },
  completedAt: { type: "datetime" },
};

for (const [name, collection, displayName, attributes] of [
  ["identity-source", "identity_sources", "Identity Source", expectedSource],
  ["idambox-user", "idambox_users", "IdamBox User", expectedUser],
  ["keycloak-sync-outbox", "keycloak_sync_outboxes", "Keycloak Sync Outbox", expectedOutbox],
] as const) {
  test(`${name} matches every approved attribute and collection option`, () => {
    const schema = JSON.parse(readFileSync(path.join(appDir, "src/api", name, "content-types", name, "schema.json"), "utf8"));
    assert.equal(schema.kind, "collectionType");
    assert.equal(schema.collectionName, collection);
    assert.equal(schema.info.singularName, name);
    assert.equal(schema.info.pluralName, name === "keycloak-sync-outbox" ? "keycloak-sync-outboxes" : `${name}s`);
    assert.equal(schema.info.displayName, displayName);
    assert.deepEqual(schema.options, { draftAndPublish: false });
    assert.deepEqual(schema.pluginOptions, {});
    assert.deepEqual(schema.attributes, attributes);
  });
}

test("internal collections introduce no content API router", () => {
  for (const name of ["identity-source", "keycloak-sync-outbox"]) {
    const routes = path.join(appDir, "src/api", name, "routes");
    assert.ok(!existsSync(routes) || readdirSync(routes).length === 0);
  }
});

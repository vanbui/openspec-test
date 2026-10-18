import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(__dirname, "../../../../..");
const fixturePath = path.join(root, "apps/backend/tests/fixtures/iam-scim/connector-lifecycle.json");
// Byte-for-byte copies of the published capture.json and manifest.json; PROVENANCE.md pins both digests
const manifestPath = path.join(root, "apps/backend/tests/fixtures/iam-scim/connector-lifecycle.manifest.json");
const evidence = { "capture.json": fixturePath, "manifest.json": manifestPath };

test("replay fixture and manifest copies of the published capture are present", () => {
  assert.ok(existsSync(fixturePath), "genuine connector lifecycle fixture must exist");
  assert.ok(existsSync(manifestPath), "published capture manifest copy must exist");
});

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { observeScimRequests, prepareScimReplay, startScimHttpHarness } from "./helpers/iam-scim-http-harness";
import { deriveSourceIdentityKey } from "../src/iam/identity/identity-input";

interface PublicUser {
  id: string; userName: string; displayName: string; active: boolean;
  emails: Array<{ value: string; primary: boolean }>;
  name: { givenName: string; familyName: string };
  externalId?: string; title?: string;
}
interface Envelope {
  sequence: number; scenario: string; origin: string; invocation: string;
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  response: { status: number; headers: Record<string, string>; body: unknown };
}
const capture = JSON.parse(readFileSync(fixturePath, "utf8")) as Envelope[];
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  substitutions: Record<string, { kind: string }>; scenarios: string[];
};
const USER = "api::idambox-user.idambox-user";
const safeHeaders = ["accept", "content-type", "retry-after"];
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
};

function substitute<T>(value: T, ids: Map<string, string>): T {
  const visit = (item: unknown, key = ""): unknown => {
    if (typeof item === "string") return item.replace(/\{\{([A-Z_0-9]+)\}\}/g, (_, marker: string) => {
      assert.equal(manifest.substitutions[marker]?.kind, "user-id");
      assert.ok(key === "id" || (["path", "location"].includes(key) && item.includes("/Users/")), "id substitution position");
      const id = ids.get(marker); assert.ok(id, `unresolved ${marker}`); return id;
    });
    if (Array.isArray(item)) return item.map(element => visit(element));
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([name, child]) => [name, visit(child, name)]));
    return item;
  };
  return visit(value) as T;
}

function bind(ids: Map<string, string>, marker: string, actual: unknown) {
  assert.equal(manifest.substitutions[marker]?.kind, "user-id");
  assert.equal(typeof actual, "string");
  assert.match(actual as string, /^[A-Za-z0-9_-]{6,64}$/);
  if (ids.has(marker)) assert.equal(actual, ids.get(marker));
  else {
    assert.ok(![...ids.values()].includes(actual as string), "ids must be one-to-one");
    ids.set(marker, actual as string);
  }
}

function verifyProvenance() {
  const provenance = readFileSync(path.join(path.dirname(fixturePath), "PROVENANCE.md"), "utf8");
  for (const [filename, file] of Object.entries(evidence)) {
    const bytes = readFileSync(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.ok(provenance.includes(`${filename} SHA-256: \`${digest}\``), `${filename} digest`);
  }
  execFileSync(process.execPath, [path.join(root, "docker/midpoint/e2e/capture-scim.mjs"), "--verify-evidence", fixturePath, manifestPath], { cwd: root, stdio: "pipe" });
  assert.equal(capture.length, 47);
  assert.deepEqual([...new Set(capture.map(entry => entry.scenario))], manifest.scenarios);
  assert.deepEqual(capture.map(entry => entry.sequence), Array.from({ length: 47 }, (_, index) => index + 1));
  const markers = [...new Set(readFileSync(fixturePath, "utf8").match(/\{\{USER_ID_\d+\}\}/g))].sort();
  assert.deepEqual(markers, Object.keys(manifest.substitutions).map(marker => `{{${marker}}}`).sort());
  for (const entry of capture) {
    assert.ok(provenance.includes(`| ${entry.scenario} | ${entry.origin} | \`${entry.invocation}\``));
    assert.equal(entry.origin, ["schemas", "config", "groups"].includes(entry.scenario) ? "direct-probe" : "connector");
  }
  assert.equal(capture.find(entry => entry.scenario === "page" && entry.request.path.includes("/Users"))?.request.path, "/scim/v2/Users");
}

test("published digests, declared substitutions and genuine operation coverage are complete", verifyProvenance);

test("all 47 captured envelopes replay in order through mounted HTTP with persistence and source isolation", async () => {
  verifyProvenance();
  const h = await startScimHttpHarness();
  try {
    const baseline = object(capture.find(entry => entry.scenario === "list" && entry.request.path === "/scim/v2/Users")!.response.body)
      .Resources as PublicUser[];
    const candidates = baseline.filter(user => user.id !== "{{USER_ID_1}}");
    assert.equal(candidates.length, 4);
    const other = await prepareScimReplay(h, candidates);
    const otherRows = await h.backend(backend => backend.documents(USER).findMany({
      filters: { identitySource: { documentId: other.documentId } }, populate: { roles: true, identitySource: true }, limit: 100,
    }));
    assert.ok(otherRows.length > 0);
    const ids = new Map<string, string>();
    let referenceIds: string[] = [];
    let roleIds: string[] = [];
    let sourceKey: unknown;
    const read = (id: string) => h.backend(backend => backend.documents(USER).findOne({
      documentId: id, populate: { roles: true, identitySource: true },
    }));
    const references = [
      ["api::csrm-assessment-request.csrm-assessment-request", "requestor", { requestNumber: "REQ-REPLAY", title: "Retained replay", requestStatus: "draft" }],
      ["api::csrm-risk.csrm-risk", "riskOwner", { riskNumber: "RISK-REPLAY", riskStatement: "Retained replay" }],
      ["api::csrm-information-system.csrm-information-system", "owner", { name: "Retained replay" }],
    ] as const;
    const observed = await observeScimRequests(h, async () => {
      for (const entry of capture) {
        const request = substitute(entry.request, ids);
        const response = await h.wire(request);
        const label = `${entry.sequence} ${entry.scenario} ${request.method} ${request.path}`;
        assert.equal(response.status, entry.response.status, label);
        const body: unknown = response.status === 204 ? null : await response.json();
        if (response.status === 204) assert.equal(await response.text(), "", label);
        if (entry.request.method === "POST" && entry.response.status === 201) {
          const created = object(body);
          bind(ids, "USER_ID_1", created.id);
          assert.equal(response.headers.get("location"), `/scim/v2/Users/${ids.get("USER_ID_1")}`);
        }
        if (entry.scenario === "list" && request.path === "/scim/v2/Users") {
          const actual = object(body).Resources as PublicUser[];
          assert.equal(actual.length, baseline.length);
          for (const expected of candidates) {
            const matching = actual.filter(user => user.userName === expected.userName);
            assert.equal(matching.length, 1);
            bind(ids, expected.id.slice(2, -2), matching[0].id);
          }
        }
        assert.deepEqual(Object.fromEntries(safeHeaders.flatMap(key => response.headers.has(key)
          ? [[key, response.headers.get(key)]] : [])), entry.response.headers, `${label} safe headers`);
        assert.deepEqual(body, substitute(entry.response.body, ids), `${label} exact JSON`);
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
          const id = ids.get("USER_ID_1"); assert.ok(id);
          const row = await read(id); assert.ok(row);
          assert.equal(row.identitySource?.documentId, h.primary.documentId);
          assert.equal(row.sourceExternalId, "iam-scim-gate-8a7dd3b414bc");
          assert.equal(row.sourceIdentityKey, deriveSourceIdentityKey(h.primary.documentId, row.sourceExternalId!));
          assert.equal(row.employeeNumber, row.sourceExternalId);
          assert.equal(row.firstName, "Gate"); assert.equal(row.lastName, "Person");
          assert.equal(row.displayName, "Gate Person"); assert.equal(row.username, row.sourceExternalId);
          assert.ok(row.lastSyncedAt);
          if (request.method === "POST") {
            assert.deepEqual(row.roles, []);
            sourceKey = row.sourceIdentityKey;
            // Administrator fixtures are outside captured traffic; source writes must preserve these roles and references.
            roleIds = await h.backend(async backend => {
              const role = await backend.documents("api::role.role").findFirst({ filters: { name: "Security Analyst" } });
              assert.ok(role);
              await backend.documents(USER).update({ documentId: id, data: { roles: [role.documentId] } });
              return [role.documentId];
            });
            for (const [uid, relation, data] of references) {
              referenceIds.push(await h.http.createFixtureDocument(uid, { ...data, [relation]: id }));
            }
          } else {
            assert.deepEqual(row.roles?.map(role => role.documentId), roleIds);
            assert.equal(row.sourceIdentityKey, sourceKey);
          }
          if (request.method === "DELETE") {
            assert.equal(row.accountStatus, "inactive"); assert.ok(row.sourceDeletedAt);
          } else {
            const user = body as PublicUser;
            assert.equal(row.accountStatus, user.active ? "active" : "inactive");
            assert.equal(row.email, user.emails[0].value);
            assert.equal(row.jobTitle, user.title);
            assert.equal(row.sourceDeletedAt, null);
          }
        }
      }
    });
    assert.deepEqual(observed.requests, capture.map(entry => substitute(entry.request, ids)), "exact received method/path/query/headers/body/order/count");
    assert.deepEqual([...ids.keys()].sort(), Object.keys(manifest.substitutions).sort());
    assert.deepEqual(await h.backend(backend => backend.documents(USER).findMany({
      filters: { identitySource: { documentId: other.documentId } }, populate: { roles: true, identitySource: true }, limit: 100,
    })), otherRows, "captured lifecycle must not mutate another source's records");
    const id = ids.get("USER_ID_1")!;
    for (let index = 0; index < references.length; index++) {
      const [uid, relation] = references[index];
      const row = await h.backend(backend => backend.documents(uid).findOne({ documentId: referenceIds[index], populate: { [relation]: true } }));
      assert.equal(object(object(row)[relation]).documentId, id);
    }

    // Authored negative conformance probes, deliberately outside the captured request sequence.
    const foreign = otherRows[0];
    for (const [target, token] of [[foreign.documentId, h.primary.token], [id, other.token], [id, h.primary.token],
      [h.primary.serviceUserId, h.primary.token]] as const) {
      const response = await h.request(`/scim/v2/Users/${target}`, "GET", undefined, { token });
      assert.equal(response.status, 404);
      const error = object(await response.json());
      assert.deepEqual(error.schemas, ["urn:ietf:params:scim:api:messages:2.0:Error"]);
      assert.equal(error.status, "404");
    }
    for (const [key, token] of [[foreign.sourceExternalId!, h.primary.token], ["iam-scim-gate-8a7dd3b414bc", other.token],
      ["iam-scim-gate-8a7dd3b414bc", h.primary.token]] as const) {
      const response = await h.request(`/scim/v2/Users?filter=${encodeURIComponent(`externalId eq ${JSON.stringify(key)}`)}`, "GET", undefined, { token });
      assert.equal(response.status, 200);
      const list = object(await response.json());
      assert.equal(list.totalResults, 0); assert.deepEqual(list.Resources, []);
    }
    const foreignBefore = await read(foreign.documentId);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const body = method === "PUT" ? { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], active: false }
        : method === "PATCH" ? { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
          Operations: [{ op: "replace", path: "active", value: false }] } : undefined;
      const response = await h.request(`/scim/v2/Users/${foreign.documentId}`, method, body);
      assert.equal(response.status, 404);
      assert.equal(object(await response.json()).status, "404");
    }
    assert.deepEqual(await read(foreign.documentId), foreignBefore, "foreign writes must leave persistence unchanged");
    const anonymous = await h.request("/scim/v2/ResourceTypes", "GET", undefined, { token: null });
    assert.equal(anonymous.status, 401);
    assert.equal(object(await anonymous.json()).status, "401");
    const tombstone = await read(id);
    const again = await h.request(`/scim/v2/Users/${id}`, "DELETE");
    assert.equal(again.status, 204);
    assert.equal((await read(id))?.sourceDeletedAt, tombstone?.sourceDeletedAt);
  } finally { await h.close(); }
});

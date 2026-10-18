import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { observeScimRequests, prepareScimReplay, startScimHttpHarness } from "./helpers/iam-scim-http-harness";
import { deriveSourceIdentityKey } from "../src/iam/identity/identity-input";

const root = path.resolve(__dirname, "../../../../..");
const fixture = path.join(root, "apps/backend/tests/fixtures/iam-scim/connector-lifecycle-phase4.json");
// Byte-for-byte copy of the published manifest.json; PROVENANCE-phase4.md pins both digests
const manifestPath = path.join(root, "apps/backend/tests/fixtures/iam-scim/connector-lifecycle-phase4.manifest.json");
const USER = "api::idambox-user.idambox-user";
interface PublicUser {
  id: string; userName: string; displayName: string; active: boolean; externalId?: string;
  emails: Array<{ value: string }>; name: { givenName: string; familyName: string };
}
interface Envelope {
  sequence: number; scenario: string; origin: string; invocation: string;
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  response: { status: number; headers: Record<string, string>; body: unknown };
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function load() {
  assert.ok(existsSync(fixture), "Phase 4 live fixture missing: orchestrator must run capture-lifecycle.mjs --run, verify evidence and copy capture.json to connector-lifecycle-phase4.json");
  assert.ok(existsSync(manifestPath), "Phase 4 manifest missing: copy manifest.json to connector-lifecycle-phase4.manifest.json");
  const provenance = readFileSync(path.join(path.dirname(fixture), "PROVENANCE-phase4.md"), "utf8");
  assert.doesNotMatch(provenance, /TODO/i, "Complete every Phase 4 provenance field after live capture");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    date: string; runId: string; scenarios: string[]; substitutions: Record<string, { kind: string }>;
  };
  assert.ok(provenance.includes(`Capture date: ${manifest.date}`));
  assert.ok(provenance.includes(`Capture run: \`${manifest.runId}\``));
  for (const [filename, file] of Object.entries({ "capture.json": fixture, "manifest.json": manifestPath })) {
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    assert.ok(provenance.includes(`${filename} SHA-256: \`${digest}\``), `${filename} digest`);
  }
  execFileSync(process.execPath, [path.join(root, "docker/midpoint/e2e/capture-lifecycle.mjs"), "--verify-evidence", fixture, manifestPath], { cwd: root, stdio: "pipe" });
  for (const declaration of Object.values(manifest.substitutions)) assert.equal(declaration.kind, "user-id");
  return { capture: JSON.parse(readFileSync(fixture, "utf8")) as Envelope[], manifest };
}

test("Phase 4 published fixture and completed provenance are required", () => { load(); });

test("Phase 4 persistent lifecycle replays every envelope through mounted HTTP on fresh SQLite", async () => {
  const { capture, manifest } = load();
  const ids = new Map<string, string>();
  const marker = (value: unknown): string => {
    assert.equal(typeof value, "string");
    const match = /^\{\{([A-Z][A-Z0-9_]*)\}\}$/.exec(String(value));
    assert.ok(match, "expected declared id marker");
    assert.equal(manifest.substitutions[match[1]]?.kind, "user-id");
    return match[1];
  };
  function bind(expected: unknown, actual: unknown) {
    const key = marker(expected);
    assert.equal(typeof actual, "string");
    assert.match(String(actual), /^[A-Za-z0-9_-]{6,64}$/);
    if (ids.has(key)) assert.equal(ids.get(key), actual);
    else { assert.ok(![...ids.values()].includes(String(actual)), "one-to-one ids"); ids.set(key, String(actual)); }
  }
  function replace<T>(value: T): T {
    function visit(item: unknown, key = ""): unknown {
      if (typeof item === "string") return item.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (whole, name: string) => {
        marker(whole);
        assert.ok(key === "id" || (["path", "location"].includes(key) && item.includes("/Users/")));
        const id = ids.get(name); assert.ok(id, `unresolved ${name}`); return id;
      });
      if (Array.isArray(item)) return item.map(child => visit(child));
      if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([name, child]) => [name, visit(child, name)]));
      return item;
    }
    return visit(value) as T;
  }
  // Earliest representation of every unowned manual candidate, before the claim can change it.
  const baseline = new Map<string, PublicUser>();
  for (const entry of capture) {
    const body = entry.response.body as Partial<PublicUser> & { Resources?: PublicUser[] } | null;
    for (const user of [body, ...(body?.Resources ?? [])]) {
      if (user?.userName && user.id && !user.externalId && !baseline.has(user.id)) baseline.set(user.id, user as PublicUser);
    }
  }
  assert.ok([...baseline.values()].some(user => user.userName === "maya.requestor" && user.emails[0].value === "maya.requestor@idambox.com"), "seeded manual candidate captured before claim");
  const h = await startScimHttpHarness();
  try {
    const other = await prepareScimReplay(h, [...baseline.values()]);
    const read = (id: string) => h.backend(backend => backend.documents(USER).findOne({ documentId: id, populate: { identitySource: true, roles: true } }));
    for (const candidate of baseline.values()) {
      const row = await h.backend(backend => backend.documents(USER).findFirst({ filters: { username: candidate.userName } }));
      assert.ok(row); bind(candidate.id, row.documentId);
    }
    const foreignRows = () => h.backend(backend => backend.documents(USER).findMany({ filters: { identitySource: { documentId: other.documentId } }, populate: { identitySource: true, roles: true }, limit: 1000 }));
    const before = await foreignRows();
    const manual = [...baseline.values()].find(user => user.userName === "maya.requestor")!;
    const manualId = ids.get(marker(manual.id))!;
    const manualBefore = await read(manualId);
    const observed = await observeScimRequests(h, async () => {
      for (const entry of capture) {
        const request = replace(entry.request);
        const response = await h.wire(request);
        const label = `${entry.sequence} ${entry.scenario} ${request.method} ${request.path}`;
        assert.equal(response.status, entry.response.status, label);
        const body: unknown = response.status === 204 ? null : await response.json();
        if (response.status === 204) assert.equal(await response.text(), "");
        if (request.method === "POST" && response.status === 201) bind(record(entry.response.body).id, record(body).id);
        const expectedBody = entry.response.body as { Resources?: PublicUser[] } | null;
        if (expectedBody?.Resources) {
          const actual = record(body).Resources as PublicUser[];
          for (const expected of expectedBody.Resources.filter(item => typeof item?.userName === "string")) {
            const matching = actual.filter(user => user.userName === expected.userName);
            assert.equal(matching.length, 1, label); bind(expected.id, matching[0].id);
          }
        }
        assert.deepEqual(body, replace(entry.response.body), `${label} exact JSON`);
        assert.deepEqual(Object.fromEntries(["accept", "content-type", "retry-after"].flatMap(key => response.headers.has(key) ? [[key, response.headers.get(key)]] : [])), entry.response.headers, `${label} headers`);
        if (entry.scenario === "claim-conflict" && response.status === 409) assert.deepEqual(await read(manualId), manualBefore, "conflict must leave manual candidate unowned and unchanged");
        if (["POST", "PUT", "PATCH"].includes(request.method) && response.status < 300) {
          const user = record(body);
          const row = await read(String(user.id)); assert.ok(row);
          assert.equal(row.identitySource?.documentId, h.primary.documentId);
          assert.equal(row.sourceExternalId, user.externalId);
          assert.equal(row.sourceIdentityKey, deriveSourceIdentityKey(h.primary.documentId, String(user.externalId)));
          assert.equal(row.accountStatus, user.active ? "active" : "inactive");
          assert.equal(row.sourceDeletedAt, null);
        }
      }
    });
    assert.deepEqual(observed.requests, capture.map(entry => replace(entry.request)), "exact received sequence including background envelopes");
    assert.deepEqual([...ids.keys()].sort(), Object.keys(manifest.substitutions).sort());
    assert.deepEqual(await foreignRows(), before, "other source remains unchanged");
    const claimed = await read(manualId); assert.ok(claimed);
    assert.equal(claimed.sourceExternalId, "940002");
    assert.equal(claimed.identitySource?.documentId, h.primary.documentId);
    assert.deepEqual(claimed.roles, manualBefore?.roles, "claim retains local roles");
    const leaver = await h.backend(backend => backend.documents(USER).findFirst({ filters: { sourceExternalId: "940001" } }));
    assert.ok(leaver); assert.equal(leaver.accountStatus, "inactive"); assert.equal(leaver.sourceDeletedAt, null);
  } finally { await h.close(); }
});

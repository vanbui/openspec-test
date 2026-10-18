import assert from "node:assert/strict";
import { test } from "node:test";
import { KeycloakAdminClient, KeycloakRevocationError } from "../src/keycloak/admin-client";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM, startFakeKeycloakServer } from "./helpers/fake-keycloak-server";

async function fixture(timeout = 5000) {
  const remote = await startFakeKeycloakServer();
  const client = new KeycloakAdminClient({ baseUrl: remote.baseUrl, realm: FAKE_KEYCLOAK_REALM,
    adminClientId: FAKE_KEYCLOAK_CLIENT_ID, adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: timeout });
  return { remote, client };
}
const code = (wanted: string) => (error: unknown) => {
  assert.ok(error instanceof KeycloakRevocationError); assert.equal(error.code, wanted); assert.equal(error.message, wanted); return true;
};

test("subject-only disable sends exactly enabled=false; logout removes actual sessions; absent subjects are inert", async () => {
  const { remote, client } = await fixture();
  try {
    await client.disableUser(null); await client.endUserSessions(undefined); assert.equal(remote.requests.length, 0);
    const user = remote.addUser({ id: "opaque/subject", username: "leaver", email: "leaver@client.test", enabled: true });
    remote.sessions.set(user.id, new Set(["session-1", "session-2"]));
    await client.disableUser(user.id); assert.equal(user.enabled, false); assert.equal(remote.sessions.get(user.id)?.size, 2);
    await client.endUserSessions(user.id); assert.equal(remote.sessions.has(user.id), false);
    assert.deepEqual(remote.adminRequests().map((r) => [r.method, r.path, r.body]), [
      ["PUT", "/admin/realms/idambox/users/opaque%2Fsubject", { enabled: false }],
      ["POST", "/admin/realms/idambox/users/opaque%2Fsubject/logout", null],
    ]);
    await client.disableUser("absent"); await client.endUserSessions("absent"); assert.equal(remote.users.size, 1);
  } finally { await remote.close(); }
});

test("partial logout failure replays the pair and only closed codes escape hostile bodies", async () => {
  const { remote, client } = await fixture();
  try {
    const user = remote.addUser({ username: "partial", email: "partial@client.test", enabled: true });
    remote.sessions.set(user.id, new Set(["session"]));
    remote.failNext(`POST /admin/realms/idambox/users/${user.id}/logout`, { status: 503, body: 'secret token personal@example.test' });
    await client.disableUser(user.id); await assert.rejects(client.endUserSessions(user.id), code("KEYCLOAK_UNAVAILABLE"));
    assert.equal(remote.sessions.get(user.id)?.size, 1);
    await client.disableUser(user.id); await client.endUserSessions(user.id); assert.equal(remote.sessions.has(user.id), false);
    for (const [status, expected] of [[403, "KEYCLOAK_AUTH"], [409, "KEYCLOAK_CONFLICT"]] as const) {
      remote.failNext("PUT /admin", { status, body: 'private-data' });
      await assert.rejects(client.disableUser(user.id), code(expected));
    }
  } finally { await remote.close(); }
});

test("revocation shares tokens and refreshes a rejected token only once", async () => {
  const { remote, client } = await fixture();
  try {
    await Promise.all([client.disableUser("absent-a"), client.disableUser("absent-b")]);
    assert.equal(remote.tokenRequests().length, 1);
    remote.revokeTokens(); await client.disableUser("absent-a"); assert.equal(remote.tokenRequests().length, 2);
    remote.failNext("PUT /admin", { status: 401 }); remote.failNext("PUT /admin", { status: 401 });
    await assert.rejects(client.disableUser("absent-a"), code("KEYCLOAK_AUTH"));
    remote.failNext("POST /realms", { status: 401, body: '{"error":"private-credential"}' });
    remote.revokeTokens(); await assert.rejects(client.disableUser("absent-a"), code("KEYCLOAK_AUTH"));
  } finally { await remote.close(); }
});

test("whole-attempt deadlines bound shared-token waits, token body parsing and refresh", async () => {
  const { remote, client } = await fixture();
  try {
    const barrier = remote.holdNext("POST /realms");
    const first = client.disableUser("absent", { deadline: Date.now() + 1000 });
    await barrier.entered;
    const started = Date.now();
    await assert.rejects(client.endUserSessions("absent", { deadline: Date.now() + 40 }), code("KEYCLOAK_TIMEOUT"));
    assert.ok(Date.now() - started < 700); barrier.release(); await first;
    remote.revokeTokens();
    remote.failNext("POST /realms", { status: 200, body: '{"access_token":"late","expires_in":300}', bodyDelayMs: 200 });
    await assert.rejects(client.disableUser("absent", { deadline: Date.now() + 60 }), code("KEYCLOAK_TIMEOUT"));
    await assert.rejects(client.disableUser("absent", { deadline: Date.now() - 1 }), code("KEYCLOAK_TIMEOUT"));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(client.disableUser("absent", { signal: controller.signal }), code("KEYCLOAK_TIMEOUT"));
  } finally { await remote.close(); }
});

test("delayed admin bodies are discarded without disclosure and a non-answering call is bounded", async () => {
  const { remote, client } = await fixture(80);
  try {
    remote.failNext("PUT /admin", { status: 503, body: 'private-data', bodyDelayMs: 250 });
    await assert.rejects(client.disableUser("absent"), code("KEYCLOAK_UNAVAILABLE"));
    remote.failNext("PUT /admin", { status: 204, delayMs: 250 });
    await assert.rejects(client.disableUser("absent"), code("KEYCLOAK_TIMEOUT"));
  } finally { await remote.close(); }
});

test("cancelling the token owner aborts its request; a subsequent attempt obtains a fresh token", async () => {
  const { remote, client } = await fixture();
  try {
    const controller = new AbortController();
    const barrier = remote.holdNext("POST /realms");
    const operation = client.disableUser("absent", { signal: controller.signal });
    const rejected = assert.rejects(operation, code("KEYCLOAK_TIMEOUT"));
    await barrier.entered; controller.abort(); await rejected;
    barrier.release();
    await client.disableUser("absent"); assert.equal(remote.tokenRequests().length, 2);
  } finally { await remote.close(); }
});

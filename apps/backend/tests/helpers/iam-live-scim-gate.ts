/** Isolated mounted HTTP fixtures. Live orchestration uses the same SCIM writer and current access policy. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT, jwtVerify } from "jose";
import { startAuthorizationHttpHarness } from "./strapi-http-harness";
import { backendModule } from "./iam-scim-http-harness";
import { startFakeKeycloakServer, FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET } from "./fake-keycloak-server";
import { CORE_USER_URN, PATCH_OP_URN } from "../../src/iam/scim/wire";

const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
export type RefusalMethod = "PUT" | "PATCH" | "DELETE";

export async function createRefusalBackend(issuer: string, remote: { baseUrl: string; realm: string; adminClientId: string; adminClientSecret: string }) {
  const saved = new Map(["ENV_PATH", "IDAMBOX_SEED_IAM", "CSRM_AUTH_OIDC_ENABLED"].map(key => [key, process.env[key]]));
  const restoreEnvironment = () => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
  process.env.ENV_PATH = require("node:path").resolve(__dirname, "../../..", `refusal-no-env-${randomUUID()}`);
  process.env.IDAMBOX_SEED_IAM = "false";
  process.env.CSRM_AUTH_OIDC_ENABLED = "false";
  let http: Awaited<ReturnType<typeof startAuthorizationHttpHarness>>;
  try { http = await startAuthorizationHttpHarness({ keycloakTokenVerification: { issuer, clientId: "idambox-csrm" } }); }
  catch (error) { restoreEnvironment(); throw error; }
  try {
    const source = await http.withBackendFixture(async backend => {
      const { registerIdentitySource } = backendModule<typeof import("../../src/iam/identity/source-registration")>("iam/identity/source-registration");
      const { administerSourceToken } = backendModule<typeof import("../../src/iam/scim/token-service")>("iam/scim/token-service");
      const record = await registerIdentitySource(backend, { name: "Refusal Gate", username: "refusal-service", email: "refusal-service@gate.test", displayName: "Refusal Gate" });
      const issued = await administerSourceToken(backend, record.documentId); assert.ok("token" in issued);
      const { KeycloakAdminClient } = backendModule<typeof import("../../src/keycloak/admin-client")>("keycloak/admin-client");
      const { createIdamboxUserProvisioningMiddleware } = backendModule<typeof import("../../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
      backend.documents.use(createIdamboxUserProvisioningMiddleware(backend, new KeycloakAdminClient({ ...remote, requestTimeoutMs: 2000 })));
      return { id: record.documentId, token: issued.token };
    });
    async function scim(path: string, method = "GET", body?: unknown) {
      return http.request({ path: `/scim/v2/${path}`, omitApiToken: true, init: { method,
        headers: { Authorization: `Bearer ${source.token}`, Accept: "application/json", "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) } });
    }
    process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "true";
    // The shared authorization fixture links an inactive baseline person and legitimately queues work.
    // Drain that fixture work before measuring a scenario, so the real worker claims this scenario's row.
    await http.withBackendFixture(async backend => {
      const { runOneDeactivation } = backendModule<typeof import("../../src/iam/keycloak-sync/worker")>("iam/keycloak-sync/worker");
      const config = { client: { ...remote, requestTimeoutMs: 2000 }, pollMs: 1000, leaseMs: 10000, attemptMs: 5000 };
      for (let count = 0; count < 10; count++) if (!await runOneDeactivation(backend, config)) return;
      throw new Error("Refusal fixture baseline did not drain.");
    });
    let sequence = 0;
    async function person(method: RefusalMethod, prefix = "iam-gate-refusal", attempted?: (username: string) => void) {
      const username = `${prefix}-${method.toLowerCase()}-${++sequence}-${randomUUID().slice(0, 8)}`;
      attempted?.(username);
      const created = await scim("Users", "POST", { schemas: [CORE_USER_URN], userName: username, externalId: username,
        emails: [{ value: `${username}@gate.test`, primary: true }], name: { givenName: "Gate", familyName: "Refusal" }, active: true });
      assert.equal(created.status, 201);
      const { id } = await created.json() as { id: string };
      const row = await http.withBackendFixture(backend => backend.documents(USER).findOne({ documentId: id }));
      assert.ok(row?.externalSubject);
      const request = await http.withBackendFixture(async backend => {
        const analyst = await backend.documents("api::role.role").findFirst({ filters: { name: "Security Analyst" } }); assert.ok(analyst);
        await backend.documents(USER).update({ documentId: id, data: { roles: [analyst.documentId] } });
        const original = await backend.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: http.requests.owner }); assert.ok(original);
        await backend.documents("api::csrm-assessment-request.csrm-assessment-request").update({ documentId: original.documentId, data: { requestor: id } });
        await backend.documents("api::csrm-risk.csrm-risk").create({ data: { riskNumber: username, riskStatement: "Gate retained risk", riskOwner: id, treatmentOwner: id } });
        return original.documentId;
      });
      const snapshot = () => http.withBackendFixture(async backend => {
        const user = await backend.documents(USER).findOne({ documentId: id, populate: { roles: true, identitySource: true } });
        const requestRow = await backend.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: request, populate: { requestor: true } });
        // Observe every existing risk relation as persisted, without changing its authority.
        const risks = await backend.documents("api::csrm-risk.csrm-risk").findMany({ populate: { riskOwner: true, treatmentOwner: true } });
        return { subject: user?.externalSubject, source: user?.identitySource?.documentId,
          sourceExternalId: user?.sourceExternalId, sourceIdentityKey: user?.sourceIdentityKey,
          roles: user?.roles?.map(role => role.documentId),
          requestor: requestRow?.requestor?.documentId, risks: risks.map(risk => ({ id: risk.documentId, owner: risk.riskOwner?.documentId, treatmentOwner: risk.treatmentOwner?.documentId })) };
      });
      const before = await snapshot();
      assert.equal(before.requestor, id);
      assert.ok(before.risks.some(risk => risk.owner === id && risk.treatmentOwner === id));
      const work = () => http.withBackendFixture(backend => backend.documents(OUTBOX).findFirst({ filters: { userDocumentId: id } }));
      const sync = (run: boolean) => http.withBackendFixture(async backend => {
        const { runOneDeactivation } = backendModule<typeof import("../../src/iam/keycloak-sync/worker")>("iam/keycloak-sync/worker");
        if (run) assert.equal(await runOneDeactivation(backend, { client: { ...remote, requestTimeoutMs: 2000 }, pollMs: 1000, leaseMs: 10000, attemptMs: 5000 }), true);
      });
      return { id, username, subject: row.externalSubject, request, work,
        async requestWith(token: string, path: string, method = "GET", body?: unknown, apiCredential?: string) {
          return http.request({ path, init: { method, headers: { "x-csrm-identity-token": token, "Content-Type": "application/json",
            ...(apiCredential ? { Authorization: `Bearer ${apiCredential}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }) } });
        },
        async deactivate() {
          const body = method === "PUT" ? { schemas: [CORE_USER_URN], active: false, title: "Departed" }
            : method === "PATCH" ? { schemas: [PATCH_OP_URN], Operations: [{ op: "replace", value: { active: false, title: "Departed" } }] } : undefined;
          assert.equal((await scim(`Users/${id}`, method, body)).status, method === "DELETE" ? 204 : 200);
        },
        async pending() {
          const user = await http.withBackendFixture(backend => backend.documents(USER).findOne({ documentId: id }));
          assert.equal(user?.accountStatus, "inactive");
          if (method !== "DELETE") assert.equal(user?.jobTitle, "Departed");
          else assert.ok(user?.sourceDeletedAt);
          assert.equal((await work())?.syncStatus, "pending");
          assert.equal((await work())?.attempts, 0);
          assert.equal((await scim("ResourceTypes")).status, 200);
          assert.equal((await scim("Groups")).status, 200);
        },
        async references() { assert.deepEqual(await snapshot(), before); },
        async retryUnavailable() { await sync(true); const pending = await work(); assert.equal(pending?.syncStatus, "pending");
          assert.equal(pending?.lastErrorCode, "KEYCLOAK_UNAVAILABLE");
          assert.equal(pending?.attempts, 1);
        },
        async recover() {
          // A fixture-only due time lets the real worker consume its durable retry without waiting for backoff.
          const pending = await work(); assert.ok(pending);
          await http.withBackendFixture(backend => backend.documents(OUTBOX).update({ documentId: pending.documentId, data: { nextAttemptAt: "2000-01-01T00:00:00.000Z" } }));
          await sync(true); assert.equal((await work())?.syncStatus, "completed");
        },
      };
    }
    return { http, source, scim, person, async close() { try { await http.close(); } finally { restoreEnvironment(); } } };
  } catch (error) { try { await http.close(); } finally { restoreEnvironment(); } throw error; }
}

export async function startRefusalFixture() {
  const keys = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(keys.publicKey), kid: "refusal", alg: "RS256", use: "sig" };
  const remote = await startFakeKeycloakServer();
  let offline = false;
  const proxy = createServer(async (request, response) => {
    if (offline) { response.writeHead(503).end(); return; }
    if (request.url?.endsWith("/certs")) { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ keys: [jwk] })); return; }
    try {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const upstream = await fetch(`${remote.baseUrl}${request.url}`, { method: request.method,
        headers: { authorization: request.headers.authorization ?? "", "Content-Type": request.headers["content-type"] ?? "application/json" },
        ...(["GET", "HEAD"].includes(request.method!) ? {} : { body: Buffer.concat(chunks) }) });
      response.writeHead(upstream.status, Object.fromEntries(upstream.headers)); response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { response.writeHead(503).end(); }
  });
  await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve));
  const address = proxy.address(); assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`; const issuer = `${baseUrl}/realms/idambox`;
  let backend: Awaited<ReturnType<typeof createRefusalBackend>> | undefined;
  try { backend = await createRefusalBackend(issuer, { baseUrl, realm: "idambox", adminClientId: FAKE_KEYCLOAK_CLIENT_ID, adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET }); }
  catch (error) { proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); await remote.close(); throw error; }
  const active = backend;
  return {
    outage(value: boolean) { offline = value; },
    async scenario(method: RefusalMethod) {
      const person = await active.person(method);
      const token = await new SignJWT({ iss: issuer, sub: person.subject, typ: "Bearer", azp: "idambox-csrm", aud: "idambox-csrm" })
        .setProtectedHeader({ alg: "RS256", kid: "refusal" }).setIssuedAt().setExpirationTime("10m").sign(keys.privateKey);
      const paths = ["/api/v1/me/access", "/api/v1/risks", `/api/csrm-assessment-requests/${person.request}`];
      return { ...person,
        async baseline() {
          for (const path of paths) assert.equal((await person.requestWith(token, path)).status, 200, path);
          assert.equal((await person.requestWith(token, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Owner request" } })).status, 200);
        },
        async refusal() {
          assert.equal((await jwtVerify(token, keys.publicKey, { issuer, audience: "idambox-csrm" })).payload.sub, person.subject);
          for (const path of paths) assert.equal((await person.requestWith(token, path)).status, 403, path);
          assert.equal((await person.requestWith(token, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Forbidden" } })).status, 403);
        },
      };
    },
    async close() { try { await active.close(); } finally { proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); await remote.close(); } },
  };
}

/** Live-only adapter: no local environment files are loaded by the control plane. */
export async function createLiveScimRuntime(env: NodeJS.ProcessEnv) {
  const { readLiveGateConfig, establishPkceSession } = await import("./iam-live-keycloak-gate");
  const { composeKeycloak, GateDeadline, cleanupGateResources } = await import("./iam-gate-harness");
  const { randomBytes } = await import("node:crypto");
  const path = await import("node:path");
  const config = readLiveGateConfig(env);
  const backend = await createRefusalBackend(config.issuer, config);
  const attempted = new Set<string>();
  let restore = false;
  const held = new Set<() => void>();
  let delay = false;
  let apiToken: string | undefined;
  let webToken: string | undefined;
  let tokenChanged = false;
  // Delay actual server-side current-access resolution, never substitute an access response.
  await backend.http.withBackendFixture(async instance => {
    instance.server.app.middleware.unshift(async (context, next) => {
      if (context.path === "/api/v1/me/access" && apiToken && context.get("authorization") === `Bearer ${apiToken}`) {
        const observed = context.get("x-csrm-identity-token");
        if (webToken && observed !== webToken) tokenChanged = true;
        if (observed) webToken ??= observed;
        if (delay) await new Promise<void>(resolve => { held.add(resolve); });
      }
      await next();
    });
  });
  const appDir = path.resolve(__dirname, "../../../..");
  async function admin(route: string, init: RequestInit = {}) {
    const token = await fetch(`${config.issuer}/protocol/openid-connect/token`, { method: "POST", signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.adminClientId, client_secret: config.adminClientSecret }) });
    assert.equal(token.status, 200);
    const credential = await token.json() as { access_token: string };
    return fetch(`${config.baseUrl}/admin/realms/${config.realm}/${route}`, { ...init, signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${credential.access_token}`, "Content-Type": "application/json" } });
  }
  async function start() {
    if (!restore) return;
    await composeKeycloak("start", appDir, 30000);
    await new GateDeadline(60000).run("scim-realm-ready", async () => {
      for (;;) {
        try { if ((await fetch(`${config.issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(3000) })).ok) break; } catch { /* Wait for service readiness. */ }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });
    restore = false;
  }
  try {
    apiToken = await backend.http.withBackendFixture(async instance => {
      const service = instance.service("admin::api-token-content-api") as { create(input: object): Promise<{ accessKey: string }> };
      return (await service.create({ name: "Refusal isolated web", description: "Disposable gate", type: "full-access", lifespan: null })).accessKey;
    });
    return { baseUrl: backend.http.baseUrl, apiToken,
      holdAccess() { delay = true; },
      accessHeld() { return held.size > 0; },
      releaseAccess() { delay = false; for (const resolve of held) resolve(); held.clear(); },
      async scenario(method: RefusalMethod) {
        webToken = undefined; tokenChanged = false;
        const person = await backend.person(method, config.prefix, username => attempted.add(username));
        const password = randomBytes(9).toString("base64url");
        assert.equal((await admin(`users/${person.subject}/reset-password`, { method: "PUT", body: JSON.stringify({ type: "password", temporary: false, value: password }) })).status, 204);
        assert.equal((await admin(`users/${person.subject}`, { method: "PUT", body: JSON.stringify({ requiredActions: [] }) })).status, 204);
        const token = await establishPkceSession(config, person.username, password, fetch, AbortSignal.timeout(180000));
        const paths = ["/api/v1/me/access", "/api/v1/risks", `/api/csrm-assessment-requests/${person.request}`];
        return { username: person.username, password, detail: `/app/requests/${person.request}`,
          prepare: async () => {},
          async baseline() {
            if (method !== "DELETE") {
              assert.ok(webToken); assert.equal(tokenChanged, false);
              const { decodeJwt } = await import("jose"); assert.equal(decodeJwt(webToken).sub, person.subject);
              for (const path of paths) assert.equal((await person.requestWith(webToken, path, "GET", undefined, apiToken)).status, 200);
              assert.equal((await person.requestWith(webToken, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Owner request" } }, apiToken)).status, 200);
            }
            for (const path of paths) assert.equal((await person.requestWith(token, path)).status, 200);
            assert.equal((await person.requestWith(token, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Owner request" } })).status, 200);
          },
          async stop() { restore = true; await composeKeycloak("stop", appDir, 30000); },
          deactivate: person.deactivate,
          async refusal() {
            const { decodeJwt } = await import("jose");
            assert.ok(decodeJwt(token).exp! > Date.now() / 1000);
            for (const path of paths) assert.equal((await person.requestWith(token, path)).status, 403);
            assert.equal((await person.requestWith(token, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Forbidden" } })).status, 403);
            if (method !== "DELETE") {
              assert.ok(webToken); assert.equal(tokenChanged, false);
              assert.ok(decodeJwt(webToken).exp! > Date.now() / 1000);
              for (const path of paths) assert.equal((await person.requestWith(webToken, path, "GET", undefined, apiToken)).status, 403);
              assert.equal((await person.requestWith(webToken, `/api/csrm-assessment-requests/${person.request}`, "PUT", { data: { title: "Forbidden" } }, apiToken)).status, 403);
            }
          },
          async pending() { await person.pending(); await person.references(); },
          start,
          async recover() {
            await person.recover();
            const user = await admin(`users/${person.subject}`); assert.equal(user.status, 200);
            assert.equal((await user.json() as { enabled: boolean }).enabled, false);
            const sessions = await admin(`users/${person.subject}/sessions`); assert.equal(sessions.status, 200);
            assert.deepEqual(await sessions.json(), []);
            await person.references();
          },
          close: async () => {},
        };
      },
      async close() {
        delay = false; for (const resolve of held) resolve(); held.clear();
        await cleanupGateResources([
          { stage: "scim-restore", close: start },
          { stage: "scim-remote-cleanup", close: async () => {
            for (const username of attempted) {
              const response = await admin(`users?${new URLSearchParams({ username, exact: "true" })}`); assert.equal(response.status, 200);
              const users = await response.json() as Array<{ id: string; username: string; email: string }>;
              for (const user of users) {
                assert.equal(user.username, username); assert.equal(user.email, `${username}@gate.test`);
                assert.equal((await admin(`users/${encodeURIComponent(user.id)}`, { method: "DELETE" })).status, 204);
              }
            }
          } },
          { stage: "scim-backend-close", close: () => backend.close() },
        ], 90000);
      },
    };
  } catch (error) { await start(); await backend.close(); throw error; }
}

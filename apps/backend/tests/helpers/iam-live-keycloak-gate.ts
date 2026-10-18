/**
 * Standalone opt-in live gate; never invoked by backend test discovery.
 * Required environment (no dotenv/imported realm credentials are read):
 * KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 * KEYCLOAK_ADMIN_CLIENT_SECRET (service-account client_credentials), KEYCLOAK_ISSUER,
 * IAM_LIVE_CLIENT_ID (must be idambox-csrm), IAM_LIVE_CLIENT_SECRET,
 * IAM_LIVE_REDIRECT_URI (an already registered loopback callback),
 * IAM_LIVE_FIXTURE_PREFIX (gate-owned username prefix), IAM_LIVE_FIXTURE_EMAIL_DOMAIN.
 * A random transient human password, cookies, codes and tokens stay in memory.
 * Uses authorization_code + S256 PKCE via the ordinary login form; never enables
 * direct grants or changes realm/client settings. Only compose project idp's
 * keycloak service is stopped/started, using docker/docker-compose.yaml.
 * Child flags and SQLite fixtures are disposable; parent/product flags are untouched.
 * Evidence/errors contain closed stage names and booleans only.
 */
import assert from "node:assert/strict";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import { GateDeadline, GateFailure, evidenceLine, composeKeycloak, isolatedGateEnvironment,
  startIsolatedGateChild, cleanupGateResources } from "./iam-gate-harness";
import { parseGateArgs } from "./iam-postgres-gate";

export type LiveGateConfig = { baseUrl: string; realm: string; issuer: string; adminClientId: string;
  adminClientSecret: string; clientId: string; clientSecret: string; redirectUri: string; prefix: string; emailDomain: string };

export function readLiveGateConfig(env: NodeJS.ProcessEnv): LiveGateConfig {
  function required(key: string): string {
    const value = env[key];
    if (!value || value !== value.trim()) throw new GateFailure("live-config");
    return value;
  }
  function loopback(value: string): URL {
    let url: URL;
    try { url = new URL(value); } catch { throw new GateFailure("live-config"); }
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.username || url.password || url.search || url.hash) throw new GateFailure("live-config");
    return url;
  }
  const base = loopback(required("KEYCLOAK_BASE_URL"));
  if (base.port !== "8080" || base.pathname !== "/") throw new GateFailure("live-config");
  const baseUrl = base.href.replace(/\/+$/, "");
  const realm = required("KEYCLOAK_REALM");
  const issuer = loopback(required("KEYCLOAK_ISSUER")).href.replace(/\/+$/, "");
  const clientId = required("IAM_LIVE_CLIENT_ID");
  const redirectUri = loopback(required("IAM_LIVE_REDIRECT_URI")).href;
  const prefix = required("IAM_LIVE_FIXTURE_PREFIX");
  const emailDomain = required("IAM_LIVE_FIXTURE_EMAIL_DOMAIN");
  if (!/^[a-zA-Z0-9_-]+$/.test(realm) || issuer !== `${baseUrl}/realms/${realm}`
    || clientId !== "idambox-csrm" || !/^iam-gate-[a-z0-9-]{1,32}$/.test(prefix)
    || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(emailDomain)) throw new GateFailure("live-config");
  return { baseUrl, realm, issuer, clientId, redirectUri, prefix, emailDomain,
    adminClientId: required("KEYCLOAK_ADMIN_CLIENT_ID"), adminClientSecret: required("KEYCLOAK_ADMIN_CLIENT_SECRET"),
    clientSecret: required("IAM_LIVE_CLIENT_SECRET") };
}

type SessionProof = { linked: boolean; active: boolean; authenticated: boolean; sessions: number };
type InactiveProof = { inactive: boolean; pending: boolean; refused: boolean; signedTokenValid: boolean };
type RecoveryProof = { disabled: boolean; sessions: number; completed: boolean };
export interface LiveGateRuntime {
  prepare(): Promise<void>;
  session(): Promise<SessionProof>;
  stop(): Promise<void>;
  deactivate(): Promise<InactiveProof>;
  retry(): Promise<void>;
  start(): Promise<void>;
  recover(): Promise<RecoveryProof>;
  close(): Promise<void>;
}

/** Reserve a separate restore/cleanup budget even if the execution deadline expires. */
export async function executeLiveGate(runtime: LiveGateRuntime, deadline: GateDeadline,
  emit: (line: string) => void, cleanupMs = 90_000): Promise<void> {
  let restoreRequired = false;
  let failure: GateFailure | undefined;
  async function stage<T>(name: string, work: () => Promise<T>): Promise<T> {
    let result: T;
    try { result = await deadline.run(name, work); }
    catch (error) { throw new GateFailure(name, error instanceof GateFailure ? error.reason : "failed"); }
    emit(evidenceLine(name, { passed: true }));
    return result;
  }
  try {
    await stage("live-setup", () => runtime.prepare());
    await stage("live-session", async () => {
      const proof = await runtime.session();
      assert.equal(proof.linked, true); assert.equal(proof.active, true); assert.equal(proof.authenticated, true);
      assert.ok(Number.isInteger(proof.sessions) && proof.sessions > 0);
    });
    // Set before issuing stop: a timed-out command may have stopped the service.
    restoreRequired = true;
    await stage("live-stop", () => runtime.stop());
    await stage("live-inactive-refusal", async () => {
      const proof = await runtime.deactivate();
      assert.deepEqual(proof, { inactive: true, pending: true, refused: true, signedTokenValid: true });
    });
    await stage("live-outage-retry", () => runtime.retry());
    await stage("live-start", () => runtime.start());
    await stage("live-recovery", async () => {
      const proof = await runtime.recover();
      assert.deepEqual(proof, { disabled: true, sessions: 0, completed: true });
    });
  } catch (error) {
    failure = error instanceof GateFailure ? new GateFailure(error.stage, error.reason) : new GateFailure("live-gate");
  } finally {
    // Reserve cleanup time independently: a stalled restore must not skip child/fixture teardown.
    const restoreMs = Math.max(1, Math.floor(cleanupMs * 0.625));
    let cleanupFailed = false;
    if (restoreRequired) {
      try { await new GateDeadline(restoreMs).run("live-restore", () => runtime.start()); emit(evidenceLine("live-restore", { passed: true })); }
      catch { cleanupFailed = true; }
    }
    try { await new GateDeadline(cleanupMs - restoreMs).run("live-cleanup", () => runtime.close()); emit(evidenceLine("live-cleanup", { passed: true })); }
    catch { cleanupFailed = true; }
    if (cleanupFailed) failure = new GateFailure("live-restoration");
  }
  if (failure) throw failure;
}

type Fetch = typeof fetch;
/** Bounded calls, including body consumption; never expose a remote error body. */
async function http(url: string, init: RequestInit = {}, transport: Fetch = fetch, signal?: AbortSignal): Promise<Response> {
  return transport(url, { ...init, redirect: "manual", signal: AbortSignal.any([
    AbortSignal.timeout(5000), ...(signal ? [signal] : [])]) });
}
function decodeAttribute(value: string): string {
  return value.replace(/&#x([a-f0-9]+);|&#([0-9]+);|&(amp|quot|apos|lt|gt);/gi,
    (_match, hex: string, decimal: string, named: string) => hex ? String.fromCodePoint(parseInt(hex, 16))
      : decimal ? String.fromCodePoint(Number(decimal)) : ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[named.toLowerCase()] ?? ""));
}
function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-z][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    result[match[1].toLowerCase()] = decodeAttribute(match[2] ?? match[3]);
  }
  return result;
}

/** A minimal cookie-bearing user agent for the standard Keycloak username/password login form. */
export async function establishPkceSession(config: LiveGateConfig, username: string, password: string,
  transport: Fetch = fetch, signal?: AbortSignal): Promise<string> {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const authorization = new URL(`${config.issuer}/protocol/openid-connect/auth`);
  authorization.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: "openid profile email", state, nonce, prompt: "login",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  const cookies = new Map<string, string>();
  const origin = new URL(config.baseUrl).origin;
  async function browser(url: URL, init: RequestInit = {}) {
    if (url.origin !== origin) throw new GateFailure("login-origin");
    const response = await http(url.href, { ...init, headers: { ...init.headers,
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") } }, transport, signal);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0]; const equals = pair.indexOf("=");
      if (equals > 0) cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
    return response;
  }
  let current = authorization;
  let response = await browser(current);
  for (let redirects = 0; redirects < 8 && response.status >= 300 && response.status < 400; redirects++) {
    const location = response.headers.get("location"); assert.ok(location);
    current = new URL(location, current); response = await browser(current);
  }
  assert.equal(response.status, 200);
  const html = await response.text();
  const form = [...html.matchAll(/<form\b[^>]*>/gi)].map((match) => attributes(match[0]))
    .find((attrs) => attrs.id === "kc-form-login");
  assert.ok(form?.action);
  const action = new URL(form.action, current);
  const body = new URLSearchParams();
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.type === "hidden" && attrs.name) body.set(attrs.name, attrs.value ?? "");
  }
  body.set("username", username); body.set("password", password); body.set("credentialId", "");
  response = await browser(action, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  current = action;
  let callback: URL | undefined;
  for (let redirects = 0; redirects < 8; redirects++) {
    assert.ok(response.status >= 300 && response.status < 400);
    const location = response.headers.get("location"); assert.ok(location);
    const next = new URL(location, current);
    const registered = new URL(config.redirectUri);
    if (next.origin === registered.origin && next.pathname === registered.pathname) { callback = next; break; }
    current = next; response = await browser(current);
  }
  assert.ok(callback); assert.equal(callback.searchParams.get("state"), state);
  assert.equal(callback.searchParams.has("error"), false);
  const code = callback.searchParams.get("code"); assert.ok(code);
  const tokens = await http(`${config.issuer}/protocol/openid-connect/token`, { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
      grant_type: "authorization_code", client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, code, code_verifier: verifier }) }, transport, signal);
  assert.equal(tokens.status, 200);
  const result = await tokens.json() as { access_token?: unknown };
  assert.equal(typeof result.access_token, "string"); assert.ok(result.access_token);
  return result.access_token as string;
}

function createLiveRuntime(config: LiveGateConfig, deadline: GateDeadline): LiveGateRuntime {
  const appDir = path.resolve(__dirname, "../../../..");
  const fixtureDir = path.join(appDir, ".tmp", `iam-live-${randomUUID()}`);
  const username = `${config.prefix}-${randomUUID()}`;
  const email = `${username}@${config.emailDomain}`;
  let child: ReturnType<typeof startIsolatedGateChild> | undefined;
  let subject: string | undefined;
  let accessToken: string | undefined;
  let password: string | undefined;
  let createAttempted = false;
  let fixtureCreated = false;
  let cleaning = false;
  const signal = AbortSignal.timeout(deadline.remaining());
  const requestSignal = (cleanup: boolean) => cleanup ? undefined : cleaning ? AbortSignal.abort() : signal;
  async function adminToken(cleanup = false): Promise<string> {
    const response = await http(`${config.issuer}/protocol/openid-connect/token`, { method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
        grant_type: "client_credentials", client_id: config.adminClientId, client_secret: config.adminClientSecret }) }, fetch, requestSignal(cleanup));
    assert.equal(response.status, 200);
    const data = await response.json() as { access_token?: unknown };
    assert.equal(typeof data.access_token, "string"); return data.access_token as string;
  }
  async function admin(route: string, init: RequestInit = {}, cleanup = false) {
    return http(`${config.baseUrl}/admin/realms/${encodeURIComponent(config.realm)}/${route}`, {
      ...init, headers: { "content-type": "application/json", Authorization: `Bearer ${await adminToken(cleanup)}` } }, fetch, requestSignal(cleanup));
  }
  async function findOwnedUser(cleanup = false): Promise<string | undefined> {
    const response = await admin(`users?username=${encodeURIComponent(username)}&exact=true`, {}, cleanup);
    assert.equal(response.status, 200);
    const users = await response.json() as Array<{ id: string; username: string; email: string }>;
    assert.ok(Array.isArray(users)); assert.ok(users.length <= 1);
    if (!users.length) return undefined;
    assert.equal(users[0].username, username); assert.equal(users[0].email, email);
    assert.equal(typeof users[0].id, "string"); return users[0].id;
  }
  async function remoteProof() {
    assert.ok(subject);
    const user = await admin(`users/${encodeURIComponent(subject)}`); assert.equal(user.status, 200);
    const data = await user.json() as { enabled: boolean };
    const response = await admin(`users/${encodeURIComponent(subject)}/sessions`); assert.equal(response.status, 200);
    const sessions = await response.json() as Array<{ clients?: Record<string, string> }>;
    assert.ok(Array.isArray(sessions));
    return { enabled: data.enabled, sessions: sessions.length,
      clientSessions: sessions.filter((session) => Object.values(session.clients ?? {}).includes(config.clientId)).length };
  }
  async function available() {
    const readySignal = AbortSignal.timeout(45_000);
    while (true) {
      readySignal.throwIfAborted();
      try { const response = await http(`${config.issuer}/.well-known/openid-configuration`, {}, fetch, readySignal);
        await response.arrayBuffer(); if (response.status === 200) return; }
      catch { /* Startup availability is polled within the bounded caller. */ }
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }
  return {
    async prepare() {
      // Fail before outage if Keycloak or the existing credentials are unavailable.
      const collisions = await findOwnedUser(); assert.equal(collisions, undefined);
      signal.throwIfAborted(); assert.equal(cleaning, false);
      password = randomBytes(32).toString("base64url"); createAttempted = true;
      const response = await admin("users", { method: "POST", body: JSON.stringify({ username, email,
        firstName: "Gate", lastName: "Fixture", emailVerified: true, enabled: true, requiredActions: [],
        credentials: [{ type: "password", value: password, temporary: false }] }) });
      assert.equal(response.status, 201);
      subject = await findOwnedUser(); assert.ok(subject);
      await mkdir(fixtureDir, { recursive: true }); fixtureCreated = true;
      signal.throwIfAborted(); assert.equal(cleaning, false);
      child = startIsolatedGateChild(__filename, { cwd: appDir, env: isolatedGateEnvironment({
        ENV_PATH: path.join(fixtureDir, "no-product-env"), NODE_ENV: "development", CSRM_ENVIRONMENT: "development",
        STRAPI_DISABLE_UPDATE_NOTIFICATION: "true", APP_KEYS: randomBytes(32).toString("hex"),
        ADMIN_JWT_SECRET: randomBytes(32).toString("hex"), API_TOKEN_SALT: randomBytes(32).toString("hex"),
        TRANSFER_TOKEN_SALT: randomBytes(32).toString("hex"), ENCRYPTION_KEY: randomBytes(32).toString("hex"),
        JWT_SECRET: randomBytes(32).toString("hex"), DATABASE_CLIENT: "sqlite", DATABASE_URL: "",
        DATABASE_FILENAME: path.relative(appDir, path.join(fixtureDir, "data.db")), csrmAppIsEnabled: "true",
        IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_IAM: "false",
        IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "true",
        KEYCLOAK_BASE_URL: config.baseUrl, KEYCLOAK_REALM: config.realm, KEYCLOAK_ISSUER: config.issuer,
        KEYCLOAK_ADMIN_CLIENT_ID: config.adminClientId, KEYCLOAK_ADMIN_CLIENT_SECRET: config.adminClientSecret,
        KEYCLOAK_TOKEN_CLIENT_ID: config.clientId, KEYCLOAK_REQUEST_TIMEOUT_MS: "5000",
        CSRM_DEV_IDENTITY: "false", CSRM_ATTACHMENT_STORAGE: "local", CSRM_ATTACHMENT_SCANNER: "development",
        CSRM_ATTACHMENT_LOCAL_DIR: path.join(fixtureDir, "attachments"), IAM_LIVE_APP: appDir,
        IAM_LIVE_FIXTURE_DIR: fixtureDir,
      }) }, deadline.remaining());
      await child.ready;
      signal.throwIfAborted(); assert.equal(cleaning, false);
      await child.request({ op: "setup", username, email, subject });
    },
    async session() {
      assert.ok(password);
      accessToken = await establishPkceSession(config, username, password, fetch, signal); password = undefined;
      const local = await child!.request<{ linked: boolean; active: boolean; authenticated: boolean }>({ op: "access", token: accessToken });
      const remote = await remoteProof(); assert.equal(remote.enabled, true); assert.ok(remote.clientSessions > 0);
      return { ...local, sessions: remote.sessions };
    },
    async stop() {
      signal.throwIfAborted();
      await composeKeycloak("stop", appDir, Math.min(30_000, deadline.remaining()));
      // A stop command alone is insufficient proof of an actual outage.
      let reachable = false;
      try { const response = await http(`${config.issuer}/.well-known/openid-configuration`, {}, fetch, signal);
        await response.arrayBuffer(); reachable = true; } catch { /* Expected connection refusal. */ }
      assert.equal(reachable, false);
    },
    deactivate: () => child!.request<InactiveProof>({ op: "deactivate", token: accessToken }),
    async retry() { assert.equal(await child!.request({ op: "retry" }), true); },
    async start() {
      await composeKeycloak("start", appDir, 30_000);
      // Use a fresh budget for finally restoration, independent of the expired execution deadline.
      await new GateDeadline(45_000).run("keycloak-ready", available);
    },
    async recover() {
      signal.throwIfAborted();
      await child!.request({ op: "start-worker" });
      while (true) {
        signal.throwIfAborted();
        const remote = await remoteProof();
        const completed = await child!.request<boolean>({ op: "completed" });
        if (remote.enabled === false && remote.sessions === 0 && completed) return { disabled: true, sessions: 0, completed };
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    },
    async close() {
      cleaning = true;
      password = undefined; accessToken = undefined;
      // Never drop another user's account, even after a timed-out create. Exact random identity only.
      await cleanupGateResources([
        { stage: "live-child-close", close: async () => { await child?.close(); } },
        { stage: "live-user-close", close: async () => {
          if (!createAttempted) return;
          const owned = await findOwnedUser(true);
          if (owned) { const response = await admin(`users/${encodeURIComponent(owned)}`, { method: "DELETE" }, true); assert.equal(response.status, 204); }
        } },
        { stage: "live-fixture-close", close: async () => {
          if (fixtureCreated) await rm(fixtureDir, { recursive: true, force: true });
        } },
      ], 30_000);
    },
  };
}

export async function runIamLiveKeycloakGate(args = process.argv.slice(2), env = process.env,
  emit: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<void> {
  const seconds = parseGateArgs(args);
  // 120 s reserved inside the total CLI timeout for service restoration and resource cleanup.
  if (seconds < 135) throw new GateFailure("live-timeout-budget");
  const config = readLiveGateConfig(env);
  const deadline = new GateDeadline(seconds * 1000 - 120_000);
  await executeLiveGate(createLiveRuntime(config, deadline), deadline, emit, 120_000);
}

const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";

/** Dedicated real Strapi process; all user writes use Document Service and trusted linkage. */
async function liveChild() {
  let strapi: Core.Strapi | undefined;
  try {
    assert.ok(process.send); assert.equal(process.env.DATABASE_CLIENT, "sqlite");
    const appDir = process.env.IAM_LIVE_APP!;
    const fixtureDir = process.env.IAM_LIVE_FIXTURE_DIR!;
    assert.equal(path.dirname(fixtureDir), path.join(appDir, ".tmp"));
    assert.match(path.basename(fixtureDir), /^iam-live-[a-f0-9-]{36}$/);
    assert.equal(process.env.DATABASE_FILENAME, path.relative(appDir, path.join(fixtureDir, "data.db")));
    const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
    const compiled = await runtime.compileStrapi({ appDir }); assert.ok(compiled.distDir);
    const load = <T>(file: string): T => require(path.join(compiled.distDir!, "src", file)) as T;
    strapi = await runtime.createStrapi({ appDir, distDir: compiled.distDir }).load();
    strapi.cron?.destroy();
    const instance = strapi;
    const provisioning = load<typeof import("../../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning");
    const linkage = load<typeof import("../../src/iam/identity/keycloak-linkage")>("iam/identity/keycloak-linkage");
    const worker = load<typeof import("../../src/iam/keycloak-sync/worker")>("iam/keycloak-sync/worker");
    const configModule = load<typeof import("../../src/iam/keycloak-sync/config")>("iam/keycloak-sync/config");
    const verification = load<typeof import("../../src/keycloak/access-token-verifier")>("keycloak/access-token-verifier");
    const verify = verification.createAccessTokenVerifier({ issuer: process.env.KEYCLOAK_ISSUER!,
      clientId: process.env.KEYCLOAK_TOKEN_CLIENT_ID!, requestTimeoutMs: 5000 });
    let userId: string | undefined; let subject: string | undefined; let baseUrl: string | undefined; let apiToken: string | undefined;
    async function user() { assert.ok(userId); return instance.documents(USER).findOne({ documentId: userId }); }
    async function work() { return instance.documents(OUTBOX).findFirst({ filters: { userDocumentId: userId! } }); }
    async function access(token: string): Promise<number> {
      assert.ok(baseUrl); assert.ok(apiToken);
      const response = await http(`${baseUrl}/api/v1/me/access`, { headers: {
        Authorization: `Bearer ${apiToken}`, "x-csrm-identity-token": token } });
      await response.arrayBuffer(); return response.status;
    }
    async function dispatch(command: Record<string, unknown>) {
      switch (command.op) {
        case "setup": {
          assert.equal(typeof command.username, "string"); assert.equal(typeof command.email, "string"); assert.equal(typeof command.subject, "string");
          const app = await instance.documents("api::application.application").create({ data: { name: "Gate CSRM", slug: "idambox-csrm", applicationStatus: "active" } });
          const api = await instance.documents("api::function-api.function-api").create({ data: { name: "Gate Access", url: "GET:/api/v1/me/access" } });
          const fn = await instance.documents("api::function.function").create({ data: { name: "Gate Access", application: app.documentId, functionApis: [api.documentId] } });
          await instance.documents("api::role.role").create({ data: { name: "Requestor", functions: [fn.documentId] } });
          const created = await instance.documents(USER).create({ data: { username: command.username as string,
            email: command.email as string, displayName: "Gate Fixture", accountStatus: "active", protected: false } });
          userId = created.documentId; subject = command.subject as string;
          await linkage.writeKeycloakLinkage(instance, userId, subject);
          // Fixture linking is done with provisioning off; all tested leaver writes run with it on.
          process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "true";
          assert.equal(provisioning.registerIdamboxUserProvisioning(instance), true);
          const tokenService = instance.service("admin::api-token-content-api") as {
            create(input: { name: string; description: string; type: "full-access"; lifespan: null }): Promise<{ accessKey: string }> };
          apiToken = (await tokenService.create({ name: "Gate Access", description: "Disposable live gate", type: "full-access", lifespan: null })).accessKey;
          await new Promise<void>((resolve, reject) => {
            instance.server.httpServer.once("error", reject); instance.server.httpServer.once("listening", resolve);
            instance.server.listen(0, "127.0.0.1");
          });
          const address = instance.server.httpServer.address(); assert.ok(address && typeof address !== "string");
          baseUrl = `http://127.0.0.1:${address.port}`; return true;
        }
        case "access": {
          assert.equal(typeof command.token, "string");
          assert.equal(await verify(command.token as string), subject);
          const current = await user();
          return { linked: current?.externalSubject === subject, active: current?.accountStatus === "active",
            authenticated: await access(command.token as string) === 200 };
        }
        case "deactivate": {
          assert.ok(userId); assert.equal(typeof command.token, "string");
          await instance.documents(USER).update({ documentId: userId, data: { accountStatus: "inactive" } });
          const current = await user(); const pending = await work();
          // Verify the same still-valid signed token with cached JWKS during the real outage.
          const signedTokenValid = await verify(command.token as string) === subject;
          return { inactive: current?.accountStatus === "inactive", pending: pending?.syncStatus === "pending"
            && pending.externalSubject === subject && pending.attempts === 0,
            refused: await access(command.token as string) === 403, signedTokenValid };
        }
        case "retry": {
          const config = configModule.readKeycloakSyncConfig(); assert.ok(config);
          assert.equal(await worker.runOneDeactivation(instance, config), true);
          const pending = await work();
          return pending?.syncStatus === "pending" && pending.attempts === 1
            && pending.lastErrorCode === "KEYCLOAK_UNAVAILABLE";
        }
        case "start-worker": worker.startKeycloakSyncWorker(instance); return true;
        case "completed": return (await work())?.syncStatus === "completed";
        case "shutdown": await instance.destroy(); return true;
        default: throw new GateFailure("live-command");
      }
    }
    // Serial command dispatch avoids teardown racing an in-flight database operation.
    let commands = Promise.resolve();
    process.on("message", (message: { id: number; command: Record<string, unknown> }) => {
      commands = commands.then(async () => {
        try {
          const value = await dispatch(message.command); process.send?.({ id: message.id, ok: true, value });
          if (message.command.op === "shutdown") setImmediate(() => process.exit(0));
        } catch { process.send?.({ id: message.id, ok: false }); }
      });
    });
    process.on("disconnect", () => process.exit(1));
    process.send?.({ event: "ready" });
  } catch {
    process.send?.({ event: "failed" });
    try { await strapi?.destroy(); } finally { process.exit(1); }
  }
}

if (require.main === module) {
  if (process.argv[2] === "--live-child") void liveChild();
  else void runIamLiveKeycloakGate().catch((error: unknown) => {
    const failure = error instanceof GateFailure ? error : new GateFailure("live-gate");
    process.stderr.write(`${evidenceLine(failure.stage, { passed: false })}\n`); process.exitCode = 1;
  });
}

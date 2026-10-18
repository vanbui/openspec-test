import assert from "node:assert/strict";
import { test } from "node:test";
import { readGateConnection, GateDeadline, GateFailure, assertGateProcesses, evidenceLine,
  provisionGateDatabase, cleanupGateResources, assertGateDatabaseBoundary } from "./helpers/iam-gate-harness";
import { parseGateArgs } from "./helpers/iam-postgres-gate";
import { ChildProcess, type fork, type ForkOptions } from "node:child_process";
import { startGateProcess } from "./helpers/iam-process-runner";
import { executeLiveGate, readLiveGateConfig, establishPkceSession, runIamLiveKeycloakGate,
  type LiveGateRuntime } from "./helpers/iam-live-keycloak-gate";
import { keycloakComposeArgs, isolatedGateEnvironment, startIsolatedGateChild } from "./helpers/iam-gate-harness";
import path from "node:path";
import { createHash } from "node:crypto";

const env = { IAM_PG_GATE_HOST: "127.0.0.1", IAM_PG_GATE_PORT: "15432", IAM_PG_GATE_USER: "gate",
  IAM_PG_GATE_PASSWORD: "private-password", IAM_PG_GATE_DB: "iam_pg_gate" };

test("argv requires one bounded timeout and rejects unknown, duplicate and malformed arguments", () => {
  assert.equal(parseGateArgs(["--timeout-seconds", "600"]), 600);
  for (const args of [[], ["--timeout-seconds"], ["--timeout-seconds", "0"], ["--timeout-seconds", "1.5"],
    ["--timeout-seconds", "29"], ["--timeout-seconds", "3601"], ["--skip"], ["--timeout-seconds", "600", "--timeout-seconds", "600"]]) {
    assert.throws(() => parseGateArgs(args), GateFailure);
  }
});

test("connection requires dedicated infrastructure and refuses SQLite and midPoint endpoints", () => {
  assert.equal(readGateConnection(env).port, 15432);
  for (const change of [{ IAM_PG_GATE_PASSWORD: "" }, { IAM_PG_GATE_HOST: "midpoint_data" },
    { IAM_PG_GATE_PORT: "5432" }, { IAM_PG_GATE_PORT: "5433" }, { IAM_PG_GATE_PORT: "15432oops" },
    { IAM_PG_GATE_DB: "midpoint" }, { IAM_PG_GATE_DB: "MIDPOINT_AUDIT" }, { DATABASE_CLIENT: "sqlite" },
    { DATABASE_URL: "postgres://private@localhost/midpoint" }, { IAM_PG_GATE_DB: "repository", MIDPOINT_DB_NAME: "repository" }]) {
    assert.throws(() => readGateConnection({ ...env, ...change }), GateFailure);
  }
  assert.throws(() => readGateConnection({}), GateFailure);
});

test("two distinct child PIDs, PostgreSQL pools and matching gate database identity are mandatory", () => {
  const a = { pid: 101, database: "iam_gate_test", address: "172.20.0.2", port: 5432, dialect: "postgres", backendPid: 1001 };
  const b = { ...a, pid: 102, backendPid: 1002 };
  assertGateProcesses([a, b], "iam_gate_test");
  assert.throws(() => assertGateProcesses([a, b], "iam_gate_test", [101, 999]), GateFailure);
  for (const identities of [[a], [a, a], [a, { ...b, database: "midpoint" }],
    [a, { ...b, dialect: "sqlite" }], [a, { ...b, backendPid: a.backendPid }],
    [a, { ...b, address: "other" }], [a, { ...b, pid: process.pid }]]) {
    assert.throws(() => assertGateProcesses(identities, "iam_gate_test"), GateFailure);
  }
});

test("a server containing a midPoint repository is refused before any gate database is created", () => {
  assertGateDatabaseBoundary(["postgres", "template0", "template1", "iam_pg_gate"], "iam_pg_gate");
  assert.throws(() => assertGateDatabaseBoundary(["postgres", "midpoint"], "postgres"), /database-boundary/);
  assert.throws(() => assertGateDatabaseBoundary(["postgres", "customer_repository"], "postgres", "customer_repository"), /database-boundary/);
  assert.throws(() => assertGateDatabaseBoundary(["postgres"], "iam_pg_gate"), /database-boundary/);
});

test("deadline propagates named failure and bounds stalled stages", async () => {
  const deadline = new GateDeadline(30);
  await assert.rejects(deadline.run("startup", () => new Promise(() => {})), /startup: timeout/);
  const fresh = new GateDeadline(1000);
  await assert.rejects(fresh.run("driver", async () => { throw new Error("password personal@example.test"); }),
    (error: unknown) => error instanceof GateFailure && error.message === "driver: failed");
});

test("evidence uses an allowlist and never serializes errors, credentials or private bodies", () => {
  const privateInput = { password: env.IAM_PG_GATE_PASSWORD, token: "private-token", body: "person@example.test", error: "secret" };
  const line = evidenceLine("claim", { ...privateInput, pid: 101, database: "iam_gate_test", passed: true });
  assert.deepEqual(JSON.parse(line), { stage: "claim", pid: 101, database: "iam_gate_test", passed: true });
  assert.throws(() => evidenceLine("private person@example.test", privateInput), GateFailure);
});

test("database creation and cleanup are scoped to a unique name; failed CREATE never drops an existing database", async () => {
  const statements: string[] = [];
  const sql = { query: async (statement: string) => { statements.push(statement); } };
  const first = await provisionGateDatabase(sql);
  const second = await provisionGateDatabase(sql);
  assert.notEqual(first.name, second.name);
  assert.match(first.name, /^iam_gate_[a-f0-9]{32}$/);
  await first.close(); await first.close(); await second.close();
  assert.equal(statements.filter((s) => s.startsWith("DROP")).length, 2);
  assert.ok(statements.every((s) => !s.includes("midpoint")));
  const rejected: string[] = [];
  await assert.rejects(provisionGateDatabase({ query: async (s: string) => { rejected.push(s); throw new Error("duplicate database"); } }));
  assert.equal(rejected.length, 1);
});

const launchOptions = { appDir: process.cwd(), distDir: "unused", fixtureDir: "unused",
  connection: readGateConnection(env), remoteUrl: "http://127.0.0.1:12345", timeoutMs: 1000 };
function fakeChild() {
  const child = new ChildProcess();
  Object.defineProperty(child, "pid", { value: 123 });
  Object.defineProperty(child, "connected", { value: true });
  child.kill = () => { setImmediate(() => { Object.defineProperty(child, "signalCode", { value: "SIGKILL", configurable: true }); child.emit("exit", null, "SIGKILL"); }); return true; };
  Object.defineProperty(child, "send", { value: () => true });
  const launch: typeof fork = () => child;
  return { child, launch };
}

test("process launch and startup failures propagate named errors and permit teardown", async () => {
  assert.throws(() => startGateProcess(launchOptions, () => { throw new Error("private-password"); }), /process-launch: failed/);
  const { child, launch } = fakeChild();
  const process = startGateProcess(launchOptions, launch);
  child.emit("message", { event: "startup-failed", body: "private-password" });
  await assert.rejects(process.ready, /startup: failed/);
  await process.stop(); assert.equal(child.signalCode, "SIGKILL");
});

test("child launch cannot load product dotenv configuration or a database URL override", async () => {
  const { child } = fakeChild();
  const launch: typeof fork = (_modulePath, _args?: readonly string[] | ForkOptions, options?: ForkOptions) => {
    assert.equal(options?.env?.DATABASE_CLIENT, "postgres");
    assert.equal(options?.env?.DATABASE_URL, "");
    assert.equal(options?.env?.DATABASE_SCHEMA, "public");
    assert.match(options?.env?.ENV_PATH ?? "", /no-product-env$/);
    return child;
  };
  const process = startGateProcess(launchOptions, launch);
  child.emit("message", { event: "ready" }); await process.ready;
  await process.kill();
});

test("nonzero exit rejects in-flight commands and barriers without exposing child output", async () => {
  const { child, launch } = fakeChild();
  const process = startGateProcess(launchOptions, launch);
  child.emit("message", { event: "ready" }); await process.ready;
  const request = process.request({ op: "identity" });
  const barrier = process.barrier("claim");
  Object.defineProperty(child, "exitCode", { value: 7 }); child.emit("exit", 7, null);
  await assert.rejects(request, /process-nonzero: failed/);
  await assert.rejects(barrier, /process-nonzero: failed/);
  await process.stop();
});

test("process deadline kills a child stuck during startup", async () => {
  const { child, launch } = fakeChild();
  const process = startGateProcess({ ...launchOptions, timeoutMs: 20 }, launch);
  await assert.rejects(process.ready, /process-timeout/);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(child.signalCode, "SIGKILL");
  await process.stop();
});

test("hung graceful shutdown falls back to a bounded forced exit", async () => {
  const { child, launch } = fakeChild();
  const process = startGateProcess({ ...launchOptions, timeoutMs: 5000 }, launch);
  child.emit("message", { event: "ready" }); await process.ready;
  await process.stop(); assert.equal(child.signalCode, "SIGKILL");
});

test("partial startup cleanup attempts every child and the owned database even when one close fails", async () => {
  const closed: string[] = [];
  await assert.rejects(cleanupGateResources([
    { stage: "first-child", close: async () => { closed.push("first"); } },
    { stage: "failed-child", close: async () => { closed.push("second"); throw new Error("private-password"); } },
    { stage: "database", close: async () => { closed.push("database"); } },
    { stage: "admin", close: async () => { closed.push("admin"); } },
  ]), /cleanup: failed/);
  assert.deepEqual(closed, ["first", "second", "database", "admin"]);
});

test("a database resource is registered before CREATE completes, so timed-out creation can still be cleaned", async () => {
  let resolveCreation!: () => void;
  const statements: string[] = [];
  let resource: { name: string; close(): Promise<void> } | undefined;
  const creation = provisionGateDatabase({ query: async (s) => {
    statements.push(s);
    if (s.startsWith("CREATE")) await new Promise<void>((resolve) => { resolveCreation = resolve; });
  } }, (owned) => { resource = owned; });
  assert.ok(resource);
  const cleanup = resource.close();
  assert.equal(statements.length, 1);
  resolveCreation(); await creation; await cleanup;
  assert.equal(statements[1], `DROP DATABASE "${resource.name}" WITH (FORCE)`);
});

const liveEnv = {
  KEYCLOAK_BASE_URL: "http://localhost:8080", KEYCLOAK_REALM: "idambox", KEYCLOAK_ISSUER: "http://localhost:8080/realms/idambox",
  KEYCLOAK_ADMIN_CLIENT_ID: "gate-admin", KEYCLOAK_ADMIN_CLIENT_SECRET: "private-admin-secret",
  IAM_LIVE_CLIENT_ID: "idambox-csrm", IAM_LIVE_CLIENT_SECRET: "private-client-secret",
  IAM_LIVE_REDIRECT_URI: "http://localhost:3000/api/auth/callback/keycloak",
  IAM_LIVE_FIXTURE_PREFIX: "iam-gate-unit", IAM_LIVE_FIXTURE_EMAIL_DOMAIN: "gate.test",
};

function liveRuntime(failAt?: keyof LiveGateRuntime) {
  const calls: string[] = [];
  function call(name: keyof LiveGateRuntime) {
    calls.push(name);
    if (failAt === name) throw new Error("private-admin-secret private-token private-password person@gate.test");
  }
  const runtime: LiveGateRuntime = {
    async prepare() { call("prepare"); },
    async session() { call("session"); return { linked: true, active: true, authenticated: true, sessions: 1 }; },
    async stop() { call("stop"); },
    async deactivate() { call("deactivate"); return { inactive: true, pending: true, refused: true, signedTokenValid: true }; },
    async retry() { call("retry"); },
    async start() { call("start"); },
    async recover() { call("recover"); return { disabled: true, sessions: 0, completed: true }; },
    async close() { call("close"); },
  };
  return { runtime, calls };
}

test("live configuration requires every environment value and refuses unsafe or foreign fixture boundaries", async () => {
  assert.equal(readLiveGateConfig(liveEnv).clientId, "idambox-csrm");
  for (const key of Object.keys(liveEnv)) {
    assert.throws(() => readLiveGateConfig({ ...liveEnv, [key]: "" }), /live-config: failed/);
  }
  for (const change of [{ KEYCLOAK_BASE_URL: "http://secret@localhost:8080" }, { KEYCLOAK_BASE_URL: "http://remote.test:8080" },
    { KEYCLOAK_BASE_URL: "http://localhost:18080" }, { KEYCLOAK_BASE_URL: "http://localhost:8080/other" },
    { KEYCLOAK_ISSUER: "http://localhost:8080/realms/other" }, { IAM_LIVE_CLIENT_ID: "other" },
    { IAM_LIVE_REDIRECT_URI: "http://remote.test/callback" }, { IAM_LIVE_FIXTURE_PREFIX: "jane" },
    { IAM_LIVE_FIXTURE_EMAIL_DOMAIN: "invalid" }]) {
    assert.throws(() => readLiveGateConfig({ ...liveEnv, ...change }), /live-config: failed/);
  }
  await assert.rejects(runIamLiveKeycloakGate(["--timeout-seconds", "600"], {}, () => {}), /live-config/);
  await assert.rejects(runIamLiveKeycloakGate(["--timeout-seconds", "30"], liveEnv, () => {}), /live-timeout-budget/);
});

test("live success requires session before outage, durable inactivity before retry, then recovery and finally restoration", async () => {
  const { runtime, calls } = liveRuntime(); const lines: string[] = [];
  await executeLiveGate(runtime, new GateDeadline(1000), (line) => lines.push(line));
  assert.deepEqual(calls, ["prepare", "session", "stop", "deactivate", "retry", "start", "recover", "start", "close"]);
  assert.deepEqual(lines.map((line) => JSON.parse(line).stage), ["live-setup", "live-session", "live-stop", "live-inactive-refusal",
    "live-outage-retry", "live-start", "live-recovery", "live-restore", "live-cleanup"]);
});

test("missing, synthetic, inactive or unlinked pre-outage sessions cannot reach stop", async () => {
  for (const change of [{ sessions: 0 }, { sessions: -1 }, { sessions: 0.5 }, { authenticated: false }, { linked: false }, { active: false }]) {
    const { runtime, calls } = liveRuntime();
    runtime.session = async () => ({ linked: true, active: true, authenticated: true, sessions: 1, ...change });
    await assert.rejects(executeLiveGate(runtime, new GateDeadline(1000), () => {}), /live-session/);
    assert.deepEqual(calls, ["prepare", "close"]);
  }
});

test("every live stage failure is redacted, restored after any stop attempt and cleaned", async () => {
  for (const name of ["prepare", "session", "stop", "deactivate", "retry", "start", "recover", "close"] as const) {
    const { runtime, calls } = liveRuntime(name); const lines: string[] = [];
    await assert.rejects(executeLiveGate(runtime, new GateDeadline(1000), (line) => lines.push(line)), (error: unknown) => {
      assert.ok(error instanceof GateFailure);
      assert.doesNotMatch(error.message, /private|person@/); return true;
    });
    assert.equal(calls.at(-1), "close");
    if (!["prepare", "session"].includes(name)) assert.ok(calls.slice(calls.indexOf("stop") + 1).includes("start"));
    assert.doesNotMatch(lines.join("\n"), /secret|password|token|person@/);
    assert.equal(lines.some((line) => JSON.parse(line).stage === "live-recovery"), name === "close");
  }
});

test("each local and remote mandatory assertion fails closed independently", async () => {
  for (const change of [{ inactive: false }, { pending: false }, { refused: false }, { signedTokenValid: false }]) {
    const { runtime, calls } = liveRuntime();
    runtime.deactivate = async () => ({ inactive: true, pending: true, refused: true, signedTokenValid: true, ...change });
    await assert.rejects(executeLiveGate(runtime, new GateDeadline(1000), () => {}), /live-inactive-refusal/);
    assert.equal(calls.includes("recover"), false); assert.equal(calls.at(-1), "close");
  }
  for (const change of [{ disabled: false }, { sessions: 1 }, { completed: false }]) {
    const { runtime } = liveRuntime();
    runtime.recover = async () => ({ disabled: true, sessions: 0, completed: true, ...change });
    await assert.rejects(executeLiveGate(runtime, new GateDeadline(1000), () => {}), /live-recovery/);
  }
});

test("stalled stop uses an independent restoration budget and restoration failure never passes", async () => {
  const { runtime, calls } = liveRuntime();
  runtime.stop = async () => { calls.push("stop"); await new Promise(() => {}); };
  await assert.rejects(executeLiveGate(runtime, new GateDeadline(20), () => {}, 1000), /live-stop: timeout/);
  assert.deepEqual(calls, ["prepare", "session", "stop", "start", "close"]);
  const failed = liveRuntime("start");
  await assert.rejects(executeLiveGate(failed.runtime, new GateDeadline(1000), () => {}), /live-restoration/);
  assert.equal(failed.calls.at(-1), "close");
});

test("a caller-supplied failure stage cannot enter live evidence or errors", async () => {
  const { runtime } = liveRuntime();
  runtime.session = async () => { throw new GateFailure("private-token"); };
  const lines: string[] = [];
  await assert.rejects(executeLiveGate(runtime, new GateDeadline(1000), (line) => lines.push(line)),
    (error: unknown) => error instanceof GateFailure && error.stage === "live-session" && !error.message.includes("private-token"));
  assert.doesNotMatch(lines.join("\n"), /private-token/);
});

test("stalled restoration retains an independent child and fixture cleanup budget", async () => {
  const { runtime, calls } = liveRuntime();
  runtime.start = async () => { calls.push("start"); await new Promise(() => {}); };
  await assert.rejects(executeLiveGate(runtime, new GateDeadline(20), () => {}, 40), /live-restoration/);
  assert.equal(calls.at(-1), "close");
  assert.equal(calls.filter((call) => call === "start").length, 2);
});

test("live startup, launch and nonzero child failures reject without serializing child details", async () => {
  assert.throws(() => startIsolatedGateChild("unused", {}, 1000, () => { throw new Error("private-token"); }), /live-process-launch/);
  for (const event of ["startup", "exit", "timeout"]) {
    const { child, launch } = fakeChild();
    const live = startIsolatedGateChild("unused", {}, event === "timeout" ? 20 : 1000, launch);
    if (event === "startup") child.emit("message", { event: "failed", body: "private-token" });
    if (event === "exit") { Object.defineProperty(child, "exitCode", { value: 7 }); child.emit("exit", 7); }
    await assert.rejects(live.ready, /live-process: failed/);
    await live.close();
  }
});

test("compose arguments operate only on idp keycloak using the repository compose file", () => {
  const appDir = path.resolve("apps/backend");
  for (const action of ["stop", "start"] as const) {
    assert.deepEqual(keycloakComposeArgs(action, appDir), ["compose", "--project-name", "idp", "--file",
      path.resolve("docker/docker-compose.yaml"), action, "keycloak"]);
  }
});

test("isolated live child inherits no parent provisioning flags or product configuration", async () => {
  const saved = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
  process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = "parent-secret";
  try {
    const env = isolatedGateEnvironment({ DATABASE_CLIENT: "sqlite", IDAMBOX_KEYCLOAK_PROVISIONING: "false" });
    assert.equal(env.KEYCLOAK_ADMIN_CLIENT_SECRET, undefined);
    assert.equal(env.IDAMBOX_KEYCLOAK_PROVISIONING, "false");
  } finally {
    if (saved === undefined) delete process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
    else process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = saved;
  }
  const { child, launch } = fakeChild();
  const live = startIsolatedGateChild("unused", { env: {} }, 1000, launch);
  child.emit("message", { event: "ready" }); await live.ready;
  const command = live.request({ op: "setup" });
  child.emit("message", { id: 1, ok: false, body: "private-token" });
  await assert.rejects(command, /live-child-command: failed/);
  await live.close(); assert.equal(child.signalCode, "SIGKILL");
});

test("PKCE session uses ordinary login form/cookies, state validation and authorization_code with a matching S256 verifier", async () => {
  const config = readLiveGateConfig(liveEnv);
  let authorization: URL | undefined; let tokenCalls = 0;
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/auth")) {
      authorization = url;
      assert.equal(url.searchParams.get("client_id"), "idambox-csrm");
      assert.equal(url.searchParams.get("response_type"), "code");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      return new Response('<form id="kc-form-login" action="http://localhost:8080/login?execution=1&amp;tab_id=2"><input type="hidden" name="session" value="form-session"></form>',
        { headers: { "set-cookie": "AUTH_SESSION_ID=private-cookie; Path=/" } });
    }
    if (url.pathname === "/login") {
      assert.equal(init?.method, "POST"); assert.equal(url.searchParams.get("tab_id"), "2");
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("username"), "gate-human"); assert.equal(body.get("password"), "private-password");
      assert.equal(body.get("session"), "form-session");
      assert.match(new Headers(init?.headers).get("cookie") ?? "", /AUTH_SESSION_ID=private-cookie/);
      return new Response(null, { status: 302, headers: { location: `${config.redirectUri}?code=private-code&state=${authorization!.searchParams.get("state")}` } });
    }
    assert.ok(url.pathname.endsWith("/token")); tokenCalls++;
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "private-code"); assert.equal(body.get("client_secret"), config.clientSecret);
    assert.equal(body.get("redirect_uri"), config.redirectUri);
    assert.equal(createHash("sha256").update(body.get("code_verifier")!).digest("base64url"), authorization!.searchParams.get("code_challenge"));
    assert.equal(body.has("password"), false);
    return Response.json({ access_token: "private-token" });
  };
  assert.equal(await establishPkceSession(config, "gate-human", "private-password", transport), "private-token");
  assert.equal(tokenCalls, 1);
});

test("login rejects unexpected form origins, callback states and failed exchanges without a direct grant fallback", async () => {
  const config = readLiveGateConfig(liveEnv);
  for (const kind of ["origin", "state", "exchange", "missing-token", "required-action"]) {
    let auth: URL | undefined; const grants: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth")) {
        auth = url;
        return new Response(`<form id="kc-form-login" action="${kind === "origin" ? "http://remote.test" : "http://localhost:8080"}/login"></form>`);
      }
      if (url.pathname === "/login") {
        if (kind === "required-action") return new Response("update profile");
        return new Response(null, { status: 302, headers: { location: `${config.redirectUri}?code=secret&state=${kind === "state" ? "wrong" : auth!.searchParams.get("state")}` } });
      }
      assert.ok(url.pathname.endsWith("/token"));
      grants.push(new URLSearchParams(String(init?.body)).get("grant_type")!);
      return Response.json(kind === "missing-token" ? {} : { error: "private-error" }, { status: kind === "exchange" ? 400 : 200 });
    };
    await assert.rejects(establishPkceSession(config, "gate-human", "private-password", transport));
    assert.ok(grants.every((grant) => grant === "authorization_code"));
  }
});

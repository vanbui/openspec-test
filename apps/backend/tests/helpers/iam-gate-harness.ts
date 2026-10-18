import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { startGateProcess, type GateProcess, type GateIdentity } from "./iam-process-runner";
import { startFakeKeycloakServer } from "./fake-keycloak-server";
import { fork, execFile, type ForkOptions } from "node:child_process";

export class GateFailure extends Error {
  readonly stage: string;
  constructor(stage: string, readonly reason: "failed" | "timeout" = "failed") {
    const safeStage = /^[a-z0-9-]+$/.test(stage) ? stage : "gate";
    super(`${safeStage}: ${reason}`);
    this.stage = safeStage;
  }
}

/** Fixed outage boundary: never operate on another project or a dependency service. */
export function keycloakComposeArgs(action: "stop" | "start", appDir: string): string[] {
  if (action !== "stop" && action !== "start") throw new GateFailure("compose-action");
  return ["compose", "--project-name", "idp", "--file", path.resolve(appDir, "../../docker/docker-compose.yaml"), action, "keycloak"];
}

export async function composeKeycloak(action: "stop" | "start", appDir: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile("docker", keycloakComposeArgs(action, appDir), { timeout: timeoutMs, windowsHide: true, maxBuffer: 64 * 1024 },
      (error) => error ? reject(new GateFailure(`compose-${action}`)) : resolve());
  });
}

/** Child environment contains only OS essentials and explicit isolated fixture settings. */
export function isolatedGateEnvironment(values: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...values };
}

/** Register before awaiting ready; suppress stdout/stderr and send only closed failures over IPC. */
export function startIsolatedGateChild(modulePath: string, options: ForkOptions, timeoutMs: number, launch: typeof fork = fork) {
  let child: ReturnType<typeof fork>;
  try { child = launch(modulePath, ["--live-child"], { ...options, stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: [] }); }
  catch { throw new GateFailure("live-process-launch"); }
  let readyResolve!: () => void; let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  void ready.catch(() => {});
  let sequence = 0;
  let failed = false;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  function fail() {
    failed = true; const error = new GateFailure("live-process"); readyReject(error);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  child.on("error", fail);
  const timer = setTimeout(() => { fail(); child.kill("SIGKILL"); }, timeoutMs);
  child.on("exit", () => { clearTimeout(timer); fail(); });
  child.on("message", (message: { event?: string; id?: number; ok?: boolean; value?: unknown }) => {
    if (message.event === "ready") readyResolve();
    if (message.event === "failed") fail();
    if (typeof message.id === "number") {
      const request = pending.get(message.id); pending.delete(message.id);
      if (request) message.ok ? request.resolve(message.value) : request.reject(new GateFailure("live-child-command"));
    }
  });
  async function request<T>(command: Record<string, unknown>): Promise<T> {
    if (failed || !child.connected) throw new GateFailure("live-process");
    const id = ++sequence;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      child.send({ id, command }, (error) => { if (error) fail(); });
    });
  }
  return { ready, request, async close() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const graceful = new GateDeadline(1500);
    try { await graceful.run("live-shutdown", () => request({ op: "shutdown" })); } catch { /* Forced exit below. */ }
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve, reject) => {
      const killTimer = setTimeout(() => reject(new GateFailure("live-kill", "timeout")), 5000);
      child.once("exit", () => { clearTimeout(killTimer); resolve(); });
      child.kill("SIGKILL");
    });
  } };
}

export class GateDeadline {
  private readonly end: number;
  constructor(milliseconds: number) { this.end = Date.now() + milliseconds; }
  remaining() { return Math.max(1, this.end - Date.now()); }
  async run<T>(stage: string, work: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (Date.now() >= this.end) throw new GateFailure(stage, "timeout");
      return await Promise.race([work(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GateFailure(stage, "timeout")), this.remaining());
      })]);
    } catch (error) {
      throw error instanceof GateFailure ? error : new GateFailure(stage);
    } finally { clearTimeout(timer); }
  }
}

export type GateConnection = { host: string; port: number; user: string; password: string; database: string };
export function readGateConnection(env: NodeJS.ProcessEnv): GateConnection {
  const { IAM_PG_GATE_HOST: host, IAM_PG_GATE_PORT: port, IAM_PG_GATE_USER: user,
    IAM_PG_GATE_PASSWORD: password } = env;
  const database = env.IAM_PG_GATE_ADMIN_DB ?? env.IAM_PG_GATE_DB;
  // Fail closed: this helper can only connect to the dedicated, loopback-bound Compose service.
  if ((env.DATABASE_CLIENT && env.DATABASE_CLIENT !== "postgres") || env.DATABASE_URL
    || !["127.0.0.1", "localhost"].includes(host ?? "") || port !== "15432" || !user || !password || !database
    || /midpoint/i.test(`${user} ${database}`) || database === env.MIDPOINT_DB_NAME
    || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(database)) throw new GateFailure("connection-config");
  return { host: host!, port: 15432, user, password, database };
}

export function assertGateProcesses(identities: GateIdentity[], database: string, launchedPids?: number[]): void {
  if (identities.length !== 2 || !/^iam_gate_[a-z0-9_]+$/.test(database)) throw new GateFailure("two-process-identity");
  const [a, b] = identities;
  if (!identities.every((i) => Number.isInteger(i.pid) && i.pid > 0 && i.pid !== process.pid
    && Number.isInteger(i.backendPid) && i.backendPid > 0 && i.dialect === "postgres" && i.database === database
    && typeof i.address === "string" && i.address.length > 0 && i.port === 5432)
    || a.pid === b.pid || a.backendPid === b.backendPid || a.address !== b.address || a.port !== b.port
    || (launchedPids && (launchedPids.length !== 2 || identities.some((i, index) => i.pid !== launchedPids[index])))) {
    throw new GateFailure("two-process-identity");
  }
}

export function assertGateDatabaseBoundary(databaseNames: string[], adminDatabase: string, midpointDatabase?: string) {
  if (!databaseNames.includes(adminDatabase) || databaseNames.some((name) => /midpoint/i.test(name)
    || (!!midpointDatabase && name.toLowerCase() === midpointDatabase.toLowerCase()))) {
    throw new GateFailure("database-boundary");
  }
}

export function evidenceLine(stage: string, data: Record<string, unknown> = {}): string {
  if (!/^[a-z0-9-]+$/.test(stage)) throw new GateFailure("evidence-format");
  const safe: Record<string, unknown> = { stage };
  for (const key of ["pid", "pids", "database", "passed", "indexes", "schema"] as const) {
    const value = data[key];
    if (key === "pid" && Number.isSafeInteger(value)) safe[key] = value;
    if (key === "pids" && Array.isArray(value) && value.every(Number.isSafeInteger)) safe[key] = value;
    if (key === "passed" && typeof value === "boolean") safe[key] = value;
    if (key === "database" && typeof value === "string" && /^iam_gate_[a-z0-9_]+$/.test(value)) safe[key] = value;
    if (key === "schema" && ["fresh", "reused"].includes(String(value))) safe[key] = value;
    if (key === "indexes" && Array.isArray(value) && value.every((v) => typeof v === "string" && /^[a-z0-9_]{1,63}$/.test(v))) safe[key] = value;
  }
  return JSON.stringify(safe);
}

type AdminClient = { query(statement: string): Promise<unknown> };
type OwnedDatabase = { name: string; close(): Promise<void> };
export async function provisionGateDatabase(admin: AdminClient, register?: (database: OwnedDatabase) => void) {
  const name = `iam_gate_${randomUUID().replace(/-/g, "")}`;
  const creation = admin.query(`CREATE DATABASE "${name}"`);
  let closed = false;
  const database = { name, async close() {
    if (closed) return;
    try { await creation; } catch { return; }
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    closed = true;
  } };
  register?.(database);
  await creation;
  return database;
}

export async function cleanupGateResources(resources: Array<{ stage: string; close(): Promise<void> }>, timeoutMs = 15_000) {
  const cleanup = new GateDeadline(timeoutMs);
  let failed = false;
  for (const resource of resources) {
    try { await cleanup.run(resource.stage, () => resource.close()); } catch { failed = true; }
  }
  if (failed) throw new GateFailure("cleanup");
}

/** Resources are registered before awaiting startup so partial launches are also cleaned up. */
export async function createIamGateHarness(connection: GateConnection, deadline: GateDeadline) {
  const appDir = path.resolve(__dirname, "../../../..");
  const children: GateProcess[] = [];
  let remote: Awaited<ReturnType<typeof startFakeKeycloakServer>> | undefined;
  let database: Awaited<ReturnType<typeof provisionGateDatabase>> | undefined;
  let admin: { connect(): Promise<void>; query(s: string): Promise<unknown>; end(): Promise<void> } | undefined;
  const fixtureDir = path.join(appDir, ".tmp", `iam-gate-${randomUUID()}`);
  async function close() {
    await cleanupGateResources([
      ...children.map((child) => ({ stage: "cleanup-process", close: () => child.stop() })),
      { stage: "cleanup-remote", close: async () => { await remote?.close(); } },
      { stage: "cleanup-database", close: async () => { await database?.close(); } },
      { stage: "cleanup-admin", close: async () => { await admin?.end(); } },
      { stage: "cleanup-fixtures", close: () => rm(fixtureDir, { force: true, recursive: true }) },
    ]);
  }
  try {
    const driver = await deadline.run("driver", async () => {
      require.resolve("pg");
      return require("pg") as { Client: new (config: GateConnection & { connectionTimeoutMillis: number; query_timeout: number; statement_timeout: number; ssl: false; options: string }) => NonNullable<typeof admin> };
    });
    const statementTimeout = Math.min(deadline.remaining(), 10_000);
    admin = new driver.Client({ ...connection, connectionTimeoutMillis: statementTimeout,
      statement_timeout: statementTimeout, query_timeout: statementTimeout + 500, ssl: false, options: "" });
    // The dedicated service is started by the operator. No Docker operations occur here.
    await deadline.run("database-connect", () => admin!.connect());
    await deadline.run("database-boundary", async () => {
      const result = await admin!.query("SELECT datname FROM pg_database") as { rows: Array<{ datname: string }> };
      assertGateDatabaseBoundary(result.rows.map((row) => row.datname), connection.database, process.env.MIDPOINT_DB_NAME);
    });
    database = await deadline.run("database-create", () => provisionGateDatabase(admin!, (owned) => { database = owned; }));
    await mkdir(fixtureDir, { recursive: true });
    remote = await startFakeKeycloakServer();
    const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
    const compiled = await deadline.run("compile", () => runtime.compileStrapi({ appDir }));
    assert.ok(compiled.distDir);
    const dbName = database.name;
    async function launch() {
      const child = startGateProcess({ appDir, distDir: compiled.distDir!, fixtureDir, connection: { ...connection, database: dbName },
        remoteUrl: remote!.baseUrl, timeoutMs: deadline.remaining() });
      children.push(child);
      await deadline.run("startup", () => child.ready);
      return child;
    }
    // Sequential schema boots prevent Strapi's general schema synchronizer racing itself.
    const a = await launch(); const b = await launch();
    const identities = await Promise.all([a.request<GateIdentity>({ op: "identity" }), b.request<GateIdentity>({ op: "identity" })]);
    assertGateProcesses(identities, dbName, [a.pid, b.pid]);
    return { a, b, remote, database: dbName, identities, deadline, launch, close };
  } catch (error) {
    try { await close(); } catch { throw new GateFailure("cleanup-after-startup-failure"); }
    throw error;
  }
}

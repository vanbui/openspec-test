import { fork, type ChildProcess } from "node:child_process";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import type { DeactivationClaim } from "../../src/iam/keycloak-sync/outbox";
import type { SourcePrincipal } from "../../src/iam/identity/source-principal";
import { GateFailure, type GateConnection } from "./iam-gate-harness";
import { FAKE_KEYCLOAK_CLIENT_ID, FAKE_KEYCLOAK_CLIENT_SECRET, FAKE_KEYCLOAK_REALM } from "./fake-keycloak-server";

export type GateIdentity = { pid: number; backendPid: number; database: string; address: string; port: number; dialect: string };
export type BarrierName = "claim" | "user-lock" | "remote-pair" | "acknowledgement";
export type GateCommand =
  | { op: "identity" | "setup" | "indexes" | "shutdown" | "restore-bindings" }
  | { op: "count-name"; name: string }
  | { op: "create"; name: string; manual?: boolean; off?: boolean; externalId?: string }
  | { op: "read" | "work" | "due" | "expire" | "hold-lock"; id: string }
  | { op: "mutate"; id: string; kind: "patch" | "replace" | "deactivate" | "delete" | "manual" | "claim" | "roles" | "content-manager" | "protect" | "manual-delete"; name?: string; active?: boolean; failQueue?: boolean }
  | { op: "claim"; slot: string }
  | { op: "fence"; slot: string; wrongGeneration?: boolean }
  | { op: "worker" | "start-worker" | "stop-worker" }
  | { op: "arm" | "release"; barrier: BarrierName }
  | { op: "bind-source"; serviceId: number; name: string }
  | { op: "service-target"; name: string }
  | { op: "bind-outbox"; id: string; target: string }
  | { op: "blocked"; pid: number };

export interface GateProcess {
  ready: Promise<void>;
  pid: number;
  request<T = unknown>(command: GateCommand): Promise<T>;
  barrier(name: BarrierName): Promise<void>;
  kill(): Promise<void>;
  stop(): Promise<void>;
}

type Launch = { appDir: string; distDir: string; fixtureDir: string; connection: GateConnection; remoteUrl: string; timeoutMs: number };
type Reply = { id?: number; ok?: boolean; value?: unknown; event?: string; barrier?: BarrierName };

export function startGateProcess(options: Launch, launch: typeof fork = fork): GateProcess {
  // Inherit only OS launch essentials. Product credentials, URL overrides and maintenance flags are excluded.
  const env: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT"]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  Object.assign(env, {
    ENV_PATH: path.join(options.fixtureDir, "no-product-env"),
    NODE_ENV: "development", CSRM_ENVIRONMENT: "development", STRAPI_DISABLE_UPDATE_NOTIFICATION: "true",
    APP_KEYS: "gate-key-1,gate-key-2", ADMIN_JWT_SECRET: "gate-admin", API_TOKEN_SALT: "gate-api",
    TRANSFER_TOKEN_SALT: "gate-transfer", ENCRYPTION_KEY: "gate-encryption", JWT_SECRET: "gate-jwt",
    DATABASE_CLIENT: "postgres", DATABASE_URL: "", DATABASE_SCHEMA: "public",
    DATABASE_HOST: options.connection.host, DATABASE_PORT: String(options.connection.port),
    DATABASE_NAME: options.connection.database, DATABASE_USERNAME: options.connection.user, DATABASE_PASSWORD: options.connection.password,
    DATABASE_SSL: "false", DATABASE_POOL_MIN: "0", DATABASE_POOL_MAX: "8", DATABASE_CONNECTION_TIMEOUT: "10000",
    IDAMBOX_SEED_CORE: "false", IDAMBOX_SEED_CSRM: "false", IDAMBOX_SEED_IAM: "false",
    IDAMBOX_KEYCLOAK_PROVISIONING: "false", IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false",
    CSRM_ATTACHMENT_STORAGE: "local", CSRM_ATTACHMENT_LOCAL_DIR: path.join(options.fixtureDir, "attachments"),
    CSRM_ATTACHMENT_SCANNER: "development",
    IAM_GATE_APP: options.appDir, IAM_GATE_DIST: options.distDir, IAM_GATE_REMOTE: options.remoteUrl,
  });
  let child: ChildProcess;
  try { child = launch(__filename, ["--child"], { cwd: options.appDir, env, stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: [] }); }
  catch { throw new GateFailure("process-launch"); }
  let sequence = 0;
  let failed = false;
  let readyResolve!: () => void; let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  // Avoid unhandled startup rejection when a launch is registered before awaiting readiness.
  void ready.catch(() => {});
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const arrivals = new Set<BarrierName>();
  const waits = new Map<BarrierName, Array<{ resolve(): void; reject(error: Error): void }>>();
  const fail = (stage: string) => {
    failed = true;
    const error = new GateFailure(stage);
    readyReject(error);
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    for (const entries of waits.values()) for (const entry of entries) entry.reject(error);
    waits.clear();
  };
  child.on("error", () => fail("process-launch"));
  child.on("exit", (code) => { clearTimeout(timer); fail(code === 0 ? "process-exited" : "process-nonzero"); });
  child.on("message", (message: Reply) => {
    if (message.event === "ready") readyResolve();
    else if (message.event === "startup-failed") fail("startup");
    else if (message.event === "barrier" && message.barrier) {
      arrivals.add(message.barrier);
      for (const entry of waits.get(message.barrier) ?? []) entry.resolve();
      waits.delete(message.barrier);
    } else if (typeof message.id === "number") {
      const entry = pending.get(message.id); pending.delete(message.id);
      if (entry) message.ok ? entry.resolve(message.value) : entry.reject(new GateFailure("child-command"));
    }
  });
  const timer = setTimeout(() => { fail("process-timeout"); child.kill("SIGKILL"); }, options.timeoutMs);
  async function request<T>(command: GateCommand): Promise<T> {
    if (failed || !child.connected) throw new GateFailure("process-unavailable");
    if (command.op === "arm") arrivals.delete(command.barrier);
    const id = ++sequence;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      child.send({ id, command }, (error) => { if (error) fail("process-send"); });
    });
  }
  async function kill() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new GateFailure("process-kill", "timeout")), 5000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
      child.kill("SIGKILL");
    });
  }
  return { ready, pid: child.pid ?? -1, request,
    barrier: (name) => arrivals.has(name) ? Promise.resolve() : failed ? Promise.reject(new GateFailure("process-unavailable"))
      : new Promise<void>((resolve, reject) => { waits.set(name, [...(waits.get(name) ?? []), { resolve, reject }]); }),
    kill,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        await Promise.race([request({ op: "shutdown" }), new Promise<never>((_, reject) => setTimeout(() => reject(new GateFailure("process-stop", "timeout")), 1500))]);
      } catch { /* Force teardown of blocked database or remote operations. */ }
      await kill();
    },
  };
}

const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";

async function runChild() {
  let strapi: Core.Strapi | undefined;
  const send = (message: Reply) => process.send?.(message);
  try {
    if (process.env.DATABASE_CLIENT !== "postgres" || process.env.DATABASE_PORT !== "15432"
      || !/^iam_gate_[a-f0-9]{32}$/.test(process.env.DATABASE_NAME ?? "") || !process.send) throw new GateFailure("child-config");
    const runtime = require("@strapi/strapi") as typeof import("@strapi/strapi");
    process.env.PGAPPNAME = `iam-gate-${process.pid}`;
    const distDir = process.env.IAM_GATE_DIST!;
    const load = <T>(file: string): T => require(path.join(distDir, "src", file)) as T;
    const outbox = load<typeof import("../../src/iam/keycloak-sync/outbox")>("iam/keycloak-sync/outbox");
    const worker = load<typeof import("../../src/iam/keycloak-sync/worker")>("iam/keycloak-sync/worker");
    const locks = load<typeof import("../../src/iam/identity/user-lock")>("iam/identity/user-lock");
    const invariants = load<typeof import("../../src/iam/identity/database-invariants")>("iam/identity/database-invariants");
    strapi = await runtime.createStrapi({ appDir: process.env.IAM_GATE_APP!, distDir }).load();
    strapi.cron?.destroy();
    const instance = strapi;
    const service = load<typeof import("../../src/iam/identity/identity-service")>("iam/identity/identity-service").createIdentityService(instance);
    const principals = load<typeof import("../../src/iam/identity/source-principal")>("iam/identity/source-principal");
    const registration = load<typeof import("../../src/iam/identity/source-registration")>("iam/identity/source-registration");
    const { KeycloakAdminClient } = load<typeof import("../../src/keycloak/admin-client")>("keycloak/admin-client");
    const config = { pollMs: 5000, leaseMs: 60_000, attemptMs: 10_000, client: {
      baseUrl: process.env.IAM_GATE_REMOTE!, realm: FAKE_KEYCLOAK_REALM, adminClientId: FAKE_KEYCLOAK_CLIENT_ID,
      adminClientSecret: FAKE_KEYCLOAK_CLIENT_SECRET, requestTimeoutMs: 2000,
    } };
    const client = new KeycloakAdminClient(config.client);
    const middleware = load<typeof import("../../src/keycloak/register-idambox-user-provisioning")>("keycloak/register-idambox-user-provisioning")
      .createIdamboxUserProvisioningMiddleware(instance, client);
    const context = new AsyncLocalStorage<{ off?: boolean; failQueue?: boolean }>();
    instance.documents.use((ctx, next) => context.getStore()?.off ? next() : middleware(ctx, next));
    instance.documents.use((ctx, next) => {
      if (context.getStore()?.failQueue && ctx.uid === OUTBOX && ["create", "update"].includes(ctx.action)) throw new Error("GATE_ENQUEUE_FAILURE");
      return next();
    });
    let principal: SourcePrincipal | null = null;
    const barriers = new Map<BarrierName, { wait: Promise<void>; release(): void }>();
    const claims = new Map<string, DeactivationClaim>();
    const sourceBindings: Array<{ sourceId: number; serviceId: number }> = [];
    async function pause(name: BarrierName) {
      const barrier = barriers.get(name);
      send({ event: "barrier", barrier: name });
      if (barrier) await barrier.wait;
    }
    async function source() {
      if (!principal) {
        const found = await instance.documents("api::identity-source.identity-source").findFirst({ filters: { name: "Gate HR" } });
        if (!found) throw new Error("GATE_SOURCE_MISSING");
        principal = await principals.resolveSourcePrincipal(instance, found.documentId);
      }
      if (!principal) throw new Error("GATE_PRINCIPAL_MISSING");
      return principal;
    }
    const dto = (name: string, externalId = name) => ({ username: name, email: `${name}@gate.test`, displayName: name,
      sourceExternalId: externalId, accountStatus: "active" as const });
    function accepted(result: { ok: true; value: { documentId: string } } | { ok: false }) {
      return result.ok ? { ok: true, value: { documentId: result.value.documentId } } : { ok: false };
    }
    function work(id: string) { return instance.documents(OUTBOX).findFirst({ filters: { userDocumentId: id } }); }
    async function dispatch(command: GateCommand): Promise<unknown> {
      switch (command.op) {
        case "identity": {
          const result = await instance.db.connection.raw("select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port, pg_backend_pid() as backend_pid");
          return { pid: process.pid, backendPid: Number(result.rows[0].backend_pid), database: result.rows[0].database,
            address: result.rows[0].address, port: Number(result.rows[0].port), dialect: instance.db.dialect.client };
        }
        case "indexes": {
          await invariants.ensureIdentityDatabaseInvariants(instance);
          const names: string[] = [];
          for (const invariant of invariants.identityDatabaseLayout(instance).uniqueColumns) {
            const indexes = await instance.db.dialect.schemaInspector.getIndexes(invariant.table);
            const match = indexes.find((i) => i.type === "unique" && i.columns.length === 1 && i.columns[0] === invariant.column);
            if (!match) throw new Error("GATE_INDEX_MISSING");
            names.push(match.name);
          }
          return names;
        }
        case "setup": {
          const app = await instance.documents("api::application.application").create({ data: { name: "Gate IAM", slug: "idambox-iam", applicationStatus: "active" } });
          const fn = await instance.documents("api::function.function").create({ data: { name: "Identity Provisioning", application: app.documentId } });
          await instance.documents("api::role.role").create({ data: { name: "Identity Provisioning", functions: [fn.documentId] } });
          await context.run({ off: true }, () => registration.registerIdentitySource(instance, {
            name: "Gate HR", username: "gate-service", email: "gate-service@gate.test", displayName: "Gate HR",
          }));
          return true;
        }
        case "create": return context.run({ off: command.off }, async () => command.manual
          ? accepted({ ok: true, value: await instance.documents(USER).create({ data: { username: command.name, email: `${command.name}@gate.test`, displayName: command.name, accountStatus: "active", protected: false } }) })
          : accepted(await service.createFromSource(await source(), dto(command.name, command.externalId))));
        case "count-name": return instance.documents(USER).count({ filters: { username: command.name } });
        case "read": {
          const user = await instance.documents(USER).findOne({ documentId: command.id, populate: { identitySource: true } });
          return user && { documentId: user.documentId, accountStatus: user.accountStatus, externalSubject: user.externalSubject,
            fingerprint: createHash("sha256").update(JSON.stringify(user)).digest("hex") };
        }
        case "work": {
          const row = await work(command.id);
          return row && { documentId: row.documentId, syncStatus: row.syncStatus, generation: row.generation, attempts: row.attempts,
            nextAttemptAt: row.nextAttemptAt, lastErrorCode: row.lastErrorCode, leaseOwnerPresent: !!row.leaseOwner,
            count: await instance.documents(OUTBOX).count({ filters: { userDocumentId: command.id } }) };
        }
        case "due": case "expire": {
          const row = await work(command.id); if (!row) throw new Error("GATE_WORK_MISSING");
          await instance.documents(OUTBOX).update({ documentId: row.documentId, data: command.op === "due"
            ? { nextAttemptAt: "2000-01-01T00:00:00.000Z" } : { leaseExpiresAt: "2000-01-01T00:00:00.000Z" } }); return true;
        }
        case "mutate": return context.run({ failQueue: command.failQueue }, async () => {
          const data = { ...(command.active === undefined ? {} : { accountStatus: command.active ? "active" as const : "inactive" as const }), department: "Gate edit", displayName: "Gate edit" };
          if (command.kind === "manual") { await instance.documents(USER).update({ documentId: command.id, data }); return { ok: true }; }
          if (command.kind === "roles") { await instance.documents(USER).update({ documentId: command.id, data: { roles: [] } }); return { ok: true }; }
          if (command.kind === "manual-delete") { await instance.documents(USER).delete({ documentId: command.id }); return { ok: true }; }
          if (command.kind === "protect") {
            await load<typeof import("../../src/iam/identity/write-context")>("iam/identity/write-context").runManualProtection(instance, command.id, true);
            return { ok: true };
          }
          if (command.kind === "content-manager") {
            const manager = instance.plugin("content-manager").service("document-manager") as {
              update(id: string, uid: string, params: { data: Record<string, unknown> }): Promise<unknown>;
            };
            await manager.update(command.id, USER, { data: { roles: [] } }); return { ok: true };
          }
          const p = await source();
          if (command.kind === "patch") return accepted(await service.patchFromSource(p, command.id, data));
          if (command.kind === "replace" || command.kind === "claim") return accepted(await service.replaceFromSource(p, command.id,
            { ...dto(command.name!), ...data }));
          return accepted(await service.deactivateFromSource(p, command.id, command.kind === "delete"));
        });
        case "claim": {
          const claim = await outbox.claimDueDeactivation(instance); if (claim) claims.set(command.slot, claim);
          return claim ? { claimed: true, generation: claim.generation, attempts: claim.attempts, userDocumentId: claim.userDocumentId } : { claimed: false };
        }
        case "fence": {
          const original = claims.get(command.slot); if (!original) throw new Error("GATE_CLAIM_MISSING");
          const claim = command.wrongGeneration ? { ...original, generation: original.generation + 1 } : original;
          return locks.withIdentityUserLock(instance, claim.userDocumentId, async (trx) => [
            await outbox.completeClaim(instance, trx, claim), await outbox.retryClaim(instance, trx, claim, "KEYCLOAK_AUTH"),
            await outbox.cancelClaim(instance, trx, claim), await outbox.renewClaim(instance, trx, claim, 60_000),
          ]);
        }
        case "arm": {
          if (barriers.has(command.barrier)) throw new Error("GATE_BARRIER_ALREADY_ARMED");
          let release!: () => void;
          const wait = new Promise<void>((resolve) => { release = resolve; });
          barriers.set(command.barrier, { wait, release }); return true;
        }
        case "release": barriers.get(command.barrier)?.release(); barriers.delete(command.barrier); return true;
        case "start-worker": {
          worker.startKeycloakSyncWorker(instance, { IDAMBOX_KEYCLOAK_PROVISIONING: "true",
            KEYCLOAK_BASE_URL: config.client.baseUrl, KEYCLOAK_REALM: config.client.realm,
            KEYCLOAK_ADMIN_CLIENT_ID: config.client.adminClientId, KEYCLOAK_ADMIN_CLIENT_SECRET: config.client.adminClientSecret,
            IDAMBOX_KEYCLOAK_SYNC_POLL_MS: "10", IDAMBOX_KEYCLOAK_SYNC_LEASE_MS: String(config.leaseMs),
            IDAMBOX_KEYCLOAK_SYNC_ATTEMPT_MS: String(config.attemptMs),
          }, { client, afterClaim: async (claim) => { claims.set("worker", claim); await pause("claim"); } });
          return { boundMs: worker.workerShutdownMs(config) };
        }
        case "stop-worker": {
          const started = Date.now(); await worker.stopKeycloakSyncWorker(instance);
          return { elapsedMs: Date.now() - started };
        }
        case "worker": return worker.runOneDeactivation(instance, config, {
          random: () => 0, afterClaim: async (claim) => { claims.set("worker", claim); await pause("claim"); },
          client: { disableUser: async (subject, options) => { await pause("user-lock"); await client.disableUser(subject, options); },
            endUserSessions: async (subject, options) => { await client.endUserSessions(subject, options); await pause("remote-pair"); await pause("acknowledgement"); } },
        });
        case "hold-lock": return locks.withIdentityUserLock(instance, command.id, async () => { await pause("user-lock"); return true; });
        case "service-target": {
          const manifest = { name: command.name, username: command.name, email: `${command.name}@gate.test`, displayName: command.name };
          // This standalone target has no source binding yet.
          const user = await context.run({ off: true }, () => instance.documents(USER).create({ data: {
            username: manifest.username, email: manifest.email, displayName: manifest.displayName, accountStatus: "active", protected: false,
          } }));
          return user.id;
        }
        case "bind-source": {
          // Exercise the physical inverse-target uniqueness on the gate database, without bypassing public authorization.
          const layout = invariants.identityDatabaseLayout(instance);
          const sourceRow = await context.run({ off: true }, () => registration.registerIdentitySource(instance, {
            name: command.name, username: command.name, email: `${command.name}@gate.test`, displayName: command.name,
          }));
          sourceBindings.push({ sourceId: Number(sourceRow.id), serviceId: Number(sourceRow.serviceUser.id) });
          try {
            await instance.db.getConnection(layout.sourceServiceUser.name).where(layout.sourceServiceUser.joinColumn.name, sourceRow.id)
              .update({ [layout.sourceServiceUser.inverseJoinColumn.name]: command.serviceId }); return { rejected: false };
          } catch (error) { return { rejected: (error as { code?: string }).code === "23505" }; }
        }
        case "restore-bindings": {
          const layout = invariants.identityDatabaseLayout(instance);
          for (const binding of sourceBindings) {
            await instance.db.getConnection(layout.sourceServiceUser.name).where(layout.sourceServiceUser.joinColumn.name, binding.sourceId)
              .update({ [layout.sourceServiceUser.inverseJoinColumn.name]: binding.serviceId });
          }
          sourceBindings.length = 0; return true;
        }
        case "bind-outbox": {
          const layout = invariants.identityDatabaseLayout(instance);
          const row = await work(command.id); const target = await instance.documents(USER).findOne({ documentId: command.target });
          if (!row || !target) throw new Error("GATE_BINDING_MISSING");
          try {
            await instance.db.getConnection(layout.outboxUser.name).where(layout.outboxUser.joinColumn.name, row.id)
              .update({ [layout.outboxUser.inverseJoinColumn.name]: target.id });
            return { rejected: false };
          } catch (error) { return { rejected: (error as { code?: string }).code === "23505" }; }
        }
        case "blocked": {
          const result = await instance.db.connection.raw("select count(*)::int as count from pg_stat_activity where datname = current_database() and application_name = ? and wait_event_type = 'Lock'", [`iam-gate-${command.pid}`]);
          return Number(result.rows[0].count) > 0;
        }
        case "shutdown": for (const barrier of barriers.values()) barrier.release(); await instance.destroy(); return true;
        default: throw new Error("GATE_UNKNOWN_COMMAND");
      }
    }
    process.on("message", (message: { id: number; command: GateCommand }) => {
      if (!message || !Number.isSafeInteger(message.id) || !message.command || typeof message.command.op !== "string") return;
      void dispatch(message.command).then((value) => {
        send({ id: message.id, ok: true, value });
        if (message.command.op === "shutdown") setImmediate(() => process.exit(0));
      }, () => send({ id: message.id, ok: false }));
    });
    process.on("disconnect", () => process.exit(1));
    send({ event: "ready" });
  } catch {
    send({ event: "startup-failed" });
    try { await strapi?.destroy(); } finally { process.exit(1); }
  }
}

if (require.main === module && process.argv[2] === "--child") void runChild();

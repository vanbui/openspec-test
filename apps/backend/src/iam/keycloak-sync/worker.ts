import type { Core } from "@strapi/strapi";
import { KeycloakAdminClient, KeycloakRevocationError, type RevocationOptions } from "../../keycloak/admin-client";
import { withIdentityUserLock, checkCoordination } from "../identity/user-lock";
import { readKeycloakSyncConfig, type KeycloakSyncConfig } from "./config";
import { cancelClaim, claimDueDeactivation, completeClaim, renewClaim, retryClaim, type DeactivationClaim } from "./outbox";

const USER = "api::idambox-user.idambox-user";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
type RevocationClient = Pick<KeycloakAdminClient, "disableUser" | "endUserSessions">;
/** Internal dependencies support deterministic interleavings without request-controlled bypasses. */
export type WorkerDependencies = {
  client?: RevocationClient;
  claim?: typeof claimDueDeactivation;
  random?: () => number;
  afterClaim?: (claim: DeactivationClaim) => Promise<void>;
};

/** Each database statement/lock gets at most one sixteenth of remaining lease time, capped at 1 s.
 * Two coordination transactions and the remote attempt fit within the lease with headroom.
 */
export function workerCoordinationMs(config: KeycloakSyncConfig): number {
  return Math.max(1, Math.min(1000, Math.floor((config.leaseMs - config.attemptMs) / 16)));
}
/** Abort stops new steps; native database timeouts allow active queries to roll back.
 * The extra second allows rollback/connection release. A stalled injected dependency
 * cannot hold shutdown forever; its stopped worker stays registered until it settles.
 */
export function workerShutdownMs(config: KeycloakSyncConfig): number { return workerCoordinationMs(config) + 1000; }

export async function runOneDeactivation(strapi: Core.Strapi, config: KeycloakSyncConfig,
  dependencies: WorkerDependencies = {}, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  const bounds = { timeoutMs: workerCoordinationMs(config), signal };
  const claim = await (dependencies.claim ?? claimDueDeactivation)(strapi, config.leaseMs, bounds);
  if (signal?.aborted) return false;
  if (!claim) return false;
  await dependencies.afterClaim?.(claim);
  if (signal?.aborted) return false;
  // Claim has committed. No outbox lock is carried into this user-first transaction.
  await withIdentityUserLock(strapi, claim.userDocumentId, async (trx) => {
    if (signal?.aborted) return; // Leave the durable lease for restart recovery.
    const user = await strapi.documents(USER).findOne({ documentId: claim.userDocumentId });
    checkCoordination(signal);
    const work = await strapi.documents(OUTBOX).findFirst({ filters: { userDocumentId: claim.userDocumentId }, populate: { idamboxUser: true } });
    checkCoordination(signal);
    if (!work || work.id !== claim.id || work.generation !== claim.generation || work.leaseOwner !== claim.leaseOwner) return;
    // The conditional renewal uses current database time after lock waits, rejects expired owners and locks the outbox.
    if (!(await renewClaim(strapi, trx, claim, config.leaseMs))) return;
    checkCoordination(signal);
    if (!user || work.idamboxUser?.documentId !== user.documentId || user.accountStatus !== "inactive"
      || (user.externalSubject ?? null) !== (work.externalSubject ?? null)) {
      await cancelClaim(strapi, trx, claim); return;
    }
    if (!work.externalSubject) { await completeClaim(strapi, trx, claim); return; }
    const client = dependencies.client ?? new KeycloakAdminClient(config.client);
    const options: RevocationOptions = { deadline: Date.now() + config.attemptMs,
      signal: AbortSignal.any([AbortSignal.timeout(config.attemptMs), ...(signal ? [signal] : [])]) };
    try {
      await client.disableUser(work.externalSubject, options);
      checkCoordination(signal);
      await client.endUserSessions(work.externalSubject, options);
      checkCoordination(signal);
      await completeClaim(strapi, trx, claim);
    } catch (error) {
      checkCoordination(signal);
      const code = error instanceof KeycloakRevocationError ? error.code : "KEYCLOAK_UNAVAILABLE";
      if (await retryClaim(strapi, trx, claim, code, dependencies.random)) {
        strapi.log.warn(`iam.keycloak_sync: ${code}; pending retry.`);
      }
    }
  }, bounds);
  return true;
}

type Worker = { timer?: ReturnType<typeof setTimeout>; inFlight?: Promise<void>; stopped: boolean; controller: AbortController; shutdownMs: number };
const workers = new WeakMap<object, Worker>();

export function startKeycloakSyncWorker(strapi: Core.Strapi, env: Record<string, string | undefined> = process.env,
  dependencies: WorkerDependencies = {}): void {
  if (workers.has(strapi)) return;
  const config = readKeycloakSyncConfig(env);
  if (!config) return; // No client, timer or token request in off mode.
  const worker: Worker = { stopped: false, controller: new AbortController(), shutdownMs: workerShutdownMs(config) };
  workers.set(strapi, worker);
  let client: RevocationClient | undefined = dependencies.client;
  const tick = () => {
    if (worker.stopped) return;
    worker.inFlight = (async () => {
      try {
        await runOneDeactivation(strapi, config, { ...dependencies,
          // Lazy construction also keeps subjectless work client-free.
          client: { disableUser: (subject, options) => (client ??= new KeycloakAdminClient(config.client)).disableUser(subject, options),
            endUserSessions: (subject, options) => (client ??= new KeycloakAdminClient(config.client)).endUserSessions(subject, options) } }, worker.controller.signal);
      } catch {
        strapi.log.warn("iam.keycloak_sync: coordination unavailable; durable work retained.");
      } finally {
        if (worker.stopped) workers.delete(strapi);
        else worker.timer = setTimeout(tick, config.pollMs);
      }
    })();
  };
  worker.timer = setTimeout(tick, config.pollMs);
}

export async function stopKeycloakSyncWorker(strapi: Core.Strapi): Promise<void> {
  const worker = workers.get(strapi);
  if (!worker) return;
  worker.stopped = true; clearTimeout(worker.timer); worker.controller.abort();
  if (!worker.inFlight) { workers.delete(strapi); return; }
  const drained = worker.inFlight.finally(() => {
    // A previously completed tick also needs removal when stop occurs during its poll delay.
    if (workers.get(strapi) === worker) workers.delete(strapi);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([drained, new Promise<void>((resolve) => {
      timer = setTimeout(() => { strapi.log.warn("iam.keycloak_sync: shutdown bound reached; durable lease retained."); resolve(); }, worker.shutdownMs);
    })]);
  } finally { clearTimeout(timer); }
  // Settlement removes the entry; do not allow a second worker meanwhile.
}

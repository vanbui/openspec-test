import { AsyncResource } from "node:async_hooks";
import type { Core } from "@strapi/strapi";
import { KeycloakAdminClient } from "../../keycloak/admin-client";
import { readKeycloakProvisioningConfig } from "../../keycloak/config";
import { passwordSetupEvent, readPasswordSetupEligibility, sendPasswordSetupEmail, untilAborted,
  type PasswordSetupClient, type PasswordSetupTarget } from "./service";

export type PasswordSetupDispatcher = {
  enqueue(target: PasswordSetupTarget): void;
  stop(): Promise<void>;
};
const instances = new WeakMap<Core.Strapi, PasswordSetupDispatcher>();
type DispatcherOptions = { timeoutMs?: number; log?: (event: string) => void;
  schedule?: (callback: () => void) => NodeJS.Immediate };

/** Create only at ordinary boot, outside all request/source transaction authority. */
export function createPasswordSetupDispatcher(attempt: (target: PasswordSetupTarget, signal: AbortSignal) => Promise<void>,
  options: DispatcherOptions = {}): PasswordSetupDispatcher {
  const resource = new AsyncResource("iam.passwordSetup");
  const queued = new Map<NodeJS.Immediate, PasswordSetupTarget>();
  const active = new Map<AbortController, Promise<void>>();
  const log = options.log ?? (() => undefined);
  let stopped = false;
  return {
    enqueue(input) {
      const target = Object.freeze({ userDocumentId: input.userDocumentId, sourceDocumentId: input.sourceDocumentId });
      try {
        if (stopped) { passwordSetupEvent(log, target, "skipped", "shutdown"); return; }
        const handle = (options.schedule ?? setImmediate)(() => {
          queued.delete(handle);
          if (stopped) return;
          resource.runInAsyncScope(() => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
            const work = untilAborted(Promise.resolve().then(() => attempt(target, controller.signal)), controller.signal)
              .catch(() => {
                // The bounded email service reports abort itself, including unresolved reads.
                if (!controller.signal.aborted) passwordSetupEvent(log, target, "failed", "unavailable");
              })
              .finally(() => { clearTimeout(timer); active.delete(controller); });
            active.set(controller, work);
          });
        });
        queued.set(handle, target);
      } catch { passwordSetupEvent(log, target, "failed", "scheduling"); }
    },
    async stop() {
      stopped = true;
      for (const [handle, target] of queued) { clearImmediate(handle); passwordSetupEvent(log, target, "skipped", "shutdown"); }
      queued.clear();
      for (const controller of active.keys()) controller.abort();
      await Promise.all(active.values());
      resource.emitDestroy();
    },
  };
}

export function startPasswordSetupDispatcher(strapi: Core.Strapi,
  env: Record<string, string | undefined> = process.env,
  createClient: (config: NonNullable<ReturnType<typeof readKeycloakProvisioningConfig>>) => PasswordSetupClient = config => new KeycloakAdminClient(config),
  options: Pick<DispatcherOptions, "schedule"> = {}): boolean {
  if (instances.has(strapi)) return true;
  const config = readKeycloakProvisioningConfig(env);
  if (!config) return false;
  const client = createClient(config);
  const log = (event: string) => strapi.log.info(event);
  instances.set(strapi, createPasswordSetupDispatcher((target, signal) => sendPasswordSetupEmail(target, signal, {
    read: target => readPasswordSetupEligibility(strapi, target), client, log,
  }), { ...options, timeoutMs: Math.min(config.requestTimeoutMs, 5000), log }));
  return true;
}

/** Register from inside the existing source lock. Hook and scheduling failures never escape. */
export async function registerPasswordSetupAfterCommit(strapi: Core.Strapi, target: PasswordSetupTarget): Promise<void> {
  const dispatcher = instances.get(strapi);
  if (!dispatcher) return;
  try {
    await strapi.db.transaction(async ({ onCommit }) => {
      onCommit(() => {
        try { dispatcher.enqueue(target); }
        catch { passwordSetupEvent(event => strapi.log.info(event), target, "failed", "scheduling"); }
      });
    });
  } catch { passwordSetupEvent(event => strapi.log.info(event), target, "failed", "registration"); }
}

export async function stopPasswordSetupDispatcher(strapi: Core.Strapi): Promise<void> {
  const instance = instances.get(strapi);
  instances.delete(strapi);
  await instance?.stop();
}

import type { Core } from "@strapi/strapi";
import { isRegisteredSourceServiceUser } from "../identity/source-principal";
import { KeycloakAdminClient } from "../../keycloak/admin-client";
import { readKeycloakProvisioningConfig } from "../../keycloak/config";

export type PasswordSetupTarget = Readonly<{ userDocumentId: string; sourceDocumentId: string }>;
export type PasswordSetupClient = {
  executeActionsEmail(subject: string, actions: readonly ["UPDATE_PASSWORD"], signal: AbortSignal): Promise<void>;
};
type Eligibility = { externalSubject: string };
export type PasswordSetupDependencies = {
  read(target: PasswordSetupTarget): Promise<Eligibility | null>;
  client: PasswordSetupClient;
  log(event: string): void;
};
type Reason = "accepted" | "ineligible" | "unavailable" | "timeout" | "scheduling" | "registration" | "shutdown";
export type PasswordSetupResult = Readonly<{ outcome: "sent" | "failed" | "skipped";
  reason: Reason | "disabled" | "configuration" }>;
type AttemptResult = Readonly<{ outcome: "sent" | "failed" | "skipped"; reason: Reason }>;

/** Construct diagnostics from a closed allowlist; never serialize an exception or remote data. */
export function passwordSetupEvent(log: (event: string) => void, target: PasswordSetupTarget,
  outcome: "sent" | "failed" | "skipped", reason: Reason, trigger: "create" | "operator" = "create"): void {
  try {
    const validId = (value: string) => /^[a-z0-9]{24}$/.test(value);
    if (!validId(target.userDocumentId) || !validId(target.sourceDocumentId)) return;
    const result = log(JSON.stringify({ event: "iam.password_setup_email", userDocumentId: target.userDocumentId,
      sourceDocumentId: target.sourceDocumentId, trigger, outcome, reason }));
    void Promise.resolve(result).catch(() => undefined);
  } catch { /* Diagnostics cannot change committed identity outcomes. */ }
}

/** Bound even adapters which ignore abort; late resolutions/rejections are always observed. */
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error("PASSWORD_SETUP_ABORTED"));
    if (signal.aborted) { void work.catch(() => undefined); abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    work.then(value => { signal.removeEventListener("abort", abort); resolve(value); },
      () => { signal.removeEventListener("abort", abort); reject(new Error("PASSWORD_SETUP_UNAVAILABLE")); });
  });
}

export async function readPasswordSetupEligibility(strapi: Core.Strapi, target: PasswordSetupTarget): Promise<Eligibility | null> {
  const user = await strapi.documents("api::idambox-user.idambox-user").findOne({
    documentId: target.userDocumentId,
    fields: ["documentId", "accountStatus", "protected", "sourceDeletedAt", "sourceExternalId", "sourceIdentityKey", "externalSubject"],
    populate: { identitySource: { fields: ["documentId"] } },
  });
  if (!user || user.protected !== false || user.accountStatus !== "active" || user.sourceDeletedAt != null
    || user.identitySource?.documentId !== target.sourceDocumentId || !user.sourceExternalId || !user.sourceIdentityKey
    || typeof user.externalSubject !== "string" || !user.externalSubject.trim()
    || await isRegisteredSourceServiceUser(strapi, target.userDocumentId)) return null;
  return { externalSubject: user.externalSubject };
}

export async function sendPasswordSetupEmail(target: PasswordSetupTarget, signal: AbortSignal,
  dependencies: PasswordSetupDependencies): Promise<void> {
  await attemptPasswordSetupEmail(target, signal, dependencies, "create");
}

async function attemptPasswordSetupEmail(target: PasswordSetupTarget, signal: AbortSignal,
  dependencies: PasswordSetupDependencies, trigger: "create" | "operator"): Promise<AttemptResult> {
  let result: AttemptResult;
  try {
    const user = await untilAborted(dependencies.read(target), signal);
    if (!user) result = { outcome: "skipped", reason: "ineligible" };
    else {
      if (signal.aborted) throw new Error("PASSWORD_SETUP_ABORTED");
      await untilAborted(dependencies.client.executeActionsEmail(user.externalSubject, ["UPDATE_PASSWORD"], signal), signal);
      result = { outcome: "sent", reason: "accepted" };
    }
  } catch {
    result = { outcome: "failed", reason: signal.aborted ? "timeout" : "unavailable" };
  }
  passwordSetupEvent(dependencies.log, target, result.outcome, result.reason, trigger);
  return result;
}

/** Explicit recovery for unsent, uncertain or expired invitations. Prior-link invalidation requires a contract probe. */
export async function resendPasswordSetupEmail(strapi: Core.Strapi, userDocumentId: string, options: {
  env?: Record<string, string | undefined>;
  createClient?: (config: NonNullable<ReturnType<typeof readKeycloakProvisioningConfig>>) => PasswordSetupClient;
  log?: (event: string) => void;
} = {}): Promise<PasswordSetupResult> {
  if (!/^[a-z0-9]{24}$/.test(userDocumentId)) return { outcome: "skipped", reason: "ineligible" };
  let config: ReturnType<typeof readKeycloakProvisioningConfig>;
  try { config = readKeycloakProvisioningConfig(options.env); }
  catch { return { outcome: "failed", reason: "configuration" }; }
  if (!config) return { outcome: "skipped", reason: "disabled" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.requestTimeoutMs, 5000));
  let target: PasswordSetupTarget | undefined;
  const log = options.log ?? ((event: string) => strapi.log.info(event));
  try {
    const user = await untilAborted(strapi.documents("api::idambox-user.idambox-user").findOne({
      documentId: userDocumentId, fields: ["documentId"], populate: { identitySource: { fields: ["documentId"] } },
    }), controller.signal);
    const sourceDocumentId = user?.identitySource?.documentId;
    if (typeof sourceDocumentId !== "string" || !/^[a-z0-9]{24}$/.test(sourceDocumentId)) {
      return { outcome: "skipped", reason: "ineligible" };
    }
    target = { userDocumentId, sourceDocumentId };
    return await attemptPasswordSetupEmail(target, controller.signal, {
      read: target => readPasswordSetupEligibility(strapi, target),
      client: (options.createClient ?? (config => new KeycloakAdminClient(config)))(config), log,
    }, "operator");
  } catch {
    const reason = controller.signal.aborted ? "timeout" : "unavailable";
    if (target) passwordSetupEvent(log, target, "failed", reason, "operator");
    return { outcome: "failed", reason };
  } finally { clearTimeout(timer); }
}

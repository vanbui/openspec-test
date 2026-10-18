import type { Core } from "@strapi/strapi";
import { resolveSourcePrincipal, validateSourcePrincipal, type SourcePrincipal } from "../identity/source-principal";
import { ERROR_URN, SCIM_MEDIA_TYPE, scimFailure, type ScimFailure, type ScimOutcome } from "./errors";
import { recordSourceActivity } from "./source-activity";
import { parseSourceToken, verifySourceTokenDigest } from "./token-service";

export type SourceRequest = { request: { header?: Record<string, unknown> } };
// Koa and its policy wrapper share the request object. No caller-controlled state carries authority.
const contexts = new WeakMap<object, { strapi: Core.Strapi; principal: SourcePrincipal; digest: string }>();
const SOURCE = "api::identity-source.identity-source";
const USER = "api::idambox-user.idambox-user";

export function sourceAuthenticationFailure(): ScimFailure {
  return { ok: false, error: { status: 401,
    headers: { "Content-Type": SCIM_MEDIA_TYPE, "WWW-Authenticate": "Bearer" },
    body: { schemas: [ERROR_URN], status: "401", detail: "Bearer authentication is required." },
  } };
}

function bearer(context: SourceRequest): string | null {
  const authorization = context.request.header?.authorization;
  if (typeof authorization !== "string") return null;
  const match = /^Bearer +([^ ]+)$/i.exec(authorization);
  if (!match) return null;
  const token = match[1];
  return parseSourceToken(token) ? token : null;
}

/** Server-only accessor: forged/copyable state and principals issued by another instance are ignored. */
export function getSourceContext(strapi: Core.Strapi, context: SourceRequest): SourcePrincipal | null {
  const issued = contexts.get(context.request);
  return issued?.strapi === strapi ? issued.principal : null;
}

/** Invoke after the IP budget and before source budget, grants, parsing or user transactions. */
export async function authenticateSourceRequest(strapi: Core.Strapi, context: SourceRequest): Promise<ScimOutcome<SourcePrincipal>> {
  contexts.delete(context.request);
  try {
    const token = bearer(context);
    const parsed = parseSourceToken(token);
    const source = parsed ? await strapi.documents(SOURCE).findOne({ documentId: parsed.sourceDocumentId }) : null;
    if (!verifySourceTokenDigest(token, source?.tokenHash) || !parsed) return sourceAuthenticationFailure();
    const principal = await resolveSourcePrincipal(strapi, parsed.sourceDocumentId);
    if (!principal) return sourceAuthenticationFailure();
    await recordSourceActivity(strapi, principal);
    contexts.set(context.request, { strapi, principal, digest: source!.tokenHash! });
    return { ok: true, value: principal };
  } catch {
    return scimFailure("unexpected");
  }
}

type OperationUser = { roles?: Array<{ name?: string; functions?: Array<{
  name?: string; application?: { slug?: string; applicationStatus?: string };
  functionApis?: Array<{ url?: string }>;
}> }> };

/** Explicit route policy checks persistence again; it cannot mint authority from a bearer or hints. */
export async function requireSourceOperation(strapi: Core.Strapi, context: SourceRequest,
  operation: string): Promise<ScimOutcome<SourcePrincipal>> {
  try {
    const issued = contexts.get(context.request);
    if (!issued || issued.strapi !== strapi) return sourceAuthenticationFailure();
    const token = bearer(context);
    const parsed = parseSourceToken(token);
    if (parsed?.sourceDocumentId !== issued.principal.sourceDocumentId) return sourceAuthenticationFailure();
    const source = await strapi.documents(SOURCE).findOne({ documentId: issued.principal.sourceDocumentId });
    if (!verifySourceTokenDigest(token, issued.digest) || !verifySourceTokenDigest(token, source?.tokenHash)
      || !await validateSourcePrincipal(strapi, issued.principal)) return sourceAuthenticationFailure();
    if (typeof operation !== "string" || !/^(GET|POST|PUT|PATCH|DELETE):\/scim\/v2\//.test(operation)) return scimFailure("forbidden");
    const user = await strapi.documents(USER).findOne({ documentId: issued.principal.serviceUserDocumentId,
      populate: { roles: { populate: { functions: { populate: { application: true, functionApis: true } } } } },
    }) as OperationUser | null;
    const granted = user?.roles?.some(role => role.name === "Identity Provisioning"
      && role.functions?.some(fn => fn.name === "Identity Provisioning" && fn.application?.slug === "idambox-iam"
        && fn.application.applicationStatus === "active" && fn.functionApis?.some(api => api.url === operation)));
    return granted ? { ok: true, value: issued.principal } : scimFailure("forbidden");
  } catch {
    return scimFailure("unexpected");
  }
}

import { randomUUID } from "node:crypto";
import type { Core } from "@strapi/strapi";
import { readScimConfig, type ScimConfig } from "../iam/scim/config";
import { createScimLimiter } from "../iam/scim/limiter";
import { authenticateSourceRequest, sourceAuthenticationFailure } from "../iam/scim/source-context";
import { ERROR_URN, SCIM_MEDIA_TYPE, scimFailure, type ScimErrorResponse, type ScimErrorCode } from "../iam/scim/errors";
import { CORE_USER_URN, ENTERPRISE_USER_URN, GROUP_URN } from "../iam/scim/wire";

type BodyParser = Exclude<ReturnType<ReturnType<Core.Strapi["middleware"]>>, void>;
export type ScimBoundaryContext = Parameters<BodyParser>[0];
type Next = () => Promise<unknown>;
const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const ordinaryParserMethods = new Set(["POST", "PUT", "PATCH"]);
const schemaIds = new Set([CORE_USER_URN, ENTERPRISE_USER_URN, GROUP_URN]);
const typeCodes: Record<string, ScimErrorCode> = {
  invalidValue: "invalidInput", invalidSyntax: "syntax", invalidFilter: "filter", invalidPath: "path",
  noTarget: "noTarget", mutability: "forbiddenWrite", uniqueness: "uniqueness",
};

function namespace(path: string): boolean { return path === "/scim/v2" || path.startsWith("/scim/v2/"); }

/** Return only fixed route templates and identifiers with a closed grammar. */
function operation(context: ScimBoundaryContext): { operation: string; target: string | null } {
  const method = methods.has(context.method) ? context.method : "OTHER";
  const fallback = { operation: `${method}:/scim/v2`, target: null };
  const match = /^\/scim\/v2\/(Users|Groups|Schemas|ResourceTypes|ServiceProviderConfig)(?:\/([^/]+))?$/.exec(context.path);
  if (!match) return fallback;
  const [, collection, rawId] = match;
  if (!rawId) return { operation: `${method}:/scim/v2/${collection}`, target: null };
  let id: string;
  try { id = decodeURIComponent(rawId); } catch { return fallback; }
  const valid = collection === "Schemas" ? schemaIds.has(id)
    : collection === "ResourceTypes" ? id === "User" || id === "Group"
    : (collection === "Users" || collection === "Groups") && /^[a-z0-9]{24}$/.test(id);
  return valid ? { operation: `${method}:/scim/v2/${collection}/:id`, target: id } : fallback;
}

const JSON_MEDIA_TYPE = "application/json";
/** Quality the Accept header gives one media type, from its most specific matching range. */
function quality(raw: string, target: string): number {
  let specificity = -1;
  let result = 0;
  for (const part of raw.toLowerCase().split(",")) {
    const [media, ...parameters] = part.trim().split(";").map(value => value.trim());
    const rank = media === target ? 2 : media === "application/*" ? 1 : media === "*/*" ? 0 : -1;
    if (rank < 0) continue;
    const q = parameters.find(value => value.startsWith("q="))?.slice(2) ?? "1";
    const value = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q) ? Number(q) : 0;
    if (rank > specificity) { specificity = rank; result = value; }
    else if (rank === specificity) result = Math.max(result, value);
  }
  return result;
}
/**
 * RFC 7644 section 8.1: answer application/scim+json, and also serve clients that accept only
 * application/json (the pinned SCIM2 connector sends `Accept: application/json`). Null means 406.
 */
function negotiate(raw: string): string | null {
  if (!raw) return SCIM_MEDIA_TYPE;
  if (quality(raw, SCIM_MEDIA_TYPE) > 0) return SCIM_MEDIA_TYPE;
  return quality(raw, JSON_MEDIA_TYPE) > 0 ? JSON_MEDIA_TYPE : null;
}

function transportError(status: 406 | 413 | 415 | 429, retryAfter?: number): ScimErrorResponse {
  const detail = { 406: "The response media type is not acceptable.", 413: "The request body exceeds the permitted size.",
    415: "The request media type is unsupported.", 429: "The request limit has been reached." }[status];
  return { status, headers: { "Content-Type": SCIM_MEDIA_TYPE,
    ...(retryAfter === undefined ? {} : { "Retry-After": String(retryAfter) }) },
    body: { schemas: [ERROR_URN], status: String(status), detail } };
}

/** Rebuild diagnostics from a closed vocabulary; never trust an exception's body, message or headers. */
function closedError(status: number, body?: unknown): ScimErrorResponse {
  if (status === 401) return sourceAuthenticationFailure().error;
  if (status === 406 || status === 413 || status === 415 || status === 429) return transportError(status, status === 429 ? 60 : undefined);
  const scimType = body && typeof body === "object" && "scimType" in body ? body.scimType : undefined;
  const code = typeof scimType === "string" && Object.prototype.hasOwnProperty.call(typeCodes, scimType) ? typeCodes[scimType] : undefined;
  if (code && scimFailure(code).error.status === status) return scimFailure(code).error;
  const codes: Record<number, ScimErrorCode> = { 400: "syntax", 403: "forbidden", 404: "notFound", 409: "uniqueness", 501: "groupWrite", 503: "keycloakUnavailable" };
  return scimFailure(codes[status] ?? "unexpected").error;
}
function apply(context: ScimBoundaryContext, response: ScimErrorResponse): void {
  context.status = response.status;
  context.body = response.body;
  for (const [key, value] of Object.entries(response.headers)) context.set(key, value);
}
function outcome(status: number): string {
  if (status < 400) return "success";
  return ({ 400: "invalid", 401: "denied", 403: "denied", 404: "not_found", 406: "invalid", 409: "conflict",
    413: "invalid", 415: "invalid", 429: "throttled", 501: "unsupported", 503: "unavailable" } as Record<number, string>)[status] ?? "failure";
}

export default function scimBoundary(config: { limits?: ScimConfig }, { strapi }: { strapi: Core.Strapi }) {
  const limiter = createScimLimiter(config.limits ?? readScimConfig());
  // The installed parser normally reads POST/PUT/PATCH with a 1 MiB default.
  // Reuse the same parser for bodies on other SCIM methods without changing CSRM configuration.
  const parseOtherMethods = strapi.middleware("strapi::body")({ jsonLimit: 1_048_576,
    parsedMethods: ["GET", "HEAD", "DELETE"], multipart: false, urlencoded: false, text: false }, { strapi });
  if (typeof parseOtherMethods !== "function") throw new Error("SCIM requires the installed body parser.");
  return async (context: ScimBoundaryContext, next: Next): Promise<void> => {
    if (!namespace(context.path)) { await next(); return; }
    const requestId = randomUUID();
    let source: string | null = null;
    // Errors raised before negotiation (401, 415, 429) answer in the SCIM media type.
    let responseType = SCIM_MEDIA_TYPE;
    const originalIs = context.is;
    try {
      const ip = limiter.ip(context.ip);
      if (!ip.allowed) { apply(context, transportError(429, ip.retryAfter)); return; }
      const authenticated = await authenticateSourceRequest(strapi, context);
      if (!authenticated.ok) { apply(context, authenticated.error); return; }
      source = authenticated.value.sourceDocumentId;
      const budget = limiter.source(source);
      if (!budget.allowed) { apply(context, transportError(429, budget.retryAfter)); return; }
      const media = context.get("content-type").split(";", 1)[0].trim().toLowerCase();
      const length = context.get("content-length");
      const hasBody = Boolean(context.get("transfer-encoding")) || length !== "" && length !== "0";
      if ((media || hasBody || ordinaryParserMethods.has(context.method)) && media !== SCIM_MEDIA_TYPE && media !== "application/json") {
        apply(context, transportError(415)); return;
      }
      const negotiated = negotiate(context.get("accept"));
      if (!negotiated) { apply(context, transportError(406)); return; }
      responseType = negotiated;
      if (length && Number(length) > 1_048_576) { apply(context, transportError(413)); return; }
      // koa-body 6 has a fixed JSON media list. Adapt only its request-local type predicate;
      // preserve headers, URL and all unrelated requests and parser settings.
      context.is = function (...types) {
        const jsonRequested = types.flat().includes("application/json");
        return media === SCIM_MEDIA_TYPE && jsonRequested ? "application/json" : originalIs.call(this, types.flat());
      };
      if (hasBody && !ordinaryParserMethods.has(context.method)) {
        // The parser's method enum excludes OPTIONS and extension methods. A local view
        // lets it bound their bodies too, without rewriting the real request method.
        const parserContext: ScimBoundaryContext = Object.create(context);
        Object.defineProperty(parserContext, "method", { value: "GET" });
        await parseOtherMethods(parserContext, async () => {});
      }
      await next();
      if (context.status >= 400) {
        const response = closedError(context.status, context.body);
        apply(context, response);
      }
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
      const body = error && typeof error === "object" && "body" in error ? error.body : undefined;
      apply(context, closedError(status, body));
    } finally {
      context.is = originalIs;
      if (context.status === 204) { context.body = null; context.remove("Content-Type"); }
      else if (context.body !== null && context.body !== undefined) context.type = responseType;
      strapi.log.info(JSON.stringify({ event: "scim.request", source, ...operation(context),
        outcome: outcome(context.status), status: context.status, requestId }));
    }
  };
}

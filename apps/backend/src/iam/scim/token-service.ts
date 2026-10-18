import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Core } from "@strapi/strapi";
import { resolveSourcePrincipal } from "../identity/source-principal";
import { withSourceLock } from "./source-lock";

export type SourceTokenAction = "issue" | "rotate" | "revoke";
export type SourceTokenResult = { sourceDocumentId: string; tokenRotatedAt: string } &
  ({ action: "issue" | "rotate"; token: string } | { action: "revoke" });
const SOURCE = "api::identity-source.identity-source";
const DUMMY_DIGEST = Buffer.alloc(32);

export function parseSourceToken(token: unknown): { sourceDocumentId: string } | null {
  if (typeof token !== "string" || token.length !== 80) return null;
  const match = /^idb_scim_v1\.([a-z0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Buffer.from(match[2], "base64url").toString("base64url") !== match[2]) return null;
  return { sourceDocumentId: match[1] };
}

/** Hash every exact UTF-8 byte, including the version and source lookup component. */
export function hashSourceToken(token: string): string {
  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

/** Missing source/hash takes the same fixed-buffer comparison path and always fails. */
export function verifySourceTokenDigest(token: unknown, digest: unknown): boolean {
  const parsed = parseSourceToken(token);
  const validDigest = typeof digest === "string" && digest.length === 71 && /^sha256:[a-f0-9]{64}$/.test(digest);
  const stored = validDigest ? Buffer.from(digest.slice(7), "hex") : DUMMY_DIGEST;
  const candidate = parsed ? Buffer.from(hashSourceToken(token as string).slice(7), "hex") : DUMMY_DIGEST;
  const equal = timingSafeEqual(candidate, stored);
  return parsed !== null && validDigest && equal;
}

async function selectSource(strapi: Core.Strapi, selector: string) {
  if (typeof selector !== "string" || !selector) throw new Error("IAM_SCIM_SOURCE_NOT_FOUND");
  const exact = await strapi.documents(SOURCE).findOne({ documentId: selector });
  if (exact) return exact;
  const named = await strapi.documents(SOURCE).findMany({ filters: { name: { $eq: selector } }, limit: 2 });
  if (named.length > 1) throw new Error("IAM_SCIM_SOURCE_AMBIGUOUS");
  if (named.length !== 1 || named[0].name !== selector) throw new Error("IAM_SCIM_SOURCE_NOT_FOUND");
  return named[0];
}

/** Trusted backend administration only. Plaintext is returned once and is never logged or persisted. */
export async function administerSourceToken(strapi: Core.Strapi, sourceSelector: string,
  action?: SourceTokenAction): Promise<SourceTokenResult> {
  if (action !== undefined && !["issue", "rotate", "revoke"].includes(action)) throw new Error("IAM_SCIM_TOKEN_INVALID_ACTION");
  const selected = await selectSource(strapi, sourceSelector);
  return withSourceLock(strapi, selected.documentId, async (_trx, onCommit) => {
    const source = await selectSource(strapi, sourceSelector);
    if (source.documentId !== selected.documentId) throw new Error("IAM_SCIM_SOURCE_CHANGED");
    const operation = action ?? (source.tokenHash == null ? "issue" : "rotate");
    if (operation === "issue" && source.tokenHash != null || operation === "rotate" && source.tokenHash == null) {
      throw new Error("IAM_SCIM_TOKEN_PRECONDITION");
    }
    if (operation !== "revoke" && !await resolveSourcePrincipal(strapi, source.documentId)) {
      throw new Error("IAM_SCIM_SOURCE_INVALID_BINDING");
    }
    const tokenRotatedAt = new Date().toISOString();
    const token = operation === "revoke" ? undefined
      : `idb_scim_v1.${source.documentId}.${randomBytes(32).toString("base64url")}`;
    if (token && !parseSourceToken(token)) throw new Error("IAM_SCIM_SOURCE_INVALID_DOCUMENT_ID");
    // The generated scalar input omits null although this optional persisted field supports clearing.
    const data = { tokenHash: token === undefined ? null : hashSourceToken(token), tokenRotatedAt };
    await strapi.documents(SOURCE).update({ documentId: source.documentId,
      data: data as Parameters<ReturnType<typeof strapi.documents<typeof SOURCE>>["update"]>[0]["data"] });
    onCommit(() => {
      strapi.log.info(JSON.stringify({ event: "scim.token", sourceDocumentId: source.documentId, action: operation, outcome: "success" }));
    });
    const metadata = { sourceDocumentId: source.documentId, tokenRotatedAt };
    return operation === "revoke" ? { ...metadata, action: operation }
      : { ...metadata, action: operation, token: token! };
  });
}

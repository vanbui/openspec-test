import { createHash } from "node:crypto";

export const SOURCE_IDENTITY_FIELDS = ["username", "email", "firstName", "lastName", "displayName", "accountStatus",
  "sourceExternalId", "employeeNumber", "department", "jobTitle"] as const;
export const HR_FIELDS = SOURCE_IDENTITY_FIELDS.filter((field) => field !== "sourceExternalId");
export type SourceIdentityInput = {
  username: string; email: string; displayName: string; accountStatus: "active" | "inactive"; sourceExternalId: string;
  firstName?: string | null; lastName?: string | null; employeeNumber?: string | null; department?: string | null; jobTitle?: string | null;
};
export type IdentityInputMode = "create" | "replace" | "patch";
export type IdentityPatchInput = Partial<SourceIdentityInput>;
export type IdentityOutcome<T = unknown> = { ok: true; value: T } | IdentityFailure;
export type IdentityFailure =
  | { ok: false; code: "forbidden" | "notFound" | "uniqueness" | "immutableSourceKey" | "invalidInput" }
  | { ok: false; code: "keycloakUnavailable"; retryAfterSeconds: 30 };

/** Safe closed outcomes never accept caller details, credentials or remote messages. */
export function identityFailure(code: IdentityFailure["code"]): IdentityFailure {
  return code === "keycloakUnavailable" ? { ok: false, code, retryAfterSeconds: 30 } : { ok: false, code };
}
export function isSourceExternalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255 && value.trim().length > 0;
}
export function deriveSourceIdentityKey(persistedSourceDocumentId: string, exactSourceExternalId: string): string {
  if (typeof persistedSourceDocumentId !== "string" || !persistedSourceDocumentId || !isSourceExternalId(exactSourceExternalId)) {
    throw new Error("IAM_IDENTITY_INVALID_INPUT");
  }
  return createHash("sha256").update(JSON.stringify([persistedSourceDocumentId, exactSourceExternalId]), "utf8").digest("hex");
}

type ConflictReader = {
  db: { inTransaction(): boolean };
  documents(uid: string): { findMany(params: unknown): Promise<unknown[]> };
};
/** Call after a failed transaction has rolled back; never probe an aborted PostgreSQL transaction. */
export async function resolveIdentityUniqueness(strapi: ConflictReader, sourceDocumentId: string,
  sourceExternalId: string): Promise<IdentityFailure> {
  if (strapi.db.inTransaction()) throw new Error("IAM_IDENTITY_TRANSACTION_ACTIVE");
  const sourceIdentityKey = deriveSourceIdentityKey(sourceDocumentId, sourceExternalId);
  const matches = await strapi.documents("api::idambox-user.idambox-user").findMany({
    filters: { sourceIdentityKey }, fields: ["sourceExternalId"], populate: { identitySource: { fields: ["documentId"] } }, limit: 2,
  }) as Array<{ sourceExternalId?: string | null; identitySource?: { documentId: string } | null }>;
  // A matching hash is a reservation, never permission to adopt a different tuple.
  if (matches.some((user) => user.sourceExternalId !== sourceExternalId || user.identitySource?.documentId !== sourceDocumentId)) {
    return identityFailure("immutableSourceKey");
  }
  return identityFailure("uniqueness");
}
export function parseSourceIdentityInput(input: unknown, mode: "patch"): IdentityOutcome<IdentityPatchInput>;
export function parseSourceIdentityInput(input: unknown, mode?: "create" | "replace"): IdentityOutcome<SourceIdentityInput>;
export function parseSourceIdentityInput(input: unknown, mode: IdentityInputMode = "create"): IdentityOutcome<IdentityPatchInput> {
  if (!input || typeof input !== "object" || Array.isArray(input) || !["create", "replace", "patch"].includes(mode)) return identityFailure("invalidInput");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some((key) => !SOURCE_IDENTITY_FIELDS.some((field) => field === key))) return identityFailure("invalidInput");
  const required = ["username", "email", "displayName", "accountStatus", "sourceExternalId"];
  if (mode !== "patch" && required.some((field) => !Object.prototype.hasOwnProperty.call(data, field))) return identityFailure("invalidInput");
  const output: Record<string, unknown> = {};
  for (const field of SOURCE_IDENTITY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      if (mode === "replace" && !required.includes(field)) output[field] = null;
      continue;
    }
    const value = data[field];
    if (field === "sourceExternalId") { if (!isSourceExternalId(value)) return identityFailure("invalidInput"); }
    else if (field === "accountStatus") { if (value !== "active" && value !== "inactive") return identityFailure("invalidInput"); }
    else if (value === null && !required.includes(field)) { /* explicit clear */ }
    else if (typeof value !== "string" || value.length > 255 || (required.includes(field) && !value.trim())) return identityFailure("invalidInput");
    if (field === "email" && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return identityFailure("invalidInput");
    output[field] = value;
  }
  return { ok: true, value: output as IdentityPatchInput };
}

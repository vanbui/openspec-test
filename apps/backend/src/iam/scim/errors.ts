import type { IdentityFailure } from "../identity/identity-input";

export const ERROR_URN = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_MEDIA_TYPE = "application/scim+json";
type ScimType = "invalidValue" | "invalidSyntax" | "invalidFilter" | "invalidPath" | "noTarget" | "mutability" | "uniqueness";
export type ScimErrorResponse = {
  status: number;
  headers: Record<string, string>;
  body: { schemas: string[]; status: string; detail: string; scimType?: ScimType };
};
export type ScimFailure = { ok: false; error: ScimErrorResponse };
export type ScimOutcome<T> = { ok: true; value: T } | ScimFailure;

const errors = {
  invalidInput: [400, "The resource contains invalid values.", "invalidValue"],
  syntax: [400, "The request syntax is invalid.", "invalidSyntax"],
  filter: [400, "The filter is invalid or unsupported.", "invalidFilter"],
  path: [400, "The attribute path is unsupported.", "invalidPath"],
  noTarget: [400, "The attribute selection has no target.", "noTarget"],
  forbiddenWrite: [400, "The attribute cannot be modified.", "mutability"],
  immutableSourceKey: [400, "The attribute cannot be modified.", "mutability"],
  uniqueness: [409, "The resource conflicts with an existing value.", "uniqueness"],
  notFound: [404, "The resource was not found."],
  forbidden: [403, "The operation is not permitted."],
  groupWrite: [501, "Group writes are not supported."],
  unexpected: [500, "The request could not be completed."],
  keycloakUnavailable: [503, "The identity service is temporarily unavailable."],
} as const satisfies Record<string, readonly [number, string, ScimType?]>;
export type ScimErrorCode = keyof typeof errors;

/** Closed diagnostics never include caller values, persistence errors or remote bodies. */
export function scimFailure(code: ScimErrorCode): ScimFailure {
  const [status, detail, scimType] = errors[code] as readonly [number, string, ScimType?];
  return { ok: false, error: {
    status,
    headers: { "Content-Type": SCIM_MEDIA_TYPE, ...(code === "keycloakUnavailable" ? { "Retry-After": "30" } : {}) },
    body: { schemas: [ERROR_URN], status: String(status), detail, ...(scimType ? { scimType } : {}) },
  } };
}

export function fromIdentityFailure(failure: IdentityFailure): ScimFailure {
  return scimFailure(failure.code);
}

export function unexpectedScimFailure(_error: unknown): ScimFailure {
  return scimFailure("unexpected");
}

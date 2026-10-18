import { parseSourceIdentityInput, type IdentityPatchInput, type SourceIdentityInput } from "../identity/identity-input";
import { fromIdentityFailure, scimFailure, SCIM_MEDIA_TYPE, type ScimFailure, type ScimOutcome } from "./errors";

export { SCIM_MEDIA_TYPE } from "./errors";
export const CORE_USER_URN = "urn:ietf:params:scim:schemas:core:2.0:User";
export const ENTERPRISE_USER_URN = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const GROUP_URN = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const PATCH_OP_URN = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const LIST_RESPONSE_URN = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
const owned = new Set(["roles", "protected", "externalsubject", "password", "identitysource", "sourceidentitykey", "sourcedeletedat", "lastsyncedat"]);
function checkKeys(value: JsonObject, allowed: readonly string[]): ScimFailure | undefined {
  const keys = Object.keys(value);
  if (keys.some((key) => owned.has(key.split(/[.\[]/, 1)[0].toLowerCase()))) return scimFailure("forbiddenWrite");
  if (keys.some((key) => !allowed.includes(key))) return scimFailure("path");
}
function optionalText(value: unknown): value is string | null {
  return value === null || typeof value === "string" && value.length <= 255;
}

function parseUser(input: unknown, mode: "create" | "replace", targetId?: string): ScimOutcome<SourceIdentityInput> {
  if (!isObject(input)) return scimFailure("invalidInput");
  const keyError = checkKeys(input, ["schemas", "userName", "externalId", "emails", "name", "displayName", "active", "title", "groups", "id", "meta", ENTERPRISE_USER_URN]);
  if (keyError) return keyError;
  if (mode === "create" && (hasOwn(input, "id") || hasOwn(input, "meta"))) return scimFailure("forbiddenWrite");
  if (mode === "replace" && (typeof targetId !== "string" || !targetId ||
    hasOwn(input, "id") && input.id !== targetId)) return scimFailure("invalidInput");
  // P3-33: the pinned connector always sends an empty groups array; any membership is a grant IdamBox refuses.
  if (hasOwn(input, "groups") && (!Array.isArray(input.groups) || input.groups.length > 0)) return scimFailure("forbiddenWrite");
  // P3-33: the pinned connector labels Enterprise data with a Slack URN and omits the Enterprise URN. Require the
  // Core User URN and ignore other declared URNs; every body attribute is still checked against the closed allowlist.
  const schemas = input.schemas;
  if (!Array.isArray(schemas) || !schemas.includes(CORE_USER_URN) || new Set(schemas).size !== schemas.length ||
    schemas.some((urn) => typeof urn !== "string" || !urn.startsWith("urn:"))) return scimFailure("invalidInput");
  if (hasOwn(input, "active") && typeof input.active !== "boolean") return scimFailure("invalidInput");

  // P3-33: externalId is the source key (D19). The pinned connector never sends it on a user write, so a request
  // without externalId falls back to the Enterprise employeeNumber, which D19 makes the same HR value.
  const enterpriseInput = input[ENTERPRISE_USER_URN];
  const fallbackKey = !hasOwn(input, "externalId") && isObject(enterpriseInput) ? enterpriseInput.employeeNumber : undefined;
  const key = hasOwn(input, "externalId") ? input.externalId : fallbackKey;
  // P3-34: a PUT replaces only the attributes it asserts (RFC 7644 section 3.5.1, "not asserted"); omitted
  // attributes, including active, keep their current values, so a PUT without active never reactivates a leaver.
  const asserted = mode === "replace";
  const dto: Record<string, unknown> = asserted ? {
    ...(hasOwn(input, "userName") ? { username: input.userName } : {}),
    ...(key !== undefined ? { sourceExternalId: key } : {}),
    ...(hasOwn(input, "active") ? { accountStatus: input.active === false ? "inactive" : "active" } : {}),
  } : { username: input.userName, sourceExternalId: key, accountStatus: input.active === false ? "inactive" : "active" };
  if (hasOwn(input, "name")) {
    if (input.name === null) { dto.firstName = null; dto.lastName = null; }
    else {
      if (!isObject(input.name)) return scimFailure("invalidInput");
      const error = checkKeys(input.name, ["givenName", "familyName"]); if (error) return error;
      for (const [wire, field] of [["givenName", "firstName"], ["familyName", "lastName"]]) {
        if (hasOwn(input.name, wire)) {
          if (!optionalText(input.name[wire])) return scimFailure("invalidInput");
          dto[field] = input.name[wire];
        }
      }
    }
  }
  if (hasOwn(input, "displayName") && !optionalText(input.displayName)) return scimFailure("invalidInput");
  const derivedName = [dto.firstName, dto.lastName].filter((value): value is string => typeof value === "string")
    .map((value) => value.trim()).filter(Boolean).join(" ");
  const explicitName = typeof input.displayName === "string" && input.displayName.trim() ? input.displayName : undefined;
  if (!asserted) dto.displayName = explicitName ?? (derivedName || input.userName);
  else if (explicitName ?? derivedName) dto.displayName = explicitName ?? derivedName;
  else if (hasOwn(input, "displayName") && hasOwn(input, "userName")) dto.displayName = input.userName;
  if (hasOwn(input, "title")) dto.jobTitle = input.title;

  if (hasOwn(input, ENTERPRISE_USER_URN)) {
    const enterprise = input[ENTERPRISE_USER_URN];
    if (enterprise === null) { dto.employeeNumber = null; dto.department = null; }
    else {
      if (!isObject(enterprise)) return scimFailure("invalidInput");
      const error = checkKeys(enterprise, ["employeeNumber", "department"]); if (error) return error;
      for (const field of ["employeeNumber", "department"]) if (hasOwn(enterprise, field)) dto[field] = enterprise[field];
    }
  }

  if (asserted && !hasOwn(input, "emails")) {
    const partial = parseSourceIdentityInput(dto, "patch");
    return partial.ok ? partial as ScimOutcome<SourceIdentityInput> : fromIdentityFailure(partial);
  }
  if (!Array.isArray(input.emails) || input.emails.length === 0) return scimFailure("invalidInput");
  const emails: Array<{ value: string; primary: boolean }> = [];
  for (const email of input.emails) {
    if (!isObject(email)) return scimFailure("invalidInput");
    const error = checkKeys(email, ["value", "primary", "type", "display"]); if (error) return error;
    // P3-35: primary may arrive as the strings "true"/"false" from the pinned connector.
    const primaryText = typeof email.primary === "string" && /^(true|false)$/i.test(email.primary);
    if (typeof email.value !== "string" || email.value.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) ||
      hasOwn(email, "primary") && typeof email.primary !== "boolean" && !primaryText ||
      ["type", "display"].some((key) => hasOwn(email, key) && typeof email[key] !== "string")) return scimFailure("invalidInput");
    emails.push({ value: email.value, primary: email.primary === true || primaryText && String(email.primary).toLowerCase() === "true" });
  }
  const primaries = emails.filter((email) => email.primary);
  if (primaries.length > 1 || primaries.length === 0 && emails.length !== 1) return scimFailure("invalidInput");
  dto.email = (primaries[0] ?? emails[0]).value;
  if (asserted) {
    const partial = parseSourceIdentityInput(dto, "patch");
    return partial.ok ? partial as ScimOutcome<SourceIdentityInput> : fromIdentityFailure(partial);
  }
  const parsed = parseSourceIdentityInput(dto, mode);
  return parsed.ok ? parsed : fromIdentityFailure(parsed);
}

export function parseCreateUser(input: unknown): ScimOutcome<SourceIdentityInput> {
  return parseUser(input, "create");
}
/** P3-34: only the asserted source attributes; the identity service merges them with the current record under its lock. */
export function parseReplaceUser(input: unknown, targetId: string): ScimOutcome<IdentityPatchInput> {
  return parseUser(input, "replace", targetId) as ScimOutcome<IdentityPatchInput>;
}

/** Return transport values directly; 204 must not retain a resource or content type. */
export function scimResponse<T>(status: number, body?: T): { status: number; headers: Record<string, string>; body?: T } {
  return status === 204 || body === undefined ? { status, headers: {} } : { status, headers: { "Content-Type": SCIM_MEDIA_TYPE }, body };
}

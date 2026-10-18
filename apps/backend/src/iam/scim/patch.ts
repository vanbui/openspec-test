import { identityFailure, type IdentityOutcome, type IdentityPatchInput } from "../identity/identity-input";
import type { SourceIdentity, SourceIdentityReduction, SourceIdentityReductionFailure } from "../identity/identity-service";
import { CORE_USER_URN, ENTERPRISE_USER_URN, PATCH_OP_URN } from "./wire";

type Outcome = IdentityOutcome<IdentityPatchInput> | SourceIdentityReductionFailure;
type Failure = Exclude<Outcome, { ok: true }>;
type ObjectValue = Record<string, unknown>;
const fail = (code: SourceIdentityReductionFailure["code"]): SourceIdentityReductionFailure => ({ ok: false, code });
const invalid = () => identityFailure("invalidInput");
const fields = {
  username: "username", externalid: "sourceExternalId", displayname: "displayName", active: "accountStatus",
  title: "jobTitle", "name.givenname": "firstName", "name.familyname": "lastName",
  [`${ENTERPRISE_USER_URN.toLowerCase()}:employeenumber`]: "employeeNumber",
  [`${ENTERPRISE_USER_URN.toLowerCase()}:department`]: "department",
} as const;
const owned = new Set(["id", "meta", "roles", "protected", "externalsubject", "password", "identitysource", "sourceidentitykey", "sourcedeletedat", "lastsyncedat"]);
const required = new Set(["username", "email", "displayName", "accountStatus", "sourceExternalId"]);
function hasOwn(value: object, key: PropertyKey): boolean { return Object.prototype.hasOwnProperty.call(value, key); }
function object(value: unknown): value is ObjectValue { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** Attribute names are case-insensitive; duplicate spellings are ambiguous. */
function keys(value: ObjectValue): ObjectValue | null {
  const result: ObjectValue = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (hasOwn(result, lower)) return null;
    result[lower] = item;
  }
  return result;
}
function canonicalPath(path: string): string {
  let normalized = path.toLowerCase();
  const core = `${CORE_USER_URN.toLowerCase()}:`;
  if (normalized.startsWith(core)) normalized = normalized.slice(core.length);
  const enterprise = ENTERPRISE_USER_URN.toLowerCase();
  if (normalized.startsWith(`${enterprise}.`)) normalized = `${enterprise}:${normalized.slice(enterprise.length + 1)}`;
  return normalized;
}
function text(value: unknown, mandatory = false): boolean {
  return !mandatory && value === null || typeof value === "string" && value.length <= 255 && (!mandatory || !!value.trim());
}
function email(value: unknown): value is string {
  return typeof value === "string" && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
/** P3-35: the pinned connector sends PATCH email values as string maps, so primary may arrive as "true"/"false". */
function primaryFlag(value: unknown): boolean | null {
  if (value === undefined || value === false) return false;
  if (value === true) return true;
  if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return null;
}
function emailEntries(value: unknown): Array<{ value: string; primary: boolean }> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const addresses: Array<{ value: string; primary: boolean }> = [];
  for (const item of value) {
    if (!object(item)) return null;
    const entry = keys(item);
    const primary = entry ? primaryFlag(entry.primary) : null;
    if (!entry || primary === null || Object.keys(entry).some((key) => !["value", "primary", "type", "display"].includes(key))
      || !email(entry.value) || ["type", "display"].some((key) => hasOwn(entry, key) && typeof entry[key] !== "string")) return null;
    addresses.push({ value: entry.value, primary });
  }
  return addresses;
}
/** The one distinct primary (case-insensitive), or the single value when none is marked; null when ambiguous. */
function primaryEmail(value: unknown): string | null {
  const addresses = emailEntries(value); if (!addresses) return null;
  const primaries = [...new Map(addresses.filter((item) => item.primary).map((item) => [item.value.toLowerCase(), item.value])).values()];
  return primaries.length === 1 ? primaries[0] : primaries.length === 0 && addresses.length === 1 ? addresses[0].value : null;
}

/** Pure ordered reduction over the public single-primary projection. No persistence or remote work. */
export function reduceScimPatch(current: Readonly<SourceIdentity>, input: unknown): Outcome {
  if (!object(input) || Object.keys(input).some((key) => !["schemas", "Operations"].includes(key))
    || !Array.isArray(input.schemas) || input.schemas.length !== 1 || input.schemas[0] !== PATCH_OP_URN
    || !Array.isArray(input.Operations) || input.Operations.length < 1 || input.Operations.length > 100) return invalid();
  const state = { ...current };
  const delta: IdentityPatchInput = {};
  // P3-35: a remove of the current address must be followed in the same batch by a new primary.
  let removedEmail: string | undefined;
  function assign(field: keyof IdentityPatchInput, value: unknown, remove: boolean): Failure | undefined {
    if (remove && required.has(field)) return fail("forbiddenWrite");
    if (field === "sourceExternalId" && value !== current.sourceExternalId) return identityFailure("immutableSourceKey");
    const next = remove ? null : field === "accountStatus" ? value === true ? "active" : value === false ? "inactive" : undefined : value;
    if (field === "accountStatus" ? next === undefined : field === "email" ? !email(next) : !text(next, required.has(field))) return invalid();
    Object.assign(state, { [field]: next }); Object.assign(delta, { [field]: next });
  }
  function apply(rawPath: string, op: string, value: unknown): Failure | undefined {
    const path = canonicalPath(rawPath);
    const remove = op === "remove";
    if (owned.has(path.split(/[.\[:]/, 1)[0])) return fail("forbiddenWrite");
    if (path === "name" || path === ENTERPRISE_USER_URN.toLowerCase()) {
      const mapping: Record<string, keyof IdentityPatchInput> = path === "name"
        ? { givenname: "firstName", familyname: "lastName" } : { employeenumber: "employeeNumber", department: "department" };
      if (remove || value === null) {
        for (const field of Object.values(mapping)) { const error = assign(field, null, true); if (error) return error; }
        return;
      }
      if (!object(value)) return invalid();
      const nested = keys(value); if (!nested || Object.keys(nested).length === 0) return invalid();
      for (const [key, item] of Object.entries(nested)) {
        if (owned.has(key)) return fail("forbiddenWrite");
        const field = mapping[key];
        if (!hasOwn(mapping, key) || !field) return fail("path");
        const error = assign(field, item, false); if (error) return error;
      }
      return;
    }
    if (path === "emails") {
      if (remove) return fail("forbiddenWrite");
      if (op === "add") {
        // P3-35: an added primary becomes the one stored address (a new primary demotes the old one); added
        // non-primary addresses are validated but not stored. Never invent secondary-address persistence.
        const addresses = emailEntries(value); if (!addresses) return invalid();
        const primaries = [...new Map(addresses.filter((item) => item.primary).map((item) => [item.value.toLowerCase(), item.value])).values()];
        if (primaries.length > 1) return invalid();
        return primaries.length === 1 ? assign("email", primaries[0], false) : undefined;
      }
      // Replace supplies a complete candidate array.
      const selected = primaryEmail(value);
      return selected === null ? invalid() : assign("email", selected, false);
    }
    // Match the original spelling so JSON string values retain their exact bytes.
    const selector = /^(?:urn:ietf:params:scim:schemas:core:2\.0:User:)?emails\[\s*(primary\s+eq\s+true|value\s+eq\s+("(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-f]{4})*"))\s*\](\.value)?$/i.exec(rawPath);
    if (selector) {
      if (selector[2] !== undefined) {
        let match: unknown;
        try { match = JSON.parse(selector[2]); } catch { return invalid(); }
        if (typeof match !== "string" || match.length > 255) return invalid();
        if (state.email.toLowerCase() !== match.toLowerCase()) {
          // P3-35: removing an address that is not stored (a secondary) changes nothing.
          return remove && !selector[3] ? undefined : fail("noTarget");
        }
      }
      if (remove) {
        if (selector[3]) return fail("forbiddenWrite");
        removedEmail = state.email;
        return;
      }
      if (selector[3]) return assign("email", value, false);
      const selected = primaryEmail(Array.isArray(value) ? value : [value]);
      return selected === null ? invalid() : assign("email", selected, false);
    }
    if (!hasOwn(fields, path)) return fail("path");
    return assign(fields[path as keyof typeof fields], value, remove);
  }
  for (const entry of input.Operations) {
    if (!object(entry) || Object.keys(entry).some((key) => !["op", "path", "value"].includes(key))
      || typeof entry.op !== "string" || !["add", "remove", "replace"].includes(entry.op.toLowerCase())) return invalid();
    const op = entry.op.toLowerCase();
    if (op !== "remove" && !hasOwn(entry, "value")) return invalid();
    if (hasOwn(entry, "path")) {
      if (typeof entry.path !== "string" || entry.path.length > 4096) return fail("path");
      const error = apply(entry.path, op, entry.value); if (error) return error;
    } else {
      if (op === "remove" || !object(entry.value)) return invalid();
      const values = keys(entry.value); if (!values || Object.keys(values).length === 0) return invalid();
      for (const [path, value] of Object.entries(values)) {
        const error = apply(path, op, value); if (error) return error;
      }
    }
  }
  // An email is required: a removed current address must have been replaced by a new primary in this batch.
  if (removedEmail !== undefined && state.email.toLowerCase() === removedEmail.toLowerCase()) return fail("forbiddenWrite");
  return { ok: true, value: delta };
}

/** Construct only inside the server adapter; the service supplies the locked projection. */
export function scimPatchRequest(input: unknown): SourceIdentityReduction {
  return { kind: "reduction", reduce: (current) => reduceScimPatch(current, input) };
}

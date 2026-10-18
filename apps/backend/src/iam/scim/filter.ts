import type { SourceIdentityFilter } from "../identity/identity-service";
import { scimFailure, type ScimOutcome } from "./errors";
import { ENTERPRISE_USER_URN } from "./wire";

const fields = new Map<string, "username" | "sourceExternalId" | "email" | "employeeNumber">([
  ["username", "username"], ["externalid", "sourceExternalId"], ["emails.value", "email"],
  ["employeenumber", "employeeNumber"], [`${ENTERPRISE_USER_URN}:employeeNumber`.toLowerCase(), "employeeNumber"],
] as const);
const comparison = /^([a-z][a-z0-9:._-]*)\s+eq\s+("(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-f]{4}))*")/i;

/** Compile a bounded transport grammar to the internal equality DTO, never database syntax. */
export function parseScimFilter(input: unknown): ScimOutcome<SourceIdentityFilter | undefined> {
  if (input === undefined) return { ok: true, value: undefined };
  if (typeof input !== "string" || input.length > 4096 || !input.trim()) return scimFailure("filter");
  let remaining = input.trimStart();
  const terms: SourceIdentityFilter[] = [];
  while (remaining) {
    if (terms.length === 20) return scimFailure("filter");
    const match = comparison.exec(remaining);
    if (!match) return scimFailure("filter");
    const field = fields.get(match[1].toLowerCase());
    if (!field) return scimFailure("filter");
    let eq: unknown;
    try { eq = JSON.parse(match[2]); } catch { return scimFailure("filter"); }
    if (typeof eq !== "string" || eq.length > 255) return scimFailure("filter");
    terms.push(field === "sourceExternalId" ? { field, eq } : { field, eq, caseInsensitive: true });
    remaining = remaining.slice(match[0].length);
    if (!remaining.trim()) break;
    const and = /^\s+and\s+/i.exec(remaining);
    if (!and) return scimFailure("filter");
    remaining = remaining.slice(and[0].length);
    if (!remaining) return scimFailure("filter");
  }
  return { ok: true, value: terms.length === 1 ? terms[0] : { and: terms } };
}

import type { SourceIdentity, SourceIdentityList, SourceIdentityListInput } from "../identity/identity-service";
import { scimFailure, type ScimOutcome } from "./errors";
import { parseScimFilter } from "./filter";
import { toScimUser, type ScimUser } from "./mapping";
import { ENTERPRISE_USER_URN, LIST_RESPONSE_URN } from "./wire";

export type ScimProjection = { mode: "include" | "exclude"; paths: string[] };
export type ScimQuery = { list: SourceIdentityListInput; startIndex: number; projection?: ScimProjection };
export type ProjectedScimUser = Pick<ScimUser, "schemas" | "id"> & Record<string, unknown>;
export type ScimListResponse = { schemas: string[]; totalResults: number; startIndex: number; itemsPerPage: number; Resources?: ProjectedScimUser[] };
const queryKeys = ["filter", "startIndex", "count", "attributes", "excludedAttributes"];
const publicPaths = ["schemas", "id", "userName", "externalId", "emails", "emails.value", "emails.primary",
  "name", "name.givenName", "name.familyName", "displayName", "active", "title", "meta", "meta.resourceType", "meta.location",
  ENTERPRISE_USER_URN, `${ENTERPRISE_USER_URN}:employeeNumber`, `${ENTERPRISE_USER_URN}:department`];
const canonicalPaths = new Map(publicPaths.map((path) => [path.toLowerCase(), path]));

function integer(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (!/^-?[0-9]+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

/** Consume raw repeated entries before a framework can collapse duplicate keys. */
export function parseScimQuery(entries: Iterable<readonly [string, unknown]>): ScimOutcome<ScimQuery> {
  if (!entries || typeof entries !== "object" || typeof entries[Symbol.iterator] !== "function") return scimFailure("invalidInput");
  const values = new Map<string, string>();
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || !queryKeys.includes(entry[0])
      || values.has(entry[0]) || typeof entry[1] !== "string") return scimFailure("invalidInput");
    values.set(entry[0], entry[1]);
  }
  const filter = parseScimFilter(values.get("filter"));
  if (!filter.ok) return filter;
  const rawStart = integer(values.get("startIndex"), 1);
  const rawCount = integer(values.get("count"), 100);
  if (rawStart === null || rawCount === null) return scimFailure("invalidInput");
  const startIndex = Math.max(1, rawStart);
  const limit = Math.min(500, Math.max(0, rawCount));
  if (values.has("attributes") && values.has("excludedAttributes")) return scimFailure("invalidInput");
  let projection: ScimProjection | undefined;
  const projectionKey = values.has("attributes") ? "attributes" : values.has("excludedAttributes") ? "excludedAttributes" : undefined;
  if (projectionKey) {
    const paths = values.get(projectionKey)!.split(",").map((path) => canonicalPaths.get(path.trim().toLowerCase()));
    if (!paths.length || paths.some((path) => path === undefined)) return scimFailure("invalidInput");
    projection = { mode: projectionKey === "attributes" ? "include" : "exclude", paths: [...new Set(paths as string[])] };
  }
  return { ok: true, value: {
    list: { start: startIndex - 1, limit, ...(filter.value === undefined ? {} : { filter: filter.value }) },
    startIndex, ...(projection ? { projection } : {}),
  } };
}

/** Project only after fixed public mapping; caller paths can never widen the source read. */
export function projectScimUser(user: SourceIdentity, projection?: ScimProjection): ProjectedScimUser {
  const mapped = toScimUser(user);
  if (!projection) return mapped;
  function select(value: unknown, path: string): unknown {
    if (path === "schemas" || path === "id") return value;
    const selected = projection!.paths.some((parent) => path === parent
      || path.startsWith(`${parent}${parent === ENTERPRISE_USER_URN ? ":" : "."}`));
    if (selected) return projection!.mode === "include" ? value : undefined;
    if (Array.isArray(value)) {
      const items = value.map((item) => select(item, path)).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        const projected = select(child, `${path}${path === ENTERPRISE_USER_URN ? ":" : "."}${key}`);
        if (projected !== undefined) result[key] = projected;
      }
      return Object.keys(result).length ? result : undefined;
    }
    return projection!.mode === "exclude" ? value : undefined;
  }
  const output: ProjectedScimUser = { schemas: mapped.schemas, id: mapped.id };
  for (const [key, value] of Object.entries(mapped)) {
    const projected = select(value, key);
    if (projected !== undefined) output[key] = projected;
  }
  return output;
}

export function toScimListResponse(list: SourceIdentityList, query: ScimQuery): ScimListResponse {
  const resources = query.list.limit === 0 ? [] : list.items.map((user) => projectScimUser(user, query.projection));
  return { schemas: [LIST_RESPONSE_URN], totalResults: list.total, startIndex: query.startIndex, itemsPerPage: resources.length,
    ...(query.list.limit === 0 ? {} : { Resources: resources }) };
}

import type { Core } from "@strapi/strapi";
import { KeycloakProvisioningError } from "../../keycloak/admin-client";
import { deriveSourceIdentityKey, identityFailure, isSourceExternalId, parseSourceIdentityInput,
  resolveIdentityUniqueness, SOURCE_IDENTITY_FIELDS, type IdentityOutcome, type IdentityPatchInput, type SourceIdentityInput } from "./identity-input";
import { validateSourcePrincipal, type SourcePrincipal } from "./source-principal";
import { withIdentityUserLock } from "./user-lock";
import { runSourceMutation } from "./write-context";
import { registerPasswordSetupAfterCommit } from "../password-setup/dispatcher";

const USER = "api::idambox-user.idambox-user";
const projectionFields = ["documentId", ...SOURCE_IDENTITY_FIELDS] as const;
export type SourceIdentity = Omit<SourceIdentityInput, "sourceExternalId"> & { documentId: string; sourceExternalId?: string };
export type SourceIdentityReductionFailure = { ok: false; code: "path" | "noTarget" | "forbiddenWrite" };
/** Server-only reduction: called after the shared lock, fresh principal and scope read. */
export type SourceIdentityReduction = {
  kind: "reduction";
  reduce(current: Readonly<SourceIdentity>): IdentityOutcome<IdentityPatchInput> | SourceIdentityReductionFailure;
};
/** Server-only replacement: merges asserted attributes with the current source fields, after the lock and scope read. */
export type SourceIdentityReplacement = {
  kind: "replacement";
  reduce(current: Readonly<SourceIdentity>): IdentityOutcome<SourceIdentityInput> | SourceIdentityReductionFailure;
};
type PatchOutcome = IdentityOutcome<SourceIdentity> | SourceIdentityReductionFailure;
function isReduction(input: unknown): input is SourceIdentityReduction {
  return !!input && typeof input === "object" && !Array.isArray(input)
    && "kind" in input && input.kind === "reduction" && "reduce" in input && typeof input.reduce === "function";
}
function isReplacement(input: unknown): input is SourceIdentityReplacement {
  return !!input && typeof input === "object" && !Array.isArray(input)
    && "kind" in input && input.kind === "replacement" && "reduce" in input && typeof input.reduce === "function";
}
export type SourceIdentityTarget = string | { sourceExternalId: string };
export type SourceIdentityFilter =
  | { field: typeof projectionFields[number]; eq: string; caseInsensitive?: never }
  | { field: "username" | "email" | "employeeNumber"; eq: string; caseInsensitive: true }
  | { and: SourceIdentityFilter[] };
export type SourceIdentityListInput = { filter?: SourceIdentityFilter; start?: number; limit?: number };
export type SourceIdentityList = { items: SourceIdentity[]; total: number };
type User = NonNullable<Awaited<ReturnType<typeof readUser>>>;
function readUser(strapi: Core.Strapi, documentId: string) {
  return strapi.documents(USER).findOne({ documentId, populate: { identitySource: { fields: ["documentId"] } } });
}
function project(user: User): SourceIdentity {
  const result: Record<string, unknown> = {};
  for (const field of projectionFields) if (field !== "sourceExternalId" || user.identitySource) result[field] = user[field as keyof User];
  return result as SourceIdentity;
}
function visibleScope(principal: SourcePrincipal) {
  return { $and: [
    { protected: { $eq: false } }, { sourceDeletedAt: { $null: true } },
    { $or: [{ identitySource: { documentId: { $eq: principal.sourceDocumentId } } },
      { identitySource: { $null: true }, sourceExternalId: { $null: true }, sourceIdentityKey: { $null: true } }] },
  ] };
}
function normalizeFilter(input: unknown, depth = 0): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input) || depth > 8) return null;
  const filter = input as Record<string, unknown>;
  if (Object.keys(filter).length === 1 && Array.isArray(filter.and) && filter.and.length > 0 && filter.and.length <= 20) {
    const terms = filter.and.map((term) => normalizeFilter(term, depth + 1));
    return terms.every((term) => term !== null) ? { $and: terms } : null;
  }
  const hasCaseOption = Object.prototype.hasOwnProperty.call(filter, "caseInsensitive");
  if (Object.keys(filter).length !== (hasCaseOption ? 3 : 2)
    || Object.keys(filter).some((key) => !["field", "eq", "caseInsensitive"].includes(key))
    || !projectionFields.some((field) => field === filter.field)
    || typeof filter.eq !== "string" || filter.eq.length > 255) return null;
  if (hasCaseOption && (filter.caseInsensitive !== true
    || !["username", "email", "employeeNumber"].some((field) => field === filter.field))) return null;
  // A backslash has dialect-dependent LIKE escape semantics. Use non-null
  // candidates for those literals and refine them inside the scoped list below.
  if (hasCaseOption && filter.eq.includes("\\")) return { [filter.field as string]: { $notNull: true } };
  return { [filter.field as string]: { [hasCaseOption ? "$eqi" : "$eq"]: filter.eq } };
}
/** Strapi's $eqi uses LIKE, so wildcard-bearing literals need exact refinement. */
function literalComparisons(filter: SourceIdentityFilter | undefined): Array<{ field: "username" | "email" | "employeeNumber"; eq: string }> {
  if (!filter) return [];
  if ("and" in filter) return filter.and.flatMap(literalComparisons);
  return filter.caseInsensitive && /[%_\\]/.test(filter.eq) ? [{ field: filter.field, eq: filter.eq }] : [];
}
function validTarget(target: SourceIdentityTarget): boolean {
  return typeof target === "string" ? !!target && target.length <= 24 : !!target && typeof target === "object"
    && Object.keys(target).length === 1 && isSourceExternalId(target.sourceExternalId);
}
async function resolveTarget(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget): Promise<string | null> {
  if (typeof target === "string") return target;
  const users = await strapi.documents(USER).findMany({ filters: { sourceIdentityKey: deriveSourceIdentityKey(principal.sourceDocumentId, target.sourceExternalId),
    sourceExternalId: { $eq: target.sourceExternalId }, identitySource: { documentId: { $eq: principal.sourceDocumentId } } }, fields: ["documentId"], limit: 1 });
  return users[0]?.documentId ?? null;
}
function accessible(user: User | null, principal: SourcePrincipal, allowManual = false, allowDeleted = false): user is User {
  if (!user || user.protected || (user.sourceDeletedAt && !allowDeleted)) return false;
  return user.identitySource?.documentId === principal.sourceDocumentId
    || (allowManual && !user.identitySource && user.sourceExternalId == null && user.sourceIdentityKey == null);
}
function isUniqueError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string; details?: unknown; message?: string };
  return candidate.code === "23505" || candidate.code === "ER_DUP_ENTRY"
    || /SQLITE_CONSTRAINT.*UNIQUE|UNIQUE constraint failed/.test(`${candidate.code} ${candidate.message}`)
    || (candidate.name === "ValidationError" && /must be unique/.test(JSON.stringify(candidate.details)));
}
async function failedWrite(strapi: Core.Strapi, principal: SourcePrincipal, externalId: string | undefined, error: unknown) {
  if (isUniqueError(error)) return externalId ? resolveIdentityUniqueness(strapi, principal.sourceDocumentId, externalId) : identityFailure("uniqueness");
  if (error instanceof KeycloakProvisioningError) return identityFailure("keycloakUnavailable");
  const message = error instanceof Error ? error.message : "";
  if (message === "IAM_IDENTITY_FORBIDDEN") return identityFailure("forbidden");
  if (message === "IAM_IDENTITY_IMMUTABLE_SOURCE_KEY") return identityFailure("immutableSourceKey");
  if (message === "IAM_IDENTITY_INVALID_INPUT") return identityFailure("invalidInput");
  // Unexpected persistence failures remain errors; do not disguise them as client conflicts.
  throw error;
}

/** Internal source boundary. Transport adapters may translate these closed outcomes. */
export function createIdentityService(strapi: Core.Strapi) {
  async function readForSource(principal: SourcePrincipal, documentId: string): Promise<IdentityOutcome<SourceIdentity>> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    if (typeof documentId !== "string" || !documentId || documentId.length > 24) return identityFailure("invalidInput");
    return strapi.db.transaction(async () => {
      if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
      const users = await strapi.documents(USER).findMany({ filters: { $and: [visibleScope(principal), { documentId: { $eq: documentId } }] },
        fields: [...projectionFields], populate: { identitySource: { fields: ["documentId"] } }, limit: 1 });
      return users[0] ? { ok: true as const, value: project(users[0]) } : identityFailure("notFound");
    });
  }
  async function listForSource(principal: SourcePrincipal, input: SourceIdentityListInput = {}): Promise<IdentityOutcome<SourceIdentityList>> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["filter", "start", "limit"].includes(key))) return identityFailure("invalidInput");
    const { start = 0, limit = 100 } = input;
    if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > 500) return identityFailure("invalidInput");
    const normalized = input.filter === undefined ? {} : normalizeFilter(input.filter);
    if (!normalized) return identityFailure("invalidInput");
    const filters = { $and: [visibleScope(principal), normalized] };
    return strapi.db.transaction(async () => {
      if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
      const literals = literalComparisons(input.filter);
      if (literals.length) {
        // Refine scoped database candidates before totals/paging. Batches bound memory;
        // no raw SQL or dialect-specific LIKE escaping enters the transport contract.
        let total = 0;
        const items: SourceIdentity[] = [];
        for (let offset = 0; ; offset += 500) {
          const candidates = await strapi.documents(USER).findMany({ filters, start: offset, limit: 500, sort: "id:asc",
            fields: [...projectionFields], populate: { identitySource: { fields: ["documentId"] } } });
          for (const candidate of candidates) {
            if (!literals.every(({ field, eq }) => typeof candidate[field] === "string"
              && candidate[field].toLowerCase() === eq.toLowerCase())) continue;
            if (total >= start && items.length < limit) items.push(project(candidate));
            total += 1;
          }
          if (candidates.length < 500) break;
        }
        return { ok: true as const, value: { total, items } };
      }
      const total = await strapi.documents(USER).count({ filters });
      const users = limit === 0 ? [] : await strapi.documents(USER).findMany({ filters, start, limit, sort: "id:asc",
        fields: [...projectionFields], populate: { identitySource: { fields: ["documentId"] } } });
      return { ok: true as const, value: { total, items: users.map(project) } };
    });
  }
  async function createFromSource(principal: SourcePrincipal, input: SourceIdentityInput): Promise<IdentityOutcome<SourceIdentity>> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    const parsed = parseSourceIdentityInput(input); if (!parsed.ok) return parsed;
    try {
      return await withIdentityUserLock(strapi, undefined, async () => {
        const data = {
          ...(parsed.value as Record<string, unknown>), username: parsed.value.username, email: parsed.value.email,
          displayName: parsed.value.displayName, accountStatus: parsed.value.accountStatus,
          identitySource: principal.sourceDocumentId, lastSyncedAt: new Date().toISOString(), protected: false, roles: [],
        };
        const user = await runSourceMutation(strapi, principal, "create", undefined, () => strapi.documents(USER).create({ data }));
        await registerPasswordSetupAfterCommit(strapi, { userDocumentId: user.documentId, sourceDocumentId: principal.sourceDocumentId });
        return { ok: true as const, value: project({ ...user, identitySource: { documentId: principal.sourceDocumentId } } as User) };
      });
    } catch (error) { return failedWrite(strapi, principal, parsed.value.sourceExternalId, error); }
  }
  async function patchFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput | SourceIdentityReduction): Promise<PatchOutcome> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    const reduction = isReduction(input) ? input : undefined;
    const initial = reduction ? undefined : parseSourceIdentityInput(input, "patch");
    if (initial && !initial.ok) return initial;
    if (!validTarget(target)) return identityFailure("invalidInput");
    let externalId: string | undefined;
    try {
      const id = await resolveTarget(strapi, principal, target); if (!id) return identityFailure("notFound");
      return await withIdentityUserLock(strapi, id, async () => {
        if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
        const user = await readUser(strapi, id); if (!accessible(user, principal)) return identityFailure("notFound");
        externalId = user.sourceExternalId ?? undefined;
        const reduced = reduction ? reduction.reduce(Object.freeze(project(user))) : initial!;
        if (!reduced.ok) return reduced;
        const parsed = parseSourceIdentityInput(reduced.value, "patch"); if (!parsed.ok) return parsed;
        if (parsed.value.sourceExternalId !== undefined && parsed.value.sourceExternalId !== externalId) return identityFailure("immutableSourceKey");
        const data: Record<string, unknown> = { ...parsed.value, lastSyncedAt: new Date().toISOString() };
        const updated = await runSourceMutation(strapi, principal, "patch", id, () => strapi.documents(USER).update({ documentId: id, data }));
        return { ok: true as const, value: project({ ...updated, identitySource: user.identitySource } as User) };
      });
    } catch (error) { return failedWrite(strapi, principal, externalId, error); }
  }
  async function replaceFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput | SourceIdentityReplacement): Promise<PatchOutcome> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    const replacement = isReplacement(input) ? input : undefined;
    const initial = replacement ? undefined : parseSourceIdentityInput(input, "replace");
    if (initial && !initial.ok) return initial;
    if (!validTarget(target)) return identityFailure("invalidInput");
    let externalId = initial?.value.sourceExternalId;
    try {
      const id = await resolveTarget(strapi, principal, target); if (!id) return identityFailure("notFound");
      return await withIdentityUserLock(strapi, id, async () => {
        if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
        const user = await readUser(strapi, id);
        // An explicit documentId is the upstream confirmed-correlation signal. This
        // boundary cannot independently prove the operator's confirmation upstream.
        if (!accessible(user, principal, typeof target === "string")) return identityFailure("notFound");
        // P3-34: a replacement merges asserted attributes with the current source fields read under this lock.
        const reduced = replacement ? replacement.reduce(Object.freeze(project(user))) : initial!;
        if (!reduced.ok) return reduced;
        const parsed = parseSourceIdentityInput(reduced.value, "replace"); if (!parsed.ok) return parsed;
        externalId = parsed.value.sourceExternalId;
        if (user.identitySource && user.sourceExternalId !== parsed.value.sourceExternalId) return identityFailure("immutableSourceKey");
        const data: Record<string, unknown> = { ...parsed.value, identitySource: principal.sourceDocumentId, lastSyncedAt: new Date().toISOString() };
        const updated = await runSourceMutation(strapi, principal, "replace", id, () => strapi.documents(USER).update({ documentId: id, data }));
        return { ok: true as const, value: project({ ...updated, identitySource: { documentId: principal.sourceDocumentId } } as User) };
      });
    } catch (error) { return failedWrite(strapi, principal, externalId, error); }
  }
  async function deactivateFromSource(principal: SourcePrincipal, target: SourceIdentityTarget, sourceDeletion = false): Promise<IdentityOutcome<SourceIdentity>> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    if (!validTarget(target) || typeof sourceDeletion !== "boolean") return identityFailure("invalidInput");
    let externalId: string | undefined;
    try {
      const id = await resolveTarget(strapi, principal, target); if (!id) return identityFailure("notFound");
      return await withIdentityUserLock(strapi, id, async () => {
        if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
        const user = await readUser(strapi, id); if (!accessible(user, principal, false, sourceDeletion)) return identityFailure("notFound");
        externalId = user.sourceExternalId ?? undefined;
        const now = new Date().toISOString();
        const data: Record<string, unknown> = { accountStatus: "inactive", lastSyncedAt: now,
          ...(sourceDeletion ? { sourceDeletedAt: user.sourceDeletedAt ?? now } : {}) };
        const updated = await runSourceMutation(strapi, principal, sourceDeletion ? "delete" : "deactivate", id,
          () => strapi.documents(USER).update({ documentId: id, data }));
        return { ok: true as const, value: project({ ...updated, identitySource: user.identitySource } as User) };
      });
    } catch (error) { return failedWrite(strapi, principal, externalId, error); }
  }
  async function audited<T extends PatchOutcome>(principal: SourcePrincipal, operation: string, target: SourceIdentityTarget | undefined,
    work: () => Promise<T>): Promise<T | ReturnType<typeof identityFailure>> {
    if (!await validateSourcePrincipal(strapi, principal)) return identityFailure("forbidden");
    const outcome = await work();
    const documentId = outcome.ok ? outcome.value.documentId : typeof target === "string" && /^[a-zA-Z0-9]{1,24}$/.test(target) ? target : null;
    try {
      const result = strapi.log.info(`IAM identity ${JSON.stringify({ source: principal.sourceDocumentId, serviceUser: principal.serviceUserDocumentId,
        operation, target: documentId, outcome: outcome.ok ? "accepted" : outcome.code })}`);
      void Promise.resolve(result).catch(() => undefined);
    } catch { /* A diagnostic failure cannot turn a committed mutation into a failed response. */ }
    return outcome;
  }
  function auditedPatch(principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput): Promise<IdentityOutcome<SourceIdentity>>;
  function auditedPatch(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityReduction): Promise<PatchOutcome>;
  function auditedPatch(principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput | SourceIdentityReduction): Promise<PatchOutcome> {
    return audited(principal, "patch", target, () => patchFromSource(principal, target, input));
  }
  function auditedReplace(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput): Promise<IdentityOutcome<SourceIdentity>>;
  function auditedReplace(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityReplacement): Promise<PatchOutcome>;
  function auditedReplace(principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput | SourceIdentityReplacement): Promise<PatchOutcome> {
    return audited(principal, "replace", target, () => replaceFromSource(principal, target, input));
  }
  return {
    createFromSource: (principal: SourcePrincipal, input: SourceIdentityInput) => audited(principal, "create", undefined, () => createFromSource(principal, input)),
    replaceFromSource: auditedReplace,
    patchFromSource: auditedPatch,
    deactivateFromSource: (principal: SourcePrincipal, target: SourceIdentityTarget, sourceDeletion = false) => audited(principal, sourceDeletion ? "delete" : "deactivate", target, () => deactivateFromSource(principal, target, sourceDeletion)),
    readForSource, listForSource,
  };
}
export const createFromSource = (strapi: Core.Strapi, principal: SourcePrincipal, input: SourceIdentityInput) => createIdentityService(strapi).createFromSource(principal, input);
export function patchFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput): Promise<IdentityOutcome<SourceIdentity>>;
export function patchFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityReduction): Promise<PatchOutcome>;
export function patchFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: IdentityPatchInput | SourceIdentityReduction): Promise<PatchOutcome> {
  const service = createIdentityService(strapi);
  return isReduction(input) ? service.patchFromSource(principal, target, input)
    : service.patchFromSource(principal, target, input as IdentityPatchInput);
}
export const readForSource = (strapi: Core.Strapi, principal: SourcePrincipal, documentId: string) => createIdentityService(strapi).readForSource(principal, documentId);
export const listForSource = (strapi: Core.Strapi, principal: SourcePrincipal, input?: SourceIdentityListInput) => createIdentityService(strapi).listForSource(principal, input);
export function replaceFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput): Promise<IdentityOutcome<SourceIdentity>>;
export function replaceFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityReplacement): Promise<PatchOutcome>;
export function replaceFromSource(strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, input: SourceIdentityInput | SourceIdentityReplacement): Promise<PatchOutcome> {
  const service = createIdentityService(strapi);
  return isReplacement(input) ? service.replaceFromSource(principal, target, input)
    : service.replaceFromSource(principal, target, input as SourceIdentityInput);
}
export const deactivateFromSource = (strapi: Core.Strapi, principal: SourcePrincipal, target: SourceIdentityTarget, sourceDeletion = false) => createIdentityService(strapi).deactivateFromSource(principal, target, sourceDeletion);

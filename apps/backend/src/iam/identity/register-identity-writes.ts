import type { Core } from "@strapi/strapi";
import { withIdentityUserLock, lockIdentityUser } from "./user-lock";
import { deriveSourceIdentityKey, HR_FIELDS, parseSourceIdentityInput, SOURCE_IDENTITY_FIELDS } from "./identity-input";
import { identityWriteAuthority, isInitialSourceServiceCreate, isRegisteredSourceService,
  isSourceRegistrationBinding, isSourceRegistrationGrant, isKeycloakLinkage } from "./write-context";
import { registeredSourceServiceUserDocumentIds, validateSourcePrincipal } from "./source-principal";
import { enqueueDeactivation, cancelPendingDeactivation } from "../keycloak-sync/outbox";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const ROLE = "api::role.role";
const FUNCTION = "api::function.function";
const APPLICATION = "api::application.application";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
const SERVER_FIELDS = ["identitySource", "sourceExternalId", "sourceIdentityKey", "sourceDeletedAt", "lastSyncedAt", "protected"];
const READS = new Set(["findOne", "findFirst", "findMany", "count"]);
type IdentityUser = NonNullable<Awaited<ReturnType<typeof readUser>>>;
function readUser(strapi: Core.Strapi, documentId: string) {
  return strapi.documents(USER).findOne({ documentId, populate: { identitySource: true, roles: true } });
}
function forbidden(): never { throw new Error("IAM_IDENTITY_FORBIDDEN"); }
function equal(left: unknown, right: unknown): boolean { return (left ?? null) === (right ?? null); }

/** Read a singular relation reference, refusing broad connect/disconnect requests for ownership. */
function relationId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value) return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const input = value as Record<string, unknown>;
    if (typeof input.documentId === "string" && Object.keys(input).length === 1) return input.documentId;
    const refs = input.set ?? input.connect;
    if (Object.keys(input).length === 1 && Array.isArray(refs) && refs.length <= 1) return refs.length ? relationId(refs[0]) : null;
  }
  return forbidden();
}

/** Canonical document ids make numeric ids and all Document Service relation forms comparable. */
async function effectiveRelations(strapi: Core.Strapi, uid: typeof USER | typeof ROLE,
  before: readonly { documentId: string }[], input: unknown): Promise<Set<string>> {
  const resolve = async (value: unknown): Promise<string> => {
    const ref = typeof value === "object" && value !== null ? value as Record<string, unknown> : { [typeof value === "number" ? "id" : "documentId"]: value };
    if (typeof ref.documentId === "string" && ref.documentId) {
      const row = await strapi.documents(uid).findOne({ documentId: ref.documentId });
      if (row) return row.documentId;
      if (!/^\d+$/.test(ref.documentId)) forbidden();
      ref.id = Number(ref.documentId);
    }
    if (typeof ref.id === "number" || typeof ref.id === "string") {
      const row = await strapi.documents(uid).findFirst({ filters: { id: ref.id } });
      if (row) return row.documentId;
    }
    return forbidden();
  };
  const list = async (value: unknown) => {
    const refs = Array.isArray(value) ? value : [value];
    return Promise.all(refs.map(resolve));
  };
  if (input === undefined) return new Set(before.map((row) => row.documentId));
  if (Array.isArray(input)) return new Set(await list(input));
  if (input === null) return new Set();
  if (typeof input !== "object") return new Set(await list(input));
  const relation = input as Record<string, unknown>;
  if ("id" in relation || "documentId" in relation) return new Set(await list(input));
  if (Object.keys(relation).some((key) => !["set", "connect", "disconnect"].includes(key))) forbidden();
  const result = new Set("set" in relation ? await list(relation.set) : before.map((row) => row.documentId));
  if ("disconnect" in relation) for (const id of await list(relation.disconnect)) result.delete(id);
  if ("connect" in relation) for (const id of await list(relation.connect)) result.add(id);
  return result;
}

async function dedicatedRoles(strapi: Core.Strapi) {
  // Identify the capability through its Function, rather than trusting a submitted Role name.
  return strapi.documents(ROLE).findMany({ filters: { functions: { name: "Identity Provisioning", application: { slug: "idambox-iam" } } } });
}

async function guardUser(strapi: Core.Strapi, action: string, target: string | undefined, data: Record<string, unknown>,
  user: IdentityUser | null) {
  const initial = action === "create" && isInitialSourceServiceCreate(strapi, data);
  const grant = isSourceRegistrationGrant(strapi, target, data);
  if ("roles" in data) {
    const before = new Set(user?.roles?.map((role) => role.documentId));
    const after = await effectiveRelations(strapi, ROLE, user?.roles ?? [], data.roles);
    for (const role of await dedicatedRoles(strapi)) {
      if (!after.has(role.documentId)) continue;
      if (before.has(role.documentId)) {
        if (!target || !await isRegisteredSourceService(strapi, target)) forbidden();
        continue;
      }
      if (!grant || !user?.protected || !target) forbidden();
      const bindings = await strapi.documents(SOURCE).findMany({ filters: { serviceUser: { documentId: target } }, limit: 2 });
      if (bindings.length !== 1) forbidden();
    }
  }
  const authority = identityWriteAuthority(strapi, action, target, data);
  const sourceAuthority = authority?.principal ? await validateSourcePrincipal(strapi, authority.principal) : null;
  if (user) {
    const tuple = [user.identitySource?.documentId ?? null, user.sourceExternalId ?? null, user.sourceIdentityKey ?? null];
    if (tuple.some((value) => value != null) && tuple.some((value) => value == null)) throw new Error("IAM_IDENTITY_INVALID_INPUT");
  }
  if (authority?.principal && !sourceAuthority) forbidden();
  if (sourceAuthority) {
    if (data.protected !== undefined && data.protected !== false) forbidden();
    if (user?.protected || (user?.sourceDeletedAt && authority?.operation !== "delete")) forbidden();
    if (authority?.operation !== "create" && (!user || (user.identitySource?.documentId !== sourceAuthority.sourceDocumentId
      && !(authority?.operation === "replace" && user.identitySource == null && user.sourceExternalId == null && user.sourceIdentityKey == null)))) forbidden();
    const sourceInput = Object.fromEntries(Object.entries(data).filter(([key]) => SOURCE_IDENTITY_FIELDS.some((field) => field === key)));
    const parsed = authority?.operation === "create" || authority?.operation === "replace"
      ? parseSourceIdentityInput(sourceInput, authority.operation) : parseSourceIdentityInput(sourceInput, "patch");
    if (!parsed.ok) throw new Error("IAM_IDENTITY_INVALID_INPUT");
    Object.assign(data, parsed.value);
    if ("roles" in data && (!Array.isArray(data.roles) || data.roles.length !== 0 || authority?.operation !== "create")) forbidden();
  }
  if (!initial) {
    for (const field of SERVER_FIELDS) {
      if (!(field in data)) continue;
      const unchanged = field === "identitySource" ? relationId(data[field]) === (user?.identitySource?.documentId ?? null)
        : equal(data[field], user?.[field as keyof IdentityUser] ?? (field === "protected" ? false : null));
      if (!unchanged && !(authority && authority.fields.includes(field))) forbidden();
    }
    if ("sourceIdentityKey" in data) {
      // No caller, including a source operation, supplies the digest.
      if (!equal(data.sourceIdentityKey, user?.sourceIdentityKey)) forbidden();
    }
  }
  if (user?.identitySource && !sourceAuthority) {
    for (const field of HR_FIELDS) if (field in data && !equal(data[field], user[field as keyof IdentityUser])) forbidden();
    for (const field of ["externalSubject", "password"]) {
      if (field in data && !equal(data[field], user[field as keyof IdentityUser]) && authority?.operation !== "linkage") forbidden();
    }
  }
  if (user?.sourceDeletedAt && ("sourceDeletedAt" in data && !equal(data.sourceDeletedAt, user.sourceDeletedAt)
    || data.accountStatus === "active")) forbidden();

  const sourceId = "identitySource" in data ? relationId(data.identitySource) : user?.identitySource?.documentId ?? null;
  if (sourceAuthority && sourceId !== sourceAuthority.sourceDocumentId) forbidden();
  const externalId = "sourceExternalId" in data ? data.sourceExternalId : user?.sourceExternalId ?? null;
  const digest = user?.sourceIdentityKey ?? null;
  if (user?.identitySource && (sourceId !== user.identitySource.documentId || externalId !== user.sourceExternalId)) {
    throw new Error("IAM_IDENTITY_IMMUTABLE_SOURCE_KEY");
  }
  if (sourceId != null || externalId != null || digest != null) {
    if (!sourceId || typeof externalId !== "string") throw new Error("IAM_IDENTITY_INVALID_INPUT");
    const source = await strapi.documents(SOURCE).findOne({ documentId: sourceId });
    if (!source) throw new Error("IAM_IDENTITY_INVALID_INPUT");
    const expected = deriveSourceIdentityKey(source.documentId, externalId);
    if (digest && expected !== digest) throw new Error("IAM_IDENTITY_IMMUTABLE_SOURCE_KEY");
    if (!digest && !sourceAuthority) forbidden();
    if (!digest) data.sourceIdentityKey = expected;
  }
  return { grant };
}

/** Always-on Document Service boundary; transaction and shared lock precede all deciding reads. */
export function registerIdentityWrites(strapi: Core.Strapi): void {
  strapi.documents.use(async (context, next) => {
    if (![USER, SOURCE, ROLE, FUNCTION, APPLICATION].includes(context.uid) || READS.has(context.action)) return next();
    const params = context.params as { documentId?: string; data?: Record<string, unknown> };
    const data = { ...params.data };
    // Normalization belongs to this operation, not to a caller's reusable DTO.
    if (params.data) params.data = data;
    if (context.uid === USER) {
      if (!["create", "update", "delete"].includes(context.action)) forbidden();
      if (context.action !== "create" && !params.documentId) forbidden();
      return withIdentityUserLock(strapi, params.documentId, async (trx) => {
        const user = params.documentId ? await readUser(strapi, params.documentId) : null;
        if (context.action === "delete") {
          if (user?.identitySource || user?.sourceExternalId != null || user?.sourceIdentityKey != null
            || user?.protected || (params.documentId && await isRegisteredSourceService(strapi, params.documentId))) forbidden();
          // Durable work must retain its required matching user, including after completion/cancellation.
          if (params.documentId && await strapi.documents(OUTBOX).findFirst({ filters: { userDocumentId: params.documentId } })) forbidden();
          return next();
        }
        const { grant } = await guardUser(strapi, context.action, params.documentId, data, user);
        const linkage = isKeycloakLinkage(strapi, params.documentId, data);
        const service = params.documentId && !grant ? await isRegisteredSourceService(strapi, params.documentId) : false;
        // Refused here, before an inner middleware can strip a transient password.
        if (service && data.password != null) throw new Error("IAM_SOURCE_SERVICE_INVARIANT");
        // Cancel before the blocking enable, under the same lock/transaction; a failed
        // validation or remote enable rolls cancellation back with the user write.
        if (user?.accountStatus === "inactive" && data.accountStatus === "active" && !linkage) {
          await cancelPendingDeactivation(strapi, trx, user.documentId);
        }
        const result = await next();
        const id = (result as { documentId?: string } | null)?.documentId;
        if (id && (service || grant) && !await isRegisteredSourceService(strapi, id)) forbidden();
        // Nested cleanup remains guarded but is not a separate lifecycle transition.
        if (user && id && context.action === "update" && !linkage) {
          const updated = result as { documentId: string; accountStatus?: string; externalSubject?: string | null };
          if (updated.accountStatus === "inactive") {
            await enqueueDeactivation(strapi, trx, updated, user.accountStatus !== "inactive");
          }
        }
        return result;
      });
    }
    return withIdentityUserLock(strapi, undefined, async (trx) => {
      if (context.uid === SOURCE) {
        if (context.action === "create") {
          if (!isSourceRegistrationBinding(strapi, data)) forbidden();
          const serviceId = relationId(data.serviceUser);
          if (!serviceId) forbidden();
          await lockIdentityUser(strapi, serviceId, trx);
          return next();
        }
        if (context.action !== "update" || "serviceUser" in data) forbidden();
        return next();
      }
      // Inverse membership and catalogue changes must preserve every bound service.
      const ids = (await registeredSourceServiceUserDocumentIds(strapi)).sort();
      for (const id of ids) {
        await lockIdentityUser(strapi, id, trx);
        await isRegisteredSourceService(strapi, id);
      }
      if (context.uid === ROLE && "idamboxUsers" in data) {
        const reserved = await dedicatedRoles(strapi);
        if (reserved.some((role) => role.documentId === params.documentId)) {
          const role = params.documentId && await strapi.documents(ROLE).findOne({ documentId: params.documentId, populate: { idamboxUsers: true } });
          const members = await effectiveRelations(strapi, USER, role ? role.idamboxUsers ?? [] : [], data.idamboxUsers);
          for (const id of [...members].sort()) {
            if (!ids.includes(id)) forbidden();
            if (!await isRegisteredSourceService(strapi, id)) forbidden();
          }
        }
      }
      const result = await next();
      // Also covers creating a dedicated Role, or turning an existing Role into one.
      if (context.uid === ROLE && ["create", "update"].includes(context.action)) {
        for (const role of await dedicatedRoles(strapi)) {
          const persisted = await strapi.documents(ROLE).findOne({ documentId: role.documentId, populate: { idamboxUsers: true } });
          for (const member of persisted?.idamboxUsers ?? []) {
            if (!ids.includes(member.documentId) || !await isRegisteredSourceService(strapi, member.documentId)) forbidden();
          }
        }
      }
      for (const id of ids) await isRegisteredSourceService(strapi, id);
      return result;
    });
  });
}

import { AsyncLocalStorage } from "node:async_hooks";
import type { Core } from "@strapi/strapi";
import { validateSourcePrincipal, type SourcePrincipal } from "./source-principal";
import { withIdentityUserLock, lockIdentityUser } from "./user-lock";
import { SOURCE_IDENTITY_FIELDS } from "./identity-input";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const ROLE = "api::role.role";
const manifestFields = ["name", "username", "email", "displayName"] as const;
export type SourceRegistrationManifest = Readonly<Record<typeof manifestFields[number], string>>;
type RegistrationContext = {
  strapi: Core.Strapi;
  manifest: SourceRegistrationManifest;
  roleDocumentId: string;
  phase: "create" | "bind" | "grant" | "verify";
  userDocumentId?: string;
};
// Only the complete registration workflow below can construct this capability.
const registration = new AsyncLocalStorage<RegistrationContext>();

type WriteAuthority = Readonly<{
  strapi: Core.Strapi; operation: "create" | "replace" | "patch" | "deactivate" | "delete" | "linkage" | "protection";
  target: string | undefined; fields: readonly string[]; principal?: SourcePrincipal;
}>;
const writes = new AsyncLocalStorage<WriteAuthority>();
const activeWrites = new WeakSet<WriteAuthority>();

async function withWriteAuthority<T>(authority: WriteAuthority, work: () => Promise<T>): Promise<T> {
  activeWrites.add(authority);
  try { return await writes.run(authority, work); }
  finally { activeWrites.delete(authority); }
}

/** Trusted internal source operations only; the middleware revalidates under its lock. */
export async function runSourceMutation<T>(strapi: Core.Strapi, principal: SourcePrincipal,
  operation: "create" | "replace" | "patch" | "deactivate" | "delete", target: string | undefined,
  work: () => Promise<T>): Promise<T> {
  if (!["create", "replace", "patch", "deactivate", "delete"].includes(operation)
    || (operation === "create" ? target !== undefined : typeof target !== "string" || !target)) throw new Error("IAM_IDENTITY_FORBIDDEN");
  if (!await validateSourcePrincipal(strapi, principal)) throw new Error("IAM_IDENTITY_FORBIDDEN");
  const fields = operation === "create" || operation === "replace"
    ? [...SOURCE_IDENTITY_FIELDS, "identitySource", "lastSyncedAt", ...(operation === "create" ? ["roles", "protected"] : [])]
    : operation === "patch" ? [...SOURCE_IDENTITY_FIELDS, "lastSyncedAt"]
    : ["accountStatus", "lastSyncedAt", ...(operation === "delete" ? ["sourceDeletedAt"] : [])];
  return withWriteAuthority(Object.freeze({ strapi, principal, operation, target, fields: Object.freeze(fields) }), work);
}

/** This predicate grants only the exact operation/target/field set, never a caller flag. */
export function identityWriteAuthority(strapi: Core.Strapi, action: string, target: string | undefined, data: Record<string, unknown>) {
  const authority = writes.getStore();
  if (!authority || !activeWrites.has(authority) || authority.strapi !== strapi || authority.target !== target
    || (authority.operation === "create" ? action !== "create" : action !== "update")
    || Object.keys(data).some((field) => !authority.fields.includes(field))) return null;
  return authority;
}

/** Linkage cannot accept a callback or any fields beyond subject and password cleanup. */
export function runKeycloakLinkage(strapi: Core.Strapi, documentId: string, externalSubject: string | null) {
  if (!documentId || (externalSubject !== null && (typeof externalSubject !== "string" || !externalSubject || externalSubject.length > 255))) throw new Error("IAM_IDENTITY_FORBIDDEN");
  const data: Record<string, unknown> = { externalSubject, password: null };
  return withWriteAuthority(Object.freeze({ strapi, operation: "linkage", target: documentId, fields: ["externalSubject", "password"] }),
    () => strapi.documents(USER).update({ documentId, data }));
}
export function isKeycloakLinkage(strapi: Core.Strapi, target: string | undefined, data: Record<string, unknown>): boolean {
  return identityWriteAuthority(strapi, "update", target, data)?.operation === "linkage" && data.password === null;
}

/** Maintenance-only human protection, with ownership checked under the shared lock. */
export function runManualProtection(strapi: Core.Strapi, documentId: string, protectedValue: boolean) {
  if (!documentId || typeof protectedValue !== "boolean") throw new Error("IAM_IDENTITY_FORBIDDEN");
  return withIdentityUserLock(strapi, documentId, async () => {
    const user = await readService(strapi, documentId);
    if (!user || user.identitySource || user.sourceExternalId != null || user.sourceIdentityKey != null
      || await isRegisteredSourceService(strapi, documentId)) throw new Error("IAM_IDENTITY_FORBIDDEN");
    return withWriteAuthority(Object.freeze({ strapi, operation: "protection", target: documentId, fields: ["protected"] }),
      () => strapi.documents(USER).update({ documentId, data: { protected: protectedValue } }));
  });
}

export function isSourceRegistrationGrant(strapi: Core.Strapi, target: string | undefined, data: Record<string, unknown>): boolean {
  const context = registration.getStore();
  return !!context && context.strapi === strapi && context.phase === "grant" && context.userDocumentId === target
    && Object.keys(data).length === 1 && Array.isArray(data.roles) && data.roles.length === 1 && data.roles[0] === context.roleDocumentId;
}
export function isSourceRegistrationBinding(strapi: Core.Strapi, data: Record<string, unknown>): boolean {
  const context = registration.getStore();
  return !!context && context.strapi === strapi && context.phase === "bind" && Object.keys(data).length === 3
    && data.name === context.manifest.name && data.sourceStatus === "active" && data.serviceUser === context.userDocumentId;
}

function validateManifest(input: SourceRegistrationManifest): SourceRegistrationManifest {
  if (!input || typeof input !== "object" || Object.keys(input).length !== manifestFields.length
    || Object.keys(input).some((key) => !manifestFields.some((field) => field === key))) {
    throw new Error("IAM_SOURCE_REGISTRATION_MANIFEST");
  }
  for (const field of manifestFields) {
    const value = input[field];
    if (typeof value !== "string" || !value || value !== value.trim() || value.length > 255 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error("IAM_SOURCE_REGISTRATION_MANIFEST");
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("IAM_SOURCE_REGISTRATION_MANIFEST");
  return Object.freeze({ name: input.name, username: input.username, email: input.email, displayName: input.displayName });
}

async function provisioningRole(strapi: Core.Strapi) {
  const roles = await strapi.documents(ROLE).findMany({
    filters: { name: "Identity Provisioning" }, populate: { functions: { populate: { application: true } } },
  });
  const role = roles[0];
  const fn = role?.functions?.[0];
  if (roles.length !== 1 || role.functions?.length !== 1 || fn?.name !== "Identity Provisioning"
    || fn.menuPath || fn.application?.slug !== "idambox-iam" || fn.application?.applicationStatus !== "active") {
    throw new Error("IAM_SOURCE_PROVISIONING_GRANT");
  }
  return role;
}

async function readService(strapi: Core.Strapi, documentId: string) {
  return strapi.documents(USER).findOne({ documentId, populate: { roles: true, identitySource: true } });
}
function assertService(user: Awaited<ReturnType<typeof readService>>, roleDocumentId: string): asserts user is NonNullable<Awaited<ReturnType<typeof readService>>> {
  if (!user || user.protected !== true || user.accountStatus !== "active" || user.password != null || user.externalSubject != null
    || user.identitySource || user.sourceExternalId != null || user.sourceIdentityKey != null
    || user.roles?.length !== 1 || user.roles[0]?.documentId !== roleDocumentId) {
    throw new Error("IAM_SOURCE_SERVICE_INVARIANT");
  }
}
async function readSource(strapi: Core.Strapi, documentId: string) {
  return strapi.documents(SOURCE).findOne({ documentId, populate: { serviceUser: true } });
}

/** Atomic create-bind-grant; callers cannot supply a callback or a privilege flag. */
export async function runSourceRegistration(strapi: Core.Strapi, input: SourceRegistrationManifest) {
  const manifest = validateManifest(input);
  return withIdentityUserLock(strapi, undefined, async (trx) => {
    const role = await provisioningRole(strapi);
    const existing = await strapi.documents(SOURCE).findMany({ filters: { name: manifest.name }, populate: { serviceUser: true } });
    if (existing.length) {
      const source = existing[0];
      if (source.serviceUser) await lockIdentityUser(strapi, source.serviceUser.documentId, trx);
      const user = source.serviceUser && await readService(strapi, source.serviceUser.documentId);
      if (!user || user.username !== manifest.username || user.email !== manifest.email || user.displayName !== manifest.displayName) {
        throw new Error("IAM_SOURCE_REGISTRATION_COLLISION");
      }
      assertService(user, role.documentId);
      return { ...source, serviceUser: user };
    }
    const collisions = await strapi.documents(USER).count({ filters: { $or: [{ username: manifest.username }, { email: { $eqi: manifest.email } }] } });
    if (collisions) throw new Error("IAM_SOURCE_REGISTRATION_COLLISION");
    const context: RegistrationContext = { strapi, manifest, roleDocumentId: role.documentId, phase: "create" };
    return registration.run(context, async () => {
      const user = await strapi.documents(USER).create({ data: {
        username: manifest.username, email: manifest.email, displayName: manifest.displayName,
        protected: true, accountStatus: "active", roles: [],
      } });
      context.userDocumentId = user.documentId;
      context.phase = "bind";
      const source = await strapi.documents(SOURCE).create({ data: { name: manifest.name, sourceStatus: "active", serviceUser: user.documentId } });
      context.phase = "grant";
      await strapi.documents(USER).update({ documentId: user.documentId, data: { roles: [role.documentId] } });
      context.phase = "verify";
      const persistedSource = await readSource(strapi, source.documentId);
      const persistedUser = await readService(strapi, user.documentId);
      assertService(persistedUser, role.documentId);
      if (!persistedSource || persistedSource.name !== manifest.name || persistedSource.sourceStatus !== "active"
        || persistedSource.serviceUser?.documentId !== user.documentId || persistedSource.tokenHash != null
        || persistedSource.tokenRotatedAt != null || persistedSource.lastActivityAt != null
        || persistedUser.username !== manifest.username || persistedUser.email !== manifest.email || persistedUser.displayName !== manifest.displayName) {
        throw new Error("IAM_SOURCE_SERVICE_INVARIANT");
      }
      return { ...persistedSource, serviceUser: persistedUser };
    });
  });
}

/** Read-only middleware predicate: exact initial create, never protected people. */
export function isInitialSourceServiceCreate(strapi: Core.Strapi, data: Record<string, unknown>): boolean {
  const context = registration.getStore();
  if (!context || context.strapi !== strapi || context.phase !== "create") return false;
  const expected = {
    username: context.manifest.username, email: context.manifest.email, displayName: context.manifest.displayName,
    protected: true, accountStatus: "active", roles: [],
  };
  return Object.keys(data).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => key === "roles"
      ? Array.isArray(data.roles) && data.roles.length === 0 : data[key] === value);
}

/** Existing services qualify through persisted binding and the complete invariant. */
export async function isRegisteredSourceService(strapi: Core.Strapi, documentId: string): Promise<boolean> {
  const sources = await strapi.documents(SOURCE).findMany({ filters: { serviceUser: { documentId } }, limit: 2 });
  if (!sources.length) return false;
  if (sources.length !== 1) throw new Error("IAM_SOURCE_SERVICE_INVARIANT");
  const role = await provisioningRole(strapi);
  assertService(await readService(strapi, documentId), role.documentId);
  return true;
}

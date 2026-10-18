/** Internal source authority. This module has no bearer-token or transport entry point. */
const principalBrand: unique symbol = Symbol("SourcePrincipal");
export type SourcePrincipal = Readonly<{
  sourceDocumentId: string;
  serviceUserDocumentId: string;
  [principalBrand]: true;
}>;
type SourceReader = { documents(uid: string): {
  findOne(params: unknown): Promise<unknown>;
  findMany(params: unknown): Promise<unknown[]>;
} };
type BoundSource = { documentId: string; sourceStatus?: string; serviceUser?: { documentId: string } | null };
type ServiceUser = {
  documentId: string; accountStatus?: string; protected?: boolean; password?: unknown; externalSubject?: unknown;
  identitySource?: unknown; sourceExternalId?: unknown; sourceIdentityKey?: unknown;
  roles?: Array<{ documentId: string; name?: string; functions?: Array<{
    name?: string; menuPath?: unknown; application?: { slug?: string; applicationStatus?: string } | null;
  }> }>;
};
const SOURCE = "api::identity-source.identity-source";
const USER = "api::idambox-user.idambox-user";
// Object identity and instance binding prevent callers from constructing or copying authority.
const issued = new WeakMap<object, SourceReader>();

/** Persisted binding defines service status even when the source or its grants are invalid. */
export async function isRegisteredSourceServiceUser(strapi: SourceReader, documentId: string): Promise<boolean> {
  const sources = await strapi.documents(SOURCE).findMany({ filters: { serviceUser: { documentId: { $eq: documentId } } }, limit: 1 });
  return sources.length > 0;
}

export async function registeredSourceServiceUserDocumentIds(strapi: SourceReader): Promise<string[]> {
  const ids = new Set<string>();
  // Explicit pages avoid a default result limit silently admitting services to people selectors.
  const limit = 500;
  for (let start = 0; ; start += limit) {
    const sources = await strapi.documents(SOURCE).findMany({ fields: ["documentId"], populate: { serviceUser: { fields: ["documentId"] } }, sort: "documentId:asc", start, limit }) as BoundSource[];
    for (const source of sources) if (source.serviceUser?.documentId) ids.add(source.serviceUser.documentId);
    if (sources.length < limit) return [...ids];
  }
}

async function readValidBinding(strapi: SourceReader, sourceDocumentId: string): Promise<string | null> {
  const source = await strapi.documents(SOURCE).findOne({ documentId: sourceDocumentId, populate: { serviceUser: true } }) as BoundSource | null;
  if (!source || source.sourceStatus !== "active" || !source.serviceUser?.documentId) return null;
  const user = await strapi.documents(USER).findOne({ documentId: source.serviceUser.documentId,
    populate: { identitySource: true, roles: { populate: { functions: { populate: { application: true } } } } },
  }) as ServiceUser | null;
  const role = user?.roles?.[0];
  const fn = role?.functions?.[0];
  if (!user || user.documentId !== source.serviceUser.documentId || user.accountStatus !== "active" || user.protected !== true
    || user.password != null || user.externalSubject != null || user.identitySource != null
    || user.sourceExternalId != null || user.sourceIdentityKey != null || user.roles?.length !== 1
    || role?.name !== "Identity Provisioning" || role.functions?.length !== 1 || fn?.name !== "Identity Provisioning"
    || fn.menuPath || fn.application?.slug !== "idambox-iam" || fn.application.applicationStatus !== "active") return null;
  const bindings = await strapi.documents(SOURCE).findMany({ filters: { serviceUser: { documentId: { $eq: user.documentId } } }, limit: 2 }) as BoundSource[];
  if (bindings.length !== 1 || bindings[0].documentId !== sourceDocumentId) return null;
  return user.documentId;
}

/** Trusted backend callers only; a null tokenHash never authenticates a bearer request. */
export async function resolveSourcePrincipal(strapi: SourceReader, sourceDocumentId: string): Promise<SourcePrincipal | null> {
  const serviceUserDocumentId = await readValidBinding(strapi, sourceDocumentId);
  if (!serviceUserDocumentId) return null;
  const principal: SourcePrincipal = Object.freeze({ sourceDocumentId, serviceUserDocumentId, [principalBrand]: true as const });
  issued.set(principal, strapi);
  return principal;
}

/** Every operation must recheck persistence; a changed binding cannot transfer an old capability. */
export async function validateSourcePrincipal(strapi: SourceReader, principal: unknown): Promise<SourcePrincipal | null> {
  if (typeof principal !== "object" || principal === null || issued.get(principal) !== strapi) return null;
  const candidate = principal as SourcePrincipal;
  const serviceUserDocumentId = await readValidBinding(strapi, candidate.sourceDocumentId);
  return serviceUserDocumentId === candidate.serviceUserDocumentId ? candidate : null;
}

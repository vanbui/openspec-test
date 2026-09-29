import type { AuthorizationStrapi, IdamBoxIdentity } from "../../../policies/csrm-authorization";
import { EffectiveAccessError, readEffectiveAccess } from "../services/effective-access";

/*
 * GET /api/v1/me/access (docs/adr/0004). The route policy has already resolved
 * an active IdamBox User and checked the Current User Access API grant; the
 * handler refuses any query key and reports only the caller's own access.
 */

type RecordValue = Record<string, unknown>;

const ACCESS_QUERY_INVALID = "CSRM access query is invalid.";

function safeError(ctx: RecordValue, status: 400 | 403, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : ctx.forbidden;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

function isIdentity(value: unknown): value is IdamBoxIdentity {
  return typeof value === "object" && value !== null && typeof (value as { documentId?: unknown }).documentId === "string";
}

const accessController = {
  async get(ctx: RecordValue) {
    const query = ctx.query;
    if (typeof query === "object" && query !== null && Object.keys(query).length > 0) {
      return safeError(ctx, 400, ACCESS_QUERY_INVALID);
    }
    const identity = (ctx.state as RecordValue | undefined)?.idamboxUser;
    if (!isIdentity(identity)) return safeError(ctx, 403, "CSRM FunctionAPI access is denied.");

    try {
      const access = await readEffectiveAccess(globalThis.strapi as unknown as AuthorizationStrapi, identity);
      return { data: access };
    } catch (error) {
      if (error instanceof EffectiveAccessError) return safeError(ctx, 403, error.message);
      throw error;
    }
  },
};

export default accessController;

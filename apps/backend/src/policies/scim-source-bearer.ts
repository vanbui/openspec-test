import type { Core } from "@strapi/strapi";
import { requireSourceOperation, type SourceRequest } from "../iam/scim/source-context";

/** Authentication is established before parsing; this explicit policy rechecks the exact route grant. */
export default async function scimSourceBearer(context: SourceRequest, config: { operation: string },
  { strapi }: { strapi: Core.Strapi }): Promise<boolean> {
  const result = await requireSourceOperation(strapi, context, config.operation);
  if (!result.ok) {
    // The outer SCIM boundary can preserve the closed body and challenge without exposing an internal error.
    throw Object.assign(new Error(result.error.body.detail), result.error, { expose: true });
  }
  return true;
}

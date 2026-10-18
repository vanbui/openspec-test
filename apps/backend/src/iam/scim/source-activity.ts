import type { Core } from "@strapi/strapi";
import { validateSourcePrincipal, type SourcePrincipal } from "../identity/source-principal";

/** Commit before entering any user mutation transaction; never join an ambient transaction. */
export async function recordSourceActivity(strapi: Core.Strapi, principal: SourcePrincipal): Promise<void> {
  try {
    if (strapi.db.inTransaction()) throw new Error("IAM_SCIM_ACTIVITY_REQUIRES_INDEPENDENT_TRANSACTION");
    if (!await validateSourcePrincipal(strapi, principal)) throw new Error("IAM_SCIM_ACTIVITY_INVALID_PRINCIPAL");
    await strapi.db.transaction(async () => {
      await strapi.documents("api::identity-source.identity-source").update({
        documentId: principal.sourceDocumentId, data: { lastActivityAt: new Date().toISOString() },
      });
    });
  } catch {
    strapi.log.error(JSON.stringify({ event: "scim.activity", outcome: "failure" }));
    throw new Error("IAM_SCIM_ACTIVITY_FAILED");
  }
}

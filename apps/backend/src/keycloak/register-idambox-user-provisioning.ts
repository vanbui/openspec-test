import type { Core } from "@strapi/strapi";

import { KeycloakAdminClient } from "./admin-client";
import { readKeycloakProvisioningConfig } from "./config";
import { IDAMBOX_USER_UID, type IdamBoxUserDocument, provisionIdamboxUser } from "./provision-idambox-user";

type DocumentMiddleware = Parameters<Core.Strapi["documents"]["use"]>[0];

// Attributes Keycloak mirrors. An update that sets none of them skips Keycloak.
const PROVISIONED_FIELDS = [
  "email",
  "username",
  "firstName",
  "lastName",
  "displayName",
  "accountStatus",
  "password",
  "externalSubject",
] as const;

/*
 * Registers the IdamBox User -> Keycloak document middleware when
 * IDAMBOX_KEYCLOAK_PROVISIONING=true, and does nothing otherwise: no config
 * beyond the flag is read, no admin client exists and no middleware is added.
 * Incomplete configuration throws here, so Strapi refuses to start. Returns
 * whether provisioning is active.
 */
export function registerIdamboxUserProvisioning(
  strapi: Core.Strapi,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const config = readKeycloakProvisioningConfig(env);
  if (!config) return false;

  strapi.documents.use(createIdamboxUserProvisioningMiddleware(strapi, new KeycloakAdminClient(config)));
  strapi.log.info(`Keycloak user provisioning is enabled for realm "${config.realm}" at ${config.baseUrl}.`);
  return true;
}

/*
 * Keycloak is part of the IdamBox User write (D-04, docs/adr/0002). The Strapi
 * write, the Keycloak create/update and the externalSubject/password write-back
 * share one database transaction: the document service joins it instead of
 * opening its own. Any Keycloak failure throws, which rolls the Strapi write
 * back, so neither a Strapi user without a Keycloak account nor a persisted
 * password hash is left behind. A Keycloak account created just before a
 * failed commit is adopted by email on the next attempt.
 */
export function createIdamboxUserProvisioningMiddleware(
  strapi: Core.Strapi,
  client: KeycloakAdminClient,
): DocumentMiddleware {
  return async (context, next) => {
    if (context.uid !== IDAMBOX_USER_UID || (context.action !== "create" && context.action !== "update")) {
      return next();
    }

    const data = readWriteData(context.params);
    // Captured before next(): the document service replaces it with a bcrypt hash.
    const password = typeof data.password === "string" && data.password.trim() !== "" ? data.password : null;

    return strapi.db.transaction(async () => {
      const result = await next();
      const user = asIdamboxUser(result);
      if (!user) return result;
      if (context.action === "update" && user.externalSubject && !PROVISIONED_FIELDS.some((field) => field in data)) {
        return result;
      }

      let externalSubject: string;
      try {
        externalSubject = await provisionIdamboxUser(client, user, password);
      } catch (error) {
        strapi.log.error(
          `Keycloak provisioning failed for IdamBox user ${user.documentId}; the ${context.action} is rolled back. `
            + (error instanceof Error ? error.message : "Unknown error."),
        );
        throw error;
      }

      // D-12/D-18: store the Keycloak id and clear the transient password. The
      // query layer skips document validation, which a null password would fail.
      await strapi.db.query(IDAMBOX_USER_UID).update({
        where: { documentId: user.documentId },
        data: { externalSubject, password: null },
      });
      return Object.assign(result as object, { externalSubject, password: null }) as typeof result;
    });
  };
}

function readWriteData(params: unknown): Record<string, unknown> {
  const data = (params as { data?: unknown } | undefined)?.data;
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function asIdamboxUser(result: unknown): IdamBoxUserDocument | null {
  const user = result as Partial<IdamBoxUserDocument> | null | undefined;
  return typeof user?.documentId === "string" && typeof user.email === "string" ? (user as IdamBoxUserDocument) : null;
}

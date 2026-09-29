import type { Core } from "@strapi/strapi";

import { createAccessTokenVerifier, type AccessTokenVerifier } from "../keycloak/access-token-verifier";
import { readKeycloakTokenVerificationConfig } from "../keycloak/token-verification-config";

/*
 * The web's OIDC session forwards the caller's own Keycloak access token in this
 * header. `Authorization` stays with the users-permissions API token, which
 * still guards the outer content-api gate (docs/adr/0004).
 */
export const IDENTITY_TOKEN_HEADER = "x-csrm-identity-token";

type KeycloakIdentity = {
  accountStatus?: string;
  documentId: string;
};

type KeycloakIdentityContext = {
  get: (name: string) => string;
  state: Record<string, unknown>;
};

type KeycloakIdentityService = {
  findMany: (input: {
    filters: { externalSubject: { $eq: string } };
    limit: number;
  }) => Promise<KeycloakIdentity[]>;
};

type Middleware = (context: KeycloakIdentityContext, next: () => Promise<unknown>) => Promise<void>;

/*
 * A verified token's `sub` is matched to exactly one active IdamBox User by
 * `externalSubject` (ADR 0002 writes it back on provisioning). Anything else —
 * no header, a rejected token, an unknown subject, an inactive account or a
 * failed lookup — leaves `idamboxUser` unset, so csrm-authorization answers the
 * same 403 it gives an absent identity today. The reason is logged by name only,
 * never with the token.
 */
export function createKeycloakIdentityMiddleware(strapi: Core.Strapi, verify: AccessTokenVerifier): Middleware {
  return async (context, next) => {
    const token = context.get(IDENTITY_TOKEN_HEADER);

    if (token) {
      try {
        const subject = await verify(token);
        const identityService = strapi.documents(
          "api::idambox-user.idambox-user",
        ) as unknown as KeycloakIdentityService;
        const [identity] = await identityService.findMany({
          filters: { externalSubject: { $eq: subject } },
          limit: 1,
        });

        if (identity?.accountStatus === "active") {
          context.state.idamboxUser = { documentId: identity.documentId };
        }
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        strapi.log.warn(`CSRM Keycloak identity failed closed (${name}).`);
      }
    }

    await next();
  };
}

export default function csrmKeycloakIdentity(_config: unknown, { strapi }: { strapi: Core.Strapi }): Middleware {
  const config = readKeycloakTokenVerificationConfig();
  if (!config) {
    return async (_context, next) => {
      await next();
    };
  }

  return createKeycloakIdentityMiddleware(strapi, createAccessTokenVerifier(config));
}

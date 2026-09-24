import type { Core } from "@strapi/strapi";

import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

type DevelopmentIdentity = {
  accountStatus?: string;
  documentId: string;
};

type DevelopmentIdentityContext = {
  get: (name: string) => string;
  state: Record<string, unknown>;
};

type DevelopmentIdentityService = {
  findMany: (input: {
    filters: { email: { $eq: string } };
    limit: number;
  }) => Promise<DevelopmentIdentity[]>;
};

export default function csrmDevelopmentIdentity(
  _config: unknown,
  { strapi }: { strapi: Core.Strapi },
) {
  return async (
    context: DevelopmentIdentityContext,
    next: () => Promise<unknown>,
  ): Promise<void> => {
    if (developmentIdentityEnabled()) {
      const email = context.get("x-csrm-dev-identity");

      if (email) {
        try {
          const identityService = strapi.documents(
            "api::idambox-user.idambox-user",
          ) as unknown as DevelopmentIdentityService;
          const [identity] = await identityService.findMany({
            filters: { email: { $eq: email } },
            limit: 1,
          });

          if (identity?.accountStatus === "active") {
            context.state.idamboxUser = { documentId: identity.documentId };
          }
        } catch {
          strapi.log.warn("CSRM development identity lookup failed closed.");
        }
      }
    }

    await next();
  };
}

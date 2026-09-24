import type { Core } from "@strapi/strapi";

import { CSRM_INFORMATION_SYSTEM_OPERATIONS } from "../operations";

/**
 * The bounded selector hydration route lives in its own router. Spreading it
 * into the core router's own route list drops the auth scope Strapi fills in on
 * the core-router path, which fails route registration for the whole server.
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/v1/information_systems/selected",
      handler: "api::csrm-information-system.csrm-information-system.selected",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { requireReferenceDataScope: true, operation: CSRM_INFORMATION_SYSTEM_OPERATIONS.selected },
          },
        ],
      },
    },
  ],
};

export default config;

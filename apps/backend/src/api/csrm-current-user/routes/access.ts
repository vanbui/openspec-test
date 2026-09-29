import type { Core } from "@strapi/strapi";

import { CSRM_CURRENT_USER_OPERATIONS } from "../operations";

/*
 * The signed-in IdamBox User's own effective access (docs/adr/0004). It is
 * granted to every Role, so the Requestor birthright is enough; the policy still
 * requires a resolved, active identity like every other CSRM operation.
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/me/access",
      handler: "api::csrm-current-user.access.get",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_CURRENT_USER_OPERATIONS.getAccess } },
        ],
      },
    },
  ],
};

export default config;

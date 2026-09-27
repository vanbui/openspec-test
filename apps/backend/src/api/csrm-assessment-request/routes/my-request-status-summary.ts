import type { Core } from "@strapi/strapi";

import { myRequestStatusSummary } from "../operations";

/**
 * The owner-scoped request status summary lives in its own router, beside the
 * core router rather than spread into it, so Strapi keeps the auth scope it
 * fills in for each router's routes (see csrm-information-asset/routes/selected.ts).
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/my_requests/status_summary",
      handler: "api::csrm-assessment-request.my-request-status-summary.statusSummary",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { operation: myRequestStatusSummary, requireRequestCollectionScope: true },
          },
        ],
      },
    },
  ],
};

export default config;

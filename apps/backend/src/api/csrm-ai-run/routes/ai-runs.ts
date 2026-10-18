import type { Core } from "@strapi/strapi";

import { CSRM_AI_RUN_OPERATIONS } from "../operations";

/**
 * The AI run read lives in its own router, beside the core router (which serves no routes), so Strapi keeps
 * the auth scope it fills in for each router's routes (see csrm-information-asset/routes/selected.ts).
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/ai_runs/:runId",
      handler: "api::csrm-ai-run.csrm-ai-run.findRun",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_AI_RUN_OPERATIONS.getRun } },
        ],
      },
    },
  ],
};

export default config;

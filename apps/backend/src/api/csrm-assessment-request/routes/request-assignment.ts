import type { Core } from "@strapi/strapi";

import { CSRM_REQUEST_ASSIGNMENT_OPERATIONS } from "../operations";

/**
 * Phase 13 (D-05, D-06, D-30): the request assignment operation and the eligible-analyst read, in their own router beside the core router so Strapi keeps
 * the auth scope it fills in for each router's routes (the my-request-status-summary.ts shape). The policy grants it
 * each to the human Security Analyst alone and refuses automation (HUMAN_ANALYST_ONLY_OPERATIONS); there is no
 * ownership check, because G-1's OWN_REQUEST is decided in the service (for the change, inside the request lock).
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "PUT",
      path: "/v1/assessment_requests/:requestId/assignee",
      handler: "api::csrm-assessment-request.request-assignment.changeAssignee",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { operation: CSRM_REQUEST_ASSIGNMENT_OPERATIONS.changeAssignee },
          },
        ],
      },
    },
    {
      method: "GET",
      path: "/v1/assessment_requests/:requestId/assignable_analysts",
      handler: "api::csrm-assessment-request.request-assignment.listAssignableAnalysts",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { operation: CSRM_REQUEST_ASSIGNMENT_OPERATIONS.listAssignableAnalysts },
          },
        ],
      },
    },
  ],
};

export default config;

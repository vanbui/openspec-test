import type { Core } from "@strapi/strapi";

import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../operations";

/*
 * The analyst report operations (D-05, D-13). Both are read-only and granted to
 * the human Security Analyst only. The policy refuses any automation identity
 * and sets the analyst insight scope that each controller asserts first, so it
 * runs before the report key or the query is read.
 */
const insightPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystInsightScope: true } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/reports",
      handler: "api::csrm-analyst-insight.reports.list",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.listReports),
      },
    },
    {
      method: "GET",
      path: "/v1/reports/:reportKey",
      handler: "api::csrm-analyst-insight.reports.get",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_OPERATIONS.getReport),
      },
    },
  ],
};

export default config;

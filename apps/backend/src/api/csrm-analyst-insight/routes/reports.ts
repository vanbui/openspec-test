import type { Core } from "@strapi/strapi";

import { CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS, CSRM_ANALYST_INSIGHT_OPERATIONS } from "../operations";

/*
 * The analyst report operations (D-05, D-13). All are granted to the human
 * Security Analyst only. The policy refuses any automation identity and sets
 * the analyst insight scope that each controller asserts first, so it runs
 * before the report key, the query or the body is read. The export (Phase 19
 * D-13, D-22) also names the report read it discloses (underlyingRead); the key
 * is added only when given, so the reads' configs keep exactly two keys.
 */
const insightPolicies = (operation: string, underlyingRead?: string) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: { operation, requireAnalystInsightScope: true, ...(underlyingRead === undefined ? {} : { underlyingRead }) },
  },
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
    {
      // Phase 19 (D-03, D-22): the catalogue's reserved report export, the report's tables as one file.
      method: "POST",
      path: "/v1/reports/:reportKey/export",
      handler: "api::csrm-analyst-insight.reports.export",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: insightPolicies(CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS.exportReport, CSRM_ANALYST_INSIGHT_OPERATIONS.getReport),
      },
    },
  ],
};

export default config;

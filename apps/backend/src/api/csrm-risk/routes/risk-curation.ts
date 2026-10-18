import type { Core } from "@strapi/strapi";

import { CSRM_RISK_OPERATIONS } from "../operations";

/*
 * Phase 16 risk curation (D-03 items 1 to 3, D-43): withdrawal, reinstatement and the history read live in their own
 * router beside the Risk routes (the my-request-status-summary shape), so Strapi keeps the auth scope it fills in for
 * each router's routes. Every operation is human Security Analyst only: an API-only Function on role.security_analyst
 * and HUMAN_ANALYST_ONLY_OPERATIONS; the handlers then require the analyst assessment scope.
 */
const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/v1/risk_assessments/:assessmentId/risk_withdrawals",
      handler: "api::csrm-risk.risk-curation.withdraw",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.withdrawRisks) },
    },
    {
      method: "POST",
      path: "/v1/risk_assessments/:assessmentId/risk_reinstatements",
      handler: "api::csrm-risk.risk-curation.reinstate",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.reinstateRisks) },
    },
    {
      method: "GET",
      path: "/v1/risks/:riskId/history",
      handler: "api::csrm-risk.risk-curation.history",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.getRiskHistory) },
    },
  ],
};

export default config;

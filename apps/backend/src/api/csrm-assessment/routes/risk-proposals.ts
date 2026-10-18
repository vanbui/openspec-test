import type { Core } from "@strapi/strapi";

import { CSRM_ASSESSMENT_OPERATIONS } from "../operations";

/*
 * Phase 16 risk AI proposals (D-03 items 4 to 7, D-26, D-41, D-43): asking the AI to suggest more risks or rewrite one
 * risk, following and retrying a risk proposal job and reading an assessment's AI proposals live in their own router
 * beside the assessment routes (the extra-router shape), so Strapi keeps the auth scope it fills in for each router's
 * routes. Every operation is human Security Analyst only: an API-only Function on role.security_analyst and
 * HUMAN_ANALYST_ONLY_OPERATIONS. The job routes carry no record scope in the policy: the service checks the job's
 * assessment after loading the job, as the generation job routes do.
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
      path: "/v1/risk_assessments/:assessmentId/risk_suggestions",
      handler: "api::csrm-assessment.risk-proposals.startSuggestions",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.startRiskSuggestions) },
    },
    {
      method: "POST",
      path: "/v1/risks/:riskId/rewrite",
      handler: "api::csrm-assessment.risk-proposals.startRewrite",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.startRiskRewrite) },
    },
    {
      method: "GET",
      path: "/v1/risk_proposal_jobs/:jobId",
      handler: "api::csrm-assessment.risk-proposals.getJob",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.getRiskProposalJob) },
    },
    {
      method: "POST",
      path: "/v1/risk_proposal_jobs/:jobId/retry",
      handler: "api::csrm-assessment.risk-proposals.retryJob",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.retryRiskProposalJob) },
    },
    {
      method: "GET",
      path: "/v1/risk_assessments/:assessmentId/ai_proposals",
      handler: "api::csrm-assessment.risk-proposals.listProposals",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.listRiskAiProposals) },
    },
  ],
};

export default config;

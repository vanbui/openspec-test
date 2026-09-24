import type { Core } from "@strapi/strapi";

import { CSRM_ASSESSMENT_DRAFT_OPERATIONS, CSRM_ASSESSMENT_OPERATIONS } from "../operations";

const policies = (operation: string, requireAssessmentOwnerCollectionScope = false) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, ...(requireAssessmentOwnerCollectionScope ? { requireAssessmentOwnerCollectionScope: true } : {}) } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/my_risk_assessments/rating_summary",
      handler: "api::csrm-assessment.csrm-assessment.myRatingSummary",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("GET:/api/v1/my_risk_assessments/rating_summary", true) },
    },
    {
      method: "GET",
      path: "/v1/my_risk_assessments",
      handler: "api::csrm-assessment.csrm-assessment.listMyReleasedAssessments",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("GET:/api/v1/my_risk_assessments", true) },
    },
    {
      method: "GET",
      path: "/v1/risk_assessments/status_summary",
      handler: "api::csrm-assessment.csrm-assessment.statusSummary",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.statusSummary) },
    },
    {
      method: "GET",
      path: "/v1/risk_assessments",
      handler: "api::csrm-assessment.csrm-assessment.listAssessments",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.list) },
    },
    {
      method: "PATCH",
      path: "/v1/risk_assessments/:assessmentId",
      handler: "api::csrm-assessment.csrm-assessment.updateAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.update) },
    },
    {
      method: "POST",
      path: "/v1/risk_assessments/:assessmentId/release",
      handler: "api::csrm-assessment.csrm-assessment.releaseAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("POST:/api/v1/risk_assessments/{assessmentId}/release") },
    },
    {
      method: "GET",
      path: "/v1/risk_assessments/:assessmentId",
      handler: "api::csrm-assessment.csrm-assessment.getAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.findOne) },
    },
    {
      method: "GET",
      path: "/v1/risk_assessments/:assessmentId/risks",
      handler: "api::csrm-assessment.csrm-assessment.listAssessmentRisks",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("GET:/api/v1/risk_assessments/{assessmentId}/risks") },
    },
    {
      method: "GET",
      path: "/v1/risks/:riskId/control_implementations",
      handler: "api::csrm-assessment.csrm-assessment.listRiskControlImplementations",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("GET:/api/v1/risks/{riskId}/control_implementations") },
    },
    {
      method: "POST",
      path: "/v1/assessment_draft_jobs/:jobId/retry",
      handler: "api::csrm-assessment.csrm-assessment.retryDraftJob",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_DRAFT_OPERATIONS.retryJob) },
    },
    {
      method: "GET",
      path: "/v1/assessment_draft_jobs/:jobId",
      handler: "api::csrm-assessment.csrm-assessment.getDraftJob",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_DRAFT_OPERATIONS.getJob) },
    },
  ],
};

export default config;

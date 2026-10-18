import type { Core } from "@strapi/strapi";

import { CSRM_ASSESSMENT_DRAFT_OPERATIONS, CSRM_ASSESSMENT_OPERATIONS } from "../operations";
import { CSRM_CONTROL_IMPLEMENTATION_OPERATIONS } from "../../csrm-control-implementation/operations";
import { CSRM_RISK_OPERATIONS } from "../../csrm-risk/operations";

/** The released reads the released export discloses beside the detail read (D-21; BE2-01). */
const RELEASED_EXPORT_ADDITIONAL_READS: readonly string[] = Object.freeze([
  CSRM_RISK_OPERATIONS.list,
  CSRM_CONTROL_IMPLEMENTATION_OPERATIONS.list,
]);

const policies = (operation: string, requireAssessmentOwnerCollectionScope = false, underlyingRead?: string, additionalUnderlyingReads?: readonly string[]) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: {
      operation,
      ...(requireAssessmentOwnerCollectionScope ? { requireAssessmentOwnerCollectionScope: true } : {}),
      // Phase 19 (D-13): an export also requires the read whose records it discloses.
      ...(underlyingRead ? { underlyingRead } : {}),
      ...(additionalUnderlyingReads ? { additionalUnderlyingReads } : {}),
    },
  },
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
      // Phase 19 (D-04, D-13): before /v1/my_risk_assessments, in its owner scope, with the list read it discloses.
      method: "GET",
      path: "/v1/my_risk_assessments/export",
      handler: "api::csrm-assessment.csrm-assessment.exportMyAssessments",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.exportMine, true, "GET:/api/v1/my_risk_assessments") },
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
      // Phase 19 (D-04, D-13): before /v1/risk_assessments/:assessmentId, with the list read it discloses.
      method: "GET",
      path: "/v1/risk_assessments/export",
      handler: "api::csrm-assessment.csrm-assessment.exportAssessments",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.exportList, false, CSRM_ASSESSMENT_OPERATIONS.list) },
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
      path: "/v1/risk_assessments/:assessmentId/ai_proposal_decisions",
      handler: "api::csrm-assessment.csrm-assessment.decideAiProposals",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.decideAiProposals) },
    },
    {
      method: "POST",
      path: "/v1/risk_assessments/:assessmentId/release",
      handler: "api::csrm-assessment.csrm-assessment.releaseAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies("POST:/api/v1/risk_assessments/{assessmentId}/release") },
    },
    {
      // Phase 19 (D-14, D-21): before /v1/risk_assessments/:assessmentId, with the three released reads it discloses: the
      // detail, the released risks read and each Risk's control implementations read (BE2-01).
      method: "GET",
      path: "/v1/risk_assessments/:assessmentId/export",
      handler: "api::csrm-assessment.csrm-assessment.exportReleasedAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ASSESSMENT_OPERATIONS.exportReleased, false, CSRM_ASSESSMENT_OPERATIONS.findOne, RELEASED_EXPORT_ADDITIONAL_READS) },
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

import type { Core } from "@strapi/strapi";

import { CSRM_QUESTIONNAIRE_OPERATIONS } from "../operations";

/*
 * "collection" is a My list and is owner-scoped for every actor, analysts
 * included. "review-collection" is the analyst review surface and stays wide,
 * which is the whole reason it is a separate route from /v1/my_questionnaires.
 */
const policies = (
  operation: string,
  scope: "collection" | "review-collection" | "resource",
  /*
   * Set on every Requestor-reachable questionnaire resource route. A generated
   * questionnaire is analyst-only until an explicit Analyst release (D-05), and
   * that gate is enforced here in the authorization layer rather than by the
   * links the browser happens to render.
   */
  requireRelease = false,
) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: {
      operation,
      ...(scope === "resource"
        ? { requireQuestionnaireOwnership: true }
        : { requireQuestionnaireCollectionScope: true }),
      ...(scope === "review-collection" ? { allowAnalystQuestionnaireReviewScope: true } : {}),
      ...(requireRelease ? { requireQuestionnaireReleasedForRequestor: true } : {}),
    },
  },
];

const generationPolicies = (operation: string, requestScope = false) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, ...(requestScope ? { requireRequestOwnership: true } : {}) } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/questions",
      handler: "api::csrm-questionnaire.csrm-questionnaire.addQuestion",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.addQuestion, "resource") },
    },
    {
      method: "PATCH",
      path: "/v1/questionnaires/:questionnaireId/questions/:questionId",
      handler: "api::csrm-questionnaire.csrm-questionnaire.editQuestion",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.editQuestion, "resource") },
    },
    {
      method: "DELETE",
      path: "/v1/questionnaires/:questionnaireId/questions/:questionId",
      handler: "api::csrm-questionnaire.csrm-questionnaire.deleteQuestion",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.deleteQuestion, "resource") },
    },
    {
      method: "POST",
      path: "/v1/assessment_requests/:requestId/generate_questionnaire",
      handler: "api::csrm-questionnaire.csrm-questionnaire.generateQuestionnaire",
      config: { policies: generationPolicies(CSRM_QUESTIONNAIRE_OPERATIONS.generate, true) },
    },
    {
      method: "GET",
      path: "/v1/questionnaire_generation_jobs/:jobId",
      handler: "api::csrm-questionnaire.csrm-questionnaire.getGenerationJob",
      config: { policies: generationPolicies(CSRM_QUESTIONNAIRE_OPERATIONS.getGenerationJob) },
    },
    {
      method: "POST",
      path: "/v1/questionnaire_generation_jobs/:jobId/retry",
      handler: "api::csrm-questionnaire.csrm-questionnaire.retryGenerationJob",
      config: { policies: generationPolicies(CSRM_QUESTIONNAIRE_OPERATIONS.retryGenerationJob) },
    },
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/release",
      handler: "api::csrm-questionnaire.csrm-questionnaire.release",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.release, "resource") },
    },
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/return_to_review",
      handler: "api::csrm-questionnaire.csrm-questionnaire.returnToReview",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.returnToReview, "resource") },
    },
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/revert_to_draft",
      handler: "api::csrm-questionnaire.csrm-questionnaire.revertToDraft",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.revertToDraft, "resource", true) },
    },
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/generate_assessment",
      handler: "api::csrm-questionnaire.csrm-questionnaire.generateAssessment",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.generateAssessment, "resource") },
    },
    {
      method: "GET",
      path: "/v1/my_questionnaires/status_summary",
      handler: "api::csrm-questionnaire.csrm-questionnaire.statusSummary",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.statusSummary, "collection") },
    },
    {
      method: "GET",
      path: "/v1/my_questionnaires",
      handler: "api::csrm-questionnaire.csrm-questionnaire.listMine",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.listMine, "collection") },
    },
    {
      method: "GET",
      path: "/v1/questionnaires/review_summary",
      handler: "api::csrm-questionnaire.csrm-questionnaire.reviewSummary",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.reviewSummary, "review-collection") },
    },
    {
      method: "GET",
      path: "/v1/questionnaires",
      handler: "api::csrm-questionnaire.csrm-questionnaire.listAll",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.listAll, "review-collection") },
    },
    {
      method: "PATCH",
      path: "/v1/questionnaires/:questionnaireId/answers",
      handler: "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
      config: { policies: policies("PATCH:/api/v1/questionnaires/{questionnaireId}/answers", "resource", true) },
    },
    {
      method: "POST",
      path: "/v1/questionnaires/:questionnaireId/submit",
      handler: "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
      config: { policies: policies("POST:/api/v1/questionnaires/{questionnaireId}/submit", "resource", true) },
    },
    {
      method: "GET",
      path: "/v1/questionnaires/:questionnaireId/questions",
      handler: "api::csrm-questionnaire.csrm-questionnaire.listQuestions",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.listQuestions, "resource", true) },
    },
    {
      method: "GET",
      path: "/v1/questionnaires/:questionnaireId",
      handler: "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
      config: { policies: policies(CSRM_QUESTIONNAIRE_OPERATIONS.findOne, "resource", true) },
    },
  ],
};

export default config;

import type { Core } from "@strapi/strapi";

export const HISTORICAL_DEVELOPMENT_CONTENT_API_ACTIONS = [
  "api::csrm-assessment-request.csrm-assessment-request.find",
  "api::csrm-assessment-request.csrm-assessment-request.findOne",
  "api::csrm-assessment-request.csrm-assessment-request.create",
  "api::csrm-assessment-request.csrm-assessment-request.update",
  "api::csrm-information-system.csrm-information-system.find",
  "api::csrm-information-asset.csrm-information-asset.find",
  "api::csrm-questionnaire.csrm-questionnaire.listMine",
  "api::csrm-questionnaire.csrm-questionnaire.statusSummary",
  "api::csrm-questionnaire.csrm-questionnaire.listAll",
  "api::csrm-questionnaire.csrm-questionnaire.reviewSummary",
  "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
  "api::csrm-questionnaire.csrm-questionnaire.listQuestions",
  "api::csrm-questionnaire.csrm-questionnaire.saveAnswers",
  "api::csrm-questionnaire.csrm-questionnaire.submitQuestionnaire",
  "api::csrm-questionnaire.csrm-questionnaire.generateAssessment",
  "api::csrm-assessment.csrm-assessment.statusSummary",
  "api::csrm-assessment.csrm-assessment.listAssessments",
  "api::csrm-assessment.csrm-assessment.updateAssessment",
  "api::csrm-assessment.csrm-assessment.getAssessment",
  "api::csrm-assessment.csrm-assessment.releaseAssessment",
  "api::csrm-assessment.csrm-assessment.listMyReleasedAssessments",
  "api::csrm-assessment.csrm-assessment.myRatingSummary",
  "api::csrm-assessment.csrm-assessment.listAssessmentRisks",
  "api::csrm-assessment.csrm-assessment.listRiskControlImplementations",
  "api::csrm-assessment.csrm-assessment.getDraftJob",
  "api::csrm-assessment.csrm-assessment.retryDraftJob",
  "api::csrm-risk.csrm-risk.createAssessmentRisk",
  "api::csrm-risk.csrm-risk.updateRisk",
  "api::csrm-risk.csrm-risk.listRiskTypes",
  "api::csrm-risk.csrm-risk.listControls",
  "api::csrm-risk.csrm-risk.searchActiveUsers",
  "api::csrm-control-implementation.csrm-control-implementation.createRiskControlImplementation",
  "api::csrm-control-implementation.csrm-control-implementation.updateControlImplementation",
  "api::csrm-control-implementation.csrm-control-implementation.deleteControlImplementation",
] as const;

type PublicRole = { id: number };
type Permission = { id: number; action: string };
type PermissionStore = {
  findMany: (input: { where: { role: number } }) => Promise<Permission[]>;
  delete: (input: { where: { id: number } }) => Promise<unknown>;
};

export async function reconcileDevelopmentPublicPermissions(strapi: Core.Strapi): Promise<void> {
  const publicRole = (await strapi.query("plugin::users-permissions.role").findOne({
    where: { type: "public" },
  })) as PublicRole | null;
  if (!publicRole) throw new Error("Users-permissions public role was not found.");

  const permissionStore = strapi.query("plugin::users-permissions.permission") as unknown as PermissionStore;
  const managedActions = new Set<string>(HISTORICAL_DEVELOPMENT_CONTENT_API_ACTIONS);
  const permissions = await permissionStore.findMany({ where: { role: publicRole.id } });
  for (const permission of permissions) {
    if (managedActions.has(permission.action)) {
      await permissionStore.delete({ where: { id: permission.id } });
    }
  }
  strapi.log.info("CSRM historical public Content API permissions reconciled.");
}

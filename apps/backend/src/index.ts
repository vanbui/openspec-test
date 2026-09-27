import type { Core } from '@strapi/strapi';
import { seedCsrmData } from './bootstrap/seed-csrm-data';
import { disableUsersPermissionsRegistration } from './bootstrap/disable-users-permissions-registration';
import { seedCoreData } from './bootstrap/seed-core-data';
import { reconcileDevelopmentPublicPermissions } from './bootstrap/reconcile-development-public-permissions';
import { seedQuestionnaireWorkflow } from './bootstrap/seed-questionnaire-workflow';
import { seedAssessmentWorkflow } from './bootstrap/seed-assessment-workflow';
import { seedAssessmentNavigationLifecycle } from './bootstrap/seed-assessment-navigation-lifecycle';
import { seedRiskRegisterWorkflow } from './bootstrap/seed-risk-register-workflow';
import { seedAnalystInsights } from './bootstrap/seed-analyst-insights';
import { seedDevelopmentApiToken } from './bootstrap/seed-development-api-token';
import { assertCsrmAiConfiguration } from './csrm/ai-config-validation';
// import { registerIdamboxUserProvisioning } from './keycloak/register-idambox-user-provisioning';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    assertCsrmAiConfiguration(strapi);
    // registerIdamboxUserProvisioning(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // D-37: unconditional, before any seed, so no boot leaves registration open.
    await disableUsersPermissionsRegistration(strapi);
    await seedCoreData(strapi);
    await seedCsrmData(strapi);
    // The Phase 7 fixture runs before the other development fixtures Jane owns,
    // so its requests are her least recently updated and never displace theirs
    // from her default list, which sorts by last update.
    await seedAnalystInsights(strapi);
    await seedQuestionnaireWorkflow(strapi);
    await seedAssessmentWorkflow(strapi);
    await seedAssessmentNavigationLifecycle(strapi);
    await seedRiskRegisterWorkflow(strapi);
    await reconcileDevelopmentPublicPermissions(strapi);
    await seedDevelopmentApiToken(strapi);
  },
};

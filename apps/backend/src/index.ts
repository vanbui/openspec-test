import type { Core } from '@strapi/strapi';
import { seedCsrmData } from './bootstrap/seed-csrm-data';
import { seedCoreData } from './bootstrap/seed-core-data';
import { reconcileDevelopmentPublicPermissions } from './bootstrap/reconcile-development-public-permissions';
import { seedQuestionnaireWorkflow } from './bootstrap/seed-questionnaire-workflow';
import { seedAssessmentWorkflow } from './bootstrap/seed-assessment-workflow';
import { seedAssessmentNavigationLifecycle } from './bootstrap/seed-assessment-navigation-lifecycle';
import { seedRiskRegisterWorkflow } from './bootstrap/seed-risk-register-workflow';
import { seedDevelopmentApiToken } from './bootstrap/seed-development-api-token';
import { assertCsrmAiConfiguration } from './csrm/ai-config-validation';
// import { registerIdamboxUserProvisioning } from './keycloak/register-idambox-user-provisioning';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    assertCsrmAiConfiguration(strapi);
    // registerIdamboxUserProvisioning(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedCoreData(strapi);
    await seedCsrmData(strapi);
    await seedQuestionnaireWorkflow(strapi);
    await seedAssessmentWorkflow(strapi);
    await seedAssessmentNavigationLifecycle(strapi);
    await seedRiskRegisterWorkflow(strapi);
    await reconcileDevelopmentPublicPermissions(strapi);
    await seedDevelopmentApiToken(strapi);
  },
};

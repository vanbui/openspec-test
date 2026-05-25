import type { Core } from '@strapi/strapi';
import { seedCsrmData } from './bootstrap/seed-csrm-data';
import { seedCoreData } from './bootstrap/seed-core-data';
import { registerIdamboxUserProvisioning } from './keycloak/register-idambox-user-provisioning';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    registerIdamboxUserProvisioning(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedCoreData(strapi);
    await seedCsrmData(strapi);
  },
};

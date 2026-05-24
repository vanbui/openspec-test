import type { Core } from '@strapi/strapi';
import { seedCsrmData } from './bootstrap/seed-csrm-data';
import { seedCoreData } from './bootstrap/seed-core-data';

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedCoreData(strapi);
    await seedCsrmData(strapi);
  },
};

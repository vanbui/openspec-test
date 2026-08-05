import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::csrm-risk-type.csrm-risk-type', {
  config: {
    find: { policies: ['global::csrm-app-enabled'] },
    findOne: { policies: ['global::csrm-app-enabled'] },
    create: { policies: ['global::csrm-app-enabled'] },
    update: { policies: ['global::csrm-app-enabled'] },
    delete: { policies: ['global::csrm-app-enabled'] },
  },
});

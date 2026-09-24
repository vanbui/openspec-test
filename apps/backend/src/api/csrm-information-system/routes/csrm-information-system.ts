import { factories } from '@strapi/strapi';
import { CSRM_INFORMATION_SYSTEM_OPERATIONS } from '../operations';

export default factories.createCoreRouter('api::csrm-information-system.csrm-information-system', {
  only: ['find'],
  config: {
    find: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: { operation: CSRM_INFORMATION_SYSTEM_OPERATIONS.find },
        },
      ],
    },
  },
});

import { factories } from '@strapi/strapi';
import { CSRM_INFORMATION_ASSET_OPERATIONS } from '../operations';

export default factories.createCoreRouter('api::csrm-information-asset.csrm-information-asset', {
  only: ['find'],
  config: {
    find: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: { operation: CSRM_INFORMATION_ASSET_OPERATIONS.find },
        },
      ],
    },
  },
});

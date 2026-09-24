import type { Core } from "@strapi/strapi";
import { factories } from "@strapi/strapi";
import { CSRM_ASSESSMENT_REQUEST_OPERATIONS, listAnalystReviewRequests } from '../operations';

const coreRouter = factories.createCoreRouter('api::csrm-assessment-request.csrm-assessment-request', {
  config: {
    find: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: {
            operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.find,
            requireRequestCollectionScope: true,
          },
        },
      ],
    },
    findOne: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: {
            operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.findOne,
            requireRequestOwnership: true,
          },
        },
      ],
    },
    create: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: { operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.create },
        },
      ],
    },
    update: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: {
            operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.update,
            requireRequestOwnership: true,
          },
        },
      ],
    },
    delete: {
      policies: [
        'global::csrm-app-enabled',
        {
          name: 'global::csrm-authorization',
          config: {
            operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete,
            requireRequestOwnership: true,
          },
        },
      ],
    },
  },
});

const reviewQueueRoute = {
  method: "GET",
  path: "/v1/assessment_requests",
  handler: "api::csrm-assessment-request.csrm-assessment-request.find",
  config: {
    policies: [
      "global::csrm-app-enabled",
      {
        name: "global::csrm-authorization",
        config: {
          operation: listAnalystReviewRequests,
          requireAnalystRequestCollectionScope: true,
        },
      },
    ],
  },
};

const revertToDraftRoute = {
  method: "POST",
  path: "/v1/assessment_requests/:requestId/revert_to_draft",
  handler: "api::csrm-assessment-request.csrm-assessment-request.revertToDraft",
  config: {
    policies: [
      "global::csrm-app-enabled",
      {
        name: "global::csrm-authorization",
        config: {
          operation: CSRM_ASSESSMENT_REQUEST_OPERATIONS.revertToDraft,
          requireRequestOwnership: true,
        },
      },
    ],
  },
};

const routes = {
  type: "content-api",
  get routes() {
    const coreRoutes = coreRouter.routes;
    return [
      reviewQueueRoute,
      revertToDraftRoute,
      ...(typeof coreRoutes === "function" ? coreRoutes() : coreRoutes),
    ];
  },
};

export default routes as Core.RouterConfig;

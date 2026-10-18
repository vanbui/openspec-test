import type { Core } from "@strapi/strapi";

import { exportMyRequests, listMyRequests } from "../operations";

/**
 * The caller's own requests with who holds each one (D-03), in its own router
 * beside the core router, as the status summary's, so Strapi keeps the auth
 * scope it fills in for each router's routes. The policy decides the owner
 * scope from the resolved IdamBox User alone (`requireRequestCollectionScope`),
 * so every actor, a Security Analyst included, lists only its own requests.
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/my_requests",
      handler: "api::csrm-assessment-request.my-requests.list",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { operation: listMyRequests, requireRequestCollectionScope: true },
          },
        ],
      },
    },
    /*
     * Phase 19 (D-04, D-13): the caller's own requests as a file, with the list's owner scope and the list read it
     * discloses. Every person exports through the Requestor birthright; the service identity is refused
     * (SERVICE_IDENTITY_REFUSED_OPERATIONS). Registered before any parametrised my_requests route.
     */
    {
      method: "GET",
      path: "/v1/my_requests/export",
      handler: "api::csrm-assessment-request.my-requests.exportMyRequests",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          {
            name: "global::csrm-authorization",
            config: { operation: exportMyRequests, requireRequestCollectionScope: true, underlyingRead: listMyRequests },
          },
        ],
      },
    },
  ],
};

export default config;

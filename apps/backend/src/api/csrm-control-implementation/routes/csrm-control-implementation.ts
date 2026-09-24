import type { Core } from "@strapi/strapi";

import { CSRM_CONTROL_IMPLEMENTATION_OPERATIONS } from "../operations";

const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/v1/risks/:riskId/control_implementations",
      handler: "api::csrm-control-implementation.csrm-control-implementation.createRiskControlImplementation",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_CONTROL_IMPLEMENTATION_OPERATIONS.create) },
    },
    {
      method: "PATCH",
      path: "/v1/control_implementations/:implementationId",
      handler: "api::csrm-control-implementation.csrm-control-implementation.updateControlImplementation",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_CONTROL_IMPLEMENTATION_OPERATIONS.update) },
    },
    {
      method: "DELETE",
      path: "/v1/control_implementations/:implementationId",
      handler: "api::csrm-control-implementation.csrm-control-implementation.deleteControlImplementation",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_CONTROL_IMPLEMENTATION_OPERATIONS.delete) },
    },
  ],
};

export default config;

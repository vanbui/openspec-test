import type { Core } from "@strapi/strapi";

import { CSRM_RISK_OPERATIONS } from "../operations";
import { CSRM_ADMINISTRATION_OPERATIONS } from "../../csrm-administration/operations";

const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation } },
];

const riskRegisterPolicies = (operation: string) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: { operation, requireAnalystRiskRegisterScope: true },
  },
];

const pickerPolicies = (pickerOperation: string, administrationListOperation: string) => [
  "global::csrm-app-enabled",
  {
    name: "global::csrm-authorization",
    config: { operation: pickerOperation, administrationListOperation },
  },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/risks",
      handler: "api::csrm-risk.csrm-risk.listRiskRegister",
      config: { auth: { strategies: ["content-api-token"] }, policies: riskRegisterPolicies(CSRM_RISK_OPERATIONS.listRegister) },
    },
    {
      method: "GET",
      path: "/v1/risks/:riskId",
      handler: "api::csrm-risk.csrm-risk.getRiskRegisterDetail",
      config: { auth: { strategies: ["content-api-token"] }, policies: riskRegisterPolicies(CSRM_RISK_OPERATIONS.getDetail) },
    },
    {
      method: "POST",
      path: "/v1/risk_assessments/:assessmentId/risks",
      handler: "api::csrm-risk.csrm-risk.createAssessmentRisk",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.create) },
    },
    {
      method: "PATCH",
      path: "/v1/risks/:riskId",
      handler: "api::csrm-risk.csrm-risk.updateRisk",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.update) },
    },
    {
      method: "GET",
      path: "/v1/risk_types",
      handler: "api::csrm-risk.csrm-risk.listRiskTypes",
      config: { auth: { strategies: ["content-api-token"] }, policies: pickerPolicies(CSRM_RISK_OPERATIONS.listRiskTypes, CSRM_ADMINISTRATION_OPERATIONS.listRiskTypes) },
    },
    {
      method: "GET",
      path: "/v1/controls",
      handler: "api::csrm-risk.csrm-risk.listControls",
      config: { auth: { strategies: ["content-api-token"] }, policies: pickerPolicies(CSRM_RISK_OPERATIONS.listControls, CSRM_ADMINISTRATION_OPERATIONS.listControls) },
    },
    {
      method: "GET",
      path: "/v1/users",
      handler: "api::csrm-risk.csrm-risk.searchActiveUsers",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_RISK_OPERATIONS.searchActiveUsers) },
    },
  ],
};

export default config;

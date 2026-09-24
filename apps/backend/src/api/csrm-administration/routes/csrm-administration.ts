import type { Core } from "@strapi/strapi";

import { CSRM_ADMINISTRATION_OPERATIONS } from "../operations";
import { CSRM_INFORMATION_SYSTEM_OPERATIONS } from "../../csrm-information-system/operations";
import { CSRM_INFORMATION_ASSET_OPERATIONS } from "../../csrm-information-asset/operations";

const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystAdministrationScope: true } },
];

const pickerPolicies = (pickerOperation: string, administrationListOperation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation: pickerOperation, administrationListOperation } },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "POST", path: "/v1/risk_types", handler: "api::csrm-administration.csrm-administration.createRiskType",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.createRiskType) },
    },
    {
      method: "GET", path: "/v1/risk_types/:riskTypeId", handler: "api::csrm-administration.csrm-administration.getRiskType",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.getRiskType) },
    },
    {
      method: "PATCH", path: "/v1/risk_types/:riskTypeId", handler: "api::csrm-administration.csrm-administration.updateRiskType",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.updateRiskType) },
    },
    {
      method: "POST", path: "/v1/risk_types/import/preview", handler: "api::csrm-administration.csrm-administration.previewRiskTypesImport",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.previewRiskTypesImport) },
    },
    {
      method: "POST", path: "/v1/risk_types/import", handler: "api::csrm-administration.csrm-administration.importRiskTypes",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.importRiskTypes) },
    },
    {
      method: "POST", path: "/v1/controls", handler: "api::csrm-administration.csrm-administration.createControl",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.createControl) },
    },
    {
      method: "GET", path: "/v1/controls/:controlId", handler: "api::csrm-administration.csrm-administration.getControl",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.getControl) },
    },
    {
      method: "PATCH", path: "/v1/controls/:controlId", handler: "api::csrm-administration.csrm-administration.updateControl",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.updateControl) },
    },
    {
      method: "POST", path: "/v1/controls/import/preview", handler: "api::csrm-administration.csrm-administration.previewControlsImport",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.previewControlsImport) },
    },
    {
      method: "POST", path: "/v1/controls/import", handler: "api::csrm-administration.csrm-administration.importControls",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.importControls) },
    },
    {
      method: "GET", path: "/v1/information_systems", handler: "api::csrm-administration.csrm-administration.listInformationSystems",
      config: { auth: { strategies: ["content-api-token"] }, policies: pickerPolicies(CSRM_INFORMATION_SYSTEM_OPERATIONS.selector, CSRM_ADMINISTRATION_OPERATIONS.listInformationSystems) },
    },
    {
      method: "POST", path: "/v1/information_systems", handler: "api::csrm-administration.csrm-administration.createInformationSystem",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.createInformationSystem) },
    },
    {
      method: "GET", path: "/v1/information_systems/:informationSystemId", handler: "api::csrm-administration.csrm-administration.getInformationSystem",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.getInformationSystem) },
    },
    {
      method: "PATCH", path: "/v1/information_systems/:informationSystemId", handler: "api::csrm-administration.csrm-administration.updateInformationSystem",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.updateInformationSystem) },
    },
    {
      method: "POST", path: "/v1/information_systems/import/preview", handler: "api::csrm-administration.csrm-administration.previewInformationSystemsImport",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.previewInformationSystemsImport) },
    },
    {
      method: "POST", path: "/v1/information_systems/import", handler: "api::csrm-administration.csrm-administration.importInformationSystems",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.importInformationSystems) },
    },
    {
      method: "GET", path: "/v1/information_assets", handler: "api::csrm-administration.csrm-administration.listInformationAssets",
      config: { auth: { strategies: ["content-api-token"] }, policies: pickerPolicies(CSRM_INFORMATION_ASSET_OPERATIONS.selector, CSRM_ADMINISTRATION_OPERATIONS.listInformationAssets) },
    },
    {
      method: "POST", path: "/v1/information_assets", handler: "api::csrm-administration.csrm-administration.createInformationAsset",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.createInformationAsset) },
    },
    {
      method: "GET", path: "/v1/information_assets/:informationAssetId", handler: "api::csrm-administration.csrm-administration.getInformationAsset",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.getInformationAsset) },
    },
    {
      method: "PATCH", path: "/v1/information_assets/:informationAssetId", handler: "api::csrm-administration.csrm-administration.updateInformationAsset",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.updateInformationAsset) },
    },
    {
      method: "POST", path: "/v1/information_assets/import/preview", handler: "api::csrm-administration.csrm-administration.previewInformationAssetsImport",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.previewInformationAssetsImport) },
    },
    {
      method: "POST", path: "/v1/information_assets/import", handler: "api::csrm-administration.csrm-administration.importInformationAssets",
      config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS.importInformationAssets) },
    },
  ],
};

export default config;

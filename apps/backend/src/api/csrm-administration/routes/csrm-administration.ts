import type { Core } from "@strapi/strapi";

import { CSRM_ADMINISTRATION_OPERATIONS } from "../operations";
import { CSRM_INFORMATION_SYSTEM_OPERATIONS } from "../../csrm-information-system/operations";
import { CSRM_INFORMATION_ASSET_OPERATIONS } from "../../csrm-information-asset/operations";

const policies = (operation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystAdministrationScope: true } },
];

/* 19-14 (D-13): an export also names the list read it discloses (underlyingRead), beside the Administration scope. */
const exportPolicies = (operation: string, underlyingRead: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, requireAnalystAdministrationScope: true, underlyingRead } },
];

const pickerPolicies = (pickerOperation: string, administrationListOperation: string) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation: pickerOperation, administrationListOperation } },
];

/*
 * Phase 19 (19-14; D-03 group 3, D-31, D-32, D-33): each collection's import template, error report and reference-list
 * export, listed before the collection's `/:id` routes. All are human Security Analyst work through the Administration
 * scope, granted by the collection's Administration Function (D-13).
 */
type FileRouteNames = {
  segment: string;
  template: keyof typeof CSRM_ADMINISTRATION_OPERATIONS;
  errorReport: keyof typeof CSRM_ADMINISTRATION_OPERATIONS;
  exportList: keyof typeof CSRM_ADMINISTRATION_OPERATIONS;
  listRead: keyof typeof CSRM_ADMINISTRATION_OPERATIONS;
};

const fileRoutes = ({ segment, template, errorReport, exportList, listRead }: FileRouteNames) => [
  {
    method: "GET" as const, path: `/v1/${segment}/export`, handler: `api::csrm-administration.csrm-administration.${exportList}`,
    config: {
      auth: { strategies: ["content-api-token"] },
      policies: exportPolicies(CSRM_ADMINISTRATION_OPERATIONS[exportList], CSRM_ADMINISTRATION_OPERATIONS[listRead]),
    },
  },
  {
    method: "GET" as const, path: `/v1/${segment}/import/template`, handler: `api::csrm-administration.csrm-administration.${template}`,
    config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS[template]) },
  },
  {
    method: "POST" as const, path: `/v1/${segment}/import/error_report`, handler: `api::csrm-administration.csrm-administration.${errorReport}`,
    config: { auth: { strategies: ["content-api-token"] }, policies: policies(CSRM_ADMINISTRATION_OPERATIONS[errorReport]) },
  },
];

const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    ...fileRoutes({ segment: "risk_types", template: "downloadRiskTypesImportTemplate", errorReport: "downloadRiskTypesImportErrorReport", exportList: "exportRiskTypes", listRead: "listRiskTypes" }),
    ...fileRoutes({ segment: "controls", template: "downloadControlsImportTemplate", errorReport: "downloadControlsImportErrorReport", exportList: "exportControls", listRead: "listControls" }),
    ...fileRoutes({ segment: "information_systems", template: "downloadInformationSystemsImportTemplate", errorReport: "downloadInformationSystemsImportErrorReport", exportList: "exportInformationSystems", listRead: "listInformationSystems" }),
    ...fileRoutes({ segment: "information_assets", template: "downloadInformationAssetsImportTemplate", errorReport: "downloadInformationAssetsImportErrorReport", exportList: "exportInformationAssets", listRead: "listInformationAssets" }),
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

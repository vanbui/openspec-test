export const CSRM_ADMINISTRATION_OPERATIONS = {
  listRiskTypes: "GET:/api/v1/risk_types",
  createRiskType: "POST:/api/v1/risk_types",
  getRiskType: "GET:/api/v1/risk_types/{riskTypeId}",
  updateRiskType: "PATCH:/api/v1/risk_types/{riskTypeId}",
  previewRiskTypesImport: "POST:/api/v1/risk_types/import/preview",
  importRiskTypes: "POST:/api/v1/risk_types/import",
  downloadRiskTypesImportTemplate: "GET:/api/v1/risk_types/import/template",
  downloadRiskTypesImportErrorReport: "POST:/api/v1/risk_types/import/error_report",
  // The catalogue URL carries ?format={format}, as the register export's does (19-14; the pilot's ruling).
  exportRiskTypes: "GET:/api/v1/risk_types/export?format={format}",

  listControls: "GET:/api/v1/controls",
  createControl: "POST:/api/v1/controls",
  getControl: "GET:/api/v1/controls/{controlId}",
  updateControl: "PATCH:/api/v1/controls/{controlId}",
  previewControlsImport: "POST:/api/v1/controls/import/preview",
  importControls: "POST:/api/v1/controls/import",
  downloadControlsImportTemplate: "GET:/api/v1/controls/import/template",
  downloadControlsImportErrorReport: "POST:/api/v1/controls/import/error_report",
  // The catalogue URL carries ?format={format}, as the register export's does (19-14; the pilot's ruling).
  exportControls: "GET:/api/v1/controls/export?format={format}",

  listInformationSystems: "GET:/api/v1/information_systems",
  createInformationSystem: "POST:/api/v1/information_systems",
  getInformationSystem: "GET:/api/v1/information_systems/{informationSystemId}",
  updateInformationSystem: "PATCH:/api/v1/information_systems/{informationSystemId}",
  previewInformationSystemsImport: "POST:/api/v1/information_systems/import/preview",
  importInformationSystems: "POST:/api/v1/information_systems/import",
  downloadInformationSystemsImportTemplate: "GET:/api/v1/information_systems/import/template",
  downloadInformationSystemsImportErrorReport: "POST:/api/v1/information_systems/import/error_report",
  // The catalogue URL carries ?format={format}, as the register export's does (19-14; the pilot's ruling).
  exportInformationSystems: "GET:/api/v1/information_systems/export?format={format}",

  listInformationAssets: "GET:/api/v1/information_assets",
  createInformationAsset: "POST:/api/v1/information_assets",
  getInformationAsset: "GET:/api/v1/information_assets/{informationAssetId}",
  updateInformationAsset: "PATCH:/api/v1/information_assets/{informationAssetId}",
  previewInformationAssetsImport: "POST:/api/v1/information_assets/import/preview",
  importInformationAssets: "POST:/api/v1/information_assets/import",
  downloadInformationAssetsImportTemplate: "GET:/api/v1/information_assets/import/template",
  downloadInformationAssetsImportErrorReport: "POST:/api/v1/information_assets/import/error_report",
  // The catalogue URL carries ?format={format}, as the register export's does (19-14; the pilot's ruling).
  exportInformationAssets: "GET:/api/v1/information_assets/export?format={format}",
} as const;

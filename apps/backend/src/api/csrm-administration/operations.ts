export const CSRM_ADMINISTRATION_OPERATIONS = {
  listRiskTypes: "GET:/api/v1/risk_types",
  createRiskType: "POST:/api/v1/risk_types",
  getRiskType: "GET:/api/v1/risk_types/{riskTypeId}",
  updateRiskType: "PATCH:/api/v1/risk_types/{riskTypeId}",
  previewRiskTypesImport: "POST:/api/v1/risk_types/import/preview",
  importRiskTypes: "POST:/api/v1/risk_types/import",

  listControls: "GET:/api/v1/controls",
  createControl: "POST:/api/v1/controls",
  getControl: "GET:/api/v1/controls/{controlId}",
  updateControl: "PATCH:/api/v1/controls/{controlId}",
  previewControlsImport: "POST:/api/v1/controls/import/preview",
  importControls: "POST:/api/v1/controls/import",

  listInformationSystems: "GET:/api/v1/information_systems",
  createInformationSystem: "POST:/api/v1/information_systems",
  getInformationSystem: "GET:/api/v1/information_systems/{informationSystemId}",
  updateInformationSystem: "PATCH:/api/v1/information_systems/{informationSystemId}",
  previewInformationSystemsImport: "POST:/api/v1/information_systems/import/preview",
  importInformationSystems: "POST:/api/v1/information_systems/import",

  listInformationAssets: "GET:/api/v1/information_assets",
  createInformationAsset: "POST:/api/v1/information_assets",
  getInformationAsset: "GET:/api/v1/information_assets/{informationAssetId}",
  updateInformationAsset: "PATCH:/api/v1/information_assets/{informationAssetId}",
  previewInformationAssetsImport: "POST:/api/v1/information_assets/import/preview",
  importInformationAssets: "POST:/api/v1/information_assets/import",
} as const;

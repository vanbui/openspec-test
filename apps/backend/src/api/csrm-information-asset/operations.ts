export const CSRM_INFORMATION_ASSET_OPERATIONS = {
  find: "GET:/api/csrm-information-assets",
  selector: "GET:/api/v1/information_assets?q={q}&page={page}&pageSize={pageSize}",
  selected: "POST:/api/v1/information_assets/selected",
  findOne: "GET:/api/csrm-information-assets/:documentId",
  create: "POST:/api/csrm-information-assets",
  update: "PUT:/api/csrm-information-assets/:documentId",
  delete: "DELETE:/api/csrm-information-assets/:documentId",
} as const;

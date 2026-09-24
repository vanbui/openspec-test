export const CSRM_INFORMATION_SYSTEM_OPERATIONS = {
  find: "GET:/api/csrm-information-systems",
  selector: "GET:/api/v1/information_systems?q={q}&page={page}&pageSize={pageSize}",
  selected: "POST:/api/v1/information_systems/selected",
  findOne: "GET:/api/csrm-information-systems/:documentId",
  create: "POST:/api/csrm-information-systems",
  update: "PUT:/api/csrm-information-systems/:documentId",
  delete: "DELETE:/api/csrm-information-systems/:documentId",
} as const;

export const CSRM_CONTROL_IMPLEMENTATION_OPERATIONS = {
  list: "GET:/api/v1/risks/{riskId}/control_implementations",
  create: "POST:/api/v1/risks/{riskId}/control_implementations",
  update: "PATCH:/api/v1/control_implementations/{implementationId}",
  delete: "DELETE:/api/v1/control_implementations/{implementationId}",
} as const;

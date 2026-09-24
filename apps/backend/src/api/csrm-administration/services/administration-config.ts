export type AdministrationKind = "risk-types" | "controls" | "information-systems" | "information-assets";

export type AdministrationConfig = {
  uid: string;
  table: string;
  naturalKey: string;
  naturalKeyColumn: string;
  defaultSort: string;
  sortColumns: Readonly<Record<string, string>>;
  searchColumns: readonly string[];
  filterColumns: Readonly<Record<string, string>>;
  projectedFields: readonly string[];
  writableFields: readonly string[];
};

export const ADMINISTRATION = {
  "risk-types": {
    uid: "api::csrm-risk-type.csrm-risk-type",
    table: "csrm_risk_types",
    naturalKey: "name",
    naturalKeyColumn: "name",
    defaultSort: "name:asc",
    sortColumns: { name: "name", updatedAt: "updated_at" },
    searchColumns: ["name", "description"],
    filterColumns: {},
    projectedFields: ["documentId", "name", "description", "updatedAt"],
    writableFields: ["name", "description", "applicableControls"],
  },
  controls: {
    uid: "api::csrm-control.csrm-control",
    table: "csrm_controls",
    naturalKey: "controlNumber",
    naturalKeyColumn: "control_number",
    defaultSort: "controlNumber:asc",
    sortColumns: { controlNumber: "control_number", name: "name", updatedAt: "updated_at" },
    searchColumns: ["control_number", "name", "framework"],
    filterColumns: { framework: "framework", controlType: "control_type" },
    projectedFields: ["documentId", "controlNumber", "name", "description", "controlType", "controlReference", "framework", "frameworkVersion", "frameworkSource", "updatedAt"],
    writableFields: ["controlNumber", "name", "description", "controlType", "controlReference", "framework", "frameworkVersion", "frameworkSource"],
  },
  "information-systems": {
    uid: "api::csrm-information-system.csrm-information-system",
    table: "csrm_information_systems",
    naturalKey: "name",
    naturalKeyColumn: "name",
    defaultSort: "name:asc",
    sortColumns: { name: "name", systemType: "system_type", environment: "environment", lifecycleState: "lifecycle_state", updatedAt: "updated_at" },
    searchColumns: ["name", "description", "system_type", "hosting_location"],
    filterColumns: { environment: "environment", deploymentModel: "deployment_model", lifecycleState: "lifecycle_state", internetFacing: "internet_facing" },
    projectedFields: ["documentId", "name", "description", "systemType", "environment", "deploymentModel", "businessCriticality", "internetFacing", "externalAccessRequired", "hostingLocation", "lifecycleState", "updatedAt"],
    writableFields: ["name", "description", "systemType", "owner", "environment", "deploymentModel", "businessCriticality", "internetFacing", "externalAccessRequired", "hostingLocation", "lifecycleState"],
  },
  "information-assets": {
    uid: "api::csrm-information-asset.csrm-information-asset",
    table: "csrm_information_assets",
    naturalKey: "name",
    naturalKeyColumn: "name",
    defaultSort: "name:asc",
    sortColumns: { name: "name", type: "type", dataClassification: "data_classification", updatedAt: "updated_at" },
    searchColumns: ["name", "description", "location", "type"],
    filterColumns: { dataClassification: "data_classification", containsPersonalData: "contains_personal_data", containsLegalData: "contains_legal_data", containsCreditCardData: "contains_credit_card_data" },
    projectedFields: ["documentId", "name", "description", "location", "type", "dataClassification", "confidentialityRating", "integrityRating", "availabilityRating", "containsPersonalData", "containsLegalData", "containsCreditCardData", "comments", "updatedAt"],
    writableFields: ["name", "description", "location", "type", "dataClassification", "confidentialityRating", "integrityRating", "availabilityRating", "containsPersonalData", "containsLegalData", "containsCreditCardData", "comments"],
  },
} as const satisfies Record<AdministrationKind, AdministrationConfig>;

export function administrationConfig(kind: unknown): AdministrationConfig {
  if (typeof kind !== "string" || !(kind in ADMINISTRATION)) {
    throw new Error("Unsupported CSRM Administration collection.");
  }
  return ADMINISTRATION[kind as AdministrationKind];
}

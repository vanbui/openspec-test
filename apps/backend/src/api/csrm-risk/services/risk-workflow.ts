import {
  AssessmentWorkflowError,
  parseWritableRiskFields,
  type AssessmentMutationStrapi,
  withMutableAssessmentMutation,
} from "../../csrm-assessment/services/assessment-workflow";
import { createWithRiskNumber } from "./risk-number";

type RecordValue = Record<string, unknown>;
type DocumentService = {
  create: (query: { data: RecordValue }) => Promise<RecordValue>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
export type RiskWorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: AssessmentMutationStrapi["db"];
};

const RISK_UID = "api::csrm-risk.csrm-risk";
const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";
const RELATION_UID = {
  riskType: "api::csrm-risk-type.csrm-risk-type",
  riskOwner: "api::idambox-user.idambox-user",
  informationSystemImpacted: "api::csrm-information-system.csrm-information-system",
  informationAssetImpacted: "api::csrm-information-asset.csrm-information-asset",
  treatmentOwner: "api::idambox-user.idambox-user",
} as const;

export class RiskWorkflowError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "RiskWorkflowError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function documentId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0
    ? value.documentId
    : null;
}

function assertDocumentId(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new RiskWorkflowError(400, message);
}

function assertRequiredRiskStatement(data: RecordValue, required: boolean): void {
  if ((required || "riskStatement" in data)
    && (typeof data.riskStatement !== "string" || data.riskStatement.length === 0)) {
    throw new RiskWorkflowError(400, "CSRM Risk mutation data is invalid.");
  }
}

async function resolveRelations(strapi: RiskWorkflowStrapi, data: RecordValue): Promise<RecordValue> {
  const resolved = { ...data };
  for (const [field, uid] of Object.entries(RELATION_UID)) {
    if (!(field in data)) continue;
    const value = data[field];
    if (value === null) {
      resolved[field] = null;
      continue;
    }
    const relationId = documentId(value);
    if (!relationId) throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
    const relation = await strapi.documents(uid).findOne({ documentId: relationId });
    if (!relation || ((field === "riskOwner" || field === "treatmentOwner") && relation.accountStatus !== "active")) {
      throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
    }
    resolved[field] = relationId;
  }
  return resolved;
}

async function requireAssessment(strapi: RiskWorkflowStrapi, assessmentDocumentId: string): Promise<RecordValue> {
  const assessment = await strapi.documents(ASSESSMENT_UID).findOne({ documentId: assessmentDocumentId });
  if (!assessment) throw new RiskWorkflowError(404, "CSRM assessment was not found.");
  return assessment;
}

export async function listAssessmentRiskDocuments(
  strapi: RiskWorkflowStrapi,
  assessmentDocumentId: string,
): Promise<RecordValue[]> {
  assertDocumentId(assessmentDocumentId, "CSRM assessment identifier is invalid.");
  await requireAssessment(strapi, assessmentDocumentId);
  return strapi.documents(RISK_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentDocumentId } } },
    sort: ["riskNumber:asc"],
    limit: 1_000,
  });
}

const MAX_ASSESSMENT_RISKS = 1_000;
const MAX_ASSESSMENT_OWNER_LABELS = 2_000;

function relationDocumentId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const valueDocumentId = typeof value === "string" ? value : isRecord(value) ? value.documentId : null;
  if (typeof valueDocumentId !== "string" || valueDocumentId.length === 0) {
    throw new RiskWorkflowError(400, "CSRM assessment Risk relation is invalid.");
  }
  return valueDocumentId;
}

/**
 * Loads the bounded persisted Risk aggregate used exclusively by the existing
 * authorised assessment-detail read.  The +1 probe makes an oversized
 * aggregate fail before any projection or owner identity resolution.
 */
export async function loadAnalystAssessmentRiskDetails(
  strapi: RiskWorkflowStrapi,
  assessmentDocumentId: string,
): Promise<RecordValue[]> {
  assertDocumentId(assessmentDocumentId, "CSRM assessment identifier is invalid.");
  const risks = await strapi.documents(RISK_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentDocumentId } } },
    sort: ["riskNumber:asc"],
    limit: MAX_ASSESSMENT_RISKS + 1,
    populate: {
      riskType: true,
      riskOwner: true,
      informationSystemImpacted: true,
      informationAssetImpacted: true,
      treatmentOwner: true,
      controlImplementations: { populate: { control: true } },
    },
  });
  if (risks.length > MAX_ASSESSMENT_RISKS) {
    throw new RiskWorkflowError(400, "CSRM assessment Risk limit is exceeded.");
  }
  return risks;
}

/** Resolves only persisted Risk owner references; active-search policy is not used here. */
export async function loadAnalystAssessmentOwnerLabels(
  strapi: RiskWorkflowStrapi,
  risks: RecordValue[],
): Promise<RecordValue[]> {
  const ownerIds = new Set<string>();
  for (const risk of risks) {
    if (!isRecord(risk)) throw new RiskWorkflowError(400, "CSRM assessment Risk is invalid.");
    for (const field of ["riskOwner", "treatmentOwner"] as const) {
      const ownerId = relationDocumentId(risk[field]);
      if (ownerId) ownerIds.add(ownerId);
    }
  }
  if (ownerIds.size > MAX_ASSESSMENT_OWNER_LABELS) {
    throw new RiskWorkflowError(400, "CSRM assessment owner label limit is exceeded.");
  }
  const users = strapi.documents("api::idambox-user.idambox-user");
  const labels: RecordValue[] = [];
  for (const ownerId of [...ownerIds].sort((left, right) => left.localeCompare(right))) {
    const owner = await users.findOne({ documentId: ownerId });
    if (!owner || typeof owner.documentId !== "string" || typeof owner.displayName !== "string") {
      throw new RiskWorkflowError(400, "CSRM assessment Risk owner is invalid.");
    }
    labels.push({ documentId: owner.documentId, displayName: owner.displayName });
  }
  return labels;
}

export async function createAssessmentRisk(input: {
  strapi: RiskWorkflowStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.assessmentDocumentId, "CSRM assessment identifier is invalid.");
  const parsed = parseWritableRiskFields(input.body);
  assertRequiredRiskStatement(parsed, true);
  return withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async () => {
      const data = await resolveRelations(input.strapi, parsed);
      return createWithRiskNumber((riskNumber) => input.strapi.documents(RISK_UID).create({ data: {
        ...data,
        riskNumber,
        assessment: input.assessmentDocumentId,
      } }));
    },
  });
}

export async function updateRisk(input: {
  strapi: RiskWorkflowStrapi;
  riskDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.riskDocumentId, "CSRM Risk identifier is invalid.");
  const parsed = parseWritableRiskFields(input.body);
  assertRequiredRiskStatement(parsed, false);
  const candidate = await input.strapi.documents(RISK_UID).findOne({
    documentId: input.riskDocumentId,
    populate: { assessment: true },
  });
  if (!candidate) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
  const assessmentDocumentId = documentId(candidate.assessment);
  if (!assessmentDocumentId) throw new RiskWorkflowError(409, "CSRM Risk ancestor is invalid.");
  return withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async () => {
      const authoritativeRisk = await input.strapi.documents(RISK_UID).findOne({
        documentId: input.riskDocumentId,
        populate: { assessment: true },
      });
      if (!authoritativeRisk) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
      if (documentId(authoritativeRisk.assessment) !== assessmentDocumentId) {
        throw new RiskWorkflowError(409, "CSRM Risk ancestor changed.");
      }
      const data = await resolveRelations(input.strapi, parsed);
      return input.strapi.documents(RISK_UID).update({ documentId: input.riskDocumentId, data });
    },
  });
}

export async function listRiskTypeDocuments(strapi: RiskWorkflowStrapi): Promise<RecordValue[]> {
  return strapi.documents("api::csrm-risk-type.csrm-risk-type").findMany({
    sort: ["name:asc"],
    limit: 1_000,
  });
}

export async function listControlDocuments(strapi: RiskWorkflowStrapi): Promise<RecordValue[]> {
  return strapi.documents("api::csrm-control.csrm-control").findMany({
    sort: ["controlNumber:asc"],
    limit: 5_000,
  });
}

export async function searchActiveUserDocuments(strapi: RiskWorkflowStrapi, search: string): Promise<RecordValue[]> {
  return strapi.documents("api::idambox-user.idambox-user").findMany({
    filters: {
      accountStatus: { $eq: "active" },
      displayName: { $containsi: search },
    },
    sort: ["displayName:asc"],
    limit: 20,
  });
}

export { AssessmentWorkflowError };

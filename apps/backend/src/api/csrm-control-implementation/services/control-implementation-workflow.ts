import {
  assertMutableAssessment,
  parseWritableControlImplementationFields,
  type AssessmentMutationStrapi,
  withMutableAssessmentMutation,
} from "../../csrm-assessment/services/assessment-workflow";
import { projectControlImplementationControlSummary } from "../../csrm-assessment/services/assessment-scope";

type RecordValue = Record<string, unknown>;
type DocumentService = {
  create: (query: { data: RecordValue }) => Promise<RecordValue>;
  delete: (query: { documentId: string }) => Promise<RecordValue>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
export type ControlImplementationWorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: AssessmentMutationStrapi["db"];
};

const IMPLEMENTATION_UID = "api::csrm-control-implementation.csrm-control-implementation";
const RISK_UID = "api::csrm-risk.csrm-risk";
const CONTROL_UID = "api::csrm-control.csrm-control";
const USER_UID = "api::idambox-user.idambox-user";

export class ControlImplementationWorkflowError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "ControlImplementationWorkflowError";
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
  if (typeof value !== "string" || value.length === 0) throw new ControlImplementationWorkflowError(400, message);
}

function riskAssessmentId(risk: RecordValue): string {
  const assessmentDocumentId = documentId(risk.assessment);
  if (!assessmentDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor is invalid.");
  return assessmentDocumentId;
}

async function requireRisk(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<{ risk: RecordValue; assessmentDocumentId: string }> {
  const risk = await strapi.documents(RISK_UID).findOne({
    documentId: riskDocumentId,
    populate: { assessment: true },
  });
  if (!risk) throw new ControlImplementationWorkflowError(404, "CSRM Risk was not found.");
  return { risk, assessmentDocumentId: riskAssessmentId(risk) };
}

async function requireImplementation(
  strapi: ControlImplementationWorkflowStrapi,
  implementationDocumentId: string,
): Promise<{ implementation: RecordValue; riskDocumentId: string; assessmentDocumentId: string }> {
  const implementation = await strapi.documents(IMPLEMENTATION_UID).findOne({
    documentId: implementationDocumentId,
    populate: { risk: { populate: { assessment: true } }, control: true, controlOwner: true },
  });
  if (!implementation) throw new ControlImplementationWorkflowError(404, "CSRM ControlImplementation was not found.");
  const risk = isRecord(implementation.risk) ? implementation.risk : null;
  const riskDocumentId = documentId(risk);
  if (!risk || !riskDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor is invalid.");
  return { implementation, riskDocumentId, assessmentDocumentId: riskAssessmentId(risk) };
}

async function loadProjectedImplementation(
  strapi: ControlImplementationWorkflowStrapi,
  value: RecordValue,
): Promise<RecordValue> {
  const implementationDocumentId = documentId(value);
  if (!implementationDocumentId) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation persistence is invalid.");
  }
  const implementation = await strapi.documents(IMPLEMENTATION_UID).findOne({
    documentId: implementationDocumentId,
    populate: { control: true, controlOwner: true },
  });
  if (!implementation) throw new ControlImplementationWorkflowError(404, "CSRM ControlImplementation was not found.");
  return implementation;
}

async function resolveReferences(
  strapi: ControlImplementationWorkflowStrapi,
  parsed: RecordValue,
  requireControl: boolean,
): Promise<RecordValue> {
  const data = { ...parsed };
  if (requireControl && !("control" in data)) {
    throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
  }
  if ("control" in data) {
    const controlDocumentId = documentId(data.control);
    if (!controlDocumentId) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
    const control = await strapi.documents(CONTROL_UID).findOne({ documentId: controlDocumentId });
    if (!control) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
    data.control = controlDocumentId;
  }
  if ("controlOwner" in data && data.controlOwner !== null) {
    const ownerDocumentId = documentId(data.controlOwner);
    if (!ownerDocumentId) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation owner is invalid.");
    const owner = await strapi.documents(USER_UID).findOne({ documentId: ownerDocumentId });
    if (!owner || owner.accountStatus !== "active") {
      throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation owner is invalid.");
    }
    data.controlOwner = ownerDocumentId;
  }
  return data;
}

function sameAncestor(
  implementation: RecordValue,
  riskDocumentId: string,
  assessmentDocumentId: string,
): boolean {
  const risk = isRecord(implementation.risk) ? implementation.risk : null;
  return documentId(risk) === riskDocumentId
    && risk !== null
    && documentId(risk.assessment) === assessmentDocumentId;
}

export function projectControlImplementationSummary(document: RecordValue): RecordValue {
  const controlDocumentId = documentId(document.control);
  if (!controlDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation control is invalid.");
  const owner = isRecord(document.controlOwner)
    && typeof document.controlOwner.documentId === "string"
    && typeof document.controlOwner.displayName === "string"
    ? { documentId: document.controlOwner.documentId, displayName: document.controlOwner.displayName }
    : null;
  return {
    documentId: document.documentId,
    control: controlDocumentId,
    controlSummary: projectControlImplementationControlSummary(document.control),
    controlOwner: owner,
    controlStatus: document.controlStatus ?? null,
    effectivenessRating: document.effectivenessRating ?? null,
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}

export async function listRiskControlImplementationDocuments(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<RecordValue[]> {
  assertDocumentId(riskDocumentId, "CSRM Risk identifier is invalid.");
  await requireRisk(strapi, riskDocumentId);
  return strapi.documents(IMPLEMENTATION_UID).findMany({
    filters: { risk: { documentId: { $eq: riskDocumentId } } },
    populate: { control: true, controlOwner: true },
    sort: ["createdAt:asc"],
    limit: 1_000,
  });
}

export async function createRiskControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  riskDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.riskDocumentId, "CSRM Risk identifier is invalid.");
  const parsed = parseWritableControlImplementationFields(input.body);
  const { assessmentDocumentId } = await requireRisk(input.strapi, input.riskDocumentId);
  return withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async ({ assessment }) => {
      assertMutableAssessment(assessment);
      const authoritativeRisk = await requireRisk(input.strapi, input.riskDocumentId);
      if (authoritativeRisk.assessmentDocumentId !== assessmentDocumentId) {
        throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
      }
      const data = await resolveReferences(input.strapi, parsed, true);
      const created = await input.strapi.documents(IMPLEMENTATION_UID).create({ data: {
        ...data,
        risk: input.riskDocumentId,
      } });
      return loadProjectedImplementation(input.strapi, created);
    },
  });
}

export async function updateControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  implementationDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.implementationDocumentId, "CSRM ControlImplementation identifier is invalid.");
  const parsed = parseWritableControlImplementationFields(input.body);
  const candidate = await requireImplementation(input.strapi, input.implementationDocumentId);
  return withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: candidate.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async ({ assessment }) => {
      assertMutableAssessment(assessment);
      const authoritative = await requireImplementation(input.strapi, input.implementationDocumentId);
      if (!sameAncestor(authoritative.implementation, candidate.riskDocumentId, candidate.assessmentDocumentId)) {
        throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
      }
      const data = await resolveReferences(input.strapi, parsed, false);
      const updated = await input.strapi.documents(IMPLEMENTATION_UID).update({
        documentId: input.implementationDocumentId,
        data,
      });
      return loadProjectedImplementation(input.strapi, updated);
    },
  });
}

export async function deleteControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  implementationDocumentId: string;
  analystDocumentId: string;
}): Promise<void> {
  assertDocumentId(input.implementationDocumentId, "CSRM ControlImplementation identifier is invalid.");
  const candidate = await requireImplementation(input.strapi, input.implementationDocumentId);
  await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: candidate.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async ({ assessment }) => {
      assertMutableAssessment(assessment);
      const authoritative = await requireImplementation(input.strapi, input.implementationDocumentId);
      if (!sameAncestor(authoritative.implementation, candidate.riskDocumentId, candidate.assessmentDocumentId)) {
        throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
      }
      await input.strapi.documents(IMPLEMENTATION_UID).delete({ documentId: input.implementationDocumentId });
    },
  });
}

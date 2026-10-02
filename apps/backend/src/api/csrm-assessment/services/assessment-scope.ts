import { isReleased } from "./assessment-workflow";

type RecordValue = Record<string, unknown>;

type AssessmentAuthorizationState = {
  csrmAuthorization?: {
    assessmentRequestActor?: "requestor" | "analyst";
    assessmentOwnerCollectionScope?: "own";
    assessmentOwnerDocumentId?: string;
  };
};

export class AssessmentScopeError extends Error {
  constructor(public readonly status: 400 | 403, message = "CSRM assessment access is denied.") {
    super(message);
    this.name = "AssessmentScopeError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectUser(value: unknown): RecordValue | null {
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.displayName !== "string") return null;
  return { documentId: value.documentId, displayName: value.displayName };
}

export function assertAnalystAssessmentScope(state: unknown): void {
  if (!isRecord(state)
    || (state as AssessmentAuthorizationState).csrmAuthorization?.assessmentRequestActor !== "analyst") {
    throw new AssessmentScopeError(403);
  }
}

export function assertRequestorAssessmentScope(state: unknown): void {
  if (!isRecord(state)
    || (state as AssessmentAuthorizationState).csrmAuthorization?.assessmentRequestActor !== "requestor") {
    throw new AssessmentScopeError(403);
  }
}

export function assessmentOwnerCollectionDocumentId(state: unknown): string {
  const authorization = isRecord(state)
    ? (state as AssessmentAuthorizationState).csrmAuthorization
    : undefined;
  if (authorization?.assessmentOwnerCollectionScope !== "own"
    || typeof authorization.assessmentOwnerDocumentId !== "string"
    || authorization.assessmentOwnerDocumentId.length === 0) {
    throw new AssessmentScopeError(403);
  }
  return authorization.assessmentOwnerDocumentId;
}

export function assertClosedAssessmentQuery(query: unknown): void {
  if (!isRecord(query) || Object.keys(query).length > 0) {
    throw new AssessmentScopeError(400, "CSRM assessment query is invalid.");
  }
}

export type AssessmentPagination = { page: number; pageSize: number };
/*
 * The complete assessment-status vocabulary of the CSRM datamodel. Every status,
 * closed included, is within the analyst assessment scope: the analyst
 * collection adds no status predicate of its own, and an analyst may read any
 * assessment. The owner collection shares this filter but always adds its
 * released-owner predicate, so there a status can narrow the scope but never
 * widen it, and anything other than approved selects nothing.
 */
const ASSESSMENT_STATUSES = ["draft", "in-review", "approved", "closed"] as const;

function assertCollectionKeys(query: RecordValue): void {
  if (Object.keys(query).some((key) => !["q", "status", "sort", "page", "pageSize"].includes(key))) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
}

function collectionInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  return parsed;
}

function collectionText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 200) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  // An empty or blank term is the absence of a search, not a malformed one. A
  // browser submitting an empty search box must not read as a bad request.
  return value.trim() || undefined;
}

function collectionSort(value: unknown): string[] {
  if (value === undefined) return ["generatedDate:desc", "assessmentNumber:asc"];
  if (typeof value !== "string") throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  const [field, direction = "asc", extra] = value.split(":");
  if (extra !== undefined || !["generatedDate", "approvalDate", "assessmentNumber", "assessmentStatus"].includes(field)
    || !["asc", "desc"].includes(direction)) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  return [`${field}:${direction}`, "assessmentNumber:asc"];
}

export function buildAssessmentCollectionQuery(query: unknown, state: unknown, scope: "owner" | "analyst"): {
  dataQuery: RecordValue;
  countQuery: RecordValue;
  pagination: AssessmentPagination;
} {
  if (!isRecord(query)) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  assertCollectionKeys(query);
  const page = collectionInteger(query.page, 1, 1_000_000);
  const pageSize = collectionInteger(query.pageSize, 25, 100);
  const q = collectionText(query.q);
  if (query.status !== undefined && (typeof query.status !== "string" || !ASSESSMENT_STATUSES.includes(query.status as typeof ASSESSMENT_STATUSES[number]))) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  const predicates: RecordValue[] = [
    ...(q ? [{ $or: [{ assessmentNumber: { $containsi: q } }, { summary: { $containsi: q } }] }] : []),
    ...(query.status ? [{ assessmentStatus: { $eq: query.status } }] : []),
  ];
  if (scope === "owner") {
    const ownerDocumentId = assessmentOwnerCollectionDocumentId(state);
    predicates.push((releasedAssessmentQuery(ownerDocumentId).filters ?? {}) as RecordValue);
  } else {
    assertAnalystAssessmentScope(state);
  }
  const filters = predicates.length === 1 ? predicates[0] : { $and: predicates };
  const countQuery = { filters };
  return {
    countQuery,
    dataQuery: {
      ...countQuery,
      populate: { assessmentRequest: { populate: { requestor: true } }, generatedBy: true, reviewedBy: true, approvedBy: true },
      sort: collectionSort(query.sort),
      start: (page - 1) * pageSize,
      limit: pageSize,
    },
    pagination: { page, pageSize },
  };
}

export const ASSESSMENT_DETAIL_QUERY = {
  populate: {
    assessmentRequest: true,
    generatedBy: true,
    reviewedBy: true,
    approvedBy: true,
  },
} as const;

export const MAX_ASSESSMENT_RISKS = 1_000;
export const MAX_ASSESSMENT_OWNER_LABELS = 2_000;

const releasedAssessmentPopulate = {
  assessmentRequest: { populate: { requestor: true } },
  generatedBy: true,
  reviewedBy: true,
  approvedBy: true,
} as const;

export function releasedAssessmentQuery(ownerDocumentId: string): RecordValue {
  return {
    filters: {
      // The released contract promises complete release facts. The release
      // transition writes assessmentStatus, approvalDate, assessmentDate and
      // approvedBy in one update, so filtering the dates keeps a partially
      // written legacy row out of the projection entirely: the Requestor gets
      // an honest "not found" instead of a 200 the client cannot parse.
      assessmentStatus: { $eq: "approved" },
      approvalDate: { $notNull: true },
      assessmentDate: { $notNull: true },
      approvedBy: { documentId: { $notNull: true } },
      assessmentRequest: {
        requestStatus: { $eq: "approved" },
        requestor: { documentId: { $eq: ownerDocumentId } },
      },
    },
    populate: releasedAssessmentPopulate,
  };
}

export function releasedAssessmentDetailQuery(ownerDocumentId: string, documentId: string): RecordValue {
  return { documentId, ...releasedAssessmentQuery(ownerDocumentId) };
}

export function isReleasedAssessmentForOwner(document: unknown, ownerDocumentId: string): document is RecordValue {
  if (!isRecord(document) || !isReleased(document)) return false;
  const assessmentRequest = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
  const requestor = assessmentRequest && isRecord(assessmentRequest.requestor) ? assessmentRequest.requestor : null;
  return assessmentRequest?.requestStatus === "approved" && requestor?.documentId === ownerDocumentId;
}

export function projectAssessmentSummary(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    assessmentNumber: document.assessmentNumber,
    assessmentStatus: document.assessmentStatus,
    summary: document.summary ?? null,
    overallRating: document.overallRating ?? null,
    generatedDate: document.generatedDate ?? null,
    generatedBy: projectUser(document.generatedBy),
    approvalDate: document.approvalDate ?? null,
  };
}

export function projectAssessmentDetail(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    assessmentNumber: document.assessmentNumber,
    assessmentStatus: document.assessmentStatus,
    assessmentDate: document.assessmentDate ?? null,
    generatedDate: document.generatedDate ?? null,
    nextReviewDate: document.nextReviewDate ?? null,
    approvalDate: document.approvalDate ?? null,
    summary: document.summary ?? null,
    overallRating: document.overallRating ?? null,
    overallControlEffectiveness: document.overallControlEffectiveness ?? null,
    recommendationsSummary: document.recommendationsSummary ?? null,
    overallRiskRationale: document.overallRiskRationale ?? null,
    assessmentRequest: projectAssessmentRequestSummary(document.assessmentRequest),
    generatedBy: projectUser(document.generatedBy),
    reviewedBy: projectUser(document.reviewedBy),
    approvedBy: projectUser(document.approvedBy),
  };
}

export function projectAssessmentRequestSummary(value: unknown): RecordValue {
  if (!isRecord(value)
    || typeof value.documentId !== "string"
    || typeof value.requestNumber !== "string"
    || typeof value.title !== "string"
    || typeof value.requestStatus !== "string") {
    throw new AssessmentScopeError(400, "CSRM assessment Request relation is invalid.");
  }
  return {
    documentId: value.documentId,
    requestNumber: value.requestNumber,
    title: value.title,
    requestStatus: value.requestStatus,
  };
}

/** The Requestor variant intentionally contains no analyst-only aggregate fields. */
export function projectReleasedAssessmentDetail(document: RecordValue): RecordValue {
  return { actor: "requestor", ...projectAssessmentDetail(document) };
}

function projectRelationDocumentId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const documentId = typeof value === "string" ? value : isRecord(value) ? value.documentId : null;
  if (typeof documentId !== "string" || documentId.length === 0) {
    throw new AssessmentScopeError(400, "CSRM assessment Risk relation is invalid.");
  }
  return documentId;
}

const RISK_DETAIL_FIELDS = [
  "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "riskType", "riskOwner",
  "informationSystemImpacted", "informationAssetImpacted", "dataClassification", "inherentLikelihood", "highestInherentConsequence",
  "inherentRating", "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRating", "residualRatingRationale",
  "controlEffectiveness", "riskVelocity", "identifiedDate", "targetDate", "closureDate", "isExempted", "exemptionReviewDate",
  "escalationDetails", "comments", "riskCommunicationDate", "treatmentAction", "treatmentPlan", "treatmentOwner", "treatmentResolveDate",
  "treatmentStatus",
] as const;

export function projectAnalystRiskDetail(document: RecordValue): RecordValue {
  const result: RecordValue = { documentId: document.documentId, riskNumber: document.riskNumber };
  for (const field of RISK_DETAIL_FIELDS) {
    result[field] = ["riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "treatmentOwner"].includes(field)
      ? projectRelationDocumentId(document[field])
      : document[field] ?? null;
  }
  return result;
}

export function projectAnalystAssessmentDetail(input: {
  assessment: RecordValue;
  risks: RecordValue[];
  ownerLabels: RecordValue[];
  releaseReadiness: RecordValue;
}): RecordValue {
  const { assessment, risks, ownerLabels, releaseReadiness } = input;
  if (risks.length > MAX_ASSESSMENT_RISKS) throw new AssessmentScopeError(400, "CSRM assessment Risk limit is exceeded.");
  for (const risk of risks) {
    if (!isRecord(risk)) throw new AssessmentScopeError(400, "CSRM assessment Risk is invalid.");
  }
  return {
    actor: "analyst",
    ...projectAssessmentDetail(assessment),
    risks: risks.map(projectAnalystRiskDetail),
    ownerLabels,
    releaseReadiness,
  };
}

export function projectAssessmentStatusSummary(documents: RecordValue[]): RecordValue {
  const draft = documents.filter((document) => document.assessmentStatus === "draft").length;
  const inReview = documents.filter((document) => document.assessmentStatus === "in-review").length;
  const approved = documents.filter((document) => document.assessmentStatus === "approved").length;
  return { draft, inReview, approved, total: documents.length };
}

export function projectAssessmentRatingSummary(documents: RecordValue[]): RecordValue {
  const summary: RecordValue = { Low: 0, Moderate: 0, High: 0, Critical: 0, total: documents.length };
  for (const document of documents) {
    const rating = document.overallRating;
    if (typeof rating === "string" && rating in summary) summary[rating] = Number(summary[rating]) + 1;
  }
  return summary;
}

export function projectRiskSummary(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    riskStatement: document.riskStatement ?? null,
    inherentRating: document.inherentRating ?? null,
    residualRating: document.residualRating ?? null,
  };
}

export function projectRiskTypeSummary(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    name: document.name,
    description: document.description ?? null,
  };
}

export function projectControlSummary(document: RecordValue): RecordValue {
  const description = typeof document.description === "string"
    ? document.description.slice(0, 65_535)
    : null;
  return {
    documentId: document.documentId,
    controlNumber: document.controlNumber,
    name: document.name,
    description,
  };
}

export function projectActiveUserSummary(document: RecordValue): RecordValue {
  return { documentId: document.documentId, displayName: document.displayName };
}

const CONTROL_SUMMARY_FIELDS = ["documentId", "controlNumber", "name", "framework"] as const;
const CONTROL_SUMMARY_MAX_LENGTH = 255;

/**
 * D-34: the bounded summary of the control a mitigation control implements (the contract's
 * ControlImplementationControlSummary, with the Administration control record's 1-255 bounds), so every
 * reader names the control without its id. It is null when the control is not populated or a field falls
 * outside those bounds, never a partial or unbounded object.
 */
export function projectControlImplementationControlSummary(control: unknown): RecordValue | null {
  if (!isRecord(control)) return null;
  const summary: RecordValue = {};
  for (const field of CONTROL_SUMMARY_FIELDS) {
    const value = control[field];
    if (typeof value !== "string" || value.length === 0 || value.length > CONTROL_SUMMARY_MAX_LENGTH) return null;
    summary[field] = value;
  }
  return summary;
}

export function projectControlImplementationSummary(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    control: isRecord(document.control) && typeof document.control.documentId === "string"
      ? document.control.documentId
      : document.control,
    controlSummary: projectControlImplementationControlSummary(document.control),
    controlOwner: projectUser(document.controlOwner),
    controlStatus: document.controlStatus ?? null,
    effectivenessRating: document.effectivenessRating ?? null,
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}

export function parseActiveUserSearchQuery(query: unknown): string {
  if (!isRecord(query) || Object.keys(query).length !== 1 || typeof query.search !== "string") {
    throw new AssessmentScopeError(400, "CSRM active-user search is invalid.");
  }
  const search = query.search.trim();
  if (search.length < 1 || search.length > 100) {
    throw new AssessmentScopeError(400, "CSRM active-user search is invalid.");
  }
  return search;
}

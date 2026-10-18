import { composeAssessmentFilters, isReadableReleasedAssessment, readableAssessmentFilters, RELEASED_ASSESSMENT_FILTERS } from "./released-assessment-read";
import { parseAssessmentAiProvenance, projectAssessmentAiProvenance, projectRiskAiProvenance, type AiProvenanceLookups } from "./ai-provenance";
import { loadAiInputsChanged, type AiInputsChanged, type AiInputsSignalStrapi } from "../../../csrm/ai/ai-inputs-signal";
import type { RequestSummaryFacts } from "../../csrm-assessment-request/services/request-summary-facts";
import { isActiveRisk } from "../../../csrm/active-risk";

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
 * closed included, is within the analyst assessment scope: its unfiltered
 * collection adds no status predicate of its own, and an analyst may read any
 * assessment. The approved filter presents Released records, so it requires
 * the complete release triple also counted by throughput reports. The owner
 * collection shares this filter but always adds its
 * released-owner predicate, so there a status can narrow the scope but never
 * widen it, and anything other than approved selects nothing.
 */
const ASSESSMENT_STATUSES = ["draft", "in-review", "approved", "closed"] as const;

const COLLECTION_KEYS = ["q", "status", "overallRating", "approvedFrom", "approvedTo", "sort", "page", "pageSize"];
/* D-02 item 2: the overall rating filter's closed vocabulary, the AssessmentRating ladder. */
const OVERALL_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;

function assertCollectionKeys(query: RecordValue): void {
  if (Object.keys(query).some((key) => !COLLECTION_KEYS.includes(key))) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
}

function collectionRating(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !OVERALL_RATINGS.includes(value as typeof OVERALL_RATINGS[number])) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  return value;
}

const DAY_MS = 86_400_000;

/** A YYYY-MM-DD calendar date that exists, as the UTC midnight it starts; anything else is a 400. */
function collectionDate(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  const start = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== value) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  return start;
}

/**
 * D-02 item 2: the released date range compares the approval instant's UTC date, both ends inclusive, so the range
 * is [from at 00:00 UTC, the day after to at 00:00 UTC). A range whose start follows its end is a 400.
 */
function approvalDatePredicates(from: unknown, to: unknown): RecordValue[] {
  const start = collectionDate(from);
  const end = collectionDate(to);
  if (start !== undefined && end !== undefined && start > end) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  return [
    ...(start !== undefined ? [{ approvalDate: { $gte: new Date(start).toISOString() } }] : []),
    ...(end !== undefined ? [{ approvalDate: { $lt: new Date(end + DAY_MS).toISOString() } }] : []),
  ];
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

/** The parsed filters both assessment lists and their exports share, with the scope's own predicate composed in. */
type AssessmentCollectionFilters = {
  readonly filters: RecordValue;
  readonly q: string | undefined;
  readonly status: string | undefined;
  readonly overallRating: string | undefined;
  readonly approvedFrom: string | undefined;
  readonly approvedTo: string | undefined;
};

function assessmentCollectionFilters(query: RecordValue, state: unknown, scope: "owner" | "analyst"): AssessmentCollectionFilters {
  const q = collectionText(query.q);
  const overallRating = collectionRating(query.overallRating);
  if (query.status !== undefined && (typeof query.status !== "string" || !ASSESSMENT_STATUSES.includes(query.status as typeof ASSESSMENT_STATUSES[number]))) {
    throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  }
  // D-02 item 2: q matches the number, the summary or the request's title. Every filter joins one conjunction with
  // the owner's released predicate below, so on the owner list a filter only ever narrows it (T-11-04).
  const predicates: RecordValue[] = [
    ...(q ? [{ $or: [
      { assessmentNumber: { $containsi: q } },
      { summary: { $containsi: q } },
      { assessmentRequest: { title: { $containsi: q } } },
    ] }] : []),
    ...(query.status ? [{ assessmentStatus: { $eq: query.status } }] : []),
    ...(overallRating ? [{ overallRating: { $eq: overallRating } }] : []),
    ...approvalDatePredicates(query.approvedFrom, query.approvedTo),
  ];
  if (scope === "owner") {
    // D-14: My risk assessments lists exactly what the one record-read check lets its owner read.
    const ownerDocumentId = assessmentOwnerCollectionDocumentId(state);
    predicates.push(composeAssessmentFilters(readableAssessmentFilters({ kind: "requestor", documentId: ownerDocumentId }), RELEASED_ASSESSMENT_FILTERS));
  } else {
    assertAnalystAssessmentScope(state);
    // The UI calls approved "Released". Match the report's complete release
    // triple, excluding dated legacy approvals without an approver. Partial
    // records remain available in the analyst's unfiltered review collection.
    if (query.status === "approved") {
      predicates.push({ approvalDate: { $notNull: true }, approvedBy: { documentId: { $notNull: true } } });
    }
  }
  return {
    filters: predicates.length === 1 ? predicates[0] : { $and: predicates },
    q,
    status: query.status as string | undefined,
    overallRating,
    // approvalDatePredicates has proven each an existing YYYY-MM-DD date.
    approvedFrom: query.approvedFrom as string | undefined,
    approvedTo: query.approvedTo as string | undefined,
  };
}

/** D-23: the Requestor's own list never names who generated a draft, so it does not load the generator. */
function collectionPopulate(scope: "owner" | "analyst"): RecordValue {
  return { assessmentRequest: { populate: { requestor: true } }, ...(scope === "analyst" ? { generatedBy: true } : {}), reviewedBy: true, approvedBy: true };
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
  const { filters } = assessmentCollectionFilters(query, state, scope);
  const countQuery = { filters };
  return {
    countQuery,
    dataQuery: {
      ...countQuery,
      populate: collectionPopulate(scope),
      sort: collectionSort(query.sort),
      start: (page - 1) * pageSize,
      limit: pageSize,
    },
    pagination: { page, pageSize },
  };
}

/** A list's parsed export query (19-10; D-04, D-05): its filters and order, never a page. */
export type AssessmentExportQuery = AssessmentCollectionFilters & {
  readonly scope: "owner" | "analyst";
  /** The list's own count query: its filters, in its scope. */
  readonly countQuery: RecordValue;
  /** The list's order: the chosen sort, then the assessment number. */
  readonly sort: readonly string[];
  /** The list's own populate, for hydration. */
  readonly populate: RecordValue;
};

/**
 * Phase 19 (D-04, D-05): an assessment list's export query, parsed exactly as the list parses its own (the same keys,
 * values, scope and order) except that a page or pageSize is refused, because an export holds the list whole. A
 * refusal is the list's AssessmentScopeError: 400 for the query, 403 for the scope.
 */
export function buildAssessmentExportQuery(query: unknown, state: unknown, scope: "owner" | "analyst"): AssessmentExportQuery {
  if (!isRecord(query)) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  assertCollectionKeys(query);
  if (query.page !== undefined || query.pageSize !== undefined) throw new AssessmentScopeError(400, "CSRM assessment collection query is invalid.");
  const parsed = assessmentCollectionFilters(query, state, scope);
  return { ...parsed, scope, countQuery: { filters: parsed.filters }, sort: collectionSort(query.sort), populate: collectionPopulate(scope) };
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

/** The Low to Critical residual rating ladder, lowest first: a rating's rank is its index plus one. */
export const RESIDUAL_RATING_LADDER = ["Low", "Moderate", "High", "Critical"] as const;
export type ResidualRating = typeof RESIDUAL_RATING_LADDER[number];

/**
 * D-31: an assessment's Risk count and the highest residual rating among its Risks, read by one grouped
 * aggregate over a page of assessments. A Risk with no residual rating, or one off the ladder, counts but
 * never rates, so an assessment with no rated Risk has a null rating.
 */
export type AssessmentRiskSummary = { riskCount: number; highestResidualRating: ResidualRating | null };

const REQUEST_TITLE_MAX_LENGTH = 255;

/** The populated request's title within the contract's 1-255 bounds; a missing or blank title reads null. */
function projectRequestTitle(value: unknown): string | null {
  if (!isRecord(value) || typeof value.title !== "string") return null;
  const { title } = value;
  return title.trim().length > 0 && title.length <= REQUEST_TITLE_MAX_LENGTH ? title : null;
}

/** D-02 item 2: the list item both assessment lists serve, its request title and its Risk summary included. */
export function projectAssessmentSummary(document: RecordValue, riskSummary?: AssessmentRiskSummary): RecordValue {
  return {
    documentId: document.documentId,
    assessmentNumber: document.assessmentNumber,
    assessmentStatus: document.assessmentStatus,
    summary: document.summary ?? null,
    overallRating: document.overallRating ?? null,
    generatedDate: document.generatedDate ?? null,
    generatedBy: projectUser(document.generatedBy),
    approvalDate: document.approvalDate ?? null,
    requestTitle: projectRequestTitle(document.assessmentRequest),
    riskCount: riskSummary?.riskCount ?? 0,
    highestResidualRating: riskSummary?.highestResidualRating ?? null,
  };
}

/**
 * The Requestor's own list item (D-23, WR-304, D10): the shared AssessmentSummary of Phase 11 D-02 item 2, whose
 * generatedBy is nullable, served as null. Only the analyst list's "Draft initiated by" names who generated a draft.
 */
export function projectRequestorAssessmentSummary(document: RecordValue, riskSummary?: AssessmentRiskSummary): RecordValue {
  return { ...projectAssessmentSummary(document, riskSummary), generatedBy: null };
}

export function projectAssessmentDetail(document: RecordValue, requestFacts?: RequestSummaryFacts): RecordValue {
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
    assessmentRequest: projectAssessmentRequestSummary(document.assessmentRequest, requestFacts),
    generatedBy: projectUser(document.generatedBy),
    reviewedBy: projectUser(document.reviewedBy),
    approvedBy: projectUser(document.approvedBy),
  };
}

/*
 * Phase 13 D-16, D-25 and Phase 14 D-27: the summary also names who holds the request, the notes figures and the files
 * figures, which only the analyst's assessment read loads (`loadAnalystRequestSummaryFacts`); every other read, a
 * Requestor's included, carries null.
 */
export function projectAssessmentRequestSummary(value: unknown, requestFacts?: RequestSummaryFacts): RecordValue {
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
    assignment: requestFacts?.assignment ?? null,
    notes: requestFacts?.notes ?? null,
    files: requestFacts?.files ?? null,
  };
}

/* D-23: an assessment is AI-assisted when it was generated through a provider. */
export function isAiAssistedAssessment(document: RecordValue): boolean {
  const generated = document.generatedDate instanceof Date || (typeof document.generatedDate === "string" && document.generatedDate.length > 0);
  return generated && typeof document.providerName === "string" && document.providerName.trim().length > 0;
}

/*
 * D-23 and D-25: the analyst's generation facts for the assessment, with the run from its aiProvenance, or
 * null for one generated before run records existed; null when the assessment was never generated.
 */
export function projectAssessmentGenerationFacts(document: RecordValue, aiInputs: AiInputsChanged | null = null): RecordValue | null {
  if (!(document.generatedDate instanceof Date) && !(typeof document.generatedDate === "string" && document.generatedDate.length > 0)) return null;
  return {
    generatedAt: document.generatedDate instanceof Date ? document.generatedDate.toISOString() : document.generatedDate,
    generatedBy: projectUser(document.generatedBy),
    providerName: typeof document.providerName === "string" ? document.providerName : null,
    providerVersion: typeof document.providerVersion === "string" ? document.providerVersion : null,
    runId: parseAssessmentAiProvenance(document.aiProvenance)?.runId ?? null,
    // Phase 13 D-29: loaded by the caller for a human Security Analyst (assessmentAiInputsChanged), else null.
    aiInputsChanged: aiInputs,
  };
}

/**
 * Phase 16 D-28: the assessment's newest completed context-wide run, its draft (`assessment-draft`) or a "Suggest more
 * risks" run (`risk-suggestions`), by completion time; never a "Rewrite this risk" run, which reads one Risk's context.
 * One bounded read, as `latestCompletedQuestionnaireContextRun` does for a questionnaire.
 */
export async function latestCompletedAssessmentContextRun(
  strapi: { documents: (uid: string) => { findMany: (query: RecordValue) => Promise<RecordValue[]> } },
  assessmentDocumentId: string,
): Promise<{ documentId: string } | null> {
  const [run] = await strapi.documents("api::csrm-ai-run.csrm-ai-run").findMany({
    filters: { assessment: { documentId: { $eq: assessmentDocumentId } }, operation: { $in: ["assessment-draft", "risk-suggestions"] }, status: { $eq: "completed" } },
    fields: ["documentId", "completedAt"],
    sort: ["completedAt:desc", "id:desc"],
    limit: 1,
  });
  return run && typeof run.documentId === "string" ? { documentId: run.documentId } : null;
}

/*
 * Phase 13 D-29 and Phase 14 D-36: the notes and files that changed the assessment's AI inputs since the AI last read
 * its whole context (one value, `loadAiInputsChanged`). Phase 16 D-28: the baseline is the newest completed
 * `assessment-draft` or `risk-suggestions` run of the assessment (`latestCompletedAssessmentContextRun`), falling back to
 * the run its aiProvenance names, and an assessment generated before run records compares by its generatedDate. The read's
 * generation.runId (projectAssessmentGenerationFacts) still names the draft run. Null for one never generated or with no
 * request. Callers serve it to human Security Analysts only.
 */
export async function assessmentAiInputsChanged(strapi: AiInputsSignalStrapi, document: RecordValue): Promise<AiInputsChanged | null> {
  if (!(document.generatedDate instanceof Date) && !(typeof document.generatedDate === "string" && document.generatedDate.length > 0)) return null;
  const request = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
  const requestDocumentId = request && typeof request.documentId === "string" ? request.documentId : null;
  if (!requestDocumentId) return null;
  const run = typeof document.documentId === "string" && document.documentId.length > 0
    ? await latestCompletedAssessmentContextRun(strapi as Parameters<typeof latestCompletedAssessmentContextRun>[0], document.documentId)
    : null;
  return loadAiInputsChanged(strapi, {
    requestDocumentId,
    baselineRunId: run?.documentId ?? parseAssessmentAiProvenance(document.aiProvenance)?.runId ?? null,
    generatedDate: document.generatedDate,
  });
}

/**
 * The Requestor variant intentionally contains no analyst-only aggregate fields, and of the AI facts only aiAssisted
 * (D-23). Who generated the draft is one of those facts: the released view dropped "Generated by" (UAT-032), and the
 * read no longer serves it either (WR-304, IN-107).
 */
export function projectReleasedAssessmentDetail(document: RecordValue): RecordValue {
  const { generatedBy: _analystOnly, ...released } = projectAssessmentDetail(document);
  return { actor: "requestor", ...released, aiAssisted: isAiAssistedAssessment(document) };
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

/* The controls already mitigating a risk: a proposed suggestion for one of them projects as present (D-21). */
function mitigatingControlIds(document: RecordValue): Set<string> {
  const implementations = Array.isArray(document.controlImplementations) ? document.controlImplementations : [];
  return new Set(implementations.flatMap((implementation) => {
    const control = isRecord(implementation) ? implementation.control : null;
    return isRecord(control) && typeof control.documentId === "string" ? [control.documentId] : [];
  }));
}

/*
 * CR-02: the risk's control implementations, when the read populated them, so an `added` suggestion whose control is
 * gone reads as proposed again; undefined when it did not, and no suggestion is read as gone.
 */
function implementationIdsOf(document: RecordValue): Set<string> | undefined {
  if (!Array.isArray(document.controlImplementations)) return undefined;
  return new Set(document.controlImplementations.flatMap((implementation) =>
    isRecord(implementation) && typeof implementation.documentId === "string" ? [implementation.documentId] : []));
}

/** The stored withdrawal instant as the contract's date-time, or null when it is not a readable instant. */
function withdrawalInstant(value: unknown): string | null {
  const instant = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return instant && Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
}

/*
 * Phase 16 D-08, D-03 item 9: the analyst's withdrawal block (RiskWithdrawal), null on an active Risk. `by` is the
 * withdrawing analyst as ActiveUserSummary, null when the read did not populate the person or the person is gone; the
 * reason is the stored one. A withdrawn Risk whose facts cannot be read still reads as withdrawn, never as active: its
 * missing instant fails the closed parser rather than hiding the withdrawal.
 */
export function projectRiskWithdrawal(document: RecordValue): RecordValue | null {
  if (isActiveRisk(document)) return null;
  return {
    at: withdrawalInstant(document.withdrawnAt) ?? document.withdrawnAt,
    by: projectUser(document.withdrawnBy),
    reason: typeof document.withdrawalReason === "string" ? document.withdrawalReason : null,
  };
}

export function projectAnalystRiskDetail(document: RecordValue, aiLookups?: AiProvenanceLookups): RecordValue {
  const result: RecordValue = { documentId: document.documentId, riskNumber: document.riskNumber };
  for (const field of RISK_DETAIL_FIELDS) {
    result[field] = ["riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "treatmentOwner"].includes(field)
      ? projectRelationDocumentId(document[field])
      : document[field] ?? null;
  }
  result.aiProvenance = aiLookups
    ? projectRiskAiProvenance(document.aiProvenance, aiLookups, mitigatingControlIds(document), implementationIdsOf(document))
    : null;
  result.withdrawal = projectRiskWithdrawal(document);
  return result;
}

export function projectAnalystAssessmentDetail(input: {
  assessment: RecordValue;
  risks: RecordValue[];
  ownerLabels: RecordValue[];
  releaseReadiness: RecordValue;
  aiLookups?: AiProvenanceLookups;
  /** Phase 13 D-29: the AI-inputs signal the caller loaded for a human Security Analyst. */
  aiInputsChanged?: AiInputsChanged | null;
  /** Phase 13 D-16, D-25: the request summary's assignee and notes figures the caller loaded. */
  requestFacts?: RequestSummaryFacts;
}): RecordValue {
  const { assessment, risks, ownerLabels, releaseReadiness, aiLookups } = input;
  if (risks.length > MAX_ASSESSMENT_RISKS) throw new AssessmentScopeError(400, "CSRM assessment Risk limit is exceeded.");
  for (const risk of risks) {
    if (!isRecord(risk)) throw new AssessmentScopeError(400, "CSRM assessment Risk is invalid.");
  }
  return {
    actor: "analyst",
    ...projectAssessmentDetail(assessment, input.requestFacts),
    // D-14: whether the assessment is released, by the one record-read check, so the analyst page offers its export and
    // print report from the server's rule, never a copy of it.
    released: isReadableReleasedAssessment(assessment, { kind: "analyst" }),
    generation: projectAssessmentGenerationFacts(assessment, input.aiInputsChanged ?? null),
    aiProvenance: aiLookups ? projectAssessmentAiProvenance(assessment.aiProvenance, aiLookups) : null,
    risks: risks.map((risk) => projectAnalystRiskDetail(risk, aiLookups)),
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

const RELATED_RECORD_MAX_LENGTH = 255;

/** A populated system or asset as `{ documentId, name }` within the 1-255 bounds the contract declares, else null. */
function projectRiskRelatedRecord(value: unknown): RecordValue | null {
  if (!isRecord(value)) return null;
  const { documentId, name } = value;
  if (typeof documentId !== "string" || documentId.length === 0 || documentId.length > RELATED_RECORD_MAX_LENGTH) return null;
  if (typeof name !== "string" || name.length === 0 || name.length > RELATED_RECORD_MAX_LENGTH) return null;
  return { documentId, name };
}

/**
 * The relations the assessment's risk list names (D-34). Owners cross as ActiveUserSummary (id and display
 * name only), exactly as a released assessment already names its analysts.
 */
export const ASSESSMENT_RISK_LIST_POPULATE = {
  informationSystemImpacted: true,
  informationAssetImpacted: true,
  riskOwner: true,
  treatmentOwner: true,
} as const;

/**
 * D-34: one Risk in the assessment's risk list (AssessmentRiskListItem), the read both actors' released views
 * render: the statement, the affected system and asset, the inherent and residual likelihood, consequence and
 * rating, the treatment action, plan and status, and the risk owner, treatment owner and target date (brief §8).
 * Analyst working facts (issue, cause, rationales, escalation, comments, classification, exemption) never cross.
 * The Risk create and update responses keep projectRiskSummary's five fields (research Pitfall 9).
 */
export function projectAssessmentRiskListItem(document: RecordValue): RecordValue {
  return {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    riskStatement: document.riskStatement ?? null,
    informationSystemImpacted: projectRiskRelatedRecord(document.informationSystemImpacted),
    informationAssetImpacted: projectRiskRelatedRecord(document.informationAssetImpacted),
    inherentLikelihood: document.inherentLikelihood ?? null,
    highestInherentConsequence: document.highestInherentConsequence ?? null,
    inherentRating: document.inherentRating ?? null,
    residualLikelihood: document.residualLikelihood ?? null,
    highestResidualConsequence: document.highestResidualConsequence ?? null,
    residualRating: document.residualRating ?? null,
    treatmentAction: document.treatmentAction ?? null,
    treatmentPlan: document.treatmentPlan ?? null,
    treatmentStatus: document.treatmentStatus ?? null,
    riskOwner: projectUser(document.riskOwner),
    treatmentOwner: projectUser(document.treatmentOwner),
    targetDate: document.targetDate ?? null,
  };
}

/** D-31: at most this many applicable controls cross on one picker Risk Type (the Administration relation bound). */
const RISK_TYPE_APPLICABLE_CONTROL_LIMIT = 1_000;

/**
 * D-31: the picker's Risk Type with its bounded applicable-control summary (RiskTypeApplicableControl), so the
 * mitigation control picker offers the controls that apply to a Risk's type first. Each control is exactly its
 * document id, number, name and framework within the Administration record's 1-255 bounds; a control outside
 * them is left out rather than served partially. The controls stay sorted by control number.
 */
export function projectRiskTypeSummary(document: RecordValue): RecordValue {
  const applicableControls = Array.isArray(document.applicableControls)
    ? document.applicableControls
      .flatMap((control) => {
        const summary = projectControlImplementationControlSummary(control);
        return summary ? [summary] : [];
      })
      .sort((left, right) => String(left.controlNumber).localeCompare(String(right.controlNumber)))
      .slice(0, RISK_TYPE_APPLICABLE_CONTROL_LIMIT)
    : [];
  return {
    documentId: document.documentId,
    name: document.name,
    description: document.description ?? null,
    applicableControls,
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

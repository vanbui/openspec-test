import { activeQuestionnaireDefinition, getVisibleQuestionKeys, isQuestionnaireValueValid, parseQuestionnaireDefinition, type QuestionnaireValue } from "../../csrm-questionnaire/services/questionnaire-definition";
import { createWithRiskNumber } from "../../csrm-risk/services/risk-number";
import { createWithAssessmentNumber } from "./assessment-number";
import { createAssessmentDraftRegistry, type AssessmentDraftJobActor, type AssessmentDraftJobRecord } from "./assessment-draft-registry";
import { parseAssessmentDraftProposal, type AssessmentDraftContext } from "./assessment-draft-provider";
import { deterministicAssessmentDraftProvider } from "./deterministic-assessment-draft-provider";
import { openaiCompatibleAssessmentDraftProvider } from "./openai-compatible-assessment-draft-provider";
import { CSRM_AI_PROVIDER_MODE } from "../../../csrm/ai-provider-selection";

type RecordValue = Record<string, unknown>;

export const ASSESSMENT_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;
export type AssessmentRating = typeof ASSESSMENT_RATINGS[number];

export class AssessmentWorkflowError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "AssessmentWorkflowError";
  }
}

const ASSESSMENT_WRITABLE_FIELDS = [
  "summary", "overallRating", "overallControlEffectiveness", "recommendationsSummary", "overallRiskRationale", "nextReviewDate",
] as const;

const RISK_WRITABLE_FIELDS = [
  "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "riskType", "riskOwner",
  "informationSystemImpacted", "informationAssetImpacted", "dataClassification", "inherentLikelihood", "highestInherentConsequence",
  "inherentRating", "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRating", "residualRatingRationale",
  "controlEffectiveness", "riskVelocity", "identifiedDate", "targetDate", "closureDate", "isExempted", "exemptionReviewDate",
  "escalationDetails", "comments", "riskCommunicationDate", "treatmentAction", "treatmentPlan", "treatmentOwner", "treatmentResolveDate",
  "treatmentStatus",
] as const;

const CONTROL_IMPLEMENTATION_WRITABLE_FIELDS = [
  "control", "controlOwner", "controlStatus", "effectivenessRating", "evidence", "implementationDueDate", "implementedDate", "reviewDate",
] as const;

// Resolved at call time: the provider modules import back into this module, so a
// module-load selection can observe a provider that has not finished initialising.
function activeAssessmentDraftProvider() {
  return CSRM_AI_PROVIDER_MODE === "openai-compatible"
    ? openaiCompatibleAssessmentDraftProvider
    : deterministicAssessmentDraftProvider;
}

const CONTROL_EFFECTIVENESS = ["Effective", "Partially Effective", "Ineffective", "Not Assessed"] as const;
const DATA_CLASSIFICATIONS = ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"] as const;
const RISK_VELOCITIES = ["Low", "Moderate", "High", "Very High"] as const;
const TREATMENT_ACTIONS = ["Accept", "Treat"] as const;
const TREATMENT_STATUSES = ["Not Started", "In Progress", "Overdue", "Complete"] as const;
const CONTROL_STATUSES = ["Existing", "Planned", "Implemented", "Retired"] as const;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRelation(value: unknown): boolean {
  if (isNonEmptyString(value)) return true;
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.documentId)
    || (typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isDateTime(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && isDate(value.slice(0, 10))
    && Number.isFinite(Date.parse(value));
}

function inValues<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function assertPayload(input: unknown, allowed: readonly string[]): asserts input is RecordValue {
  if (!isRecord(input) || Object.keys(input).length === 0 || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
  }
}

function invalid(): never {
  throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function nullableRelation(value: unknown): boolean {
  return value === null || isNonEmptyString(value);
}

function nullableDate(value: unknown): boolean {
  return value === null || isDate(value);
}

function nullableDateTime(value: unknown): boolean {
  return value === null || isDateTime(value);
}

function nullableEnum(value: unknown, values: readonly string[]): boolean {
  return value === null || inValues(value, values);
}

export function isAssessmentRating(value: unknown): value is AssessmentRating {
  return inValues(value, ASSESSMENT_RATINGS);
}

export function isReleased(value: unknown): boolean {
  return isRecord(value)
    && value.assessmentStatus === "approved"
    && isRelation(value.approvedBy)
    && isDateTime(value.approvalDate);
}

export function assertMutableAssessment(value: unknown): void {
  if (!isRecord(value)) throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  const hasReleaseFact = value.assessmentStatus === "approved" || value.approvedBy != null || value.approvalDate != null;
  if (hasReleaseFact || (value.assessmentStatus !== "draft" && value.assessmentStatus !== "in-review")) {
    throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.");
  }
}

type AcceptedEditState = {
  assessmentStatus?: unknown;
  requestStatus?: unknown;
  reviewedBy?: unknown;
  /** Release readiness of the assessment as it stood *before* the edit is applied. */
  releaseReady: boolean;
};

/**
 * The transition table for an accepted analyst edit.
 *
 * Four combinations are accepted; everything else is the existing 409 refusal.
 *
 * | Pre-edit assessment | Pre-edit request       | Reviewer | Release-ready | Result     |
 * | ------------------- | ---------------------- | -------- | ------------- | ---------- |
 * | draft               | risk-assessment-drafted | any     | any           | in-review  |
 * | draft               | under-review            | present  | any           | in-review  |
 * | in-review           | under-review            | present  | no            | in-review  |
 * | in-review           | under-review            | present  | yes           | draft      |
 *
 * The last row is the D-13 regression, and it knowingly supersedes the Phase 4
 * state precedent that "later edits preserve the original reviewer and states".
 * The *reviewer* half of that precedent is retained — the acting analyst is
 * stamped only on the first accepted edit and the reviewer is never cleared —
 * but the *state* half is superseded for exactly this case. Reason: D-04
 * requires a fresh review before release, while release readiness measures field
 * completeness only. Without a stored transition, a reviewed-then-edited
 * assessment would still satisfy the readiness gate and could be released with
 * no second review, which is precisely the gate D-04 exists to impose. A
 * derived "not release-ready" label would have left that gate passable.
 *
 * This is therefore a deliberate supersession, not an accidental regression.
 *
 * The superseded review fact is not deleted. After the regression the
 * assessment persists `assessmentStatus` `draft` together with a non-null
 * `reviewedBy` — a combination unreachable for an assessment that was never
 * reviewed — and that pairing is the durable evidence that a completed review
 * was withdrawn by a later edit. Per D-16 the transition is audited by the edit
 * record itself and never prompts for a separate free-text reason.
 *
 * The second row is the fresh-review pass that recovers a regressed
 * assessment, so no assessment can be stranded in a state it cannot leave.
 * `requestStatus` stays `under-review` in every accepted branch: only the
 * assessment regresses, never the request lifecycle.
 */
export function transitionForAcceptedEdit(
  current: AcceptedEditState,
  analystDocumentId: string,
): { assessmentStatus: "draft" | "in-review"; requestStatus: "under-review"; reviewedBy: unknown } {
  if (!isNonEmptyString(analystDocumentId)) throw new AssessmentWorkflowError(409, "CSRM assessment edit transition is invalid.");
  // Stamp the acting analyst only when no reviewer exists yet; otherwise the
  // existing reviewer of record passes through untouched.
  const reviewedBy = isRelation(current.reviewedBy) ? current.reviewedBy : analystDocumentId;
  if (current.assessmentStatus === "draft" && current.requestStatus === "risk-assessment-drafted") {
    return { assessmentStatus: "in-review", requestStatus: "under-review", reviewedBy };
  }
  if (current.assessmentStatus === "draft" && current.requestStatus === "under-review" && isRelation(current.reviewedBy)) {
    return { assessmentStatus: "in-review", requestStatus: "under-review", reviewedBy };
  }
  if (current.assessmentStatus === "in-review" && current.requestStatus === "under-review" && isRelation(current.reviewedBy)) {
    return {
      assessmentStatus: current.releaseReady ? "draft" : "in-review",
      requestStatus: "under-review",
      reviewedBy,
    };
  }
  throw new AssessmentWorkflowError(409, "CSRM assessment edit transition is invalid.");
}

export type ReleaseReadiness = { ready: boolean; missing: string[] };

type ReleaseReadinessRequirement = {
  scope: "assessment" | "risk";
  key: string;
  label: string;
  state: "met" | "outstanding";
  destination?: string;
  riskNumber?: string;
};

export type ProjectedReleaseReadiness = {
  ready: boolean;
  requirements: ReleaseReadinessRequirement[];
};

const ASSESSMENT_RELEASE_REQUIREMENTS = [
  { key: "assessmentStatus", label: "Assessment status" },
  { key: "reviewedBy", label: "Reviewed by" },
  { key: "summary", label: "Assessment summary" },
  { key: "overallRating", label: "Overall rating" },
  { key: "overallRiskRationale", label: "Overall risk rationale" },
] as const;

const RISK_RELEASE_REQUIREMENTS = [
  { key: "riskStatement", label: "Risk statement" },
  { key: "inherentLikelihood", label: "Inherent likelihood" },
  { key: "highestInherentConsequence", label: "Highest inherent consequence" },
  { key: "inherentRating", label: "Inherent rating" },
  { key: "residualLikelihood", label: "Residual likelihood" },
  { key: "highestResidualConsequence", label: "Highest residual consequence" },
  { key: "residualRating", label: "Residual rating" },
  { key: "riskOwner", label: "Risk owner" },
  { key: "treatmentAction", label: "Treatment action" },
  { key: "targetDate", label: "Target date" },
] as const;

const TREAT_RISK_RELEASE_REQUIREMENTS = [
  { key: "treatmentPlan", label: "Treatment plan" },
  { key: "treatmentOwner", label: "Treatment owner" },
  { key: "treatmentResolveDate", label: "Treatment resolve date" },
  { key: "controlImplementations", label: "At least one mitigation control" },
] as const;

function riskDestination(documentId: unknown): string {
  if (!isNonEmptyString(documentId) || documentId.length > 255) {
    throw new AssessmentWorkflowError(400, "CSRM assessment Risk identity is invalid.");
  }
  return `risk-${encodeURIComponent(documentId)}`;
}

function riskNumber(value: unknown): string {
  if (!isNonEmptyString(value) || value.length > 100) {
    throw new AssessmentWorkflowError(400, "CSRM assessment Risk identity is invalid.");
  }
  return value;
}

function requirementState(missing: ReadonlySet<string>, path: string): "met" | "outstanding" {
  return missing.has(path) ? "outstanding" : "met";
}

/** Converts internal validation paths into the bounded analyst-facing checklist. */
export function projectReleaseReadiness(value: unknown): ProjectedReleaseReadiness {
  const validation = validateReleaseReadiness(value);
  const missing = new Set(validation.missing);
  const assessment = isRecord(value) ? value : null;
  const risks = assessment && Array.isArray(assessment.risks) ? assessment.risks : [];
  const requirements: ReleaseReadinessRequirement[] = ASSESSMENT_RELEASE_REQUIREMENTS.map(({ key, label }) => ({
    scope: "assessment",
    key,
    label,
    state: requirementState(missing, key),
  }));

  if (assessment && Array.isArray(assessment.risks)) {
    for (let index = 0; index < risks.length; index += 1) {
      const risk = risks[index];
      if (!isRecord(risk)) throw new AssessmentWorkflowError(400, "CSRM assessment Risk identity is invalid.");
      const destination = riskDestination(risk.documentId);
      const stableRiskNumber = riskNumber(risk.riskNumber);
      const prefix = `risks[${index}]`;
      const definitions = risk.treatmentAction === "Treat"
        ? [...RISK_RELEASE_REQUIREMENTS, ...TREAT_RISK_RELEASE_REQUIREMENTS]
        : RISK_RELEASE_REQUIREMENTS;
      for (const { key, label } of definitions) {
        const path = key === "controlImplementations"
          && missing.has(`${prefix}.controlImplementations.control`)
          ? `${prefix}.controlImplementations.control`
          : `${prefix}.${key}`;
        requirements.push({
          scope: "risk",
          key,
          label,
          state: requirementState(missing, path),
          riskNumber: stableRiskNumber,
          destination,
        });
      }
    }
  }

  requirements.push({
    scope: "assessment",
    key: "risks",
    label: "At least one Risk",
    state: requirementState(missing, "risks"),
    destination: "identified-risks",
  });
  return { ready: requirements.every((requirement) => requirement.state === "met"), requirements };
}

export function validateReleaseReadiness(value: unknown): ReleaseReadiness {
  const missing: string[] = [];
  if (!isRecord(value)) return { ready: false, missing: ["assessment"] };
  if (value.assessmentStatus !== "in-review") missing.push("assessmentStatus");
  if (!isRelation(value.reviewedBy)) missing.push("reviewedBy");
  if (!isNonEmptyString(value.summary)) missing.push("summary");
  if (!isAssessmentRating(value.overallRating)) missing.push("overallRating");
  if (!isNonEmptyString(value.overallRiskRationale)) missing.push("overallRiskRationale");
  if (!Array.isArray(value.risks) || value.risks.length === 0) {
    missing.push("risks");
    return { ready: false, missing };
  }

  value.risks.forEach((risk, index) => {
    const prefix = `risks[${index}]`;
    if (!isRecord(risk)) {
      missing.push(prefix);
      return;
    }
    const requiredStrings = ["riskStatement", "inherentLikelihood", "highestInherentConsequence", "residualLikelihood", "highestResidualConsequence"];
    for (const field of requiredStrings) if (!isNonEmptyString(risk[field])) missing.push(`${prefix}.${field}`);
    for (const field of ["inherentRating", "residualRating"]) if (!isAssessmentRating(risk[field])) missing.push(`${prefix}.${field}`);
    if (!isRelation(risk.riskOwner)) missing.push(`${prefix}.riskOwner`);
    if (!inValues(risk.treatmentAction, TREATMENT_ACTIONS)) missing.push(`${prefix}.treatmentAction`);
    if (!isDate(risk.targetDate)) missing.push(`${prefix}.targetDate`);
    if (risk.treatmentAction === "Treat") {
      if (!isNonEmptyString(risk.treatmentPlan)) missing.push(`${prefix}.treatmentPlan`);
      if (!isRelation(risk.treatmentOwner)) missing.push(`${prefix}.treatmentOwner`);
      if (!isDate(risk.treatmentResolveDate)) missing.push(`${prefix}.treatmentResolveDate`);
      const controls = Array.isArray(risk.controlImplementations) ? risk.controlImplementations : [];
      if (controls.length === 0) missing.push(`${prefix}.controlImplementations`);
      else if (!controls.some((implementation) => isRecord(implementation) && isRelation(implementation.control))) {
        missing.push(`${prefix}.controlImplementations.control`);
      }
    }
  });
  return { ready: missing.length === 0, missing };
}

export function parseWritableAssessmentFields(input: unknown): RecordValue {
  assertPayload(input, ASSESSMENT_WRITABLE_FIELDS);
  for (const [field, value] of Object.entries(input)) {
    if (["summary", "recommendationsSummary", "overallRiskRationale"].includes(field) && typeof value !== "string") invalid();
    if (field === "overallRating" && !isAssessmentRating(value)) invalid();
    if (field === "overallControlEffectiveness" && !inValues(value, CONTROL_EFFECTIVENESS)) invalid();
    if (field === "nextReviewDate" && !nullableDate(value)) invalid();
  }
  return { ...input };
}

export type AssessmentMutationDocumentService = {
  create?: (query: { data: RecordValue }) => Promise<RecordValue>;
  findMany?: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};

export type AssessmentMutationStrapi = {
  documents: (uid: string) => AssessmentMutationDocumentService;
  db: AssessmentDraftStrapi["db"];
};

const assessmentMutationQueues = new WeakMap<object, Map<string, Promise<void>>>();

async function serializeAssessmentMutation<T>(strapi: AssessmentMutationStrapi, documentId: string, work: () => Promise<T>): Promise<T> {
  const key = strapi as object;
  const queues = assessmentMutationQueues.get(key) ?? new Map<string, Promise<void>>();
  assessmentMutationQueues.set(key, queues);
  const previous = queues.get(documentId) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queues.set(documentId, current);
  await previous;
  try {
    return await work();
  } finally {
    release?.();
    if (queues.get(documentId) === current) queues.delete(documentId);
  }
}

async function lockAssessment(strapi: AssessmentMutationStrapi, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder("api::csrm-assessment.csrm-assessment");
  query.select(["id"]);
  query.where({ documentId });
  query.forUpdate();
  query.transacting(transaction);
  await query.execute<unknown>();
}

// The release path and the mutation path must never disagree about what release
// readiness means, so both reload through this one relation set.
export const assessmentReleasePopulate = {
  assessmentRequest: { populate: { requestor: true } },
  risks: {
    populate: {
      riskOwner: true,
      treatmentOwner: true,
      controlImplementations: { populate: { control: true } },
    },
  },
  generatedBy: true,
  reviewedBy: true,
  approvedBy: true,
};

const assessmentMutationPopulate = {
  assessmentRequest: true,
  generatedBy: true,
  reviewedBy: true,
  approvedBy: true,
};

export async function withMutableAssessmentMutation<T>(input: {
  strapi: AssessmentMutationStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  mutate: (context: {
    assessment: RecordValue;
    assessmentRequest: RecordValue;
    transaction: unknown;
  }) => Promise<T>;
}): Promise<T> {
  if (!isNonEmptyString(input.assessmentDocumentId) || !isNonEmptyString(input.analystDocumentId)) {
    throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
  }
  return serializeAssessmentMutation(input.strapi, input.assessmentDocumentId, async () =>
    input.strapi.db.transaction(async ({ trx }) => {
      await lockAssessment(input.strapi, input.assessmentDocumentId, trx);
      const assessments = input.strapi.documents("api::csrm-assessment.csrm-assessment");
      // Reloaded through the release relation set so pre-edit readiness is
      // computed from the same record the release path would read.
      const assessment = await assessments.findOne({
        documentId: input.assessmentDocumentId,
        populate: assessmentReleasePopulate,
      });
      if (!assessment) throw new AssessmentWorkflowError(404, "CSRM assessment was not found.");
      assertMutableAssessment(assessment);
      const assessmentRequest = isRecord(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
      if (!assessmentRequest || !isNonEmptyString(assessmentRequest.documentId)) {
        throw new AssessmentWorkflowError(409, "CSRM assessment edit transition is invalid.");
      }
      const transition = transitionForAcceptedEdit({
        assessmentStatus: assessment.assessmentStatus,
        requestStatus: assessmentRequest.requestStatus,
        reviewedBy: assessment.reviewedBy,
        releaseReady: validateReleaseReadiness(assessment).ready,
      }, input.analystDocumentId);
      const result = await input.mutate({ assessment, assessmentRequest, transaction: trx });
      await assessments.update({
        documentId: input.assessmentDocumentId,
        data: {
          assessmentStatus: transition.assessmentStatus,
          reviewedBy: relationDocumentId(transition.reviewedBy) ?? transition.reviewedBy,
        },
      });
      if (assessment.assessmentStatus === "draft") {
        await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
          documentId: String(assessmentRequest.documentId),
          data: { requestStatus: transition.requestStatus },
        });
      }
      return result;
    }));
}

export async function updateAssessment(input: {
  strapi: AssessmentMutationStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async () => {
      const data = parseWritableAssessmentFields(input.body);
      await input.strapi.documents("api::csrm-assessment.csrm-assessment").update({
        documentId: input.assessmentDocumentId,
        data,
      });
    },
  });
  const updated = await input.strapi.documents("api::csrm-assessment.csrm-assessment").findOne({
    documentId: input.assessmentDocumentId,
    populate: assessmentMutationPopulate,
  });
  if (!updated) throw new AssessmentWorkflowError(404, "CSRM assessment was not found.");
  return updated;
}

export async function releaseAssessment(input: {
  strapi: AssessmentMutationStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  now?: () => Date;
}): Promise<RecordValue> {
  if (!isNonEmptyString(input.assessmentDocumentId) || !isNonEmptyString(input.analystDocumentId)) {
    throw new AssessmentWorkflowError(400, "CSRM assessment release data is invalid.");
  }
  await serializeAssessmentMutation(input.strapi, input.assessmentDocumentId, async () =>
    input.strapi.db.transaction(async ({ trx }) => {
      await lockAssessment(input.strapi, input.assessmentDocumentId, trx);
      const assessments = input.strapi.documents("api::csrm-assessment.csrm-assessment");
      const assessment = await assessments.findOne({
        documentId: input.assessmentDocumentId,
        populate: assessmentReleasePopulate,
      });
      if (!assessment) throw new AssessmentWorkflowError(404, "CSRM assessment was not found.");
      assertMutableAssessment(assessment);
      const assessmentRequest = isRecord(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
      if (!assessmentRequest
        || !isNonEmptyString(assessmentRequest.documentId)
        || assessmentRequest.requestStatus !== "under-review") {
        throw new AssessmentWorkflowError(409, "CSRM assessment is not ready for release.");
      }
      const readiness = validateReleaseReadiness(assessment);
      if (!readiness.ready) throw new AssessmentWorkflowError(409, "CSRM assessment is not ready for release.");
      const releasedAt = (input.now ?? (() => new Date()))().toISOString();
      await assessments.update({
        documentId: input.assessmentDocumentId,
        data: {
          assessmentStatus: "approved",
          approvedBy: input.analystDocumentId,
          approvalDate: releasedAt,
          assessmentDate: releasedAt,
        },
      });
      await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
        documentId: String(assessmentRequest.documentId),
        data: { requestStatus: "approved" },
      });
    }));
  const released = await input.strapi.documents("api::csrm-assessment.csrm-assessment").findOne({
    documentId: input.assessmentDocumentId,
    populate: assessmentReleasePopulate,
  });
  if (!released || !isReleased(released)) {
    throw new AssessmentWorkflowError(409, "CSRM assessment release could not be confirmed.");
  }
  return released;
}

export function parseWritableRiskFields(input: unknown): RecordValue {
  assertPayload(input, RISK_WRITABLE_FIELDS);
  const normalized = Object.fromEntries(Object.entries(input).map(([field, value]) => [
    field,
    typeof value === "string" ? value.trim() : value,
  ]));
  for (const [field, value] of Object.entries(normalized)) {
    if (["riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "treatmentOwner"].includes(field) && !nullableRelation(value)) invalid();
    else if (["inherentRating", "residualRating"].includes(field) && value !== null && !isAssessmentRating(value)) invalid();
    else if (field === "dataClassification" && !nullableEnum(value, DATA_CLASSIFICATIONS)) invalid();
    else if (field === "controlEffectiveness" && !nullableEnum(value, CONTROL_EFFECTIVENESS)) invalid();
    else if (field === "riskVelocity" && !nullableEnum(value, RISK_VELOCITIES)) invalid();
    else if (field === "treatmentAction" && !nullableEnum(value, TREATMENT_ACTIONS)) invalid();
    else if (field === "treatmentStatus" && !nullableEnum(value, TREATMENT_STATUSES)) invalid();
    else if (["identifiedDate", "targetDate", "closureDate", "riskCommunicationDate", "treatmentResolveDate"].includes(field) && !nullableDate(value)) invalid();
    else if (field === "exemptionReviewDate" && !nullableDateTime(value)) invalid();
    else if (field === "isExempted" && value !== null && typeof value !== "boolean") invalid();
    else if (![
      "riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "treatmentOwner", "inherentRating", "residualRating",
      "dataClassification", "controlEffectiveness", "riskVelocity", "treatmentAction", "treatmentStatus", "identifiedDate", "targetDate",
      "closureDate", "riskCommunicationDate", "treatmentResolveDate", "exemptionReviewDate", "isExempted",
    ].includes(field) && !nullableString(value)) invalid();
  }
  if ("riskStatement" in normalized && normalized.riskStatement === "") invalid();
  return normalized;
}

export function parseWritableControlImplementationFields(input: unknown): RecordValue {
  assertPayload(input, CONTROL_IMPLEMENTATION_WRITABLE_FIELDS);
  for (const [field, value] of Object.entries(input)) {
    if (["control", "controlOwner"].includes(field) && !nullableRelation(value)) invalid();
    else if (field === "controlStatus" && !nullableEnum(value, CONTROL_STATUSES)) invalid();
    else if (field === "effectivenessRating" && !nullableEnum(value, CONTROL_EFFECTIVENESS)) invalid();
    else if (["implementationDueDate", "implementedDate", "reviewDate"].includes(field) && !nullableDate(value)) invalid();
    else if (field === "evidence" && !nullableString(value)) invalid();
  }
  return { ...input };
}

type DraftDocumentService = {
  create: (query: { data: RecordValue }) => Promise<RecordValue>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};

type AssessmentDraftStrapi = {
  documents: (uid: string) => DraftDocumentService;
  db: {
    transaction: <T>(work: (context: { trx: unknown }) => Promise<T>) => Promise<T>;
    queryBuilder: (uid: string) => {
      select: (columns: string[]) => unknown;
      where: (where: RecordValue) => unknown;
      forUpdate: () => unknown;
      transacting: (transaction: unknown) => unknown;
      execute: <T>() => Promise<T>;
    };
  };
};

export class AssessmentDraftWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = "AssessmentDraftWorkflowError";
  }
}

type SubmittedAnswer = AssessmentDraftContext["answers"][number];
type RiskTypeContext = AssessmentDraftContext["riskTypes"][number] & { documentId: string };

function relationDocumentId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0
    ? value.documentId
    : null;
}

function submittedAnswers(questionnaire: RecordValue): SubmittedAnswer[] {
  const definition = parseQuestionnaireDefinition(questionnaire.questions);
  // D-07: deleted questions are retained as history but never become assessment input.
  const activeDefinition = activeQuestionnaireDefinition(definition);
  const envelopes = new Map<string, RecordValue>();
  for (const question of activeDefinition) {
    if (isRecord(question.answer)) envelopes.set(question.questionKey, question.answer);
  }
  const values = Object.fromEntries(activeDefinition.map((question) => [
    question.questionKey,
    envelopes.get(question.questionKey)?.value ?? null,
  ])) as Record<string, QuestionnaireValue>;
  const visible = new Set(getVisibleQuestionKeys(definition, values));
  return activeDefinition
    .filter((question) => visible.has(question.questionKey))
    .map((question) => {
      const answer = envelopes.get(question.questionKey);
      if (!answer
        || answer.schemaVersion !== 1
        || answer.state !== "submitted"
        || typeof answer.submittedAt !== "string"
        || !Number.isFinite(Date.parse(answer.submittedAt))
        || !isQuestionnaireValueValid(question, answer.value)) {
        throw new AssessmentDraftWorkflowError(409, "CSRM questionnaire is not submitted.");
      }
      return { questionKey: question.questionKey, value: answer.value as SubmittedAnswer["value"] };
    })
    .sort((left, right) => left.questionKey.localeCompare(right.questionKey));
}

async function loadRiskTypeContext(strapi: AssessmentDraftStrapi): Promise<RiskTypeContext[]> {
  const supported = new Set(["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"]);
  const rows = await strapi.documents("api::csrm-risk-type.csrm-risk-type").findMany({
    filters: { name: { $in: [...supported] } },
    populate: { applicableControls: true },
    limit: supported.size,
  });
  const riskTypes = rows.flatMap((row): RiskTypeContext[] => {
    if (typeof row.documentId !== "string" || typeof row.name !== "string" || !supported.has(row.name)) return [];
    const applicableControls = Array.isArray(row.applicableControls)
      ? row.applicableControls.flatMap((control) => isRecord(control) && typeof control.controlNumber === "string"
        ? [{ controlNumber: control.controlNumber }]
        : [])
      : [];
    return [{ documentId: row.documentId, name: row.name, applicableControls: applicableControls.sort((a, b) => a.controlNumber.localeCompare(b.controlNumber)) }];
  }).sort((left, right) => left.name.localeCompare(right.name));
  if (riskTypes.length !== supported.size) {
    throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft reference data is unavailable.");
  }
  return riskTypes;
}

async function loadDraftTarget(strapi: AssessmentDraftStrapi, questionnaireDocumentId: string) {
  if (typeof questionnaireDocumentId !== "string" || questionnaireDocumentId.length === 0) {
    throw new AssessmentDraftWorkflowError(400, "CSRM questionnaire identifier is invalid.");
  }
  const questionnaire = await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
    documentId: questionnaireDocumentId,
    populate: { assessmentRequest: { populate: { assessment: true } }, questions: true },
  });
  if (!questionnaire) throw new AssessmentDraftWorkflowError(404, "CSRM questionnaire was not found.");
  const request = isRecord(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  if (!request || typeof request.documentId !== "string") {
    throw new AssessmentDraftWorkflowError(409, "CSRM questionnaire cannot generate an assessment draft.");
  }
  const existingAssessmentId = relationDocumentId(request.assessment);
  if (existingAssessmentId) {
    if (request.requestStatus !== "risk-assessment-drafted") {
      throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft already exists.");
    }
    return { questionnaire, request, existingAssessmentId, answers: [] as SubmittedAnswer[] };
  }
  if (request.requestStatus !== "questionnaire-in-progress") {
    throw new AssessmentDraftWorkflowError(409, "CSRM questionnaire cannot generate an assessment draft.");
  }
  return { questionnaire, request, existingAssessmentId: null, answers: submittedAnswers(questionnaire) };
}

async function lockAssessmentRequest(strapi: AssessmentDraftStrapi, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request");
  query.select(["id"]);
  query.where({ documentId });
  query.forUpdate();
  query.transacting(transaction);
  await query.execute<unknown>();
}

async function persistAssessmentDraft(
  strapi: AssessmentDraftStrapi,
  questionnaireDocumentId: string,
  initiatingAnalystDocumentId: string,
): Promise<{ assessmentId: string }> {
  const target = await loadDraftTarget(strapi, questionnaireDocumentId);
  if (target.existingAssessmentId) return { assessmentId: target.existingAssessmentId };
  const riskTypes = await loadRiskTypeContext(strapi);
  const proposal = parseAssessmentDraftProposal(await activeAssessmentDraftProvider().generate({
    answers: target.answers,
    riskTypes,
  }));
  const riskTypeIds = new Map(riskTypes.map((riskType) => [riskType.name, riskType.documentId]));
  const generatedAt = new Date().toISOString();

  return strapi.db.transaction(async ({ trx }) => {
    await lockAssessmentRequest(strapi, String(target.request.documentId), trx);
    const authoritativeRequest = await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({
      documentId: String(target.request.documentId),
      populate: { assessment: true },
    });
    const existingAssessmentId = relationDocumentId(authoritativeRequest?.assessment);
    if (existingAssessmentId) return { assessmentId: existingAssessmentId };
    if (!authoritativeRequest || authoritativeRequest.requestStatus !== "questionnaire-in-progress") {
      throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft state changed.");
    }

    const assessment = await createWithAssessmentNumber((assessmentNumber) =>
      strapi.documents("api::csrm-assessment.csrm-assessment").create({ data: {
        assessmentNumber,
        assessmentStatus: "draft",
        generatedDate: generatedAt,
        generatedBy: initiatingAnalystDocumentId,
        providerName: activeAssessmentDraftProvider().name,
        providerVersion: activeAssessmentDraftProvider().version,
        summary: proposal.summary,
        overallRating: proposal.overallRating,
        recommendationsSummary: proposal.recommendationsSummary,
        overallRiskRationale: proposal.overallRiskRationale,
        assessmentRequest: String(target.request.documentId),
      } }));
    if (typeof assessment.documentId !== "string") throw new Error("Assessment draft persistence failed.");

    for (const risk of proposal.risks) {
      const riskType = riskTypeIds.get(risk.riskTypeName);
      if (!riskType) throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft reference data changed.");
      await createWithRiskNumber((riskNumber) =>
        strapi.documents("api::csrm-risk.csrm-risk").create({ data: {
          riskNumber,
          assessment: assessment.documentId,
          riskType,
          issueStatement: risk.issueStatement,
          riskStatement: risk.riskStatement,
          riskCategory: risk.riskCategory,
          riskSubCategory: risk.riskSubCategory,
          riskCause: risk.riskCause,
          potentialImpact: risk.potentialImpact,
          inherentLikelihood: risk.inherentLikelihood,
          highestInherentConsequence: risk.highestInherentConsequence,
          inherentRating: risk.inherentRating,
          inherentRatingRationale: risk.inherentRatingRationale,
          residualLikelihood: risk.residualLikelihood,
          highestResidualConsequence: risk.highestResidualConsequence,
          residualRating: risk.residualRating,
          residualRatingRationale: risk.residualRatingRationale,
          treatmentAction: risk.treatmentAction,
          treatmentPlan: risk.treatmentPlan,
          treatmentStatus: "Not Started",
        } }));
    }
    await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
      documentId: String(target.request.documentId),
      data: { requestStatus: "risk-assessment-drafted" },
    });
    return { assessmentId: assessment.documentId };
  });
}

type AssessmentDraftRegistry = ReturnType<typeof createAssessmentDraftRegistry>;
const assessmentDraftRegistries = new WeakMap<object, AssessmentDraftRegistry>();

function draftRegistry(strapi: AssessmentDraftStrapi): AssessmentDraftRegistry {
  const key = strapi as object;
  const existing = assessmentDraftRegistries.get(key);
  if (existing) return existing;
  const created = createAssessmentDraftRegistry({
    execute: ({ questionnaireId, initiatingAnalystDocumentId }) =>
      persistAssessmentDraft(strapi, questionnaireId, initiatingAnalystDocumentId),
  });
  assessmentDraftRegistries.set(key, created);
  return created;
}

function draftActor(analystDocumentId: string): AssessmentDraftJobActor {
  if (typeof analystDocumentId !== "string" || analystDocumentId.length === 0) {
    throw new AssessmentDraftWorkflowError(403, "CSRM assessment draft job access is denied.");
  }
  return { documentId: analystDocumentId, canReadAllDraftJobs: false };
}

export function projectAssessmentDraftJob(job: AssessmentDraftJobRecord): RecordValue {
  return {
    jobId: job.jobId,
    questionnaireId: job.questionnaireId,
    attempt: job.attempt,
    queuedAt: job.queuedAt,
    ...(job.startedAt ? { startedAt: job.startedAt } : {}),
    ...(job.completedAt ? { completedAt: job.completedAt } : {}),
    ...(job.assessmentId ? { assessmentId: job.assessmentId } : {}),
    ...(job.failure ? { failureCode: job.failure.code, failureMessage: job.failure.message } : {}),
    status: job.status,
  };
}

export async function generateAssessment(input: {
  strapi: AssessmentDraftStrapi;
  questionnaireDocumentId: string;
  analystDocumentId: string;
}): Promise<RecordValue> {
  await loadDraftTarget(input.strapi, input.questionnaireDocumentId);
  return projectAssessmentDraftJob(draftRegistry(input.strapi).enqueue({
    questionnaireId: input.questionnaireDocumentId,
    initiatingAnalystDocumentId: draftActor(input.analystDocumentId).documentId,
    providerName: activeAssessmentDraftProvider().name,
    providerVersion: activeAssessmentDraftProvider().version,
  }));
}

export function getAssessmentDraftJob(input: {
  strapi: AssessmentDraftStrapi;
  jobId: string;
  analystDocumentId: string;
}): RecordValue {
  return projectAssessmentDraftJob(draftRegistry(input.strapi).get(input.jobId, draftActor(input.analystDocumentId)));
}

export function retryAssessmentDraftJob(input: {
  strapi: AssessmentDraftStrapi;
  jobId: string;
  analystDocumentId: string;
}): RecordValue {
  return projectAssessmentDraftJob(draftRegistry(input.strapi).retry(input.jobId, draftActor(input.analystDocumentId)));
}

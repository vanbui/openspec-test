import { submittedQuestionAnswers, QuestionnaireNotSubmittedError, buildAssessmentContextFor, failureAttachmentIds, failureAttachmentsEntry, resolveContextAttachments, type ContextAttachmentReader, type ResolvedContextAttachment } from "../../../csrm/ai/assessment-context-loader";
import { AssessmentContextTooLargeError } from "../../../csrm/ai/assessment-context";
import { aiPolicyRefusalMessage, evaluateAiDataPolicy, readAiDataPolicyConfiguration } from "../../../csrm/ai/data-policy";
import { createRunningAiRun, completeAiRun, failAiRun, appendAiRunDecisions, AiRunRecordError, runProposalEnvelope, type AiRunDecisionEvent } from "../../csrm-ai-run/services/ai-run-record";
import { ASSESSMENT_AI_FIELDS, RISK_AI_FIELDS, RISK_STATEMENT_FIELDS, applyAiFieldEdit, parseAssessmentAiProvenance, parseRiskAiProvenance, proposedFieldsOf, type AssessmentAiProvenanceV1, type RiskAiProvenanceV1 } from "./ai-provenance";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import type { Core } from "@strapi/strapi";
import { createWithRiskNumber } from "../../csrm-risk/services/risk-number";
import { createWithAssessmentNumber } from "./assessment-number";
import { recordRiskHistory } from "../../csrm-risk-history-event/services/risk-history";
import { RISK_HISTORY_FIELDS, RISK_HISTORY_RELATIONS_POPULATE, riskChanges } from "../../../csrm/risk-history-changes";
import { assertNoOpenProposals } from "../../csrm-questionnaire/services/questionnaire-proposal-gates";
import { createAssessmentDraftRegistry, AssessmentDraftJobFailure, safeAssessmentDraftFailure, type AssessmentDraftJobActor, type AssessmentDraftJobRecord, type AssessmentDraftJobExecution } from "./assessment-draft-registry";
import { parseAssessmentDraftProposal, type AssessmentDraftProposal, type AssessmentRiskDraftProposal } from "./assessment-draft-provider";
import { deterministicAssessmentDraftProvider } from "./deterministic-assessment-draft-provider";
import { openaiCompatibleAssessmentDraftProvider } from "./openai-compatible-assessment-draft-provider";
import { CSRM_AI_PROVIDER_MODE } from "../../../csrm/ai-provider-selection";
import { RISK_RATINGS, type RiskRating } from "../../../csrm/risk-scale";
import { activeRisks } from "../../../csrm/active-risk";
import { DATA_CLASSIFICATIONS } from "../../../csrm/ai/data-policy";
import { generationJobViewerFacts, resolveGenerationJobInitiators, type GenerationJobViewerFacts } from "../../../csrm/generation-job-viewer";
import { openRiskProposalSummary } from "../../../csrm/ai/risk-proposals/risk-proposals-read";

type RecordValue = Record<string, unknown>;

export const ASSESSMENT_RATINGS = RISK_RATINGS;
export type AssessmentRating = RiskRating;

export class AssessmentWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
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

/** An assessment that can still change: draft or in review, with no release fact. */
export function isMutableAssessment(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasReleaseFact = value.assessmentStatus === "approved" || value.approvedBy != null || value.approvalDate != null;
  return !hasReleaseFact && (value.assessmentStatus === "draft" || value.assessmentStatus === "in-review");
}

export function assertMutableAssessment(value: unknown): void {
  if (!isMutableAssessment(value)) throw new AssessmentWorkflowError(409, "CSRM assessment is not mutable.", "ASSESSMENT_NOT_MUTABLE");
}

/** The person changing an assessment: the resolved IdamBox User's documentId. */
export type AssessmentActor = { documentId: string };

/**
 * Phase 16 D-22: the one server-side guard that decides whether this actor may change this assessment now. Every
 * mutation of an assessment, its Risks and their control implementations passes it inside the locked transaction
 * (withMutableAssessmentMutation), and every Phase 16 entry point and AI run checks it. Today it refuses a blank actor
 * (400) and an assessment that is not mutable (409 ASSESSMENT_NOT_MUTABLE: released, closed, or carrying any release
 * fact). It takes the actor so the later rules land here and nowhere else, each with its own closed reason:
 *
 * - Phase 17 adds G-11's rule: a nominated risk owner of the assessment is refused.
 * - Phase 17.1 adds ASSESS-24's acceptance-round lock: no change while an acceptance round is open.
 *
 * The edit transition is not part of the guard (D-23): a caller decides it from what its change did.
 */
export function assertAssessmentEditable(input: { assessment: unknown; actor: AssessmentActor }): void {
  if (!isRecord(input.actor) || !isNonEmptyString(input.actor.documentId)) {
    throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
  }
  assertMutableAssessment(input.assessment);
}

/** The guard's non-throwing form: false where the guard refuses with a 409. A 400 (a blank actor) still throws. */
export function isAssessmentEditable(input: { assessment: unknown; actor: AssessmentActor }): boolean {
  try {
    assertAssessmentEditable(input);
    return true;
  } catch (error) {
    if (error instanceof AssessmentWorkflowError && error.status === 409) return false;
    throw error;
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

const AI_REVIEW_REQUIREMENT = { key: "aiProposalsReviewed", label: "Review of AI proposals" } as const;
/* Phase 16 D-42: every risk AI proposal ("Suggest more risks", "Rewrite this risk") has a human decision. */
const AI_DECISIONS_REQUIREMENT = { key: "aiProposalsDecided", label: "Decisions on AI proposals", destination: "ai-proposals" } as const;

/**
 * Facts release readiness reads beside the assessment record (Phase 16 D-42). `openAiProposals` is the assessment's
 * open risk AI proposal count, derived from its runs (`openRiskProposalSummary`). The release path and the analyst
 * detail pass it; the pre-edit transition leaves it out, so its readiness stays field completeness only.
 */
export type ReleaseReadinessFacts = { openAiProposals: number };

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

/*
 * Phase 16 D-12, D-13 (16-RESEARCH Pitfall 2): the Risks release readiness counts, in their order. Both readiness
 * functions iterate this one list, so a `risks[index]` path names the same Risk in each. A withdrawn Risk drops out
 * (activeRisks); an entry that is not a record stays, so readiness keeps failing closed on it as before.
 */
function releaseReadinessRisks(risks: readonly unknown[]): unknown[] {
  const active = new Set(activeRisks(risks));
  return risks.filter((risk) => !isRecord(risk) || active.has(risk));
}

function requirementState(missing: ReadonlySet<string>, path: string): "met" | "outstanding" {
  return missing.has(path) ? "outstanding" : "met";
}

/*
 * CR-01: the review of AI proposals a record's stored aiProvenance asks for. Null (or absent) is a record from before
 * AI provenance and asks for none. Any other value that does not parse closed stands for AI proposals whose review can
 * no longer be shown, so it fails closed: the review stays outstanding until an administrator repairs the record.
 */
function aiReviewOf(stored: unknown, parse: (value: unknown) => AssessmentAiProvenanceV1 | RiskAiProvenanceV1 | null): "none" | "met" | "outstanding" {
  if (stored === null || stored === undefined) return "none";
  const envelope = parse(stored);
  if (!envelope) return "outstanding";
  if (Object.keys(envelope.fields).length === 0) return "none";
  return proposedFieldsOf(envelope).length > 0 ? "outstanding" : "met";
}

/**
 * Converts internal validation paths into the bounded analyst-facing checklist. Walk D13(a): the checklist is for an
 * assessment that can still be released, so one that can no longer change (released, closed, or carrying any release
 * fact) presents no requirement, met or outstanding: not ready, with an empty list, the contract's ReleaseReadiness.
 */
export function projectReleaseReadiness(value: unknown, facts?: ReleaseReadinessFacts): ProjectedReleaseReadiness {
  if (isRecord(value) && !isMutableAssessment(value)) return { ready: false, requirements: [] };
  const validation = validateReleaseReadiness(value, facts);
  const missing = new Set(validation.missing);
  const assessment = isRecord(value) ? value : null;
  // Phase 16 D-13 (Pitfall 2): the same active Risks validateReleaseReadiness iterates, so each risks[index] path
  // names the same Risk in both functions. A withdrawn Risk has no row.
  const risks = assessment && Array.isArray(assessment.risks) ? releaseReadinessRisks(assessment.risks) : [];
  const requirements: ReleaseReadinessRequirement[] = ASSESSMENT_RELEASE_REQUIREMENTS.map(({ key, label }) => ({
    scope: "assessment",
    key,
    label,
    state: requirementState(missing, key),
  }));
  if (assessment && aiReviewOf(assessment.aiProvenance, parseAssessmentAiProvenance) !== "none") {
    requirements.push({ scope: "assessment", ...AI_REVIEW_REQUIREMENT, state: requirementState(missing, AI_REVIEW_REQUIREMENT.key), destination: "assessment-details" });
  }
  if (facts) {
    const { key, label, destination } = AI_DECISIONS_REQUIREMENT;
    requirements.push({ scope: "assessment", key, label, state: requirementState(missing, key), destination });
  }

  if (assessment && Array.isArray(assessment.risks)) {
    for (let index = 0; index < risks.length; index += 1) {
      const risk = risks[index];
      if (!isRecord(risk)) throw new AssessmentWorkflowError(400, "CSRM assessment Risk identity is invalid.");
      const destination = riskDestination(risk.documentId);
      const stableRiskNumber = riskNumber(risk.riskNumber);
      const prefix = `risks[${index}]`;
      const definitions: Array<{ key: string; label: string }> = risk.treatmentAction === "Treat"
        ? [...RISK_RELEASE_REQUIREMENTS, ...TREAT_RISK_RELEASE_REQUIREMENTS]
        : [...RISK_RELEASE_REQUIREMENTS];
      if (aiReviewOf(risk.aiProvenance, parseRiskAiProvenance) !== "none") definitions.push(AI_REVIEW_REQUIREMENT);
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

export function validateReleaseReadiness(value: unknown, facts?: ReleaseReadinessFacts): ReleaseReadiness {
  const missing: string[] = [];
  if (!isRecord(value)) return { ready: false, missing: ["assessment"] };
  if (value.assessmentStatus !== "in-review") missing.push("assessmentStatus");
  if (!isRelation(value.reviewedBy)) missing.push("reviewedBy");
  if (!isNonEmptyString(value.summary)) missing.push("summary");
  if (!isAssessmentRating(value.overallRating)) missing.push("overallRating");
  if (!isNonEmptyString(value.overallRiskRationale)) missing.push("overallRiskRationale");
  if (aiReviewOf(value.aiProvenance, parseAssessmentAiProvenance) === "outstanding") missing.push("aiProposalsReviewed");
  // Phase 16 D-42: outstanding while any risk AI proposal is open (a damaged run counts none, so it fails open).
  if (facts && facts.openAiProposals > 0) missing.push(AI_DECISIONS_REQUIREMENT.key);
  // Phase 16 D-12, D-13: only active Risks count. An incomplete withdrawn Risk never blocks release, and an
  // assessment whose Risks are all withdrawn has "At least one Risk" outstanding. The release path and the
  // pre-edit transition read readiness through this function, so they inherit the rule.
  const risks = Array.isArray(value.risks) ? releaseReadinessRisks(value.risks) : [];
  if (risks.length === 0) {
    missing.push("risks");
    return { ready: false, missing };
  }

  risks.forEach((risk, index) => {
    const prefix = `risks[${index}]`;
    if (!isRecord(risk)) {
      missing.push(prefix);
      return;
    }
    if (aiReviewOf(risk.aiProvenance, parseRiskAiProvenance) === "outstanding") missing.push(`${prefix}.aiProposalsReviewed`);
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

export type AssessmentMutationTransition = "accepted-edit" | "none";

/*
 * WR-103: a decision on an AI proposal, and an edit of a proposed or accepted AI field, are recorded in the run's
 * decision history inside the mutation's transaction. A history that cannot take the record (the run was deleted, its
 * history no longer parses, or it is full at AI_RUN_BOUNDS.decisionEvents) refuses the change with its own closed
 * reason, and the transaction rolls back: no decision and no AI field edit is ever applied without its audit record.
 * Repairing the run is an administrator's task; the refusal says so to the analyst.
 */
export async function appendAiRunDecisionsWithinMutation(strapi: unknown, runId: string, events: readonly AiRunDecisionEvent[]): Promise<void> {
  try {
    await appendAiRunDecisions(strapi as Core.Strapi, runId, events);
  } catch (error) {
    if (error instanceof AiRunRecordError) throw new AssessmentWorkflowError(409, error.safeMessage, "AI_RUN_RECORD_UNAVAILABLE");
    throw error;
  }
}

/**
 * Phase 16 D-22 (16-RESEARCH Pitfall 1): the actor-free core of every assessment mutation. It serialises on the
 * assessment, opens the transaction, takes the row lock and loads the assessment through the release relation set
 * (404 when it is gone), then runs `work` inside that transaction. It applies no guard and no transition. Never nest
 * it for the same assessment: the inner call would wait on the queue its caller holds. Transaction-scoped inner
 * functions (createRiskWithinMutation, updateRiskWithinMutation, the control implementation ones) never call it, so a
 * batch calls them as often as it needs inside one lock.
 */
export async function withAssessmentLock<T>(
  strapi: AssessmentMutationStrapi,
  assessmentDocumentId: string,
  work: (context: { assessment: RecordValue; trx: unknown }) => Promise<T>,
): Promise<T> {
  if (!isNonEmptyString(assessmentDocumentId)) throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
  return serializeAssessmentMutation(strapi, assessmentDocumentId, async () =>
    strapi.db.transaction(async ({ trx }) => {
      await lockAssessment(strapi, assessmentDocumentId, trx);
      // Reloaded through the release relation set so pre-edit readiness is
      // computed from the same record the release path would read.
      const assessment = await strapi.documents("api::csrm-assessment.csrm-assessment").findOne({
        documentId: assessmentDocumentId,
        populate: assessmentReleasePopulate,
      });
      if (!assessment) throw new AssessmentWorkflowError(404, "CSRM assessment was not found.");
      return work({ assessment, trx });
    }));
}

/**
 * The analyst mutation wrapper: the lock core, the one editable guard (D-22), then `mutate`, then the accepted-edit
 * transition when the selected `transition` says so (D-23). `transition` is a value or a function of the mutation's
 * result (default `accepted-edit`); a caller whose change may change nothing passes
 * `(result) => result.changed ? "accepted-edit" : "none"`, so a no-op withdraws no review. The transition is computed
 * from the state captured before the mutation and written after it.
 */
export async function withMutableAssessmentMutation<T>(input: {
  strapi: AssessmentMutationStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  transition?: AssessmentMutationTransition | ((result: T) => AssessmentMutationTransition);
  mutate: (context: {
    assessment: RecordValue;
    assessmentRequest: RecordValue;
    transaction: unknown;
  }) => Promise<T>;
}): Promise<T> {
  if (!isNonEmptyString(input.assessmentDocumentId) || !isNonEmptyString(input.analystDocumentId)) {
    throw new AssessmentWorkflowError(400, "CSRM assessment mutation data is invalid.");
  }
  return withAssessmentLock(input.strapi, input.assessmentDocumentId, async ({ assessment, trx }) => {
    assertAssessmentEditable({ assessment, actor: { documentId: input.analystDocumentId } });
    const assessmentRequest = isRecord(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
    if (!assessmentRequest || !isNonEmptyString(assessmentRequest.documentId)) {
      throw new AssessmentWorkflowError(409, "CSRM assessment edit transition is invalid.");
    }
    const captured: AcceptedEditState = {
      assessmentStatus: assessment.assessmentStatus,
      requestStatus: assessmentRequest.requestStatus,
      reviewedBy: assessment.reviewedBy,
      releaseReady: validateReleaseReadiness(assessment).ready,
    };
    const result = await input.mutate({ assessment, assessmentRequest, transaction: trx });
    const selectedTransition = typeof input.transition === "function" ? input.transition(result) : input.transition ?? "accepted-edit";
    if (selectedTransition === "accepted-edit") {
      const wasDraft = captured.assessmentStatus === "draft";
      const transition = transitionForAcceptedEdit(captured, input.analystDocumentId);
      await input.strapi.documents("api::csrm-assessment.csrm-assessment").update({
        documentId: input.assessmentDocumentId,
        data: {
          assessmentStatus: transition.assessmentStatus,
          reviewedBy: relationDocumentId(transition.reviewedBy) ?? transition.reviewedBy,
        },
      });
      if (wasDraft) {
        await input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
          documentId: String(assessmentRequest.documentId),
          data: { requestStatus: transition.requestStatus },
        });
      }
    }
    return result;
  });
}

export async function updateAssessment(input: {
  strapi: AssessmentMutationStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  /** Verifier W-3: the editor holds the update through the human Security Analyst Role, so its edit reviews an AI field. */
  humanAnalyst: boolean;
  body: unknown;
}): Promise<RecordValue> {
  await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    mutate: async ({ assessment }) => {
      const data = parseWritableAssessmentFields(input.body);
      const provenance = parseAssessmentAiProvenance(assessment.aiProvenance);
      const valueChanged = provenance ? Object.keys(data).filter((field) => data[field] !== assessment[field]) : [];
      const at = new Date().toISOString();
      // D-21, verifier W-3: who edits decides each changed AI field's review state, in this transaction with its run event.
      const edit = provenance ? applyAiFieldEdit(provenance, valueChanged, { documentId: input.analystDocumentId, humanAnalyst: input.humanAnalyst }, at) : null;
      await input.strapi.documents("api::csrm-assessment.csrm-assessment").update({
        documentId: input.assessmentDocumentId,
        data: { ...data, ...(edit?.fields.length ? { aiProvenance: edit.provenance } : {}) },
      });
      if (provenance && edit?.fields.length) await appendAiRunDecisionsWithinMutation(input.strapi, provenance.runId, [
        { schemaVersion: 1, kind: "edited", at, by: input.analystDocumentId, target: "assessment", fields: edit.fields },
      ]);
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
  await withAssessmentLock(input.strapi, input.assessmentDocumentId, async ({ assessment }) => {
      const assessments = input.strapi.documents("api::csrm-assessment.csrm-assessment");
      assertAssessmentEditable({ assessment, actor: { documentId: input.analystDocumentId } });
      const assessmentRequest = isRecord(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
      if (!assessmentRequest
        || !isNonEmptyString(assessmentRequest.documentId)
        || assessmentRequest.requestStatus !== "under-review") {
        throw new AssessmentWorkflowError(409, "CSRM assessment is not ready for release.");
      }
      // Phase 16 D-42: inside the transaction, every risk AI proposal must be decided before release.
      const proposals = await openRiskProposalSummary(input.strapi as never, input.assessmentDocumentId);
      const readiness = validateReleaseReadiness(assessment, { openAiProposals: proposals.openCount });
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
    });
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
  config: { get: (key: string) => unknown };
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

const AI_PROPOSALS_OPEN_MESSAGE = "Decide every AI proposal on the questionnaire before generating the assessment draft.";

export class AssessmentDraftWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "AssessmentDraftWorkflowError";
  }
}

function relationDocumentId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0
    ? value.documentId
    : null;
}

function submittedAnswers(questionnaire: RecordValue): ReturnType<typeof submittedQuestionAnswers> {
  try {
    return submittedQuestionAnswers(questionnaire);
  } catch (error) {
    if (error instanceof QuestionnaireNotSubmittedError) throw new AssessmentDraftWorkflowError(409, error.message);
    throw error;
  }
}

async function loadDraftTarget(strapi: AssessmentDraftStrapi, questionnaireDocumentId: string) {
  if (typeof questionnaireDocumentId !== "string" || questionnaireDocumentId.length === 0) {
    throw new AssessmentDraftWorkflowError(400, "CSRM questionnaire identifier is invalid.");
  }
  const questionnaire = await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
    documentId: questionnaireDocumentId,
    populate: { assessmentRequest: { populate: { assessment: true, informationAssets: true } }, questions: true },
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
    return { questionnaire, request, existingAssessmentId };
  }
  if (request.requestStatus !== "questionnaire-in-progress") {
    throw new AssessmentDraftWorkflowError(409, "CSRM questionnaire cannot generate an assessment draft.");
  }
  submittedAnswers(questionnaire);
  return { questionnaire, request, existingAssessmentId: null };
}

async function lockAssessmentRequest(strapi: AssessmentDraftStrapi, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request");
  query.select(["id"]);
  query.where({ documentId });
  query.forUpdate();
  query.transacting(transaction);
  await query.execute<unknown>();
}

function initialAssessmentAiProvenance(proposal: AssessmentDraftProposal, runId: string): AssessmentAiProvenanceV1 {
  const sources: Record<string, string[]> = {
    summary: proposal.summarySources, overallRiskRationale: proposal.overallRiskRationaleSources,
    recommendationsSummary: proposal.recommendationsSummarySources,
  };
  return { schemaVersion: 1, runId, proposalKey: "assessment", fields: Object.fromEntries(ASSESSMENT_AI_FIELDS.map((name) =>
    [name, { state: "proposed", ...(name in sources ? { sources: sources[name] } : {}) }])) };
}
/**
 * A proposed Risk's AI provenance: each AI-written field `proposed`, with its citations on the statement fields, and its
 * suggested controls as Phase 12 suggestions. The draft keeps its facts without `runId` (the envelope's run); a Risk
 * added from a "Suggest more risks" item (Phase 16 D-25, D-33) passes `options` so each field names the suggestion run
 * and the envelope's `proposalKey` names the item.
 */
export function initialRiskAiProvenance(risk: AssessmentRiskDraftProposal, runId: string, options: { fieldRunIds?: boolean; proposalKey?: string } = {}): RiskAiProvenanceV1 {
  const fields = Object.fromEntries(RISK_AI_FIELDS.filter((name) =>
    name === "riskType" || name === "informationSystemImpacted" && risk.informationSystem !== null
    || name === "informationAssetImpacted" && risk.informationAsset !== null
    || name === "dataClassification" && risk.dataClassification !== null
    || !["informationSystemImpacted", "informationAssetImpacted", "dataClassification"].includes(name)
  ).map((name) => [name, { state: "proposed", ...(RISK_STATEMENT_FIELDS.includes(name as typeof RISK_STATEMENT_FIELDS[number])
    ? { sources: risk.sources[name as keyof typeof risk.sources] } : {}), ...(options.fieldRunIds ? { runId } : {}) }]));
  return {
    schemaVersion: 1, runId, proposalKey: options.proposalKey ?? risk.proposalKey, fields,
    uncitedClaims: risk.uncitedClaims,
    suggestions: risk.suggestedControls.map((suggestion) => ({ key: suggestion.controlNumber, ...suggestion, state: "proposed" as const })),
    adjustments: risk.adjustments,
  };
}
/*
 * WR-206 and IN-103 (D-20: every provider call has exactly one run, which completes or fails). When the request has
 * gained an assessment elsewhere by the time the draft's transaction holds it, the provider's proposal is not saved.
 * The run still ends: failed, with this closed code, recorded outside the transaction as every run failure is. The job
 * reports the assessment the request holds, as the pre-check does for a request that already has one.
 */
const ASSESSMENT_ALREADY_EXISTS = {
  code: "ASSESSMENT_ALREADY_EXISTS",
  message: "An assessment already exists for this request, so this draft was not saved.",
} as const;

export async function persistAssessmentDraft(strapi: AssessmentDraftStrapi, job: AssessmentDraftJobExecution): Promise<{ assessmentId: string }> {
  const { questionnaireId: questionnaireDocumentId, initiatingAnalystDocumentId } = job;
  const target = await loadDraftTarget(strapi, questionnaireDocumentId);
  if (target.existingAssessmentId) return { assessmentId: target.existingAssessmentId };
  const core = strapi as unknown as Core.Strapi;
  const requestId = String(target.request.documentId);
  let built: Awaited<ReturnType<typeof buildAssessmentContextFor>>;
  try { built = await buildAssessmentContextFor(strapi, { operation: "assessment-draft", requestId, questionnaireId: questionnaireDocumentId }); }
  // D-33: the failure keeps the files the refused context included, which the analyst's job reads name.
  catch (error) { if (error instanceof AssessmentContextTooLargeError) throw new AssessmentDraftJobFailure(error.code, error.safeMessage, error.attachmentDocumentIds); throw error; }
  if (built.policy.status === "refused") throw new AssessmentDraftJobFailure(built.policy.reason ?? "AI_POLICY_NOT_CONFIGURED", aiPolicyRefusalMessage(built.policy) ?? "The request cannot be sent to the provider.");
  const provider = activeAssessmentDraftProvider();
  const run = await createRunningAiRun(core, {
    operation: "assessment-draft", initiatedBy: initiatingAnalystDocumentId, providerName: provider.name,
    providerVersion: provider.version, assessmentRequest: requestId, contextSummary: built.context.summary,
    jobId: job.jobId, attempt: job.attempt, questionnaire: questionnaireDocumentId,
  });
  const generatedAt = new Date().toISOString();
  let outcome: { assessmentId: string; saved: boolean };
  try {
  const proposal = parseAssessmentDraftProposal(await provider.generate(built), built.context.allowed);
  // WR-104 (D-06): a proposal the run record cannot keep (over 1 MB) is invalid provider output, refused before anything is saved.
  const envelope = runProposalEnvelope(proposal as unknown as RecordValue, proposal.adjustments);
  if (!envelope) throw new AssessmentDraftJobFailure("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.");
  outcome = await strapi.db.transaction(async ({ trx }) => {
    await lockAssessmentRequest(strapi, String(target.request.documentId), trx);
    const authoritativeRequest = await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({
      documentId: String(target.request.documentId),
      populate: { assessment: true },
    });
    const existingAssessmentId = relationDocumentId(authoritativeRequest?.assessment);
    if (existingAssessmentId) return { assessmentId: existingAssessmentId, saved: false };
    if (!authoritativeRequest || authoritativeRequest.requestStatus !== "questionnaire-in-progress") {
      throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft state changed.");
    }
    // Phase 15 D-08, again inside the transaction: an item reopened while the job ran fails it before anything is saved.
    // The draft path keeps locking only the request row (15-RESEARCH §M).
    await assertNoOpenProposals(strapi as never, questionnaireDocumentId, (reason) => {
      throw new AssessmentDraftJobFailure(reason, AI_PROPOSALS_OPEN_MESSAGE);
    });

    const assessment = await createWithAssessmentNumber((assessmentNumber) =>
      strapi.documents("api::csrm-assessment.csrm-assessment").create({ data: {
        assessmentNumber,
        assessmentStatus: "draft",
        generatedDate: generatedAt,
        generatedBy: initiatingAnalystDocumentId,
        providerName: provider.name,
        providerVersion: provider.version,
        summary: proposal.summary,
        overallRating: proposal.overallRating,
        recommendationsSummary: proposal.recommendationsSummary,
        overallRiskRationale: proposal.overallRiskRationale,
        aiProvenance: initialAssessmentAiProvenance(proposal, run.documentId),
        assessmentRequest: String(target.request.documentId),
      } }));
    if (typeof assessment.documentId !== "string") throw new Error("Assessment draft persistence failed.");

    for (const risk of proposal.risks) {
      const riskType = risk.riskTypeName === null ? null : built.context.allowed.riskTypes[risk.riskTypeName];
      if (risk.riskTypeName !== null && !riskType) throw new AssessmentDraftWorkflowError(409, "CSRM assessment draft reference data changed.");
      const created = await createWithRiskNumber((riskNumber) =>
        strapi.documents("api::csrm-risk.csrm-risk").create({ data: {
          riskNumber,
          assessment: assessment.documentId,
          riskType,
          informationSystemImpacted: risk.informationSystem,
          informationAssetImpacted: risk.informationAsset,
          dataClassification: risk.dataClassification,
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
          aiProvenance: initialRiskAiProvenance(risk, run.documentId),
        } }));
      if (typeof created.documentId !== "string") throw new Error("Assessment draft persistence failed.");
      // Phase 16 D-19: a drafted Risk's history starts with its creation by the draft run, in the draft's transaction,
      // listing each starting value with `from: null` (the approved record).
      const stored = await strapi.documents("api::csrm-risk.csrm-risk").findOne({ documentId: created.documentId, populate: RISK_HISTORY_RELATIONS_POPULATE });
      if (!stored) throw new Error("Assessment draft persistence failed.");
      await recordRiskHistory(strapi, {
        kind: "created",
        riskDocumentId: created.documentId,
        assessmentDocumentId: assessment.documentId,
        actorDocumentId: initiatingAnalystDocumentId,
        sourceKind: "ai-run",
        aiRunDocumentId: run.documentId,
        changes: { fields: riskChanges(null, stored, RISK_HISTORY_FIELDS) },
      });
    }
    await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
      documentId: String(target.request.documentId),
      data: { requestStatus: "risk-assessment-drafted" },
    });
    await completeAiRun(core, run.documentId, { proposal: envelope, assessment: assessment.documentId });
    return { assessmentId: assessment.documentId, saved: true };
  });
  } catch (error) {
    // IN-102: the run records the code and message the job records for the same failure.
    await failAiRun(core, run.documentId, safeAssessmentDraftFailure(error));
    throw error;
  }
  if (!outcome.saved) await failAiRun(core, run.documentId, ASSESSMENT_ALREADY_EXISTS);
  return { assessmentId: outcome.assessmentId };
}

type AssessmentDraftRegistry = ReturnType<typeof createAssessmentDraftRegistry>;
const assessmentDraftRegistries = new WeakMap<object, AssessmentDraftRegistry>();

function draftRegistry(strapi: AssessmentDraftStrapi): AssessmentDraftRegistry {
  const key = strapi as object;
  const existing = assessmentDraftRegistries.get(key);
  if (existing) return existing;
  const created = createAssessmentDraftRegistry({
    execute: (job) => persistAssessmentDraft(strapi, job),
  });
  assessmentDraftRegistries.set(key, created);
  return created;
}

/**
 * Who reads or acts on a draft job: the resolved IdamBox User's documentId and, from the policy (13-03), whether the
 * route admitted them through the human Security Analyst role. D-18: that fact, never a constant, opens every job to
 * the human analyst, so a later route that reuses this workflow cannot widen by accident; without it a caller stays
 * with the jobs they started (fail closed).
 */
export type DraftJobViewer = { analystDocumentId: string; humanAnalyst?: boolean };

function draftActor(analystDocumentId: string, humanAnalyst?: boolean): AssessmentDraftJobActor {
  if (typeof analystDocumentId !== "string" || analystDocumentId.length === 0) {
    throw new AssessmentDraftWorkflowError(403, "CSRM assessment draft job access is denied.");
  }
  return { documentId: analystDocumentId, canReadAllDraftJobs: humanAnalyst === true };
}

/*
 * The bounded draft job projection, with the D-18 facts for its viewer (generation-job-viewer.ts). Phase 14 D-33: a
 * CONTEXT_TOO_LARGE failure also names the files it counted (failureAttachments), by their current names in `names`.
 */
export function projectAssessmentDraftJob(job: AssessmentDraftJobRecord, viewer: GenerationJobViewerFacts, names: ReadonlyMap<string, ResolvedContextAttachment> = new Map()): RecordValue {
  return {
    jobId: job.jobId,
    questionnaireId: job.questionnaireId,
    attempt: job.attempt,
    queuedAt: job.queuedAt,
    ...(job.startedAt ? { startedAt: job.startedAt } : {}),
    ...(job.completedAt ? { completedAt: job.completedAt } : {}),
    ...(job.assessmentId ? { assessmentId: job.assessmentId } : {}),
    ...(job.failure ? { failureCode: job.failure.code, failureMessage: job.failure.message, ...failureAttachmentsEntry(job.failure, names) } : {}),
    status: job.status,
    canRetry: viewer.canRetry,
    initiatedBy: viewer.initiatedBy,
    initiatedByViewer: viewer.initiatedByViewer,
  };
}

/* Projects one draft job for its viewer, resolving its initiator's display name and its failure's files with one bounded read each. */
async function projectDraftJobFor(strapi: AssessmentDraftStrapi, job: AssessmentDraftJobRecord, actor: AssessmentDraftJobActor): Promise<RecordValue> {
  const initiators = await resolveGenerationJobInitiators(strapi, [job.initiatingAnalystDocumentId]);
  const names = await resolveContextAttachments(strapi as unknown as ContextAttachmentReader, failureAttachmentIds(job.failure));
  return projectAssessmentDraftJob(job, generationJobViewerFacts({
    initiatorDocumentId: job.initiatingAnalystDocumentId,
    viewerDocumentId: actor.documentId,
    canRetry: draftRegistry(strapi).mayRetry(job, actor),
    initiators,
  }), names);
}

/* D-28: the AI data policy a draft for this request would face, refused with a 409 and its reason before any job is queued. */
function refuseDraftByAiDataPolicy(strapi: AssessmentDraftStrapi, request: RecordValue): void {
  const assets = Array.isArray(request.informationAssets) ? request.informationAssets.filter(isRecord) : [];
  const policy = evaluateAiDataPolicy({ assets, ...readAiDataPolicyConfiguration(strapi) });
  if (policy.status === "refused") throw new AssessmentDraftWorkflowError(409, aiPolicyRefusalMessage(policy) ?? "The request cannot be sent to the provider.", policy.reason ?? undefined);
}

export async function generateAssessment(input: {
  strapi: AssessmentDraftStrapi;
  questionnaireDocumentId: string;
} & DraftJobViewer): Promise<RecordValue> {
  const target = await loadDraftTarget(input.strapi, input.questionnaireDocumentId);
  refuseDraftByAiDataPolicy(input.strapi, target.request);
  const actor = draftActor(input.analystDocumentId, input.humanAnalyst);
  // Phase 15 D-08: the draft waits for every AI proposal on the questionnaire, refused before anything is queued.
  await assertNoOpenProposals(input.strapi as never, input.questionnaireDocumentId, (reason) => {
    throw new AssessmentDraftWorkflowError(409, AI_PROPOSALS_OPEN_MESSAGE, reason);
  });
  // A start may hand back the questionnaire's active job, which another analyst started; the projection says so.
  return projectDraftJobFor(input.strapi, draftRegistry(input.strapi).enqueue({
    questionnaireId: input.questionnaireDocumentId,
    initiatingAnalystDocumentId: actor.documentId,
    providerName: activeAssessmentDraftProvider().name,
    providerVersion: activeAssessmentDraftProvider().version,
  }), actor);
}

export async function getAssessmentDraftJob(input: {
  strapi: AssessmentDraftStrapi;
  jobId: string;
} & DraftJobViewer): Promise<RecordValue> {
  const actor = draftActor(input.analystDocumentId, input.humanAnalyst);
  return projectDraftJobFor(input.strapi, draftRegistry(input.strapi).get(input.jobId, actor), actor);
}

/**
 * D-25, D-18: the questionnaire's current draft job as the registry holds it, with whether this viewer may retry it.
 * The caller projects it (projectAssessmentDraftJob), so the request's jobs read resolves both jobs' initiators at once.
 */
export function latestAssessmentDraftJobForQuestionnaire(
  strapi: AssessmentDraftStrapi,
  questionnaireId: string,
  viewer: DraftJobViewer,
): { job: AssessmentDraftJobRecord; canRetry: boolean } | null {
  return draftRegistry(strapi).latestForQuestionnaire(questionnaireId, draftActor(viewer.analystDocumentId, viewer.humanAnalyst));
}

/*
 * IN-104 and WR-308 (D-28): a retry is a new attempt, so the AI data policy that refuses an enqueue refuses a retry the
 * same way, with the same 409 reason, before anything is queued: no new attempt and no run. The registry first answers
 * for the job (404, or 403 for a caller who may not follow it), and a job that has not failed keeps its own 409. A
 * request that can no longer be read is left to the job's execution, which re-checks everything before any run or
 * provider call. D-18: the retry is the retrying analyst's attempt (the registry re-attributes it).
 */
export async function retryAssessmentDraftJob(input: {
  strapi: AssessmentDraftStrapi;
  jobId: string;
} & DraftJobViewer): Promise<RecordValue> {
  const registry = draftRegistry(input.strapi);
  const actor = draftActor(input.analystDocumentId, input.humanAnalyst);
  const job = registry.get(input.jobId, actor);
  if (job.status === "failed") {
    const questionnaire = await input.strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({
      documentId: job.questionnaireId,
      populate: { assessmentRequest: { populate: { informationAssets: true } } },
    });
    if (questionnaire && isRecord(questionnaire.assessmentRequest)) refuseDraftByAiDataPolicy(input.strapi, questionnaire.assessmentRequest);
  }
  return projectDraftJobFor(input.strapi, registry.retry(input.jobId, actor), actor);
}

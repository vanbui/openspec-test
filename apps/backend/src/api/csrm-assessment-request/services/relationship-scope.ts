import { assessmentReleasePopulate } from "../../csrm-assessment/services/assessment-workflow";
import { questionnaireState } from "../../csrm-questionnaire/services/questionnaire-scope";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Three states, decided on the server and never inferred by the browser.
 *
 * `absent` and `unavailable` are deliberately different. Absent means the
 * related record does not exist and saying so discloses nothing. Unavailable
 * means it exists but this actor may not open it, so the response carries no
 * identity at all — no documentId, number, title, status or tally — because the
 * existence of the record is itself protected.
 */
export type RelationshipAvailability = "available" | "absent" | "unavailable";

const ASSESSMENT_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;

/*
 * The questionnaire is populated whole so the relation decision can read its
 * release fact. `releasedAt` is a scalar attribute of the populated
 * questionnaire, which is why no nested populate is needed for it.
 */
export const REQUEST_RELATIONSHIP_POPULATE = {
  requestor: true,
  questionnaire: { populate: { questions: true } },
  assessment: { populate: assessmentReleasePopulate },
} as const;

type ActorFacts = {
  /** True when the caller holds an explicit analyst grant rather than the Requestor birthright. */
  analyst: boolean;
};

export function requestActorFacts(state: unknown): ActorFacts {
  const authorization = isRecord(state) && isRecord(state.csrmAuthorization)
    ? state.csrmAuthorization
    : {};
  return { analyst: authorization.assessmentRequestActor === "analyst" };
}

/**
 * Counts the assessment's contextual Risks by residual rating.
 *
 * Residual rather than inherent: the residual rating is what remains after the
 * assessment's controls, so it is the figure a reader of a finished assessment
 * is deciding on. The product shows both ratings side by side in the Risk
 * Register, so an unqualified "risk count" would be ambiguous — the field and
 * its label both name the rating they count.
 */
function residualRiskCounts(assessment: RecordValue): RecordValue {
  const risks = Array.isArray(assessment.risks) ? assessment.risks : [];
  const counts: RecordValue = { Low: 0, Moderate: 0, High: 0, Critical: 0, total: risks.length };
  for (const risk of risks) {
    if (!isRecord(risk)) continue;
    const rating = risk.residualRating;
    if (typeof rating === "string" && (ASSESSMENT_RATINGS as readonly string[]).includes(rating)) {
      counts[rating] = Number(counts[rating]) + 1;
    }
  }
  return counts;
}

/** Counts only populated contextual control-implementation records. */
function controlImplementationCount(assessment: RecordValue): number {
  const risks = Array.isArray(assessment.risks) ? assessment.risks : [];
  return risks.reduce((count, risk) => {
    if (!isRecord(risk)) return count;
    const controls = Array.isArray(risk.controlImplementations) ? risk.controlImplementations : [];
    return count + controls.filter(isRecord).length;
  }, 0);
}

/**
 * A Requestor may open their assessment only once it is released to them; an
 * analyst may open it at any point in its lifecycle. An assessment that exists
 * but is not yet released is therefore `unavailable` to its Requestor, not
 * absent, and carries no identity.
 */
function assessmentIsOpenable(assessment: RecordValue, request: RecordValue, actor: ActorFacts): boolean {
  if (actor.analyst) return true;
  return assessment.assessmentStatus === "approved" && request.requestStatus === "approved";
}

/**
 * A Requestor may open their questionnaire only once it is released to them; an
 * analyst may open it at any point, because a generated questionnaire is
 * analyst-only work until they choose to release it. A questionnaire that
 * exists but is not yet released is therefore `unavailable` to its Requestor,
 * not absent, and carries no identity.
 */
function questionnaireIsOpenable(questionnaire: RecordValue, actor: ActorFacts): boolean {
  if (actor.analyst) return true;
  return isNonEmptyString(questionnaire.releasedAt);
}

/*
 * The relation states where a questionnaire stands, not merely whether answers
 * exist. The release fact is authoritative (D-14): until it is set the
 * questionnaire is in analyst review, and only an Analyst sees it at all. There
 * is no persisted state attribute to read, so the fact is derived here from the
 * release timestamp and the answers, exactly as the lifecycle derives it.
 */
function questionnaireRelationState(questionnaire: RecordValue): string {
  if (!isNonEmptyString(questionnaire.releasedAt)) return "analyst-review";
  return questionnaireState(questionnaire) === "submitted" ? "submitted" : "released";
}

function questionnaireRelationship(request: RecordValue, actor: ActorFacts): RecordValue {
  const questionnaire = isRecord(request.questionnaire) ? request.questionnaire : null;
  if (!questionnaire || !isNonEmptyString(questionnaire.documentId)) {
    return { availability: "absent" satisfies RelationshipAvailability };
  }
  if (!questionnaireIsOpenable(questionnaire, actor)) {
    return { availability: "unavailable" satisfies RelationshipAvailability };
  }
  return {
    availability: "available" satisfies RelationshipAvailability,
    documentId: questionnaire.documentId,
    questionnaireNumber: isNonEmptyString(questionnaire.questionnaireNumber) ? questionnaire.questionnaireNumber : null,
    title: isNonEmptyString(questionnaire.title) ? questionnaire.title : null,
    state: questionnaireRelationState(questionnaire),
  };
}

function assessmentRelationship(request: RecordValue, actor: ActorFacts): RecordValue {
  const assessment = isRecord(request.assessment) ? request.assessment : null;
  if (!assessment || !isNonEmptyString(assessment.documentId)) {
    return { availability: "absent" satisfies RelationshipAvailability };
  }
  if (!assessmentIsOpenable(assessment, request, actor)) {
    return { availability: "unavailable" satisfies RelationshipAvailability };
  }
  return {
    availability: "available" satisfies RelationshipAvailability,
    documentId: assessment.documentId,
    assessmentNumber: isNonEmptyString(assessment.assessmentNumber) ? assessment.assessmentNumber : null,
    assessmentStatus: isNonEmptyString(assessment.assessmentStatus) ? assessment.assessmentStatus : null,
    residualRiskCounts: residualRiskCounts(assessment),
    controlImplementationCount: controlImplementationCount(assessment),
  };
}

/**
 * Projects the request's related records as a bounded, identity-safe summary.
 * The caller has already passed the request's own record-scope check; this
 * decides, per relation, whether the actor may also open that record.
 */
export function projectRequestRelationships(document: unknown, state: unknown): RecordValue {
  if (!isRecord(document)) return { questionnaire: { availability: "absent" }, assessment: { availability: "absent" } };
  const actor = requestActorFacts(state);
  return {
    questionnaire: questionnaireRelationship(document, actor),
    assessment: assessmentRelationship(document, actor),
  };
}

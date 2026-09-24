import { isReleased, validateReleaseReadiness } from "../../csrm-assessment/services/assessment-workflow";
import { questionnaireState } from "../../csrm-questionnaire/services/questionnaire-scope";
import { projectRequestRelationships, requestActorFacts } from "./relationship-scope";

type RecordValue = Record<string, unknown>;
type LifecycleKey = typeof REQUEST_LIFECYCLE_STEPS[number]["key"];
type LifecycleState = "completed" | "current" | "future";
type RequestActor = "requestor" | "analyst";

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export const REQUEST_LIFECYCLE_STEPS = Object.freeze([
  { key: "draft", label: "Draft" }, { key: "submitted", label: "Submitted" },
  { key: "questionnaire-generated", label: "Questionnaire generated" }, { key: "questionnaire-released", label: "Questionnaire released" },
  { key: "questionnaire-submitted", label: "Questionnaire submitted" }, { key: "assessment-drafted", label: "Assessment drafted" },
  { key: "assessment-reviewed", label: "Assessment reviewed" }, { key: "assessment-released", label: "Assessment released" },
] as const);

export type RequestLifecycleFacts = { requestStatus: unknown; questionnaireExists: boolean; questionnaireReleased: boolean; questionnaireSubmitted: boolean; assessmentExists: boolean; assessmentReviewedAndReady: boolean; assessmentReleased: boolean };
export type RequestLifecycle = { currentKey: LifecycleKey; currentLabel: string; terminal: boolean; nextAction: { actor: RequestActor | "none"; summary: string; href?: string } | null; steps: readonly { key: LifecycleKey; label: string; state: LifecycleState }[] };

function highestMatchingStep(facts: RequestLifecycleFacts): number {
  if (facts.requestStatus === "closed") return 7;
  if (facts.assessmentReleased) return 7;
  if (facts.assessmentReviewedAndReady) return 6;
  if (facts.assessmentExists) return 5;
  if (facts.questionnaireSubmitted) return 4;
  if (facts.questionnaireReleased) return 3;
  if (facts.questionnaireExists) return 2;
  return facts.requestStatus === "draft" ? 0 : 1;
}

export function deriveRequestLifecycle(facts: RequestLifecycleFacts): RequestLifecycle {
  const currentIndex = highestMatchingStep(facts);
  const current = REQUEST_LIFECYCLE_STEPS[currentIndex];
  return { currentKey: current.key, currentLabel: current.label, terminal: facts.requestStatus === "closed", nextAction: null,
    steps: REQUEST_LIFECYCLE_STEPS.map((step, index) => ({ ...step, state: facts.requestStatus === "closed" || index < currentIndex ? "completed" : index === currentIndex ? "current" : "future" })) };
}

function actionFor(currentKey: LifecycleKey, actor: RequestActor, requestId: string | undefined, relationships: RecordValue): RequestLifecycle["nextAction"] {
  const questionnaire = isRecord(relationships.questionnaire) ? relationships.questionnaire : {};
  const assessment = isRecord(relationships.assessment) ? relationships.assessment : {};
  const questionnaireId = questionnaire.availability === "available" && nonEmptyString(questionnaire.documentId) ? questionnaire.documentId : undefined;
  const assessmentId = assessment.availability === "available" && nonEmptyString(assessment.documentId) ? assessment.documentId : undefined;
  const requestHref = requestId ? actor === "analyst" ? `/app/review/requests/${encodeURIComponent(requestId)}` : `/app/requests/${encodeURIComponent(requestId)}` : undefined;
  const questionnaireHref = questionnaireId ? actor === "analyst" ? `/app/review/questionnaires/${encodeURIComponent(questionnaireId)}` : `/app/questionnaires/${encodeURIComponent(questionnaireId)}` : undefined;
  const assessmentHref = assessmentId ? actor === "analyst" ? `/app/review/assessments/${encodeURIComponent(assessmentId)}` : `/app/assessments/${encodeURIComponent(assessmentId)}` : undefined;
  const waiting = "The work is waiting with the other party.";
  const actions: Record<LifecycleKey, { requestor: string; analyst: string; href?: string }> = {
    draft: { requestor: "Complete and submit this request.", analyst: waiting, href: actor === "requestor" ? requestHref : undefined },
    submitted: { requestor: waiting, analyst: "Generate the questionnaire.", href: actor === "analyst" ? requestHref : undefined },
    "questionnaire-generated": { requestor: waiting, analyst: "Review and release the questionnaire.", href: actor === "analyst" ? questionnaireHref : undefined },
    "questionnaire-released": { requestor: "Answer and submit the questionnaire.", analyst: waiting, href: actor === "requestor" ? questionnaireHref : undefined },
    "questionnaire-submitted": { requestor: waiting, analyst: "Draft the assessment.", href: actor === "analyst" ? questionnaireHref : undefined },
    "assessment-drafted": { requestor: waiting, analyst: "Complete the assessment review.", href: actor === "analyst" ? assessmentHref : undefined },
    "assessment-reviewed": { requestor: waiting, analyst: "Release the assessment.", href: actor === "analyst" ? assessmentHref : undefined },
    "assessment-released": { requestor: "No action is required.", analyst: "No action is required." },
  };
  const action = actions[currentKey];
  return { actor, summary: action[actor], ...(action.href ? { href: action.href } : {}) };
}

export function projectRequestLifecycle(document: unknown, state: unknown): RequestLifecycle {
  const request = isRecord(document) ? document : {};
  const questionnaire = isRecord(request.questionnaire) ? request.questionnaire : null;
  const assessment = isRecord(request.assessment) ? request.assessment : null;
  const lifecycle = deriveRequestLifecycle({
    requestStatus: request.requestStatus, questionnaireExists: questionnaire !== null,
    questionnaireReleased: questionnaire !== null && nonEmptyString(questionnaire.releasedAt),
    questionnaireSubmitted: questionnaire !== null && questionnaireState(questionnaire) === "submitted",
    assessmentExists: assessment !== null,
    assessmentReviewedAndReady: assessment !== null && assessment.assessmentStatus === "in-review" && validateReleaseReadiness(assessment).ready,
    assessmentReleased: assessment !== null && isReleased(assessment),
  });
  if (lifecycle.terminal) return lifecycle;
  const actor: RequestActor = requestActorFacts(state).analyst ? "analyst" : "requestor";
  return { ...lifecycle, nextAction: actionFor(lifecycle.currentKey, actor, nonEmptyString(request.documentId) ? request.documentId : undefined, projectRequestRelationships(request, state)) };
}

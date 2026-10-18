import { isReleased, validateReleaseReadiness } from "../../csrm-assessment/services/assessment-workflow";
import { questionnaireState } from "../../csrm-questionnaire/services/questionnaire-scope";
import { projectRequestRelationships, requestActorFacts } from "./relationship-scope";

type RecordValue = Record<string, unknown>;
export type LifecycleKey = typeof REQUEST_LIFECYCLE_STEPS[number]["key"];
type LifecycleState = "completed" | "current" | "future";
type RequestActor = "requestor" | "analyst";
export type RequestHolder = RequestActor | "none";

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export const REQUEST_LIFECYCLE_STEPS = Object.freeze([
  { key: "draft", label: "Draft" }, { key: "submitted", label: "Submitted" },
  { key: "questionnaire-generated", label: "Questionnaire generated" }, { key: "questionnaire-released", label: "Questionnaire released" },
  { key: "questionnaire-submitted", label: "Questionnaire submitted" }, { key: "assessment-drafted", label: "Assessment drafted" },
  { key: "assessment-reviewed", label: "Assessment reviewed" }, { key: "assessment-released", label: "Assessment released" },
] as const);

export type RequestLifecycleFacts = { requestStatus: unknown; questionnaireExists: boolean; questionnaireReleased: boolean; questionnaireSubmitted: boolean; assessmentExists: boolean; assessmentReviewedAndReady: boolean; assessmentReleased: boolean };
export type RequestLifecycle = { currentKey: LifecycleKey; currentLabel: string; terminal: boolean; nextAction: { actor: RequestActor | "none"; holder: RequestHolder; summary: string; href?: string } | null; steps: readonly { key: LifecycleKey; label: string; state: LifecycleState }[] };

/*
 * D-20: who holds the work at each step, whoever is looking. The Requestor holds a draft and a released
 * questionnaire; nobody holds a released assessment; the Security Analyst holds every other step. Plan 11-10's
 * "waiting on me" predicate must equal this map, so it is exported for that equivalence test.
 */
const REQUEST_HOLDERS: Readonly<Record<LifecycleKey, RequestHolder>> = Object.freeze({
  draft: "requestor", submitted: "analyst", "questionnaire-generated": "analyst", "questionnaire-released": "requestor",
  "questionnaire-submitted": "analyst", "assessment-drafted": "analyst", "assessment-reviewed": "analyst", "assessment-released": "none",
});

export function holderFor(key: LifecycleKey): RequestHolder {
  return REQUEST_HOLDERS[key];
}

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

/** Who the Requestor's sentences may name (D-17): the assigned analyst's display name alone, or nobody. */
export type RequestLifecycleOptions = { assigneeName?: string | null };

type AnalystHeldStep = "submitted" | "questionnaire-generated" | "questionnaire-submitted" | "assessment-drafted" | "assessment-reviewed";

/*
 * 13-UI-SPEC §12.1 (D-17): while a Security Analyst holds the work, the Requestor reads the assigned analyst's display
 * name, or, when nobody has picked the request up, a sentence that says so at the submitted step and names "a Security
 * Analyst" after it. The analysts' sentences and the holder are unchanged.
 */
const REQUESTOR_WAITING_SENTENCES: Readonly<Record<AnalystHeldStep, { named: (name: string) => string; unassigned: string }>> = Object.freeze({
  submitted: {
    named: (name) => `${name} is reviewing your request and will send you a questionnaire to answer.`,
    unassigned: "Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.",
  },
  "questionnaire-generated": {
    named: (name) => `${name} is checking your questionnaire before sending it to you.`,
    unassigned: "A Security Analyst is checking your questionnaire before sending it to you.",
  },
  "questionnaire-submitted": {
    named: (name) => `${name} is reviewing your answers to assess the request’s risk.`,
    unassigned: "A Security Analyst is reviewing your answers to assess the request’s risk.",
  },
  "assessment-drafted": {
    named: (name) => `${name} is preparing your risk assessment.`,
    unassigned: "A Security Analyst is preparing your risk assessment.",
  },
  "assessment-reviewed": {
    named: (name) => `${name} is finalising your risk assessment before releasing it to you.`,
    unassigned: "A Security Analyst is finalising your risk assessment before releasing it to you.",
  },
});

function requestorWaitingSentence(step: AnalystHeldStep, assigneeName: string | null | undefined): string {
  const sentences = REQUESTOR_WAITING_SENTENCES[step];
  return nonEmptyString(assigneeName) ? sentences.named(assigneeName.trim()) : sentences.unassigned;
}

function actionFor(currentKey: LifecycleKey, actor: RequestActor, requestId: string | undefined, relationships: RecordValue, assigneeName: string | null | undefined): RequestLifecycle["nextAction"] {
  const questionnaire = isRecord(relationships.questionnaire) ? relationships.questionnaire : {};
  const assessment = isRecord(relationships.assessment) ? relationships.assessment : {};
  const questionnaireId = questionnaire.availability === "available" && nonEmptyString(questionnaire.documentId) ? questionnaire.documentId : undefined;
  const assessmentId = assessment.availability === "available" && nonEmptyString(assessment.documentId) ? assessment.documentId : undefined;
  const requestHref = requestId ? actor === "analyst" ? `/app/review/requests/${encodeURIComponent(requestId)}` : `/app/requests/${encodeURIComponent(requestId)}` : undefined;
  const questionnaireHref = questionnaireId ? actor === "analyst" ? `/app/review/questionnaires/${encodeURIComponent(questionnaireId)}` : `/app/questionnaires/${encodeURIComponent(questionnaireId)}` : undefined;
  const assessmentHref = assessmentId ? actor === "analyst" ? `/app/review/assessments/${encodeURIComponent(assessmentId)}` : `/app/assessments/${encodeURIComponent(assessmentId)}` : undefined;
  /*
   * UI-SPEC §6.1 (D-27): the holder's own action is verb-first; whoever waits reads what the holder is doing,
   * naming them: the Requestor reads the assigned analyst's display name (13-UI-SPEC §12.1, D-17). A Requestor's
   * sentence names no unreleased record, and an href goes only to the viewer who holds the step.
   */
  const waiting = (step: AnalystHeldStep) => requestorWaitingSentence(step, assigneeName);
  const actions: Record<LifecycleKey, { requestor: string; analyst: string; href?: string }> = {
    draft: { requestor: "Complete and submit this request.", analyst: "The Requestor hasn’t submitted this request yet.", href: actor === "requestor" ? requestHref : undefined },
    submitted: { requestor: waiting("submitted"), analyst: "Generate the questionnaire.", href: actor === "analyst" ? requestHref : undefined },
    "questionnaire-generated": { requestor: waiting("questionnaire-generated"), analyst: "Review and release the questionnaire.", href: actor === "analyst" ? questionnaireHref : undefined },
    "questionnaire-released": { requestor: "Answer and submit the questionnaire.", analyst: "The Requestor is answering the questionnaire.", href: actor === "requestor" ? questionnaireHref : undefined },
    "questionnaire-submitted": { requestor: waiting("questionnaire-submitted"), analyst: "Draft the assessment.", href: actor === "analyst" ? questionnaireHref : undefined },
    "assessment-drafted": { requestor: waiting("assessment-drafted"), analyst: "Complete the assessment review.", href: actor === "analyst" ? assessmentHref : undefined },
    "assessment-reviewed": { requestor: waiting("assessment-reviewed"), analyst: "Release the assessment.", href: actor === "analyst" ? assessmentHref : undefined },
    "assessment-released": { requestor: "No action is required.", analyst: "No action is required." },
  };
  const action = actions[currentKey];
  return { actor, holder: holderFor(currentKey), summary: action[actor], ...(action.href ? { href: action.href } : {}) };
}

/**
 * The request's lifecycle as `state`'s viewer reads it. `options.assigneeName` is the assigned analyst's display name,
 * read with PERSON_FIELDS by the caller; only the Requestor's sentences use it (D-17).
 */
export function projectRequestLifecycle(document: unknown, state: unknown, options?: RequestLifecycleOptions): RequestLifecycle {
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
  return { ...lifecycle, nextAction: actionFor(lifecycle.currentKey, actor, nonEmptyString(request.documentId) ? request.documentId : undefined, projectRequestRelationships(request, state), options?.assigneeName) };
}

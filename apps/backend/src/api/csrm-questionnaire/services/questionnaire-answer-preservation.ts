import {
  getVisibleQuestionKeys,
  isQuestionnaireValueValid,
  type QuestionnaireDefinitionQuestion,
  type QuestionnaireValue,
} from "./questionnaire-definition";
import { parseAnswerEnvelope } from "./questionnaire-workflow";

/*
 * The one "answered" rule and the answer-preservation predicate (Phase 15 D-05; QUES-12 criterion 2: no AI proposal
 * changes or removes an answered question).
 *
 * "Answered" is the progress count's rule (`questionnaire-scope.ts`), so the set of questions the AI may not touch and
 * "N of M answered" cannot drift apart: an answer whose value is not null, not the empty string and not an empty
 * array, draft or submitted. A whitespace-only draft is therefore answered.
 *
 * The predicates are pure and never write. The adapter (15-05) drops an item that fails them, and the decision
 * transaction (15-07) refuses its confirmation with `ANSWERED_QUESTION_AFFECTED`.
 */

/** One question as preservation reads it: its parsed definition (removed questions included), its raw help text and its stored answer. */
export type PreservationRow = { question: QuestionnaireDefinitionQuestion; helpText: string | null; answer: unknown };
export type PreservationResult = { ok: true } | { ok: false; questionKey: string };

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The progress count's answered rule, read from a stored answer envelope (anything that is not an object holds no value). */
export function isAnsweredValue(answer: unknown): boolean {
  const value = isRecord(answer) ? answer.value : null;
  return value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function isActive(row: PreservationRow): boolean {
  return row.question.deleted === undefined;
}

function storedValue(answer: unknown): QuestionnaireValue {
  const envelope = parseAnswerEnvelope(answer);
  const value = envelope?.value;
  return value === undefined ? null : value;
}

function blankToNull(text: string | null): string | null {
  return typeof text === "string" && text.trim().length > 0 ? text : null;
}

/* Every value the fingerprint covers (questionnaire-proposal-envelope.ts `questionFingerprint`), the key included. */
function sameQuestion(before: PreservationRow, after: PreservationRow): boolean {
  const left = before.question;
  const right = after.question;
  return left.questionKey === right.questionKey
    && left.questionText === right.questionText
    && blankToNull(before.helpText) === blankToNull(after.helpText)
    && left.answerType === right.answerType
    && JSON.stringify(left.choices?.map(({ value, label }) => [value, label]) ?? null) === JSON.stringify(right.choices?.map(({ value, label }) => [value, label]) ?? null)
    && left.required === right.required
    && left.section.key === right.section.key
    && left.section.title === right.section.title
    && left.section.order === right.section.order
    && left.order === right.order
    && JSON.stringify(left.visibility ? [left.visibility.questionKey, left.visibility.operator, left.visibility.value] : null)
      === JSON.stringify(right.visibility ? [right.visibility.questionKey, right.visibility.operator, right.visibility.value] : null);
}

function inQuestionnaireOrder(rows: readonly PreservationRow[]): PreservationRow[] {
  return [...rows].sort((left, right) => left.question.section.order - right.question.section.order || left.question.order - right.question.order);
}

function visibleKeys(rows: readonly PreservationRow[]): Set<string> {
  const ordered = inQuestionnaireOrder(rows);
  const values = Object.fromEntries(ordered.filter(isActive).map((row) => [row.question.questionKey, storedValue(row.answer)]));
  return new Set(getVisibleQuestionKeys(ordered.map((row) => row.question), values));
}

function offers(controller: QuestionnaireDefinitionQuestion, value: string | boolean): boolean {
  if (controller.answerType !== "Single select" && controller.answerType !== "Multi select") return true;
  return typeof value === "string" && Boolean(controller.choices?.some((choice) => choice.value === value));
}

/*
 * The rule an answered question's visibility reads must stay reachable: its controller stays active and, when the
 * controller offered the rule's value before, still offers it. Otherwise the answered question could never show
 * again, the indirect harm a change to an unanswered controller can do (Pitfall 8).
 */
function ruleStaysReachable(question: QuestionnaireDefinitionQuestion, before: ReadonlyMap<string, PreservationRow>, after: ReadonlyMap<string, PreservationRow>): boolean {
  if (!question.visibility) return true;
  const { questionKey, value } = question.visibility;
  const controllerAfter = after.get(questionKey);
  if (controllerAfter === undefined || !isActive(controllerAfter)) return false;
  const controllerBefore = before.get(questionKey);
  if (controllerBefore !== undefined && offers(controllerBefore.question, value) && !offers(controllerAfter.question, value)) return false;
  return true;
}

/**
 * Whether every answered question survives the change from `before` to `after` (both the whole questionnaire,
 * removed questions included). For every active, answered question in `before`, in questionnaire order: it still
 * exists in `after` and is active; every value its fingerprint covers is equal; its stored answer is still accepted
 * by its definition (when it was before); the rule its visibility reads stays reachable; and, if it was visible with
 * the stored values, it is still visible. The first question that fails is named.
 */
export function preservesAnswers(before: readonly PreservationRow[], after: readonly PreservationRow[]): PreservationResult {
  const afterByDocument = new Map(after.map((row) => [row.question.documentId, row]));
  const beforeByKey = new Map(before.map((row) => [row.question.questionKey, row]));
  const afterByKey = new Map(after.map((row) => [row.question.questionKey, row]));
  const visibleBefore = visibleKeys(before);
  const visibleAfter = visibleKeys(after);
  for (const row of inQuestionnaireOrder(before)) {
    if (!isActive(row) || !isAnsweredValue(row.answer)) continue;
    const refused: PreservationResult = { ok: false, questionKey: row.question.questionKey };
    const next = afterByDocument.get(row.question.documentId);
    if (next === undefined || !isActive(next) || !sameQuestion(row, next)) return refused;
    const value = storedValue(row.answer);
    if (isQuestionnaireValueValid(row.question, value) && !isQuestionnaireValueValid(next.question, storedValue(next.answer))) return refused;
    if (!ruleStaysReachable(row.question, beforeByKey, afterByKey)) return refused;
    if (visibleBefore.has(row.question.questionKey) && !visibleAfter.has(next.question.questionKey)) return refused;
  }
  return { ok: true };
}

/**
 * Whether every active dependent's visibility rule still reads a value its controller offers. The definition parser
 * checks the rule's type only, so without this a dependent whose controller dropped the value would silently never
 * show. The controller that fails is named. A relabelled choice keeps its value and passes.
 */
export function keepsControllerValues(after: readonly PreservationRow[]): PreservationResult {
  const byKey = new Map(after.map((row) => [row.question.questionKey, row]));
  for (const row of inQuestionnaireOrder(after)) {
    if (!isActive(row) || !row.question.visibility) continue;
    const { questionKey, value } = row.question.visibility;
    const controller = byKey.get(questionKey);
    if (controller === undefined || !isActive(controller) || !offers(controller.question, value)) return { ok: false, questionKey };
  }
  return { ok: true };
}

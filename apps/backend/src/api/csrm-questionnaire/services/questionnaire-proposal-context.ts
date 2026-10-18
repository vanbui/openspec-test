import type { InstructionSource } from "../../../csrm/ai/analyst-instruction";
import { AssessmentContextTooLargeError, QUESTIONNAIRE_CONTEXT_BOUNDS, type ContextSummaryQuestionnaire, type RequestorDataSection } from "../../../csrm/ai/assessment-context";
import type { PromptValue } from "../../../csrm/ai/prompt-sections";
import type { ProposalAllowedSets, ProposalItemKind } from "./questionnaire-proposal-envelope";

/*
 * The questionnaire part of a questionnaire proposal or rewrite context (Phase 15 D-14, D-30; Phase 12 D-04 and D-06; the
 * approved Phase 15 amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Context summary" and
 * "Bounds"). A pure function of what the loader read: it renders the questionnaire into Phase 12's section types, so
 * `composeUserPrompt` renders it unchanged, and returns the sets the adapter checks the model's output against and the
 * run summary's questionnaire section.
 *
 * - Questions are `Q1…Qn`, the active questions in display order, each with its section title, text, help text, answer
 *   type, choice labels, required flag, visibility (`Q2 equals Yes`) and whether it is answered: an answered question
 *   is fixed context the AI may not change (D-05). Open items are `P1…` ("already proposed"), rejected items `X1…` with
 *   their reasons ("rejected by the analyst", the 100 most recent), and removed questions `R1…` ("removed by the
 *   analyst"), so the AI repeats none of them.
 * - Answer content is sent only when the loader found the whole active batch submitted (D-30), by `Qn`, in the
 *   untrusted Requestor block through Phase 12's `answers` section; a draft answer never is. A rewrite sends none.
 * - Question definitions and the lists go in the reference block. No documentId, question key, section key, choice
 *   value, name, date or record number is rendered (Phase 12 D-04): choices and visibility values read as their labels.
 * - Over its bounds the part is too large before any run, never silently cut (Phase 12 D-06); only the rejected list
 *   is ranked, and the summary records its total.
 */

export { QUESTIONNAIRE_CONTEXT_BOUNDS };

export type QuestionnaireContextChoice = { value: string; label: string };
export type QuestionnaireContextVisibility = { questionKey: string; operator: string; value: string | boolean };
/** A question as the loader read it, active or removed, in display order. `answerLabel` only when answer content is included. */
export type QuestionnaireContextQuestion = {
  documentId: string;
  questionKey: string;
  section: { key: string; title: string; order: number };
  order: number;
  questionText: string;
  helpText: string | null;
  answerType: string;
  choices: readonly QuestionnaireContextChoice[] | null;
  required: boolean;
  visibility: QuestionnaireContextVisibility | null;
  removed: boolean;
  answered: boolean;
  answerLabel?: string;
};
/** An item still open from an earlier run: what it proposes, never who or when. */
export type QuestionnaireContextOpenItem = { kind: ProposalItemKind; questionText: string };
/** An item the analyst rejected, with the reason; `decidedAt` ranks it and is never rendered. */
export type QuestionnaireContextRejectedItem = { kind: ProposalItemKind; questionText: string; reason: string | null; decidedAt: string };
export type QuestionnaireProposalContextInput = {
  scope: "questionnaire" | "question";
  /** The rewrite's target (scope `question`). */
  targetQuestionDocumentId?: string;
  questions: readonly QuestionnaireContextQuestion[];
  answerContent: "included" | "withheld";
  openItems: readonly QuestionnaireContextOpenItem[];
  rejectedItems: readonly QuestionnaireContextRejectedItem[];
  instructionSource: InstructionSource | null;
  /** The ids the rest of the context offers as sources: `request.{field}`, `note-{n}` and `file-{n}`. */
  contextSourceRefs: readonly string[];
};
/*
 * The adapter's gate (15-05): every target and source the context offered. `questionDocumentIds` are the questions the
 * AI may target (a rewrite's target only); `refs` maps each `Qn` to its question; `answeredRefs` are the fixed ones;
 * `controllerChoiceLabels` are each `Qn`'s answer labels a visibility rule may read; `sourceRefs` are the request,
 * note and file ids given, each answered `Qn` whose answer was sent, and `instruction` when one steered the run.
 */
export type QuestionnaireContextAllowed = ProposalAllowedSets & {
  refs: ReadonlyMap<string, string>;
  answeredRefs: ReadonlySet<string>;
  removedDocumentIds: ReadonlySet<string>;
  controllerChoiceLabels: ReadonlyMap<string, readonly string[]>;
};
export type QuestionnaireSummarySection = ContextSummaryQuestionnaire;
export type QuestionnaireAnswersSection = RequestorDataSection & { kind: "answers"; values: PromptValue[] };
export type QuestionnaireProposalContextPart = {
  reference: PromptValue[];
  /* The submitted answers by Qn, a Phase 12 `answers` section of the untrusted Requestor block; null when none is sent. */
  answers: QuestionnaireAnswersSection | null;
  allowed: QuestionnaireContextAllowed;
  summary: QuestionnaireSummarySection;
};

const BOOLEAN_LABELS = ["Yes", "No"] as const;
const yesNo = (value: boolean): string => (value ? "yes" : "no");

function answerLabels(question: QuestionnaireContextQuestion): string[] {
  if (question.answerType === "Boolean") return [...BOOLEAN_LABELS];
  return (question.choices ?? []).map(({ label }) => label);
}

/* A visibility rule as the AI reads it: the controller's Qn, the operator and the value's label, never a key or value. */
function visibilityText(rule: QuestionnaireContextVisibility, refsByKey: ReadonlyMap<string, string>, byKey: ReadonlyMap<string, QuestionnaireContextQuestion>): string {
  const controller = byKey.get(rule.questionKey);
  const ref = refsByKey.get(rule.questionKey) ?? "a question not offered";
  const label = typeof rule.value === "boolean"
    ? rule.value ? "Yes" : "No"
    : controller?.choices?.find(({ value }) => value === rule.value)?.label ?? "a value not offered";
  return `${ref} ${rule.operator} ${label}`;
}

function rankedRejections(items: readonly QuestionnaireContextRejectedItem[]): QuestionnaireContextRejectedItem[] {
  const time = (value: string): number => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY; };
  return items.map((item, index) => ({ item, index }))
    .sort((left, right) => time(right.item.decidedAt) - time(left.item.decidedAt) || right.index - left.index)
    .slice(0, QUESTIONNAIRE_CONTEXT_BOUNDS.rejectedItemsListed)
    .map(({ item }) => item);
}

export function buildQuestionnaireProposalContext(input: QuestionnaireProposalContextInput): QuestionnaireProposalContextPart {
  const active = input.questions.filter(({ removed }) => !removed);
  const removed = input.questions.filter(({ removed }) => removed);
  const rewrite = input.scope === "question";
  if (active.length > QUESTIONNAIRE_CONTEXT_BOUNDS.activeQuestions) throw new AssessmentContextTooLargeError();
  if (!rewrite && (input.openItems.length > QUESTIONNAIRE_CONTEXT_BOUNDS.openItemsListed || removed.length > QUESTIONNAIRE_CONTEXT_BOUNDS.removedListed)) throw new AssessmentContextTooLargeError();
  const target = rewrite ? active.find(({ documentId }) => documentId === input.targetQuestionDocumentId) : undefined;
  if (rewrite && !target) throw new Error("CSRM questionnaire rewrite target is not an active question.");
  // D-30: answers only for a submitted batch, never in a rewrite.
  const includeAnswers = !rewrite && input.answerContent === "included";

  const refs = new Map<string, string>();
  const refsByKey = new Map<string, string>();
  const byKey = new Map(active.map((question) => [question.questionKey, question]));
  for (const [index, question] of active.entries()) {
    refs.set(`Q${index + 1}`, question.documentId);
    refsByKey.set(question.questionKey, `Q${index + 1}`);
  }
  const reference: PromptValue[] = [];
  const answerValues: PromptValue[] = [];
  const answeredRefs = new Set<string>();
  const controllerChoiceLabels = new Map<string, readonly string[]>();
  for (const [index, question] of active.entries()) {
    const ref = `Q${index + 1}`;
    const labels = answerLabels(question);
    if (labels.length) controllerChoiceLabels.set(ref, Object.freeze(labels));
    if (question.answered) answeredRefs.add(ref);
    const full = !rewrite || question === target;
    if (!full) { reference.push({ label: `${ref}.questionText`, value: question.questionText }); continue; }
    reference.push({ label: `${ref}.section`, value: question.section.title }, { label: `${ref}.questionText`, value: question.questionText });
    if (question.helpText?.trim()) reference.push({ label: `${ref}.helpText`, value: question.helpText });
    reference.push({ label: `${ref}.answerType`, value: question.answerType });
    for (const label of question.choices?.map((choice) => choice.label) ?? []) reference.push({ label: `${ref}.choice`, value: label });
    reference.push({ label: `${ref}.required`, value: yesNo(question.required) });
    if (question.visibility) reference.push({ label: `${ref}.visibility`, value: visibilityText(question.visibility, refsByKey, byKey) });
    if (rewrite) reference.push({ label: `${ref}.target`, value: "yes" });
    else reference.push({ label: `${ref}.answered`, value: yesNo(question.answered) });
    if (includeAnswers && question.answered && typeof question.answerLabel === "string") answerValues.push({ label: `${ref}.answer`, value: question.answerLabel });
  }

  const rejected = rewrite ? [] : rankedRejections(input.rejectedItems);
  if (!rewrite) {
    for (const [index, item] of input.openItems.entries()) {
      const ref = `P${index + 1}`;
      reference.push({ label: `${ref}.status`, value: "already proposed" }, { label: `${ref}.kind`, value: item.kind }, { label: `${ref}.questionText`, value: item.questionText });
    }
    for (const [index, item] of rejected.entries()) {
      const ref = `X${index + 1}`;
      reference.push({ label: `${ref}.status`, value: "rejected by the analyst" }, { label: `${ref}.kind`, value: item.kind }, { label: `${ref}.questionText`, value: item.questionText });
      if (item.reason?.trim()) reference.push({ label: `${ref}.reason`, value: item.reason });
    }
    for (const [index, question] of removed.entries()) {
      const ref = `R${index + 1}`;
      reference.push({ label: `${ref}.status`, value: "removed by the analyst" }, { label: `${ref}.questionText`, value: question.questionText });
    }
  }

  const answeredSources = includeAnswers ? [...answeredRefs] : [];
  const steered = input.instructionSource === "analyst" || input.instructionSource === "plain-language-preset";
  const allowed: QuestionnaireContextAllowed = {
    questionDocumentIds: new Set(rewrite && target ? [target.documentId] : active.map(({ documentId }) => documentId)),
    sourceRefs: new Set([...input.contextSourceRefs, ...answeredSources, ...(steered ? ["instruction"] : [])]),
    refs,
    answeredRefs,
    removedDocumentIds: new Set(removed.map(({ documentId }) => documentId)),
    controllerChoiceLabels,
  };
  const summary: QuestionnaireSummarySection = {
    scope: input.scope,
    questionsOffered: active.length,
    answered: rewrite ? 0 : answeredRefs.size,
    answerContent: includeAnswers ? "included" : "withheld",
    openItemsListed: rewrite ? 0 : input.openItems.length,
    rejectedItemsListed: rejected.length,
    rejectedItemsTotal: rewrite ? 0 : input.rejectedItems.length,
    removedListed: rewrite ? 0 : removed.length,
  };
  return { reference, answers: answerValues.length ? { kind: "answers" as const, values: answerValues } : null, allowed, summary };
}

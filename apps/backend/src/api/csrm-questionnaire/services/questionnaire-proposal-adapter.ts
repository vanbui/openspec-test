import { NOT_SURE_CHOICE, withCanonicalNotSure } from "../../../csrm/ai/not-sure-choice";
import { isNearDuplicate } from "../../../csrm/ai/text-similarity";
import { isAnsweredValue, keepsControllerValues, preservesAnswers, type PreservationRow } from "./questionnaire-answer-preservation";
import { parseQuestionnaireDefinition, type QuestionnaireAnswerType, type QuestionnaireDefinitionQuestion, type VisibilityOperator } from "./questionnaire-definition";
import { QuestionnaireGenerationJobFailure } from "./questionnaire-generation-registry";
import { allocateQuestionKey, createBatchAllocation, placeAddition } from "./questionnaire-placement";
import {
  ADJUSTMENT_CODES,
  addBase,
  changeBase,
  parseQuestionnaireProposal,
  PROPOSAL_BOUNDS,
  type AdjustmentCode,
  type LiveQuestionnaire,
  type ProposalAdjustment,
  type ProposalSource,
  type ProposedChoice,
  type ProposedQuestion,
  type ProposedSection,
  type ProposedVisibility,
  type QuestionFingerprintInput,
  type QuestionnaireProposalItem,
  type QuestionnaireProposalV1,
  type SourceKind,
} from "./questionnaire-proposal-envelope";
import type { QuestionnaireContextAllowed } from "./questionnaire-proposal-context";

/*
 * The model-facing wire and the one adapter for questionnaire proposals (Phase 15 D-05 layer 2, D-10, D-13, D-15; the
 * approved Phase 15 amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Questionnaire proposal
 * envelope v1" and "Bounds"; 15-RESEARCH §B).
 *
 * Both providers, the deterministic one every suite runs and the hosted one, return the wire JSON below, and this adapter
 * alone turns it into the envelope a run stores, so every drop rule runs whichever provider answered (Pitfall 9). The
 * wire holds only what a model can say: kinds, the context's `Q1…Qn` refs, texts, labels and source ids. Every server
 * value (keys, choice and visibility values, bases, the canonical Not sure) is assigned here. Whatever the model returns,
 * an item that CSRM cannot stand behind is left out and recorded as an adjustment, never silently; the closed,
 * context-aware parser is the final gate.
 */

/* File upload and Boolean are never proposed: a yes-or-no question is a Single select with Yes, No and Not sure. */
export const PROPOSAL_WIRE_ANSWER_TYPES = Object.freeze(["Text", "Long text", "Single select", "Multi select", "Date"] as const);
const VISIBILITY_OPERATORS: readonly VisibilityOperator[] = ["equals", "notEquals", "includes", "notIncludes"];
const WIRE_ITEM_KEYS = ["kind", "target", "questionText", "helpText", "answerType", "choices", "required", "sectionTitle", "visibleWhen", "rationale", "sources"] as const;
const WIRE_ROOT_KEYS = ["schemaVersion", "items"] as const;
const VISIBLE_WHEN_KEYS = ["question", "operator", "value"] as const;

/** The proposal caps (the amendment's "Bounds"). */
export const QUESTIONNAIRE_PROPOSAL_CAPS = Object.freeze({
  items: PROPOSAL_BOUNDS.items,
  additions: PROPOSAL_BOUNDS.additions,
  sources: PROPOSAL_BOUNDS.sources,
  adjustments: PROPOSAL_BOUNDS.adjustments,
});
/* A structural sanity bound on any wire array; anything longer is not a usable answer. */
const WIRE_ARRAY_MAX = 1_000;
/*
 * At most this many wire items are examined; any beyond are counted as over the limit unexamined (the caps keep 30 at
 * most, and a model's output is bounded by its output tokens anyway).
 */
const WIRE_ITEMS_EXAMINED = 100;
/*
 * The adjustment list stays within its bound of 60: per-item drops are recorded one by one up to this many, then one
 * aggregated entry per code; the run-level counts (over-limit, ignored fields, dropped sources) take one entry each.
 */
const RUN_LEVEL_CODES: readonly AdjustmentCode[] = ["over-limit", "ignored-field", "sources-dropped"];
const ITEM_CODES = ADJUSTMENT_CODES.filter((code) => !RUN_LEVEL_CODES.includes(code));
const INDIVIDUAL_ADJUSTMENTS_MAX = PROPOSAL_BOUNDS.adjustments - RUN_LEVEL_CODES.length - ITEM_CODES.length;
/* Selects offer 2 to 20 choices of their own, before the canonical Not sure. */
const SELECT_CHOICES_MIN = PROPOSAL_BOUNDS.selectChoicesMin;
const SELECT_CHOICES_MAX = PROPOSAL_BOUNDS.selectChoicesMax - 1;

/**
 * The questionnaire proposals wire v1 (`questionnaire_proposals`), inside the portable structured-output subset: every
 * property required, optional values nullable, no length or count keyword, one-value enums instead of `const`. The `Q`
 * enums are the run's own refs. 16 object properties, three object levels.
 */
export function questionnaireProposalsWireSchema(allowed: Pick<QuestionnaireContextAllowed, "refs">) {
  const refs = [...allowed.refs.keys()];
  return {
    type: "object", additionalProperties: false, required: [...WIRE_ROOT_KEYS], properties: {
      schemaVersion: { type: "integer", enum: [1] },
      items: {
        type: "array", items: {
          type: "object", additionalProperties: false, required: [...WIRE_ITEM_KEYS], properties: {
            kind: { type: "string", enum: ["add", "change", "remove"] },
            target: { type: ["string", "null"], enum: [...refs, null] },
            questionText: { type: ["string", "null"] },
            helpText: { type: ["string", "null"] },
            answerType: { type: ["string", "null"], enum: [...PROPOSAL_WIRE_ANSWER_TYPES, null] },
            choices: { type: "array", items: { type: "string" } },
            required: { type: ["boolean", "null"] },
            sectionTitle: { type: ["string", "null"] },
            visibleWhen: {
              anyOf: [
                {
                  type: "object", additionalProperties: false, required: [...VISIBLE_WHEN_KEYS], properties: {
                    question: { type: "string", enum: refs },
                    operator: { type: "string", enum: [...VISIBILITY_OPERATORS] },
                    value: { type: "string" },
                  },
                },
                { type: "null" },
              ],
            },
            rationale: { type: "string" },
            sources: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };
}

/**
 * What the adapter checks the model's output against, built by the workflow from the same records as the context:
 * the context's allowed sets (15-04), every question as it stood when the context was built (removed ones included,
 * with raw help text and stored answers), the questionnaire's `generatedDate`, and the texts of the items still open and
 * of the items the analyst rejected (the near-duplicate scorer's other inputs; active and removed texts come from the rows).
 */
export type QuestionnaireAdapterContext = {
  allowed: QuestionnaireContextAllowed;
  rows: readonly PreservationRow[];
  generatedDate: string | null;
  openItemTexts: readonly string[];
  rejectedItemTexts: readonly string[];
};

type WireVisibleWhen = { question: string; operator: string; value: string };
type WireItem = {
  kind: "add" | "change" | "remove";
  target: string | null;
  questionText: string | null;
  helpText: string | null;
  answerType: string | null;
  choices: string[];
  required: boolean | null;
  sectionTitle: string | null;
  visibleWhen: WireVisibleWhen | null;
  rationale: string;
  sources: string[];
};

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (value: RecordValue, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length <= WIRE_ARRAY_MAX && value.every((entry) => typeof entry === "string");

function invalidOutput(): QuestionnaireGenerationJobFailure {
  return new QuestionnaireGenerationJobFailure("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.");
}

/* Exact structure (keys and types). Values are judged per item by the rules below; a broken structure fails the run. */
function parseWireItem(value: unknown): WireItem {
  if (!isRecord(value) || !hasExactKeys(value, WIRE_ITEM_KEYS)) throw invalidOutput();
  const { kind, target, questionText, helpText, answerType, choices, required, sectionTitle, visibleWhen, rationale, sources } = value;
  if ((kind !== "add" && kind !== "change" && kind !== "remove")
    || !isNullableString(target) || !isNullableString(questionText) || !isNullableString(helpText) || !isNullableString(answerType)
    || !isStringArray(choices) || (required !== null && typeof required !== "boolean") || !isNullableString(sectionTitle)
    || typeof rationale !== "string" || !isStringArray(sources)) throw invalidOutput();
  let rule: WireVisibleWhen | null = null;
  if (visibleWhen !== null) {
    if (!isRecord(visibleWhen) || !hasExactKeys(visibleWhen, VISIBLE_WHEN_KEYS)
      || typeof visibleWhen.question !== "string" || typeof visibleWhen.operator !== "string" || typeof visibleWhen.value !== "string") throw invalidOutput();
    rule = { question: visibleWhen.question, operator: visibleWhen.operator, value: visibleWhen.value };
  }
  return { kind, target, questionText, helpText, answerType, choices, required, sectionTitle, visibleWhen: rule, rationale, sources };
}

function parseWire(raw: unknown): WireItem[] {
  if (!isRecord(raw) || !hasExactKeys(raw, WIRE_ROOT_KEYS) || raw.schemaVersion !== 1 || !Array.isArray(raw.items) || raw.items.length > WIRE_ARRAY_MAX) throw invalidOutput();
  return raw.items.map(parseWireItem);
}

/* A left-out item: its code and CSRM's own sentence, built from closed values only (never model or Requestor text). */
type Drop = { code: AdjustmentCode; detail: string };
class Dropped extends Error { constructor(readonly drop: Drop) { super(drop.code); } }
function drop(code: AdjustmentCode, detail: string): never { throw new Dropped({ code, detail }); }

const DETAIL = {
  addTarget: "An addition named a target question, so it was left out.",
  addFields: "An addition missed its question text, answer type, required flag or section, so it was left out.",
  changeTarget: "A change named no target question, so it was left out.",
  changeEmpty: "A change proposed nothing to change, so it was left out.",
  removeTarget: "A removal named no target question, so it was left out.",
  answerType: "A proposal used an answer type the AI may not propose, so it was left out.",
  questionText: "A proposal's question text was empty or longer than 1,000 characters, so it was left out.",
  helpText: "A proposal's help text was longer than 2,000 characters, so it was left out.",
  rationale: "A proposal's rationale was empty or longer than 1,000 characters, so it was left out.",
  sectionTitle: "A proposal's section title was empty or longer than 255 characters, so it was left out.",
  choiceLabel: "A proposal's choice label was empty or longer than 255 characters, so it was left out.",
  choiceCount: "A choice question offered fewer than 2 or more than 20 choices, so it was left out.",
  choicesOnText: "A question that is not a choice question offered choices, so it was left out.",
  choiceLabelsRepeat: "A choice question offered the same choice twice, so it was left out.",
  operator: "A proposal's visibility rule used an unknown operator, so it was left out.",
} as const;

const unknownTargetDetail = (ref: string) => `The proposal targeted ${ref}, a question this request did not offer, so it was left out.`;
const removedTargetDetail = (ref: string) => `The proposal targeted ${ref}, a question that has been removed, so it was left out.`;
const answeredTargetDetail = (ref: string) => `The proposal would have changed ${ref}, which is answered. Answered questions stay as they are.`;
const duplicateTargetDetail = (ref: string) => `A second proposal for ${ref} was left out; only the first is kept.`;
const nearDuplicateDetail = "The new question repeats one already asked, proposed, rejected or removed, so it was left out.";
const SAFE_REF = /^[QR][0-9]{1,4}$/;
/* A model's ref is only named in a detail when it is a bounded `Q` or `R` ref; anything else is described generically. */
const refText = (ref: string): string => (SAFE_REF.test(ref) ? ref : "a question");

const isSelectType = (answerType: string): boolean => answerType === "Single select" || answerType === "Multi select";
const trimmed = (text: string | null): string => (text ?? "").trim();
const isActive = (row: PreservationRow): boolean => row.question.deleted === undefined;

/** A preservation row's fingerprinted values (the decision operation's staleness and `applied` facts read the same, 15-07). */
export function fingerprintInput(row: PreservationRow): QuestionFingerprintInput {
  const { question } = row;
  return {
    questionText: question.questionText,
    helpText: row.helpText,
    answerType: question.answerType,
    choices: question.choices ? question.choices.map(({ value, label }) => ({ value, label })) : null,
    required: question.required,
    section: { key: question.section.key, title: question.section.title, order: question.section.order },
    order: question.order,
    visibility: question.visibility ? { questionKey: question.visibility.questionKey, operator: question.visibility.operator, value: question.visibility.value } : null,
    removed: !isActive(row),
  };
}

function liveQuestionnaire(context: QuestionnaireAdapterContext): LiveQuestionnaire {
  return {
    generatedDate: context.generatedDate,
    questions: context.rows.map((row) => ({ ...fingerprintInput(row), documentId: row.question.documentId, questionKey: row.question.questionKey, answered: isActive(row) && isAnsweredValue(row.answer) })),
  };
}

/* Source ids map to their kind by the context's naming (15-04): `Q{n}`, `request.{field}`, `note-{n}`, `file-{n}`, `instruction`. */
function sourceKind(ref: string): SourceKind | null {
  if (ref === "instruction") return "instruction";
  if (/^Q[0-9]+$/.test(ref)) return "answered-question";
  if (/^request\.[A-Za-z]+$/.test(ref)) return "request-field";
  if (/^note-[0-9]+$/.test(ref)) return "note";
  if (/^file-[0-9]+$/.test(ref)) return "file";
  return null;
}

type RunState = {
  context: QuestionnaireAdapterContext;
  live: LiveQuestionnaire;
  rowsByDocument: Map<string, PreservationRow>;
  claimedTargets: Set<string>;
  keptAdditionTexts: string[];
  sourcesDropped: number;
  ignoredFields: number;
};

/* Kind rules: what each kind needs, and the fields it does not use (ignored, recorded once per run, never a drop). */
function checkKind(item: WireItem, state: RunState): void {
  if (item.kind === "add") {
    if (item.target !== null) drop("invalid-item", DETAIL.addTarget);
    if (item.questionText === null || item.answerType === null || item.required === null || item.sectionTitle === null) drop("invalid-item", DETAIL.addFields);
    return;
  }
  if (item.target === null) drop("invalid-item", item.kind === "change" ? DETAIL.changeTarget : DETAIL.removeTarget);
  const unused = item.kind === "change"
    ? [item.sectionTitle, item.visibleWhen]
    : [item.questionText, item.helpText, item.answerType, item.required, item.sectionTitle, item.visibleWhen, item.choices.length ? item.choices : null];
  if (unused.some((value) => value !== null)) state.ignoredFields += 1;
  if (item.kind === "change" && item.questionText === null && item.helpText === null && item.answerType === null && item.choices.length === 0 && item.required === null) drop("invalid-item", DETAIL.changeEmpty);
}

/* Target resolution (D-05 layer 2): an unknown ref, a removed question or an answered one is never touched. */
function resolveTarget(ref: string, state: RunState): PreservationRow {
  const { allowed } = state.context;
  const documentId = allowed.refs.get(ref);
  if (documentId === undefined) {
    const removed = /^R([0-9]+)$/.exec(ref);
    if (removed && Number(removed[1]) >= 1 && Number(removed[1]) <= allowed.removedDocumentIds.size) drop("removed-target", removedTargetDetail(ref));
    drop("unknown-target", unknownTargetDetail(refText(ref)));
  }
  const row = state.rowsByDocument.get(documentId);
  if (allowed.removedDocumentIds.has(documentId) || (row !== undefined && !isActive(row))) drop("removed-target", removedTargetDetail(ref));
  if (row === undefined || !allowed.questionDocumentIds.has(documentId)) drop("unknown-target", unknownTargetDetail(ref));
  if (allowed.answeredRefs.has(ref) || isAnsweredValue(row.answer)) drop("answered-target", answeredTargetDetail(ref));
  return row;
}

function boundedText(value: string, maximum: number, detail: string): string {
  const text = value.trim();
  if (text.length === 0 || value.length > maximum) drop("invalid-item", detail);
  return text;
}

function boundedHelpText(value: string | null): string | null {
  if (value === null) return null;
  if (value.length > PROPOSAL_BOUNDS.helpText) drop("invalid-item", DETAIL.helpText);
  return value.trim() || null;
}

/*
 * A select's choices: labels within bounds and unique without regard to case, 2 to 20 of the model's own before Not sure,
 * then the one Not sure rule (a model's equivalent is the canonical choice where the model put it, a second is dropped,
 * and it is added last when absent). Other answer types offer none.
 */
function proposedChoices(answerType: string, labels: readonly string[]): ProposedChoice[] {
  if (!isSelectType(answerType)) {
    if (labels.length) drop("invalid-item", DETAIL.choicesOnText);
    return [];
  }
  const texts = labels.map((label) => boundedText(label, PROPOSAL_BOUNDS.choiceLabel, DETAIL.choiceLabel));
  const choices = withCanonicalNotSure(texts);
  const own = choices.filter((choice) => choice.value !== NOT_SURE_CHOICE.value);
  if (own.length < SELECT_CHOICES_MIN || own.length > SELECT_CHOICES_MAX) drop("invalid-item", DETAIL.choiceCount);
  if (new Set(choices.map((choice) => choice.label.toLowerCase())).size !== choices.length) drop("invalid-item", DETAIL.choiceLabelsRepeat);
  return choices;
}

/* A visibility rule's value arrives as a label: the controller's choice value, matched without case; Yes or No on a Boolean. */
function visibilityRule(rule: WireVisibleWhen, state: RunState): ProposedVisibility {
  if (!(VISIBILITY_OPERATORS as readonly string[]).includes(rule.operator)) drop("invalid-item", DETAIL.operator);
  const documentId = state.context.allowed.refs.get(rule.question);
  const controller = documentId === undefined ? undefined : state.rowsByDocument.get(documentId);
  const invalid = "The visibility rule named a question or answer the questionnaire does not offer, so it was left out.";
  if (controller === undefined || !isActive(controller)) drop("definition-invalid", invalid);
  const label = rule.value.trim().toLowerCase();
  let value: string | boolean | undefined;
  if (controller.question.answerType === "Boolean") value = label === "yes" ? true : label === "no" ? false : undefined;
  else value = controller.question.choices?.find((choice) => choice.label.trim().toLowerCase() === label)?.value;
  if (value === undefined) drop("definition-invalid", invalid);
  return { questionKey: controller.question.questionKey, operator: rule.operator as VisibilityOperator, value };
}

/* Sources: only ids the context offered, each once, at most 10; the rest are counted once per run, and the item is kept. */
function keptSources(refs: readonly string[], state: RunState): ProposalSource[] {
  const sources: ProposalSource[] = [];
  const seen = new Set<string>();
  for (const raw of refs) {
    const ref = raw.trim();
    const kind = sourceKind(ref);
    if (seen.has(ref)) continue;
    if (kind === null || !state.context.allowed.sourceRefs.has(ref) || sources.length >= QUESTIONNAIRE_PROPOSAL_CAPS.sources) { state.sourcesDropped += 1; continue; }
    seen.add(ref);
    sources.push({ kind, ref });
  }
  return sources;
}

/* An addition repeating an active, open, rejected or removed question, or an earlier kept addition, is left out. */
function checkNearDuplicate(text: string, state: RunState): void {
  const { context } = state;
  const compared = [
    ...context.rows.map((row) => row.question.questionText),
    ...context.openItemTexts,
    ...context.rejectedItemTexts,
    ...state.keptAdditionTexts,
  ];
  if (compared.some((other) => isNearDuplicate(other, text))) drop("near-duplicate", nearDuplicateDetail);
}

/* An addition's section: an existing section with an active question of that title (without case), else a new one. */
function additionSection(title: string, state: RunState): ProposedSection {
  const wanted = title.toLowerCase();
  const existing = state.context.rows.find((row) => isActive(row) && row.question.section.title.trim().toLowerCase() === wanted);
  return existing ? { kind: "existing", key: existing.question.section.key } : { kind: "new", title };
}

type Candidate = QuestionnaireProposalItem extends infer Item ? Item extends QuestionnaireProposalItem ? Omit<Item, "key"> : never : never;

/*
 * Applying an item to a copy of the context-time definition (D-05, D-13): the result must still be a valid definition
 * (removed questions included), every answered question must keep its fields, visibility and valid answer
 * (`preservesAnswers`, which also catches the hidden dependent), and every active dependent's rule must still read a
 * value its controller offers (`keepsControllerValues`). Nothing is written; the copy is discarded.
 */
const REMOVED_BY_PROPOSAL = { deletedAt: new Date(0).toISOString(), deletedBy: "csrm-ai-proposal" };
const DEFINITION_INVALID_DETAIL = "The proposal would have made the questionnaire inconsistent, so it was left out.";
const ANSWERS_AFFECTED_DETAIL = "The proposal would have changed or hidden an answered question, so it was left out.";

function rawQuestion(question: QuestionnaireDefinitionQuestion): Record<string, unknown> {
  return {
    documentId: question.documentId,
    questionText: question.questionText,
    answerType: question.answerType,
    options: {
      schemaVersion: 2,
      questionKey: question.questionKey,
      section: question.section,
      order: question.order,
      required: question.required,
      ...(question.visibility ? { visibility: question.visibility } : {}),
      ...(question.choices ? { choices: question.choices } : {}),
      ...(question.deleted ? { deleted: question.deleted } : {}),
    },
    answer: question.answer,
  };
}

function checkApplied(after: readonly PreservationRow[], state: RunState): void {
  try {
    parseQuestionnaireDefinition(after.map((row) => rawQuestion(row.question)));
  } catch {
    drop("definition-invalid", DEFINITION_INVALID_DETAIL);
  }
  if (!preservesAnswers(state.context.rows, after).ok) drop("answers-affected", ANSWERS_AFFECTED_DETAIL);
  if (!keepsControllerValues(after).ok) drop("definition-invalid", DEFINITION_INVALID_DETAIL);
}

function replaced(rows: readonly PreservationRow[], documentId: string, next: PreservationRow): PreservationRow[] {
  return rows.map((row) => (row.question.documentId === documentId ? next : row));
}

function proposedQuestion(current: QuestionnaireDefinitionQuestion, proposed: ProposedQuestion): QuestionnaireDefinitionQuestion {
  const { choices: _previous, ...rest } = current;
  return {
    ...rest,
    questionText: proposed.questionText,
    answerType: proposed.answerType,
    required: proposed.required,
    ...(isSelectType(proposed.answerType) ? { choices: proposed.choices.map(({ value, label }) => ({ value, label })) } : {}),
    schemaVersion: 2,
  };
}

/* An addition at its placement (end of its section, or a new section after the last), with a key no question holds. */
function applyAddition(proposed: ProposedQuestion & { section: ProposedSection }, state: RunState): void {
  const allocation = createBatchAllocation(state.context.rows.map((row) => row.question));
  const placement = placeAddition(allocation, proposed.section);
  if (placement === null) drop("definition-invalid", DEFINITION_INVALID_DETAIL);
  const question: QuestionnaireDefinitionQuestion = {
    documentId: "csrm-proposed-addition",
    questionText: proposed.questionText,
    answerType: proposed.answerType,
    questionKey: allocateQuestionKey(proposed.questionText, allocation),
    section: placement.section,
    order: placement.order,
    required: proposed.required,
    ...(proposed.visibility ? { visibility: { ...proposed.visibility } } : {}),
    ...(isSelectType(proposed.answerType) ? { choices: proposed.choices.map(({ value, label }) => ({ value, label })) } : {}),
    schemaVersion: 2,
    answer: null,
  };
  checkApplied([...state.context.rows, { question, helpText: proposed.helpText, answer: null }], state);
}

function adaptAddition(item: WireItem, state: RunState): Candidate {
  const answerType = item.answerType as string;
  if (!(PROPOSAL_WIRE_ANSWER_TYPES as readonly string[]).includes(answerType)) drop("invalid-item", DETAIL.answerType);
  const questionText = boundedText(item.questionText as string, PROPOSAL_BOUNDS.questionText, DETAIL.questionText);
  const helpText = boundedHelpText(item.helpText);
  const rationale = boundedText(item.rationale, PROPOSAL_BOUNDS.rationale, DETAIL.rationale);
  const sectionTitle = boundedText(item.sectionTitle as string, PROPOSAL_BOUNDS.sectionTitle, DETAIL.sectionTitle);
  const choices = proposedChoices(answerType, item.choices);
  const visibility = item.visibleWhen ? visibilityRule(item.visibleWhen, state) : undefined;
  const sources = keptSources(item.sources, state);
  checkNearDuplicate(questionText, state);
  const section = additionSection(sectionTitle, state);
  const proposed: ProposedQuestion & { section: ProposedSection } = {
    questionText, helpText, answerType: answerType as QuestionnaireAnswerType, choices, required: item.required as boolean, section,
    ...(visibility ? { visibility } : {}),
  };
  const base = addBase(state.live, { section, visibility: visibility ?? null });
  if (base === null) drop("definition-invalid", DEFINITION_INVALID_DETAIL);
  applyAddition(proposed, state);
  return { kind: "add", proposed, rationale, sources, base };
}

/*
 * A change or rewrite keeps whatever it does not name from its target, which the definition bounds more loosely than a
 * proposal (text up to 65,535 characters, up to 1,000 choices). What the envelope could not hold is left out here
 * rather than failing the whole run at the parser.
 */
function withinProposalBounds(proposed: ProposedQuestion, code: AdjustmentCode): void {
  if (proposed.questionText.length > PROPOSAL_BOUNDS.questionText) drop(code, DETAIL.questionText);
  if (proposed.helpText !== null && proposed.helpText.length > PROPOSAL_BOUNDS.helpText) drop(code, DETAIL.helpText);
  if (!isSelectType(proposed.answerType)) return;
  if (proposed.choices.length < PROPOSAL_BOUNDS.selectChoicesMin || proposed.choices.length > PROPOSAL_BOUNDS.selectChoicesMax) drop(code, DETAIL.choiceCount);
  if (new Set(proposed.choices.map((choice) => choice.label.toLowerCase())).size !== proposed.choices.length) drop(code, DETAIL.choiceLabelsRepeat);
}

const normalisedText = (text: string | null | undefined): string | null => {
  const value = (text ?? "").trim().replace(/\s+/g, " ");
  return value.length ? value : null;
};

/* Whether a proposed question equals its target once text, help text and labels are normalised. */
function unchanged(target: PreservationRow, proposed: ProposedQuestion): boolean {
  const current = target.question;
  const choicesOf = (choices: readonly ProposedChoice[] | undefined) => JSON.stringify((choices ?? []).map(({ value, label }) => [value, normalisedText(label)]));
  return normalisedText(current.questionText) === normalisedText(proposed.questionText)
    && normalisedText(target.helpText) === normalisedText(proposed.helpText)
    && current.answerType === proposed.answerType
    && current.required === proposed.required
    && choicesOf(current.choices) === choicesOf(proposed.choices);
}

/* A change keeps every value it does not name; choice labels it names keep the target's value when the label matches. */
function adaptChange(item: WireItem, target: PreservationRow, state: RunState): Candidate {
  const current = target.question;
  if (item.answerType !== null && !(PROPOSAL_WIRE_ANSWER_TYPES as readonly string[]).includes(item.answerType)) drop("invalid-item", DETAIL.answerType);
  const answerType = (item.answerType ?? current.answerType) as QuestionnaireAnswerType;
  const questionText = item.questionText === null ? current.questionText : boundedText(item.questionText, PROPOSAL_BOUNDS.questionText, DETAIL.questionText);
  const helpText = item.helpText === null ? (target.helpText?.trim() || null) : boundedHelpText(item.helpText);
  const rationale = boundedText(item.rationale, PROPOSAL_BOUNDS.rationale, DETAIL.rationale);
  let choices: ProposedChoice[];
  if (item.choices.length) {
    choices = proposedChoices(answerType, item.choices).map((choice) => {
      const kept = current.choices?.find((existing) => existing.label.trim().toLowerCase() === choice.label.toLowerCase());
      return kept ? { value: kept.value, label: choice.label } : choice;
    });
  } else if (isSelectType(answerType)) {
    if (!isSelectType(current.answerType) || !current.choices) drop("invalid-item", DETAIL.choiceCount);
    choices = current.choices.map(({ value, label }) => ({ value, label }));
  } else {
    choices = [];
  }
  const sources = keptSources(item.sources, state);
  const proposed: ProposedQuestion = { questionText, helpText, answerType, choices, required: item.required ?? current.required };
  withinProposalBounds(proposed, "invalid-item");
  if (unchanged(target, proposed)) drop("no-change", "The change left the question as it was, so it was left out.");
  checkApplied(replaced(state.context.rows, current.documentId, { question: proposedQuestion(current, proposed), helpText: proposed.helpText, answer: target.answer }), state);
  return { kind: "change", target: targetOf(target), proposed, rationale, sources, base: changeBase(fingerprintInput(target)) };
}

function adaptRemoval(item: WireItem, target: PreservationRow, state: RunState): Candidate {
  const rationale = boundedText(item.rationale, PROPOSAL_BOUNDS.rationale, DETAIL.rationale);
  const sources = keptSources(item.sources, state);
  checkApplied(replaced(state.context.rows, target.question.documentId, { ...target, question: { ...target.question, schemaVersion: 2, deleted: { ...REMOVED_BY_PROPOSAL } } }), state);
  return { kind: "remove", target: targetOf(target), rationale, sources, base: changeBase(fingerprintInput(target)) };
}

function targetOf(row: PreservationRow): { questionDocumentId: string; questionKey: string; textSnapshot: string } {
  const text = row.question.questionText.trim();
  return { questionDocumentId: row.question.documentId, questionKey: row.question.questionKey, textSnapshot: text.length > PROPOSAL_BOUNDS.textSnapshot ? text.slice(0, PROPOSAL_BOUNDS.textSnapshot) : text };
}

function adaptItem(item: WireItem, state: RunState): Candidate {
  checkKind(item, state);
  if (item.kind === "add") return adaptAddition(item, state);
  const ref = (item.target as string).trim();
  const target = resolveTarget(ref, state);
  if (state.claimedTargets.has(target.question.documentId)) drop("duplicate-target", duplicateTargetDetail(ref));
  state.claimedTargets.add(target.question.documentId);
  return item.kind === "change" ? adaptChange(item, target, state) : adaptRemoval(item, target, state);
}

function withKey(candidate: Candidate, key: string): QuestionnaireProposalItem {
  return { key, ...candidate } as QuestionnaireProposalItem;
}

/* The adjustment list: per-item drops one by one within the bound, then one entry per code with its count. */
class AdjustmentLog {
  private readonly individual: ProposalAdjustment[] = [];
  private readonly overflow = new Map<AdjustmentCode, number>();

  record(code: AdjustmentCode, wireIndex: number | undefined, detail: string): void {
    if (this.individual.length < INDIVIDUAL_ADJUSTMENTS_MAX) this.individual.push({ code, ...(wireIndex === undefined ? {} : { wireIndex }), detail });
    else this.overflow.set(code, (this.overflow.get(code) ?? 0) + 1);
  }

  list(state: Pick<RunState, "ignoredFields" | "sourcesDropped">, overLimit: number): ProposalAdjustment[] {
    const adjustments = [...this.individual];
    for (const [code, count] of this.overflow) adjustments.push({ code, count, detail: `${count} more proposals were left out for the same reason.` });
    if (overLimit) adjustments.push({ code: "over-limit", count: overLimit, detail: `${overLimit} more proposals were beyond the limit of 30, or 15 new questions, per request.` });
    if (state.ignoredFields) adjustments.push({ code: "ignored-field", count: state.ignoredFields, detail: "Fields a proposal's kind does not use were ignored." });
    if (state.sourcesDropped) adjustments.push({ code: "sources-dropped", count: state.sourcesDropped, detail: "Sources the request did not offer were removed from the proposals." });
    return adjustments;
  }
}

function newRunState(context: QuestionnaireAdapterContext): RunState {
  return {
    context,
    live: liveQuestionnaire(context),
    rowsByDocument: new Map(context.rows.map((row) => [row.question.documentId, row])),
    claimedTargets: new Set(),
    keptAdditionTexts: [],
    sourcesDropped: 0,
    ignoredFields: 0,
  };
}

/* The closed, context-aware parser is the gate (06.7 D-07): a result it refuses fails the job. */
function gated(envelope: unknown, context: QuestionnaireAdapterContext): QuestionnaireProposalV1 {
  const parsed = parseQuestionnaireProposal(envelope, { questionDocumentIds: context.allowed.questionDocumentIds, sourceRefs: context.allowed.sourceRefs });
  if (parsed === null) throw invalidOutput();
  return parsed;
}

/**
 * The questionnaire proposal envelope v1 from a provider's wire output: every item CSRM keeps, keyed `i-1…` in order with
 * its base, and an adjustment for everything it left out or changed. Per item, in order, the first rule it fails records
 * one adjustment and leaves it out: its kind's fields, its target (unknown, removed, answered), a second item on one
 * target, the bounds, a select's labels and the Not sure rule, then (sources aside) a near-duplicate addition, a change
 * that changes nothing, and the result on a copy of the definition; the caps come last, as one aggregated count. A
 * structural failure, or a result the closed parser refuses, fails the job with `PROVIDER_OUTPUT_INVALID`.
 */
export function toQuestionnaireProposal(raw: unknown, context: QuestionnaireAdapterContext): QuestionnaireProposalV1 {
  const wire = parseWire(raw);
  const state = newRunState(context);
  const items: QuestionnaireProposalItem[] = [];
  const log = new AdjustmentLog();
  let additions = 0;
  let overLimit = Math.max(0, wire.length - WIRE_ITEMS_EXAMINED);
  for (const [wireIndex, entry] of wire.slice(0, WIRE_ITEMS_EXAMINED).entries()) {
    try {
      const candidate = adaptItem(entry, state);
      if (items.length >= QUESTIONNAIRE_PROPOSAL_CAPS.items || (candidate.kind === "add" && additions >= QUESTIONNAIRE_PROPOSAL_CAPS.additions)) {
        overLimit += 1;
        continue;
      }
      if (candidate.kind === "add") {
        additions += 1;
        state.keptAdditionTexts.push(candidate.proposed.questionText);
      }
      items.push(withKey(candidate, `i-${items.length + 1}`));
    } catch (error) {
      if (!(error instanceof Dropped)) throw error;
      log.record(error.drop.code, wireIndex, error.drop.detail);
    }
  }
  return gated({ schemaVersion: 1, operation: "questionnaire-proposals", outcome: items.length ? "items" : "no-change", items, adjustments: log.list(state, overLimit) }, context);
}

/*
 * The question rewrite wire and adapter (Phase 15 D-11; T-15-15). The wire can carry only the question text, the help
 * text and one label per choice, so a rewrite cannot reach the answer type, the choice values, the required flag, the
 * section, the order or the visibility rule: the adapter copies all of them from the target, and maps the labels
 * positionally onto the target's unchanged values.
 */
const REWRITE_KEYS = ["schemaVersion", "questionText", "helpText", "choiceLabels", "rationale"] as const;

/** The question rewrite wire v1 (`question_rewrite`): five properties, one level, inside the portable subset. */
export function questionRewriteWireSchema() {
  return {
    type: "object", additionalProperties: false, required: [...REWRITE_KEYS], properties: {
      schemaVersion: { type: "integer", enum: [1] },
      questionText: { type: "string" },
      helpText: { type: ["string", "null"] },
      choiceLabels: { type: "array", items: { type: "string" } },
      rationale: { type: "string" },
    },
  };
}

type WireRewrite = { questionText: string; helpText: string | null; choiceLabels: string[]; rationale: string };

function parseRewriteWire(raw: unknown): WireRewrite {
  if (!isRecord(raw) || !hasExactKeys(raw, REWRITE_KEYS) || raw.schemaVersion !== 1
    || typeof raw.questionText !== "string" || !isNullableString(raw.helpText) || !isStringArray(raw.choiceLabels) || typeof raw.rationale !== "string") throw invalidOutput();
  return { questionText: raw.questionText, helpText: raw.helpText, choiceLabels: raw.choiceLabels, rationale: raw.rationale };
}

const REWRITE_OUT_OF_SCOPE_DETAIL = "The rewrite changed more than the wording (its choices did not match the question's one for one), so it was left out.";

function adaptRewrite(wire: WireRewrite, state: RunState): Candidate | null {
  const { allowed } = state.context;
  const [documentId = ""] = [...allowed.questionDocumentIds];
  const ref = [...allowed.refs].find(([, id]) => id === documentId)?.[0] ?? "the question";
  const target = state.rowsByDocument.get(documentId);
  if (target === undefined || !isActive(target) || allowed.removedDocumentIds.has(documentId)) drop("removed-target", removedTargetDetail(refText(ref)));
  if (allowed.answeredRefs.has(ref) || isAnsweredValue(target.answer)) drop("answered-target", answeredTargetDetail(refText(ref)));
  const questionText = boundedText(wire.questionText, PROPOSAL_BOUNDS.questionText, DETAIL.questionText);
  const helpText = boundedHelpText(wire.helpText);
  const rationale = boundedText(wire.rationale, PROPOSAL_BOUNDS.rationale, DETAIL.rationale);
  const current = target.question.choices ?? [];
  if (wire.choiceLabels.length !== current.length) drop("rewrite-out-of-scope", REWRITE_OUT_OF_SCOPE_DETAIL);
  const labels = wire.choiceLabels.map((label) => boundedText(label, PROPOSAL_BOUNDS.choiceLabel, DETAIL.choiceLabel));
  const proposed: ProposedQuestion = {
    questionText,
    helpText,
    answerType: target.question.answerType,
    choices: current.map(({ value }, index) => ({ value, label: labels[index] })),
    required: target.question.required,
  };
  withinProposalBounds(proposed, "invalid-item");
  // Nothing to simplify: the run completes with no item.
  if (unchanged(target, proposed)) return null;
  checkApplied(replaced(state.context.rows, documentId, { question: proposedQuestion(target.question, proposed), helpText: proposed.helpText, answer: target.answer }), state);
  return { kind: "change", target: targetOf(target), proposed, rationale, sources: [], base: changeBase(fingerprintInput(target)) };
}

/**
 * The questionnaire proposal envelope v1 of a `question-rewrite` run: one `change` of the target's wording, or no item
 * (`no-change`) when the rewrite leaves it as it was or is left out. The context's allowed sets name the one target
 * (15-04's rewrite scope). A structural failure, or a result the closed parser refuses, fails the job with
 * `PROVIDER_OUTPUT_INVALID`.
 */
export function toQuestionRewriteProposal(raw: unknown, context: QuestionnaireAdapterContext): QuestionnaireProposalV1 {
  const wire = parseRewriteWire(raw);
  if (context.allowed.questionDocumentIds.size !== 1) throw new Error("CSRM question rewrite context must name exactly one target question.");
  const state = newRunState(context);
  const log = new AdjustmentLog();
  const items: QuestionnaireProposalItem[] = [];
  try {
    const candidate = adaptRewrite(wire, state);
    if (candidate) items.push(withKey(candidate, "i-1"));
  } catch (error) {
    if (!(error instanceof Dropped)) throw error;
    log.record(error.drop.code, undefined, error.drop.detail);
  }
  return gated({ schemaVersion: 1, operation: "question-rewrite", outcome: items.length ? "items" : "no-change", items, adjustments: log.list(state, 0) }, context);
}

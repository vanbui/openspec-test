import { createHash } from "node:crypto";
import { parseDecisionEventsV2, isProposalItemKey, PROPOSAL_ITEMS_MAX, type DecisionEventV2, type DecisionPayloadParsers } from "../../../csrm/ai/proposal-items";
import { QUESTIONNAIRE_ANSWER_TYPES, type QuestionnaireAnswerType, type VisibilityOperator } from "./questionnaire-definition";

/*
 * The questionnaire proposal envelope v1 and its decision payloads (Phase 15 D-20, D-25; the approved Phase 15
 * amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Questionnaire proposal envelope v1",
 * "Bases and staleness" and "Decision event v2 and item states").
 *
 * `questionnaire-proposals` and `question-rewrite` runs store this envelope in `CsrmAiRun.proposal`, written once by the
 * transaction that completes the run and never changed. A reader chooses this parser by the run's `operation`, never by
 * `schemaVersion`. Like the governance log, every parser here is closed (exact keys, bounded strings, closed values),
 * returns frozen copies, and reads anything malformed as null without throwing.
 */

type RecordValue = Record<string, unknown>;

export const QUESTIONNAIRE_PROPOSAL_SCHEMA_VERSION = 1;
export const QUESTIONNAIRE_PROPOSAL_OPERATIONS = Object.freeze(["questionnaire-proposals", "question-rewrite"] as const);
export type QuestionnaireProposalOperation = (typeof QUESTIONNAIRE_PROPOSAL_OPERATIONS)[number];
export const PROPOSAL_OUTCOMES = Object.freeze(["items", "no-change"] as const);
export const PROPOSAL_ITEM_KINDS = Object.freeze(["add", "change", "remove"] as const);
export type ProposalItemKind = (typeof PROPOSAL_ITEM_KINDS)[number];
export const SOURCE_KINDS = Object.freeze(["request-field", "note", "file", "answered-question", "instruction"] as const);
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const ADJUSTMENT_CODES = Object.freeze([
  "answered-target",
  "removed-target",
  "unknown-target",
  "duplicate-target",
  "invalid-item",
  "near-duplicate",
  "no-change",
  "definition-invalid",
  "answers-affected",
  "rewrite-out-of-scope",
  "over-limit",
  "ignored-field",
  "sources-dropped",
] as const);
export type AdjustmentCode = (typeof ADJUSTMENT_CODES)[number];
/* The field names an analyst may edit before confirming (the event's `edits`). */
export const QUESTIONNAIRE_EDIT_FIELDS = Object.freeze(["questionText", "helpText", "answerType", "choices", "required", "section"] as const);
/* The AI never proposes these answer types; a change or a rewrite may keep the target's own. */
export const AI_UNPROPOSABLE_ANSWER_TYPES: readonly QuestionnaireAnswerType[] = Object.freeze(["Boolean", "File upload"]);

export const PROPOSAL_BOUNDS = Object.freeze({
  items: PROPOSAL_ITEMS_MAX,
  additions: 15,
  sources: 10,
  adjustments: 60,
  questionText: 1_000,
  helpText: 2_000,
  rationale: 1_000,
  textSnapshot: 500,
  adjustmentDetail: 500,
  choiceLabel: 255,
  choiceValue: 255,
  selectChoicesMin: 2,
  /* 20 before the canonical Not sure. */
  selectChoicesMax: 21,
  sectionTitle: 255,
  sectionKey: 120,
  questionKey: 120,
  documentId: 255,
  sourceRef: 255,
});
/* The definition parser's own bounds, for a snapshot of a question as it stands. */
const DEFINITION_QUESTION_TEXT_MAX = 65_535;
const DEFINITION_CHOICES_MAX = 1_000;

export type ProposedChoice = { value: string; label: string };
export type ProposedVisibility = { questionKey: string; operator: VisibilityOperator; value: string | boolean };
export type ProposedSection = { kind: "existing"; key: string } | { kind: "new"; title: string };
export type ProposedQuestion = {
  questionText: string;
  helpText: string | null;
  answerType: QuestionnaireAnswerType;
  choices: ProposedChoice[];
  required: boolean;
  /* An addition only. */
  section?: ProposedSection;
  /* An addition only. */
  visibility?: ProposedVisibility;
};
export type ProposalTarget = { questionDocumentId: string; questionKey: string; textSnapshot: string };
export type ProposalSource = { kind: SourceKind; ref: string };
export type ChangeBase = { kind: "question"; fingerprint: string; unanswered: true };
export type AddBaseSection = { kind: "existing"; key: string; title: string; order: number } | { kind: "new"; title: string };
export type AddBase = { kind: "placement"; generatedAt: string | null; section: AddBaseSection; controller: { questionKey: string; fingerprint: string } | null };
export type QuestionnaireProposalItem =
  | { key: string; kind: "add"; proposed: ProposedQuestion & { section: ProposedSection }; rationale: string; sources: ProposalSource[]; base: AddBase }
  | { key: string; kind: "change"; target: ProposalTarget; proposed: ProposedQuestion; rationale: string; sources: ProposalSource[]; base: ChangeBase }
  | { key: string; kind: "remove"; target: ProposalTarget; rationale: string; sources: ProposalSource[]; base: ChangeBase };
export type ProposalAdjustment = { code: AdjustmentCode; wireIndex?: number; count?: number; detail: string };
export type QuestionnaireProposalV1 = {
  schemaVersion: 1;
  operation: QuestionnaireProposalOperation;
  outcome: "items" | "no-change";
  items: QuestionnaireProposalItem[];
  adjustments: ProposalAdjustment[];
};

/** The question's values a fingerprint covers, read from the question row (`helpText` null when blank). */
export type QuestionFingerprintInput = {
  questionText: string;
  helpText: string | null;
  answerType: QuestionnaireAnswerType;
  choices: ProposedChoice[] | null;
  required: boolean;
  section: { key: string; title: string; order: number };
  order: number;
  visibility: ProposedVisibility | null;
  removed: boolean;
};
/** The target as it was, on the accept of a change or removal (what Undo restores). */
export type QuestionSnapshot = QuestionFingerprintInput & { questionDocumentId: string; questionKey: string };
/** What an accept applied, and what the restore of an accepted item undoes. */
export type AppliedQuestion = { questionDocumentId: string; questionKey: string; fingerprint: string };
export type QuestionnaireDecisionEvent = DecisionEventV2<QuestionSnapshot, AppliedQuestion>;

/** The adapter's gate (15-05): every target and every source reference must be one the context offered. */
export type ProposalAllowedSets = { questionDocumentIds: ReadonlySet<string>; sourceRefs: ReadonlySet<string> };

class MalformedProposal extends Error {}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, allowed: readonly string[], required: readonly string[] = []): RecordValue {
  if (!isRecord(value)) throw new MalformedProposal();
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new MalformedProposal();
  if (required.some((key) => value[key] === undefined)) throw new MalformedProposal();
  return value;
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) throw new MalformedProposal();
  return value.trim();
}

function boundedArray(value: unknown, maximum: number, minimum = 0): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new MalformedProposal();
  return value;
}

function closed<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new MalformedProposal();
  return value as T;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new MalformedProposal();
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new MalformedProposal();
  return value;
}

function nullableInstant(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 64 || Number.isNaN(Date.parse(value))) throw new MalformedProposal();
  return value;
}

function fingerprint(value: unknown): string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new MalformedProposal();
  return value;
}

function isSelect(answerType: QuestionnaireAnswerType): boolean {
  return answerType === "Single select" || answerType === "Multi select";
}

function parseChoices(value: unknown, maximum: number, minimum: number, uniqueLabels = true): ProposedChoice[] {
  const choices = boundedArray(value, maximum, minimum).map((entry) => {
    const choice = exactKeys(entry, ["value", "label"], ["value", "label"]);
    return Object.freeze({ value: boundedString(choice.value, PROPOSAL_BOUNDS.choiceValue), label: boundedString(choice.label, PROPOSAL_BOUNDS.choiceLabel) });
  });
  if (new Set(choices.map((choice) => choice.value)).size !== choices.length) throw new MalformedProposal();
  // Labels are unique without regard to case (D-13).
  if (uniqueLabels && new Set(choices.map((choice) => choice.label.toLowerCase())).size !== choices.length) throw new MalformedProposal();
  return choices;
}

/*
 * A proposed rule reads a value its controller offers (a choice value, or a Boolean). A snapshot records the rule a
 * question holds, which the definition parser bounds only by type, so it is read as stored.
 */
function parseVisibility(value: unknown, mode: "proposed" | "snapshot" = "proposed"): ProposedVisibility {
  const rule = exactKeys(value, ["questionKey", "operator", "value"], ["questionKey", "operator", "value"]);
  const ruleValue = rule.value;
  const valid = typeof ruleValue === "boolean"
    || (typeof ruleValue === "string" && (mode === "snapshot"
      ? ruleValue.length <= DEFINITION_QUESTION_TEXT_MAX
      : ruleValue.trim().length > 0 && ruleValue.length <= PROPOSAL_BOUNDS.choiceValue));
  if (!valid || (typeof ruleValue !== "boolean" && typeof ruleValue !== "string")) throw new MalformedProposal();
  return Object.freeze({
    questionKey: boundedString(rule.questionKey, PROPOSAL_BOUNDS.questionKey),
    operator: closed(rule.operator, ["equals", "notEquals", "includes", "notIncludes"] as const),
    value: ruleValue,
  });
}

function parseProposedSection(value: unknown): ProposedSection {
  if (!isRecord(value)) throw new MalformedProposal();
  if (value.kind === "existing") {
    const section = exactKeys(value, ["kind", "key"], ["kind", "key"]);
    return Object.freeze({ kind: "existing", key: boundedString(section.key, PROPOSAL_BOUNDS.sectionKey) });
  }
  if (value.kind === "new") {
    const section = exactKeys(value, ["kind", "title"], ["kind", "title"]);
    return Object.freeze({ kind: "new", title: boundedString(section.title, PROPOSAL_BOUNDS.sectionTitle) });
  }
  throw new MalformedProposal();
}

function parseProposed(value: unknown, kind: "add" | "change"): ProposedQuestion {
  const proposed = kind === "add"
    ? exactKeys(value, ["questionText", "helpText", "answerType", "choices", "required", "section", "visibility"], ["questionText", "answerType", "choices", "required", "section"])
    : exactKeys(value, ["questionText", "helpText", "answerType", "choices", "required"], ["questionText", "answerType", "choices", "required"]);
  if (!("helpText" in proposed)) throw new MalformedProposal();
  const answerType = closed(proposed.answerType, QUESTIONNAIRE_ANSWER_TYPES);
  if (kind === "add" && AI_UNPROPOSABLE_ANSWER_TYPES.includes(answerType)) throw new MalformedProposal();
  const choices = isSelect(answerType)
    ? parseChoices(proposed.choices, PROPOSAL_BOUNDS.selectChoicesMax, PROPOSAL_BOUNDS.selectChoicesMin)
    : parseChoices(proposed.choices, 0, 0);
  const section = kind === "add" ? parseProposedSection(proposed.section) : undefined;
  const visibility = kind === "add" && proposed.visibility !== undefined ? parseVisibility(proposed.visibility) : undefined;
  return Object.freeze({
    questionText: boundedString(proposed.questionText, PROPOSAL_BOUNDS.questionText),
    helpText: proposed.helpText === null ? null : boundedString(proposed.helpText, PROPOSAL_BOUNDS.helpText),
    answerType,
    choices: Object.freeze(choices) as ProposedChoice[],
    required: bool(proposed.required),
    ...(section === undefined ? {} : { section }),
    ...(visibility === undefined ? {} : { visibility }),
  });
}

function parseTarget(value: unknown): ProposalTarget {
  const target = exactKeys(value, ["questionDocumentId", "questionKey", "textSnapshot"], ["questionDocumentId", "questionKey", "textSnapshot"]);
  return Object.freeze({
    questionDocumentId: boundedString(target.questionDocumentId, PROPOSAL_BOUNDS.documentId),
    questionKey: boundedString(target.questionKey, PROPOSAL_BOUNDS.questionKey),
    textSnapshot: boundedString(target.textSnapshot, PROPOSAL_BOUNDS.textSnapshot),
  });
}

function parseSources(value: unknown): ProposalSource[] {
  return Object.freeze(boundedArray(value, PROPOSAL_BOUNDS.sources).map((entry) => {
    const source = exactKeys(entry, ["kind", "ref"], ["kind", "ref"]);
    const ref = boundedString(source.ref, PROPOSAL_BOUNDS.sourceRef);
    if (!/^[A-Za-z0-9._:-]+$/.test(ref)) throw new MalformedProposal();
    return Object.freeze({ kind: closed(source.kind, SOURCE_KINDS), ref });
  })) as ProposalSource[];
}

function parseChangeBase(value: unknown): ChangeBase {
  const base = exactKeys(value, ["kind", "fingerprint", "unanswered"], ["kind", "fingerprint", "unanswered"]);
  if (base.kind !== "question" || base.unanswered !== true) throw new MalformedProposal();
  return Object.freeze({ kind: "question", fingerprint: fingerprint(base.fingerprint), unanswered: true });
}

function parseAddBaseSection(value: unknown): AddBaseSection {
  if (!isRecord(value)) throw new MalformedProposal();
  if (value.kind === "existing") {
    const section = exactKeys(value, ["kind", "key", "title", "order"], ["kind", "key", "title", "order"]);
    return Object.freeze({
      kind: "existing",
      key: boundedString(section.key, PROPOSAL_BOUNDS.sectionKey),
      title: boundedString(section.title, PROPOSAL_BOUNDS.sectionTitle),
      order: nonNegativeInteger(section.order),
    });
  }
  if (value.kind === "new") {
    const section = exactKeys(value, ["kind", "title"], ["kind", "title"]);
    return Object.freeze({ kind: "new", title: boundedString(section.title, PROPOSAL_BOUNDS.sectionTitle) });
  }
  throw new MalformedProposal();
}

function parseAddBase(value: unknown): AddBase {
  const base = exactKeys(value, ["kind", "generatedAt", "section", "controller"], ["kind", "section"]);
  if (base.kind !== "placement" || !("generatedAt" in base) || !("controller" in base)) throw new MalformedProposal();
  let controller: AddBase["controller"] = null;
  if (base.controller !== null) {
    const entry = exactKeys(base.controller, ["questionKey", "fingerprint"], ["questionKey", "fingerprint"]);
    controller = Object.freeze({ questionKey: boundedString(entry.questionKey, PROPOSAL_BOUNDS.questionKey), fingerprint: fingerprint(entry.fingerprint) });
  }
  return Object.freeze({ kind: "placement", generatedAt: nullableInstant(base.generatedAt), section: parseAddBaseSection(base.section), controller });
}

function parseItem(value: unknown, index: number): QuestionnaireProposalItem {
  if (!isRecord(value)) throw new MalformedProposal();
  const kind = closed(value.kind, PROPOSAL_ITEM_KINDS);
  const keys = kind === "add"
    ? ["key", "kind", "proposed", "rationale", "sources", "base"]
    : kind === "change"
      ? ["key", "kind", "target", "proposed", "rationale", "sources", "base"]
      : ["key", "kind", "target", "rationale", "sources", "base"];
  const item = exactKeys(value, keys, keys);
  // Keyed i-1 to i-30 in the order CSRM kept them.
  if (!isProposalItemKey(item.key) || item.key !== `i-${index + 1}`) throw new MalformedProposal();
  const common = { key: item.key, rationale: boundedString(item.rationale, PROPOSAL_BOUNDS.rationale), sources: parseSources(item.sources) };
  if (kind === "add") {
    const proposed = parseProposed(item.proposed, "add") as ProposedQuestion & { section: ProposedSection };
    const base = parseAddBase(item.base);
    // The base records the placement the addition was proposed against: its section, and its controller exactly
    // when it has a visibility rule.
    const sectionAgrees = proposed.section.kind === "existing"
      ? base.section.kind === "existing" && base.section.key === proposed.section.key
      : base.section.kind === "new" && base.section.title === proposed.section.title;
    const controllerAgrees = proposed.visibility === undefined ? base.controller === null : base.controller?.questionKey === proposed.visibility.questionKey;
    if (!sectionAgrees || !controllerAgrees) throw new MalformedProposal();
    return Object.freeze({ key: common.key, kind, proposed, rationale: common.rationale, sources: common.sources, base });
  }
  const target = parseTarget(item.target);
  const base = parseChangeBase(item.base);
  if (kind === "change") {
    return Object.freeze({ key: common.key, kind, target, proposed: parseProposed(item.proposed, "change"), rationale: common.rationale, sources: common.sources, base });
  }
  return Object.freeze({ key: common.key, kind, target, rationale: common.rationale, sources: common.sources, base });
}

function parseAdjustment(value: unknown): ProposalAdjustment {
  const adjustment = exactKeys(value, ["code", "wireIndex", "count", "detail"], ["code", "detail"]);
  const count = adjustment.count === undefined ? undefined : nonNegativeInteger(adjustment.count);
  if (count === 0) throw new MalformedProposal();
  const wireIndex = adjustment.wireIndex === undefined ? undefined : nonNegativeInteger(adjustment.wireIndex);
  return Object.freeze({
    code: closed(adjustment.code, ADJUSTMENT_CODES),
    ...(wireIndex === undefined ? {} : { wireIndex }),
    ...(count === undefined ? {} : { count }),
    detail: boundedString(adjustment.detail, PROPOSAL_BOUNDS.adjustmentDetail),
  });
}

function parseEnvelope(value: unknown, allowed?: ProposalAllowedSets): QuestionnaireProposalV1 {
  const keys = ["schemaVersion", "operation", "outcome", "items", "adjustments"];
  const envelope = exactKeys(value, keys, keys);
  if (envelope.schemaVersion !== QUESTIONNAIRE_PROPOSAL_SCHEMA_VERSION) throw new MalformedProposal();
  const operation = closed(envelope.operation, QUESTIONNAIRE_PROPOSAL_OPERATIONS);
  const outcome = closed(envelope.outcome, PROPOSAL_OUTCOMES);
  const items = boundedArray(envelope.items, PROPOSAL_BOUNDS.items).map(parseItem);
  if ((outcome === "no-change") !== (items.length === 0)) throw new MalformedProposal();
  if (items.filter((item) => item.kind === "add").length > PROPOSAL_BOUNDS.additions) throw new MalformedProposal();
  // A rewrite is one change of one question (D-11).
  if (operation === "question-rewrite" && (items.length > 1 || items.some((item) => item.kind !== "change"))) throw new MalformedProposal();
  // At most one item per target question, so a run never makes its own items stale.
  const targets = items.flatMap((item) => (item.kind === "add" ? [] : [item.target.questionDocumentId]));
  if (new Set(targets).size !== targets.length) throw new MalformedProposal();
  if (allowed) {
    if (targets.some((target) => !allowed.questionDocumentIds.has(target))) throw new MalformedProposal();
    if (items.some((item) => item.sources.some((source) => !allowed.sourceRefs.has(source.ref)))) throw new MalformedProposal();
  }
  const adjustments = boundedArray(envelope.adjustments, PROPOSAL_BOUNDS.adjustments).map(parseAdjustment);
  return Object.freeze({
    schemaVersion: QUESTIONNAIRE_PROPOSAL_SCHEMA_VERSION as 1,
    operation,
    outcome,
    items: Object.freeze(items) as QuestionnaireProposalItem[],
    adjustments: Object.freeze(adjustments) as ProposalAdjustment[],
  });
}

/**
 * A stored questionnaire proposal envelope v1, parsed closed: a frozen copy, or null on anything malformed. When
 * `allowed` is given, every target and every source reference must be in it (the adapter's gate). Never throws.
 */
export function parseQuestionnaireProposal(value: unknown, allowed?: ProposalAllowedSets): QuestionnaireProposalV1 | null {
  try {
    return parseEnvelope(value, allowed);
  } catch (error) {
    if (error instanceof MalformedProposal) return null;
    throw error;
  }
}

function parseSectionFact(value: unknown): QuestionFingerprintInput["section"] {
  const section = exactKeys(value, ["key", "title", "order"], ["key", "title", "order"]);
  return Object.freeze({ key: boundedString(section.key, PROPOSAL_BOUNDS.sectionKey), title: boundedString(section.title, PROPOSAL_BOUNDS.sectionTitle), order: nonNegativeInteger(section.order) });
}

const SNAPSHOT_KEYS = ["questionDocumentId", "questionKey", "questionText", "helpText", "answerType", "choices", "required", "section", "order", "visibility", "removed"] as const;

function parseSnapshot(value: unknown): QuestionSnapshot {
  const snapshot = exactKeys(value, SNAPSHOT_KEYS, ["questionDocumentId", "questionKey", "questionText", "answerType", "required", "section", "order", "removed"]);
  if (!("helpText" in snapshot) || !("choices" in snapshot) || !("visibility" in snapshot)) throw new MalformedProposal();
  return Object.freeze({
    questionDocumentId: boundedString(snapshot.questionDocumentId, PROPOSAL_BOUNDS.documentId),
    questionKey: boundedString(snapshot.questionKey, PROPOSAL_BOUNDS.questionKey),
    questionText: boundedString(snapshot.questionText, DEFINITION_QUESTION_TEXT_MAX),
    helpText: snapshot.helpText === null ? null : boundedString(snapshot.helpText, DEFINITION_QUESTION_TEXT_MAX),
    answerType: closed(snapshot.answerType, QUESTIONNAIRE_ANSWER_TYPES),
    choices: snapshot.choices === null ? null : (Object.freeze(parseChoices(snapshot.choices, DEFINITION_CHOICES_MAX, 1, false)) as ProposedChoice[]),
    required: bool(snapshot.required),
    section: parseSectionFact(snapshot.section),
    order: nonNegativeInteger(snapshot.order),
    visibility: snapshot.visibility === null ? null : parseVisibility(snapshot.visibility, "snapshot"),
    removed: bool(snapshot.removed),
  });
}

function parseApplied(value: unknown): AppliedQuestion {
  const applied = exactKeys(value, ["questionDocumentId", "questionKey", "fingerprint"], ["questionDocumentId", "questionKey", "fingerprint"]);
  return Object.freeze({
    questionDocumentId: boundedString(applied.questionDocumentId, PROPOSAL_BOUNDS.documentId),
    questionKey: boundedString(applied.questionKey, PROPOSAL_BOUNDS.questionKey),
    fingerprint: fingerprint(applied.fingerprint),
  });
}

function nullOnMalformed<T>(parse: (value: unknown) => T): (value: unknown) => T | null {
  return (value) => {
    try {
      return parse(value);
    } catch (error) {
      if (error instanceof MalformedProposal) return null;
      throw error;
    }
  };
}

/** The questionnaire's payload parsers for the generic decision event v2. */
export const questionnaireDecisionPayloads: DecisionPayloadParsers<QuestionSnapshot, AppliedQuestion> = Object.freeze({
  editFields: QUESTIONNAIRE_EDIT_FIELDS,
  before: nullOnMalformed(parseSnapshot),
  applied: nullOnMalformed(parseApplied),
  causes: Object.freeze(["newer-rewrite", "questionnaire-frozen"] as const),
});

/** A questionnaire run's stored `decisions` (v2 only), or null when the run is damaged. Never throws. */
export function parseQuestionnaireDecisionEvents(value: unknown): readonly QuestionnaireDecisionEvent[] | null {
  return parseDecisionEventsV2(value, questionnaireDecisionPayloads);
}

/*
 * Bases and staleness (D-20, D-25; the amendment's "Bases and staleness"). A base never holds a question's text or an
 * answer: only fingerprints and placement facts. Staleness is derived on every read, and checked again inside the
 * decision transaction against the questionnaire as the batch's earlier decisions leave it.
 */

/** A question as it stands now (active or removed), with the one answered rule's verdict (`isAnsweredValue`). */
export type LiveQuestion = QuestionFingerprintInput & { documentId: string; questionKey: string; answered: boolean };
/** The questionnaire as it stands now: its `generatedDate` and every question, removed ones included. */
export type LiveQuestionnaire = { generatedDate: string | null; questions: readonly LiveQuestion[] };

/* Canonical JSON: object keys sorted at every level, array order kept, undefined members left out. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry === undefined ? null : entry)).join(",")}]`;
  if (isRecord(value)) {
    const members = Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * `sha256:` and the lowercase hex digest of the canonical JSON of the nine fingerprinted values. Only those nine are
 * read, so a row or snapshot carrying other members fingerprints the same; blank help text counts as none.
 */
export function questionFingerprint(input: QuestionFingerprintInput): string {
  const helpText = typeof input.helpText === "string" && input.helpText.trim().length > 0 ? input.helpText : null;
  const values = {
    questionText: input.questionText,
    helpText,
    answerType: input.answerType,
    choices: input.choices === undefined || input.choices === null ? null : input.choices.map(({ value, label }) => ({ value, label })),
    required: input.required,
    section: { key: input.section.key, title: input.section.title, order: input.section.order },
    order: input.order,
    visibility: input.visibility === undefined || input.visibility === null
      ? null
      : { questionKey: input.visibility.questionKey, operator: input.visibility.operator, value: input.visibility.value },
    removed: input.removed,
  };
  return `sha256:${createHash("sha256").update(canonicalJson(values), "utf8").digest("hex")}`;
}

/** The base of a change or a removal: the target's fingerprint, proposed while it was unanswered. */
export function changeBase(row: QuestionFingerprintInput): ChangeBase {
  return Object.freeze({ kind: "question", fingerprint: questionFingerprint(row), unanswered: true });
}

function activeQuestions(live: LiveQuestionnaire): LiveQuestion[] {
  return live.questions.filter((question) => !question.removed);
}

/*
 * The section an existing-section addition was proposed into, as its active questions name it: the first active
 * question of that key in questionnaire order. A section with no active question offers no placement.
 */
function existingSectionFact(live: LiveQuestionnaire, key: string): { key: string; title: string; order: number } | null {
  const holders = activeQuestions(live).filter((question) => question.section.key === key).sort((left, right) => left.order - right.order);
  const first = holders[0];
  return first === undefined ? null : { key: first.section.key, title: first.section.title, order: first.section.order };
}

/**
 * The base of an addition: the questionnaire's generation, the section it goes into and, under a visibility rule, its
 * controller's fingerprint. Null when the placement does not exist now (an existing section with no active question,
 * or a controller that is missing or removed), so the caller leaves the addition out.
 */
export function addBase(live: LiveQuestionnaire, placement: { section: ProposedSection; visibility?: ProposedVisibility | null }): AddBase | null {
  let section: AddBaseSection;
  if (placement.section.kind === "existing") {
    const fact = existingSectionFact(live, placement.section.key);
    if (fact === null) return null;
    section = Object.freeze({ kind: "existing", ...fact });
  } else {
    section = Object.freeze({ kind: "new", title: placement.section.title.trim() });
  }
  let controller: AddBase["controller"] = null;
  if (placement.visibility) {
    const controllerKey = placement.visibility.questionKey;
    const question = activeQuestions(live).find((entry) => entry.questionKey === controllerKey);
    if (question === undefined) return null;
    controller = Object.freeze({ questionKey: question.questionKey, fingerprint: questionFingerprint(question) });
  }
  return Object.freeze({ kind: "placement", generatedAt: live.generatedDate, section, controller });
}

function sameInstant(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return left === right;
  return leftTime === rightTime;
}

/**
 * Whether the basis an item was proposed against no longer holds (the amendment's rule, exactly):
 * - a change or removal: its target is missing, removed or answered, or its fingerprint differs;
 * - an addition: the questionnaire's `generatedDate` differs from the base's, its existing section no longer holds an
 *   active question with the same key, title and order, or its controller is missing, removed or changed.
 * A stale item can only be rejected.
 */
export function isItemStale(item: QuestionnaireProposalItem, live: LiveQuestionnaire): boolean {
  if (item.kind === "change" || item.kind === "remove") {
    const target = live.questions.find((question) => question.documentId === item.target.questionDocumentId);
    if (target === undefined || target.removed || target.answered) return true;
    return questionFingerprint(target) !== item.base.fingerprint;
  }
  const { base } = item;
  if (!sameInstant(live.generatedDate, base.generatedAt)) return true;
  if (base.section.kind === "existing") {
    const { key, title, order } = base.section;
    const held = activeQuestions(live).some((question) => question.section.key === key && question.section.title === title && question.section.order === order);
    if (!held) return true;
  }
  if (base.controller !== null) {
    const controllerKey = base.controller.questionKey;
    const controller = live.questions.find((question) => question.questionKey === controllerKey);
    if (controller === undefined || controller.removed) return true;
    if (questionFingerprint(controller) !== base.controller.fingerprint) return true;
  }
  return false;
}

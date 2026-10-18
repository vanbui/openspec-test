import type { Core } from "@strapi/strapi";
import { foldItemStates, isProposalItemKey, nextState, DECISION_REASON_MAX_LENGTH, type DecisionAction, type ProposalItemState } from "../../../csrm/ai/proposal-items";
import { AI_RUN_BOUNDS, appendAiRunDecisions, parseRunDecisionsFor, parseRunProposalFor } from "../../csrm-ai-run/services/ai-run-record";
import { isAnsweredValue, keepsControllerValues, preservesAnswers, type PreservationRow } from "./questionnaire-answer-preservation";
import { parseQuestionnaireDefinition, QuestionnaireDefinitionError, type QuestionnaireDefinitionQuestion } from "./questionnaire-definition";
import {
  appendQuestionEvent,
  assertQuestionnaireInAnalystReview,
  candidateQuestion,
  parseQuestionMutationPayload,
  questionOptions,
  QuestionnaireGovernanceError,
  validateDefinition,
  withQuestionnaireGovernanceLock,
  type GovernanceStrapi,
  type QuestionEventSource,
  type QuestionMutationPayload,
} from "./questionnaire-governance-workflow";
import { allocateQuestionKey, createBatchAllocation, placeAddition, type AdditionSection, type BatchAllocation } from "./questionnaire-placement";
import { fingerprintInput } from "./questionnaire-proposal-adapter";
import {
  isItemStale,
  questionFingerprint,
  QUESTIONNAIRE_PROPOSAL_OPERATIONS,
  type AppliedQuestion,
  type LiveQuestionnaire,
  type QuestionnaireDecisionEvent,
  type QuestionnaireProposalItem,
  type QuestionnaireProposalOperation,
  type QuestionSnapshot,
} from "./questionnaire-proposal-envelope";
import { proposalQuestionnaireState, QuestionnaireProposalWorkflowError, type ProposalWorkflowStrapi } from "./questionnaire-proposals-workflow";

/*
 * Phase 15 D-21 to D-26: the questionnaire decision operation, the questionnaire counterpart of Phase 12 D-24.
 *
 * A human Security Analyst sends 1 to 200 decisions, each naming a run, one of its items and an act: `accept` (shown as
 * "Confirm", optionally after editing the proposal), `reject` (with an optional reason) or `restore` (the Undo of
 * either). The batch is all or nothing. Every check and every change runs inside the questionnaire's governance lock,
 * in the leak-safe order of 15-RESEARCH §L, against an in-memory working copy of the questionnaire, so a decision sees
 * what the batch's earlier ones did; only when every decision has passed are the questions, the runs' decision logs and
 * the governance log written, in that one transaction.
 *
 * The rules it keeps:
 * - nothing changes the questionnaire until a confirmation, and a confirmation never writes an answer (D-04, D-22);
 * - accepting, and undoing an acceptance, need analyst review; that state rule is checked before staleness, so no
 *   refusal reveals a draft answer the Requestor is still writing (D-06, D-07; Pitfall 1);
 * - an item whose question moved since it was proposed is stale and can only be rejected (D-20, D-25);
 * - no result may change or hide an answered question (D-05 layer 3; QUES-12 criterion 2);
 * - an item's state is a fold of its run's append-only decision events, so superseded, lapsed or damaged items are
 *   refused as no longer open, and an identical repeat is a counted no-op that stores nothing (D-24).
 */

type Row = Record<string, unknown>;
type DecisionStrapi = ProposalWorkflowStrapi;

const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const QUESTION_UID = "api::csrm-question.csrm-question";
const RUN_UID = "api::csrm-ai-run.csrm-ai-run";

/** The most decisions one request may carry, equal to Phase 12's `AI_PROPOSAL_DECISION_BATCH_MAX`. */
export const QUESTIONNAIRE_DECISION_BATCH_MAX = 200;
const RUN_ID_MAX_LENGTH = 255;
const SECTION_KEY_MAX_LENGTH = 120;
const SECTION_TITLE_MAX_LENGTH = 255;

export type QuestionnaireDecisionEdits = {
  questionText?: string;
  helpText?: string | null;
  answerType?: QuestionMutationPayload["answerType"];
  choices?: Array<{ value: string; label: string }>;
  required?: boolean;
  /* An addition only. */
  section?: AdditionSection;
};

export type QuestionnaireProposalDecision = {
  runId: string;
  item: string;
  action: "accept" | "reject" | "restore";
  edits?: QuestionnaireDecisionEdits;
  reason?: string;
};

const DECISION_KEYS = ["runId", "item", "action", "edits", "reason"] as const;
const EDIT_KEYS = ["questionText", "helpText", "answerType", "choices", "required", "section"] as const;
const ACTIONS: readonly QuestionnaireProposalDecision["action"][] = ["accept", "reject", "restore"];
const ACTION_EVENT: Readonly<Record<QuestionnaireProposalDecision["action"], DecisionAction>> = Object.freeze({ accept: "accepted", reject: "rejected", restore: "restored" });

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value: Row, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;

const BODY_INVALID = "CSRM questionnaire AI proposal decision data is invalid.";
const invalid = (message = BODY_INVALID): never => { throw new QuestionnaireProposalWorkflowError(400, message); };
const conflict = (reason: NonNullable<QuestionnaireProposalWorkflowError["reason"]>, message: string): never => {
  throw new QuestionnaireProposalWorkflowError(409, message, reason);
};
const alreadyDecided = (): never => conflict("AI_PROPOSAL_ALREADY_DECIDED", "This AI proposal is no longer open.");
const stale = (): never => conflict("AI_PROPOSAL_STALE", "This AI proposal no longer matches the questionnaire.");
const answeredAffected = (): never => conflict("ANSWERED_QUESTION_AFFECTED", "This change would affect an answered question.");
const undoUnavailable = (): never => conflict("AI_PROPOSAL_UNDO_UNAVAILABLE", "This confirmation can no longer be undone.");

function parseSection(value: unknown): AdditionSection {
  if (!record(value)) return invalid();
  if (value.kind === "existing" && exact(value, ["kind", "key"]) && typeof value.key === "string" && value.key.trim().length > 0 && value.key.length <= SECTION_KEY_MAX_LENGTH) {
    return { kind: "existing", key: value.key };
  }
  if (value.kind === "new" && exact(value, ["kind", "title"]) && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= SECTION_TITLE_MAX_LENGTH) {
    return { kind: "new", title: value.title.trim() };
  }
  return invalid();
}

/* Each edited field is held to the manual edit's rule for that key (`parseQuestionMutationPayload`). */
function parseEdits(value: unknown): QuestionnaireDecisionEdits {
  if (!record(value) || Object.keys(value).length === 0 || !exact(value, EDIT_KEYS)) return invalid();
  const { section, ...fields } = value;
  let payload: QuestionMutationPayload = {};
  if (Object.keys(fields).length > 0) {
    try {
      payload = parseQuestionMutationPayload(fields, "edit");
    } catch (error) {
      if (error instanceof QuestionnaireGovernanceError) return invalid();
      throw error;
    }
  }
  return {
    ...(payload.questionText !== undefined ? { questionText: payload.questionText } : {}),
    ...(payload.helpText !== undefined ? { helpText: payload.helpText === "" ? null : payload.helpText } : {}),
    ...(payload.answerType !== undefined ? { answerType: payload.answerType } : {}),
    ...(payload.choices !== undefined ? { choices: payload.choices.map(({ value: choice, label }) => ({ value: choice.trim(), label: label.trim() })) } : {}),
    ...(payload.required !== undefined ? { required: payload.required } : {}),
    ...(section !== undefined ? { section: parseSection(section) } : {}),
  };
}

/**
 * The closed batch: `{ decisions: [{ runId, item, action, edits?, reason? }] }` with 1 to 200 decisions. `edits` only on
 * `accept` and `reason` (1 to 500 characters) only on `reject`. Anything else is a 400.
 */
export function parseQuestionnaireProposalDecisionBatch(body: unknown): QuestionnaireProposalDecision[] {
  if (!record(body) || !exact(body, ["decisions"]) || !Array.isArray(body.decisions)
    || body.decisions.length < 1 || body.decisions.length > QUESTIONNAIRE_DECISION_BATCH_MAX) return invalid();
  return body.decisions.map((raw: unknown): QuestionnaireProposalDecision => {
    if (!record(raw) || !exact(raw, DECISION_KEYS)) return invalid();
    const { runId, item, action } = raw;
    if (typeof runId !== "string" || runId.trim().length === 0 || runId.length > RUN_ID_MAX_LENGTH) return invalid();
    if (!isProposalItemKey(item)) return invalid();
    if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) return invalid();
    if (raw.edits !== undefined && action !== "accept") return invalid();
    if (raw.reason !== undefined && (action !== "reject" || typeof raw.reason !== "string" || raw.reason.trim().length === 0 || raw.reason.length > DECISION_REASON_MAX_LENGTH)) return invalid();
    return {
      runId, item, action: action as QuestionnaireProposalDecision["action"],
      ...(raw.edits !== undefined ? { edits: parseEdits(raw.edits) } : {}),
      ...(typeof raw.reason === "string" ? { reason: raw.reason.trim() } : {}),
    };
  });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The working copy
 * ------------------------------------------------------------------------------------------------------------------- */

/* One question as the batch sees it: its definition, its help text and its answer, and whether the batch created it. */
type WorkingRow = PreservationRow & { created: boolean };

type WorkingQuestionnaire = {
  generatedDate: string | null;
  rows: WorkingRow[];
  /* The rows as stored when the batch began, by documentId, to write only what changed. */
  stored: ReadonlyMap<string, string>;
  allocation: BatchAllocation | null;
  governanceLog: unknown;
  placeholders: number;
};

const blankToNull = (text: unknown): string | null => typeof text === "string" && text.trim().length > 0 ? text : null;

function rowKey(row: PreservationRow): string {
  return JSON.stringify([row.question.questionText, blankToNull(row.helpText), row.question.answerType, questionOptions(row.question)]);
}

function instant(value: unknown): string | null {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" && value.length > 0 ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function workingQuestionnaire(questionnaire: Row): WorkingQuestionnaire {
  let definition: QuestionnaireDefinitionQuestion[];
  try {
    definition = parseQuestionnaireDefinition(questionnaire.questions);
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) return conflict("DEFINITION_INVALID", "CSRM questionnaire definition is invalid.");
    throw error;
  }
  const helpTexts = new Map((Array.isArray(questionnaire.questions) ? questionnaire.questions : []).filter(record).map((row) => [row.documentId, row.helpText]));
  const rows: WorkingRow[] = definition.map((question) => ({ question, helpText: blankToNull(helpTexts.get(question.documentId)), answer: question.answer, created: false }));
  return {
    generatedDate: instant(questionnaire.generatedDate),
    rows,
    stored: new Map(rows.map((row) => [row.question.documentId, rowKey(row)])),
    allocation: null,
    governanceLog: questionnaire.governanceLog,
    placeholders: 0,
  };
}

function live(working: WorkingQuestionnaire): LiveQuestionnaire {
  return {
    generatedDate: working.generatedDate,
    questions: working.rows.map((row) => ({ ...fingerprintInput(row), documentId: row.question.documentId, questionKey: row.question.questionKey, answered: row.question.deleted === undefined && isAnsweredValue(row.answer) })),
  };
}

const fingerprintOf = (row: PreservationRow): string => questionFingerprint(fingerprintInput(row));

/*
 * The manual edit's definition check, then D-05 layer 3 on the working copy: every answered question survives, and every
 * dependent still reads a value its controller offers. The next rows replace the working copy only when all pass.
 */
function commitRows(working: WorkingQuestionnaire, next: WorkingRow[]): void {
  try {
    validateDefinition(next.map((row) => row.question));
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) conflict("DEFINITION_INVALID", "The questionnaire would no longer be valid with this change.");
    throw error;
  }
  if (!preservesAnswers(working.rows, next).ok || !keepsControllerValues(next).ok) answeredAffected();
  working.rows = next;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Runs
 * ------------------------------------------------------------------------------------------------------------------- */

type RunState = {
  runId: string;
  operation: QuestionnaireProposalOperation;
  items: ReadonlyMap<string, QuestionnaireProposalItem> | null;
  /* Null when the run is damaged: none of its items can be decided. */
  states: Map<string, ProposalItemState> | null;
  stored: readonly QuestionnaireDecisionEvent[];
  added: QuestionnaireDecisionEvent[];
};

const isProposalOperation = (value: unknown): value is QuestionnaireProposalOperation => (QUESTIONNAIRE_PROPOSAL_OPERATIONS as readonly unknown[]).includes(value);
const RUN_NOT_FOUND = "CSRM questionnaire AI proposal run was not found.";

/* Every named run exists, is completed, holds a proposal operation and belongs to this questionnaire, or the whole batch is a 404 (IDOR, T-15-24). */
async function loadRuns(strapi: DecisionStrapi, questionnaireId: string, runIds: readonly string[]): Promise<Map<string, RunState>> {
  const runs = new Map<string, RunState>();
  for (const runId of runIds) {
    if (runs.has(runId)) continue;
    const run = await strapi.documents(RUN_UID).findOne({ documentId: runId, populate: { questionnaire: { fields: ["documentId"] } } });
    if (!run || run.status !== "completed" || !isProposalOperation(run.operation) || relationId(run.questionnaire) !== questionnaireId) {
      throw new QuestionnaireProposalWorkflowError(404, RUN_NOT_FOUND);
    }
    const proposal = parseRunProposalFor(run.operation, run.proposal);
    const events = parseRunDecisionsFor(run.operation, run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    runs.set(runId, {
      runId, operation: run.operation,
      items: proposal ? new Map(proposal.items.map((item) => [item.key, item])) : null,
      states: states ? new Map(states) : null,
      stored: events ?? [],
      added: [],
    });
  }
  return runs;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Applying a confirmation
 * ------------------------------------------------------------------------------------------------------------------- */

type Context = { strapi: DecisionStrapi; questionnaire: Row; request: Row; analystId: string; now: Date; working: WorkingQuestionnaire };
type Applied = { applied: AppliedQuestion; before?: QuestionSnapshot; edits: string[] };

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

const isSelect = (answerType: string): boolean => answerType === "Single select" || answerType === "Multi select";

/* The edited field names whose value differs from the proposal's (the event's `edits`), in the closed field order. */
function editedFields(proposed: Row, edits: QuestionnaireDecisionEdits | undefined): string[] {
  if (!edits) return [];
  return EDIT_KEYS.filter((field) => edits[field] !== undefined && !sameValue(field === "helpText" ? blankToNull(edits.helpText) : edits[field], field === "helpText" ? blankToNull(proposed.helpText) : proposed[field]));
}

function source(runId: string, itemKey: string, edits: readonly string[], aiUndo?: true): QuestionEventSource {
  return { runId, itemKey, aiEdited: edits.length > 0, ...(aiUndo ? { aiUndo } : {}) };
}

function appendEvent(context: Context, kind: Parameters<typeof appendQuestionEvent>[1], row: PreservationRow, eventSource: QuestionEventSource): void {
  context.working.governanceLog = appendQuestionEvent({ governanceLog: context.working.governanceLog }, kind, row.question.questionKey, row.question.questionText, { now: context.now, actorDocumentId: context.analystId }, undefined, eventSource);
}

/* An addition: a new unanswered question at the end of its section, or first in a new section after the last (D-13, D-22). */
function applyAddition(context: Context, runId: string, item: Extract<QuestionnaireProposalItem, { kind: "add" }>, edits: QuestionnaireDecisionEdits | undefined): Applied {
  const { working } = context;
  working.allocation ??= createBatchAllocation(working.rows.map((row) => row.question));
  const section = edits?.section ?? item.proposed.section;
  const placement = placeAddition(working.allocation, section);
  if (!placement) return edits?.section ? invalid() : stale();
  const base: QuestionnaireDefinitionQuestion = {
    documentId: `pending-${(working.placeholders += 1)}`,
    questionText: item.proposed.questionText,
    answerType: item.proposed.answerType,
    questionKey: "pending",
    section: placement.section,
    order: placement.order,
    required: item.proposed.required,
    ...(item.proposed.visibility ? { visibility: { ...item.proposed.visibility } } : {}),
    ...(isSelect(item.proposed.answerType) && item.proposed.choices.length ? { choices: item.proposed.choices.map(({ value, label }) => ({ value, label })) } : {}),
    schemaVersion: 2,
    answer: null,
  };
  let question: QuestionnaireDefinitionQuestion;
  try {
    question = candidateQuestion(base, { questionText: edits?.questionText, answerType: edits?.answerType, required: edits?.required, choices: edits?.choices });
  } catch (error) {
    if (error instanceof QuestionnaireGovernanceError) return invalid();
    throw error;
  }
  question = { ...question, questionKey: allocateQuestionKey(question.questionText, working.allocation), answer: null };
  const row: WorkingRow = { question, helpText: blankToNull(edits?.helpText !== undefined ? edits.helpText : item.proposed.helpText), answer: null, created: true };
  commitRows(working, [...working.rows, row]);
  const changed = editedFields(item.proposed as unknown as Row, edits);
  appendEvent(context, "question-added", row, source(runId, item.key, changed));
  return { applied: { questionDocumentId: question.documentId, questionKey: question.questionKey, fingerprint: fingerprintOf(row) }, edits: changed };
}

/* The question a change or removal names, as the working copy holds it; staleness has already proved it active and unanswered. */
function targetRow(working: WorkingQuestionnaire, documentId: string): WorkingRow {
  return working.rows.find((row) => row.question.documentId === documentId) ?? stale();
}

function replaced(working: WorkingQuestionnaire, next: WorkingRow): WorkingRow[] {
  return working.rows.map((row) => row.question.documentId === next.question.documentId ? next : row);
}

/* The target as it was, on the accept of a change or removal: what its Undo writes back. */
function snapshotOf(row: PreservationRow): QuestionSnapshot {
  return { ...fingerprintInput(row), helpText: blankToNull(row.helpText), questionDocumentId: row.question.documentId, questionKey: row.question.questionKey };
}

/* The manual removal's rules (D-22): no active question may depend on it, and the questionnaire keeps an active question. */
function softRemoved(context: Context, row: WorkingRow): WorkingRow {
  const active = context.working.rows.filter((candidate) => candidate.question.deleted === undefined);
  if (active.some((candidate) => candidate.question.visibility?.questionKey === row.question.questionKey)) {
    conflict("QUESTION_HAS_DEPENDENTS", "This question cannot be removed while an active question depends on it.");
  }
  if (active.length <= 1) conflict("LAST_ACTIVE_QUESTION", "The questionnaire must keep at least one active question.");
  return { ...row, question: { ...row.question, schemaVersion: 2, deleted: { deletedAt: context.now.toISOString(), deletedBy: context.analystId } } };
}

/*
 * A change: the manual edit's candidate and validation (D-22), with the proposal's text, help text, type, choices and
 * required, overlaid by the analyst's edits; its section, order and visibility stay, and its answer is never written.
 */
function applyChange(context: Context, runId: string, item: Extract<QuestionnaireProposalItem, { kind: "change" }>, edits: QuestionnaireDecisionEdits | undefined): Applied {
  if (edits?.section) return invalid();
  const { working } = context;
  const row = targetRow(working, item.target.questionDocumentId);
  const { proposed } = item;
  const answerType = edits?.answerType ?? proposed.answerType;
  const proposedChoices = isSelect(proposed.answerType) && proposed.choices.length ? proposed.choices.map(({ value, label }) => ({ value, label })) : undefined;
  let question: QuestionnaireDefinitionQuestion;
  try {
    question = candidateQuestion(row.question, {
      questionText: edits?.questionText ?? proposed.questionText,
      answerType,
      required: edits?.required ?? proposed.required,
      choices: isSelect(answerType) ? edits?.choices ?? proposedChoices : undefined,
    });
  } catch (error) {
    if (error instanceof QuestionnaireGovernanceError) return invalid();
    throw error;
  }
  const next: WorkingRow = { ...row, question: { ...question, answer: row.answer }, helpText: blankToNull(edits?.helpText !== undefined ? edits.helpText : proposed.helpText) };
  commitRows(working, replaced(working, next));
  const changed = editedFields(proposed as unknown as Row, edits);
  appendEvent(context, "question-edited", next, source(runId, item.key, changed));
  return { applied: { questionDocumentId: question.documentId, questionKey: question.questionKey, fingerprint: fingerprintOf(next) }, before: snapshotOf(row), edits: changed };
}

/* A removal: the existing soft removal, with its dependency and last-question rules (D-22). */
function applyRemoval(context: Context, runId: string, item: Extract<QuestionnaireProposalItem, { kind: "remove" }>, edits: QuestionnaireDecisionEdits | undefined): Applied {
  if (edits) return invalid();
  const { working } = context;
  const row = targetRow(working, item.target.questionDocumentId);
  const next = softRemoved(context, row);
  commitRows(working, replaced(working, next));
  appendEvent(context, "question-deleted", row, source(runId, item.key, []));
  return { applied: { questionDocumentId: row.question.documentId, questionKey: row.question.questionKey, fingerprint: fingerprintOf(next) }, before: snapshotOf(row), edits: [] };
}

function applyAccept(context: Context, run: RunState, item: QuestionnaireProposalItem, decision: QuestionnaireProposalDecision): Applied {
  if (item.kind === "add") return applyAddition(context, run.runId, item, decision.edits);
  if (item.kind === "change") return applyChange(context, run.runId, item, decision.edits);
  return applyRemoval(context, run.runId, item, decision.edits);
}

/* The accept an Undo reverses: the item's latest accepted event, stored or written earlier in this batch. */
function latestAccepted(run: RunState, itemKey: string): QuestionnaireDecisionEvent | undefined {
  return [...run.stored, ...run.added].reverse().find((event) => event.item === itemKey && event.action === "accepted");
}

/*
 * The Undo of a confirmation (D-23): only while the question is exactly as the confirmation left it (its fingerprint
 * equals `applied.fingerprint`) and unanswered; otherwise AI_PROPOSAL_UNDO_UNAVAILABLE. An addition is soft-removed, a
 * change gets its `before` back, a removal is restored; each writes the reverse governance event with `aiUndo`.
 */
function applyUndo(context: Context, run: RunState, item: QuestionnaireProposalItem): AppliedQuestion {
  const { working } = context;
  const accepted = latestAccepted(run, item.key);
  const applied = accepted?.applied ?? undoUnavailable();
  const row = working.rows.find((candidate) => candidate.question.documentId === applied.questionDocumentId);
  if (!row || fingerprintOf(row) !== applied.fingerprint || isAnsweredValue(row.answer)) undoUnavailable();
  const current = row as WorkingRow;
  const undoSource = source(run.runId, item.key, accepted?.edits ?? [], true);
  if (item.kind === "add") {
    const next = softRemoved(context, current);
    commitRows(working, replaced(working, next));
    appendEvent(context, "question-deleted", current, undoSource);
  } else if (item.kind === "change") {
    const before = accepted?.before ?? undoUnavailable();
    let question: QuestionnaireDefinitionQuestion;
    try {
      question = candidateQuestion(current.question, {
        questionText: before.questionText,
        answerType: before.answerType,
        required: before.required,
        choices: before.choices ? before.choices.map(({ value, label }) => ({ value, label })) : undefined,
        visibility: before.visibility ? { ...before.visibility } : null,
      });
    } catch (error) {
      if (error instanceof QuestionnaireGovernanceError) return undoUnavailable();
      throw error;
    }
    const next: WorkingRow = { ...current, question: { ...question, answer: current.answer }, helpText: before.helpText };
    commitRows(working, replaced(working, next));
    appendEvent(context, "question-edited", next, undoSource);
  } else {
    const { deleted: _deleted, ...restored } = current.question;
    const next: WorkingRow = { ...current, question: restored };
    commitRows(working, replaced(working, next));
    appendEvent(context, "question-restored", next, undoSource);
  }
  return applied;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The operation
 * ------------------------------------------------------------------------------------------------------------------- */

export type DecideQuestionnaireAiProposalsInput = {
  strapi: DecisionStrapi;
  questionnaireId: string;
  /* The resolved IdamBox User's documentId, and whether the policy admitted them as a human Security Analyst (13-03). */
  analystDocumentId: string;
  humanAnalyst?: boolean;
  body: unknown;
  now?: Date;
};

function humanAnalyst(input: DecideQuestionnaireAiProposalsInput): string {
  if (input.humanAnalyst !== true || typeof input.analystDocumentId !== "string" || input.analystDocumentId.trim().length === 0) {
    throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposal decisions are denied.");
  }
  return input.analystDocumentId;
}

async function loadQuestionnaire(strapi: DecisionStrapi, questionnaireId: string): Promise<{ questionnaire: Row; request: Row } | null> {
  const questionnaire = await strapi.documents(QUESTIONNAIRE_UID).findOne({
    documentId: questionnaireId,
    populate: { questions: true, assessmentRequest: { populate: { assessment: true, requestor: { fields: ["documentId"] } } } },
  });
  const request = questionnaire && record(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  return questionnaire && request ? { questionnaire, request } : null;
}

const decisionEvent = (event: Omit<QuestionnaireDecisionEvent, "schemaVersion">): QuestionnaireDecisionEvent => ({ schemaVersion: 2, ...event }) as QuestionnaireDecisionEvent;

/* Accepting, or undoing an acceptance, needs analyst review (D-06, D-07); its refusal comes before any staleness check. */
function assertAnalystReview(context: Context): void {
  try {
    assertQuestionnaireInAnalystReview(context.questionnaire, context.request);
  } catch (error) {
    if (error instanceof QuestionnaireGovernanceError) throw new QuestionnaireProposalWorkflowError(error.status, error.message, error.reason);
    throw error;
  }
}

function decideOne(context: Context, runs: Map<string, RunState>, decision: QuestionnaireProposalDecision): "applied" | "unchanged" {
  const run = runs.get(decision.runId) as RunState;
  const item = run.items?.get(decision.item) as QuestionnaireProposalItem;
  const current = run.states?.get(decision.item);
  // 1. The state rule, before the fold and staleness (Pitfall 1).
  if (decision.action === "accept" || (decision.action === "restore" && current === "accepted")) assertAnalystReview(context);
  // 2. The fold: a damaged run, or an item no longer open, is refused; an identical repeat is a counted no-op.
  if (!run.states || current === undefined) return alreadyDecided();
  const next = nextState(current, ACTION_EVENT[decision.action], { withEdits: decision.edits !== undefined });
  if (next === "not-open") return alreadyDecided();
  if (next === "no-op") return "unchanged";
  const at = context.now.toISOString();
  const by = context.analystId;
  if (decision.action === "accept") {
    // 3. Staleness against the working copy, which holds the batch's earlier decisions (D-20, D-25).
    if (isItemStale(item, live(context.working))) stale();
    const outcome = applyAccept(context, run, item, decision);
    run.added.push(decisionEvent({ at, by, item: item.key, action: "accepted", ...(outcome.edits.length ? { edits: outcome.edits } : {}), ...(outcome.before ? { before: outcome.before } : {}), applied: outcome.applied }));
  } else if (decision.action === "reject") {
    // A rejection changes no question and writes no governance event (D-21).
    run.added.push(decisionEvent({ at, by, item: item.key, action: "rejected", ...(decision.reason ? { reason: decision.reason } : {}) }));
  } else if (current === "accepted") {
    const applied = applyUndo(context, run, item);
    run.added.push(decisionEvent({ at, by, item: item.key, action: "restored", applied }));
  } else {
    // The Undo of a rejection returns the item to open.
    run.added.push(decisionEvent({ at, by, item: item.key, action: "restored" }));
  }
  run.states.set(item.key, next);
  return "applied";
}

/* Writes the batch: created questions first (so `applied` can name them), then changed rows, the runs and the log. */
async function persist(context: Context, runs: Map<string, RunState>, questionnaireId: string): Promise<void> {
  // Check every run before the first question write: a capacity refusal leaves the entire batch untouched.
  for (const run of runs.values()) {
    if (run.stored.length + run.added.length > AI_RUN_BOUNDS.decisionEvents) {
      conflict("HISTORY_UNAVAILABLE", "The questionnaire’s change history cannot record this decision. Ask an administrator to repair the run history before trying again.");
    }
  }
  const { strapi, working } = context;
  const questions = strapi.documents(QUESTION_UID) as ReturnType<DecisionStrapi["documents"]> & { create?: (query: { data: Row }) => Promise<Row> };
  const created = new Map<string, string>();
  for (const row of working.rows) {
    const data = { questionText: row.question.questionText, helpText: row.helpText, answerType: row.question.answerType, options: questionOptions(row.question) };
    if (row.created) {
      if (!questions.create) throw new QuestionnaireProposalWorkflowError(409, "CSRM questionnaire question cannot be created.");
      const stored = await questions.create({ data: { ...data, answer: null, questionnaire: questionnaireId } });
      created.set(row.question.documentId, String(stored.documentId));
    } else if (working.stored.get(row.question.documentId) !== rowKey(row)) {
      // A decision never writes an answer: only the question's own fields.
      await questions.update({ documentId: row.question.documentId, data });
    }
  }
  const resolve = (event: QuestionnaireDecisionEvent): QuestionnaireDecisionEvent => {
    const applied = event.applied && created.has(event.applied.questionDocumentId) ? { ...event.applied, questionDocumentId: created.get(event.applied.questionDocumentId) as string } : event.applied;
    return applied === event.applied ? event : { ...event, applied };
  };
  for (const run of runs.values()) {
    if (run.added.length) await appendAiRunDecisions(strapi as unknown as Core.Strapi, run.runId, run.added.map(resolve));
  }
  await strapi.documents(QUESTIONNAIRE_UID).update({ documentId: questionnaireId, data: { governanceLog: working.governanceLog } });
}

/**
 * Decides AI proposals on one questionnaire, all or nothing (D-21). The check order (15-RESEARCH §L): the closed body
 * (400) → a human analyst (403) → the questionnaire exists (404) → the analyst did not raise the request (403
 * OWN_REQUEST) → then inside the governance lock: every named run is this questionnaire's completed proposal run (404 for
 * the batch) → every item is in its run's proposal (400) → no assessment (409 ASSESSMENT_STARTED) and no draft job (409
 * ASSESSMENT_DRAFT_IN_PROGRESS) → per decision in the order sent: the state rule, the fold, staleness, then the change
 * itself with the manual edit's validation and the answer-preservation checks.
 */
export async function decideQuestionnaireAiProposals(input: DecideQuestionnaireAiProposalsInput): Promise<{ applied: number; unchanged: number }> {
  const decisions = parseQuestionnaireProposalDecisionBatch(input.body);
  const analystId = humanAnalyst(input);
  const questionnaireId = input.questionnaireId;
  const loaded = typeof questionnaireId === "string" && questionnaireId ? await loadQuestionnaire(input.strapi, questionnaireId) : null;
  if (!loaded) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
  if (relationId(loaded.request.requestor) === analystId) {
    throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposal decisions are denied on a request you raised.", "OWN_REQUEST");
  }
  try {
    return await withQuestionnaireGovernanceLock(input.strapi as unknown as GovernanceStrapi, questionnaireId, async () => {
      const current = await loadQuestionnaire(input.strapi, questionnaireId);
      if (!current) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
      const runs = await loadRuns(input.strapi, questionnaireId, decisions.map(({ runId }) => runId));
      for (const decision of decisions) {
        const run = runs.get(decision.runId) as RunState;
        if (run.items && !run.items.has(decision.item)) invalid("The AI proposal item was not found in its run.");
      }
      const state = proposalQuestionnaireState(input.strapi, questionnaireId, current.questionnaire, current.request);
      if (state === "assessment-started") conflict("ASSESSMENT_STARTED", "Work on the assessment has started, so the questionnaire can no longer change.");
      if (state === "draft-in-progress") conflict("ASSESSMENT_DRAFT_IN_PROGRESS", "An assessment draft is being generated for this questionnaire.");
      const context: Context = { strapi: input.strapi, questionnaire: current.questionnaire, request: current.request, analystId, now: input.now ?? new Date(), working: workingQuestionnaire(current.questionnaire) };
      let applied = 0;
      let unchanged = 0;
      for (const decision of decisions) {
        if (decideOne(context, runs, decision) === "applied") applied += 1;
        else unchanged += 1;
      }
      if (applied > 0) await persist(context, runs, questionnaireId);
      return { applied, unchanged };
    });
  } catch (error) {
    // The governance helpers answer in their own error type; the decision operation answers in the proposals' one.
    if (error instanceof QuestionnaireGovernanceError) throw new QuestionnaireProposalWorkflowError(error.status, error.message, error.reason);
    throw error;
  }
}

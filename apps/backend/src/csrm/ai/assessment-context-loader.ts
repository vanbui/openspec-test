import { activeQuestionnaireDefinition, getVisibleQuestionKeys, isQuestionnaireValueValid, parseQuestionnaireDefinition, type QuestionnaireDefinitionQuestion, type QuestionnaireValue } from "../../api/csrm-questionnaire/services/questionnaire-definition";
import { isAnsweredValue } from "../../api/csrm-questionnaire/services/questionnaire-answer-preservation";
import { buildQuestionnaireProposalContext, type QuestionnaireContextOpenItem, type QuestionnaireContextQuestion, type QuestionnaireContextRejectedItem, type QuestionnaireProposalContextPart } from "../../api/csrm-questionnaire/services/questionnaire-proposal-context";
import { completedQuestionnaireProposalRuns } from "../../api/csrm-questionnaire/services/questionnaire-proposal-runs";
import type { QuestionnaireProposalItem, QuestionnaireProposalOperation } from "../../api/csrm-questionnaire/services/questionnaire-proposal-envelope";
import { parseRunDecisionsFor, parseRunProposalFor } from "../../api/csrm-ai-run/services/ai-run-record";
import type { InstructionSource, SlotInstruction } from "./analyst-instruction";
import { AssessmentContextTooLargeError, buildAssessmentContext, CONTEXT_BOUNDS, contextSourceRefs, resolveInstructionSteering, type AiRunOperation, type AssessmentContextRecords, type ContextAttachment, type ContextNote, type SubmittedQuestionAnswer } from "./assessment-context";
import { foldItemStates } from "./proposal-items";
import { ACTIVE_RISK_FILTER, WITHDRAWN_RISK_FILTER } from "../active-risk";
import { buildRiskProposalContextPart, RISK_CONTEXT_TOO_LARGE_MESSAGE, RISK_PROPOSAL_CONTEXT_BOUNDS, type RiskContextControl, type RiskContextRisk, type RiskContextSuggestion, type RiskProposalContextRecords } from "./risk-proposals/risk-proposal-context";
import type { RiskProposalOperation, RiskSuggestionItem } from "./risk-proposals/risk-proposal-envelope";
import type { FocusPart } from "./risk-proposals/field-units";
import { evaluateAiDataPolicy, readAiDataPolicyConfiguration } from "./data-policy";
import { ATTACHMENT_LIMITS, TEXT_BEARING_ATTACHMENT_TYPES } from "../files/attachment-policy";

type Row = Record<string, unknown>;
type DocumentService = { findOne: (options: Record<string, unknown>) => Promise<Row | null>; findMany: (options: Record<string, unknown>) => Promise<Row[]> };
export type AssessmentContextStrapi = { documents: (uid: string) => DocumentService; config: { get: (key: string) => unknown } };
const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);

export class QuestionnaireNotSubmittedError extends Error {
  readonly status = 409;
  constructor() { super("CSRM questionnaire is not submitted."); this.name = "QuestionnaireNotSubmittedError"; }
}

/* IN-105 (walk D11): questionnaire order, as the Requestor answered it: section order, then question order, then key. */
function inQuestionnaireOrder(left: QuestionnaireDefinitionQuestion, right: QuestionnaireDefinitionQuestion): number {
  return left.section.order - right.section.order || left.order - right.order || (left.questionKey < right.questionKey ? -1 : left.questionKey > right.questionKey ? 1 : 0);
}

export function submittedQuestionAnswers(questionnaire: Row): SubmittedQuestionAnswer[] {
  const definition = parseQuestionnaireDefinition(questionnaire.questions);
  const rawQuestions = new Map((Array.isArray(questionnaire.questions) ? questionnaire.questions : []).filter(record).map((question) => [question.documentId, question]));
  const active = activeQuestionnaireDefinition(definition);
  const envelopes = new Map(active.flatMap((question) => record(question.answer) ? [[question.questionKey, question.answer]] as const : []));
  const values = Object.fromEntries(active.map((question) => [question.questionKey, envelopes.get(question.questionKey)?.value ?? null])) as Record<string, QuestionnaireValue>;
  const visible = new Set(getVisibleQuestionKeys(definition, values));
  return active.filter((question) => visible.has(question.questionKey)).sort(inQuestionnaireOrder).map((question) => {
    const answer = envelopes.get(question.questionKey);
    if (!answer || answer.schemaVersion !== 1 || answer.state !== "submitted" || typeof answer.submittedAt !== "string"
      || !Number.isFinite(Date.parse(answer.submittedAt)) || !isQuestionnaireValueValid(question, answer.value)) throw new QuestionnaireNotSubmittedError();
    const value = answer.value as QuestionnaireValue;
    return { questionKey: question.questionKey, sectionTitle: question.section.title, questionText: question.questionText,
      helpText: typeof rawQuestions.get(question.documentId)?.helpText === "string" ? rawQuestions.get(question.documentId)!.helpText as string : "",
      answerType: question.answerType, value, answerLabel: answerLabelOf(question, value) };
  });
}

/* An answer as the AI reads it: choices by their labels, a Boolean as Yes or No, and an empty answer as "Not answered". */
function answerLabelOf(question: QuestionnaireDefinitionQuestion, value: QuestionnaireValue): string {
  const choiceLabel = (choice: string): string => question.choices?.find((item) => item.value === choice)?.label ?? choice;
  return value === null || value === "" || (Array.isArray(value) && value.length === 0) ? "Not answered"
    : typeof value === "boolean" ? value ? "Yes" : "No"
      : Array.isArray(value) ? value.map(choiceLabel).join("; ")
        : question.answerType === "Single select" ? choiceLabel(value) : value;
}

/* The questionnaire read's submitted-batch rule (questionnaire-scope.ts `projectQuestions`): a submitted envelope. */
const isSubmittedEnvelope = (answer: unknown): boolean => record(answer) && answer.state === "submitted" && typeof answer.submittedAt === "string";

/*
 * Phase 15 D-14 and D-30 (T-15-10): the questionnaire's questions as a proposal context reads them, active and removed, in
 * questionnaire order, each with the one answered rule's verdict (`isAnsweredValue`). Answer content is read only when
 * the whole active batch is submitted, the rule by which the analyst may read answers (`projectQuestions`), so a draft
 * answer, including one a return to analyst review turned back into a draft, never reaches a provider; and then only a
 * visible, valid answer, as the draft context reads them.
 */
export function questionnaireContextQuestions(questionnaire: Row): { questions: QuestionnaireContextQuestion[]; answerContent: "included" | "withheld" } {
  const definition = parseQuestionnaireDefinition(questionnaire.questions);
  const rawQuestions = new Map((Array.isArray(questionnaire.questions) ? questionnaire.questions : []).filter(record).map((question) => [question.documentId, question]));
  const active = activeQuestionnaireDefinition(definition);
  const values = Object.fromEntries(active.map((question) => [question.questionKey, record(question.answer) && question.answer.value !== undefined ? question.answer.value : null])) as Record<string, QuestionnaireValue>;
  const visible = new Set(getVisibleQuestionKeys(definition, values));
  const shown = active.filter((question) => visible.has(question.questionKey));
  const submittedBatch = shown.length > 0 && shown.every((question) => isSubmittedEnvelope(question.answer));
  const questions = [...definition].sort(inQuestionnaireOrder).map((question): QuestionnaireContextQuestion => {
    const removed = question.deleted !== undefined;
    const answered = !removed && isAnsweredValue(question.answer);
    const value = values[question.questionKey];
    const includeAnswer = submittedBatch && answered && visible.has(question.questionKey) && isQuestionnaireValueValid(question, value);
    const helpText = rawQuestions.get(question.documentId)?.helpText;
    return {
      documentId: question.documentId, questionKey: question.questionKey,
      section: { key: question.section.key, title: question.section.title, order: question.section.order }, order: question.order,
      questionText: question.questionText, helpText: typeof helpText === "string" && helpText.trim() ? helpText : null,
      answerType: question.answerType, choices: question.choices ?? null, required: question.required, visibility: question.visibility ?? null,
      removed, answered, ...(includeAnswer ? { answerLabel: answerLabelOf(question, value as QuestionnaireValue) } : {}),
    };
  });
  return { questions, answerContent: submittedBatch ? "included" : "withheld" };
}

const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const PROPOSAL_OPERATIONS: readonly QuestionnaireProposalOperation[] = ["questionnaire-proposals", "question-rewrite"];
/* A questionnaire holds at most 100 completed proposal runs (the amendment's run bound); one more is read, never more. */
export const QUESTIONNAIRE_PROPOSAL_RUNS_READ_LIMIT = 101;
const itemText = (item: QuestionnaireProposalItem): string => item.kind === "remove" ? item.target.textSnapshot : item.proposed.questionText;

/*
 * D-14: the questionnaire's proposal history from its completed runs of both operations: the items still open ("already
 * proposed") and the items the analyst rejected, with the reason and when (which ranks them and is never sent). Each run
 * is parsed by its operation and folded; a damaged run (a proposal or decisions that do not parse, or a fold that fails)
 * contributes nothing, the fail-safe direction for a context.
 */
export async function loadQuestionnaireProposalHistory(strapi: AssessmentContextStrapi, questionnaireId: string): Promise<{ openItems: QuestionnaireContextOpenItem[]; rejectedItems: QuestionnaireContextRejectedItem[] }> {
  const runs = await completedQuestionnaireProposalRuns(strapi, questionnaireId, {
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: [...PROPOSAL_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId", "operation", "proposal", "decisions", "completedAt"], sort: ["completedAt:asc", "id:asc"], limit: QUESTIONNAIRE_PROPOSAL_RUNS_READ_LIMIT,
  });
  const openItems: QuestionnaireContextOpenItem[] = [];
  const rejectedItems: QuestionnaireContextRejectedItem[] = [];
  for (const run of runs) {
    const operation = PROPOSAL_OPERATIONS.find((candidate) => candidate === run.operation);
    if (!operation) continue;
    const proposal = parseRunProposalFor(operation, run.proposal);
    const events = parseRunDecisionsFor(operation, run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    if (!proposal || !events || !states) continue;
    for (const item of proposal.items) {
      const state = states.get(item.key);
      if (state === "open") openItems.push({ kind: item.kind, questionText: itemText(item) });
      if (state === "rejected") {
        const rejection = [...events].reverse().find((event) => event.item === item.key && event.action === "rejected");
        rejectedItems.push({ kind: item.kind, questionText: itemText(item), reason: rejection?.reason ?? null, decidedAt: rejection?.at ?? "" });
      }
    }
  }
  return { openItems, rejectedItems };
}

const NOTE_UID = "api::csrm-request-note.csrm-request-note";
/*
 * How many marked notes' sequences a refusal reads: every note a request can hold, NOTES_PER_REQUEST_MAX in
 * request-notes-policy.ts (a unit test keeps the two equal). It is not imported: request-notes-policy reads
 * collection-scope, which reads the assessment workflow, which reads this loader, so the import would close a module
 * cycle in which the notes window's status set can be read before it is defined.
 */
export const MARKED_NOTE_SEQUENCES_READ_LIMIT = 500;
const NOTE_PARTS: readonly string[] = ["requestor", "security-analyst"];
const instant = (value: unknown): string | null => {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};
function contextNote(row: Row): ContextNote {
  const { documentId, authorPart, sequence, body } = row;
  const postedAt = instant(row.postedAt);
  if (typeof documentId !== "string" || !documentId || typeof authorPart !== "string" || !NOTE_PARTS.includes(authorPart) || typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1 || typeof body !== "string" || !postedAt) throw new Error("CSRM request note is invalid.");
  return { documentId, part: authorPart as ContextNote["part"], sequence, postedAt, body };
}

/*
 * Phase 13 D-27 (COLLAB-01 criterion 3; T-13-51): the request's notes currently marked as changing the AI inputs, and
 * no other, oldest first. One more than the bound is read, so more than 50 marked is refused before any run; the
 * refusal then names every marked note (a request holds at most 500), read by sequence alone. A note that cannot be
 * read as a marked note fails the context rather than being left out, so what reaches a provider is never silently
 * less than the analyst marked.
 */
export async function loadMarkedRequestNotes(strapi: AssessmentContextStrapi, requestId: string): Promise<ContextNote[]> {
  const filters = { assessmentRequest: { documentId: { $eq: requestId } }, changesAiInputs: { $eq: true } };
  const rows = await strapi.documents(NOTE_UID).findMany({ filters, fields: ["documentId", "authorPart", "sequence", "postedAt", "body"], sort: ["sequence:asc", "id:asc"], limit: CONTEXT_BOUNDS.markedNotes + 1 });
  if (rows.length > CONTEXT_BOUNDS.markedNotes) {
    const marked = await strapi.documents(NOTE_UID).findMany({ filters, fields: ["sequence"], sort: ["sequence:asc", "id:asc"], limit: MARKED_NOTE_SEQUENCES_READ_LIMIT });
    throw new AssessmentContextTooLargeError(marked.map(({ sequence }) => sequence).filter((sequence): sequence is number => typeof sequence === "number"));
  }
  return rows.map(contextNote);
}

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const ATTACHMENT_PARTS: readonly string[] = ["requestor", "security-analyst"];
const DIGEST = /^[a-f0-9]{64}$/;
const safeCount = (value: unknown, minimum: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;

/*
 * An included file read for the context: its stored text and the counts stored with it (14-09's aiTextFacts), checked
 * closed. A file that fails the check, a null or empty text included (IN-101), fails the context, named by its
 * documentId (never its name or text) when it has one. This module does not import the attachment projection, whose
 * rules read collection-scope, which reads the assessment workflow, which reads this loader (the module cycle
 * MARKED_NOTE_SEQUENCES_READ_LIMIT avoids).
 */
function contextAttachment(row: Row): ContextAttachment {
  const { documentId, fileType, uploaderPart, sha256, aiText, aiTextFacts } = row;
  const facts = record(aiTextFacts) ? aiTextFacts : {};
  const { available, kept, truncated } = facts;
  if (typeof documentId !== "string" || !documentId || typeof fileType !== "string" || !(TEXT_BEARING_ATTACHMENT_TYPES as readonly string[]).includes(fileType)
    || typeof uploaderPart !== "string" || !ATTACHMENT_PARTS.includes(uploaderPart) || typeof sha256 !== "string" || !DIGEST.test(sha256)
    || typeof aiText !== "string" || !aiText || !safeCount(available, 1) || !safeCount(kept, 1) || kept > ATTACHMENT_LIMITS.textCapCharacters || kept > available
    || typeof truncated !== "boolean" || truncated !== available > kept) {
    throw new Error(typeof documentId === "string" && documentId ? `CSRM request attachment ${documentId} is invalid.` : "CSRM request attachment is invalid.");
  }
  return { documentId, sha256, type: fileType as ContextAttachment["type"], part: uploaderPart as ContextAttachment["part"], text: aiText, kept, available, truncated };
}

/*
 * Phase 14 D-34 (COLLAB-02 criterion 5; T-14-38): the request's files a Security Analyst included in the AI inputs, and
 * no other: included, scanned clean and not removed, in upload order. The name is never read. An included file that
 * cannot be read as one fails the context rather than being left out, so what reaches a provider is never silently less
 * than the analyst included (Phase 13's marked-note rule). IN-101: the query does not filter on the stored text, so an
 * included file whose text is null fails here as an empty one does, and the signal, the counts and what is sent agree.
 */
export async function loadIncludedAttachments(strapi: AssessmentContextStrapi, requestId: string): Promise<ContextAttachment[]> {
  const rows = await strapi.documents(ATTACHMENT_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: requestId } }, aiTextIncluded: { $eq: true }, scanStatus: { $eq: "clean" }, removedAt: { $null: true } },
    fields: ["documentId", "fileType", "uploaderPart", "sha256", "aiText", "aiTextFacts"],
    sort: ["uploadedAt:asc", "id:asc"],
    limit: ATTACHMENT_LIMITS.maxActivePerRequest + 1,
  });
  // A request holds at most 20 active files, so more included than that is a damaged record, refused.
  if (rows.length > ATTACHMENT_LIMITS.maxActivePerRequest) throw new Error("CSRM request attachments are invalid.");
  return rows.map(contextAttachment);
}

/*
 * Phase 14 D-33 and D-35 (G-3): a run summary and a job failure keep files by documentId only. The analyst's reads name
 * them with what the attachment record says now, in one read: its current name, its request and whether it has been
 * removed since. A removed file still resolves (soft removal keeps the record); a file whose record is gone is absent.
 */
export type ResolvedContextAttachment = { fileName: string; requestId: string | null; removed: boolean };
export type ContextAttachmentReader = { documents: (uid: string) => { findMany: (options: Record<string, unknown>) => Promise<Row[]> } };
export async function resolveContextAttachments(strapi: ContextAttachmentReader, documentIds: readonly string[]): Promise<Map<string, ResolvedContextAttachment>> {
  const ids = [...new Set(documentIds.filter((id) => typeof id === "string" && id.length > 0))];
  const resolved = new Map<string, ResolvedContextAttachment>();
  if (ids.length === 0) return resolved;
  const rows = await strapi.documents(ATTACHMENT_UID).findMany({ filters: { documentId: { $in: ids } }, fields: ["documentId", "fileName", "removedAt"], populate: { assessmentRequest: { fields: ["documentId"] } }, limit: ids.length });
  for (const row of rows) {
    if (typeof row.documentId !== "string" || typeof row.fileName !== "string" || !row.fileName) continue;
    const request = record(row.assessmentRequest) && typeof row.assessmentRequest.documentId === "string" ? row.assessmentRequest.documentId : null;
    resolved.set(row.documentId, { fileName: row.fileName, requestId: request, removed: row.removedAt !== null && row.removedAt !== undefined });
  }
  return resolved;
}
/** The documentIds a failure names, when it is the context-too-large failure that names files (D-33); else none. */
export function failureAttachmentIds(failure: { code: string; attachmentDocumentIds?: readonly string[] } | undefined): readonly string[] {
  return failure?.code === "CONTEXT_TOO_LARGE" && Array.isArray(failure.attachmentDocumentIds) ? failure.attachmentDocumentIds : [];
}
/*
 * D-33: a job's analyst projection names the files its CONTEXT_TOO_LARGE failure counted, in upload order, by their
 * current names (null when the record is gone), so the analyst can exclude some; any other job carries no key.
 */
export function failureAttachmentsEntry(failure: { code: string; attachmentDocumentIds?: readonly string[] } | undefined, names: ReadonlyMap<string, ResolvedContextAttachment>): { failureAttachments?: { documentId: string; fileName: string | null }[] } {
  const ids = failureAttachmentIds(failure);
  return ids.length ? { failureAttachments: ids.map((documentId) => ({ documentId, fileName: names.get(documentId)?.fileName ?? null })) } : {};
}

/*
 * Phase 16 D-25: a risk proposal run sends the submitted answers as the draft did. It reads them from the request's
 * questionnaire only when its whole active batch is submitted (the draft's rule); otherwise it sends none, the
 * fail-safe direction, so a draft answer never reaches a provider and the summary counts no question.
 */
async function riskProposalAnswers(strapi: AssessmentContextStrapi, requestId: string): Promise<SubmittedQuestionAnswer[]> {
  const [questionnaire] = await strapi.documents(QUESTIONNAIRE_UID).findMany({ filters: { assessmentRequest: { documentId: { $eq: requestId } } }, populate: { questions: true }, limit: 1 });
  if (!questionnaire) return [];
  try { return submittedQuestionAnswers(questionnaire); }
  catch (error) { if (error instanceof QuestionnaireNotSubmittedError) return []; throw error; }
}

export async function loadAssessmentContextRecords(strapi: AssessmentContextStrapi, input: { operation: AiRunOperation; requestId: string; questionnaireId?: string }): Promise<AssessmentContextRecords> {
  const request = await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").findOne({ documentId: input.requestId, populate: { informationSystems: true, informationAssets: true } });
  if (!request) throw new Error("CSRM assessment request was not found.");
  const systems = Array.isArray(request.informationSystems) ? request.informationSystems.filter(record) : [];
  const assets = Array.isArray(request.informationAssets) ? request.informationAssets.filter(record) : [];
  const riskTypes = await strapi.documents("api::csrm-risk-type.csrm-risk-type").findMany({ populate: { applicableControls: true }, limit: 5_000 });
  let answers: SubmittedQuestionAnswer[] = [];
  let controls: Row[] = [];
  if (input.operation === "assessment-draft") {
    if (!input.questionnaireId) throw new Error("CSRM questionnaire identifier is required.");
    const questionnaire = await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").findOne({ documentId: input.questionnaireId, populate: { questions: true } });
    if (!questionnaire) throw new Error("CSRM questionnaire was not found.");
    answers = submittedQuestionAnswers(questionnaire);
    controls = await strapi.documents("api::csrm-control.csrm-control").findMany({ limit: 5_000 });
  }
  if (isRiskProposalOperation(input.operation)) {
    answers = await riskProposalAnswers(strapi, input.requestId);
    // D-30: suggested risks carry suggested controls from the bounded candidates, as drafted ones do.
    if (input.operation === "risk-suggestions") controls = await strapi.documents("api::csrm-control.csrm-control").findMany({ limit: 5_000 });
  }
  const notes = await loadMarkedRequestNotes(strapi, input.requestId);
  const attachments = await loadIncludedAttachments(strapi, input.requestId);
  return { request, systems, assets, riskTypes, controls, answers, notes, attachments };
}

/*
 * What a proposal or rewrite context was built from (15-06): the questionnaire row as the loader read it (its questions
 * with their stored answers, removed ones included), its questions as the context reads them, and the open and rejected
 * items it listed. The job builds the adapter's context from exactly these, so the adapter checks the model's output
 * against the questionnaire the model saw (15-05).
 */
export type QuestionnaireProposalSource = {
  questionnaire: Row;
  questions: QuestionnaireContextQuestion[];
  openItems: QuestionnaireContextOpenItem[];
  rejectedItems: QuestionnaireContextRejectedItem[];
};

/*
 * Phase 15 D-14: the questionnaire part of a proposal or rewrite context, read from the questionnaire (which must be the
 * request's), its questions and, for proposals, its proposal history. The sources it offers beside the questionnaire are
 * the request fields, marked notes and included files the context sends.
 */
async function loadQuestionnaireProposalPart(strapi: AssessmentContextStrapi, input: BuildAssessmentContextForInput, records: AssessmentContextRecords, instructionSource: InstructionSource | null): Promise<{ part: QuestionnaireProposalContextPart; source: QuestionnaireProposalSource }> {
  if (!input.questionnaireId) throw new Error("CSRM questionnaire identifier is required.");
  const questionnaire = await strapi.documents(QUESTIONNAIRE_UID).findOne({ documentId: input.questionnaireId, populate: { questions: true, assessmentRequest: { fields: ["documentId"] } } });
  if (!questionnaire) throw new Error("CSRM questionnaire was not found.");
  if (!record(questionnaire.assessmentRequest) || questionnaire.assessmentRequest.documentId !== input.requestId) throw new Error("CSRM questionnaire does not belong to the request.");
  const { questions, answerContent } = questionnaireContextQuestions(questionnaire);
  const rewrite = input.operation === "question-rewrite";
  if (rewrite && !input.targetQuestionId) throw new Error("CSRM questionnaire rewrite target is required.");
  const history: { openItems: QuestionnaireContextOpenItem[]; rejectedItems: QuestionnaireContextRejectedItem[] } = rewrite ? { openItems: [], rejectedItems: [] } : await loadQuestionnaireProposalHistory(strapi, input.questionnaireId);
  const part = buildQuestionnaireProposalContext({
    scope: rewrite ? "question" : "questionnaire", ...(rewrite ? { targetQuestionDocumentId: input.targetQuestionId } : {}),
    questions, answerContent, ...history, instructionSource, contextSourceRefs: contextSourceRefs(records),
  });
  part.summary.answerSources = [...part.allowed.refs]
    .filter(([ref]) => part.allowed.sourceRefs.has(ref))
    .map(([ref, questionDocumentId]) => ({ ref, questionDocumentId }));
  return { part, source: { questionnaire, questions, ...history } };
}

/*
 * The context for one AI operation. Phase 15 (D-12, D-14, D-17): questionnaire generation and the two questionnaire
 * proposal operations take the analyst's validated instruction (or, for a rewrite, CSRM's preset by default) and its
 * source; the two proposal operations read the questionnaire part. A questionnaire proposals context sends the request
 * part, the selected systems and assets and the Risk Type library; a rewrite sends the request part only, with no systems,
 * assets or Risk Type library, while the data policy still reads the request's assets. Both send the marked notes and the
 * included files.
 */
const RISK_UID = "api::csrm-risk.csrm-risk";
const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";
const RISK_PROPOSAL_OPERATIONS: readonly string[] = ["risk-suggestions", "risk-rewrite"];
const isRiskProposalOperation = (operation: unknown): operation is RiskProposalOperation => typeof operation === "string" && RISK_PROPOSAL_OPERATIONS.includes(operation);
const RISK_LIST_FIELDS = ["documentId", "riskStatement", "riskCause", "withdrawnAt", "withdrawalReason"] as const;
const RISK_LIST_POPULATE = { riskType: { fields: ["documentId", "name"] }, informationSystemImpacted: { fields: ["documentId"] }, informationAssetImpacted: { fields: ["documentId"] } } as const;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const relationId = (value: unknown): string | null => record(value) && typeof value.documentId === "string" && value.documentId ? value.documentId : null;

/** A Risk row as a risk proposal context lists it: by documentId, its Risk Type by name, its system and asset by documentId. */
export function riskContextRisk(row: Row): RiskContextRisk {
  if (typeof row.documentId !== "string" || !row.documentId) throw new Error("CSRM risk is invalid.");
  return {
    documentId: row.documentId,
    riskTypeName: record(row.riskType) && typeof row.riskType.name === "string" && row.riskType.name.trim() ? row.riskType.name.trim() : null,
    riskStatement: text(row.riskStatement), riskCause: text(row.riskCause),
    informationSystem: relationId(row.informationSystemImpacted), informationAsset: relationId(row.informationAssetImpacted),
    withdrawalReason: text(row.withdrawalReason),
  };
}

/*
 * D-31: the assessment's earlier suggestions from its completed `risk-suggestions` runs, oldest first: those the analyst
 * rejected (with the reason of the rejection that decided them) and those still open. Each run is parsed by its operation
 * and folded; a damaged run contributes nothing, the fail-safe direction for a context. At most 101 runs are read: more
 * than the amendment's bound of 100 cannot be listed whole, so the context is refused rather than truncated.
 */
export async function loadDecidedRiskSuggestions(strapi: AssessmentContextStrapi, assessmentId: string): Promise<{ rejected: RiskContextSuggestion[]; open: RiskContextSuggestion[] }> {
  const runs = await strapi.documents(RUN_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentId } }, operation: { $eq: "risk-suggestions" }, status: { $eq: "completed" } },
    fields: ["documentId", "operation", "proposal", "decisions", "completedAt"], sort: ["completedAt:asc", "id:asc"], limit: RISK_PROPOSAL_CONTEXT_BOUNDS.runsRead,
  });
  if (runs.length >= RISK_PROPOSAL_CONTEXT_BOUNDS.runsRead) throw new AssessmentContextTooLargeError([], [], RISK_CONTEXT_TOO_LARGE_MESSAGE);
  const rejected: RiskContextSuggestion[] = [];
  const open: RiskContextSuggestion[] = [];
  for (const run of runs) {
    if (typeof run.documentId !== "string" || run.operation !== "risk-suggestions") continue;
    const proposal = parseRunProposalFor("risk-suggestions", run.proposal);
    const events = parseRunDecisionsFor("risk-suggestions", run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    if (!proposal || !events || !states) continue;
    for (const item of proposal.items as readonly RiskSuggestionItem[]) {
      const state = states.get(item.key);
      const entry = { runId: run.documentId, itemKey: item.key, riskTypeName: item.proposed.riskTypeName, riskStatement: item.proposed.riskStatement, riskCause: item.proposed.riskCause };
      if (state === "open") open.push({ ...entry, reason: null });
      if (state === "rejected") {
        const rejection = [...events].reverse().find((event) => event.item === item.key && event.action === "rejected");
        rejected.push({ ...entry, reason: rejection?.reason ?? null });
      }
    }
  }
  return { rejected, open };
}

/*
 * Phase 16 D-31 and D-35: what a risk proposal context lists, read with bounded reads. The assessment must be the
 * request's. Suggestions read the active Risks, the withdrawn Risks with their reasons (each through its own form of the
 * active-risk rule, D-13) and the decided suggestions; a rewrite reads the active Risks and its target with its control
 * implementations, refusing a target that is withdrawn or not the assessment's (the start refuses these first). One
 * more than the entry bound is read, so an over-long list is refused, never truncated.
 */
export async function loadRiskProposalRecords(strapi: AssessmentContextStrapi, input: BuildAssessmentContextForInput, records: AssessmentContextRecords): Promise<RiskProposalContextRecords> {
  const operation = input.operation;
  if (!isRiskProposalOperation(operation)) throw new Error("CSRM risk proposal operation is required.");
  if (!input.assessmentId) throw new Error("CSRM assessment identifier is required.");
  const assessment = await strapi.documents(ASSESSMENT_UID).findOne({ documentId: input.assessmentId, populate: { assessmentRequest: { fields: ["documentId"] } } });
  if (!assessment) throw new Error("CSRM assessment was not found.");
  if (relationId(assessment.assessmentRequest) !== input.requestId) throw new Error("CSRM assessment does not belong to the request.");
  const limit = RISK_PROPOSAL_CONTEXT_BOUNDS.entries + 1;
  const ofAssessment = { assessment: { documentId: { $eq: input.assessmentId } } };
  // A rewrite lists the active Risks other than its target, so one more row is read: its target may be among them (BE2-06).
  const activeLimit = operation === "risk-rewrite" ? limit + 1 : limit;
  const active = await strapi.documents(RISK_UID).findMany({ filters: { ...ofAssessment, ...ACTIVE_RISK_FILTER }, fields: [...RISK_LIST_FIELDS], populate: RISK_LIST_POPULATE, sort: ["id:asc"], limit: activeLimit });
  const base = { operation, systems: records.systems, assets: records.assets, activeRisks: active.map(riskContextRisk) };
  if (operation === "risk-suggestions") {
    const withdrawn = await strapi.documents(RISK_UID).findMany({ filters: { ...ofAssessment, ...WITHDRAWN_RISK_FILTER }, fields: [...RISK_LIST_FIELDS], populate: RISK_LIST_POPULATE, sort: ["id:asc"], limit });
    const decided = await loadDecidedRiskSuggestions(strapi, input.assessmentId);
    return { ...base, withdrawnRisks: withdrawn.map(riskContextRisk), rejectedSuggestions: decided.rejected, openSuggestions: decided.open, target: null, focus: null };
  }
  if (!input.targetRiskId) throw new Error("CSRM risk rewrite target is required.");
  const target = await strapi.documents(RISK_UID).findOne({
    documentId: input.targetRiskId,
    populate: { riskType: { fields: ["documentId", "name"] }, informationSystemImpacted: { fields: ["documentId", "name"] }, informationAssetImpacted: { fields: ["documentId", "name"] }, assessment: { fields: ["documentId"] }, controlImplementations: { fields: ["controlStatus"], populate: { control: { fields: ["controlNumber", "name"] } } } },
  });
  if (!target || relationId(target.assessment) !== input.assessmentId) throw new Error("CSRM risk rewrite target was not found.");
  if (target.withdrawnAt !== null && target.withdrawnAt !== undefined) throw new Error("CSRM risk rewrite target is withdrawn.");
  const implementations = Array.isArray(target.controlImplementations) ? target.controlImplementations.filter(record) : [];
  const controls: RiskContextControl[] = implementations.map((implementation) => {
    const control = record(implementation.control) ? implementation.control : {};
    return { controlNumber: typeof control.controlNumber === "string" ? control.controlNumber : "", name: typeof control.name === "string" ? control.name : "", status: typeof implementation.controlStatus === "string" ? implementation.controlStatus : null };
  });
  return { ...base, withdrawnRisks: [], rejectedSuggestions: [], openSuggestions: [], target: { risk: target, controls }, focus: input.focus ?? null };
}

/*
 * BE2-05 (T-16-26, Phase 12 D-28, G-3): a risk proposal context sends Risk content, so the AI data policy weighs the
 * classification of each Risk the context lists, its own and its linked asset's, beside the request's assets. The
 * suggestions context lists the active and the withdrawn Risks; a rewrite lists the active ones, its target among them.
 * The read covers every Risk a context that is sent can list (more is refused as CONTEXT_TOO_LARGE before any call).
 */
export async function loadRiskProposalClassifications(strapi: AssessmentContextStrapi, input: { assessmentId: string; operation: RiskProposalOperation }): Promise<Array<{ dataClassification?: unknown }>> {
  const risks = await strapi.documents(RISK_UID).findMany({
    filters: { assessment: { documentId: { $eq: input.assessmentId } }, ...(input.operation === "risk-rewrite" ? ACTIVE_RISK_FILTER : {}) },
    fields: ["dataClassification"],
    populate: { informationAssetImpacted: { fields: ["dataClassification"] } },
    sort: ["id:asc"],
    limit: 2 * (RISK_PROPOSAL_CONTEXT_BOUNDS.entries + 1),
  });
  return risks.flatMap((risk) => [
    { dataClassification: risk.dataClassification },
    ...(record(risk.informationAssetImpacted) ? [{ dataClassification: risk.informationAssetImpacted.dataClassification }] : []),
  ]);
}

/*
 * The context for one AI operation. Phase 15 (D-12, D-14, D-17): questionnaire generation and the two questionnaire
 * proposal operations take the analyst's validated instruction (or, for a rewrite, CSRM's preset by default) and its
 * source; the two proposal operations read the questionnaire part. Phase 16 (D-25, D-31, D-35): the two risk proposal
 * operations take the analyst's instruction or the default task, send the request part, the submitted answers, the
 * marked notes and the included files as the draft does, and read the risk part (`riskSource`: what the adapter checks
 * the model's output against). A rewrite's `focus` narrows the units it keeps.
 */
export type BuildAssessmentContextForInput = { operation: AiRunOperation; requestId: string; questionnaireId?: string; targetQuestionId?: string; assessmentId?: string; targetRiskId?: string; focus?: readonly FocusPart[] | null; instruction?: SlotInstruction | null; instructionSource?: InstructionSource | null };
export async function buildAssessmentContextFor(strapi: AssessmentContextStrapi, input: BuildAssessmentContextForInput) {
  const records = await loadAssessmentContextRecords(strapi, input);
  const riskClassifications = isRiskProposalOperation(input.operation) && input.assessmentId
    ? await loadRiskProposalClassifications(strapi, { assessmentId: input.assessmentId, operation: input.operation })
    : [];
  const policy = evaluateAiDataPolicy({ assets: [...records.assets, ...riskClassifications], ...readAiDataPolicyConfiguration(strapi) });
  const steering = resolveInstructionSteering(input.operation, input.instruction ?? null, input.instructionSource ?? null);
  const proposal = input.operation === "questionnaire-proposals" || input.operation === "question-rewrite";
  const loaded = proposal ? await loadQuestionnaireProposalPart(strapi, input, records, steering.source) : undefined;
  const riskSource = isRiskProposalOperation(input.operation) ? await loadRiskProposalRecords(strapi, input, records) : undefined;
  const riskPart = riskSource ? buildRiskProposalContextPart(riskSource) : undefined;
  const sent = input.operation === "question-rewrite" ? { ...records, systems: [], assets: [] } : records;
  const context = buildAssessmentContext(sent, { operation: input.operation, policy, instruction: steering.instruction, instructionSource: steering.source, ...(loaded ? { questionnaire: loaded.part } : {}), ...(riskPart ? { riskProposals: riskPart } : {}) });
  return { context, policy, records, steering, ...(loaded ? { questionnaireSource: loaded.source } : {}), ...(riskSource ? { riskSource } : {}) };
}

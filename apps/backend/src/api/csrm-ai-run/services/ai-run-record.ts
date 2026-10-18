import type { Core } from "@strapi/strapi";
import { ATTACHMENT_CONTEXT_BOUNDS, CONTEXT_BOUNDS, QUESTIONNAIRE_CONTEXT_BOUNDS, type AiRunOperation, type ContextSummary, type ContextSummaryAttachments, type ContextSummaryInstruction, type ContextSummaryNotes, type ContextSummaryQuestionnaire, type ContextSummaryRead, type ContextSummaryRiskProposals, type ContextSummaryV1, type ContextSummaryV2, type ContextSummaryV3, type ContextSummaryV4 } from "../../../csrm/ai/assessment-context";
import { DATA_CLASSIFICATIONS } from "../../../csrm/ai/data-policy";
import { ATTACHMENT_LIMITS, TEXT_BEARING_ATTACHMENT_TYPES } from "../../../csrm/files/attachment-policy";
import { parseQuestionnaireDecisionEvents, parseQuestionnaireProposal, QUESTIONNAIRE_PROPOSAL_OPERATIONS, type QuestionnaireDecisionEvent, type QuestionnaireProposalOperation, type QuestionnaireProposalV1 } from "../../csrm-questionnaire/services/questionnaire-proposal-envelope";
import { isRiskSuggestionKey, parseRiskDecisionEvents, parseRiskProposal, RISK_PROPOSAL_OPERATIONS, type RiskDecisionEvent, type RiskProposalOperation, type RiskProposalV1 } from "../../../csrm/ai/risk-proposals/risk-proposal-envelope";
import { aiRunCreatedItem } from "../../csrm-risk-history-event/services/risk-history";
import { FOCUS_PARTS } from "../../../csrm/ai/risk-proposals/field-units";

/* Phase 16 D-25 (the approved Phase 16 amendment): "Suggest more risks" and "Rewrite this risk" join the closed vocabulary. */
export const AI_RUN_OPERATIONS = ["questionnaire-generation", "assessment-draft", "questionnaire-proposals", "question-rewrite", "risk-suggestions", "risk-rewrite"] as const satisfies readonly AiRunOperation[];
export const AI_RUN_STATUSES = ["running", "completed", "failed", "interrupted"] as const;
// WR-104: the context builder refuses a summary over its bound as CONTEXT_TOO_LARGE, so both read the one bound.
export const AI_RUN_BOUNDS = { contextSummaryBytes: CONTEXT_BOUNDS.summaryBytes, proposalBytes: 1_048_576, decisionEvents: 5_000 } as const;
const UID = "api::csrm-ai-run.csrm-ai-run";
type Row = Record<string, unknown>;
type RunDocument = Row & { documentId: string };
type RunDocuments = {
  create: (input: { data: Row }) => Promise<RunDocument>;
  findOne: (input: { documentId: string; populate?: Row }) => Promise<RunDocument | null>;
  findMany: (input: Row) => Promise<RunDocument[]>;
  update: (input: { documentId: string; data: Row }) => Promise<RunDocument>;
};
const documents = (strapi: Core.Strapi): RunDocuments => (strapi.documents as unknown as (uid: string) => RunDocuments)(UID);
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Row, required: readonly string[], optional: readonly string[] = []): boolean => required.every((key) => key in value) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const string = (value: unknown, max = 255): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const instant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const stringArray = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every((item) => string(item, 300));
function byteSize(value: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
  catch { return Number.POSITIVE_INFINITY; }
}

export class AiRunRecordError extends Error {
  readonly status = 409;
  readonly safeMessage = "The run record could not be updated.";
  constructor() { super("AI_RUN_RECORD_INVALID"); this.name = "AiRunRecordError"; }
}

const SUMMARY_V1_KEYS = ["schemaVersion", "operation", "request", "questions", "systems", "assets", "riskTypes", "controlCandidates", "classification", "characters", "budget", "digest"] as const;
const NOTE_PARTS: readonly unknown[] = ["requestor", "security-analyst"];
/* A v1 summary was written before notes reached the context (Phase 13 D-28), so it reads as having included none. */
const NO_NOTES = (): ContextSummaryNotes => ({ included: [], marked: 0, bound: CONTEXT_BOUNDS.markedNotes });
/*
 * Phase 13 D-28 (G-3; T-13-52): the notes section, closed. Each included note is named by its documentId, part, sequence,
 * posting time and length, never its text, so an entry carrying any other key (a `body`) is refused, as is a section
 * holding more notes than the bound or than were marked.
 */
function parseSummaryNotes(value: unknown): ContextSummaryNotes | null {
  if (!record(value) || !keys(value, ["included", "marked", "bound"]) || value.bound !== CONTEXT_BOUNDS.markedNotes || !count(value.marked) || value.marked > CONTEXT_BOUNDS.markedNotes) return null;
  const included = value.included;
  if (!Array.isArray(included) || included.length > value.marked) return null;
  if (!included.every((note) => record(note) && keys(note, ["documentId", "part", "sequence", "postedAt", "characters"]) && string(note.documentId) && NOTE_PARTS.includes(note.part) && count(note.sequence) && note.sequence > 0 && instant(note.postedAt) && count(note.characters))) return null;
  return value as ContextSummaryNotes;
}

/* A v1 or v2 summary was written before files reached the context (Phase 14 D-35), so it reads as having included none. */
const NO_ATTACHMENTS = (operation: AiRunOperation): ContextSummaryAttachments => ({ included: [], bound: ATTACHMENT_CONTEXT_BOUNDS[operation] });
const ATTACHMENT_ENTRY_KEYS = ["documentId", "sha256", "type", "part", "charactersSent", "charactersAvailable", "truncated"] as const;
/*
 * Phase 14 D-35 (G-3; T-14-39): the attachments section, closed. Each included file is named by its documentId, digest,
 * type, part and counts, never its text or its name, so an entry carrying any other key (a `text`, a `fileName`) is
 * refused, as is a section whose bound is not its operation's, that names a file twice, holds more files than a request
 * can, or sends more characters than its bound.
 */
function parseSummaryAttachments(value: unknown, operation: AiRunOperation): ContextSummaryAttachments | null {
  if (!record(value) || !keys(value, ["included", "bound"]) || value.bound !== ATTACHMENT_CONTEXT_BOUNDS[operation]) return null;
  const included = value.included;
  if (!Array.isArray(included) || included.length > ATTACHMENT_LIMITS.maxActivePerRequest) return null;
  const seen = new Set<string>();
  let sent = 0;
  for (const entry of included) {
    if (!record(entry) || !keys(entry, ATTACHMENT_ENTRY_KEYS) || !string(entry.documentId) || seen.has(entry.documentId) || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !(TEXT_BEARING_ATTACHMENT_TYPES as readonly unknown[]).includes(entry.type) || !NOTE_PARTS.includes(entry.part)
      || !count(entry.charactersSent) || entry.charactersSent > ATTACHMENT_LIMITS.textCapCharacters || !count(entry.charactersAvailable) || entry.charactersSent > entry.charactersAvailable
      || entry.truncated !== entry.charactersSent < entry.charactersAvailable) return null;
    seen.add(entry.documentId);
    sent += entry.charactersSent;
  }
  return sent <= ATTACHMENT_CONTEXT_BOUNDS[operation] ? value as ContextSummaryAttachments : null;
}

const isQuestionnaireProposalOperation = (operation: unknown): operation is QuestionnaireProposalOperation => (QUESTIONNAIRE_PROPOSAL_OPERATIONS as readonly unknown[]).includes(operation);
/*
 * Phase 15 D-14 and D-19 (G-3; the approved amendment): the questionnaire section, closed, counts and closed values only.
 * It is set exactly for the two questionnaire proposal operations, its scope agrees with the operation (a rewrite is
 * question-scoped and sends no answers), and every list count is within its bound. Undefined means malformed.
 */
function parseSummaryQuestionnaire(value: unknown, operation: AiRunOperation): ContextSummaryQuestionnaire | null | undefined {
  if (!isQuestionnaireProposalOperation(operation)) return value === null ? null : undefined;
  if (!record(value) || !keys(value, ["scope", "questionsOffered", "answered", "answerContent", "openItemsListed", "rejectedItemsListed", "rejectedItemsTotal", "removedListed"], ["answerSources"])) return undefined;
  const scope = operation === "question-rewrite" ? "question" : "questionnaire";
  if (value.scope !== scope || !["included", "withheld"].includes(value.answerContent as string) || (scope === "question" && value.answerContent !== "withheld")) return undefined;
  const { questionsOffered, answered, openItemsListed, rejectedItemsListed, rejectedItemsTotal, removedListed } = value;
  if (!count(questionsOffered) || questionsOffered > QUESTIONNAIRE_CONTEXT_BOUNDS.activeQuestions || !count(answered) || answered > questionsOffered) return undefined;
  if (!count(openItemsListed) || openItemsListed > QUESTIONNAIRE_CONTEXT_BOUNDS.openItemsListed || !count(removedListed) || removedListed > QUESTIONNAIRE_CONTEXT_BOUNDS.removedListed) return undefined;
  if (!count(rejectedItemsListed) || rejectedItemsListed > QUESTIONNAIRE_CONTEXT_BOUNDS.rejectedItemsListed || !count(rejectedItemsTotal) || rejectedItemsTotal < rejectedItemsListed) return undefined;
  if (value.answerSources !== undefined) {
    const sources = value.answerSources;
    if (!Array.isArray(sources) || sources.length > 200 || sources.length > answered || ((scope === "question" || value.answerContent === "withheld") && sources.length > 0)) return undefined;
    if (!sources.every((source) => record(source) && keys(source, ["ref", "questionDocumentId"]) && typeof source.ref === "string" && /^Q[1-9]\d{0,2}$/.test(source.ref) && Number(source.ref.slice(1)) <= questionsOffered && string(source.questionDocumentId))) return undefined;
    if (new Set(sources.map((source) => source.ref)).size !== sources.length || new Set(sources.map((source) => source.questionDocumentId)).size !== sources.length) return undefined;
  }
  return value as ContextSummaryQuestionnaire;
}
/*
 * What steered the run, by its source only (never the text): `analyst` or `default-task` for questionnaire generation
 * and a proposal run, `analyst` or `plain-language-preset` for a rewrite, and nothing for the draft. Undefined means malformed.
 */
const INSTRUCTION_SOURCES_BY_OPERATION: Readonly<Record<AiRunOperation, readonly string[]>> = {
  "questionnaire-generation": ["analyst", "default-task"], "questionnaire-proposals": ["analyst", "default-task"],
  "question-rewrite": ["analyst", "plain-language-preset"], "assessment-draft": [],
  "risk-suggestions": ["analyst", "default-task"], "risk-rewrite": ["analyst", "default-task"],
};
function parseSummaryInstruction(value: unknown, operation: AiRunOperation): ContextSummaryInstruction | null | undefined {
  const sources = INSTRUCTION_SOURCES_BY_OPERATION[operation];
  if (sources.length === 0) return value === null ? null : undefined;
  return record(value) && keys(value, ["source"]) && sources.includes(value.source as string) ? value as ContextSummaryInstruction : undefined;
}

const isRiskProposalOperation = (operation: unknown): operation is RiskProposalOperation => (RISK_PROPOSAL_OPERATIONS as readonly unknown[]).includes(operation);
/* The amendment's bound: the entries one risk proposal context may list across its lists. */
const RISK_CONTEXT_ENTRIES_MAX = 200;
/*
 * Phase 16 D-25 and D-31 (G-3; the approved Phase 16 amendment, "Context summary: risk proposal section"): the risk
 * proposal section, closed, counts and closed values only. It is set exactly for the two risk proposal operations and
 * its scope agrees with the operation: suggestions list existing, withdrawn, rejected and open entries and carry no
 * controls or focus; a rewrite lists its other Risks and its target's controls, with its focus or null. The listed
 * entries are within the bound of 200 together. Undefined means malformed.
 */
function parseSummaryRiskProposals(value: unknown, operation: AiRunOperation): ContextSummaryRiskProposals | null | undefined {
  if (!isRiskProposalOperation(operation)) return value === null ? null : undefined;
  if (!record(value) || !keys(value, ["scope", "risksListed", "withdrawnListed", "rejectedListed", "openListed", "controlsListed", "focus"])) return undefined;
  const { risksListed, withdrawnListed, rejectedListed, openListed, controlsListed, focus } = value;
  if (!count(risksListed) || !count(withdrawnListed) || !count(rejectedListed) || !count(openListed) || risksListed + withdrawnListed + rejectedListed + openListed > RISK_CONTEXT_ENTRIES_MAX) return undefined;
  if (operation === "risk-suggestions") return value.scope === "assessment" && controlsListed === null && focus === null ? value as ContextSummaryRiskProposals : undefined;
  if (value.scope !== "risk" || withdrawnListed !== 0 || rejectedListed !== 0 || openListed !== 0 || !count(controlsListed) || controlsListed > 1_000) return undefined;
  if (focus !== null && (!Array.isArray(focus) || focus.length === 0 || new Set(focus).size !== focus.length || !focus.every((part) => (FOCUS_PARTS as readonly unknown[]).includes(part)))) return undefined;
  return value as ContextSummaryRiskProposals;
}

const SUMMARY_KEYS_BY_VERSION: Readonly<Record<number, readonly string[]>> = { 1: SUMMARY_V1_KEYS, 2: [...SUMMARY_V1_KEYS, "notes"], 3: [...SUMMARY_V1_KEYS, "notes", "attachments"], 4: [...SUMMARY_V1_KEYS, "notes", "attachments", "questionnaire", "instruction"], 5: [...SUMMARY_V1_KEYS, "notes", "attachments", "questionnaire", "instruction", "riskProposals"] };
/*
 * The closed context summary envelope: v1 (Phase 12), v2 (Phase 13 D-28, v1 plus the notes section), v3 (Phase 14
 * D-35, v2 plus the attachments section), v4 (Phase 15 D-19, v3 plus the questionnaire and instruction sections) or v5
 * (Phase 16 D-25, v4 plus the risk proposal section). A v1 summary is projected with an empty notes section, a v1 or v2
 * summary with an empty attachments section, a v1 to v3 summary with both Phase 15 sections null, and a v1 to v4
 * summary with the risk proposal section null. A summary of either questionnaire proposal operation is v4 or later,
 * and one of either risk proposal operation v5, since those runs began with them. Anything else, or a summary over its
 * 64 KB bound (WR-104), is null.
 */
export function parseContextSummary(value: unknown): ContextSummaryRead | null {
  if (!record(value)) return null;
  const version = value.schemaVersion;
  const expected = typeof version === "number" ? SUMMARY_KEYS_BY_VERSION[version] : undefined;
  if (!expected || !keys(value, expected)) return null;
  if (!AI_RUN_OPERATIONS.includes(value.operation as AiRunOperation)) return null;
  const operation = value.operation as AiRunOperation;
  if ((version as number) < 4 && isQuestionnaireProposalOperation(operation)) return null;
  if (version !== 5 && isRiskProposalOperation(operation)) return null;
  const notes = version === 1 ? NO_NOTES() : parseSummaryNotes(value.notes);
  if (!notes) return null;
  const attachments = (version as number) >= 3 ? parseSummaryAttachments(value.attachments, operation) : NO_ATTACHMENTS(operation);
  if (!attachments) return null;
  const questionnaire = (version as number) >= 4 ? parseSummaryQuestionnaire(value.questionnaire, operation) : null;
  const instruction = (version as number) >= 4 ? parseSummaryInstruction(value.instruction, operation) : null;
  const riskProposals = version === 5 ? parseSummaryRiskProposals(value.riskProposals, operation) : null;
  if (questionnaire === undefined || instruction === undefined || riskProposals === undefined) return null;
  if (!count(value.characters) || !count(value.budget) || !string(value.digest, 80) || !/^sha256:[a-f0-9]{64}$/.test(value.digest)) return null;
  const request = value.request, questions = value.questions, risks = value.riskTypes, controls = value.controlCandidates, classification = value.classification;
  if (!record(request) || !keys(request, ["fields"]) || !Array.isArray(request.fields) || !request.fields.every((field) => record(field) && keys(field, ["key", "label", "characters"]) && string(field.key) && string(field.label, 300) && count(field.characters))) return null;
  if (!record(questions) || !keys(questions, ["included", "answered", "sources"]) || !count(questions.included) || !count(questions.answered) || !Array.isArray(questions.sources) || !questions.sources.every((source) => record(source) && keys(source, ["key", "label", "section"]) && string(source.key) && string(source.label, 300) && string(source.section, 300))) return null;
  if (!Array.isArray(value.systems) || !value.systems.every((item) => record(item) && keys(item, ["key", "documentId", "name"]) && string(item.key) && string(item.documentId) && string(item.name, 300))) return null;
  if (!Array.isArray(value.assets) || !value.assets.every((item) => record(item) && keys(item, ["key", "documentId", "name", "classification"]) && string(item.key) && string(item.documentId) && string(item.name, 300) && (item.classification === null || string(item.classification, 40)))) return null;
  if (!record(risks) || !keys(risks, ["offered", "total", "names"]) || !count(risks.offered) || !count(risks.total) || !stringArray(risks.names, 60)) return null;
  if (!record(controls) || !keys(controls, ["offered", "total"]) || !count(controls.offered) || !count(controls.total)) return null;
  if (!record(classification) || !keys(classification, ["level", "source", "ceiling", "decision"]) || !DATA_CLASSIFICATIONS.includes(classification.level as typeof DATA_CLASSIFICATIONS[number]) || !["assets", "default"].includes(classification.source as string) || (classification.ceiling !== null && !DATA_CLASSIFICATIONS.includes(classification.ceiling as typeof DATA_CLASSIFICATIONS[number])) || !["allowed", "refused"].includes(classification.decision as string)) return null;
  if (byteSize(value) > AI_RUN_BOUNDS.contextSummaryBytes) return null;
  if (version === 5) return value as ContextSummaryRead;
  const noRiskProposals = { riskProposals: null } as const;
  if (version === 4) return { ...(value as ContextSummaryV4), ...noRiskProposals };
  const none = { questionnaire: null, instruction: null, ...noRiskProposals } as const;
  if (version === 3) return { ...(value as ContextSummaryV3), ...none };
  return version === 2 ? { ...(value as ContextSummaryV2), attachments, ...none } : { ...(value as ContextSummaryV1), notes, attachments, ...none };
}

export type AiRunProposalEnvelope = { schemaVersion: 2; proposal: Row; adjustments: string[] };
export function parseRunProposal(value: unknown): AiRunProposalEnvelope | null {
  if (!record(value) || !keys(value, ["schemaVersion", "proposal", "adjustments"]) || value.schemaVersion !== 2 || !record(value.proposal) || !stringArray(value.adjustments, 100)) return null;
  return byteSize(value) <= AI_RUN_BOUNDS.proposalBytes ? value as AiRunProposalEnvelope : null;
}
/*
 * WR-104 (D-06): the envelope a completed run will keep, checked before the transaction that saves the proposal, so a
 * proposal the run record cannot hold (over 1 MB) is refused by the caller as invalid provider output and nothing is saved.
 */
export function runProposalEnvelope(proposal: Row, adjustments: readonly string[]): AiRunProposalEnvelope | null {
  return parseRunProposal({ schemaVersion: 2, proposal, adjustments: [...adjustments] });
}
export type AiRunDecisionEventV1 = { schemaVersion: 1; at: string; by: string; target: string; kind: "accepted" | "dismissed" | "restored" | "edited"; item?: string; fields?: string[]; implementation?: string };
export function parseRunDecisions(value: unknown): AiRunDecisionEventV1[] | null {
  if (!Array.isArray(value) || value.length > AI_RUN_BOUNDS.decisionEvents) return null;
  for (const event of value) {
    if (!record(event) || !keys(event, ["schemaVersion", "at", "by", "target", "kind"], ["item", "fields", "implementation"]) || event.schemaVersion !== 1 || !instant(event.at) || !string(event.by) || !string(event.target) || !["accepted", "dismissed", "restored", "edited"].includes(event.kind as string) || (event.item !== undefined && !string(event.item)) || (event.fields !== undefined && !stringArray(event.fields, 20)) || (event.implementation !== undefined && !string(event.implementation))) return null;
  }
  return value as AiRunDecisionEventV1[];
}

/*
 * Phase 15 D-19 and D-20 (W-1; the approved amendment, "Dispatch by operation"): a run's proposal and decisions are
 * parsed by the run's operation, never by schemaVersion, because Phase 12's envelope in the same column is
 * schemaVersion 2 and the questionnaire envelope schemaVersion 1. The two questionnaire proposal operations read only
 * the questionnaire envelope v1 of their own operation and decision events v2; Phase 12's operations read only their
 * envelope and v1 events. A risk proposal run's log holds two families, parsed by schemaVersion (the Phase 16
 * execution amendment of 2026-10-16, item 1, for `risk-suggestions`; the Phase 16 code review amendment of
 * 2026-10-16, item 2, for `risk-rewrite`; parseRiskProposalDecisionLog). AI_RUN_BOUNDS applies to every operation.
 * An unknown operation reads as null.
 */
export type AiRunProposal = AiRunProposalEnvelope | QuestionnaireProposalV1 | RiskProposalV1;
export type AiRunDecisionEvent = AiRunDecisionEventV1 | QuestionnaireDecisionEvent | RiskDecisionEvent;
export function parseRunProposalFor(operation: QuestionnaireProposalOperation, value: unknown): QuestionnaireProposalV1 | null;
export function parseRunProposalFor(operation: RiskProposalOperation, value: unknown): RiskProposalV1 | null;
export function parseRunProposalFor(operation: unknown, value: unknown): AiRunProposal | null;
export function parseRunProposalFor(operation: unknown, value: unknown): AiRunProposal | null {
  if (isQuestionnaireProposalOperation(operation)) {
    const parsed = parseQuestionnaireProposal(value);
    return parsed && parsed.operation === operation && byteSize(value) <= AI_RUN_BOUNDS.proposalBytes ? parsed : null;
  }
  // Phase 16 D-25 (the approved Phase 16 amendment, "Dispatch by operation"): the risk proposal envelope v1 of its own operation only.
  if (isRiskProposalOperation(operation)) {
    const parsed = parseRiskProposal(value);
    return parsed && parsed.operation === operation && byteSize(value) <= AI_RUN_BOUNDS.proposalBytes ? parsed : null;
  }
  return AI_RUN_OPERATIONS.includes(operation as AiRunOperation) ? parseRunProposal(value) : null;
}
/*
 * The Phase 16 execution amendment (2026-10-16, item 1; G-6, pilot ruling 729ef6e0): a `risk-suggestions` run's log
 * holds its v2 item events (D-39) and Phase 12's v1 field and suggested-control events for a Risk the run added ("Add to
 * assessment" names the run in the Risk's envelope, and Phase 12's per-field review appends to the envelope's run).
 * Each entry is parsed by its schemaVersion, closed: `events` keeps the stored order, `items` is the item fold's family
 * (v2 only) and `fieldReview` Phase 12's (v1 only), so neither changes the other's state. A v1 event targets a Risk,
 * never the assessment. Anything malformed, another schemaVersion included, damages the whole log (null). Which v1
 * events a run may take is checked against stored facts by appendAiRunDecisions. The Phase 16 code review amendment
 * (2026-10-16, item 2; BE2-01, BE2-03): a `risk-rewrite` run's log is read the same way, since each Phase 12 field event
 * goes to the run that proposed the value (`fieldRunId`).
 */
export type RiskProposalDecisionLog = { events: readonly AiRunDecisionEvent[]; items: readonly RiskDecisionEvent[]; fieldReview: readonly AiRunDecisionEventV1[] };
export type RiskSuggestionsDecisionLog = RiskProposalDecisionLog;
export function parseRiskSuggestionsDecisionLog(value: unknown): RiskProposalDecisionLog | null {
  return parseRiskProposalDecisionLog(value);
}
export function parseRiskProposalDecisionLog(value: unknown): RiskProposalDecisionLog | null {
  if (value === null || value === undefined) return { events: [], items: [], fieldReview: [] };
  if (!Array.isArray(value) || value.length > AI_RUN_BOUNDS.decisionEvents) return null;
  const events: AiRunDecisionEvent[] = [];
  const items: RiskDecisionEvent[] = [];
  const fieldReview: AiRunDecisionEventV1[] = [];
  for (const entry of value) {
    if (record(entry) && entry.schemaVersion === 1) {
      const [event] = parseRunDecisions([entry]) ?? [];
      if (!event || event.target === "assessment") return null;
      events.push(event);
      fieldReview.push(event);
      continue;
    }
    const [event] = parseRiskDecisionEvents([entry]) ?? [];
    if (!event) return null;
    events.push(event);
    items.push(event);
  }
  return { events: Object.freeze(events), items: Object.freeze(items), fieldReview: Object.freeze(fieldReview) };
}

/* A run with no decision yet (null) reads as an empty log for every operation; anything else malformed is null. */
export function parseRunDecisionsFor(operation: QuestionnaireProposalOperation, value: unknown): readonly QuestionnaireDecisionEvent[] | null;
export function parseRunDecisionsFor(operation: RiskProposalOperation, value: unknown): readonly RiskDecisionEvent[] | null;
export function parseRunDecisionsFor(operation: unknown, value: unknown): readonly AiRunDecisionEvent[] | null;
export function parseRunDecisionsFor(operation: unknown, value: unknown): readonly AiRunDecisionEvent[] | null {
  if (isQuestionnaireProposalOperation(operation)) {
    const parsed = parseQuestionnaireDecisionEvents(value);
    return parsed && parsed.length <= AI_RUN_BOUNDS.decisionEvents ? parsed : null;
  }
  // Phase 16 D-39 and the two 2026-10-16 amendments: a risk proposal run's item fold reads only its v2 events.
  if (isRiskProposalOperation(operation)) return parseRiskProposalDecisionLog(value)?.items ?? null;
  if (!AI_RUN_OPERATIONS.includes(operation as AiRunOperation)) return null;
  return value === null ? [] : parseRunDecisions(value);
}

export type CreateRunningAiRunInput = { operation: AiRunOperation; initiatedBy: string; providerName: string; providerVersion: string; assessmentRequest: string; contextSummary: ContextSummary; jobId?: string; attempt?: number; instruction?: string; questionnaire?: string; assessment?: string; risk?: string };
export async function createRunningAiRun(strapi: Core.Strapi, input: CreateRunningAiRunInput): Promise<RunDocument> {
  if (!AI_RUN_OPERATIONS.includes(input.operation) || !string(input.assessmentRequest) || !string(input.initiatedBy) || !string(input.providerName) || !string(input.providerVersion) || !parseContextSummary(input.contextSummary) || input.contextSummary.operation !== input.operation || (input.attempt !== undefined && !count(input.attempt))) throw new AiRunRecordError();
  return documents(strapi).create({ data: { ...input, status: "running", startedAt: new Date().toISOString(), completedAt: null, proposal: null, decisions: [], failureCode: null, failureMessage: null } });
}
async function running(strapi: Core.Strapi, runId: string): Promise<RunDocument> {
  const run = await documents(strapi).findOne({ documentId: runId });
  if (!run || run.status !== "running") throw new AiRunRecordError();
  return run;
}
export async function completeAiRun(strapi: Core.Strapi, runId: string, input: { proposal: AiRunProposal; questionnaire?: string; assessment?: string }): Promise<RunDocument> {
  const run = await running(strapi, runId);
  // D-19 (W-1): the proposal is checked by the stored run's operation, so neither envelope family lands on the other's run.
  if (!parseRunProposalFor(run.operation, input.proposal)) throw new AiRunRecordError();
  return documents(strapi).update({ documentId: runId, data: { status: "completed", completedAt: new Date().toISOString(), proposal: input.proposal, ...(input.questionnaire ? { questionnaire: input.questionnaire } : {}), ...(input.assessment ? { assessment: input.assessment } : {}) } });
}
export async function failAiRun(strapi: Core.Strapi, runId: string, input: { code: string; message: string }): Promise<RunDocument> {
  await running(strapi, runId);
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(input.code) || !string(input.message, 255) || /[\r\n<>]/.test(input.message)) throw new AiRunRecordError();
  return documents(strapi).update({ documentId: runId, data: { status: "failed", completedAt: new Date().toISOString(), failureCode: input.code, failureMessage: input.message } });
}
/*
 * D-20 (T-15-13): the decision log only grows, and both the stored log and the appended events are validated by the
 * run's operation: a v1 event on a questionnaire proposal run, or a v2 event on a Phase 12 run, is refused and nothing
 * is written. A `risk-suggestions` run also takes Phase 12's v1 events whose target is a Risk this run added, its
 * `created` history row naming this run and a suggestion item (the Phase 16 execution amendment of 2026-10-16, item 1).
 * A `risk-rewrite` run also takes Phase 12's v1 field events whose target is the run's own Risk and whose fields all
 * belong to the run's change units (the Phase 16 code review amendment of 2026-10-16, item 2). Any other v1 event
 * (another target, a suggested-control event, a field outside the units) refuses the whole append (WR-103).
 */
export async function appendAiRunDecisions(strapi: Core.Strapi, runId: string, events: readonly AiRunDecisionEvent[]): Promise<RunDocument> {
  const run = await documents(strapi).findOne({ documentId: runId, populate: { risk: { fields: ["documentId"] } } });
  if (!run) throw new AiRunRecordError();
  if (run.operation === "risk-rewrite") {
    const stored = parseRiskProposalDecisionLog(run.decisions);
    const added = parseRiskProposalDecisionLog(events);
    if (!stored || !added || stored.events.length + added.events.length > AI_RUN_BOUNDS.decisionEvents) throw new AiRunRecordError();
    if (added.fieldReview.length) {
      const riskId = record(run.risk) && string(run.risk.documentId) ? run.risk.documentId : null;
      const proposal = parseRunProposalFor("risk-rewrite", run.proposal);
      const unitFields = new Set<string>(proposal?.items.flatMap((item) => item.kind === "change" && item.riskDocumentId === riskId ? [...item.fields] : []) ?? []);
      for (const event of added.fieldReview) {
        const fieldEvent = event.item === undefined && event.implementation === undefined && Array.isArray(event.fields) && event.fields.length > 0;
        if (!riskId || event.target !== riskId || !fieldEvent || !(event.fields ?? []).every((field) => unitFields.has(field))) throw new AiRunRecordError();
      }
    }
    return documents(strapi).update({ documentId: runId, data: { decisions: [...stored.events, ...added.events] } });
  }
  if (run.operation === "risk-suggestions") {
    const stored = parseRiskProposalDecisionLog(run.decisions);
    const added = parseRiskProposalDecisionLog(events);
    if (!stored || !added || stored.events.length + added.events.length > AI_RUN_BOUNDS.decisionEvents) throw new AiRunRecordError();
    for (const target of new Set(added.fieldReview.map((event) => event.target))) {
      if (!isRiskSuggestionKey(await aiRunCreatedItem(strapi, target, runId))) throw new AiRunRecordError();
    }
    return documents(strapi).update({ documentId: runId, data: { decisions: [...stored.events, ...added.events] } });
  }
  const previous = parseRunDecisionsFor(run.operation, run.decisions);
  const additions = parseRunDecisionsFor(run.operation, events);
  if (!previous || !additions || previous.length + additions.length > AI_RUN_BOUNDS.decisionEvents) throw new AiRunRecordError();
  return documents(strapi).update({ documentId: runId, data: { decisions: [...previous, ...additions] } });
}
/*
 * D-20 and WR-01: a run is open from just before its one provider call until the transaction that saves its proposal
 * commits, or its failure is recorded. The call is a single request (maxRetries 0) bounded by the AI request timeout
 * (CSRM_AI_REQUEST_TIMEOUT_MS, 60,000 ms by default). The margin covers the rest: the persistence transaction, which
 * may wait up to the database's 60-second connection acquire timeout, the failure write after it, and clock skew
 * between processes. A run still `running` past that bound has lost its process, so only such a run is reconciled,
 * and a process that boots never interrupts a run another live process is still working on. Proving that a run
 * younger than the bound has lost its process needs a worker lease or heartbeat, which waits for the shared job store
 * (R-08-36).
 */
export const AI_RUN_RECONCILIATION_MARGIN_MS = 300_000;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000;
// Node runs a longer timer delay after 1 ms, so the bound never exceeds it.
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** How long a run may stay `running` while its process is alive: the AI request timeout plus the margin. */
export function aiRunOrphanBoundMs(aiConfig: unknown): number {
  const configured = record(aiConfig) ? aiConfig.requestTimeoutMs : undefined;
  const timeout = typeof configured === "number" && Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_AI_REQUEST_TIMEOUT_MS;
  return Math.min(timeout + AI_RUN_RECONCILIATION_MARGIN_MS, MAX_TIMER_DELAY_MS);
}

/** Marks `interrupted` every run still `running` that started more than the bound before `now`; returns how many. */
export async function reconcileInterruptedAiRuns(strapi: Core.Strapi, now: () => Date = () => new Date(), boundMs: number = aiRunOrphanBoundMs(strapi.config.get("ai"))): Promise<number> {
  const current = now();
  const startedBefore = new Date(current.getTime() - boundMs).toISOString();
  const completedAt = current.toISOString();
  let changed = 0;
  for (;;) {
    const rows = await documents(strapi).findMany({ filters: { status: { $eq: "running" }, startedAt: { $lt: startedBefore } }, limit: 500 });
    if (rows.length === 0) return changed;
    for (const row of rows) { await documents(strapi).update({ documentId: row.documentId, data: { status: "interrupted", completedAt } }); changed++; }
  }
}

export type DeferredAiRunReconciliation = { stop: () => Promise<void> };

/*
 * WR-01: the boot pass leaves every run younger than the bound, which may be live in another process or may have been
 * orphaned by a quick restart. One deferred pass, once the bound has passed since boot, closes the orphans: every run
 * that started before this boot is then past the bound, and a healthy one has ended. The timer is unref'd, so it never
 * keeps the process alive; stop() (Strapi's destroy) clears it and waits for a pass in flight, so none runs once Strapi
 * is destroyed. A pass that fails is logged, never thrown: the next start reconciles again.
 */
export function scheduleDeferredAiRunReconciliation(strapi: Core.Strapi, delayMs: number = aiRunOrphanBoundMs(strapi.config.get("ai"))): DeferredAiRunReconciliation {
  let stopped = false;
  let inFlight: Promise<void> = Promise.resolve();
  const sweep = (): Promise<void> => {
    if (stopped) return inFlight;
    inFlight = reconcileInterruptedAiRuns(strapi, () => new Date(), delayMs).then(
      () => undefined,
      () => { strapi.log.error("CSRM could not mark interrupted AI runs; the next start will try again."); },
    );
    return inFlight;
  };
  const timer = setTimeout(sweep, delayMs);
  timer.unref();
  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await inFlight;
    },
  };
}

const relationId = (value: unknown): string | null => record(value) && typeof value.documentId === "string" ? value.documentId : null;
const nullableText = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const timestamp = (value: unknown): string | null => value instanceof Date ? value.toISOString() : typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

/*
 * WR-105 (G-3): a summary names each answer source by the question's position ("Question 3"), never its text. The
 * analyst's reads show the question's current text, read from the questionnaire the run used (populated with its
 * questions' text and options), each at most the summary's label bound; a question no longer there keeps the stored label.
 */
export function currentQuestionLabels(questionnaire: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  const questions = record(questionnaire) && Array.isArray(questionnaire.questions) ? questionnaire.questions : [];
  for (const question of questions) {
    if (!record(question) || !record(question.options) || typeof question.options.questionKey !== "string" || typeof question.questionText !== "string") continue;
    const text = question.questionText.trim().slice(0, CONTEXT_BOUNDS.questionLabelCharacters).trim();
    if (text) labels.set(`answer.${question.options.questionKey.trim()}`, text);
  }
  return labels;
}
export function withCurrentQuestionLabels<Summary extends ContextSummary | ContextSummaryRead>(summary: Summary, labels: ReadonlyMap<string, string>): Summary {
  if (labels.size === 0) return summary;
  return { ...summary, questions: { ...summary.questions, sources: summary.questions.sources.map((source) => ({ ...source, label: labels.get(source.key) ?? source.label })) } };
}
/* The populate a run read needs for `currentQuestionLabels`: the run's questionnaire, with its questions' text and options. */
export const RUN_QUESTIONNAIRE_LABELS_POPULATE = { fields: ["documentId"], populate: { questions: { fields: ["questionText", "options"] } } } as const;

/* What an attachment record says now about a file a run used (resolveContextAttachments), keyed by documentId. */
export type RunAttachmentNames = ReadonlyMap<string, { fileName: string; requestId: string | null; removed: boolean }>;
/*
 * Phase 14 D-35 (G-3): the stored summary names each file by documentId only; the read adds what its record says now:
 * its current name, its request and whether it has been removed since. A file is named only from its own request's
 * record (the run's request), so a summary can never surface another request's file name; a file whose record is gone
 * reads as removed with no name.
 */
function withAttachmentNames(summary: ContextSummaryRead, runRequestId: string | null, names: RunAttachmentNames): Row {
  const included = summary.attachments.included.map((entry) => {
    const resolved = names.get(entry.documentId);
    const own = resolved && resolved.requestId !== null && resolved.requestId === runRequestId ? resolved : null;
    return { ...entry, fileName: own?.fileName ?? null, requestId: own?.requestId ?? null, removed: own ? own.removed : true };
  });
  return { ...summary, attachments: { ...summary.attachments, included } };
}
/** The documentIds of the files a stored summary says a run used, for one name read (D-35). */
export function runAttachmentIds(run: Row): string[] {
  const summary = parseContextSummary(run.contextSummary);
  return summary ? summary.attachments.included.map(({ documentId }) => documentId) : [];
}

/*
 * D-25: the analyst read of a run, closed: its facts, its context summary (projected null when it cannot be
 * parsed, its answer sources named by their questions' current text, Phase 14 D-35: its files by their current names
 * in `attachmentNames`) and its outcome. The proposal and the decision history are never served here.
 */
export function projectAiRun(run: Row, attachmentNames: RunAttachmentNames = new Map()): Row {
  const parsed = parseContextSummary(run.contextSummary);
  const contextSummary = parsed ? withAttachmentNames(withCurrentQuestionLabels(parsed, currentQuestionLabels(run.questionnaire)), relationId(run.assessmentRequest), attachmentNames) : null;
  const initiator = record(run.initiatedBy) && run.initiatedBy.accountStatus === "active" && typeof run.initiatedBy.documentId === "string" && string(run.initiatedBy.displayName)
    ? { documentId: run.initiatedBy.documentId, displayName: run.initiatedBy.displayName }
    : null;
  return {
    documentId: run.documentId,
    operation: run.operation,
    status: run.status,
    startedAt: timestamp(run.startedAt),
    completedAt: timestamp(run.completedAt),
    initiatedBy: initiator,
    providerName: run.providerName,
    providerVersion: run.providerVersion,
    instruction: nullableText(run.instruction),
    contextSummary,
    failureCode: nullableText(run.failureCode),
    failureMessage: nullableText(run.failureMessage),
    targets: {
      assessmentRequest: relationId(run.assessmentRequest),
      questionnaire: relationId(run.questionnaire),
      assessment: relationId(run.assessment),
      risk: relationId(run.risk),
    },
  };
}

import { createHash } from "node:crypto";
import { type AiPolicyDecision, type DataClassification, requestClassification } from "./data-policy";
import { rankByRelevance } from "./library-ranking";
import type { QuestionnaireContextAllowed, QuestionnaireProposalContextPart } from "../../api/csrm-questionnaire/services/questionnaire-proposal-context";
import { PLAIN_LANGUAGE_PRESET, type InstructionSource, type SlotInstruction } from "./analyst-instruction";
import { composeUserPrompt, renderAnalystInstructionSlot, renderReferenceDataBlock, renderRequestorDataBlock, UNTRUSTED_DATA_INSTRUCTION, type PromptAttachmentBlock, type PromptValue } from "./prompt-sections";
import type { RiskProposalContextAllowed, RiskProposalContextPart } from "./risk-proposals/risk-proposal-context";
import type { FocusPart } from "./risk-proposals/field-units";

/*
 * Phase 15 D-19 (the approved amendment): questionnaire proposals and the plain-language rewrite of one question.
 * Phase 16 D-25 (the approved Phase 16 amendment): "Suggest more risks" and "Rewrite this risk".
 */
export type AiRunOperation = "questionnaire-generation" | "assessment-draft" | "questionnaire-proposals" | "question-rewrite" | "risk-suggestions" | "risk-rewrite";
type Row = Record<string, unknown>;
export type SubmittedQuestionAnswer = { questionKey: string; sectionTitle: string; questionText: string; helpText: string; answerType: string; value: string | boolean | string[] | null; answerLabel: string };
/*
 * Phase 13 D-27: a request note currently marked as changing the AI inputs, as the loader reads it. Only its part,
 * sequence and body are sent; its documentId and posting time are kept in the run summary, never sent.
 */
export type ContextNotePart = "requestor" | "security-analyst";
export type ContextNote = { documentId: string; part: ContextNotePart; sequence: number; postedAt: string; body: string };
/*
 * Phase 14 D-34: a file a Security Analyst included in the AI inputs, as the loader reads it, in upload order: its stored
 * text and the counts stored with it. Only its type, part, counts and text are sent; its documentId and digest are kept
 * in the run summary, never sent. Nothing names the file, its uploader or a time.
 */
export type ContextAttachmentType = "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "txt";
export type ContextAttachmentPart = "requestor" | "security-analyst";
export type ContextAttachment = { documentId: string; sha256: string; type: ContextAttachmentType; part: ContextAttachmentPart; text: string; kept: number; available: number; truncated: boolean };
export type AssessmentContextRecords = { request: Row; systems: Row[]; assets: Row[]; riskTypes: Row[]; controls: Row[]; answers?: SubmittedQuestionAnswer[]; notes?: ContextNote[]; attachments?: ContextAttachment[] };
/** An included file as one attachment block: its sequence in upload order and exactly the text sent. */
export type RequestorAttachmentItem = ContextAttachment & PromptAttachmentBlock;
/** Phases 13 and 14 add notes and the included files through this same section interface. */
export type RequestorDataSection = { kind: "request-fields" | "answers" | "notes"; values: PromptValue[] } | { kind: "attachments"; items: RequestorAttachmentItem[] };
export type SourceCatalogueEntry = { kind: "request" | "answer" | "system" | "asset"; key: string; label: string; section?: string; documentId?: string; classification?: DataClassification };
export type ContextSummaryV1 = {
  schemaVersion: 1; operation: AiRunOperation;
  request: { fields: { key: string; label: string; characters: number }[] };
  questions: { included: number; answered: number; sources: { key: string; label: string; section: string }[] };
  systems: { key: string; documentId: string; name: string }[];
  assets: { key: string; documentId: string; name: string; classification: DataClassification | null }[];
  riskTypes: { offered: number; total: number; names: string[] };
  controlCandidates: { offered: number; total: number };
  classification: { level: DataClassification; source: "assets" | "default"; ceiling: DataClassification | null; decision: "allowed" | "refused" };
  characters: number; budget: number; digest: string;
};
/*
 * Phase 13 D-28 (G-3): what a run used of the request's notes: each included note by documentId, part, sequence,
 * posting time and length, never its text; how many were marked when the context was built; and the bound.
 */
export type ContextSummaryNote = { documentId: string; part: ContextNotePart; sequence: number; postedAt: string; characters: number };
export type ContextSummaryNotes = { included: ContextSummaryNote[]; marked: number; bound: typeof CONTEXT_BOUNDS.markedNotes };
export type ContextSummaryV2 = Omit<ContextSummaryV1, "schemaVersion"> & { schemaVersion: 2; notes: ContextSummaryNotes };
/*
 * Phase 14 D-35 (G-3): what a run used of the request's files: each included file by documentId, digest, type, part,
 * the characters sent and available and whether it was truncated, never its text or its name; and the run's bound.
 */
export type ContextSummaryAttachment = { documentId: string; sha256: string; type: ContextAttachmentType; part: ContextAttachmentPart; charactersSent: number; charactersAvailable: number; truncated: boolean };
export type ContextSummaryAttachments = { included: ContextSummaryAttachment[]; bound: number };
export type ContextSummaryV3 = Omit<ContextSummaryV2, "schemaVersion"> & { schemaVersion: 3; attachments: ContextSummaryAttachments };
/*
 * Phase 15 D-14 and D-19 (G-3; the approved amendment, "Context summary: questionnaire and instruction sections"): what a
 * questionnaire proposal or rewrite run was shown of the questionnaire, as counts and closed values only, and what
 * steered the run, by its source only: never the instruction's text (that is the run's `instruction`), never Requestor
 * text. `questionnaire` is null for questionnaire generation and the draft; `instruction` is null for the draft.
 */
export type ContextSummaryQuestionnaire = {
  scope: "questionnaire" | "question";
  questionsOffered: number; answered: number;
  answerContent: "included" | "withheld";
  openItemsListed: number; rejectedItemsListed: number; rejectedItemsTotal: number; removedListed: number;
  answerSources?: Array<{ ref: string; questionDocumentId: string }>;
};
export type ContextSummaryInstruction = { source: InstructionSource };
export type ContextSummaryV4 = Omit<ContextSummaryV3, "schemaVersion"> & { schemaVersion: 4; questionnaire: ContextSummaryQuestionnaire | null; instruction: ContextSummaryInstruction | null };
/*
 * Phase 16 D-25 and D-31 (G-3; the approved Phase 16 amendment, "Context summary: risk proposal section"): what a risk
 * proposal run was shown, as counts and closed values only: never a Risk's text, a reason or the instruction's text.
 * `risksListed` counts the active Risks listed (for a rewrite, the other active Risks); `controlsListed` and `focus` are
 * the rewrite's and null for suggestions. `riskProposals` is null for every other operation.
 */
export type ContextSummaryRiskProposals = {
  scope: "assessment" | "risk";
  risksListed: number; withdrawnListed: number; rejectedListed: number; openListed: number;
  controlsListed: number | null;
  focus: FocusPart[] | null;
};
export type ContextSummaryV5 = Omit<ContextSummaryV4, "schemaVersion"> & { schemaVersion: 5; riskProposals: ContextSummaryRiskProposals | null };
export type ContextSummary = ContextSummaryV1 | ContextSummaryV2 | ContextSummaryV3 | ContextSummaryV4 | ContextSummaryV5;
/*
 * A stored summary as the run read serves it: a v1 summary, written before notes reached the context, reads as having
 * included none, a v1 or v2 summary, written before files reached it, as having included no files, and a v1 to v3
 * summary, written before Phase 15, with neither a questionnaire nor an instruction section.
 */
type NoPhase15Sections = { questionnaire: null; instruction: null };
/* A v1 to v4 summary, written before Phase 16, reads with `riskProposals` null. */
type NoPhase16Section = { riskProposals: null };
export type ContextSummaryRead = (ContextSummaryV1 & { notes: ContextSummaryNotes; attachments: ContextSummaryAttachments } & NoPhase15Sections & NoPhase16Section) | (ContextSummaryV2 & { attachments: ContextSummaryAttachments } & NoPhase15Sections & NoPhase16Section) | (ContextSummaryV3 & NoPhase15Sections & NoPhase16Section) | (ContextSummaryV4 & NoPhase16Section) | ContextSummaryV5;
export type AssessmentContextAllowedSets = {
  riskTypes: Record<string, string>; systems: Record<string, string>;
  assets: Record<string, { documentId: string; name: string; classification: DataClassification | null }>;
  sourceKeys: string[]; controlCandidates: Record<string, { documentId: string; name: string }>;
};
/*
 * `questionnaire`: the questionnaire part's allowed sets, set for the two questionnaire proposal operations only (Phase 15
 * D-14). `riskProposals`: what the risk proposal adapters check the model's output against (the listed entries by short
 * key, the rewrite's target and base), set for the two risk proposal operations only (Phase 16 D-25).
 */
export type AssessmentContext = { operation: AiRunOperation; userPrompt: string; systemInstructions: string; summary: ContextSummaryV5; sources: SourceCatalogueEntry[]; allowed: AssessmentContextAllowedSets; questionnaire?: QuestionnaireContextAllowed; riskProposals?: RiskProposalContextAllowed; digest: string };
export const CONTEXT_BOUNDS = { riskTypes: 60, riskTypeDescriptionCharacters: 500, applicableControlsPerType: 20, libraryShortlist: 80, controlCandidates: 150, controlNameCharacters: 255, systems: 100, assets: 100, questionLabelCharacters: 300, draftPromptCharacters: 200_000, questionnairePromptCharacters: 100_000, summaryBytes: 65_536, markedNotes: 50 } as const;
/*
 * Phase 14 D-33: the characters of included file text one run may send, about 30% of the operation's prompt budget. The
 * run summary records the bound it was built under.
 */
export const ATTACHMENT_CONTEXT_BOUNDS = { "questionnaire-generation": 30_000, "assessment-draft": 60_000, "questionnaire-proposals": 30_000, "question-rewrite": 30_000, "risk-suggestions": 60_000, "risk-rewrite": 60_000 } as const satisfies Record<AiRunOperation, number>;
/* Phase 16 D-25: the two risk proposal operations use the assessment draft's settings, its prompt budget among them. */
export const RISK_PROPOSAL_CONTEXT_OPERATIONS: readonly AiRunOperation[] = ["risk-suggestions", "risk-rewrite"];
const usesDraftBudget = (operation: AiRunOperation): boolean => operation === "assessment-draft" || RISK_PROPOSAL_CONTEXT_OPERATIONS.includes(operation);
/*
 * Phase 15 D-14 (the approved amendment, "Bounds"): what one questionnaire proposal or rewrite context may list. More
 * active questions, open items or removed questions than these makes the context too large, before any run; the
 * rejected items are ranked, the most recent first, and the summary records their total, so nothing is left out silently.
 */
export const QUESTIONNAIRE_CONTEXT_BOUNDS = { activeQuestions: 150, openItemsListed: 200, rejectedItemsListed: 100, removedListed: 200 } as const;

/* A job's failure message is at most 255 characters (the generation registries' safe-failure rule). */
const SAFE_MESSAGE_CHARACTERS = 255;
/* The sequences in order, every run of three or more consecutive sequences written "4 to 9". */
function sequenceRuns(sequences: readonly number[]): string[] {
  const sorted = [...new Set(sequences)].sort((left, right) => left - right);
  const runs: string[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    if (end - start >= 2) runs.push(`${sorted[start]} to ${sorted[end]}`);
    else for (let index = start; index <= end; index += 1) runs.push(String(sorted[index]));
    start = end + 1;
  }
  return runs;
}
const listed = (items: readonly string[]): string => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
/*
 * Phase 13 D-27: when notes are marked, the refusal names them by sequence so the analyst can unmark some; otherwise it
 * is Phase 12's message. The list is shortened ("and 12 more") only when the whole message would pass the job's
 * 255-character failure message. Phase 14 D-33: when files are included, the refusal says so, so the analyst can exclude
 * some; the job carries which files (their names are resolved when the job is read, never kept in a message).
 */
export function contextTooLargeMessage(markedNoteSequences: readonly number[], includedFiles = 0): string {
  const count = new Set(markedNoteSequences).size;
  const files = Number.isSafeInteger(includedFiles) && includedFiles > 0 ? includedFiles : 0;
  if (count === 0 && files === 0) return "The request is too large for this operation.";
  if (count === 0) {
    return files === 1
      ? "The AI context is too large. The file included in the AI inputs holds more text than can be sent; exclude it and try again."
      : `The AI context is too large. The ${files} files included in the AI inputs hold more text than can be sent; exclude some and try again.`;
  }
  const filesClause = files === 0 ? "" : ` and ${files === 1 ? "1 file is" : `${files} files are`} included in them`;
  const advice = files === 0 ? "unmark some and try again." : "unmark or exclude some and try again.";
  const runs = sequenceRuns(markedNoteSequences);
  const message = (shown: readonly string[], more: number): string => `The AI context is too large. ${count === 1 ? "1 note is" : `${count} notes are`} marked as changing the AI inputs (${count === 1 ? "note" : "notes"} ${listed(more > 0 ? [...shown, `${more} more`] : shown)})${filesClause}; ${advice}`;
  for (let shown = runs.length; shown >= 1; shown -= 1) {
    const text = message(runs.slice(0, shown), runs.length - shown);
    if (text.length <= SAFE_MESSAGE_CHARACTERS) return text;
  }
  return `The AI context is too large. ${count} notes are marked as changing the AI inputs${filesClause}; ${advice}`;
}

export class AssessmentContextTooLargeError extends Error {
  readonly code = "CONTEXT_TOO_LARGE";
  readonly safeMessage: string;
  /** Phase 14 D-33: the files included when the context was refused, in upload order, which the job's failure names. */
  readonly attachmentDocumentIds: readonly string[];
  /**
   * `markedNoteSequences`: the sequences of the notes marked as changing the AI inputs, which the message names;
   * `attachmentDocumentIds`: the included files, which the message counts.
   */
  constructor(markedNoteSequences: readonly number[] = [], attachmentDocumentIds: readonly string[] = [], safeMessage?: string) {
    super("Assessment context exceeds its limit.");
    this.name = "AssessmentContextTooLargeError";
    this.attachmentDocumentIds = Object.freeze([...attachmentDocumentIds]);
    // Phase 16 D-31: a refusal with its own cause (the listed risk entries) says so in CSRM's own words.
    this.safeMessage = safeMessage ?? contextTooLargeMessage(markedNoteSequences, this.attachmentDocumentIds.length);
  }
}
export function contextDigest(userPrompt: string): string { return `sha256:${createHash("sha256").update(userPrompt, "utf8").digest("hex")}`; }
/*
 * WR-105 (G-3, D-07): the summary names an answer source by the question's position among the questions sent, a label
 * CSRM owns, never by its text, which a generator can write from the Requestor's request. The analyst's reads of a run
 * and of a citation show the question's current text instead (`currentQuestionLabels`).
 */
export function questionSourceLabel(index: number): string { return `Question ${index + 1}`; }
/* The request fields a context sends; Phase 15's Requestor-text guard reads the same fields' text (D-18). */
export const REQUEST_FIELDS = ["title", "description", "assessmentType", "division", "businessUnit", "businessPurpose", "businessCriticality", "thirdPartyInvolvement", "thirdPartyDetails", "regulatoryRequirements"] as const;
const SYSTEM_FIELDS = ["name", "description", "systemType", "environment", "deploymentModel", "businessCriticality", "internetFacing", "externalAccessRequired", "hostingLocation", "lifecycleState"] as const;
const ASSET_FIELDS = ["name", "description", "type", "location", "dataClassification", "confidentialityRating", "integrityRating", "availabilityRating", "containsPersonalData", "containsLegalData", "containsCreditCardData"] as const;
const asString = (value: unknown): string => typeof value === "string" ? value : typeof value === "boolean" ? value ? "Yes" : "No" : "";
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const rowId = (row: Row): string => asString(row.documentId);
const rowName = (row: Row): string => asString(row.name);
function ordered(rows: readonly Row[]): Row[] { return [...rows].sort((left, right) => compare(rowName(left), rowName(right)) || compare(rowId(left), rowId(right))); }
/*
 * The short keys a context gives the request's systems and assets (`system-{n}`, `asset-{n}`), by documentId, in the
 * order the builder numbers them. Phase 16's risk blocks name a Risk's system and asset by these keys, never by name.
 */
export function contextRecordKeys(records: { systems: readonly Row[]; assets: readonly Row[] }): { systems: Map<string, string>; assets: Map<string, string> } {
  return {
    systems: new Map(ordered(records.systems).map((row, index) => [rowId(row), `system-${index + 1}`])),
    assets: new Map(ordered(records.assets).map((row, index) => [rowId(row), `asset-${index + 1}`])),
  };
}
function fields(row: Row, names: readonly string[], prefix: string): PromptValue[] {
  return names.flatMap((name) => { const value = asString(row[name]); return value.trim() ? [{ label: `${prefix}${name}`, value }] : []; });
}
const applicableControlsOf = (type: Row): Row[] => Array.isArray(type.applicableControls) ? type.applicableControls.filter((row): row is Row => typeof row === "object" && row !== null) : [];
const controlText = (row: Row): string => `${asString(row.controlNumber)} ${rowName(row)} ${asString(row.description)}`;
/* WR-101: the share of the candidate bound the offered Risk Types divide equally; the rest is reserved for the library shortlist. */
const CONTROL_CANDIDATE_TYPE_SHARE = 0.6;

/*
 * WR-101 (D-12): the control candidates are each offered Risk Type's applicable controls (at most 20, ranked by relevance
 * within the type) and a lexical shortlist of the whole library (at most 80), within the bound of 150. The bound is
 * shared fairly and deterministically: every offered type first gets an equal share of 60% of the bound (at least one
 * control; one already chosen for another type counts), the shortlist then gets the reserved 40%, and the room left
 * goes to the remaining candidates by relevance. So neither a Risk Type late in the alphabet nor the shortlist can be
 * left with none.
 */
function selectControlCandidates(query: string, offeredTypes: readonly Row[], library: readonly Row[]): Map<string, Row> {
  const bound = CONTEXT_BOUNDS.controlCandidates;
  const typeShare = Math.floor(bound * CONTROL_CANDIDATE_TYPE_SHARE);
  const selected = new Map<string, Row>();
  const add = (control: Row): boolean => {
    const number = asString(control.controlNumber);
    if (!selected.has(number) && selected.size < bound) selected.set(number, control);
    return selected.has(number);
  };
  const perType = offeredTypes.map((type) => rankByRelevance(query, applicableControlsOf(type), CONTEXT_BOUNDS.applicableControlsPerType, controlText, rowId));
  const quota = Math.max(1, Math.floor(typeShare / Math.max(1, offeredTypes.length)));
  for (const ranked of perType) {
    let own = 0;
    for (const control of ranked) {
      if (own >= quota) break;
      if (add(control)) own += 1;
    }
  }
  const shortlist = rankByRelevance(query, library, CONTEXT_BOUNDS.libraryShortlist, controlText, rowId);
  let reserved = bound - typeShare;
  for (const control of shortlist) {
    if (reserved <= 0) break;
    if (!selected.has(asString(control.controlNumber)) && add(control)) reserved -= 1;
  }
  const rest = new Map<string, Row>();
  for (const control of [...perType.flat(), ...shortlist]) if (!selected.has(asString(control.controlNumber)) && !rest.has(asString(control.controlNumber))) rest.set(asString(control.controlNumber), control);
  for (const control of rankByRelevance(query, [...rest.values()], bound - selected.size, controlText, rowId)) add(control);
  return selected;
}

/*
 * Phase 13 D-27 (decision 5, G-3): each marked note, in sequence order, as three values under constant labels: its part
 * (a closed enum), its sequence (a server integer) and its whole body (06.7 D-10), never a name, time, id or request
 * number. The shared renderer writes each through promptDataTag, so a note's text is its own escaped value inside the
 * untrusted Requestor data block, whoever wrote it: an analyst's note can quote the Requestor.
 */
function inSequenceOrder(notes: readonly ContextNote[]): ContextNote[] {
  return [...notes].sort((left, right) => left.sequence - right.sequence || compare(left.documentId, right.documentId));
}
function noteValues(notes: readonly ContextNote[]): PromptValue[] {
  return notes.flatMap((note) => [{ label: "note.part", value: note.part }, { label: "note.sequence", value: String(note.sequence) }, { label: "note.body", value: note.body }]);
}
/*
 * Phase 14 D-34 (decision 5, G-3): each included file, in the order the loader hands them over (upload order), numbered
 * from 1, with at most its stored kept characters of text: a stored text longer than its facts say is never sent whole.
 * The counts and the truncation fact describe exactly what is sent.
 */
function attachmentItems(attachments: readonly ContextAttachment[]): RequestorAttachmentItem[] {
  return attachments.map((attachment, index) => {
    const text = attachment.text.slice(0, Math.max(0, attachment.kept));
    return { ...attachment, sequence: index + 1, text, kept: text.length, truncated: text.length < attachment.available };
  });
}

/*
 * Phase 15 D-14 (the approved amendment, `sources`): the ids the context offers a questionnaire proposal as sources
 * outside the questionnaire: each request field sent (`request.{field}`), each marked note by its sequence (`note-{n}`,
 * the `note.sequence` value the prompt carries) and each included file by its block's number (`file-{n}`).
 */
export function contextSourceRefs(records: Pick<AssessmentContextRecords, "request" | "notes" | "attachments">): string[] {
  return [
    ...fields(records.request, REQUEST_FIELDS, "request.").map(({ label }) => label),
    ...inSequenceOrder(records.notes ?? []).map(({ sequence }) => `note-${sequence}`),
    ...(records.attachments ?? []).map((_, index) => `file-${index + 1}`),
  ];
}

const QUESTIONNAIRE_PROPOSAL_OPERATIONS: readonly AiRunOperation[] = ["questionnaire-proposals", "question-rewrite"];
/*
 * Phase 15 D-12 and D-17: what steers a run and what the summary records of it, by source only. Questionnaire generation
 * and a proposal run take an analyst's instruction or none (the default task); a rewrite takes an analyst's instruction
 * or, by default, CSRM's plain-language preset; the draft takes none. A source that disagrees with the instruction is a
 * caller's error, refused before anything is built.
 */
export function resolveInstructionSteering(operation: AiRunOperation, given: SlotInstruction | null, givenSource: InstructionSource | null): { instruction: SlotInstruction | null; source: InstructionSource | null } {
  if (operation === "assessment-draft") {
    if (given !== null || givenSource !== null) throw new Error("CSRM assessment draft takes no instruction.");
    return { instruction: null, source: null };
  }
  const instruction = given ?? (operation === "question-rewrite" ? PLAIN_LANGUAGE_PRESET : null);
  const derived: InstructionSource = instruction === null ? "default-task" : given === null ? "plain-language-preset" : "analyst";
  const source = givenSource ?? derived;
  const agrees = source === "default-task" ? instruction === null && operation !== "question-rewrite"
    : source === "plain-language-preset" ? instruction === PLAIN_LANGUAGE_PRESET && operation === "question-rewrite"
      : instruction !== null;
  if (!agrees) throw new Error("CSRM analyst instruction and its source disagree.");
  return { instruction, source };
}

/*
 * The builder's inputs (Phase 15 X-2): `instruction` and `instructionSource` steer the run through the analyst
 * instruction slot (D-17), and `questionnaire` is the questionnaire part a proposal or rewrite run needs (D-14), which no
 * other operation takes.
 */
export type BuildAssessmentContextInput = { operation: AiRunOperation; policy?: AiPolicyDecision; instruction?: SlotInstruction | null; instructionSource?: InstructionSource | null; questionnaire?: QuestionnaireProposalContextPart; riskProposals?: RiskProposalContextPart };

export function buildAssessmentContext(records: AssessmentContextRecords, input: BuildAssessmentContextInput): AssessmentContext {
  const { operation } = input;
  const part = input.questionnaire;
  if (QUESTIONNAIRE_PROPOSAL_OPERATIONS.includes(operation) !== (part !== undefined)) throw new Error("CSRM questionnaire part is required for a questionnaire proposal context, and only there.");
  // Phase 16 D-25: the risk part is the two risk proposal operations' own, and they build on everything else unchanged.
  const riskPart = input.riskProposals;
  if (RISK_PROPOSAL_CONTEXT_OPERATIONS.includes(operation) !== (riskPart !== undefined) || (riskPart !== undefined && riskPart.allowed.operation !== operation)) throw new Error("CSRM risk proposal part is required for a risk proposal context, and only there.");
  const { instruction, source: instructionSource } = resolveInstructionSteering(operation, input.instruction ?? null, input.instructionSource ?? null);
  // D-14: a rewrite offers no Risk Type library.
  const offersRiskTypes = operation !== "question-rewrite";
  if (records.systems.length > CONTEXT_BOUNDS.systems || records.assets.length > CONTEXT_BOUNDS.assets) throw new AssessmentContextTooLargeError();
  const notes = inSequenceOrder(records.notes ?? []);
  const markedSequences = notes.map(({ sequence }) => sequence);
  if (notes.length > CONTEXT_BOUNDS.markedNotes) throw new AssessmentContextTooLargeError(markedSequences);
  const requestFields = fields(records.request, REQUEST_FIELDS, "request.");
  // Phase 16 D-25: both risk proposal operations send the submitted answers, as the draft does.
  const answers = usesDraftBudget(operation) ? records.answers ?? [] : [];
  const answerValues: PromptValue[] = answers.flatMap((answer) => [
    { label: "answer.questionKey", value: answer.questionKey }, { label: "answer.section", value: answer.sectionTitle },
    { label: "answer.questionText", value: answer.questionText }, { label: "answer.helpText", value: answer.helpText },
    { label: "answer.answerType", value: answer.answerType }, { label: "answer.value", value: answer.answerLabel },
  ]);
  const attachments = attachmentItems(records.attachments ?? []);
  const attachmentIds = attachments.map(({ documentId }) => documentId);
  // D-33 (T-14-40): included text over the run's own bound is refused before anything else is built, naming the files.
  if (attachments.reduce((total, { kept }) => total + kept, 0) > ATTACHMENT_CONTEXT_BOUNDS[operation]) throw new AssessmentContextTooLargeError([], attachmentIds);
  // D-30: a proposal run's submitted answers, by Qn, from its questionnaire part; the draft's own answers stay its own.
  const partAnswers: RequestorDataSection[] = part?.answers ? [part.answers] : [];
  const sections: RequestorDataSection[] = [{ kind: "request-fields", values: requestFields }, ...(answers.length ? [{ kind: "answers" as const, values: answerValues }] : []), ...partAnswers, ...(notes.length ? [{ kind: "notes" as const, values: noteValues(notes) }] : []), ...(attachments.length ? [{ kind: "attachments" as const, items: attachments }] : [])];
  const systems = ordered(records.systems), assets = ordered(records.assets);
  const sources: SourceCatalogueEntry[] = requestFields.map(({ label }) => ({ kind: "request", key: label, label }));
  for (const [index, answer] of answers.entries()) sources.push({ kind: "answer", key: `answer.${answer.questionKey}`, label: questionSourceLabel(index), section: answer.sectionTitle });
  const reference: PromptValue[] = [];
  const allowed: AssessmentContextAllowedSets = { riskTypes: {}, systems: {}, assets: {}, sourceKeys: [], controlCandidates: {} };
  const systemSummary = systems.map((system, index) => {
    const key = `system-${index + 1}`, documentId = rowId(system), name = rowName(system);
    allowed.systems[key] = documentId; sources.push({ kind: "system", key, label: name, documentId });
    reference.push(...fields(system, SYSTEM_FIELDS, `${key}.`)); return { key, documentId, name };
  });
  const assetSummary = assets.map((asset, index) => {
    const key = `asset-${index + 1}`, documentId = rowId(asset), name = rowName(asset);
    const classification = requestClassification([asset]).source === "assets" ? requestClassification([asset]).level : null;
    allowed.assets[key] = { documentId, name, classification }; sources.push({ kind: "asset", key, label: name, documentId, ...(classification ? { classification } : {}) });
    reference.push(...fields(asset, ASSET_FIELDS, `${key}.`)); return { key, documentId, name, classification };
  });
  // D-14: the questionnaire's questions and the already proposed, rejected and removed lists are reference data.
  if (part) reference.push(...part.reference);
  // Phase 16 D-31 and D-35: the listed risks, the rewrite's target and the decided suggestions are reference data too.
  if (riskPart) reference.push(...riskPart.reference);
  // D-27: a marked note changes the AI inputs, so it also informs which Risk Types and controls are offered; so does an included file's text (D-34).
  const query = [...requestFields, ...answerValues, ...notes.map(({ body }) => ({ value: body })), ...attachments.map(({ text }) => ({ value: text })), ...reference].map(({ value }) => value).join(" ");
  // Phase 16 D-35: a rewrite's target keeps its own Risk Type on offer, so the model can keep it.
  const pinned = new Set(riskPart?.allowed.pinnedRiskTypeIds ?? []);
  const offeredTypes = !offersRiskTypes ? [] : records.riskTypes.length > CONTEXT_BOUNDS.riskTypes
    ? [...records.riskTypes.filter((row) => pinned.has(rowId(row))), ...rankByRelevance(query, records.riskTypes.filter((row) => !pinned.has(rowId(row))), CONTEXT_BOUNDS.riskTypes, (row) => `${rowName(row)} ${asString(row.description)}`, rowId)].slice(0, CONTEXT_BOUNDS.riskTypes)
    : [...records.riskTypes];
  offeredTypes.sort((left, right) => compare(rowName(left), rowName(right)));
  for (const type of offeredTypes) {
    const name = rowName(type); allowed.riskTypes[name] = rowId(type);
    reference.push({ label: "riskType.name", value: name });
    if (asString(type.description)) reference.push({ label: "riskType.description", value: asString(type.description).slice(0, CONTEXT_BOUNDS.riskTypeDescriptionCharacters) });
    const applicable = Array.isArray(type.applicableControls) ? type.applicableControls.filter((row): row is Row => typeof row === "object" && row !== null) : [];
    for (const control of rankByRelevance(query, applicable, CONTEXT_BOUNDS.applicableControlsPerType, (row) => `${asString(row.controlNumber)} ${rowName(row)} ${asString(row.description)}`, rowId))
      reference.push({ label: "riskType.applicableControl", value: `${name}: ${asString(control.controlNumber)}` });
  }
  // Phase 16 D-30: suggested risks carry suggested controls as drafted ones do; a rewrite changes no control.
  if (operation === "assessment-draft" || operation === "risk-suggestions") {
    const selected = selectControlCandidates(query, offeredTypes, records.controls);
    for (const [number, control] of [...selected].sort(([left], [right]) => compare(left, right))) {
      allowed.controlCandidates[number] = { documentId: rowId(control), name: rowName(control) };
      reference.push({ label: "control.number", value: number }, { label: "control.name", value: rowName(control).slice(0, CONTEXT_BOUNDS.controlNameCharacters) });
    }
  }
  allowed.sourceKeys = sources.map(({ key }) => key);
  const userPrompt = composeUserPrompt({ analystInstruction: renderAnalystInstructionSlot(instruction), requestor: renderRequestorDataBlock(sections), reference: renderReferenceDataBlock(reference) });
  const budget = usesDraftBudget(operation) ? CONTEXT_BOUNDS.draftPromptCharacters : CONTEXT_BOUNDS.questionnairePromptCharacters;
  // D-33: over the operation's whole budget, the refusal names the marked notes and the included files alike.
  if (userPrompt.length > budget) throw new AssessmentContextTooLargeError(markedSequences, attachmentIds);
  const digest = contextDigest(userPrompt), classification = requestClassification(assets);
  const policy = input.policy;
  const summary: ContextSummaryV5 = {
    schemaVersion: 5, operation, request: { fields: requestFields.map(({ label, value }) => ({ key: label, label, characters: value.length })) },
    questions: { included: answers.length, answered: answers.filter(({ value }) => value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)).length, sources: answers.map(({ questionKey, sectionTitle }, index) => ({ key: `answer.${questionKey}`, label: questionSourceLabel(index), section: sectionTitle })) },
    systems: systemSummary, assets: assetSummary, riskTypes: { offered: offeredTypes.length, total: records.riskTypes.length, names: offeredTypes.map(rowName) },
    controlCandidates: { offered: Object.keys(allowed.controlCandidates).length, total: records.controls.length },
    classification: { level: policy?.requestClassification ?? classification.level, source: policy?.classificationSource ?? classification.source, ceiling: policy?.ceiling ?? null, decision: policy?.status ?? "allowed" },
    characters: userPrompt.length, budget, digest,
    notes: { included: notes.map(({ documentId, part, sequence, postedAt, body }) => ({ documentId, part, sequence, postedAt, characters: body.length })), marked: notes.length, bound: CONTEXT_BOUNDS.markedNotes },
    attachments: { included: attachments.map(({ documentId, sha256, type, part: uploader, kept, available, truncated }) => ({ documentId, sha256, type, part: uploader, charactersSent: kept, charactersAvailable: available, truncated })), bound: ATTACHMENT_CONTEXT_BOUNDS[operation] },
    // Phase 15 D-19 (G-3): counts and closed values only; never the instruction's text or any Requestor text.
    questionnaire: part ? { ...part.summary } : null,
    instruction: instructionSource ? { source: instructionSource } : null,
    // Phase 16 D-25 (G-3): counts and closed values only; never a Risk's text, a reason or the instruction.
    riskProposals: riskPart ? { ...riskPart.summary, focus: riskPart.summary.focus ? [...riskPart.summary.focus] : null } : null,
  };
  // WR-104 (D-06): the run keeps the summary in at most 64 KB; one that would pass it makes the context too large here, before any run.
  if (Buffer.byteLength(JSON.stringify(summary), "utf8") > CONTEXT_BOUNDS.summaryBytes) throw new AssessmentContextTooLargeError(markedSequences, attachmentIds);
  return { operation, userPrompt, systemInstructions: UNTRUSTED_DATA_INSTRUCTION, summary, sources, allowed, ...(part ? { questionnaire: part.allowed } : {}), ...(riskPart ? { riskProposals: riskPart.allowed } : {}), digest };
}

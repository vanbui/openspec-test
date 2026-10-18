import { parseContextSummary } from "../../api/csrm-ai-run/services/ai-run-record";
import {
  changedAttachmentInputs,
  type AttachmentInputChange,
  type AttachmentInputsBaseline,
} from "../../api/csrm-request-attachment/services/attachment-ai-signal";
import { NoteAiInputLogError, parseNoteAiInputLog } from "../../api/csrm-request-note/services/note-ai-input-log";

/*
 * "AI inputs changed since the last generation" (Phase 13 D-29; docs/contract-gaps/phase-13-request-notes.md, "The
 * AI-inputs-changed signal"), the one rule every read that serves it uses.
 *
 * Per target (the questionnaire, and the assessment), the signal lists the notes whose current AI-input mark differs from
 * what the target's baseline generation included: marked now but not included ("marked"), or included and since unmarked
 * ("unmarked"). The baseline is the target's newest completed context-wide run: for the assessment, the run its
 * aiProvenance names; for the questionnaire, its newest completed questionnaire-generation or questionnaire-proposals run
 * (Phase 15 D-29; S-2), which since Phase 15 is not always the run its `generation.runId` names (that stays the latest
 * generation run, D-27).
 *
 * Phase 14 D-36 adds the files (14-PLAN-CHECK iteration 2, S-1): the files whose place in the AI inputs differs from the
 * same baseline's ("included", "excluded" or "removed" since; `changedAttachmentInputs`). The signal stays one value: its
 * count is the notes changed plus the files changed, and it is non-null when either list has an item.
 *
 * The signal is advisory and analyst-only. It gates nothing and never decides what reaches a provider: whether a note is
 * marked is read from `changesAiInputs` alone, exactly as the context builder reads it, and whether a file is in the inputs
 * from the same current facts the context loader reads. It names notes by documentId, part, sequence and posting time, and
 * files by documentId and current name, never their text (G-3).
 *
 * Imports: this module reads the run record's and the note log's parsers and the attachment signal, all leaves (the
 * attachment signal never imports this module). It must never import a request, notes or assessment service:
 * those modules form a CommonJS load cycle (13-16's lesson), and the readers that call this module sit outside it.
 */

/**
 * The operations whose run reads the whole request context and so moves a target's baseline. Phase 15's questionnaire
 * proposals joined it (D-29): a completed questionnaire-wide run has read the marked notes and included files, whatever
 * the analyst then decides. Phase 16's "Suggest more risks" (`risk-suggestions`) joins it (D-28; the pilot ruling of
 * 2026-10-15 and the approved Phase 16 amendment to docs/contract-gaps/phase-13-request-notes.md): a completed run read
 * the assessment's whole context, so it is the assessment's baseline. A question- or risk-scoped operation (Phase 15's
 * question rewrite, Phase 16's "Rewrite this risk", Phase 17's per-risk reassessment) includes the marked notes in its
 * context but never joins it, so it never clears the signal (T-13-56).
 */
export const CONTEXT_WIDE_AI_OPERATIONS = Object.freeze(["questionnaire-generation", "assessment-draft", "questionnaire-proposals", "risk-suggestions"] as const);
export type ContextWideAiOperation = (typeof CONTEXT_WIDE_AI_OPERATIONS)[number];

/** The most notes one signal lists: a request holds at most 500 notes (NOTES_PER_REQUEST_MAX). */
export const AI_INPUTS_CHANGED_NOTES_MAX = 500;

/** The most files one signal lists (the contract's bound; a request stores at most 60 files). */
export const AI_INPUTS_CHANGED_FILES_MAX = 500;

export const AI_INPUT_CHANGES = Object.freeze(["marked", "unmarked"] as const);
export type AiInputChange = (typeof AI_INPUT_CHANGES)[number];

export type AiInputNotePart = "requestor" | "security-analyst";

/** A note as the signal names it: identity, part, sequence and posting time only. */
export type AiInputsNote = { documentId: string; part: AiInputNotePart; sequence: number; postedAt: string };

export type AiInputsChangedNote = AiInputsNote & { change: AiInputChange };

/** A file as the signal names it (`AiInputsChangedFile`, D-36). */
export type AiInputsChangedFile = AttachmentInputChange;

/**
 * The served signal (`AiInputsChanged`): how many inputs changed (the notes plus the files), and which, the notes in
 * sequence order and the files in upload order. Either list may be empty, never both.
 */
export type AiInputsChanged = { count: number; notes: AiInputsChangedNote[]; files: AiInputsChangedFile[] };

/** A currently marked note, with its AI-input log for the generatedDate fallback. */
export type MarkedNote = AiInputsNote & { aiInputLog?: unknown };

/**
 * What a target was last generated from: the notes its baseline run included, or, for a record generated before run
 * records existed, the time it was generated. Null when the target has no baseline, and so no signal.
 */
export type AiInputsBaseline =
  | { kind: "run"; included: readonly AiInputsNote[] }
  | { kind: "generated-date"; at: string }
  | null;

type RecordValue = Record<string, unknown>;

export function isContextWideAiOperation(operation: unknown): operation is ContextWideAiOperation {
  return typeof operation === "string" && (CONTEXT_WIDE_AI_OPERATIONS as readonly string[]).includes(operation);
}

function identity(note: AiInputsNote): AiInputsNote {
  return { documentId: note.documentId, part: note.part, sequence: note.sequence, postedAt: note.postedAt };
}

/*
 * When the note's mark was last set to true, from its AI-input log, or null when the log cannot be parsed or holds no
 * event that set the mark. This is the one place the signal reads the log, and only for that time.
 */
function latestMarkingAt(aiInputLog: unknown): number | null {
  let events;
  try {
    events = parseNoteAiInputLog(aiInputLog);
  } catch (error) {
    if (error instanceof NoteAiInputLogError) return null;
    throw error;
  }
  const marking = [...events].reverse().find((event) => event.to);
  return marking ? Date.parse(marking.at) : null;
}

/**
 * The pure D-29 rule. Null with no baseline. Against a run: each marked note the run did not include is "marked", and
 * each note it included that is no longer marked is "unmarked". Against the generation date of a record generated before
 * run records existed: each marked note whose latest marking is after that date is "marked"; what such a generation
 * included is not recorded, so nothing reads "unmarked". That fallback fails visible: a marked note whose log cannot be
 * parsed or holds no event that set the mark, or a generation date that cannot be read, counts as changed, because the
 * signal gates nothing and missing a changed input is the riskier failure (orchestrator decision 454b03d).
 *
 * D-36 merges the files, already decided against the same baseline (`changedAttachmentInputs`, in upload order; none when
 * absent). Null when neither a note nor a file changed, so a reader shows the signal exactly when it has an input to list;
 * otherwise `count` counts every change, notes plus files, and each list is bounded by its own maximum.
 */
export function aiInputsChanged(input: {
  markedNotes: readonly MarkedNote[];
  changedFiles?: readonly AiInputsChangedFile[];
  baseline: AiInputsBaseline;
}): AiInputsChanged | null {
  const { markedNotes, baseline } = input;
  if (baseline === null) return null;
  const files = (input.changedFiles ?? []).map((file) => ({ documentId: file.documentId, fileName: file.fileName, change: file.change }));
  const changed: AiInputsChangedNote[] = [];
  if (baseline.kind === "run") {
    const included = new Set(baseline.included.map((note) => note.documentId));
    const marked = new Set(markedNotes.map((note) => note.documentId));
    for (const note of markedNotes) if (!included.has(note.documentId)) changed.push({ ...identity(note), change: "marked" });
    for (const note of baseline.included) if (!marked.has(note.documentId)) changed.push({ ...identity(note), change: "unmarked" });
  } else {
    const generatedAt = Date.parse(baseline.at);
    for (const note of markedNotes) {
      const markedAt = latestMarkingAt(note.aiInputLog);
      if (Number.isNaN(generatedAt) || markedAt === null || Number.isNaN(markedAt) || markedAt > generatedAt) changed.push({ ...identity(note), change: "marked" });
    }
  }
  if (changed.length === 0 && files.length === 0) return null;
  changed.sort((left, right) => left.sequence - right.sequence || left.documentId.localeCompare(right.documentId));
  return {
    count: changed.length + files.length,
    notes: changed.slice(0, AI_INPUTS_CHANGED_NOTES_MAX),
    files: files.slice(0, AI_INPUTS_CHANGED_FILES_MAX),
  };
}

const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";

type SignalDocuments = {
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
};

/* The notes content type is not in the generated Strapi types, so the Document Service is reached by the csrm-ai-run cast. */
export type AiInputsSignalStrapi = { documents: unknown };

function documents(strapi: AiInputsSignalStrapi, uid: string): SignalDocuments {
  return (strapi.documents as unknown as (uid: string) => SignalDocuments)(uid);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relationId(value: unknown): string | null {
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0 ? value.documentId : null;
}

function instant(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === "string" && value.length > 0 ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** One target's baseline for both halves of the signal: its notes (Phase 13) and its files (D-36). */
type SignalBaselines = { notes: AiInputsBaseline; files: AttachmentInputsBaseline };

/*
 * The target's baseline run, used only when it is completed, context-wide and on this request. A summary the closed
 * parser refuses cannot say what the run included, so it reads as having included none: the signal then lists every
 * marked note and every file in the inputs rather than hiding one (fail visible; the signal gates nothing). A v1 summary
 * reads as included no notes, and a v1 or v2 summary as included no files, through the parser itself (D-28, D-35).
 */
async function runBaseline(strapi: AiInputsSignalStrapi, requestDocumentId: string, runId: string): Promise<SignalBaselines | null> {
  const run = await documents(strapi, RUN_UID).findOne({
    documentId: runId,
    fields: ["operation", "status", "contextSummary"],
    populate: { assessmentRequest: { fields: ["documentId"] } },
  });
  if (!run || run.status !== "completed" || !isContextWideAiOperation(run.operation) || relationId(run.assessmentRequest) !== requestDocumentId) return null;
  const summary = parseContextSummary(run.contextSummary);
  return {
    notes: { kind: "run", included: summary ? summary.notes.included.map(identity) : [] },
    files: { kind: "run", includedIds: summary ? summary.attachments.included.map((file) => file.documentId) : [] },
  };
}

/**
 * The request's currently marked notes, by sequence; at most a request's 500. A marked note this cannot name (no
 * documentId, an unknown part, no positive sequence or no readable posting time) fails the read with the context
 * loader's own error, never leaves the signal (IN-103, fail visible): a dropped note would hide a changed input while
 * the next generation refuses the same row, so the signal and the provider would disagree about it.
 */
async function loadMarkedNotes(strapi: AiInputsSignalStrapi, requestDocumentId: string): Promise<MarkedNote[]> {
  const rows = await documents(strapi, NOTE_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: requestDocumentId } }, changesAiInputs: { $eq: true } },
    fields: ["documentId", "sequence", "authorPart", "postedAt", "aiInputLog"],
    sort: ["sequence:asc", "id:asc"],
    limit: AI_INPUTS_CHANGED_NOTES_MAX,
  });
  return rows.map((row) => {
    const sequence = typeof row.sequence === "string" ? Number(row.sequence) : row.sequence;
    const postedAt = instant(row.postedAt);
    const part = row.authorPart;
    if (typeof row.documentId !== "string" || row.documentId.length === 0 || (part !== "requestor" && part !== "security-analyst")
      || typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1 || postedAt === null) {
      throw new Error("CSRM request note is invalid.");
    }
    return { documentId: row.documentId, part: part as AiInputNotePart, sequence, postedAt, aiInputLog: row.aiInputLog };
  });
}

/*
 * A record with no usable baseline run compares by its generation date, for its notes and its files alike. Any non-empty
 * stored value is a baseline; one that cannot be read as a date fails visible in the rule. No generation date is no
 * baseline.
 */
function generatedDateBaseline(generatedDate: unknown): SignalBaselines | null {
  const at = generatedDate instanceof Date
    ? (Number.isNaN(generatedDate.getTime()) ? "" : generatedDate.toISOString())
    : typeof generatedDate === "string" && generatedDate.length > 0 ? generatedDate : null;
  return at === null ? null : { notes: { kind: "generated-date", at }, files: { kind: "generated", generatedAt: at } };
}

/**
 * The signal for one target of one request. `baselineRunId` is the target's newest completed context-wide run (the
 * questionnaire's newest completed questionnaire-generation or questionnaire-proposals run,
 * `latestCompletedQuestionnaireContextRun`; the run the assessment's aiProvenance names). Without a usable
 * run the target's `generatedDate` is the baseline; with neither there is no signal and no note or file is read. The notes
 * and the files compare against the same baseline. Every producer (both scope services, and through them the request
 * read) reaches the signal through this loader only. Callers serve it to human Security Analysts only.
 */
export async function loadAiInputsChanged(
  strapi: AiInputsSignalStrapi,
  input: { requestDocumentId: string; baselineRunId: string | null; generatedDate: unknown },
): Promise<AiInputsChanged | null> {
  const { requestDocumentId, baselineRunId } = input;
  if (!requestDocumentId) return null;
  const run = baselineRunId ? await runBaseline(strapi, requestDocumentId, baselineRunId) : null;
  const baselines = run ?? generatedDateBaseline(input.generatedDate);
  if (baselines === null) return null;
  const markedNotes = await loadMarkedNotes(strapi, requestDocumentId);
  const changedFiles = await changedAttachmentInputs({ strapi, requestId: requestDocumentId, baseline: baselines.files });
  return aiInputsChanged({ markedNotes, changedFiles, baseline: baselines.notes });
}

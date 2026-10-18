import { ATTACHMENT_LIMITS } from "../../../csrm/files/attachment-policy";

/*
 * The request's files as the analyst questionnaire and assessment pages summarise them (Phase 14 D-27), and the files half
 * of "AI inputs changed since the last generation" (D-36). Read-only: nothing here writes, and nothing here decides what
 * reaches a provider (the context loader alone does, from the same current facts).
 *
 * A file is in the AI inputs exactly when the context loader would send it: `aiTextIncluded`, scanned `clean`, and not
 * removed. A removal ends the inclusion itself (14-08), so a removed file is never in the inputs.
 *
 * Imports: the attachment policy only, a leaf. This module must never import `ai-inputs-signal.ts` (which imports it), a
 * request, notes or assessment service: those form the CommonJS load cycle 13-16 documents.
 */

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";

type Row = Record<string, unknown>;
type AttachmentDocuments = { findMany: (query: Row) => Promise<Row[]> };

/* The attachment content type is reached through the Document Service cast the other signal modules use. */
export type AttachmentSignalStrapi = { documents: unknown };

function attachments(strapi: AttachmentSignalStrapi): AttachmentDocuments {
  return (strapi.documents as unknown as (uid: string) => AttachmentDocuments)(ATTACHMENT_UID);
}

function isRemoved(row: Row): boolean {
  return row.removedAt !== null && row.removedAt !== undefined;
}

/** Whether the file is in the AI inputs now, as the context loader reads it. */
function isIncluded(row: Row): boolean {
  return row.aiTextIncluded === true && row.scanStatus === "clean" && !isRemoved(row);
}

/** `RequestSummaryFiles`: how many files the request holds (not removed), and how many of those are in the AI inputs. */
export type AttachmentAnalystCounts = { count: number; included: number };

/**
 * The analyst summary's files figures (D-27): every file not removed, and those of them in the AI inputs. One read of the
 * request's stored files (at most ATTACHMENT_LIMITS.maxStoredPerRequest), never a file's name, text or digest. Callers serve
 * it to human Security Analysts only.
 */
export async function attachmentAnalystCounts(input: { strapi: AttachmentSignalStrapi; requestId: string }): Promise<AttachmentAnalystCounts> {
  const rows = await attachments(input.strapi).findMany({
    filters: { assessmentRequest: { documentId: { $eq: input.requestId } }, removedAt: { $null: true } },
    fields: ["documentId", "scanStatus", "removedAt", "aiTextIncluded"],
    limit: ATTACHMENT_LIMITS.maxStoredPerRequest,
  });
  const current = rows.filter((row) => !isRemoved(row));
  return { count: current.length, included: current.filter(isIncluded).length };
}

/** How a file's place in the AI inputs differs from the baseline generation's (D-36). */
export const ATTACHMENT_INPUT_CHANGES = Object.freeze(["included", "excluded", "removed"] as const);
export type AttachmentInputChangeKind = (typeof ATTACHMENT_INPUT_CHANGES)[number];

/** A changed file as the signal names it: identity, current name and change only, never its text or digest. */
export type AttachmentInputChange = { documentId: string; fileName: string; change: AttachmentInputChangeKind };

/**
 * What a target was last generated from, for its files: the documentIds its baseline run included (a v1 or v2 run included
 * none), or, for a record generated before run records existed, when it was generated. Null when the target has no baseline.
 */
export type AttachmentInputsBaseline =
  | { kind: "run"; includedIds: readonly string[] }
  | { kind: "generated"; generatedAt: string }
  | null;

/* When the file's text was extracted for the AI, from its stored facts; NaN when the facts cannot say. */
function extractedAt(row: Row): number {
  const facts = row.aiTextFacts;
  const at = typeof facts === "object" && facts !== null && !Array.isArray(facts) ? (facts as Row).extractedAt : undefined;
  return typeof at === "string" && at.length > 0 ? Date.parse(at) : Number.NaN;
}

function named(row: Row, change: AttachmentInputChangeKind): AttachmentInputChange {
  if (typeof row.documentId !== "string" || row.documentId.length === 0 || typeof row.fileName !== "string" || row.fileName.length === 0) {
    // Fail visible: a changed file the signal cannot name would hide a changed input (Phase 13 IN-103's rule).
    throw new Error("CSRM request attachment is invalid.");
  }
  return { documentId: row.documentId, fileName: row.fileName, change };
}

/**
 * The files half of the D-36 rule, in upload order. With no baseline, nothing is read and nothing is listed. Against a run:
 * a file in the AI inputs now that the run did not include is "included"; a file the run included that is not in the inputs
 * now is "removed" when it has been removed and "excluded" otherwise (excluded by an analyst, or no longer scanned clean). A
 * file the run named whose record is not among this request's files cannot be named or linked, so it is not listed. Against
 * the generation date of a record generated before run records existed: a file in the inputs whose text was extracted after
 * it is "included"; what such a generation included is not recorded, so nothing reads "excluded" or "removed". That fallback
 * fails visible, as Phase 13's notes do: extraction facts or a generation date that cannot be read count as changed.
 */
export async function changedAttachmentInputs(input: {
  strapi: AttachmentSignalStrapi;
  requestId: string;
  baseline: AttachmentInputsBaseline;
}): Promise<AttachmentInputChange[]> {
  const { baseline } = input;
  if (baseline === null) return [];
  const rows = await attachments(input.strapi).findMany({
    filters: { assessmentRequest: { documentId: { $eq: input.requestId } } },
    fields: ["documentId", "fileName", "uploadedAt", "scanStatus", "removedAt", "aiTextIncluded", "aiTextFacts"],
    sort: ["uploadedAt:asc", "id:asc"],
    limit: ATTACHMENT_LIMITS.maxStoredPerRequest,
  });
  const changed: AttachmentInputChange[] = [];
  if (baseline.kind === "run") {
    const includedThen = new Set(baseline.includedIds);
    for (const row of rows) {
      const now = isIncluded(row);
      const then = typeof row.documentId === "string" && includedThen.has(row.documentId);
      if (now && !then) changed.push(named(row, "included"));
      else if (!now && then) changed.push(named(row, isRemoved(row) ? "removed" : "excluded"));
    }
  } else {
    const generatedAt = Date.parse(baseline.generatedAt);
    for (const row of rows) {
      if (!isIncluded(row)) continue;
      const at = extractedAt(row);
      if (Number.isNaN(generatedAt) || Number.isNaN(at) || at > generatedAt) changed.push(named(row, "included"));
    }
  }
  return changed;
}

import { isReleased } from "./assessment-workflow";

/*
 * The one released-assessment record-read check (Phase 19 D-14; docs/contract-gaps/phase-19-exports-and-export-log.md,
 * "The Released-Assessment Record-Read Check"). It decides who may read a released assessment, and nothing else in
 * Strapi does: the released detail, risks and control-implementation reads, My risk assessments and its rating summary,
 * the analyst detail's `released` flag and the released-assessment export all call it, so the print report and every
 * export follow it with no change of their own.
 *
 * Two rules, each written once here:
 * - released (RELEASED_ASSESSMENT_FILTERS): the assessment is approved with its complete release facts (approval date,
 *   assessment date and approver, written by the release transition in one update), and its owning request is approved;
 * - readable (readableAssessmentFilters): a Requestor reads the assessments of the requests they raised; an analyst
 *   reads every assessment.
 *
 * Later phases change these rules here and nowhere else:
 * - Phase 17 widens "readable" to every current participant of the request (the Requestor, the nominated risk owners
 *   and the named executive approvers; G-12);
 * - Phase 17.1 widens "released" to an owning request that is `approved` or `closed` (G-13);
 * - Phase 19.1 adds this module's SQL twin, for notification readability, beside these two rules.
 *
 * Each read applies both rules twice: as Document Service filters, and again in memory on the record it gets back, so a
 * filter is never trusted alone.
 */

type RecordValue = Record<string, unknown>;

/** Who is reading: a Requestor, as the IdamBox User the policy resolved, or an analyst. */
export type AssessmentViewer = { kind: "requestor"; documentId: string } | { kind: "analyst" };

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (isRecord(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

/*
 * The released rule as Document Service filters. The release transition writes assessmentStatus, approvalDate,
 * assessmentDate and approvedBy in one update, so filtering the dates keeps a partially written legacy row out entirely:
 * a Requestor gets an honest "not found" instead of a 200 the client cannot parse.
 */
export const RELEASED_ASSESSMENT_FILTERS = deepFreeze({
  assessmentStatus: { $eq: "approved" },
  approvalDate: { $notNull: true },
  assessmentDate: { $notNull: true },
  approvedBy: { documentId: { $notNull: true } },
  assessmentRequest: { requestStatus: { $eq: "approved" } },
} as const);

/**
 * What a released read loads: the request with its requestor (the readable rule's fact), and who reviewed and released
 * the assessment. Never the generating analyst, which no released read serves (D-23, WR-304).
 */
export const RELEASED_ASSESSMENT_POPULATE = deepFreeze({
  assessmentRequest: { populate: { requestor: true } },
  reviewedBy: true,
  approvedBy: true,
} as const);

/** The readable rule as Document Service filters: a Requestor's own requests, or every assessment for an analyst. */
export function readableAssessmentFilters(viewer: AssessmentViewer): RecordValue {
  return viewer.kind === "requestor"
    ? { assessmentRequest: { requestor: { documentId: { $eq: viewer.documentId } } } }
    : {};
}

/**
 * Filters merged into one conjunction object, nested objects merged key by key, so both rules constrain the same
 * relation (the owning request) in one join, exactly as one hand-written filter would. A later value replaces an
 * earlier one only where both are not objects.
 */
export function composeAssessmentFilters(...filters: readonly RecordValue[]): RecordValue {
  const merged: RecordValue = {};
  for (const filter of filters) {
    for (const [key, value] of Object.entries(filter)) {
      const existing = merged[key];
      merged[key] = isRecord(existing) && isRecord(value) ? composeAssessmentFilters(existing, value) : isRecord(value) ? composeAssessmentFilters(value) : value;
    }
  }
  return merged;
}

/** True when `document` is a released assessment `viewer` may read: the in-memory twin of both filters. */
export function isReadableReleasedAssessment(document: unknown, viewer: AssessmentViewer): document is RecordValue {
  if (!isRecord(document) || !isReleased(document)) return false;
  if (document.assessmentDate === null || document.assessmentDate === undefined) return false;
  const request = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
  if (request?.requestStatus !== "approved") return false;
  if (viewer.kind === "analyst") return true;
  const requestor = isRecord(request.requestor) ? request.requestor : null;
  return typeof requestor?.documentId === "string" && requestor.documentId === viewer.documentId;
}

type AssessmentDocuments = { findOne: (query: RecordValue) => Promise<RecordValue | null> };

/**
 * The released assessment `documentId` as `viewer` may read it, or null: one read with both rules as filters, then the
 * in-memory check of what came back. A Requestor's `populate` must load the request's requestor (the default does).
 */
export async function findReadableReleasedAssessment(input: {
  documents: AssessmentDocuments;
  viewer: AssessmentViewer;
  documentId: string;
  populate?: RecordValue;
}): Promise<RecordValue | null> {
  const document = await input.documents.findOne({
    documentId: input.documentId,
    filters: composeAssessmentFilters(RELEASED_ASSESSMENT_FILTERS, readableAssessmentFilters(input.viewer)),
    // A fresh copy: the store never receives the shared, frozen constant.
    populate: structuredClone(input.populate ?? RELEASED_ASSESSMENT_POPULATE),
  });
  return isReadableReleasedAssessment(document, input.viewer) ? document : null;
}

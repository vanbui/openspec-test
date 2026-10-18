import { attachmentAnalystCounts, type AttachmentAnalystCounts } from "../../csrm-request-attachment/services/attachment-ai-signal";
import { loadNotesRequest, summarizeRequestNotes, type NotesStrapi } from "../../csrm-request-note/services/request-notes";
import { pickUpState, type PickUpState } from "./request-assignment-policy";
import { PERSON_FIELDS, projectPerson, type Person } from "./request-people";

/*
 * The request summary the analyst questionnaire and assessment reads carry (Phase 13 D-16, D-25; REQ-08 criterion 1):
 * who holds the request and whether the viewer may pick it up, the notes figures, and (Phase 14 D-27) how many files the
 * request holds and how many are in the AI inputs, for the page to server-render beside the originating request link. A
 * Requestor's read, and any viewer who is not a human Security Analyst, gets null for all three, and nothing about the
 * assignment, the notes or the files is read for them.
 *
 * Only the two controllers import this module. It reaches the assignment policy and the notes service, which sit in the
 * CommonJS load cycle through collection-scope (13-16's lesson), so no service may import it.
 */

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";

/** `RequestSummaryAssignment`: the assignee as a documentId and a display name, and the viewer's pick-up state. */
export type RequestSummaryAssignment = { assignee: Person | null; pickUp: PickUpState };
/** `RequestSummaryNotes`: how many notes the request holds, and how many are new to the viewer. */
export type RequestSummaryNotes = { total: number; unread: number };
/** `RequestSummaryFiles` (Phase 14 D-27): the files not removed, and how many of them are in the AI inputs. */
export type RequestSummaryFiles = AttachmentAnalystCounts;
export type RequestSummaryFacts = { assignment: RequestSummaryAssignment | null; notes: RequestSummaryNotes | null; files: RequestSummaryFiles | null };

export const NO_REQUEST_SUMMARY_FACTS: RequestSummaryFacts = Object.freeze({ assignment: null, notes: null, files: null });

type RecordValue = Record<string, unknown>;
type RequestDocuments = { findOne: (query: RecordValue) => Promise<RecordValue | null> };

function relationId(value: unknown): string | null {
  return typeof value === "object" && value !== null && typeof (value as RecordValue).documentId === "string"
    ? (value as RecordValue).documentId as string
    : null;
}

/**
 * The request summary facts for `viewer`, a human Security Analyst reading through the analyst grant; NO_REQUEST_SUMMARY_FACTS
 * for anyone else or a request that is gone. The pick-up state comes from pickUpState, so the page offers a pick-up exactly
 * where the queue and the assignment operation do (13-RESEARCH Pitfall 9); the notes figures come from the request read's
 * summarizeRequestNotes, by the same unread rule. Reading writes nothing.
 */
export async function loadAnalystRequestSummaryFacts(
  strapi: NotesStrapi,
  requestDocumentId: string | null,
  /** `eligibleHumanAnalyst` (WR-101) decides the pick-up state, as the assignment operation decides it. */
  viewer: { documentId: string | null; humanAnalyst: boolean; eligibleHumanAnalyst: boolean },
): Promise<RequestSummaryFacts> {
  if (!viewer.humanAnalyst || !viewer.documentId || !requestDocumentId) return NO_REQUEST_SUMMARY_FACTS;
  const caller = { documentId: viewer.documentId, humanAnalyst: true };
  const request = await (strapi.documents as unknown as (uid: string) => RequestDocuments)(REQUEST_UID).findOne({
    documentId: requestDocumentId,
    fields: ["requestStatus"],
    populate: { requestor: { fields: ["documentId"] }, assignedAnalyst: { fields: [...PERSON_FIELDS] } },
  });
  if (!request) return NO_REQUEST_SUMMARY_FACTS;
  const assignee = projectPerson(request.assignedAnalyst);
  const pickUp = pickUpState(
    { requestStatus: request.requestStatus, requestorDocumentId: relationId(request.requestor), assigneeDocumentId: assignee?.documentId ?? null },
    { documentId: viewer.documentId, humanAnalyst: viewer.eligibleHumanAnalyst },
  );
  const notesRequest = await loadNotesRequest(strapi, requestDocumentId);
  const notes = notesRequest ? await summarizeRequestNotes(strapi, notesRequest, caller) : null;
  const files = await attachmentAnalystCounts({ strapi, requestId: requestDocumentId });
  return { assignment: { assignee, pickUp }, notes: notes ? { total: notes.total, unread: notes.unread } : null, files };
}

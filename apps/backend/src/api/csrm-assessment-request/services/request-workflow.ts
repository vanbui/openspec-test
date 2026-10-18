export type AssessmentRequestActor = "requestor" | "analyst";

const REQUESTOR_WRITABLE_FIELDS = [
  "title",
  "description",
  "assessmentType",
  "division",
  "businessUnit",
  "businessPurpose",
  "businessCriticality",
  "thirdPartyInvolvement",
  "thirdPartyDetails",
  "regulatoryRequirements",
  "dueDate",
  "informationSystems",
  "informationAssets",
] as const;

type WorkflowData = Record<string, unknown>;
type PersistedRequest = WorkflowData & { requestStatus?: unknown };
type DocumentService = {
  findOne: (query: Record<string, unknown>) => Promise<PersistedRequest | null>;
  update: (query: { documentId: string; data: WorkflowData; populate?: WorkflowData }) => Promise<PersistedRequest>;
};
type WorkflowStrapi = RequestLockStrapi & {
  documents: (uid: string) => DocumentService;
};

import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { withRequestLock, type RequestLockStrapi } from "./request-lock";
import { PERSON_FIELDS } from "./request-people";
import { REVERT_REASON_MAX_LENGTH, parseRevertReason as parseSharedRevertReason } from "./revert-reason";

export { REVERT_REASON_MAX_LENGTH } from "./revert-reason";

export class AssessmentRequestWorkflowError extends Error {
  constructor(
    message = "CSRM assessment request workflow is denied.",
    readonly status = 400,
    readonly reason?: ConflictReason,
  ) {
    super(message);
    this.name = "AssessmentRequestWorkflowError";
  }
}

export function isRecord(value: unknown): value is WorkflowData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRevertReason(body: unknown): string {
  try {
    return parseSharedRevertReason(body, "CSRM request");
  } catch (error) {
    throw new AssessmentRequestWorkflowError(error instanceof Error ? error.message : "CSRM request reversal data is invalid.");
  }
}

export async function revertRequestToDraft(input: {
  strapi: WorkflowStrapi;
  requestDocumentId: string;
  actorDocumentId: string;
  body: unknown;
  now?: Date;
}): Promise<PersistedRequest> {
  const reason = parseRevertReason(input.body);
  if (!input.requestDocumentId || !input.actorDocumentId) throw new AssessmentRequestWorkflowError();
  // The shared per-request lock (request-lock.ts): every write to one request serialises against this one.
  return withRequestLock(input.strapi, input.requestDocumentId, async () => {
    const requests = input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request");
    const request = await requests.findOne({
      documentId: input.requestDocumentId,
      populate: { questionnaire: true, assessment: true },
    });
    if (!request) throw new AssessmentRequestWorkflowError("CSRM assessment request was not found.");
    if (request.requestStatus !== "submitted") {
      throw new AssessmentRequestWorkflowError("CSRM assessment request cannot be reverted to draft.", 409, "REQUEST_NOT_SUBMITTED");
    }
    if (request.questionnaire || request.assessment) {
      throw new AssessmentRequestWorkflowError("CSRM assessment request cannot be reverted to draft.", 409, "REQUEST_WORK_STARTED");
    }
    return requests.update({
      documentId: input.requestDocumentId,
      data: {
        requestStatus: "draft",
        submittedDate: null,
        revertReason: reason,
        revertedAt: (input.now ?? new Date()).toISOString(),
        revertedBy: input.actorDocumentId,
      },
      // The response is the authoritative reverted request, and the reverting
      // identity is a relation: without populating it the caller receives an
      // audit fact it cannot read. It is read as a person only (D-04); the
      // controller projects it to a documentId and a display name.
      populate: { revertedBy: { fields: [...PERSON_FIELDS] } },
    });
  });
}

export function requestorWritableData(data: unknown): WorkflowData {
  if (!isRecord(data)) throw new AssessmentRequestWorkflowError("CSRM assessment request data is invalid.");
  const writable: WorkflowData = {};
  for (const field of REQUESTOR_WRITABLE_FIELDS) {
    if (data[field] !== undefined) writable[field] = data[field];
  }
  return writable;
}

/**
 * The data of every new assessment request, whoever creates it (T-08-A1). Requestor is every
 * identity's birthright, so the Security Analyst and the analyst service agent create as Requestors
 * too: the request belongs to the trusted identity that creates it, and the published create body
 * is the only writable surface. The number, the status, the submitted date and every other fact
 * are the server's own. Without a trusted identity nothing is created.
 */
export function prepareRequestorCreate(
  data: unknown,
  requestorDocumentId: unknown,
  requestNumber: string,
): WorkflowData {
  if (typeof requestorDocumentId !== "string" || requestorDocumentId.length === 0) {
    throw new AssessmentRequestWorkflowError("CSRM assessment request data is invalid.");
  }
  return {
    ...requestorWritableData(data),
    requestor: requestorDocumentId,
    requestNumber,
    requestStatus: "draft",
    submittedDate: null,
  };
}

export function prepareRequestorUpdate(
  persisted: PersistedRequest,
  data: unknown,
  submittedAt: Date = new Date(),
): WorkflowData {
  if (persisted.requestStatus !== "draft") throw new AssessmentRequestWorkflowError();
  if (!isRecord(data)) throw new AssessmentRequestWorkflowError("CSRM assessment request data is invalid.");

  const targetStatus = data.requestStatus;
  if (targetStatus !== undefined && targetStatus !== "draft" && targetStatus !== "submitted") {
    throw new AssessmentRequestWorkflowError();
  }

  const writable = requestorWritableData(data);
  if (targetStatus === "submitted") {
    return { ...writable, requestStatus: "submitted", submittedDate: submittedAt.toISOString() };
  }
  return writable;
}

/**
 * The data an analyst actor (the Security Analyst or the analyst service agent) may write to a
 * request (T-08-A2). It is the published update body, exactly as for a Requestor: the
 * Requestor-writable fields and the submission intent. The owner, the request number, the sponsor,
 * the submitted date, the reversal facts and the questionnaire and assessment links are never
 * taken from a body, so no analyst write can move a request to another Requestor.
 *
 * The one difference from a Requestor is reach, which the policy grants: an analyst may amend the
 * writable fields of any request, past draft included. A status change is still only the
 * Requestor's transition, the submission of a draft dated by the server; any other status is
 * refused.
 *
 * Phase 13 D-20 (08-SECURITY.md O-5): only the request's own requestor submits it. An analyst
 * submitting a request someone else raised is refused with 403 NOT_REQUEST_REQUESTOR before
 * anything else is decided, so the first line alone attests its own request; an analyst who raised
 * the request still submits it (T-08-A2). Every other status keeps the Requestor path, which answers
 * 400 for anything but draft or submitted.
 */
export function prepareAnalystUpdate(
  persisted: PersistedRequest,
  data: unknown,
  submittedAt: Date = new Date(),
  actorDocumentId?: unknown,
): WorkflowData {
  if (!isRecord(data)) throw new AssessmentRequestWorkflowError("CSRM assessment request data is invalid.");
  if (data.requestStatus === "submitted") {
    const requestor = isRecord(persisted.requestor) ? persisted.requestor.documentId : undefined;
    if (typeof actorDocumentId !== "string" || actorDocumentId.length === 0 || requestor !== actorDocumentId) {
      throw new AssessmentRequestWorkflowError("CSRM assessment request submission is denied.", 403, "NOT_REQUEST_REQUESTOR");
    }
  }
  return data.requestStatus === undefined
    ? requestorWritableData(data)
    : prepareRequestorUpdate(persisted, data, submittedAt);
}

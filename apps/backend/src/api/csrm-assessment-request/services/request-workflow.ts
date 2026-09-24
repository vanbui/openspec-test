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
type WorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: {
    transaction: <T>(work: (context: { trx: unknown }) => Promise<T>) => Promise<T>;
    queryBuilder: (uid: string) => {
      select: (columns: string[]) => unknown;
      where: (where: WorkflowData) => unknown;
      forUpdate: () => unknown;
      transacting: (transaction: unknown) => unknown;
      execute: <T>() => Promise<T>;
    };
  };
};

import { REVERT_REASON_MAX_LENGTH, parseRevertReason as parseSharedRevertReason } from "./revert-reason";

export { REVERT_REASON_MAX_LENGTH } from "./revert-reason";
const requestRevertTails = new Map<string, Promise<void>>();

export class AssessmentRequestWorkflowError extends Error {
  constructor(message = "CSRM assessment request workflow is denied.", readonly status = 400) {
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

async function serializeRequestRevert<T>(documentId: string, work: () => Promise<T>): Promise<T> {
  const previous = requestRevertTails.get(documentId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  requestRevertTails.set(documentId, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (requestRevertTails.get(documentId) === tail) requestRevertTails.delete(documentId);
  }
}

async function lockRequest(strapi: WorkflowStrapi, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder("api::csrm-assessment-request.csrm-assessment-request");
  query.select(["id"]);
  query.where({ documentId });
  query.forUpdate();
  query.transacting(transaction);
  await query.execute<unknown>();
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
  return serializeRequestRevert(input.requestDocumentId, () => input.strapi.db.transaction(async ({ trx }) => {
    await lockRequest(input.strapi, input.requestDocumentId, trx);
    const requests = input.strapi.documents("api::csrm-assessment-request.csrm-assessment-request");
    const request = await requests.findOne({
      documentId: input.requestDocumentId,
      populate: { questionnaire: true, assessment: true },
    });
    if (!request) throw new AssessmentRequestWorkflowError("CSRM assessment request was not found.");
    if (request.requestStatus !== "submitted" || request.questionnaire || request.assessment) {
      throw new AssessmentRequestWorkflowError("CSRM assessment request cannot be reverted to draft.", 409);
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
      // audit fact it cannot read.
      populate: { revertedBy: true },
    });
  }));
}

export function requestorWritableData(data: unknown): WorkflowData {
  if (!isRecord(data)) throw new AssessmentRequestWorkflowError("CSRM assessment request data is invalid.");
  const writable: WorkflowData = {};
  for (const field of REQUESTOR_WRITABLE_FIELDS) {
    if (data[field] !== undefined) writable[field] = data[field];
  }
  return writable;
}

export function prepareRequestorCreate(
  data: unknown,
  requestorDocumentId: string,
  requestNumber: string,
): WorkflowData {
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

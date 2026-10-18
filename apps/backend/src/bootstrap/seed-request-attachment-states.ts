import { createHash } from "node:crypto";

import type { Core } from "@strapi/strapi";

import { appendAttachmentEvent, ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, type AttachmentEventLog } from "../api/csrm-request-attachment/services/attachment-event-log";
import { attachmentConfigOf } from "../csrm/files/attachment-config";
import type { AttachmentType } from "../csrm/files/attachment-policy";
import { createAttachmentStorage, type AttachmentStorageStrapi } from "../csrm/files/storage-port";
import { developmentIdentityEnabled } from "../utils/development-identity-enabled";
import { seedRequestDetails } from "./seed-request-details";

/*
 * Phase 14 stage B (WR-605; 14-UI-SPEC "Accessibility contract", Automated): the request files in the states no browser
 * journey can reach, so the browser suite can scan them at 375 and 1440 on both request pages. The development scanner
 * double passes or refuses a file at once, so a file never waits for its malware check and none is ever blocked after it
 * was stored (D-14 keeps quarantine in the Strapi suite), and releasing a request in the browser takes the whole
 * questionnaire and assessment journey.
 *
 * - RAR-E2E-FILES-STATES-001, Jane's, submitted: a file waiting for its malware check and a blocked one. The waiting
 *   file has no stored bytes on purpose: every start re-scans each waiting file (D-13), and the double would release one
 *   whose bytes it could read. With none, the re-scan reads it as not scanned and it stays waiting, as a file does while
 *   the scanner is down. A blocked file has no bytes in any case (D-21); its detection is CSRM's own test signature's
 *   name, never the industry test string. The waiting file came with a note Jane wrote after submitting (14-UI-SPEC
 *   §4.2), so the note's file chip carries the longest state badge, `Waiting for malware check`, for the browser suite
 *   to measure at 375 (14-UI-REVIEW UI-01).
 * - RAR-E2E-FILES-RELEASED-001, Jane's, released with its assessment: one available file, stored through the configured
 *   storage, so the closed (read-only) Files section lists a file that can still be downloaded.
 *
 * Both are read-only fixtures: no journey may change them, so both browser projects read the same states. Like every
 * development fixture they are seeded only behind IDAMBOX_SEED_CSRM and the development identity, and only when
 * attachments are configured (local storage and the development double in the browser suite's run). Each start
 * reconciles them to these states; a stored file is kept rather than stored again.
 */

const OWNER_EMAIL = "jane.doe@idambox.com";
const ANALYST_EMAIL = "bob.doe@idambox.com";
const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";
/** The scanner identity on the seeded records, so nobody mistakes them for a real scanner's verdicts. */
const FIXTURE_ENGINE = "csrm-seed-fixture";

export const REQUEST_ATTACHMENT_STATES_FIXTURE = {
  statesRequestNumber: "RAR-E2E-FILES-STATES-001",
  statesRequestTitle: "Remote support access for the payroll servers",
  pendingFileName: "provider-assurance-report.pdf",
  pendingNoteBody: "Attached the provider assurance report for the remote support service.",
  blockedFileName: "remote-support-tool.docx",
  blockedDetection: "Csrm.Test.Signature",
  releasedRequestNumber: "RAR-E2E-FILES-RELEASED-001",
  releasedRequestTitle: "Finance records archive migration",
  releasedAssessmentNumber: "ASM-E2E-FILES-RELEASED-001",
  releasedFileName: "retention-schedule.txt",
} as const;

type SeedDocument = { documentId: string; [key: string]: unknown };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

async function requiredUser(userService: SeedDocumentService, email: string): Promise<SeedDocument> {
  const [user] = await userService.findMany({ filters: { email: { $eq: email } }, limit: 1 });
  if (!user) throw new Error(`Request attachment states fixture user ${email} was not found.`);
  return user;
}

async function reconcile(documentService: SeedDocumentService, filters: Record<string, unknown>, data: Record<string, unknown>): Promise<SeedDocument> {
  const [existing] = await documentService.findMany({ filters, limit: 1 });
  return existing ? documentService.update({ documentId: existing.documentId, data }) : documentService.create({ data });
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function eventLog(by: string, at: string, events: ReadonlyArray<{ type: "uploaded" | "quarantined" | "blocked" | "scan-verdict"; verdict: "clean" | "infected" | "not-scanned"; detection?: string }>): AttachmentEventLog {
  let log: AttachmentEventLog | null = null;
  for (const event of events) {
    log = appendAttachmentEvent(log, {
      schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION,
      type: event.type,
      by: event.type === "uploaded" || event.type === "quarantined" ? by : null,
      at,
      engine: FIXTURE_ENGINE,
      verdict: event.verdict,
      ...(event.detection ? { detection: event.detection } : {}),
    });
  }
  if (log === null) throw new Error("Request attachment states fixture needs at least one event.");
  return log;
}

/** The fields every seeded file shares: Jane added it as the Requestor, with no note unless the file names one. */
function fileFields(input: { requestId: string; ownerId: string; fileName: string; fileType: AttachmentType; bytes: Uint8Array; uploadedAt: string }) {
  return {
    fileName: input.fileName,
    fileType: input.fileType,
    byteSize: input.bytes.byteLength,
    sha256: sha256(input.bytes),
    uploaderPart: "requestor",
    uploadedAt: input.uploadedAt,
    removedAt: null,
    removedBy: null,
    aiTextIncluded: false,
    aiText: null,
    aiTextFacts: null,
    note: null,
    assessmentRequest: input.requestId,
    uploadedBy: input.ownerId,
  };
}

async function existingFile(attachments: SeedDocumentService, requestId: string, fileName: string): Promise<SeedDocument | null> {
  const [record] = await attachments.findMany({
    filters: { fileName: { $eq: fileName }, assessmentRequest: { documentId: { $eq: requestId } } },
    populate: { file: { fields: ["id"] } },
    limit: 1,
  });
  return record ?? null;
}

export async function seedRequestAttachmentStates(strapi: Core.Strapi): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) return;
  if (!attachmentConfigOf(strapi).available) {
    strapi.log.info("CSRM request attachment state fixtures skipped: attachments are not configured.");
    return;
  }
  const fixture = REQUEST_ATTACHMENT_STATES_FIXTURE;
  const userService = service(strapi, "api::idambox-user.idambox-user");
  const requestService = service(strapi, "api::csrm-assessment-request.csrm-assessment-request");
  const assessmentService = service(strapi, "api::csrm-assessment.csrm-assessment");
  const attachments = service(strapi, ATTACHMENT_UID);
  const notes = service(strapi, NOTE_UID);
  const [owner, analyst] = await Promise.all([requiredUser(userService, OWNER_EMAIL), requiredUser(userService, ANALYST_EMAIL)]);

  // A submitted request with a file waiting for its malware check and a blocked file (14-UI-SPEC §3.4).
  const statesRequest = await reconcile(requestService, { requestNumber: { $eq: fixture.statesRequestNumber } }, {
    requestNumber: fixture.statesRequestNumber,
    title: fixture.statesRequestTitle,
    ...seedRequestDetails(fixture.statesRequestNumber),
    businessCriticality: "High",
    submittedDate: "2026-09-10T00:00:00.000Z",
    requestStatus: "submitted",
    requestor: owner.documentId,
  });
  // Jane's note, the request's first, which the waiting file came with (§4.2: the note posts first, its files follow).
  const notedAt = "2026-09-10T02:14:00.000Z";
  const pendingNote = await reconcile(notes, { sequence: { $eq: 1 }, assessmentRequest: { documentId: { $eq: statesRequest.documentId } } }, {
    body: fixture.pendingNoteBody,
    authorPart: "requestor",
    sequence: 1,
    postedAt: notedAt,
    changesAiInputs: false,
    aiInputLog: null,
    assessmentRequest: statesRequest.documentId,
    author: owner.documentId,
  });
  const pendingAt = "2026-09-10T02:15:00.000Z";
  const pendingBytes = Buffer.from("%PDF-1.4\n% Provider assurance report (fixture: never stored)\n", "latin1");
  await reconcile(attachments, { fileName: { $eq: fixture.pendingFileName }, assessmentRequest: { documentId: { $eq: statesRequest.documentId } } }, {
    ...fileFields({ requestId: statesRequest.documentId, ownerId: owner.documentId, fileName: fixture.pendingFileName, fileType: "pdf", bytes: pendingBytes, uploadedAt: pendingAt }),
    note: pendingNote.documentId,
    file: null,
    scanStatus: "pending",
    scanCheckedAt: null,
    scanEngine: FIXTURE_ENGINE,
    scanDetection: null,
    scanAttempts: 1,
    eventLog: eventLog(owner.documentId, pendingAt, [{ type: "uploaded", verdict: "not-scanned" }, { type: "quarantined", verdict: "not-scanned" }]),
  });
  const blockedAt = "2026-09-10T02:20:00.000Z";
  const blockedBytes = Buffer.from("PK fixture: the blocked file's bytes were deleted and are never stored", "latin1");
  await reconcile(attachments, { fileName: { $eq: fixture.blockedFileName }, assessmentRequest: { documentId: { $eq: statesRequest.documentId } } }, {
    ...fileFields({ requestId: statesRequest.documentId, ownerId: owner.documentId, fileName: fixture.blockedFileName, fileType: "docx", bytes: blockedBytes, uploadedAt: blockedAt }),
    file: null,
    scanStatus: "blocked",
    scanCheckedAt: blockedAt,
    scanEngine: FIXTURE_ENGINE,
    scanDetection: fixture.blockedDetection,
    scanAttempts: 2,
    eventLog: eventLog(owner.documentId, blockedAt, [
      { type: "uploaded", verdict: "not-scanned" },
      { type: "quarantined", verdict: "not-scanned" },
      { type: "blocked", verdict: "infected", detection: fixture.blockedDetection },
    ]),
  });

  // A released request with its assessment, holding one available file: the closed, read-only Files section (§3.6).
  const releasedRequest = await reconcile(requestService, { requestNumber: { $eq: fixture.releasedRequestNumber } }, {
    requestNumber: fixture.releasedRequestNumber,
    title: fixture.releasedRequestTitle,
    ...seedRequestDetails(fixture.releasedRequestNumber),
    businessCriticality: "Moderate",
    submittedDate: "2026-08-20T00:00:00.000Z",
    requestStatus: "approved",
    requestor: owner.documentId,
  });
  await reconcile(assessmentService, { assessmentNumber: { $eq: fixture.releasedAssessmentNumber } }, {
    assessmentNumber: fixture.releasedAssessmentNumber,
    assessmentStatus: "approved",
    summary: "Released assessment fixture whose request holds a file after release.",
    overallRating: "Low",
    overallControlEffectiveness: "Effective",
    generatedDate: "2026-08-21T00:00:00.000Z",
    assessmentDate: "2026-08-22T00:00:00.000Z",
    approvalDate: "2026-08-23T00:00:00.000Z",
    generatedBy: analyst.documentId,
    reviewedBy: analyst.documentId,
    approvedBy: analyst.documentId,
    assessmentRequest: releasedRequest.documentId,
  });
  const releasedAt = "2026-08-20T03:00:00.000Z";
  const releasedBytes = Buffer.from("Finance records retention schedule\nAccounts payable: 7 years\nPayroll: 7 years\nBank statements: 7 years\n", "utf8");
  const stored = await existingFile(attachments, releasedRequest.documentId, fixture.releasedFileName);
  const storedFile = stored && typeof stored.file === "object" && stored.file !== null && typeof (stored.file as { id?: unknown }).id === "number"
    ? (stored.file as { id: number }).id
    : null;
  const fileId = storedFile ?? (await createAttachmentStorage(strapi as unknown as AttachmentStorageStrapi).put(releasedBytes, { type: "txt" })).fileId;
  await reconcile(attachments, { fileName: { $eq: fixture.releasedFileName }, assessmentRequest: { documentId: { $eq: releasedRequest.documentId } } }, {
    ...fileFields({ requestId: releasedRequest.documentId, ownerId: owner.documentId, fileName: fixture.releasedFileName, fileType: "txt", bytes: releasedBytes, uploadedAt: releasedAt }),
    file: fileId,
    scanStatus: "clean",
    scanCheckedAt: releasedAt,
    scanEngine: FIXTURE_ENGINE,
    scanDetection: null,
    scanAttempts: 0,
    eventLog: eventLog(owner.documentId, releasedAt, [{ type: "uploaded", verdict: "clean" }]),
  });

  strapi.log.info("CSRM request attachment state fixtures reconciled.");
}

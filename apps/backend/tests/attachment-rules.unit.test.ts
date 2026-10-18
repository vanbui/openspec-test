import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAiDataPolicy } from "../src/csrm/ai/data-policy";
import {
  acceptsAttachments,
  addRefusalFor,
  aiInputRefusalFor,
  attachmentStateOf,
  attachmentWindow,
  canRemoveAttachment,
  canRestoreAttachment,
  noteAcceptsAttachments,
  readersCallerFacts,
  readersRequestFacts,
} from "../src/api/csrm-request-attachment/services/attachment-rules";
import { canUseRequestNotes } from "../src/api/csrm-request-note/services/request-notes-policy";

/*
 * Phase 14 (D-10, D-16 to D-19): the attachment rules, without Strapi. The ATTACHMENTS_NOT_CONFIGURED refusal is
 * proven here and in attachment-config.unit.test.ts only: it needs a runtime outside development, which no mounted
 * harness provides (accepted by the orchestrator, 2026-10-01).
 */

const JANE = "user-jane";
const BOB = "user-bob";
const REQUEST = "request-1";

const jane = { documentId: JANE, humanAnalyst: false };
const bob = { documentId: BOB, humanAnalyst: true };

function request(requestStatus: string) {
  return { requestorDocumentId: JANE, requestStatus };
}

test("the window is intake for a draft, after submission while the request takes notes, and closed otherwise (D-16)", () => {
  assert.equal(attachmentWindow({ requestStatus: "draft" }), "intake");
  for (const status of ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"]) {
    assert.equal(attachmentWindow({ requestStatus: status }), "after-submission", status);
  }
  for (const status of ["approved", "closed"]) assert.equal(attachmentWindow({ requestStatus: status }), "closed", status);
  // An unknown status fails closed.
  for (const status of ["bogus", "", null, undefined, 3]) assert.equal(attachmentWindow({ requestStatus: status }), "closed", String(status));
});

test("an add is refused in order: not configured, closed, not submitted for an analyst on a draft, the active limit, then the lifetime limit (D-10, D-15, D-16)", () => {
  const base = { activeCount: 0, storedCount: 0, configured: true };
  assert.equal(addRefusalFor({ ...base, request: request("approved"), caller: jane, activeCount: 20, storedCount: 60, configured: false }), "ATTACHMENTS_NOT_CONFIGURED");
  assert.equal(addRefusalFor({ ...base, request: request("approved"), caller: jane, activeCount: 20, storedCount: 60 }), "ATTACHMENTS_CLOSED");
  assert.equal(addRefusalFor({ ...base, request: request("closed"), caller: bob }), "ATTACHMENTS_CLOSED");
  assert.equal(addRefusalFor({ ...base, request: request("draft"), caller: bob, activeCount: 20, storedCount: 60 }), "REQUEST_NOT_SUBMITTED");
  assert.equal(addRefusalFor({ ...base, request: request("draft"), caller: jane, activeCount: 20, storedCount: 60 }), "ATTACHMENT_LIMIT_REACHED");
  assert.equal(addRefusalFor({ ...base, request: request("submitted"), caller: bob, activeCount: 20, storedCount: 20 }), "ATTACHMENT_LIMIT_REACHED");
  assert.equal(addRefusalFor({ ...base, request: request("submitted"), caller: jane, activeCount: 19, storedCount: 60 }), "ATTACHMENT_LIFETIME_LIMIT_REACHED");
  assert.equal(addRefusalFor({ ...base, request: request("draft"), caller: jane, activeCount: 19, storedCount: 59 }), null);
  assert.equal(addRefusalFor({ ...base, request: request("under-review"), caller: bob, activeCount: 19, storedCount: 59 }), null);
  // G-1: an analyst who raised the draft is its requestor.
  assert.equal(addRefusalFor({ ...base, request: { requestorDocumentId: BOB, requestStatus: "draft" }, caller: bob }), null);
});

/*
 * IN-103 (D-16's one predicate): the add's window and caller decision is acceptsAttachments, not a second copy of it.
 * For every status and every kind of caller, addRefusalFor admits the add (with room and configured) exactly when
 * acceptsAttachments does, and refuses it with the window's reason otherwise.
 */
test("an add's window and caller decision is acceptsAttachments for every status and caller (IN-103, D-16)", () => {
  const base = { activeCount: 0, storedCount: 0, configured: true };
  const callers = [
    ["REQUESTOR", jane],
    ["HUMAN_ANALYST", bob],
    ["OTHER_PERSON", { documentId: "user-other", humanAnalyst: false }],
    ["NO_IDENTITY", { documentId: "", humanAnalyst: false }],
  ] as const;
  const requests = [
    ...["draft", "submitted", "questionnaire-in-progress", "under-review", "approved", "closed", "bogus"].map((status) => request(status)),
    // G-1: an analyst who raised the request is its requestor.
    { requestorDocumentId: BOB, requestStatus: "draft" },
    { requestorDocumentId: BOB, requestStatus: "submitted" },
    { requestorDocumentId: null, requestStatus: "submitted" },
  ];
  for (const target of requests) {
    for (const [label, caller] of callers) {
      const accepted = acceptsAttachments(target, caller);
      const refusal = addRefusalFor({ ...base, request: target, caller });
      const where = `${label}_ON_${String(target.requestorDocumentId)}_${String(target.requestStatus)}`;
      assert.equal(refusal === null, accepted, `ADD_DECISION_DIFFERS_FROM_ACCEPTS_ATTACHMENTS_${where}`);
      if (!accepted) {
        assert.equal(refusal, attachmentWindow(target) === "intake" ? "REQUEST_NOT_SUBMITTED" : "ATTACHMENTS_CLOSED", `UNEXPECTED_REASON_${where}`);
      }
    }
  }
});

test("a note takes files only when it is the caller's own, on the same request, posted within the last 60 minutes (D-17)", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const note = (postedAt: string, overrides: Partial<{ requestDocumentId: string | null; authorDocumentId: string | null }> = {}) => ({
    requestDocumentId: REQUEST, authorDocumentId: JANE, postedAt, ...overrides,
  });
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(0)), requestId: REQUEST, callerId: JANE, now }), null);
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(59)), requestId: REQUEST, callerId: JANE, now }), null);
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(60)), requestId: REQUEST, callerId: JANE, now }), null);
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(61)), requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID");
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(5)), requestId: REQUEST, callerId: BOB, now }), "ATTACHMENT_NOTE_INVALID", "ANOTHER_AUTHOR");
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(5), { authorDocumentId: null }), requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID", "NO_AUTHOR");
  assert.equal(noteAcceptsAttachments({ note: note(minutesAgo(5), { requestDocumentId: "request-2" }), requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID", "ANOTHER_REQUEST");
  assert.equal(noteAcceptsAttachments({ note: null, requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID", "NO_NOTE");
  assert.equal(noteAcceptsAttachments({ note: note("not a time"), requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID", "NO_TIME");
  assert.equal(noteAcceptsAttachments({ note: note(new Date(now.getTime() + 120_000).toISOString()), requestId: REQUEST, callerId: JANE, now }), "ATTACHMENT_NOTE_INVALID", "FUTURE");
});

test("a file's state is removed, then blocked, then pending, then unavailable, then available, and nothing unclean is available (D-13, D-20, D-21)", () => {
  assert.equal(attachmentStateOf({ scanStatus: "blocked", removedAt: "2026-10-10T00:00:00.000Z", hasFile: false }), "removed");
  assert.equal(attachmentStateOf({ scanStatus: "clean", removedAt: "2026-10-10T00:00:00.000Z", hasFile: true }), "removed");
  assert.equal(attachmentStateOf({ scanStatus: "blocked", removedAt: null, hasFile: false }), "blocked");
  assert.equal(attachmentStateOf({ scanStatus: "pending", removedAt: null, hasFile: true }), "pending");
  assert.equal(attachmentStateOf({ scanStatus: "clean", removedAt: null, hasFile: false }), "unavailable");
  assert.equal(attachmentStateOf({ scanStatus: "clean", removedAt: null, hasFile: true }), "available");
  assert.equal(attachmentStateOf({ scanStatus: "unknown", removedAt: null, hasFile: true }), "pending");
  assert.equal(attachmentStateOf({ scanStatus: undefined, removedAt: undefined, hasFile: true }), "pending");
});

test("the readers rule receives the requestor and the caller's documentId and human-analyst fact only, never a participant fact (D-18)", () => {
  const facts = readersRequestFacts({ requestorDocumentId: JANE, requestStatus: "submitted", riskOwnerDocumentId: "user-maya" } as never);
  assert.deepEqual(facts, { requestorDocumentId: JANE });
  const caller = readersCallerFacts({ documentId: "user-maya", humanAnalyst: false, participant: true } as never);
  assert.deepEqual(caller, { documentId: "user-maya", humanAnalyst: false });
  // A participant who is not the requestor is refused, as a missing record would be.
  assert.equal(canUseRequestNotes(facts, caller), false);
  assert.equal(canUseRequestNotes(facts, readersCallerFacts(jane)), true);
  assert.equal(canUseRequestNotes(facts, readersCallerFacts(bob)), true);
  assert.equal(canUseRequestNotes(facts, readersCallerFacts({ documentId: "user-other", humanAnalyst: false })), false);
});

/* 14-08 (D-19 to D-21, G-1): who may remove and restore a file, in each rule's order. */

const SECOND = "user-second-analyst";
const second = { documentId: SECOND, humanAnalyst: true };

function file(overrides: Partial<{ uploadedByDocumentId: string | null; removedByDocumentId: string | null; scanStatus: string; removedAt: string | null }> = {}) {
  return { uploadedByDocumentId: JANE, removedByDocumentId: null, scanStatus: "clean", removedAt: null, ...overrides };
}

test("a removal is refused in order: closed, a draft for anyone but its requestor, then anyone who neither added the file nor is a Security Analyst after submission (D-19, D-20, G-1)", () => {
  // The uploader removes their own file at intake and after submission.
  assert.equal(canRemoveAttachment({ request: request("draft"), caller: jane, attachment: file() }), null, "UPLOADER_INTAKE");
  assert.equal(canRemoveAttachment({ request: request("under-review"), caller: jane, attachment: file() }), null, "UPLOADER_AFTER_SUBMISSION");
  // Any human Security Analyst removes any file after submission, a blocked or pending one included (D-21).
  assert.equal(canRemoveAttachment({ request: request("submitted"), caller: bob, attachment: file() }), null, "ANALYST_AFTER_SUBMISSION");
  assert.equal(canRemoveAttachment({ request: request("submitted"), caller: bob, attachment: file({ scanStatus: "blocked" }) }), null, "ANALYST_BLOCKED");
  assert.equal(canRemoveAttachment({ request: request("submitted"), caller: bob, attachment: file({ scanStatus: "pending" }) }), null, "ANALYST_PENDING");
  // A human Security Analyst does not work on a draft, even on a file they somehow hold.
  assert.equal(canRemoveAttachment({ request: request("draft"), caller: bob, attachment: file() }), "REQUEST_NOT_SUBMITTED", "ANALYST_ON_DRAFT");
  assert.equal(canRemoveAttachment({ request: request("draft"), caller: bob, attachment: file({ uploadedByDocumentId: BOB }) }), "REQUEST_NOT_SUBMITTED", "ANALYST_OWN_FILE_ON_DRAFT");
  // A Requestor removing someone else's file.
  assert.equal(canRemoveAttachment({ request: request("submitted"), caller: jane, attachment: file({ uploadedByDocumentId: BOB }) }), "NOT_UPLOADER", "REQUESTOR_OTHERS_FILE");
  assert.equal(canRemoveAttachment({ request: request("submitted"), caller: jane, attachment: file({ uploadedByDocumentId: null }) }), "NOT_UPLOADER", "REQUESTOR_UNKNOWN_UPLOADER");
  // G-1: on a request Bob raised he is its Requestor, so he removes only his own files.
  const bobsRequest = { requestorDocumentId: BOB, requestStatus: "submitted" };
  assert.equal(canRemoveAttachment({ request: bobsRequest, caller: bob, attachment: file({ uploadedByDocumentId: SECOND }) }), "NOT_UPLOADER", "REQUESTING_ANALYST_COLLEAGUES_FILE");
  assert.equal(canRemoveAttachment({ request: bobsRequest, caller: bob, attachment: file({ uploadedByDocumentId: BOB }) }), null, "REQUESTING_ANALYST_OWN_FILE");
  assert.equal(canRemoveAttachment({ request: bobsRequest, caller: second, attachment: file({ uploadedByDocumentId: BOB }) }), null, "SECOND_ANALYST_ON_BOBS_REQUEST");
  // Released or closed: read-only, before every other rule.
  for (const status of ["approved", "closed", "bogus"]) {
    assert.equal(canRemoveAttachment({ request: request(status), caller: jane, attachment: file() }), "ATTACHMENTS_CLOSED", `CLOSED_${status}`);
    assert.equal(canRemoveAttachment({ request: request(status), caller: bob, attachment: file() }), "ATTACHMENTS_CLOSED", `CLOSED_ANALYST_${status}`);
  }
});

test("a restore is refused in order: closed, a draft for anyone but its requestor, anyone but the remover, a blocked file, then a 21st active file (D-19 to D-21)", () => {
  const removedBy = (documentId: string) => file({ removedByDocumentId: documentId, removedAt: "2026-10-10T00:00:00.000Z" });
  assert.equal(canRestoreAttachment({ request: request("draft"), caller: jane, attachment: removedBy(JANE), activeCount: 0 }), null, "REMOVER_INTAKE");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: bob, attachment: removedBy(BOB), activeCount: 19 }), null, "REMOVER_AT_19");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: jane, attachment: removedBy(BOB), activeCount: 0 }), "NOT_REMOVER", "REQUESTOR_RESTORES_ANALYSTS_REMOVAL");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: second, attachment: removedBy(BOB), activeCount: 0 }), "NOT_REMOVER", "ANOTHER_ANALYST");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: bob, attachment: file({ removedByDocumentId: null, removedAt: "2026-10-10T00:00:00.000Z" }), activeCount: 0 }), "NOT_REMOVER", "NO_RECORDED_REMOVER");
  assert.equal(canRestoreAttachment({ request: request("draft"), caller: bob, attachment: removedBy(BOB), activeCount: 0 }), "REQUEST_NOT_SUBMITTED", "ANALYST_ON_DRAFT");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: bob, attachment: { ...removedBy(BOB), scanStatus: "blocked" }, activeCount: 20 }), "ATTACHMENT_BLOCKED", "BLOCKED_BEFORE_LIMIT");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: bob, attachment: removedBy(BOB), activeCount: 20 }), "ATTACHMENT_LIMIT_REACHED", "TWENTY_ACTIVE");
  assert.equal(canRestoreAttachment({ request: request("submitted"), caller: jane, attachment: removedBy(BOB), activeCount: 20 }), "NOT_REMOVER", "NOT_REMOVER_BEFORE_LIMIT");
  for (const status of ["approved", "closed"]) {
    assert.equal(canRestoreAttachment({ request: request(status), caller: bob, attachment: removedBy(BOB), activeCount: 0 }), "ATTACHMENTS_CLOSED", `CLOSED_${status}`);
  }
});

/* 14-09 (D-30, D-31; G-1; Phase 12 D-28): the AI inclusion rule, in its order. */

const allowed = evaluateAiDataPolicy({ assets: [], ceiling: "Internal", developmentRuntime: false });
// The harnesses run the development runtime, where an empty ceiling allows; outside it, none configured refuses.
const notConfigured = evaluateAiDataPolicy({ assets: [], ceiling: null, developmentRuntime: false });
const aboveCeiling = evaluateAiDataPolicy({ assets: [{ dataClassification: "Restricted" }], ceiling: "Internal", developmentRuntime: false });
const pdf = { state: "available" as const, fileType: "pdf", included: false };

test("an AI inclusion is refused in order: the requestor (G-1), a draft, a released or closed request, the file's state, an image, then the AI data policy (D-30, D-31)", () => {
  const submitted = request("submitted");
  const include = (overrides: Partial<Parameters<typeof aiInputRefusalFor>[0]>) => aiInputRefusalFor({ request: submitted, caller: bob, attachment: pdf, policy: allowed, including: true, ...overrides });

  assert.equal(include({}), null);
  // G-1: a Security Analyst who raised the request is its Requestor here, before every other rule.
  assert.deepEqual(include({ request: { requestorDocumentId: BOB, requestStatus: "draft" }, attachment: { ...pdf, fileType: "png" }, policy: notConfigured }), { status: 403, reason: "OWN_REQUEST" });
  assert.deepEqual(include({ request: request("draft"), attachment: { ...pdf, state: "removed" } }), { status: 409, reason: "REQUEST_NOT_SUBMITTED" });
  for (const status of ["approved", "closed"]) {
    assert.deepEqual(include({ request: request(status), attachment: { ...pdf, state: "pending" } }), { status: 409, reason: "ATTACHMENTS_CLOSED" }, status);
  }
  for (const [state, reason] of [["removed", "ATTACHMENT_REMOVED"], ["blocked", "ATTACHMENT_BLOCKED"], ["pending", "ATTACHMENT_QUARANTINED"], ["unavailable", "ATTACHMENT_UNAVAILABLE"]] as const) {
    assert.deepEqual(include({ attachment: { ...pdf, state, fileType: "png" }, policy: notConfigured }), { status: 409, reason }, state);
  }
  for (const fileType of ["png", "jpeg", "exe", undefined]) {
    assert.deepEqual(include({ attachment: { ...pdf, fileType }, policy: notConfigured }), { status: 409, reason: "ATTACHMENT_NOT_TEXT_BEARING" }, String(fileType));
  }
  for (const fileType of ["pdf", "docx", "xlsx", "pptx", "csv", "txt"]) assert.equal(include({ attachment: { ...pdf, fileType } }), null, fileType);
  assert.deepEqual(include({ policy: aboveCeiling }), { status: 409, reason: "AI_CLASSIFICATION_ABOVE_CEILING" });
  assert.deepEqual(include({ policy: notConfigured }), { status: 409, reason: "AI_POLICY_NOT_CONFIGURED" });
  // Including needs the policy decision: without one it is refused as not configured, never allowed.
  assert.deepEqual(include({ policy: null }), { status: 409, reason: "AI_POLICY_NOT_CONFIGURED" });
});

test("an exclusion, and a change to the value a file already has, are refused only for the requestor and outside the window (D-30)", () => {
  const exclude = (overrides: Partial<Parameters<typeof aiInputRefusalFor>[0]>) => aiInputRefusalFor({
    request: request("submitted"), caller: bob, attachment: { state: "unavailable", fileType: "pdf", included: true }, policy: notConfigured, including: false, ...overrides,
  });
  // Excluding is always allowed while the window is open, whatever the policy or the file's state now.
  assert.equal(exclude({}), null);
  assert.equal(exclude({ policy: aboveCeiling }), null);
  assert.equal(exclude({ policy: null }), null);
  assert.deepEqual(exclude({ caller: jane }), { status: 403, reason: "OWN_REQUEST" });
  assert.deepEqual(exclude({ request: request("draft") }), { status: 409, reason: "REQUEST_NOT_SUBMITTED" });
  assert.deepEqual(exclude({ request: request("approved") }), { status: 409, reason: "ATTACHMENTS_CLOSED" });
  // Including a file that is already included changes nothing, so only the requestor and the window refuse it.
  assert.equal(aiInputRefusalFor({ request: request("submitted"), caller: bob, attachment: { state: "available", fileType: "pdf", included: true }, policy: aboveCeiling, including: true }), null);
});

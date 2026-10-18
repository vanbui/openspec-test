import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { buildDocx, buildLegacyDoc, buildMacroDocx, buildPasswordPdf, buildPdf, buildPng, buildRenamedExecutable, OFFICE_RELATIONSHIPS } from "./helpers/attachment-fixtures";
import { isActiveAttachment } from "../src/api/csrm-request-attachment/services/attachment-rules";
import { EXTRACTOR_VERSION } from "../src/csrm/files/extraction";
import {
  attachmentEventLogOf,
  attachmentHttp,
  attachmentsPath,
  captureSecurityEvents,
  malformedAttachmentEventLog,
  refusalOf,
  withAttachmentCountIntercepted,
  type LoggedEvent,
} from "./helpers/attachment-http";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 14 (D-01, D-04 items 1 and 2, D-05, D-10 to D-19; COLLAB-02 criteria 1 to 3): request attachments, mounted.
 * Every case seeds its own request, so the cases are independent of each other and of the order they run in.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend, two more the repository root.
const strapiDir = path.resolve(__dirname, "..", "..", "..");
const repositoryDir = path.resolve(strapiDir, "..", "..");
const DATA_FLOW = readFileSync(path.join(strapiDir, "tests", "fixtures", "attachments", "data-flow.docx"));

type Json = Record<string, unknown>;

const ALLOWED_TYPES = ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "png", "jpeg"];
const LIMITS = { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 };
const PROJECTION_KEYS = ["actions", "byteSize", "detection", "documentId", "fileName", "fileType", "note", "removedAt", "removedBy", "state", "uploadedAt", "uploadedBy", "uploaderPart"];

const { nextRequestNames, seedRequest, persisted } = attachmentHttp(harnessPromise, {
  requestNumberPrefix: "ATTACH", titlePrefix: "Attachments request", defaultStatus: "draft", submittedDate: true,
});

function uploadForm(fileName: string, bytes: Uint8Array, noteId?: string): FormData {
  const form = new FormData();
  form.set("file", new File([bytes], fileName));
  if (noteId !== undefined) form.set("noteId", noteId);
  return form;
}

async function upload(requestId: string, identity: string, form: FormData): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: attachmentsPath(requestId), identity, init: { method: "POST", body: form } });
}

async function list(requestId: string, identity: string): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: attachmentsPath(requestId), identity });
}

async function json(response: Response): Promise<Json> {
  return await response.json() as Json;
}

test("a fresh database holds the approved attachment columns and the four link tables, and no other type gains one (D-01)", async () => {
  const harness = await harnessPromise;
  const columns = await harness.listTableColumns("csrm_request_attachments");
  // Strapi names a column with lodash's snakeCase, which splits a letter from a digit: the `sha256` attribute is the
  // `sha_256` column (the approved record expected `sha256`; PRAGMA confirms the real name, as the record asks).
  assert.equal(columns.includes("sha256"), false, "UNEXPECTED_SHA256_COLUMN_NAME");
  for (const column of [
    "file_name", "file_type", "byte_size", "sha_256", "uploader_part", "uploaded_at", "scan_status", "scan_checked_at", "scan_engine",
    "scan_detection", "scan_attempts", "removed_at", "ai_text_included", "ai_text", "ai_text_facts", "event_log",
  ]) {
    assert.ok(columns.includes(column), `UNEXPECTED_ATTACHMENT_COLUMN_MISSING_${column}`);
  }
  for (const [table, target] of [
    ["csrm_request_attachments_assessment_request_lnk", "csrm_assessment_request_id"],
    ["csrm_request_attachments_note_lnk", "csrm_request_note_id"],
    ["csrm_request_attachments_uploaded_by_lnk", "idambox_user_id"],
    ["csrm_request_attachments_removed_by_lnk", "idambox_user_id"],
  ] as const) {
    const linkColumns = await harness.listTableColumns(table);
    assert.ok(linkColumns.includes("csrm_request_attachment_id"), `UNEXPECTED_OWNER_COLUMN_MISSING_${table}`);
    assert.ok(linkColumns.includes(target), `UNEXPECTED_TARGET_COLUMN_MISSING_${table}`);
  }
  // No inverse attribute: the request, the note and the user gain no attachment column (D-01).
  for (const table of ["csrm_assessment_requests", "csrm_request_notes", "idambox_users"]) {
    const other = await harness.listTableColumns(table);
    assert.equal(other.some((column) => column.includes("attachment")), false, `UNEXPECTED_ATTACHMENT_COLUMN_ON_${table}`);
  }
});

test("Jane adds the data-flow DOCX to her draft and it is stored byte for byte, clean, with one uploaded event and no name in the log (D-05, D-13, D-16, D-37)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const before = Date.now();

  const { result: response, events } = await captureSecurityEvents(() => upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW)));
  const text = await response.text();
  assert.equal(response.status, 201, `UNEXPECTED_UPLOAD_STATUS: ${text.slice(0, 300)}`);
  const attachment = (JSON.parse(text) as Json).data as Json;
  assert.deepEqual(Object.keys(attachment).sort(), PROJECTION_KEYS, "UNEXPECTED_PROJECTION_KEYS");
  assert.equal(typeof attachment.documentId, "string", "UNEXPECTED_DOCUMENT_ID");
  assert.equal(attachment.fileName, "data-flow.docx", "UNEXPECTED_FILE_NAME");
  assert.equal(attachment.fileType, "docx", "UNEXPECTED_FILE_TYPE");
  assert.equal(attachment.byteSize, DATA_FLOW.length, "UNEXPECTED_BYTE_SIZE");
  assert.equal(attachment.state, "available", "UNEXPECTED_STATE");
  assert.equal(attachment.uploaderPart, "requestor", "UNEXPECTED_PART");
  assert.deepEqual(attachment.uploadedBy, { documentId: harness.users.owner, displayName: "Jane Doe" }, "UNEXPECTED_UPLOADER");
  const uploadedAt = Date.parse(String(attachment.uploadedAt));
  assert.ok(uploadedAt >= before - 1_000 && uploadedAt <= Date.now() + 1_000, "UNEXPECTED_UPLOADED_AT_NOT_SERVER_TIME");
  assert.equal(attachment.note, null, "UNEXPECTED_NOTE_ON_A_DRAFT_FILE");
  assert.equal(attachment.removedBy, null, "UNEXPECTED_REMOVED_BY");
  assert.equal(attachment.removedAt, null, "UNEXPECTED_REMOVED_AT");
  assert.equal(attachment.detection, null, "UNEXPECTED_DETECTION");
  assert.deepEqual(attachment.actions, { download: true, remove: true, restore: false }, "UNEXPECTED_ACTIONS");

  const digest = createHash("sha256").update(DATA_FLOW).digest("hex");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.ok(stored, "UNEXPECTED_NO_RECORD");
  assert.equal(stored.sha256, digest, "UNEXPECTED_DIGEST");
  assert.equal(stored.scanStatus, "clean", "UNEXPECTED_SCAN_STATUS");
  assert.equal(stored.scanAttempts, 0, "UNEXPECTED_SCAN_ATTEMPTS");
  assert.equal(stored.uploadedBy, harness.users.owner, "UNEXPECTED_STORED_UPLOADER");
  assert.equal(stored.note, null, "UNEXPECTED_STORED_NOTE");
  assert.equal(stored.aiTextIncluded, false, "UNEXPECTED_AI_INCLUSION");
  const eventLog = stored.eventLog as { schemaVersion: number; events: Json[] };
  assert.equal(eventLog.schemaVersion, 1, "UNEXPECTED_EVENT_LOG_VERSION");
  assert.deepEqual(eventLog.events.map((event) => [event.type, event.by]), [["uploaded", harness.users.owner]], "UNEXPECTED_EVENT_LOG");
  assert.equal(typeof stored.fileId, "number", "UNEXPECTED_NO_STORED_FILE");
  const bytes = await harness.attachmentStorage().read(stored.fileId as number);
  assert.equal(Buffer.compare(bytes, DATA_FLOW), 0, "UNEXPECTED_STORED_BYTES");

  // D-05: nothing of the stored file leaves Strapi.
  for (const secret of [digest, "csrm_", "/uploads", "url", "hash", "provider"]) {
    assert.ok(!text.includes(secret), `UNEXPECTED_STORAGE_FACT_DISCLOSED_${secret}`);
  }
  assert.equal(events.length, 1, `UNEXPECTED_SECURITY_EVENT_COUNT_${events.map((entry) => entry.line).join(" | ")}`);
  assert.equal(events[0]?.event.event, "attachment.uploaded", "UNEXPECTED_SECURITY_EVENT");
  assert.equal(events[0]?.level, "info", "UNEXPECTED_SECURITY_EVENT_LEVEL");
  assert.equal(events[0]?.event.requestId, requestId, "UNEXPECTED_SECURITY_EVENT_REQUEST");
  assert.equal(events[0]?.event.attachmentId, attachment.documentId, "UNEXPECTED_SECURITY_EVENT_ATTACHMENT");
  assert.equal(events[0]?.event.sha256, digest, "UNEXPECTED_SECURITY_EVENT_DIGEST");
  assert.ok(!events[0]?.line.includes("data-flow"), "UNEXPECTED_FILE_NAME_LOGGED");
});

test("Jane lists her draft's file with the add facts, Bob sees it without the add, and a legacy request lists none (D-16, D-28)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, "UNEXPECTED_SEED_UPLOAD_STATUS");
  const attachment = (await json(added)).data as Json;

  const janeList = await list(requestId, harness.identities.owner);
  assert.equal(janeList.status, 200, "UNEXPECTED_JANE_LIST_STATUS");
  const janeBody = await json(janeList);
  assert.deepEqual(janeBody.data, [attachment], "UNEXPECTED_JANE_LIST");
  assert.deepEqual(janeBody.meta, {
    total: 1,
    removed: 0,
    add: {
      canAdd: true, refusal: null, window: "intake", needsNote: false, remaining: 19, activeCount: 1, storedCount: 1, limits: LIMITS, allowedTypes: ALLOWED_TYPES,
    },
  }, "UNEXPECTED_JANE_META");

  // Bob reads Jane's draft's files, but analysts do not add to a draft (D-16).
  const bobList = await list(requestId, harness.identities.analyst);
  assert.equal(bobList.status, 200, "UNEXPECTED_BOB_LIST_STATUS");
  const bobBody = await json(bobList);
  // 14-09 (D-28, D-30): an analyst also gets each file's AI facts and the section's AI policy; a draft takes no inclusion.
  assert.deepEqual(bobBody.data, [{
    ...attachment,
    actions: { download: true, remove: false, restore: false },
    ai: { included: false, facts: null, unavailableReason: null, canChange: false },
  }], "UNEXPECTED_BOB_LIST");
  assert.deepEqual((bobBody.meta as Json).aiPolicy, { canChange: false, refusal: "REQUEST_NOT_SUBMITTED", classification: "Internal", ceiling: null }, "UNEXPECTED_BOB_AI_POLICY");
  assert.deepEqual((bobBody.meta as Json).add, {
    canAdd: false, refusal: "REQUEST_NOT_SUBMITTED", window: "intake", needsNote: false, remaining: 19, activeCount: 1, storedCount: 1, limits: LIMITS, allowedTypes: ALLOWED_TYPES,
  }, "UNEXPECTED_BOB_ADD_FACTS");

  // A request from before Phase 14 reads as having no files.
  const legacy = await seedRequest("submitted");
  const legacyList = await list(legacy, harness.identities.owner);
  assert.equal(legacyList.status, 200, "UNEXPECTED_LEGACY_LIST_STATUS");
  assert.deepEqual(await json(legacyList), {
    data: [],
    meta: {
      total: 0,
      removed: 0,
      add: {
        canAdd: true, refusal: null, window: "after-submission", needsNote: true, remaining: 20, activeCount: 0, storedCount: 0, limits: LIMITS, allowedTypes: ALLOWED_TYPES,
      },
    },
  }, "UNEXPECTED_LEGACY_LIST");
});

test("another Requestor, the service agent and anyone naming a missing request get 404 at the list and the upload with nothing written (D-18)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, "UNEXPECTED_SEED_UPLOAD_STATUS");
  const attachmentId = String(((await json(added)).data as Json).documentId);

  for (const [label, identity] of [["OTHER_REQUESTOR", harness.identities.otherRequestor], ["SERVICE_AGENT", harness.identities.serviceAnalystAgent]] as const) {
    const before = await persisted(requestId);
    const listed = await list(requestId, identity);
    assert.equal(listed.status, 404, `UNEXPECTED_LIST_STATUS_${label}`);
    const listText = await listed.text();
    assert.ok(!listText.includes("data-flow") && !listText.includes(attachmentId), `UNEXPECTED_LIST_DISCLOSED_${label}`);
    const uploaded = await upload(requestId, identity, uploadForm("intrusion.txt", Buffer.from("Should never be stored.")));
    assert.equal(uploaded.status, 404, `UNEXPECTED_UPLOAD_STATUS_${label}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
  }

  // The refusal reads the same as a missing request, for everyone, and writes nothing anywhere.
  const outsiderMessage = ((await json(await list(requestId, harness.identities.otherRequestor))).error as Json).message;
  const beforeMissing = await persisted(requestId);
  for (const identity of [harness.identities.owner, harness.identities.analyst, harness.identities.otherRequestor]) {
    const missing = await list("no-such-request", identity);
    assert.equal(missing.status, 404, "UNEXPECTED_MISSING_REQUEST_LIST_STATUS");
    assert.equal(((await json(missing)).error as Json).message, outsiderMessage, "UNEXPECTED_MISSING_REQUEST_MESSAGE");
    const uploaded = await upload("no-such-request", identity, uploadForm("orphan.txt", Buffer.from("Should never be stored.")));
    assert.equal(uploaded.status, 404, "UNEXPECTED_MISSING_REQUEST_UPLOAD_STATUS");
  }
  assert.deepEqual(await persisted(requestId), beforeMissing, "UNEXPECTED_MISSING_REQUEST_WRITE");
});

/*
 * IN-307 (D-19, D-30): the service agent's Requestor birthright reaches a request it raised itself. On its own draft it
 * lists and adds a file in the requestor part, with no AI facts, while the AI inclusion and the preview stay refused by
 * the policy (403) with nothing written.
 */
test("the service agent lists and adds a file on a draft it raised, in the requestor part, and gets 403 at the AI inclusion and the preview with nothing written (D-19, D-30, IN-307)", async () => {
  const harness = await harnessPromise;
  const agent = harness.identities.serviceAnalystAgent;
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    ...nextRequestNames(), requestStatus: "draft", requestor: harness.users.serviceAnalystAgent,
  });
  const empty = await list(requestId, agent);
  assert.equal(empty.status, 200, `THE_AGENT_CANNOT_LIST_ITS_OWN_DRAFT: ${await empty.clone().text()}`);
  const emptyMeta = (await json(empty)).meta as Json;
  assert.deepEqual([emptyMeta.total, (emptyMeta.add as Json | undefined)?.canAdd], [0, true], "UNEXPECTED_AGENT_ADD_FACTS");

  const added = await upload(requestId, agent, uploadForm("agent-plan.txt", PLAN_TEXT));
  assert.equal(added.status, 201, `THE_AGENT_CANNOT_ADD_TO_ITS_OWN_DRAFT: ${await added.clone().text()}`);
  const file = (await json(added)).data as Json;
  assert.deepEqual([file.uploaderPart, file.note, (file.uploadedBy as Json).documentId, "ai" in file], ["requestor", null, harness.users.serviceAnalystAgent, false], "UNEXPECTED_AGENT_FILE");
  const attachmentId = String(file.documentId);
  const listed = await json(await list(requestId, agent));
  assert.deepEqual((listed.data as Json[]).map((entry) => entry.documentId), [attachmentId], "UNEXPECTED_AGENT_LIST");
  assert.equal("aiPolicy" in (listed.meta as Json), false, "AI_POLICY_SERVED_TO_THE_AGENT");

  const before = await persisted(requestId);
  for (const [label, suffix, init] of [
    ["AI_INPUT", "ai_input", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { included: true } }) }],
    ["AI_TEXT", "ai_text", undefined],
  ] as const) {
    const response = await harness.request({ path: `${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId)}/${suffix}`, identity: agent, ...(init ? { init } : {}) });
    const text = await response.text();
    assert.equal(response.status, 403, `THE_AGENT_WAS_NOT_REFUSED_${label}: ${text.slice(0, 200)}`);
    assert.ok(!text.includes("Vendor access plan"), `TEXT_SERVED_TO_THE_AGENT_${label}`);
  }
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_AGENT_AI");
});

/*
 * IN-307: an inactive Security Analyst reaches no attachment operation. The policy admits an active user only, so every
 * route answers 403 before the readers rule, names no file, and writes nothing.
 */
test("an inactive Security Analyst gets 403 at every attachment operation, with no file named and nothing written (D-18, IN-307)", async () => {
  const harness = await harnessPromise;
  const inactive = harness.identities.inactiveAnalyst;
  const requestId = await seedRequest("submitted");
  const [attachmentId] = (await harness.seedRequestAttachments(requestId, 1)).map(String);
  const filePath = `${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId!)}`;
  const jsonBody = (body: unknown) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const before = await persisted(requestId);
  for (const [label, requestPath, init] of [
    ["LIST", attachmentsPath(requestId), undefined],
    ["UPLOAD", attachmentsPath(requestId), { method: "POST", body: uploadForm("inactive.txt", PLAN_TEXT) }],
    ["DOWNLOAD", `${filePath}/content`, undefined],
    ["REMOVAL", `${filePath}/removal`, { method: "PUT", ...jsonBody({ data: { removed: true } }) }],
    ["AI_INPUT", `${filePath}/ai_input`, { method: "PUT", ...jsonBody({ data: { included: true } }) }],
    ["AI_TEXT", `${filePath}/ai_text`, undefined],
  ] as const) {
    const response = await harness.request({ path: requestPath, identity: inactive, ...(init ? { init } : {}) });
    const text = await response.text();
    assert.equal(response.status, 403, `THE_INACTIVE_ANALYST_WAS_NOT_REFUSED_${label}: ${text.slice(0, 200)}`);
    assert.ok(!text.includes("seeded-1.txt") && !text.includes(attachmentId!) && !text.includes("Seeded attachment"), `A_FILE_WAS_NAMED_TO_THE_INACTIVE_ANALYST_${label}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_INACTIVE_${label}`);
  }
});

test("request attachments are served by their operations alone, with no core route (D-01, D-03, D-23)", async () => {
  const harness = await harnessPromise;
  const inventory = JSON.parse(readFileSync(path.join(repositoryDir, "docs", "references", "served-operations.json"), "utf8")) as {
    served: Array<{ method: string; path: string; catalogueUrl: string; apiName: string; routerFile: string; authStrategies: string[] | null; policyConfig: unknown; functionApiIds: string[]; roleIds: string[]; specOperationId?: string; webCallers?: string[] }>;
  };
  const operations = [
    ["GET:/api/v1/assessment_requests/{requestId}/attachments", "assessment-workflow/list-request-attachments"],
    ["POST:/api/v1/assessment_requests/{requestId}/attachments", "assessment-workflow/upload-request-attachment"],
    ["GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content", "assessment-workflow/download-request-attachment"],
    ["PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal", "assessment-workflow/set-request-attachment-removal"],
  ] as const;
  for (const [url, operationId] of operations) {
    const row = inventory.served.find((entry) => entry.catalogueUrl === url);
    assert.ok(row, `ATTACHMENTS_OPERATION_NOT_SERVED_${url}`);
    assert.equal(row.apiName, "csrm-request-attachment", `ATTACHMENTS_OPERATION_API_${url}`);
    assert.equal(row.routerFile, "csrm-request-attachment/routes/request-attachments.ts", `ATTACHMENTS_OPERATION_ROUTER_${url}`);
    assert.deepEqual(row.authStrategies, ["content-api-token"], `ATTACHMENTS_OPERATION_NOT_TOKEN_ONLY_${url}`);
    assert.deepEqual(row.policyConfig, { operation: url }, `ATTACHMENTS_OPERATION_POLICY_${url}`);
    assert.deepEqual(row.functionApiIds.map((id) => id.replace(/\.api\.\d+$/, "")), ["function.risk_assessment_requests.attachments_api"], `ATTACHMENTS_OPERATION_FUNCTION_${url}`);
    assert.deepEqual([...row.roleIds].sort(), ["role.requestor", "role.security_analyst"], `ATTACHMENTS_OPERATION_ROLES_${url}`);
    assert.equal(row.specOperationId, operationId, `ATTACHMENTS_OPERATION_SPEC_${url}`);
    assert.deepEqual(row.webCallers, ["src/features/attachments/attachments-service.ts"], `ATTACHMENTS_OPERATION_WEB_CALLERS_${url}`);
  }
  // 14-09 (D-38): the AI inclusion and its preview are this API's only other routes, held by their own human-only
  // Function (attachment-ai-input.integration.test.ts proves their rows).
  const aiOperations = [
    "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
    "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
  ];
  assert.deepEqual(
    inventory.served.filter((entry) => entry.apiName === "csrm-request-attachment").map((entry) => entry.catalogueUrl).sort(),
    [...operations.map(([url]) => url), ...aiOperations].sort(),
    "ATTACHMENTS_API_SERVES_ANOTHER_ROUTE",
  );
  for (const row of inventory.served) {
    assert.ok(!row.path.startsWith("/api/csrm-request-attachment"), `ATTACHMENTS_CORE_ROUTE_MOUNTED_${row.method}_${row.path}`);
  }
  const read = await harness.request({ path: "/api/csrm-request-attachments", identity: harness.identities.analyst });
  assert.equal(read.status, 404, `ATTACHMENTS_CORE_BASE_SERVED_${read.status}`);
});

/* 14-07 Task 1 (D-23, D-37; COLLAB-02 criteria 1 and 3): one authorised download, digest checked, headers hardened. */

const WORDPROCESSING_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function contentPath(requestId: string, attachmentId: string): string {
  return `${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId)}/content`;
}

async function download(requestId: string, attachmentId: string, identity: string): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: contentPath(requestId, attachmentId), identity });
}

/** Jane's data-flow DOCX on a request of hers that she has then submitted, as Bob meets it in his queue. */
async function submittedRequestWithDataFlow(): Promise<{ requestId: string; attachmentId: string }> {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, `UNEXPECTED_SEED_UPLOAD_STATUS: ${await added.clone().text()}`);
  const attachmentId = String(((await json(added)).data as Json).documentId);
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, {
    requestStatus: "submitted",
    submittedDate: "2026-10-01T00:00:00.000Z",
  });
  return { requestId, attachmentId };
}

test("Bob downloads Jane's data-flow DOCX byte for byte with hardened headers and one downloaded event without its name, and Jane downloads her own (D-23, D-37)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await submittedRequestWithDataFlow();
  const digest = createHash("sha256").update(DATA_FLOW).digest("hex");

  const { result: response, events } = await captureSecurityEvents(() => download(requestId, attachmentId, harness.identities.analyst));
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `UNEXPECTED_DOWNLOAD_STATUS: ${bytes.toString("utf8").slice(0, 300)}`);
  assert.equal(Buffer.compare(bytes, DATA_FLOW), 0, "UNEXPECTED_DOWNLOADED_BYTES");
  assert.equal(response.headers.get("content-type"), WORDPROCESSING_MEDIA_TYPE, "UNEXPECTED_CONTENT_TYPE");
  assert.equal(response.headers.get("content-disposition"), "attachment; filename=\"data-flow.docx\"; filename*=UTF-8''data-flow.docx", "UNEXPECTED_CONTENT_DISPOSITION");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", "UNEXPECTED_NOSNIFF");
  assert.equal(response.headers.get("cache-control"), "no-store", "UNEXPECTED_CACHE_CONTROL");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox", "UNEXPECTED_CONTENT_SECURITY_POLICY");

  assert.equal(events.length, 1, `UNEXPECTED_SECURITY_EVENT_COUNT_${events.map((entry) => entry.line).join(" | ")}`);
  const [event] = events;
  assert.equal(event?.event.event, "attachment.downloaded", "UNEXPECTED_SECURITY_EVENT");
  assert.equal(event?.level, "info", "UNEXPECTED_SECURITY_EVENT_LEVEL");
  assert.deepEqual(event?.event.actor, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_SECURITY_EVENT_ACTOR");
  assert.equal(event?.event.requestId, requestId, "UNEXPECTED_SECURITY_EVENT_REQUEST");
  assert.equal(event?.event.attachmentId, attachmentId, "UNEXPECTED_SECURITY_EVENT_ATTACHMENT");
  assert.equal(event?.event.sha256, digest, "UNEXPECTED_SECURITY_EVENT_DIGEST");
  assert.ok(!event?.line.includes("data-flow"), "UNEXPECTED_FILE_NAME_LOGGED");

  const own = await download(requestId, attachmentId, harness.identities.owner);
  assert.equal(own.status, 200, "UNEXPECTED_OWN_DOWNLOAD_STATUS");
  assert.equal(Buffer.compare(Buffer.from(await own.arrayBuffer()), DATA_FLOW), 0, "UNEXPECTED_OWN_DOWNLOADED_BYTES");
});

test("the other Requestor, the service agent and an unknown file id get 404 at the download, with no byte of the file (D-18, D-23)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await submittedRequestWithDataFlow();
  const fileStart = DATA_FLOW.subarray(0, 64);

  for (const [label, identity, target] of [
    ["OTHER_REQUESTOR", harness.identities.otherRequestor, attachmentId],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent, attachmentId],
    ["UNKNOWN_FILE", harness.identities.analyst, "no-such-attachment"],
  ] as const) {
    const { result: response, events } = await captureSecurityEvents(() => download(requestId, target, identity));
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 404, `UNEXPECTED_STATUS_${label}: ${body.toString("utf8").slice(0, 300)}`);
    assert.equal(body.includes(fileStart), false, `UNEXPECTED_FILE_BYTES_${label}`);
    assert.ok(!body.toString("utf8").includes("data-flow"), `UNEXPECTED_FILE_NAME_${label}`);
    assert.equal((JSON.parse(body.toString("utf8")) as { error: Json }).error.message, "CSRM request attachments were not found.", `UNEXPECTED_MESSAGE_${label}`);
    assert.deepEqual(events.filter((entry) => entry.event.event === "attachment.downloaded"), [], `UNEXPECTED_DOWNLOAD_EVENT_${label}`);
  }
});

/* Task 2 (D-10, D-16, D-17, D-19): the window, the note link, who adds, the parts and the count race. */

const PLAN_TEXT = Buffer.from("Vendor access plan: offshore support connects through the PAM vault.", "utf8");

/** Posts a note through Phase 13's operation, unchanged, and returns its documentId. */
async function postNote(requestId: string, identity: string, body: string): Promise<string> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes`,
    identity,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { body } }) },
  });
  assert.equal(response.status, 200, `UNEXPECTED_NOTE_STATUS: ${await response.clone().text()}`);
  return String(((await json(response)).data as Json).documentId);
}

test("after submission each file comes with the caller's own fresh note, and Bob adds in the Security Analyst part (D-17, D-19)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("submitted");

  const before = await persisted(requestId);
  assert.deepEqual(await refusalOf(await upload(requestId, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT))), { status: 409, reason: "ATTACHMENT_NOTE_REQUIRED" }, "UNEXPECTED_NO_NOTE");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_NO_NOTE");

  const janeNote = await postNote(requestId, harness.identities.owner, "The vendor's access plan is attached.");
  const janeUpload = await upload(requestId, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT, janeNote));
  assert.equal(janeUpload.status, 201, `UNEXPECTED_JANE_STATUS: ${await janeUpload.clone().text()}`);
  const janeFile = (await json(janeUpload)).data as Json;
  const janeNoteLink = janeFile.note as Json;
  assert.equal(janeNoteLink.documentId, janeNote, "UNEXPECTED_NOTE_LINK");
  assert.ok(Number.isFinite(Date.parse(String(janeNoteLink.postedAt))), "UNEXPECTED_NOTE_POSTED_AT");
  assert.equal(janeFile.uploaderPart, "requestor", "UNEXPECTED_JANE_PART");

  const beforeBob = await persisted(requestId);
  assert.deepEqual(await refusalOf(await upload(requestId, harness.identities.analyst, uploadForm("plan.txt", PLAN_TEXT, janeNote))), { status: 409, reason: "ATTACHMENT_NOTE_INVALID" }, "UNEXPECTED_BOB_WITH_JANE_NOTE");
  assert.deepEqual(await persisted(requestId), beforeBob, "UNEXPECTED_WRITE_BOB_WITH_JANE_NOTE");

  const bobNote = await postNote(requestId, harness.identities.analyst, "Our review checklist for the vendor is attached.");
  const bobUpload = await upload(requestId, harness.identities.analyst, uploadForm("checklist.txt", PLAN_TEXT, bobNote));
  assert.equal(bobUpload.status, 201, `UNEXPECTED_BOB_STATUS: ${await bobUpload.clone().text()}`);
  const bobFile = (await json(bobUpload)).data as Json;
  assert.equal(bobFile.uploaderPart, "security-analyst", "UNEXPECTED_BOB_PART");
  assert.deepEqual(bobFile.uploadedBy, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_BOB_UPLOADER");
  assert.equal((bobFile.note as Json).documentId, bobNote, "UNEXPECTED_BOB_NOTE_LINK");

  const stored = await harness.listRequestAttachments(requestId);
  assert.deepEqual(stored.map((record) => [record.uploaderPart, record.uploadedBy, record.note]), [
    ["requestor", harness.users.owner, janeNote],
    ["security-analyst", harness.users.analyst, bobNote],
  ], "UNEXPECTED_STORED_NOTE_LINKS");
  const listed = await json(await list(requestId, harness.identities.owner));
  assert.deepEqual(((listed.meta as Json).add as Json).needsNote, true, "UNEXPECTED_NEEDS_NOTE");
});

test("a note past its 60 minutes, a note on another request and a note id on a draft are each ATTACHMENT_NOTE_INVALID, with nothing written (D-17)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("submitted");
  const otherRequest = await seedRequest("submitted");

  const staleNote = await postNote(requestId, harness.identities.owner, "Files for the vendor review.");
  await harness.updateFixtureDocument("api::csrm-request-note.csrm-request-note", staleNote, {
    postedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
  });
  const foreignNote = await postNote(otherRequest, harness.identities.owner, "A note on another request.");
  const draft = await seedRequest("draft");

  for (const [label, target, noteId] of [["STALE", requestId, staleNote], ["FOREIGN", requestId, foreignNote], ["DRAFT", draft, foreignNote], ["MISSING", requestId, "no-such-note"]] as const) {
    const before = await persisted(target);
    assert.deepEqual(await refusalOf(await upload(target, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT, noteId))), { status: 409, reason: "ATTACHMENT_NOTE_INVALID" }, `UNEXPECTED_${label}`);
    assert.deepEqual(await persisted(target), before, `UNEXPECTED_WRITE_${label}`);
  }
});

test("Bob adds nothing to Jane's draft, adds to a draft he raised in the requestor part, and nobody adds to a released or closed request (D-16, D-19, G-1)", async () => {
  const harness = await harnessPromise;
  const janeDraft = await seedRequest("draft");
  const before = await persisted(janeDraft);
  assert.deepEqual(await refusalOf(await upload(janeDraft, harness.identities.analyst, uploadForm("plan.txt", PLAN_TEXT))), { status: 409, reason: "REQUEST_NOT_SUBMITTED" }, "UNEXPECTED_BOB_ON_JANE_DRAFT");
  assert.deepEqual(await persisted(janeDraft), before, "UNEXPECTED_WRITE_BOB_ON_JANE_DRAFT");

  const bobDraft = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    ...nextRequestNames(), requestStatus: "draft", requestor: harness.users.analyst,
  });
  const bobUpload = await upload(bobDraft, harness.identities.analyst, uploadForm("plan.txt", PLAN_TEXT));
  assert.equal(bobUpload.status, 201, `UNEXPECTED_BOB_OWN_DRAFT_STATUS: ${await bobUpload.clone().text()}`);
  const bobFile = (await json(bobUpload)).data as Json;
  assert.equal(bobFile.uploaderPart, "requestor", "UNEXPECTED_REQUESTING_ANALYST_PART");
  assert.equal(bobFile.note, null, "UNEXPECTED_REQUESTING_ANALYST_NOTE");

  for (const status of ["approved", "closed"]) {
    const released = await seedRequest(status);
    for (const identity of [harness.identities.owner, harness.identities.analyst]) {
      const beforeReleased = await persisted(released);
      assert.deepEqual(await refusalOf(await upload(released, identity, uploadForm("plan.txt", PLAN_TEXT))), { status: 409, reason: "ATTACHMENTS_CLOSED" }, `UNEXPECTED_${status}_${identity}`);
      assert.deepEqual(await persisted(released), beforeReleased, `UNEXPECTED_WRITE_${status}_${identity}`);
    }
    const listed = await json(await list(released, harness.identities.owner));
    assert.deepEqual([((listed.meta as Json).add as Json).window, ((listed.meta as Json).add as Json).refusal], ["closed", "ATTACHMENTS_CLOSED"], `UNEXPECTED_${status}_ADD_FACTS`);
  }
});

test("any part other than one file and an optional noteId of at most 255 characters is 400 with nothing written (D-04 item 2)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const cases: Array<[string, FormData]> = [];
  const extraFile = uploadForm("plan.txt", PLAN_TEXT);
  extraFile.set("extra", new File([PLAN_TEXT], "extra.txt"));
  cases.push(["EXTRA_FILE_PART", extraFile]);
  const extraField = uploadForm("plan.txt", PLAN_TEXT);
  extraField.set("extra", "value");
  cases.push(["EXTRA_FIELD", extraField]);
  const twoFiles = uploadForm("plan.txt", PLAN_TEXT);
  twoFiles.append("file", new File([PLAN_TEXT], "second.txt"));
  cases.push(["TWO_FILES", twoFiles]);
  cases.push(["LONG_NOTE_ID", uploadForm("plan.txt", PLAN_TEXT, "n".repeat(256))]);
  const noFile = new FormData();
  noFile.set("noteId", "note");
  cases.push(["NO_FILE", noFile]);
  const twoNotes = uploadForm("plan.txt", PLAN_TEXT, "note-1");
  twoNotes.append("noteId", "note-2");
  cases.push(["TWO_NOTE_IDS", twoNotes]);

  for (const [label, form] of cases) {
    const before = await persisted(requestId);
    const response = await upload(requestId, harness.identities.owner, form);
    assert.equal(response.status, 400, `UNEXPECTED_STATUS_${label}: ${await response.clone().text()}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
  }
});

/*
 * WR-204 (the pilot's ruling) allows one screening in flight per uploader, so a second upload by the same person while
 * the first is still screened is refused 503 ATTACHMENT_BUSY. The race at 19 is therefore run by two uploaders, Jane and
 * Bob, each with their own fresh note on her submitted request: both are screened, and the lock decides.
 *
 * Code review WR-301 (the pilot's ruling, as Phase 13's WR-201): this proves the serialised outcome only. On SQLite,
 * knex's single connection serialises every transaction, so it cannot fail without the request lock, and nothing makes
 * both uploads read 19 before either inserts. The lock's in-process half is proven by the two hold tests below, which put
 * the uploads (and a restore) in a known order; its row lock (FOR UPDATE making another process's transaction wait) is
 * R-08-37's proof, on PostgreSQL.
 */
test("two uploads at 19 active files sent at once are serialised to 20: one is added, the other refused and its stored bytes deleted (D-10)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("submitted");
  await harness.seedRequestAttachments(requestId, 19);
  const notes = {
    [harness.identities.owner]: await postNote(requestId, harness.identities.owner, "The first race file is attached."),
    [harness.identities.analyst]: await postNote(requestId, harness.identities.analyst, "The second race file is attached."),
  };
  const filesBefore = await harness.countUploadFileRecords();
  const storedBefore = (await harness.listAttachmentStorageFiles()).length;

  const responses = await harness.simultaneousRequests([harness.identities.owner, harness.identities.analyst].map((identity, index) => ({
    path: attachmentsPath(requestId),
    identity,
    init: { method: "POST", body: uploadForm(`race-${index + 1}.txt`, Buffer.from(`Race file ${index + 1}.`, "utf8"), notes[identity]) },
  })));
  const outcomes = await Promise.all(responses.map(refusalOf));
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [201, 409], `UNEXPECTED_RACE_STATUSES_${JSON.stringify(outcomes)}`);
  assert.equal(outcomes.find((outcome) => outcome.status === 409)?.reason, "ATTACHMENT_LIMIT_REACHED", "UNEXPECTED_RACE_REASON");

  const stored = await harness.listRequestAttachments(requestId);
  assert.equal(stored.length, 20, "UNEXPECTED_RACE_RECORDS");
  assert.equal(new Set(stored.map((record) => record.fileId)).size, 20, "UNEXPECTED_RACE_FILE_LINKS");
  assert.equal(await harness.countUploadFileRecords(), filesBefore + 1, "UNEXPECTED_RACE_PLUGIN_FILE_RECORDS");
  assert.equal((await harness.listAttachmentStorageFiles()).length, storedBefore + 1, "UNEXPECTED_RACE_STORED_FILES");
  const listed = await json(await list(requestId, harness.identities.owner));
  assert.deepEqual([((listed.meta as Json).add as Json).canAdd, ((listed.meta as Json).add as Json).refusal, ((listed.meta as Json).add as Json).remaining], [false, "ATTACHMENT_LIMIT_REACHED", 0], "UNEXPECTED_FULL_ADD_FACTS");
});

/** Fails with `message` unless `promise` settles within 30 seconds, so a hold that is never reached fails, not hangs. */
async function within<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 30_000); })]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lets every pending callback run. A call let in at the lock's door that nothing holds asks the database for its
 * transaction within a few microtasks, so after this it has done so, or something is holding it.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/** The request's stored files that are not removed. */
async function activeFileNames(requestId: string): Promise<string[]> {
  const harness = await harnessPromise;
  return (await harness.listRequestAttachments(requestId)).filter((record) => record.removedAt === null || record.removedAt === undefined).map((record) => String(record.fileName)).sort();
}

/*
 * WR-301 (the pilot's ruling): the in-process half of withRequestLock, proven deterministically. The harness holds the
 * first writer inside the lock just after its active count, with the request at 19, and lets the second writer in at the
 * lock's door only then. The second writer must not ask the database for its transaction, nor reach its own count, while
 * the first is held: the lock's in-process tail keeps it out. (On SQLite's one connection the second writer could do none
 * of its own reads while the first holds the transaction, so it is screened and stored first and waits at the door
 * holding nothing.) Released, the first commits the 20th file and the second reads 20 under the lock and is refused,
 * its stored bytes deleted. The row lock that does the same across processes is R-08-37's proof, on PostgreSQL.
 */
test("an upload held inside the request lock just after counting 19 keeps a second upload out of the lock until it commits: one 201, one 409 ATTACHMENT_LIMIT_REACHED, 20 active, the late bytes deleted (D-10, WR-301)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("submitted");
  await harness.seedRequestAttachments(requestId, 19);
  const janeNote = await postNote(requestId, harness.identities.owner, "The second held file is attached.");
  const bobNote = await postNote(requestId, harness.identities.analyst, "The first held file is attached.");
  const filesBefore = await harness.countUploadFileRecords();
  const storedBefore = (await harness.listAttachmentStorageFiles()).length;

  const { first, second, calls } = await harness.withHeldRequestLock(requestId, async (lock) => {
    const second = upload(requestId, harness.identities.owner, uploadForm("held-second.txt", Buffer.from("The second held file.", "utf8"), janeNote));
    await within(lock.atDoor, "THE_SECOND_UPLOAD_NEVER_REACHED_THE_LOCK");
    const first = upload(requestId, harness.identities.analyst, uploadForm("held-first.txt", Buffer.from("The first held file.", "utf8"), bobNote));
    assert.equal(await within(lock.countHeld, "THE_FIRST_UPLOAD_NEVER_COUNTED_INSIDE_THE_LOCK"), 19, "THE_FIRST_UPLOAD_DID_NOT_COUNT_19");
    lock.admitFirst();
    await settle();
    const [waiting, holding] = lock.calls();
    assert.deepEqual(holding, { transactionRequested: true, activeCounts: [19] }, "THE_FIRST_UPLOAD_IS_NOT_THE_ONE_HELD");
    assert.deepEqual(waiting, { transactionRequested: false, activeCounts: [] }, "THE_SECOND_UPLOAD_REACHED_THE_DATABASE_WHILE_THE_FIRST_HELD_THE_REQUEST");
    lock.releaseCount();
    return { first: await first, second: await second, calls: lock.calls() };
  });

  assert.equal(first.status, 201, `THE_HELD_UPLOAD_WAS_NOT_ADDED: ${await first.clone().text()}`);
  assert.deepEqual(await refusalOf(second), { status: 409, reason: "ATTACHMENT_LIMIT_REACHED" }, "THE_LATE_UPLOAD_WAS_NOT_REFUSED_AT_THE_LIMIT");
  // The second read 20 under the lock, only after the first committed.
  assert.deepEqual(calls.map((call) => call.activeCounts), [[20], [19]], "UNEXPECTED_COUNTS_UNDER_THE_LOCK");
  const active = await activeFileNames(requestId);
  assert.equal(active.length, 20, "UNEXPECTED_ACTIVE_FILES");
  assert.ok(active.includes("held-first.txt") && !active.includes("held-second.txt"), `UNEXPECTED_FILES_KEPT_${active.join(",")}`);
  assert.equal(await harness.countUploadFileRecords(), filesBefore + 1, "THE_LATE_FILE_RECORD_WAS_KEPT");
  assert.equal((await harness.listAttachmentStorageFiles()).length, storedBefore + 1, "THE_LATE_FILE_BYTES_WERE_KEPT");
});

/*
 * WR-301: a restore at 19 obeys the same invariant as an upload (canRestoreAttachment's limit), under the same lock. Each
 * order is held in turn: the restore held after its count with Jane's upload at the door, then her upload held with the
 * restore at the door. The writer at the door does not reach the database while the other is held, and is then refused
 * ATTACHMENT_LIMIT_REACHED with 20 active.
 */
test("a restore and an upload at 19 meet one lock: the one held just after its count keeps the other out until it commits, and the other is refused ATTACHMENT_LIMIT_REACHED with 20 active (D-10, WR-301)", async () => {
  const harness = await harnessPromise;
  for (const held of ["restore", "upload"] as const) {
    const requestId = await seedRequest("submitted");
    const [removedId] = (await harness.seedRequestAttachments(requestId, 20)).map(String);
    await harness.updateFixtureDocument(ATTACHMENT_UID, removedId!, { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.analyst });
    const janeNote = await postNote(requestId, harness.identities.owner, `The ${held} race file is attached.`);
    const storedBefore = (await harness.listAttachmentStorageFiles()).length;
    const restore = () => setRemoval(requestId, removedId!, harness.identities.analyst, false);
    const add = () => upload(requestId, harness.identities.owner, uploadForm(`${held}-race.txt`, Buffer.from(`The ${held} race file.`, "utf8"), janeNote));

    const outcome = await harness.withHeldRequestLock(requestId, async (lock) => {
      const waiting = held === "restore" ? add() : restore();
      await within(lock.atDoor, `THE_WAITING_WRITER_NEVER_REACHED_THE_LOCK_${held}`);
      const holding = held === "restore" ? restore() : add();
      assert.equal(await within(lock.countHeld, `THE_HELD_${held}_NEVER_COUNTED_INSIDE_THE_LOCK`), 19, `THE_HELD_${held}_DID_NOT_COUNT_19`);
      lock.admitFirst();
      await settle();
      assert.deepEqual(lock.calls()[0], { transactionRequested: false, activeCounts: [] }, `THE_WAITING_WRITER_REACHED_THE_DATABASE_WHILE_THE_${held}_HELD_THE_REQUEST`);
      lock.releaseCount();
      return { holding: await holding, waiting: await waiting, calls: lock.calls() };
    });

    assert.equal(outcome.holding.status, held === "restore" ? 200 : 201, `THE_HELD_${held}_WAS_NOT_TAKEN: ${await outcome.holding.clone().text()}`);
    assert.deepEqual(await refusalOf(outcome.waiting), { status: 409, reason: "ATTACHMENT_LIMIT_REACHED" }, `THE_WAITING_WRITER_WAS_NOT_REFUSED_AT_THE_LIMIT_${held}`);
    assert.equal(outcome.calls[0]?.activeCounts[0], 20, `THE_WAITING_WRITER_DID_NOT_READ_20_${held}`);
    const active = await activeFileNames(requestId);
    assert.equal(active.length, 20, `UNEXPECTED_ACTIVE_FILES_${held}`);
    const stored = await harness.listRequestAttachments(requestId);
    const restoredRecord = stored.find((record) => record.documentId === removedId);
    assert.equal(restoredRecord?.removedAt === null || restoredRecord?.removedAt === undefined, held === "restore", `UNEXPECTED_RESTORE_OUTCOME_${held}`);
    assert.equal(active.includes(`${held}-race.txt`), held === "upload", `UNEXPECTED_UPLOAD_OUTCOME_${held}`);
    assert.equal((await harness.listAttachmentStorageFiles()).length, storedBefore + (held === "upload" ? 1 : 0), `THE_REFUSED_UPLOAD_BYTES_WERE_KEPT_${held}`);
  }
});

/*
 * WR-204 (the pilot's ruling, which differs from the finding: one place per uploader and a bounded queue, not separate
 * slots for probes and extractions): one screening in flight per uploader, keyed by the resolved IdamBox User. While
 * Jane's first upload is held inside screening, her next is refused at once with 503 ATTACHMENT_BUSY, nothing of it is
 * stored and its refusal is one attachment.refused line. Another uploader's screening is not held up by hers. When her
 * first is released it is added, and her slot is free again.
 */
test("while one of Jane's uploads is screened, her next is refused at once with 503 ATTACHMENT_BUSY, one refusal line and nothing stored, and another uploader is not refused (WR-204)", async () => {
  const harness = await harnessPromise;
  const firstRequest = await seedRequest();
  const secondRequest = await seedRequest();
  const otherDraft = await seedRequest("draft", "otherRequestor");

  await harness.withHeldScreening(async ({ reached, release }) => {
    const first = upload(firstRequest, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT));
    let added: Response | undefined;
    try {
      await reached;
      const before = await persisted(secondRequest);
      const { result: busy, events } = await captureSecurityEvents(() => upload(secondRequest, harness.identities.owner, uploadForm("checklist.txt", PLAN_TEXT)));
      const body = await json(busy.clone());
      assert.deepEqual(await refusalOf(busy), { status: 503, reason: "ATTACHMENT_BUSY" }, `THE_SECOND_UPLOAD_WAS_NOT_REFUSED_BUSY: ${JSON.stringify(body)}`);
      assert.deepEqual([(body.error as Json).status, (body.error as Json).name], [503, "ServiceUnavailableError"], "UNEXPECTED_BUSY_ERROR");
      assert.deepEqual(await persisted(secondRequest), before, "THE_BUSY_UPLOAD_WROTE_SOMETHING");
      assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.event.requestId, entry.level]), [
        ["attachment.refused", "ATTACHMENT_BUSY", secondRequest, "info"],
      ], `UNEXPECTED_BUSY_EVENTS_${events.map((entry) => entry.line).join(" | ")}`);
      assert.deepEqual((events[0]?.event.actor as Json | undefined)?.documentId, harness.users.owner, "UNEXPECTED_BUSY_ACTOR");
      assert.ok(!events[0]?.line.includes("checklist.txt"), "UNEXPECTED_FILE_NAME_LOGGED");

      // Someone else's screening is not held up by Jane's: only the queue bound applies to them.
      const other = await upload(otherDraft, harness.identities.otherRequestor, uploadForm("notes.txt", PLAN_TEXT));
      assert.equal(other.status, 201, `ANOTHER_UPLOADER_WAS_REFUSED: ${await other.clone().text()}`);
    } finally {
      // The held upload always finishes inside this test, so nothing of it reaches the next one.
      release();
      added = await first;
    }
    assert.equal(added.status, 201, `THE_HELD_UPLOAD_WAS_NOT_ADDED: ${await added.clone().text()}`);
  });

  // The slot was released with the screening: Jane's next upload is added.
  const again = await upload(secondRequest, harness.identities.owner, uploadForm("checklist.txt", PLAN_TEXT));
  assert.equal(again.status, 201, `JANE'S_SLOT_WAS_NOT_RELEASED: ${await again.clone().text()}`);
});

/*
 * WR-204: when the one screening and extraction queue is full, a PDF upload, whose open check needs the worker, is
 * refused at once with 503 ATTACHMENT_BUSY instead of waiting: nothing is stored and its refusal is one line. Once the
 * queue has room the same file is added.
 */
test("a PDF upload while the screening and extraction queue is full is refused at once with 503 ATTACHMENT_BUSY, one refusal line and nothing stored (WR-204)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const pack = buildPdf(["Vendor security pack, page one."]);
  const before = await persisted(requestId);

  await harness.withFullExtractionQueue(async () => {
    const { result: busy, events } = await captureSecurityEvents(() => upload(requestId, harness.identities.owner, uploadForm("pack.pdf", pack)));
    assert.deepEqual(await refusalOf(busy), { status: 503, reason: "ATTACHMENT_BUSY" }, "THE_PDF_WAS_NOT_REFUSED_BUSY");
    assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.event.requestId]), [
      ["attachment.refused", "ATTACHMENT_BUSY", requestId],
    ], `UNEXPECTED_QUEUE_FULL_EVENTS_${events.map((entry) => entry.line).join(" | ")}`);
    assert.ok(!events[0]?.line.includes("pack.pdf"), "UNEXPECTED_FILE_NAME_LOGGED");
  });
  assert.deepEqual(await persisted(requestId), before, "THE_BUSY_PDF_WROTE_SOMETHING");

  const added = await upload(requestId, harness.identities.owner, uploadForm("pack.pdf", pack));
  assert.equal(added.status, 201, `THE_PDF_WAS_NOT_ADDED_ONCE_THE_QUEUE_HAD_ROOM: ${await added.clone().text()}`);
});

/* Task 3 (D-09 to D-14, D-37): refused files say why and leave nothing; every refusal is a security event line. */

/** The harmless test signature the development double flags (D-14); never the industry test string. */
const MALWARE_TEXT = Buffer.from("Release notes for the vendor agent.\nCSRM-TEST-MALWARE-SIGNATURE-7c1e4a\n", "utf8");

/**
 * The regular files of exactly `size` bytes in the system temporary directory modified at or after `since`: what a
 * multipart upload would leave behind if its temporary file were not deleted.
 */
function temporaryFilesOfSize(size: number, since: number): string[] {
  const directory = os.tmpdir();
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    try {
      const stats = statSync(path.join(directory, name));
      if (stats.isFile() && stats.size === size && stats.mtimeMs >= since) found.push(name);
    } catch {
      // A file another process removed while we listed the directory.
    }
  }
  return found;
}

test("disallowed, oversize, empty and infected files are refused with their reason and status, leave nothing, and each is one refusal event (D-09 to D-14, D-37)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const oversize = Buffer.alloc(26_214_401, 0x61);
  const cases: Array<[label: string, fileName: string, bytes: Buffer, status: number, reason: string]> = [
    // IN-202 (the stage B amendment, item 5): an archive comment is a structure CSRM will not read, not a mismatch.
    ["STRUCTURE", "plan.docx", buildDocx(["Quarterly plan"], { archiveComment: "Saved by an archiver" }), 415, "ATTACHMENT_UNSUPPORTED_STRUCTURE"],
    // WR-205: a macro-free DOCX whose external oleObject relationship is the Follina vector, built in memory.
    ["ACTIVE_CONTENT", "plan.docx", buildDocx(["Quarterly plan"], { documentRelationships: [["rId90", `${OFFICE_RELATIONSHIPS}/oleObject`, "https://example.invalid/payload.html!", "External"]] }), 415, "ATTACHMENT_ACTIVE_CONTENT"],
    ["MISMATCH", "invoice.pdf", buildPng(), 415, "ATTACHMENT_CONTENT_MISMATCH"],
    ["MACRO", "plan.docm", buildMacroDocx(), 415, "ATTACHMENT_MACRO_ENABLED"],
    ["ENCRYPTED", "secret.pdf", buildPasswordPdf(), 415, "ATTACHMENT_ENCRYPTED"],
    ["LEGACY", "old.doc", buildLegacyDoc(), 415, "ATTACHMENT_LEGACY_OFFICE"],
    ["NOT_ALLOWED", "tool.exe", buildRenamedExecutable(), 415, "ATTACHMENT_TYPE_NOT_ALLOWED"],
    ["TOO_LARGE", "big.txt", oversize, 413, "ATTACHMENT_TOO_LARGE"],
    ["EMPTY", "empty.txt", Buffer.alloc(0), 400, "ATTACHMENT_EMPTY"],
    ["MALWARE", "release-notes.txt", MALWARE_TEXT, 422, "ATTACHMENT_MALWARE_FOUND"],
  ];

  for (const [label, fileName, bytes, status, reason] of cases) {
    const started = Date.now() - 1_000;
    const before = await persisted(requestId);
    const { result: response, events } = await captureSecurityEvents(() => upload(requestId, harness.identities.owner, uploadForm(fileName, bytes)));
    const body = await json(response);
    assert.equal(response.status, status, `UNEXPECTED_STATUS_${label}: ${JSON.stringify(body).slice(0, 300)}`);
    const error = body.error as Json;
    assert.equal(error.status, status, `UNEXPECTED_ERROR_STATUS_${label}`);
    const details = error.details as Json;
    assert.equal(details.reason, reason, `UNEXPECTED_REASON_${label}`);
    if (reason === "ATTACHMENT_MALWARE_FOUND") {
      assert.deepEqual(details, { reason, detection: "Csrm.Test.Signature" }, "UNEXPECTED_MALWARE_DETAILS");
      assert.equal(error.name, "UnprocessableEntityError", "UNEXPECTED_MALWARE_ERROR_NAME");
    } else {
      assert.deepEqual(Object.keys(details), ["reason"], `UNEXPECTED_DETAILS_${label}`);
    }
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
    // The multipart temporary file is gone too (the empty file has no size to tell it from another process's).
    if (bytes.length > 0) assert.deepEqual(temporaryFilesOfSize(bytes.length, started), [], `UNEXPECTED_TEMPORARY_FILE_${label}`);

    assert.equal(events.length, 1, `UNEXPECTED_EVENT_COUNT_${label}_${events.map((entry) => entry.line).join(" | ")}`);
    const [event] = events;
    assert.equal(event?.event.event, "attachment.refused", `UNEXPECTED_EVENT_${label}`);
    assert.equal(event?.event.reason, reason, `UNEXPECTED_EVENT_REASON_${label}`);
    assert.equal(event?.event.requestId, requestId, `UNEXPECTED_EVENT_REQUEST_${label}`);
    assert.equal(event?.level, reason === "ATTACHMENT_MALWARE_FOUND" ? "warn" : "info", `UNEXPECTED_EVENT_LEVEL_${label}`);
    if (reason === "ATTACHMENT_MALWARE_FOUND") assert.equal(event?.event.detection, "Csrm.Test.Signature", "UNEXPECTED_EVENT_DETECTION");
    assert.ok(!event?.line.includes(fileName), `UNEXPECTED_FILE_NAME_LOGGED_${label}`);
  }
});

test("a refused part and a refused window are security events too, with nothing of the file in the line (D-37)", async () => {
  const harness = await harnessPromise;
  const draft = await seedRequest();
  const extra = uploadForm("plan.txt", Buffer.from("Vendor access plan.", "utf8"));
  extra.set("extra", "value");
  const { result: partResponse, events: partEvents } = await captureSecurityEvents(() => upload(draft, harness.identities.owner, extra));
  assert.equal(partResponse.status, 400, "UNEXPECTED_PART_STATUS");
  assert.deepEqual(partEvents.map((entry) => [entry.event.event, entry.event.outcome, entry.level]), [["attachment.refused", "refused", "info"]], "UNEXPECTED_PART_EVENT");

  const released = await seedRequest("approved");
  const { result: closedResponse, events: closedEvents } = await captureSecurityEvents(() => upload(released, harness.identities.owner, uploadForm("plan.txt", Buffer.from("Vendor access plan.", "utf8"))));
  assert.equal(closedResponse.status, 409, "UNEXPECTED_CLOSED_STATUS");
  assert.deepEqual(closedEvents.map((entry) => [entry.event.event, entry.event.reason]), [["attachment.refused", "ATTACHMENTS_CLOSED"]], "UNEXPECTED_CLOSED_EVENT");
  for (const entry of [...partEvents, ...closedEvents]) assert.ok(!entry.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");
});

/*
 * IN-705: the published error responses are closed ({ error } only), so a refusal the attachment controller writes
 * itself carries no `data` key. Strapi's own framework refusals (a policy 403, an internal 500) keep R-08-38's quirk.
 */
test("every refusal the attachment operations write is the closed error envelope alone, with no data key (IN-705)", async () => {
  const harness = await harnessPromise;
  const draft = await seedRequest();
  const added = await upload(draft, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT));
  assert.equal(added.status, 201, `UNEXPECTED_SEED_UPLOAD_STATUS: ${await added.clone().text()}`);
  const attachmentId = String(((await json(added)).data as Json).documentId);
  const released = await seedRequest("approved");
  const extraPart = uploadForm("plan.txt", PLAN_TEXT);
  extraPart.set("extra", "value");
  const aiInput = (requestId: string, file: string) => harness.request({
    path: `${attachmentsPath(requestId)}/${encodeURIComponent(file)}/ai_input`,
    identity: harness.identities.analyst,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { included: true } }) },
  });
  const cases: Array<[label: string, send: () => Promise<Response>, status: number]> = [
    ["LIST_404", () => list("no-such-request", harness.identities.owner), 404],
    ["UPLOAD_400", () => upload(draft, harness.identities.owner, extraPart), 400],
    ["UPLOAD_409", () => upload(released, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT)), 409],
    ["UPLOAD_415", () => upload(draft, harness.identities.owner, uploadForm("invoice.pdf", buildPng())), 415],
    ["UPLOAD_422", () => upload(draft, harness.identities.owner, uploadForm("release-notes.txt", MALWARE_TEXT)), 422],
    ["DOWNLOAD_404", () => download(draft, "no-such-attachment", harness.identities.owner), 404],
    ["REMOVAL_400", () => setRemoval(draft, attachmentId, harness.identities.owner, { raw: JSON.stringify({ removed: true }) }), 400],
    ["AI_INPUT_409", () => aiInput(draft, attachmentId), 409],
  ];
  for (const [label, send, status] of cases) {
    const response = await send();
    const body = await json(response);
    assert.equal(response.status, status, `UNEXPECTED_STATUS_${label}: ${JSON.stringify(body).slice(0, 300)}`);
    assert.deepEqual(Object.keys(body), ["error"], `THE_REFUSAL_IS_NOT_THE_CLOSED_ENVELOPE_${label}`);
    assert.equal((body.error as Json).status, status, `UNEXPECTED_ERROR_STATUS_${label}`);
  }
});

/*
 * IN-601 (D-18): a 404 is the refusal a missing record gets at every attachment route, so it never names the rule that
 * refused it: not for a caller outside the readers rule, a file id that is not on the request, or a missing request.
 * Each case goes through refusalOf, which fails on any `details` beside a 404.
 */
test("no attachment route's 404 names a reason: the readers rule, a foreign file and a missing request read alike (D-18, IN-601)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await submittedRequestWithDataFlow();
  const otherRequest = await seedRequest("submitted");
  const [foreign] = await harness.seedRequestAttachments(otherRequest, 1);
  const jsonPut = (body: unknown): RequestInit => ({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const routes = (target: string, file: string): Array<[route: string, path: string, init: RequestInit | undefined]> => [
    ["LIST", attachmentsPath(target), undefined],
    ["UPLOAD", attachmentsPath(target), { method: "POST", body: uploadForm("intrusion.txt", Buffer.from("Should never be stored.")) }],
    ["DOWNLOAD", contentPath(target, file), undefined],
    ["REMOVAL", removalPath(target, file), jsonPut({ data: { removed: true } })],
    ["AI_INPUT", `${attachmentsPath(target)}/${encodeURIComponent(file)}/ai_input`, jsonPut({ data: { included: true } })],
    ["AI_TEXT", `${attachmentsPath(target)}/${encodeURIComponent(file)}/ai_text`, undefined],
  ];
  const fileRoutes = new Set(["DOWNLOAD", "REMOVAL", "AI_INPUT", "AI_TEXT"]);
  const aiRoutes = new Set(["AI_INPUT", "AI_TEXT"]);
  const cases: Array<[label: string, identity: string, target: string, file: string, applies: (route: string) => boolean]> = [
    // The readers rule: the AI routes refuse these two callers 403 by their grant, before any record is read.
    ["OTHER_REQUESTOR", harness.identities.otherRequestor, requestId, attachmentId, (route) => !aiRoutes.has(route)],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent, requestId, attachmentId, (route) => !aiRoutes.has(route)],
    ["FOREIGN_FILE", harness.identities.analyst, requestId, String(foreign), (route) => fileRoutes.has(route)],
    ["UNKNOWN_FILE", harness.identities.analyst, requestId, "no-such-attachment", (route) => fileRoutes.has(route)],
    ["MISSING_REQUEST", harness.identities.analyst, "no-such-request", attachmentId, () => true],
  ];
  let checked = 0;
  for (const [label, identity, target, file, applies] of cases) {
    for (const [route, routePath, init] of routes(target, file)) {
      if (!applies(route)) continue;
      const response = await harness.request({ path: routePath, identity, ...(init ? { init } : {}) });
      assert.deepEqual(await refusalOf(response), { status: 404, reason: undefined }, `UNEXPECTED_REFUSAL_${label}_${route}`);
      checked += 1;
    }
  }
  assert.equal(checked, 22, "UNEXPECTED_CASE_COUNT");
});

test("a 24 MiB text file is added and its stored bytes equal the upload (D-07, the large path on the local adapter)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const line = Buffer.from("Vendor log line: access granted through the PAM vault.\n", "utf8");
  const large = Buffer.alloc(24 * 1024 * 1024);
  for (let offset = 0; offset < large.length; offset += line.length) line.copy(large, offset);
  const response = await upload(requestId, harness.identities.owner, uploadForm("vendor-log.txt", large));
  assert.equal(response.status, 201, `UNEXPECTED_LARGE_STATUS: ${await response.clone().text()}`);
  const attachment = (await json(response)).data as Json;
  assert.deepEqual([attachment.fileType, attachment.byteSize, attachment.state], ["txt", large.length, "available"], "UNEXPECTED_LARGE_ATTACHMENT");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.sha256, createHash("sha256").update(large).digest("hex"), "UNEXPECTED_LARGE_DIGEST");
  const bytes = await harness.attachmentStorage().read(stored?.fileId as number);
  assert.equal(Buffer.compare(bytes, large), 0, "UNEXPECTED_LARGE_STORED_BYTES");
});

/* 14-07 Task 2 (D-13, D-20, D-21, D-23, D-37): a visible but unavailable file is refused with its reason, never its bytes. */

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const VENDOR_PACK = readFileSync(path.join(strapiDir, "tests", "fixtures", "attachments", "vendor-security-pack.pdf"));

/** Jane's file on her own draft: its documentId and its plugin file record's id. */
async function janeFile(fileName: string, bytes: Buffer, requestId?: string): Promise<{ requestId: string; attachmentId: string; fileId: number }> {
  const harness = await harnessPromise;
  const target = requestId ?? await seedRequest();
  const added = await upload(target, harness.identities.owner, uploadForm(fileName, bytes));
  assert.equal(added.status, 201, `UNEXPECTED_SEED_UPLOAD_STATUS: ${await added.clone().text()}`);
  const attachmentId = String(((await json(added)).data as Json).documentId);
  const stored = (await harness.listRequestAttachments(target)).find((record) => record.documentId === attachmentId);
  assert.equal(typeof stored?.fileId, "number", "UNEXPECTED_NO_STORED_FILE");
  return { requestId: target, attachmentId, fileId: stored?.fileId as number };
}

/** The refusal's status and closed reason, with a check that no byte of the file is in the body. */
async function downloadRefusal(requestId: string, attachmentId: string, identity: string, fileBytes: Buffer): Promise<{ status: number; reason: unknown }> {
  const response = await download(requestId, attachmentId, identity);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.includes(fileBytes.subarray(0, Math.min(48, fileBytes.length))), false, "UNEXPECTED_FILE_BYTES_IN_REFUSAL");
  const parsed = JSON.parse(body.toString("utf8")) as { error?: { details?: { reason?: unknown } } };
  return { status: response.status, reason: parsed.error?.details?.reason };
}

test("a removed file is refused at the download with ATTACHMENT_REMOVED (D-20, D-23)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
  await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { removedAt: new Date().toISOString(), removedBy: harness.users.owner });
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    assert.deepEqual(await downloadRefusal(requestId, attachmentId, identity, PLAN_TEXT), { status: 409, reason: "ATTACHMENT_REMOVED" }, "UNEXPECTED_REMOVED_REFUSAL");
  }
});

test("a file waiting for its malware check is refused at the download with ATTACHMENT_QUARANTINED (D-13, D-23)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
  await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { scanStatus: "pending", scanCheckedAt: null, scanAttempts: 1 });
  assert.deepEqual(await downloadRefusal(requestId, attachmentId, harness.identities.owner, PLAN_TEXT), { status: 409, reason: "ATTACHMENT_QUARANTINED" }, "UNEXPECTED_PENDING_REFUSAL");
});

test("a blocked file is refused at the download with ATTACHMENT_BLOCKED (D-21, D-23)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
  await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { scanStatus: "blocked", scanDetection: "Win.Test.Fake" });
  assert.deepEqual(await downloadRefusal(requestId, attachmentId, harness.identities.analyst, PLAN_TEXT), { status: 409, reason: "ATTACHMENT_BLOCKED" }, "UNEXPECTED_BLOCKED_REFUSAL");
});

test("a file whose stored file record was deleted lists as unavailable and is refused at the download with ATTACHMENT_UNAVAILABLE (D-21, D-23)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId, fileId } = await janeFile("plan.txt", PLAN_TEXT);
  const strapi = (globalThis as unknown as { strapi: { db: { query: (uid: string) => { delete: (input: { where: { id: number } }) => Promise<unknown> } } } }).strapi;
  await strapi.db.query("plugin::upload.file").delete({ where: { id: fileId } });

  const listed = await json(await list(requestId, harness.identities.owner));
  const entry = (listed.data as Json[]).find((file) => file.documentId === attachmentId);
  assert.deepEqual([entry?.state, (entry?.actions as Json | undefined)?.download], ["unavailable", false], "UNEXPECTED_UNAVAILABLE_LISTING");
  assert.deepEqual(await downloadRefusal(requestId, attachmentId, harness.identities.owner, PLAN_TEXT), { status: 409, reason: "ATTACHMENT_UNAVAILABLE" }, "UNEXPECTED_UNAVAILABLE_REFUSAL");
});

test("stored bytes overwritten on disk are refused with ATTACHMENT_INTEGRITY_FAILED, no file byte, and a warning-level integrity event (D-23, D-37)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId, fileId } = await janeFile("plan.txt", PLAN_TEXT);
  const record = await harness.findUploadFileRecord(fileId);
  assert.ok(record && typeof record.hash === "string" && typeof record.ext === "string", "UNEXPECTED_NO_PLUGIN_FILE_RECORD");
  const tampered = Buffer.from("Vendor access plan: offshore support connects DIRECTLY, no PAM vault.", "utf8");
  writeFileSync(path.join(harness.attachmentStorageDirectory(), `${record.hash}${record.ext}`), tampered);

  const { result: refusal, events } = await captureSecurityEvents(async () => {
    const response = await download(requestId, attachmentId, harness.identities.analyst);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.includes(tampered.subarray(0, 32)), false, "UNEXPECTED_TAMPERED_BYTES_SENT");
    assert.equal(body.includes(PLAN_TEXT.subarray(0, 32)), false, "UNEXPECTED_ORIGINAL_BYTES_SENT");
    return { status: response.status, reason: (JSON.parse(body.toString("utf8")) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason };
  });
  assert.deepEqual(refusal, { status: 409, reason: "ATTACHMENT_INTEGRITY_FAILED" }, "UNEXPECTED_INTEGRITY_REFUSAL");
  // WR-103: the refusal is also its attachment.refused line, as at the AI inclusion, after the warning-level evidence.
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.level, entry.event.attachmentId, entry.event.outcome, entry.event.reason]), [
    ["attachment.integrity_failed", "warn", attachmentId, "refused", "ATTACHMENT_INTEGRITY_FAILED"],
    ["attachment.refused", "info", attachmentId, "refused", "ATTACHMENT_INTEGRITY_FAILED"],
  ], `UNEXPECTED_INTEGRITY_EVENTS_${events.map((entry) => entry.line).join(" | ")}`);
  assert.equal(events[0]?.event.sha256, createHash("sha256").update(PLAN_TEXT).digest("hex"), "UNEXPECTED_INTEGRITY_EVENT_RECORDED_DIGEST");
  assert.ok(!events[0]?.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");
});

test("Jane's file id under another request of hers is 404 at the download (D-18, D-23)", async () => {
  const harness = await harnessPromise;
  const { attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
  const otherRequest = await seedRequest();
  const response = await download(otherRequest, attachmentId, harness.identities.owner);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 404, `UNEXPECTED_CROSS_REQUEST_STATUS: ${body.toString("utf8").slice(0, 300)}`);
  assert.equal(body.includes(PLAN_TEXT.subarray(0, 32)), false, "UNEXPECTED_CROSS_REQUEST_BYTES");
});

/*
 * WR-103 (D-11, D-18, D-37; the pilot's ruling, which overrules 14-06's and 14-07's narrowed logging): every refusal
 * after the policy is one attachment.refused line, the readers-rule 404 included. The 404 logs the closed log reason
 * NOT_FOUND and only the identifiers the caller asked for, each held to the log's identifier rule (one that fails it is
 * dropped), and the response stays a 404 that names no reason.
 */
const NOT_FOUND_KEYS = ["event", "schemaVersion", "at", "actor", "requestId", "attachmentId", "outcome", "reason"];

/** Asserts `events` is exactly the one NOT_FOUND line for these requested ids, by this actor, and nothing else. */
function assertOneNotFoundLine(events: LoggedEvent[], expected: { actor: string; requestId?: string; attachmentId?: string }, label: string): void {
  assert.equal(events.length, 1, `NOT_ONE_REFUSAL_LINE_${label}: ${events.map((entry) => entry.line).join(" | ")}`);
  const [{ level, event }] = events as [LoggedEvent];
  const keys = NOT_FOUND_KEYS.filter((key) => (key !== "requestId" || expected.requestId !== undefined) && (key !== "attachmentId" || expected.attachmentId !== undefined));
  assert.deepEqual(Object.keys(event), keys, `UNEXPECTED_NOT_FOUND_KEYS_${label}`);
  assert.deepEqual(
    [event.event, level, (event.actor as Json).documentId, event.requestId, event.attachmentId, event.outcome, event.reason],
    ["attachment.refused", "info", expected.actor, expected.requestId, expected.attachmentId, "refused", "NOT_FOUND"],
    `UNEXPECTED_NOT_FOUND_LINE_${label}`,
  );
}

test("every readers-rule 404 at the list, the upload, the download, the removal and the restore is one NOT_FOUND line with only the requested ids, and the 404 names no reason (WR-103)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await submittedRequestWithDataFlow();
  const otherRequest = await seedRequest("submitted");
  const intrusion = () => uploadForm("intrusion.txt", Buffer.from("Should never be stored.", "utf8"));
  const operations = (identity: string, target: string, file: string) => ({
    LIST: () => list(target, identity),
    UPLOAD: () => upload(target, identity, intrusion()),
    DOWNLOAD: () => download(target, file, identity),
    REMOVAL: () => setRemoval(target, file, identity, true),
    RESTORE: () => setRemoval(target, file, identity, false),
  });
  const cases: Array<[string, () => Promise<Response>, { actor: string; requestId?: string; attachmentId?: string }]> = [];
  // Another Requestor probing Jane's request, at every operation (success criterion 2's attack).
  const other = operations(harness.identities.otherRequestor, requestId, attachmentId);
  for (const [name, call] of Object.entries(other)) {
    const withFile = name !== "LIST" && name !== "UPLOAD";
    cases.push([`OTHER_REQUESTOR_${name}`, call, { actor: harness.users.otherRequestor, requestId, ...(withFile ? { attachmentId } : {}) }]);
  }
  // Jane's own file id under another request of hers: a foreign attachment id.
  const foreign = operations(harness.identities.owner, otherRequest, attachmentId);
  for (const name of ["DOWNLOAD", "REMOVAL", "RESTORE"] as const) {
    cases.push([`FOREIGN_FILE_${name}`, foreign[name], { actor: harness.users.owner, requestId: otherRequest, attachmentId }]);
  }
  // A missing request, and identifiers the log's rule refuses, which are dropped rather than echoed.
  const missing = operations(harness.identities.owner, "no-such-request", attachmentId);
  cases.push(["MISSING_REQUEST_LIST", missing.LIST, { actor: harness.users.owner, requestId: "no-such-request" }]);
  cases.push(["MISSING_REQUEST_DOWNLOAD", missing.DOWNLOAD, { actor: harness.users.owner, requestId: "no-such-request", attachmentId }]);
  cases.push(["UNLOGGABLE_REQUEST_ID", operations(harness.identities.owner, "payroll.2026", attachmentId).LIST, { actor: harness.users.owner }]);
  cases.push(["UNLOGGABLE_FILE_ID", operations(harness.identities.owner, requestId, "payroll.xlsx").DOWNLOAD, { actor: harness.users.owner, requestId }]);

  for (const [label, call, expected] of cases) {
    const { result, events } = await captureSecurityEvents(async () => refusalOf(await call()));
    assert.deepEqual(result, { status: 404, reason: undefined }, `UNEXPECTED_REFUSAL_${label}`);
    assertOneNotFoundLine(events, expected, label);
    for (const entry of events) assert.ok(!entry.line.includes("payroll") && !entry.line.includes("data-flow"), `AN_UNLOGGABLE_ID_OR_NAME_WAS_LOGGED_${label}`);
  }
});

test("each download state refusal is one attachment.refused line with its reason and the file's id (WR-103, D-23)", async () => {
  const harness = await harnessPromise;
  const strapi = (globalThis as unknown as { strapi: { db: { query: (uid: string) => { delete: (input: { where: { id: number } }) => Promise<unknown> } } } }).strapi;
  const removed = { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.owner };
  for (const [label, reason, change] of [
    ["REMOVED", "ATTACHMENT_REMOVED", removed],
    ["PENDING", "ATTACHMENT_QUARANTINED", { scanStatus: "pending", scanCheckedAt: null, scanAttempts: 1 }],
    ["BLOCKED", "ATTACHMENT_BLOCKED", { scanStatus: "blocked", scanDetection: "Win.Test.Fake" }],
    ["UNAVAILABLE", "ATTACHMENT_UNAVAILABLE", null],
  ] as const) {
    const { requestId, attachmentId, fileId } = await janeFile("plan.txt", PLAN_TEXT);
    if (change === null) await strapi.db.query("plugin::upload.file").delete({ where: { id: fileId } });
    else await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, change);
    const { result, events } = await captureSecurityEvents(() => downloadRefusal(requestId, attachmentId, harness.identities.owner, PLAN_TEXT));
    assert.deepEqual(result, { status: 409, reason }, `UNEXPECTED_REFUSAL_${label}`);
    assert.deepEqual(
      events.map((entry) => [entry.event.event, entry.level, entry.event.requestId, entry.event.attachmentId, entry.event.outcome, entry.event.reason]),
      [["attachment.refused", "info", requestId, attachmentId, "refused", reason]],
      `UNEXPECTED_EVENTS_${label}_${events.map((entry) => entry.line).join(" | ")}`,
    );
    assert.ok(!events[0]?.line.includes("plan.txt"), `UNEXPECTED_FILE_NAME_LOGGED_${label}`);
  }
});

/*
 * IN-102: a refusal that arrives under the request lock (here the 21st-file race, the other upload simulated by the
 * active count the lock reads) is logged with the type, size and digest screening already learnt, as every other upload
 * refusal is, and the bytes stored before the lock are deleted.
 */
test("a refusal under the lock carries the screened file's type, size and digest, and nothing of the file is kept (IN-102)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const before = await persisted(requestId);
  let activeCounts = 0;
  const { result, events } = await captureSecurityEvents(() => withAttachmentCountIntercepted(async (call) => {
    if (!call.active) return call.real();
    activeCounts += 1;
    // The first active count is before the file is read; the second is the lock's re-read, after another upload won.
    return activeCounts === 2 ? LIMITS.maxActive : call.real();
  }, async () => refusalOf(await upload(requestId, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT)))));
  assert.deepEqual(result, { status: 409, reason: "ATTACHMENT_LIMIT_REACHED" }, "UNEXPECTED_LATE_REFUSAL");
  assert.equal(activeCounts, 2, "THE_LOCK_DID_NOT_RE_READ_THE_ACTIVE_COUNT");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_AFTER_A_LATE_REFUSAL");
  assert.deepEqual(
    events.map((entry) => [entry.event.event, entry.event.reason, entry.event.fileType, entry.event.byteSize, entry.event.sha256]),
    [["attachment.refused", "ATTACHMENT_LIMIT_REACHED", "txt", PLAN_TEXT.length, createHash("sha256").update(PLAN_TEXT).digest("hex")]],
    `THE_LATE_REFUSAL_LOST_THE_SCREENED_FACTS_${events.map((entry) => entry.line).join(" | ")}`,
  );
  assert.ok(!events[0]?.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");
});

/*
 * IN-103 (D-10, D-16's one predicate): the active count the limits read through the query engine is isActiveAttachment,
 * file for file. Each state is counted on a request of its own, then all of them on one request.
 */
test("the active count the limits read is isActiveAttachment, file for file: available, pending, blocked and removed (IN-103, D-10)", async () => {
  const harness = await harnessPromise;
  const removed = { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.owner };
  const states = [
    ["CLEAN", {}, true],
    ["PENDING", { scanStatus: "pending", scanCheckedAt: null, scanAttempts: 1 }, true],
    ["BLOCKED", { scanStatus: "blocked", scanDetection: "Win.Test.Fake" }, false],
    ["REMOVED_CLEAN", removed, false],
    ["REMOVED_PENDING", { ...removed, scanStatus: "pending", scanCheckedAt: null, scanAttempts: 1 }, false],
    ["REMOVED_BLOCKED", { ...removed, scanStatus: "blocked", scanDetection: "Win.Test.Fake" }, false],
  ] as const;
  const activeCountOf = async (requestId: string) => (((await json(await list(requestId, harness.identities.owner))).meta as Json).add as Json).activeCount;
  const together = await seedRequest();
  const togetherFiles = await harness.seedRequestAttachments(together, states.length);
  for (const [index, [label, change, active]] of states.entries()) {
    const alone = await seedRequest();
    const [file] = await harness.seedRequestAttachments(alone, 1);
    for (const target of [String(file), String(togetherFiles[index])]) await harness.updateFixtureDocument(ATTACHMENT_UID, target, change);
    const [row] = await harness.listRequestAttachments(alone);
    assert.equal(isActiveAttachment(row as { scanStatus: unknown; removedAt: unknown }), active, `THE_PREDICATE_MISREADS_${label}`);
    assert.equal(await activeCountOf(alone), active ? 1 : 0, `THE_COUNT_QUERY_DIFFERS_FROM_THE_PREDICATE_${label}`);
  }
  const rows = await harness.listRequestAttachments(together);
  assert.equal(await activeCountOf(together), rows.filter((row) => isActiveAttachment(row as { scanStatus: unknown; removedAt: unknown })).length, "THE_COUNT_QUERY_DIFFERS_FROM_THE_PREDICATE");
  assert.equal(await activeCountOf(together), 2, "UNEXPECTED_ACTIVE_COUNT");
});

test("a 24 MiB text file downloads byte for byte, and a non-ASCII name with quotes gets a safe filename and an exact filename* (D-23; 14-RESEARCH Pitfall 15)", async (context) => {
  const harness = await harnessPromise;
  const line = Buffer.from("Vendor log line: access granted through the PAM vault.\n", "utf8");
  const large = Buffer.alloc(24 * 1024 * 1024);
  for (let offset = 0; offset < large.length; offset += line.length) line.copy(large, offset);
  const { requestId, attachmentId } = await janeFile("vendor-log.txt", large);

  const started = performance.now();
  const response = await download(requestId, attachmentId, harness.identities.analyst);
  const bytes = Buffer.from(await response.arrayBuffer());
  const elapsed = performance.now() - started;
  assert.equal(response.status, 200, `UNEXPECTED_LARGE_DOWNLOAD_STATUS: ${bytes.subarray(0, 300).toString("utf8")}`);
  assert.equal(response.headers.get("content-type"), "text/plain", "UNEXPECTED_LARGE_CONTENT_TYPE");
  assert.equal(bytes.length, large.length, "UNEXPECTED_LARGE_DOWNLOAD_SIZE");
  assert.equal(Buffer.compare(bytes, large), 0, "UNEXPECTED_LARGE_DOWNLOAD_BYTES");
  context.diagnostic(`24 MiB download round trip: ${Math.round(elapsed)} ms`);

  const name = "Résumé – vendor \"pack\".pdf";
  const pack = await janeFile("vendor-pack.pdf", VENDOR_PACK, requestId);
  await harness.updateFixtureDocument(ATTACHMENT_UID, pack.attachmentId, { fileName: name });
  const named = await download(requestId, pack.attachmentId, harness.identities.owner);
  assert.equal(named.status, 200, "UNEXPECTED_NAMED_DOWNLOAD_STATUS");
  assert.equal(Buffer.compare(Buffer.from(await named.arrayBuffer()), VENDOR_PACK), 0, "UNEXPECTED_NAMED_DOWNLOAD_BYTES");
  const disposition = named.headers.get("content-disposition") ?? "";
  const match = /^attachment; filename="([^"]*)"; filename\*=UTF-8''([A-Za-z0-9%!._~-]+)$/.exec(disposition);
  assert.ok(match, `UNEXPECTED_DISPOSITION_SHAPE: ${disposition}`);
  assert.equal(match[1], "R_sum_ _ vendor _pack_.pdf", "UNEXPECTED_ASCII_FILENAME");
  assert.equal(decodeURIComponent(match[2] ?? ""), name, "UNEXPECTED_EXTENDED_FILENAME");
});

/* 14-08 Task 1 (D-19, D-20, D-37; COLLAB-02 criterion 4): soft, recorded removal and restore by the person who removed. */

function removalPath(requestId: string, attachmentId: string): string {
  return `${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId)}/removal`;
}

/** PUT …/removal with `{ data: { removed } }`, or with the raw body a case names. */
async function setRemoval(requestId: string, attachmentId: string, identity: string, removed: boolean | { raw: string }): Promise<Response> {
  const harness = await harnessPromise;
  const body = typeof removed === "boolean" ? JSON.stringify({ data: { removed } }) : removed.raw;
  return harness.request({ path: removalPath(requestId, attachmentId), identity, init: { method: "PUT", headers: { "content-type": "application/json" }, body } });
}

test("Jane removes the data-flow DOCX from her draft and restores it, with who and when on the record and its bytes kept (D-19, D-20, D-37)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, `UNEXPECTED_SEED_UPLOAD_STATUS: ${await added.clone().text()}`);
  const uploaded = (await json(added)).data as Json;
  const attachmentId = String(uploaded.documentId);
  const [seeded] = await harness.listRequestAttachments(requestId);
  const fileId = seeded?.fileId as number;
  const storedFiles = await harness.listAttachmentStorageFiles();
  const before = Date.now();

  const { result: removedResponse, events: removedEvents } = await captureSecurityEvents(() => setRemoval(requestId, attachmentId, harness.identities.owner, true));
  const removedText = await removedResponse.text();
  assert.equal(removedResponse.status, 200, `UNEXPECTED_REMOVE_STATUS: ${removedText.slice(0, 300)}`);
  const removed = (JSON.parse(removedText) as Json).data as Json;
  assert.deepEqual(Object.keys(removed).sort(), PROJECTION_KEYS, "UNEXPECTED_REMOVED_PROJECTION_KEYS");
  assert.equal(removed.documentId, attachmentId, "UNEXPECTED_REMOVED_DOCUMENT");
  assert.equal(removed.state, "removed", "UNEXPECTED_REMOVED_STATE");
  assert.deepEqual(removed.removedBy, { documentId: harness.users.owner, displayName: "Jane Doe" }, "UNEXPECTED_REMOVED_BY");
  const removedAt = Date.parse(String(removed.removedAt));
  assert.ok(removedAt >= before - 1_000 && removedAt <= Date.now() + 1_000, "UNEXPECTED_REMOVED_AT_NOT_SERVER_TIME");
  assert.deepEqual(removed.uploadedBy, uploaded.uploadedBy, "UNEXPECTED_REMOVED_UPLOADER");
  assert.deepEqual(removed.actions, { download: false, remove: false, restore: true }, "UNEXPECTED_REMOVED_ACTIONS");

  // D-20: the bytes and the plugin's file record are kept; only the current facts change.
  const [afterRemoval] = await harness.listRequestAttachments(requestId);
  assert.equal(afterRemoval?.fileId, fileId, "UNEXPECTED_FILE_LINK_DROPPED");
  assert.equal(afterRemoval?.removedBy, harness.users.owner, "UNEXPECTED_STORED_REMOVER");
  assert.ok(await harness.findUploadFileRecord(fileId), "UNEXPECTED_FILE_RECORD_DELETED");
  assert.deepEqual(await harness.listAttachmentStorageFiles(), storedFiles, "UNEXPECTED_STORED_FILES_CHANGED");
  assert.equal(Buffer.compare(await harness.attachmentStorage().read(fileId), DATA_FLOW), 0, "UNEXPECTED_STORED_BYTES_CHANGED");

  const listed = await json(await list(requestId, harness.identities.owner));
  assert.deepEqual([(listed.meta as Json).total, (listed.meta as Json).removed], [0, 1], "UNEXPECTED_LIST_COUNTS_AFTER_REMOVAL");
  assert.deepEqual((listed.data as Json[]).map((file) => [file.documentId, file.state]), [[attachmentId, "removed"]], "UNEXPECTED_LIST_AFTER_REMOVAL");
  assert.deepEqual(await refusalOf(await download(requestId, attachmentId, harness.identities.owner)), { status: 409, reason: "ATTACHMENT_REMOVED" }, "UNEXPECTED_DOWNLOAD_AFTER_REMOVAL");

  assert.deepEqual(removedEvents.map((entry) => entry.event.event), ["attachment.removed"], `UNEXPECTED_REMOVED_EVENTS_${removedEvents.map((entry) => entry.line).join(" | ")}`);
  assert.equal(removedEvents[0]?.level, "info", "UNEXPECTED_REMOVED_EVENT_LEVEL");
  assert.deepEqual(removedEvents[0]?.event.actor, { documentId: harness.users.owner, displayName: "Jane Doe" }, "UNEXPECTED_REMOVED_EVENT_ACTOR");
  assert.equal(removedEvents[0]?.event.attachmentId, attachmentId, "UNEXPECTED_REMOVED_EVENT_ATTACHMENT");
  assert.ok(!removedEvents[0]?.line.includes("data-flow"), "UNEXPECTED_FILE_NAME_LOGGED");

  const { result: restoredResponse, events: restoredEvents } = await captureSecurityEvents(() => setRemoval(requestId, attachmentId, harness.identities.owner, false));
  assert.equal(restoredResponse.status, 200, `UNEXPECTED_RESTORE_STATUS: ${await restoredResponse.clone().text()}`);
  const restored = (await json(restoredResponse)).data as Json;
  assert.deepEqual([restored.state, restored.removedBy, restored.removedAt], ["available", null, null], "UNEXPECTED_RESTORED_FACTS");
  assert.deepEqual(restored.actions, { download: true, remove: true, restore: false }, "UNEXPECTED_RESTORED_ACTIONS");
  assert.deepEqual(restoredEvents.map((entry) => entry.event.event), ["attachment.restored"], `UNEXPECTED_RESTORED_EVENTS_${restoredEvents.map((entry) => entry.line).join(" | ")}`);

  const [afterRestore] = await harness.listRequestAttachments(requestId);
  const eventLog = afterRestore?.eventLog as { events: Json[] };
  assert.deepEqual(eventLog.events.map((event) => [event.type, event.by]), [
    ["uploaded", harness.users.owner],
    ["removed", harness.users.owner],
    ["restored", harness.users.owner],
  ], "UNEXPECTED_EVENT_LOG");
  assert.equal(afterRestore?.fileId, fileId, "UNEXPECTED_FILE_LINK_AFTER_RESTORE");
  const own = await download(requestId, attachmentId, harness.identities.owner);
  assert.equal(own.status, 200, "UNEXPECTED_DOWNLOAD_AFTER_RESTORE");
  assert.equal(Buffer.compare(Buffer.from(await own.arrayBuffer()), DATA_FLOW), 0, "UNEXPECTED_BYTES_AFTER_RESTORE");
});

test("the other Requestor, the service agent and a file id from another request get 404 at the removal, and a malformed body is 400, each with nothing written (D-18, D-20)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, "UNEXPECTED_SEED_UPLOAD_STATUS");
  const attachmentId = String(((await json(added)).data as Json).documentId);
  const otherDraft = await seedRequest();

  for (const [label, identity, target, file] of [
    ["OTHER_REQUESTOR", harness.identities.otherRequestor, requestId, attachmentId],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent, requestId, attachmentId],
    ["FOREIGN_FILE", harness.identities.owner, otherDraft, attachmentId],
    ["UNKNOWN_FILE", harness.identities.owner, requestId, "no-such-attachment"],
    ["MISSING_REQUEST", harness.identities.owner, "no-such-request", attachmentId],
  ] as const) {
    const before = await persisted(requestId);
    const { result: response, events } = await captureSecurityEvents(() => setRemoval(target, file, identity, true));
    const text = await response.text();
    assert.equal(response.status, 404, `UNEXPECTED_STATUS_${label}: ${text.slice(0, 300)}`);
    assert.ok(!text.includes("data-flow"), `UNEXPECTED_FILE_NAME_${label}`);
    assert.equal((JSON.parse(text) as { error: Json }).error.message, "CSRM request attachments were not found.", `UNEXPECTED_MESSAGE_${label}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
    assert.deepEqual(events.filter((entry) => entry.event.event === "attachment.removed"), [], `UNEXPECTED_REMOVED_EVENT_${label}`);
  }

  for (const [label, raw] of [
    ["NO_DATA", JSON.stringify({ removed: true })],
    ["NOT_BOOLEAN", JSON.stringify({ data: { removed: "true" } })],
    ["EXTRA_KEY", JSON.stringify({ data: { removed: true, removedBy: harness.users.analyst } })],
    ["EXTRA_TOP_LEVEL_KEY", JSON.stringify({ data: { removed: true }, meta: {} })],
    ["EMPTY_DATA", JSON.stringify({ data: {} })],
  ] as const) {
    const before = await persisted(requestId);
    const response = await setRemoval(requestId, attachmentId, harness.identities.owner, { raw });
    assert.equal(response.status, 400, `UNEXPECTED_STATUS_${label}: ${await response.clone().text()}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
  }
});

/*
 * WR-501 and IN-704 (contract item 4 of the stage B amendment): a blocked file's list entry serves its detection only
 * under the one pattern the 422 serves, so a real ClamAV name (Win.Test.EICAR_HDB-1, a detection name, not the
 * antivirus test string) is served verbatim, and a stored name outside the pattern is served as null, never echoed.
 */
test("a blocked file's list entry serves a real ClamAV name, and a stored name outside the one pattern is served as null (WR-501, IN-704)", async () => {
  const harness = await harnessPromise;
  const { requestId, attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
  const detectionFor = async (identity: string) => {
    const response = await list(requestId, identity);
    const text = await response.text();
    assert.equal(response.status, 200, `UNEXPECTED_LIST_STATUS: ${text.slice(0, 300)}`);
    const entry = ((JSON.parse(text) as Json).data as Json[]).find((file) => file.documentId === attachmentId);
    assert.equal(entry?.state, "blocked", "UNEXPECTED_STATE");
    return { detection: entry?.detection, text };
  };

  const clamavName = ["Win", "Test", "EICAR_HDB-1"].join(".");
  await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { scanStatus: "blocked", scanDetection: clamavName });
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    assert.equal((await detectionFor(identity)).detection, clamavName, "THE_CLAMAV_NAME_WAS_NOT_LISTED");
  }

  for (const outside of ["Win Test <b>Signature</b>", "_Leading.Underscore", "Quoted\"Name", "Win.Test;Name"]) {
    await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { scanDetection: outside });
    const { detection, text } = await detectionFor(harness.identities.owner);
    assert.equal(detection, null, `A_DETECTION_OUTSIDE_THE_PATTERN_WAS_SERVED: ${outside}`);
    assert.ok(!text.includes(JSON.stringify(outside).slice(1, -1)), `THE_STORED_NAME_WAS_ECHOED: ${outside}`);
  }
});

/*
 * IN-704 (fail visible, as Phase 13 IN-103 and this phase's IN-101 ruling): a record whose served facts the published
 * schema forbids is refused, not dressed with invented values. Every write goes through the validated API, so such a
 * record is a tamper or corruption signal: the read answers 500 through Strapi's internal-error path, and one error
 * line names the attachment's documentId and the field, never the stored value.
 */
test("a malformed attachment record is refused with a 500 and one error line naming its documentId and the field, never the value (IN-704)", async () => {
  const harness = await harnessPromise;
  const knex = (globalThis as unknown as { strapi: { db: { connection: (table: string) => { where: (where: Json) => { update: (data: Json) => Promise<number> } } } } }).strapi.db.connection;
  const cases: Array<[field: string, column: string, value: unknown, sentinel: string | null]> = [
    ["fileName", "file_name", `NAME-SENTINEL-${"x".repeat(260)}.txt`, "NAME-SENTINEL"],
    ["fileName", "file_name", "", null],
    ["fileType", "file_type", "exe-sentinel", "exe-sentinel"],
    ["byteSize", "byte_size", 0, null],
    ["byteSize", "byte_size", 26_214_401, "26214401"],
    ["uploadedAt", "uploaded_at", null, null],
    ["uploaderPart", "uploader_part", "robot-sentinel", "robot-sentinel"],
  ];
  for (const [field, column, value, sentinel] of cases) {
    const label = `${field}_${String(value).slice(0, 20)}`;
    const { requestId, attachmentId } = await janeFile("plan.txt", PLAN_TEXT);
    const updated = await knex("csrm_request_attachments").where({ document_id: attachmentId }).update({ [column]: value });
    assert.equal(updated, 1, `UNEXPECTED_SEED_${label}`);

    const { result, errors } = await captureSecurityEvents(async () => {
      const response = await list(requestId, harness.identities.owner);
      return { status: response.status, text: await response.text() };
    });
    assert.equal(result.status, 500, `A_MALFORMED_RECORD_WAS_SERVED_${label}: ${result.text.slice(0, 300)}`);
    if (sentinel !== null) assert.ok(!result.text.includes(sentinel), `THE_VALUE_WAS_SERVED_${label}`);
    assert.equal(errors.length, 1, `UNEXPECTED_ERROR_LINES_${label}: ${errors.join(" | ")}`);
    const [line] = errors;
    assert.ok(line.includes(attachmentId), `THE_LINE_DOES_NOT_NAME_THE_ATTACHMENT_${label}: ${line}`);
    assert.ok(line.includes(field), `THE_LINE_DOES_NOT_NAME_THE_FIELD_${label}: ${line}`);
    if (sentinel !== null) assert.ok(!line.includes(sentinel), `THE_LINE_CARRIES_THE_VALUE_${label}: ${line}`);
  }
});

/* 14-08 Task 2 (D-19 to D-21, G-1; COLLAB-02 criterion 4): who removes and restores, inclusion ending, the bounds. */

type AttachmentQueryEngine = {
  update: (input: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  updateMany: (input: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
};

/** The attachment query engine, for facts no operation writes yet (14-09's AI inclusion) and for bulk fixtures. */
function attachmentRows(): AttachmentQueryEngine {
  return (globalThis as unknown as { strapi: { db: { query: (uid: string) => AttachmentQueryEngine } } }).strapi.db.query(ATTACHMENT_UID);
}

async function submittedWithFiles(uploaders: string[], requestor: "owner" | "analyst" = "owner"): Promise<{ requestId: string; files: string[] }> {
  const harness = await harnessPromise;
  let requestId: string;
  if (requestor === "owner") requestId = await seedRequest("submitted");
  else {
    requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      ...nextRequestNames(), requestStatus: "submitted",
      submittedDate: "2026-10-01T00:00:00.000Z", requestor: harness.users.analyst,
    });
  }
  const files: string[] = [];
  for (const uploader of uploaders) files.push(...await harness.seedRequestAttachments(requestId, 1, uploader));
  return { requestId, files };
}

test("after submission Jane cannot remove Bob's file, Bob removes Jane's, only Bob restores it, and a repeated restore changes nothing (D-19, D-20, D-37)", async () => {
  const harness = await harnessPromise;
  const { requestId, files: [janeFileId, bobFileId] } = await submittedWithFiles([harness.users.owner, harness.users.analyst]);

  const beforeJane = await persisted(requestId);
  const { result: janeRemoval, events: janeEvents } = await captureSecurityEvents(() => setRemoval(requestId, String(bobFileId), harness.identities.owner, true));
  assert.deepEqual(await refusalOf(janeRemoval), { status: 403, reason: "NOT_UPLOADER" }, "UNEXPECTED_JANE_REMOVES_BOBS_FILE");
  assert.deepEqual(await persisted(requestId), beforeJane, "UNEXPECTED_WRITE_JANE_REMOVES_BOBS_FILE");
  assert.deepEqual(janeEvents.map((entry) => [entry.event.event, entry.event.reason, entry.event.attachmentId]), [["attachment.refused", "NOT_UPLOADER", bobFileId]], "UNEXPECTED_JANE_REFUSAL_EVENT");

  const bobRemoval = await setRemoval(requestId, String(janeFileId), harness.identities.analyst, true);
  assert.equal(bobRemoval.status, 200, `UNEXPECTED_BOB_REMOVES_JANES_FILE: ${await bobRemoval.clone().text()}`);
  const removed = (await json(bobRemoval)).data as Json;
  assert.deepEqual([removed.state, removed.removedBy], ["removed", { documentId: harness.users.analyst, displayName: "Bob Doe" }], "UNEXPECTED_BOB_REMOVAL");
  assert.deepEqual(removed.actions, { download: false, remove: false, restore: true }, "UNEXPECTED_BOB_REMOVAL_ACTIONS");
  const janeView = ((await json(await list(requestId, harness.identities.owner))).data as Json[]).find((file) => file.documentId === janeFileId);
  assert.deepEqual(janeView?.actions, { download: false, remove: false, restore: false }, "UNEXPECTED_JANE_VIEW_OF_BOBS_REMOVAL");

  const beforeRestore = await persisted(requestId);
  assert.deepEqual(await refusalOf(await setRemoval(requestId, String(janeFileId), harness.identities.owner, false)), { status: 403, reason: "NOT_REMOVER" }, "UNEXPECTED_JANE_RESTORES");
  assert.deepEqual(await refusalOf(await setRemoval(requestId, String(janeFileId), harness.identities.secondAnalyst, false)), { status: 403, reason: "NOT_REMOVER" }, "UNEXPECTED_SECOND_ANALYST_RESTORES");
  assert.deepEqual(await persisted(requestId), beforeRestore, "UNEXPECTED_WRITE_NOT_REMOVER");

  const bobRestore = await setRemoval(requestId, String(janeFileId), harness.identities.analyst, false);
  assert.equal(bobRestore.status, 200, `UNEXPECTED_BOB_RESTORES: ${await bobRestore.clone().text()}`);
  assert.equal(((await json(bobRestore)).data as Json).state, "available", "UNEXPECTED_RESTORED_STATE");

  // PUT is idempotent: restoring a file that is not removed answers it as it is, and writes and logs nothing.
  const beforeRepeat = await persisted(requestId);
  const { result: repeat, events: repeatEvents } = await captureSecurityEvents(() => setRemoval(requestId, String(janeFileId), harness.identities.analyst, false));
  assert.equal(repeat.status, 200, "UNEXPECTED_REPEATED_RESTORE_STATUS");
  assert.equal(((await json(repeat)).data as Json).state, "available", "UNEXPECTED_REPEATED_RESTORE_STATE");
  assert.deepEqual(await persisted(requestId), beforeRepeat, "UNEXPECTED_WRITE_REPEATED_RESTORE");
  assert.deepEqual(repeatEvents, [], "UNEXPECTED_REPEATED_RESTORE_EVENTS");
  const [stored] = (await harness.listRequestAttachments(requestId)).filter((record) => record.documentId === janeFileId);
  assert.deepEqual((stored?.eventLog as { events: Json[] }).events.map((event) => [event.type, event.by]), [
    ["removed", harness.users.analyst],
    ["restored", harness.users.analyst],
  ], "UNEXPECTED_EVENT_LOG");
});

test("on a request Bob raised he removes only his own files: a second analyst's file is NOT_UPLOADER (G-1)", async () => {
  const harness = await harnessPromise;
  const { requestId, files: [bobFileId, secondFileId] } = await submittedWithFiles([harness.users.analyst, harness.users.secondAnalyst], "analyst");
  const before = await persisted(requestId);
  assert.deepEqual(await refusalOf(await setRemoval(requestId, String(secondFileId), harness.identities.analyst, true)), { status: 403, reason: "NOT_UPLOADER" }, "UNEXPECTED_REQUESTING_ANALYST_REMOVES_COLLEAGUES_FILE");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_G1");
  assert.equal((await setRemoval(requestId, String(bobFileId), harness.identities.analyst, true)).status, 200, "UNEXPECTED_REQUESTING_ANALYST_REMOVES_OWN_FILE");
  // The second analyst did not raise it, so they remove any file after submission.
  assert.equal((await setRemoval(requestId, String(secondFileId), harness.identities.secondAnalyst, true)).status, 200, "UNEXPECTED_SECOND_ANALYST_REMOVES");
});

/*
 * IN-302: the seed writes only records the upload path can produce. A seeded file takes the part authorPartFor would give
 * its uploader: the requestor's for the person who raised the request, the Security Analyst's for anyone else.
 */
test("a seeded file takes the part the upload would give its uploader: the requestor's for the person who raised the request, the Security Analyst's for anyone else (IN-302)", async () => {
  const harness = await harnessPromise;
  const jane = await submittedWithFiles([harness.users.owner, harness.users.analyst]);
  const bob = await submittedWithFiles([harness.users.analyst, harness.users.secondAnalyst], "analyst");
  const partOf = async (requestId: string, attachmentId: string) => (await harness.listRequestAttachments(requestId)).find((record) => record.documentId === attachmentId)?.uploaderPart;
  assert.deepEqual(
    [await partOf(jane.requestId, jane.files[0]!), await partOf(jane.requestId, jane.files[1]!), await partOf(bob.requestId, bob.files[0]!), await partOf(bob.requestId, bob.files[1]!)],
    ["requestor", "security-analyst", "requestor", "security-analyst"],
    "A_SEEDED_FILE_HAS_A_PART_THE_UPLOAD_NEVER_GIVES",
  );
});

test("nobody removes or restores a file on a released or closed request (ATTACHMENTS_CLOSED), with nothing written (D-16, D-20)", async () => {
  const harness = await harnessPromise;
  for (const status of ["approved", "closed"]) {
    const requestId = await seedRequest(status);
    const [kept, removedFile] = await harness.seedRequestAttachments(requestId, 2);
    await harness.updateFixtureDocument(ATTACHMENT_UID, String(removedFile), { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.owner });
    const before = await persisted(requestId);
    for (const [label, identity, file, removed] of [
      ["JANE_REMOVES", harness.identities.owner, kept, true],
      ["BOB_REMOVES", harness.identities.analyst, kept, true],
      ["JANE_RESTORES", harness.identities.owner, removedFile, false],
    ] as const) {
      assert.deepEqual(await refusalOf(await setRemoval(requestId, String(file), identity, removed)), { status: 409, reason: "ATTACHMENTS_CLOSED" }, `UNEXPECTED_${status}_${label}`);
    }
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${status}`);
    const listed = (await json(await list(requestId, harness.identities.owner))).data as Json[];
    assert.ok(listed.every((file) => (file.actions as Json).remove === false && (file.actions as Json).restore === false), `UNEXPECTED_${status}_ACTIONS`);
  }
});

test("a blocked file can be removed but never restored (ATTACHMENT_BLOCKED), and a restore that would make a 21st active file is refused (ATTACHMENT_LIMIT_REACHED) (D-10, D-21)", async () => {
  const harness = await harnessPromise;
  const { requestId, files: [blocked] } = await submittedWithFiles([harness.users.owner]);
  await harness.updateFixtureDocument(ATTACHMENT_UID, String(blocked), { scanStatus: "blocked", scanDetection: "Win.Test.Fake", file: null });
  const removal = await setRemoval(requestId, String(blocked), harness.identities.analyst, true);
  assert.equal(removal.status, 200, `UNEXPECTED_BLOCKED_REMOVAL: ${await removal.clone().text()}`);
  assert.deepEqual(((await json(removal)).data as Json).actions, { download: false, remove: false, restore: false }, "UNEXPECTED_BLOCKED_REMOVED_ACTIONS");
  const before = await persisted(requestId);
  assert.deepEqual(await refusalOf(await setRemoval(requestId, String(blocked), harness.identities.analyst, false)), { status: 409, reason: "ATTACHMENT_BLOCKED" }, "UNEXPECTED_BLOCKED_RESTORE");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_BLOCKED_RESTORE");

  const draft = await seedRequest();
  const seeded = await harness.seedRequestAttachments(draft, 21);
  await harness.updateFixtureDocument(ATTACHMENT_UID, String(seeded[0]), { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.owner });
  const beforeLimit = await persisted(draft);
  assert.deepEqual(await refusalOf(await setRemoval(draft, String(seeded[0]), harness.identities.owner, false)), { status: 409, reason: "ATTACHMENT_LIMIT_REACHED" }, "UNEXPECTED_RESTORE_AT_TWENTY");
  assert.deepEqual(await persisted(draft), beforeLimit, "UNEXPECTED_WRITE_RESTORE_AT_TWENTY");
  // Below the limit the same restore goes through.
  assert.equal((await setRemoval(draft, String(seeded[1]), harness.identities.owner, true)).status, 200, "UNEXPECTED_REMOVE_TO_NINETEEN");
  assert.equal((await setRemoval(draft, String(seeded[0]), harness.identities.owner, false)).status, 200, "UNEXPECTED_RESTORE_AT_NINETEEN");
});

/*
 * WR-101 (G-3, D-20, D-21; the pilot's ruling, which extends the finding's fix): a removal takes text away from the AI,
 * so the file's history never blocks it. The log keeps a reserve of three events below its 200-event cap, which only the
 * changes that add (a restore, an inclusion) are refused within. A removal whose events still do not fit (a log a seed or
 * a legacy record filled) or that meets a malformed log happens anyway: the log is left untouched, never repaired or
 * truncated, and one warning-level attachment.history_unavailable line records the change. A change's events are
 * written together or not at all, so an included file's removal at 199 (two events) leaves the log untouched too.
 */
const INCLUDED_TEXT = "Vendor access plan: offshore support connects through the PAM vault.";
const INCLUDED_FACTS = { available: INCLUDED_TEXT.length, kept: INCLUDED_TEXT.length, truncated: false, extractor: EXTRACTOR_VERSION, extractedAt: "2026-10-05T00:00:00.000Z" };

/** The security events as [event, level, outcome, reason]. */
function eventSummary(events: LoggedEvent[]): unknown[] {
  return events.map((entry) => [entry.event.event, entry.level, entry.event.outcome, entry.event.reason]);
}

test("an included file at 199 or 200 events, or with a malformed history, is removed by the analyst and by its uploader; a history that cannot take the removal is left untouched and one warning line records it (WR-101)", async () => {
  const harness = await harnessPromise;
  const owner = harness.users.owner;
  for (const [label, history, remover] of [
    ["AT_199_BY_BOB", attachmentEventLogOf(199, owner), "analyst"],
    ["AT_200_BY_BOB", attachmentEventLogOf(200, owner), "analyst"],
    ["AT_200_BY_JANE", attachmentEventLogOf(200, owner), "owner"],
    ["MALFORMED_BY_BOB", malformedAttachmentEventLog(owner), "analyst"],
    ["MALFORMED_BY_JANE", malformedAttachmentEventLog(owner), "owner"],
  ] as const) {
    const { requestId, files: [file] } = await submittedWithFiles([owner]);
    await harness.updateFixtureDocument(ATTACHMENT_UID, String(file), { aiTextIncluded: true, aiText: INCLUDED_TEXT, aiTextFacts: INCLUDED_FACTS, eventLog: history });

    const { result: response, events } = await captureSecurityEvents(() => setRemoval(requestId, String(file), harness.identities[remover], true));
    const text = await response.text();
    assert.equal(response.status, 200, `THE_REMOVAL_WAS_REFUSED_${label}: ${text.slice(0, 300)}`);
    assert.equal(((JSON.parse(text) as Json).data as Json).state, "removed", `UNEXPECTED_STATE_${label}`);
    const [stored] = await harness.listRequestAttachments(requestId);
    assert.ok(typeof stored?.removedAt === "string" && stored.removedAt.length > 0, `UNEXPECTED_NOT_REMOVED_${label}`);
    assert.equal(stored?.removedBy, harness.users[remover], `UNEXPECTED_REMOVER_${label}`);
    assert.deepEqual([stored?.aiTextIncluded, stored?.aiText ?? null, stored?.aiTextFacts ?? null], [false, null, null], `THE_TEXT_STAYED_IN_THE_AI_INPUTS_${label}`);
    assert.deepEqual(stored?.eventLog, history, `THE_HISTORY_WAS_CHANGED_${label}`);
    assert.deepEqual(eventSummary(events), [
      ["attachment.ai_inclusion_changed", "info", "excluded", undefined],
      ["attachment.removed", "info", "removed", undefined],
      ["attachment.history_unavailable", "warn", "removed", "HISTORY_UNAVAILABLE"],
    ], `UNEXPECTED_EVENTS_${label}_${events.map((entry) => entry.line).join(" | ")}`);
    const warning = events[2]!.event;
    assert.deepEqual([warning.requestId, warning.attachmentId, warning.fileType, (warning.actor as Json).documentId], [requestId, file, "txt", harness.users[remover]], `UNEXPECTED_WARNING_FACTS_${label}`);
    assert.match(String(warning.sha256), /^[0-9a-f]{64}$/, `UNEXPECTED_WARNING_DIGEST_${label}`);
    for (const entry of events) assert.ok(!entry.line.includes("seeded-") && !entry.line.includes("PAM vault"), `A_NAME_OR_TEXT_WAS_LOGGED_${label}`);
  }

  // A removal that fits is recorded as before: one event at 199 makes 200, and no warning is written.
  const { requestId, files: [file] } = await submittedWithFiles([owner]);
  await harness.updateFixtureDocument(ATTACHMENT_UID, String(file), { eventLog: attachmentEventLogOf(199, owner) });
  const { result: response, events } = await captureSecurityEvents(() => setRemoval(requestId, String(file), harness.identities.owner, true));
  assert.equal(response.status, 200, "UNEXPECTED_FITTING_REMOVAL_STATUS");
  const [stored] = await harness.listRequestAttachments(requestId);
  const logged = (stored?.eventLog as { events: Json[] }).events;
  assert.deepEqual([logged.length, logged.at(-1)?.type, logged.at(-1)?.by], [200, "removed", owner], "THE_FITTING_REMOVAL_WAS_NOT_RECORDED");
  assert.deepEqual(eventSummary(events), [["attachment.removed", "info", "removed", undefined]], "UNEXPECTED_FITTING_REMOVAL_EVENTS");
});

test("a restore within the reserve, or on a malformed history, is refused HISTORY_UNAVAILABLE with nothing written, and one below the reserve is taken (WR-101)", async () => {
  const harness = await harnessPromise;
  const owner = harness.users.owner;
  const requestId = await seedRequest();
  const [below, atReserve, nearCap, malformed] = (await harness.seedRequestAttachments(requestId, 4)).map(String);
  for (const [file, history] of [
    [below!, attachmentEventLogOf(196, owner)],
    [atReserve!, attachmentEventLogOf(197, owner)],
    [nearCap!, attachmentEventLogOf(199, owner)],
    [malformed!, malformedAttachmentEventLog(owner)],
  ] as const) {
    await harness.updateFixtureDocument(ATTACHMENT_UID, file, { removedAt: "2026-10-05T00:00:00.000Z", removedBy: owner, eventLog: history });
  }
  for (const [label, file] of [["AT_197", atReserve!], ["AT_199", nearCap!], ["MALFORMED", malformed!]] as const) {
    const before = await persisted(requestId);
    const { result, events } = await captureSecurityEvents(async () => refusalOf(await setRemoval(requestId, file, harness.identities.owner, false)));
    assert.deepEqual(result, { status: 409, reason: "HISTORY_UNAVAILABLE" }, `THE_RESTORE_WAS_TAKEN_${label}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
    assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.event.attachmentId]), [["attachment.refused", "HISTORY_UNAVAILABLE", file]], `UNEXPECTED_EVENTS_${label}`);
  }
  const taken = await setRemoval(requestId, below!, harness.identities.owner, false);
  assert.equal(taken.status, 200, `THE_RESTORE_BELOW_THE_RESERVE_WAS_REFUSED: ${await taken.clone().text()}`);
  const logged = ((await harness.listRequestAttachments(requestId)).find((record) => record.documentId === below)?.eventLog as { events: Json[] }).events;
  assert.deepEqual([logged.length, logged.at(-1)?.type], [197, "restored"], "THE_RESTORE_WAS_NOT_RECORDED");
});

test("removing an included file ends its AI inclusion and deletes its stored text, logged, and restoring never includes it again (D-20, D-37)", async () => {
  const harness = await harnessPromise;
  const { requestId, files: [included] } = await submittedWithFiles([harness.users.owner]);
  await attachmentRows().update({
    where: { documentId: included },
    data: { aiTextIncluded: true, aiText: "Vendor access plan: offshore support connects through the PAM vault.", aiTextFacts: { charactersAvailable: 68, charactersKept: 68, truncated: false } },
  });

  const { result: response, events } = await captureSecurityEvents(() => setRemoval(requestId, String(included), harness.identities.analyst, true));
  assert.equal(response.status, 200, `UNEXPECTED_REMOVE_STATUS: ${await response.clone().text()}`);
  const text = await response.text();
  assert.ok(!text.includes("PAM vault"), "UNEXPECTED_TEXT_SERVED");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.deepEqual([stored?.aiTextIncluded, stored?.aiText ?? null, stored?.aiTextFacts ?? null], [false, null, null], "UNEXPECTED_INCLUSION_AFTER_REMOVAL");
  assert.deepEqual((stored?.eventLog as { events: Json[] }).events.map((event) => [event.type, event.by]), [
    ["ai-excluded", harness.users.analyst],
    ["removed", harness.users.analyst],
  ], "UNEXPECTED_EVENT_LOG");
  assert.deepEqual(events.map((entry) => entry.event.event), ["attachment.ai_inclusion_changed", "attachment.removed"], `UNEXPECTED_EVENTS_${events.map((entry) => entry.line).join(" | ")}`);
  assert.deepEqual([events[0]?.event.from, events[0]?.event.to], [true, false], "UNEXPECTED_INCLUSION_CHANGE");
  assert.ok(events.every((entry) => !entry.line.includes("PAM vault")), "UNEXPECTED_TEXT_LOGGED");

  assert.equal((await setRemoval(requestId, String(included), harness.identities.analyst, false)).status, 200, "UNEXPECTED_RESTORE_STATUS");
  const [restored] = await harness.listRequestAttachments(requestId);
  assert.deepEqual([restored?.aiTextIncluded, restored?.aiText ?? null], [false, null], "UNEXPECTED_INCLUSION_AFTER_RESTORE");
});

test("the 61st stored file of a request, removed ones counted, is refused with ATTACHMENT_LIFETIME_LIMIT_REACHED while 19 are active (D-10)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const seeded = await harness.seedRequestAttachments(requestId, 60);
  await attachmentRows().updateMany({ where: { documentId: { $in: seeded.slice(0, 41) } }, data: { removedAt: "2026-10-05T00:00:00.000Z" } });
  const listed = await json(await list(requestId, harness.identities.owner));
  const add = (listed.meta as Json).add as Json;
  assert.deepEqual([add.activeCount, add.storedCount, add.canAdd, add.refusal], [19, 60, false, "ATTACHMENT_LIFETIME_LIMIT_REACHED"], "UNEXPECTED_ADD_FACTS_AT_SIXTY");
  const before = await persisted(requestId);
  assert.deepEqual(await refusalOf(await upload(requestId, harness.identities.owner, uploadForm("plan.txt", PLAN_TEXT))), { status: 409, reason: "ATTACHMENT_LIFETIME_LIMIT_REACHED" }, "UNEXPECTED_SIXTY_FIRST");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE_SIXTY_FIRST");
});

/* 14-08 Task 3 (D-04 items 7 and 11, D-18): the request read's file summary, and no delete of a request holding files. */

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";

/** The request read as one caller gets it: its status, its body's text and, when 200, its data. */
async function readRequest(requestId: string, identity: string): Promise<{ status: number; text: string; data: Json | null }> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity });
  const text = await response.text();
  return { status: response.status, text, data: response.status === 200 ? (JSON.parse(text) as { data: Json }).data : null };
}

async function attachmentSummary(requestId: string, identity: string): Promise<unknown> {
  const read = await readRequest(requestId, identity);
  assert.equal(read.status, 200, `UNEXPECTED_REQUEST_READ_STATUS_${identity}: ${read.text.slice(0, 300)}`);
  return read.data?.attachments;
}

test("the request read carries each reader's file summary, and another Requestor's or the service agent's read stays refused with nothing of the files (D-04 item 7, D-18)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await upload(requestId, harness.identities.owner, uploadForm("data-flow.docx", DATA_FLOW));
  assert.equal(added.status, 201, "UNEXPECTED_SEED_UPLOAD_STATUS");
  const attachmentId = String(((await json(added)).data as Json).documentId);

  const intake = { count: 1, canAdd: true, refusal: null, window: "intake", needsNote: false, remaining: 19, activeCount: 1, storedCount: 1, limits: LIMITS, allowedTypes: ALLOWED_TYPES };
  const before = await persisted(requestId);
  assert.deepEqual(await attachmentSummary(requestId, harness.identities.owner), intake, "UNEXPECTED_JANE_DRAFT_SUMMARY");
  // Reading the request writes nothing.
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_REQUEST_READ_WROTE");

  await harness.updateFixtureDocument(REQUEST_UID, requestId, { requestStatus: "submitted", submittedDate: "2026-10-01T00:00:00.000Z" });
  const submitted = { ...intake, window: "after-submission", needsNote: true };
  assert.deepEqual(await attachmentSummary(requestId, harness.identities.owner), submitted, "UNEXPECTED_JANE_SUBMITTED_SUMMARY");
  assert.deepEqual(await attachmentSummary(requestId, harness.identities.analyst), submitted, "UNEXPECTED_BOB_SUBMITTED_SUMMARY");

  // The count is the main list: a removed file leaves it, and stays in the stored count.
  assert.equal((await setRemoval(requestId, attachmentId, harness.identities.owner, true)).status, 200, "UNEXPECTED_REMOVE_STATUS");
  assert.deepEqual(await attachmentSummary(requestId, harness.identities.owner), { ...submitted, count: 0, remaining: 20, activeCount: 0 }, "UNEXPECTED_SUMMARY_AFTER_REMOVAL");

  // Both reads stay as they were: the request read refuses another person's request with 403 (the matrix's
  // OWNER_REQUEST_AGENT_DENIED_403), and the refusal carries nothing of the files.
  for (const [label, identity, status] of [
    ["OTHER_REQUESTOR", harness.identities.otherRequestor, 403],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent, 403],
  ] as const) {
    const read = await readRequest(requestId, identity);
    assert.equal(read.status, status, `UNEXPECTED_${label}_READ_STATUS`);
    assert.ok(!read.text.includes("\"attachments\"") && !read.text.includes("data-flow") && !read.text.includes(attachmentId), `UNEXPECTED_${label}_SAW_THE_FILES`);
  }

  const released = await seedRequest("approved");
  assert.deepEqual(await attachmentSummary(released, harness.identities.analyst), {
    count: 0, canAdd: false, refusal: "ATTACHMENTS_CLOSED", window: "closed", needsNote: false, remaining: 20, activeCount: 0, storedCount: 0, limits: LIMITS, allowedTypes: ALLOWED_TYPES,
  }, "UNEXPECTED_RELEASED_SUMMARY");
  // A request from before Phase 14 reads as holding no files.
  const legacy = await seedRequest("submitted");
  assert.equal(((await attachmentSummary(legacy, harness.identities.owner)) as Json).count, 0, "UNEXPECTED_LEGACY_COUNT");
});

test("a request holding a file, a removed one included, cannot be deleted (REQUEST_HAS_ATTACHMENTS) and nothing is deleted (D-04 item 11)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const [file] = await harness.seedRequestAttachments(requestId, 1);
  await harness.updateFixtureDocument(ATTACHMENT_UID, String(file), { removedAt: "2026-10-05T00:00:00.000Z", removedBy: harness.users.owner });
  const before = await harness.snapshot([() => harness.getRequest(requestId), () => persisted(requestId)]);

  const refused = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity: harness.identities.analyst, init: { method: "DELETE" } });
  assert.equal(refused.status, 409, `UNEXPECTED_DELETE_STATUS: ${await refused.clone().text()}`);
  assert.deepEqual(((await json(refused)).error as Json).details, { reason: "REQUEST_HAS_ATTACHMENTS" }, "UNEXPECTED_DELETE_REASON");
  assert.deepEqual(await harness.snapshot([() => harness.getRequest(requestId), () => persisted(requestId)]), before, "UNEXPECTED_DELETE_WROTE");

  // A request with no file, note or other record still deletes.
  const empty = await seedRequest();
  const deleted = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(empty)}`, identity: harness.identities.analyst, init: { method: "DELETE" } });
  assert.ok(deleted.status >= 200 && deleted.status < 300, `UNEXPECTED_EMPTY_DELETE_STATUS_${deleted.status}`);
  assert.equal(await harness.getRequest(empty), null, "UNEXPECTED_EMPTY_REQUEST_KEPT");
});

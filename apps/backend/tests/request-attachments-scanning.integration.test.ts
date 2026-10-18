import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";

import { buildPasswordPdf, buildPdf } from "./helpers/attachment-fixtures";
import { attachmentHttp, attachmentsPath, captureSecurityEvents } from "./helpers/attachment-http";
import { FAKE_CLAMD_VERSION, startFakeClamd } from "./helpers/fake-clamd-server";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 14 (D-12, D-13, D-37, G-7): the upload's malware check through the ClamAV adapter, mounted against a fake
 * clamd on 127.0.0.1 (no real engine is contacted). A clean verdict makes the file available; an infected one refuses
 * it with 422 and its detection; a scan that cannot run (the engine down, or over its limits) stores the file in
 * quarantine, pending, never available until a scan passes. A separate harness from request-attachments: one Strapi
 * per process, booted with the ClamAV scanner.
 */

const clamdPromise = startFakeClamd({ mode: "down" });
const harnessPromise = clamdPromise.then((clamd) => startAuthorizationHttpHarness({
  attachmentScanner: { kind: "clamav", host: clamd.host, port: clamd.port, timeoutMs: 5_000 },
}));
after(async () => {
  const clamd = await clamdPromise;
  try {
    await (await harnessPromise).close();
  } finally {
    // Even when the boot failed, so the open listener never keeps the test process alive.
    await clamd.close();
  }
});

type Json = Record<string, unknown>;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

/** The attachment service as the running Strapi loaded it, from the compiled application (the harness's pattern). */
function compiledRescans(): { stopAttachmentRescans: (strapi: unknown) => Promise<void>; scheduledAttachmentRescans: (strapi: unknown) => readonly string[] | null } {
  return require(path.join(strapiDir, "dist", "src", "api", "csrm-request-attachment", "services", "request-attachments.js")) as ReturnType<typeof compiledRescans>;
}

function runningStrapi(): unknown {
  return (globalThis as unknown as { strapi: unknown }).strapi;
}

/**
 * IN-304: a test that leaves a pending file stops this Strapi's re-scans when it ends, so no real one-minute re-scan of
 * its file runs under a later test's mode or inside a later test's log windows. No test here needs a re-scan; the
 * quarantine suite proves them.
 */
async function stopRescans(): Promise<void> {
  await harnessPromise;
  await compiledRescans().stopAttachmentRescans(runningStrapi());
}

// A draft of Jane's unless a status is named; these seeds name no submittedDate.
const { seedRequest: seedDraft, persisted } = attachmentHttp(harnessPromise, {
  requestNumberPrefix: "SCAN", titlePrefix: "Scanning request", defaultStatus: "draft", submittedDate: false,
});

const PLAN_TEXT = Buffer.from("Vendor access plan: offshore support connects through the PAM vault.", "utf8");

function uploadForm(fileName: string, bytes: Uint8Array): FormData {
  const form = new FormData();
  form.set("file", new File([bytes], fileName));
  return form;
}

async function upload(requestId: string, form: FormData): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: attachmentsPath(requestId), identity: harness.identities.owner, init: { method: "POST", body: form } });
}

test("with the scanner down, Jane's file is stored pending in quarantine, not downloadable, and both events say why (D-13, G-7)", async (t) => {
  t.after(stopRescans);
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("down");
  const requestId = await seedDraft();

  const { result: response, events } = await captureSecurityEvents(() => upload(requestId, uploadForm("plan.txt", PLAN_TEXT)));
  assert.equal(response.status, 201, `UNEXPECTED_STATUS: ${await response.clone().text()}`);
  const attachment = (await response.json() as Json).data as Json;
  assert.equal(attachment.state, "pending", "UNEXPECTED_STATE");
  assert.deepEqual(attachment.actions, { download: false, remove: true, restore: false }, "UNEXPECTED_ACTIONS");

  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "pending", "UNEXPECTED_SCAN_STATUS");
  assert.equal(stored?.scanAttempts, 1, "UNEXPECTED_SCAN_ATTEMPTS");
  assert.equal(stored?.scanCheckedAt ?? null, null, "UNEXPECTED_SCAN_CHECKED_AT");
  assert.equal(typeof stored?.fileId, "number", "UNEXPECTED_NO_QUARANTINED_FILE");
  assert.deepEqual((stored?.eventLog as { events: Json[] }).events.map((event) => [event.type, event.verdict]), [["uploaded", "not-scanned"], ["quarantined", "not-scanned"]], "UNEXPECTED_EVENT_LOG");

  assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.outcome, entry.level]), [
    ["attachment.uploaded", "pending", "info"],
    ["attachment.quarantined", "unavailable", "info"],
  ], "UNEXPECTED_SECURITY_EVENTS");
  for (const entry of events) assert.ok(!entry.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");

  const listed = await harness.request({ path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/attachments`, identity: harness.identities.owner });
  const body = await listed.json() as Json;
  assert.deepEqual((body.data as Json[]).map((file) => [file.state, (file.actions as Json).download]), [["pending", false]], "UNEXPECTED_LISTED_PENDING");
  assert.equal(((body.meta as Json).add as Json).activeCount, 1, "UNEXPECTED_PENDING_NOT_ACTIVE");
});

test("an infected verdict is refused with 422 and the engine's detection, a warning-level event, and nothing stored (D-13, D-37)", async () => {
  const clamd = await clamdPromise;
  await clamd.setMode("found:Win.Test.Fake");
  const requestId = await seedDraft();
  const before = await persisted(requestId);

  const { result: response, events } = await captureSecurityEvents(() => upload(requestId, uploadForm("plan.txt", PLAN_TEXT)));
  const body = await response.json() as Json;
  assert.equal(response.status, 422, `UNEXPECTED_STATUS: ${JSON.stringify(body)}`);
  assert.deepEqual((body.error as Json).details, { reason: "ATTACHMENT_MALWARE_FOUND", detection: "Win.Test.Fake" }, "UNEXPECTED_DETAILS");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE");
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.event.detection, entry.level]), [
    ["attachment.refused", "ATTACHMENT_MALWARE_FOUND", "Win.Test.Fake", "warn"],
  ], "UNEXPECTED_SECURITY_EVENTS");
});

/*
 * WR-501 (contract item 4 of the stage B amendment): real ClamAV names carry underscores. The official database reports
 * its antivirus test file as Win.Test.EICAR_HDB-1 (a detection name, not the test string, which no fixture holds). The
 * 422 serves it verbatim beside the reason, and the warning-level refusal line carries it.
 */
test("a real ClamAV name with an underscore reaches the 422 and the refusal line verbatim (WR-501)", async () => {
  const clamd = await clamdPromise;
  const detection = ["Win", "Test", "EICAR_HDB-1"].join(".");
  await clamd.setMode(`found:${detection}`);
  const requestId = await seedDraft();
  const before = await persisted(requestId);

  const { result: response, events } = await captureSecurityEvents(() => upload(requestId, uploadForm("plan.txt", PLAN_TEXT)));
  const body = await response.json() as Json;
  assert.equal(response.status, 422, `UNEXPECTED_STATUS: ${JSON.stringify(body)}`);
  assert.deepEqual((body.error as Json).details, { reason: "ATTACHMENT_MALWARE_FOUND", detection }, "THE_CLAMAV_NAME_WAS_NOT_SERVED");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_WRITE");
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.event.detection, entry.level]), [
    ["attachment.refused", "ATTACHMENT_MALWARE_FOUND", detection, "warn"],
  ], "THE_CLAMAV_NAME_WAS_NOT_LOGGED");
});

test("a scan over the engine's limits is not clean: the file waits in quarantine (D-13)", async (t) => {
  t.after(stopRescans);
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("limits");
  const requestId = await seedDraft();

  const { result: response, events } = await captureSecurityEvents(() => upload(requestId, uploadForm("plan.txt", PLAN_TEXT)));
  assert.equal(response.status, 201, `UNEXPECTED_STATUS: ${await response.clone().text()}`);
  assert.equal(((await response.json() as Json).data as Json).state, "pending", "UNEXPECTED_STATE");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.deepEqual([stored?.scanStatus, stored?.scanAttempts], ["pending", 1], "UNEXPECTED_STORED_SCAN");
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.outcome]), [
    ["attachment.uploaded", "pending"],
    ["attachment.quarantined", "limits"],
  ], "UNEXPECTED_SECURITY_EVENTS");
});

test("a clean verdict makes the file available at once and records the engine (D-13)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("clean");
  const requestId = await seedDraft();

  const response = await upload(requestId, uploadForm("plan.txt", PLAN_TEXT));
  assert.equal(response.status, 201, `UNEXPECTED_STATUS: ${await response.clone().text()}`);
  assert.equal(((await response.json() as Json).data as Json).state, "available", "UNEXPECTED_STATE");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "clean", "UNEXPECTED_SCAN_STATUS");
  assert.equal(stored?.scanEngine, FAKE_CLAMD_VERSION, "UNEXPECTED_SCAN_ENGINE");
  assert.equal(stored?.scanAttempts, 0, "UNEXPECTED_SCAN_ATTEMPTS");
  assert.equal(Number.isFinite(Date.parse(String(stored?.scanCheckedAt))), true, "UNEXPECTED_SCAN_CHECKED_AT");
});

/*
 * WR-203 (the pilot's ruling): the malware scan runs before the PDF open check. An infected PDF is refused as malware
 * with nothing parsed, even one pdf.js could not open (before the fix it was refused as a content mismatch, after a parse
 * of unscanned bytes). With the scanner down the open check still runs before the file is stored pending: a
 * password-protected PDF is refused ATTACHMENT_ENCRYPTED with nothing stored, and a readable one waits in quarantine.
 */
test("the scan comes before the PDF open check: an infected PDF is malware unparsed, and with the scanner down the open check still refuses before storing (WR-203)", async (t) => {
  t.after(stopRescans);
  const harness = await harnessPromise;
  const clamd = await clamdPromise;

  await clamd.setMode("found:Win.Test.Fake");
  const infectedRequest = await seedDraft();
  const infectedBefore = await persisted(infectedRequest);
  const unopenable = Buffer.from("%PDF-1.7\nThis is not a PDF body.\n", "latin1");
  const { result: infected, events } = await captureSecurityEvents(() => upload(infectedRequest, uploadForm("pack.pdf", unopenable)));
  const infectedBody = await infected.json() as Json;
  assert.equal(infected.status, 422, `THE_INFECTED_PDF_WAS_NOT_REFUSED_AS_MALWARE: ${JSON.stringify(infectedBody)}`);
  assert.deepEqual((infectedBody.error as Json).details, { reason: "ATTACHMENT_MALWARE_FOUND", detection: "Win.Test.Fake" }, "UNEXPECTED_INFECTED_DETAILS");
  assert.deepEqual(await persisted(infectedRequest), infectedBefore, "UNEXPECTED_INFECTED_WRITE");
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.event.reason, entry.level]), [["attachment.refused", "ATTACHMENT_MALWARE_FOUND", "warn"]], "UNEXPECTED_INFECTED_EVENTS");

  await clamd.setMode("down");
  const lockedRequest = await seedDraft();
  const lockedBefore = await persisted(lockedRequest);
  const locked = await upload(lockedRequest, uploadForm("secret.pdf", buildPasswordPdf()));
  assert.deepEqual([locked.status, ((await locked.json() as Json).error as Json).details], [415, { reason: "ATTACHMENT_ENCRYPTED" }], "THE_ENCRYPTED_PDF_WAS_NOT_REFUSED_WHILE_THE_SCANNER_WAS_DOWN");
  assert.deepEqual(await persisted(lockedRequest), lockedBefore, "AN_ENCRYPTED_PDF_WAS_STORED_WHILE_THE_SCANNER_WAS_DOWN");

  const readableRequest = await seedDraft();
  const readable = await upload(readableRequest, uploadForm("pack.pdf", buildPdf(["Vendor security pack, page one."])));
  assert.equal(readable.status, 201, `UNEXPECTED_PENDING_PDF_STATUS: ${await readable.clone().text()}`);
  assert.equal(((await readable.json() as Json).data as Json).state, "pending", "THE_READABLE_PDF_WAS_NOT_QUARANTINED");
  const [stored] = await harness.listRequestAttachments(readableRequest);
  assert.deepEqual([stored?.fileType, stored?.scanStatus], ["pdf", "pending"], "UNEXPECTED_PENDING_PDF_RECORD");
});

/*
 * IN-210: the engine name's cache, and the fallback's, live in the adapter, so the upload's scanner is kept for the
 * running Strapi rather than made afresh for each upload. Two clean uploads in a row ask clamd for its name at most once.
 */
test("the uploads share one scanner, so the engine's name is asked for at most once in its cache window (IN-210)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("clean");
  const requestId = await seedDraft();
  const before = clamd.versionRequests();
  for (const fileName of ["first.txt", "second.txt"]) {
    const response = await upload(requestId, uploadForm(fileName, PLAN_TEXT));
    assert.equal(response.status, 201, `UNEXPECTED_STATUS_${fileName}: ${await response.clone().text()}`);
  }
  assert.ok(clamd.versionRequests() - before <= 1, `EACH_UPLOAD_ASKED_FOR_THE_ENGINE_NAME: ${clamd.versionRequests() - before}`);
  const stored = await harness.listRequestAttachments(requestId);
  assert.deepEqual(stored.map((record) => record.scanEngine), [FAKE_CLAMD_VERSION, FAKE_CLAMD_VERSION], "UNEXPECTED_SCAN_ENGINES");
});

test("no re-scan is left scheduled once the tests that leave a pending file have ended (IN-304)", async () => {
  await harnessPromise;
  assert.equal(compiledRescans().scheduledAttachmentRescans(runningStrapi()), null, "A_REAL_RESCAN_TIMER_OUTLIVED_ITS_TEST");
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test, { after } from "node:test";

import { attachmentEventLogOf, attachmentHttp, attachmentsPath, captureLogs, malformedAttachmentEventLog, withAttachmentCountIntercepted } from "./helpers/attachment-http";
import { FAKE_CLAMD_VERSION, startFakeClamd } from "./helpers/fake-clamd-server";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 14 (D-13, D-21, D-23, D-37; 14-RESEARCH Settled 5, Pitfall 11): quarantined files, mounted against a fake clamd
 * on 127.0.0.1 (no real engine is contacted). A file the scanner could not check waits, pending and not downloadable;
 * a later re-scan releases it when clean, or blocks it when infected, deleting its bytes and plugin file record while
 * the attachment keeps its name, size, digest and detection. Every Strapi start re-scans every pending file, and
 * destroy() stops the re-scans, so no timer outlives Strapi. One Strapi per process, booted with the ClamAV scanner.
 */

const clamdPromise = startFakeClamd({ mode: "down" });
const harnessPromise = clamdPromise.then((clamd) => startAuthorizationHttpHarness({
  attachmentScanner: { kind: "clamav", host: clamd.host, port: clamd.port, timeoutMs: 5_000 },
}));
let harnessClosed = false;
after(async () => {
  const clamd = await clamdPromise;
  try {
    if (!harnessClosed) await (await harnessPromise).close();
  } finally {
    await clamd.close();
  }
});

type Json = Record<string, unknown>;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

type RescanOutcome = "released" | "blocked" | "still-pending" | "gone";

/** The attachment service as the running Strapi loaded it, from the compiled application (the harness's pattern). */
type CompiledAttachmentService = {
  rescanPendingAttachment: (input: { strapi: unknown; attachmentId: string }) => Promise<RescanOutcome>;
  startAttachmentRescans: (strapi: unknown) => Promise<void>;
  stopAttachmentRescans: (strapi: unknown) => Promise<void>;
  scheduledAttachmentRescans: (strapi: unknown) => readonly string[] | null;
};

function compiledService(): CompiledAttachmentService {
  return require(path.join(strapiDir, "dist", "src", "api", "csrm-request-attachment", "services", "request-attachments.js")) as CompiledAttachmentService;
}

function runningStrapi(): unknown {
  return (globalThis as unknown as { strapi: unknown }).strapi;
}

/*
 * IN-304: the re-scans a test causes run on timers this file injects, recorded and never fired, so no real one-minute
 * re-scan of an earlier test's pending file runs under a later test's fake mode or inside its log windows. The
 * scheduler factory is wrapped on the compiled module object, which the service calls it through (the harness's
 * withHeldRequestLock pattern), so nothing in the application changes. bootstrap() made its scheduler before the wrap:
 * the first test proves that one, then replaces it with one on the recorded timers.
 */
const recordedRescanDelays: number[] = [];
const RECORDED_RESCAN_TIMERS = {
  setTimeout: (_callback: () => void, ms: number) => {
    recordedRescanDelays.push(ms);
    return { unref: () => undefined };
  },
  clearTimeout: () => undefined,
};

type CompiledRescanSchedulerModule = { createRescanScheduler: (options: Record<string, unknown>) => unknown };
let rescanTimersInjected = false;

function injectRecordedRescanTimers(): void {
  if (rescanTimersInjected) return;
  rescanTimersInjected = true;
  const schedulerModule = require(path.join(strapiDir, "dist", "src", "csrm", "files", "rescan-scheduler.js")) as CompiledRescanSchedulerModule;
  const original = schedulerModule.createRescanScheduler;
  schedulerModule.createRescanScheduler = (options) => original({ ...options, timers: RECORDED_RESCAN_TIMERS });
}

// A draft of Jane's unless a status is named; these seeds name no submittedDate.
const { seedRequest: seedDraft } = attachmentHttp(harnessPromise, {
  requestNumberPrefix: "QUARANTINE", titlePrefix: "Quarantine request", defaultStatus: "draft", submittedDate: false,
});

const PLAN_TEXT = Buffer.from("Vendor access plan: offshore support connects through the PAM vault.", "utf8");

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";

/** Jane uploads a file to a new draft of hers while the scanner is down, so it is stored pending. */
async function pendingUpload(fileName: string, bytes: Buffer): Promise<{ requestId: string; attachmentId: string; fileId: number }> {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("down");
  const requestId = await seedDraft();
  const form = new FormData();
  form.set("file", new File([bytes], fileName));
  const response = await harness.request({ path: attachmentsPath(requestId), identity: harness.identities.owner, init: { method: "POST", body: form } });
  assert.equal(response.status, 201, `UNEXPECTED_UPLOAD_STATUS: ${await response.clone().text()}`);
  const attachment = (await response.json() as Json).data as Json;
  assert.equal(attachment.state, "pending", "UNEXPECTED_UPLOAD_NOT_PENDING");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(typeof stored?.fileId, "number", "UNEXPECTED_NO_QUARANTINED_FILE");
  return { requestId, attachmentId: String(attachment.documentId), fileId: stored?.fileId as number };
}

async function download(requestId: string, attachmentId: string): Promise<{ status: number; reason: unknown; bytes: Buffer }> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId)}/content`, identity: harness.identities.analyst });
  const bytes = Buffer.from(await response.arrayBuffer());
  const reason = response.status === 200 ? undefined : (JSON.parse(bytes.toString("utf8")) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason;
  return { status: response.status, reason, bytes };
}

async function listed(requestId: string, attachmentId: string): Promise<Json | undefined> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: attachmentsPath(requestId), identity: harness.identities.owner });
  return ((await response.json() as Json).data as Json[]).find((file) => file.documentId === attachmentId);
}

test("bootstrap() starts the re-scans for this Strapi, and an upload stored pending is scheduled for one (D-13, D-21)", async (t) => {
  await harnessPromise;
  const service = compiledService();
  // IN-304: bootstrap's scheduler runs on real timers, so this test replaces it when it ends; the restart's start
  // re-scans this test's pending file once, here, under the fake's current mode.
  t.after(async () => {
    injectRecordedRescanTimers();
    await service.stopAttachmentRescans(runningStrapi());
    await service.startAttachmentRescans(runningStrapi());
  });
  assert.deepEqual(service.scheduledAttachmentRescans(runningStrapi()), [], "UNEXPECTED_NO_SCHEDULER_AFTER_BOOT");
  const { attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  assert.ok(service.scheduledAttachmentRescans(runningStrapi())?.includes(attachmentId), "UNEXPECTED_PENDING_UPLOAD_NOT_SCHEDULED");
});

test("after the first test, a pending upload is scheduled on the recorded timers, which never fire, so no real re-scan reaches a later test (IN-304)", async () => {
  await harnessPromise;
  const before = recordedRescanDelays.length;
  const { attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  assert.ok(compiledService().scheduledAttachmentRescans(runningStrapi())?.includes(attachmentId), "THE_PENDING_UPLOAD_WAS_NOT_SCHEDULED");
  assert.deepEqual(recordedRescanDelays.slice(before), [60_000], "THE_PENDING_UPLOAD_WAS_NOT_SCHEDULED_ON_A_RECORDED_TIMER");
});

test("a quarantined file is refused at the download, and a clean re-scan releases it with a scan-verdict event (D-13, D-23, D-37)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  const { requestId, attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  assert.deepEqual(await download(requestId, attachmentId).then(({ status, reason }) => ({ status, reason })), { status: 409, reason: "ATTACHMENT_QUARANTINED" }, "UNEXPECTED_QUARANTINED_DOWNLOAD");

  await clamd.setMode("clean");
  const { result: outcome, lines } = await captureLogs(() => compiledService().rescanPendingAttachment({ strapi: runningStrapi(), attachmentId }));
  assert.equal(outcome, "released", "UNEXPECTED_RESCAN_OUTCOME");

  const entry = await listed(requestId, attachmentId);
  assert.deepEqual([entry?.state, (entry?.actions as Json | undefined)?.download], ["available", true], "UNEXPECTED_RELEASED_LISTING");
  const released = await download(requestId, attachmentId);
  assert.equal(released.status, 200, "UNEXPECTED_RELEASED_DOWNLOAD_STATUS");
  assert.equal(Buffer.compare(released.bytes, PLAN_TEXT), 0, "UNEXPECTED_RELEASED_BYTES");

  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "clean", "UNEXPECTED_RELEASED_SCAN_STATUS");
  assert.equal(stored?.scanEngine, FAKE_CLAMD_VERSION, "UNEXPECTED_RELEASED_ENGINE");
  assert.ok(Number.isFinite(Date.parse(String(stored?.scanCheckedAt))), "UNEXPECTED_RELEASED_CHECKED_AT");
  const events = (stored?.eventLog as { events: Json[] }).events;
  assert.deepEqual(events.map((event) => [event.type, event.verdict, event.by]), [
    ["uploaded", "not-scanned", harness.users.owner],
    ["quarantined", "not-scanned", harness.users.owner],
    ["scan-verdict", "clean", null],
  ], "UNEXPECTED_RELEASED_EVENT_LOG");

  const security = lines.filter((line) => line.event);
  assert.deepEqual(security.map((line) => [line.event?.event, line.level, line.event?.outcome, line.event?.attachmentId]), [
    ["attachment.scan_verdict", "info", "clean", attachmentId],
  ], "UNEXPECTED_RELEASE_SECURITY_EVENTS");
  assert.deepEqual(security[0]?.event?.actor, { system: "rescan" }, "UNEXPECTED_RELEASE_ACTOR");
  assert.ok(!security[0]?.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");
});

test("an infected re-scan blocks the file, deletes its bytes and plugin file record, and keeps its facts (D-21, D-37)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  const notes = Buffer.from("Release notes for the vendor agent, version 4.2.", "utf8");
  const { requestId, attachmentId, fileId } = await pendingUpload("release-notes.txt", notes);
  const record = await harness.findUploadFileRecord(fileId);
  assert.ok(record, "UNEXPECTED_NO_PLUGIN_FILE_RECORD");
  const storedName = `${String(record.hash)}${String(record.ext)}`;
  assert.ok((await harness.listAttachmentStorageFiles()).includes(storedName), "UNEXPECTED_NO_STORED_BYTES");

  await clamd.setMode("found:Win.Test.Fake");
  const { result: outcome, lines } = await captureLogs(() => compiledService().rescanPendingAttachment({ strapi: runningStrapi(), attachmentId }));
  assert.equal(outcome, "blocked", "UNEXPECTED_RESCAN_OUTCOME");

  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "blocked", "UNEXPECTED_BLOCKED_SCAN_STATUS");
  assert.equal(stored?.scanDetection, "Win.Test.Fake", "UNEXPECTED_BLOCKED_DETECTION");
  assert.equal(stored?.fileId, null, "UNEXPECTED_BLOCKED_FILE_LINK");
  assert.deepEqual([stored?.fileName, stored?.byteSize, stored?.sha256, stored?.uploadedBy], [
    "release-notes.txt", notes.length, createHash("sha256").update(notes).digest("hex"), harness.users.owner,
  ], "UNEXPECTED_BLOCKED_FACTS_LOST");
  const last = (stored?.eventLog as { events: Json[] }).events.at(-1);
  assert.deepEqual([last?.type, last?.verdict, last?.detection, last?.by], ["blocked", "infected", "Win.Test.Fake", null], "UNEXPECTED_BLOCKED_EVENT");
  assert.equal(await harness.findUploadFileRecord(fileId), null, "UNEXPECTED_PLUGIN_FILE_RECORD_KEPT");
  assert.ok(!(await harness.listAttachmentStorageFiles()).includes(storedName), "UNEXPECTED_STORED_BYTES_KEPT");

  const entry = await listed(requestId, attachmentId);
  assert.deepEqual([entry?.state, entry?.detection, (entry?.actions as Json | undefined)?.download], ["blocked", "Win.Test.Fake", false], "UNEXPECTED_BLOCKED_LISTING");
  assert.deepEqual(await download(requestId, attachmentId).then(({ status, reason }) => ({ status, reason })), { status: 409, reason: "ATTACHMENT_BLOCKED" }, "UNEXPECTED_BLOCKED_DOWNLOAD");

  const security = lines.filter((line) => line.event);
  assert.deepEqual(security.map((line) => [line.event?.event, line.level, line.event?.detection, line.event?.outcome]), [
    ["attachment.blocked", "warn", "Win.Test.Fake", "blocked"],
  ], "UNEXPECTED_BLOCK_SECURITY_EVENTS");
  assert.deepEqual(security[0]?.event?.actor, { system: "rescan" }, "UNEXPECTED_BLOCK_ACTOR");
  assert.ok(!security[0]?.line.includes("release-notes"), "UNEXPECTED_FILE_NAME_LOGGED");
});

test("a re-scan over the engine's limits keeps the file pending, counts the attempt and logs the deployment requirement as an error (D-13)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  const { requestId, attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  await clamd.setMode("limits");
  const { result: outcome, lines } = await captureLogs(() => compiledService().rescanPendingAttachment({ strapi: runningStrapi(), attachmentId }));
  assert.equal(outcome, "still-pending", "UNEXPECTED_RESCAN_OUTCOME");
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.deepEqual([stored?.scanStatus, stored?.scanAttempts], ["pending", 2], "UNEXPECTED_LIMITS_STORED");
  const errors = lines.filter((line) => line.level === "error");
  assert.equal(errors.length, 1, `UNEXPECTED_LIMITS_ERRORS_${lines.map((line) => line.line).join(" | ")}`);
  assert.match(errors[0]?.line ?? "", /StreamMaxLength/, "UNEXPECTED_LIMITS_ERROR_WITHOUT_REQUIREMENT");
  assert.ok(errors[0]?.line.includes(attachmentId), "UNEXPECTED_LIMITS_ERROR_WITHOUT_ID");
  assert.ok(!errors[0]?.line.includes("plan.txt"), "UNEXPECTED_FILE_NAME_LOGGED");
  assert.deepEqual(await download(requestId, attachmentId).then(({ status, reason }) => ({ status, reason })), { status: 409, reason: "ATTACHMENT_QUARANTINED" }, "UNEXPECTED_LIMITS_DOWNLOAD");
});

test("every start re-scans every pending file once: a file left pending is released when the scanner is back (D-13)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  const service = compiledService();
  const { requestId, attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  await service.stopAttachmentRescans(runningStrapi());
  assert.equal(service.scheduledAttachmentRescans(runningStrapi()), null, "UNEXPECTED_SCHEDULER_AFTER_STOP");

  await clamd.setMode("clean");
  await service.startAttachmentRescans(runningStrapi());
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "clean", "UNEXPECTED_START_DID_NOT_RESCAN");
  assert.equal((await listed(requestId, attachmentId))?.state, "available", "UNEXPECTED_START_LISTING");
  assert.deepEqual(service.scheduledAttachmentRescans(runningStrapi()), [], "UNEXPECTED_SCHEDULE_AFTER_START");
});

/*
 * WR-101 (D-21, G-3; the pilot's ruling, which extends the finding's fix): a system verdict always lands. A pending
 * file whose history is at the cap (only a seed or a legacy record reaches it) or malformed is still released when the
 * re-scan is clean, and still blocked, its bytes and plugin file record deleted, when it is infected. The log is left
 * untouched, never repaired or truncated, and one warning-level attachment.history_unavailable line records the verdict.
 */
test("a pending file whose history is at the cap or malformed still gets its verdict, the history untouched and one warning line recording it (WR-101)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  const owner = harness.users.owner;
  for (const [label, mode, history, outcome] of [
    ["CLEAN_AT_CAP", "clean", attachmentEventLogOf(200, owner), "released"],
    ["INFECTED_AT_CAP", "found:Win.Test.Fake", attachmentEventLogOf(200, owner), "blocked"],
    ["CLEAN_MALFORMED", "clean", malformedAttachmentEventLog(owner), "released"],
    ["INFECTED_MALFORMED", "found:Win.Test.Fake", malformedAttachmentEventLog(owner), "blocked"],
  ] as const) {
    const { requestId, attachmentId, fileId } = await pendingUpload("plan.txt", PLAN_TEXT);
    const record = await harness.findUploadFileRecord(fileId);
    assert.ok(record, `UNEXPECTED_NO_PLUGIN_FILE_RECORD_${label}`);
    const storedName = `${String(record.hash)}${String(record.ext)}`;
    await harness.updateFixtureDocument(ATTACHMENT_UID, attachmentId, { eventLog: history });

    await clamd.setMode(mode);
    const { result, lines } = await captureLogs(() => compiledService().rescanPendingAttachment({ strapi: runningStrapi(), attachmentId }));
    assert.equal(result, outcome, `THE_VERDICT_DID_NOT_LAND_${label}`);
    const [stored] = await harness.listRequestAttachments(requestId);
    assert.equal(stored?.scanStatus, outcome === "released" ? "clean" : "blocked", `UNEXPECTED_SCAN_STATUS_${label}`);
    assert.deepEqual(stored?.eventLog, history, `THE_HISTORY_WAS_CHANGED_${label}`);
    if (outcome === "blocked") {
      assert.equal(stored?.fileId, null, `UNEXPECTED_BLOCKED_FILE_LINK_${label}`);
      assert.equal(await harness.findUploadFileRecord(fileId), null, `THE_BLOCKED_FILE_RECORD_WAS_KEPT_${label}`);
      assert.ok(!(await harness.listAttachmentStorageFiles()).includes(storedName), `THE_BLOCKED_BYTES_WERE_KEPT_${label}`);
    } else {
      assert.equal((await listed(requestId, attachmentId))?.state, "available", `UNEXPECTED_RELEASED_LISTING_${label}`);
    }
    const security = lines.filter((line) => line.event);
    assert.deepEqual(security.map((line) => [line.event?.event, line.level, line.event?.outcome, line.event?.reason]), [
      outcome === "released" ? ["attachment.scan_verdict", "info", "clean", undefined] : ["attachment.blocked", "warn", "blocked", "ATTACHMENT_MALWARE_FOUND"],
      ["attachment.history_unavailable", "warn", outcome === "released" ? "clean" : "blocked", "HISTORY_UNAVAILABLE"],
    ], `UNEXPECTED_SECURITY_EVENTS_${label}_${security.map((line) => line.line).join(" | ")}`);
    const warning = security[1]?.event;
    assert.deepEqual([warning?.actor, warning?.requestId, warning?.attachmentId, warning?.fileType, warning?.sha256], [
      { system: "rescan" }, requestId, attachmentId, "txt", createHash("sha256").update(PLAN_TEXT).digest("hex"),
    ], `UNEXPECTED_WARNING_FACTS_${label}`);
    assert.ok(security.every((line) => !line.line.includes("plan.txt")), `UNEXPECTED_FILE_NAME_LOGGED_${label}`);
  }
});

/*
 * IN-102: once the lock has committed the record, nothing that follows may lose the file's re-scan or its event lines.
 * The re-scan is scheduled and the attachment.uploaded and attachment.quarantined lines are written first, before any
 * further read, so a read that fails afterwards (here every attachment count after the commit) still leaves both.
 */
test("after the commit the re-scan is scheduled and both event lines are written before any further read, so a failing read loses neither (IN-102)", async () => {
  const harness = await harnessPromise;
  const clamd = await clamdPromise;
  await clamd.setMode("down");
  const requestId = await seedDraft();
  const documentService = (runningStrapi() as { documents: (uid: string) => { create: (input: unknown) => Promise<unknown> } }).documents(ATTACHMENT_UID);
  const create = documentService.create;
  let committed = false;
  documentService.create = async (input) => {
    const created = await create.call(documentService, input);
    committed = true;
    return created;
  };
  const form = new FormData();
  form.set("file", new File([PLAN_TEXT], "plan.txt"));
  let response: Response;
  let lines: Array<{ level: string; line: string; event?: Json }>;
  try {
    ({ result: response, lines } = await captureLogs(() => withAttachmentCountIntercepted(async (call) => {
      if (committed) throw new Error("injected attachment read failure after the commit");
      return call.real();
    }, () => harness.request({ path: attachmentsPath(requestId), identity: harness.identities.owner, init: { method: "POST", body: form } }))));
  } finally {
    documentService.create = create;
  }
  assert.equal(committed, true, "THE_RECORD_WAS_NOT_COMMITTED");
  assert.equal(response.status, 500, `UNEXPECTED_STATUS: ${await response.clone().text()}`);
  const [stored] = await harness.listRequestAttachments(requestId);
  assert.equal(stored?.scanStatus, "pending", "UNEXPECTED_NO_PENDING_RECORD");
  const attachmentId = String(stored?.documentId);
  assert.ok(compiledService().scheduledAttachmentRescans(runningStrapi())?.includes(attachmentId), "THE_PENDING_UPLOAD_WAS_NOT_SCHEDULED");
  const security = lines.filter((line) => line.event);
  assert.deepEqual(security.map((line) => [line.event?.event, line.event?.attachmentId, line.event?.outcome]), [
    ["attachment.uploaded", attachmentId, "pending"],
    ["attachment.quarantined", attachmentId, "unavailable"],
  ], `THE_EVENT_LINES_WERE_LOST_${lines.map((line) => line.line).join(" | ")}`);
});

/*
 * IN-210: stopping the re-scans (Strapi's destroy()) aborts a scan in flight instead of waiting out the scanner's
 * timeout (5 s here). The start re-scans every pending file in turn; with clamd silent, the first one's scan hangs until
 * stop() aborts it. stop() then returns at once, and no pending file is changed: the aborted scan counts no attempt and
 * writes no verdict. The re-scans are started again for the tests that follow.
 */
test("stopping the re-scans aborts a scan in flight at once, and every pending file stays pending with its attempts unchanged (IN-210)", async () => {
  const clamd = await clamdPromise;
  const service = compiledService();
  const strapi = runningStrapi();
  await pendingUpload("plan.txt", PLAN_TEXT);
  await service.stopAttachmentRescans(strapi);
  const pendingFiles = async () => (await (strapi as { documents: (uid: string) => { findMany: (query: unknown) => Promise<Json[]> } }).documents(ATTACHMENT_UID).findMany({
    filters: { scanStatus: { $eq: "pending" } },
    fields: ["documentId", "scanStatus", "scanAttempts", "scanCheckedAt", "scanEngine"],
    sort: ["id:asc"],
    limit: 1_000,
  })).map((record) => [record.documentId, record.scanStatus, record.scanAttempts, record.scanCheckedAt ?? null, record.scanEngine]);
  const before = await pendingFiles();
  assert.ok(before.length >= 1, "UNEXPECTED_NO_PENDING_FILE");

  await clamd.setMode("silent");
  const streamArrived = clamd.streamArrived();
  const start = service.startAttachmentRescans(strapi);
  try {
    await streamArrived;
    const stopping = Date.now();
    await service.stopAttachmentRescans(strapi);
    const stoppedMs = Date.now() - stopping;
    await start;
    assert.ok(stoppedMs < 2_000, `STOP_WAITED_OUT_THE_SCAN_IN_FLIGHT: ${stoppedMs} ms`);
    assert.deepEqual(await pendingFiles(), before, "THE_ABORTED_SCAN_CHANGED_A_PENDING_FILE");
  } finally {
    await clamd.setMode("down");
    await service.stopAttachmentRescans(strapi);
    await start;
    await service.startAttachmentRescans(strapi);
  }
  assert.ok(service.scheduledAttachmentRescans(strapi) !== null, "THE_RESCANS_WERE_NOT_STARTED_AGAIN");
});

test("Strapi's destroy() stops the re-scans, so the harness closes without a timer outliving it (Pitfall 11)", async () => {
  const harness = await harnessPromise;
  const service = compiledService();
  const { attachmentId } = await pendingUpload("plan.txt", PLAN_TEXT);
  const strapi = runningStrapi();
  assert.ok(service.scheduledAttachmentRescans(strapi)?.includes(attachmentId), "UNEXPECTED_NOT_SCHEDULED");
  harnessClosed = true;
  await harness.close();
  assert.equal(service.scheduledAttachmentRescans(strapi), null, "UNEXPECTED_RESCANS_OUTLIVE_STRAPI");
});

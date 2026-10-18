import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";

import { attachmentsPath } from "./helpers/attachment-http";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 14 stage B (WR-605): the development fixture that holds request files in the states no browser journey can
 * reach, so the browser suite can scan them. It is seeded only behind IDAMBOX_SEED_CSRM and the development identity, as
 * every development fixture is; and what Strapi serves for it is exactly the states the browser journey reads: on
 * Jane's submitted request a file waiting for its malware check and a blocked one with CSRM's test signature's name,
 * neither downloadable; on her released request one available file, downloadable, with files closed. Seeding again
 * changes nothing: one record per file, and the stored file is kept rather than stored twice.
 *
 * 14-UI-REVIEW UI-01 (the pilot's ruling): the waiting file came with a note Jane wrote, so the browser suite can
 * measure a note's file chip carrying the longest state badge, `Waiting for malware check`, at 375.
 *
 * The harness boots Strapi with seeding off, so bootstrap() never ran the fixture; each test runs the compiled seed the
 * running Strapi loaded, under the environment it names.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => {
  await (await harnessPromise).close();
});

type Json = Record<string, unknown>;
type Fixture = {
  statesRequestNumber: string;
  pendingFileName: string;
  pendingNoteBody: string;
  blockedFileName: string;
  blockedDetection: string;
  releasedRequestNumber: string;
  releasedAssessmentNumber: string;
  releasedFileName: string;
};
type SeedModule = { seedRequestAttachmentStates: (strapi: unknown) => Promise<void>; REQUEST_ATTACHMENT_STATES_FIXTURE: Fixture };
type Documents = { findMany: (input: Json) => Promise<Json[]> };

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

function compiledSeed(): SeedModule {
  return require(path.join(strapiDir, "dist", "src", "bootstrap", "seed-request-attachment-states.js")) as SeedModule;
}

function documents(uid: string): Documents {
  return (globalThis as unknown as { strapi: { documents: (uid: string) => Documents } }).strapi.documents(uid);
}

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";
const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";

type SeedEnvironment = { nodeEnv?: string; environment?: string; identity?: string; seed?: string };

const enabled: SeedEnvironment = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };

async function withSeedEnvironment(values: SeedEnvironment, action: () => Promise<void>) {
  const entries = [["NODE_ENV", values.nodeEnv], ["CSRM_ENVIRONMENT", values.environment], ["CSRM_DEV_IDENTITY", values.identity], ["IDAMBOX_SEED_CSRM", values.seed]] as const;
  const previous = new Map(entries.map(([name]) => [name, process.env[name]]));
  for (const [name, value] of entries) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await action();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function seed(values: SeedEnvironment = enabled): Promise<void> {
  await (await harnessPromise);
  await withSeedEnvironment(values, () => compiledSeed().seedRequestAttachmentStates((globalThis as unknown as { strapi: unknown }).strapi));
}

async function requestNumbered(requestNumber: string): Promise<Json[]> {
  return documents(REQUEST_UID).findMany({ filters: { requestNumber: { $eq: requestNumber } }, populate: { requestor: { fields: ["email"] } }, limit: 10 });
}

async function filesOf(requestId: string): Promise<Json[]> {
  return documents(ATTACHMENT_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: requestId } } },
    populate: { file: { fields: ["id"] }, note: { fields: ["documentId"] } },
    sort: ["id:asc"],
    limit: 10,
  });
}

async function list(requestId: string, identity: string): Promise<{ attachments: Json[]; meta: Json }> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: attachmentsPath(requestId), identity });
  assert.equal(response.status, 200, `LIST_STATUS_${identity}`);
  const body = await response.json() as { data: Json[]; meta: Json };
  return { attachments: body.data, meta: body.meta };
}

const facts = (attachment: Json) => ({
  fileName: attachment.fileName,
  state: attachment.state,
  detection: attachment.detection,
  download: (attachment.actions as Json).download,
});

test("WR-605 the attachment state fixtures are not seeded without IDAMBOX_SEED_CSRM or without the development identity", async () => {
  const fixture = compiledSeed().REQUEST_ATTACHMENT_STATES_FIXTURE;
  for (const values of [
    { ...enabled, seed: undefined },
    { ...enabled, seed: "false" },
    { ...enabled, identity: "false" },
    { ...enabled, identity: undefined },
    { ...enabled, nodeEnv: "production" },
    { ...enabled, environment: "production" },
  ]) await seed(values);

  assert.deepEqual(await requestNumbered(fixture.statesRequestNumber), [], "STATES_FIXTURE_SEEDED_OUTSIDE_DEVELOPMENT");
  assert.deepEqual(await requestNumbered(fixture.releasedRequestNumber), [], "RELEASED_FIXTURE_SEEDED_OUTSIDE_DEVELOPMENT");
});

test("WR-605 Strapi serves Jane's submitted fixture a waiting and a blocked file, and her released one an available file with files closed, the same after seeding twice", async () => {
  const harness = await harnessPromise;
  const fixture = compiledSeed().REQUEST_ATTACHMENT_STATES_FIXTURE;
  await seed();
  const [released] = await requestNumbered(fixture.releasedRequestNumber);
  assert.ok(released, "RELEASED_FIXTURE_MISSING");
  const firstStoredFile = ((await filesOf(String(released.documentId)))[0]?.file as Json | null)?.id;
  assert.equal(typeof firstStoredFile, "number", "RELEASED_FILE_NOT_STORED");
  await seed();

  const states = await requestNumbered(fixture.statesRequestNumber);
  assert.equal(states.length, 1, "STATES_FIXTURE_NOT_EXACTLY_ONE");
  const [request] = states;
  assert.equal(request!.requestStatus, "submitted");
  assert.equal((request!.requestor as Json).email, "jane.doe@idambox.com");
  const stateFiles = await filesOf(String(request!.documentId));
  assert.deepEqual(stateFiles.map((file) => [file.fileName, file.scanStatus, file.file ?? null]), [
    [fixture.pendingFileName, "pending", null],
    [fixture.blockedFileName, "blocked", null],
  ], "STATES_FIXTURE_FILES");

  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    const { attachments, meta } = await list(String(request!.documentId), identity);
    assert.deepEqual(attachments.map(facts), [
      { fileName: fixture.blockedFileName, state: "blocked", detection: fixture.blockedDetection, download: false },
      { fileName: fixture.pendingFileName, state: "pending", detection: null, download: false },
    ], `STATES_SERVED_${identity}`);
    assert.equal(meta.total, 2, `STATES_TOTAL_${identity}`);
  }

  // UI-01: the waiting file came with Jane's note, the request's only note, and the list serves it with that note.
  const notes = await documents(NOTE_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: String(request!.documentId) } } },
    populate: { author: { fields: ["email"] } },
    limit: 10,
  });
  assert.deepEqual(notes.map((note) => [note.body, note.authorPart, note.sequence, note.changesAiInputs, (note.author as Json | null)?.email]), [
    [fixture.pendingNoteBody, "requestor", 1, false, "jane.doe@idambox.com"],
  ], "STATES_NOTE");
  const [note] = notes;
  assert.deepEqual(stateFiles.map((file) => (file.note as Json | null)?.documentId ?? null), [note!.documentId, null], "STATES_NOTE_FILES");
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    const { attachments } = await list(String(request!.documentId), identity);
    const served = attachments.find((attachment) => attachment.fileName === fixture.pendingFileName);
    assert.equal((served?.note as Json | null)?.documentId, note!.documentId, `STATES_PENDING_NOTE_${identity}`);
  }

  assert.equal((await requestNumbered(fixture.releasedRequestNumber)).length, 1, "RELEASED_FIXTURE_NOT_EXACTLY_ONE");
  assert.equal(released.requestStatus, "approved");
  const assessments = await documents(ASSESSMENT_UID).findMany({ filters: { assessmentNumber: { $eq: fixture.releasedAssessmentNumber } }, limit: 10 });
  assert.deepEqual(assessments.map((assessment) => assessment.assessmentStatus), ["approved"], "RELEASED_ASSESSMENT");
  const releasedFiles = await filesOf(String(released.documentId));
  assert.equal(releasedFiles.length, 1, "RELEASED_FILE_NOT_EXACTLY_ONE");
  assert.equal((releasedFiles[0]!.file as Json).id, firstStoredFile, "RELEASED_FILE_STORED_AGAIN");
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    const { attachments, meta } = await list(String(released.documentId), identity);
    assert.deepEqual(attachments.map(facts), [{ fileName: fixture.releasedFileName, state: "available", detection: null, download: true }], `RELEASED_SERVED_${identity}`);
    assert.deepEqual(attachments.map((attachment) => (attachment.actions as Json).remove), [false], `RELEASED_NO_REMOVE_${identity}`);
    assert.deepEqual([(meta.add as Json).canAdd, (meta.add as Json).refusal, (meta.add as Json).window], [false, "ATTACHMENTS_CLOSED", "closed"], `RELEASED_CLOSED_${identity}`);
  }

  // The stored bytes match the record's digest, so the released file downloads whole.
  const [releasedFile] = (await list(String(released.documentId), harness.identities.owner)).attachments;
  const download = await harness.request({ path: `${attachmentsPath(String(released.documentId))}/${encodeURIComponent(String(releasedFile!.documentId))}/content`, identity: harness.identities.owner });
  assert.equal(download.status, 200, "RELEASED_DOWNLOAD_STATUS");
  assert.match(Buffer.from(await download.arrayBuffer()).toString("utf8"), /^Finance records retention schedule\n/, "RELEASED_DOWNLOAD_BYTES");
});

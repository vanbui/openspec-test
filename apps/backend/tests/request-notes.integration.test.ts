import assert from "node:assert/strict";
import test, { after } from "node:test";

import { parseNoteAiInputLog } from "../src/api/csrm-request-note/services/note-ai-input-log";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 13 (D-01, D-21 to D-24, D-26; COLLAB-01): request notes, mounted. Every case seeds its own request, so the
 * cases are independent of each other and of the order they run in.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

let sequence = 0;

type Json = Record<string, unknown>;

function notesPath(requestId: string, suffix = ""): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes${suffix}`;
}

function post(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function addNote(requestId: string, identity: string, data: Json): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: notesPath(requestId), identity, init: post({ data }) });
}

async function listNotes(requestId: string, identity: string, query = ""): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: `${notesPath(requestId)}${query}`, identity });
}

async function markRead(requestId: string, identity: string, throughNoteId: string): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: notesPath(requestId, "/read"), identity, init: post({ data: { throughNoteId } }) });
}

/** A request raised by Jane (or the other Requestor), seeded directly, submitted unless a status is named. */
async function seedRequest(requestStatus = "submitted", requestor: "owner" | "otherRequestor" = "owner"): Promise<string> {
  const harness = await harnessPromise;
  sequence += 1;
  return harness.createAssessmentRequestFixture({
    requestNumber: `NOTES-${String(sequence).padStart(3, "0")}`,
    title: `Notes request ${sequence}`,
    requestStatus,
    requestor,
    submittedDate: requestStatus === "draft" ? null : "2026-10-01T00:00:00.000Z",
  });
}

async function json(response: Response): Promise<Json> {
  return await response.json() as Json;
}

/**
 * The notes and the read states of a request, and the whole database's note, read-state and orphaned-note counts (WR-204):
 * the before and after halves of a refusal's persistence check, which so also see a write on another request or on none.
 */
async function persisted(requestId: string): Promise<unknown[]> {
  const harness = await harnessPromise;
  return harness.snapshot([
    () => harness.listRequestNotes(requestId),
    () => harness.listRequestNoteReadStates(requestId),
    () => harness.countRequestNoteRows(),
    () => harness.countOrphanedRequestNotes(),
  ]);
}

/*
 * Code review WR-201: the tests below that send requests "at once" prove the serialised outcome only. On SQLite, knex's
 * single connection serialises every transaction, so they cannot fail without the request lock. The lock's in-process
 * tail is proven in request-lock.unit.test.ts, and its row lock (FOR UPDATE making another process's transaction wait)
 * is R-08-37's proof, on PostgreSQL.
 */

const JANE_NOTE = "After-hours vendor support will come from an offshore team with administrator access.";
const BOB_REPLY = "Thanks. Which country is the team in, and is access brokered through the PAM vault?";

test("a fresh database holds the approved notes columns and the four link tables (D-01)", async () => {
  const harness = await harnessPromise;
  const noteColumns = await harness.listTableColumns("csrm_request_notes");
  for (const column of ["body", "author_part", "sequence", "posted_at", "changes_ai_inputs", "ai_input_log"]) {
    assert.ok(noteColumns.includes(column), `UNEXPECTED_NOTE_COLUMN_MISSING_${column}`);
  }
  const readStateColumns = await harness.listTableColumns("csrm_request_note_read_states");
  for (const column of ["last_read_at", "last_read_sequence"]) {
    assert.ok(readStateColumns.includes(column), `UNEXPECTED_READ_STATE_COLUMN_MISSING_${column}`);
  }
  for (const [table, owner, target] of [
    ["csrm_request_notes_assessment_request_lnk", "csrm_request_note_id", "csrm_assessment_request_id"],
    ["csrm_request_notes_author_lnk", "csrm_request_note_id", "idambox_user_id"],
    ["csrm_request_note_read_states_reader_lnk", "csrm_request_note_read_state_id", "idambox_user_id"],
    ["csrm_request_note_read_states_assessment_request_lnk", "csrm_request_note_read_state_id", "csrm_assessment_request_id"],
  ] as const) {
    const columns = await harness.listTableColumns(table);
    assert.ok(columns.includes(owner), `UNEXPECTED_OWNER_COLUMN_MISSING_${table}`);
    assert.ok(columns.includes(target), `UNEXPECTED_TARGET_COLUMN_MISSING_${table}`);
  }
  // No inverse attribute: the request and the user gain no notes or read-state column (D-01).
  const requestColumns = await harness.listTableColumns("csrm_assessment_requests");
  assert.equal(requestColumns.some((column) => column.includes("note")), false, "UNEXPECTED_REQUEST_NOTE_COLUMN");
});

test("the Requestor and a Security Analyst exchange notes on a submitted request, oldest first, each unread only for the other part (D-21, D-24)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();

  const added = await addNote(requestId, harness.identities.owner, { body: `  ${JANE_NOTE}\r\n` });
  assert.equal(added.status, 200, "UNEXPECTED_JANE_ADD_STATUS");
  const janeNote = (await json(added)).data as Json;
  assert.deepEqual(Object.keys(janeNote).sort(), ["author", "authorPart", "body", "documentId", "postedAt", "sequence", "unread"], "UNEXPECTED_JANE_NOTE_KEYS");
  assert.equal(janeNote.sequence, 1, "UNEXPECTED_JANE_SEQUENCE");
  assert.equal(janeNote.body, JANE_NOTE, "UNEXPECTED_JANE_BODY_NOT_TRIMMED");
  assert.equal(janeNote.authorPart, "requestor", "UNEXPECTED_JANE_PART");
  assert.deepEqual(janeNote.author, { documentId: harness.users.owner, displayName: "Jane Doe" }, "UNEXPECTED_JANE_AUTHOR");
  assert.ok(Number.isFinite(Date.parse(String(janeNote.postedAt))), "UNEXPECTED_JANE_POSTED_AT");
  assert.equal(janeNote.unread, false, "UNEXPECTED_JANE_OWN_NOTE_UNREAD");

  const bobList = await listNotes(requestId, harness.identities.analyst);
  assert.equal(bobList.status, 200, "UNEXPECTED_BOB_LIST_STATUS");
  const bobBody = await json(bobList);
  assert.deepEqual(bobBody.data, [{ ...janeNote, unread: true, changesAiInputs: false }], "UNEXPECTED_BOB_LIST_NOTES");
  assert.deepEqual(bobBody.meta, {
    total: 1, unread: 1, lastReadSequence: 0, hasEarlier: false, accepting: true, closedReason: null, viewerPart: "security-analyst", canMarkAiInputs: true,
  }, "UNEXPECTED_BOB_LIST_META");

  const reply = await addNote(requestId, harness.identities.analyst, { body: BOB_REPLY });
  assert.equal(reply.status, 200, "UNEXPECTED_BOB_REPLY_STATUS");
  const bobNote = (await json(reply)).data as Json;
  assert.equal(bobNote.sequence, 2, "UNEXPECTED_BOB_SEQUENCE");
  assert.equal(bobNote.authorPart, "security-analyst", "UNEXPECTED_BOB_PART");
  assert.deepEqual(bobNote.author, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_BOB_AUTHOR");
  assert.equal(bobNote.changesAiInputs, false, "UNEXPECTED_BOB_MARK");

  const janeList = await listNotes(requestId, harness.identities.owner);
  assert.equal(janeList.status, 200, "UNEXPECTED_JANE_LIST_STATUS");
  const janeBody = await json(janeList);
  const janeNotes = janeBody.data as Json[];
  assert.deepEqual(janeNotes.map((note) => [note.sequence, note.authorPart, note.unread]), [[1, "requestor", false], [2, "security-analyst", true]], "UNEXPECTED_JANE_THREAD");
  for (const note of janeNotes) assert.equal("changesAiInputs" in note, false, "UNEXPECTED_JANE_SEES_MARK");
  assert.deepEqual(janeBody.meta, {
    total: 2, unread: 1, lastReadSequence: 0, hasEarlier: false, accepting: true, closedReason: null, viewerPart: "requestor", canMarkAiInputs: false,
  }, "UNEXPECTED_JANE_LIST_META");

  // Reading the thread marks nothing read (no GET side effect); the explicit mark-read does.
  assert.deepEqual(await harness.listRequestNoteReadStates(requestId), [], "UNEXPECTED_READ_STATE_AFTER_GET");
  const bobRead = await markRead(requestId, harness.identities.analyst, String(janeNote.documentId));
  assert.equal(bobRead.status, 200, "UNEXPECTED_BOB_MARK_READ_STATUS");
  assert.deepEqual((await json(bobRead)).data, { lastReadSequence: 1, unread: 0 }, "UNEXPECTED_BOB_READ_STATE");
  const janeRead = await markRead(requestId, harness.identities.owner, String(bobNote.documentId));
  assert.equal(janeRead.status, 200, "UNEXPECTED_JANE_MARK_READ_STATUS");
  assert.deepEqual((await json(janeRead)).data, { lastReadSequence: 2, unread: 0 }, "UNEXPECTED_JANE_READ_STATE");

  const stored = await harness.listRequestNotes(requestId);
  assert.deepEqual(stored.map((note) => [note.sequence, note.authorPart, note.author, note.changesAiInputs, note.aiInputLog ?? null]), [
    [1, "requestor", harness.users.owner, false, null],
    [2, "security-analyst", harness.users.analyst, false, null],
  ], "UNEXPECTED_STORED_NOTES");
});

test("another Requestor, the service agent and anyone naming a missing request get 404 on every notes route with nothing written (D-23)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const added = await addNote(requestId, harness.identities.owner, { body: JANE_NOTE });
  assert.equal(added.status, 200, "UNEXPECTED_SEED_NOTE_STATUS");
  const noteId = String(((await json(added)).data as Json).documentId);

  for (const [label, identity] of [["OTHER_REQUESTOR", harness.identities.otherRequestor], ["SERVICE_AGENT", harness.identities.serviceAnalystAgent]] as const) {
    const before = await persisted(requestId);
    const list = await listNotes(requestId, identity);
    assert.equal(list.status, 404, `UNEXPECTED_LIST_STATUS_${label}`);
    const listText = await list.text();
    assert.ok(!listText.includes(JANE_NOTE) && !listText.includes(noteId), `UNEXPECTED_LIST_DISCLOSED_${label}`);
    const create = await addNote(requestId, identity, { body: "Should never be stored." });
    assert.equal(create.status, 404, `UNEXPECTED_ADD_STATUS_${label}`);
    const read = await markRead(requestId, identity, noteId);
    assert.equal(read.status, 404, `UNEXPECTED_MARK_READ_STATUS_${label}`);
    assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
  }

  // The refusal reads the same as a missing request, for everyone (D-23), and writes nothing anywhere (WR-204).
  const outsiderMessage = ((await json(await listNotes(requestId, harness.identities.otherRequestor))).error as Json).message;
  const beforeMissing = await persisted(requestId);
  for (const identity of [harness.identities.owner, harness.identities.analyst, harness.identities.otherRequestor]) {
    const missing = await listNotes("no-such-request", identity);
    assert.equal(missing.status, 404, "UNEXPECTED_MISSING_REQUEST_LIST_STATUS");
    assert.equal(((await json(missing)).error as Json).message, outsiderMessage, "UNEXPECTED_MISSING_REQUEST_MESSAGE");
    assert.equal((await addNote("no-such-request", identity, { body: JANE_NOTE })).status, 404, "UNEXPECTED_MISSING_REQUEST_ADD_STATUS");
    assert.equal((await markRead("no-such-request", identity, noteId)).status, 404, "UNEXPECTED_MISSING_REQUEST_READ_STATUS");
  }
  assert.deepEqual(await persisted(requestId), beforeMissing, "UNEXPECTED_MISSING_REQUEST_WRITE");
  assert.equal(await harness.countOrphanedRequestNotes(), 0, "UNEXPECTED_MISSING_REQUEST_ORPHAN");
});

async function refusalDetails(response: Response): Promise<unknown> {
  return ((await response.json()) as { error?: { details?: unknown } }).error?.details;
}

/** Asserts a refused create: its status, its closed reason when one is expected, and that nothing was written. */
async function assertAddRefused(requestId: string, identity: string, data: Json, status: number, reason: string | undefined, label: string): Promise<void> {
  const before = await persisted(requestId);
  const response = await addNote(requestId, identity, data);
  assert.equal(response.status, status, `UNEXPECTED_STATUS_${label}`);
  const details = await refusalDetails(response);
  if (reason !== undefined) assert.deepEqual(details, { reason }, `UNEXPECTED_REASON_${label}`);
  else assert.equal((details as { reason?: unknown } | undefined)?.reason, undefined, `UNEXPECTED_DETAILS_${label}`);
  assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
}

/** A request raised and submitted by Bob, the human Security Analyst, through the mounted routes. */
async function seedBobsOwnRequest(): Promise<string> {
  const harness = await harnessPromise;
  const created = await harness.request({
    path: "/api/csrm-assessment-requests",
    identity: harness.identities.analyst,
    init: post({ data: { title: "An analyst's own request with notes" } }),
  });
  assert.equal(created.status, 200, "UNEXPECTED_OWN_CREATE_STATUS");
  const requestId = ((await json(created)).data as Json).documentId as string;
  const submitted = await harness.request({
    path: `/api/csrm-assessment-requests/${requestId}`,
    identity: harness.identities.analyst,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { requestStatus: "submitted" } }) },
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_OWN_SUBMIT_STATUS");
  return requestId;
}

test("a never-submitted draft, a request returned to draft, and an approved or closed request refuse a new note with NOTES_CLOSED (D-22)", async () => {
  const harness = await harnessPromise;
  const draft = await seedRequest("draft");
  await assertAddRefused(draft, harness.identities.owner, { body: JANE_NOTE }, 409, "NOTES_CLOSED", "NEVER_SUBMITTED");
  const draftList = await json(await listNotes(draft, harness.identities.owner));
  assert.deepEqual(draftList.data, [], "UNEXPECTED_DRAFT_NOTES");
  assert.equal((draftList.meta as Json).accepting, false, "UNEXPECTED_DRAFT_ACCEPTING");
  assert.equal((draftList.meta as Json).closedReason, "not-submitted", "UNEXPECTED_DRAFT_CLOSED_REASON");

  const returned = await seedRequest();
  assert.equal((await addNote(returned, harness.identities.owner, { body: JANE_NOTE })).status, 200, "UNEXPECTED_NOTE_BEFORE_RETURN");
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", returned, {
    requestStatus: "draft", submittedDate: null, revertReason: "Missing vendor details", revertedAt: "2026-10-05T00:00:00.000Z",
  });
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    await assertAddRefused(returned, identity, { body: "One more thing." }, 409, "NOTES_CLOSED", `RETURNED_TO_DRAFT_${identity}`);
  }
  const returnedList = await json(await listNotes(returned, harness.identities.owner));
  assert.deepEqual((returnedList.data as Json[]).map((note) => note.body), [JANE_NOTE], "UNEXPECTED_RETURNED_DRAFT_THREAD");
  assert.equal((returnedList.meta as Json).accepting, false, "UNEXPECTED_RETURNED_ACCEPTING");
  assert.equal((returnedList.meta as Json).closedReason, "returned-to-draft", "UNEXPECTED_RETURNED_CLOSED_REASON");
  assert.equal((returnedList.meta as Json).canMarkAiInputs, false, "UNEXPECTED_RETURNED_CAN_MARK");

  for (const status of ["approved", "closed"]) {
    const released = await seedRequest(status);
    for (const identity of [harness.identities.owner, harness.identities.analyst]) {
      await assertAddRefused(released, identity, { body: "After release." }, 409, "NOTES_CLOSED", `${status.toUpperCase()}_${identity}`);
    }
    const releasedList = await json(await listNotes(released, harness.identities.analyst));
    assert.equal((releasedList.meta as Json).closedReason, "released", `UNEXPECTED_CLOSED_REASON_${status}`);
    assert.equal((releasedList.meta as Json).canMarkAiInputs, false, `UNEXPECTED_CAN_MARK_${status}`);
  }
});

test("the 501st note is refused with NOTES_LIMIT_REACHED and a body over 5,000 characters or with a control character is refused with 400 (D-21)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  await assertAddRefused(requestId, harness.identities.owner, { body: "x".repeat(5_001) }, 400, undefined, "TOO_LONG");
  await assertAddRefused(requestId, harness.identities.owner, { body: "Ring \u0007 the bell" }, 400, undefined, "CONTROL_CHARACTER");
  await assertAddRefused(requestId, harness.identities.owner, { body: "   " }, 400, undefined, "BLANK");
  await assertAddRefused(requestId, harness.identities.owner, { body: JANE_NOTE, sequence: 7 }, 400, undefined, "SERVER_OWNED_KEY");
  const exact = await addNote(requestId, harness.identities.owner, { body: "x".repeat(5_000) });
  assert.equal(exact.status, 200, "UNEXPECTED_EXACT_BOUND_STATUS");

  const full = await seedRequest();
  await harness.createRequestNoteFixtures(full, 500);
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    await assertAddRefused(full, identity, { body: "Note 501." }, 409, "NOTES_LIMIT_REACHED", `LIMIT_${identity}`);
  }
  const page = await json(await listNotes(full, harness.identities.analyst, "?limit=50"));
  const newest = page.data as Json[];
  assert.equal(newest.length, 50, "UNEXPECTED_PAGE_SIZE");
  assert.deepEqual([newest[0].sequence, newest[49].sequence], [451, 500], "UNEXPECTED_NEWEST_PAGE");
  assert.equal((page.meta as Json).total, 500, "UNEXPECTED_TOTAL");
  assert.equal((page.meta as Json).hasEarlier, true, "UNEXPECTED_HAS_EARLIER");
  const earlier = (await json(await listNotes(full, harness.identities.analyst, "?before=451&limit=50"))).data as Json[];
  assert.deepEqual([earlier[0].sequence, earlier[49].sequence], [401, 450], "UNEXPECTED_EARLIER_PAGE");
  for (const query of ["?limit=51", "?limit=0", "?before=0", "?before=abc", "?page=2"]) {
    assert.equal((await listNotes(full, harness.identities.analyst, query)).status, 400, `UNEXPECTED_QUERY_STATUS_${query}`);
  }
});

test("mark-read advances only forward, refuses a note from another request, keeps one row when two reads are sent at once (serialised), and no GET writes a read state (D-24)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const first = ((await json(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }))).data as Json).documentId as string;
  const advanced = await markRead(requestId, harness.identities.analyst, first);
  assert.equal(advanced.status, 200, "UNEXPECTED_FIRST_READ_STATUS");
  assert.deepEqual((await json(advanced)).data, { lastReadSequence: 1, unread: 0 }, "UNEXPECTED_FIRST_READ_STATE");
  const second = ((await json(await addNote(requestId, harness.identities.owner, { body: "And a second thing." }))).data as Json).documentId as string;
  const backwards = await markRead(requestId, harness.identities.analyst, first);
  assert.equal(backwards.status, 200, "UNEXPECTED_EARLIER_READ_STATUS");
  assert.deepEqual((await json(backwards)).data, { lastReadSequence: 1, unread: 1 }, "UNEXPECTED_READ_STATE_MOVED_BACK");
  assert.deepEqual((await json(await markRead(requestId, harness.identities.analyst, second))).data, { lastReadSequence: 2, unread: 0 }, "UNEXPECTED_SECOND_READ_STATE");

  const elsewhere = await seedRequest();
  const foreign = ((await json(await addNote(elsewhere, harness.identities.owner, { body: JANE_NOTE }))).data as Json).documentId as string;
  const before = await persisted(requestId);
  assert.equal((await markRead(requestId, harness.identities.analyst, foreign)).status, 404, "UNEXPECTED_FOREIGN_NOTE_STATUS");
  assert.equal((await harness.request({ path: notesPath(requestId, "/read"), identity: harness.identities.analyst, init: post({ data: {} }) })).status, 400, "UNEXPECTED_EMPTY_READ_STATUS");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_FOREIGN_READ_WRITE");

  const racing = await seedRequest();
  const raced = ((await json(await addNote(racing, harness.identities.owner, { body: JANE_NOTE }))).data as Json).documentId as string;
  const reads = await harness.simultaneousRequests([0, 1].map(() => ({
    path: notesPath(racing, "/read"), identity: harness.identities.analyst, init: post({ data: { throughNoteId: raced } }),
  })));
  assert.deepEqual(reads.map((response) => response.status), [200, 200], "UNEXPECTED_CONCURRENT_READ_STATUSES");
  const states = await harness.listRequestNoteReadStates(racing);
  assert.equal(states.filter((state) => state.reader === harness.users.analyst).length, 1, "UNEXPECTED_READ_STATE_ROWS");

  const settled = await persisted(racing);
  for (const identity of [harness.identities.owner, harness.identities.analyst, harness.identities.secondAnalyst]) {
    assert.equal((await listNotes(racing, identity)).status, 200, "UNEXPECTED_LIST_STATUS");
  }
  assert.deepEqual(await persisted(racing), settled, "UNEXPECTED_GET_WROTE");
});

test("two notes sent at once are serialised to sequences 1 and 2 with no duplicate (D-21)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const responses = await harness.simultaneousRequests([
    { path: notesPath(requestId), identity: harness.identities.owner, init: post({ data: { body: "From Jane, at once." } }) },
    { path: notesPath(requestId), identity: harness.identities.analyst, init: post({ data: { body: "From Bob, at once." } }) },
  ]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200], "UNEXPECTED_CONCURRENT_ADD_STATUSES");
  const sequences = (await harness.listRequestNotes(requestId)).map((note) => note.sequence);
  assert.deepEqual(sequences, [1, 2], "UNEXPECTED_CONCURRENT_SEQUENCES");
});

test("a participant-shaped caller who is not the requestor gets 404 on every notes route with nothing written (D-23, G-12)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const noteId = ((await json(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }))).data as Json).documentId as string;
  // Stands for the first-line risk owner Phase 17 will nominate: an active Requestor-only identity who is not Jane.
  const riskOwner = await harness.createUserFixture({ email: "risk.owner@example.test", username: "risk-owner", displayName: "Risk Owner", accountStatus: "active" });
  harness.registerTestIdentity("participant", riskOwner);
  const before = await persisted(requestId);
  assert.equal((await listNotes(requestId, "participant")).status, 404, "UNEXPECTED_PARTICIPANT_LIST_STATUS");
  assert.equal((await addNote(requestId, "participant", { body: "A risk owner's note." })).status, 404, "UNEXPECTED_PARTICIPANT_ADD_STATUS");
  assert.equal((await markRead(requestId, "participant", noteId)).status, 404, "UNEXPECTED_PARTICIPANT_READ_STATUS");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_PARTICIPANT_WRITE");
});

test("a Security Analyst may mark a note as changing the AI inputs when posting; a Requestor's mark is 400 and a requesting analyst's is OWN_REQUEST (D-26, D-07)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const marked = await addNote(requestId, harness.identities.analyst, { body: BOB_REPLY, changesAiInputs: true });
  assert.equal(marked.status, 200, "UNEXPECTED_MARKED_ADD_STATUS");
  const note = (await json(marked)).data as Json;
  assert.equal(note.changesAiInputs, true, "UNEXPECTED_MARK_NOT_RETURNED");
  const [stored] = await harness.listRequestNotes(requestId);
  assert.equal(stored.changesAiInputs, true, "UNEXPECTED_MARK_NOT_STORED");
  assert.deepEqual(stored.aiInputLog, {
    schemaVersion: 1,
    events: [{ schemaVersion: 1, by: harness.users.analyst, at: note.postedAt, from: false, to: true }],
  }, "UNEXPECTED_MARK_LOG");
  const unmarked = await addNote(requestId, harness.identities.analyst, { body: "Not for the AI.", changesAiInputs: false });
  assert.equal(unmarked.status, 200, "UNEXPECTED_UNMARKED_ADD_STATUS");
  assert.equal((await harness.listRequestNotes(requestId))[1].aiInputLog ?? null, null, "UNEXPECTED_UNMARKED_LOG");
  // The Requestor never sees the mark (D-26).
  for (const listed of (await json(await listNotes(requestId, harness.identities.owner))).data as Json[]) {
    assert.equal("changesAiInputs" in listed, false, "UNEXPECTED_REQUESTOR_SEES_MARK");
  }

  for (const value of [true, false]) {
    await assertAddRefused(requestId, harness.identities.owner, { body: JANE_NOTE, changesAiInputs: value }, 400, undefined, `REQUESTOR_MARK_${value}`);
  }

  const own = await seedBobsOwnRequest();
  await assertAddRefused(own, harness.identities.analyst, { body: "Mark my own note.", changesAiInputs: true }, 403, "OWN_REQUEST", "REQUESTING_ANALYST_MARK");
  const ownList = await json(await listNotes(own, harness.identities.analyst));
  assert.equal((ownList.meta as Json).viewerPart, "requestor", "UNEXPECTED_OWN_VIEWER_PART");
  assert.equal((ownList.meta as Json).canMarkAiInputs, false, "UNEXPECTED_OWN_CAN_MARK");
  const plain = await addNote(own, harness.identities.analyst, { body: "Context for whoever picks this up." });
  assert.equal(plain.status, 200, "UNEXPECTED_OWN_PLAIN_ADD_STATUS");
  assert.equal(((await json(plain)).data as Json).authorPart, "requestor", "UNEXPECTED_OWN_AUTHOR_PART");
});

const NOTE_UID = "api::csrm-request-note.csrm-request-note";

function aiInputPath(requestId: string, noteId: string): string {
  return notesPath(requestId, `/${encodeURIComponent(noteId)}/ai_input`);
}

/** PUT …/notes/{noteId}/ai_input with a raw body, so the open-body cases send exactly what they name. */
async function putAiInput(requestId: string, noteId: string, identity: string, body: unknown): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({
    path: aiInputPath(requestId, noteId),
    identity,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  });
}

async function setMark(requestId: string, noteId: string, identity: string, changesAiInputs: boolean): Promise<Response> {
  return putAiInput(requestId, noteId, identity, { data: { changesAiInputs } });
}

async function storedNote(requestId: string, noteId: string): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  const note = (await harness.listRequestNotes(requestId)).find((candidate) => candidate.documentId === noteId);
  assert.ok(note, "UNEXPECTED_STORED_NOTE_MISSING");
  return note as Record<string, unknown>;
}

async function noteIdOf(response: Response): Promise<string> {
  assert.equal(response.status, 200, "UNEXPECTED_SEED_NOTE_STATUS");
  return ((await json(response)).data as Json).documentId as string;
}

/** Asserts a refused mark change: its status, its closed reason when one is expected, and that nothing was written. */
async function assertMarkRefused(requestId: string, noteId: string, identity: string, body: unknown, status: number, reason: string | undefined, label: string): Promise<void> {
  const before = await persisted(requestId);
  const response = await putAiInput(requestId, noteId, identity, body);
  assert.equal(response.status, status, `UNEXPECTED_MARK_STATUS_${label}`);
  const text = await response.text();
  assert.ok(!text.includes(JANE_NOTE), `UNEXPECTED_MARK_DISCLOSED_${label}`);
  const details = (JSON.parse(text) as { error?: { details?: unknown } }).error?.details;
  if (reason !== undefined) assert.deepEqual(details, { reason }, `UNEXPECTED_MARK_REASON_${label}`);
  else assert.equal((details as { reason?: unknown } | undefined)?.reason, undefined, `UNEXPECTED_MARK_DETAILS_${label}`);
  assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_MARK_WRITE_${label}`);
}

test("a Security Analyst marks the Requestor's note as changing the AI inputs and undoes it, one logged event per change and none for the same value (D-26)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const noteId = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));

  const marked = await setMark(requestId, noteId, harness.identities.analyst, true);
  assert.equal(marked.status, 200, "UNEXPECTED_MARK_STATUS");
  const markedNote = (await json(marked)).data as Json;
  assert.deepEqual(Object.keys(markedNote).sort(), ["author", "authorPart", "body", "changesAiInputs", "documentId", "postedAt", "sequence", "unread"], "UNEXPECTED_MARKED_NOTE_KEYS");
  assert.deepEqual([markedNote.documentId, markedNote.authorPart, markedNote.body, markedNote.changesAiInputs], [noteId, "requestor", JANE_NOTE, true], "UNEXPECTED_MARKED_NOTE");
  const afterMark = await storedNote(requestId, noteId);
  assert.equal(afterMark.changesAiInputs, true, "UNEXPECTED_MARK_NOT_STORED");
  const markLog = afterMark.aiInputLog as { schemaVersion: number; events: Json[] };
  assert.equal(markLog.schemaVersion, 1, "UNEXPECTED_MARK_LOG_VERSION");
  assert.equal(markLog.events.length, 1, "UNEXPECTED_MARK_LOG_LENGTH");
  assert.deepEqual({ ...markLog.events[0], at: undefined }, { schemaVersion: 1, by: harness.users.analyst, at: undefined, from: false, to: true }, "UNEXPECTED_MARK_EVENT");
  assert.ok(Number.isFinite(Date.parse(String(markLog.events[0].at))), "UNEXPECTED_MARK_EVENT_AT");

  // Undo is a second change, logged as its own event.
  const undone = await setMark(requestId, noteId, harness.identities.analyst, false);
  assert.equal(undone.status, 200, "UNEXPECTED_UNDO_STATUS");
  assert.equal(((await json(undone)).data as Json).changesAiInputs, false, "UNEXPECTED_UNDO_NOTE");
  const afterUndo = await storedNote(requestId, noteId);
  assert.equal(afterUndo.changesAiInputs, false, "UNEXPECTED_UNDO_NOT_STORED");
  const undoEvents = (afterUndo.aiInputLog as { events: Json[] }).events;
  assert.deepEqual(undoEvents.map((event) => [event.by, event.from, event.to]), [
    [harness.users.analyst, false, true],
    [harness.users.analyst, true, false],
  ], "UNEXPECTED_UNDO_LOG");

  // The same value again succeeds and writes nothing.
  const before = await persisted(requestId);
  const same = await setMark(requestId, noteId, harness.identities.analyst, false);
  assert.equal(same.status, 200, "UNEXPECTED_SAME_VALUE_STATUS");
  assert.equal(((await json(same)).data as Json).changesAiInputs, false, "UNEXPECTED_SAME_VALUE_NOTE");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_SAME_VALUE_WRITE");

  // Any human Security Analyst who did not raise the request may change it.
  assert.equal((await setMark(requestId, noteId, harness.identities.secondAnalyst, true)).status, 200, "UNEXPECTED_SECOND_ANALYST_STATUS");
  const events = ((await storedNote(requestId, noteId)).aiInputLog as { events: Json[] }).events;
  assert.deepEqual(events.map((event) => [event.by, event.to]), [
    [harness.users.analyst, true],
    [harness.users.analyst, false],
    [harness.users.secondAnalyst, true],
  ], "UNEXPECTED_SECOND_ANALYST_LOG");

  // The Requestor still never sees the mark (D-26).
  for (const listed of (await json(await listNotes(requestId, harness.identities.owner))).data as Json[]) {
    assert.equal("changesAiInputs" in listed, false, "UNEXPECTED_REQUESTOR_SEES_MARK");
  }
});

test("the AI-input mark is refused to the Requestor, the other Requestor, the service agent and a requesting analyst, outside the notes window, for a note from another request and for an open body, with nothing written (D-26, D-07, D-30)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const noteId = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  const mark = { data: { changesAiInputs: true } };

  for (const [label, identity] of [
    ["OWNER", harness.identities.owner],
    ["OTHER_REQUESTOR", harness.identities.otherRequestor],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent],
  ] as const) {
    await assertMarkRefused(requestId, noteId, identity, mark, 403, undefined, label);
  }

  // G-1 (D-07): an analyst who raised the request changes no mark on it, on their own note or another analyst's.
  const own = await seedBobsOwnRequest();
  const ownNote = await noteIdOf(await addNote(own, harness.identities.analyst, { body: "Context for whoever picks this up." }));
  const colleagueNote = await noteIdOf(await addNote(own, harness.identities.secondAnalyst, { body: "Picked up; one question below." }));
  for (const [label, target] of [["OWN_NOTE", ownNote], ["COLLEAGUE_NOTE", colleagueNote]] as const) {
    await assertMarkRefused(own, target, harness.identities.analyst, mark, 403, "OWN_REQUEST", `REQUESTING_ANALYST_${label}`);
  }
  assert.equal((await setMark(own, colleagueNote, harness.identities.secondAnalyst, true)).status, 200, "UNEXPECTED_OTHER_ANALYST_ON_OWN_REQUEST");

  // Outside the notes window the mark is frozen with the record (NOTES_CLOSED), a marked note included.
  for (const [label, data] of [
    ["APPROVED", { requestStatus: "approved" }],
    ["CLOSED", { requestStatus: "closed" }],
    ["RETURNED_TO_DRAFT", { requestStatus: "draft", submittedDate: null, revertReason: "Missing vendor details", revertedAt: "2026-10-05T00:00:00.000Z" }],
  ] as const) {
    const shut = await seedRequest();
    const shutNote = await noteIdOf(await addNote(shut, harness.identities.owner, { body: JANE_NOTE }));
    assert.equal((await setMark(shut, shutNote, harness.identities.analyst, true)).status, 200, `UNEXPECTED_MARK_BEFORE_${label}`);
    await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", shut, data);
    for (const value of [true, false]) {
      await assertMarkRefused(shut, shutNote, harness.identities.analyst, { data: { changesAiInputs: value } }, 409, "NOTES_CLOSED", `${label}_${value}`);
    }
  }

  // A note that is not on this request, or no note at all, is 404.
  const elsewhere = await seedRequest();
  const foreign = await noteIdOf(await addNote(elsewhere, harness.identities.owner, { body: JANE_NOTE }));
  await assertMarkRefused(requestId, foreign, harness.identities.analyst, mark, 404, undefined, "FOREIGN_NOTE");
  await assertMarkRefused(requestId, "no-such-note", harness.identities.analyst, mark, 404, undefined, "MISSING_NOTE");
  await assertMarkRefused("no-such-request", noteId, harness.identities.analyst, mark, 404, undefined, "MISSING_REQUEST");

  // The body is exactly { data: { changesAiInputs: boolean } }.
  for (const [label, body] of [
    ["EXTRA_KEY", { data: { changesAiInputs: true, by: harness.users.owner } }],
    ["NOT_BOOLEAN", { data: { changesAiInputs: "yes" } }],
    ["EMPTY_DATA", { data: {} }],
    ["NO_DATA", { changesAiInputs: true }],
  ] as const) {
    await assertMarkRefused(requestId, noteId, harness.identities.analyst, body, 400, undefined, label);
  }
  assert.equal((await storedNote(requestId, noteId)).changesAiInputs, false, "UNEXPECTED_REFUSED_MARK_STORED");
});

test("a note whose AI-input log is full or unreadable refuses a change with HISTORY_UNAVAILABLE and keeps its mark; two marks sent at once are serialised to one logged change (D-26)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const noteId = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  const events = Array.from({ length: 200 }, (_, index) => ({
    schemaVersion: 1,
    by: harness.users.analyst,
    at: new Date(Date.UTC(2026, 9, 2, 0, 0, index)).toISOString(),
    from: index % 2 === 1,
    to: index % 2 === 0,
  }));
  await harness.updateFixtureDocument(NOTE_UID, noteId, { changesAiInputs: false, aiInputLog: { schemaVersion: 1, events } });
  // WR-205: the fixture is a readable full log, so the refusal below is the cap's, not a malformed log's.
  assert.equal(parseNoteAiInputLog((await storedNote(requestId, noteId)).aiInputLog).length, 200, "UNEXPECTED_FULL_LOG_FIXTURE_UNREADABLE");
  await assertMarkRefused(requestId, noteId, harness.identities.analyst, { data: { changesAiInputs: true } }, 409, "HISTORY_UNAVAILABLE", "LOG_FULL");
  // The same value writes no event, so it still succeeds.
  assert.equal((await setMark(requestId, noteId, harness.identities.analyst, false)).status, 200, "UNEXPECTED_FULL_LOG_SAME_VALUE");

  await harness.updateFixtureDocument(NOTE_UID, noteId, { aiInputLog: { schemaVersion: 9, events: [] } });
  await assertMarkRefused(requestId, noteId, harness.identities.analyst, { data: { changesAiInputs: true } }, 409, "HISTORY_UNAVAILABLE", "LOG_UNREADABLE");

  // WR-205: one below the cap, the same kind of change is taken and appends exactly one event.
  const belowCap = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: "One more detail." }));
  await harness.updateFixtureDocument(NOTE_UID, belowCap, { changesAiInputs: true, aiInputLog: { schemaVersion: 1, events: events.slice(0, 199) } });
  assert.equal(parseNoteAiInputLog((await storedNote(requestId, belowCap)).aiInputLog).length, 199, "UNEXPECTED_BELOW_CAP_FIXTURE_UNREADABLE");
  assert.equal((await setMark(requestId, belowCap, harness.identities.analyst, false)).status, 200, "UNEXPECTED_BELOW_CAP_MARK_STATUS");
  const afterBelowCap = await storedNote(requestId, belowCap);
  assert.equal(afterBelowCap.changesAiInputs, false, "UNEXPECTED_BELOW_CAP_MARK_NOT_STORED");
  assert.equal(parseNoteAiInputLog(afterBelowCap.aiInputLog).length, 200, "UNEXPECTED_BELOW_CAP_LOG_LENGTH");

  const racing = await seedRequest();
  const racedNote = await noteIdOf(await addNote(racing, harness.identities.owner, { body: JANE_NOTE }));
  const responses = await harness.simultaneousRequests([harness.identities.analyst, harness.identities.secondAnalyst].map((identity) => ({
    path: aiInputPath(racing, racedNote),
    identity,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { changesAiInputs: true } }) },
  })));
  assert.deepEqual(responses.map((response) => response.status), [200, 200], "UNEXPECTED_CONCURRENT_MARK_STATUSES");
  const raced = await storedNote(racing, racedNote);
  assert.equal(raced.changesAiInputs, true, "UNEXPECTED_CONCURRENT_MARK");
  assert.equal((raced.aiInputLog as { events: Json[] }).events.length, 1, "UNEXPECTED_CONCURRENT_MARK_EVENTS");
});

/** The request read's notes summary for one reader (D-24, D-25). */
async function notesSummary(requestId: string, identity: string): Promise<unknown> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity });
  assert.equal(response.status, 200, `UNEXPECTED_REQUEST_READ_STATUS_${identity}`);
  return ((await json(response)).data as Json).notes;
}

test("the request read carries each reader's notes summary, unread by sequence, with the closedReason of a never-submitted draft, a request returned to draft and a released request (D-24, D-25)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const janeNote = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  assert.equal((await addNote(requestId, harness.identities.analyst, { body: BOB_REPLY })).status, 200, "UNEXPECTED_BOB_REPLY_STATUS");

  const before = await persisted(requestId);
  const open = { total: 2, unread: 1, accepting: true, closedReason: null };
  assert.deepEqual(await notesSummary(requestId, harness.identities.owner), open, "UNEXPECTED_JANE_SUMMARY");
  assert.deepEqual(await notesSummary(requestId, harness.identities.analyst), open, "UNEXPECTED_BOB_SUMMARY");
  // Bob's reply is in the Security Analysts' part, so only Jane's note is new to the second analyst.
  assert.deepEqual(await notesSummary(requestId, harness.identities.secondAnalyst), open, "UNEXPECTED_SECOND_ANALYST_SUMMARY");
  // Reading the request marks nothing read (no GET side effect).
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_REQUEST_READ_WROTE");

  assert.equal((await markRead(requestId, harness.identities.analyst, janeNote)).status, 200, "UNEXPECTED_BOB_MARK_READ_STATUS");
  assert.deepEqual(await notesSummary(requestId, harness.identities.analyst), { ...open, unread: 0 }, "UNEXPECTED_BOB_SUMMARY_AFTER_READ");
  assert.deepEqual(await notesSummary(requestId, harness.identities.owner), open, "UNEXPECTED_JANE_SUMMARY_AFTER_BOB_READ");

  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, {
    requestStatus: "draft", submittedDate: null, revertReason: "Missing vendor details", revertedAt: "2026-10-05T00:00:00.000Z",
  });
  assert.deepEqual(await notesSummary(requestId, harness.identities.owner), { total: 2, unread: 1, accepting: false, closedReason: "returned-to-draft" }, "UNEXPECTED_RETURNED_SUMMARY");

  const released = await seedRequest("approved");
  assert.deepEqual(await notesSummary(released, harness.identities.analyst), { total: 0, unread: 0, accepting: false, closedReason: "released" }, "UNEXPECTED_RELEASED_SUMMARY");
  const draft = await seedRequest("draft");
  assert.deepEqual(await notesSummary(draft, harness.identities.owner), { total: 0, unread: 0, accepting: false, closedReason: "not-submitted" }, "UNEXPECTED_DRAFT_SUMMARY");
});

function deleteRequest(requestId: string, identity: string): Promise<Response> {
  return harnessPromise.then((harness) => harness.request({
    path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`,
    identity,
    init: { method: "DELETE" },
  }));
}

test("a request holding a note cannot be deleted (REQUEST_HAS_NOTES) and nothing is deleted; a request with no note still can be (D-21, T-13-22)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  const before = await harness.snapshot([() => harness.getRequest(requestId), () => harness.listRequestNotes(requestId), () => harness.listRequestNoteReadStates(requestId)]);
  const refused = await deleteRequest(requestId, harness.identities.analyst);
  assert.equal(refused.status, 409, "UNEXPECTED_DELETE_WITH_NOTES_STATUS");
  assert.deepEqual((JSON.parse(await refused.text()) as { error?: { details?: unknown } }).error?.details, { reason: "REQUEST_HAS_NOTES" }, "UNEXPECTED_DELETE_WITH_NOTES_REASON");
  assert.deepEqual(await harness.snapshot([() => harness.getRequest(requestId), () => harness.listRequestNotes(requestId), () => harness.listRequestNoteReadStates(requestId)]), before, "UNEXPECTED_DELETE_WITH_NOTES_WROTE");

  const empty = await seedRequest();
  const deleted = await deleteRequest(empty, harness.identities.analyst);
  assert.ok(deleted.status >= 200 && deleted.status < 300, `UNEXPECTED_DELETE_STATUS_${deleted.status}`);
  assert.equal(await harness.getRequest(empty), null, "UNEXPECTED_REQUEST_NOT_DELETED");
  // A note waiting on a deleted request finds it gone (404), so no note is ever orphaned.
  assert.equal((await addNote(empty, harness.identities.owner, { body: JANE_NOTE })).status, 404, "UNEXPECTED_NOTE_ON_DELETED_REQUEST");
  // A missing request keeps the core delete's answer (Strapi 5 answers 204 and deletes nothing), never REQUEST_HAS_NOTES.
  assert.equal((await deleteRequest("no-such-request", harness.identities.analyst)).status, 204, "UNEXPECTED_MISSING_DELETE_STATUS");
  assert.equal(await harness.countOrphanedRequestNotes(), 0, "UNEXPECTED_ORPHANED_NOTES");
});

test("a delete and a note create sent together are serialised and leave no orphan: the create wins and the delete is refused, or the delete wins and the create is 404 (D-21, T-13-22)", async () => {
  const harness = await harnessPromise;
  for (let round = 0; round < 3; round += 1) {
    const requestId = await seedRequest();
    const [deleted, created] = await harness.simultaneousRequests([
      { path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity: harness.identities.analyst, init: { method: "DELETE" } },
      { path: notesPath(requestId), identity: harness.identities.owner, init: post({ data: { body: JANE_NOTE } }) },
    ]);
    if (created.status === 200) {
      assert.equal(deleted.status, 409, `UNEXPECTED_RACE_DELETE_STATUS_${round}`);
      assert.ok(await harness.getRequest(requestId), `UNEXPECTED_RACE_REQUEST_GONE_${round}`);
      assert.equal((await harness.listRequestNotes(requestId)).length, 1, `UNEXPECTED_RACE_NOTE_MISSING_${round}`);
    } else {
      assert.equal(created.status, 404, `UNEXPECTED_RACE_CREATE_STATUS_${round}`);
      assert.ok(deleted.status >= 200 && deleted.status < 300, `UNEXPECTED_RACE_DELETE_FAILED_${round}_${deleted.status}`);
      assert.equal(await harness.getRequest(requestId), null, `UNEXPECTED_RACE_REQUEST_KEPT_${round}`);
    }
  }
  assert.equal(await harness.countOrphanedRequestNotes(), 0, "UNEXPECTED_RACE_ORPHANED_NOTES");
});

/*
 * Phase 13 D-29 (T-13-54): the request read carries the AI-inputs signal for each target to a human Security Analyst
 * only. With no questionnaire and no assessment yet there is no baseline, so both targets are null; every other reader,
 * the Requestor and the Security Analyst Agent included, gets null and no note identity.
 */
test("the request read carries the AI-inputs signal per target to human Security Analysts only (D-29)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const noteId = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  assert.equal((await setMark(requestId, noteId, harness.identities.analyst, true)).status, 200, "UNEXPECTED_MARK_STATUS");
  const read = async (identity: string) => harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity });

  for (const [label, identity] of [["BOB", harness.identities.analyst], ["SECOND_ANALYST", harness.identities.secondAnalyst]] as const) {
    const response = await read(identity);
    assert.equal(response.status, 200, `UNEXPECTED_${label}_REQUEST_READ_STATUS`);
    assert.deepEqual(((await json(response)).data as Json).aiInputs, { questionnaire: null, assessment: null }, `UNEXPECTED_${label}_AI_INPUTS`);
  }
  // WR-202: each reader's outcome is explicit. Jane reads her request with no signal; the two agent identities are
  // refused the read of another person's request (the matrix's OWNER_REQUEST_AGENT_DENIED_403), so no row is skipped.
  for (const [label, identity, status] of [
    ["JANE", harness.identities.owner, 200],
    ["AGENT", harness.identities.analystAgent, 403],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent, 403],
  ] as const) {
    const response = await read(identity);
    assert.equal(response.status, status, `UNEXPECTED_${label}_REQUEST_READ_STATUS`);
    const text = await response.text();
    if (status === 200) assert.equal((JSON.parse(text) as { data: Json }).data.aiInputs, null, `UNEXPECTED_${label}_AI_INPUTS`);
    assert.ok(!text.includes(noteId), `UNEXPECTED_${label}_SAW_THE_NOTE`);
  }
});

/*
 * WR-101 (G-1, D-26): an identity holding both the human Security Analyst role and the Security Analyst Agent role is
 * not an eligible person, so it never decides which free text reaches the AI provider: it is not offered the mark, and
 * setting it, later or when posting, is refused with nothing written. It still uses the thread as an analyst.
 */
test("an identity holding both the human analyst and the agent role is never offered the AI-input mark and cannot set it, later or when posting (WR-101, WR-102)", async () => {
  const harness = await harnessPromise;
  const dual = await harness.createUserFixture({
    email: "dual.role.notes@example.test", username: "dual-role-notes", displayName: "Dual Role Analyst", accountStatus: "active",
    roles: ["Security Analyst", "Security Analyst Agent"],
  });
  harness.registerTestIdentity("dual-role-notes", dual);
  const requestId = await seedRequest();
  const noteId = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));

  const listed = await listNotes(requestId, "dual-role-notes");
  assert.equal(listed.status, 200, "UNEXPECTED_DUAL_ROLE_LIST_STATUS");
  assert.equal(((await json(listed)).meta as Json).canMarkAiInputs, false, "UNEXPECTED_DUAL_ROLE_OFFERED_THE_MARK");
  await assertMarkRefused(requestId, noteId, "dual-role-notes", { data: { changesAiInputs: true } }, 403, undefined, "DUAL_ROLE_MARK");
  await assertAddRefused(requestId, "dual-role-notes", { body: "Mark this for the AI.", changesAiInputs: true }, 403, undefined, "DUAL_ROLE_MARK_AT_POSTING");
  assert.equal((await addNote(requestId, "dual-role-notes", { body: "A plain note." })).status, 200, "UNEXPECTED_DUAL_ROLE_PLAIN_NOTE_STATUS");
});

/*
 * WR-102 (D-26, D-30): the mark set at posting is guarded exactly as the mark operation is, by its own grant through the
 * human Security Analyst role, not by the notes grant. Were a later catalogue change to leave a role the notes grant
 * without the AI-input grant, that role could still post, but could neither set the mark when posting nor be offered it.
 */
test("the AI-input mark at posting needs the AI-input grant itself, not the notes grant (WR-102)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  await harness.withRoleOperationWithdrawn("Security Analyst", "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input", async () => {
    const listed = await listNotes(requestId, harness.identities.analyst);
    assert.equal(listed.status, 200, "UNEXPECTED_UNGRANTED_LIST_STATUS");
    assert.equal(((await json(listed)).meta as Json).canMarkAiInputs, false, "UNEXPECTED_UNGRANTED_OFFERED_THE_MARK");
    for (const value of [true, false]) {
      await assertAddRefused(requestId, harness.identities.analyst, { body: BOB_REPLY, changesAiInputs: value }, 403, undefined, `UNGRANTED_MARK_AT_POSTING_${value}`);
    }
    assert.equal((await addNote(requestId, harness.identities.analyst, { body: BOB_REPLY })).status, 200, "UNEXPECTED_UNGRANTED_PLAIN_NOTE_STATUS");
  });
  // With the grant back, the same analyst marks when posting.
  const marked = await addNote(requestId, harness.identities.analyst, { body: "For the AI.", changesAiInputs: true });
  assert.equal(marked.status, 200, "UNEXPECTED_GRANTED_MARK_AT_POSTING_STATUS");
});

/*
 * WR-103 (D-24): one unread rule feeds every count. A note whose author link is gone (the IdamBox User behind it removed:
 * there is no inverse attribute, so the link row goes and the note stays) is by definition not the viewer's, so it is new
 * on its own row, and every count agrees: the thread's meta, the request read's summary, the review queue's flag and
 * notes=unread filter, and My requests' flag and filter.
 */
test("a note whose author link is gone is new on its row and counted as new everywhere (WR-103, D-24)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const requestNumber = String((await harness.getRequest(requestId))?.requestNumber);
  const janeNote = await noteIdOf(await addNote(requestId, harness.identities.owner, { body: JANE_NOTE }));
  const bobNote = await noteIdOf(await addNote(requestId, harness.identities.analyst, { body: BOB_REPLY }));
  for (const noteId of [janeNote, bobNote]) await harness.updateFixtureDocument(NOTE_UID, noteId, { author: null });
  assert.deepEqual((await harness.listRequestNotes(requestId)).map((note) => note.author ?? null), [null, null], "UNEXPECTED_AUTHOR_LINK_KEPT");

  for (const [label, identity, othersNote] of [["BOB", harness.identities.analyst, janeNote], ["JANE", harness.identities.owner, bobNote]] as const) {
    const thread = await json(await listNotes(requestId, identity));
    assert.deepEqual((thread.data as Json[]).filter((note) => note.unread === true).map((note) => note.documentId), [othersNote], `UNEXPECTED_${label}_ROW_FLAGS`);
    assert.equal((thread.meta as Json).unread, 1, `UNEXPECTED_${label}_THREAD_UNREAD`);
    assert.equal((await notesSummary(requestId, identity) as Json).unread, 1, `UNEXPECTED_${label}_REQUEST_READ_UNREAD`);
  }

  const queueRows = async (query: string) => {
    const response = await harness.request({ path: `/api/v1/assessment_requests?filters[requestNumber]=${encodeURIComponent(requestNumber)}&filters[queue]=all${query}`, identity: harness.identities.analyst });
    assert.equal(response.status, 200, `UNEXPECTED_QUEUE_STATUS${query}`);
    return ((await json(response)).data as Json[]).map((row) => [row.documentId, row.unreadNotes]);
  };
  assert.deepEqual(await queueRows(""), [[requestId, 1]], "UNEXPECTED_QUEUE_UNREAD");
  assert.deepEqual(await queueRows("&filters[notes]=unread"), [[requestId, 1]], "UNEXPECTED_QUEUE_NOTES_FILTER");

  const myRows = async (query: string) => {
    const response = await harness.request({ path: `/api/v1/my_requests?q=${encodeURIComponent(requestNumber)}&pageSize=50${query}`, identity: harness.identities.owner });
    assert.equal(response.status, 200, `UNEXPECTED_MY_REQUESTS_STATUS${query}`);
    return ((await json(response)).data as Json[]).map((row) => [row.documentId, row.unreadNotes]);
  };
  assert.deepEqual(await myRows(""), [[requestId, 1]], "UNEXPECTED_MY_REQUESTS_UNREAD");
  assert.deepEqual(await myRows("&notes=unread"), [[requestId, 1]], "UNEXPECTED_MY_REQUESTS_NOTES_FILTER");
});

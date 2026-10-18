import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 15 (15-07; QUES-11 criterion 2, QUES-12 criteria 2 and 3): a Security Analyst decides each AI proposal on its
 * own. Confirming applies it through the manual edit's rules inside the questionnaire's governance lock; rejecting,
 * restoring and the Undo of a confirmation are recorded on the run; nothing reaches the Requestor until a release, and
 * no decision changes an answered question. The route arrives in 15-09, so the mounted service is driven through the
 * harness, as 15-06 drove the jobs. Every case seeds its own request.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

type Harness = Awaited<typeof harnessPromise>;
type Json = Record<string, unknown>;

/* Jane's note, which Bob marks as changing the AI inputs: the deterministic provider's rule W1 reads `offshore`. */
const OFFSHORE_NOTE = "Jane: the vendor now uses an offshore support team with administrator access to the payroll system.";
const COUNTRY_QUESTION = "In which country or countries is the offshore support team based?";
const ADMIN_QUESTION = "Will the offshore support team have administrator access to your systems?";
const APPROVAL_QUESTION = "How is the offshore team's administrator access approved and logged?";

async function questionnaireRequest(harness: Harness, path: string, identity: string, method: string, body?: unknown): Promise<Response> {
  return harness.request({ path, identity, init: { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) } });
}

const questionnairePath = (questionnaireId: string) => `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;

async function returnToReview(harness: Harness, questionnaireId: string): Promise<void> {
  const returned = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/return_to_review`, harness.identities.analyst, "POST", { reason: "Add the offshore support questions." });
  assert.equal(returned.status, 200, `RETURN_TO_REVIEW_FAILED: ${await returned.clone().text()}`);
}

async function release(harness: Harness, questionnaireId: string): Promise<void> {
  const released = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/release`, harness.identities.analyst, "POST");
  assert.equal(released.status, 200, `RELEASE_FAILED: ${await released.clone().text()}`);
}

/* Jane's offshore-support note, marked as changing the AI inputs (Phase 13 D-27). */
async function markOffshoreNote(harness: Harness, requestId: string): Promise<void> {
  await harness.seedRequestNotes(requestId, [
    { part: "requestor", sequence: 1, postedAt: "2026-09-01T00:00:00.000Z", body: OFFSHORE_NOTE, changesAiInputs: true },
  ]);
}

async function proposeAndWait(harness: Harness, analystId: string, questionnaireId: string, body?: unknown): Promise<string> {
  const started = await harness.startQuestionnaireProposalsFixture(analystId, questionnaireId, body);
  assert.equal(started.status, 202, `PROPOSALS_NOT_STARTED: ${JSON.stringify(started)}`);
  const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  assert.equal(ended.status, "completed", `JOB_NOT_COMPLETED: ${JSON.stringify(ended.failure)}`);
  return String(ended.runId);
}

async function rewriteAndWait(harness: Harness, analystId: string, questionnaireId: string, questionId: string, body?: unknown): Promise<string> {
  const started = await harness.startQuestionRewriteFixture(analystId, questionnaireId, questionId, body);
  assert.equal(started.status, 202, `REWRITE_NOT_STARTED: ${JSON.stringify(started)}`);
  const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  assert.equal(ended.status, "completed", `REWRITE_NOT_COMPLETED: ${JSON.stringify(ended.failure)}`);
  return String(ended.runId);
}

/*
 * Jane's UAT-A-like questionnaire, released and submitted, with her marked offshore note; Bob's offshore proposal run
 * (three additions in a new section "Offshore support"); then Bob returns the questionnaire to analyst review.
 */
async function seedOffshoreReview(harness: Harness, label: string): Promise<{ requestId: string; questionnaireId: string; runId: string }> {
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  await markOffshoreNote(harness, requestId);
  const runId = await proposeAndWait(harness, harness.users.analyst, questionnaireId);
  await returnToReview(harness, questionnaireId);
  return { requestId, questionnaireId, runId };
}

test("BE03: an AI addition undone before release is absent from Requestor reads and saves, while analysts retain it", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "BE03-PRIVATE-UNDO");
  const decision = (item: string, action: string) => ({ runId, item, action });
  for (const decisions of [[decision("i-1", "accept")], [decision("i-1", "restore")], [decision("i-1", "reject"), decision("i-2", "reject"), decision("i-3", "reject")]]) {
    assert.equal((await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions })).status, 200);
  }
  await release(harness, questionnaireId);
  const analyst = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions`, harness.identities.analyst, "GET");
  assert.ok((await analyst.text()).includes(COUNTRY_QUESTION), "ANALYST_HISTORY_LOST");
  const owner = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions`, harness.identities.owner, "GET");
  assert.equal(owner.status, 200);
  const ownerText = await owner.text();
  assert.ok(!ownerText.includes(COUNTRY_QUESTION), "UNRELEASED_QUESTION_DISCLOSED");
  assert.ok(!ownerText.includes("Name every country where the offshore support team works."), "UNRELEASED_HELP_DISCLOSED");
  const saved = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/answers`, harness.identities.owner, "PATCH", { answers: [] });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.ok(!(await saved.text()).includes(COUNTRY_QUESTION), "UNRELEASED_QUESTION_IN_SAVE");
});

async function questionRows(harness: Harness, questionnaireId: string): Promise<Json[]> {
  return ((await harness.getQuestionnaire(questionnaireId))?.questions ?? []) as Json[];
}

async function questionByText(harness: Harness, questionnaireId: string, text: string): Promise<Json> {
  const row = (await questionRows(harness, questionnaireId)).find((question) => question.questionText === text);
  assert.ok(row, `QUESTION_NOT_FOUND: ${text}`);
  return row;
}

async function governanceLog(harness: Harness, questionnaireId: string): Promise<Json[]> {
  return ((await harness.getQuestionnaire(questionnaireId))?.governanceLog ?? []) as Json[];
}

async function runDecisions(harness: Harness, runId: string): Promise<Json[]> {
  return ((await harness.getAiRun(runId))?.decisions ?? []) as Json[];
}

const options = (row: Json): Json => row.options as Json;

/* 15-07 Task 1 (the tracer): one confirmed proposal becomes one new, unanswered question, recorded in the run and on the timeline. */

test("Bob confirms one proposed question: a new unanswered question in a new Offshore support section, one accepted decision on the run and one question-added entry; repeating it changes nothing (D-13, D-21, D-22, D-26)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-TRACER");
  const rowsBefore = await questionRows(harness, questionnaireId);
  const logBefore = await governanceLog(harness, questionnaireId);
  const keysBefore = new Set(rowsBefore.map((row) => options(row).questionKey));

  const decided = await harness.decideQuestionnaireProposalsFixture(bob, questionnaireId, { decisions: [{ runId, item: "i-1", action: "accept" }] });
  assert.equal(decided.status, 200, `DECISION_REFUSED: ${JSON.stringify(decided)}`);
  assert.deepEqual(decided.data, { applied: 1, unchanged: 0 });

  const rowsAfter = await questionRows(harness, questionnaireId);
  assert.equal(rowsAfter.length, rowsBefore.length + 1, "NOT_ONE_NEW_QUESTION");
  for (const before of rowsBefore) {
    const after = rowsAfter.find((row) => row.documentId === before.documentId) as Json;
    assert.deepEqual([after.questionText, after.helpText, after.options, after.answer], [before.questionText, before.helpText, before.options, before.answer], `EXISTING_QUESTION_CHANGED: ${String(before.questionText)}`);
  }
  const added = rowsAfter.find((row) => !rowsBefore.some((before) => before.documentId === row.documentId)) as Json;
  assert.equal(added.questionText, COUNTRY_QUESTION);
  assert.equal(added.helpText, "Name every country where the offshore support team works.");
  assert.equal(added.answerType, "Text");
  assert.equal(added.answer ?? null, null, "CONFIRMATION_WROTE_AN_ANSWER");
  const addedOptions = options(added);
  assert.deepEqual(addedOptions.section, { key: "section-offshore-support", title: "Offshore support", order: 2 }, "NOT_A_NEW_SECTION_AFTER_THE_LAST");
  assert.equal(addedOptions.order, 0, "NOT_FIRST_IN_ITS_NEW_SECTION");
  assert.equal(typeof addedOptions.questionKey, "string");
  assert.ok(!keysBefore.has(addedOptions.questionKey), "QUESTION_KEY_NOT_UNIQUE");
  assert.equal(addedOptions.deleted, undefined);

  const decisions = await runDecisions(harness, runId);
  assert.equal(decisions.length, 1, "NOT_ONE_DECISION_EVENT");
  const [event] = decisions;
  assert.equal(event.schemaVersion, 2);
  assert.equal(event.action, "accepted");
  assert.equal(event.item, "i-1");
  assert.equal(event.by, bob);
  assert.equal((event.applied as Json).questionDocumentId, added.documentId, "APPLIED_DOES_NOT_NAME_THE_NEW_QUESTION");
  assert.equal((event.applied as Json).questionKey, addedOptions.questionKey);
  assert.match(String((event.applied as Json).fingerprint), /^sha256:[0-9a-f]{64}$/);
  assert.equal(event.edits, undefined, "UNEDITED_CONFIRMATION_RECORDS_EDITS");

  const log = await governanceLog(harness, questionnaireId);
  assert.equal(log.length, logBefore.length + 1, "NOT_ONE_TIMELINE_ENTRY");
  const entry = log.at(-1) as Json;
  assert.deepEqual({ ...entry, at: undefined }, {
    schemaVersion: 1, kind: "question-added", at: undefined, by: bob, questionKey: addedOptions.questionKey, questionText: COUNTRY_QUESTION,
    runId, itemKey: "i-1", aiEdited: false,
  }, "UNEXPECTED_QUESTION_ADDED_EVENT");
  assert.equal((await harness.getQuestionnaire(questionnaireId))?.releasedAt ?? null, null, "CONFIRMATION_RELEASED_THE_QUESTIONNAIRE");

  const snapshot = await harness.questionnaireSnapshotFixture(questionnaireId);
  const repeated = await harness.decideQuestionnaireProposalsFixture(bob, questionnaireId, { decisions: [{ runId, item: "i-1", action: "accept" }] });
  assert.equal(repeated.status, 200, `REPEAT_REFUSED: ${JSON.stringify(repeated)}`);
  assert.deepEqual(repeated.data, { applied: 0, unchanged: 1 });
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), snapshot, "REPEAT_CHANGED_PERSISTENCE");
});

/* 15-07 Task 2: changes, removals, edit then confirm, reject, Undo, staleness and the batch rules. */

const MFA_QUESTION = "Is MFA enforced for privileged and federated identities, including break-glass accounts?";
const LOGGING_QUESTION = "Is audit logging enabled for payroll changes?";
const PAYMENT_SECTION = { key: "payment", title: "Payment processing", order: 1 };
const W2_INSTRUCTION = "Remove the audit logging question, and use plain language.";

const refusal = (response: { status: number; reason?: string }) => ({ status: response.status, ...(response.reason ? { reason: response.reason } : {}) });

async function addQuestion(harness: Harness, questionnaireId: string, body: Json): Promise<string> {
  const added = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions`, harness.identities.analyst, "POST", body);
  assert.equal(added.status, 200, `QUESTION_NOT_ADDED: ${await added.clone().text()}`);
  return String((await questionByText(harness, questionnaireId, String(body.questionText))).documentId);
}

/*
 * Jane's UAT-A-like questionnaire returned to analyst review (her answers drafts again), with two questions Bob added that
 * nobody answered: the MFA question rule R1 rewrites, and the audit logging question W2 removes.
 */
async function seedAnalystReview(harness: Harness, label: string): Promise<{ requestId: string; questionnaireId: string; mfaId: string; loggingId: string }> {
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  await returnToReview(harness, questionnaireId);
  const mfaId = await addQuestion(harness, questionnaireId, { questionText: MFA_QUESTION, answerType: "Long text", required: false, section: PAYMENT_SECTION, order: 5 });
  const loggingId = await addQuestion(harness, questionnaireId, { questionText: LOGGING_QUESTION, answerType: "Long text", required: false, section: PAYMENT_SECTION, order: 6 });
  return { requestId, questionnaireId, mfaId, loggingId };
}

test("BE04: a removal and Undo preserve valid duplicate-label manual choices exactly", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, loggingId } = await seedAnalystReview(harness, "BE04-MANUAL-CHOICES");
  const logging = await questionByText(harness, questionnaireId, LOGGING_QUESTION);
  await harness.updateFixtureDocument("api::csrm-question.csrm-question", loggingId, { answerType: "Single select", options: { ...options(logging), choices: [{ value: "a", label: "Other" }, { value: "b", label: "Other" }] } });
  const before = await questionByText(harness, questionnaireId, LOGGING_QUESTION);
  const runId = await proposeAndWait(harness, harness.users.analyst, questionnaireId, { instruction: W2_INSTRUCTION });
  const item = await itemOf(harness, runId, "remove", loggingId);
  await expectApplied(harness, questionnaireId, [{ runId, item: item.key, action: "accept" }]);
  await expectApplied(harness, questionnaireId, [{ runId, item: item.key, action: "restore" }]);
  const restored = await questionByText(harness, questionnaireId, LOGGING_QUESTION);
  assert.deepEqual([restored.questionText, restored.helpText, restored.answerType, restored.options, restored.answer], [before.questionText, before.helpText, before.answerType, before.options, before.answer]);
});

test("BE08: near-cap and exact-cap decision batches fail safely and atomically with HISTORY_UNAVAILABLE", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "BE08-CAPACITY");
  const events = Array.from({ length: 5000 }, (_, index) => ({ schemaVersion: 2, at: "2026-10-13T00:00:00.000Z", by: harness.users.analyst, item: "i-1", action: index % 2 === 0 ? "rejected" : "restored" }));
  await harness.updateFixtureDocument("api::csrm-ai-run.csrm-ai-run", runId, { decisions: events.slice(0, 4999) });
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "restore" }, { runId, item: "i-2", action: "reject" }], { status: 409, reason: "HISTORY_UNAVAILABLE" });
  await harness.updateFixtureDocument("api::csrm-ai-run.csrm-ai-run", runId, { decisions: events });
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "reject" }], { status: 409, reason: "HISTORY_UNAVAILABLE" });
});

/* The run's stored item of this kind (and target), as the proposal holds it. */
async function itemOf(harness: Harness, runId: string, kind: string, targetId?: string): Promise<Json> {
  const items = (((await harness.getAiRun(runId))?.proposal as Json).items ?? []) as Json[];
  const item = items.find((entry) => entry.kind === kind && (targetId === undefined || (entry.target as Json | undefined)?.questionDocumentId === targetId));
  assert.ok(item, `ITEM_NOT_FOUND: ${kind} ${targetId ?? ""} in ${JSON.stringify(items.map((entry) => entry.kind))}`);
  return item;
}

async function decide(harness: Harness, questionnaireId: string, decisions: Json[], analystId = harness.users.analyst) {
  return harness.decideQuestionnaireProposalsFixture(analystId, questionnaireId, { decisions });
}

async function expectApplied(harness: Harness, questionnaireId: string, decisions: Json[], expected = { applied: decisions.length, unchanged: 0 }): Promise<void> {
  const decided = await decide(harness, questionnaireId, decisions);
  assert.equal(decided.status, 200, `DECISION_REFUSED: ${JSON.stringify(decided)}`);
  assert.deepEqual(decided.data, expected);
}

/* A refusal leaves every question, answer, the release fact, the log and every run's decisions deep-equal. */
async function expectRefused(harness: Harness, questionnaireId: string, decisions: unknown, expected: { status: number; reason?: string }, analystId = harness.users.analyst): Promise<void> {
  const before = await harness.questionnaireSnapshotFixture(questionnaireId);
  const decided = await harness.decideQuestionnaireProposalsFixture(analystId, questionnaireId, { decisions });
  assert.deepEqual(refusal(decided), expected, `UNEXPECTED_REFUSAL: ${JSON.stringify(decided)}`);
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), before, `REFUSAL_${expected.reason ?? expected.status}_NOT_DEEP-EQUAL`);
}

test("a confirmed change rewrites text and help text only, writes question-edited with its source and no answer-cleared, and records before; its Undo puts it back with aiUndo (D-22, D-23, D-26)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, mfaId } = await seedAnalystReview(harness, "DECIDE-CHANGE");
  const runId = await proposeAndWait(harness, bob, questionnaireId, { instruction: W2_INSTRUCTION });
  const change = await itemOf(harness, runId, "change", mfaId);
  const proposed = change.proposed as Json;
  const before = await harness.getQuestion(mfaId) as Json;
  const logBefore = await governanceLog(harness, questionnaireId);

  await expectApplied(harness, questionnaireId, [{ runId, item: change.key, action: "accept" }]);
  const after = await harness.getQuestion(mfaId) as Json;
  assert.equal(after.questionText, proposed.questionText);
  assert.equal(after.helpText, proposed.helpText);
  assert.equal(after.answerType, before.answerType);
  assert.deepEqual(options(after), options(before), "CHANGE_MOVED_OR_RETYPED_THE_QUESTION");
  assert.deepEqual(after.answer ?? null, before.answer ?? null, "CHANGE_WROTE_AN_ANSWER");
  const added = (await governanceLog(harness, questionnaireId)).slice(logBefore.length);
  assert.deepEqual(added.map((entry) => entry.kind), ["question-edited"], "NOT_ONE_QUESTION_EDITED_AND_NO_ANSWER_CLEARED");
  assert.deepEqual({ ...added[0], at: undefined }, { schemaVersion: 1, kind: "question-edited", at: undefined, by: bob, questionKey: options(before).questionKey, questionText: proposed.questionText, runId, itemKey: change.key, aiEdited: false });
  const accepted = (await runDecisions(harness, runId)).at(-1) as Json;
  assert.equal(accepted.action, "accepted");
  assert.deepEqual((accepted.before as Json).questionText, MFA_QUESTION, "ACCEPT_OF_A_CHANGE_HAS_NO_BEFORE");
  assert.equal((accepted.before as Json).questionDocumentId, mfaId);

  await expectApplied(harness, questionnaireId, [{ runId, item: change.key, action: "restore" }]);
  const undone = await harness.getQuestion(mfaId) as Json;
  assert.deepEqual([undone.questionText, undone.helpText ?? null, options(undone)], [before.questionText, before.helpText ?? null, options(before)], "UNDO_DID_NOT_PUT_THE_QUESTION_BACK");
  const reverse = (await governanceLog(harness, questionnaireId)).at(-1) as Json;
  assert.deepEqual({ ...reverse, at: undefined }, { schemaVersion: 1, kind: "question-edited", at: undefined, by: bob, questionKey: options(before).questionKey, questionText: MFA_QUESTION, runId, itemKey: change.key, aiEdited: false, aiUndo: true });
  const restored = (await runDecisions(harness, runId)).at(-1) as Json;
  assert.equal(restored.action, "restored");
  assert.deepEqual(restored.applied, accepted.applied, "RESTORE_DOES_NOT_NAME_WHAT_IT_UNDID");
});

test("edit, then confirm: an addition confirmed with an edited question text records edits and aiEdited; its Undo soft-removes the question with question-deleted and aiUndo; after a manual edit its Undo is AI_PROPOSAL_UNDO_UNAVAILABLE (D-22, D-23)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-EDITED");
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-1", action: "accept", edits: { questionText: "Where is the team based?" } }]);
  const added = await questionByText(harness, questionnaireId, "Where is the team based?");
  const accepted = (await runDecisions(harness, runId)).at(-1) as Json;
  assert.deepEqual(accepted.edits, ["questionText"]);
  const addedEvent = (await governanceLog(harness, questionnaireId)).at(-1) as Json;
  assert.equal(addedEvent.kind, "question-added");
  assert.equal(addedEvent.aiEdited, true);
  assert.equal(addedEvent.questionText, "Where is the team based?");

  await expectApplied(harness, questionnaireId, [{ runId, item: "i-1", action: "restore" }]);
  assert.ok(options(await harness.getQuestion(String(added.documentId)) as Json).deleted, "UNDO_DID_NOT_REMOVE_THE_ADDED_QUESTION");
  const reverse = (await governanceLog(harness, questionnaireId)).at(-1) as Json;
  assert.deepEqual({ ...reverse, at: undefined }, { schemaVersion: 1, kind: "question-deleted", at: undefined, by: bob, questionKey: options(added).questionKey, questionText: "Where is the team based?", runId, itemKey: "i-1", aiEdited: true, aiUndo: true });

  // Confirmed again (the item is open after the Undo), then changed by hand: the Undo is no longer safe.
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-2", action: "accept" }]);
  const admin = await questionByText(harness, questionnaireId, ADMIN_QUESTION);
  const edited = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions/${encodeURIComponent(String(admin.documentId))}`, harness.identities.analyst, "PATCH", { helpText: "Edited by hand." });
  assert.equal(edited.status, 200, `MANUAL_EDIT_FAILED: ${await edited.clone().text()}`);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-2", action: "restore" }], { status: 409, reason: "AI_PROPOSAL_UNDO_UNAVAILABLE" });
});

test("a confirmed removal soft-removes the unanswered question and its Undo writes question-restored; LAST_ACTIVE_QUESTION and QUESTION_HAS_DEPENDENTS are refused deep-equal (D-22, D-23)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, loggingId } = await seedAnalystReview(harness, "DECIDE-REMOVE");
  const runId = await proposeAndWait(harness, bob, questionnaireId, { instruction: W2_INSTRUCTION });
  const removal = await itemOf(harness, runId, "remove", loggingId);
  await expectApplied(harness, questionnaireId, [{ runId, item: removal.key, action: "accept" }]);
  const removed = await harness.getQuestion(loggingId) as Json;
  assert.equal((options(removed).deleted as Json).deletedBy, bob, "REMOVAL_NOT_SOFT");
  assert.equal(((await governanceLog(harness, questionnaireId)).at(-1) as Json).kind, "question-deleted");

  await expectApplied(harness, questionnaireId, [{ runId, item: removal.key, action: "restore" }]);
  assert.equal(options(await harness.getQuestion(loggingId) as Json).deleted, undefined, "UNDO_DID_NOT_RESTORE_THE_QUESTION");
  const restoredEvent = (await governanceLog(harness, questionnaireId)).at(-1) as Json;
  assert.deepEqual({ ...restoredEvent, at: undefined }, { schemaVersion: 1, kind: "question-restored", at: undefined, by: bob, questionKey: options(removed).questionKey, questionText: LOGGING_QUESTION, runId, itemKey: removal.key, aiEdited: false, aiUndo: true });

  // Every other question removed by hand: the logging question is the last active one.
  for (const row of await questionRows(harness, questionnaireId)) {
    if (row.documentId === loggingId || options(row).deleted) continue;
    const deleted = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions/${encodeURIComponent(String(row.documentId))}`, harness.identities.analyst, "DELETE");
    assert.equal(deleted.status, 200, `MANUAL_DELETE_FAILED: ${await deleted.clone().text()}`);
  }
  await expectRefused(harness, questionnaireId, [{ runId, item: removal.key, action: "accept" }], { status: 409, reason: "LAST_ACTIVE_QUESTION" });

  // A controller that gained a dependent after the proposal.
  const dependents = await seedAnalystReview(harness, "DECIDE-DEPENDENTS");
  const dependentRun = await proposeAndWait(harness, bob, dependents.questionnaireId, { instruction: W2_INSTRUCTION });
  const controllerRemoval = await itemOf(harness, dependentRun, "remove", dependents.loggingId);
  const controllerKey = String(options(await harness.getQuestion(dependents.loggingId) as Json).questionKey);
  await addQuestion(harness, dependents.questionnaireId, { questionText: "Who reviews the audit log?", answerType: "Text", required: false, section: PAYMENT_SECTION, order: 7, visibility: { questionKey: controllerKey, operator: "notEquals", value: "" } });
  await expectRefused(harness, dependents.questionnaireId, [{ runId: dependentRun, item: controllerRemoval.key, action: "accept" }], { status: 409, reason: "QUESTION_HAS_DEPENDENTS" });
});

test("reject with a reason appends a rejected event and no governance event; restoring it returns the item to open (D-21, D-23)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-REJECT");
  const logBefore = await governanceLog(harness, questionnaireId);
  const rowsBefore = await questionRows(harness, questionnaireId);
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-3", action: "reject", reason: "Already covered by section 2" }]);
  const rejected = (await runDecisions(harness, runId)).at(-1) as Json;
  assert.deepEqual([rejected.action, rejected.item, rejected.reason], ["rejected", "i-3", "Already covered by section 2"]);
  assert.deepEqual(await governanceLog(harness, questionnaireId), logBefore, "REJECT_WROTE_A_GOVERNANCE_EVENT");
  assert.deepEqual(await questionRows(harness, questionnaireId), rowsBefore, "REJECT_CHANGED_THE_QUESTIONNAIRE");
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-3", action: "restore" }]);
  const restored = (await runDecisions(harness, runId)).at(-1) as Json;
  assert.deepEqual([restored.action, restored.applied], ["restored", undefined]);
  assert.deepEqual(await governanceLog(harness, questionnaireId), logBefore, "RESTORE_OF_A_REJECTION_WROTE_A_GOVERNANCE_EVENT");
  // Open again: it can be confirmed.
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-3", action: "accept" }]);
});

test("QUESTIONNAIRE_RELEASED before staleness: on a released questionnaire, accepting an item whose target Jane answered in draft is QUESTIONNAIRE_RELEASED while reject succeeds; with an assessment every action is ASSESSMENT_STARTED (D-06, D-07; T-15-23)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, mfaId } = await seedAnalystReview(harness, "DECIDE-RELEASED");
  // Since 15-08 a release waits for every proposal, so the rewrite is asked for on the submitted questionnaire (D-06).
  await release(harness, questionnaireId);
  const submitted = await harness.submitQuestionnaireServiceFixture(harness.users.owner, questionnaireId);
  assert.equal(submitted.status, 200, `JANE_SUBMIT_FAILED: ${JSON.stringify(submitted)}`);
  const runId = await rewriteAndWait(harness, bob, questionnaireId, mfaId);
  const reverted = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/revert_to_draft`, harness.identities.owner, "POST", { reason: "Answer the MFA question." });
  assert.equal(reverted.status, 200, `JANE_REVERT_FAILED: ${await reverted.clone().text()}`);
  const mfaKey = String(options(await harness.getQuestion(mfaId) as Json).questionKey);
  const saved = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/answers`, harness.identities.owner, "PATCH", { answers: [{ questionKey: mfaKey, value: "Yes, for every administrator." }] });
  assert.equal(saved.status, 200, `JANE_DRAFT_NOT_SAVED: ${await saved.clone().text()}`);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }], { status: 409, reason: "QUESTIONNAIRE_RELEASED" });
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-1", action: "reject" }]);

  const assessed = await seedOffshoreReview(harness, "DECIDE-ASSESSED");
  await expectApplied(harness, assessed.questionnaireId, [{ runId: assessed.runId, item: "i-1", action: "reject" }]);
  await harness.createAssessmentFixture({ assessmentNumber: "ASSESS-DECISIONS-STATE", assessmentStatus: "draft", assessmentRequest: assessed.requestId });
  for (const decision of [{ item: "i-2", action: "accept" }, { item: "i-2", action: "reject" }, { item: "i-1", action: "restore" }]) {
    await expectRefused(harness, assessed.questionnaireId, [{ runId: assessed.runId, ...decision }], { status: 409, reason: "ASSESSMENT_STARTED" });
  }
});

test("AI_PROPOSAL_STALE: an item whose target was edited by hand is stale, and of two items on one question confirming one makes the other stale in the same batch, refused deep-equal (D-20, D-25)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, mfaId } = await seedAnalystReview(harness, "DECIDE-STALE");
  const wideRun = await proposeAndWait(harness, bob, questionnaireId, { instruction: W2_INSTRUCTION });
  const rewriteRun = await rewriteAndWait(harness, bob, questionnaireId, mfaId);
  const wideChange = await itemOf(harness, wideRun, "change", mfaId);
  await expectRefused(harness, questionnaireId, [{ runId: wideRun, item: wideChange.key, action: "accept" }, { runId: rewriteRun, item: "i-1", action: "accept" }], { status: 409, reason: "AI_PROPOSAL_STALE" });

  const edited = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/questions/${encodeURIComponent(mfaId)}`, harness.identities.analyst, "PATCH", { helpText: "Edited by hand." });
  assert.equal(edited.status, 200, `MANUAL_EDIT_FAILED: ${await edited.clone().text()}`);
  await expectRefused(harness, questionnaireId, [{ runId: rewriteRun, item: "i-1", action: "accept" }], { status: 409, reason: "AI_PROPOSAL_STALE" });
  // A stale item can still be rejected.
  await expectApplied(harness, questionnaireId, [{ runId: rewriteRun, item: "i-1", action: "reject" }]);
});

test("the batch: another questionnaire's run is a 404 for the whole batch; an unknown item is 400; 201 decisions are 400; all deep-equal (D-21, D-24; T-15-24)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-BATCH");
  const other = await seedOffshoreReview(harness, "DECIDE-BATCH-OTHER");
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }, { runId: other.runId, item: "i-1", action: "accept" }], { status: 404 });
  await expectRefused(harness, questionnaireId, [{ runId: "no-such-run", item: "i-1", action: "reject" }], { status: 404 });
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-9", action: "accept" }], { status: 400 });
  await expectRefused(harness, questionnaireId, Array.from({ length: 201 }, () => ({ runId, item: "i-1", action: "reject" })), { status: 400 });
  for (const malformed of [[], [{ runId, item: "i-1", action: "confirm" }], [{ runId, item: "i-1", action: "reject", edits: { questionText: "x" } }], [{ runId, item: "i-1", action: "accept", reason: "x" }], [{ runId, item: "i-1", action: "accept", edits: { questionKey: "x" } }]]) {
    await expectRefused(harness, questionnaireId, malformed, { status: 400 });
  }
});

test("AI_PROPOSAL_ALREADY_DECIDED: a second analyst rejecting an item Bob confirmed, a superseded item, a lapsed item and a damaged run's items are refused deep-equal (D-21, D-24)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-ALREADY");
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }]);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "reject" }], { status: 409, reason: "AI_PROPOSAL_ALREADY_DECIDED" }, harness.users.secondAnalyst);

  const rewrites = await seedAnalystReview(harness, "DECIDE-SUPERSEDED");
  const older = await rewriteAndWait(harness, bob, rewrites.questionnaireId, rewrites.mfaId);
  await rewriteAndWait(harness, bob, rewrites.questionnaireId, rewrites.mfaId);
  assert.equal(((await runDecisions(harness, older)).at(-1) as Json).action, "superseded", "OLDER_REWRITE_NOT_SUPERSEDED");
  await expectRefused(harness, rewrites.questionnaireId, [{ runId: older, item: "i-1", action: "accept" }], { status: 409, reason: "AI_PROPOSAL_ALREADY_DECIDED" });

  await harness.appendAiRunDecisionsFixture(runId, [{ schemaVersion: 2, at: new Date().toISOString(), by: "system", item: "i-2", action: "lapsed", cause: { kind: "questionnaire-frozen" } } as never]);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-2", action: "accept" }], { status: 409, reason: "AI_PROPOSAL_ALREADY_DECIDED" });

  const damaged = await seedOffshoreReview(harness, "DECIDE-DAMAGED");
  await harness.updateAiRunFixture(damaged.runId, { decisions: [{ schemaVersion: 2, at: "not-a-time", by: bob, item: "i-1", action: "accepted" }] });
  for (const action of ["accept", "reject", "restore"]) {
    await expectRefused(harness, damaged.questionnaireId, [{ runId: damaged.runId, item: "i-3", action }], { status: 409, reason: "AI_PROPOSAL_ALREADY_DECIDED" });
  }
});

test("ANSWERED_QUESTION_AFFECTED: a confirmed change that would hide an answered dependent is refused deep-equal (D-05 layer 3; QUES-12 criterion 2)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { questionnaireId } = await seedAnalystReview(harness, "DECIDE-HIDDEN");
  const controllerText = "Do privileged users sign in with MFA?";
  const controllerId = await addQuestion(harness, questionnaireId, { questionText: controllerText, answerType: "Single select", required: false, section: PAYMENT_SECTION, order: 7, choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] });
  const controllerKey = String(options(await harness.getQuestion(controllerId) as Json).questionKey);
  const dependentId = await addQuestion(harness, questionnaireId, { questionText: "Which second step do they use?", answerType: "Text", required: false, section: PAYMENT_SECTION, order: 8, visibility: { questionKey: controllerKey, operator: "notEquals", value: "no" } });
  await harness.updateFixtureDocument("api::csrm-question.csrm-question", dependentId, { answer: { schemaVersion: 1, value: "An authenticator app", state: "draft", updatedAt: "2026-09-02T00:00:00.000Z" } });
  const runId = await rewriteAndWait(harness, bob, questionnaireId, controllerId);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "accept", edits: { choices: [{ value: "maybe", label: "Maybe" }, { value: "yes", label: "Yes" }] } }], { status: 409, reason: "ANSWERED_QUESTION_AFFECTED" });
});

test("OWN_REQUEST: Bob deciding on a request he raised is refused 403 deep-equal (D-32, G-1)", async () => {
  const harness = await harnessPromise;
  const { requestId, questionnaireId, runId } = await seedOffshoreReview(harness, "DECIDE-OWN");
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, { requestor: harness.users.analyst });
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }], { status: 403, reason: "OWN_REQUEST" });
  await expectRefused(harness, questionnaireId, [{ runId: "no-such-run", item: "i-1", action: "reject" }], { status: 403, reason: "OWN_REQUEST" });
  // The second analyst decides on Bob's request (D-32).
  const decided = await decide(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }], harness.users.secondAnalyst);
  assert.deepEqual([decided.status, decided.data], [200, { applied: 1, unchanged: 0 }], `SECOND_ANALYST_REFUSED: ${JSON.stringify(decided)}`);
});

/* 15-07 Task 3: the Requestor's in-transaction release re-check, and answers across confirmations and a release. */

/* Every answered question as stored: its own fields and its answer. */
async function answeredRows(harness: Harness, questionnaireId: string): Promise<Json[]> {
  return (await questionRows(harness, questionnaireId))
    .filter((row) => { const answer = row.answer as Json | null; return answer && answer.value !== null && answer.value !== ""; })
    .map((row) => ({ documentId: row.documentId, questionText: row.questionText, helpText: row.helpText ?? null, answerType: row.answerType, options: row.options, answer: row.answer }))
    .sort((left, right) => String(left.documentId).localeCompare(String(right.documentId)));
}

test("QUESTIONNAIRE_NOT_ANSWERABLE: once Bob returns the released questionnaire to analyst review, Jane's save and submit, called at the service past the policy, are refused with the served message and persistence stays deep-equal; before the return both work (D-25; T-15-25)", async () => {
  const harness = await harnessPromise;
  const jane = harness.users.owner;
  const { questionnaireId } = await harness.seedUatALikeRequest("RECHECK");
  await returnToReview(harness, questionnaireId);
  await release(harness, questionnaireId);
  const answers = { answers: [{ questionKey: "optional", value: "The fallback runbook is kept with the processor." }] };

  const saved = await harness.saveAnswersServiceFixture(jane, questionnaireId, answers);
  assert.equal(saved.status, 200, `SAVE_ON_A_RELEASED_QUESTIONNAIRE_REFUSED: ${JSON.stringify(saved)}`);
  const submitted = await harness.submitQuestionnaireServiceFixture(jane, questionnaireId);
  assert.equal(submitted.status, 200, `SUBMIT_ON_A_RELEASED_QUESTIONNAIRE_REFUSED: ${JSON.stringify(submitted)}`);

  await returnToReview(harness, questionnaireId);
  const before = await harness.questionnaireSnapshotFixture(questionnaireId);
  const notAnswerable = { status: 409, reason: "QUESTIONNAIRE_NOT_ANSWERABLE", message: "CSRM questionnaire is not answerable." };
  const refusedSave = await harness.saveAnswersServiceFixture(jane, questionnaireId, answers);
  assert.deepEqual({ status: refusedSave.status, reason: refusedSave.reason, message: refusedSave.message }, notAnswerable, "SERVICE_SAVE_NOT_REFUSED");
  const refusedSubmit = await harness.submitQuestionnaireServiceFixture(jane, questionnaireId);
  assert.deepEqual({ status: refusedSubmit.status, reason: refusedSubmit.reason, message: refusedSubmit.message }, notAnswerable, "SERVICE_SUBMIT_NOT_REFUSED");
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), before, "REFUSED_REQUESTOR_WRITE_NOT_DEEP-EQUAL");

  // Over HTTP the policy's existing release refusal answers first, unchanged.
  const overHttp = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/answers`, harness.identities.owner, "PATCH", answers);
  assert.equal(overHttp.status, 409, `HTTP_SAVE_NOT_REFUSED_BY_QUESTIONNAIRE_STATE: ${await overHttp.clone().text()}`);
  assert.deepEqual(((await overHttp.json()) as { error: { details: unknown } }).error.details, { reason: "QUESTIONNAIRE_NOT_ANSWERABLE" });
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), before, "REFUSED_HTTP_SAVE_NOT_DEEP-EQUAL");
});

test("a Requestor answer between the proposal and the confirmation: Jane answers the question Bob's held rewrite targets, so confirming it after the return to analyst review is AI_PROPOSAL_STALE, deep-equal (D-25; T-15-25)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const jane = harness.users.owner;
  const { questionnaireId, mfaId } = await seedAnalystReview(harness, "RACE");
  await release(harness, questionnaireId);
  const submitted = await harness.submitQuestionnaireServiceFixture(jane, questionnaireId);
  assert.equal(submitted.status, 200, `JANE_SUBMIT_FAILED: ${JSON.stringify(submitted)}`);
  const mfaKey = String(options(await harness.getQuestion(mfaId) as Json).questionKey);

  const runId = await harness.withHeldQuestionnaireProposalProvider(async (hold) => {
    const started = await harness.startQuestionRewriteFixture(bob, questionnaireId, mfaId);
    assert.equal(started.status, 202, `REWRITE_NOT_STARTED: ${JSON.stringify(started)}`);
    await hold.reached;
    const reverted = await questionnaireRequest(harness, `${questionnairePath(questionnaireId)}/revert_to_draft`, harness.identities.owner, "POST", { reason: "Answer the MFA question." });
    assert.equal(reverted.status, 200, `JANE_REVERT_FAILED: ${await reverted.clone().text()}`);
    const answered = await harness.saveAnswersServiceFixture(jane, questionnaireId, { answers: [{ questionKey: mfaKey, value: "Yes, for every administrator." }] });
    assert.equal(answered.status, 200, `JANE_ANSWER_FAILED: ${JSON.stringify(answered)}`);
    hold.release();
    const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
    assert.equal(ended.status, "completed", `HELD_REWRITE_NOT_COMPLETED: ${JSON.stringify(ended.failure)}`);
    return String(ended.runId);
  });
  assert.equal((await itemOf(harness, runId, "change", mfaId)).key, "i-1");
  await returnToReview(harness, questionnaireId);
  await expectRefused(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }], { status: 409, reason: "AI_PROPOSAL_STALE" });
});

test("Jane's answers unchanged: across Bob's confirmations of the offshore items and a release, every answered question is deep-equal, and her questions read shows the three new questions with her earlier answers (D-05, D-07; QUES-12 criteria 2 and 3)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOffshoreReview(harness, "ANSWERS-UNCHANGED");
  const answeredBefore = await answeredRows(harness, questionnaireId);
  assert.ok(answeredBefore.length >= 3, "FIXTURE_HAS_TOO_FEW_ANSWERS");
  await expectApplied(harness, questionnaireId, [{ runId, item: "i-1", action: "accept" }, { runId, item: "i-2", action: "accept" }, { runId, item: "i-3", action: "accept" }]);
  assert.deepEqual(await answeredRows(harness, questionnaireId), answeredBefore, "CONFIRMATIONS_CHANGED_AN_ANSWERED_QUESTION");
  await release(harness, questionnaireId);
  assert.deepEqual(await answeredRows(harness, questionnaireId), answeredBefore, "RELEASE_CHANGED_AN_ANSWERED_QUESTION");

  const read = await harness.request({ path: `${questionnairePath(questionnaireId)}/questions`, identity: harness.identities.owner });
  assert.equal(read.status, 200, `JANE_QUESTIONS_READ_FAILED: ${await read.clone().text()}`);
  const shown = ((await read.json()) as { data: Json[] }).data;
  for (const text of [COUNTRY_QUESTION, ADMIN_QUESTION, APPROVAL_QUESTION]) {
    const question = shown.find((row) => row.questionText === text);
    assert.ok(question, `NEW_QUESTION_NOT_SHOWN_TO_JANE: ${text}`);
    assert.equal(question.answer ?? null, null, `NEW_QUESTION_ARRIVED_ANSWERED: ${text}`);
  }
  for (const before of answeredBefore) {
    const question = shown.find((row) => row.documentId === before.documentId);
    assert.ok(question, `ANSWERED_QUESTION_NOT_SHOWN: ${String(before.questionText)}`);
    assert.deepEqual(question.answer, before.answer, `JANE_ANSWER_CHANGED: ${String(before.questionText)}`);
  }
});

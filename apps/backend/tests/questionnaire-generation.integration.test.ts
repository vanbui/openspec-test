import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { after } from "node:test";

import { toQuestionnaireGenerationProposal } from "../src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider";
import { parseQuestionnaireGenerationProposal } from "../src/api/csrm-questionnaire/services/questionnaire-generation-provider";
import { fullGovernanceLog } from "./helpers/conflict-reason-fixtures";
import { UAT_A_LIKE_NOTE_SENTINELS, uatALikeNotes } from "./fixtures/uat-a-like-context";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => {
  await (await harnessPromise).close();
});

async function request(path: string, identity?: string, init: RequestInit = {}) {
  return (await harnessPromise).request({ path, identity, init });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

async function completedJob(jobId: string, identity: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(response.status, 200, "QUESTIONNAIRE_GENERATION_STATUS_ROUTE_MISSING");
    const data = (await body(response)).data as Record<string, unknown>;
    if (data.status === "completed") return data;
    if (data.status === "failed") assert.fail(`QUESTIONNAIRE_GENERATION_UNEXPECTED_FAILURE:${data.failureCode ?? "unknown"}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("QUESTIONNAIRE_GENERATION_DID_NOT_REACH_TERMINAL_STATE");
}

async function terminalJob(jobId: string, identity: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(response.status, 200, "QUESTIONNAIRE_GENERATION_STATUS_ROUTE_MISSING");
    const data = (await body(response)).data as Record<string, unknown>;
    if (data.status === "completed" || data.status === "failed") return data;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("QUESTIONNAIRE_GENERATION_DID_NOT_REACH_TERMINAL_STATE");
}

function json(method: string, payload?: unknown): RequestInit {
  return {
    method,
    ...(payload === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
  };
}

function generatePath(requestId: string): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/generate_questionnaire`;
}

function generationJobsPath(requestId: string): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/generation_jobs`;
}

/** The analyst-facing read of a request's current generation jobs (D-25), as `identity` sees it. */
async function requestGenerationJobs(requestId: string, identity: string): Promise<Record<string, unknown>> {
  const response = await request(generationJobsPath(requestId), identity);
  assert.equal(response.status, 200, `REQUEST_GENERATION_JOBS_NOT_READ_${identity}`);
  return (await body(response)).data as Record<string, unknown>;
}

/** Queues generation (a replacement when asked) as the analyst and follows the job to its end. */
async function generate(requestId: string, replace: boolean): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  const queued = await request(generatePath(requestId), harness.identities.analyst, json("POST", replace ? { replaceUnansweredQuestionnaire: true } : undefined));
  assert.equal(queued.status, 202, `QUESTIONNAIRE_GENERATION_NOT_QUEUED_${replace ? "REPLACE" : "FIRST"}`);
  return terminalJob(String(((await body(queued)).data as Record<string, unknown>).jobId), harness.identities.analyst);
}

let submittedRequestSequence = 0;
async function submittedRequest(label: string): Promise<string> {
  const harness = await harnessPromise;
  submittedRequestSequence += 1;
  return harness.createAssessmentRequestFixture({
    requestNumber: `GENERATION-${label}-${String(submittedRequestSequence).padStart(3, "0")}`,
    title: `Generation ${label.toLowerCase()} request`,
    requestStatus: "submitted",
    submittedDate: "2026-09-01T00:00:00.000Z",
    requestor: "owner",
  });
}

type StoredEvent = Record<string, unknown>;
function storedLog(questionnaire: Record<string, unknown> | null): StoredEvent[] {
  return Array.isArray(questionnaire?.governanceLog) ? questionnaire.governanceLog as StoredEvent[] : [];
}
function questionIds(questionnaire: Record<string, unknown> | null): string[] {
  return (Array.isArray(questionnaire?.questions) ? questionnaire.questions as Array<Record<string, unknown>> : []).map((question) => String(question.documentId)).sort();
}

/*
 * D-10: every replacement leaves a dated record of what it replaced and discarded. The event is written in the
 * transaction that replaces the questions, names the initiating analyst, carries the new generation's time
 * (so the D-17 resolution window keeps moving with generatedDate) and counts the analyst changes made since
 * the replaced generation. The analyst timeline shows it with its explanation; the Requestor's history shows
 * the replacement without that analyst detail (UI-SPEC §3.4, T-10-29).
 */
test("mounted replacement records one regenerated event naming the analyst and what it discarded", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("REPLACED");

  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "REPLACEMENT_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const generated = await harness.getQuestionnaire(questionnaireId);
  const replacedCount = questionIds(generated).length;
  assert.ok(replacedCount > 1, "REPLACEMENT_FIXTURE_HAS_TOO_FEW_QUESTIONS");
  assert.deepEqual(storedLog(generated), [], "FIRST_GENERATION_WROTE_A_GOVERNANCE_EVENT");

  // A fresh questionnaire: nothing an analyst changed is discarded.
  const replaced = await generate(requestId, true);
  assert.equal(replaced.status, "completed", `REPLACEMENT_FAILED_${String(replaced.failureCode)}`);
  const afterFirstReplacement = await harness.getQuestionnaire(questionnaireId);
  const firstLog = storedLog(afterFirstReplacement);
  assert.equal(firstLog.length, 1, "REPLACEMENT_DID_NOT_APPEND_EXACTLY_ONE_EVENT");
  assert.deepEqual(firstLog[0], {
    schemaVersion: 1,
    kind: "regenerated",
    at: afterFirstReplacement?.generatedDate,
    by: harness.users.analyst,
    explanation: `A newly generated questionnaire replaced ${replacedCount} questions. No analyst changes were discarded.`,
    // Phase 15 D-12: a replacement with no instruction names the default task.
    instructionSource: "default-task",
  }, "REGENERATED_EVENT_NOT_RECORDED_AS_SPECIFIED");
  assert.ok(Date.parse(String(afterFirstReplacement?.generatedDate)) > Date.parse(String(generated?.generatedDate)), "REPLACEMENT_DID_NOT_MOVE_GENERATED_DATE");
  const replacementQuestions = questionIds(afterFirstReplacement);
  assert.equal(replacementQuestions.length, replacedCount, "REPLACEMENT_QUESTION_COUNT_CHANGED");
  assert.deepEqual(replacementQuestions.filter((id) => questionIds(generated).includes(id)), [], "REPLACEMENT_KEPT_A_REPLACED_QUESTION");

  // A second replacement before any analyst change discards nothing.
  const second = await generate(requestId, true);
  assert.equal(second.status, "completed", `SECOND_REPLACEMENT_FAILED_${String(second.failureCode)}`);
  const afterSecondReplacement = await harness.getQuestionnaire(questionnaireId);
  const secondLog = storedLog(afterSecondReplacement);
  assert.deepEqual(secondLog[0], firstLog[0], "PRIOR_EVENT_REWRITTEN");
  assert.deepEqual(secondLog.map((event) => event.kind), ["regenerated", "regenerated"], "SECOND_REPLACEMENT_DID_NOT_APPEND_EXACTLY_ONE_EVENT");
  assert.equal(secondLog[1]?.explanation, `A newly generated questionnaire replaced ${replacedCount} questions. No analyst changes were discarded.`, "DISCARDED_CHANGES_NOT_COUNTED");
  assert.equal(secondLog[1]?.by, harness.users.analyst, "REGENERATED_EVENT_ACTOR");
  assert.equal(secondLog[1]?.at, afterSecondReplacement?.generatedDate, "REGENERATED_EVENT_NOT_DATED_BY_THE_GENERATION");

  // Phase 15 D-09: after two analyst edits a replacement is refused before it is queued, and nothing is written.
  for (const [index, questionId] of questionIds(afterSecondReplacement).slice(0, 2).entries()) {
    const edited = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/questions/${encodeURIComponent(questionId)}`, harness.identities.analyst, json("PATCH", { questionText: `Revised generated question ${index + 1}?` }));
    assert.equal(edited.status, 200, `REPLACEMENT_FIXTURE_EDIT_${index + 1}_FAILED`);
  }
  const editedQuestionnaire = await harness.getQuestionnaire(questionnaireId);
  const refused = await request(generatePath(requestId), harness.identities.analyst, json("POST", { replaceUnansweredQuestionnaire: true }));
  assert.equal(refused.status, 409, "REPLACEMENT_AFTER_ANALYST_CHANGES_NOT_REFUSED");
  assert.equal(((await body(refused)).error as { details?: { reason?: unknown } }).details?.reason, "QUESTIONNAIRE_HAS_ANALYST_CHANGES");
  assert.deepEqual(await harness.getQuestionnaire(questionnaireId), editedQuestionnaire, "REFUSED_REPLACEMENT_WROTE_SOMETHING");

  const analystRead = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(analystRead.status, 200, "REPLACEMENT_ANALYST_READ_FAILED");
  const analystEvents = ((await body(analystRead)).data as Record<string, unknown>).events as StoredEvent[];
  const analystRegenerated = analystEvents.filter((event) => event.kind === "regenerated");
  assert.equal(analystRegenerated.length, 2, "ANALYST_TIMELINE_LOST_A_REGENERATED_EVENT");
  assert.equal(analystRegenerated[1]?.explanation, secondLog[1]?.explanation, "ANALYST_TIMELINE_LOST_THE_EXPLANATION");
  assert.equal((analystRegenerated[1]?.by as Record<string, unknown> | undefined)?.documentId, harness.users.analyst, "ANALYST_TIMELINE_LOST_THE_ACTOR");

  // After the release, the Requestor sees that each replacement happened, without detail.
  const releasePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`;
  assert.equal((await request(releasePath, harness.identities.analyst, json("POST"))).status, 200, "REPLACEMENT_FIXTURE_RELEASE_FAILED");
  const ownerRead = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.owner);
  assert.equal(ownerRead.status, 200, "REPLACEMENT_OWNER_READ_FAILED");
  const ownerRegenerated = (((await body(ownerRead)).data as Record<string, unknown>).events as StoredEvent[]).filter((event) => event.kind === "regenerated");
  assert.equal(ownerRegenerated.length, 2, "REQUESTOR_HISTORY_LOST_A_REGENERATED_EVENT");
  for (const [index, event] of ownerRegenerated.entries()) {
    assert.deepEqual(Object.keys(event).sort(), ["at", "kind"], `REQUESTOR_RECEIVED_REGENERATED_DETAIL_${index}`);
  }
});

/*
 * 10-06's log-first property holds for the regenerated event too: a log that cannot take one more event fails
 * the job before anything is written, so the questionnaire keeps its questions, generation facts and log.
 * The job names why (WR-102, D-22): HISTORY_UNAVAILABLE, the reason every governance path gives for the same
 * condition, so the analyst is not told only that generation failed and left retrying a job that cannot pass.
 */
test("mounted replacement with a full governance log fails and changes nothing", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("FULL-LOG");
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-GENERATION-FULL-LOG",
    title: "Generation full log questionnaire",
    assessmentRequest: requestId,
    generatedDate: "2026-09-01T00:00:00.000Z",
    governanceLog: fullGovernanceLog(harness.users.analyst),
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Which service does this request cover?",
    answerType: "Text",
    options: { schemaVersion: 1, questionKey: "full-log-service", section: { key: "context", title: "Context", order: 1 }, order: 1, required: true },
    answer: null,
    questionnaire: questionnaireId,
  });
  const before = await harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]);

  const job = await generate(requestId, true);
  assert.equal(job.status, "failed", "FULL_LOG_REPLACEMENT_COMPLETED");
  assert.equal(job.failureCode, "HISTORY_UNAVAILABLE", "FULL_LOG_REPLACEMENT_FAILURE_CODE");
  assert.equal(job.failureMessage, "The questionnaire’s change history cannot record a replacement.", "FULL_LOG_REPLACEMENT_FAILURE_MESSAGE");
  assert.deepEqual(await harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]), before, "FULL_LOG_REPLACEMENT_WROTE");
});

/*
 * WR-102: an unreadable log refuses a replacement the same way, and the analyst read never claims nothing
 * would be discarded: it serves no change count, which the web words as "any" changes (fail closed).
 */
test("mounted replacement with an unreadable governance log fails with HISTORY_UNAVAILABLE and serves no change count", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("UNREADABLE-LOG");
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-GENERATION-UNREADABLE-LOG",
    title: "Generation unreadable log questionnaire",
    assessmentRequest: requestId,
    generatedDate: "2026-09-01T00:00:00.000Z",
    governanceLog: [{ kind: "question-edited" }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Which service does this request cover?",
    answerType: "Text",
    options: { schemaVersion: 1, questionKey: "unreadable-log-service", section: { key: "context", title: "Context", order: 1 }, order: 1, required: true },
    answer: null,
    questionnaire: questionnaireId,
  });

  const analystRead = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(analystRead.status, 200, "UNREADABLE_LOG_ANALYST_READ_FAILED");
  const revision = ((await body(analystRead)).data as Record<string, unknown>).revision as Record<string, unknown>;
  assert.equal("analystChangesSinceGeneration" in revision, false, `UNREADABLE_LOG_SERVED_A_CHANGE_COUNT_${String(revision.analystChangesSinceGeneration)}`);

  const before = await harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]);
  const job = await generate(requestId, true);
  assert.equal(job.status, "failed", "UNREADABLE_LOG_REPLACEMENT_COMPLETED");
  assert.equal(job.failureCode, "HISTORY_UNAVAILABLE", "UNREADABLE_LOG_REPLACEMENT_FAILURE_CODE");
  assert.deepEqual(await harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]), before, "UNREADABLE_LOG_REPLACEMENT_WROTE");
});

/*
 * D-09: a released questionnaire is what the Requestor is answering. Replacing it would publish questions no
 * analyst reviewed, so generation is refused before a job is queued, with or without the replacement
 * acknowledgement, and nothing is written. The analyst returns it to analyst review first.
 */
test("mounted generation refuses to replace a released questionnaire before queueing a job", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("RELEASED");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "RELEASED_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`, harness.identities.analyst, json("POST"))).status, 200, "RELEASED_FIXTURE_RELEASE_FAILED");
  const state = () => harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]);
  const before = await state();

  for (const [payload, diagnostic] of [[{ replaceUnansweredQuestionnaire: true }, "ACKNOWLEDGED"], [undefined, "UNACKNOWLEDGED"]] as const) {
    const refused = await request(generatePath(requestId), harness.identities.analyst, json("POST", payload));
    assert.equal(refused.status, 409, `RELEASED_REPLACEMENT_NOT_REFUSED_${diagnostic}`);
    assert.deepEqual((await body(refused)).error, {
      status: 409,
      name: "ConflictError",
      message: "Released questionnaires cannot be replaced.",
      details: { reason: "QUESTIONNAIRE_RELEASED" },
    }, `RELEASED_REPLACEMENT_REASON_${diagnostic}`);
  }
  // A queued job would have run by now; the refusal queued none and wrote nothing.
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(await state(), before, "RELEASED_REPLACEMENT_WROTE");
});

/*
 * D-09, before the transaction: a release that commits while a replacement job waits for its provider (before
 * the job's transaction opens) makes the job fail with QUESTIONNAIRE_RELEASED when it reads the questionnaire
 * under its locks, and the released questionnaire keeps its questions, generation facts, release facts and log.
 * A release reaching the window inside the transaction is the CR-101 test below.
 */
test("mounted replacement job fails when the questionnaire is released while it runs", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("RELEASE-RACE");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "RACE_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const state = () => harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]);

  let released: unknown[] = [];
  let heldJobId = "";
  await harness.withHeldQuestionnaireGeneration(requestId, async (jobId) => {
    heldJobId = jobId;
    assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`, harness.identities.analyst, json("POST"))).status, 200, "RACE_RELEASE_FAILED");
    released = await state();
  }, { replaceUnansweredQuestionnaire: true, expectedStatus: "failed" });

  const job = await terminalJob(heldJobId, harness.identities.analyst);
  assert.equal(job.status, "failed", "RACE_JOB_DID_NOT_FAIL");
  assert.equal(job.failureCode, "QUESTIONNAIRE_RELEASED", "RACE_JOB_FAILURE_CODE");
  assert.equal(job.failureMessage, "Released questionnaires cannot be replaced.", "RACE_JOB_FAILURE_MESSAGE");
  assert.deepEqual(await state(), released, "RACE_JOB_CHANGED_THE_RELEASED_QUESTIONNAIRE");
});

/*
 * CR-101: a replacement and every governance mutation of the same questionnaire are serialised. Each takes the
 * request row lock and then the questionnaire row lock before it reads, so a second mutation that reaches the
 * window between the first one's reads and its writes waits for the first to commit, then reads what it wrote.
 * Nothing is lost from the append-only log, and a release never publishes questions it did not see (D-09).
 *
 * SQLite gives Strapi one connection, so the harness emulates PostgreSQL's row locks to put the second mutation
 * into that window (see interleaveInTransactionWindow). The tests prove the lock protocol; PostgreSQL's own
 * blocking is not exercised here (R-08-37).
 */
const QUESTION_UID = "api::csrm-question.csrm-question";
const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const windowQuestion = {
  questionText: "Which data classification applies to this service?",
  answerType: "Text",
  required: false,
  section: { key: "cr-101-window", title: "Window checks", order: 99 },
  order: 1,
};

/** Runs again, after the operation committed, an intrusion that waited on its row lock, as PostgreSQL would. */
async function runWaitingIntrusion(outcome: { outcome: string }, diagnostic: string, waited: () => Promise<Response | Record<string, unknown>>): Promise<void> {
  if (outcome.outcome === "blocked") {
    const result = await waited();
    if (result instanceof Response) assert.equal(result.status, 200, `${diagnostic}_WAITING_MUTATION_FAILED`);
    else assert.equal(result.status, "completed", `${diagnostic}_WAITING_REPLACEMENT_FAILED_${String(result.failureCode)}`);
    return;
  }
  assert.equal(outcome.outcome, "committed", `${diagnostic}_INTRUSION_${outcome.outcome.toUpperCase()}`);
}

test("mounted CR-101 a release reaching a replacement's transaction window waits for it and loses no governance event", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("WINDOW-RELEASE");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "WINDOW_RELEASE_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const replacedQuestions = questionIds(await harness.getQuestionnaire(questionnaireId));

  const { result: job, intrusion } = await harness.interleaveInTransactionWindow({
    before: { uid: QUESTION_UID, action: "delete" },
    operation: () => generate(requestId, true),
    intrusion: (workflows) => workflows.release(questionnaireId),
  });
  assert.equal(job.status, "completed", `WINDOW_RELEASE_REPLACEMENT_FAILED_${String(job.failureCode)}`);
  await runWaitingIntrusion(intrusion, "WINDOW_RELEASE", () => request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`, harness.identities.analyst, json("POST")));

  const after = await harness.getQuestionnaire(questionnaireId);
  assert.deepEqual(storedLog(after).map((event) => event.kind), ["regenerated", "released"], "WINDOW_RELEASE_LOST_A_GOVERNANCE_EVENT");
  assert.ok(after?.releasedAt, "WINDOW_RELEASE_NOT_RELEASED");
  // D-09: the released questions are the ones the release saw, the replacement's, never a mix.
  assert.deepEqual(questionIds(after).filter((id) => replacedQuestions.includes(id)), [], "WINDOW_RELEASE_KEPT_A_REPLACED_QUESTION");
});

test("mounted CR-101 a question added in a replacement's transaction window waits for it and keeps its event", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("WINDOW-ADD");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "WINDOW_ADD_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const generatedCount = questionIds(await harness.getQuestionnaire(questionnaireId)).length;

  const { result: job, intrusion } = await harness.interleaveInTransactionWindow({
    before: { uid: QUESTION_UID, action: "delete" },
    operation: () => generate(requestId, true),
    intrusion: (workflows) => workflows.addQuestion(questionnaireId, windowQuestion),
  });
  assert.equal(job.status, "completed", `WINDOW_ADD_REPLACEMENT_FAILED_${String(job.failureCode)}`);
  await runWaitingIntrusion(intrusion, "WINDOW_ADD", () => request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/questions`, harness.identities.analyst, json("POST", windowQuestion)));

  const after = await harness.getQuestionnaire(questionnaireId);
  assert.deepEqual(storedLog(after).map((event) => event.kind), ["regenerated", "question-added"], "WINDOW_ADD_LOST_A_GOVERNANCE_EVENT");
  assert.equal(questionIds(after).length, generatedCount + 1, "WINDOW_ADD_QUESTION_COUNT");
});

test("mounted CR-101 a replacement reaching a question add's transaction window waits for it and keeps both events", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("WINDOW-REVERSE");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "WINDOW_REVERSE_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);

  const { result: added, intrusion } = await harness.interleaveInTransactionWindow({
    before: { uid: QUESTION_UID, action: "create" },
    operation: () => request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/questions`, harness.identities.analyst, json("POST", windowQuestion)),
    intrusion: (workflows) => workflows.replaceQuestionnaire(requestId),
  });
  assert.equal(added.status, 200, "WINDOW_REVERSE_ADD_FAILED");
  // The replacement waited on the add's row lock; run again once the add committed, it sees the add under both locks
  // and, since Phase 15 D-09, refuses to discard it.
  assert.equal(intrusion.outcome, "blocked", `WINDOW_REVERSE_INTRUSION_${intrusion.outcome.toUpperCase()}`);
  const waited = await harness.replaceQuestionnaireFixture(requestId);
  assert.deepEqual(waited, { status: "failed", failureCode: "QUESTIONNAIRE_HAS_ANALYST_CHANGES" }, "WINDOW_REVERSE_DID_NOT_SEE_THE_ADD");

  const after = await harness.getQuestionnaire(questionnaireId);
  assert.deepEqual(storedLog(after).map((event) => event.kind), ["question-added"], "WINDOW_REVERSE_LOST_OR_ADDED_A_GOVERNANCE_EVENT");
});

/*
 * CR-101: one lock order everywhere, so no two of these mutations can deadlock: each transaction locks the
 * request row and then the questionnaire row, before anything else. That covers the replacement, release,
 * return to review, question add, edit and delete, and the Requestor's answer save.
 */
test("mounted CR-101 every questionnaire mutation locks the request row before the questionnaire row", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("LOCK-ORDER");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "LOCK_ORDER_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;
  const analyst = harness.identities.analyst;
  const expectOk = async (response: Promise<Response>, diagnostic: string) => assert.equal((await response).status, 200, diagnostic);

  const { locks } = await harness.recordRowLocks(async () => {
    const replaced = await generate(requestId, true);
    assert.equal(replaced.status, "completed", `LOCK_ORDER_REPLACEMENT_FAILED_${String(replaced.failureCode)}`);
    // Delete a question no other question's visibility depends on: Strapi rightly refuses the others with
    // QUESTION_HAS_DEPENDENTS, and the documentIds are random, so picking by sorted id made this test flaky.
    const replacedQuestions = ((await harness.getQuestionnaire(questionnaireId))?.questions ?? []) as Array<Record<string, unknown>>;
    const optionsOf = (question: Record<string, unknown>) => (question.options ?? {}) as { questionKey?: unknown; visibility?: { questionKey?: unknown } | null };
    const dependedOn = new Set<unknown>(replacedQuestions.map((question) => optionsOf(question).visibility?.questionKey).filter((key) => typeof key === "string"));
    assert.ok(dependedOn.size > 0, "LOCK_ORDER_FIXTURE_HAS_NO_CONDITIONAL_QUESTION");
    const deletable = replacedQuestions.filter((question) => !dependedOn.has(optionsOf(question).questionKey)).map((question) => String(question.documentId)).sort();
    const deleted = deletable[0];
    const edited = replacedQuestions.map((question) => String(question.documentId)).sort().find((id) => id !== deleted);
    assert.ok(deleted && edited, "LOCK_ORDER_FIXTURE_HAS_NO_DELETABLE_QUESTION");
    await expectOk(request(`${questionnairePath}/questions/${encodeURIComponent(String(edited))}`, analyst, json("PATCH", { questionText: "Which business service does this cover?" })), "LOCK_ORDER_EDIT_FAILED");
    await expectOk(request(`${questionnairePath}/questions`, analyst, json("POST", windowQuestion)), "LOCK_ORDER_ADD_FAILED");
    await expectOk(request(`${questionnairePath}/questions/${encodeURIComponent(String(deleted))}`, analyst, json("DELETE")), "LOCK_ORDER_DELETE_FAILED");
    await expectOk(request(`${questionnairePath}/release`, analyst, json("POST")), "LOCK_ORDER_RELEASE_FAILED");
    const answerKey = String(((await harness.getQuestionnaire(questionnaireId))?.questions as Array<Record<string, unknown>>)
      .map((question) => question.options as Record<string, unknown>)
      .find((options) => options.questionKey === "which-data-classification-applies-to-this-service")?.questionKey);
    await expectOk(request(`${questionnairePath}/answers`, harness.identities.owner, json("PATCH", { answers: [{ questionKey: answerKey, value: "Official" }] })), "LOCK_ORDER_ANSWER_SAVE_FAILED");
    await expectOk(request(`${questionnairePath}/return_to_review`, analyst, json("POST", { reason: "Check the lock order on the way back." })), "LOCK_ORDER_RETURN_FAILED");
  });

  const byTransaction = new Map<number, string[]>();
  for (const lock of locks) {
    assert.ok(lock.documentId === requestId || lock.documentId === questionnaireId, `LOCK_ORDER_UNEXPECTED_ROW_${lock.uid}`);
    byTransaction.set(lock.transaction, [...(byTransaction.get(lock.transaction) ?? []), lock.uid]);
  }
  assert.equal(byTransaction.size, 7, `LOCK_ORDER_TRANSACTION_COUNT_${byTransaction.size}`);
  for (const [transaction, uids] of byTransaction) {
    assert.deepEqual(uids, [REQUEST_UID, QUESTIONNAIRE_UID], `LOCK_ORDER_TRANSACTION_${transaction}_LOCKED_${uids.join("_THEN_")}`);
  }
});

/*
 * D-16: analyst reads carry how many question changes a replacement would discard, counted since the latest
 * generation, so the count restarts when a replacement moves generatedDate. A Requestor never receives it.
 */
test("mounted analyst reads count question changes since the latest generation and Requestor reads never do", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("CHANGE-COUNT");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "COUNT_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;
  const revision = (data: unknown) => (data as Record<string, unknown>).revision as Record<string, unknown>;
  const analystRevision = async () => {
    const response = await request(questionnairePath, harness.identities.analyst);
    assert.equal(response.status, 200, "COUNT_ANALYST_READ_FAILED");
    return revision((await body(response)).data);
  };
  const edit = async (questionId: string, questionText: string) => {
    const response = await request(`${questionnairePath}/questions/${encodeURIComponent(questionId)}`, harness.identities.analyst, json("PATCH", { questionText }));
    assert.equal(response.status, 200, "COUNT_FIXTURE_EDIT_FAILED");
    return revision((await body(response)).data);
  };

  assert.equal((await analystRevision()).analystChangesSinceGeneration, 0, "FRESH_QUESTIONNAIRE_COUNT");
  // A replacement (allowed before any analyst change, Phase 15 D-09) moves generatedDate, so the count starts at 0.
  const replaced = await generate(requestId, true);
  assert.equal(replaced.status, "completed", `COUNT_FIXTURE_REPLACEMENT_FAILED_${String(replaced.failureCode)}`);
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 0, "COUNT_DID_NOT_RESTART_AFTER_REPLACEMENT");
  const [firstQuestion, secondQuestion] = questionIds(await harness.getQuestionnaire(questionnaireId));
  assert.equal((await edit(String(firstQuestion), "Which business service does this request cover?")).analystChangesSinceGeneration, 1, "COUNT_AFTER_REPLACEMENT");
  const governanceResult = await edit(String(secondQuestion), "Who owns the data the service processes?");
  assert.equal(governanceResult.analystChangesSinceGeneration, 2, "GOVERNANCE_RESULT_COUNT");
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 2, "ANALYST_READ_COUNT");
  // With analyst changes the replacement is refused, so the count stays.
  const refused = await request(generatePath(requestId), harness.identities.analyst, json("POST", { replaceUnansweredQuestionnaire: true }));
  assert.equal(refused.status, 409, "COUNT_FIXTURE_REPLACEMENT_NOT_REFUSED");
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 2, "COUNT_CHANGED_BY_A_REFUSED_REPLACEMENT");

  const released = await request(`${questionnairePath}/release`, harness.identities.analyst, json("POST"));
  assert.equal(released.status, 200, "COUNT_FIXTURE_RELEASE_FAILED");
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 2, "RELEASED_ANALYST_READ_COUNT");
  const ownerRead = await request(questionnairePath, harness.identities.owner);
  assert.equal(ownerRead.status, 200, "COUNT_OWNER_READ_FAILED");
  assert.deepEqual(Object.keys(revision((await body(ownerRead)).data)).sort(), ["eventCount", "lastEventAt"], "REQUESTOR_RECEIVED_THE_CHANGE_COUNT");
});

test("mounted questionnaire generation keeps completed relations populated and job reads actor-scoped", async () => {
  const harness = await harnessPromise;
  assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");
  const fixtures = await harness.seedRequestWorkflowFixtures();
  const generatePath = `/api/v1/assessment_requests/${encodeURIComponent(fixtures.requests.submitted)}/generate_questionnaire`;

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    const denied = await request(generatePath, identity, { method: "POST" });
    assert.equal(denied.status, 403, `QUESTIONNAIRE_GENERATION_UNGRANTED_ACTOR_${identity}`);
  }

  const queuedResponse = await request(generatePath, harness.identities.analyst, { method: "POST" });
  assert.equal(queuedResponse.status, 202, "QUESTIONNAIRE_GENERATION_QUEUE_ROUTE_MISSING");
  const queued = (await body(queuedResponse)).data as Record<string, unknown>;
  assert.equal(queued.status, "queued");
  assert.equal(typeof queued.jobId, "string");

  const job = await completedJob(String(queued.jobId), harness.identities.analyst);
  assert.equal(job.status, "completed");
  assert.equal(typeof job.providerName, "string");
  assert.equal(typeof job.providerVersion, "string");
  assert.ok(job.questionnaire && typeof job.questionnaire === "object", "QUESTIONNAIRE_GENERATION_COMPLETION_RELATION_MISSING");
  const questionnaire = job.questionnaire as Record<string, unknown>;
  assert.equal(typeof questionnaire.documentId, "string");
  // Domain numbers use the Crockford base32 alphabet, matching RAR and ASM.
  assert.match(String(questionnaire.questionnaireNumber), /^QNR-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  /*
   * The job payload is a bounded summary and deliberately carries no question
   * rows: parsing the whole record with a closed client schema made every new
   * questionnaire attribute a breaking change for this route. Prove the
   * generation really produced questions from the persisted record instead.
   */
  assert.equal(Object.keys(questionnaire).sort().join(","), "documentId,generatedBy,generatedDate,questionnaireNumber,title", "QUESTIONNAIRE_GENERATION_SUMMARY_NOT_BOUNDED");
  const persisted = await harness.getQuestionnaire(String(questionnaire.documentId));
  assert.ok(Array.isArray(persisted?.questions) && persisted.questions.length > 0, "QUESTIONNAIRE_GENERATION_QUESTIONS_MISSING");
  assert.equal(persisted?.providerName, "deterministic-questionnaire-generation");
  assert.equal(persisted?.providerVersion, "2");
  assert.ok((persisted?.questions as Array<Record<string, unknown>>).every((question) => typeof question.helpText === "string" && question.helpText.length > 0), "QUESTIONNAIRE_HELP_TEXT_NOT_PERSISTED");
  const runs = await harness.listAiRunsForRequest(fixtures.requests.submitted);
  assert.equal(runs.length, 1, "QUESTIONNAIRE_PROVIDER_CALL_WITHOUT_ONE_RUN");
  assert.equal(runs[0].operation, "questionnaire-generation");
  assert.equal(runs[0].status, "completed");
  assert.equal(runs[0].jobId, queued.jobId);
  assert.equal(runs[0].attempt, 1);
  assert.equal((runs[0].questionnaire as Record<string, unknown>)?.documentId, questionnaire.documentId);
  assert.equal(typeof persisted?.generatedDate, "string", "QUESTIONNAIRE_PERSISTED_PROVENANCE_DATE_MISSING");
  assert.ok(persisted?.generatedBy && typeof persisted.generatedBy === "object", "QUESTIONNAIRE_PERSISTED_PROVENANCE_ACTOR_MISSING");
  assert.equal(typeof questionnaire.generatedDate, "string", "QUESTIONNAIRE_GENERATION_PROVENANCE_DATE_MISSING");
  assert.ok(questionnaire.generatedBy && typeof questionnaire.generatedBy === "object", "QUESTIONNAIRE_GENERATION_PROVENANCE_ACTOR_MISSING");

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    const denied = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(String(queued.jobId))}`, identity);
    assert.equal(denied.status, 403, `QUESTIONNAIRE_GENERATION_JOB_READ_DENIED_${identity}`);
  }
});

test("failed questionnaire provider calls have separate run records for each retry", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("RUN-RETRY");
  const queued = await harness.withQuestionnaireProviderFailureCode("PROVIDER_TIMEOUT", "The provider timed out.", async () => {
    const response = await request(generatePath(requestId), harness.identities.analyst, json("POST"));
    assert.equal(response.status, 202);
    const job = (await body(response)).data as Record<string, unknown>;
    const terminal = await terminalJob(String(job.jobId), harness.identities.analyst);
    assert.equal(terminal.status, "failed");
    assert.equal(terminal.failureCode, "PROVIDER_TIMEOUT");
    return job;
  });
  let runs = await harness.listAiRunsForRequest(requestId);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "failed");
  assert.equal(runs[0].failureCode, "PROVIDER_TIMEOUT");
  const retry = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(String(queued.jobId))}/retry`, harness.identities.analyst, json("POST"));
  assert.equal(retry.status, 202);
  const terminal = await terminalJob(String(queued.jobId), harness.identities.analyst);
  assert.equal(terminal.status, "completed");
  runs = await harness.listAiRunsForRequest(requestId);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((run) => run.attempt), [1, 2]);
  assert.deepEqual(runs.map((run) => run.status), ["failed", "completed"]);
});

test("UAT-like request produces contextual questions and a safe completed run summary", async () => {
  const harness = await harnessPromise;
  const seed = await harness.seedUatALikeFixture();
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "UATA-GENERATION-001", title: "Payroll platform change", description: "Unsigned payment files could be altered.",
    assessmentType: "Project", businessPurpose: "Pay employees", businessCriticality: "High", thirdPartyInvolvement: true,
    thirdPartyDetails: "External payroll processor", regulatoryRequirements: "Privacy Act 1988 and tax file number obligations",
    requestStatus: "submitted", requestor: harness.users.owner, informationSystems: seed.systemIds, informationAssets: seed.assetIds,
  });
  const job = await generate(requestId, false);
  assert.equal(job.status, "completed");
  const questionnaireId = String((job.questionnaire as Record<string, unknown>).documentId);
  const questionnaire = await harness.getQuestionnaire(questionnaireId);
  const questions = questionnaire?.questions as Array<Record<string, any>>;
  assert.equal(questions.length, 7);
  assert.ok(questions.every((question) => typeof question.helpText === "string" && question.helpText.length > 0));
  const byKey = new Map(questions.map((question) => [question.options.questionKey as string, question]));
  assert.deepEqual(byKey.get("third-party-involvement")?.options.choices.map((choice: { value: string }) => choice.value), ["yes", "no", "not-sure"]);
  assert.equal(byKey.get("third-party-details")?.options.visibility.value, "yes");
  // WR-105: the question asks about the regulatory requirements without quoting the Requestor's.
  assert.equal(byKey.get("regulatory-obligations")?.questionText, "How do you meet the regulatory requirements that apply to this request?");
  assert.equal(byKey.get("regulatory-obligations")?.options.required, false);
  // The selected asset's name is reference data, which the run's context summary also names.
  assert.match(String(byKey.get("asset-protection")?.questionText), /Employee payment details/);
  const runs = await harness.listAiRunsForRequest(requestId);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "completed");
  assert.ok(runs[0].proposal);
  // WR-105 (G-3): neither the run's summary nor the deterministic provider's proposal keeps the Requestor's text.
  const requestorText = ["Payroll platform change", "Unsigned payment files could be altered.", "Pay employees", "External payroll processor", "Privacy Act 1988 and tax file number obligations"];
  for (const [part, stored] of [["SUMMARY", runs[0].contextSummary], ["PROPOSAL", runs[0].proposal]] as const) {
    for (const text of requestorText) assert.equal(JSON.stringify(stored).includes(text), false, `RUN_${part}_KEPT_REQUESTOR_TEXT: ${text}`);
  }
});

/*
 * Phase 13 D-27 and D-28 (COLLAB-01 criterion 3; G-3): questionnaire generation sends Jane's marked note, never Bob's
 * unmarked reply, and its run records which note it used without its text. The run's digest is the digest of the
 * context the builder makes for the request with the note marked, so the note is in the prompt the run sent.
 */
test("mounted questionnaire generation sends the marked note as data and its run records it without its text", async () => {
  const harness = await harnessPromise;
  const seed = await harness.seedUatALikeFixture();
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "UATA-GENERATION-NOTES", title: "Payroll platform change", description: "Unsigned payment files could be altered.",
    assessmentType: "Project", businessPurpose: "Pay employees", businessCriticality: "High", thirdPartyInvolvement: true,
    thirdPartyDetails: "External payroll processor", regulatoryRequirements: "Privacy Act 1988 and tax file number obligations",
    requestStatus: "submitted", requestor: harness.users.owner, informationSystems: seed.systemIds, informationAssets: seed.assetIds,
  });
  const [jane, bob] = uatALikeNotes();
  const [janeId] = await harness.seedRequestNotes(requestId, [jane, bob]);
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId });
  assert.ok(context.userPrompt.includes(UAT_A_LIKE_NOTE_SENTINELS.jane), "MARKED_NOTE_NOT_IN_THE_CONTEXT");
  assert.ok(!context.userPrompt.includes(UAT_A_LIKE_NOTE_SENTINELS.bob), "UNMARKED_NOTE_IN_THE_CONTEXT");
  const job = await generate(requestId, false);
  assert.equal(job.status, "completed", `NOTES_GENERATION_${String(job.failureCode)}`);
  const runs = await harness.listAiRunsForRequest(requestId);
  assert.equal(runs.length, 1);
  const summary = runs[0].contextSummary as Record<string, unknown>;
  assert.equal(summary.schemaVersion, 5, "RUN_SUMMARY_NOT_V5");
  assert.equal(summary.digest, context.digest, "RUN_DID_NOT_SEND_THE_CONTEXT_WITH_THE_MARKED_NOTE");
  assert.deepEqual(summary.notes, { included: [{ documentId: janeId, part: "requestor", sequence: 1, postedAt: jane.postedAt, characters: jane.body.length }], marked: 1, bound: 50 }, "RUN_SUMMARY_NOTES");
  for (const [part, stored] of [["SUMMARY", runs[0].contextSummary], ["PROPOSAL", runs[0].proposal]] as const) {
    for (const sentinel of Object.values(UAT_A_LIKE_NOTE_SENTINELS)) assert.equal(JSON.stringify(stored).includes(sentinel), false, `RUN_${part}_KEPT_NOTE_TEXT: ${sentinel}`);
  }
});

/*
 * D-25, UAT-041: an analyst who leaves the request page while a generation runs, or opens a request someone
 * else is generating on, reads the job back by request instead of being invited to start a second one. The
 * job keeps its existing closed shape; only whether this viewer may retry it is added beside it.
 */
test("mounted analyst reads the running questionnaire generation job of a request", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-HELD");

  await harness.withHeldQuestionnaireGeneration(requestId, async (jobId) => {
    const data = await requestGenerationJobs(requestId, harness.identities.analyst);
    assert.deepEqual(Object.keys(data).sort(), ["aiPolicy", "assessmentDraft", "questionnaireGeneration"], "REQUEST_GENERATION_JOBS_ENVELOPE");
    const questionnaireGeneration = data.questionnaireGeneration as Record<string, unknown>;
    assert.deepEqual(Object.keys(questionnaireGeneration).sort(), ["canRetry", "job"], "REQUEST_GENERATION_JOBS_QUESTIONNAIRE_ENTRY");
    const job = questionnaireGeneration.job as Record<string, unknown>;
    assert.equal(job.jobId, jobId, "REQUEST_GENERATION_JOBS_WRONG_JOB");
    assert.equal(job.requestId, requestId, "REQUEST_GENERATION_JOBS_WRONG_REQUEST");
    assert.ok(job.status === "queued" || job.status === "running", `REQUEST_GENERATION_JOBS_NOT_ACTIVE_${String(job.status)}`);
    assert.ok(!("initiatingAnalystDocumentId" in job), "REQUEST_GENERATION_JOBS_DISCLOSED_THE_INITIATOR_FIELD");
    // D-18: canRetry means "the job failed and this viewer may retry it", so an active job is never retryable.
    assert.equal(questionnaireGeneration.canRetry, false, "REQUEST_GENERATION_JOBS_ACTIVE_JOB_RETRYABLE");
    assert.equal(job.canRetry, false, "REQUEST_GENERATION_JOBS_ACTIVE_JOB_RETRYABLE_ON_THE_JOB");
    assert.equal(job.initiatedByViewer, true, "REQUEST_GENERATION_JOBS_INITIATOR_NOT_TOLD_THEY_STARTED_IT");
    assert.deepEqual(job.initiatedBy, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "REQUEST_GENERATION_JOBS_INITIATOR_NOT_NAMED");
    assert.equal(data.assessmentDraft, null, "REQUEST_GENERATION_JOBS_INVENTED_A_DRAFT_JOB");
  });
});

/*
 * D-25, D-47, D-18: every human analyst sees the same current job and who started it. Phase 13 inverts 10-13's
 * initiator-only by-id rule (Phase 10 D-27): the second analyst now reads Bob's held job by id too, told that Bob
 * started it and that a running job cannot be retried, while Bob's own read says he started it. The Requestor and
 * the service agent stay refused, and an unknown job stays 404.
 */
test("mounted analysts share a request's running job and any analyst follows it by id (D-18)", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-SHARED");
  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };

  await harness.withHeldQuestionnaireGeneration(requestId, async (jobId) => {
    const initiator = await requestGenerationJobs(requestId, harness.identities.analyst);
    const other = await requestGenerationJobs(requestId, harness.identities.secondAnalyst);
    const initiatorEntry = initiator.questionnaireGeneration as Record<string, unknown>;
    const otherEntry = other.questionnaireGeneration as Record<string, unknown>;
    const otherJob = otherEntry.job as Record<string, unknown>;
    assert.equal(otherJob.jobId, jobId, "SECOND_ANALYST_WRONG_JOB");
    assert.deepEqual({ ...otherJob, initiatedByViewer: true }, initiatorEntry.job, "SECOND_ANALYST_SAW_A_DIFFERENT_JOB");
    assert.equal(otherEntry.canRetry, false, "SECOND_ANALYST_MAY_RETRY_A_RUNNING_JOB");
    assert.deepEqual(otherJob.initiatedBy, bob, "REQUEST_GENERATION_JOBS_INITIATOR_NOT_NAMED");
    assert.equal(otherJob.initiatedByViewer, false, "SECOND_ANALYST_TOLD_THEY_STARTED_BOBS_JOB");

    const byId = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, harness.identities.secondAnalyst);
    assert.equal(byId.status, 200, "SECOND_ANALYST_BY_ID_READ_REFUSED");
    const colleague = (await body(byId)).data as Record<string, unknown>;
    assert.equal(colleague.jobId, jobId, "SECOND_ANALYST_BY_ID_WRONG_JOB");
    assert.deepEqual(colleague.initiatedBy, bob, "SECOND_ANALYST_BY_ID_INITIATOR_NOT_NAMED");
    assert.equal(colleague.initiatedByViewer, false, "SECOND_ANALYST_BY_ID_TOLD_THEY_STARTED_IT");
    assert.equal(colleague.canRetry, false, "SECOND_ANALYST_BY_ID_MAY_RETRY_A_RUNNING_JOB");
    assert.ok(!("initiatingAnalystDocumentId" in colleague), "SECOND_ANALYST_BY_ID_DISCLOSED_THE_REGISTRY_FIELD");

    const own = (await body(await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, harness.identities.analyst))).data as Record<string, unknown>;
    assert.equal(own.initiatedByViewer, true, "BOB_BY_ID_NOT_TOLD_HE_STARTED_IT");
    assert.deepEqual(own.initiatedBy, bob, "BOB_BY_ID_NOT_NAMED");

    for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
      const refused = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
      assert.equal(refused.status, 403, `BY_ID_READ_NOT_REFUSED_${identity}`);
      assert.equal((await body(refused)).data, null, `BY_ID_REFUSAL_DISCLOSED_THE_JOB_${identity}`);
    }
    const unknown = await request("/api/v1/questionnaire_generation_jobs/not-a-real-job", harness.identities.secondAnalyst);
    assert.equal(unknown.status, 404, "SECOND_ANALYST_UNKNOWN_JOB_NOT_404");
  });
});

/*
 * D-18, G-3: a failed job offers its retry to every human analyst on the request, and a retry is the retrying
 * analyst's attempt. Bob's generation fails; the second analyst's generation-jobs read says they may retry it; their
 * retry is accepted, the job then reads as theirs, and the regenerated questionnaire's generatedBy and the new run's
 * initiatedBy name them. The Requestor and the service agent cannot retry it, and an unknown job stays 404.
 */
test("mounted second analyst retries Bob's failed questionnaire generation and the retry is theirs (D-18)", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-COLLEAGUE-RETRY");
  const queued = await harness.withQuestionnaireProviderFailureCode("PROVIDER_TIMEOUT", "The provider timed out.", async () => {
    const response = await request(generatePath(requestId), harness.identities.analyst, json("POST"));
    assert.equal(response.status, 202, "BOB_GENERATION_NOT_QUEUED");
    const job = (await body(response)).data as Record<string, unknown>;
    assert.equal((await terminalJob(String(job.jobId), harness.identities.analyst)).status, "failed", "BOB_GENERATION_DID_NOT_FAIL");
    return job;
  });
  const jobId = String(queued.jobId);
  const retryPath = `/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}/retry`;

  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };
  const colleagueEntry = (await requestGenerationJobs(requestId, harness.identities.secondAnalyst)).questionnaireGeneration as Record<string, unknown>;
  assert.equal(colleagueEntry.canRetry, true, "SECOND_ANALYST_MAY_NOT_RETRY_A_FAILED_JOB");
  assert.equal((colleagueEntry.job as Record<string, unknown>).canRetry, true, "SECOND_ANALYST_FAILED_JOB_NOT_RETRYABLE_ON_THE_JOB");
  // WR-601 (D-18): the colleague following Bob's failed job is told Bob started it, on both reads, and that they may retry it.
  assert.deepEqual((colleagueEntry.job as Record<string, unknown>).initiatedBy, bob, "SECOND_ANALYST_FAILED_JOB_INITIATOR_NOT_NAMED");
  assert.equal((colleagueEntry.job as Record<string, unknown>).initiatedByViewer, false, "SECOND_ANALYST_TOLD_THEY_STARTED_THE_FAILED_JOB");
  const colleagueById = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, harness.identities.secondAnalyst);
  assert.equal(colleagueById.status, 200, "SECOND_ANALYST_BY_ID_READ_OF_A_FAILED_JOB_REFUSED");
  const colleagueJob = (await body(colleagueById)).data as Record<string, unknown>;
  assert.equal(colleagueJob.canRetry, true, "SECOND_ANALYST_BY_ID_MAY_NOT_RETRY_A_FAILED_JOB");
  assert.equal(colleagueJob.status, "failed", "SECOND_ANALYST_BY_ID_FAILED_JOB_NOT_FAILED");
  assert.deepEqual(colleagueJob.initiatedBy, bob, "SECOND_ANALYST_BY_ID_FAILED_JOB_INITIATOR_NOT_NAMED");
  assert.equal(colleagueJob.initiatedByViewer, false, "SECOND_ANALYST_BY_ID_TOLD_THEY_STARTED_THE_FAILED_JOB");

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    assert.equal((await request(retryPath, identity, json("POST"))).status, 403, `RETRY_NOT_REFUSED_${identity}`);
    // WR-601: neither follows the failed job, by id or through the request's generation jobs, and neither learns who started it.
    const byId = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(byId.status, 403, `FAILED_JOB_BY_ID_READ_NOT_REFUSED_${identity}`);
    assert.ok(!(await byId.text()).includes("Bob Doe"), `FAILED_JOB_BY_ID_REFUSAL_NAMED_THE_INITIATOR_${identity}`);
    const jobs = await request(generationJobsPath(requestId), identity);
    assert.equal(jobs.status, 403, `FAILED_JOB_GENERATION_JOBS_READ_NOT_REFUSED_${identity}`);
    assert.ok(!(await jobs.text()).includes(jobId), `FAILED_JOB_GENERATION_JOBS_REFUSAL_DISCLOSED_THE_JOB_${identity}`);
  }
  assert.equal((await request("/api/v1/questionnaire_generation_jobs/not-a-real-job/retry", harness.identities.secondAnalyst, json("POST"))).status, 404, "UNKNOWN_RETRY_NOT_404");

  const retried = await request(retryPath, harness.identities.secondAnalyst, json("POST"));
  assert.equal(retried.status, 202, "SECOND_ANALYST_RETRY_REFUSED");
  const retriedJob = (await body(retried)).data as Record<string, unknown>;
  assert.equal(retriedJob.attempt, 2, "RETRY_NOT_A_NEW_ATTEMPT");
  assert.equal(retriedJob.initiatedByViewer, true, "RETRIED_JOB_NOT_THE_RETRIERS");
  assert.deepEqual(retriedJob.initiatedBy, { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }, "RETRIED_JOB_NOT_CREDITED_TO_THE_RETRIER");

  const terminal = await terminalJob(jobId, harness.identities.secondAnalyst);
  assert.equal(terminal.status, "completed", `RETRIED_GENERATION_DID_NOT_COMPLETE_${String(terminal.failureCode)}`);
  const questionnaire = await harness.getQuestionnaire(String((terminal.questionnaire as Record<string, unknown>).documentId));
  assert.equal((questionnaire?.generatedBy as Record<string, unknown> | undefined)?.documentId, harness.users.secondAnalyst, "GENERATED_BY_NOT_THE_RETRIER");
  const runs = await harness.listAiRunsForRequest(requestId);
  assert.deepEqual(runs.map((run) => [run.attempt, run.status, (run.initiatedBy as Record<string, unknown> | null)?.documentId]),
    [[1, "failed", harness.users.analyst], [2, "completed", harness.users.secondAnalyst]], "RUN_INITIATORS_NOT_BOB_THEN_THE_RETRIER");
  const bobAfter = (await body(await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, harness.identities.analyst))).data as Record<string, unknown>;
  assert.equal(bobAfter.initiatedByViewer, false, "BOB_STILL_TOLD_HE_STARTED_THE_RETRY");
});

/** Follows an assessment draft job through its by-id read until it is completed or failed. */
async function terminalDraftJob(jobId: string, identity: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(response.status, 200, "ASSESSMENT_DRAFT_JOB_UNREADABLE");
    const data = (await body(response)).data as Record<string, unknown>;
    if (data.status === "completed" || data.status === "failed") return data;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("ASSESSMENT_DRAFT_JOB_DID_NOT_REACH_TERMINAL_STATE");
}

/*
 * D-25: the read also carries the assessment draft job for the request's questionnaire, so the hub can seed its
 * draft panel too (D-26). The entry is the job the by-id read returns, with the viewer's retry right beside it.
 */
test("mounted request generation read returns the draft job for the request's questionnaire", async () => {
  const harness = await harnessPromise;
  // The reference data and the answered, submitted questionnaire the mounted draft lifecycle test drafts from.
  await harness.seedAssessmentWorkflowFixtures();
  const questionnaireId = (await harness.seedConditionalQuestionnaireFixture()).questionnaire;
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;
  assert.equal((await request(`${questionnairePath}/answers`, harness.identities.owner, json("PATCH", { answers: [{ questionKey: "internet-facing", value: true }] }))).status, 200, "DRAFT_FIXTURE_NOT_ANSWERED");
  assert.equal((await request(`${questionnairePath}/submit`, harness.identities.owner, json("POST"))).status, 200, "DRAFT_FIXTURE_NOT_SUBMITTED");
  const requestId = String(((await harness.getQuestionnaire(questionnaireId))?.assessmentRequest as Record<string, unknown> | undefined)?.documentId);
  const queued = await request(`${questionnairePath}/generate_assessment`, harness.identities.analyst, json("POST"));
  assert.equal(queued.status, 202, "DRAFT_FIXTURE_NOT_QUEUED");
  const draftJob = await terminalDraftJob(String(((await body(queued)).data as Record<string, unknown>).jobId), harness.identities.analyst);
  assert.equal(draftJob.status, "completed", `DRAFT_FIXTURE_DID_NOT_COMPLETE_${String(draftJob.failureCode)}`);

  const initiator = await requestGenerationJobs(requestId, harness.identities.analyst);
  assert.equal(initiator.questionnaireGeneration, null, "REQUEST_GENERATION_JOBS_INVENTED_A_QUESTIONNAIRE_JOB");
  // D-18: a completed job is never retryable, and only the viewer's own read says they started it.
  assert.equal(draftJob.initiatedByViewer, true, "DRAFT_JOB_INITIATOR_NOT_TOLD_THEY_STARTED_IT");
  assert.deepEqual(initiator.assessmentDraft, { job: draftJob, canRetry: false }, "REQUEST_GENERATION_JOBS_DRAFT_JOB");
  const other = await requestGenerationJobs(requestId, harness.identities.secondAnalyst);
  assert.deepEqual(other.assessmentDraft, { job: { ...draftJob, initiatedByViewer: false }, canRetry: false }, "REQUEST_GENERATION_JOBS_SECOND_ANALYST_DRAFT_JOB");
});

/*
 * D-25, D-47, T-10-32: a request with no job reads as two nulls, an unknown request is 404, and nobody but a human
 * Security Analyst reaches the read: not the owning Requestor, another Requestor, the role-less identity, the
 * service agent or a caller with no identity.
 */
test("mounted request generation read answers no jobs, an unknown request and every refused caller", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-NONE");
  assert.deepEqual(await requestGenerationJobs(requestId, harness.identities.analyst), {
    questionnaireGeneration: null,
    assessmentDraft: null,
    aiPolicy: { status: "allowed", reason: null, requestClassification: "Internal", classificationSource: "default", ceiling: null },
  }, "REQUEST_WITHOUT_JOBS");

  const unknown = await request(generationJobsPath("request-that-does-not-exist"), harness.identities.analyst);
  assert.equal(unknown.status, 404, "UNKNOWN_REQUEST_NOT_404");
  assert.equal((await body(unknown)).data, null, "UNKNOWN_REQUEST_DISCLOSED_DATA");

  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.analystAgent, harness.identities.serviceAnalystAgent, undefined]) {
    const refused = await request(generationJobsPath(requestId), identity);
    assert.equal(refused.status, 403, `REQUEST_GENERATION_JOBS_NOT_REFUSED_${identity ?? "no-identity"}`);
    assert.equal((await body(refused)).data, null, `REQUEST_GENERATION_JOBS_REFUSAL_DISCLOSED_${identity ?? "no-identity"}`);
  }
});

test("mounted questionnaire generation refuses non-submitted requests", async () => {
  const harness = await harnessPromise;
  const requestFixtures = await harness.seedRequestWorkflowFixtures();
  const before = await harness.getRequest(requestFixtures.requests.editable);

  const nonSubmitted = await request(
    `/api/v1/assessment_requests/${encodeURIComponent(requestFixtures.requests.editable)}/generate_questionnaire`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(nonSubmitted.status, 409, "QUESTIONNAIRE_GENERATION_NON_SUBMITTED_REQUEST_NOT_REFUSED");
  // D-22: the refusal names its rule, and nothing is queued or written.
  assert.deepEqual((await body(nonSubmitted)).error, {
    status: 409,
    name: "ConflictError",
    message: "Assessment request is not eligible for questionnaire generation.",
    details: { reason: "REQUEST_NOT_ELIGIBLE" },
  }, "QUESTIONNAIRE_GENERATION_NON_SUBMITTED_REASON");
  assert.deepEqual(await harness.getRequest(requestFixtures.requests.editable), before, "QUESTIONNAIRE_GENERATION_NON_SUBMITTED_WRITE");
});

function questionnairePath(questionnaireId: string, suffix = ""): string {
  return `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}${suffix}`;
}

async function readData(path: string, identity: string, diagnostic: string): Promise<{ data: unknown; text: string }> {
  const response = await request(path, identity);
  assert.equal(response.status, 200, diagnostic);
  const text = await response.text();
  return { data: (JSON.parse(text) as { data: unknown }).data, text };
}

type ServedQuestion = { documentId: string; questionText: string; helpText: string | null; aiOrigin?: string; deleted?: unknown; options: { questionKey: string; section: Record<string, unknown>; order: number } };

/*
 * D-17, D-22, D-23 and D-25: every reader gets help text and the AI-assisted flag; only the analyst learns who
 * generated the questionnaire, with which provider and run, and which questions are still the AI's.
 */
test("mounted generation serves help text and the AI-assisted flag to both actors and provenance to the analyst only", async () => {
  const harness = await harnessPromise;
  const analyst = harness.identities.analyst;
  const requestId = await submittedRequest("PROVENANCE");
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", "PROVENANCE_FIXTURE_NOT_GENERATED");
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);

  const header = (await readData(questionnairePath(questionnaireId), analyst, "PROVENANCE_ANALYST_HEADER")).data as Record<string, unknown>;
  assert.equal(header.aiAssisted, true, "PROVENANCE_NOT_AI_ASSISTED");
  const generation = header.generation as Record<string, unknown>;
  assert.equal((generation.generatedBy as Record<string, unknown>).documentId, harness.users.analyst, "PROVENANCE_GENERATOR");
  assert.equal(generation.providerName, "deterministic-questionnaire-generation", "PROVENANCE_PROVIDER");
  assert.equal(generation.providerVersion, "2", "PROVENANCE_PROVIDER_VERSION");
  assert.ok(typeof generation.generatedAt === "string", "PROVENANCE_GENERATED_AT");
  const firstRunId = String(generation.runId);
  const run = await harness.getAiRun(firstRunId);
  assert.equal(run?.status, "completed", "PROVENANCE_RUN_NOT_COMPLETED");

  const firstGenerated = (await readData(questionnairePath(questionnaireId, "/questions"), analyst, "PROVENANCE_ANALYST_QUESTIONS")).data as ServedQuestion[];
  assert.ok(firstGenerated.every((question) => typeof question.helpText === "string" && question.helpText.length > 0), "PROVENANCE_HELP_TEXT_MISSING");
  assert.ok(firstGenerated.every((question) => question.aiOrigin === "generated"), "PROVENANCE_ORIGIN_NOT_GENERATED");

  // A replacement generation (allowed before any analyst change, Phase 15 D-09) is a new run, and its questions are all the AI's again.
  const replaced = await generate(requestId, true);
  assert.equal(replaced.status, "completed", `PROVENANCE_REPLACEMENT_FAILED_${String(replaced.failureCode)}`);
  const replacedHeader = (await readData(questionnairePath(questionnaireId), analyst, "PROVENANCE_REPLACED_HEADER")).data as Record<string, unknown>;
  const replacedRunId = String((replacedHeader.generation as Record<string, unknown>).runId);
  assert.notEqual(replacedRunId, firstRunId, "PROVENANCE_REPLACEMENT_KEPT_THE_OLD_RUN");
  const generated = (await readData(questionnairePath(questionnaireId, "/questions"), analyst, "PROVENANCE_REPLACED_QUESTIONS")).data as ServedQuestion[];
  assert.ok(generated.filter((question) => question.deleted === undefined).every((question) => question.aiOrigin === "generated"), "PROVENANCE_REPLACED_ORIGINS");

  // The analyst edits one generated question and adds one of their own.
  const edited = generated.find((question) => question.options.questionKey === "security-objectives");
  assert.ok(edited, "PROVENANCE_FIXTURE_QUESTION_MISSING");
  const editResponse = await request(questionnairePath(questionnaireId, `/questions/${encodeURIComponent(edited.documentId)}`), analyst, json("PATCH", { questionText: "Which security outcomes matter most?" }));
  assert.equal(editResponse.status, 200, "PROVENANCE_EDIT_FAILED");
  const contextQuestions = generated.filter((question) => question.options.section.key === "context");
  const nextOrder = Math.max(...contextQuestions.map((question) => question.options.order)) + 1;
  const addResponse = await request(questionnairePath(questionnaireId, "/questions"), analyst, json("POST", { questionText: "Who owns the service?", answerType: "Text", required: false, section: contextQuestions[0]!.options.section, order: nextOrder }));
  assert.equal(addResponse.status, 200, "PROVENANCE_ADD_FAILED");
  const revised = (await readData(questionnairePath(questionnaireId, "/questions"), analyst, "PROVENANCE_REVISED_QUESTIONS")).data as ServedQuestion[];
  const servedAs = (questionText: string) => revised.find((question) => question.questionText === questionText);
  assert.equal(servedAs("Which security outcomes matter most?")?.aiOrigin, "generated-edited", "PROVENANCE_EDITED_ORIGIN");
  assert.equal(servedAs("Who owns the service?")?.aiOrigin, "analyst-added", "PROVENANCE_ADDED_ORIGIN");
  assert.equal(servedAs("Who owns the service?")?.helpText, null, "PROVENANCE_ADDED_HELP_TEXT");
  assert.equal(revised.filter((question) => question.aiOrigin === "generated").length, generated.length - 1, "PROVENANCE_OTHER_ORIGINS");

  // Phase 15 D-09: with the analyst's changes in place a replacement is refused, so they are never discarded.
  const refusedReplacement = await request(generatePath(requestId), analyst, json("POST", { replaceUnansweredQuestionnaire: true }));
  assert.equal(refusedReplacement.status, 409, "PROVENANCE_REPLACEMENT_AFTER_CHANGES_NOT_REFUSED");

  // The owning Requestor reads help text and the flag, and nothing of the provenance.
  assert.equal((await request(questionnairePath(questionnaireId, "/release"), analyst, json("POST"))).status, 200, "PROVENANCE_RELEASE_FAILED");
  const ownerHeader = await readData(questionnairePath(questionnaireId), harness.identities.owner, "PROVENANCE_OWNER_HEADER");
  assert.equal((ownerHeader.data as Record<string, unknown>).aiAssisted, true, "PROVENANCE_OWNER_FLAG");
  const ownerQuestions = await readData(questionnairePath(questionnaireId, "/questions"), harness.identities.owner, "PROVENANCE_OWNER_QUESTIONS");
  // The analyst's own question stays (Phase 15 D-09 kept it from a replacement) and carries no help text.
  const ownerServed = ownerQuestions.data as ServedQuestion[];
  assert.ok(ownerServed.filter((question) => question.questionText !== "Who owns the service?").every((question) => typeof question.helpText === "string"), "PROVENANCE_OWNER_HELP_TEXT");
  assert.equal(ownerServed.find((question) => question.questionText === "Who owns the service?")?.helpText ?? null, null, "PROVENANCE_OWNER_ADDED_HELP_TEXT");
  const saved = await request(questionnairePath(questionnaireId, "/answers"), harness.identities.owner, json("PATCH", { answers: [{ questionKey: "security-objectives", value: "Keep pay data accurate." }] }));
  assert.equal(saved.status, 200, "PROVENANCE_OWNER_SAVE");
  const savedAnswers = ((await body(saved)).data as { answers: ServedQuestion[] }).answers;
  const isAnalystsOwn = (question: ServedQuestion) => (question as unknown as Record<string, unknown>).questionKey === "who-owns-the-service" || question.questionText === "Who owns the service?";
  assert.ok(savedAnswers.length > 0 && savedAnswers.filter((question) => !isAnalystsOwn(question)).every((question) => typeof question.helpText === "string" && question.helpText.length > 0), "PROVENANCE_SAVE_RESULT_HELP_TEXT");
  for (const served of [ownerHeader.text, ownerQuestions.text]) {
    for (const forbidden of ['"generation"', '"aiOrigin"', '"runId"', firstRunId, replacedRunId]) assert.ok(!served.includes(forbidden), `PROVENANCE_REQUESTOR_SAW_${forbidden}`);
  }

  // Another Requestor still cannot read the questionnaire at all.
  const other = await request(questionnairePath(questionnaireId), harness.identities.otherRequestor);
  assert.ok(other.status === 403 || other.status === 404, "PROVENANCE_OTHER_REQUESTOR_READ");
});

/*
 * IN-109 (D-16): every generated question should carry help text. When a model leaves one blank it is stored as null,
 * and the run's proposal records "help-text-missing" so the run shows the model skipped it; a generation with help text
 * on every question records no adjustment.
 */
test("a generation whose model left help text blank records help-text-missing on its run", async () => {
  const harness = await harnessPromise;
  const wire = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", `questionnaire-v2-${name}.json`), "utf8")) as unknown;
  const adjustmentsFor = async (label: string, name: string) => {
    const requestId = await submittedRequest(label);
    await harness.withQuestionnaireProviderOutput(() => parseQuestionnaireGenerationProposal(toQuestionnaireGenerationProposal(wire(name))), () => harness.runQuestionnaireGenerationJobFixture(requestId, harness.users.analyst));
    const runs = await harness.listAiRunsForRequest(requestId);
    assert.deepEqual(runs.map((run) => run.status), ["completed"], `HELP_TEXT_RUN_${label}`);
    return { adjustments: (runs[0].proposal as { adjustments: string[] }).adjustments, questionnaire: (await harness.getRequest(requestId))?.questionnaire as Record<string, unknown> };
  };
  const blank = await adjustmentsFor("HELP-BLANK", "blank-help-text");
  assert.deepEqual(blank.adjustments, ["help-text-missing"], "HELP_TEXT_MISSING_NOT_RECORDED");
  const stored = await harness.getQuestionnaire(String(blank.questionnaire.documentId));
  assert.equal((stored?.questions as Array<Record<string, any>>).find((question) => question.options.questionKey === "q-1")?.helpText ?? null, null, "the blank help text is stored as none");
  assert.deepEqual((await adjustmentsFor("HELP-GIVEN", "uat-a")).adjustments, [], "HELP_TEXT_ADJUSTMENT_WITHOUT_A_BLANK");
});

/*
 * WR-104 (D-06): a generated questionnaire within the definition's bounds but over the run record's 1 MB proposal bound
 * (20 long questions in a non-Latin script) is refused as invalid provider output before the transaction that would
 * save it: no questionnaire is saved, and its run records that code rather than the generic generation failure.
 */
test("a generated questionnaire over the run record's proposal bound fails as invalid provider output and saves nothing", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("OVERSIZED");
  const section = { key: "context", title: "Context", order: 0 };
  const oversized = () => parseQuestionnaireGenerationProposal({ schemaVersion: 1, title: "Oversized questionnaire", description: "Long questions.", questions: Array.from({ length: 20 }, (_, index) => ({
    questionText: `${index + 1}. ${"€".repeat(60_000)}`, helpText: "Explain.", answerType: "Long text", options: { schemaVersion: 1, questionKey: `q-${index + 1}`, section, order: index, required: false },
  })) });
  await harness.withQuestionnaireProviderOutput(oversized, async () => {
    await assert.rejects(harness.runQuestionnaireGenerationJobFixture(requestId, harness.users.analyst), { code: "PROVIDER_OUTPUT_INVALID" }, "OVERSIZED_QUESTIONNAIRE_NOT_INVALID_OUTPUT");
  });
  const runs = await harness.listAiRunsForRequest(requestId);
  assert.deepEqual(runs.map((run) => [run.status, run.failureCode, run.proposal]), [["failed", "PROVIDER_OUTPUT_INVALID", null]], "OVERSIZED_QUESTIONNAIRE_RUN");
  assert.equal((await harness.getRequest(requestId))?.questionnaire ?? null, null, "OVERSIZED_QUESTIONNAIRE_SAVED");
});

/*
 * WR-02, WR-209 and IN-110 (D-16): a hosted model's own "Not sure", "Unsure", "Don't know" and "not-sure" choices are
 * stored, and served to the Requestor, as the one canonical `{ value: "not-sure", label: "Not sure" }` her
 * introduction looks for, where the model put them; a choice question without one gains it last. The provider answers
 * with the wire fixture through the hosted adapter, as the OpenAI-compatible provider does.
 */
test("mounted generation stores and serves a model's own Not sure as the one canonical Not sure choice", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("NOT-SURE");
  const wire = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", "questionnaire-v2-not-sure-equivalents.json"), "utf8")) as unknown;
  const job = await harness.withQuestionnaireProviderOutput(
    () => parseQuestionnaireGenerationProposal(toQuestionnaireGenerationProposal(wire)),
    () => generate(requestId, false),
  );
  assert.equal(job.status, "completed", `NOT_SURE_GENERATION_FAILED_${String(job.failureCode)}`);
  const questionnaireId = String((job.questionnaire as Record<string, unknown>).documentId);
  const notSure = { value: "not-sure", label: "Not sure" };
  const choice = (text: string) => ({ value: text, label: text });
  const expected: Record<string, unknown> = {
    "q-1": [choice("Yes"), choice("No"), notSure],
    "q-2": [choice("Yes"), notSure, choice("No")],
    "q-3": [choice("Password"), choice("Single sign-on"), notSure],
    "q-4": [choice("Yes"), choice("No"), notSure],
    "q-5": [choice("Yes"), choice("No"), notSure],
    "q-6": [choice("Yes"), notSure],
    "q-7": [choice("Yes"), choice("No"), notSure],
  };
  const choicesByKey = (questions: Array<{ options: Record<string, unknown> }>) => Object.fromEntries(questions
    .filter((question) => Array.isArray(question.options.choices))
    .map((question) => [String(question.options.questionKey), question.options.choices]));

  const stored = await harness.getQuestionnaire(questionnaireId);
  assert.deepEqual(choicesByKey(stored?.questions as Array<{ options: Record<string, unknown> }>), expected, "NOT_SURE_STORED_DEFINITION");

  assert.equal((await request(questionnairePath(questionnaireId, "/release"), harness.identities.analyst, json("POST"))).status, 200, "NOT_SURE_RELEASE_FAILED");
  const served = await readData(questionnairePath(questionnaireId, "/questions"), harness.identities.owner, "NOT_SURE_OWNER_QUESTIONS");
  assert.deepEqual(choicesByKey(served.data as Array<{ options: Record<string, unknown> }>), expected, "NOT_SURE_SERVED_TO_THE_REQUESTOR");
});

test("mounted questionnaires without a run or with an unreadable log serve no origins, and seeded ones are not AI-assisted", async () => {
  const harness = await harnessPromise;
  const analyst = harness.identities.analyst;
  const fixture = async (label: string, data: Record<string, unknown>) => {
    const requestId = await submittedRequest(label);
    const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
      questionnaireNumber: `QUES-PROVENANCE-${label}`, title: `Provenance ${label.toLowerCase()}`, assessmentRequest: requestId, ...data,
    });
    await harness.createFixtureDocument("api::csrm-question.csrm-question", {
      questionText: "Which service does this request cover?", answerType: "Text", answer: null, questionnaire: questionnaireId,
      options: { schemaVersion: 1, questionKey: "service", section: { key: "context", title: "Context", order: 0 }, order: 0, required: true },
    });
    return { requestId, questionnaireId };
  };
  const generatedFacts = { generatedDate: "2026-09-01T00:00:00.000Z", generatedBy: harness.users.analyst, providerName: "legacy-provider", providerVersion: "1" };

  // Generated before run records existed: the facts, with no run and no origins.
  const legacy = await fixture("LEGACY", generatedFacts);
  const legacyHeader = (await readData(questionnairePath(legacy.questionnaireId), analyst, "LEGACY_HEADER")).data as Record<string, unknown>;
  assert.equal(legacyHeader.aiAssisted, true, "LEGACY_FLAG");
  assert.equal((legacyHeader.generation as Record<string, unknown>).runId, null, "LEGACY_RUN_ID");
  const legacyQuestions = (await readData(questionnairePath(legacy.questionnaireId, "/questions"), analyst, "LEGACY_QUESTIONS")).data as ServedQuestion[];
  assert.equal(legacyQuestions[0]?.helpText, null, "LEGACY_HELP_TEXT");
  assert.ok(legacyQuestions.every((question) => !("aiOrigin" in question)), "LEGACY_ORIGIN");

  // A run, but a governance log that cannot be read: the read succeeds and names no origin.
  const unreadable = await fixture("UNREADABLE", { ...generatedFacts, governanceLog: { schemaVersion: 99 } });
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: unreadable.requestId });
  const runId = await harness.createAiRunFixture({ operation: "questionnaire-generation", initiatedBy: harness.users.analyst, providerName: "legacy-provider", providerVersion: "1", assessmentRequest: unreadable.requestId, questionnaire: unreadable.questionnaireId, contextSummary: context.summary });
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  const unreadableHeader = (await readData(questionnairePath(unreadable.questionnaireId), analyst, "UNREADABLE_HEADER")).data as Record<string, unknown>;
  assert.equal((unreadableHeader.generation as Record<string, unknown>).runId, runId, "UNREADABLE_RUN_ID");
  const unreadableQuestions = (await readData(questionnairePath(unreadable.questionnaireId, "/questions"), analyst, "UNREADABLE_QUESTIONS")).data as ServedQuestion[];
  assert.ok(unreadableQuestions.length > 0 && unreadableQuestions.every((question) => !("aiOrigin" in question)), "UNREADABLE_ORIGIN");

  // Seeded by hand: not AI-assisted, with no generation facts.
  const seeded = await fixture("SEEDED", {});
  const seededHeader = (await readData(questionnairePath(seeded.questionnaireId), analyst, "SEEDED_HEADER")).data as Record<string, unknown>;
  assert.equal(seededHeader.aiAssisted, false, "SEEDED_FLAG");
  assert.ok(!("generation" in seededHeader), "SEEDED_GENERATION");
});

/* D-29: the read carries the policy the next enqueue would apply, from the request's information assets. */
test("mounted request generation read carries the AI data policy for a request with classified assets", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeFixture();
  const data = await requestGenerationJobs(fixture.requestId, harness.identities.analyst);
  assert.deepEqual(data.aiPolicy, { status: "allowed", reason: null, requestClassification: "Restricted", classificationSource: "assets", ceiling: null });
});

/*
 * Phase 15 (15-08 Task 2; D-08, D-09, Q-1): a replacement is allowed only on an unreleased questionnaire with no answer,
 * no analyst change since the latest generation (confirmed AI changes included) and no open AI proposal or active
 * proposal job; each is refused before queueing with its closed reason, and again inside the job's locked transaction.
 */

async function replacementRefusal(requestId: string): Promise<{ status: number; reason: unknown }> {
  const harness = await harnessPromise;
  const response = await request(generatePath(requestId), harness.identities.analyst, json("POST", { replaceUnansweredQuestionnaire: true }));
  const payload = await body(response);
  return { status: response.status, reason: (payload.error as { details?: { reason?: unknown } } | undefined)?.details?.reason };
}

async function generatedQuestionnaire(label: string): Promise<{ requestId: string; questionnaireId: string }> {
  const requestId = await submittedRequest(label);
  const first = await generate(requestId, false);
  assert.equal(first.status, "completed", `${label}_FIXTURE_NOT_GENERATED`);
  return { requestId, questionnaireId: String((first.questionnaire as Record<string, unknown>).documentId) };
}

/* Bob's proposal run with the tax file number instruction: one open addition (W2). */
async function taxFileNumberProposal(questionnaireId: string): Promise<string> {
  const harness = await harnessPromise;
  const started = await harness.startQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { instruction: "Ask whether the service stores tax file numbers." });
  assert.equal(started.status, 202, `PROPOSALS_NOT_STARTED: ${JSON.stringify(started)}`);
  const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  assert.equal(ended.status, "completed", `JOB_NOT_COMPLETED: ${JSON.stringify(ended.failure)}`);
  return String(ended.runId);
}

test("mounted replacement is refused before queueing with AI_PROPOSALS_OPEN, QUESTIONNAIRE_HAS_ANALYST_CHANGES after a confirmed AI change, and QUESTIONNAIRE_ANSWERED for a draft answer, each deep-equal (D-08, D-09, Q-1)", async () => {
  const harness = await harnessPromise;
  const { requestId, questionnaireId } = await generatedQuestionnaire("REPLACE-GATES");
  const runId = await taxFileNumberProposal(questionnaireId);
  const open = await harness.questionnaireSnapshotFixture(questionnaireId);
  assert.deepEqual(await replacementRefusal(requestId), { status: 409, reason: "AI_PROPOSALS_OPEN" });
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), open, "OPEN_REFUSAL_NOT_DEEP_EQUAL");
  assert.deepEqual(await harness.activeProposalJobsFixture(questionnaireId), []);

  const confirmed = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: [{ runId, item: "i-1", action: "accept" }] });
  assert.equal(confirmed.status, 200, `CONFIRM_FAILED: ${JSON.stringify(confirmed)}`);
  const changed = await harness.questionnaireSnapshotFixture(questionnaireId);
  assert.deepEqual(await replacementRefusal(requestId), { status: 409, reason: "QUESTIONNAIRE_HAS_ANALYST_CHANGES" });
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), changed, "CHANGES_REFUSAL_NOT_DEEP_EQUAL");

  const answered = await generatedQuestionnaire("REPLACE-ANSWERED");
  const [firstQuestion] = questionIds(await harness.getQuestionnaire(answered.questionnaireId));
  await harness.updateFixtureDocument(QUESTION_UID, String(firstQuestion), { answer: { schemaVersion: 1, value: "A draft answer", state: "draft", updatedAt: "2026-09-02T00:00:00.000Z" } });
  const drafted = await harness.questionnaireSnapshotFixture(answered.questionnaireId);
  assert.deepEqual(await replacementRefusal(answered.requestId), { status: 409, reason: "QUESTIONNAIRE_ANSWERED" });
  assert.deepEqual(await harness.questionnaireSnapshotFixture(answered.questionnaireId), drafted, "ANSWERED_REFUSAL_NOT_DEEP_EQUAL");
});

test("mounted held replacement job fails with QUESTIONNAIRE_HAS_ANALYST_CHANGES when a question changes while it runs, and with QUESTIONNAIRE_ANSWERED when an answer lands, deep-equal (D-09, Q-1)", async () => {
  const harness = await harnessPromise;
  const changed = await generatedQuestionnaire("REPLACE-HELD-CHANGE");
  let afterChange: unknown;
  let changeJobId = "";
  await harness.withHeldQuestionnaireGeneration(changed.requestId, async (jobId) => {
    changeJobId = jobId;
    const [questionId] = questionIds(await harness.getQuestionnaire(changed.questionnaireId));
    const edited = await request(`/api/v1/questionnaires/${encodeURIComponent(changed.questionnaireId)}/questions/${encodeURIComponent(String(questionId))}`, harness.identities.analyst, json("PATCH", { questionText: "Which hosting region applies?" }));
    assert.equal(edited.status, 200, "HELD_CHANGE_EDIT_FAILED");
    afterChange = await harness.questionnaireSnapshotFixture(changed.questionnaireId);
  }, { replaceUnansweredQuestionnaire: true, expectedStatus: "failed" });
  const changeJob = await terminalJob(changeJobId, harness.identities.analyst);
  assert.equal(changeJob.failureCode, "QUESTIONNAIRE_HAS_ANALYST_CHANGES", "HELD_CHANGE_JOB_FAILURE_CODE");
  assert.deepEqual(await harness.questionnaireSnapshotFixture(changed.questionnaireId), afterChange, "HELD_CHANGE_JOB_CHANGED_THE_QUESTIONNAIRE");

  const answered = await generatedQuestionnaire("REPLACE-HELD-ANSWER");
  let answerJobId = "";
  await harness.withHeldQuestionnaireGeneration(answered.requestId, async (jobId) => {
    answerJobId = jobId;
    const [questionId] = questionIds(await harness.getQuestionnaire(answered.questionnaireId));
    await harness.updateFixtureDocument(QUESTION_UID, String(questionId), { answer: { schemaVersion: 1, value: "A draft answer", state: "draft", updatedAt: "2026-09-02T00:00:00.000Z" } });
  }, { replaceUnansweredQuestionnaire: true, expectedStatus: "failed" });
  assert.equal((await terminalJob(answerJobId, harness.identities.analyst)).failureCode, "QUESTIONNAIRE_ANSWERED", "HELD_ANSWER_JOB_FAILURE_CODE");
});

/*
 * Phase 15 (15-08 Task 3; D-12, D-17 to D-19, D-32): the first generation and an allowed replacement take the same
 * optional analyst instruction as the proposals, through the same validator, guard and slot; the run and a
 * replacement's regenerated event record it.
 */

async function generationRun(questionnaireId: string): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  const header = (await readData(questionnairePath(questionnaireId), harness.identities.analyst, "INSTRUCTION_HEADER")).data as Record<string, unknown>;
  const run = await harness.getAiRun(String((header.generation as Record<string, unknown>).runId));
  assert.ok(run, "GENERATION_RUN_NOT_FOUND");
  return run;
}

async function generateWith(requestId: string, payload: Record<string, unknown>, identity?: string): Promise<{ status: number; reason: unknown; jobId?: string }> {
  const harness = await harnessPromise;
  const response = await request(generatePath(requestId), identity ?? harness.identities.analyst, json("POST", payload));
  const data = await body(response);
  return { status: response.status, reason: (data.error as { details?: { reason?: unknown } } | undefined)?.details?.reason, jobId: (data.data as Record<string, unknown> | undefined)?.jobId as string | undefined };
}

test("BE07: instructed generation retries are offered to other analysts but never the requesting analyst, on direct and hub reads", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("BE07-OWN-RETRY");
  await harness.updateFixtureDocument(REQUEST_UID, requestId, { requestor: harness.users.analyst });
  const failed = await harness.withQuestionnaireProviderFailureCode("PROVIDER_TIMEOUT", "The provider timed out.", async () => {
    const queued = await generateWith(requestId, { instruction: "Ask about recovery controls" }, harness.identities.secondAnalyst);
    assert.equal(queued.status, 202);
    return terminalJob(String(queued.jobId), harness.identities.secondAnalyst);
  });
  assert.equal(failed.status, "failed");
  for (const [identity, expected] of [[harness.identities.secondAnalyst, true], [harness.identities.analyst, false]] as const) {
    const direct = (await body(await request(`/api/v1/questionnaire_generation_jobs/${failed.jobId}`, identity))).data as Record<string, unknown>;
    const hub = (await requestGenerationJobs(requestId, identity)).questionnaireGeneration as { canRetry: boolean; job: { canRetry: boolean } };
    assert.deepEqual([direct.canRetry, hub.canRetry, hub.job.canRetry], [expected, expected, expected], "RETRY_FACT_DISAGREES_WITH_OWN_REQUEST_RULE");
  }
  const denied = await request(`/api/v1/questionnaire_generation_jobs/${failed.jobId}/retry`, harness.identities.analyst, json("POST"));
  assert.equal(denied.status, 403);
});

test("mounted generation takes an analyst instruction: the run stores it with source analyst, and without one the source is default-task; a replacement's regenerated event carries the instruction or default-task (D-12)", async () => {
  const harness = await harnessPromise;
  const instruction = "Cover the offshore support team and payroll data";
  const requestId = await submittedRequest("INSTRUCTION");
  const queued = await generateWith(requestId, { instruction });
  assert.equal(queued.status, 202, `INSTRUCTED_GENERATION_NOT_QUEUED: ${String(queued.reason)}`);
  const first = await terminalJob(String(queued.jobId), harness.identities.analyst);
  assert.equal(first.status, "completed", `INSTRUCTED_GENERATION_FAILED_${String(first.failureCode)}`);
  const questionnaireId = String((first.questionnaire as Record<string, unknown>).documentId);
  const run = await generationRun(questionnaireId);
  assert.equal(run.instruction, instruction, "RUN_DID_NOT_STORE_THE_INSTRUCTION");
  assert.deepEqual((run.contextSummary as Record<string, unknown>).instruction, { source: "analyst" });

  const replacedWith = await generateWith(requestId, { replaceUnansweredQuestionnaire: true, instruction: "Ask about tax file numbers" });
  assert.equal(replacedWith.status, 202, `INSTRUCTED_REPLACEMENT_NOT_QUEUED: ${String(replacedWith.reason)}`);
  assert.equal((await terminalJob(String(replacedWith.jobId), harness.identities.analyst)).status, "completed");
  const instructed = storedLog(await harness.getQuestionnaire(questionnaireId)).at(-1) as StoredEvent;
  assert.deepEqual([instructed.kind, instructed.instruction, instructed.instructionSource], ["regenerated", "Ask about tax file numbers", undefined], "REGENERATED_EVENT_LOST_THE_INSTRUCTION");

  const plain = await generate(requestId, true);
  assert.equal(plain.status, "completed");
  const defaulted = storedLog(await harness.getQuestionnaire(questionnaireId)).at(-1) as StoredEvent;
  assert.deepEqual([defaulted.kind, defaulted.instruction, defaulted.instructionSource], ["regenerated", undefined, "default-task"], "REGENERATED_EVENT_NOT_DEFAULT_TASK");
  assert.equal((await generationRun(questionnaireId)).instruction ?? null, null, "DEFAULT_TASK_RUN_STORED_AN_INSTRUCTION");
  assert.deepEqual(((await generationRun(questionnaireId)).contextSummary as Record<string, unknown>).instruction, { source: "default-task" });
});

test("mounted generation refuses INSTRUCTION_TOO_LONG and INSTRUCTION_REPEATS_REQUESTOR_TEXT and an unknown body key before queueing; on a request Bob raised an instruction is OWN_REQUEST while plain generation proceeds (D-18, D-19, D-32)", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("INSTRUCTION-REFUSED");
  const description = "Payroll files are exported nightly to the external processor over a managed file transfer link.";
  await harness.updateFixtureDocument(REQUEST_UID, requestId, { description });
  assert.deepEqual(await generateWith(requestId, { instruction: "a".repeat(501) }).then(({ status, reason }) => ({ status, reason })), { status: 400, reason: "INSTRUCTION_TOO_LONG" });
  assert.deepEqual(await generateWith(requestId, { instruction: `Focus on ${description.slice(0, 64)}` }).then(({ status, reason }) => ({ status, reason })), { status: 400, reason: "INSTRUCTION_REPEATS_REQUESTOR_TEXT" });
  assert.equal((await generateWith(requestId, { instruction: "x", extra: true })).status, 400, "UNKNOWN_BODY_KEY_ACCEPTED");
  assert.equal((await generateWith(requestId, { instruction: 42 })).status, 400, "NUMBER_INSTRUCTION_ACCEPTED");
  assert.equal((await requestGenerationJobs(requestId, harness.identities.analyst)).questionnaireGeneration, null, "A_REFUSED_INSTRUCTION_QUEUED_A_JOB");

  const own = await submittedRequest("INSTRUCTION-OWN");
  await harness.updateFixtureDocument(REQUEST_UID, own, { requestor: harness.users.analyst });
  assert.deepEqual(await generateWith(own, { instruction: "Cover the offshore support team" }).then(({ status, reason }) => ({ status, reason })), { status: 403, reason: "OWN_REQUEST" });
  assert.equal((await requestGenerationJobs(own, harness.identities.secondAnalyst)).questionnaireGeneration, null, "OWN_REQUEST_INSTRUCTION_QUEUED_A_JOB");
  const plain = await generate(own, false);
  assert.equal(plain.status, "completed", `PLAIN_GENERATION_ON_OWN_REQUEST_REFUSED_${String(plain.failureCode)}`);
});

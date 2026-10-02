import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fullGovernanceLog } from "./helpers/conflict-reason-fixtures";
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
  }, "REGENERATED_EVENT_NOT_RECORDED_AS_SPECIFIED");
  assert.ok(Date.parse(String(afterFirstReplacement?.generatedDate)) > Date.parse(String(generated?.generatedDate)), "REPLACEMENT_DID_NOT_MOVE_GENERATED_DATE");
  const replacementQuestions = questionIds(afterFirstReplacement);
  assert.equal(replacementQuestions.length, replacedCount, "REPLACEMENT_QUESTION_COUNT_CHANGED");
  assert.deepEqual(replacementQuestions.filter((id) => questionIds(generated).includes(id)), [], "REPLACEMENT_KEPT_A_REPLACED_QUESTION");

  // Two analyst edits, then a second replacement discards them both.
  for (const [index, questionId] of replacementQuestions.slice(0, 2).entries()) {
    const edited = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/questions/${encodeURIComponent(questionId)}`, harness.identities.analyst, json("PATCH", { questionText: `Revised generated question ${index + 1}?` }));
    assert.equal(edited.status, 200, `REPLACEMENT_FIXTURE_EDIT_${index + 1}_FAILED`);
  }
  const second = await generate(requestId, true);
  assert.equal(second.status, "completed", `SECOND_REPLACEMENT_FAILED_${String(second.failureCode)}`);
  const afterSecondReplacement = await harness.getQuestionnaire(questionnaireId);
  const secondLog = storedLog(afterSecondReplacement);
  assert.deepEqual(secondLog[0], firstLog[0], "PRIOR_EVENT_REWRITTEN");
  assert.deepEqual(secondLog.map((event) => event.kind), ["regenerated", "question-edited", "question-edited", "regenerated"], "SECOND_REPLACEMENT_DID_NOT_APPEND_EXACTLY_ONE_EVENT");
  assert.equal(secondLog[3]?.explanation, `A newly generated questionnaire replaced ${replacedCount} questions. 2 analyst changes were discarded.`, "DISCARDED_CHANGES_NOT_COUNTED");
  assert.equal(secondLog[3]?.by, harness.users.analyst, "REGENERATED_EVENT_ACTOR");
  assert.equal(secondLog[3]?.at, afterSecondReplacement?.generatedDate, "REGENERATED_EVENT_NOT_DATED_BY_THE_GENERATION");

  const analystRead = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(analystRead.status, 200, "REPLACEMENT_ANALYST_READ_FAILED");
  const analystEvents = ((await body(analystRead)).data as Record<string, unknown>).events as StoredEvent[];
  const analystRegenerated = analystEvents.filter((event) => event.kind === "regenerated");
  assert.equal(analystRegenerated.length, 2, "ANALYST_TIMELINE_LOST_A_REGENERATED_EVENT");
  assert.equal(analystRegenerated[1]?.explanation, secondLog[3]?.explanation, "ANALYST_TIMELINE_LOST_THE_EXPLANATION");
  assert.equal((analystRegenerated[1]?.by as Record<string, unknown> | undefined)?.documentId, harness.users.analyst, "ANALYST_TIMELINE_LOST_THE_ACTOR");

  // After the first release, a return to review and a replacement, the Requestor sees that it happened, without detail.
  const releasePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`;
  assert.equal((await request(releasePath, harness.identities.analyst, json("POST"))).status, 200, "REPLACEMENT_FIXTURE_RELEASE_FAILED");
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`, harness.identities.analyst, json("POST", { reason: "Generate it again from the corrected request." }))).status, 200, "REPLACEMENT_FIXTURE_RETURN_FAILED");
  const third = await generate(requestId, true);
  assert.equal(third.status, "completed", `RETURNED_REPLACEMENT_FAILED_${String(third.failureCode)}`);
  assert.equal((await request(releasePath, harness.identities.analyst, json("POST"))).status, 200, "REPLACEMENT_FIXTURE_SECOND_RELEASE_FAILED");
  const ownerRead = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.owner);
  assert.equal(ownerRead.status, 200, "REPLACEMENT_OWNER_READ_FAILED");
  const ownerRegenerated = (((await body(ownerRead)).data as Record<string, unknown>).events as StoredEvent[]).filter((event) => event.kind === "regenerated");
  assert.equal(ownerRegenerated.length, 3, "REQUESTOR_HISTORY_LOST_A_REGENERATED_EVENT");
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
  await runWaitingIntrusion(intrusion, "WINDOW_REVERSE", () => generate(requestId, true));

  const after = await harness.getQuestionnaire(questionnaireId);
  const log = storedLog(after);
  assert.deepEqual(log.map((event) => event.kind), ["question-added", "regenerated"], "WINDOW_REVERSE_LOST_A_GOVERNANCE_EVENT");
  assert.equal(log[1]?.explanation, `A newly generated questionnaire replaced ${questionIds(after).length + 1} questions. 1 analyst change was discarded.`, "WINDOW_REVERSE_DID_NOT_SEE_THE_ADD");
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
    const [edited, deleted] = questionIds(await harness.getQuestionnaire(questionnaireId));
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
  const [firstQuestion, secondQuestion] = questionIds(await harness.getQuestionnaire(questionnaireId));
  await edit(String(firstQuestion), "Which business service does this request cover?");
  const governanceResult = await edit(String(secondQuestion), "Who owns the data the service processes?");
  assert.equal(governanceResult.analystChangesSinceGeneration, 2, "GOVERNANCE_RESULT_COUNT");
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 2, "ANALYST_READ_COUNT");

  // A replacement moves generatedDate, so the count starts again.
  const replaced = await generate(requestId, true);
  assert.equal(replaced.status, "completed", `COUNT_FIXTURE_REPLACEMENT_FAILED_${String(replaced.failureCode)}`);
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 0, "COUNT_DID_NOT_RESTART_AFTER_REPLACEMENT");
  const [replacementQuestion] = questionIds(await harness.getQuestionnaire(questionnaireId));
  assert.equal((await edit(String(replacementQuestion), "Which hosting region applies?")).analystChangesSinceGeneration, 1, "COUNT_AFTER_REPLACEMENT");

  const released = await request(`${questionnairePath}/release`, harness.identities.analyst, json("POST"));
  assert.equal(released.status, 200, "COUNT_FIXTURE_RELEASE_FAILED");
  assert.equal((await analystRevision()).analystChangesSinceGeneration, 1, "RELEASED_ANALYST_READ_COUNT");
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
  assert.equal(persisted?.providerVersion, "1");
  assert.equal(typeof persisted?.generatedDate, "string", "QUESTIONNAIRE_PERSISTED_PROVENANCE_DATE_MISSING");
  assert.ok(persisted?.generatedBy && typeof persisted.generatedBy === "object", "QUESTIONNAIRE_PERSISTED_PROVENANCE_ACTOR_MISSING");
  assert.equal(typeof questionnaire.generatedDate, "string", "QUESTIONNAIRE_GENERATION_PROVENANCE_DATE_MISSING");
  assert.ok(questionnaire.generatedBy && typeof questionnaire.generatedBy === "object", "QUESTIONNAIRE_GENERATION_PROVENANCE_ACTOR_MISSING");

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    const denied = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(String(queued.jobId))}`, identity);
    assert.equal(denied.status, 403, `QUESTIONNAIRE_GENERATION_JOB_READ_DENIED_${identity}`);
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
    assert.deepEqual(Object.keys(data).sort(), ["assessmentDraft", "questionnaireGeneration"], "REQUEST_GENERATION_JOBS_ENVELOPE");
    const questionnaireGeneration = data.questionnaireGeneration as Record<string, unknown>;
    assert.deepEqual(Object.keys(questionnaireGeneration).sort(), ["canRetry", "job"], "REQUEST_GENERATION_JOBS_QUESTIONNAIRE_ENTRY");
    const job = questionnaireGeneration.job as Record<string, unknown>;
    assert.equal(job.jobId, jobId, "REQUEST_GENERATION_JOBS_WRONG_JOB");
    assert.equal(job.requestId, requestId, "REQUEST_GENERATION_JOBS_WRONG_REQUEST");
    assert.ok(job.status === "queued" || job.status === "running", `REQUEST_GENERATION_JOBS_NOT_ACTIVE_${String(job.status)}`);
    assert.ok(!("initiatingAnalystDocumentId" in job), "REQUEST_GENERATION_JOBS_DISCLOSED_THE_INITIATOR");
    assert.equal(questionnaireGeneration.canRetry, true, "REQUEST_GENERATION_JOBS_INITIATOR_CANNOT_RETRY");
    assert.equal(data.assessmentDraft, null, "REQUEST_GENERATION_JOBS_INVENTED_A_DRAFT_JOB");
  });
});

/*
 * D-25, D-47: every human analyst sees the same current job, and only the analyst who started it may retry it
 * (D-26). The by-id read and retry keep their initiator-only rule (D-27): the second analyst's by-id read is
 * refused exactly as it was before the request read existed.
 */
test("mounted analysts share a request's running job and only its initiator may retry it", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-SHARED");

  await harness.withHeldQuestionnaireGeneration(requestId, async (jobId) => {
    const initiator = await requestGenerationJobs(requestId, harness.identities.analyst);
    const other = await requestGenerationJobs(requestId, harness.identities.secondAnalyst);
    const otherEntry = other.questionnaireGeneration as Record<string, unknown>;
    assert.deepEqual(otherEntry.job, (initiator.questionnaireGeneration as Record<string, unknown>).job, "SECOND_ANALYST_SAW_A_DIFFERENT_JOB");
    assert.equal((otherEntry.job as Record<string, unknown>).jobId, jobId, "SECOND_ANALYST_WRONG_JOB");
    assert.equal(otherEntry.canRetry, false, "SECOND_ANALYST_MAY_RETRY_ANOTHER_ANALYSTS_JOB");
    assert.ok(!JSON.stringify(other).includes(harness.users.analyst), "REQUEST_GENERATION_JOBS_DISCLOSED_THE_INITIATOR");

    const byId = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, harness.identities.secondAnalyst);
    assert.equal(byId.status, 403, "SECOND_ANALYST_BY_ID_READ_WIDENED");
    assert.equal((await body(byId)).data, null, "SECOND_ANALYST_BY_ID_READ_DISCLOSED_THE_JOB");
  });
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
  assert.deepEqual(initiator.assessmentDraft, { job: draftJob, canRetry: true }, "REQUEST_GENERATION_JOBS_DRAFT_JOB");
  const other = await requestGenerationJobs(requestId, harness.identities.secondAnalyst);
  assert.deepEqual(other.assessmentDraft, { job: draftJob, canRetry: false }, "REQUEST_GENERATION_JOBS_SECOND_ANALYST_DRAFT_JOB");
});

/*
 * D-25, D-47, T-10-32: a request with no job reads as two nulls, an unknown request is 404, and nobody but a human
 * Security Analyst reaches the read: not the owning Requestor, another Requestor, the role-less identity, the
 * service agent or a caller with no identity.
 */
test("mounted request generation read answers no jobs, an unknown request and every refused caller", async () => {
  const harness = await harnessPromise;
  const requestId = await submittedRequest("JOBS-NONE");
  assert.deepEqual(await requestGenerationJobs(requestId, harness.identities.analyst), { questionnaireGeneration: null, assessmentDraft: null }, "REQUEST_WITHOUT_JOBS");

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

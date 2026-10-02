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
  assert.equal(job.failureCode, "QUESTIONNAIRE_GENERATION_FAILED", "FULL_LOG_REPLACEMENT_FAILURE_CODE");
  assert.deepEqual(await harness.snapshot([() => harness.getQuestionnaire(questionnaireId), () => harness.getRequest(requestId)]), before, "FULL_LOG_REPLACEMENT_WROTE");
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import {
  assertConflictReason,
  createConflictReasonFixture,
  draftAnswer,
  submittedAnswer,
  type ConflictReasonFixtureInput,
} from "./helpers/conflict-reason-fixtures";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

test("D6: an unrelated Requestor learns no take-back state, while the owner receives QUESTIONNAIRE_NOT_ANSWERABLE", async () => {
  const harness = await harnessPromise;
  const { questionnaireId } = await harness.seedUatALikeRequest("D6-OWNER-STATE");
  const returned = await request(`/api/v1/questionnaires/${questionnaireId}/return_to_review`, harness.identities.analyst, revertRequest({ reason: "Review the questions." }));
  assert.equal(returned.status, 200);
  for (const [suffix, method] of [["answers", "PATCH"], ["submit", "POST"]] as const) {
    const init = { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [] }) };
    const stranger = await request(`/api/v1/questionnaires/${questionnaireId}/${suffix}`, harness.identities.otherRequestor, init);
    assert.equal(stranger.status, 403, "UNRELATED_REQUESTOR_NOT_DENIED");
    assert.ok(!(await stranger.text()).includes("QUESTIONNAIRE_NOT_ANSWERABLE"), "STATE_DISCLOSED_TO_UNRELATED_REQUESTOR");
    const owner = await request(`/api/v1/questionnaires/${questionnaireId}/${suffix}`, harness.identities.owner, init);
    assert.equal(owner.status, 409, "OWNER_STATE_NOT_CONFLICT");
    assert.deepEqual(((await owner.json()) as { error: { details: unknown } }).error.details, { reason: "QUESTIONNAIRE_NOT_ANSWERABLE" });
  }
});

async function request(path: string, identity?: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

async function payload(response: Response): Promise<{ data?: unknown; meta?: unknown; error?: unknown }> {
  return response.json() as Promise<{ data?: unknown; meta?: unknown; error?: unknown }>;
}

function rows(body: { data?: unknown }): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(body.data), "UNEXPECTED_QUESTIONNAIRE_LIST_DATA");
  return body.data as Array<Record<string, unknown>>;
}

function revertRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

test("mounted questionnaire reads enforce owner and explicit analyst scope", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireWorkflowFixtures();

  const requestBaseline = await request("/api/csrm-assessment-requests?pagination[pageSize]=1", harness.identities.owner);
  assert.equal(requestBaseline.status, 200, "BASELINE_REQUEST_AUTHORIZATION_FAILED");
  const ownerListResponse = await request("/api/v1/my_questionnaires?q=Owner&pageSize=100", harness.identities.owner);
  assert.equal(ownerListResponse.status, 200, "UNEXPECTED_OWNER_LIST_STATUS");
  const ownerList = rows(await payload(ownerListResponse));
  assert.ok(ownerList.some((item) => item.documentId === fixtures.questionnaires.ownerDraft), "UNEXPECTED_OWNER_DRAFT_ABSENT");
  assert.ok(ownerList.some((item) => item.documentId === fixtures.questionnaires.ownerSubmitted), "UNEXPECTED_OWNER_SUBMITTED_ABSENT");
  assert.equal(ownerList.some((item) => item.documentId === fixtures.questionnaires.otherDraft), false, "UNEXPECTED_OTHER_QUESTIONNAIRE_LEAK");
  assert.ok(ownerList.every((item) => !Object.keys(item).some((key) => ["questions", "createdBy", "updatedBy"].includes(key))), "UNEXPECTED_LIST_PROJECTION");

  // The collection query is closed: a client-supplied filter or populate is
  // refused outright rather than accepted and quietly ignored, so there is no
  // window in which a crafted filter could widen ownership.
  const hostileList = await request(
    `/api/v1/my_questionnaires?filters[assessmentRequest][requestor][documentId][$eq]=${harness.users.otherRequestor}&pagination[page]=1&pagination[pageSize]=1&sort=updatedAt:desc&populate=questions`,
    harness.identities.owner,
  );
  assert.equal(hostileList.status, 400, "UNEXPECTED_HOSTILE_FILTER_STATUS");
  assert.doesNotMatch(await hostileList.text(), /Other Requestor secret draft|QUES-OTHER-DRAFT-001/, "UNEXPECTED_HOSTILE_FILTER_LEAK");

  const scopedList = rows(await payload(await request(
    "/api/v1/my_questionnaires?q=Owner&page=1&pageSize=1&sort=updatedAt:desc",
    harness.identities.owner,
  )));
  assert.equal(scopedList.some((item) => item.documentId === fixtures.questionnaires.otherDraft), false, "UNEXPECTED_OTHER_QUESTIONNAIRE_LEAK_PAGED");

  const boundedList = await payload(await request(
    "/api/v1/my_questionnaires?q=Owner&page=1&pageSize=1&sort=updatedAt:desc",
    harness.identities.owner,
  ));
  assert.equal(rows(boundedList).length, 1, "UNEXPECTED_BOUNDED_LIST_SIZE");
  assert.deepEqual(boundedList.meta, { pagination: { page: 1, pageSize: 1, pageCount: 2, total: 2 } }, "UNEXPECTED_BOUNDED_LIST_META");

  for (const questionnaireId of [fixtures.questionnaires.ownerDraft, fixtures.questionnaires.ownerSubmitted]) {
    const detail = await request(`/api/v1/questionnaires/${questionnaireId}`, harness.identities.owner);
    assert.equal(detail.status, 200, "UNEXPECTED_OWNER_DETAIL_STATUS");
    const questions = await request(`/api/v1/questionnaires/${questionnaireId}/questions`, harness.identities.owner);
    assert.equal(questions.status, 200, "UNEXPECTED_OWNER_QUESTIONS_STATUS");
  }
  const ownerDraftQuestions = rows(await payload(await request(
    `/api/v1/questionnaires/${fixtures.questionnaires.ownerDraft}/questions`,
    harness.identities.owner,
  )));
  assert.equal((ownerDraftQuestions[0]?.answer as { value?: unknown } | undefined)?.value, "Jane secret draft", "UNEXPECTED_OWNER_DRAFT_PROJECTION");

  const otherQuestionnaireBefore = await harness.getQuestionnaire(fixtures.questionnaires.otherDraft);
  const otherQuestionBefore = await harness.getQuestion(fixtures.questions.otherDraft);
  for (const suffix of ["", "/questions"]) {
    const denied = await request(`/api/v1/questionnaires/${fixtures.questionnaires.otherDraft}${suffix}`, harness.identities.owner);
    assert.equal(denied.status, 403, "UNEXPECTED_DIRECT_IDOR_STATUS");
    const deniedText = await denied.text();
    assert.doesNotMatch(deniedText, /Other Requestor secret draft|Other draft question|QUES-OTHER-DRAFT-001/, "UNEXPECTED_DENIAL_RESPONSE_LEAK");
  }
  assert.deepEqual(await harness.getQuestionnaire(fixtures.questionnaires.otherDraft), otherQuestionnaireBefore, "UNEXPECTED_DENIED_QUESTIONNAIRE_CHANGE");
  assert.deepEqual(await harness.getQuestion(fixtures.questions.otherDraft), otherQuestionBefore, "UNEXPECTED_DENIED_QUESTION_CHANGE");

  const analystList = await request("/api/v1/questionnaires?pageSize=100", harness.identities.analyst);
  assert.equal(analystList.status, 200, "UNEXPECTED_ANALYST_LIST_STATUS");
  const analystRows = rows(await payload(analystList));
  assert.ok(analystRows.some((item) => item.documentId === fixtures.questionnaires.otherDraft), "UNEXPECTED_ANALYST_SCOPE");
  const analystSubmittedQuestions = rows(await payload(await request(
    `/api/v1/questionnaires/${fixtures.questionnaires.ownerSubmitted}/questions`,
    harness.identities.analyst,
  )));
  assert.equal((analystSubmittedQuestions[0]?.answer as { value?: unknown } | undefined)?.value, "Submitted owner answer", "UNEXPECTED_ANALYST_SUBMITTED_PROJECTION");
  const analystDraftQuestions = rows(await payload(await request(
    `/api/v1/questionnaires/${fixtures.questionnaires.ownerDraft}/questions`,
    harness.identities.analyst,
  )));
  assert.equal(analystDraftQuestions[0]?.answer, null, "UNEXPECTED_ANALYST_DRAFT_DISCLOSURE");

  for (const identity of [harness.identities.analystAgent, harness.identities.inactiveAnalyst]) {
    const deniedList = await request("/api/v1/questionnaires", identity);
    assert.equal(deniedList.status, 403, "UNEXPECTED_UNGRANTED_ANALYST_LIST_STATUS");
    const deniedDetail = await request(`/api/v1/questionnaires/${fixtures.questionnaires.otherDraft}`, identity);
    assert.equal(deniedDetail.status, 403, "UNEXPECTED_UNGRANTED_ANALYST_DETAIL_STATUS");
  }
  assert.equal((await request("/api/v1/my_questionnaires")).status, 403, "UNEXPECTED_ANONYMOUS_LIST_STATUS");

  const allOwnerRows = rows(await payload(await request("/api/v1/my_questionnaires?pageSize=100", harness.identities.owner)));
  const statusSummary = await request("/api/v1/my_questionnaires/status_summary", harness.identities.owner);
  assert.equal(statusSummary.status, 200, "UNEXPECTED_OWNER_SUMMARY_STATUS");
  const ownerStates = allOwnerRows.reduce<{ "not-started": number; draft: number; submitted: number }>((counts, row) => {
    const state = String(row.state);
    if (state === "not-started" || state === "draft" || state === "submitted") {
      const key = state as "not-started" | "draft" | "submitted";
      counts[key] += 1;
    }
    return counts;
  }, { "not-started": 0, draft: 0, submitted: 0 });
  assert.deepEqual((await payload(statusSummary)).data, {
    notStarted: ownerStates["not-started"], draft: ownerStates.draft, submitted: ownerStates.submitted, total: allOwnerRows.length,
  }, "UNEXPECTED_OWNER_SUMMARY");
  const reviewSummary = await request("/api/v1/questionnaires/review_summary", harness.identities.analyst);
  assert.equal(reviewSummary.status, 200, "UNEXPECTED_REVIEW_SUMMARY_STATUS");
  const reviewCounts = {
    awaitingSubmission: analystRows.filter((item) => item.state === "not-started" || item.state === "draft").length,
    readyForReview: analystRows.filter((item) => item.state === "submitted").length,
    total: analystRows.length,
  };
  assert.deepEqual((await payload(reviewSummary)).data, reviewCounts, "UNEXPECTED_REVIEW_SUMMARY");

  for (const [method, path] of [
    ["GET", "/api/csrm-questionnaires"],
    ["POST", "/api/csrm-questionnaires"],
    ["PUT", `/api/csrm-questionnaires/${fixtures.questionnaires.ownerDraft}`],
    ["DELETE", `/api/csrm-questionnaires/${fixtures.questionnaires.ownerDraft}`],
    ["GET", "/api/csrm-questions"],
    ["POST", "/api/csrm-questions"],
    ["PUT", `/api/csrm-questions/${fixtures.questions.ownerDraft}`],
    ["DELETE", `/api/csrm-questions/${fixtures.questions.ownerDraft}`],
  ] as const) {
    const generic = await request(path, harness.identities.owner, { method });
    assert.ok([403, 404, 405].includes(generic.status), `UNEXPECTED_GENERIC_ROUTE_${method}_${generic.status}`);
  }

  const missing = await request("/api/v1/questionnaires/missing-questionnaire", harness.identities.analyst);
  assert.equal(missing.status, 404, "UNEXPECTED_ANALYST_MISSING_STATUS");
  assert.doesNotMatch(await missing.text(), /SQL|stack|database/i, "UNEXPECTED_RAW_ERROR_DISCLOSURE");
});

test("mounted questionnaire status filtering keeps authorized rows and totals on one computed-state path", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireWorkflowFixtures();
  const list = async (path: string, identity: string) => {
    const response = await request(path, identity);
    assert.equal(response.status, 200, `QUESTIONNAIRE_STATUS_FILTER_DENIED_${path}`);
    return await payload(response) as { data?: unknown; meta?: { pagination?: { total?: unknown } } };
  };

  const ownerDraft = await list("/api/v1/my_questionnaires?status=draft&q=Owner%20draft&page=1&pageSize=25", harness.identities.owner);
  const ownerDraftRows = rows(ownerDraft);
  assert.deepEqual(ownerDraftRows.map((item) => item.documentId), [fixtures.questionnaires.ownerDraft], "OWNER_DRAFT_STATUS_SCOPE_BYPASSED");
  assert.ok(ownerDraftRows.every((item) => item.state === "draft"), "OWNER_DRAFT_STATUS_MISMATCH");
  assert.equal(ownerDraft.meta?.pagination?.total, ownerDraftRows.length, "OWNER_DRAFT_STATUS_TOTAL_MISMATCH");

  const ownerSubmitted = await list("/api/v1/my_questionnaires?status=submitted&q=Owner&page=1&pageSize=25", harness.identities.owner);
  const ownerSubmittedRows = rows(ownerSubmitted);
  assert.deepEqual(ownerSubmittedRows.map((item) => item.documentId), [fixtures.questionnaires.ownerSubmitted], "OWNER_SUBMITTED_STATUS_SCOPE_BYPASSED");
  assert.ok(ownerSubmittedRows.every((item) => item.state === "submitted"), "OWNER_SUBMITTED_STATUS_MISMATCH");
  assert.equal(ownerSubmitted.meta?.pagination?.total, ownerSubmittedRows.length, "OWNER_SUBMITTED_STATUS_TOTAL_MISMATCH");

  const reviewDraft = await list("/api/v1/questionnaires?status=draft&page=1&pageSize=25", harness.identities.analyst);
  const reviewDraftRows = rows(reviewDraft);
  assert.ok(reviewDraftRows.some((item) => item.documentId === fixtures.questionnaires.ownerDraft), "ANALYST_REVIEW_OWN_DRAFT_MISSING");
  assert.ok(reviewDraftRows.some((item) => item.documentId === fixtures.questionnaires.otherDraft), "ANALYST_REVIEW_SCOPE_NARROWED");
  assert.ok(reviewDraftRows.every((item) => item.state === "draft"), "ANALYST_REVIEW_DRAFT_STATUS_MISMATCH");
  assert.equal(reviewDraft.meta?.pagination?.total, reviewDraftRows.length, "ANALYST_REVIEW_DRAFT_TOTAL_MISMATCH");

  const notStarted = await list("/api/v1/questionnaires?status=not-started&page=1&pageSize=100", harness.identities.analyst);
  assert.ok(rows(notStarted).every((item) => item.state === "not-started"), "NOT_STARTED_STATUS_MISMATCH");
  assert.equal(notStarted.meta?.pagination?.total, rows(notStarted).length, "NOT_STARTED_STATUS_TOTAL_MISMATCH");

  for (const malformed of [
    "/api/v1/my_questionnaires?status=forged",
    "/api/v1/my_questionnaires?status=draft&status=submitted",
    `/api/v1/my_questionnaires?q=${"x".repeat(201)}`,
    "/api/v1/my_questionnaires?page=0",
  ]) {
    assert.equal((await request(malformed, harness.identities.owner)).status, 400, `MALFORMED_STATUS_QUERY_ACCEPTED_${malformed}`);
  }
});

test("mounted questionnaire mutations enforce ownership, allowlisting, and immutable submitted batches", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireWorkflowFixtures();
  const otherBefore = await harness.getQuestion(fixtures.questions.otherDraft);
  const ownerDraftBefore = await harness.getQuestion(fixtures.questions.ownerDraft);
  const submittedBefore = await harness.getQuestion(fixtures.questions.ownerSubmitted);

  for (const [identity, questionnaireId] of [
    [harness.identities.owner, fixtures.questionnaires.otherDraft],
    [harness.identities.analyst, fixtures.questionnaires.ownerDraft],
  ] as const) {
    for (const [method, suffix] of [["PATCH", "/answers"], ["POST", "/submit"]] as const) {
      const denied = await request(`/api/v1/questionnaires/${questionnaireId}${suffix}`, identity, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: [{ questionKey: "other-draft", value: "forged" }] }),
      });
      assert.equal(denied.status, 403, "UNEXPECTED_MUTATION_AUTHORIZATION_STATUS");
      assert.doesNotMatch(await denied.text(), /Other Requestor secret draft|Jane secret draft/i, "UNEXPECTED_MUTATION_DENIAL_LEAK");
      const questionId = questionnaireId === fixtures.questionnaires.ownerDraft
        ? fixtures.questions.ownerDraft
        : fixtures.questions.otherDraft;
      const baseline = questionnaireId === fixtures.questionnaires.ownerDraft ? ownerDraftBefore : otherBefore;
      assert.deepEqual(await harness.getQuestion(questionId), baseline, "UNEXPECTED_DENIED_MUTATION_SIDE_EFFECT");
    }
  }
  assert.deepEqual(await harness.getQuestion(fixtures.questions.otherDraft), otherBefore, "UNEXPECTED_CROSS_OWNER_MUTATION");

  const forged = await request(`/api/v1/questionnaires/${fixtures.questionnaires.ownerDraft}/answers`, harness.identities.owner, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      answers: [{
        questionKey: "owner-draft",
        value: "forged",
        questionText: "forged text",
        answerType: "Boolean",
        options: { schemaVersion: 999 },
        questionnaire: fixtures.questionnaires.otherDraft,
        reviewComment: "forged review",
        state: "submitted",
        updatedAt: "1999-01-01T00:00:00.000Z",
        submittedAt: "1999-01-01T00:00:00.000Z",
      }],
    }),
  });
  assert.equal(forged.status, 400, "UNEXPECTED_MASS_ASSIGNMENT_STATUS");
  assert.deepEqual(await harness.getQuestion(fixtures.questions.ownerDraft), ownerDraftBefore, "UNEXPECTED_MASS_ASSIGNMENT_CHANGE");

  const repeatedSubmit = await request(`/api/v1/questionnaires/${fixtures.questionnaires.ownerSubmitted}/submit`, harness.identities.owner, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: [] }),
  });
  assert.equal(repeatedSubmit.status, 409, "UNEXPECTED_REPEATED_SUBMIT_STATUS");
  assert.deepEqual(await harness.getQuestion(fixtures.questions.ownerSubmitted), submittedBefore, "UNEXPECTED_SUBMITTED_BATCH_CHANGE");

  const saved = await request(`/api/v1/questionnaires/${fixtures.questionnaires.ownerDraft}/answers`, harness.identities.owner, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ questionKey: "owner-draft", value: "Authoritative owner draft" }] }),
  });
  assert.equal(saved.status, 200, "UNEXPECTED_DRAFT_SAVE_STATUS");
  const savedResult = (await payload(saved)).data as Record<string, unknown>;
  assert.equal(savedResult.questionnaireId, fixtures.questionnaires.ownerDraft, "UNEXPECTED_DRAFT_RESULT_ID");
  assert.equal(savedResult.state, "draft", "UNEXPECTED_DRAFT_RESULT_STATE");
  assert.equal(typeof savedResult.updatedAt, "string", "UNEXPECTED_DRAFT_RESULT_TIMESTAMP");
  assert.ok(Array.isArray(savedResult.answers), "UNEXPECTED_DRAFT_RESULT_ANSWERS");
  assert.deepEqual(Object.keys(savedResult).sort(), ["answers", "progress", "questionnaireId", "state", "updatedAt"], "UNEXPECTED_DRAFT_RESULT_PROJECTION");
  const savedQuestion = await harness.getQuestion(fixtures.questions.ownerDraft);
  const savedAnswer = savedQuestion?.answer as Record<string, unknown> | undefined;
  assert.equal(savedAnswer?.value, "Authoritative owner draft", "UNEXPECTED_SAVED_VALUE");
  assert.equal(savedAnswer?.state, "draft", "UNEXPECTED_SAVED_STATE");
  assert.equal(typeof savedAnswer?.updatedAt, "string", "UNEXPECTED_SAVED_TIMESTAMP");
  assert.notEqual(savedAnswer?.updatedAt, "1999-01-01T00:00:00.000Z", "UNEXPECTED_CLIENT_TIMESTAMP");

  const submitted = await request(`/api/v1/questionnaires/${fixtures.questionnaires.ownerDraft}/submit`, harness.identities.owner, {
    method: "POST",
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_VALID_SUBMIT_STATUS");
  const submittedResult = (await payload(submitted)).data as Record<string, unknown>;
  assert.equal(submittedResult.questionnaireId, fixtures.questionnaires.ownerDraft, "UNEXPECTED_SUBMIT_RESULT_ID");
  assert.equal(submittedResult.state, "submitted", "UNEXPECTED_SUBMIT_RESULT_STATE");
  assert.equal(submittedResult.updatedAt, submittedResult.submittedAt, "UNEXPECTED_SUBMIT_RESULT_TIMESTAMP");
  assert.ok(Array.isArray(submittedResult.answers), "UNEXPECTED_SUBMIT_RESULT_ANSWERS");
  assert.deepEqual(Object.keys(submittedResult).sort(), ["answers", "progress", "questionnaireId", "state", "submittedAt", "updatedAt"], "UNEXPECTED_SUBMIT_RESULT_PROJECTION");
  const submittedQuestion = await harness.getQuestion(fixtures.questions.ownerDraft);
  const submittedAnswer = submittedQuestion?.answer as Record<string, unknown> | undefined;
  assert.equal(submittedAnswer?.state, "submitted", "UNEXPECTED_SUBMITTED_STATE");
  assert.equal(submittedAnswer?.updatedAt, submittedAnswer?.submittedAt, "UNEXPECTED_BATCH_TIMESTAMP");
  assert.equal((await harness.getRequest(fixtures.requests.ownerDraft))?.requestStatus, "questionnaire-in-progress", "UNEXPECTED_DIRECT_SUBMIT_REQUEST_STATUS");
});

test("mounted conditional submission projects the active batch as complete everywhere", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedConditionalQuestionnaireFixture();
  const summaryBefore = (await payload(await request("/api/v1/my_questionnaires/status_summary", harness.identities.owner))).data as Record<string, number>;
  const analystSummaryBefore = (await payload(await request("/api/v1/questionnaires/review_summary", harness.identities.analyst))).data as Record<string, number>;

  const submitted = await request(`/api/v1/questionnaires/${fixture.questionnaire}/submit`, harness.identities.owner, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ questionKey: "internet-facing", value: false }] }),
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_CONDITIONAL_SUBMIT_STATUS");
  const submittedData = (await payload(submitted)).data as Record<string, unknown>;
  assert.equal(submittedData.state, "submitted", "UNEXPECTED_CONDITIONAL_MUTATION_STATE");
  assert.deepEqual(submittedData.progress, { answered: 1, total: 1, percent: 100 }, "UNEXPECTED_CONDITIONAL_MUTATION_PROGRESS");

  // The collection is paged at 25 by default and the harness seeds more than
  // that across its fixtures, so this asks for a page wide enough to contain
  // the questionnaire under test rather than relying on ordering.
  const ownerList = rows(await payload(await request("/api/v1/my_questionnaires?pageSize=100", harness.identities.owner)));
  const ownerRow = ownerList.find((item) => item.documentId === fixture.questionnaire);
  assert.equal(ownerRow?.state, "submitted", "UNEXPECTED_CONDITIONAL_OWNER_LIST_STATE");
  assert.deepEqual(ownerRow?.progress, { answered: 1, total: 1, percent: 100 }, "UNEXPECTED_CONDITIONAL_OWNER_LIST_PROGRESS");

  const ownerDetail = await payload(await request(`/api/v1/questionnaires/${fixture.questionnaire}`, harness.identities.owner));
  assert.equal((ownerDetail.data as Record<string, unknown>)?.state, "submitted", "UNEXPECTED_CONDITIONAL_OWNER_DETAIL_STATE");
  const ownerSummary = await payload(await request("/api/v1/my_questionnaires/status_summary", harness.identities.owner));
  assert.equal((ownerSummary.data as Record<string, unknown>)?.submitted, summaryBefore.submitted + 1, "UNEXPECTED_CONDITIONAL_OWNER_SUMMARY");

  // Paged at 25 by default, and the analyst sees every questionnaire the
  // harness seeds, so this asks for a page wide enough to hold the fixture.
  const analystList = rows(await payload(await request("/api/v1/questionnaires?pageSize=100", harness.identities.analyst)));
  assert.equal(analystList.find((item) => item.documentId === fixture.questionnaire)?.state, "submitted", "UNEXPECTED_CONDITIONAL_ANALYST_LIST_STATE");
  const analystDetail = await payload(await request(`/api/v1/questionnaires/${fixture.questionnaire}`, harness.identities.analyst));
  assert.equal((analystDetail.data as Record<string, unknown>)?.state, "submitted", "UNEXPECTED_CONDITIONAL_ANALYST_DETAIL_STATE");
  const analystSummary = await payload(await request("/api/v1/questionnaires/review_summary", harness.identities.analyst));
  assert.equal((analystSummary.data as Record<string, unknown>)?.readyForReview, analystSummaryBefore.readyForReview + 1, "UNEXPECTED_CONDITIONAL_ANALYST_SUMMARY");

  const analystQuestions = rows(await payload(await request(
    `/api/v1/questionnaires/${fixture.questionnaire}/questions`,
    harness.identities.analyst,
  )));
  assert.equal((analystQuestions[0]?.answer as Record<string, unknown>)?.value, false, "UNEXPECTED_CONDITIONAL_ANALYST_ANSWER");
  assert.equal(analystQuestions[1]?.answer, null, "UNEXPECTED_CONDITIONAL_HIDDEN_ANSWER");
  assert.equal((await harness.getQuestion(fixture.questions.dependent))?.answer, null, "UNEXPECTED_PERSISTED_HIDDEN_ANSWER");
});

test("mounted concurrent questionnaire mutations preserve drafts and submission immutability", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedConcurrentQuestionnaireFixtures();
  const mutation = (questionnaire: string, method: "PATCH" | "POST", suffix: "answers" | "submit", answers: unknown[]) =>
    request(`/api/v1/questionnaires/${questionnaire}/${suffix}`, harness.identities.owner, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });

  const draftResponses = await Promise.all([
    mutation(fixtures.patchPatch.questionnaire, "PATCH", "answers", [{ questionKey: "first", value: "first draft" }]),
    mutation(fixtures.patchPatch.questionnaire, "PATCH", "answers", [{ questionKey: "second", value: "second draft" }]),
  ]);
  assert.deepEqual(draftResponses.map(({ status }) => status), [200, 200], "UNEXPECTED_CONCURRENT_DRAFT_STATUSES");
  assert.equal(((await harness.getQuestion(fixtures.patchPatch.questions.first))?.answer as Record<string, unknown>)?.value, "first draft", "UNEXPECTED_CONCURRENT_FIRST_DRAFT");
  assert.equal(((await harness.getQuestion(fixtures.patchPatch.questions.second))?.answer as Record<string, unknown>)?.value, "second draft", "UNEXPECTED_CONCURRENT_SECOND_DRAFT");

  const submitResponses = await Promise.all([
    mutation(fixtures.patchSubmit.questionnaire, "PATCH", "answers", [{ questionKey: "first", value: "stale draft" }]),
    mutation(fixtures.patchSubmit.questionnaire, "POST", "submit", [
      { questionKey: "first", value: "submitted first" },
      { questionKey: "second", value: "submitted second" },
    ]),
  ]);
  const statuses = submitResponses.map(({ status }) => status).sort();
  assert.ok(
    JSON.stringify(statuses) === JSON.stringify([200, 200]) || JSON.stringify(statuses) === JSON.stringify([200, 409]),
    `UNEXPECTED_CONCURRENT_SUBMIT_STATUSES_${statuses.join("_")}`,
  );
  for (const questionId of Object.values(fixtures.patchSubmit.questions)) {
    const answer = (await harness.getQuestion(questionId))?.answer as Record<string, unknown> | undefined;
    assert.equal(answer?.state, "submitted", "UNEXPECTED_CONCURRENT_SUBMITTED_STATE");
    assert.equal(typeof answer?.submittedAt, "string", "UNEXPECTED_CONCURRENT_SUBMITTED_TIMESTAMP");
  }
});

test("mounted production submission rolls back every answer when its second update fails", async () => {
  const harness = await harnessPromise;
  const fixture = (await harness.seedConcurrentQuestionnaireFixtures()).patchPatch;
  const before = await Promise.all([
    harness.getQuestion(fixture.questions.first),
    harness.getQuestion(fixture.questions.second),
  ]);
  const requestBefore = await harness.getRequest(fixture.request);

  const response = await harness.withQuestionUpdateFailure(2, () => request(
    `/api/v1/questionnaires/${fixture.questionnaire}/submit`,
    harness.identities.owner,
    { method: "POST" },
  ));
  assert.equal(response.status, 500, "UNEXPECTED_INJECTED_SUBMISSION_STATUS");

  const after = await Promise.all([
    harness.getQuestion(fixture.questions.first),
    harness.getQuestion(fixture.questions.second),
  ]);
  assert.deepEqual(after, before, "UNEXPECTED_PARTIAL_SUBMISSION_PERSISTENCE");
  assert.deepEqual(await harness.getRequest(fixture.request), requestBefore, "UNEXPECTED_REQUEST_STATUS_AFTER_ROLLBACK");
});

test("questionnaire reversal preserves values, audit facts, and refusal persistence", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireWorkflowFixtures();
  const path = (questionnaireId: string) => `/api/v1/questionnaires/${questionnaireId}/revert_to_draft`;
  const submittedBefore = await harness.getQuestion(fixtures.questions.ownerSubmitted);
  const requestBefore = await harness.getRequest(fixtures.requests.ownerSubmitted);
  const ownerRevert = await request(path(fixtures.questionnaires.ownerSubmitted), harness.identities.owner, revertRequest({ reason: "  Correct submitted service details.  " }));
  assert.equal(ownerRevert.status, 200, "UNEXPECTED_OWNER_QUESTIONNAIRE_REVERT_STATUS");

  const ownerQuestionnaire = await harness.getQuestionnaire(fixtures.questionnaires.ownerSubmitted);
  const ownerAnswer = (await harness.getQuestion(fixtures.questions.ownerSubmitted))?.answer as Record<string, unknown> | undefined;
  assert.equal(ownerQuestionnaire?.revertReason, "Correct submitted service details.", "UNEXPECTED_OWNER_REVERT_REASON");
  assert.equal(typeof ownerQuestionnaire?.revertedAt, "string", "UNEXPECTED_OWNER_REVERTED_AT");
  assert.equal((ownerQuestionnaire?.revertedBy as { documentId?: unknown } | undefined)?.documentId, harness.users.owner, "UNEXPECTED_OWNER_REVERTED_BY");
  assert.equal(ownerAnswer?.value, (submittedBefore?.answer as Record<string, unknown> | undefined)?.value, "UNEXPECTED_REVERTED_VALUE");
  assert.equal(ownerAnswer?.state, "draft", "UNEXPECTED_REVERTED_ANSWER_STATE");
  assert.equal(ownerAnswer?.submittedAt, undefined, "UNEXPECTED_REVERTED_SUBMITTED_AT");
  assert.equal((await harness.getRequest(fixtures.requests.ownerSubmitted))?.requestStatus, requestBefore?.requestStatus, "UNEXPECTED_PARENT_STATUS_CHANGE");
  assert.equal(rows(await payload(await request(`/api/v1/questionnaires/${fixtures.questionnaires.ownerSubmitted}/questions`, harness.identities.analyst)))[0]?.answer, null, "UNEXPECTED_ANALYST_REVERTED_DRAFT_DISCLOSURE");

  const deniedBefore = await harness.getQuestionnaire(fixtures.questionnaires.otherDraft);
  const deniedQuestionBefore = await harness.getQuestion(fixtures.questions.otherDraft);
  /*
   * otherDraft belongs to otherRequestor and has never been submitted, so its
   * own owner is refused for state (409) while Jane is refused for ownership
   * (403) before her body is ever parsed. Asserting the exact status per case
   * proves the refusal came from the intended guard, not an incidental one.
   */
  for (const [identity, body, expectedStatus, because] of [
    [harness.identities.otherRequestor, { reason: "Owner of a questionnaire that was never submitted" }, 409, "NOT_SUBMITTED"],
    [harness.identities.owner, {}, 403, "NOT_OWNER_MISSING_REASON"],
    [harness.identities.owner, { reason: "   " }, 403, "NOT_OWNER_BLANK_REASON"],
    [harness.identities.owner, { reason: "x".repeat(501) }, 403, "NOT_OWNER_OVERLONG_REASON"],
  ] as const) {
    const denied = await request(path(fixtures.questionnaires.otherDraft), identity, revertRequest(body));
    assert.equal(denied.status, expectedStatus, `UNEXPECTED_REVERT_DENIAL_STATUS_${because}_${denied.status}`);
    assert.deepEqual(await harness.getQuestionnaire(fixtures.questionnaires.otherDraft), deniedBefore, "UNEXPECTED_REVERT_DENIAL_QUESTIONNAIRE_WRITE");
    assert.deepEqual(await harness.getQuestion(fixtures.questions.otherDraft), deniedQuestionBefore, "UNEXPECTED_REVERT_DENIAL_ANSWER_WRITE");
  }
});

/*
 * D-22: every refusal of a Requestor's save, submit or return to draft names the one rule that
 * refused it in error.details.reason, and writes nothing. Each case runs on its own fixture.
 */
test("mounted questionnaire answer and reversal conflicts name their reason and write nothing", async () => {
  const harness = await harnessPromise;
  const owner = harness.identities.owner;
  const fixture = (input: Omit<ConflictReasonFixtureInput, "label" | "released">) => createConflictReasonFixture(harness, { label: "QWF", released: true, ...input });
  const save = (questionnaireId: string) => () => request(`/api/v1/questionnaires/${questionnaireId}/answers`, owner, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ questionKey: "service", value: "A new answer" }] }),
  });
  const submit = (questionnaireId: string) => () => request(`/api/v1/questionnaires/${questionnaireId}/submit`, owner, { method: "POST" });
  const revert = (questionnaireId: string) => () => request(`/api/v1/questionnaires/${questionnaireId}/revert_to_draft`, owner, revertRequest({ reason: "Correct an answer." }));

  const submitted = await fixture({ requestStatus: "questionnaire-in-progress", questions: [{ key: "service", order: 1, answer: submittedAnswer("Submitted answer") }] });
  await assertConflictReason(harness, submitted, save(submitted.questionnaireId), "QUESTIONNAIRE_ALREADY_SUBMITTED", "SAVE_SUBMITTED");
  await assertConflictReason(harness, submitted, submit(submitted.questionnaireId), "QUESTIONNAIRE_ALREADY_SUBMITTED", "SUBMIT_TWICE");

  const pastAnswering = await fixture({ requestStatus: "under-review", questions: [{ key: "service", order: 1, answer: draftAnswer("Draft answer") }] });
  await assertConflictReason(harness, pastAnswering, save(pastAnswering.questionnaireId), "QUESTIONNAIRE_NOT_ANSWERABLE", "SAVE_NOT_ANSWERABLE");
  await assertConflictReason(harness, pastAnswering, submit(pastAnswering.questionnaireId), "QUESTIONNAIRE_NOT_ANSWERABLE", "SUBMIT_NOT_ANSWERABLE");

  const incomplete = await fixture({ requestStatus: "questionnaire-in-progress", questions: [{ key: "service", order: 1 }] });
  await assertConflictReason(harness, incomplete, submit(incomplete.questionnaireId), "QUESTIONNAIRE_INCOMPLETE", "SUBMIT_INCOMPLETE");

  const noActiveQuestion = await fixture({ requestStatus: "questionnaire-in-progress", questions: [{ key: "removed", order: 1, deleted: true }] });
  await assertConflictReason(harness, noActiveQuestion, submit(noActiveQuestion.questionnaireId), "QUESTIONNAIRE_HAS_NO_QUESTIONS", "SUBMIT_WITHOUT_ACTIVE_QUESTION");

  const drafting = await fixture({ requestStatus: "questionnaire-in-progress", questions: [{ key: "service", order: 1, answer: draftAnswer("Draft answer") }] });
  await assertConflictReason(harness, drafting, revert(drafting.questionnaireId), "QUESTIONNAIRE_NOT_SUBMITTED", "REVERT_NOT_SUBMITTED");

  const assessed = await fixture({ requestStatus: "risk-assessment-drafted", questions: [{ key: "service", order: 1, answer: submittedAnswer("Submitted answer") }], assessment: true });
  await assertConflictReason(harness, assessed, revert(assessed.questionnaireId), "ASSESSMENT_STARTED", "REVERT_AFTER_ASSESSMENT");
  const assessedInProgress = await fixture({ requestStatus: "questionnaire-in-progress", questions: [{ key: "service", order: 1, answer: submittedAnswer("Submitted answer") }], assessment: true });
  await assertConflictReason(harness, assessedInProgress, revert(assessedInProgress.questionnaireId), "ASSESSMENT_STARTED", "REVERT_WITH_ASSESSMENT");
  const notEligible = await fixture({ requestStatus: "submitted", questions: [{ key: "service", order: 1, answer: submittedAnswer("Submitted answer") }] });
  await assertConflictReason(harness, notEligible, revert(notEligible.questionnaireId), "REQUEST_NOT_ELIGIBLE", "REVERT_NOT_ELIGIBLE");
});

/*
 * Phase 13 D-29 (success criterion 5; G-3): after a questionnaire is generated, an analyst's questionnaire read and
 * request read say which notes changed its AI inputs since that generation: marked since the run that generated it, or
 * included by that run and since unmarked. A generation with the note marked clears the signal. The Requestor never
 * sees it, on the request read or the questionnaire read.
 */
async function generationOutcome(jobId: string, identity: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(response.status, 200, "AI_INPUTS_GENERATION_JOB_READ");
    const job = (await payload(response)).data as Record<string, unknown>;
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("AI_INPUTS_GENERATION_DID_NOT_FINISH");
}

async function generateQuestionnaireAs(identity: string, requestId: string, replace: boolean): Promise<string> {
  const queued = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/generate_questionnaire`, identity, {
    method: "POST",
    ...(replace ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ replaceUnansweredQuestionnaire: true }) } : {}),
  });
  assert.equal(queued.status, 202, `AI_INPUTS_GENERATION_NOT_QUEUED_${replace ? "REPLACE" : "FIRST"}`);
  const job = await generationOutcome(String(((await payload(queued)).data as Record<string, unknown>).jobId), identity);
  assert.equal(job.status, "completed", `AI_INPUTS_GENERATION_FAILED_${String(job.failureCode)}`);
  return String((job.questionnaire as Record<string, unknown>).documentId);
}

async function setNoteMark(requestId: string, noteId: string, identity: string, changesAiInputs: boolean): Promise<void> {
  const response = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes/${encodeURIComponent(noteId)}/ai_input`, identity, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { changesAiInputs } }),
  });
  assert.equal(response.status, 200, `AI_INPUTS_MARK_${String(changesAiInputs).toUpperCase()}_STATUS`);
}

async function readJson(path: string, identity: string, diagnostic: string): Promise<{ data: Record<string, unknown>; text: string }> {
  const response = await request(path, identity);
  assert.equal(response.status, 200, diagnostic);
  const text = await response.text();
  return { data: (JSON.parse(text) as { data: Record<string, unknown> }).data, text };
}

test("mounted analyst reads say which marked notes changed the questionnaire's AI inputs since it was generated, and the Requestor's never do (D-29)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "QWF-AI-INPUTS-001", title: "AI inputs signal request", requestStatus: "submitted", submittedDate: "2026-10-01T00:00:00.000Z", requestor: "owner",
  });
  const questionnaireId = await generateQuestionnaireAs(analyst, requestId, false);
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;
  const requestPath = `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`;
  const generationOf = async () => ((await readJson(questionnairePath, analyst, "AI_INPUTS_ANALYST_QUESTIONNAIRE_READ")).data.generation as Record<string, unknown>);

  // Generated with nothing marked, and nothing marked since: no change.
  assert.equal((await generationOf()).aiInputsChanged, null, "AI_INPUTS_CHANGED_BEFORE_ANY_NOTE");

  const added = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes`, owner, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { body: "The vendor now hosts the payroll files in a second region." } }),
  });
  assert.equal(added.status, 200, "AI_INPUTS_JANE_NOTE");
  const note = (await payload(added)).data as Record<string, unknown>;
  await setNoteMark(requestId, String(note.documentId), analyst, true);

  const marked = { count: 1, notes: [{ documentId: note.documentId, part: "requestor", sequence: 1, postedAt: note.postedAt, change: "marked" }], files: [] };
  assert.deepEqual((await generationOf()).aiInputsChanged, marked, "AI_INPUTS_MARKED_NOTE_NOT_LISTED");
  // WR-202: the Security Analyst Agent reads the analyst questionnaire too, but the signal is human analyst work only.
  const agentQuestionnaire = await readJson(questionnairePath, harness.identities.serviceAnalystAgent, "AI_INPUTS_AGENT_QUESTIONNAIRE_READ");
  const agentGeneration = agentQuestionnaire.data.generation as Record<string, unknown> | null;
  assert.ok(agentGeneration !== null && typeof agentGeneration === "object", "AI_INPUTS_AGENT_QUESTIONNAIRE_GENERATION_MISSING");
  assert.equal(agentGeneration.aiInputsChanged, null, "AI_INPUTS_AGENT_QUESTIONNAIRE_SIGNAL");
  assert.ok(!agentQuestionnaire.text.includes(String(note.documentId)), "AI_INPUTS_AGENT_QUESTIONNAIRE_SAW_THE_NOTE");
  const bobRequest = (await readJson(requestPath, analyst, "AI_INPUTS_BOB_REQUEST_READ")).data;
  assert.deepEqual(bobRequest.aiInputs, { questionnaire: marked, assessment: null }, "AI_INPUTS_BOB_REQUEST_READ_SIGNAL");
  const janeRequest = await readJson(requestPath, owner, "AI_INPUTS_JANE_REQUEST_READ");
  assert.equal(janeRequest.data.aiInputs, null, "AI_INPUTS_JANE_REQUEST_READ_SIGNAL");
  assert.ok(!janeRequest.text.includes("aiInputsChanged") && !janeRequest.text.includes('"change"'), "AI_INPUTS_JANE_REQUEST_READ_DISCLOSED");

  // A generation that included the marked note clears the signal.
  assert.equal(await generateQuestionnaireAs(analyst, requestId, true), questionnaireId, "AI_INPUTS_REPLACEMENT_CHANGED_QUESTIONNAIRE");
  assert.equal((await generationOf()).aiInputsChanged, null, "AI_INPUTS_INCLUDED_NOTE_STILL_LISTED");
  assert.deepEqual(((await readJson(requestPath, analyst, "AI_INPUTS_BOB_REQUEST_AFTER_REPLACEMENT")).data.aiInputs as Record<string, unknown>).questionnaire, null, "AI_INPUTS_REQUEST_READ_AFTER_REPLACEMENT");

  // Unmarking a note that generation included is a change too.
  await setNoteMark(requestId, String(note.documentId), analyst, false);
  const unmarked = { count: 1, notes: [{ documentId: note.documentId, part: "requestor", sequence: 1, postedAt: note.postedAt, change: "unmarked" }], files: [] };
  assert.deepEqual((await generationOf()).aiInputsChanged, unmarked, "AI_INPUTS_UNMARKED_NOTE_NOT_LISTED");
  assert.deepEqual(((await readJson(requestPath, analyst, "AI_INPUTS_BOB_REQUEST_AFTER_UNMARK")).data.aiInputs as Record<string, unknown>).questionnaire, unmarked, "AI_INPUTS_REQUEST_READ_AFTER_UNMARK");

  // Released to Jane, her questionnaire read carries no generation block and no signal.
  assert.equal((await request(`${questionnairePath}/release`, analyst, { method: "POST" })).status, 200, "AI_INPUTS_RELEASE");
  const janeQuestionnaire = await readJson(questionnairePath, owner, "AI_INPUTS_JANE_QUESTIONNAIRE_READ");
  assert.ok(!("generation" in janeQuestionnaire.data), "AI_INPUTS_JANE_QUESTIONNAIRE_GENERATION");
  for (const forbidden of ["aiInputsChanged", '"change"', String(note.documentId)]) {
    assert.ok(!janeQuestionnaire.text.includes(forbidden), `AI_INPUTS_JANE_QUESTIONNAIRE_DISCLOSED_${forbidden}`);
  }
});

async function addRequestNote(requestId: string, identity: string, body: string): Promise<Record<string, unknown>> {
  const response = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes`, identity, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { body } }),
  });
  assert.equal(response.status, 200, "AI_INPUTS_NOTE_POST");
  return (await payload(response)).data as Record<string, unknown>;
}

/** A questionnaire generated before Phase 12 (its generation facts and no run), released to Jane, with one question. */
async function legacyGeneratedQuestionnaire(label: string): Promise<{ requestId: string; questionnaireId: string }> {
  const harness = await harnessPromise;
  const at = "2026-09-01T00:00:00.000Z";
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: `QWF-AI-INPUTS-${label}`, title: `AI inputs ${label.toLowerCase()} request`, requestStatus: "questionnaire-in-progress", submittedDate: "2026-08-30T00:00:00.000Z", requestor: "owner",
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: `QUES-AI-INPUTS-${label}`, title: `AI inputs ${label.toLowerCase()}`, assessmentRequest: requestId,
    generatedDate: at, generatedBy: harness.users.analyst, providerName: "legacy-provider", providerVersion: "1",
    releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Which service does this request cover?", answerType: "Text", answer: null, questionnaire: questionnaireId,
    options: { schemaVersion: 1, questionKey: "service", section: { key: "context", title: "Context", order: 0 }, order: 0, required: true },
  });
  return { requestId, questionnaireId };
}

/*
 * Phase 13 D-29: a questionnaire generated before Phase 12 has no run, so it compares by its generatedDate: a note marked
 * after it is listed. A questionnaire that was never generated has no baseline, so no signal, on either read.
 */
test("mounted questionnaire generated before run records compares by its generation date, and a seeded one has no signal (D-29)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const legacy = await legacyGeneratedQuestionnaire("LEGACY");
  const legacyPath = `/api/v1/questionnaires/${encodeURIComponent(legacy.questionnaireId)}`;
  const legacyGeneration = async () => ((await readJson(legacyPath, analyst, "AI_INPUTS_LEGACY_READ")).data.generation as Record<string, unknown>);
  const note = await addRequestNote(legacy.requestId, owner, "The payroll files now go to a second processor.");
  assert.equal((await legacyGeneration()).aiInputsChanged, null, "AI_INPUTS_LEGACY_UNMARKED_NOTE_LISTED");
  await setNoteMark(legacy.requestId, String(note.documentId), analyst, true);
  const generation = await legacyGeneration();
  assert.equal(generation.runId, null, "AI_INPUTS_LEGACY_HAS_A_RUN");
  const marked = { count: 1, notes: [{ documentId: note.documentId, part: "requestor", sequence: 1, postedAt: note.postedAt, change: "marked" }], files: [] };
  assert.deepEqual(generation.aiInputsChanged, marked, "AI_INPUTS_LEGACY_MARKED_NOTE_NOT_LISTED");
  const legacyRequest = (await readJson(`/api/csrm-assessment-requests/${encodeURIComponent(legacy.requestId)}`, analyst, "AI_INPUTS_LEGACY_REQUEST_READ")).data;
  assert.deepEqual(legacyRequest.aiInputs, { questionnaire: marked, assessment: null }, "AI_INPUTS_LEGACY_REQUEST_READ_SIGNAL");

  // Seeded by hand, never generated: no generation block and no signal, even with a marked note.
  const seededRequest = await harness.createAssessmentRequestFixture({
    requestNumber: "QWF-AI-INPUTS-SEEDED", title: "AI inputs seeded request", requestStatus: "questionnaire-in-progress", submittedDate: "2026-08-30T00:00:00.000Z", requestor: "owner",
  });
  const seededQuestionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-AI-INPUTS-SEEDED", title: "AI inputs seeded", assessmentRequest: seededRequest,
  });
  const seededNote = await addRequestNote(seededRequest, owner, "A note on a questionnaire nobody generated.");
  await setNoteMark(seededRequest, String(seededNote.documentId), analyst, true);
  const seeded = (await readJson(`/api/v1/questionnaires/${encodeURIComponent(seededQuestionnaire)}`, analyst, "AI_INPUTS_SEEDED_READ")).data;
  assert.ok(!("generation" in seeded), "AI_INPUTS_SEEDED_GENERATION");
  const seededRead = (await readJson(`/api/csrm-assessment-requests/${encodeURIComponent(seededRequest)}`, analyst, "AI_INPUTS_SEEDED_REQUEST_READ")).data;
  assert.deepEqual(seededRead.aiInputs, { questionnaire: null, assessment: null }, "AI_INPUTS_SEEDED_REQUEST_READ_SIGNAL");
});

/*
 * Phase 13 D-16, D-25 (REQ-08 criterion 1): the analyst's questionnaire read names who holds the request, whether the
 * viewer may pick it up, and the notes figures, for the page to server-render; Jane's read carries neither.
 */
test("mounted analyst questionnaire read's request summary carries the assignee, the pick-up state and the notes; Jane's carries neither (D-16, D-25)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const fixture = await legacyGeneratedQuestionnaire("SUMMARY");
  const path = `/api/v1/questionnaires/${encodeURIComponent(fixture.questionnaireId)}`;
  await addRequestNote(fixture.requestId, owner, "Jane's first note on the request.");
  const summaryFor = async (identity: string, diagnostic: string) => (await readJson(path, identity, diagnostic)).data.assessmentRequest as Record<string, unknown>;

  const before = await summaryFor(analyst, "SUMMARY_BOB_BEFORE_PICK_UP");
  assert.equal(before.availability, "available", "SUMMARY_NOT_AVAILABLE");
  assert.deepEqual(before.assignment, { assignee: null, pickUp: "allowed" }, "SUMMARY_ASSIGNMENT_BEFORE_PICK_UP");
  assert.deepEqual(before.notes, { total: 1, unread: 1 }, "SUMMARY_NOTES_BEFORE_PICK_UP");

  const pickUp = await request(`/api/v1/assessment_requests/${encodeURIComponent(fixture.requestId)}/assignee`, analyst, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { analyst: harness.users.analyst, expectedAnalyst: null } }),
  });
  assert.equal(pickUp.status, 200, "SUMMARY_PICK_UP");
  const after = await summaryFor(analyst, "SUMMARY_BOB_AFTER_PICK_UP");
  assert.deepEqual(after.assignment, { assignee: { documentId: harness.users.analyst, displayName: "Bob Doe" }, pickUp: "not-offered" }, "SUMMARY_ASSIGNMENT_AFTER_PICK_UP");
  assert.deepEqual(after.notes, { total: 1, unread: 1 }, "SUMMARY_NOTES_AFTER_PICK_UP");

  const jane = await summaryFor(owner, "SUMMARY_JANE_READ");
  assert.equal(jane.assignment, null, "SUMMARY_JANE_ASSIGNMENT");
  assert.equal(jane.notes, null, "SUMMARY_JANE_NOTES");
});

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const ATTACHMENT_FIXTURES = path.resolve(__dirname, "..", "..", "..", "tests", "fixtures", "attachments");
const VENDOR_PACK = readFileSync(path.join(ATTACHMENT_FIXTURES, "vendor-security-pack.pdf"));
const DATA_FLOW = readFileSync(path.join(ATTACHMENT_FIXTURES, "data-flow.docx"));

function attachmentsPath(requestId: string): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/attachments`;
}

/** Uploads one file as `identity`, posted with a note of theirs on a submitted request, and returns its documentId. */
async function addRequestFile(requestId: string, identity: string, fileName: string, bytes: Uint8Array): Promise<string> {
  const note = await addRequestNote(requestId, identity, `${fileName} is attached.`);
  const form = new FormData();
  form.set("file", new File([bytes], fileName));
  form.set("noteId", String(note.documentId));
  const response = await request(attachmentsPath(requestId), identity, { method: "POST", body: form });
  assert.equal(response.status, 201, `FILES_UPLOAD_${fileName}: ${await response.clone().text()}`);
  return String(((await payload(response)).data as Record<string, unknown>).documentId);
}

async function putAttachment(requestId: string, attachmentId: string, action: "ai_input" | "removal", identity: string, data: Record<string, unknown>): Promise<void> {
  const response = await request(`${attachmentsPath(requestId)}/${encodeURIComponent(attachmentId)}/${action}`, identity, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }),
  });
  assert.equal(response.status, 200, `FILES_${action.toUpperCase()}: ${await response.clone().text()}`);
}

/*
 * Phase 14 D-27 (14-UI-SPEC §6.1): the analyst's questionnaire read's request summary says how many files the request holds
 * and how many are included in the AI inputs, for the page to server-render under the request link; Jane's carries neither.
 */
test("mounted analyst questionnaire read's request summary counts the request's files and those in the AI inputs; Jane's carries none (D-27)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const fixture = await legacyGeneratedQuestionnaire("FILES");
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(fixture.questionnaireId)}`;
  const summaryFor = async (identity: string, diagnostic: string) => (await readJson(questionnairePath, identity, diagnostic)).data.assessmentRequest as Record<string, unknown>;

  assert.deepEqual((await summaryFor(analyst, "FILES_BOB_BEFORE_ANY_FILE")).files, { count: 0, included: 0 }, "FILES_BEFORE_ANY_FILE");

  const packId = await addRequestFile(fixture.requestId, owner, "vendor-security-pack.pdf", VENDOR_PACK);
  const dataFlowId = await addRequestFile(fixture.requestId, owner, "data-flow.docx", DATA_FLOW);
  await putAttachment(fixture.requestId, packId, "ai_input", analyst, { included: true });
  assert.deepEqual((await summaryFor(analyst, "FILES_BOB_TWO_FILES")).files, { count: 2, included: 1 }, "FILES_TWO_FILES_ONE_INCLUDED");

  // A removed file no longer counts.
  await putAttachment(fixture.requestId, dataFlowId, "removal", owner, { removed: true });
  assert.deepEqual((await summaryFor(analyst, "FILES_BOB_AFTER_REMOVAL")).files, { count: 1, included: 1 }, "FILES_AFTER_REMOVAL");

  const jane = await readJson(questionnairePath, owner, "FILES_JANE_READ");
  assert.equal((jane.data.assessmentRequest as Record<string, unknown>).files, null, "FILES_JANE_SUMMARY");
  assert.ok(!jane.text.includes('"included"'), "FILES_JANE_SAW_THE_AI_INCLUSION");
});

/*
 * Phase 14 D-36 (14-UI-SPEC §6.2; 14-PLAN-CHECK iteration 2, S-1): after Bob generates the questionnaire with the vendor
 * pack included, he includes the register and excludes the pack, changing no note. The signal names both files, with no
 * note, on his questionnaire read and on his request read alike; Jane's reads carry no signal.
 */
test("mounted analyst reads say which files changed the questionnaire's AI inputs since it was generated, with no note changed, and Jane's never do (D-36)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "QWF-AI-INPUTS-FILE-SIGNAL", title: "AI inputs file signal request", requestStatus: "submitted", submittedDate: "2026-10-01T00:00:00.000Z", requestor: "owner",
  });
  const csvId = await addRequestFile(requestId, owner, "register.csv", new TextEncoder().encode("asset,owner\nPayroll register,Human Resources\n"));
  const packId = await addRequestFile(requestId, owner, "vendor-security-pack.pdf", VENDOR_PACK);
  await putAttachment(requestId, packId, "ai_input", analyst, { included: true });
  const questionnaireId = await generateQuestionnaireAs(analyst, requestId, false);
  const questionnairePath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;
  const requestPath = `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`;
  const generationOf = async () => ((await readJson(questionnairePath, analyst, "FILES_SIGNAL_QUESTIONNAIRE_READ")).data.generation as Record<string, unknown>);

  // Generated with exactly the pack included: nothing changed.
  assert.equal((await generationOf()).aiInputsChanged, null, "FILES_SIGNAL_BEFORE_ANY_CHANGE");

  await putAttachment(requestId, csvId, "ai_input", analyst, { included: true });
  await putAttachment(requestId, packId, "ai_input", analyst, { included: false });
  const changed = {
    count: 2,
    notes: [],
    files: [
      { documentId: csvId, fileName: "register.csv", change: "included" },
      { documentId: packId, fileName: "vendor-security-pack.pdf", change: "excluded" },
    ],
  };
  assert.deepEqual((await generationOf()).aiInputsChanged, changed, "FILES_SIGNAL_NOT_LISTED");
  const bobRequest = (await readJson(requestPath, analyst, "FILES_SIGNAL_BOB_REQUEST_READ")).data;
  assert.deepEqual(bobRequest.aiInputs, { questionnaire: changed, assessment: null }, "FILES_SIGNAL_REQUEST_READ_DISAGREES");

  const janeRequest = await readJson(requestPath, owner, "FILES_SIGNAL_JANE_REQUEST_READ");
  assert.equal(janeRequest.data.aiInputs, null, "FILES_SIGNAL_JANE_REQUEST_READ_SIGNAL");
  assert.ok(!janeRequest.text.includes('"change"'), "FILES_SIGNAL_JANE_REQUEST_READ_DISCLOSED");
});

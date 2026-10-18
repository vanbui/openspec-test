import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import {
  assertConflictReason,
  createConflictReasonFixture,
  fullGovernanceLog,
  type ConflictReasonFixture,
  type ConflictReasonFixtureInput,
} from "./helpers/conflict-reason-fixtures";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8")) as Record<string, any>;

/*
 * A minimal structural check for the defect class behind CR-02
 * (06.8-REVIEW.md): a closed (`additionalProperties: false`) schema composed
 * via `allOf` can be unsatisfiable by any real response, because each closed
 * branch only recognises its own declared properties. This validates that a
 * REAL server response carries only declared top-level keys and every
 * required top-level key, against the named schema as published today —
 * not a hand-copied expectation that could drift from the spec file.
 */
function assertMatchesClosedSchema(schemaName: string, value: Record<string, unknown>, diagnostic: string): void {
  const schema = specification.components?.schemas?.[schemaName];
  assert.ok(schema, `${diagnostic}_SCHEMA_MISSING_${schemaName}`);
  assert.equal(schema.additionalProperties, false, `${diagnostic}_SCHEMA_NOT_CLOSED_${schemaName}`);
  const declared = new Set(Object.keys(schema.properties ?? {}));
  for (const key of Object.keys(value)) {
    assert.ok(declared.has(key), `${diagnostic}_UNDECLARED_PROPERTY_${schemaName}_${key}`);
  }
  for (const key of (schema.required ?? []) as string[]) {
    assert.ok(key in value, `${diagnostic}_MISSING_REQUIRED_PROPERTY_${schemaName}_${key}`);
  }
}

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

async function request(path: string, identity?: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

async function payload(response: Response): Promise<{ data?: unknown; error?: unknown }> {
  return response.json() as Promise<{ data?: unknown; error?: unknown }>;
}

function record(value: unknown, diagnostic: string): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value), diagnostic);
  return value as Record<string, unknown>;
}

function releasePath(questionnaireId: string): string {
  return `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/release`;
}

function returnPath(questionnaireId: string): string {
  return `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`;
}

function questionsPath(questionnaireId: string): string {
  return `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/questions`;
}

function post(body?: unknown): RequestInit {
  return {
    method: "POST",
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

/*
 * The one end-to-end proof of the release gate: the owning Requestor is refused
 * by Strapi before release, only a human Security Analyst can release, and the
 * release fact plus its single governance event survive a reload straight out
 * of the harness database rather than existing only as compiled types.
 */
test("mounted questionnaire release gates the Requestor and is human-analyst only", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const unreleased = fixtures.questionnaires.unreleased;

  // Before release: the owner is refused by the authorization layer on every
  // Requestor-reachable questionnaire resource route, not by a missing link.
  for (const suffix of ["", "/questions"]) {
    const denied = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}${suffix}`, harness.identities.owner);
    assert.equal(denied.status, 403, `UNRELEASED_OWNER_READ_ALLOWED_${suffix || "detail"}`);
    assert.doesNotMatch(await denied.text(), /SQL|stack|database/i, "UNEXPECTED_RAW_ERROR_DISCLOSURE");
  }
  const deniedAnswers = await request(
    `/api/v1/questionnaires/${encodeURIComponent(unreleased)}/answers`,
    harness.identities.owner,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [] }) },
  );
  assert.equal(deniedAnswers.status, 409, "UNRELEASED_OWNER_ANSWERS_ALLOWED");
  assert.deepEqual(((await deniedAnswers.json()) as { error: { details: unknown } }).error.details, { reason: "QUESTIONNAIRE_NOT_ANSWERABLE" });
  const deniedSubmit = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}/submit`, harness.identities.owner, post());
  assert.equal(deniedSubmit.status, 409, "UNRELEASED_OWNER_SUBMIT_ALLOWED");
  assert.deepEqual(((await deniedSubmit.json()) as { error: { details: unknown } }).error.details, { reason: "QUESTIONNAIRE_NOT_ANSWERABLE" });

  // An analyst may always open an unreleased questionnaire: it is analyst-only
  // work until they choose to release it.
  const analystRead = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}`, harness.identities.analyst);
  assert.equal(analystRead.status, 200, "UNEXPECTED_ANALYST_UNRELEASED_READ_STATUS");
  assert.equal(record((await payload(analystRead)).data, "ANALYST_READ_DATA").release, null, "UNEXPECTED_UNRELEASED_RELEASE_PROJECTION");

  // Release is refused for the Requestor, for the automation analyst identity,
  // and for an ungranted analyst-named identity.
  for (const [identity, diagnostic] of [
    [harness.identities.owner, "OWNER"],
    [harness.identities.serviceAnalystAgent, "AUTOMATION_ANALYST"],
    [harness.identities.analystAgent, "UNGRANTED_ANALYST"],
    [harness.identities.inactiveAnalyst, "INACTIVE_ANALYST"],
  ] as const) {
    const denied = await request(releasePath(unreleased), identity, post());
    assert.equal(denied.status, 403, `UNEXPECTED_RELEASE_ALLOWED_${diagnostic}`);
  }
  assert.equal((await request(releasePath(unreleased), undefined, post())).status, 403, "UNEXPECTED_ANONYMOUS_RELEASE_STATUS");
  assert.equal(
    (await harness.getQuestionnaire(unreleased))?.releasedAt ?? null,
    null,
    "UNEXPECTED_RELEASE_FACT_AFTER_DENIAL",
  );

  // Release takes no body: D-16 scopes the mandatory reason to the three
  // standalone backward transitions and release is not one of them.
  const withBody = await request(releasePath(unreleased), harness.identities.analyst, post({ reason: "Reviewed." }));
  assert.equal(withBody.status, 400, "UNEXPECTED_RELEASE_BODY_ACCEPTED");

  const released = await request(releasePath(unreleased), harness.identities.analyst, post());
  assert.equal(released.status, 200, "UNEXPECTED_HUMAN_ANALYST_RELEASE_STATUS");
  const releasedData = record((await payload(released)).data, "RELEASE_RESPONSE_DATA");
  const projectedRelease = record(releasedData.release, "RELEASE_RESPONSE_RELEASE");
  assert.equal(typeof projectedRelease.releasedAt, "string", "MISSING_PROJECTED_RELEASE_TIMESTAMP");
  assert.equal(
    record(projectedRelease.releasedBy, "RELEASE_RESPONSE_ACTOR").documentId,
    harness.users.analyst,
    "UNEXPECTED_PROJECTED_RELEASE_ACTOR",
  );
  assert.deepEqual(
    Object.keys(record(projectedRelease.releasedBy, "RELEASE_RESPONSE_ACTOR")).sort(),
    ["displayName", "documentId"],
    "UNEXPECTED_RELEASE_ACTOR_DISCLOSURE",
  );

  // The reload is the proof that the three schema attributes exist as real
  // columns in the harness database, not only as compiled types.
  const reloaded = record(await harness.getQuestionnaire(unreleased), "RELOADED_QUESTIONNAIRE");
  assert.equal(typeof reloaded.releasedAt, "string", "MISSING_PERSISTED_RELEASE_TIMESTAMP");
  assert.ok(Number.isFinite(Date.parse(String(reloaded.releasedAt))), "UNPARSEABLE_PERSISTED_RELEASE_TIMESTAMP");
  assert.equal(
    record(reloaded.releasedBy, "PERSISTED_RELEASE_ACTOR").documentId,
    harness.users.analyst,
    "UNEXPECTED_PERSISTED_RELEASE_ACTOR",
  );
  assert.ok(Array.isArray(reloaded.governanceLog), "MISSING_PERSISTED_GOVERNANCE_LOG");
  const events = reloaded.governanceLog as Array<Record<string, unknown>>;
  assert.equal(events.length, 1, "UNEXPECTED_GOVERNANCE_EVENT_COUNT");
  assert.equal(events[0]?.kind, "released", "UNEXPECTED_GOVERNANCE_EVENT_KIND");
  assert.equal(events[0]?.schemaVersion, 1, "UNEXPECTED_GOVERNANCE_EVENT_SCHEMA_VERSION");
  assert.equal(events[0]?.by, harness.users.analyst, "UNEXPECTED_GOVERNANCE_EVENT_ACTOR");
  assert.equal(events[0]?.at, reloaded.releasedAt, "GOVERNANCE_EVENT_NOT_WRITTEN_WITH_THE_FACT");

  // After release the owning Requestor is served by exactly the same routes.
  for (const suffix of ["", "/questions"]) {
    const allowed = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}${suffix}`, harness.identities.owner);
    assert.equal(allowed.status, 200, `RELEASED_OWNER_READ_DENIED_${suffix || "detail"}`);
  }
  const otherRequestor = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}`, harness.identities.otherRequestor);
  assert.equal(otherRequestor.status, 403, "UNEXPECTED_CROSS_OWNER_RELEASED_READ");

  // Release is not idempotent: a second release is a conflict, and the log is
  // still exactly one entry because nothing was appended.
  const second = await request(releasePath(unreleased), harness.identities.analyst, post());
  assert.equal(second.status, 409, "UNEXPECTED_SECOND_RELEASE_STATUS");
  const afterSecond = record(await harness.getQuestionnaire(unreleased), "RELOADED_AFTER_SECOND_RELEASE");
  assert.equal((afterSecond.governanceLog as unknown[]).length, 1, "UNEXPECTED_GOVERNANCE_LOG_GROWTH");
  assert.equal(afterSecond.releasedAt, reloaded.releasedAt, "UNEXPECTED_RELEASE_TIMESTAMP_REWRITE");

  // An already-released fixture is a conflict on first contact, and a missing
  // questionnaire is a 404 rather than a disclosure.
  assert.equal(
    (await request(releasePath(fixtures.questionnaires.released), harness.identities.analyst, post())).status,
    409,
    "UNEXPECTED_PRE_RELEASED_STATUS",
  );
  const missing = await request(releasePath("missing-questionnaire"), harness.identities.analyst, post());
  assert.equal(missing.status, 404, "UNEXPECTED_MISSING_RELEASE_STATUS");
  assert.doesNotMatch(await missing.text(), /SQL|stack|database/i, "UNEXPECTED_RAW_ERROR_DISCLOSURE");
});

test("mounted return to review is analyst-only, audited, and restores submitted answers as drafts", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionnaireId = fixtures.questionnaires.returnable;
  const requestId = fixtures.requests.returnable;

  assert.equal((await request(releasePath(questionnaireId), harness.identities.analyst, post())).status, 200, "RETURN_FIXTURE_RELEASE_FAILED");
  assert.equal(
    (await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/answers`, harness.identities.owner, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [{ questionKey: "governance-returnable", value: "Retained answer" }] }),
    })).status,
    200,
    "RETURN_FIXTURE_ANSWER_SAVE_FAILED",
  );
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/submit`, harness.identities.owner, post())).status, 200, "RETURN_FIXTURE_SUBMIT_FAILED");
  const statusBefore = record(await harness.getRequest(requestId), "REQUEST_BEFORE_RETURN").requestStatus;

  for (const [identity, diagnostic] of [
    [harness.identities.owner, "OWNER"],
    [harness.identities.otherRequestor, "OTHER_OWNER"],
    [harness.identities.serviceAnalystAgent, "AUTOMATION"],
    [harness.identities.inactiveAnalyst, "INACTIVE"],
  ] as const) {
    const denied = await request(returnPath(questionnaireId), identity, post({ reason: "Needs review." }));
    assert.equal(denied.status, 403, `RETURN_UNEXPECTEDLY_ALLOWED_${diagnostic}`);
  }
  for (const [body, diagnostic] of [
    [undefined, "ABSENT"], [{}, "EMPTY"], [{ reason: "ok", extra: true }, "EXTRA"], [{ reason: "" }, "BLANK"], [{ reason: "   " }, "WHITESPACE"], [{ reason: "x".repeat(501) }, "OVERLONG"],
  ] as const) {
    const refused = await request(returnPath(questionnaireId), harness.identities.analyst, post(body));
    assert.equal(refused.status, 400, `RETURN_INVALID_BODY_ACCEPTED_${diagnostic}`);
  }

  const returned = await request(returnPath(questionnaireId), harness.identities.analyst, post({ reason: "x".repeat(500) }));
  assert.equal(returned.status, 200, "RETURN_HUMAN_ANALYST_DENIED");
  /*
   * The published operation returns QuestionnaireGovernanceResult. Returning a
   * bare questionnaire instead still persists the transition, so only the typed
   * client notices — it rejects the payload and reports a completed return as a
   * failure, which no server-side assertion about stored state would catch.
   */
  const returnBody = record((await payload(returned)).data, "RETURN_RESULT");
  assert.equal(returnBody.release ?? null, null, "RETURN_RESULT_OMITS_THE_CLEARED_RELEASE_FACT");
  assert.ok(Array.isArray(returnBody.events), "RETURN_RESULT_OMITS_THE_GOVERNANCE_EVENTS");
  assert.equal((returnBody.events as unknown[]).length > 0, true, "RETURN_RESULT_REPORTED_NO_EVENTS");
  const reloaded = record(await harness.getQuestionnaire(questionnaireId), "RETURNED_QUESTIONNAIRE");
  assert.equal(reloaded.releasedAt ?? null, null, "RETURN_RELEASE_TIMESTAMP_NOT_CLEARED");
  assert.equal(reloaded.releasedBy ?? null, null, "RETURN_RELEASE_ACTOR_NOT_CLEARED");
  const log = reloaded.governanceLog as Array<Record<string, unknown>>;
  assert.deepEqual(log.map((event) => event.kind), ["released", "returned-to-review"], "RETURN_LOG_NOT_APPENDED_IN_ORDER");
  assert.equal(log[1]?.reason, "x".repeat(500), "RETURN_REASON_NOT_AUDITED");
  const answer = record((reloaded.questions as Array<Record<string, unknown>>)[0]?.answer, "RETURNED_ANSWER");
  assert.equal(answer.state, "draft", "RETURNED_ANSWER_NOT_DRAFT");
  assert.equal(answer.value, "Retained answer", "RETURNED_ANSWER_VALUE_LOST");
  assert.equal(answer.submittedAt, undefined, "RETURNED_ANSWER_RETAINED_SUBMISSION_TIMESTAMP");
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.owner)).status, 403, "RETURNED_OWNER_RETAINED_READ_ACCESS");
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/answers`, harness.identities.owner, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [] }),
  })).status, 409, "RETURNED_OWNER_RETAINED_SAVE_ACCESS");
  assert.equal(record(await harness.getRequest(requestId), "REQUEST_AFTER_RETURN").requestStatus, statusBefore, "RETURN_MOVED_REQUEST_STATUS");
  assert.equal((await request(returnPath(questionnaireId), harness.identities.analyst, post({ reason: "Again." }))).status, 409, "RETURN_WAS_IDEMPOTENT");
  assert.equal((await request(returnPath(fixtures.questionnaires.released), harness.identities.analyst, post({ reason: "Already released fixture." }))).status, 200, "RETURN_PRE_RELEASED_FIXTURE_FAILED");
  assert.equal((await request(returnPath(fixtures.questionnaires.released), harness.identities.analyst, post({ reason: "Again." }))).status, 409, "RETURN_ALREADY_DRAFT_FIXTURE_ALLOWED");
});

/*
 * CR-01 (06.8-REVIEW.md): deleting the only remaining active question must
 * never succeed, or a questionnaire can be released and submitted with no
 * Requestor input at all.
 */
test("mounted analyst deletion is refused when it would leave no active question", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionPath = `${questionsPath(fixtures.questionnaires.returnable)}/${encodeURIComponent(fixtures.questions.returnable)}`;

  const refused = await request(questionPath, harness.identities.analyst, { method: "DELETE" });
  assert.equal(refused.status, 409, "DELETE_OF_LAST_ACTIVE_QUESTION_WAS_ALLOWED");
  const questionnaire = record(await harness.getQuestionnaire(fixtures.questionnaires.returnable), "QUESTIONNAIRE_AFTER_REFUSED_DELETE");
  const question = record((questionnaire.questions as Array<Record<string, unknown>>)[0], "RETAINED_QUESTION");
  assert.equal(record(question.options, "RETAINED_QUESTION_OPTIONS").deleted ?? null, null, "LAST_ACTIVE_QUESTION_WAS_MARKED_DELETED");
});

test("mounted analyst question mutations retain deleted evidence and exclude it from active progress", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionnaireId = fixtures.questionnaires.editable;
  const addBody = {
    questionText: "Which hosting region applies?",
    answerType: "Text",
    required: true,
    section: { key: "context", title: "Context", order: 1 },
    order: 2,
  };

  for (const [identity, diagnostic] of [
    [harness.identities.owner, "OWNER"],
    [harness.identities.otherRequestor, "OTHER_OWNER"],
    [harness.identities.serviceAnalystAgent, "AUTOMATION"],
    [harness.identities.inactiveAnalyst, "INACTIVE"],
  ] as const) {
    assert.equal((await request(questionsPath(questionnaireId), identity, post(addBody))).status, 403, `ADD_UNEXPECTEDLY_ALLOWED_${diagnostic}`);
  }

  // The analyst-review gate is the precondition for every question mutation:
  // a released questionnaire must be returned to review before it can change.
  assert.equal((await request(questionsPath(fixtures.questionnaires.gated), harness.identities.analyst, post(addBody))).status, 409, "ADD_ALLOWED_ON_RELEASED_QUESTIONNAIRE");
  assert.equal(
    (await request(`${questionsPath(fixtures.questionnaires.gated)}/${encodeURIComponent(fixtures.questions.gated)}`, harness.identities.analyst, { method: "DELETE" })).status,
    409,
    "DELETE_ALLOWED_ON_RELEASED_QUESTIONNAIRE",
  );

  const added = await request(questionsPath(questionnaireId), harness.identities.analyst, post(addBody));
  assert.equal(added.status, 200, "ANALYST_ADD_QUESTION_DENIED");
  const afterAdd = record(await harness.getQuestionnaire(questionnaireId), "QUESTIONNAIRE_AFTER_ADD");
  const addedQuestion = (afterAdd.questions as Array<Record<string, unknown>>).find((entry) => entry.questionText === "Which hosting region applies?");
  assert.ok(addedQuestion && typeof addedQuestion.documentId === "string", "ADDED_QUESTION_NOT_PERSISTED");
  const questionPath = `${questionsPath(questionnaireId)}/${encodeURIComponent(String(addedQuestion.documentId))}`;

  const edited = await request(questionPath, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ helpText: "Use the primary production region." }),
  });
  assert.equal(edited.status, 200, "ANALYST_EDIT_QUESTION_DENIED");
  assert.equal(
    (record((await payload(edited)).data, "EDIT_RESULT").clearedAnswers ?? null),
    null,
    "EDIT_OF_AN_UNANSWERED_QUESTION_REPORTED_A_CLEARED_ANSWER",
  );

  // An answer survives an edit it still satisfies, and is cleared with a
  // plain-language explanation by one that it does not.
  assert.equal((await request(releasePath(questionnaireId), harness.identities.analyst, post())).status, 200, "EDIT_FIXTURE_RELEASE_FAILED");
  assert.equal(
    (await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/answers`, harness.identities.owner, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [{ questionKey: "which-hosting-region-applies", value: "Primary region" }] }),
    })).status,
    200,
    "EDIT_FIXTURE_ANSWER_SAVE_FAILED",
  );
  assert.equal((await request(returnPath(questionnaireId), harness.identities.analyst, post({ reason: "Correcting the region question." }))).status, 200, "EDIT_FIXTURE_RETURN_FAILED");

  const kept = await request(questionPath, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionText: "Which hosting region applies to production?" }),
  });
  assert.equal(kept.status, 200, "EDIT_KEEPING_ANSWER_DENIED");
  assert.equal((record((await payload(kept)).data, "KEPT_RESULT").clearedAnswers ?? null), null, "VALID_ANSWER_WAS_CLEARED_BY_A_TEXT_EDIT");

  const cleared = await request(questionPath, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answerType: "Single select", choices: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }] }),
  });
  assert.equal(cleared.status, 200, "EDIT_CLEARING_ANSWER_DENIED");
  const clearedAnswers = record((await payload(cleared)).data, "CLEARED_RESULT").clearedAnswers as Array<Record<string, unknown>>;
  assert.equal(clearedAnswers.length, 1, "ANSWER_CLEARING_WAS_NOT_REPORTED");
  assert.match(String(clearedAnswers[0]?.explanation), /answer type changed/, "ANSWER_CLEARING_EXPLANATION_IS_NOT_PLAIN_LANGUAGE");

  /*
   * CR-03 (06.8-REVIEW.md): converting an existing Single/Multi select question
   * back to a non-select type must succeed. The stored options envelope must
   * not retain the prior choices, or the closed choices-vs-type invariant in
   * parseQuestionnaireDefinition refuses every subsequent read of the row.
   */
  const revertedToText = await request(questionPath, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answerType: "Text" }),
  });
  assert.equal(revertedToText.status, 200, "SELECT_TO_NON_SELECT_EDIT_WAS_REFUSED");
  const afterRevert = record(await harness.getQuestionnaire(questionnaireId), "QUESTIONNAIRE_AFTER_SELECT_TO_TEXT_EDIT");
  const revertedQuestion = record(
    (afterRevert.questions as Array<Record<string, unknown>>).find((entry) => entry.documentId === addedQuestion.documentId),
    "REVERTED_QUESTION_NOT_FOUND",
  );
  assert.equal(revertedQuestion.answerType, "Text", "REVERTED_QUESTION_KEPT_SELECT_ANSWER_TYPE");
  const revertedOptions = record(revertedQuestion.options, "REVERTED_QUESTION_OPTIONS");
  assert.equal(revertedOptions.choices ?? null, null, "REVERTED_QUESTION_RETAINED_STALE_CHOICES");
  // A stale choices array on a non-select question trips the closed
  // choices-vs-type invariant in parseQuestionnaireDefinition, which this
  // read exercises across every question on the questionnaire.
  assert.equal((await request(questionsPath(questionnaireId), harness.identities.analyst)).status, 200, "QUESTIONNAIRE_UNREADABLE_AFTER_SELECT_TO_TEXT_EDIT");

  const deleted = await request(questionPath, harness.identities.analyst, { method: "DELETE" });
  assert.equal(deleted.status, 200, "ANALYST_DELETE_QUESTION_DENIED");
  assert.equal((await request(questionPath, harness.identities.analyst, { method: "DELETE" })).status, 409, "DELETE_WAS_IDEMPOTENT");
  const reloaded = record(await harness.getQuestionnaire(questionnaireId), "QUESTIONNAIRE_AFTER_DELETE");
  const retained = (reloaded.questions as Array<Record<string, unknown>>).find((entry) => entry.documentId === addedQuestion.documentId);
  assert.ok(retained, "DELETED_QUESTION_ROW_WAS_REMOVED");
  const options = record(retained.options, "DELETED_QUESTION_OPTIONS");
  assert.equal(options.schemaVersion, 2, "DELETED_QUESTION_DID_NOT_USE_VERSION_TWO_ENVELOPE");
  assert.ok(record(options.deleted, "DELETED_QUESTION_MARKER").deletedAt, "DELETED_QUESTION_MARKER_MISSING");
  const analystQuestions = await request(questionsPath(questionnaireId), harness.identities.analyst);
  assert.equal(analystQuestions.status, 200, "ANALYST_CANNOT_READ_DELETED_QUESTION_HISTORY");
  const projectedQuestions = (record(await payload(analystQuestions), "ANALYST_QUESTION_HISTORY").data as Array<Record<string, unknown>>);
  assert.ok(projectedQuestions.some((entry) => entry.documentId === addedQuestion.documentId && record(entry.deleted, "PROJECTED_DELETION_MARKER").deletedAt), "DELETED_QUESTION_NOT_VISIBLE_TO_ANALYST_HISTORY");
  const log = (reloaded.governanceLog as Array<Record<string, unknown>>).map((entry) => entry.kind);
  assert.deepEqual(
    log,
    ["question-added", "question-edited", "released", "returned-to-review", "question-edited", "question-edited", "answer-cleared", "question-edited", "question-deleted"],
    "QUESTION_MUTATION_EVENTS_WERE_NOT_APPENDED_IN_ORDER",
  );
});

test("Requestor answer saves remain readable when the questionnaire also contains a soft-deleted v2 question", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: `QUESTIONNAIRE-GOVERNANCE-TOMBSTONE-${Date.now().toString(36)}`,
    title: "Governance tombstone response fixture",
    requestStatus: "questionnaire-in-progress",
    requestor: "owner",
  });
  const { questionnaire, question: activeQuestionId } = await harness.createQuestionnaireLifecycleFixture({
    requestDocumentId: requestId,
    released: false,
    answerState: "draft",
  });
  assert.ok(activeQuestionId, "ACTIVE_QUESTION_FIXTURE_MISSING");
  const activeQuestion = record(await harness.getQuestion(activeQuestionId), "ACTIVE_QUESTION_FIXTURE");
  const activeKey = record(activeQuestion.options, "ACTIVE_QUESTION_OPTIONS").questionKey;
  const added = await request(questionsPath(questionnaire), harness.identities.analyst, post({
    questionText: "Which historical region applied?",
    answerType: "Text",
    required: true,
    section: { key: "context", title: "Context", order: 1 },
    order: 2,
  }));
  assert.equal(added.status, 200, `TOMBSTONE_FIXTURE_QUESTION_ADD_FAILED: ${await added.clone().text()}`);
  const afterAdd = record(await harness.getQuestionnaire(questionnaire), "TOMBSTONE_FIXTURE_AFTER_ADD");
  const addedQuestion = record((afterAdd.questions as Array<Record<string, unknown>>).find((question) => question.questionText === "Which historical region applied?"), "TOMBSTONE_FIXTURE_ADDED_QUESTION");
  const deleted = await request(`${questionsPath(questionnaire)}/${encodeURIComponent(String(addedQuestion.documentId))}`, harness.identities.analyst, { method: "DELETE" });
  assert.equal(deleted.status, 200, `TOMBSTONE_FIXTURE_DELETE_FAILED: ${await deleted.clone().text()}`);
  const deletedQuestionKey = record(addedQuestion.options, "TOMBSTONE_FIXTURE_ADDED_OPTIONS").questionKey;

  assert.equal((await request(releasePath(questionnaire), harness.identities.analyst, post())).status, 200, "TOMBSTONE_FIXTURE_RELEASE_FAILED");
  const saved = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaire)}/answers`, harness.identities.owner, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ questionKey: activeKey, value: "Primary region" }] }),
  });
  assert.equal(saved.status, 200, `REQUESTOR_SAVE_FAILED_WITH_DELETED_QUESTION: ${await saved.clone().text()}`);
  const answers = (record(await payload(saved), "REQUESTOR_SAVE_WITH_DELETED_QUESTION").data as Record<string, unknown>).answers as Array<Record<string, unknown>>;
  const returnedKeys = answers.map((entry) => record(entry.options, "SAVED_ANSWER_OPTIONS").questionKey);
  assert.ok(returnedKeys.includes(activeKey), "ACTIVE_ANSWER_MISSING_FROM_SAVE_RESPONSE");
  assert.ok(!returnedKeys.includes(deletedQuestionKey), "DELETED_QUESTION_LEAKED_INTO_REQUESTOR_ANSWERS");
});

/*
 * Same defect class as CR-03, caught by re-review of the CR-03 fix: candidateQuestion
 * excluded `choices` from its base spread of the prior question but not `visibility`,
 * so an edit payload of `{ visibility: null }` — the documented way to clear a
 * question's visibility condition — was silently ignored and the stale condition
 * survived untouched.
 */
test("mounted analyst edit with an explicit null visibility clears the prior condition", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionnaireId = fixtures.questionnaires.editable;

  const dependentAdd = await request(questionsPath(questionnaireId), harness.identities.analyst, post({
    questionText: "Describe the trigger condition.",
    answerType: "Text",
    required: false,
    section: { key: "context", title: "Context", order: 1 },
    order: 3,
    visibility: { questionKey: "governance-editable", operator: "equals", value: "trigger" },
  }));
  assert.equal(dependentAdd.status, 200, "VISIBILITY_FIXTURE_ADD_FAILED");
  const afterAdd = record(await harness.getQuestionnaire(questionnaireId), "QUESTIONNAIRE_AFTER_VISIBILITY_ADD");
  const dependent = record(
    (afterAdd.questions as Array<Record<string, unknown>>).find((entry) => entry.questionText === "Describe the trigger condition."),
    "DEPENDENT_QUESTION_NOT_FOUND",
  );
  assert.ok(record(dependent.options, "DEPENDENT_OPTIONS_BEFORE_CLEAR").visibility, "DEPENDENT_QUESTION_WAS_NOT_CONDITIONAL");
  const dependentPath = `${questionsPath(questionnaireId)}/${encodeURIComponent(String(dependent.documentId))}`;

  const cleared = await request(dependentPath, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility: null }),
  });
  assert.equal(cleared.status, 200, "VISIBILITY_CLEAR_EDIT_WAS_REFUSED");
  const afterClear = record(await harness.getQuestionnaire(questionnaireId), "QUESTIONNAIRE_AFTER_VISIBILITY_CLEAR");
  const clearedQuestion = record(
    (afterClear.questions as Array<Record<string, unknown>>).find((entry) => entry.documentId === dependent.documentId),
    "CLEARED_QUESTION_NOT_FOUND",
  );
  assert.equal(record(clearedQuestion.options, "CLEARED_OPTIONS").visibility ?? null, null, "STALE_VISIBILITY_SURVIVED_AN_EXPLICIT_NULL_EDIT");
});

/*
 * The analyst's display name as their own IdamBox user record holds it, read
 * through the release relation straight from the harness database, so a proof
 * never depends on a name the seed might change.
 */
async function releasingAnalystDisplayName(questionnaireId: string): Promise<string> {
  const harness = await harnessPromise;
  const released = record(await harness.getQuestionnaire(questionnaireId), "RELEASED_QUESTIONNAIRE");
  const displayName = record(released.releasedBy, "RELEASING_ANALYST").displayName;
  assert.ok(typeof displayName === "string" && displayName.trim().length > 0, "RELEASING_ANALYST_HAS_NO_DISPLAY_NAME");
  return displayName;
}

test("mounted authorised questionnaire read projects its owned revision timeline", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionnaireId = fixtures.questionnaires.timeline;
  assert.equal((await request(releasePath(questionnaireId), harness.identities.analyst, post())).status, 200, "TIMELINE_RELEASE_FAILED");
  const analystDisplayName = await releasingAnalystDisplayName(questionnaireId);
  assert.equal((await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/answers`, harness.identities.owner, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [{ questionKey: "governance-timeline", value: "Portal" }] }) })).status, 200, "TIMELINE_ANSWER_SAVE_FAILED");
  assert.equal((await request(returnPath(questionnaireId), harness.identities.analyst, post({ reason: "Clarify the service scope." }))).status, 200, "TIMELINE_RETURN_FAILED");
  const questionId = fixtures.questions.timeline;
  assert.equal((await request(`${questionsPath(questionnaireId)}/${encodeURIComponent(questionId)}`, harness.identities.analyst, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ answerType: "Single select", choices: [{ value: "portal", label: "Portal" }, { value: "service", label: "Service" }] }) })).status, 200, "TIMELINE_EDIT_FAILED");
  const response = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(response.status, 200, "TIMELINE_READ_FAILED");
  const events = record((await payload(response)).data, "TIMELINE_RESPONSE").events as Array<Record<string, unknown>>;
  assert.deepEqual(events.map((event) => event.kind), ["released", "returned-to-review", "question-edited", "answer-cleared"], "TIMELINE_EVENTS_NOT_IN_STORED_ORDER");
  assert.equal(events[1]?.reason, "Clarify the service scope.");
  // identities.analyst is the request header; the event records the user document.
  assert.equal(record(events[1]?.by, "TIMELINE_ACTOR").documentId, harness.users.analyst, "TIMELINE_ACTOR_IS_NOT_THE_ANALYST");
  /*
   * D-31 (Phase 8): the log stores the acting analyst's documentId, and the read
   * resolves it to their display name. Exactly the documentId and the name cross
   * the boundary, never the rest of the IdamBox user record.
   */
  for (const [index, event] of events.entries()) {
    assert.deepEqual(event.by, { documentId: harness.users.analyst, displayName: analystDisplayName }, `TIMELINE_ACTOR_NOT_NAMED_${index}`);
  }
  assert.equal(events[3]?.questionKey, "governance-timeline");
  assert.equal(typeof events[3]?.explanation, "string");

  // Released again, the owning Requestor reads the same timeline with no acting identity on any event.
  assert.equal((await request(releasePath(questionnaireId), harness.identities.analyst, post())).status, 200, "TIMELINE_RERELEASE_FAILED");
  const ownerResponse = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.owner);
  assert.equal(ownerResponse.status, 200, "TIMELINE_OWNER_READ_FAILED");
  const ownerEvents = record((await payload(ownerResponse)).data, "TIMELINE_OWNER_RESPONSE").events as Array<Record<string, unknown>>;
  assert.deepEqual(ownerEvents.map((event) => event.kind), ["released", "returned-to-review", "question-edited", "answer-cleared", "released"], "TIMELINE_OWNER_EVENTS_NOT_IN_STORED_ORDER");
  for (const [index, event] of ownerEvents.entries()) {
    assert.equal("by" in event, false, `TIMELINE_REQUESTOR_RECEIVED_THE_ACTOR_${index}`);
    assert.deepEqual(Object.keys(event).filter((key) => !["kind", "at", "explanation"].includes(key)), [], `TIMELINE_REQUESTOR_RECEIVED_ANALYST_DETAIL_${index}`);
  }
  const ownerTimeline = JSON.stringify(ownerEvents);
  assert.equal(ownerTimeline.includes(analystDisplayName), false, "TIMELINE_REQUESTOR_RECEIVED_THE_ANALYST_NAME");
  assert.equal(ownerTimeline.includes(harness.users.analyst), false, "TIMELINE_REQUESTOR_RECEIVED_THE_ANALYST_ID");
});

/*
 * D-17 and D-18 (Phase 10): an edited question's new words are written into the stored event in the
 * same change, and the analyst timeline names the question by them. The owning Requestor's timeline
 * carries neither the text nor the key.
 */
test("mounted question edit stores the question's text on its event and only the analyst timeline shows it", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "QUESTIONNAIRE-GOVERNANCE-SNAPSHOT", title: "Governance question text request", requestStatus: "questionnaire-in-progress", requestor: "owner",
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-GOVERNANCE-SNAPSHOT",
    title: "Governance question text questionnaire",
    assessmentRequest: requestId,
  });
  const questionId = await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Where is the service hosted?",
    answerType: "Text",
    options: { schemaVersion: 1, questionKey: "snapshot-hosting", section: { key: "context", title: "Context", order: 1 }, order: 1, required: true },
    answer: null,
    questionnaire: questionnaireId,
  });
  const revisedText = "Where will the service be hosted?";

  const edited = await request(`${questionsPath(questionnaireId)}/${encodeURIComponent(questionId)}`, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionText: revisedText }),
  });
  assert.equal(edited.status, 200, "SNAPSHOT_EDIT_FAILED");

  const stored = record(await harness.getQuestionnaire(questionnaireId), "SNAPSHOT_STORED_QUESTIONNAIRE").governanceLog as Array<Record<string, unknown>>;
  assert.equal(stored.at(-1)?.kind, "question-edited", "SNAPSHOT_EVENT_NOT_STORED");
  assert.equal(stored.at(-1)?.questionText, revisedText, "SNAPSHOT_NOT_STORED_WITH_THE_EDIT");

  const analystResponse = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(analystResponse.status, 200, "SNAPSHOT_ANALYST_READ_FAILED");
  const analystEvents = record((await payload(analystResponse)).data, "SNAPSHOT_ANALYST_RESPONSE").events as Array<Record<string, unknown>>;
  const editedEvent = analystEvents.find((event) => event.kind === "question-edited");
  assert.equal(editedEvent?.questionText, revisedText, "SNAPSHOT_NOT_PROJECTED_FOR_THE_ANALYST");
  assert.equal(editedEvent?.questionKey, "snapshot-hosting");

  assert.equal((await request(releasePath(questionnaireId), harness.identities.analyst, post())).status, 200, "SNAPSHOT_RELEASE_FAILED");
  const ownerResponse = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.owner);
  assert.equal(ownerResponse.status, 200, "SNAPSHOT_OWNER_READ_FAILED");
  const ownerEvents = record((await payload(ownerResponse)).data, "SNAPSHOT_OWNER_RESPONSE").events as Array<Record<string, unknown>>;
  assert.ok(ownerEvents.some((event) => event.kind === "question-edited"), "SNAPSHOT_OWNER_TIMELINE_LOST_THE_EDIT");
  for (const [index, event] of ownerEvents.entries()) {
    assert.equal("questionText" in event, false, `SNAPSHOT_REQUESTOR_RECEIVED_QUESTION_TEXT_${index}`);
    assert.equal("questionKey" in event, false, `SNAPSHOT_REQUESTOR_RECEIVED_QUESTION_KEY_${index}`);
  }
});

/*
 * D-31 (Phase 8): the log keeps an actor's documentId for good, but the person
 * behind it may have left the directory or been deactivated. Such an id keeps a
 * null display name, so the timeline falls back to its neutral wording rather
 * than naming someone the directory no longer vouches for.
 */
test("mounted revision timeline keeps a null name for an actor id that is unknown or inactive", async () => {
  const harness = await harnessPromise;
  const unknownActor = "retiredanalystdocument01";
  const inactiveActor = await harness.createUserFixture({
    email: "former.analyst@example.test", username: "former-analyst", displayName: "Former Analyst", accountStatus: "inactive",
  });
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "QUESTIONNAIRE-GOVERNANCE-ACTORS", title: "Governance actor names request", requestStatus: "questionnaire-in-progress", requestor: "owner",
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-GOVERNANCE-ACTORS",
    title: "Governance actor names questionnaire",
    assessmentRequest: requestId,
    releasedAt: "2026-08-19T00:00:00.000Z",
    releasedBy: harness.users.analyst,
    governanceLog: [
      { schemaVersion: 1, kind: "released", at: "2026-08-15T00:00:00.000Z", by: harness.users.analyst },
      { schemaVersion: 1, kind: "returned-to-review", at: "2026-08-16T00:00:00.000Z", by: unknownActor, reason: "Recorded by an account the directory no longer holds." },
      { schemaVersion: 1, kind: "released", at: "2026-08-17T00:00:00.000Z", by: inactiveActor },
      { schemaVersion: 1, kind: "returned-to-review", at: "2026-08-18T00:00:00.000Z", by: harness.users.analyst, reason: "Recorded by the active analyst." },
      { schemaVersion: 1, kind: "released", at: "2026-08-19T00:00:00.000Z", by: harness.users.analyst },
    ],
  });
  const analystDisplayName = await releasingAnalystDisplayName(questionnaireId);

  const response = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`, harness.identities.analyst);
  assert.equal(response.status, 200, "ACTORS_READ_FAILED");
  const body = await response.text();
  const events = record((JSON.parse(body) as { data?: unknown }).data, "ACTORS_RESPONSE").events as Array<Record<string, unknown>>;
  assert.deepEqual(events.map((event) => event.by), [
    { documentId: harness.users.analyst, displayName: analystDisplayName },
    { documentId: unknownActor, displayName: null },
    { documentId: inactiveActor, displayName: null },
    { documentId: harness.users.analyst, displayName: analystDisplayName },
    { documentId: harness.users.analyst, displayName: analystDisplayName },
  ], "ACTORS_NOT_RESOLVED_TO_ACTIVE_NAMES_ONLY");
  assert.equal(body.includes("Former Analyst"), false, "INACTIVE_ACTOR_NAME_DISCLOSED");
});

/*
 * CR-02 (06.8-REVIEW.md): QuestionnaireGovernanceResult and
 * QuestionnaireReleaseResult were each an allOf of two additionalProperties:false
 * branches, which JSON Schema requires an instance to satisfy independently —
 * unsatisfiable by any real response carrying fields declared by only one
 * branch. This runs real release and return-to-review responses against the
 * published schemas, so a future regression to that pattern fails a test
 * instead of only a manual spec read.
 */
test("mounted release and governance responses satisfy their published closed schemas", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const questionnaireId = fixtures.questionnaires.schema;

  const released = await request(releasePath(questionnaireId), harness.identities.analyst, post());
  assert.equal(released.status, 200, "SCHEMA_FIXTURE_RELEASE_FAILED");
  assertMatchesClosedSchema("QuestionnaireReleaseResult", record((await payload(released)).data, "RELEASE_RESULT"), "RELEASE");

  const returned = await request(returnPath(questionnaireId), harness.identities.analyst, post({ reason: "Validate the governance response shape." }));
  assert.equal(returned.status, 200, "SCHEMA_FIXTURE_RETURN_FAILED");
  assertMatchesClosedSchema("QuestionnaireGovernanceResult", record((await payload(returned)).data, "GOVERNANCE_RESULT"), "GOVERNANCE");
});

/*
 * D-22: every governance refusal names the one rule that refused it in error.details.reason, and
 * writes nothing. Each case runs on its own fixture, built to the exact stored state the rule reads.
 */
test("mounted governance conflicts name their reason and leave the questionnaire unchanged", async () => {
  const harness = await harnessPromise;
  const analyst = harness.identities.analyst;
  const fixture = (input: Omit<ConflictReasonFixtureInput, "label">) => createConflictReasonFixture(harness, { label: "GOV", ...input });
  const single = [{ key: "service", order: 1 }];
  const questionPath = (target: ConflictReasonFixture, key: string) => `${questionsPath(target.questionnaireId)}/${encodeURIComponent(target.questionIds[key])}`;
  const patch = (body: unknown): RequestInit => ({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const addBody = (section: { key: string; title: string; order: number }, order: number) => ({
    questionText: "Which hosting region applies?", answerType: "Text", required: true, section, order,
  });

  // Release.
  const released = await fixture({ requestStatus: "questionnaire-in-progress", released: true, questions: single });
  await assertConflictReason(harness, released, () => request(releasePath(released.questionnaireId), analyst, post()), "QUESTIONNAIRE_RELEASED", "RELEASE_TWICE");
  const draftRequest = await fixture({ requestStatus: "draft", released: false, questions: single });
  await assertConflictReason(harness, draftRequest, () => request(releasePath(draftRequest.questionnaireId), analyst, post()), "REQUEST_NOT_ELIGIBLE", "RELEASE_DRAFT_REQUEST");
  const assessed = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: single, assessment: true });
  await assertConflictReason(harness, assessed, () => request(releasePath(assessed.questionnaireId), analyst, post()), "ASSESSMENT_STARTED", "RELEASE_AFTER_ASSESSMENT");
  const drafted = await fixture({ requestStatus: "risk-assessment-drafted", released: false, questions: single });
  await assertConflictReason(harness, drafted, () => request(releasePath(drafted.questionnaireId), analyst, post()), "ASSESSMENT_STARTED", "RELEASE_AFTER_DRAFT_STAGE");
  const allRemoved = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: [{ key: "removed", order: 1, deleted: true }] });
  await assertConflictReason(harness, allRemoved, () => request(releasePath(allRemoved.questionnaireId), analyst, post()), "QUESTIONNAIRE_HAS_NO_QUESTIONS", "RELEASE_WITHOUT_ACTIVE_QUESTION");
  const invalidDefinition = await fixture({
    requestStatus: "questionnaire-in-progress", released: false,
    questions: [{ key: "first", order: 1 }, { key: "second", order: 1 }],
  });
  await assertConflictReason(harness, invalidDefinition, () => request(releasePath(invalidDefinition.questionnaireId), analyst, post()), "DEFINITION_INVALID", "RELEASE_INVALID_DEFINITION");
  const fullOnRelease = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: single, governanceLog: fullGovernanceLog(harness.users.analyst) });
  await assertConflictReason(harness, fullOnRelease, () => request(releasePath(fullOnRelease.questionnaireId), analyst, post()), "HISTORY_UNAVAILABLE", "RELEASE_FULL_HISTORY");

  // Return to analyst review.
  const inReview = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: single });
  await assertConflictReason(harness, inReview, () => request(returnPath(inReview.questionnaireId), analyst, post({ reason: "Again." })), "ALREADY_IN_ANALYST_REVIEW", "RETURN_IN_REVIEW");
  const returnAssessed = await fixture({ requestStatus: "risk-assessment-drafted", released: true, questions: single, assessment: true });
  await assertConflictReason(harness, returnAssessed, () => request(returnPath(returnAssessed.questionnaireId), analyst, post({ reason: "Too late." })), "ASSESSMENT_STARTED", "RETURN_AFTER_ASSESSMENT");
  const returnDraftRequest = await fixture({ requestStatus: "draft", released: true, questions: single });
  await assertConflictReason(harness, returnDraftRequest, () => request(returnPath(returnDraftRequest.questionnaireId), analyst, post({ reason: "Draft request." })), "REQUEST_NOT_ELIGIBLE", "RETURN_DRAFT_REQUEST");
  const invalidAnswer = await fixture({ requestStatus: "questionnaire-in-progress", released: true, questions: [{ key: "service", order: 1, answer: { value: "not an envelope" } }] });
  await assertConflictReason(harness, invalidAnswer, () => request(returnPath(invalidAnswer.questionnaireId), analyst, post({ reason: "Malformed answer." })), "ANSWER_DATA_INVALID", "RETURN_INVALID_ANSWER");
  const fullOnReturn = await fixture({
    requestStatus: "questionnaire-in-progress", released: true, questions: single, governanceLog: fullGovernanceLog(harness.users.analyst),
  });
  await assertConflictReason(harness, fullOnReturn, () => request(returnPath(fullOnReturn.questionnaireId), analyst, post({ reason: "Full history." })), "HISTORY_UNAVAILABLE", "RETURN_FULL_HISTORY");

  // Question changes.
  await assertConflictReason(harness, released, () => request(questionPath(released, "service"), analyst, patch({ helpText: "Edited while released." })), "QUESTIONNAIRE_RELEASED", "EDIT_WHILE_RELEASED");
  await assertConflictReason(harness, released, () => request(questionsPath(released.questionnaireId), analyst, post(addBody({ key: "context", title: "Context", order: 1 }, 2))), "QUESTIONNAIRE_RELEASED", "ADD_WHILE_RELEASED");
  await assertConflictReason(harness, assessed, () => request(questionPath(assessed, "service"), analyst, { method: "DELETE" }), "ASSESSMENT_STARTED", "DELETE_AFTER_ASSESSMENT");
  await assertConflictReason(harness, draftRequest, () => request(questionPath(draftRequest, "service"), analyst, patch({ helpText: "Draft request." })), "REQUEST_NOT_ELIGIBLE", "EDIT_DRAFT_REQUEST");
  await assertConflictReason(harness, inReview, () => request(questionPath(inReview, "service"), analyst, { method: "DELETE" }), "LAST_ACTIVE_QUESTION", "DELETE_LAST_ACTIVE");
  const dependent = await fixture({
    requestStatus: "questionnaire-in-progress", released: false,
    questions: [
      { key: "internet-facing", order: 1, answerType: "Boolean" },
      { key: "exposure", order: 2, visibility: { questionKey: "internet-facing", operator: "equals", value: true } },
    ],
  });
  await assertConflictReason(harness, dependent, () => request(questionPath(dependent, "internet-facing"), analyst, { method: "DELETE" }), "QUESTION_HAS_DEPENDENTS", "DELETE_WITH_DEPENDENT");
  const removed = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: [{ key: "kept", order: 1 }, { key: "removed", order: 2, deleted: true }] });
  await assertConflictReason(harness, removed, () => request(questionPath(removed, "removed"), analyst, patch({ helpText: "Edit a removed question." })), "QUESTION_REMOVED", "EDIT_REMOVED");
  await assertConflictReason(harness, removed, () => request(questionPath(removed, "removed"), analyst, { method: "DELETE" }), "QUESTION_REMOVED", "DELETE_REMOVED");
  // D-06: another key already holds section order 1, so the add is a placement clash.
  await assertConflictReason(harness, inReview, () => request(questionsPath(inReview.questionnaireId), analyst, post(addBody({ key: "general", title: "General", order: 1 }, 1))), "DEFINITION_CONFLICT", "ADD_PLACEMENT_CLASH");
  await assertConflictReason(harness, removed, () => request(questionPath(removed, "kept"), analyst, patch({ section: { key: "general", title: "General", order: 1 } })), "DEFINITION_CONFLICT", "EDIT_PLACEMENT_CLASH");
  const invalidStoredAnswer = await fixture({ requestStatus: "questionnaire-in-progress", released: false, questions: [{ key: "service", order: 1, answer: { value: "not an envelope" } }] });
  await assertConflictReason(harness, invalidStoredAnswer, () => request(questionPath(invalidStoredAnswer, "service"), analyst, patch({ helpText: "Edit a question with a malformed answer." })), "ANSWER_DATA_INVALID", "EDIT_INVALID_ANSWER");
  const fullOnChange = await fixture({
    requestStatus: "questionnaire-in-progress", released: false,
    questions: [{ key: "first", order: 1 }, { key: "second", order: 2 }], governanceLog: fullGovernanceLog(harness.users.analyst),
  });
  await assertConflictReason(harness, fullOnChange, () => request(questionsPath(fullOnChange.questionnaireId), analyst, post(addBody({ key: "context", title: "Context", order: 1 }, 3))), "HISTORY_UNAVAILABLE", "ADD_FULL_HISTORY");
  await assertConflictReason(harness, fullOnChange, () => request(questionPath(fullOnChange, "first"), analyst, patch({ helpText: "Full history." })), "HISTORY_UNAVAILABLE", "EDIT_FULL_HISTORY");
  await assertConflictReason(harness, fullOnChange, () => request(questionPath(fullOnChange, "second"), analyst, { method: "DELETE" }), "HISTORY_UNAVAILABLE", "DELETE_FULL_HISTORY");
});

/*
 * UAT-016 (D-05): an analyst adds a question to an existing section and to a new section of an AI-generated
 * questionnaire on the first try. The web places a question from every question the analyst read serves,
 * removed ones included: an existing section keeps its stored metadata and the question goes one past the
 * highest order in it; a new section gets an unused key and the next free section order. The deterministic
 * provider opens its first section, `context`, at order 0, which is where the editor's old `general` section
 * at order 0 clashed.
 */
test("mounted analyst adds to an existing and a new section of a generated questionnaire", async () => {
  const harness = await harnessPromise;
  const analyst = harness.identities.analyst;
  // The harness pins the deterministic provider; GENERATED_ADD_CONTEXT_SECTION below proves its shape.
  const workflow = await harness.seedRequestWorkflowFixtures();

  const queued = await request(`/api/v1/assessment_requests/${encodeURIComponent(workflow.requests.submitted)}/generate_questionnaire`, analyst, post());
  assert.equal(queued.status, 202, "GENERATED_ADD_GENERATION_NOT_QUEUED");
  const jobId = String(record((await payload(queued)).data, "GENERATED_ADD_JOB").jobId);
  let questionnaireId: string | null = null;
  for (let attempt = 0; attempt < 25 && !questionnaireId; attempt += 1) {
    const job = record((await payload(await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, analyst))).data, "GENERATED_ADD_JOB_READ");
    if (job.status === "failed") assert.fail(`GENERATED_ADD_GENERATION_FAILED:${String(job.failureCode)}`);
    if (job.status === "completed") questionnaireId = String(record(job.questionnaire, "GENERATED_ADD_JOB_QUESTIONNAIRE").documentId);
    else await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(questionnaireId, "GENERATED_ADD_GENERATION_DID_NOT_COMPLETE");

  type Served = { documentId: string; deleted?: unknown; options: { questionKey: string; section: { key: string; title: string; description?: string; order: number }; order: number } };
  const served = async (): Promise<Served[]> => {
    const response = await request(questionsPath(questionnaireId!), analyst);
    assert.equal(response.status, 200, "GENERATED_ADD_QUESTIONS_READ");
    return (await payload(response)).data as Served[];
  };
  const add = (section: Served["options"]["section"], order: number, questionText: string) =>
    request(questionsPath(questionnaireId!), analyst, post({ questionText, answerType: "Text", required: true, section, order }));
  const refusalReason = async (response: Response) => ((await response.json()) as { error?: { details?: { reason?: string } } }).error?.details?.reason;

  // The last question in Request context is removed, so the next free order must count it.
  const generated = await served();
  const providerDetails = generated.find((question) => question.options.questionKey === "third-party-details");
  assert.ok(providerDetails, "GENERATED_ADD_FIXTURE_QUESTION_MISSING");
  const removed = await request(`${questionsPath(questionnaireId)}/${encodeURIComponent(providerDetails.documentId)}`, analyst, { method: "DELETE" });
  assert.equal(removed.status, 200, "GENERATED_ADD_REMOVE_FAILED");

  const placements = await served();
  assert.ok(placements.some((question) => question.options.questionKey === "third-party-details" && question.deleted !== undefined), "GENERATED_ADD_REMOVED_QUESTION_NOT_SERVED");
  const contextQuestions = placements.filter((question) => question.options.section.key === "context");
  const context = contextQuestions[0]!.options.section;
  assert.deepEqual(context, { key: "context", title: "Request context", order: 0 }, "GENERATED_ADD_CONTEXT_SECTION");
  const nextContextOrder = Math.max(...contextQuestions.map((question) => question.options.order)) + 1;
  assert.equal(nextContextOrder, 4, "GENERATED_ADD_NEXT_ORDER_COUNTS_THE_REMOVED_QUESTION");

  // What the editor sent before the fix, and an order the removed question still holds, both clash.
  const legacy = await add({ key: "general", title: "General", order: 0 }, 0, "Who owns the service?");
  assert.equal(legacy.status, 409, "GENERATED_ADD_LEGACY_PLACEMENT_STATUS");
  assert.equal(await refusalReason(legacy), "DEFINITION_CONFLICT", "GENERATED_ADD_LEGACY_PLACEMENT_REASON");
  const onRemoved = await add(context, 3, "Who owns the service?");
  assert.equal(onRemoved.status, 409, "GENERATED_ADD_REMOVED_ORDER_STATUS");
  assert.equal(await refusalReason(onRemoved), "DEFINITION_CONFLICT", "GENERATED_ADD_REMOVED_ORDER_REASON");

  const toContext = await add(context, nextContextOrder, "Who owns the service?");
  assert.equal(toContext.status, 200, "GENERATED_ADD_TO_EXISTING_SECTION");

  const nextSectionOrder = Math.max(...placements.map((question) => question.options.section.order)) + 1;
  assert.equal(nextSectionOrder, 2, "GENERATED_ADD_NEXT_SECTION_ORDER");
  const offshore = { key: "section-offshore-support", title: "Offshore support", order: nextSectionOrder };
  const toNewSection = await add(offshore, 0, "Which offshore teams support the service?");
  assert.equal(toNewSection.status, 200, "GENERATED_ADD_TO_NEW_SECTION");

  // The analyst read projects nothing for an invalid definition, so a full list proves it stayed valid.
  const after = await served();
  assert.equal(after.length, 9, "GENERATED_ADD_DEFINITION_STAYS_VALID");
  const placed = (questionText: string) => {
    const question = after.find((candidate) => (candidate as unknown as { questionText: string }).questionText === questionText);
    assert.ok(question, `GENERATED_ADD_NOT_PERSISTED_${questionText}`);
    return { section: question.options.section, order: question.options.order };
  };
  assert.deepEqual(placed("Who owns the service?"), { section: context, order: 4 }, "GENERATED_ADD_EXISTING_SECTION_PLACEMENT");
  assert.deepEqual(placed("Which offshore teams support the service?"), { section: offshore, order: 0 }, "GENERATED_ADD_NEW_SECTION_PLACEMENT");
  assert.equal((await request(releasePath(questionnaireId), analyst, post())).status, 200, "GENERATED_ADD_RELEASES_WITH_A_VALID_DEFINITION");
});

/*
 * Phase 15 (15-08 Task 1; D-08, D-20): release waits for every AI proposal. A questionnaire with an open item, or with a
 * proposal job queued or running, cannot reach the Requestor; a damaged run never blocks it (fail open).
 */

const OFFSHORE_NOTE = "Jane: the vendor now uses an offshore support team with administrator access to the payroll system.";

type HarnessValue = Awaited<typeof harnessPromise>;

async function governanceRequest(path: string, identity: string, method: string, body?: unknown): Promise<Response> {
  return request(path, identity, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
}

/* Jane's submitted questionnaire with her marked offshore note, Bob's three-item proposal run, then the return to analyst review. */
async function seedOpenProposals(harness: HarnessValue, label: string, beforeProposals?: (requestId: string, questionnaireId: string) => Promise<unknown>): Promise<{ requestId: string; questionnaireId: string; runId: string }> {
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  await beforeProposals?.(requestId, questionnaireId);
  await harness.seedRequestNotes(requestId, [{ part: "requestor", sequence: 1, postedAt: "2026-09-01T00:00:00.000Z", body: OFFSHORE_NOTE, changesAiInputs: true }]);
  const started = await harness.startQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId);
  assert.equal(started.status, 202, `PROPOSALS_NOT_STARTED: ${JSON.stringify(started)}`);
  const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  assert.equal(ended.status, "completed", `JOB_NOT_COMPLETED: ${JSON.stringify(ended.failure)}`);
  const returned = await governanceRequest(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`, harness.identities.analyst, "POST", { reason: "Decide the offshore proposals." });
  assert.equal(returned.status, 200, `RETURN_TO_REVIEW_FAILED: ${await returned.clone().text()}`);
  return { requestId, questionnaireId, runId: String(ended.runId) };
}

async function answeredQuestionRows(harness: HarnessValue, questionnaireId: string): Promise<unknown[]> {
  return (((await harness.getQuestionnaire(questionnaireId))?.questions ?? []) as Array<Record<string, unknown>>)
    .filter((row) => { const answer = row.answer as Record<string, unknown> | null; return Boolean(answer && answer.value !== null && answer.value !== ""); })
    .map((row) => ({ documentId: row.documentId, questionText: row.questionText, options: row.options, answer: row.answer }))
    .sort((left, right) => String(left.documentId).localeCompare(String(right.documentId)));
}

async function releaseReason(response: Response): Promise<unknown> {
  return ((await response.clone().json()) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason;
}

test("mounted release is refused with AI_PROPOSALS_OPEN while an AI proposal item is open, deep-equal, and allowed after Reject remaining with every answer unchanged (D-08)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOpenProposals(harness, "GATE-RELEASE");
  const before = await harness.questionnaireSnapshotFixture(questionnaireId);
  const answeredBefore = await answeredQuestionRows(harness, questionnaireId);
  const refused = await governanceRequest(releasePath(questionnaireId), harness.identities.analyst, "POST");
  assert.equal(refused.status, 409, `RELEASE_NOT_REFUSED: ${await refused.clone().text()}`);
  assert.equal(await releaseReason(refused), "AI_PROPOSALS_OPEN");
  assert.deepEqual(await harness.questionnaireSnapshotFixture(questionnaireId), before, "REFUSED_RELEASE_NOT_DEEP_EQUAL");

  const rejected = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: ["i-1", "i-2", "i-3"].map((item) => ({ runId, item, action: "reject" })) });
  assert.deepEqual([rejected.status, rejected.data], [200, { applied: 3, unchanged: 0 }], `REJECT_REMAINING_FAILED: ${JSON.stringify(rejected)}`);
  const released = await governanceRequest(releasePath(questionnaireId), harness.identities.analyst, "POST");
  assert.equal(released.status, 200, `RELEASE_AFTER_REJECT_REMAINING_FAILED: ${await released.clone().text()}`);
  assert.equal(typeof (await harness.getQuestionnaire(questionnaireId))?.releasedAt, "string", "NOT_RELEASED");
  assert.deepEqual(await answeredQuestionRows(harness, questionnaireId), answeredBefore, "RELEASE_CHANGED_AN_ANSWERED_QUESTION");
});

test("mounted release is refused with AI_PROPOSALS_OPEN while a proposal job for the questionnaire is running (D-08)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId } = await harness.seedUatALikeRequest("GATE-RELEASE-JOB");
  const returned = await governanceRequest(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`, harness.identities.analyst, "POST", { reason: "Ask the AI first." });
  assert.equal(returned.status, 200);
  await harness.withHeldQuestionnaireProposalProvider(async (hold) => {
    const started = await harness.startQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId);
    assert.equal(started.status, 202, `PROPOSALS_NOT_STARTED: ${JSON.stringify(started)}`);
    await hold.reached;
    const refused = await governanceRequest(releasePath(questionnaireId), harness.identities.analyst, "POST");
    assert.equal(refused.status, 409, `RELEASE_NOT_REFUSED_WHILE_A_JOB_RUNS: ${await refused.clone().text()}`);
    assert.equal(await releaseReason(refused), "AI_PROPOSALS_OPEN");
    hold.release();
    await harness.waitForProposalJobFixture(String(started.data?.jobId));
  });
});

test("mounted release is not blocked by a damaged proposal run (fail open), which the gate logs once (D-20)", async () => {
  const harness = await harnessPromise;
  const { questionnaireId, runId } = await seedOpenProposals(harness, "GATE-RELEASE-DAMAGED");
  await harness.updateAiRunFixture(runId, { decisions: [{ schemaVersion: 2, at: "not-a-time", by: harness.users.analyst, item: "i-1", action: "accepted" }] });
  await harness.withStrapiWarnings(async (warnings) => {
    const released = await governanceRequest(releasePath(questionnaireId), harness.identities.analyst, "POST");
    assert.equal(released.status, 200, `DAMAGED_RUN_BLOCKED_THE_RELEASE: ${await released.clone().text()}`);
    const returned = await governanceRequest(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`, harness.identities.analyst, "POST", { reason: "Once more." });
    assert.equal(returned.status, 200);
    const again = await governanceRequest(releasePath(questionnaireId), harness.identities.analyst, "POST");
    assert.equal(again.status, 200);
    assert.equal(warnings().filter((message) => message.includes(runId)).length, 1, `DAMAGED_RUN_NOT_LOGGED_ONCE: ${JSON.stringify(warnings())}`);
  });
});

/*
 * Phase 15 (15-08 Task 4; D-05, D-27, D-28, D-30, D-32): the analyst's questionnaire reads say which questions are
 * answered (only in analyst review and on a submitted questionnaire), how many AI proposal items are open, and which
 * questions came from confirmed AI proposals.
 */

type Json = Record<string, unknown>;

async function readAs(path: string, identity: string, diagnostic: string): Promise<unknown> {
  const response = await request(path, identity);
  assert.equal(response.status, 200, `${diagnostic}: ${await response.clone().text()}`);
  return ((await response.json()) as { data: unknown }).data;
}

const headerPath = (questionnaireId: string) => `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}`;

/* The UAT-A-like questionnaire as an AI generation left it: generation facts and one completed generation run. */
async function markGenerated(harness: HarnessValue, requestId: string, questionnaireId: string): Promise<string> {
  const built = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId });
  const runId = await harness.createAiRunFixture({
    operation: "questionnaire-generation", initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire", providerVersion: "1",
    assessmentRequest: requestId, questionnaire: questionnaireId, contextSummary: built.context.summary,
  });
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  await harness.updateFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", questionnaireId, {
    generatedDate: "2026-08-20T00:00:00.000Z", generatedBy: harness.users.analyst, providerName: "deterministic-questionnaire", providerVersion: "1",
  });
  return runId;
}

test("mounted analyst questions read flags answered questions in analyst review and on a submitted questionnaire, never while the Requestor answers and never for the Requestor; progress counts the same answers (D-05, D-30)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const { questionnaireId } = await harness.seedUatALikeRequest("READ-ANSWERED");
  const submitted = await readAs(questionsPath(questionnaireId), analyst, "SUBMITTED_QUESTIONS") as Json[];
  assert.deepEqual(submitted.map((question) => [question.questionText, question.answered]), [
    ["Are payment files signed?", true], ["Are duties segregated?", true], ["Has the pay-run fallback been tested?", true], ["Other recovery notes?", false],
  ], "SUBMITTED_ANSWERED_FLAGS");
  assert.ok(submitted.every((question) => question.answer !== null || question.answered === false), "SUBMITTED_ANSWERS_HIDDEN");

  const returned = await governanceRequest(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/return_to_review`, analyst, "POST", { reason: "Check the answers." });
  assert.equal(returned.status, 200);
  const review = await readAs(questionsPath(questionnaireId), analyst, "REVIEW_QUESTIONS") as Json[];
  assert.deepEqual(review.map((question) => question.answered), [true, true, true, false], "REVIEW_ANSWERED_FLAGS");
  assert.ok(review.every((question) => question.answer === null), "REVIEW_READ_REVEALED_DRAFT_ANSWER_CONTENT");
  const header = await readAs(headerPath(questionnaireId), analyst, "REVIEW_HEADER") as Json;
  assert.equal((header.progress as Json).answered, review.filter((question) => question.answered === true).length, "PROGRESS_DISAGREES_WITH_THE_ANSWERED_FLAGS");

  const released = await governanceRequest(releasePath(questionnaireId), analyst, "POST");
  assert.equal(released.status, 200);
  const answering = await readAs(questionsPath(questionnaireId), analyst, "ANSWERING_QUESTIONS") as Json[];
  assert.ok(answering.every((question) => !("answered" in question)), "ANSWERED_FLAG_SERVED_WHILE_THE_REQUESTOR_ANSWERS");
  const ownerRead = await readAs(questionsPath(questionnaireId), owner, "OWNER_QUESTIONS") as Json[];
  assert.ok(ownerRead.every((question) => !("answered" in question)), "ANSWERED_FLAG_SERVED_TO_THE_REQUESTOR");
});

test("mounted analyst header carries the open AI proposal count, 0 once decided and null for a requesting analyst; generation.runId stays on the generation run after a proposal run (D-27, D-28, D-32)", async () => {
  const harness = await harnessPromise;
  let generationRunId = "";
  const { requestId, questionnaireId, runId } = await seedOpenProposals(harness, "READ-OPEN", async (request, questionnaire) => { generationRunId = await markGenerated(harness, request, questionnaire); });
  const generation = async (identity: string) => ((await readAs(headerPath(questionnaireId), identity, "HEADER")) as Json).generation as Json;
  const open = await generation(harness.identities.analyst);
  assert.equal(open.openProposals, 3, "OPEN_PROPOSALS_NOT_COUNTED");
  assert.equal(open.runId, generationRunId, "GENERATION_RUN_ID_MOVED_TO_THE_PROPOSAL_RUN");
  const rejected = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: ["i-1", "i-2", "i-3"].map((item) => ({ runId, item, action: "reject" })) });
  assert.equal(rejected.status, 200);
  assert.equal((await generation(harness.identities.analyst)).openProposals, 0, "DECIDED_PROPOSALS_STILL_OPEN");
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, { requestor: harness.users.analyst });
  assert.equal((await generation(harness.identities.analyst)).openProposals, null, "REQUESTING_ANALYST_SAW_THE_COUNT");
  assert.equal((await generation(harness.identities.secondAnalyst)).openProposals, 0, "SECOND_ANALYST_LOST_THE_COUNT");
});

test("mounted analyst questions read marks confirmed AI questions proposal-confirmed or proposal-edited, restores the earlier origin after an Undo, and reads generated-edited after a later manual edit (D-27)", async () => {
  const harness = await harnessPromise;
  const { analyst } = harness.identities;
  const { questionnaireId, runId } = await seedOpenProposals(harness, "READ-ORIGINS", (request, questionnaire) => markGenerated(harness, request, questionnaire));
  const origin = async (text: string) => ((await readAs(questionsPath(questionnaireId), analyst, "ORIGIN_QUESTIONS")) as Json[]).find((question) => question.questionText === text)?.aiOrigin;
  const decided = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: [
    { runId, item: "i-1", action: "accept" },
    { runId, item: "i-2", action: "accept", edits: { questionText: "Will the offshore team administer your systems?" } },
  ] });
  assert.equal(decided.status, 200, `CONFIRM_FAILED: ${JSON.stringify(decided)}`);
  assert.equal(await origin("In which country or countries is the offshore support team based?"), "proposal-confirmed");
  assert.equal(await origin("Will the offshore team administer your systems?"), "proposal-edited");

  // An analyst's own question, rewritten by a confirmed proposal and then undone, reads as the analyst's again.
  const added = await governanceRequest(`${headerPath(questionnaireId)}/questions`, analyst, "POST", { questionText: "Is MFA enforced for privileged accounts?", answerType: "Long text", required: false, section: { key: "payment", title: "Payment processing", order: 1 }, order: 9 });
  assert.equal(added.status, 200);
  const mfa = ((await readAs(questionsPath(questionnaireId), analyst, "MFA_QUESTIONS")) as Json[]).find((question) => question.questionText === "Is MFA enforced for privileged accounts?") as Json;
  assert.equal(mfa.aiOrigin, "analyst-added");
  const started = await harness.startQuestionRewriteFixture(harness.users.analyst, questionnaireId, String(mfa.documentId));
  assert.equal(started.status, 202, `REWRITE_NOT_STARTED: ${JSON.stringify(started)}`);
  const rewrite = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  const confirmRewrite = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: [{ runId: String(rewrite.runId), item: "i-1", action: "accept" }] });
  assert.equal(confirmRewrite.status, 200, `REWRITE_CONFIRM_FAILED: ${JSON.stringify(confirmRewrite)}`);
  const rewritten = ((await readAs(questionsPath(questionnaireId), analyst, "REWRITTEN_QUESTIONS")) as Json[]).find((question) => question.documentId === mfa.documentId) as Json;
  assert.equal(rewritten.aiOrigin, "proposal-confirmed");
  const undo = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: [{ runId: String(rewrite.runId), item: "i-1", action: "restore" }] });
  assert.equal(undo.status, 200);
  assert.equal(await origin("Is MFA enforced for privileged accounts?"), "analyst-added", "UNDO_DID_NOT_RESTORE_THE_ORIGIN");

  const country = ((await readAs(questionsPath(questionnaireId), analyst, "COUNTRY_QUESTIONS")) as Json[]).find((question) => question.questionText === "In which country or countries is the offshore support team based?") as Json;
  const edited = await governanceRequest(`${headerPath(questionnaireId)}/questions/${encodeURIComponent(String(country.documentId))}`, analyst, "PATCH", { helpText: "Edited by hand." });
  assert.equal(edited.status, 200);
  assert.equal(await origin("In which country or countries is the offshore support team based?"), "generated-edited", "MANUAL_EDIT_AFTER_CONFIRMATION_NOT_GENERATED_EDITED");
});

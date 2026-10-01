import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

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
  assert.equal(deniedAnswers.status, 403, "UNRELEASED_OWNER_ANSWERS_ALLOWED");
  const deniedSubmit = await request(`/api/v1/questionnaires/${encodeURIComponent(unreleased)}/submit`, harness.identities.owner, post());
  assert.equal(deniedSubmit.status, 403, "UNRELEASED_OWNER_SUBMIT_ALLOWED");

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
  })).status, 403, "RETURNED_OWNER_RETAINED_SAVE_ACCESS");
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  getVisibleQuestionKeys,
  parseQuestionnaireDefinition,
} from "../src/api/csrm-questionnaire/services/questionnaire-definition";
import {
  isRecord,
  loadCompleteQuestionnaireScope,
  projectQuestionnaire,
  projectQuestions,
  questionnaireState,
  QUESTIONNAIRE_SUMMARY_PAGE_SIZE,
  buildQuestionnaireCollectionQuery,
} from "../src/api/csrm-questionnaire/services/questionnaire-scope";
import {
  assertMutableAnswerBatch,
  buildDraftAnswerBatch,
  buildSubmittedAnswerBatch,
  nextRequestStatusAfterDraft,
  normalizeDraftAnswers,
  parseAnswerMutationPayload,
} from "../src/api/csrm-questionnaire/services/questionnaire-workflow";
import { parseRevertReason } from "../src/api/csrm-assessment-request/services/revert-reason";
import { questionnaireControllerExtension } from "../src/api/csrm-questionnaire/controllers/csrm-questionnaire";

type RecordValue = Record<string, unknown>;

const section = { key: "context", title: "Context", order: 0 };
const question = (
  questionKey: string,
  answerType: string,
  order: number,
  required: boolean,
  extra: RecordValue = {},
) => ({
  documentId: `question-${questionKey}`,
  questionText: `Question ${questionKey}`,
  answerType,
  options: { schemaVersion: 1, questionKey, section, order, required, ...extra },
  answer: null,
});

test("questionnaire collection queries are closed, scoped, and bounded", () => {
  const state = { csrmAuthorization: { questionnaireActor: "requestor" as const, questionnaireCollectionScope: "own" as const, questionnaireRequestorId: 7 } };
  const built = buildQuestionnaireCollectionQuery({ q: "vendor", status: "draft", sort: "title:asc", page: "2", pageSize: "25" }, state);
  assert.deepEqual(built.pagination, { page: 2, pageSize: 25 });
  assert.deepEqual(built.dataQuery.filters, built.countQuery.filters);
  assert.equal(built.dataQuery.start, 25);
  for (const invalid of [
    { status: "approved" }, { q: "" }, { q: "x".repeat(201) }, { sort: "createdAt:asc" },
    { page: 0 }, { pageSize: 101 }, { hostile: "query" }, { filters: {} },
  ]) assert.throws(() => buildQuestionnaireCollectionQuery(invalid, state));
});

test("definition parsing fails closed and recomputes conditional visibility", () => {
  const valid = parseQuestionnaireDefinition([
    question("internet-facing", "Boolean", 0, true),
    question("exposure-detail", "Text", 1, true, {
      visibility: { questionKey: "internet-facing", operator: "equals", value: true },
    }),
  ]);

  assert.deepEqual(getVisibleQuestionKeys(valid, { "internet-facing": false }), ["internet-facing"]);
  assert.deepEqual(getVisibleQuestionKeys(valid, { "internet-facing": true }), ["internet-facing", "exposure-detail"]);
  assert.throws(() => parseQuestionnaireDefinition([question("bad", "Text", 0, true, { unknown: true })]));
  assert.throws(() => parseQuestionnaireDefinition([
    question("forward", "Text", 0, true, {
      visibility: { questionKey: "later", operator: "equals", value: "yes" },
    }),
    question("later", "Text", 1, false),
  ]));
});

test("draft normalization allowlists input, clears hidden answers, and owns metadata", () => {
  const parsed = parseQuestionnaireDefinition([
    question("internet-facing", "Boolean", 0, true),
    question("exposure-detail", "Text", 1, true, {
      visibility: { questionKey: "internet-facing", operator: "equals", value: true },
    }),
  ]);
  assert.throws(() => parseAnswerMutationPayload({ answers: [{ questionKey: "internet-facing", value: false, state: "submitted" }] }));
  assert.throws(() => parseAnswerMutationPayload({ answers: [{ questionKey: "internet-facing", value: false }], reviewComment: "forged" }));
  const result = normalizeDraftAnswers(
    parsed,
    {
      "internet-facing": { schemaVersion: 1, value: true, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
      "exposure-detail": { schemaVersion: 1, value: "sensitive", state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
    },
    parseAnswerMutationPayload({ answers: [{ questionKey: "internet-facing", value: false }] }),
    new Date("2026-08-30T01:02:03.000Z"),
  );
  assert.deepEqual(result, {
    "internet-facing": {
      schemaVersion: 1,
      value: false,
      state: "draft",
      updatedAt: "2026-08-30T01:02:03.000Z",
    },
  });
});

test("workflow guards answerable request states and submitted batches", () => {
  assert.equal(nextRequestStatusAfterDraft("submitted"), "questionnaire-in-progress");
  assert.equal(nextRequestStatusAfterDraft("questionnaire-in-progress"), "questionnaire-in-progress");
  for (const status of ["draft", "risk-assessment-drafted", "under-review", "approved", "rejected"]) {
    assert.throws(() => nextRequestStatusAfterDraft(status));
  }
  assert.throws(() => assertMutableAnswerBatch({ q: { state: "submitted", submittedAt: "2026-08-30T01:02:03.000Z" } }));
});

test("submission rejects incomplete and unsupported active questions and stamps one complete batch", () => {
  const required = parseQuestionnaireDefinition([
    question("name", "Text", 0, true),
    question("confirmed", "Boolean", 1, true),
  ]);
  assert.throws(() => buildSubmittedAnswerBatch(required, {
    name: { schemaVersion: 1, value: "CSRM", state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
  }, new Date("2026-08-30T02:00:00.000Z")));

  const unsupported = parseQuestionnaireDefinition([question("evidence", "File upload", 0, true)]);
  assert.throws(() => buildSubmittedAnswerBatch(unsupported, {}, new Date("2026-08-30T02:00:00.000Z")));

  const complete = buildSubmittedAnswerBatch(required, {
    name: { schemaVersion: 1, value: "CSRM", state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
    confirmed: { schemaVersion: 1, value: true, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
  }, new Date("2026-08-30T02:00:00.000Z"));
  assert.deepEqual(new Set(Object.values(complete).map((answer) => (answer as RecordValue).submittedAt)), new Set(["2026-08-30T02:00:00.000Z"]));
  assert.ok(Object.values(complete).every((answer) => (answer as RecordValue).state === "submitted"));
});

test("reversal restores only a complete submitted active batch without changing values", () => {
  const definition = parseQuestionnaireDefinition([
    question("name", "Text", 0, true),
    question("confirmed", "Boolean", 1, true),
  ]);
  const result = buildDraftAnswerBatch(definition, {
    name: { schemaVersion: 1, value: "Retained", state: "submitted", updatedAt: "2026-08-01T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z" },
    confirmed: { schemaVersion: 1, value: false, state: "submitted", updatedAt: "2026-08-01T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z" },
  }, new Date("2026-09-01T00:00:00.000Z"));
  assert.deepEqual(result, {
    name: { schemaVersion: 1, value: "Retained", state: "draft", updatedAt: "2026-09-01T00:00:00.000Z" },
    confirmed: { schemaVersion: 1, value: false, state: "draft", updatedAt: "2026-09-01T00:00:00.000Z" },
  });
  assert.throws(() => buildDraftAnswerBatch(definition, {
    name: { schemaVersion: 1, value: "Retained", state: "submitted", updatedAt: "2026-08-01T00:00:00.000Z", submittedAt: "2026-08-02T00:00:00.000Z" },
    confirmed: { schemaVersion: 1, value: false, state: "draft", updatedAt: "2026-08-01T00:00:00.000Z" },
  }));
});

test("reversal reasons are trimmed and bounded", () => {
  assert.equal(parseRevertReason({ reason: "  Correct data  " }, "CSRM questionnaire"), "Correct data");
  assert.equal(parseRevertReason({ reason: "x".repeat(500) }, "CSRM questionnaire").length, 500);
  for (const reason of ["   ", "x".repeat(501)]) {
    assert.throws(() => parseRevertReason({ reason }, "CSRM questionnaire"));
  }
});

test("summary loading pages deterministically through the complete authorized scope", async () => {
  const source = Array.from({ length: QUESTIONNAIRE_SUMMARY_PAGE_SIZE + 1 }, (_, index) => ({
    documentId: `questionnaire-${String(index).padStart(4, "0")}`,
  }));
  const queries: RecordValue[] = [];
  const result = await loadCompleteQuestionnaireScope(async (query) => {
    queries.push(query);
    const start = Number(query.start);
    const limit = Number(query.limit);
    return source.slice(start, start + limit);
  }, { filters: { owner: true }, populate: { questions: true } });

  assert.equal(result.length, QUESTIONNAIRE_SUMMARY_PAGE_SIZE + 1);
  assert.deepEqual(queries.map(({ start, limit, sort }) => ({ start, limit, sort })), [
    { start: 0, limit: QUESTIONNAIRE_SUMMARY_PAGE_SIZE, sort: ["documentId:asc"] },
    { start: QUESTIONNAIRE_SUMMARY_PAGE_SIZE, limit: QUESTIONNAIRE_SUMMARY_PAGE_SIZE, sort: ["documentId:asc"] },
  ]);
  assert.ok(queries.every((query) => (query.filters as RecordValue).owner === true && isRecord(query.populate)));
});

test("summary controller exhausts every authorized page", async () => {
  const source = Array.from({ length: QUESTIONNAIRE_SUMMARY_PAGE_SIZE + 1 }, (_, index) => ({
    documentId: `questionnaire-${String(index).padStart(4, "0")}`,
    questions: [question(`question-${index}`, "Text", 0, false)],
  }));
  const queries: RecordValue[] = [];
  const controller = questionnaireControllerExtension({
    strapi: {
      documents: () => ({
        count: async () => source.length,
        findOne: async () => null,
        findMany: async (query: RecordValue) => {
          queries.push(query);
          return source.slice(Number(query.start), Number(query.start) + Number(query.limit));
        },
      }),
    },
  });
  const result = await controller.reviewSummary({
    query: {},
    state: { csrmAuthorization: { questionnaireActor: "analyst", questionnaireCollectionScope: "all" } },
  }) as { data: { total: number } };

  assert.equal(result.data.total, QUESTIONNAIRE_SUMMARY_PAGE_SIZE + 1);
  assert.deepEqual(queries.map(({ start, limit }) => ({ start, limit })), [
    { start: 0, limit: QUESTIONNAIRE_SUMMARY_PAGE_SIZE },
    { start: QUESTIONNAIRE_SUMMARY_PAGE_SIZE, limit: QUESTIONNAIRE_SUMMARY_PAGE_SIZE },
  ]);
});

test("collection controller derives native state after owner scope and keeps rows and total aligned", async () => {
  const ownDraft = {
    documentId: "own-draft",
    questionnaireNumber: "Q-OWN-DRAFT",
    title: "Own draft",
    assessmentRequest: { documentId: "request-own", requestor: { id: 7 }, requestNumber: "R-OWN", requestStatus: "questionnaire-in-progress", title: "Own request" },
    questions: [{ ...question("own", "Text", 0, false), answer: { value: "draft", state: "draft" } }],
  };
  const otherDraft = {
    ...ownDraft,
    documentId: "other-draft",
    questionnaireNumber: "Q-OTHER-DRAFT",
    title: "Other draft",
    assessmentRequest: { ...ownDraft.assessmentRequest, documentId: "request-other", requestor: { id: 9 } },
  };
  const ownSubmitted = {
    ...ownDraft,
    documentId: "own-submitted",
    questionnaireNumber: "Q-OWN-SUBMITTED",
    title: "Own submitted",
    questions: [{ ...question("submitted", "Text", 0, false), answer: { value: "done", state: "submitted", submittedAt: "2026-09-01T00:00:00.000Z" } }],
  };
  const source = [ownDraft, otherDraft, ownSubmitted];
  const controller = questionnaireControllerExtension({
    strapi: {
      documents: () => ({
        count: async () => { throw new Error("DERIVED_STATUS_MUST_NOT_USE_PERSISTED_COUNT"); },
        findOne: async () => null,
        findMany: async (query: RecordValue) => {
          const ownerId = (((query.filters as RecordValue).$and as RecordValue[] | undefined)?.find((item) => "assessmentRequest" in item)?.assessmentRequest as RecordValue | undefined)?.requestor as RecordValue | undefined;
          const owner = ((ownerId?.id as RecordValue | undefined)?.$eq);
          const scoped = owner === undefined ? source : source.filter((document) => document.assessmentRequest.requestor.id === owner);
          return scoped.slice(Number(query.start), Number(query.start) + Number(query.limit));
        },
      }),
    },
  });
  const result = await controller.listMine({
    query: { status: "draft", page: "1", pageSize: "25" },
    state: { csrmAuthorization: { questionnaireActor: "requestor", questionnaireCollectionScope: "own", questionnaireRequestorId: 7 } },
  }) as { data: RecordValue[]; meta: { pagination: { total: number } } };

  assert.deepEqual(result.data.map((item) => item.documentId), ["own-draft"]);
  assert.equal(result.data[0]?.state, "draft");
  assert.equal(result.meta.pagination.total, 1);
});

test("empty and malformed definitions project as safe empty reads", () => {
  const malformed = [{ ...question("bad", "Text", 0, false), options: { schemaVersion: 2 } }];
  for (const questions of [[], malformed]) {
    assert.deepEqual(projectQuestions(questions, "analyst"), []);
    assert.deepEqual((projectQuestionnaire({ documentId: "questionnaire-bad", questions }).progress), {
      answered: 0, total: 0, percent: 0,
    });
    assert.equal(questionnaireState({ questions }), "not-started");
  }
});


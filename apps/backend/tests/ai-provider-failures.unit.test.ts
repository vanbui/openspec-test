import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildAssessmentContext } from "../src/csrm/ai/assessment-context";
import { uatALikeRecords } from "./fixtures/uat-a-like-context";

import { openaiCompatibleAssessmentDraftProvider } from "../src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider";
import { AssessmentDraftJobFailure } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { openaiCompatibleQuestionnaireGenerationProvider } from "../src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider";
import { QuestionnaireGenerationJobFailure } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";
import { questionnaireContextFixture } from "./helpers/questionnaire-context-fixture";

const questionnaireContext = questionnaireContextFixture();
const assessmentRecords = uatALikeRecords();
const assessmentContext = buildAssessmentContext(assessmentRecords, { operation: "assessment-draft" });
const validQuestionnaire = JSON.stringify({ schemaVersion: 2, title: "Generated", description: "Description", questions: Array.from({ length: 8 }, (_, index) => ({ questionText: `Describe the security objective ${index + 1}.`, helpText: "Explain the objective.", answerType: "Long text", sectionTitle: "Context", required: true, choices: [] })) });
const invalidQuestionnaire = JSON.stringify({ ...JSON.parse(validQuestionnaire), extra: true });
const validAssessment = readFileSync(path.resolve(process.cwd(), "tests/fixtures/ai-wire/assessment-v2-uat-a.json"), "utf8");
const invalidAssessment = readFileSync(path.resolve(process.cwd(), "tests/fixtures/ai-wire/assessment-v2-rating-field.json"), "utf8");

type FailureCase = { name: string; response: { status?: number; body?: string; rawBody?: string; delayMs?: number }; code: string; singleRequest?: boolean };
const cases: FailureCase[] = [
  { name: "401", response: { status: 401, rawBody: '{"error":{"message":"upstream-auth-body"}}' }, code: "PROVIDER_AUTH_ERROR" },
  { name: "403", response: { status: 403, rawBody: '{"error":{"message":"upstream-permission-body"}}' }, code: "PROVIDER_AUTH_ERROR" },
  { name: "429", response: { status: 429, rawBody: '{"error":{"message":"upstream-rate-body"}}' }, code: "PROVIDER_RATE_LIMITED", singleRequest: true },
  { name: "timeout", response: { delayMs: 300, body: validQuestionnaire }, code: "PROVIDER_TIMEOUT", singleRequest: true },
  { name: "non-JSON", response: { rawBody: "upstream-non-json-body" }, code: "PROVIDER_OUTPUT_INVALID" },
  { name: "schema-invalid", response: { body: invalidQuestionnaire }, code: "PROVIDER_OUTPUT_INVALID" },
];

function setConfig(baseURL: string, timeout: number): void {
  globalThis.strapi = { config: { get: (key: string) => key === "ai" ? {
    providerLabel: "local-compatible", structuredOutputMode: true, requestTimeoutMs: timeout, reasoningEffort: "",
    questionnaireGeneration: { baseURL, apiKey: "", model: "questionnaire-model", maxOutputTokens: 1024 },
    assessmentDraft: { baseURL, apiKey: "", model: "assessment-model", maxOutputTokens: 1024 },
  } : undefined } } as never;
}

function assertSafeFailure(error: unknown, Failure: typeof QuestionnaireGenerationJobFailure | typeof AssessmentDraftJobFailure, code: string, baseURL: string, model: string, upstreamText: string): boolean {
  assert.ok(error instanceof Failure);
  assert.equal(error.code, code);
  assert.match(error.code, /^[A-Z][A-Z0-9_]{0,63}$/);
  assert.ok(error.safeMessage.trim().length > 0);
  assert.ok(error.safeMessage.length < 255);
  for (const forbidden of ["127.0.0.1", new URL(baseURL).port, model, upstreamText, "Error:", "    at "]) assert.equal(error.safeMessage.includes(forbidden), false);
  return true;
}

async function assertQuestionnaireFailure(failure: FailureCase): Promise<void> {
  const originalStrapi = globalThis.strapi;
  try {
    const server = await startFakeOpenAiCompatibleServer({ response: failure.response });
    try {
      setConfig(server.baseURL, failure.name === "timeout" ? 150 : 1_000);
      await assert.rejects(() => openaiCompatibleQuestionnaireGenerationProvider.generate(questionnaireContext), (error: unknown) =>
        assertSafeFailure(error, QuestionnaireGenerationJobFailure, failure.code, server.baseURL, "questionnaire-model", failure.response.rawBody ?? failure.response.body ?? ""));
      if (failure.singleRequest) assert.equal(server.requests.length, 1);
    } finally { await server.close(); }
  } finally { globalThis.strapi = originalStrapi; }
}

async function assertAssessmentFailure(failure: FailureCase): Promise<void> {
  const originalStrapi = globalThis.strapi;
  try {
    const body = failure.name === "timeout" ? validAssessment : failure.name === "schema-invalid" ? invalidAssessment : failure.response.body;
    const server = await startFakeOpenAiCompatibleServer({ response: { ...failure.response, ...(body ? { body } : {}) } });
    try {
      setConfig(server.baseURL, failure.name === "timeout" ? 150 : 1_000);
      await assert.rejects(() => openaiCompatibleAssessmentDraftProvider.generate({ context: assessmentContext, records: assessmentRecords }), (error: unknown) =>
        assertSafeFailure(error, AssessmentDraftJobFailure, failure.code, server.baseURL, "assessment-model", failure.response.rawBody ?? body ?? ""));
      if (failure.singleRequest) assert.equal(server.requests.length, 1);
    } finally { await server.close(); }
  } finally { globalThis.strapi = originalStrapi; }
}

for (const failure of cases) {
  test(`questionnaire provider maps ${failure.name} to a safe typed job failure`, () => assertQuestionnaireFailure(failure));
  test(`assessment provider maps ${failure.name} to a safe typed job failure`, () => assertAssessmentFailure(failure));
}

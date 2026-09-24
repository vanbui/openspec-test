import assert from "node:assert/strict";
import test from "node:test";

import { openaiCompatibleQuestionnaireGenerationProvider } from "../src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider";
import { QuestionnaireGenerationJobFailure } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";

function questionnaireWire(overrides: Record<string, unknown> = {}) {
  const questions = Array.from({ length: 8 }, (_, index) => ({ questionText: `Question ${index + 1}?`, answerType: "Long text", sectionTitle: "Context", required: true, choices: [] }));
  return { schemaVersion: 1, title: "Generated questionnaire", description: "Generated description", questions, ...overrides };
}

const proposal = JSON.stringify(questionnaireWire());
const context = { title: "Payroll replacement", description: "Replace payroll platform", assessmentType: "Third-party", businessPurpose: "Pay employees without interruption", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "Hosted service" };

function setConfig(baseURL: string, reasoningEffort = "", completionTranscriptDiagnostics = false, logs: unknown[] = []) {
  globalThis.strapi = { config: { get: (key: string) => key === "ai" ? { providerLabel: "csrm-selfhosted", structuredOutputMode: true, requestTimeoutMs: 1000, reasoningEffort, completionTranscriptDiagnostics, questionnaireGeneration: { baseURL, apiKey: "", model: "csrm-test-model", maxOutputTokens: 1024 }, assessmentDraft: { baseURL: "", apiKey: "", model: "", maxOutputTokens: 1024 } } : undefined }, log: { info: (entry: unknown) => logs.push(entry) } } as never;
}

test("questionnaire provider sends a validated request to the local compatible endpoint", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: proposal } });
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleQuestionnaireGenerationProvider.generate(context);
    assert.equal(result.title, "Generated questionnaire");
    assert.equal(openaiCompatibleQuestionnaireGenerationProvider.name, "csrm-selfhosted");
    assert.equal(openaiCompatibleQuestionnaireGenerationProvider.version, "csrm-test-model");
    const request = server.requests[0]?.body as Record<string, unknown>;
    assert.equal(request.model, "csrm-test-model");
    assert.equal(typeof request.max_tokens, "number");
    assert.equal(Object.prototype.hasOwnProperty.call(request, "reasoning_effort"), false);
    assert.match(String((request.messages as Array<{ content: string }>)[0].content), /untrusted data/);
    assert.match(String((request.messages as Array<{ content: string }>)[1].content), /Pay employees without interruption/);
    assert.equal((request.response_format as Record<string, unknown>).type, "json_schema");
  } finally { await server.close(); }
});

test("questionnaire provider records transcripts only when explicitly enabled", async () => {
  const server = await startFakeOpenAiCompatibleServer({ responses: [{ body: proposal }, { body: proposal }] });
  try {
    const logs: unknown[] = [];
    setConfig(server.baseURL, "", false, logs);
    await openaiCompatibleQuestionnaireGenerationProvider.generate(context);
    assert.deepEqual(logs, []);

    setConfig(server.baseURL, "", true, logs);
    await openaiCompatibleQuestionnaireGenerationProvider.generate(context);
    assert.deepEqual(logs.map((entry) => JSON.parse(String(entry))), [
      { event: "csrm.ai.completion.prompt", schemaName: "questionnaire_generation_proposal", systemPrompt: (server.requests[1]?.body as Record<string, any>).messages[0].content, userPrompt: (server.requests[1]?.body as Record<string, any>).messages[1].content },
      { event: "csrm.ai.completion.response", schemaName: "questionnaire_generation_proposal", content: proposal, finishReason: "stop", refusal: null },
    ]);
    assert.equal(JSON.stringify(logs).includes(server.baseURL), false);
    assert.equal(JSON.stringify(logs).includes("authorization"), false);
  } finally { await server.close(); }
});

test("questionnaire provider sends configured reasoning effort and rejects invalid content", async () => {
  const server = await startFakeOpenAiCompatibleServer({ responses: [{ body: proposal }, { body: "not json at all" }, { body: "", }] });
  try {
    setConfig(server.baseURL, "none");
    await openaiCompatibleQuestionnaireGenerationProvider.generate(context);
    assert.equal((server.requests[0]?.body as Record<string, unknown>).reasoning_effort, "none");
    await assert.rejects(() => openaiCompatibleQuestionnaireGenerationProvider.generate(context), (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && error.code === "PROVIDER_OUTPUT_INVALID" && error.safeMessage.length > 0 && error.safeMessage.length < 255 && !error.safeMessage.includes("127.0.0.1") && !error.safeMessage.includes("csrm-test-model"));
    await assert.rejects(() => openaiCompatibleQuestionnaireGenerationProvider.generate(context), (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && error.code === "PROVIDER_OUTPUT_INVALID");
  } finally { await server.close(); }
});

test("provider selection defaults safely and persistence records provenance", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: proposal } });
  const originalProvider = process.env.CSRM_AI_PROVIDER;
  try {
    const selectionPath = require.resolve("../src/csrm/ai-provider-selection");
    delete process.env.CSRM_AI_PROVIDER; delete require.cache[selectionPath];
    assert.equal(require("../src/csrm/ai-provider-selection").CSRM_AI_PROVIDER_MODE, "deterministic");
    process.env.CSRM_AI_PROVIDER = "anything-else"; delete require.cache[selectionPath];
    assert.equal(require("../src/csrm/ai-provider-selection").CSRM_AI_PROVIDER_MODE, "deterministic");
    process.env.CSRM_AI_PROVIDER = "openai-compatible"; delete require.cache[selectionPath];
    assert.equal(require("../src/csrm/ai-provider-selection").CSRM_AI_PROVIDER_MODE, "openai-compatible");
    setConfig(server.baseURL);
    const workflowPath = require.resolve("../src/api/csrm-questionnaire/services/questionnaire-generation-workflow");
    delete require.cache[workflowPath];
    const { persistGeneratedQuestionnaire } = require("../src/api/csrm-questionnaire/services/questionnaire-generation-workflow") as typeof import("../src/api/csrm-questionnaire/services/questionnaire-generation-workflow");
    let createData: Record<string, unknown> | undefined;
    const request = { documentId: "request-1", requestStatus: "submitted", ...context, questionnaire: null };
    const documents = (uid: string) => ({ findOne: async () => uid.includes("assessment-request") ? request : null, findMany: async () => [], create: async (input: { data: Record<string, unknown> }) => { if (uid.includes("csrm-questionnaire")) createData = input.data; return { documentId: "created" }; }, update: async () => ({ documentId: "updated" }), delete: async () => undefined });
    const chain = { select: () => chain, where: () => chain, forUpdate: () => chain, transacting: () => chain, execute: async <T>() => [] as T };
    await persistGeneratedQuestionnaire({ documents, db: { transaction: async <T>(work: (value: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } }, "request-1", "analyst-1", true);
    assert.deepEqual({ providerName: createData?.providerName, providerVersion: createData?.providerVersion, generatedBy: createData?.generatedBy }, { providerName: "csrm-selfhosted", providerVersion: "csrm-test-model", generatedBy: "analyst-1" });
    assert.equal(typeof createData?.generatedDate, "string");
  } finally {
    if (originalProvider === undefined) delete process.env.CSRM_AI_PROVIDER; else process.env.CSRM_AI_PROVIDER = originalProvider;
    await server.close();
  }
});

test("questionnaire provider builds a parser-valid definition from the model wire shape", async () => {
  const wire = { ...questionnaireWire(), title: "Payroll platform questionnaire", description: "Questions about the hosted payroll migration.", questions: [
    { questionText: "Who owns payroll data privacy?", answerType: "Single select", sectionTitle: "Governance", required: true, choices: ["CISO", "Head of HR"] },
    { questionText: "Describe the vendor encryption model.", answerType: "Long text", sectionTitle: "Data protection", required: true, choices: [] },
    { questionText: "Is a data processing agreement signed?", answerType: "Boolean", sectionTitle: "Governance", required: false, choices: [] },
    ...Array.from({ length: 5 }, (_, index) => ({ questionText: `Follow-up question ${index + 4}?`, answerType: "Text", sectionTitle: "Context", required: true, choices: [] })),
  ] };
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(wire) } });
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleQuestionnaireGenerationProvider.generate(context);
    assert.equal(result.description, "Questions about the hosted payroll migration.");
    const byText = new Map(result.questions.map((question) => [question.questionText, question.options as Record<string, any>]));
    assert.deepEqual(byText.get("Who owns payroll data privacy?"), { schemaVersion: 1, questionKey: "q-1", section: { key: "section-1", title: "Governance", order: 0 }, order: 0, required: true, choices: [{ value: "CISO", label: "CISO" }, { value: "Head of HR", label: "Head of HR" }] });
    assert.deepEqual(byText.get("Describe the vendor encryption model."), { schemaVersion: 1, questionKey: "q-2", section: { key: "section-2", title: "Data protection", order: 1 }, order: 0, required: true });
    assert.deepEqual(byText.get("Is a data processing agreement signed?"), { schemaVersion: 1, questionKey: "q-3", section: { key: "section-1", title: "Governance", order: 0 }, order: 1, required: false });
    const schema = ((server.requests[0]?.body as Record<string, any>).response_format.json_schema.schema) as Record<string, any>;
    assert.deepEqual(schema.properties.questions.items.required, ["questionText", "answerType", "sectionTitle", "required", "choices"]);
    assert.equal(schema.properties.questions.minItems, 8);
    assert.equal(schema.properties.questions.maxItems, 15);
    assert.equal(schema.properties.title.maxLength, 255);
    assert.equal(schema.properties.questions.items.properties.choices.items.maxLength, 255);
    assert.equal(schema.properties.schemaVersion.type, "integer");
    assert.equal(schema.properties.questions.items.properties.answerType.type, "string");
    assert.equal(Object.prototype.hasOwnProperty.call(schema.properties.questions.items, "allOf"), false);
    assert.equal(schema.properties.questions.items.properties.answerType.enum.includes("File upload"), false);
  } finally { await server.close(); }
});

test("questionnaire provider rejects shapes the definition parser cannot accept", async () => {
  const question = (overrides: Record<string, unknown>) => questionnaireWire({ questions: Array.from({ length: 8 }, () => ({ questionText: "Question?", answerType: "Text", sectionTitle: "Context", required: true, choices: [], ...overrides })) });
  const inventedShape = { schemaVersion: 1, title: "Generated", description: "Description", questions: [{ questionText: "Question?", answerType: "single-choice", options: { options: ["Yes", "No"] } }] };
  const bodies = [inventedShape, questionnaireWire({ questions: [] }), question({ answerType: "Single select", choices: [] }), question({ answerType: "File upload" }), question({ answerType: "Multi select", choices: ["Same", " Same "] }), question({ choices: ["not allowed"] }), question({ required: "true" }), question({ questionText: " " }), question({ sectionTitle: " " }), question({ extra: true }), { ...question({}), description: " " }];
  const server = await startFakeOpenAiCompatibleServer({ responses: bodies.map((body) => ({ body: JSON.stringify(body) })) });
  try {
    setConfig(server.baseURL);
    for (let index = 0; index < bodies.length; index += 1) {
      await assert.rejects(() => openaiCompatibleQuestionnaireGenerationProvider.generate(context), (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && error.code === "PROVIDER_OUTPUT_INVALID");
    }
  } finally { await server.close(); }
});

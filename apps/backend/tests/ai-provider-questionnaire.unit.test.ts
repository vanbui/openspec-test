import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { openaiCompatibleQuestionnaireGenerationProvider, toQuestionnaireGenerationProposal, questionnaireGenerationWireSchema } from "../src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider";
import { QuestionnaireGenerationJobFailure } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { parseQuestionnaireGenerationProposal, validatedGenerationQuestions } from "../src/api/csrm-questionnaire/services/questionnaire-generation-provider";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";
import { questionnaireContextFixture } from "./helpers/questionnaire-context-fixture";
import { RUNTIMES_OUTSIDE_DEVELOPMENT, withRuntimeEnvironment } from "./helpers/runtime-environment";
import { walkWireSchema } from "./helpers/wire-schema-guard";

const fixture = (name: string): Record<string, any> => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", `questionnaire-v2-${name}.json`), "utf8"));
const input = questionnaireContextFixture();

/* `diagnostics` is CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS; `logs` receives every line the provider writes to Strapi's info log. */
function setConfig(baseURL: string, options: { diagnostics?: boolean; logs?: string[]; apiKey?: string } = {}): void {
  const logs = options.logs ?? [];
  globalThis.strapi = {
    config: { get: (key: string) => key === "ai" ? { providerLabel: "local-compatible", structuredOutputMode: true, requestTimeoutMs: 1000, reasoningEffort: "", completionTranscriptDiagnostics: options.diagnostics ?? false, questionnaireGeneration: { baseURL, apiKey: options.apiKey ?? "", model: "questionnaire-test", maxOutputTokens: 1024 }, assessmentDraft: { baseURL: "", apiKey: "", model: "", maxOutputTokens: 1024 } } : undefined },
    log: { info: (entry: string) => logs.push(entry) },
  } as never;
}

/*
 * CR-201 (G-7, D-30): a completion transcript holds the Requestor's data (the whole prompt) and the model's answer, so the
 * flag writes it to the log only when NODE_ENV and CSRM_ENVIRONMENT are both development: never with the flag off, and
 * never in any other runtime with the flag on. The transcript names neither the endpoint nor the key.
 */
test("the questionnaire provider logs its completion transcript only with the flag on in development", async () => {
  const body = JSON.stringify(fixture("uat-a"));
  const key = "transcript-test-key";
  const server = await startFakeOpenAiCompatibleServer({ responses: Array.from({ length: 2 + RUNTIMES_OUTSIDE_DEVELOPMENT.length }, () => ({ body })) });
  const original = globalThis.strapi;
  const logs: string[] = [];
  try {
    await withRuntimeEnvironment("development", "development", async () => {
      setConfig(server.baseURL, { diagnostics: false, logs, apiKey: key });
      await openaiCompatibleQuestionnaireGenerationProvider.generate(input);
      assert.deepEqual(logs, [], "TRANSCRIPT_LOGGED_WITH_THE_FLAG_OFF");
      setConfig(server.baseURL, { diagnostics: true, logs, apiKey: key });
      await openaiCompatibleQuestionnaireGenerationProvider.generate(input);
    });
    const sent = server.requests[1].body as Record<string, any>;
    assert.deepEqual(logs.map((entry) => JSON.parse(entry)), [
      { event: "csrm.ai.completion.prompt", schemaName: "questionnaire_generation_proposal", systemPrompt: sent.messages[0].content, userPrompt: sent.messages[1].content },
      { event: "csrm.ai.completion.response", schemaName: "questionnaire_generation_proposal", content: body, finishReason: "stop", refusal: null },
    ], "TRANSCRIPT_NOT_LOGGED_IN_DEVELOPMENT");
    assert.equal(sent.messages[1].content, input.context.userPrompt, "the transcript is the prompt that was sent");
    assert.ok(!logs.some((entry) => entry.includes(server.baseURL) || entry.includes(key)), "TRANSCRIPT_NAMED_THE_ENDPOINT_OR_THE_KEY");
    for (const [nodeEnv, csrmEnvironment] of RUNTIMES_OUTSIDE_DEVELOPMENT) {
      logs.length = 0;
      await withRuntimeEnvironment(nodeEnv, csrmEnvironment, () => openaiCompatibleQuestionnaireGenerationProvider.generate(input));
      assert.deepEqual(logs, [], `TRANSCRIPT_LOGGED_UNDER_NODE_ENV_${nodeEnv}_CSRM_ENVIRONMENT_${csrmEnvironment}`);
    }
    assert.equal(server.requests.length, 2 + RUNTIMES_OUTSIDE_DEVELOPMENT.length, "every case reached the provider");
  } finally { globalThis.strapi = original; await server.close(); }
});

test("questionnaire wire v2 is portable and sends the complete bounded context", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(fixture("uat-a")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleQuestionnaireGenerationProvider.generate(input);
    assert.equal(result.questions.length, 8);
    assert.deepEqual(result.questions.map((question) => question.options.questionKey), Array.from({ length: 8 }, (_, i) => `q-${i + 1}`));
    for (const question of result.questions) if (["Single select", "Multi select"].includes(question.answerType)) assert.equal((question.options.choices as Array<{ label: string }>).at(-1)?.label, "Not sure");
    const request = server.requests[0]?.body as Record<string, any>;
    const messages = request.messages as Array<{ content: string }>;
    assert.equal(messages[1].content, input.context.userPrompt);
    assert.match(messages[0].content, /plain language.*help text.*Not sure.*optional/i);
    assert.equal("tools" in request, false);
    const schema = request.response_format.json_schema.schema;
    assert.deepEqual(schema, questionnaireGenerationWireSchema());
    const guard = walkWireSchema(schema);
    assert.deepEqual(guard.forbidden, []);
    assert.ok(guard.properties <= 100);
    assert.ok(guard.depth <= 5);
  } finally { globalThis.strapi = original; await server.close(); }
});

/* The definition a generation stores from a model's wire output: the adapter, the closed proposal parser, then the definition check. */
function storedDefinition(wire: unknown) {
  return validatedGenerationQuestions(parseQuestionnaireGenerationProposal(toQuestionnaireGenerationProposal(wire)));
}
const NOT_SURE = { value: "not-sure", label: "Not sure" };
const choiceOf = (text: string) => ({ value: text, label: text });

/*
 * WR-02, WR-209 and IN-110 (D-16): every generated choice question offers "Not sure" exactly once, as the canonical
 * `{ value: "not-sure", label: "Not sure" }` the Requestor's introduction looks for. A model's own equivalent is that
 * choice where the model put it; one is added last only when the model offered none.
 */
test("the stored definition offers one canonical Not sure on every choice question, wherever the model offered its own", () => {
  const byKey = new Map(storedDefinition(fixture("not-sure-equivalents")).map((question) => [question.questionKey, question.choices ?? null]));
  assert.deepEqual(byKey.get("q-1"), [choiceOf("Yes"), choiceOf("No"), NOT_SURE], "MODEL_NOT_SURE_KEPT_ITS_OWN_VALUE");
  assert.deepEqual(byKey.get("q-2"), [choiceOf("Yes"), NOT_SURE, choiceOf("No")], "MODEL_UNSURE_NOT_NORMALISED_IN_PLACE");
  assert.deepEqual(byKey.get("q-3"), [choiceOf("Password"), choiceOf("Single sign-on"), NOT_SURE], "MODEL_DONT_KNOW_NOT_NORMALISED");
  assert.deepEqual(byKey.get("q-4"), [choiceOf("Yes"), choiceOf("No"), NOT_SURE], "MODEL_I_DONT_KNOW_NOT_NORMALISED");
  assert.deepEqual(byKey.get("q-5"), [choiceOf("Yes"), choiceOf("No"), NOT_SURE], "MODEL_NOT_SURE_VALUE_DUPLICATED");
  assert.deepEqual(byKey.get("q-6"), [choiceOf("Yes"), NOT_SURE], "TWO_MODEL_EQUIVALENTS_NOT_MERGED");
  assert.deepEqual(byKey.get("q-7"), [choiceOf("Yes"), choiceOf("No"), NOT_SURE], "MISSING_NOT_SURE_NOT_ADDED_LAST");
  assert.equal(byKey.get("q-8"), null, "A TEXT QUESTION GAINED CHOICES");

  const missing = storedDefinition(fixture("missing-not-sure"));
  assert.deepEqual(missing[0].choices, [choiceOf("Yes"), choiceOf("No"), NOT_SURE]);
  assert.deepEqual(missing[1].choices, [choiceOf("A"), choiceOf("B"), NOT_SURE]);
  assert.deepEqual(missing[2].choices, [choiceOf("Yes"), NOT_SURE], "the model's Don’t know is the one Not sure");
  const uatA = storedDefinition(fixture("uat-a")).find((question) => question.questionKey === "q-8");
  assert.deepEqual(uatA?.choices, [choiceOf("Yes"), choiceOf("No"), NOT_SURE]);
});

test("Not sure equivalence is one closed list, insensitive to case, spacing, hyphens and apostrophes", () => {
  const equivalents = [
    "Not sure", "not sure", "  NOT   SURE  ", "Not sure.", "Unsure", "UNSURE", "Don't know", "Don’t know", "Don‘t Know", "dont know",
    "Do not know", "I don't know", "I don’t know", "I do not know", "I'm not sure", "I am not sure", "Unknown",
    "not-sure", "Not-Sure", "not_sure", "dont-know", "don't-know", "do-not-know", "i-dont-know", "i-do-not-know",
  ];
  for (const text of equivalents) {
    const wire = fixture("missing-not-sure");
    wire.questions[0].choices = ["Yes", text, "No"];
    assert.deepEqual(storedDefinition(wire)[0].choices, [choiceOf("Yes"), NOT_SURE, choiceOf("No")], text);
  }
  for (const text of ["Sure", "Not applicable", "Know", "Not sure yet", "Unsure about scope", "Partly"]) {
    const wire = fixture("missing-not-sure");
    wire.questions[0].choices = ["Yes", text];
    assert.deepEqual(storedDefinition(wire)[0].choices, [choiceOf("Yes"), choiceOf(text), NOT_SURE], text);
  }
});

/*
 * IN-205 (D-38): the wire fixtures go through the hosted provider and the fake server. Blank help text is stored as none,
 * and a choice question that offers no Not sure gains the canonical one.
 */
test("blank help text and a choice question without Not sure come through the hosted provider as none and the canonical Not sure", async () => {
  const server = await startFakeOpenAiCompatibleServer({ responses: ["blank-help-text", "missing-not-sure"].map((name) => ({ body: JSON.stringify(fixture(name)) })) });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const blank = await openaiCompatibleQuestionnaireGenerationProvider.generate(input);
    assert.deepEqual(blank.questions.map((question) => question.helpText === null), [true, false, false, false, false, false], "BLANK_HELP_TEXT_NOT_STORED_AS_NONE");
    const missing = validatedGenerationQuestions(await openaiCompatibleQuestionnaireGenerationProvider.generate(input));
    assert.deepEqual(missing.slice(0, 3).map((question) => question.choices), [
      [choiceOf("Yes"), choiceOf("No"), NOT_SURE], [choiceOf("A"), choiceOf("B"), NOT_SURE], [choiceOf("Yes"), NOT_SURE],
    ], "NOT_SURE_NOT_ADDED_THROUGH_THE_HOSTED_PROVIDER");
  } finally { globalThis.strapi = original; await server.close(); }
});

/*
 * IN-205 and IN-206 (D-16): each refused wire body is refused for its own named defect: the provider's diagnostic (in
 * development, with the transcript flag on) names the wire shape, and the same body with only that defect repaired is
 * accepted. The repairs hold the bounds at their accepted edges: 6 and 20 questions, and 2,000 characters of help text.
 */
test("each refused questionnaire wire body is refused for its named defect, and its repair is accepted at the edge", async () => {
  const choice = fixture("boolean"); choice.questions[0] = { ...choice.questions[0], answerType: "Single select", choices: ["Yes", "No"] };
  const six = fixture("five-questions"); six.questions.push({ ...six.questions[0], questionText: "Who approves changes to this service?" });
  const twenty = fixture("twenty-one-questions"); twenty.questions.pop();
  const longHelp = fixture("uat-a"); longHelp.questions[0].helpText = "x".repeat(2001);
  const helpAtTheBound = fixture("uat-a"); helpAtTheBound.questions[0].helpText = "x".repeat(2000);
  const cases = [
    { name: "a Boolean question", refused: fixture("boolean"), repaired: choice, questions: 6 },
    { name: "five questions", refused: fixture("five-questions"), repaired: six, questions: 6 },
    { name: "twenty-one questions", refused: fixture("twenty-one-questions"), repaired: twenty, questions: 20 },
    { name: "help text over 2,000 characters", refused: longHelp, repaired: helpAtTheBound, questions: 8 },
  ];
  const server = await startFakeOpenAiCompatibleServer({ responses: cases.flatMap(({ refused, repaired }) => [refused, repaired]).map((body) => ({ body: JSON.stringify(body) })) });
  const original = globalThis.strapi;
  const logs: string[] = [];
  try {
    await withRuntimeEnvironment("development", "development", async () => {
      setConfig(server.baseURL, { diagnostics: true, logs });
      for (const item of cases) {
        logs.length = 0;
        await assert.rejects(() => openaiCompatibleQuestionnaireGenerationProvider.generate(input), (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && error.code === "PROVIDER_OUTPUT_INVALID", `${item.name} was accepted`);
        const failure = logs.map((entry) => JSON.parse(entry) as Record<string, unknown>).find((entry) => entry.event === "csrm.ai.completion.failure");
        assert.deepEqual([failure?.stage, failure?.reason], ["questionnaire_validation", "questionnaire_wire_shape_invalid"], `${item.name}: REFUSED_FOR_ANOTHER_REASON`);
        const accepted = await openaiCompatibleQuestionnaireGenerationProvider.generate(input);
        assert.equal(accepted.questions.length, item.questions, `${item.name}: THE_REPAIRED_BODY_WAS_NOT_ACCEPTED`);
      }
    });
  } finally { globalThis.strapi = original; await server.close(); }
});

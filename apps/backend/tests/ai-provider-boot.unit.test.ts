import assert from "node:assert/strict";
import test from "node:test";

import { assertCsrmAiConfiguration, CsrmAiConfigurationError } from "../src/csrm/ai-config-validation";

const completeConfig = {
  provider: "openai-compatible",
  assessmentDraft: { baseURL: "http://127.0.0.1:1/v1", apiKey: "", model: "assessment-model" },
  questionnaireGeneration: { baseURL: "http://127.0.0.1:1/v1", apiKey: "", model: "questionnaire-model" },
};

function validate(config: unknown): void {
  assertCsrmAiConfiguration({ config: { get: (key: string) => key === "ai" ? config : undefined } });
}

test("AI configuration validation skips deterministic and unrecognised providers", () => {
  assert.doesNotThrow(() => validate({ provider: "deterministic" }));
  assert.doesNotThrow(() => validate({}));
  assert.doesNotThrow(() => validate({ provider: "other" }));
});

test("AI configuration validation accepts complete and keyless compatible configuration without a network request", () => {
  assert.doesNotThrow(() => validate(completeConfig));
});

for (const [branch, key, environmentVariable] of [
  ["assessmentDraft", "baseURL", "CSRM_AI_ASSESSMENT_BASE_URL"],
  ["assessmentDraft", "model", "CSRM_AI_ASSESSMENT_MODEL"],
  ["questionnaireGeneration", "baseURL", "CSRM_AI_QUESTIONNAIRE_BASE_URL"],
  ["questionnaireGeneration", "model", "CSRM_AI_QUESTIONNAIRE_MODEL"],
] as const) {
  test(`AI configuration validation names ${environmentVariable} when missing`, () => {
    const config = structuredClone(completeConfig);
    config[branch][key] = "";
    assert.throws(() => validate(config), (error: unknown) => error instanceof CsrmAiConfigurationError && error.message.includes(environmentVariable));
  });
}

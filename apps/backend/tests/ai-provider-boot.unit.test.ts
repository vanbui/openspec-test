import assert from "node:assert/strict";
import test from "node:test";

import { assertCsrmAiConfiguration, CsrmAiConfigurationError } from "../src/csrm/ai-config-validation";
import type { CsrmAiProviderMode } from "../src/csrm/ai-provider-selection";

/*
 * WR-202 (D-31; the 12-05 deletion restored): the provider is chosen once, from CSRM_AI_PROVIDER, when its module loads.
 * Unset, empty or anything but the exact hosted value keeps the deterministic provider, so no unexpected or misspelt
 * setting sends a request's data to a hosted model.
 */
test("provider selection keeps the deterministic provider unless CSRM_AI_PROVIDER is exactly openai-compatible", () => {
  const selectionPath = require.resolve("../src/csrm/ai-provider-selection");
  const loaded = require.cache[selectionPath];
  const prior = process.env.CSRM_AI_PROVIDER;
  const modeFor = (value: string | undefined): CsrmAiProviderMode => {
    if (value === undefined) delete process.env.CSRM_AI_PROVIDER;
    else process.env.CSRM_AI_PROVIDER = value;
    delete require.cache[selectionPath];
    return (require(selectionPath) as { CSRM_AI_PROVIDER_MODE: CsrmAiProviderMode }).CSRM_AI_PROVIDER_MODE;
  };
  try {
    for (const value of [undefined, "", "deterministic", "anything-else", "openai", "OpenAI-Compatible", " openai-compatible", "openai-compatible "]) {
      assert.equal(modeFor(value), "deterministic", `CSRM_AI_PROVIDER=${JSON.stringify(value)}_SELECTED_THE_HOSTED_PROVIDER`);
    }
    assert.equal(modeFor("openai-compatible"), "openai-compatible", "THE_EXACT_HOSTED_VALUE_DID_NOT_SELECT_IT");
  } finally {
    if (prior === undefined) delete process.env.CSRM_AI_PROVIDER;
    else process.env.CSRM_AI_PROVIDER = prior;
    if (loaded) require.cache[selectionPath] = loaded;
    else delete require.cache[selectionPath];
  }
});

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

test("AI configuration validation checks the ceiling for every provider", () => {
  assert.throws(() => validate({ provider: "deterministic", dataClassificationCeiling: "Secret" }), (error: unknown) => error instanceof CsrmAiConfigurationError && error.message.includes("CSRM_AI_DATA_CLASSIFICATION_CEILING") && ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"].every((label) => error.message.includes(label)));
  assert.doesNotThrow(() => validate({ provider: "deterministic", dataClassificationCeiling: "Internal" }));
});

test("AI configuration warns when transcript diagnostics are set outside development", () => {
  const priorNode = process.env.NODE_ENV;
  const priorCsrm = process.env.CSRM_ENVIRONMENT;
  try {
    const warnings: string[] = [];
    process.env.NODE_ENV = "test";
    process.env.CSRM_ENVIRONMENT = "production";
    assertCsrmAiConfiguration({ config: { get: () => ({ provider: "deterministic", completionTranscriptDiagnostics: true, dataClassificationCeiling: "Internal" }) }, log: { warn: (message) => warnings.push(message) } });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS/);
    warnings.length = 0;
    process.env.NODE_ENV = "development";
    process.env.CSRM_ENVIRONMENT = "development";
    assertCsrmAiConfiguration({ config: { get: () => ({ provider: "deterministic", completionTranscriptDiagnostics: true }) }, log: { warn: (message) => warnings.push(message) } });
    assert.deepEqual(warnings, []);
  } finally {
    if (priorNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNode;
    if (priorCsrm === undefined) delete process.env.CSRM_ENVIRONMENT; else process.env.CSRM_ENVIRONMENT = priorCsrm;
  }
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

import assert from "node:assert/strict";
import test from "node:test";

import { DATA_CLASSIFICATIONS, AiDataPolicyConfigurationError, evaluateAiDataPolicy, isDataClassification, isDevelopmentRuntime, parseClassificationCeiling, readAiDataPolicyConfiguration, requestClassification } from "../src/csrm/ai/data-policy";
import { RUNTIMES_OUTSIDE_DEVELOPMENT, withRuntimeEnvironment } from "./helpers/runtime-environment";

test("classification comes from the highest known asset or the Internal default", () => {
  assert.deepEqual(requestClassification([]), { level: "Internal", source: "default" });
  assert.deepEqual(requestClassification([{ dataClassification: "Public" }, { dataClassification: "Restricted" }, { dataClassification: null }]), { level: "Restricted", source: "assets" });
  assert.deepEqual(requestClassification([{ dataClassification: "Secret" }]), { level: "Internal", source: "default" });
  assert.equal(isDataClassification("Secret"), false);
});

test("policy grid covers both runtimes, every ceiling, and every classification", () => {
  const assets = [null, ...DATA_CLASSIFICATIONS].map((classification) => classification === null ? [] : [{ dataClassification: classification }]);
  for (const developmentRuntime of [false, true]) {
    for (const ceiling of [null, ...DATA_CLASSIFICATIONS]) {
      for (const candidates of assets) {
        const classification = requestClassification(candidates);
        const decision = evaluateAiDataPolicy({ assets: candidates, ceiling, developmentRuntime });
        const above = ceiling !== null && DATA_CLASSIFICATIONS.indexOf(classification.level) > DATA_CLASSIFICATIONS.indexOf(ceiling);
        const reason = ceiling === null && !developmentRuntime ? "AI_POLICY_NOT_CONFIGURED" : above ? "AI_CLASSIFICATION_ABOVE_CEILING" : null;
        assert.deepEqual(decision, { status: reason ? "refused" : "allowed", reason, requestClassification: classification.level, classificationSource: classification.source, ceiling }, `${developmentRuntime}/${ceiling}/${classification.level}/${classification.source}`);
      }
    }
  }
});

/*
 * IN-201 (D-26, D-27): named cases written out, rather than recomputed from the vocabulary and the rule under test, so a
 * reordered classification scale or a changed rule fails here.
 */
test("the policy decides named cases by a literal table", () => {
  assert.deepEqual(DATA_CLASSIFICATIONS, ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"], "CLASSIFICATION_SCALE_CHANGED");
  // Development runtime, ceiling, the request's highest asset classification (null: none, so the Internal default), then the decision.
  const cases: Array<[boolean, string | null, string | null, "allowed" | "refused", string | null]> = [
    [false, null, "Public", "refused", "AI_POLICY_NOT_CONFIGURED"],
    [false, null, null, "refused", "AI_POLICY_NOT_CONFIGURED"],
    [true, null, "Critical Infrastructure Sensitive", "allowed", null],
    [false, "Public", null, "refused", "AI_CLASSIFICATION_ABOVE_CEILING"],
    [false, "Internal", null, "allowed", null],
    [false, "Internal", "Restricted", "refused", "AI_CLASSIFICATION_ABOVE_CEILING"],
    [true, "Restricted", "Restricted", "allowed", null],
    [true, "Restricted", "Critical Infrastructure Sensitive", "refused", "AI_CLASSIFICATION_ABOVE_CEILING"],
    [false, "Critical Infrastructure Sensitive", "Critical Infrastructure Sensitive", "allowed", null],
  ];
  for (const [developmentRuntime, ceiling, classification, status, reason] of cases) {
    const decision = evaluateAiDataPolicy({ assets: classification ? [{ dataClassification: classification }] : [], ceiling: ceiling as (typeof DATA_CLASSIFICATIONS)[number] | null, developmentRuntime });
    assert.deepEqual(decision, { status, reason, requestClassification: classification ?? "Internal", classificationSource: classification ? "assets" : "default", ceiling }, JSON.stringify([developmentRuntime, ceiling, classification]));
  }
});

test("ceiling parser is closed and development needs both flags", () => {
  assert.equal(parseClassificationCeiling(""), null);
  assert.equal(parseClassificationCeiling(undefined), null);
  assert.equal(parseClassificationCeiling("Restricted"), "Restricted");
  for (const invalid of ["restricted", "Secret"]) assert.throws(() => parseClassificationCeiling(invalid), AiDataPolicyConfigurationError);
  assert.equal(isDevelopmentRuntime({ NODE_ENV: "development", CSRM_ENVIRONMENT: "development" }), true);
  assert.equal(isDevelopmentRuntime({ NODE_ENV: "development" }), false);
  assert.equal(isDevelopmentRuntime({ CSRM_ENVIRONMENT: "development" }), false);
  assert.deepEqual(readAiDataPolicyConfiguration({ config: { get: () => ({ dataClassificationCeiling: "Internal" }) } }, { NODE_ENV: "development", CSRM_ENVIRONMENT: "development" }), { ceiling: "Internal", developmentRuntime: true });
  // WR-201: Strapi defaults NODE_ENV to development, so a production CSRM_ENVIRONMENT alone is not the development runtime.
  assert.equal(isDevelopmentRuntime({ NODE_ENV: "development", CSRM_ENVIRONMENT: "production" }), false);
  assert.equal(isDevelopmentRuntime({ NODE_ENV: "production", CSRM_ENVIRONMENT: "development" }), false);
  assert.deepEqual(readAiDataPolicyConfiguration({ config: { get: () => ({ dataClassificationCeiling: "" }) } }, { NODE_ENV: "development", CSRM_ENVIRONMENT: "production" }), { ceiling: null, developmentRuntime: false });
});

/*
 * WR-201 (D-26, D-27): the policy's configuration reads the process environment when the call gives none, as every route
 * and job does. Outside the development runtime an empty ceiling approves no classification (AI_POLICY_NOT_CONFIGURED);
 * only NODE_ENV and CSRM_ENVIRONMENT both development make it allow.
 */
test("an empty ceiling refuses with AI_POLICY_NOT_CONFIGURED in every runtime the process environment makes production", async () => {
  const noCeiling = { config: { get: () => ({ dataClassificationCeiling: "" }) } };
  for (const [nodeEnv, csrmEnvironment] of RUNTIMES_OUTSIDE_DEVELOPMENT) {
    await withRuntimeEnvironment(nodeEnv, csrmEnvironment, () => {
      const configuration = readAiDataPolicyConfiguration(noCeiling);
      assert.deepEqual(configuration, { ceiling: null, developmentRuntime: false }, `NODE_ENV ${nodeEnv}, CSRM_ENVIRONMENT ${csrmEnvironment}`);
      assert.deepEqual(evaluateAiDataPolicy({ assets: [{ dataClassification: "Public" }], ...configuration }), {
        status: "refused", reason: "AI_POLICY_NOT_CONFIGURED", requestClassification: "Public", classificationSource: "assets", ceiling: null,
      });
    });
  }
  await withRuntimeEnvironment("development", "development", () => {
    assert.deepEqual(readAiDataPolicyConfiguration(noCeiling), { ceiling: null, developmentRuntime: true });
  });
});

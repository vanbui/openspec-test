import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { openaiCompatibleAssessmentDraftProvider } from "../src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider";
import { AssessmentDraftJobFailure } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";

const context = {
  answers: [{ questionKey: "hosting-model", value: "cloud" }],
  riskTypes: [
    { name: "Beta risk", applicableControls: [{ controlNumber: "CTL-2" }, { controlNumber: "CTL-1" }] },
    { name: "Alpha risk", applicableControls: [{ controlNumber: "CTL-3" }] },
  ],
};
const risk = (riskTypeName: string, suggestedControlNumbers: string[]) => ({
  riskTypeName, issueStatement: "Issue", riskStatement: "Risk statement", riskCategory: "Cyber", riskSubCategory: "Exposure", riskCause: "Cause", potentialImpact: "Impact",
  inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High", inherentRatingRationale: "Rationale",
  residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate", residualRatingRationale: "Residual rationale",
  treatmentAction: "Treat", treatmentPlan: "Treatment plan", suggestedControlNumbers,
});
const validProposal = JSON.stringify({ schemaVersion: 1, summary: "Summary", overallRating: "High", overallRiskRationale: "Overall rationale", recommendationsSummary: "Recommendations", risks: [risk("Beta risk", ["CTL-2", "CTL-1"]), risk("Alpha risk", ["CTL-3"])] });

function setConfig(baseURL: string): void {
  globalThis.strapi = { config: { get: (key: string) => key === "ai" ? {
    providerLabel: "csrm-selfhosted", structuredOutputMode: true, requestTimeoutMs: 1_000, reasoningEffort: "",
    assessmentDraft: { baseURL, apiKey: "", model: "csrm-assessment-model", maxOutputTokens: 1024 },
    questionnaireGeneration: { baseURL: "http://127.0.0.1:1/v1", apiKey: "", model: "unreachable", maxOutputTokens: 1024 },
  } : undefined } } as never;
}

test("assessment provider uses assessment configuration, constrains vocabularies, and orders output", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: validProposal } });
  const originalStrapi = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleAssessmentDraftProvider.generate(context);
    assert.deepEqual(result.risks.map(({ riskTypeName }) => riskTypeName), ["Alpha risk", "Beta risk"]);
    assert.deepEqual(result.risks[1]?.suggestedControlNumbers, ["CTL-1", "CTL-2"]);
    assert.equal(openaiCompatibleAssessmentDraftProvider.name, "csrm-selfhosted");
    assert.equal(openaiCompatibleAssessmentDraftProvider.version, "csrm-assessment-model");
    assert.equal(server.requests.length, 1);
    const request = server.requests[0]?.body as Record<string, any>;
    const schema = request.response_format.json_schema.schema;
    assert.deepEqual(schema.properties.risks.items.properties.riskTypeName.enum, ["Beta risk", "Alpha risk"]);
    assert.deepEqual(schema.properties.risks.items.properties.suggestedControlNumbers.items.enum, ["CTL-2", "CTL-1", "CTL-3"]);
    assert.equal(schema.properties.schemaVersion.type, "integer");
    assert.equal(schema.properties.overallRating.type, "string");
    assert.equal(schema.properties.risks.items.properties.treatmentAction.type, "string");
    assert.match(request.messages[0].content, /untrusted data/);
  } finally {
    globalThis.strapi = originalStrapi;
    await server.close();
  }
});

test("assessment provider rejects an extra output key with the typed failure", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify({ ...JSON.parse(validProposal), unexpected: true }) } });
  const originalStrapi = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    await assert.rejects(() => openaiCompatibleAssessmentDraftProvider.generate(context), (error: unknown) =>
      error instanceof AssessmentDraftJobFailure && error.code === "PROVIDER_OUTPUT_INVALID" && !error.safeMessage.includes("127.0.0.1") && !error.safeMessage.includes("csrm-assessment-model") && !error.safeMessage.includes("Error:"));
  } finally {
    globalThis.strapi = originalStrapi;
    await server.close();
  }
});

test("assessment provenance schema attributes are optional strings", () => {
  const attributes = JSON.parse(readFileSync("src/api/csrm-assessment/content-types/csrm-assessment/schema.json", "utf8")).attributes as Record<string, { type?: string; required?: boolean }>;
  for (const key of ["providerName", "providerVersion"]) assert.deepEqual(attributes[key], { type: "string" });
});

test("assessment provider orders mixed-case Risk Type names the way the parser checks them", async () => {
  const mixedCase = { answers: context.answers, riskTypes: [{ name: "alpha risk", applicableControls: [{ controlNumber: "CTL-1" }] }, { name: "Beta risk", applicableControls: [{ controlNumber: "CTL-2" }] }] };
  const body = JSON.stringify({ ...JSON.parse(validProposal), risks: [risk("alpha risk", ["CTL-1"]), risk("Beta risk", ["CTL-2"])] });
  const server = await startFakeOpenAiCompatibleServer({ response: { body } });
  const originalStrapi = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleAssessmentDraftProvider.generate(mixedCase);
    assert.deepEqual(result.risks.map(({ riskTypeName }) => riskTypeName), ["Beta risk", "alpha risk"]);
  } finally {
    globalThis.strapi = originalStrapi;
    await server.close();
  }
});

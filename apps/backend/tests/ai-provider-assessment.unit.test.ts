import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { openaiCompatibleAssessmentDraftProvider } from "../src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider";
import { AssessmentDraftJobFailure } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import {
  compareRiskTypeNames,
  parseAssessmentDraftProposal,
  sortRiskProposals,
} from "../src/api/csrm-assessment/services/assessment-draft-provider";
import { deterministicAssessmentDraftProvider } from "../src/api/csrm-assessment/services/deterministic-assessment-draft-provider";
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

/*
 * D-09 (Phase 8): the parser, the deterministic provider and the adapter share
 * one Risk Type ordering rule, UTF-16 code-unit order, in which every uppercase
 * letter sorts before every lowercase one. A locale-aware sort puts "alpha risk"
 * first instead, and that is the order the parser has always refused, so a
 * mixed-case Risk Type set used to make the deterministic draft fail its own
 * parser.
 */
const MIXED_CASE_NAMES = ["alpha risk", "Beta risk", "Gamma"] as const;
const CODE_UNIT_ORDER = ["Beta risk", "Gamma", "alpha risk"];
const LOCALE_ORDER = ["alpha risk", "Beta risk", "Gamma"];

function proposalWithRisks(risks: ReadonlyArray<ReturnType<typeof risk>>): Record<string, unknown> {
  return { ...JSON.parse(validProposal), risks };
}

test("compareRiskTypeNames orders Risk Type names by UTF-16 code unit", () => {
  assert.ok(compareRiskTypeNames("Beta risk", "alpha risk") < 0, "UPPERCASE_DID_NOT_SORT_BEFORE_LOWERCASE");
  assert.ok(compareRiskTypeNames("Gamma", "Beta risk") > 0, "LATER_NAME_DID_NOT_SORT_AFTER");
  assert.equal(compareRiskTypeNames("Gamma", "Gamma"), 0, "EQUAL_NAMES_DID_NOT_COMPARE_EQUAL");
});

test("sortRiskProposals returns a copy in code-unit order and leaves its input alone", () => {
  const input = MIXED_CASE_NAMES.map((name) => risk(name, ["CTL-1"]));
  const sorted = sortRiskProposals(input);
  assert.deepEqual(sorted.map(({ riskTypeName }) => riskTypeName), CODE_UNIT_ORDER, "SHARED_SORT_IS_NOT_CODE_UNIT_ORDER");
  assert.deepEqual(input.map(({ riskTypeName }) => riskTypeName), [...MIXED_CASE_NAMES], "SHARED_SORT_MUTATED_ITS_INPUT");
  assert.notEqual(sorted, input, "SHARED_SORT_RETURNED_ITS_INPUT");
});

test("the parser accepts mixed-case Risk Types in the shared order and refuses the locale order", () => {
  // The rejected order is exactly what a locale-aware sort produces.
  assert.deepEqual([...MIXED_CASE_NAMES].sort((left, right) => left.localeCompare(right, "en")), LOCALE_ORDER, "LOCALE_ORDER_PREMISE_CHANGED");

  const accepted = parseAssessmentDraftProposal(proposalWithRisks(sortRiskProposals(MIXED_CASE_NAMES.map((name) => risk(name, ["CTL-1"])))));
  assert.deepEqual(accepted.risks.map(({ riskTypeName }) => riskTypeName), CODE_UNIT_ORDER, "PARSER_REFUSED_THE_SHARED_ORDER");

  assert.throws(
    () => parseAssessmentDraftProposal(proposalWithRisks(LOCALE_ORDER.map((name) => risk(name, ["CTL-1"])))),
    /^Error: CSRM assessment draft proposal is invalid\.$/,
    "PARSER_ACCEPTED_THE_LOCALE_ORDER",
  );
});

test("the deterministic provider emits its Risk Types in the shared order and passes its own parser", async () => {
  const result = await deterministicAssessmentDraftProvider.generate({
    answers: [
      { questionKey: "hosting-model", value: "third-party" },
      { questionKey: "handles-personal-data", value: true },
    ],
    riskTypes: [
      { name: "Third-Party Dependency", applicableControls: [{ controlNumber: "CTL-3" }] },
      { name: "Internet Exposure", applicableControls: [{ controlNumber: "CTL-1" }] },
      { name: "Personal Information Handling", applicableControls: [{ controlNumber: "CTL-2" }] },
    ],
  });
  const names = result.risks.map(({ riskTypeName }) => riskTypeName);
  assert.deepEqual(names, ["Internet Exposure", "Personal Information Handling", "Third-Party Dependency"], "DETERMINISTIC_RISK_SET_CHANGED");
  assert.deepEqual(sortRiskProposals(result.risks).map(({ riskTypeName }) => riskTypeName), names, "DETERMINISTIC_ORDER_IS_NOT_THE_SHARED_ORDER");
  assert.deepEqual(parseAssessmentDraftProposal(result), result, "DETERMINISTIC_DRAFT_FAILED_ITS_OWN_PARSER");
});

/*
 * The deterministic provider accepts only its three fixed Risk Type names, so no
 * input can show it sorting mixed-case names. The shared rule is proven for it
 * here instead: it may not sort by locale or keep a comparator of its own, and
 * nor may the adapter.
 */
test("neither provider keeps a Risk Type ordering rule of its own", () => {
  const deterministic = readFileSync("src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts", "utf8");
  const adapter = readFileSync("src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts", "utf8");
  assert.doesNotMatch(deterministic, /localeCompare/, "DETERMINISTIC_PROVIDER_SORTS_BY_LOCALE");
  assert.match(deterministic, /sortRiskProposals\(/, "DETERMINISTIC_PROVIDER_BYPASSES_THE_SHARED_SORT");
  assert.doesNotMatch(adapter, /compareCodeUnits|localeCompare/, "ADAPTER_KEEPS_A_PRIVATE_COMPARATOR");
  assert.match(adapter, /compareRiskTypeNames\(/, "ADAPTER_BYPASSES_THE_SHARED_COMPARATOR");
});

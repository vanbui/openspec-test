import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildAssessmentContext } from "../src/csrm/ai/assessment-context";
import { deriveRating } from "../src/csrm/risk-scale";
import { ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, openaiCompatibleAssessmentDraftProvider, assessmentDraftWireSchema, toAssessmentDraftProposal } from "../src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider";
import { compareRiskTypeNames, parseAssessmentDraftProposal, sortRiskProposals, STATEMENT_FIELDS } from "../src/api/csrm-assessment/services/assessment-draft-provider";
import { deterministicAssessmentDraftProvider } from "../src/api/csrm-assessment/services/deterministic-assessment-draft-provider";
import { AssessmentDraftJobFailure } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";
import { RUNTIMES_OUTSIDE_DEVELOPMENT, withRuntimeEnvironment } from "./helpers/runtime-environment";
import { walkWireSchema } from "./helpers/wire-schema-guard";
import { uatALikeRecords } from "./fixtures/uat-a-like-context";

const records = uatALikeRecords();
const context = buildAssessmentContext(records, { operation: "assessment-draft" });
const fixture = (name: string): unknown => JSON.parse(readFileSync(path.resolve(process.cwd(), "tests", "fixtures", "ai-wire", `assessment-v2-${name}.json`), "utf8"));
/* `diagnostics` is CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS; `logs` receives every line the provider writes to Strapi's info log. */
function setConfig(baseURL: string, options: { diagnostics?: boolean; logs?: string[]; apiKey?: string } = {}): void {
  const logs = options.logs ?? [];
  globalThis.strapi = {
    config: { get: (key: string) => key === "ai" ? {
      providerLabel: "compatible", structuredOutputMode: true, requestTimeoutMs: 1_000, reasoningEffort: "", completionTranscriptDiagnostics: options.diagnostics ?? false,
      assessmentDraft: { baseURL, apiKey: options.apiKey ?? "", model: "draft", maxOutputTokens: 2048 },
      questionnaireGeneration: { baseURL: "http://127.0.0.1:1/v1", apiKey: "", model: "unused", maxOutputTokens: 1024 },
    } : undefined },
    log: { info: (entry: string) => logs.push(entry) },
  } as never;
}

/*
 * CR-201 (G-7, D-30): the draft's completion transcript holds the Requestor's data (the request and every answer) and the
 * model's answer, so the flag writes it to the log only when NODE_ENV and CSRM_ENVIRONMENT are both development: never
 * with the flag off, and never in any other runtime with the flag on. The transcript names neither the endpoint nor the key.
 */
test("the assessment provider logs its completion transcript only with the flag on in development", async () => {
  const body = JSON.stringify(fixture("uat-a"));
  const key = "transcript-test-key";
  const server = await startFakeOpenAiCompatibleServer({ responses: Array.from({ length: 2 + RUNTIMES_OUTSIDE_DEVELOPMENT.length }, () => ({ body })) });
  const original = globalThis.strapi;
  const logs: string[] = [];
  try {
    await withRuntimeEnvironment("development", "development", async () => {
      setConfig(server.baseURL, { diagnostics: false, logs, apiKey: key });
      await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
      assert.deepEqual(logs, [], "TRANSCRIPT_LOGGED_WITH_THE_FLAG_OFF");
      setConfig(server.baseURL, { diagnostics: true, logs, apiKey: key });
      await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    });
    const sent = server.requests[1].body as Record<string, any>;
    assert.deepEqual(logs.map((entry) => JSON.parse(entry)), [
      { event: "csrm.ai.completion.prompt", schemaName: "assessment_draft_proposal", systemPrompt: ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, userPrompt: context.userPrompt },
      { event: "csrm.ai.completion.response", schemaName: "assessment_draft_proposal", content: body, finishReason: "stop", refusal: null },
    ], "TRANSCRIPT_NOT_LOGGED_IN_DEVELOPMENT");
    assert.deepEqual([sent.messages[0].content, sent.messages[1].content], [ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, context.userPrompt], "the transcript is the prompt that was sent");
    assert.ok(!logs.some((entry) => entry.includes(server.baseURL) || entry.includes(key)), "TRANSCRIPT_NAMED_THE_ENDPOINT_OR_THE_KEY");
    for (const [nodeEnv, csrmEnvironment] of RUNTIMES_OUTSIDE_DEVELOPMENT) {
      logs.length = 0;
      await withRuntimeEnvironment(nodeEnv, csrmEnvironment, () => openaiCompatibleAssessmentDraftProvider.generate({ context, records }));
      assert.deepEqual(logs, [], `TRANSCRIPT_LOGGED_UNDER_NODE_ENV_${nodeEnv}_CSRM_ENVIRONMENT_${csrmEnvironment}`);
    }
    assert.equal(server.requests.length, 2 + RUNTIMES_OUTSIDE_DEVELOPMENT.length, "every case reached the provider");
  } finally { globalThis.strapi = original; await server.close(); }
});
test("wire adapter maps context keys, derives ratings, preserves repeated and absent types", () => {
  const proposal = toAssessmentDraftProposal(fixture("uat-a"), context);
  assert.deepEqual(proposal.risks.map((risk) => risk.riskTypeName), ["Personal Information Handling", "Personal Information Handling", null]);
  // IN-203 (success criterion 1): every risk links the request's own records, checked as literal ids rather than through the context's map.
  assert.deepEqual(proposal.risks.map((risk) => [risk.informationSystem, risk.informationAsset, risk.dataClassification]), [
    ["system-finance", "asset-pay", "Restricted"], ["system-hr", "asset-pay", "Restricted"], ["system-id", null, null],
  ], "A_RISK_LINKS_THE_WRONG_RECORD");
  assert.deepEqual(proposal.risks.map((risk) => risk.proposalKey), ["risk-1", "risk-2", "risk-3"]);
  assert.equal(proposal.risks[2].treatmentAction, "Accept");
  for (const risk of proposal.risks) assert.equal(risk.residualRating, deriveRating(risk.residualLikelihood as never, risk.highestResidualConsequence as never));
  assert.deepEqual(parseAssessmentDraftProposal(proposal, context.allowed), proposal);
  /*
   * WR-204 (success criterion 2, UAT-042): the payment-file and segregation answers, a system, an asset and the request are
   * cited, field by field, and the claim no source supports is listed as uncited; the adapter keeps every one of them.
   */
  assert.deepEqual(proposal.risks[0].sources, {
    issueStatement: ["answer.payment-files", "request.description"], riskStatement: ["answer.payment-files"], riskCause: ["answer.duties"],
    potentialImpact: ["asset-1"], inherentRatingRationale: ["system-1"], residualRatingRationale: ["answer.duties"], treatmentPlan: ["request.description"],
  }, "CITATIONS_DID_NOT_SURVIVE_THE_ADAPTER");
  const kindOf = new Map(context.sources.map(({ key, kind }) => [key, kind]));
  assert.deepEqual([...new Set(Object.values(proposal.risks[0].sources).flat())].map((key) => kindOf.get(key)).sort(), ["answer", "answer", "asset", "request", "system"], "THE_FIXTURE_CITES_EVERY_KIND_OF_SOURCE");
  assert.deepEqual(proposal.risks[0].uncitedClaims, ["The payroll processor re-keys bank details by hand before each pay run."], "UNCITED_CLAIM_DID_NOT_SURVIVE_THE_ADAPTER");
  assert.deepEqual(proposal.summarySources, ["request.description", "answer.payment-files"], "SUMMARY_CITATIONS_DID_NOT_SURVIVE_THE_ADAPTER");
  assert.deepEqual(proposal.risks.map((risk) => risk.adjustments), [[], [], []], "A_CITATION_WAS_DROPPED");
});
/* IN-205 (D-38): the adjustment fixtures go through the hosted provider and the fake server, as a model's answer does. */
test("the hosted provider records Accept, source and suggestion adjustments", async () => {
  const server = await startFakeOpenAiCompatibleServer({ responses: ["accept-on-high", "unknown-source", "unknown-control"].map((name) => ({ body: JSON.stringify(fixture(name)) })) });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const accept = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    assert.equal(accept.risks[0].treatmentAction, "Treat");
    assert.ok(accept.risks[0].adjustments.includes("accept-not-permitted"));
    assert.equal(accept.risks[1].treatmentAction, "Treat");
    assert.ok(accept.risks[1].adjustments.includes("accept-with-suggested-controls"));
    assert.equal(accept.risks[2].treatmentAction, "Accept");
    assert.ok(accept.risks[2].adjustments.includes("suggestions-dropped"));
    const source = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    assert.deepEqual(source.risks[0].sources.issueStatement, []);
    assert.ok(source.risks[0].adjustments.includes("sources-dropped"));
    const controls = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    assert.deepEqual(controls.risks[0].suggestedControls.map((item) => item.controlNumber), ["CTRL-001", "CTRL-002", "CTRL-003", "CTRL-004", "CTRL-005"]);
    assert.ok(controls.risks[0].adjustments.includes("suggestions-dropped"));
    assert.ok(controls.risks[0].adjustments.includes("suggestions-capped"));
  } finally { globalThis.strapi = original; await server.close(); }
});
/*
 * WR-203 (D-11): an Accept the model gives no rationale for (its treatment plan blank) becomes Treat, with the adjustment
 * recorded and a plan CSRM writes, citing nothing, for the analyst to replace; one bad treatment never fails the draft.
 * A Treat with no plan is still refused.
 */
test("an Accept with no rationale becomes Treat with its adjustment, through the adapter", () => {
  const proposal = toAssessmentDraftProposal(fixture("accept-without-rationale"), context);
  assert.deepEqual(proposal.risks.map((risk) => risk.treatmentAction), ["Treat", "Treat", "Treat", "Treat"]);
  for (const risk of proposal.risks.slice(2)) {
    assert.ok(risk.adjustments.includes("accept-without-rationale"), "ACCEPT_WITHOUT_RATIONALE_NOT_RECORDED");
    assert.equal(risk.treatmentPlan, "The AI proposed Accept without giving a reason, so Treat is proposed instead. Replace this with the plan to treat this risk.");
    assert.deepEqual(risk.sources.treatmentPlan, [], "CSRM's plan cites no source");
  }
  assert.deepEqual(parseAssessmentDraftProposal(proposal, context.allowed), proposal);
  const treat = fixture("accept-without-rationale") as Record<string, any>;
  treat.risks[0].treatmentPlan = " ";
  assert.throws(() => toAssessmentDraftProposal(treat, context), "a Treat with no plan is still refused");
});

/*
 * WR-107 (D-06, D-14): the instructions state every bound the adapter enforces by failing the whole draft. A sixth
 * uncited claim is capped as a sixth suggestion is (the first five kept, `uncited-claims-capped` recorded); a claim over
 * 300 characters is still refused, kept or not (06.7 D-10: no silent truncation).
 */
test("the draft instructions state every enforced bound, and a sixth uncited claim is capped through the hosted provider", async () => {
  const six = fixture("six-uncited-claims") as Record<string, any>;
  const tooLong = structuredClone(six); tooLong.risks[0].uncitedClaims[1] = "x".repeat(301);
  const tooLongBeyondTheCap = structuredClone(six); tooLongBeyondTheCap.risks[0].uncitedClaims[5] = "x".repeat(301);
  const server = await startFakeOpenAiCompatibleServer({ responses: [six, tooLong, tooLongBeyondTheCap].map((body) => ({ body: JSON.stringify(body) })) });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    assert.deepEqual(result.risks[0].uncitedClaims, six.risks[0].uncitedClaims.slice(0, 5), "SIXTH_CLAIM_NOT_CAPPED");
    assert.ok(result.risks[0].adjustments.includes("uncited-claims-capped"), "UNCITED_CLAIMS_CAP_NOT_RECORDED");
    assert.ok(!result.risks[1].adjustments.includes("uncited-claims-capped"));
    const instructions = (server.requests[0].body as Record<string, any>).messages[0].content as string;
    for (const bound of [/at most 50 risks/, /at most 2,000 characters/, /at most five uncited claims/, /at most 300 characters/, /at most five suggested controls/, /at most 500 characters/, /at most 100 source keys/]) {
      assert.match(instructions, bound, `INSTRUCTIONS_OMIT_${bound.source}`);
    }
    for (let index = 0; index < 2; index++) {
      await assert.rejects(() => openaiCompatibleAssessmentDraftProvider.generate({ context, records }), (error: unknown) =>
        error instanceof AssessmentDraftJobFailure && error.code === "PROVIDER_OUTPUT_INVALID");
    }
  } finally { globalThis.strapi = original; await server.close(); }
});

/*
 * Verifier W-1 (success criterion 1, D-13): the hosted model is asked to link each risk to the selected system, asset or
 * both that it concerns, by the supplied keys only, and to leave both links empty only when no selected system or asset
 * applies to the risk; the instruction is part of the system prompt the provider sends.
 */
test("the draft instructions ask the model to link each risk to the selected system or asset it concerns", async () => {
  const linkEachRisk = /Link each risk to the selected system, asset, or both that it concerns, using only the supplied system and asset keys/;
  const unlinkedOnlyWhenNoneApplies = /leave informationSystem and informationAsset both null only when no selected system or asset applies to that risk/;
  assert.match(ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, linkEachRisk, "INSTRUCTIONS_DO_NOT_ASK_TO_LINK_EACH_RISK");
  assert.match(ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, unlinkedOnlyWhenNoneApplies, "INSTRUCTIONS_DO_NOT_LIMIT_AN_UNLINKED_RISK");
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(fixture("uat-a")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    const sent = (server.requests[0].body as Record<string, any>).messages[0].content as string;
    assert.match(sent, linkEachRisk, "THE_SENT_INSTRUCTIONS_DO_NOT_ASK_TO_LINK_EACH_RISK");
    assert.match(sent, unlinkedOnlyWhenNoneApplies, "THE_SENT_INSTRUCTIONS_DO_NOT_LIMIT_AN_UNLINKED_RISK");
  } finally { globalThis.strapi = original; await server.close(); }
});

/*
 * WR-104 and WR-107: a Risk's category and sub-category are stored in 255-character fields, so the adapter and the closed
 * parser refuse a longer one as invalid provider output, before anything is saved, rather than the draft failing at the
 * save; the instructions state it.
 */
test("a risk category or sub-category over 255 characters is invalid output, as the instructions say", () => {
  for (const field of ["riskCategory", "riskSubCategory"]) {
    const over = fixture("uat-a") as Record<string, any>; over.risks[0][field] = "c".repeat(256);
    assert.throws(() => toAssessmentDraftProposal(over, context), /invalid/, `${field.toUpperCase()}_OVER_255_ACCEPTED`);
    const at = fixture("uat-a") as Record<string, any>; at.risks[0][field] = "c".repeat(255);
    const proposal = toAssessmentDraftProposal(at, context);
    assert.throws(() => parseAssessmentDraftProposal({ ...proposal, risks: proposal.risks.map((risk, index) => index === 0 ? { ...risk, [field]: "c".repeat(256) } : risk) }, context.allowed), /invalid/, `PARSER_${field.toUpperCase()}_OVER_255_ACCEPTED`);
  }
  assert.match(ASSESSMENT_DRAFT_SYSTEM_INSTRUCTIONS, /category and sub-category in at most 255 characters/);
});

/*
 * IN-205 (D-13, D-10): an unknown system key and a server-owned rating field are each refused through the hosted
 * provider as invalid output, and refused for that defect alone: the same body with only it repaired is accepted.
 */
test("the hosted provider refuses an unknown system key and a server-owned rating field, and accepts each body repaired", async () => {
  const unknownSystem = fixture("unknown-system") as Record<string, any>;
  const knownSystem = structuredClone(unknownSystem); knownSystem.risks[0].informationSystem = "system-1";
  const ratingField = fixture("rating-field") as Record<string, any>;
  const noRating = structuredClone(ratingField); delete noRating.risks[0].inherentRating;
  const server = await startFakeOpenAiCompatibleServer({ responses: [unknownSystem, knownSystem, ratingField, noRating].map((body) => ({ body: JSON.stringify(body) })) });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    for (const name of ["an unknown system key", "a server-owned rating field"]) {
      await assert.rejects(() => openaiCompatibleAssessmentDraftProvider.generate({ context, records }), (error: unknown) =>
        error instanceof AssessmentDraftJobFailure && error.code === "PROVIDER_OUTPUT_INVALID", `${name} was accepted`);
      const repaired = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
      assert.equal(repaired.risks.length, 3, `${name}: THE_REPAIRED_BODY_WAS_NOT_ACCEPTED`);
    }
  } finally { globalThis.strapi = original; await server.close(); }
});
test("portable wire schema contains only supported structure and excludes derived values", () => {
  const schema = assessmentDraftWireSchema(context);
  // IN-210 (D-06): the questionnaire's guard, so properties count over the whole schema rather than per object.
  const guard = walkWireSchema(schema);
  assert.deepEqual(guard.forbidden, [], "UNPORTABLE_KEYWORD");
  assert.ok(guard.properties <= 100, `THE_SCHEMA_HOLDS_${guard.properties}_PROPERTIES`);
  assert.ok(guard.depth <= 5, `THE_SCHEMA_NESTS_${guard.depth}_LEVELS`);
  // The guard counts in total: two objects of 60 properties each pass a per-object bound and fail this one.
  const sixty = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`field${index}`, { type: "string" }]));
  assert.equal(walkWireSchema({ type: "object", properties: { first: { type: "object", properties: sixty }, second: { type: "object", properties: sixty } } }).properties, 122);
  const risk = ((schema.properties as Record<string, any>).risks.items.properties) as Record<string, unknown>;
  for (const key of ["inherentRating", "residualRating", "overallRating", "dataClassification", "control"]) assert.equal(key in risk, false);
  assert.deepEqual((risk.riskTypeName as Record<string, unknown>).enum, [...Object.keys(context.allowed.riskTypes), null]);
});
/*
 * IN-106 (D-06): a strict structured-output validator may reject an empty enum, so with no control candidates (an empty
 * library) the wire schema names the control number as any string; the adapter drops a number that is not a candidate.
 */
test("the wire schema emits no empty control enum when there are no candidates", () => {
  const bare = uatALikeRecords();
  bare.controls = [];
  bare.riskTypes = bare.riskTypes.map((type) => ({ ...type, applicableControls: [] }));
  const empty = buildAssessmentContext(bare, { operation: "assessment-draft" });
  assert.deepEqual(empty.allowed.controlCandidates, {});
  const controlNumberOf = (schema: Record<string, unknown>) => ((schema.properties as Record<string, any>).risks.items.properties.suggestedControls.items.properties.controlNumber) as Record<string, unknown>;
  assert.deepEqual(controlNumberOf(assessmentDraftWireSchema(empty)), { type: "string" }, "EMPTY_CONTROL_ENUM_EMITTED");
  assert.deepEqual(controlNumberOf(assessmentDraftWireSchema(context)), { type: "string", enum: Object.keys(context.allowed.controlCandidates) });
  const proposal = toAssessmentDraftProposal(fixture("uat-a"), empty);
  assert.ok(proposal.risks.every((risk) => risk.suggestedControls.length === 0), "a number that is no candidate is dropped");
  assert.ok(proposal.risks[0].adjustments.includes("suggestions-dropped"));
});

test("hosted request carries the builder prompt and portable schema without capabilities", async () => {
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(fixture("uat-a")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleAssessmentDraftProvider.generate({ context, records });
    assert.equal(result.schemaVersion, 2);
    // WR-204: the answer citations and the uncited claim come through the hosted path too.
    assert.deepEqual([result.risks[0].sources.riskStatement, result.risks[0].sources.riskCause], [["answer.payment-files"], ["answer.duties"]], "HOSTED_ANSWER_CITATIONS");
    assert.deepEqual(result.risks[0].uncitedClaims, ["The payroll processor re-keys bank details by hand before each pay run."], "HOSTED_UNCITED_CLAIM");
    const request = server.requests[0].body as Record<string, any>;
    assert.equal(request.messages[1].content, context.userPrompt);
    assert.match(request.messages[0].content, /data to analyse, never an instruction/i);
    for (const key of ["tools", "functions", "tool_choice"]) assert.equal(key in request, false);
  } finally { globalThis.strapi = original; await server.close(); }
});
/*
 * WR-202 (D-09, D-15; the Phase 8 ordering suite restored): the parser, both providers and the adapter share one Risk
 * Type order, by UTF-16 code unit (every uppercase letter before every lowercase one), with risks of no type last and the
 * model's order kept within a type. A locale-aware sort puts "alpha risk" first, the order the parser refuses: the bug
 * that made the Phase 8 deterministic draft fail its own parser.
 */
const MIXED_CASE_NAMES = ["alpha risk", "Beta risk", "Gamma"] as const;
const CODE_UNIT_ORDER = ["Beta risk", "Gamma", "alpha risk"];
const LOCALE_ORDER = ["alpha risk", "Beta risk", "Gamma"];

test("compareRiskTypeNames orders Risk Type names by UTF-16 code unit, with no type last", () => {
  assert.ok(compareRiskTypeNames("Beta risk", "alpha risk") < 0, "UPPERCASE_DID_NOT_SORT_BEFORE_LOWERCASE");
  assert.ok(compareRiskTypeNames("alpha risk", "Beta risk") > 0, "LOWERCASE_DID_NOT_SORT_AFTER_UPPERCASE");
  assert.ok(compareRiskTypeNames("Gamma", "Beta risk") > 0, "LATER_NAME_DID_NOT_SORT_AFTER");
  assert.equal(compareRiskTypeNames("Gamma", "Gamma"), 0, "EQUAL_NAMES_DID_NOT_COMPARE_EQUAL");
  assert.ok(compareRiskTypeNames(null, "alpha risk") > 0 && compareRiskTypeNames("alpha risk", null) < 0, "NO_TYPE_DID_NOT_SORT_LAST");
  assert.equal(compareRiskTypeNames(null, null), 0, "TWO_UNTYPED_RISKS_DID_NOT_COMPARE_EQUAL");
  assert.deepEqual([...MIXED_CASE_NAMES].sort(compareRiskTypeNames), CODE_UNIT_ORDER, "SHARED_ORDER_IS_NOT_CODE_UNIT_ORDER");
});

test("sortRiskProposals returns a sorted copy, keeps the model's order within a type, and leaves its input alone", () => {
  const input = [
    { riskTypeName: null, key: "untyped" }, { riskTypeName: "alpha risk", key: "alpha" }, { riskTypeName: "Gamma", key: "gamma-first" },
    { riskTypeName: "Beta risk", key: "beta" }, { riskTypeName: "Gamma", key: "gamma-second" },
  ];
  const before = structuredClone(input);
  const sorted = sortRiskProposals(input);
  assert.deepEqual(sorted.map(({ key }) => key), ["beta", "gamma-first", "gamma-second", "alpha", "untyped"], "SHARED_SORT_IS_NOT_CODE_UNIT_ORDER");
  assert.deepEqual(input, before, "SHARED_SORT_MUTATED_ITS_INPUT");
  assert.notEqual(sorted, input, "SHARED_SORT_RETURNED_ITS_INPUT");
});

/* A wire risk of the given type that cites the request description, with no link and no suggestion. */
function plainWireRisk(riskTypeName: string | null, issueStatement: string): Record<string, unknown> {
  return {
    riskTypeName, issueStatement, riskStatement: "Risk statement", riskCategory: "Cyber", riskSubCategory: "Exposure", riskCause: "Cause", potentialImpact: "Impact",
    informationSystem: null, informationAsset: null, inherentLikelihood: "Possible", highestInherentConsequence: "Major", inherentRatingRationale: "Inherent rationale",
    residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRatingRationale: "Residual rationale", treatmentAction: "Treat", treatmentPlan: "Treatment plan",
    sources: Object.fromEntries(STATEMENT_FIELDS.map((field) => [field, ["request.description"]])), uncitedClaims: [], suggestedControls: [],
  };
}
function plainWireDraft(risks: Record<string, unknown>[]): Record<string, unknown> {
  return { schemaVersion: 2, summary: "Summary", summarySources: [], overallRiskRationale: "Rationale", overallRiskRationaleSources: [], recommendationsSummary: "Recommendations", recommendationsSummarySources: [], risks };
}

test("the parser accepts mixed-case Risk Types in the shared order and refuses the locale order", () => {
  // The refused order is exactly what a locale-aware sort produces.
  assert.deepEqual([...MIXED_CASE_NAMES].sort((left, right) => left.localeCompare(right, "en")), LOCALE_ORDER, "LOCALE_ORDER_PREMISE_CHANGED");
  const mixed = uatALikeRecords();
  mixed.riskTypes = MIXED_CASE_NAMES.map((name, index) => ({ documentId: `type-mixed-${index}`, name, description: `${name} description`, applicableControls: [] }));
  const mixedContext = buildAssessmentContext(mixed, { operation: "assessment-draft" });
  const accepted = toAssessmentDraftProposal(plainWireDraft(LOCALE_ORDER.map((name) => plainWireRisk(name, `${name} issue`))), mixedContext);
  assert.deepEqual(accepted.risks.map(({ riskTypeName }) => riskTypeName), CODE_UNIT_ORDER, "ADAPTER_DID_NOT_PUT_THE_SHARED_ORDER");
  assert.deepEqual(parseAssessmentDraftProposal(accepted, mixedContext.allowed), accepted, "PARSER_REFUSED_THE_SHARED_ORDER");
  const localeOrdered = LOCALE_ORDER.map((name) => accepted.risks.find((risk) => risk.riskTypeName === name)).map((risk, index) => ({ ...risk!, proposalKey: `risk-${index + 1}` }));
  assert.throws(() => parseAssessmentDraftProposal({ ...accepted, risks: localeOrdered }, mixedContext.allowed), /^Error: CSRM assessment draft proposal is invalid\.$/, "PARSER_ACCEPTED_THE_LOCALE_ORDER");
});

test("the deterministic provider emits its Risk Types in the shared order and passes its own parser", async () => {
  const withRecovery = uatALikeRecords();
  withRecovery.answers!.push({ questionKey: "recovery-tested", sectionTitle: "Resilience", questionText: "Has recovery been tested?", helpText: "", answerType: "Single select", value: "no", answerLabel: "No" });
  const recoveryContext = buildAssessmentContext(withRecovery, { operation: "assessment-draft" });
  const result = await deterministicAssessmentDraftProvider.generate({ context: recoveryContext, records: withRecovery });
  assert.deepEqual(result.risks.map(({ riskTypeName }) => riskTypeName), ["Internet Exposure", "Personal Information Handling", "Personal Information Handling", "Third-Party Dependency", null], "DETERMINISTIC_RISK_SET_CHANGED");
  assert.deepEqual(sortRiskProposals(result.risks), result.risks, "DETERMINISTIC_ORDER_IS_NOT_THE_SHARED_ORDER");
  assert.deepEqual(parseAssessmentDraftProposal(result, recoveryContext.allowed), result, "DETERMINISTIC_DRAFT_FAILED_ITS_OWN_PARSER");
});

/*
 * The deterministic provider emits only its three fixed, capitalised Risk Type names, so no input shows it sorting mixed
 * case; the shared rule is held for it, and for the adapter, here: neither sorts by locale or keeps a sort of its own.
 */
test("neither provider keeps a Risk Type ordering rule of its own", () => {
  for (const [name, file] of [["DETERMINISTIC_PROVIDER", "deterministic-assessment-draft-provider.ts"], ["ADAPTER", "openai-compatible-assessment-draft-provider.ts"]]) {
    const source = readFileSync(path.resolve(process.cwd(), "src", "api", "csrm-assessment", "services", file), "utf8");
    assert.doesNotMatch(source, /localeCompare|\.sort\(/, `${name}_SORTS_BY_A_RULE_OF_ITS_OWN`);
    assert.match(source, /sortRiskProposals\(/, `${name}_BYPASSES_THE_SHARED_SORT`);
  }
});

/*
 * WR-202 (D-09, D-15): a model may list its risks in any order, and the adapter puts them in the shared order before the
 * parser checks it. They arrive with no type first, then two Personal Information Handling risks in a distinctive model
 * order (Zeta before Alpha), then the mixed-case "iPayroll Interfaces", which a locale sort would put before them. Each
 * risk keeps its own links and suggestions, and the risks are keyed in their new order.
 */
test("the hosted provider puts risks that arrive out of order in the shared order and keeps the model's order within a type", async () => {
  const withMixedCase = uatALikeRecords();
  withMixedCase.riskTypes = [...withMixedCase.riskTypes, { documentId: "type-ipayroll", name: "iPayroll Interfaces", description: "Interfaces between payroll and the payment processor", applicableControls: withMixedCase.controls.slice(0, 1) }];
  const mixedContext = buildAssessmentContext(withMixedCase, { operation: "assessment-draft" });
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(fixture("out-of-order")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const result = await openaiCompatibleAssessmentDraftProvider.generate({ context: mixedContext, records: withMixedCase });
    assert.deepEqual(result.risks.map(({ riskTypeName, issueStatement }) => [riskTypeName, issueStatement]), [
      ["Personal Information Handling", "Zeta: bank details in the payment file can be read in transit."],
      ["Personal Information Handling", "Alpha: payroll staff can change bank details without a second approval."],
      ["iPayroll Interfaces", "The payroll interface accepts unsigned payment files."],
      [null, "The pay-run fallback has not been tested."],
    ], "ADAPTER_DID_NOT_PUT_THE_SHARED_ORDER_KEEPING_THE_MODEL_ORDER_WITHIN_A_TYPE");
    assert.deepEqual(result.risks.map(({ proposalKey }) => proposalKey), ["risk-1", "risk-2", "risk-3", "risk-4"]);
    assert.deepEqual(result.risks.map((risk) => [risk.informationSystem, risk.suggestedControls.map(({ controlNumber }) => controlNumber), risk.adjustments]), [
      ["system-hr", [], []], ["system-finance", ["CTRL-002"], []], ["system-hr", ["CTRL-001"], []], ["system-hr", ["CTRL-003"], []],
    ], "A_RISK_LOST_ITS_OWN_FACTS_IN_THE_SORT");
    assert.equal(result.overallRating, "High");
    const offered = ((server.requests[0].body as Record<string, any>).response_format.json_schema.schema.properties.risks.items.properties.riskTypeName.enum) as unknown[];
    assert.deepEqual(offered, ["Internet Exposure", "Payment Integrity", "Personal Information Handling", "Third-Party Dependency", "iPayroll Interfaces", null], "THE_SCHEMA_OFFERS_THE_TYPES_IN_ANOTHER_ORDER");
  } finally { globalThis.strapi = original; await server.close(); }
});

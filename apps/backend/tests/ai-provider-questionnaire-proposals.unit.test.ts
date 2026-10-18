import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { questionnaireProposalsWireSchema, questionRewriteWireSchema, toQuestionnaireProposal, toQuestionRewriteProposal } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-adapter";
import { deterministicQuestionnaireProposalProvider, deterministicQuestionRewriteProvider, PLAIN_LANGUAGE_GLOSSARY } from "../src/api/csrm-questionnaire/services/deterministic-questionnaire-proposal-provider";
import { openaiCompatibleQuestionnaireProposalProvider, openaiCompatibleQuestionRewriteProvider } from "../src/api/csrm-questionnaire/services/openai-compatible-questionnaire-proposal-provider";
import { activeQuestionnaireProposalProviders } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-provider";
import { startFakeOpenAiCompatibleServer } from "./helpers/fake-openai-compatible-server";
import { fixtureQuestion, OFFSHORE_NOTE, proposalFixture, rewriteFixture, type FixtureQuestion } from "./helpers/questionnaire-proposal-fixture";
import { walkWireSchema } from "./helpers/wire-schema-guard";

/*
 * Phase 15 D-13, D-15 and D-17 (QUES-11 criterion 1, QUES-12 criterion 2, success criterion 1; 15-RESEARCH Pitfall 9):
 * both providers return model-facing wire JSON and one adapter turns it into the questionnaire proposal envelope v1, so
 * every drop rule runs whichever provider answered. The hosted provider is only ever pointed at the local fake server.
 */

const wire = (name: string): Record<string, any> => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", `${name}.json`), "utf8"));

function setConfig(baseURL: string): void {
  globalThis.strapi = {
    config: { get: (key: string) => key === "ai" ? { providerLabel: "local-compatible", structuredOutputMode: true, requestTimeoutMs: 1000, reasoningEffort: "", completionTranscriptDiagnostics: false, questionnaireGeneration: { baseURL, apiKey: "", model: "questionnaire-test", maxOutputTokens: 1024 }, assessmentDraft: { baseURL: "", apiKey: "", model: "", maxOutputTokens: 1024 } } : undefined },
    log: { info: () => undefined },
  } as never;
}

const offshoreFixture = () => proposalFixture({ notes: [{ sequence: 1, body: OFFSHORE_NOTE }] });
const OFFSHORE_TEXTS = [
  "In which country or countries is the offshore support team based?",
  "Will the offshore support team have administrator access to your systems?",
  "How is the offshore team's administrator access approved and logged?",
];

test("the offshore wire fixture is model-facing: schema version 1 and no server-owned key", () => {
  const text = readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", "questionnaire-proposals-offshore.json"), "utf8");
  assert.match(text, /"schemaVersion": 1/);
  assert.doesNotMatch(text, /"key"/);
});

test("the hosted provider's offshore follow-ups pass through the adapter: three cited additions in a new section, the answered change and the near-duplicate left out", async () => {
  const fixture = offshoreFixture();
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(wire("questionnaire-proposals-offshore")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const raw = await openaiCompatibleQuestionnaireProposalProvider.propose(fixture.input);
    const proposal = toQuestionnaireProposal(raw, fixture.adapter);
    assert.equal(proposal.schemaVersion, 1);
    assert.equal(proposal.operation, "questionnaire-proposals");
    assert.equal(proposal.outcome, "items");
    assert.deepEqual(proposal.items.map((item) => item.key), ["i-1", "i-2", "i-3"]);
    assert.deepEqual(proposal.items.map((item) => item.kind), ["add", "add", "add"]);
    for (const item of proposal.items) {
      assert.equal(item.kind, "add");
      if (item.kind !== "add") continue;
      assert.deepEqual(item.proposed.section, { kind: "new", title: "Offshore support" });
      assert.deepEqual(item.sources, [{ kind: "note", ref: "note-1" }]);
      assert.equal(item.proposed.required, true);
      assert.ok(item.proposed.helpText, "HELP_TEXT_MISSING");
      assert.deepEqual(item.base.section, { kind: "new", title: "Offshore support" });
      assert.equal(item.base.controller, null);
    }
    assert.deepEqual(proposal.items.map((item) => (item.kind === "add" ? item.proposed.questionText : null)), OFFSHORE_TEXTS);
    const select = proposal.items[1];
    assert.ok(select.kind === "add");
    assert.equal(select.proposed.answerType, "Single select");
    assert.deepEqual(select.proposed.choices, [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "not-sure", label: "Not sure" }], "NOT_SURE_NOT_LAST");
    assert.deepEqual(proposal.adjustments.map((adjustment) => adjustment.code), ["answered-target", "near-duplicate"]);
    assert.deepEqual(proposal.adjustments.map((adjustment) => adjustment.wireIndex), [3, 4]);

    const request = server.requests[0]?.body as Record<string, any>;
    assert.equal(request.response_format.json_schema.name, "questionnaire_proposals");
    const schema = request.response_format.json_schema.schema;
    assert.deepEqual(schema, questionnaireProposalsWireSchema(fixture.adapter.allowed));
    const guard = walkWireSchema(schema);
    assert.deepEqual(guard.forbidden, []);
    assert.ok(guard.properties <= 100, `${guard.properties} object properties`);
    assert.ok(guard.depth <= 5, `${guard.depth} levels`);
    assert.equal(request.messages[1].content, fixture.context.userPrompt, "the user message is the built context");
    for (const key of ["tools", "functions", "tool_choice"]) assert.equal(key in request, false);
  } finally { globalThis.strapi = original; await server.close(); }
});

test("the deterministic provider returns wire JSON that the same adapter turns into the same offshore proposal", async () => {
  assert.equal(deterministicQuestionnaireProposalProvider.name, "deterministic-questionnaire-proposals");
  assert.equal(deterministicQuestionnaireProposalProvider.version, "1");
  const fixture = offshoreFixture();
  const raw = await deterministicQuestionnaireProposalProvider.propose(fixture.input) as Record<string, unknown>;
  assert.equal(raw.schemaVersion, 1, "THE_DETERMINISTIC_PROVIDER_SKIPPED_THE_WIRE");
  assert.equal("operation" in raw, false, "THE_DETERMINISTIC_PROVIDER_RETURNED_AN_ENVELOPE");
  const deterministic = toQuestionnaireProposal(raw, fixture.adapter);
  const hosted = toQuestionnaireProposal(wire("questionnaire-proposals-offshore"), fixture.adapter);
  assert.deepEqual(deterministic.items, hosted.items);
  assert.deepEqual(deterministic.adjustments.map((adjustment) => adjustment.code), ["answered-target", "near-duplicate"]);
});

/*
 * Phase 15 D-11 (success criterion 2; T-15-15): a plain-language rewrite can only change the question text, the help text
 * and the choice labels. The wire cannot carry anything else, labels map positionally onto the unchanged values, a label
 * count that differs from the target's is left out, and an unchanged result completes with no item.
 */
const MFA_QUESTION = "Is MFA enforced for privileged and federated identities, including break-glass accounts?";
const ACCESS = { key: "access", title: "Access control", order: 0 };
const rewriteQuestions = (): FixtureQuestion[] => [
  fixtureQuestion("mfa", MFA_QUESTION, { type: "Single select", choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], section: ACCESS, order: 0 }),
  fixtureQuestion("backup-tests", "How often are payroll backups tested?", { section: ACCESS, order: 1, required: false }),
];
const rewriteCase = (name: string): Record<string, unknown> => wire("question-rewrite-cases")[name];

test("the plain rewrite proposes one change of the wording only: answer type, choice values and required flag stay the target's", () => {
  const fixture = rewriteFixture("mfa", { questions: rewriteQuestions() });
  const proposal = toQuestionRewriteProposal(rewriteCase("plain"), fixture.adapter);
  assert.equal(proposal.operation, "question-rewrite");
  assert.equal(proposal.outcome, "items");
  assert.equal(proposal.items.length, 1);
  const [item] = proposal.items;
  assert.ok(item.kind === "change");
  assert.equal(item.key, "i-1");
  assert.equal(item.target.questionKey, "mfa");
  assert.notEqual(item.proposed.questionText, MFA_QUESTION);
  assert.match(item.proposed.helpText ?? "", /^[^.]+\.$/, "HELP_TEXT_IS_NOT_ONE_SENTENCE");
  assert.equal(item.proposed.answerType, "Single select");
  assert.equal(item.proposed.required, true);
  assert.deepEqual(item.proposed.choices.map((choice) => choice.value), ["yes", "no"]);
  assert.equal("section" in item.proposed, false);
  assert.equal("visibility" in item.proposed, false);
  assert.deepEqual(proposal.adjustments, []);
});

test("a label count that differs from the target's is left out as rewrite-out-of-scope; an unchanged result is no-change with no item", () => {
  const fixture = rewriteFixture("mfa", { questions: rewriteQuestions() });
  const mismatch = toQuestionRewriteProposal(rewriteCase("label-mismatch"), fixture.adapter);
  assert.equal(mismatch.outcome, "no-change");
  assert.deepEqual(mismatch.items, []);
  assert.deepEqual(mismatch.adjustments.map((adjustment) => adjustment.code), ["rewrite-out-of-scope"]);
  const same = toQuestionRewriteProposal(rewriteCase("unchanged"), fixture.adapter);
  assert.equal(same.outcome, "no-change");
  assert.deepEqual(same.items, []);
  assert.deepEqual(same.adjustments, []);
});

test("the deterministic rewrite applies the plain-language glossary, and leaves a question with no glossary term unchanged", async () => {
  assert.equal(deterministicQuestionRewriteProvider.name, "deterministic-question-rewrite");
  assert.equal(deterministicQuestionRewriteProvider.version, "1");
  assert.equal(PLAIN_LANGUAGE_GLOSSARY.length, 5);
  const mfa = rewriteFixture("mfa", { questions: rewriteQuestions() });
  const raw = await deterministicQuestionRewriteProvider.rewrite(mfa.input) as Record<string, unknown>;
  assert.equal(raw.schemaVersion, 1, "THE_DETERMINISTIC_REWRITE_SKIPPED_THE_WIRE");
  const proposal = toQuestionRewriteProposal(raw, mfa.adapter);
  const [item] = proposal.items;
  assert.ok(item?.kind === "change");
  assert.ok(item.proposed.questionText.includes("a second sign-in step (multi-factor authentication)"), item.proposed.questionText);
  assert.ok(!/\bMFA\b|privileged|break-glass/.test(item.proposed.questionText), item.proposed.questionText);
  assert.match(item.proposed.helpText ?? "", /multi-factor authentication/i);
  assert.deepEqual(item.proposed.choices, [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]);
  const plain = rewriteFixture("backup-tests", { questions: rewriteQuestions() });
  const unchanged = toQuestionRewriteProposal(await deterministicQuestionRewriteProvider.rewrite(plain.input), plain.adapter);
  assert.equal(unchanged.outcome, "no-change");
  assert.deepEqual(unchanged.items, []);
});

test("the hosted rewrite request uses the question_rewrite wire inside the portable subset", async () => {
  const fixture = rewriteFixture("mfa", { questions: rewriteQuestions() });
  const server = await startFakeOpenAiCompatibleServer({ response: { body: JSON.stringify(rewriteCase("plain")) } });
  const original = globalThis.strapi;
  try {
    setConfig(server.baseURL);
    const proposal = toQuestionRewriteProposal(await openaiCompatibleQuestionRewriteProvider.rewrite(fixture.input), fixture.adapter);
    assert.equal(proposal.items.length, 1);
    const request = server.requests[0]?.body as Record<string, any>;
    assert.equal(request.response_format.json_schema.name, "question_rewrite");
    const schema = request.response_format.json_schema.schema;
    assert.deepEqual(schema, questionRewriteWireSchema());
    const guard = walkWireSchema(schema);
    assert.deepEqual(guard.forbidden, []);
    assert.ok(guard.properties <= 100);
    assert.ok(guard.depth <= 5);
    assert.equal(request.messages[1].content, fixture.context.userPrompt);
  } finally { globalThis.strapi = original; await server.close(); }
});

test("rule W2: an instruction asking for plain language changes the first unanswered question the glossary would change", async () => {
  const questions = [
    fixtureQuestion("hosting", "Where is the payroll service hosted?", { order: 0 }),
    fixtureQuestion("mfa", MFA_QUESTION, { type: "Single select", choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], order: 1 }),
  ];
  const fixture = proposalFixture({ questions, instruction: "Put the access questions in plain language" });
  const proposal = toQuestionnaireProposal(await deterministicQuestionnaireProposalProvider.propose(fixture.input), fixture.adapter);
  const changes = proposal.items.filter((item) => item.kind === "change");
  assert.equal(changes.length, 1);
  const [change] = changes;
  assert.ok(change.kind === "change");
  assert.equal(change.target.questionKey, "mfa");
  assert.ok(change.proposed.questionText.includes("a second sign-in step (multi-factor authentication)"));
  assert.deepEqual(change.sources, [{ kind: "instruction", ref: "instruction" }]);
});

test("the active providers are the deterministic pair unless the hosted provider is configured", () => {
  const active = activeQuestionnaireProposalProviders();
  assert.equal(active.proposals, deterministicQuestionnaireProposalProvider);
  assert.equal(active.rewrite, deterministicQuestionRewriteProvider);
});

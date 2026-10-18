import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { NOT_SURE_CHOICE, isNotSureEquivalent, withCanonicalNotSure } from "../src/csrm/ai/not-sure-choice";
import { QUESTIONNAIRE_PROPOSAL_CAPS, toQuestionnaireProposal, toQuestionRewriteProposal } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-adapter";
import { deterministicQuestionnaireProposalProvider } from "../src/api/csrm-questionnaire/services/deterministic-questionnaire-proposal-provider";
import { QuestionnaireGenerationJobFailure } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import type { QuestionnaireProposalV1 } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-envelope";
import { fixtureQuestion, OFFSHORE_NOTE, proposalFixture, rewriteFixture, YES_NO_NOT_SURE, type FixtureQuestion } from "./helpers/questionnaire-proposal-fixture";

/*
 * Phase 15 D-05 layer 2, D-10, D-13 and D-15 (QUES-12 criterion 2; the approved amendment's adjustment codes and bounds):
 * every rule that keeps a proposal off an answered question, out of a duplicate or past a cap, proven at the adapter
 * with model-facing wire JSON. Each left-out item is recorded, never silently.
 */

const edgeCases = (): Record<string, any> => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ai-wire", "questionnaire-proposals-edge-cases.json"), "utf8"));
const codes = (proposal: QuestionnaireProposalV1) => proposal.adjustments.map((adjustment) => adjustment.code);

type WireFields = Record<string, unknown>;
const wireItem = (fields: WireFields) => ({ kind: "add", target: null, questionText: null, helpText: null, answerType: null, choices: [], required: null, sectionTitle: null, visibleWhen: null, rationale: "CSRM test rationale.", sources: [], ...fields });
const wireAdd = (questionText: string, fields: WireFields = {}) => wireItem({ questionText, answerType: "Long text", required: true, sectionTitle: "Service overview", ...fields });
const wire = (...items: unknown[]) => ({ schemaVersion: 1, items });
const adapt = (raw: unknown, options: Parameters<typeof proposalFixture>[0] = {}) => toQuestionnaireProposal(raw, proposalFixture(options).adapter);

test("the shared Not sure rule is the shipped one: one canonical choice where the model put it, a second dropped, added last when absent", () => {
  assert.deepEqual(NOT_SURE_CHOICE, { value: "not-sure", label: "Not sure" });
  assert.ok(isNotSureEquivalent("Don’t know") && isNotSureEquivalent("I'm not sure.") && !isNotSureEquivalent("Not applicable"));
  assert.deepEqual(withCanonicalNotSure(["Yes", "No"]), [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { ...NOT_SURE_CHOICE }]);
  assert.deepEqual(withCanonicalNotSure(["Yes", "Unsure", "No", "Don't know"]), [{ value: "Yes", label: "Yes" }, { ...NOT_SURE_CHOICE }, { value: "No", label: "No" }]);
  const generation = readFileSync(join(process.cwd(), "src", "api", "csrm-questionnaire", "services", "openai-compatible-questionnaire-generation-provider.ts"), "utf8");
  assert.match(generation, /from "\.\.\/\.\.\/\.\.\/csrm\/ai\/not-sure-choice"/, "GENERATION_DOES_NOT_IMPORT_THE_SHARED_RULE");
  assert.doesNotMatch(generation, /NOT_SURE_EQUIVALENTS|"unsure"/, "GENERATION_KEEPS_A_SECOND_LIST");
  const adapter = readFileSync(join(process.cwd(), "src", "api", "csrm-questionnaire", "services", "questionnaire-proposal-adapter.ts"), "utf8");
  assert.match(adapter, /from "\.\.\/\.\.\/\.\.\/csrm\/ai\/not-sure-choice"/, "ADAPTER_DOES_NOT_IMPORT_THE_SHARED_RULE");
});

test("answered-target: a change to an answered question is left out", () => {
  const proposal = adapt(wire(wireItem({ kind: "change", target: "Q2", questionText: "Is the payroll service run by another company?" })));
  assert.equal(proposal.outcome, "no-change");
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["answered-target"]);
  assert.equal(proposal.adjustments[0].wireIndex, 0);
});

test("unknown-target: a Q the run did not offer is left out", () => {
  const proposal = adapt(edgeCases()["unknown-target"]);
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["unknown-target"]);
});

test("removed-target: a removed question is left out", () => {
  const proposal = adapt(edgeCases()["removed-target"]);
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["removed-target"]);
});

test("duplicate-target: a second item on one question is left out and the first kept", () => {
  const proposal = adapt(edgeCases()["duplicate-target"]);
  assert.deepEqual(proposal.items.map((item) => [item.key, item.kind]), [["i-1", "change"]]);
  assert.deepEqual(codes(proposal), ["duplicate-target"]);
  assert.equal(proposal.adjustments[0].wireIndex, 1);
});

test("invalid-item: an addition with no answer type, a select with one choice, 2,001 characters of help text and a Boolean are left out", () => {
  const proposal = adapt(wire(
    wireAdd("Which payroll reports leave the service each month?", { answerType: null }),
    wireAdd("Does the vendor encrypt payroll exports?", { answerType: "Single select", choices: ["Yes"] }),
    wireAdd("How are payroll exports protected in transit?", { helpText: "x".repeat(2_001) }),
    wireAdd("Which payroll exports are encrypted at rest?", { helpText: "x".repeat(2_000) }),
  ));
  assert.deepEqual(codes(proposal), ["invalid-item", "invalid-item", "invalid-item"]);
  assert.deepEqual(proposal.items.map((item) => (item.kind === "add" ? item.proposed.questionText : null)), ["Which payroll exports are encrypted at rest?"]);
  const boolean = adapt(edgeCases()["boolean-type"]);
  assert.deepEqual(boolean.items, []);
  assert.deepEqual(codes(boolean), ["invalid-item"], "A_BOOLEAN_ADDITION_WAS_KEPT");
});

test("near-duplicate: an addition repeating an active, open, rejected or removed question, or an earlier addition, is left out", () => {
  const proposal = adapt(wire(
    wireAdd("Where is the payroll service hosted"),
    wireAdd("Who administers the offshore support team?"),
    wireAdd("Which vendor staff can export payroll files?"),
    wireAdd("Is the old backup tape process still used?"),
    wireAdd("Which payroll files are sent to the bank?"),
    wireAdd("Which payroll files are sent to the bank!"),
  ), { openItemTexts: ["Who administers the offshore support team?"], rejectedItemTexts: ["Which vendor staff can export payroll files?"] });
  assert.deepEqual(codes(proposal), ["near-duplicate", "near-duplicate", "near-duplicate", "near-duplicate", "near-duplicate"]);
  assert.deepEqual(proposal.items.map((item) => (item.kind === "add" ? item.proposed.questionText : null)), ["Which payroll files are sent to the bank?"]);
});

test("no-change: a change identical to its target once normalised is left out", () => {
  const proposal = adapt(wire(wireItem({ kind: "change", target: "Q1", questionText: "  What does the payroll service do for the business?  ", helpText: "Describe the work the service supports." })));
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["no-change"]);
});

test("definition-invalid: a visibility label the controller does not offer is left out; a label it offers maps to its value", () => {
  const proposal = adapt(wire(
    wireAdd("Which hosting region does the cloud provider use?", { sectionTitle: "Security controls", visibleWhen: { question: "Q5", operator: "equals", value: "Mainframe" } }),
    wireAdd("Which cloud region holds the payroll data?", { sectionTitle: "Security controls", visibleWhen: { question: "Q5", operator: "equals", value: "cloud" } }),
  ));
  assert.deepEqual(codes(proposal), ["definition-invalid"]);
  const [kept] = proposal.items;
  assert.ok(kept?.kind === "add");
  assert.deepEqual(kept.proposed.visibility, { questionKey: "hosting-model", operator: "equals", value: "cloud" });
  assert.deepEqual(kept.proposed.section, { kind: "existing", key: "controls" });
  assert.equal(kept.base.controller?.questionKey, "hosting-model");
});

test("answers-affected: the hidden-dependent change, an unanswered controller dropping the value an answered dependent needs, is left out", () => {
  const proposal = adapt(edgeCases()["hidden-dependent"]);
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["answers-affected"]);
  // The same controller may gain a choice while it keeps the value.
  const kept = adapt(wire(wireItem({ kind: "change", target: "Q5", choices: ["On premises", "Cloud", "Hybrid"] })));
  assert.deepEqual(codes(kept), []);
  const [item] = kept.items;
  assert.ok(item?.kind === "change");
  assert.deepEqual(item.proposed.choices, [{ value: "on-premises", label: "On premises" }, { value: "cloud", label: "Cloud" }, { value: "Hybrid", label: "Hybrid" }, { value: "not-sure", label: "Not sure" }]);
});

test("rewrite-out-of-scope: a rewrite whose labels do not match the target's choices one for one is left out", () => {
  const fixture = rewriteFixture("hosting-model");
  const rewrite = (choiceLabels: string[]) => ({ schemaVersion: 1, questionText: "Where does the payroll service run?", helpText: null, choiceLabels, rationale: "Plainer wording." });
  const proposal = toQuestionRewriteProposal(rewrite(["On site", "In the cloud"]), fixture.adapter);
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["rewrite-out-of-scope"]);
  // A free-text target takes no labels at all.
  const text = toQuestionRewriteProposal(rewrite(["Yes"]), rewriteFixture("logging").adapter);
  assert.deepEqual(codes(text), ["rewrite-out-of-scope"]);
  // The same count maps positionally onto the unchanged values.
  const kept = toQuestionRewriteProposal(rewrite(["On site", "In the cloud", "Not sure"]), fixture.adapter);
  const [item] = kept.items;
  assert.ok(item?.kind === "change");
  assert.deepEqual(item.proposed.choices, [{ value: "on-premises", label: "On site" }, { value: "cloud", label: "In the cloud" }, { value: "not-sure", label: "Not sure" }]);
});

test("a removal of an unanswered controller whose answered dependent reads it is left out as answers-affected", () => {
  const proposal = adapt(wire(wireItem({ kind: "remove", target: "Q5" })));
  assert.deepEqual(proposal.items, []);
  assert.deepEqual(codes(proposal), ["answers-affected"]);
});

/* 21 unanswered questions, so 20 removals and 20 additions are each valid on their own. */
function manyQuestions(): FixtureQuestion[] {
  const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform"];
  return words.map((word, index) => fixtureQuestion(`question-${word}`, `How is the ${word} workstream governed for payroll?`, { order: index }));
}

test("over-limit: of 40 valid items 30 are kept, at most 15 additions, and the 10 left out are one aggregated adjustment", () => {
  assert.deepEqual(QUESTIONNAIRE_PROPOSAL_CAPS, { items: 30, additions: 15, sources: 10, adjustments: 60 });
  const proposal = adapt(edgeCases()["over-limit"], { questions: manyQuestions() });
  assert.equal(proposal.items.length, 30);
  assert.equal(proposal.items.filter((item) => item.kind === "add").length, 15);
  assert.equal(proposal.items.filter((item) => item.kind === "remove").length, 15);
  assert.deepEqual(proposal.items.map((item) => item.key), Array.from({ length: 30 }, (_, index) => `i-${index + 1}`));
  assert.deepEqual(codes(proposal), ["over-limit"]);
  assert.equal(proposal.adjustments[0].count, 10);
  assert.equal(proposal.adjustments[0].wireIndex, undefined);
});

test("sources outside the context's ids are removed and counted once, and the item is kept", () => {
  const proposal = adapt(edgeCases()["bad-sources"], { notes: [{ sequence: 1, body: OFFSHORE_NOTE }] });
  assert.equal(proposal.items.length, 1);
  assert.deepEqual(proposal.items[0].sources, [{ kind: "note", ref: "note-1" }, { kind: "request-field", ref: "request.title" }]);
  assert.deepEqual(codes(proposal), ["sources-dropped"]);
  assert.equal(proposal.adjustments[0].count, 3);
});

test("a removal's unused fields are ignored and recorded once, and the removal is kept", () => {
  const proposal = adapt(wire(
    wireItem({ kind: "remove", target: "Q4", questionText: "Ignored text", answerType: "Text" }),
    wireItem({ kind: "remove", target: "Q1", sectionTitle: "Ignored section" }),
  ));
  assert.deepEqual(proposal.items.map((item) => item.kind), ["remove", "remove"]);
  assert.deepEqual(codes(proposal), ["ignored-field"]);
  assert.equal(proposal.adjustments[0].count, 2);
});

test("every select gets exactly one canonical Not sure: added last, canonicalised where the model put it, a second dropped", () => {
  const proposal = adapt(wire(
    wireAdd("Does the vendor encrypt payroll exports?", { answerType: "Single select", choices: ["Yes", "No"] }),
    wireAdd("Does the vendor sign payroll exports?", { answerType: "Single select", choices: ["Yes", "Don’t know", "No"] }),
    wireAdd("Does the vendor archive payroll exports?", { answerType: "Multi select", choices: ["Yes", "Don’t know", "No", "Unsure"] }),
  ));
  assert.deepEqual(codes(proposal), []);
  const choices = proposal.items.map((item) => (item.kind === "add" ? item.proposed.choices : []));
  assert.deepEqual(choices[0], [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "not-sure", label: "Not sure" }]);
  assert.deepEqual(choices[1], [{ value: "Yes", label: "Yes" }, { value: "not-sure", label: "Not sure" }, { value: "No", label: "No" }]);
  assert.deepEqual(choices[2], [{ value: "Yes", label: "Yes" }, { value: "not-sure", label: "Not sure" }, { value: "No", label: "No" }]);
});

test("a structurally broken output fails the job with PROVIDER_OUTPUT_INVALID", () => {
  const fixture = proposalFixture();
  for (const raw of [null, {}, { schemaVersion: 2, items: [] }, { schemaVersion: 1, items: [{ kind: "add" }] }, { schemaVersion: 1, items: [], extra: true }]) {
    assert.throws(() => toQuestionnaireProposal(raw, fixture.adapter), (error: unknown) => error instanceof QuestionnaireGenerationJobFailure && error.code === "PROVIDER_OUTPUT_INVALID");
  }
});

test("rule W2: an instruction about tax file numbers adds the question citing the instruction", async () => {
  const fixture = proposalFixture({ instruction: "Also cover tax file numbers and the offshore support team", notes: [{ sequence: 1, body: OFFSHORE_NOTE }] });
  const proposal = toQuestionnaireProposal(await deterministicQuestionnaireProposalProvider.propose(fixture.input), fixture.adapter);
  const tfn = proposal.items.find((item) => item.kind === "add" && item.proposed.questionText === "Will the service collect or store tax file numbers?");
  assert.ok(tfn?.kind === "add", "NO_TAX_FILE_NUMBER_QUESTION");
  assert.deepEqual(tfn.proposed.section, { kind: "new", title: "Personal information" });
  assert.deepEqual(tfn.sources, [{ kind: "instruction", ref: "instruction" }]);
  assert.equal(tfn.proposed.answerType, "Single select");
  assert.equal(tfn.proposed.choices.at(-1)?.label, "Not sure");
  assert.ok(codes(proposal).includes("answered-target") && codes(proposal).includes("near-duplicate"));
});

test("rule W2: an instruction to drop the logging question removes the unanswered logging question", async () => {
  const fixture = proposalFixture({ instruction: "Drop the logging question" });
  const proposal = toQuestionnaireProposal(await deterministicQuestionnaireProposalProvider.propose(fixture.input), fixture.adapter);
  const removals = proposal.items.filter((item) => item.kind === "remove");
  assert.equal(removals.length, 1);
  assert.ok(removals[0].kind === "remove");
  assert.equal(removals[0].target.questionKey, "logging");
  assert.deepEqual(removals[0].sources, [{ kind: "instruction", ref: "instruction" }]);
});

test("rule W3: with no marked note, a conditional follow-up on the first answered Yes or No question", async () => {
  const fixture = proposalFixture();
  const proposal = toQuestionnaireProposal(await deterministicQuestionnaireProposalProvider.propose(fixture.input), fixture.adapter);
  const additions = proposal.items.filter((item) => item.kind === "add");
  assert.equal(additions.length, 1);
  const [follow] = additions;
  assert.ok(follow.kind === "add");
  assert.equal(follow.proposed.questionText, "What access will they have to your systems or data, and how is it controlled?");
  assert.equal(follow.proposed.answerType, "Long text");
  assert.deepEqual(follow.proposed.visibility, { questionKey: "third-party", operator: "equals", value: "yes" });
  assert.deepEqual(follow.proposed.section, { kind: "existing", key: "overview" });
  assert.deepEqual(follow.sources, [{ kind: "answered-question", ref: "Q2" }]);
  assert.deepEqual(codes(proposal), ["answered-target", "near-duplicate"]);
});

test("a question list with no answered Yes or No question gets no W3 follow-up and no adversarial change", async () => {
  const fixture = proposalFixture({ questions: [fixtureQuestion("only", "Which payroll reports does the business rely on?", { type: "Single select", choices: YES_NO_NOT_SURE })] });
  const raw = await deterministicQuestionnaireProposalProvider.propose(fixture.input) as { items: Array<{ kind: string }> };
  assert.deepEqual(raw.items.map((item) => item.kind), ["add"]);
  assert.deepEqual(codes(toQuestionnaireProposal(raw, fixture.adapter)), ["near-duplicate"]);
});

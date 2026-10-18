import assert from "node:assert/strict";
import test from "node:test";
import {
  DECISION_ACTIONS,
  foldItemStates,
  nextState,
  openItemKeys,
  parseDecisionEventsV2,
  PROPOSAL_ITEM_STATES,
  type DecisionAction,
  type DecisionEventV2,
  type DecisionPayloadParsers,
  type ProposalItemState,
} from "../src/csrm/ai/proposal-items";
import { riskDecisionPayloads } from "../src/csrm/ai/risk-proposals/risk-proposal-envelope";
import { questionnaireDecisionPayloads } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-envelope";

/*
 * Phase 15 D-20 and D-24, the approved amendment "Decision event v2 and item states": an item's state is a pure fold
 * of the run's decision events over its proposal's items. The core is generic: a target supplies its own payload
 * parsers, so these tests use a trivial target whose payloads are short strings.
 */
const parsers: DecisionPayloadParsers<string, string> = {
  editFields: ["title", "body"],
  before: (value) => (typeof value === "string" && value.length > 0 ? value : null),
  applied: (value) => (typeof value === "string" && value.length > 0 ? value : null),
};

const AT = "2026-10-11T08:00:00.000Z";
const event = (item: string, action: DecisionAction, extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, at: AT, by: "analyst-1", item, action, ...extra });
const parsed = (raw: readonly unknown[]): readonly DecisionEventV2<string, string>[] => {
  const events = parseDecisionEventsV2(raw, parsers);
  assert.ok(events, "THE_FIXTURE_EVENTS_DID_NOT_PARSE");
  return events;
};

test("the item states and the decision actions are the amendment's closed lists", () => {
  assert.deepEqual([...PROPOSAL_ITEM_STATES], ["open", "accepted", "rejected", "superseded", "lapsed"]);
  assert.deepEqual([...DECISION_ACTIONS], ["accepted", "rejected", "restored", "superseded", "lapsed"]);
});

test("the fold gives accepted, open after a rejection is restored, and superseded", () => {
  const states = foldItemStates(["i-1", "i-2", "i-3"], parsed([
    event("i-1", "accepted", { applied: "applied-1" }),
    event("i-2", "rejected", { reason: "Out of scope." }),
    event("i-2", "restored"),
    event("i-3", "superseded", { by: "analyst-2", cause: { kind: "newer-rewrite", runId: "run-2" } }),
  ]));
  assert.ok(states);
  assert.equal(states.get("i-1"), "accepted");
  assert.equal(states.get("i-2"), "open");
  assert.equal(states.get("i-3"), "superseded");
  assert.deepEqual(openItemKeys(states), ["i-2"]);
});

test("an item with no event stays open", () => {
  const states = foldItemStates(["i-1", "i-2"], []);
  assert.ok(states);
  assert.deepEqual(openItemKeys(states), ["i-1", "i-2"]);
});

test("an event naming an item the proposal does not hold damages the run", () => {
  assert.equal(foldItemStates(["i-1", "i-2", "i-3"], parsed([event("i-9", "accepted")])), null);
});

test("an illegal transition damages the run: accepted followed by rejected", () => {
  assert.equal(foldItemStates(["i-1"], parsed([event("i-1", "accepted"), event("i-1", "rejected")])), null);
});

test("a stored no-op damages the run, because the decision service never stores one", () => {
  assert.equal(foldItemStates(["i-1"], parsed([event("i-1", "restored")])), null, "OPEN_RESTORED_WAS_STORED");
  assert.equal(foldItemStates(["i-1"], parsed([event("i-1", "rejected"), event("i-1", "rejected")])), null, "A_REPEATED_REJECTION_WAS_STORED");
});

test("a damaged run counts no open item", () => {
  assert.deepEqual(openItemKeys(null), []);
});

test("nextState follows every row of the amendment's transition table", () => {
  const rows: Array<[ProposalItemState, DecisionAction, boolean, ProposalItemState | "no-op" | "not-open"]> = [
    ["open", "accepted", false, "accepted"],
    ["open", "accepted", true, "accepted"],
    ["open", "rejected", false, "rejected"],
    ["open", "restored", false, "no-op"],
    ["open", "superseded", false, "superseded"],
    ["open", "lapsed", false, "lapsed"],
    ["accepted", "accepted", false, "no-op"],
    ["accepted", "accepted", true, "not-open"],
    ["accepted", "rejected", false, "not-open"],
    ["accepted", "restored", false, "open"],
    ["accepted", "superseded", false, "not-open"],
    ["accepted", "lapsed", false, "not-open"],
    ["rejected", "accepted", false, "not-open"],
    ["rejected", "rejected", false, "no-op"],
    ["rejected", "restored", false, "open"],
    ["rejected", "superseded", false, "not-open"],
    ["rejected", "lapsed", false, "not-open"],
  ];
  for (const final of ["superseded", "lapsed"] as const) {
    for (const action of DECISION_ACTIONS) rows.push([final, action, false, "not-open"]);
  }
  for (const [state, action, withEdits, expected] of rows) {
    assert.equal(nextState(state, action, { withEdits }), expected, `${state} + ${action}${withEdits ? " with edits" : ""}`);
  }
  assert.equal(nextState("superseded", "restored", { withEdits: false }), "not-open", "SUPERSEDED_COULD_BE_RESTORED");
});

test("the decision event parser is closed and never throws", () => {
  const valid = event("i-1", "accepted", { edits: ["title"], before: "before-1", applied: "applied-1" });
  assert.ok(parseDecisionEventsV2([valid], parsers));
  const invalid: unknown[] = [
    { ...valid, schemaVersion: 1 },
    { ...valid, unexpected: true },
    { ...valid, item: "i-31" },
    { ...valid, item: "i-0" },
    { ...valid, action: "dismissed" },
    { ...valid, by: "" },
    { ...valid, by: "x".repeat(256) },
    { ...valid, at: "not a time" },
    { ...valid, edits: ["colour"] },
    { ...valid, edits: [] },
    { ...valid, before: 42 },
    { ...valid, applied: "" },
    event("i-1", "rejected", { reason: "x".repeat(501) }),
    event("i-1", "rejected", { reason: "   " }),
    event("i-1", "superseded", { cause: { kind: "newer-rewrite", runId: "run-2", extra: 1 } }),
    "not an event",
    null,
  ];
  for (const candidate of invalid) assert.equal(parseDecisionEventsV2([candidate], parsers), null, JSON.stringify(candidate));
  assert.equal(parseDecisionEventsV2({ length: 1 }, parsers), null, "A_NON_ARRAY_PARSED");
});

test("a run with no decisions yet reads as an empty log", () => {
  assert.deepEqual(parseDecisionEventsV2(null, parsers), []);
  assert.deepEqual(parseDecisionEventsV2(undefined, parsers), []);
});

test("parsed events are frozen copies holding only the declared keys", () => {
  const events = parsed([event("i-1", "rejected", { reason: "  Not needed.  " })]);
  assert.ok(Object.isFrozen(events));
  assert.ok(Object.isFrozen(events[0]));
  assert.deepEqual(events[0], { schemaVersion: 2, at: AT, by: "analyst-1", item: "i-1", action: "rejected", reason: "Not needed." });
});

/*
 * Phase 16 D-39 to D-41 and the approved Phase 16 amendment, "Decisions and item states": risk proposals are decided
 * on this same core. A target supplies its own item keys through the optional `itemKey` hook; the questionnaire keeps
 * `i-1` to `i-30`. The two new causes pair with one action each, as Phase 15's do.
 */
const riskBefore = { riskDocumentId: "risk-1", values: { riskStatement: "Old statement" }, fieldFacts: { riskStatement: null } };
const riskApplied = { riskDocumentId: "risk-1", values: { riskStatement: "New statement" } };

test("risk events take risk item keys and the two Phase 16 causes, each with its one action", () => {
  const events = parseDecisionEventsV2([
    event("u-residual-rating", "superseded", { cause: { kind: "risk-withdrawn", riskDocumentId: "r1" } }),
    event("s-1", "lapsed", { by: "system", cause: { kind: "assessment-not-editable" } }),
    event("u-risk-statement", "accepted", { before: riskBefore, applied: riskApplied }),
  ], riskDecisionPayloads);
  assert.ok(events, "RISK_EVENTS_DID_NOT_PARSE");
  assert.deepEqual(events[0].cause, { kind: "risk-withdrawn", riskDocumentId: "r1" });
  assert.deepEqual(events[1].cause, { kind: "assessment-not-editable" });
  assert.equal(events[2].item, "u-risk-statement");
});

test("the questionnaire parsers still refuse a risk item key", () => {
  const riskItem = event("u-residual-rating", "rejected");
  assert.equal(parseDecisionEventsV2([riskItem], parsers), null);
  assert.equal(parseDecisionEventsV2([riskItem], questionnaireDecisionPayloads), null);
  assert.equal(parseDecisionEventsV2([event("s-1", "rejected")], questionnaireDecisionPayloads), null);
  assert.ok(parseDecisionEventsV2([event("i-1", "rejected")], questionnaireDecisionPayloads));
});

test("the risk payloads refuse questionnaire keys, unknown units and suggestion keys past s-8", () => {
  for (const item of ["i-1", "u-risk-owner", "u-", "s-0", "s-9", "risk-1"]) {
    assert.equal(parseDecisionEventsV2([event(item, "rejected")], riskDecisionPayloads), null, item);
  }
});

test("a cause on the wrong action, a malformed cause or a risk event carrying edits damages the log", () => {
  const malformed: unknown[] = [
    event("u-residual-rating", "lapsed", { cause: { kind: "risk-withdrawn", riskDocumentId: "r1" } }),
    event("u-residual-rating", "superseded", { cause: { kind: "assessment-not-editable" } }),
    event("u-residual-rating", "superseded", { cause: { kind: "risk-withdrawn" } }),
    event("u-residual-rating", "superseded", { cause: { kind: "risk-withdrawn", riskDocumentId: "x".repeat(256) } }),
    event("u-residual-rating", "superseded", { cause: { kind: "risk-withdrawn", riskDocumentId: "r1", runId: "run-1" } }),
    event("u-residual-rating", "lapsed", { cause: { kind: "assessment-not-editable", riskDocumentId: "r1" } }),
    event("u-risk-statement", "accepted", { edits: ["riskStatement"], before: riskBefore, applied: riskApplied }),
    event("u-risk-statement", "accepted", { edits: [], before: riskBefore, applied: riskApplied }),
  ];
  for (const candidate of malformed) assert.equal(parseDecisionEventsV2([candidate], riskDecisionPayloads), null, JSON.stringify(candidate));
  // The new causes are risk-run causes, but the core pairs each with its action for every target.
  assert.equal(parseDecisionEventsV2([event("i-1", "lapsed", { cause: { kind: "risk-withdrawn", riskDocumentId: "r1" } })], parsers), null);
});

test("the unchanged fold decides risk items: restored to open, superseded final, a decision after a lapse damaged", () => {
  const states = foldItemStates(["s-1", "u-risk-statement"], parseDecisionEventsV2([
    event("s-1", "rejected", { reason: "Already covered." }),
    event("s-1", "restored"),
    event("u-risk-statement", "superseded", { cause: { kind: "risk-withdrawn", riskDocumentId: "risk-1" } }),
  ], riskDecisionPayloads) ?? []);
  assert.ok(states);
  assert.equal(states.get("s-1"), "open");
  assert.equal(states.get("u-risk-statement"), "superseded");
  assert.deepEqual(openItemKeys(states), ["s-1"]);
  const lapsedThenAccepted = parseDecisionEventsV2([
    event("u-risk-statement", "lapsed", { by: "system", cause: { kind: "assessment-not-editable" } }),
    event("u-risk-statement", "accepted", { before: riskBefore, applied: riskApplied }),
  ], riskDecisionPayloads);
  assert.ok(lapsedThenAccepted);
  assert.equal(foldItemStates(["s-1", "u-risk-statement"], lapsedThenAccepted), null);
});

/* BE2-14, the approved Phase 16 amendment: questionnaire runs keep questionnaire-frozen, risk runs take the two new causes. */
test("each target's parsers take only its own causes: a Phase 16 cause damages a questionnaire log and questionnaire-frozen a risk log (BE2-14)", () => {
  assert.equal(parseDecisionEventsV2([event("i-1", "superseded", { cause: { kind: "risk-withdrawn", riskDocumentId: "r1" } })], questionnaireDecisionPayloads), null, "QUESTIONNAIRE_TOOK_RISK_WITHDRAWN");
  assert.equal(parseDecisionEventsV2([event("i-1", "lapsed", { by: "system", cause: { kind: "assessment-not-editable" } })], questionnaireDecisionPayloads), null, "QUESTIONNAIRE_TOOK_ASSESSMENT_NOT_EDITABLE");
  assert.equal(parseDecisionEventsV2([event("u-risk-statement", "lapsed", { by: "system", cause: { kind: "questionnaire-frozen" } })], riskDecisionPayloads), null, "RISK_TOOK_QUESTIONNAIRE_FROZEN");
  assert.ok(parseDecisionEventsV2([event("i-1", "lapsed", { by: "system", cause: { kind: "questionnaire-frozen" } })], questionnaireDecisionPayloads), "QUESTIONNAIRE_REFUSED_ITS_OWN_CAUSE");
  assert.ok(parseDecisionEventsV2([event("i-1", "superseded", { cause: { kind: "newer-rewrite", runId: "run-2" } })], questionnaireDecisionPayloads), "QUESTIONNAIRE_REFUSED_NEWER_REWRITE");
  assert.ok(parseDecisionEventsV2([event("u-risk-statement", "superseded", { cause: { kind: "newer-rewrite", runId: "run-2" } })], riskDecisionPayloads), "RISK_REFUSED_NEWER_REWRITE");
});

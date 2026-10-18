import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRiskDecisionEvents,
  parseRiskProposal,
  RISK_PROPOSAL_ADJUSTMENT_CODES,
  RISK_PROPOSAL_OPERATIONS,
  RISK_PROPOSAL_SCHEMA_VERSION,
  RISK_SUGGESTIONS_MAX,
  type RiskProposalAllowedSets,
} from "../src/csrm/ai/risk-proposals/risk-proposal-envelope";
import { foldItemStates } from "../src/csrm/ai/proposal-items";

/*
 * Phase 16 D-39 to D-41 and the approved Phase 16 amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md,
 * "Risk proposal envelope v1": the two risk operations store this closed envelope once, and their decisions are
 * Phase 15's decision event v2 with Risk payloads. No item state is stored: state is the fold.
 */
const STATEMENT_FIELDS = ["issueStatement", "riskStatement", "riskCause", "potentialImpact", "inherentRatingRationale", "residualRatingRationale", "treatmentPlan"] as const;

function draftRisk(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    proposalKey: `risk-${index}`,
    riskTypeName: "Privileged Access",
    issueStatement: "Administrators in an offshore support centre hold standing access to the payroll platform.",
    riskStatement: "Offshore administrators with standing privileged access could read or change payroll data without detection.",
    riskCategory: "Cyber security",
    riskSubCategory: "Privileged access",
    riskCause: "Shared administrator accounts are used by the offshore support team without session recording.",
    potentialImpact: "Payroll data could be disclosed or altered, harming employees and the organisation.",
    informationSystem: "system-payroll",
    informationAsset: "asset-payroll-records",
    dataClassification: "Restricted",
    inherentLikelihood: "Likely",
    highestInherentConsequence: "Major",
    inherentRating: "High",
    inherentRatingRationale: "Standing privileged access to payroll data is a material exposure.",
    residualLikelihood: "Possible",
    highestResidualConsequence: "Major",
    residualRating: "High",
    residualRatingRationale: "Exposure remains until access is reviewed and sessions are recorded.",
    treatmentAction: "Treat",
    treatmentPlan: "Replace shared accounts with named privileged accounts and record every session.",
    sources: Object.fromEntries(STATEMENT_FIELDS.map((field) => [field, field === "potentialImpact" ? [] : ["answer.privileged-access"]])),
    uncitedClaims: [],
    suggestedControls: [{ controlNumber: "CTL-0007", control: "control-7", rationale: "Applicable to privileged access risks." }],
    adjustments: [],
    ...overrides,
  };
}

const suggestions = {
  schemaVersion: 1,
  operation: "risk-suggestions",
  outcome: "items",
  items: [
    { key: "s-1", kind: "risk", proposed: draftRisk(1), similarTo: null },
    {
      key: "s-2",
      kind: "risk",
      proposed: draftRisk(2, {
        riskTypeName: null,
        riskStatement: "Payroll files exported by hand could be altered before upload to the bank.",
        informationAsset: null,
        dataClassification: null,
        suggestedControls: [],
      }),
      similarTo: { kind: "withdrawn", riskDocumentId: "risk-9", score: 0.62 },
    },
  ],
  adjustments: [
    { code: "near-duplicate-active", wireIndex: 2, detail: "A proposed risk repeated an active risk and was left out." },
    { code: "suggestions-capped", count: 3, detail: "Three further proposed risks were left out to keep the run to eight." },
  ],
};

const rewrite = {
  schemaVersion: 1,
  operation: "risk-rewrite",
  outcome: "items",
  items: [
    {
      key: "u-risk-statement",
      kind: "change",
      riskDocumentId: "risk-1",
      fields: ["riskStatement"],
      base: { riskStatement: "Offshore administrators can reach payroll data." },
      proposed: { riskStatement: "Offshore administrators with standing access could change payroll data without detection." },
      sources: ["answer.privileged-access"],
      uncited: ["Session recording is not in place."],
    },
    {
      key: "u-residual-rating",
      kind: "change",
      riskDocumentId: "risk-1",
      fields: ["residualLikelihood", "highestResidualConsequence", "residualRating"],
      base: { residualLikelihood: "Possible", highestResidualConsequence: "Major", residualRating: "High" },
      proposed: { residualLikelihood: "Unlikely", highestResidualConsequence: "Moderate", residualRating: "Moderate" },
    },
    {
      key: "u-treatment",
      kind: "change",
      riskDocumentId: "risk-1",
      fields: ["treatmentAction", "treatmentPlan"],
      base: { treatmentAction: "Treat", treatmentPlan: "Apply the suggested controls." },
      proposed: { treatmentAction: "Accept", treatmentPlan: "Accept the moderate residual risk and review it in six months." },
      aiAccept: true,
    },
  ],
  adjustments: [],
};

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("the envelope's closed lists are the amendment's", () => {
  assert.equal(RISK_PROPOSAL_SCHEMA_VERSION, 1);
  assert.deepEqual([...RISK_PROPOSAL_OPERATIONS], ["risk-suggestions", "risk-rewrite"]);
  assert.equal(RISK_SUGGESTIONS_MAX, 8);
  assert.deepEqual([...RISK_PROPOSAL_ADJUSTMENT_CODES], [
    "near-duplicate-active",
    "near-duplicate-withdrawn",
    "near-duplicate-rejected",
    "near-duplicate-proposed",
    "invalid-item",
    "over-limit",
    "accept-not-permitted",
    "accept-with-planned-control",
    "sources-dropped",
    "suggestions-dropped",
    "suggestions-capped",
    "outside-focus",
    "no-change",
  ]);
  assert.equal(RISK_PROPOSAL_ADJUSTMENT_CODES.length, 13);
});

test("a suggestions envelope round-trips deep-equal, frozen", () => {
  const parsed = parseRiskProposal(json(suggestions));
  assert.ok(parsed, "THE_SUGGESTIONS_ENVELOPE_DID_NOT_PARSE");
  assert.deepEqual(parsed, suggestions);
  assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.items) && Object.isFrozen(parsed.items[0]));
});

test("a rewrite envelope round-trips deep-equal, with its three units and the AI Accept flag", () => {
  const parsed = parseRiskProposal(json(rewrite));
  assert.ok(parsed, "THE_REWRITE_ENVELOPE_DID_NOT_PARSE");
  assert.deepEqual(parsed, rewrite);
});

test("a no-change outcome holds no item, and items need the items outcome", () => {
  const noChange = { schemaVersion: 1, operation: "risk-rewrite", outcome: "no-change", items: [], adjustments: [{ code: "no-change", detail: "The rewrite proposed the values the risk already holds." }] };
  assert.deepEqual(parseRiskProposal(json(noChange)), noChange);
  assert.equal(parseRiskProposal({ ...json(rewrite), outcome: "no-change" }), null);
  assert.equal(parseRiskProposal({ ...json(noChange), outcome: "items" }), null);
});

test("the parser returns null on anything else and never throws", () => {
  const malformed: unknown[] = [];
  const withItem = (envelope: typeof suggestions | typeof rewrite, index: number, change: Record<string, unknown>) => {
    const copy = json(envelope) as { items: Record<string, unknown>[] };
    copy.items[index] = { ...copy.items[index], ...change };
    return copy;
  };
  malformed.push(withItem(suggestions, 1, { key: "s-9" }));
  malformed.push(withItem(suggestions, 1, { key: "s-1" }));
  malformed.push(withItem(rewrite, 1, { fields: ["residualLikelihood", "residualRating"] }));
  malformed.push(withItem(rewrite, 1, { fields: ["highestResidualConsequence", "residualLikelihood", "residualRating"] }));
  malformed.push(withItem(rewrite, 1, { base: { residualLikelihood: "Possible", highestResidualConsequence: "Major" } }));
  malformed.push(withItem(rewrite, 1, { proposed: { residualLikelihood: "Unlikely", highestResidualConsequence: "Moderate", residualRating: "High" } }));
  malformed.push(withItem(rewrite, 0, { key: "u-risk-owner" }));
  malformed.push(withItem(rewrite, 0, { riskDocumentId: "risk-2" }));
  malformed.push(withItem(rewrite, 0, { extra: true }));
  malformed.push(withItem(rewrite, 1, { aiAccept: true }));
  malformed.push(withItem(rewrite, 2, { aiAccept: false }));
  malformed.push(withItem(suggestions, 0, { proposed: draftRisk(1, { inherentRating: "Low" }) }));
  malformed.push(withItem(suggestions, 0, { proposed: draftRisk(1, { extra: "x" }) }));
  malformed.push(withItem(suggestions, 0, { proposed: draftRisk(2) }));
  malformed.push(withItem(suggestions, 1, { similarTo: { kind: "sameRun", riskDocumentId: "risk-9", score: 0.62 } }));
  malformed.push(withItem(suggestions, 1, { similarTo: { kind: "withdrawn", runId: "run-1", itemKey: "s-1", score: 0.62 } }));
  malformed.push(withItem(suggestions, 1, { similarTo: { kind: "withdrawn", riskDocumentId: "risk-9", score: 1.5 } }));
  malformed.push({ ...json(suggestions), adjustments: [{ code: "near-duplicate", detail: "Not one of the thirteen." }] });
  malformed.push({ ...json(suggestions), adjustments: Array.from({ length: 61 }, () => ({ code: "invalid-item", detail: "x" })) });
  malformed.push({ ...json(suggestions), items: [...json(suggestions).items, ...Array.from({ length: 7 }, (_, index) => ({ key: `s-${index + 3}`, kind: "risk", proposed: draftRisk(index + 3), similarTo: null }))] });
  malformed.push({ ...json(suggestions), schemaVersion: 2 });
  malformed.push({ ...json(suggestions), itemStates: {} });
  malformed.push({ ...json(suggestions), operation: "assessment-draft" });
  malformed.push({ ...json(rewrite), operation: "risk-suggestions" });
  malformed.push({ ...json(rewrite), items: [...json(rewrite).items, { ...json(rewrite).items[2], key: "u-treatment-plan", fields: ["treatmentPlan"], base: { treatmentPlan: "x" }, proposed: { treatmentPlan: "y" }, aiAccept: undefined }] });
  malformed.push(null, undefined, "proposal", 7, []);
  for (const value of malformed) {
    assert.doesNotThrow(() => parseRiskProposal(value));
    assert.equal(parseRiskProposal(value), null, JSON.stringify(value)?.slice(0, 160));
  }
  const hostile = { ...json(rewrite), get items(): never { throw new Error("boom"); } };
  assert.equal(parseRiskProposal(hostile), null);
});

test("with the context's allowed sets, every record a proposal names must be one the context offered", () => {
  const allowed: RiskProposalAllowedSets = {
    context: {
      riskTypes: { "Privileged Access": "type-privileged-access" },
      systems: { "system-1": "system-payroll" },
      assets: { "asset-1": { documentId: "asset-payroll-records", name: "Payroll records", classification: "Restricted" } },
      sourceKeys: ["answer.privileged-access"],
      controlCandidates: { "CTL-0007": { documentId: "control-7", name: "Privileged access review" } },
    },
    riskDocumentId: "risk-1",
  };
  assert.ok(parseRiskProposal(json(suggestions), allowed));
  assert.ok(parseRiskProposal(json(rewrite), allowed));
  const unknownSystem = json(suggestions);
  (unknownSystem.items[0].proposed as Record<string, unknown>).informationSystem = "system-elsewhere";
  assert.equal(parseRiskProposal(unknownSystem, allowed), null);
  assert.ok(parseRiskProposal(unknownSystem), "WITHOUT_ALLOWED_SETS_THE_SHAPE_ALONE_IS_CHECKED");
  assert.equal(parseRiskProposal(json(rewrite), { ...allowed, riskDocumentId: "risk-2" }), null);
  const unknownSource = json(rewrite);
  unknownSource.items[0].sources = ["answer.not-offered"];
  assert.equal(parseRiskProposal(unknownSource, allowed), null);
});

const AT = "2026-10-15T08:00:00.000Z";
const before = {
  riskDocumentId: "risk-1",
  values: { riskStatement: "Offshore administrators can reach payroll data." },
  fieldFacts: { riskStatement: { state: "proposed", sources: ["answer.privileged-access"] } },
};
const applied = { riskDocumentId: "risk-1", values: { riskStatement: "Offshore administrators with standing access could change payroll data without detection." } };

test("risk decision events parse: an accept with its before and applied, a restore and a rejection with its reason", () => {
  const events = parseRiskDecisionEvents([
    { schemaVersion: 2, at: AT, by: "analyst-1", item: "u-risk-statement", action: "accepted", before, applied },
    { schemaVersion: 2, at: AT, by: "analyst-1", item: "u-risk-statement", action: "restored", applied: { riskDocumentId: "risk-1", values: before.values } },
    { schemaVersion: 2, at: AT, by: "analyst-1", item: "u-risk-statement", action: "rejected", reason: "The original wording is clearer." },
    { schemaVersion: 2, at: AT, by: "analyst-1", item: "s-1", action: "accepted", applied: { riskDocumentId: "risk-new" } },
  ]);
  assert.ok(events, "RISK_DECISIONS_DID_NOT_PARSE");
  assert.deepEqual(events[0].before, before);
  assert.deepEqual(events[3].applied, { riskDocumentId: "risk-new" });
  const states = foldItemStates(["s-1", "u-risk-statement"], events);
  assert.equal(states?.get("u-risk-statement"), "rejected");
  assert.equal(states?.get("s-1"), "accepted");
  assert.deepEqual(parseRiskDecisionEvents([{ schemaVersion: 2, at: AT, by: "analyst-1", item: "u-risk-statement", action: "accepted", before: { ...before, fieldFacts: { riskStatement: null } }, applied }])?.[0].before, { ...before, fieldFacts: { riskStatement: null } });
});

test("a risk decision payload that does not parse damages the log", () => {
  const accepted = (payload: Record<string, unknown>) => [{ schemaVersion: 2, at: AT, by: "analyst-1", item: "u-risk-statement", action: "accepted", ...payload }];
  const { riskDocumentId: _riskDocumentId, ...withoutRisk } = before;
  const malformed: unknown[] = [
    accepted({ before: withoutRisk, applied }),
    accepted({ before: { ...before, values: { riskOwner: "user-1" }, fieldFacts: { riskOwner: null } }, applied }),
    accepted({ before: { ...before, fieldFacts: {} }, applied }),
    accepted({ before: { ...before, fieldFacts: { riskStatement: { state: "unknown" } } }, applied }),
    accepted({ before, applied: { values: applied.values } }),
    accepted({ before, applied: { ...applied, extra: 1 } }),
    [{ schemaVersion: 1, at: AT, by: "analyst-1", item: "u-risk-statement", action: "accepted" }],
  ];
  for (const value of malformed) assert.equal(parseRiskDecisionEvents(value), null, JSON.stringify(value).slice(0, 160));
  assert.deepEqual(parseRiskDecisionEvents(null), []);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProposedRisk,
  RISK_SIMILARITY_THRESHOLD,
  riskComparisonText,
  type DuplicateEntry,
} from "../src/csrm/ai/risk-proposals/risk-duplicates";
import { NEAR_DUPLICATE_THRESHOLD, tokenSetSimilarity } from "../src/csrm/ai/text-similarity";

/*
 * Phase 16 D-32 and the approved Phase 16 amendment's "Bounds": near-identical (dropped) when the Risk Types match,
 * both null counting as a match, and Phase 15's `isNearDuplicate` holds on statement plus cause; similar (kept and
 * flagged) when the token-set Jaccard of statement plus cause is at least 0.5. The fixtures pin both thresholds.
 *
 * UAT-A-like fixtures, as object literals: the payroll platform request's three drafted risks (offshore administrator
 * access, personal information handling and the external payroll processor).
 */
const offshoreAccess: DuplicateEntry = {
  ref: "risk-offshore",
  riskType: "Privileged Access",
  riskStatement: "Offshore support administrators with standing privileged access could read or change payroll data without detection.",
  riskCause: "Shared administrator accounts are used by the offshore support team without session recording.",
};
const personalInformation: DuplicateEntry = {
  ref: "risk-personal",
  riskType: "Personal Information Handling",
  riskStatement: "Inadequate protection of employee payment details may result in unauthorised disclosure of personal information.",
  riskCause: "Personal and bank details of employees are stored and processed by the payroll platform.",
};
const payrollProcessor: DuplicateEntry = {
  ref: "risk-processor",
  riskType: "Third-Party Dependency",
  riskStatement: "Reliance on the external payroll processor may reduce direct control over payroll resilience and information protection.",
  riskCause: "An external payroll processor operates and receives payroll information for the service.",
};
const uatA = [offshoreAccess, personalInformation, payrollProcessor];

const candidate = (overrides: Partial<DuplicateEntry> = {}) => ({
  riskType: offshoreAccess.riskType,
  riskStatement: offshoreAccess.riskStatement,
  riskCause: offshoreAccess.riskCause,
  ...overrides,
});

const reworded = candidate({
  riskStatement: "Offshore support administrators holding standing privileged access might change payroll data without detection.",
  riskCause: "The offshore support team uses shared administrator accounts and does not record sessions.",
});

const paymentIntegrity = {
  riskType: "Payment Integrity",
  riskStatement: "Unsigned payment files reconciled by hand could be altered before the pay run without detection",
  riskCause: "Payment files are not signed and reconciliation is a manual step.",
};

test("the thresholds are pinned: similar at 0.5, near-identical at Phase 15's 0.8", () => {
  assert.equal(RISK_SIMILARITY_THRESHOLD, 0.5);
  assert.equal(NEAR_DUPLICATE_THRESHOLD, 0.8);
});

test("the comparison text is the risk statement and cause joined by a space", () => {
  assert.equal(riskComparisonText({ riskStatement: "A statement.", riskCause: "A cause." }), "A statement. A cause.");
  assert.equal(riskComparisonText({ riskStatement: " A statement. ", riskCause: null }), "A statement.");
  assert.equal(riskComparisonText({ riskStatement: null, riskCause: undefined }), "");
});

test("a verbatim restatement with the same Risk Type is near-identical to the active risk", () => {
  assert.deepEqual(classifyProposedRisk(candidate(), { active: uatA }), { tier: "near-identical", against: { kind: "active", ref: "risk-offshore" } });
});

test("the same text under a different Risk Type is similar, not near-identical", () => {
  const verdict = classifyProposedRisk(candidate({ riskType: "Internet Exposure" }), { active: uatA });
  assert.equal(verdict.tier, "similar");
  assert.deepEqual(verdict.tier === "similar" ? verdict.against : null, { kind: "active", ref: "risk-offshore" });
  assert.equal(verdict.tier === "similar" ? verdict.score : null, 1);
  assert.equal(classifyProposedRisk(candidate({ riskType: null }), { active: uatA }).tier, "similar", "A_NULL_TYPE_MATCHED_A_TYPED_RISK");
});

test("a reworded restatement of the offshore administrator access risk is similar to it", () => {
  const score = tokenSetSimilarity(riskComparisonText(reworded), riskComparisonText(offshoreAccess));
  assert.ok(score >= 0.5 && score < 0.8, `score ${score} must be in [0.5, 0.8)`);
  const verdict = classifyProposedRisk(reworded, { active: uatA });
  assert.equal(verdict.tier, "similar");
  assert.deepEqual(verdict.tier === "similar" ? verdict.against : null, { kind: "active", ref: "risk-offshore" });
  assert.equal(verdict.tier === "similar" ? verdict.score : null, score);
});

test("the payment-file integrity risk is distinct from UAT-A's three drafted risks", () => {
  for (const drafted of uatA) {
    assert.ok(tokenSetSimilarity(riskComparisonText(paymentIntegrity), riskComparisonText(drafted)) < 0.5, drafted.ref);
  }
  assert.deepEqual(classifyProposedRisk(paymentIntegrity, { active: uatA }), { tier: "distinct" });
});

test("a near-identical match names its pool: withdrawn, rejected, open and the same run", () => {
  const pools = { withdrawn: [{ ...offshoreAccess, ref: "risk-withdrawn" }] };
  assert.deepEqual(classifyProposedRisk(candidate(), pools), { tier: "near-identical", against: { kind: "withdrawn", ref: "risk-withdrawn" } });
  assert.deepEqual(classifyProposedRisk(candidate(), { rejected: [{ ...offshoreAccess, ref: "run-1:s-2" }] }), { tier: "near-identical", against: { kind: "rejected", ref: "run-1:s-2" } });
  assert.deepEqual(classifyProposedRisk(candidate(), { open: [{ ...offshoreAccess, ref: "run-2:s-1" }] }), { tier: "near-identical", against: { kind: "open", ref: "run-2:s-1" } });
  assert.deepEqual(classifyProposedRisk(candidate(), { sameRun: [{ ...offshoreAccess, ref: "s-1" }] }), { tier: "near-identical", against: { kind: "sameRun", ref: "s-1" } });
});

test("when near-identical to an active and a withdrawn risk, active wins", () => {
  const verdict = classifyProposedRisk(candidate(), {
    withdrawn: [{ ...offshoreAccess, ref: "risk-withdrawn" }],
    sameRun: [{ ...offshoreAccess, ref: "s-1" }],
    active: [personalInformation, offshoreAccess],
  });
  assert.deepEqual(verdict, { tier: "near-identical", against: { kind: "active", ref: "risk-offshore" } });
});

test("a near-identical match anywhere beats a similar match earlier in the order", () => {
  const verdict = classifyProposedRisk(candidate(), {
    active: [{ ...reworded, ref: "risk-reworded" }],
    rejected: [{ ...offshoreAccess, ref: "run-1:s-3" }],
  });
  assert.deepEqual(verdict, { tier: "near-identical", against: { kind: "rejected", ref: "run-1:s-3" } });
});

test("the highest similar score wins, and an equal score keeps the earlier pool", () => {
  const verdict = classifyProposedRisk(reworded, {
    active: [{ ...offshoreAccess, riskType: "Other" }],
    withdrawn: [{ ...reworded, ref: "risk-closer", riskType: "Other" }],
  });
  assert.deepEqual(verdict, { tier: "similar", against: { kind: "withdrawn", ref: "risk-closer" }, score: 1 });
  const tie = classifyProposedRisk(candidate({ riskType: "Other" }), { active: [{ ...offshoreAccess, ref: "risk-a" }], withdrawn: [{ ...offshoreAccess, ref: "risk-b" }] });
  assert.deepEqual(tie, { tier: "similar", against: { kind: "active", ref: "risk-a" }, score: 1 });
});

test("two proposals with null Risk Types and the same text are near-identical", () => {
  const untyped = candidate({ riskType: null });
  assert.deepEqual(classifyProposedRisk(untyped, { sameRun: [{ ...untyped, ref: "s-1" }] }), { tier: "near-identical", against: { kind: "sameRun", ref: "s-1" } });
});

test("empty pools are distinct", () => {
  assert.deepEqual(classifyProposedRisk(candidate(), {}), { tier: "distinct" });
});

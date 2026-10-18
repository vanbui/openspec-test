import assert from "node:assert/strict";
import test from "node:test";
import { RISK_AI_FIELDS } from "../src/api/csrm-assessment/services/ai-provenance";
import {
  aiAcceptCheck,
  diffIntoUnits,
  FOCUS_PARTS,
  isUnitStale,
  normaliseRiskValues,
  residualRatingAfter,
  RISK_UNIT_DEFINITIONS,
  unitApplyValues,
  type ChangeUnit,
} from "../src/csrm/ai/risk-proposals/field-units";

/*
 * Phase 16 D-34 to D-38 and the approved Phase 16 amendment, "Risk proposal envelope v1": proposed field changes are
 * grouped into units decided together; a unit's base is what the Risk held, and a unit is stale once any of its fields
 * moves. The Accept rule is Phase 12's `acceptProposalAllowed` plus a plan and no planned control, after every unit of
 * the batch, in whatever order they come.
 */
const current = {
  documentId: "risk-1",
  riskType: { documentId: "type-privileged-access", name: "Privileged Access" },
  issueStatement: "Administrators in an offshore support centre hold standing access to the payroll platform.",
  riskStatement: "Offshore administrators can reach payroll data. ",
  riskCategory: "Cyber security",
  riskSubCategory: "Privileged access",
  riskCause: "Shared administrator accounts.",
  potentialImpact: "Payroll data could be disclosed.",
  informationSystemImpacted: { documentId: "system-payroll", name: "Payroll" },
  informationAssetImpacted: null,
  dataClassification: null,
  inherentLikelihood: "Likely",
  highestInherentConsequence: "Major",
  inherentRating: "High",
  inherentRatingRationale: "Standing privileged access is a material exposure.",
  residualLikelihood: "Possible",
  highestResidualConsequence: "Moderate",
  residualRating: "Moderate",
  residualRatingRationale: "Exposure remains until sessions are recorded.",
  treatmentAction: "Treat",
  treatmentPlan: "Replace shared accounts with named accounts.",
  riskOwner: { documentId: "user-ann" },
  treatmentStatus: "Not Started",
  comments: "Raised at intake.",
};

/* What a rewrite proposes: the twenty AI-writable fields, relations as documentIds. */
const proposedFrom = (changes: Record<string, unknown>): Record<string, unknown> => ({
  ...Object.fromEntries(RISK_AI_FIELDS.map((field) => [field, normaliseRiskValues(current, [field])[field]])),
  ...changes,
});

const keysOf = (units: readonly ChangeUnit[]) => units.map((unit) => unit.key);

test("the units cover each AI-writable field once, with the Accept unit holding action and plan", () => {
  const separate = Object.entries(RISK_UNIT_DEFINITIONS).filter(([key]) => key !== "u-treatment").flatMap(([, definition]) => definition.fields);
  assert.deepEqual([...separate].sort(), [...RISK_AI_FIELDS].sort());
  assert.equal(new Set(separate).size, separate.length);
  assert.deepEqual([...RISK_UNIT_DEFINITIONS["u-treatment"].fields], ["treatmentAction", "treatmentPlan"]);
  assert.deepEqual([...RISK_UNIT_DEFINITIONS["u-residual-rating"].fields], ["residualLikelihood", "highestResidualConsequence", "residualRating"]);
  assert.deepEqual([...RISK_UNIT_DEFINITIONS["u-information-asset"].fields], ["informationAssetImpacted", "dataClassification"]);
  const every = Object.values(RISK_UNIT_DEFINITIONS).flatMap((definition) => definition.fields as readonly string[]);
  for (const field of ["riskOwner", "identifiedDate", "targetDate", "treatmentStatus", "treatmentOwner", "isExempted", "exemptionReviewDate", "escalationDetails", "comments", "controlEffectiveness", "riskVelocity"]) {
    assert.ok(!every.includes(field), `${field} must be in no unit`);
  }
  assert.deepEqual([...FOCUS_PARTS], ["statement", "ratings", "treatment"]);
  for (const definition of Object.values(RISK_UNIT_DEFINITIONS)) assert.ok(FOCUS_PARTS.includes(definition.focus));
});

test("base values are normalised as the update path stores them", () => {
  assert.deepEqual(normaliseRiskValues({ riskStatement: " Text " }, ["riskStatement"]), { riskStatement: "Text" });
  assert.deepEqual(normaliseRiskValues({ riskType: { documentId: "type-1", name: "Type" } }, ["riskType"]), { riskType: "type-1" });
  assert.deepEqual(normaliseRiskValues({ riskType: "type-1" }, ["riskType"]), { riskType: "type-1" });
  assert.deepEqual(normaliseRiskValues({ riskCause: "  " }, ["riskCause", "potentialImpact"]), { riskCause: null, potentialImpact: null });
  const { units } = diffIntoUnits(current, proposedFrom({ riskStatement: "Offshore administrators can reach payroll data.", riskType: "type-privileged-access" }));
  assert.deepEqual(units, [], "A_TRIMMED_STRING_OR_A_RELATION_BY_ID_WAS_A_CHANGE");
});

test("a proposal changing the statement, the cause and the residual likelihood gives three units and drops the rest", () => {
  const { units, adjustments, dropped } = diffIntoUnits(current, proposedFrom({
    riskStatement: "Offshore administrators with standing access could change payroll data without detection.",
    riskCause: "Shared administrator accounts are used without session recording.",
    residualLikelihood: "Likely",
  }));
  assert.deepEqual(keysOf(units), ["u-risk-statement", "u-risk-cause", "u-residual-rating"]);
  const residual = units[2];
  assert.deepEqual(residual.fields, ["residualLikelihood", "highestResidualConsequence", "residualRating"]);
  assert.deepEqual(residual.base, { residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate" });
  assert.deepEqual(residual.proposed, { residualLikelihood: "Likely", highestResidualConsequence: "Moderate", residualRating: "High" }, "THE_RATING_IS_DERIVED");
  assert.equal(units[0].base.riskStatement, "Offshore administrators can reach payroll data.");
  assert.ok(dropped.every((entry) => entry.code === "no-change"));
  assert.equal(dropped.length, 12);
  assert.deepEqual(adjustments.map((adjustment) => [adjustment.code, adjustment.count]), [["no-change", 12]]);
});

test("with focus ratings, the statement units are dropped as outside the focus", () => {
  const { units, dropped, adjustments } = diffIntoUnits(current, proposedFrom({
    riskStatement: "Offshore administrators with standing access could change payroll data without detection.",
    riskCause: "Shared administrator accounts are used without session recording.",
    residualLikelihood: "Likely",
  }), { focus: ["ratings"] });
  assert.deepEqual(keysOf(units), ["u-residual-rating"]);
  assert.deepEqual(dropped.filter((entry) => entry.code === "outside-focus").map((entry) => entry.key), ["u-risk-statement", "u-risk-cause"]);
  assert.deepEqual(adjustments.find((adjustment) => adjustment.code === "outside-focus")?.count, 2);
});

test("a change from Treat to Accept travels with its plan, and a plan change alone is its own unit", () => {
  const accept = diffIntoUnits(current, proposedFrom({ treatmentAction: "Accept" }));
  assert.deepEqual(keysOf(accept.units), ["u-treatment"]);
  assert.deepEqual(accept.units[0].fields, ["treatmentAction", "treatmentPlan"]);
  assert.deepEqual(accept.units[0].proposed, { treatmentAction: "Accept", treatmentPlan: "Replace shared accounts with named accounts." });
  assert.equal(accept.units[0].aiAccept, true);
  const plan = diffIntoUnits(current, proposedFrom({ treatmentPlan: "Record every privileged session." }));
  assert.deepEqual(keysOf(plan.units), ["u-treatment-plan"]);
  assert.equal(plan.units[0].aiAccept, undefined);
  const backToTreat = diffIntoUnits({ ...current, treatmentAction: "Accept" }, proposedFrom({ treatmentAction: "Treat", treatmentPlan: "Record every privileged session." }));
  assert.deepEqual(keysOf(backToTreat.units), ["u-treatment-action", "u-treatment-plan"]);
});

test("a unit is stale exactly when one of its fields no longer holds its base", () => {
  const { units } = diffIntoUnits(current, proposedFrom({ residualLikelihood: "Likely", riskStatement: "A new statement of the risk." }));
  const [statement, residual] = units;
  assert.equal(isUnitStale(statement, current), false);
  assert.equal(isUnitStale(residual, current), false);
  assert.equal(isUnitStale(statement, { ...current, riskStatement: "  Offshore administrators can reach payroll data." }), false, "WHITESPACE_IS_NOT_A_MOVE");
  assert.equal(isUnitStale(residual, { ...current, highestResidualConsequence: "Major", residualRating: "High" }), true);
  assert.equal(isUnitStale(residual, { ...current, riskStatement: "Changed elsewhere." }), false);
  assert.equal(isUnitStale(statement, { ...current, riskStatement: "Changed by an analyst." }), true);
});

test("applying a unit writes its proposed values", () => {
  const { units } = diffIntoUnits(current, proposedFrom({ informationAssetImpacted: "asset-payroll-records", dataClassification: "Restricted" }));
  assert.deepEqual(keysOf(units), ["u-information-asset"]);
  assert.deepEqual(unitApplyValues(units[0]), { informationAssetImpacted: "asset-payroll-records", dataClassification: "Restricted" });
});

test("the Accept rule: no Accept on a High or Critical residual, without a plan, or with a planned control", () => {
  assert.equal(aiAcceptCheck({ residualRating: "High", plan: "Accept and review.", hasPlannedControl: false }), "accept-not-permitted");
  assert.equal(aiAcceptCheck({ residualRating: "Critical", plan: "Accept and review.", hasPlannedControl: false }), "accept-not-permitted");
  assert.equal(aiAcceptCheck({ residualRating: "Moderate", plan: "   ", hasPlannedControl: false }), "accept-not-permitted");
  assert.equal(aiAcceptCheck({ residualRating: "Moderate", plan: null, hasPlannedControl: false }), "accept-not-permitted");
  assert.equal(aiAcceptCheck({ residualRating: null, plan: "Accept and review.", hasPlannedControl: false }), "accept-not-permitted");
  assert.equal(aiAcceptCheck({ residualRating: "Moderate", plan: "Accept and review.", hasPlannedControl: true }), "accept-with-planned-control");
  assert.equal(aiAcceptCheck({ residualRating: "Moderate", plan: "Accept and review.", hasPlannedControl: false }), null);
  assert.equal(aiAcceptCheck({ residualRating: "Low", plan: "Accept and review.", hasPlannedControl: false }), null);
});

test("a residual unit to High and an Accept unit are refused together in either order", () => {
  const residual = diffIntoUnits(current, proposedFrom({ residualLikelihood: "Likely", highestResidualConsequence: "Major" })).units[0];
  const accept = diffIntoUnits(current, proposedFrom({ treatmentAction: "Accept", treatmentPlan: "Accept the residual risk and review it in six months." })).units[0];
  assert.equal(residual.key, "u-residual-rating");
  assert.equal(accept.key, "u-treatment");
  assert.equal(residualRatingAfter(current, []), "Moderate");
  assert.equal(residualRatingAfter(current, [accept]), "Moderate");
  for (const order of [[residual, accept], [accept, residual]]) {
    const residualRating = residualRatingAfter(current, order);
    assert.equal(residualRating, "High");
    assert.equal(aiAcceptCheck({ residualRating, plan: accept.proposed.treatmentPlan, hasPlannedControl: false }), "accept-not-permitted");
  }
  assert.equal(aiAcceptCheck({ residualRating: residualRatingAfter(current, [accept]), plan: accept.proposed.treatmentPlan, hasPlannedControl: false }), null);
});

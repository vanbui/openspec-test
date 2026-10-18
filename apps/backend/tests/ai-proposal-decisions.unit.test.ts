import assert from "node:assert/strict";
import test from "node:test";

import { parseAiProposalDecisionBatch, riskHasPlannedControl } from "../src/api/csrm-assessment/services/ai-proposal-decisions";
import { AssessmentWorkflowError } from "../src/api/csrm-assessment/services/assessment-workflow";

const risk = { kind: "risk", riskId: "risk-1" } as const;

function refused(decision: unknown, name: string): void {
  assert.throws(
    () => parseAiProposalDecisionBatch({ decisions: [decision] }),
    (error: unknown) => error instanceof AssessmentWorkflowError && error.status === 400 && error.message === "Proposal decision data is invalid.",
    name,
  );
}

/*
 * WR-106: the decision's action and its target's kind are closed string enumerations, read as given. `String(["accept"])`
 * is "accept", so a coerced check let an array through, which the suggestion table then read as a restore.
 */
test("a decision's action and target kind must be one of their closed strings, never a value that coerces to one", () => {
  for (const action of [["accept"], ["restore"], ["dismiss"], {}, 1, true, null, "Accept", " accept"]) {
    refused({ target: risk, action, fields: ["riskStatement"] }, `field action ${JSON.stringify(action)}`);
    refused({ target: risk, action, suggestion: "suggestion-1" }, `suggestion action ${JSON.stringify(action)}`);
  }
  for (const kind of [["risk"], ["assessment"], {}, 1, null, "Risk"]) {
    refused({ target: { ...risk, kind }, action: "accept", fields: ["riskStatement"] }, `risk kind ${JSON.stringify(kind)}`);
    refused({ target: { kind }, action: "accept", fields: ["summary"] }, `assessment kind ${JSON.stringify(kind)}`);
  }
  assert.deepEqual(parseAiProposalDecisionBatch({ decisions: [
    { target: risk, action: "accept", fields: ["riskStatement"] },
    { target: { kind: "assessment" }, action: "accept", fields: ["summary"] },
    { target: risk, action: "dismiss", suggestion: "suggestion-1" },
  ] }), [
    { target: risk, action: "accept", fields: ["riskStatement"] },
    { target: { kind: "assessment" }, action: "accept", fields: ["summary"] },
    { target: risk, action: "dismiss", suggestion: "suggestion-1" },
  ]);
});

/*
 * WR-102: an accept without fields is "Confirm remaining" (the fields still proposed). A restore without fields named
 * no field it could restore (it read the proposed ones, which a restore never changes), so a field restore names its
 * fields, as the editor's Undo always does; a suggestion restore names its suggestion.
 */
test("a field restore names the fields it restores, while an accept may leave them out to confirm what remains", () => {
  refused({ target: risk, action: "restore" }, "risk restore without fields");
  refused({ target: { kind: "assessment" }, action: "restore" }, "assessment restore without fields");
  refused({ target: risk, action: "dismiss" }, "dismissal without a suggestion");
  assert.deepEqual(parseAiProposalDecisionBatch({ decisions: [
    { target: risk, action: "accept" },
    { target: { kind: "assessment" }, action: "accept" },
    { target: risk, action: "restore", fields: ["riskStatement", "treatmentAction"] },
    { target: risk, action: "restore", suggestion: "suggestion-1" },
  ] }), [
    { target: risk, action: "accept" },
    { target: { kind: "assessment" }, action: "accept" },
    { target: risk, action: "restore", fields: ["riskStatement", "treatmentAction"] },
    { target: risk, action: "restore", suggestion: "suggestion-1" },
  ]);
});

/*
 * G-14 (2026-10-01 confirmation): only a Planned control blocks confirming an AI-proposed Accept. An Existing,
 * Implemented or Retired control is not refused, and a malformed implementation row never counts as Planned.
 */
test("only a Planned control implementation blocks an AI Accept; Existing, Implemented and Retired do not", () => {
  assert.equal(riskHasPlannedControl([]), false, "NO_CONTROL_COUNTED_AS_PLANNED");
  for (const controlStatus of ["Existing", "Implemented", "Retired"]) {
    assert.equal(riskHasPlannedControl([{ controlStatus }]), false, `${controlStatus.toUpperCase()}_REFUSED_AS_PLANNED`);
  }
  assert.equal(riskHasPlannedControl([{ controlStatus: "Existing" }, { controlStatus: "Planned" }]), true, "PLANNED_BESIDE_EXISTING_NOT_REFUSED");
  assert.equal(riskHasPlannedControl([{ controlStatus: "planned" }, null, "Planned"]), false, "MALFORMED_ROW_COUNTED_AS_PLANNED");
});

/*
 * Phase 16 D-39: the run-scoped entry is closed per target kind. `reject` and a reason belong to it alone, `dismiss`
 * stays with Phase 12's suggested controls, and a reason is trimmed to 1 to 500 characters on a rejection only.
 */
test("a proposal decision names a run and an item key, takes accept, reject or restore, and a reason only on a rejection", () => {
  const target = { kind: "proposal", runId: "run-1", item: "s-1" } as const;
  assert.deepEqual(parseAiProposalDecisionBatch({ decisions: [
    { target, action: "accept" },
    { target: { ...target, item: "u-risk-statement" }, action: "reject", reason: "  Not this risk.  " },
    { target: { ...target, item: "u-residual-rating" }, action: "restore" },
    { target: risk, action: "accept", fields: ["riskStatement"] },
  ] }), [
    { target, action: "accept" },
    { target: { ...target, item: "u-risk-statement" }, action: "reject", reason: "Not this risk." },
    { target: { ...target, item: "u-residual-rating" }, action: "restore" },
    { target: risk, action: "accept", fields: ["riskStatement"] },
  ]);
  refused({ target, action: "dismiss" }, "dismiss on a proposal");
  refused({ target: risk, action: "reject", fields: ["riskStatement"] }, "reject on a field");
  refused({ target: risk, action: "dismiss", suggestion: "suggestion-1", reason: "No" }, "reason on a suggestion");
  refused({ target, action: "accept", reason: "No" }, "reason on an accept");
  refused({ target, action: "reject", reason: "x".repeat(501) }, "a reason of 501 characters");
  refused({ target, action: "reject", reason: "   " }, "a blank reason");
  refused({ target, action: "reject", reason: ["No"] }, "a reason that is not a string");
  refused({ target, action: "accept", fields: ["riskStatement"] }, "fields on a proposal");
  for (const item of ["s-0", "s-9", "i-1", "u-", "U-risk-statement", "u-risk_statement", ["s-1"], 1]) refused({ target: { ...target, item }, action: "accept" }, `item ${JSON.stringify(item)}`);
  for (const runId of ["", "x".repeat(256), 1, null]) refused({ target: { ...target, runId }, action: "accept" }, `run ${JSON.stringify(runId)}`);
  refused({ target: { ...target, extra: true }, action: "accept" }, "an extra target key");
  for (const action of ["Accept", ["accept"], "confirm"]) refused({ target, action }, `action ${JSON.stringify(action)}`);
  assert.equal(parseAiProposalDecisionBatch({ decisions: [{ target, action: "reject", reason: "x".repeat(500) }] }).length, 1);
});

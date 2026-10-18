import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_RISK_FILTER,
  activeRiskSql,
  activeRisks,
  isActiveRisk,
  WITHDRAWN_RISK_FILTER,
  withdrawnRiskSql,
} from "../src/csrm/active-risk";
import {
  parseRiskCurationBody,
  partitionReinstatement,
  partitionWithdrawal,
  RISK_CURATION_BATCH_MAX,
  RiskCurationBodyError,
  UNDO_WITHDRAWAL_REASON,
} from "../src/csrm/risk-curation-rules";
import { parseReasonText, parseRevertReason, REVERT_REASON_MAX_LENGTH } from "../src/api/csrm-assessment-request/services/revert-reason";

/*
 * Phase 16 D-05 and D-13 (the approved record, "Readers and the Active-Risk Rule"): a Risk is active exactly when
 * `withdrawnAt` is null or absent. The rule exists once, in the three forms its readers need.
 */
test("a risk is active exactly when withdrawnAt is null or absent", () => {
  assert.equal(isActiveRisk({ withdrawnAt: null }), true);
  assert.equal(isActiveRisk({}), true);
  assert.equal(isActiveRisk({ withdrawnAt: undefined }), true);
  assert.equal(isActiveRisk({ withdrawnAt: "2026-10-01T00:00:00.000Z" }), false);
  assert.equal(isActiveRisk(null), false);
  assert.equal(isActiveRisk(undefined), false);
  assert.equal(isActiveRisk("x"), false);
  assert.equal(isActiveRisk(7), false);
});

test("activeRisks keeps the order and returns a new array", () => {
  const risks = [
    { documentId: "a", withdrawnAt: null },
    { documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" },
    { documentId: "c" },
  ];
  const active = activeRisks(risks);
  assert.deepEqual(active.map((risk) => risk.documentId), ["a", "c"]);
  assert.notEqual(active, risks);
  const allActive = [{ documentId: "a" }];
  assert.notEqual(activeRisks(allActive), allActive);
  assert.equal(risks.length, 3);
});

test("the document filters select active and withdrawn risks and are frozen", () => {
  assert.deepEqual(ACTIVE_RISK_FILTER, { withdrawnAt: { $null: true } });
  assert.deepEqual(WITHDRAWN_RISK_FILTER, { withdrawnAt: { $notNull: true } });
  assert.ok(Object.isFrozen(ACTIVE_RISK_FILTER));
  assert.ok(Object.isFrozen(ACTIVE_RISK_FILTER.withdrawnAt));
  assert.ok(Object.isFrozen(WITHDRAWN_RISK_FILTER));
  assert.ok(Object.isFrozen(WITHDRAWN_RISK_FILTER.withdrawnAt));
});

test("the SQL fragment names the alias and refuses an unsafe alias", () => {
  assert.equal(activeRiskSql("r"), "r.withdrawn_at IS NULL");
  assert.equal(activeRiskSql("csrm_risks"), "csrm_risks.withdrawn_at IS NULL");
  for (const alias of ["r; drop", "", "R", "1r", "r.x", "a".repeat(32), "r -- x"]) {
    assert.throws(() => activeRiskSql(alias), `alias ${JSON.stringify(alias)} must be refused`);
  }
});

/* BE1-06: the register's Withdrawn branch reads the rule's own SQL form, with the same alias check. */
test("the withdrawn SQL fragment names the alias and refuses an unsafe alias (BE1-06)", () => {
  assert.equal(withdrawnRiskSql("r"), "r.withdrawn_at IS NOT NULL");
  for (const alias of ["r; drop", "", "R", "1r", "r.x", "a".repeat(32), "r -- x"]) {
    assert.throws(() => withdrawnRiskSql(alias), `alias ${JSON.stringify(alias)} must be refused`);
  }
});

/* D-06: the curation reason goes through the revert reason's own bound. */
test("parseReasonText trims and bounds the reason like the revert reasons", () => {
  assert.equal(parseReasonText("  Wrong type  "), "Wrong type");
  assert.equal(REVERT_REASON_MAX_LENGTH, 500);
  assert.equal(parseReasonText("x".repeat(500)), "x".repeat(500));
  assert.equal(parseReasonText(` ${"x".repeat(500)} `), "x".repeat(500));
  assert.equal(parseReasonText("x".repeat(501)), null);
  assert.equal(parseReasonText(""), null);
  assert.equal(parseReasonText("   \n\t "), null);
  assert.equal(parseReasonText(42), null);
  assert.equal(parseReasonText(null), null);
  assert.equal(parseReasonText(undefined), null);
});

test("parseRevertReason keeps its one-key rule and its exact messages", () => {
  assert.equal(parseRevertReason({ reason: "  Correct data  " }, "CSRM request"), "Correct data");
  assert.throws(() => parseRevertReason({ reason: "ok", extra: 1 }, "CSRM request"), { message: "CSRM request reversal data is invalid." });
  assert.throws(() => parseRevertReason({ reason: 5 }, "CSRM request"), { message: "CSRM request reversal data is invalid." });
  assert.throws(() => parseRevertReason(null, "CSRM request"), { message: "CSRM request reversal data is invalid." });
  assert.throws(() => parseRevertReason({ reason: "   " }, "CSRM request"), { message: "CSRM request reversal reason is invalid." });
  assert.throws(() => parseRevertReason({ reason: "x".repeat(501) }, "CSRM request"), { message: "CSRM request reversal reason is invalid." });
});

/* D-09, D-11 and the record's "The curation body": closed, reason or `undo: true`, never both. */
test("the curation body parses a reason or an undo", () => {
  assert.deepEqual(parseRiskCurationBody({ riskIds: ["a"], reason: "Duplicate" }), { riskIds: ["a"], mode: "reason", reason: "Duplicate" });
  assert.deepEqual(parseRiskCurationBody({ riskIds: ["a", "b"], undo: true }), { riskIds: ["a", "b"], mode: "undo" });
  assert.deepEqual(parseRiskCurationBody({ riskIds: ["a"], reason: "  Wrong type " }), { riskIds: ["a"], mode: "reason", reason: "Wrong type" });
  const max = Array.from({ length: RISK_CURATION_BATCH_MAX }, (_, index) => `risk-${index}`);
  assert.equal(RISK_CURATION_BATCH_MAX, 200);
  assert.equal(parseRiskCurationBody({ riskIds: max, undo: true }).riskIds.length, 200);
  assert.equal(parseRiskCurationBody({ riskIds: ["x".repeat(255)], undo: true }).riskIds[0].length, 255);
});

test("the curation body refuses everything else with a safe 400 error", () => {
  const refused: unknown[] = [
    { riskIds: ["a", "a"], reason: "Duplicate" },
    { riskIds: [], reason: "Duplicate" },
    { riskIds: Array.from({ length: 201 }, (_, index) => `risk-${index}`), reason: "Duplicate" },
    { riskIds: ["x".repeat(256)], reason: "Duplicate" },
    { riskIds: [""], reason: "Duplicate" },
    { riskIds: [7], reason: "Duplicate" },
    { riskIds: "a", reason: "Duplicate" },
    { riskIds: ["a"], reason: "Duplicate", undo: true },
    { riskIds: ["a"], undo: false },
    { riskIds: ["a"], undo: "true" },
    { riskIds: ["a"], reason: "Duplicate", note: "x" },
    { riskIds: ["a"], reason: "x".repeat(501) },
    { riskIds: ["a"], reason: "   " },
    { riskIds: ["a"] },
    { reason: "Duplicate" },
    null,
    [],
    "riskIds",
  ];
  for (const body of refused) {
    assert.throws(() => parseRiskCurationBody(body), (error: unknown) => {
      assert.ok(error instanceof RiskCurationBodyError, `body ${JSON.stringify(body)?.slice(0, 80)} must throw RiskCurationBodyError`);
      assert.equal(error.status, 400);
      assert.match(error.message, /^CSRM risk curation (data|reason) is invalid\.$/);
      return true;
    });
  }
});

test("a typed reason is never an undo, and the undo reason is fixed", () => {
  assert.equal(UNDO_WITHDRAWAL_REASON, "Withdrawal undone");
  assert.deepEqual(parseRiskCurationBody({ riskIds: ["a"], reason: "Withdrawal undone" }), { riskIds: ["a"], mode: "reason", reason: "Withdrawal undone" });
});

/* D-09, D-10 and the record's "Batch rules". */
test("withdrawing reports an already withdrawn risk as unchanged", () => {
  assert.deepEqual(partitionWithdrawal([
    { documentId: "a", withdrawnAt: null },
    { documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" },
    { documentId: "c" },
  ]), { applied: ["a", "c"], unchanged: ["b"] });
  assert.deepEqual(partitionWithdrawal([{ documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" }]), { applied: [], unchanged: ["b"] });
});

test("the partition follows the request's order when it is given", () => {
  assert.deepEqual(partitionWithdrawal([
    { documentId: "a", withdrawnAt: null },
    { documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" },
    { documentId: "c", withdrawnAt: null },
  ], ["c", "b", "a"]), { applied: ["c", "a"], unchanged: ["b"] });
});

test("reinstating refuses when every named risk is active and reports active risks of a mixed batch as unchanged", () => {
  assert.deepEqual(partitionReinstatement([
    { documentId: "a", withdrawnAt: null },
    { documentId: "b" },
  ]), { refusal: "RISK_NOT_WITHDRAWN" });
  assert.deepEqual(partitionReinstatement([
    { documentId: "a", withdrawnAt: null },
    { documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" },
  ]), { applied: ["b"], unchanged: ["a"] });
  assert.deepEqual(partitionReinstatement([
    { documentId: "b", withdrawnAt: "2026-10-01T00:00:00.000Z" },
  ]), { applied: ["b"], unchanged: [] });
});

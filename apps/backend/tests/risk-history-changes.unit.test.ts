import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRiskHistoryChanges,
  CONTROL_IMPLEMENTATION_HISTORY_FIELDS,
  controlImplementationChanges,
  normaliseHistoryValue,
  parseRiskHistoryChanges,
  RISK_HISTORY_CHANGES_SCHEMA_VERSION,
  RISK_HISTORY_KINDS,
  RISK_HISTORY_MAX_FIELDS,
  RISK_HISTORY_SOURCES,
  riskChanges,
  type RiskHistoryFieldChange,
} from "../src/csrm/risk-history-changes";

/*
 * Phase 16 D-18 and D-19 (the approved record, "Risk History"): one row per change, listing only the fields whose
 * value changed after the update path's own normalisation, in a closed, versioned change envelope that a read path
 * parses without ever throwing.
 */
test("the history kinds and sources are the record's closed lists", () => {
  assert.deepEqual([...RISK_HISTORY_KINDS], [
    "created",
    "updated",
    "withdrawn",
    "reinstated",
    "control-implementation-added",
    "control-implementation-updated",
    "control-implementation-removed",
  ]);
  assert.deepEqual([...RISK_HISTORY_SOURCES], ["analyst", "ai-run"]);
  assert.ok(Object.isFrozen(RISK_HISTORY_KINDS));
  assert.ok(Object.isFrozen(RISK_HISTORY_SOURCES));
  assert.equal(RISK_HISTORY_CHANGES_SCHEMA_VERSION, 1);
  assert.equal(RISK_HISTORY_MAX_FIELDS, 40);
});

const RISK_FIELDS = ["riskStatement", "riskCause", "riskOwner", "riskType", "inherentRating", "identifiedDate", "isExempted"] as const;

const before = {
  riskStatement: "Offshore administrators can reach payroll data ",
  riskCause: "Shared administrator accounts",
  riskOwner: { id: 4, documentId: "user-ann", displayName: "Ann Analyst" },
  riskType: { documentId: "type-confidentiality", name: "Confidentiality" },
  inherentRating: "High",
  identifiedDate: "2026-10-01",
  isExempted: false,
};

const labels: Record<string, string> = {
  "user-ann": "Ann Analyst",
  "user-bob": "Bob Builder",
  "type-confidentiality": "Confidentiality",
};
const relationLabel = (_field: string, documentId: string) => labels[documentId] ?? null;

test("riskChanges lists only the fields whose normalised value differs, a relation as documentId and label", () => {
  const after = {
    riskStatement: "Offshore administrators can reach and change payroll data",
    riskCause: "  Shared administrator accounts  ",
    riskOwner: "user-bob",
    riskType: "type-confidentiality",
    inherentRating: "High",
    identifiedDate: "2026-10-01",
    isExempted: false,
  };
  assert.deepEqual(riskChanges(before, after, RISK_FIELDS, { relationLabel }), [
    { field: "riskStatement", from: "Offshore administrators can reach payroll data", to: "Offshore administrators can reach and change payroll data" },
    { field: "riskOwner", from: { documentId: "user-ann", label: "Ann Analyst" }, to: { documentId: "user-bob", label: "Bob Builder" } },
  ]);
});

test("trailing spaces on one side only are not a change, and identical inputs give no changes", () => {
  const after = { ...before, riskStatement: "Offshore administrators can reach payroll data" };
  assert.deepEqual(riskChanges(before, after, RISK_FIELDS, { relationLabel }), []);
  assert.deepEqual(riskChanges(before, { ...before }, RISK_FIELDS, { relationLabel }), []);
});

test("an empty string and an absent value both read as null", () => {
  assert.deepEqual(riskChanges({ riskCause: "" }, { riskCause: null }, ["riskCause"]), []);
  assert.deepEqual(riskChanges({ riskCause: "  " }, {}, ["riskCause"]), []);
  assert.deepEqual(riskChanges({}, { riskCause: "Shared accounts" }, ["riskCause"]), [{ field: "riskCause", from: null, to: "Shared accounts" }]);
});

test("changes follow the order of the fields named and ignore every other field", () => {
  const changes = riskChanges(
    { riskCause: "a", riskStatement: "b", comments: "c" },
    { riskCause: "x", riskStatement: "y", comments: "z" },
    ["riskStatement", "riskCause"],
  );
  assert.deepEqual(changes.map((change) => change.field), ["riskStatement", "riskCause"]);
});

test("the label falls back to the related record's own name, and to null when none is known", () => {
  assert.deepEqual(riskChanges({ riskType: null }, { riskType: { documentId: "type-integrity", name: "Integrity" } }, ["riskType"]), [
    { field: "riskType", from: null, to: { documentId: "type-integrity", label: "Integrity" } },
  ]);
  assert.deepEqual(riskChanges({ riskType: null }, { riskType: "type-unknown" }, ["riskType"]), [
    { field: "riskType", from: null, to: { documentId: "type-unknown", label: null } },
  ]);
});

test("dates are compared as YYYY-MM-DD strings", () => {
  assert.equal(normaliseHistoryValue("identifiedDate", new Date("2026-10-01T00:00:00.000Z")), "2026-10-01");
  assert.equal(normaliseHistoryValue("identifiedDate", "2026-10-01"), "2026-10-01");
  assert.deepEqual(riskChanges({ identifiedDate: new Date("2026-10-01T00:00:00.000Z") }, { identifiedDate: "2026-10-01" }, ["identifiedDate"]), []);
});

const control = { documentId: "ci-1", controlNumber: "CTL-0007", name: "Privileged access review" };

const implementation = {
  control: { documentId: "control-7", name: "Privileged access review" },
  controlOwner: { documentId: "user-ann", displayName: "Ann Analyst" },
  controlStatus: "Implemented",
  effectivenessRating: "Effective",
  evidence: "Quarterly review minutes",
  implementationDueDate: "2026-11-01",
  implementedDate: "2026-10-20",
  reviewDate: "2027-01-15",
};

test("a removed control implementation keeps every value with to null", () => {
  const changes = controlImplementationChanges(implementation, null, { relationLabel });
  assert.deepEqual(changes.map((change) => change.field), [...CONTROL_IMPLEMENTATION_HISTORY_FIELDS]);
  for (const change of changes) assert.equal(change.to, null);
  assert.deepEqual(changes[0], { field: "control", from: { documentId: "control-7", label: "Privileged access review" }, to: null });
  assert.deepEqual(changes[1], { field: "controlOwner", from: { documentId: "user-ann", label: "Ann Analyst" }, to: null });
});

test("an added control implementation lists its values with from null, and an update only what changed", () => {
  const added = controlImplementationChanges(null, implementation, { relationLabel });
  assert.equal(added.length, CONTROL_IMPLEMENTATION_HISTORY_FIELDS.length);
  for (const change of added) assert.equal(change.from, null);
  assert.deepEqual(controlImplementationChanges(implementation, { ...implementation, controlStatus: "Retired", evidence: "Quarterly review minutes " }), [
    { field: "controlStatus", from: "Implemented", to: "Retired" },
  ]);
  assert.deepEqual(controlImplementationChanges(null, null), []);
});

test("a built envelope round-trips deep-equal through the closed parser", () => {
  const fields: RiskHistoryFieldChange[] = [
    { field: "riskStatement", from: "Old", to: "New" },
    { field: "riskOwner", from: { documentId: "user-ann", label: "Ann Analyst" }, to: null },
    { field: "isExempted", from: false, to: true },
    { field: "inherentLikelihood", from: null, to: "Likely" },
  ];
  const built = buildRiskHistoryChanges({ fields });
  assert.deepEqual(built, { schemaVersion: 1, fields });
  assert.deepEqual(parseRiskHistoryChanges(JSON.parse(JSON.stringify(built))), built);
  const withControl = buildRiskHistoryChanges({ fields: controlImplementationChanges(implementation, null, { relationLabel }), control });
  assert.deepEqual(parseRiskHistoryChanges(JSON.parse(JSON.stringify(withControl))), withControl);
  const empty = buildRiskHistoryChanges({ fields: [] });
  assert.deepEqual(parseRiskHistoryChanges(empty), { schemaVersion: 1, fields: [] });
  const parsed = parseRiskHistoryChanges(JSON.parse(JSON.stringify(withControl)));
  assert.ok(parsed && Object.isFrozen(parsed) && Object.isFrozen(parsed.fields));
});

test("the parser returns null on anything else and never throws", () => {
  const fortyOne = Array.from({ length: 41 }, (_, index) => ({ field: `field${index}`, from: null, to: "x" }));
  const malformed: unknown[] = [
    { schemaVersion: 2, fields: [] },
    { schemaVersion: 1, fields: [], extra: true },
    { schemaVersion: 1, fields: fortyOne },
    { schemaVersion: 1 },
    { schemaVersion: 1, fields: [{ field: "riskStatement", from: "a" }] },
    { schemaVersion: 1, fields: [{ field: "riskStatement", from: "a", to: "b", note: 1 }] },
    { schemaVersion: 1, fields: [{ field: "riskStatement", from: { documentId: "x" }, to: null }] },
    { schemaVersion: 1, fields: [{ field: "riskStatement", from: [1], to: null }] },
    { schemaVersion: 1, fields: [{ field: "", from: null, to: null }] },
    { schemaVersion: 1, fields: [], control: { documentId: "ci-1", controlNumber: "CTL-1" } },
    { schemaVersion: 1, fields: [], control: null },
    null,
    undefined,
    "changes",
    42,
    [],
  ];
  for (const value of malformed) {
    assert.doesNotThrow(() => parseRiskHistoryChanges(value));
    assert.equal(parseRiskHistoryChanges(value), null, `value ${JSON.stringify(value)?.slice(0, 80)} must not parse`);
  }
  const hostile = { schemaVersion: 1, get fields(): never { throw new Error("boom"); } };
  assert.equal(parseRiskHistoryChanges(hostile), null);
});

test("the builder refuses more than forty fields and malformed changes", () => {
  const fortyOne = Array.from({ length: 41 }, (_, index) => ({ field: `field${index}`, from: null, to: "x" }));
  assert.throws(() => buildRiskHistoryChanges({ fields: fortyOne }));
  assert.equal(buildRiskHistoryChanges({ fields: fortyOne.slice(0, 40) }).fields.length, 40);
  assert.throws(() => buildRiskHistoryChanges({ fields: [{ field: "riskStatement", from: "a", to: "b" }, { field: "riskStatement", from: "b", to: "c" }] }));
  assert.throws(() => buildRiskHistoryChanges({ fields: [], control: { documentId: "", controlNumber: "CTL-1", name: "x" } }));
});

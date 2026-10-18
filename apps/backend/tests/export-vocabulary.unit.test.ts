import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { ADMINISTRATION_CSV_CONTRACTS } from "../src/api/csrm-administration/services/csv-import";
import { RISK_REGISTER_STATES } from "../src/api/csrm-risk/services/risk-register-query";
import { registeredExportViews } from "../src/csrm/exports/export-views";
import {
  EXPORT_VOCABULARY,
  exportLabel,
  exportTableColumns,
  exportViewColumns,
  importColumns,
  parseExportVocabulary,
} from "../src/csrm/exports/export-vocabulary";

/*
 * The one export vocabulary (19-04; D-06, D-07, D-31, D-33). Strapi validates it at load; these tests pin its shape:
 * the 12 list views, the released assessment's tables, the four reports, the four import collections mirroring the
 * administration CSV contracts field for field, and the ten label families. The web's copy and its label parity are
 * proven in apps/csrm/src/features/exports/export-vocabulary.test.ts.
 */

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const vocabularyPath = path.resolve(__dirname, "..", "..", "..", "src", "csrm", "exports", "export-vocabulary.json");
const raw = JSON.parse(readFileSync(vocabularyPath, "utf8")) as Record<string, unknown>;

const LIST_VIEWS = [
  "risk-register", "requests", "questionnaires", "alerts", "risk-assessments", "my-requests", "my-questionnaires",
  "my-risk-assessments", "risk-types", "controls", "information-systems", "information-assets",
] as const;
const REFERENCE_VIEWS = { "risk-types": ["applicableControls"], controls: [], "information-systems": ["owner"], "information-assets": [] } as const;
const FAMILIES = [
  "requestStatus", "questionnaireStatus", "assessmentStatus", "treatmentStatus", "treatmentDueState", "riskStage", "riskState",
  "requestHolder", "alertKind", "alertUrgency",
] as const;
const REPORT_KEYS = ["risk-exposure", "treatment-performance", "assessment-throughput", "control-effectiveness"] as const;
const COLUMN_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,63}$/;

test("the vocabulary file parses, and the loaded vocabulary is the file", () => {
  assert.equal(EXPORT_VOCABULARY.schemaVersion, 1);
  assert.deepEqual(parseExportVocabulary(raw), EXPORT_VOCABULARY);
});

test("a malformed vocabulary is refused at load", () => {
  const copy = () => JSON.parse(JSON.stringify(raw)) as { views: Record<string, { columns: Array<Record<string, unknown>> }>; labels: Record<string, unknown> };
  const unknownFamily = copy();
  unknownFamily.views["risk-register"].columns[4].family = "noSuchFamily";
  assert.throws(() => parseExportVocabulary(unknownFamily), /invalid/);
  const repeated = copy();
  repeated.views["risk-register"].columns[1].key = "riskNumber";
  assert.throws(() => parseExportVocabulary(repeated), /repeats a key/);
  const noVisible = copy();
  for (const column of noVisible.views["risk-register"].columns) column.visible = false;
  assert.throws(() => parseExportVocabulary(noVisible), /no visible column/);
  assert.throws(() => parseExportVocabulary({ ...raw, schemaVersion: 2 }), /schemaVersion/);
});

test("the vocabulary defines the 12 list views, each with a visible column first and unique, well-formed keys", () => {
  assert.deepEqual(Object.keys(EXPORT_VOCABULARY.views).sort(), [...LIST_VIEWS].sort());
  for (const key of LIST_VIEWS) {
    const columns = exportViewColumns(key);
    assert.ok(columns.length > 0 && columns[0].visible, `${key} starts with a visible column`);
    assert.equal(new Set(columns.map((column) => column.key)).size, columns.length, `${key} keys are unique`);
    for (const column of columns) {
      assert.match(column.key, COLUMN_KEY, `${key}.${column.key}`);
      assert.ok(column.label.trim().length > 0, `${key}.${column.key} has a label`);
      if (column.type === "label") assert.ok(column.family && column.family in EXPORT_VOCABULARY.labels, `${key}.${column.key} names a family`);
    }
    assert.equal(EXPORT_VOCABULARY.views[key].slug, key, `${key}'s file slug is its key (19-UI-SPEC §3.2)`);
  }
});

test("every registered view has an extractor for each of its columns and no extractor without a column", () => {
  const registered = registeredExportViews();
  assert.ok(registered.some((view) => view.key === "risk-register"));
  for (const view of registered) {
    assert.deepEqual([...view.extractors].sort(), exportViewColumns(view.key).map((column) => column.key).sort(), view.key);
  }
});

test("the register's visible columns are its eight on-screen columns, then the export-only ones", () => {
  const columns = exportViewColumns("risk-register");
  assert.deepEqual(columns.filter((column) => column.visible).map((column) => column.label), [
    "Risk number", "Statement", "Inherent rating", "Residual rating", "Treatment status", "Treatment owner", "Target date", "Related assessment",
  ]);
  assert.deepEqual(columns.filter((column) => !column.visible).map((column) => column.key), [
    "stage", "accepted", "treatmentDueState", "requestTitle", "assessmentType", "riskOwner", "riskType", "treatmentAction", "treatmentPlan",
    "informationSystem", "informationAsset", "treatmentResolveDate", "riskState",
  ]);
});

test("each import collection mirrors its administration CSV contract field for field, with a label and a format", () => {
  for (const [kind, contract] of Object.entries(ADMINISTRATION_CSV_CONTRACTS)) {
    const spec = importColumns(kind);
    assert.equal(spec.naturalKey, contract.naturalKey, kind);
    assert.equal(spec.exampleKey, kind === "controls" ? "EXAMPLE" : "Example (CSRM skips this row)", kind);
    assert.deepEqual(
      spec.columns.map((column) => ({ field: column.field, required: column.required, maxLength: column.maxLength, values: column.values, boolean: column.kind === "boolean" })),
      contract.columns.map((column) => {
        const source = column as { field: string; required?: true; maxLength: number; type?: "boolean"; values?: readonly string[] };
        return { field: source.field, required: source.required === true, maxLength: source.maxLength, values: source.values, boolean: source.type === "boolean" };
      }),
      kind,
    );
    for (const column of spec.columns) {
      assert.ok(column.label.trim().length > 0 && column.format.trim().length > 0, `${kind}.${column.field}`);
      assert.equal(column.kind === "enum", column.values !== undefined, `${kind}.${column.field} is an enumeration exactly when it has values`);
    }
  }
  assert.deepEqual(Object.keys(EXPORT_VOCABULARY.imports).sort(), Object.keys(ADMINISTRATION_CSV_CONTRACTS).sort());
  assert.equal(importColumns("information-systems").columns.find((column) => column.field === "internetFacing")?.format, "Yes or No");
  assert.equal(importColumns("information-systems").columns.find((column) => column.field === "environment")?.format, "One of: Production, Non-production");
  assert.equal(importColumns("risk-types").columns[0].format, "Text, up to 255 characters");
});

test("each reference view's columns are its import columns, then its read-only list columns, all visible (D-33)", () => {
  for (const [kind, readOnly] of Object.entries(REFERENCE_VIEWS)) {
    const columns = exportViewColumns(kind);
    const spec = importColumns(kind);
    assert.deepEqual(
      columns.slice(0, spec.columns.length).map((column) => [column.key, column.label]),
      spec.columns.map((column) => [column.field, column.label]),
      kind,
    );
    assert.deepEqual(columns.slice(spec.columns.length).map((column) => column.key), [...readOnly], kind);
    assert.deepEqual(spec.readOnlyLabels, columns.slice(spec.columns.length).map((column) => column.label), kind);
    assert.ok(columns.every((column) => column.visible), `${kind} shows every column`);
    for (const column of spec.columns) {
      const exported = columns.find((entry) => entry.key === column.field);
      assert.equal(exported?.type, column.kind === "boolean" ? "flag" : "text", `${kind}.${column.field} exports as its import reads`);
    }
  }
});

test("the released assessment's three tables hold the planned columns", () => {
  assert.deepEqual(exportTableColumns("released-assessment", "summary").columns.map((column) => column.key), [
    "assessmentNumber", "requestNumber", "requestTitle", "releasedAt", "releasedBy", "overallRating", "overallControlEffectiveness", "summary",
    "overallRationale", "recommendations", "nextReviewDate",
  ]);
  // 19-10: no Risk Type column, because the released risks read does not disclose a Risk's type (D-21).
  assert.deepEqual(exportTableColumns("released-assessment", "risks").columns.map((column) => column.key), [
    "riskNumber", "riskStatement", "inherentRating", "residualRating", "treatmentAction", "treatmentPlan", "riskOwner", "treatmentOwner",
    "targetDate", "treatmentStatus",
  ]);
  assert.deepEqual(exportTableColumns("released-assessment", "mitigation-controls").columns.map((column) => column.label), [
    "Risk", "Control number", "Control", "Status", "Effectiveness",
  ]);
  assert.deepEqual(
    ["summary", "risks", "mitigation-controls"].map((table) => exportTableColumns("released-assessment", table).heading),
    ["Summary", "Risks", "Mitigation controls"],
  );
});

test("each report has a slug, a heading and its tables, each with a slug", () => {
  assert.deepEqual(Object.keys(EXPORT_VOCABULARY.reports).sort(), [...REPORT_KEYS].sort());
  for (const key of REPORT_KEYS) {
    const report = EXPORT_VOCABULARY.reports[key];
    assert.equal(report.slug, `${key}-report`);
    assert.ok(report.tables.length > 0, key);
    for (const table of report.tables) assert.match(table.slug, /^[a-z0-9][a-z0-9-]*$/, `${key}.${table.key}`);
  }
});

test("the ten label families map stored values to the screen's words: approved reads Released, every Risk state has its label", () => {
  assert.deepEqual(Object.keys(EXPORT_VOCABULARY.labels).sort(), [...FAMILIES].sort());
  assert.equal(exportLabel("requestStatus", "approved"), "Released");
  assert.equal(exportLabel("assessmentStatus", "approved"), "Released");
  assert.deepEqual(EXPORT_VOCABULARY.labels.riskState, { open: "Open", closed: "Closed", withdrawn: "Withdrawn" });
  assert.deepEqual(Object.keys(EXPORT_VOCABULARY.labels.riskState), [...RISK_REGISTER_STATES]);
  assert.equal(exportLabel("requestStatus", "not-a-status"), "not-a-status", "an unmapped value is written as it is");
  assert.equal(exportLabel("noSuchFamily", "approved"), "approved");
});

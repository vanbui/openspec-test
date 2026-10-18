import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { headerKey, HEADER_WARNINGS_MAX, matchHeaders, type ImportColumnHeader } from "../src/csrm/spreadsheets/header-match";
import { ImportFileRefusal } from "../src/csrm/spreadsheets/import-file";
import { CLEAR_TOKEN, convertCell, VALUE_CONVERTERS, type ImportValueColumn } from "../src/csrm/spreadsheets/value-convert";

/*
 * Header matching and value conversion (19-03; D-27 to D-29, 19-UI-SPEC §6 S4). Headers are read the way people
 * type them, by field name or display label; values accept the spreadsheet habits the UAT met, and the converter map
 * is the interface Phase 18 extends.
 */

/** The Information Systems columns as the import names them (field and display label). */
const INFORMATION_SYSTEM_COLUMNS: readonly ImportColumnHeader[] = [
  { field: "name", label: "Name", required: true },
  { field: "description", label: "Description", required: false },
  { field: "environment", label: "Environment", required: false },
  { field: "internetFacing", label: "Internet facing", required: false },
  { field: "hostingLocation", label: "Hosting location", required: false },
];

function match(headers: readonly string[], readOnlyLabels: readonly string[] = []) {
  return matchHeaders(headers, INFORMATION_SYSTEM_COLUMNS, { knownIgnored: { issuesHeader: "Issues", readOnlyLabels } });
}

function refusalOf(action: () => unknown): ImportFileRefusal {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof ImportFileRefusal, `expected an ImportFileRefusal, got ${String(error)}`);
    return error;
  }
  return assert.fail("the headers were not refused");
}

test("headerKey ignores case, surrounding and inner spaces, underscores, hyphens and width", () => {
  for (const header of ["Name", "name", "NAME", " Name ", "ｎａｍｅ"]) assert.equal(headerKey(header), "name", header);
  for (const header of ["Internet facing", "internetFacing", "INTERNET_FACING", "internet-facing", "Internet  facing"]) {
    assert.equal(headerKey(header), "internetfacing", header);
  }
});

test("every spelling of Name and Internet facing maps to its field", () => {
  for (const name of ["Name", "name", "NAME", " Name ", "ｎａｍｅ"]) {
    for (const flag of ["Internet facing", "internetFacing", "INTERNET_FACING", "internet-facing"]) {
      const result = match([name, flag]);
      assert.deepEqual(result.mapping, ["name", "internetFacing"], `${name} / ${flag}`);
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(result.notes, []);
    }
  }
});

test("an unknown column is a warning naming it as typed, in file order, and maps to nothing", () => {
  const result = match(["Name", "Owner", "Description", "Cost centre"]);
  assert.deepEqual(result.mapping, ["name", null, "description", null]);
  assert.deepEqual(result.warnings, ["Owner", "Cost centre"]);
});

test("the Issues column is a note, not a warning", () => {
  const result = match(["Name", "Issues"]);
  assert.deepEqual(result.mapping, ["name", null]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.notes, ["issues-column"]);
});

test("a read-only column passed in readOnlyLabels is a note; without it, the same column is a warning", () => {
  const known = match(["Name", "Owner", "issues"], ["Owner"]);
  assert.deepEqual(known.warnings, []);
  assert.deepEqual(known.notes, ["read-only-columns", "issues-column"]);
  assert.deepEqual(match(["Name", "Owner"]).warnings, ["Owner"]);
});

test("a blank header maps to nothing and warns nothing", () => {
  const result = match(["Name", "", "  "]);
  assert.deepEqual(result.mapping, ["name", null, null]);
  assert.deepEqual(result.warnings, []);
});

test("IMPORT_DUPLICATE_HEADER names both headers as typed and the column's label", () => {
  const error = refusalOf(() => match(["Name", "Description", "NAME"]));
  assert.equal(error.reason, "IMPORT_DUPLICATE_HEADER");
  assert.equal(error.status, 422);
  assert.deepEqual(error.found, { headers: ["Name", "NAME"], labels: ["Name"] });
});

test("IMPORT_MISSING_COLUMN names every missing required column by its label", () => {
  const error = refusalOf(() => match(["Description", "Owner"]));
  assert.equal(error.reason, "IMPORT_MISSING_COLUMN");
  assert.equal(error.status, 422);
  assert.deepEqual(error.found, { labels: ["Name"] });
});

test("warnings are bounded: at most 50 headers, controls removed", () => {
  const headers = ["Name", ...Array.from({ length: 60 }, (_, index) => `Extra ${index}`), "Bad\u0007header"];
  const result = match(headers);
  assert.equal(HEADER_WARNINGS_MAX, 50);
  assert.equal(result.warnings.length, 50);
  assert.equal(match(["Name", "Bad\u0007header"]).warnings[0], "Badheader");
});

// Values.

const NAME: ImportValueColumn = { field: "name", label: "Name", kind: "text", required: true, maxLength: 255 };
const DESCRIPTION: ImportValueColumn = { field: "description", label: "Description", kind: "text", required: false, maxLength: 10 };
const INTERNET_FACING: ImportValueColumn = { field: "internetFacing", label: "Internet facing", kind: "flag", required: false, maxLength: 5 };
const ENVIRONMENT: ImportValueColumn = {
  field: "environment",
  label: "Environment",
  kind: "enum",
  required: false,
  maxLength: 255,
  values: ["Production", "Non-production"],
};

const UPDATE = { mode: "update" } as const;
const CREATE = { mode: "create" } as const;

test("flags accept Yes, No, Y, N, TRUE and FALSE in any case, and workbook booleans", () => {
  for (const raw of ["Yes", "yes", "y", "Y", "TRUE", "true", " True "]) {
    assert.deepEqual(convertCell(raw, INTERNET_FACING, UPDATE), { kind: "value", value: true }, raw);
  }
  for (const raw of ["No", "no", "n", "N", "FALSE", "false"]) {
    assert.deepEqual(convertCell(raw, INTERNET_FACING, UPDATE), { kind: "value", value: false }, raw);
  }
  assert.deepEqual(convertCell(true, INTERNET_FACING, UPDATE), { kind: "value", value: true });
  assert.deepEqual(convertCell(false, INTERNET_FACING, UPDATE), { kind: "value", value: false });
});

test("an unrecognised flag is INVALID_BOOLEAN with the S4 sentence", () => {
  assert.deepEqual(convertCell("maybe", INTERNET_FACING, UPDATE), {
    kind: "issue",
    code: "INVALID_BOOLEAN",
    message: "Internet facing must be Yes or No. Y, N, TRUE and FALSE also work.",
  });
});

test("enumerations match case-insensitively and return the canonical value", () => {
  assert.deepEqual(convertCell("production", ENVIRONMENT, UPDATE), { kind: "value", value: "Production" });
  assert.deepEqual(convertCell("NON-PRODUCTION", ENVIRONMENT, UPDATE), { kind: "value", value: "Non-production" });
  const issue = convertCell("Prod", ENVIRONMENT, UPDATE);
  assert.equal(issue.kind, "issue");
  assert.equal(issue.kind === "issue" && issue.code, "INVALID_ENUM");
  assert.equal(issue.kind === "issue" && issue.message, "Environment must be one of: Production, Non-production.");
});

test("#CLEAR in any case: clear on an optional field in update mode, blank in create mode, an issue on a required field", () => {
  assert.equal(CLEAR_TOKEN, "#CLEAR");
  assert.deepEqual(convertCell("#clear", DESCRIPTION, UPDATE), { kind: "clear" });
  assert.deepEqual(convertCell(" #Clear ", ENVIRONMENT, UPDATE), { kind: "clear" });
  assert.deepEqual(convertCell("#CLEAR", DESCRIPTION, CREATE), { kind: "blank" });
  for (const mode of [UPDATE, CREATE]) {
    assert.deepEqual(convertCell("#clear", NAME, mode), {
      kind: "issue",
      code: "CLEAR_REQUIRED",
      message: "Name is required, so #CLEAR can’t empty it.",
    });
  }
  // Only the whole cell is the token.
  assert.deepEqual(convertCell("#CLEAR it", DESCRIPTION, UPDATE), { kind: "value", value: "#CLEAR it" });
});

test("text is trimmed once, the neutraliser's mark is stripped, other quotes are kept, numbers become text", () => {
  assert.deepEqual(convertCell("'=1+2", NAME, UPDATE), { kind: "value", value: "=1+2" });
  assert.deepEqual(convertCell("  '=1+2", NAME, UPDATE), { kind: "value", value: "=1+2" });
  assert.deepEqual(convertCell("'hello", NAME, UPDATE), { kind: "value", value: "'hello" });
  assert.deepEqual(convertCell("''=x", NAME, UPDATE), { kind: "value", value: "'=x" });
  assert.deepEqual(convertCell(42, NAME, UPDATE), { kind: "value", value: "42" });
  assert.deepEqual(convertCell("  text  ", NAME, UPDATE), { kind: "value", value: "text" });
  assert.deepEqual(convertCell(true, NAME, UPDATE), { kind: "value", value: "TRUE" });
});

test("a blank cell is blank", () => {
  for (const raw of ["", "   ", null]) assert.deepEqual(convertCell(raw, NAME, UPDATE), { kind: "blank" });
});

test("a value over maxLength is VALUE_TOO_LONG naming the column's label", () => {
  assert.deepEqual(convertCell("a".repeat(11), DESCRIPTION, UPDATE), {
    kind: "issue",
    code: "VALUE_TOO_LONG",
    message: "Description must be at most 10 characters.",
  });
});

test("VALUE_CONVERTERS is frozen and has exactly the text, flag and enum converters", () => {
  assert.ok(Object.isFrozen(VALUE_CONVERTERS));
  assert.deepEqual(Object.keys(VALUE_CONVERTERS).sort(), ["enum", "flag", "text"]);
});

test("header matching and value conversion import nothing from Strapi", () => {
  for (const file of ["header-match.ts", "value-convert.ts"]) {
    const source = readFileSync(path.resolve(__dirname, "../../../src/csrm/spreadsheets", file), "utf8");
    assert.doesNotMatch(source, /from\s+["']@strapi/);
  }
});

test("a header made only of control or bidi characters never becomes an empty warning (BE3-02)", () => {
  const { warnings, mapping } = match(["Name", "‎", "\u0007", "‮⁦", "Extra‏"]);
  assert.deepEqual(mapping, ["name", null, null, null, null]);
  assert.deepEqual(warnings, ["Extra"]);
  for (const warning of warnings) assert.ok(warning.length >= 1, "every warning has at least one character (minLength: 1)");
});

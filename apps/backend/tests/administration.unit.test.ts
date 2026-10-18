import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import type { AdministrationRepository } from "../src/api/csrm-administration/services/administration-repository";
import {
  buildImportErrorReport,
  commitAdministrationImport,
  previewAdministrationImport,
  previewRecordForReport,
} from "../src/api/csrm-administration/services/administration-workflow";

type AdministrationQueryModule = {
  ADMINISTRATION_MAX_RECORDS: number;
  parseAdministrationQuery: (kind: string, input: URLSearchParams) => Record<string, unknown>;
  parseAdministrationMutation: (kind: string, input: unknown, mode?: "create" | "update") => Record<string, unknown>;
  normalizeAdministrationNaturalKey: (value: string) => string;
  projectAdministrationRecord: (kind: string, input: Record<string, unknown>) => Record<string, unknown>;
};

type CsvRowState = "create" | "update" | "unchanged" | "rejected" | "ambiguous";
type CsvImportModule = {
  CSV_MAX_BYTES: number;
  CSV_MAX_ROWS: number;
  CSV_MAX_RECORD_BYTES: number;
  /* 19-13: the imports read every upload through the one reader of 19-03 (readImportFile), so the parse is async. */
  parseAdministrationImport: (input: {
    kind: string;
    bytes: Uint8Array;
    fileName?: string;
    existing?: readonly Record<string, unknown>[];
  }) => Promise<{ rows: Array<{ rowNumber: number; state: CsvRowState; issues: readonly string[] }>; counts: Record<CsvRowState, number>; digest: string }>;
  sanitizeSpreadsheetCell: (value: string) => string;
};

/** A file the reader refuses, with its closed reason (19-03, 19-13). */
function refusedWith(reason: string) {
  return (error: unknown) => error instanceof Error && (error as { reason?: unknown }).reason === reason;
}

function loadQueryModule(): AdministrationQueryModule {
  const modulePath = "../src/api/csrm-administration/services/administration-query";
  return require(modulePath) as AdministrationQueryModule;
}

function loadCsvModule(): CsvImportModule {
  const modulePath = "../src/api/csrm-administration/services/csv-import";
  return require(modulePath) as CsvImportModule;
}

type MiddlewareEntry = string | { name?: string; config?: { formidable?: Record<string, unknown> } };

/**
 * The compiled middleware configuration as Strapi's config loader resolves it: a function export is
 * called with Strapi's own env helper (the middlewares file reads CSRM_CORS_ALLOWED_ORIGINS through it).
 */
function loadMiddlewareConfig(): MiddlewareEntry[] {
  const exported = (require(join(process.cwd(), "dist/config/middlewares")) as { default: unknown }).default;
  if (typeof exported !== "function") return exported as MiddlewareEntry[];
  const strapiEntry = require.resolve("@strapi/strapi");
  const { env } = require(require.resolve("@strapi/utils", { paths: [dirname(strapiEntry)] })) as { env: unknown };
  return (exported as (params: { env: unknown }) => MiddlewareEntry[])({ env });
}

test("ADMIN-04 bounds global multipart transport while import routes retain stricter workflow limits", () => {
  const middlewareConfig = loadMiddlewareConfig();
  const body = middlewareConfig.find((entry) => typeof entry === "object" && entry.name === "strapi::body");
  assert.equal(typeof body, "object");
  const formidable = body && typeof body === "object" ? body.config?.formidable : undefined;
  assert.equal(formidable?.maxFiles, undefined);
  assert.equal(formidable?.maxFileSize, 52_428_800);
  assert.equal(formidable?.maxTotalFileSize, 262_144_000);
});

const administrationState = {
  idamboxUser: { documentId: "analyst-test" },
  csrmAuthorization: { administrationCollectionScope: "all" },
};

function repositoryFixture(existing: Record<string, unknown>[]) {
  let naturalKeyReads = 0;
  let nextDocument = 1;
  const repository: AdministrationRepository = {
    async count() { return existing.length; },
    async selectPage() { return []; },
    async hydrate() { return []; },
    async findOne(documentId) { return existing.find((record) => record.documentId === documentId) ?? null; },
    async findNaturalKeyRecords() { naturalKeyReads += 1; return [...existing]; },
    async resolveApplicableControls(documentIds) { return [...documentIds]; },
    async resolveActiveUser() { return 1; },
    async create(data) {
      const created = { ...data, documentId: `created-${nextDocument++}`, updatedAt: "2026-09-02T00:00:00.000Z" };
      existing.push(created);
      return created;
    },
    async update(documentId, data) {
      const index = existing.findIndex((record) => record.documentId === documentId);
      if (index >= 0) existing[index] = { ...existing[index], ...data };
      return existing[index] ?? {};
    },
    async transaction(action) { return action(); },
  };
  return {
    repository,
    naturalKeyReads: () => naturalKeyReads,
    resetNaturalKeyReads: () => { naturalKeyReads = 0; },
  };
}

async function withCsvUpload<T>(csv: string, action: (uploads: Record<string, unknown>) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "csrm-administration-unit-"));
  const filepath = join(directory, "import.csv");
  const bytes = Buffer.from(csv);
  await writeFile(filepath, bytes);
  try {
    return await action({ file: { filepath, originalFilename: "import.csv", mimetype: "text/csv", size: bytes.length } });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("ADMIN-04 commit reads the natural-key collection exactly once for multiple creates", async () => {
  const fixture = repositoryFixture([]);
  await withCsvUpload("name,description\r\nFirst create,one\r\nSecond create,two", async (uploads) => {
    const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
    fixture.resetNaturalKeyReads();
    const result = await commitAdministrationImport({
      repository: fixture.repository,
      kind: "risk-types",
      state: administrationState,
      uploads,
      previewDigest: preview.previewDigest,
      confirmed: "true",
    });
    assert.equal((result.summary as Record<string, number>).create, 2);
    assert.equal(fixture.naturalKeyReads(), 1, "multi-create commit must perform one initial collection read");
  });
});

test("ADMIN-04 import record cap accepts exactly 65_536 records and rejects cap plus one", async () => {
  await withCsvUpload("name,description\r\nBoundary create,value", async (uploads) => {
    const atCap = repositoryFixture(Array.from({ length: 65_535 }, (_, index) => ({
      documentId: `existing-${index}`,
      name: `Existing ${index}`,
      description: "value",
    })));
    const accepted = await previewAdministrationImport({ repository: atCap.repository, kind: "risk-types", state: administrationState, uploads });
    assert.equal((accepted.summary as Record<string, number>).create, 1);

    const overCap = repositoryFixture(Array.from({ length: 65_536 }, (_, index) => ({
      documentId: `existing-${index}`,
      name: `Existing ${index}`,
      description: "value",
    })));
    await assert.rejects(
      previewAdministrationImport({ repository: overCap.repository, kind: "risk-types", state: administrationState, uploads }),
      (error: unknown) => error instanceof Error
        && "status" in error && error.status === 409
        && "code" in error && error.code === "IMPORT_RECORD_LIMIT_EXCEEDED",
    );
  });
});

test("ADMIN-01 ADMIN-02 ADMIN-03 T-06-02 closes collection query, mutation, and response DTOs", () => {
  const contract = loadQueryModule();
  assert.equal(contract.ADMINISTRATION_MAX_RECORDS, 65_536);
  assert.equal(contract.normalizeAdministrationNaturalKey("  Ａdmin  "), "admin");
  assert.deepEqual(contract.parseAdministrationQuery("risk-types", new URLSearchParams()), {
    q: "", sort: "name:asc", page: 1, pageSize: 25,
  });
  for (const query of ["unknown=x", "page=0", "pageSize=101", "sort=createdAt:desc", "q=a&q=b", "filters[name][$ne]=x"]) {
    assert.throws(() => contract.parseAdministrationQuery("risk-types", new URLSearchParams(query)), query);
  }
  assert.deepEqual(contract.parseAdministrationMutation("risk-types", { name: " Example ", description: null }), {
    name: "Example", description: null,
  });
  assert.throws(() => contract.parseAdministrationMutation("risk-types", { name: "Example", createdAt: "forged" }));
  assert.deepEqual(Object.keys(contract.projectAdministrationRecord("risk-types", {
    documentId: "risk-type-1", name: "Example", description: null, createdAt: "hidden", id: 1,
  })).sort(), ["description", "documentId", "name"]);
});

test("ADMIN-02 accepts exact frozen Control field caps and rejects cap plus one", () => {
  const contract = loadQueryModule();
  const exact = contract.parseAdministrationMutation("controls", {
    controlNumber: "BOUNDARY-001",
    name: "Boundary Control",
    framework: "Boundary Framework",
    controlReference: "r".repeat(500),
    frameworkVersion: "v".repeat(255),
    frameworkSource: "s".repeat(2_000),
  });
  assert.equal(String(exact.controlReference).length, 500);
  assert.equal(String(exact.frameworkVersion).length, 255);
  assert.equal(String(exact.frameworkSource).length, 2_000);

  for (const [field, value] of [
    ["controlReference", "r".repeat(501)],
    ["frameworkVersion", "v".repeat(256)],
    ["frameworkSource", "s".repeat(2_001)],
  ] as const) {
    assert.throws(() => contract.parseAdministrationMutation("controls", {
      controlNumber: "BOUNDARY-OVER",
      name: "Boundary Control",
      framework: "Boundary Framework",
      [field]: value,
    }), field);
  }
});

/*
 * No valid write stores control text beyond its contract bound, so a longer stored value is a data defect.
 * A read never serves it whole (the web's closed parser would refuse the whole page) and never shortens it
 * silently: it is cut at a word boundary inside the bound, closed with an ellipsis, and the server logs a
 * warning naming the control, never its text.
 */
test("ADMIN-05 a Control record and a CSV change never serve stored text beyond its bound", async () => {
  const contract = loadQueryModule();
  const csv = loadCsvModule();
  const stored = Array.from({ length: 1_500 }, (_, index) => `clause${index}`).join(" ");
  const control = { documentId: "over-long-control", controlNumber: "OVER-1", name: "OVER-1 — Over-long", framework: "CSRM acceptance" };
  const warnings: string[] = [];
  const originalStrapi = globalThis.strapi;
  globalThis.strapi = { log: { warn: (message: string) => { warnings.push(message); } } } as never;
  try {
    const record = contract.projectAdministrationRecord("controls", {
      ...control, description: stored,
      controlReference: "ref ".repeat(150), frameworkVersion: "ver ".repeat(70), frameworkSource: "src ".repeat(550),
    });
    for (const [field, maxLength, original] of [
      ["description", 10_000, stored],
      ["controlReference", 500, "ref ".repeat(150)],
      ["frameworkVersion", 255, "ver ".repeat(70)],
      ["frameworkSource", 2_000, "src ".repeat(550)],
    ] as const) {
      const served = String(record[field]);
      assert.ok(served.length <= maxLength, `${field} serves ${served.length} characters`);
      assert.ok(served.endsWith("…"), `${field} marks the shortening`);
      assert.ok(original.startsWith(served.slice(0, -1)), `${field} serves the start of the stored text`);
      assert.match(original.slice(served.length - 1), /^\s/, `${field} is cut at a word boundary`);
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /over-long-control/);
    assert.match(warnings[0] ?? "", /OVER-1/);
    assert.equal((warnings[0] ?? "").includes("clause1 "), false, "the warning never carries the text");

    const atBound = contract.projectAdministrationRecord("controls", { ...control, description: "d".repeat(10_000) });
    assert.equal(atBound.description, "d".repeat(10_000), "a description at the bound is served whole");
    assert.equal(warnings.length, 1, "a record within its bounds logs nothing");

    const parsed = await csv.parseAdministrationImport({
      kind: "controls",
      bytes: Buffer.from(["controlNumber,name,framework,description", "OVER-1,OVER-1 — Over-long,CSRM acceptance,Replacement description"].join("\r\n")),
      existing: [{ ...control, description: stored }],
    }) as unknown as { rows: Array<{ state: CsvRowState; changes: Array<{ field: string; before: unknown; after: unknown }> }> };
    assert.equal(parsed.rows[0]?.state, "update");
    const before = String(parsed.rows[0]?.changes.find(({ field }) => field === "description")?.before);
    assert.ok(before.length <= 10_000 && before.endsWith("…"), `the change shows the stored text shortened, visibly: ${before.length}`);
    assert.ok(stored.startsWith(before.slice(0, -1)));
    assert.equal(warnings.length, 2);
    assert.match(warnings[1] ?? "", /over-long-control/);
  } finally {
    globalThis.strapi = originalStrapi;
  }
});

test("ADMIN-01 ADMIN-03 accepts nullable Risk Type descriptions and exact 500-character location fields", () => {
  const contract = loadQueryModule();
  assert.deepEqual(contract.parseAdministrationMutation("risk-types", { name: "Nullable", description: null }), {
    name: "Nullable", description: null,
  });
  assert.deepEqual(contract.parseAdministrationMutation("risk-types", { name: "Absent" }), { name: "Absent" });
  assert.deepEqual(contract.parseAdministrationMutation("risk-types", { description: null }, "update"), { description: null });

  for (const [kind, field] of [["information-systems", "hostingLocation"], ["information-assets", "location"]] as const) {
    const exact = contract.parseAdministrationMutation(kind, { name: "Boundary", [field]: "x".repeat(500) });
    assert.equal(String(exact[field]).length, 500);
    assert.throws(() => contract.parseAdministrationMutation(kind, { name: "Over", [field]: "x".repeat(501) }), field);
  }
});

test("ADMIN-04 T-06-03 enforces exact CSV byte, row, and record bounds", async () => {
  const csv = loadCsvModule();
  assert.equal(csv.CSV_MAX_BYTES, 5_242_880);
  assert.equal(csv.CSV_MAX_ROWS, 5_000);
  assert.equal(csv.CSV_MAX_RECORD_BYTES, 65_536);

  const boundedRows = Array.from({ length: 5_000 }, (_, index) => `Row ${index},${"x".repeat(1_030)}`);
  const header = "name,description\r\n";
  let exactBytes = Buffer.from(`${header}${boundedRows.join("\r\n")}`);
  boundedRows[boundedRows.length - 1] += "x".repeat(csv.CSV_MAX_BYTES - exactBytes.length);
  exactBytes = Buffer.from(`${header}${boundedRows.join("\r\n")}`);
  assert.equal(exactBytes.length, csv.CSV_MAX_BYTES);
  assert.equal((await csv.parseAdministrationImport({ kind: "risk-types", bytes: exactBytes })).rows.length, 5_000);

  const exactRows = `name\r\n${Array.from({ length: 5_000 }, (_, index) => `Row ${index}`).join("\r\n")}`;
  assert.equal((await csv.parseAdministrationImport({ kind: "risk-types", bytes: Buffer.from(exactRows) })).rows.length, 5_000);
  await assert.rejects(csv.parseAdministrationImport({
    kind: "risk-types", bytes: Buffer.from(`${exactRows}\r\nRow 5000`),
  }), refusedWith("IMPORT_TOO_MANY_ROWS"));
  await assert.rejects(csv.parseAdministrationImport({
    kind: "risk-types", bytes: Buffer.alloc(5_242_881, 0x61),
  }), refusedWith("IMPORT_FILE_TOO_LARGE"));
  // Pilot ruling 4 (2026-10-16): a record over 64 KiB is one rejected row, never a refusal of the whole file.
  const overLong = await csv.parseAdministrationImport({
    kind: "risk-types", bytes: Buffer.from(`name\r\n${"x".repeat(65_537)}\r\nKept row`),
  });
  assert.deepEqual(overLong.rows.map(({ state }) => state), ["rejected", "create"]);
});

test("ADMIN-04 classifies create/update/unchanged/rejected/ambiguous as five distinct states", async () => {
  const csv = loadCsvModule();
  const parsed = await csv.parseAdministrationImport({
    kind: "risk-types",
    bytes: Buffer.from([
      "name,description",
      "Create row,new",
      "Update row,changed",
      "Unchanged row,same",
      ",missing natural key",
      "AMBIGUOUS,duplicate one",
      " ambiguous ,duplicate two",
    ].join("\r\n")),
    existing: [
      { documentId: "update-1", name: "Update row", description: "old" },
      { documentId: "unchanged-1", name: "Unchanged row", description: "same" },
    ],
  });
  assert.deepEqual(parsed.counts, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2, similar: 0 });
  assert.deepEqual(parsed.rows.map(({ rowNumber, state }) => ({ rowNumber, state })), [
    { rowNumber: 2, state: "create" }, { rowNumber: 3, state: "update" },
    { rowNumber: 4, state: "unchanged" }, { rowNumber: 5, state: "rejected" },
    { rowNumber: 6, state: "ambiguous" }, { rowNumber: 7, state: "ambiguous" },
  ]);
  assert.match(parsed.digest, /^[a-f0-9]{64}$/);
});

test("ADMIN-04 classifies against the complete existing-record set beyond the CSV row cap", async () => {
  const csv = loadCsvModule();
  const existing = Array.from({ length: csv.CSV_MAX_ROWS + 1 }, (_, index) => ({
    documentId: `existing-${index}`,
    name: `Existing ${index}`,
    description: "old",
  }));
  const target = existing.at(-1)!;
  const parsed = await csv.parseAdministrationImport({
    kind: "risk-types",
    bytes: Buffer.from(`name,description\r\n${target.name},changed`),
    existing,
  });
  assert.equal(parsed.rows[0]?.state, "update");
  assert.equal((parsed.rows[0] as { matchedDocumentId?: string }).matchedDocumentId, target.documentId);
});

/* D-38 (UI-SPEC §17.1): the parser's messages match the web's and name the collection's own column. */
test("UAT-054 CSV messages say why a file can't be imported and name the matching column plainly", async () => {
  const csv = loadCsvModule();
  const messages = (row: unknown) => ((row as { issues: Array<{ message: string }> }).issues).map((item) => item.message);
  // 19-13: a header with no rows is the reader's closed refusal, which the web words (19-UI-SPEC S2).
  await assert.rejects(csv.parseAdministrationImport({ kind: "risk-types", bytes: Buffer.from("name\r\n") }), refusedWith("IMPORT_NO_ROWS"));
  const duplicates = await csv.parseAdministrationImport({ kind: "controls", bytes: Buffer.from("controlNumber,name,framework\r\nAC-1,One,NIST\r\n ac-1 ,Two,NIST") });
  assert.deepEqual(duplicates.rows.map(messages), [
    ["This control number appears more than once in the file."],
    ["This control number appears more than once in the file."],
  ]);
  const matches = await csv.parseAdministrationImport({
    kind: "risk-types",
    bytes: Buffer.from("name\r\nCredential misuse"),
    existing: [{ documentId: "risk-type-1", name: "Credential misuse" }, { documentId: "risk-type-2", name: "credential misuse" }],
  });
  assert.deepEqual(messages(matches.rows[0]), ["More than one existing record has this name."]);
});

test("T-06-04 T-06-06 T-06-07 rejects malformed bytes and neutralizes spreadsheet formulas", async () => {
  const csv = loadCsvModule();
  for (const [bytes, reason] of [
    [Buffer.from([]), "IMPORT_NO_HEADER"],
    [Buffer.from("name\r\n"), "IMPORT_NO_ROWS"],
    [Buffer.from([0xc3, 0x28]), "IMPORT_ENCODING_WINDOWS_1252"],
  ] as const) {
    await assert.rejects(csv.parseAdministrationImport({ kind: "risk-types", bytes }), refusedWith(reason));
  }
  for (const value of ["=cmd()", "+SUM(A1)", "-2+3", "@IMPORTDATA(x)", "\t=cmd()", "\r=cmd()"]) {
    const safe = csv.sanitizeSpreadsheetCell(value);
    assert.doesNotMatch(safe, /^[=+\-@\t\r]/);
    assert.ok(safe.endsWith(value));
  }
});

/*
 * Phase 19 (19-13 Task 2; D-28, D-29; the import record's "Values"): every cell goes through the shared converters with
 * the row's mode, so flags, the clear token, the neutraliser's mark, workbook numbers, the template's example row and
 * an over-long row read the way people make them.
 */
type ImportRowView = {
  rowNumber: number;
  state: CsvRowState;
  values: Record<string, unknown>;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  issues: Array<{ code: string; field: string | null; message: string }>;
};
type ClassifyModule = {
  classifyAdministrationImport: (input: {
    kind: string;
    file: { format: "csv" | "xlsx"; header: readonly string[]; rows: ReadonlyArray<{ rowNumber: number; cells: ReadonlyArray<string | number | boolean | null>; byteLength: number }> };
    existing?: readonly Record<string, unknown>[];
  }) => { rows: ImportRowView[]; warnings: string[]; notes: string[]; readOnlyColumns: string[] };
};

function classify(kind: string, header: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>, existing: readonly Record<string, unknown>[] = [], format: "csv" | "xlsx" = "csv") {
  const module = require("../src/api/csrm-administration/services/csv-import") as ClassifyModule;
  return module.classifyAdministrationImport({
    kind,
    file: { format, header, rows: rows.map((cells, index) => ({ rowNumber: index + 2, cells, byteLength: cells.reduce<number>((total, cell) => total + String(cell ?? "").length + 1, 0) })) },
    existing,
  });
}

test("CSV-02 IS-1 flags read Yes, No, Y, N, TRUE and FALSE in any case, and an unknown flag names the spellings", () => {
  const parsed = classify("information-systems", ["name", "internetFacing", "externalAccessRequired"], [
    ["Yes system", "Yes", "no"], ["Y system", "y", "N"], ["True system", "TRUE", "false"], ["Maybe system", "maybe", "No"],
  ]);
  assert.deepEqual(parsed.rows.slice(0, 3).map((row) => [row.state, row.values.internetFacing, row.values.externalAccessRequired]), [
    ["create", true, false], ["create", true, false], ["create", true, false],
  ]);
  for (const row of parsed.rows.slice(0, 3)) assert.equal(row.issues.some((item) => item.code === "INVALID_BOOLEAN"), false);
  assert.equal(parsed.rows[3]?.state, "rejected");
  assert.deepEqual(parsed.rows[3]?.issues.map(({ code, field, message }) => ({ code, field, message })), [
    { code: "INVALID_BOOLEAN", field: "internetFacing", message: "Internet-facing must be Yes or No. Y, N, TRUE and FALSE also work." },
  ]);
  const workbook = classify("information-systems", ["Name", "Internet-facing"], [["Workbook flag", true]], [], "xlsx");
  assert.equal(workbook.rows[0]?.values.internetFacing, true, "an XLSX boolean cell fills a flag");
});

test("CSV-02 #CLEAR empties an optional field on an update, equals blank on a create, and is a row issue on a required field", () => {
  const existing = [{ documentId: "system-1", name: "Cleared system", hostingLocation: "Sydney", description: "Kept", updatedAt: "2026-10-01T00:00:00.000Z" }];
  const update = classify("information-systems", ["name", "hostingLocation", "description"], [["Cleared system", "#CLEAR", ""]], existing);
  assert.equal(update.rows[0]?.state, "update");
  assert.equal(update.rows[0]?.values.hostingLocation, null);
  assert.equal("description" in (update.rows[0]?.values ?? {}), false, "a blank cell leaves the field unchanged");
  assert.deepEqual(update.rows[0]?.changes, [{ field: "hostingLocation", before: "Sydney", after: null }]);

  const create = classify("information-systems", ["name", "hostingLocation"], [["New cleared system", " #clear "]]);
  assert.equal(create.rows[0]?.state, "create");
  assert.equal("hostingLocation" in (create.rows[0]?.values ?? {}), false, "on a create the clear token equals blank");

  const required = classify("risk-types", ["name", "description"], [["#clear", "x"]]);
  assert.equal(required.rows[0]?.state, "rejected");
  assert.deepEqual(required.rows[0]?.issues.map(({ code, field, message }) => ({ code, field, message })), [
    { code: "CLEAR_REQUIRED", field: "name", message: "Name is required, so #CLEAR can’t empty it." },
  ]);
});

test("CSV-02 the neutraliser's mark is stripped only before a formula trigger, and workbook numbers read as their text", () => {
  const marks = classify("risk-types", ["name", "description"], [["Formula text", "'=1+2"], ["Quoted text", "'hello"]]);
  assert.deepEqual(marks.rows.map((row) => row.values.description), ["=1+2", "'hello"]);
  const workbook = classify("controls", ["Control number", "Name", "Framework", "Reference"], [[42, "Numbered control", "ISO", "0042"]], [], "xlsx");
  assert.equal(workbook.rows[0]?.state, "create");
  assert.deepEqual([workbook.rows[0]?.values.controlNumber, workbook.rows[0]?.values.controlReference], ["42", "0042"]);
});

test("CSV-02 the template's example row is skipped with a note, and the Issues and read-only columns are notes, not warnings", () => {
  const parsed = classify("information-systems", ["Name", "Description", "Owner", "Issues"], [
    ["Example (CSRM skips this row)", "Template example", "Dana Lee", ""],
    ["Real system", "Kept", "Dana Lee", "Row 3: fixed"],
  ]);
  assert.deepEqual(parsed.rows.map((row) => [row.rowNumber, row.state]), [[3, "create"]]);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual([...parsed.notes].sort(), ["example-row", "issues-column", "read-only-columns"]);
  assert.deepEqual(parsed.readOnlyColumns, ["Owner"]);
  const control = classify("controls", ["controlNumber", "name", "framework"], [[" EXAMPLE ", "Example", "ISO"], ["AC-1", "Real", "ISO"]]);
  assert.deepEqual(control.rows.map((row) => row.rowNumber), [3]);
  const riskTypes = classify("risk-types", ["Name", "Owner"], [["Owned risk type", "Dana Lee"]]);
  assert.deepEqual([riskTypes.warnings, riskTypes.notes, riskTypes.readOnlyColumns], [["Owner"], [], []], "Owner is a warning where it is not read-only");
});

test("CSV-02 a row over 65,536 bytes is rejected as VALUE_TOO_LONG and the other rows classify", () => {
  const module = require("../src/api/csrm-administration/services/csv-import") as ClassifyModule;
  const parsed = module.classifyAdministrationImport({
    kind: "risk-types",
    file: {
      format: "csv",
      header: ["name", "description"],
      rows: [
        { rowNumber: 2, cells: ["Long row", "d".repeat(70_000)], byteLength: 70_009 },
        { rowNumber: 3, cells: ["Short row", "fine"], byteLength: 14 },
      ],
    },
  });
  assert.deepEqual(parsed.rows.map((row) => row.state), ["rejected", "create"]);
  assert.deepEqual(parsed.rows[0]?.issues.map(({ code, field }) => ({ code, field })), [{ code: "VALUE_TOO_LONG", field: null }]);
  assert.deepEqual(parsed.rows[0]?.values, {}, "an over-long row carries no values");
});

/*
 * Phase 19 (19-13 Task 3; D-30, D-32, D-18): two keys. The exact key (trimmed, NFC) matches as before; the similar key
 * (NFKC, lower case, collapsed whitespace) finds a name that differs only by capitals or spacing, which waits for the
 * Security Analyst's decision. The uniqueness normaliser is unchanged, so a case-only create is never offered.
 */
type KeyModule = {
  administrationExactKey: (value: string) => string;
  administrationSimilarKey: (value: string) => string;
  normalizeAdministrationNaturalKey: (value: string) => string;
};
type SimilarRowView = ImportRowView & { naturalKey: string | null; matchedDocumentId: string | null; matchedName: string | null };

test("CSV-03 the exact and similar keys, and the unchanged uniqueness normaliser", () => {
  const keys = require("../src/api/csrm-administration/services/administration-query") as KeyModule;
  assert.equal(keys.administrationExactKey("  Café billing  "), "Café billing");
  assert.equal(keys.administrationExactKey("UAT-B: Core"), "UAT-B: Core");
  assert.notEqual(keys.administrationExactKey("uat-b: core"), keys.administrationExactKey("UAT-B: Core"));
  assert.equal(keys.administrationSimilarKey("  UAT-B:  Core\tCustomer  "), "uat-b: core customer");
  assert.equal(keys.administrationSimilarKey("ＵＡＴ-B: Core"), "uat-b: core");
  assert.equal(keys.normalizeAdministrationNaturalKey("  Ａdmin  Name "), "admin  name", "the uniqueness normaliser keeps inner spacing as before");
});

test("CSV-03 Matched by similar name: a name equal only after NFKC, lower case and collapsed whitespace is similar, with the stored name", () => {
  const stored = { documentId: "system-b", name: "UAT-B: Core customer billing system", description: "Billing", updatedAt: "2026-10-01T00:00:00.000Z" };
  const rows = (name: string) => classify("information-systems", ["name", "description"], [[name, "Billing"]], [{ ...stored }]).rows as SimilarRowView[];
  for (const name of ["uat-b: core customer billing system", "UAT-B:  Core customer billing system"]) {
    const [row] = rows(name);
    assert.deepEqual([row?.state, row?.matchedDocumentId, row?.matchedName, row?.naturalKey], ["similar", "system-b", stored.name, name], name);
    assert.equal(row?.values.name, stored.name, "a similar row's values keep the stored name");
  }
  const [exact] = rows("UAT-B: Core customer billing system");
  assert.deepEqual([exact?.state, exact?.matchedName], ["unchanged", stored.name]);
  const [created] = rows("UAT-Z: A new system");
  assert.deepEqual([created?.state, created?.matchedName], ["create", null]);
  const pair = classify("risk-types", ["name"], [["abc"], ["ABC"]]).rows;
  assert.deepEqual(pair.map((row) => [row.state, row.issues.map((item) => item.code)]), [["ambiguous", ["DUPLICATE_CSV_KEY"]], ["ambiguous", ["DUPLICATE_CSV_KEY"]]]);
});

type WorkflowModule = {
  IMPORT_RESULT_TTL_MS: number;
  resultRecordFor: (token: string, actorDocumentId: string, kind: string) => {
    actorDocumentId: string; kind: string; fileDigest: string; fileName: string; format: string;
    rows: ReadonlyArray<{ rowNumber: number; outcome: string; decision: string | null; issues: ReadonlyArray<{ code: string; field: string | null }> }>;
  } | null;
};

const similarStored = () => [{ documentId: "risk-type-b", name: "Core billing outage", description: "old", updatedAt: "2026-10-01T00:00:00.000Z" }];
const refusedAs = (status: number, code: string) => (error: unknown) => error instanceof Error
  && (error as { status?: unknown }).status === status && (error as { code?: unknown }).code === code;

test("CSV-03 IMPORT_DECISION_MISSING: a similar row needs a decision; a decision for another row or a malformed field is 400", async () => {
  const fixture = repositoryFixture(similarStored());
  await withCsvUpload("name,description\r\ncore billing outage,new\r\nBrand new type,one", async (uploads) => {
    const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
    assert.equal((preview.summary as Record<string, number>).similar, 1);
    const commit = (decisions?: string) => commitAdministrationImport({
      repository: fixture.repository, kind: "risk-types", state: administrationState, uploads,
      previewDigest: preview.previewDigest, confirmed: "true", ...(decisions === undefined ? {} : { decisions }),
    } as Parameters<typeof commitAdministrationImport>[0]);
    await assert.rejects(commit(), refusedAs(409, "IMPORT_DECISION_MISSING"));
    await assert.rejects(commit(JSON.stringify({ 2: "update", 3: "update" })), refusedAs(400, "INVALID_IMPORT_DECISIONS"));
    await assert.rejects(commit("not json"), refusedAs(400, "INVALID_IMPORT_DECISIONS"));
    await assert.rejects(commit(JSON.stringify({ 2: "merge" })), refusedAs(400, "INVALID_IMPORT_DECISIONS"));
    await assert.rejects(commit(JSON.stringify({ "002x": "skip" })), refusedAs(400, "INVALID_IMPORT_DECISIONS"));
    await assert.rejects(commit(JSON.stringify(Object.fromEntries(Array.from({ length: 5_001 }, (_, index) => [String(index + 2), "skip"])))), refusedAs(400, "INVALID_IMPORT_DECISIONS"));
    const stored = await fixture.repository.findOne("risk-type-b");
    assert.equal(stored?.description, "old", "a refused commit writes nothing");
    assert.equal((await fixture.repository.findNaturalKeyRecords()).length, 1, "a refused commit creates nothing");
  });
});

test("CSV-03 a similar row decided update keeps the stored name; skip writes nothing; the result record and import.committed follow", async (t) => {
  const workflow = require("../src/api/csrm-administration/services/administration-workflow") as WorkflowModule;
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-17T00:00:00.000Z") });
  const lines: string[] = [];
  const log = { info: (line: string) => { lines.push(line); }, warn: (line: string) => { lines.push(line); } };
  const fixture = repositoryFixture(similarStored());
  await withCsvUpload("name,description\r\ncore billing outage,new\r\nBrand new type,one", async (uploads) => {
    const run = async (decision: "update" | "skip") => {
      const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
      return commitAdministrationImport({
        repository: fixture.repository, kind: "risk-types", state: administrationState, uploads,
        previewDigest: preview.previewDigest, confirmed: "true", decisions: JSON.stringify({ 2: decision }),
        events: { log, actor: { documentId: "analyst-test", displayName: "Bob Analyst" } },
      } as Parameters<typeof commitAdministrationImport>[0]);
    };
    const skipped = await run("skip");
    assert.deepEqual(skipped.summary, { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 });
    const skippedRows = skipped.rows as Array<{ rowNumber: number; state: string; decision?: string; documentId?: string }>;
    assert.deepEqual([skippedRows[0]?.state, skippedRows[0]?.decision, skippedRows[0]?.documentId], ["similar", "skip", undefined]);
    assert.deepEqual(await fixture.repository.findOne("risk-type-b"), similarStored()[0], "skip leaves the record as it is");
    assert.match(String(skipped.resultToken), /^sha256:[a-f0-9]{64}$/);

    const record = workflow.resultRecordFor(String(skipped.resultToken), "analyst-test", "risk-types");
    assert.equal(record?.format, "csv");
    assert.equal(record?.fileName, "import.csv");
    assert.deepEqual(record?.rows.map(({ rowNumber, outcome, decision }) => ({ rowNumber, outcome, decision })), [
      { rowNumber: 2, outcome: "skipped", decision: "skip" },
      { rowNumber: 3, outcome: "created", decision: null },
    ]);
    assert.equal(workflow.resultRecordFor(String(skipped.resultToken), "another-analyst", "risk-types"), null, "bound to the actor");
    assert.equal(workflow.resultRecordFor(String(skipped.resultToken), "analyst-test", "controls"), null, "bound to the collection");

    const updated = await run("update");
    const updatedRows = updated.rows as Array<{ state: string; decision?: string; documentId?: string }>;
    assert.deepEqual([updatedRows[0]?.state, updatedRows[0]?.decision, updatedRows[0]?.documentId], ["similar", "update", "risk-type-b"]);
    assert.equal((updated.summary as Record<string, number>).update, 1, "a similar row decided update counts under update");
    const stored = await fixture.repository.findOne("risk-type-b");
    assert.deepEqual([stored?.name, stored?.description], ["Core billing outage", "new"], "update applies the values and keeps the stored name");

    assert.equal(workflow.IMPORT_RESULT_TTL_MS, 300_000);
    t.mock.timers.tick(workflow.IMPORT_RESULT_TTL_MS + 1);
    assert.equal(workflow.resultRecordFor(String(updated.resultToken), "analyst-test", "risk-types"), null, "gone after the TTL");
  });
  const events = lines.filter((line) => line.startsWith("csrm.security_event ")).map((line) => JSON.parse(line.slice("csrm.security_event ".length)) as Record<string, unknown>);
  assert.equal(events.length, 2, "one import.committed line per commit");
  assert.equal(events[0]?.event, "import.committed");
  assert.deepEqual(events[0]?.counts, { created: 1, updated: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 });
  assert.equal(events[0]?.collection, "risk-types");
  assert.equal(events[0]?.format, "csv");
  assert.equal(events[0]?.fileName, "import.csv");
  assert.match(String(events[0]?.sha256), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(lines.join("\n"), /Brand new type|core billing outage|"new"/, "no cell value is logged");
});

test("CSV-03 an expired preview is 409 IMPORT_REVIEW_EXPIRED, where bdd0f698 answered IMPORT_PREVIEW_CHANGED (deliberate change)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-17T01:00:00.000Z") });
  const fixture = repositoryFixture([]);
  await withCsvUpload("name\r\nExpiring type", async (uploads) => {
    const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
    t.mock.timers.tick(5 * 60 * 1_000 + 1);
    await assert.rejects(
      commitAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads, previewDigest: preview.previewDigest, confirmed: "true" }),
      refusedAs(409, "IMPORT_REVIEW_EXPIRED"),
    );
    assert.equal((await fixture.repository.findNaturalKeyRecords()).length, 0);
  });
});

/*
 * 19-14 (D-32): the error report reads Strapi's own records, which live five minutes in this process. Integration tests
 * cannot reach those stores (the harness loads its own compiled module), so the expiry is proven here with a fake clock.
 */
test("CSV-02 D-32 an expired preview or result record is 409 IMPORT_REVIEW_EXPIRED at the error report, and a live one builds it", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-17T02:00:00.000Z") });
  const fixture = repositoryFixture([]);
  await withCsvUpload(`name\r\nExpiring report type\r\n${"x".repeat(300)}\r\n`, async (uploads) => {
    const input = { repository: fixture.repository, kind: "risk-types" as const, state: administrationState, uploads };
    const reviewed = await previewAdministrationImport(input);
    const live = await buildImportErrorReport({ kind: "risk-types", state: administrationState, uploads, previewDigest: reviewed.previewDigest });
    assert.deepEqual([live.format, live.rowCount, live.fileName], ["csv", 1, "risk-types-import-issues-2026-10-17.csv"]);
    const committed = await commitAdministrationImport({ ...input, previewDigest: reviewed.previewDigest, confirmed: "true" });
    const fromResult = await buildImportErrorReport({ kind: "risk-types", state: administrationState, uploads, resultToken: committed.resultToken });
    assert.equal(fromResult.rowCount, 1);
    const pending = await previewAdministrationImport(input);
    t.mock.timers.tick(5 * 60 * 1_000 + 1);
    await assert.rejects(buildImportErrorReport({ kind: "risk-types", state: administrationState, uploads, previewDigest: pending.previewDigest }), refusedAs(409, "IMPORT_REVIEW_EXPIRED"));
    await assert.rejects(buildImportErrorReport({ kind: "risk-types", state: administrationState, uploads, resultToken: committed.resultToken }), refusedAs(409, "IMPORT_REVIEW_EXPIRED"));
  });
});

test("a similar row decided update whose only value is the name counts and logs as unchanged, after the record's existence check (BE3-03)", async () => {
  const lines: string[] = [];
  const log = { info: (line: string) => { lines.push(line); }, warn: (line: string) => { lines.push(line); } };
  const commit = async (fixture: ReturnType<typeof repositoryFixture>, uploads: Record<string, unknown>, beforeCommit?: () => void) => {
    const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
    beforeCommit?.();
    return commitAdministrationImport({
      repository: fixture.repository, kind: "risk-types", state: administrationState, uploads,
      previewDigest: preview.previewDigest, confirmed: "true", decisions: JSON.stringify({ 2: "update" }),
      events: { log, actor: { documentId: "analyst-test", displayName: "Bob Analyst" } },
    } as Parameters<typeof commitAdministrationImport>[0]);
  };
  await withCsvUpload("name\r\ncore billing outage", async (uploads) => {
    const fixture = repositoryFixture(similarStored());
    const result = await commit(fixture, uploads);
    assert.deepEqual(result.summary, { create: 0, update: 0, unchanged: 1, rejected: 0, ambiguous: 0, skipped: 0 });
    const rows = result.rows as Array<{ state: string; decision?: string; documentId?: string }>;
    assert.deepEqual([rows[0]?.state, rows[0]?.decision, rows[0]?.documentId], ["unchanged", undefined, undefined], "nothing was written");

    // The record the row matched is gone by the commit: the row is not reported as a silent success.
    const removed = repositoryFixture(similarStored());
    const gone = await commit(removed, uploads, () => {
      removed.repository.findOne = async () => null;
    });
    const goneRows = gone.rows as Array<{ state: string }>;
    assert.equal(goneRows[0]?.state, "rejected", "a matched record removed before the commit is rejected");
    assert.equal((gone.summary as Record<string, number>).unchanged, 0);
  });
  const events = lines.filter((line) => line.startsWith("csrm.security_event ")).map((line) => JSON.parse(line.slice("csrm.security_event ".length)) as Record<string, unknown>);
  assert.deepEqual(events[0]?.counts, { created: 0, updated: 0, unchanged: 1, rejected: 0, ambiguous: 0, skipped: 0 });
});

test("IMPORT_FILE_TOO_LARGE reports the measured size, never the size the client declared (BE3-06)", async () => {
  const directory = await mkdtemp(join(tmpdir(), "csrm-administration-size-"));
  try {
    const small = join(directory, "small.csv");
    await writeFile(small, "name\r\nDeclared huge");
    const declaredHuge = { file: { filepath: small, originalFilename: "small.csv", mimetype: "text/csv", size: 99_999_999 } };
    const fixture = repositoryFixture([]);
    try {
      await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads: declaredHuge });
    } catch (error) {
      assert.doesNotMatch(JSON.stringify((error as { details?: unknown }).details ?? null), /99999999/, "the declared size is never echoed");
      assert.fail(`a small file declared huge was refused: ${String(error)}`);
    }

    const large = join(directory, "large.csv");
    await writeFile(large, Buffer.alloc(5_242_881, 0x61));
    const declaredSmall = { file: { filepath: large, originalFilename: "large.csv", mimetype: "text/csv", size: 10 } };
    await assert.rejects(
      previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads: declaredSmall }),
      (error: unknown) => {
        assert.equal((error as { code?: unknown }).code, "IMPORT_FILE_TOO_LARGE");
        assert.deepEqual((error as { details?: { found?: unknown } }).details?.found, { bytes: 5_242_881 }, "the measured size");
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the xlsx error report writes a cell longer than Excel allows cut, with the visible suffix (the Phase 19 review amendment, BE1-02)", async () => {
  const { buildXlsxBytes } = require("./helpers/spreadsheet-fixtures") as typeof import("./helpers/spreadsheet-fixtures");
  const { readWorkbookSheets } = require("../src/csrm/spreadsheets/xlsx-reader") as typeof import("../src/csrm/spreadsheets/xlsx-reader");
  const long = `D${"d".repeat(39_999)}`;
  const bytes = buildXlsxBytes([{ name: "Sheet1", rows: [["name", "description"], ["Too long type", long]] }]);
  const directory = await mkdtemp(join(tmpdir(), "csrm-administration-xlsx-"));
  try {
    const filepath = join(directory, "import.xlsx");
    await writeFile(filepath, bytes);
    const uploads = { file: { filepath, originalFilename: "import.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: bytes.length } };
    const fixture = repositoryFixture([]);
    const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state: administrationState, uploads });
    const report = await buildImportErrorReport({ kind: "risk-types", state: administrationState, uploads, previewDigest: preview.previewDigest });
    assert.equal(report.format, "xlsx");
    const [header, row] = (await readWorkbookSheets(report.bytes))[0].rows;
    const description = String(row[header.indexOf("description")]);
    assert.equal(description.length, 32_767, "cut to Excel's limit");
    assert.ok(description.endsWith(" [cut: longer than Excel allows]"), "with the visible suffix");
    assert.ok(description.startsWith("Dddd"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a workbook with formatted empty rows, styled empty cells and a whole-sheet dimension previews as its valued rows (BE3-01)", async () => {
  const { buildRawSheetWorkbook } = require("./helpers/spreadsheet-fixtures") as typeof import("./helpers/spreadsheet-fixtures");
  const header = `<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>description</t></is></c></row>`;
  const valued = `<row r="2"><c r="A2" t="inlineStr"><is><t>First type</t></is></c><c r="B2" t="inlineStr"><is><t>one</t></is></c></row>`;
  const formatted = buildRawSheetWorkbook([{
    part: "worksheets/sheet1.xml",
    dimension: "A1:XFD1048576",
    sheetData: `${header}<row r="2" s="1" customFormat="1"><c r="A2" t="inlineStr"><is><t>First type</t></is></c><c r="B2" t="inlineStr"><is><t>one</t></is></c><c r="AMK2" s="1"/></row>`
      + `<row r="9000" s="1" customFormat="1"/><row r="9001" s="1" customFormat="1"><c r="C9001" s="1"/></row>`,
  }]);
  const plain = buildRawSheetWorkbook([{ part: "worksheets/sheet1.xml", sheetData: `${header}${valued}` }]);
  const previewOf = async (bytes: Buffer) => {
    const directory = await mkdtemp(join(tmpdir(), "csrm-administration-formatted-"));
    try {
      const filepath = join(directory, "import.xlsx");
      await writeFile(filepath, bytes);
      const uploads = { file: { filepath, originalFilename: "import.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: bytes.length } };
      const preview = await previewAdministrationImport({ repository: repositoryFixture([]).repository, kind: "risk-types", state: administrationState, uploads });
      const { previewDigest: _digest, ...rest } = preview as unknown as Record<string, unknown>;
      return rest;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
  assert.deepEqual(await previewOf(formatted), await previewOf(plain), "the same preview as the valued cells alone");
});

/*
 * T-19-45 (19-SECURITY.md, stage B): the preview records live in this process, so their store is bounded. A 17th
 * preview for one actor and collection drops that actor's oldest, the store keeps at most 256 records in all, dropping
 * the oldest first, and a preview whose retained issue data passes 1 MiB is refused before it is kept.
 */
test("T-19-45 the preview store keeps at most 16 records per actor and collection, dropping the oldest", async () => {
  const fixture = repositoryFixture([]);
  await withCsvUpload("name\r\nCapped type", async (uploads) => {
    const state = { ...administrationState, idamboxUser: { documentId: "cap-actor" } };
    const tokens: string[] = [];
    for (let index = 0; index < 17; index += 1) {
      const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state, uploads });
      tokens.push(String(preview.previewDigest));
    }
    assert.equal(previewRecordForReport(tokens[0]!, "cap-actor", "risk-types"), null, "the 17th preview drops the actor's oldest");
    for (const token of tokens.slice(1)) assert.notEqual(previewRecordForReport(token, "cap-actor", "risk-types"), null, "the other 16 stay");
  });
});

test("T-19-45 the preview store keeps at most 256 records in all, dropping the oldest first", async () => {
  const fixture = repositoryFixture([]);
  await withCsvUpload("name\r\nCapped type", async (uploads) => {
    const issued: Array<{ token: string; actor: string }> = [];
    // 17 actors with 16 previews each: 272 records, none beyond its actor's cap, so only the store's cap drops any.
    for (let actorIndex = 0; actorIndex < 17; actorIndex += 1) {
      const actor = `store-cap-actor-${actorIndex}`;
      const state = { ...administrationState, idamboxUser: { documentId: actor } };
      for (let index = 0; index < 16; index += 1) {
        const preview = await previewAdministrationImport({ repository: fixture.repository, kind: "risk-types", state, uploads });
        issued.push({ token: String(preview.previewDigest), actor });
      }
    }
    const live = issued.map(({ token, actor }) => previewRecordForReport(token, actor, "risk-types") !== null);
    assert.equal(live.filter(Boolean).length, 256, "the store holds 256 records");
    assert.deepEqual(live.slice(0, 16), Array(16).fill(false), "the oldest 16 are dropped");
    assert.deepEqual(live.slice(16), Array(256).fill(true), "the newest 256 stay");
  });
});

test("T-19-45 a preview whose retained issue data passes 1 MiB is refused as IMPORT_WORKBOOK_TOO_LARGE", async () => {
  const fixture = repositoryFixture([]);
  const header = "name,environment,deploymentModel,lifecycleState,internetFacing,externalAccessRequired";
  const rows = (count: number) => Array.from({ length: count }, (_, index) => `System ${index},Moon,Floppy,Ancient,perhaps,sometimes`).join("\r\n");
  // The same rows, few enough to stay within the bound, are kept: the refusal is the bound's, not the rows'.
  await withCsvUpload(`${header}\r\n${rows(100)}`, async (uploads) => {
    const kept = await previewAdministrationImport({ repository: fixture.repository, kind: "information-systems", state: administrationState, uploads });
    assert.equal((kept.summary as Record<string, number>).rejected, 100);
    assert.notEqual(previewRecordForReport(String(kept.previewDigest), "analyst-test", "information-systems"), null);
  });
  await withCsvUpload(`${header}\r\n${rows(5_000)}`, async (uploads) => {
    await assert.rejects(
      previewAdministrationImport({ repository: fixture.repository, kind: "information-systems", state: administrationState, uploads }),
      refusedAs(422, "IMPORT_WORKBOOK_TOO_LARGE"),
    );
  });
});

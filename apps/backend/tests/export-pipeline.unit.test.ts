import assert from "node:assert/strict";
import test from "node:test";

import type { RiskRegisterRepository } from "../src/api/csrm-risk/services/risk-register";
import {
  parseRiskRegisterExportQuery,
  parseRiskRegisterQuery,
  RiskRegisterQueryError,
  type RiskRegisterFilters,
  type RiskRegisterSort,
} from "../src/api/csrm-risk/services/risk-register-query";
import { formatExportedAt, localCalendarDate, parseExportTimeZone } from "../src/csrm/exports/export-time";
import { inIdOrder, riskRegisterExportView, type ListExportView } from "../src/csrm/exports/export-views";
import {
  EXPORT_HYDRATE_BATCH,
  EXPORT_ROW_CAP,
  ExportQueryError,
  ExportRefusalError,
  runFixedTableExport,
  runListExport,
  type ExportTable,
} from "../src/csrm/exports/run-export";
import { EXPORT_MEDIA_TYPES, exportFileName, resolveExportActor, sendExportError, sendExportFile } from "../src/csrm/exports/send-export";
import { readWorkbookSheets, type XlsxCell } from "../src/csrm/spreadsheets/xlsx-reader";

/*
 * The one export pipeline (19-04; D-05 to D-10, D-17, D-18; G-16). Every rule is proven with a fake register
 * repository and no HTTP: the export takes the list's own parser, repository and projection, writes the chosen columns
 * with display values, and logs one security event line per attempt.
 */

const NOW = new Date("2026-10-01T12:00:00.000Z");
const TODAY = "2026-10-01";
const HYPERLINK = '=HYPERLINK("https://example.test","Click")';
const ACTOR = { documentId: "user-bob", displayName: "Bob Analyst" } as const;
const STATE = { csrmAuthorization: { riskRegisterCollectionScope: "all" } } as const;
const VISIBLE_KEYS = ["riskNumber", "riskStatement", "inherentRating", "residualRating", "treatmentStatus", "treatmentOwner", "targetDate", "assessment"];
const VISIBLE_LABELS = ["Risk number", "Statement", "Inherent rating", "Residual rating", "Treatment status", "Treatment owner", "Target date", "Related assessment"];

type Doc = Record<string, unknown>;

const ASSESSMENT = {
  documentId: "assessment-1",
  assessmentNumber: "ASM-001",
  assessmentStatus: "in-review",
  approvedBy: null,
  approvalDate: null,
  assessmentRequest: { title: "Payroll upgrade", assessmentType: "Project" },
};

function risk(documentId: string, riskNumber: string, changes: Doc = {}): Doc {
  return {
    documentId,
    riskNumber,
    riskStatement: `${riskNumber} statement`,
    inherentRating: "High",
    residualRating: "Moderate",
    treatmentStatus: "In Progress",
    treatmentAction: "Treat",
    treatmentPlan: "Patch the server",
    treatmentOwner: { documentId: "user-jane", displayName: "Jane Owner" },
    targetDate: "2027-01-31",
    treatmentResolveDate: null,
    closureDate: null,
    withdrawnAt: null,
    assessment: ASSESSMENT,
    riskOwner: { documentId: "user-rita", displayName: "Rita Owner" },
    riskType: { documentId: "type-1", name: "Access control" },
    informationSystemImpacted: { documentId: "system-1", name: "Payroll" },
    informationAssetImpacted: null,
    ...changes,
  };
}

const RISKS: readonly Doc[] = [
  risk("risk-1", "RSK-001", { riskStatement: HYPERLINK }),
  risk("risk-2", "RSK-002", { riskStatement: "Nobody owns the treatment", treatmentOwner: null }),
  risk("risk-3", "RSK-003", { riskStatement: "Past its target date", targetDate: "2026-09-01", treatmentStatus: "Not Started" }),
  risk("risk-4", "RSK-004", { riskStatement: "Taken out of the assessment", withdrawnAt: "2026-09-15T00:00:00.000Z" }),
  risk("risk-5", "RSK-005", { riskStatement: "Closed and done", closureDate: "2026-09-20", treatmentStatus: "Complete" }),
];

type Calls = {
  count: Array<{ filters: RiskRegisterFilters; today: string }>;
  selectPage: Array<{ filters: RiskRegisterFilters; sort: RiskRegisterSort; offset: number; limit: number; today: string }>;
  hydrate: Array<{ ids: readonly string[]; relations: readonly string[] | undefined }>;
};

/** A register repository over RISKS: the default reads active Risks only, state=withdrawn the withdrawn ones alone. */
function fakeRepository(options: { total?: number; ids?: readonly string[] } = {}): RiskRegisterRepository & { calls: Calls } {
  const calls: Calls = { count: [], selectPage: [], hydrate: [] };
  const matching = (filters: RiskRegisterFilters) => RISKS.filter((document) => {
    const withdrawn = document.withdrawnAt !== null;
    if (filters.state === "withdrawn" ? !withdrawn : withdrawn) return false;
    if (filters.state === "open" && document.closureDate) return false;
    if (filters.state === "closed" && !document.closureDate) return false;
    if (filters.q && !String(document.riskStatement).includes(filters.q) && !String(document.riskNumber).includes(filters.q)) return false;
    return true;
  });
  return {
    calls,
    async count(filters, today) {
      calls.count.push({ filters, today });
      return options.total ?? matching(filters).length;
    },
    async selectPage(input) {
      calls.selectPage.push(input);
      return [...(options.ids ?? matching(input.filters).map((document) => String(document.documentId)))];
    },
    async hydrate(documentIds, hydrateOptions) {
      calls.hydrate.push({ ids: [...documentIds], relations: hydrateOptions?.relations ? [...hydrateOptions.relations] : undefined });
      // Out of order, as a database may return them: the pipeline keeps the list's order.
      return RISKS.filter((document) => documentIds.includes(String(document.documentId))).reverse();
    },
    async selectedLabels() {
      return {};
    },
  };
}

function recordingLogger() {
  const calls: Array<{ level: "info" | "warn"; message: string }> = [];
  return {
    calls,
    info: (message: string) => calls.push({ level: "info", message }),
    warn: (message: string) => calls.push({ level: "warn", message }),
  };
}

function parseLine(message: string): Record<string, unknown> {
  const prefix = "csrm.security_event ";
  assert.ok(message.startsWith(prefix), `the line starts with ${prefix}`);
  return JSON.parse(message.slice(prefix.length)) as Record<string, unknown>;
}

async function exportOf(query: Record<string, unknown>, repository = fakeRepository(), view?: ListExportView<any, any>) {
  const log = recordingLogger();
  const file = await runListExport({ view: view ?? riskRegisterExportView(repository), query, state: STATE, actor: ACTOR, now: NOW, log });
  const sheets = file.format === "xlsx" ? await readWorkbookSheets(file.bytes) : [];
  return { file, log, repository, sheets };
}

function aboutRows(sheets: Awaited<ReturnType<typeof readWorkbookSheets>>): Map<string, XlsxCell> {
  const about = sheets[sheets.length - 1];
  assert.equal(about.name, "About this export");
  return new Map(about.rows.slice(1).map((row) => [String(row[0]), row[1] ?? null]));
}

test("a filtered register exports its visible columns to a workbook with one export.completed line", async () => {
  const { file, log, sheets } = await exportOf({ q: "HYPERLINK", format: "xlsx" });
  assert.equal(file.format, "xlsx");
  assert.equal(file.rowCount, 1);
  assert.equal(file.fileName, "risk-register-2026-10-01.xlsx");
  assert.equal(sheets[0].name, "Risk register");
  assert.deepEqual(sheets[0].rows[0], VISIBLE_LABELS);
  assert.equal(sheets[0].rows.length, 2, "one data row");
  const row = sheets[0].rows[1];
  assert.equal(row[0], "RSK-001");
  assert.equal(typeof row[1], "string", "the statement is a string cell, never a formula");
  assert.equal(row[1], `'${HYPERLINK}`, "the formula-like statement carries the neutraliser mark");
  assert.equal(row[6] instanceof Date && row[6].toISOString(), "2027-01-31T00:00:00.000Z", "a calendar date is a date cell");
  assert.equal(row[7], "ASM-001", "a record by its number");

  assert.equal(log.calls.length, 1, "exactly one log line");
  assert.equal(log.calls[0].level, "info");
  const line = parseLine(log.calls[0].message);
  assert.equal(line.event, "export.completed");
  assert.equal(line.view, "risk-register");
  assert.equal(line.format, "xlsx");
  assert.deepEqual(line.columns, VISIBLE_KEYS);
  assert.equal(line.search, "HYPERLINK");
  assert.equal(line.rowCount, 1);
  assert.equal(line.outcome, "exported");
  assert.equal("reason" in line, false, "a completed export names no reason");
  assert.equal(log.calls[0].message.includes("Click"), false, "no cell value reaches the log");
});

test("an absent value is an empty cell, and the due state is copied from the projection, never computed (G-16)", async () => {
  const query = { format: "xlsx", columns: "riskNumber,treatmentOwner,treatmentDueState" };
  const { sheets } = await exportOf(query);
  const rows = new Map(sheets[0].rows.slice(1).map((row) => [row[0], row]));
  assert.deepEqual(sheets[0].rows[0], ["Risk number", "Treatment owner", "Due state"]);
  assert.equal(rows.get("RSK-002")?.[1] ?? null, null, "no treatment owner is an empty cell");
  assert.equal(rows.get("RSK-001")?.[1], "Jane Owner", "a person by display name");
  assert.equal(rows.get("RSK-003")?.[2], "Overdue", "the overdue Risk reads the projection's label");

  // Replace the projection's due state: the export copies whatever the list's projection says.
  const repository = fakeRepository();
  const base = riskRegisterExportView(repository);
  const replaced: ListExportView<any, any> = {
    ...base,
    project: (document: Doc, today: string) => {
      const projected = base.project(document, today);
      return { ...projected, item: { ...projected.item, treatmentDueState: "later" } };
    },
  };
  const again = await exportOf(query, repository, replaced);
  const dueStates = again.sheets[0].rows.slice(1).map((row) => row[2]);
  assert.ok(dueStates.length > 0);
  assert.deepEqual(new Set(dueStates), new Set(["Due later"]), "the export copied the replaced due state");
});

test("the count, the ids and the projection share one UTC today, and ids are read from offset 0 with the cap plus one", async () => {
  const repository = fakeRepository();
  const base = riskRegisterExportView(repository);
  const projected: string[] = [];
  const recording: ListExportView<any, any> = {
    ...base,
    project: (document: Doc, today: string) => {
      projected.push(today);
      return base.project(document, today);
    },
  };
  await exportOf({ format: "xlsx" }, repository, recording);
  assert.deepEqual(repository.calls.count.map((call) => call.today), [TODAY]);
  assert.deepEqual(repository.calls.selectPage.map((call) => call.today), [TODAY]);
  assert.equal(repository.calls.selectPage[0].limit, 10_001);
  assert.equal(repository.calls.selectPage[0].limit, EXPORT_ROW_CAP + 1);
  assert.equal(repository.calls.selectPage[0].offset, 0);
  assert.deepEqual(repository.calls.selectPage[0].sort, { field: "targetDate", direction: "asc" }, "the list's own default sort");
  assert.ok(projected.length > 0);
  assert.deepEqual(new Set(projected), new Set([TODAY]));
});

test("the withdrawn export lists the withdrawn Risks alone with State Withdrawn and names the filter on the About sheet", async () => {
  const { file, repository, sheets } = await exportOf({ state: "withdrawn", format: "xlsx", columns: "riskNumber,riskState" });
  assert.equal(repository.calls.count[0].filters.state, "withdrawn");
  assert.equal(repository.calls.selectPage[0].filters.state, "withdrawn");
  assert.deepEqual(sheets[0].rows, [["Risk number", "State"], ["RSK-004", "Withdrawn"]]);
  assert.equal(file.rowCount, 1);
  assert.equal(aboutRows(sheets).get("Filters"), "Risk state: Withdrawn");
});

test("the default export passes no state filter, and an active Risk reads Closed with a closure date and Open without", async () => {
  const { repository, sheets } = await exportOf({ format: "xlsx", columns: "riskNumber,riskState" });
  assert.equal("state" in repository.calls.count[0].filters, false, "the register's base query then applies the active-risk rule");
  assert.equal("state" in repository.calls.selectPage[0].filters, false);
  const states = new Map(sheets[0].rows.slice(1).map((row) => [row[0], row[1]]));
  assert.equal(states.has("RSK-004"), false, "no withdrawn Risk in the default export");
  assert.equal(states.get("RSK-001"), "Open");
  assert.equal(states.get("RSK-005"), "Closed");
});

test("columns are written in the view's canonical order, with display labels for stage, flags and other columns", async () => {
  const { sheets } = await exportOf({ format: "xlsx", columns: "accepted,stage,riskNumber,riskType,riskOwner,requestTitle,assessmentType,informationSystem,informationAsset,treatmentAction,treatmentPlan" });
  assert.deepEqual(sheets[0].rows[0], [
    "Risk number", "Stage", "Accepted", "Request title", "Assessment type", "Risk owner", "Risk Type", "Treatment action", "Treatment plan",
    "Impacted system", "Impacted asset",
  ]);
  const first = sheets[0].rows.find((row) => row[0] === "RSK-001");
  assert.deepEqual(first, ["RSK-001", "Under assessment", "No", "Payroll upgrade", "Project", "Rita Owner", "Access control", "Treat", "Patch the server", "Payroll", null]);
});

test("hydration reads only the relations the chosen columns need", async () => {
  const chosen = await exportOf({ format: "xlsx", columns: "riskNumber,riskOwner,informationAsset" });
  assert.deepEqual(chosen.repository.calls.hydrate[0].relations, ["riskOwner", "informationAssetImpacted"]);
  const visible = await exportOf({ format: "xlsx" });
  assert.deepEqual(visible.repository.calls.hydrate[0].relations, []);
});

test("a query the register refuses is an ExportQueryError and logs export.refused with INVALID_QUERY at info", async () => {
  const repository = fakeRepository();
  const log = recordingLogger();
  await assert.rejects(
    runListExport({ view: riskRegisterExportView(repository), query: { format: "xlsx", status: "nope" }, state: STATE, actor: ACTOR, now: NOW, log }),
    ExportQueryError,
  );
  assert.equal(repository.calls.count.length, 0, "nothing is counted");
  assert.equal(log.calls.length, 1);
  assert.equal(log.calls[0].level, "info");
  const line = parseLine(log.calls[0].message);
  assert.equal(line.event, "export.refused");
  assert.equal(line.reason, "INVALID_QUERY");
  assert.equal(line.rowCount, null);
  assert.equal(line.outcome, "refused");
});

test("the register export parser refuses page and pageSize and parses the rest as the list parses it", () => {
  assert.throws(() => parseRiskRegisterExportQuery({ page: "2" }), RiskRegisterQueryError);
  assert.throws(() => parseRiskRegisterExportQuery({ pageSize: "50" }), RiskRegisterQueryError);
  for (const sort of ["riskNumber:desc", "assessment:asc", "targetDate:desc"]) {
    assert.deepEqual(parseRiskRegisterExportQuery({ sort }).sort, parseRiskRegisterQuery({ sort }).sort);
  }
  for (const sort of ["nope:asc", "riskNumber:sideways", "riskNumber"]) {
    assert.throws(() => parseRiskRegisterQuery({ sort }), RiskRegisterQueryError);
    assert.throws(() => parseRiskRegisterExportQuery({ sort }), RiskRegisterQueryError);
  }
  assert.deepEqual(parseRiskRegisterExportQuery({ state: "withdrawn" }).filters, parseRiskRegisterQuery({ state: "withdrawn" }).filters);
  const full = { q: "payroll", residualRating: "none", dueState: "overdue", targetDateFrom: "2026-01-01", sort: "riskNumber:asc" };
  const listed = parseRiskRegisterQuery(full);
  assert.deepEqual(parseRiskRegisterExportQuery(full), { filters: listed.filters, sort: listed.sort });
  assert.throws(() => parseRiskRegisterExportQuery({ status: "open" }), RiskRegisterQueryError);
  assert.equal(parseRiskRegisterQuery({ page: "2" }).page, 2, "the list parser keeps its behaviour");
});

/* ------------------------------------------------------------------------------------------------------------------
 * Task 3: zones, the About sheet, CSV, the cap and its race, closed controls, fixed tables and the file response.
 * ---------------------------------------------------------------------------------------------------------------- */

const SYDNEY = "Australia/Sydney";
const FORMULA_NOTE = "Values that begin with =, +, -, @, a tab or a line break start with an apostrophe (') so they open as text. CSRM removes it when the file is imported.";
const UTC_SENTENCE = "(UTC, because your time zone wasn’t known; dates in this file use UTC)";

type AssessmentRow = { assessmentNumber: string; requestTitle: string; overallRating: string | null; releasedAt: string | null };

/** A fake list view over the My risk assessments vocabulary, which has an instant column. */
function fakeAssessmentView(rows: readonly AssessmentRow[], options: { total?: number; ids?: readonly string[] } = {}) {
  const calls = { count: 0, selectIds: 0, hydrate: [] as number[] };
  const view: ListExportView<Record<string, never>, AssessmentRow> = {
    key: "my-risk-assessments",
    slug: "my-risk-assessments",
    heading: "My risk assessments",
    assertScope: () => undefined,
    parseExportQuery(query) {
      if (Object.keys(query).length > 0) throw new ExportQueryError();
      return {};
    },
    auditQuery: () => ({ filters: {}, search: null, sort: null }),
    describe: async () => ({ search: null, filters: [], sort: null }),
    async count() {
      calls.count += 1;
      return options.total ?? rows.length;
    },
    async selectIds() {
      calls.selectIds += 1;
      return options.ids ?? rows.map((row) => row.assessmentNumber);
    },
    async hydrate(ids) {
      calls.hydrate.push(ids.length);
      return ids.map((id) => ({ documentId: id }));
    },
    project: (document) => rows.find((row) => row.assessmentNumber === document.documentId)
      ?? { assessmentNumber: String(document.documentId), requestTitle: "Bulk", overallRating: null, releasedAt: null },
    extractors: {
      assessmentNumber: (row) => row.assessmentNumber,
      requestTitle: (row) => row.requestTitle,
      overallRating: (row) => row.overallRating,
      releasedAt: (row) => row.releasedAt,
    },
  };
  return { view, calls };
}

const RELEASED: readonly AssessmentRow[] = [
  { assessmentNumber: "ASM-001", requestTitle: "Payroll upgrade", overallRating: "High", releasedAt: "2026-09-30T15:00:00.000Z" },
];

async function assessmentExport(query: Record<string, unknown>, now = NOW) {
  const { view } = fakeAssessmentView(RELEASED);
  const log = recordingLogger();
  const file = await runListExport({ view, query, state: STATE, actor: ACTOR, now, log });
  return { file, log, sheets: file.format === "xlsx" ? await readWorkbookSheets(file.bytes) : [] };
}

function csvText(bytes: Buffer): string {
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "a UTF-8 byte order mark");
  return bytes.subarray(3).toString("utf8");
}

test("an instant is the viewer's local calendar date: 1 Oct in Sydney, 30 Sep in UTC", async () => {
  const sydney = await assessmentExport({ format: "xlsx", timeZone: SYDNEY });
  const released = sydney.sheets[0].rows[1][3];
  assert.ok(released instanceof Date);
  assert.equal(released.toISOString(), "2026-10-01T00:00:00.000Z");
  const csv = await assessmentExport({ format: "csv", timeZone: SYDNEY });
  assert.equal(csvText(csv.file.bytes).split("\r\n")[1], '"ASM-001","Payroll upgrade","High",2026-10-01');
  const utc = await assessmentExport({ format: "xlsx" });
  assert.equal((utc.sheets[0].rows[1][3] as Date).toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(parseLine(sydney.log.calls[0].message).timeZone, SYDNEY);
  assert.equal(parseLine(utc.log.calls[0].message).timeZone, "UTC-fallback");
});

test("an unknown or over-long time zone is refused, and an absent one falls back to UTC", async () => {
  assert.deepEqual(parseExportTimeZone(undefined), { zone: "UTC", fallback: true });
  assert.deepEqual(parseExportTimeZone(SYDNEY), { zone: SYDNEY, fallback: false });
  for (const zone of ["Mars/Base", `Australia/${"x".repeat(55)}`, "", 7, ["UTC"]]) {
    assert.throws(() => parseExportTimeZone(zone), ExportQueryError, `refused ${String(zone)}`);
  }
  assert.equal(`Australia/${"x".repeat(55)}`.length, 65);
  for (const timeZone of ["Mars/Base", `Australia/${"x".repeat(55)}`]) {
    const log = recordingLogger();
    await assert.rejects(runListExport({ view: fakeAssessmentView(RELEASED).view, query: { format: "xlsx", timeZone }, state: STATE, actor: ACTOR, now: NOW, log }), ExportQueryError);
    assert.equal(parseLine(log.calls[0].message).reason, "INVALID_QUERY");
  }
  assert.deepEqual(localCalendarDate(new Date("2026-09-30T15:00:00.000Z"), SYDNEY), { iso: "2026-10-01", utcMidnight: new Date("2026-10-01T00:00:00.000Z") });
  assert.equal(localCalendarDate(new Date("2026-09-30T15:00:00.000Z"), "UTC").iso, "2026-09-30");
});

test("the file is named for the view and the viewer's local date", async () => {
  const late = new Date("2026-09-30T15:00:00.000Z");
  assert.equal((await assessmentExport({ format: "csv", timeZone: SYDNEY }, late)).file.fileName, "my-risk-assessments-2026-10-01.csv");
  assert.equal((await assessmentExport({ format: "csv" }, late)).file.fileName, "my-risk-assessments-2026-09-30.csv");
});

test("About this export is the last sheet, with Item and Detail and its rows in order", async () => {
  const { sheets } = await exportOf({ q: "RSK", residualRating: "Moderate", format: "xlsx", columns: "riskStatement,riskNumber", timeZone: SYDNEY });
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Risk register", "About this export"]);
  const about = sheets[1];
  assert.deepEqual(about.rows[0], ["Item", "Detail"]);
  assert.deepEqual(about.rows.slice(1).map((row) => row[0]), [
    "View", "Search", "Filters", "Sorted by", "Columns", "Rows", "Exported", "Exported by", "Values that look like formulas",
  ]);
  const detail = aboutRows(sheets);
  assert.equal(detail.get("View"), "Risk register");
  assert.equal(detail.get("Search"), "“RSK”");
  assert.equal(detail.get("Filters"), "Residual rating: Moderate");
  assert.equal(detail.get("Sorted by"), "Target date, ascending");
  assert.equal(detail.get("Columns"), "Risk number, Statement");
  assert.equal(detail.get("Rows"), 4);
  assert.match(String(detail.get("Exported")), /^1 Oct 2026, 10:00\spm \(Australia\/Sydney\)$/u);
  assert.equal(detail.get("Exported by"), "Bob Analyst");
  assert.equal(detail.get("Values that look like formulas"), FORMULA_NOTE);
});

test("About this export omits the rows that do not apply and reads the UTC sentence when the zone was not known", async () => {
  const { sheets } = await exportOf({ format: "xlsx", sort: "riskNumber:desc" });
  const detail = aboutRows(sheets);
  assert.equal(detail.has("Search"), false);
  assert.equal(detail.has("Filters"), false);
  assert.equal(detail.get("Sorted by"), "Risk number, descending");
  assert.equal(detail.get("Columns"), VISIBLE_LABELS.join(", "));
  assert.equal(String(detail.get("Exported")), formatExportedAt(NOW, "UTC", true));
  assert.ok(String(detail.get("Exported")).endsWith(UTC_SENTENCE), String(detail.get("Exported")));
  assert.match(formatExportedAt(NOW, SYDNEY, false), /\(Australia\/Sydney\)$/);
});

test("a CSV holds a BOM, CRLF lines, one quoted header row and the data only, the marked statement quoted", async () => {
  const { file } = await exportOf({ q: "HYPERLINK", format: "csv" });
  assert.equal(file.fileName, "risk-register-2026-10-01.csv");
  assert.equal(file.contentType, "text/csv; charset=utf-8");
  const text = csvText(file.bytes);
  assert.ok(text.endsWith("\r\n"));
  assert.deepEqual(text.split("\r\n"), [
    VISIBLE_LABELS.map((label) => `"${label}"`).join(","),
    `"RSK-001","'=HYPERLINK(""https://example.test"",""Click"")","High","Moderate","In Progress","Jane Owner",2027-01-31,"ASM-001"`,
    "",
  ]);
  for (const about of ["About this export", "Exported", "Values that look like formulas"]) assert.equal(text.includes(about), false, about);
  const reordered = await exportOf({ format: "csv", columns: "riskStatement,riskNumber" });
  assert.equal(csvText(reordered.file.bytes).split("\r\n")[0], '"Risk number","Statement"');
});

test("closed controls: a repeated, empty or unknown column, an unknown format, an unknown key, a page or a list value is refused", async () => {
  const refused: Record<string, unknown>[] = [
    { format: "xlsx", columns: "riskNumber,riskNumber" },
    { format: "xlsx", columns: "" },
    { format: "xlsx", columns: "nope" },
    { format: "xlsx", columns: Array.from({ length: 41 }, () => "riskNumber").join(",") },
    { format: "pdf" },
    {},
    { format: ["xlsx", "csv"] },
    { format: "xlsx", nope: "1" },
    { format: "xlsx", page: "2" },
    { format: "xlsx", pageSize: "50" },
  ];
  for (const query of refused) {
    const repository = fakeRepository();
    const log = recordingLogger();
    await assert.rejects(
      runListExport({ view: riskRegisterExportView(repository), query, state: STATE, actor: ACTOR, now: NOW, log }),
      ExportQueryError,
      JSON.stringify(query),
    );
    assert.equal(repository.calls.count.length, 0, `nothing counted for ${JSON.stringify(query)}`);
    assert.deepEqual(log.calls.map((call) => parseLine(call.message).reason), ["INVALID_QUERY"], JSON.stringify(query));
  }
});

test("an export over the cap is refused with EXPORT_ROW_LIMIT, logged at warn, before any id is read or file written", async () => {
  const { view, calls } = fakeAssessmentView(RELEASED, { total: 10_001 });
  const log = recordingLogger();
  await assert.rejects(runListExport({ view, query: { format: "xlsx" }, state: STATE, actor: ACTOR, now: NOW, log }), (error: unknown) => {
    assert.ok(error instanceof ExportRefusalError);
    assert.equal(error.reason, "EXPORT_ROW_LIMIT");
    assert.equal(error.status, 422);
    assert.equal(error.rowCount, 10_001);
    assert.equal(error.rowCap, 10_000);
    return true;
  });
  assert.equal(calls.selectIds, 0, "no id is read");
  assert.deepEqual(calls.hydrate, [], "nothing is hydrated or written");
  assert.equal(log.calls.length, 1);
  assert.equal(log.calls[0].level, "warn");
  const line = parseLine(log.calls[0].message);
  assert.equal(line.event, "export.refused");
  assert.equal(line.reason, "EXPORT_ROW_LIMIT");
  assert.equal(line.rowCount, 10_001);
});

test("the cap race: a count within the cap whose ids arrive past it is refused the same way and writes no file", async () => {
  const ids = Array.from({ length: 10_001 }, (_, index) => `ASM-${index}`);
  const { view, calls } = fakeAssessmentView(RELEASED, { total: 10_000, ids });
  const log = recordingLogger();
  await assert.rejects(runListExport({ view, query: { format: "csv" }, state: STATE, actor: ACTOR, now: NOW, log }), (error: unknown) => {
    assert.ok(error instanceof ExportRefusalError);
    assert.equal(error.reason, "EXPORT_ROW_LIMIT");
    assert.equal(error.rowCount, 10_001);
    assert.equal(error.rowCap, EXPORT_ROW_CAP);
    return true;
  });
  assert.deepEqual(calls.hydrate, [], "nothing is hydrated or written");
  assert.equal(log.calls[0].level, "warn");
  assert.equal(parseLine(log.calls[0].message).reason, "EXPORT_ROW_LIMIT");
});

test("hydration reads the ids in batches of at most 500, in the list's order", async () => {
  const ids = Array.from({ length: 1_201 }, (_, index) => `ASM-${String(index).padStart(4, "0")}`);
  const { view, calls } = fakeAssessmentView([], { total: ids.length, ids });
  const log = recordingLogger();
  const file = await runListExport({ view, query: { format: "csv" }, state: STATE, actor: ACTOR, now: NOW, log });
  assert.equal(EXPORT_HYDRATE_BATCH, 500);
  assert.deepEqual(calls.hydrate, [500, 500, 201]);
  assert.equal(file.rowCount, 1_201);
  const lines = csvText(file.bytes).split("\r\n");
  assert.equal(lines[1].startsWith('"ASM-0000"'), true);
  assert.equal(lines[1_201].startsWith('"ASM-1200"'), true);
});

const FIXED_TABLES: readonly ExportTable[] = [
  {
    key: "first", heading: "First table", slug: "first-table",
    columns: [{ key: "label", label: "Rating", type: "text" }, { key: "count", label: "Risks", type: "number" }],
    rows: [{ label: "High", count: 3 }, { label: "=SUM(A1)", count: 0 }],
  },
  {
    key: "second", heading: "Second table", slug: "second-table",
    columns: [{ key: "month", label: "Month", type: "text" }, { key: "released", label: "Released", type: "number" }],
    rows: [{ month: "Sep 2026", released: 2 }],
  },
];
const SUMMARY_TABLE: ExportTable = {
  key: "summary", heading: "Summary", slug: "summary", summary: true,
  columns: [{ key: "assessmentNumber", label: "Assessment", type: "record" }, { key: "releasedAt", label: "Released", type: "instant" }],
  rows: [{ assessmentNumber: "ASM-001", releasedAt: "2026-09-30T15:00:00.000Z" }],
};

function fixedInput(input: { format: unknown; table?: unknown; timeZone?: unknown; tables?: readonly ExportTable[] }, log: ReturnType<typeof recordingLogger>) {
  return {
    viewKey: "risk-exposure",
    slug: "risk-exposure-report",
    heading: "Risk exposure",
    tables: input.tables ?? FIXED_TABLES,
    format: input.format,
    table: input.table,
    timeZone: input.timeZone,
    actor: ACTOR,
    now: NOW,
    log,
    about: { asAt: "1 Oct 2026", period: "Last 12 months" },
  };
}

async function fixedExport(input: { format: unknown; table?: unknown; timeZone?: unknown; tables?: readonly ExportTable[] }) {
  const log = recordingLogger();
  const file = await runFixedTableExport(fixedInput(input, log));
  return { file, log, sheets: file.format === "xlsx" ? await readWorkbookSheets(file.bytes) : [] };
}

test("a fixed-table workbook writes one sheet per table, then About this export with the caller's As at and Period", async () => {
  const { file, log, sheets } = await fixedExport({ format: "xlsx", timeZone: SYDNEY });
  assert.equal(file.fileName, "risk-exposure-report-2026-10-01.xlsx");
  assert.equal(file.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["First table", "Second table", "About this export"]);
  assert.deepEqual(sheets[0].rows, [["Rating", "Risks"], ["High", 3], ["'=SUM(A1)", 0]]);
  assert.deepEqual(sheets[2].rows.slice(1).map((row) => row[0]), ["View", "Rows", "As at", "Period", "Exported", "Exported by", "Values that look like formulas"]);
  const detail = aboutRows(sheets);
  assert.equal(detail.get("View"), "Risk exposure");
  assert.equal(detail.get("Rows"), 3);
  assert.equal(detail.get("As at"), "1 Oct 2026");
  assert.equal(detail.get("Period"), "Last 12 months");
  assert.equal(file.rowCount, 3);
  const line = parseLine(log.calls[0].message);
  assert.equal(line.event, "export.completed");
  assert.equal(line.view, "risk-exposure");
  assert.equal(line.table, null);
  assert.equal(line.rowCount, 3);
});

test("a fixed-table CSV writes only the chosen table, and the table is required for CSV and refused for XLSX", async () => {
  const { file, log } = await fixedExport({ format: "csv", table: "second" });
  assert.equal(file.fileName, "second-table-2026-10-01.csv");
  assert.deepEqual(csvText(file.bytes).split("\r\n"), ['"Month","Released"', '"Sep 2026",2', ""]);
  assert.equal(file.rowCount, 1);
  assert.equal(parseLine(log.calls[0].message).table, "second");
  const refused = [
    { format: "csv" },
    { format: "xlsx", table: "first" },
    { format: "csv", table: "third" },
    { format: "pdf", table: "first" },
    { format: "csv", table: "first", timeZone: "Mars/Base" },
    { format: "csv", table: "summary", tables: [SUMMARY_TABLE, ...FIXED_TABLES] },
  ];
  for (const input of refused) {
    const logged = recordingLogger();
    await assert.rejects(runFixedTableExport(fixedInput(input, logged)), ExportQueryError, JSON.stringify(input));
    assert.equal(parseLine(logged.calls[0].message).reason, "INVALID_QUERY", JSON.stringify(input));
  }
});

test("a fixed-table row count sums the data tables and skips a one-row summary table; the cap applies to the sum", async () => {
  const { file, sheets } = await fixedExport({ format: "xlsx", tables: [SUMMARY_TABLE, ...FIXED_TABLES] });
  assert.equal(file.rowCount, 3);
  assert.equal(aboutRows(sheets).get("Rows"), 3);
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Summary", "First table", "Second table", "About this export"]);
  assert.equal((sheets[0].rows[1][1] as Date).toISOString(), "2026-09-30T00:00:00.000Z", "a summary instant is a local date, UTC here");
  const big: ExportTable = { ...FIXED_TABLES[1], rows: Array.from({ length: 10_001 }, (_, index) => ({ month: `M${index}`, released: index })) };
  const log = recordingLogger();
  await assert.rejects(
    runFixedTableExport(fixedInput({ format: "xlsx", tables: [big] }, log)),
    (error: unknown) => error instanceof ExportRefusalError && error.reason === "EXPORT_ROW_LIMIT" && error.rowCount === 10_001,
  );
  assert.equal(log.calls[0].level, "warn");
});

test("the file name is {slug}-{local date}.{format}, and anything outside the safe pattern is refused", () => {
  assert.equal(exportFileName({ slug: "risk-register", localDate: "2026-10-01", format: "xlsx" }), "risk-register-2026-10-01.xlsx");
  assert.equal(exportFileName({ slug: "risk-exposure-due-state", localDate: "2026-10-01", format: "csv" }), "risk-exposure-due-state-2026-10-01.csv");
  for (const slug of ["Risk Register", "../etc", "-leading", "", "x".repeat(150)]) {
    assert.throws(() => exportFileName({ slug, localDate: "2026-10-01", format: "csv" }), Error, `refused ${slug}`);
  }
  assert.throws(() => exportFileName({ slug: "risk-register", localDate: "2026-13-01", format: "csv" }));
  assert.deepEqual(EXPORT_MEDIA_TYPES, { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
});

function fakeContext() {
  const headers = new Map<string, string>();
  return { headers, status: 200, body: undefined as unknown, set(field: string, value: string) { headers.set(field, value); } };
}

test("the file response is an attachment, never sniffed, cached or rendered, with the row count and the exact media type", async () => {
  const { file } = await exportOf({ q: "HYPERLINK", format: "xlsx" });
  const ctx = fakeContext();
  sendExportFile(ctx, file);
  assert.equal(ctx.headers.get("Content-Disposition"), `attachment; filename="risk-register-2026-10-01.xlsx"; filename*=UTF-8''risk-register-2026-10-01.xlsx`);
  assert.equal(ctx.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(ctx.headers.get("Cache-Control"), "no-store");
  assert.equal(ctx.headers.get("Content-Security-Policy"), "default-src 'none'; sandbox");
  assert.equal(ctx.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(ctx.headers.get("X-CSRM-Row-Count"), "1");
  assert.equal(ctx.body, file.bytes);
  const csv = fakeContext();
  sendExportFile(csv, (await exportOf({ format: "csv" })).file);
  assert.equal(csv.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.equal(csv.headers.get("X-CSRM-Row-Count"), "4", "the four active Risks");
});

test("export errors map to a reasonless 400 and the closed 422 envelope; anything else is left to the controller", () => {
  const invalid = fakeContext();
  assert.equal(sendExportError(invalid, new ExportQueryError()), true);
  assert.equal(invalid.status, 400);
  const invalidBody = invalid.body as { data: null; error: { status: number; message: string; details?: unknown } };
  assert.equal(invalidBody.data, null);
  assert.equal(invalidBody.error.status, 400);
  assert.equal("details" in invalidBody.error, false, "the 400 names no reason");
  const limited = fakeContext();
  const refusal = new ExportRefusalError({ reason: "EXPORT_ROW_LIMIT", status: 422, message: "Too many rows.", rowCount: 10_001, rowCap: 10_000 });
  assert.equal(sendExportError(limited, refusal), true);
  assert.equal(limited.status, 422);
  assert.deepEqual((limited.body as { error: { details: unknown } }).error.details, { reason: "EXPORT_ROW_LIMIT", rowCount: 10_001, rowCap: 10_000 });
  const other = fakeContext();
  assert.equal(sendExportError(other, new Error("boom")), false);
  assert.equal(other.body, undefined);
});

test("the actor is the resolved IdamBox User by display name; no identity is a 403", async () => {
  const lookups: unknown[] = [];
  const strapi = {
    documents: (uid: string) => ({
      async findOne(query: Record<string, unknown>) {
        lookups.push({ uid, ...query });
        return query.documentId === "user-bob" ? { documentId: "user-bob", displayName: "Bob Analyst" } : null;
      },
    }),
  };
  assert.deepEqual(await resolveExportActor(strapi, { idamboxUser: { documentId: "user-bob" } }), ACTOR);
  assert.deepEqual(lookups, [{ uid: "api::idambox-user.idambox-user", documentId: "user-bob", fields: ["displayName"] }]);
  for (const state of [{}, { idamboxUser: null }, { idamboxUser: { documentId: "bad id" } }, { idamboxUser: { documentId: "user-gone" } }]) {
    await assert.rejects(resolveExportActor(strapi, state), (error: unknown) => (error as { status?: number }).status === 403, JSON.stringify(state));
  }
});

/*
 * BE1-04 (Phase 19 code review): a refused line keeps the facts the pipeline already had. A columns refusal after a
 * valid format names the format, and the cap race names the list's count when it is re-read, not the cap plus one.
 */

test("a columns refusal after a valid format logs the format, not unknown (BE1-04)", async () => {
  const log = recordingLogger();
  await assert.rejects(
    runListExport({ view: riskRegisterExportView(fakeRepository()), query: { format: "csv", columns: "bogus" }, state: STATE, actor: ACTOR, now: NOW, log }),
    ExportQueryError,
  );
  const line = parseLine(log.calls[0].message);
  assert.equal(line.reason, "INVALID_QUERY");
  assert.equal(line.format, "csv");
});

test("the cap race logs and answers the list's re-read count, not the cap plus one (BE1-04)", async () => {
  const ids = Array.from({ length: 10_001 }, (_, index) => `ASM-${index}`);
  const { view } = fakeAssessmentView(RELEASED, { ids });
  const counts = [10_000, 12_345];
  const grown: typeof view = { ...view, count: async () => counts.shift() ?? 12_345 };
  const log = recordingLogger();
  await assert.rejects(runListExport({ view: grown, query: { format: "csv" }, state: STATE, actor: ACTOR, now: NOW, log }), (error: unknown) => {
    assert.ok(error instanceof ExportRefusalError);
    assert.equal(error.rowCount, 12_345);
    return true;
  });
  assert.equal(parseLine(log.calls[0].message).rowCount, 12_345);
});

/*
 * BE1-10 (Phase 19 code review): every view treats a row that disappears between selecting the ids and hydrating
 * them the same way, as the lists do ("a record removed between the two reads is not shown"): the row is left out,
 * the file and its row count say so, and the attempt logs export.completed with that count.
 */

test("a chosen Risk that no longer hydrates is left out, and the line and the file count what was written (BE1-10)", async () => {
  const repository = fakeRepository();
  const hydrate = repository.hydrate.bind(repository);
  repository.hydrate = async (documentIds, options) => (await hydrate(documentIds, options)).filter((document) => document.documentId !== "risk-2");
  const { file, log } = await exportOf({ format: "csv" }, repository);
  assert.equal(file.rowCount, 3, "the four active Risks less the one that disappeared");
  const line = parseLine(log.calls[0].message);
  assert.equal(line.event, "export.completed");
  assert.equal(line.rowCount, 3);
  assert.equal(csvText(file.bytes).includes("RSK-002"), false);
});

test("inIdOrder keeps the ids' order and leaves out an id with no document, the one rule every view hydrates by (BE1-10)", () => {
  const documents = [{ documentId: "c" }, { documentId: "a" }];
  assert.deepEqual(inIdOrder(["a", "b", "c"], documents).map((document) => document.documentId), ["a", "c"]);
});

/*
 * The Phase 19 review amendment (2026-10-17, G-6), section 1 (BE1-02): an xlsx export whose text cell, as written
 * (after the neutraliser's mark), is longer than Excel's 32,767-character limit is refused 422 EXPORT_CELL_TOO_LONG
 * with details.column (the column key) and details.cellLimit, before anything is written, with one export.refused line
 * that never holds the value. The CSV holds the value whole.
 */
const LONG_TEXT = "L".repeat(40_000);

test("a list export whose xlsx text cell is longer than 32,767 characters is refused EXPORT_CELL_TOO_LONG; the CSV is whole (BE1-02)", async () => {
  const rows: AssessmentRow[] = [{ assessmentNumber: "ASM-001", requestTitle: LONG_TEXT, overallRating: "High", releasedAt: null }];
  const { view } = fakeAssessmentView(rows);
  const log = recordingLogger();
  await assert.rejects(runListExport({ view, query: { format: "xlsx" }, state: STATE, actor: ACTOR, now: NOW, log }), (error: unknown) => {
    assert.ok(error instanceof ExportRefusalError);
    assert.equal(error.reason, "EXPORT_CELL_TOO_LONG");
    assert.equal(error.status, 422);
    const details = error as unknown as { column?: unknown; cellLimit?: unknown };
    assert.deepEqual([details.column, details.cellLimit], ["requestTitle", 32_767]);
    const ctx = { status: 200, body: undefined as unknown };
    assert.equal(sendExportError(ctx, error), true);
    assert.deepEqual((ctx.body as { error: { details: unknown } }).error.details, { reason: "EXPORT_CELL_TOO_LONG", column: "requestTitle", cellLimit: 32_767 });
    return true;
  });
  assert.equal(log.calls.length, 1);
  assert.equal(log.calls[0].level, "info");
  const line = parseLine(log.calls[0].message);
  assert.deepEqual([line.event, line.reason, line.format], ["export.refused", "EXPORT_CELL_TOO_LONG", "xlsx"]);
  assert.equal(log.calls[0].message.includes("LLLL"), false, "the value is never logged");

  const csvLog = recordingLogger();
  const csv = await runListExport({ view: fakeAssessmentView(rows).view, query: { format: "csv" }, state: STATE, actor: ACTOR, now: NOW, log: csvLog });
  assert.ok(csvText(csv.bytes).includes(LONG_TEXT), "the CSV holds the value whole");
  assert.equal(parseLine(csvLog.calls[0].message).event, "export.completed");
});

test("a fixed-table xlsx export with a text cell over the limit is refused EXPORT_CELL_TOO_LONG, the mark counted (BE1-02)", async () => {
  const summary: ExportTable = {
    key: "summary", heading: "Summary", slug: "summary", summary: true,
    columns: [{ key: "summary", label: "Summary", type: "text" }],
    // 32,767 characters, then the neutraliser's mark makes 32,768.
    rows: [{ summary: `=${"S".repeat(32_766)}` }],
  };
  const log = recordingLogger();
  await assert.rejects(runFixedTableExport(fixedInput({ format: "xlsx", tables: [summary, ...FIXED_TABLES] }, log)), (error: unknown) => {
    assert.ok(error instanceof ExportRefusalError);
    assert.equal(error.reason, "EXPORT_CELL_TOO_LONG");
    assert.equal((error as unknown as { column?: unknown }).column, "summary");
    return true;
  });
  assert.equal(parseLine(log.calls[0].message).reason, "EXPORT_CELL_TOO_LONG");
  // Exactly the limit, mark included, is written.
  const fits = await fixedExport({ format: "xlsx", tables: [{ ...summary, rows: [{ summary: "S".repeat(32_767) }] }, ...FIXED_TABLES] });
  assert.equal(parseLine(fits.log.calls[0].message).event, "export.completed");
});

/*
 * The same amendment, section 2 (BE1-04): an attempt that fails after its query is parsed writes one export.refused
 * line with the log-only reason EXPORT_FAILED at warn, never the error's message or a cell, and the error goes on to
 * Strapi's 500 unchanged.
 */
test("a list export that fails after parsing logs one EXPORT_FAILED line at warn, without the error's message (BE1-04)", async () => {
  const { view } = fakeAssessmentView(RELEASED);
  const failing: typeof view = { ...view, hydrate: async () => { throw new Error("database is down: secret-host"); } };
  const log = recordingLogger();
  await assert.rejects(runListExport({ view: failing, query: { format: "csv" }, state: STATE, actor: ACTOR, now: NOW, log }), /database is down/);
  assert.equal(log.calls.length, 1, "one line");
  assert.equal(log.calls[0].level, "warn");
  const line = parseLine(log.calls[0].message);
  assert.deepEqual([line.event, line.reason, line.format, line.rowCount], ["export.refused", "EXPORT_FAILED", "csv", 1]);
  assert.equal(log.calls[0].message.includes("secret-host"), false, "the error's message is never logged");
});

test("a fixed-table export that fails while writing logs one EXPORT_FAILED line at warn (BE1-04)", async () => {
  const broken: ExportTable = { key: "first", heading: "First table", slug: "first-table", columns: [{ key: "count", label: "Count", type: "number" }], rows: [{ count: "not a number" }] };
  const log = recordingLogger();
  await assert.rejects(runFixedTableExport(fixedInput({ format: "xlsx", tables: [broken] }, log)), TypeError);
  assert.equal(log.calls.length, 1);
  assert.equal(log.calls[0].level, "warn");
  assert.equal(parseLine(log.calls[0].message).reason, "EXPORT_FAILED");
  assert.equal(log.calls[0].message.includes("not a number"), false);
});

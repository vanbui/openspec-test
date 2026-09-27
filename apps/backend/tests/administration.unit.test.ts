import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import type { AdministrationRepository } from "../src/api/csrm-administration/services/administration-repository";
import {
  commitAdministrationImport,
  previewAdministrationImport,
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
  parseAdministrationCsv: (input: {
    kind: string;
    bytes: Uint8Array;
    existing?: readonly Record<string, unknown>[];
  }) => { rows: Array<{ rowNumber: number; state: CsvRowState; issues: readonly string[] }>; counts: Record<CsvRowState, number>; digest: string };
  sanitizeSpreadsheetCell: (value: string) => string;
};

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

test("ADMIN-04 T-06-03 enforces exact CSV byte, row, and record bounds", () => {
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
  assert.equal(csv.parseAdministrationCsv({ kind: "risk-types", bytes: exactBytes }).rows.length, 5_000);

  const exactRows = `name\r\n${Array.from({ length: 5_000 }, (_, index) => `Row ${index}`).join("\r\n")}`;
  assert.equal(csv.parseAdministrationCsv({ kind: "risk-types", bytes: Buffer.from(exactRows) }).rows.length, 5_000);
  assert.throws(() => csv.parseAdministrationCsv({
    kind: "risk-types", bytes: Buffer.from(`${exactRows}\r\nRow 5000`),
  }), /5,?000|row/i);
  assert.throws(() => csv.parseAdministrationCsv({
    kind: "risk-types", bytes: Buffer.alloc(5_242_881, 0x61),
  }), /5|byte|size/i);
  assert.throws(() => csv.parseAdministrationCsv({
    kind: "risk-types", bytes: Buffer.from(`name\r\n${"x".repeat(65_537)}`),
  }), /65,?536|record/i);
});

test("ADMIN-04 classifies create/update/unchanged/rejected/ambiguous as five distinct states", () => {
  const csv = loadCsvModule();
  const parsed = csv.parseAdministrationCsv({
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
  assert.deepEqual(parsed.counts, { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 2 });
  assert.deepEqual(parsed.rows.map(({ rowNumber, state }) => ({ rowNumber, state })), [
    { rowNumber: 2, state: "create" }, { rowNumber: 3, state: "update" },
    { rowNumber: 4, state: "unchanged" }, { rowNumber: 5, state: "rejected" },
    { rowNumber: 6, state: "ambiguous" }, { rowNumber: 7, state: "ambiguous" },
  ]);
  assert.match(parsed.digest, /^[a-f0-9]{64}$/);
});

test("ADMIN-04 classifies against the complete existing-record set beyond the CSV row cap", () => {
  const csv = loadCsvModule();
  const existing = Array.from({ length: csv.CSV_MAX_ROWS + 1 }, (_, index) => ({
    documentId: `existing-${index}`,
    name: `Existing ${index}`,
    description: "old",
  }));
  const target = existing.at(-1)!;
  const parsed = csv.parseAdministrationCsv({
    kind: "risk-types",
    bytes: Buffer.from(`name,description\r\n${target.name},changed`),
    existing,
  });
  assert.equal(parsed.rows[0]?.state, "update");
  assert.equal((parsed.rows[0] as { matchedDocumentId?: string }).matchedDocumentId, target.documentId);
});

test("T-06-04 T-06-06 T-06-07 rejects malformed bytes and neutralizes spreadsheet formulas", () => {
  const csv = loadCsvModule();
  for (const bytes of [Buffer.from([]), Buffer.from("name\r\n"), Buffer.from([0xc3, 0x28])]) {
    assert.throws(() => csv.parseAdministrationCsv({ kind: "risk-types", bytes }));
  }
  for (const value of ["=cmd()", "+SUM(A1)", "-2+3", "@IMPORTDATA(x)", "\t=cmd()", "\r=cmd()"]) {
    const safe = csv.sanitizeSpreadsheetCell(value);
    assert.doesNotMatch(safe, /^[=+\-@\t\r]/);
    assert.ok(safe.endsWith(value));
  }
});

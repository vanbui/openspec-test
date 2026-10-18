import { readFile, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { basename } from "node:path";

import { logSecurityEvent, type SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { exportViewMeta, importColumns, type ImportColumnSpec, type ImportSpec } from "../../../csrm/exports/export-vocabulary";
import { localCalendarDate, parseExportTimeZone, type ExportTimeZone } from "../../../csrm/exports/export-time";
import { exportFileName } from "../../../csrm/exports/send-export";
import { writeCsv, type CsvCell } from "../../../csrm/spreadsheets/csv-writer";
import { headerKey } from "../../../csrm/spreadsheets/header-match";
import {
  IMPORT_MAX_BYTES,
  ImportFileRefusal,
  readImportFile,
  type ImportCell,
  type ImportFile,
  type ImportRefusalFound,
} from "../../../csrm/spreadsheets/import-file";
import { sanitizeSpreadsheetCell, stripNeutraliserMark } from "../../../csrm/spreadsheets/neutralise";
import { writeWorkbook, XLSX_CELL_MAX_LENGTH, type SheetCell } from "../../../csrm/spreadsheets/xlsx-writer";

import type { AdministrationKind } from "./administration-config";
import {
  normalizeAdministrationNaturalKey,
  ADMINISTRATION_MAX_RECORDS,
  AdministrationValidationError,
  parseAdministrationMutation,
  parseAdministrationQuery,
  projectAdministrationRecord,
} from "./administration-query";
import { createStrapiAdministrationRepository, type AdministrationRepository } from "./administration-repository";
import {
  CSV_MAX_BYTES,
  CSV_MAX_ISSUES_PER_ROW,
  CSV_MAX_ROWS,
  importIssueMessage,
  parseAdministrationImport,
  similarRowMessage,
  type CsvImportIssue,
  type CsvRowState,
} from "./csv-import";

type RecordValue = Record<string, unknown>;

/** A refusal's closed reason and safe found details, served in the AssessmentWorkflowErrorResponse envelope (19-13). */
export type AdministrationRefusalDetails = { readonly reason: ConflictReason; readonly found?: ImportRefusalFound };

export class AdministrationWorkflowError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 422,
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly details?: AdministrationRefusalDetails,
  ) {
    super(message);
    this.name = "AdministrationWorkflowError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertAdministrationScope(state: unknown): void {
  if (!isRecord(state) || !isRecord(state.csrmAuthorization)
    || state.csrmAuthorization.administrationCollectionScope !== "all") {
    throw new AdministrationWorkflowError(403, "CSRM Administration access is denied.", "ADMINISTRATION_FORBIDDEN");
  }
}

function unavailable(kind: AdministrationKind): never {
  const labels: Record<AdministrationKind, string> = { "risk-types": "Risk Type", controls: "Control", "information-systems": "Information System", "information-assets": "Information Asset" };
  throw new AdministrationWorkflowError(404, `CSRM ${labels[kind]} is not available.`, "ADMINISTRATION_RECORD_NOT_FOUND");
}

function invalid(): never {
  throw new AdministrationWorkflowError(400, "CSRM Administration data is invalid.", "INVALID_ADMINISTRATION_DATA");
}

function conflict(kind: AdministrationKind): never {
  const field = kind === "controls" ? "controlNumber" : "name";
  const labels: Record<AdministrationKind, string> = { "risk-types": "Risk Type", controls: "Control", "information-systems": "Information System", "information-assets": "Information Asset" };
  throw new AdministrationWorkflowError(409, `A ${labels[kind]} with this ${kind === "controls" ? "control number" : "name"} already exists.`, "NATURAL_KEY_CONFLICT", field);
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "23505"
    || (typeof error.message === "string" && /unique constraint|unique failed/i.test(error.message));
}

async function assertNaturalKeyAvailable(
  repository: AdministrationRepository,
  kind: AdministrationKind,
  value: string,
  excludingDocumentId?: string,
): Promise<void> {
  const records = await repository.findNaturalKeyRecords();
  if (records.length > 65_536) invalid();
  const naturalKey = kind === "controls" ? "controlNumber" : "name";
  const normalized = normalizeAdministrationNaturalKey(value);
  if (records.some((record) => record.documentId !== excludingDocumentId
    && typeof record[naturalKey] === "string"
    && normalizeAdministrationNaturalKey(record[naturalKey] as string) === normalized)) conflict(kind);
}

async function resolveMutationRelations(repository: AdministrationRepository, mutation: RecordValue): Promise<RecordValue> {
  try {
    let resolved = mutation;
    if ("applicableControls" in resolved) resolved = { ...resolved, applicableControls: await repository.resolveApplicableControls(resolved.applicableControls as string[]) };
    if ("owner" in resolved && typeof resolved.owner === "string") resolved = { ...resolved, owner: await repository.resolveActiveUser(resolved.owner) };
    return resolved;
  } catch {
    invalid();
  }
}

const mutationQueues = new Map<AdministrationKind, Promise<void>>();

async function serialized<T>(kind: AdministrationKind, action: () => Promise<T>): Promise<T> {
  const previous = mutationQueues.get(kind) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current, () => current);
  mutationQueues.set(kind, queued);
  await previous.catch(() => undefined);
  try {
    return await action();
  } finally {
    release();
    if (mutationQueues.get(kind) === queued) mutationQueues.delete(kind);
  }
}

type MultipartUpload = {
  filepath?: unknown;
  mimetype?: unknown;
  originalFilename?: unknown;
  size?: unknown;
};

function importError(status: 400 | 409 | 413 | 415 | 422, code: string, message: string): never {
  throw new AdministrationWorkflowError(status, message, code);
}

/** A file the import reader refused, as the status it carries with its closed reason and found details (D-25, D-26). */
function fileRefusal(refusal: ImportFileRefusal): AdministrationWorkflowError {
  const found = refusal.found && Object.keys(refusal.found).length > 0 ? refusal.found : undefined;
  return new AdministrationWorkflowError(refusal.status, "CSRM can’t read this import file.", refusal.reason, undefined, {
    reason: refusal.reason,
    ...(found ? { found } : {}),
  });
}

function uploadFrom(value: unknown): MultipartUpload {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !("file" in value)) {
    importError(400, "INVALID_IMPORT_FILE", "Select one CSV or Excel file to import.");
  }
  const candidate = value.file;
  if (Array.isArray(candidate)) importError(400, "INVALID_IMPORT_FILE", "Select one CSV or Excel file to import.");
  if (!isRecord(candidate)) importError(400, "INVALID_IMPORT_FILE", "Select one CSV or Excel file to import.");
  return candidate;
}

type ImportUpload = { bytes: Uint8Array; fileName: string; mimeType: string; digest: string };

/**
 * One uploaded file (D-25, D-26): a malformed multipart shape stays 400; a file over 5 MiB is refused before it is
 * read; the reader (readImportFile) decides the type by extension and signature. The digest is SHA-256 of the bytes.
 */
async function readImportUpload(value: unknown): Promise<ImportUpload> {
  const upload = uploadFrom(value);
  if (typeof upload.filepath !== "string" || typeof upload.originalFilename !== "string") {
    importError(400, "INVALID_IMPORT_FILE", "Select one CSV or Excel file to import.");
  }
  const fileName = basename(upload.originalFilename).slice(0, 255);
  const mimeType = typeof upload.mimetype === "string" ? upload.mimetype.toLocaleLowerCase("en-AU") : "";
  // BE3-06: the file is measured on disk before it is read, so an oversized upload is refused unread and `found.bytes`
  // is the measured size, never the multipart-declared `size`, which the client controls.
  const measured = (await stat(upload.filepath)).size;
  if (measured > IMPORT_MAX_BYTES) throw fileRefusal(new ImportFileRefusal("IMPORT_FILE_TOO_LARGE", { bytes: measured }));
  const bytes = new Uint8Array(await readFile(upload.filepath));
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw fileRefusal(new ImportFileRefusal("IMPORT_FILE_TOO_LARGE", { bytes: bytes.byteLength }));
  return { bytes, fileName, mimeType, digest: createHash("sha256").update(bytes).digest("hex") };
}

/** Reads and classifies an upload, or throws the reader's closed refusal as a workflow error. */
async function readImport(kind: AdministrationKind, upload: ImportUpload, existing: readonly RecordValue[]) {
  try {
    return await parseAdministrationImport({ kind, bytes: upload.bytes, fileName: upload.fileName, mimeType: upload.mimeType, existing });
  } catch (error) {
    if (error instanceof ImportFileRefusal) throw fileRefusal(error);
    throw error;
  }
}

const limits = { maxBytes: CSV_MAX_BYTES, maxRows: CSV_MAX_ROWS } as const;

function assertImportRecordCapacity(existing: readonly RecordValue[], rows: readonly { state: CsvRowState }[]): void {
  const createRows = rows.filter((row) => row.state === "create").length;
  if (existing.length + createRows > ADMINISTRATION_MAX_RECORDS) {
    importError(409, "IMPORT_RECORD_LIMIT_EXCEEDED", `The collection cannot exceed ${ADMINISTRATION_MAX_RECORDS.toLocaleString("en-AU")} records.`);
  }
}

export async function previewAdministrationImport(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  uploads: unknown;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  const actorDocumentId = administrationActorDocumentId(input.state);
  const upload = await readImportUpload(input.uploads);
  return serialized(input.kind, async () => {
    const existing = await input.repository.findNaturalKeyRecords();
    const preview = await readImport(input.kind, upload, existing);
    assertImportRecordCapacity(existing, preview.rows);
    const retained = preview.rows.map((row): RetainedPreviewRow => ({
      rowNumber: row.rowNumber,
      state: row.state,
      matchedDocumentId: row.matchedDocumentId,
      matchedUpdatedAt: row.matchedUpdatedAt,
      matchedName: row.matchedName,
      issues: retainedIssues(row.issues),
    }));
    // The retained issue data is bounded, which keeps the 256-record cap's memory bounded (the import record).
    if (Buffer.byteLength(JSON.stringify(retained.map((row) => row.issues))) > MAX_RETAINED_ISSUE_BYTES) {
      throw fileRefusal(new ImportFileRefusal("IMPORT_WORKBOOK_TOO_LARGE"));
    }
    const previewDigest = issuePreviewRecord({
      actorDocumentId,
      kind: input.kind,
      fileDigest: upload.digest,
      rows: retained,
    });
    const rows = preview.rows.map(({ matchedUpdatedAt: _matchedUpdatedAt, ...row }) => row);
    return {
      fileName: upload.fileName,
      previewDigest,
      limits,
      summary: preview.counts,
      warnings: preview.warnings,
      notes: preview.notes,
      readOnlyColumns: preview.readOnlyColumns,
      rows,
    };
  });
}

function resultIssue(message: string, code = "ROW_WRITE_REJECTED"): CsvImportIssue {
  return { code, field: null, message };
}

/** A row's issues as a record keeps them: codes and fields only, at most 20 (D-32; the error report's basis). */
type RetainedIssue = { readonly code: string; readonly field: string | null };

function retainedIssues(issues: readonly CsvImportIssue[]): readonly RetainedIssue[] {
  return issues.slice(0, CSV_MAX_ISSUES_PER_ROW).map(({ code, field }) => ({ code, field }));
}

type RetainedPreviewRow = {
  readonly rowNumber: number;
  readonly state: CsvRowState;
  readonly matchedDocumentId: string | null;
  readonly matchedUpdatedAt: string | null;
  readonly matchedName: string | null;
  readonly issues: readonly RetainedIssue[];
};

type PreviewRecord = {
  actorDocumentId: string;
  kind: AdministrationKind;
  fileDigest: string;
  expiresAt: number;
  rows: readonly RetainedPreviewRow[];
};

const PREVIEW_TTL_MS = 5 * 60 * 1_000;
const MAX_PREVIEW_RECORDS = 256;
const MAX_PREVIEWS_PER_ACTOR_AND_KIND = 16;
/** The most retained issue data one preview record keeps; more is refused at preview (IMPORT_WORKBOOK_TOO_LARGE). */
const MAX_RETAINED_ISSUE_BYTES = 1_048_576;
const previewRecords = new Map<string, PreviewRecord>();

function administrationActorDocumentId(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.idamboxUser)
    || typeof state.idamboxUser.documentId !== "string"
    || !/^[A-Za-z0-9_-]{1,200}$/.test(state.idamboxUser.documentId)) {
    throw new AdministrationWorkflowError(403, "CSRM Administration access is denied.", "ADMINISTRATION_FORBIDDEN");
  }
  return state.idamboxUser.documentId;
}

/** Drops the expired records of a store, then the oldest of the actor's and the store's beyond their caps. */
function makeRoom<T extends { actorDocumentId: string; kind: AdministrationKind; expiresAt: number }>(
  store: Map<string, T>,
  input: { actorDocumentId: string; kind: AdministrationKind },
  now: number,
): void {
  for (const [token, record] of store) {
    if (record.expiresAt <= now) store.delete(token);
  }
  const actorTokens = [...store.entries()]
    .filter(([, record]) => record.actorDocumentId === input.actorDocumentId && record.kind === input.kind)
    .map(([token]) => token);
  while (actorTokens.length >= MAX_PREVIEWS_PER_ACTOR_AND_KIND) store.delete(actorTokens.shift()!);
  while (store.size >= MAX_PREVIEW_RECORDS) {
    const oldest = store.keys().next().value as string | undefined;
    if (!oldest) break;
    store.delete(oldest);
  }
}

/** An opaque token: `sha256:` and 64 lowercase hexadecimal characters of 32 random bytes, unused in its store. */
function newToken(store: ReadonlyMap<string, unknown>): string {
  let token: string;
  do token = `sha256:${randomBytes(32).toString("hex")}`;
  while (store.has(token));
  return token;
}

function issuePreviewRecord(input: Omit<PreviewRecord, "expiresAt">): string {
  const now = Date.now();
  makeRoom(previewRecords, input, now);
  const token = newToken(previewRecords);
  previewRecords.set(token, { ...input, expiresAt: now + PREVIEW_TTL_MS });
  return token;
}

/*
 * An expired, unknown, other-actor or other-collection preview token is 409 IMPORT_REVIEW_EXPIRED (19-13; the import
 * record's "Decisions on Similar Rows"). This deliberately replaces bdd0f698's IMPORT_PREVIEW_CHANGED for these cases;
 * a file whose digest differs from the reviewed one keeps IMPORT_PREVIEW_CHANGED.
 */
function previewRecordForCommit(token: string, actorDocumentId: string, kind: AdministrationKind): PreviewRecord {
  const now = Date.now();
  for (const [key, record] of previewRecords) {
    if (record.expiresAt <= now) previewRecords.delete(key);
  }
  const record = previewRecords.get(token);
  if (!record || record.actorDocumentId !== actorDocumentId || record.kind !== kind || record.expiresAt <= now) {
    throw new AdministrationWorkflowError(409, "This review has expired. Choose the file again to check it.", "IMPORT_REVIEW_EXPIRED", undefined, {
      reason: "IMPORT_REVIEW_EXPIRED",
    });
  }
  return record;
}

// The result record (D-32): the commit's outcome per row, for 19-14's error report at Results.

export type ImportRowOutcome = "created" | "updated" | "unchanged" | "rejected" | "ambiguous" | "skipped";
export type ImportDecision = "update" | "skip";

export type ImportResultRow = {
  readonly rowNumber: number;
  readonly outcome: ImportRowOutcome;
  readonly decision: ImportDecision | null;
  readonly issues: readonly RetainedIssue[];
};

export type ImportResultRecord = {
  readonly actorDocumentId: string;
  readonly kind: AdministrationKind;
  readonly fileDigest: string;
  readonly fileName: string;
  readonly format: "csv" | "xlsx";
  readonly expiresAt: number;
  readonly rows: readonly ImportResultRow[];
};

/** A result record lives as long as a preview record: five minutes. */
export const IMPORT_RESULT_TTL_MS = 300_000;
const resultRecords = new Map<string, ImportResultRecord>();

/** Keeps a commit's result, bound to the actor and collection, and returns its resultToken (256 global, 16 per actor and collection). */
export function issueResultRecord(input: Omit<ImportResultRecord, "expiresAt">): string {
  const now = Date.now();
  makeRoom(resultRecords, input, now);
  const token = newToken(resultRecords);
  resultRecords.set(token, { ...input, expiresAt: now + IMPORT_RESULT_TTL_MS });
  return token;
}

/** The result record of `token` for this actor and collection, or null when it is unknown, another's or expired. */
export function resultRecordFor(token: string, actorDocumentId: string, kind: AdministrationKind): ImportResultRecord | null {
  const record = resultRecords.get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    resultRecords.delete(token);
    return null;
  }
  return record.actorDocumentId === actorDocumentId && record.kind === kind ? record : null;
}

// The commit's decisions on similar rows (D-30).

const DECISION_ROW = /^[0-9]{1,5}$/;
const MAX_DECISIONS = 5_000;
const MAX_DECISIONS_LENGTH = 200_000;

function invalidDecisions(): never {
  importError(400, "INVALID_IMPORT_DECISIONS", "Choose Update or Skip for each row matched by similar name.");
}

/** The optional `decisions` field: a JSON object of row number (1 to 5 digits) to update or skip, at most 5,000. */
function parseDecisions(value: unknown): ReadonlyMap<number, ImportDecision> {
  if (value === undefined) return new Map();
  if (typeof value !== "string" || value.length > MAX_DECISIONS_LENGTH) invalidDecisions();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    invalidDecisions();
  }
  if (!isRecord(parsed)) invalidDecisions();
  const entries = Object.entries(parsed);
  if (entries.length > MAX_DECISIONS) invalidDecisions();
  const decisions = new Map<number, ImportDecision>();
  for (const [rowNumber, decision] of entries) {
    if (!DECISION_ROW.test(rowNumber) || (decision !== "update" && decision !== "skip")) invalidDecisions();
    decisions.set(Number(rowNumber), decision);
  }
  return decisions;
}

/** Checks the decisions against the retained preview, never against client rows: one per similar row, none elsewhere. */
function assertDecisions(reviewed: PreviewRecord, decisions: ReadonlyMap<number, ImportDecision>): void {
  const states = new Map(reviewed.rows.map((row) => [row.rowNumber, row.state]));
  for (const rowNumber of decisions.keys()) {
    if (states.get(rowNumber) !== "similar") invalidDecisions();
  }
  if (reviewed.rows.some((row) => row.state === "similar" && !decisions.has(row.rowNumber))) {
    throw new AdministrationWorkflowError(409, "Choose Update or Skip for every row matched by similar name, then confirm again.", "IMPORT_DECISION_MISSING", undefined, {
      reason: "IMPORT_DECISION_MISSING",
    });
  }
}

type ResultRow = {
  rowNumber: number;
  state: CsvRowState;
  naturalKey: string | null;
  documentId?: string;
  decision?: ImportDecision;
  issues: CsvImportIssue[];
};

export const importResultSummaryKeys = ["create", "update", "unchanged", "rejected", "ambiguous", "skipped"] as const;
type ImportResultSummary = Record<(typeof importResultSummaryKeys)[number], number>;

/** The result's figures: a similar row decided update counts under update, one decided skip under skipped. */
function resultSummary(rows: readonly ResultRow[]): ImportResultSummary {
  const summary: ImportResultSummary = { create: 0, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 0 };
  for (const row of rows) {
    if (row.state === "similar") summary[row.decision === "update" ? "update" : "skipped"] += 1;
    else summary[row.state] += 1;
  }
  return summary;
}

function outcomeOf(row: ResultRow): ImportRowOutcome {
  if (row.state === "similar") return row.decision === "update" ? "updated" : "skipped";
  if (row.state === "create") return "created";
  if (row.state === "update") return "updated";
  return row.state;
}

export async function commitAdministrationImport(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  uploads: unknown;
  previewDigest: unknown;
  confirmed: unknown;
  /** The optional multipart `decisions` field (D-30). */
  decisions?: unknown;
  /** Where the commit's import.committed line goes, and who it names (D-18); absent, no line is written. */
  events?: { log: SecurityEventLogger; actor: { documentId: string; displayName: string } };
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  const actorDocumentId = administrationActorDocumentId(input.state);
  if (input.confirmed !== "true" || typeof input.previewDigest !== "string"
    || !/^sha256:[a-f0-9]{64}$/.test(input.previewDigest)) {
    importError(400, "INVALID_IMPORT_CONFIRMATION", "Review and confirm the CSV import before applying it.");
  }
  const decisions = parseDecisions(input.decisions);
  const reviewed = previewRecordForCommit(input.previewDigest, actorDocumentId, input.kind);
  const upload = await readImportUpload(input.uploads);
  const fileName = upload.fileName;
  if (upload.digest !== reviewed.fileDigest) {
    importError(409, "IMPORT_PREVIEW_CHANGED", "The selected CSV no longer matches the reviewed preview.");
  }
  assertDecisions(reviewed, decisions);
  previewRecords.delete(input.previewDigest);

  return serialized(input.kind, async () => {
    const existing = await input.repository.findNaturalKeyRecords();
    const authoritative = await readImport(input.kind, upload, existing);
    assertImportRecordCapacity(existing, authoritative.rows);
    const naturalKey = input.kind === "controls" ? "controlNumber" : "name";
    const existingByKey = new Map<string, RecordValue[]>();
    for (const record of existing) {
      const value = record[naturalKey];
      if (typeof value !== "string" || !value.trim()) continue;
      const key = normalizeAdministrationNaturalKey(value);
      existingByKey.set(key, [...(existingByKey.get(key) ?? []), record]);
    }
    // A row whose state or match changed since preview is rejected as drifted (D-30).
    const driftedRows = new Set<number>();
    for (let index = 0; index < authoritative.rows.length; index += 1) {
      const current = authoritative.rows[index];
      const previous = reviewed.rows[index];
      if (!previous || previous.rowNumber !== current.rowNumber || previous.state !== current.state
        || previous.matchedDocumentId !== current.matchedDocumentId
        || previous.matchedUpdatedAt !== current.matchedUpdatedAt || previous.matchedName !== current.matchedName) {
        driftedRows.add(index);
      }
    }
    for (let index = authoritative.rows.length; index < reviewed.rows.length; index += 1) driftedRows.add(index);
    const resultRows: ResultRow[] = [];

    for (const [index, row] of authoritative.rows.entries()) {
      if (driftedRows.has(index)) {
        resultRows.push({
          rowNumber: row.rowNumber,
          state: "rejected",
          naturalKey: row.naturalKey,
          issues: [resultIssue("The row changed after preview. Preview the file again before applying it.", "ROW_PREVIEW_DRIFT")],
        });
        continue;
      }
      const decision = row.state === "similar" ? decisions.get(row.rowNumber) : undefined;
      if (row.state === "similar" && decision !== "update") {
        // Skip leaves the record as it is and writes nothing.
        resultRows.push({ rowNumber: row.rowNumber, state: "similar", naturalKey: row.naturalKey, decision: "skip", issues: [] });
        continue;
      }
      if (row.state !== "create" && row.state !== "update" && row.state !== "similar") {
        resultRows.push({ rowNumber: row.rowNumber, state: row.state, naturalKey: row.naturalKey, issues: [...row.issues] });
        continue;
      }
      try {
        let createdKey: string | null = null;
        let createdRecord: RecordValue | null = null;
        // A similar row decided update applies the row's other values and keeps the stored name (D-30).
        const values = row.state === "similar"
          ? Object.fromEntries(Object.entries(row.values).filter(([field]) => field !== naturalKey))
          : row.values;
        if (row.state === "similar" && Object.keys(values).length === 0) {
          // BE3-03: with only the name, an update has nothing to apply. The matched record must still exist, and the
          // row counts and logs as unchanged (no write, so no decision or documentId in its result), never as updated.
          if (!row.matchedDocumentId || !await input.repository.findOne(row.matchedDocumentId)) unavailable(input.kind);
          resultRows.push({ rowNumber: row.rowNumber, state: "unchanged", naturalKey: row.naturalKey, issues: [] });
          continue;
        }
        const documentId = await input.repository.transaction(async () => {
          const mutation = parseAdministrationMutation(input.kind, values, row.state === "create" ? "create" : "update");
          if (row.state === "create") {
            createdKey = normalizeAdministrationNaturalKey(String(mutation[naturalKey]));
            if ((existingByKey.get(createdKey) ?? []).length > 0) conflict(input.kind);
            const created = await input.repository.create(mutation);
            if (typeof created.documentId !== "string") invalid();
            createdRecord = { ...mutation, ...created, documentId: created.documentId };
            return created.documentId;
          }
          if (!row.matchedDocumentId || !await input.repository.findOne(row.matchedDocumentId)) unavailable(input.kind);
          await input.repository.update(row.matchedDocumentId, mutation);
          return row.matchedDocumentId;
        });
        if (createdKey && createdRecord) existingByKey.set(createdKey, [createdRecord]);
        resultRows.push({
          rowNumber: row.rowNumber,
          state: row.state,
          naturalKey: row.naturalKey,
          documentId,
          ...(row.state === "similar" ? { decision: "update" as const } : {}),
          issues: [],
        });
      } catch (error) {
        if (error instanceof Error || isUniqueConstraintError(error)) {
          resultRows.push({ rowNumber: row.rowNumber, state: "rejected", naturalKey: row.naturalKey, issues: [resultIssue("The row could not be saved. Review the current record and try again.", "ROW_WRITE_FAILED")] });
          continue;
        }
        throw error;
      }
    }

    const summary = resultSummary(resultRows);
    const resultToken = issueResultRecord({
      actorDocumentId,
      kind: input.kind,
      fileDigest: upload.digest,
      fileName,
      format: authoritative.format,
      rows: resultRows.map((row) => ({
        rowNumber: row.rowNumber,
        outcome: outcomeOf(row),
        decision: row.decision ?? null,
        issues: retainedIssues(row.issues),
      })),
    });
    // One import.committed line after the commit's transactions: the file by name and digest, and the counts (D-18).
    if (input.events) {
      logSecurityEvent(input.events.log, {
        name: "import.committed",
        actor: input.events.actor,
        collection: input.kind,
        fileName,
        sha256: upload.digest,
        format: authoritative.format,
        counts: {
          created: summary.create,
          updated: summary.update,
          unchanged: summary.unchanged,
          rejected: summary.rejected,
          ambiguous: summary.ambiguous,
          skipped: summary.skipped,
        },
        outcome: "committed",
      });
    }

    return {
      fileName,
      previewDigest: input.previewDigest,
      resultToken,
      limits,
      summary,
      previewChanged: driftedRows.size,
      rows: resultRows,
    };
  });
}

export async function listAdministration(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  query: unknown;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  const parsed = parseAdministrationQuery(input.kind, input.query);
  const [total, ids] = await Promise.all([input.repository.count(parsed), input.repository.selectPage(parsed)]);
  const documents = ids.length > 0 ? await input.repository.hydrate(ids) : [];
  const byId = new Map(documents.map((document) => [document.documentId, document]));
  const ordered = ids.map((id) => byId.get(id));
  if (ordered.some((document) => document === undefined)) invalid();
  return {
    data: ordered.map((document) => projectAdministrationRecord(input.kind, document!)),
    meta: { pagination: { page: parsed.page, pageSize: parsed.pageSize, pageCount: Math.ceil(total / parsed.pageSize), total } },
  };
}

export async function getAdministration(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  documentId: string;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(input.documentId)) unavailable(input.kind);
  const document = await input.repository.findOne(input.documentId);
  if (!document) unavailable(input.kind);
  return projectAdministrationRecord(input.kind, document);
}

export async function createAdministration(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  body: unknown;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  const mutation = parseAdministrationMutation(input.kind, input.body, "create");
  return serialized(input.kind, () => input.repository.transaction(async () => {
    await assertNaturalKeyAvailable(input.repository, input.kind, String(mutation[input.kind === "controls" ? "controlNumber" : "name"]));
    const resolved = await resolveMutationRelations(input.repository, mutation);
    try {
      const created = await input.repository.create(resolved);
      if (typeof created.documentId !== "string") invalid();
      const reloaded = await input.repository.findOne(created.documentId);
      if (!reloaded) invalid();
      return projectAdministrationRecord(input.kind, reloaded);
    } catch (error) {
      if (isUniqueConstraintError(error)) conflict(input.kind);
      throw error;
    }
  }));
}

export async function updateAdministration(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  documentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(input.documentId)) unavailable(input.kind);
  const mutation = parseAdministrationMutation(input.kind, input.body, "update");
  return serialized(input.kind, () => input.repository.transaction(async () => {
    if (!await input.repository.findOne(input.documentId)) unavailable(input.kind);
    const naturalKey = input.kind === "controls" ? "controlNumber" : "name";
    if (typeof mutation[naturalKey] === "string") {
      await assertNaturalKeyAvailable(input.repository, input.kind, mutation[naturalKey] as string, input.documentId);
    }
    const resolved = await resolveMutationRelations(input.repository, mutation);
    try {
      await input.repository.update(input.documentId, resolved);
      const reloaded = await input.repository.findOne(input.documentId);
      if (!reloaded) unavailable(input.kind);
      return projectAdministrationRecord(input.kind, reloaded);
    } catch (error) {
      if (isUniqueConstraintError(error)) conflict(input.kind);
      throw error;
    }
  }));
}

// Import templates (19-14; D-31, D-12; phase-19-import-tolerance.md "Templates").

export type ImportFileFormat = "csv" | "xlsx";

/** A generated file: its name, its format (which names its media type) and its bytes. */
export type AdministrationFile = { readonly fileName: string; readonly format: ImportFileFormat; readonly bytes: Buffer };

/** Each collection's record noun as a sentence names one (the template's `{singular}`). */
const SINGULAR: Readonly<Record<AdministrationKind, string>> = Object.freeze({
  "risk-types": "Risk Type",
  controls: "Control",
  "information-systems": "Information System",
  "information-assets": "Information Asset",
});

/** The template's Notes sheet columns (19-UI-SPEC §3.4). */
const TEMPLATE_NOTES_HEADER = ["Column", "Also accepted as", "Required", "Format and allowed values", "A blank cell"] as const;

/** The six rules after the column notes (19-UI-SPEC §3.4), `{singular}` filled per collection. */
function templateRules(singular: string): readonly string[] {
  return [
    "Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.",
    `#CLEAR on its own empties an optional value when a row updates an existing ${singular}.`,
    "Row 2 is an example. CSRM skips it, so you can keep it or delete it.",
    "Columns CSRM doesn’t recognise are ignored, and the import tells you which.",
    "A cell showing an Excel error, such as #DIV/0!, imports as blank.",
    "Keep this file as an Excel workbook (.xlsx). Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.",
  ];
}

/** What a blank cell does in a column (phase-19-import-tolerance.md "Values"): unchanged on an update, the default on a create. */
function blankCellNote(column: ImportColumnSpec, singular: string): string {
  if (column.required) return "Not allowed. A row without a value here isn’t imported.";
  const created = column.kind === "boolean" ? `a new ${singular} gets No` : `a new ${singular} leaves it empty`;
  return `Keeps the current value when a row updates an existing ${singular}; ${created}.`;
}

/**
 * The example row (D-28, D-31): the reserved natural key from the import vocabulary, which the import skips, then a
 * plausible value per column: the first allowed value of an enumeration, Yes for a flag, and example text.
 */
function exampleValue(column: ImportColumnSpec, spec: ImportSpec): string {
  if (column.field === spec.naturalKey) return spec.exampleKey;
  if (column.kind === "enum") return column.values?.[0] ?? "";
  if (column.kind === "boolean") return "Yes";
  return `Example ${column.label.toLocaleLowerCase("en-AU")}`;
}

/** The template's format: the closed query `format=csv|xlsx` and nothing else. */
export function parseTemplateQuery(query: unknown): ImportFileFormat {
  if (!isRecord(query) || Object.keys(query).length !== 1 || (query.format !== "csv" && query.format !== "xlsx")) {
    throw new AdministrationValidationError("CSRM Administration query is invalid.");
  }
  return query.format;
}

/**
 * A collection's import template (D-31), generated on request from the import vocabulary so it never drifts: the
 * import labels in contract order and one example row, every cell a text cell (`@` in a workbook, so Excel keeps what is
 * typed) through the writers' neutraliser; an XLSX adds the Notes sheet. No dropdowns: write-excel-file needs an add-on
 * for data validation (D-12). Not an export of records, so no event is written (D-18).
 */
export async function buildImportTemplate(kind: AdministrationKind, format: ImportFileFormat): Promise<AdministrationFile> {
  const spec = importColumns(kind);
  const view = exportViewMeta(kind);
  const singular = SINGULAR[kind];
  const header = spec.columns.map((column) => column.label);
  const example = spec.columns.map((column) => exampleValue(column, spec));
  const fileName = `${view.slug}-import-template.${format}`;
  if (format === "csv") {
    return { fileName, format, bytes: writeCsv({ header, rows: [example.map((value) => ({ kind: "text", value }))] }) };
  }
  const widths = new Map(view.columns.map((column) => [column.key, column.width]));
  const text = (value: string): SheetCell => (value === "" ? null : { kind: "text", value });
  const notes: SheetCell[][] = [
    ...spec.columns.map((column) => [column.label, column.field, column.required ? "Required" : "Optional", column.format, blankCellNote(column, singular)].map(text)),
    TEMPLATE_NOTES_HEADER.map(() => null),
    ...templateRules(singular).map((rule) => [text(rule), ...TEMPLATE_NOTES_HEADER.slice(1).map(() => null)]),
  ];
  const bytes = await writeWorkbook([
    { name: `${view.heading} import`, header, rows: [example.map(text)], widths: spec.columns.map((column) => widths.get(column.field) ?? 24) },
    { name: "Notes", header: [...TEMPLATE_NOTES_HEADER], rows: notes, widths: [28, 24, 12, 48, 64] },
  ]);
  return { fileName, format, bytes };
}

// Error reports (19-14; D-32, D-11; phase-19-import-tolerance.md "Error Reports and the Result Record").

const RECORD_TOKEN = /^sha256:[a-f0-9]{64}$/;
const ERROR_REPORT_FIELDS: ReadonlySet<string> = new Set(["previewDigest", "resultToken", "timeZone"]);
const ISSUES_HEADER_KEY = headerKey("Issues");

function invalidErrorReport(): never {
  importError(400, "INVALID_IMPORT_ERROR_REPORT", "Choose the reviewed file again, with its review or its result.");
}

function reviewExpired(): never {
  throw new AdministrationWorkflowError(409, "This review has expired. Choose the file again to check it.", "IMPORT_REVIEW_EXPIRED", undefined, {
    reason: "IMPORT_REVIEW_EXPIRED",
  });
}

/**
 * The error report's multipart fields: `previewDigest`, `resultToken` and `timeZone`, and nothing else. Any other field,
 * an `issues` field above all, is refused: issues come only from Strapi's own records (D-32).
 */
export function errorReportFields(body: unknown): { previewDigest?: unknown; resultToken?: unknown; timeZone?: unknown } {
  if (body === undefined) return {};
  if (!isRecord(body) || Object.keys(body).some((key) => !ERROR_REPORT_FIELDS.has(key))) invalidErrorReport();
  return { previewDigest: body.previewDigest, resultToken: body.resultToken, timeZone: body.timeZone };
}

/** The live preview record of `token` for this actor and collection, read without using it up; null otherwise. */
export function previewRecordForReport(token: string, actorDocumentId: string, kind: AdministrationKind): PreviewRecord | null {
  const record = previewRecords.get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    previewRecords.delete(token);
    return null;
  }
  return record.actorDocumentId === actorDocumentId && record.kind === kind ? record : null;
}

/** A row the report holds: its retained issues, and for a similar row the stored name it matches. */
type ReportedRow = { readonly issues: readonly RetainedIssue[]; readonly similarTo: string | null };

/** An uploaded cell as the writers take it: text without the neutraliser's mark (the writer adds it back), numbers as numbers. */
function reportCell(cell: ImportCell | undefined): SheetCell {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return { kind: "number", value: cell };
  if (typeof cell === "boolean") return { kind: "text", value: cell ? "TRUE" : "FALSE" };
  return { kind: "text", value: stripNeutraliserMark(cell) };
}

/** The suffix an xlsx error report adds to a cell it cuts (the Phase 19 review amendment, 2026-10-17, BE1-02). */
export const ERROR_REPORT_CUT_SUFFIX = " [cut: longer than Excel allows]";

/**
 * An xlsx error report cell that fits Excel: a text longer than XLSX_CELL_MAX_LENGTH as written (the neutraliser's
 * mark included) is cut, never through a surrogate pair, and ends with ERROR_REPORT_CUT_SUFFIX. Every import column is
 * at most 10,000 characters, so such a row is already VALUE_TOO_LONG and re-imports as VALUE_TOO_LONG again.
 */
function fitXlsxText(text: string): string {
  if (sanitizeSpreadsheetCell(text).length <= XLSX_CELL_MAX_LENGTH) return text;
  const mark = sanitizeSpreadsheetCell(text).length - text.length;
  let kept = text.slice(0, XLSX_CELL_MAX_LENGTH - mark - ERROR_REPORT_CUT_SUFFIX.length);
  if (/[\uD800-\uDBFF]$/u.test(kept)) kept = kept.slice(0, -1);
  return `${kept}${ERROR_REPORT_CUT_SUFFIX}`;
}

function fitXlsxCell(cell: SheetCell): SheetCell {
  return cell !== null && cell.kind === "text" ? { kind: "text", value: fitXlsxText(cell.value) } : cell;
}

function csvCell(cell: SheetCell): CsvCell {
  if (cell === null) return null;
  if (cell.kind === "number") return { kind: "number", value: cell.value };
  if (cell.kind === "text") return { kind: "text", value: cell.value };
  return { kind: "date", isoDate: cell.value.toISOString().slice(0, 10) };
}

/**
 * The error report (D-32): rebuilt from the uploaded file and Strapi's own retained record of it for the same actor and
 * collection, the preview record at Review (`previewDigest`) or the result record at Results (`resultToken`), exactly
 * one. The file must be the one the record holds (its SHA-256). It holds the header as typed, then every row not (or
 * not yet) imported, its cells as typed through the writers' neutraliser, and a last `Issues` column whose messages are
 * regenerated from the retained codes (`Row {n}: …`, joined by `; `). At Review a row is reported when it is rejected,
 * ambiguous or similar; at Results when it was rejected (drift included) or ambiguous, so imported, unchanged and the
 * person's own skipped rows are left out. An earlier report's Issues column is replaced, never repeated. The format
 * follows the upload. Not an export of records, so no event is written (D-18).
 */
export async function buildImportErrorReport(input: {
  kind: AdministrationKind;
  state: unknown;
  uploads: unknown;
  previewDigest?: unknown;
  resultToken?: unknown;
  timeZone?: unknown;
}): Promise<AdministrationFile & { readonly rowCount: number }> {
  assertAdministrationScope(input.state);
  const actorDocumentId = administrationActorDocumentId(input.state);
  const atReview = input.previewDigest !== undefined;
  if (atReview === (input.resultToken !== undefined)) invalidErrorReport();
  const token = atReview ? input.previewDigest : input.resultToken;
  if (typeof token !== "string" || !RECORD_TOKEN.test(token)) invalidErrorReport();
  let zone: ExportTimeZone;
  try {
    zone = parseExportTimeZone(input.timeZone);
  } catch {
    invalidErrorReport();
  }
  const upload = await readImportUpload(input.uploads);

  const reported = new Map<number, ReportedRow>();
  let fileDigest: string;
  if (atReview) {
    const record = previewRecordForReport(token, actorDocumentId, input.kind) ?? reviewExpired();
    fileDigest = record.fileDigest;
    for (const row of record.rows) {
      if (row.state === "rejected" || row.state === "ambiguous") reported.set(row.rowNumber, { issues: row.issues, similarTo: null });
      if (row.state === "similar") reported.set(row.rowNumber, { issues: row.issues, similarTo: row.matchedName });
    }
  } else {
    const record = resultRecordFor(token, actorDocumentId, input.kind) ?? reviewExpired();
    fileDigest = record.fileDigest;
    for (const row of record.rows) {
      if (row.outcome === "rejected" || row.outcome === "ambiguous") reported.set(row.rowNumber, { issues: row.issues, similarTo: null });
    }
  }
  if (upload.digest !== fileDigest) importError(400, "INVALID_IMPORT_FILE", "The selected file doesn’t match the reviewed file.");

  let file: ImportFile;
  try {
    file = await readImportFile({ bytes: upload.bytes, fileName: upload.fileName, mimeType: upload.mimeType });
  } catch (error) {
    if (error instanceof ImportFileRefusal) throw fileRefusal(error);
    throw error;
  }
  const rows = file.rows.filter((row) => reported.has(row.rowNumber));
  const width = Math.max(file.header.length, ...rows.map((row) => row.cells.length));
  const kept = Array.from({ length: width }, (_, index) => index).filter((index) => headerKey(file.header[index] ?? "") !== ISSUES_HEADER_KEY || index >= file.header.length);
  // The raw label: the writer marks a header once (BE1-05).
  const header = [...kept.map((index) => stripNeutraliserMark(file.header[index] ?? "")), "Issues"];
  const body = rows.map((row): SheetCell[] => {
    const entry = reported.get(row.rowNumber)!;
    const messages = entry.similarTo !== null
      ? [similarRowMessage(entry.similarTo)]
      : entry.issues.length > 0 ? entry.issues.map((issue) => importIssueMessage(input.kind, issue)) : [importIssueMessage(input.kind, { code: "", field: null })];
    const issues = messages.map((message) => `Row ${row.rowNumber}: ${message}`).join("; ");
    return [...kept.map((index) => reportCell(row.cells[index])), { kind: "text", value: issues }];
  });

  const view = exportViewMeta(input.kind);
  const format = file.format;
  const fileName = exportFileName({ slug: `${view.slug}-import-issues`, localDate: localCalendarDate(new Date(), zone.zone).iso, format });
  const bytes = format === "csv"
    ? writeCsv({ header, rows: body.map((row) => row.map(csvCell)) })
    : await writeWorkbook([{
      name: `${view.heading} issues`,
      header: header.map(fitXlsxText),
      rows: body.map((row) => row.map(fitXlsxCell)),
      widths: [...kept.map(() => 24), 80],
    }]);
  return { fileName, format, bytes, rowCount: rows.length };
}

export default ({ strapi }: { strapi: unknown }) => ({
  list: (input: { kind: AdministrationKind; state: unknown; query: unknown }) => listAdministration({
    ...input,
    repository: createStrapiAdministrationRepository(strapi, input.kind),
  }),
});

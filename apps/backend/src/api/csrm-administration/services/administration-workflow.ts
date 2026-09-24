import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { basename } from "node:path";

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
  CSV_MAX_ROWS,
  csvRowStates,
  parseAdministrationCsv,
  type CsvImportIssue,
  type CsvRowState,
} from "./csv-import";

type RecordValue = Record<string, unknown>;

export class AdministrationWorkflowError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 413 | 415,
    message: string,
    public readonly code: string,
    public readonly field?: string,
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

function importError(status: 400 | 409 | 413 | 415, code: string, message: string): never {
  throw new AdministrationWorkflowError(status, message, code);
}

function uploadFrom(value: unknown): MultipartUpload {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !("file" in value)) {
    importError(400, "INVALID_IMPORT_FILE", "Select one CSV file to import.");
  }
  const candidate = value.file;
  if (Array.isArray(candidate)) importError(400, "INVALID_IMPORT_FILE", "Select one CSV file to import.");
  if (!isRecord(candidate)) importError(400, "INVALID_IMPORT_FILE", "Select one CSV file to import.");
  return candidate;
}

async function readCsvUpload(value: unknown): Promise<{ bytes: Uint8Array; fileName: string }> {
  const upload = uploadFrom(value);
  if (typeof upload.filepath !== "string" || typeof upload.originalFilename !== "string") {
    importError(400, "INVALID_IMPORT_FILE", "Select one CSV file to import.");
  }
  const fileName = basename(upload.originalFilename).slice(0, 255);
  const mime = typeof upload.mimetype === "string" ? upload.mimetype.toLocaleLowerCase("en-AU") : "";
  if (!fileName.toLocaleLowerCase("en-AU").endsWith(".csv")
    || (mime !== "" && mime !== "text/csv" && mime !== "application/vnd.ms-excel")) {
    importError(415, "UNSUPPORTED_IMPORT_MEDIA", "Select a CSV file to import.");
  }
  if (typeof upload.size === "number" && upload.size > CSV_MAX_BYTES) {
    importError(413, "IMPORT_LIMIT_EXCEEDED", "The CSV file is too large.");
  }
  const bytes = new Uint8Array(await readFile(upload.filepath));
  if (bytes.byteLength > CSV_MAX_BYTES) importError(413, "IMPORT_LIMIT_EXCEEDED", "The CSV file is too large.");
  return { bytes, fileName };
}

function parseCsv(kind: AdministrationKind, bytes: Uint8Array, existing: readonly RecordValue[]) {
  try {
    return parseAdministrationCsv({ kind, bytes, existing });
  } catch {
    importError(400, "INVALID_IMPORT_FILE", "The CSV file could not be validated.");
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
  const { bytes, fileName } = await readCsvUpload(input.uploads);
  return serialized(input.kind, async () => {
    const existing = await input.repository.findNaturalKeyRecords();
    const preview = parseCsv(input.kind, bytes, existing);
    assertImportRecordCapacity(existing, preview.rows);
    const previewDigest = issuePreviewRecord({
      actorDocumentId,
      kind: input.kind,
      fileDigest: preview.digest,
      rows: preview.rows.map((row) => ({ state: row.state, matchedDocumentId: row.matchedDocumentId, matchedUpdatedAt: row.matchedUpdatedAt })),
    });
    const rows = preview.rows.map(({ matchedUpdatedAt: _matchedUpdatedAt, ...row }) => row);
    return { fileName, previewDigest, limits, summary: preview.counts, rows };
  });
}

function resultIssue(message: string, code = "ROW_WRITE_REJECTED"): CsvImportIssue {
  return { code, field: null, message };
}

function resultCounts(rows: readonly { state: CsvRowState }[]): Record<CsvRowState, number> {
  return Object.fromEntries(csvRowStates.map((state) => [state, rows.filter((row) => row.state === state).length])) as Record<CsvRowState, number>;
}

type PreviewRecord = {
  actorDocumentId: string;
  kind: AdministrationKind;
  fileDigest: string;
  expiresAt: number;
  rows: readonly { state: CsvRowState; matchedDocumentId: string | null; matchedUpdatedAt: string | null }[];
};

const PREVIEW_TTL_MS = 5 * 60 * 1_000;
const MAX_PREVIEW_RECORDS = 256;
const MAX_PREVIEWS_PER_ACTOR_AND_KIND = 16;
const previewRecords = new Map<string, PreviewRecord>();

function administrationActorDocumentId(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.idamboxUser)
    || typeof state.idamboxUser.documentId !== "string"
    || !/^[A-Za-z0-9_-]{1,200}$/.test(state.idamboxUser.documentId)) {
    throw new AdministrationWorkflowError(403, "CSRM Administration access is denied.", "ADMINISTRATION_FORBIDDEN");
  }
  return state.idamboxUser.documentId;
}

function prunePreviewRecords(now: number): void {
  for (const [token, record] of previewRecords) {
    if (record.expiresAt <= now) previewRecords.delete(token);
  }
}

function issuePreviewRecord(input: Omit<PreviewRecord, "expiresAt">): string {
  const now = Date.now();
  prunePreviewRecords(now);
  const actorTokens = [...previewRecords.entries()]
    .filter(([, record]) => record.actorDocumentId === input.actorDocumentId && record.kind === input.kind)
    .map(([token]) => token);
  while (actorTokens.length >= MAX_PREVIEWS_PER_ACTOR_AND_KIND) {
    previewRecords.delete(actorTokens.shift()!);
  }
  while (previewRecords.size >= MAX_PREVIEW_RECORDS) {
    const oldest = previewRecords.keys().next().value as string | undefined;
    if (!oldest) break;
    previewRecords.delete(oldest);
  }
  let token: string;
  do token = `sha256:${randomBytes(32).toString("hex")}`;
  while (previewRecords.has(token));
  previewRecords.set(token, { ...input, expiresAt: now + PREVIEW_TTL_MS });
  return token;
}

function previewRecordForCommit(token: string, actorDocumentId: string, kind: AdministrationKind): PreviewRecord {
  const now = Date.now();
  prunePreviewRecords(now);
  const record = previewRecords.get(token);
  if (!record || record.actorDocumentId !== actorDocumentId || record.kind !== kind || record.expiresAt <= now) {
    importError(409, "IMPORT_PREVIEW_CHANGED", "The selected CSV no longer matches the reviewed preview.");
  }
  return record;
}

export async function commitAdministrationImport(input: {
  repository: AdministrationRepository;
  kind: AdministrationKind;
  state: unknown;
  uploads: unknown;
  previewDigest: unknown;
  confirmed: unknown;
}): Promise<RecordValue> {
  assertAdministrationScope(input.state);
  const actorDocumentId = administrationActorDocumentId(input.state);
  if (input.confirmed !== "true" || typeof input.previewDigest !== "string"
    || !/^sha256:[a-f0-9]{64}$/.test(input.previewDigest)) {
    importError(400, "INVALID_IMPORT_CONFIRMATION", "Review and confirm the CSV import before applying it.");
  }
  const reviewed = previewRecordForCommit(input.previewDigest, actorDocumentId, input.kind);
  const { bytes, fileName } = await readCsvUpload(input.uploads);
  const byteCheck = parseCsv(input.kind, bytes, []);
  if (byteCheck.digest !== reviewed.fileDigest) {
    importError(409, "IMPORT_PREVIEW_CHANGED", "The selected CSV no longer matches the reviewed preview.");
  }
  previewRecords.delete(input.previewDigest);

  return serialized(input.kind, async () => {
    const existing = await input.repository.findNaturalKeyRecords();
    const authoritative = parseCsv(input.kind, bytes, existing);
    assertImportRecordCapacity(existing, authoritative.rows);
    const naturalKey = input.kind === "controls" ? "controlNumber" : "name";
    const existingByKey = new Map<string, RecordValue[]>();
    for (const record of existing) {
      const value = record[naturalKey];
      if (typeof value !== "string" || !value.trim()) continue;
      const key = normalizeAdministrationNaturalKey(value);
      existingByKey.set(key, [...(existingByKey.get(key) ?? []), record]);
    }
    const driftedRows = new Set<number>();
    for (let index = 0; index < authoritative.rows.length; index += 1) {
      const current = authoritative.rows[index];
      const previous = reviewed.rows[index];
      if (!previous || previous.state !== current.state || previous.matchedDocumentId !== current.matchedDocumentId
        || previous.matchedUpdatedAt !== current.matchedUpdatedAt) {
        driftedRows.add(index);
      }
    }
    for (let index = authoritative.rows.length; index < reviewed.rows.length; index += 1) driftedRows.add(index);
    const resultRows: Array<{ rowNumber: number; state: CsvRowState; naturalKey: string | null; documentId?: string; issues: CsvImportIssue[] }> = [];

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
      if (row.state !== "create" && row.state !== "update") {
        resultRows.push({ rowNumber: row.rowNumber, state: row.state, naturalKey: row.naturalKey, issues: [...row.issues] });
        continue;
      }
      try {
        let createdKey: string | null = null;
        let createdRecord: RecordValue | null = null;
        const documentId = await input.repository.transaction(async () => {
          const mutation = parseAdministrationMutation(input.kind, row.values, row.state === "create" ? "create" : "update");
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
        resultRows.push({ rowNumber: row.rowNumber, state: row.state, naturalKey: row.naturalKey, documentId, issues: [] });
      } catch (error) {
        if (error instanceof Error || isUniqueConstraintError(error)) {
          resultRows.push({ rowNumber: row.rowNumber, state: "rejected", naturalKey: row.naturalKey, issues: [resultIssue("The row could not be saved. Review the current record and try again.", "ROW_WRITE_FAILED")] });
          continue;
        }
        throw error;
      }
    }

    return {
      fileName,
      previewDigest: input.previewDigest,
      limits,
      summary: resultCounts(resultRows),
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

export default ({ strapi }: { strapi: unknown }) => ({
  list: (input: { kind: AdministrationKind; state: unknown; query: unknown }) => listAdministration({
    ...input,
    repository: createStrapiAdministrationRepository(strapi, input.kind),
  }),
});

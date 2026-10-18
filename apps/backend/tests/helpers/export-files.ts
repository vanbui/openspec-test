import assert from "node:assert/strict";
import { parse } from "csv-parse/sync";

import { findZipEntry, readZipDirectory, readZipEntry } from "../../src/csrm/files/zip-archive";
import { UTF8_BOM } from "../../src/csrm/spreadsheets/csv-writer";
import { readWorkbookSheets, type XlsxSheet } from "../../src/csrm/spreadsheets/xlsx-reader";

/*
 * The export integration files' shared readers (19-05; D-11, D-18): an exported workbook read back through CSRM's own
 * reader, a CSV read back after its BOM, one raw part of a workbook (so a test can prove a cell carries no formula
 * element), and the security event lines Strapi's logger writes while an export runs. Plans 19-07 to 19-10 and 19-14
 * read their exports through these.
 */

type Json = Record<string, unknown>;

/** The sheets of an exported workbook, with typed cells, read as the import reads a workbook. */
export async function readExportWorkbook(bytes: Uint8Array): Promise<XlsxSheet[]> {
  return readWorkbookSheets(bytes);
}

/** The records of an exported CSV: it must start with the UTF-8 BOM, which is not part of the first header. */
export function readExportCsv(bytes: Uint8Array): string[][] {
  const buffer = Buffer.from(bytes);
  assert.ok(buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM), "EXPORT_CSV_WITHOUT_BOM");
  return parse(buffer.subarray(UTF8_BOM.length), { relax_column_count: false }) as string[][];
}

/** One part of a workbook's ZIP package as UTF-8 text, such as `xl/worksheets/sheet1.xml`. */
export function readSheetXml(bytes: Uint8Array, partPath: string): string {
  const directory = readZipDirectory(bytes);
  const entry = findZipEntry(directory, partPath);
  assert.ok(entry, `EXPORT_WORKBOOK_PART_MISSING_${partPath}`);
  return readZipEntry(bytes, entry, { maxOutputLength: entry.uncompressedSize }).toString("utf8");
}

/** One `csrm.security_event` line Strapi's logger wrote: its level and its parsed payload. */
export type CapturedSecurityEvent = { readonly level: "info" | "warn"; readonly event: Json };

type LoggerHolder = { log: { info: (...args: unknown[]) => unknown; warn: (...args: unknown[]) => unknown } };

const SECURITY_EVENT_PREFIX = "csrm.security_event ";

/**
 * Wraps `strapi.log.info` and `strapi.log.warn` (still writing every line) and records each security event line.
 * `events()` returns the parsed payloads so far; `restore()` puts the logger back, and must run in a `finally`.
 */
export function captureSecurityEvents(strapi: unknown): { events: () => readonly CapturedSecurityEvent[]; restore: () => void } {
  const log = (strapi as LoggerHolder).log;
  const originals = { info: log.info, warn: log.warn };
  const captured: CapturedSecurityEvent[] = [];
  for (const level of ["info", "warn"] as const) {
    log[level] = (...args: unknown[]) => {
      const line = args.map(String).join(" ");
      if (line.startsWith(SECURITY_EVENT_PREFIX)) captured.push({ level, event: JSON.parse(line.slice(SECURITY_EVENT_PREFIX.length)) as Json });
      return originals[level].apply(log, args);
    };
  }
  return {
    events: () => [...captured],
    restore: () => {
      log.info = originals.info;
      log.warn = originals.warn;
    },
  };
}

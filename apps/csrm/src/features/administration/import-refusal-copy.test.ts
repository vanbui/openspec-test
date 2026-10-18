import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { IMPORT_FILE_REFUSAL_REASONS, importFileRefusal, importStepRefusal, isImportFileRefusalReason } from './import-refusal-copy';

const saveAsUtf8 = [
  '1. In Excel, choose File > Save As.',
  '2. Choose “CSV UTF-8 (Comma delimited) (*.csv)” and save.',
  '3. Choose the new file here. Or upload the Excel workbook (.xlsx) itself.',
];

describe('family S2: the import file refusals (19-UI-SPEC §6)', () => {
  it('lists the 16 file refusals and recognises only them', () => {
    expect(IMPORT_FILE_REFUSAL_REASONS).toHaveLength(16);
    expect(IMPORT_FILE_REFUSAL_REASONS.at(-1)).toBe('IMPORT_CSV_MALFORMED');
    for (const reason of IMPORT_FILE_REFUSAL_REASONS) expect(isImportFileRefusalReason(reason)).toBe(true);
    for (const reason of ['IMPORT_DECISION_MISSING', 'IMPORT_REVIEW_EXPIRED', 'EXPORT_ROW_LIMIT', undefined] as const) expect(isImportFileRefusalReason(reason)).toBe(false);
  });

  it('asks for CSV UTF-8 when the file is in Excel’s older CSV format', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_ENCODING_WINDOWS_1252' })).toEqual({
      title: 'Save the file as CSV UTF-8',
      body: 'This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.',
      steps: saveAsUtf8,
    });
  });

  it('asks for CSV UTF-8 when the file is Unicode Text', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_ENCODING_UTF16' })).toEqual({
      title: 'Save the file as CSV UTF-8',
      body: 'This file is saved as “Unicode Text”.',
      steps: saveAsUtf8,
    });
  });

  it('asks for CSV UTF-8 when the file isn’t UTF-8 text', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_ENCODING_UNKNOWN' })).toEqual({
      title: 'Save the file as CSV UTF-8',
      body: 'This file isn’t UTF-8 text.',
      steps: saveAsUtf8,
    });
  });

  it('names the semicolons or tabs it found', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_DELIMITER', found: { delimiter: 'tab' } })).toEqual({
      title: 'Separate the columns with commas',
      body: 'This file separates columns with tabs.',
      steps: saveAsUtf8,
    });
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_DELIMITER', found: { delimiter: 'semicolon' } }).body).toBe('This file separates columns with semicolons.');
  });

  /* Review amendment R1 part 2: each S2 row's approved form when the detail it names is absent. */
  it('reads the approved fallbacks when a name, a count, the headers or the labels are absent', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_FILE_TYPE', fileName: '' }).body).toBe('This file isn’t a CSV or Excel workbook (.xlsx).');
    expect(importFileRefusal({ fileSize: '6.2 MB', reason: 'IMPORT_FILE_TOO_LARGE' }).body).toBe('This file is 6.2 MB. The limit is 5 MB. Split the rows into smaller files and import each.');
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_TOO_MANY_ROWS' }).body).toBe('It has more than 5,000 rows. Split the rows into smaller files and import each.');
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_DUPLICATE_HEADER' }).body).toBe('Two of the column names match the same column. Delete one of them, then choose the file again.');
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_MISSING_COLUMN' }).body).toBe('Add the required columns (they’re in the template), then choose the file again.');
  });

  /* FE4-07, review amendment R1 part 2: without the separator, a sentence true for any separator, never a guessed one. */
  it('says the file doesn’t use commas when the separator it found is absent', () => {
    for (const found of [undefined, {}]) {
      expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_DELIMITER', ...(found ? { found } : {}) })).toEqual({
        title: 'Separate the columns with commas',
        body: 'This file doesn’t separate its columns with commas.',
        steps: saveAsUtf8,
      });
    }
  });

  it('asks for .xlsx in place of an Excel 97-2003 workbook', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_LEGACY_XLS' })).toEqual({
      title: 'Save the workbook as .xlsx',
      body: 'This is an Excel 97-2003 workbook (.xls). In Excel, choose File > Save As, choose “Excel Workbook (*.xlsx)”, then choose the new file.',
      steps: [],
    });
  });

  it('asks for a copy without macros', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_MACRO_WORKBOOK' })).toEqual({
      title: 'Save the workbook without macros',
      body: 'This workbook contains macros. In Excel, choose File > Save As and “Excel Workbook (*.xlsx)”, which removes them, then choose the copy.',
      steps: [],
    });
  });

  it('asks for the workbook’s password to be removed', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_ENCRYPTED_WORKBOOK' })).toEqual({
      title: 'Remove the workbook’s password',
      body: 'This workbook is protected with a password, so it can’t be read. Open it in Excel, remove the password, save it, then choose it again.',
      steps: [],
    });
  });

  it('names a file that isn’t CSV or Excel', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_FILE_TYPE', fileName: 'controls.pdf' })).toEqual({
      title: 'Choose a CSV or Excel file',
      body: '“controls.pdf” isn’t a CSV or Excel workbook (.xlsx).',
      steps: [],
    });
  });

  it('names a file that is too large and its size', () => {
    expect(importFileRefusal({ reason: 'IMPORT_FILE_TOO_LARGE', fileName: 'risks.xlsx', fileSize: '6.2 MB' })).toEqual({
      title: 'This file is too large',
      body: '“risks.xlsx” is 6.2 MB. The limit is 5 MB. Split the rows into smaller files and import each.',
      steps: [],
    });
  });

  /* FE4-07: the browser always knows a file's size, so the size is required and no fallback says what it may not be. */
  it('always names a too-large file’s size: the size is required and the “larger than 5 MB” fallback is gone', () => {
    // @ts-expect-error FE4-07: a refusal is worded only with the chosen file's size.
    const withoutSize = () => importFileRefusal({ reason: 'IMPORT_FILE_TOO_LARGE', fileName: 'risks.xlsx' });
    expect(withoutSize).toBeTypeOf('function');
    const source = readFileSync(resolve(process.cwd(), 'src/features/administration/import-refusal-copy.ts'), 'utf8');
    expect(source).not.toContain('larger than 5 MB');
  });

  it('names the rows a file with too many rows holds', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_TOO_MANY_ROWS', found: { rows: 12001 } })).toEqual({
      title: 'This file has too many rows',
      body: 'It has 12,001 rows. The limit is 5,000. Split the rows into smaller files and import each.',
      steps: [],
    });
  });

  it('asks for a smaller workbook', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_WORKBOOK_TOO_LARGE' })).toEqual({
      title: 'This workbook is too large to open',
      body: 'Delete unused sheets and formatting, or save the rows as CSV UTF-8, then choose the file again.',
      steps: [],
    });
  });

  it('asks for a header row', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_NO_HEADER' })).toEqual({
      title: 'Add a header row',
      body: 'The first row must hold the column names. Copy them from the template.',
      steps: [],
    });
  });

  it('says there are no rows below the column names', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_NO_ROWS' })).toEqual({
      title: 'There are no rows to import',
      body: 'The file has column names but no rows below them.',
      steps: [],
    });
  });

  it('names both headers and the column they both match', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_DUPLICATE_HEADER', found: { headers: ['Name', 'NAME'], labels: ['Name'] } })).toEqual({
      title: 'Two columns mean the same thing',
      body: '“Name” and “NAME” both match Name. Delete one of them, then choose the file again.',
      steps: [],
    });
  });

  it('names one missing column', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_MISSING_COLUMN', found: { labels: ['Control number'] } })).toEqual({
      title: 'A required column is missing',
      body: 'Add a column named Control number (they’re in the template), then choose the file again.',
      steps: [],
    });
  });

  it('names two missing columns', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_MISSING_COLUMN', found: { labels: ['Name', 'Owner'] } }).body)
      .toBe('Add columns named Name and Owner (they’re in the template), then choose the file again.');
  });

  /* The import record's 2026-10-17 amendment, copy approved as written. */
  it('names the line a CSV can’t be read on, and how to fix it', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_CSV_MALFORMED', found: { line: 14 } })).toEqual({
      title: 'Fix the CSV file',
      body: 'Line 14 can’t be read. A quote may be missing, or the row has a different number of columns from the header.',
      steps: ['Open the file in Excel, check that row, then:', ...saveAsUtf8],
    });
  });

  it('says a row can’t be read when no line was found', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_CSV_MALFORMED' })).toEqual({
      title: 'Fix the CSV file',
      body: 'A row can’t be read. A quote may be missing, or a row has a different number of columns from the header.',
      steps: ['Open the file in Excel, check that row, then:', ...saveAsUtf8],
    });
  });

  it('names three missing columns in a written-out list', () => {
    expect(importFileRefusal({ fileSize: '10 bytes', reason: 'IMPORT_MISSING_COLUMN', found: { labels: ['Name', 'Owner', 'Status'] } }).body)
      .toBe('Add columns named Name, Owner and Status (they’re in the template), then choose the file again.');
  });
});

describe('family S3: templates, error reports and decisions (19-UI-SPEC §6)', () => {
  it.each([
    ['template', { message: 'We couldn’t download the template.', action: 'Try again' }],
    ['review-expired', { message: 'This review has expired. Choose the file again to check it.', action: 'Choose file again' }],
    ['error-report', { message: 'We couldn’t prepare the error report.', action: 'Try again' }],
    ['decision-missing', { message: 'Choose Update or Skip for every row matched by similar name, then confirm again.', action: null }],
  ] as const)('words the %s refusal', (kind, copy) => {
    expect(importStepRefusal(kind)).toEqual(copy);
  });
});

/*
 * 19-UI-SPEC "Reserved words" and "Voice": `Accept` stays the risk owner's decision (G-14; "accepted types" reads
 * "allowed"), no copy says "dump", "extract" or "generate a file", and every apostrophe and quote is typographic.
 */
describe('family S vocabulary', () => {
  const founds = [
    undefined,
    {},
    { delimiter: 'semicolon' as const },
    { delimiter: 'tab' as const },
    { rows: 5001 },
    { bytes: 6_000_000 },
    { headers: ['Name', 'NAME'], labels: ['Name'] },
    { labels: ['Control number'] },
    { labels: ['Name', 'Owner'] },
    { labels: ['Name', 'Owner', 'Status'] },
    { line: 14 },
  ];
  const files = [{ fileSize: '10 bytes' }, { fileName: 'risks.xlsx', fileSize: '10 bytes' }, { fileName: 'risks.xlsx', fileSize: '6.2 MB' }];

  it('keeps the family S vocabulary in every title, body, step and action it returns', () => {
    const strings = new Set<string>();
    for (const reason of IMPORT_FILE_REFUSAL_REASONS) {
      for (const found of founds) {
        for (const file of files) {
          const copy = importFileRefusal({ reason, found, ...file });
          for (const text of [copy.title, copy.body, ...copy.steps]) strings.add(text);
        }
      }
    }
    for (const kind of ['template', 'review-expired', 'error-report', 'decision-missing'] as const) {
      const copy = importStepRefusal(kind);
      strings.add(copy.message);
      if (copy.action) strings.add(copy.action);
    }
    expect(strings.size).toBeGreaterThan(40);
    for (const text of strings) {
      expect(text, text).not.toMatch(/accept|dump|extract|generate a file/i);
      expect(text, text).not.toMatch(/['"]/);
    }
  });
});

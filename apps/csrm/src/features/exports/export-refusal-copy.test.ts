import { describe, expect, it } from 'vitest';

import { CONFLICT_REASONS } from '../../lib/api/conflict-reasons';
import { exportRefusal } from './export-refusal-copy';

describe('family S1: the export dialog’s refusals (19-UI-SPEC §6)', () => {
  it('says how many rows the export would hold beside the 10,000 limit', () => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500 })).toEqual({
      tone: 'warning',
      message: 'This export would hold 12,500 rows, more than the 10,000 limit. Narrow the search or filters, then export again.',
      retry: false,
    });
  });

  it('formats a large row count with en-AU grouping', () => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 1234567 }).message)
      .toBe('This export would hold 1,234,567 rows, more than the 10,000 limit. Narrow the search or filters, then export again.');
  });

  /*
   * FE4-07, review amendment R1 part 2: a row limit whose count the transport dropped is still the row limit, so it
   * offers no Try again that the limit would refuse again, and says so without a count.
   */
  it('reads a row limit whose count the transport dropped as the row limit, with no Try again', () => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_ROW_LIMIT' })).toEqual({
      tone: 'warning',
      message: 'This export would hold more rows than the 10,000 limit. Narrow the search or filters, then export again.',
      retry: false,
    });
  });

  it('says an unreleased assessment can be exported once it’s released', () => {
    expect(exportRefusal({ status: 409, reason: 'ASSESSMENT_NOT_RELEASED' })).toEqual({
      tone: 'warning',
      message: 'This risk assessment can be exported once it’s released. Refresh the page to see its current state.',
      retry: false,
    });
  });

  it('reads a 400 for an invalid query, column or format as filters to clear', () => {
    expect(exportRefusal({ status: 400 })).toEqual({
      tone: 'warning',
      message: 'The current search or filters can’t be exported. Clear the filters, then export again.',
      retry: false,
    });
  });

  it('words every 403 itself, whatever the server said', () => {
    expect(exportRefusal({ status: 403 })).toEqual({ tone: 'danger', message: 'You don’t have access to export this list.', retry: false });
    expect(exportRefusal({ status: 403, reason: 'OWN_REQUEST' }).message).toBe('You don’t have access to export this list.');
  });

  it('reads a 404 on the released assessment as no longer available', () => {
    expect(exportRefusal({ status: 404, view: 'released-assessment' })).toEqual({
      tone: 'danger',
      message: 'We couldn’t find this risk assessment. It may no longer be available to you.',
      retry: false,
    });
  });

  /* Review amendment R1 part 3 (FE4-09): S1's 403 and 404 name the view the person exported. */
  it.each([
    ['list', 'You don’t have access to export this list.'],
    ['report', 'You don’t have access to export this report.'],
    ['released-assessment', 'You don’t have access to export this risk assessment.'],
  ] as const)('words a 403 on a %s for that view', (view, message) => {
    expect(exportRefusal({ status: 403, view })).toEqual({ tone: 'danger', message, retry: false });
  });

  it.each(['list', 'report'] as const)('reads a 404 on a %s as the failed file, with Try again', (view) => {
    expect(exportRefusal({ status: 404, view })).toEqual({ tone: 'danger', message: 'We couldn’t create the file.', retry: true });
  });

  /*
   * The exports record's code review amendment (2026-10-17, 3b5c66fa): a cell over Excel's limit names its column by the
   * vocabulary's label and points to the lossless route, the CSV or, for the released assessment, its tables and report.
   */
  it.each(['list', 'report'] as const)('says which column is too long for Excel on a %s, and to export a CSV', (view) => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_CELL_TOO_LONG', columnLabel: 'Statement', view })).toEqual({
      tone: 'warning',
      title: 'A value is too long for Excel',
      message: 'Statement holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export as CSV instead, or shorten the text in CSRM.',
      retry: false,
    });
  });

  it('points the released assessment to its CSV tables or its print-ready report', () => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_CELL_TOO_LONG', columnLabel: 'Risk statement', view: 'released-assessment' })).toEqual({
      tone: 'warning',
      title: 'A value is too long for Excel',
      message: 'Risk statement holds text longer than Excel’s 32,767-character cell limit, so the workbook would cut it. Export the Risks or Mitigation controls table as CSV, or use the print-ready report for the whole record.',
      retry: false,
    });
  });

  it('reads a cell limit whose column it can’t name as the failed file', () => {
    expect(exportRefusal({ status: 422, reason: 'EXPORT_CELL_TOO_LONG' })).toEqual({ tone: 'danger', message: 'We couldn’t create the file.', retry: true });
  });

  it.each([
    ['a 5xx', { status: 500 }],
    ['a 503', { status: 503 }],
    ['a network failure', {}],
    ['a response the file validator rejects', { status: 200 }],
    ['an unknown 409', { status: 409 }],
  ])('offers Try again after %s', (_scenario, failure) => {
    expect(exportRefusal(failure)).toEqual({ tone: 'danger', message: 'We couldn’t create the file.', retry: true });
  });

  /*
   * 19-UI-SPEC "Reserved words" and "Voice": `Accept` stays the risk owner's decision (G-14), export copy never says
   * "dump", "extract" or "generate a file", and every apostrophe and quote is typographic.
   */
  it('keeps the family S vocabulary in every sentence it returns', () => {
    const statuses = [undefined, 200, 400, 403, 404, 409, 413, 415, 422, 500, 502, 503];
    const reasons = [undefined, ...CONFLICT_REASONS];
    const messages = new Set<string>();
    for (const status of statuses) {
      for (const reason of reasons) {
        for (const rowCount of [undefined, 0, 1, 12500]) messages.add(exportRefusal({ status, reason, rowCount }).message);
      }
    }
    expect(messages.size).toBeGreaterThanOrEqual(6);
    for (const message of messages) {
      expect(message).not.toMatch(/accept|dump|extract|generate a file/i);
      expect(message).not.toMatch(/['"]/);
    }
  });
});

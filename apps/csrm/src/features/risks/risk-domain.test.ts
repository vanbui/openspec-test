import { describe, expect, it } from 'vitest';

import { calendarDate, formatRiskTargetDate, isAcceptedRiskRow, readRiskRegisterQuery, riskRegisterCardMarker } from './risk-domain';
import { parseRiskRegisterQuery } from './risk-schema';

/*
 * The loading state reads the register's URL without zod (plan 08-13); the page validates it with
 * riskRegisterQuerySchema. The two must read every URL alike, so each case runs through both.
 */
const readable: [string, Record<string, unknown>][] = [
  ['no parameters', {}],
  ['every filter, the sort and the paging', {
    q: '  unauthorised access  ', treatmentStatus: 'In Progress', inherentRating: 'High', residualRating: 'Moderate',
    riskOwner: 'owner_1', treatmentOwner: ' owner-2 ', assessment: 'asm1', system: 'sys-1', asset: 'asset_1',
    mitigationStatus: 'Planned', state: 'closed', stage: 'under-assessment', treatmentAction: 'Treat', dueState: 'due-soon', mitigationEffectiveness: 'Not Assessed', impactedSystem: 'none', targetDateFrom: '2026-06-30', targetDateTo: '2026-07-31',
    sort: 'riskNumber:desc', page: '3', pageSize: '50',
  }],
  ['values outside each vocabulary', {
    treatmentStatus: 'Bogus', inherentRating: 'high', residualRating: '', mitigationStatus: 'Unknown', state: 'archived', stage: 'Released', treatmentAction: 'accept', dueState: 'Overdue', mitigationEffectiveness: 'not provided', impactedSystem: 'None',
    riskOwner: 'has space', treatmentOwner: '', assessment: 'a'.repeat(201), system: 'semi;colon', asset: '   ',
    sort: 'nope', page: '0', pageSize: '20',
  }],
  ['repeated parameters, of which the first counts', { q: ['first', 'second'], treatmentStatus: ['Complete', 'Overdue'], sort: ['targetDate:desc', 'riskNumber:asc'], page: ['2', '9'], pageSize: ['10', '50'] }],
  ['a search longer than 200 characters', { q: 'x'.repeat(201) }],
  ['a search of exactly 200 characters once trimmed', { q: ` ${'y'.repeat(200)} ` }],
  ['pages that are not whole numbers in range', { page: 'abc', pageSize: 'ten' }],
  ['a page past the last allowed', { page: '1000001' }],
  ['a fractional page', { page: '2.5' }],
  ['a page with spaces', { page: ' 4 ' }],
  ['one date bound', { targetDateFrom: '2026-02-28' }],
  ['equal date bounds', { targetDateFrom: '2026-12-01', targetDateTo: '2026-12-01' }],
  ['parameters the register does not know', { foo: 'bar', riskStatement: 'x' }],
  ['the none and any figure filters', { inherentRating: 'none', residualRating: 'none', treatmentStatus: 'none', mitigationStatus: 'any', mitigationEffectiveness: 'none' }],
  ['no impacted system beside a chosen system, which wins', { system: 'sys-1', impactedSystem: 'none' }],
];

const refused: [string, Record<string, unknown>][] = [
  ['an impossible calendar date', { targetDateFrom: '2026-02-30' }],
  ['a date that is not a date', { targetDateTo: 'tomorrow' }],
  ['an empty date', { targetDateFrom: '' }],
  ['a repeated date parameter', { targetDateFrom: ['2026-01-01', '2026-01-02'] }],
  ['a range whose start follows its end', { targetDateFrom: '2026-07-31', targetDateTo: '2026-06-30' }],
];

/*
 * D-41, D-44, UI-SPEC section 9.1: "Accepted" marks the recorded decision on a released Risk. A Risk still
 * under assessment with Accept shows only its treatment action, never as accepted.
 */
describe('isAcceptedRiskRow', () => {
  it.each([
    ['a closed released Risk with Accept', { stage: 'released', treatmentAction: 'Accept', accepted: false }, false],
    ['a released Risk with Accept', { stage: 'released', treatmentAction: 'Accept', accepted: true }, true],
    ['a Risk under assessment with Accept', { stage: 'under-assessment', treatmentAction: 'Accept' }, false],
    ['a released Risk with Treat', { stage: 'released', treatmentAction: 'Treat' }, false],
    ['a released Risk with no treatment action', { stage: 'released', treatmentAction: null }, false],
    ['a Risk under assessment with no treatment action', { stage: 'under-assessment', treatmentAction: null }, false],
  ] as const)('reads %s', (_case, row, accepted) => {
    expect(isAcceptedRiskRow(row)).toBe(accepted);
  });

  it('writes the card’s marker: the stage, then “ · Accepted” for an accepted Risk', () => {
    expect(riskRegisterCardMarker({ stage: 'released', treatmentAction: 'Accept', accepted: true })).toBe('Released · Accepted');
    expect(riskRegisterCardMarker({ stage: 'released', treatmentAction: 'Treat' })).toBe('Released');
    expect(riskRegisterCardMarker({ stage: 'under-assessment', treatmentAction: 'Accept' })).toBe('Under assessment');
    expect(riskRegisterCardMarker({ stage: 'under-assessment', treatmentAction: null })).toBe('Under assessment');
  });
});

describe('readRiskRegisterQuery', () => {
  it.each(readable)('reads %s exactly as the page’s schema does', (_case, input) => {
    expect(readRiskRegisterQuery(input)).toEqual(parseRiskRegisterQuery(input));
  });

  it.each(refused)('refuses %s, as the page’s schema does', (_case, input) => {
    expect(() => parseRiskRegisterQuery(input)).toThrow();
    expect(() => readRiskRegisterQuery(input)).toThrow('RISK_REGISTER_QUERY_INVALID');
  });

  it('applies the register’s defaults when the URL has none', () => {
    expect(readRiskRegisterQuery({})).toEqual({ q: '', sort: 'targetDate:asc', page: 1, pageSize: 25 });
  });
});

describe('the register’s pure helpers', () => {
  it('accepts only real calendar dates', () => {
    expect(calendarDate('2024-02-29')).toBe('2024-02-29');
    expect(calendarDate('2026-02-29')).toBeUndefined();
    expect(calendarDate('2026-2-01')).toBeUndefined();
    expect(calendarDate(20260201)).toBeUndefined();
  });

  it('formats a target date in UTC and names a missing one', () => {
    expect(formatRiskTargetDate('2026-12-01')).toBe('1 Dec 2026');
    expect(formatRiskTargetDate(null)).toBe('No target date');
  });
});

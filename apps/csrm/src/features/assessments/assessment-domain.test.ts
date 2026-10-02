import { describe, expect, it } from 'vitest';

import { exemptionReviewDateFormValue, exemptionReviewDateFromForm } from './assessment-domain';

/*
 * D-32 and UI-SPEC §13.3: the exemption review date is entered as a calendar date. The frozen schema stores it
 * as a datetime, so the form shows the stored instant's UTC date and saves the chosen date at 00:00 UTC.
 */
describe('the exemption review date as a calendar date (D-32)', () => {
  it('shows nothing when no date is stored', () => {
    expect(exemptionReviewDateFormValue(null)).toBe('');
    expect(exemptionReviewDateFormValue(undefined)).toBe('');
  });

  it('shows a stored midnight-UTC value as its date', () => {
    expect(exemptionReviewDateFormValue('2026-11-11T00:00:00.000Z')).toBe('2026-11-11');
  });

  it('shows a legacy value with another time as its UTC date', () => {
    expect(exemptionReviewDateFormValue('2026-10-15T13:45:00Z')).toBe('2026-10-15');
    // An offset value reads as the date it falls on in UTC, not the date written before the offset.
    expect(exemptionReviewDateFormValue('2026-10-16T08:00:00+10:00')).toBe('2026-10-15');
  });

  it('shows nothing for a stored value that is not a date', () => {
    expect(exemptionReviewDateFormValue('not a date')).toBe('');
  });

  it('saves a chosen date at 00:00 UTC', () => {
    expect(exemptionReviewDateFromForm('2026-11-11')).toBe('2026-11-11T00:00:00.000Z');
  });

  it('saves a cleared field as no date', () => {
    expect(exemptionReviewDateFromForm('')).toBeNull();
    expect(exemptionReviewDateFromForm(null)).toBeNull();
    expect(exemptionReviewDateFromForm(undefined)).toBeNull();
  });

  it('round-trips a chosen date unchanged', () => {
    expect(exemptionReviewDateFormValue(exemptionReviewDateFromForm('2027-02-28'))).toBe('2027-02-28');
  });
});

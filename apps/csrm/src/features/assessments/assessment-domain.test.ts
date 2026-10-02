import { describe, expect, it } from 'vitest';

import {
  assessmentDetailsFormValues,
  assessmentSaveWrites,
  assessmentWritableFields,
  changedWritableValues,
  exemptionReviewDateFormValue,
  exemptionReviewDateFromForm,
  normalizeAssessmentDetails,
} from './assessment-domain';
import { assessmentUpdateInputSchema } from './assessment-schema';

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

/*
 * D-33 and UI-SPEC §13.4: `No changes to save.` means the same on the Risk, mitigation control and assessment
 * details forms, and an unchanged Save assessment sends nothing unless the save records a review (D-13).
 */
describe('what a save has to write (D-33, UI-SPEC §13.4)', () => {
  const stored = {
    summary: 'Customer portal assessment.',
    overallRating: 'High' as const,
    overallControlEffectiveness: 'Partially Effective' as const,
    recommendationsSummary: null,
    overallRiskRationale: null,
    nextReviewDate: null,
  };

  it('lists only the fields whose value changed, in field order', () => {
    expect(changedWritableValues(['a', 'b', 'c'] as const, { a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: null })).toEqual({ b: 'x' });
    expect(changedWritableValues(['a', 'b'] as const, { a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({});
  });

  it('holds the assessment details writable fields to the update input schema', () => {
    expect([...assessmentWritableFields].sort()).toEqual(Object.keys(assessmentUpdateInputSchema.shape).sort());
  });

  it('reads blank choices and dates as the stored empty values', () => {
    expect(normalizeAssessmentDetails({ summary: '', overallRating: '' as never, overallControlEffectiveness: '' as never, nextReviewDate: '' }))
      .toEqual({ summary: '', overallRating: undefined, overallControlEffectiveness: undefined, recommendationsSummary: '', overallRiskRationale: '', nextReviewDate: null });
  });

  it('writes nothing for unchanged details of an in-review assessment', () => {
    const untouched = { ...assessmentDetailsFormValues(stored), overallRating: 'High' as const, recommendationsSummary: '', nextReviewDate: '' };
    expect(assessmentSaveWrites('in-review', untouched, stored)).toBe(false);
  });

  it('writes any changed detail of an in-review assessment', () => {
    expect(assessmentSaveWrites('in-review', { ...assessmentDetailsFormValues(stored), summary: 'Reviewed.' }, stored)).toBe(true);
    expect(assessmentSaveWrites('in-review', { ...assessmentDetailsFormValues(stored), nextReviewDate: '2027-01-31' }, stored)).toBe(true);
    expect(assessmentSaveWrites('in-review', { ...assessmentDetailsFormValues(stored), overallRating: '' as never }, stored)).toBe(true);
  });

  it('always writes a drafted assessment, because Strapi records the review on its save (D-13)', () => {
    expect(assessmentSaveWrites('draft', assessmentDetailsFormValues(stored), stored)).toBe(true);
  });
});

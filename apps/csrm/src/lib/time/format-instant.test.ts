import { describe, expect, it } from 'vitest';

import { formatInstant, isValidTimeZone } from './format-instant';

/* ICU may put a narrow no-break space before am or pm; compare with ordinary spaces. */
const normalised = (value: string | null) => value?.replace(/\s/g, ' ') ?? null;

const afternoonInBrisbane = '2026-09-27T05:47:00.000Z';
const nextDayInBrisbane = '2026-09-27T20:00:00.000Z';

describe('formatInstant', () => {
  it('shows a time of day in the viewer’s zone, with no zone label', () => {
    expect(normalised(formatInstant(afternoonInBrisbane, { zone: 'Australia/Brisbane', style: 'date-time' })))
      .toBe('27 Sept 2026, 3:47 pm');
  });

  it('labels a time of day UTC while the viewer’s zone is unknown', () => {
    expect(normalised(formatInstant(afternoonInBrisbane, { zone: null, style: 'date-time' })))
      .toBe('27 Sept 2026, 5:47 am UTC');
    expect(normalised(formatInstant(afternoonInBrisbane, { zone: null, style: 'time' }))).toBe('5:47 am UTC');
  });

  it('shows the time alone in the viewer’s zone', () => {
    expect(normalised(formatInstant(afternoonInBrisbane, { zone: 'Australia/Brisbane', style: 'time' }))).toBe('3:47 pm');
  });

  it('shows an instant as the local date, and never labels a date-only render', () => {
    expect(formatInstant(nextDayInBrisbane, { zone: 'Australia/Brisbane', style: 'date' })).toBe('28 Sept 2026');
    expect(formatInstant(nextDayInBrisbane, { zone: null, style: 'date' })).toBe('27 Sept 2026');
    expect(formatInstant(nextDayInBrisbane, { zone: null, style: 'date-long' })).toBe('27 September 2026');
  });

  it('returns null for a missing or unparseable value', () => {
    expect(formatInstant(null, { zone: 'Australia/Brisbane', style: 'date-time' })).toBeNull();
    expect(formatInstant(undefined, { zone: null, style: 'date' })).toBeNull();
    expect(formatInstant('', { zone: null, style: 'date' })).toBeNull();
    expect(formatInstant('not a date', { zone: null, style: 'date-time' })).toBeNull();
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones', () => {
    expect(isValidTimeZone('Australia/Brisbane')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('refuses an unknown zone, an empty or over-long string, and a non-string', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('A'.repeat(65))).toBe(false);
    expect(isValidTimeZone(10)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});

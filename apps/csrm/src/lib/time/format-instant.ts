/*
 * The viewer's time zone (D-19, design direction "Dates and times"). An instant is shown in the
 * viewer's zone; while that zone is unknown it is shown in UTC, and a render that shows a time of
 * day says so with a trailing " UTC". A render that shows only a date never gains a zone label.
 *
 * This module is pure and imports nothing, so server modules, Server Actions and client components
 * can all share it without pulling a validation library into the browser.
 */

/** The cookie that carries the viewer's IANA time zone, written by the shell's zone sync. */
export const VIEWER_TIME_ZONE_COOKIE = 'csrm-time-zone';

export type InstantStyle = 'date' | 'date-long' | 'date-time' | 'time';

const locale = 'en-AU';
const maximumTimeZoneLength = 64;

const styleOptions: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  'date-long': { dateStyle: 'long' },
  'date-time': { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  time: { hour: 'numeric', minute: '2-digit' },
};

const showsTimeOfDay = (style: InstantStyle) => style === 'date-time' || style === 'time';

/** True for a string of 1 to 64 characters that names a time zone the platform knows. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumTimeZoneLength) return false;
  try {
    new Intl.DateTimeFormat(locale, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats an instant in `zone`, or in UTC when the zone is null. Returns null for a missing or
 * unparseable value, so each surface chooses its own fallback.
 */
export function formatInstant(
  value: string | null | undefined,
  options: { zone: string | null; style: InstantStyle },
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const zone = options.zone !== null && isValidTimeZone(options.zone) ? options.zone : null;
  const text = new Intl.DateTimeFormat(locale, { ...styleOptions[options.style], timeZone: zone ?? 'UTC' }).format(date);
  return zone === null && showsTimeOfDay(options.style) ? `${text} UTC` : text;
}

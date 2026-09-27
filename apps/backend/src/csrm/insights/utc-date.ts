/*
 * UTC calendar dates for the analyst insights (D-02).
 *
 * A calendar date is a `YYYY-MM-DD` string that names one UTC day. Every insight
 * rule takes `today` in this form, so no rule reads the clock or the host time
 * zone and every rule is deterministic under test. Stored `date` columns hold
 * the same form, so they compare correctly as strings in code and in SQL.
 */

const DAY_MS = 86_400_000;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/*
 * An ISO 8601 date, or date-time with an optional zone designator. Anything
 * else is refused rather than handed to the engine's lenient fallback parser,
 * which reads free text in host local time.
 */
const ISO_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})(?:[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?)(Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)?)?$/i;

type CalendarParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];
}

function calendarParts(value: unknown): CalendarParts | null {
  if (typeof value !== "string") return null;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function requireCalendarDate(value: string, name: string): CalendarParts {
  const parts = calendarParts(value);
  if (!parts) throw new RangeError(`${name} must be a YYYY-MM-DD UTC calendar date.`);
  return parts;
}

function requireWholeNumber(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a whole number.`);
}

function formatParts({ year, month, day }: CalendarParts): string {
  if (!Number.isFinite(year) || year < 1 || year > 9999) {
    throw new RangeError("The date is outside the supported calendar range.");
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* `setUTCFullYear` keeps years below 100 literal, where `Date.UTC` would add 1900. */
function instantOf({ year, month, day }: CalendarParts): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

function formatInstant(instant: number): string {
  const date = new Date(instant);
  return formatParts({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

function validInstant(instant: number): Date | null {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* A stored instant written without a zone is UTC by convention, never host local time. */
function zoneDesignator(zone: string | undefined): string {
  if (zone === undefined || zone.toUpperCase() === "Z") return "Z";
  const digits = zone.slice(1).replace(":", "");
  return `${zone[0]}${digits.slice(0, 2)}:${digits.length > 2 ? digits.slice(2) : "00"}`;
}

/** The UTC calendar date of an instant. The caller passes the clock reading explicitly. */
export function utcToday(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new RangeError("now must be a valid Date.");
  return formatInstant(now.getTime());
}

/** True only for a real `YYYY-MM-DD` calendar date from year 1 to 9999. */
export function isUtcDate(value: unknown): value is string {
  return calendarParts(value) !== null;
}

export function addUtcDays(date: string, days: number): string {
  const parts = requireCalendarDate(date, "date");
  requireWholeNumber(days, "days");
  return formatInstant(instantOf(parts) + days * DAY_MS);
}

/** Whole UTC days from `from` to `to`: negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = instantOf(requireCalendarDate(from, "from"));
  const end = instantOf(requireCalendarDate(to, "to"));
  return Math.round((end - start) / DAY_MS);
}

export function startOfUtcMonth(date: string): string {
  const { year, month } = requireCalendarDate(date, "date");
  return formatParts({ year, month, day: 1 });
}

/** Adds whole calendar months. A day the target month lacks clamps to its last day. */
export function addUtcMonths(date: string, months: number): string {
  const { year, month, day } = requireCalendarDate(date, "date");
  requireWholeNumber(months, "months");
  const monthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  if (targetYear < 1 || targetYear > 9999) throw new RangeError("The date is outside the supported calendar range.");
  return formatParts({ year: targetYear, month: targetMonth, day: Math.min(day, daysInMonth(targetYear, targetMonth)) });
}

/** The instant at UTC midnight that starts a calendar date, for binding datetime columns. */
export function utcDateToInstant(date: string): Date {
  return new Date(instantOf(requireCalendarDate(date, "date")));
}

/**
 * Reads a stored datetime into one form. Drivers return datetimes differently:
 * SQLite raw reads give epoch milliseconds, PostgreSQL gives a `Date`, and the
 * Document Service gives an ISO string. Anything that is not a valid instant is
 * null.
 */
export function normalizeDateTime(value: unknown): Date | null {
  if (value instanceof Date) return validInstant(value.getTime());
  if (typeof value === "number") return validInstant(value);
  if (typeof value !== "string") return null;
  const match = ISO_DATE_TIME.exec(value.trim());
  if (!match || !isUtcDate(match[1])) return null;
  const [, date, time, zone] = match as unknown as [string, string, string | undefined, string | undefined];
  if (time === undefined) return validInstant(Date.parse(date));
  return validInstant(Date.parse(`${date}T${time}${zoneDesignator(zone)}`));
}

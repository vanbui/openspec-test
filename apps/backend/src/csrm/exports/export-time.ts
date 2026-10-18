import { ExportQueryError } from "./export-errors";

/*
 * The viewer's time zone in an export (19-04; D-07, D-16; 19-UI-SPEC §3.1, §3.3). The web passes the zone from Phase
 * 10's csrm-time-zone cookie. An absent zone falls back to UTC, and the file says so; a zone the platform does not
 * know, or one longer than 64 characters, is refused as an invalid query (400).
 */

export const EXPORT_TIME_ZONE_MAX = 64;

export type ExportTimeZone = { readonly zone: string; readonly fallback: boolean };

const UTC_FALLBACK: ExportTimeZone = Object.freeze({ zone: "UTC", fallback: true });

/** The UTC fallback sentence the About sheet's Exported row ends with (19-UI-SPEC §3.3). */
export const EXPORT_UTC_FALLBACK_NOTE = "(UTC, because your time zone wasn’t known; dates in this file use UTC)";

/** The zone, canonicalised, or the UTC fallback when absent; anything else is an ExportQueryError. */
export function parseExportTimeZone(value: unknown): ExportTimeZone {
  if (value === undefined) return UTC_FALLBACK;
  if (typeof value !== "string" || value.length === 0 || value.length > EXPORT_TIME_ZONE_MAX) throw new ExportQueryError();
  try {
    return { zone: new Intl.DateTimeFormat("en-AU", { timeZone: value }).resolvedOptions().timeZone, fallback: false };
  } catch {
    throw new ExportQueryError();
  }
}

/**
 * An instant's calendar date in `zone`: its `YYYY-MM-DD` text for a CSV, and that date's UTC midnight for a workbook
 * date cell, which the writer serialises from its UTC time (19-RESEARCH Pitfall 5).
 */
export function localCalendarDate(instant: Date, zone: string): { iso: string; utcMidnight: Date } {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) throw new RangeError("an instant must be a valid Date");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)?.value ?? "";
  const iso = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  const utcMidnight = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(utcMidnight.getTime())) throw new RangeError("the instant has no calendar date in this zone");
  return { iso, utcMidnight };
}

/**
 * The About sheet's Exported value: the date and time in en-AU per X-3 with the zone in brackets, or, when the zone
 * was not known, the UTC time with the fallback sentence.
 */
export function formatExportedAt(now: Date, zone: string, fallback: boolean): string {
  const text = new Intl.DateTimeFormat("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: fallback ? "UTC" : zone,
  }).format(now);
  return fallback ? `${text} ${EXPORT_UTC_FALLBACK_NOTE}` : `${text} (${zone})`;
}

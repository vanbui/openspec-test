/*
 * D-04: the treatment due state. This is the single definition.
 *
 * It decides when a Risk treatment is overdue or due soon. The Risk Register
 * projection, the alerts, the treatment-performance report and the analyst
 * dashboard all cite it, so they cannot disagree.
 *
 * The stored `treatmentStatus = "Overdue"` value is never read as a due state.
 * Nothing on the server sets it, so the due state always comes from dates.
 */
import { ALERT_DUE_SOON_WINDOW_DAYS } from "./insight-constants";
import { addUtcDays, isUtcDate } from "./utc-date";

export const TREATMENT_DUE_STATES = Object.freeze([
  "overdue",
  "due-soon",
  "later",
  "no-target-date",
  "complete-or-closed",
] as const);
export type TreatmentDueState = typeof TREATMENT_DUE_STATES[number];

/** The treatment facts of one Risk. Every key is required, so no caller can omit a fact by accident. */
export type TreatmentFacts = {
  targetDate: string | null | undefined;
  treatmentStatus: string | null | undefined;
  closureDate: string | null | undefined;
};

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * A treatment is open while its Risk has no closure date and the treatment is
 * not Complete. A NULL treatment status is not Complete (D-31): no treatment is
 * recorded, so none is finished.
 */
export function isTreatmentOpen(facts: Pick<TreatmentFacts, "treatmentStatus" | "closureDate">): boolean {
  return !isPresent(facts.closureDate) && facts.treatmentStatus !== "Complete";
}

/**
 * The due state of a treatment on `today`, a `YYYY-MM-DD` UTC date. The first
 * matching rule wins:
 * 1. complete-or-closed: the treatment is not open;
 * 2. no-target-date: the Risk has no target date;
 * 3. overdue: the target date is before today;
 * 4. due-soon: the target date is on or before today plus `windowDays`, inclusive at both ends;
 * 5. later.
 *
 * Dates compare as `YYYY-MM-DD` strings, exactly as the stored date columns compare in SQL.
 */
export function deriveTreatmentDueState(
  facts: TreatmentFacts,
  today: string,
  windowDays: number = ALERT_DUE_SOON_WINDOW_DAYS,
): TreatmentDueState {
  if (!isUtcDate(today)) throw new RangeError("today must be a YYYY-MM-DD UTC calendar date.");
  if (!Number.isSafeInteger(windowDays) || windowDays < 0) {
    throw new RangeError("windowDays must be a whole number of days, zero or more.");
  }
  if (!isTreatmentOpen(facts)) return "complete-or-closed";
  const { targetDate } = facts;
  if (!isPresent(targetDate)) return "no-target-date";
  if (targetDate < today) return "overdue";
  if (targetDate <= addUtcDays(today, windowDays)) return "due-soon";
  return "later";
}

/*
 * D-04: the treatment due state. This is the single definition.
 *
 * It decides when a Risk treatment is overdue or due soon. The Risk Register
 * projection and its dueState filter, the alerts, the treatment-performance
 * report and the analyst dashboard all cite it, so they cannot disagree.
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

/** The column of the governing date, on the outer query that aliases csrm_risks as `r`. */
export const TREATMENT_DUE_DATE_COLUMN = "r.target_date";

function assertRuleInputs(today: string, windowDays: number): void {
  if (!isUtcDate(today)) throw new RangeError("today must be a YYYY-MM-DD UTC calendar date.");
  if (!Number.isSafeInteger(windowDays) || windowDays < 0) {
    throw new RangeError("windowDays must be a whole number of days, zero or more.");
  }
}

/*
 * G-16 seam. Phase 20 (G-16) switches this rule's governing date from targetDate to treatmentResolveDate
 * (falling back to targetDate for a treated Risk without one). Every due or overdue figure reads it here:
 * deriveTreatmentDueState for one Risk, applyTreatmentDueStatePredicate for a list or a count.
 */

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
 * applyTreatmentDueStatePredicate below is this rule in SQL. Phase 20 (G-16) switches this rule's
 * governing date from targetDate to treatmentResolveDate, here and in that predicate together.
 */
export function deriveTreatmentDueState(
  facts: TreatmentFacts,
  today: string,
  windowDays: number = ALERT_DUE_SOON_WINDOW_DAYS,
): TreatmentDueState {
  assertRuleInputs(today, windowDays);
  if (!isTreatmentOpen(facts)) return "complete-or-closed";
  const { targetDate } = facts;
  if (!isPresent(targetDate)) return "no-target-date";
  if (targetDate < today) return "overdue";
  if (targetDate <= addUtcDays(today, windowDays)) return "due-soon";
  return "later";
}

/** The one method the predicate calls. Both knex's builder and the Risk Register's QueryBuilder satisfy it. */
export type TreatmentDueStateQuery = {
  whereRaw(sql: string, bindings?: unknown[]): unknown;
};

/* The open condition of isTreatmentOpen, in SQL. A NULL status records no treatment, so it is not Complete (D-31). */
const OPEN_TREATMENT = "(r.closure_date IS NULL AND (r.treatment_status IS NULL OR r.treatment_status <> ?))";
const CLOSED_TREATMENT = "(r.closure_date IS NOT NULL OR r.treatment_status = ?)";

/**
 * deriveTreatmentDueState in SQL, for a list or a count: narrows `query` (which aliases csrm_risks as `r`) to
 * the Risks whose treatment is in `state` on `today`. Each branch matches one rule of deriveTreatmentDueState,
 * in its order: complete-or-closed is the treatment that is not open; every other state starts from the open
 * condition, then reads the governing date (TREATMENT_DUE_DATE_COLUMN). `today` and the window end bind as
 * `YYYY-MM-DD` strings and compare with the stored date column exactly as the rule compares them.
 *
 * Phase 20 (G-16) switches this rule's governing date from targetDate to treatmentResolveDate, here and in
 * deriveTreatmentDueState together. Every SQL fragment is a constant chosen from the closed state, and every
 * value is a bound parameter.
 */
export function applyTreatmentDueStatePredicate<T extends TreatmentDueStateQuery>(
  query: T,
  state: TreatmentDueState,
  options: { today: string; windowDays?: number },
): T {
  const { today, windowDays = ALERT_DUE_SOON_WINDOW_DAYS } = options;
  assertRuleInputs(today, windowDays);
  if (!TREATMENT_DUE_STATES.includes(state)) throw new RangeError("state must be a treatment due state.");
  if (state === "complete-or-closed") {
    query.whereRaw(CLOSED_TREATMENT, ["Complete"]);
    return query;
  }
  query.whereRaw(OPEN_TREATMENT, ["Complete"]);
  const date = TREATMENT_DUE_DATE_COLUMN;
  const windowEnd = addUtcDays(today, windowDays);
  if (state === "no-target-date") query.whereRaw(`${date} IS NULL`);
  else if (state === "overdue") query.whereRaw(`${date} < ?`, [today]);
  else if (state === "due-soon") query.whereRaw(`(${date} >= ? AND ${date} <= ?)`, [today, windowEnd]);
  else query.whereRaw(`${date} > ?`, [windowEnd]);
  return query;
}

/*
 * Closed report partitions, UTC month buckets and the median (D-13).
 *
 * Database aggregates arrive as grouped rows. These functions fold them into
 * closed shapes and reject no category value:
 * - an unknown rating counts as notRated;
 * - an unknown or missing status counts as notProvided;
 * - a request status outside the review scope, such as a draft, is ignored.
 * Every partition's parts sum to its total.
 *
 * PostgreSQL returns COUNT and SUM as strings, so each total is read through
 * Number() and must be a whole count.
 */
import { addUtcMonths, startOfUtcMonth, utcDateToInstant } from "./utc-date";

const DAY_MS = 86_400_000;

const RISK_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;
export type RiskRating = typeof RISK_RATINGS[number];
const RISK_RATING_SET: ReadonlySet<string> = new Set(RISK_RATINGS);

export type RatingCountRow = { rating: unknown; total: unknown };
export type StatusCountRow = { status: unknown; total: unknown };

export type RatingCounts = { Critical: number; High: number; Moderate: number; Low: number; notRated: number; total: number };
export type TreatmentStatusCounts = {
  notStarted: number;
  inProgress: number;
  overdue: number;
  complete: number;
  notProvided: number;
  total: number;
};
export type ControlStatusCounts = {
  existing: number;
  planned: number;
  implemented: number;
  retired: number;
  notProvided: number;
  total: number;
};
export type EffectivenessCounts = {
  effective: number;
  partiallyEffective: number;
  ineffective: number;
  notAssessed: number;
  notProvided: number;
  total: number;
};
export type RequestStatusCounts = {
  submitted: number;
  questionnaireInProgress: number;
  riskAssessmentDrafted: number;
  underReview: number;
  approved: number;
  closed: number;
  total: number;
};

/** D-04 over the treatment-performance window: open, not-Complete treatments by due state. */
export type TreatmentDueStateCounts = {
  overdue: number;
  dueWithinWindow: number;
  later: number;
  noTargetDate: number;
  total: number;
};
/** One aggregate row as the database returns it: a SUM(CASE ...) per part and a COUNT for the total. */
export type TreatmentDueStateRow = Record<keyof TreatmentDueStateCounts, unknown>;

/** One calendar month of a throughput period, with the instants that bound it for datetime bindings. */
export type ThroughputMonth = { monthStart: string; start: Date; end: Date; partial: boolean };
/** A throughput month as a report serves it. */
export type ThroughputMonthCount = { monthStart: string; count: number; partial: boolean };
export type ThroughputReleased = { months: ThroughputMonthCount[]; total: number };

/** One elapsed interval, already read through `normalizeDateTime`: from submission to release. */
export type ElapsedPair = { from: Date | null; to: Date | null };
export type MedianDays = { value: number | null; sampleSize: number; truncated: boolean };

/* Maps, not object literals, so a value such as "constructor" can never match a key. */
const TREATMENT_STATUS_KEYS = new Map<string, Exclude<keyof TreatmentStatusCounts, "notProvided" | "total">>([
  ["Not Started", "notStarted"],
  ["In Progress", "inProgress"],
  ["Overdue", "overdue"],
  ["Complete", "complete"],
]);
const CONTROL_STATUS_KEYS = new Map<string, Exclude<keyof ControlStatusCounts, "notProvided" | "total">>([
  ["Existing", "existing"],
  ["Planned", "planned"],
  ["Implemented", "implemented"],
  ["Retired", "retired"],
]);
const EFFECTIVENESS_KEYS = new Map<string, Exclude<keyof EffectivenessCounts, "notProvided" | "total">>([
  ["Effective", "effective"],
  ["Partially Effective", "partiallyEffective"],
  ["Ineffective", "ineffective"],
  ["Not Assessed", "notAssessed"],
]);
/* The six review-scope statuses. A draft belongs to its Requestor and is never counted. */
const REQUEST_STATUS_KEYS = new Map<string, Exclude<keyof RequestStatusCounts, "total">>([
  ["submitted", "submitted"],
  ["questionnaire-in-progress", "questionnaireInProgress"],
  ["risk-assessment-drafted", "riskAssessmentDrafted"],
  ["under-review", "underReview"],
  ["approved", "approved"],
  ["closed", "closed"],
]);

function wholeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value
    : typeof value === "bigint" ? Number(value)
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new RangeError("A report total must be a whole count.");
  return parsed;
}

/* SQL's SUM over no rows is NULL, not 0, so a NULL sum reads as zero. A COUNT is never NULL. */
function sumCount(value: unknown): number {
  return value === null ? 0 : wholeCount(value);
}

function keyOf<K>(keys: ReadonlyMap<string, K>, value: unknown): K | undefined {
  return typeof value === "string" ? keys.get(value) : undefined;
}

/* Folds grouped rows into a closed partition. A row whose key is undefined is out of scope and ignored. */
function fold<K extends string, R extends { total: unknown }>(
  keys: readonly K[],
  rows: readonly R[],
  classify: (row: R) => K | undefined,
): Record<K, number> & { total: number } {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  let total = 0;
  for (const row of rows) {
    const key = classify(row);
    if (key === undefined) continue;
    const value = wholeCount(row.total);
    counts[key] += value;
    total += value;
  }
  return { ...counts, total };
}

/** A Risk rating on the closed ladder, matched exactly, or null. */
export function normaliseRating(value: unknown): RiskRating | null {
  return typeof value === "string" && RISK_RATING_SET.has(value) ? value as RiskRating : null;
}

export function ratingCounts(rows: readonly RatingCountRow[]): RatingCounts {
  return fold(["Critical", "High", "Moderate", "Low", "notRated"] as const, rows, (row) => normaliseRating(row.rating) ?? "notRated");
}

export function treatmentStatusCounts(rows: readonly StatusCountRow[]): TreatmentStatusCounts {
  return fold(
    ["notStarted", "inProgress", "overdue", "complete", "notProvided"] as const,
    rows,
    (row) => keyOf(TREATMENT_STATUS_KEYS, row.status) ?? "notProvided",
  );
}

export function controlStatusCounts(rows: readonly StatusCountRow[]): ControlStatusCounts {
  return fold(
    ["existing", "planned", "implemented", "retired", "notProvided"] as const,
    rows,
    (row) => keyOf(CONTROL_STATUS_KEYS, row.status) ?? "notProvided",
  );
}

export function effectivenessCounts(rows: readonly RatingCountRow[]): EffectivenessCounts {
  return fold(
    ["effective", "partiallyEffective", "ineffective", "notAssessed", "notProvided"] as const,
    rows,
    (row) => keyOf(EFFECTIVENESS_KEYS, row.rating) ?? "notProvided",
  );
}

export function requestStatusCounts(rows: readonly StatusCountRow[]): RequestStatusCounts {
  return fold(
    ["submitted", "questionnaireInProgress", "riskAssessmentDrafted", "underReview", "approved", "closed"] as const,
    rows,
    (row) => keyOf(REQUEST_STATUS_KEYS, row.status),
  );
}

/**
 * The due-state partition of open, not-Complete treatments from one aggregate
 * row. Each part is a SUM(CASE ...) and the total a COUNT over the same rows,
 * so the parts must add up to the total: a treatment counted twice or not at
 * all is an invariant failure, not a figure to serve.
 */
export function treatmentDueStateCounts(row: TreatmentDueStateRow): TreatmentDueStateCounts {
  const counts = {
    overdue: sumCount(row.overdue),
    dueWithinWindow: sumCount(row.dueWithinWindow),
    later: sumCount(row.later),
    noTargetDate: sumCount(row.noTargetDate),
    total: wholeCount(row.total),
  };
  if (counts.overdue + counts.dueWithinWindow + counts.later + counts.noTargetDate !== counts.total) {
    throw new RangeError("The treatment due-state parts must add up to their total.");
  }
  return counts;
}

/**
 * The releases of each throughput month, oldest first, from one SUM(CASE ...)
 * per month in the same order, with the period total. A month with no release
 * is still served, with a count of zero: zero months are data.
 */
export function throughputReleased(months: readonly ThroughputMonth[], counts: readonly unknown[]): ThroughputReleased {
  if (counts.length !== months.length) throw new RangeError("Each throughput month needs exactly one count.");
  const served = months.map(({ monthStart, partial }, index) => ({ monthStart, count: sumCount(counts[index]), partial }));
  return { months: served, total: served.reduce((sum, month) => sum + month.count, 0) };
}

/**
 * The `period` calendar months ending with the current one, oldest first. The
 * current month is still in progress, so it alone is partial. Each month is
 * bounded by the UTC midnights that start it and the next month.
 */
export function throughputMonths(today: string, period: number): ThroughputMonth[] {
  if (!Number.isSafeInteger(period) || period < 1) throw new RangeError("period must be a whole number of months, one or more.");
  const currentMonth = startOfUtcMonth(today);
  return Array.from({ length: period }, (_, index) => {
    const monthStart = addUtcMonths(currentMonth, index - (period - 1));
    return {
      monthStart,
      start: utcDateToInstant(monthStart),
      end: utcDateToInstant(addUtcMonths(monthStart, 1)),
      partial: index === period - 1,
    };
  });
}

function isValidDate(value: Date | null): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * The median elapsed days over at most `cap` pairs, rounded to one decimal.
 * Pairs arrive newest first; when there are more than `cap`, only the first
 * `cap` are used and the result says it is truncated. A pair with a missing
 * date or a negative gap is dropped from the sample.
 */
export function medianDays(pairs: readonly ElapsedPair[], cap: number): MedianDays {
  if (!Number.isSafeInteger(cap) || cap < 1) throw new RangeError("cap must be a whole number, one or more.");
  const truncated = pairs.length > cap;
  const days = pairs.slice(0, cap)
    .flatMap(({ from, to }) => {
      if (!isValidDate(from) || !isValidDate(to)) return [];
      const elapsed = (to.getTime() - from.getTime()) / DAY_MS;
      return elapsed >= 0 ? [elapsed] : [];
    })
    .sort((left, right) => left - right);
  if (days.length === 0) return { value: null, sampleSize: 0, truncated };
  const middle = Math.floor(days.length / 2);
  const median = days.length % 2 === 1 ? days[middle] : (days[middle - 1] + days[middle]) / 2;
  return { value: Math.round(median * 10) / 10, sampleSize: days.length, truncated };
}

/*
 * Named thresholds and caps for the analyst dashboard, alerts and reports (D-03).
 *
 * Every window and every limit a Phase 7 handler applies is one of these
 * constants. A capped list can therefore say it is truncated instead of
 * presenting a partial count as a total.
 */

/** D-04, D-10: a treatment, request or review date from today to this many days ahead is due soon. */
export const ALERT_DUE_SOON_WINDOW_DAYS = 14;

/** D-13: the treatment-performance report counts treatments due within this many days. */
export const TREATMENT_REPORT_DUE_WINDOW_DAYS = 30;

/** D-12: the alert list page sizes, and the default. */
export const ALERT_PAGE_SIZES = Object.freeze([5, 10, 25, 50] as const);
export const ALERT_DEFAULT_PAGE_SIZE: typeof ALERT_PAGE_SIZES[number] = 25;

/** The rows each bounded dashboard widget lists. */
export const DASHBOARD_WIDGET_ROW_LIMIT = 5;

/** The dashboard's recent activity items. */
export const RECENT_ACTIVITY_LIMIT = 8;

/** D-13 risk-exposure: the Information Systems listed by High and Critical residual Risks. */
export const EXPOSED_SYSTEMS_LIMIT = 10;

/** D-13 treatment-performance: the most overdue Risks listed. */
export const MOST_OVERDUE_TREATMENTS_LIMIT = 5;

/** D-13 assessment-throughput: the closed period choice in months, and the default. */
export const THROUGHPUT_PERIODS = Object.freeze([6, 12] as const);
export const THROUGHPUT_DEFAULT_PERIOD: typeof THROUGHPUT_PERIODS[number] = 6;

/** The submission-to-release pairs read for the median. A larger sample is flagged as truncated. */
export const THROUGHPUT_SAMPLE_CAP = 5_000;

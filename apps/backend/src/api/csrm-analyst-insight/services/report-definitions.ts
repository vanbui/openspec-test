/*
 * The closed set of analyst reports (D-13).
 *
 * GET /api/v1/reports lists these definitions in this order, so the Reports
 * index is data-driven. The web's report-copy.json is the canonical copy
 * (UI-D19): these strings restate it, and the mounted report test asserts that
 * the served key, title and description of every report equal that map.
 */

export const REPORT_KEYS = Object.freeze([
  "risk-exposure",
  "treatment-performance",
  "assessment-throughput",
  "control-effectiveness",
] as const);
export type ReportKey = typeof REPORT_KEYS[number];

export type ReportDefinition = Readonly<{ key: ReportKey; title: string; description: string }>;

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = Object.freeze([
  Object.freeze({
    key: "risk-exposure",
    title: "Risk exposure",
    description: "Open contextual Risks by rating and treatment status, and the Information Systems carrying the most High and Critical residual Risks.",
  }),
  Object.freeze({
    key: "treatment-performance",
    title: "Treatment performance",
    description: "Risk treatments by due state and treatment status, and the most overdue treatments.",
  }),
  Object.freeze({
    key: "assessment-throughput",
    title: "Assessment throughput",
    description: "Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.",
  }),
  Object.freeze({
    key: "control-effectiveness",
    title: "Control effectiveness",
    description: "Control Implementations on open contextual Risks by implementation status and effectiveness rating.",
  }),
] as const);

const REPORT_KEY_SET: ReadonlySet<string> = new Set(REPORT_KEYS);

/** True only for one of the closed report keys, matched exactly. */
export function isReportKey(value: unknown): value is ReportKey {
  return typeof value === "string" && REPORT_KEY_SET.has(value);
}

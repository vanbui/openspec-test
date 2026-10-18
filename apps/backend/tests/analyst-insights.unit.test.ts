import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  addUtcDays,
  addUtcMonths,
  daysBetween,
  isUtcDate,
  normalizeDateTime,
  startOfUtcMonth,
  utcDateToInstant,
  utcToday,
} from "../src/csrm/insights/utc-date";
import {
  ALERT_DEFAULT_PAGE_SIZE,
  ALERT_DUE_SOON_WINDOW_DAYS,
  ALERT_PAGE_SIZES,
  DASHBOARD_WIDGET_ROW_LIMIT,
  EXPOSED_SYSTEMS_LIMIT,
  MOST_OVERDUE_TREATMENTS_LIMIT,
  RECENT_ACTIVITY_LIMIT,
  THROUGHPUT_DEFAULT_PERIOD,
  THROUGHPUT_PERIODS,
  THROUGHPUT_SAMPLE_CAP,
  TREATMENT_REPORT_DUE_WINDOW_DAYS,
} from "../src/csrm/insights/insight-constants";
import {
  TREATMENT_DUE_STATES,
  deriveTreatmentDueState,
  isTreatmentOpen,
} from "../src/csrm/insights/treatment-due-state";
import * as treatmentDueStateModule from "../src/csrm/insights/treatment-due-state";
import {
  ALERT_KINDS,
  ALERT_URGENCIES,
  ALERT_URGENCY_RANK,
  REQUEST_ALERT_STATUSES,
  alertDayOffset,
  alertId,
  alertUrgency,
  classifyAssessmentAlerts,
  classifyControlImplementationAlerts,
  classifyRequestAlerts,
  classifyRiskAlerts,
  compareAlerts,
} from "../src/csrm/insights/alert-rules";
import type { AlertKind, AlertOrderKey } from "../src/csrm/insights/alert-rules";
import {
  controlStatusCounts,
  effectivenessCounts,
  medianDays,
  normaliseRating,
  ratingCounts,
  requestStatusCounts,
  throughputMonths,
  throughputReleased,
  treatmentDueStateCounts,
  treatmentStatusCounts,
} from "../src/csrm/insights/report-math";
import { ACTIVITY_KINDS, mergeRecentActivity } from "../src/csrm/insights/recent-activity";
import type { ActivityItem } from "../src/csrm/insights/recent-activity";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const appDir = path.resolve(__dirname, "..", "..", "..");

/** Vocabularies are read from the frozen datamodel, never restated. */
function frozenEnum(api: string, attribute: string): string[] {
  const schema = JSON.parse(readFileSync(
    path.join(appDir, "src", "api", api, "content-types", api, "schema.json"),
    "utf8",
  )) as { attributes: Record<string, { enum?: string[] } | undefined> };
  const values = schema.attributes[attribute]?.enum;
  assert.ok(Array.isArray(values), `${api}.${attribute} is an enumeration`);
  return values;
}

const requestStatuses = frozenEnum("csrm-assessment-request", "requestStatus");
const treatmentStatuses = frozenEnum("csrm-risk", "treatmentStatus");
const controlStatuses = frozenEnum("csrm-control-implementation", "controlStatus");
const effectivenessRatings = frozenEnum("csrm-control-implementation", "effectivenessRating");

/** Every rule under test takes this explicit UTC calendar date. */
const TODAY = "2026-09-24";
const DAY_MS = 86_400_000;

/** Asserts that the named parts of a closed partition add up to its total. */
function assertPartitionSums(partition: Record<string, number>): void {
  const parts = Object.entries(partition).filter(([key]) => key !== "total");
  assert.equal(parts.reduce((sum, [, value]) => sum + value, 0), partition.total);
}

/* ------------------------------------------------------------------ utc-date */

test("utcToday reads the UTC calendar date of the instant it is given", () => {
  assert.equal(utcToday(new Date("2026-09-24T23:59:59.999Z")), "2026-09-24");
  assert.equal(utcToday(new Date("2026-09-25T00:00:00.000Z")), "2026-09-25");
  assert.throws(() => utcToday(new Date(Number.NaN)), RangeError);
});

test("UTC calendar arithmetic crosses month, year and leap-day boundaries", () => {
  assert.equal(addUtcDays("2026-09-24", 14), "2026-10-08");
  assert.equal(addUtcDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addUtcDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addUtcDays("2026-09-24", -1), "2026-09-23");

  assert.equal(daysBetween("2026-09-24", "2026-09-12"), -12);
  assert.equal(daysBetween("2026-09-24", "2026-10-08"), 14);

  assert.equal(startOfUtcMonth("2026-09-24"), "2026-09-01");
  assert.equal(addUtcMonths("2026-09-01", -5), "2026-04-01");
  assert.equal(addUtcMonths("2026-01-01", -1), "2025-12-01");
  // A day of month that the target month lacks clamps to its last day.
  assert.equal(addUtcMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addUtcMonths("2028-01-31", 1), "2028-02-29");

  assert.equal(utcDateToInstant("2026-09-24").toISOString(), "2026-09-24T00:00:00.000Z");
});

test("only a real YYYY-MM-DD calendar date is a UTC date", () => {
  assert.equal(isUtcDate("2026-02-29"), false);
  assert.equal(isUtcDate("2026-9-1"), false);
  assert.equal(isUtcDate("2028-02-29"), true);
  assert.equal(isUtcDate("2026-09-24"), true);
  assert.equal(isUtcDate("2026-09-24T00:00:00.000Z"), false);
  assert.equal(isUtcDate("0000-01-01"), false);
  assert.equal(isUtcDate(""), false);
  assert.equal(isUtcDate(null), false);
  assert.equal(isUtcDate(20260924), false);
});

test("calendar arithmetic refuses anything that is not a calendar date or a whole number", () => {
  assert.throws(() => addUtcDays("2026-9-1", 1), RangeError);
  assert.throws(() => addUtcDays("2026-02-29", 1), RangeError);
  assert.throws(() => addUtcDays("2026-09-24", 0.5), RangeError);
  assert.throws(() => daysBetween("2026-09-24", "2026-09-24T00:00:00.000Z"), RangeError);
  assert.throws(() => startOfUtcMonth("24/09/2026"), RangeError);
  assert.throws(() => addUtcMonths("2026-09-01", 1.5), RangeError);
  assert.throws(() => utcDateToInstant("2026-13-01"), RangeError);
});

test("normalizeDateTime turns epoch milliseconds, Dates and ISO strings into one Date form", () => {
  assert.equal(normalizeDateTime(1788018028452)?.toISOString(), "2026-08-29T15:40:28.452Z");
  const instant = new Date("2026-09-24T10:15:00.000Z");
  const fromDate = normalizeDateTime(instant);
  assert.ok(fromDate instanceof Date);
  assert.equal(fromDate.toISOString(), "2026-09-24T10:15:00.000Z");
  assert.equal(normalizeDateTime("2026-09-24T10:15:00.000Z")?.toISOString(), "2026-09-24T10:15:00.000Z");
  assert.equal(normalizeDateTime("2026-09-24T20:15:00+10:00")?.toISOString(), "2026-09-24T10:15:00.000Z");
  // A date-time without a zone designator is a UTC instant, never host local time.
  assert.equal(normalizeDateTime("2026-09-24 10:15:00")?.toISOString(), "2026-09-24T10:15:00.000Z");

  assert.equal(normalizeDateTime("not a date"), null);
  assert.equal(normalizeDateTime("Sep 24 2026"), null);
  assert.equal(normalizeDateTime("2026-02-30T00:00:00.000Z"), null);
  assert.equal(normalizeDateTime(Number.NaN), null);
  assert.equal(normalizeDateTime(new Date(Number.NaN)), null);
  assert.equal(normalizeDateTime(null), null);
  assert.equal(normalizeDateTime(undefined), null);
});

/* ------------------------------------------------------- insight-constants */

test("the insight thresholds and caps are named constants with pinned values", () => {
  assert.equal(ALERT_DUE_SOON_WINDOW_DAYS, 14);
  // D-38: "due soon" has one meaning, so the treatment report's window is the alerts' (reversing Phase 7 D-13's 30).
  assert.equal(TREATMENT_REPORT_DUE_WINDOW_DAYS, 14);
  assert.equal(TREATMENT_REPORT_DUE_WINDOW_DAYS, ALERT_DUE_SOON_WINDOW_DAYS);
  assert.deepEqual(ALERT_PAGE_SIZES, [5, 10, 25, 50]);
  assert.equal(ALERT_DEFAULT_PAGE_SIZE, 25);
  assert.ok((ALERT_PAGE_SIZES as readonly number[]).includes(ALERT_DEFAULT_PAGE_SIZE));
  assert.equal(DASHBOARD_WIDGET_ROW_LIMIT, 5);
  assert.equal(RECENT_ACTIVITY_LIMIT, 8);
  assert.equal(EXPOSED_SYSTEMS_LIMIT, 10);
  assert.equal(MOST_OVERDUE_TREATMENTS_LIMIT, 5);
  assert.deepEqual(THROUGHPUT_PERIODS, [6, 12]);
  assert.equal(THROUGHPUT_DEFAULT_PERIOD, 6);
  assert.ok((THROUGHPUT_PERIODS as readonly number[]).includes(THROUGHPUT_DEFAULT_PERIOD));
  assert.equal(THROUGHPUT_SAMPLE_CAP, 5000);
});

/* ----------------------------------------------------- treatment-due-state */

function treatment(overrides: {
  targetDate?: string | null;
  treatmentStatus?: string | null;
  closureDate?: string | null;
} = {}) {
  return { targetDate: null, treatmentStatus: "In Progress", closureDate: null, ...overrides };
}

test("the treatment due-state vocabulary is closed", () => {
  assert.deepEqual(TREATMENT_DUE_STATES, ["overdue", "due-soon", "later", "no-target-date", "complete-or-closed"]);
});

test("the treatment due state follows the D-04 window with both ends inclusive", () => {
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-09-23" }), TODAY), "overdue");
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-09-24" }), TODAY), "due-soon");
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-10-08" }), TODAY), "due-soon");
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-10-09" }), TODAY), "later");
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: null }), TODAY), "no-target-date");

  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-10-24" }), TODAY, 30), "due-soon");
  assert.equal(deriveTreatmentDueState(treatment({ targetDate: "2026-10-25" }), TODAY, 30), "later");
});

test("a complete or closed treatment is never due, and a NULL status is not Complete", () => {
  assert.equal(deriveTreatmentDueState(treatment({ treatmentStatus: "Complete", targetDate: "2026-09-01" }), TODAY), "complete-or-closed");
  assert.equal(
    deriveTreatmentDueState(treatment({ closureDate: "2026-09-20", treatmentStatus: "In Progress", targetDate: "2026-09-01" }), TODAY),
    "complete-or-closed",
  );
  // D-31: a Risk with no recorded treatment status is still open.
  assert.equal(deriveTreatmentDueState(treatment({ treatmentStatus: null, targetDate: "2026-09-23" }), TODAY), "overdue");
  // D-04: the stored "Overdue" status is never read as a due state.
  assert.equal(deriveTreatmentDueState(treatment({ treatmentStatus: "Overdue", targetDate: "2026-12-01" }), TODAY), "later");
  // An empty closure date is not a closure.
  assert.equal(deriveTreatmentDueState(treatment({ closureDate: "", targetDate: "2026-09-23" }), TODAY), "overdue");
  assert.equal(isTreatmentOpen(treatment({ closureDate: "" })), true);
});

test("every stored treatment status except Complete leaves the treatment open", () => {
  assert.deepEqual(treatmentStatuses, ["Not Started", "In Progress", "Overdue", "Complete"]);
  assert.deepEqual(
    treatmentStatuses.filter((treatmentStatus) => isTreatmentOpen(treatment({ treatmentStatus }))),
    ["Not Started", "In Progress", "Overdue"],
  );
  assert.equal(isTreatmentOpen(treatment({ treatmentStatus: null })), true);
  assert.equal(isTreatmentOpen(treatment({ treatmentStatus: undefined })), true);
  assert.equal(isTreatmentOpen(treatment({ closureDate: "2026-09-20" })), false);
});

test("the due-state rule refuses a today that is not a UTC calendar date and a window that is not a whole day count", () => {
  assert.throws(() => deriveTreatmentDueState(treatment({ targetDate: "2026-09-24" }), "2026-09-24T00:00:00.000Z"), RangeError);
  assert.throws(() => deriveTreatmentDueState(treatment({ targetDate: null }), "24/09/2026"), RangeError);
  assert.throws(() => deriveTreatmentDueState(treatment({ targetDate: "2026-09-24" }), TODAY, -1), RangeError);
  assert.throws(() => deriveTreatmentDueState(treatment({ targetDate: "2026-09-24" }), TODAY, 1.5), RangeError);
});

/*
 * G-16 seam (Phase 7 D-04): the due state has one switch point. The rule for one Risk and its SQL mirror for a
 * list or a count live in one module and read one governing date, so Phase 20 switches every due or overdue
 * figure from targetDate to treatmentResolveDate in one place.
 */
test("the due-state rule and its SQL mirror share one module and one governing date (G-16)", () => {
  const seam = treatmentDueStateModule as Record<string, unknown>;
  assert.equal(typeof seam.deriveTreatmentDueState, "function", "THE_RULE_FOR_ONE_RISK");
  assert.equal(typeof seam.applyTreatmentDueStatePredicate, "function", "THE_SQL_MIRROR_IS_NOT_BESIDE_THE_RULE");
  assert.equal(seam.TREATMENT_DUE_DATE_COLUMN, "r.target_date", "THE_GOVERNING_DATE_COLUMN");
  const source = readFileSync(path.join(appDir, "src", "csrm", "insights", "treatment-due-state.ts"), "utf8");
  assert.ok(
    source.includes("Phase 20 (G-16) switches this rule's governing date from targetDate to treatmentResolveDate"),
    "THE_PHASE_20_SWITCH_COMMENT",
  );
  const register = readFileSync(path.join(appDir, "src", "api", "csrm-risk", "services", "risk-register.ts"), "utf8");
  assert.match(register, /applyTreatmentDueStatePredicate\(/, "THE_REGISTER_DOES_NOT_READ_THE_SHARED_PREDICATE");
});

/*
 * G-16 seam, plan 11-17: the treatment-performance report's due-state counts and the two risk-treatment alert
 * kinds read the same shared predicate as the register, so Phase 20's one switch covers the register, the alerts
 * and the report. Each call says so, and neither module writes its own due comparison on the target date.
 */
test("the treatment report and the risk-treatment alerts read the shared due-state rule, with the Phase 20 comment at each call (G-16)", () => {
  const services = path.join(appDir, "src", "api", "csrm-analyst-insight", "services");
  const switchComment = "Phase 20 (G-16) switches the governing date in treatment-due-state.ts; this figure follows it.";
  for (const file of ["report-repository.ts", "alert-repository.ts"]) {
    const source = readFileSync(path.join(services, file), "utf8");
    const calls = source.match(/applyTreatmentDueStatePredicate\(/g) ?? [];
    assert.ok(calls.length > 0, `${file}_DOES_NOT_READ_THE_SHARED_PREDICATE`);
    const comments = source.split(switchComment).length - 1;
    assert.ok(comments >= calls.length, `${file}_A_CALL_WITHOUT_THE_PHASE_20_COMMENT (${calls.length} calls, ${comments} comments)`);
    // No due comparison of its own on the governing date: no `target_date <`, `>` or BETWEEN outside the rule.
    assert.doesNotMatch(source, /target_date\s*[<>]|"r\.target_date",\s*"[<>]=?"|whereBetween\("r\.target_date"/, `${file}_WRITES_ITS_OWN_DUE_COMPARISON`);
  }
  const alerts = readFileSync(path.join(services, "alert-repository.ts"), "utf8");
  assert.match(alerts, /governingDate: TREATMENT_DUE_DATE_COLUMN/, "THE_ALERT_GOVERNING_DATE_IS_NOT_THE_RULE'S");
});

/* ------------------------------------------------------------- alert-rules */

test("the alert kind and urgency vocabularies are closed and ranked", () => {
  assert.deepEqual(ALERT_KINDS, [
    "risk-treatment-overdue",
    "risk-treatment-due-soon",
    "request-overdue",
    "request-due-soon",
    "control-implementation-overdue",
    "assessment-review-due",
    "critical-residual-risk-untreated",
    "ineffective-control",
  ]);
  assert.deepEqual(ALERT_URGENCIES, ["overdue", "due-soon", "attention"]);
  assert.deepEqual(ALERT_URGENCY_RANK, { overdue: 1, "due-soon": 2, attention: 3 });
});

test("an alert id is its kind and its source documentId", () => {
  assert.equal(alertId("risk-treatment-overdue", "abc"), "risk-treatment-overdue:abc");
});

test("a review-due alert takes its urgency from its date and every other kind has a fixed urgency", () => {
  assert.equal(alertUrgency("assessment-review-due", "2026-09-23", TODAY), "overdue");
  assert.equal(alertUrgency("assessment-review-due", "2026-09-24", TODAY), "due-soon");
  assert.equal(alertUrgency("assessment-review-due", "2026-10-08", TODAY), "due-soon");

  const fixed = {
    "risk-treatment-overdue": "overdue",
    "risk-treatment-due-soon": "due-soon",
    "request-overdue": "overdue",
    "request-due-soon": "due-soon",
    "control-implementation-overdue": "overdue",
    "critical-residual-risk-untreated": "attention",
    "ineffective-control": "attention",
  } as const;
  for (const [kind, urgency] of Object.entries(fixed)) {
    for (const date of ["2026-01-01", "2026-09-23", "2026-09-24", "2026-12-31", null]) {
      assert.equal(alertUrgency(kind as AlertKind, date, TODAY), urgency, `${kind} on ${String(date)}`);
    }
  }
});

test("an alert's day offset counts whole UTC days from today to its governing date", () => {
  assert.equal(alertDayOffset("2026-09-12", TODAY), -12);
  assert.equal(alertDayOffset("2026-09-24", TODAY), 0);
  assert.equal(alertDayOffset("2026-10-08", TODAY), 14);
  assert.equal(alertDayOffset(null, TODAY), null);
  assert.equal(alertDayOffset(undefined, TODAY), null);
});

function riskFacts(overrides: Partial<Parameters<typeof classifyRiskAlerts>[0]> = {}): Parameters<typeof classifyRiskAlerts>[0] {
  return {
    residualRating: "High",
    treatmentStatus: "In Progress",
    targetDate: null,
    closureDate: null,
    parentDisclosable: true,
    ...overrides,
  };
}

test("Risk alerts: treatment timing and untreated Critical exposure, only on open disclosable Risks", () => {
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: null }), TODAY), ["critical-residual-risk-untreated"]);
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "Not Started" }), TODAY), ["critical-residual-risk-untreated"]);
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "In Progress", targetDate: "2026-12-01" }), TODAY), []);
  assert.deepEqual(classifyRiskAlerts(riskFacts({ treatmentStatus: "In Progress", targetDate: "2026-09-23" }), TODAY), ["risk-treatment-overdue"]);
  assert.deepEqual(classifyRiskAlerts(riskFacts({ treatmentStatus: "In Progress", targetDate: "2026-10-08" }), TODAY), ["risk-treatment-due-soon"]);
  assert.deepEqual(
    classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "Not Started", targetDate: "2026-09-23" }), TODAY),
    ["risk-treatment-overdue", "critical-residual-risk-untreated"],
  );

  // Closed or Complete Risks never alert.
  assert.deepEqual(
    classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "Not Started", targetDate: "2026-09-23", closureDate: "2026-09-20" }), TODAY),
    [],
  );
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "Complete", targetDate: "2026-09-23" }), TODAY), []);
  // D-14: a Risk outside the Risk Register scope never alerts.
  assert.deepEqual(
    classifyRiskAlerts(riskFacts({ residualRating: "Critical", treatmentStatus: "Not Started", targetDate: "2026-09-23", parentDisclosable: false }), TODAY),
    [],
  );
  // The Critical match is exact.
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "Critical ", treatmentStatus: "Not Started" }), TODAY), []);
  assert.deepEqual(classifyRiskAlerts(riskFacts({ residualRating: "critical", treatmentStatus: "Not Started" }), TODAY), []);
});

function controlFacts(
  overrides: Partial<Parameters<typeof classifyControlImplementationAlerts>[0]> = {},
): Parameters<typeof classifyControlImplementationAlerts>[0] {
  return {
    controlStatus: "Planned",
    effectivenessRating: null,
    implementationDueDate: "2026-09-23",
    parentRiskOpen: true,
    parentDisclosable: true,
    ...overrides,
  };
}

test("Control Implementation alerts need an open, disclosable parent Risk", () => {
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts(), TODAY), ["control-implementation-overdue"]);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ parentRiskOpen: false }), TODAY), []);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ parentDisclosable: false }), TODAY), []);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ implementationDueDate: "2026-09-24" }), TODAY), []);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ implementationDueDate: null }), TODAY), []);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ controlStatus: "Implemented" }), TODAY), []);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ controlStatus: null }), TODAY), []);

  const ineffective = { controlStatus: "Implemented", effectivenessRating: "Ineffective", implementationDueDate: null };
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts(ineffective), TODAY), ["ineffective-control"]);
  assert.deepEqual(classifyControlImplementationAlerts(controlFacts({ ...ineffective, parentRiskOpen: false }), TODAY), []);
  assert.deepEqual(
    classifyControlImplementationAlerts(controlFacts({ effectivenessRating: "Ineffective" }), TODAY),
    ["control-implementation-overdue", "ineffective-control"],
  );
});

test("request alerts come only from the four reviewable statuses (D-29)", () => {
  assert.deepEqual(classifyRequestAlerts({ requestStatus: "under-review", dueDate: "2026-09-23" }, TODAY), ["request-overdue"]);
  assert.deepEqual(classifyRequestAlerts({ requestStatus: "submitted", dueDate: "2026-09-24" }, TODAY), ["request-due-soon"]);
  assert.deepEqual(classifyRequestAlerts({ requestStatus: "questionnaire-in-progress", dueDate: "2026-10-08" }, TODAY), ["request-due-soon"]);
  assert.deepEqual(classifyRequestAlerts({ requestStatus: "questionnaire-in-progress", dueDate: "2026-10-09" }, TODAY), []);
  for (const requestStatus of ["draft", "approved", "closed"]) {
    assert.deepEqual(classifyRequestAlerts({ requestStatus, dueDate: "2026-09-23" }, TODAY), [], requestStatus);
  }
  assert.deepEqual(classifyRequestAlerts({ requestStatus: "under-review", dueDate: null }, TODAY), []);

  const reviewable = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"];
  assert.deepEqual(REQUEST_ALERT_STATUSES, reviewable);
  assert.deepEqual(
    requestStatuses.filter((requestStatus) => classifyRequestAlerts({ requestStatus, dueDate: "2026-09-23" }, TODAY).length > 0),
    reviewable,
  );
});

test("assessment review alerts come only from released assessments inside the window", () => {
  assert.deepEqual(classifyAssessmentAlerts({ released: true, nextReviewDate: "2026-09-23" }, TODAY), ["assessment-review-due"]);
  assert.deepEqual(classifyAssessmentAlerts({ released: true, nextReviewDate: "2026-10-08" }, TODAY), ["assessment-review-due"]);
  assert.deepEqual(classifyAssessmentAlerts({ released: true, nextReviewDate: "2026-10-09" }, TODAY), []);
  assert.deepEqual(classifyAssessmentAlerts({ released: false, nextReviewDate: "2026-09-23" }, TODAY), []);
  assert.deepEqual(classifyAssessmentAlerts({ released: true, nextReviewDate: null }, TODAY), []);
});

/*
 * Seven elements, because each tie rule needs a pair that differs first at that
 * rule: adjacent elements in the sorted order decide which rules the fixture
 * proves, so six rules need seven elements.
 */
test("alerts order by urgency, undated last, date, source identifier, kind, then source documentId", () => {
  const alert = (
    name: string,
    urgency: AlertOrderKey["urgency"],
    governingDate: string | null,
    identifier: string,
    kind: AlertKind,
    documentId: string,
  ): AlertOrderKey & { name: string } => ({ name, urgency, governingDate, kind, source: { identifier, documentId } });

  const fixture = [
    alert("attention-undated", "attention", null, "RSK-0000", "critical-residual-risk-untreated", "a-risk"),
    alert("attention-dated", "attention", "2026-01-15", "RSK-0009", "ineffective-control", "z-ci"),
    alert("overdue-risk-kind", "overdue", "2026-09-20", "RSK-0001", "risk-treatment-overdue", "a-risk"),
    alert("overdue-control-n", "overdue", "2026-09-20", "RSK-0001", "control-implementation-overdue", "n-ci"),
    alert("overdue-control-m", "overdue", "2026-09-20", "RSK-0001", "control-implementation-overdue", "m-ci"),
    alert("overdue-request-identifier", "overdue", "2026-09-20", "RAR-0001", "request-overdue", "z-request"),
    alert("overdue-earliest", "overdue", "2026-09-12", "RSK-0099", "risk-treatment-overdue", "z-risk"),
  ];
  const expected = [
    "overdue-earliest",
    "overdue-request-identifier",
    "overdue-control-m",
    "overdue-control-n",
    "overdue-risk-kind",
    "attention-dated",
    "attention-undated",
  ];

  for (const order of [fixture, [...fixture].reverse(), [3, 0, 6, 2, 5, 1, 4].map((index) => fixture[index]!)]) {
    assert.deepEqual([...order].sort(compareAlerts).map(({ name }) => name), expected);
  }
  assert.equal(compareAlerts(fixture[0]!, fixture[0]!), 0);
});

/* ------------------------------------------------------------- report-math */

test("a rating normalises to the closed ladder by exact match", () => {
  assert.equal(normaliseRating("High"), "High");
  assert.equal(normaliseRating("Critical"), "Critical");
  assert.equal(normaliseRating("high"), null);
  assert.equal(normaliseRating("Very High"), null);
  assert.equal(normaliseRating(null), null);
  assert.equal(normaliseRating(undefined), null);
});

test("rating counts fold unknown ratings into notRated and read database totals as numbers", () => {
  const counts = ratingCounts([
    { rating: "Critical", total: "2" },
    { rating: "High", total: 3 },
    { rating: null, total: 1 },
    { rating: "Extreme", total: 1 },
  ]);
  assert.deepEqual(counts, { Critical: 2, High: 3, Moderate: 0, Low: 0, notRated: 2, total: 7 });
  assertPartitionSums(counts);
  assert.deepEqual(ratingCounts([]), { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 });
});

test("treatment, control and effectiveness partitions cover their frozen vocabularies", () => {
  const treatment = treatmentStatusCounts([
    { status: "Not Started", total: 1 },
    { status: "In Progress", total: "2" },
    { status: "Overdue", total: 3 },
    { status: "Complete", total: 4 },
    { status: null, total: 5 },
    { status: "Bogus", total: 1 },
  ]);
  assert.deepEqual(treatment, { notStarted: 1, inProgress: 2, overdue: 3, complete: 4, notProvided: 6, total: 16 });
  assertPartitionSums(treatment);
  for (const status of treatmentStatuses) {
    assert.equal(treatmentStatusCounts([{ status, total: 1 }]).notProvided, 0, status);
  }

  assert.deepEqual(controlStatuses, ["Existing", "Planned", "Implemented", "Retired"]);
  const control = controlStatusCounts([
    { status: "Existing", total: 1 },
    { status: "Planned", total: 2 },
    { status: "Implemented", total: 3 },
    { status: "Retired", total: 4 },
    { status: null, total: "5" },
  ]);
  assert.deepEqual(control, { existing: 1, planned: 2, implemented: 3, retired: 4, notProvided: 5, total: 15 });
  assertPartitionSums(control);
  for (const status of controlStatuses) {
    assert.equal(controlStatusCounts([{ status, total: 1 }]).notProvided, 0, status);
  }

  assert.deepEqual(effectivenessRatings, ["Effective", "Partially Effective", "Ineffective", "Not Assessed"]);
  const effectiveness = effectivenessCounts([
    { rating: "Effective", total: 1 },
    { rating: "Partially Effective", total: 2 },
    { rating: "Ineffective", total: 3 },
    { rating: "Not Assessed", total: 4 },
    { rating: null, total: 5 },
  ]);
  assert.deepEqual(effectiveness, { effective: 1, partiallyEffective: 2, ineffective: 3, notAssessed: 4, notProvided: 5, total: 15 });
  assertPartitionSums(effectiveness);
  for (const rating of effectivenessRatings) {
    assert.equal(effectivenessCounts([{ rating, total: 1 }]).notProvided, 0, rating);
  }
});

test("request status counts keep the six review-scope statuses and ignore drafts", () => {
  assert.deepEqual(requestStatuses, [
    "draft",
    "submitted",
    "questionnaire-in-progress",
    "risk-assessment-drafted",
    "under-review",
    "approved",
    "closed",
  ]);
  const counts = requestStatusCounts([
    ...requestStatuses.map((status, index) => ({ status, total: String(index + 1) })),
    { status: "archived", total: 9 },
    { status: null, total: 9 },
  ]);
  assert.deepEqual(counts, {
    submitted: 2,
    questionnaireInProgress: 3,
    riskAssessmentDrafted: 4,
    underReview: 5,
    approved: 6,
    closed: 7,
    total: 27,
  });
  assertPartitionSums(counts);
});

test("a partition refuses a database total that is not a whole count", () => {
  assert.throws(() => ratingCounts([{ rating: "High", total: "x" }]), RangeError);
  assert.throws(() => treatmentStatusCounts([{ status: "Complete", total: -1 }]), RangeError);
  assert.throws(() => requestStatusCounts([{ status: "submitted", total: 1.5 }]), RangeError);
});

test("throughput months run oldest first to a partial current month on UTC month boundaries", () => {
  const six = throughputMonths("2026-09-24", 6);
  assert.deepEqual(six.map(({ monthStart }) => monthStart), [
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
    "2026-09-01",
  ]);
  assert.deepEqual(six.map(({ partial }) => partial), [false, false, false, false, false, true]);
  assert.ok(six.every(({ start, end }) => start instanceof Date && end instanceof Date));
  assert.deepEqual(six.map(({ start, end }) => [start.toISOString(), end.toISOString()]), [
    ["2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"],
    ["2026-05-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"],
    ["2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z"],
    ["2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"],
    ["2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"],
    ["2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
  ]);

  const twelve = throughputMonths("2026-09-24", 12);
  assert.equal(twelve.length, 12);
  assert.equal(twelve[0]?.monthStart, "2025-10-01");
  assert.equal(twelve[11]?.monthStart, "2026-09-01");
  assert.deepEqual(twelve.filter(({ partial }) => partial).map(({ monthStart }) => monthStart), ["2026-09-01"]);

  assert.throws(() => throughputMonths("2026-09-24", 0), RangeError);
  assert.throws(() => throughputMonths("2026-09-24T00:00:00.000Z", 6), RangeError);
});

test("the median of elapsed days drops negative gaps, rounds to one decimal and flags a capped sample", () => {
  const base = Date.UTC(2026, 8, 1);
  const pair = (days: number) => ({ from: new Date(base), to: new Date(base + days * DAY_MS) });

  assert.deepEqual(medianDays([pair(10), pair(4), pair(7)], 5), { value: 7, sampleSize: 3, truncated: false });
  assert.deepEqual(medianDays([pair(10), pair(4), pair(7), pair(1)], 5), { value: 5.5, sampleSize: 4, truncated: false });
  assert.deepEqual(medianDays([pair(1.5)], 5), { value: 1.5, sampleSize: 1, truncated: false });
  assert.deepEqual(medianDays([pair(10), pair(-2), pair(4)], 5), { value: 7, sampleSize: 2, truncated: false });
  assert.deepEqual(medianDays([{ from: null, to: new Date(base) }, pair(3)], 5), { value: 3, sampleSize: 1, truncated: false });
  assert.deepEqual(medianDays([], 5), { value: null, sampleSize: 0, truncated: false });
  // Newest first: the cap keeps the first three pairs and says so.
  assert.deepEqual(medianDays([pair(1), pair(2), pair(3), pair(100)], 3), { value: 2, sampleSize: 3, truncated: true });

  assert.throws(() => medianDays([pair(1)], 0), RangeError);
});

test("the treatment due-state partition reads one aggregate row whose parts add up to its total", () => {
  assert.deepEqual(
    treatmentDueStateCounts({ overdue: 2, dueWithinWindow: "2", later: 1, noTargetDate: "2", total: "7" }),
    { overdue: 2, dueWithinWindow: 2, later: 1, noTargetDate: 2, total: 7 },
  );
  // SQL's SUM over no rows is NULL, while COUNT is 0.
  assert.deepEqual(
    treatmentDueStateCounts({ overdue: null, dueWithinWindow: null, later: null, noTargetDate: null, total: 0 }),
    { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 },
  );
  // A partition whose parts miss or double count a treatment is refused.
  assert.throws(() => treatmentDueStateCounts({ overdue: 1, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 2 }), RangeError);
  assert.throws(() => treatmentDueStateCounts({ overdue: 2, dueWithinWindow: 1, later: 0, noTargetDate: 0, total: 2 }), RangeError);
  // Parts and totals are whole counts; a COUNT is never NULL.
  assert.throws(() => treatmentDueStateCounts({ overdue: -1, dueWithinWindow: 1, later: 0, noTargetDate: 0, total: 0 }), RangeError);
  assert.throws(() => treatmentDueStateCounts({ overdue: 1.5, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 1.5 }), RangeError);
  assert.throws(() => treatmentDueStateCounts({ overdue: "x", dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 }), RangeError);
  assert.throws(() => treatmentDueStateCounts({ overdue: null, dueWithinWindow: null, later: null, noTargetDate: null, total: null }), RangeError);
});

test("released months pair each throughput month with its count, oldest first, and total the period", () => {
  const months = throughputMonths("2026-09-24", 6);
  assert.deepEqual(throughputReleased(months, [0, "0", null, 1, 0, "2"]), {
    months: [
      { monthStart: "2026-04-01", count: 0, partial: false },
      { monthStart: "2026-05-01", count: 0, partial: false },
      { monthStart: "2026-06-01", count: 0, partial: false },
      { monthStart: "2026-07-01", count: 1, partial: false },
      { monthStart: "2026-08-01", count: 0, partial: false },
      { monthStart: "2026-09-01", count: 2, partial: true },
    ],
    total: 3,
  });
  // With no release in the whole period every month is zero, and a zero month is still a month.
  const empty = throughputReleased(throughputMonths("2026-09-24", 12), Array.from({ length: 12 }, () => null));
  assert.equal(empty.months.length, 12);
  assert.ok(empty.months.every(({ count }) => count === 0));
  assert.equal(empty.total, 0);

  assert.throws(() => throughputReleased(months, [0, 0, 0]), RangeError);
  assert.throws(() => throughputReleased(months, [0, 0, 0, 0, 0, 0, 0]), RangeError);
  assert.throws(() => throughputReleased(months, [0, 0, 0, 0, 0, -1]), RangeError);
  assert.throws(() => throughputReleased(months, [0, 0, 0, 0, 0, "x"]), RangeError);
});

/* ----------------------------------------------------------- recent activity */

/** One activity item. Every field is a literal, so no expectation recomputes the rule under test. */
function activityItem(
  kind: ActivityItem["kind"],
  recordType: ActivityItem["recordType"],
  documentId: string,
  occurredAt: string,
): ActivityItem {
  return { kind, recordType, documentId, identifier: `ID-${documentId}`, title: `Title ${documentId}`, actorDisplayName: null, occurredAt };
}

/*
 * Five events. Three share one instant, written in two forms (Z and +02:00), so
 * the kind rule and then the documentId rule each decide a tie; one is newer
 * and one is older than all three.
 */
const OLDEST = activityItem("questionnaire-generated", "questionnaire", "q-2", "2026-09-19T23:59:59.999Z");
const TIED_REQUEST_LATER_ID = activityItem("request-submitted", "assessment-request", "r-2", "2026-09-20T10:00:00.000Z");
const TIED_ASSESSMENT = activityItem("assessment-released", "assessment", "a-1", "2026-09-20T12:00:00.000+02:00");
const TIED_REQUEST_EARLIER_ID = activityItem("request-submitted", "assessment-request", "r-1", "2026-09-20T10:00:00.000Z");
const NEWEST = activityItem("questionnaire-released", "questionnaire", "q-1", "2026-09-21T08:00:00.000Z");
const ACTIVITY_INPUT = Object.freeze([OLDEST, TIED_REQUEST_LATER_ID, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID, NEWEST]);

test("the recent activity kinds are the seven closed workflow events", () => {
  assert.deepEqual([...ACTIVITY_KINDS], [
    "request-submitted",
    "request-returned-to-draft",
    "questionnaire-generated",
    "questionnaire-released",
    "questionnaire-returned-to-draft",
    "assessment-draft-generated",
    "assessment-released",
  ]);
  assert.ok(Object.isFrozen(ACTIVITY_KINDS));
});

test("recent activity runs newest first, then by kind, then by documentId", () => {
  assert.deepEqual(mergeRecentActivity(ACTIVITY_INPUT, 5), {
    rows: [NEWEST, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID, TIED_REQUEST_LATER_ID, OLDEST],
    truncated: false,
  });
});

test("recent activity keeps only the limit and is truncated exactly when there were more", () => {
  assert.deepEqual(mergeRecentActivity(ACTIVITY_INPUT, 3), {
    rows: [NEWEST, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID],
    truncated: true,
  });
  assert.deepEqual(mergeRecentActivity(ACTIVITY_INPUT, 4), {
    rows: [NEWEST, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID, TIED_REQUEST_LATER_ID],
    truncated: true,
  });
  assert.equal(mergeRecentActivity(ACTIVITY_INPUT, 5).truncated, false);
  assert.equal(mergeRecentActivity(ACTIVITY_INPUT, 6).truncated, false);
  assert.equal(mergeRecentActivity(ACTIVITY_INPUT, 6).rows.length, 5);
  assert.deepEqual(mergeRecentActivity([], 8), { rows: [], truncated: false });
  // The input is never reordered in place.
  assert.deepEqual([...ACTIVITY_INPUT], [OLDEST, TIED_REQUEST_LATER_ID, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID, NEWEST]);
});

test("recent activity is the same whatever order the sources arrive in", () => {
  const expected = [NEWEST, TIED_ASSESSMENT, TIED_REQUEST_EARLIER_ID];
  const permutations = (items: readonly ActivityItem[]): ActivityItem[][] => items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
  const orders = permutations(ACTIVITY_INPUT);
  assert.equal(orders.length, 120);
  for (const order of orders) {
    const merged = mergeRecentActivity(order, 3);
    assert.deepEqual(merged.rows, expected, `ACTIVITY_ORDER_DEPENDS_ON_INPUT_${order.map((item) => item.documentId).join(",")}`);
    assert.equal(merged.truncated, true);
  }
});

test("recent activity refuses a limit that is not a whole count and an item without a valid instant", () => {
  for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => mergeRecentActivity(ACTIVITY_INPUT, limit), RangeError, `limit ${limit}`);
  }
  for (const occurredAt of ["", "yesterday", "2026-02-30T00:00:00.000Z", "2026-09-20T25:00:00.000Z"]) {
    assert.throws(
      () => mergeRecentActivity([...ACTIVITY_INPUT, activityItem("request-submitted", "assessment-request", "r-9", occurredAt)], 8),
      RangeError,
      `occurredAt ${JSON.stringify(occurredAt)}`,
    );
  }
});

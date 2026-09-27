/*
 * The derived alert vocabulary and its per-record rules (D-10, D-11, D-29, D-31).
 *
 * Alerts are stateless conditions computed on read. This module fixes:
 * - the closed kind and urgency vocabularies;
 * - the deterministic id, the day offset and the list order;
 * - one oracle classifier per source record type.
 * The SQL that lists alerts is proven against these classifiers.
 *
 * Every date window comes from the D-04 rule in `treatment-due-state`, so the
 * window is defined once and no comparison is restated here.
 */
import { deriveTreatmentDueState, isTreatmentOpen } from "./treatment-due-state";
import type { TreatmentDueState, TreatmentFacts } from "./treatment-due-state";
import { daysBetween } from "./utc-date";

export const ALERT_KINDS = Object.freeze([
  "risk-treatment-overdue",
  "risk-treatment-due-soon",
  "request-overdue",
  "request-due-soon",
  "control-implementation-overdue",
  "assessment-review-due",
  "critical-residual-risk-untreated",
  "ineffective-control",
] as const);
export type AlertKind = typeof ALERT_KINDS[number];

/** D-11: urgency is its own vocabulary and is never merged with a Risk rating. */
export const ALERT_URGENCIES = Object.freeze(["overdue", "due-soon", "attention"] as const);
export type AlertUrgency = typeof ALERT_URGENCIES[number];

/** A lower rank lists first. */
export const ALERT_URGENCY_RANK: Readonly<Record<AlertUrgency, number>> = Object.freeze({
  overdue: 1,
  "due-soon": 2,
  attention: 3,
});

/*
 * D-29: only the four reviewable request statuses can raise a request alert.
 * A draft belongs to its Requestor until it is submitted, and an approved or
 * closed request has left review, so neither is analyst work. The tuple is
 * restated here rather than imported so the rules stay free of Strapi
 * services; the alert tests prove it equals the review queue's reviewable
 * statuses.
 */
export const REQUEST_ALERT_STATUSES = Object.freeze([
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
] as const);
const REQUEST_ALERT_STATUS_SET: ReadonlySet<string> = new Set(REQUEST_ALERT_STATUSES);

/** Every kind except `assessment-review-due` has a fixed urgency. */
const FIXED_URGENCY: Readonly<Record<Exclude<AlertKind, "assessment-review-due">, AlertUrgency>> = Object.freeze({
  "risk-treatment-overdue": "overdue",
  "risk-treatment-due-soon": "due-soon",
  "request-overdue": "overdue",
  "request-due-soon": "due-soon",
  "control-implementation-overdue": "overdue",
  "critical-residual-risk-untreated": "attention",
  "ineffective-control": "attention",
});

/** The fields that order an alert list. The alert DTO carries all of them. */
export type AlertOrderKey = {
  kind: AlertKind;
  urgency: AlertUrgency;
  governingDate: string | null;
  source: { identifier: string; documentId: string };
};

export type RiskAlertFacts = TreatmentFacts & {
  residualRating: string | null | undefined;
  /** D-14: the Risk's parent assessment admits it to the Risk Register scope. */
  parentDisclosable: boolean;
};

export type ControlImplementationAlertFacts = {
  controlStatus: string | null | undefined;
  effectivenessRating: string | null | undefined;
  implementationDueDate: string | null | undefined;
  /** D-31: the parent Risk is open, meaning it has no closure date. */
  parentRiskOpen: boolean;
  /** D-14: the parent Risk is inside the Risk Register scope. */
  parentDisclosable: boolean;
};

export type RequestAlertFacts = {
  requestStatus: string | null | undefined;
  dueDate: string | null | undefined;
};

export type AssessmentAlertFacts = {
  /** The assessment carries its complete release facts: approved status, approval date and approver. */
  released: boolean;
  nextReviewDate: string | null | undefined;
};

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value !== "";
}

/*
 * The D-04 window applied to one governing date, as an open item that carries
 * only a date. Requests, reviews and Control Implementations use it, so every
 * alert shares the treatment window.
 */
function dateWindowState(date: string | null | undefined, today: string): TreatmentDueState {
  return deriveTreatmentDueState({ targetDate: date, treatmentStatus: null, closureDate: null }, today);
}

function inKindOrder(kinds: ReadonlySet<AlertKind>): AlertKind[] {
  return ALERT_KINDS.filter((kind) => kinds.has(kind));
}

/*
 * Code-unit comparison, which matches SQLite's default BINARY collation, so the
 * oracle order and the SQL ORDER BY agree on identifiers, kinds and ids.
 */
function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** D-10: the deterministic alert id. */
export function alertId(kind: AlertKind, sourceDocumentId: string): string {
  return `${kind}:${sourceDocumentId}`;
}

/** A review falls due from its date. Every other kind has a fixed urgency. */
export function alertUrgency(kind: AlertKind, governingDate: string | null | undefined, today: string): AlertUrgency {
  if (kind === "assessment-review-due") {
    return dateWindowState(governingDate, today) === "overdue" ? "overdue" : "due-soon";
  }
  return FIXED_URGENCY[kind];
}

/** Whole UTC days from today to the governing date: negative when it has passed, null without a date. */
export function alertDayOffset(governingDate: string | null | undefined, today: string): number | null {
  return isPresent(governingDate) ? daysBetween(today, governingDate) : null;
}

/**
 * D-12 order: urgency rank, then undated after dated, then governing date
 * ascending, then source identifier, then kind, then source documentId.
 */
export function compareAlerts(left: AlertOrderKey, right: AlertOrderKey): number {
  const byRank = ALERT_URGENCY_RANK[left.urgency] - ALERT_URGENCY_RANK[right.urgency];
  if (byRank !== 0) return byRank;
  const leftDated = isPresent(left.governingDate);
  if (leftDated !== isPresent(right.governingDate)) return leftDated ? -1 : 1;
  return compareText(left.governingDate ?? "", right.governingDate ?? "")
    || compareText(left.source.identifier, right.source.identifier)
    || compareText(left.kind, right.kind)
    || compareText(left.source.documentId, right.source.documentId);
}

/**
 * The alerts one Risk raises. Only an open Risk inside the Risk Register scope
 * alerts. A Critical residual Risk is untreated when its treatment status is
 * "Not Started" or NULL, because a NULL status records no treatment (D-31). The
 * rating match is exact.
 */
export function classifyRiskAlerts(facts: RiskAlertFacts, today: string): AlertKind[] {
  const dueState = deriveTreatmentDueState(facts, today);
  if (!facts.parentDisclosable || !isTreatmentOpen(facts)) return [];
  const kinds = new Set<AlertKind>();
  if (dueState === "overdue") kinds.add("risk-treatment-overdue");
  if (dueState === "due-soon") kinds.add("risk-treatment-due-soon");
  const untreated = facts.treatmentStatus === null || facts.treatmentStatus === undefined
    || facts.treatmentStatus === "Not Started";
  if (facts.residualRating === "Critical" && untreated) kinds.add("critical-residual-risk-untreated");
  return inKindOrder(kinds);
}

/**
 * The alerts one Control Implementation raises. Both kinds need an open parent
 * Risk inside the Risk Register scope (D-14, D-31). A Planned implementation is
 * overdue once its due date has passed.
 */
export function classifyControlImplementationAlerts(facts: ControlImplementationAlertFacts, today: string): AlertKind[] {
  const dueState = dateWindowState(facts.implementationDueDate, today);
  if (!facts.parentDisclosable || !facts.parentRiskOpen) return [];
  const kinds = new Set<AlertKind>();
  if (facts.controlStatus === "Planned" && dueState === "overdue") kinds.add("control-implementation-overdue");
  if (facts.effectivenessRating === "Ineffective") kinds.add("ineffective-control");
  return inKindOrder(kinds);
}

/** The alerts one Assessment Request raises. Only a reviewable request alerts (D-29). */
export function classifyRequestAlerts(facts: RequestAlertFacts, today: string): AlertKind[] {
  const dueState = dateWindowState(facts.dueDate, today);
  if (typeof facts.requestStatus !== "string" || !REQUEST_ALERT_STATUS_SET.has(facts.requestStatus)) return [];
  if (dueState === "overdue") return ["request-overdue"];
  if (dueState === "due-soon") return ["request-due-soon"];
  return [];
}

/** The alerts one Risk Assessment raises. Only a released assessment falls due for review. */
export function classifyAssessmentAlerts(facts: AssessmentAlertFacts, today: string): AlertKind[] {
  const dueState = dateWindowState(facts.nextReviewDate, today);
  if (!facts.released) return [];
  return dueState === "overdue" || dueState === "due-soon" ? ["assessment-review-due"] : [];
}

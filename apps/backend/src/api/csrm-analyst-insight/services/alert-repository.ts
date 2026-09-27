import type { Database } from "@strapi/database";

import { REVIEWABLE_REQUEST_STATUSES } from "../../csrm-assessment-request/services/collection-scope";
import { applyDisclosableParent } from "../../csrm-risk/services/risk-register";
import {
  ALERT_KINDS,
  ALERT_URGENCIES,
  ALERT_URGENCY_RANK,
  alertDayOffset,
  alertId,
  type AlertKind,
  type AlertUrgency,
} from "../../../csrm/insights/alert-rules";
import { ALERT_DUE_SOON_WINDOW_DAYS, ALERT_PAGE_SIZES } from "../../../csrm/insights/insight-constants";
import { normaliseRating, type RiskRating } from "../../../csrm/insights/report-math";
import { addUtcDays, isUtcDate } from "../../../csrm/insights/utc-date";

/*
 * The analyst alerts, derived on read (D-01, D-10). Each kind is one SELECT
 * branch over the tables that hold its facts. The list is a UNION ALL of the
 * selected kinds' branches, ordered and paged as one derived table; the
 * summary groups the same union by kind and urgency. The list, its total and
 * the summary therefore share one predicate and always agree (D-12).
 *
 * Scope (D-14): Risk and Control Implementation branches reuse the Risk
 * Register's applyDisclosableParent, request branches read only the reviewable
 * statuses (D-29), and review branches read only released assessments.
 *
 * Every column comes from a constant in this module, every value is a bound
 * parameter, and every ORDER BY fragment is a constant.
 */

type Knex = Database["connection"];
type QueryBuilder = ReturnType<Knex["queryBuilder"]>;
type Raw = ReturnType<Knex["raw"]>;
type RecordValue = Record<string, unknown>;

export const ALERT_SOURCE_TYPES = Object.freeze(["risk", "assessment-request", "assessment", "control-implementation"] as const);
export type AlertSourceType = typeof ALERT_SOURCE_TYPES[number];

/** A Control Implementation has no page of its own, so its alerts link to the parent Risk. */
export const ALERT_LINK_TYPES = Object.freeze(["risk", "assessment-request", "assessment"] as const);
export type AlertLinkType = typeof ALERT_LINK_TYPES[number];

export type AlertItem = {
  id: string;
  kind: AlertKind;
  urgency: AlertUrgency;
  governingDate: string | null;
  dayOffset: number | null;
  source: { type: AlertSourceType; documentId: string; identifier: string; title: string | null; released: boolean };
  link: { type: AlertLinkType; documentId: string };
  /** D-11: the (parent) Risk's residual rating, carried apart from the urgency. Null for requests and assessments. */
  residualRating: RiskRating | null;
};

export type AlertCountRow = { kind: AlertKind; urgency: AlertUrgency; total: number };

export type AlertCounts = {
  byKind: Record<AlertKind, number>;
  byUrgency: Record<AlertUrgency, number>;
  total: number;
};

export type AlertPageInput = {
  kinds: readonly AlertKind[];
  /** One urgency, or every urgency when absent. */
  urgency?: AlertUrgency;
  page: number;
  pageSize: number;
  /** The UTC calendar date (YYYY-MM-DD) every window is evaluated on. */
  today: string;
};

export type AlertRepository = {
  /** One page of alert rows in the D-12 order. Project each with projectAlertRow. */
  listPage: (input: AlertPageInput) => Promise<RecordValue[]>;
  count: (input: Pick<AlertPageInput, "kinds" | "urgency" | "today">) => Promise<number>;
  /** Every alert counted by kind and urgency, over all kinds' branches. */
  countByKindAndUrgency: (today: string) => Promise<AlertCountRow[]>;
};

export class AlertRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertRepositoryError";
  }
}

/** The largest page the repository reads, whatever the caller. */
const MAX_ALERT_PAGE_SIZE = Math.max(...ALERT_PAGE_SIZES);
const MAX_ALERT_PAGE = 1_000_000;
const DATA_INVALID = "CSRM alert data is invalid.";

/** The columns every branch selects, in this order, so the UNION ALL lines them up. */
const ALERT_ROW_COLUMNS = Object.freeze([
  "alerts.kind",
  "alerts.urgency",
  "alerts.urgency_rank",
  "alerts.governing_date",
  "alerts.source_type",
  "alerts.source_document_id",
  "alerts.source_identifier",
  "alerts.source_title",
  "alerts.control_number",
  "alerts.control_name",
  "alerts.link_type",
  "alerts.link_document_id",
  "alerts.residual_rating",
  "alerts.source_released",
] as const);

/*
 * D-12, restating compareAlerts rule for rule: urgency rank, undated after
 * dated, governing date ascending, source identifier, kind, then source
 * documentId. SQLite's default BINARY collation compares text by code unit,
 * as compareAlerts does; the mounted alert test proves the two orders agree.
 */
const ALERT_LIST_ORDER = Object.freeze([
  "alerts.urgency_rank ASC",
  "CASE WHEN alerts.governing_date IS NULL THEN 1 ELSE 0 END ASC",
  "alerts.governing_date ASC",
  "alerts.source_identifier ASC",
  "alerts.kind ASC",
  "alerts.source_document_id ASC",
] as const);

/*
 * source_released: the complete release triple (isReleased) of the assessment
 * the alerting work belongs to, as 1 or 0 (D-27). A Risk and a Control
 * Implementation read their Risk's parent assessment, a request its own
 * assessment, and a review alert the assessment itself.
 */
const RISK_PARENT_RELEASED = `CASE WHEN EXISTS (
  SELECT released_link.id FROM csrm_risks_assessment_lnk AS released_link
  JOIN csrm_assessments AS released_parent ON released_parent.id = released_link.csrm_assessment_id
  WHERE released_link.csrm_risk_id = r.id
    AND released_parent.assessment_status = ?
    AND released_parent.approval_date IS NOT NULL
    AND EXISTS (SELECT released_approver.id FROM csrm_assessments_approved_by_lnk AS released_approver
      WHERE released_approver.csrm_assessment_id = released_parent.id)
) THEN 1 ELSE 0 END AS source_released`;
const REQUEST_ASSESSMENT_RELEASED = `CASE WHEN EXISTS (
  SELECT released_link.id FROM csrm_assessments_assessment_request_lnk AS released_link
  JOIN csrm_assessments AS released_parent ON released_parent.id = released_link.csrm_assessment_id
  WHERE released_link.csrm_assessment_request_id = rq.id
    AND released_parent.assessment_status = ?
    AND released_parent.approval_date IS NOT NULL
    AND EXISTS (SELECT released_approver.id FROM csrm_assessments_approved_by_lnk AS released_approver
      WHERE released_approver.csrm_assessment_id = released_parent.id)
) THEN 1 ELSE 0 END AS source_released`;
const ASSESSMENT_RELEASED = `CASE WHEN a.assessment_status = ?
  AND a.approval_date IS NOT NULL
  AND EXISTS (SELECT released_approver.id FROM csrm_assessments_approved_by_lnk AS released_approver
    WHERE released_approver.csrm_assessment_id = a.id)
THEN 1 ELSE 0 END AS source_released`;

type AlertWindow = { today: string; end: string };

/** What one branch selects, each column named from a constant in this module. */
type BranchColumns = {
  kind: AlertKind;
  /** A fixed urgency, or the review CASE. */
  urgency: AlertUrgency | "review";
  governingDate: string;
  sourceType: AlertSourceType;
  sourceDocumentId: string;
  sourceIdentifier: string;
  sourceTitle: string | null;
  /** Selects the joined control `c`'s number and name. */
  withControl: boolean;
  linkType: AlertLinkType;
  linkDocumentId: string;
  residualRating: string | null;
  released: string;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
 * A typed literal and a column or typed NULL. The CASTs give every branch the
 * same column types, so the union lines up on any dialect. Values are bound
 * parameters; column names and aliases are bound identifiers (`??`).
 */
function text(connection: Knex, value: string, alias: string): Raw {
  return connection.raw("CAST(? AS TEXT) AS ??", [value, alias]);
}

function column(connection: Knex, name: string | null, alias: string): Raw {
  return name === null
    ? connection.raw("CAST(NULL AS TEXT) AS ??", [alias])
    : connection.raw("?? AS ??", [name, alias]);
}

/*
 * The fourteen columns, in ALERT_ROW_COLUMNS order. Every column name and
 * alias used below is a literal of this module, never input.
 */
function selectAlertColumns(connection: Knex, query: QueryBuilder, columns: BranchColumns, window: AlertWindow): QueryBuilder {
  // A review is overdue once its date has passed, and due soon inside the window (alertUrgency).
  const urgency = columns.urgency === "review"
    ? connection.raw(
      "CASE WHEN a.next_review_date < ? THEN CAST(? AS TEXT) ELSE CAST(? AS TEXT) END AS ??",
      [window.today, "overdue", "due-soon", "urgency"],
    )
    : text(connection, columns.urgency, "urgency");
  const urgencyRank = columns.urgency === "review"
    ? connection.raw(
      "CASE WHEN a.next_review_date < ? THEN CAST(? AS INTEGER) ELSE CAST(? AS INTEGER) END AS ??",
      [window.today, ALERT_URGENCY_RANK.overdue, ALERT_URGENCY_RANK["due-soon"], "urgency_rank"],
    )
    : connection.raw("CAST(? AS INTEGER) AS ??", [ALERT_URGENCY_RANK[columns.urgency], "urgency_rank"]);
  return query.select(
    text(connection, columns.kind, "kind"),
    urgency,
    urgencyRank,
    column(connection, columns.governingDate, "governing_date"),
    text(connection, columns.sourceType, "source_type"),
    column(connection, columns.sourceDocumentId, "source_document_id"),
    column(connection, columns.sourceIdentifier, "source_identifier"),
    column(connection, columns.sourceTitle, "source_title"),
    column(connection, columns.withControl ? "c.control_number" : null, "control_number"),
    column(connection, columns.withControl ? "c.name" : null, "control_name"),
    text(connection, columns.linkType, "link_type"),
    column(connection, columns.linkDocumentId, "link_document_id"),
    column(connection, columns.residualRating, "residual_rating"),
    connection.raw(columns.released, ["approved"]),
  );
}

/** An open Risk inside the Risk Register scope. D-04: a closure date closes the treatment. */
function openDisclosableRisks(connection: Knex): QueryBuilder {
  return applyDisclosableParent(connection.queryBuilder().from("csrm_risks as r")).whereNull("r.closure_date");
}

/*
 * A Control Implementation joined to its Risk, which must be open and inside
 * the Risk Register scope (D-14, D-31), and to its control for the title.
 */
function implementationsOnOpenDisclosableRisks(connection: Knex): QueryBuilder {
  const query = connection.queryBuilder().from("csrm_control_implementations as ci")
    .join("csrm_control_implementations_risk_lnk as ci_risk", "ci_risk.csrm_control_implementation_id", "ci.id")
    .join("csrm_risks as r", "r.id", "ci_risk.csrm_risk_id")
    .leftJoin("csrm_control_implementations_control_lnk as ci_control", "ci_control.csrm_control_implementation_id", "ci.id")
    .leftJoin("csrm_controls as c", "c.id", "ci_control.csrm_control_id");
  return applyDisclosableParent(query).whereNull("r.closure_date");
}

/** D-29: only a submitted request that is still in review can alert; a draft never does. */
function reviewableRequests(connection: Knex): QueryBuilder {
  return connection.queryBuilder().from("csrm_assessment_requests as rq")
    .whereIn("rq.request_status", [...REVIEWABLE_REQUEST_STATUSES]);
}

const RISK_SOURCE = {
  sourceType: "risk",
  sourceDocumentId: "r.document_id",
  sourceIdentifier: "r.risk_number",
  sourceTitle: "r.risk_statement",
  withControl: false,
  linkType: "risk",
  linkDocumentId: "r.document_id",
  residualRating: "r.residual_rating",
  released: RISK_PARENT_RELEASED,
} as const;

const CONTROL_IMPLEMENTATION_SOURCE = {
  sourceType: "control-implementation",
  sourceDocumentId: "ci.document_id",
  sourceIdentifier: "r.risk_number",
  // The title joins the control number and name in projectAlertRow, so no
  // dialect-specific concatenation is needed here.
  sourceTitle: null,
  withControl: true,
  linkType: "risk",
  linkDocumentId: "r.document_id",
  residualRating: "r.residual_rating",
  released: RISK_PARENT_RELEASED,
} as const;

const REQUEST_SOURCE = {
  sourceType: "assessment-request",
  sourceDocumentId: "rq.document_id",
  sourceIdentifier: "rq.request_number",
  sourceTitle: "rq.title",
  withControl: false,
  linkType: "assessment-request",
  linkDocumentId: "rq.document_id",
  residualRating: null,
  released: REQUEST_ASSESSMENT_RELEASED,
} as const;

type BranchBuilder = (connection: Knex, window: AlertWindow) => QueryBuilder;

/** One branch per kind (D-10). A NULL treatment status is never dropped by a bare `<>` (D-31). */
const ALERT_BRANCHES: Readonly<Record<AlertKind, BranchBuilder>> = Object.freeze({
  "risk-treatment-overdue": (connection, window) => selectAlertColumns(
    connection,
    openDisclosableRisks(connection)
      .whereRaw("(r.treatment_status IS NULL OR r.treatment_status <> ?)", ["Complete"])
      .where("r.target_date", "<", window.today),
    { ...RISK_SOURCE, kind: "risk-treatment-overdue", urgency: "overdue", governingDate: "r.target_date" },
    window,
  ),
  "risk-treatment-due-soon": (connection, window) => selectAlertColumns(
    connection,
    openDisclosableRisks(connection)
      .whereRaw("(r.treatment_status IS NULL OR r.treatment_status <> ?)", ["Complete"])
      .whereBetween("r.target_date", [window.today, window.end]),
    { ...RISK_SOURCE, kind: "risk-treatment-due-soon", urgency: "due-soon", governingDate: "r.target_date" },
    window,
  ),
  "request-overdue": (connection, window) => selectAlertColumns(
    connection,
    reviewableRequests(connection).where("rq.due_date", "<", window.today),
    { ...REQUEST_SOURCE, kind: "request-overdue", urgency: "overdue", governingDate: "rq.due_date" },
    window,
  ),
  "request-due-soon": (connection, window) => selectAlertColumns(
    connection,
    reviewableRequests(connection).whereBetween("rq.due_date", [window.today, window.end]),
    { ...REQUEST_SOURCE, kind: "request-due-soon", urgency: "due-soon", governingDate: "rq.due_date" },
    window,
  ),
  "control-implementation-overdue": (connection, window) => selectAlertColumns(
    connection,
    implementationsOnOpenDisclosableRisks(connection)
      .where("ci.control_status", "Planned")
      .where("ci.implementation_due_date", "<", window.today),
    {
      ...CONTROL_IMPLEMENTATION_SOURCE,
      kind: "control-implementation-overdue",
      urgency: "overdue",
      governingDate: "ci.implementation_due_date",
    },
    window,
  ),
  // A released assessment whose next review date has passed or falls inside the window.
  "assessment-review-due": (connection, window) => selectAlertColumns(
    connection,
    connection.queryBuilder().from("csrm_assessments as a")
      .leftJoin("csrm_assessments_assessment_request_lnk as a_request", "a_request.csrm_assessment_id", "a.id")
      .leftJoin("csrm_assessment_requests as aq", "aq.id", "a_request.csrm_assessment_request_id")
      .where("a.assessment_status", "approved")
      .whereNotNull("a.approval_date")
      .whereExists((approver) => {
        approver.from("csrm_assessments_approved_by_lnk as a_approver")
          .whereRaw("a_approver.csrm_assessment_id = a.id")
          .select("a_approver.id");
      })
      .where("a.next_review_date", "<=", window.end),
    {
      kind: "assessment-review-due",
      urgency: "review",
      governingDate: "a.next_review_date",
      sourceType: "assessment",
      sourceDocumentId: "a.document_id",
      sourceIdentifier: "a.assessment_number",
      sourceTitle: "aq.title",
      withControl: false,
      linkType: "assessment",
      linkDocumentId: "a.document_id",
      residualRating: null,
      released: ASSESSMENT_RELEASED,
    },
    window,
  ),
  // D-31: a NULL treatment status records no treatment, so it is untreated.
  "critical-residual-risk-untreated": (connection, window) => selectAlertColumns(
    connection,
    openDisclosableRisks(connection)
      .where("r.residual_rating", "Critical")
      .whereRaw("(r.treatment_status IS NULL OR r.treatment_status = ?)", ["Not Started"]),
    { ...RISK_SOURCE, kind: "critical-residual-risk-untreated", urgency: "attention", governingDate: "r.identified_date" },
    window,
  ),
  "ineffective-control": (connection, window) => selectAlertColumns(
    connection,
    implementationsOnOpenDisclosableRisks(connection).where("ci.effectiveness_rating", "Ineffective"),
    { ...CONTROL_IMPLEMENTATION_SOURCE, kind: "ineffective-control", urgency: "attention", governingDate: "ci.review_date" },
    window,
  ),
});

function alertWindow(today: string): AlertWindow {
  if (!isUtcDate(today)) throw new AlertRepositoryError("CSRM alert date is invalid.");
  return { today, end: addUtcDays(today, ALERT_DUE_SOON_WINDOW_DAYS) };
}

function assertKinds(kinds: readonly AlertKind[]): void {
  const known: ReadonlySet<string> = new Set(ALERT_KINDS);
  if (kinds.length < 1 || new Set(kinds).size !== kinds.length || kinds.some((kind) => !known.has(kind))) {
    throw new AlertRepositoryError("CSRM alert kinds are invalid.");
  }
}

function assertUrgency(urgency: AlertUrgency | undefined): void {
  if (urgency !== undefined && !(ALERT_URGENCIES as readonly string[]).includes(urgency)) {
    throw new AlertRepositoryError("CSRM alert urgency is invalid.");
  }
}

/** The selected kinds' branches as one derived table, `alerts`, narrowed to one urgency when asked. */
function alertsTable(connection: Knex, kinds: readonly AlertKind[], urgency: AlertUrgency | undefined, window: AlertWindow): QueryBuilder {
  assertKinds(kinds);
  assertUrgency(urgency);
  const branches = kinds.map((kind) => ALERT_BRANCHES[kind](connection, window));
  const alerts = connection.queryBuilder().from(connection.queryBuilder().unionAll(branches, false).as("alerts"));
  if (urgency !== undefined) alerts.where("alerts.urgency", urgency);
  return alerts;
}

/** PostgreSQL returns COUNT as a string, so every count is read through Number() and must be whole. */
function wholeCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new AlertRepositoryError(DATA_INVALID);
  return count;
}

function closedMember<const T extends readonly string[]>(allowed: T, value: unknown): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new AlertRepositoryError(DATA_INVALID);
  return value as T[number];
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new AlertRepositoryError(DATA_INVALID);
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isUtcDate(value)) throw new AlertRepositoryError(DATA_INVALID);
  return value;
}

function releasedFlag(value: unknown): boolean {
  if (value === 1 || value === "1" || value === true) return true;
  if (value === 0 || value === "0" || value === false) return false;
  throw new AlertRepositoryError(DATA_INVALID);
}

function sourceTitle(sourceType: AlertSourceType, row: RecordValue): string | null {
  if (sourceType !== "control-implementation") return optionalText(row.source_title);
  const number = optionalText(row.control_number);
  const name = optionalText(row.control_name);
  return number !== null && name !== null ? `${number} ${name}` : null;
}

/**
 * One served alert from one row of the derived table. `today` is the date the
 * row was derived on, so the day offset agrees with the window that selected it.
 */
export function projectAlertRow(row: RecordValue, today: string): AlertItem {
  const kind = closedMember(ALERT_KINDS, row.kind);
  const sourceType = closedMember(ALERT_SOURCE_TYPES, row.source_type);
  const sourceDocumentId = requiredText(row.source_document_id);
  const governingDate = optionalDate(row.governing_date);
  return {
    id: alertId(kind, sourceDocumentId),
    kind,
    urgency: closedMember(ALERT_URGENCIES, row.urgency),
    governingDate,
    dayOffset: alertDayOffset(governingDate, today),
    source: {
      type: sourceType,
      documentId: sourceDocumentId,
      identifier: requiredText(row.source_identifier),
      title: sourceTitle(sourceType, row),
      released: releasedFlag(row.source_released),
    },
    link: { type: closedMember(ALERT_LINK_TYPES, row.link_type), documentId: requiredText(row.link_document_id) },
    residualRating: normaliseRating(row.residual_rating),
  };
}

/** The closed summary: every kind and urgency present, zero when nothing alerts. */
export function summariseAlertCounts(rows: readonly AlertCountRow[]): AlertCounts {
  const byKind = Object.fromEntries(ALERT_KINDS.map((kind) => [kind, 0])) as Record<AlertKind, number>;
  const byUrgency = Object.fromEntries(ALERT_URGENCIES.map((urgency) => [urgency, 0])) as Record<AlertUrgency, number>;
  let total = 0;
  for (const row of rows) {
    const kind = closedMember(ALERT_KINDS, row.kind);
    const urgency = closedMember(ALERT_URGENCIES, row.urgency);
    const count = wholeCount(row.total);
    byKind[kind] += count;
    byUrgency[urgency] += count;
    total += count;
  }
  return { byKind, byUrgency, total };
}

export function createAlertRepository(strapi: unknown): AlertRepository {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function") {
    throw new AlertRepositoryError("CSRM alert repository is unavailable.");
  }
  const connection = strapi.db.connection as Knex;
  return {
    async listPage({ kinds, urgency, page, pageSize, today }) {
      if (!Number.isSafeInteger(page) || page < 1 || page > MAX_ALERT_PAGE
        || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_ALERT_PAGE_SIZE) {
        throw new AlertRepositoryError("CSRM alert page is invalid.");
      }
      const query = alertsTable(connection, kinds, urgency, alertWindow(today)).select([...ALERT_ROW_COLUMNS]);
      for (const fragment of ALERT_LIST_ORDER) query.orderByRaw(fragment);
      return await query.limit(pageSize).offset((page - 1) * pageSize) as RecordValue[];
    },
    async count({ kinds, urgency, today }) {
      const row = await alertsTable(connection, kinds, urgency, alertWindow(today))
        .count({ total: "*" })
        .first() as RecordValue | undefined;
      return wholeCount(row?.total ?? 0);
    },
    async countByKindAndUrgency(today) {
      const rows = await alertsTable(connection, ALERT_KINDS, undefined, alertWindow(today))
        .select("alerts.kind", "alerts.urgency")
        .count({ total: "*" })
        .groupBy("alerts.kind", "alerts.urgency") as RecordValue[];
      return rows.map((row) => ({
        kind: closedMember(ALERT_KINDS, row.kind),
        urgency: closedMember(ALERT_URGENCIES, row.urgency),
        total: wholeCount(row.total),
      }));
    },
  };
}

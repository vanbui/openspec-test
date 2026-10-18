import { ALERT_DUE_SOON_WINDOW_DAYS } from "../../../csrm/insights/insight-constants";
import {
  applyTreatmentDueStatePredicate,
  deriveTreatmentDueState,
  type TreatmentDueState,
} from "../../../csrm/insights/treatment-due-state";
import { isUtcDate } from "../../../csrm/insights/utc-date";
import { activeRiskSql, isActiveRisk, withdrawnRiskSql } from "../../../csrm/active-risk";
import { projectRiskWithdrawal } from "../../csrm-assessment/services/assessment-scope";
import { isReleased } from "../../csrm-assessment/services/assessment-workflow";
import {
  parseRiskRegisterQuery,
  RISK_REGISTER_EFFECTIVENESS_RATINGS,
  RISK_REGISTER_RATINGS,
  RISK_REGISTER_TREATMENT_ACTIONS,
  RISK_REGISTER_TREATMENT_STATUSES,
  type RiskRegisterFilters,
  type RiskRegisterSort,
} from "./risk-register-query";

type RecordValue = Record<string, unknown>;
type QueryBuilder = {
  clone: () => QueryBuilder;
  countDistinct: (value: RecordValue) => QueryBuilder;
  first: () => Promise<RecordValue | undefined>;
  leftJoin: (table: string, left: string, right: string) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  offset: (value: number) => QueryBuilder;
  orderBy: (column: string, direction: "asc" | "desc") => QueryBuilder;
  orderByRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  select: (column: string) => QueryBuilder;
  where: ((column: string, value: unknown) => QueryBuilder)
    & ((column: string, operator: string, value: unknown) => QueryBuilder)
    & ((callback: (query: QueryBuilder) => void) => QueryBuilder);
  orWhere: ((column: string, value: unknown) => QueryBuilder)
    & ((column: string, operator: string, value: unknown) => QueryBuilder)
    & ((callback: (query: QueryBuilder) => void) => QueryBuilder);
  orWhereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  whereExists: (callback: (query: QueryBuilder) => void) => QueryBuilder;
  whereNotExists: (callback: (query: QueryBuilder) => void) => QueryBuilder;
  whereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  from: (table: string) => QueryBuilder;
  then: Promise<RecordValue[]>["then"];
};
type Connection = ((table: string) => QueryBuilder) & { raw: (sql: string, bindings?: unknown[]) => unknown };

/**
 * The branch of the register's scope a Risk is in (D-40, D-44): released when its parent assessment
 * carries the complete release facts, under assessment when the parent is a draft or in review with
 * none. Every listed Risk is in exactly one.
 */
export type RiskRegisterStage = "released" | "under-assessment";

export type RiskRegisterItem = {
  documentId: string;
  riskNumber: string;
  riskStatement: string | null;
  inherentRating: string | null;
  residualRating: string | null;
  treatmentStatus: string | null;
  treatmentOwner: { documentId: string; displayName: string } | null;
  targetDate: string | null;
  /** Derived on read by the single D-04 rule (D-26); the stored "Overdue" status is never read. */
  treatmentDueState: TreatmentDueState;
  assessment: { documentId: string; assessmentNumber: string; title: string };
  stage: RiskRegisterStage;
  /** The recorded JDL treatment action (D-44); "accepted" is a released, open Risk with Accept, decided by the reader. */
  treatmentAction: typeof RISK_REGISTER_TREATMENT_ACTIONS[number] | null;
  /** D-41: released, open, and Accept; computed here so a closed Risk is never marked Accepted. */
  accepted: boolean;
};

/**
 * The relations an export may add to a hydrated row (19-04; D-06): only the ones its chosen columns read. The list
 * never asks for them, so a list row is hydrated exactly as before.
 */
export const RISK_REGISTER_HYDRATE_RELATIONS = ["riskOwner", "riskType", "informationSystemImpacted", "informationAssetImpacted"] as const;
export type RiskRegisterHydrateRelation = typeof RISK_REGISTER_HYDRATE_RELATIONS[number];

/**
 * The count and the page read one parsed filter model and the list's `today`, the UTC calendar date the
 * dueState filter is evaluated on (G-16), so the total always equals the rows it pages.
 */
export type RiskRegisterRepository = {
  count: (filters: RiskRegisterFilters, today: string) => Promise<number>;
  selectPage: (input: { filters: RiskRegisterFilters; sort: RiskRegisterSort; offset: number; limit: number; today: string }) => Promise<string[]>;
  hydrate: (documentIds: readonly string[], options?: { relations?: readonly RiskRegisterHydrateRelation[] }) => Promise<RecordValue[]>;
  selectedLabels?: (filters: RiskRegisterFilters) => Promise<Record<string, { documentId: string; label: string }>>;
};

export const MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS = 1_000;

export type RiskRegisterDetailRepository = {
  findRisk: (documentId: string) => Promise<RecordValue | null>;
  findControlImplementations: (riskDocumentId: string, limit: number) => Promise<RecordValue[]>;
};

export class RiskRegisterError extends Error {
  constructor(public readonly status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = "RiskRegisterError";
  }
}

const RISK_DETAIL_SCALAR_FIELDS = [
  "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "dataClassification",
  "inherentLikelihood", "highestInherentConsequence", "inherentRating", "inherentRatingRationale", "residualLikelihood",
  "highestResidualConsequence", "residualRating", "residualRatingRationale", "controlEffectiveness", "riskVelocity",
  "identifiedDate", "targetDate", "closureDate", "isExempted", "exemptionReviewDate", "escalationDetails", "comments",
  "riskCommunicationDate", "treatmentAction", "treatmentPlan", "treatmentResolveDate", "treatmentStatus",
] as const;

/** A closed value, or null when it is absent or outside its published vocabulary (CR-101). */
function closedValue<const T extends readonly string[]>(value: unknown, vocabulary: T): T[number] | null {
  return vocabulary.find((candidate) => candidate === value) ?? null;
}

/*
 * CR-101: the detail's closed values and their published vocabularies (RiskDetail). A stored value outside its
 * vocabulary (legacy or directly written data) is served as not provided, as the register row serves it, so a
 * Risk the register lists under "Not rated" or "Not provided" always opens.
 */
const RISK_DETAIL_CLOSED_FIELDS: Readonly<Partial<Record<typeof RISK_DETAIL_SCALAR_FIELDS[number], readonly string[]>>> = {
  dataClassification: ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"],
  inherentRating: RISK_REGISTER_RATINGS,
  residualRating: RISK_REGISTER_RATINGS,
  controlEffectiveness: RISK_REGISTER_EFFECTIVENESS_RATINGS,
  riskVelocity: ["Low", "Moderate", "High", "Very High"],
  treatmentAction: RISK_REGISTER_TREATMENT_ACTIONS,
  treatmentStatus: RISK_REGISTER_TREATMENT_STATUSES,
};
/** The JDL control statuses of a mitigation control (RiskDetailControlImplementation). */
const RISK_CONTROL_STATUSES = ["Existing", "Planned", "Implemented", "Retired"] as const;

type RiskDetailUser = { documentId: string; displayName: string };
type RiskDetailNamedRelation = { documentId: string; name: string };
type RiskDetail = RecordValue & { parentLock: "mutable" | "released"; withdrawal: RecordValue | null };

function detailUnavailable(): never {
  throw new RiskRegisterError(404, "CSRM Risk is not available.");
}

function projectDetailUser(value: unknown): RiskDetailUser | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.displayName !== "string") detailUnavailable();
  return { documentId: value.documentId, displayName: value.displayName };
}

function projectNamedRelation(value: unknown): RiskDetailNamedRelation | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.name !== "string") detailUnavailable();
  return { documentId: value.documentId, name: value.name };
}

function projectRiskType(value: unknown): RecordValue | null {
  const relation = projectNamedRelation(value);
  if (!relation) return null;
  if (!isRecord(value)) detailUnavailable();
  return { ...relation, description: typeof value.description === "string" ? value.description : null };
}

function projectDetailAssessment(value: unknown): RecordValue {
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.assessmentNumber !== "string") detailUnavailable();
  const request = value.assessmentRequest;
  if (!isRecord(request) || typeof request.title !== "string") detailUnavailable();
  return { documentId: value.documentId, assessmentNumber: value.assessmentNumber, title: request.title };
}

/**
 * The populated parent's lock, or null when it is in neither branch of the register's scope: the one
 * reading of the parent facts that both the detail gate and each register row use, and the in-memory
 * twin of the mutableParent and releasedParent SQL below.
 */
function parentLockOf(value: unknown): "mutable" | "released" | null {
  if (!isRecord(value)) return null;
  const hasApprover = value.approvedBy !== null && value.approvedBy !== undefined;
  const hasApprovalDate = value.approvalDate !== null && value.approvalDate !== undefined;
  if (isReleased(value)) return "released";
  if ((value.assessmentStatus === "draft" || value.assessmentStatus === "in-review") && !hasApprover && !hasApprovalDate) return "mutable";
  return null;
}

function parentLock(value: unknown): "mutable" | "released" {
  return parentLockOf(value) ?? detailUnavailable();
}

/**
 * The one method applyDisclosableParent calls on the outer query. Both this
 * module's QueryBuilder and knex's own builder satisfy it, so the alert and
 * report repositories reuse the rule rather than copy it.
 */
export type DisclosableParentQuery = {
  whereExists(callback: (parent: QueryBuilder) => void): unknown;
};

/** The parent's approver link, which the release facts require and a mutable parent must not carry. */
function approverLink(approvedBy: QueryBuilder): void {
  approvedBy.from("csrm_assessments_approved_by_lnk as approval_link")
    .whereRaw("approval_link.csrm_assessment_id = assessment_parent.id")
    .select("approval_link.id");
}

/** Under assessment: a draft or in-review parent with no approval date and no approver. */
function mutableParent(parent: QueryBuilder): void {
  parent.whereRaw("assessment_parent.assessment_status IN (?, ?)", ["draft", "in-review"])
    .whereRaw("assessment_parent.approval_date IS NULL")
    .whereNotExists(approverLink);
}

/** Released: an approved parent with an approval date and an approver. */
function releasedParent(parent: QueryBuilder): void {
  parent.where("assessment_parent.assessment_status", "approved")
    .whereRaw("assessment_parent.approval_date IS NOT NULL")
    .whereExists(approverLink);
}

/** Adds one parent subquery whose parent row must satisfy `eligible`. The outer query aliases csrm_risks as `r`. */
function whereParent<T extends DisclosableParentQuery>(query: T, eligible: (parent: QueryBuilder) => void): T {
  query.whereExists((parent) => {
    parent.from("csrm_risks_assessment_lnk as risk_assessment")
      .leftJoin("csrm_assessments as assessment_parent", "risk_assessment.csrm_assessment_id", "assessment_parent.id")
      .whereRaw("risk_assessment.csrm_risk_id = r.id")
      .where(eligible)
      .select("risk_assessment.id");
  });
  return query;
}

/**
 * The released branch of the register's scope (D-40): the parent assessment is completely released
 * (approved, an approval date and an approver). The outer query must alias csrm_risks as `r`.
 */
export function applyReleasedParent<T extends DisclosableParentQuery>(query: T): T {
  return whereParent(query, releasedParent);
}

/**
 * The under-assessment branch of the register's scope (D-40): the parent assessment is mutable (draft
 * or in review, with no approval facts). The outer query must alias csrm_risks as `r`.
 */
export function applyUnderAssessmentParent<T extends DisclosableParentQuery>(query: T): T {
  return whereParent(query, mutableParent);
}

/**
 * Keep list disclosure identical to the fail-closed detail parent gate. A Risk
 * is disclosable when its parent assessment is mutable (draft or in review,
 * with no approval facts) or completely released (approved, an approval date
 * and an approver): exactly the union of applyUnderAssessmentParent and
 * applyReleasedParent, built from the same two branch bodies, so a stage filter
 * only ever narrows this scope and no Risk leaves the register. A parent with
 * part of the release facts is in neither branch. The outer query must alias
 * csrm_risks as `r`.
 */
export function applyDisclosableParent<T extends DisclosableParentQuery>(query: T): T {
  return whereParent(query, (eligible) => {
    eligible.where(mutableParent).orWhere(releasedParent);
  });
}

/**
 * The one method the active-risk helpers call on the outer query. Both this module's QueryBuilder and knex's own
 * builder satisfy it, so the insight repositories apply the rule beside applyDisclosableParent.
 */
export type ActiveRiskQuery = {
  whereRaw(sql: string, bindings?: unknown[]): unknown;
};

/**
 * Phase 16 D-13: the SQL form of the one active-risk rule (active-risk.ts), beside the disclosure predicate and
 * never folded into it, so the register's Withdrawn filter can still reach withdrawn rows. Every reader that lists,
 * counts or rates Risks from `csrm_risks as r` applies it. The outer query must alias csrm_risks as `r`.
 */
export function applyActiveRisk<T extends ActiveRiskQuery>(query: T): T {
  query.whereRaw(activeRiskSql("r"));
  return query;
}

/**
 * Phase 16 D-08: withdrawn Risks only, the register's explicit Withdrawn filter and nothing else. The outer query
 * must alias csrm_risks as `r`.
 */
export function applyWithdrawnRisk<T extends ActiveRiskQuery>(query: T): T {
  query.whereRaw(withdrawnRiskSql("r"));
  return query;
}

function projectControlImplementation(document: RecordValue): RecordValue {
  if (typeof document.documentId !== "string" || !isRecord(document.control)
    || typeof document.control.documentId !== "string" || typeof document.control.controlNumber !== "string"
    || typeof document.control.name !== "string") detailUnavailable();
  return {
    documentId: document.documentId,
    control: {
      documentId: document.control.documentId,
      controlNumber: document.control.controlNumber,
      name: document.control.name,
    },
    controlOwner: projectDetailUser(document.controlOwner),
    controlStatus: closedValue(document.controlStatus, RISK_CONTROL_STATUSES),
    effectivenessRating: closedValue(document.effectivenessRating, RISK_REGISTER_EFFECTIVENESS_RATINGS),
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}

function projectRiskRegisterDetail(document: RecordValue, implementations: RecordValue[]): RiskDetail {
  if (typeof document.documentId !== "string" || typeof document.riskNumber !== "string") detailUnavailable();
  const result: RiskDetail = {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    parentLock: parentLock(document.assessment),
    // Phase 16 D-45, D-03 item 9: who withdrew the Risk, when and why, exactly as the analyst detail serves it.
    withdrawal: projectRiskWithdrawal(document),
  };
  for (const field of RISK_DETAIL_SCALAR_FIELDS) {
    const vocabulary = RISK_DETAIL_CLOSED_FIELDS[field];
    result[field] = vocabulary ? closedValue(document[field], vocabulary) : document[field] ?? null;
  }
  result.riskType = projectRiskType(document.riskType);
  result.riskOwner = projectDetailUser(document.riskOwner);
  result.treatmentOwner = projectDetailUser(document.treatmentOwner);
  result.informationSystemImpacted = projectNamedRelation(document.informationSystemImpacted);
  result.informationAssetImpacted = projectNamedRelation(document.informationAssetImpacted);
  result.assessment = projectDetailAssessment(document.assessment);
  result.controlImplementations = implementations.map(projectControlImplementation);
  return result;
}

export async function getRiskRegisterDetail(input: {
  repository: RiskRegisterDetailRepository;
  state: unknown;
  riskDocumentId: string;
}): Promise<RiskDetail> {
  assertRiskRegisterScope(input.state);
  if (input.riskDocumentId.length === 0) detailUnavailable();
  const risk = await input.repository.findRisk(input.riskDocumentId);
  if (!risk) detailUnavailable();
  const implementations = await input.repository.findControlImplementations(
    input.riskDocumentId,
    MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS + 1,
  );
  if (implementations.length > MAX_RISK_DETAIL_CONTROL_IMPLEMENTATIONS) detailUnavailable();
  return projectRiskRegisterDetail(risk, implementations);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRiskRegisterScope(state: unknown): void {
  if (!isRecord(state)
    || !isRecord(state.csrmAuthorization)
    || state.csrmAuthorization.riskRegisterCollectionScope !== "all") {
    throw new RiskRegisterError(403, "CSRM Risk Register access is denied.");
  }
}

function projectUser(value: unknown): RiskRegisterItem["treatmentOwner"] {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.displayName !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  return { documentId: value.documentId, displayName: value.displayName };
}

function projectAssessment(value: unknown): RiskRegisterItem["assessment"] {
  if (!isRecord(value) || typeof value.documentId !== "string" || typeof value.assessmentNumber !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  const request = value.assessmentRequest;
  if (!isRecord(request) || typeof request.title !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  return { documentId: value.documentId, assessmentNumber: value.assessmentNumber, title: request.title };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * The recorded treatment action, or null when none is recorded (CR-101, WR-103). A stored value outside the JDL
 * enumeration (legacy or directly written data) is served as none recorded, as an off-vocabulary rating or
 * treatment status is, so the row stays inside the published contract and never fails its page.
 */
function projectTreatmentAction(value: unknown): RiskRegisterItem["treatmentAction"] {
  return closedValue(value, RISK_REGISTER_TREATMENT_ACTIONS);
}

/** The row's stage, read from its populated parent as the detail gate reads it; a parent in neither branch is never listed. */
function projectStage(value: unknown): RiskRegisterStage {
  const lock = parentLockOf(value);
  if (lock === null) throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  return lock === "released" ? "released" : "under-assessment";
}

/**
 * One register row. `today` is the caller's UTC calendar date: the treatment
 * due state is evaluated on it and never on a clock read here (D-02). The
 * closure date is read to derive that state but is not disclosed on the row.
 */
export function projectRiskRegisterItem(document: RecordValue, today: string): RiskRegisterItem {
  if (typeof document.documentId !== "string" || typeof document.riskNumber !== "string") {
    throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  }
  const treatmentStatus = stringOrNull(document.treatmentStatus);
  const targetDate = stringOrNull(document.targetDate);
  const stage = projectStage(document.assessment);
  const treatmentAction = projectTreatmentAction(document.treatmentAction);
  return {
    documentId: document.documentId,
    riskNumber: document.riskNumber,
    riskStatement: stringOrNull(document.riskStatement),
    // Legacy values selected by the "none" filters have no published rating/status.
    inherentRating: RISK_REGISTER_RATINGS.find((rating) => rating === document.inherentRating) ?? null,
    residualRating: RISK_REGISTER_RATINGS.find((rating) => rating === document.residualRating) ?? null,
    treatmentStatus: RISK_REGISTER_TREATMENT_STATUSES.find((status) => status === treatmentStatus) ?? null,
    treatmentOwner: projectUser(document.treatmentOwner),
    targetDate,
    treatmentDueState: deriveTreatmentDueState(
      { targetDate, treatmentStatus, closureDate: stringOrNull(document.closureDate) },
      today,
    ),
    assessment: projectAssessment(document.assessment),
    stage,
    treatmentAction,
    // "A released, open Risk": Phase 16 made open an active Risk with no closure date, so a withdrawn one is never accepted.
    accepted: isActiveRisk(document) && stage === "released" && treatmentAction === "Accept" && !document.closureDate,
  };
}

export async function listRiskRegister(input: {
  repository: RiskRegisterRepository;
  state: unknown;
  query: unknown;
  /** The UTC calendar date (YYYY-MM-DD) every row's treatment due state is evaluated on. */
  today: string;
}): Promise<{
  data: RiskRegisterItem[];
  meta: {
    pagination: { page: number; pageSize: number; pageCount: number; total: number };
    selectedLabels: Record<string, { documentId: string; label: string }>;
  };
}> {
  assertRiskRegisterScope(input.state);
  const { today } = input;
  if (!isUtcDate(today)) throw new RiskRegisterError(400, "CSRM Risk Register date is invalid.");
  const parsed = parseRiskRegisterQuery(input.query);
  const [total, ids, selectedLabels] = await Promise.all([
    input.repository.count(parsed.filters, today),
    input.repository.selectPage({
      filters: parsed.filters,
      sort: parsed.sort,
      offset: (parsed.page - 1) * parsed.pageSize,
      limit: parsed.pageSize,
      today,
    }),
    input.repository.selectedLabels?.(parsed.filters) ?? {},
  ]);
  const documents = ids.length > 0 ? await input.repository.hydrate(ids) : [];
  const byId = new Map(documents.map((document) => [document.documentId, document]));
  const ordered = ids.map((id) => byId.get(id)).filter((document): document is RecordValue => document !== undefined);
  if (ordered.length !== ids.length) throw new RiskRegisterError(400, "CSRM Risk Register data is invalid.");
  return {
    data: ordered.map((document) => projectRiskRegisterItem(document, today)),
    meta: {
      pagination: { page: parsed.page, pageSize: parsed.pageSize, pageCount: Math.ceil(total / parsed.pageSize), total },
      selectedLabels,
    },
  };
}

/** D-32, X-4: `{assessment number} · {request title}`, or the number alone when its request has no title. */
function assessmentLabel(assessment: RecordValue): string {
  const number = assessment.assessmentNumber as string;
  const request = assessment.assessmentRequest;
  const title = isRecord(request) && typeof request.title === "string" ? request.title.trim() : "";
  return title ? `${number} · ${title}` : number;
}

function relationExists(query: QueryBuilder, table: string, targetTable: string, foreignColumn: string, documentId: string): void {
  query.from(`${table} as link`)
    .leftJoin(`${targetTable} as target`, `link.${foreignColumn}`, "target.id")
    .whereRaw("link.csrm_risk_id = r.id")
    .where("target.document_id", documentId)
    .select("link.id");
}

/** Four bound placeholders, for a NOT IN over one of the four-value vocabularies below. */
const FOUR_VALUES = "(?, ?, ?, ?)";

/** The mitigation controls of the outer Risk, joined to their implementation rows. */
function implementationsOfRisk(nested: QueryBuilder): QueryBuilder {
  return nested.from("csrm_control_implementations_risk_lnk as implementation_link")
    .leftJoin("csrm_control_implementations as implementation", "implementation_link.csrm_control_implementation_id", "implementation.id")
    .whereRaw("implementation_link.csrm_risk_id = r.id")
    .select("implementation_link.id");
}

function applyFilters(query: QueryBuilder, filters: RiskRegisterFilters, today: string): QueryBuilder {
  applyDisclosableParent(query);
  // D-40: a stage narrows the scope above to one of its two branches; the branch is chosen from the
  // parsed closed enum, so no request value reaches the SQL.
  if (filters.stage === "released") applyReleasedParent(query);
  else if (filters.stage === "under-assessment") applyUnderAssessmentParent(query);
  if (filters.q) {
    const escaped = `%${filters.q.toLocaleLowerCase("en-AU").replace(/[!%_]/g, "!$&")}%`;
    query.where((nested) => {
      nested.whereRaw("LOWER(r.risk_number) LIKE ? ESCAPE '!'", [escaped])
        .orWhereRaw("LOWER(r.risk_statement) LIKE ? ESCAPE '!'", [escaped]);
    });
  }
  /*
   * D-35, research Pitfall 11: "none" is a value null or off its vocabulary, exactly the reports' notProvided and
   * notRated, so a figure linking here equals its list. Each column is a constant chosen by the parsed key, and
   * the vocabulary binds as parameters.
   */
  if (filters.treatmentStatus === "none") {
    query.whereRaw(`(r.treatment_status IS NULL OR r.treatment_status NOT IN ${FOUR_VALUES})`, [...RISK_REGISTER_TREATMENT_STATUSES]);
  } else if (filters.treatmentStatus) query.where("r.treatment_status", filters.treatmentStatus);
  // D-44: a bound value from the parsed closed enum (Accept or Treat).
  if (filters.treatmentAction) query.where("r.treatment_action", filters.treatmentAction);
  for (const [rating, column] of [
    [filters.inherentRating, "r.inherent_rating"],
    [filters.residualRating, "r.residual_rating"],
  ] as const) {
    if (rating === "none") query.whereRaw(`(${column} IS NULL OR ${column} NOT IN ${FOUR_VALUES})`, [...RISK_REGISTER_RATINGS]);
    else if (rating) query.where(column, rating);
  }
  if (filters.targetDateFrom) query.where("r.target_date", ">=", filters.targetDateFrom);
  if (filters.targetDateTo) query.where("r.target_date", "<=", filters.targetDateTo);
  // D-36: a Risk is closed exactly when a closure date is recorded. Both fragments
  // are constants chosen from the parsed closed enum; no request value reaches the SQL.
  if (filters.state === "open") query.whereRaw("r.closure_date IS NULL");
  else if (filters.state === "closed") query.whereRaw("r.closure_date IS NOT NULL");
  // D-35, D-38, G-16: the one due-state rule in SQL, on the list's today with the 14-day window, so each
  // row's treatmentDueState and this filter can never disagree. Phase 20 switches its date there.
  if (filters.dueState) {
    applyTreatmentDueStatePredicate(query, filters.dueState, { today, windowDays: ALERT_DUE_SOON_WINDOW_DAYS });
  }
  const relations = [
    [filters.riskOwner, "csrm_risks_risk_owner_lnk", "idambox_users", "idambox_user_id"],
    [filters.treatmentOwner, "csrm_risks_treatment_owner_lnk", "idambox_users", "idambox_user_id"],
    [filters.assessment, "csrm_risks_assessment_lnk", "csrm_assessments", "csrm_assessment_id"],
    [filters.system, "csrm_risks_information_system_impacted_lnk", "csrm_information_systems", "csrm_information_system_id"],
    [filters.asset, "csrm_risks_information_asset_impacted_lnk", "csrm_information_assets", "csrm_information_asset_id"],
  ] as const;
  for (const [documentId, table, target, foreign] of relations) {
    if (documentId) query.whereExists((nested) => relationExists(nested, table, target, foreign, documentId));
  }
  // D-35, research Pitfall 21: no impacted Information System, read as the report reads risksWithoutSystem.
  if (filters.impactedSystem === "none") {
    query.whereNotExists((nested) => {
      nested.from("csrm_risks_information_system_impacted_lnk as system_link")
        .leftJoin("csrm_information_systems as impacted_system", "system_link.csrm_information_system_id", "impacted_system.id")
        .whereRaw("system_link.csrm_risk_id = r.id")
        .whereRaw("impacted_system.id IS NOT NULL")
        .select("system_link.id");
    });
  }
  if (filters.mitigationStatus === "none") {
    query.whereNotExists((nested) => {
      nested.from("csrm_control_implementations_risk_lnk as implementation_link")
        .whereRaw("implementation_link.csrm_risk_id = r.id")
        .select("implementation_link.id");
    });
  } else if (filters.mitigationStatus === "any") {
    // D-35: at least one mitigation control, whatever its status; EXISTS lists a Risk once however many it has.
    query.whereExists((nested) => { implementationsOfRisk(nested).whereRaw("implementation.id IS NOT NULL"); });
  } else if (filters.mitigationStatus) {
    const status = filters.mitigationStatus;
    query.whereExists((nested) => { implementationsOfRisk(nested).where("implementation.control_status", status); });
  }
  // D-35: a mitigation control of this effectiveness; "none", one whose rating is null or off the JDL vocabulary.
  if (filters.mitigationEffectiveness === "none") {
    query.whereExists((nested) => {
      implementationsOfRisk(nested)
        .whereRaw("implementation.id IS NOT NULL")
        .whereRaw(`(implementation.effectiveness_rating IS NULL OR implementation.effectiveness_rating NOT IN ${FOUR_VALUES})`, [...RISK_REGISTER_EFFECTIVENESS_RATINGS]);
    });
  } else if (filters.mitigationEffectiveness) {
    const rating = filters.mitigationEffectiveness;
    query.whereExists((nested) => { implementationsOfRisk(nested).where("implementation.effectiveness_rating", rating); });
  }
  return query;
}

/*
 * Phase 16 D-08, D-13: the register's one base query. Withdrawn Risks leave its default view and its open and closed
 * values; only the explicit withdrawn value lists them. The count and the page both start here, so a total always
 * equals the rows it pages, and the branch is chosen from the parsed closed enum.
 */
function registerQuery(connection: Connection, filters: RiskRegisterFilters, today: string): QueryBuilder {
  const table = connection("csrm_risks as r");
  return applyFilters(filters.state === "withdrawn" ? applyWithdrawnRisk(table) : applyActiveRisk(table), filters, today);
}

function orderedQuery(connection: Connection, filters: RiskRegisterFilters, sort: RiskRegisterSort, today: string): QueryBuilder {
  const query = registerQuery(connection, filters, today);
  const direction = sort.direction;
  if (sort.field === "treatmentOwner") {
    query.leftJoin("csrm_risks_treatment_owner_lnk as treatment_owner_link", "r.id", "treatment_owner_link.csrm_risk_id")
      .leftJoin("idambox_users as treatment_owner", "treatment_owner_link.idambox_user_id", "treatment_owner.id");
    query.orderByRaw("CASE WHEN treatment_owner.display_name IS NULL THEN 1 ELSE 0 END ASC")
      .orderBy("treatment_owner.display_name", direction);
  } else if (sort.field === "assessment") {
    query.leftJoin("csrm_risks_assessment_lnk as assessment_link", "r.id", "assessment_link.csrm_risk_id")
      .leftJoin("csrm_assessments as assessment", "assessment_link.csrm_assessment_id", "assessment.id")
      .orderBy("assessment.assessment_number", direction);
  } else if (sort.field === "inherentRating" || sort.field === "residualRating") {
    const column = sort.field === "inherentRating" ? "r.inherent_rating" : "r.residual_rating";
    /*
     * The severity ladder, Low to Critical, in the sort's direction. A Risk with no rating, or one
     * off the ladder, follows every rated Risk in both directions, as an undated Risk does in the
     * target-date sort, so a descending sort leads with Critical. The column comes from the closed
     * sort field and the direction from its parsed enum; both fragments are otherwise constant.
     */
    query.orderByRaw(`CASE WHEN ${column} IN ('Low', 'Moderate', 'High', 'Critical') THEN 0 ELSE 1 END ASC`)
      .orderByRaw(`CASE ${column} WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END ${direction}`);
  } else if (sort.field === "targetDate") {
    query.orderByRaw("CASE WHEN r.target_date IS NULL THEN 1 ELSE 0 END ASC")
      .orderBy("r.target_date", direction);
  } else {
    const columns = {
      riskNumber: "r.risk_number",
      riskStatement: "r.risk_statement",
      treatmentStatus: "r.treatment_status",
    } as const;
    query.orderBy(columns[sort.field as keyof typeof columns], direction);
  }
  return query.orderBy("r.risk_number", "asc");
}

/** The populate entries of the relations an export's chosen columns read, each with only its display fields. */
function exportRelations(relations: readonly RiskRegisterHydrateRelation[]): RecordValue {
  const fields: Record<RiskRegisterHydrateRelation, RecordValue> = {
    riskOwner: { fields: ["documentId", "displayName"] },
    riskType: { fields: ["documentId", "name"] },
    informationSystemImpacted: { fields: ["documentId", "name"] },
    informationAssetImpacted: { fields: ["documentId", "name"] },
  };
  const populate: RecordValue = {};
  for (const relation of relations) {
    if (RISK_REGISTER_HYDRATE_RELATIONS.includes(relation)) populate[relation] = fields[relation];
  }
  return populate;
}

export function createStrapiRiskRegisterRepository(strapi: unknown): RiskRegisterRepository & RiskRegisterDetailRepository {
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function"
    || typeof strapi.documents !== "function") {
    throw new RiskRegisterError(400, "CSRM Risk Register repository is unavailable.");
  }
  const connection = strapi.db.connection as Connection;
  const documentsFor = strapi.documents as (uid: string) => {
    findOne?: (query: RecordValue) => Promise<RecordValue | null>;
    findMany: (query: RecordValue) => Promise<RecordValue[]>;
  };
  const documents = documentsFor("api::csrm-risk.csrm-risk");
  const controlImplementations = documentsFor("api::csrm-control-implementation.csrm-control-implementation");
  return {
    async findRisk(documentId) {
      if (typeof documents.findOne !== "function") throw new RiskRegisterError(400, "CSRM Risk Register repository is unavailable.");
      return documents.findOne({
        documentId,
        populate: {
          riskType: true,
          riskOwner: true,
          treatmentOwner: true,
          informationSystemImpacted: true,
          informationAssetImpacted: true,
          assessment: { populate: { approvedBy: true, assessmentRequest: true } },
          // Phase 16 D-45: the withdrawing analyst, named in the detail's withdrawal block.
          withdrawnBy: { fields: ["documentId", "displayName"] },
        },
      });
    },
    async findControlImplementations(riskDocumentId, limit) {
      return controlImplementations.findMany({
        filters: { risk: { documentId: { $eq: riskDocumentId } } },
        populate: { control: true, controlOwner: true },
        sort: ["createdAt:asc", "documentId:asc"],
        limit,
      });
    },
    async count(filters, today) {
      const row = await registerQuery(connection, filters, today)
        .countDistinct({ total: "r.id" })
        .first();
      return Number(row?.total ?? 0);
    },
    async selectPage({ filters, sort, offset, limit, today }) {
      const rows = await orderedQuery(connection, filters, sort, today)
        .select("r.document_id")
        .offset(offset)
        .limit(limit) as unknown as RecordValue[];
      return rows.map((row) => row.document_id).filter((id): id is string => typeof id === "string");
    },
    async hydrate(documentIds, options) {
      const extra = exportRelations(options?.relations ?? []);
      return documents.findMany({
        filters: { documentId: { $in: [...documentIds] } },
        populate: {
          treatmentOwner: true,
          // The approver is read only to decide the row's stage; it is never disclosed on the row.
          assessment: { populate: { approvedBy: true, assessmentRequest: true } },
          ...extra,
        },
        limit: documentIds.length,
      });
    },
    async selectedLabels(filters) {
      const result: Record<string, { documentId: string; label: string }> = {};
      const requests = [
        ["riskOwner", filters.riskOwner, "api::idambox-user.idambox-user", "displayName"],
        ["treatmentOwner", filters.treatmentOwner, "api::idambox-user.idambox-user", "displayName"],
        ["assessment", filters.assessment, "api::csrm-assessment.csrm-assessment", "assessmentNumber"],
        ["system", filters.system, "api::csrm-information-system.csrm-information-system", "name"],
        ["asset", filters.asset, "api::csrm-information-asset.csrm-information-asset", "name"],
      ] as const;
      await Promise.all(requests.map(async ([key, documentId, uid, labelField]) => {
        if (!documentId) return;
        const rows = await documentsFor(uid).findMany({
          filters: { documentId: { $eq: documentId } },
          fields: ["documentId", labelField],
          // D-32: an assessment is named by its number and its request's title (X-4), as the picker names it.
          ...(key === "assessment" ? { populate: { assessmentRequest: { fields: ["title"] } } } : {}),
          limit: 1,
        });
        const row = rows[0];
        if (row?.documentId === documentId && typeof row[labelField] === "string") {
          result[key] = { documentId, label: key === "assessment" ? assessmentLabel(row) : row[labelField] as string };
        }
      }));
      return result;
    },
  };
}
